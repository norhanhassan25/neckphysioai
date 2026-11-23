# NECKPHYSIOAI — Camera integration update

## What changed

The patient route already had a **Start AI camera tracking / ابدأ متابعة الحركة بالكاميرا** button on the approved exercise video screen. This update substantially improves its destination: `src/components/NeckTrackerScreen.tsx`.

- Arabic/English labels, messages, errors, and right-to-left layout follow the site's language selector.
- The camera is requested only on button press and is stopped on leaving or finishing.
- MediaPipe Face Landmarker detects face landmarks locally in the browser; an overlay marks the nose and eye landmarks.
- Neutral head-position calibration is required before relative movement observations.
- Camera-relative head orientation is smoothed and observations are tailored to the exercise's configured tracking mode (`chin_tuck`, `head_stability`, `head_tracking`, or `head_rotation`).
- Session data is sent to `/api/neck/sessions` for storage in the existing PostgreSQL database; the backend requires a patient with an eligible doctor-approved assessment.
- Visible loading, permission, tracking-loss, missing-approval and saving states.

## How to try it

1. Extract the project into a **new folder**; place your own `.env` (database URL and AUTH_SECRET) beside `package.json`. Never share or bundle secrets.
2. From that folder: `npm install`, `npm run typecheck`, then `npm run build`.
3. In one terminal: `npm run dev:backend`. Verify `Database ready`.
4. In another terminal: `npm run dev`. Open `http://localhost:5173/` in Chrome or Edge.
5. Log in as patient, complete the NDI and safety questionnaire. An eligible assessment **and** an active, doctor-approved exercise rule with a video are required to proceed. The doctor can configure exercises through their dashboard.
6. Watch the assigned exercise video, click **Start AI camera tracking / ابدأ متابعة الحركة بالكاميرا**.
7. Grant camera permission; face the camera in good lighting; click **Calibrate neutral head position / اضبطي وضع الرأس المحايد** when face detection is good.
8. Perform only your physiotherapist-approved exercise. Check landmarks, movement labels, and corrective messages. Click **Finish and save / أنهي الجلسة واحفظي النتيجة** to save.
9. Switch the language from the top navigation and verify camera labels change.

## Important limitations

- Camera orientation is an **approximate proxy**, not clinically validated cervical range of motion or proof of a correctly performed exercise.
- For deep cervical flexor training it does not measure deep muscle activation. For isometrics it does not measure force. For laser proprioception it does not track the laser impact position. Progression videos share observation modes; they are **not fully validated automated exercise-specific corrections**.
- With the current doctor-approval rules some or all of the eight exercise videos may initially be unavailable to patients. This is intentional and must not be bypassed to give unsupervised medical advice.
- Remote MediaPipe model files must be accessible from the browser for first load. HTTPS or localhost is required for camera permission.
- This update was checked for TypeScript/TSX **syntax only** here; package dependencies are unavailable in this environment, so a full `typecheck`, production build, and live webcam/browser/backend test are not verified. Run those checks locally before submission.
