'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useFitnessTrends, useAgentSummaries } from '@/hooks/useAdminMetrics'
import { TimeRange } from '@/types'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { format } from 'date-fns'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface FitnessTrendsProps {
  timeRange: TimeRange
}

export function FitnessTrends({ timeRange }: FitnessTrendsProps) {
  const { data: agents } = useAgentSummaries()
  const [selectedAgent, setSelectedAgent] = useState<string>('')

  // Select first agent by default
  const agentName = selectedAgent || agents?.[0]?.name || ''

  const { data: trends, isLoading } = useFitnessTrends(agentName, timeRange)

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fitness Trends</CardTitle>
          <CardDescription>Loading trend data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    )
  }

  if (!trends || trends.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Fitness Trends</CardTitle>
          <CardDescription>No trend data available</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Calculate overall trend
  const firstFitness = trends[0]?.fitness || 0
  const lastFitness = trends[trends.length - 1]?.fitness || 0
  const trendDirection =
    lastFitness > firstFitness * 1.05
      ? 'up'
      : lastFitness < firstFitness * 0.95
      ? 'down'
      : 'stable'

  const trendPercent = firstFitness > 0
    ? (((lastFitness - firstFitness) / firstFitness) * 100).toFixed(1)
    : '0.0'

  const chartData = trends.map((t) => ({
    date: format(t.date, 'MMM d'),
    fitness: t.fitness,
    winRate: t.winRate * 100,
    successRate: t.successRate * 100,
    efficiency: t.efficiency * 100,
  }))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Fitness Trends</CardTitle>
            <CardDescription>
              Prompt improvement over time for {agentName}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {trendDirection === 'up' && (
              <div className="flex items-center gap-1 text-green-500">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm font-medium">+{trendPercent}%</span>
              </div>
            )}
            {trendDirection === 'down' && (
              <div className="flex items-center gap-1 text-red-500">
                <TrendingDown className="h-4 w-4" />
                <span className="text-sm font-medium">{trendPercent}%</span>
              </div>
            )}
            {trendDirection === 'stable' && (
              <div className="flex items-center gap-1 text-muted-foreground">
                <Minus className="h-4 w-4" />
                <span className="text-sm font-medium">Stable</span>
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {agents && agents.length > 1 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {agents.map((agent) => (
              <Button
                key={agent.name}
                variant={agentName === agent.name ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedAgent(agent.name)}
              >
                {agent.name}
              </Button>
            ))}
          </div>
        )}

        <div className="space-y-6">
          {/* Fitness Score */}
          <div>
            <h3 className="text-sm font-medium mb-3">Fitness Score</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorFitness" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis className="text-xs" stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="fitness"
                  stroke="hsl(var(--primary))"
                  fill="url(#colorFitness)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Win Rate, Success Rate, Efficiency */}
          <div>
            <h3 className="text-sm font-medium mb-3">Performance Metrics</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  stroke="hsl(var(--muted-foreground))"
                />
                <YAxis
                  className="text-xs"
                  stroke="hsl(var(--muted-foreground))"
                  label={{ value: '%', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                  }}
                  formatter={(value: number) => `${value.toFixed(1)}%`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="winRate"
                  stroke="hsl(142 76% 36%)"
                  strokeWidth={2}
                  dot={false}
                  name="Win Rate"
                />
                <Line
                  type="monotone"
                  dataKey="successRate"
                  stroke="hsl(221 83% 53%)"
                  strokeWidth={2}
                  dot={false}
                  name="Success Rate"
                />
                <Line
                  type="monotone"
                  dataKey="efficiency"
                  stroke="hsl(280 83% 53%)"
                  strokeWidth={2}
                  dot={false}
                  name="Efficiency"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
