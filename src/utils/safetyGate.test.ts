import { describe, expect, it } from 'vitest';
import { painFlag, safetyStateFromAssessment } from './safetyGate';

describe('safety gate fails closed', () => {
  it('only a loaded, clear screening allows exercise', () => {
    expect(safetyStateFromAssessment({ answers: { warningSymptoms: [], pain: 3 } })).toBe('ok');
  });
  it('a missing screening, any red flag or high pain blocks', () => {
    expect(safetyStateFromAssessment(null)).toBe('missing');
    expect(safetyStateFromAssessment({ answers: { warningSymptoms: ['recent_neck_surgery'], pain: 0 } })).toBe('blocked');
    expect(safetyStateFromAssessment({ answers: { warningSymptoms: [], pain: 7 } })).toBe('blocked');
    expect(safetyStateFromAssessment({})).toBe('ok'); // no flags recorded in an otherwise valid record
  });
  it('flags a pain rise of 3 points or severe pain after a session', () => {
    expect(painFlag(2, 5)).toBe(true);
    expect(painFlag(2, 4)).toBe(false);
    expect(painFlag(null, 8)).toBe(true);
    expect(painFlag(3, null)).toBe(false);
  });
});
