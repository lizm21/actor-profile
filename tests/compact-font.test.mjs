import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {compactTrueType} from '../dist/compact-font.mjs';
const require=createRequire(import.meta.url),kit=require('../dist/vendor/fontkit.umd.min.js');
const source=fs.readFileSync(new URL('../dist/fonts/NotoSansSC-Regular.ttf',import.meta.url));
test('font compaction preserves Chinese and composite Latin outlines and metrics',()=>{
  const original=kit.create(source),sample='演员档案小麦喜剧比赛荣誉经历简介测试龘龍éÅñü中文，。！？（）123ABC';
  const ids=[...sample].map(c=>original.glyphForCodePoint(c.codePointAt(0)).id);
  const bytes=compactTrueType(source,ids),compact=kit.create(bytes);
  assert.ok(bytes.length<source.length/5);
  for(const c of sample){const before=original.glyphForCodePoint(c.codePointAt(0)),after=compact.glyphForCodePoint(c.codePointAt(0));assert.equal(after.advanceWidth,before.advanceWidth);assert.deepEqual(after.path.commands,before.path.commands,`outline changed for ${c}`);}
  let sum=0;const view=new DataView(bytes.buffer);for(let i=0;i<bytes.length;i+=4)sum=(sum+view.getUint32(i))>>>0;
  assert.equal(sum,0xB1B0AFBA);
});
