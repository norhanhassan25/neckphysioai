import { useEffect, useState } from 'react';
import { apiFetch } from '../utils/api';
import { store } from '../game/store';
import { NECK_EXERCISES } from '../data/neckExercises';
import { TopBar } from './primitives';
import { useLanguage } from '../i18n/LanguageContext';
import { TRACKER_CONFIGS } from '../neckAI/config';
import { safetyMessage, useSafetyGate } from '../utils/safetyGate';
import { genderize, useGender } from '../utils/gender';
import { GenderToggle } from './GenderToggle';
function youtubeEmbed(url: string) {
  const m = url.match(/(?:youtube\.com\/shorts\/|youtu\.be\/|youtube\.com\/watch\?v=)([A-Za-z0-9_-]{11})/);
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null;
}
export function NeckVideoScreen() {
  const { language } = useLanguage(),
    [gender, setGender] = useGender(),
    tr = (en: string, ar: string) => (language === 'ar' ? genderize(ar, gender) : en);
  const gate = useSafetyGate();
  const titles: Record<string, string> = {
    'deep-flexor-1': 'تمرين العضلات العميقة للرقبة – الأول',
    'deep-flexor-2': 'تمرين العضلات العميقة للرقبة – المتقدم',
    'cervical-isometric': 'تمارين الرقبة الثابتة',
    'laser-proprioception': 'تأهيل الإحساس بوضع الرقبة',
    'tracking-1': 'تتبع حركة الرأس – الأول',
    'tracking-2': 'تتبع حركة الرأس – المتقدم',
  };
  const id = store.getState().selectedNeckExerciseId;
  const exercise = NECK_EXERCISES.find((e) => e.id === id);
  const [ndi, setNdi] = useState<number | null>(null);
  useEffect(() => {
    apiFetch('/api/neck/assessment/latest')
      .then((r) => (r.ok ? r.json() : null))
      .then((a) => setNdi(a?.ndiPercent ?? null))
      .catch(() => {});
  }, []);
  return (
    <div className="screen dots-bg" dir={language === 'ar' ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', padding: 20 }}>
      <TopBar here={1} steps={language === 'ar' ? ['التقييم', 'الفيديو', 'الكاميرا'] : ['Assessment', 'Video', 'Camera']} />
      <main className="plush" style={{ maxWidth: 820, margin: '30px auto', padding: 24, background: 'var(--surface)' }}>
        <h1>{tr('Neck exercise video', 'فيديو تمرين الرقبة')}</h1>
        {ndi !== null && (
          <p>
            {tr('Saved NDI result (not used to prescribe this exercise):', 'نتيجة NDI المحفوظة (لا تحدد هذا التمرين):')}{' '}
            <b>{ndi}%</b>
          </p>
        )}
        {exercise ? (
          <>
            <h2>{language === 'ar' ? titles[exercise.id] || exercise.title : exercise.title}</h2>
            <p>
              {language === 'ar' ? genderize(TRACKER_CONFIGS[exercise.id]?.descriptionAr ?? '', gender) : exercise.description}
            </p>
            {youtubeEmbed(exercise.videoUrl) ? (
              <iframe
                title={exercise.title}
                src={youtubeEmbed(exercise.videoUrl)!}
                allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ width: '100%', height: 420, border: 0, borderRadius: 16 }}
              />
            ) : (
              <a href={exercise.videoUrl} target="_blank" rel="noreferrer">
                {tr('Open video', 'افتح الفيديو')}
              </a>
            )}
            {language !== 'ar' && <p>{TRACKER_CONFIGS[exercise.id]?.descriptionEn}</p>}
            <p>
              {tr(
                'Tracking is experimental guidance only. Stop if pain, dizziness, numbness or weakness occurs.',
                'التتبع إرشادي وتجريبي فقط. توقفي فورًا عند ظهور ألم أو دوخة أو تنميل أو ضعف.',
              )}
            </p>
            {safetyMessage(gate.state, tr) && (
              <p
                role={gate.state === 'checking' ? 'status' : 'alert'}
                style={{ color: gate.state === 'checking' ? 'inherit' : '#a13543' }}
              >
                {safetyMessage(gate.state, tr)}{' '}
                {gate.state === 'error' && (
                  <button type="button" className="btn-plush" onClick={gate.retry}>
                    {tr('Try again', 'إعادة المحاولة')}
                  </button>
                )}
              </p>
            )}
            <div>
              <GenderToggle gender={gender} setGender={setGender} language={language} />
            </div>
            <button disabled={gate.state !== 'ok'} className="btn-plush primary" onClick={() => store.setScreen('neck-tracker')}>
              {tr('Start AI camera for this exercise', 'ابدئي الكاميرا الذكية لهذا التمرين')}
            </button>
          </>
        ) : (
          <p>{tr('Select a video from the exercise library.', 'اختاري فيديو من مكتبة التمارين.')}</p>
        )}
        <button className="btn-plush" onClick={() => store.setScreen('library')}>
          {tr('Back to library', 'الرجوع لمكتبة الفيديوهات')}
        </button>
      </main>
    </div>
  );
}
