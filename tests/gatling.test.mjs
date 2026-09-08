import test from 'node:test';
import assert from 'node:assert/strict';
import {GatlingModel,defeatPirate} from '../public/gatling-model.js';
import {crc32} from '../public/gatling.js';

function beach(){const ram=new Uint8Array(0x20000);ram[0xa0]=8;ram[0xa2]=4;for(const b of [0x100,0x180]){ram[b]=1;ram[b+1]=1;ram[b+2]=2;ram[b+0x11]=b===0x100?64:96;ram[b+0x14]=147;ram[b+0x47]=2;}return ram;}
test('ROM fingerprint uses standard CRC32',()=>assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926));
test('both players get independent pickups and fire; only a pirate receives native fatal damage',()=>{
  const ram=beach(),model=new GatlingModel();model.tick(ram,[0,0]);assert.deepEqual(model.equipped,[true,true]);assert.equal(model.pickups.length,0);
  for(const [b,id,x] of [[0x200,0xe,124],[0x250,0xc,144]]){ram[b]=1;ram[b+0xa]=id;ram[b+0x11]=x;ram[b+0x14]=147;ram[b+0x1c]=4;ram[b+0x1d]=4;}
  for(let frame=0;frame<20;frame++)model.tick(ram,[0,1<<10]);
  assert.deepEqual(model.shots,[0,5]);assert.deepEqual(model.hits,[0,1]);assert.equal(ram[0x21c],4,'friendly islander remains unharmed');assert.equal(ram[0x26c],0);assert.equal(ram[0x252],4);assert.equal(ram[0x253],0);assert.equal(ram[0x25d],1);
  assert.equal(defeatPirate(ram,0x250,0),false,'cannot kill the same pirate twice');
});
test('solid terrain blocks bullets, pause freezes them, and room transitions clear them',()=>{
  const ram=beach(),model=new GatlingModel();model.tick(ram,[0,0]);
  const wall=0x1400+(147>>3)*32+(120>>3);ram[wall]=0xc0;
  for(let i=0;i<5;i++)model.tick(ram,[0,1<<10]);assert.equal(model.hits[1],0);assert.ok(model.sparks.length>0);
  ram[wall]=0;model.tick(ram,[1<<10,0]);const before=JSON.stringify(model.bullets);ram[0xab]=1;
  for(let i=0;i<10;i++)model.tick(ram,[1<<10,1<<10]);assert.equal(JSON.stringify(model.bullets),before);
  ram[0xab]=0;ram[0xb7]=1;model.tick(ram,[0,0]);assert.equal(model.bullets.length,0);assert.deepEqual(model.equipped,[true,true]);
  ram[0xa0]=0;model.tick(ram,[0,0]);assert.deepEqual(model.equipped,[false,false]);
});
