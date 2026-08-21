/**
 * ADMIN DASHBOARD
 * High-level snapshot: stat cards, a 14-day revenue trend, and the most
 * recent bookings across all guests. Requires auth-guard.js (REQUIRE_ADMIN).
 */
document.addEventListener("authReady", () => {
  loadDashboardStats();
  loadRecentBookings();
});

async function loadDashboardStats() {
  try {
    const [roomsSnap, bookingsSnap] = await Promise.all([
      db.collection(COLLECTIONS.ROOMS).get(),
      db.collection(COLLECTIONS.BOOKINGS).get()
    ]);

    const rooms = roomsSnap.docs.map((d) => d.data());
    const bookings = bookingsSnap.docs.map((d) => d.data());

    const isDemoAdmin = auth.currentUser?.email === DEMO_ACCOUNTS.ADMIN.email;
    qs("#getStartedCTA")?.classList.toggle("hidden", !(isDemoAdmin && rooms.length === 0));

    const pending = bookings.filter((b) => b.status === BOOKING_STATUS.PENDING).length;
    const revenue = bookings.filter((b) => [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED].includes(b.status)).reduce((sum, b) => sum + (b.totalPrice || 0), 0);

    const today = todayISO();
    const occupiedToday = bookings.filter((b) => [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED].includes(b.status) && b.checkIn <= today && b.checkOut > today).length;
    const occupancyRate = rooms.length ? Math.round((occupiedToday / rooms.length) * 100) : 0;

    qs("#statTotalRooms").textContent = rooms.length;
    qs("#statPendingBookings").textContent = pending;
    qs("#statRevenue").textContent = formatCurrency(revenue);
    qs("#statOccupancy").textContent = `${occupancyRate}%`;

    renderRevenueTrendChart(bookings);
    renderRoomTypeChart(rooms, bookings);
  } catch (err) {
    console.error(err);
    showToast("Couldn't load dashboard", err.message, "error");
  }
}

function renderRevenueTrendChart(bookings) {
  const canvas = qs("#revenueTrendChart");
  if (!canvas || typeof Chart === "undefined") return;

  const days = Array.from({ length: 14 }, (_, i) => addDaysISO(todayISO(), i - 13));
  const totals = days.map((day) =>
    bookings
      .filter((b) => [BOOKING_STATUS.CONFIRMED, BOOKING_STATUS.COMPLETED].includes(b.status) && toJsDate(b.createdAt) && toJsDate(b.createdAt).toISOString().split("T")[0] === day)
      .reduce((sum, b) => sum + (b.totalPrice || 0), 0)
  );

  new Chart(canvas, {
    type: "line",
    data: {
      labels: days.map((d) => formatDateShort(d)),
      datasets: [{
        label: "Revenue",
        data: totals,
        borderColor: "#B8874B",
        backgroundColor: "rgba(184,135,75,0.12)",
        borderWidth: 2.5,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.35,
        fill: true
      }]
    },
    options: chartBaseOptions((v) => formatCurrency(v))
  });
}

function renderRoomTypeChart(rooms, bookings) {
  const canvas = qs("#roomTypeChart");
  if (!canvas || typeof Chart === "undefined") return;

  const counts = {};
  bookings.forEach((b) => { counts[b.roomType] = (counts[b.roomType] || 0) + 1; });
  const labels = Object.keys(counts);
  const palette = ["#1F3D2C", "#B8874B", "#8C3037", "#2E5940", "#9A7A22", "#4A5D52"];

  new Chart(canvas, {
    type: "doughnut",
    data: { labels, datasets: [{ data: Object.values(counts), backgroundColor: labels.map((_, i) => palette[i % palette.length]), borderWidth: 0 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: "68%" }
  });

  const legend = qs("#roomTypeLegend");
  if (legend) legend.innerHTML = labels.map((l, i) => `<span><i style="background:${palette[i % palette.length]}"></i>${escapeHtml(l)} (${counts[l]})</span>`).join("");
}

function chartBaseOptions(yFormatter) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: "#1B2A22", padding: 10, cornerRadius: 8, callbacks: { label: (ctx) => yFormatter(ctx.parsed.y) } } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 }, color: "#8A9A8F" } },
      y: { grid: { color: "#EFEAE0" }, ticks: { font: { size: 11 }, color: "#8A9A8F", callback: (v) => yFormatter(v) } }
    }
  };
}

async function loadRecentBookings() {
  const tbody = qs("#recentBookingsTbody");
  if (!tbody) return;
  try {
    const snap = await db.collection(COLLECTIONS.BOOKINGS).orderBy("createdAt", "desc").limit(6).get();
    if (snap.empty) {
      tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><h3>No bookings yet</h3><p>New reservations will appear here.</p></div></td></tr>`;
      return;
    }
    tbody.innerHTML = snap.docs.map((d) => {
      const b = d.data();
      return `<tr>
        <td><div class="cell-user"><span class="cell-avatar">${initials(b.userName)}</span><div><b>${escapeHtml(b.userName)}</b><span>${escapeHtml(b.userEmail)}</span></div></div></td>
        <td>${escapeHtml(b.roomType)} · ${escapeHtml(b.roomNumber)}</td>
        <td>${formatDateShort(b.checkIn)} – ${formatDateShort(b.checkOut)}</td>
        <td>${formatCurrency(b.totalPrice)}</td>
        <td><span class="badge ${badgeClassForStatus(b.status)}">${capitalize(b.status)}</span></td>
        <td class="text-faint" style="font-size:12.5px;">${formatDate(b.createdAt)}</td>
      </tr>`;
    }).join("");
  } catch (err) {
    console.error(err);
  }
}
