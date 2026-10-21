import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyDraft} from '../dist/model.mjs';
import {createTransferCode,readTransferCode} from '../dist/transfer.mjs';
test('cross-browser transfer preserves Chinese text, photo and row order',()=>{
  const draft={...emptyDraft(),stageName:'演员小麦',bio:'第一行\n第二行 🎤',photo:{dataUrl:'data:image/jpeg;base64,/9j/2Q=='},experiences:[{name:'第二场',time:'',description:''},{name:'第一场',time:'2026',description:'主持'}],honors:[{name:'比赛',award:'十强',time:''}]};
  const code=createTransferCode(draft);
  assert.deepEqual(readTransferCode(code),draft);
  assert.deepEqual(readTransferCode('我的迁移码：\n'+code.match(/.{1,50}/g).join('\n')),draft);
  assert.throws(()=>readTransferCode(code.slice(0,-5)),/完整|损坏/);
  assert.throws(()=>readTransferCode(code.replace('MUQIAN1.','MUQIAN1.A')),/损坏/);
});
test('transfer rejects unsupported versions and excessive input without mutating a draft',()=>{
  const draft=emptyDraft(),original=structuredClone(draft);
  assert.throws(()=>readTransferCode('MUQIAN2.invalid.12345678'));
  assert.throws(()=>readTransferCode('x'.repeat(7*1024*1024)),/过长/);
  assert.deepEqual(draft,original);
});
