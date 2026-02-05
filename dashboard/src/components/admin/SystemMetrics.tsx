'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useSystemMetrics } from '@/hooks/useAdminMetrics'
import { TimeRange } from '@/types'
import { Activity, TrendingUp, Users, Cpu, GitBranch, Zap } from 'lucide-react'

interface SystemMetricsProps {
  timeRange: TimeRange
}

export function SystemMetrics({ timeRange }: SystemMetricsProps) {
  const { data: metrics, isLoading } = useSystemMetrics(timeRange)

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  if (!metrics) return null

  const metricCards = [
    {
      title: 'Trajectories',
      icon: Activity,
      value: metrics.trajectories.total.toLocaleString(),
      change: `+${metrics.trajectories.today} today`,
      description: `${metrics.trajectories.week} this week`,
    },
    {
      title: 'Reviews',
      icon: Users,
      value: metrics.reviews.total.toLocaleString(),
      change: `+${metrics.reviews.today} today`,
      description: `${metrics.reviews.week} this week`,
    },
    {
      title: 'Active Agents',
      icon: Cpu,
      value: metrics.agents.toString(),
      change: metrics.activeAgents.join(', '),
      description: 'Agents in production',
    },
    {
      title: 'Generations',
      icon: TrendingUp,
      value: metrics.generations.toString(),
      change: 'Evolution rounds',
      description: 'APO training cycles',
    },
    {
      title: 'Mutations',
      icon: GitBranch,
      value: metrics.mutations.toLocaleString(),
      change: 'Prompt variations',
      description: 'Created from base versions',
    },
    {
      title: 'Population',
      icon: Zap,
      value: Object.values(metrics.populationSizes)
        .reduce((sum, count) => sum + count, 0)
        .toString(),
      change: 'Total active prompts',
      description: Object.entries(metrics.populationSizes)
        .map(([agent, count]) => `${agent}: ${count}`)
        .join(', '),
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {metricCards.map((metric) => {
        const Icon = metric.icon
        return (
          <Card key={metric.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metric.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {metric.change}
              </p>
              {metric.description && (
                <p className="text-xs text-muted-foreground/70 mt-1 truncate">
                  {metric.description}
                </p>
              )}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
