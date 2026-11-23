import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from './api';

/**
 * Safety gate for camera exercise. It FAILS CLOSED: exercise is allowed only after the latest safety screening was
 * successfully loaded and is clear. A network error, a missing screening or a flagged answer all keep the camera locked.
 */
export type SafetyState = 'checking' | 'ok' | 'blocked' | 'missing' | 'error';
type Assessment = { answers?: { warningSymptoms?: string[]; pain?: number } } | null;

export const PAIN_BLOCK = 7;
export function safetyStateFromAssessment(a: Assessment): SafetyState {
  if (!a) return 'missing';
  if ((a.answers?.warningSymptoms?.length ?? 0) > 0 || (a.answers?.pain ?? 0) >= PAIN_BLOCK) return 'blocked';
  return 'ok';
}
/** Pain reported before/after a session: a rise of 3+ points, or a high absolute value, should stop exercising until reviewed. */
export const painFlag = (before: number | null, after: number | null) =>
  after !== null && (after >= PAIN_BLOCK || (before !== null && after - before >= 3));

export function useSafetyGate() {
  const [state, setState] = useState<SafetyState>('checking');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setState('checking');
    apiFetch('/api/neck/assessment/latest')
      .then(async (r) => {
        if (!r.ok) throw new Error('safety check failed');
        const a = (await r.json()) as Assessment;
        if (alive) setState(safetyStateFromAssessment(a));
      })
      .catch(() => alive && setState('error'));
    return () => { alive = false; };
  }, [attempt]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const block = useCallback(() => setState('blocked'), []);
  return { state, retry, block };
}

export const safetyMessage = (s: SafetyState, tr: (en: string, ar: string) => string): string | null =>
  s === 'checking' ? tr('Checking your safety screening…', 'جاري التحقق من فحص الأمان…')
  : s === 'missing' ? tr('Please complete the neck questionnaire and safety screening first.', 'من فضلك أكملي استبيان الرقبة وفحص الأمان أولًا.')
  : s === 'blocked' ? tr('Safety symptoms or high pain were reported. Please see your physiotherapist before exercising.', 'تم الإبلاغ عن أعراض تحذيرية أو ألم شديد. راجعي أخصائي العلاج الطبيعي قبل التمرين.')
  : s === 'error' ? tr('Could not verify your safety screening (connection problem). Exercise stays locked until it can be checked.', 'تعذّر التحقق من فحص الأمان (مشكلة اتصال). التمرين هيفضل مقفول لحد ما يتم التحقق.')
  : null;
