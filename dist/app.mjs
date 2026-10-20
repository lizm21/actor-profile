import {emptyDraft,meaningful,validateDraft,parseBackup,serializeBackup,filename,cleanText} from './model.mjs';
import {openStorage,readDraft,writeDraft} from './storage.mjs';
import {createProfilePdf} from './pdf.mjs';

const $=id=>document.getElementById(id);
let draft=emptyDraft(),ready=false,storageReady=false,timer,revision=0,saveChain=Promise.resolve(),pdfUrl=null,photoRevision=0;
function feedback(message=''){ $('feedback').textContent=message;$('feedback').hidden=!message; }
function savedStatus(message,error=false){$('save-status').textContent=message;$('save-status').classList.toggle('error',error);}
function changed(){
  revision++; clearTimeout(timer);
  $('pdf-result').hidden=true;renderPreview();
  if(storageReady){savedStatus('正在保存…');timer=setTimeout(flush,350);}
  else savedStatus('本机保存不可用，请下载备份',true);
}
function flush(){
  clearTimeout(timer);if(!storageReady||!ready)return;
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
  $('stage-name').value=draft.stageName;$('bio').value=draft.bio;
  $('photo-thumb').hidden=!draft.photo;$('photo-empty').hidden=!!draft.photo;$('remove-photo').hidden=!draft.photo;
  if(draft.photo)$('photo-thumb').src=draft.photo.dataUrl;else $('photo-thumb').removeAttribute('src');
  renderRows('experiences');renderRows('honors');renderPreview();
}
function setTab(view){
  document.querySelector('.workspace').dataset.view=view;
  document.querySelectorAll('[data-tab]').forEach(b=>{const selected=b.dataset.tab===view;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});
}
async function normalizePhoto(source){
  const image=new Image();image.decoding='async';image.src=source;
  try{await image.decode();}catch{throw new Error('无法读取这张照片，请选择有效的 JPG、PNG 或 WebP 图片。');}
  if(!image.naturalWidth||!image.naturalHeight)throw new Error('照片没有有效尺寸。');
  const scale=Math.min(1,1800/Math.max(image.naturalWidth,image.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  return {dataUrl:canvas.toDataURL('image/jpeg',.9)};
}
function downloadBlob(blob,name,keep=false){
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  if(!keep)setTimeout(()=>URL.revokeObjectURL(url),60000);return url;
}
$('stage-name').addEventListener('input',e=>{
  draft.stageName=cleanText(e.target.value);$('stage-name').removeAttribute('aria-invalid');$('name-error').hidden=true;changed();
});
$('bio').addEventListener('input',e=>{draft.bio=cleanText(e.target.value);changed();});
$('profile-form').addEventListener('submit',e=>e.preventDefault());
for(const [button,key] of [['add-experience','experiences'],['add-honor','honors']]){
  $(button).addEventListener('click',()=>{
    draft[key].push(key==='experiences'?{name:'',time:'',description:''}:{name:'',award:'',time:''});renderRows(key);changed();
    document.getElementById(`${key}-${draft[key].length-1}-name`).focus();
  });
}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab)));
$('choose-photo').addEventListener('click',()=>$('photo-input').click());
$('photo-input').addEventListener('change',async e=>{
  const file=e.target.files[0];e.target.value='';if(!file)return;
  const ownRevision=++photoRevision;feedback();
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){feedback('请选择 JPG、PNG 或 WebP 格式的照片。');return;}
  if(file.size>10*1024*1024){feedback('照片超过 10 MB，请选择较小的图片。');return;}
  $('choose-photo').disabled=true;const url=URL.createObjectURL(file);
  try{const photo=await normalizePhoto(url);if(ownRevision!==photoRevision)return;draft.photo=photo;renderForm();changed();}
  catch(error){feedback(error.message);}
  finally{URL.revokeObjectURL(url);$('choose-photo').disabled=false;}
});
$('remove-photo').addEventListener('click',()=>{photoRevision++;draft.photo=null;renderForm();changed();});
$('backup').addEventListener('click',()=>{
  if(!ready)return;downloadBlob(new Blob([serializeBackup(draft)],{type:'application/json;charset=utf-8'}),filename(draft.stageName,'草稿备份','json'));feedback('草稿备份已生成。请妥善保存，文件包含你填写的文字和照片。');
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
      if(incoming.photo.dataUrl.startsWith('data:image/webp'))incoming.photo=await normalizePhoto(incoming.photo.dataUrl);
    }
    if(!confirm(startRevision!==revision?'读取备份期间你修改了档案。仍要用备份覆盖当前内容吗？':'导入会覆盖当前浏览器中的这份档案。建议先备份，是否继续？'))return;
    photoRevision++;draft=incoming;renderForm();changed();flush();feedback('草稿已导入。请检查内容后继续编辑。');
  }catch(error){feedback(error.message);}
});
$('clear').addEventListener('click',()=>{
  if(!ready||!confirm('清空当前档案及本机草稿？此操作无法撤销，请先下载备份。'))return;
  photoRevision++;draft=emptyDraft();renderForm();changed();flush();feedback();$('name-error').hidden=true;$('stage-name').removeAttribute('aria-invalid');setTab('editor');$('stage-name').focus();
});
$('export-pdf').addEventListener('click',async()=>{
  if(!ready)return;feedback();$('pdf-result').hidden=true;
  if(!draft.stageName.trim()){
    setTab('editor');$('name-error').hidden=false;$('stage-name').setAttribute('aria-invalid','true');$('stage-name').focus();return;
  }
  const button=$('export-pdf'),label=button.querySelector('span');button.disabled=true;button.setAttribute('aria-busy','true');label.textContent='正在生成…';
  const snapshot=structuredClone(draft),startRevision=revision;
  try{
    const bytes=await createProfilePdf(snapshot);const blob=new Blob([bytes],{type:'application/pdf'});
    if(pdfUrl)URL.revokeObjectURL(pdfUrl);pdfUrl=downloadBlob(blob,filename(snapshot.stageName,'演员档案','pdf'),true);
    $('open-pdf').href=pdfUrl;$('pdf-result').hidden=false;
    if(startRevision!==revision)feedback('已导出点击下载时的档案。生成期间的修改已保留，请再次下载以导出最新内容。');
  }catch(error){feedback(error.message||'PDF 生成失败，请重试。草稿仍然保留。');}
  finally{button.disabled=false;button.removeAttribute('aria-busy');label.textContent='下载 PDF';}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});
window.addEventListener('pagehide',flush);
async function init(){
  try{
    await openStorage();storageReady=true;const stored=await readDraft();
    if(stored){draft=validateDraft(stored);savedStatus('已恢复本机草稿');}
    else savedStatus('本机自动保存已开启');
  }catch{
    // Do not silently overwrite an unreadable existing draft.
    storageReady=false;savedStatus('本机保存不可用，请下载备份',true);
    feedback('无法读取或保存本机草稿。你仍可填写、导出 PDF 和备份；关闭页面前请下载备份。');
  }
  ready=true;renderForm();$('form-fields').disabled=false;
}
init();
