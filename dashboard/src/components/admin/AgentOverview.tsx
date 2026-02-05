'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAgentSummaries } from '@/hooks/useAdminMetrics'
import { formatDistanceToNow } from 'date-fns'
import { TrendingUp, TrendingDown, Minus, GitBranch, Activity, Calendar } from 'lucide-react'

export function AgentOverview() {
  const { data: agents, isLoading } = useAgentSummaries()

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent Overview</CardTitle>
          <CardDescription>Loading agent summaries...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!agents || agents.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent Overview</CardTitle>
          <CardDescription>No agents found</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Agent Overview</CardTitle>
            <CardDescription>
              {agents.length} agent{agents.length !== 1 ? 's' : ''} configured
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = '/admin/agents'}
          >
            Manage Agents
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {agents.map((agent) => {
            const TrendIcon =
              agent.fitnessTrend === 'up'
                ? TrendingUp
                : agent.fitnessTrend === 'down'
                ? TrendingDown
                : Minus

            const trendColor =
              agent.fitnessTrend === 'up'
                ? 'text-green-500'
                : agent.fitnessTrend === 'down'
                ? 'text-red-500'
                : 'text-muted-foreground'

            return (
              <Card key={agent.name} className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                      <CardDescription className="mt-1">
                        Production: {agent.productionVersion}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="ml-2">
                      {agent.populationSize} prompts
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Fitness Score */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Fitness Score</span>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold">
                        {agent.fitnessScore.toFixed(3)}
                      </span>
                      <TrendIcon className={`h-4 w-4 ${trendColor}`} />
                    </div>
                  </div>

                  {/* Trajectory Count */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Activity className="h-3 w-3" />
                      Trajectories
                    </span>
                    <span className="font-medium">
                      {agent.trajectoryCount.toLocaleString()}
                    </span>
                  </div>

                  {/* Active Branches */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <GitBranch className="h-3 w-3" />
                      Active Branches
                    </span>
                    <span className="font-medium">{agent.activeBranches}</span>
                  </div>

                  {/* Last Deployment */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Last Deployed
                    </span>
                    <span className="text-sm font-medium">
                      {agent.lastDeployment
                        ? formatDistanceToNow(agent.lastDeployment, {
                            addSuffix: true,
                          })
                        : 'Never'}
                    </span>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        window.location.href = `/prompts?agent=${agent.name}`
                      }
                    >
                      View Prompts
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        window.location.href = `/admin/agents/${agent.name}`
                      }
                    >
                      Details
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
