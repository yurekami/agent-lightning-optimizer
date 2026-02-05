'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  SystemMetrics,
  ReviewerStats,
  FitnessTrend,
  ReliabilityMetrics,
  QueueHealth,
  AgentSummary,
  TimeRange,
  Reviewer,
} from '@/types'

export function useSystemMetrics(timeRange: TimeRange = '7d') {
  return useQuery<SystemMetrics>({
    queryKey: ['admin', 'metrics', timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/admin/metrics?timeRange=${timeRange}`)
      if (!response.ok) throw new Error('Failed to fetch system metrics')
      return response.json()
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })
}

export function useReviewerStats() {
  return useQuery<ReviewerStats[]>({
    queryKey: ['admin', 'reviewers', 'stats'],
    queryFn: async () => {
      const response = await fetch('/api/admin/reviewers')
      if (!response.ok) throw new Error('Failed to fetch reviewer stats')
      return response.json()
    },
    refetchInterval: 60000, // Refresh every minute
  })
}

export function useReviewer(id: string) {
  return useQuery<ReviewerStats>({
    queryKey: ['admin', 'reviewers', id],
    queryFn: async () => {
      const response = await fetch(`/api/admin/reviewers/${id}`)
      if (!response.ok) throw new Error('Failed to fetch reviewer')
      return response.json()
    },
  })
}

export function useFitnessTrends(agentId: string, timeRange: TimeRange = '30d') {
  return useQuery<FitnessTrend[]>({
    queryKey: ['admin', 'fitness', agentId, timeRange],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/fitness?agentId=${agentId}&timeRange=${timeRange}`
      )
      if (!response.ok) throw new Error('Failed to fetch fitness trends')
      const data = await response.json()
      // Parse dates
      return data.map((item: any) => ({
        ...item,
        date: new Date(item.date),
      }))
    },
    enabled: !!agentId,
  })
}

export function useQueueHealth() {
  return useQuery<QueueHealth>({
    queryKey: ['admin', 'queue-health'],
    queryFn: async () => {
      const response = await fetch('/api/admin/queue-health')
      if (!response.ok) throw new Error('Failed to fetch queue health')
      const data = await response.json()
      // Parse dates
      return {
        ...data,
        trends: data.trends.map((t: any) => ({
          ...t,
          date: new Date(t.date),
        })),
      }
    },
    refetchInterval: 30000,
  })
}

export function useInterRaterReliability() {
  return useQuery<ReliabilityMetrics>({
    queryKey: ['admin', 'reliability'],
    queryFn: async () => {
      const response = await fetch('/api/admin/reliability')
      if (!response.ok) throw new Error('Failed to fetch reliability metrics')
      return response.json()
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  })
}

export function useAgentSummaries() {
  return useQuery<AgentSummary[]>({
    queryKey: ['admin', 'agents', 'summaries'],
    queryFn: async () => {
      const response = await fetch('/api/admin/agents')
      if (!response.ok) throw new Error('Failed to fetch agent summaries')
      const data = await response.json()
      // Parse dates
      return data.map((agent: any) => ({
        ...agent,
        lastDeployment: agent.lastDeployment
          ? new Date(agent.lastDeployment)
          : null,
      }))
    },
    refetchInterval: 60000,
  })
}

export function useUpdateReviewer() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string
      data: Partial<Reviewer>
    }) => {
      const response = await fetch(`/api/admin/reviewers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) throw new Error('Failed to update reviewer')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'reviewers'] })
    },
  })
}

export function useExportData() {
  return useMutation({
    mutationFn: async (format: 'csv' | 'json') => {
      const response = await fetch(`/api/admin/export?format=${format}`)
      if (!response.ok) throw new Error('Failed to export data')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `admin-export-${new Date().toISOString()}.${format}`
      a.click()
      window.URL.revokeObjectURL(url)
    },
  })
}
