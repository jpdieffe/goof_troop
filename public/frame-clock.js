// EmulatorJS's pinned core calls the window animation API from its main loop.
// Keep native animation timing in foreground, and use the worker in background.
export function installFrameClock(afterFrame=()=>{}) {
  const nativeRequest=window.requestAnimationFrame.bind(window);
  const nativeCancel=window.cancelAnimationFrame.bind(window);
  const pending=new Map();
  const worker=new Worker(new URL('./frame-clock-worker.js',import.meta.url));
  let nextId=1,lastNativeFrame=performance.now();
  window.requestAnimationFrame=callback=>{
    const id=nextId++;
    const nativeId=nativeRequest(time=>{
      const entry=pending.get(id);
      if(!entry)return;
      pending.delete(id);
      lastNativeFrame=performance.now();
      try{entry.callback(time);}finally{afterFrame();}
    });
    pending.set(id,{nativeId,callback});
    return id;
  };
  window.cancelAnimationFrame=id=>{
    const entry=pending.get(id);
    if(entry){nativeCancel(entry.nativeId);pending.delete(id);}
  };
  worker.onmessage=()=>{
    try{
      const now=performance.now();
      if(document.hidden || now-lastNativeFrame>100){
        // Callbacks scheduled by a frame belong to the next tick, not this one.
        const batch=[...pending.keys()];
        for(const id of batch){
          const entry=pending.get(id);
          if(!entry)continue;
          pending.delete(id);nativeCancel(entry.nativeId);
          try{entry.callback(now);}catch(error){setTimeout(()=>{throw error;},0);}
        }
        afterFrame();
      }
    }finally{worker.postMessage('ack');}
  };
  return ()=>{
    worker.terminate();
    for(const entry of pending.values())nativeCancel(entry.nativeId);
    pending.clear();
    window.requestAnimationFrame=nativeRequest;
    window.cancelAnimationFrame=nativeCancel;
  };
}
