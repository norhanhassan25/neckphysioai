import { ExerciseConfig } from './config';
import { ExerciseAnalyzer, Measurement, Observation } from './engine';

/**
 * A recording of a real session: the calibrated baseline and the per-frame (already smoothed) measurements.
 * The tracker can download one ("Download tracking data"); drop it into src/neckAI/fixtures/ and `npm test` replays it
 * through the engine, so real-camera behaviour can be regression-tested without a webcam.
 */
export type Recording = {
  exerciseId: string;
  baseline: Measurement;
  frames: { t: number; m: Measurement | null; conf: number; jitter?: number }[];
  /** optional expectations written by whoever annotated the recording */
  expect?: { reps?: number; minReps?: number; done?: boolean };
};

export function replay(config: ExerciseConfig, rec: Recording): { analyzer: ExerciseAnalyzer; last: Observation | null } {
  const a = new ExerciseAnalyzer(config);
  a.calibrate(rec.baseline);
  let last: Observation | null = null;
  for (const f of rec.frames) last = a.analyze(f.m, f.t, { ok: f.conf >= 0.5, confidence: f.conf, jitter: f.jitter });
  return { analyzer: a, last };
}
