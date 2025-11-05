# Contributing Guide

Guidelines for developing and maintaining The Ready Lab Video Platform API.

## Getting Started

1. **Clone and Setup**
   ```bash
   cd TRL-API
   pnpm install
   cp .env.example .env
   # Configure your .env
   ```

2. **Start Development Servers**
   ```bash
   pnpm dev:api      # API server
   pnpm dev:worker   # Background worker
   ```

## Project Structure

```
TRL-API/
├── packages/
│   ├── api/           # REST API server
│   ├── worker/        # Background jobs
│   └── shared/        # Shared types/utils
├── database/          # SQL schemas
├── scripts/           # Helper scripts
├── examples/          # Example code
└── .github/           # GitHub config
```

## Development Workflow

### 1. Making Changes

**Always:**
- Work in a feature branch
- Follow TypeScript strict mode
- Add types for all functions
- Handle errors gracefully

**Branch Naming:**
- `feature/video-analytics`
- `fix/caption-generation`
- `docs/api-reference`

### 2. Adding a New Endpoint

**Example: Add video delete endpoint**

1. **Add route** in `packages/api/src/routes/videos.ts`:
   ```typescript
   fastify.delete('/:id', {
     onRequest: [requireAuth],
     handler: deleteVideo,
   });
   ```

2. **Add controller** in `packages/api/src/controllers/videos.ts`:
   ```typescript
   export async function deleteVideo(
     request: FastifyRequest<{ Params: { id: string } }>,
     reply: FastifyReply
   ) {
     const { id } = request.params;

     // Implementation
     await sql`DELETE FROM video_assets WHERE id = ${id}`;

     return reply.code(204).send();
   }
   ```

3. **Test manually**:
   ```bash
   curl -X DELETE http://localhost:4000/api/videos/[ID]
   ```

### 3. Adding a New Job Type

**Example: Add video thumbnail generation**

1. **Define job type** in `packages/shared/src/types/jobs.ts`:
   ```typescript
   export interface GenerateThumbnailJobData {
     videoAssetId: string;
     muxAssetId: string;
     timestamp: number;
   }
   ```

2. **Create queue** in `packages/api/src/config/queue.ts`:
   ```typescript
   export const thumbnailQueue = new Queue<GenerateThumbnailJobData>('thumbnails', {
     connection: redisConnection,
   });
   ```

3. **Create worker** in `packages/worker/src/workers/thumbnail-worker.ts`:
   ```typescript
   export const thumbnailWorker = new Worker<GenerateThumbnailJobData>(
     'thumbnails',
     async (job) => {
       // Implementation
     },
     { connection: { url: config.REDIS_URL } }
   );
   ```

4. **Register worker** in `packages/worker/src/index.ts`:
   ```typescript
   import { thumbnailWorker } from './workers/thumbnail-worker.js';

   // Worker will start automatically
   ```

### 4. Modifying Database Schema

1. **Add migration** in `database/migrations/`:
   ```sql
   -- 002_add_thumbnails.sql
   ALTER TABLE video_assets
   ADD COLUMN thumbnail_url TEXT;
   ```

2. **Update types** in `packages/shared/src/types/video.ts`:
   ```typescript
   export interface VideoAsset {
     // ... existing fields
     thumbnailUrl?: string;
   }
   ```

3. **Run migration**:
   ```bash
   psql $DATABASE_URL < database/migrations/002_add_thumbnails.sql
   ```

## Code Style

### TypeScript

**Use strict types:**
```typescript
// ✅ Good
async function getVideo(id: string): Promise<VideoResponse> {
  // ...
}

// ❌ Bad
async function getVideo(id: any) {
  // ...
}
```

**Handle errors:**
```typescript
// ✅ Good
try {
  const result = await dangerousOperation();
  return result;
} catch (error) {
  logger.error(error, 'Operation failed');
  throw new Error('User-friendly message');
}

// ❌ Bad
const result = await dangerousOperation(); // No error handling
```

**Use async/await:**
```typescript
// ✅ Good
const video = await sql`SELECT * FROM videos WHERE id = ${id}`;

// ❌ Bad
sql`SELECT * FROM videos WHERE id = ${id}`.then(video => ...);
```

### Database Queries

**Use parameterized queries:**
```typescript
// ✅ Good
await sql`SELECT * FROM videos WHERE owner_id = ${ownerId}`;

// ❌ Bad - SQL injection risk
await sql.unsafe(`SELECT * FROM videos WHERE owner_id = '${ownerId}'`);
```

**Add indexes for frequent queries:**
```sql
-- If querying by status frequently
CREATE INDEX idx_videos_status ON video_assets(status);
```

### Error Handling

**Return proper HTTP codes:**
```typescript
// 200 - Success
return reply.send(data);

// 201 - Created
return reply.code(201).send(data);

// 400 - Bad Request
return reply.code(400).send({ error: 'Invalid input' });

// 404 - Not Found
return reply.code(404).send({ error: 'Resource not found' });

// 500 - Internal Error
return reply.code(500).send({ error: 'Internal server error' });
```

## Testing

### Manual Testing

**Use the test script:**
```bash
./scripts/test-api.sh
```

**Or use curl:**
```bash
# Create upload
curl -X POST http://localhost:4000/api/videos/uploads \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","ownerId":"user-123"}'

# Get video
curl http://localhost:4000/api/videos/[ID]
```

### Future: Automated Tests

```typescript
// packages/api/src/__tests__/videos.test.ts
import { test } from 'node:test';
import assert from 'node:assert';

test('creates video upload', async () => {
  const response = await app.inject({
    method: 'POST',
    url: '/api/videos/uploads',
    payload: {
      title: 'Test Video',
      ownerId: 'test-user',
    },
  });

  assert.equal(response.statusCode, 201);
  assert.ok(response.json().uploadUrl);
});
```

## Debugging

### Enable Debug Logs

```bash
# In .env
NODE_ENV=development
LOG_LEVEL=debug
```

### Check Worker Jobs

```typescript
// In Redis CLI
redis-cli

# List queues
KEYS bull:*

# Check job status
HGETALL bull:captions:job-id
```

### Monitor Database Queries

In Supabase dashboard:
- Go to Database → Query Performance
- View slow queries
- Check indexes

## Performance

### Database Optimization

1. **Add indexes for frequent queries**
2. **Use connection pooling** (already configured)
3. **Avoid N+1 queries** - use joins instead

### Worker Optimization

1. **Adjust concurrency** in worker config:
   ```typescript
   new Worker('captions', handler, {
     concurrency: 5, // Process 5 jobs simultaneously
   });
   ```

2. **Monitor memory usage**
3. **Add job timeouts** for long-running tasks

### API Optimization

1. **Add Redis caching** for frequently accessed data
2. **Compress responses** (add compression middleware)
3. **Rate limiting** (add rate-limit middleware)

## Deployment

### Before Deploying

- [ ] All tests passing
- [ ] Environment variables documented
- [ ] Database migrations applied
- [ ] No console.log statements
- [ ] Error handling in place
- [ ] Logging configured

### Deploy Process

1. **Push to GitHub**
2. **Automatic deployment** (Render/Railway)
3. **Verify health check**
4. **Test critical flows**
5. **Monitor logs**

## Common Tasks

### Add New Service Integration

1. **Install package**: `pnpm add @service/sdk`
2. **Add to shared types**: `packages/shared/src/types/`
3. **Create service file**: `packages/api/src/services/service.ts`
4. **Add config**: Update `EnvConfig` in shared
5. **Document**: Update `.env.example` and README

### Update Dependencies

```bash
# Check for updates
pnpm outdated

# Update specific package
pnpm update @fastify/cors

# Update all (careful!)
pnpm update --latest
```

### Add Database Table

1. Create migration SQL file
2. Update schema.sql
3. Add TypeScript types
4. Add RLS policies
5. Test locally
6. Apply to production

## Troubleshooting

### "Cannot find module"

```bash
# Rebuild packages
pnpm -r build

# Or clean and reinstall
pnpm clean
pnpm install
```

### Worker not processing jobs

1. Check Redis connection: `redis-cli ping`
2. Check worker logs for errors
3. Verify queue name matches
4. Check job data format

### Webhook not working

1. Check signature verification
2. Verify webhook URL in Mux
3. Check raw body parsing
4. Review webhook logs in Mux dashboard

## Best Practices

### Security

- Never log sensitive data (API keys, tokens)
- Always verify webhook signatures
- Use parameterized SQL queries
- Validate all user input
- Keep dependencies updated

### Performance

- Use indexes for database queries
- Cache frequently accessed data
- Compress API responses
- Monitor memory usage
- Set job timeouts

### Maintainability

- Write clear comments
- Use descriptive variable names
- Keep functions small and focused
- Handle errors explicitly
- Document complex logic

## Git Workflow

### Commit Messages

```bash
# Format: <type>: <description>

feat: add video thumbnail generation
fix: correct caption timestamp formatting
docs: update API documentation
refactor: simplify webhook handler
test: add video upload tests
```

### Pull Requests

1. Create feature branch
2. Make changes
3. Test locally
4. Push to GitHub
5. Create PR with description
6. Review and merge

## Resources

- [Fastify Documentation](https://fastify.dev/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [Mux Documentation](https://docs.mux.com/)
- [Deepgram Documentation](https://developers.deepgram.com/)
- [Supabase Documentation](https://supabase.com/docs)

## Questions?

Check existing documentation:
- [README.md](./README.md) - Main docs
- [API.md](./API.md) - API reference
- [ARCHITECTURE.md](./.github/ARCHITECTURE.md) - System design
- [STATUS.md](./STATUS.md) - Current status

---

Happy coding! 🚀
