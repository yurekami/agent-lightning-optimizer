# Dashboard Setup Guide

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 14+ running
- Database created (see `../database/schema.sql`)

## Installation Steps

### 1. Install Dependencies

```bash
cd dashboard
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set your database URL:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/agent_lightning
NEXT_PUBLIC_API_URL=http://localhost:3000/api
```

### 3. Initialize Database

Run the schema from the parent `database/` directory:

```bash
psql -U your_user -d agent_lightning -f ../database/schema.sql
```

### 4. Start Development Server

```bash
npm run dev
```

The dashboard will be available at [http://localhost:3000](http://localhost:3000)

## Project Structure

```
dashboard/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx          # Root layout with sidebar
│   │   ├── page.tsx            # Dashboard home
│   │   ├── reviews/            # Review interface
│   │   ├── prompts/            # Prompt management
│   │   ├── admin/              # Admin panel
│   │   └── api/                # API routes
│   │       ├── trajectories/   # Trajectory endpoints
│   │       ├── reviews/        # Review endpoints
│   │       ├── prompts/        # Prompt endpoints
│   │       └── admin/          # Admin endpoints
│   ├── components/             # React components
│   │   ├── ui/                 # Base UI components
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   └── input.tsx
│   │   ├── TrajectoryViewer.tsx
│   │   ├── ComparisonInterface.tsx
│   │   └── PromptEditor.tsx
│   ├── lib/                    # Utilities
│   │   ├── db.ts              # PostgreSQL client
│   │   └── utils.ts           # Helper functions
│   └── types/                  # TypeScript definitions
│       └── index.ts           # All type definitions
├── public/                     # Static assets
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.js
```

## Pages

### Dashboard (`/`)
- System metrics overview
- Active trajectories count
- Review statistics
- Quick start guide

### Reviews (`/reviews`)
- Review queue interface
- Side-by-side trajectory comparison
- Feedback submission form
- Personal review statistics

### Prompts (`/prompts`)
- Prompt version management
- Branch visualization
- Performance metrics
- Training history

### Admin (`/admin`)
- Database status
- User management
- System configuration
- Training parameters

## API Routes

All API routes return JSON responses.

### Trajectories

**GET** `/api/trajectories`
- Query params: `agent_name`, `status`
- Returns: List of trajectories

**POST** `/api/trajectories`
- Body: `{ session_id, agent_name, prompt_version_id, input_data }`
- Returns: Created trajectory

### Reviews

**GET** `/api/reviews`
- Query params: `reviewer_id`
- Returns: List of comparison feedback

**POST** `/api/reviews`
- Body: `{ reviewer_id, trajectory_a_id, trajectory_b_id, winner, confidence, reasoning }`
- Returns: Created feedback

### Prompts

**GET** `/api/prompts`
- Query params: `agent_name`, `branch_name`, `is_active`
- Returns: List of prompt versions

**POST** `/api/prompts`
- Body: `{ agent_name, prompt_template, branch_name, created_by }`
- Returns: Created prompt version

### Admin

**GET** `/api/admin`
- Returns: System statistics and database status

## Dark Mode

The dashboard uses dark mode by default. The theme is defined in:
- `src/app/globals.css` - CSS variables
- `src/app/layout.tsx` - HTML class="dark"
- `tailwind.config.ts` - Theme configuration

## Components

### UI Primitives
- `Button` - Styled button with variants
- `Card` - Container component
- `Input` - Form input field

### Domain Components
- `TrajectoryViewer` - Display single trajectory with steps
- `ComparisonInterface` - Side-by-side trajectory comparison
- `PromptEditor` - Create/edit prompt versions

## Database Integration

The `src/lib/db.ts` file provides:
- PostgreSQL connection via `postgres` package
- Connection pooling (max 10 connections)
- Type-safe SQL tagged template literals

Example usage:

```typescript
import { sql } from '@/lib/db'

const trajectories = await sql`
  SELECT * FROM trajectories
  WHERE agent_name = ${agentName}
  ORDER BY created_at DESC
`
```

## Type Safety

All database models are defined in `src/types/index.ts`:
- `Trajectory` - Execution trace
- `TrajectoryStep` - Individual step
- `PromptVersion` - Prompt template version
- `ComparisonFeedback` - Human preference
- `Reviewer` - User account
- `Branch` - Prompt branch
- `TrainingRun` - APO training session

## Production Build

```bash
# Create optimized production build
npm run build

# Start production server
npm start
```

The build output will be in `.next/` directory.

## Troubleshooting

### Database Connection Issues

Check your `DATABASE_URL` environment variable:

```bash
psql $DATABASE_URL -c "SELECT 1"
```

### Port Already in Use

Change the port in `package.json`:

```json
"dev": "next dev -p 3001"
```

### TypeScript Errors

Ensure all types are properly imported:

```typescript
import type { Trajectory } from '@/types'
```

## Next Steps

1. Implement authentication
2. Add real-time updates with WebSockets
3. Integrate with backend APO service
4. Add data visualization with charts
5. Implement batch review workflows
