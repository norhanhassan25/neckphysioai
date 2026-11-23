import { describe, expect, it } from 'vitest';
import { answersSchema, exerciseSchema, sessionSchema } from '../src/routes/neck.js';

const base = { exerciseId: 'deep-flexor-2', durationSeconds: 600, trackingQuality: 'good' as const, notes: [] };

describe('neck session schema (structured results)', () => {
  it('accepts the structured fields a doctor needs to chart progress', () => {
    const r = sessionSchema.safeParse({
      ...base, repsCompleted: 30, repsTarget: 30, setsCompleted: 3, setsTarget: 3, holdSeconds: 8,
      matchPercent: 91.5, timeInTargetSeconds: 420, planCompleted: true, painBefore: 2, painAfter: 3,
      stoppedForSymptoms: false, selfEffort: 4, metrics: { nodDeg: 9.4 },
    });
    expect(r.success).toBe(true);
  });
  it('still accepts an old client that sends no structured fields', () => {
    expect(sessionSchema.safeParse(base).success).toBe(true);
  });
  it('rejects impossible values', () => {
    expect(sessionSchema.safeParse({ ...base, painBefore: 11 }).success).toBe(false);
    expect(sessionSchema.safeParse({ ...base, matchPercent: 140 }).success).toBe(false);
    expect(sessionSchema.safeParse({ ...base, setsCompleted: -1 }).success).toBe(false);
  });
});

describe('red-flag screening', () => {
  const ok = { pain: 3, area: 'center', duration: 'weeks', restriction: false, painfulMovement: 'none', ndi: Array(10).fill(1) };
  it('knows the extra contraindication flags (instability, myelopathy signs, VBI-type dizziness, surgery)', () => {
    for (const f of ['dizziness_with_neck_movement', 'balance_or_hand_clumsiness', 'bladder_bowel_change', 'night_pain_fever_weight_loss', 'recent_neck_surgery', 'known_neck_instability'])
      expect(answersSchema.safeParse({ ...ok, warningSymptoms: [f] }).success).toBe(true);
  });
  it('rejects unknown flags', () => {
    expect(answersSchema.safeParse({ ...ok, warningSymptoms: ['made_up'] }).success).toBe(false);
  });
});

describe('doctor dosage', () => {
  const ex = { title: 'Chin tuck', description: '', instructions: '', videoUrl: null, active: true };
  it('accepts a full plan or none, with sane limits', () => {
    expect(exerciseSchema.safeParse({ ...ex, planReps: 10, planSets: 3, planHoldSeconds: 8, planRestSeconds: 30 }).success).toBe(true);
    expect(exerciseSchema.safeParse({ ...ex, planReps: null, planSets: null, planHoldSeconds: null, planRestSeconds: null }).success).toBe(true);
    expect(exerciseSchema.safeParse({ ...ex, planReps: 500 }).success).toBe(false);
    expect(exerciseSchema.safeParse({ ...ex, planHoldSeconds: 120 }).success).toBe(false);
  });
});
