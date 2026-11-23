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
  // 1. Alzahraa salama: 9 sessions, 9 days, average 71% (Sum = 639)
  {
    name: 'Alzahraa salama',
    email: 'alzahraa@example.com',
    age: 31,
    experience: 'Beginner',
    goal: 'Strengthen cervical flexors',
    sessions: createNineSessions([67, 68, 69, 70, 71, 72, 73, 74, 75], 2)
  },
  // 2. اسيل محمد عزيز: 9 sessions, 9 days, average 77% (Sum = 693)
  {
    name: 'اسيل محمد عزيز',
    email: 'aseelmohammed@gmail.com',
    age: 26,
    experience: 'Intermediate',
    goal: 'Improve neck mobility & proprioception',
    sessions: createNineSessions([73, 74, 75, 76, 77, 78, 79, 80, 81], 3)
  },
  // 3. ahmed mohamed mahmoud: 9 sessions, 9 days, average 78% (Sum = 702)
  {
    name: 'ahmed mohamed mahmoud',
    email: 'ahmed.m.mahmoud@patient.example',
    age: 30,
    experience: 'Intermediate',
    goal: 'Neck stability during athletic training',
    sessions: createNineSessions([74, 75, 76, 77, 78, 79, 80, 81, 82], 0)
  },
  // 4. احمد حسين: 1 session, 1 day, average 55%
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
  }
];

export async function seedDemoPatients() {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();

  // Find a doctor account to link patients to, if any
  const doctor = await one<{ user_id: string }>("SELECT user_id FROM users WHERE role = 'doctor' LIMIT 1");
  const doctorId = doctor?.user_id ?? null;

  await run('CREATE TABLE IF NOT EXISTS deleted_users (email TEXT PRIMARY KEY, deleted_at TIMESTAMPTZ DEFAULT now())');

  // Clean up and blacklist all removed demo placeholder accounts from database
  await run(`
    INSERT INTO deleted_users (email) VALUES
      ('hassan.mohamed@patient.example'),
      ('sara.ayman@patient.example'),
      ('layla.ayman@patient.example'),
      ('yasmine.gamal@patient.example'),
      ('yaqeen.mohamed@patient.example'),
      ('ali.mahmod@patient.example'),
      ('moataz.ahmed@patient.example'),
      ('aseel.aziz@patient.example'),
      ('asmaa.salama@patient.example')
    ON CONFLICT (email) DO NOTHING
  `);

  await run(`
    DELETE FROM users WHERE role = 'patient' AND email IN (
      'hassan.mohamed@patient.example',
      'sara.ayman@patient.example',
      'layla.ayman@patient.example',
      'yasmine.gamal@patient.example',
      'yaqeen.mohamed@patient.example',
      'ali.mahmod@patient.example',
      'moataz.ahmed@patient.example',
      'aseel.aziz@patient.example',
      'asmaa.salama@patient.example'
    )
  `);

  for (const p of DEMO_PATIENTS) {
    const wasDeleted = await one('SELECT 1 FROM deleted_users WHERE LOWER(email) = LOWER($1)', [p.email]);
    if (wasDeleted) continue; // Permanently deleted by admin! Never resurrect!
    let user = await one<{ user_id: string }>("SELECT user_id FROM users WHERE LOWER(email) = LOWER($1)", [p.email]);
    let userId = user?.user_id;

    if (!userId) {
      userId = `usr_demo_${crypto.randomBytes(6).toString('hex')}`;
      const patientPassHash = hashPassword(DEMO_PATIENT_PASSWORD);
      await run(
        `INSERT INTO users (user_id, name, email, password_hash, age, experience, goal, role, doctor_id, approved, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'patient', $8, TRUE, $9)
         ON CONFLICT (user_id) DO NOTHING`,
        [userId, p.name, p.email, patientPassHash, p.age, p.experience, p.goal, doctorId, new Date(now - 12 * ONE_DAY_MS)]
      );
    } else {
      // User registered themselves! Never touch their password or personal profile data!
      await run(
        `UPDATE users SET doctor_id = COALESCE(doctor_id, $2) WHERE user_id = $1`,
        [userId, doctorId]
      );
    }

    // Check existing sessions count & average - reseed if 0 sessions or target average needs update
    const existingCount = await one<{ count: number }>("SELECT COUNT(*)::int AS count FROM sessions WHERE user_id = $1", [userId]);
    const existingAvg = await one<{ avg: number }>("SELECT ROUND(AVG(average_score))::int AS avg FROM sessions WHERE user_id = $1", [userId]);
    const targetAvg = Math.round(p.sessions.reduce((a, b) => a + b.score, 0) / p.sessions.length);
    if ((existingCount?.count ?? 0) === 0 || (existingCount?.count === p.sessions.length && existingAvg?.avg !== targetAvg)) {
      await run("DELETE FROM sessions WHERE user_id = $1", [userId]);
      await run("DELETE FROM neck_tracking_sessions WHERE user_id = $1", [userId]);
      await run("DELETE FROM neck_assessments WHERE user_id = $1", [userId]);
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
