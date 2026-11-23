# NECKPHYSIOAI
### AI-Powered Neck Physiotherapy & Exercise Monitoring Platform

**NECKPHYSIOAI** is a bilingual (Arabic/English) web application designed to support neck physiotherapy exercises through webcam-based movement tracking, real-time feedback, and digital progress monitoring.

The platform combines computer vision, interactive exercise guidance, and patient–doctor communication to support accessible, personalized physiotherapy practice.

**Live Website:** https://neckphysioai2.vercel.app/

**Source Code:** https://github.com/elaliaaelmoez/NECKPHYSIOAI2

---

## Project Overview

NECKPHYSIOAI helps patients perform guided neck exercises while using their device's camera to monitor movement.

Using MediaPipe, the application estimates head, face, and upper-body landmarks to evaluate exercise performance and provide understandable feedback.

The system is designed to accommodate natural differences in patients' movement abilities rather than requiring perfect reproduction of demonstration videos.

**Important:** Automated feedback is an experimental movement assessment and does not replace clinical evaluation by a qualified physiotherapist.

## Key Features

### 1. AI-Assisted Exercise Tracking

- Webcam-based tracking using MediaPipe.
- Detection of facial, head, and body landmarks.
- Exercise-specific movement evaluation.
- Real-time guidance and correction messages.
- Configurable movement tolerance and repetition targets.
- Support for movement calibration and tracking confidence.
- Visual feedback during exercises.

### 2. Neck Physiotherapy Exercises

The application includes eight guided neck exercises.

Depending on the exercise, the tracking system can evaluate:

- Head and neck positioning.
- Movement direction and range.
- Chin-tuck and head-lift movements.
- Holding duration.
- Repetition completion.
- Eye and gaze movement estimates where applicable.

The application provides movement instructions and progress indicators to guide patients through their exercise sessions.

### 3. Patient Dashboard

Patients can:

- Create an account and sign in.
- Complete a Neck Disability Index (NDI) assessment.
- Access guided exercises.
- Monitor exercise performance.
- View session history and progress information.
- Receive exercise feedback.

### 4. Doctor Dashboard

Authorized doctors can:

- Sign in using their assigned accounts.
- Review assigned patients.
- Access patient exercise sessions and progress.
- Review relevant assessment results.
- Manage supported care-planning features.

Doctor access is controlled through role-based permissions.

### 5. Bilingual Interface

The application supports:

- Arabic
- English

The interface provides exercise guidance, navigation, and feedback in both languages.

## Technologies Used

| Component | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express, TypeScript |
| Computer Vision | MediaPipe Tasks Vision |
| Database | PostgreSQL, Supabase |
| Validation | Zod |
| Charts | Recharts |
| AI Integration | Google Gemini (where configured) |
| Hosting | Vercel |
| Version Control | Git, GitHub |
| Testing | Vitest |

## System Architecture

```text
Patient / Doctor
       |
       v
React + TypeScript Frontend
       |
       +---- Webcam --> MediaPipe
       |                 |
       |                 v
       |          Movement Analysis
       |                 |
       |                 v
       |          Exercise Feedback
       |
       v
Express REST API
       |
       v
Supabase PostgreSQL
       |
       v
Patient Sessions / Doctor Dashboard
```

## Local Installation

### Requirements

- Node.js 18 or newer, using a compatible supported release.
- npm
- PostgreSQL database connection.
- Modern browser with webcam support.

### Installation

Clone the repository:

```bash
git clone https://github.com/elaliaaelmoez/NECKPHYSIOAI2.git
cd NECKPHYSIOAI2/NeckPhysioAI_Final_Merged
```

Install dependencies:

```bash
npm install
```

Create a local `.env` file using `.env.example` as a reference.

Configure the required server-side environment variables:

```env
DATABASE_URL=your_postgresql_connection_string
AUTH_SECRET=your_secure_random_secret
```

Optional integrations may require additional environment variables.

Do not commit `.env`, database credentials, passwords, or API keys to GitHub.

Run the frontend and backend together:

```bash
npm run dev:full
```

Frontend:

`http://localhost:5173`

Backend:

`http://localhost:5001`

If these ports are already in use, check the addresses reported in the terminal.

## Production Deployment

The project is configured for deployment on **Vercel**.

The frontend is built using Vite, while the Express API is integrated through Vercel Functions.

Deployment configuration includes:

- `vercel.json`
- `api/index.ts`
- `package.json`
- `vite.config.ts`

**Vercel Root Directory:**

```text
NeckPhysioAI_Final_Merged
```

Configure sensitive environment variables in the Vercel dashboard rather than storing them in source code.

The deployed application is available at:

https://neckphysioai2.vercel.app/

## Testing

Run the production build:

```bash
npm run build
```

Run TypeScript checks:

```bash
npm run typecheck
```

Run automated tests:

```bash
npm test
```

Backend integration tests may require a separate test database. Never point destructive test procedures at a production database.

Exercise tracking should also be tested with a real webcam because automated unit tests cannot fully establish movement-tracking accuracy.

## Project Structure

```text
NeckPhysioAI_Final_Merged/
├── src/
│   ├── components/
│   ├── data/
│   ├── game/
│   ├── i18n/
│   ├── neckAI/
│   └── utils/
├── backend/
│   ├── src/
│   └── test/
├── api/
├── public/
├── scripts/
├── docs/
├── package.json
├── vercel.json
└── vite.config.ts
```

## Privacy and Safety

- Patient authentication and doctor access are handled by the backend.
- Sensitive credentials are stored in environment variables.
- Doctor access is restricted according to account permissions.
- Webcam tracking is processed in the browser.
- Movement feedback depends on tracking quality and camera positioning.
- Exercise assessment values are application-generated estimates, not clinically validated diagnostic measurements.

**NECKPHYSIOAI is an educational and experimental physiotherapy support application, not a certified medical device.**

---

## Project Links

**GitHub Repository:**  
https://github.com/elaliaaelmoez/NECKPHYSIOAI2

**Live Application:**  
https://neckphysioai2.vercel.app/

**Project:** NECKPHYSIOAI — AI-Assisted Neck Physiotherapy Platform
