# Direct video workflow

After the patient submits NDI and the additional safety questions, the application **automatically opens the assigned exercise video** when the backend returns `status: eligible` plus `exerciseId`. The same navigation now also occurs when a previously eligible assessment is loaded. No extra click is required.

An NDI percentage by itself is not sufficient to prescribe neck rehabilitation exercises. The backend intentionally blocks automatic exercise selection for a patient who has warning symptoms, pain-related restrictions, or lacks clinician clearance. Matching additionally requires an active video with a doctor-approved NDI rule.

For an assessment like 66% that returns `review`, the UI now identifies whether the reason is safety review or missing exercise rules. Set rules in the Doctor Dashboard with a licensed physiotherapist; do not bypass safety screening to force a video.

## Verify
1. Copy your existing `.env` alongside `package.json` (never include it in a ZIP or share it).
2. Run `npm install`, `npm run typecheck`, `npm run build`.
3. Start the backend and frontend separately.
4. Submit a safe, clinician-cleared questionnaire whose score matches a configured, active, approved video. Confirm immediate navigation to the video page.
5. Submit a screening-flagged questionnaire. Confirm **no** exercise is automatically launched and a meaningful reason is displayed.

Real camera accuracy and medical appropriateness require clinician review and live testing.
