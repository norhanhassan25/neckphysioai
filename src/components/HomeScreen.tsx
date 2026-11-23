import { store, useSessionHistory, useUserData, useActiveTab } from '../game/store';
import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../utils/auth';
import { SessionData } from '../game/types';
import { POSES } from '../data/poses';
import { TopBar, Doodle, CuteFace } from './primitives';
import {
  Award,
  Flame,
  Activity,
  Trash2,
  Plus,
  ChevronRight,
  MessageSquare,
  Send,
  TrendingUp,
  Sparkles,
  Clock,
  HeartPulse,
  Droplet,
  Coffee,
  CheckCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';
import { askCoachQuestion } from '../utils/geminiService';
import { useLanguage } from '../i18n/LanguageContext';

function relativeDate(ms: number): string {
  const diffMs = Date.now() - ms;
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ title, value, icon, color }: StatCardProps) {
  return (
    <div
      className="plush"
      style={{
        background: 'var(--surface)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }}
    >
      <div>
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
        </span>
        <h2 style={{ fontSize: 32, fontWeight: 900, color: 'var(--ink)', marginTop: 4, lineHeight: 1 }}>
          {value}
        </h2>
      </div>
      <div style={{
        width: 44, height: 44, borderRadius: '50%', border: '2.5px solid var(--line)',
        background: color, display: 'flex', alignItems: 'center', justifyItems: 'center',
        justifyContent: 'center', boxShadow: 'var(--plush-tiny)'
      }}>
        {icon}
      </div>
    </div>
  );
}

interface Coach {
  id: string;
  name: string;
  role: string;
  color: string;
  avatarMood: 'happy' | 'neutral';
  skinColor: string;
  bio: string;
}

const COACHES: Coach[] = [
  {
    id: 'anya',
    name: 'Care Guide Anya',
    role: 'Gentle Posture Guidance',
    color: 'var(--mint)',
    avatarMood: 'happy',
    skinColor: '#FFD8B5',
    bio: 'A gentle assistant for neutral head position, breathing and doctor-approved neck practice.'
  },
  {
    id: 'rocky',
    name: 'Movement Guide Rocky',
    role: 'Neck Movement Support',
    color: 'var(--peach)',
    avatarMood: 'happy',
    skinColor: '#E0A899',
    bio: 'Supports observation of camera-visible head and shoulder movement; does not measure muscle strength.'
  },
  {
    id: 'maya',
    name: 'Physio Guide Maya',
    role: 'Physiotherapy Education',
    color: 'var(--sky)',
    avatarMood: 'neutral',
    skinColor: '#FFEFD1',
    bio: 'An educational AI assistant for doctor-approved neck rehabilitation; not a licensed clinician or diagnosis.'
  }
];

interface ChatMessage {
  sender: 'user' | 'coach';
  text: string;
  timestamp: number;
}

interface RoadmapItem {
  id: string;
  label: string;
  completed: boolean;
  type: 'pose' | 'habit';
  iconName: 'pose' | 'water' | 'breath' | 'warmth' | 'stretching';
}

export function HomeScreen() {
  const {language}=useLanguage();
  const tr=(en:string,ar:string)=>language==='ar'?ar:en;
  const userData = useUserData();
  const history = useSessionHistory();
  const { userId } = useAuth();
  
  const activeTab = useActiveTab();
  const setActiveTab = (tab: 'dashboard' | 'trends' | 'consult') => store.setActiveTab(tab);

  const [painLevel, setPainLevel] = useState<number>(3);
  const [loggedPain, setLoggedPain] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('physioalign:logged_pain_today');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.date) {
          return new Date(parsed.date).toDateString() === new Date().toDateString();
        }
      }
    } catch (e) {
      console.error('Failed to parse logged pain status', e);
    }
    return false;
  });
  const [painRecommendation, setPainRecommendation] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('physioalign:logged_pain_today');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.recommendation) {
          return String(parsed.recommendation);
        }
      }
    } catch (e) {
      console.error('Failed to parse pain recommendation', e);
    }
    return '';
  });

  const [roadmap, setRoadmap] = useState<RoadmapItem[]>(() => {
    const defaultRoadmap: RoadmapItem[] = [
      { id: 'neck-assessment', label: 'Complete neck disability assessment', completed: false, type: 'habit', iconName: 'pose' },
      { id: 'neck-library', label: 'Explore neck exercise library', completed: false, type: 'habit', iconName: 'pose' },
      { id: 'water', label: 'Drink 8 glasses of water today', completed: false, type: 'habit', iconName: 'water' },
      { id: 'breath', label: 'Take a 5-min deep breathing break', completed: false, type: 'habit', iconName: 'breath' }
    ];
    try {
      const saved = localStorage.getItem('physioalign:daily_roadmap');
      if (saved) {
        const parsed = JSON.parse(saved);
        const savedDate = localStorage.getItem('physioalign:daily_roadmap_date');
        if (savedDate === new Date().toDateString() && Array.isArray(parsed) && !parsed.some((item: RoadmapItem) => /yoga|tree pose|downward dog|warrior/i.test(item.label))) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse roadmap', e);
    }
    return defaultRoadmap;
  });


  const [selectedCoachId, setSelectedCoachId] = useState<string>('anya');
  const [inputText, setInputText] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);
  const [chats, setChats] = useState<Record<string, ChatMessage[]>>(() => {
    const defaultChats = {
      anya: [{ sender: 'coach', text: "Hello! I can explain gentle neck positioning and your approved exercises. How can I help?", timestamp: Date.now() }],
      rocky: [{ sender: 'coach', text: "Hi! Ask me about camera tracking for your neck exercise and what it can observe.", timestamp: Date.now() }],
      maya: [{ sender: 'coach', text: "Hello! I'm a virtual physiotherapy education assistant. Please ask me about your prescribed neck exercise.", timestamp: Date.now() }]
    };
    try {
      const saved = localStorage.getItem('physioalign:coach_chats');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return {
            anya: parsed.anya || defaultChats.anya,
            rocky: parsed.rocky || defaultChats.rocky,
            maya: parsed.maya || defaultChats.maya
          };
        }
      }
    } catch (e) {
      console.error('Failed to parse chats from localStorage', e);
    }
    return defaultChats;
  });

  const chatEndRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    if (activeTab === 'consult') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chats, selectedCoachId, activeTab]);


  useEffect(() => {
    localStorage.setItem('physioalign:coach_chats', JSON.stringify(chats));
  }, [chats]);


  useEffect(() => {
    localStorage.setItem('physioalign:daily_roadmap', JSON.stringify(roadmap));
    localStorage.setItem('physioalign:daily_roadmap_date', new Date().toDateString());
  }, [roadmap]);


  useEffect(() => {
    if (userId) {
      store.syncHistory(userId);
    }
  }, [userId]);


  const count = history.length;
  
  const avgScore = count > 0 
    ? Math.round(history.reduce((sum, s) => sum + s.averageScore, 0) / count) 
    : 0;


  const computeStreak = (sessions: SessionData[]): number => {
    if (sessions.length === 0) return 0;
    // toISOString() is UTC, which puts early morning sessions on the wrong day
    const dates = new Set(sessions.map((s) => new Date(s.date).toDateString()));
    let streak = 0;
    const cursor = new Date();
    // haven't practised yet today, the streak from yesterday still counts
    if (!dates.has(cursor.toDateString())) {
      cursor.setDate(cursor.getDate() - 1);
    }
    for (;;) {
      const key = cursor.toDateString();
      if (dates.has(key)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  };
  const streak = computeStreak(history);


  const getWeakestJoint = (sessions: SessionData[]): string => {
    if (sessions.length === 0) return 'None';
    const jointErrors: Record<string, number> = {};

    sessions.forEach((s) => {
      s.frameLogs.forEach((log) => {
        if (log.feedbackMessage && log.feedbackMessage.includes(':')) {
          const joint = log.feedbackMessage.split(':')[0].trim();
          jointErrors[joint] = (jointErrors[joint] || 0) + 1;
        }
      });
    });

    const entries = Object.entries(jointErrors);
    if (entries.length === 0) return 'Perfect Balance';
    
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  };
  const weakestArea = getWeakestJoint(history);

  const handleStartPractice = () => {
    store.setScreen('neck-assessment');
  };

  const handleViewSession = (session: SessionData) => {
    store.getState().activeSession = session;
    store.setScreen('debrief');
  };

  const handleDeleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (userId && window.confirm('Are you sure you want to delete this session log?')) {
      await store.deleteSession(id, userId);
    }
  };


  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isTyping) return;

    const coach = COACHES.find(c => c.id === selectedCoachId);
    if (!coach || !userData) return;

    const userMsg: ChatMessage = {
      sender: 'user',
      text: inputText,
      timestamp: Date.now()
    };

    const currentCoachHistory = chats[selectedCoachId] || [];
    const updatedHistory = [...currentCoachHistory, userMsg];

    setChats(prev => ({
      ...prev,
      [selectedCoachId]: updatedHistory
    }));

    setInputText('');
    setIsTyping(true);

    try {
      const response = await askCoachQuestion(
        coach.id,
        currentCoachHistory.map(m => ({ sender: m.sender, text: m.text })),
        userMsg.text
      );

      const coachMsg: ChatMessage = {
        sender: 'coach',
        text: response,
        timestamp: Date.now()
      };

      setChats(prev => ({
        ...prev,
        [selectedCoachId]: [...updatedHistory, coachMsg]
      }));
    } catch (err) {
      console.error('Error generating chat response:', err);
    } finally {
      setIsTyping(false);
    }
  };


  const handleLogPain = () => {
    let rec = '';
    let updatedRoadmap: RoadmapItem[] = [];

    rec = painLevel >= 7
      ? 'High discomfort reported. Pause exercise and seek physiotherapy advice.'
      : 'Your daily index has been recorded. Keep movements comfortable and gentle.';
    updatedRoadmap = [
      { id: 'neck-assessment', label: 'Complete neck disability assessment', completed: false, type: 'habit', iconName: 'pose' },
      { id: 'neck-library', label: 'Explore neck exercise library', completed: false, type: 'habit', iconName: 'pose' },
      { id: 'water', label: 'Stay hydrated', completed: false, type: 'habit', iconName: 'water' },
      { id: 'breath', label: 'Take a comfortable breathing break', completed: false, type: 'habit', iconName: 'breath' }
    ];
    setPainRecommendation(rec);
    setLoggedPain(true);
    setRoadmap(updatedRoadmap);

    localStorage.setItem('physioalign:logged_pain_today', JSON.stringify({
      date: new Date().toISOString(),
      level: painLevel,
      recommendation: rec
    }));
  };

  const handleToggleRoadmapItem = (id: string) => {
    setRoadmap(prev => prev.map(item => 
      item.id === id ? { ...item, completed: !item.completed } : item
    ));
  };

  const activeCoach = COACHES.find(c => c.id === selectedCoachId) || COACHES[0];


  const trendData = [...history]
    .reverse()
    .map(s => ({
      date: new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: s.averageScore,
      hold: s.holdTimeSeconds
    }));

  const poseSummaryMap: Record<string, { total: number; count: number }> = {};
  history.forEach(s => {
    if (!poseSummaryMap[s.poseName]) {
      poseSummaryMap[s.poseName] = { total: 0, count: 0 };
    }
    poseSummaryMap[s.poseName].total += s.averageScore;
    poseSummaryMap[s.poseName].count += 1;
  });

  const poseSummaryData = Object.entries(poseSummaryMap).map(([name, data]) => ({
    name,
    score: Math.round(data.total / data.count)
  }));

  const completedRoadmapCount = roadmap.filter(i => i.completed).length;
  const roadmapPercentage = roadmap.length > 0 ? Math.round((completedRoadmapCount / roadmap.length) * 100) : 0;

  return (
    <div className="screen" style={{ background: 'var(--cream)' }}>
      <TopBar here={0} steps={['Dashboard']} userName={userData?.name} />

      <main style={{ maxWidth: 1024, margin: '24px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        

        <div className="plush" style={{ padding: '24px 28px', background: 'var(--surface)', position: 'relative', overflow: 'hidden' }}>
          
          <h1 style={{ fontSize: 36, color: 'var(--ink)' }}>
            {tr('Welcome back,','أهلًا بعودتك،')} {userData?.name || tr('Friend','صديقنا')}!
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink-2)', marginTop: 6, fontWeight: 700, maxWidth: 640 }}>
            {count === 0 
              ? tr('Ready to begin your neck rehabilitation? Complete your assessment to find a physiotherapist-approved video and receive camera-based guidance.','هل أنت مستعد لبدء تأهيل رقبتك؟ أكمِل الاستبيان للحصول على فيديو معتمد من أخصائي العلاج الطبيعي ومتابعة إرشادية بالكاميرا.')
              : tr('Your neck rehabilitation journey continues here. Review your assessment and choose from the exercise library.','رحلتك مستمرة. راجع الاستبيان واتبع تمارين الرقبة التي اعتمدها المختص.')}
          </p>
          
          <button
            onClick={handleStartPractice}
            className="btn-plush primary tap"
            style={{ marginTop: 16 }}
          >
            <Plus size={16} /> {tr('Start neck assessment','ابدأ تقييم الرقبة')}
          </button>
        </div>


        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, borderBottom: '2.5px solid var(--line)', paddingBottom: 12 }}>
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`btn-plush ${activeTab === 'dashboard' ? 'primary' : 'ghost'}`}
            style={{ padding: '8px 16px', fontSize: 14, borderRadius: 'var(--r-sm)' }}
          >
            <Activity size={16} style={{ marginRight: 6 }} />
            {tr('Evaluations','التقييمات')}
          </button>
          <button
            onClick={() => setActiveTab('trends')}
            className={`btn-plush ${activeTab === 'trends' ? 'mint' : 'ghost'}`}
            style={{ padding: '8px 16px', fontSize: 14, borderRadius: 'var(--r-sm)' }}
          >
            <TrendingUp size={16} style={{ marginRight: 6 }} />
            {tr('Analytics & Trends','التحليلات والتقدم')}
          </button>
          <button
            onClick={() => setActiveTab('consult')}
            className={`btn-plush ${activeTab === 'consult' ? 'sky' : 'ghost'}`}
            style={{ padding: '8px 16px', fontSize: 14, borderRadius: 'var(--r-sm)' }}
          >
            <MessageSquare size={16} style={{ marginRight: 6 }} />
            {tr('AI Physiotherapy Coach','مساعد العلاج الطبيعي الذكي')}
          </button>
        </div>



        {activeTab === 'dashboard' && (
          <div className="popin" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
              <StatCard title={tr('Daily Streak','أيام الاستمرار')} value={`${streak} ${language==='ar'?'يوم':'days'}`} icon={<Flame size={20} color="var(--ink)" />} color="var(--peach)" />
              <StatCard title={tr('Sessions Practiced','الجلسات المنفذة')} value={count} icon={<Activity size={20} color="var(--ink)" />} color="var(--sky)" />
              <StatCard title={tr('Average Score','متوسط التقييم')} value={`${avgScore}%`} icon={<Award size={20} color="var(--ink)" />} color="var(--butter)" />
              <StatCard title={tr('Attention Area','مجال يحتاج الانتباه')} value={language==='ar' && weakestArea==='None'?'لا يوجد':weakestArea} icon={<Doodle kind="star" size={20} color="var(--ink)" />} color="var(--rose)" />
            </div>


            {(() => {
              const carePlan = userData?.carePlan ?? [];
              if (carePlan.length === 0) return null;
              
              return (
                <div className="plush" style={{ padding: '24px 28px', background: 'var(--surface)', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ borderBottom: '2.5px solid var(--line)', paddingBottom: 12, display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
                    <h2 style={{ fontSize: 22, color: 'var(--ink)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <HeartPulse size={24} style={{ color: 'var(--rose-deep)' }} /> Prescribed Rehabilitation Plan
                    </h2>
                    <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--ink-soft)', border: '2.5px solid var(--line)' }} className="chip">
                      Assigned by your Doctor
                    </span>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
                    {carePlan.map((planItem: any, index: number) => {
                      const poseConfig = POSES.find(p => p.id === planItem.poseId);
                      return (
                        <div 
                          key={index}
                          className="plush tap"
                          onClick={() => store.selectPose(planItem.poseId)}
                          style={{
                            background: 'var(--cream)',
                            padding: 16,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            borderWidth: '2.5px',
                            boxShadow: 'var(--plush-tiny)',
                            gap: 12
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)' }}>
                              {poseConfig?.name || planItem.poseId}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-soft)', marginTop: 4 }}>
                              Goal hold: <span style={{ color: 'var(--peach-deep)' }}>{planItem.targetHold}s</span> • {planItem.frequency}
                            </div>
                          </div>
                          <span className="btn-plush primary" style={{ fontSize: 11, padding: '4px 10px', borderWidth: '1.5px', borderRadius: 6, height: 'auto', margin: 0, flexShrink: 0 }}>
                            Start
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}


            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 24, alignItems: 'start' }}>
              

              <div className="plush" style={{ padding: '24px 28px', background: 'var(--surface)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2.5px solid var(--line)', paddingBottom: 12, marginBottom: 16 }}>
                  <h2 style={{ fontSize: 22, color: 'var(--ink)', margin: 0 }}>
                    {tr('Completed Evaluations','الجلسات المكتملة')}
                  </h2>
                  <button
                    onClick={handleStartPractice}
                    className="btn-plush primary"
                    style={{ fontSize: 13, padding: '6px 12px', borderWidth: '2px', height: 'auto', display: 'inline-flex' }}
                  >
                    <Plus size={14} style={{ marginRight: 4 }} /> {tr('New Session','جلسة جديدة')}
                  </button>
                </div>

                {count === 0 ? (
                  <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--ink-soft)' }}>
                    <div style={{ marginBottom: 12 }}>
                      <Doodle kind="star" size={48} color="var(--cream-2)" />
                    </div>
                    <p style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{tr('No sessions logged yet.','لا توجد جلسات مسجلة بعد.')}</p>
                    <p style={{ fontSize: 13, margin: '4px 0 0' }}>{tr('Your completed session reports will appear here.','ستظهر تقارير جلساتك المكتملة هنا.')}</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {history.map((session) => (
                      <div
                        key={session.id}
                        onClick={() => handleViewSession(session)}
                        className="tap"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '14px 18px',
                          border: '2.5px solid var(--line)',
                          borderRadius: 'var(--r-sm)',
                          background: 'var(--paper)',
                          boxShadow: 'var(--plush-tiny)',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

                          <div
                            className={`debrief-grade-badge ${session.grade.toLowerCase()}`}
                            style={{
                              width: 44,
                              height: 44,
                              fontSize: 22,
                              borderRadius: 10,
                              border: '2.5px solid var(--line)',
                              transform: 'none'
                            }}
                          >
                            {session.grade}
                          </div>

                          <div>
                            <h3 style={{ fontSize: 17, fontWeight: 800 }}>{session.poseName}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 12, color: 'var(--ink-soft)', fontWeight: 700 }}>
                              <span>{relativeDate(session.date)}</span>
                              <span>•</span>
                              <span>Hold: {session.holdTimeSeconds}s</span>
                              <span>•</span>
                              <span>Score: {session.averageScore}%</span>
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <button
                            onClick={(e) => handleDeleteSession(session.id, e)}
                            style={{
                              background: 'transparent', border: 0, padding: 6, cursor: 'pointer',
                              color: 'var(--rose-deep)'
                            }}
                            title="Delete log entry"
                          >
                            <Trash2 size={18} />
                          </button>
                          <ChevronRight size={20} color="var(--line)" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>


              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                

                <div className="plush" style={{ padding: 20, background: 'var(--surface)' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HeartPulse size={20} color="var(--rose-deep)" /> {tr('Daily Pain & Stiffness Log','سجل الألم والتيبس اليومي')}
                  </h3>
                  
                  {!loggedPain ? (
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.4, margin: '0 0 16px' }}>
                        How do your joints and muscles feel right now? Log today's fatigue index (1 is limber, 10 is stiff/painful) to adapt your exercises:
                      </p>
                      

                      <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '20px 0' }}>
                        <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--mint-deep)' }}>{tr('1 (Limber)','١ (مريح)')}</span>
                        <input 
                          type="range" 
                          min="1" 
                          max="10" 
                          value={painLevel} 
                          onChange={(e) => setPainLevel(parseInt(e.target.value))}
                          style={{
                            flex: 1,
                            accentColor: 'var(--peach-deep)',
                            cursor: 'pointer'
                          }} 
                        />
                        <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--rose-deep)' }}>{tr('10 (Stiff)','١٠ (تيبس)')}</span>
                      </div>
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                        <div style={{ fontSize: 14, fontWeight: 800 }}>
                          {tr('Selected Index:','الدرجة المختارة:')} <span style={{ color: painLevel >= 7 ? 'var(--rose-deep)' : painLevel >= 4 ? 'var(--butter-deep)' : 'var(--mint-deep)', fontSize: 18, fontWeight: 900 }}>{painLevel}</span>
                        </div>
                        <button
                          onClick={handleLogPain}
                          className="btn-plush primary"
                          style={{ fontSize: 12, padding: '8px 16px', borderRadius: 'var(--r-sm)', boxShadow: 'var(--plush-tiny)', height: 'auto' }}
                        >
                          {tr('Log Daily Index','حفظ تقييم اليوم')}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--cream-2)', padding: '12px 14px', borderRadius: 'var(--r-sm)', border: '2.5px solid var(--line)' }}>
                        <CheckCircle size={18} color="var(--mint-deep)" />
                        <span style={{ fontSize: 13, fontWeight: 800 }}>{tr('Daily index logged successfully!','تم حفظ تقييم اليوم!')}</span>
                      </div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-2)', lineHeight: 1.5, margin: 0 }}>
                        {language==='ar' ? (painLevel>=7?'تم الإبلاغ عن انزعاج شديد. توقفي عن التمارين وراجعي أخصائي العلاج الطبيعي.':'تم حفظ تقييم اليوم. حافظي على الحركة المريحة واللطيفة.') : painRecommendation}
                      </p>
                      <button
                        onClick={() => setLoggedPain(false)}
                        style={{
                          background: 'none', border: 0, textDecoration: 'underline', color: 'var(--ink-soft)',
                          fontSize: 11, fontWeight: 800, cursor: 'pointer', textAlign: 'left', width: 'fit-content'
                        }}
                      >
                        {tr('Log a different index','تسجيل درجة أخرى')}
                      </button>
                    </div>
                  )}
                </div>


                <div className="plush" style={{ padding: 20, background: 'var(--surface)' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={20} color="var(--mint-deep)" /> {tr("Today's Wellness Roadmap",'خطة العناية اليومية')}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>

                    <div style={{ flex: 1, height: 10, background: 'var(--cream)', border: '2.5px solid var(--line)', borderRadius: 'var(--r-pill)', overflow: 'hidden' }}>
                      <div style={{ width: `${roadmapPercentage}%`, height: '100%', background: 'var(--mint-deep)', transition: 'width 300ms ease' }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-2)' }}>{roadmapPercentage}%</span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {roadmap.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleToggleRoadmapItem(item.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          border: '2.5px solid var(--line)',
                          borderRadius: 'var(--r-sm)',
                          background: item.completed ? 'var(--cream-2)' : 'var(--paper)',
                          cursor: 'pointer',
                          textDecoration: item.completed ? 'line-through' : 'none',
                          opacity: item.completed ? 0.75 : 1,
                          transition: 'background-color 150ms'
                        }}
                      >
                        <div style={{
                          width: 20,
                          height: 20,
                          borderRadius: '50%',
                          border: '2.5px solid var(--line)',
                          background: item.completed ? 'var(--mint-deep)' : 'var(--surface)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 1px 0 var(--line)'
                        }}>
                          {item.completed && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--surface)' }} />}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>
                          {tr(item.label, ({'Complete neck disability assessment':'إكمال استبيان الرقبة','Explore neck exercise library':'استكشاف مكتبة التمارين','Stay hydrated':'شرب الماء','Take a comfortable breathing break':'استراحة تنفس مريحة'} as Record<string,string>)[item.label] || item.label)}
                        </span>
                        <div style={{ marginLeft: 'auto', opacity: 0.6 }}>
                          {(() => {
                            switch (item.iconName) {
                              case 'pose':
                                return <Activity size={16} />;
                              case 'water':
                                return <Droplet size={16} />;
                              case 'breath':
                                return <Coffee size={16} />;
                              case 'warmth':
                                return <HeartPulse size={16} />;
                              case 'stretching':
                                return <Clock size={16} />;
                              default:
                                return <Activity size={16} />;
                            }
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>


                <div className="plush" style={{ padding: 20, background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{
                    border: '2.5px solid var(--line)',
                    borderRadius: '50%',
                    overflow: 'hidden',
                    width: 44,
                    height: 44,
                    background: 'var(--surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <CuteFace size={54} mood={activeCoach.avatarMood} skin={activeCoach.skinColor} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: 14, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>
                      {tr('Consult','استشر')} {activeCoach.name.split(' ').pop()}
                    </h4>
                    <p style={{ fontSize: 11, color: 'var(--ink-soft)', margin: '2px 0 0', lineHeight: 1.3, fontWeight: 700 }}>
                      {tr('Need help understanding your approved neck exercise? Ask our physiotherapy assistant.','هل تحتاج مساعدة لفهم تمرين الرقبة المعتمد؟ اسأل المساعد الذكي.')}
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('consult')}
                    className="btn-plush primary"
                    style={{
                      width: 36,
                      height: 36,
                      padding: 0,
                      borderRadius: 'var(--r-sm)',
                      boxShadow: 'var(--plush-tiny)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <MessageSquare size={16} />
                  </button>
                </div>

              </div>

            </div>

          </div>
        )}

        {activeTab === 'trends' && (
          <div className="popin" style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {count === 0 ? (
              <div className="plush" style={{ padding: '40px 28px', background: 'var(--surface)', textAlign: 'center' }}>
                <div style={{ marginBottom: 12 }}>
                  <Doodle kind="flower" size={48} color="var(--cream-2)" />
                </div>
                <h3 style={{ fontWeight: 800 }}>No Session Data Available</h3>
                <p style={{ color: 'var(--ink-2)', fontSize: 14, margin: '8px 0 0' }}>
                  No tracked sessions yet. Complete a neck assessment to begin.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 24 }}>
                

                <div className="plush" style={{ background: 'var(--surface)', padding: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TrendingUp size={18} color="var(--peach-deep)" /> Accuracy Progress (%)
                  </h3>
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1E3D3" />
                        <XAxis dataKey="date" stroke="var(--ink-soft)" style={{ fontSize: 11, fontWeight: 700 }} />
                        <YAxis domain={[0, 100]} stroke="var(--ink-soft)" style={{ fontSize: 11, fontWeight: 700 }} />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--surface)',
                            border: '2.5px solid var(--line)',
                            borderRadius: '10px',
                            boxShadow: 'var(--plush-tiny)',
                            fontFamily: 'Nunito',
                            fontWeight: 800
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="score"
                          name="Accuracy"
                          stroke="var(--peach-deep)"
                          strokeWidth={4.5}
                          activeDot={{ r: 8, stroke: 'var(--line)', strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>


                <div className="plush" style={{ background: 'var(--surface)', padding: 24 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={18} color="var(--sky-deep)" /> Hold Duration (seconds)
                  </h3>
                  <div style={{ width: '100%', height: 260 }}>
                    <ResponsiveContainer>
                      <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1E3D3" />
                        <XAxis dataKey="date" stroke="var(--ink-soft)" style={{ fontSize: 11, fontWeight: 700 }} />
                        <YAxis stroke="var(--ink-soft)" style={{ fontSize: 11, fontWeight: 700 }} />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--surface)',
                            border: '2.5px solid var(--line)',
                            borderRadius: '10px',
                            boxShadow: 'var(--plush-tiny)',
                            fontFamily: 'Nunito',
                            fontWeight: 800
                          }}
                        />
                        <Bar
                          dataKey="hold"
                          name="Hold Time"
                          fill="var(--sky)"
                          stroke="var(--line)"
                          strokeWidth={2.5}
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>


                <div className="plush" style={{ background: 'var(--surface)', padding: 24, gridColumn: '1 / -1' }}>
                  <h3 style={{ fontSize: 18, fontWeight: 900, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Award size={18} color="var(--butter-deep)" /> Average historical pose score (legacy)
                  </h3>
                  <div style={{ width: '100%', height: 280 }}>
                    <ResponsiveContainer>
                      <BarChart data={poseSummaryData} margin={{ top: 10, right: 10, left: -20, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#F1E3D3" />
                        <XAxis dataKey="name" stroke="var(--ink-soft)" style={{ fontSize: 12, fontWeight: 800 }} />
                        <YAxis domain={[0, 100]} stroke="var(--ink-soft)" style={{ fontSize: 11, fontWeight: 700 }} />
                        <Tooltip
                          contentStyle={{
                            background: 'var(--surface)',
                            border: '2.5px solid var(--line)',
                            borderRadius: '10px',
                            boxShadow: 'var(--plush-tiny)',
                            fontFamily: 'Nunito',
                            fontWeight: 800
                          }}
                        />
                        <Bar
                          dataKey="score"
                          name="Avg Score"
                          fill="var(--butter)"
                          stroke="var(--line)"
                          strokeWidth={2.5}
                          radius={[8, 8, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {activeTab === 'consult' && (
          <div className="popin" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, minHeight: 520 }}>
            

            <div className="plush" style={{ background: 'var(--surface)', padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3 style={{ fontSize: 18, fontWeight: 900, borderBottom: '2.5px solid var(--line)', paddingBottom: 8, color: 'var(--ink)' }}>
                {tr('Physiotherapy Assistants','مساعدو العلاج الطبيعي')}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {COACHES.map((coach) => (
                  <div
                    key={coach.id}
                    onClick={() => setSelectedCoachId(coach.id)}
                    className="tap"
                    style={{
                      padding: 12,
                      border: '2.5px solid var(--line)',
                      borderRadius: 'var(--r-sm)',
                      background: selectedCoachId === coach.id ? coach.color : 'var(--paper)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      boxShadow: selectedCoachId === coach.id ? 'none' : 'var(--plush-tiny)',
                      transform: selectedCoachId === coach.id ? 'translateY(2px)' : 'none'
                    }}
                  >
                    <div style={{
                      border: '2.5px solid var(--line)',
                      borderRadius: '50%',
                      overflow: 'hidden',
                      width: 32,
                      height: 32,
                      background: 'var(--surface)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <CuteFace size={38} mood={coach.avatarMood} skin={coach.skinColor} />
                    </div>
                    <div>
                      <h4 style={{ fontSize: 14, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>
                        {coach.name.split(' ').pop()}
                      </h4>
                      <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-soft)', margin: 0 }}>
                        {coach.role}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 'auto', background: 'var(--cream-2)', border: '2.5px solid var(--line)', borderRadius: 'var(--r-sm)', padding: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-2)', margin: 0 }}>
                  {tr('Active AI Assistant:','المساعد الذكي الحالي:')}
                </p>
                <h4 style={{ fontSize: 13, fontWeight: 900, margin: '2px 0 4px' }}>
                  {activeCoach.name}
                </h4>
                <p style={{ fontSize: 11, color: 'var(--ink-soft)', margin: 0, lineHeight: 1.4 }}>
                  {activeCoach.bio}
                </p>
              </div>
            </div>


            <div className="plush" style={{ background: 'var(--surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden', height: 520 }}>
              

              <div style={{
                padding: '16px 20px',
                borderBottom: '2.5px solid var(--line)',
                background: activeCoach.color,
                display: 'flex',
                alignItems: 'center',
                gap: 12
              }}>
                <div style={{
                  border: '2.5px solid var(--line)',
                  borderRadius: '50%',
                  overflow: 'hidden',
                  width: 40,
                  height: 40,
                  background: 'var(--surface)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <CuteFace size={48} mood={activeCoach.avatarMood} skin={activeCoach.skinColor} />
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)' }}>{activeCoach.name}</h3>
                  <p style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-2)', margin: 0 }}>
                    {activeCoach.role} • AI Physiotherapy Assistant
                  </p>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button
                    onClick={() => {
                      if (window.confirm(`Clear chat history with ${activeCoach.name.split(' ').pop()}?`)) {
                        const defaultMsgs: Record<string, string> = {
                          anya: "Hello! I can explain gentle neck positioning and your approved exercises. How can I help?",
                          rocky: "Hi! Ask me about camera tracking for your neck exercise and what it can observe.",
                          maya: "Hello! I'm a virtual physiotherapy education assistant. Please ask me about your prescribed neck exercise."
                        };
                        setChats(prev => ({
                          ...prev,
                          [selectedCoachId]: [{ sender: 'coach', text: defaultMsgs[selectedCoachId], timestamp: Date.now() }]
                        }));
                      }
                    }}
                    style={{
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'var(--ink-2)',
                      padding: 4,
                      opacity: 0.7
                    }}
                    title="Clear Chat History"
                    className="tap"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="dot" style={{ background: 'var(--line)', width: 6, height: 6 }} />
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-2)' }}>Online</span>
                  </div>
                </div>
              </div>


              <div style={{
                flex: 1,
                padding: 20,
                background: 'var(--paper)',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 16
              }}>
                {(chats[selectedCoachId] || []).map((msg, index) => {
                  const isUser = msg.sender === 'user';
                  return (
                    <div
                      key={index}
                      style={{
                        alignSelf: isUser ? 'flex-end' : 'flex-start',
                        maxWidth: '75%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isUser ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div
                        style={{
                          background: isUser ? 'var(--butter)' : 'var(--surface)',
                          border: '2.5px solid var(--line)',
                          borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                          padding: '12px 16px',
                          boxShadow: 'var(--plush-tiny)',
                          color: 'var(--ink)',
                          fontSize: 14,
                          fontWeight: 700,
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap'
                        }}
                      >
                        {msg.text}
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--ink-soft)', marginTop: 4, fontWeight: 800 }}>
                        {new Date(msg.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })}

                {isTyping && (
                  <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{
                      background: 'var(--surface)',
                      border: '2.5px solid var(--line)',
                      borderRadius: '12px 12px 12px 2px',
                      padding: '10px 16px',
                      boxShadow: 'var(--plush-tiny)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-soft)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Sparkles size={14} className="floaty" style={{ color: 'var(--peach-deep)' }} />
                        {activeCoach.name.split(' ').pop()} is thinking...
                      </span>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>


              <form
                onSubmit={handleSendMessage}
                style={{
                  padding: '12px 16px',
                  borderTop: '2.5px solid var(--line)',
                  background: 'var(--surface)',
                  display: 'flex',
                  gap: 12,
                  alignItems: 'center'
                }}
              >
                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  placeholder={language==='ar'?'اسأل المساعد عن تمارين الرقبة المعتمدة...':`Ask ${activeCoach.name.split(' ').pop()} about neck rehabilitation...`}
                  disabled={isTyping}
                  style={{
                    flex: 1,
                    height: 44,
                    border: '2.5px solid var(--line)',
                    borderRadius: 'var(--r-sm)',
                    padding: '0 16px',
                    fontFamily: 'inherit',
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--ink)',
                    outline: 'none',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)'
                  }}
                />
                <button
                  type="submit"
                  disabled={!inputText.trim() || isTyping}
                  className="btn-plush primary"
                  style={{
                    width: 44,
                    height: 44,
                    padding: 0,
                    borderRadius: 'var(--r-sm)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 3px 0 var(--line)'
                  }}
                >
                  <Send size={18} />
                </button>
              </form>

            </div>

          </div>
        )}

      </main>
    </div>
  );
}
