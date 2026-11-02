import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Spring, CursorMotion} from '../src/motion.ts';
import {normalizeConfig} from '../src/config.ts';

test('spring matches the analytic critically damped response', () => {
 const s=new Spring(); s.position=100; s.step(0.05,0.15);
 assert.ok(Math.abs(s.position-61.50599889366958)<1e-8);
 assert.ok(Math.abs(s.velocity+937.2342688559174)<1e-8);
});
test('spring preserves equivalent motion at 60 and 120Hz', () => {
 const a=new Spring(),b=new Spring(); a.position=b.position=100;
 for(let i=0;i<12;i++) a.step(1/60,0.15);
 for(let i=0;i<24;i++) b.step(1/120,0.15);
 assert.ok(Math.abs(a.position-b.position)<1e-8);
});
test('zero duration and huge frame intervals snap without NaN',()=>{
 const s=new Spring(); s.position=100; assert.equal(s.step(1,0.15),false); assert.equal(s.position,0);
 s.position=3; s.step(0.01,0); assert.equal(s.position,0);
});
test('leading corners arrive first and trailing corners converge',()=>{
 const m=new CursorMotion(normalizeConfig({})); m.snap({x:0,y:0,width:10,height:20});
 m.retarget({x:100,y:0,width:10,height:20},10); m.step(1/60);
 assert.equal(m.corners[1].x,110); assert.ok(m.corners[0].x>0 && m.corners[0].x<100);
 for(let i=0;i<100;i++) m.step(1/60);
 assert.equal(m.active,false); assert.deepEqual(m.corners,[{x:100,y:0},{x:110,y:0},{x:110,y:20},{x:100,y:20}]);
});
test('typing moves all corners quickly without a stretched shape',()=>{
 const m=new CursorMotion(normalizeConfig({})); m.snap({x:0,y:0,width:2,height:20});
 m.retarget({x:10,y:0,width:2,height:20},10); m.step(1/60);
 assert.ok(m.corners[0].x>4); assert.ok(Math.abs(m.corners[1].x-m.corners[0].x-2)<1e-8);
});
test('reversal starts at current drawn position and scroll translates the entire motion',()=>{
 const m=new CursorMotion(normalizeConfig({})); m.snap({x:0,y:0,width:10,height:20});
 m.retarget({x:100,y:40,width:10,height:20},10); m.step(1/120);
 const before=m.corners.map(p=>({...p})); m.retarget({x:0,y:0,width:10,height:20},10);
 assert.deepEqual(m.corners,before); m.translate(2,-20);
 assert.deepEqual(m.corners,before.map(p=>({x:p.x+2,y:p.y-20})));
 for(let i=0;i<100;i++) m.step(1/60);
 assert.equal(m.corners[0].x,2); assert.equal(m.corners[0].y,-20);
});
test('untrusted configuration is bounded and cannot introduce script strings',()=>{
 const c=normalizeConfig({animationLength:-1,trailSize:100,shortAnimationLength:NaN,particleCount:1e9,vfx:'<script>',color:'red;alert(1)'});
 assert.equal(c.animationLength,0); assert.equal(c.trailSize,1); assert.equal(c.shortAnimationLength,0.04);
 assert.equal(c.particleCount,256); assert.equal(c.vfx,'none'); assert.ok(!('color' in c));
});
