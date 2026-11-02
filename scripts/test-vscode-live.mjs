// Read-only application installation: inject the renderer only in a disposable test window.
import {chromium} from 'playwright';
import {spawn} from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=await fs.mkdtemp('/private/tmp/neovide-vscode-live-');
await fs.mkdir(path.join(root,'profile/User'),{recursive:true});
await fs.writeFile(path.join(root,'profile/User/settings.json'),JSON.stringify({'workbench.startupEditor':'none','editor.cursorStyle':'block','editor.cursorBlinking':'solid','editor.cursorSmoothCaretAnimation':'on','update.mode':'none','extensions.autoUpdate':false,'telemetry.telemetryLevel':'off','editor.minimap.enabled':false}));
const file=path.join(root,'cursor-demo.ts');await fs.writeFile(file,'// Neovide Cursor\n'+Array.from({length:100},(_,i)=>`const point${i} = { x: ${i}, y: ${i*3} };`).join('\n'));
const port=19387;
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn('/Applications/Visual Studio Code.app/Contents/MacOS/Code',[
 '--user-data-dir='+path.join(root,'profile'),'--extensions-dir='+path.join(root,'extensions'),
 '--remote-debugging-port='+port,'--remote-debugging-address=127.0.0.1','--skip-welcome','--skip-release-notes','--disable-workspace-trust',
 '--extensionDevelopmentPath='+path.resolve('.'),file],{env,stdio:['ignore','pipe','pipe']});
let output='';child.stderr.on('data',d=>{output+=d;});child.stdout.on('data',d=>{output+=d;});
let browser;
try{
 for(let i=0;i<100;i++){
  if(child.exitCode!==null)throw new Error('VS Code exited: '+output);
  try{const r=await fetch(`http://127.0.0.1:${port}/json/version`);if(r.ok)break;}catch{}
  await new Promise(r=>setTimeout(r,200));
 }
 browser=await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
 let page;
 for(let i=0;i<100&&!page;i++){page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('workbench.html'));if(!page)await new Promise(r=>setTimeout(r,200));}
 if(!page)throw new Error('No workbench page: '+output);
 await page.waitForSelector('.editor-instance .monaco-editor',{timeout:60000});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.evaluate(await fs.readFile('dist/renderer.js','utf8'));
 await page.locator('.editor-instance .monaco-editor').first().click({position:{x:150,y:35}});
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 console.log('Initial',await page.evaluate(()=>({stats:window.__NEOVIDE_CURSOR__.stats,focus:document.activeElement?.outerHTML.slice(0,200),layers:[...document.querySelectorAll('.cursors-layer')].map(e=>e.outerHTML.slice(0,600))})));
 // Observe the native layer while keyboard selection changes happen.
 await page.evaluate(()=>{window.__sawAnimation=false;new MutationObserver(()=>{if(document.querySelector('.neovide-cursor-owned'))window.__sawAnimation=true;}).observe(document.body,{attributes:true,subtree:true,attributeFilter:['class']});});
 await page.keyboard.press('ArrowDown');await page.keyboard.press('ArrowDown');await page.keyboard.press('End');
 await page.waitForTimeout(100);
 console.log('Motion',await page.evaluate(()=>({frames:window.__NEOVIDE_CURSOR__.stats.frames,sawAnimation:window.__sawAnimation,layers:[...document.querySelectorAll('.cursors-layer')].map(e=>e.outerHTML.slice(0,600))})));
 assert.equal(await page.evaluate(()=>window.__sawAnimation),true,'actual Monaco cursor must animate');
 await page.screenshot({path:'docs/vscode-integration.png'});
 await page.waitForFunction(()=>!document.querySelector('.neovide-cursor-owned'));
 const frames=await page.evaluate(()=>window.__NEOVIDE_CURSOR__.stats.frames);await page.waitForTimeout(200);
 assert.ok((await page.evaluate(()=>window.__NEOVIDE_CURSOR__.stats.frames))-frames<5,'idle RAF must stop');
 await page.evaluate(()=>window.__NEOVIDE_CURSOR__.dispose());assert.equal(await page.locator('.neovide-cursor-canvas').count(),0);
 console.log('PASS: real VS Code DOM animation, idle, disposal.',{errors});
}finally{
 if(browser)await browser.close();child.kill();
 console.log('Isolated profile:',root);
}
