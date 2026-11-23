# NECKPHYSIOAI — Camera engine update (8 videos)

## What changed

- NDI questionnaire now **records its score only**. The frontend routes to the complete exercise library instead of automatically prescribing from the NDI percentage.
- Eight supplied exercise videos can each be opened in the app, with a camera button bound to that exact exercise ID.
- Shared MediaPipe Face Landmarker + Pose Landmarker webcam engine, neutral baseline calibration, geometric utilities and unit tests.
- Five exercise-specific analyzer modes, configured separately for all eight videos: `deepFlexor`, `isometric`, `laser`, `neutral`, `tracking`.
- Virtual target is drawn on screen for laser/target tracking; this does **not** analyze the actual head-mounted laser in the YouTube demonstration.
- Real-time bilingual feedback, confidence-loss messaging, effort self-report for isometrics, camera cleanup, stop-symptoms button.
- Backend `/api/neck/sessions` now saves a **specific chosen exercise ID** instead of using an NDI-selected ID. NDI assessments remain in history.

## Start

Copy your existing private `.env` beside `package.json`; never share it.

```powershell
npm install
npm run typecheck
npm run test -- --run
npm run build
```

Open two terminals *in the project folder*:

```powershell
npm run dev:backend
```

```powershell
npm run dev
```

Open `http://localhost:5173` (or Vite's reported port). Login as patient, finish the questionnaire (NDI saved), open Exercise Library, select any of the eight videos, play it, then click Start AI Camera. Position the camera as requested, click Calibrate, hold a neutral reference position for three seconds, perform a gentle movement, finish and save. Check patient history/doctor portal.

## Accuracy, review and limits

This is a *working implementation draft*, not clinically verified exercise correction. Webcam-derived head orientation and landmark positions cannot measure deep cervical flexor activation, resistance force, true cervical vertebral angles, or the physical laser. Head angles from a face transformation matrix are **camera-relative**, not validated cervical range of motion. Video content and the proposed exercise-specific targets are not independently verified; demonstration thresholds in `src/neckAI/config.ts` and `src/neckAI/engine.ts` require review and validation by a qualified physiotherapist. Camera position, mirroring, occlusion and calibration affect measurement. Do not use as an unsupervised medical treatment system.

Stopping on reported dizziness, numbness, weakness, severe/new pain remains enabled. There is no automatic stage advancement or automatic dosage prescription. The on-target frame percentage is explicitly **not** a clinical correctness score.

## How the code maps to videos

| Video | DB ID | Analyzer |
|---|---|---|
| Deep cervical flexor introduction | deep-flexor-1 | deepFlexor side view |
| Deep cervical flexor progression | deep-flexor-2 | deepFlexor side view |
| Cervical isometric | cervical-isometric | isometric front view |
| Laser proprioception | laser-proprioception | laser virtual target, front view |
| Neutral head video 1 | neutral-head-1 | neutral side view |
| Neutral head video 2 | neutral-head-2 | neutral side view |
| Tracking intro | tracking-1 | target tracking front view |
| Tracking progression | tracking-2 | target tracking front view |

## Tests to complete on Windows

1. `npm run typecheck && npm run build && npm test` must pass.
2. Login, check `/api/health` returns `database:up`.
3. NDI score appears and is stored, but it does not automatically assign a video.
4. Select each video and ensure the correct video title and tracking mode load.
5. Allow webcam; make sure Face + Pose models load and landmarks move.
6. Side view for DCF/neutral; front view for isometric/laser/tracking.
7. Calibration collects a 3-second baseline; feedback changes with movement.
8. Test refusal of webcam permissions, lost face, lost pose, ending session, and symptom stop.
9. Check correct `exercise_id` is stored per session in database and doctor's history.
10. Confirm no duplicate Vite/Express servers occupy ports 5173 or 5001.

**Tests not performed in this sandbox:** browser webcam, database access with your private credentials, clinical validation. No secrets are included in this ZIP.
