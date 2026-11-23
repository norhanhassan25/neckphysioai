# Merged NeckPhysio AI — Stage 1–2 + NDI + Camera

Base: user-supplied `PhysioAlign-Neck-Rehab-Stage1-2.zip`.

Imported from `NeckPhysioAI_NDI_AllVideos_update.zip`: patient/doctor integration, neck assessment, 10-section Arabic/English NDI, approved exercise-matching backend, neck video player, Face Landmarker camera observation, backend migrations, and neck-session history.

Kept from Stage 1–2: neck exercise category library and its eight video references (`src/data/neckExercises.ts` and `src/components/PoseLibraryScreen.tsx`). Added an assessment entry button to that library.

## Essential setup

1. `npm ci`
2. Create `.env` from `.env.example`, use real PostgreSQL DATABASE_URL and strong AUTH_SECRET.
3. `npm run typecheck` then `npm run build`
4. `npm run dev:full`
5. Complete first doctor account and approve appropriate video selection rules. Rules are OFF by default.

**Important:** The NDI is not itself a medical prescription tool. A qualified doctor must configure and approve selection rules. The camera outputs observational head tracking, not clinical correctness ratings for all eight videos. Laser position and isometric force cannot be verified from a single ordinary webcam.

No real database, webcam or live end-to-end tests were performed in this environment.
