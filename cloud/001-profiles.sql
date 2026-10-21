BEGIN;
CREATE TABLE public.muqian_profiles (
  id text PRIMARY KEY CHECK (id ~ '^[0-9a-f]{32}$'),
  edit_hash bytea NOT NULL,
  view_hash bytea NOT NULL,
  draft jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted boolean NOT NULL DEFAULT false
);
CREATE TABLE public.muqian_write_budget (
  day date PRIMARY KEY,
  creates integer NOT NULL DEFAULT 0,
  writes integer NOT NULL DEFAULT 0
);
ALTER TABLE public.muqian_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.muqian_write_budget ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.muqian_profiles, public.muqian_write_budget FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.muqian_profile(
  p_action text, p_id text, p_key text, p_draft jsonb DEFAULT NULL,
  p_view_key text DEFAULT NULL, p_version integer DEFAULT 0
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  rec public.muqian_profiles%ROWTYPE;
  budget public.muqian_write_budget%ROWTYPE;
  row_data jsonb;
  field_name text;
  list_name text;
  key_hash bytea;
  is_new boolean;
BEGIN
  IF p_action IS NULL OR p_action NOT IN ('read','save','delete') OR p_id IS NULL
    OR p_id !~ '^[0-9a-f]{32}$' OR p_key IS NULL OR p_key !~ '^[0-9a-f]{64}$' THEN
    RETURN jsonb_build_object('ok',false,'code','INVALID');
  END IF;
  key_hash := sha256(convert_to(p_key,'UTF8'));
  IF p_action = 'read' THEN
    SELECT * INTO rec FROM public.muqian_profiles WHERE id=p_id AND NOT deleted
      AND (view_hash=key_hash OR edit_hash=key_hash);
    IF NOT FOUND THEN RETURN jsonb_build_object('ok',false,'code','NOT_FOUND'); END IF;
    RETURN jsonb_build_object('ok',true,'draft',rec.draft,'version',rec.version,'updatedAt',rec.updated_at);
  END IF;
  -- Serialize writes for one profile, including concurrent first submissions.
  PERFORM pg_advisory_xact_lock(hashtextextended('muqian:' || p_id,0));
  SELECT * INTO rec FROM public.muqian_profiles WHERE id=p_id FOR UPDATE;
  is_new := NOT FOUND;
  IF NOT is_new AND (rec.deleted OR rec.edit_hash<>key_hash) THEN
    RETURN jsonb_build_object('ok',false,'code','NOT_FOUND');
  END IF;
  IF p_action='delete' THEN
    IF is_new THEN RETURN jsonb_build_object('ok',false,'code','NOT_FOUND'); END IF;
    UPDATE public.muqian_profiles SET draft=NULL,deleted=true,version=version+1,updated_at=now() WHERE id=p_id;
    RETURN jsonb_build_object('ok',true);
  END IF;
  IF jsonb_typeof(p_draft) IS DISTINCT FROM 'object' OR octet_length(p_draft::text)>450000
    OR p_version IS NULL OR p_version<0 OR p_view_key IS NULL OR p_view_key !~ '^[0-9a-f]{64}$'
    OR p_key=p_view_key THEN RETURN jsonb_build_object('ok',false,'code','INVALID'); END IF;
  IF jsonb_typeof(p_draft->'stageName') IS DISTINCT FROM 'string'
    OR length(btrim(p_draft->>'stageName'))=0 OR length(p_draft->>'stageName')>200
    OR jsonb_typeof(p_draft->'bio') IS DISTINCT FROM 'string' OR length(p_draft->>'bio')>12000
    OR NOT (p_draft ? 'photo') OR (p_draft - ARRAY['stageName','bio','photo','experiences','honors'])<>'{}'::jsonb
    THEN RETURN jsonb_build_object('ok',false,'code','INVALID'); END IF;
  IF p_draft->'photo'<>'null'::jsonb THEN
    IF jsonb_typeof(p_draft->'photo') IS DISTINCT FROM 'object'
      OR jsonb_typeof(p_draft->'photo'->'dataUrl') IS DISTINCT FROM 'string'
      OR length(p_draft->'photo'->>'dataUrl')>350000
      OR (p_draft->'photo'->>'dataUrl') !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$'
      OR ((p_draft->'photo') - 'dataUrl')<>'{}'::jsonb
      THEN RETURN jsonb_build_object('ok',false,'code','INVALID'); END IF;
  END IF;
  FOREACH list_name IN ARRAY ARRAY['experiences','honors'] LOOP
    IF jsonb_typeof(p_draft->list_name) IS DISTINCT FROM 'array' THEN
      RETURN jsonb_build_object('ok',false,'code','INVALID'); END IF;
    IF jsonb_array_length(p_draft->list_name)>100 THEN RETURN jsonb_build_object('ok',false,'code','INVALID'); END IF;
    FOR row_data IN SELECT value FROM jsonb_array_elements(p_draft->list_name) LOOP
      IF jsonb_typeof(row_data) IS DISTINCT FROM 'object' THEN RETURN jsonb_build_object('ok',false,'code','INVALID'); END IF;
      FOREACH field_name IN ARRAY (CASE WHEN list_name='experiences' THEN ARRAY['name','time','description'] ELSE ARRAY['name','time','award'] END) LOOP
        IF jsonb_typeof(row_data->field_name) IS DISTINCT FROM 'string'
          OR length(row_data->>field_name)>(CASE field_name WHEN 'name' THEN 300 WHEN 'time' THEN 100 ELSE 3000 END)
          THEN RETURN jsonb_build_object('ok',false,'code','INVALID'); END IF;
      END LOOP;
      IF (row_data - CASE WHEN list_name='experiences' THEN ARRAY['name','time','description'] ELSE ARRAY['name','time','award'] END)<>'{}'::jsonb
        THEN RETURN jsonb_build_object('ok',false,'code','INVALID'); END IF;
    END LOOP;
  END LOOP;
  IF NOT is_new THEN
    IF rec.view_hash<>sha256(convert_to(p_view_key,'UTF8')) THEN RETURN jsonb_build_object('ok',false,'code','NOT_FOUND'); END IF;
    -- Retrying a successful request must not overwrite a newer version or duplicate it.
    IF rec.draft=p_draft THEN RETURN jsonb_build_object('ok',true,'version',rec.version,'updatedAt',rec.updated_at); END IF;
    IF rec.version<>p_version THEN RETURN jsonb_build_object('ok',false,'code','CONFLICT'); END IF;
  ELSIF p_version<>0 THEN RETURN jsonb_build_object('ok',false,'code','NOT_FOUND');
  END IF;
  INSERT INTO public.muqian_write_budget(day) VALUES (current_date) ON CONFLICT DO NOTHING;
  SELECT * INTO budget FROM public.muqian_write_budget WHERE day=current_date FOR UPDATE;
  IF budget.writes>=1000 OR (is_new AND (budget.creates>=50 OR (SELECT count(*) FROM public.muqian_profiles)>=1000)) THEN
    RETURN jsonb_build_object('ok',false,'code','LIMIT');
  END IF;
  UPDATE public.muqian_write_budget SET writes=writes+1,creates=creates+CASE WHEN is_new THEN 1 ELSE 0 END WHERE day=current_date;
  DELETE FROM public.muqian_write_budget WHERE day<current_date-7;
  IF is_new THEN
    INSERT INTO public.muqian_profiles(id,edit_hash,view_hash,draft)
      VALUES(p_id,key_hash,sha256(convert_to(p_view_key,'UTF8')),p_draft) RETURNING * INTO rec;
  ELSE
    UPDATE public.muqian_profiles SET draft=p_draft,version=version+1,updated_at=now() WHERE id=p_id RETURNING * INTO rec;
  END IF;
  RETURN jsonb_build_object('ok',true,'version',rec.version,'updatedAt',rec.updated_at);
END;
$function$;
REVOKE ALL ON FUNCTION public.muqian_profile(text,text,text,jsonb,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.muqian_profile(text,text,text,jsonb,text,integer) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
