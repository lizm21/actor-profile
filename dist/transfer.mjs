import {validateDraft,SCHEMA_VERSION} from './model.mjs';
const LIMIT=3*1024*1024;
function checksum(bytes){let value=2166136261;for(const byte of bytes)value=Math.imul(value^byte,16777619)>>>0;return value.toString(16).padStart(8,'0');}
export function createTransferCode(draft){
  const bytes=new TextEncoder().encode(JSON.stringify({version:SCHEMA_VERSION,draft:validateDraft(draft)}));
  if(bytes.length>LIMIT)throw new Error('资料过长，请使用草稿备份文件迁移。');
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return `MUQIAN1.${btoa(binary).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}.${checksum(bytes)}`;
}
export function readTransferCode(text){
  if(text.length>LIMIT*2)throw new Error('迁移码过长，请检查复制的内容。');
  const match=text.replace(/\s/g,'').match(/MUQIAN1\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})/);
  if(!match)throw new Error('没有找到完整迁移码。请复制从 MUQIAN1 开始的全部内容。');
  try{
    const bytes=Uint8Array.from(atob(match[1].replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
    if(bytes.length>LIMIT||checksum(bytes)!==match[2])throw new Error();
    const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(data.version!==SCHEMA_VERSION)throw new Error();
    return validateDraft(data.draft);
  }catch{throw new Error('迁移码不完整或已损坏，当前资料未被更改。请重新复制完整内容。');}
}
