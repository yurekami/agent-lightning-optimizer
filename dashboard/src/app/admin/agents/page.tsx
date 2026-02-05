'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAgentSummaries } from '@/hooks/useAdminMetrics'
import { formatDistanceToNow } from 'date-fns'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  GitBranch,
  Activity,
  Calendar,
  Settings,
  Eye,
  ArrowLeft,
  Plus,
} from 'lucide-react'

export default function AgentsPage() {
  const { data: agents, isLoading } = useAgentSummaries()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-12 bg-muted animate-pulse rounded" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.location.href = '/admin'}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Agent Management</h1>
            <p className="text-muted-foreground">
              Configure and monitor AI agents
            </p>
          </div>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Agent
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{agents?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Trajectories</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agents
                ?.reduce((sum, a) => sum + a.trajectoryCount, 0)
                .toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Prompts</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agents?.reduce((sum, a) => sum + a.populationSize, 0) || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Branches</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {agents?.reduce((sum, a) => sum + a.activeBranches, 0) || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Agent Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {agents?.map((agent) => {
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
            <Card key={agent.name} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl">{agent.name}</CardTitle>
                    <CardDescription className="mt-1">
                      Production: {agent.productionVersion}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="ml-2">
                    {agent.populationSize} prompts
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Fitness Score */}
                <div className="p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Fitness Score
                    </span>
                    <TrendIcon className={`h-4 w-4 ${trendColor}`} />
                  </div>
                  <div className="text-3xl font-bold mt-1">
                    {agent.fitnessScore.toFixed(3)}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge
                      variant={
                        agent.fitnessTrend === 'up'
                          ? 'default'
                          : agent.fitnessTrend === 'down'
                          ? 'destructive'
                          : 'secondary'
                      }
                    >
                      {agent.fitnessTrend === 'up'
                        ? 'Improving'
                        : agent.fitnessTrend === 'down'
                        ? 'Declining'
                        : 'Stable'}
                    </Badge>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <Activity className="h-3 w-3" />
                      Trajectories
                    </div>
                    <div className="text-xl font-bold">
                      {agent.trajectoryCount.toLocaleString()}
                    </div>
                  </div>

                  <div className="p-3 border rounded-lg">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                      <GitBranch className="h-3 w-3" />
                      Branches
                    </div>
                    <div className="text-xl font-bold">{agent.activeBranches}</div>
                  </div>
                </div>

                {/* Last Deployment */}
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    Last Deployed
                  </div>
                  <div className="text-sm font-medium">
                    {agent.lastDeployment
                      ? formatDistanceToNow(agent.lastDeployment, {
                          addSuffix: true,
                        })
                      : 'Never'}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() =>
                      window.location.href = `/prompts?agent=${agent.name}`
                    }
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Prompts
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      window.location.href = `/admin/agents/${agent.name}`
                    }
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Empty State */}
      {(!agents || agents.length === 0) && (
        <Card>
          <CardHeader>
            <CardTitle>No Agents Found</CardTitle>
            <CardDescription>
              Get started by creating your first agent
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Agent
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
