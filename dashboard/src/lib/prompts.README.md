# Prompt Version Management System

Git-like branching and versioning system for Agent Lightning Prompt Optimizer.

## Features

### Branch Management
- **Main Branch**: Every agent has a main branch (production)
- **Feature Branches**: Create branches from any parent branch
- **Branch Hierarchy**: Visualize branch relationships in a tree structure
- **Branch Merging**: Merge changes from one branch to another with conflict detection

### Version Control
- **Versioning**: Sequential version numbers per branch (v1, v2, v3...)
- **Parent Tracking**: Track parent version(s) for lineage
- **Mutation Metadata**: Store mutation type and details for evolution tracking
- **Status Lifecycle**: candidate → approved → production → retired

### Lineage Tracking
- **Full Lineage**: View complete ancestor/descendant tree
- **Crossover Support**: Versions can have multiple parents (genetic crossover)
- **Common Ancestors**: Find common ancestor between versions
- **Graph Visualization**: Interactive lineage graph with zoom/pan

### Diff System
- **Line-by-Line Diff**: LCS-based algorithm for accurate diffs
- **Prompt Part Diff**: Separate diffs for system prompt, tools, subagents
- **Unified/Split Views**: Toggle between unified and side-by-side views
- **Syntax Highlighting**: Color-coded additions/deletions/context
- **Diff to Production**: Quick comparison against current production version

## Usage

### Creating a Branch

```typescript
import { createBranch } from '@/lib/prompts'

const branch = await createBranch(
  'oh-my-claudecode:executor',  // agentId
  'feature/improved-error-handling',  // branch name
  parentBranchId  // optional: branch from another branch
)
```

### Creating a Version

```typescript
import { createVersion } from '@/lib/prompts'

const version = await createVersion({
  agentId: 'oh-my-claudecode:executor',
  branchId: branch.id,
  content: {
    systemPrompt: 'You are an expert code executor...',
    toolDescriptions: {
      'bash': 'Execute bash commands...',
      'edit': 'Edit files...',
    },
    subagentPrompts: {
      'debugger': 'Debug complex issues...',
    },
  },
  parentIds: [parentVersion.id],
  mutationType: 'rephrase',
  mutationDetails: { section: 'error_handling' },
  createdBy: 'evolution',  // or 'manual'
})
```

### Getting Lineage

```typescript
import { getLineage, getAncestors, getDescendants } from '@/lib/prompts'

// Full lineage tree
const lineage = await getLineage(versionId)

// Just ancestors (parents, grandparents...)
const ancestors = await getAncestors(versionId, 3)  // depth=3

// Just descendants (children, grandchildren...)
const descendants = await getDescendants(versionId)
```

### Diffing Versions

```typescript
import { getVersion, getProductionVersion } from '@/lib/prompts'
import { diffPromptContent } from '@/lib/diff'

const version = await getVersion(versionId)
const production = await getProductionVersion(agentId)

const diff = diffPromptContent(production.content, version.content)

console.log(diff.summary)
// { additions: 10, deletions: 5, changes: 3 }
```

### Merging Branches

```typescript
import { canMerge, mergeBranch } from '@/lib/prompts'

// Check if merge is possible
const analysis = await canMerge(sourceBranchId, targetBranchId)

if (analysis.canMerge) {
  // Perform merge
  const mergeVersion = await mergeBranch(
    sourceBranchId,
    targetBranchId,
    'reviewer@example.com'
  )
}
```

### Approving and Deploying

```typescript
import { approveVersion, deployVersion } from '@/lib/prompts'

// Approve a version
await approveVersion(versionId, 'reviewer@example.com')

// Deploy to production
await deployVersion(versionId, reviewerId)
```

## API Routes

### Branches
- `GET /api/prompts/branches?agentId=xxx` - List branches
- `POST /api/prompts/branches` - Create branch
- `DELETE /api/prompts/branches?branchId=xxx` - Delete branch

### Versions
- `GET /api/prompts/versions?branchId=xxx&status=xxx` - List versions
- `POST /api/prompts/versions` - Create version
- `GET /api/prompts/versions/[versionId]` - Get version
- `GET /api/prompts/versions/[versionId]/lineage` - Get lineage
- `POST /api/prompts/versions/[versionId]/approve` - Approve version
- `POST /api/prompts/versions/[versionId]/deploy` - Deploy version

### Merge
- `GET /api/prompts/merge?sourceBranchId=xxx&targetBranchId=xxx` - Analyze merge
- `POST /api/prompts/merge` - Merge branches

### Diff
- `GET /api/prompts/diff?versionIdA=xxx&versionIdB=xxx` - Diff two versions
- `GET /api/prompts/diff?versionId=xxx&toProduction=true` - Diff to production

## Database Schema

### branches
```sql
CREATE TABLE branches (
    id UUID PRIMARY KEY,
    agent_id VARCHAR(255) REFERENCES agents(id),
    name VARCHAR(255) NOT NULL,
    parent_branch_id UUID REFERENCES branches(id),
    created_at TIMESTAMPTZ NOT NULL,
    is_main BOOLEAN NOT NULL DEFAULT FALSE,
    UNIQUE(agent_id, name)
)
```

### prompt_versions
```sql
CREATE TABLE prompt_versions (
    id UUID PRIMARY KEY,
    agent_id VARCHAR(255) REFERENCES agents(id),
    branch_id UUID REFERENCES branches(id),
    version INTEGER NOT NULL,
    content JSONB NOT NULL,
    parent_ids UUID[] DEFAULT '{}',
    mutation_type VARCHAR(100),
    mutation_details JSONB,
    fitness JSONB,
    status prompt_version_status NOT NULL DEFAULT 'candidate',
    created_at TIMESTAMPTZ NOT NULL,
    created_by prompt_creator NOT NULL DEFAULT 'manual',
    approved_by VARCHAR(255)[] DEFAULT '{}',
    deployed_at TIMESTAMPTZ,
    UNIQUE(agent_id, branch_id, version)
)
```

## UI Components

### BranchManager
```tsx
<BranchManager
  agentId="oh-my-claudecode:executor"
  branches={branches}
  currentBranchId={currentBranch.id}
  onBranchChange={handleBranchChange}
  onCreateBranch={handleCreateBranch}
  onDeleteBranch={handleDeleteBranch}
  onMergeBranch={handleMergeBranch}
/>
```

### VersionTimeline
```tsx
<VersionTimeline
  versions={versions}
  selectedVersionId={selectedVersion.id}
  productionVersionId={productionVersion.id}
  onSelectVersion={handleSelectVersion}
  onApproveVersion={handleApproveVersion}
  onDeployVersion={handleDeployVersion}
/>
```

### LineageGraph
```tsx
<LineageGraph
  lineage={lineage}
  selectedVersionId={selectedVersion.id}
  productionVersionId={productionVersion.id}
  onSelectVersion={handleSelectVersion}
/>
```

### PromptDiffViewer
```tsx
<PromptDiffViewer
  diff={diff}
  oldLabel="Production (v5)"
  newLabel="v7"
/>
```

## Performance Considerations

### Efficient Lineage Queries
The lineage system uses PostgreSQL recursive CTEs for efficient ancestor/descendant queries:

```sql
WITH RECURSIVE lineage_tree AS (
  SELECT * FROM prompt_versions WHERE id = $1
  UNION ALL
  SELECT pv.* FROM prompt_versions pv
  JOIN lineage_tree lt ON pv.id = ANY(lt.parent_ids)
)
SELECT * FROM lineage_tree
```

### Diff Optimization
- Uses LCS algorithm (O(m*n)) for accurate line-level diffs
- Groups changes into hunks with configurable context
- Only diffs changed sections (system prompt, tools, subagents)

### UI Optimization
- Virtual scrolling for large version lists
- Lazy loading of lineage data
- Debounced zoom/pan in lineage graph
- Collapsible sections in diff viewer

## Evolution Integration

The version management system integrates with the APO evolution engine:

1. **Evolution creates versions**: When APO generates a mutated prompt, it creates a new version with:
   - `createdBy: 'evolution'`
   - `mutationType`: type of mutation (rephrase, crossover, etc.)
   - `mutationDetails`: metadata about the mutation
   - `parentIds`: parent version(s) for tracking lineage

2. **Fitness tracking**: As trajectories are compared, fitness metrics are updated:
   - Win rate from comparison feedback
   - Success rate from trajectory outcomes
   - Comparison count for statistical significance

3. **Promotion path**: Versions progress through statuses:
   - `candidate`: Just created by evolution
   - `approved`: Reviewed and approved by human
   - `production`: Deployed and active
   - `retired`: Replaced by newer production version

## Future Enhancements

- [ ] Cherry-pick: Apply specific mutations from one branch to another
- [ ] Rebase: Rebase a branch onto a new parent
- [ ] Conflict resolution UI: Interactive conflict resolution for merges
- [ ] Diff export: Export diffs as unified diff format
- [ ] Version tags: Tag specific versions (v1.0, stable, etc.)
- [ ] Branch protection: Prevent direct commits to main branch
- [ ] Auto-merge: Automatically merge approved versions
- [ ] Version comparison matrix: Compare multiple versions at once
