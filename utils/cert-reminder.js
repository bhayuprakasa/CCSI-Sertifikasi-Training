/**
 * Certification Expiry Reminder Scheduler
 *
 * Logika pengiriman:
 * - Kirim email untuk sertifikasi yang sudah memasuki window H-days_before
 *   ATAU sudah lewat tanggal expired
 * - Terus kirim selama renewal_action masih kosong (belum diisi
 *   "Sudah Perpanjang" atau "Tidak Perpanjang")
 * - Interval pengiriman diatur lewat cfg_reminder_setting
 *   (interval_value + frequency: hari/minggu/bulan)
 * - Tracking kapan terakhir dikirim disimpan di tabel cfg_cert_reminder_log
 */

const pool = require('../db');

// ── Helper: hitung jumlah hari dari interval + frequency ─────────────────────
function intervalToDays(intervalValue, frequency) {
  switch (frequency) {
    case 'minggu': return intervalValue * 7;
    case 'bulan':  return intervalValue * 30;
    default:       return intervalValue; // 'hari'
  }
}

// ── Bangun HTML email reminder ────────────────────────────────────────────────
function buildReminderHtml(certs, today) {
  const MONTHS = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus',
                  'September','Oktober','November','Desember'];

  function fmtDate(dateStr) {
    if (!dateStr) return '-';
    const d = (dateStr + '').split('T')[0].split('-');
    return `${parseInt(d[2])} ${MONTHS[parseInt(d[1]) - 1]} ${d[0]}`;
  }

  function diffDays(expStr) {
    const exp = new Date(expStr);
    exp.setHours(0, 0, 0, 0);
    const now = new Date(today);
    now.setHours(0, 0, 0, 0);
    return Math.round((exp - now) / 86400000);
  }

  const rows = certs.map(c => {
    const diff  = diffDays(c.expiry_date);
    const label = diff < 0
      ? `<span style="color:#d63031;font-weight:700">EXPIRED ${Math.abs(diff)} hari lalu</span>`
      : `<span style="color:${diff <= 30 ? '#d63031' : '#f39c12'};font-weight:700">H-${diff}</span>`;

    return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f3f6;font-size:13px">${c.full_name}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f3f6;font-size:13px;color:#64748b">${c.department}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f3f6;font-size:13px">${c.sertif_name}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f3f6;font-size:13px">${fmtDate(c.expiry_date)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f3f6;text-align:center">${label}</td>
      </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="id"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f3f8;font-family:'Segoe UI',Arial,sans-serif">
<div style="max-width:680px;margin:0 auto;padding:24px 16px">

  <!-- Header -->
  <div style="background:#1a3c6e;border-radius:10px 10px 0 0;padding:20px 24px;display:flex;align-items:center;gap:14px">
    <div style="background:#e8a020;border-radius:6px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.85rem;color:#12294d;flex-shrink:0">CCSI</div>
    <div>
      <div style="color:#fff;font-size:1.05rem;font-weight:700">⏰ Reminder Sertifikasi Expired</div>
      <div style="color:rgba(255,255,255,.7);font-size:.78rem;margin-top:2px">PT Communication Cable Systems Indonesia</div>
    </div>
  </div>

  <!-- Banner -->
  <div style="background:#fff8e6;border:1px solid #f5d57e;border-top:none;padding:12px 24px;font-size:.83rem;color:#7a4f00;line-height:1.5">
    ⚠️ Terdapat <strong>${certs.length} sertifikasi</strong> yang belum diperpanjang dan memerlukan tindakan segera.
    Email ini akan terus dikirim secara otomatis hingga kolom <strong>Aksi Perpanjangan</strong> diisi di sistem.
  </div>

  <!-- Tabel -->
  <div style="background:#fff;border:1px solid #dde3ec;border-top:none;border-radius:0 0 10px 10px;overflow:hidden">
    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:#f8fafd">
          <th style="padding:10px 14px;text-align:left;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;border-bottom:2px solid #dde3ec">Nama Karyawan</th>
          <th style="padding:10px 14px;text-align:left;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;border-bottom:2px solid #dde3ec">Departemen</th>
          <th style="padding:10px 14px;text-align:left;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;border-bottom:2px solid #dde3ec">Nama Sertifikasi</th>
          <th style="padding:10px 14px;text-align:left;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;border-bottom:2px solid #dde3ec">Tanggal Expired</th>
          <th style="padding:10px 14px;text-align:center;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#64748b;border-bottom:2px solid #dde3ec">Status</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>

    <div style="padding:16px 24px;font-size:.8rem;color:#64748b;border-top:1px solid #f0f3f6;line-height:1.6">
      Untuk menghentikan reminder ini, buka sistem CCSI Training → tab <strong>Sertifikasi</strong> →
      isi kolom <strong>Aksi Perpanjangan</strong> dengan <em>"Sudah Perpanjang"</em> atau <em>"Tidak Perpanjang"</em>.
    </div>
  </div>

  <div style="text-align:center;margin-top:16px;font-size:.72rem;color:#94a3b8">
    Email ini dikirim otomatis oleh sistem CCSI Training · ${fmtDate(today)}
  </div>
</div>
</body></html>`;
}

// ── Kirim email reminder via sendGenericEmail (Graph atau SMTP otomatis) ──────
async function sendReminderEmail(toEmail, certs, today) {
  const { sendGenericEmail } = require('./mailer');
  const html    = buildReminderHtml(certs, today);
  const subject = `[Reminder] ${certs.length} Sertifikasi Memerlukan Perpanjangan`;
  await sendGenericEmail(toEmail, subject, html);
}

// ── Cek apakah sertifikat ini sudah dikirim dalam interval yang ditentukan ────
async function wasRecentlySent(certId, intervalDays) {
  const [rows] = await pool.query(
    `SELECT sent_at FROM cfg_cert_reminder_log
     WHERE cert_id = ?
     ORDER BY sent_at DESC LIMIT 1`,
    [certId]
  );
  if (!rows.length) return false;
  const lastSent  = new Date(rows[0].sent_at);
  const nowMs     = Date.now();
  const diffDays  = (nowMs - lastSent.getTime()) / 86400000;
  return diffDays < intervalDays;
}

// ── Catat pengiriman ke log ───────────────────────────────────────────────────
async function logSent(certId) {
  await pool.query(
    'INSERT INTO cfg_cert_reminder_log (cert_id, sent_at) VALUES (?, NOW())',
    [certId]
  );
}

// ── Job utama: cek sertifikasi & kirim reminder ───────────────────────────────
async function runCertReminderJob() {
  try {
    // 1. Baca konfigurasi reminder
    const [cfgRows] = await pool.query(
      'SELECT interval_value, frequency, days_before FROM cfg_reminder_setting LIMIT 1'
    );
    if (!cfgRows.length) return; // belum dikonfigurasi

    const { interval_value, frequency, days_before } = cfgRows[0];
    const intervalDays = intervalToDays(interval_value, frequency);

    // 2. Baca email tujuan (HRD)
    const [hrdRows] = await pool.query(
      'SELECT email FROM cfg_approver_hrd ORDER BY id DESC LIMIT 1'
    );
    if (!hrdRows.length || !hrdRows[0].email) return; // email belum diatur

    const toEmail = hrdRows[0].email;
    const today   = new Date().toISOString().split('T')[0];

    // 3. Ambil sertifikasi yang:
    //    - Tidak seumur hidup (is_lifetime = 0)
    //    - Masih aktif (is_active = 1)
    //    - expiry_date sudah masuk window H-days_before ATAU sudah lewat expired
    //    - renewal_action KOSONG (belum ada aksi perpanjangan)
    const [certs] = await pool.query(
      `SELECT c.cert_id, c.sertif_name, c.expiry_date, c.renewal_action,
              e.full_name, e.department
       FROM trx_certification c
       LEFT JOIN mst_employee e ON c.employee_id = e.employee_id
       WHERE c.is_lifetime = 0
         AND c.is_active   = 1
         AND c.expiry_date IS NOT NULL
         AND DATE(c.expiry_date) <= DATE_ADD(CURDATE(), INTERVAL ? DAY)
         AND (c.renewal_action IS NULL OR c.renewal_action = '')`,
      [days_before]
    );

    if (!certs.length) return;

    // 4. Filter: hanya sertifikat yang belum dikirim dalam interval
    const toSend = [];
    for (const c of certs) {
      const skip = await wasRecentlySent(c.cert_id, intervalDays);
      if (!skip) toSend.push(c);
    }

    if (!toSend.length) return;

    // 5. Kirim 1 email berisi semua sertifikasi yang perlu diingatkan
    await sendReminderEmail(toEmail, toSend, today);

    // 6. Catat setiap cert ke log
    for (const c of toSend) {
      await logSent(c.cert_id);
    }

    console.log(`[CertReminder] Terkirim ke ${toEmail}: ${toSend.length} sertifikasi`);
  } catch (err) {
    console.error('[CertReminder] Error:', err.message);
  }
}

// ── Start scheduler — cek setiap hari sekali (jam 08:00 WIB / 01:00 UTC) ─────
function startCertReminderScheduler() {
  // Jalankan sekali saat startup (dengan delay 30 detik agar DB siap)
  setTimeout(runCertReminderJob, 30_000);

  // Hitung delay ke jam 01:00 UTC berikutnya (= 08:00 WIB)
  function scheduleNextRun() {
    const now  = new Date();
    const next = new Date(now);
    next.setUTCHours(1, 0, 0, 0);
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    const delay = next - now;
    setTimeout(() => {
      runCertReminderJob();
      // Re-schedule untuk hari berikutnya
      setInterval(runCertReminderJob, 24 * 60 * 60 * 1000);
    }, delay);
  }

  scheduleNextRun();
  console.log('[CertReminder] Scheduler aktif — cek harian jam 08:00 WIB');
}

module.exports = { startCertReminderScheduler, runCertReminderJob };
