import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Activity, CheckCircle, Clock, TrendingUp } from 'lucide-react'

export default function HomePage() {
  const stats = [
    {
      title: 'Active Trajectories',
      value: '0',
      description: 'Currently running',
      icon: Activity,
      trend: '+0%',
    },
    {
      title: 'Reviews Completed',
      value: '0',
      description: 'This week',
      icon: CheckCircle,
      trend: '+0%',
    },
    {
      title: 'Avg Response Time',
      value: '0s',
      description: 'Across all agents',
      icon: Clock,
      trend: '-0%',
    },
    {
      title: 'Model Performance',
      value: '0%',
      description: 'Success rate',
      icon: TrendingUp,
      trend: '+0%',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to Agent Lightning Prompt Optimizer
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
                <div className="mt-2 text-xs text-primary">{stat.trend}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Trajectories</CardTitle>
            <CardDescription>
              Latest agent execution traces
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                No trajectories yet
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Reviews</CardTitle>
            <CardDescription>
              Comparisons waiting for your feedback
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                No pending reviews
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
          <CardDescription>
            Get started with Agent Lightning
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              1. Start tracing agent sessions with <code className="rounded bg-muted px-1 py-0.5">lightning:trace</code>
            </p>
            <p className="text-muted-foreground">
              2. Emit rewards during execution with <code className="rounded bg-muted px-1 py-0.5">lightning:emit</code>
            </p>
            <p className="text-muted-foreground">
              3. Review trajectory comparisons in the Reviews tab
            </p>
            <p className="text-muted-foreground">
              4. Run APO training with <code className="rounded bg-muted px-1 py-0.5">lightning:optimize</code>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
