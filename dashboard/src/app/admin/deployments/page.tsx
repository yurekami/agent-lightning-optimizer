'use client'

import { useState, useEffect } from 'react'
import { ApprovalQueue } from '@/components/ApprovalQueue'
import { DeploymentHistory } from '@/components/DeploymentHistory'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Rocket,
  AlertTriangle,
  CheckCircle,
  Clock,
  Activity,
  RefreshCw,
} from 'lucide-react'

interface Agent {
  id: string
  name: string
  currentVersionId: string | null
  currentVersion: number | null
}

interface DeploymentAlert {
  id: string
  type: 'regression' | 'pending_approval' | 'rollback'
  message: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  agentId: string
  timestamp: string
}

// Temporary user ID - in production this would come from auth
const CURRENT_USER_ID = '00000000-0000-0000-0000-000000000001'

export default function DeploymentsPage() {
  const [agents, setAgents] = useState<Agent[]>([])
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<DeploymentAlert[]>([])
  const [stats, setStats] = useState({
    pendingApprovals: 0,
    activeDeployments: 0,
    regressionsToday: 0,
  })
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    fetchData()
  }, [])

  async function fetchData() {
    try {
      setLoading(true)

      // Fetch agents
      const agentsRes = await fetch('/api/admin/agents')
      if (agentsRes.ok) {
        const agentsData = await agentsRes.json()
        setAgents(agentsData)
        if (agentsData.length > 0 && !selectedAgent) {
          setSelectedAgent(agentsData[0].id)
        }
      }

      // Fetch stats
      const statsRes = await fetch('/api/admin/deployments/stats')
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      // Fetch alerts
      const alertsRes = await fetch('/api/admin/deployments/alerts')
      if (alertsRes.ok) {
        const alertsData = await alertsRes.json()
        setAlerts(alertsData)
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleRefresh() {
    setRefreshKey((k) => k + 1)
    fetchData()
  }

  function getAlertIcon(type: string) {
    switch (type) {
      case 'regression':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'pending_approval':
        return <Clock className="h-4 w-4 text-yellow-500" />
      case 'rollback':
        return <Activity className="h-4 w-4 text-orange-500" />
      default:
        return <CheckCircle className="h-4 w-4 text-gray-500" />
    }
  }

  function getSeverityColor(severity: string) {
    switch (severity) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Deployments</h1>
          <p className="text-muted-foreground">
            Manage prompt version deployments and approvals
          </p>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingApprovals}</div>
            <p className="text-xs text-muted-foreground">
              Awaiting review
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Deployments</CardTitle>
            <Rocket className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeDeployments}</div>
            <p className="text-xs text-muted-foreground">
              Currently in production
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Regressions Today</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.regressionsToday}</div>
            <p className="text-xs text-muted-foreground">
              Detected in last 24h
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Active Alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Active Alerts
            </CardTitle>
            <CardDescription>
              Issues requiring attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}
                >
                  {getAlertIcon(alert.type)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{alert.agentId}</span>
                      <Badge variant="outline" className="text-xs">
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="text-sm mt-1">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Approval Queue */}
      <ApprovalQueue
        key={`approvals-${refreshKey}`}
        currentUserId={CURRENT_USER_ID}
        onApprovalAction={handleRefresh}
      />

      {/* Deployment History by Agent */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">Deployment History</h2>
          {agents.length > 0 && (
            <Select
              value={selectedAgent || undefined}
              onValueChange={setSelectedAgent}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select an agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-2">
                      <span>{agent.name || agent.id}</span>
                      {agent.currentVersion && (
                        <span className="text-muted-foreground text-xs">
                          (v{agent.currentVersion})
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {selectedAgent ? (
          <DeploymentHistory
            key={`history-${selectedAgent}-${refreshKey}`}
            agentId={selectedAgent}
            currentUserId={CURRENT_USER_ID}
            onRollback={handleRefresh}
          />
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : agents.length === 0 ? (
                'No agents found. Create an agent to get started.'
              ) : (
                'Select an agent to view deployment history.'
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
