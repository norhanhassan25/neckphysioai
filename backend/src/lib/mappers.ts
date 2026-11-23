import type { SessionRow, UserRow } from './types.js';

// the api speaks camelCase, the database snake_case. password hashes never leave here
export function toUser(row: UserRow & { session_count?: number; avg_score?: number | null }) {
  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    age: row.age,
    experience: row.experience,
    goal: row.goal,
    role: row.role,
    doctorId: row.doctor_id,
    carePlan: row.care_plan ?? [],
    approved: row.approved,
    sessionCount: row.session_count ?? 0,
    avgScore: row.avg_score ?? null,
  };
}

export function toSession(row: SessionRow) {
  return {
    id: row.id,
    userId: row.user_id,
    poseId: row.pose_id,
    poseName: row.pose_name,
    date: row.date,
    durationSeconds: row.duration_seconds,
    holdTimeSeconds: row.hold_time_seconds,
    averageScore: row.average_score,
    grade: row.grade,
    aiCritique: row.ai_critique,
    critiqueStatus: row.critique_status,
    frameLogs: row.frame_logs ?? [],
  };
}
