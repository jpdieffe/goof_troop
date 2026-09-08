import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {realBrowserOptions} from './real-browser.mjs';

const url=process.argv[2]||'http://localhost:3000';
const browser=await chromium.launch(realBrowserOptions);
await mkdir('test-results',{recursive:true});
try{
  const context=await browser.newContext({viewport:{width:1400,height:1100}}),host=await context.newPage(),errors=[];
  host.on('pageerror',e=>errors.push(e.message));
  await host.goto(url);await host.bringToFront();await host.setInputFiles('#rom',process.argv[3]||'Goof Troop.zip');await host.click('#host',{force:true});
  await host.waitForFunction(()=>window.goofGatling&&EJS_emulator.gameManager.functions.getFrameNum()>500,null,{timeout:90000});
  for(const key of ['Enter','Enter','Enter','ArrowDown','Enter','KeyX','Enter']){await host.keyboard.press(key,{delay:500});await host.waitForTimeout(2500);}
  await host.waitForFunction(()=>goofGatling.model.active&&goofGatling.model.room===0);
  await host.locator('#screen').screenshot({path:'test-results/gatling-beach.png'});
  const guest=await context.newPage();guest.on('pageerror',e=>errors.push(e.message));
  await guest.goto(new URL('?room='+await host.locator('#room-code').textContent(),url).href);await guest.bringToFront();
  await guest.waitForFunction(()=>document.querySelector('video').videoWidth>0,null,{timeout:40000});
  assert.equal(await host.evaluate(()=>document.hidden),true);
  await guest.keyboard.press('ArrowDown',{delay:180});await guest.keyboard.press('KeyX',{delay:180});
  await host.waitForFunction(()=>goofGatling.model.equipped[1]);
  assert.deepEqual(await host.evaluate(()=>goofGatling.model.equipped),[false,true]);
  await host.waitForFunction(()=>{const r=EJS_emulator.Module.HEAPU8.subarray(goofGatling.base);return !r[0xac]&&goofGatling.model.player(r,1).canAct;});
  // Face the two native practice pirates, firing via the real guest data channel.
  await guest.keyboard.press('ArrowRight',{delay:80});
  await host.evaluate(()=>{
    window.nativeFlight=[];const module=EJS_emulator.Module,update=module.goofModFrame;
    module.goofModFrame=()=>{update();const ram=module.HEAPU8.subarray(goofGatling.base);for(const b of [0x840,0x890])if(ram[b+2]===4&&ram[b+3]===10&&ram[b+0x17]>0&&nativeFlight.length<200)nativeFlight.push({slot:b,z:ram[b+0x17],dx:ram[b+0x29],state:ram[b+2],substate:ram[b+3]});};
  });
  await guest.keyboard.down('KeyQ');
  await host.waitForFunction(()=>goofGatling.model.hits[1]>=1,null,{timeout:10000});
  await guest.waitForTimeout(200);
  await guest.locator('#screen').screenshot({path:'test-results/gatling-guest-firing.png'});
  await guest.keyboard.up('KeyQ');await guest.waitForTimeout(300);
  const shots=await host.evaluate(()=>goofGatling.model.shots[1]);await guest.waitForTimeout(400);assert.equal(await host.evaluate(()=>goofGatling.model.shots[1]),shots,'release stops the stream');
  const flight=await host.evaluate(()=>nativeFlight);assert.ok(flight.some(f=>f.z>10&&f.dx===4),'native pirate death launches up and right');
  await guest.waitForTimeout(2000);
  assert.ok(await host.evaluate(()=>{const r=EJS_emulator.Module.HEAPU8.subarray(goofGatling.base);return [0x840,0x890].some(b=>r[b]===0);}), 'native cleanup releases a defeated pirate slot');
  console.log('GUEST GATLING',await host.evaluate(()=>({shots:goofGatling.model.shots,hits:goofGatling.model.hits,flightSamples:nativeFlight.length,frame:EJS_emulator.gameManager.functions.getFrameNum()})));
  // Host can collect the other gun without taking it from player two.
  await host.bringToFront();await host.waitForFunction(()=>!document.hidden);await host.locator('#screen').focus();await host.keyboard.press('ArrowDown',{delay:250});await host.keyboard.press('KeyX',{delay:180});
  console.log('HOST PICKUP',await host.evaluate(()=>({players:[0,1].map(i=>goofGatling.model.player(EJS_emulator.Module.HEAPU8.subarray(goofGatling.base),i)),pickups:goofGatling.model.pickups,equipped:goofGatling.model.equipped})));
  await host.waitForFunction(()=>goofGatling.model.equipped.every(Boolean));
  await host.waitForFunction(()=>{const r=EJS_emulator.Module.HEAPU8.subarray(goofGatling.base);return !r[0xac]&&goofGatling.model.player(r,0).canAct;});
  await host.keyboard.press('ArrowRight',{delay:80});await host.keyboard.down('KeyQ');await host.waitForTimeout(450);await host.keyboard.up('KeyQ');
  assert.ok(await host.evaluate(()=>goofGatling.model.shots[0]>=4));
  await host.locator('#screen').screenshot({path:'test-results/gatling-both-equipped.png'});

  // Return to the pickup line and introduce a native grappling-gun fixture.
  await host.keyboard.down('ArrowLeft');await host.waitForFunction(()=>EJS_emulator.Module.HEAPU8[goofGatling.base+0x111]<=64);await host.keyboard.up('ArrowLeft');
  await host.keyboard.press('ArrowDown',{delay:50});
  await host.evaluate(()=>{const r=EJS_emulator.Module.HEAPU8.subarray(goofGatling.base);const b=[0x1040,0x1060,0x1080,0x10a0].find(b=>!r[b]);if(b===undefined)throw Error('No item fixture slot');r.fill(0,b,b+32);r[b]=2;r[b+0xb]=0;r[b+0xd]=27;r[b+0x11]=64;r[b+0x14]=144;});
  await host.waitForTimeout(400);await host.keyboard.press('KeyX',{delay:150});
  await host.waitForFunction(()=>EJS_emulator.Module.HEAPU8[goofGatling.base+0x142]===2&&!goofGatling.model.equipped[0]);
  await host.waitForFunction(()=>{const r=EJS_emulator.Module.HEAPU8.subarray(goofGatling.base);return !r[0xac]&&goofGatling.model.player(r,0).canAct;});await host.locator('#screen').screenshot({path:'test-results/weapon-grapple-swap.png'});
  const shotsBefore=await host.evaluate(()=>goofGatling.model.shots[0]);
  await host.keyboard.down('KeyS');await host.waitForFunction(()=>EJS_emulator.Module.HEAPU8[goofGatling.base+0x103]===10);await host.keyboard.up('KeyS');
  await host.waitForTimeout(1000);assert.equal(await host.evaluate(()=>goofGatling.model.shots[0]),shotsBefore);
  await host.keyboard.press('KeyX',{delay:150});await host.waitForFunction(()=>goofGatling.model.inventory.held[0]==='gatling');await host.waitForFunction(()=>{const r=EJS_emulator.Module.HEAPU8.subarray(goofGatling.base);return !r[0xac]&&goofGatling.model.player(r,0).canAct;});
  console.log('NATIVE GRAPPLE SWAP / RE-PICKUP PASSED');
  // Walk to the rocket on the upper sand and exchange the Gatling for it.
  await host.keyboard.down('ArrowUp');await host.waitForFunction(()=>EJS_emulator.Module.HEAPU8[goofGatling.base+0x114]<=101);await host.keyboard.up('ArrowUp');
  await host.keyboard.press('KeyX',{delay:150});await host.waitForFunction(()=>goofGatling.model.inventory.held[0]==='rocket');await host.waitForFunction(()=>{const r=EJS_emulator.Module.HEAPU8.subarray(goofGatling.base);return !r[0xac]&&goofGatling.model.player(r,0).canAct;});
  await host.keyboard.press('ArrowRight',{delay:120});
  await host.locator('#screen').screenshot({path:'test-results/rocket-inventory.png'});
  await host.keyboard.press('KeyS',{delay:150});await host.waitForFunction(()=>goofGatling.model.booms>0&&goofGatling.model.terrain.pending.length===0);
  assert.ok(await host.evaluate(()=>goofGatling.model.terrain.count>10));
  await host.waitForTimeout(600);await host.locator('#screen').screenshot({path:'test-results/rocket-tree-destroyed.png'});
  // Actually walk through the formerly solid tree, not just an overlay.
  await host.keyboard.down('ArrowRight');await host.waitForFunction(()=>EJS_emulator.Module.HEAPU8[goofGatling.base+0x111]>=150,null,{timeout:7000});await host.keyboard.up('ArrowRight');
  console.log('ROCKET / TREE COLLISION PASSED');
  await host.keyboard.down('ArrowDown');await host.waitForFunction(()=>EJS_emulator.Module.HEAPU8[goofGatling.base+0x114]>=136);await host.keyboard.up('ArrowDown');
  await host.keyboard.press('ArrowRight',{delay:120});const booms=await host.evaluate(()=>goofGatling.model.booms);
  await host.keyboard.press('KeyS',{delay:150});await host.waitForFunction(n=>goofGatling.model.booms>n&&goofGatling.model.terrain.pending.length===0,booms);
  assert.equal(await host.evaluate(()=>EJS_emulator.Module.HEAPU8[goofGatling.base+0x1400+17*32+30]),0);
  await host.keyboard.down('ArrowRight');await host.waitForFunction(()=>EJS_emulator.Module.HEAPU8[goofGatling.base+0x111]>=237,null,{timeout:7000});await host.keyboard.up('ArrowRight');
  await host.locator('#screen').screenshot({path:'test-results/rocket-wall-destroyed.png'});

  await guest.bringToFront();await guest.waitForFunction(()=>!document.hidden);await guest.locator('#screen').focus();
  await guest.keyboard.down('ArrowUp');await host.waitForFunction(()=>EJS_emulator.Module.HEAPU8[goofGatling.base+0x194]<=101);await guest.keyboard.up('ArrowUp');
  await guest.keyboard.press('KeyX',{delay:180});await host.waitForFunction(()=>goofGatling.model.inventory.held[1]==='rocket');
  await host.waitForFunction(()=>{const r=EJS_emulator.Module.HEAPU8.subarray(goofGatling.base);return !r[0xac]&&goofGatling.model.player(r,1).canAct;});
  await guest.keyboard.press('ArrowLeft',{delay:120});const beforeRemote=await host.evaluate(()=>({booms:goofGatling.model.booms,shots:goofGatling.model.shots[1]}));
  await guest.keyboard.press('KeyQ',{delay:160});
  await host.waitForFunction(v=>goofGatling.model.booms>v.booms&&goofGatling.model.shots[1]>v.shots,beforeRemote);
  assert.equal(await host.evaluate(()=>document.hidden),true);await guest.waitForTimeout(700);
  await guest.locator('#screen').screenshot({path:'test-results/rocket-guest-destruction.png'});
  assert.deepEqual(errors,[]);console.log('PASS: inventory swaps, native grapple, host/guest rockets, real tree/wall destruction and walking through both.');
}catch(error){console.error(error);throw error;}finally{await browser.close();}
