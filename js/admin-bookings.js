/**
 * ADMIN BOOKINGS
 * Lists every reservation with status filters + search, and lets staff
 * approve (pending → confirmed), cancel, or mark a stay completed.
 */
let ADMIN_BOOKINGS_CACHE = [];

document.addEventListener("authReady", () => {
  loadAdminBookings();
  wireBookingFilters();
  preselectStatusFromUrl();
});

/** Honors a ?status=pending (etc.) URL param, e.g. from the dashboard's "Pending approval" stat card link. */
function preselectStatusFromUrl() {
  const status = new URLSearchParams(window.location.search).get("status");
  if (!status) return;
  const tab = qs(`.panel-tab[data-status="${status}"]`);
  if (!tab) return;
  qsa(".panel-tab[data-status]").forEach((t) => t.classList.remove("active"));
  tab.classList.add("active");
}

async function loadAdminBookings() {
  const tbody = qs("#bookingsTbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7"><div class="skeleton" style="height:60px;"></div></td></tr>`;

  try {
    const snap = await db.collection(COLLECTIONS.BOOKINGS).orderBy("createdAt", "desc").get();
    ADMIN_BOOKINGS_CACHE = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    applyBookingFilters();
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><h3>Couldn't load bookings</h3><p>${escapeHtml(err.message)}</p></div></td></tr>`;
  }
}

function wireBookingFilters() {
  qsa(".panel-tab[data-status]").forEach((tab) => tab.addEventListener("click", () => {
    qsa(".panel-tab[data-status]").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    applyBookingFilters();
  }));
  qs("#bookingSearchInput")?.addEventListener("input", debounce(applyBookingFilters, 200));
}

function applyBookingFilters() {
  const status = qs(".panel-tab[data-status].active")?.dataset.status || "all";
  const query = (qs("#bookingSearchInput")?.value || "").toLowerCase().trim();

  const filtered = ADMIN_BOOKINGS_CACHE.filter((b) => {
    const matchStatus = status === "all" || b.status === status;
    const matchQuery = !query || b.userName?.toLowerCase().includes(query) || b.userEmail?.toLowerCase().includes(query) || b.bookingCode?.toLowerCase().includes(query) || b.roomNumber?.toLowerCase().includes(query);
    return matchStatus && matchQuery;
  });
  renderBookingsTable(filtered);
}

function renderBookingsTable(bookings) {
  const tbody = qs("#bookingsTbody");
  if (!bookings.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><h3>No bookings found</h3><p>Try a different filter or search term.</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = bookings.map((b) => `
    <tr>
      <td><span style="font-family:var(--font-mono); font-size:12.5px;">${b.bookingCode}</span></td>
      <td><div class="cell-user"><span class="cell-avatar">${initials(b.userName)}</span><div><b>${escapeHtml(b.userName)}</b><span>${escapeHtml(b.userEmail)}</span></div></div></td>
      <td>${escapeHtml(b.roomType)} · ${escapeHtml(b.roomNumber)}</td>
      <td>${formatDateShort(b.checkIn)} – ${formatDateShort(b.checkOut)}</td>
      <td style="font-family:var(--font-mono);">${formatCurrency(b.totalPrice)}</td>
      <td><span class="badge ${badgeClassForStatus(b.status)}">${capitalize(b.status)}</span></td>
      <td>
        <div class="row-actions">
          ${b.status === BOOKING_STATUS.PENDING ? `<button class="icon-btn" title="Approve" onclick="updateBookingStatus('${b.id}','${BOOKING_STATUS.CONFIRMED}')">${checkIcon()}</button>` : ""}
          ${[BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED].includes(b.status) ? `<button class="icon-btn danger" title="Cancel" onclick="updateBookingStatus('${b.id}','${BOOKING_STATUS.CANCELLED}')">${xIcon()}</button>` : ""}
          ${b.status === BOOKING_STATUS.CONFIRMED ? `<button class="icon-btn" title="Mark completed" onclick="updateBookingStatus('${b.id}','${BOOKING_STATUS.COMPLETED}')">${flagIcon()}</button>` : ""}
          <button class="icon-btn" title="View details" onclick="viewBookingDetail('${b.id}')">${eyeIcon()}</button>
        </div>
      </td>
    </tr>`).join("");
}

window.updateBookingStatus = async function (bookingId, newStatus) {
  const labels = { confirmed: "approved", cancelled: "cancelled", completed: "marked completed" };
  try {
    await db.collection(COLLECTIONS.BOOKINGS).doc(bookingId).update({ status: newStatus, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    showToast("Booking updated", `Reservation ${labels[newStatus] || "updated"}.`, "success");
    loadAdminBookings();
  } catch (err) {
    showToast("Couldn't update booking", err.message, "error");
  }
};

window.viewBookingDetail = function (bookingId) {
  const b = ADMIN_BOOKINGS_CACHE.find((x) => x.id === bookingId);
  if (!b) return;
  qs("#bookingDetailBody").innerHTML = `
    <div class="keycard-confirm">
      <div class="stripe"></div>
      <span class="kc-code">${b.bookingCode}</span>
      <h3>${escapeHtml(b.roomType)} · Room ${escapeHtml(b.roomNumber)}</h3>
      <div class="kc-grid">
        <div><span>Guest</span><b>${escapeHtml(b.userName)}</b></div>
        <div><span>Guests</span><b>${b.guests}</b></div>
        <div><span>Check-in</span><b>${formatDateShort(b.checkIn)}</b></div>
        <div><span>Check-out</span><b>${formatDateShort(b.checkOut)}</b></div>
      </div>
    </div>
    <div class="mt-4" style="font-size:14px;">
      <div class="flex justify-between mb-2"><span class="text-soft">Email</span><span>${escapeHtml(b.userEmail)}</span></div>
      <div class="flex justify-between mb-2"><span class="text-soft">Nights</span><span>${b.nights}</span></div>
      <div class="flex justify-between mb-2"><span class="text-soft">Total</span><span><b>${formatCurrency(b.totalPrice)}</b></span></div>
      <div class="flex justify-between mb-2"><span class="text-soft">Status</span><span class="badge ${badgeClassForStatus(b.status)}">${capitalize(b.status)}</span></div>
      ${b.specialRequests ? `<div class="mt-3"><span class="text-soft" style="font-size:12.5px;">Special requests</span><p class="mt-1">${escapeHtml(b.specialRequests)}</p></div>` : ""}
    </div>`;
  qs("#bookingDetailOverlay").classList.add("open");
};
qs("#bookingDetailClose")?.addEventListener("click", () => qs("#bookingDetailOverlay").classList.remove("open"));

function checkIcon() { return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 6L9 17l-5-5"/></svg>'; }
function xIcon() { return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6L6 18M6 6l12 12"/></svg>'; }
function flagIcon() { return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22V15"/></svg>'; }
function eyeIcon() { return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'; }
