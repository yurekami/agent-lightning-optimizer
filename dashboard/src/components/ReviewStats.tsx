'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ReviewStats as ReviewStatsType } from '@/types'
import { Trophy, Target, TrendingUp, Clock, Flame, Award } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReviewStatsProps {
  stats: ReviewStatsType
  className?: string
}

export function ReviewStats({ stats, className }: ReviewStatsProps) {
  const formatTime = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  return (
    <Card className={cn('border-2', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Your Performance
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatItem
            icon={<Target className="h-4 w-4 text-blue-500" />}
            label="Total Reviews"
            value={stats.totalReviews}
            highlight={stats.totalReviews > 0}
          />
          <StatItem
            icon={<TrendingUp className="h-4 w-4 text-green-500" />}
            label="Today"
            value={stats.reviewsToday}
            badge={stats.reviewsToday > 5 ? 'On fire!' : undefined}
          />
          <StatItem
            icon={<TrendingUp className="h-4 w-4 text-purple-500" />}
            label="This Week"
            value={stats.reviewsThisWeek}
          />
          <StatItem
            icon={<Award className="h-4 w-4 text-orange-500" />}
            label="Agreement"
            value={`${Math.round(stats.agreementRate * 100)}%`}
            tooltip="How often you agree with other reviewers"
          />
          <StatItem
            icon={<Flame className="h-4 w-4 text-red-500" />}
            label="Streak"
            value={stats.currentStreak}
            badge={stats.currentStreak > 0 ? `${stats.currentStreak} days` : undefined}
            highlight={stats.currentStreak >= 7}
          />
          <StatItem
            icon={<Clock className="h-4 w-4 text-cyan-500" />}
            label="Avg Time"
            value={formatTime(stats.avgReviewTime)}
          />
        </div>

        {stats.leaderboardPosition > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Leaderboard Position</span>
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                <span className="font-bold text-lg">#{stats.leaderboardPosition}</span>
              </div>
            </div>
          </div>
        )}

        {stats.currentStreak >= 7 && (
          <div className="mt-3 p-3 bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-md">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-500 animate-pulse" />
              <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
                {stats.currentStreak}-day streak! Keep it up!
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface StatItemProps {
  icon: React.ReactNode
  label: string
  value: string | number
  badge?: string
  tooltip?: string
  highlight?: boolean
}

function StatItem({ icon, label, value, badge, tooltip, highlight }: StatItemProps) {
  return (
    <div
      className={cn(
        'space-y-1 p-3 rounded-md transition-all',
        highlight && 'bg-primary/5 border border-primary/20'
      )}
      title={tooltip}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={cn('text-2xl font-bold font-mono', highlight && 'text-primary')}>
          {value}
        </span>
        {badge && (
          <Badge variant="secondary" className="text-xs">
            {badge}
          </Badge>
        )}
      </div>
    </div>
  )
}
