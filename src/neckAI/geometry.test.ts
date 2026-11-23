import {describe,it,expect} from 'vitest';
import {angle3,ema,virtualPoint,sideMetrics,estimateHeadAngles} from './geometry';
import {ExerciseAnalyzer} from './engine';
import {TRACKER_CONFIGS} from './config';
describe('neck camera mathematics (not clinical validation)',()=>{
 it('right-angle geometry',()=>expect(angle3({x:1,y:0},{x:0,y:0},{x:0,y:1})).toBeCloseTo(90));
 it('smooths',()=>expect(ema(0,10,0.2)).toBe(2));
 it('clamps virtual screen coordinate',()=>expect(virtualPoint(60,-60)).toEqual({x:1,y:1}));
 it('rejects incomplete side pose',()=>expect(sideMetrics([])).toBeNull());
 it('no analysis before calibration',()=>expect(new ExerciseAnalyzer(TRACKER_CONFIGS['cervical-isometric']).analyze({yaw:0,pitch:0,roll:0},1000)).toBeNull());
 it('isometric measures head stability but not force',()=>{const a=new ExerciseAnalyzer(TRACKER_CONFIGS['cervical-isometric']);a.calibrate({yaw:0,pitch:0,roll:0});expect(a.analyze({yaw:2,pitch:0,roll:0},1000)?.message).toBe('stable');expect(a.analyze({yaw:12,pitch:0,roll:0},1100)?.message).toBe('rotation');});
});

describe('camera-based form feedback (prototype)',()=>{
 it('explains isometric rotation errors and recovers',()=>{
  const a=new ExerciseAnalyzer(TRACKER_CONFIGS['cervical-isometric']);
  a.calibrate({yaw:0,pitch:0,roll:0,trunk:0});
  const wrong=a.analyze({yaw:12,pitch:0,roll:0,trunk:0},1000);
  expect(wrong?.status).toBe('adjust');expect(wrong?.message).toBe('rotation');
  const correct=a.analyze({yaw:1,pitch:1,roll:1,trunk:0},1100);
  expect(correct?.status).toBe('correct');
 });
 it('counts a rep only after every isometric direction has been held, not per frame',()=>{
  const a=new ExerciseAnalyzer(TRACKER_CONFIGS['cervical-isometric']);
  a.calibrate({yaw:0,pitch:0,roll:0});
  for(let t=0;t<=5400;t+=100)a.analyze({yaw:0,pitch:0,roll:0},t);   // first direction held
  expect(a.reps).toBe(0);expect(a.stepIdx).toBe(1);
  for(let t=5500;t<=40000;t+=100)a.analyze({yaw:0,pitch:0,roll:0},t); // remaining directions
  expect(a.reps).toBeGreaterThanOrEqual(1);
 });
 it('does not call missing side landmarks correct',()=>{
  const a=new ExerciseAnalyzer(TRACKER_CONFIGS['deep-flexor-1']);a.calibrate({yaw:0,pitch:0,roll:0});
  expect(a.analyze({yaw:0,pitch:0,roll:0},1000)?.status).toBe('unavailable');
 });
});

describe('head direction estimate (drives the virtual laser)',()=>{
 const face=(nx:number,ny:number)=>{const f:any[]=[];f[1]={x:nx,y:ny};f[33]={x:.4,y:.4};f[263]={x:.6,y:.4};f[152]={x:.5,y:.7};f[10]={x:.5,y:.2};return f;};
 it('nose moving right in the raw image gives positive yaw, and looking down gives negative pitch',()=>{
  const n=estimateHeadAngles(face(.5,.46))!,r=estimateHeadAngles(face(.53,.46))!,d=estimateHeadAngles(face(.5,.5))!;
  expect(r.yaw).toBeGreaterThan(n.yaw+5);expect(d.pitch).toBeLessThan(n.pitch-5);
 });
});
