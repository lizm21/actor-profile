import {listPublicProfiles,publicProfileLink} from './cloud.mjs?v=20261021-2';
const $=id=>document.getElementById(id);
const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text!==undefined)n.textContent=text;return n;};
let query='',offset=0,pageSize=12,total=0,request=0,busy=false;
function card(profile){
  const a=el('a','actor-card');a.href=publicProfileLink(location.href,profile.id);
  const portrait=el('div','actor-portrait');
  if(profile.photo?.dataUrl){const img=el('img');img.src=profile.photo.dataUrl;img.alt=profile.stageName+'的照片';img.loading='lazy';portrait.append(img);}
  else{portrait.classList.add('no-photo');portrait.append(el('span','',Array.from(profile.stageName.trim())[0]||'幕'));}
  const body=el('div','actor-card-body');body.append(el('p','actor-card-kicker','ACTOR PROFILE'),el('h2','',profile.stageName),el('p','actor-card-bio',profile.bio||'舞台故事，等你了解。'));
  const foot=el('div','actor-card-foot');foot.append(el('span','',`${profile.experienceCount} 条经历 · ${profile.honorCount} 项荣誉`),el('span','actor-card-open','查看简历 ↗'));body.append(foot);a.append(portrait,body);return a;
}
async function load(){
  const own=++request;busy=true;
  $('directory-grid').replaceChildren();$('directory-grid').setAttribute('aria-busy','true');
  $('directory-empty').hidden=true;$('retry-directory').hidden=true;$('directory-pagination').hidden=true;
  $('clear-search').hidden=!query;$('directory-status').textContent='正在加载公开简历…';
  try{
    const result=await listPublicProfiles(query,offset);if(own!==request)return;
    total=result.total;pageSize=result.pageSize;
    // A profile may have been withdrawn while a visitor was on the last page.
    if(offset&&offset>=total){offset=total?Math.floor((total-1)/pageSize)*pageSize:0;return load();}
    $('directory-grid').replaceChildren(...result.profiles.map(card));
    $('directory-status').textContent=query?`“${query}” · 找到 ${total} 份公开简历`:`共 ${total} 份公开简历`;
    $('directory-empty').hidden=!!total;
    $('empty-title').textContent=query?'还没有找到这个艺名':'等待第一位演员登场';
    $('empty-copy').textContent=query?'试试更短的名字，或点击「查看全部」。':'提交简历时勾选「公开展示在演员广场」，就能在这里被看见。';
    $('directory-pagination').hidden=total<=pageSize;
    $('previous-page').disabled=offset===0;$('next-page').disabled=offset+pageSize>=total;
    $('page-number').textContent=`${Math.floor(offset/pageSize)+1} / ${Math.ceil(total/pageSize)}`;
  }catch(error){if(own!==request)return;$('directory-status').textContent='加载失败：'+error.message;$('retry-directory').hidden=false;}
  finally{if(own===request){busy=false;$('directory-grid').setAttribute('aria-busy','false');}}
}
$('directory-search').addEventListener('submit',e=>{e.preventDefault();query=$('search-name').value.trim();offset=0;load();});
$('clear-search').addEventListener('click',()=>{$('search-name').value='';query='';offset=0;load();});
$('retry-directory').addEventListener('click',load);
$('previous-page').addEventListener('click',()=>{if(busy||!offset)return;offset=Math.max(0,offset-pageSize);load();});
$('next-page').addEventListener('click',()=>{if(busy||offset+pageSize>=total)return;offset+=pageSize;load();});
load();
