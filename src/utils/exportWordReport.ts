export interface WordReportPatient {
  name: string;
  email?: string;
  age?: number;
  goal?: string;
  experience?: string;
  sessionCount?: number;
  avgScore?: number | null;
}

export interface WordReportAssessment {
  label?: string;
  assessmentType?: string;
  isLastPost?: boolean;
  ndiPercent?: number | null;
  status?: string;
}

export interface WordReportSession {
  dayNumber?: number;
  displayName?: string;
  poseName?: string;
  durationSeconds: number;
  holdTimeSeconds: number;
  averageScore: number;
  grade: string;
  isFullSession?: boolean;
}

export function exportPatientWordReport(params: {
  patient: WordReportPatient;
  assessments: WordReportAssessment[];
  sessions: WordReportSession[];
  doctorName?: string;
  aiReport?: string;
}) {
  const { patient, assessments, sessions, doctorName, aiReport } = params;

  const pre = assessments.find((a) => a.assessmentType === 'pre');
  const lastPost = assessments.find((a) => a.isLastPost) || [...assessments].reverse().find((a) => a.assessmentType === 'post');

  const preScore = pre?.ndiPercent != null ? `${pre.ndiPercent}%` : 'N/A';
  const postScore = lastPost?.ndiPercent != null ? `${lastPost.ndiPercent}%` : 'N/A';
  const improvement =
    pre?.ndiPercent != null && lastPost?.ndiPercent != null
      ? `${(pre.ndiPercent - lastPost.ndiPercent).toFixed(1)}%`
      : 'N/A';

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  };

  const sessionsRows =
    sessions.length > 0
      ? sessions
          .map((s, idx) => {
            const dayNum = s.dayNumber ?? sessions.length - idx;
            const title = s.displayName || s.poseName || 'Neck Exercise';
            const statusText = s.isFullSession ? 'Full Session ✓' : 'Recorded';
            return `
              <tr>
                <td>Day ${dayNum}</td>
                <td>${title}</td>
                <td>${statusText}</td>
                <td>${formatDuration(s.durationSeconds)}</td>
                <td>${formatDuration(s.holdTimeSeconds)}</td>
                <td><b>${s.averageScore}%</b></td>
                <td>${s.grade}</td>
              </tr>
            `;
          })
          .join('')
      : `<tr><td colspan="7" style="text-align:center;color:#666;">No training sessions recorded yet.</td></tr>`;

  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>NeckPhysioAI Medical Report - ${patient.name}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; line-height: 1.5; padding: 24px; }
    .header { border-bottom: 3px solid #0f766e; padding-bottom: 12px; margin-bottom: 20px; }
    .title { font-size: 22px; font-weight: bold; color: #0f766e; margin: 0; }
    .subtitle { font-size: 13px; color: #475569; margin: 4px 0 0; }
    h2 { font-size: 16px; color: #0f766e; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; margin-top: 22px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
    th { background-color: #f1f5f9; font-weight: bold; color: #0f172a; }
    .info-grid td { width: 50%; }
    .summary-box { background-color: #f8fafc; border: 1px solid #cbd5e1; padding: 12px; margin-top: 10px; }
    .footer { margin-top: 32px; border-top: 1px dashed #94a3b8; padding-top: 12px; font-size: 12px; color: #475569; }
  </style>
</head>
<body>
  <div class="header">
    <p class="title">NeckPhysioAI — Patient Medical Rehabilitation Report</p>
    <p class="subtitle">Generated on ${new Date().toLocaleDateString()} | Supervising Clinician: ${doctorName || 'Physiotherapist'}</p>
  </div>

  <h2>1. Patient Profile</h2>
  <table class="info-grid">
    <tr><td><b>Full Name:</b> ${patient.name}</td><td><b>Email:</b> ${patient.email || '—'}</td></tr>
    <tr><td><b>Age:</b> ${patient.age ? `${patient.age} years` : '—'}</td><td><b>Experience Level:</b> ${patient.experience || 'Beginner'}</td></tr>
    <tr><td><b>Rehabilitation Goal:</b> ${patient.goal || 'Neck Rehabilitation'}</td><td><b>Total Days / Sessions:</b> ${patient.sessionCount ?? sessions.length} Days</td></tr>
    <tr><td colspan="2"><b>Average ROM Rating:</b> ${patient.avgScore != null ? `${patient.avgScore}%` : 'N/A'}</td></tr>
  </table>

  <h2>2. Neck Disability Index (NDI) Assessments</h2>
  <table>
    <thead>
      <tr>
        <th>Pre-Assessment</th>
        <th>Last Post-Assessment</th>
        <th>Clinical Improvement</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><b>${preScore}</b></td>
        <td><b>${postScore}</b></td>
        <td><b>${improvement}</b></td>
      </tr>
    </tbody>
  </table>

  <h2>3. Daily Camera Rehabilitation Sessions</h2>
  <table>
    <thead>
      <tr>
        <th>Day</th>
        <th>Exercise / Session</th>
        <th>Status</th>
        <th>Total Time</th>
        <th>Hold Time</th>
        <th>ROM Score</th>
        <th>Grade</th>
      </tr>
    </thead>
    <tbody>
      ${sessionsRows}
    </tbody>
  </table>

  ${
    aiReport
      ? `<h2>4. Clinical Notes & AI Summary</h2><div class="summary-box">${aiReport.replace(/\n/g, '<br/>')}</div>`
      : ''
  }

  <div class="footer">
    <p><b>Clinician Signature:</b> _______________________________ &nbsp;&nbsp;&nbsp; <b>Date:</b> _______________</p>
    <p>NeckPhysioAI Smart Cervical Rehabilitation System</p>
  </div>
</body>
</html>`;

  const printWin = window.open('', '_blank', 'width=900,height=700');
  if (printWin) {
    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 300);
  } else {
    alert('Please allow popups to download/print the PDF report.');
  }
}
