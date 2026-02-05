# Mutator Architecture

## Overview

The Mutator is the LLM-powered mutation engine for Agent Lightning. It uses Claude AI to intelligently mutate agent prompts, creating variations that can be tested and evolved.

## Core Components

### 1. Mutation Service (`service.ts`)

Main orchestrator that:
- Fetches prompt versions from database
- Applies mutations via Claude API
- Validates results
- Saves mutated versions
- Handles retries and rate limits

**Key Methods:**
- `applyMutation(versionId, mutationType)` - Apply specific mutation
- `applyRandomMutation(versionId)` - Apply weighted random mutation
- `generateVariants(versionId, count)` - Generate N variants

### 2. Mutation Registry (`mutations/index.ts`)

Central registry defining all 11 mutation types:

| Mutation | Weight | Complexity | Use Case |
|----------|--------|------------|----------|
| `rephrase_clarity` | 1.0 | Medium | Improve clarity |
| `add_examples` | 0.8 | Medium | Add concrete examples |
| `remove_examples` | 0.6 | Simple | Remove examples |
| `increase_verbosity` | 0.7 | Medium | Add detail |
| `decrease_verbosity` | 0.7 | Simple | Make concise |
| `add_edge_cases` | 0.8 | Medium | Add edge case handling |
| `restructure_sections` | 0.6 | Medium | Reorganize content |
| `change_tone_formal` | 0.5 | Simple | Make formal |
| `change_tone_casual` | 0.5 | Simple | Make casual |
| `add_constraints` | 0.7 | Medium | Add constraints |
| `simplify_instructions` | 0.8 | Simple | Simplify |

**Weighted Selection:**
- Higher weight = higher probability
- Total weight = 8.2
- Random selection based on cumulative weights

### 3. Mutation Implementations

Each mutation type has its own implementation:

**Structure:**
```typescript
async function mutationName(
  content: PromptContent,
  context: MutationContext
): Promise<PromptContent> {
  // 1. Format meta-prompt
  const prompt = formatMutationPrompt('mutation_type', content.systemPrompt);

  // 2. Call Claude API
  const response = await context.anthropic.messages.create({
    model: context.model,
    max_tokens: 8000,
    temperature: 0.7,
    messages: [{ role: 'user', content: prompt }]
  });

  // 3. Extract and return mutated content
  return { ...content, systemPrompt: extractedText };
}
```

**Files:**
- `mutations/rephrase.ts` - Clarity improvements
- `mutations/examples.ts` - Add/remove examples
- `mutations/verbosity.ts` - Verbosity adjustments
- `mutations/structure.ts` - Structural changes
- `mutations/tone.ts` - Tone adjustments

### 4. Meta-Prompts (`prompts.ts`)

Templates that instruct Claude how to mutate prompts.

**Structure:**
```
You are an expert prompt engineer optimizing prompts for AI agents.

ORIGINAL PROMPT:
{original_prompt}

TASK: [Specific mutation task]

GUIDELINES:
- [Specific guidelines]
- Preserve all functionality
- Do not add new capabilities

OUTPUT: Return ONLY the modified system prompt text, no explanation.

MODIFIED PROMPT:
```

**Key Principles:**
- Clear task definition
- Preservation constraints
- Output format specification
- No meta-commentary

### 5. Validation (`validation.ts`)

Validates mutations before saving:

**Checks:**
- Length within bounds (50-100,000 chars)
- Non-empty content
- Valid JSON structure
- Semantic similarity (>0.7)
- Critical keywords preserved

**Returns:**
```typescript
{
  valid: boolean,
  errors: string[],
  warnings: string[],
  metadata: {
    originalLength: number,
    mutatedLength: number,
    semanticSimilarity: number
  }
}
```

### 6. Database Layer (`db.ts`)

PostgreSQL operations:

**Key Operations:**
- `getPromptVersion(id)` - Fetch version
- `getCandidatesForTesting(limit)` - Get candidates with low comparison counts
- `createPromptVersion(params)` - Save mutated version
- `logMutationAttempt(params)` - Log attempt
- `updateFitness(id)` - Recalculate fitness

### 7. Main Loop (`index.ts`)

Continuous operation:

```
┌─────────────────────┐
│ Poll for Candidates │ (every 10s)
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Get Candidates with │
│ Low Comparison Count│ (< 10 comparisons)
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Process in Batches  │ (max 3 concurrent)
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ For Each Candidate: │
│ - Select mutation   │
│ - Apply via Claude  │
│ - Validate          │
│ - Save to DB        │
└──────────┬──────────┘
           │
           v
┌─────────────────────┐
│ Wait & Repeat       │
└─────────────────────┘
```

## Mutation Flow

```
┌──────────────────┐
│ Original Version │
└────────┬─────────┘
         │
         v
┌──────────────────┐
│ Select Mutation  │ (weighted random)
└────────┬─────────┘
         │
         v
┌──────────────────┐
│ Choose Model     │ (based on complexity)
│ - Simple → Haiku │
│ - Complex → Sonnet│
└────────┬─────────┘
         │
         v
┌──────────────────┐
│ Format Meta-     │
│ Prompt           │
└────────┬─────────┘
         │
         v
┌──────────────────┐
│ Call Claude API  │ (with retry)
└────────┬─────────┘
         │
         v
┌──────────────────┐
│ Extract Response │
└────────┬─────────┘
         │
         v
┌──────────────────┐
│ Validate         │
│ - Length         │
│ - Similarity     │
│ - Structure      │
└────────┬─────────┘
         │
         v
┌──────────────────┐
│ Save to DB       │ (new version)
└────────┬─────────┘
         │
         v
┌──────────────────┐
│ Log Attempt      │
└──────────────────┘
```

## Model Selection Strategy

**Complexity-Based Routing:**

| Complexity | Model | Use Case | Cost |
|------------|-------|----------|------|
| Simple | Haiku | Tone changes, simplification | $$ |
| Medium | Haiku | Most mutations | $$ |
| Complex | Sonnet | Heavy restructuring (future) | $$$$ |

**Cost Optimization:**
- 90% of mutations use Haiku (3x cheaper)
- Only complex mutations use Sonnet
- Configurable via environment variables

## Error Handling

### Rate Limits
```typescript
// Exponential backoff
backoffMs = BASE_BACKOFF * 2^(attempt-1)
// Example: 1s, 2s, 4s
```

### API Errors
- Logged to database
- Candidate skipped
- Process continues

### Validation Failures
- Not saved to database
- Error logged
- Attempt recorded

### Database Errors
- Retry with backoff
- Fatal if persistent

## Configuration

### Environment Variables

```bash
# Core
DATABASE_URL                 # PostgreSQL connection
ANTHROPIC_API_KEY           # Claude API key

# Service
MUTATION_POLL_INTERVAL_MS   # Polling frequency (10000)
MUTATION_BATCH_SIZE         # Candidates per batch (5)
MAX_CONCURRENT_MUTATIONS    # Parallel limit (3)

# Models
DEFAULT_MUTATION_MODEL      # For simple/medium (haiku)
COMPLEX_MUTATION_MODEL      # For complex (sonnet)

# Retry
MAX_RETRIES                 # API retry attempts (3)
RETRY_BACKOFF_MS           # Base backoff time (1000)

# Validation
MIN_PROMPT_LENGTH          # Min chars (50)
MAX_PROMPT_LENGTH          # Max chars (100000)
MIN_SEMANTIC_SIMILARITY    # Similarity threshold (0.7)
```

## Performance Characteristics

### Throughput
- **Sequential**: ~5-10 mutations/min (API limited)
- **Parallel**: ~15-30 mutations/min (3 concurrent)

### Latency
- **Simple mutation**: 2-5 seconds
- **Complex mutation**: 5-10 seconds
- **With retry**: 10-30 seconds

### Cost (per 1000 mutations)
- **Haiku-only**: ~$0.50-1.00
- **Mixed**: ~$1.00-2.00
- **Sonnet-only**: ~$3.00-5.00

## Database Schema

### prompt_versions
```sql
id UUID PRIMARY KEY
agent_id VARCHAR(255)
branch_id UUID
version INTEGER
content JSONB
parent_ids UUID[]
mutation_type VARCHAR(100)
mutation_details JSONB
fitness JSONB
status prompt_version_status
created_by prompt_creator
```

### mutations_log (auto-created)
```sql
id UUID PRIMARY KEY
version_id UUID
mutation_type VARCHAR(100)
success BOOLEAN
error TEXT
result_version_id UUID
duration_ms INTEGER
created_at TIMESTAMPTZ
```

## Extension Points

### Adding New Mutations

1. **Create implementation** (`mutations/newMutation.ts`)
2. **Add meta-prompt** (`prompts.ts`)
3. **Register mutation** (`mutations/index.ts`)
4. **Set weight and complexity**

### Custom Validation Rules

Add to `validation.ts`:
```typescript
export function validateMutation(original, mutated, config) {
  // ... existing checks

  // Add custom check
  if (customCondition) {
    errors.push('Custom error');
  }

  return { valid, errors, warnings, metadata };
}
```

### Alternative Models

Configure via environment:
```bash
DEFAULT_MUTATION_MODEL=claude-3-opus-20240229
```

## Monitoring

### Logs
- Mutation attempts (success/failure)
- Validation warnings
- API errors
- Processing stats

### Metrics (Future)
- Mutations per minute
- Success rate
- Average latency
- Cost per mutation
- Validation failure rate

## Deployment

### Docker
```bash
docker build -t mutator .
docker run --env-file .env mutator
```

### Kubernetes
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mutator
spec:
  replicas: 3  # Scale for throughput
  template:
    spec:
      containers:
      - name: mutator
        image: mutator:latest
        envFrom:
        - secretRef:
            name: mutator-secrets
```

### Scaling

**Horizontal:**
- Multiple replicas process different candidates
- Database coordination prevents duplicates
- Linear throughput scaling

**Vertical:**
- Increase `MAX_CONCURRENT_MUTATIONS`
- Limited by Claude API rate limits
- Diminishing returns above 5 concurrent

## Future Enhancements

### Planned
- [ ] Embeddings-based similarity (better validation)
- [ ] A/B testing of meta-prompts
- [ ] Adaptive mutation weights (based on fitness)
- [ ] Crossover mutations (combine prompts)
- [ ] Context-aware mutations (based on agent type)

### Possible
- [ ] Multi-model ensemble (GPT-4 + Claude)
- [ ] Mutation chaining (sequence of mutations)
- [ ] Semantic diffing (detailed change analysis)
- [ ] Auto-generated meta-prompts
- [ ] Real-time feedback loop

## Testing Strategy

### Unit Tests
```typescript
describe('MutationService', () => {
  it('should apply mutation', async () => {
    const result = await service.applyMutation(versionId, 'rephrase_clarity');
    expect(result).toHaveProperty('id');
  });
});
```

### Integration Tests
```typescript
describe('Database Integration', () => {
  it('should save mutated version', async () => {
    const version = await db.createPromptVersion({...});
    expect(version.mutation_type).toBe('rephrase_clarity');
  });
});
```

### End-to-End Tests
```typescript
describe('Mutation Pipeline', () => {
  it('should complete full mutation cycle', async () => {
    // Create candidate
    // Wait for mutation
    // Verify new version created
  });
});
```

## Troubleshooting

### No Candidates Found
- Check `prompt_versions` table has candidates
- Verify `status = 'candidate'`
- Check comparison counts

### API Errors
- Verify `ANTHROPIC_API_KEY`
- Check rate limits
- Review error logs

### Validation Failures
- Review validation thresholds
- Check original prompt quality
- Examine mutation meta-prompts

### Performance Issues
- Increase `MAX_CONCURRENT_MUTATIONS`
- Reduce `MUTATION_BATCH_SIZE`
- Use faster model (Haiku)
