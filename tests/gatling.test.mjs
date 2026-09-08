import test from 'node:test';
import assert from 'node:assert/strict';
import {GatlingModel,defeatPirate} from '../public/gatling-model.js';
import {crc32} from '../public/gatling.js';
import {WeaponTerrain} from '../public/weapon-terrain.js';

function beach(){const ram=new Uint8Array(0x20000);ram[0xa0]=8;ram[0xa2]=4;for(const b of [0x100,0x180]){ram[b]=1;ram[b+1]=1;ram[b+2]=2;ram[b+0x11]=b===0x100?64:96;ram[b+0x14]=147;ram[b+0x47]=2;}return ram;}
test('ROM fingerprint uses standard CRC32',()=>assert.equal(crc32(new TextEncoder().encode('123456789')),0xcbf43926));

function pickup(ram,model,b,player){
 const old=ram[0x142+player*0x80],incoming=ram[b+0xb]+2;
 ram[0x142+player*0x80]=incoming;ram[b+5]=player*0x80;ram[b+4]=old;
 if(old){ram[b]=1;ram[b+2]=2;ram[b+0xb]=old-2;}else{ram[b]=2;ram[b+2]=6;}
 model.tick(ram,[0,0]);if(!old)ram[b]=0;model.tick(ram,[0,0]);
}
test('weapons occupy native inventory, swap with grappling gun, and retain dropped identity',()=>{
 const r=beach(),m=new GatlingModel();m.tick(r,[0,0]);pickup(r,m,0x1040,0);
 assert.equal(r[0x142],12);assert.equal(m.inventory.held[0],'gatling');
 // A native grappling gun replaces the carrier; the old ground slot becomes a Gatling.
 r[0x1040]=1;r[0x1042]=2;r[0x104b]=0;r[0x1051]=64;r[0x1054]=148;
 pickup(r,m,0x1040,0);assert.equal(r[0x142],2);assert.equal(m.inventory.held[0],null);
 assert.equal(m.inventory.bound.get(0x1040).type,'gatling');
 for(let i=0;i<10;i++)m.tick(r,[1<<10,0]);assert.equal(m.shots[0],0);
 pickup(r,m,0x1040,0);assert.equal(m.inventory.held[0],'gatling');assert.equal(m.inventory.bound.get(0x1040).itemId,2);
 // Same native carrier ID, different custom weapon: the swap must still occur.
 pickup(r,m,0x1080,0);assert.equal(m.inventory.held[0],'rocket');assert.equal(m.inventory.bound.get(0x1080).type,'gatling');
});
test('independent firing uses native pirate defeat and leaves NPCs unharmed',()=>{
 const ram=beach(),model=new GatlingModel();model.tick(ram,[0,0]);pickup(ram,model,0x1040,0);pickup(ram,model,0x1060,1);
 for(const [b,id,x] of [[0x200,0xe,124],[0x250,0xc,144]]){ram[b]=1;ram[b+0xa]=id;ram[b+0x11]=x;ram[b+0x14]=147;ram[b+0x1c]=4;ram[b+0x1d]=4;}
 for(let frame=0;frame<20;frame++)model.tick(ram,[0,1<<10]);
 assert.deepEqual(model.shots,[0,5]);assert.deepEqual(model.hits,[0,1]);assert.equal(ram[0x21c],4);assert.equal(ram[0x26c],0);assert.equal(ram[0x252],4);assert.equal(ram[0x253],0);assert.equal(ram[0x25d],1);
 assert.equal(defeatPirate(ram,0x250,0),false);
});
test('rockets have a slower rate, impact explosions and pause correctly',()=>{
 const r=beach(),m=new GatlingModel();m.tick(r,[0,0]);pickup(r,m,0x1080,0);
 r[0x1400+(147>>3)*32+(120>>3)]=0xc0;
 for(let i=0;i<20;i++)m.tick(r,[1<<10,0]);assert.equal(m.shots[0],1);assert.equal(m.booms,1);assert.ok(m.explosions.length);
 r[0xab]=1;const life=m.explosions[0].life;for(let i=0;i<30;i++)m.tick(r,[1<<10,0]);assert.equal(m.explosions[0].life,life);assert.equal(m.shots[0],1);
 r[0xab]=0;r[0xb7]=1;m.tick(r,[0,0]);assert.equal(m.rockets.length,0);assert.equal(m.explosions.length,0);assert.equal(m.inventory.held[0],'rocket');
 r[0xa0]=0;m.tick(r,[0,0]);assert.deepEqual(m.equipped,[false,false]);
});
test('terrain blast clears collision and backing collision, preserves items, and bounds DMA writes',()=>{
 const r=beach(),terrain=new WeaponTerrain(new Uint8Array(0x80000));terrain.enter(r,0);
 const tree=12*32+18,wall=13*32+18,item=11*32+16;
 r[0x1400+tree]=0xc0;r[0x1400+wall]=0x80;r[0x1400+item]=0x80;r[0x1f800+tree]=0xc0;
 r[0x1040]=1;r[0x1051]=128;r[0x1054]=88;
 assert.ok(terrain.blast(r,152,104)>=2);
 assert.equal(r[0x1400+tree],0);assert.equal(r[0x1f800+tree],0);assert.equal(r[0x1400+wall],0);assert.equal(r[0x1400+item],0x80);
 r[0x40]=0xd0;const pending=terrain.pending.length;terrain.flush(r);assert.equal(terrain.pending.length,pending,'leave a busy native DMA queue alone');
 r[0x40]=0;terrain.flush(r);assert.ok(r[0x40]<=0xf0);assert.equal(r[0x1800],1);assert.equal(r[0x1807],0x7f);
 terrain.enter(r,1);r[0x1400+tree]=0xc0;terrain.enter(r,0);assert.equal(r[0x1400+tree],0,'destroyed terrain survives a room revisit');
});
test('reloading the same room reapplies destroyed collision',()=>{
 const r=beach(),terrain=new WeaponTerrain(new Uint8Array(0x80000)),m=new GatlingModel(terrain),tile=12*32+20;
 m.tick(r,[0,0]);r[0x1400+tile]=0xc0;terrain.blast(r,164,100);assert.equal(r[0x1400+tile],0);
 r[0xa2]=2;m.tick(r,[0,0]);r[0x1400+tile]=0xc0;r[0xa2]=4;m.tick(r,[0,0]);
 assert.equal(r[0x1400+tile],0);
});
