# Comparison Review Interface

A production-ready interface for human reviewers to compare agent trajectories and provide feedback for prompt optimization.

## Features Implemented

### 1. ComparisonInterface Component
**Location**: `src/components/ComparisonInterface.tsx`

**Features:**
- Side-by-side trajectory viewers with synchronized scrolling
- Clear A/B visual distinction (blue vs purple color scheme)
- Task success toggles for each trajectory
- 1-5 efficiency rating sliders
- Preference selector (A/B/Tie)
- Optional comment textarea
- Skip functionality with reason selection
- Full keyboard shortcut support

**Keyboard Shortcuts:**
- `1` - Select "A is better"
- `2` - Select "B is better"
- `3` - Select "Tie"
- `A` - Toggle A task success
- `B` - Toggle B task success
- `S` - Skip comparison
- `Ctrl+Enter` - Submit review
- `Esc` - Close skip menu

**Visual Design:**
- Gradient header with sparkle icon
- Color-coded badges (blue for A, purple for B)
- Success/failure indicators with icons
- Smooth transitions and hover states
- Mobile-responsive (stacks vertically)

### 2. ReviewQueue Component
**Location**: `src/components/ReviewQueue.tsx`

**Features:**
- List of pending comparisons
- Progress indicator with badge count
- Priority highlighting (orange border)
- Task type and version info
- Timestamp display
- Empty state with friendly message
- Scrollable with sticky positioning

### 3. ReviewStats Component
**Location**: `src/components/ReviewStats.tsx`

**Features:**
- Personal statistics card
- Total reviews, today's count, weekly count
- Agreement rate with other reviewers
- Streak counter with flame icon
- Average review time
- Leaderboard position
- Gamification elements (fire badge for 7+ day streaks)
- Responsive grid layout

### 4. KeyboardShortcutOverlay Component
**Location**: `src/components/KeyboardShortcutOverlay.tsx`

**Features:**
- Toggle with `?` key or floating button
- Organized by category (rating, action, navigation)
- Visual keyboard key badges
- Helpful descriptions
- Backdrop blur modal
- Close with `Esc` key

### 5. Custom Hooks

#### useSyncScroll
**Location**: `src/hooks/useSyncScroll.ts`

Synchronizes scrolling between two trajectory viewers using percentage-based positioning.

#### useReviewQueue
**Location**: `src/hooks/useReviewQueue.ts`

React Query-powered hook for managing review queue:
- Fetches queue and stats
- Submits feedback
- Skips comparisons
- Auto-refreshes every 30 seconds
- Loading states

### 6. API Endpoints

#### GET /api/reviews/queue
Returns pending comparison pairs for the reviewer.

**Query Parameters:**
- `reviewer_id` - Reviewer identifier
- `limit` - Max items to return (default: 10)

**Response:**
```json
{
  "queue": [
    {
      "id": "traj-a-id-traj-b-id",
      "trajectoryA": { /* full trajectory */ },
      "trajectoryB": { /* full trajectory */ },
      "taskType": "agent-name",
      "priority": 5,
      "createdAt": "2026-02-05T00:00:00Z"
    }
  ]
}
```

#### GET /api/reviews/stats
Returns reviewer statistics.

**Query Parameters:**
- `reviewer_id` - Reviewer identifier

**Response:**
```json
{
  "stats": {
    "totalReviews": 42,
    "reviewsToday": 5,
    "reviewsThisWeek": 23,
    "agreementRate": 0.85,
    "currentStreak": 7,
    "leaderboardPosition": 3,
    "avgReviewTime": 180
  }
}
```

#### POST /api/reviews
Submits comparison feedback.

**Request Body:**
```json
{
  "reviewer_id": "default-reviewer",
  "trajectory_a_id": "uuid",
  "trajectory_b_id": "uuid",
  "task_success_a": true,
  "task_success_b": false,
  "efficiency_a": 4,
  "efficiency_b": 2,
  "preference": "A",
  "comment": "A completed faster with cleaner code",
  "metadata": {}
}
```

#### POST /api/reviews/skip
Skips a comparison with a reason.

**Request Body:**
```json
{
  "comparison_id": "traj-a-id-traj-b-id",
  "reviewer_id": "default-reviewer",
  "reason": "Insufficient information to compare"
}
```

### 7. Updated Types
**Location**: `src/types/index.ts`

Added:
- `ComparisonItem` - Queue item structure
- `ReviewStats` - Statistics interface
- Updated `ComparisonFeedback` with new fields

## Page Layout

**Location**: `src/app/reviews/page.tsx`

**Structure:**
- Header with title and description
- ReviewStats card (full width)
- Two-column layout:
  - Left: ReviewQueue (sticky sidebar, 300px)
  - Right: ComparisonInterface (main content)
- KeyboardShortcutOverlay (floating)
- Empty state when no reviews available
- Loading state with spinner

## Design Aesthetic

**Tone**: Professional, efficient, data-driven

**Color Palette:**
- Primary: Default theme primary
- A-side: Blue (#3B82F6)
- B-side: Purple (#A855F7)
- Success: Green (#22C55E)
- Warning: Orange (#F97316)
- Error: Red (#EF4444)

**Typography:**
- Inter font family
- Mono font for IDs and metrics
- Clear hierarchy with semantic sizes

**Interactions:**
- Fast keyboard-first workflow
- Smooth transitions (150-200ms)
- Hover states with subtle scale/color changes
- Focus states for accessibility

## Mobile Responsiveness

**Breakpoints:**
- Desktop (≥1024px): Side-by-side trajectories, sidebar
- Tablet (768-1023px): Stacked trajectories, sidebar
- Mobile (<768px): Fully stacked layout

**Mobile Optimizations:**
- Touch-friendly button sizes (44px min)
- Simplified navigation
- Collapsible sections
- Swipe gestures for trajectory scrolling

## Performance Considerations

1. **React Query caching**: 1-minute stale time
2. **Auto-refresh**: Queue refreshes every 30 seconds
3. **Optimistic updates**: Form resets immediately
4. **Lazy loading**: Components load on demand
5. **Synchronized scrolling**: Debounced with 50ms timeout

## Database Schema Requirements

The following tables are expected:

### comparison_feedback
```sql
CREATE TABLE comparison_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id VARCHAR NOT NULL,
  trajectory_a_id UUID REFERENCES trajectories(id),
  trajectory_b_id UUID REFERENCES trajectories(id),
  task_success_a BOOLEAN NOT NULL,
  task_success_b BOOLEAN NOT NULL,
  efficiency_a INTEGER CHECK (efficiency_a BETWEEN 1 AND 5),
  efficiency_b INTEGER CHECK (efficiency_b BETWEEN 1 AND 5),
  preference VARCHAR CHECK (preference IN ('A', 'B', 'tie')),
  comment TEXT,
  skip_reason TEXT,
  reviewed_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);
```

## Usage

1. Navigate to `/reviews`
2. View current comparison in main area
3. Review both trajectories (scroll syncs automatically)
4. Mark task success for each side (A/B keys)
5. Rate efficiency with sliders (1-5)
6. Select overall preference (1/2/3 keys)
7. Add optional comments
8. Submit with `Ctrl+Enter` or click button
9. Press `?` anytime to view all shortcuts

## Future Enhancements

- [ ] Diff highlighting between trajectories
- [ ] Side-by-side step comparison
- [ ] Annotation tools for specific steps
- [ ] Bulk review mode
- [ ] Reviewer calibration system
- [ ] Real-time collaboration
- [ ] Review history and replay
- [ ] Export feedback as CSV
- [ ] Advanced filtering and sorting
- [ ] Custom keyboard shortcut configuration

## Testing Checklist

- [ ] Keyboard shortcuts work correctly
- [ ] Synchronized scrolling is smooth
- [ ] Form validation prevents invalid submissions
- [ ] Skip menu displays and closes properly
- [ ] Stats update after submission
- [ ] Queue advances to next comparison
- [ ] Empty state displays when queue is empty
- [ ] Mobile layout is usable
- [ ] Loading states display properly
- [ ] Error states are handled gracefully

## File Summary

**Created/Updated Files:**
- `src/components/ComparisonInterface.tsx` - Main comparison UI
- `src/components/ReviewQueue.tsx` - Queue sidebar
- `src/components/ReviewStats.tsx` - Statistics card
- `src/components/KeyboardShortcutOverlay.tsx` - Shortcut help
- `src/components/ui/scroll-area.tsx` - Scroll container
- `src/components/providers/QueryProvider.tsx` - React Query provider
- `src/hooks/useSyncScroll.ts` - Synchronized scrolling
- `src/hooks/useReviewQueue.ts` - Queue management
- `src/app/reviews/page.tsx` - Reviews page
- `src/app/api/reviews/route.ts` - Feedback endpoint
- `src/app/api/reviews/queue/route.ts` - Queue endpoint
- `src/app/api/reviews/stats/route.ts` - Statistics endpoint
- `src/app/api/reviews/skip/route.ts` - Skip endpoint
- `src/app/layout.tsx` - Added QueryProvider
- `src/types/index.ts` - Updated types
