import { describe, expect, it } from 'vitest';
import { allCheers, cheerFor, FIRST_REP, HALFWAY, LAST_REP, Progress, SESSION_DONE, SESSION_PASSED } from './encouragement';
import { FEMININE_FORMS, genderize } from '../utils/gender';

const plan15 = { repsPerSet: 15, sets: 1 }, plan3x10 = { repsPerSet: 10, sets: 3 };
const P = (reps: number, setsDone = 0, done = false) => ({ reps, setsDone, done });

describe('encouragement', () => {
  it('says nothing unless a repetition was just counted', () => {
    expect(cheerFor(null, P(1), plan15)).toBeNull();
    expect(cheerFor(P(3), P(3), plan15)).toBeNull();
  });
  it('marks the first rep, the halfway point, the last rep and the end of the session', () => {
    expect(cheerFor(P(0), P(1), plan15)).toBe(FIRST_REP);
    expect(cheerFor(P(6), P(7), plan15)).toBe(HALFWAY);
    expect(cheerFor(P(13), P(14), plan15)).toBe(LAST_REP);
    expect(cheerFor(P(14), P(15, 1, true), plan15)).toBe(SESSION_DONE);
  });
  it('celebrates each finished set with a rest reminder, and a pass before the full plan', () => {
    expect(cheerFor(P(9), P(10, 1), plan3x10)!.en).toContain('Set 1 of 3');
    expect(cheerFor(P(21), P(22), plan3x10, true)).toBe(SESSION_PASSED);
  });
  it('other reps get a rotating short cheer (never the same one twice in a row)', () => {
    const a = cheerFor(P(2), P(3), plan15), b = cheerFor(P(3), P(4), plan15);
    expect(a).not.toBeNull(); expect(b).not.toBeNull(); expect(a).not.toEqual(b);
  });
  it('never mentions scores, percentages or pushing through pain', () => {
    for (const c of allCheers()) {
      expect(c.en + c.ar).not.toMatch(/%|٪|score|perfect|مثالي/i);
      expect(c.en).not.toMatch(/push through|no pain no gain|harder/i);
    }
  });
  it('every Arabic cheer converts fully to the masculine form for male patients', () => {
    for (const c of allCheers()) {
      const male = genderize(c.ar, 'male');
      expect(male).not.toMatch(/تستاهلي|شغالة|إنتِ|تكوني/);
      for (const f of FEMININE_FORMS) expect(male).not.toMatch(new RegExp(`(?<![\\u0600-\\u06FF])و?${f}(?![\\u0600-\\u06FF])`));
    }
  });
});

import { ExerciseAnalyzer, Measurement, planPassed } from './engine';
import { TRACKER_CONFIGS } from './config';

describe('encouragement driven by the real analyzer', () => {
  const base: Measurement = { yaw: 0, pitch: 0, roll: 0, nod: 10, cva: 55, lift: 0.5, fwd: 0.2, torsoV: 1, hx: 0, hy: -0.5 };
  it('gives the right message at the first rep, at the end of set 1 and at the end of the session', () => {
    const cfg = { ...TRACKER_CONFIGS['deep-flexor-1'], plan: { repsPerSet: 2, sets: 2, restSeconds: 1 } };
    const a = new ExerciseAnalyzer(cfg);
    a.calibrate(base);
    let t = 1000, prev: Progress | null = null;
    const seen: string[] = [];
    const feed = (nod: number, seconds: number) => {
      for (let k = 0; k < seconds * 10; k++, t += 100) {
        const o = a.analyze({ ...base, nod: base.nod! + nod }, t, { ok: true, confidence: 0.95, jitter: 0.3 })!;
        const cur: Progress = { reps: o.reps, setsDone: o.done ? o.totalSets : Math.max(0, o.setNo - 1), done: o.done };
        const c = cheerFor(prev, cur, cfg.plan, !o.done && planPassed(cfg.plan, cur.reps) && !planPassed(cfg.plan, prev?.reps ?? 0));
        prev = cur;
        if (c) seen.push(c.en);
      }
    };
    feed(0, 1);
    for (let i = 0; i < 4; i++) { feed(6.5, 1.6); feed(0, 2.6); if (i === 1) feed(0, 2); }
    expect(seen[0]).toBe(FIRST_REP.en);
    expect(seen.some((m) => m.includes('Set 1 of 2'))).toBe(true);
    expect(seen[seen.length - 1]).toBe(SESSION_DONE.en);
  });
});
