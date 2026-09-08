import {GatlingModel,DIRECTIONS} from './gatling-model.js';
import {WeaponTerrain} from './weapon-terrain.js';
import {ITEM_USE_BUTTON} from './weapon-inventory.js';

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
  const base=await findWorkRAM(emulator),model=new GatlingModel(new WeaponTerrain(rom));
  const overlay=document.createElement('canvas');overlay.id='gatling-overlay';overlay.width=256;overlay.height=224;overlay.setAttribute('aria-hidden','true');document.getElementById('screen').append(overlay);
  const ctx=overlay.getContext('2d');ctx.imageSmoothingEnabled=false;
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=576;
  const output=canvas.getContext('2d',{alpha:false});output.imageSmoothingEnabled=false;
  // Trim transparent margins at import time; retain the generated PNG unchanged.
  function importSprite(art){const source=document.createElement('canvas');source.width=art.width;source.height=art.height;
  const sc=source.getContext('2d',{willReadFrequently:true});sc.drawImage(art,0,0);
  const pixels=sc.getImageData(0,0,art.width,art.height).data;let left=art.width,top=art.height,right=0,bottom=0;
  for(let y=0;y<art.height;y++)for(let x=0;x<art.width;x++)if(pixels[(y*art.width+x)*4+3]>128){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  const sprite=document.createElement('canvas');sprite.width=30;sprite.height=20;
  const sp=sprite.getContext('2d');sp.imageSmoothingEnabled=false;sp.drawImage(art,left,top,right-left+1,bottom-top+1,0,0,30,20);
  return sprite;}
  const sprites={gatling:importSprite(art),rocket:importSprite(rocketArt)};
  let frame=-1,failed=false;
  function gun(x,y,direction,flash=false,type='gatling'){
    ctx.save();ctx.translate(Math.round(x),Math.round(y));
    if(direction===3)ctx.scale(-1,1);else if(direction===0)ctx.rotate(-Math.PI/2);else if(direction===2)ctx.rotate(Math.PI/2);
    ctx.drawImage(sprites[type],-10,-10,27,18);
    if(flash){ctx.fillStyle='#ff9a28';ctx.beginPath();ctx.moveTo(16,-3);ctx.lineTo(24,-7);ctx.lineTo(22,-2);ctx.lineTo(28,0);ctx.lineTo(22,2);ctx.lineTo(24,6);ctx.lineTo(16,3);ctx.fill();ctx.fillStyle='#fff5ad';ctx.fillRect(17,-2,7,3);ctx.fillStyle='#9bebef';ctx.fillRect(8,model.ticks%2?3:-5,7,1);}
    ctx.restore();
  }
  function draw(ram){
    ctx.clearRect(0,0,256,224);
    if(model.active){
      for(const pickup of model.pickups){
        ctx.fillStyle='#222a2755';ctx.beginPath();ctx.ellipse(pickup.x,pickup.y+1,13,3,0,0,7);ctx.fill();
        gun(pickup.x,pickup.y-5+(Math.floor(model.ticks/20)%2),1,false,pickup.type);
        ctx.fillStyle='#fff1a5';ctx.fillRect(pickup.x+13,pickup.y-16,1,5);ctx.fillRect(pickup.x+11,pickup.y-14,5,1);
      }
      for(let i=0;i<2;i++)if(model.equipped[i]){
        const p=model.player(ram,i),type=model.inventory.held[i];if(p.visible&&model.flash[i]>0)gun(p.x,p.y-p.z-11,p.direction,true,type);
        const x=i?208:40;ctx.fillStyle='#31562b';ctx.fillRect(x,8,16,16);ctx.drawImage(sprites[type],x,11,16,11);
      }
      for(const b of model.bullets){const [dx,dy]=DIRECTIONS[b.direction];ctx.strokeStyle='#cb7430';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x-dx*7,b.y-9-dy*7);ctx.lineTo(b.x,b.y-9);ctx.stroke();ctx.strokeStyle='#fff4ad';ctx.lineWidth=1;ctx.stroke();}
      for(const r of model.rockets){ctx.save();ctx.translate(r.x,r.y-9);ctx.rotate((r.direction-1)*Math.PI/2);ctx.fillStyle='#696d42';ctx.fillRect(-6,-3,11,6);ctx.fillStyle='#f1b75e';ctx.fillRect(4,-2,4,4);ctx.fillStyle='#f05c2b';ctx.fillRect(-11,-2,5,4);ctx.fillStyle='#ffeab0';ctx.fillRect(-9,-1,3,2);ctx.restore();}
      for(const e of model.explosions){const age=24-e.life;for(let n=0;n<8;n++){const a=n*Math.PI/4,spread=Math.min(age*1.4,21);ctx.fillStyle=age<12?'#ed6a28':'#817568aa';ctx.beginPath();ctx.arc(e.x+Math.cos(a)*spread,e.y+Math.sin(a)*spread-age*.3,Math.max(2,11-age*.28),0,Math.PI*2);ctx.fill();}if(age<14){ctx.fillStyle=age<7?'#fff7ba':'#ffbf4f';ctx.beginPath();ctx.arc(e.x,e.y,14-age*.6,0,Math.PI*2);ctx.fill();}}
      for(const s of model.sparks){ctx.fillStyle='#fff5aa';for(let i=0;i<4;i++){const [dx,dy]=DIRECTIONS[i];ctx.fillRect(s.x+dx*(9-s.life),s.y+dy*(9-s.life),2,2);}}
      if(model.noticeTime>0&&model.room===0){ctx.fillStyle='#132524dd';ctx.fillRect(14,203,228,12);ctx.fillStyle='#fff1b8';ctx.textAlign='center';ctx.font='7px monospace';ctx.fillText(model.notice,128,211);ctx.textAlign='start';}
    }
    output.drawImage(emulator.canvas,0,0,canvas.width,canvas.height);
    output.drawImage(overlay,0,0,canvas.width,canvas.height);
  }
  function sound(boom=false){
    const al=emulator.Module.AL?.currentCtx;if(!al||al.audioCtx.state!=='running')return;
    const ac=al.audioCtx,buffer=ac.createBuffer(1,Math.ceil(ac.sampleRate*(boom ? .35 : .045)),ac.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/(ac.sampleRate*(boom ? .07 : .009)))*(boom ? .32 : .16);
    const node=ac.createBufferSource();node.buffer=buffer;node.connect(al.gain);node.onended=()=>node.disconnect();node.start();
  }
  function update(){
    if(failed){output.drawImage(emulator.canvas,0,0,canvas.width,canvas.height);return;}
    try{
      const current=emulator.gameManager.functions.getFrameNum();
      const ram=emulator.Module.HEAPU8.subarray(base,base+0x20000);
      if(current<frame)model.reset();
      if(current!==frame){const shots=model.shots[0]+model.shots[1],booms=model.booms,masks=getMasks();model.tick(ram,masks);if(model.booms>booms)sound(true);else if(model.shots[0]+model.shots[1]>shots)sound();
        for(let i=0;i<2;i++)emulator.gameManager.simulateInput(i,ITEM_USE_BUTTON,model.equipped[i]?0:(masks[i]>>ITEM_USE_BUTTON)&1);
        frame=current;}
      draw(ram);
    }catch(error){failed=true;overlay.remove();onError(error);}
  }
  emulator.Module.goofModFrame=update;
  update();
  return {canvas,model,base,stop(){emulator.Module.goofModFrame=undefined;overlay.remove();}};
}
