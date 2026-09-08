// A worker clock continues scheduling game frames when the host tab has no paints.
// Acknowledge each tick so a busy/suspended main thread never accumulates a backlog.
let pending=false;
self.onmessage=()=>{pending=false;};
setInterval(()=>{if(!pending){pending=true;self.postMessage('tick');}},1000/60);
