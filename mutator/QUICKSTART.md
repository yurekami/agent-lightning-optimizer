# Mutator Quick Start Guide

Get the mutation engine running in 5 minutes.

## Prerequisites

- Node.js 20+
- PostgreSQL database (with Agent Lightning schema)
- Anthropic API key

## Setup

### 1. Install Dependencies

```bash
cd mutator
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Required
DATABASE_URL=postgresql://user:password@localhost:5432/agent_lightning
ANTHROPIC_API_KEY=sk-ant-your-key-here

# Optional (has sensible defaults)
MUTATION_POLL_INTERVAL_MS=10000
MAX_CONCURRENT_MUTATIONS=3
DEFAULT_MUTATION_MODEL=claude-3-5-haiku-20241022
```

### 3. Build

```bash
npm run build
```

### 4. Run

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

## Verify It's Working

You should see:

```
[Mutator] Starting Agent Lightning Mutation Service...
[Mutator] Configuration:
  Default Model: claude-3-5-haiku-20241022
  Complex Model: claude-3-5-sonnet-20241022
  Poll Interval: 10000ms
  Max Concurrent: 3
[Mutator] Starting mutation loop...

[Mutator] Found 3 candidates for mutation
[Mutator] Mutating candidate abc-123 (v5)
[Mutator] Applying Rephrase for Clarity to version abc-123
[Mutator] ✓ Created version 6 (3450ms)
...
```

## Testing Manually

### 1. Create a Test Agent

```sql
INSERT INTO agents (id, name, description)
VALUES ('test-agent', 'Test Agent', 'For testing mutations');
```

### 2. Create a Main Branch

```sql
INSERT INTO branches (agent_id, name, is_main)
VALUES ('test-agent', 'main', true);
```

### 3. Add a Prompt Version

```sql
INSERT INTO prompt_versions (
  agent_id,
  branch_id,
  version,
  content,
  status,
  created_by
) VALUES (
  'test-agent',
  (SELECT id FROM branches WHERE agent_id = 'test-agent' AND is_main = true),
  1,
  '{"systemPrompt": "You are a helpful agent. Always be clear and concise.", "toolDescriptions": {}, "subagentPrompts": {}}'::jsonb,
  'candidate',
  'manual'
);
```

### 4. Watch Mutations Happen

The mutator will automatically:
1. Find this candidate (low comparison count)
2. Select a random mutation
3. Apply via Claude
4. Save mutated version
5. Log the attempt

### 5. Check Results

```sql
-- See all versions
SELECT
  id,
  version,
  mutation_type,
  status,
  created_by
FROM prompt_versions
WHERE agent_id = 'test-agent'
ORDER BY version;

-- See mutation log
SELECT
  mutation_type,
  success,
  duration_ms,
  created_at
FROM mutations_log
ORDER BY created_at DESC
LIMIT 10;
```

## Docker Deployment

### Build Image

```bash
docker build -t agent-lightning-mutator .
```

### Run Container

```bash
docker run \
  --env-file .env \
  --name mutator \
  agent-lightning-mutator
```

### Docker Compose

```yaml
version: '3.8'

services:
  mutator:
    build: ./mutator
    environment:
      DATABASE_URL: postgresql://user:password@db:5432/agent_lightning
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      MUTATION_POLL_INTERVAL_MS: 10000
      MAX_CONCURRENT_MUTATIONS: 3
    depends_on:
      - db
    restart: unless-stopped
```

## Common Issues

### "No candidates need mutation"

**Cause:** No prompt versions with `status = 'candidate'` and low comparison counts.

**Solution:** Add test prompt versions (see above).

### "API key invalid"

**Cause:** Wrong Anthropic API key.

**Solution:** Check `.env` file, ensure key starts with `sk-ant-`.

### "Connection refused"

**Cause:** Database not accessible.

**Solution:** Check `DATABASE_URL`, ensure PostgreSQL is running.

### TypeScript errors

**Cause:** Missing dependencies or build issues.

**Solution:**
```bash
rm -rf node_modules dist
npm install
npm run build
```

## Next Steps

- **Monitor logs**: Watch for mutation patterns
- **Adjust config**: Tune polling interval and concurrency
- **Scale up**: Add more replicas for higher throughput
- **Custom mutations**: Add domain-specific mutation types
- **Integrate**: Connect with optimizer for full APO loop

## API Usage (Programmatic)

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { Database } from './db';
import { MutationService } from './service';

// Setup
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const db = new Database(process.env.DATABASE_URL);
const service = new MutationService(anthropic, db, config);

// Apply specific mutation
const mutated = await service.applyMutation(
  'version-id-here',
  'rephrase_clarity'
);

// Apply random mutation
const random = await service.applyRandomMutation('version-id-here');

// Generate 5 variants
const variants = await service.generateVariants('version-id-here', 5);
```

## Configuration Tips

### High Throughput

```bash
MUTATION_POLL_INTERVAL_MS=5000
MUTATION_BATCH_SIZE=10
MAX_CONCURRENT_MUTATIONS=5
```

### Low Cost

```bash
DEFAULT_MUTATION_MODEL=claude-3-5-haiku-20241022
COMPLEX_MUTATION_MODEL=claude-3-5-haiku-20241022  # Use Haiku for all
```

### Quality Focus

```bash
DEFAULT_MUTATION_MODEL=claude-3-5-sonnet-20241022
MIN_SEMANTIC_SIMILARITY=0.8  # Stricter validation
```

## Monitoring

### Check Mutation Rate

```sql
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as mutations,
  COUNT(*) FILTER (WHERE success) as successful,
  AVG(duration_ms) as avg_duration_ms
FROM mutations_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

### Check Success Rate

```sql
SELECT
  mutation_type,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE success) as successful,
  ROUND(100.0 * COUNT(*) FILTER (WHERE success) / COUNT(*), 1) as success_rate
FROM mutations_log
GROUP BY mutation_type
ORDER BY success_rate DESC;
```

### Check Cost (Approximate)

```sql
-- Assuming $0.25 per 1M input tokens, $1.25 per 1M output tokens
-- Average: 3000 input, 2000 output per mutation
SELECT
  COUNT(*) as total_mutations,
  ROUND(COUNT(*) * (3000 * 0.25 / 1000000 + 2000 * 1.25 / 1000000), 2) as approx_cost_usd
FROM mutations_log
WHERE success = true
  AND created_at > NOW() - INTERVAL '24 hours';
```

## Health Check

The service is healthy if:

- ✅ Process is running (no crashes)
- ✅ Mutations being applied (check logs)
- ✅ Success rate > 80% (check mutations_log)
- ✅ Database connection active
- ✅ Claude API responding

## Support

- **Docs**: See `README.md` and `ARCHITECTURE.md`
- **Issues**: Check mutations_log for errors
- **Performance**: Adjust config based on throughput needs
