# Agent Lightning Mutator

Claude-powered mutation engine for Agent Lightning Prompt Optimizer.

## Overview

The Mutator service uses Claude AI to generate intelligent variations of agent prompts. It applies various mutation strategies like rephrasing for clarity, adding examples, adjusting verbosity, and more.

## Features

- **11 Mutation Types**: Diverse mutation strategies for prompt evolution
- **Claude-Powered**: Uses Claude 3.5 (Haiku/Sonnet) for intelligent mutations
- **Smart Model Selection**: Automatically selects appropriate model based on mutation complexity
- **Validation**: Validates mutations before saving to ensure quality
- **Retry Logic**: Handles API rate limits with exponential backoff
- **Continuous Operation**: Polls for candidates needing mutation

## Mutation Types

| Mutation | Description | Complexity |
|----------|-------------|------------|
| `rephrase_clarity` | Rewrite for clarity and directness | Medium |
| `add_examples` | Add concrete examples | Medium |
| `remove_examples` | Remove specific examples | Simple |
| `increase_verbosity` | Add more detail | Medium |
| `decrease_verbosity` | Make more concise | Simple |
| `add_edge_cases` | Add edge case handling | Medium |
| `restructure_sections` | Reorganize for better flow | Medium |
| `change_tone_formal` | Make more formal | Simple |
| `change_tone_casual` | Make more casual | Simple |
| `add_constraints` | Add explicit constraints | Medium |
| `simplify_instructions` | Simplify complex instructions | Simple |

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/agent_lightning

# Anthropic API
ANTHROPIC_API_KEY=sk-ant-xxxxx

# Service Configuration
MUTATION_POLL_INTERVAL_MS=10000
MUTATION_BATCH_SIZE=5
MAX_CONCURRENT_MUTATIONS=3

# Model Selection
DEFAULT_MUTATION_MODEL=claude-3-5-haiku-20241022
COMPLEX_MUTATION_MODEL=claude-3-5-sonnet-20241022

# Validation
MIN_PROMPT_LENGTH=50
MAX_PROMPT_LENGTH=100000
MIN_SEMANTIC_SIMILARITY=0.7
```

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

### Docker

```bash
docker build -t agent-lightning-mutator .
docker run --env-file .env agent-lightning-mutator
```

## Architecture

### Service Flow

1. Poll database for candidates with low comparison counts
2. Select random mutation based on weights
3. Choose appropriate Claude model (Haiku for simple, Sonnet for complex)
4. Apply mutation via Claude API
5. Validate mutated prompt
6. Save to database as new candidate version
7. Log mutation attempt

### Mutation Process

```
Original Prompt
      ↓
Meta-Prompt (mutation instruction)
      ↓
Claude API (Haiku/Sonnet)
      ↓
Mutated Prompt
      ↓
Validation
      ↓
Database (new version)
```

### Files

- `src/index.ts` - Main service entry point
- `src/service.ts` - Mutation service implementation
- `src/mutations/` - Individual mutation implementations
- `src/mutations/index.ts` - Mutation registry
- `src/prompts.ts` - Meta-prompts for Claude
- `src/validation.ts` - Mutation validation
- `src/db.ts` - Database operations
- `src/types.ts` - TypeScript types

## API

### MutationService

```typescript
// Apply specific mutation
await service.applyMutation(versionId, 'rephrase_clarity');

// Apply random weighted mutation
await service.applyRandomMutation(versionId);

// Generate N variants
await service.generateVariants(versionId, 5);
```

### Database

```typescript
// Get prompt version
const version = await db.getPromptVersion(versionId);

// Get candidates needing testing
const candidates = await db.getCandidatesForTesting(10);

// Create new version
const newVersion = await db.createPromptVersion({
  agentId: 'executor',
  branchId: branchId,
  content: mutatedContent,
  parentIds: [parentId],
  mutationType: 'rephrase_clarity',
  mutationDetails: { model: 'haiku' }
});
```

## Validation

Mutations are validated for:

- **Length**: Within min/max bounds
- **Non-empty**: Not blank
- **Structure**: Valid JSON structure
- **Semantic similarity**: Not too different from original
- **Critical content**: Key concepts preserved

## Error Handling

- **Rate limits**: Exponential backoff retry
- **API errors**: Logged and skipped
- **Validation failures**: Not saved, error logged
- **Database errors**: Retry with backoff

## Monitoring

The service logs:

- Mutation attempts (success/failure)
- Validation warnings
- API errors and retries
- Processing statistics

## Performance

- **Cost**: Uses Haiku for 80% of mutations (3x cheaper than Sonnet)
- **Speed**: Parallel processing up to `MAX_CONCURRENT_MUTATIONS`
- **Rate limits**: Automatic retry with backoff

## Development

### Adding New Mutations

1. Create mutation function in `src/mutations/`
2. Add meta-prompt to `src/prompts.ts`
3. Register in `src/mutations/index.ts`
4. Set weight and complexity

Example:

```typescript
// src/mutations/myMutation.ts
export async function myMutation(
  content: PromptContent,
  context: MutationContext
): Promise<PromptContent> {
  const prompt = formatMutationPrompt('my_mutation', content.systemPrompt);
  const response = await context.anthropic.messages.create({
    model: context.model,
    max_tokens: 8000,
    temperature: 0.7,
    messages: [{ role: 'user', content: prompt }]
  });
  // ... extract and return mutated content
}

// src/mutations/index.ts
export const MUTATIONS = {
  // ...
  my_mutation: {
    name: 'My Mutation',
    description: 'Does something cool',
    weight: 0.8,
    complexity: 'medium',
    apply: myMutation
  }
};
```

## License

MIT
