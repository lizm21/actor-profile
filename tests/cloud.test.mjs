import test from 'node:test';
import assert from 'node:assert/strict';
import {newIdentity,validIdentity,profileLink,parseProfileLink,validateCloudDraft,cloudRequest} from '../dist/cloud.mjs';
import {emptyDraft} from '../dist/model.mjs';
test('share links contain only view capability and round-trip without personal data',()=>{
  const id=newIdentity();assert.ok(validIdentity(id));
  const url=profileLink('https://example.test/actor/?tracking=1',id.id,id.viewKey);
  assert.ok(!url.includes(id.editKey));assert.ok(!url.includes('tracking'));
  assert.deepEqual(parseProfileLink(new URL(url).hash),{id:id.id,key:id.viewKey});
  assert.throws(()=>parseProfileLink('#profile=bad'));assert.equal(parseProfileLink(''),null);
});
test('cloud limits reject oversized profiles and preserve Chinese and photos',()=>{
  const draft={...emptyDraft(),stageName:'李小幕',bio:'你好\n舞台',photo:{dataUrl:'data:image/jpeg;base64,YWJj'}};
  assert.deepEqual(validateCloudDraft(draft),draft);
  assert.throws(()=>validateCloudDraft({...draft,bio:'字'.repeat(12001)}));
  assert.throws(()=>validateCloudDraft({...draft,experiences:Array(101).fill({name:'',time:'',description:''})}));
});
test('transport propagates permission and conflict failures, never sends cookies',async()=>{
  let request;
  const fetcher=async(url,options)=>{request=options;return new Response(JSON.stringify({ok:false,code:'CONFLICT'}));};
  await assert.rejects(cloudRequest({p_action:'save'},{fetcher}),e=>e.code==='CONFLICT');
  assert.equal(request.credentials,'omit');assert.equal(request.referrerPolicy,'no-referrer');
  await assert.rejects(cloudRequest({},{fetcher:async()=>new Response('',{status:403})}),/授权/);
});
