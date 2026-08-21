/**
 * UTILS
 * Shared, dependency-free helpers used across every page:
 * toast notifications, formatting, validation, and small DOM helpers.
 */

/* ----------------------------------------------------------------------
   TOAST NOTIFICATIONS
   ---------------------------------------------------------------------- */
(function initToastStack() {
  if (document.querySelector(".toast-stack")) return;
  const stack = document.createElement("div");
  stack.className = "toast-stack";
  stack.setAttribute("aria-live", "polite");
  document.body.appendChild(stack);
})();

const ICONS = {
  success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg>',
  error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v5M12 16h.01"/></svg>',
  warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/></svg>',
  info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>'
};

/**
 * Show a toast notification.
 * @param {string} title
 * @param {string} [message]
 * @param {'success'|'error'|'warning'|'info'} [type]
 */
function showToast(title, message = "", type = "info") {
  const stack = document.querySelector(".toast-stack");
  if (!stack) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${ICONS[type] || ICONS.info}</span>
    <div class="toast-body"><strong>${escapeHtml(title)}</strong>${message ? `<p>${escapeHtml(message)}</p>` : ""}</div>
    <button class="toast-close" aria-label="Dismiss notification">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg>
    </button>`;
  stack.appendChild(toast);
  const remove = () => {
    toast.classList.add("leaving");
    setTimeout(() => toast.remove(), 220);
  };
  toast.querySelector(".toast-close").addEventListener("click", remove);
  setTimeout(remove, 5200);
}

/* ----------------------------------------------------------------------
   FORMATTERS
   ---------------------------------------------------------------------- */
function formatCurrency(amount, currency = "USD") {
  return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount || 0);
}

function formatDate(date, opts = { month: "short", day: "numeric", year: "numeric" }) {
  const d = date instanceof Date ? date : toJsDate(date);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", opts);
}

function formatDateShort(date) {
  return formatDate(date, { month: "short", day: "numeric" });
}

function formatDateTime(date) {
  const d = date instanceof Date ? date : toJsDate(date);
  if (!d) return "—";
  return `${formatDate(d)} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

/** Convert a Firestore Timestamp, ISO string, or Date into a JS Date. */
function toJsDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  const parsed = new Date(value);
  return isNaN(parsed) ? null : parsed;
}

/** Number of nights between two date strings/Dates (YYYY-MM-DD safe). */
function nightsBetween(checkIn, checkOut) {
  const inD = toJsDate(checkIn);
  const outD = toJsDate(checkOut);
  if (!inD || !outD) return 0;
  const ms = outD.setHours(0, 0, 0, 0) - inD.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round(ms / 86400000));
}

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function addDaysISO(isoDate, days) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

/** Generate a human-friendly booking confirmation code, e.g. AUR-4F82-K9. */
function generateBookingCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const rand = (n) => Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `AUR-${rand(4)}-${rand(2)}`;
}

function initials(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("") || "?";
}

function escapeHtml(str = "") {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function capitalize(str = "") {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function badgeClassForStatus(status) {
  return { pending: "badge-pending", confirmed: "badge-confirmed", cancelled: "badge-cancelled", completed: "badge-completed" }[status] || "badge-pending";
}

/* ----------------------------------------------------------------------
   VALIDATION
   ---------------------------------------------------------------------- */
const Validate = {
  email(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  },
  phone(value) {
    return /^[+]?[\d\s().-]{7,20}$/.test(value.trim());
  },
  password(value) {
    return value.length >= 6;
  },
  required(value) {
    return value !== undefined && value !== null && String(value).trim().length > 0;
  }
};

/** Attach a live error state to a .field wrapper. */
function setFieldError(fieldEl, message) {
  if (!fieldEl) return;
  fieldEl.classList.add("has-error");
  const errEl = fieldEl.querySelector(".error-text");
  if (errEl) errEl.textContent = message;
}
function clearFieldError(fieldEl) {
  if (!fieldEl) return;
  fieldEl.classList.remove("has-error");
}

/* ----------------------------------------------------------------------
   MISC HELPERS
   ---------------------------------------------------------------------- */
function debounce(fn, wait = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function qs(sel, root = document) { return root.querySelector(sel); }
function qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function setButtonLoading(btn, isLoading, loadingText = "Please wait…") {
  if (!btn) return;
  if (isLoading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> ${loadingText}`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.originalText || btn.innerHTML;
    btn.disabled = false;
  }
}

function hideAppLoader() {
  const loader = document.querySelector(".page-loader");
  if (loader) setTimeout(() => loader.classList.add("hidden"), 200);
}

/** Friendly text for common Firebase Auth error codes. */
function friendlyAuthError(error) {
  const map = {
    "auth/email-already-in-use": "That email is already registered. Try logging in instead.",
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/user-not-found": "No account found with that email.",
    "auth/wrong-password": "Incorrect password. Please try again.",
    "auth/invalid-credential": "Incorrect email or password.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/network-request-failed": "Network error. Check your connection and try again.",
    "auth/popup-closed-by-user": "Sign-in window was closed before completing."
  };
  return map[error?.code] || error?.message || "Something went wrong. Please try again.";
}
