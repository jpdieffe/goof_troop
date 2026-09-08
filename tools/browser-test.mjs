import {chromium} from 'playwright';
import {mkdir} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--autoplay-policy=no-user-gesture-required','--use-gl=angle','--use-angle=swiftshader-webgl','--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
await mkdir('test-results',{recursive:true});
const context=await browser.newContext({viewport:{width:1400,height:1100}});
const host=await context.newPage();
host.on('pageerror',e=>console.log('HOST ERROR',e.message));
host.on('console',m=>{if(m.type()==='error')console.log('HOST CONSOLE',m.text().slice(0,300));});
host.on('requestfailed',r=>console.log('REQUEST FAILED',r.url(),r.failure()?.errorText));
try{
  await host.goto('http://localhost:3000');await host.screenshot({path:'test-results/lobby.png',fullPage:true});
  await host.click('#host');
  await host.waitForFunction(()=>window.EJS_emulator?.started,{timeout:120000});
  await host.waitForFunction(()=>document.querySelector('#room-code').textContent.length===12,{timeout:30000});
  const code=await host.locator('#room-code').textContent();console.log('HOST STARTED',code);
  console.log('AUDIO',await host.evaluate(()=>({AL:!!EJS_emulator.Module.AL,canvas:[EJS_emulator.canvas.width,EJS_emulator.canvas.height]})));
  await host.waitForFunction(()=>EJS_emulator.gameManager.functions.getFrameNum()>300,{timeout:30000});
  await host.keyboard.press('Enter',{delay:100});await host.waitForTimeout(1500);
  await host.keyboard.press('Enter',{delay:100});await host.waitForTimeout(1000);
  await host.screenshot({path:'test-results/game.png',fullPage:true});
  console.log('HOST PEAK',await host.evaluate(async()=>{const al=EJS_emulator.Module.AL.currentCtx,a=al.audioCtx.createAnalyser();al.gain.connect(a);let peak=0;const b=new Float32Array(a.fftSize);for(let i=0;i<20;i++){await new Promise(r=>setTimeout(r,100));a.getFloatTimeDomainData(b);for(const n of b)peak=Math.max(peak,Math.abs(n));}try{al.gain.disconnect(a);}catch{}return peak;}));
  const guest=await context.newPage();guest.on('pageerror',e=>console.log('GUEST ERROR',e.message));
  await guest.goto('http://localhost:3000/?room='+code);
  await guest.waitForFunction(()=>document.querySelector('video').videoWidth>0,{timeout:45000});
  console.log('GUEST STREAM',await guest.evaluate(()=>({width:document.querySelector('video').videoWidth,tracks:document.querySelector('video').srcObject.getTracks().map(t=>t.kind)})));
  await guest.click('#sound');
  await guest.waitForFunction(()=>{const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;const ctx=canvas.getContext('2d');ctx.drawImage(document.querySelector('video'),0,0,32,32);return ctx.getImageData(0,0,32,32).data.some((v,i)=>i%4!==3&&v>40);},{timeout:15000});
  const audioPeak=await guest.evaluate(async()=>{const ctx=new AudioContext();await ctx.resume();const source=ctx.createMediaStreamSource(document.querySelector('video').srcObject),analyser=ctx.createAnalyser();source.connect(analyser);const data=new Float32Array(analyser.fftSize);let peak=0;for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,100));analyser.getFloatTimeDomainData(data);for(const n of data)peak=Math.max(peak,Math.abs(n));}source.disconnect();await ctx.close();return peak;});
  if(audioPeak<0.001){console.log('HOST AUDIO DETAILS',await host.evaluate(()=>{const al=EJS_emulator.Module.AL.currentCtx;return {state:al.audioCtx.state,volume:EJS_emulator.volume,muted:EJS_emulator.muted,gain:al.gain?.gain?.value,sources:Object.values(al.sources).map(s=>({state:s.state,gain:s.gain?.gain?.value,queue:s.queue?.length}))};}));throw Error('Guest audio track is silent');}console.log('RENDERED VIDEO AND AUDIO PASSED',audioPeak);
  await host.keyboard.press('Enter',{delay:100});await guest.waitForTimeout(5000);await guest.screenshot({path:'test-results/player-select.png',fullPage:true});
  await host.keyboard.press('ArrowDown',{delay:500});await host.keyboard.press('Enter',{delay:500});await guest.waitForTimeout(5000);await guest.screenshot({path:'test-results/two-player-game.png',fullPage:true});
  await host.evaluate(()=>{window.receivedInputs=[];const gm=EJS_emulator.gameManager,original=gm.simulateInput.bind(gm);gm.simulateInput=(...args)=>{window.receivedInputs.push(args);return original(...args);};});
  await guest.keyboard.down('ArrowRight');await guest.waitForTimeout(300);await guest.keyboard.up('ArrowRight');await guest.waitForTimeout(300);
  const inputs=await host.evaluate(()=>window.receivedInputs);if(!inputs.some(v=>v[0]===1&&v[1]===7&&v[2]===1)||!inputs.some(v=>v[0]===1&&v[1]===7&&v[2]===0))throw Error('Remote controller press/release failed: '+JSON.stringify(inputs));
  console.log('REMOTE INPUT PASSED');await guest.screenshot({path:'test-results/guest.png',fullPage:true});
  await guest.close();await host.waitForFunction(()=>document.querySelector('#room-status').textContent.includes('open again'),{timeout:15000});console.log('DISCONNECT PASSED');
  const replacement=await context.newPage();await replacement.goto('http://localhost:3000/');await replacement.fill('#code',code);await replacement.press('#code','Enter');await replacement.waitForFunction(()=>document.querySelector('video').videoWidth>0,{timeout:30000});
  if(await replacement.evaluate(()=>document.activeElement.id)!=='screen')throw Error('Keyboard join did not focus the game');console.log('KEYBOARD REJOIN PASSED');
}finally{console.log('FINAL STATUS',await host.locator('#status').textContent());await host.screenshot({path:'test-results/final.png',fullPage:true});await browser.close();}



