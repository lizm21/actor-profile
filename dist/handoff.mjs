// Do not offer a stale URL when the displayed profile has unsaved changes.
export function handoffState({sharedLink,cloudDirty,cloudBusy,viewOnly}){
  const link=sharedLink&&!cloudBusy&&(viewOnly||!cloudDirty)?sharedLink:null;
  return {link,message:link?'档案已准备好，无需重新填写。':cloudBusy?'正在保存最新档案，链接准备好后会显示在这里…':'最新档案尚未保存到云端，请重试保存后再切换浏览器。'};
}
