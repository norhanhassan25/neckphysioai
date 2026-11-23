import { useState } from 'react';

/**
 * Arabic instructions are written in the feminine form. This converts them to the masculine form for male patients
 * (word-level, so it never touches English text). The choice is remembered in the browser.
 */
export type Gender = 'female' | 'male';
const KEY = 'neckphysio.gender';

const PAIRS: Record<string, string> = {
  أجيبي: 'أجب', أحسنتِ: 'أحسنت', أرخي: 'أرخِ', أظهري: 'أظهر', أنتِ: 'أنت', ابدئي: 'ابدأ', ابقي: 'ابقَ', اتبعي: 'اتبع',
  اتحركتي: 'اتحركت', اختاري: 'اختر', ادخلي: 'ادخل', ارتاحي: 'ارتاح', ارجعي: 'ارجع', ارفعي: 'ارفع', استعدي: 'استعد',
  اضغطي: 'اضغط', اقفي: 'اقف', بتضغطي: 'بتضغط', تجنبي: 'تجنب', وتجنبي: 'وتجنب', ترفعي: 'ترفع', ترفعيهم: 'ترفعهم',
  تدوريه: 'تدوره', تدفعيه: 'تدفعه', تحركيه: 'تحركه', تحركيها: 'تحركها', تميلي: 'تميل', توقفي: 'توقف', تُكملي: 'تُكمل',
  ثبتي: 'ثبت', حركي: 'حرك', حطي: 'حط', راجعي: 'راجع', رجعي: 'رجع', زودي: 'زود', عدّلي: 'عدّل', قارني: 'قارن',
  قللي: 'قلل', نزلي: 'نزل', استمري: 'استمر', عملتي: 'عملت', خلصتي: 'خلصت', حسيتي: 'حسيت', وقولي: 'وقول', قولي: 'قول', كملي: 'كمل', تستاهلي: 'تستاهل', إنتِ: 'إنت', شغالة: 'شغال', تكوني: 'تكون', وأعيدي: 'وأعد', واتركي: 'واترك', واجهي: 'واجه', وصلتي: 'وصلت', تشعرين: 'تشعر', حالتكِ: 'حالتك',
};
const AR = '\\u0600-\\u06FF';
// an optional leading «و» (and) is allowed in front of any listed word, e.g. واضغطي
const RE = new RegExp(`(?<![${AR}])(و?)(${Object.keys(PAIRS).join('|')})(?![${AR}])`, 'g');

export const FEMININE_FORMS = Object.keys(PAIRS);
export const genderize = (ar: string, gender: Gender): string => (gender === 'male' ? ar.replace(RE, (_m, pre: string, w: string) => pre + (PAIRS[w] ?? w)) : ar);

export const getGender = (): Gender => {
  try { return localStorage.getItem(KEY) === 'male' ? 'male' : 'female'; } catch { return 'female'; }
};
export function useGender(): [Gender, (g: Gender) => void] {
  const [g, setG] = useState<Gender>(getGender);
  const set = (next: Gender) => {
    setG(next);
    try { localStorage.setItem(KEY, next); } catch { /* private mode: keep it for this visit only */ }
  };
  return [g, set];
}
