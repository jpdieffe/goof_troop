// Custom weapons use the valid bell item as a native inventory/ground-item carrier.
// Its identity is kept separately; no out-of-range item IDs reach SNES jump tables.
export const WEAPON_CARRIER=0x0c;
export const ITEM_USE_BUTTON=1; // SNES Y / keyboard S. Q remains a fire shortcut.
const slots=[0x1040,0x1060,0x1080,0x10a0];
const word=(r,a)=>r[a]|r[a+1]<<8;
export class WeaponInventory{
  constructor(){this.reset();}
  reset(){this.held=[null,null];this.room=-1;this.ground=[{room:0,x:64,y:144,type:'gatling'},{room:0,x:96,y:144,type:'gatling'},{room:0,x:64,y:88,type:'rocket'},{room:0,x:96,y:88,type:'rocket'}];this.bound=new Map();this.handled=new Set();this.serial=0;this.lastPickup=null;}
  restoreFlag(r,item){if(item?.flagOriginal!==undefined){const id=item.flagId,a=0x1160+(id>>1),shift=(id&1)*4;r[a]=(r[a]&~(15<<shift))|(item.flagOriginal<<shift);}}
  update(r,room){
    if(this.room!==room){this.bound.clear();this.handled.clear();this.room=room;}
    // Native pickup leaves state 6 (empty old slot), or state 2 with $04 holding
    // the exchanged inventory ID. Consume that event once, including bell->bell.
    for(const b of slots){
      if(!r[b]||!(r[b+2]===6||(r[b+2]===2&&r[b+4]))){this.handled.delete(b);continue;}
      if(this.handled.has(b))continue;this.handled.add(b);
      const player=r[b+5]===0x80?1:0,old=this.held[player],incoming=this.bound.get(b);
      this.held[player]=incoming?.type||null;
      if(incoming){this.restoreFlag(r,incoming);this.ground.splice(this.ground.indexOf(incoming),1);this.bound.delete(b);}
      if(r[b+4]&&(old||incoming)){const drop={room,x:word(r,b+0x11),y:word(r,b+0x14),type:old,itemId:r[b+4],flagId:incoming?.flagId,flagOriginal:incoming?.flagOriginal};this.ground.push(drop);this.bound.set(b,drop);}
      r[b+4]=0;
      this.lastPickup={player,type:this.held[player]};this.serial++;
    }
    for(let i=0;i<2;i++)if(this.held[i]&&r[0x142+i*0x80]!==WEAPON_CARRIER)this.held[i]=null;
    for(const [b,item]of this.bound){
      if(!r[b]||r[b+0xb]!==(item.itemId||WEAPON_CARRIER)-2){this.bound.delete(b);continue;}
      item.x=word(r,b+0x11);item.y=word(r,b+0x14);if(item.type)r[b+1]=0; // Replace native bell art.
      this.restoreFlag(r,item);
    }
    for(const item of this.ground.filter(g=>g.room===room)){
      if([...this.bound.values()].includes(item))continue;
      const existing=slots.find(b=>r[b]&&r[b+0xb]===(item.itemId||WEAPON_CARRIER)-2&&word(r,b+0x11)===item.x&&word(r,b+0x14)===item.y&&!this.bound.has(b));
      if(existing!==undefined){this.bound.set(existing,item);continue;}
      const b=slots.find(b=>!r[b]);if(b===undefined)break;
      r.fill(0,b,b+0x20);r[b]=2;r[b+0xb]=(item.itemId||WEAPON_CARRIER)-2;r[b+0x11]=item.x;r[b+0x14]=item.y;
      // Borrow a flag nibble only while this synthetic object is in the room;
      // restore its original contents after native pickup/update processing.
      r[b+0xd]=28+slots.indexOf(b);item.flagId=r[b+0xd];item.flagOriginal=(r[0x1160+(item.flagId>>1)]>>((item.flagId&1)*4))&15;this.bound.set(b,item);
    }
  }
}
