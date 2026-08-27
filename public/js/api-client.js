// Wrapper global fetch — tambah X-Changed-By otomatis ke semua request /api/*
// Auth ditangani server via httpOnly session cookie; frontend tidak memegang API key.
// File ini di-load di semua halaman sebelum script lain.

// ── IndexedDB helper (shared, dipakai semua halaman) ─────────────────────────
window.ccsiIdb = (function () {
  const DB_NAME = 'CCSI_Training_v2', DB_VER = 3;
  const STORES = ['mst_employee','mst_competency','trx_certification','trx_training_request'];
  let _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((res, rej) => {
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        ['mst_program','trx_employee_program'].forEach(s => {
          if (db.objectStoreNames.contains(s)) db.deleteObjectStore(s);
        });
        STORES.forEach(s => { if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { autoIncrement: true }); });
      };
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
  const idb = await window.ccsiIdb.getAll('mst_employee').catch(() => []);
  return idb;
};

(function () {
  const USER_STORAGE_KEY = 'ccsi_current_user';

  // ── Inisialisasi sesi user ────────────────────────────────────────────────────
  function getCurrentUser() {
    let user = sessionStorage.getItem(USER_STORAGE_KEY);
    if (!user) {
      user = (prompt('Masukkan nama Anda untuk audit log:\n(akan diingat selama sesi ini)') || '').trim();
      if (!user) user = 'unknown';
      sessionStorage.setItem(USER_STORAGE_KEY, user);
    }
    return user;
  }

  getCurrentUser();

  const _fetch = window.fetch.bind(window);

  // ── Patch window.fetch ────────────────────────────────────────────────────────
  window.fetch = function (url, options = {}) {
    const urlStr = typeof url === 'string' ? url : (url.url || '');
    if (!urlStr.startsWith('/api/')) {
      return _fetch(url, options);
    }

    const headers = new Headers(options.headers || {});
    headers.set('X-Changed-By', sessionStorage.getItem(USER_STORAGE_KEY) || 'unknown');

    return _fetch(url, { ...options, headers });
  };
})();
