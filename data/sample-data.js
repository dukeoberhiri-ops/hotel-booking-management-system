/**
 * SAMPLE DATA
 * Nine realistic rooms across five categories, used to seed a fresh
 * Firestore database so the app looks fully populated immediately.
 * Run this from admin/seed.html — see README "Set up demo accounts and data".
 */
const SAMPLE_ROOMS = [
  {
    roomNumber: "101", type: "Standard Double", pricePerNight: 129, maxGuests: 2, bedType: "Queen bed", size: 280,
    status: "available",
    description: "A bright, comfortable room with garden views — ideal for short stays and business trips.",
    amenities: ["Free Wi-Fi", "Air conditioning", "Smart TV", "Work desk", "Coffee maker", "Daily housekeeping"],
    images: ["https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80", "https://images.unsplash.com/photo-1598928506311-c55ded91a20c?w=1200&q=80"]
  },
  {
    roomNumber: "102", type: "Standard Double", pricePerNight: 129, maxGuests: 2, bedType: "Twin beds", size: 280,
    status: "available",
    description: "Twin-bed layout perfect for colleagues or friends traveling together, steps from the lobby.",
    amenities: ["Free Wi-Fi", "Air conditioning", "Smart TV", "Work desk", "Coffee maker"],
    images: ["https://images.unsplash.com/photo-1584132967334-10e028bd69f7?w=1200&q=80"]
  },
  {
    roomNumber: "204", type: "Deluxe King", pricePerNight: 219, maxGuests: 3, bedType: "King bed", size: 380,
    status: "available",
    description: "A generously sized room with a plush king bed, city views, and a spa-style marble bathroom.",
    amenities: ["Free Wi-Fi", "Air conditioning", "55\" Smart TV", "Mini bar", "Rainfall shower", "Bathrobes", "Nespresso machine"],
    images: ["https://images.unsplash.com/photo-1590490360182-c33d57733427?w=1200&q=80", "https://images.unsplash.com/photo-1560185127-6ed189bf02f4?w=1200&q=80", "https://images.unsplash.com/photo-1560185009-5bf9f2849488?w=1200&q=80"]
  },
  {
    roomNumber: "205", type: "Deluxe King", pricePerNight: 229, maxGuests: 3, bedType: "King bed", size: 380,
    status: "available",
    description: "Corner deluxe room with wraparound windows and an oversized reading nook.",
    amenities: ["Free Wi-Fi", "Air conditioning", "55\" Smart TV", "Mini bar", "Rainfall shower", "Bathrobes"],
    images: ["https://images.unsplash.com/photo-1611048268330-53de574cae3b?w=1200&q=80"]
  },
  {
    roomNumber: "310", type: "Executive Suite", pricePerNight: 349, maxGuests: 4, bedType: "King bed + sofa bed", size: 620,
    status: "available",
    description: "A separate living area, dining nook, and panoramic skyline views make this suite ideal for extended stays.",
    amenities: ["Free Wi-Fi", "Air conditioning", "Living area", "Dining table", "Mini bar", "Nespresso machine", "Bathrobes", "Turndown service", "Butler on call"],
    images: ["https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80", "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?w=1200&q=80", "https://images.unsplash.com/photo-1591088398332-8a7791972843?w=1200&q=80", "https://images.unsplash.com/photo-1595576508898-0ad5c879a061?w=1200&q=80"]
  },
  {
    roomNumber: "311", type: "Executive Suite", pricePerNight: 359, maxGuests: 4, bedType: "King bed + sofa bed", size: 640,
    status: "maintenance",
    description: "Our signature corner suite, currently being refreshed with new furnishings — reopening soon.",
    amenities: ["Free Wi-Fi", "Air conditioning", "Living area", "Dining table", "Mini bar", "Butler on call"],
    images: ["https://images.unsplash.com/photo-1611892440504-42a792e24d32?w=1200&q=80"]
  },
  {
    roomNumber: "402", type: "Family Room", pricePerNight: 259, maxGuests: 5, bedType: "King bed + bunk beds", size: 520,
    status: "available",
    description: "Designed for families — a playful bunk nook for the kids and a quiet king-bed corner for parents.",
    amenities: ["Free Wi-Fi", "Air conditioning", "Smart TV", "Mini fridge", "Board games", "Crib on request", "Blackout curtains"],
    images: ["https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=1200&q=80", "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=1200&q=80"]
  },
  {
    roomNumber: "501", type: "Penthouse", pricePerNight: 649, maxGuests: 6, bedType: "2 King beds", size: 1100,
    status: "available",
    description: "The top of the house — a private terrace, plunge pool, and floor-to-ceiling views of the harbor.",
    amenities: ["Free Wi-Fi", "Private terrace", "Plunge pool", "Full kitchen", "Living & dining rooms", "Butler on call", "Nespresso machine", "Bathrobes", "Turndown service"],
    images: ["https://images.unsplash.com/photo-1602343168117-bb8ffe3e2e9f?w=1200&q=80", "https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200&q=80", "https://images.unsplash.com/photo-1631889993959-41b4e9c6e3c5?w=1200&q=80"]
  },
  {
    roomNumber: "115", type: "Standard Double", pricePerNight: 135, maxGuests: 2, bedType: "Queen bed", size: 290,
    status: "unavailable",
    description: "Currently occupied on a long-term booking; check back for future availability.",
    amenities: ["Free Wi-Fi", "Air conditioning", "Smart TV", "Work desk"],
    images: ["https://images.unsplash.com/photo-1598928636135-d146006ff4be?w=1200&q=80"]
  }
];

async function seedDatabase() {
  const batch = db.batch();
  SAMPLE_ROOMS.forEach((room) => {
    const ref = db.collection(COLLECTIONS.ROOMS).doc();
    batch.set(ref, { ...room, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
  });
  await batch.commit();
  return SAMPLE_ROOMS.length;
}

/**
 * DEMO DATA
 * Seeds rooms + a handful of realistic bookings and messages tied to the
 * permanent Demo User account, so the moment someone clicks "Login as
 * Demo Admin" the dashboard, bookings list, and inbox all look like a real,
 * active hotel rather than an empty database. Run from admin/seed.html,
 * which restricts access to the admin@example.com demo account.
 */
async function seedDemoData() {
  // 1. Rooms — same catalog used by seedDatabase(), but we keep references
  // so we can attach realistic bookings to specific rooms below.
  const roomBatch = db.batch();
  const roomRefs = SAMPLE_ROOMS.map((room) => {
    const ref = db.collection(COLLECTIONS.ROOMS).doc();
    roomBatch.set(ref, { ...room, createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    return { ref, room };
  });
  await roomBatch.commit();

  // 2. Find the permanent Demo User account so seeded bookings/messages
  // belong to a real, logged-in-able guest (not a fake floating userId).
  const demoUserSnap = await db.collection(COLLECTIONS.USERS).where("email", "==", DEMO_ACCOUNTS.USER.email).limit(1).get();
  if (demoUserSnap.empty) {
    return { rooms: roomRefs.length, bookings: 0, messages: 0, warning: "Demo User account not found — run demo-setup.html first." };
  }
  const demoUser = { uid: demoUserSnap.docs[0].id, ...demoUserSnap.docs[0].data() };

  // 3. Bookings — a mix of pending / confirmed / a completed past stay, so
  // both the admin approval workflow and the guest's history look real.
  const [roomA, roomB, roomC] = roomRefs;
  const bookingSeeds = [
    { room: roomA, checkIn: addDaysISO(todayISO(), 5), checkOut: addDaysISO(todayISO(), 8), guests: 2, status: BOOKING_STATUS.PENDING },
    { room: roomB, checkIn: addDaysISO(todayISO(), 14), checkOut: addDaysISO(todayISO(), 17), guests: 3, status: BOOKING_STATUS.CONFIRMED },
    { room: roomC, checkIn: addDaysISO(todayISO(), -20), checkOut: addDaysISO(todayISO(), -17), guests: 2, status: BOOKING_STATUS.COMPLETED }
  ];

  const bookingBatch = db.batch();
  bookingSeeds.forEach((seed) => {
    const nights = nightsBetween(seed.checkIn, seed.checkOut);
    const subtotal = nights * seed.room.room.pricePerNight;
    const totalPrice = subtotal + Math.round(subtotal * 0.12);
    const ref = db.collection(COLLECTIONS.BOOKINGS).doc();
    bookingBatch.set(ref, {
      bookingCode: generateBookingCode(),
      userId: demoUser.uid, userName: demoUser.fullName, userEmail: demoUser.email,
      roomId: seed.room.ref.id, roomNumber: seed.room.room.roomNumber, roomType: seed.room.room.type, roomImage: seed.room.room.images?.[0] || "",
      checkIn: seed.checkIn, checkOut: seed.checkOut, nights, guests: seed.guests,
      pricePerNight: seed.room.room.pricePerNight, totalPrice,
      // Firestore rules cap an admin-authored create at pending/confirmed —
      // a genuinely "completed" stay is written as confirmed here, then
      // flipped to completed in a follow-up update below.
      status: seed.status === BOOKING_STATUS.COMPLETED ? BOOKING_STATUS.CONFIRMED : seed.status,
      specialRequests: "", createdAt: firebase.firestore.FieldValue.serverTimestamp(), updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    seed._ref = ref;
    seed._finalStatus = seed.status;
  });
  await bookingBatch.commit();

  const completedFixups = bookingSeeds.filter((s) => s._finalStatus === BOOKING_STATUS.COMPLETED);
  if (completedFixups.length) {
    const fixupBatch = db.batch();
    completedFixups.forEach((s) => fixupBatch.update(s._ref, { status: BOOKING_STATUS.COMPLETED, updatedAt: firebase.firestore.FieldValue.serverTimestamp() }));
    await fixupBatch.commit();
  }

  // 4. Messages — a real, realistic back-and-forth conversation ending on
  // an unanswered guest message, so the demo admin has something live to
  // reply to immediately. Explicit staggered timestamps (rather than
  // serverTimestamp) guarantee correct chronological order — a batch
  // commit can otherwise give every document in it the same server time,
  // which would make the conversation's order ambiguous on first render.
  const now = Date.now();
  const conversationSeed = [
    { role: "guest", name: demoUser.fullName, text: "Hi! Could I request a high floor with a city view for my upcoming stay?", offsetMin: -180 },
    { role: "admin", name: "Front Desk", text: "Of course — I've added a note to your reservation requesting a high floor with a city view. We'll do our best to accommodate it.", offsetMin: -175 },
    { role: "guest", name: demoUser.fullName, text: "Perfect, thank you! One more thing — what time is check-in, and is early check-in possible?", offsetMin: -60 },
    { role: "admin", name: "Front Desk", text: "Standard check-in is 3:00 PM, but send us your flight time and we'll try to have your room ready earlier.", offsetMin: -55 },
    { role: "guest", name: demoUser.fullName, text: "Great — I'll be landing around 11am, hoping to check in right after!", offsetMin: -3 }
  ];

  const messageBatch = db.batch();
  conversationSeed.forEach((m) => {
    const ref = db.collection(COLLECTIONS.MESSAGES).doc();
    messageBatch.set(ref, {
      userId: demoUser.uid, userName: demoUser.fullName, userEmail: demoUser.email,
      senderRole: m.role, senderName: m.name, message: m.text,
      createdAt: firebase.firestore.Timestamp.fromDate(new Date(now + m.offsetMin * 60000))
    });
  });
  await messageBatch.commit();

  return { rooms: roomRefs.length, bookings: bookingSeeds.length, messages: conversationSeed.length };
}

/**
 * Deletes every room, booking, and message, then reseeds fresh demo data.
 * Restricted in the UI to the demo admin account (see admin/seed.html).
 */
async function resetDemoData() {
  await deleteAllDocsIn(COLLECTIONS.ROOMS);
  await deleteAllDocsIn(COLLECTIONS.BOOKINGS);
  await deleteAllDocsIn(COLLECTIONS.MESSAGES);
  return seedDemoData();
}

async function deleteAllDocsIn(collectionName) {
  const snap = await db.collection(collectionName).get();
  if (snap.empty) return;
  // Firestore batches cap at 500 writes — chunk defensively even though
  // this demo dataset is always small.
  const chunks = [];
  for (let i = 0; i < snap.docs.length; i += 400) chunks.push(snap.docs.slice(i, i + 400));
  for (const chunk of chunks) {
    const batch = db.batch();
    chunk.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}
