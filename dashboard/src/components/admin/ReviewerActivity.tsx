'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useReviewerStats } from '@/hooks/useAdminMetrics'
import { formatDistanceToNow } from 'date-fns'
import { User, TrendingUp, Clock, Flame, Filter } from 'lucide-react'

type FilterType = 'all' | 'admin' | 'reviewer' | 'active' | 'inactive'

export function ReviewerActivity() {
  const { data: reviewers, isLoading } = useReviewerStats()
  const [filter, setFilter] = useState<FilterType>('all')
  const [sortBy, setSortBy] = useState<'reviews' | 'agreement' | 'streak'>('reviews')

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reviewer Activity</CardTitle>
          <CardDescription>Loading reviewer statistics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!reviewers || reviewers.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Reviewer Activity</CardTitle>
          <CardDescription>No reviewers found</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Apply filters
  let filtered = [...reviewers]
  if (filter === 'admin') {
    filtered = filtered.filter((r) => r.role === 'admin')
  } else if (filter === 'reviewer') {
    filtered = filtered.filter((r) => r.role === 'reviewer')
  } else if (filter === 'active') {
    filtered = filtered.filter(
      (r) => r.lastActive && Date.now() - r.lastActive.getTime() < 7 * 24 * 60 * 60 * 1000
    )
  } else if (filter === 'inactive') {
    filtered = filtered.filter(
      (r) => !r.lastActive || Date.now() - r.lastActive.getTime() >= 7 * 24 * 60 * 60 * 1000
    )
  }

  // Sort
  if (sortBy === 'reviews') {
    filtered.sort((a, b) => b.reviewCount - a.reviewCount)
  } else if (sortBy === 'agreement') {
    filtered.sort((a, b) => b.agreementRate - a.agreementRate)
  } else if (sortBy === 'streak') {
    filtered.sort((a, b) => b.streak - a.streak)
  }

  const filters: { label: string; value: FilterType }[] = [
    { label: 'All', value: 'all' },
    { label: 'Admins', value: 'admin' },
    { label: 'Reviewers', value: 'reviewer' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
  ]

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Reviewer Activity</CardTitle>
            <CardDescription>
              {filtered.length} reviewer{filtered.length !== 1 ? 's' : ''}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.href = '/admin/reviewers'}
            >
              View All
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-4">
          <Filter className="h-4 w-4 text-muted-foreground self-center" />
          {filters.map((f) => (
            <Button
              key={f.value}
              variant={filter === f.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        <div className="flex gap-2 mb-4">
          <span className="text-sm text-muted-foreground self-center">Sort by:</span>
          <Button
            variant={sortBy === 'reviews' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSortBy('reviews')}
          >
            Reviews
          </Button>
          <Button
            variant={sortBy === 'agreement' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSortBy('agreement')}
          >
            Agreement
          </Button>
          <Button
            variant={sortBy === 'streak' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setSortBy('streak')}
          >
            Streak
          </Button>
        </div>

        <div className="space-y-3">
          {filtered.map((reviewer) => (
            <div
              key={reviewer.id}
              className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{reviewer.name}</h3>
                    <Badge variant={reviewer.role === 'admin' ? 'default' : 'secondary'}>
                      {reviewer.role}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{reviewer.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-2xl font-bold">{reviewer.reviewCount}</div>
                  <div className="text-xs text-muted-foreground">reviews</div>
                </div>

                <div className="text-center">
                  <div className="text-2xl font-bold flex items-center gap-1">
                    {(reviewer.agreementRate * 100).toFixed(0)}%
                    <TrendingUp className="h-4 w-4 text-green-500" />
                  </div>
                  <div className="text-xs text-muted-foreground">agreement</div>
                </div>

                {reviewer.streak > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold flex items-center gap-1">
                      {reviewer.streak}
                      <Flame className="h-4 w-4 text-orange-500" />
                    </div>
                    <div className="text-xs text-muted-foreground">day streak</div>
                  </div>
                )}

                <div className="text-right min-w-[120px]">
                  {reviewer.lastActive ? (
                    <>
                      <div className="text-sm font-medium">
                        {formatDistanceToNow(reviewer.lastActive, { addSuffix: true })}
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3" />
                        {Math.round(reviewer.avgReviewTime / 60)}s avg
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">Never active</div>
                  )}
                </div>

                <div className="flex gap-1">
                  <div className="text-xs">
                    <Badge variant="outline" className="text-xs">
                      A: {reviewer.preferences.A}
                    </Badge>
                  </div>
                  <div className="text-xs">
                    <Badge variant="outline" className="text-xs">
                      B: {reviewer.preferences.B}
                    </Badge>
                  </div>
                  <div className="text-xs">
                    <Badge variant="outline" className="text-xs">
                      Tie: {reviewer.preferences.tie}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
