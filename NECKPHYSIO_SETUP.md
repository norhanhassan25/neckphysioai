# NeckPhysio AI — modified PhysioAlign MVP

This archive retains the PhysioAlign React + Express + PostgreSQL application, and introduces an integrated **neck-only** patient workflow. The changes were made to the supplied source archive. This is a development MVP, **not clinically validated software**.

## What's implemented in source

- Patient login and onboarding remain on the existing PhysioAlign authentication system. Returning onboarded patients are directed to the new neck questionnaire.
- `NeckAssessmentScreen.tsx`: symptom screening, pain score, clinician-clearance checkbox and server persistence.
- `NeckVideoScreen.tsx`: display clinician-configured HTML5 video with instructions, and proceed to camera.
- `NeckTrackerScreen.tsx`: real MediaPipe Face Landmarker webcam processing, neutral calibration, camera-relative nose/eye movement tracking, approximate left/right gesture counts, tracking warnings, stop/save.
- `backend/src/routes/neck.ts`: authenticated APIs to store assessments and neck tracking sessions; doctor exercise configuration, and role-checked patient assessment/session review.
- Append-only migration 3 introduces `neck_exercises`, `neck_assessments`, `neck_tracking_sessions`. All access is through the existing cookie-authenticated Express APIs (the project does **not** use Supabase Auth or RLS).
- Doctor portal: edit the external HTTPS MP4 URL, approved instructions and exercise activation.
- Public doctor self-registration is blocked in `backend/src/routes/auth.ts`. Provision a doctor through an existing admin's authenticated role-management workflow and set the doctor's password using an authorized administrative process. No doctor password is included in source.

## Running locally

1. Install Node.js 20+ and a PostgreSQL database.
2. Copy `.env.example` to `.env`, set `DATABASE_URL` and a strong random `AUTH_SECRET`. Optional Gemini integration requires a key; not needed for neck tracking.
3. Run `npm ci` (or `npm install` if needed).
4. Run `npm run dev:full`.
5. Open http://localhost:5173. The Express backend listens on port 5001; Vite proxies `/api`.
6. A first account with an admin role is allowed by the original project only when there is not already an admin, or when the email is in `ADMIN_EMAILS`. From the admin portal, assign the selected account the doctor role. Do not expose administrative registration publicly in production.
7. Doctor: open the doctor portal, paste a secure HTTPS MP4 URL, choose **Activate**, then save. This MVP supports externally hosted video links, **not direct file uploads**.
8. Patient: sign in, complete any required original profile onboarding, then complete the neck assessment. Only patients meeting conservative screening criteria and with a configured active video can proceed.
9. Camera tracking needs localhost or HTTPS, camera permission, and access to the MediaPipe model and WASM CDN URLs. Try with stable lighting and the face centered. Left/right may appear mirrored depending on camera orientation.

## Safety and known limitations

- The questionnaire **does not diagnose** and is a conservative access filter: clinician clearance + pain <=3 + no warning symptoms + no painful turning + active doctor video are required.
- Webcam data is processed locally; raw footage is not recorded/uploaded by these new components.
- Head gesture direction is estimated from face landmarks. The displayed directions/counts are approximate and **not** clinical cervical range-of-motion measurements or measures of form correctness.
- Model thresholds and performance have not been clinically validated. Camera inference and server/database behavior must be tested on your own machine.
- The legacy PhysioAlign screens and general-pose features remain in the repository; not all branding has been replaced.
- Existing PostgreSQL authentication, not Supabase Auth, is used. Server-side authorized access is implemented for the added neck APIs, but this is **not** database RLS.
- The original ZIP did not contain a LICENSE file. Confirm permission/licensing obligations with the repository owner before redistribution.

## Endpoints

- `GET /api/neck/exercises`
- `GET /api/neck/assessment/latest` (patient)
- `POST /api/neck/assessment` (patient)
- `GET /api/neck/history` (patient)
- `POST /api/neck/sessions` (patient)
- `GET /api/neck/doctor/exercises` (doctor/admin)
- `PUT /api/neck/doctor/exercises/neck-rotation` (doctor/admin)
- `GET /api/neck/doctor/patients/:id` (authorized doctor/admin)

## Verification status

Files edited and archived. **npm install did not complete in the current restricted environment, and the build and live camera/database tests are unverified.** Run `npm ci`, `npm run typecheck`, `npm test` and `npm run build` in a network-enabled environment. Then manually test all endpoints and camera flow in a real browser.
