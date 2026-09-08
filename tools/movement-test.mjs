import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {realBrowserOptions} from './real-browser.mjs';
const browser=await chromium.launch(realBrowserOptions);
const context=await browser.newContext();
const base=new URL(process.argv[2] || 'http://localhost:3000/').href;
const romPath=process.argv[3];
await mkdir('test-results',{recursive:true});
async function videoPixels(page,rect){return page.evaluate(([x,y,w,h])=>{
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=224;
 const ctx=canvas.getContext('2d');ctx.drawImage(document.querySelector('video'),0,0,256,224);
 return Array.from(ctx.getImageData(x,y,w,h).data);
},rect);}
function difference(a,b){return a.reduce((sum,value,index)=>sum+(index%4===3?0:Math.abs(value-b[index])),0)/a.length;}
try{
 const host=await context.newPage();await host.goto(base);await host.bringToFront();if(romPath)await host.setInputFiles('#rom',romPath);await host.click('#host',{force:true});
 await host.waitForFunction(()=>window.EJS_emulator?.gameManager?.functions.getFrameNum()>500,{timeout:90000});
 for(const key of ['Enter','Enter','Enter','ArrowDown','Enter','KeyX','Enter']){await host.keyboard.press(key,{delay:500});await host.waitForTimeout(2500);}
 const code=await host.locator('#room-code').textContent();
 const guest=await context.newPage();await guest.goto(new URL('?room='+code,base).href);await guest.bringToFront();
 await guest.waitForFunction(()=>document.querySelector('video').videoWidth>0,{timeout:45000});
 assert.equal(await guest.evaluate(()=>document.activeElement.id),'screen');
 assert.equal(await guest.locator('#join').isDisabled(),true);
 assert.equal(await host.evaluate(()=>document.hidden),true,'Host must really be hidden, not focus-emulated');
 console.log('INVITE AUTOJOIN PASSED');
 await guest.waitForTimeout(2000);
 const framesBefore=await host.evaluate(()=>EJS_emulator.gameManager.functions.getFrameNum());
 const decodedBefore=await guest.evaluate(()=>document.querySelector('video').getVideoPlaybackQuality().totalVideoFrames);
 const oceanBefore=await videoPixels(guest,[20,180,200,40]);
 await guest.waitForTimeout(3000);
 const frameDelta=await host.evaluate(()=>EJS_emulator.gameManager.functions.getFrameNum())-framesBefore;
 const decodedDelta=await guest.evaluate(()=>document.querySelector('video').getVideoPlaybackQuality().totalVideoFrames)-decodedBefore;
 assert.ok(frameDelta>90&&frameDelta<270,`Hidden host must run at normal speed: ${frameDelta} frames/3s`);
 assert.ok(decodedDelta>30,`Guest video must keep advancing: ${decodedDelta}`);
 assert.ok(difference(oceanBefore,await videoPixels(guest,[20,180,200,40]))>2,'Ocean must animate while host is hidden');
 console.log('HIDDEN HOST AND ANIMATED OCEAN PASSED', {frameDelta,decodedDelta});
 const playerOneBefore=await videoPixels(guest,[54,94,21,40]);
 const playerTwoBefore=await videoPixels(guest,[86,102,23,33]);
 await guest.locator('#remote').screenshot({path:'test-results/movement-before.png'});
 await guest.keyboard.down('ArrowRight');await guest.waitForTimeout(900);await guest.keyboard.up('ArrowRight');await guest.waitForTimeout(1500);
 await guest.locator('#remote').screenshot({path:'test-results/movement-after.png'});
 const playerOneDiff=difference(playerOneBefore,await videoPixels(guest,[54,94,21,40]));
 const playerTwoDiff=difference(playerTwoBefore,await videoPixels(guest,[86,102,23,33]));
 assert.ok(playerTwoDiff>8,`Player two must leave their starting position: ${playerTwoDiff}`);
 assert.ok(playerOneDiff<8,`Player one must remain still: ${playerOneDiff}`);
 console.log('PLAYER TWO MOVEMENT PASSED',{playerOneDiff,playerTwoDiff});
 await guest.click('#sound');
 const audioPeak=await guest.evaluate(async()=>{const ctx=new AudioContext();await ctx.resume();const source=ctx.createMediaStreamSource(document.querySelector('video').srcObject),analyser=ctx.createAnalyser();source.connect(analyser);let peak=0;const samples=new Float32Array(analyser.fftSize);for(let i=0;i<20;i++){await new Promise(resolve=>setTimeout(resolve,100));analyser.getFloatTimeDomainData(samples);for(const value of samples)peak=Math.max(peak,Math.abs(value));}source.disconnect();await ctx.close();return peak;});
 assert.ok(audioPeak>0.001,`Hidden host must keep streaming sound: ${audioPeak}`);
 console.log('BACKGROUND AUDIO PASSED',audioPeak);
 await guest.close();await host.waitForFunction(()=>document.querySelector('#room-status').textContent.includes('open again'),{timeout:15000});
 const manual=await context.newPage();await manual.goto(base);await manual.fill('#code',code);await manual.press('#code','Enter');
 await manual.waitForFunction(()=>document.querySelector('video').videoWidth>0,{timeout:45000});
 assert.equal(await manual.evaluate(()=>document.activeElement.id),'screen');
 await manual.keyboard.down('ArrowLeft');await manual.waitForTimeout(700);await manual.keyboard.up('ArrowLeft');await manual.waitForTimeout(1500);
 await manual.locator('#remote').screenshot({path:'test-results/movement-keyboard-join.png'});
 console.log('KEYBOARD JOIN FOCUS PASSED; movement screenshots saved');
}finally{await browser.close();}
