/**
 * ROOMS
 * Shared rendering + query logic for the landing page's "Featured rooms"
 * strip and the full rooms.html browse experience (search, type filter,
 * sort, and an empty state when nothing matches).
 */
let ALL_ROOMS_CACHE = [];

function roomCardTemplate(room) {
  const img = (room.images && room.images[0]) || "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=800&q=80";
  const isAvailable = room.status === ROOM_STATUS.AVAILABLE;
  return `
    <article class="card room-card" data-room-id="${room.id}">
      <div class="card-stripe"></div>
      <a href="room-detail.html?id=${room.id}" class="room-card-media">
        <img src="${img}" alt="${escapeHtml(room.type)} — Room ${escapeHtml(room.roomNumber)}" loading="lazy">
        <span class="room-card-badge">${escapeHtml(room.type)}</span>
      </a>
      <div class="room-card-body">
        <div class="room-card-top">
          <div>
            <h3><a href="room-detail.html?id=${room.id}">Room ${escapeHtml(room.roomNumber)}</a></h3>
            <span class="room-card-type">${room.maxGuests} guests · ${room.bedType || "Queen bed"}</span>
          </div>
          <span class="badge badge-${isAvailable ? "available" : room.status}">${isAvailable ? "Available" : capitalize(room.status)}</span>
        </div>
        <p class="room-card-desc">${escapeHtml((room.description || "").slice(0, 90))}${room.description?.length > 90 ? "…" : ""}</p>
        <div class="room-card-amenities">
          ${(room.amenities || []).slice(0, 3).map((a) => `<span class="chip">${escapeHtml(a)}</span>`).join("")}
        </div>
        <div class="room-card-footer">
          <div class="room-price"><b>${formatCurrency(room.pricePerNight)}</b><span> / night</span></div>
          <a href="room-detail.html?id=${room.id}" class="btn btn-outline btn-sm">View room</a>
        </div>
      </div>
    </article>`;
}

function roomCardSkeleton() {
  return `<div class="card"><div class="skeleton skeleton-card"></div></div>`;
}

/* ------------------------------------------------------- FEATURED (home) */
async function loadFeaturedRooms() {
  const grid = qs("#featuredRoomsGrid");
  if (!grid) return;
  grid.innerHTML = Array(3).fill(roomCardSkeleton()).join("");

  try {
    const snap = await db.collection(COLLECTIONS.ROOMS)
      .where("status", "==", ROOM_STATUS.AVAILABLE)
      .limit(6)
      .get();

    if (snap.empty) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="icon-wrap">${emptyBedIcon()}</div><h3>Rooms coming soon</h3><p>We're preparing our room catalog. Please check back shortly.</p></div>`;
      return;
    }
    const rooms = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    grid.innerHTML = rooms.slice(0, 6).map(roomCardTemplate).join("");
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><h3>Couldn't load rooms</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

/* ------------------------------------------------------- BROWSE (rooms.html) */
async function loadAllRoomsForBrowse() {
  const grid = qs("#roomsGrid");
  if (!grid) return;
  grid.innerHTML = Array(6).fill(roomCardSkeleton()).join("");

  try {
    const snap = await db.collection(COLLECTIONS.ROOMS).orderBy("pricePerNight", "asc").get();
    ALL_ROOMS_CACHE = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    populateTypeFilter(ALL_ROOMS_CACHE);
    applyRoomFilters();
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><h3>Couldn't load rooms</h3><p>${escapeHtml(err.message)}</p></div>`;
  }
}

function populateTypeFilter(rooms) {
  const wrap = qs("#typeFilterPills");
  if (!wrap) return;
  const types = [...new Set(rooms.map((r) => r.type))];
  wrap.innerHTML = `<button class="filter-pill active" data-type="all">All rooms</button>` +
    types.map((t) => `<button class="filter-pill" data-type="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join("");
  qsa(".filter-pill", wrap).forEach((btn) => btn.addEventListener("click", () => {
    qsa(".filter-pill", wrap).forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    applyRoomFilters();
  }));
}

function applyRoomFilters() {
  const grid = qs("#roomsGrid");
  if (!grid) return;
  const query = (qs("#roomSearchInput")?.value || "").toLowerCase().trim();
  const activeType = qs(".filter-pill.active")?.dataset.type || "all";
  const guests = qs("#guestFilter")?.value;
  const sortBy = qs("#sortSelect")?.value || "price-asc";

  let filtered = ALL_ROOMS_CACHE.filter((room) => {
    const matchesQuery = !query || room.type.toLowerCase().includes(query) || room.description?.toLowerCase().includes(query) || room.roomNumber?.toLowerCase().includes(query);
    const matchesType = activeType === "all" || room.type === activeType;
    const matchesGuests = !guests || guests === "any" || room.maxGuests >= parseInt(guests, 10);
    return matchesQuery && matchesType && matchesGuests;
  });

  filtered.sort((a, b) => {
    if (sortBy === "price-asc") return a.pricePerNight - b.pricePerNight;
    if (sortBy === "price-desc") return b.pricePerNight - a.pricePerNight;
    if (sortBy === "guests") return b.maxGuests - a.maxGuests;
    return 0;
  });

  const countEl = qs("#resultsCount");
  if (countEl) countEl.textContent = `${filtered.length} room${filtered.length === 1 ? "" : "s"} found`;

  if (!filtered.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><div class="icon-wrap">${emptyBedIcon()}</div><h3>No rooms match your search</h3><p>Try adjusting your filters or search terms to see more options.</p><button class="btn btn-outline" id="clearFiltersBtn">Clear filters</button></div>`;
    qs("#clearFiltersBtn")?.addEventListener("click", () => {
      if (qs("#roomSearchInput")) qs("#roomSearchInput").value = "";
      if (qs("#guestFilter")) qs("#guestFilter").value = "any";
      qsa(".filter-pill").forEach((b) => b.classList.remove("active"));
      qs('.filter-pill[data-type="all"]')?.classList.add("active");
      applyRoomFilters();
    });
    return;
  }
  grid.innerHTML = filtered.map(roomCardTemplate).join("");
}

function wireRoomBrowseControls() {
  qs("#roomSearchInput")?.addEventListener("input", debounce(applyRoomFilters, 250));
  qs("#guestFilter")?.addEventListener("change", applyRoomFilters);
  qs("#sortSelect")?.addEventListener("change", applyRoomFilters);
}

function emptyBedIcon() {
  return '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 18v-8a2 2 0 012-2h4a2 2 0 012 2v3M3 18v2M3 18h18M13 13h6a2 2 0 012 2v3M21 18v2M7 11V7a2 2 0 012-2h0"/></svg>';
}

document.addEventListener("DOMContentLoaded", () => {
  loadFeaturedRooms();
  loadAllRoomsForBrowse();
  wireRoomBrowseControls();
});
