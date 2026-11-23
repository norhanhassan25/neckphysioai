import { run, one } from '../db/pool.js';
import crypto from 'crypto';
import { hashPassword } from './passwords.js';

export const DEMO_PATIENT_PASSWORD = 'Project@101112';

interface PatientSeedConfig {
  name: string;
  email: string;
  age: number;
  experience: string;
  goal: string;
  sessions: {
    daysAgo: number;
    score: number;
    poseId: string;
    poseName: string;
    duration: number;
    holdTime: number;
  }[];
}

const EXERCISES = [
  { id: 'deep-flexor-1', name: 'Deep Cervical Flexor Training' },
  { id: 'laser-proprioception', name: 'Cervical Proprioceptive Rehabilitation (Laser)' },
  { id: 'tracking-1', name: 'Cervical Tracking Training' },
  { id: 'cervical-isometric', name: 'Cervical Isometric Exercises' },
  { id: 'deep-flexor-2', name: 'Deep Cervical Flexor Progression' },
  { id: 'tracking-2', name: 'Cervical Tracking Advanced' },
];

function generateFrameLogs(baseScore: number, frameCount = 20) {
  const logs = [];
  const start = Date.now() - 60000;
  for (let i = 0; i < frameCount; i++) {
    // smooth curve around baseScore
    const variation = Math.round(Math.sin((i / frameCount) * Math.PI) * 8 + (Math.random() * 4 - 2));
    const score = Math.max(10, Math.min(100, baseScore + variation));
    logs.push({
      timestamp: start + i * 2000,
      score,
      angles: { yaw: 5, pitch: 8, roll: 2 },
      feedbackMessage: score >= 70 ? 'Good posture form' : 'Maintain head alignment'
    });
  }
  return logs;
}

function gradeForScore(score: number): string {
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

function createNineSessions(scores: number[], poseCycleOffset = 0) {
  return scores.map((score, index) => {
    const daysAgo = 9 - index; // from 9 days ago up to 1 day ago
    const ex = EXERCISES[(index + poseCycleOffset) % EXERCISES.length];
    return {
      daysAgo,
      score,
      poseId: ex.id,
      poseName: ex.name,
      duration: 60 + (index % 4) * 15,
      holdTime: 30 + (index % 3) * 10
    };
  });
}

export const DEMO_PATIENTS: PatientSeedConfig[] = [
  // 1. hassan mohamed: 9 sessions, 9 days, average 66% (Sum = 594)
  {
    name: 'hassan mohamed',
    email: 'hassan.mohamed@patient.example',
    age: 29,
    experience: 'Intermediate',
    goal: 'Relieve neck tension & improve posture',
    sessions: createNineSessions([63, 64, 65, 66, 66, 67, 67, 68, 68], 0)
  },
  // 2. sara ayman: 9 sessions, 9 days, average 78% (Sum = 702)
  {
    name: 'sara ayman',
    email: 'sara.ayman@patient.example',
    age: 24,
    experience: 'Beginner',
    goal: 'Reduce stiffness from desk work',
    sessions: createNineSessions([74, 75, 76, 77, 78, 79, 80, 81, 82], 1)
  },
  // 3. اسماء سلامه: 9 sessions, 9 days, average 71% (Sum = 639)
  {
    name: 'اسماء سلامه',
    email: 'asmaa.salama@patient.example',
    age: 31,
    experience: 'Beginner',
    goal: 'Strengthen cervical flexors',
    sessions: createNineSessions([68, 69, 70, 70, 71, 72, 72, 73, 74], 2)
  },
  // 4. اسيل محمد عزيز: 9 sessions, 9 days, average 79% (Sum = 711)
  {
    name: 'اسيل محمد عزيز',
    email: 'aseel.aziz@patient.example',
    age: 26,
    experience: 'Intermediate',
    goal: 'Improve neck mobility & proprioception',
    sessions: createNineSessions([75, 76, 77, 78, 79, 80, 81, 82, 83], 3)
  },
  // 5. ليلى ايمن: 9 sessions, 9 days, average 80% (Sum = 720)
  {
    name: 'ليلى ايمن',
    email: 'layla.ayman@patient.example',
    age: 27,
    experience: 'Advanced',
    goal: 'Rehab after neck spasm',
    sessions: createNineSessions([76, 77, 78, 79, 80, 81, 82, 83, 84], 4)
  },
  // 6. ياسمين جمال فتحي: 9 sessions, 9 days, average 74% (Sum = 666)
  {
    name: 'ياسمين جمال فتحي',
    email: 'yasmine.gamal@patient.example',
    age: 25,
    experience: 'Beginner',
    goal: 'Posture alignment & ergonomic comfort',
    sessions: createNineSessions([70, 71, 72, 73, 74, 75, 76, 77, 78], 5)
  },
  // 7. ahmed mohamed mahmoud: 9 sessions, 9 days, average 78% (Sum = 702)
  {
    name: 'ahmed mohamed mahmoud',
    email: 'ahmed.m.mahmoud@patient.example',
    age: 30,
    experience: 'Intermediate',
    goal: 'Neck stability during athletic training',
    sessions: createNineSessions([74, 75, 76, 77, 78, 79, 80, 81, 82], 0)
  },
  // 8. يقين محمد: 9 sessions, 9 days, average 64% (Sum = 576)
  {
    name: 'يقين محمد',
    email: 'yaqeen.mohamed@patient.example',
    age: 23,
    experience: 'Beginner',
    goal: 'Relieve upper neck tension',
    sessions: createNineSessions([60, 61, 62, 63, 64, 65, 66, 67, 68], 1)
  },
  // 9. ali mahmod: 9 sessions, 9 days, average 76% (Sum = 684)
  {
    name: 'ali mahmod',
    email: 'ali.mahmod@patient.example',
    age: 34,
    experience: 'Intermediate',
    goal: 'Rehab from chronic neck strain',
    sessions: createNineSessions([72, 73, 74, 75, 76, 77, 78, 79, 80], 2)
  },
  // 10. احمد حسين: 1 session, 1 day, average 55%
  {
    name: 'احمد حسين',
    email: 'ahmed.hussein@patient.example',
    age: 28,
    experience: 'Beginner',
    goal: 'Initial neck evaluation & testing',
    sessions: [
      {
        daysAgo: 1,
        score: 55,
        poseId: 'cervical-isometric',
        poseName: 'Cervical Isometric Exercises',
        duration: 50,
        holdTime: 20
      }
    ]
  },
  // 11. moataz ahmed: 9 sessions, 9 days, average 60% (Sum = 540)
  {
    name: 'moataz ahmed',
    email: 'moataz.ahmed@patient.example',
    age: 32,
    experience: 'Intermediate',
    goal: 'Range of motion restoration',
    sessions: createNineSessions([56, 57, 58, 59, 60, 61, 62, 63, 64], 3)
  }
];

export async function seedDemoPatients() {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Find a doctor account to link patients to, if any
  const doctor = await one<{ user_id: string }>("SELECT user_id FROM users WHERE role = 'doctor' LIMIT 1");
  const doctorId = doctor?.user_id ?? null;

  for (const p of DEMO_PATIENTS) {
    let user = await one<{ user_id: string }>("SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)", [p.email]);
    let userId = user?.user_id;

    const patientPassHash = hashPassword(DEMO_PATIENT_PASSWORD);
    if (!userId) {
      userId = `usr_demo_${crypto.randomBytes(6).toString('hex')}`;
      await run(
        `INSERT INTO users (user_id, name, email, password_hash, age, experience, goal, role, doctor_id, approved, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'patient', $8, TRUE, $9)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, p.name, p.email, patientPassHash, p.age, p.experience, p.goal, doctorId, new Date(now - 12 * ONE_DAY_MS)]
      );
    } else {
      await run(
        `UPDATE users SET name = $2, age = $3, experience = $4, goal = $5, doctor_id = COALESCE(doctor_id, $6), password_hash = $7
         WHERE user_id = $1`,
        [userId, p.name, p.age, p.experience, p.goal, doctorId, patientPassHash]
      );
    }

    // Check existing sessions count - only seed if the patient has 0 sessions, so any new session they perform persists and increments!
    const existingCount = await one<{ count: number }>("SELECT COUNT(*)::int AS count FROM sessions WHERE user_id = $1", [userId]);
    if ((existingCount?.count ?? 0) === 0) {
      // Insert initial NDI assessment
      const ndiAnswers = {
        ndi: [1, 2, 1, 2, 1, 1, 2, 1, 2, 1], // Mild neck disability
        goals: p.goal
      };
      await run(
        `INSERT INTO neck_assessments (user_id, answers, status, exercise_id, created_at)
         VALUES ($1, $2, 'eligible', 'deep-flexor-1', $3)`,
        [userId, JSON.stringify(ndiAnswers), new Date(now - 10 * ONE_DAY_MS)]
      );

      // Insert each session
      for (let i = 0; i < p.sessions.length; i++) {
        const s = p.sessions[i];
        const sessionDate = now - s.daysAgo * ONE_DAY_MS + (14 * 3600 * 1000 + i * 1800 * 1000); // midday
        const sessionId = `ses_${crypto.randomBytes(8).toString('hex')}`;
        const grade = gradeForScore(s.score);
        const frameLogs = generateFrameLogs(s.score);

        await run(
          `INSERT INTO sessions (id, user_id, pose_id, pose_name, date, duration_seconds, hold_time_seconds,
                                 average_score, grade, frame_logs, critique_status, ai_critique)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'ready', $11)`,
          [
            sessionId,
            userId,
            s.poseId,
            s.poseName,
            sessionDate,
            s.duration,
            s.holdTime,
            s.score,
            grade,
            JSON.stringify(frameLogs),
            `<p>Clinical assessment for <b>${s.poseName}</b>: Performed with good cervical form. Average score: <b>${s.score}%</b>. Repetition target achieved.</p>`
          ]
        );

        // Also add matching entry in neck_tracking_sessions for complete doctor review
        await run(
          `INSERT INTO neck_tracking_sessions (user_id, exercise_id, duration_seconds, left_turns, right_turns, tracking_quality, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            userId,
            s.poseId,
            s.duration,
            Math.round(s.score / 10),
            Math.round(s.score / 10),
            s.score >= 75 ? 'Optimal' : 'Satisfactory',
            new Date(sessionDate)
          ]
        );
      }
    }
  }

  console.log(`[demo] Seeded ${DEMO_PATIENTS.length} patients with verified session history & score averages.`);
}
