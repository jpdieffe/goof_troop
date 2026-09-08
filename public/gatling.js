import {GatlingModel,DIRECTIONS} from './gatling-model.js';

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
  if(rom.length!==0x80000||crc32(rom)!==0x4aafa462)throw Error('The Gatling prototype needs the original Goof Troop (USA) ROM.');
  const art=new Image();art.src=new URL('./assets/gatling.png',import.meta.url).href;await art.decode();
  const base=await findWorkRAM(emulator),model=new GatlingModel();
  const overlay=document.createElement('canvas');overlay.id='gatling-overlay';overlay.width=256;overlay.height=224;overlay.setAttribute('aria-hidden','true');document.getElementById('screen').append(overlay);
  const ctx=overlay.getContext('2d');ctx.imageSmoothingEnabled=false;
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=576;
  const output=canvas.getContext('2d',{alpha:false});output.imageSmoothingEnabled=false;
  // Trim transparent margins at import time; retain the generated PNG unchanged.
  const source=document.createElement('canvas');source.width=art.width;source.height=art.height;
  const sc=source.getContext('2d',{willReadFrequently:true});sc.drawImage(art,0,0);
  const pixels=sc.getImageData(0,0,art.width,art.height).data;let left=art.width,top=art.height,right=0,bottom=0;
  for(let y=0;y<art.height;y++)for(let x=0;x<art.width;x++)if(pixels[(y*art.width+x)*4+3]>128){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
  const sprite=document.createElement('canvas');sprite.width=30;sprite.height=20;
  const sp=sprite.getContext('2d');sp.imageSmoothingEnabled=false;sp.drawImage(art,left,top,right-left+1,bottom-top+1,0,0,30,20);
  let frame=-1,failed=false;
  function gun(x,y,direction,flash=false){
    ctx.save();ctx.translate(Math.round(x),Math.round(y));
    if(direction===3)ctx.scale(-1,1);else if(direction===0)ctx.rotate(-Math.PI/2);else if(direction===2)ctx.rotate(Math.PI/2);
    ctx.drawImage(sprite,-10,-10,27,18);
    if(flash){ctx.fillStyle='#ff9a28';ctx.beginPath();ctx.moveTo(16,-3);ctx.lineTo(24,-7);ctx.lineTo(22,-2);ctx.lineTo(28,0);ctx.lineTo(22,2);ctx.lineTo(24,6);ctx.lineTo(16,3);ctx.fill();ctx.fillStyle='#fff5ad';ctx.fillRect(17,-2,7,3);ctx.fillStyle='#9bebef';ctx.fillRect(8,model.ticks%2?3:-5,7,1);}
    ctx.restore();
  }
  function draw(ram){
    ctx.clearRect(0,0,256,224);
    if(model.active){
      if(model.room===0)for(const pickup of model.pickups){
        ctx.fillStyle='#222a2755';ctx.beginPath();ctx.ellipse(pickup.x,pickup.y+1,13,3,0,0,7);ctx.fill();
        gun(pickup.x,pickup.y-7+(Math.floor(model.ticks/20)%2),1);
        ctx.fillStyle='#fff1a5';ctx.fillRect(pickup.x+13,pickup.y-16,1,5);ctx.fillRect(pickup.x+11,pickup.y-14,5,1);
      }
      for(let i=0;i<2;i++)if(model.equipped[i]){
        const p=model.player(ram,i);if(p.visible)gun(p.x,p.y-p.z-11,p.direction,model.flash[i]>0);
        ctx.fillStyle='#132524dd';ctx.fillRect(i?191:13,28,52,8);ctx.fillStyle=i?'#ffae81':'#d9ef8c';ctx.font='bold 6px monospace';ctx.fillText(`P${i+1} GATLING`,i?194:16,34);
      }
      for(const b of model.bullets){const [dx,dy]=DIRECTIONS[b.direction];ctx.strokeStyle='#cb7430';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x-dx*7,b.y-9-dy*7);ctx.lineTo(b.x,b.y-9);ctx.stroke();ctx.strokeStyle='#fff4ad';ctx.lineWidth=1;ctx.stroke();}
      for(const s of model.sparks){ctx.fillStyle='#fff5aa';for(let i=0;i<4;i++){const [dx,dy]=DIRECTIONS[i];ctx.fillRect(s.x+dx*(9-s.life),s.y+dy*(9-s.life),2,2);}}
      if(model.noticeTime>0&&model.room===0){ctx.fillStyle='#132524dd';ctx.fillRect(14,203,228,12);ctx.fillStyle='#fff1b8';ctx.textAlign='center';ctx.font='7px monospace';ctx.fillText(model.notice,128,211);ctx.textAlign='start';}
    }
    output.drawImage(emulator.canvas,0,0,canvas.width,canvas.height);
    output.drawImage(overlay,0,0,canvas.width,canvas.height);
  }
  function sound(){
    const al=emulator.Module.AL?.currentCtx;if(!al||al.audioCtx.state!=='running')return;
    const ac=al.audioCtx,buffer=ac.createBuffer(1,Math.ceil(ac.sampleRate*.045),ac.sampleRate),data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/(ac.sampleRate*.009))*.16;
    const node=ac.createBufferSource();node.buffer=buffer;node.connect(al.gain);node.onended=()=>node.disconnect();node.start();
  }
  function update(){
    if(failed){output.drawImage(emulator.canvas,0,0,canvas.width,canvas.height);return;}
    try{
      const current=emulator.gameManager.functions.getFrameNum();
      const ram=emulator.Module.HEAPU8.subarray(base,base+0x20000);
      if(current<frame)model.reset();
      if(current!==frame){const shots=model.shots[0]+model.shots[1];model.tick(ram,getMasks());if(model.shots[0]+model.shots[1]>shots)sound();frame=current;}
      draw(ram);
    }catch(error){failed=true;overlay.remove();onError(error);}
  }
  emulator.Module.goofModFrame=update;
  update();
  return {canvas,model,base,stop(){emulator.Module.goofModFrame=undefined;overlay.remove();}};
}
