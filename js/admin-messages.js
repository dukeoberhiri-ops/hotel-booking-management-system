/**
 * ADMIN MESSAGES
 * Every message document (from either a guest or a staff reply) shares the
 * same `userId` — the guest's uid, i.e. "whose conversation this is." That
 * lets this page group the flat messages collection into one continuous
 * thread per guest, the way a real support inbox works, instead of
 * treating every message as its own isolated ticket needing exactly one
 * reply. Replying here simply adds a new message document to that same
 * conversation; the guest's account.js listener picks it up instantly.
 */
let ADMIN_MESSAGES_CACHE = []; // flat, every message document
let ADMIN_CONVERSATIONS = [];  // grouped by userId, newest activity first
let ACTIVE_CONVERSATION_ID = null; // = the guest's userId
let ADMIN_PROFILE = null;

document.addEventListener("authReady", (e) => {
  ADMIN_PROFILE = e.detail;
  watchAllMessages();
  qs("#messageFilterTabs")?.addEventListener("click", (e) => {
    const tab = e.target.closest(".panel-tab");
    if (!tab) return;
    qsa("#messageFilterTabs .panel-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    renderConversationList();
  });
  qs("#adminReplyForm")?.addEventListener("submit", sendAdminReply);
});

function watchAllMessages() {
  const list = qs("#messageInboxList");
  if (!list) return;
  list.innerHTML = Array(3).fill('<div class="skeleton" style="height:64px;margin-bottom:10px;"></div>').join("");

  db.collection(COLLECTIONS.MESSAGES).orderBy("createdAt", "desc")
    .onSnapshot((snap) => {
      ADMIN_MESSAGES_CACHE = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      groupIntoConversations();
      renderConversationList();
      if (ACTIVE_CONVERSATION_ID) renderConversationThread(ACTIVE_CONVERSATION_ID);
    }, (err) => {
      console.error(err);
      list.innerHTML = `<div class="empty-state"><h3>Couldn't load messages</h3><p>${escapeHtml(err.message)}</p></div>`;
    });
}

/** Folds the flat, newest-first message list into one entry per guest. */
function groupIntoConversations() {
  const byGuest = new Map();
  // ADMIN_MESSAGES_CACHE is already newest-first (from the orderBy query),
  // so the first message we see for a given userId is that conversation's
  // most recent activity.
  for (const m of ADMIN_MESSAGES_CACHE) {
    if (!byGuest.has(m.userId)) {
      byGuest.set(m.userId, {
        userId: m.userId, userName: m.userName, userEmail: m.userEmail,
        lastMessage: m.message, lastSenderRole: m.senderRole || "guest", lastAt: m.createdAt,
        messages: []
      });
    }
    byGuest.get(m.userId).messages.push(m);
  }
  ADMIN_CONVERSATIONS = Array.from(byGuest.values());
}

function renderConversationList() {
  const list = qs("#messageInboxList");
  const filter = qs("#messageFilterTabs .panel-tab.active")?.dataset.filter || "all";
  const filtered = ADMIN_CONVERSATIONS.filter((c) => {
    if (filter === "open") return c.lastSenderRole !== "admin"; // guest sent the last message — awaiting a reply
    if (filter === "replied") return c.lastSenderRole === "admin";
    return true;
  });

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><div class="icon-wrap">${chatIcon()}</div><h3>No conversations</h3><p>Guest messages will appear here as they come in.</p></div>`;
    return;
  }

  list.innerHTML = filtered.map((c) => `
    <button class="message-list-item ${c.userId === ACTIVE_CONVERSATION_ID ? "active" : ""}" data-id="${c.userId}"
      style="display:block; width:100%; text-align:left; padding:14px; border-radius:12px; border:1px solid var(--border); margin-bottom:8px; ${c.userId === ACTIVE_CONVERSATION_ID ? "border-color:var(--primary); background:var(--primary-tint);" : "background:var(--surface);"}">
      <div class="flex justify-between items-center gap-2 mb-2">
        <div class="cell-user"><span class="cell-avatar">${initials(c.userName)}</span><b style="font-size:13.5px;">${escapeHtml(c.userName)}</b></div>
        <span class="badge ${c.lastSenderRole === "admin" ? "badge-confirmed" : "badge-pending"}">${c.lastSenderRole === "admin" ? "Replied" : "Awaiting reply"}</span>
      </div>
      <p class="text-soft" style="font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${c.lastSenderRole === "admin" ? "You: " : ""}${escapeHtml(c.lastMessage)}</p>
      <span class="text-faint" style="font-size:11px;">${formatDateTime(c.lastAt)}</span>
    </button>`).join("");

  qsa(".message-list-item", list).forEach((btn) => btn.addEventListener("click", () => {
    ACTIVE_CONVERSATION_ID = btn.dataset.id;
    renderConversationList();
    renderConversationThread(ACTIVE_CONVERSATION_ID);
  }));
}

function renderConversationThread(userId) {
  const convo = ADMIN_CONVERSATIONS.find((c) => c.userId === userId);
  const panel = qs("#threadDetailPanel");
  if (!convo || !panel) return;

  panel.classList.remove("hidden");
  qs("#threadGuestName").textContent = convo.userName;
  qs("#threadGuestEmail").textContent = convo.userEmail;

  const oldestFirst = [...convo.messages].reverse();
  const body = qs("#threadMessageBody");
  body.innerHTML = oldestFirst.map((m) => {
    const isGuest = m.senderRole !== "admin";
    const label = isGuest ? escapeHtml(convo.userName) : "You";
    return `<div class="message-bubble ${isGuest ? "from-guest" : "from-admin"}">${escapeHtml(m.message)}<span class="msg-meta">${label} · ${formatDateTime(m.createdAt)}</span></div>`;
  }).join("");
  body.scrollTop = body.scrollHeight;
}

async function sendAdminReply(e) {
  e.preventDefault();
  if (!ACTIVE_CONVERSATION_ID) return;
  const convo = ADMIN_CONVERSATIONS.find((c) => c.userId === ACTIVE_CONVERSATION_ID);
  const btn = qs("#sendReplyBtn");
  const input = qs("#adminReplyInput");
  const text = input.value.trim();
  if (!Validate.required(text)) { showToast("Reply required", "Write a message before sending.", "error"); return; }

  setButtonLoading(btn, true, "Sending…");
  try {
    // A reply is just another message in the same conversation — userId
    // stays the GUEST's id (that's what "this conversation" means), while
    // senderRole marks it as coming from staff.
    await db.collection(COLLECTIONS.MESSAGES).add({
      userId: convo.userId,
      userName: convo.userName,
      userEmail: convo.userEmail,
      senderRole: "admin",
      senderName: ADMIN_PROFILE?.fullName || "Front desk",
      message: text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value = "";
    showToast("Reply sent", "The guest sees this instantly.", "success");
  } catch (err) {
    showToast("Couldn't send reply", err.message, "error");
  } finally {
    setButtonLoading(btn, false);
  }
}

function chatIcon() { return '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>'; }
