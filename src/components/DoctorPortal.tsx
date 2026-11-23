import { useState, useEffect, useMemo } from 'react';
import { useLanguage } from '../i18n/LanguageContext';
import { useUser } from '../utils/auth';
import { useUserData } from '../game/store';
import { CarePlanItem, SessionData, UserData } from '../game/types';
import { TopBar } from './primitives';
import { POSES } from '../data/poses';
import { NECK_EXERCISES } from '../data/neckExercises';
import { 
  Users, 
  TrendingUp, 
  X, 
  Clock, 
  Sparkles,
  HeartPulse,
  Search,
  Download,
  Plus
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Area, 
  CartesianGrid 
} from 'recharts';
import { generateDoctorInsight } from '../utils/geminiService';
import { sanitizeHtml } from '../utils/sanitize';
import { apiFetch } from '../utils/api';

interface PatientRecord extends UserData {
  id: string;
  email: string;
  sessionCount: number;
  avgScore: number;
}

// names are often saved with the title already included, so don't add a second one
function formatClinicianName(name?: string | null) {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'Doctor';
  return /^dr\.?\s/i.test(trimmed) ? trimmed : `Dr. ${trimmed}`;
}

export function DoctorPortal() {
  const doctorData = useUserData();
  const {language}=useLanguage();
  const tr=(en:string,ar:string)=>language==='ar'?ar:en;
  const { user } = useUser();

  const [neckExercise, setNeckExercise] = useState({id:'neck-rotation',title:'Gentle Neck Rotation',description:'Doctor-approved gentle rotation',instructions:'Move slowly; stop if symptoms occur.',videoUrl:'',active:false,ruleApproved:false,minNdi:0,maxNdi:100,rulePriority:100,planReps:null as number|null,planSets:null as number|null,planHoldSeconds:null as number|null,planRestSeconds:null as number|null});
  const [neckExercises,setNeckExercises]=useState<any[]>([]);
  const [neckSaveMessage,setNeckSaveMessage]=useState('');
  const [neckDetails,setNeckDetails]=useState<any>(null);
  useEffect(()=>{apiFetch('/api/neck/doctor/exercises').then(r=>r.ok?r.json():[]).then(rows=>{setNeckExercises(rows);const e=rows.find((item:any)=>item.id==='neck-rotation')||rows[0];if(e)setNeckExercise({...e,videoUrl:e.videoUrl||''});}).catch(()=>{});},[]);
  const numOrNull=(v:string)=>v===''?null:Number(v);
  async function saveNeckVideo(){setNeckSaveMessage('Saving…');try{const response=await apiFetch(`/api/neck/doctor/exercises/${neckExercise.id}`,{method:'PUT',body:JSON.stringify({...neckExercise,videoUrl:neckExercise.videoUrl||null})});const body=await response.json();if(!response.ok)throw Error(body.error||'Save failed');setNeckSaveMessage('Exercise settings saved. All library videos are independent of the NDI result.');}catch(e){setNeckSaveMessage((e as Error).message)}}
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  useEffect(()=>{if(!selectedPatient)return;apiFetch(`/api/neck/doctor/patients/${selectedPatient.id}`).then(r=>r.ok?r.json():null).then(setNeckDetails).catch(()=>setNeckDetails(null));},[selectedPatient]);
  const [patientHistory, setPatientHistory] = useState<SessionData[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionData | null>(null);

  const dailyPatientHistory = useMemo(() => {
    const groups: { [key: string]: SessionData[] } = {};
    patientHistory.forEach((s) => {
      const dayKey = new Date(s.date).toDateString();
      if (!groups[dayKey]) groups[dayKey] = [];
      groups[dayKey].push(s);
    });

    return Object.entries(groups).map(([dayKey, exercises]) => {
      const avg = Math.round(exercises.reduce((sum, e) => sum + e.averageScore, 0) / exercises.length);
      const totalDuration = exercises.reduce((sum, e) => sum + e.durationSeconds, 0);
      const totalHold = exercises.reduce((sum, e) => sum + e.holdTimeSeconds, 0);
      const latestDate = Math.max(...exercises.map(e => e.date));
      let grade: 'A' | 'B' | 'C' | 'D' = 'D';
      if (avg >= 80) grade = 'A';
      else if (avg >= 70) grade = 'B';
      else if (avg >= 60) grade = 'C';

      return {
        id: exercises[0].id,
        date: latestDate,
        dayKey,
        exercises,
        exerciseCount: exercises.length,
        averageScore: avg,
        durationSeconds: totalDuration,
        holdTimeSeconds: totalHold,
        grade,
        primarySession: exercises[0],
        displayName: exercises.length > 1
          ? tr(`Full Daily Session (${exercises.length} exercises)`, `جلسة يومية متكاملة (${exercises.length} تمارين)`)
          : exercises[0].poseName,
      };
    }).sort((a, b) => b.date - a.date);
  }, [patientHistory, language]);

  const [aiReport, setAiReport] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);

  const [activeFilterTab, setActiveFilterTab] = useState<'my' | 'all'>('my');

  const [prescribingPose, setPrescribingPose] = useState<string>('');
  const [prescribingHold, setPrescribingHold] = useState<number | ''>(30);
  const [prescribingFreq, setPrescribingFreq] = useState<string>('Daily');
  const [prescribingReps, setPrescribingReps] = useState<number | ''>('');
  const [prescribingSets, setPrescribingSets] = useState<number | ''>('');
  const [prescribingRest, setPrescribingRest] = useState<number | ''>('');
  const [isUpdatingCarePlan, setIsUpdatingCarePlan] = useState(false);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/doctor/patients');
      if (res.ok) {
        const data = await res.json();
        setPatients(data);
      }
    } catch (e) {
      console.error('Failed to load doctor patients:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleSelectPatient = async (patient: PatientRecord) => {
    setSelectedPatient(patient);
    setPatientHistory([]);
    setSelectedSession(null);
    setAiReport('');
    try {
      setHistoryLoading(true);
      const res = await apiFetch(`/api/doctor/patients/${patient.id}/sessions`);
      if (res.ok) {
        const data = await res.json();
        setPatientHistory(data);
        if (data.length > 0) {
          setSelectedSession(data[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load patient history:', e);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleGenerateAiInsight = async () => {
    if (!selectedPatient) return;
    setGeneratingAi(true);
    setAiReport('');
    try {
      const insight = await generateDoctorInsight(selectedPatient);
      // gemini sometimes wraps the html in a code fence even when told not to
      setAiReport(sanitizeHtml(insight.replace(/^\s*```(?:html)?\s*|\s*```\s*$/g, '')));
    } catch (e) {
      console.error(e);
      setAiReport('<p>Error generating report. Please check API Key and try again.</p>');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleExportCSV = (patientName: string, history: SessionData[]) => {
    if (!history || history.length === 0) {
      alert('No session history available to export.');
      return;
    }
    const headers = ['Date', 'Pose Name', 'Duration (s)', 'Hold Time (s)', 'Average Score (%)', 'Grade'];
    const rows = history.map(s => [
      new Date(s.date).toLocaleDateString(),
      s.poseName,
      s.durationSeconds,
      s.holdTimeSeconds,
      s.averageScore,
      s.grade
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Rehab_Report_${patientName.replace(/\s+/g, '_')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Patient deletion is restricted to Admin only — doctors cannot delete patients.

  const handleSaveCarePlan = async (updatedPlan: CarePlanItem[]) => {
    if (!selectedPatient) return;
    try {
      setIsUpdatingCarePlan(true);
      const res = await apiFetch(`/api/doctor/patients/${selectedPatient.id}/care-plan`, {
        method: 'PUT',
        body: JSON.stringify({ carePlan: updatedPlan })
      });
      if (res.ok) {
        const updatedUser = { ...selectedPatient, carePlan: updatedPlan };
        setSelectedPatient(updatedUser);
        setPatients(prev => prev.map(p => p.id === selectedPatient.id ? updatedUser : p));
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || 'Failed to save care plan');
      }
    } catch (e) {
      console.error(e);
      alert('Error saving care plan');
    } finally {
      setIsUpdatingCarePlan(false);
    }
  };

  const filteredPatients = patients.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (p.email || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTab = activeFilterTab === 'all' || p.doctorId === user?.id;
    return matchesSearch && matchesTab;
  });

  const totalPatientsCount = patients.length;
  const avgAdherence = totalPatientsCount > 0 
    ? Math.round(patients.reduce((sum, p) => sum + p.sessionCount, 0) / totalPatientsCount) 
    : 0;
  const avgAccuracy = totalPatientsCount > 0 
    ? Math.round(patients.reduce((sum, p) => sum + p.avgScore, 0) / totalPatientsCount) 
    : 0;
  const attentionRequired = patients.filter(p => p.sessionCount > 0 && p.avgScore < 70).length;

  return (
    <div className="screen dots-bg" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--cream)' }}>
      <TopBar here={0} steps={['PT Clinic Dashboard']} userName={doctorData?.name} showProfile={true} />
      <section className="plush" style={{maxWidth:1100,width:'95%',margin:'18px auto',padding:20,background:'var(--surface)'}}>
        <h2>{tr('NeckPhysio — Exercise video management','إدارة فيديوهات تمارين الرقبة')}</h2>
        <p>{tr('Eight exercise videos are available. NDI scores are saved for history, not used to assign videos. Camera analysis has measurement limitations.','فيديوهات التمارين الثمانية متاحة. تُحفظ نتائج NDI للسجل ولا تختار الفيديوهات. تحليل الكاميرا له حدود في القياس.')}</p>
        <div style={{display:'grid',gap:10}}>
          <label>{tr('Choose exercise','اختاري التمرين')} <select value={neckExercise.id} onChange={e=>{const row=neckExercises.find(x=>x.id===e.target.value);if(row)setNeckExercise({...row,videoUrl:row.videoUrl||''});}}>{neckExercises.map(x=><option key={x.id} value={x.id}>{x.title}</option>)}</select></label>
          <label>{tr('Exercise title','اسم التمرين')} <input style={{width:'100%'}} value={neckExercise.title} onChange={e=>setNeckExercise({...neckExercise,title:e.target.value})}/></label>
          <label>{tr('Description','الوصف')} <input style={{width:'100%'}} value={neckExercise.description} onChange={e=>setNeckExercise({...neckExercise,description:e.target.value})}/></label>
          <label>HTTPS video URL (YouTube or MP4) <input style={{width:'100%'}} type="url" value={neckExercise.videoUrl} onChange={e=>setNeckExercise({...neckExercise,videoUrl:e.target.value})} placeholder="https://.../neck-rotation.mp4"/></label>
          <label>{tr('Exercise instructions','تعليمات التمرين')} <textarea style={{width:'100%'}} value={neckExercise.instructions} onChange={e=>setNeckExercise({...neckExercise,instructions:e.target.value})}/></label>
          <label><input type="checkbox" checked={neckExercise.active} onChange={e=>setNeckExercise({...neckExercise,active:e.target.checked})}/> {tr('Active video','فيديو متاح')}</label>
          <fieldset style={{border:'1px solid #cfd8dc',borderRadius:10,padding:10}}>
            <legend>{tr('Dosage for the camera session (leave all four empty = free session without a fixed plan)','الجرعة في جلسة الكاميرا (سيبي الأربعة فاضيين = جلسة حرة من غير خطة ثابتة)')}</legend>
            <label>{tr('Reps per set','التكرارات في المجموعة')} <input type="number" min={1} max={50} style={{width:70}} value={neckExercise.planReps??''} onChange={e=>setNeckExercise({...neckExercise,planReps:numOrNull(e.target.value)})}/></label>{' '}
            <label>{tr('Sets','المجموعات')} <input type="number" min={1} max={6} style={{width:60}} value={neckExercise.planSets??''} onChange={e=>setNeckExercise({...neckExercise,planSets:numOrNull(e.target.value)})}/></label>{' '}
            <label>{tr('Hold (s)','الثبات (ث)')} <input type="number" min={1} max={30} style={{width:60}} value={neckExercise.planHoldSeconds??''} onChange={e=>setNeckExercise({...neckExercise,planHoldSeconds:numOrNull(e.target.value)})}/></label>{' '}
            <label>{tr('Rest between sets (s)','الراحة بين المجموعات (ث)')} <input type="number" min={0} max={180} style={{width:70}} value={neckExercise.planRestSeconds??''} onChange={e=>setNeckExercise({...neckExercise,planRestSeconds:numOrNull(e.target.value)})}/></label>
          </fieldset>
          <p>{tr('Video availability in the patient library is independent of NDI score. The doctor can manage video information; patient exercise sessions are recorded separately.','إتاحة الفيديوهات في مكتبة المريض مستقلة عن نتيجة NDI. يمكن للطبيب إدارة بيانات الفيديوهات، وتُحفظ جلسات المرضى بشكل منفصل.')}</p>
          <button type="button" className="btn-plush primary" onClick={saveNeckVideo}>{tr('Save neck exercise','حفظ التمرين')}</button>
          <p role="status">{neckSaveMessage}</p>
        </div>
      </section>
      {selectedPatient && neckDetails && <section className="plush" style={{maxWidth:1100,width:'95%',margin:'10px auto',padding:18,background:'var(--surface)'}}>
        <h3>{tr('Neck assessments and camera sessions:','استبيانات الرقبة وجلسات الكاميرا:')} {selectedPatient.name}</h3>
        <p>{tr('Assessments:','الاستبيانات:')} {neckDetails.assessments?.length||0} | {tr('Tracking sessions:','جلسات التتبع:')} {neckDetails.sessions?.length||0}</p>
        <div style={{overflowX:'auto'}}><table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead><tr>{[tr('Timing / Days','التوقيت / الأيام'),tr('Exercise','التمرين'),tr('Reps','التكرارات'),tr('Sets','المجموعات'),tr('Match %','التطابق %'),tr('Pain before→after','الألم قبل←بعد'),tr('Plan done','الخطة'),tr('Flags','تنبيهات')].map(h=><th key={h} style={{textAlign:'start',borderBottom:'1px solid #ccc',padding:4}}>{h}</th>)}</tr></thead>
          <tbody>{(neckDetails.sessions||[]).map((x:any,xi:number)=>{
            const pf=x.pain_after!=null&&(x.pain_after>=7||(x.pain_before!=null&&x.pain_after-x.pain_before>=3));
            const sessionNum = (neckDetails.sessions?.length||0) - xi;
            const timingStr = tr(`Day ${sessionNum}`, `اليوم ${sessionNum}`);
            return <tr key={x.id}>
            <td style={{padding:4, fontWeight: 800}}>{timingStr}</td><td style={{padding:4}}>{x.exercise_id}</td>
            <td style={{padding:4}}>{x.reps_completed??'—'}{x.reps_target?` / ${x.reps_target}`:''}</td><td style={{padding:4}}>{x.sets_target?`${x.sets_completed??0} / ${x.sets_target}`:'—'}</td>
            <td style={{padding:4}}>{x.match_percent!=null?Math.round(x.match_percent):'—'}</td><td style={{padding:4}}>{x.pain_before??'—'} → {x.pain_after??'—'}</td>
            <td style={{padding:4}}>{x.plan_completed==null?'—':x.plan_completed?'✓':'✗'}</td>
            <td style={{padding:4,color:'#a13543',fontWeight:700}}>{[x.stopped_for_symptoms&&tr('Stopped: symptoms','وقف: أعراض'),pf&&tr('Pain rise','زيادة ألم')].filter(Boolean).join(' · ')}</td></tr>;})}</tbody></table></div>
        <details style={{marginTop:8}}><summary>{tr('Raw data (JSON)','البيانات الخام (JSON)')}</summary><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',fontSize:12}}>{JSON.stringify(neckDetails,null,2)}</pre></details>
      </section>}


      <main style={{ maxWidth: 1200, width: '100%', margin: '24px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
        
        <div className="plush" style={{ padding: '24px 28px', background: 'var(--surface)', position: 'relative', overflow: 'hidden' }}>
          
          <h1 style={{ fontSize: 36, color: 'var(--ink)' }}>
            {tr('Welcome,','مرحبًا،')} {formatClinicianName(doctorData?.name || user?.firstName)}!
          </h1>
          <p style={{ fontSize: 16, color: 'var(--ink-2)', marginTop: 6, fontWeight: 700, maxWidth: 640 }}>
            {tr('NECKPHYSIOAI Clinician Portal. Review patient questionnaires and camera-session history.','بوابة أخصائي العلاج الطبيعي: متابعة استبيانات المرضى وسجل جلسات تحليل الحركة بالكاميرا.')}
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          
          <div className="plush" style={{ padding: '20px 22px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: 'var(--mint)', border: '2.5px solid var(--line)', padding: 12, borderRadius: 12, display: 'flex', color: 'var(--ink)' }}>
              <Users size={24} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tr('Total Patients','إجمالي المرضى')}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--ink)', marginTop: 2 }}>{totalPatientsCount}</div>
            </div>
          </div>

          <div className="plush" style={{ padding: '20px 22px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: 'var(--butter)', border: '2.5px solid var(--line)', padding: 12, borderRadius: 12, display: 'flex', color: 'var(--ink)' }}>
              <Clock size={24} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tr('Avg. Sessions','متوسط الجلسات')}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--ink)', marginTop: 2 }}>{avgAdherence} workouts</div>
            </div>
          </div>

          <div className="plush" style={{ padding: '20px 22px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: 'var(--peach)', border: '2.5px solid var(--line)', padding: 12, borderRadius: 12, display: 'flex', color: 'var(--ink)' }}>
              <TrendingUp size={24} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tr('Avg. ROM Accuracy','متوسط تقييم الحركة')}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--ink)', marginTop: 2 }}>{avgAccuracy}%</div>
            </div>
          </div>

          <div className="plush" style={{ padding: '20px 22px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: attentionRequired > 0 ? '#FFEAE6' : '#EAFCEF', border: '2.5px solid var(--line)', padding: 12, borderRadius: 12, display: 'flex', color: 'var(--ink)' }}>
              <HeartPulse size={24} style={{ color: attentionRequired > 0 ? '#FF6B4A' : '#10B981' }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tr('Attention Alerts','تنبيهات المتابعة')}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: attentionRequired > 0 ? '#FF6B4A' : 'var(--ink)', marginTop: 2 }}>{attentionRequired} patient(s)</div>
            </div>
          </div>
        </div>

        <div className="plush" style={{ background: 'var(--surface)', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>{tr('Active Recovery Registrants','قائمة المرضى المسجلين')}</h3>
              {doctorData?.role === 'admin' && (
              <div style={{ display: 'flex', background: 'var(--cream)', border: '2.5px solid var(--line)', borderRadius: 10, padding: 3 }}>
                <button
                  onClick={() => setActiveFilterTab('my')}
                  style={{
                    background: activeFilterTab === 'my' ? 'var(--mint)' : 'transparent',
                    border: activeFilterTab === 'my' ? '2px solid var(--line)' : '2px solid transparent',
                    borderRadius: 6,
                    padding: '4px 12px',
                    fontSize: 12,
                    fontWeight: 900,
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    boxShadow: activeFilterTab === 'my' ? '1.5px 1.5px 0 var(--line)' : 'none',
                    transition: 'all 0.1s ease'
                  }}
                >
                  My Patients
                </button>
                <button
                  onClick={() => setActiveFilterTab('all')}
                  style={{
                    background: activeFilterTab === 'all' ? 'var(--mint)' : 'transparent',
                    border: activeFilterTab === 'all' ? '2px solid var(--line)' : '2px solid transparent',
                    borderRadius: 6,
                    padding: '4px 12px',
                    fontSize: 12,
                    fontWeight: 900,
                    color: 'var(--ink)',
                    cursor: 'pointer',
                    boxShadow: activeFilterTab === 'all' ? '1.5px 1.5px 0 var(--line)' : 'none',
                    transition: 'all 0.1s ease'
                  }}
                >
                  All Patients
                </button>
              </div>
              )}
            </div>
            <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
              <Search 
                size={18} 
                style={{ 
                  position: 'absolute', 
                  left: 14, 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: 'var(--ink-soft)',
                  strokeWidth: 3,
                  pointerEvents: 'none'
                }} 
              />
              <input
                type="text"
                placeholder="Search patient database..."
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 42px',
                  border: '2.5px solid var(--line)',
                  borderRadius: 12,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  fontWeight: 800,
                  color: 'var(--ink)',
                  outline: 'none',
                  boxShadow: isSearchFocused ? '5px 5px 0 var(--line)' : '3px 3px 0 var(--line)',
                  background: 'var(--surface)',
                  transform: isSearchFocused ? 'translate(-2px, -2px)' : 'none',
                  transition: 'all 0.1s ease'
                }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 15, fontWeight: 800, color: 'var(--ink-soft)' }}>
              Loading registered patient data...
            </div>
          ) : filteredPatients.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', border: '3.5px dashed var(--line)', borderRadius: 16, fontSize: 14, fontWeight: 800, color: 'var(--ink-soft)' }}>
              No registered patients match your search.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
              {filteredPatients.map(p => (
                <div 
                  key={p.id}
                  onClick={() => handleSelectPatient(p)}
                  className="plush-card tap"
                  style={{
                    padding: '20px 22px',
                    background: 'var(--surface)',
                    border: '2.5px solid var(--line)',
                    borderRadius: 'var(--r-md)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    boxShadow: 'var(--plush-sm)',
                    gap: 12
                  }}
                >
                  <div>
                    <h4 style={{ fontSize: 18, color: 'var(--ink)', margin: 0, fontWeight: 900 }}>{p.name}</h4>
                    <p style={{ fontSize: 12, color: 'var(--ink-soft)', margin: '4px 0 0', fontWeight: 800, textTransform: 'uppercase' }}>
                      Goal: {p.goal} • {p.age} y/o
                    </p>
                  </div>
                  
                  <div style={{ borderTop: '2px dashed var(--line)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800 }}>
                    <div>
                      <span style={{ color: 'var(--ink-soft)' }}>Sessions:</span>{' '}
                      <span style={{ color: 'var(--ink)' }}>{p.sessionCount}</span>
                    </div>
                    <div>
                      <span style={{ color: 'var(--ink-soft)' }}>ROM Rating:</span>{' '}
                      <span style={{ color: p.avgScore < 70 && p.sessionCount > 0 ? '#FF6B4A' : '#10B981' }}>
                        {p.sessionCount > 0 ? `${p.avgScore}%` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {selectedPatient && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(43, 30, 22, 0.4)',
          zIndex: 100,
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'stretch'
        }}>
          <div style={{ flex: 1 }} onClick={() => setSelectedPatient(null)} />
          
          <div className="slide-in-right" style={{
            width: '100%',
            maxWidth: 680,
            background: 'var(--cream)',
            borderLeft: '2.5px solid var(--line)',
            padding: '32px 28px',
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            overflowY: 'auto',
            boxShadow: '-10px 0 0 rgba(43, 30, 22, 0.1)'
          }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px dashed var(--line)', paddingBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 26, color: 'var(--ink)', margin: 0 }}>{selectedPatient.name}</h2>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '4px 0 0', fontWeight: 800 }}>
                  Access Profile: {selectedPatient.email} • {selectedPatient.age} years old
                </p>
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button
                  onClick={() => handleExportCSV(selectedPatient.name, patientHistory)}
                  className="tap btn-plush ghost"
                  style={{
                    fontSize: '12px',
                    padding: '8px 12px',
                    borderRadius: 'var(--r-sm)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: '2px 2px 0 var(--line)'
                  }}
                  title="Export workout logs to CSV"
                >
                  <Download size={14} /> Export CSV
                </button>
                <button 
                  onClick={() => setSelectedPatient(null)}
                  style={{
                    border: '2.5px solid var(--line)',
                    background: 'var(--surface)',
                    borderRadius: 12,
                    padding: 8,
                    cursor: 'pointer',
                    display: 'flex',
                    boxShadow: '2px 2px 0 var(--line)'
                  }}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="plush" style={{ padding: '12px 16px', background: 'var(--surface)', fontSize: 13 }}>
                <span style={{ display: 'block', fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase', fontSize: 10 }}>Experience Level</span>
                <span style={{ fontWeight: 800, color: 'var(--ink)', textTransform: 'capitalize' }}>{selectedPatient.experience}</span>
              </div>
              <div className="plush" style={{ padding: '12px 16px', background: 'var(--surface)', fontSize: 13 }}>
                <span style={{ display: 'block', fontWeight: 900, color: 'var(--ink-soft)', textTransform: 'uppercase', fontSize: 10 }}>Wellness Goal</span>
                <span style={{ fontWeight: 800, color: 'var(--ink)', textTransform: 'capitalize' }}>{selectedPatient.goal}</span>
              </div>
            </div>

            {(() => {
              const currentCarePlan = selectedPatient.carePlan ?? [];
              return (
                <div className="plush" style={{ background: 'var(--surface)', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HeartPulse size={18} style={{ color: 'var(--rose-deep)' }} /> Rehabilitative Care Plan
                  </h4>
                  
                  {currentCarePlan.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, fontWeight: 700 }}>
                      No active rehabilitation plan prescribed. Define one below.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {currentCarePlan.map((planItem: any, index: number) => {
                        const matchedNeck = NECK_EXERCISES.find(e => e.id === planItem.poseId);
                        const matchedPose = POSES.find(p => p.id === planItem.poseId);
                        const displayName = planItem.poseName || matchedNeck?.title || matchedPose?.name || planItem.poseId;
                        return (
                          <div 
                            key={index}
                            style={{ 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'space-between', 
                              padding: '12px 14px', 
                              border: '2.5px solid var(--line)', 
                              borderRadius: 8, 
                              background: 'var(--cream)',
                              gap: 12
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--ink)' }}>
                                {displayName}
                              </div>
                              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                {planItem.sets ? (
                                  <span><b>{planItem.sets}</b> {tr('Sets', 'مجموعات')}</span>
                                ) : null}
                                <span>
                                  {planItem.reps ? (
                                    <><b>{planItem.reps}</b> {tr('Reps', 'تكرار')}</>
                                  ) : (
                                    <span style={{ color: 'var(--teal-deep)', fontWeight: 800 }}>{tr('Free session (no forced reps)', 'جلسة حرة بدون عدد إجباري')}</span>
                                  )}
                                </span>
                                {planItem.targetHold ? (
                                  <span>• {tr('Hold', 'ثبات')}: <b>{planItem.targetHold}s</b></span>
                                ) : null}
                                {planItem.restSeconds ? (
                                  <span>• {tr('Rest', 'راحة')}: <b>{planItem.restSeconds}s</b></span>
                                ) : null}
                                <span>• {planItem.frequency || 'Daily'}</span>
                              </div>
                            </div>
                            <button
                              disabled={isUpdatingCarePlan}
                              onClick={() => {
                                const newPlan = currentCarePlan.filter((_, idx) => idx !== index);
                                handleSaveCarePlan(newPlan);
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--rose-deep)',
                                cursor: 'pointer',
                                display: 'flex',
                                padding: 6
                              }}
                              title={tr('Remove prescription', 'إزالة التمرين')}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div 
                    style={{ 
                      marginTop: 8,
                      padding: '16px 18px',
                      border: '2.5px dashed var(--line)',
                      borderRadius: 12,
                      background: 'var(--paper)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--ink)' }}>
                      {tr('Prescribe Pose & Exercise Dosage', 'تحديد التمرين والجرعة التدريبية للمريض')}
                    </div>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                      {/* Select Pose / Exercise */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                        <label style={{ fontSize: 11, fontWeight: 900, color: 'var(--ink-soft)' }}>
                          {tr('Select Pose / Exercise', 'اختيار التمرين أو الوضعية (Select Pose)')} *
                        </label>
                        <select
                          value={prescribingPose}
                          onChange={(e) => setPrescribingPose(e.target.value)}
                          style={{
                            padding: '8px 10px',
                            border: '2.5px solid var(--line)',
                            borderRadius: 8,
                            background: 'var(--surface)',
                            fontSize: 13,
                            fontWeight: 800,
                            fontFamily: 'inherit',
                            outline: 'none'
                          }}
                        >
                          <option value="">{tr('-- Select Pose / Exercise --', '-- اختاري التمرين أو الوضعية --')}</option>
                          <optgroup label={tr('Neck Rehabilitation Exercises', 'تمارين تأهيل الرقبة')}>
                            {NECK_EXERCISES.map(e => (
                              <option key={e.id} value={e.id}>{e.title} {e.isOptional ? tr('(Optional)', '(اختياري)') : ''}</option>
                            ))}
                          </optgroup>
                          <optgroup label={tr('Pose Library', 'وضعيات الكاميرا العامة')}>
                            {POSES.map(p => (
                              <option key={p.id} value={p.id}>{p.name.split(' (')[0]}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      {/* Reps per Set (فارغ = جلسة حرة بدون عدد إجباري) */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 900, color: 'var(--ink-soft)' }}>
                          {tr('Reps per Set', 'التكرارات في المجموعة')}
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          placeholder={tr('Empty = Free session', 'فارغ = جلسة حرة')}
                          value={prescribingReps}
                          onChange={(e) => setPrescribingReps(e.target.value === '' ? '' : parseInt(e.target.value))}
                          style={{
                            padding: '8px 10px',
                            border: '2.5px solid var(--line)',
                            borderRadius: 8,
                            background: 'var(--surface)',
                            fontSize: 12,
                            fontWeight: 800,
                            fontFamily: 'inherit',
                            outline: 'none'
                          }}
                        />
                      </div>

                      {/* Number of Sets */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 900, color: 'var(--ink-soft)' }}>
                          {tr('Number of Sets', 'عدد المجموعات')}
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          placeholder={tr('Empty = Free', 'فارغ = حر')}
                          value={prescribingSets}
                          onChange={(e) => setPrescribingSets(e.target.value === '' ? '' : parseInt(e.target.value))}
                          style={{
                            padding: '8px 10px',
                            border: '2.5px solid var(--line)',
                            borderRadius: 8,
                            background: 'var(--surface)',
                            fontSize: 12,
                            fontWeight: 800,
                            fontFamily: 'inherit',
                            outline: 'none'
                          }}
                        />
                      </div>

                      {/* Target Hold Seconds */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 900, color: 'var(--ink-soft)' }}>
                          {tr('Hold Time (seconds)', 'مدة الثبات (ثواني)')}
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="600"
                          placeholder={tr('Seconds (e.g. 30)', 'ثواني (افتراضي 30)')}
                          value={prescribingHold}
                          onChange={(e) => setPrescribingHold(e.target.value === '' ? '' : parseInt(e.target.value))}
                          style={{
                            padding: '8px 10px',
                            border: '2.5px solid var(--line)',
                            borderRadius: 8,
                            background: 'var(--surface)',
                            fontSize: 12,
                            fontWeight: 800,
                            fontFamily: 'inherit',
                            outline: 'none'
                          }}
                        />
                      </div>

                      {/* Rest Time Seconds */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 900, color: 'var(--ink-soft)' }}>
                          {tr('Rest Time (seconds)', 'مدة الراحة (ثواني)')}
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="600"
                          placeholder={tr('Seconds (e.g. 15)', 'ثواني (مثال 15)')}
                          value={prescribingRest}
                          onChange={(e) => setPrescribingRest(e.target.value === '' ? '' : parseInt(e.target.value))}
                          style={{
                            padding: '8px 10px',
                            border: '2.5px solid var(--line)',
                            borderRadius: 8,
                            background: 'var(--surface)',
                            fontSize: 12,
                            fontWeight: 800,
                            fontFamily: 'inherit',
                            outline: 'none'
                          }}
                        />
                      </div>

                      {/* Frequency */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label style={{ fontSize: 11, fontWeight: 900, color: 'var(--ink-soft)' }}>
                          {tr('Frequency', 'التكرار')}
                        </label>
                        <select
                          value={prescribingFreq}
                          onChange={(e) => setPrescribingFreq(e.target.value)}
                          style={{
                            padding: '8px 10px',
                            border: '2.5px solid var(--line)',
                            borderRadius: 8,
                            background: 'var(--surface)',
                            fontSize: 12,
                            fontWeight: 800,
                            fontFamily: 'inherit',
                            outline: 'none'
                          }}
                        >
                          <option value="Daily">{tr('Daily', 'يومياً')}</option>
                          <option value="Every other day">{tr('Every other day', 'يوم بعد يوم')}</option>
                          <option value="3x a week">{tr('3x a week', '3 مرات أسبوعياً')}</option>
                          <option value="2x a week">{tr('2x a week', 'مرتان أسبوعياً')}</option>
                          <option value="Weekly">{tr('Weekly', 'أسبوعياً')}</option>
                        </select>
                      </div>
                    </div>

                    <button
                      disabled={isUpdatingCarePlan || !prescribingPose}
                      onClick={() => {
                        if (!prescribingPose) return;
                        if (currentCarePlan.some((item: any) => item.poseId === prescribingPose)) {
                          alert(tr('This pose is already in the care plan!', 'هذا التمرين مضاف بالفعل في الخطة العلاجية!'));
                          return;
                        }
                        const matchedNeck = NECK_EXERCISES.find(e => e.id === prescribingPose);
                        const matchedPose = POSES.find(p => p.id === prescribingPose);
                        const resolvedName = matchedNeck?.title || matchedPose?.name?.split(' (')[0] || prescribingPose;

                        const newPlan = [
                          ...currentCarePlan,
                          {
                            poseId: prescribingPose,
                            poseName: resolvedName,
                            targetHold: prescribingHold !== '' ? Number(prescribingHold) : null,
                            frequency: prescribingFreq || 'Daily',
                            reps: prescribingReps !== '' ? Number(prescribingReps) : null,
                            sets: prescribingSets !== '' ? Number(prescribingSets) : null,
                            restSeconds: prescribingRest !== '' ? Number(prescribingRest) : null,
                          }
                        ];
                        handleSaveCarePlan(newPlan);
                        setPrescribingPose('');
                        setPrescribingReps('');
                        setPrescribingSets('');
                        setPrescribingRest('');
                        setPrescribingHold(30);
                      }}
                      className="tap btn-plush primary"
                      style={{
                        padding: '10px 14px',
                        fontSize: 13,
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        marginTop: 4,
                        boxShadow: '2px 2px 0 var(--line)'
                      }}
                    >
                      <Plus size={16} /> {tr('Add Prescription to Patient Plan', 'إضافة التمرين لخطة علاج المريض')}
                    </button>
                  </div>
                </div>
              );
            })()}

            <div className="plush" style={{ background: 'var(--surface)', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h4 style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} style={{ color: 'var(--peach-deep)' }} /> Clinician Clinical Insight
                </h4>
                <button
                  onClick={handleGenerateAiInsight}
                  disabled={generatingAi || historyLoading || patientHistory.length === 0}
                  className="btn-plush primary"
                  style={{ fontSize: 12, padding: '8px 14px', borderRadius: 8, margin: 0 }}
                >
                  {generatingAi ? 'Analyzing Metrics...' : 'Generate AIPT Report'}
                </button>
              </div>

              {generatingAi ? (
                <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, fontWeight: 800, color: 'var(--ink-soft)' }}>
                  Attending Grader AI is compiling range-of-motion metrics...
                </div>
              ) : aiReport ? (
                <div 
                  className="ai-critique-rendered"
                  style={{ 
                    fontSize: 14, 
                    lineHeight: 1.6, 
                    color: 'var(--ink-2)', 
                    maxHeight: 280, 
                    overflowY: 'auto', 
                    border: '2.5px solid var(--line)', 
                    borderRadius: 12, 
                    padding: 16, 
                    background: '#FDFBF7'
                  }}
                  dangerouslySetInnerHTML={{ __html: aiReport }}
                />
              ) : (
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, fontWeight: 700 }}>
                  Generate an AI-driven clinical physical therapy assessment summarizing this patient's joint angle holding trends.
                </p>
              )}
            </div>

            {patientHistory.length > 0 && selectedSession && (
              <div className="plush" style={{ background: 'var(--surface)', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                <h4 style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>
                  Rehabilitation Performance Trend ({selectedSession.poseName})
                </h4>
                
                <div style={{ height: 180, width: '100%', fontSize: 11, fontWeight: 700 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={selectedSession.frameLogs.map((log, index) => ({
                        frame: index + 1,
                        score: log.score
                      }))}
                      margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                      <XAxis dataKey="frame" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip />
                      <Area 
                        type="monotone" 
                        dataKey="score" 
                        stroke="var(--line)" 
                        fill="var(--mint)" 
                        strokeWidth={3} 
                        fillOpacity={0.8}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800 }}>
                  {(() => {
                    const sessionIdx = dailyPatientHistory.findIndex(s => s.exercises.some(e => e.id === selectedSession.id));
                    const sessionDayNum = sessionIdx >= 0 ? dailyPatientHistory.length - sessionIdx : 1;
                    const timingText = tr(`Day ${sessionDayNum}`, `اليوم ${sessionDayNum}`);
                    return <span style={{ color: 'var(--ink-soft)' }}>{tr('Day', 'اليوم')}: <b>{timingText}</b></span>;
                  })()}
                  <span style={{ color: 'var(--ink)' }}>Hold Efficiency: {selectedSession.holdTimeSeconds}s / {selectedSession.durationSeconds}s</span>
                </div>
              </div>
            )}

            <div className="plush" style={{ background: 'var(--surface)', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <h4 style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>Workout Practice Records</h4>
              
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: '20px 0', fontSize: 13, fontWeight: 800, color: 'var(--ink-soft)' }}>
                  Loading sessions...
                </div>
              ) : patientHistory.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: 0, fontWeight: 700 }}>
                  This patient has not completed any training sessions yet.
                </p>
              ) : (
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2.5px solid var(--line)', color: 'var(--ink-soft)', fontWeight: 900 }}>
                        <th style={{ padding: '8px 4px' }}>{tr('Timing / Day', 'اليوم / التوقيت')}</th>
                        <th style={{ padding: '8px 4px' }}>{tr('Pose', 'التمرين')}</th>
                        <th style={{ padding: '8px 4px' }}>{tr('Duration', 'المدة')}</th>
                        <th style={{ padding: '8px 4px' }}>{tr('Hold', 'الثبات')}</th>
                        <th style={{ padding: '8px 4px' }}>{tr('Score', 'الدرجة')}</th>
                        <th style={{ padding: '8px 4px' }}>{tr('Grade', 'التقييم')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailyPatientHistory.map((s, idx) => {
                        const sessionDayNum = dailyPatientHistory.length - idx;
                        const timingText = tr(`Day ${sessionDayNum}`, `اليوم ${sessionDayNum}`);
                        return (
                          <tr 
                            key={s.id} 
                            onClick={() => setSelectedSession(s.primarySession)}
                            style={{ 
                              borderBottom: '2px dashed var(--line)', 
                              fontWeight: 800, 
                              cursor: 'pointer',
                              background: selectedSession?.id === s.primarySession.id ? 'var(--cream)' : 'transparent'
                            }}
                          >
                            <td style={{ padding: '10px 4px', fontWeight: 900 }}>{timingText}</td>
                            <td style={{ padding: '10px 4px', color: 'var(--ink)' }}>{s.displayName}</td>
                            <td style={{ padding: '10px 4px' }}>{s.durationSeconds}s</td>
                            <td style={{ padding: '10px 4px' }}>{s.holdTimeSeconds}s</td>
                            <td style={{ padding: '10px 4px' }}>{s.averageScore}%</td>
                            <td style={{ padding: '10px 4px' }}>
                              <span style={{
                                background: s.grade === 'A' ? 'var(--mint)' : s.grade === 'B' ? 'var(--butter)' : '#FFEAE6',
                                padding: '2px 8px',
                                borderRadius: 6,
                                border: '2.5px solid var(--line)',
                                fontSize: 11
                              }}>
                                {s.grade}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
          </div>
        </div>
      )}
    </div>
  );
}
