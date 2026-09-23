/**
 * web-chat-app server — Express + Socket.IO.
 * Serves the static client and relays events between users in rooms.
 * No database: users and rooms live in memory and reset on restart.
 */

const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// serve only client assets — never server.js, package.json, tests, etc.
app.use("/styles", express.static(path.join(__dirname, "styles")));
app.use("/js", express.static(path.join(__dirname, "js")));
app.use("/docs", express.static(path.join(__dirname, "docs")));
app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "index.html")));
app.get("/healthz", (_req, res) => res.json({ ok: true }));

const MAX_NAME_LEN = 20;
const MAX_MSG_LEN = 500;
const MAX_ROOM_LEN = 24;

/** @type {Map<string, {name: string, room: string}>} socket.id -> user */
const users = new Map();
const rooms = new Set(["lobby", "tech", "random"]);
let guestSeq = 1;

const now = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const clean = (s, max) => String(s ?? "").trim().replace(/\s+/g, " ").slice(0, max);

function roomUsers(room) {
  const list = [];
  for (const u of users.values()) if (u.room === room) list.push(u.name);
  return list.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
}

function uniqueName(base, room) {
  const taken = new Set(
    [...users.values()]
      .filter((u) => u.room === room)
      .map((u) => u.name.toLowerCase())
  );
  if (!taken.has(base.toLowerCase())) return base;
  let i = 2;
  while (taken.has(`${base} (${i})`.toLowerCase())) i += 1;
  return `${base} (${i})`;
}

function leaveCurrentRoom(socket) {
  const u = users.get(socket.id);
  if (!u) return;
  users.delete(socket.id);  // actually remove, or "departed" users linger
  socket.leave(u.room);
  socket.to(u.room).emit("system", { text: `${u.name} left`, time: now() });
  io.to(u.room).emit("users", roomUsers(u.room));
}

io.on("connection", (socket) => {
  // join a room (also used for switching rooms)
  socket.on("join", ({ name, room } = {}, ack) => {
    leaveCurrentRoom(socket);
    let n = clean(name, MAX_NAME_LEN) || `guest-${guestSeq++}`;
    let r = clean(room, MAX_ROOM_LEN).toLowerCase() || "lobby";
    n = uniqueName(n, r);
    users.set(socket.id, { name: n, room: r });
    socket.join(r);
    rooms.add(r);
    socket.to(r).emit("system", { text: `${n} joined`, time: now() });
    io.to(r).emit("users", roomUsers(r));
    io.emit("rooms", [...rooms].sort());
    if (typeof ack === "function") ack({ ok: true, name: n, room: r });
  });

  socket.on("message", (text) => {
    const u = users.get(socket.id);
    if (!u) return;
    const t = String(text ?? "").trim();
    if (!t || t.length > MAX_MSG_LEN) return;  // reject empty or over-limit
    // text is relayed raw; the client renders it with textContent (XSS-safe)
    io.to(u.room).emit("message", { user: u.name, text: t, time: now() });
  });

  socket.on("typing", (isTyping) => {
    const u = users.get(socket.id);
    if (!u) return;
    socket.to(u.room).emit("typing", { user: u.name, isTyping: !!isTyping });
  });

  // create a room and return its name so the client can join it
  socket.on("new room", (room, ack) => {
    const r = clean(room, MAX_ROOM_LEN).toLowerCase().replace(/ /g, "-");
    if (r && !rooms.has(r)) {
      rooms.add(r);
      io.emit("rooms", [...rooms].sort());
    }
    if (typeof ack === "function") ack({ ok: true, room: r || "lobby" });
  });

  socket.on("disconnect", () => leaveCurrentRoom(socket));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () =>
  console.log(`banter listening on http://localhost:${PORT}`)
);
