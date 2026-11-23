import { lazy, Suspense, useEffect, useState } from 'react';
import { useAuth, signInWithEmailPassword, signUpWithEmailPassword, signInWithGoogle } from './utils/auth';
import { apiFetch } from './utils/api';
import { store, useScreen, useUserData, profileFromApi, screenForProfile } from './game/store';
import { Wordmark, ThemeSwitch } from './components/primitives';
import { LandingScreen } from './components/LandingScreen';
import { useLanguage } from './i18n/LanguageContext';

// everything behind the login is split into its own chunk, so the landing page
// doesn't download recharts, the portals or the session screen up front
const screens = {
  splash: () => import('./components/SplashScreen').then((m) => ({ default: m.SplashScreen })),
  onboarding: () => import('./components/OnboardingScreen').then((m) => ({ default: m.OnboardingScreen })),
  dashboard: () => import('./components/HomeScreen').then((m) => ({ default: m.HomeScreen })),
  library: () => import('./components/PoseLibraryScreen').then((m) => ({ default: m.PoseLibraryScreen })),
  session: () => import('./components/SessionScreen').then((m) => ({ default: m.SessionScreen })),
  debrief: () => import('./components/DebriefScreen').then((m) => ({ default: m.DebriefScreen })),
  doctor: () => import('./components/DoctorPortal').then((m) => ({ default: m.DoctorPortal })),
  admin: () => import('./components/AdminPortal').then((m) => ({ default: m.AdminPortal })),
  'neck-assessment': () => import('./components/NeckAssessmentScreen').then((m) => ({ default: m.NeckAssessmentScreen })),
  'neck-video': () => import('./components/NeckVideoScreen').then((m) => ({ default: m.NeckVideoScreen })),
  'neck-tracker': () => import('./components/NeckTrackerScreen').then((m) => ({ default: m.NeckTrackerScreen })),
  pending: () => import('./components/PendingApprovalScreen').then((m) => ({ default: m.PendingApprovalScreen })),
};
const SplashScreen = lazy(screens.splash);
const OnboardingScreen = lazy(screens.onboarding);
const HomeScreen = lazy(screens.dashboard);
const PoseLibraryScreen = lazy(screens.library);
const SessionScreen = lazy(screens.session);
const DebriefScreen = lazy(screens.debrief);
const DoctorPortal = lazy(screens.doctor);
const AdminPortal = lazy(screens.admin);
const PendingApprovalScreen = lazy(screens.pending);
const NeckAssessmentScreen = lazy(screens['neck-assessment']);
const NeckVideoScreen = lazy(screens['neck-video']);
const NeckTrackerScreen = lazy(screens['neck-tracker']);

const ScreenLoading = () => (
  <div className="screen dots-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
    <h3 style={{ fontFamily: 'Nunito', fontWeight: 800 }}>Loading...</h3>
  </div>
);
import './styles/global.css';
import { User, Stethoscope, Shield, ArrowLeft } from 'lucide-react';

export default function App() {
  const {language} = useLanguage();
  const screen = useScreen();
  const userData = useUserData();
  const { isLoaded, isSignedIn, userId, signOut } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [authView, setAuthView] = useState<'landing' | 'role_select' | 'login'>('landing');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [formMode, setFormMode] = useState<'signin' | 'signup'>('signin');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setIsSubmitting(true);

    try {
      const registrationIntent = sessionStorage.getItem('physioalign:registration_intent') || 'patient';
      if (formMode === 'signup') {
        if (!name.trim()) throw new Error(language==='ar'?'الاسم مطلوب':'Name is required');
        if (!email.trim()) throw new Error(language==='ar'?'البريد الإلكتروني مطلوب':'Email is required');
        if (password.length < 6) throw new Error(language==='ar'?'كلمة المرور يجب ألا تقل عن ٦ أحرف':'Password must be at least 6 characters');
        await signUpWithEmailPassword(name, email, password, registrationIntent);
      } else {
        if (!email.trim()) throw new Error(language==='ar'?'البريد الإلكتروني مطلوب':'Email is required');
        if (!password) throw new Error(language==='ar'?'كلمة المرور مطلوبة':'Password is required');
        await signInWithEmailPassword(email, password);
      }
    } catch (err: any) {
      setFormError(err.message || (language==='ar'?'حدث خطأ أثناء تسجيل الدخول':'An error occurred during authentication'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Load and initialize Google Sign-in button when login screen is rendered
  useEffect(() => {
    if (authView !== 'login') return;

    const initGoogle = () => {
      if ((window as any).google) {
        const client_id = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID || '303655418647-jmkugqbao9oc38na1qigl309qsa7gg96.apps.googleusercontent.com';
        (window as any).google.accounts.id.initialize({
          client_id,
          callback: async (response: any) => {
            setFormError('');
            try {
              await signInWithGoogle(response.credential);
            } catch (err: any) {
              setFormError(err.message || 'Google sign-in failed');
            }
          }
        });
        
        const buttonDiv = document.getElementById("google-signin-button");
        if (buttonDiv) {
          (window as any).google.accounts.id.renderButton(
            buttonDiv,
            { theme: "outline", size: "large", width: 280 }
          );
        }
      } else {
        setTimeout(initGoogle, 100);
      }
    };

    initGoogle();
  }, [authView]);

  useEffect(() => {
    const titles: Record<string, string> = {
      splash: 'NECKPHYSIOAI',
      onboarding: 'Setup Profile | NECKPHYSIOAI',
      dashboard: 'Dashboard | NECKPHYSIOAI',
      library: 'Select Pose | NECKPHYSIOAI',
      session: 'Active Practice | NECKPHYSIOAI',
      debrief: 'Anatomical Report | NECKPHYSIOAI',
      doctor: 'Clinician PT Portal | NECKPHYSIOAI',
      admin: 'Admin Supervisor Terminal | NECKPHYSIOAI',
      pending: 'Awaiting Approval | NECKPHYSIOAI',
    };
    document.title = titles[screen] || 'NECKPHYSIOAI';
  }, [screen]);

  useEffect(() => {
    if (!isLoaded) return;
    
    const hasActiveSession = sessionStorage.getItem('physioalign:session_active');
    
    if (!hasActiveSession) {
      if (isSignedIn) {
        signOut();
      }
      sessionStorage.setItem('physioalign:session_active', 'true');
    }
  }, [isLoaded, isSignedIn]);

  // warm up the main chunks in the background once someone is signed in
  useEffect(() => {
    if (!isSignedIn) return;
    const prefetch = () => [screens.dashboard, screens.library, screens.session, screens.debrief].forEach((load) => load());
    const idle = (window as any).requestIdleCallback as ((cb: () => void) => number) | undefined;
    if (idle) idle(prefetch);
    else setTimeout(prefetch, 1500);
  }, [isSignedIn]);

  // Sync auth status with database
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !userId) return;

    // If user data is already populated, we've successfully synced. Do not trigger it again on navigation or re-render.
    if (store.getState().userData) return;

    const syncUser = async () => {
      setIsSyncing(true);
      setSyncError('');
      try {
        const res = await apiFetch('/api/users/me');
        if (res.ok) {
          const profile = profileFromApi(await res.json());
          store.setUserData(profile);
          store.setScreen(screenForProfile(profile));
        } else if (res.status === 404) {
          store.setUserData(null);
          store.setScreen('onboarding');
        } else {
          const data = await res.json().catch(() => ({}));
          setSyncError(data.error || 'Could not load your profile.');
        }
      } catch (err) {
        console.error('[NECKPHYSIOAI] Failed to sync user profile with backend:', err);
        setSyncError(language==='ar'?'تعذر الاتصال بالخادم.':'Could not reach the server.');
      } finally {
        setIsSyncing(false);
      }
    };

    syncUser();
  }, [isLoaded, isSignedIn, userId, syncAttempt]);

  const page = (() => {
  if (!isLoaded) {
    return (
      <div className="screen dots-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h3 style={{ fontFamily: 'Nunito', fontWeight: 800 }}>Loading NECKPHYSIOAI Authenticator...</h3>
      </div>
    );
  }

  if (!isSignedIn) {
    if (authView === 'landing') {
      return (
        <LandingScreen 
          onStartLogin={() => {
            setAuthView('role_select');
          }} 
          onEnterPractice={() => {
            setAuthView('role_select');
          }} 
        />
      );
    }

    if (authView === 'role_select') {
      return (
        <div className="screen dots-bg" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24, gap: 28, position: 'relative' }}>
          <div style={{ position: 'absolute', top: 20, right: 24 }}>
            <ThemeSwitch />
          </div>
          <button
            onClick={() => setAuthView('landing')}
            className="tap btn-plush ghost"
            style={{
              fontSize: '14px',
              padding: '10px 18px',
              borderRadius: 'var(--r-pill)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: 'var(--plush-sm)'
            }}
          >
            <ArrowLeft size={16} style={{ strokeWidth: 3 }} /> {language==='ar'?'العودة للرئيسية':'Back to Home'}
          </button>

          <div style={{ textAlign: 'center', maxWidth: 600 }} className="popin">
            <div style={{ marginTop: 12 }}>
              <Wordmark size={36} />
            </div>
            <h2 style={{ fontSize: 26, fontWeight: 900, color: 'var(--ink)', marginTop: 20 }}>{language==='ar'?'اختاري نوع الحساب':'Select Your Access Portal'}</h2>
            <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--ink-soft)', marginTop: 6 }}>
              {language==='ar'?'اختاري حساب المريض أو أخصائي العلاج الطبيعي':'Choose the portal workspace matching your user role registration.'}
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 20,
            maxWidth: 900,
            width: '100%'
          }} className="popin">
            <div 
              onClick={() => {
                sessionStorage.setItem('physioalign:registration_intent', 'patient');
                setAuthView('login');
              }}
              className="plush tap" 
              style={{ padding: '28px 24px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 18, cursor: 'pointer' }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--mint)', border: '2.5px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', boxShadow: 'var(--plush-tiny)' }}>
                <User size={24} style={{ strokeWidth: 3 }} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>{language==='ar'?'بوابة المريض':'Patient Portal'}</h3>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', lineHeight: 1.5, marginTop: 8, margin: 0 }}>
                  {language==='ar'?'تابع أعراضك وتدرب على تمارين الرقبة المعتمدة مع إرشادات الكاميرا.':'Track your neck assessment, approved exercises, and camera-based feedback.'}
                </p>
              </div>
            </div>

            <div 
              onClick={() => {
                sessionStorage.setItem('physioalign:registration_intent', 'doctor');
                setAuthView('login');
              }}
              className="plush tap" 
              style={{ padding: '28px 24px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 18, cursor: 'pointer' }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--butter)', border: '2.5px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', boxShadow: 'var(--plush-tiny)' }}>
                <Stethoscope size={24} style={{ strokeWidth: 3 }} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>{language==='ar'?'صفحة أخصائي العلاج الطبيعي':'Clinician Suite'}</h3>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', lineHeight: 1.5, marginTop: 8, margin: 0 }}>
                  {language==='ar'?'تابع الاستبيانات وسجل جلسات المرضى وحدد التمارين المعتمدة.':'Review patient assessments, sessions and clinician-approved neck exercises.'}
                </p>
              </div>
            </div>

            <div 
              onClick={() => {
                sessionStorage.setItem('physioalign:registration_intent', 'admin');
                setAuthView('login');
              }}
              className="plush tap" 
              style={{ padding: '28px 24px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 18, cursor: 'pointer' }}
            >
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--peach)', border: '2.5px solid var(--line)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ink)', boxShadow: 'var(--plush-tiny)' }}>
                <Shield size={24} style={{ strokeWidth: 3 }} />
              </div>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>Admin Terminal</h3>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', lineHeight: 1.5, marginTop: 8, margin: 0 }}>
                  {language==='ar'?'إدارة الحسابات وإعدادات النظام.':'Manage accounts and system settings.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    const registrationIntent = sessionStorage.getItem('physioalign:registration_intent') || 'patient';
    const portalTitle = registrationIntent === 'admin' 
      ? (language==='ar'?'لوحة الإدارة':'Admin Supervisor Terminal') 
      : registrationIntent === 'doctor' 
        ? (language==='ar'?'بوابة العلاج الطبيعي':'Clinician PT Portal') 
        : (language==='ar'?'بوابة المريض':'Patient Access Portal');
    const portalBadgeColor = registrationIntent === 'admin'
      ? 'var(--peach)'
      : registrationIntent === 'doctor'
        ? 'var(--butter)'
        : 'var(--mint)';

    return (
      <div className="screen dots-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24, flexDirection: 'column', gap: 16, position: 'relative' }}>
        <div style={{ position: 'absolute', top: 20, right: 24 }}>
          <ThemeSwitch />
        </div>
        <button
          onClick={() => {
            setAuthView('role_select');
          }}
          className="tap btn-plush ghost"
          style={{
            fontSize: '14px',
            padding: '10px 18px',
            borderRadius: 'var(--r-pill)',
            marginBottom: 8
          }}
        >
          {language==='ar'?'العودة إلى اختيار الحساب':'← Back to Selection'}
        </button>
        
        <div className="popin" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, maxWidth: 440, width: '100%' }}>
          
          <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ marginTop: 12 }}>
              <Wordmark size={36} />
            </div>
            
            <div style={{
              background: portalBadgeColor,
              border: '2.5px solid var(--line)',
              borderRadius: 'var(--r-sm)',
              padding: '6px 16px',
              fontFamily: 'inherit',
              fontSize: 13,
              fontWeight: 900,
              color: 'var(--ink)',
              marginTop: 16,
              boxShadow: 'var(--plush-tiny)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {portalTitle}
            </div>

            <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-soft)', marginTop: 12, maxWidth: 300 }}>
              {language==='ar'?'سجّلي الدخول باستخدام البريد الإلكتروني وكلمة المرور.':'Sign in with your email and password.'}
            </p>
          </div>          {/* Custom Authentication Card (Email/Password & Google Sign-In) */}
          <div style={{
            width: '100%',
            maxWidth: '400px',
            background: 'var(--surface)',
            border: '2.5px solid var(--line)',
            borderRadius: 'var(--r-md)',
            boxShadow: 'var(--plush-sm)',
            overflow: 'hidden',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 16
          }}>
            {/* Toggle Tabs */}
            <div style={{ display: 'flex', width: '100%', border: '2.5px solid var(--line)', borderRadius: '12px', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => { setFormMode('signin'); setFormError(''); }}
                style={{
                  flex: 1,
                  padding: '10px',
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: 'pointer',
                  border: 'none',
                  background: formMode === 'signin' ? 'var(--butter)' : 'var(--surface)',
                  borderRight: '2.5px solid var(--line)',
                  color: 'var(--ink)',
                  fontFamily: 'Nunito'
                }}
              >
                {language==='ar'?'تسجيل الدخول':'Sign In'}
              </button>
              <button
                type="button"
                onClick={() => { setFormMode('signup'); setFormError(''); }}
                disabled={registrationIntent !== 'patient'}
                style={{
                  flex: 1,
                  padding: '10px',
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: 'pointer',
                  border: 'none',
                  background: formMode === 'signup' ? 'var(--butter)' : 'var(--surface)',
                  color: 'var(--ink)',
                  fontFamily: 'Nunito'
                }}
              >
                {language==='ar'?'إنشاء حساب':'Sign Up'}
              </button>
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', margin: '8px 0 0 0' }}>
              {formMode === 'signin' ? 'Sign in with Email' : 'Create an Account'}
            </h3>

            {formError && (
              <div style={{
                width: '100%',
                background: 'var(--peach)',
                border: '2.5px solid var(--line)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: 12,
                fontWeight: 800,
                color: 'var(--ink)',
                textAlign: 'left'
              }}>
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleEmailAuth} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {formMode === 'signup' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, width: '100%' }}>
                  <label style={{ fontSize: 11, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Full Name</label>
                  <input
                    type="text"
                    placeholder="Enter your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    style={{
                      width: '100%',
                      border: '2.5px solid var(--line)',
                      borderRadius: '8px',
                      padding: '10px 12px',
                      fontSize: 13,
                      fontWeight: 700,
                      fontFamily: 'Nunito',
                      color: 'var(--ink)',
                      boxShadow: 'var(--plush-tiny)'
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, width: '100%' }}>
                <label style={{ fontSize: 11, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Email Address</label>
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    border: '2.5px solid var(--line)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'Nunito',
                    color: 'var(--ink)',
                    boxShadow: 'var(--plush-tiny)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4, width: '100%' }}>
                <label style={{ fontSize: 11, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    border: '2.5px solid var(--line)',
                    borderRadius: '8px',
                    padding: '10px 12px',
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: 'Nunito',
                    color: 'var(--ink)',
                    boxShadow: 'var(--plush-tiny)'
                  }}
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="tap"
                style={{
                  width: '100%',
                  background: 'var(--mint)',
                  border: '2.5px solid var(--line)',
                  borderRadius: '10px',
                  padding: '12px',
                  fontWeight: 900,
                  fontSize: 14,
                  cursor: 'pointer',
                  boxShadow: '0 3px 0 var(--line)',
                  color: 'var(--ink)',
                  marginTop: 8,
                  fontFamily: 'Nunito'
                }}
              >
                {isSubmitting ? 'Processing...' : formMode === 'signin' ? 'Sign In' : 'Sign Up'}
              </button>
            </form>

            <div style={{ display: 'flex', alignItems: 'center', width: '100%', margin: '8px 0' }}>
              <hr style={{ flex: 1, border: 'none', borderTop: '2.5px solid var(--line)', margin: 0 }} />
              <span style={{ padding: '0 10px', fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>or</span>
              <hr style={{ flex: 1, border: 'none', borderTop: '2.5px solid var(--line)', margin: 0 }} />
            </div>

            {/* Google Sign-in Option */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
              <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)', margin: 0, textTransform: 'uppercase' }}>
                Continue with Google
              </p>
              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'center', 
                  width: '100%',
                  border: '2.5px solid var(--line)',
                  borderRadius: '12px',
                  padding: '10px',
                  background: 'var(--surface)',
                  boxShadow: '0 3px 0 var(--line)'
                }}
              >
                <div id="google-signin-button"></div>
              </div>
            </div>
          </div>

        </div>
      </div>
    );
  }

  if (syncError && !isSyncing) {
    return (
      <div className="screen dots-bg" style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: 24, textAlign: 'center' }}>
        <h3 style={{ fontFamily: 'Nunito', fontWeight: 800 }}>{syncError}</h3>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn-plush primary" style={{ padding: '10px 24px' }} onClick={() => setSyncAttempt((n) => n + 1)}>
            Try again
          </button>
          <button className="btn-plush ghost" style={{ padding: '10px 24px' }} onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (isSyncing) {
    return (
      <div className="screen dots-bg" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h3 style={{ fontFamily: 'Nunito', fontWeight: 800 }}>Syncing profile logs...</h3>
      </div>
    );
  }

  // the logo and nav buttons can switch screens before the profile has loaded,
  // and nothing on those screens can be saved without one
  const needsProfile = !userData && !['splash', 'landing', 'onboarding'].includes(screen);
  if (needsProfile) {
    return (
      <Suspense fallback={<ScreenLoading />}>
        <OnboardingScreen />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<ScreenLoading />}>
    <div className="app">
      {screen === 'landing' && <LandingScreen onStartLogin={() => store.setScreen('dashboard')} />}
      {screen === 'splash' && <SplashScreen />}
      {screen === 'onboarding' && <OnboardingScreen />}
      {screen === 'dashboard' && <HomeScreen />}
      {screen === 'neck-assessment' && <NeckAssessmentScreen />}
      {screen === 'neck-video' && <NeckVideoScreen />}
      {screen === 'neck-tracker' && <NeckTrackerScreen />}
      {screen === 'library' && <PoseLibraryScreen />}
      {screen === 'session' && <SessionScreen />}
      {screen === 'debrief' && <DebriefScreen />}
      {screen === 'doctor' && <DoctorPortal />}
      {screen === 'admin' && <AdminPortal />}
      {screen === 'pending' && <PendingApprovalScreen />}
    </div>
    </Suspense>
  );
  })();
  return page;
}