/**
 * ADMIN REPORTS
 * Pulls every room + booking once, then derives all report charts client
 * side: daily bookings (30d), monthly bookings/revenue (12mo), occupancy
 * rate trend, and most-booked room types.
 */
document.addEventListener("authReady", loadReports);

async function loadReports() {
  try {
    const [roomsSnap, bookingsSnap] = await Promise.all([
      db.collection(COLLECTIONS.ROOMS).get(),
      db.collection(COLLECTIONS.BOOKINGS).get()
    ]);
    const rooms = roomsSnap.docs.map((d) => d.data());
    const bookings = bookingsSnap.docs.map((d) => d.data()).filter((b) => b.createdAt);

    renderSummaryCards(rooms, bookings);
    renderDailyBookingsChart(bookings);
    renderMonthlyChart(bookings);
    renderOccupancyChart(rooms, bookings);
    renderRoomTypePopularity(bookings);
  } catch (err) {
    console.error(err);
    showToast("Couldn't load reports", err.message, "error");
  }
}

function renderSummaryCards(rooms, bookings) {
  const revenue = bookings.filter((b) => ["confirmed", "completed"].includes(b.status)).reduce((s, b) => s + (b.totalPrice || 0), 0);
  const avgValue = bookings.length ? revenue / bookings.filter((b) => ["confirmed", "completed"].includes(b.status)).length || 1 : 0;
  qs("#reportTotalRevenue").textContent = formatCurrency(revenue);
  qs("#reportTotalBookings").textContent = bookings.length;
  qs("#reportAvgValue").textContent = formatCurrency(Math.round(avgValue || 0));
  qs("#reportCancelRate").textContent = bookings.length ? `${Math.round((bookings.filter((b) => b.status === "cancelled").length / bookings.length) * 100)}%` : "0%";
}

function renderDailyBookingsChart(bookings) {
  const canvas = qs("#dailyBookingsChart");
  if (!canvas || typeof Chart === "undefined") return;
  const days = Array.from({ length: 30 }, (_, i) => addDaysISO(todayISO(), i - 29));
  const counts = days.map((day) => bookings.filter((b) => toJsDate(b.createdAt)?.toISOString().split("T")[0] === day).length);

  new Chart(canvas, {
    type: "bar",
    data: { labels: days.map((d) => formatDateShort(d)), datasets: [{ label: "Bookings", data: counts, backgroundColor: "#1F3D2C", borderRadius: 4, maxBarThickness: 14 }] },
    options: reportChartOptions((v) => v)
  });
}

function renderMonthlyChart(bookings) {
  const canvas = qs("#monthlyChart");
  if (!canvas || typeof Chart === "undefined") return;
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (11 - i)); return d;
  });
  const revenueByMonth = months.map((m) =>
    bookings.filter((b) => ["confirmed", "completed"].includes(b.status)).filter((b) => {
      const bd = toJsDate(b.createdAt); return bd && bd.getMonth() === m.getMonth() && bd.getFullYear() === m.getFullYear();
    }).reduce((s, b) => s + (b.totalPrice || 0), 0)
  );
  const bookingsByMonth = months.map((m) =>
    bookings.filter((b) => { const bd = toJsDate(b.createdAt); return bd && bd.getMonth() === m.getMonth() && bd.getFullYear() === m.getFullYear(); }).length
  );

  new Chart(canvas, {
    data: {
      labels: months.map((m) => m.toLocaleDateString("en-US", { month: "short", year: "2-digit" })),
      datasets: [
        { type: "bar", label: "Bookings", data: bookingsByMonth, backgroundColor: "#D9AE73", yAxisID: "y1", borderRadius: 4, maxBarThickness: 22 },
        { type: "line", label: "Revenue", data: revenueByMonth, borderColor: "#1F3D2C", backgroundColor: "transparent", borderWidth: 2.5, tension: 0.35, yAxisID: "y", pointRadius: 3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 12 } } } },
      scales: {
        x: { grid: { display: false } },
        y: { position: "left", grid: { color: "#EFEAE0" }, ticks: { callback: (v) => formatCurrency(v) } },
        y1: { position: "right", grid: { display: false }, ticks: { precision: 0 } }
      }
    }
  });
}

function renderOccupancyChart(rooms, bookings) {
  const canvas = qs("#occupancyChart");
  if (!canvas || typeof Chart === "undefined") return;
  const days = Array.from({ length: 14 }, (_, i) => addDaysISO(todayISO(), i - 13));
  const rate = days.map((day) => {
    const occupied = bookings.filter((b) => ["confirmed", "completed"].includes(b.status) && b.checkIn <= day && b.checkOut > day).length;
    return rooms.length ? Math.round((occupied / rooms.length) * 100) : 0;
  });

  new Chart(canvas, {
    type: "line",
    data: { labels: days.map((d) => formatDateShort(d)), datasets: [{ label: "Occupancy", data: rate, borderColor: "#8C3037", backgroundColor: "rgba(140,48,55,0.1)", fill: true, tension: 0.3, pointRadius: 0 }] },
    options: reportChartOptions((v) => `${v}%`)
  });
}

function renderRoomTypePopularity(bookings) {
  const canvas = qs("#popularityChart");
  if (!canvas || typeof Chart === "undefined") return;
  const counts = {};
  bookings.forEach((b) => { counts[b.roomType] = (counts[b.roomType] || 0) + 1; });
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  new Chart(canvas, {
    type: "bar",
    data: {
      labels: sorted.map((s) => s[0]),
      datasets: [{ label: "Bookings", data: sorted.map((s) => s[1]), backgroundColor: "#B8874B", borderRadius: 4, maxBarThickness: 26 }]
    },
    options: { ...reportChartOptions((v) => v), indexAxis: "y" }
  });
}

function reportChartOptions(fmt) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { backgroundColor: "#1B2A22", padding: 10, cornerRadius: 8 } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 10.5 }, color: "#8A9A8F", maxRotation: 0, autoSkip: true } },
      y: { grid: { color: "#EFEAE0" }, ticks: { font: { size: 11 }, color: "#8A9A8F", callback: (v) => fmt(v) } }
    }
  };
}
