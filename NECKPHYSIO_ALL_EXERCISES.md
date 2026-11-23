# NeckPhysio AI — NDI and eight supplied exercise videos

This update extends the provided PhysioAlign project. It adds the ten-domain Neck Disability Index (NDI), Arabic/English questionnaire UI, and all eight video URLs supplied by the user. **These features are coded, but have not been end-to-end tested** because npm install was unable to finish in this runtime.

## Videos now in database (migration 4)

- Deep cervical flexor 1: https://youtube.com/shorts/v9vK-ORuvKo
- Deep cervical flexor progression: https://youtube.com/shorts/w-W0kOcff4k
- Cervical isometric: https://youtube.com/shorts/yIFJ-AcqZiY
- Laser proprioception: https://youtu.be/tbySm4GaEdU
- Neutral head 1: https://youtu.be/8vZMcVPOUac
- Neutral head 2: https://youtu.be/tp9CIPSOYDc
- Tracking 1: https://youtu.be/4hzD6GBqwuo
- Tracking progression: https://youtu.be/tHFqnUePJCo

The old neck rotation exercise remains as an additional record. Supplied YouTube videos are embedded, subject to YouTube's embedding policies. **No video contents were independently analyzed or validated**, so these are categorized based only on the labels supplied by the user.

## Patient workflow

1. Complete NDI: 10 questions, six scored options (0–5) each, optional N/A. At least eight responses are required for a computed score. NDI percentage = answered points / (5 × answered questions) × 100.
2. Complete the separate safety questions. Red-flag symptoms stop automated selection.
3. The doctor can activate exercises and set approved NDI percentage ranges and priority order in the doctor portal.
4. Server selects first active doctor-approved rule matching the NDI score; otherwise the patient is directed to clinician review.
5. Watch embedded YouTube video, start camera observation, save session history.

**IMPORTANT:** NDI is a disability measure, not a clinical treatment recommendation algorithm. The NDI matching range is a *doctor-configurable demonstration workflow*, not an evidence-based prescription. Clinicians must review individual clinical symptoms, exact intervention, contraindications, exercise-specific criteria and progression before enabling a rule. All exercise rules are initially inactive and unapproved.

## Camera mode coverage and technical limitations

- `head_rotation`: relative head-turn observations and approximate counted gestures.
- `head_stability`: relative face pose stability during neutral head or isometric video; cannot confirm resistance or muscular contraction.
- `chin_tuck`: face visibility and orientation observations; cannot determine deep cervical flexor recruitment or real chin-tuck depth from the single frontal camera.
- `head_tracking`: approximate relative head direction/time-series; cannot verify external visual target or laser-point tracking accuracy.

The camera is available for *all* library entries, but there is **no validated automatic correctness scoring for all eight exercises**. For a true movement-quality classifier per exercise, calibration, appropriate camera view, clinician-approved movement definitions, and real-world evaluation are required. Laser training needs additional laser-target detection or dedicated equipment; isometric force needs resistance/force measurement.

## Verification

- TS and TSX **syntax transpilation only** passed for the edited files.
- npm installation timed out in this environment; full typecheck, build, live database migration, camera behavior and real-world tracking quality remain **unverified**.
- Run `npm ci`, `npm run typecheck`, `npm run build`, and `npm run dev:full` on a machine with network and PostgreSQL. Try camera on localhost or HTTPS.
- Source code includes both original general-physiotherapy parts of PhysioAlign and modified neck workflow.
- Do not deploy as medical treatment or claim clinical validation.
