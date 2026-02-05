'use client'

import { ComparisonInterface } from '@/components/ComparisonInterface'
import { ReviewQueue } from '@/components/ReviewQueue'
import { ReviewStats } from '@/components/ReviewStats'
import { KeyboardShortcutOverlay } from '@/components/KeyboardShortcutOverlay'
import { useReviewQueue } from '@/hooks/useReviewQueue'
import { Card, CardContent } from '@/components/ui/card'
import { ClipboardList, Sparkles } from 'lucide-react'

export default function ReviewsPage() {
  const { queue, current, stats, isLoading, submit, skip, isSubmitting } = useReviewQueue()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Loading review queue...</p>
        </div>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reviews</h1>
            <p className="text-muted-foreground">
              Compare trajectory pairs and provide feedback
            </p>
          </div>
        </div>

        <ReviewStats stats={stats} />

        <Card>
          <CardContent className="py-12">
            <div className="flex flex-col items-center justify-center text-center">
              <ClipboardList className="h-16 w-16 text-muted-foreground/50 mb-4" />
              <h3 className="text-xl font-semibold mb-2">All caught up!</h3>
              <p className="text-muted-foreground max-w-md">
                No trajectory pairs are waiting for review at the moment.
                <br />
                Start by tracing agent sessions with the lightning:trace command.
              </p>
            </div>
          </CardContent>
        </Card>

        <KeyboardShortcutOverlay />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            Trajectory Comparison
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and compare agent performance to improve prompt quality
          </p>
        </div>
      </div>

      {/* Stats */}
      <ReviewStats stats={stats} />

      {/* Main Layout */}
      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Sidebar - Queue */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <ReviewQueue
            queue={queue}
            currentId={current.id}
            onSelect={(item) => {
              // TODO: Navigate to specific comparison
              console.log('Selected:', item)
            }}
          />
        </div>

        {/* Main Content - Comparison Interface */}
        <div>
          <ComparisonInterface
            trajectoryA={current.trajectoryA}
            trajectoryB={current.trajectoryB}
            onSubmit={submit}
            onSkip={skip}
            isSubmitting={isSubmitting}
          />
        </div>
      </div>

      {/* Keyboard Shortcuts Overlay */}
      <KeyboardShortcutOverlay />
    </div>
  )
}
