import {WeaponInventory,ITEM_USE_BUTTON} from './weapon-inventory.js';
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
  constructor(terrain=null){this.terrain=terrain;this.reset();}
  reset(){this.inventory=new WeaponInventory();this.equipped=[false,false];this.cooldown=[0,0];this.flash=[0,0];this.bullets=[];this.rockets=[];this.explosions=[];this.sparks=[];this.room=-1;this.active=false;this.ticks=0;this.shots=[0,0];this.hits=[0,0];this.targetsSpawned=false;this.notice='Face an item: X to pick up. S / Q to fire.';this.noticeTime=360;this.pickupSerial=0;this.booms=0;this.terrain?.reset();}
  get pickups(){return this.inventory.ground.filter(g=>g.room===this.room&&g.type);}
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

  explode(ram,rocket){
    this.explosions.push({x:rocket.x,y:rocket.y-9,life:24});this.booms++;
    for(let slot=0x200;slot<0x980;slot+=0x50){
      const dx=word(ram,slot+0x11)-rocket.x,dy=word(ram,slot+0x14)-rocket.y;
      if(Math.hypot(dx,dy)>34)continue;
      const direction=Math.abs(dx)>Math.abs(dy)?(dx<0?3:1):(dy<0?0:2);
      if(defeatPirate(ram,slot,direction))this.hits[rocket.owner]++;
      // Original breakable-wall sprite: let its own destruction handler update
      // puzzle flags, tiles, sound and debris before the terrain blast clears trees.
      if(ram[slot]&&ram[slot+0xa]===0x2c&&ram[slot+0x1c]){ram[slot+0x1d]=ram[slot+0x1c];ram[slot+0x1c]=0;}
    }
    this.terrain?.blast(ram,rocket.x,rocket.y);
  }
  tick(ram,masks){
    if(ram[0xa0]!==8){if(this.active||this.equipped.some(Boolean))this.reset();return;}
    const room=ram[0xb6]*256+ram[0xb7];
    if(room!==this.room){this.bullets=[];this.rockets=[];this.sparks=[];this.explosions=[];this.room=room;}
    const wasActive=this.active;this.active=ram[0xa2]===4;
    if(!this.active)return;
    if(!wasActive){this.inventory.room=-1;if(this.terrain)this.terrain.room=-1;}
    this.inventory.update(ram,room);this.equipped=this.inventory.held.map(Boolean);
    this.terrain?.enter(ram,room);this.terrain?.flush(ram);
    if(this.inventory.serial!==this.pickupSerial){this.pickupSerial=this.inventory.serial;const p=this.inventory.lastPickup;this.notice=p.type?`P${p.player+1}: ${p.type.toUpperCase()}! Hold S / Q.`:`P${p.player+1}: item swapped. Weapon left behind.`;this.noticeTime=240;}
    if(ram[0xab]||ram[0xac])return;
    this.ticks++;if(this.noticeTime>0)this.noticeTime--;
    for(let i=0;i<2;i++){
      const p=this.player(ram,i),weapon=this.inventory.held[i];this.flash[i]=Math.max(0,this.flash[i]-1);this.cooldown[i]=Math.max(0,this.cooldown[i]-1);
      if(!p.canAct)continue;
      if(weapon&&(masks[i]&((1<<FIRE_BUTTON)|(1<<ITEM_USE_BUTTON)))&&!this.cooldown[i]){
        const [dx,dy]=DIRECTIONS[p.direction];
        const projectile={x:p.x+dx*12,y:p.y+dy*12,direction:p.direction,owner:i,age:0};
        (weapon==='rocket'?this.rockets:this.bullets).push(projectile);
        this.cooldown[i]=weapon==='rocket'?40:4;this.flash[i]=weapon==='rocket'?8:3;this.shots[i]++;
      }
    }
    if(room===0&&!this.targetsSpawned&&this.equipped.some(Boolean))this.spawnTargets(ram);
    this.sparks=this.sparks.filter(s=>--s.life>0);this.explosions=this.explosions.filter(e=>--e.life>0);
    const advance=(b,rocket)=>{
      const [dx,dy]=DIRECTIONS[b.direction];b.age++;
      for(let step=0;step<(rocket?2:4);step++){
        b.x+=dx*2;b.y+=dy*2;
        if(b.x<8||b.x>247||b.y<18||b.y>215||b.age>(rocket?60:40)){if(rocket)this.explode(ram,b);return false;}
        for(let slot=0x200;slot<0x980;slot+=0x50){
          if(!ram[slot]||ram[slot+0xa]!==0xc||!ram[slot+0x1c])continue;
          if(Math.abs(b.x-word(ram,slot+0x11))<10&&Math.abs(b.y-word(ram,slot+0x14))<10&&ram[slot+0x17]<16){
            if(rocket)this.explode(ram,b);
            else if(defeatPirate(ram,slot,b.direction)){this.hits[b.owner]++;this.sparks.push({x:b.x,y:b.y-9,life:8});}
            return false;
          }
        }
        const tile=ram[0x1400+(b.y>>3)*32+(b.x>>3)]&0xf0;
        if(tile!==0&&tile!==0x30&&tile!==0xf0&&tile!==0x70){if(rocket)this.explode(ram,b);else this.sparks.push({x:b.x,y:b.y-9,life:5});return false;}
      }
      return true;
    };
    this.bullets=this.bullets.filter(b=>advance(b,false));this.rockets=this.rockets.filter(b=>advance(b,true));
  }
}
