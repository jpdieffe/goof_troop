// USA ROM RAM layout. See MODDING.md for the original routines behind these fields.
export const FIRE_BUTTON=10; // SNES L: Q on a keyboard, left shoulder on a gamepad.
export const DIRECTIONS=[[0,-1],[1,0],[0,1],[-1,0]];
export const word=(ram,address)=>ram[address]|ram[address+1]<<8;
const putWord=(ram,address,value)=>{ram[address]=value&255;ram[address+1]=(value>>8)&255;};

export function defeatPirate(ram,slot,direction){
  if(slot<0x200||slot>=0x980||(slot-0x200)%0x50||!ram[slot]||ram[slot+0xa]!==0xc||!ram[slot+0x1c])return false;
  // The native hurt handler observes HP != previous HP, selects its own death
  // animation, launches at 4 pixels/frame, plays the sound and releases the slot.
  ram[slot+0x1d]=ram[slot+0x1c];
  ram[slot+0x1c]=0;
  ram[slot+0xd]=direction;
  ram[slot+0x30]=0;ram[slot+0x2f]=0; // Cancel a previous pot/hook stun.
  ram[slot+2]=4;ram[slot+3]=0;
  return true;
}

export class GatlingModel{
  constructor(){this.reset();}
  reset(){this.equipped=[false,false];this.cooldown=[0,0];this.flash=[0,0];this.pickups=[{x:64,y:147},{x:96,y:147}];this.bullets=[];this.sparks=[];this.room=-1;this.active=false;this.ticks=0;this.shots=[0,0];this.hits=[0,0];this.targetsSpawned=false;this.notice='Walk over a beach gun. Hold Q / L to fire.';this.noticeTime=360;}
  player(ram,i){const b=0x100+i*0x80;return {x:word(ram,b+0x11),y:word(ram,b+0x14),z:ram[b+0x17],direction:(ram[b+0x47]>>1)&3,visible:!!ram[b]&&!!ram[b+1],canAct:ram[b]===1&&ram[b+2]===2&&ram[b+3]===0};}
  spawnTargets(ram){
    // Two ordinary Jolly pirates for the opening beach playground. Native init
    // allocates graphics from the game's pool; do not fabricate a graphics slot.
    if(ram[0x119b]<2)return;
    const slots=[];for(let b=0x840;b<0x980;b+=0x50)if(!ram[b])slots.push(b);
    if(slots.length<2)return;
    for(let i=0;i<2;i++){const b=slots[i],index=ram[b+0x25];ram.fill(0,b,b+0x50);ram[b]=1;ram[b+1]=1;ram[b+9]=4;ram[b+0xa]=0xc;ram[b+0xd]=3;ram[b+0x25]=index;putWord(ram,b+0x11,168+i*32);putWord(ram,b+0x14,136);}
    this.targetsSpawned=true;
  }
  tick(ram,masks){
    if(ram[0xa0]!==8){if(this.active||this.equipped.some(Boolean))this.reset();return;}
    const room=ram[0xb6]*256+ram[0xb7];
    if(room!==this.room){this.bullets=[];this.sparks=[];this.room=room;}
    this.active=ram[0xa2]===4;
    if(!this.active||ram[0xab]||ram[0xac])return;
    this.ticks++;if(this.noticeTime>0)this.noticeTime--;
    const beach=room===0;
    for(let i=0;i<2;i++){
      const p=this.player(ram,i);this.flash[i]=Math.max(0,this.flash[i]-1);this.cooldown[i]=Math.max(0,this.cooldown[i]-1);
      if(!p.canAct)continue;
      if(beach&&!this.equipped[i]){const found=this.pickups.findIndex(g=>Math.hypot(g.x-p.x,g.y-p.y)<11);if(found>=0){this.pickups.splice(found,1);this.equipped[i]=true;this.notice=`P${i+1}: GATLING! Hold Q / L to fire.`;this.noticeTime=240;}}
      if(this.equipped[i]&&(masks[i]&(1<<FIRE_BUTTON))&&!this.cooldown[i]){
        const [dx,dy]=DIRECTIONS[p.direction];
        this.bullets.push({x:p.x+dx*16,y:p.y+dy*16,direction:p.direction,owner:i,age:0});
        this.cooldown[i]=4;this.flash[i]=3;this.shots[i]++;
      }
    }
    if(beach&&!this.targetsSpawned&&this.equipped.some(Boolean))this.spawnTargets(ram);
    this.sparks=this.sparks.filter(s=>--s.life>0);
    this.bullets=this.bullets.filter(b=>{
      const [dx,dy]=DIRECTIONS[b.direction];b.age++;
      // Swept collision in small steps prevents a fast bullet skipping a target.
      for(let step=0;step<4;step++){
        b.x+=dx*2;b.y+=dy*2;
        if(b.x<3||b.x>252||b.y<18||b.y>222||b.age>40)return false;
        for(let slot=0x200;slot<0x980;slot+=0x50){
          if(!ram[slot]||ram[slot+0xa]!==0xc||!ram[slot+0x1c])continue;
          if(Math.abs(b.x-word(ram,slot+0x11))<10&&Math.abs(b.y-word(ram,slot+0x14))<10&&ram[slot+0x17]<16){
            if(defeatPirate(ram,slot,b.direction)){this.hits[b.owner]++;this.sparks.push({x:b.x,y:b.y-9,life:8});return false;}
          }
        }
        const tile=ram[0x1400+(b.y>>3)*32+(b.x>>3)]&0xf0;
        if(tile!==0&&tile!==0x30&&tile!==0xf0&&tile!==0x70){this.sparks.push({x:b.x,y:b.y-9,life:5});return false;}
      }
      return true;
    });
  }
}
