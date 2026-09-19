# web-chat-app

Real-time public chat rooms in the browser. Pick a nickname, join a room,
talk. No accounts, no database — users and rooms live in server memory.

Built with Node.js, Express, and Socket.IO. The client is plain HTML/CSS/JS.

## Quick start

```bash
git clone https://github.com/Nav54877/web-chat-app.git
cd web-chat-app
npm install
npm start
```

Open http://localhost:3000 in as many browser tabs as you want — each tab
is a chat participant.

Requires Node.js 18+.

## Features

- Multiple public rooms (lobby, tech, random — or create your own)
- Online-user list per room, live join/leave updates
- Typing indicators
- Timestamps, system messages for joins/leaves
- Duplicate nicknames get an automatic suffix
- Responsive layout (sidebar collapses to an overlay on mobile)
- Connection status indicator; input disables while disconnected
- Unread counter in the tab title when the window is in the background

## How it works

```
Browser (js/app.js)  --socket.io-->  server.js  --broadcast-->  everyone in the room
```

Events:

| Event        | Direction  | Payload                    | Purpose                |
|--------------|-----------|----------------------------|------------------------|
| `join`       | client →  | `{ name, room }`           | join or switch room    |
| `message`    | client →  | `text`                     | send a chat message    |
| `typing`     | client →  | `bool`                     | typing indicator       |
| `new room`   | client →  | `room`                     | create a room          |
| `message`    | → client  | `{ user, text, time }`     | incoming message       |
| `system`     | → client  | `{ text, time }`           | join/leave notices     |
| `users`      | → client  | `string[]`                 | room's online list     |
| `rooms`      | → client  | `string[]`                 | all rooms              |
| `typing`     | → client  | `{ user, isTyping }`       | who is typing          |

Limits: nicknames 20 chars, messages 500 chars, rooms 24 chars. Both are
trimmed and sanitized server-side; the client renders exclusively with
`textContent`, so user input cannot inject markup (XSS-safe by
construction, not by escaping).

## Testing

```bash
npm install   # also installs the dev client for tests
npm test
```

The smoke test boots the server on a scratch port, connects two socket
clients, and verifies join, messaging, user lists, typing events, room
creation, and clean disconnects.

## Deploying

Any Node host works — the app listens on `process.env.PORT` (default 3000):

- **Render / Railway / Fly.io**: set the start command to `npm start`.
- **VPS**: `npm install && pm2 start server.js --name web-chat` (or systemd).
- **Heroku family**: `web: npm start` in a Procfile.

No build step, no external services, no persistence to configure.

## Project layout

```
server.js        Express + Socket.IO server, in-memory state
index.html       markup (join screen + chat screen)
styles/main.css  dark theme, responsive layout
js/app.js        client logic (DOM rendering, socket events)
test/smoke.js    integration test (two clients over a real socket)
```

## Notes and limits

- In-memory only: restarting the server empties all rooms and user lists.
- No history: messages are relayed live and never stored.
- No moderation: it's a demo-grade public chat. Rate limiting, auth, and
  persistence would be the natural next steps if you want more.

## License

MIT, see [LICENSE](LICENSE).
