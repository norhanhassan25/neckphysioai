# Automatic NDI-to-video demo protocol

The workflow requires **no individual doctor approval**. On assessment submission the server performs safety screening, assigns a video, and the client opens that video automatically.

| NDI % | Primary video | Other videos in the group |
|---|---|---|
| 0–9 | neutral-head-1 | tracking-1 |
| 10–29 | deep-flexor-2 | laser-proprioception, tracking-1, tracking-2 |
| 30–49 | deep-flexor-1 | cervical-isometric, neutral-head-1 |
| 50–69 | cervical-isometric | neutral-head-1, deep-flexor-1 |
| 70–100 | **No exercise** | Clinical review |

These continuous ranges cover fractions when some NDI items are inapplicable.

Safety: warning symptoms or reported pain >= 7 stop automatic selection, even at lower NDI. Disabled videos are skipped; if none are active, the patient sees a clear message. The supplied eight videos are activated in the one-time migration `5_enable_supplied_neck_video_library`. Existing individual assessments are not reassigned automatically: submit a new assessment to test the updated policy.

**Clinical limitation:** NDI quantifies disability and does not clinically determine which neck exercise is indicated. This is the project team's demonstration mapping only. The responsible physiotherapist should validate the mapping and all contraindications before real patient use. Face Landmarker cannot measure deep muscle activation or isometric strength.

## Commands

Install dependencies (if needed), then `npm run typecheck`, `npm run build`, `npm run dev:backend` and `npm run dev` (in separate terminals). Keep `.env` local; do not put secrets in ZIP or version control.
