import test from 'node:test';
import assert from 'node:assert/strict';
import {validState,validCode,normalizeCode,applyMask} from '../public/protocol.js';
import {server} from '../server.mjs';
test('controller messages cannot invoke emulator commands outside SNES buttons',()=>{
  for(const mask of [-1,4096,1.2,'8',NaN,Infinity])assert.equal(validState({type:'input',mask}),false);
  assert.equal(validState(null),false);assert.equal(validState({type:'input',mask:4095}),true);
});
test('snapshots release lost keys and retain held keys',()=>{const calls=[];applyMask((1<<4)|(1<<8),1<<8,(...args)=>calls.push(args));assert.deepEqual(calls,[[4,0]]);});
test('room codes are normalized and strictly validated',()=>{assert.equal(validCode(normalizeCode(' abcdef234567 ')),true);assert.equal(validCode('../private'),false);});
test('server serves only public assets, never the workspace',async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try{const base=`http://127.0.0.1:${server.address().port}`;for(const name of ['/','/app.js','/style.css','/protocol.js','/frame-clock.js','/frame-clock-worker.js','/host-core.js'])assert.equal((await fetch(base+name)).status,200);for(const name of ['/package.json','/server.mjs','/..%2fpackage.json'])assert.equal((await fetch(base+name)).status,404);}finally{await new Promise(resolve=>server.close(resolve));}
});
