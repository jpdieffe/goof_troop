import {KEY_MAP,validState,normalizeCode,validCode,applyMask} from './protocol.js';
import {installFrameClock} from './frame-clock.js';
import {configureHostCore} from './host-core.js';
import {installGatling} from './gatling.js';
const $ = id => document.getElementById(id);
let peer,connection,call,stream,mode,ready=false,remoteMask=0,localMask=0,lastRemote=0,room='',connectionTimer;
const held=new Set(),touchHeld=new Set();
const status = text => $('status').textContent=text;
const prefix='gooftroop-v1-';
// Capture the pinned SNES core's active audio sources, without microphone permission.
let audioDestination;
let stopFrameClock;
let gatling;
function simulate(player,index,value){if(gatling?.model.blocksInput||(index===1&&gatling?.model.equipped[player]))value=0;if(ready)window.EJS_emulator.gameManager.simulateInput(player,index,value);}
function releaseRemote(){applyMask(remoteMask,0,(i,v)=>simulate(1,i,v));remoteMask=0;}
function setBusy(busy){$('gatling-enabled').disabled=busy;$('host').disabled=busy;$('join').disabled=busy;$('rom').disabled=busy;$('code').disabled=busy;$('leave').hidden=!busy;}
function focusGame(){ $('screen').focus({preventScroll:true}); }
function fail(error){status(typeof error==='string'?error:error.message || 'Connection failed.');}
function closeGuest(){releaseRemote();call?.close();call=null;connection?.close();connection=null;if(mode==='host')$('room-status').textContent='Player two left. Your room is open again.';}
function createPeer(id){return new Promise((resolve,reject)=>{
  if(!window.Peer)return reject(Error('Room service could not load. Check your internet connection and reload.'));
  peer=new Peer(id,{debug:1,config:{iceServers:[{urls:'stun:stun.l.google.com:19302'},{urls:'stun:stun.cloudflare.com:3478'}]}});
  const timer=setTimeout(()=>reject(Error('Room service timed out. Reload to retry.')),20000);
  peer.on('open',()=>{clearTimeout(timer);resolve(peer);});
  peer.on('error',e=>{clearTimeout(timer);reject(e);fail(e.type==='peer-unavailable'?'Room not found. Check the code and that your friend is still hosting.':e);});
  peer.on('disconnected',()=>status('Room service disconnected. Reload if your friend cannot join.'));
});}
function capture(){if(stream)return stream;const canvas=gatling?.canvas||window.EJS_emulator.canvas;if(!canvas?.captureStream)throw Error('Game streaming requires a browser with canvas capture support. Try Chrome or Edge.');
  stream=canvas.captureStream(60);
  const audio=window.EJS_emulator.Module.AL?.currentCtx;
  if(audio?.audioCtx){audioDestination=audio.audioCtx.createMediaStreamDestination();audio.gain.connect(audioDestination);for(const track of audioDestination.stream.getAudioTracks())stream.addTrack(track);}
  return stream;
}
function startCall(){if(!ready||!connection?.open||call)return;try{call=peer.call(connection.peer,capture());call.on('error',fail);status('Player two connected. Select your team, then choose Normal story or Zombie mode.');$('room-status').textContent='Player two is here!';}catch(e){fail(e);}}
function bindConnection(conn){connection=conn;lastRemote=performance.now();
  conn.on('data',data=>{
    if(conn!==connection)return;
    lastRemote=performance.now();
    if(mode==='host'&&validState(data)){lastRemote=performance.now();applyMask(remoteMask,data.mask,(i,v)=>simulate(1,i,v));remoteMask=data.mask;}
    if(data?.type==='ping'&&conn.open)conn.send({type:'pong',time:data.time});
    if(data?.type==='pong'&&Number.isFinite(data.time))$('room-status').textContent=`Player two connected · ${Math.round(performance.now()-data.time)} ms round trip`;
    if(data?.type==='full'){fail('This room already has two players.');conn.close();}
  });
  conn.on('close',()=>{if(connection!==conn)return;releaseRemote();connection=null;call?.close();call=null;if(mode==='host'){$('room-status').textContent='Player two left. Your room is open again.';status('Waiting for your friend to reconnect.');}else{ready=false;fail('Disconnected from host. Reload to join again.');}});
  conn.on('error',fail);
}
async function loadGame(){let rom=$('rom').files[0];if(!rom){const response=await fetch('local-rom.zip');if(!response.ok)throw Error('Choose your ROM file before hosting.');rom=await response.blob();}
  if(!document.createElement('canvas').getContext('webgl'))throw Error('WebGL graphics are unavailable. Enable browser graphics acceleration and reload.');
  stopFrameClock=installFrameClock(()=>stream?.getVideoTracks()[0]?.requestFrame?.());
  $('placeholder').hidden=true;$('game').hidden=false;
  Object.assign(window,{EJS_player:'#game',EJS_core:'snes',EJS_gameUrl:URL.createObjectURL(rom),EJS_gameName:'Goof Troop',EJS_pathtodata:'https://cdn.emulatorjs.org/4.2.3/data/',EJS_startOnLoaded:false,EJS_color:'#d9ef8c',EJS_threads:false,EJS_forceLegacyCores:true,EJS_disableDatabases:true,EJS_Buttons:{exitEmulation:false,netplay:false},EJS_ready:()=>{
    const emulator=window.EJS_emulator;
    configureHostCore(emulator);
    // Install the patch before loading even a cached core, then start as usual.
    $('game').querySelector('.ejs_start_button').click();
  },EJS_onGameStart:async()=>{
    if(window.EJS_emulator.failedToStart)return fail('The emulator could not start. Reload and check browser graphics support.');
    if($('gatling-enabled').checked){try{gatling=await installGatling(window.EJS_emulator,()=>[localMask,remoteMask],error=>fail('Weapon mod stopped: '+error.message));window.goofGatling=gatling;}catch(error){$('mod-note').textContent=error.message+' Playing without the mod.';}}
    ready=true;window.EJS_emulator.keyChange=()=>{};window.EJS_emulator.gamepadEvent=()=>{};focusGame();
    status('Game ready. Choose GAME, skip the intro with Enter, then select your team and game mode.');startCall();
  }});
  const loader=document.createElement('script');loader.src=window.EJS_pathtodata+'loader.js';loader.onerror=()=>fail('Emulator download failed. Check your connection and reload.');document.body.append(loader);
  setTimeout(()=>{if(!ready)status('Still loading? Check the game panel for an error or Play button. Reload to retry.');},45000);
}
$('host').onclick=async()=>{try{mode='host';setBusy(true);status('Loading game and creating room…');const alphabet='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';room=Array.from(crypto.getRandomValues(new Uint8Array(12)),n=>alphabet[n%32]).join('');await loadGame();await createPeer(prefix+room);
  $('room-code').textContent=room;$('room-panel').hidden=false;$('role').textContent='YOU ARE PLAYER 1';
  peer.on('connection',conn=>{if(connection){conn.on('open',()=>{conn.send({type:'full'});setTimeout(()=>conn.close(),250);});return;}bindConnection(conn);conn.on('open',startCall);});
}catch(e){fail(e);peer?.destroy();$('leave').hidden=false;}};
async function joinRoom(value){if(mode)return;room=normalizeCode(value);if(!validCode(room))return fail('Enter the 12-character room code from your friend.');try{mode='guest';setBusy(true);focusGame();status('Connecting directly to your friend…');await createPeer();
  peer.on('call',incoming=>{if(incoming.peer!==prefix+room || call){incoming.close();return;}call=incoming;incoming.on('stream',media=>{clearTimeout(connectionTimer);$('placeholder').hidden=true;$('remote').hidden=false;if($('remote').srcObject!==media){$('remote').srcObject=media;$('remote').muted=true;$('remote').play().catch(e=>{if(e.name!=='AbortError')fail(e);});$('sound').hidden=false;}if(!ready)focusGame();ready=true;status('Connected as player two. Use the arrow keys to move. Enable sound when ready.');});incoming.on('error',fail);incoming.answer();});
  const conn=peer.connect(prefix+room,{reliable:true});bindConnection(conn);conn.on('open',()=>{$('role').textContent='YOU ARE PLAYER 2';status('Connected. Waiting for the host’s game…');});
  connectionTimer=setTimeout(()=>{if(!ready)fail('No video yet. The host must start the game. If it is running, your networks may block direct WebRTC; try another network.');},25000);
}catch(e){fail(e);}}
$('join-form').onsubmit=event=>{event.preventDefault();joinRoom($('code').value);};
async function copy(text){try{await navigator.clipboard.writeText(text);status('Copied. Send it to your friend.');}catch{status('Copy is unavailable. Select and copy the room code above.');}}
$('copy').onclick=()=>copy(room);$('copy-link').onclick=()=>copy(new URL('?room='+room,location.href).href);
$('leave').onclick=()=>{closeGuest();peer?.destroy();stream?.getTracks().forEach(t=>t.stop());location.href=location.pathname;};
$('sound').onclick=async()=>{try{$('remote').muted=false;await $('remote').play();$('sound').hidden=true;focusGame();}catch(e){fail(e);}};
$('screen').tabIndex=0;
$('remote').addEventListener('pointerdown',focusGame);
$('fullscreen').onclick=()=>{$('screen').requestFullscreen?.().catch(fail);};
function releaseLocal(){held.clear();touchHeld.clear();applyMask(localMask,0,(i,v)=>{if(mode==='host')simulate(0,i,v);});localMask=0;if(mode==='guest'&&connection?.open)connection.send({type:'input',mask:0});}
window.addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(KEY_MAP[e.code]!==undefined&&mode){e.preventDefault();e.stopImmediatePropagation();held.add(e.code);}},true);
window.addEventListener('keyup',e=>{held.delete(e.code);if(KEY_MAP[e.code]!==undefined&&mode&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener('blur',releaseLocal);document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseLocal();});
window.addEventListener('pagehide',()=>{releaseLocal();peer?.destroy();stopFrameClock?.();});
const buttons=[['↑',4],['←',6],['↓',5],['→',7],['A',8],['B',0],['X',9],['Y',1],['Fire',10],['Start',3],['Select',2]];
for(const [label,index] of buttons){const b=document.createElement('button');b.textContent=label;b.setAttribute('aria-label',`Controller ${label}`);b.onpointerdown=e=>{e.preventDefault();b.setPointerCapture(e.pointerId);touchHeld.add(index);};for(const event of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(event,()=>touchHeld.delete(index));$('touch').append(b);}
function frame(){let mask=0;if(ready&&!document.hidden){for(const code of held)mask|=1<<KEY_MAP[code];for(const i of touchHeld)mask|=1<<i;
  const pad=Array.from(navigator.getGamepads?.()||[]).find(p=>p?.mapping==='standard');if(pad){const map={0:0,1:8,2:1,3:9,4:10,5:11,8:2,9:3,12:4,13:5,14:6,15:7};for(const [b,i]of Object.entries(map))if(pad.buttons[b]?.pressed)mask|=1<<i;if(pad.axes[0]<-.5)mask|=1<<6;if(pad.axes[0]>.5)mask|=1<<7;if(pad.axes[1]<-.5)mask|=1<<4;if(pad.axes[1]>.5)mask|=1<<5;}}
  if(mask!==localMask){if(mode==='host')applyMask(localMask,mask,(i,v)=>simulate(0,i,v));if(mode==='guest'&&connection?.open)connection.send({type:'input',mask});localMask=mask;}requestAnimationFrame(frame);}
requestAnimationFrame(frame);
setInterval(()=>{if(mode==='guest'&&connection?.open)connection.send({type:'input',mask:localMask});if(mode==='host'&&remoteMask&&performance.now()-lastRemote>1500)releaseRemote();if(connection&&performance.now()-lastRemote>10000){connection.close();}},250);
setInterval(()=>{if(mode==='host'&&connection?.open)connection.send({type:'ping',time:performance.now()});},2000);
const invited=new URLSearchParams(location.search).get('room');if(invited){$('code').value=normalizeCode(invited);joinRoom(invited);}
fetch('local-rom.zip',{method:'HEAD'}).then(r=>{if(r.ok)$('rom-note').textContent='Your folder’s Goof Troop.zip is ready. Or choose another file.';}).catch(()=>{});



