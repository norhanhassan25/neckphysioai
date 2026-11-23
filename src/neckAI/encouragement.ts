/**
 * Short, warm messages shown while exercising. They never mention scores or percentages, never push the patient to
 * continue through pain, and are written in the feminine Arabic form (converted for male patients by utils/gender.ts).
 */
export type Cheer = { en: string; ar: string };
type Plan = { repsPerSet: number; sets: number } | undefined;

const REP: Cheer[] = [
  { en: 'Nice one!', ar: 'حلو أوي!' },
  { en: 'Well done, keep it smooth.', ar: 'أحسنتِ، كملي بهدوء.' },
  { en: 'Great control!', ar: 'تحكم ممتاز!' },
  { en: 'That’s it, nice and gentle.', ar: 'كده تمام، بلطف وهدوء.' },
  { en: 'You’re doing really well.', ar: 'إنتِ شغالة كويس جدًا.' },
  { en: 'Lovely, keep going at your own pace.', ar: 'جميل، استمري على راحتك.' },
];
export const FIRST_REP: Cheer = { en: 'Great start! That’s your first one.', ar: 'بداية رائعة! دي أول واحدة.' };
export const HALFWAY: Cheer = { en: 'You’re halfway there. Well done!', ar: 'وصلتي للنص. أحسنتِ!' };
export const LAST_REP: Cheer = { en: 'Last one! You can do it.', ar: 'آخر واحدة! إنتِ قدها.' };
export const HOLD_HALF: Cheer = { en: 'Hold steady, you’re doing well.', ar: 'ثبتي كده، إنتِ شغالة كويس.' };
export const SET_DONE = (done: number, sets: number): Cheer => ({
  en: `Set ${done} of ${sets} done. Rest well, and tell your doctor if anything hurt.`,
  ar: `المجموعة ${done} من ${sets} خلصت. ارتاحي كويس، وقولي للدكتور لو حسيتي بأي ألم.`,
});
export const SESSION_DONE: Cheer = {
  en: 'Session complete. Well done, you should be proud!',
  ar: 'الجلسة اكتملت. أحسنتِ، تستاهلي كل خير!',
};
export const SESSION_PASSED: Cheer = {
  en: 'You have done enough for a full session. Great effort!',
  ar: 'عملتي كفاية لجلسة كاملة. مجهود رائع!',
};
export const REST_OVER: Cheer = {
  en: 'Rest is over. Start again when you are ready.',
  ar: 'الراحة خلصت. ابدئي لما تكوني جاهزة.',
};

export type Progress = { reps: number; setsDone: number; done: boolean };

/** Message for the moment `prev` → `cur` (null when there is nothing worth saying). Highest priority first. */
export function cheerFor(prev: Progress | null, cur: Progress, plan: Plan, passedNow = false): Cheer | null {
  if (!prev || cur.reps <= prev.reps) return null;
  if (cur.done) return SESSION_DONE;
  if (plan && cur.setsDone > prev.setsDone && plan.sets > 1) return SET_DONE(cur.setsDone, plan.sets);
  if (passedNow) return SESSION_PASSED;
  const total = plan ? plan.repsPerSet * plan.sets : 0;
  if (cur.reps === 1) return FIRST_REP;
  if (total > 0) {
    if (cur.reps === total - 1 && total > 3) return LAST_REP;
    if (cur.reps === Math.floor(total / 2) && total >= 6) return HALFWAY;
  }
  return REP[(cur.reps - 2 + REP.length) % REP.length];
}
export const allCheers = (): Cheer[] => [
  ...REP,
  FIRST_REP,
  HALFWAY,
  LAST_REP,
  HOLD_HALF,
  SET_DONE(1, 3),
  SESSION_DONE,
  SESSION_PASSED,
  REST_OVER,
];
