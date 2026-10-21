// Explicit integration check against the configured cloud: creates and revokes a synthetic QA profile.
import assert from 'node:assert/strict';
import {cloudConfig as c} from '../dist/cloud-config.mjs';
import {newIdentity,saveProfile,readProfile,deleteProfile,cloudRequest} from '../dist/cloud.mjs';
import {emptyDraft} from '../dist/model.mjs';
const id=newIdentity();
let created=false;
const draft={...emptyDraft(),stageName:'自动验证·非真实演员',bio:'中文跨浏览器测试\n第二行',photo:{dataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM1cAAAAASUVORK5CYII='},experiences:[{name:'测试演出',time:'2026',description:'仅用于功能验证'}]};
const expectCode=(promise,code)=>assert.rejects(promise,e=>e.code===code);
try{
 const a=await saveProfile(id,draft);created=true;id.version=a.version;assert.equal(a.version,1);console.log('Created QA profile');
 const read=await readProfile(id.id,id.viewKey);assert.deepEqual(read.draft,draft);
 assert.equal((await saveProfile({...id,version:0},draft)).version,1);
 await expectCode(readProfile(id.id,'0'.repeat(64)),'NOT_FOUND');
 await expectCode(saveProfile({...id,editKey:id.viewKey},draft),'NOT_FOUND');
 await expectCode(deleteProfile({...id,editKey:id.viewKey}),'NOT_FOUND');
 await expectCode(saveProfile({...id,version:0},{...draft,bio:'stale'}),'CONFLICT');
 await expectCode(cloudRequest({p_action:'save',p_id:id.id,p_key:id.editKey,p_view_key:id.viewKey,p_version:1,p_draft:{...draft,bio:null}}),'INVALID');
 const concurrent=await Promise.allSettled([saveProfile(id,{...draft,bio:'版本 A'}),saveProfile(id,{...draft,bio:'版本 B'})]);
 assert.equal(concurrent.filter(x=>x.status==='fulfilled').length,1);assert.equal(concurrent.find(x=>x.status==='rejected').reason.code,'CONFLICT');
 assert.equal((await readProfile(id.id,id.viewKey)).version,2);
 for(const table of ['muqian_profiles','muqian_write_budget']){
  const r=await fetch(c.endpoint+'/'+table+'?select=*',{headers:{Authorization:'Bearer '+c.publishableKey}});assert.ok([401,403].includes(r.status),'Direct table access must be denied');
 }
 const cors=await fetch(c.endpoint+'/rpc/muqian_profile',{method:'OPTIONS',headers:{Origin:'https://codex-d2g25pxe97f6c229f-1332018116.tcloudbaseapp.com','Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'authorization,content-type'}});
 assert.ok(cors.ok);assert.equal(cors.headers.get('access-control-allow-origin'),'https://codex-d2g25pxe97f6c229f-1332018116.tcloudbaseapp.com');
 console.log('PASS: create, image/text readback, idempotent retry, wrong-token denial, read-only link, stale-write conflict, concurrent writes, validation, private tables, CORS');
}finally{if(created){await deleteProfile(id);await expectCode(readProfile(id.id,id.viewKey),'NOT_FOUND');console.log('PASS: QA cloud draft revoked and content removed');}}
