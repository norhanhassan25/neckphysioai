export type Point = { x: number; y: number; visibility?: number };
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const ema = (previous: number | null, current: number, alpha = 0.24) =>
  previous === null ? current : alpha * current + (1 - alpha) * previous;
export const angle3 = (a: Point, b: Point, c: Point) => {
  const ux = a.x - b.x,
    uy = a.y - b.y,
    vx = c.x - b.x,
    vy = c.y - b.y;
  const den = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  return den < 1e-8 ? NaN : (Math.acos(clamp((ux * vx + uy * vy) / den, -1, 1)) * 180) / Math.PI;
};
export const signedAngle = (a: Point, b: Point) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
export const isVisible = (p: Point | undefined, min = 0.5) =>
  !!p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility === undefined || p.visibility >= min);
/** Camera-relative head orientation, not cervical spine joint angles. */
export function faceYawPitch(matrix: number[]): { yaw: number; pitch: number; roll: number } | null {
  if (matrix.length < 16 || !matrix.every(Number.isFinite)) return null;
  const yaw = (Math.atan2(matrix[8], matrix[10]) * 180) / Math.PI;
  const pitch = (Math.atan2(-matrix[9], Math.hypot(matrix[8], matrix[10])) * 180) / Math.PI;
  const roll = (Math.atan2(matrix[1], matrix[0]) * 180) / Math.PI;
  return { yaw, pitch, roll };
}
export const virtualPoint = (yawDelta: number, pitchDelta: number, range = 15) => ({
  x: clamp(yawDelta / range, -1, 1),
  y: clamp(-pitchDelta / range, -1, 1),
});
export const targetAt = (seconds: number, mode: 'laser' | 'tracking', stage: number) => {
  if (mode === 'laser') return { x: 0, y: 0 };
  const speed = stage > 1 ? 0.075 : 0.055,
    t = 2 * Math.PI * speed * seconds;
  return stage > 1 ? { x: 0.65 * Math.sin(t), y: 0.4 * Math.sin(2 * t) } : { x: 0.62 * Math.sin(t), y: 0.35 * Math.sin(1.2 * t) };
};
export function sideMetrics(landmarks: Point[]): { nod: number; cva: number; lift: number; trunk: number } | null {
  const left = landmarks[7],
    right = landmarks[8];
  const side =
    isVisible(left) && isVisible(landmarks[11]) && isVisible(landmarks[23])
      ? 0
      : isVisible(right) && isVisible(landmarks[12]) && isVisible(landmarks[24])
        ? 1
        : -1;
  if (side < 0 || !isVisible(landmarks[0])) return null;
  const ear = landmarks[side ? 8 : 7],
    shoulder = landmarks[side ? 12 : 11],
    hip = landmarks[side ? 24 : 23],
    nose = landmarks[0];
  const trunkLength = dist(shoulder, hip);
  if (trunkLength < 0.04) return null;
  return {
    nod: signedAngle(ear, nose),
    cva: (Math.atan2(shoulder.y - ear.y, Math.abs(ear.x - shoulder.x)) * 180) / Math.PI,
    lift: (shoulder.y - ear.y) / trunkLength,
    trunk: (Math.atan2(shoulder.x - hip.x, hip.y - shoulder.y) * 180) / Math.PI,
  };
}

/* ===== Measurement layer (camera proxies; NOT clinically validated cervical angles) ===== */
export type Measurement = {
  yaw: number;
  pitch: number;
  roll: number;
  nod?: number;
  cva?: number;
  lift?: number;
  fwd?: number;
  trunk?: number;
  torsoV?: number;
  hx?: number;
  hy?: number;
  neckH?: number;
  lwx?: number;
  lwy?: number;
  rwx?: number;
  rwy?: number;
};
export type Size = { w: number; h: number };
export type PoseMeasure = Omit<Measurement, 'yaw' | 'pitch' | 'roll'> & { conf: number };
const D = 180 / Math.PI;
const vis = (p?: Point) => (p ? (p.visibility ?? 1) : 0);
const px = (p: Point, s: Size): Point => ({ x: p.x * s.w, y: p.y * s.h, visibility: p.visibility });
export const median = (a: number[]) => {
  if (!a.length) return NaN;
  const b = [...a].sort((x, y) => x - y),
    m = b.length >> 1;
  return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2;
};
export const stdDev = (a: number[]) => {
  if (a.length < 2) return 0;
  const m = a.reduce((x, y) => x + y, 0) / a.length;
  return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length);
};
/**
 * Pose-derived measurements. Landmarks are converted to PIXEL coordinates first, so angles are not
 * distorted by the video aspect ratio. In side view the facing direction is detected and the signs
 * are normalised, so a chin nod is positive whichever way the user faces. Distances are divided by a
 * body reference (shoulder width in front view, torso length in side view).
 */
export function poseMeasurements(pose: Point[], size: Size, view: 'front' | 'side'): PoseMeasure | null {
  if (view === 'side') {
    // Ear + shoulder + nose are enough. The hip is OPTIONAL: a laptop webcam normally shows only head and shoulders,
    // and requiring the hip made side-view tracking (chin nod) silently fail.
    const E = [7, 11],
      R = [8, 12],
      score = (ids: number[]) => Math.min(...ids.map((i) => vis(pose[i])));
    const sl = score(E),
      sr = score(R),
      left = sl >= sr,
      ids = left ? E : R,
      hipId = left ? 23 : 24,
      conf = Math.min(left ? sl : sr, vis(pose[0]));
    if (conf < 0.5) return null;
    const ear = px(pose[ids[0]], size),
      sh = px(pose[ids[1]], size),
      nose = px(pose[0], size);
    const hasHip = vis(pose[hipId]) >= 0.5,
      hip = hasHip ? px(pose[hipId], size) : null;
    const hipTorso = hip ? dist(sh, hip) : 0;
    const useHip = !!hip && hipTorso >= 12;
    // without a hip, a fixed fraction of the frame height stands in for the torso length (constant during a session; the baseline cancels it)
    const torso = useHip ? hipTorso : size.h * 0.45;
    if (torso < 12) return null;
    const dir = nose.x >= ear.x ? 1 : -1;
    return {
      conf,
      nod: Math.atan2(nose.y - ear.y, Math.abs(nose.x - ear.x)) * D, // chin-down positive
      cva: Math.atan2(sh.y - ear.y, dir * (ear.x - sh.x)) * D, // estimated CVA from shoulder landmark (not C7)
      lift: (sh.y - ear.y) / torso,
      fwd: (dir * (ear.x - sh.x)) / torso,
      ...(useHip && hip
        ? { trunk: Math.atan2(dir * (sh.x - hip.x), hip.y - sh.y) * D, torsoV: (hip.y - sh.y) / torso }
        : { torsoV: (size.h - sh.y) / torso }),
      hx: (dir * (nose.x - sh.x)) / torso,
      hy: (nose.y - sh.y) / torso,
    };
  }
  const conf = Math.min(vis(pose[0]), vis(pose[11]), vis(pose[12]));
  if (conf < 0.5) return null;
  const ls = px(pose[11], size),
    rs = px(pose[12], size),
    nose = px(pose[0], size),
    sw = dist(ls, rs);
  if (sw < 20) return null;
  const ears = vis(pose[7]) >= 0.5 && vis(pose[8]) >= 0.5,
    e1 = px(pose[7], size),
    e2 = px(pose[8], size);
  const head = ears ? { x: (e1.x + e2.x) / 2, y: (e1.y + e2.y) / 2 } : nose,
    mid = { x: (ls.x + rs.x) / 2, y: (ls.y + rs.y) / 2 };
  const wr = (i: number) =>
      vis(pose[i]) >= 0.5 ? { x: (px(pose[i], size).x - nose.x) / sw, y: (px(pose[i], size).y - nose.y) / sw } : null,
    lw = wr(15),
    rw = wr(16);
  return {
    conf,
    hx: (head.x - mid.x) / sw,
    hy: (head.y - mid.y) / sw,
    neckH: (mid.y - head.y) / sw,
    trunk: Math.atan2(rs.y - ls.y, rs.x - ls.x) * D,
    ...(lw ? { lwx: lw.x, lwy: lw.y } : {}),
    ...(rw ? { rwx: rw.x, rwy: rw.y } : {}),
  };
}
/**
 * The preview is MIRRORED (like a mirror), so the raw-image yaw from estimateHeadAngles is flipped to screen direction:
 * turning your head to YOUR right (it also moves right on the mirrored preview) gives positive yaw → the laser/tracking dot moves right.
 * Pitch: head up = positive = dot moves up. Used by the virtual laser and the tracking exercises.
 */
export const toScreenAngles = (a: { yaw: number; pitch: number; roll: number }) => ({
  yaw: -a.yaw,
  pitch: a.pitch,
  roll: a.roll,
});
const ANGLE_KEYS: (keyof Measurement)[] = ['yaw', 'pitch', 'roll', 'nod', 'cva', 'trunk'];
const RATIO_KEYS: (keyof Measurement)[] = ['lift', 'fwd', 'torsoV', 'hx', 'hy', 'neckH'];
/** Robust neutral baseline from ~3 s of samples (median). Unstable if the user moved while calibrating. */
export function summarizeCalibration(samples: Measurement[], tolerance = 1): { baseline: Measurement; stable: boolean; worst: string | null } {
  const col = (k: keyof Measurement) =>
    samples.map((m) => m[k]).filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  const med = (k: keyof Measurement) => {
    const c = col(k);
    return c.length ? median(c) : undefined;
  };
  let worst: string | null = null,
    worstRatio = 1;
  for (const k of [...ANGLE_KEYS, ...RATIO_KEYS]) {
    const c = col(k);
    if (c.length < 5) continue;
    const r = stdDev(c) / ((ANGLE_KEYS.includes(k) ? 3 : 0.03) * tolerance);
    if (r > worstRatio) {
      worstRatio = r;
      worst = k;
    }
  }
  return {
    baseline: {
      yaw: med('yaw') ?? 0,
      pitch: med('pitch') ?? 0,
      roll: med('roll') ?? 0,
      nod: med('nod'),
      cva: med('cva'),
      lift: med('lift'),
      fwd: med('fwd'),
      trunk: med('trunk'),
      torsoV: med('torsoV'),
      hx: med('hx'),
      hy: med('hy'),
      neckH: med('neckH'),
    },
    stable: worst === null,
    worst,
  };
}
/** Rough head angles from face-mesh landmarks. Fallback only when the transformation matrix is missing. */
export function estimateHeadAngles(face: Point[]): { yaw: number; pitch: number; roll: number } | null {
  const n = face[1],
    a = face[33],
    b = face[263],
    chin = face[152],
    top = face[10];
  if (!n || !a || !b || !chin || !top) return null;
  const eye = dist(a, b),
    faceH = dist(top, chin);
  if (eye < 1e-4 || faceH < 1e-4) return null;
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  // Nose-tip offset from the eye line grows ~linearly with head rotation (nose protrudes ≈0.3 eye-widths / ≈0.17 face-heights).
  // Constant offsets cancel in the baseline. yaw>0: nose moves to the right of the RAW camera image; pitch>0: head tilts up.
  return {
    roll: Math.atan2(b.y - a.y, b.x - a.x) * D,
    yaw: clamp(((n.x - mid.x) / (0.3 * eye)) * D, -70, 70),
    pitch: clamp((-((n.y - mid.y) / faceH) / 0.17) * D, -70, 70),
  };
}
