import {normalizeConfig} from './config.ts';
import {CursorMotion} from './motion.ts';
import type {Rect} from './motion.ts';

declare global {
  interface Window {
    __NEOVIDE_CURSOR_CONFIG__?: unknown;
    __NEOVIDE_CURSOR__?: {dispose():void; stats:{frames:number;editors:number};version:string};
  }
}
const config=normalizeConfig(window.__NEOVIDE_CURSOR_CONFIG__);
window.__NEOVIDE_CURSOR__?.dispose();
const stats={frames:0,editors:0};
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const ownedClass='neovide-cursor-owned';
const style=document.createElement('style');
style.id='neovide-cursor-style';
style.textContent=`
.neovide-cursor-owned > .cursor { opacity:0 !important; }
[data-neovide-cursor-tracked] > .cursor { transition:none !important; }
canvas.neovide-cursor-canvas { position:absolute;left:0;top:0;pointer-events:none!important;z-index:4; }
`;
document.head.append(style);
interface Track {motion:CursorMotion; rect:Rect; glyph:string; font:string; foreground:string}
interface Particle {x:number;y:number;vx:number;vy:number;life:number}
const controllers=new Map<HTMLElement,EditorOverlay>();
let disposed=false,discoveryFrame=0;
function equal(a:Rect,b:Rect):boolean{return Math.abs(a.x-b.x)<0.01&&Math.abs(a.y-b.y)<0.01&&Math.abs(a.width-b.width)<0.01&&Math.abs(a.height-b.height)<0.01;}

class EditorOverlay {
  editor:HTMLElement;layer:HTMLElement;guard:HTMLElement;viewport:HTMLElement;lines:HTMLElement;
  canvas=document.createElement('canvas');ctx:CanvasRenderingContext2D;
  tracks=new Map<HTMLElement,Track>();particles:Particle[]=[];
  frame=0;lastTime=0;composing=false;disposed=false;reset=true;
  origin?:{x:number;y:number};color='#ffffff';background='#000000';
  mutation:MutationObserver;resize:ResizeObserver;
  abort=new AbortController();
  editContext?:EventTarget;editContextAbort?:AbortController;
  constructor(editor:HTMLElement,layer:HTMLElement,guard:HTMLElement,viewport:HTMLElement,lines:HTMLElement){
    this.editor=editor;this.layer=layer;this.guard=guard;this.viewport=viewport;this.lines=lines;
    this.canvas.className='neovide-cursor-canvas';this.canvas.setAttribute('aria-hidden','true');
    const ctx=this.canvas.getContext('2d');if(!ctx)throw new Error('Canvas 2D is unavailable');this.ctx=ctx;
    guard.append(this.canvas);layer.setAttribute('data-neovide-cursor-tracked','');
    this.mutation=new MutationObserver(records=>{
      // Changes to our own hiding class must not start a perpetual animation loop.
      if(records.every(r=>r.type==='attributes'&&r.attributeName==='class'&&r.target===layer
        &&(r.oldValue??'').replace(/neovide-cursor-owned/g,'').trim()===layer.className.replace(/neovide-cursor-owned/g,'').trim()))return;
      this.schedule();
    });
    this.mutation.observe(layer,{attributes:true,attributeOldValue:true,childList:true,characterData:true,subtree:true});
    this.mutation.observe(lines,{attributes:true,attributeFilter:['style']});
    // Monaco may scroll by translating lines-content, not view-lines itself.
    if(layer.parentElement)this.mutation.observe(layer.parentElement,{attributes:true,attributeFilter:['style']});
    this.resize=new ResizeObserver(()=>{this.reset=true;this.schedule();});this.resize.observe(guard);
    const opts={signal:this.abort.signal};
    editor.addEventListener('compositionstart',()=>{this.composing=true;this.release();this.schedule();},opts);
    editor.addEventListener('compositionend',()=>{this.composing=false;this.reset=true;this.schedule();},opts);
    editor.addEventListener('focusin',()=>{this.bindEditContext();this.reset=true;this.schedule();},opts);
    editor.addEventListener('focusout',()=>{this.editContextAbort?.abort();this.editContext=undefined;this.composing=false;this.release();this.reset=true;this.schedule();},opts);
    editor.addEventListener('keydown',()=>this.schedule(),opts);
    editor.addEventListener('pointerdown',()=>this.schedule(),opts);
    this.bindEditContext();this.schedule();
  }
  bindEditContext():void{
    const host=document.activeElement as (HTMLElement & {editContext?:EventTarget})|null;
    const next=host&&this.editor.contains(host)?host.editContext:undefined;
    if(next===this.editContext)return;
    this.editContextAbort?.abort();this.editContext=next;this.composing=false;
    if(next){
      this.editContextAbort=new AbortController();const options={signal:this.editContextAbort.signal};
      next.addEventListener('compositionstart',()=>{this.composing=true;this.release();this.schedule();},options);
      next.addEventListener('compositionend',()=>{this.composing=false;this.reset=true;this.schedule();},options);
    }
  }
  schedule():void{if(!this.frame&&!this.disposed){this.frame=requestAnimationFrame(t=>this.tick(t));}}
  release():void{this.layer.classList.remove(ownedClass);this.ctx.clearRect(0,0,this.canvas.width,this.canvas.height);this.particles=[];}
  spawn(from:Rect,to:Rect):void{
    if(config.vfx==='none'||config.particleCount===0)return;
    const distance=Math.hypot(to.x-from.x,to.y-from.y);if(distance<20)return;
    const count=Math.min(config.particleCount,Math.ceil(distance/5));
    for(let i=0;i<count;i++){
      const t=i/count,phase=i*2.399963;
      this.particles.push({x:from.x+(to.x-from.x)*t+to.width/2,y:from.y+(to.y-from.y)*t+to.height/2,
        vx:Math.cos(phase)*16,vy:Math.sin(phase)*16,life:config.particleLifetime});
    }
    this.particles=this.particles.slice(-config.particleCount);
  }
  tick(time:number):void{
    this.frame=0;if(this.disposed)return;
    try {this.render(time);}catch(error){console.warn('[Lune Glide] Restoring native cursor after renderer error.',error);this.dispose();controllers.delete(this.editor);stats.editors=controllers.size;}
  }
  render(time:number):void{
    stats.frames++;this.bindEditContext();
    const dt=this.lastTime?Math.min(1,(time-this.lastTime)/1000):1/60;this.lastTime=time;
    const box=this.guard.getBoundingClientRect(),vw=this.viewport.getBoundingClientRect();
    const sx=box.width/(this.guard.clientWidth||1),sy=box.height/(this.guard.clientHeight||1);
    const active=this.editor.contains(document.activeElement)&&!this.composing&&!document.hidden
      &&document.hasFocus()&&box.width>0&&box.height>0&&!(config.respectReducedMotion&&reduced.matches);
    if(!active){this.release();this.tracks.clear();this.origin=undefined;this.reset=true;this.lastTime=0;return;}
    const dpr=window.devicePixelRatio||1,w=this.guard.clientWidth,h=this.guard.clientHeight;
    const pixelW=Math.max(1,Math.round(w*dpr)),pixelH=Math.max(1,Math.round(h*dpr));
    if(this.canvas.width!==pixelW||this.canvas.height!==pixelH){this.canvas.width=pixelW;this.canvas.height=pixelH;this.canvas.style.width=w+'px';this.canvas.style.height=h+'px';this.reset=true;}
    const rootStyle=getComputedStyle(this.editor);
    this.color=rootStyle.getPropertyValue('--vscode-editorCursor-foreground').trim()||'#aeafad';
    this.background=rootStyle.getPropertyValue('--vscode-editorCursor-background').trim()||rootStyle.getPropertyValue('--vscode-editor-background').trim()||'#1e1e1e';
    const lineStyle=getComputedStyle(this.lines),lineRect=this.lines.getBoundingClientRect();
    const origin={x:(lineRect.left-box.left)/sx,y:(lineRect.top-box.top)/sy};
    if(this.origin&&!this.reset){
      const dx=origin.x-this.origin.x,dy=origin.y-this.origin.y;
      if(dx||dy){for(const tr of this.tracks.values()){tr.motion.translate(dx,dy);tr.rect.x+=dx;tr.rect.y+=dy;}for(const p of this.particles){p.x+=dx;p.y+=dy;}}
    }
    this.origin=origin;
    const font=`${lineStyle.fontStyle} ${lineStyle.fontWeight} ${lineStyle.fontSize} ${lineStyle.fontFamily}`;
    this.ctx.font=font;const cellWidth=this.ctx.measureText('M').width||8;
    const live=new Set<HTMLElement>();
    for(const el of this.layer.querySelectorAll<HTMLElement>(':scope > .cursor')){
      const r=el.getBoundingClientRect();if(r.width<=0||r.height<=0)continue;
      live.add(el);const rect={x:(r.left-box.left)/sx,y:(r.top-box.top)/sy,width:r.width/sx,height:r.height/sy};
      let tr=this.tracks.get(el);
      if(!tr){tr={motion:new CursorMotion(config),rect,glyph:el.textContent??'',font,foreground:this.background};tr.motion.snap(rect);this.tracks.set(el,tr);}
      if(this.reset)tr.motion.snap(rect);
      else if(!equal(tr.rect,rect)){
        // Editor replacement or far offscreen jumps should never leave a screen-wide smear.
        if(Math.abs(rect.x-tr.rect.x)>w*2||Math.abs(rect.y-tr.rect.y)>h*2)tr.motion.snap(rect);
        else {this.spawn(tr.rect,rect);tr.motion.retarget(rect,cellWidth);}
      }
      tr.rect=rect;tr.glyph=el.textContent??'';tr.font=font;tr.foreground=this.background;
    }
    for(const el of this.tracks.keys())if(!live.has(el))this.tracks.delete(el);
    this.reset=false;
    let animating=false;for(const tr of this.tracks.values())animating=tr.motion.step(dt)||animating;
    this.particles=this.particles.filter(p=>{p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;return p.life>0;});
    const ctx=this.ctx;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
    this.layer.classList.toggle(ownedClass,animating);
    ctx.save();ctx.beginPath();ctx.rect((vw.left-box.left)/sx,(vw.top-box.top)/sy,vw.width/sx,vw.height/sy);ctx.clip();
    if(animating){
      for(const [el,tr] of this.tracks){
        const nativeStyle=getComputedStyle(el);if(nativeStyle.visibility==='hidden'||nativeStyle.display==='none')continue;
        const alpha=Number.parseFloat(getComputedStyle(this.layer).opacity);
        ctx.globalAlpha=Number.isFinite(alpha)?alpha:1;
        ctx.beginPath();tr.motion.corners.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();
        if(this.layer.classList.contains('cursor-block-outline-style')){ctx.strokeStyle=this.color;ctx.lineWidth=1;ctx.stroke();}
        else {
          ctx.fillStyle=this.color;
          // Monaco supplies the character inside a block cursor. Empty glyphs use translucency
          // during movement only; at rest the untouched native cursor draws exact text/blinking.
          if(tr.rect.width>cellWidth*0.7&&!tr.glyph)ctx.globalAlpha*=0.65;
          ctx.fill();
          if(tr.glyph){ctx.save();ctx.clip();ctx.fillStyle=tr.foreground;ctx.font=tr.font;ctx.textBaseline='alphabetic';
            const metrics=ctx.measureText(tr.glyph),ascent=metrics.fontBoundingBoxAscent||metrics.actualBoundingBoxAscent,descent=metrics.fontBoundingBoxDescent||metrics.actualBoundingBoxDescent;
            ctx.fillText(tr.glyph,tr.rect.x,tr.rect.y+(tr.rect.height-ascent-descent)/2+ascent);ctx.restore();}
        }
      }
    }
    for(const p of this.particles){ctx.globalAlpha=0.65*p.life/config.particleLifetime;ctx.fillStyle=this.color;ctx.beginPath();ctx.arc(p.x,p.y,1.2,0,Math.PI*2);ctx.fill();}
    ctx.restore();ctx.globalAlpha=1;
    if(animating||this.particles.length)this.schedule();else this.lastTime=0;
  }
  dispose():void{
    if(this.disposed)return;this.disposed=true;cancelAnimationFrame(this.frame);this.frame=0;
    this.mutation.disconnect();this.resize.disconnect();this.abort.abort();this.editContextAbort?.abort();this.release();this.layer.removeAttribute('data-neovide-cursor-tracked');this.canvas.remove();this.tracks.clear();
  }
}
function discover():void{
  discoveryFrame=0;if(disposed)return;
  for(const [el,c] of controllers)if(!el.isConnected||!c.layer.isConnected){c.dispose();controllers.delete(el);}
  for(const el of document.querySelectorAll<HTMLElement>('.monaco-editor')){
    if(controllers.has(el)||el.closest('.notebook-editor, .terminal'))continue;
    const own=(selector:string)=>Array.from(el.querySelectorAll<HTMLElement>(selector)).find(n=>n.closest('.monaco-editor')===el);
    const layer=own('.cursors-layer'),guard=own('.overflow-guard'),viewport=own('.monaco-scrollable-element'),lines=own('.view-lines');
    if(layer&&guard&&viewport&&lines){try{controllers.set(el,new EditorOverlay(el,layer,guard,viewport,lines));}catch(e){console.warn('[Lune Glide] Unsupported editor.',e);}}
  }
  stats.editors=controllers.size;
}
const discovery=new MutationObserver(records=>{
  const relevant=records.some(r=>Array.from(r.addedNodes).concat(Array.from(r.removedNodes)).some(n=>n instanceof Element
    &&(n.matches('.monaco-editor,.cursors-layer,.overflow-guard')||n.querySelector('.monaco-editor,.cursors-layer'))));
  if(relevant&&!discoveryFrame)discoveryFrame=requestAnimationFrame(discover);
});
discovery.observe(document.body,{childList:true,subtree:true});
const abort=new AbortController();
const resetAll=()=>{for(const c of controllers.values()){c.release();c.reset=true;c.schedule();}};
window.addEventListener('blur',resetAll,{signal:abort.signal});window.addEventListener('focus',resetAll,{signal:abort.signal});
window.addEventListener('resize',resetAll,{signal:abort.signal});document.addEventListener('visibilitychange',resetAll,{signal:abort.signal});
reduced.addEventListener('change',resetAll,{signal:abort.signal});
window.__NEOVIDE_CURSOR__={version:'0.1.3',stats,dispose(){
  if(disposed)return;disposed=true;discovery.disconnect();abort.abort();cancelAnimationFrame(discoveryFrame);
  for(const c of controllers.values())c.dispose();controllers.clear();stats.editors=0;style.remove();
}};
discover();
