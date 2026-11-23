import { Gender } from '../utils/gender';

/** Arabic instructions follow the patient's grammatical gender (feminine by default). Shown only in Arabic. */
export function GenderToggle({
  gender,
  setGender,
  language,
}: {
  gender: Gender;
  setGender: (g: Gender) => void;
  language: string;
}) {
  if (language !== 'ar') return null;
  return (
    <label style={{ fontSize: 13, display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      صيغة الخطاب
      <select value={gender} onChange={(e) => setGender(e.target.value as Gender)} aria-label="صيغة الخطاب">
        <option value="female">مؤنث (مريضة)</option>
        <option value="male">مذكر (مريض)</option>
      </select>
    </label>
  );
}
