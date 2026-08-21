/**
 * AUTH GUARD
 * Include on any page that must be protected. Set the page-level flags
 * BEFORE this script runs:
 *   <script>const REQUIRE_AUTH = true; const REQUIRE_ADMIN = false;</script>
 *
 * While Firebase resolves the auth state, the full-page loader (added by
 * each protected page's markup) stays visible so protected content never
 * flashes for an instant before the redirect happens.
 */
(function () {
  const requireAuth = typeof REQUIRE_AUTH !== "undefined" ? REQUIRE_AUTH : false;
  const requireAdmin = typeof REQUIRE_ADMIN !== "undefined" ? REQUIRE_ADMIN : false;

  window.currentUserProfile = null;

  auth.onAuthStateChanged(async (user) => {
    if (!requireAuth && !requireAdmin) return;

    if (!user) {
      // Preserve the admin/ prefix in the redirect target — a bare
      // filename like "seed.html" 404s once we're back at the root-level
      // login page, since admin pages actually live at "admin/seed.html".
      const filename = window.location.pathname.split("/").pop();
      const redirectTarget = requireAdmin ? `admin/${filename}` : filename;
      const redirect = encodeURIComponent(redirectTarget);
      window.location.href = `${requireAdmin ? "../" : ""}login.html?redirect=${redirect}`;
      return;
    }

    try {
      const snap = await db.collection(COLLECTIONS.USERS).doc(user.uid).get();
      const profile = snap.exists ? snap.data() : {};
      window.currentUserProfile = { uid: user.uid, email: user.email, ...profile };

      if (requireAdmin && profile.role !== ROLES.ADMIN) {
        showToast("Access denied", "This area is for hotel staff only.", "error");
        // Go straight to the signed-in customer's own area — never bounce
        // through index.html first. A logged-in visitor should never see
        // the public marketing homepage at any point in any flow.
        window.location.href = "../account.html";
        return;
      }

      document.dispatchEvent(new CustomEvent("authReady", { detail: window.currentUserProfile }));
      hideAppLoader();
    } catch (err) {
      console.error("Auth guard error:", err);
      hideAppLoader();
    }
  });
})();
