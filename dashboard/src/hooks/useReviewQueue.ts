'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ComparisonItem, ComparisonFeedback, ReviewStats } from '@/types'

const REVIEWER_ID = 'default-reviewer' // TODO: Get from auth context

export function useReviewQueue() {
  const queryClient = useQueryClient()

  const { data: queue = [], isLoading: isLoadingQueue } = useQuery<ComparisonItem[]>({
    queryKey: ['review-queue'],
    queryFn: async () => {
      const response = await fetch('/api/reviews/queue')
      if (!response.ok) throw new Error('Failed to fetch queue')
      const data = await response.json()
      return data.queue
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const { data: stats, isLoading: isLoadingStats } = useQuery<ReviewStats>({
    queryKey: ['review-stats', REVIEWER_ID],
    queryFn: async () => {
      const response = await fetch(`/api/reviews/stats?reviewer_id=${REVIEWER_ID}`)
      if (!response.ok) throw new Error('Failed to fetch stats')
      const data = await response.json()
      return data.stats
    },
  })

  const submitMutation = useMutation({
    mutationFn: async (feedback: Omit<ComparisonFeedback, 'id' | 'reviewed_at' | 'metadata'>) => {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...feedback,
          metadata: {},
        }),
      })
      if (!response.ok) throw new Error('Failed to submit feedback')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-queue'] })
      queryClient.invalidateQueries({ queryKey: ['review-stats'] })
    },
  })

  const skipMutation = useMutation({
    mutationFn: async ({ comparisonId, reason }: { comparisonId: string; reason: string }) => {
      const response = await fetch('/api/reviews/skip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          comparison_id: comparisonId,
          reviewer_id: REVIEWER_ID,
          reason,
        }),
      })
      if (!response.ok) throw new Error('Failed to skip comparison')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['review-queue'] })
    },
  })

  const current = queue[0] || null

  const loadNext = () => {
    // Current item is automatically removed from queue after submit/skip
    queryClient.invalidateQueries({ queryKey: ['review-queue'] })
  }

  const submit = (feedback: Omit<ComparisonFeedback, 'id' | 'reviewed_at' | 'metadata' | 'reviewer_id'>) => {
    return submitMutation.mutateAsync({
      ...feedback,
      reviewer_id: REVIEWER_ID,
    })
  }

  const skip = (reason: string) => {
    if (!current) return Promise.reject(new Error('No current comparison'))
    return skipMutation.mutateAsync({
      comparisonId: current.id,
      reason,
    })
  }

  return {
    queue,
    current,
    stats: stats || {
      totalReviews: 0,
      reviewsToday: 0,
      reviewsThisWeek: 0,
      agreementRate: 0,
      currentStreak: 0,
      leaderboardPosition: 0,
      avgReviewTime: 0,
    },
    isLoading: isLoadingQueue || isLoadingStats,
    loadNext,
    submit,
    skip,
    isSubmitting: submitMutation.isPending,
    isSkipping: skipMutation.isPending,
  }
}
