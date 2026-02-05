# TrajectoryViewer Component - Usage Guide

## Overview

The TrajectoryViewer is a full-featured component for visualizing AI agent execution trajectories with syntax highlighting, keyboard navigation, and detailed step inspection.

## Design Philosophy

**Brutalist-Technical Aesthetic**: Raw monospace typography, high-contrast code blocks, industrial grid layouts, and precise geometric spacing. Perfect for developer tools.

## Features

- **Expandable Timeline**: Collapsible steps with smooth animations
- **Syntax Highlighting**: Automatic language detection for JSON, SQL, Python, TypeScript, JSX, Bash
- **Step Type Icons**: Visual distinction between LLM calls and tool executions
- **Metrics Dashboard**: Total tokens, steps, duration, and status at a glance
- **Keyboard Navigation**:
  - `↑` / `↓` or `j` / `k`: Navigate between steps
  - `Enter` or `Space`: Expand/collapse selected step
  - `Escape`: Collapse all steps
  - `Home` / `End`: Jump to first/last step
- **Tool Call Details**: Parameters, results, success/failure status, duration
- **Thinking Traces**: Extended reasoning visualization
- **Error Highlighting**: Clear visual indicators for failed operations

## Basic Usage

```tsx
import { TrajectoryViewer } from '@/components/TrajectoryViewer'
import { Trajectory } from '@/types'

function MyPage() {
  const trajectory: Trajectory = {
    id: 'traj-123',
    session_id: 'sess-456',
    agent_name: 'DataAnalyst',
    prompt_version_id: 'v1.2.3',
    input_data: { query: 'Analyze sales data' },
    started_at: new Date('2024-01-01T10:00:00Z'),
    completed_at: new Date('2024-01-01T10:05:30Z'),
    status: 'completed',
    steps: [...],
    metadata: {}
  }

  return <TrajectoryViewer trajectory={trajectory} />
}
```

## Advanced Usage

### With Step Selection

```tsx
function MyPage() {
  const [selectedStep, setSelectedStep] = useState<number | undefined>()

  return (
    <TrajectoryViewer
      trajectory={trajectory}
      highlightStepIndex={selectedStep}
      onStepSelect={(index) => {
        setSelectedStep(index)
        console.log('Selected step:', trajectory.steps[index])
      }}
      className="max-w-6xl mx-auto"
    />
  )
}
```

### In a Modal or Drawer

```tsx
function TrajectoryModal({ trajectoryId, onClose }) {
  const { data: trajectory } = useQuery({
    queryKey: ['trajectory', trajectoryId],
    queryFn: () => fetchTrajectory(trajectoryId)
  })

  if (!trajectory) return <Spinner />

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <TrajectoryViewer trajectory={trajectory} />
      </DialogContent>
    </Dialog>
  )
}
```

## Component Structure

### Files Created

1. **`src/components/TrajectoryViewer.tsx`** - Main component
2. **`src/components/ui/badge.tsx`** - Status badges
3. **`src/components/ui/collapsible.tsx`** - Expandable sections
4. **`src/components/ui/syntax-highlighter.tsx`** - Code highlighting wrapper
5. **`src/hooks/useKeyboardNavigation.ts`** - Keyboard navigation hook

### Dependencies Added

- `prism-react-renderer`: Syntax highlighting engine
- `date-fns`: Date formatting (already in project)

## Props Interface

```typescript
interface TrajectoryViewerProps {
  trajectory: Trajectory              // Required: The trajectory to display
  highlightStepIndex?: number         // Optional: Step to highlight (yellow border)
  onStepSelect?: (index: number) => void  // Optional: Callback when step is selected
  className?: string                  // Optional: Additional CSS classes
}
```

## Styling Customization

The component uses Tailwind CSS and is fully themeable. Key design elements:

- **Monospace fonts**: All text uses `font-mono` for technical aesthetic
- **Border accents**: 4px left borders indicate selected/highlighted states
- **High contrast**: Black backgrounds for code blocks, bold text
- **Uppercase labels**: Section headers use uppercase tracking for brutalist feel
- **Animated states**: Smooth transitions on expand/collapse

### Customizing Colors

Modify badge variants in `src/components/ui/badge.tsx`:

```typescript
const badgeVariants = cva('...', {
  variants: {
    variant: {
      success: 'border-green-500 bg-green-500/10 text-green-400',
      // Add your custom variants here
    }
  }
})
```

## Performance Notes

- Syntax highlighting is optimized with lazy rendering
- Large trajectories (100+ steps) maintain smooth scrolling
- Keyboard navigation uses efficient event handling
- Collapsed steps don't render detailed content (conditional rendering)

## Accessibility

- Full keyboard navigation support
- Semantic HTML structure
- ARIA labels on interactive elements
- Screen reader friendly (though optimized for sighted developers)

## Example Data Structure

```typescript
const exampleTrajectory: Trajectory = {
  id: 'traj-abc123',
  session_id: 'sess-xyz789',
  agent_name: 'CodeReviewer',
  prompt_version_id: 'v2.1.0',
  input_data: { file: 'app.py', task: 'review' },
  started_at: new Date('2024-02-05T14:30:00Z'),
  completed_at: new Date('2024-02-05T14:32:15Z'),
  status: 'completed',
  steps: [
    {
      id: 'step-1',
      trajectory_id: 'traj-abc123',
      step_number: 1,
      prompt_text: 'Review the Python file for security issues',
      model_response: 'I will analyze the code for common vulnerabilities...',
      tool_calls: [
        {
          tool_name: 'read_file',
          parameters: { path: 'app.py' },
          result: { content: '# Python code here...' },
          duration_ms: 45
        }
      ],
      thinking_trace: 'First, I need to read the file contents...',
      reward: 0.85,
      timestamp: new Date('2024-02-05T14:30:05Z'),
      metadata: { model: 'gpt-4' }
    },
    // More steps...
  ],
  metadata: { total_tokens: 1523 }
}
```

## Troubleshooting

### Build Errors

If you see "Cannot find module" errors:

```bash
npm install prism-react-renderer date-fns
```

### Syntax Highlighting Not Working

Check that your code blocks are valid JSON/code. The auto-detection works for:
- JSON (starts with `{` or `[`)
- SQL (starts with `SELECT`, `INSERT`, etc.)
- Python (contains `def`, `class`, `import`)
- TypeScript (has type annotations)
- Bash (contains shell commands)

### Keyboard Navigation Not Working

Ensure the component is mounted and the user hasn't focused an input field (keyboard nav is disabled in inputs/textareas).

## Future Enhancements

Potential additions (not yet implemented):
- Export trajectory as JSON/PDF
- Search/filter steps by content
- Diff view between two trajectories
- Playback/replay mode
- Annotations and comments
- Performance timeline visualization

---

**Built with bold design choices. No defaults. No compromises.**
