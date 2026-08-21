/**
 * ACCOUNT (customer)
 * Profile editing + booking history/cancellation for the logged-in guest.
 * Requires auth-guard.js to have fired "authReady" first.
 */
document.addEventListener("authReady", (e) => {
  const profile = e.detail;
  hydrateProfileForm(profile);
  watchMyBookings(profile.uid);
  watchMyMessages(profile.uid);
  wireProfileForm(profile.uid);
  wireAccountTabs();
  wireMessageForm(profile);
});

function hydrateProfileForm(profile) {
  qs("#profileAvatarInitials").textContent = initials(profile.fullName);
  qs("#profileHeaderName").textContent = profile.fullName || "Guest";
  qs("#profileHeaderEmail").textContent = profile.email;
  qs("#profileFullName").value = profile.fullName || "";
  qs("#profileEmail").value = profile.email || "";
  qs("#profilePhone").value = profile.phone || "";
  qs("#profileMemberSince").textContent = profile.createdAt ? formatDate(profile.createdAt) : "—";
}

function wireProfileForm(uid) {
  const form = qs("#profileForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = qs("#saveProfileBtn");
    const fullName = qs("#profileFullName").value.trim();
    const phone = qs("#profilePhone").value.trim();

    if (!Validate.required(fullName)) { showToast("Name required", "Please enter your full name.", "error"); return; }
    if (phone && !Validate.phone(phone)) { showToast("Invalid phone", "Please check the phone number format.", "error"); return; }

    setButtonLoading(btn, true, "Saving…");
    try {
      await db.collection(COLLECTIONS.USERS).doc(uid).update({ fullName, phone, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
      if (auth.currentUser) await auth.currentUser.updateProfile({ displayName: fullName });
      qs("#profileAvatarInitials").textContent = initials(fullName);
      qs("#profileHeaderName").textContent = fullName;
      showToast("Profile updated", "Your changes have been saved.", "success");
    } catch (err) {
      showToast("Couldn't save changes", err.message, "error");
    } finally {
      setButtonLoading(btn, false);
    }
  });
}

function wireAccountTabs() {
  const tabs = qsa(".panel-tab[data-tab]");
  if (!tabs.length) return;
  tabs.forEach((tab) => tab.addEventListener("click", () => {
    tabs.forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    qsa(".booking-item").forEach((item) => {
      const status = item.dataset.status;
      const filter = tab.dataset.tab;
      item.style.display = filter === "all" || filter === status ? "flex" : "none";
    });
  }));
}

/* Real-time listener: so a status change an admin makes (approve/cancel/
   complete) appears here instantly, with no page refresh needed. No
   .orderBy() chained on the query — see the identical note in
   watchMyMessages() below for why that's deliberate. */
function watchMyBookings(uid) {
  const list = qs("#myBookingsList");
  if (!list) return;
  list.innerHTML = Array(3).fill('<div class="skeleton" style="height:110px;margin-bottom:12px;"></div>').join("");

  db.collection(COLLECTIONS.BOOKINGS).where("userId", "==", uid)
    .onSnapshot((snap) => {
      if (snap.empty) {
        list.innerHTML = emptyBookingsState();
        return;
      }
      const bookings = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (toJsDate(b.createdAt) || 0) - (toJsDate(a.createdAt) || 0));
      list.innerHTML = bookings.map(bookingItemTemplate).join("");
      wireCancelButtons();
      qsa(".panel-tab[data-tab]").forEach((t) => t.classList.toggle("active", t.dataset.tab === "all"));
    }, (err) => {
      console.error(err);
      list.innerHTML = `<div class="empty-state"><h3>Couldn't load bookings</h3><p>${escapeHtml(err.message)}</p></div>`;
    });
}

function emptyBookingsState() {
  return `<div class="empty-state">
    <div class="icon-wrap"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></div>
    <h3>No bookings yet</h3><p>When you book a room, it will show up here so you can track its status.</p>
    <a href="rooms.html" class="btn btn-primary">Browse rooms</a></div>`;
}

function bookingItemTemplate(b) {
  const checkInDate = toJsDate(b.checkIn);
  const isCancellable = [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED].includes(b.status) && checkInDate && checkInDate > new Date();
  return `
    <div class="booking-item" data-status="${b.status}" data-booking-id="${b.id}">
      <img src="${b.roomImage || "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=200&q=80"}" alt="${escapeHtml(b.roomType)}">
      <div class="booking-item-body">
        <div class="item-title-row">
          <h4>${escapeHtml(b.roomType)} · Room ${escapeHtml(b.roomNumber)}</h4>
          <span class="badge ${badgeClassForStatus(b.status)}">${capitalize(b.status)}</span>
        </div>
        <span class="text-faint" style="font-family:var(--font-mono); font-size:12px;">${b.bookingCode}</span>
        <div class="booking-item-meta">
          <span>${roomIcon("bed")} ${formatDateShort(b.checkIn)} – ${formatDateShort(b.checkOut)}</span>
          <span>${roomIcon("guests")} ${b.guests} guest${b.guests === 1 ? "" : "s"}</span>
          <span><b>${formatCurrency(b.totalPrice)}</b></span>
        </div>
      </div>
      <div class="booking-item-actions">
        ${isCancellable ? `<button class="btn btn-danger btn-sm cancel-booking-btn" data-id="${b.id}">Cancel booking</button>` : `<span class="text-faint" style="font-size:12px;">${b.status === "cancelled" ? "Cancelled" : b.status === "completed" ? "Stay complete" : "Not cancellable"}</span>`}
      </div>
    </div>`;
}

function wireCancelButtons() {
  qsa(".cancel-booking-btn").forEach((btn) => btn.addEventListener("click", () => confirmCancelBooking(btn.dataset.id, btn)));
}

function confirmCancelBooking(bookingId, btn) {
  const overlay = qs("#cancelConfirmOverlay");
  overlay.classList.add("open");
  const yesBtn = qs("#cancelConfirmYes");
  const noBtn = qs("#cancelConfirmNo");

  const cleanup = () => { overlay.classList.remove("open"); yesBtn.replaceWith(yesBtn.cloneNode(true)); };
  noBtn.onclick = () => overlay.classList.remove("open");
  qs("#cancelConfirmYes").onclick = async () => {
    setButtonLoading(qs("#cancelConfirmYes"), true, "Cancelling…");
    try {
      await db.collection(COLLECTIONS.BOOKINGS).doc(bookingId).update({
        status: BOOKING_STATUS.CANCELLED,
        cancelledAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast("Booking cancelled", "Your reservation has been cancelled.", "success");
      overlay.classList.remove("open");
      // No manual reload needed — the real-time listener updates the list.
    } catch (err) {
      showToast("Couldn't cancel", err.message, "error");
    } finally {
      setButtonLoading(qs("#cancelConfirmYes"), false);
    }
  };
}

function roomIcon(name) {
  const icons = {
    guests: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>',
    bed: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>'
  };
  return icons[name] || "";
}

/* ------------------------------------------------------------- MESSAGES */
/**
 * The guest's real, continuous conversation with the front desk. Every
 * message — guest or staff — is its own document sharing this guest's
 * `userId`, ordered chronologically and rendered as alternating chat
 * bubbles. This is what lets either side send several messages in a row
 * and have them all land in one flowing thread, rather than each guest
 * message needing exactly one reply before anything else can happen.
 */
function watchMyMessages(uid) {
  const thread = qs("#myMessagesThread");
  if (!thread) return;

  // Deliberately no .orderBy() chained onto the .where() here — combining
  // an equality filter with a sort on a different field requires a
  // Firestore composite index to be created manually in the console
  // first, and forgetting that step makes this silently fail. Filtering
  // by userId alone needs no extra index; we sort by createdAt in JS
  // instead, which is instant at this data scale (one guest's messages).
  db.collection(COLLECTIONS.MESSAGES).where("userId", "==", uid)
    .onSnapshot((snap) => {
      if (snap.empty) {
        thread.innerHTML = `<p class="text-faint" style="font-size:13.5px; text-align:center; padding: var(--space-4) 0;">No messages yet — send a note to the front desk below and we'll reply here.</p>`;
        return;
      }
      const messages = snap.docs.map((d) => d.data()).sort((a, b) => (toJsDate(a.createdAt) || 0) - (toJsDate(b.createdAt) || 0));
      thread.innerHTML = messages.map(messageBubbleTemplate).join("");
      thread.scrollTop = thread.scrollHeight;
      // Opening My Account and seeing the full thread counts as "read" —
      // this is what resets the unread badges (nav avatar + sidebar link;
      // see watchIncomingMessagesForGuest in nav.js).
      localStorage.setItem(`aurelio_messages_seen_${uid}`, new Date().toISOString());
      qs("#navUnreadBadge")?.classList.add("hidden");
      qs("#sidebarMyMessagesCount")?.classList.add("hidden");
    }, (err) => {
      console.error(err);
      thread.innerHTML = `<p class="text-faint" style="font-size:13px;">Couldn't load messages: ${escapeHtml(err.message)}</p>`;
    });
}

function messageBubbleTemplate(m) {
  const isGuest = m.senderRole !== "admin";
  const label = isGuest ? "You" : "Front desk";
  return `<div class="message-bubble ${isGuest ? "from-guest" : "from-admin"}">${escapeHtml(m.message)}<span class="msg-meta">${label} · ${formatDateTime(m.createdAt)}</span></div>`;
}

function wireMessageForm(profile) {
  const form = qs("#messageForm");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = qs("#messageInput");
    const btn = qs("#sendMessageBtn");
    const text = input.value.trim();
    if (!Validate.required(text)) return;

    setButtonLoading(btn, true, "");
    try {
      await db.collection(COLLECTIONS.MESSAGES).add({
        userId: profile.uid,
        userName: profile.fullName || "Guest",
        userEmail: profile.email,
        senderRole: "guest",
        senderName: profile.fullName || "Guest",
        message: text,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      input.value = "";
      showToast("Message sent", "The front desk will reply here shortly.", "success");
    } catch (err) {
      showToast("Couldn't send message", err.message, "error");
    } finally {
      setButtonLoading(btn, false);
      btn.innerHTML = "Send";
    }
  });
}
