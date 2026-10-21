import fs from 'node:fs/promises';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {createProfilePdf} from '../dist/pdf.mjs';
import {emptyDraft,serializeBackup} from '../dist/model.mjs';
const require=createRequire(import.meta.url);
const PDFLib=require('../dist/vendor/pdf-lib.min.js');
const fontkit=require('../dist/vendor/fontkit.umd.min.js');
const fontBytes=await fs.readFile(new URL('../dist/fonts/NotoSansSC-Regular.ttf',import.meta.url));
await fs.mkdir(new URL('../tmp/qa/',import.meta.url),{recursive:true});
const base={...emptyDraft(),stageName:'小麦 Alex（测试档案）',bio:'以生活观察与即兴互动为创作起点。\n在细小的日常里，找到意想不到的笑声。',experiences:[{name:'个人专场《慢半拍》',time:'2026.10',description:'担任主咖，完成 60 分钟个人专场。此处为功能验证用虚构内容。'},{name:'城市喜剧之夜',time:'2026.08',description:'参与拼盘演出，与不同风格的演员共同呈现现场。'}],honors:[{name:'新人喜剧比赛（虚构）',time:'2026',award:'年度十强'}]};
const cases={
  minimal:{...emptyDraft(),stageName:'只有艺名'},
  standard:base,
  long:{...base,experiences:Array.from({length:30},(_,i)=>({name:`第${i+1}场：喜剧专场与拼盘演出`,time:'2026.10',description:'这是一段用于检查中文换行和多页排版的经历说明。含英文 Stand-up comedy，以及标点：“你好！”'.repeat(i===14?40:3)})),honors:Array.from({length:20},(_,i)=>({name:`第${i+1}届喜剧比赛`,award:'获得年度荣誉，感谢每一位观众。',time:'2026'}))},
  longName:{...emptyDraft(),stageName:'长艺名排版验证'.repeat(30),bio:'这是非常长的艺名后面的正文。'},
};
try{const image=await fs.readFile(new URL('../tmp/qa/portrait.jpg',import.meta.url));cases.photo={...base,photo:{dataUrl:`data:image/jpeg;base64,${image.toString('base64')}`}};}catch{}
for(const [name,draft] of Object.entries(cases)){
  const bytes=await createProfilePdf(draft,{PDFLib,fontkit,fontBytes});
  await fs.writeFile(new URL(`../tmp/qa/${name}.pdf`,import.meta.url),bytes);
  const parsed=await PDFLib.PDFDocument.load(bytes);
  console.log(JSON.stringify({name,pages:parsed.getPageCount(),bytes:bytes.length}));
  if(name==='minimal')assert.equal(parsed.getPageCount(),1);
  if(name!=='photo')assert.ok(bytes.length<400000,'text PDF should remain under 400 KB');
  if(name==='long')assert.ok(parsed.getPageCount()>3);
}
await assert.rejects(()=>createProfilePdf({...base,stageName:'测试🦄'},{PDFLib,fontkit,fontBytes}),/字体暂不支持/);
await assert.rejects(()=>createProfilePdf(emptyDraft(),{PDFLib,fontkit,fontBytes}),/艺名/);
await fs.writeFile(new URL('../tmp/qa/roundtrip.json',import.meta.url),serializeBackup(cases.photo||base));
await fs.writeFile(new URL('../tmp/qa/invalid.json',import.meta.url),'{"format":"broken"}');
console.log('PDF validation: unsupported characters and empty name rejected; fixtures saved.');
