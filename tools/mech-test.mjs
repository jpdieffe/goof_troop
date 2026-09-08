import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {realBrowserOptions} from './real-browser.mjs';

const url=process.argv[2]||'http://localhost:3000';
const browser=await chromium.launch(realBrowserOptions);
await mkdir('test-results',{recursive:true});
let host,guest;
try{
  const context=await browser.newContext({viewport:{width:1400,height:1100}}),errors=[];
  host=await context.newPage();host.on('pageerror',e=>errors.push(e.message));
  await host.goto(url);await host.bringToFront();await host.setInputFiles('#rom',process.argv[3]||'Goof Troop.zip');await host.click('#host',{force:true});
  await host.waitForFunction(()=>window.goofGatling&&EJS_emulator.gameManager.functions.getFrameNum()>500,null,{timeout:90000});
  for(const key of ['Enter','Enter','Enter','ArrowDown','Enter','KeyX','Enter']){await host.keyboard.press(key,{delay:500});await host.waitForTimeout(2500);}
  await host.waitForFunction(()=>goofGatling.model.active&&goofGatling.model.room===0);
  guest=await context.newPage();guest.on('pageerror',e=>errors.push(e.message));
  await guest.goto(new URL('?room='+await host.locator('#room-code').textContent(),url).href);await guest.bringToFront();
  await guest.waitForFunction(()=>document.querySelector('video').videoWidth>0,null,{timeout:40000});
  if(!await host.evaluate(()=>EJS_emulator.Module.HEAPU8[goofGatling.base+0x180]))await guest.keyboard.press('Enter',{delay:180});
  await host.waitForFunction(()=>EJS_emulator.Module.HEAPU8[goofGatling.base+0xbd]===3);
  const ready=i=>host.waitForFunction(i=>{const r=EJS_emulator.Module.HEAPU8.subarray(goofGatling.base);return !r[0xac]&&goofGatling.model.player(r,i).canAct;},i);
  const move=async(page,i,key,axis,value,less)=>{await page.keyboard.down(key);try{await host.waitForFunction(({i,axis,value,less})=>{const p=goofGatling.model.player(EJS_emulator.Module.HEAPU8.subarray(goofGatling.base),i);return less?p[axis]<=value:p[axis]>=value;},{i,axis,value,less},{timeout:8000});}finally{await page.keyboard.up(key);}};
  const equip=async(page,i,type)=>{await page.keyboard.press('KeyX',{delay:150});await host.waitForFunction(({i,type})=>goofGatling.model.inventory.held[i]===type,{i,type});await ready(i);};

  // Walk around the rocket row to reach the mech first, with all four native
  // ground slots occupied. This exercises proximity-based slot lending too.
  await host.bringToFront();await host.waitForFunction(()=>!document.hidden);await host.locator('#screen').focus();
  if(await host.evaluate(()=>EJS_emulator.Module.HEAPU8[goofGatling.base+0x103]===4))await host.keyboard.press('KeyX',{delay:150});
  await ready(0);await move(host,0,'ArrowLeft','x',40,true);await move(host,0,'ArrowUp','y',70,true);await move(host,0,'ArrowRight','x',64,false);
  await host.keyboard.press('ArrowUp',{delay:50});await equip(host,0,'mech');
  await host.locator('#screen').screenshot({path:'test-results/mech-transformed.png'});
  assert.equal(await host.evaluate(()=>EJS_emulator.Module.HEAPU8[goofGatling.base+0x142]),12);
  console.log('NATIVE MECH PICKUP / INVENTORY PASSED');

  await host.keyboard.press('ArrowRight',{delay:60});
  // Place the game's two initialized practice pirates along this firing lane.
  await host.waitForFunction(()=>goofGatling.model.targetsSpawned);
  await host.evaluate(()=>{const r=EJS_emulator.Module.HEAPU8.subarray(goofGatling.base),y=r[0x114];for(const [i,b]of [0x840,0x890].entries()){r[b+0x11]=168+i*32;r[b+0x12]=0;r[b+0x14]=y;r[b+0x15]=0;}});
  const before=await host.evaluate(()=>goofGatling.model.terrain.count);
  await host.keyboard.down('KeyS');await host.waitForFunction(()=>goofGatling.model.hits[0]>=2);
  await host.waitForFunction(n=>goofGatling.model.terrain.count>n+40,before);
  await host.waitForTimeout(250);await host.locator('#screen').screenshot({path:'test-results/mech-laser.png'});
  await host.keyboard.up('KeyS');await host.waitForFunction(()=>!goofGatling.model.lasers[0]&&goofGatling.model.terrain.pending.length===0);
  const shots=await host.evaluate(()=>goofGatling.model.shots[0]);await host.waitForTimeout(250);assert.equal(await host.evaluate(()=>goofGatling.model.shots[0]),shots);
  await move(host,0,'ArrowRight','x',220,false);await host.locator('#screen').screenshot({path:'test-results/mech-walk-through.png'});
  console.log('PIERCING LASER / MULTIPLE ENEMIES / WALK THROUGH SCENERY PASSED');

  // Return and swap the suit for the real rocket item, then reclaim it.
  await move(host,0,'ArrowLeft','x',64,true);await host.keyboard.press('ArrowDown',{delay:100});await equip(host,0,'rocket');
  await host.locator('#screen').screenshot({path:'test-results/mech-swapped-out.png'});
  assert.equal(await host.evaluate(()=>goofGatling.model.lasers[0]),null);
  await equip(host,0,'mech');
  await host.locator('#screen').screenshot({path:'test-results/mech-reclaimed.png'});

  // Guest collects the other suit and fires while the host is truly hidden.
  await guest.bringToFront();await guest.waitForFunction(()=>!document.hidden);await guest.locator('#screen').focus();await ready(1);
  await move(guest,1,'ArrowRight','x',120,false);await move(guest,1,'ArrowUp','y',70,true);await move(guest,1,'ArrowLeft','x',96,true);
  await guest.keyboard.press('ArrowUp',{delay:50});await equip(guest,1,'mech');await guest.keyboard.press('ArrowLeft',{delay:50});
  assert.equal(await host.evaluate(()=>document.hidden),true);
  const beforeGuest=await host.evaluate(()=>goofGatling.model.terrain.count);
  await guest.keyboard.down('KeyQ');await host.waitForFunction(()=>goofGatling.model.lasers[1]&&goofGatling.model.shots[1]>=2);
  await host.waitForFunction(n=>goofGatling.model.terrain.count>n,beforeGuest);
  await guest.waitForTimeout(350);await guest.locator('#screen').screenshot({path:'test-results/mech-guest-laser.png'});
  await guest.keyboard.up('KeyQ');await host.waitForFunction(()=>!goofGatling.model.lasers[1]);
  assert.deepEqual(await host.evaluate(()=>goofGatling.model.inventory.held),['mech','mech']);assert.deepEqual(errors,[]);
  console.log('PASS: native mech pickups, transformation, piercing terrain/enemy laser, swapping out/back, and remote mech firing with hidden host.');
}catch(error){if(host){console.log('STATE',await host.evaluate(()=>{const m=window.goofGatling;if(!m)return null;const r=EJS_emulator.Module.HEAPU8.subarray(m.base);return {players:[0,1].map(i=>m.model.player(r,i)),held:m.model.inventory.held,bound:[...m.model.inventory.bound],shots:m.model.shots,hits:m.model.hits,pause:r[0xac]};}).catch(()=>null));await host.locator('#screen').screenshot({path:'test-results/mech-failure.png'}).catch(()=>{});}throw error;}finally{await browser.close();}
