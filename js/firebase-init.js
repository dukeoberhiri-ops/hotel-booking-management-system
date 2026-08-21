/**
 * FIREBASE INIT
 * Initializes the Firebase app (compat SDK — loaded via <script> tags, no
 * bundler required) and exposes shared handles used across every page.
 */
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

// Keep the user signed in across tabs/reloads (persistent login).
auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch((err) => {
  console.error("Auth persistence error:", err);
});

/** Collection name constants — keep every file in sync with Firestore. */
const COLLECTIONS = {
  ROOMS: "rooms",
  BOOKINGS: "bookings",
  USERS: "users",
  REVIEWS: "reviews",
  MESSAGES: "messages"
};

/** Demo account constants — used by demo-setup.html, login demo buttons, and seeding. */
const DEMO_ACCOUNTS = {
  ADMIN: { email: "admin@example.com", password: "Demo123!", fullName: "Alex Rivera (Demo Admin)" },
  USER: { email: "user@example.com", password: "Demo123!", fullName: "Jordan Blake (Demo Guest)" }
};

/** Booking status constants. */
const BOOKING_STATUS = {
  PENDING: "pending",
  CONFIRMED: "confirmed",
  CANCELLED: "cancelled",
  COMPLETED: "completed"
};

/** Room status constants. */
const ROOM_STATUS = {
  AVAILABLE: "available",
  UNAVAILABLE: "unavailable",
  MAINTENANCE: "maintenance"
};

/** Role constant used on the /users/{uid} document. */
const ROLES = { ADMIN: "admin", CUSTOMER: "customer" };
