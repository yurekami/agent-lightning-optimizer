'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import {
  Rocket,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  User,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface DeploymentMetrics {
  successRate: number
  avgEfficiency: number
  errorRate: number
  trajectoryCount: number
  avgSteps: number
  avgDurationMs: number
}

interface RegressionReport {
  detected: boolean
  severity: 'low' | 'medium' | 'high' | 'critical' | null
  recommendations: string[]
  evaluatedAt: string
  autoRollbackTriggered: boolean
}

interface Deployment {
  id: string
  versionId: string
  agentId: string
  deployedBy: string
  deployedByName?: string
  deployedAt: string
  status: 'pending' | 'deploying' | 'active' | 'rolled_back' | 'superseded'
  previousDeploymentId: string | null
  metricsBaseline: DeploymentMetrics | null
  metricsPostDeployment: DeploymentMetrics | null
  regressionDetected: boolean
  rolledBackAt: string | null
  rolledBackBy: string | null
  rolledBackByName?: string
  rollbackReason: string | null
  version?: number
  regressionReport?: RegressionReport
}

interface DeploymentHistoryProps {
  agentId: string
  currentUserId: string
  onRollback?: () => void
}

export function DeploymentHistory({ agentId, currentUserId, onRollback }: DeploymentHistoryProps) {
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [rollbackDialogOpen, setRollbackDialogOpen] = useState(false)
  const [selectedDeployment, setSelectedDeployment] = useState<Deployment | null>(null)
  const [rollbackReason, setRollbackReason] = useState('')
  const [rollbackLoading, setRollbackLoading] = useState(false)

  useEffect(() => {
    fetchDeployments()
  }, [agentId])

  async function fetchDeployments() {
    try {
      setLoading(true)
      const response = await fetch(`/api/admin/deployments?agentId=${encodeURIComponent(agentId)}`)
      if (!response.ok) throw new Error('Failed to fetch deployments')
      const data = await response.json()
      setDeployments(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function handleRollback() {
    if (!selectedDeployment) return

    try {
      setRollbackLoading(true)
      const response = await fetch(`/api/admin/deployments/${selectedDeployment.id}/rollback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rolledBackBy: currentUserId,
          reason: rollbackReason || undefined,
        }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to rollback')
      }
      setRollbackDialogOpen(false)
      setRollbackReason('')
      setSelectedDeployment(null)
      await fetchDeployments()
      onRollback?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setRollbackLoading(false)
    }
  }

  function getStatusBadge(deployment: Deployment) {
    if (deployment.regressionDetected) {
      return (
        <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Regression
        </Badge>
      )
    }

    switch (deployment.status) {
      case 'active':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Active
          </Badge>
        )
      case 'rolled_back':
        return (
          <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
            <RotateCcw className="h-3 w-3 mr-1" />
            Rolled Back
          </Badge>
        )
      case 'superseded':
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            Superseded
          </Badge>
        )
      case 'deploying':
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <Clock className="h-3 w-3 mr-1 animate-spin" />
            Deploying
          </Badge>
        )
      default:
        return <Badge variant="outline">{deployment.status}</Badge>
    }
  }

  function getSeverityBadge(severity: string | null) {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>
      case 'high':
        return <Badge className="bg-orange-500">High</Badge>
      case 'medium':
        return <Badge className="bg-yellow-500">Medium</Badge>
      case 'low':
        return <Badge className="bg-blue-500">Low</Badge>
      default:
        return null
    }
  }

  function renderMetricChange(before: number, after: number, isPositiveGood: boolean = true) {
    if (before === 0) {
      return <Minus className="h-4 w-4 text-muted-foreground" />
    }

    const change = ((after - before) / before) * 100
    const isPositive = change > 0
    const isGood = isPositiveGood ? isPositive : !isPositive

    return (
      <span className={`flex items-center gap-1 ${isGood ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? (
          <TrendingUp className="h-4 w-4" />
        ) : change < 0 ? (
          <TrendingDown className="h-4 w-4" />
        ) : (
          <Minus className="h-4 w-4" />
        )}
        {Math.abs(change).toFixed(1)}%
      </span>
    )
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deployment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Deployment History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
          <Button className="mt-4" onClick={() => { setError(null); fetchDeployments(); }}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          Deployment History
        </CardTitle>
        <CardDescription>
          {deployments.length} deployment{deployments.length !== 1 ? 's' : ''} for {agentId}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {deployments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No deployments yet
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

            <div className="space-y-4">
              {deployments.map((deployment, index) => (
                <div key={deployment.id} className="relative pl-10">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-2.5 w-3 h-3 rounded-full ${
                      deployment.status === 'active'
                        ? 'bg-green-500'
                        : deployment.regressionDetected
                        ? 'bg-red-500'
                        : deployment.status === 'rolled_back'
                        ? 'bg-orange-500'
                        : 'bg-gray-400'
                    }`}
                  />

                  <div className="border rounded-lg overflow-hidden">
                    <div
                      className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() =>
                        setExpandedId(expandedId === deployment.id ? null : deployment.id)
                      }
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              v{deployment.version || deployment.versionId.slice(0, 8)}
                            </span>
                            {getStatusBadge(deployment)}
                            {deployment.regressionReport?.severity &&
                              getSeverityBadge(deployment.regressionReport.severity)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-4 w-4" />
                              {deployment.deployedByName || 'Unknown'}
                            </span>
                            <span>
                              {format(new Date(deployment.deployedAt), 'MMM d, yyyy HH:mm')}
                            </span>
                            <span className="text-xs">
                              ({formatDistanceToNow(new Date(deployment.deployedAt), { addSuffix: true })})
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {deployment.status === 'active' && !deployment.regressionDetected && (
                            <Dialog
                              open={rollbackDialogOpen && selectedDeployment?.id === deployment.id}
                              onOpenChange={(open) => {
                                setRollbackDialogOpen(open)
                                if (!open) {
                                  setSelectedDeployment(null)
                                  setRollbackReason('')
                                }
                              }}
                            >
                              <DialogTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedDeployment(deployment)
                                  }}
                                >
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  Rollback
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Confirm Rollback</DialogTitle>
                                  <DialogDescription>
                                    This will rollback to the previous deployment version.
                                    The current version will be marked as rolled back.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="py-4">
                                  <label className="text-sm font-medium">
                                    Reason (optional)
                                  </label>
                                  <Textarea
                                    value={rollbackReason}
                                    onChange={(e) => setRollbackReason(e.target.value)}
                                    placeholder="Why are you rolling back?"
                                    className="mt-2"
                                  />
                                </div>
                                <DialogFooter>
                                  <Button
                                    variant="outline"
                                    onClick={() => setRollbackDialogOpen(false)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    onClick={handleRollback}
                                    disabled={rollbackLoading}
                                  >
                                    {rollbackLoading ? 'Rolling back...' : 'Rollback'}
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          )}
                          {expandedId === deployment.id ? (
                            <ChevronUp className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </div>

                    {expandedId === deployment.id && (
                      <div className="border-t p-4 bg-muted/30 space-y-4">
                        {/* Metrics comparison */}
                        {deployment.metricsBaseline && deployment.metricsPostDeployment && (
                          <div>
                            <h4 className="text-sm font-medium mb-3">Metrics Comparison</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Success Rate</div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {(deployment.metricsPostDeployment.successRate * 100).toFixed(1)}%
                                  </span>
                                  {renderMetricChange(
                                    deployment.metricsBaseline.successRate,
                                    deployment.metricsPostDeployment.successRate
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Error Rate</div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {(deployment.metricsPostDeployment.errorRate * 100).toFixed(1)}%
                                  </span>
                                  {renderMetricChange(
                                    deployment.metricsBaseline.errorRate,
                                    deployment.metricsPostDeployment.errorRate,
                                    false
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Avg Efficiency</div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">
                                    {deployment.metricsPostDeployment.avgEfficiency.toFixed(2)}
                                  </span>
                                  {renderMetricChange(
                                    deployment.metricsBaseline.avgEfficiency,
                                    deployment.metricsPostDeployment.avgEfficiency
                                  )}
                                </div>
                              </div>
                              <div className="space-y-1">
                                <div className="text-xs text-muted-foreground">Trajectories</div>
                                <div className="font-medium">
                                  {deployment.metricsPostDeployment.trajectoryCount}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Regression report */}
                        {deployment.regressionReport && (
                          <div>
                            <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                              Regression Analysis
                              {deployment.regressionReport.detected && (
                                <AlertTriangle className="h-4 w-4 text-red-500" />
                              )}
                            </h4>
                            <div className="space-y-2">
                              {deployment.regressionReport.recommendations.map((rec, i) => (
                                <div
                                  key={i}
                                  className="text-sm text-muted-foreground pl-4 border-l-2 border-muted"
                                >
                                  {rec}
                                </div>
                              ))}
                              {deployment.regressionReport.autoRollbackTriggered && (
                                <div className="text-sm text-orange-600 flex items-center gap-1">
                                  <RotateCcw className="h-4 w-4" />
                                  Auto-rollback was triggered
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Rollback info */}
                        {deployment.rolledBackAt && (
                          <div className="text-sm text-muted-foreground">
                            <span className="font-medium text-orange-600">Rolled back</span>
                            {' '}by {deployment.rolledBackByName || deployment.rolledBackBy}
                            {' '}{formatDistanceToNow(new Date(deployment.rolledBackAt), { addSuffix: true })}
                            {deployment.rollbackReason && (
                              <div className="mt-1 pl-4 border-l-2 border-orange-200">
                                {deployment.rollbackReason}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
