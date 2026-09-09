import {DIRECTIONS} from './gatling-model.js';
import {WeaponTerrain} from './weapon-terrain.js';
import {ITEM_USE_BUTTON} from './weapon-inventory.js';
import {GameSession} from './game-session.js';
import {WEAPONS,SHIELD_TIME} from './weapons.js';

export function crc32(bytes){let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}

export async function findWorkRAM(emulator){
  const gm=emulator.gameManager,signature=[71,65,84,76,73,78,71,167];
  // Snes9x's PAR interface provides a temporary address-to-heap handshake.
  // No fixed WASM pointer: locate the marker, then remove all startup probes.
  // This is unused high WRAM in the verified USA ROM, not executable memory.
  try{
    signature.forEach((value,i)=>gm.setCheat(i,true,(0x7ffff0+i).toString(16)+value.toString(16).padStart(2,'0')));
    await new Promise(resolve=>setTimeout(resolve,100));
    const heap=emulator.Module.HEAPU8,matches=[];
    for(let i=0x1fff0;i<heap.length-8;i++){
      if(heap[i]===signature[0]&&signature.every((v,j)=>heap[i+j]===v))matches.push(i-0x1fff0);
    }
    if(matches.length!==1||matches[0]+0x20000>heap.length)throw Error('Cannot locate SNES work RAM.');
    return matches[0];
  }finally{gm.resetCheat();}
}

export async function installGatling(emulator,getMasks,onError){
  let rom=emulator.Module.FS.readFile(emulator.fileName);
  if(rom.length===0x80200)rom=rom.subarray(512);
  if(rom.length!==0x80000||crc32(rom)!==0x4aafa462)throw Error('The weapon mod needs the original Goof Troop (USA) ROM.');
  const art=new Image();art.src=new URL('./assets/gatling.png',import.meta.url).href;await art.decode();
  const rocketArt=new Image();rocketArt.src=new URL('./assets/rocket.png',import.meta.url).href;await rocketArt.decode();
  const mechArt=new Image();mechArt.src=new URL('./assets/mech.png',import.meta.url).href;await mechArt.decode();
  const itemArt=new Image();itemArt.src=new URL('./assets/zombie-items.png',import.meta.url).href;await itemArt.decode();
  const base=await findWorkRAM(emulator),model=new GameSession(new WeaponTerrain(rom));
  const overlay=document.createElement('canvas');overlay.id='gatling-overlay';overlay.width=256;overlay.height=224;overlay.setAttribute('aria-hidden','true');document.getElementById('screen').append(overlay);
  const ctx=overlay.getContext('2d');ctx.imageSmoothingEnabled=false;
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=576;
  const output=canvas.getContext('2d',{alpha:false});output.imageSmoothingEnabled=false;
  const menu=document.createElement('div');menu.className='mode-menu';menu.hidden=true;menu.setAttribute('role','group');menu.setAttribute('aria-label','Choose game mode');
  for(const [mode,label]of [['story','Normal story'],['zombie','Zombie mode']]){const button=document.createElement('button');button.textContent=label;button.onclick=()=>model.choose(mode);button.onfocus=button.onpointerenter=()=>{model.selection=mode==='zombie'?1:0;};menu.append(button);}
  document.getElementById('screen').append(menu);
  // Trim transparent margins at import time; retain the generated PNG unchanged.
  function importSprite(art,width=30,height=20,cell=0,cells=1,end=(cell+1)/cells,fit=false){const source=document.createElement('canvas');const start=cell/cells;source.width=Math.floor(art.width*(end-start));source.height=art.height;
  const sc=source.getContext('2d',{willReadFrequently:true});sc.drawImage(art,start*art.width,0,source.width,source.height,0,0,source.width,source.height);
  const pixels=sc.getImageData(0,0,source.width,source.height).data;let left=source.width,top=source.height,right=0,bottom=0;
  for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++)if(pixels[(y*source.width+x)*4+3]>128){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  const sprite=document.createElement('canvas');sprite.width=width;sprite.height=height;
  const sp=sprite.getContext('2d');sp.imageSmoothingEnabled=false;const scale=Math.min(width/(right-left+1),height/(bottom-top+1)),w=fit?Math.round((right-left+1)*scale):width,h=fit?Math.round((bottom-top+1)*scale):height;sp.drawImage(source,left,top,right-left+1,bottom-top+1,Math.floor((width-w)/2),Math.floor((height-h)/2),w,h);
  return sprite;}
  const mechViews=[0,1,2].map(cell=>importSprite(mechArt,44,48,cell,3));
  const sprites={gatling:importSprite(art),rocket:importSprite(rocketArt),mech:mechViews[0]};
  for(const [type,start,end]of [['pistol',0,.19],['sniper',.19,.49],['grenade',.49,.63],['sword',.63,.82],['shield',.82,1]])sprites[type]=importSprite(itemArt,30,20,start,1,end,true);
  let frame=-1,failed=false,blocked=false;
  function gun(x,y,direction,flash=false,type='gatling'){
    if(type==='mech'){
      ctx.fillStyle='#122e49';ctx.fillRect(x-10,y-12,20,22);ctx.strokeStyle='#68f7ff';ctx.lineWidth=1;ctx.strokeRect(x-10.5,y-12.5,21,23);
      ctx.drawImage(sprites.mech,x-8,y-11,16,18);ctx.fillStyle='#ffe38a';ctx.fillRect(x-5,y+8,10,2);return;
    }
    ctx.save();ctx.translate(Math.round(x),Math.round(y));
    if(direction===3)ctx.scale(-1,1);else if(direction===0)ctx.rotate(-Math.PI/2);else if(direction===2)ctx.rotate(Math.PI/2);
    ctx.drawImage(sprites[type],-10,-10,27,18);
    if(flash){ctx.fillStyle='#ff9a28';ctx.beginPath();ctx.moveTo(16,-3);ctx.lineTo(24,-7);ctx.lineTo(22,-2);ctx.lineTo(28,0);ctx.lineTo(22,2);ctx.lineTo(24,6);ctx.lineTo(16,3);ctx.fill();ctx.fillStyle='#fff5ad';ctx.fillRect(17,-2,7,3);ctx.fillStyle='#9bebef';ctx.fillRect(8,model.ticks%2?3:-5,7,1);}
    ctx.restore();
  }
  const lastPosition=[null,null];
  function robot(p,i){
    const moving=lastPosition[i]&&(lastPosition[i].x!==p.x||lastPosition[i].y!==p.y);lastPosition[i]={x:p.x,y:p.y};
    const bob=moving?Math.floor(model.ticks/5)%2:0,y=p.y-p.z+3-bob;
    ctx.fillStyle='#102e4666';ctx.beginPath();ctx.ellipse(p.x,p.y+3,20,5,0,0,7);ctx.fill();
    if(model.transform[i]>0){ctx.strokeStyle=i?'#ffe18d':'#8ffbff';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,y-18,26+(30-model.transform[i])*.4,26,0,0,7);ctx.stroke();}
    ctx.save();ctx.translate(Math.round(p.x),Math.round(y));
    // The sprite covers the original adventurer; its opaque central armor also
    // occludes the character between the generated robot's legs and arms.
    ctx.fillStyle='#102440';ctx.fillRect(-8,-33,16,32);
    if(p.direction===1)ctx.scale(-1,1); // Generated side view faces left.
    ctx.drawImage(mechViews[p.direction===0?2:p.direction===2?0:1],-22,-48);
    ctx.restore();
    ctx.fillStyle=i?'#ffd584':'#9ffbff';ctx.fillRect(p.x-3,y-41,6,2);
  }
  function laser(beam){
    const [dx,dy]=DIRECTIONS[beam.direction],x=beam.x,y=beam.y-22;
    const ex=dx>0?255:dx<0?0:x,ey=dy>0?224:dy<0?25:y;
    ctx.save();ctx.beginPath();ctx.rect(0,25,256,199);ctx.clip();
    const colors=beam.owner?['#ec802b66','#ffc665','#fff1b2','#ffffff']:['#00bfe966','#38eaff','#b7ffff','#ffffff'];
    [22,14+(model.ticks%3),8,3].forEach((width,i)=>{ctx.strokeStyle=colors[i];ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.stroke();});
    ctx.fillStyle='#efffff';ctx.beginPath();ctx.arc(x,y,10+(model.ticks%3),0,7);ctx.fill();
    ctx.strokeStyle=colors[1];ctx.lineWidth=1;
    for(let n=0;n<5;n++){const t=((model.ticks*9+n*43)%256)/256,px=x+(ex-x)*t,py=y+(ey-y)*t;ctx.beginPath();ctx.moveTo(px-dy*13,py+dx*13);ctx.lineTo(px+dy*13,py-dx*13);ctx.stroke();}
    ctx.restore();
  }
  function draw(ram){
    ctx.clearRect(0,0,256,224);
    menu.hidden=!model.choosing;
    if(model.active){
      for(const pickup of model.pickups){
        ctx.fillStyle='#222a2755';ctx.beginPath();ctx.ellipse(pickup.x,pickup.y+1,13,3,0,0,7);ctx.fill();
        gun(pickup.x,pickup.y-5+(Math.floor(model.ticks/20)%2),1,false,pickup.type);
        ctx.fillStyle='#fff1a5';ctx.fillRect(pickup.x+13,pickup.y-16,1,5);ctx.fillRect(pickup.x+11,pickup.y-14,5,1);
      }
      for(let i=0;i<2;i++)if(model.equipped[i]){
        const p=model.player(ram,i),type=model.inventory.held[i];if(type!=='mech'&&p.visible&&model.flash[i]>0)gun(p.x,p.y-p.z-11,p.direction,true,type);
        const x=i?208:40;ctx.fillStyle='#31562b';ctx.fillRect(x,8,16,16);ctx.drawImage(sprites[type],x,type==='mech'?8:11,16,type==='mech'?16:11);
      }
      for(const beam of model.lasers)if(beam&&beam.direction!==2)laser(beam);
      for(const i of [0,1].sort((a,b)=>model.player(ram,a).y-model.player(ram,b).y))if(model.inventory.held[i]==='mech'){const p=model.player(ram,i);if(p.visible)robot(p,i);}
      // Downward fire points toward the viewer, so it belongs in front of the suit.
      for(const beam of model.lasers)if(beam?.direction===2)laser(beam);
      for(const b of model.bullets){const [dx,dy]=DIRECTIONS[b.direction];ctx.strokeStyle='#cb7430';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x-dx*7,b.y-9-dy*7);ctx.lineTo(b.x,b.y-9);ctx.stroke();ctx.strokeStyle='#fff4ad';ctx.lineWidth=1;ctx.stroke();}
      for(const r of model.rockets){ctx.save();ctx.translate(r.x,r.y-9);ctx.rotate((r.direction-1)*Math.PI/2);ctx.fillStyle='#696d42';ctx.fillRect(-6,-3,11,6);ctx.fillStyle='#f1b75e';ctx.fillRect(4,-2,4,4);ctx.fillStyle='#f05c2b';ctx.fillRect(-11,-2,5,4);ctx.fillStyle='#ffeab0';ctx.fillRect(-9,-1,3,2);ctx.restore();}
      for(const g of model.grenades||[]){const z=Math.sin(Math.min(1,g.age/45)*Math.PI)*25;ctx.fillStyle='#18312b66';ctx.fillRect(g.x-3,g.y,6,2);ctx.drawImage(sprites.grenade,g.x-6,g.y-9-z,12,8);}
      for(const s of model.slashes||[]){const angle=(s.direction-1)*Math.PI/2,progress=(12-s.life)/12;ctx.save();ctx.translate(s.x,s.y);ctx.rotate(angle);ctx.strokeStyle='#b9fcff';ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,29,-1+progress*.7,.5+progress*.7);ctx.stroke();ctx.strokeStyle='#ffffff';ctx.lineWidth=2;ctx.stroke();ctx.restore();}
      for(let i=0;i<2;i++)if(model.shields[i]>0){const p=model.player(ram,i);ctx.strokeStyle=i?'#ffe29c':'#9bfbff';ctx.fillStyle='#39d5fc22';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y-13,30,34,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#102e46';ctx.fillRect(p.x-16,p.y+24,32,3);ctx.fillStyle='#8cf6ff';ctx.fillRect(p.x-16,p.y+24,32*model.shields[i]/SHIELD_TIME,3);}
      for(const q of model.zombie?.projectiles||[]){ctx.fillStyle=q.owner<0?'#a7ed57':'#a9faff';ctx.beginPath();ctx.arc(q.x,q.y-9,q.owner<0?3:4,0,7);ctx.fill();ctx.fillStyle='#fff6c4';ctx.fillRect(q.x-1,q.y-10,2,2);}
      for(const e of model.explosions){const age=24-e.life;for(let n=0;n<8;n++){const a=n*Math.PI/4,spread=Math.min(age*1.4,21);ctx.fillStyle=age<12?'#ed6a28':'#817568aa';ctx.beginPath();ctx.arc(e.x+Math.cos(a)*spread,e.y+Math.sin(a)*spread-age*.3,Math.max(2,11-age*.28),0,Math.PI*2);ctx.fill();}if(age<14){ctx.fillStyle=age<7?'#fff7ba':'#ffbf4f';ctx.beginPath();ctx.arc(e.x,e.y,14-age*.6,0,Math.PI*2);ctx.fill();}}
      for(const s of model.sparks){ctx.fillStyle='#fff5aa';for(let i=0;i<4;i++){const [dx,dy]=DIRECTIONS[i];ctx.fillRect(s.x+dx*(9-s.life),s.y+dy*(9-s.life),2,2);}}
      if(model.noticeTime>0&&model.room===0){ctx.fillStyle='#132524dd';ctx.fillRect(14,203,228,12);ctx.fillStyle='#fff1b8';ctx.textAlign='center';ctx.font='7px monospace';ctx.fillText(model.notice,128,211);ctx.textAlign='start';}
      if(model.zombie){
        const z=model.zombie;ctx.fillStyle='#10262b';ctx.fillRect(0,0,256,27);ctx.fillRect(0,195,256,29);ctx.font='7px monospace';ctx.textAlign='left';
        for(let i=0;i<2;i++){if(!ram[0x100+i*0x80])continue;const x=i?136:8,type=model.inventory.held[i],ammo=model.inventory.ammo[i];ctx.fillStyle=i?'#ffe39b':'#a4f8ff';ctx.fillText(`P${i+1} ${WEAPONS[type]?.label||'ITEM'}`,x,9);ctx.fillText(`x${ram[0x157+i*0x80]}`,x+102,9);if(sprites[type])ctx.drawImage(sprites[type],x,11,20,14);ctx.fillText(ammo===Infinity?'UNLIMITED':`${ammo??0} LEFT`,x+24,21);}
        ctx.textAlign='center';ctx.fillStyle='#d4f68b';ctx.fillText(`ZOMBIE / LEVEL ${z.level} / WAVE ${z.wave||1} OF 3`,128,205);
        ctx.fillStyle='#fff0bd';ctx.fillText(z.phase==='exit'?'ALL PLAYERS: WALK RIGHT ->':z.phase==='preparing'?'PREPARING THE NEXT ARENA...':z.phase==='break'?'WAVE CLEAR - COLLECT YOUR DROPS':`${z.remaining+[...z.enemies.values()].filter(e=>!e.dead).length} ENEMIES LEFT  /  X PICK UP  S FIRE`,128,217);
        if(z.phase==='exit'){ctx.fillStyle='#c9f984';ctx.font='15px monospace';ctx.fillText('>',241,130);}
        ctx.textAlign='left';
      }
    }
    if(model.choosing){ctx.fillStyle='#10262e';ctx.fillRect(0,0,256,224);ctx.fillStyle='#bce880';ctx.textAlign='center';ctx.font='9px monospace';ctx.fillText('GOOF TROOP / PLAY TOGETHER',128,31);ctx.fillStyle='#ffffff';ctx.font='16px monospace';ctx.fillText('CHOOSE YOUR GAME',128,62);
      ['NORMAL STORY','ZOMBIE MODE'].forEach((label,i)=>{ctx.fillStyle=model.selection===i?'#d4ee99':'#22444c';ctx.fillRect(27,82+i*47,202,39);ctx.fillStyle=model.selection===i?'#18323b':'#d8ebdc';ctx.font='11px monospace';ctx.fillText(label,128,100+i*47);ctx.font='7px monospace';ctx.fillText(i?'3 waves. Random loot. Keep moving.':'Story adventure + beach weapons.',128,112+i*47);});ctx.fillStyle='#a9cbc7';ctx.font='8px monospace';ctx.fillText('HOST: UP/DOWN + ENTER',128,196);ctx.textAlign='left';}
    output.drawImage(emulator.canvas,0,0,canvas.width,canvas.height);
    output.drawImage(overlay,0,0,canvas.width,canvas.height);
  }
  function sound(boom=false){
    const al=emulator.Module.AL?.currentCtx;if(!al||al.audioCtx.state!=='running')return;
    const ac=al.audioCtx,buffer=ac.createBuffer(1,Math.ceil(ac.sampleRate*(boom ? .35 : .045)),ac.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/(ac.sampleRate*(boom ? .07 : .009)))*(boom ? .32 : .16);
    const node=ac.createBufferSource();node.buffer=buffer;node.connect(al.gain);node.onended=()=>node.disconnect();node.start();
  }
  function laserSound(){
    const al=emulator.Module.AL?.currentCtx;if(!al||al.audioCtx.state!=='running')return;
    const ac=al.audioCtx,gain=ac.createGain(),osc=ac.createOscillator(),now=ac.currentTime;
    osc.type='sawtooth';osc.frequency.setValueAtTime(145,now);osc.frequency.exponentialRampToValueAtTime(65,now+.11);
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.075,now+.008);gain.gain.exponentialRampToValueAtTime(.001,now+.12);
    osc.connect(gain);gain.connect(al.gain);osc.onended=()=>{osc.disconnect();gain.disconnect();};osc.start();osc.stop(now+.13);
  }
  function update(){
    if(failed){output.drawImage(emulator.canvas,0,0,canvas.width,canvas.height);return;}
    try{
      const current=emulator.gameManager.functions.getFrameNum();
      const ram=emulator.Module.HEAPU8.subarray(base,base+0x20000);
      if(current<frame)model.reset();
      if(current!==frame){const shots=model.shots[0]+model.shots[1],booms=model.booms,masks=getMasks();model.tick(ram,masks);if(model.booms>booms)sound(true);else if(model.shots[0]+model.shots[1]>shots){if(model.lasers.some(Boolean))laserSound();else sound();}
        for(let i=0;i<2;i++)if(model.blocksInput){for(let button=0;button<12;button++)emulator.gameManager.simulateInput(i,button,0);}else{
          if(blocked)for(let button=0;button<12;button++)emulator.gameManager.simulateInput(i,button,button===ITEM_USE_BUTTON&&model.equipped[i]?0:(masks[i]>>button)&1);
          else emulator.gameManager.simulateInput(i,ITEM_USE_BUTTON,model.equipped[i]?0:(masks[i]>>ITEM_USE_BUTTON)&1);
        }
        blocked=model.blocksInput;
        frame=current;}
      draw(ram);
    }catch(error){failed=true;overlay.remove();onError(error);}
  }
  emulator.Module.goofModFrame=update;
  update();
  return {canvas,model,base,stop(){emulator.Module.goofModFrame=undefined;overlay.remove();menu.remove();}};
}
