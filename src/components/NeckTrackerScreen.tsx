import { useMemo, useEffect, useRef, useState } from 'react';
import { FaceLandmarker, PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { apiFetch } from '../utils/api';
import { resolveModel, resolveWasmBase } from '../neckAI/mediapipeAssets';
import { painFlag, safetyMessage, useSafetyGate, PAIN_BLOCK } from '../utils/safetyGate';
import { withDoctorPlan, DoctorPlanRow } from '../neckAI/planOverride';
import { genderize, useGender } from '../utils/gender';
import { Cheer, Progress, cheerFor, HOLD_HALF, REST_OVER } from '../neckAI/encouragement';
import { GenderToggle } from './GenderToggle';
import { store } from '../game/store';
import { useLanguage } from '../i18n/LanguageContext';
import { TopBar } from './primitives';
import { NECK_EXERCISES } from '../data/neckExercises';
import { TRACKER_CONFIGS } from '../neckAI/config';
import { ExerciseAnalyzer, Measurement, Observation, Quality, planPassed, planTotal } from '../neckAI/engine';
import {
  ema,
  faceYawPitch,
  estimateHeadAngles,
  toScreenAngles,
  poseMeasurements,
  summarizeCalibration,
  stdDev,
  isVisible,
  Point,
} from '../neckAI/geometry';

type TrackingStatus = 'off' | 'loading' | 'calibration' | 'tracking' | 'stopped';
const info: { [k: string]: [string, string] } = {
  nodTooSmall: ['Nod your chin gently.', 'حركي الذقن للداخل برفق.'],
  nodTooLarge: ['Reduce the chin nod.', 'قللي حركة الذقن.'],
  headLift: ['Avoid lifting or translating your head.', 'تجنبي رفع الرأس أو إزاحته.'],
  trunkLean: ['Keep your shoulders and trunk still.', 'ثبتي الكتفين والجذع.'],
  rotation: ['Keep your head facing forward.', 'خلي الرأس ثابتة من غير دوران.'],
  pitch: ['Return your head toward neutral.', 'ارجعي بالرأس للوضع المحايد.'],
  roll: ['Keep your head level.', 'خلي الرأس مستقيمة من غير ميل جانبي.'],
  hold: ['Maintain the position gently.', 'ثبتي الوضع بهدوء.'],
  release: ['Hold complete! Release before the next repetition.', 'الثبات اكتمل! ارجعي للوضع الأول قبل التكرار التالي.'],
  center: ['Face the camera before calibration.', 'واجهي الكاميرا قبل المعايرة.'],
  nod: ['Small chin nod observed. Avoid lifting or forcing.', 'تم رصد إيماءة ذقن صغيرة؛ تجنبي رفع الرأس أو الضغط.'],
  stable: ['Head direction relatively stable. Muscle force is not measured.', 'اتجاه الرأس ثابت نسبيًا؛ قوة العضلات غير مقاسة.'],
  drift: ['Head position moved away from calibration reference.', 'الرأس ابتعد عن الوضع المرجعي للمعايرة.'],
  moving: ['Movement observed.', 'تم رصد حركة.'],
  target: ['Virtual target reached.', 'وصلتي للهدف الافتراضي.'],
  offTarget: ['Move gently toward the on-screen target.', 'حركي الرأس بهدوء نحو الهدف على الشاشة.'],
  noSide: ['For this exercise, show the side of your head and shoulder.', 'للتمرين ده، أظهري جانب الرأس والكتف في الكاميرا.'],
  lost: ['Tracking interrupted. Reposition your face and shoulders.', 'التتبع انقطع؛ عدّلي وضع الرأس والكتفين.'],
  shrug: ['Relax your shoulders; do not raise them.', 'أرخي كتفيك ولا ترفعيهم.'],
  translation: ['Keep your head over your shoulders.', 'خلي رأسك فوق كتفيك.'],
  cva: ['Bring your head toward the reference posture.', 'رجعي رأسك ناحية الوضع المرجعي.'],
  jpe: ['Return to the starting position.', 'ارجعي لوضع البداية.'],
  unavailable: ['Tracking paused: landmarks missing or low confidence.', 'التتبع متوقف: النقاط غير ظاهرة أو الثقة منخفضة.'],
  completed: ['Repetition completed.', 'اكتمل التكرار.'],
  calUnstable: ['You moved during calibration. Hold still and calibrate again.', 'اتحركتي أثناء المعايرة. ثبتي وأعيدي المعايرة.'],
  done: ['Session stopped and camera closed.', 'انتهت الجلسة وتم إغلاق الكاميرا.'],
};
/** Live chin-nod trace: the blue line is the measured nod (°) over the last seconds, the green band is the target range from the video. */
function NodTrace({ trace, lo, hi, tr }: { trace: number[]; lo: number; hi: number; tr: (en: string, ar: string) => string }) {
  const W = 300,
    H = 120,
    N = 70,
    yMin = -4,
    yMax = Math.max(20, hi + 8);
  const y = (v: number) => H - ((Math.min(yMax, Math.max(yMin, v)) - yMin) / (yMax - yMin)) * H;
  const pts = trace.slice(-N),
    step = W / (N - 1);
  const path = pts.map((v, i) => `${(W - (pts.length - 1 - i) * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const cur = pts.length ? pts[pts.length - 1] : null,
    inBand = cur !== null && cur >= lo && cur <= hi;
  return (
    <div style={{ padding: 14, borderRadius: 14, border: '1px solid #dce5e4', background: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <b>{tr('Live movement tracking (chin nod)', 'تتبع الحركة المباشر (إيماءة الذقن)')}</b>
        <b style={{ fontSize: 20, color: inBand ? '#107f55' : '#a36a1a' }}>{cur === null ? '—' : cur.toFixed(1)}°</b>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', marginTop: 8, borderRadius: 10, background: '#f7f9fc' }}
        role="img"
        aria-label={tr('Chin nod over time', 'إيماءة الذقن عبر الزمن')}
      >
        <rect x="0" y={y(hi)} width={W} height={Math.max(1, y(lo) - y(hi))} fill="rgba(47,166,106,.25)" />
        <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="#cfd8dc" strokeDasharray="4 3" />
        {pts.length > 1 && <polyline points={path} fill="none" stroke="#2479d7" strokeWidth="2.5" strokeLinejoin="round" />}
        {cur !== null && <circle cx={W - 4} cy={y(cur)} r="6" fill={inBand ? '#2fa66a' : '#d8942b'} />}
      </svg>
      <small style={{ opacity: 0.8 }}>
        {tr(
          `Green band = target ${lo}–${hi}° (from the video). Blue dot inside the band = correct.`,
          `المنطقة الخضرا = النطاق المطلوب ${lo}–${hi}° (من الفيديو). النقطة الزرقا جوه المنطقة = صح.`,
        )}
      </small>
    </div>
  );
}
export function NeckTrackerScreen() {
  const { language } = useLanguage();
  const [gender, setGender] = useGender();
  // shadows the module-level helper so every Arabic string follows the patient's grammatical gender
  const selectText = (en: string, ar: string, lang: string) => (lang === 'ar' ? genderize(ar, gender) : en);
  const tr = (en: string, ar: string) => selectText(en, ar, language);
  const selected = store.getState().selectedNeckExerciseId;
  const exercise = NECK_EXERCISES.find((x) => x.id === selected);
  const [doctorRow, setDoctorRow] = useState<DoctorPlanRow | undefined>(undefined);
  // dosage (reps / sets / hold / rest) is set by the treating doctor; built-in values are only the default
  const config = useMemo(
    () => (selected && TRACKER_CONFIGS[selected] ? withDoctorPlan(TRACKER_CONFIGS[selected], doctorRow) : null),
    [selected, doctorRow],
  );
  const video = useRef<HTMLVideoElement>(null),
    overlay = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null),
    faceDetector = useRef<FaceLandmarker | null>(null),
    poseDetector = useRef<PoseLandmarker | null>(null);
  const frameId = useRef(0),
    active = useRef(false),
    lastFrame = useRef(0),
    lastUi = useRef(0),
    started = useRef(0),
    sampleCount = useRef(0),
    goodFrames = useRef(0);
  const filtered = useRef<Measurement | null>(null),
    calibrateStart = useRef<number | null>(null),
    calibrationSamples = useRef<Measurement[]>([]);
  const analyzer = useRef<ExerciseAnalyzer | null>(null),
    lastObservation = useRef<Observation | null>(null),
    calibratedRef = useRef(false),
    stableFrames = useRef(0),
    residuals = useRef<number[]>([]),
    rawNod = useRef<number | null>(null);
  const [status, setStatus] = useState<TrackingStatus>('off'),
    [message, setMessage] = useState(''),
    [error, setError] = useState('');
  const [observation, setObservation] = useState<Observation | null>(null),
    [calibrated, setCalibrated] = useState(false),
    [sessionSaved, setSessionSaved] = useState(false);
  const [effort, setEffort] = useState(3);
  const gate = useSafetyGate();
  // ---- encouragement toast (rep milestones, set finished, half of the hold, rest over) ----
  const [cheer, setCheer] = useState<Cheer | null>(null);
  const prevProgress = useRef<Progress | null>(null),
    holdCheered = useRef(false),
    prevRest = useRef(0),
    cheerTimer = useRef(0);
  const showCheer = (c: Cheer) => {
    setCheer(c);
    window.clearTimeout(cheerTimer.current);
    cheerTimer.current = window.setTimeout(() => setCheer(null), 4500);
  };
  useEffect(() => () => window.clearTimeout(cheerTimer.current), []);
  const safetyBlocked = gate.state !== 'ok';
  const [painBefore, setPainBefore] = useState<number | null>(null),
    [painAfter, setPainAfter] = useState<number | null>(null);
  const [pending, setPending] = useState<null | {
    exerciseId: string;
    durationSeconds: number;
    trackingQuality: 'good' | 'limited' | 'lost';
    notes: string[];
    extra: Record<string, unknown>;
    safety: boolean;
  }>(null);
  const recording = useRef<{ t: number; m: Measurement | null; conf: number; jitter?: number }[]>([]),
    baselineRef = useRef<Measurement | null>(null);
  const autoDone = useRef(false),
    nodTrace = useRef<number[]>([]);
  const [showPoints, setShowPoints] = useState(true),
    [report, setReport] = useState<Observation | null>(null),
    [calibrating, setCalibrating] = useState(false),
    [calProgress, setCalProgress] = useState(0),
    [loopDone, setLoopDone] = useState(false),
    [fixedCva, setFixedCva] = useState(false),
    [diag, setDiag] = useState('');
  useEffect(() => {
    let alive = true;
    apiFetch('/api/neck/exercises')
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: (DoctorPlanRow & { id: string })[]) => {
        if (alive) setDoctorRow(rows.find((x) => x.id === selected));
      })
      .catch(() => {});
    return () => {
      alive = false;
      stopCamera();
    };
  }, [selected]);
  // only exercise 1 (15 reps) and exercise 2 (3 sets x 10 reps) end the session by themselves; every other exercise runs until the patient finishes
  useEffect(() => {
    if (status === 'tracking' && observation?.done && !autoDone.current) {
      autoDone.current = true;
      void finish();
    }
  }, [observation, status]);
  function stopCamera() {
    active.current = false;
    cancelAnimationFrame(frameId.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    faceDetector.current?.close();
    poseDetector.current?.close();
    faceDetector.current = null;
    poseDetector.current = null;
    if (video.current) video.current.srcObject = null;
  }
  function sample(now: number) {
    frameId.current = requestAnimationFrame(sample);
    if (!active.current || now - lastFrame.current < 90) return;
    lastFrame.current = now;
    const v = video.current,
      f = faceDetector.current,
      p = poseDetector.current;
    if (!v || !f || !p || v.readyState < 2) return;
    try {
      const fr = f.detectForVideo(v, now),
        pr = p.detectForVideo(v, now);
      const pts = pr.landmarks?.[0] as Point[] | undefined;
      const facePts = fr.faceLandmarks?.[0] as Point[] | undefined;
      const matrix = fr.facialTransformationMatrixes?.[0]?.data;
      const size = { w: v.videoWidth || 640, h: v.videoHeight || 480 };
      let ang = matrix ? faceYawPitch(Array.from(matrix)) : null;
      if (!ang && facePts) ang = estimateHeadAngles(facePts); // fallback when the transformation matrix is missing
      // Virtual laser / tracking: drive the dot from the face landmarks so the dot moves the same way as the head on the mirrored preview
      const est = facePts ? estimateHeadAngles(facePts) : null;
      if ((config?.mode === 'laser' || config?.mode === 'tracking') && est) ang = toScreenAngles(est);
      const view = config?.view ?? 'front';
      const body = pts ? poseMeasurements(pts, size, view) : null;
      if (view === 'side' && body) ang = { yaw: 0, pitch: 0, roll: 0 }; // side exercises are measured from the pose only: a profile face matrix is noise and made calibration fail
      if (showPoints) drawCanvas(facePts ?? null, pts ?? null);
      else overlay.current?.getContext('2d')?.clearRect(0, 0, overlay.current.width, overlay.current.height);
      sampleCount.current++;
      if (now - lastUi.current > 400)
        setDiag(
          `Face ${facePts ? '✓' : '✗'} · Matrix ${matrix ? '✓' : '✗'} · Pose ${pts ? '✓' : '✗'} · Body ${body ? '✓ ' + Math.round(body.conf * 100) + '%' : '✗'}`,
        );
      if (!ang || !body) {
        // landmarks missing: analysis is paused, nothing is counted
        if (calibratedRef.current) {
          const o = analyzer.current?.analyze(null, now, { ok: false, confidence: 0 });
          if (o) {
            lastObservation.current = o;
            if (now - lastUi.current > 220) {
              setObservation({ ...o });
              setMessage('unavailable');
              lastUi.current = now;
            }
          }
        } else if (now - lastUi.current > 700) {
          setMessage('lost');
          lastUi.current = now;
        }
        stableFrames.current = 0;
        return;
      }
      goodFrames.current++;
      const { conf, ...rest } = body;
      const raw: Measurement = { ...ang, ...rest };
      const f0 = filtered.current;
      const sm = (k: keyof Measurement) =>
        raw[k] === undefined ? undefined : ema((f0?.[k] as number | undefined) ?? null, raw[k] as number);
      filtered.current = f0
        ? {
            yaw: ema(f0.yaw, raw.yaw),
            pitch: ema(f0.pitch, raw.pitch),
            roll: ema(f0.roll, raw.roll),
            nod: sm('nod'),
            cva: sm('cva'),
            lift: sm('lift'),
            fwd: sm('fwd'),
            trunk: sm('trunk'),
            torsoV: sm('torsoV'),
            hx: sm('hx'),
            hy: sm('hy'),
            neckH: sm('neckH'),
            lwx: raw.lwx,
            lwy: raw.lwy,
            rwx: raw.rwx,
            rwy: raw.rwy,
          }
        : raw;
      // jitter = spread of (raw − smoothed) nod; used to decide whether an exact-degree correction is justified
      if (raw.nod !== undefined && filtered.current.nod !== undefined) {
        residuals.current.push(raw.nod - filtered.current.nod);
        if (residuals.current.length > 15) residuals.current.shift();
      }
      const quality: Quality = {
        ok: conf >= 0.5,
        confidence: conf,
        jitter: residuals.current.length >= 8 ? stdDev(residuals.current) * 2 : undefined,
      };
      // Automatic, forgiving set-up: no button and no strict stillness. It starts by itself once the body is detected,
      // needs ~1.5 s, tolerates small movement, and after at most 5 s accepts the best (median) position instead of failing.
      if (!calibratedRef.current && calibrateStart.current === null) {
        stableFrames.current++;
        if (stableFrames.current >= 6) {
          stableFrames.current = 0;
          calibrateStart.current = now;
          calibrationSamples.current = [];
          setCalibrating(true);
        }
      }
      if (calibrateStart.current !== null) {
        calibrationSamples.current.push(filtered.current);
        if (calibrationSamples.current.length > 24) calibrationSamples.current.shift();
        const elapsedCal = now - calibrateStart.current;
        if (now - lastUi.current > 200) setCalProgress(Math.min(1, elapsedCal / 1500));
        if (elapsedCal >= 1500 && calibrationSamples.current.length >= 6) {
          const { baseline, stable } = summarizeCalibration(calibrationSamples.current, 2.5);
          if (stable || elapsedCal >= 5000) {
            calibrateStart.current = null;
            setCalibrating(false);
            setCalProgress(1);
            if (analyzer.current) analyzer.current.useFixedCva = fixedCva;
            analyzer.current?.calibrate(baseline);
            baselineRef.current = { ...baseline };
            calibratedRef.current = true;
            setCalibrated(true);
            setStatus('tracking');
          }
        }
        return;
      }
      if (analyzer.current) analyzer.current.useFixedCva = fixedCva;
      const result = analyzer.current?.analyze(filtered.current, now, quality);
      if (calibratedRef.current && recording.current.length < 12000)
        recording.current.push({
          t: Math.round(now),
          m: filtered.current ? { ...filtered.current } : null,
          conf: quality.confidence,
          jitter: quality.jitter,
        });
      if (result) {
        lastObservation.current = result;
        if (now - lastUi.current > 220) {
          if (config?.mode === 'deepFlexor' && result.primary?.value != null) {
            nodTrace.current.push(result.primary.value);
            if (nodTrace.current.length > 120) nodTrace.current.shift();
          }
          setObservation({ ...result });
          setMessage(result.message);
          lastUi.current = now;
        }
      }
    } catch (e) {
      console.error('[neck tracker]', e);
      if (now - lastUi.current > 800) {
        setMessage('lost');
        lastUi.current = now;
      }
    }
  }
  function drawCanvas(face: Point[] | null, pose: Point[] | null) {
    const c = overlay.current,
      v = video.current;
    if (!c || !v) return;
    c.width = v.videoWidth || 640;
    c.height = v.videoHeight || 480;
    const g = c.getContext('2d');
    if (!g) return;
    g.clearRect(0, 0, c.width, c.height);
    g.strokeStyle =
      lastObservation.current?.status === 'adjust'
        ? '#ff6f77'
        : lastObservation.current?.status === 'correct'
          ? '#47e3a5'
          : '#76f0d1';
    g.lineWidth = 3;
    const lines = [
      [0, 1],
      [1, 2],
      [2, 3],
      [7, 11],
      [8, 12],
      [11, 12],
      [11, 23],
      [12, 24],
    ];
    if (pose) {
      for (const [i, j] of lines) {
        const a = pose[i],
          b = pose[j];
        if (!isVisible(a) || !isVisible(b)) continue;
        g.beginPath();
        g.moveTo(a.x * c.width, a.y * c.height);
        g.lineTo(b.x * c.width, b.y * c.height);
        g.stroke();
      }
    }
    if (pose && config?.view === 'side') {
      const ids = (pose[7]?.visibility ?? 0) >= (pose[8]?.visibility ?? 0) ? [7, 11] : [8, 12],
        ear = pose[ids[0]],
        sh = pose[ids[1]],
        nose = pose[0];
      if (isVisible(ear) && isVisible(nose)) {
        g.lineWidth = 5;
        g.strokeStyle = '#ffd24a';
        g.beginPath();
        g.moveTo(ear.x * c.width, ear.y * c.height);
        g.lineTo(nose.x * c.width, nose.y * c.height);
        g.stroke();
        if (isVisible(sh)) {
          g.lineWidth = 3;
          g.strokeStyle = '#76f0d1';
          g.beginPath();
          g.moveTo(ear.x * c.width, ear.y * c.height);
          g.lineTo(sh.x * c.width, sh.y * c.height);
          g.stroke();
        }
        g.fillStyle = '#ff6f77';
        for (const q of [ear, nose, ...(isVisible(sh) ? [sh] : [])]) {
          g.beginPath();
          g.arc(q.x * c.width, q.y * c.height, 6, 0, 2 * Math.PI);
          g.fill();
        }
      }
    }
    g.fillStyle = '#fce4a6';
    if (face)
      for (const i of [1, 33, 263, 61, 291]) {
        const a = face[i];
        if (!a) continue;
        g.beginPath();
        g.arc(a.x * c.width, a.y * c.height, 4, 0, 2 * Math.PI);
        g.fill();
      }
  }
  async function begin() {
    if (!config || safetyBlocked) {
      setError(safetyMessage(gate.state, tr) ?? '');
      return;
    }
    if (painBefore === null) {
      setError(tr('Please rate your pain right now (0–10) before starting.', 'من فضلك قيّمي الألم الحالي (٠–١٠) قبل البدء.'));
      return;
    }
    if (painBefore >= PAIN_BLOCK) {
      gate.block();
      setError(
        tr(
          'Pain is too high to exercise safely today. Please contact your physiotherapist.',
          'الألم عالي لدرجة إن التمرين مش آمن النهارده. تواصلي مع أخصائي العلاج الطبيعي.',
        ),
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Webcam requires a supported browser and localhost/HTTPS.');
      return;
    }
    setError('');
    setReport(null);
    setSessionSaved(false);
    setPending(null);
    prevProgress.current = null;
    prevRest.current = 0;
    holdCheered.current = false;
    setCheer(null);
    setPainAfter(null);
    recording.current = [];
    baselineRef.current = null;
    setStatus('loading');
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      stream.current = media;
      if (!video.current) throw Error('No video element');
      video.current.srcObject = media;
      await video.current.play();
      const wasm = await resolveWasmBase(),
        [faceAsset, poseAsset] = await Promise.all([resolveModel('face_landmarker'), resolveModel('pose_landmarker_lite')]);
      setDiag(
        `MediaPipe: runtime ${wasm.local ? 'local' : 'CDN'} · models ${faceAsset.local && poseAsset.local ? 'local' : 'CDN'}`,
      );
      const vision = await FilesetResolver.forVisionTasks(wasm.url);
      const load = async <T,>(create: (delegate: 'GPU' | 'CPU') => Promise<T>) => {
        try {
          return await create('GPU');
        } catch {
          return await create('CPU');
        }
      };
      faceDetector.current = await load((delegate) =>
        FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: faceAsset.url, delegate },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFacialTransformationMatrixes: true,
        }),
      );
      poseDetector.current = await load((delegate) =>
        PoseLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: poseAsset.url, delegate },
          runningMode: 'VIDEO',
          numPoses: 1,
        }),
      );
      nodTrace.current = [];
      analyzer.current = new ExerciseAnalyzer(config);
      lastObservation.current = null;
      filtered.current = null;
      autoDone.current = false;
      setLoopDone(false);
      calibrateStart.current = null;
      calibratedRef.current = false;
      stableFrames.current = 0;
      residuals.current = [];
      rawNod.current = null;
      setCalibrating(false);
      calibrationSamples.current = [];
      sampleCount.current = 0;
      goodFrames.current = 0;
      lastFrame.current = 0;
      lastUi.current = 0;
      setCalibrated(false);
      setObservation(null);
      setMessage('center');
      started.current = Date.now();
      active.current = true;
      setStatus('calibration');
      frameId.current = requestAnimationFrame(sample);
    } catch (e) {
      stopCamera();
      setStatus('off');
      setError(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? 'Camera permission denied.'
          : 'Camera or MediaPipe model failed to initialize. Check browser console and connection.',
      );
    }
  }
  function startCalibration() {
    if (!active.current || !filtered.current) {
      setMessage('lost');
      return;
    }
    if (config?.view === 'side' && filtered.current.cva === undefined) {
      setMessage('noSide');
      return;
    }
    calibrateStart.current = performance.now();
    calibrationSamples.current = [];
    calibratedRef.current = false;
    setCalibrating(true);
    setStatus('calibration');
    setCalibrated(false);
  }
  async function finish(safety = false) {
    // The session is NOT saved here: the patient first rates pain after exercise, then presses Save (saveSession).
    const duration = Math.max(0, Math.round((Date.now() - started.current) / 1000)),
      a = analyzer.current,
      last = lastObservation.current;
    if (!safety && (a?.done || planPassed(config?.plan, a?.reps ?? 0))) setLoopDone(true);
    setReport(last);
    stopCamera();
    setStatus('stopped');
    setMessage('done');
    if (safety) gate.block(); // red-flag symptoms: camera exercise stays locked until a clinician reviews
    if (!selected) {
      setError('No video selected.');
      return;
    }
    const quality: 'good' | 'limited' | 'lost' =
      sampleCount.current === 0 ? 'lost' : goodFrames.current / sampleCount.current > 0.75 ? 'good' : 'limited';
    const plan = config?.plan,
      round1 = (n: number) => Math.round(n * 10) / 10;
    const notes = [
      `Exercise ID: ${selected}`,
      `Mode: ${config?.mode ?? 'unknown'}`,
      `Stage: ${config?.stage ?? 0}`,
      `Observed samples: ${a?.observations ?? 0}`,
      `On-target frames: ${a?.hits ?? 0}`,
      `Repetitions counted: ${a?.reps ?? 0}${plan ? ` / ${plan.repsPerSet * plan.sets} (${plan.sets} set(s) x ${plan.repsPerSet} reps, completed sets: ${a?.setIdx ?? 0})` : ' (free session, no fixed target)'}`,
      `Session plan: ${plan ? (a?.done ? 'completed' : 'ended before completion') : 'none'}`,
      `Time in target: ${Math.round(a?.validSeconds ?? 0)}s`,
      `Time outside target: ${Math.round(a?.invalidSeconds ?? 0)}s`,
      ...(last?.metrics ?? []).map((m) => `${m.label}: ${m.value.toFixed(1)}${m.unit} (demo target: ${m.target})`),
      `Pain before: ${painBefore ?? 'n/a'}/10`,
      mode === 'isometric' ? `Self-reported effort: ${effort}/10` : '',
      safety ? 'Stopped because patient reported symptoms' : 'No clinical correctness or muscle force measured',
    ]
      .filter(Boolean)
      .slice(0, 36);
    const metrics: Record<string, number> = {};
    for (const m of (last?.metrics ?? []) as { key?: string; label: string; value: number }[])
      if (Number.isFinite(m.value)) metrics[(m.key ?? m.label).slice(0, 60)] = Math.round(m.value * 100) / 100;
    const extra: Record<string, unknown> = {
      repsCompleted: a?.reps ?? 0,
      timeInTargetSeconds: Math.min(7200, Math.round(a?.validSeconds ?? 0)),
      stoppedForSymptoms: safety,
      metrics,
      ...(last?.accuracy != null && Number.isFinite(last.accuracy)
        ? { matchPercent: Math.min(100, Math.max(0, round1(last.accuracy))) }
        : {}),
      ...(plan
        ? {
            repsTarget: plan.repsPerSet * plan.sets,
            setsCompleted: Math.min(a?.setIdx ?? 0, plan.sets),
            setsTarget: plan.sets,
            holdSeconds: config?.holdSeconds,
            planCompleted: !!a?.done || planPassed(config?.plan, a?.reps ?? 0),
          }
        : {}),
      ...(mode === 'isometric' ? { selfEffort: effort } : {}),
    };
    setPending({ exerciseId: selected, durationSeconds: duration, trackingQuality: quality, notes, extra, safety });
  }
  async function saveSession() {
    if (!pending) return;
    const flagged = painFlag(painBefore, painAfter);
    const notes = [
      ...pending.notes,
      `Pain after: ${painAfter ?? 'not reported'}/10`,
      ...(flagged ? ['PAIN FLAG: pain rose by 3+ points or is severe after exercise'] : []),
    ].slice(0, 40);
    try {
      const r = await apiFetch('/api/neck/sessions', {
        method: 'POST',
        body: JSON.stringify({
          exerciseId: pending.exerciseId,
          durationSeconds: pending.durationSeconds,
          leftTurns: 0,
          rightTurns: 0,
          trackingQuality: pending.trackingQuality,
          notes,
          ...pending.extra,
          ...(painBefore !== null ? { painBefore } : {}),
          ...(painAfter !== null ? { painAfter } : {}),
        }),
      });
      if (!r.ok) throw Error('Cannot save session');
      setSessionSaved(true);
      setPending(null);
      setError('');
      if (flagged) gate.block(); // pain rose: no further camera sessions until reviewed
    } catch {
      setError(
        tr(
          'Could not save the session. Check your connection and press Save again.',
          'تعذّر حفظ الجلسة. تأكدي من الاتصال واضغطي حفظ مرة تانية.',
        ),
      );
    }
  }
  /** Numeric measurements only (no images/video): can be dropped into src/neckAI/fixtures to replay a real session in tests. */
  function downloadRecording() {
    if (!selected || !baselineRef.current) return;
    const blob = new Blob([JSON.stringify({ exerciseId: selected, baseline: baselineRef.current, frames: recording.current })], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob),
      el = document.createElement('a');
    el.href = url;
    el.download = `${selected}-${new Date().toISOString().slice(0, 19)}.json`;
    el.click();
    URL.revokeObjectURL(url);
  }
  useEffect(() => {
    if (!observation || status !== 'tracking') return;
    const setsDone = observation.done ? observation.totalSets || 1 : Math.max(0, observation.setNo - 1);
    const cur: Progress = { reps: observation.reps, setsDone, done: observation.done };
    const prev = prevProgress.current;
    const justPassed = !observation.done && planPassed(config?.plan, cur.reps) && !planPassed(config?.plan, prev?.reps ?? 0);
    const c = cheerFor(prev, cur, config?.plan, justPassed);
    prevProgress.current = cur;
    if (c) showCheer(c);
  }, [observation?.reps, observation?.done, observation?.setNo]);
  useEffect(() => {
    if (!observation || status !== 'tracking') return;
    if (prevRest.current > 0 && observation.restLeft === 0 && !observation.done) showCheer(REST_OVER);
    prevRest.current = observation.restLeft;
    if (observation.hold < 1) holdCheered.current = false;
    else if (!holdCheered.current && observation.requiredHold >= 5 && observation.hold >= observation.requiredHold / 2) {
      holdCheered.current = true;
      showCheer(HOLD_HALF);
    }
  }, [observation?.hold, observation?.restLeft]);
  const mode = config?.mode,
    feedback = info[message];
  const adviceText = observation?.advice
    ? language === 'ar'
      ? genderize(observation.advice.ar, gender)
      : observation.advice.en
    : feedback
      ? selectText(feedback[0], feedback[1], language)
      : '';
  const phaseLabel: Record<string, [string, string]> = {
    idle: ['IDLE', 'انتظار'],
    moving: ['MOVING', 'حركة'],
    holding: ['HOLDING', 'ثبات'],
    returning: ['RETURNING', 'رجوع'],
    completed: ['COMPLETED', 'اكتمل'],
  };
  const compLabel: Record<string, [string, string]> = {
    trunk: ['trunk lean', 'ميل الجذع'],
    shrug: ['shoulder shrug', 'رفع الكتف'],
    lift: ['head lift', 'رفع الرأس'],
    translation: ['forward head shift', 'إزاحة الرأس للأمام'],
  };
  const assessment = observation?.status;
  const stateLabel = !calibrated
    ? tr('GETTING READY', 'جاري التجهيز')
    : assessment === 'done'
      ? tr('SESSION COMPLETE', 'الجلسة اكتملت')
      : assessment === 'resting'
        ? tr('REST BETWEEN SETS', 'راحة بين المجموعات')
        : assessment === 'correct'
          ? tr('CORRECT', 'صحيح')
          : assessment === 'adjust'
            ? tr('NEEDS CORRECTION', 'تحتاج تصحيح')
            : tr('TRACKING UNAVAILABLE', 'التتبع غير متاح');
  const statusColor =
    assessment === 'correct' || assessment === 'done'
      ? '#107f55'
      : assessment === 'resting'
        ? '#2479d7'
        : assessment === 'adjust'
          ? '#bd394e'
          : '#a36a1a';
  return (
    <div className="screen dots-bg" dir={language === 'ar' ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', padding: 18 }}>
      <TopBar here={2} steps={language === 'ar' ? ['التقييم', 'الفيديو', 'الكاميرا'] : ['Assessment', 'Video', 'Camera']} />
      <main className="plush" style={{ maxWidth: 1150, margin: '22px auto', padding: 22, background: 'var(--surface)' }}>
        <h1 style={{ marginBottom: 4 }}>{tr('AI Exercise Analysis', 'تحليل التمرين بالذكاء الاصطناعي')}</h1>
        <h2>{exercise?.title ?? tr('Choose an exercise from the video library', 'اختاري تمرين من مكتبة الفيديوهات')}</h2>
        <p>{config ? (language === 'ar' ? config.descriptionAr : config.descriptionEn) : ''}</p>
        <p>
          <b>{tr('Camera direction:', 'اتجاه الكاميرا:')}</b>{' '}
          {config?.view === 'side'
            ? tr('side view, head and shoulders visible', 'من الجانب، مع ظهور الرأس والكتفين')
            : tr('front view, face and shoulders visible', 'من الأمام، مع ظهور الوجه والكتفين')}
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,410px),1fr))',
            gap: 18,
            alignItems: 'start',
          }}
        >
          <section aria-label={tr('Live webcam', 'الكاميرا المباشرة')}>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <b>📷 {tr('LIVE CAMERA', 'الكاميرا المباشرة')}</b>
              <label style={{ fontSize: 12 }}>
                <input type="checkbox" checked={showPoints} onChange={(e) => setShowPoints(e.target.checked)} />{' '}
                {tr('Show skeleton', 'إظهار نقاط الجسم')}
              </label>
            </div>
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 690,
                aspectRatio: '4/3',
                background: '#182a33',
                borderRadius: 16,
                overflow: 'hidden',
                margin: 'auto',
              }}
            >
              <video
                ref={video}
                playsInline
                autoPlay
                muted
                style={{ width: '100%', height: '100%', objectFit: 'contain', transform: 'scaleX(-1)' }}
              />
              <canvas
                ref={overlay}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  transform: 'scaleX(-1)',
                  pointerEvents: 'none',
                }}
              />
              {status === 'off' && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    color: '#fff',
                    padding: 25,
                    textAlign: 'center',
                  }}
                >
                  {tr('Camera will appear here after permission.', 'الكاميرا هتظهر هنا بعد الموافقة على تشغيلها.')}
                </div>
              )}
            </div>

            <div
              style={{
                marginTop: 10,
                padding: 12,
                borderRadius: 12,
                background: assessment === 'correct' ? '#e4f8ed' : assessment === 'adjust' ? '#fff0f1' : '#f5f5ee',
                border: `1px solid ${assessment === 'correct' ? '#99d9b5' : assessment === 'adjust' ? '#f0adb5' : '#ddd'}`,
                color: '#183c3c',
              }}
              role="status"
              aria-live="polite"
            >
              <strong style={{ color: statusColor, fontSize: 19 }}>
                {assessment === 'correct' ? '✓ ' : assessment === 'adjust' ? '! ' : '● '}
                {stateLabel}
              </strong>
              {!calibrated && calibrating && (
                <div style={{ height: 8, borderRadius: 8, background: '#dfe9f1', overflow: 'hidden', marginTop: 8 }}>
                  <div style={{ width: `${Math.round(calProgress * 100)}%`, height: '100%', background: '#2479d7', transition: 'width .2s' }} />
                </div>
              )}
              <p style={{ margin: '7px 0 0', fontSize: 14 }}>
                {!calibrated
                  ? feedback && message === 'calUnstable'
                    ? selectText(feedback[0], feedback[1], language)
                    : calibrating
                      ? tr('Almost ready… stay relaxed for a moment.', 'قربنا… خليكي مرتاحة لحظة.')
                      : tr(
                          'Sit comfortably and look at the camera. It starts by itself.',
                          'اقعدي بشكل مريح وبصي للكاميرا. التمرين هيبدأ لوحده.',
                        )
                  : adviceText}
              </p>
            </div>
          </section>
          <aside aria-label={tr('Live exercise assessment', 'تقييم التمرين المباشر')} style={{ display: 'grid', gap: 12 }}>
            <div style={{ padding: 17, borderRadius: 16, background: '#f0f7f5', border: '1px solid #d6e7e2' }}>
              <b style={{ fontSize: 17 }}>✓ {tr('Form Feedback', 'تقييم الحركة')}</b>
              <div style={{ color: statusColor, fontSize: 22, fontWeight: 800, marginTop: 11 }}>{stateLabel}</div>
              <p style={{ fontSize: 14, margin: '6px 0' }}>{adviceText || tr('No tracking result yet.', 'لا توجد نتائج بعد.')}</p>
              {observation?.step && (
                <div
                  style={{
                    margin: '6px 0',
                    padding: '8px 10px',
                    borderRadius: 10,
                    background: 'rgba(36,121,215,.1)',
                    fontSize: 13,
                  }}
                >
                  <b>
                    {tr('Movement', 'الحركة')} {observation.step.index + 1}/{observation.step.total}:
                  </b>{' '}
                  {language === 'ar' ? observation.step.ar : observation.step.en}
                </div>
              )}
              {mode === 'isometric' && (
                <p style={{ fontSize: 13, color: '#17598b', fontWeight: 700, margin: '8px 0' }}>
                  {tr(
                    `Completed directions: ${observation?.reps ?? 0}. Hold each direction for ${config?.holdSeconds ?? 5} seconds; every completed hold counts as one repetition.`,
                    `الاتجاهات المكتملة: ${observation?.reps ?? 0}. ثبّتي كل اتجاه ${config?.holdSeconds ?? 5} ثوانٍ؛ كل ثبات مكتمل بيتحسب عدة واحدة.`,
                  )}
                </p>
              )}
              {mode === 'deepFlexor' && config?.id === 'deep-flexor-2' && observation?.phase === 'returning' && (
                <p style={{ fontSize: 13, color: '#17598b', fontWeight: 700, margin: '8px 0' }}>
                  {tr('Repetition counted! Return to the starting position before repeating.', 'العدة اتحسبت! ارجعي لوضع البداية قبل ما تكرري الحركة.')}
                </p>
              )}
              {observation?.primary && observation.reliable && (
                <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                  <div>
                    {tr('Current', 'القياس الحالي')}:{' '}
                    <b>
                      {language === 'ar' ? observation.primary.labelAr : observation.primary.label}{' '}
                      {observation.primary.value === null ? '—' : observation.primary.value.toFixed(1)}
                      {observation.primary.unit}
                    </b>
                  </div>
                  <div>
                    {tr('Target range', 'النطاق المستهدف')}: <b>{observation.primary.target}</b>
                  </div>
                </div>
              )}
              {!!observation?.compensations?.length && (
                <div style={{ fontSize: 13, color: '#bd394e' }}>
                  {tr('Compensation detected', 'تعويض مرصود')}:{' '}
                  {observation.compensations
                    .map((k) => selectText(compLabel[k]?.[0] ?? k, compLabel[k]?.[1] ?? k, language))
                    .join(', ')}
                </div>
              )}
              <small style={{ opacity: 0.8 }}>
                {tr('Measurement reliability', 'موثوقية القياس')}: {Math.round((observation?.confidence ?? 0) * 100)}%
                {observation && !observation.reliable
                  ? tr(' — too low, no exact corrections', ' — منخفضة، لا تصحيحات دقيقة')
                  : ''}
              </small>
            </div>
            {config?.plan && (
              <div style={{ padding: 16, borderRadius: 14, border: '1px solid #cfe0f3', background: '#eef5fd' }}>
                <b>{tr('Session progress', 'تقدم الجلسة')}</b>
                <div style={{ fontSize: 24, fontWeight: 800, margin: '8px 0 4px' }}>
                  {config.plan.sets > 1 ? (
                    <>
                      {tr('Set', 'المجموعة')} {observation?.setNo ?? 1}/{config.plan.sets} · {tr('Rep', 'التكرار')}{' '}
                      {observation?.done ? config.plan.repsPerSet : (observation?.repsInSet ?? 0)}/{config.plan.repsPerSet}
                    </>
                  ) : (
                    <>
                      {tr('Repetitions', 'التكرارات')} {observation?.reps ?? 0}/{config.plan.repsPerSet}
                    </>
                  )}
                </div>
                <div style={{ height: 10, borderRadius: 10, background: '#dbe6f3', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, (100 * (observation?.reps ?? 0)) / Math.max(1, config.plan.repsPerSet * config.plan.sets))}%`,
                      height: '100%',
                      background: '#2479d7',
                      transition: 'width .3s',
                    }}
                  />
                </div>
                {config.plan.sets > 1 && (
                  <div style={{ marginTop: 10, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>{tr('Hold this repetition', 'ثبات التكرار الحالي')}</span>
                      <b>
                        {Math.min(observation?.hold ?? 0, config.holdSeconds).toFixed(1)} / {config.holdSeconds}s
                      </b>
                    </div>
                    <div style={{ height: 8, borderRadius: 8, background: '#dbe6f3', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${Math.min(100, (100 * (observation?.hold ?? 0)) / Math.max(1, config.holdSeconds))}%`,
                          height: '100%',
                          background: '#2fa66a',
                          transition: 'width .2s',
                        }}
                      />
                    </div>
                  </div>
                )}
                {config.plan && !observation?.done && planPassed(config.plan, observation?.reps ?? 0) && (
                  <p style={{ marginTop: 10, fontWeight: 700, color: '#107f55' }}>
                    {tr(
                      `You have done ${observation?.reps}/${planTotal(config.plan)} repetitions. You may finish now and the session counts as completed, or keep going.`,
                      `عملتي ${observation?.reps}/${planTotal(config.plan)} تكرار. تقدري تنهي دلوقتي والجلسة بتتحسب مكتملة، أو تكملي.`,
                    )}
                  </p>
                )}
                {!!observation?.restLeft && (
                  <div style={{ marginTop: 10, fontWeight: 700, color: '#2479d7' }}>
                    {tr('Rest', 'راحة')}: {Math.ceil(observation.restLeft)}s
                  </div>
                )}
                <small style={{ opacity: 0.75, display: 'block', marginTop: 8 }}>
                  {config.plan.sets > 1
                    ? tr(
                        `Hold gently for ${config.holdSeconds} s to count one repetition, then return to the start before repeating. Complete ${config.plan.sets} sets.`,
                        `ثبتي بهدوء ${config.holdSeconds} ثواني عشان تتحسب عدة، وبعدين ارجعي لوضع البداية قبل التكرار التالي. أكملي ${config.plan.sets} مجموعات.`,
                      )
                    : tr(
                        `The session ends automatically after ${config.plan.repsPerSet} correct repetitions.`,
                        `الجلسة بتنتهي تلقائيًا بعد ${config.plan.repsPerSet} تكرار صحيح.`,
                      )}
                </small>
              </div>
            )}
            {mode === 'deepFlexor' && (
              <p style={{ margin: '0 0 4px', fontSize: 13, color: '#8a5a00' }}>
                {tr(
                  'Keep the effort very gentle: do not clench your jaw or push hard. The camera cannot tell whether the deep neck muscles are working. Stop if you feel strain or pain.',
                  'خلي المجهود خفيف جدًا: ما تشدش على الفك ولا تضغطي بقوة. الكاميرا مش بتعرف لو العضلات العميقة شغالة. وقفي لو حسيتي بشد أو ألم.',
                )}
              </p>
            )}
            {mode === 'deepFlexor' && config?.targets.nod && (
              <NodTrace trace={nodTrace.current} lo={config.targets.nod[0]} hi={config.targets.nod[1]} tr={tr} />
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 10 }}>
              <div style={{ padding: 15, borderRadius: 13, background: '#f3f4f8' }}>
                <small>{tr('Current Hold', 'الثبات الحالي')}</small>
                <div style={{ fontSize: 27, fontWeight: 800 }}>
                  {(observation?.hold ?? 0).toFixed(1)}s
                  <small style={{ fontSize: 13 }}> / {observation?.requiredHold ?? config?.targets.holdSeconds ?? 0}s</small>
                </div>
              </div>
              <div style={{ padding: 15, borderRadius: 13, background: '#f3f4f8' }}>
                <small>{tr('Tracking Phase', 'مرحلة التتبع')}</small>
                <div style={{ fontSize: 18, fontWeight: 700 }}>
                  {observation ? selectText(phaseLabel[observation.phase][0], phaseLabel[observation.phase][1], language) : '—'}
                </div>
              </div>
            </div>
            <div style={{ padding: 16, borderRadius: 14, border: '1px solid #dce5e4' }}>
              <b>{tr('Live Angle & Motion Checks', 'فحص الزوايا والحركة المباشر')}</b>
              {observation?.metrics?.length ? (
                observation.metrics.map((m) => (
                  <div
                    key={m.key}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      borderBottom: '1px solid #edf0ef',
                      padding: '9px 0',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{language === 'ar' ? m.labelAr : m.label}</div>
                      <small style={{ opacity: 0.75 }}>
                        {tr('Demo target', 'النطاق التجريبي')}: {m.target}
                      </small>
                    </div>
                    <strong style={{ fontSize: 19, color: m.acceptable ? '#107f55' : '#bd394e', whiteSpace: 'nowrap' }}>
                      {m.value.toFixed(1)}
                      {m.unit} {m.acceptable ? '✓' : '!'}
                    </strong>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: 13 }}>
                  {tr('Angles appear after calibration and reliable detection.', 'الزوايا هتظهر بعد المعايرة ورصد الجسم بوضوح.')}
                </p>
              )}
            </div>
            <small>
              {tr(
                'Demo camera-match score, not verified medical accuracy. 3D neck motion, muscle activity and resistance force cannot be fully assessed using one webcam.',
                'دي نسبة مطابقة تجريبية، مش دقة طبية مثبتة. كاميرا واحدة لا تقيس حركة الرقبة ثلاثية الأبعاد أو نشاط العضلات أو قوة المقاومة بدقة.',
              )}
            </small>
          </aside>
        </div>
        {(mode === 'laser' || mode === 'tracking') && (
          <div style={{ margin: '14px auto', maxWidth: 420, textAlign: 'center' }}>
            <p>
              {tr('Virtual head-controlled dot (blue) and target (orange)', 'النقطة المتحركة بالرأس (أزرق) والهدف (برتقالي)')}
            </p>
            <svg
              viewBox="0 0 240 160"
              style={{ width: '100%', border: '1px solid #aaa', borderRadius: 12, background: '#f7f9fc' }}
            >
              <line x1="120" x2="120" y1="0" y2="160" stroke="#ddd" />
              <line x1="0" x2="240" y1="80" y2="80" stroke="#ddd" />
              <circle
                cx={120 + (observation?.target.x ?? 0) * 85}
                cy={80 + (observation?.target.y ?? 0) * 60}
                r={mode === 'laser' ? 22 : config?.stage === 2 ? 15 : 22}
                fill="none"
                stroke="#ed8f40"
                strokeWidth="4"
              />
              <circle cx={120 + (observation?.dot.x ?? 0) * 85} cy={80 + (observation?.dot.y ?? 0) * 60} r="8" fill="#2479d7" />
            </svg>
          </div>
        )}
        {status === 'off' && (
          <div style={{ marginTop: 14, padding: 14, borderRadius: 14, border: '1px solid #dce5e4', background: '#fff' }}>
            {safetyMessage(gate.state, tr) && (
              <p
                role={gate.state === 'checking' ? 'status' : 'alert'}
                style={{ margin: '0 0 10px', color: gate.state === 'checking' ? 'inherit' : '#a13543' }}
              >
                {safetyMessage(gate.state, tr)}{' '}
                {gate.state === 'error' && (
                  <button type="button" className="btn-plush" onClick={gate.retry}>
                    {tr('Try again', 'إعادة المحاولة')}
                  </button>
                )}
              </p>
            )}
            <label style={{ display: 'block' }}>
              {tr('Pain right now (0 = none, 10 = worst):', 'الألم دلوقتي (٠ = مفيش، ١٠ = أسوأ ألم):')}{' '}
              <b>{painBefore === null ? '—' : painBefore}</b>
              <input
                type="range"
                min="0"
                max="10"
                value={painBefore ?? 0}
                onChange={(e) => setPainBefore(Number(e.target.value))}
                onPointerDown={(e) => {
                  if (painBefore === null) setPainBefore(Number((e.currentTarget as HTMLInputElement).value));
                }}
                style={{ width: '100%' }}
                aria-label={tr('Pain before exercise', 'الألم قبل التمرين')}
              />
            </label>
            <small style={{ opacity: 0.75 }}>
              {tr(
                `Move the slider to confirm your rating. ${PAIN_BLOCK} or higher means: do not exercise, contact your physiotherapist.`,
                `حركي الشريط لتأكيد التقييم. ${PAIN_BLOCK} أو أكتر معناها: ما تتمرنيش وتواصلي مع أخصائي العلاج الطبيعي.`,
              )}
            </small>
          </div>
        )}
        <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', marginTop: 18 }}>
          {status === 'off' && (
            <button className="btn-plush primary" disabled={!config || safetyBlocked || painBefore === null} onClick={begin}>
              {tr('Turn on camera', 'تشغيل الكاميرا')}
            </button>
          )}
          {(status === 'calibration' || status === 'tracking') && (
            <>
              <button className="btn-plush primary" onClick={() => finish()}>
                {tr('Finish', 'إنهاء')}
              </button>
            </>
          )}
          <button
            className="btn-plush"
            onClick={() => {
              stopCamera();
              store.setScreen('neck-video');
            }}
          >
            {tr('Back to video', 'الرجوع للفيديو')}
          </button>
        </div>
        {status === 'loading' && <p>{tr('Loading MediaPipe models…', 'جاري تحميل نماذج MediaPipe…')}</p>}
        <small style={{ display: 'block', opacity: 0.7 }}>{diag}</small>
        {cheer && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: 'fixed',
              top: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 60,
              maxWidth: '90vw',
              padding: '12px 18px',
              borderRadius: 14,
              background: '#e8f7ee',
              border: '1px solid #8fd0aa',
              color: '#145c3a',
              fontWeight: 700,
              boxShadow: '0 6px 20px rgba(0,0,0,.15)',
            }}
          >
            ★ {language === 'ar' ? genderize(cheer.ar, gender) : cheer.en}
          </div>
        )}
        <div>
          <GenderToggle gender={gender} setGender={setGender} language={language} />
        </div>
        {calibrated && status === 'tracking' && (
          <button
            type="button"
            onClick={startCalibration}
            style={{ background: 'none', border: 'none', textDecoration: 'underline', color: '#2479d7', padding: 4, cursor: 'pointer' }}
          >
            {tr('Reset my starting position', 'إعادة ضبط وضعي الأساسي')}
          </button>
        )}
        <p role="status">
          {feedback
            ? selectText(feedback[0], feedback[1], language)
            : tr('Please remain in view.', 'من فضلك ابقي داخل إطار الكاميرا.')}
        </p>

        {mode === 'neutral' && (
          <label style={{ display: 'block', margin: '8px 0' }}>
            <input type="checkbox" checked={fixedCva} onChange={(e) => setFixedCva(e.target.checked)} />{' '}
            {tr(
              'Compare with the fixed experimental CVA target (~50°) instead of my calibrated reference',
              'قارني بهدف زاوية الوضعية التجريبي (~٥٠°) بدل وضعي المرجعي',
            )}
          </label>
        )}
        {mode === 'isometric' && (
          <label>
            {tr('Self-reported effort (camera cannot measure force):', 'المجهود الذي تشعرين به (الكاميرا لا تقيس القوة):')}{' '}
            {effort}/10 <input type="range" min="1" max="10" value={effort} onChange={(e) => setEffort(Number(e.target.value))} />
          </label>
        )}
        {(status === 'tracking' || status === 'calibration') && (
          <button
            type="button"
            style={{ marginTop: 12, color: '#9e1538', border: '2px solid #9e1538', padding: 12, borderRadius: 10 }}
            onClick={() => finish(true)}
          >
            {tr('STOP: pain / dizziness / numbness / weakness', 'إيقاف فوري: ألم / دوخة / تنميل / ضعف')}
          </button>
        )}
        {error && (
          <p role="alert" style={{ color: '#a13543' }}>
            {error}
          </p>
        )}
        {status === 'stopped' && (report || pending) && (
          <div style={{ border: '1px solid #cfded9', borderRadius: 14, padding: 16, marginTop: 16 }}>
            <h3>{tr('Session summary', 'ملخص الجلسة')}</h3>
            {loopDone && (
              <p style={{ color: '#1f7a4d', fontWeight: 800 }}>
                {tr('✓ Exercise completed. Well done!', '✓ تم إكمال التمرين. أحسنتِ!')}
              </p>
            )}
            <p>
              {tr('Repetitions:', 'التكرارات:')}{' '}
              <b>
                {(pending?.extra.repsCompleted as number) ?? 0}
                {pending && (pending.extra.repsTarget as number) ? ` / ${pending.extra.repsTarget as number}` : ''}
              </b>
              {pending && (pending.extra.setsTarget as number) > 1 ? (
                <>
                  {' '}
                  · {tr('Sets:', 'المجموعات:')}{' '}
                  <b>
                    {pending.extra.setsCompleted as number}/{pending.extra.setsTarget as number}
                  </b>
                </>
              ) : null}
            </p>
            {report && (
              <p>
                {tr('Time in target:', 'الوقت داخل النطاق:')} <b>{report.validSeconds.toFixed(1)}s</b>
              </p>
            )}
            {pending && (
              <>
                <label style={{ display: 'block', margin: '10px 0' }}>
                  {tr('Pain now, after exercising (0–10):', 'الألم دلوقتي بعد التمرين (٠–١٠):')} <b>{painAfter ?? '—'}</b>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={painAfter ?? painBefore ?? 0}
                    onChange={(e) => setPainAfter(Number(e.target.value))}
                    onPointerDown={(e) => {
                      if (painAfter === null) setPainAfter(Number((e.currentTarget as HTMLInputElement).value));
                    }}
                    style={{ width: '100%' }}
                    aria-label={tr('Pain after exercise', 'الألم بعد التمرين')}
                  />
                </label>
                {painFlag(painBefore, painAfter) && (
                  <p role="alert" style={{ color: '#a13543', fontWeight: 700 }}>
                    {tr(
                      'Your pain went up or is severe. Stop exercising and contact your physiotherapist before the next session.',
                      'الألم زاد أو بقى شديد. وقفي التمرين وتواصلي مع أخصائي العلاج الطبيعي قبل الجلسة الجاية.',
                    )}
                  </p>
                )}
                <button type="button" className="btn-plush primary" onClick={saveSession} disabled={painAfter === null}>
                  {tr('Save session', 'حفظ الجلسة')}
                </button>
                {painAfter === null && (
                  <small style={{ display: 'block', opacity: 0.7 }}>
                    {tr('Rate your pain to enable saving.', 'قيّمي الألم لتفعيل الحفظ.')}
                  </small>
                )}
              </>
            )}
            <small style={{ display: 'block', marginTop: 8 }}>
              {tr('Prototype score — not clinically validated.', 'نتيجة تجريبية غير معتمدة طبيًا.')}
            </small>
            {baselineRef.current && recording.current.length > 0 && (
              <button type="button" className="btn-plush" style={{ marginTop: 8 }} onClick={downloadRecording}>
                {tr('Download tracking data (numbers only, JSON)', 'تحميل بيانات التتبع (أرقام فقط، JSON)')}
              </button>
            )}
          </div>
        )}
        {sessionSaved && (
          <p role="status">{tr('Session observations saved to patient history.', 'تم حفظ ملاحظات الجلسة في سجل المريض.')}</p>
        )}
        <small>
          {tr(
            'Research/demo tracking only: camera-derived proxies are not validated cervical angles; no strength, deep-muscle activation, or actual laser detection. Targets and thresholds must be reviewed by a physiotherapist before real patient use.',
            'تتبع تجريبي فقط: القيم المستخرجة من الكاميرا ليست زوايا رقبة معتمدة؛ لا يتم قياس القوة أو العضلات العميقة أو الليزر الحقيقي. يجب مراجعة الحدود والأهداف مع أخصائي العلاج الطبيعي قبل الاستخدام مع مرضى فعليين.',
          )}
        </small>
      </main>
    </div>
  );
}
