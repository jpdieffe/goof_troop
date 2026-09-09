import {defeatPirate,word} from './gatling-model.js';
import {WEAPONS} from './weapons.js';
const put=(r,a,v)=>{v=Math.round(v);r[a]=v&255;r[a+1]=v>>8;};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const direction=(x,y)=>Math.abs(x)>Math.abs(y)?(x<0?3:1):(y<0?0:2);
const LOOT=['gatling','rocket','mech','shield','sword','sniper','grenade'];

export class ZombieMode{
  constructor(random=Math.random){this.random=random;this.level=1;this.wave=0;this.phase='preparing';this.timer=120;this.remaining=0;this.enemies=new Map();this.projectiles=[];this.kills=0;this.drops=0;this.reflections=0;this.bounces=0;this.hurt=[0,0];this.serial=0;}
  prepare(m,r,next=false){
    this.phase='preparing';this.timer=120;this.wave=0;this.remaining=0;this.projectiles=[];this.enemies.clear();
    m.inventory.ground=[];m.inventory.bound.clear();m.inventory.handled.clear();
    // Only the synthetic survival inventory owns these four slots in this arena.
    r.fill(0,0x1040,0x10c0);m.terrain?.arena(r,this.level);
    for(let i=0;i<2;i++){const b=0x100+i*0x80;if(!r[b])continue;put(r,b+0x11,40);put(r,b+0x14,104+i*40);r[b+0x47]=2;
      if(!next)m.inventory.equip(r,i,'pistol');
    }
    if(!next){for(const [type,x,y]of [['sword',72,88],['shield',104,88],['gatling',72,144],['rocket',104,144]])m.inventory.ground.push({room:0,type,x,y,ammo:WEAPONS[type].ammo});}
    m.targetsSpawned=true;m.bullets=[];m.rockets=[];m.grenades=[];m.lasers=[null,null];r[0xac]=6;
  }
  nextWave(){this.wave++;this.remaining=2+this.wave*2+Math.min(8,(this.level-1)*2);this.timer=45;this.phase='wave';}
  spawn(r){
    if(!r[0x119b])return false;
    let b;for(let s=0x200;s<0x980;s+=0x50)if(!r[s]){b=s;break;}if(b===undefined)return false;
    const index=r[b+0x25];r.fill(0,b,b+0x50);r[b]=1;r[b+1]=1;r[b+9]=4;r[b+10]=12;r[b+0xd]=3;r[b+0x25]=index;
    const y=[96,120,152][this.serial%3];put(r,b+0x11,238);put(r,b+0x14,y);
    this.enemies.set(b,{age:0,seen:false,dead:false,spit:90+Math.floor(this.random()*90),ranged:(this.serial++%3)===2,knock:0,vx:0,vy:0,x:238,y});return true;
  }
  drop(m,r,x,y){
    // Every defeat gives a random useful item, with a bounded number of floor drops.
    const type=LOOT[Math.floor(this.random()*LOOT.length)],ground=m.inventory.ground;
    if(ground.length>=18){const old=ground.find(g=>![...m.inventory.bound.values()].includes(g));if(old)ground.splice(ground.indexOf(old),1);else return;}
    const spots=[];for(let ty=80;ty<=160;ty+=8)for(let tx=24;tx<=224;tx+=8)if(!ground.some(g=>Math.abs(g.x-tx)<20&&Math.abs(g.y-ty)<20)){
      const tile=((ty-8)>>3)*32+((tx-8)>>3);if([0,1,32,33].every(d=>r[0x1400+tile+d]===0))spots.push({x:tx,y:ty,d:(tx-x)**2+(ty-y)**2});
    }
    const p=spots.sort((a,b)=>a.d-b.d)[0];if(!p)return;
    ground.push({room:m.room,x:p.x,y:p.y,type,ammo:WEAPONS[type].ammo});this.drops++;
  }
  hurtPlayer(r,i,dx,dy){
    const b=0x100+i*0x80;if(r[b]!==1||this.hurt[i])return;
    this.hurt[i]=70;r[b]=2;r[b+2]=4;r[b+3]=0;r[b+4]=0;r[b+5]=0;r[b+0xd]=direction(dx,dy);
    if(r[b+0x1d])r[b+0x1d]=0;else r[b+0x1c]=0;r[b+0x3f]=0;
  }
  tick(m,r){
    // Survival uses one item slot for solo players as well as co-op. The native
    // primary-slot selector remains selected; the survival HUD draws that slot.
    for(let i=0;i<2;i++){const b=0x100+i*0x80;if(!r[b])continue;r[b+0x40]=2;r[b+0x41]=0;r[b+0x43]=0;
      if(!m.inventory.held[i]&&!r[b+0x42])m.inventory.equip(r,i,'pistol');
      this.hurt[i]=Math.max(0,this.hurt[i]-1);
      put(r,b+0x11,clamp(word(r,b+0x11),16,this.phase==='exit'?247:232));put(r,b+0x14,clamp(word(r,b+0x14),76,164));
    }
    if(this.phase==='preparing'){
      r[0xac]=6;if(m.terrain?.pending.length)return;
      if(--this.timer>0)return;r[0xac]=0;this.nextWave();return;
    }
    if(r[0xab]||r[0xac])return;
    const players=[0,1].map(i=>({i,...m.player(r,i)})).filter(p=>r[0x100+p.i*0x80]>0&&r[0x100+p.i*0x80]<4);
    if(this.phase==='exit'){
      // Cleared-wave loot stays collectable, but cannot form a solid wall that
      // traps the team before the exit. Native pickup detection uses positions.
      for(const [b,item]of m.inventory.bound)if(item.type&&r[b]===1&&r[b+2]===2){const tile=word(r,b+0x18);if(tile<991)for(const d of [0,1,32,33])r[0x1400+tile+d]=r[0x1f800+tile+d];}
      if(players.length&&players.every(p=>p.x>=228)){this.level++;this.prepare(m,r,true);}return;
    }
    if(this.phase==='break'){if(--this.timer<=0)this.nextWave();return;}
    for(const [b,e]of this.enemies){
      e.age++;if(r[b+0x1c]>0)e.seen=true;
      if(!e.dead&&e.seen&&(!r[b]||!r[b+0x1c])){e.dead=true;this.kills++;this.drop(m,r,e.x,e.y);}
      if(!r[b]){this.enemies.delete(b);continue;}if(e.dead||!e.seen)continue;
      const p=players.reduce((a,p)=>!a||Math.hypot(p.x-e.x,p.y-e.y)<Math.hypot(a.x-e.x,a.y-e.y)?p:a,null);if(!p)continue;
      e.x=word(r,b+0x11);e.y=word(r,b+0x14);
      const defender=players.find(p=>m.shields[p.i]>0&&Math.hypot(p.x-e.x,p.y-e.y)<34);
      if(defender&&!e.knock){const dx=e.x-defender.x,dy=e.y-defender.y,n=Math.hypot(dx,dy)||1;e.vx=dx/n*5;e.vy=dy/n*5;e.knock=14;this.bounces++;}
      if(e.knock){e.knock--;put(r,b+0x11,clamp(e.x+e.vx,16,242));put(r,b+0x14,clamp(e.y+e.vy,80,160));}
      else if(r[b+2]===2){
        const dx=p.x-e.x,dy=p.y-e.y,n=Math.hypot(dx,dy)||1,speed=.5+Math.min(.5,this.level*.06);
        // Add pursuit to the native walking/attack animation, using solid tiles.
        const nx=clamp(e.x+dx/n*speed,16,242),ny=clamp(e.y+dy/n*speed,80,160),tile=r[0x1400+(Math.round(ny)>>3)*32+(Math.round(nx)>>3)];
        if(tile===0){put(r,b+0x11,nx);put(r,b+0x14,ny);}r[b+0xd]=direction(dx,dy);
      }
      if(e.ranged&&--e.spit<=0){e.spit=Math.max(60,150-this.level*6);const dx=p.x-e.x,dy=p.y-e.y,n=Math.hypot(dx,dy)||1;this.projectiles.push({x:e.x,y:e.y,vx:dx/n*2,vy:dy/n*2,owner:-1,life:180});}
    }
    this.projectiles=this.projectiles.filter(q=>{
      q.x+=q.vx;q.y+=q.vy;if(--q.life<=0||q.x<8||q.x>248||q.y<28||q.y>212)return false;
      if(q.owner<0){for(const p of players){const distance=Math.hypot(q.x-p.x,q.y-p.y);
        if(m.shields[p.i]>0&&distance<32){q.owner=p.i;q.vx*=-1.6;q.vy*=-1.6;q.life=120;this.reflections++;return true;}
        if(distance<10){this.hurtPlayer(r,p.i,q.vx,q.vy);return false;}
      }}else for(const [b,e]of this.enemies)if(!e.dead&&Math.hypot(q.x-word(r,b+0x11),q.y-word(r,b+0x14))<12){if(defeatPirate(r,b,direction(q.vx,q.vy)))m.hits[q.owner]++;return false;}
      return true;
    });
    const living=[...this.enemies.values()].filter(e=>!e.dead).length;
    if(this.remaining&&living<4&&--this.timer<=0){if(this.spawn(r)){this.remaining--;this.timer=70;}}
    if(!this.remaining&&!this.enemies.size){this.projectiles=[];if(this.wave===3){this.phase='exit';m.notice='AREA CLEAR! Everyone head RIGHT ->';m.noticeTime=999999;}else{this.phase='break';this.timer=180;m.notice='Wave cleared! Grab your drops.';m.noticeTime=180;}}
  }
}
