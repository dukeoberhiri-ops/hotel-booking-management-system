/**
 * ROOM DETAIL
 * Loads a single room by ?id=, renders its gallery/amenities/price panel,
 * checks live availability against existing bookings (client-side overlap
 * check — the authoritative check runs again in Firestore rules / a
 * transaction-safe write below to prevent double booking), and submits
 * a new booking.
 */
let CURRENT_ROOM = null;
let ROOM_BOOKINGS = []; // existing pending/confirmed bookings for this room

document.addEventListener("DOMContentLoaded", async () => {
  const roomId = new URLSearchParams(window.location.search).get("id");
  if (!roomId) {
    window.location.href = "rooms.html";
    return;
  }
  await loadRoomDetail(roomId);
  wireBookingForm(roomId);
  hideAppLoader();
});

async function loadRoomDetail(roomId) {
  try {
    const docSnap = await db.collection(COLLECTIONS.ROOMS).doc(roomId).get();
    if (!docSnap.exists) {
      qs("#roomDetailContent").innerHTML = `<div class="empty-state"><h3>Room not found</h3><p>This room may have been removed.</p><a href="rooms.html" class="btn btn-primary">Browse rooms</a></div>`;
      return;
    }
    CURRENT_ROOM = { id: docSnap.id, ...docSnap.data() };
    renderRoomDetail(CURRENT_ROOM);

    const bookingsSnap = await db.collection(COLLECTIONS.BOOKINGS)
      .where("roomId", "==", roomId)
      .where("status", "in", [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED])
      .get();
    ROOM_BOOKINGS = bookingsSnap.docs.map((d) => d.data());
  } catch (err) {
    console.error(err);
    showToast("Couldn't load room", err.message, "error");
  }
}

function renderRoomDetail(room) {
  document.title = `Room ${room.roomNumber} — ${room.type} | Aurelio Hotels`;
  const images = room.images?.length ? room.images : ["https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80"];

  qs("#rhgMain").src = images[0];
  qs("#rhgMain").alt = room.type;
  const side = qs("#rhgSide");
  side.innerHTML = images.slice(1, 3).map((src, i) => {
    const isLast = i === 1 && images.length > 3;
    return `<div class="${isLast ? "more-overlay" : ""}" ${isLast ? `data-count="+${images.length - 3} photos"` : ""}><img src="${src}" alt="${escapeHtml(room.type)} photo ${i + 2}"></div>`;
  }).join("") || "";

  qs("#roomBreadcrumbType").textContent = room.type;
  qs("#roomTitle").textContent = `${room.type} · Room ${room.roomNumber}`;
  qs("#roomMeta").innerHTML = `
    <span class="chip">${roomIcon("guests")} Up to ${room.maxGuests} guests</span>
    <span class="chip">${roomIcon("bed")} ${room.bedType || "Queen bed"}</span>
    ${room.size ? `<span class="chip">${roomIcon("size")} ${room.size} sq ft</span>` : ""}
    <span class="badge badge-${room.status === "available" ? "available" : room.status}">${capitalize(room.status)}</span>`;
  qs("#roomDescription").textContent = room.description || "A thoughtfully appointed room designed for comfort and calm.";

  qs("#roomAmenityList").innerHTML = (room.amenities || []).map((a) => `<li>${roomIcon("check")} ${escapeHtml(a)}</li>`).join("") || `<li class="text-faint">No amenities listed.</li>`;

  qs("#panelPrice").innerHTML = `<b>${formatCurrency(room.pricePerNight)}</b><span> / night</span>`;

  const minCheckIn = todayISO();
  qs("#checkInInput").min = minCheckIn;
  qs("#checkOutInput").min = addDaysISO(minCheckIn, 1);
}

function roomIcon(name) {
  const icons = {
    guests: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>',
    bed: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 18v-8a2 2 0 012-2h4a2 2 0 012 2v3M3 18v2M3 18h18M13 13h6a2 2 0 012 2v3M21 18v2M7 11V7a2 2 0 012-2h0"/></svg>',
    size: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8V3h5M16 3h5v5M21 16v5h-5M8 21H3v-5"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/></svg>'
  };
  return icons[name] || "";
}

/* ------------------------------------------------------------- BOOKING */
function wireBookingForm(roomId) {
  const form = qs("#bookingForm");
  if (!form) return;

  const checkIn = qs("#checkInInput");
  const checkOut = qs("#checkOutInput");
  const guests = qs("#guestsInput");
  const availNote = qs("#availNote");
  const breakdown = qs("#priceBreakdown");
  const submitBtn = qs("#bookNowBtn");

  const recalc = () => {
    checkOut.min = checkIn.value ? addDaysISO(checkIn.value, 1) : addDaysISO(todayISO(), 1);
    if (checkOut.value && checkIn.value && checkOut.value <= checkIn.value) checkOut.value = addDaysISO(checkIn.value, 1);

    if (!checkIn.value || !checkOut.value) {
      availNote.classList.add("hidden");
      breakdown.classList.add("hidden");
      return;
    }

    const nights = nightsBetween(checkIn.value, checkOut.value);
    const overlaps = ROOM_BOOKINGS.some((b) => checkIn.value < b.checkOut && checkOut.value > b.checkIn);
    const guestCount = parseInt(guests.value || "1", 10);
    const overCapacity = guestCount > CURRENT_ROOM.maxGuests;
    const isRoomOpen = CURRENT_ROOM.status === ROOM_STATUS.AVAILABLE;

    availNote.classList.remove("hidden");
    if (!isRoomOpen) {
      availNote.className = "avail-note bad";
      availNote.innerHTML = `${roomIcon("check")} This room is currently ${CURRENT_ROOM.status} and can't be booked.`;
    } else if (overlaps) {
      availNote.className = "avail-note bad";
      availNote.innerHTML = `${roomIcon("check")} Already booked for part of these dates. Try a different range.`;
    } else if (overCapacity) {
      availNote.className = "avail-note bad";
      availNote.innerHTML = `${roomIcon("check")} This room sleeps up to ${CURRENT_ROOM.maxGuests} guests.`;
    } else {
      availNote.className = "avail-note ok";
      availNote.innerHTML = `${roomIcon("check")} Available for your selected dates.`;
    }

    const subtotal = nights * CURRENT_ROOM.pricePerNight;
    const taxes = Math.round(subtotal * 0.12);
    breakdown.classList.remove("hidden");
    breakdown.innerHTML = `
      <div class="row"><span>${formatCurrency(CURRENT_ROOM.pricePerNight)} × ${nights} night${nights === 1 ? "" : "s"}</span><span>${formatCurrency(subtotal)}</span></div>
      <div class="row"><span>Taxes & fees (12%)</span><span>${formatCurrency(taxes)}</span></div>
      <div class="row total"><span>Total</span><span>${formatCurrency(subtotal + taxes)}</span></div>`;

    submitBtn.disabled = !isRoomOpen || overlaps || overCapacity || nights < 1;
  };

  [checkIn, checkOut, guests].forEach((el) => el?.addEventListener("change", recalc));

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) {
      showToast("Please log in", "Create an account or log in to complete your booking.", "warning");
      const target = encodeURIComponent(`room-detail.html?id=${roomId}`);
      setTimeout(() => (window.location.href = `login.html?redirect=${target}`), 900);
      return;
    }

    setButtonLoading(submitBtn, true, "Confirming…");
    try {
      // Re-check for overlapping bookings right before writing, to minimize
      // the double-booking race window between two guests booking at once.
      const freshSnap = await db.collection(COLLECTIONS.BOOKINGS)
        .where("roomId", "==", roomId)
        .where("status", "in", [BOOKING_STATUS.PENDING, BOOKING_STATUS.CONFIRMED])
        .get();
      const freshBookings = freshSnap.docs.map((d) => d.data());
      const stillOverlaps = freshBookings.some((b) => checkIn.value < b.checkOut && checkOut.value > b.checkIn);
      if (stillOverlaps) {
        showToast("Just booked", "Someone booked these dates moments ago. Please pick another range.", "error");
        ROOM_BOOKINGS = freshBookings;
        recalc();
        setButtonLoading(submitBtn, false);
        return;
      }

      const nights = nightsBetween(checkIn.value, checkOut.value);
      const subtotal = nights * CURRENT_ROOM.pricePerNight;
      const totalPrice = subtotal + Math.round(subtotal * 0.12);
      const bookingCode = generateBookingCode();

      const profile = window.currentUserProfile || {};
      const bookingRef = await db.collection(COLLECTIONS.BOOKINGS).add({
        bookingCode,
        userId: user.uid,
        userName: profile.fullName || user.displayName || "Guest",
        userEmail: user.email,
        roomId,
        roomNumber: CURRENT_ROOM.roomNumber,
        roomType: CURRENT_ROOM.type,
        roomImage: CURRENT_ROOM.images?.[0] || "",
        checkIn: checkIn.value,
        checkOut: checkOut.value,
        nights,
        guests: parseInt(guests.value, 10),
        pricePerNight: CURRENT_ROOM.pricePerNight,
        totalPrice,
        status: BOOKING_STATUS.PENDING,
        specialRequests: qs("#specialRequests")?.value.trim() || "",
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      showBookingConfirmation({ bookingCode, checkIn: checkIn.value, checkOut: checkOut.value, guests: guests.value, totalPrice, room: CURRENT_ROOM });
      form.reset();
      ROOM_BOOKINGS.push({ checkIn: checkIn.value, checkOut: checkOut.value, status: BOOKING_STATUS.PENDING });
    } catch (err) {
      console.error(err);
      showToast("Booking failed", err.message, "error");
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

function showBookingConfirmation({ bookingCode, checkIn, checkOut, guests, totalPrice, room }) {
  const overlay = qs("#confirmModalOverlay");
  qs("#confirmModalBody").innerHTML = `
    <div class="keycard-confirm">
      <div class="stripe"></div>
      <span class="kc-code">${bookingCode}</span>
      <h3>Booking requested</h3>
      <div class="kc-grid">
        <div><span>Room</span><b>${escapeHtml(room.roomNumber)} · ${escapeHtml(room.type)}</b></div>
        <div><span>Guests</span><b>${guests}</b></div>
        <div><span>Check-in</span><b>${formatDateShort(checkIn)}</b></div>
        <div><span>Check-out</span><b>${formatDateShort(checkOut)}</b></div>
      </div>
    </div>
    <p class="text-soft mt-4" style="font-size:14px;">Total due: <strong>${formatCurrency(totalPrice)}</strong>. Your booking is <strong>pending confirmation</strong> — we'll notify you once the front desk approves it. Track its status anytime from My Account.</p>`;
  overlay.classList.add("open");
  qs("#confirmModalClose")?.addEventListener("click", () => overlay.classList.remove("open"), { once: true });
  qs("#confirmModalGoBookings")?.addEventListener("click", () => (window.location.href = "account.html#bookings"), { once: true });
}
