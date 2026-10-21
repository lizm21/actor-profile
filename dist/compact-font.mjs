// Keep original glyph IDs and metrics, but omit unused outlines. This avoids
// fontkit's subset encoder while preserving selectable Chinese text in PDFs.
export function compactTrueType(input, glyphIds) {
  const bytes=new Uint8Array(input), view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const tables=new Map();
  for(let i=0;i<view.getUint16(4);i++){
    const at=12+i*16, tag=String.fromCharCode(...bytes.subarray(at,at+4));
    tables.set(tag,{offset:view.getUint32(at+8),length:view.getUint32(at+12)});
  }
  const read=tag=>{const t=tables.get(tag);if(!t)throw new Error('中文字体格式不正确。');return bytes.slice(t.offset,t.offset+t.length);};
  const head=read('head'),headView=new DataView(head.buffer),maxp=read('maxp');
  const count=new DataView(maxp.buffer).getUint16(4),longLoca=headView.getInt16(50)===1;
  const loca=read('loca'),locaView=new DataView(loca.buffer),glyf=read('glyf');
  const offset=id=>longLoca?locaView.getUint32(id*4):locaView.getUint16(id*2)*2;
  const used=new Set([0,...glyphIds]);
  function include(id){
    if(id<0||id>=count)throw new Error('中文字体字形不正确。');
    const start=offset(id),end=offset(id+1);if(start===end)return;
    const glyph=new DataView(glyf.buffer,start,end-start);
    if(glyph.getInt16(0)>=0)return;
    let pos=10,flags;
    do{
      flags=glyph.getUint16(pos);const child=glyph.getUint16(pos+2);
      if(!used.has(child)){used.add(child);include(child);}
      pos+=4+(flags&1?4:2)+(flags&8?2:flags&64?4:flags&128?8:0);
    }while(flags&32);
  }
  for(const id of [...used])include(id);
  const locations=new Uint8Array((count+1)*4),locView=new DataView(locations.buffer),parts=[];
  let size=0;
  for(let id=0;id<count;id++){
    locView.setUint32(id*4,size);
    if(used.has(id)){
      const data=glyf.slice(offset(id),offset(id+1));parts.push({at:size,data});size+=(data.length+3)&~3;
    }
  }
  locView.setUint32(count*4,size);
  const outlines=new Uint8Array(size);for(const {at,data} of parts)outlines.set(data,at);
  headView.setInt16(50,1);headView.setUint32(8,0);
  const replacement=new Map([['head',head],['loca',locations],['glyf',outlines]]);
  // No substitutions: each Unicode character uses its retained original glyph.
  const dropped=new Set(['GSUB','GPOS','GDEF','DSIG','kern']);
  const entries=[...tables.keys()].filter(t=>!dropped.has(t)).sort().map(tag=>({tag,data:replacement.get(tag)||read(tag)}));
  let total=12+entries.length*16;for(const e of entries){e.offset=total;total+=(e.data.length+3)&~3;}
  const result=new Uint8Array(total),out=new DataView(result.buffer);out.setUint32(0,0x00010000);out.setUint16(4,entries.length);
  const power=2**Math.floor(Math.log2(entries.length));out.setUint16(6,power*16);out.setUint16(8,Math.log2(power));out.setUint16(10,entries.length*16-power*16);
  function checksum(data){let sum=0;for(let i=0;i<data.length;i+=4){sum=(sum+(((data[i]||0)*0x1000000)+((data[i+1]||0)<<16)+((data[i+2]||0)<<8)+(data[i+3]||0)))>>>0;}return sum;}
  entries.forEach((e,i)=>{const at=12+i*16;result.set([...e.tag].map(c=>c.charCodeAt(0)),at);out.setUint32(at+4,checksum(e.data));out.setUint32(at+8,e.offset);out.setUint32(at+12,e.data.length);result.set(e.data,e.offset);});
  out.setUint32(entries.find(e=>e.tag==='head').offset+8,(0xB1B0AFBA-checksum(result))>>>0);
  return result;
}
