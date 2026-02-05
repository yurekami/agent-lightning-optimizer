'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SystemMetrics } from '@/components/admin/SystemMetrics'
import { ReviewerActivity } from '@/components/admin/ReviewerActivity'
import { FitnessTrends } from '@/components/admin/FitnessTrends'
import { InterRaterReliability } from '@/components/admin/InterRaterReliability'
import { QueueHealth } from '@/components/admin/QueueHealth'
import { AgentOverview } from '@/components/admin/AgentOverview'
import { useExportData } from '@/hooks/useAdminMetrics'
import { TimeRange } from '@/types'
import { RefreshCw, Download, Clock } from 'lucide-react'

export default function AdminPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const exportData = useExportData()

  const timeRanges: { label: string; value: TimeRange }[] = [
    { label: '24h', value: '24h' },
    { label: '7d', value: '7d' },
    { label: '30d', value: '30d' },
    { label: '90d', value: '90d' },
    { label: 'All', value: 'all' },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground">
            System metrics, reviewer activity, and prompt fitness trends
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant={autoRefresh ? 'default' : 'outline'}
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`}
            />
            Auto-refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportData.mutate('csv')}
            disabled={exportData.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportData.mutate('json')}
            disabled={exportData.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Time range:</span>
        {timeRanges.map((range) => (
          <Button
            key={range.value}
            variant={timeRange === range.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange(range.value)}
          >
            {range.label}
          </Button>
        ))}
      </div>

      {/* System Metrics */}
      <SystemMetrics timeRange={timeRange} />

      {/* Agent Overview */}
      <AgentOverview />

      {/* Two Column Layout */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Queue Health */}
        <QueueHealth />

        {/* Inter-Rater Reliability */}
        <InterRaterReliability />
      </div>

      {/* Fitness Trends - Full Width */}
      <FitnessTrends timeRange={timeRange} />

      {/* Reviewer Activity - Full Width */}
      <ReviewerActivity />

      {/* Footer */}
      <div className="flex items-center justify-between pt-6 border-t">
        <div className="flex items-center gap-4">
          <Badge variant="outline">
            Dashboard v0.1.0
          </Badge>
          <span className="text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/admin/reviewers'}
          >
            Manage Reviewers
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/admin/agents'}
          >
            Manage Agents
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/admin/deployments'}
          >
            View Deployments
          </Button>
        </div>
      </div>
    </div>
  )
}
