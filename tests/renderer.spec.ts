import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('./fixture.html',import.meta.url),'utf8');
const script=()=>readFileSync(new URL('../dist/renderer.js',import.meta.url),'utf8');
async function start(page:any){await page.setContent(html);await page.locator('textarea').focus();await page.addScriptTag({content:script()});await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));}
async function move(page:any,x:number,y=24){await page.locator('.cursor').evaluate((el:HTMLElement,p:{x:number,y:number})=>{el.style.left=p.x+'px';el.style.top=p.y+'px';},{x,y});}
test('draws real canvas motion, settles, and restores native glyphs',async({page})=>{
 await start(page);await expect(page.locator('canvas.neovide-cursor-canvas')).toHaveCount(1);await move(page,250);
 await expect(page.locator('.cursors-layer')).toHaveClass(/neovide-cursor-owned/);
 const drawn=await page.locator('canvas').evaluate((c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v>0));expect(drawn).toBe(true);
 await expect(page.locator('.cursors-layer')).not.toHaveClass(/neovide-cursor-owned/,{timeout:2500});
 const before=await page.evaluate(()=>(window as any).__NEOVIDE_CURSOR__.stats.frames);
 await page.waitForTimeout(100);expect(await page.evaluate(()=>(window as any).__NEOVIDE_CURSOR__.stats.frames)).toBe(before);
});
test('IME and focus loss immediately restore native cursor',async({page})=>{
 await start(page);await move(page,300);await expect(page.locator('.cursors-layer')).toHaveClass(/neovide-cursor-owned/);
 await page.locator('textarea').dispatchEvent('compositionstart');await expect(page.locator('.cursors-layer')).not.toHaveClass(/neovide-cursor-owned/);
 await move(page,400);await page.waitForTimeout(40);await expect(page.locator('.cursors-layer')).not.toHaveClass(/neovide-cursor-owned/);
 await page.locator('textarea').dispatchEvent('compositionend');await page.locator('textarea').evaluate((e:HTMLTextAreaElement)=>e.blur());
 await expect(page.locator('.cursors-layer')).not.toHaveClass(/neovide-cursor-owned/);
});
test('scroll is compensated and detached editors release their canvases',async({page})=>{
 await start(page);await move(page,250,90);await expect(page.locator('.cursors-layer')).toHaveClass(/neovide-cursor-owned/);
 await page.evaluate(()=>{(document.querySelector('.view-lines') as HTMLElement).style.top='-40px';(document.querySelector('.cursors-layer') as HTMLElement).style.top='-40px';});
 await expect(page.locator('.cursors-layer')).not.toHaveClass(/neovide-cursor-owned/,{timeout:2500});
 await page.locator('.monaco-editor').evaluate(el=>el.remove());await expect.poll(()=>page.evaluate(()=>(window as any).__NEOVIDE_CURSOR__.stats.editors)).toBe(0);
});
test('dispose and reinjection are idempotent and remove owned styles',async({page})=>{
 await start(page);await page.addScriptTag({content:script()});await expect(page.locator('canvas.neovide-cursor-canvas')).toHaveCount(1);
 await move(page,300);await page.evaluate(()=>(window as any).__NEOVIDE_CURSOR__.dispose());
 await expect(page.locator('canvas.neovide-cursor-canvas')).toHaveCount(0);
 await expect(page.locator('.neovide-cursor-owned')).toHaveCount(0);await expect(page.locator('#neovide-cursor-style')).toHaveCount(0);
});
test('reduced motion keeps native rendering',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await start(page);await move(page,300);await page.waitForTimeout(50);
 await expect(page.locator('.neovide-cursor-owned')).toHaveCount(0);
});
test('multiple cursors retain their own target geometry',async({page})=>{
 await start(page);await page.locator('.cursors-layer').evaluate(el=>{const c=el.firstElementChild!.cloneNode(true) as HTMLElement;c.style.top='72px';el.append(c);});
 await page.locator('.cursor').first().evaluate((e:HTMLElement)=>e.style.left='400px');
 await page.locator('.cursor').nth(1).evaluate((e:HTMLElement)=>e.style.left='200px');
 await expect(page.locator('.cursors-layer')).toHaveClass(/neovide-cursor-owned/);
 await expect(page.locator('.cursors-layer')).not.toHaveClass(/neovide-cursor-owned/,{timeout:2500});
 expect(await page.locator('.cursor').count()).toBe(2);
});
test('Monaco class replacement cannot re-enable native smooth-caret transition',async({page})=>{
 await page.setContent(html+'<style>.cursor-smooth-caret-animation > .cursor {transition:all 80ms}</style>');
 await page.locator('textarea').focus();await page.addScriptTag({content:script()});
 await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
 await page.locator('.cursors-layer').evaluate(e=>e.setAttribute('class','cursors-layer cursor-smooth-caret-animation'));
 await expect.poll(()=>page.locator('.cursor').evaluate(e=>getComputedStyle(e).transitionDuration)).toBe('0s');
});
test('EditContext composition also restores native cursor',async({page})=>{
 await page.setContent(html);
 await page.locator('textarea').evaluate(e=>{
  const input=document.createElement('div') as any;input.className='native-edit-context';input.tabIndex=0;input.editContext=new (window as any).EditContext();e.replaceWith(input);input.focus();
 });
 await page.addScriptTag({content:script()});await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
 await move(page,300);await expect(page.locator('.cursors-layer')).toHaveClass(/neovide-cursor-owned/);
 const hidden=await page.locator('.native-edit-context').evaluate((e:any)=>{e.editContext.dispatchEvent(new CompositionEvent('compositionstart'));return document.querySelector('.cursors-layer')!.classList.contains('neovide-cursor-owned');});
 expect(hidden).toBe(false);
});
test('installed external script loads under the unchanged VS Code CSP',async({page})=>{
 const fs=await import('node:fs/promises'),path=await import('node:path'),os=await import('node:os'),http=await import('node:http');
 const {install,uninstall}=await import('../src/installer.ts');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'cursor-csp-'));
 const dir=path.join(root,'out/vs/code/electron-browser/workbench');await fs.mkdir(dir,{recursive:true});
 const shell=readFileSync(new URL('./workbench-shell.html',import.meta.url),'utf8');
 await fs.writeFile(path.join(dir,'workbench.html'),shell);
 // The stub only signals module execution; the injected renderer must start without inline JS.
 await fs.writeFile(path.join(dir,'workbench.js'),'document.body.setAttribute("data-workbench-loaded","true");');
 await install(root,script(),{});
 const server=http.createServer(async(req,res)=>{
  const name=path.basename(new URL(req.url!,'http://localhost').pathname);
  if(!['workbench.html','workbench.js','neovide-cursor.runtime.js'].includes(name)){res.writeHead(404).end();return;}
  try{res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':'text/html');res.end(await fs.readFile(path.join(dir,name)));}catch{res.writeHead(404).end();}
 });
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));
 try{
  const port=(server.address() as import('node:net').AddressInfo).port;
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/workbench.html`);
  await expect.poll(()=>page.evaluate(()=>(window as any).__NEOVIDE_CURSOR__?.version)).toBe('0.1.3');
  await expect(page.locator('body')).toHaveAttribute('data-workbench-loaded','true');expect(errors).toEqual([]);
  await uninstall(root);expect(await fs.readFile(path.join(dir,'workbench.html'),'utf8')).toBe(shell);
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));await fs.rm(root,{recursive:true,force:true});}
});
