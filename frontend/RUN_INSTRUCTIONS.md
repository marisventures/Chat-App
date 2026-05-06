# Frontend Development Instructions

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
# → http://localhost:3000
```

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server (HMR enabled) |
| `npm run build` | Build for production (outputs to `dist/`) |
| `npm run preview` | Serve production build locally |
| `npm run lint` | TypeScript type check (`tsc --noEmit`) |

---

## Environment Variables

Create `.env` from `.env.example`:

```env
VITE_API_URL=http://localhost:5000/api
```

Vite exposes variables prefixed with `VITE_` to the client via `import.meta.env`.

---

## Connecting to Backend

The `src/services/api.ts` file provides typed HTTP methods:

```typescript
import { api } from './services/api';

// GET
const users = await api.get<User[]>('/users/all', token);

// POST
const chat = await api.post('/chat/accessChat', { userId }, token);

// PUT
await api.put('/messages/msgId/status', { status: 'read' }, token);

// DELETE
await api.delete('/messages/msgId', token);
```

All requests automatically include `Authorization: Bearer <token>` header when token provided.

---

## Socket.io

Socket connection established in `ChatLayout.tsx`:

```typescript
const socket = io(SERVER_URL, {
  auth: { token: localStorage.getItem('token') }
});
```

Listen for new messages:

```typescript
socket.on('receive-message', (message) => {
  // Update UI
});
```

---

## Adding New Components

1. Create `src/components/MyComponent.tsx`
2. Use PascalCase naming
3. Export default function component
4. Add PropTypes or TypeScript interfaces
5. Import styles using Tailwind classes

Example:
```typescript
export default function MyComponent({ title }: { title: string }) {
  return <div className="p-4">{title}</div>;
}
```

---

## Adding New API Endpoints

1. Add endpoint to `src/services/api.ts` if custom logic needed (or use existing `api.get/post/put/delete`)
2. Call from component or context with proper token

Example in component:
```typescript
const { user } = useAuth();
const response = await api.post('/chat/new', { name: 'Group' }, localStorage.getItem('token'));
```

---

## Tailwind CSS

All styles use Tailwind utility classes. Custom theme variables in `index.css`:

```css
@theme {
  --color-brand-primary: #00a884;
  --color-chat-bg: #0b141a;
  /* ... */
}
```

Use semantic class names in JSX:
```tsx
<div className="bg-sidebar-bg text-text-primary">
```

---

## Icons

Import from `lucide-react`:
```typescript
import { Send, MessageCircle, User } from 'lucide-react';
```

All icons are React components, set `size` or `className` for styling.

---

## Animations

Use `framer-motion` (imported as `motion`):

```tsx
import { motion } from 'motion/react';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  Content
</motion.div>
```

---

## Debugging

- **Network errors**: Check browser DevTools → Network tab
- **Socket issues**: Verify backend running on port 5000
- **Auth problems**: Check `localStorage.getItem('token')` in console
- **CORS errors**: Ensure backend `CLIENT_URL` matches frontend origin

---

## Building for Production

```bash
npm run build
# Output: frontend/dist/
```

Deploy `dist/` folder to any static hosting (Netlify, Vercel, GitHub Pages). Set `VITE_API_URL` to production backend URL in hosting environment variables.

---

## TypeScript Tips

- Strict mode enabled
- No implicit `any`
- Use interfaces for props and API responses
- Run `npm run lint` before committing

Common error: "Cannot find module" → ensure `tsconfig.json` `paths` alias correct (`@/*` maps to project root).

---

## Common Issues

**Port 3000 already in use:**
```bash
npm run dev -- --port=3001
```

**Module not found:**
```bash
rm -rf node_modules package-lock.json
npm install
```

**Socket not connecting:**
- Verify backend: `curl http://localhost:5000/api/health`
- Check token exists: `localStorage.getItem('token')`
- Ensure `SERVER_URL` derived correctly from `VITE_API_URL`

---

## Deployment Checklist

- [ ] Update `VITE_API_URL` to production backend
- [ ] Run `npm run build`
- [ ] Upload `dist/` to hosting
- [ ] Configure backend CORS for production domain
- [ ] Set `NODE_ENV=production` on backend
- [ ] Use strong `JWT_SECRET` in production
