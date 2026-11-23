/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { TRACKER_CONFIGS } from './config';
import { Measurement } from './engine';
import { Recording, replay } from './replay';
import { withDoctorPlan } from './planOverride';

const base: Measurement = { yaw: 0, pitch: 0, roll: 0, nod: 10, cva: 55, lift: 0.5, fwd: 0.2, torsoV: 1, hx: 0, hy: -0.5 };
// deterministic pseudo-noise so the test is stable but the signal is not perfectly clean
const noise = (i: number, amp: number) => amp * Math.sin(i * 12.9898) * Math.cos(i * 4.1414);

/** A realistic-looking session: rest, nod, hold, rest — repeated, with measurement noise (±0.8°) and 2 short dropouts. */
function recording(id: string, reps: number, nodDeg: number, holdS: number, restEvery = 0, restS = 32): Recording {
  const frames: Recording['frames'] = [];
  let t = 1000, i = 0;
  const push = (nod: number, seconds: number, drop = false) => {
    for (let k = 0; k < seconds * 10; k++, i++, t += 100)
      frames.push({ t, m: drop ? null : { ...base, nod: base.nod! + nod + noise(i, 0.8) }, conf: drop ? 0 : 0.9, jitter: 0.5 });
  };
  for (let r = 0; r < reps; r++) {
    push(0, 2.5);
    push(nodDeg, holdS / 2); if (r % 3 === 1) push(nodDeg, 0.3, true); push(nodDeg, holdS / 2 + 0.6);
    push(0, 2.5);
    if (restEvery && (r + 1) % restEvery === 0) push(0, restS);        // the patient rests between sets
  }
  return { exerciseId: id, baseline: base, frames };
}

describe('replaying recorded sessions through the engine', () => {
  it('a noisy 15-rep session of exercise 1 still reaches 15 reps and finishes', () => {
    const rec = JSON.parse(JSON.stringify(recording('deep-flexor-1', 15, 6.5, 1)));          // JSON round trip = file on disk
    const { analyzer, last } = replay(TRACKER_CONFIGS['deep-flexor-1'], rec);
    expect(analyzer.reps).toBe(15);expect(analyzer.done).toBe(true);expect(last?.status).toBe('done');
  });
  it('a noisy 3 x 10 x 8 s session of exercise 2 finishes after the third set', () => {
    const { analyzer } = replay(TRACKER_CONFIGS['deep-flexor-2'], recording('deep-flexor-2', 30, 10, 8, 10));
    expect(analyzer.reps).toBe(30);expect(analyzer.setIdx).toBe(3);expect(analyzer.done).toBe(true);
  });
  it('a session where the patient barely moves counts nothing', () => {
    const { analyzer } = replay(TRACKER_CONFIGS['deep-flexor-1'], recording('deep-flexor-1', 5, 0.5, 1));
    expect(analyzer.reps).toBe(0);
  });
  it('replays any real recording dropped into src/neckAI/fixtures/*.json and checks its "expect" block', () => {
    const files = import.meta.glob('./fixtures/*.json', { eager: true }) as Record<string, { default: Recording }>;
    for (const [name, mod] of Object.entries(files)) {
      const rec = mod.default; const { analyzer } = replay(TRACKER_CONFIGS[rec.exerciseId], rec);
      if (rec.expect?.reps !== undefined) expect(analyzer.reps, name).toBe(rec.expect.reps);
      if (rec.expect?.minReps !== undefined) expect(analyzer.reps, name).toBeGreaterThanOrEqual(rec.expect.minReps);
      if (rec.expect?.done !== undefined) expect(analyzer.done, name).toBe(rec.expect.done);
    }
  });
});

describe('doctor-set dosage', () => {
  const c = TRACKER_CONFIGS['deep-flexor-2'];
  it('overrides reps, sets, hold and rest', () => {
    const o = withDoctorPlan(c, { planReps: 8, planSets: 2, planHoldSeconds: 6, planRestSeconds: 45 });
    expect(o.plan).toEqual({ repsPerSet: 8, sets: 2, restSeconds: 45 });expect(o.holdSeconds).toBe(6);expect(o.targets.holdSeconds).toBe(6);
    const { analyzer } = replay(o, recording('deep-flexor-2', 8, 10, 6, 4));
    expect(analyzer.setIdx).toBe(1);expect(analyzer.repsInSet).toBe(0);
  });
  it('keeps defaults when nothing was loaded or the plan is incomplete, and frees the session when the doctor cleared it', () => {
    expect(withDoctorPlan(c, undefined)).toBe(c);
    expect(withDoctorPlan(c, { planReps: 8 })).toBe(c);
    expect(withDoctorPlan(c, { planReps: null, planSets: null, planHoldSeconds: null, planRestSeconds: null }).plan).toBeUndefined();
  });
});
