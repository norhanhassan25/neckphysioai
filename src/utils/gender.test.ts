import { describe, expect, it } from 'vitest';
import { genderize } from './gender';

describe('genderize', () => {
  it('keeps the feminine text for female patients', () => {
    expect(genderize('ثبتي رأسك ولا ترفعيهم', 'female')).toBe('ثبتي رأسك ولا ترفعيهم');
  });
  it('converts instructions to the masculine form for male patients', () => {
    expect(genderize('ثبتي رأسك واضغطي بلطف', 'male')).toBe('ثبت رأسك واضغط بلطف');
    expect(genderize('أرخي كتفيك ولا ترفعيهم.', 'male')).toBe('أرخِ كتفيك ولا ترفعهم.');
    expect(genderize('أحسنتِ!', 'male')).toBe('أحسنت!');
    expect(genderize('اتحركتي أثناء المعايرة. ثبتي وأعيدي المعايرة.', 'male')).toBe('اتحركت أثناء المعايرة. ثبت وأعد المعايرة.');
  });
  it('does not touch words that merely contain a feminine form, or English', () => {
    expect(genderize('وضعي الحالي', 'male')).toBe('وضعي الحالي');
    expect(genderize('Hold still', 'male')).toBe('Hold still');
  });
});
