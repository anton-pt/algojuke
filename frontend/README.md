# AlgoJuke Frontend

React frontend for AI-powered music discovery with Tidal integration.

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- Clerk account with Google OAuth enabled
- Tidal Developer account
- HTTPS for development (required by Tidal OAuth)

### Installation

```bash
cd frontend
npm install
```

### Environment Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Configure the following required variables:

| Variable | Description |
|----------|-------------|
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (pk_test_...) |
| `VITE_TIDAL_CLIENT_ID` | Tidal API client ID |
| `VITE_TIDAL_REDIRECT_URI` | OAuth callback URL (https://localhost:5173/auth/tidal/callback) |
| `VITE_API_URL` | Backend API URL (http://localhost:4000) |

### Running the Development Server

```bash
npm run dev
```

The app will be available at https://localhost:5173 (HTTPS is required for Tidal OAuth).

### Running Tests

```bash
# Run all tests
npm test

# Run auth tests only
npm test -- tests/components/auth

# Type checking
npm run type-check
```

## Authentication Flow

The app uses a three-tier authentication flow:

1. **Landing Page** (`/`): Public page with "Sign in with Google" button
2. **Clerk OAuth**: User signs in with Google via Clerk
3. **Allowlist Check**:
   - If approved → Tidal Connect Page
   - If not approved → Waitlist Page
4. **Tidal OAuth**: User connects their Tidal account
5. **Main App** (`/discover`): Full access to music discovery features

### Auth Routes

| Route | Component | Access |
|-------|-----------|--------|
| `/` | LandingPage | Public |
| `/waitlist` | WaitlistPage | Authenticated (non-approved) |
| `/connect-tidal` | TidalConnectPage | Authenticated + Approved |
| `/auth/tidal/callback` | CallbackPage | Authenticated + Approved |
| `/discover` | DiscoverChat | Fully Connected |

### Key Components

| Component | Purpose |
|-----------|---------|
| `ProtectedRoute` | Route guard checking auth/approval/Tidal status |
| `TidalConnectButton` | Initiates Tidal OAuth flow |
| `AuthLayout` | Centered layout for auth pages |

### Key Hooks

| Hook | Purpose |
|------|---------|
| `useTidalAuth` | Manages Tidal SDK state and OAuth flow |

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── ProtectedRoute.tsx
│   │   │   └── TidalConnectButton.tsx
│   │   ├── layout/
│   │   │   └── AuthLayout.tsx
│   │   └── ErrorBoundary.tsx
│   ├── hooks/
│   │   └── useTidalAuth.ts
│   ├── pages/
│   │   ├── LandingPage.tsx
│   │   ├── WaitlistPage.tsx
│   │   ├── TidalConnectPage.tsx
│   │   ├── CallbackPage.tsx
│   │   └── DiscoverChat.tsx
│   ├── App.tsx
│   └── main.tsx
├── tests/
│   └── components/auth/
└── package.json
```

## Troubleshooting

### "Insecure context" Error from Tidal SDK

Tidal OAuth requires HTTPS. The Vite config is set up for HTTPS by default:

```typescript
// vite.config.ts
server: {
  https: true,
  port: 5173,
}
```

If you see this error:
1. Ensure you're accessing https://localhost:5173 (not http://)
2. Accept the self-signed certificate warning in your browser

### "Invalid redirect URI" from Tidal

1. Verify the redirect URI in Tidal Developer Portal matches exactly
2. The URI should be: `https://localhost:5173/auth/tidal/callback`
3. Include the full path, not just the domain

### User Stuck on Waitlist

The user's email is not in the backend allowlist. Add their email to `backend/src/config/allowlist.ts`.

### OAuth Callback Errors

1. Check the URL for error parameters (e.g., `?error=access_denied`)
2. Ensure the Tidal app has the correct scopes configured
3. Verify the user has an active Tidal subscription

### Sign-Out Not Working

The UserButton from Clerk handles sign-out. If it's not visible:
1. Ensure the user is signed in
2. Check that ClerkProvider wraps the app in `main.tsx`
