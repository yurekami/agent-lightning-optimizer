'use client'

import { useState, useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

interface ApprovalRequest {
  id: string
  versionId: string
  agentId: string
  requestedBy: string
  requestedByName?: string
  requestedAt: string
  requiredApprovals: number
  currentApprovals: number
  status: 'pending' | 'approved' | 'rejected' | 'expired'
  expiresAt: string | null
  version?: number
  promptPreview?: string
  fitness?: {
    winRate: number | null
    successRate: number | null
    avgEfficiency: number | null
  }
}

interface ApprovalVote {
  id: string
  approverId: string
  approverName?: string
  vote: 'approve' | 'reject'
  reason: string | null
  votedAt: string
}

interface ApprovalQueueProps {
  currentUserId: string
  onApprovalAction?: () => void
}

export function ApprovalQueue({ currentUserId, onApprovalAction }: ApprovalQueueProps) {
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [votes, setVotes] = useState<Record<string, ApprovalVote[]>>({})
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({})

  useEffect(() => {
    fetchApprovals()
  }, [])

  async function fetchApprovals() {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/approvals')
      if (!response.ok) throw new Error('Failed to fetch approvals')
      const data = await response.json()
      setApprovals(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  async function fetchVotes(versionId: string) {
    try {
      const response = await fetch(`/api/admin/approvals/${versionId}/votes`)
      if (!response.ok) throw new Error('Failed to fetch votes')
      const data = await response.json()
      setVotes(prev => ({ ...prev, [versionId]: data }))
    } catch (err) {
      console.error('Failed to fetch votes:', err)
    }
  }

  async function handleApprove(versionId: string) {
    try {
      setActionLoading(versionId)
      const response = await fetch(`/api/admin/approvals/${versionId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approverId: currentUserId }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to approve')
      }
      await fetchApprovals()
      onApprovalAction?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleReject(versionId: string) {
    const reason = rejectReason[versionId]
    if (!reason?.trim()) {
      setError('Please provide a reason for rejection')
      return
    }

    try {
      setActionLoading(versionId)
      const response = await fetch(`/api/admin/approvals/${versionId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approverId: currentUserId, reason }),
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reject')
      }
      await fetchApprovals()
      setRejectReason(prev => ({ ...prev, [versionId]: '' }))
      onApprovalAction?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setActionLoading(null)
    }
  }

  function toggleExpand(approval: ApprovalRequest) {
    if (expandedId === approval.id) {
      setExpandedId(null)
    } else {
      setExpandedId(approval.id)
      if (!votes[approval.versionId]) {
        fetchVotes(approval.versionId)
      }
    }
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>
      case 'approved':
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Approved</Badge>
      case 'rejected':
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Rejected</Badge>
      case 'expired':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">Expired</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Approval Queue</CardTitle>
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
          <CardTitle>Approval Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            <span>{error}</span>
          </div>
          <Button className="mt-4" onClick={() => { setError(null); fetchApprovals(); }}>
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
          <Clock className="h-5 w-5" />
          Approval Queue
        </CardTitle>
        <CardDescription>
          {approvals.length} pending approval{approvals.length !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {approvals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No pending approvals
          </div>
        ) : (
          <div className="space-y-4">
            {approvals.map((approval) => (
              <div
                key={approval.id}
                className="border rounded-lg overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleExpand(approval)}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{approval.agentId}</span>
                        {approval.version && (
                          <span className="text-muted-foreground">v{approval.version}</span>
                        )}
                        {getStatusBadge(approval.status)}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-4 w-4" />
                          {approval.requestedByName || 'Unknown'}
                        </span>
                        <span>
                          {formatDistanceToNow(new Date(approval.requestedAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-sm font-medium">
                          {approval.currentApprovals}/{approval.requiredApprovals}
                        </div>
                        <div className="text-xs text-muted-foreground">approvals</div>
                      </div>
                      {expandedId === approval.id ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </div>

                {expandedId === approval.id && (
                  <div className="border-t p-4 bg-muted/30 space-y-4">
                    {/* Fitness metrics */}
                    {approval.fitness && (
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground">Win Rate</div>
                          <div className="text-lg font-semibold">
                            {approval.fitness.winRate !== null
                              ? `${(approval.fitness.winRate * 100).toFixed(1)}%`
                              : '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Success Rate</div>
                          <div className="text-lg font-semibold">
                            {approval.fitness.successRate !== null
                              ? `${(approval.fitness.successRate * 100).toFixed(1)}%`
                              : '-'}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Avg Efficiency</div>
                          <div className="text-lg font-semibold">
                            {approval.fitness.avgEfficiency !== null
                              ? approval.fitness.avgEfficiency.toFixed(2)
                              : '-'}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Prompt preview */}
                    {approval.promptPreview && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-1">Prompt Preview</div>
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">
                          {approval.promptPreview}
                        </pre>
                      </div>
                    )}

                    {/* Votes */}
                    {votes[approval.versionId] && votes[approval.versionId].length > 0 && (
                      <div>
                        <div className="text-xs text-muted-foreground mb-2">Votes</div>
                        <div className="space-y-2">
                          {votes[approval.versionId].map((vote) => (
                            <div
                              key={vote.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              {vote.vote === 'approve' ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                              <span>{vote.approverName || vote.approverId}</span>
                              {vote.reason && (
                                <span className="text-muted-foreground">- {vote.reason}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Expiration warning */}
                    {approval.expiresAt && (
                      <div className="flex items-center gap-2 text-sm text-amber-600">
                        <AlertTriangle className="h-4 w-4" />
                        Expires {formatDistanceToNow(new Date(approval.expiresAt), { addSuffix: true })}
                      </div>
                    )}

                    {/* Action buttons */}
                    {approval.status === 'pending' && (
                      <div className="space-y-3 pt-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleApprove(approval.versionId)
                            }}
                            disabled={actionLoading === approval.versionId}
                          >
                            <CheckCircle className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Reason for rejection (required)"
                            value={rejectReason[approval.versionId] || ''}
                            onChange={(e) =>
                              setRejectReason((prev) => ({
                                ...prev,
                                [approval.versionId]: e.target.value,
                              }))
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="text-sm"
                            rows={2}
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleReject(approval.versionId)
                            }}
                            disabled={actionLoading === approval.versionId}
                          >
                            <XCircle className="h-4 w-4 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
