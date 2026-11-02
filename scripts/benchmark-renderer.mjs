// Reproducible full-renderer benchmark in an isolated Chrome Monaco-shaped DOM fixture.
// TaskDuration is main-thread work, not whole Chrome CPU; canvas bytes are backing-store estimates.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import assert from 'node:assert/strict';
const output=process.env.BENCH_OUTPUT||'docs/performance/renderer.json';
const seconds=Number(process.env.BENCH_SECONDS||3),repeats=Number(process.env.BENCH_REPEATS||3);
const html=await fs.readFile('tests/fixture.html','utf8'),renderer=await fs.readFile('dist/renderer.js','utf8');
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const results=[];
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
try {
 const context=await browser.newContext({viewport:{width:1280,height:820},deviceScaleFactor:2});
 const page=await context.newPage();const cdp=await context.newCDPSession(page);
 await cdp.send('Performance.enable');
 const metrics=async()=>Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 async function setup(count){
  await page.setContent(html+`<style>.monaco-editor{width:1200px;height:700px}.monaco-scrollable-element{width:1150px;height:680px}</style>`);
  await page.locator('textarea').focus();
  await page.evaluate(n=>{const layer=document.querySelector('.cursors-layer');const first=layer.firstElementChild;for(let i=1;i<n;i++){const c=first.cloneNode(true);c.style.top=(24+i*24)+'px';layer.append(c);}},count);
 }
 const inject=async vfx=>{await page.evaluate(vfx=>{window.__NEOVIDE_CURSOR_CONFIG__={vfx};},vfx);await page.evaluate(renderer);await page.waitForTimeout(700);};
 for(const scenario of [{name:'idle',carets:1,moving:false,vfx:'none'},{name:'moving-1',carets:1,moving:true,vfx:'none'},{name:'moving-20',carets:20,moving:true,vfx:'none'},{name:'railgun-1',carets:1,moving:true,vfx:'railgun'}]) {
  await setup(scenario.carets);
  for(let repeat=0;repeat<repeats;repeat++)for(const enabled of (repeat%2?[true,false]:[false,true])) {
   await page.evaluate(()=>window.__NEOVIDE_CURSOR__?.dispose());
   if(enabled)await inject(scenario.vfx);
   await cdp.send('HeapProfiler.collectGarbage');
   const before=await metrics();
   const counters=await page.evaluate(async ({moving,seconds})=>{
    const cursors=[...document.querySelectorAll('.cursor')];let moves=0,raf=0,previous=0;const gaps=[];
    const frame=t=>{if(previous)gaps.push(t-previous);previous=t;raf=requestAnimationFrame(frame);};raf=requestAnimationFrame(frame);
    const frames=window.__NEOVIDE_CURSOR__?.stats.frames||0;
    const interval=moving?setInterval(()=>{moves++;for(let i=0;i<cursors.length;i++)cursors[i].style.left=(40+(moves%2?760:0)+i*3)+'px';},1000/60):0;
    await new Promise(r=>setTimeout(r,seconds*1000));clearInterval(interval);cancelAnimationFrame(raf);
    gaps.sort((a,b)=>a-b);
    return {moves,animationFrames:(window.__NEOVIDE_CURSOR__?.stats.frames||0)-frames,rafCount:gaps.length,
     rafP95Ms:gaps[Math.floor(gaps.length*.95)],rafOver25ms:gaps.filter(x=>x>25).length,
     canvases:document.querySelectorAll('canvas.neovide-cursor-canvas').length,
     canvasRGBABytes:[...document.querySelectorAll('canvas.neovide-cursor-canvas')].reduce((s,c)=>s+c.width*c.height*4,0)};
   },{moving:scenario.moving,seconds});
   const after=await metrics();
   assert.equal(counters.canvases,enabled?1:0,'renderer must attach exactly one canvas when enabled');
   assert.equal(counters.canvasRGBABytes,enabled?1200*700*2*2*4:0,'backing size must match the measured viewport');
   if(enabled && scenario.moving)assert.ok(counters.animationFrames>seconds*20,'renderer must animate during the measured movement window');
   else assert.equal(counters.animationFrames,0,'disabled or idle renderer must not animate');
   await page.waitForTimeout(900);
   const settled=await page.evaluate(()=>({frames:window.__NEOVIDE_CURSOR__?.stats.frames||0,owned:document.querySelectorAll('.neovide-cursor-owned').length}));
   await page.waitForTimeout(150);
   const later=await page.evaluate(()=>window.__NEOVIDE_CURSOR__?.stats.frames||0);
   assert.equal(later,settled.frames,'animation must stop at rest');assert.equal(settled.owned,0);
   await cdp.send('HeapProfiler.collectGarbage');const retained=await metrics();
   const wall=after.Timestamp-before.Timestamp;
   const row={scenario:scenario.name,repeat,enabled,wallSeconds:wall,mainThreadCPUPercent:100*(after.TaskDuration-before.TaskDuration)/wall,
    scriptMs:1000*(after.ScriptDuration-before.ScriptDuration),layoutMs:1000*(after.LayoutDuration-before.LayoutDuration),
    heapAfterGCBytes:retained.JSHeapUsedSize,...counters};results.push(row);console.log(JSON.stringify(row));
  }
 }
 await setup(1);await cdp.send('HeapProfiler.collectGarbage');const start=await metrics();
 const lifecycle=[];
 for(let batch=0;batch<3;batch++){
  for(let i=0;i<20;i++){await page.evaluate(renderer);await page.evaluate(()=>window.__NEOVIDE_CURSOR__.dispose());}
  await page.waitForTimeout(100);await cdp.send('HeapProfiler.collectGarbage');
  const m=await metrics();lifecycle.push({cycles:(batch+1)*20,heapBytes:m.JSHeapUsedSize,nodes:m.Nodes,documents:m.Documents});
 }
 assert.equal(await page.locator('canvas.neovide-cursor-canvas').count(),0);
 const summary=[];
 for(const scenario of [...new Set(results.map(r=>r.scenario))]){
  const rows=results.filter(r=>r.scenario===scenario);const off=rows.filter(r=>!r.enabled),on=rows.filter(r=>r.enabled);
  summary.push({scenario,baselineCPUPercent:median(off.map(r=>r.mainThreadCPUPercent)),enabledCPUPercent:median(on.map(r=>r.mainThreadCPUPercent)),
   medianPairedCPUPointDelta:median(on.map(r=>r.mainThreadCPUPercent-off.find(o=>o.repeat===r.repeat).mainThreadCPUPercent)),
   retainedHeapDeltaBytes:median(on.map(r=>r.heapAfterGCBytes-off.find(o=>o.repeat===r.repeat).heapAfterGCBytes)),
   enabledRafP95Ms:median(on.map(r=>r.rafP95Ms)),canvasRGBABytes:on[0].canvasRGBABytes});
 }
 const report={date:new Date().toISOString(),environment:{os:os.platform(),arch:os.arch(),cpu:os.cpus()[0]?.model,memoryBytes:os.totalmem(),chrome:browser.version(),dpr:2,width:1200,height:700,seconds,repeats},
  method:'Synthetic Monaco-shaped DOM; full production renderer, 60 requested moves/sec. CDP TaskDuration / wall time = one main-thread CPU equivalent. Not whole VS Code/GPU/RSS. No native blinking in fixture.',summary,results,lifecycle:{initialHeapBytes:start.JSHeapUsedSize,batches:lifecycle}};
 await fs.mkdir('docs/performance',{recursive:true});await fs.writeFile(output,JSON.stringify(report,null,2)+'\n');console.log('Saved',output);
}finally{await browser.close();}
