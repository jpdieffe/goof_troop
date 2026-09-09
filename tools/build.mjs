import {mkdir,copyFile} from 'node:fs/promises';
// Explicit allowlist: public builds never contain the user's ROM.
await mkdir('dist/assets',{recursive:true});
for(const file of ['index.html','style.css','app.js','protocol.js','frame-clock.js','frame-clock-worker.js','host-core.js','gatling.js','gatling-model.js','weapon-inventory.js','weapon-terrain.js','assets/gatling.png','assets/rocket.png','assets/mech.png','assets/zombie-items.png','weapons.js','zombie-mode.js','game-session.js'])await copyFile('public/'+file,'dist/'+file);
console.log('Browser app ready in dist/. Host this folder on any HTTPS static host. The host selects a local ROM.');
