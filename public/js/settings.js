/**
 * public/js/settings.js
 * Loads store-wide settings from /api/settings on every page load.
 * Applies: theme, logo, currency, contact info.
 *
 * Settings come from Firestore (via backend) so they are the same
 * on every device and browser — not from localStorage.
 */

import { setCurrency } from './currency.js';

/**
 * Fetch settings from the backend and apply them to the page.
 * Called once on DOMContentLoaded before anything else renders.
 */
export async function loadAndApplySettings() {
  try {
    const res  = await fetch('/api/settings');
    if (!res.ok) return;
    const data = await res.json();

    // 1. Theme
    if (data.theme) {
      document.documentElement.classList.toggle('light-theme', data.theme === 'light');
      localStorage.setItem('tg_theme', data.theme);
    }

    // 2. Currency + PHP rate
    if (data.phpRate) {
      localStorage.setItem('tg_php_rate', data.phpRate);
    }
    if (data.currency) {
      setCurrency(data.currency);
    }

    // 3. Logo
    if (data.logoUrl) {
      localStorage.setItem('tg_logo_url', data.logoUrl);
      applyLogo(data.logoUrl);
    }

    // 4. Contact info (used by modal inquiry/call buttons)
    if (data.contactPhone) localStorage.setItem('tg_contact_phone', data.contactPhone);
    if (data.contactEmail) localStorage.setItem('tg_contact_email', data.contactEmail);

  } catch {
    // Silently fall back to localStorage values (offline / API error)
  }
}

function applyLogo(url) {
  const img      = document.getElementById('storeLogo');
  const initials = document.querySelector('.logo-initials');
  if (!img || !url) return;
  img.src           = url;
  img.hidden        = false;
  if (initials) initials.style.display = 'none';
}
