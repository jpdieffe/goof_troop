import {chromium} from 'playwright';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader-webgl','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
try{const page=await browser.newPage();await page.goto('http://localhost:3000');await page.click('#host');await page.waitForFunction(()=>window.EJS_emulator?.gameManager?.functions.getFrameNum()>500,{timeout:90000});
for(const [i,key] of ['Enter','Enter','Enter','ArrowDown','Enter','KeyX','Enter'].entries()){await page.keyboard.press(key,{delay:500});await page.waitForTimeout(2500);await page.locator('#screen').screenshot({path:`test-results/sequence-${i}.png`});console.log(i,key,await page.evaluate(()=>EJS_emulator.gameManager.functions.getFrameNum()));}
}finally{await browser.close();}
