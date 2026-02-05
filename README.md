# Agent Lightning Prompt Optimizer

A real-time evolutionary prompt optimization system for Claude Agent SDK agents. Inspired by [Microsoft Research's Agent Lightning paper](https://github.com/microsoft/agent-lightning), adapted for prompt optimization with human feedback instead of RL weight training.

## Overview

Instead of fine-tuning model weights, this system optimizes **prompts and instructions** using:

- **Comparison-based human feedback** (DPO-style)
- **Genetic algorithms** with tournament selection
- **LLM-powered mutations** via Claude API
- **Git-like prompt versioning** with branches and lineage tracking

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Claude Agent   │────▶│    Collector    │────▶│   PostgreSQL    │
│   SDK Apps      │     │    Service      │     │    Database     │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┼────────────────────────────────┐
                        │                                │                                │
                        ▼                                ▼                                ▼
               ┌─────────────────┐             ┌─────────────────┐             ┌─────────────────┐
               │    Dashboard    │             │    Optimizer    │             │     Mutator     │
               │  (Human Review) │             │ (Genetic Algo)  │             │ (Claude-powered)│
               └─────────────────┘             └─────────────────┘             └─────────────────┘
                        │                                │                                │
                        └────────────────────────────────┼────────────────────────────────┘
                                                         │
                                                         ▼
                                                ┌─────────────────┐
                                                │    Deployer     │
                                                │ (Approval Flow) │
                                                └─────────────────┘
```

## Features

| Feature | Description |
|---------|-------------|
| **Trajectory Collection** | Capture agent executions with <10 lines of code |
| **Comparison Reviews** | Side-by-side trajectory comparison with keyboard shortcuts |
| **Genetic Optimization** | Tournament selection, crossover, adaptive mutation |
| **11 Mutation Strategies** | Rephrase, add/remove examples, verbosity, tone, structure |
| **Git-like Versioning** | Branches, lineage tracking, diff viewer |
| **Approval Workflow** | Multi-approver deployment with regression detection |
| **Auto-Rollback** | Automatic rollback on metric regression |
| **Slack Integration** | Notifications for reviews, approvals, alerts |
| **Admin Dashboard** | Metrics, Cohen's kappa, fitness trends |

## Project Structure

```
agent-lightning-optimizer/
├── collector/             # Trajectory ingestion API
├── dashboard/             # Next.js review dashboard
├── db/                    # PostgreSQL schema
├── deployer/              # Deployment pipeline
├── mutator/               # LLM mutation engine
├── optimizer/             # Genetic algorithm
└── sdk-instrumentation/   # Claude Agent SDK helper
```

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+
- Anthropic API key (for mutations)

### 1. Set Up Database

```bash
# Create database
createdb agent_lightning

# Run migrations
psql -d agent_lightning -f db/migrations/001_initial_schema.sql

# (Optional) Load seed data
psql -d agent_lightning -f db/seed.sql
```

### 2. Start Dashboard

```bash
cd dashboard
npm install
cp .env.example .env
# Edit .env with your DATABASE_URL
npm run dev
```

Open http://localhost:3000

### 3. Start Collector

```bash
cd collector
npm install
cp .env.example .env
# Edit .env with DATABASE_URL and API_KEY
npm run dev
```

### 4. Instrument Your Agent

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';
import { instrument } from '@agent-lightning/instrumentation';

const lightning = instrument({
  collectorUrl: 'http://localhost:4000',
  apiKey: process.env.LIGHTNING_API_KEY,
  agentId: 'my-agent'
});

for await (const message of query({
  prompt: "Fix the bug in auth.py",
  options: {
    allowedTools: ["Read", "Edit", "Bash"],
    hooks: lightning.hooks  // <-- Just add this!
  }
})) {
  console.log(message);
}
```

### 5. Start Optimization Services

```bash
# Terminal 1: Optimizer (genetic algorithm)
cd optimizer && npm install && npm run dev

# Terminal 2: Mutator (LLM-powered mutations)
cd mutator && npm install && npm run dev

# Terminal 3: Deployer (approval workflow)
cd deployer && npm install && npm run dev
```

## Services

### Collector (`collector/`)

REST API for trajectory ingestion.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/trajectories` | POST | Upload complete trajectory |
| `/trajectories/start` | POST | Start streaming trajectory |
| `/trajectories/stream` | POST | Add step to trajectory |
| `/trajectories/:id/complete` | POST | Complete trajectory |
| `/trajectories` | GET | List trajectories |

### Dashboard (`dashboard/`)

Next.js application with:

- **Reviews**: Side-by-side comparison interface
- **Prompts**: Version management with branches
- **Admin**: Metrics, reviewer stats, deployments

### Optimizer (`optimizer/`)

Genetic algorithm engine:

- Tournament selection with elitism
- Single-point and uniform crossover
- Adaptive mutation rate
- Fitness calculation from comparison feedback

### Mutator (`mutator/`)

Claude-powered prompt mutations:

| Mutation | Description |
|----------|-------------|
| `rephrase_clarity` | Rewrite for clarity |
| `add_examples` | Add concrete examples |
| `remove_examples` | Remove verbose examples |
| `increase_verbosity` | Add more detail |
| `decrease_verbosity` | Make more concise |
| `add_edge_cases` | Handle edge cases |
| `restructure_sections` | Reorganize sections |
| `change_tone_formal` | More formal tone |
| `change_tone_casual` | More casual tone |
| `add_constraints` | Add explicit constraints |
| `simplify` | Simplify complex instructions |

### Deployer (`deployer/`)

Deployment pipeline with:

- Multi-approver workflow
- Baseline metrics capture
- Post-deployment monitoring
- Automatic regression detection
- One-click rollback

## Database Schema

11 tables for complete prompt lifecycle management:

| Table | Purpose |
|-------|---------|
| `trajectories` | Agent execution traces |
| `prompt_versions` | Versioned prompts with lineage |
| `branches` | Git-like branches |
| `comparison_feedback` | Human preference data |
| `reviewers` | User management |
| `review_queue` | Pending comparisons |
| `agents` | Agent definitions |
| `deployments` | Deployment history |
| `approval_requests` | Approval workflow |
| `approval_votes` | Individual votes |
| `regression_reports` | Regression detection |

## Environment Variables

### Collector
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/agent_lightning
API_KEY=your-collector-api-key
PORT=4000
```

### Dashboard
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/agent_lightning
```

### Mutator
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/agent_lightning
ANTHROPIC_API_KEY=sk-ant-...
```

### Deployer
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/agent_lightning
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

## Docker

Each service includes a Dockerfile:

```bash
# Build all services
docker build -t lightning-collector ./collector
docker build -t lightning-mutator ./mutator
docker build -t lightning-deployer ./deployer

# Run with docker-compose (if available)
docker-compose up
```

## How It Works

### 1. Collect Trajectories

Instrument your Claude Agent SDK apps to capture execution traces. The SDK helper uses hooks to record every LLM call and tool use.

### 2. Generate Comparisons

The system pairs trajectories with similar tasks but different prompt versions, creating comparison items for human review.

### 3. Human Review

Reviewers compare trajectory pairs side-by-side:
- Mark task success/failure
- Rate efficiency (1-5)
- Select preference (A/B/Tie)

### 4. Evolve Prompts

The genetic algorithm:
1. Calculates fitness from comparison win rates
2. Selects top performers via tournament
3. Creates offspring via crossover
4. Applies LLM-powered mutations
5. Adds new candidates to population

### 5. Deploy Improvements

When a prompt candidate shows improvement:
1. Request approval from reviewers
2. Capture baseline metrics
3. Deploy to production
4. Monitor for regression
5. Auto-rollback if needed

## API Reference

See individual service READMEs:

- [Collector API](./collector/README.md)
- [Dashboard Setup](./dashboard/README.md)
- [Mutator Architecture](./mutator/ARCHITECTURE.md)
- [SDK Instrumentation](./sdk-instrumentation/README.md)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT

## Acknowledgments

- [Agent Lightning (Microsoft Research)](https://github.com/microsoft/agent-lightning) - Original RL training framework
- [Claude Agent SDK](https://docs.anthropic.com/en/docs/agent-sdk) - Agent framework
- [Anthropic](https://anthropic.com) - Claude API for mutations
