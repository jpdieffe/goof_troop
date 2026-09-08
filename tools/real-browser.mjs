import {createRequire} from 'node:module';
import path from 'node:path';
const require=createRequire(import.meta.url);
// Playwright 1.55.1 forces each page to appear focused/visible on its own CDP
// session. Disabling it from a second session doesn't undo that override.
// Intercept only that test-driver command; never modify the app's visibility.
const {CRSession}=require(path.join(path.dirname(require.resolve('playwright-core/package.json')),'lib/server/chromium/crConnection.js'));
const send=CRSession.prototype.send;
CRSession.prototype.send=function(method,params){
  if(method==='Emulation.setFocusEmulationEnabled')params={enabled:false};
  return send.call(this,method,params);
};
export const realBrowserOptions={
 channel:'chrome',headless:false,
 ignoreDefaultArgs:['--disable-background-timer-throttling','--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding'],
 args:['--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']
};
