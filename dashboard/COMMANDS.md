# Dashboard Commands Reference

## Development

```bash
# Install dependencies
npm install

# Start development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## Database

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"

# Run schema
psql $DATABASE_URL -f ../database/schema.sql

# Check tables
psql $DATABASE_URL -c "\dt"

# Query trajectories
psql $DATABASE_URL -c "SELECT COUNT(*) FROM trajectories"
```

## File Operations

```bash
# Count lines of code
find src -name "*.ts" -o -name "*.tsx" | xargs wc -l

# Check TypeScript compilation
npx tsc --noEmit

# Format code (if prettier installed)
npx prettier --write "src/**/*.{ts,tsx}"

# Find TODOs
grep -r "TODO" src/
```

## Testing

```bash
# Run type checking
npx tsc --noEmit

# Check for unused exports
npx ts-prune

# Bundle analysis
npm run build && npx @next/bundle-analyzer
```

## Deployment

```bash
# Build production bundle
npm run build

# Test production build locally
npm start

# Environment check
node -e "console.log(require('dotenv').config())"
```

## Troubleshooting

```bash
# Clear Next.js cache
rm -rf .next

# Clear node modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Check Next.js version
npx next --version

# Verify environment variables are loaded
node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL)"
```

## Useful Aliases

Add to your shell config (`~/.bashrc` or `~/.zshrc`):

```bash
alias apo-dev="cd ~/agent-lightning-optimizer/dashboard && npm run dev"
alias apo-build="cd ~/agent-lightning-optimizer/dashboard && npm run build"
alias apo-db="psql \$DATABASE_URL"
```
