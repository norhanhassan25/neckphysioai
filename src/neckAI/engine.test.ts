import {describe,expect,it} from 'vitest';
import {ExerciseAnalyzer,Measurement,SESSION_PASS_FRACTION} from './engine';
import {TRACKER_CONFIGS,DCF_STAGES,TRACKING_STAGES,ISOMETRIC_STAGES,LASER_STAGES} from './config';
import {poseMeasurements,summarizeCalibration,targetAt,Point,toScreenAngles,estimateHeadAngles} from './geometry';

const base:Measurement={yaw:0,pitch:0,roll:0,nod:10,cva:55,lift:0.5,fwd:0.2,trunk:0,torsoV:1,hx:0,hy:-0.5,neckH:0.5};
const mk=(a:Partial<Measurement>={}):Measurement=>({...base,...a});
const run=(a:ExerciseAnalyzer,m:Measurement,fromMs:number,seconds:number,q={ok:true,confidence:0.95,jitter:0.3})=>{let o=null as ReturnType<ExerciseAnalyzer['analyze']>;for(let t=0;t<seconds*1000;t+=100)o=a.analyze(m,fromMs+t,q);return o;};
const dcf=(id='deep-flexor-1')=>{const a=new ExerciseAnalyzer(TRACKER_CONFIGS[id]);a.calibrate(base);return a;};

describe('specification targets',()=>{
 it('deep flexor stage targets, holds and tracking/isometric/laser thresholds',()=>{
  expect(DCF_STAGES[1].nod).toEqual([5,8]);expect(DCF_STAGES[2].nod).toEqual([8,12]);expect(DCF_STAGES[3].nod).toEqual([10,15]);
  expect([DCF_STAGES[1].holdSeconds,DCF_STAGES[2].holdSeconds,DCF_STAGES[3].holdSeconds]).toEqual([1,8,10]);
  expect(TRACKER_CONFIGS['deep-flexor-1'].plan).toEqual({repsPerSet:15,sets:1,restSeconds:0});
  expect(TRACKER_CONFIGS['deep-flexor-2'].plan).toMatchObject({repsPerSet:10,sets:3});
  expect(Object.values(TRACKER_CONFIGS).filter(c=>c.plan).map(c=>c.id)).toEqual(['deep-flexor-1','deep-flexor-2']);
 });
});

describe('deep cervical flexor feedback',()=>{
 it('gives an approximate numeric correction when reliable (3° vs 5–8° target → ~2°)',()=>{
  const o=run(dcf(),mk({nod:11}),1000,0.5)!;   // 1° nod vs the 5–8° target
  expect(o.status).toBe('adjust');expect(o.advice?.en).toMatch(/Increase your chin nod gently by approximately 4°/);
 });
 it('does not give an exact-degree correction when the measurement is uncertain',()=>{
  const o=run(dcf(),mk({nod:11}),1000,0.5,{ok:true,confidence:0.95,jitter:4})!;
  expect(o.advice?.en).not.toMatch(/\d°/);expect(o.advice?.en).toMatch(/uncertain/);
 });
 it('is correct inside the range and reports reduce when above it',()=>{
  expect(run(dcf(),mk({nod:16}),1000,0.3)!.status).toBe('correct');
  expect(run(dcf(),mk({nod:28}),1000,0.3)!.advice?.en).toMatch(/Reduce your chin nod.*approximately 10°/);
 });
 it('flags compensations: trunk lean and shoulder shrug',()=>{
  const t=run(dcf(),mk({nod:16,trunk:12}),1000,0.3)!;expect(t.status).toBe('adjust');expect(t.compensations).toContain('trunk');
  const s=run(dcf(),mk({nod:16,torsoV:1.1}),1000,0.3)!;expect(s.compensations).toContain('shrug');
 });
 it('exercise 2 counts exactly one rep on completing the 8 s hold and requires release before another',()=>{
  const a=dcf('deep-flexor-2');                                      // nod range 8–12°, hold 8 s
  run(a,mk({nod:20}),1000,7);expect(a.reps).toBe(0);                 // hold too short
  run(a,base,9000,2);expect(a.reps).toBe(0);                         // released before the 8 s hold finished
  run(a,mk({nod:20}),11000,8.5);expect(a.reps).toBe(1);              // counted immediately after 8 s
  expect(a.phase).toBe('returning');
  run(a,mk({nod:20}),20000,2);expect(a.reps).toBe(1); // no double count without release
  run(a,base,22500,1);expect(a.reps).toBe(1);
  const b=dcf('deep-flexor-2');run(b,mk({nod:20,trunk:30}),1000,12);run(b,base,14000,1);expect(b.reps).toBe(0); // compensation blocks the rep
 });
 it('a short tracking dropout (<0.6 s) does not reset the hold, a long one does',()=>{
  const a=dcf('deep-flexor-2');run(a,mk({nod:20}),1000,4);
  run(a,base,5000,0.4);run(a,mk({nod:20}),5400,4.5);                 // 0.4 s glitch inside the hold
  run(a,mk({nod:20}),9900,0.5);expect(a.phase).toBe('returning');
  const b=dcf('deep-flexor-2');run(b,mk({nod:20}),1000,4);run(b,base,5000,1);expect(b.hold).toBe(0);
 });
 it('pauses analysis and counts nothing while landmarks are missing',()=>{
  const a=dcf();run(a,mk({nod:16}),1000,4);const h=a.hold;
  const o=a.analyze(null,5000,{ok:false,confidence:0});expect(o?.status).toBe('unavailable');
  for(let t=5100;t<5800;t+=100)a.analyze(null,t,{ok:false,confidence:0});expect(a.hold).toBe(h);
  expect(a.analyze(mk({nod:16}),6000,{ok:true,confidence:0.3})?.status).toBe('unavailable');
 });
});

describe('flexible matching (60% of the target counts as correct)',()=>{
 it('accepts small differences from the demonstrated movement',()=>{
  const o=run(dcf(),mk({nod:14}),1000,0.3)!;                 // 4° nod vs 5–8° target
  expect(o.status).toBe('correct');expect(o.match).toBeGreaterThanOrEqual(60);
 });
 it('shows a lower match score for a clearly different movement',()=>{
  const o=run(dcf(),mk({nod:11}),1000,0.3)!;
  expect(o.match).toBeLessThan(60);expect(o.status).toBe('adjust');
 });
 it('isometric walks through several directions and checks the hand when visible',()=>{
  const a=new ExerciseAnalyzer(TRACKER_CONFIGS['cervical-isometric']);a.calibrate(base);
  const o=run(a,mk(),1000,0.3)!;expect(o.step).toMatchObject({index:0,total:4});
  const far=run((()=>{const x=new ExerciseAnalyzer(TRACKER_CONFIGS['cervical-isometric']);x.calibrate(base);return x;})(),mk({lwx:1.8,lwy:0.2,rwx:-1.8,rwy:0.2}),1000,0.3)!;
  expect(far.message).toBe('hand');
  let t=1000;const seen=new Set<number>();for(let i=0;i<400;i++){const r=a.analyze(mk(),t,{ok:true,confidence:0.95});if(r?.step)seen.add(r.step.index);t+=100;}
  expect(seen.size).toBe(4);expect(a.reps).toBeGreaterThanOrEqual(4);
 });
});

describe('other exercises',()=>{
 it('isometric: one full direction counts one repetition, without waiting for all four',()=>{
  const a=new ExerciseAnalyzer(TRACKER_CONFIGS['cervical-isometric']);a.calibrate(base);
  run(a,mk(),1000,5.5);expect(a.reps).toBe(1);expect(a.stepIdx).toBe(1);
  run(a,mk(),7000,1);expect(a.reps).toBe(1);
 });
 it('isometric: drift, roll and shrug limits',()=>{
  const a=()=>{const x=new ExerciseAnalyzer(TRACKER_CONFIGS['cervical-isometric']);x.calibrate(base);return x;};
  expect(run(a(),mk(),1000,0.3)!.status).toBe('correct');
  expect(run(a(),mk({hx:0.08}),1000,0.3)!.message).toBe('drift');          // 8% of shoulder width
  expect(run(a(),mk({roll:8}),1000,0.3)!.message).toBe('roll');
  expect(run(a(),mk({neckH:0.38}),1000,0.3)!.compensations).toContain('shrug');
 });
 it('laser: counts a repositioning only when the return JPE is below the limit',()=>{
  const mkL=()=>{const x=new ExerciseAnalyzer(TRACKER_CONFIGS['laser-proprioception']);x.calibrate(base);return x;};
  const good=mkL();run(good,mk({yaw:10}),1000,2.5);run(good,mk({yaw:2}),4000,1);expect(good.reps).toBe(1);expect(good.lastJpe).toBeLessThan(6);
  const bad=mkL();run(bad,mk({yaw:10}),1000,2.5);run(bad,mk({yaw:14}),4000,2);expect(bad.reps).toBe(0);
 });
 it('tracking: time-on-target decides whether a trial counts; metrics are reported',()=>{
  const a=new ExerciseAnalyzer(TRACKER_CONFIGS['tracking-1']);a.calibrate(base);let t=1000,tt=0,o=null as ReturnType<ExerciseAnalyzer['analyze']>;
  for(let i=0;i<205;i++){const g=targetAt(tt,'tracking',1);o=a.analyze(mk({yaw:g.x*15,pitch:-g.y*15}),t,{ok:true,confidence:0.95});t+=100;tt+=0.1;}
  expect(a.reps).toBe(1);
  const keys=(o?.metrics??[]).map(m=>m.key);
  const b=new ExerciseAnalyzer(TRACKER_CONFIGS['tracking-1']);b.calibrate(base);
  for(let i=0;i<60;i++)o=b.analyze(mk({yaw:0}),1000+i*100,{ok:true,confidence:0.95});
  expect(['timeOnTarget','targetError','lag','gain','jerk','overshoot'].every(k=>(o?.metrics??[]).some(m=>m.key===k))).toBe(true);
  expect(keys.length).toBeGreaterThan(0);
  const c=new ExerciseAnalyzer(TRACKER_CONFIGS['tracking-1']);c.calibrate(base);for(let i=0;i<205;i++)c.analyze(mk({yaw:14}),1000+i*100,{ok:true,confidence:0.95});expect(c.reps).toBe(0);
 });
});

describe('measurement layer',()=>{
 const pose=(faceRight:boolean,w=640,h=480):Point[]=>{const p:Point[]=Array.from({length:33},()=>({x:0,y:0,visibility:0}));
  const set=(i:number,x:number,y:number)=>{p[i]={x:x/w,y:y/h,visibility:0.95};};
  const d=faceRight?1:-1;set(7,300,100);set(0,300+d*30,106);set(11,290,200);set(23,290,360);return p;};
 it('chin nod is identical whichever way the user faces and independent of video aspect ratio',()=>{
  const r=poseMeasurements(pose(true),{w:640,h:480},'side')!,l=poseMeasurements(pose(false),{w:640,h:480},'side')!;
  expect(r.nod).toBeCloseTo(l.nod!,5);expect(r.nod).toBeCloseTo(Math.atan2(6,30)*180/Math.PI,3);
 });
 it('returns null when landmarks are not confident',()=>{expect(poseMeasurements(pose(true).map(p=>({...p,visibility:0.2})),{w:640,h:480},'side')).toBeNull();});
 it('rejects an unstable calibration and accepts a steady one',()=>{
  const steady=Array.from({length:30},(_,i)=>mk({yaw:0.1*(i%3),nod:10+0.2*(i%2)}));
  expect(summarizeCalibration(steady).stable).toBe(true);
  const moving=Array.from({length:30},(_,i)=>mk({yaw:i}));
  const r=summarizeCalibration(moving);expect(r.stable).toBe(false);expect(r.worst).toBe('yaw');
 });
});

describe('session plans: exercise 1 = 15 reps, exercise 2 = 3 sets x 10 reps x 8 s hold',()=>{
 // one full repetition: nod into the video range, hold, return to the neutral baseline
 const oneRep=(a:ExerciseAnalyzer,nod:number,holdS:number,t0:number)=>{run(a,mk({nod}),t0,holdS+0.5);run(a,base,t0+(holdS+0.5)*1000,2.5);return t0+(holdS+0.5)*1000+2500+100;}; // neutral pause between reps (rep counts, then a 1.2 s lockout)
 it('exercise 1 counts 15 repetitions and the session ends exactly then',()=>{
  const a=dcf('deep-flexor-1');let t=1000,o=null as ReturnType<ExerciseAnalyzer['analyze']>;
  for(let i=1;i<=14;i++){t=oneRep(a,16,1,t);expect(a.reps).toBe(i);expect(a.done).toBe(false);}
  t=oneRep(a,16,1,t);expect(a.reps).toBe(15);expect(a.done).toBe(true);
  o=a.analyze(mk({nod:16}),t,{ok:true,confidence:0.95});expect(o?.done).toBe(true);expect(o?.status).toBe('done');expect(o?.targetReps).toBe(15);
  run(a,mk({nod:16}),t+100,5);expect(a.reps).toBe(15);                // nothing is counted after the session ended
 });
 it('a repetition below 85% of the video movement is not counted',()=>{
  const a=dcf('deep-flexor-1');run(a,mk({nod:14}),1000,2);run(a,base,3000,1.2);expect(a.reps).toBe(1);   // 4° vs 5–8°: ≥ 85% match → counts
  const b=dcf('deep-flexor-1');run(b,mk({nod:11}),1000,2);run(b,base,3000,1.2);expect(b.reps).toBe(0);   // 1° nod: clearly different → no rep
 });
 it('exercise 2: 10 reps per set, rest between sets, session ends after 3 sets',()=>{
  const a=dcf('deep-flexor-2');let t=1000;
  for(let set=1;set<=3;set++){
   for(let i=1;i<=10;i++){t=oneRep(a,20,8,t);expect(a.reps).toBe((set-1)*10+i);}
   if(set<3){
    expect(a.setIdx).toBe(set);expect(a.done).toBe(false);expect(a.restLeft).toBeGreaterThan(0);
    const r=a.analyze(mk({nod:20}),t,{ok:true,confidence:0.95});expect(r?.status).toBe('resting');expect(r?.message).toBe('setRest');
    const before=a.reps;t+=100;run(a,mk({nod:20}),t,31);t+=31000;expect(a.reps).toBe(before);expect(a.restLeft).toBe(0); // nothing is counted while resting
   }
  }
  expect(a.reps).toBe(30);expect(a.done).toBe(true);
  expect(a.analyze(mk(),t,{ok:true,confidence:0.95})?.totalSets).toBe(3);
 });
 it('exercises without a plan never end by themselves (the old 3-repetition stop is gone)',()=>{
  for(const id of ['cervical-isometric','laser-proprioception','tracking-1','tracking-2']){
   const a=new ExerciseAnalyzer(TRACKER_CONFIGS[id]);a.calibrate(base);
   for(let i=0;i<6;i++)(a as any).addRep();                          // well past 3 repetitions
   expect(a.done).toBe(false);expect(a.reps).toBe(6);
   expect(a.analyze(mk(),1000,{ok:true,confidence:0.95})?.done).toBe(false);
  }
 });
 it('a chin tuck that pulls the head BACK is not flagged as forward head sliding',()=>{
  const o=run(dcf('deep-flexor-2'),mk({nod:20,fwd:0.2-0.1}),1000,0.3)!;   // head moved back 10% of torso
  expect(o.compensations).not.toContain('translation');expect(o.status).toBe('correct');
 });
});

describe('laser: the dot follows the head in the mirrored preview (not inverted)',()=>{
 // raw (un-mirrored) camera image landmarks: moving the nose to the LEFT of the raw image = the user turns to THEIR right = to the RIGHT on the mirrored preview
 const face=(nx:number,ny:number)=>{const f:any[]=[];f[1]={x:nx,y:ny};f[33]={x:.4,y:.4};f[263]={x:.6,y:.4};f[152]={x:.5,y:.7};f[10]={x:.5,y:.2};return f;};
 const angles=(nx:number,ny:number)=>toScreenAngles(estimateHeadAngles(face(nx,ny))!);
 it('turning to the right moves the dot right, turning left moves it left, looking up moves it up',()=>{
  const c=angles(.5,.46),right=angles(.46,.46),left=angles(.54,.46),up=angles(.5,.42);
  expect(right.yaw-c.yaw).toBeGreaterThan(5);expect(left.yaw-c.yaw).toBeLessThan(-5);expect(up.pitch-c.pitch).toBeGreaterThan(5);
  const a=new ExerciseAnalyzer(TRACKER_CONFIGS['laser-proprioception']);a.calibrate({...base,...c});
  const o=a.analyze({...base,...right},1000,{ok:true,confidence:0.95})!;expect(o.dot.x).toBeGreaterThan(0);
  const l=a.analyze({...base,...left},1100,{ok:true,confidence:0.95})!;expect(l.dot.x).toBeLessThan(0);
  const u=a.analyze({...base,...up},1200,{ok:true,confidence:0.95})!;expect(u.dot.y).toBeLessThan(0);   // SVG y grows downward → up = negative
 });
 it('the first laser target is on the right and is reached by turning right (same direction as the dot)',()=>{
  const a=new ExerciseAnalyzer(TRACKER_CONFIGS['laser-proprioception']);a.calibrate(base);
  const o=a.analyze(mk({yaw:0}),1000,{ok:true,confidence:0.95})!;expect(o.target.x).toBeGreaterThan(0);
  const hit=run(a,mk({yaw:10}),1100,0.3)!;expect(hit.hit).toBe(true);expect(hit.dot.x).toBeGreaterThan(0);
  const wrongWay=run((()=>{const x=new ExerciseAnalyzer(TRACKER_CONFIGS['laser-proprioception']);x.calibrate(base);return x;})(),mk({yaw:-10}),1000,0.3)!;
  expect(wrongWay.hit).toBe(false);
 });
});

describe('side view without a visible hip (laptop webcam: head + shoulders only)',()=>{
 const pose=(hip:boolean):Point[]=>{const p:Point[]=Array.from({length:33},()=>({x:0,y:0,visibility:0}));
  const set=(i:number,x:number,y:number)=>{p[i]={x:x/640,y:y/480,visibility:0.95};};
  set(7,300,200);set(0,330,206);set(11,290,330);if(hip)set(23,290,520>480?470:470);return p;};
 it('still returns chin-nod measurements and a stable scale',()=>{
  const m=poseMeasurements(pose(false),{w:640,h:480},'side');
  expect(m).not.toBeNull();expect(m!.nod).toBeCloseTo(Math.atan2(6,30)*180/Math.PI,3);
  expect(m!.trunk).toBeUndefined();expect(Number.isFinite(m!.fwd!)&&Number.isFinite(m!.lift!)&&Number.isFinite(m!.torsoV!)).toBe(true);
 });
 it('a chin nod is detected from head+shoulders only, and the analyzer reports it',()=>{
  const at=(noseY:number)=>{const p=pose(false);p[0]={x:330/640,y:noseY/480,visibility:0.95};return poseMeasurements(p,{w:640,h:480},'side')!;};
  const neutral=at(206),nodded=at(212);                                // ~ +6° more nod
  const a=new ExerciseAnalyzer(TRACKER_CONFIGS['deep-flexor-1']);a.calibrate({yaw:0,pitch:0,roll:0,...neutral});
  const o=run(a,{yaw:0,pitch:0,roll:0,...nodded},1000,0.3)!;
  expect(o.status).not.toBe('unavailable');expect(o.primary!.value!).toBeGreaterThan(4);
 });
});

describe('flexibility: 60% of the target is enough', () => {
  it('thresholds: a repetition counts from 60% of the target, a session from 60% of the planned repetitions', async () => {
    const e = await import('./engine');
    expect(e.MATCH_OK).toBe(0.45);
    expect(e.COUNT_MATCH).toBe(0.15);
    expect(e.SESSION_PASS_FRACTION).toBe(0.6);
    expect(e.planPassed(TRACKER_CONFIGS['deep-flexor-1'].plan, 8)).toBe(false);    // 8 of 15
    expect(e.planPassed(TRACKER_CONFIGS['deep-flexor-1'].plan, 9)).toBe(true);     // 9 of 15 = 60%
    expect(e.planPassed(TRACKER_CONFIGS['deep-flexor-2'].plan, 17)).toBe(false);   // 17 of 30
    expect(e.planPassed(TRACKER_CONFIGS['deep-flexor-2'].plan, 18)).toBe(true);    // 18 of 30 = 60%
    expect(e.planPassed(undefined, 99)).toBe(false);                               // exercises without a plan never "complete"
  });
  it('3° of a 5–8° nod (60%) is accepted, 1.5° is not', () => {
    expect(run(dcf('deep-flexor-1'), mk({ nod: 13 }), 1000, 0.4)!.hit).toBe(true);
    expect(run(dcf('deep-flexor-1'), mk({ nod: 11.5 }), 1000, 0.4)!.hit).toBe(false);
  });
  it('doing 60% of the planned repetitions counts as a completed session', () => {
    const plan = TRACKER_CONFIGS['deep-flexor-1'].plan!;
    expect(Math.ceil(plan.repsPerSet * plan.sets * SESSION_PASS_FRACTION)).toBe(9);
  });
  it('exercise 2 keeps counting the hold from a 20% match; exercise 1 does not', () => {
    const rep = (id: string, nodD: number) => { const a = dcf(id); run(a, mk({ nod: 10 + nodD }), 1000, 9.5); run(a, base, 10500, 2.5); return a.reps; };
    expect(rep('deep-flexor-2', 2)).toBe(1);   // 2° of an 8–12° target = 25% → counts
    expect(rep('deep-flexor-2', 1)).toBe(0);   // 1° = 12% → too little movement
    expect(rep('deep-flexor-2', 0)).toBe(0);   // no movement at all never counts
    expect(rep('deep-flexor-1', 2)).toBe(0);   // exercise 1 still needs 60%
  });
});
