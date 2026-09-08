// Compatibility patch for EmulatorJS 4.2.3's Snes9x Emscripten glue.
// The original code stops both the native video loop and OpenAL scheduling
// when its document is hidden. A streaming host must keep both active.
// Leave document visibility itself untouched so local held keys still release.
export function patchHostCore(source){
  const audioGuard='if(MainLoop.timingMode===1&&document["visibilityState"]!="visible"){return}';
  const videoCallback='_platform_emscripten_update_window_hidden_cb(document.visibilityState=="hidden")';
  if(source.split(audioGuard).length!==3 || source.split(videoCallback).length!==2){
    throw new Error('The emulator core changed and its background-play patch could not be applied.');
  }
  const frame='MainLoop.runIter(iterFunc);';
  if(source.split(frame).length!==2)throw new Error('The emulator frame hook changed.');
  return source.replaceAll(audioGuard,'').replace(videoCallback,'_platform_emscripten_update_window_hidden_cb(false)')
    .replace(frame,frame+'Module["goofModFrame"]?.();');
}

export function configureHostCore(emulator){
  const initGameCore=emulator.initGameCore.bind(emulator);
  emulator.initGameCore=(js,...args)=>{
    const source=typeof js==='string'?js:new TextDecoder().decode(js);
    let patched;
    try{patched=patchHostCore(source);}catch(error){emulator.startGameError(error.message);return;}
    return initGameCore(new TextEncoder().encode(patched),...args);
  };
  const startGame=emulator.startGame.bind(emulator);
  emulator.startGame=(...args)=>{
    const path='/home/web_user/.config/retroarch/retroarch.cfg';
    const fs=emulator.Module.FS;
    const config=fs.readFile(path,{encoding:'utf8'}).replace(/^pause_nonactive\s*=.*$/gm,'');
    fs.writeFile(path,config+'\npause_nonactive = false\n');
    return startGame(...args);
  };
}
