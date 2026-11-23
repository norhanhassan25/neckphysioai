import { useState } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useAuth } from '../utils/auth';
import { Wordmark, TopBar, ThemeSwitch } from './primitives';
import { store } from '../game/store';
import { Heart, HeartHandshake, ClipboardList, Video, ScanFace, ArrowRight, ChevronDown, ShieldCheck } from 'lucide-react';

interface LandingScreenProps {
  onStartLogin?: () => void;
  onEnterPractice?: () => void;
}



export function LandingScreen({ onStartLogin, onEnterPractice }: LandingScreenProps) {
  const {language} = useLanguage();
  const tr=(en:string,ar:string)=>language==='ar'?ar:en;
  const faqs = [
    { q: tr('What happens after I sign in?','ماذا يحدث بعد تسجيل الدخول؟'), a: tr('You complete a neck health and Neck Disability Index (NDI) questionnaire. The system checks safety responses before showing an exercise selected from your clinician-approved library.','تُكمل استبيان حالة الرقبة ومؤشر إعاقة آلام الرقبة، ثم تُراجع إجابات الأمان قبل عرض تمرين من المكتبة المعتمدة.') },
    { q: tr('How is my neck exercise chosen?','كيف يُختار تمرين الرقبة المناسب؟'), a: tr('Your questionnaire and safety answers are checked against rules approved by your doctor. The NDI score measures the impact of neck symptoms on everyday life; it does not diagnose a condition or decide treatment on its own.','تُراجع الإجابات وفق قواعد الطبيب. نتيجة مؤشر الإعاقة تقيس تأثير الأعراض على حياتك ولا تشخّص الحالة أو تحدد العلاج وحدها.') },
    { q: tr('How does camera feedback work?','كيف تعمل متابعة الحركة بالكاميرا؟'), a: tr('When you allow camera access, MediaPipe estimates visible head movements. Feedback is limited to what the camera can observe; it cannot measure muscle force or provide a medical diagnosis.','بعد موافقتك على الكاميرا يمكن تقدير حركة الرأس الظاهرة. لا تستطيع الكاميرا قياس قوة العضلات أو تقديم تشخيص طبي.') },
    { q: tr('What if I feel pain or dizziness during a session?','ماذا أفعل لو شعرت بالألم أو الدوخة؟'), a: tr('Stop the exercise. If you notice dizziness, weakness, numbness, unusual severe headache, or concerning symptoms, do not continue automatically; contact your clinician.','أوقف التمرين إذا شعرت بألم أو دوخة أو ضعف أو تنميل أو صداع شديد غير معتاد، وراجع المختص.') },
  ];
  const { isSignedIn } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const start = () => isSignedIn ? store.setScreen('dashboard') : (onEnterPractice?.() ?? onStartLogin?.());
  return (
    <div className="screen dots-bg" dir={language==='ar'?'rtl':'ltr'} style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {isSignedIn ? <TopBar here={0} steps={['Home']} /> : (
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '18px clamp(18px, 5vw, 52px)', background: 'var(--surface)', borderBottom: '2px solid var(--line)' }}>
          <Wordmark size={27} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ThemeSwitch />
            <button className="btn-plush primary" onClick={onStartLogin} style={{ padding: '10px 18px' }}>{tr('Log in','تسجيل الدخول')}</button>
          </div>
        </header>
      )}
      <main style={{ width: '100%', maxWidth: 1050, margin: '0 auto', padding: 'clamp(34px, 7vw, 90px) 22px 64px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 66, flex: 1 }}>
        <section className="popin" style={{ textAlign: 'center', maxWidth: 785, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 19 }}>
          <div style={{ borderRadius: 99, background: 'var(--rose)', border: '2px solid var(--line)', padding: '9px 17px', display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 900, fontSize: 14 }}>
            <Heart size={17} fill="currentColor" /> {tr('A little care, every step of the way','رعاية واهتمام في كل خطوة')}
          </div>
          <h1 style={{ fontSize: 'clamp(2.8rem, 7vw, 5.2rem)', lineHeight: 1.09, color: 'var(--ink)', fontWeight: 900, letterSpacing: '-.04em', margin: '8px 0 0' }}>
            {tr('Your neck deserves ','رقبتك تستحق ')}<span style={{ color: 'var(--peach-deep)' }}>{tr('gentle care.','رعاية لطيفة.')}</span>
          </h1>
          <p style={{ fontSize: 'clamp(16px, 2.1vw, 20px)', fontWeight: 700, color: 'var(--ink-2)', maxWidth: 620, lineHeight: 1.7, margin: 0 }}>
            {tr('Welcome to NECKPHYSIOAI, a supportive space for neck rehabilitation. Answer a short assessment, follow an exercise video approved by your clinician, and get helpful camera-based movement guidance.','مرحبًا بك في NECKPHYSIOAI. هنا نهتم براحتك ورحلتك مع تأهيل الرقبة. أجب عن استبيان بسيط، وشاهد فيديو تمرين اعتمده المختص، واحصل على إرشادات حركة بالكاميرا.')}
          </p>
          <button onClick={start} className="btn-plush primary tap" style={{ fontSize: 19, padding: '15px 30px', marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 12 }}>
            {isSignedIn ? tr('Go to my dashboard','الذهاب إلى لوحتي') : tr('Begin my care journey','ابدأ رحلتي')} <ArrowRight size={20} />
          </button>
          <p style={{ color: 'var(--ink-soft)', fontSize: 13, fontWeight: 700, maxWidth: 560, margin: '2px 0 0' }}>
            {tr('Your comfort comes first. This app supports clinician-guided practice and does not replace professional medical advice.','راحتك أولًا. هذا الموقع يساعد في التمارين بإشراف المختص ولا يغني عن الاستشارة الطبية.')}
          </p>
        </section>
        <section style={{ width: '100%' }}>
          <h2 style={{ color: 'var(--ink)', textAlign: 'center', fontSize: 29, fontWeight: 900, margin: '0 0 26px' }}>{tr('A caring journey, made just for you','رحلة رعاية مصممة لك')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 18 }}>
            {[
              { Icon: ClipboardList, title: tr('Tell us how you feel','أخبرنا كيف تشعر'), description: tr('Complete your neck disability and safety questionnaire, in a few easy steps.','أكمل استبيان الرقبة وأسئلة السلامة في خطوات بسيطة.'), shade: 'var(--butter)' },
              { Icon: Video, title: tr('Watch your exercise','شاهد تمرينك'), description: tr('See a neck rehabilitation video selected using your clinician’s approved rules.','شاهد فيديو تأهيل الرقبة الذي اختاره المختص بناءً على قواعد معتمدة.'), shade: 'var(--mint)' },
              { Icon: ScanFace, title: tr('Practice with support','تدرّب بمساعدة'), description: tr('Turn on your camera when you’re ready for movement guidance and gentle tips.','افتح الكاميرا عندما تكون مستعدًا لمتابعة الحركة ونصائح لطيفة.'), shade: 'var(--sky)' },
              { Icon: HeartHandshake, title: tr('Celebrate progress','احتفل بتقدمك'), description: tr('Keep track of your practice and share your journey with your care team.','تابع جلساتك وشارك تقدمك مع فريق الرعاية.'), shade: 'var(--rose)' },
            ].map(({ Icon, title, description, shade }) => (
              <div className="plush" key={title} style={{ padding: 22, background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 13 }}>
                <div style={{ width: 48, height: 48, display: 'grid', placeItems: 'center', background: shade, border: '2px solid var(--line)', borderRadius: 13 }}><Icon size={23} /></div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>{title}</h3>
                <p style={{ color: 'var(--ink-2)', fontWeight: 700, fontSize: 14, lineHeight: 1.55, margin: 0 }}>{description}</p>
              </div>
            ))}
          </div>
        </section>
        <section style={{ width: '100%', maxWidth: 800 }}>
          <h2 style={{ color: 'var(--ink)', fontSize: 29, fontWeight: 900, textAlign: 'center', margin: '0 0 24px' }}>{tr('Your questions, answered with care','أسئلتك تهمنا')}</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {faqs.map(({ q, a }, i) => (
              <div key={q} className="plush" style={{ background: 'var(--surface)', overflow: 'hidden' }}>
                <button aria-expanded={openFaq === i} onClick={() => setOpenFaq(openFaq === i ? null : i)} style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '19px 22px', fontSize: 16, fontWeight: 900, color: 'var(--ink)', textAlign: 'left', background: 'transparent', border: 0, cursor: 'pointer' }}>
                  {q} <ChevronDown size={20} style={{ flexShrink: 0, transform: openFaq === i ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
                </button>
                {openFaq === i && <p style={{ padding: '0 22px 19px', color: 'var(--ink-2)', lineHeight: 1.6, fontWeight: 700, margin: 0 }}>{a}</p>}
              </div>
            ))}
          </div>
        </section>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--ink-2)', fontWeight: 800, fontSize: 14, textAlign: 'center' }}>
          <ShieldCheck size={19} /> {tr('Kind guidance. Clinician-approved exercises. Your pace.','إرشادات لطيفة، وتمارين معتمدة، وعلى راحتك.')}
        </div>
      </main>
      <footer style={{ textAlign: 'center', background: 'var(--cream-2)', borderTop: '2px solid var(--line)', color: 'var(--ink-2)', padding: '24px 15px', fontSize: 15, fontWeight: 900 }}>
        <span>{tr('Made with love for all people, to help them.','صُنع بحب لمساعدة الجميع.')}</span> <Heart size={16} fill="currentColor" style={{ display: 'inline-block', verticalAlign: 'middle', color: 'var(--peach-deep)' }} />
        <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>© 2026 NECKPHYSIOAI · {tr('Here for you, one gentle step at a time.','معك خطوة بخطوة.')}</div>
      </footer>
    </div>
  );
}
