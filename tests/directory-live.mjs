// Explicit live check: only synthetic profiles, revoked in finally.
import assert from 'node:assert/strict';
import {newIdentity,saveProfile,readProfile,deleteProfile,listPublicProfiles,readPublicProfile,cloudRequest} from '../dist/cloud.mjs';
import {emptyDraft} from '../dist/model.mjs';
const a=newIdentity(),b=newIdentity(),created=[];
const marker='广场自动验证'+a.id.slice(0,8);
const draft={...emptyDraft(),stageName:marker,bio:'合成资料，测试结束后撤回。'};
const denied=p=>assert.rejects(p,e=>e.code==='NOT_FOUND');
const save=async(identity,data,visibility)=>{const r=await saveProfile(identity,data,visibility);identity.version=r.version;return r;};
try{
  assert.equal((await save(a,draft)).published,false);created.push(a);
  assert.equal((await listPublicProfiles(marker)).total,0);await denied(readPublicProfile(a.id));
  const pub=await save(a,draft,true);assert.equal(pub.published,true);assert.equal(pub.version,2);
  assert.equal((await saveProfile({...a,version:1},draft,true)).version,2,'Identical publication retry is idempotent');
  const listed=await listPublicProfiles(marker);assert.equal(listed.total,1);assert.equal(listed.profiles[0].id,a.id);
  assert.deepEqual(Object.keys(listed.profiles[0]).sort(),['id','stageName','bio','photo','experienceCount','honorCount'].sort());
  assert.equal((await readPublicProfile(a.id)).draft.stageName,marker);
  await denied(saveProfile({...a,editKey:a.viewKey},draft,false));
  await assert.rejects(saveProfile({...a,version:1},draft,false),e=>e.code==='CONFLICT');
  assert.equal((await save(a,{...draft,bio:'旧客户端内容更新'})).published,true);
  await save(b,{...draft,stageName:marker+'第二位'},true);created.push(b);
  assert.equal((await listPublicProfiles(marker)).total,2);
  const second=await listPublicProfiles(marker,1);assert.equal(second.profiles.length,1);assert.equal(second.profiles[0].id,a.id);
  assert.equal((await listPublicProfiles(marker+'不存在')).total,0);
  await assert.rejects(cloudRequest({p_action:'list',p_offset:-1},{rpc:'muqian_directory'}),e=>e.code==='INVALID');
  await assert.rejects(cloudRequest({p_action:'delete',p_id:a.id},{rpc:'muqian_directory'}),e=>e.code==='INVALID');
  await save(a,draft,false);assert.equal((await listPublicProfiles(marker)).total,1);await denied(readPublicProfile(a.id));
  assert.equal((await readProfile(a.id,a.viewKey)).draft.stageName,marker,'Withdrawal keeps intentional private sharing');
  await save(b,{...draft,stageName:marker+'第二位'},false);
  assert.equal((await listPublicProfiles(marker)).total,0);
  await save(b,draft,true);
  console.log('PASS: private by default, explicit publication, safe public projection, search/pagination, legacy compatibility, conflict and owner authorization, atomic withdrawal');
}finally{
  for(const identity of created){await deleteProfile(identity);await denied(readPublicProfile(identity.id));}
  assert.equal((await listPublicProfiles(marker)).total,0);
  console.log('PASS: deleted public profiles disappear, synthetic cloud data revoked');
}
