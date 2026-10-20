let database;
export async function openStorage(){
  if(!globalThis.indexedDB)throw new Error('当前浏览器不支持草稿保存。');
  database=await new Promise((resolve,reject)=>{
    const request=indexedDB.open('muqian-actor-profile',1);
    const timer=setTimeout(()=>reject(new Error('本机草稿读取超时。')),4000);
    request.onupgradeneeded=()=>request.result.createObjectStore('drafts');
    request.onsuccess=()=>{clearTimeout(timer);resolve(request.result)};
    request.onerror=()=>{clearTimeout(timer);reject(request.error)};
    request.onblocked=()=>{clearTimeout(timer);reject(new Error('草稿存储被其他页面占用。'))};
  });
  database.onversionchange=()=>database.close();
}
export async function readDraft(){
  return new Promise((resolve,reject)=>{
    const tx=database.transaction('drafts','readonly');const r=tx.objectStore('drafts').get('current');
    r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);
  });
}
export async function writeDraft(draft){
  return new Promise((resolve,reject)=>{
    try{
      const tx=database.transaction('drafts','readwrite');tx.objectStore('drafts').put(draft,'current');
      tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('保存中断'));
    }catch(e){reject(e)}
  });
}
