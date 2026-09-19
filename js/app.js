/* web-chat-app client.
 * Renders everything with DOM APIs + textContent, so user input can never
 * inject markup. */

const $ = (id) => document.getElementById(id);

const joinScreen = $("join-screen");
const chatScreen = $("chat-screen");
const joinForm = $("join-form");
const chatForm = $("chat-form");
const nameInput = $("name-input");
const roomInput = $("room-input");
const roomOptions = $("room-options");
const joinHint = $("join-hint");
const roomNameEl = $("room-name");
const connDot = $("conn-dot");
const onlineCount = $("online-count");
const roomListEl = $("room-list");
const userListEl = $("user-list");
const messagesEl = $("messages");
const typingBar = $("typing-bar");
const typingText = $("typing-text");
const msgInput = $("msg-input");
const sendBtn = $("send-btn");
const sidebar = $("sidebar");

let socket = null;
let myName = "";
let myRoom = "lobby";
let typingUsers = new Map(); // name -> timeout id
let unread = 0;
let baseTitle = document.title;

/* ---------- helpers ---------- */

function avatarColor(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${h % 360} 55% 48%)`;
}

function scrollBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function updateTitle() {
  document.title = unread > 0 ? `(${unread}) ${baseTitle}` : baseTitle;
}

function el(tag, cls, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text; // XSS-safe by construction
  return node;
}

/* ---------- rendering ---------- */

function addMessage({ user, text, time }) {
  const own = user === myName;
  const wrap = el("div", "msg" + (own ? " own" : ""));

  if (!own) {
    const av = el("div", "avatar");
    av.textContent = user.slice(0, 2).toUpperCase();
    av.style.background = avatarColor(user);
    wrap.appendChild(av);
  }

  const bubble = el("div", "bubble");
  const meta = el("div", "meta");
  meta.append(el("span", "", user));
  meta.append(el("span", "time", time || ""));
  bubble.append(meta, el("div", "", text));
  wrap.appendChild(bubble);

  messagesEl.appendChild(wrap);
  scrollBottom();

  if (document.hidden && !own) {
    unread += 1;
    updateTitle();
  }
}

function addSystem(text, time) {
  const line = el("div", "system", `${text} · ${time}`);
  messagesEl.appendChild(line);
  scrollBottom();
}

function renderUsers(list) {
  userListEl.replaceChildren();
  for (const name of list) {
    const li = el("li");
    const av = el("div", "avatar");
    av.textContent = name.slice(0, 2).toUpperCase();
    av.style.background = avatarColor(name);
    li.append(av, el("span", "", name));
    if (name === myName) li.lastChild.textContent += " (you)";
    userListEl.appendChild(li);
  }
  onlineCount.textContent = list.length ? `${list.length} online` : "";
}

function renderRooms(list) {
  roomListEl.replaceChildren();
  roomOptions.replaceChildren();
  for (const room of list) {
    const li = el("li", room === myRoom ? "active" : "", room);
    li.addEventListener("click", () => switchRoom(room));
    roomListEl.appendChild(li);

    const opt = el("option");
    opt.value = room;
    roomOptions.appendChild(opt);
  }
}

function updateTypingBar() {
  const names = [...typingUsers.keys()].filter((n) => n !== myName);
  if (!names.length) {
    typingBar.classList.add("hidden");
    return;
  }
  typingBar.classList.remove("hidden");
  typingText.textContent =
    names.length === 1
      ? `${names[0]} is typing`
      : `${names.slice(0, 2).join(", ")}${names.length > 2 ? ` +${names.length - 2}` : ""} are typing`;
}

/* ---------- socket ---------- */

function setConnected(on) {
  connDot.className = "conn-dot " + (on ? "online" : "offline");
  connDot.title = on ? "connected" : "disconnected";
  msgInput.disabled = !on;
  sendBtn.disabled = !on;
}

function connect(name, room) {
  socket = io();

  socket.on("connect", () => {
    setConnected(true);
    socket.emit("join", { name, room }, (res) => {
      if (!res || !res.ok) return;
      myName = res.name;
      myRoom = res.room;
      roomNameEl.textContent = myRoom;
      messagesEl.replaceChildren();
    });
  });

  socket.on("disconnect", () => setConnected(false));

  socket.on("message", (m) => addMessage(m));

  socket.on("system", (s) => addSystem(s.text, s.time));

  socket.on("users", renderUsers);

  socket.on("rooms", renderRooms);

  socket.on("typing", ({ user, isTyping }) => {
    clearTimeout(typingUsers.get(user));
    typingUsers.delete(user);
    if (isTyping) {
      typingUsers.set(
        user,
        setTimeout(() => {
          typingUsers.delete(user);
          updateTypingBar();
        }, 3000)
      );
    }
    updateTypingBar();
  });
}

function switchRoom(room) {
  if (!socket || room === myRoom) return;
  socket.emit("join", { name: myName, room }, (res) => {
    if (!res || !res.ok) return;
    myRoom = res.room;
    roomNameEl.textContent = myRoom;
    messagesEl.replaceChildren();
    typingUsers.clear();
    updateTypingBar();
    sidebar.classList.remove("open");
  });
}

/* ---------- events ---------- */

joinForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = nameInput.value.trim();
  if (!name) {
    joinHint.textContent = "Pick a nickname first.";
    return;
  }
  joinScreen.classList.add("hidden");
  chatScreen.classList.remove("hidden");
  connect(name, roomInput.value.trim() || "lobby");
});

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const text = msgInput.value.trim();
  if (!text || !socket) return;
  socket.emit("message", text);
  msgInput.value = "";
  socket.emit("typing", false);
});

msgInput.addEventListener("input", () => {
  if (socket) socket.emit("typing", msgInput.value.length > 0);
});

$("leave-btn").addEventListener("click", () => location.reload());

$("sidebar-toggle").addEventListener("click", () =>
  sidebar.classList.toggle("open")
);

$("new-room-btn").addEventListener("click", () => {
  const room = prompt("Name a new room:");
  if (!room || !socket) return;
  socket.emit("new room", room, (res) => {
    if (res && res.ok) switchRoom(res.room);
  });
});

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    unread = 0;
    updateTitle();
  }
});

nameInput.focus();
