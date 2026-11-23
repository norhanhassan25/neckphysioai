import { ExerciseConfig } from './config';

/** Dosage chosen by the treating doctor (doctor portal). All four values together, or all null = free session. */
export type DoctorPlanRow = { planReps?: number | null; planSets?: number | null; planHoldSeconds?: number | null; planRestSeconds?: number | null };

export function withDoctorPlan(config: ExerciseConfig, row: DoctorPlanRow | undefined | null): ExerciseConfig {
  if (!row) return config; // not loaded: keep the built-in defaults
  const { planReps: r, planSets: s, planHoldSeconds: h, planRestSeconds: rest } = row;
  if (r == null && s == null && h == null && rest == null) {
    if (row.planReps === undefined) return config; // fields absent (older server)
    const { plan: _removed, ...free } = config; // the doctor cleared the plan on purpose
    return free;
  }
  if (r == null || s == null || h == null || rest == null) return config; // incomplete plan is ignored
  return { ...config, holdSeconds: h, targets: { ...config.targets, holdSeconds: h }, plan: { repsPerSet: r, sets: s, restSeconds: rest } };
}
