/**
 * NAV
 * Runs on every public page. Wires up the mobile menu, the scroll shadow,
 * and swaps the nav's auth area (Log in / Register vs. avatar + logout)
 * based on the live Firebase Auth state.
 */
document.addEventListener("DOMContentLoaded", () => {
  const navbar = qs(".navbar");
  const toggle = qs(".nav-toggle");
  const links = qs(".nav-links");

  window.addEventListener("scroll", () => {
    navbar?.classList.toggle("is-scrolled", window.scrollY > 8);
  });

  toggle?.addEventListener("click", () => {
    links?.classList.toggle("open");
    const expanded = links?.classList.contains("open");
    toggle.setAttribute("aria-expanded", String(!!expanded));
  });

  qsa(".nav-links a").forEach((a) => a.addEventListener("click", () => links?.classList.remove("open")));

  const authArea = qs("#navAuthArea");
  if (!authArea) return;

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      authArea.innerHTML = `
        <a href="login.html" class="btn btn-ghost">Log in</a>
        <a href="register.html" class="btn btn-primary">Book now</a>`;
      // Firebase Auth's LOCAL persistence already syncs sign-out across
      // every open tab of this browser automatically — this callback fires
      // here too the instant another tab calls signOut(), not just on this
      // tab's own logout click. Clean up anything left over from a prior
      // signed-in state so this tab doesn't look logged-in behind the scenes.
      qs("#demoGuideFab")?.remove();
      qs("#demoGuideOverlay")?.remove();
      qs("#navDropdown")?.remove();
      return;
    }

    let profile = { uid: user.uid };
    try {
      const snap = await db.collection(COLLECTIONS.USERS).doc(user.uid).get();
      // snap.data() only returns the document's FIELDS — the document's
      // own ID (the uid) is never included in that, so it's set above
      // instead. Every downstream use of `profile.uid` (the guest
      // message-notification listener, most importantly) was silently
      // getting `undefined` without this, which made Firestore reject the
      // query immediately and do nothing — even if this fetch itself
      // fails, `profile.uid` still needs to survive that.
      if (snap.exists) profile = { ...snap.data(), uid: user.uid };
    } catch (e) {
      console.error("Failed to load profile for nav:", e);
    }

    const name = profile.fullName || user.displayName || user.email;
    const isAdmin = profile.role === ROLES.ADMIN;
    const isDemoAdmin = user.email === DEMO_ACCOUNTS.ADMIN.email;
    const isDemoUser = user.email === DEMO_ACCOUNTS.USER.email;

    // A signed-in visitor should never sit on the public marketing/auth
    // pages — they belong in their own account or admin area. This covers
    // every path that could land here (back button, bookmark, typed URL),
    // not just the moment right after logging in.
    const path = window.location.pathname;
    const isVisitorOnlyPage = /\/(index\.html)?$/.test(path) || path.endsWith("/login.html") || path.endsWith("/register.html");
    if (isVisitorOnlyPage) {
      window.location.replace(isAdmin ? "admin/dashboard.html" : "account.html");
      return;
    }

    // Dropdown links must resolve correctly whether we're on a root page
    // (index.html, account.html…) or a page under /admin/ — a plain
    // "account.html" href 404s from inside /admin/.
    const inAdminFolder = window.location.pathname.includes("/admin/");
    const rootPrefix = inAdminFolder ? "../" : "";
    const adminPrefix = inAdminFolder ? "" : "admin/";

    authArea.innerHTML = `
      <div class="nav-user" id="navUserMenu" style="cursor:pointer; position:relative;">
        <span class="nav-avatar" style="position:relative;">${initials(name)}<span class="nav-avatar-badge hidden" id="navUnreadBadge">0</span></span>
        <span>${escapeHtml((name || "").split(" ")[0])}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
      </div>`;

    const menuBtn = qs("#navUserMenu");
    menuBtn.addEventListener("click", () => {
      let dropdown = qs("#navDropdown");
      if (dropdown) { dropdown.remove(); return; }
      dropdown = document.createElement("div");
      dropdown.id = "navDropdown";
      dropdown.style.cssText = "position:absolute;top:calc(100% + 8px);right:0;background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-lg);min-width:220px;overflow:hidden;z-index:600;";
      dropdown.innerHTML = `
        ${isAdmin ? `<a href="${adminPrefix}dashboard.html" style="display:block;padding:12px 16px;font-size:13.5px;font-weight:500;">Admin dashboard</a>` : ""}
        <a href="${rootPrefix}account.html" style="display:block;padding:12px 16px;font-size:13.5px;font-weight:500;">My account</a>
        <a href="${rootPrefix}account.html#bookings" style="display:block;padding:12px 16px;font-size:13.5px;font-weight:500;">My bookings</a>
        ${(isDemoAdmin || isDemoUser) ? `<button id="navSwitchDemoBtn" style="display:block;width:100%;text-align:left;padding:12px 16px;font-size:13.5px;font-weight:500;color:var(--brass-dark);border-top:1px solid var(--border);">Switch to ${isDemoAdmin ? "Demo Guest" : "Demo Admin"}</button>` : ""}
        <button id="navLogoutBtn" style="display:block;width:100%;text-align:left;padding:12px 16px;font-size:13.5px;font-weight:500;color:var(--wine);border-top:1px solid var(--border);">Log out</button>`;
      menuBtn.appendChild(dropdown);
      qs("#navSwitchDemoBtn")?.addEventListener("click", (e) => {
        e.stopPropagation();
        switchDemoRole(isDemoAdmin);
      });
      qs("#navLogoutBtn").addEventListener("click", async (e) => {
        e.stopPropagation();
        await auth.signOut();
        clearLocalSessionArtifacts();
        showToast("Signed out", "Come back soon.", "success");
        setTimeout(() => (window.location.href = `${rootPrefix}index.html`), 600);
      });
      document.addEventListener("click", function closeOnce(ev) {
        if (!menuBtn.contains(ev.target)) { dropdown.remove(); document.removeEventListener("click", closeOnce); }
      });
    });

    // The demo guide and message-count badge are enhancements, not core
    // navigation — wrapped defensively so a failure in either (e.g. a
    // blocked sessionStorage call in strict private-browsing mode) can
    // never take down the rest of the page's navigation with it.
    try {
      maybeShowDemoGuide(profile, isAdmin);
    } catch (err) {
      console.error("Demo guide failed to render:", err);
    }
    try {
      if (isAdmin) {
        watchOpenMessagesCount();
      } else {
        watchIncomingMessagesForGuest(profile);
      }
    } catch (err) {
      console.error("Message notification listener failed to start:", err);
    }
  });
});

/* ----------------------------------------------------------- DEMO GUIDE */
/**
 * Replaces the old thin dismiss-and-forget banner. This is a proper modal
 * that explains what the demo actually shows and gives a concrete,
 * numbered checklist of things to try — plus a small floating button that
 * stays on screen so the guide can be reopened anytime, on any page.
 */
function maybeShowDemoGuide(profile, isAdmin) {
  if (!profile.isDemo) return;
  injectDemoGuideFab(profile, isAdmin);
  if (sessionStorage.getItem("aurelio_demo_guide_shown")) return;
  sessionStorage.setItem("aurelio_demo_guide_shown", "1");
  openDemoGuide(profile, isAdmin);
}

function injectDemoGuideFab(profile, isAdmin) {
  if (qs("#demoGuideFab")) return;
  const fab = document.createElement("button");
  fab.id = "demoGuideFab";
  fab.className = "demo-guide-fab";
  fab.title = "Demo guide";
  fab.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 015.8 1c0 2-3 2-3 4"/><path d="M12 17h.01"/></svg>`;
  fab.addEventListener("click", () => openDemoGuide(profile, isAdmin));
  document.body.appendChild(fab);
}

function openDemoGuide(profile, isAdmin) {
  let overlay = qs("#demoGuideOverlay");
  if (overlay) overlay.remove();

  const adminChecklist = [
    ["Check availability at a glance", "Open <b>Dashboard</b> to see live occupancy, revenue, and a pending-approvals count."],
    ["Approve a booking", "Go to <b>Bookings</b> — approve, cancel, or mark a stay complete. Try filtering by status."],
    ["Reply to a guest, live", "Open <b>Messages</b> and reply to the open thread — the Demo Guest sees it appear instantly."],
    ["Manage the room catalog", "In <b>Rooms</b>, add a room or upload photos to see the full CRUD + Storage upload flow."],
    ["See it as clients would", "<b>Reports</b> has charted revenue, occupancy, and booking trends — the kind of view a hotel manager checks daily."]
  ];
  const guestChecklist = [
    ["Browse & filter rooms", "From the homepage or <b>Rooms &amp; Suites</b>, filter by guests, price, or keyword."],
    ["Book a room", "Open any room, pick dates, and submit — availability is checked live to prevent double-booking."],
    ["Track it in real time", "Go to <b>My Account → My bookings</b>. If the Demo Admin approves it while you watch, the status updates with no refresh."],
    ["Message the front desk", "Send a message from <b>My Account</b> — try it from two browser tabs (one as each demo account) to see replies arrive live."]
  ];
  const items = isAdmin ? adminChecklist : guestChecklist;

  const roleCompareHtml = `
    <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:var(--space-4) 0;">
      <div style="border:1.5px solid ${!isAdmin ? "var(--brass)" : "var(--border)"}; border-radius:var(--r-md); padding:14px; ${!isAdmin ? "background:var(--brass-tint);" : ""}">
        <b style="font-size:12.5px; text-transform:uppercase; letter-spacing:.04em; color:${!isAdmin ? "var(--brass-dark)" : "var(--ink-soft)"};">Guest ${!isAdmin ? "(you)" : ""}</b>
        <ul style="margin-top:8px; font-size:12.5px; color:var(--ink-soft); line-height:1.9;">
          <li>Browse &amp; book rooms</li>
          <li>View/cancel their own bookings</li>
          <li>Message the front desk</li>
        </ul>
      </div>
      <div style="border:1.5px solid ${isAdmin ? "var(--brass)" : "var(--border)"}; border-radius:var(--r-md); padding:14px; ${isAdmin ? "background:var(--brass-tint);" : ""}">
        <b style="font-size:12.5px; text-transform:uppercase; letter-spacing:.04em; color:${isAdmin ? "var(--brass-dark)" : "var(--ink-soft)"};">Admin ${isAdmin ? "(you)" : ""}</b>
        <ul style="margin-top:8px; font-size:12.5px; color:var(--ink-soft); line-height:1.9;">
          <li>Approve/cancel <b>any</b> guest's booking</li>
          <li>Add, edit &amp; delete rooms</li>
          <li>Reply to guest messages</li>
          <li>View revenue &amp; occupancy reports</li>
        </ul>
      </div>
    </div>`;

  overlay = document.createElement("div");
  overlay.id = "demoGuideOverlay";
  overlay.className = "modal-overlay open";
  overlay.innerHTML = `
    <div class="modal modal-lg">
      <div class="modal-head">
        <h3>${isAdmin ? "Welcome, Demo Admin" : "Welcome, Demo Guest"} 👋</h3>
        <button class="modal-close" id="demoGuideCloseBtn">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
      <div class="modal-body">
        <p class="text-soft" style="font-size:14.5px;">
          ${isAdmin
            ? "This is a live, working hotel back office — not screenshots. Everything you do here is real, but changes are sandboxed to the demo accounts and can be reset anytime."
            : "This is a fully working booking flow — not a mockup. Book a real room and watch it move through approval in real time."}
        </p>
        <p class="text-soft mt-2" style="font-size:13px;">Guest and admin see genuinely different apps — here's the split:</p>
        ${roleCompareHtml}
        <p class="text-soft mt-2" style="font-size:13px;">Here's what's worth trying:</p>
        <ul class="demo-guide-checklist">
          ${items.map((it, i) => `<li><span class="num">${i + 1}</span><div><b>${escapeHtml(it[0])}</b><span>${it[1]}</span></div></li>`).join("")}
        </ul>
        <div class="demo-guide-tip" id="demoGuideEmptyTip">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
          <span id="demoGuideTipText">Checking whether this demo has sample data loaded…</span>
        </div>
        <div class="demo-guide-switch">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 1l4 4-4 4M3 11V9a4 4 0 014-4h14M7 23l-4-4 4-4M21 13v2a4 4 0 01-4 4H3"/></svg>
          <span>Browsers only stay signed in as one account at a time, so to see the other side, click below — it'll sign you out of ${isAdmin ? "Admin" : "Guest"} and into ${isAdmin ? "Guest" : "Admin"} in this same tab.</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" id="demoGuideSwitchBtn">Switch to ${isAdmin ? "Demo Guest" : "Demo Admin"}</button>
        <button class="btn btn-primary" id="demoGuideStartBtn">Start exploring</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  qs("#demoGuideCloseBtn").addEventListener("click", close);
  qs("#demoGuideStartBtn").addEventListener("click", close);
  qs("#demoGuideSwitchBtn").addEventListener("click", () => switchDemoRole(isAdmin));
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

  checkDemoDataPresence(isAdmin);
}

/**
 * Signs out of the current demo account and straight into the other one,
 * landing on a page that shows off that role — the fastest way to explore
 * both sides without needing a second browser or an incognito window.
 */
async function switchDemoRole(isCurrentlyAdmin) {
  const target = isCurrentlyAdmin ? DEMO_ACCOUNTS.USER : DEMO_ACCOUNTS.ADMIN;
  // Landing page must be reachable via a relative URL from wherever the
  // person actually is right now — an admin can browse the public site
  // via "Back to site" while still signed in as admin, so we can't assume
  // "currently admin" always means "currently under /admin/".
  const inAdminFolder = window.location.pathname.includes("/admin/");
  const landingUrl = isCurrentlyAdmin
    ? (inAdminFolder ? "../account.html" : "account.html")
    : (inAdminFolder ? "dashboard.html" : "admin/dashboard.html");
  try {
    showToast("Switching demo role…", "", "info");
    await auth.signOut();
    clearLocalSessionArtifacts();
    await auth.signInWithEmailAndPassword(target.email, target.password);
    window.location.href = landingUrl;
  } catch (err) {
    console.error(err);
    showToast("Couldn't switch roles", err.message, "error");
  }
}

/**
 * Wipes every app-specific localStorage/sessionStorage key (the
 * "aurelio_" prefix keeps this scoped to only our own data, never
 * anything else the browser might be storing). Run on every logout path —
 * the manual "Log out" button and switching demo roles — so no leftover
 * per-account state (an unread-messages timestamp, "seen the demo guide
 * already" flag, etc.) from the PREVIOUS account can bleed into whichever
 * account signs in next in this same browser.
 */
function clearLocalSessionArtifacts() {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith("aurelio_")).forEach((k) => localStorage.removeItem(k));
    Object.keys(sessionStorage).filter((k) => k.startsWith("aurelio_")).forEach((k) => sessionStorage.removeItem(k));
  } catch (err) {
    console.error("Couldn't clear local session artifacts:", err);
  }
}

/** Tells the guide (and the tip line inside it) whether demo data exists yet. */
async function checkDemoDataPresence(isAdmin) {
  const tipEl = qs("#demoGuideTipText");
  const tipWrap = qs("#demoGuideEmptyTip");
  if (!tipEl) return;
  try {
    const snap = await db.collection(COLLECTIONS.ROOMS).limit(1).get();
    if (!snap.empty) { tipWrap.remove(); return; }
    tipEl.innerHTML = isAdmin
      ? 'No rooms yet — this demo is empty. Go to <b>Demo data</b> in the sidebar and click <b>Seed demo data</b> to populate it in one click.'
      : "This demo doesn't have any rooms loaded yet — ask whoever shared this link to seed demo data from the admin panel.";
  } catch (err) {
    tipWrap?.remove();
  }
}

/* ----------------------------------------------- OPEN MESSAGES COUNT BADGE */
/**
 * Runs on every admin page. Does two things with one listener: keeps the
 * sidebar's "awaiting reply" count live, and — the actual real-time
 * notification piece — pops a toast the instant a NEW guest message
 * arrives, even while the admin is looking at Rooms or Bookings instead of
 * Messages. docChanges() from the *first* snapshot are skipped (those are
 * just "here's everything that already existed," not new activity); only
 * "added" changes from snapshots after that count as genuinely new.
 */
function watchOpenMessagesCount() {
  const badge = qs("#sidebarMessagesCount");
  let isFirstSnapshot = true;

  db.collection(COLLECTIONS.MESSAGES).orderBy("createdAt", "desc")
    .onSnapshot((snap) => {
      const seenGuests = new Set();
      let awaitingReply = 0;
      snap.docs.forEach((doc) => {
        const m = doc.data();
        if (seenGuests.has(m.userId)) return;
        seenGuests.add(m.userId);
        if (m.senderRole !== "admin") awaitingReply++;
      });
      if (badge) {
        badge.textContent = awaitingReply > 9 ? "9+" : awaitingReply;
        // .hidden uses display:none !important — an inline style.display
        // can never override that, so toggling the class itself is the
        // only thing that actually works here. (This was the bug: the
        // badge was silently staying hidden forever regardless of count.)
        badge.classList.toggle("hidden", awaitingReply === 0);
      }

      if (!isFirstSnapshot) {
        snap.docChanges().forEach((change) => {
          if (change.type !== "added") return;
          const m = change.doc.data();
          if (m.senderRole === "admin") return; // don't toast our own reply back at us
          const preview = (m.message || "").slice(0, 70);
          showToast(`New message from ${m.userName || "a guest"}`, preview.length < (m.message || "").length ? `${preview}…` : preview, "info");
        });
      }
      isFirstSnapshot = false;
    }, (err) => console.error("Messages count listener error:", err));
}

/**
 * The guest-side counterpart — runs on every public/account page. Does two
 * things in real time: pops a toast the instant a staff reply lands (even
 * while browsing Rooms rather than sitting on My Account), and keeps a
 * persistent numbered badge on the nav avatar showing how many replies are
 * unread — the "(1)" indicator that's visible immediately, not just a
 * toast that can be missed. "Unread" is tracked via a per-account
 * localStorage timestamp that account.js updates the moment the guest
 * actually opens My Account and sees the full thread.
 */
function watchIncomingMessagesForGuest(profile) {
  let isFirstSnapshot = true;
  const avatarBadge = qs("#navUnreadBadge");
  const sidebarBadge = qs("#sidebarMyMessagesCount"); // only present on account.html

  db.collection(COLLECTIONS.MESSAGES).where("userId", "==", profile.uid)
    .onSnapshot((snap) => {
      const lastSeen = localStorage.getItem(`aurelio_messages_seen_${profile.uid}`);
      const lastSeenMs = lastSeen ? new Date(lastSeen).getTime() : 0;
      let unread = 0;
      snap.docs.forEach((doc) => {
        const m = doc.data();
        if (m.senderRole !== "admin") return;
        const at = toJsDate(m.createdAt);
        if (at && at.getTime() > lastSeenMs) unread++;
      });
      const label = unread > 9 ? "9+" : String(unread);
      [avatarBadge, sidebarBadge].forEach((badge) => {
        if (!badge) return;
        badge.textContent = label;
        badge.classList.toggle("hidden", unread === 0);
      });

      if (!isFirstSnapshot) {
        snap.docChanges().forEach((change) => {
          if (change.type !== "added") return;
          const m = change.doc.data();
          if (m.senderRole !== "admin") return; // don't toast the guest's own sent message back at them
          const preview = (m.message || "").slice(0, 70);
          showToast("New reply from the front desk", preview.length < (m.message || "").length ? `${preview}…` : preview, "info");
        });
      }
      isFirstSnapshot = false;
    }, (err) => console.error("Guest message notification listener error:", err));
}
