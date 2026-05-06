# Node.js Backend for Chat Application

This is the backend server for the React chat application, built with Express.js, MongoDB, and Socket.io for real-time communication.

## Features

- **User Authentication**: Register, login, and logout with JWT tokens
- **Real-time Messaging**: Socket.io for instant message delivery
- **Chat Management**: Create individual and group chats
- **Message History**: Store and retrieve message history
- **Online Status**: Track user online/offline status

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user info
- `POST /api/auth/logout` - Logout user

### Chat
- `GET /api/chat` - Get all user chats
- `POST /api/chat/accessChat` - Get or create chat with user
- `POST /api/chat/group` - Create group chat
- `PUT /api/chat/rename` - Rename group chat
- `PUT /api/chat/addToGroup` - Add user to group
- `PUT /api/chat/removeFromGroup` - Remove user from group
- `DELETE /api/chat/:chatId` - Delete chat

### Messages
- `GET /api/messages/:chatId` - Get messages for a chat
- `POST /api/messages` - Send new message
- `PUT /api/messages/:messageId/status` - Update message status
- `DELETE /api/messages/:messageId` - Delete message

### Health
- `GET /api/health` - Server health check

## Socket.io Events

### Client to Server
- `join` - User joins their room
- `send-message` - Send a new message
- `typing` - User is typing
- `stop-typing` - User stopped typing

### Server to Client
- `user-online` - User came online
- `user-offline` - User went offline
- `receive-message` - Receive a new message
- `update-status` - Message status updated
- `user-typing` - Another user is typing
- `user-stop-typing` - Another user stopped typing

## Setup

1. Install backend dependencies:
```bash
npm install
```

2. Create a `.env` file (copy from `.env.example`):
```bash
cp .env.example .env
```

3. Start MongoDB (or use MongoDB Atlas)

4. Start the backend server:
```bash
npm run dev:server
```

## Environment Variables

- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT secret key
- `PORT` - Server port (default: 5000)
- `CLIENT_URL` - Frontend URL (default: http://localhost:3000)

## Run Both Frontend and Backend

1. Terminal 1 - Start backend:
```bash
npm run dev:server
```

2. Terminal 2 - Start frontend:
```bash
npm run dev
```
