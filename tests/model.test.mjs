import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyDraft,parseBackup,serializeBackup,meaningful,filename} from '../dist/model.mjs';
test('backup round-trip preserves Unicode, order and portrait',()=>{
  const draft={...emptyDraft(),stageName:'小麦 / Alex',bio:'一行\n第二行',photo:{dataUrl:'data:image/jpeg;base64,YQ=='},experiences:[{name:'第二场',time:'2026',description:'主持'},{name:'第一场',time:'2025',description:''}],honors:[{name:'喜剧大赛',award:'冠军',time:''}]};
  assert.deepEqual(parseBackup(serializeBackup(draft)),draft);
});
test('invalid backups reject rather than inventing values',()=>{
  for(const value of ['{',JSON.stringify({version:2,format:'muqian-actor-profile',draft:emptyDraft()}),JSON.stringify({version:1,format:'muqian-actor-profile',draft:{...emptyDraft(),experiences:[{name:5}]}}),JSON.stringify({version:1,format:'muqian-actor-profile',draft:{...emptyDraft(),photo:{dataUrl:'javascript:alert(1)'}}})]){
    assert.throws(()=>parseBackup(value));
  }
});
test('only genuinely empty entries are omitted',()=>{
  assert.equal(meaningful([{name:'  ',time:'',description:''},{name:'',time:'2026',description:''},{name:'',time:'',description:'开场演员'}]).length,2);
});
test('filenames are usable and dates are local',()=>{
  const value=filename('甲/乙:*?','演员档案','pdf');
  assert.doesNotMatch(value,/[<>:"/\\|?*]/);
  assert.match(value,/_演员档案_\d{4}-\d{2}-\d{2}\.pdf$/);
});
