'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useQueueHealth } from '@/hooks/useAdminMetrics'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { format } from 'date-fns'
import { Clock, AlertTriangle, TrendingUp, CheckCircle } from 'lucide-react'

export function QueueHealth() {
  const { data: queueHealth, isLoading } = useQueueHealth()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Queue Health</CardTitle>
          <CardDescription>Loading queue metrics...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    )
  }

  if (!queueHealth) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Queue Health</CardTitle>
          <CardDescription>No queue data available</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const chartData = queueHealth.trends.map((t) => ({
    date: format(t.date, 'MMM d'),
    comparisons: t.comparisons,
  }))

  const avgWaitTimeMinutes = Math.round(queueHealth.avgWaitTime / 60)
  const avgWaitTimeHours = (queueHealth.avgWaitTime / 3600).toFixed(1)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Queue Health</CardTitle>
            <CardDescription>Review queue monitoring</CardDescription>
          </div>
          {queueHealth.backlogAlert && (
            <Badge variant="destructive" className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Backlog Alert
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Current Queue Depth
                </h3>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold">{queueHealth.currentDepth}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {queueHealth.backlogAlert
                  ? 'Above normal levels'
                  : 'Within normal range'}
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Average Wait Time
                </h3>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold">
                {avgWaitTimeMinutes < 60
                  ? `${avgWaitTimeMinutes}m`
                  : `${avgWaitTimeHours}h`}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Time from creation to first review
              </p>
            </div>

            <div className="p-4 border rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Daily Comparisons
                </h3>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="text-3xl font-bold">
                {Math.round(queueHealth.comparisonsPerDay)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Average reviews per day
              </p>
            </div>
          </div>

          {/* Comparisons Chart */}
          {chartData.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">Comparisons Over Time</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis
                    dataKey="date"
                    className="text-xs"
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis
                    className="text-xs"
                    stroke="hsl(var(--muted-foreground))"
                    label={{ value: 'Reviews', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="comparisons"
                    fill="hsl(var(--primary))"
                    name="Comparisons"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Health Status */}
          <div className="p-4 border rounded-lg">
            <h3 className="text-sm font-medium mb-2">Health Assessment</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Queue Status</span>
                <Badge
                  variant={queueHealth.backlogAlert ? 'destructive' : 'default'}
                >
                  {queueHealth.backlogAlert ? 'Backlogged' : 'Healthy'}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Processing Rate</span>
                <span className="font-medium">
                  {queueHealth.comparisonsPerDay > queueHealth.currentDepth
                    ? 'Above demand'
                    : 'Below demand'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Estimated Clear Time</span>
                <span className="font-medium">
                  {queueHealth.comparisonsPerDay > 0
                    ? `${Math.ceil(queueHealth.currentDepth / queueHealth.comparisonsPerDay)} days`
                    : 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {queueHealth.backlogAlert && (
            <div className="p-4 border border-orange-500/50 rounded-lg bg-orange-500/10">
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                Action Recommended
              </h3>
              <p className="text-sm text-muted-foreground">
                Queue depth is {queueHealth.currentDepth} comparisons, which is{' '}
                {Math.round(queueHealth.currentDepth / queueHealth.comparisonsPerDay)}x
                the daily processing rate.
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
                <li>Send reminder to inactive reviewers</li>
                <li>Consider adding more reviewers</li>
                <li>Temporarily pause new trajectory collection</li>
                <li>Prioritize critical comparisons</li>
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
