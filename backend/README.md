# AlgoJuke Backend

GraphQL API server for AI-powered music discovery with Tidal integration.

## Quick Start

### Prerequisites

- Node.js 20.x or higher
- Docker and Docker Compose (for PostgreSQL)
- Clerk account with Google OAuth enabled
- Tidal Developer account

### Installation

```bash
cd backend
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
| `CLERK_PUBLISHABLE_KEY` | Clerk publishable key (pk_test_...) |
| `CLERK_SECRET_KEY` | Clerk secret key (sk_test_...) |
| `TIDAL_CLIENT_ID` | Tidal API client ID |
| `TIDAL_CLIENT_SECRET` | Tidal API client secret |
| `DATABASE_URL` | PostgreSQL connection string |

### Running the Server

1. **Start PostgreSQL**:

   ```bash
   docker compose up db -d
   ```

2. **Run database migrations**:

   ```bash
   npm run migration:run
   ```

3. **Start the development server**:

   ```bash
   npm run dev
   ```

   The GraphQL API will be available at http://localhost:4000/graphql

### Running Tests

```bash
# Run all tests
npm test

# Run auth tests only
npm test -- tests/contract/auth tests/integration/auth

# Type checking
npm run type-check
```

## Authentication

The backend uses Clerk for authentication with a private beta allowlist.

### Architecture

1. **Clerk Middleware**: All requests pass through `clerkMiddleware()` which validates JWT tokens
2. **Allowlist**: Only approved emails (defined in `src/config/allowlist.ts`) can access protected routes
3. **Tidal Tokens**: Stored in Clerk private metadata (8KB limit)

### Auth Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/auth/status` | GET | No | Get current user's auth state |
| `/api/auth/tidal/tokens` | GET | Yes | Get Tidal token status |
| `/api/auth/tidal/tokens` | POST | Yes + Approved | Store Tidal OAuth tokens |
| `/api/auth/tidal/refresh` | POST | Yes + Approved | Update Tidal tokens after SDK refresh |

#### GET /api/auth/status

Returns the current user's authentication state:

```json
{
  "isAuthenticated": true,
  "isApproved": true,
  "hasTidalConnection": true,
  "tidalTokenExpired": false,
  "email": "user@example.com",
  "userId": "user_xxx"
}
```

- `tidalTokenExpired`: If true, the frontend should refresh tokens via Tidal SDK and sync to backend

#### POST /api/auth/tidal/tokens

Stores Tidal OAuth tokens. Validates that all required scopes are present:

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "expiresAt": 1704067200000,
  "scopes": ["user.read", "collection.read", "playlists.read", "playlists.write", "recommendations.read", "search.read"]
}
```

Returns 400 if required scopes are missing.

### Adding Approved Users

Edit `src/config/allowlist.ts`:

```typescript
export const APPROVED_EMAILS = [
  'anton.tcholakov@gmail.com',
  'new.user@example.com', // Add new users here
] as const;
```

### Key Files

| File | Purpose |
|------|---------|
| `src/config/allowlist.ts` | Approved email addresses |
| `src/middleware/clerkAuth.ts` | Clerk middleware and auth guards |
| `src/routes/auth.ts` | Auth API endpoints |
| `src/services/tidalAuthService.ts` | Tidal token storage/retrieval |
| `src/schemas/auth.ts` | Zod schemas for auth contracts |

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── allowlist.ts        # Beta allowlist
│   ├── middleware/
│   │   └── clerkAuth.ts        # Auth middleware
│   ├── routes/
│   │   └── auth.ts             # Auth endpoints
│   ├── services/
│   │   └── tidalAuthService.ts # Tidal token management
│   ├── schemas/
│   │   └── auth.ts             # Zod schemas
│   └── server.ts               # Express server entry
├── tests/
│   ├── contract/auth/          # Contract tests
│   └── integration/auth/       # Integration tests
└── package.json
```

## Troubleshooting

### "User not approved for beta access"

The signed-in user's email is not in the allowlist. Add their email to `src/config/allowlist.ts`.

### Clerk middleware not authenticating

1. Verify `CLERK_SECRET_KEY` is set correctly in `.env`
2. Check that `clerkMiddleware()` is applied before routes in `server.ts`
3. Ensure the frontend is sending the Clerk session token

### Tidal token storage failing

1. Verify the user is approved (in allowlist)
2. Check that token data matches the `TidalTokensInputSchema`
3. Review Clerk private metadata limits (8KB max)
