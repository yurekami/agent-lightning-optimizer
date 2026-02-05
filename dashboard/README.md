# Agent Lightning Dashboard

Web interface for Agent Lightning Prompt Optimizer.

## Features

- **Dashboard**: Overview of system metrics and activity
- **Reviews**: Compare trajectory pairs and provide human feedback
- **Prompts**: Manage prompt versions and branches
- **Admin**: System configuration and database management

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

3. Run development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000)

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL (via postgres)
- **Validation**: Zod
- **State**: React Query

## Project Structure

```
dashboard/
├── src/
│   ├── app/              # Next.js app router pages
│   │   ├── api/          # API routes
│   │   ├── reviews/      # Review interface
│   │   ├── prompts/      # Prompt management
│   │   └── admin/        # Admin panel
│   ├── components/       # React components
│   │   └── ui/           # UI primitives
│   ├── lib/              # Utilities and database
│   └── types/            # TypeScript types
└── public/               # Static assets
```

## API Endpoints

- `GET /api/trajectories` - List trajectories
- `POST /api/trajectories` - Create trajectory
- `GET /api/reviews` - List feedback
- `POST /api/reviews` - Submit feedback
- `GET /api/prompts` - List prompt versions
- `POST /api/prompts` - Create prompt version
- `GET /api/admin` - System stats

## Development

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## License

MIT
