import { useState, useEffect } from 'react';
import { useAuth } from '../utils/auth';
import { apiFetch } from '../utils/api';
import { store, useUserData } from '../game/store';
import { TopBar } from './primitives';
import { useLanguage } from '../i18n/LanguageContext';
import { 
  Shield, 
  Database, 
  Trash2, 
  Activity, 
  User, 
  Stethoscope, 
  Cpu,
  Search,
  Dumbbell,
  Users as UsersIcon,
  Save,
  CheckCircle2,
  AlertCircle,
  X,
  Award,
  Flame,
  Heart,
  Plus
} from 'lucide-react';

interface SystemStats {
  totalUsers: number;
  patients: number;
  doctors: number;
  sessions: number;
  dbEngine: string;
  dbSize: string;
  uptime: string;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  age: number;
  experience: string;
  goal: string;
  role: 'patient' | 'doctor' | 'admin';
  doctorId?: string | null;
  approved?: boolean;
  sessionCount?: number;
  avgScore?: number | null;
}

export function AdminPortal() {
  const adminData = useUserData();
  const { userId } = useAuth();
  const { language } = useLanguage();
  const tr = (en: string, ar: string) => language === 'ar' ? ar : en;

  const [activeTab, setActiveTab] = useState<'users' | 'exercises'>('users');

  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    patients: 0,
    doctors: 0,
    sessions: 0,
    dbEngine: 'PostgreSQL',
    dbSize: '0.00 MB',
    uptime: '0s'
  });
  const [users, setUsers] = useState<UserRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUserModal, setSelectedUserModal] = useState<UserRow | null>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Exercise management state
  const [neckExercises, setNeckExercises] = useState<any[]>([]);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<any>({
    id: '',
    title: '',
    description: '',
    instructions: '',
    videoUrl: '',
    active: true,
    planReps: null,
    planSets: null,
    planHoldSeconds: null,
    planRestSeconds: null
  });
  const [exerciseSaveMessage, setExerciseSaveMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [isSavingExercise, setIsSavingExercise] = useState(false);

  const numOrNull = (v: string) => v === '' ? null : Number(v);

  const fetchAdminData = async () => {
    try {
      setLoading(true);
      const [statsRes, usersRes] = await Promise.all([
        apiFetch('/api/admin/stats'),
        apiFetch('/api/admin/users')
      ]);
      
      if (statsRes.ok && usersRes.ok) {
        const statsData = await statsRes.json();
        const usersData = await usersRes.json();
        setStats(statsData);
        setUsers(usersData);
      }
    } catch (e) {
      console.error('Failed to fetch administrator dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchExercises = async () => {
    try {
      const res = await apiFetch('/api/neck/doctor/exercises');
      if (res.ok) {
        const rows = await res.json();
        const filtered = rows.filter((r: any) => !r.id.startsWith('neutral-head'));
        setNeckExercises(filtered);
        if (filtered.length > 0 && (!selectedExercise.id || !filtered.some((x: any) => x.id === selectedExercise.id))) {
          setSelectedExercise({
            ...filtered[0],
            videoUrl: filtered[0].videoUrl || '',
            planReps: filtered[0].planReps ?? null,
            planSets: filtered[0].planSets ?? null,
            planHoldSeconds: filtered[0].planHoldSeconds ?? null,
            planRestSeconds: filtered[0].planRestSeconds ?? null
          });
        }
      }
    } catch (e) {
      console.error('Failed to fetch exercises:', e);
    }
  };

  useEffect(() => {
    fetchAdminData();
    fetchExercises();
    const interval = setInterval(async () => {
      try {
        const res = await apiFetch('/api/admin/stats');
        if (res.ok) {
          const statsData = await res.json();
          setStats(statsData);
        }
      } catch (e) {}
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleChangeRole = async (targetId: string, newRole: 'patient' | 'doctor' | 'admin') => {
    try {
      setUpdatingId(targetId);
      const res = await apiFetch(`/api/admin/users/${targetId}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        const currentUser = store.getState().userData;
        if (targetId === userId && currentUser) {
          store.setUserData({ ...currentUser, role: newRole });
          store.setScreen(newRole === 'doctor' ? 'doctor' : newRole === 'admin' ? 'admin' : 'dashboard');
        }
        await fetchAdminData();
      } else {
        alert(tr('Failed to update role', 'فشل تغيير الصلاحية'));
      }
    } catch (e) {
      console.error(e);
      alert(tr('Role change error', 'حدث خطأ أثناء تغيير الصلاحية'));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleApproveDoctor = async (targetId: string) => {
    try {
      setUpdatingId(targetId);
      const res = await apiFetch(`/api/admin/users/${targetId}/approve`, { method: 'POST' });
      if (res.ok) {
        await fetchAdminData();
      } else {
        alert(tr('Failed to approve doctor', 'فشل اعتماد الدكتور'));
      }
    } catch (e) {
      console.error(e);
      alert(tr('Error approving doctor', 'حدث خطأ أثناء اعتماد الدكتور'));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleAssignDoctor = async (patientId: string, doctorClerkId: string) => {
    try {
      setUpdatingId(patientId);
      const res = await apiFetch(`/api/admin/users/${patientId}/doctor`, {
        method: 'PUT',
        body: JSON.stringify({ doctorId: doctorClerkId || null })
      });
      if (res.ok) {
        await fetchAdminData();
      } else {
        alert(tr('Failed to assign doctor', 'فشل ربط الدكتور بالمريض'));
      }
    } catch (e) {
      console.error(e);
      alert(tr('Error assigning doctor', 'حدث خطأ أثناء ربط الدكتور'));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteUser = async (targetId: string, name: string) => {
    if (targetId === userId) {
      alert(tr('You cannot delete your own active admin account!', 'لا يمكنكِ مسح حساب الأدمن الخاص بكِ!'));
      return;
    }
    const confirmMessage = tr(
      `Are you sure you want to permanently delete user "${name}"?\nThis will erase their profile and workout logs. This action is irreversible.`,
      `هل أنتِ متأكدة من رغبتك في حذف حساب "${name}" نهائياً من الموقع؟\nسيتم مسح بياناته وجميع سجلات الجلسات الخاصة به. هذا الإجراء لا يمكن التراجع عنه.`
    );
    if (!window.confirm(confirmMessage)) {
      return;
    }
    
    try {
      setUpdatingId(targetId);
      const res = await apiFetch(`/api/admin/users/${targetId}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchAdminData();
      } else {
        alert(tr('Failed to delete user', 'فشل حذف الحساب'));
      }
    } catch (e) {
      console.error(e);
      alert(tr('Delete user error', 'حدث خطأ أثناء حذف الحساب'));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSaveExercise = async () => {
    if (!selectedExercise.id || !selectedExercise.id.trim()) {
      setExerciseSaveMessage({
        text: tr('Exercise ID is required', 'معرّف التمرين مطلوب (باللغة الإنجليزية بدون مسافات)'),
        ok: false
      });
      return;
    }
    if (!selectedExercise.title || !selectedExercise.title.trim()) {
      setExerciseSaveMessage({
        text: tr('Exercise title is required', 'اسم التمرين مطلوب'),
        ok: false
      });
      return;
    }

    setIsSavingExercise(true);
    setExerciseSaveMessage(null);
    try {
      const formattedId = selectedExercise.id.trim().toLowerCase().replace(/\s+/g, '-');
      const url = isCreatingNew 
        ? '/api/neck/doctor/exercises' 
        : `/api/neck/doctor/exercises/${formattedId}`;
      const method = isCreatingNew ? 'POST' : 'PUT';

      const res = await apiFetch(url, {
        method,
        body: JSON.stringify({
          ...selectedExercise,
          id: formattedId,
          videoUrl: selectedExercise.videoUrl ? selectedExercise.videoUrl.trim() : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setExerciseSaveMessage({
          text: isCreatingNew
            ? tr('New exercise added successfully!', 'تمت إضافة التمرين الجديد بنجاح إلى النظام! ✓')
            : tr('Exercise updated successfully!', 'تم حفظ تعديلات التمرين والتكرارات بنجاح! ✓'),
          ok: true
        });
        setIsCreatingNew(false);
        await fetchExercises();
      } else {
        setExerciseSaveMessage({
          text: data.error || tr('Failed to save exercise', 'فشل حفظ التمرين'),
          ok: false
        });
      }
    } catch (e: any) {
      setExerciseSaveMessage({
        text: e.message || tr('An error occurred', 'حدث خطأ أثناء الحفظ'),
        ok: false
      });
    } finally {
      setIsSavingExercise(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="screen dots-bg" dir={language === 'ar' ? 'rtl' : 'ltr'} style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--cream)' }}>
      <TopBar here={0} steps={[tr('System Administrator Dashboard', 'لوحة تحكم مسؤول النظام (Admin)')]} userName={adminData?.name} showProfile={true} />

      <main style={{ maxWidth: 1200, width: '100%', margin: '24px auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 24, flex: 1 }}>
        
        {/* Header Hero */}
        <div className="plush" style={{ padding: '24px 28px', background: 'var(--surface)', position: 'relative', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'var(--peach)', padding: 10, borderRadius: 12, border: '2.5px solid var(--line)' }}>
              <Shield size={28} />
            </div>
            <div>
              <h1 style={{ fontSize: 30, color: 'var(--ink)', margin: 0 }}>
                {tr('System Administrator Portal', 'بوابة الإدارة والتحكم في النظام')}
              </h1>
              <p style={{ fontSize: 14, color: 'var(--ink-2)', marginTop: 4, fontWeight: 700, margin: 0 }}>
                {tr('Manage user accounts, delete profiles, configure exercise repetitions, and oversee clinic operations.', 'التحكم في الحسابات، مسح المستخدمين، تعديل أسماء التمارين وعدد تكراراتها، ومتابعة النظام.')}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <div className="plush" style={{ padding: '16px 20px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: 'var(--mint)', border: '2.5px solid var(--line)', padding: 10, borderRadius: 12, display: 'flex' }}>
              <UsersIcon size={22} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--ink-soft)' }}>{tr('Total Users', 'إجمالي المستخدمين')}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', marginTop: 2 }}>{stats.totalUsers} ({tr('Patients', 'مرضى')}: {stats.patients})</div>
            </div>
          </div>

          <div className="plush" style={{ padding: '16px 20px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: 'var(--butter)', border: '2.5px solid var(--line)', padding: 10, borderRadius: 12, display: 'flex' }}>
              <Stethoscope size={22} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--ink-soft)' }}>{tr('Approved Doctors', 'الأطباء المعتمدون')}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', marginTop: 2 }}>{stats.doctors}</div>
            </div>
          </div>

          <div className="plush" style={{ padding: '16px 20px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: 'var(--peach)', border: '2.5px solid var(--line)', padding: 10, borderRadius: 12, display: 'flex' }}>
              <Activity size={22} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--ink-soft)' }}>{tr('Workouts Logged', 'الجلسات المسجلة')}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', marginTop: 2 }}>{stats.sessions} {tr('sessions', 'جلسة')}</div>
            </div>
          </div>

          <div className="plush" style={{ padding: '16px 20px', background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ background: '#EAFCEF', border: '2.5px solid var(--line)', padding: 10, borderRadius: 12, display: 'flex', color: '#10B981' }}>
              <Cpu size={22} />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 900, color: 'var(--ink-soft)' }}>{tr('Database / Status', 'حالة قاعدة البيانات')}</div>
              <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', marginTop: 2 }}>{stats.dbEngine} ✓</div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <button
            onClick={() => setActiveTab('users')}
            className={`tap btn-plush ${activeTab === 'users' ? 'primary' : 'ghost'}`}
            style={{
              padding: '12px 20px',
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              flex: '1 1 220px'
            }}
          >
            <UsersIcon size={18} /> {tr('User Accounts & Permissions', 'إدارة المستخدمين وحذف الحسابات')}
          </button>

          <button
            onClick={() => setActiveTab('exercises')}
            className={`tap btn-plush ${activeTab === 'exercises' ? 'primary' : 'ghost'}`}
            style={{
              padding: '12px 20px',
              borderRadius: 14,
              fontSize: 14,
              fontWeight: 900,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: 'pointer',
              flex: '1 1 220px'
            }}
          >
            <Dumbbell size={18} /> {tr('Exercise & Repetitions Management', 'إدارة وتعديل التمارين والتكرارات')}
          </button>
        </div>

        {/* TAB 1: USER ACCOUNTS & DELETE */}
        {activeTab === 'users' && (
          <div className="plush" style={{ background: 'var(--surface)', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <h3 style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>
                  {tr('Registered User Accounts', 'قائمة المستخدمين المسجلين')}
                </h3>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '4px 0 0', fontWeight: 800 }}>
                  {tr('You can change roles, assign doctors, or permanently delete accounts.', 'يمكنكِ تغيير الصلاحيات، ربط الأطباء بالمرضى، أو مسح الحسابات نهائياً من الموقع.')}
                </p>
              </div>
              
              <div style={{ position: 'relative', width: '100%', maxWidth: 320 }}>
                <Search 
                  size={18} 
                  style={{ 
                    position: 'absolute', 
                    [language === 'ar' ? 'right' : 'left']: 14, 
                    top: '50%', 
                    transform: 'translateY(-50%)', 
                    color: 'var(--ink-soft)',
                    strokeWidth: 3,
                    pointerEvents: 'none'
                  }} 
                />
                <input
                  type="text"
                  placeholder={tr('Search name, email, role...', 'ابحث بالاسم، الإيميل، أو الصلاحية...')}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  style={{
                    width: '100%',
                    padding: language === 'ar' ? '10px 42px 10px 14px' : '10px 14px 10px 42px',
                    border: '2.5px solid var(--line)',
                    borderRadius: 12,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    fontWeight: 800,
                    color: 'var(--ink)',
                    outline: 'none',
                    boxShadow: isSearchFocused ? '4px 4px 0 var(--line)' : '2px 2px 0 var(--line)',
                    background: 'var(--surface)',
                    transition: 'all 0.1s ease'
                  }}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', fontSize: 15, fontWeight: 800, color: 'var(--ink-soft)' }}>
                {tr('Loading user accounts...', 'جاري تحميل قائمة المستخدمين...')}
              </div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', border: '3.5px dashed var(--line)', borderRadius: 16, fontSize: 14, fontWeight: 800, color: 'var(--ink-soft)' }}>
                {tr('No accounts found.', 'لا توجد حسابات تطابق البحث.')}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14, textAlign: language === 'ar' ? 'right' : 'left', minWidth: 700 }}>
                  <thead>
                    <tr style={{ borderBottom: '2.5px solid var(--line)', color: 'var(--ink-soft)', fontWeight: 900 }}>
                      <th style={{ padding: '12px 8px' }}>{tr('User Profile', 'بيانات المستخدم')}</th>
                      <th style={{ padding: '12px 8px' }}>{tr('Age & Sessions', 'السن والجلسات')}</th>
                      <th style={{ padding: '12px 8px' }}>{tr('Role', 'الصلاحية')}</th>
                      <th style={{ padding: '12px 8px' }}>{tr('Assigned Doctor', 'الطبيب المعالج')}</th>
                      <th style={{ padding: '12px 8px', textAlign: 'center' }}>{tr('Actions', 'إجراءات')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map(u => (
                      <tr 
                        key={u.id}
                        style={{ 
                        borderBottom: '2px dashed var(--line)', 
                        fontWeight: 800, 
                        opacity: updatingId === u.id ? 0.5 : 1,
                        background: u.id === userId ? '#F6FFF8' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '14px 8px' }}>
                        <div 
                          onClick={() => setSelectedUserModal(u)}
                          className="tap"
                          style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                          title={tr('Click to view full patient dossier', 'اضغطي لعرض الملف الكامل للمريض')}
                        >
                          <div style={{
                            width: 36,
                            height: 36,
                            borderRadius: '50%',
                            border: '2.5px solid var(--line)',
                            background: u.role === 'admin' ? 'var(--peach)' : u.role === 'doctor' ? 'var(--mint)' : 'var(--surface)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {u.role === 'admin' ? <Shield size={16} /> : u.role === 'doctor' ? <Stethoscope size={16} /> : <User size={16} />}
                          </div>
                          <div>
                            <div style={{ color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 6, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                              {u.name}
                              {u.id === userId && (
                                <span style={{ fontSize: 9, background: 'var(--mint)', border: '2px solid var(--line)', padding: '1px 6px', borderRadius: 4, textTransform: 'uppercase', fontWeight: 900, textDecoration: 'none' }}>
                                  {tr('You (Admin)', 'أنتِ (الأدمن)')}
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 700 }}>{u.email}</div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '14px 8px' }}>
                        {u.role === 'patient' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: 13, color: 'var(--ink)' }}>
                              {u.age ? `${u.age} ${tr('yrs', 'سنة')}` : tr('Age unset', 'السن غير محدد')}
                            </span>
                            <span style={{ 
                              fontSize: 11, 
                              fontWeight: 900, 
                              color: 'var(--ink)', 
                              background: (u.sessionCount ?? 0) > 0 ? 'var(--mint)' : 'var(--cream)',
                              border: '1.5px solid var(--line)',
                              borderRadius: 6,
                              padding: '1px 6px',
                              display: 'inline-flex',
                              width: 'fit-content'
                            }}>
                              {u.sessionCount ?? 0} {tr('Sessions', 'جلسات')} {u.avgScore ? `(${u.avgScore}%)` : ''}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontStyle: 'italic' }}>—</span>
                        )}
                      </td>

                      <td style={{ padding: '14px 8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <select
                            value={u.role}
                            disabled={updatingId === u.id || u.id === userId}
                            onChange={(e) => handleChangeRole(u.id, e.target.value as any)}
                            style={{
                              padding: '6px 10px',
                              border: '2px solid var(--line)',
                              borderRadius: 'var(--r-sm)',
                              background: 'var(--surface)',
                              fontFamily: 'inherit',
                              fontWeight: 800,
                              fontSize: 12,
                              cursor: 'pointer',
                              outline: 'none'
                            }}
                          >
                            <option value="patient">{tr('Patient', 'مريض')}</option>
                            <option value="doctor">{tr('Doctor', 'طبيب')}</option>
                            <option value="admin">{tr('Admin', 'مسؤول (Admin)')}</option>
                          </select>
                          {u.role === 'doctor' && u.approved === false && (
                            <button
                              onClick={() => handleApproveDoctor(u.id)}
                              disabled={updatingId === u.id}
                              className="tap"
                              style={{
                                padding: '5px 8px',
                                border: '2px solid var(--line)',
                                borderRadius: 'var(--r-sm)',
                                background: 'var(--butter)',
                                fontWeight: 900,
                                fontSize: 11,
                                cursor: 'pointer'
                              }}
                            >
                              {tr('Approve', 'اعتماد')}
                            </button>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '14px 8px' }}>
                        {u.role === 'patient' ? (
                          <select
                            value={u.doctorId || ''}
                            disabled={updatingId === u.id}
                            onChange={(e) => handleAssignDoctor(u.id, e.target.value)}
                            style={{
                              padding: '6px 10px',
                              border: '2px solid var(--line)',
                              borderRadius: 'var(--r-sm)',
                              background: 'var(--surface)',
                              fontFamily: 'inherit',
                              fontWeight: 800,
                              fontSize: 12,
                              cursor: 'pointer',
                              outline: 'none',
                              maxWidth: 160
                            }}
                          >
                            <option value="">{tr('No Doctor Assigned', 'بدون طبيب محدد')}</option>
                            {users.filter(usr => usr.role === 'doctor' && usr.approved !== false).map(doc => (
                              <option key={doc.id} value={doc.id}>د. {doc.name}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontStyle: 'italic' }}>{tr('Staff', 'طاقم عمل')}</span>
                        )}
                      </td>

                      <td style={{ padding: '14px 8px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <button
                            type="button"
                            onClick={() => setSelectedUserModal(u)}
                            className="tap"
                            title={tr('View user dossier', 'عرض الملف الشخصي')}
                            style={{
                              border: '2px solid var(--line)',
                              background: 'var(--surface)',
                              color: 'var(--ink)',
                              padding: '8px 10px',
                              borderRadius: 10,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontWeight: 900,
                              fontSize: 12,
                              boxShadow: '2px 2px 0 var(--line)',
                            }}
                          >
                            <Search size={14} />
                            <span>{tr('Details', 'الملف')}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteUser(u.id, u.name)}
                            disabled={updatingId === u.id || u.id === userId}
                            title={tr('Permanently delete account', 'حذف الحساب نهائياً')}
                            style={{
                              border: '2px solid var(--line)',
                              background: u.id === userId ? '#F1F5F9' : '#FFEAE6',
                              color: u.id === userId ? 'var(--ink-soft)' : '#FF4D4D',
                              padding: '8px 10px',
                              borderRadius: 10,
                              cursor: u.id === userId ? 'not-allowed' : 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              fontWeight: 900,
                              fontSize: 12,
                              boxShadow: u.id === userId ? 'none' : '2px 2px 0 var(--line)',
                            }}
                            className={u.id === userId ? '' : 'tap'}
                          >
                            <Trash2 size={14} />
                            <span>{tr('Delete', 'مسح')}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: EXERCISE & REPETITIONS MANAGEMENT */}
        {activeTab === 'exercises' && (
          <div className="plush" style={{ background: 'var(--surface)', padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>
                  {tr('Exercise & Video Customization', 'إدارة وتعديل التمارين والفيديوهات')}
                </h3>
                <p style={{ fontSize: 14, color: 'var(--ink-soft)', marginTop: 4, fontWeight: 700 }}>
                  {tr('Customize exercise titles, repetitions per set, sets count, hold duration, and video links or add completely new exercises.', 'يمكنكِ تعديل اسم التمرين، روابط الفيديوهات (YouTube أو رابط مباشر)، عدد التكرارات والمجموعات، أو إضافة تمارين جديدة بالكامل للموقع.')}
                </p>
              </div>

              {!isCreatingNew ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(true);
                    setSelectedExercise({
                      id: '',
                      title: '',
                      description: '',
                      instructions: '',
                      videoUrl: '',
                      active: true,
                      planReps: null,
                      planSets: null,
                      planHoldSeconds: null,
                      planRestSeconds: null
                    });
                    setExerciseSaveMessage(null);
                  }}
                  className="tap btn-plush primary"
                  style={{
                    padding: '10px 18px',
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 900,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: 'pointer'
                  }}
                >
                  <Plus size={18} />
                  <span>{tr('Add New Exercise', 'إضافة تمرين جديد +')}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(false);
                    if (neckExercises.length > 0) {
                      setSelectedExercise({
                        ...neckExercises[0],
                        videoUrl: neckExercises[0].videoUrl || '',
                        planReps: neckExercises[0].planReps ?? null,
                        planSets: neckExercises[0].planSets ?? null,
                        planHoldSeconds: neckExercises[0].planHoldSeconds ?? null,
                        planRestSeconds: neckExercises[0].planRestSeconds ?? null
                      });
                    }
                    setExerciseSaveMessage(null);
                  }}
                  className="tap"
                  style={{
                    padding: '8px 16px',
                    borderRadius: 10,
                    fontSize: 13,
                    fontWeight: 800,
                    border: '2px solid var(--line)',
                    background: 'var(--surface)',
                    cursor: 'pointer'
                  }}
                >
                  {tr('Cancel / Edit Existing', 'إلغاء / العودة للتمارين الحالية')}
                </button>
              )}
            </div>

            {/* Exercise Selector or New ID Input */}
            {!isCreatingNew ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontWeight: 900, fontSize: 14, color: 'var(--ink)' }}>
                  {tr('Select Exercise to Edit:', 'اختاري التمرين المراد تعديله:')}
                </label>
                <select 
                  value={selectedExercise.id} 
                  onChange={(e) => {
                    const row = neckExercises.find(x => x.id === e.target.value);
                    if (row) {
                      setSelectedExercise({
                        ...row,
                        videoUrl: row.videoUrl || '',
                        planReps: row.planReps ?? null,
                        planSets: row.planSets ?? null,
                        planHoldSeconds: row.planHoldSeconds ?? null,
                        planRestSeconds: row.planRestSeconds ?? null
                      });
                      setExerciseSaveMessage(null);
                    }
                  }}
                  style={{
                    maxWidth: 420,
                    padding: '10px 14px',
                    border: '2.5px solid var(--line)',
                    borderRadius: 12,
                    fontSize: 15,
                    fontWeight: 900,
                    background: 'var(--surface)',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {neckExercises.map(x => (
                    <option key={x.id} value={x.id}>{x.title} ({x.id})</option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: '#F0FDF4', padding: '16px 20px', borderRadius: 12, border: '2px dashed #10B981' }}>
                <label style={{ fontWeight: 900, fontSize: 14, color: '#065F46' }}>
                  {tr('Exercise ID (English code, e.g. neck-extension-2):', 'معرّف التمرين (كود إنجليزي مميز، مثلاً: neck-extension-2):')}
                </label>
                <input
                  type="text"
                  placeholder="e.g. neck-extension-2"
                  value={selectedExercise.id || ''}
                  onChange={(e) => setSelectedExercise({ ...selectedExercise, id: e.target.value })}
                  style={{
                    padding: '10px 14px',
                    border: '2px solid var(--line)',
                    borderRadius: 10,
                    fontWeight: 800,
                    fontSize: 14,
                    background: 'var(--surface)',
                    maxWidth: 420
                  }}
                />
                <span style={{ fontSize: 12, color: '#047857' }}>
                  {tr('This code is used in camera sessions and system tracking.', 'هذا الكود يميّز التمرين داخل النظام ومكتبة الجلسات.')}
                </span>
              </div>
            )}

            {/* Form Fields */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>{tr('Exercise Name / Title', 'اسم التمرين الظاهر')}</label>
                <input
                  type="text"
                  value={selectedExercise.title || ''}
                  onChange={(e) => setSelectedExercise({ ...selectedExercise, title: e.target.value })}
                  style={{
                    padding: '10px 14px',
                    border: '2.5px solid var(--line)',
                    borderRadius: 10,
                    fontWeight: 800,
                    fontSize: 14,
                    background: 'var(--surface)'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>{tr('Video URL (YouTube or MP4)', 'رابط الفيديو (YouTube أو رابط مباشر)')}</label>
                <input
                  type="url"
                  placeholder="https://youtu.be/..."
                  value={selectedExercise.videoUrl || ''}
                  onChange={(e) => setSelectedExercise({ ...selectedExercise, videoUrl: e.target.value })}
                  style={{
                    padding: '10px 14px',
                    border: '2.5px solid var(--line)',
                    borderRadius: 10,
                    fontWeight: 800,
                    fontSize: 14,
                    background: 'var(--surface)'
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>{tr('Description', 'الوصف المختصر')}</label>
              <input
                type="text"
                value={selectedExercise.description || ''}
                onChange={(e) => setSelectedExercise({ ...selectedExercise, description: e.target.value })}
                style={{
                  padding: '10px 14px',
                  border: '2.5px solid var(--line)',
                  borderRadius: 10,
                  fontWeight: 800,
                  fontSize: 14,
                  background: 'var(--surface)'
                }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>{tr('Instructions for Patient', 'تعليمات وتوجيهات أداء التمرين')}</label>
              <textarea
                rows={2}
                value={selectedExercise.instructions || ''}
                onChange={(e) => setSelectedExercise({ ...selectedExercise, instructions: e.target.value })}
                style={{
                  padding: '10px 14px',
                  border: '2.5px solid var(--line)',
                  borderRadius: 10,
                  fontWeight: 800,
                  fontSize: 14,
                  background: 'var(--surface)',
                  fontFamily: 'inherit'
                }}
              />
            </div>

            {/* Repetitions and Sets Box */}
            <fieldset style={{ border: '2.5px solid var(--line)', borderRadius: 14, padding: '16px 20px', background: '#FAFCFE' }}>
              <legend style={{ fontWeight: 900, fontSize: 14, padding: '0 8px', color: 'var(--teal-deep)' }}>
                {tr('Dosage & Repetitions Settings (Leave empty = Free open session)', 'تحديد عدد التكرارات والمجموعات (فارغ = جلسة حرة بدون عدد إجباري)')}
              </legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14, marginTop: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 800 }}>{tr('Reps per set', 'التكرارات في المجموعة')}</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    placeholder="مثلاً: 10"
                    value={selectedExercise.planReps ?? ''}
                    onChange={(e) => setSelectedExercise({ ...selectedExercise, planReps: numOrNull(e.target.value) })}
                    style={{ padding: '8px 10px', border: '2px solid var(--line)', borderRadius: 8, fontWeight: 900, fontSize: 14 }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 800 }}>{tr('Sets count', 'عدد المجموعات')}</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    placeholder="مثلاً: 3"
                    value={selectedExercise.planSets ?? ''}
                    onChange={(e) => setSelectedExercise({ ...selectedExercise, planSets: numOrNull(e.target.value) })}
                    style={{ padding: '8px 10px', border: '2px solid var(--line)', borderRadius: 8, fontWeight: 900, fontSize: 14 }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 800 }}>{tr('Hold duration (s)', 'مدة الثبات (ثواني)')}</label>
                  <input
                    type="number"
                    min={0}
                    max={120}
                    placeholder="مثلاً: 5"
                    value={selectedExercise.planHoldSeconds ?? ''}
                    onChange={(e) => setSelectedExercise({ ...selectedExercise, planHoldSeconds: numOrNull(e.target.value) })}
                    style={{ padding: '8px 10px', border: '2px solid var(--line)', borderRadius: 8, fontWeight: 900, fontSize: 14 }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ fontSize: 12, fontWeight: 800 }}>{tr('Rest between sets (s)', 'مدة الراحة (ثواني)')}</label>
                  <input
                    type="number"
                    min={0}
                    max={300}
                    placeholder="مثلاً: 30"
                    value={selectedExercise.planRestSeconds ?? ''}
                    onChange={(e) => setSelectedExercise({ ...selectedExercise, planRestSeconds: numOrNull(e.target.value) })}
                    style={{ padding: '8px 10px', border: '2px solid var(--line)', borderRadius: 8, fontWeight: 900, fontSize: 14 }}
                  />
                </div>
              </div>
            </fieldset>

            {/* Active Checkbox */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="checkbox"
                id="activeExercise"
                checked={!!selectedExercise.active}
                onChange={(e) => setSelectedExercise({ ...selectedExercise, active: e.target.checked })}
                style={{ width: 18, height: 18, cursor: 'pointer' }}
              />
              <label htmlFor="activeExercise" style={{ fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
                {tr('Enable this exercise in the patient library', 'تفعيل وإتاحة هذا التمرين في مكتبة المريض وجلسات الكاميرا')}
              </label>
            </div>

            {/* Save Button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6 }}>
              <button
                type="button"
                disabled={isSavingExercise}
                onClick={handleSaveExercise}
                className="tap btn-plush primary"
                style={{
                  padding: '12px 28px',
                  borderRadius: 14,
                  fontSize: 15,
                  fontWeight: 900,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: isSavingExercise ? 'not-allowed' : 'pointer'
                }}
              >
                <Save size={18} />
                <span>
                  {isSavingExercise 
                    ? tr('Saving...', 'جاري الحفظ...') 
                    : isCreatingNew 
                    ? tr('Add Exercise to System', 'إضافة التمرين الجديد للنظام ➕') 
                    : tr('Save Exercise Changes', 'حفظ تعديلات التمرين والتكرارات 💾')}
                </span>
              </button>

              {exerciseSaveMessage && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: exerciseSaveMessage.ok ? '#10B981' : '#EF4444',
                  fontWeight: 800,
                  fontSize: 14
                }}>
                  {exerciseSaveMessage.ok ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                  <span>{exerciseSaveMessage.text}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* PATIENT DETAILS MODAL (Admin Dossier) */}
        {selectedUserModal && (
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20
            }}
            onClick={() => setSelectedUserModal(null)}
          >
            <div 
              style={{
                background: 'var(--surface)',
                border: '3px solid var(--line)',
                borderRadius: 'var(--r-md)',
                padding: '28px 30px',
                maxWidth: 480,
                width: '100%',
                boxShadow: 'var(--plush)',
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                textAlign: language === 'ar' ? 'right' : 'left'
              }}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '2.5px solid var(--line)', paddingBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 42,
                    height: 42,
                    borderRadius: '50%',
                    border: '2.5px solid var(--line)',
                    background: selectedUserModal.role === 'admin' ? 'var(--peach)' : selectedUserModal.role === 'doctor' ? 'var(--mint)' : 'var(--butter)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {selectedUserModal.role === 'admin' ? <Shield size={20} /> : selectedUserModal.role === 'doctor' ? <Stethoscope size={20} /> : <User size={20} />}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)', margin: 0 }}>{selectedUserModal.name}</h3>
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)', fontWeight: 700 }}>{selectedUserModal.email}</span>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedUserModal(null)}
                  className="tap"
                  style={{
                    background: 'var(--cream)',
                    border: '2px solid var(--line)',
                    borderRadius: '50%',
                    width: 32,
                    height: 32,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ background: 'var(--cream)', padding: '12px 14px', borderRadius: 10, border: '2px solid var(--line)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>{tr('Age', 'السن')}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', marginTop: 4 }}>
                    {selectedUserModal.age ? `${selectedUserModal.age} ${tr('Years', 'سنة')}` : tr('Not specified', 'غير محدد')}
                  </div>
                </div>

                <div style={{ background: 'var(--cream)', padding: '12px 14px', borderRadius: 10, border: '2px solid var(--line)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>{tr('Experience', 'المستوى')}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', marginTop: 4 }}>
                    {selectedUserModal.experience || tr('Beginner', 'مبتدئ')}
                  </div>
                </div>

                <div style={{ background: 'var(--cream)', padding: '12px 14px', borderRadius: 10, border: '2px solid var(--line)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>{tr('Completed Sessions', 'الجلسات المنفذة')}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Flame size={16} style={{ color: 'var(--peach-deep)' }} />
                    <span>{selectedUserModal.sessionCount ?? 0} {tr('Sessions', 'جلسات')}</span>
                  </div>
                </div>

                <div style={{ background: 'var(--cream)', padding: '12px 14px', borderRadius: 10, border: '2px solid var(--line)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase' }}>{tr('Avg. Score', 'متوسط التقييم')}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--ink)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Award size={16} style={{ color: 'var(--mint-deep)' }} />
                    <span>{selectedUserModal.avgScore ? `${selectedUserModal.avgScore}%` : '—'}</span>
                  </div>
                </div>
              </div>

              {selectedUserModal.goal && (
                <div style={{ background: 'var(--paper)', padding: '12px 14px', borderRadius: 10, border: '2px solid var(--line)' }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)', textTransform: 'uppercase', marginBottom: 4 }}>
                    {tr('Rehabilitation Goal', 'الهدف العلاجي والتأهيلي')}
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.5 }}>
                    {selectedUserModal.goal}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setSelectedUserModal(null)}
                  className="btn-plush primary tap"
                  style={{ padding: '8px 20px', fontSize: 13 }}
                >
                  {tr('Close', 'إغلاق')}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}