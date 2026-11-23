# Exercise recommendation — implementation and verification

This build uses the **eight supplied exercise videos** stored in migration 4. No medical NDI-to-exercise thresholds are invented.

## Patient flow

Patient completes NDI in Arabic or English; the server calculates `NDI% = (sum of answered scores / (5 × answered sections)) × 100`. At least eight NDI sections are required. Then it checks clinician approval, warning symptoms, pain score and painful movements. Only if screening is clear does the server look for **active, doctor-approved** exercise rules with a video link whose inclusive NDI range contains the score. When multiple rules match, the lowest numeric priority wins. If none match, the patient sees a review notice, not a made-up recommendation.

The patient sees the saved NDI percentage and a note that the video is selected by a *doctor-configured range*. The video page opens the corresponding exercise-specific camera tracker.

## Doctor setup (required)

1. Start the API, connect your PostgreSQL database, and sign in as an authorized doctor.
2. In Doctor Portal → **All exercise videos & assignment rules**, pick one of the eight exercises. Review its video and approved instructions.
3. Set **NDI min % / max %**, set priority for any overlapping ranges, then check **Activate for eligible patients** and **Doctor has clinically approved ...**. Save.
4. Repeat for relevant videos. Leave unreviewed videos disabled.
5. To test, use a non-sensitive test patient account, fill the assessment with the appropriate score and no warnings, and check that the assigned video matches the doctor-configured rule.

## Example calculation (not medical advice)

If the user answers all 10 items and scores 12/50, the displayed NDI is **24%**. The server selects a video **only if** the doctor previously configured an active, approved rule containing 24% and the safety screen passes. Otherwise it requests clinician review.

## Limits

NDI measures neck-related disability and cannot by itself choose the correct physiotherapy exercise. These matching bands are a configurable demonstration workflow and must be clinically reviewed. The camera tracker measures approximate observable head movement, not deep muscle activation, cervical force, or laser accuracy. Real camera/browser and database authorization testing still required.

## Testing

`npm run typecheck` and `npm run build` validate compilation. Check patient assessment, doctor exercise rule editing, video and webcam on a real device. Do not send `.env` files or private passwords to anyone.
