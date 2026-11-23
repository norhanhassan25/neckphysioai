# NECKPHYSIOAI — Urgent submission patch

Changes:
- Removed duplicate language toggle (App + TopBar).
- Translated main patient Dashboard cards, safety log, and exercise library, including eight video names and descriptions.
- Replaced initial Yoga routine with neck assessment/exercise roadmap.
- Added Blue & White palette in theme picker.
- Added optional fixed doctor account provisioned from secure server-only environment settings; existing unassigned patients get linked on restart and newly registered patients are linked.
- Removed obsolete NDI-based assignment UI from doctor portal. NDI remains a recorded assessment.

## IMPORTANT: configure fixed doctor login
In `.env` (same folder as package.json), append:

```ini
DOCTOR_EMAIL=doctor@your-clinic.example
DOCTOR_PASSWORD=CHOOSE_A_UNIQUE_16_PLUS_CHARACTER_PASSWORD
DOCTOR_NAME=Clinic Physiotherapist
```

Use your own email and strong unique password; do NOT use the placeholders or commit `.env` to Git. Restart backend after editing `.env`. The first startup with these values will create/enable the approved clinician and attach any currently unassigned patients. Sign in via existing login form using the configured credentials. Password must be at least 12 characters. The doctor can access assigned patient history via the Doctor dashboard.

Test: `npm install`, `npm run typecheck`, `npm test`, `npm run build`, then `npm run dev:backend` and `npm run dev` in separate terminals. Confirm `[server] Database ready` and `[doctor] Clinic doctor account available`. Reload the browser with Ctrl+Shift+R.

No claim of webcam clinical accuracy or end-to-end testing: validate the movement logic with a physiotherapist and verify deployed authentication, history, and camera behavior.
