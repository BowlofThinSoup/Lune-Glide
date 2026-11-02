// Adapted from Neovide (MIT), Copyright (c) 2023 Neovide Contributors.
// See THIRD_PARTY_NOTICES.md for upstream sources and the complete license.
import type {Config} from './config.ts';
export interface Point { x: number; y: number }
export interface Rect extends Point { width: number; height: number }
export class Spring {
  position = 0;
  velocity = 0;
  reset(): void { this.position = this.velocity = 0; }
  step(dt: number, duration: number): boolean {
    if (duration <= dt) { this.reset(); return false; }
    if (this.position === 0 || dt <= 0) return this.position !== 0;
    const omega = 4 / duration;
    const a = this.position;
    const b = a * omega + this.velocity;
    const c = Math.exp(-omega * dt);
    this.position = (a + b * dt) * c;
    this.velocity = c * (-a * omega - b * dt * omega + b);
    if (Math.abs(this.position) < 0.01) { this.reset(); return false; }
    return true;
  }
}
const points = (r: Rect): Point[] => [
  {x:r.x,y:r.y}, {x:r.x+r.width,y:r.y},
  {x:r.x+r.width,y:r.y+r.height}, {x:r.x,y:r.y+r.height},
];
export class CursorMotion {
  readonly config: Config;
  corners: Point[] = points({x:0,y:0,width:0,height:0});
  private target: Rect = {x:0,y:0,width:0,height:0};
  private springs = Array.from({length:4}, () => ({x:new Spring(),y:new Spring(),duration:0}));
  active = false;
  constructor(config: Config) { this.config = config; }
  snap(rect: Rect): void {
    this.target = {...rect}; this.corners = points(rect);
    this.springs.forEach(s=>{s.x.reset();s.y.reset();}); this.active = false;
  }
  retarget(rect: Rect, cellWidth: number): void {
    const destinations = points(rect), previous = points(this.target);
    const short = Math.abs(rect.x-this.target.x) <= Math.max(1,cellWidth)*2.001
      && Math.abs(rect.y-this.target.y)<0.001
      && rect.width===this.target.width && rect.height===this.target.height;
    const relative = [[-1,-1],[1,-1],[1,1],[-1,1]];
    const alignment = destinations.map((p,i)=>{
      const dx=p.x-previous[i].x,dy=p.y-previous[i].y;
      return (dx*relative[i][0]+dy*relative[i][1])/(Math.hypot(dx,dy)*Math.SQRT2);
    });
    const min = Math.min(...alignment), max = Math.max(...alignment);
    const leading = this.config.animationLength*(1-this.config.trailSize);
    this.springs.forEach((s,i)=>{
      const raw=(alignment[i]-min)/(max-min);
      const a=Number.isFinite(raw)?Math.max(0,Math.min(1,raw)):1;
      s.duration = short ? (this.config.animateTyping ? Math.min(this.config.animationLength,this.config.shortAnimationLength) : 0)
        : this.config.animationLength+(leading-this.config.animationLength)*a;
      s.x.position=destinations[i].x-this.corners[i].x;
      s.y.position=destinations[i].y-this.corners[i].y;
    });
    this.target={...rect}; this.active=true;
  }
  translate(dx: number, dy: number): void {
    this.target.x+=dx;this.target.y+=dy;
    for(const p of this.corners){p.x+=dx;p.y+=dy;}
  }
  step(dt: number): boolean {
    const destinations=points(this.target); let active=false;
    this.springs.forEach((s,i)=>{
      const x=s.x.step(dt,s.duration), y=s.y.step(dt,s.duration);
      active ||= x||y;
      this.corners[i]={x:destinations[i].x-s.x.position,y:destinations[i].y-s.y.position};
    });
    this.active=active;return active;
  }
}
