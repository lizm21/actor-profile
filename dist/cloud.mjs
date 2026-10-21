import {cloudConfig} from './cloud-config.mjs';
import {validateDraft} from './model.mjs';

const metaKey='muqian-cloud-owner-v1';
const hex=(n)=>Array.from(crypto.getRandomValues(new Uint8Array(n)),x=>x.toString(16).padStart(2,'0')).join('');
export function newIdentity(){return {id:hex(16),editKey:hex(32),viewKey:hex(32),version:0,fingerprint:''};}
export function validIdentity(value){return !!(value&&/^[0-9a-f]{32}$/.test(value.id)&&/^[0-9a-f]{64}$/.test(value.editKey)&&/^[0-9a-f]{64}$/.test(value.viewKey)&&value.editKey!==value.viewKey&&Number.isInteger(value.version)&&value.version>=0);}
export function readIdentity(){try{const value=JSON.parse(localStorage.getItem(metaKey));return validIdentity(value)?value:null;}catch{return null;}}
export function storeIdentity(value){localStorage.setItem(metaKey,JSON.stringify(value));}
export function forgetIdentity(){localStorage.removeItem(metaKey);}
export function parseProfileLink(hash){
  const p=new URLSearchParams(hash.replace(/^#/,''));
  if(!p.has('profile')&&!p.has('key'))return null;
  if(!/^[0-9a-f]{32}$/.test(p.get('profile')||'')||!/^[0-9a-f]{64}$/.test(p.get('key')||''))throw new Error('档案链接不完整，请复制完整链接后再打开。');
  return {id:p.get('profile'),key:p.get('key')};
}
export function profileLink(base,id,key){const url=new URL(base);url.search='';url.hash=new URLSearchParams({profile:id,key}).toString();return url.href;}
export function publicProfileLink(base,id){const url=new URL('./',base);url.hash=new URLSearchParams({public:id}).toString();return url.href;}
export function managementLink(base,identity){
  if(!validIdentity(identity))throw new Error('管理权限无效，请先提交简历。');
  const url=new URL('./',base);url.hash=new URLSearchParams({manage:identity.id,edit:identity.editKey,view:identity.viewKey}).toString();return url.href;
}
export function parseManagementLink(input){
  let url;try{url=new URL(input.trim());}catch{throw new Error('请粘贴完整的专属管理链接。');}
  if(!['https:','http:'].includes(url.protocol))throw new Error('管理链接格式不正确。');
  const p=new URLSearchParams(url.hash.slice(1));if(!p.has('manage'))return null;
  const identity={id:p.get('manage'),editKey:p.get('edit'),viewKey:p.get('view'),version:0,fingerprint:''};
  if(!validIdentity(identity))throw new Error('管理链接不完整，请重新复制；公开浏览链接不能用于恢复修改权限。');
  return identity;
}
export function parsePublicLink(hash){const p=new URLSearchParams(hash.replace(/^#/,''));if(!p.has('public'))return null;const id=p.get('public');if(!/^[0-9a-f]{32}$/.test(id||''))throw new Error('公开档案链接不完整。');return {id};}
export async function fingerprint(draft){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(draft)))),x=>x.toString(16).padStart(2,'0')).join('');}
export function validateCloudDraft(value){
  const d=validateDraft(value);
  if(!d.stageName.trim())throw new Error('请先填写艺名。');
  if(d.stageName.length>200||d.bio.length>12000)throw new Error('艺名最多 200 字，个人简述最多 12000 字。');
  for(const key of ['experiences','honors']){
    if(d[key].length>100)throw new Error('演出经历和比赛荣誉分别最多保存 100 条。');
    for(const row of d[key])for(const [field,text] of Object.entries(row))if(text.length>({name:300,time:100}[field]||3000))throw new Error('单条经历或荣誉文字过长，请适当缩短。');
  }
  if(d.photo&&d.photo.dataUrl.length>350000)throw new Error('照片仍然过大，请换一张较简单的照片后提交。');
  if(new TextEncoder().encode(JSON.stringify(d)).length>420000)throw new Error('档案内容过多，请减少部分文字或更换较小照片。');
  return d;
}
const messages={INVALID:'档案内容超出保存限制，请检查文字和照片。',NOT_FOUND:'链接已失效、档案已删除或没有访问权限。',CONFLICT:'这份档案已在另一个页面更新。请先备份当前草稿，再点击「读取云端版本」核对。',LIMIT:'试用站今日保存量或档案总量已达上限。请先下载 PDF 或备份，稍后再试。'};
export async function cloudRequest(params,{fetcher=fetch,timeout=20000,rpc='muqian_profile'}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetcher(cloudConfig.endpoint+'/rpc/'+rpc,{method:'POST',headers:{'Authorization':'Bearer '+cloudConfig.publishableKey,'Content-Type':'application/json'},body:JSON.stringify(params),signal:controller.signal,credentials:'omit',cache:'no-store',referrerPolicy:'no-referrer'});
    if(!response.ok)throw new Error(response.status===403?'当前网址未获云端访问授权，请使用腾讯云版演员档案链接。':'云端暂时不可用，请保留本机草稿后重试。');
    const result=await response.json();
    if(result?.ok!==true){const error=new Error(messages[result?.code]||'云端保存失败，请稍后重试。');error.code=result?.code;throw error;}
    return result;
  }catch(error){if(error.name==='AbortError')throw new Error('云端响应超时。草稿已保留，请重新提交；不会重复创建档案。');throw error;}
  finally{clearTimeout(timer);}
}
export const readProfile=(id,key)=>cloudRequest({p_action:'read',p_id:id,p_key:key});
export const saveProfile=(identity,draft,published=null)=>cloudRequest({p_action:'save',p_id:identity.id,p_key:identity.editKey,p_view_key:identity.viewKey,p_version:identity.version,p_draft:validateCloudDraft(draft),p_public:published});
export const deleteProfile=identity=>cloudRequest({p_action:'delete',p_id:identity.id,p_key:identity.editKey});
export const listPublicProfiles=(query='',offset=0)=>cloudRequest({p_action:'list',p_query:query,p_offset:offset},{rpc:'muqian_directory'});
export const readPublicProfile=id=>cloudRequest({p_action:'read',p_id:id},{rpc:'muqian_directory'});
