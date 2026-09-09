import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {realBrowserOptions} from './real-browser.mjs';
const url=process.argv[2]||'http://localhost:3000',rom=process.argv[3]||'Goof Troop.zip';
const browser=await chromium.launch(realBrowserOptions);await mkdir('test-results',{recursive:true});
let host,guest;
async function shot(page,path){const clip=await page.locator('#screen').boundingBox();if(!clip)throw Error('Game screen is missing');await page.screenshot({path,clip});}
async function boot(){
  const context=await browser.newContext({viewport:{width:1400,height:1100}});host=await context.newPage();await host.goto(url);await host.bringToFront();await host.setInputFiles('#rom',rom);await host.click('#host',{force:true});
  await host.waitForFunction(()=>window.goofGatling&&EJS_emulator.gameManager.functions.getFrameNum()>500,null,{timeout:90000});
  await host.bringToFront();await host.waitForFunction(()=>!document.hidden);await host.locator('#screen').focus();
  for(const key of ['Enter','Enter','Enter','ArrowDown','Enter','KeyX','Enter']){if(await host.evaluate(()=>goofGatling.model.choosing))break;await host.keyboard.press(key,{delay:400});await host.waitForTimeout(2000);}
  await host.waitForFunction(()=>goofGatling.model.choosing);return context;
}
const ready=i=>host.waitForFunction(i=>{const r=EJS_emulator.Module.HEAPU8.subarray(goofGatling.base);return !r[0xac]&&goofGatling.model.player(r,i).canAct;},i);
const move=async(page,i,key,axis,value,less)=>{await page.keyboard.down(key);try{await host.waitForFunction(({i,axis,value,less})=>{const p=goofGatling.model.player(EJS_emulator.Module.HEAPU8.subarray(goofGatling.base),i);return less?p[axis]<=value:p[axis]>=value;},{i,axis,value,less},{timeout:10000});}finally{await page.keyboard.up(key);}};
try{
  let context=await boot();await shot(host,'test-results/game-mode-selection.png');
  await host.keyboard.press('Enter',{delay:150});await host.waitForFunction(()=>goofGatling.model.gameMode==='story');await host.waitForTimeout(500);
  const before=await host.evaluate(()=>({frame:EJS_emulator.gameManager.functions.getFrameNum(),x:EJS_emulator.Module.HEAPU8[goofGatling.base+0x111]}));
  await host.keyboard.press('ArrowRight',{delay:400});await host.waitForTimeout(500);
  assert.ok(await host.evaluate(b=>EJS_emulator.gameManager.functions.getFrameNum()>b.frame+20&&EJS_emulator.Module.HEAPU8[goofGatling.base+0x111]>b.x,before));
  assert.deepEqual(await host.evaluate(()=>goofGatling.model.pickups.map(g=>g.type)),['gatling','gatling','rocket','rocket','mech','mech']);
  await host.evaluate(()=>{const r=EJS_emulator.Module.HEAPU8.subarray(goofGatling.base);r[0x111]=64;r[0x114]=132;r[0x147]=4;});
  await ready(0);await host.keyboard.press('KeyX',{delay:150});await host.waitForFunction(()=>goofGatling.model.inventory.held[0]==='gatling');await ready(0);
  await host.keyboard.press('KeyS',{delay:500});assert.ok(await host.evaluate(()=>goofGatling.model.shots[0]>1&&!goofGatling.model.inventory.limited&&!goofGatling.model.zombie));await shot(host,'test-results/normal-story.png');await context.close();console.log('STORY: SIX BEACH WEAPONS, NATIVE PICKUP, UNLIMITED FIRING, CONTROLS RUNNING');

  context=await boot();const errors=[];host.on('pageerror',e=>errors.push(e.message));
  guest=await context.newPage();guest.on('pageerror',e=>errors.push(e.message));await guest.goto(new URL('?room='+await host.locator('#room-code').textContent(),url).href);await guest.bringToFront();await guest.waitForFunction(()=>document.querySelector('video').videoWidth>0,null,{timeout:45000});await shot(guest,'test-results/mode-selection-guest.png');
  await host.bringToFront();await host.locator('#screen').focus();await host.keyboard.press('ArrowDown',{delay:150});await host.keyboard.press('Enter',{delay:150});await host.waitForFunction(()=>goofGatling.model.zombie?.phase==='wave',null,{timeout:20000});
  if(!await host.evaluate(()=>EJS_emulator.Module.HEAPU8[goofGatling.base+0x180])){await guest.bringToFront();await guest.keyboard.press('Enter',{delay:150});await host.waitForFunction(()=>EJS_emulator.Module.HEAPU8[goofGatling.base+0x180]>0);}
  await host.bringToFront();await host.locator('#screen').focus();await ready(0);await shot(host,'test-results/zombie-wave-one.png');
  await move(host,0,'ArrowRight','x',104,false);await host.keyboard.press('ArrowUp',{delay:80});await host.keyboard.press('KeyX',{delay:150});await host.waitForFunction(()=>goofGatling.model.inventory.held[0]==='shield');await ready(0);
  await host.keyboard.press('KeyS',{delay:150});await host.waitForFunction(()=>goofGatling.model.shields[0]>0);assert.equal(await host.evaluate(()=>goofGatling.model.inventory.held[0]),'pistol');
  await host.waitForFunction(()=>[...goofGatling.model.zombie.enemies.values()].some(e=>e.seen&&!e.dead));
  await host.evaluate(()=>{const m=goofGatling.model,r=EJS_emulator.Module.HEAPU8.subarray(goofGatling.base),p=m.player(r,0),[b,e]=[...m.zombie.enemies].find(([b,e])=>e.seen&&!e.dead);r[b+0x11]=p.x+26;r[b+0x14]=p.y;e.x=p.x+26;e.y=p.y;m.zombie.projectiles.push({x:p.x+30,y:p.y,vx:-2,vy:0,owner:-1,life:100});});
  await host.waitForFunction(()=>goofGatling.model.zombie.reflections>0&&goofGatling.model.zombie.bounces>0);await shot(host,'test-results/shield-reflection.png');console.log('SHIELD: NATIVE PICKUP, DEPLOY, BOUNCE, REFLECTION');

  // Exercise new weapons through controller input, using loadout fixtures.
  for(const type of ['sword','sniper','grenade','rocket','gatling','mech']){
    await host.evaluate(type=>{const m=goofGatling.model,r=EJS_emulator.Module.HEAPU8.subarray(goofGatling.base);m.inventory.equip(r,0,type,2);m.cooldown[0]=0;m.shields[0]=600;},type);
    await ready(0);await host.keyboard.press('ArrowRight',{delay:40});const old=await host.evaluate(()=>goofGatling.model.shots[0]);await host.keyboard.press('KeyS',{delay:100});await host.waitForFunction(n=>goofGatling.model.shots[0]>n,old);
    await host.locator('#screen').screenshot({path:`test-results/zombie-${type}.png`});
  }
  console.log('WEAPONS: SWORD, SNIPER, GRENADE, ROCKET, GATLING, MECH');
  // Keep the firing lane fixed for an end-to-end three-wave test. Enemy init,
  // spawning, health, defeat, cleanup, drops and wave progression remain native.
  await host.evaluate(()=>{
    const m=goofGatling.model,r=EJS_emulator.Module.HEAPU8.subarray(goofGatling.base);m.inventory.equip(r,0,'mech',1000);r[0x111]=40;r[0x114]=128;r[0x147]=2;m.cooldown[0]=0;
    const update=EJS_emulator.Module.goofModFrame;EJS_emulator.Module.goofModFrame=()=>{const m=goofGatling.model,r=EJS_emulator.Module.HEAPU8.subarray(goofGatling.base);for(const [b,e]of m.zombie?.enemies||[])if(!e.dead)r[b+0x14]=128;for(const i of [0,1])m.shields[i]=600;update();};
  });
  await host.keyboard.down('KeyS');await host.waitForFunction(()=>goofGatling.model.zombie.phase==='exit',null,{timeout:90000});await host.keyboard.up('KeyS');await shot(host,'test-results/zombie-three-waves-cleared.png');
  assert.ok(await host.evaluate(()=>goofGatling.model.zombie.kills>=18&&goofGatling.model.zombie.drops>=10));console.log('THREE WAVES COMPLETE / RANDOM LOOT DROPPED');
  const dropped=await host.evaluate(()=>{const m=goofGatling.model,r=EJS_emulator.Module.HEAPU8.subarray(goofGatling.base),g=m.inventory.ground.find(g=>g.type&&g.x>120);if(!g)throw Error('No enemy loot ready for pickup');r[0x111]=g.x;r[0x114]=g.y+12;r[0x147]=0;return {type:g.type,ammo:g.ammo,x:g.x,y:g.y};});
  await host.waitForFunction(g=>{const m=goofGatling.model,r=EJS_emulator.Module.HEAPU8.subarray(goofGatling.base);return [...m.inventory.bound].some(([b,p])=>p.x===g.x&&p.y===g.y&&r[b]===1&&r[b+2]===2);},dropped);
  await ready(0);await host.keyboard.press('KeyX',{delay:150});await host.waitForFunction(type=>goofGatling.model.inventory.held[0]===type,dropped.type);await ready(0);
  assert.equal(await host.evaluate(()=>goofGatling.model.inventory.ammo[0]),dropped.ammo);console.log('ENEMY LOOT: NATIVE PICKUP AND AMMO VERIFIED');
  // Remote weapon firing and walking to the right-hand exit with a hidden host.
  await host.evaluate(()=>{const m=goofGatling.model,r=EJS_emulator.Module.HEAPU8.subarray(goofGatling.base);m.inventory.equip(r,1,'sniper',2);r[0x1c7]=2;});
  await guest.bringToFront();await guest.locator('#screen').focus();await ready(1);const guestShots=await host.evaluate(()=>goofGatling.model.shots[1]);await guest.keyboard.press('KeyQ',{delay:150});await host.waitForFunction(n=>goofGatling.model.shots[1]>n,guestShots);assert.equal(await host.evaluate(()=>document.hidden),true);
  // Walk through the real remaining loot without clearing any collision fixture.
  await move(guest,1,'ArrowRight','x',230,false);assert.equal(await host.evaluate(()=>goofGatling.model.zombie.level),1);
  await host.bringToFront();await host.locator('#screen').focus();await host.keyboard.down('ArrowRight');await host.waitForFunction(()=>goofGatling.model.zombie.level===2,null,{timeout:10000});await host.keyboard.up('ArrowRight');await host.waitForFunction(()=>goofGatling.model.zombie.phase==='wave',null,{timeout:20000});await shot(host,'test-results/zombie-level-two.png');
  assert.equal(await host.evaluate(()=>goofGatling.model.zombie.wave),1);assert.deepEqual(errors,[]);console.log('PASS: MODE SELECTION, ORIGINAL STORY, SHIELD, ALL WEAPONS, THREE WAVES, RANDOM DROPS, GUEST FIRE, RIGHT EXIT AND LEVEL TWO');
}catch(error){if(host){console.log('STATE',await host.evaluate(()=>{const m=window.goofGatling;if(!m)return null;const r=EJS_emulator.Module.HEAPU8.subarray(m.base);return {mode:m.model.gameMode,choosing:m.model.choosing,players:[0,1].map(i=>m.model.player(r,i)),held:m.model.inventory.held,freeze:r[0xac],phase:m.model.zombie?.phase,wave:m.model.zombie?.wave,enemies:[...m.model.zombie?.enemies||[]],pending:m.model.terrain?.pending.length};}).catch(()=>null));await shot(host,'test-results/zombie-failure.png').catch(()=>{});}throw error;}finally{await browser.close();}
