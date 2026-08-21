/**
 * AUTH PAGE LOGIC
 * Powers login.html, register.html, and forgot-password.html.
 * Each page includes only the form matching its id, so every handler
 * below simply no-ops if its form isn't present on the current page.
 */
document.addEventListener("DOMContentLoaded", () => {
  wireLoginForm();
  wireRegisterForm();
  wireForgotForm();
  wireDemoLoginButtons();
  redirectIfAlreadySignedIn();
});

/**
 * login.html/register.html don't load nav.js (they have no navbar), so
 * they need their own guard: if someone lands here while already
 * authenticated — back button, bookmark, typed URL — send them straight
 * to their account/admin area instead of showing a login form to someone
 * who's already logged in.
 */
function redirectIfAlreadySignedIn() {
  if (!qs("#loginForm") && !qs("#registerForm")) return;
  auth.onAuthStateChanged((user) => {
    if (user) redirectAfterAuth(user.uid, getParam("redirect"));
  });
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Single source of truth for "where does a signed-in person land." Used by
 * every login path (typed credentials, demo buttons, fresh registration)
 * so none of them can ever fall back to index.html — an authenticated
 * visitor always lands in their own account or admin area, never the
 * public marketing homepage.
 * @param {string} uid
 * @param {string|null} explicitRedirect - an explicit ?redirect= target, honored first (e.g. "come back and finish this booking")
 */
async function redirectAfterAuth(uid, explicitRedirect) {
  if (explicitRedirect) {
    window.location.href = explicitRedirect;
    return;
  }
  try {
    const snap = await db.collection(COLLECTIONS.USERS).doc(uid).get();
    const role = snap.exists ? snap.data().role : ROLES.CUSTOMER;
    window.location.href = role === ROLES.ADMIN ? "admin/dashboard.html" : "account.html";
  } catch (err) {
    console.error("Role lookup for redirect failed, defaulting to account.html:", err);
    window.location.href = "account.html";
  }
}

/* ---------------------------------------------------------------- LOGIN */
function wireLoginForm() {
  const form = qs("#loginForm");
  if (!form) return;
  const alertBox = qs("#authAlert");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertBox.classList.add("hidden");

    const email = qs("#loginEmail").value.trim();
    const password = qs("#loginPassword").value;
    const btn = qs("#loginSubmitBtn");

    if (!Validate.email(email) || !Validate.required(password)) {
      alertBox.textContent = "Please enter a valid email and password.";
      alertBox.classList.remove("hidden");
      return;
    }

    setButtonLoading(btn, true, "Signing in…");
    try {
      const cred = await auth.signInWithEmailAndPassword(email, password);
      showToast("Welcome back", "You're signed in.", "success");
      redirectAfterAuth(cred.user.uid, getParam("redirect"));
    } catch (err) {
      alertBox.textContent = friendlyAuthError(err);
      alertBox.classList.remove("hidden");
      setButtonLoading(btn, false);
    }
  });
}

/* ------------------------------------------------------------- REGISTER */
function wireRegisterForm() {
  const form = qs("#registerForm");
  if (!form) return;
  const alertBox = qs("#authAlert");
  const pwInput = qs("#registerPassword");

  pwInput?.addEventListener("input", () => updatePasswordStrength(pwInput.value));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertBox.classList.add("hidden");

    const fullName = qs("#registerName").value.trim();
    const email = qs("#registerEmail").value.trim();
    const phone = qs("#registerPhone").value.trim();
    const password = pwInput.value;
    const btn = qs("#registerSubmitBtn");

    const errors = [];
    if (!Validate.required(fullName)) errors.push("Full name is required.");
    if (!Validate.email(email)) errors.push("Enter a valid email address.");
    if (phone && !Validate.phone(phone)) errors.push("Enter a valid phone number.");
    if (!Validate.password(password)) errors.push("Password must be at least 6 characters.");
    if (!qs("#registerTerms").checked) errors.push("Please accept the terms to continue.");

    if (errors.length) {
      alertBox.textContent = errors[0];
      alertBox.classList.remove("hidden");
      return;
    }

    setButtonLoading(btn, true, "Creating account…");
    try {
      const cred = await auth.createUserWithEmailAndPassword(email, password);
      await cred.user.updateProfile({ displayName: fullName });

      await db.collection(COLLECTIONS.USERS).doc(cred.user.uid).set({
        fullName,
        email,
        phone: phone || "",
        role: ROLES.CUSTOMER,
        status: "active",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      showToast("Account created", `Welcome to Aurelio, ${fullName.split(" ")[0]}.`, "success");
      // A brand-new registration is always role "customer" — no need to
      // round-trip to Firestore to find that out again.
      window.location.href = "account.html";
    } catch (err) {
      alertBox.textContent = friendlyAuthError(err);
      alertBox.classList.remove("hidden");
      setButtonLoading(btn, false);
    }
  });
}

/* ---------------------------------------------------------- DEMO LOGIN */
function wireDemoLoginButtons() {
  const adminBtn = qs("#demoAdminBtn");
  const userBtn = qs("#demoUserBtn");
  if (!adminBtn && !userBtn) return;

  const signInAsDemo = async (account, btn, defaultLandingUrl) => {
    const alertBox = qs("#authAlert");
    alertBox?.classList.add("hidden");
    setButtonLoading(btn, true, "Signing in…");
    try {
      await auth.signInWithEmailAndPassword(account.email, account.password);
      showToast("Welcome to the demo", "Signing you in…", "success");
      // If the person landed on login.html because a protected page (e.g.
      // admin/seed.html) redirected them here — auth-guard.js sets
      // ?redirect= for exactly this case — honor it and send them back to
      // what they actually clicked, instead of always dumping them on the
      // role's generic default landing page.
      const explicitRedirect = getParam("redirect");
      window.location.href = explicitRedirect || defaultLandingUrl;
    } catch (err) {
      setButtonLoading(btn, false);
      if (alertBox) {
        alertBox.textContent = err.code === "auth/invalid-credential" || err.code === "auth/user-not-found"
          ? "Demo accounts haven't been set up on this deployment yet. Visit demo-setup.html once to create them."
          : friendlyAuthError(err);
        alertBox.classList.remove("hidden");
      }
    }
  };

  adminBtn?.addEventListener("click", () => signInAsDemo(DEMO_ACCOUNTS.ADMIN, adminBtn, "admin/dashboard.html"));
  userBtn?.addEventListener("click", () => signInAsDemo(DEMO_ACCOUNTS.USER, userBtn, "account.html"));
}

function updatePasswordStrength(value) {
  const bars = qsa("#passwordStrength span");
  if (!bars.length) return;
  let score = 0;
  if (value.length >= 6) score++;
  if (value.length >= 10) score++;
  if (/[A-Z]/.test(value) && /[0-9]/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  const colors = ["var(--wine)", "var(--wine)", "var(--brass)", "var(--green-status)"];
  bars.forEach((bar, i) => { bar.style.background = i < score ? colors[score - 1] : "var(--border)"; });
}

/* -------------------------------------------------------- FORGOT PASSWORD */
function wireForgotForm() {
  const form = qs("#forgotForm");
  if (!form) return;
  const alertBox = qs("#authAlert");
  const successBox = qs("#forgotSuccess");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    alertBox.classList.add("hidden");
    const email = qs("#forgotEmail").value.trim();
    const btn = qs("#forgotSubmitBtn");

    if (!Validate.email(email)) {
      alertBox.textContent = "Please enter a valid email address.";
      alertBox.classList.remove("hidden");
      return;
    }

    setButtonLoading(btn, true, "Sending…");
    try {
      await auth.sendPasswordResetEmail(email);
      form.classList.add("hidden");
      successBox.classList.remove("hidden");
    } catch (err) {
      alertBox.textContent = friendlyAuthError(err);
      alertBox.classList.remove("hidden");
      setButtonLoading(btn, false);
    }
  });
}
