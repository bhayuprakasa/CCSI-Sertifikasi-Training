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
 * - Email direkap per email tujuan:
 *   - Dept head tiap departemen → menerima rekap sertifikasi dept-nya saja
 *   - HRD (cfg_approver_hrd) → menerima rekap semua sertifikasi
 */

const pool = require('../db');

// ── Helper: konversi interval + frequency ke jumlah hari ─────────────────────
function intervalToDays(intervalValue, frequency) {
  switch (frequency) {
    case 'minggu': return intervalValue * 7;
    case 'bulan':  return intervalValue * 30;
    default:       return intervalValue; // 'hari'
  }
}

// ── Helper: format tanggal YYYY-MM-DD → DD-MM-YYYY ───────────────────────────
function fmtDate(dateStr) {
  if (!dateStr) return '-';
  const d = (dateStr + '').split('T')[0].split('-');
  if (d.length < 3) return dateStr;
  return `${d[0]}-${d[1]}-${d[2]}`; // tetap format YYYY-MM-DD agar konsisten dengan screenshot
}

// ── Bangun HTML email reminder sesuai template screenshot ────────────────────
// recipientName: nama penerima email (dept head atau HRD)
// certs: array sertifikasi yang perlu diingatkan
function buildReminderHtml(certs, recipientName) {
  const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  const formUrl = `${appUrl}/permohonan-pelatihan.html`;

  // Baris tabel untuk setiap sertifikasi
  const rows = certs.map(c => `
    <tr>
      <td style="padding:10px 14px;border:1px solid #c8d0dc;font-size:13px;color:#1e293b">${c.full_name || '-'}</td>
      <td style="padding:10px 14px;border:1px solid #c8d0dc;font-size:13px;color:#1e293b">${c.sertif_name || '-'}</td>
      <td style="padding:10px 14px;border:1px solid #c8d0dc;font-size:13px;color:#1e293b;white-space:nowrap">${fmtDate(c.issue_date)}</td>
      <td style="padding:10px 14px;border:1px solid #c8d0dc;font-size:13px;color:#1e293b;white-space:nowrap">${fmtDate(c.expiry_date)}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="id">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0f3f8;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:24px 16px">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#ffffff;border:1px solid #dde3ec;border-radius:8px;overflow:hidden">

  <!-- Header -->
  <tr>
    <td style="background:#1a3c6e;padding:16px 24px">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="46" style="vertical-align:middle">
            <div style="background:#e8a020;border-radius:6px;width:38px;height:38px;text-align:center;line-height:38px;font-weight:800;font-size:9px;color:#12294d;letter-spacing:-.5px">CCSI</div>
          </td>
          <td style="padding-left:12px;vertical-align:middle">
            <div style="color:#ffffff;font-size:15px;font-weight:700">Reminder Sertifikasi</div>
            <div style="color:rgba(255,255,255,.7);font-size:11px;margin-top:2px">PT Communication Cable Systems Indonesia</div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Body -->
  <tr>
    <td style="padding:28px 32px">

      <!-- Greeting -->
      <p style="margin:0 0 16px;font-size:14px;font-weight:700;color:#1e293b">Selamat Pagi Bapak/Ibu ${recipientName},</p>
      <p style="margin:0 0 20px;font-size:13px;color:#475569;line-height:1.7">
        Berikut kami sampaikan daftar sertifikasi karyawan bapak/ibu yang sudah memasuki tanggal expired.
      </p>

      <!-- Tabel Sertifikasi -->
      <div style="overflow-x:auto;margin-bottom:24px">
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;min-width:480px">
          <thead>
            <tr style="background:#1a3c6e">
              <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:700;color:#ffffff;border:1px solid #2a5298">Nama Karyawan</th>
              <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:700;color:#ffffff;border:1px solid #2a5298">Nama Sertifikasi</th>
              <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:700;color:#ffffff;border:1px solid #2a5298;white-space:nowrap">Masa Berlaku Mulai</th>
              <th style="padding:10px 14px;text-align:left;font-size:12px;font-weight:700;color:#ffffff;border:1px solid #2a5298;white-space:nowrap">Masa Berlaku Hingga</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      </div>

      <!-- CTA -->
      <p style="margin:0 0 6px;font-size:13px;color:#1e293b;font-weight:700;line-height:1.7">
        Dimohon untuk segera memberikan informasi tindaklanjut dari daftar tersebut.
        Jika sertifikasi diperpanjang, maka bapak/ibu dapat men-submit form berikut ini :
      </p>
      <p style="margin:0 0 28px">
        <a href="${formUrl}" style="color:#1a3c6e;font-size:13px;word-break:break-all">${formUrl}</a>
      </p>

      <!-- Penutup -->
      <p style="margin:0;font-size:13px;color:#1e293b;line-height:1.8">
        Best Regards,<br>
        <strong>HR Department &ndash; PT CCSI</strong>
      </p>

    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#f8fafd;border-top:1px solid #dde3ec;padding:10px 24px;text-align:center">
      <span style="font-size:11px;color:#94a3b8">Email ini dikirim otomatis oleh sistem CCSI Training</span>
    </td>
  </tr>

</table>
</td></tr></table>
</body>
</html>`;
}

// ── Bangun subject dari template dengan mengganti semua placeholder ────────────
// department: nama departemen penerima (dept head) atau string fallback untuk HRD
async function buildSubject(certs, department) {
  const [rows] = await pool.query(
    "SELECT subject_template FROM cfg_email_settings WHERE layer = 'cert' LIMIT 1"
  );
  const tpl = rows[0]?.subject_template;
  if (!tpl) {
    // fallback jika belum dikonfigurasi
    return `[Reminder] ${certs.length} Sertifikasi Karyawan Memasuki Tanggal Expired`;
  }
  const first = certs[0] || {};
  // Hitung days_left dari cert pertama (bisa negatif jika sudah lewat)
  const daysLeft = first.expiry_date
    ? Math.ceil((new Date(first.expiry_date) - new Date()) / 86400000)
    : '';
  return tpl
    .replace(/{employee_name}/g, first.full_name || '')
    .replace(/{cert_name}/g,     first.sertif_name || '')
    .replace(/{expiry_date}/g,   first.expiry_date ? fmtDate(first.expiry_date) : '')
    .replace(/{days_left}/g,     daysLeft)
    .replace(/{department}/g,    department || '');
}

// ── Kirim email reminder via sendGenericEmail (Graph atau SMTP otomatis) ──────
async function sendReminderEmail(toEmail, recipientName, certs, department) {
  const { sendGenericEmail } = require('./mailer');
  const html    = buildReminderHtml(certs, recipientName);
  const subject = await buildSubject(certs, department);
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
  const lastSent = new Date(rows[0].sent_at);
  const diffDays = (Date.now() - lastSent.getTime()) / 86400000;
  return diffDays < intervalDays;
}

// ── Catat pengiriman ke log ───────────────────────────────────────────────────
async function logSent(certId) {
  await pool.query(
    'INSERT INTO cfg_cert_reminder_log (cert_id, sent_at) VALUES (?, NOW())',
    [certId]
  );
}

// ── Job utama: cek sertifikasi & kirim reminder per email tujuan ──────────────
async function runCertReminderJob() {
  try {
    // 1. Baca konfigurasi reminder
    const [cfgRows] = await pool.query(
      'SELECT interval_value, frequency, days_before FROM cfg_reminder_setting LIMIT 1'
    );
    if (!cfgRows.length) return; // belum dikonfigurasi

    const { interval_value, frequency, days_before } = cfgRows[0];
    const intervalDays = intervalToDays(interval_value, frequency);

    // 2. Ambil sertifikasi yang perlu direminder beserta issue_date dan dept employee
    const [certs] = await pool.query(
      `SELECT c.cert_id, c.sertif_name, c.expiry_date, c.issue_date, c.renewal_action,
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

    // 3. Filter: hanya sertifikat yang belum dikirim dalam interval
    const toSend = [];
    for (const c of certs) {
      const skip = await wasRecentlySent(c.cert_id, intervalDays);
      if (!skip) toSend.push(c);
    }
    if (!toSend.length) return;

    // 4. Ambil semua dept head yang punya email (untuk menentukan penerima per dept)
    const [deptHeads] = await pool.query(
      `SELECT full_name, email, department
       FROM mst_employee
       WHERE is_dept_head = 1
         AND email IS NOT NULL
         AND email != ''
         AND is_active = 1`
    );
    // Map: department → { name, email }
    const deptHeadMap = {};
    for (const dh of deptHeads) {
      deptHeadMap[dh.department] = { name: dh.full_name, email: dh.email };
    }

    // 5. Ambil email HRD sebagai penerima rekap semua sertifikasi
    const [hrdRows] = await pool.query(
      'SELECT email FROM cfg_approver_hrd ORDER BY id DESC LIMIT 1'
    );
    const hrdEmail = hrdRows[0]?.email || null;

    // 6. Grouping: kumpulkan sertifikasi per email tujuan
    //    { emailAddr: { name: '...', certs: [...] } }
    const recipientMap = {};

    for (const cert of toSend) {
      const deptHead = deptHeadMap[cert.department];

      // Kirim ke dept head departemen karyawan (jika ada emailnya)
      if (deptHead?.email) {
        if (!recipientMap[deptHead.email]) {
          // simpan department agar bisa dipakai di placeholder {department}
          recipientMap[deptHead.email] = { name: deptHead.name, department: cert.department, certs: [] };
        }
        recipientMap[deptHead.email].certs.push(cert);
      }

      // Kirim rekap ke HRD (semua cert, tidak diaklus jika sudah masuk dept head yg sama)
      if (hrdEmail) {
        if (!recipientMap[hrdEmail]) {
          recipientMap[hrdEmail] = { name: 'HR Department', department: 'HR', certs: [] };
        }
        // Hindari duplikat cert yang sama di satu recipient
        const alreadyAdded = recipientMap[hrdEmail].certs.some(c => c.cert_id === cert.cert_id);
        if (!alreadyAdded) {
          recipientMap[hrdEmail].certs.push(cert);
        }
      }
    }

    // 7. Kirim email ke masing-masing penerima
    for (const [email, { name, department, certs: recipientCerts }] of Object.entries(recipientMap)) {
      if (!recipientCerts.length) continue;
      await sendReminderEmail(email, name, recipientCerts, department);
      console.log(`[CertReminder] Terkirim ke ${email} (${name}): ${recipientCerts.length} sertifikasi`);
    }

    // 8. Catat log pengiriman untuk setiap cert yang dikirim
    for (const c of toSend) {
      await logSent(c.cert_id);
    }

  } catch (err) {
    console.error('[CertReminder] Error:', err.message);
  }
}

// ── Start scheduler — cek setiap hari sekali (jam 08:00 WIB / 01:00 UTC) ─────
function startCertReminderScheduler() {
  // Jalankan sekali saat startup dengan delay 30 detik agar DB siap
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
