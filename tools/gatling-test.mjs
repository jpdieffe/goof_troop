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
  assert.deepEqual(errors,[]);console.log('PASS: two pickups, remote firing with hidden host, native flight, firing release, host firing.');
}finally{await browser.close();}
