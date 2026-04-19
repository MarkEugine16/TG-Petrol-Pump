import { apiLogin, apiVerify, apiLogout } from './api.js';

const TOKEN_KEY = 'tg_admin_token';

function isLoginPage() {
  return document.getElementById('loginForm') !== null;
}

function isDashboard() {
  return document.getElementById('sidebarEmail') !== null;
}

// ── Session check ──────────────────────────────────────────
async function checkSession() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) return null;

  try {
    const data = await apiVerify();
    return data.valid ? data.admin : null;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
}

// ── Login page logic ───────────────────────────────────────
function initLoginPage() {
  // If already logged in, redirect to dashboard
  checkSession().then(admin => {
    if (admin) window.location.href = '/admin/dashboard.html';
  });

  const form   = document.getElementById('loginForm');
  const errEl  = document.getElementById('loginError');
  const btn    = document.getElementById('loginBtn');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPass').value;

    // Client-side validation
    if (!email || !password) {
      showError('Please enter your email and password.');
      return;
    }

    btn.disabled    = true;
    btn.innerHTML   = '<span class="spinner"></span> Signing in…';
    errEl.hidden    = true;

    try {
      const data = await apiLogin(email, password);
      localStorage.setItem(TOKEN_KEY, data.token);
      window.location.href = '/admin/dashboard.html';
    } catch (err) {
      showError(err.message || 'Login failed. Please try again.');
      btn.disabled  = false;
      btn.innerHTML = 'Sign In →';
    }
  });

  function showError(msg) {
    errEl.textContent = msg;
    errEl.hidden      = false;
  }
}

// ── Dashboard auth logic ───────────────────────────────────
function initDashboardAuth() {
  // Guard: redirect to login if not authenticated
  checkSession().then(admin => {
    if (!admin) {
      window.location.href = '/admin/login.html';
      return;
    }
    // Show admin email in sidebar
    const emailEl = document.getElementById('sidebarEmail');
    if (emailEl) emailEl.textContent = admin.email;
  });

  // Logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try { await apiLogout(); } catch { /* best effort */ }
      localStorage.removeItem(TOKEN_KEY);
      window.location.href = '/admin/login.html';
    });
  }
}

// ── Boot ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (isLoginPage())  initLoginPage();
  if (isDashboard())  initDashboardAuth();
});
