const nodemailer = require('nodemailer');

// ── Email settings cache ──────────────────────────────────────────────────────
let _settingsCache = {};
let _settingsCacheAt = 0;
const SETTINGS_TTL = 5 * 60 * 1000; // 5 menit

async function getEmailSettings(layer) {
  const now = Date.now();
  if (now - _settingsCacheAt < SETTINGS_TTL && _settingsCache[layer]) {
    return _settingsCache[layer];
  }
  try {
    const pool = require('../db');
    const [rows] = await pool.query('SELECT * FROM cfg_email_settings WHERE layer = ?', [layer]);
    if (rows.length) {
      _settingsCache[layer] = rows[0];
      _settingsCacheAt = now;
      return rows[0];
    }
  } catch { /* tabel belum ada — pakai default */ }
  return null;
}

function applySubjectTemplate(template, request) {
  if (!template) return null;
  return template
    .replace(/\{training_name\}/g, request.training_name || '')
    .replace(/\{department\}/g,    request.department    || '')
    .replace(/\{request_id\}/g,    request.request_id    || '');
}

function parseCcList(ccStr) {
  if (!ccStr) return [];
  return ccStr.split(',').map(e => e.trim()).filter(Boolean);
}

// ── Email log (in-memory, max 200 entri) ─────────────────────────────────────
const emailLog = [];
function addLog(entry) {
  emailLog.unshift({ ...entry, timestamp: new Date().toISOString() });
  if (emailLog.length > 200) emailLog.pop();
}
function getEmailLog() { return emailLog; }

// ── Microsoft Graph API sender ────────────────────────────────────────────────
async function getGraphToken() {
  const tenantId     = process.env.GRAPH_TENANT_ID;
  const clientId     = process.env.GRAPH_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET;

  const resp = await fetch(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type:    'client_credentials',
        client_id:     clientId,
        client_secret: clientSecret,
        scope:         'https://graph.microsoft.com/.default',
      }),
    }
  );
  const data = await resp.json();
  if (!data.access_token) {
    throw new Error('Gagal dapat token Graph: ' + (data.error_description || JSON.stringify(data)));
  }
  return data.access_token;
}

async function sendViaGraph(toEmail, subject, html, { senderName, ccEmails, replyTo } = {}) {
  const senderEmail = process.env.SMTP_USER;
  const token = await getGraphToken();

  const ccRecipients = (ccEmails || []).map(addr => ({ emailAddress: { address: addr } }));

  const message = {
    subject,
    body:         { contentType: 'HTML', content: html },
    toRecipients: [{ emailAddress: { address: toEmail } }],
    from:         { emailAddress: { address: senderEmail, name: senderName || 'CCSI Training' } },
  };
  if (ccRecipients.length) message.ccRecipients = ccRecipients;
  if (replyTo) message.replyTo = [{ emailAddress: { address: replyTo } }];

  const resp = await fetch(
    `https://graph.microsoft.com/v1.0/users/${senderEmail}/sendMail`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message, saveToSentItems: false }),
    }
  );

  if (resp.status !== 202) {
    const err = await resp.json().catch(() => ({}));
    throw new Error('Graph API error: ' + (err.error?.message || resp.status));
  }
}

// ── SMTP sender (fallback) ────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtRp = n => (!n || n == 0) ? 'Rp 0' : 'Rp ' + Number(n).toLocaleString('id-ID');
const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function fmtDate(dateStr) {
  if (!dateStr) return '-';
  const d = (dateStr + '').split('T')[0].split('-');
  if (d.length < 2) return dateStr;
  return `${MONTHS[parseInt(d[1]) - 1]} ${d[0]}`;
}

function row(icon, label, value, highlight) {
  const valStyle = highlight
    ? 'padding:10px 14px;border:1px solid #dde3ec;font-weight:700;font-size:13px;color:#1a3c6e'
    : 'padding:10px 14px;border:1px solid #dde3ec;color:#1e293b;font-size:13px';
  return `<tr>
    <td style="padding:10px 12px;background:#f0f4fa;border:1px solid #dde3ec;text-align:center;width:36px;font-size:15px">${icon}</td>
    <td style="padding:10px 14px;background:#f8fafd;font-weight:600;color:#475569;width:34%;border:1px solid #dde3ec;font-size:13px">${label}</td>
    <td style="${valStyle}">${value}</td>
  </tr>`;
}

// ── Main send function ────────────────────────────────────────────────────────
async function sendApprovalEmail({ request, token, participants, approver }) {
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const approveUrl = `${appUrl}/api/training-requests/approve/${token}`;
  const rejectUrl  = `${appUrl}/api/training-requests/reject/${token}`;

  const approverName = approver?.name || 'Yth. Bapak/Ibu';
  const approverPos  = approver?.position || 'Direksi';
  const toEmail      = approver?.email;

  const gt = request.score_grand_total;
  const gtColor = gt >= 32 ? '#00a86b' : gt > 0 ? '#d63031' : '#64748b';
  const gtLabel = gt ? `${gt}/64 &nbsp;${gt >= 32 ? '<span style="color:#00a86b">✅ Memenuhi Syarat</span>' : '<span style="color:#d63031">❌ Belum Memenuhi Syarat</span>'}` : '<span style="color:#94a3b8">—</span>';

  const costItems = [
    ['Training Fee',   request.cost_training_fee],
    ['Akomodasi',      request.cost_akomodasi],
    ['Transport',      request.cost_transport],
    ['Makan',          request.cost_makan],
    ['Snack',          request.cost_snack],
    ['Emergency Cash', request.cost_emergency],
  ].filter(([, v]) => v > 0);

  const costRows = costItems.map(([label, val]) =>
    `<tr><td style="padding:5px 12px;color:#64748b;font-size:12px;border-bottom:1px solid #f0f3f6">${label}</td><td style="padding:5px 12px;text-align:right;font-size:12px;border-bottom:1px solid #f0f3f6">${fmtRp(val)}</td></tr>`
  ).join('');

  const participantList = (participants || [])
    .map((p, i) => `<tr><td style="padding:5px 12px;color:#1e293b;font-size:12px;border-bottom:1px solid #f0f3f6">${i + 1}. ${p}</td></tr>`)
    .join('');

  const isScheduled = request.is_scheduled ? '✅ Terjadwal' : '⬜ Tidak Terjadwal';

  const html = `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f3f8;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:28px auto;font-size:14px">
<tr><td>

  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a3c6e;border-radius:12px 12px 0 0">
    <tr>
      <td width="56" style="padding:16px 0 16px 20px;vertical-align:middle">
        <div style="background:#e8a020;border-radius:8px;width:40px;height:40px;text-align:center;line-height:40px;font-weight:800;font-size:10px;color:#12294d;letter-spacing:-.5px">CCSI</div>
      </td>
      <td style="padding:16px 20px 16px 12px;vertical-align:middle">
        <div style="color:#ffffff;font-size:15px;font-weight:700;margin:0">Permohonan Persetujuan Pelatihan</div>
        <div style="color:#a0b4d0;font-size:11px;margin-top:3px">PT Communication Cable Systems Indonesia</div>
      </td>
    </tr>
  </table>

  <!-- Banner -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e6;border-left:4px solid #e8a020;border-right:1px solid #f0d080">
    <tr><td style="padding:11px 18px;font-size:13px;color:#7a4f00;font-weight:600">
      ⏳ &nbsp;Menunggu persetujuan Anda — tindakan Anda diperlukan untuk melanjutkan proses ini.
    </td></tr>
  </table>

  <!-- Body -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #dde3ec;border-top:none">
  <tr><td style="padding:24px">

    <p style="margin:0 0 4px;color:#1e293b;font-size:15px;font-weight:600">Halo, ${approverName}</p>
    <p style="margin:0 0 4px;color:#64748b;font-size:12px">${approverPos}</p>
    <p style="margin:14px 0 20px;color:#475569;font-size:13px;line-height:1.8">
      Terdapat <strong>permohonan pelatihan baru</strong> dari <strong>${request.department}</strong> yang memerlukan
      persetujuan Anda. Berikut adalah rinciannya:
    </p>

    <!-- Section: Ringkasan Pelatihan -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr>
        <td colspan="3" style="background:#1a3c6e;color:#fff;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;padding:9px 14px;border-radius:6px 6px 0 0">
          📋 &nbsp;DETAIL PELATIHAN
        </td>
      </tr>
      ${row('📚', 'Nama Pelatihan', `<strong>${request.training_name}</strong>`, true)}
      ${row('🏢', 'Departemen Pengaju', request.department)}
      ${row('👤', 'Diajukan Oleh', request.submitted_by || '<em style="color:#94a3b8">—</em>')}
      ${row('🎯', 'Jenis Pelatihan', request.training_type === 'Internal'
        ? '<span style="background:#e8eef7;color:#1a3c6e;border-radius:4px;padding:2px 8px;font-size:12px;font-weight:600">Internal</span>'
        : '<span style="background:#f4ecf7;color:#6c3483;border-radius:4px;padding:2px 8px;font-size:12px;font-weight:600">Eksternal</span>')}
      ${row('🏛️', 'Penyelenggara', request.organizer || '<em style="color:#94a3b8">—</em>')}
      ${row('📍', 'Tempat Pelaksanaan', request.training_venue || '<em style="color:#94a3b8">—</em>')}
      ${row('📅', 'Target Pelaksanaan', fmtDate(request.training_date_start))}
      ${row('🗓️', 'Status Rencana', isScheduled)}
      ${row('💬', 'Alasan / Tujuan', request.training_reason || '<em style="color:#94a3b8">—</em>')}
    </table>

    <!-- Section: Peserta -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr>
        <td style="background:#1a3c6e;color:#fff;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;padding:9px 14px;border-radius:6px 6px 0 0">
          👥 &nbsp;PESERTA (${(participants || []).length} orang)
        </td>
      </tr>
      <tr>
        <td style="padding:0;border:1px solid #dde3ec;border-top:none;background:#f8fafd;border-radius:0 0 6px 6px">
          <table style="width:100%;border-collapse:collapse">
            ${participantList || '<tr><td style="padding:10px 14px;color:#94a3b8;font-size:12px">—</td></tr>'}
          </table>
        </td>
      </tr>
    </table>

    <!-- Section: Biaya -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr>
        <td colspan="2" style="background:#1a3c6e;color:#fff;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;padding:9px 14px;border-radius:6px 6px 0 0">
          💰 &nbsp;RINCIAN BIAYA
        </td>
      </tr>
      ${costRows || '<tr><td colspan="2" style="padding:10px 14px;color:#94a3b8;font-size:12px;border:1px solid #dde3ec;border-top:none">Tidak ada rincian biaya</td></tr>'}
      <tr>
        <td style="padding:10px 14px;background:#1a3c6e;color:#fff;font-weight:700;font-size:13px;border-radius:0 0 0 6px">Total Biaya</td>
        <td style="padding:10px 14px;background:#1a3c6e;color:#fff;font-weight:800;font-size:14px;text-align:right;border-radius:0 0 6px 0">${fmtRp(request.cost_total)}</td>
      </tr>
    </table>

    <!-- Section: Skor Kelayakan -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr>
        <td colspan="2" style="background:#1a3c6e;color:#fff;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;padding:9px 14px;border-radius:6px 6px 0 0">
          📊 &nbsp;SKOR KELAYAKAN PELATIHAN
        </td>
      </tr>
      <tr>
        <td style="padding:14px 18px;border:1px solid #dde3ec;border-top:none;background:#f8fafd;width:80px;text-align:center;border-radius:0 0 0 6px">
          <div style="font-size:30px;font-weight:800;color:${gtColor};line-height:1">${gt || '—'}</div>
          <div style="font-size:11px;color:#64748b;margin-top:3px">Grand Total</div>
        </td>
        <td style="padding:14px 18px;border:1px solid #dde3ec;border-top:none;border-left:none;background:#f8fafd;border-radius:0 0 6px 0">
          <div style="font-size:13px;margin-bottom:4px">${gtLabel}</div>
          <div style="font-size:11px;color:#94a3b8">Batas kelayakan: ≥ 32 dari 64 poin</div>
        </td>
      </tr>
    </table>

    <!-- CTA Buttons -->
    <div style="background:#f0f8f4;border:1px solid #a7e8cc;border-radius:10px;padding:20px 24px;text-align:center;margin-bottom:18px">
      <p style="margin:0 0 4px;font-weight:700;color:#1e293b;font-size:14px">Tindakan Diperlukan</p>
      <p style="margin:0 0 16px;font-size:12px;color:#64748b">Mohon tinjau permohonan ini dan berikan keputusan Anda melalui tombol di bawah ini:</p>
      <table style="margin:0 auto">
        <tr>
          <td style="padding:0 6px">
            <a href="${approveUrl}" style="display:inline-block;background:#00a86b;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">✔ &nbsp;SETUJUI</a>
          </td>
          <td style="padding:0 6px">
            <a href="${rejectUrl}" style="display:inline-block;background:#d63031;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">✖ &nbsp;TOLAK</a>
          </td>
        </tr>
      </table>
      <p style="margin:12px 0 0;font-size:11px;color:#94a3b8">Silakan berikan alasan jika Anda menolak.</p>
    </div>

    <p style="font-size:11px;color:#94a3b8;margin:0;text-align:center;line-height:1.8">
      Email ini dikirim otomatis oleh sistem CCSI Training Dashboard.<br>
      Jangan membalas email ini. Jika ada pertanyaan, hubungi HR secara langsung.<br>
      No. Permohonan: <strong>#${request.request_id}</strong>
    </p>

  </td></tr></table>

  <!-- Footer -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafd;border:1px solid #dde3ec;border-top:none;border-radius:0 0 12px 12px">
    <tr><td style="padding:12px 24px;text-align:center">
      <span style="font-size:11px;color:#94a3b8">Terima kasih, &nbsp;<strong>Sistem HR Otomatis — CCSI Training</strong></span>
    </td></tr>
  </table>

</td></tr></table>
</body>
</html>`;

  const cfg = await getEmailSettings('dept');
  const defaultSubject = `[Persetujuan Diperlukan] Pelatihan: ${request.training_name} — ${request.department}`;
  const subject = applySubjectTemplate(cfg?.subject_template, request) || defaultSubject;
  const ccEmails = parseCcList(cfg?.cc_emails);
  const senderName = cfg?.sender_name || 'CCSI Training';
  const replyTo  = cfg?.reply_to || null;

  const logBase = {
    to: toEmail,
    approver_name: approverName,
    subject,
    training_name: request.training_name,
    department:    request.department,
    request_id:    request.request_id,
  };

  const useGraph = !!(process.env.GRAPH_TENANT_ID && process.env.GRAPH_CLIENT_ID && process.env.GRAPH_CLIENT_SECRET);

  try {
    if (useGraph) {
      await sendViaGraph(toEmail, subject, html, { senderName, ccEmails, replyTo });
    } else {
      await transporter.sendMail({
        from:    process.env.SMTP_FROM || `"${senderName}" <${process.env.SMTP_USER}>`,
        to:      toEmail,
        cc:      ccEmails.join(', ') || undefined,
        replyTo: replyTo || undefined,
        subject,
        html,
      });
    }
    addLog({ ...logBase, status: 'success', method: useGraph ? 'Graph API' : 'SMTP' });
  } catch (err) {
    addLog({ ...logBase, status: 'failed', error: err.message, method: useGraph ? 'Graph API' : 'SMTP' });
    throw err;
  }
}

// ── HRD Director approval email (layer 2) ────────────────────────────────────
async function sendHrdApprovalEmail({ request, token, participants, approver }) {
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const approveUrl = `${appUrl}/api/training-requests/approve-hrd/${token}`;
  const rejectUrl  = `${appUrl}/api/training-requests/reject-hrd/${token}`;

  const approverName = approver?.name || 'Yth. Direktur HRD';
  const approverPos  = approver?.position || 'Direktur HRD';
  const toEmail      = approver?.email;

  const gt = request.score_grand_total;
  const gtColor = gt >= 32 ? '#00a86b' : gt > 0 ? '#d63031' : '#64748b';
  const gtLabel = gt ? `${gt}/64 &nbsp;${gt >= 32 ? '<span style="color:#00a86b">✅ Memenuhi Syarat</span>' : '<span style="color:#d63031">❌ Belum Memenuhi Syarat</span>'}` : '<span style="color:#94a3b8">—</span>';

  const costItems = [
    ['Training Fee',   request.cost_training_fee],
    ['Akomodasi',      request.cost_akomodasi],
    ['Transport',      request.cost_transport],
    ['Makan',          request.cost_makan],
    ['Snack',          request.cost_snack],
    ['Emergency Cash', request.cost_emergency],
  ].filter(([, v]) => v > 0);

  const costRows = costItems.map(([label, val]) =>
    `<tr><td style="padding:5px 12px;color:#64748b;font-size:12px;border-bottom:1px solid #f0f3f6">${label}</td><td style="padding:5px 12px;text-align:right;font-size:12px;border-bottom:1px solid #f0f3f6">${fmtRp(val)}</td></tr>`
  ).join('');

  const participantList = (participants || [])
    .map((p, i) => `<tr><td style="padding:5px 12px;color:#1e293b;font-size:12px;border-bottom:1px solid #f0f3f6">${i + 1}. ${p}</td></tr>`)
    .join('');

  const isScheduled = request.is_scheduled ? '✅ Terjadwal' : '⬜ Tidak Terjadwal';

  const html = `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f3f8;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:28px auto;font-size:14px">
<tr><td>

  <!-- Header -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a3c6e;border-radius:12px 12px 0 0">
    <tr>
      <td width="56" style="padding:16px 0 16px 20px;vertical-align:middle">
        <div style="background:#e8a020;border-radius:8px;width:40px;height:40px;text-align:center;line-height:40px;font-weight:800;font-size:10px;color:#12294d;letter-spacing:-.5px">CCSI</div>
      </td>
      <td style="padding:16px 20px 16px 12px;vertical-align:middle">
        <div style="color:#ffffff;font-size:15px;font-weight:700;margin:0">Persetujuan Akhir — Direktur HRD</div>
        <div style="color:#a0b4d0;font-size:11px;margin-top:3px">PT Communication Cable Systems Indonesia</div>
      </td>
    </tr>
  </table>

  <!-- Banner -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#e8f4fd;border-left:4px solid #1a3c6e;border-right:1px solid #b8d4f0">
    <tr><td style="padding:11px 18px;font-size:13px;color:#0c2a52;font-weight:600">
      ✅ &nbsp;Disetujui oleh Direktur Departemen — menunggu persetujuan akhir Anda sebagai Direktur HRD.
    </td></tr>
  </table>

  <!-- Body -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid #dde3ec;border-top:none">
  <tr><td style="padding:24px">

    <p style="margin:0 0 4px;color:#1e293b;font-size:15px;font-weight:600">Halo, ${approverName}</p>
    <p style="margin:0 0 4px;color:#64748b;font-size:12px">${approverPos}</p>
    <p style="margin:14px 0 20px;color:#475569;font-size:13px;line-height:1.8">
      Permohonan pelatihan dari <strong>${request.department}</strong> telah disetujui oleh Direktur Departemen.
      Diperlukan <strong>persetujuan akhir Anda</strong> untuk menyelesaikan proses ini. Berikut adalah rinciannya:
    </p>

    <!-- Section: Detail Pelatihan -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr>
        <td colspan="3" style="background:#1a3c6e;color:#fff;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;padding:9px 14px;border-radius:6px 6px 0 0">
          📋 &nbsp;DETAIL PELATIHAN
        </td>
      </tr>
      ${row('📚', 'Nama Pelatihan', `<strong>${request.training_name}</strong>`, true)}
      ${row('🏢', 'Departemen Pengaju', request.department)}
      ${row('👤', 'Diajukan Oleh', request.submitted_by || '<em style="color:#94a3b8">—</em>')}
      ${row('🎯', 'Jenis Pelatihan', request.training_type === 'Internal'
        ? '<span style="background:#e8eef7;color:#1a3c6e;border-radius:4px;padding:2px 8px;font-size:12px;font-weight:600">Internal</span>'
        : '<span style="background:#f4ecf7;color:#6c3483;border-radius:4px;padding:2px 8px;font-size:12px;font-weight:600">Eksternal</span>')}
      ${row('🏛️', 'Penyelenggara', request.organizer || '<em style="color:#94a3b8">—</em>')}
      ${row('📍', 'Tempat Pelaksanaan', request.training_venue || '<em style="color:#94a3b8">—</em>')}
      ${row('📅', 'Target Pelaksanaan', fmtDate(request.training_date_start))}
      ${row('🗓️', 'Status Rencana', isScheduled)}
      ${row('💬', 'Alasan / Tujuan', request.training_reason || '<em style="color:#94a3b8">—</em>')}
    </table>

    <!-- Section: Peserta -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr>
        <td style="background:#1a3c6e;color:#fff;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;padding:9px 14px;border-radius:6px 6px 0 0">
          👥 &nbsp;PESERTA (${(participants || []).length} orang)
        </td>
      </tr>
      <tr>
        <td style="padding:0;border:1px solid #dde3ec;border-top:none;background:#f8fafd;border-radius:0 0 6px 6px">
          <table style="width:100%;border-collapse:collapse">
            ${participantList || '<tr><td style="padding:10px 14px;color:#94a3b8;font-size:12px">—</td></tr>'}
          </table>
        </td>
      </tr>
    </table>

    <!-- Section: Biaya -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <tr>
        <td colspan="2" style="background:#1a3c6e;color:#fff;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;padding:9px 14px;border-radius:6px 6px 0 0">
          💰 &nbsp;RINCIAN BIAYA
        </td>
      </tr>
      ${costRows || '<tr><td colspan="2" style="padding:10px 14px;color:#94a3b8;font-size:12px;border:1px solid #dde3ec;border-top:none">Tidak ada rincian biaya</td></tr>'}
      <tr>
        <td style="padding:10px 14px;background:#1a3c6e;color:#fff;font-weight:700;font-size:13px;border-radius:0 0 0 6px">Total Biaya</td>
        <td style="padding:10px 14px;background:#1a3c6e;color:#fff;font-weight:800;font-size:14px;text-align:right;border-radius:0 0 6px 0">${fmtRp(request.cost_total)}</td>
      </tr>
    </table>

    <!-- Section: Skor Kelayakan -->
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
      <tr>
        <td colspan="2" style="background:#1a3c6e;color:#fff;font-size:11px;font-weight:700;letter-spacing:.8px;text-transform:uppercase;padding:9px 14px;border-radius:6px 6px 0 0">
          📊 &nbsp;SKOR KELAYAKAN PELATIHAN
        </td>
      </tr>
      <tr>
        <td style="padding:14px 18px;border:1px solid #dde3ec;border-top:none;background:#f8fafd;width:80px;text-align:center;border-radius:0 0 0 6px">
          <div style="font-size:30px;font-weight:800;color:${gtColor};line-height:1">${gt || '—'}</div>
          <div style="font-size:11px;color:#64748b;margin-top:3px">Grand Total</div>
        </td>
        <td style="padding:14px 18px;border:1px solid #dde3ec;border-top:none;border-left:none;background:#f8fafd;border-radius:0 0 6px 0">
          <div style="font-size:13px;margin-bottom:4px">${gtLabel}</div>
          <div style="font-size:11px;color:#94a3b8">Batas kelayakan: ≥ 32 dari 64 poin</div>
        </td>
      </tr>
    </table>

    <!-- CTA Buttons -->
    <div style="background:#f0f8f4;border:1px solid #a7e8cc;border-radius:10px;padding:20px 24px;text-align:center;margin-bottom:18px">
      <p style="margin:0 0 4px;font-weight:700;color:#1e293b;font-size:14px">Tindakan Diperlukan</p>
      <p style="margin:0 0 16px;font-size:12px;color:#64748b">Mohon tinjau permohonan ini dan berikan keputusan akhir Anda melalui tombol di bawah ini:</p>
      <table style="margin:0 auto">
        <tr>
          <td style="padding:0 6px">
            <a href="${approveUrl}" style="display:inline-block;background:#00a86b;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">✔ &nbsp;SETUJUI</a>
          </td>
          <td style="padding:0 6px">
            <a href="${rejectUrl}" style="display:inline-block;background:#d63031;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px">✖ &nbsp;TOLAK</a>
          </td>
        </tr>
      </table>
      <p style="margin:12px 0 0;font-size:11px;color:#94a3b8">Silakan berikan alasan jika Anda menolak.</p>
    </div>

    <p style="font-size:11px;color:#94a3b8;margin:0;text-align:center;line-height:1.8">
      Email ini dikirim otomatis oleh sistem CCSI Training Dashboard.<br>
      Jangan membalas email ini. Jika ada pertanyaan, hubungi HR secara langsung.<br>
      No. Permohonan: <strong>#${request.request_id}</strong>
    </p>

  </td></tr></table>

  <!-- Footer -->
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafd;border:1px solid #dde3ec;border-top:none;border-radius:0 0 12px 12px">
    <tr><td style="padding:12px 24px;text-align:center">
      <span style="font-size:11px;color:#94a3b8">Terima kasih, &nbsp;<strong>Sistem HR Otomatis — CCSI Training</strong></span>
    </td></tr>
  </table>

</td></tr></table>
</body>
</html>`;

  const cfg = await getEmailSettings('hrd');
  const defaultSubject = `[Persetujuan HRD] Pelatihan: ${request.training_name} — ${request.department}`;
  const subject = applySubjectTemplate(cfg?.subject_template, request) || defaultSubject;
  const ccEmails = parseCcList(cfg?.cc_emails);
  const senderName = cfg?.sender_name || 'CCSI Training';
  const replyTo  = cfg?.reply_to || null;

  const logBase = {
    to: toEmail,
    approver_name: approverName,
    subject,
    training_name: request.training_name,
    department:    request.department,
    request_id:    request.request_id,
  };

  const useGraph = !!(process.env.GRAPH_TENANT_ID && process.env.GRAPH_CLIENT_ID && process.env.GRAPH_CLIENT_SECRET);

  try {
    if (useGraph) {
      await sendViaGraph(toEmail, subject, html, { senderName, ccEmails, replyTo });
    } else {
      await transporter.sendMail({
        from:    process.env.SMTP_FROM || `"${senderName}" <${process.env.SMTP_USER}>`,
        to:      toEmail,
        cc:      ccEmails.join(', ') || undefined,
        replyTo: replyTo || undefined,
        subject,
        html,
      });
    }
    addLog({ ...logBase, status: 'success', method: useGraph ? 'Graph API' : 'SMTP' });
  } catch (err) {
    addLog({ ...logBase, status: 'failed', error: err.message, method: useGraph ? 'Graph API' : 'SMTP' });
    throw err;
  }
}

function isEmailConfigured() {
  const hasSmtp  = !!process.env.SMTP_HOST;
  const hasGraph = !!(process.env.GRAPH_TENANT_ID && process.env.GRAPH_CLIENT_ID && process.env.GRAPH_CLIENT_SECRET);
  return hasSmtp || hasGraph;
}

function invalidateEmailSettingsCache() {
  _settingsCache = {};
  _settingsCacheAt = 0;
}

module.exports = { sendApprovalEmail, sendHrdApprovalEmail, getEmailLog, isEmailConfigured, invalidateEmailSettingsCache };
