export async function normalizePhoto(source){
  const image=new Image();image.decoding='async';image.src=source;
  try{await image.decode();}catch{throw new Error('无法读取这张照片，请选择有效的 JPG、PNG 或 WebP 图片。');}
  if(!image.naturalWidth||!image.naturalHeight)throw new Error('照片没有有效尺寸。');
  if(source.startsWith('data:image/jpeg;base64,')&&source.length*3/4<=180*1024&&Math.max(image.naturalWidth,image.naturalHeight)<=1000)return {dataUrl:source};
  const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');
  let edge=1000,quality=.78,dataUrl;
  do{
    const scale=Math.min(1,edge/Math.max(image.naturalWidth,image.naturalHeight));
    canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    dataUrl=canvas.toDataURL('image/jpeg',quality);
    if(dataUrl.length*3/4<=180*1024)break;
    if(quality>.54)quality-=.08;else edge=Math.floor(edge*.8);
  }while(edge>=320);
  return {dataUrl};
}
export function photoBytes(photo){return photo?Math.floor((photo.dataUrl.length-photo.dataUrl.indexOf(',')-1)*3/4):0;}
