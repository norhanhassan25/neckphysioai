/**
 * EXPERIMENTAL configuration values. They come from the project specification and require clinical
 * review and camera validation. They are not validated therapeutic thresholds or prescriptions.
 */
export type ExerciseMode = 'deepFlexor' | 'isometric' | 'laser' | 'neutral' | 'tracking';
export type View = 'front' | 'side';
export type MoveId = 'forward' | 'back' | 'right' | 'left';
export type Targets = {
  holdSeconds: number;
  maxTrunkDeg: number; // trunk compensation
  maxShrugPct: number; // shoulder shrug, % of reference body dimension
  // deep cervical flexor
  nod?: [number, number]; // chin-nod range in degrees (chin-down positive)
  lift?: [number, number]; // intended head lift, % of torso length (stage 4)
  maxLiftPct?: number; // unwanted head lift, % of torso length
  maxFwdPct?: number; // unwanted forward head translation, % of torso length
  // isometric
  moves?: MoveId[]; // isometric directions performed one after another
  maxDriftPct?: number; // head drift, % of shoulder width
  maxRollDeg?: number;
  maxOrientDeg?: number;
  // neutral head
  referenceCva?: number;
  cvaTolDeg?: number;
  maxPitchErrDeg?: number;
  maxPostureDriftDeg?: number;
  // laser
  jpeMaxDeg?: number;
  dwellSeconds?: number;
  targetAmplitudeDeg?: number;
  targetRadiusDeg?: number;
  // tracking
  rangeDeg?: number;
  minTimeOnTargetPct?: number;
  trialSeconds?: number;
  maxLagMs?: number;
};
/** Session plan: the session ends by itself only for exercises that define one (deep-flexor-1 and deep-flexor-2). */
export type SessionPlan = { repsPerSet: number; sets: number; restSeconds: number };
export type ExerciseConfig = {
  id: string;
  mode: ExerciseMode;
  view: View;
  stage: number;
  holdSeconds: number;
  targetRadius: number;
  targets: Targets;
  descriptionEn: string;
  descriptionAr: string;
  plan?: SessionPlan;
};

const common = { maxTrunkDeg: 14, maxShrugPct: 9 };
export const DCF_STAGES: Record<number, Targets> = {
  1: { ...common, nod: [3, 16], holdSeconds: 1, maxLiftPct: 6, maxFwdPct: 8 }, // relaxed nod range & higher tolerance
  2: { ...common, nod: [5, 18], holdSeconds: 5, maxLiftPct: 6, maxFwdPct: 8 }, // hold reduced from 8 to 5s for smoother demo
  3: { ...common, nod: [6, 20], holdSeconds: 6, maxLiftPct: 6, maxFwdPct: 8 },
  4: { ...common, nod: [6, 20], lift: [2, 8], holdSeconds: 4, maxFwdPct: 8 },
  5: { ...common, nod: [5, 18], holdSeconds: 5, maxLiftPct: 6, maxFwdPct: 8 },
};
export const ISOMETRIC_STAGES: Record<number, Targets> = {
  1: { ...common, holdSeconds: 3, moves: ['forward', 'back', 'right', 'left'], maxDriftPct: 8, maxRollDeg: 8, maxOrientDeg: 8 },
  2: { ...common, holdSeconds: 4, moves: ['forward', 'back', 'right', 'left'], maxDriftPct: 8, maxRollDeg: 8, maxOrientDeg: 8 },
  3: { ...common, holdSeconds: 5, moves: ['forward', 'back', 'right', 'left'], maxDriftPct: 8, maxRollDeg: 8, maxOrientDeg: 8 },
};
export const LASER_STAGES: Record<number, Targets> = {
  1: { ...common, holdSeconds: 1, dwellSeconds: 1.2, jpeMaxDeg: 8.5, targetAmplitudeDeg: 10, targetRadiusDeg: 5.5 },
  2: { ...common, holdSeconds: 1, dwellSeconds: 1.2, jpeMaxDeg: 7.5, targetAmplitudeDeg: 12, targetRadiusDeg: 5.0 },
};
export const NEUTRAL_STAGES: Record<number, Targets> = {
  1: { ...common, holdSeconds: 6, referenceCva: 50, cvaTolDeg: 14, maxPitchErrDeg: 10, maxPostureDriftDeg: 7, maxFwdPct: 11 },
  2: { ...common, holdSeconds: 8, referenceCva: 50, cvaTolDeg: 14, maxPitchErrDeg: 10, maxPostureDriftDeg: 7, maxFwdPct: 11 },
  3: { ...common, holdSeconds: 6, referenceCva: 50, cvaTolDeg: 16, maxPitchErrDeg: 12, maxPostureDriftDeg: 8, maxFwdPct: 12 },
};
export const TRACKING_STAGES: Record<number, Targets> = {
  1: { ...common, holdSeconds: 0, rangeDeg: 22, minTimeOnTargetPct: 28, trialSeconds: 18, maxLagMs: 750 },
  2: { ...common, holdSeconds: 0, rangeDeg: 22, minTimeOnTargetPct: 28, trialSeconds: 18, maxLagMs: 750 },
  3: { ...common, holdSeconds: 0, rangeDeg: 22, minTimeOnTargetPct: 28, trialSeconds: 18, maxLagMs: 750 },
};
const make = (
  id: string,
  mode: ExerciseMode,
  view: View,
  stage: number,
  targets: Targets,
  targetRadius: number,
  descriptionEn: string,
  descriptionAr: string,
  plan?: SessionPlan,
): ExerciseConfig => ({
  id,
  mode,
  view,
  stage,
  holdSeconds: targets.holdSeconds,
  targetRadius,
  targets,
  descriptionEn,
  descriptionAr,
  ...(plan ? { plan } : {}),
});
export const TRACKER_CONFIGS: Record<string, ExerciseConfig> = {
  'deep-flexor-1': make(
    'deep-flexor-1',
    'deepFlexor',
    'side',
    1,
    DCF_STAGES[1],
    0.3,
    'Chin nod from the side as shown in the video: 15 repetitions. A repetition counts when your movement matches the target range set for this exercise.',
    'إيماءة الذقن من الجانب زي الفيديو: ١٥ تكرار. التكرار بيتحسب لما حركتك تطابق نطاق الحركة المطلوب للتمرين.',
    { repsPerSet: 15, sets: 1, restSeconds: 0 },
  ),
  'deep-flexor-2': make(
    'deep-flexor-2',
    'deepFlexor',
    'side',
    2,
    DCF_STAGES[2],
    0.25,
    'Chin tuck: 10 repetitions, hold 8 seconds in each repetition, 3 sets (short rest between sets).',
    'Chin tuck: ١٠ تكرارات، ثبات ٨ ثواني في كل تكرار، ٣ مجموعات (راحة قصيرة بين المجموعات).',
    { repsPerSet: 10, sets: 3, restSeconds: 30 },
  ),
  'cervical-isometric': make(
    'cervical-isometric',
    'isometric',
    'front',
    1,
    ISOMETRIC_STAGES[1],
    0.18,
    'Check head stability during the exercise, not resistance force.',
    'مراقبة ثبات الرأس أثناء التمرين، وليس قوة المقاومة.',
  ),
  'laser-proprioception': make(
    'laser-proprioception',
    'laser',
    'front',
    1,
    LASER_STAGES[1],
    0.23,
    'Virtual laser controlled by HEAD direction (not eye gaze); no physical laser is tracked. Turn right → the dot moves right; look down → it moves down.',
    'ليزر افتراضي بيتحرك باتجاه الرأس (مش نظرة العين)؛ لا يتم تتبع ليزر حقيقي. لفّي يمين ← النقطة تروح يمين؛ ميّلي رأسك لتحت ← النقطة تنزل لتحت.',
  ),
  'tracking-1': make(
    'tracking-1',
    'tracking',
    'front',
    1,
    TRACKING_STAGES[1],
    0.35,
    'Follow the moving target using gentle HEAD movement (eye gaze is not tracked). Wider tolerance for natural movement variation.',
    'اتبعي الهدف المتحرك بحركة رأس هادئة (نظرة العين مش بتتتبع). هامش أوسع لتنوع الحركة الطبيعية.',
  ),
  'tracking-2': make(
    'tracking-2',
    'neutral',
    'front',
    3,
    NEUTRAL_STAGES[3],
    0.30,
    'Hold your head in a neutral position as shown in the video. Camera checks posture stability with wider tolerance.',
    'ثبّتي رأسك في وضع محايد زي ما في الفيديو. الكاميرا بتتابع ثبات الوضعية بهامش أوسع.',
  ),
};
