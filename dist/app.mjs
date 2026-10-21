import {emptyDraft,meaningful,validateDraft,parseBackup,serializeBackup,filename,cleanText} from './model.mjs';
import {openStorage,readDraft,writeDraft} from './storage.mjs';
import {createProfilePdf} from './pdf.mjs';
import {normalizePhoto,photoBytes} from './photo.mjs';
import {newIdentity,readIdentity,storeIdentity,forgetIdentity,parseProfileLink,profileLink,fingerprint,readProfile,saveProfile,deleteProfile,parsePublicLink,publicProfileLink,readPublicProfile,managementLink,parseManagementLink} from './cloud.mjs?v=20261021-3';
import {handoffState} from './handoff.mjs';

const $=id=>document.getElementById(id);
let draft=emptyDraft(),ready=false,storageReady=false,timer,revision=0,saveChain=Promise.resolve(),pdfUrl=null,photoRevision=0,photoBusy=false,pdfFile=null;
const isWeChat=/MicroMessenger/i.test(navigator.userAgent);
let identity=readIdentity(),viewOnly=false,publicView=false,cloudBusy=false,cloudDirty=true,sharedLink=null;
let published=false,desiredPublic=identity?.published===true,lastCloudError='';
function syncBrowserGuide(){
  const state=handoffState({sharedLink,cloudDirty,cloudBusy,viewOnly});
  $('browser-status').textContent=state.message+(!state.link&&lastCloudError?' '+lastCloudError:'');
  $('browser-ready').hidden=!state.link;
  $('browser-link').value=state.link||'';
  $('browser-retry').hidden=!!state.link||cloudBusy||viewOnly;
}
function cloudStatus(message,error=false){lastCloudError=error?message:'';$('cloud-status').textContent=message;$('cloud-status').classList.toggle('error',error);}
function cloudControls(){
  $('cloud-retry').hidden=viewOnly;
  $('cloud-retry').disabled=cloudBusy||!ready||photoBusy;
  $('reload-cloud').hidden=viewOnly||!identity?.version;
  $('delete-cloud').hidden=viewOnly||!identity?.version;
  $('delete-cloud').disabled=cloudBusy;
  $('cloud-link-box').hidden=!sharedLink||(!viewOnly&&cloudDirty);
  if(sharedLink)$('cloud-link').value=sharedLink;
  $('visibility-status').textContent=published?'已公开展示在演员广场。':'未公开到演员广场，仅凭查看链接可访问。';
  $('owner-access').hidden=viewOnly||!identity?.version;
  if(viewOnly||!identity?.version){$('management-link').value='';$('management-link').hidden=true;$('management-status').textContent='';}
  $('restore-owner').disabled=cloudBusy||photoBusy||!ready;
  $('restore-owner').hidden=viewOnly;
  syncBrowserGuide();
}
function feedback(message=''){ for(const id of ['feedback','preview-feedback']){$(id).textContent=message;$(id).hidden=!message;} }
function savedStatus(message,error=false){$('save-status').textContent=message;$('save-status').classList.toggle('error',error);}
function changed(){
  revision++; clearTimeout(timer);
  cloudDirty=true;cloudStatus('修改尚未提交到云端，请点击「提交并预览」。');cloudControls();
  $('pdf-result').hidden=true;renderPreview();
  if(storageReady){savedStatus('正在保存…');timer=setTimeout(flush,350);}
  else savedStatus('本机保存不可用，请下载备份',true);
}
function flush(){
  clearTimeout(timer);if(!storageReady||!ready||viewOnly)return;
  const snapshot=structuredClone(draft),version=revision;
  saveChain=saveChain.then(()=>writeDraft(snapshot)).then(()=>{
    if(version===revision)savedStatus('已保存到当前浏览器');
  }).catch(()=>{savedStatus('保存失败，请下载备份',true);});
}
function el(tag,classes,text){
  const node=document.createElement(tag);if(classes)node.className=classes;if(text!==undefined)node.textContent=text;return node;
}
function renderPreview(){
  const paper=$('paper');paper.replaceChildren();
  const top=el('div','resume-top'),info=el('div','resume-top-text');
  info.append(el('p','resume-kicker','ACTOR PROFILE'),el('h2',`resume-name${draft.stageName.trim()?'':' preview-placeholder'}`,draft.stageName.trim()||'你的艺名'),el('p','resume-subtitle','演员档案'));
  top.append(info);
  if(draft.photo){const image=el('img','resume-photo');image.src=draft.photo.dataUrl;image.alt='演员照片';top.append(image);}
  paper.append(top);
  const appendSection=(title)=>{const section=el('section','resume-section');section.append(el('h3','',title));paper.append(section);return section;};
  if(draft.bio.trim())appendSection('个人简述').append(el('p','',draft.bio.trim()));
  for(const [key,title,body] of [['experiences','演出经历','description'],['honors','比赛荣誉','award']]){
    const rows=meaningful(draft[key]);if(!rows.length)continue;
    const section=appendSection(title);
    rows.forEach(row=>{
      const entry=el('div','resume-entry'),heading=el('div','resume-entry-title');
      if(row.name.trim())heading.append(el('strong','',row.name.trim()));
      if(row.time.trim())heading.append(el('time','',row.time.trim()));
      if(heading.childNodes.length)entry.append(heading);
      if(row[body].trim())entry.append(el('p','',row[body].trim()));
      section.append(entry);
    });
  }
  if(!draft.stageName.trim()&&!draft.bio.trim()&&!draft.photo&&!meaningful(draft.experiences).length&&!meaningful(draft.honors).length){
    const empty=el('div','blank-state');empty.append(el('div','blank-line'),el('div','blank-line'),el('div','blank-line short'),el('p','','你的故事，从这里开始。\n填写左侧资料，档案会实时呈现。'));paper.append(empty);
  }
}
function fieldFor(key,index,field,label,placeholder,multiline=false){
  const wrapper=el('div',multiline?'wide':'');
  const id=`${key}-${index}-${field}`,labelNode=el('label','',label);labelNode.htmlFor=id;
  const input=el(multiline?'textarea':'input');input.id=id;input.name=id;
  if(!multiline)input.type='text';else input.rows=3;
  input.placeholder=placeholder;input.value=draft[key][index][field];input.autocomplete='off';
  input.addEventListener('input',()=>{draft[key][index][field]=cleanText(input.value);changed();});
  wrapper.append(labelNode,input);return wrapper;
}
function renderRows(key){
  const experience=key==='experiences',host=$(key),singular=experience?'演出经历':'比赛荣誉';
  host.replaceChildren();
  $(experience?'experience-count':'honor-count').textContent=draft[key].length;
  $(experience?'experience-empty':'honor-empty').hidden=!!draft[key].length;
  draft[key].forEach((row,index)=>{
    const entry=el('div','entry'),top=el('div','entry-top'),actions=el('div','entry-actions');
    top.append(el('span','entry-title',`${singular} ${String(index+1).padStart(2,'0')}`));
    for(const [caption,label,delta] of [['↑','上移',-1],['↓','下移',1],['删除','删除',0]]){
      const button=el('button','',caption);button.type='button';button.setAttribute('aria-label',`${label}${singular}第 ${index+1} 条`);
      button.disabled=(delta<0&&index===0)||(delta>0&&index===draft[key].length-1);
      button.addEventListener('click',()=>{
        if(delta){[draft[key][index],draft[key][index+delta]]=[draft[key][index+delta],draft[key][index]];}
        else draft[key].splice(index,1);
        renderRows(key);changed();
        const focusIndex=Math.max(0,Math.min(index+delta,draft[key].length-1));
        (document.getElementById(`${key}-${focusIndex}-name`)||$(experience?'add-experience':'add-honor')).focus();
      });
      actions.append(button);
    }
    top.append(actions);entry.append(top);
    const grid=el('div','entry-grid');
    grid.append(fieldFor(key,index,'name',experience?'演出名称':'比赛名称',experience?'例如：个人专场 / 拼盘演出':'例如：某某喜剧大赛'),fieldFor(key,index,'time','时间（选填）','例如：2026.10'));
    entry.append(grid,fieldFor(key,index,experience?'description':'award',experience?'经历说明（选填）':'获得荣誉',experience?'写下你的角色、场地或其他值得记录的内容。':'例如：年度总冠军 / 十强',true));host.append(entry);
  });
}
function renderForm(){
  $('publish-public').checked=desiredPublic;
  $('stage-name').value=draft.stageName;$('bio').value=draft.bio;
  $('photo-thumb').hidden=!draft.photo;$('photo-empty').hidden=!!draft.photo;$('remove-photo').hidden=!draft.photo;
  if(draft.photo)$('photo-thumb').src=draft.photo.dataUrl;else $('photo-thumb').removeAttribute('src');
  $('photo-size').textContent=draft.photo?`已压缩至约 ${Math.ceil(photoBytes(draft.photo)/1024)} KB，保持原比例`:'';
  renderRows('experiences');renderRows('honors');renderPreview();
}
function downloadBlob(blob,name,keep=false){
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  if(!keep)setTimeout(()=>URL.revokeObjectURL(url),60000);return url;
}
$('stage-name').addEventListener('input',e=>{
  draft.stageName=cleanText(e.target.value);$('stage-name').removeAttribute('aria-invalid');$('name-error').hidden=true;changed();
});
$('bio').addEventListener('input',e=>{draft.bio=cleanText(e.target.value);changed();});
$('publish-public').addEventListener('change',e=>{desiredPublic=e.target.checked;changed();});
$('profile-form').addEventListener('submit',e=>{e.preventDefault();openPreview();});
for(const [button,key] of [['add-experience','experiences'],['add-honor','honors']]){
  $(button).addEventListener('click',()=>{
    draft[key].push(key==='experiences'?{name:'',time:'',description:''}:{name:'',award:'',time:''});renderRows(key);changed();
    document.getElementById(`${key}-${draft[key].length-1}-name`).focus();
  });
}
$('choose-photo').addEventListener('click',()=>$('photo-input').click());
$('photo-input').addEventListener('change',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  const ownRevision=++photoRevision;feedback();
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){feedback('请选择 JPG、PNG 或 WebP 格式的照片。');return;}
  if(file.size>10*1024*1024){feedback('照片超过 10 MB，请选择较小的图片。');return;}
  photoBusy=true;$('submit-preview').disabled=true;$('choose-photo').disabled=true;const url=URL.createObjectURL(file);
  try{const photo=await normalizePhoto(url);if(ownRevision!==photoRevision)return;draft.photo=photo;renderForm();changed();}
  catch(error){feedback(error.message);}
  finally{URL.revokeObjectURL(url);photoBusy=false;$('submit-preview').disabled=false;$('choose-photo').disabled=false;}
});
$('remove-photo').addEventListener('click',()=>{photoRevision++;draft.photo=null;renderForm();changed();});
$('backup').addEventListener('click',()=>{
  if(!ready||viewOnly)return;downloadBlob(new Blob([serializeBackup(draft)],{type:'application/json;charset=utf-8'}),filename(draft.stageName,'草稿备份','json'));feedback('草稿备份已生成。请妥善保存，文件包含你填写的文字和照片。');
});
$('import').addEventListener('click',()=>{if(ready)$('backup-input').click();});
$('backup-input').addEventListener('change',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;feedback();
  const startRevision=revision;
  try{
    if(file.size>25*1024*1024)throw new Error('备份超过 25 MB，无法导入。');
    const incoming=parseBackup(await file.text());
    if(incoming.photo){
      const image=new Image();image.src=incoming.photo.dataUrl;
      try{await image.decode();}catch{throw new Error('备份中的照片已损坏，当前档案未被更改。');}
      incoming.photo=await normalizePhoto(incoming.photo.dataUrl);
    }
    if(!confirm(startRevision!==revision?'读取备份期间你修改了档案。仍要用备份覆盖当前内容吗？':'导入会覆盖当前浏览器中的这份档案。建议先备份，是否继续？'))return;
    photoRevision++;draft=incoming;renderForm();changed();flush();feedback('草稿已导入。请检查内容后继续编辑。');
  }catch(error){feedback(error.message);}
});
$('clear').addEventListener('click',()=>{
  if(!ready||cloudBusy||!confirm('清空本机草稿并开始新档案？已提交的云端档案不会删除；如需撤回，请先点击预览中的「删除云端档案」。请先下载备份。'))return;
  try{forgetIdentity();}catch{feedback('无法清空本机编辑权限，请检查浏览器存储设置。');return;}
  identity=null;sharedLink=null;published=false;desiredPublic=false;history.replaceState(null,'',location.pathname+location.search);cloudControls();
  photoRevision++;draft=emptyDraft();renderForm();changed();flush();feedback();$('name-error').hidden=true;$('stage-name').removeAttribute('aria-invalid');$('stage-name').focus();
});
$('export-pdf').addEventListener('click',async()=>{
  if(publicView||!ready||photoBusy)return;feedback();$('pdf-result').hidden=true;
  if(!draft.stageName.trim()){
    $('name-error').hidden=false;$('stage-name').setAttribute('aria-invalid','true');$('stage-name').focus();return;
  }
  if(isWeChat){
    $('browser-copy-status').textContent='';syncBrowserGuide();
    if(!$('browser-dialog').open)$('browser-dialog').showModal();
    if(!viewOnly&&cloudDirty&&!cloudBusy)await submitCloud();
    return;
  }
  const button=$('export-pdf'),label=button.querySelector('span');button.disabled=true;button.setAttribute('aria-busy','true');label.textContent='正在生成…';
  const snapshot=structuredClone(draft),startRevision=revision;
  try{
    if(snapshot.photo)snapshot.photo=await normalizePhoto(snapshot.photo.dataUrl);
    const bytes=await createProfilePdf(snapshot);const blob=new Blob([bytes],{type:'application/pdf'});
    const pdfName=filename(snapshot.stageName,'演员档案','pdf');
    if(pdfUrl)URL.revokeObjectURL(pdfUrl);
    pdfUrl=downloadBlob(blob,pdfName,true);
    $('save-pdf').href=pdfUrl;$('save-pdf').download=pdfName;
    $('open-pdf').href=pdfUrl;$('open-pdf').hidden=false;
    pdfFile=typeof File==='function'?new File([blob],pdfName,{type:'application/pdf'}):null;
    let canShare=false;try{canShare=!!(pdfFile&&navigator.canShare?.({files:[pdfFile]}));}catch{}
    $('share-pdf').hidden=!canShare;
    $('download-help').textContent='没有自动下载时，请点击「保存 PDF」，或在当前浏览器预览后保存。';
    $('pdf-result').hidden=false;
    if(startRevision!==revision)feedback('已导出点击下载时的档案。生成期间的修改已保留，请再次下载以导出最新内容。');
  }catch(error){feedback(error.message||'PDF 生成失败，请重试。草稿仍然保留。');}
  finally{button.disabled=false;button.removeAttribute('aria-busy');label.textContent='下载 PDF';}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
window.addEventListener('pagehide',flush);
window.addEventListener('hashchange',async()=>{flush();await saveChain;location.reload();});
async function init(){
  let incoming=null,publicIncoming=null,linkError=null;
  const requestedManagement=new URLSearchParams(location.hash.slice(1)).has('manage');
  let managementInput='';
  if(requestedManagement){
    managementInput=location.href;
    // Remove the editing capability from the address bar before reading the draft.
    history.replaceState(null,'',location.pathname+location.search);
  }
  publicView=new URLSearchParams(location.hash.replace(/^#/, '')).has('public');
  if(publicView){
    document.body.classList.add('public-view');
    $('export-card').hidden=true;$('public-view-note').hidden=false;$('wechat-note').hidden=true;
    $('cloud-link-label').textContent='公开浏览链接（仅查看）';
    $('footer-features').textContent='演员广场 · 公开简历仅供浏览';
  }
  try{publicIncoming=parsePublicLink(location.hash);if(!publicIncoming)incoming=parseProfileLink(location.hash);}catch(error){linkError=error;}
  viewOnly=!!linkError||!!publicIncoming||!!(incoming&&(!identity||identity.id!==incoming.id||identity.viewKey!==incoming.key));
  if(viewOnly){
    document.body.classList.add('view-only');$('export-pdf').disabled=true;
    savedStatus('正在读取云端档案…');cloudStatus('正在读取云端档案…');cloudControls();
    try{
      if(linkError)throw linkError;
      const result=publicIncoming?await readPublicProfile(publicIncoming.id):await readProfile(incoming.id,incoming.key);draft=validateDraft(result.draft);
      sharedLink=publicIncoming?publicProfileLink(location.href,publicIncoming.id):profileLink(location.href,incoming.id,incoming.key);cloudDirty=false;published=result.published===true;
      ready=true;renderPreview();$('export-pdf').disabled=publicView;
      savedStatus('已打开云端档案 · 只读');cloudStatus(publicView?'已打开公开简历，仅供浏览。':'云端档案已加载，可以下载 PDF。');
      document.title=draft.stageName+' · 演员档案';
    }catch(error){savedStatus('无法打开云端档案',true);cloudStatus(error.message,true);$('view-retry').hidden=false;}
    cloudControls();return;
  }
  try{
    await openStorage();storageReady=true;const stored=await readDraft();
    if(stored){draft=validateDraft(stored);if(draft.photo){try{draft.photo=await normalizePhoto(draft.photo.dataUrl);await writeDraft(draft);}catch{feedback('旧照片未能压缩，请重新添加照片；文字已恢复。');}}savedStatus('已恢复本机草稿');}
    else savedStatus('本机自动保存已开启');
  }catch{
    // Do not silently overwrite an unreadable existing draft.
    storageReady=false;savedStatus('本机保存不可用，请下载备份',true);
    feedback('无法读取或保存本机草稿。你仍可填写、导出 PDF 和备份；关闭页面前请下载备份。');
  }
  ready=true;renderForm();$('form-fields').disabled=false;
  if(identity?.version){
    published=identity.published===true;
    sharedLink=profileLink(location.href,identity.id,identity.viewKey);
    cloudDirty=(await fingerprint(draft))!==identity.fingerprint;
    cloudStatus(cloudDirty?'本机草稿与上次提交不同，请重新提交以更新链接内容。':'上次提交已保存到云端，可以复制档案链接。');
  }else cloudStatus('点击「提交并预览」，将文字和压缩照片保存到云端。');
  cloudControls();
  if(managementInput)openManagementDialog(managementInput);
}
const previewAnchor=document.createComment('preview-panel');
$('preview-panel').before(previewAnchor);
function requireName(){
  if(draft.stageName.trim())return true;
  if($('preview-dialog').open)$('preview-dialog').close();
  $('name-error').hidden=false;$('stage-name').setAttribute('aria-invalid','true');$('stage-name').focus();return false;
}
async function openPreview(){
  if(!ready||photoBusy||!requireName())return;
  feedback();flush();renderPreview();$('preview-host').append($('preview-panel'));
  if(!$('preview-dialog').open)$('preview-dialog').showModal();
  $('close-preview').focus();
  await submitCloud();
}
async function submitCloud(){
  if(!ready||viewOnly||cloudBusy||photoBusy||!draft.stageName.trim())return;
  cloudBusy=true;cloudControls();cloudStatus('正在保存到云端…');
  const snapshot=structuredClone(draft),startRevision=revision,publicSnapshot=desiredPublic;
  try{
    if(!identity)identity=newIdentity();
    // Persist capabilities before the request so a timeout/reload cannot lose editing access.
    try{storeIdentity(identity);}catch{throw new Error('浏览器无法保存编辑权限，暂不上传。请允许本地存储后重试；仍可下载 PDF。');}
    const result=await saveProfile(identity,snapshot,publicSnapshot);published=result.published===true;
    identity={...identity,version:result.version,fingerprint:await fingerprint(snapshot),published};
    storeIdentity(identity);sharedLink=profileLink(location.href,identity.id,identity.viewKey);
    cloudDirty=startRevision!==revision;
    history.replaceState(null,'',sharedLink);
    cloudStatus(cloudDirty?'提交时的版本已保存；刚才的新修改尚未提交。':'已保存到云端。复制档案链接，可在其他浏览器打开并下载 PDF。');
  }catch(error){cloudStatus(error.message,true);}
  finally{cloudBusy=false;cloudControls();}
}
$('cloud-retry').addEventListener('click',submitCloud);
$('view-retry').addEventListener('click',()=>location.reload());
function openManagementDialog(link=''){
  $('management-input').value=link;$('restore-status').textContent='';
  if(!$('management-dialog').open)$('management-dialog').showModal();
}
$('restore-owner').addEventListener('click',()=>openManagementDialog());
$('close-management').addEventListener('click',()=>$('management-dialog').close());
$('copy-management-link').addEventListener('click',async()=>{
  if(viewOnly||!identity?.version)return;
  const link=managementLink(location.href,identity);
  $('management-link').value=link;$('management-link').hidden=false;
  try{await navigator.clipboard.writeText(link);$('management-status').textContent='管理链接已复制，请保存到自己的私密笔记。持有此链接的人可修改、撤下或删除这份简历，请勿转发。';}
  catch{$('management-link').hidden=false;$('management-link').value=link;$('management-link').focus();$('management-link').select();$('management-link').setSelectionRange(0,link.length);$('management-status').textContent='请长按选中的链接复制，并保存到自己的私密笔记，请勿转发。';}
});
$('management-form').addEventListener('submit',async e=>{
  e.preventDefault();if(viewOnly||cloudBusy||photoBusy)return;
  const button=$('restore-management');button.disabled=true;$('restore-status').textContent='正在验证管理权限并读取最新简历…';
  try{
    const candidate=parseManagementLink($('management-input').value);
    if(!candidate)throw new Error('这是浏览链接，不能用于恢复修改权限。请使用提交后复制的「我的管理链接」。');
    const result=await readProfile(candidate.id,candidate.editKey),restored=validateDraft(result.draft);
    // Confirm that both capabilities belong to this profile before replacing local state.
    await readProfile(candidate.id,candidate.viewKey);
    const occupied=!!(draft.stageName.trim()||draft.bio.trim()||draft.photo||meaningful(draft.experiences).length||meaningful(draft.honors).length);
    if(occupied&&!confirm('当前浏览器已有草稿。恢复会用云端最新版本替换它，建议先备份。是否继续？')){$('restore-status').textContent='已取消，当前草稿未改变。';return;}
    const restoredIdentity={...candidate,version:result.version,fingerprint:await fingerprint(restored),published:result.published===true};
    try{storeIdentity(restoredIdentity);}catch{throw new Error('浏览器无法保存修改权限，请允许本地存储后重试。当前草稿未改变。');}
    identity=restoredIdentity;draft=restored;published=identity.published;desiredPublic=published;
    $('management-link').value='';$('management-link').hidden=true;$('management-status').textContent='';
    viewOnly=false;publicView=false;ready=true;revision++;photoRevision++;
    document.body.classList.remove('view-only','public-view');$('export-card').hidden=false;$('public-view-note').hidden=true;$('export-pdf').disabled=false;
    $('wechat-note').hidden=!isWeChat;$('cloud-link-label').textContent='跨浏览器下载链接（持链接者可下载，请勿公开分享）';
    $('footer-features').textContent='免登录 · 提交后云端保存 · PDF 导出';
    sharedLink=profileLink(location.href,identity.id,identity.viewKey);cloudDirty=false;
    history.replaceState(null,'',sharedLink);renderForm();flush();cloudControls();
    $('form-fields').disabled=false;$('management-input').value='';$('management-dialog').close();
    cloudStatus('已恢复这份简历的修改权限。修改后点击「提交并预览」更新原简历。');
    feedback('已从云端恢复最新简历，你可以继续修改。请保管好专属管理链接。');
  }catch(error){$('restore-status').textContent=error.message||'恢复失败，请检查管理链接后重试。';}
  finally{button.disabled=false;}
});
$('copy-cloud-link').addEventListener('click',async()=>{
  if(!sharedLink||(!viewOnly&&cloudDirty))return;
  try{await navigator.clipboard.writeText(sharedLink);cloudStatus('档案链接已复制。可粘贴到其他浏览器打开，或发给需要查看的人。');}
  catch{$('cloud-link').focus();$('cloud-link').select();$('cloud-link').setSelectionRange(0,sharedLink.length);cloudStatus('请长按已选中的链接，选择「复制」，再粘贴到系统浏览器。');}
});
$('reload-cloud').addEventListener('click',async()=>{
  if(!identity?.version||cloudBusy||!confirm('用最近提交的云端内容替换本机草稿？未提交修改将被覆盖，请先备份。'))return;
  cloudBusy=true;cloudControls();
  try{
    const result=await readProfile(identity.id,identity.editKey);draft=validateDraft(result.draft);published=result.published===true;desiredPublic=published;
    identity={...identity,version:result.version,fingerprint:await fingerprint(draft),published};storeIdentity(identity);
    photoRevision++;renderForm();changed();flush();cloudDirty=false;cloudStatus('已读取最新云端版本。');
  }catch(error){cloudStatus(error.message,true);}
  finally{cloudBusy=false;cloudControls();}
});
$('delete-cloud').addEventListener('click',async()=>{
  if(!identity?.version||cloudBusy||!confirm('删除这份云端档案并让查看链接失效？本机草稿会保留，已下载的 PDF 不会被删除。'))return;
  cloudBusy=true;cloudControls();
  try{
    await deleteProfile(identity);forgetIdentity();identity=null;sharedLink=null;cloudDirty=true;published=false;desiredPublic=false;$('publish-public').checked=false;
    history.replaceState(null,'',location.pathname+location.search);cloudStatus('云端档案已删除，原链接已失效。本机草稿仍保留。');
  }catch(error){cloudStatus(error.message,true);}
  finally{cloudBusy=false;cloudControls();}
});
$('close-preview').addEventListener('click',()=>$('preview-dialog').close());
$('close-browser-guide').addEventListener('click',()=>$('browser-dialog').close());
$('browser-retry').addEventListener('click',submitCloud);
$('copy-browser-link').addEventListener('click',async()=>{
  const {link}=handoffState({sharedLink,cloudDirty,cloudBusy,viewOnly});if(!link)return;
  try{await navigator.clipboard.writeText(link);$('browser-copy-status').textContent='链接已复制。请手动打开 Safari / 系统浏览器，粘贴后访问。';}
  catch{$('browser-link').focus();$('browser-link').select();$('browser-link').setSelectionRange(0,link.length);$('browser-copy-status').textContent='请长按已选中的链接并选择「复制」，再粘贴到系统浏览器。';}
});
$('preview-dialog').addEventListener('close',()=>{previewAnchor.after($('preview-panel'));$('submit-preview').focus();});
$('share-pdf').addEventListener('click',async()=>{
  if(publicView||!pdfFile)return;
  try{await navigator.share({files:[pdfFile],title:'演员档案'});}
  catch(error){if(error.name!=='AbortError')feedback('当前浏览器未能保存文件。请复制档案链接到系统浏览器，重新点击「下载 PDF」。');}
});
$('wechat-note').hidden=!isWeChat;
init();
