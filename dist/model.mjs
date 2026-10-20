export const SCHEMA_VERSION = 1;
export function emptyDraft() { return {stageName:'',bio:'',photo:null,experiences:[],honors:[]}; }
export function cleanText(s) { return s.replace(/\r\n?/g,'\n').replace(/\t/g,'    ').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,''); }
export function meaningful(rows) { return rows.filter(row => Object.values(row).some(v=>typeof v === 'string' && v.trim())); }
export function validateDraft(input) {
  const fail=()=>{throw new Error('备份格式不正确，当前档案未被更改。');};
  if(!input || typeof input!=='object' || Array.isArray(input)) fail();
  const string=(v)=>{if(typeof v!=='string')fail(); return cleanText(v);};
  const rows=(v,keys)=>{
    if(!Array.isArray(v))fail();
    return v.map(row=>{if(!row||typeof row!=='object'||Array.isArray(row))fail();return Object.fromEntries(keys.map(k=>[k,string(row[k])]))});
  };
  let photo=null;
  if(input.photo!==null){
    if(!input.photo||typeof input.photo!=='object'||typeof input.photo.dataUrl!=='string'||!/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(input.photo.dataUrl)||input.photo.dataUrl.length>14*1024*1024)fail();
    photo={dataUrl:input.photo.dataUrl};
  }
  return {stageName:string(input.stageName),bio:string(input.bio),photo,experiences:rows(input.experiences,['name','time','description']),honors:rows(input.honors,['name','award','time'])};
}
export function parseBackup(text) {
  let value;
  try {value=JSON.parse(text)} catch {throw new Error('无法读取备份：请选择有效的 JSON 草稿文件。');}
  if(value?.format!=='muqian-actor-profile'||value.version!==SCHEMA_VERSION) throw new Error('这不是受支持的幕前草稿备份，当前档案未被更改。');
  return validateDraft(value.draft);
}
export function serializeBackup(draft) {
  return JSON.stringify({format:'muqian-actor-profile',version:SCHEMA_VERSION,exportedAt:new Date().toISOString(),draft},null,2);
}
export function filename(name,suffix,extension) {
  const safe=name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/,'').slice(0,70)||'未命名';
  const now=new Date();const date=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
  return `${safe}_${suffix}_${date}.${extension}`;
}
