# Chat Application

A full-stack real-time chat application built with React + TypeScript frontend and Express + Socket.io backend.

## Project Structure

```
project/
├── backend/           # Express.js + Socket.io server
│   ├── server.js
│   ├── config/database.js
│   ├── middleware/auth.js
│   ├── models/ (User, Chat, Message)
│   └── routes/ (auth, chat, messages, users)
├── frontend/          # React + Vite + TypeScript client
│   ├── src/
│   │   ├── components/ (ChatLayout, Login, Signup, ProtectedRoute)
│   │   ├── contexts/AuthContext.tsx
│   │   └── services/api.ts
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── .env               # Backend env (MONGODB_URI, JWT_SECRET, PORT)
└── package.json       # Root (optional - future workspace setup)
```

---

## Quick Start

### Prerequisites
- **Node.js** 18+ 
- **MongoDB** running locally on `mongodb://localhost:27017` or a MongoDB Atlas connection string

### 1. Environment Configuration

**Backend** — root `.env`:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/chat-app
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
CLIENT_URL=http://localhost:3000
APP_URL=http://localhost:5000
```

**Frontend** — `frontend/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

### 2. Install Dependencies

```bash
# Backend (root)
npm install

# Frontend
cd frontend
npm install
cd ..
```

### 3. Start MongoDB

If using local MongoDB:
```bash
# On Windows (as service)
net start MongoDB

# Or using Docker
docker run -d -p 27017:27017 mongo
```

### 4. Run the Application

**Option A — Two terminals (recommended):**

Terminal 1 — Backend:
```bash
npm start
# Server runs on http://localhost:5000
```

Terminal 2 — Frontend:
```bash
cd frontend
npm run dev
# Client runs on http://localhost:3000
```

**Option B — Single terminal with background processes:**
```bash
# Start backend in background
npm start &

# Start frontend
cd frontend && npm run dev
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| GET | `/api/auth/me` | Get current user |
| POST | `/api/auth/logout` | Logout user |
| GET | `/api/chat` | Get all chats for user |
| POST | `/api/chat/accessChat` | Get or create 1-on-1 chat |
| POST | `/api/chat/group` | Create group chat |
| PUT | `/api/chat/rename` | Rename group chat |
| PUT | `/api/chat/addToGroup` | Add user to group |
| PUT | `/api/chat/removeFromGroup` | Remove user from group |
| DELETE | `/api/chat/:chatId` | Delete chat |
| GET | `/api/messages/:chatId` | Get messages for chat |
| POST | `/api/messages` | Send message |
| PUT | `/api/messages/:messageId/status` | Update message read status |
| DELETE | `/api/messages/:messageId` | Delete message |
| GET | `/api/users/search?q=` | Search users |
| GET | `/api/users/all` | Get all contacts |
| GET | `/api/health` | Health check |

---

## WebSocket Events

| Event | Direction | Description |
|-------|-----------|-------------|
| `receive-message` | Server → Client | New message received |
| `user-online` | Server → Client | User came online |
| `user-offline` | Server → Client | User went offline |

---

## Available Scripts

### Backend (root)
- `npm start` — Start server (production)
- `npm run dev` — Start with nodemon (auto-reload)

### Frontend (`frontend/`)
- `npm run dev` — Start Vite dev server (http://localhost:3000)
- `npm run build` — Build for production
- `npm run preview` — Preview production build
- `npm run lint` — TypeScript type check

---

## Tech Stack

**Backend:**
- Express.js (REST API)
- Socket.io (real-time messaging)
- Mongoose (MongoDB ODM)
- JWT (authentication)
- bcryptjs (password hashing)

**Frontend:**
- React 19 + TypeScript
- Vite (build tool)
- React Router DOM (routing)
- Socket.io-client (WebSocket)
- Framer Motion (animations)
- Lucide React (icons)
- Tailwind CSS v4 (styling)

---

## Troubleshooting

### MongoDB Connection Fails
Check that MongoDB is running:
```bash
# Verify
mongo --eval "db.runCommand({ ping: 1 })"

# Start service (Windows)
net start MongoDB

# Or use Docker
docker start mongo
```

### Port Already in Use
Change ports in `.env` files:
- Backend: `PORT=5001` in root `.env`
- Frontend: `npm run dev -- --port=3001`

### Frontend Build Errors
Ensure all dependencies are installed:
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

---

## License

ISC
