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
                <td style="border:1px solid #cbd5e1;padding:4px 6px;">Day ${dayNum}</td>
                <td style="border:1px solid #cbd5e1;padding:4px 6px;">${title}</td>
                <td style="border:1px solid #cbd5e1;padding:4px 6px;">${statusText}</td>
                <td style="border:1px solid #cbd5e1;padding:4px 6px;">${formatDuration(s.durationSeconds)}</td>
                <td style="border:1px solid #cbd5e1;padding:4px 6px;">${formatDuration(s.holdTimeSeconds)}</td>
                <td style="border:1px solid #cbd5e1;padding:4px 6px;"><b>${s.averageScore}%</b></td>
                <td style="border:1px solid #cbd5e1;padding:4px 6px;">${s.grade}</td>
              </tr>
            `;
          })
          .join('')
      : `<tr><td colspan="7" style="border:1px solid #cbd5e1;padding:4px 6px;text-align:center;color:#666;">No training sessions recorded yet.</td></tr>`;

  const html = `
<div id="pdf-root" style="font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;line-height:1.2;padding:16px 20px;background:#ffffff;width:750px;box-sizing:border-box;margin:0 auto;">
  <div style="border-bottom:2px solid #0f766e;padding-bottom:4px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:flex-end;">
    <div>
      <p style="font-size:15px;font-weight:900;color:#0f766e;margin:0;letter-spacing:-0.02em;">NeckPhysioAI — Patient Medical Rehabilitation Report</p>
      <p style="font-size:9.5px;color:#64748b;margin:2px 0 0;">Supervising Clinician: ${doctorName || 'Physiotherapist'}</p>
    </div>
    <div style="text-align:right;">
      <p style="font-size:9.5px;color:#64748b;margin:0;"><b>Report Date:</b> ${new Date().toLocaleDateString()}</p>
    </div>
  </div>

  <h2 style="font-size:11px;font-weight:800;color:#0f766e;border-bottom:1px solid #cbd5e1;padding-bottom:2px;margin:6px 0 3px;text-transform:uppercase;">1. Patient Profile</h2>
  <table style="width:100%;border-collapse:collapse;font-size:9.5px;">
    <tr>
      <td style="border:1px solid #cbd5e1;padding:3px 5px;width:50%;"><b>Full Name:</b> ${patient.name}</td>
      <td style="border:1px solid #cbd5e1;padding:3px 5px;width:50%;"><b>Date:</b> ${new Date().toLocaleDateString()}</td>
    </tr>
    <tr>
      <td style="border:1px solid #cbd5e1;padding:3px 5px;"><b>Age:</b> ${patient.age ? `${patient.age} years` : '—'}</td>
      <td style="border:1px solid #cbd5e1;padding:3px 5px;"><b>Experience Level:</b> ${patient.experience || 'Beginner'}</td>
    </tr>
    <tr>
      <td style="border:1px solid #cbd5e1;padding:3px 5px;"><b>Days Practiced:</b> ${patient.sessionCount ?? sessions.length} Days</td>
      <td style="border:1px solid #cbd5e1;padding:3px 5px;"><b>Sessions:</b> ${patient.sessionCount ?? sessions.length}</td>
    </tr>
    <tr>
      <td colspan="2" style="border:1px solid #cbd5e1;padding:3px 5px;"><b>Average Score:</b> ${patient.avgScore != null ? `${patient.avgScore}%` : 'N/A'}</td>
    </tr>
    <tr>
      <td colspan="2" style="border:1px solid #cbd5e1;padding:3px 5px;"><b>Rehabilitation & Wellness Goal:</b> ${patient.goal || 'Neck Rehabilitation'}</td>
    </tr>
  </table>

  <h2 style="font-size:11px;font-weight:800;color:#0f766e;border-bottom:1px solid #cbd5e1;padding-bottom:2px;margin:6px 0 3px;text-transform:uppercase;">2. Neck Disability Assessments (NDI)</h2>
  <table style="width:100%;border-collapse:collapse;font-size:9.5px;">
    <thead>
      <tr>
        <th style="border:1px solid #cbd5e1;padding:3px 5px;background-color:#f1f5f9;text-align:left;">Pre-Assessment</th>
        <th style="border:1px solid #cbd5e1;padding:3px 5px;background-color:#f1f5f9;text-align:left;">Last Post-Assessment</th>
        <th style="border:1px solid #cbd5e1;padding:3px 5px;background-color:#f1f5f9;text-align:left;">Clinical Improvement</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td style="border:1px solid #cbd5e1;padding:3px 5px;"><b>${preScore}</b></td>
        <td style="border:1px solid #cbd5e1;padding:3px 5px;"><b>${postScore}</b></td>
        <td style="border:1px solid #cbd5e1;padding:3px 5px;"><b>${improvement}</b></td>
      </tr>
    </tbody>
  </table>

  <h2 style="font-size:11px;font-weight:800;color:#0f766e;border-bottom:1px solid #cbd5e1;padding-bottom:2px;margin:6px 0 3px;text-transform:uppercase;">3. Workout Practice Records</h2>
  <table style="width:100%;border-collapse:collapse;font-size:9px;">
    <thead>
      <tr>
        <th style="border:1px solid #cbd5e1;padding:3px 4px;background-color:#f1f5f9;text-align:left;">Day</th>
        <th style="border:1px solid #cbd5e1;padding:3px 4px;background-color:#f1f5f9;text-align:left;">Exercise / Session</th>
        <th style="border:1px solid #cbd5e1;padding:3px 4px;background-color:#f1f5f9;text-align:left;">Status</th>
        <th style="border:1px solid #cbd5e1;padding:3px 4px;background-color:#f1f5f9;text-align:left;">Total Time</th>
        <th style="border:1px solid #cbd5e1;padding:3px 4px;background-color:#f1f5f9;text-align:left;">Hold Time</th>
        <th style="border:1px solid #cbd5e1;padding:3px 4px;background-color:#f1f5f9;text-align:left;">ROM Score</th>
        <th style="border:1px solid #cbd5e1;padding:3px 4px;background-color:#f1f5f9;text-align:left;">Grade</th>
      </tr>
    </thead>
    <tbody>
      ${sessionsRows}
    </tbody>
  </table>

  ${
    aiReport
      ? `<h2 style="font-size:11px;font-weight:800;color:#0f766e;border-bottom:1px solid #cbd5e1;padding-bottom:2px;margin:6px 0 3px;text-transform:uppercase;">4. Clinical Notes & AI Summary</h2><div style="background-color:#f8fafc;border:1px solid #cbd5e1;padding:4px 6px;font-size:9px;max-height:80px;overflow:hidden;">${aiReport.replace(/\n/g, '<br/>')}</div>`
      : ''
  }

  <div style="margin-top:8px;border-top:1px dashed #94a3b8;padding-top:4px;font-size:9px;color:#64748b;display:flex;justify-content:space-between;">
    <p style="margin:0;"><b>Clinician Signature:</b> ___________________________</p>
    <p style="margin:0;">NeckPhysioAI Cervical Rehabilitation System</p>
  </div>
</div>`;

  const fileName = `NeckPhysioAI_Report_${patient.name.replace(/\s+/g, '_')}.pdf`;

  const runHtml2Pdf = () => {
    const html2pdf = (window as any).html2pdf;
    html2pdf()
      .set({
        margin: 10,
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(html)
      .save();
  };

  if ((window as any).html2pdf) {
    runHtml2Pdf();
  } else {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
    script.onload = runHtml2Pdf;
    script.onerror = () => {
      alert('Failed to load PDF generator. Please check your internet connection.');
    };
    document.head.appendChild(script);
  }
}
