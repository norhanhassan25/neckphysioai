import { store } from '../game/store';
import { useLanguage } from '../i18n/LanguageContext';
import { useMemo, useState } from 'react';
import { Activity, PlayCircle, ShieldCheck, Stethoscope } from 'lucide-react';
import { TopBar } from './primitives';
import { NECK_EXERCISES, NECK_EXERCISE_CATEGORIES } from '../data/neckExercises';

type CategoryFilter = (typeof NECK_EXERCISE_CATEGORIES)[number];

export function PoseLibraryScreen() {
  const {language} = useLanguage();
  const tr = (en: string, ar: string) => language === 'ar' ? ar : en;
  const cats: Record<string,string> = {'All exercises':'كل التمارين','Deep cervical flexor training':'تمارين العضلات العميقة للرقبة','Cervical isometric exercises':'تمارين الرقبة الثابتة','Proprioceptive rehabilitation':'تأهيل الإحساس بوضع الرقبة','Tracking training':'تمارين تتبع حركة الرأس','Neutral Head Training':'تدريب وضع الرأس المحايد'};
  const titles: Record<string,string> = {'deep-flexor-1':'تمرين العضلات العميقة للرقبة – المستوى الأول','deep-flexor-2':'تمرين العضلات العميقة للرقبة – المستوى المتقدم','cervical-isometric':'تمارين الرقبة الثابتة','laser-proprioception':'تأهيل الرقبة بالليزر الافتراضي','tracking-1':'تتبع حركة الرأس – المستوى الأول','tracking-2':'تدريب وضع الرأس المحايد – المتقدم'};
  const descriptions: Record<string,string> = {'deep-flexor-1':'تمرين أساسي للتحكم في حركة الذقن والرقبة.','deep-flexor-2':'مرحلة متقدمة لتمرين العضلات العميقة للرقبة.','cervical-isometric':'تدريب ثبات الرأس أثناء مقاومة لطيفة باليد.','laser-proprioception':'تمرين توجيه الرأس نحو أهداف لتحسين الوعي بالوضعية.','tracking-1':'تدريب تتبع هدف بواسطة حركة الرأس.','tracking-2':'تدريب ثبات وضع الرأس المحايد.'};
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('All exercises');

  const exercises = useMemo(
    () => activeCategory === 'All exercises'
      ? NECK_EXERCISES
      : NECK_EXERCISES.filter((exercise) => exercise.category === activeCategory),
    [activeCategory]
  );

  return (
    <div className="screen" style={{ background: 'var(--cream)', minHeight: '100vh' }}>
      <TopBar here={1} steps={[tr('Dashboard','لوحة التحكم'), tr('Neck Exercise Library','مكتبة تمارين الرقبة')]} />

      <main style={{ maxWidth: 1120, margin: '24px auto 56px', padding: '0 24px' }}>
        <section className="popin" style={{ marginBottom: 28 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--teal-deep)', fontWeight: 900, fontSize: 13, letterSpacing: '.06em', textTransform: 'uppercase' }}>
            <Activity size={17} /> {tr('Neck rehabilitation resources','مصادر تأهيل الرقبة')}
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 38px)', color: 'var(--ink)', margin: '10px 0 8px' }}>
            {tr('Neck Exercise Library','مكتبة تمارين الرقبة')}
          </h1>
          <p style={{ maxWidth: 760, color: 'var(--ink-2)', fontSize: 16, lineHeight: 1.65, margin: 0 }}>
            {tr('Browse all exercise videos. Ask a physiotherapist which exercises suit you.','شاهدي فيديوهات تمارين الرقبة المتاحة، واستشيري أخصائي العلاج الطبيعي لتحديد المناسب لكِ.')}
          </p>
        </section>

        <section className="plush" style={{padding:18,marginBottom:20,background:'var(--surface)'}}>
          <h2>{tr('Ready to start your neck assessment?','جاهزة لبدء تقييم الرقبة؟')}</h2>
          <p>{tr('Your NDI result is saved to your history and does not automatically select exercises.','تُحفظ نتيجة استبيان NDI في سجلك، ولا تختار التمارين تلقائيًا.')}</p>
          <button type="button" className="btn-plush primary" onClick={() => store.setScreen('neck-assessment')}>{tr('Start neck assessment','ابدئي تقييم الرقبة')}</button>
        </section>
        <section aria-label="Exercise categories" style={{ display: 'flex', flexWrap: 'wrap', gap: 9, marginBottom: 24 }}>
          {NECK_EXERCISE_CATEGORIES.map((category) => {
            const selected = activeCategory === category;
            return (
              <button
                key={tr(category, cats[category] || category)}
                type="button"
                className={`btn-plush sm ${selected ? 'primary' : 'ghost'}`}
                aria-pressed={selected}
                onClick={() => setActiveCategory(category)}
                style={{ boxShadow: selected ? 'var(--plush-sm)' : 'none' }}
              >
                {tr(category, cats[category] || category)}
              </button>
            );
          })}
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 290px), 1fr))', gap: 18 }}>
          {exercises.map((exercise) => (
            <article key={exercise.id} className="plush" style={{ background: 'var(--surface)', padding: 22, display: 'flex', flexDirection: 'column', gap: 13, minHeight: 248 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <span className="chip mint">{tr(exercise.category, cats[exercise.category] || exercise.category)}</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {exercise.usesLaserBiofeedback && <span className="chip sky">{tr('Laser biofeedback','تغذية راجعة بالليزر')}</span>}
                  {exercise.id === 'laser-proprioception' && (
                    <span className="chip" style={{ background: 'var(--butter)', border: '2px solid var(--line)', fontWeight: 900 }}>
                      {tr('Optional','اختياري')}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 46, height: 46, borderRadius: 13, background: 'var(--sky)', border: '2px solid var(--line)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <PlayCircle size={23} color="var(--ink)" />
                </div>
                <div>
                  <h2 style={{ fontSize: 19, lineHeight: 1.25, margin: 0, color: 'var(--ink)' }}>{tr(exercise.title,titles[exercise.id]||exercise.title)}</h2>
                  {exercise.progression && <span style={{ display: 'inline-block', marginTop: 6, color: 'var(--teal-deep)', fontSize: 12, fontWeight: 900 }}>{tr(exercise.progression, exercise.id.endsWith('2')?'المستوى المتقدم':'المستوى الأول')}</span>}
                </div>
              </div>
              <p style={{ color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.55, margin: 0, flex: 1 }}>
                {tr(exercise.description,descriptions[exercise.id]||exercise.description)}
                {exercise.id === 'laser-proprioception' && (
                  <span style={{ display: 'block', marginTop: 6, fontSize: 12, fontWeight: 800, color: 'var(--teal-deep)' }}>
                    {tr('• Optional supplementary exercise: does not affect or block completion of standard sessions.', '• تمرين اختياري تكميلي: لا تتوقف الجلسة الكاملة عليه ولا يُشترط لاحتساب اكتمالها.')}
                  </span>
                )}
              </p>
              <button type="button" className="btn-plush primary" onClick={() => {store.selectNeckExercise(exercise.id);store.setScreen('neck-video');}}>
                <PlayCircle size={17}/> {tr(exercise.title,titles[exercise.id]||exercise.title)} — {tr('Video + AI','فيديو وتحليل ذكي')}
              </button>
            </article>
          ))}
        </div>

        <aside className="plush" style={{ background: 'var(--cream-2)', padding: 18, marginTop: 24, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <ShieldCheck size={22} color="var(--teal-deep)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong style={{ display: 'block', color: 'var(--ink)', marginBottom: 4 }}>{tr('Clinical supervision','إرشادات السلامة')}</strong>
            <p style={{ margin: 0, color: 'var(--ink-2)', fontSize: 14, lineHeight: 1.55 }}>
              {tr('These videos are educational and are not an individualized treatment plan. The camera cannot measure muscle force or confirm medical correctness. Stop if you develop alarming symptoms.','الفيديوهات للتعليم وليست وصفة علاجية فردية. الكاميرا لا تقيس قوة العضلات ولا تؤكد الصحة الطبية للحركة. توقفي إذا ظهرت أعراض مقلقة.')}
            </p>
          </div>
        </aside>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 18, color: 'var(--ink-soft)', fontSize: 13 }}>
          <Stethoscope size={16} /> {tr('Ask your physiotherapist before choosing an exercise.','استشيري أخصائي العلاج الطبيعي قبل اختيار التمرين.')}
        </div>
      </main>
    </div>
  );
}
