# Backend Integration Guide (Frontend Reference)

## Overview
This frontend connects to a Node.js backend providing RESTful APIs and real-time Socket.io messaging.

## Tech Stack
- React 19 + TypeScript
- Vite (build tool)
- React Router DOM (routing)
- Socket.io-client (WebSocket)
- Framer Motion (animations)
- Lucide React (icons)
- Tailwind CSS v4 (styling)

---

## API Base URL

Configured in `.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

The `api.ts` service automatically uses this URL for all requests.

---

## API Endpoints Used

### Authentication
- `POST /api/auth/register` — Register new user
- `POST /api/auth/login` — Login user
- `GET /api/auth/me` — Get current user profile

### Chats
- `GET /api/chat` — Get all user chats
- `POST /api/chat/accessChat` — Get or create 1-on-1 chat

### Messages
- `GET /api/messages/:chatId` — Get chat messages
- `POST /api/messages` — Send message
- `DELETE /api/messages/:messageId` — Delete message
- `PUT /api/messages/:messageId/status` — Mark as read

### Users
- `GET /api/users/search?q=` — Search users
- `GET /api/users/all` — Get all contacts

---

## Socket.io Connection

**Connection** (`ChatLayout.tsx`):
```typescript
import { io } from 'socket.io-client';

const socket = io(SERVER_URL, {
  auth: { token: localStorage.getItem('token') }
});
```

**Events**:
| Event | Direction | Payload |
|-------|-----------|---------|
| `receive-message` | Server → Client | `Message` object |
| `user-online` | Server → Client | `userId` |
| `user-offline` | Server → Client | `userId` |

---

## Authentication Flow

1. User logs in via `POST /api/auth/login`
2. JWT token received and stored in `localStorage`
3. Token added to all subsequent API requests via `Authorization: Bearer <token>`
4. Socket connection includes token in handshake auth
5. Token validated server-side for protected routes

**Auth context**: `src/contexts/AuthContext.tsx`

---

## Project Structure

```
frontend/
├── src/
│   ├── App.tsx                    # Router setup
│   ├── main.tsx                   # Entry point
│   ├── index.css                  # Tailwind + theme
│   ├── components/
│   │   ├── ChatLayout.tsx         # Main chat UI + socket logic
│   │   ├── Login.tsx              # Login form
│   │   ├── Signup.tsx             # Registration form
│   │   └── ProtectedRoute.tsx     # Auth guard
│   ├── contexts/
│   │   └── AuthContext.tsx        # Auth state provider
│   └── services/
│       └── api.ts                 # HTTP client wrapper
├── index.html
├── vite.config.ts
├── tsconfig.json
├── .env                           # Local env (not committed)
└── .env.example                   # Template
```

---

## Running the Frontend

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Type check
npm run lint
```

---

## Styling

Tailwind CSS v4 with custom theme in `index.css`:

```css
@theme {
  --color-brand-primary: #00a884;   /* WhatsApp Green */
  --color-chat-bg: #0b141a;         /* Dark background */
  --color-sidebar-bg: #111b21;      /* Sidebar */
  --color-text-primary: #e9edef;    /* Text */
  --color-bubble-sent: #005c4b;     /* Sent bubbles */
  --color-bubble-received: #202c33; /* Received bubbles */
}
```

---

## Real-time Messaging

When a user sends a message:

1. Optimistic UI update (message appears immediately)
2. `POST /api/messages` sends to backend
3. Backend saves to MongoDB and emits via Socket.io to other chat participants
4. Other users receive `receive-message` event
5. Chat list updates with latest message preview

**Desktop notifications** fire when tab is not focused (`Notification` API).

---

## Error Handling

All API errors throw `Error` objects with `.message` from backend response. Components display inline errors with Framer Motion animations.

---

## TypeScript Interfaces

Key types defined in `ChatLayout.tsx`:
```typescript
interface Chat {
  _id: string;
  users: Array<{ _id: string; username: string; fullName?: string; avatar: string; online?: boolean }>;
  chatName?: string;
  isGroupChat: boolean;
  latestMessage?: { _id: string; content: string; createdAt: string };
  avatar?: string;
}

interface Message {
  _id: string;
  content: string;
  sender: { _id: string; username: string; fullName?: string; avatar: string };
  chat: string;
  createdAt: string;
  readBy: string[];
}
```

---

## Environment Setup

Copy `.env.example` to `.env` and ensure `VITE_API_URL` points to your backend:
```bash
cp .env.example .env
# Edit .env if backend runs on different port
```

Vite automatically reloads on `.env` changes (restart dev server if needed).

---

## Backend URL Mapping

| Dev | Production |
|-----|------------|
| `http://localhost:5000/api` | `https://your-api.com/api` |

Update both root `.env` (backend) and `frontend/.env` when deploying.

---

## CORS

Backend CORS configured to allow `http://localhost:3000` (frontend dev) and `APP_URL`/`CLIENT_URL`. Update `backend/server.js` line 23–26 for production domains.

---

## Mobile Responsive

- Sidebar: `w-full md:w-80 lg:w-96` (full width on mobile, fixed on desktop)
- Chat bubbles: `max-w-[85%] md:max-w-md`
- Touch-friendly tap targets (min 44×44px)

---

## Known Limitations

- Group chat management UI not fully implemented (backend routes exist)
- Message editing/deletion only by sender
- No file attachments (only text messages)
- No message search within chats
