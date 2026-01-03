# Quickstart: Clerk Authentication with Tidal Account Connection

**Feature**: 016-clerk-tidal-auth
**Date**: 2026-01-03

## Prerequisites

1. **Clerk Account**: Sign up at [clerk.com](https://clerk.com) and create an application
2. **Tidal Developer Account**: Register at [developer.tidal.com](https://developer.tidal.com) and create an app
3. **HTTPS for Development**: Required for Tidal OAuth (use Vite's HTTPS mode)

## Environment Setup

### 1. Backend Environment Variables

Create/update `backend/.env`:

```bash
# Clerk Authentication
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Tidal OAuth (existing, but ensure these are set)
TIDAL_CLIENT_ID=your_tidal_client_id
TIDAL_CLIENT_SECRET=your_tidal_client_secret  # If required by Tidal
```

### 2. Frontend Environment Variables

Create/update `frontend/.env`:

```bash
# Clerk Authentication
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Tidal OAuth
VITE_TIDAL_CLIENT_ID=your_tidal_client_id
VITE_TIDAL_REDIRECT_URI=https://localhost:5173/auth/tidal/callback
```

### 3. Clerk Dashboard Configuration

1. Go to your Clerk Dashboard → **Configure** → **Social connections**
2. Enable **Google** OAuth provider
3. Under **Paths**, ensure sign-in and sign-up URLs are configured

### 4. Tidal Developer Portal Configuration

1. Go to your Tidal app settings
2. Add redirect URI: `https://localhost:5173/auth/tidal/callback`
3. Note your Client ID for the frontend

## Installation

### Backend Dependencies

```bash
cd backend
npm install @clerk/express @clerk/backend
```

### Frontend Dependencies

```bash
cd frontend
npm install @clerk/clerk-react @tidal-music/auth
```

## Quick Verification

### 1. Start Backend

```bash
cd backend
npm run dev
```

### 2. Start Frontend with HTTPS

Update `frontend/vite.config.ts` for HTTPS:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    https: true,  // Enable HTTPS for Tidal OAuth
    port: 5173,
  },
});
```

Then:

```bash
cd frontend
npm run dev
```

### 3. Test Auth Flow

1. Open `https://localhost:5173`
2. You should see the landing page
3. Click "Sign in with Google"
4. Sign in with `anton.tcholakov@gmail.com` (approved user)
5. You should be prompted to connect Tidal
6. Complete Tidal OAuth
7. You should reach the main application

### 4. Test Non-Approved User

1. Sign out
2. Sign in with a different Google account
3. You should see the waitlist page

## Key Files to Create

### Backend

| File | Purpose |
|------|---------|
| `src/config/allowlist.ts` | Approved email addresses |
| `src/middleware/clerkAuth.ts` | Clerk middleware setup |
| `src/routes/auth.ts` | Auth API endpoints |
| `src/services/tidalAuthService.ts` | Tidal token management |

### Frontend

| File | Purpose |
|------|---------|
| `src/components/auth/ProtectedRoute.tsx` | Route protection |
| `src/components/auth/TidalConnectButton.tsx` | Tidal OAuth trigger |
| `src/pages/LandingPage.tsx` | Public landing page |
| `src/pages/TidalConnectPage.tsx` | Tidal connection prompt |
| `src/pages/WaitlistPage.tsx` | Non-approved user page |
| `src/pages/CallbackPage.tsx` | OAuth callback handler |
| `src/hooks/useTidalAuth.ts` | Tidal auth state hook |

## Testing

### Run Backend Tests

```bash
cd backend
npm test -- --grep "auth"
```

### Run Frontend Tests

```bash
cd frontend
npm test -- --grep "auth"
```

## Troubleshooting

### "Insecure context" Error from Tidal SDK

- Ensure you're using HTTPS (`https://localhost:5173`)
- Check that `vite.config.ts` has `https: true`

### "Invalid redirect URI" from Tidal

- Verify the redirect URI in Tidal Developer Portal matches exactly
- Include the full path: `https://localhost:5173/auth/tidal/callback`

### Clerk Middleware Not Working

- Ensure `CLERK_SECRET_KEY` is set in backend `.env`
- Check that `clerkMiddleware()` is applied before routes

### User Not Recognized as Approved

- Check email case sensitivity (allowlist uses lowercase)
- Verify the exact email in `backend/src/config/allowlist.ts`

## Next Steps

After completing the quickstart:

1. Run `/speckit.tasks` to generate implementation tasks
2. Implement tests first (per constitution)
3. Implement backend auth middleware
4. Implement frontend auth flow
5. Validate against acceptance scenarios in spec.md
