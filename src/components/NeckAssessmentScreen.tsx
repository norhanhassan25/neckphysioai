import { useEffect, useState } from 'react';
import { store } from '../game/store';
import { apiFetch } from '../utils/api';
import { TopBar } from './primitives';
import { NDI_SECTIONS, ndiScore } from '../data/neckNDI';
import { useLanguage } from '../i18n/LanguageContext';

type AssessmentResult = { status?: string; ndiPercent?: number | null; matchReason?: string; exerciseId?: string | null };

type Answers = {
  pain: number;
  area: 'left' | 'right' | 'center' | 'both';
  duration: 'recent' | 'weeks' | 'long';
  restriction: boolean;
  painfulMovement: 'left' | 'right' | 'both' | 'none';
  warningSymptoms: string[];
  ndi: (number | null)[];
};

const initial: Answers = {
  pain: 0,
  area: 'center',
  duration: 'recent',
  restriction: false,
  painfulMovement: 'none',
  warningSymptoms: [],
  ndi: Array(10).fill(null),
};

// Red flags: ANY checked item blocks camera exercise until a clinician has cleared the patient (also enforced by the backend).
const symptoms = [
  { id: 'dizziness', ar: 'الدوخة أو الدوار', en: 'Dizziness or vertigo' },
  { id: 'numbness', ar: 'التنميل أو فقدان الإحساس', en: 'Numbness or loss of sensation' },
  { id: 'weakness', ar: 'ضعف في الذراع أو اليد', en: 'Arm or hand weakness' },
  { id: 'severe_headache', ar: 'صداع شديد أو غير معتاد', en: 'Severe or unusual headache' },
  { id: 'recent_trauma', ar: 'إصابة حديثة في الرقبة أو الرأس', en: 'Recent neck or head trauma' },
  { id: 'dizziness_with_neck_movement', ar: 'دوخة أو تشوش في الرؤية أو صعوبة في الكلام/البلع عند تحريك الرقبة', en: 'Dizziness, blurred vision, or trouble speaking/swallowing when moving the neck' },
  { id: 'balance_or_hand_clumsiness', ar: 'اضطراب في التوازن أو المشي، أو خرقاء/ضعف في حركة اليدين (مثل الكتابة أو زرار القميص)', en: 'Balance or walking problems, or clumsy hands (writing, buttoning)' },
  { id: 'bladder_bowel_change', ar: 'تغيّر في التحكم بالبول أو البراز', en: 'New change in bladder or bowel control' },
  { id: 'night_pain_fever_weight_loss', ar: 'ألم ليلي مستمر، أو حرارة، أو نزول وزن غير مبرر', en: 'Constant night pain, fever, or unexplained weight loss' },
  { id: 'recent_neck_surgery', ar: 'عملية حديثة في الرقبة أو العمود الفقري', en: 'Recent neck or spine surgery' },
  { id: 'known_neck_instability', ar: 'عدم استقرار معروف في فقرات الرقبة (مثل الروماتويد أو إصابة أربطة)', en: 'Known cervical instability (e.g. rheumatoid arthritis, ligament injury)' },
];

const areas: { value: Answers['area']; label: string }[] = [
  { value: 'center', label: 'منتصف الرقبة' },
  { value: 'left', label: 'الجانب الأيسر' },
  { value: 'right', label: 'الجانب الأيمن' },
  { value: 'both', label: 'الجانبان' },
];
const durations: { value: Answers['duration']; label: string }[] = [
  { value: 'recent', label: 'أقل من أسبوع' },
  { value: 'weeks', label: 'من أسبوع إلى ستة أسابيع' },
  { value: 'long', label: 'أكثر من ستة أسابيع' },
];
const movements: { value: Answers['painfulMovement']; label: string }[] = [
  { value: 'none', label: 'لا توجد حركة مؤلمة' },
  { value: 'left', label: 'عند تحريك الرأس لليسار' },
  { value: 'right', label: 'عند تحريك الرأس لليمين' },
  { value: 'both', label: 'في الاتجاهين' },
];

export function NeckAssessmentScreen() {
  const {language}=useLanguage();
  const tr=(ar:string,en:string)=>language==='ar'?ar:en;
  const [answers, setAnswers] = useState<Answers>(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [latest, setLatest] = useState<AssessmentResult | null>(null);
  const score = ndiScore(answers.ndi);

  useEffect(() => {
    apiFetch('/api/neck/assessment/latest')
      .then(r => r.ok ? r.json() : null)
      .then((data: AssessmentResult | null) => {
        setLatest(data);
        // NDI is an outcome measure, not an automatic exercise prescription.
      })
      .catch(() => {});
  }, []);

  const select = <K extends keyof Answers>(field: K, value: Answers[K]) =>
    setAnswers(a => ({ ...a, [field]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (score.answered < 8) {
      setMessage(tr('من فضلك أجب عن ثمانية أقسام على الأقل من الاستبيان.','Please answer at least eight NDI sections.'));
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const r = await apiFetch('/api/neck/assessment', {
        method: 'POST',
        body: JSON.stringify(answers),
      });
      const data = await r.json();
      if (!r.ok) throw new Error('تعذّر حفظ الاستبيان. تأكد من الاتصال ثم حاول مرة أخرى.');
      setLatest(data);
      if (data.matchReason !== 'safety_review' && data.matchReason !== 'high_ndi_review' && data.matchReason !== 'incomplete_ndi') {
        store.setScreen('library');
      } else {
        setMessage(data.matchReason === 'high_ndi_review' ? tr('النتيجة 70% أو أكثر؛ يُرجى مراجعة أخصائي العلاج الطبيعي قبل أداء التمارين.','NDI is 70% or higher. Please consult a physiotherapist before exercising.') : data.matchReason === 'safety_review'
          ? tr('لا يمكن الانتقال إلى التمرين بسبب إجابات فحص الأمان. يلزم مراجعة أخصائي العلاج الطبيعي أولًا.','Exercise cannot start because of safety screening responses. Please consult your physiotherapist.')
          : data.matchReason === 'no_active_video'
            ? tr('الفيديوهات المخصصة لهذه المجموعة غير مفعّلة. يرجى مراجعة إعدادات مكتبة الفيديو.','Videos for this group are not active. Please check the exercise library settings.')
            : tr('لم يُحدد تمرين آمن مناسب. يُرجى مراجعة الطبيب.','No eligible exercise could be selected. Please consult your physiotherapist.'));
      }
    } catch {
      setMessage(tr('حدث خطأ أثناء حفظ الاستبيان. يُرجى المحاولة مرة أخرى.','Unable to save assessment. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen dots-bg" dir={language==='ar'?'rtl':'ltr'} lang={language} style={{ minHeight: '100vh', padding: 24, textAlign: 'right' }}>
      <TopBar here={0} steps={language==='ar'?['الاستبيان','الفيديو','الكاميرا']:['Assessment','Video','Camera']} />
      <form onSubmit={submit} className="plush" style={{ maxWidth: 700, margin: '32px auto', padding: 28, background: 'var(--surface)', display: 'grid', gap: 22 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>{tr('استبيان إعاقة آلام الرقبة','Neck Disability Index Questionnaire')}</h1>
        <p>{tr('اختاري إجابة واحدة لكل قسم، بما يصف حالتكِ الآن بأقرب صورة.','Select one answer per section that best describes your current condition.')}</p>
        <section aria-label="استبيان إعاقة آلام الرقبة">
          {NDI_SECTIONS.map((section, i) => (
            <fieldset key={i} style={{ border: '1px solid #aaa', borderRadius: 12, padding: 12, marginBottom: 12 }}>
              <legend>{i + 1}. {language==='ar'?section.ar:section.en}</legend>
              {section.options.map((option, j) => (
                <label key={j} style={{ display: 'block', padding: 5 }}>
                  <input type="radio" name={`ndi-${i}`} checked={answers.ndi[i] === j} onChange={() => select('ndi', answers.ndi.map((v, k) => k === i ? j : v))} />{' '}
                  {option[language==='ar'?1:0]}
                </label>
              ))}
              <label style={{ display: 'block', padding: 5 }}>
                <input type="radio" name={`ndi-${i}`} checked={answers.ndi[i] === null} onChange={() => select('ndi', answers.ndi.map((v, k) => k === i ? null : v))} />{' '}
                غير منطبق / لم تتم الإجابة
              </label>
            </fieldset>
          ))}
          <p><strong>{tr('نتيجة الاستبيان:','NDI Score:')} {score.total} {tr('من','of')} {score.answered * 5} ({score.percent ?? '—'}٪)</strong></p>
          <p style={{ fontSize: 13 }}>{tr('هذه النتيجة تقيس تأثير ألم الرقبة على الأنشطة اليومية، ولا تحدد بمفردها مدى ملاءمة التمارين.','This score measures daily-life disability and does not by itself determine eligibility for exercises.')}</p>
        </section>

        <h2>{tr('أسئلة إضافية للتأكد من سلامتك','Additional Safety Screening')}</h2>
        <p>{tr('من فضلك أجيبي بدقة. هذا الاستبيان لا يُستخدم للتشخيص، ويجب موافقة الطبيب قبل البدء في التمارين.','Please answer accurately. This assessment is not a diagnosis. Exercise requires clinician clearance.')}</p>
        <label>{tr('شدة الألم: ','Pain level: ')}<strong>{answers.pain} {tr('من','of')} 10</strong>
          <input aria-label={tr('شدة الألم','Pain level')} style={{ width: '100%' }} type="range" min="0" max="10" value={answers.pain} onChange={e => select('pain', Number(e.target.value))} />
        </label>
        <label>{tr('مكان الألم: ','Pain location: ')}{' '}
          <select value={answers.area} onChange={e => select('area', e.target.value as Answers['area'])}>
            {areas.map(item => <option key={item.value} value={item.value}>{language==='ar'?item.label:({'منتصف الرقبة':'Center of neck','الجانب الأيسر':'Left side','الجانب الأيمن':'Right side','الجانبان':'Both sides','أقل من أسبوع':'Less than one week','من أسبوع إلى ستة أسابيع':'1–6 weeks','أكثر من ستة أسابيع':'More than six weeks','لا توجد حركة مؤلمة':'No painful movement','عند تحريك الرأس لليسار':'Turning head left','عند تحريك الرأس لليمين':'Turning head right','في الاتجاهين':'Both directions'} as Record<string,string>)[item.label]||item.label}</option>)}
          </select>
        </label>
        <label>{tr('منذ متى بدأت الأعراض؟ ','How long have symptoms lasted? ')}{' '}
          <select value={answers.duration} onChange={e => select('duration', e.target.value as Answers['duration'])}>
            {durations.map(item => <option key={item.value} value={item.value}>{language==='ar'?item.label:({'منتصف الرقبة':'Center of neck','الجانب الأيسر':'Left side','الجانب الأيمن':'Right side','الجانبان':'Both sides','أقل من أسبوع':'Less than one week','من أسبوع إلى ستة أسابيع':'1–6 weeks','أكثر من ستة أسابيع':'More than six weeks','لا توجد حركة مؤلمة':'No painful movement','عند تحريك الرأس لليسار':'Turning head left','عند تحريك الرأس لليمين':'Turning head right','في الاتجاهين':'Both directions'} as Record<string,string>)[item.label]||item.label}</option>)}
          </select>
        </label>
        <label>{tr('في أي اتجاه تشعرين بالألم عند تحريك الرقبة؟ ','Which direction causes discomfort? ')}{' '}
          <select value={answers.painfulMovement} onChange={e => select('painfulMovement', e.target.value as Answers['painfulMovement'])}>
            {movements.map(item => <option key={item.value} value={item.value}>{language==='ar'?item.label:({'منتصف الرقبة':'Center of neck','الجانب الأيسر':'Left side','الجانب الأيمن':'Right side','الجانبان':'Both sides','أقل من أسبوع':'Less than one week','من أسبوع إلى ستة أسابيع':'1–6 weeks','أكثر من ستة أسابيع':'More than six weeks','لا توجد حركة مؤلمة':'No painful movement','عند تحريك الرأس لليسار':'Turning head left','عند تحريك الرأس لليمين':'Turning head right','في الاتجاهين':'Both directions'} as Record<string,string>)[item.label]||item.label}</option>)}
          </select>
        </label>
        <label><input type="checkbox" checked={answers.restriction} onChange={e => select('restriction', e.target.checked)} /> أشعر بصعوبة أو تقييد عند تحريك الرقبة</label>
        <fieldset style={{ border: '1px solid #bbb', borderRadius: 12, padding: 15 }}>
          <legend>{tr('هل لديك أي من الأعراض التحذيرية التالية؟','Do you have any warning symptoms?')}</legend>
          {symptoms.map(({ id, ar, en }) => (
            <label key={id} style={{ display: 'block', margin: 8 }}>
              <input type="checkbox" checked={answers.warningSymptoms.includes(id)} onChange={e => select('warningSymptoms', e.target.checked ? [...answers.warningSymptoms, id] : answers.warningSymptoms.filter(s => s !== id))} />{' '}
              {language==='ar'?ar:en}
            </label>
          ))}
        </fieldset>
        <p style={{ fontSize: 13 }}>{tr('الفيديو يُختار تلقائيًا طبقًا لجدول المشروع بعد فحص الأمان. هذا الاختيار ليس تشخيصًا أو وصفة علاجية؛ لا تُكملي إذا ظهرت أعراض جديدة.','The demo selects a video automatically using the project protocol after safety screening; it is not a diagnosis or individual prescription.')}</p>
        {message && <p role="alert" style={{ color: 'var(--ink)' }}>{message}</p>}
        {latest && <div role="status" style={{background:'var(--surface)',border:'1px solid #ccc',borderRadius:12,padding:16}}>
          <strong>{tr('نتيجة التقييم المحفوظ','Saved assessment result')}: {latest.ndiPercent ?? score.percent ?? '—'}%</strong>
          <p>{latest.status==='eligible'
            ? tr('تم اختيار فيديو معتمد؛ جارٍ الانتقال إليه تلقائيًا.','An approved video was selected; opening it automatically.')
            : latest.matchReason === 'high_ndi_review' ? tr('نتيجة NDI مرتفعة (70% فأكثر)، يُرجى مراجعة أخصائي العلاج الطبيعي.','NDI at or above 70% requires clinical review.') : latest.matchReason === 'safety_review'
              ? tr('تم إيقاف الترشيح بسبب أسئلة الأمان. يرجى مراجعة الطبيب.','Recommendation paused because of safety screening. Please consult your clinician.')
              : latest.matchReason === 'no_active_video'
                ? tr('لا يوجد فيديو نشط ضمن مجموعة النتيجة.','No active video was found for your score range.')
                : tr('لا يوجد تمرين معتمد حاليًا.','No approved exercise is available yet.')}</p>
        </div>}
        {latest && <button type="button" className="btn-plush" onClick={() => store.setScreen('library')}>{tr('استعراض فيديوهات التمارين','Browse exercise videos')}</button>}
        <button className="btn-plush primary" disabled={busy} type="submit">{busy ? tr('جارٍ الحفظ…','Saving…') : tr('حفظ الاستبيان واختيار التمرين','Save assessment and select exercise')}</button>
      </form>
    </div>
  );
}
