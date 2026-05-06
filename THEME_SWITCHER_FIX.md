# Theme Switching Fix

## Problem
The theme toggle button was only visible when a chat was active (`{activeChat && ...}`), and Tailwind classes used hardcoded color names that didn't dynamically update with CSS variables.

## Solution

### 1. Button Visibility
**File:** `frontend/src/components/ChatLayout.tsx` (line ~1107)
- Removed the `{activeChat && ...}` conditional wrapper
- Button now renders `fixed bottom-6 right-6` always visible

### 2. CSS Variable System
**File:** `frontend/src/index.css`

All color references now use CSS custom properties that change based on `data-theme` attribute:

**Dark theme (default):**
```css
:root, [data-theme="dark"] {
  --color-chat-bg: #0b141a;
  --color-sidebar-bg: #111b21;
  --color-header-bg: #202c33;
  --color-bubble-received: #202c33;
  --color-bubble-sent: #005c4b;
  --color-text-primary: #e9edef;
  --color-text-secondary: #8696a0;
  --color-border: #222d34;
  --color-input-bg: #2a3034;
}
```

**Light theme:**
```css
[data-theme="light"] {
  --color-chat-bg: #f0f2f5;
  --color-sidebar-bg: #ffffff;
  --color-header-bg: #f0f2f5;
  --color-bubble-received: #ffffff;
  --color-bubble-sent: #d9fdd3;
  --color-text-primary: #111b21;
  --color-text-secondary: #667781;
  --color-border: #d1d7db;
  --color-input-bg: #f0f2f5;
}
```

All major elements use `var(--color-*)` variables with `transition: background-color 0.3s ease, color 0.3s ease` for smooth animations.

### 3. Theme Context
**File:** `frontend/src/contexts/ThemeContext.tsx`
- Provides `theme` state and `toggleTheme()` function
- Persists to localStorage
- Sets `data-theme` attribute on `<html>` element

## Testing
1. Run `npm run dev` in frontend directory
2. Login and open chat app
3. Click the sun/moon button at bottom-right
4. Entire app (sidebar + main chat) should smoothly transition between dark and light themes
5. Refresh page - theme preference should persist
