// Wrapper global fetch — tambah X-API-Key dan X-Changed-By otomatis ke semua request /api/*
// File ini di-load di semua halaman sebelum script lain.

// ── IndexedDB helper (shared, dipakai semua halaman) ─────────────────────────
// Buka DB yang sama dengan index.html tanpa upgrade agar tidak konflik.
window.ccsiIdb = (function () {
  const DB_NAME = 'CCSI_Training_v2', DB_VER = 1;
  let _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onsuccess = e => { _db = e.target.result; res(_db); };
      req.onerror  = e => rej(e);
      req.onblocked = () => rej(new Error('IDB blocked'));
    });
  }

  function getAll(store) {
    return open().then(db => new Promise((res, rej) => {
      try {
        const req = db.transaction(store, 'readonly').objectStore(store).getAll();
        req.onsuccess = () => res(req.result || []);
        req.onerror   = () => rej(req.error);
      } catch(e) { rej(e); }
    }));
  }

  return { getAll };
})();

// ── loadEmployees: MySQL dulu, fallback ke IndexedDB jika kosong/gagal ───────
window.loadEmployeesWithFallback = async function () {
  try {
    const res = await fetch('/api/employees');
    if (res.ok) {
      const api = await res.json();
      if (api.length > 0) return api;
    }
  } catch (_) {}
  // Fallback: baca dari IndexedDB
  const idb = await window.ccsiIdb.getAll('mst_employee').catch(() => []);
  return idb;
};

(function () {
  const API_KEY = 'fe3eb92d6397054ea317d6fc0ec6d73569de2667865cb380b849394569894755';
  const USER_STORAGE_KEY = 'ccsi_current_user';

  // ── Inisialisasi sesi user ────────────────────────────────────────────────────
  // Minta nama user satu kali per sesi browser; simpan di sessionStorage
  function getCurrentUser() {
    let user = sessionStorage.getItem(USER_STORAGE_KEY);
    if (!user) {
      user = (prompt('Masukkan nama Anda untuk audit log:\n(akan diingat selama sesi ini)') || '').trim();
      if (!user) user = 'unknown';
      sessionStorage.setItem(USER_STORAGE_KEY, user);
    }
    return user;
  }

  // Panggil sekali agar prompt muncul saat halaman pertama dibuka
  getCurrentUser();

  // ── Patch window.fetch ────────────────────────────────────────────────────────
  const _fetch = window.fetch.bind(window);

  window.fetch = function (url, options = {}) {
    // Hanya tambahkan header ke request /api/...
    const urlStr = typeof url === 'string' ? url : (url.url || '');
    if (!urlStr.startsWith('/api/')) {
      return _fetch(url, options);
    }

    // Approval link routes (GET /api/training-requests/approve/*) tidak butuh API key
    // tapi tidak ada harm mengirimnya juga — server mengizinkan kedua cara
    const headers = new Headers(options.headers || {});
    headers.set('X-API-Key', API_KEY);
    headers.set('X-Changed-By', sessionStorage.getItem(USER_STORAGE_KEY) || 'unknown');

    return _fetch(url, { ...options, headers });
  };
})();
