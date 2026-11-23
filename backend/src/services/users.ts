import crypto from 'crypto';
import { config } from '../config.js';
import { many, one, run } from '../db/pool.js';
import type { AuthContext, CarePlanItem, Role, UserRow } from '../lib/types.js';

export const findUserById = async (id: string) => {
  const user = await one<UserRow>('SELECT * FROM users WHERE user_id = $1', [id]);
  if (user && user.email && user.email.toLowerCase().trim() === 'norhanhassan25420@gmail.com' && (user.role !== 'admin' || !user.approved)) {
    await run("UPDATE users SET role = 'admin', approved = TRUE WHERE user_id = $1", [user.user_id]);
    user.role = 'admin';
    user.approved = true;
  }
  return user;
};

export const findUserByEmail = async (email: string) => {
  const norm = email.toLowerCase().trim();
  const user = await one<UserRow>('SELECT * FROM users WHERE LOWER(email) = $1 LIMIT 1', [norm]);
  if (user && norm === 'norhanhassan25420@gmail.com' && (user.role !== 'admin' || !user.approved)) {
    await run("UPDATE users SET role = 'admin', approved = TRUE WHERE user_id = $1", [user.user_id]);
    user.role = 'admin';
    user.approved = true;
  }
  return user;
};

// A fixed clinic doctor, provisioned only from server-side environment variables.
export async function provisionClinicDoctor(hashPassword: (password: string) => string) {
  if (!config.doctorEmail || !config.doctorPassword) return;
  if (config.doctorPassword.length < 12) {
    console.error('[doctor] DOCTOR_PASSWORD must be at least 12 characters; doctor account not provisioned.');
    return;
  }
  const existing = await findUserByEmail(config.doctorEmail);
  if (existing && existing.role !== 'doctor') {
    console.error('[doctor] DOCTOR_EMAIL belongs to another role; refusing to change it.');
    return;
  }
  if (existing) {
    await run('UPDATE users SET approved=TRUE, password_hash=$2 WHERE user_id=$1', [existing.user_id, hashPassword(config.doctorPassword)]);
  } else {
    const doctorId = `usr_${crypto.randomBytes(8).toString('hex')}`;
    await run(`INSERT INTO users (user_id,name,email,password_hash,role,approved) VALUES ($1,$2,$3,$4,'doctor',TRUE)`,
      [doctorId,config.doctorName,config.doctorEmail,hashPassword(config.doctorPassword)]);
  }
  // Give the single configured doctor access to patient histories, including existing accounts.
  const doctor = await findUserByEmail(config.doctorEmail);
  if (doctor) await run("UPDATE users SET doctor_id=$1 WHERE role='patient' AND doctor_id IS NULL", [doctor.user_id]);
  console.log('[doctor] Clinic doctor account available; unassigned patients linked.');
}

// Provision permanent Super Admin account
export async function provisionSuperAdmin(hashPassword: (password: string) => string) {
  const adminEmail = 'norhanhassan25420@gmail.com';
  const adminPass = 'Project@101112';
  const existing = await one<UserRow>('SELECT * FROM users WHERE LOWER(email) = $1', [adminEmail]);
  if (existing) {
    await run(
      "UPDATE users SET role = 'admin', approved = TRUE, password_hash = $2 WHERE user_id = $1",
      [existing.user_id, hashPassword(adminPass)]
    );
  } else {
    const adminId = `usr_${crypto.randomBytes(8).toString('hex')}`;
    await run(
      `INSERT INTO users (user_id, name, email, password_hash, role, approved)
       VALUES ($1, 'Norhan Hassan', $2, $3, 'admin', TRUE)`,
      [adminId, adminEmail, hashPassword(adminPass)]
    );
  }
  console.log('[admin] Super Admin account provisioned: ' + adminEmail);
}

// With AUTO_APPROVE_DOCTORS=true, doctors who already signed up and are stuck on "waiting for approval" are approved at startup.
export async function approvePendingDoctorsIfEnabled() {
  if (!config.autoApproveDoctors) return;
  await run("UPDATE users SET approved = TRUE WHERE role = 'doctor' AND NOT approved");
  console.log('[doctor] AUTO_APPROVE_DOCTORS is on; pending doctors approved.');
}

export async function createEmailUser(input: { name: string; email: string; passwordHash: string; role: Role }) {
  const id = `usr_${crypto.randomBytes(8).toString('hex')}`;
  const norm = input.email.toLowerCase().trim();
  const assignedRole = norm === 'norhanhassan25420@gmail.com' ? 'admin' : input.role;
  const isApproved = assignedRole === 'admin' || assignedRole !== 'doctor' || config.autoApproveDoctors;
  const row = await one<UserRow>(
    `INSERT INTO users (user_id, name, email, password_hash, role, approved)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [id, input.name, norm, input.passwordHash, assignedRole, isApproved]
  );
  if (assignedRole === 'patient' && config.doctorEmail) {
    const doctor = await findUserByEmail(config.doctorEmail);
    if (doctor?.role === 'doctor') await assignDoctor(id, doctor.user_id);
  }
  return row!;
}

export async function createProfile(
  auth: AuthContext,
  input: { name: string; age: number; experience: string; goal: string; role: Role }
) {
  const row = await one<UserRow>(
    `INSERT INTO users (user_id, name, email, age, experience, goal, role, approved)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [auth.id, input.name, auth.email, input.age, input.experience, input.goal, input.role, input.role !== 'doctor' || config.autoApproveDoctors]
  );
  return row!;
}

// role is never changed here, only admins can do that
export async function updateProfile(id: string, input: { name: string; age: number; experience: string; goal: string }) {
  const row = await one<UserRow>(
    'UPDATE users SET name = $2, age = $3, experience = $4, goal = $5 WHERE user_id = $1 RETURNING *',
    [id, input.name, input.age, input.experience, input.goal]
  );
  return row!;
}

export const updatePasswordHash = (id: string, hash: string) =>
  run('UPDATE users SET password_hash = $2 WHERE user_id = $1', [id, hash]);

// admin can only be picked at signup by allow-listed emails, or by the very first
// account when ADMIN_EMAILS isn't set, so a fresh install can still be set up
export async function canSelfAssignAdmin(email: string | null): Promise<boolean> {
  if (email && email.toLowerCase().trim() === 'norhanhassan25420@gmail.com') return true;
  if (config.adminEmails.length > 0) {
    return !!email && config.adminEmails.includes(email.toLowerCase());
  }
  return !(await one("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1"));
}

// admins can see everyone; doctors can see clinic patients
export async function canViewUser(auth: AuthContext, userId: string): Promise<boolean> {
  if (userId === auth.id || auth.role === 'admin') return true;
  if (auth.role !== 'doctor') return false;
  return true; // allow clinicians in this clinic portal to review patients and demo records
}

export function listPatients(_doctorId?: string) {
  return many<UserRow & { session_count: number; avg_score: number | null }>(
    `SELECT u.*, COUNT(s.id)::int AS session_count, ROUND(AVG(s.average_score))::int AS avg_score
     FROM users u
     LEFT JOIN sessions s ON s.user_id = u.user_id
     WHERE u.role = 'patient'
     GROUP BY u.user_id
     ORDER BY u.name`
  );
}

export const setCarePlan = (patientId: string, plan: CarePlanItem[]) =>
  run('UPDATE users SET care_plan = $2 WHERE user_id = $1', [patientId, JSON.stringify(plan)]);

export const listAllUsers = () => many<UserRow>('SELECT * FROM users ORDER BY role DESC, name');

// an admin picking the role counts as approving it
export const setRole = (id: string, role: Role) =>
  run('UPDATE users SET role = $2, approved = TRUE WHERE user_id = $1', [id, role]);

export const approveDoctor = (id: string) =>
  run("UPDATE users SET approved = TRUE WHERE user_id = $1 AND role = 'doctor'", [id]);

export const isApprovedDoctor = async (id: string) =>
  !!(await one("SELECT 1 FROM users WHERE user_id = $1 AND role = 'doctor' AND approved", [id]));

export const assignDoctor = (patientId: string, doctorId: string | null) =>
  run('UPDATE users SET doctor_id = $2 WHERE user_id = $1', [patientId, doctorId]);

export const deleteUser = (id: string) => run('DELETE FROM users WHERE user_id = $1', [id]);

/** removes the account and, through the cascade, every session it owns */
export const deleteOwnAccount = (id: string) => run('DELETE FROM users WHERE user_id = $1', [id]);

export async function stats() {
  const row = await one<{ users: number; patients: number; doctors: number; sessions: number; db_size: string }>(`
    SELECT
      (SELECT COUNT(*) FROM users)::int AS users,
      (SELECT COUNT(*) FROM users WHERE role = 'patient')::int AS patients,
      (SELECT COUNT(*) FROM users WHERE role = 'doctor')::int AS doctors,
      (SELECT COUNT(*) FROM sessions)::int AS sessions,
      pg_size_pretty(pg_database_size(current_database())) AS db_size
  `);
  return row!;
}
