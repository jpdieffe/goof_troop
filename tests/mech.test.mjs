import test from 'node:test';
import assert from 'node:assert/strict';
import {GatlingModel} from '../public/gatling-model.js';
import {WeaponInventory} from '../public/weapon-inventory.js';
import {WeaponTerrain} from '../public/weapon-terrain.js';

function beach(){const r=new Uint8Array(0x20000);r[0xa0]=8;r[0xa2]=4;for(const b of [0x100,0x180]){r[b]=1;r[b+1]=1;r[b+2]=2;r[b+0x11]=b===0x100?64:96;r[b+0x14]=128;r[b+0x47]=2;}return r;}
function initialized(r,inventory){for(const [b,item]of inventory.bound){r[b]=1;r[b+2]=2;const t=((item.y-8)>>3)*32+((item.x-8)>>3);r[b+0x18]=t&255;r[b+0x19]=t>>8;for(const d of [0,1,32,33])r[0x1400+t+d]=0x80;}}

test('nearby mech borrows a distant custom slot and restores its collision without losing the item',()=>{
  const r=beach(),inv=new WeaponInventory();inv.update(r,0);initialized(r,inv);assert.equal(inv.ground.length,6);
  assert.equal([...inv.bound.values()].filter(p=>p.type==='mech').length,0);
  const original=[...inv.bound].map(([b,item])=>({b,item,t:r[b+0x18]|r[b+0x19]<<8}));
  r[0x114]=70;inv.update(r,0);
  assert.ok([...inv.bound.values()].some(p=>p.type==='mech'&&p.x===64));
  const evicted=original.find(p=>![...inv.bound.values()].includes(p.item));assert.ok(evicted);
  for(const d of [0,1,32,33])assert.equal(r[0x1400+evicted.t+d],0);
  assert.equal(inv.ground.length,6);assert.ok(inv.ground.includes(evicted.item));
  initialized(r,inv);r[0x114]=132;inv.update(r,0);assert.ok([...inv.bound.values()].some(p=>p.type==='gatling'&&p.x===64));
});

test('laser pierces multiple enemies and walls, respects direction, and stops on release or item swap',()=>{
  const r=beach(),terrain=new WeaponTerrain(new Uint8Array(0x80000)),m=new GatlingModel(terrain);m.tick(r,[0,0]);
  m.inventory.held[0]='mech';r[0x142]=12;
  for(const [b,id,x,y]of [[0x200,12,130,128],[0x250,12,200,128],[0x2a0,12,40,128],[0x2f0,12,150,160],[0x340,14,170,128],[0x390,44,220,128]]){r[b]=1;r[b+10]=id;r[b+0x11]=x;r[b+0x14]=y;r[b+0x1c]=4;}
  const obstacles=[16*32+17,16*32+23,16*32+30];for(const t of obstacles)r[0x1400+t]=0xc0;
  m.tick(r,[1<<1,0]);assert.equal(m.shots[0],1);assert.equal(m.hits[0],2);assert.ok(m.lasers[0]);
  for(const t of obstacles)assert.equal(r[0x1400+t],0);
  for(const b of [0x2a0,0x2f0,0x340])assert.equal(r[b+0x1c],4);
  assert.equal(r[0x3ac],0);assert.equal(m.bullets.length,0);assert.equal(m.rockets.length,0);
  const shots=m.shots[0];m.tick(r,[0,0]);assert.equal(m.lasers[0],null);assert.equal(m.shots[0],shots);
  r[0x142]=2;m.tick(r,[1<<1,0]);assert.equal(m.inventory.held[0],null);assert.equal(m.lasers[0],null);
});

test('both mechs fire independently, pause, turn, and clear beams during room transitions',()=>{
  const r=beach(),m=new GatlingModel();m.tick(r,[0,0]);m.inventory.held=['mech','mech'];r[0x142]=12;r[0x1c2]=12;
  m.tick(r,[1<<10,1<<1]);assert.deepEqual(m.shots,[1,1]);assert.ok(m.lasers.every(Boolean));
  r[0xab]=1;for(let n=0;n<20;n++)m.tick(r,[1<<10,1<<1]);assert.deepEqual(m.shots,[1,1]);
  r[0xab]=0;r[0x1c7]=0;m.tick(r,[0,1<<1]);assert.equal(m.lasers[0],null);assert.equal(m.lasers[1].direction,0);
  r[0xa2]=2;m.tick(r,[0,1<<1]);assert.deepEqual(m.lasers,[null,null]);
  r[0xa0]=0;m.tick(r,[0,0]);assert.deepEqual(m.inventory.held,[null,null]);
});
