import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSession} from '../public/game-session.js';
import {GatlingModel} from '../public/gatling-model.js';
import {ZombieMode} from '../public/zombie-mode.js';
import {WeaponTerrain} from '../public/weapon-terrain.js';
import {WEAPONS,SHIELD_TIME} from '../public/weapons.js';
function beach(){const r=new Uint8Array(0x20000);r[0xa0]=8;r[0xa2]=4;r[0xbd]=3;for(const b of [0x100,0x180]){r[b]=1;r[b+1]=1;r[b+2]=2;r[b+0x11]=64;r[b+0x14]=128;r[b+0x47]=2;r[b+0x1c]=1;}return r;}
test('post-player menu waits for a new host confirm and Story restores beach weapons without survival waves',()=>{
  const r=beach(),m=new GameSession();m.tick(r,[8,0]);assert.ok(m.choosing);assert.equal(r[0xac],6);
  for(let i=0;i<25;i++)m.tick(r,[8,0]);assert.ok(m.choosing,'held Start cannot skip the menu');
  m.tick(r,[0,0]);m.tick(r,[0,8]);assert.ok(m.choosing,'guest cannot select for the host');
  m.tick(r,[8,0]);assert.equal(m.gameMode,'story');assert.equal(r[0xac],0);m.tick(r,[0,0]);
  assert.equal(m.active,true);assert.equal(m.zombie,null);assert.equal(m.inventory.limited,false);
  assert.deepEqual(m.pickups.map(g=>g.type),['gatling','gatling','rocket','rocket','mech','mech']);
  assert.ok(m.inventory.bound.size>0,'beach pickups bind to native item slots');
  m.inventory.equip(r,0,'gatling',1);for(let i=0;i<30;i++)m.tick(r,[1024,0]);
  assert.ok(m.shots[0]>1);assert.equal(m.inventory.held[0],'gatling');assert.equal(m.inventory.ammo[0],1,'Story weapons retain unlimited use');
});
test('finite heavy ammo falls back to pistol; sword is unlimited and shield expires',()=>{
  const r=beach(),m=new GatlingModel();m.tick(r,[0,0]);m.inventory.limited=true;m.inventory.equip(r,0,'rocket',1);m.tick(r,[1024,0]);
  assert.equal(m.inventory.held[0],'pistol');assert.equal(m.inventory.ammo[0],Infinity);assert.equal(m.shots[0],1);
  m.cooldown[0]=0;m.inventory.equip(r,0,'shield');m.tick(r,[1024,0]);assert.equal(m.shields[0],SHIELD_TIME);assert.equal(m.inventory.held[0],'pistol');
  for(let i=0;i<SHIELD_TIME;i++)m.tick(r,[0,0]);assert.equal(m.shields[0],0);
  m.inventory.equip(r,0,'sword');m.cooldown[0]=0;m.tick(r,[1024,0]);assert.equal(m.inventory.ammo[0],Infinity);assert.ok(m.slashes.length);
});
test('weapon swaps retain partial ammunition instead of refilling the gun',()=>{
  const r=beach(),m=new GatlingModel();m.tick(r,[0,0]);m.inventory.limited=true;m.inventory.equip(r,0,'gatling',7);
  const b=0x1080;r[b]=1;r[b+2]=2;r[b+4]=12;r[b+5]=0;r[b+0xb]=10;m.tick(r,[0,0]);
  assert.equal(m.inventory.held[0],'rocket');assert.equal(m.inventory.ammo[0],WEAPONS.rocket.ammo);assert.equal(m.inventory.bound.get(b).ammo,7);
  m.tick(r,[0,0]);r[b+4]=12;m.tick(r,[0,0]);assert.equal(m.inventory.held[0],'gatling');assert.equal(m.inventory.ammo[0],7);
});
test('shield bounces a live enemy and reflects its projectile into native defeat',()=>{
  const r=beach(),m=new GatlingModel(),z=new ZombieMode(()=>.5);m.tick(r,[0,0]);z.phase='wave';z.remaining=1;z.timer=999;m.shields[0]=60;
  const b=0x200;r[b]=1;r[b+1]=1;r[b+2]=2;r[b+10]=12;r[b+0x11]=90;r[b+0x14]=128;r[b+0x1c]=4;
  z.enemies.set(b,{x:90,y:128,age:10,seen:true,dead:false,ranged:false,knock:0});
  z.projectiles.push({x:92,y:128,vx:-2,vy:0,owner:-1,life:100});z.tick(m,r);assert.equal(z.bounces,1);assert.equal(z.reflections,1);assert.equal(z.projectiles[0].owner,0);assert.ok(r[b+0x11]>90);
  m.shields[0]=0;r[b+0x11]=102;for(let i=0;i<20&&r[b+0x1c];i++)z.tick(m,r);assert.equal(r[b+0x1c],0);
});
test('three completed waves open exit; both players must reach it before next arena',()=>{
  const r=beach(),m=new GatlingModel(new WeaponTerrain(new Uint8Array(0x80000))),z=new ZombieMode();m.tick(r,[0,0]);z.phase='wave';z.wave=3;z.remaining=0;
  z.projectiles.push({x:180,y:80,vx:1,vy:0,owner:-1,life:60});z.tick(m,r);assert.equal(z.phase,'exit');assert.deepEqual(z.projectiles,[]);r[0x111]=230;z.tick(m,r);assert.equal(z.level,1);
  r[0x191]=230;z.tick(m,r);assert.equal(z.level,2);assert.equal(z.wave,0);assert.equal(z.phase,'preparing');assert.equal(r[0x111],40);assert.equal(r[0x191],40);assert.ok(m.terrain.pending.length>=1024);
});
test('enemy death creates exactly one random drop with a fresh ammo count',()=>{
  const r=beach(),m=new GatlingModel(),z=new ZombieMode(()=>0);m.tick(r,[0,0]);m.inventory.ground=[];m.inventory.bound.clear();r.fill(0,0x1040,0x10c0);
  z.phase='wave';z.remaining=1;z.timer=999;const b=0x200;r[b]=3;r[b+10]=12;r[b+0x11]=160;r[b+0x14]=120;
  z.enemies.set(b,{x:160,y:120,age:5,seen:true,dead:false});z.tick(m,r);z.tick(m,r);assert.equal(z.drops,1);assert.equal(z.kills,1);assert.equal(m.inventory.ground[0].type,'gatling');assert.equal(m.inventory.ground[0].ammo,120);
});
test('sword hits its forward arc; sniper pierces; grenade detonates after its fuse',()=>{
  const enemy=(r,b,x,y)=>{r[b]=1;r[b+10]=12;r[b+0x11]=x;r[b+0x14]=y;r[b+0x1c]=4;};
  let r=beach(),m=new GatlingModel();m.tick(r,[0,0]);m.inventory.equip(r,0,'sword');enemy(r,0x200,88,128);enemy(r,0x250,40,128);m.tick(r,[1024,0]);assert.equal(r[0x21c],0);assert.equal(r[0x26c],4);
  r=beach();m=new GatlingModel();m.tick(r,[0,0]);m.inventory.equip(r,0,'sniper');enemy(r,0x200,120,128);enemy(r,0x250,160,128);m.tick(r,[1024,0]);for(let i=0;i<12;i++)m.tick(r,[0,0]);assert.equal(m.hits[0],2);
  r=beach();m=new GatlingModel();m.tick(r,[0,0]);m.inventory.limited=true;m.inventory.equip(r,0,'grenade');enemy(r,0x200,160,128);m.tick(r,[1024,0]);for(let i=0;i<43;i++)m.tick(r,[0,0]);assert.equal(m.booms,0);m.tick(r,[0,0]);assert.equal(m.booms,1);assert.equal(r[0x21c],0);assert.equal(m.inventory.ammo[0],3);
});
test('cleared-wave loot remains collectable but cannot block the exit',()=>{
  const r=beach(),m=new GatlingModel(),z=new ZombieMode();m.tick(r,[0,0]);z.phase='exit';const b=0x1040,tile=15*32+26;
  r[b]=1;r[b+2]=2;r[b+0x18]=tile&255;r[b+0x19]=tile>>8;for(const d of [0,1,32,33])r[0x1400+tile+d]=0x80;
  const item=m.inventory.bound.get(b);z.tick(m,r);assert.ok(m.inventory.ground.includes(item));assert.equal(r[b],1);for(const d of [0,1,32,33])assert.equal(r[0x1400+tile+d],0);
});
