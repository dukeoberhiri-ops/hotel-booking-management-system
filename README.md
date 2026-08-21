# Aurelio Hotels — Booking & Management System

A production-styled hotel booking and management platform built with plain HTML, CSS, and JavaScript on top of Firebase (Authentication, Firestore, Storage). No build step, no framework — open `index.html` in a browser once Firebase is configured and it runs.

**Design language:** quiet luxury hospitality — deep emerald and brass palette, a serif/sans type pairing, and a recurring "keycard stripe" motif (the brass gradient bar) used across cards, the hero, and booking confirmations.

---

## 1. Project structure

```
hotel-booking-system/
├── index.html                 Landing page (hero, search, featured rooms, gallery)
├── rooms.html                 Browse all rooms — search, filter, sort
├── room-detail.html           Single room — gallery, amenities, booking form
├── login.html                  Includes one-click "Login as Demo Admin/User" buttons
├── register.html
├── forgot-password.html
├── demo-setup.html             One-time page that provisions the two permanent demo accounts
├── account.html                Customer dashboard — profile + live booking history + message thread
├── admin/
│   ├── dashboard.html          Admin stats + charts + recent bookings
│   ├── rooms.html               Room CRUD + image upload
│   ├── bookings.html            Approve / cancel / complete bookings
│   ├── customers.html           Guest list + lifetime spend
│   ├── messages.html            Real-time guest conversation inbox, grouped per guest
│   ├── reports.html             Daily/monthly/occupancy/revenue charts
│   └── seed.html                Signed-in account info + demo data seed/reset tools (always reachable via sidebar)
├── css/
│   ├── main.css                 Design tokens, reset, nav, buttons, cards, forms, toasts, modals, demo guide
│   ├── public.css               Landing / rooms / room-detail specific styles
│   ├── auth.css                 Login / register / forgot-password layout
│   └── dashboard.css            Shared admin + customer account layout, message bubbles
├── js/
│   ├── firebase-config.js       ⚠️ Paste your Firebase config here
│   ├── firebase-init.js         Initializes Firebase + shared constants (incl. DEMO_ACCOUNTS)
│   ├── utils.js                 Toasts, formatters, validators, helpers
│   ├── nav.js                   Navbar auth-state UI, mobile menu, demo guide modal
│   ├── auth.js                  Login / register / forgot-password logic + demo login buttons
│   ├── auth-guard.js            Route protection (auth + admin-only pages)
│   ├── rooms.js                 Room browsing, search, filter, sort
│   ├── room-detail.js           Room detail + availability + booking submit
│   ├── chatbot.js                Self-injecting FAQ chatbot widget with front-desk escalation
│   ├── account.js               Customer profile + live booking history/cancel + message thread
│   ├── admin-dashboard.js       Stat cards + charts + recent bookings
│   ├── admin-rooms.js           Room CRUD + Storage image upload
│   ├── admin-bookings.js        Booking approval/cancellation workflow
│   ├── admin-customers.js       Guest management
│   ├── admin-messages.js        Real-time message inbox + reply
│   └── admin-reports.js         All report charts
├── data/
│   └── sample-data.js           9 sample rooms + seedDemoData()/resetDemoData() helpers
├── firestore.rules              Firestore security rules
├── storage.rules                Storage security rules
└── README.md
```

Every HTML page is self-contained and loads only the scripts it needs — there's no bundler, so scripts are plain `<script src="...">` tags in dependency order (Firebase SDK → config → init → utils → page logic).

---

## 2. Firebase setup (step by step)

### 2.1 Create the project
1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. Name it (e.g. `aurelio-hotels`) and finish the wizard (Google Analytics is optional).

### 2.2 Register a web app
1. In the project overview, click the **`</>`** (web) icon to add a web app.
2. Give it a nickname (e.g. "Aurelio Web"). You don't need Firebase Hosting here since we're deploying to Netlify.
3. Firebase shows a `firebaseConfig` object. Copy it.

### 2.3 Paste the config — **exactly where**
Open **`js/firebase-config.js`** and replace the placeholder values:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "aurelio-hotels.firebaseapp.com",
  projectId: "aurelio-hotels",
  storageBucket: "aurelio-hotels.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```
This is the **only file** you need to edit to connect the app to your Firebase project.

### 2.4 Enable Authentication
1. Console → **Build → Authentication → Get started**.
2. Under **Sign-in method**, enable **Email/Password**.
3. (Optional) Under **Templates**, customize the password-reset email.

### 2.5 Create Firestore
1. Console → **Build → Firestore Database → Create database**.
2. Choose **Production mode** (rules below lock it down properly) and pick a region.
3. You don't need to manually create collections — the app creates `users`, `rooms`, and `bookings` documents the first time it writes to them. Composite indexes (below) are the one thing worth adding ahead of time.

### 2.6 Required indexes
Almost nothing here needs a manual index. The app deliberately avoids combining a `.where()` filter with `.orderBy()` on a different field in its real-time listeners (bookings, messages) — that combination is what forces Firestore to require a manually-created composite index, and forgetting to create one is a common source of a query silently failing with "The query requires an index." Instead, those lists are sorted client-side in JavaScript after a plain filtered fetch, which needs no extra setup at all.

The one query that combines two conditions is the room-availability check in `room-detail.js` (`roomId == X` and `status in [...]`) — this is two equality-style filters, which Firestore can usually serve from its automatic single-field indexes without a composite index. If it ever does prompt for one, Firestore's error includes a direct "Create index" link — click it, wait ~30 seconds, and retry.


### 2.7 Enable Storage
1. Console → **Build → Storage → Get started** → choose the same region as Firestore.
2. Room photos are uploaded to `room-images/{roomId}/{fileName}` from **Admin → Rooms**.

### 2.8 Paste the security rules
- **Firestore:** Console → Firestore Database → **Rules** tab → replace everything with the contents of `firestore.rules` in this repo → **Publish**.
- **Storage:** Console → Storage → **Rules** tab → replace everything with the contents of `storage.rules` → **Publish**.

### 2.9 Required collections (reference)
You don't create these manually — they're described here so the data model is clear:

**`users/{uid}`**
```js
{ fullName, email, phone, role: "customer"|"admin", status: "active"|"suspended", createdAt }
```

**`rooms/{roomId}`**
```js
{
  roomNumber, type, pricePerNight, maxGuests, bedType, size,
  status: "available"|"unavailable"|"maintenance",
  description, amenities: [string], images: [url],
  createdAt, updatedAt
}
```

**`bookings/{bookingId}`**
```js
{
  bookingCode, userId, userName, userEmail,
  roomId, roomNumber, roomType, roomImage,
  checkIn: "YYYY-MM-DD", checkOut: "YYYY-MM-DD", nights, guests,
  pricePerNight, totalPrice,
  status: "pending"|"confirmed"|"cancelled"|"completed",
  specialRequests, createdAt, updatedAt
}
```

**`messages/{messageId}`** — a flat, real two-way conversation log. Every message (from the guest or from staff) is its own document; `userId` always identifies *whose conversation* this is (the guest), while `senderRole` identifies who actually sent this particular message. Grouping all documents that share a `userId` and sorting by `createdAt` reconstructs the full back-and-forth thread.
```js
{
  userId, userName, userEmail,       // whose conversation this is (the guest)
  senderRole: "guest"|"admin",       // who sent this specific message
  senderName, message,
  createdAt
}
```

### 2.10 Promoting a user to admin
There's no self-serve admin signup (by design — see `firestore.rules`). After someone registers normally:
1. Console → Firestore Database → `users` collection → open their document.
2. Change the `role` field from `customer` to `admin`.
3. They'll see the **Admin dashboard** link next time they log in (or refresh).

### 2.11 Set up demo accounts and data
This project ships with a full "instant demo" flow so a prospective client can explore it with zero setup:

1. Open **`demo-setup.html`** once (e.g. `https://your-site.netlify.app/demo-setup.html`) and click **Create demo accounts**. This creates two permanent Firebase Auth accounts:
   - **Demo Admin** — `admin@example.com` / `Demo123!` (self-provisions as `role: admin` — see the `isDemoAdminEmail()` exception in `firestore.rules`)
   - **Demo User** — `user@example.com` / `Demo123!` (a normal `role: customer` account)
2. Log in as **Demo Admin** (either type the credentials or click **Login as Demo Admin** on the login page) and go to **Admin → Demo data** (`admin/seed.html`).
3. Click **Seed demo data**. This adds 9 sample rooms, three realistic bookings owned by the Demo User (one pending, one confirmed, one completed past stay), and two front-desk messages (one open, one already replied) — so the dashboard, bookings list, and inbox all look like a real, active hotel immediately.
4. **Reset demo data** (same page) wipes rooms/bookings/messages and reseeds from scratch — handy to clean up after a round of client demos. **Demo data** is always reachable from the sidebar for any admin, but its seed/reset buttons only become enabled when signed in as `admin@example.com` — other admins you promote later see the page (with an account info section) but those two buttons stay disabled for them.

This only needs to be done once per Firebase project — the accounts and their data persist normally.

### 2.12 The one-click demo login buttons
`login.html` has **Login as Demo Admin** and **Login as Demo User** buttons that sign straight in with the credentials above — no typing required. This is the fastest way for a visitor to explore the app: **Open the site → click a demo button → they're in.**

The first time a demo account signs in on a given browser tab, a dismissible banner appears under the navbar ("Welcome to the demo! …"), shown once per session via `sessionStorage`.

### 2.13 How the demo accounts interact
- A booking or message the Demo User creates shows up immediately in the admin's **Bookings** / **Messages** pages (both are `onSnapshot` real-time listeners, not one-time reads).
- When the Demo Admin approves/cancels a booking or replies to a message, the Demo User's **My Account** page updates live — no refresh needed.
- This is the same real-time pattern any two real accounts (guest + staff) use day to day; the demo accounts don't have special interaction logic beyond the one-time admin self-provisioning noted above.

---

## 3. Running locally
No build step is required. Any static file server works, for example:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open `http://localhost:PORT/index.html`. (Opening `index.html` directly via `file://` also works for browsing, but some browsers block Firebase Auth persistence on `file://` — a local server is recommended.)

---

## 4. Deployment guide (Netlify)

### Option A — drag and drop
1. Run `npm run build`... there is none — this is a static site, so skip straight to zipping the **project root folder** (the one containing `index.html`).
2. Go to [app.netlify.com](https://app.netlify.com) → **Sites** → drag the folder onto the deploy zone.
3. Netlify serves it immediately at a generated `*.netlify.app` URL.

### Option B — Git-based deploy (recommended)
1. Push this project to a GitHub/GitLab/Bitbucket repo.
2. Netlify → **Add new site → Import an existing project** → connect the repo.
3. Build settings:
   - **Build command:** *(leave blank — no build step)*
   - **Publish directory:** `.` (project root)
4. Deploy. Netlify auto-redeploys on every push.

### Add your Firebase Auth domain
Firebase Auth only allows sign-in from **authorized domains**:
1. Firebase Console → Authentication → **Settings → Authorized domains**.
2. Add your Netlify domain (e.g. `aurelio-hotels.netlify.app`) and any custom domain you attach later.

### Optional: `_redirects` for clean routing
Not required (every page is a real `.html` file), but if you later want pretty URLs, add a `_redirects` file mapping paths to the corresponding `.html` files.

---

## 5. Feature reference

**Guests (public + logged in)**
- Browse/search/filter rooms by type, guest count, and keyword; sort by price
- View a room's full gallery, amenities, and description
- Live availability check against existing bookings (prevents double-booking, re-validated at submit time to close the race-condition window)
- Register / log in / forgot password / persistent session / logout — every login path (typed credentials, demo buttons, fresh registration) lands you in **My Account**, never the public homepage; a signed-in visitor who navigates back to `index.html`, `login.html`, or `register.html` is redirected straight back out again
- One-click **Login as Demo Guest** button (no typing credentials)
- Book a room, see a keycard-styled confirmation, track status from **My Account** — updates live if staff approve/cancel it while you're on the page
- Cancel a booking while it's still `pending` or `confirmed` and in the future
- Message the front desk from **My Account**; it's a real back-and-forth conversation, not a one-message ticket — send several messages in a row and staff replies appear instantly, no refresh
- A floating **FAQ chatbot** (bottom-left, on every guest-facing page) answers common questions instantly — check-in times, Wi-Fi, parking, cancellations, and more — with zero backend or API cost. When it can't help, one click escalates straight into the real front-desk conversation above, so guests always have a path to a human
- Real-time notifications work even when you're not looking at Messages: a toast pops up the instant a reply arrives, and a numbered badge on the account avatar (top right) shows how many replies are unread — clears automatically the moment you open My Account
- Edit profile (name, phone)

**Admin**
- Dashboard: total rooms, pending approvals, total revenue, today's occupancy, 14-day revenue trend, bookings-by-room-type
- One-click **Login as Demo Admin** button (no typing credentials)
- Rooms: add/edit/delete, multi-image upload to Storage, set price/capacity/status/amenities
- Bookings: filter by status, search, approve (pending → confirmed), cancel, mark completed, view full detail — can also create a booking on a guest's behalf (e.g. a phone reservation)
- Messages: a real conversation inbox grouped by guest (not one ticket per message) — open a guest's thread and reply inline; sidebar shows a live, numbered count of guests awaiting a reply, and a toast pops up the instant a new guest message arrives, even while working on a different page
- Customers: list every guest, their booking count and lifetime spend, suspend/reactivate accounts
- Reports: daily bookings (30d), monthly bookings & revenue (12mo), occupancy trend (14d), most-booked room types — all charted with Chart.js
- **Demo data** (`admin/seed.html`, its seed/reset tools visible only to the `admin@example.com` demo account): seed or fully reset the demo rooms/bookings/messages in one click

---

## 6. Demo mode

This project includes an "instant demo" layer so a prospective client can explore it with zero setup — see **§2.11–2.13** above for the full walkthrough. In short:

1. Run `demo-setup.html` once to create the two permanent accounts (`admin@example.com` / `user@example.com`, both `Demo123!`).
2. Log in as Demo Admin → **Admin → Demo data** → **Seed demo data** to populate realistic rooms, bookings, and messages.
3. From then on, anyone can click **Login as Demo Admin** or **Login as Demo Guest** on the login page and be exploring the app within a second — no registration, no credentials to remember.
4. The two accounts interact through the same real-time listeners any two real accounts would use: a guest's booking or message appears for staff instantly, and a staff reply/approval appears for the guest instantly.
5. The **Demo data** page is always visible in the sidebar for any admin — but its seed/reset buttons are only enabled when signed in as `admin@example.com`, so real staff accounts (promoted the normal way, per §2.10) can see the account section but can't accidentally wipe live data. Gating the buttons rather than hiding the whole page/link was a deliberate choice: a visibility toggle that depends on JavaScript succeeding is one more thing that can silently fail and leave a feature unreachable — a permanently visible link with a disabled state is far more robust.

---

## 7. Notes on the booking/availability model

Overlap detection is done client-side against the small set of `pending`/`confirmed` bookings for a single room (typically a handful of documents), which is simple and fast without needing Cloud Functions. The check runs twice: once live as the guest picks dates, and again immediately before the write, to shrink the window where two people could book the same dates simultaneously. For a high-traffic production deployment, the recommended hardening is a Cloud Function using a Firestore transaction to make the check-and-write atomic — noted here rather than implemented, since it requires a paid (Blaze) plan and a deploy pipeline beyond this project's "Firebase config only" scope.

---

## 8. Code quality conventions

- One responsibility per JS file; every file opens with a comment block explaining its role.
- Shared logic (formatting, validation, toasts) lives once in `utils.js` — no copy-pasted helpers across pages.
- All Firestore field/collection names are centralized in `js/firebase-init.js` (`COLLECTIONS`, `BOOKING_STATUS`, `ROOM_STATUS`, `ROLES`, `DEMO_ACCOUNTS`) so a typo can't silently create a mismatched field.
- CSS uses design tokens (custom properties) for color/spacing/radius — no magic hex values scattered through component styles.
- Every list view (rooms, bookings, customers, messages) has a loading skeleton, an empty state, and an error state — never a blank screen.
- Bookings and messages use real-time Firestore listeners (`onSnapshot`) rather than one-time reads wherever a second party (guest ↔ staff) needs to see the other's changes without a refresh.
