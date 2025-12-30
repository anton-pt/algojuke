# Quickstart: Library Ingestion Scheduling

**Feature**: 007-library-ingestion-scheduling
**Date**: 2025-12-29

## Prerequisites

Before implementing this feature, ensure:

1. **Services running** (Docker):
   ```bash
   docker compose up -d db inngest qdrant
   ```

2. **Worker service** (for testing ingestion):
   ```bash
   cd services/worker && npm run dev
   ```

3. **Backend service**:
   ```bash
   cd backend && npm run dev
   ```

4. **Environment variables** (`.env` in backend):
   ```
   INNGEST_EVENT_KEY=your-dev-key  # From Inngest dashboard
   INNGEST_SIGNING_KEY=your-signing-key
   QDRANT_URL=http://localhost:6333
   ```

---

## Development Flow

### 1. Install Dependencies

```bash
cd backend
npm install inngest @qdrant/js-client-rest
```

### 2. Create Inngest Client

```typescript
// backend/src/clients/inngestClient.ts
import { Inngest, EventSchemas } from "inngest";
import { z } from "zod";

const trackIngestionEvent = new EventSchemas().fromZod({
  "track/ingestion.requested": {
    data: z.object({
      isrc: z.string().length(12),
      title: z.string().min(1),
      artist: z.string().min(1),
      album: z.string().min(1),
      priority: z.number().optional(),
      force: z.boolean().optional(),
    }),
  },
});

export const inngest = new Inngest({
  id: "algojuke-backend",
  schemas: trackIngestionEvent,
});
```

### 3. Create IngestionScheduler Service

```typescript
// backend/src/services/ingestionScheduler.ts
import { inngest } from '../clients/inngestClient.js';
import { QdrantClient } from '@qdrant/js-client-rest';
import { logger } from '../utils/logger.js';

export class IngestionScheduler {
  private qdrant: QdrantClient;

  constructor() {
    this.qdrant = new QdrantClient({
      url: process.env.QDRANT_URL || 'http://localhost:6333',
    });
  }

  async scheduleTrack(track: {
    isrc: string;
    title: string;
    artist: string;
    album: string;
  }) {
    // Check if track exists in Qdrant
    const exists = await this.checkTrackExists(track.isrc);
    if (exists) {
      logger.info('ingestion_skipped_already_indexed', { isrc: track.isrc });
      return { scheduled: false, reason: 'already_indexed' };
    }

    // Send to Inngest
    await inngest.send({
      name: 'track/ingestion.requested',
      data: track,
    });

    logger.info('ingestion_scheduled', { isrc: track.isrc });
    return { scheduled: true };
  }

  // ... implementation details in full service
}
```

### 4. Integrate with LibraryService

```typescript
// backend/src/services/libraryService.ts
// In addTrackToLibrary, after saving:

const savedTrack = await this.trackRepository.save(libraryTrack);

// Schedule ingestion (fire-and-forget)
if (trackData.isrc) {
  try {
    await this.ingestionScheduler.scheduleTrack({
      isrc: trackData.isrc,
      title: savedTrack.title,
      artist: savedTrack.artistName,
      album: savedTrack.albumName || 'Unknown Album',
    });
  } catch (error) {
    logger.error('ingestion_scheduling_failed', {
      isrc: trackData.isrc,
      error: String(error),
    });
  }
}

return savedTrack;
```

---

## Testing

### Manual Testing

1. **Add a track via GraphQL**:
   ```graphql
   mutation {
     addTrackToLibrary(input: { tidalTrackId: "12345678" }) {
       ... on LibraryTrack {
         id
         title
       }
     }
   }
   ```

2. **Check Inngest Dashboard** (http://localhost:8288):
   - Navigate to Functions → track-ingestion
   - Verify event was received with correct ISRC

3. **Check Qdrant Dashboard** (http://localhost:6333/dashboard):
   - After ingestion completes, verify document in `tracks` collection

### Automated Tests

```bash
# Unit tests
cd backend && npm test -- --grep "IngestionScheduler"

# Integration tests
cd backend && npm test -- --grep "library ingestion"
```

---

## Verification Checklist

- [ ] Track added to library → ingestion event sent to Inngest
- [ ] Album added to library → events sent for all tracks with ISRCs
- [ ] Track already in Qdrant → no event sent (skipped)
- [ ] Same track added twice → only one ingestion runs (idempotency)
- [ ] Inngest unavailable → library save succeeds, error logged
- [ ] Qdrant unavailable → event sent anyway (fail-open)

---

## Common Issues

### "INNGEST_EVENT_KEY not set"
- Add to `.env` file or set in terminal
- Get key from Inngest Dev Server dashboard

### "Qdrant connection refused"
- Ensure Qdrant is running: `docker compose up -d qdrant`
- Check URL in env vars

### "Track ingestion not appearing"
- Check worker service is running
- Check Inngest dashboard for errors
- Verify event schema matches worker expectations
