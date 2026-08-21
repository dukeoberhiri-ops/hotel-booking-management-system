/**
 * ADMIN ROOMS
 * Full CRUD for the rooms collection, including multi-image upload to
 * Firebase Storage (path: room-images/{roomId}/{filename}).
 */
let ADMIN_ROOMS_CACHE = [];
let PENDING_IMAGE_FILES = []; // File objects staged for upload on save
let EXISTING_IMAGE_URLS = []; // URLs already stored on the room being edited
let EDITING_ROOM_ID = null;

document.addEventListener("authReady", () => {
  loadAdminRooms();
  wireRoomModal();
});

async function loadAdminRooms() {
  const tbody = qs("#roomsTbody");
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="7"><div class="skeleton" style="height:60px;"></div></td></tr>`;

  try {
    const snap = await db.collection(COLLECTIONS.ROOMS).orderBy("roomNumber").get();
    ADMIN_ROOMS_CACHE = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderAdminRoomsTable(ADMIN_ROOMS_CACHE);
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><h3>Couldn't load rooms</h3><p>${escapeHtml(err.message)}</p></div></td></tr>`;
  }
}

function renderAdminRoomsTable(rooms) {
  const tbody = qs("#roomsTbody");
  if (!rooms.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="icon-wrap">${bedIcon()}</div><h3>No rooms yet</h3><p>Add your first room to start taking bookings.</p><button class="btn btn-primary" onclick="openRoomModal()">Add room</button></div></td></tr>`;
    return;
  }
  tbody.innerHTML = rooms.map((r) => `
    <tr>
      <td><img class="mini-thumb" src="${r.images?.[0] || "https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=100&q=60"}" alt=""></td>
      <td><b>${escapeHtml(r.roomNumber)}</b></td>
      <td>${escapeHtml(r.type)}</td>
      <td style="font-family:var(--font-mono);">${formatCurrency(r.pricePerNight)}</td>
      <td>${r.maxGuests}</td>
      <td><span class="badge badge-${r.status === "available" ? "available" : r.status}">${capitalize(r.status)}</span></td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" title="Edit" onclick="openRoomModal('${r.id}')">${editIcon()}</button>
          <button class="icon-btn danger" title="Delete" onclick="deleteRoom('${r.id}')">${trashIcon()}</button>
        </div>
      </td>
    </tr>`).join("");
}

qs("#roomTableSearch")?.addEventListener("input", debounce((e) => {
  const q = e.target.value.toLowerCase();
  renderAdminRoomsTable(ADMIN_ROOMS_CACHE.filter((r) => r.roomNumber.toLowerCase().includes(q) || r.type.toLowerCase().includes(q)));
}, 200));

/* ------------------------------------------------------------- MODAL */
function wireRoomModal() {
  qs("#addRoomBtn")?.addEventListener("click", () => openRoomModal());
  qs("#roomModalClose")?.addEventListener("click", closeRoomModal);
  qs("#roomModalCancelBtn")?.addEventListener("click", closeRoomModal);
  qs("#roomImageInput")?.addEventListener("change", handleImageSelection);
  qs("#roomForm")?.addEventListener("submit", saveRoom);
}

window.openRoomModal = function (roomId = null) {
  EDITING_ROOM_ID = roomId;
  PENDING_IMAGE_FILES = [];
  const room = roomId ? ADMIN_ROOMS_CACHE.find((r) => r.id === roomId) : null;
  EXISTING_IMAGE_URLS = room?.images ? [...room.images] : [];

  qs("#roomModalTitle").textContent = room ? `Edit Room ${room.roomNumber}` : "Add a new room";
  qs("#roomNumberInput").value = room?.roomNumber || "";
  qs("#roomTypeInput").value = room?.type || "";
  qs("#roomPriceInput").value = room?.pricePerNight || "";
  qs("#roomMaxGuestsInput").value = room?.maxGuests || 2;
  qs("#roomBedTypeInput").value = room?.bedType || "";
  qs("#roomSizeInput").value = room?.size || "";
  qs("#roomStatusInput").value = room?.status || ROOM_STATUS.AVAILABLE;
  qs("#roomDescriptionInput").value = room?.description || "";
  qs("#roomAmenitiesInput").value = (room?.amenities || []).join(", ");

  renderImageTiles();
  qs("#roomModalOverlay").classList.add("open");
};

function closeRoomModal() {
  qs("#roomModalOverlay").classList.remove("open");
  qs("#roomForm").reset();
  EDITING_ROOM_ID = null;
}

function renderImageTiles() {
  const grid = qs("#imageUploadGrid");
  const newPreviews = PENDING_IMAGE_FILES.map((f) => URL.createObjectURL(f));
  const allTiles = [
    ...EXISTING_IMAGE_URLS.map((url, i) => ({ url, type: "existing", index: i })),
    ...newPreviews.map((url, i) => ({ url, type: "new", index: i }))
  ];

  grid.innerHTML = allTiles.map((tile) => `
    <div class="image-upload-tile">
      <img src="${tile.url}" alt="Room photo">
      <button type="button" class="remove-img" data-type="${tile.type}" data-index="${tile.index}" title="Remove">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    </div>`).join("") + `
    <label class="image-upload-tile add-tile">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 5v14M5 12h14"/></svg>
      Add photo
      <input type="file" id="roomImageInput" accept="image/*" multiple class="hidden">
    </label>`;

  qs("#roomImageInput")?.addEventListener("change", handleImageSelection);
  qsa(".remove-img", grid).forEach((btn) => btn.addEventListener("click", () => {
    if (btn.dataset.type === "existing") EXISTING_IMAGE_URLS.splice(+btn.dataset.index, 1);
    else PENDING_IMAGE_FILES.splice(+btn.dataset.index, 1);
    renderImageTiles();
  }));
}

function handleImageSelection(e) {
  PENDING_IMAGE_FILES.push(...Array.from(e.target.files));
  renderImageTiles();
}

async function saveRoom(e) {
  e.preventDefault();
  const btn = qs("#roomSaveBtn");

  const roomNumber = qs("#roomNumberInput").value.trim();
  const type = qs("#roomTypeInput").value.trim();
  const pricePerNight = parseFloat(qs("#roomPriceInput").value);
  const maxGuests = parseInt(qs("#roomMaxGuestsInput").value, 10);

  if (!Validate.required(roomNumber) || !Validate.required(type) || !(pricePerNight > 0) || !(maxGuests > 0)) {
    showToast("Missing information", "Room number, type, price, and capacity are required.", "error");
    return;
  }

  setButtonLoading(btn, true, EDITING_ROOM_ID ? "Saving…" : "Creating…");
  try {
    const roomId = EDITING_ROOM_ID || db.collection(COLLECTIONS.ROOMS).doc().id;

    // Upload any newly-added images to Storage under this room's folder.
    const uploadedUrls = [];
    for (const file of PENDING_IMAGE_FILES) {
      const path = `room-images/${roomId}/${Date.now()}-${file.name}`;
      const ref = storage.ref(path);
      await ref.put(file);
      uploadedUrls.push(await ref.getDownloadURL());
    }

    const payload = {
      roomNumber, type, pricePerNight, maxGuests,
      bedType: qs("#roomBedTypeInput").value.trim(),
      size: parseInt(qs("#roomSizeInput").value, 10) || null,
      status: qs("#roomStatusInput").value,
      description: qs("#roomDescriptionInput").value.trim(),
      amenities: qs("#roomAmenitiesInput").value.split(",").map((a) => a.trim()).filter(Boolean),
      images: [...EXISTING_IMAGE_URLS, ...uploadedUrls],
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (EDITING_ROOM_ID) {
      await db.collection(COLLECTIONS.ROOMS).doc(roomId).update(payload);
      showToast("Room updated", `Room ${roomNumber} has been saved.`, "success");
    } else {
      payload.createdAt = firebase.firestore.FieldValue.serverTimestamp();
      await db.collection(COLLECTIONS.ROOMS).doc(roomId).set(payload);
      showToast("Room added", `Room ${roomNumber} is now live.`, "success");
    }

    closeRoomModal();
    loadAdminRooms();
  } catch (err) {
    console.error(err);
    showToast("Couldn't save room", err.message, "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

window.deleteRoom = function (roomId) {
  const room = ADMIN_ROOMS_CACHE.find((r) => r.id === roomId);
  if (!confirm(`Delete Room ${room?.roomNumber}? This can't be undone.`)) return;

  db.collection(COLLECTIONS.ROOMS).doc(roomId).delete()
    .then(() => { showToast("Room deleted", `Room ${room?.roomNumber} was removed.`, "success"); loadAdminRooms(); })
    .catch((err) => showToast("Couldn't delete room", err.message, "error"));
};

function bedIcon() { return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 18v-8a2 2 0 012-2h4a2 2 0 012 2v3M3 18v2M3 18h18M13 13h6a2 2 0 012 2v3M21 18v2M7 11V7a2 2 0 012-2h0"/></svg>'; }
function editIcon() { return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4z"/></svg>'; }
function trashIcon() { return '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z"/></svg>'; }
