# NECKPHYSIOAI — Camera Form Feedback Update

Updated `src/components/NeckTrackerScreen.tsx` and `src/neckAI/engine.ts` to display a two-column camera-analysis interface with color-coded **Correct (camera criteria)** and **Needs correction** states, observable angles, transparent demo targets, held repetitions, and end-of-session summary. Live skeleton strokes change color with observed camera-based status. Users may hide skeleton overlay. Arabic/English text is supported.

## What the live score means
- **Target Match %** = percentage of valid webcam observations meeting the experimental per-exercise heuristics. It is **not diagnostic accuracy**, medical safety, or a clinical technique score.
- Rep counting requires an uninterrupted in-range hold and then a deliberate release. Laser and tracking tasks use time in target; they do not show false rep counts.
- Deep flexor: relative ear–nose nod, apparent head translation and trunk compensation. **Muscle activation cannot be measured.**
- Isometric: head orientation stability, **not hand force or confirmed hand contact**.
- Neutral head: posture **relative to the user-calibrated reference**, not an independently verified ideal neck posture.
- Laser: virtual cursor driven by head orientation, **not a physical laser**.
- Tracking: virtual cursor–target error, **not eye movement tracking**.

## To test
1. Extract ZIP and open `NeckPhysioAI_Final_Merged`, the folder with `package.json`.
2. Copy your previous local `.env` here (do not commit or share it).
3. `npm install` then `npm run typecheck`, `npm test`, and `npm run build`.
4. Start `npm run dev:backend` in one terminal and `npm run dev` in another.
5. Login as patient, choose any one of the 8 videos, then **Start AI Camera**. Allow camera permission. From the correct front/side orientation, click **Calibrate for 3 seconds** while holding a neutral reference.
6. Change head orientation gently and verify live metrics turn red/green; compare visible reasons with actual measured changes. For hold-based modes, sustain in-range then release, and verify only one rep is counted.
7. Finish & save and confirm the session appears in patient history. Validate all 8 exercise mappings.

## Validation status and clinical limitations
The code was transpile/syntax-checked and the analyzer smoke-tested across eight exercise configurations in the preparation environment. **A full npm install, TypeScript typecheck/build, real webcam verification, accuracy benchmark, and end-to-end backend save were not completed in this environment.** The screenshots/design are an approximate layout match, not a pixel-perfect recreation. Device, lighting and camera angle affect measurements. Demonstration thresholds must be assessed with a physiotherapist and benchmarked against labeled recordings before actual patient use.

---
## Exercise-specific validation update (experimental thresholds)
All numeric targets live in `src/neckAI/config.ts` (`DCF_STAGES`, `ISOMETRIC_STAGES`, `LASER_STAGES`, `NEUTRAL_STAGES`, `TRACKING_STAGES`) so a physiotherapist can edit them. **Every value is experimental and needs clinical review and camera validation.**

- **Measurement** (`geometry.ts`): landmarks are converted to pixel coordinates (no aspect-ratio distortion); side-view facing direction is detected so a chin nod is positive for either facing; distances are normalised by shoulder width (front) or torso length (side). Baseline = median of ~3 s of samples, rejected as unstable if the user moved. EMA smoothing, landmark-visibility confidence and nod jitter gate every correction.
- **Status**: CORRECT / NEEDS CORRECTION / TRACKING UNAVAILABLE / CALIBRATING. Exact-degree advice ("increase your chin nod by approximately 2°") is only shown when confidence ≥ 70% and jitter is low; otherwise a non-numeric correction is shown.
- **Repetitions**: IDLE → MOVING → HOLDING → RETURNING → COMPLETED. A rep needs target range + full hold + no compensation + return to baseline (laser: return error below the JPE limit). Missing landmarks pause analysis and freeze timers.
- **Stage mapping to the 8 videos**: deep-flexor-1 → stage 1 (5–8°), deep-flexor-2 → stage 2 (8–12°); stages 3–5 exist in config. tracking-1 → 70 %, tracking-2 → 75 %; 80 % exists as stage 3. neutral-head-1/-2 → 10 s / 15 s hold. Change `stage` in `TRACKER_CONFIGS` to remap.
- **Neutral head**: default compares with the user's calibrated clinician-guided reference; tick the checkbox to compare with the fixed experimental ~50° estimated CVA target (shoulder-landmark based, NOT a diagnostic cutoff).
- **Limits**: a single webcam cannot measure 5–8° chin nods, deep-muscle activation, muscle force or hand contact reliably. Not validated on real webcam recordings.
