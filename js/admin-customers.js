/**
 * ADMIN CUSTOMERS
 * Lists every registered guest with their booking count and lifetime
 * spend, and lets staff suspend/reactivate an account.
 */
let ADMIN_CUSTOMERS_CACHE = [];

document.addEventListener("authReady", () => {
  loadAdminCustomers();
  qs("#customerSearchInput")?.addEventListener("input", debounce(applyCustomerFilter, 200));
});

async function loadAdminCustomers() {
  const tbody = qs("#customersTbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="6"><div class="skeleton" style="height:60px;"></div></td></tr>`;

  try {
    const [usersSnap, bookingsSnap] = await Promise.all([
      db.collection(COLLECTIONS.USERS).where("role", "==", ROLES.CUSTOMER).get(),
      db.collection(COLLECTIONS.BOOKINGS).get()
    ]);

    const bookings = bookingsSnap.docs.map((d) => d.data());
    ADMIN_CUSTOMERS_CACHE = usersSnap.docs.map((d) => {
      const user = { id: d.id, ...d.data() };
      const theirBookings = bookings.filter((b) => b.userId === d.id);
      user.bookingCount = theirBookings.length;
      user.totalSpend = theirBookings.filter((b) => ["confirmed", "completed"].includes(b.status)).reduce((s, b) => s + (b.totalPrice || 0), 0);
      return user;
    });

    applyCustomerFilter();
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><h3>Couldn't load customers</h3><p>${escapeHtml(err.message)}</p></div></td></tr>`;
  }
}

function applyCustomerFilter() {
  const q = (qs("#customerSearchInput")?.value || "").toLowerCase().trim();
  const filtered = ADMIN_CUSTOMERS_CACHE.filter((c) => !q || c.fullName?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q));
  renderCustomersTable(filtered);
}

function renderCustomersTable(customers) {
  const tbody = qs("#customersTbody");
  if (!customers.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><h3>No customers found</h3><p>Registered guests will appear here.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = customers.map((c) => `
    <tr>
      <td><div class="cell-user"><span class="cell-avatar">${initials(c.fullName)}</span><div><b>${escapeHtml(c.fullName || "—")}</b><span>${escapeHtml(c.email)}</span></div></div></td>
      <td>${escapeHtml(c.phone || "—")}</td>
      <td>${c.bookingCount}</td>
      <td style="font-family:var(--font-mono);">${formatCurrency(c.totalSpend)}</td>
      <td><span class="badge ${c.status === "suspended" ? "badge-cancelled" : "badge-confirmed"}">${c.status === "suspended" ? "Suspended" : "Active"}</span></td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" title="${c.status === "suspended" ? "Reactivate" : "Suspend"}" onclick="toggleCustomerStatus('${c.id}','${c.status === "suspended" ? "active" : "suspended"}')">
            ${c.status === "suspended" ? checkIcon2() : banIcon()}
          </button>
        </div>
      </td>
    </tr>`).join("");
}

window.toggleCustomerStatus = async function (uid, newStatus) {
  try {
    await db.collection(COLLECTIONS.USERS).doc(uid).update({ status: newStatus, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    showToast(newStatus === "suspended" ? "Account suspended" : "Account reactivated", "", "success");
    loadAdminCustomers();
  } catch (err) {
    showToast("Couldn't update account", err.message, "error");
  }
};

function banIcon() { return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/></svg>'; }
function checkIcon2() { return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6L9 17l-5-5"/></svg>'; }
