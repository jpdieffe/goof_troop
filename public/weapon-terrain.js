const word=(r,a)=>r[a]|r[a+1]<<8;
const put=(r,a,v)=>{r[a]=v&255;r[a+1]=v>>8;};

// Decode map metatiles from the player's verified ROM; no game tiles are shipped.
export function roomTiles(rom,level,room,layer){
  const map=rom[0x18ce7+rom[0x18ce7+level]+room*2+layer],out=new Uint16Array(1024);
  for(let y=0;y<32;y++)for(let x=0;x<32;x++){
    const i=(y>>2)*8+(x>>2),tile32=rom[0x48000+map*64+i]+(((rom[0x4b700+map*32+(i>>1)]>>((i&1)*4))&15)<<8);
    const q=((y>>1)&1)*2+((x>>1)&1),tile16=rom[0x50000+tile32*4+q]+(((rom[0x54000+tile32*2+(q>>1)]>>((q&1)*4))&15)<<8);
    out[y*32+x]=word(rom,0x58000+tile16*8+((y&1)*2+(x&1))*2);
  }
  return out;
}

export class WeaponTerrain{
  constructor(rom){this.rom=rom;this.reset();}
  reset(){this.room=-1;this.destroyed=new Map();this.pending=[];this.count=0;}
  enter(r,room){
    if(room===this.room)return;
    this.room=room;this.pending=[];
    this.layers=[roomTiles(this.rom,room>>8,room&255,0),roomTiles(this.rom,room>>8,room&255,1)];
    this.collision=r.slice(0x1400,0x1800);
    // Choose clean walkable ground in this room, avoiding foreground decoration.
    const candidates=new Map();
    for(let y=4;y<24;y+=2)for(let x=2;x<30;x+=2){
      const i=y*32+x,indices=[i,i+1,i+32,i+33];
      if(indices.every(j=>this.collision[j]===0&&(this.layers[0][j]&1023)===0)){
        const tiles=indices.map(j=>this.layers[1][j]),key=tiles.join(',');
        const candidate=candidates.get(key)||{tiles,count:0};candidate.count++;candidates.set(key,candidate);
      }
    }
    // Frequent aligned metatiles are interior ground; the first walkable patch
    // may straddle a grass/sand edge and would create a checkerboard when tiled.
    this.floor=[...candidates.values()].sort((a,b)=>b.count-a.count)[0]?.tiles||null;
    for(const tile of this.destroyed.get(room)||[])this.clear(r,tile,false);
  }
  clear(r,i,remember=true){
    if(!this.floor)return;
    r[0x1400+i]=0;r[0x1f800+i]=0;
    this.pending.push(i);
    if(remember){if(!this.destroyed.has(this.room))this.destroyed.set(this.room,new Set());this.destroyed.get(this.room).add(i);}
  }
  arena(r,level){
    // Rebuild the island scenery for each new survival arena, then open lanes.
    // The original map/graphics remain local ROM data; uploads use the same DMA queue.
    this.pending=[];this.destroyed.set(this.room,new Set());r.set(this.collision,0x1400);r.set(this.collision,0x1f800);
    for(let i=0;i<1024;i++)this.pending.push({i,values:[this.layers[0][i],this.layers[1][i]]});
    this.pickups=[];
    this.carve(r,16,72,247,164);
    // Different upper cover lanes in successive arenas.
    if(level%3===1)this.carve(r,100,32,188,100);
    if(level%3===2)this.carve(r,24,32,112,100);
    if(level%3===0)this.carve(r,168,32,247,100);
  }
  blast(r,x,y){
    return this.carve(r,x-28,y-56,x+28,y+20);
  }
  beam(r,x,y,dx,dy){
    const endX=dx>0?247:dx<0?8:x,endY=dy>0?215:dy<0?18:y;
    // A broad continuous cut, including the canopy above a solid tree's feet.
    return this.carve(r,Math.min(x,endX)-12,Math.min(y,endY)-44,Math.max(x,endX)+12,Math.max(y,endY)+12);
  }
  carve(r,left,top,right,bottom){
    if(!this.floor)return 0;
    let changed=0;
    // Tall scenery includes a canopy above its solid footprint. Clear the blast
    // area above impact as well, while preserving the outer map boundary/water.
    for(let ty=Math.max(2,top>>3);ty<=Math.min(26,bottom>>3);ty++)for(let tx=Math.max(1,left>>3);tx<=Math.min(30,right>>3);tx++){
      const i=ty*32+tx,kind=r[0x1400+i]&0xf0;
      if(![0,0x80,0xc0,0xe0].includes(kind))continue;
      // Leave ordinary ground alone. Remove decorative canopy tiles too.
      if(kind===0&&(this.layers[0][i]&1023)===0)continue;
      if(this.destroyed.get(this.room)?.has(i))continue;
      // Do not erase native pickups, pots or puzzle objects sharing solid tiles.
      if([0x1040,0x1060,0x1080,0x10a0].some(b=>r[b]&&Math.abs(word(r,b+0x11)-(tx*8+4))<13&&Math.abs(word(r,b+0x14)-(ty*8+4))<13))continue;
      if(this.pickups?.some(p=>Math.abs(p.x-(tx*8+4))<13&&Math.abs(p.y-(ty*8+4))<13))continue;
      this.clear(r,i);changed++;
    }
    this.count+=changed;return changed;
  }
  flush(r){
    // Append small VRAM uploads to the game's bounded DMA queue. Source bytes live
    // in otherwise unused $7F:FC00..FDFF until the next vertical blank consumes them.
    let q=r[0x40];if(q!==0||!this.pending.length)return;
    let src=0x1fc00;
    while(this.pending.length&&q<=0xe0){
      const entry=this.pending.shift(),i=typeof entry==='number'?entry:entry.i,x=i%32,y=i>>5;
      for(let layer=0;layer<2;layer++){
        const value=entry.values?entry.values[layer]:layer?this.floor[(y&1)*2+(x&1)]:0;put(r,src,value);
        const a=0x1800+q;r[a]=1;put(r,a+1,(layer?0x5800:0x5000)+i);put(r,a+3,2);put(r,a+5,src&65535);r[a+7]=0x7f;q+=8;src+=2;
      }
    }
    r[0x40]=q;
  }
}
