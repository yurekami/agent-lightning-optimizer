'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trajectory, ComparisonFeedback } from '@/types'
import { TrajectoryViewer } from './TrajectoryViewer'
import { useSyncScroll } from '@/hooks/useSyncScroll'
import { cn } from '@/lib/utils'
import {
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
  SkipForward,
  Send,
  Sparkles,
} from 'lucide-react'

interface ComparisonInterfaceProps {
  trajectoryA: Trajectory
  trajectoryB: Trajectory
  onSubmit: (feedback: Omit<ComparisonFeedback, 'id' | 'reviewed_at' | 'metadata' | 'reviewer_id'>) => void
  onSkip: (reason: string) => void
  isSubmitting?: boolean
}

export function ComparisonInterface({
  trajectoryA,
  trajectoryB,
  onSubmit,
  onSkip,
  isSubmitting = false,
}: ComparisonInterfaceProps) {
  const { ref1, ref2 } = useSyncScroll({ enabled: true })

  // State
  const [taskSuccessA, setTaskSuccessA] = useState(false)
  const [taskSuccessB, setTaskSuccessB] = useState(false)
  const [efficiencyA, setEfficiencyA] = useState(3)
  const [efficiencyB, setEfficiencyB] = useState(3)
  const [preference, setPreference] = useState<'A' | 'B' | 'tie' | null>(null)
  const [comment, setComment] = useState('')
  const [showSkipMenu, setShowSkipMenu] = useState(false)

  const skipReasons = [
    'Both trajectories are identical',
    'Insufficient information to compare',
    'Task is unclear',
    'Data quality issues',
    'Other',
  ]

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Allow arrow keys in comment textarea
        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          handleSubmit()
        }
        return
      }

      switch (event.key) {
        case '1':
          event.preventDefault()
          setPreference('A')
          break
        case '2':
          event.preventDefault()
          setPreference('B')
          break
        case '3':
          event.preventDefault()
          setPreference('tie')
          break
        case 'a':
        case 'A':
          event.preventDefault()
          setTaskSuccessA((prev) => !prev)
          break
        case 'b':
        case 'B':
          event.preventDefault()
          setTaskSuccessB((prev) => !prev)
          break
        case 's':
        case 'S':
          event.preventDefault()
          setShowSkipMenu(true)
          break
        case 'Escape':
          event.preventDefault()
          setShowSkipMenu(false)
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSubmit = useCallback(() => {
    if (!preference) return

    onSubmit({
      trajectory_a_id: trajectoryA.id,
      trajectory_b_id: trajectoryB.id,
      task_success_a: taskSuccessA,
      task_success_b: taskSuccessB,
      efficiency_a: efficiencyA,
      efficiency_b: efficiencyB,
      preference,
      comment,
      skip_reason: undefined,
    })

    // Reset form
    setTaskSuccessA(false)
    setTaskSuccessB(false)
    setEfficiencyA(3)
    setEfficiencyB(3)
    setPreference(null)
    setComment('')
  }, [preference, trajectoryA.id, trajectoryB.id, taskSuccessA, taskSuccessB, efficiencyA, efficiencyB, comment, onSubmit])

  const handleSkip = (reason: string) => {
    onSkip(reason)
    setShowSkipMenu(false)
    // Reset form
    setTaskSuccessA(false)
    setTaskSuccessB(false)
    setEfficiencyA(3)
    setEfficiencyB(3)
    setPreference(null)
    setComment('')
  }

  const canSubmit = preference !== null && !isSubmitting

  return (
    <div className="space-y-6">
      {/* Side-by-side comparison */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Trajectory A */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-500 hover:bg-blue-600 text-white font-bold">A</Badge>
              <h3 className="text-lg font-semibold">Version {trajectoryA.prompt_version_id}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTaskSuccessA(!taskSuccessA)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                  taskSuccessA
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {taskSuccessA ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {taskSuccessA ? 'Success' : 'Failed'}
              </button>
            </div>
          </div>
          <div ref={ref1} className="h-[600px] overflow-auto border border-blue-500/30 rounded-lg">
            <TrajectoryViewer trajectory={trajectoryA} />
          </div>
        </div>

        {/* Trajectory B */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge className="bg-purple-500 hover:bg-purple-600 text-white font-bold">B</Badge>
              <h3 className="text-lg font-semibold">Version {trajectoryB.prompt_version_id}</h3>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setTaskSuccessB(!taskSuccessB)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all',
                  taskSuccessB
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                )}
              >
                {taskSuccessB ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {taskSuccessB ? 'Success' : 'Failed'}
              </button>
            </div>
          </div>
          <div ref={ref2} className="h-[600px] overflow-auto border border-purple-500/30 rounded-lg">
            <TrajectoryViewer trajectory={trajectoryB} />
          </div>
        </div>
      </div>

      {/* Rating Panel */}
      <Card className="border-2 border-primary/20">
        <CardHeader className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Your Evaluation
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Efficiency Ratings */}
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-500/10 border-blue-500/30">A</Badge>
                  Efficiency Rating
                </span>
                <span className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400">
                  {efficiencyA}/5
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={efficiencyA}
                  onChange={(e) => setEfficiencyA(Number(e.target.value))}
                  className="flex-1 h-2 bg-blue-200 dark:bg-blue-900 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground font-mono">
                <span>Very Poor</span>
                <span>Excellent</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-purple-500/10 border-purple-500/30">B</Badge>
                  Efficiency Rating
                </span>
                <span className="text-lg font-bold font-mono text-purple-600 dark:text-purple-400">
                  {efficiencyB}/5
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={efficiencyB}
                  onChange={(e) => setEfficiencyB(Number(e.target.value))}
                  className="flex-1 h-2 bg-purple-200 dark:bg-purple-900 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground font-mono">
                <span>Very Poor</span>
                <span>Excellent</span>
              </div>
            </div>
          </div>

          {/* Preference Selection */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Overall Preference</label>
            <div className="flex gap-3">
              <Button
                variant={preference === 'A' ? 'default' : 'outline'}
                onClick={() => setPreference('A')}
                className={cn(
                  'flex-1 h-auto py-4 text-base transition-all',
                  preference === 'A' && 'bg-blue-600 hover:bg-blue-700 border-blue-600'
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  <Badge className="bg-blue-500 text-white">A</Badge>
                  <span>A is Better</span>
                </div>
              </Button>
              <Button
                variant={preference === 'tie' ? 'default' : 'outline'}
                onClick={() => setPreference('tie')}
                className={cn(
                  'flex-1 h-auto py-4 text-base transition-all',
                  preference === 'tie' && 'bg-gray-600 hover:bg-gray-700'
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  <Badge variant="secondary">≈</Badge>
                  <span>Tie</span>
                </div>
              </Button>
              <Button
                variant={preference === 'B' ? 'default' : 'outline'}
                onClick={() => setPreference('B')}
                className={cn(
                  'flex-1 h-auto py-4 text-base transition-all',
                  preference === 'B' && 'bg-purple-600 hover:bg-purple-700 border-purple-600'
                )}
              >
                <div className="flex flex-col items-center gap-2">
                  <Badge className="bg-purple-500 text-white">B</Badge>
                  <span>B is Better</span>
                </div>
              </Button>
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Comments (Optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Explain your reasoning, highlight key differences, or note any concerns..."
              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              rows={4}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 h-12 text-base font-semibold bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              <Send className="mr-2 h-5 w-5" />
              Submit Review
              <kbd className="ml-2 px-2 py-1 bg-white/20 rounded text-xs">Ctrl+Enter</kbd>
            </Button>
            <Button
              onClick={() => setShowSkipMenu(true)}
              variant="outline"
              className="h-12 px-6"
            >
              <SkipForward className="mr-2 h-5 w-5" />
              Skip
              <kbd className="ml-2 px-2 py-1 bg-muted rounded text-xs">S</kbd>
            </Button>
          </div>

          {/* Keyboard hints */}
          <div className="pt-4 border-t">
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-muted border border-border rounded font-mono">1/2/3</kbd>
                <span>Select preference</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-muted border border-border rounded font-mono">A/B</kbd>
                <span>Toggle success</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-muted border border-border rounded font-mono">?</kbd>
                <span>Show all shortcuts</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Skip Menu Modal */}
      {showSkipMenu && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="border-b">
              <CardTitle>Skip Comparison</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              <p className="text-sm text-muted-foreground mb-4">
                Please select a reason for skipping this comparison:
              </p>
              {skipReasons.map((reason) => (
                <button
                  key={reason}
                  onClick={() => handleSkip(reason)}
                  className="w-full p-3 text-left text-sm rounded-md border border-border hover:bg-muted transition-colors"
                >
                  {reason}
                </button>
              ))}
              <Button
                variant="outline"
                onClick={() => setShowSkipMenu(false)}
                className="w-full mt-4"
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
