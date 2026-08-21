/**
 * CHATBOT WIDGET
 * A lightweight, self-contained FAQ assistant — floating bubble bottom
 * left, opens a chat panel. Answers common questions instantly via
 * keyword matching (no external API, no cost, no backend). When it can't
 * help, it offers one-click escalation into the REAL front-desk message
 * thread (the same `messages` collection admin/messages.html and
 * account.html already use) — so guests always have a path to a human,
 * the bot is just the fast first line.
 *
 * Fully self-injecting: include this one script tag on any guest-facing
 * page and it builds its own markup + styles. No HTML changes needed
 * elsewhere.
 */
(function () {
  const FAQ = [
    { keywords: ["check in", "check-in", "checkin"], answer: "Check-in is 3:00 PM. If you're arriving earlier, let the front desk know your flight time and we'll try to have your room ready sooner." },
    { keywords: ["check out", "check-out", "checkout"], answer: "Check-out is 11:00 AM. Late check-out may be available on request, depending on occupancy — just ask at the front desk." },
    { keywords: ["wifi", "wi-fi", "internet", "password"], answer: "Complimentary Wi-Fi is available throughout the property. The network name and password are provided at check-in and posted in your room." },
    { keywords: ["park", "parking", "valet", "garage"], answer: "We offer both self-parking and valet parking on-site. Ask the front desk for current rates when you arrive." },
    { keywords: ["pool", "gym", "fitness", "amenit"], answer: "Our rooftop pool and 24-hour fitness studio are open to all registered guests. The pool is open sunrise to midnight." },
    { keywords: ["pet", "dog", "cat"], answer: "We're a pet-friendly property! Let us know in advance if you're traveling with a pet so we can prepare your room." },
    { keywords: ["cancel", "cancellation", "refund"], answer: "Most bookings can be cancelled free of charge before check-in — go to My Account → My Bookings. For same-day cancellations, please contact the front desk directly." },
    { keywords: ["price", "rate", "cost", "how much"], answer: "Room rates vary by type and dates — you can browse current pricing anytime on our Rooms & Suites page." },
    { keywords: ["book", "reserve", "reservation", "availability"], answer: "You can book directly from our Rooms & Suites page — pick your dates and we'll confirm your reservation." },
    { keywords: ["contact", "phone", "email", "call"], answer: "You can reach our front desk at +1 (305) 555-0148 or front.desk@aurelio-hotels.example — or just keep chatting with me!" },
    { keywords: ["breakfast", "restaurant", "food", "dining"], answer: "In-room dining is available around the clock, and our breakfast service runs from 7–11 AM in the main lobby." }
  ];

  const QUICK_REPLIES = ["Check-in time?", "Wi-Fi password?", "Cancellation policy?", "Talk to the front desk"];

  function matchFaq(text) {
    const lower = text.toLowerCase();
    return FAQ.find((f) => f.keywords.some((k) => lower.includes(k)));
  }

  function init() {
    if (document.getElementById("chatbotFab")) return; // avoid double-init if script is ever included twice
    injectStyles();
    injectMarkup();
    wireEvents();
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .chatbot-fab{ position:fixed; bottom:22px; left:22px; z-index:650; width:56px; height:56px; border-radius:50%;
        background:linear-gradient(145deg, var(--primary-light), var(--primary-dark)); color:#fff; display:flex; align-items:center; justify-content:center;
        box-shadow:var(--shadow-lg); transition:transform .18s ease; }
      .chatbot-fab:hover{ transform:translateY(-2px) scale(1.04); }
      .chatbot-fab .cb-badge{ position:absolute; top:-4px; right:-4px; min-width:20px; height:20px; padding:0 5px; border-radius:999px; background:var(--wine); color:#fff; font-size:11px; font-weight:700; display:flex; align-items:center; justify-content:center; font-family:var(--font-mono); border:2px solid var(--bg); }
      @media (max-width:640px){ .chatbot-fab{ bottom:16px; left:16px; width:48px; height:48px; } }

      .chatbot-panel{ position:fixed; bottom:90px; left:22px; z-index:650; width:340px; max-width:calc(100vw - 32px); max-height:480px;
        background:var(--surface); border-radius:var(--r-lg); border:1px solid var(--border); box-shadow:var(--shadow-lg);
        display:none; flex-direction:column; overflow:hidden; animation:cb-pop .22s cubic-bezier(.2,.9,.3,1.2); }
      .chatbot-panel.open{ display:flex; }
      @keyframes cb-pop{ from{ opacity:0; transform:translateY(12px) scale(.97);} to{ opacity:1; transform:translateY(0) scale(1);} }
      @media (max-width:640px){ .chatbot-panel{ bottom:76px; left:12px; width:calc(100vw - 24px); } }

      .chatbot-head{ background:var(--primary); color:#fff; padding:14px 16px; display:flex; align-items:center; gap:10px; flex-shrink:0; }
      .chatbot-head .cb-avatar{ width:32px; height:32px; border-radius:50%; background:rgba(255,255,255,0.15); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .chatbot-head b{ display:block; font-size:14px; }
      .chatbot-head span{ display:block; font-size:11px; color:rgba(255,255,255,0.7); }
      .chatbot-head .cb-close{ margin-left:auto; color:rgba(255,255,255,0.75); width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; }
      .chatbot-head .cb-close:hover{ background:rgba(255,255,255,0.15); color:#fff; }

      .chatbot-body{ flex:1; overflow-y:auto; padding:14px 16px; display:flex; flex-direction:column; gap:10px; background:var(--surface-sunk); }
      .cb-bubble{ max-width:82%; padding:10px 13px; border-radius:14px; font-size:13px; line-height:1.5; }
      .cb-bubble.bot{ background:var(--surface); border:1px solid var(--border); align-self:flex-start; border-bottom-left-radius:4px; }
      .cb-bubble.user{ background:var(--primary); color:#fff; align-self:flex-end; border-bottom-right-radius:4px; }

      .chatbot-quick{ display:flex; flex-wrap:wrap; gap:6px; padding:0 16px 10px; flex-shrink:0; background:var(--surface-sunk); }
      .cb-quick-btn{ font-size:11.5px; font-weight:600; padding:7px 12px; border-radius:999px; background:var(--surface); border:1px solid var(--border); color:var(--ink-soft); }
      .cb-quick-btn:hover{ border-color:var(--primary); color:var(--primary); }

      .chatbot-input-row{ display:flex; gap:8px; padding:12px; border-top:1px solid var(--border); flex-shrink:0; background:var(--surface); }
      .chatbot-input-row input{ flex:1; border:1.5px solid var(--border); border-radius:999px; padding:9px 14px; font-size:13px; font-family:var(--font-body); }
      .chatbot-input-row input:focus{ outline:none; border-color:var(--primary); }
      .chatbot-input-row button{ width:36px; height:36px; border-radius:50%; background:var(--primary); color:#fff; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .chatbot-input-row button:hover{ background:var(--primary-light); }
    `;
    document.head.appendChild(style);
  }

  function injectMarkup() {
    const fab = document.createElement("button");
    fab.id = "chatbotFab";
    fab.className = "chatbot-fab";
    fab.title = "Chat with us";
    fab.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
      <span class="cb-badge hidden" id="chatbotBadge">1</span>`;
    document.body.appendChild(fab);

    const panel = document.createElement("div");
    panel.id = "chatbotPanel";
    panel.className = "chatbot-panel";
    panel.innerHTML = `
      <div class="chatbot-head">
        <span class="cb-avatar"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg></span>
        <div><b>Aurelio Assistant</b><span>Usually replies instantly</span></div>
        <button class="cb-close" id="chatbotClose"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="chatbot-body" id="chatbotBody"></div>
      <div class="chatbot-quick" id="chatbotQuick"></div>
      <form class="chatbot-input-row" id="chatbotForm">
        <input type="text" id="chatbotInput" placeholder="Ask a question…" autocomplete="off">
        <button type="submit" aria-label="Send"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></button>
      </form>`;
    document.body.appendChild(panel);
  }

  function addBubble(text, from) {
    const body = document.getElementById("chatbotBody");
    const bubble = document.createElement("div");
    bubble.className = `cb-bubble ${from}`;
    bubble.textContent = text;
    body.appendChild(bubble);
    body.scrollTop = body.scrollHeight;
  }

  function renderQuickReplies() {
    const quick = document.getElementById("chatbotQuick");
    quick.innerHTML = QUICK_REPLIES.map((q) => `<button type="button" class="cb-quick-btn">${escapeHtml(q)}</button>`).join("");
    quick.querySelectorAll(".cb-quick-btn").forEach((btn) => btn.addEventListener("click", () => handleUserMessage(btn.textContent)));
  }

  function handleUserMessage(text) {
    text = text.trim();
    if (!text) return;
    addBubble(text, "user");

    if (/talk to|front desk|human|staff|real person|agent/i.test(text)) {
      offerEscalation();
      return;
    }

    const match = matchFaq(text);
    setTimeout(() => {
      if (match) {
        addBubble(match.answer, "bot");
      } else {
        addBubble("I don't have an answer for that one yet — want me to pass this along to our front desk team? They'll reply right in your account.", "bot");
        offerEscalationButton(text);
      }
    }, 350);
  }

  function offerEscalation() {
    setTimeout(() => {
      addBubble("Of course — connecting you with our front desk.", "bot");
      offerEscalationButton("");
    }, 300);
  }

  function offerEscalationButton(prefillText) {
    const body = document.getElementById("chatbotBody");
    const wrap = document.createElement("div");
    wrap.style.cssText = "align-self:flex-start; max-width:82%;";
    wrap.innerHTML = `<button class="btn btn-primary btn-sm" id="cbEscalateBtn" type="button">Message the front desk</button>`;
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
    document.getElementById("cbEscalateBtn").addEventListener("click", () => escalateToFrontDesk(prefillText, wrap));
  }

  async function escalateToFrontDesk(prefillText, triggerWrap) {
    const user = typeof auth !== "undefined" ? auth.currentUser : null;
    if (!user) {
      triggerWrap.innerHTML = `<div class="cb-bubble bot" style="max-width:100%;">Please <a href="login.html" style="color:var(--primary); font-weight:600;">log in</a> or <a href="register.html" style="color:var(--primary); font-weight:600;">create an account</a> so our team can reply directly to you.</div>`;
      return;
    }
    triggerWrap.innerHTML = `<span class="text-faint" style="font-size:12px;">Sending…</span>`;
    try {
      let profile = {};
      const snap = await db.collection(COLLECTIONS.USERS).doc(user.uid).get();
      if (snap.exists) profile = snap.data();

      await db.collection(COLLECTIONS.MESSAGES).add({
        userId: user.uid,
        userName: profile.fullName || user.displayName || "Guest",
        userEmail: user.email,
        senderRole: "guest",
        senderName: profile.fullName || "Guest",
        message: prefillText || "Hi, could I get some help from a team member?",
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      triggerWrap.innerHTML = `<div class="cb-bubble bot" style="max-width:100%;">Sent! Our team will reply in <a href="account.html#messages" style="color:var(--primary); font-weight:600;">My Account → Messages</a> — usually within a few minutes.</div>`;
    } catch (err) {
      console.error(err);
      triggerWrap.innerHTML = `<span class="text-faint" style="font-size:12px;">Couldn't send that — please try again.</span>`;
    }
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function wireEvents() {
    const fab = document.getElementById("chatbotFab");
    const panel = document.getElementById("chatbotPanel");
    const closeBtn = document.getElementById("chatbotClose");
    const form = document.getElementById("chatbotForm");
    const input = document.getElementById("chatbotInput");

    let greeted = false;
    fab.addEventListener("click", () => {
      panel.classList.toggle("open");
      document.getElementById("chatbotBadge")?.classList.add("hidden");
      if (panel.classList.contains("open") && !greeted) {
        greeted = true;
        addBubble("Hi! I'm the Aurelio Assistant. Ask me about check-in times, Wi-Fi, parking, cancellations, or anything else — and I'll connect you with our team if I can't help.", "bot");
        renderQuickReplies();
      }
    });
    closeBtn.addEventListener("click", () => panel.classList.remove("open"));
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = input.value;
      input.value = "";
      handleUserMessage(text);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
