import {cleanText, meaningful} from './model.mjs';
import {compactTrueType} from './compact-font.mjs';
let cachedFont;
async function getFont(){
  if(!cachedFont) cachedFont=fetch(new URL('./fonts/NotoSansSC-Regular.ttf',import.meta.url)).then(r=>{if(!r.ok)throw new Error('中文字体未能加载，请检查网络后重试。');return r.arrayBuffer()}).catch(e=>{cachedFont=null;throw e});
  return cachedFont;
}
export async function createProfilePdf(draft, options={}){
  const lib=options.PDFLib||globalThis.PDFLib;
  const kit=options.fontkit||globalThis.fontkit;
  if(!lib||!kit)throw new Error('PDF 组件尚未加载，请刷新网页后重试。');
  if(!draft.stageName.trim())throw new Error('请先填写艺名，再导出 PDF。');
  const fontBytes=options.fontBytes||await getFont();
  const parsed=kit.create(new Uint8Array(fontBytes));
  const experiences=meaningful(draft.experiences),honors=meaningful(draft.honors);
  const allText=[draft.stageName,draft.bio,...[...experiences,...honors].flatMap(Object.values)].map(cleanText).join('\n');
  const missing=[...new Set([...allText].filter(c=>c!=='\n'&&!parsed.hasGlyphForCodePoint(c.codePointAt(0))))];
  if(missing.length)throw new Error(`PDF 字体暂不支持这些字符：${missing.slice(0,12).join(' ')}。请修改后重试；原始草稿仍保留。`);
  const pdf=await lib.PDFDocument.create();pdf.registerFontkit(kit);
  const textWithLabels=allText+'ACTOR PROFILE演员档案个人简述演出经历比赛荣誉0123456789 /·';
  const glyphIds=[...new Set([...textWithLabels].filter(c=>c!=='\n').map(c=>parsed.glyphForCodePoint(c.codePointAt(0)).id))];
  const font=await pdf.embedFont(compactTrueType(fontBytes,glyphIds),{subset:false});
  pdf.setTitle(`${draft.stageName.trim()} · 演员档案`);pdf.setAuthor(draft.stageName.trim());pdf.setCreator('幕前 · 演员档案');pdf.setLanguage('zh-CN');
  const {rgb}=lib, W=595.28,H=841.89,M=48,BOTTOM=52, width=W-2*M;
  const ink=rgb(.14,.17,.15), muted=rgb(.44,.48,.42), accent=rgb(.52,.29,.20);
  let page,y;const pages=[];
  const newPage=()=>{page=pdf.addPage([W,H]);pages.push(page);y=H-M;};
  const ensure=(h)=>{if(y-h<BOTTOM)newPage();};
  const text=(s,x,baseline,size,color=ink)=>page.drawText(s,{x,y:baseline,size,font,color});
  function wrap(value,size,maxWidth){
    const result=[];
    for(const paragraph of cleanText(value).split('\n')){
      if(!paragraph){result.push('');continue}
      let line='';
      for(const ch of paragraph){
        if(line&&font.widthOfTextAtSize(line+ch,size)>maxWidth){
          result.push(line);line=ch;
        }else line+=ch;
      }
      result.push(line);
    }
    return result;
  }
  function lines(rows,size,leading,color=ink,x=M){
    for(const line of rows){ensure(leading);if(line)text(line,x,y-size,size,color);y-=leading;}
  }
  function para(value,size=10.5,leading=19,color=ink,maxWidth=width){
    lines(wrap(value,size,maxWidth),size,leading,color);
  }
  function section(title){
    ensure(130);y-=5;text(title,M,y-12,12,accent);
    page.drawLine({start:{x:M+85,y:y-7},end:{x:W-M,y:y-7},thickness:.6,color:rgb(.84,.86,.82)});
    y-=30;
  }
  newPage();
  text('ACTOR PROFILE',M,y-8,8,muted);y-=30;
  const top=y;
  let photoBottom=top;
  if(draft.photo){
    let image;
    try{
      image=draft.photo.dataUrl.startsWith('data:image/png')?await pdf.embedPng(draft.photo.dataUrl):await pdf.embedJpg(draft.photo.dataUrl);
    }catch{throw new Error('照片无法写入 PDF，请重新添加照片后重试。');}
    const dim=image.scaleToFit(105,140);const photoTop=H-M;
    page.drawImage(image,{x:W-M-dim.width,y:photoTop-dim.height,width:dim.width,height:dim.height});
    photoBottom=photoTop-dim.height;
  }
  para(draft.stageName.trim(),28,39,ink,draft.photo?width-130:width);
  y-=5;ensure(23);text('演员档案',M,y-10,10,muted);y-=24;
  // Only reserve portrait height on the first page.
  if(pages.length===1&&draft.photo)y=Math.min(y,photoBottom-14);
  ensure(20);page.drawLine({start:{x:M,y},end:{x:W-M,y},thickness:1.2,color:ink});y-=24;
  if(draft.bio.trim()){section('个人简述');para(draft.bio.trim());y-=14;}
  if(experiences.length){
    section('演出经历');
    for(const row of experiences){
      const heading=[row.time.trim(),row.name.trim()].filter(Boolean).join('  ·  ');
      const headLines=heading?wrap(heading,11,width):[];
      ensure(Math.min(headLines.length*20,60)+(row.description.trim()?19:0)+8);
      if(heading)lines(headLines,11,20);
      if(row.description.trim()){y-=3;para(row.description.trim(),10.5,19,muted)}
      y-=15;
    }
  }
  if(honors.length){
    section('比赛荣誉');
    for(const row of honors){
      const heading=[row.time.trim(),row.name.trim()].filter(Boolean).join('  ·  ');
      const headLines=heading?wrap(heading,11,width):[];
      ensure(Math.min(headLines.length*20,60)+(row.award.trim()?19:0)+8);
      if(heading)lines(headLines,11,20);
      if(row.award.trim()){y-=3;para(row.award.trim(),10.5,19,muted)}
      y-=15;
    }
  }
  pages.forEach((p,i)=>{
    const number=`${i+1} / ${pages.length}`;
    p.drawText(number,{x:W-M-font.widthOfTextAtSize(number,8),y:27,font,size:8,color:muted});
  });
  return pdf.save();
}
