// Render our vector source into VS Code's required PNG; synchronize JetBrains SVGs.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
const svg=await fs.readFile('assets/icon.svg','utf8');
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:256,height:256},deviceScaleFactor:1});
 await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${svg}`);
 await page.screenshot({path:'assets/icon.png',omitBackground:true});
 const meta='jetbrains-neovide-cursor/src/main/resources/META-INF';
 for(const name of ['pluginIcon.svg','pluginIcon_dark.svg'])await fs.writeFile(`${meta}/${name}`,svg.replace('width="256" height="256"','width="40" height="40"'));
}finally{await browser.close();}
console.log('Built assets/icon.png and JetBrains light/dark SVG icons.');
