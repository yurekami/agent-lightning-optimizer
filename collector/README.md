# Agent Lightning Trajectory Collector

High-performance trajectory ingestion service for Agent Lightning Prompt Optimizer.

## Features

- **Complete Trajectory Upload**: POST entire trajectory with all steps at once
- **Streaming Ingestion**: Add steps incrementally as they happen
- **Query API**: Fetch trajectories with filtering and pagination
- **High Volume**: Handles 50+ requests/minute
- **Validation**: Comprehensive input validation with Zod
- **Security**: API key authentication middleware

## Quick Start

### Development

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
# Make sure PostgreSQL is running (see db/README.md)

# Start development server
npm run dev
```

### Production

```bash
# Build TypeScript
npm run build

# Start production server
npm start
```

### Docker

```bash
# Build image
docker build -t agent-lightning-collector .

# Run container
docker run -d \
  --name collector \
  -p 3001:3001 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e API_KEY="your-secret-key" \
  agent-lightning-collector
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Create Complete Trajectory
```bash
POST /trajectories
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "agent_id": "executor-42",
  "task_type": "code_generation",
  "initial_prompt": "Create a REST API",
  "steps": [
    {
      "step_number": 1,
      "timestamp": "2024-01-15T10:00:00Z",
      "tool_name": "write_file",
      "tool_input": {"path": "api.ts", "content": "..."},
      "tool_output": {"success": true},
      "thinking_content": "I'll create the API structure...",
      "duration_ms": 1200
    }
  ],
  "outcome": "success",
  "total_duration_ms": 1200
}
```

### Start Streaming Trajectory
```bash
POST /trajectories/start
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "agent_id": "executor-42",
  "task_type": "code_generation",
  "initial_prompt": "Create a REST API",
  "metadata": {"session_id": "abc123"}
}

Response:
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "agent_id": "executor-42",
    "status": "in_progress",
    ...
  }
}
```

### Add Step to Trajectory
```bash
POST /trajectories/stream
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "trajectory_id": "550e8400-e29b-41d4-a716-446655440000",
  "step": {
    "step_number": 1,
    "timestamp": "2024-01-15T10:00:00Z",
    "tool_name": "write_file",
    "tool_input": {"path": "api.ts"},
    "tool_output": {"success": true}
  }
}
```

### Complete Trajectory
```bash
POST /trajectories/:id/complete
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json

{
  "outcome": "success",
  "final_result": {"files_created": 3},
  "total_duration_ms": 5400
}
```

### Get Trajectory
```bash
GET /trajectories/:id
Authorization: Bearer YOUR_API_KEY

Response:
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "agent_id": "executor-42",
    "steps": [...]
  }
}
```

### List Trajectories
```bash
GET /trajectories?agent_id=executor-42&status=completed&limit=10&offset=0
Authorization: Bearer YOUR_API_KEY

Response:
{
  "success": true,
  "data": [...],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "count": 10
  }
}
```

Query parameters:
- `agent_id` (optional): Filter by agent
- `task_type` (optional): Filter by task type
- `status` (optional): `in_progress` or `completed`
- `outcome` (optional): `success`, `failure`, or `partial`
- `limit` (default: 20, max: 100): Results per page
- `offset` (default: 0): Pagination offset

## Environment Variables

See `.env.example` for full configuration options.

Required:
- `DATABASE_URL` or `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `API_KEY` (optional but recommended)

## Error Handling

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error type",
  "message": "Human-readable message",
  "details": [] // Only for validation errors
}
```

HTTP Status Codes:
- `200` - Success
- `201` - Created
- `400` - Validation error
- `401` - Authentication error
- `404` - Not found
- `500` - Internal server error

## Development

```bash
# Type checking
npm run typecheck

# Build
npm run build

# Watch mode
npm run dev
```

## Architecture

```
collector/
├── src/
│   ├── index.ts           # Express server and routes
│   ├── db.ts              # PostgreSQL connection and queries
│   ├── schemas.ts         # Zod validation schemas
│   ├── services/
│   │   └── trajectory.ts  # Business logic
│   └── middleware/
│       └── auth.ts        # API key authentication
├── Dockerfile
├── package.json
└── tsconfig.json
```

## Performance

- Connection pooling: 20 max connections
- Request payload limit: 10MB
- Handles 50+ requests/minute
- Indexed queries for fast retrieval
- Efficient bulk inserts for steps

## Security

- API key authentication via Bearer token
- Helmet.js security headers
- CORS enabled
- Input validation on all endpoints
- No sensitive data in error messages
- Non-root container user
