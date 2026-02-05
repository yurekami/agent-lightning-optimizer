import { sql } from './db'
import {
  SystemMetrics,
  ReviewerStats,
  FitnessTrend,
  ReliabilityMetrics,
  QueueHealth,
  AgentSummary,
  TimeRange,
} from '@/types'
import { subDays, subHours, startOfDay } from 'date-fns'

export async function calculateSystemMetrics(
  timeRange: TimeRange
): Promise<SystemMetrics> {
  const now = new Date()
  const dayAgo = subHours(now, 24)
  const weekAgo = subDays(now, 7)

  // Trajectories
  const [trajToday] = await sql`
    SELECT COUNT(*) as count
    FROM trajectories
    WHERE created_at >= ${dayAgo}
  `

  const [trajWeek] = await sql`
    SELECT COUNT(*) as count
    FROM trajectories
    WHERE created_at >= ${weekAgo}
  `

  const [trajTotal] = await sql`
    SELECT COUNT(*) as count
    FROM trajectories
  `

  // Reviews
  const [reviewsToday] = await sql`
    SELECT COUNT(*) as count
    FROM comparison_feedback
    WHERE reviewed_at >= ${dayAgo}
  `

  const [reviewsWeek] = await sql`
    SELECT COUNT(*) as count
    FROM comparison_feedback
    WHERE reviewed_at >= ${weekAgo}
  `

  const [reviewsTotal] = await sql`
    SELECT COUNT(*) as count
    FROM comparison_feedback
  `

  // Agents
  const activeAgents = await sql`
    SELECT DISTINCT agent_name
    FROM prompt_versions
    WHERE is_active = true
  `

  // Population sizes (count versions per agent)
  const populations = await sql`
    SELECT agent_name, COUNT(*) as count
    FROM prompt_versions
    WHERE is_active = true
    GROUP BY agent_name
  `

  const populationSizes: Record<string, number> = {}
  populations.forEach((p: any) => {
    populationSizes[p.agent_name] = Number(p.count)
  })

  // Generations (assuming metadata stores generation info)
  const [generations] = await sql`
    SELECT COALESCE(MAX((metadata->>'generation')::int), 0) as max_gen
    FROM prompt_versions
    WHERE metadata->>'generation' IS NOT NULL
  `

  // Mutations (count non-base versions)
  const [mutations] = await sql`
    SELECT COUNT(*) as count
    FROM prompt_versions
    WHERE parent_version_id IS NOT NULL
  `

  return {
    trajectories: {
      today: Number(trajToday.count),
      week: Number(trajWeek.count),
      total: Number(trajTotal.count),
    },
    reviews: {
      today: Number(reviewsToday.count),
      week: Number(reviewsWeek.count),
      total: Number(reviewsTotal.count),
    },
    agents: activeAgents.length,
    generations: Number(generations.max_gen || 0),
    mutations: Number(mutations.count),
    activeAgents: activeAgents.map((a: any) => a.agent_name),
    populationSizes,
  }
}

export async function calculateReviewerStats(): Promise<ReviewerStats[]> {
  const reviewers = await sql`
    SELECT
      r.id,
      r.name,
      r.email,
      r.role,
      COUNT(cf.id) as review_count,
      MAX(cf.reviewed_at) as last_active,
      AVG(EXTRACT(EPOCH FROM (cf.reviewed_at - cf.created_at))) as avg_review_time,
      SUM(CASE WHEN cf.preference = 'A' THEN 1 ELSE 0 END) as pref_a,
      SUM(CASE WHEN cf.preference = 'B' THEN 1 ELSE 0 END) as pref_b,
      SUM(CASE WHEN cf.preference = 'tie' THEN 1 ELSE 0 END) as pref_tie
    FROM reviewers r
    LEFT JOIN comparison_feedback cf ON r.id = cf.reviewer_id
    GROUP BY r.id, r.name, r.email, r.role
    ORDER BY review_count DESC
  `

  const stats: ReviewerStats[] = []

  for (const reviewer of reviewers) {
    // Calculate agreement rate (Cohen's kappa approximation)
    const agreementRate = await calculateReviewerAgreement(reviewer.id)

    // Calculate streak
    const streak = await calculateReviewerStreak(reviewer.id)

    stats.push({
      id: reviewer.id,
      name: reviewer.name,
      email: reviewer.email,
      role: reviewer.role,
      reviewCount: Number(reviewer.review_count) || 0,
      agreementRate,
      lastActive: reviewer.last_active ? new Date(reviewer.last_active) : null,
      streak,
      avgReviewTime: Number(reviewer.avg_review_time) || 0,
      preferences: {
        A: Number(reviewer.pref_a) || 0,
        B: Number(reviewer.pref_b) || 0,
        tie: Number(reviewer.pref_tie) || 0,
      },
    })
  }

  return stats
}

async function calculateReviewerAgreement(reviewerId: string): Promise<number> {
  // Get pairs reviewed by this reviewer
  const myReviews = await sql`
    SELECT trajectory_a_id, trajectory_b_id, preference
    FROM comparison_feedback
    WHERE reviewer_id = ${reviewerId}
  `

  if (myReviews.length === 0) return 0

  // Get same pairs reviewed by others
  let totalAgreements = 0
  let totalComparisons = 0

  for (const review of myReviews) {
    const otherReviews = await sql`
      SELECT preference
      FROM comparison_feedback
      WHERE trajectory_a_id = ${review.trajectory_a_id}
        AND trajectory_b_id = ${review.trajectory_b_id}
        AND reviewer_id != ${reviewerId}
    `

    for (const other of otherReviews) {
      totalComparisons++
      if (review.preference === other.preference) {
        totalAgreements++
      }
    }
  }

  return totalComparisons > 0 ? totalAgreements / totalComparisons : 0
}

async function calculateReviewerStreak(reviewerId: string): Promise<number> {
  const reviews = await sql`
    SELECT DATE(reviewed_at) as review_date
    FROM comparison_feedback
    WHERE reviewer_id = ${reviewerId}
    ORDER BY reviewed_at DESC
  `

  if (reviews.length === 0) return 0

  let streak = 0
  let currentDate = startOfDay(new Date())

  for (const review of reviews) {
    const reviewDate = startOfDay(new Date(review.review_date))
    const diffDays = Math.floor(
      (currentDate.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (diffDays === streak) {
      streak++
    } else {
      break
    }
  }

  return streak
}

export async function calculateFitnessTrends(
  agentName: string,
  timeRange: TimeRange
): Promise<FitnessTrend[]> {
  const cutoffDate = getTimeRangeCutoff(timeRange)

  const trends = await sql`
    SELECT
      DATE(t.completed_at) as date,
      AVG(COALESCE((t.metadata->>'fitness_score')::float, 0)) as avg_fitness,
      AVG(CASE WHEN t.metadata->>'outcome' = 'success' THEN 1.0 ELSE 0.0 END) as success_rate,
      AVG(COALESCE((t.metadata->>'efficiency')::float, 0)) as avg_efficiency,
      AVG(COALESCE((pv.metadata->>'generation')::int, 0)) as generation
    FROM trajectories t
    JOIN prompt_versions pv ON t.prompt_version_id = pv.id
    WHERE t.agent_name = ${agentName}
      AND t.completed_at >= ${cutoffDate}
      AND t.completed_at IS NOT NULL
    GROUP BY DATE(t.completed_at)
    ORDER BY date ASC
  `

  return trends.map((t: any) => ({
    date: new Date(t.date),
    fitness: Number(t.avg_fitness) || 0,
    winRate: Number(t.success_rate) || 0,
    successRate: Number(t.success_rate) || 0,
    efficiency: Number(t.avg_efficiency) || 0,
    generation: Number(t.generation) || 0,
  }))
}

export async function calculateCohenKappa(
  reviewerA: string,
  reviewerB: string
): Promise<number> {
  // Find pairs reviewed by both
  const sharedReviews = await sql`
    SELECT
      a.preference as pref_a,
      b.preference as pref_b
    FROM comparison_feedback a
    JOIN comparison_feedback b
      ON a.trajectory_a_id = b.trajectory_a_id
      AND a.trajectory_b_id = b.trajectory_b_id
    WHERE a.reviewer_id = ${reviewerA}
      AND b.reviewer_id = ${reviewerB}
  `

  if (sharedReviews.length === 0) return 0

  // Calculate observed agreement
  const agreements = sharedReviews.filter(
    (r: any) => r.pref_a === r.pref_b
  ).length
  const pObserved = agreements / sharedReviews.length

  // Calculate expected agreement by chance
  const countsA = { A: 0, B: 0, tie: 0 }
  const countsB = { A: 0, B: 0, tie: 0 }

  sharedReviews.forEach((r: any) => {
    countsA[r.pref_a as keyof typeof countsA]++
    countsB[r.pref_b as keyof typeof countsB]++
  })

  const n = sharedReviews.length
  const pExpected =
    (countsA.A * countsB.A + countsA.B * countsB.B + countsA.tie * countsB.tie) /
    (n * n)

  // Cohen's Kappa
  const kappa = (pObserved - pExpected) / (1 - pExpected)
  return isNaN(kappa) ? 0 : kappa
}

export async function calculateOverallReliability(): Promise<ReliabilityMetrics> {
  const reviewers = await sql`
    SELECT DISTINCT reviewer_id FROM comparison_feedback
  `

  const reviewerIds = reviewers.map((r: any) => r.reviewer_id)
  const pairwiseKappa: Record<string, Record<string, number>> = {}

  // Calculate pairwise kappa for all reviewer pairs
  for (let i = 0; i < reviewerIds.length; i++) {
    pairwiseKappa[reviewerIds[i]] = {}
    for (let j = i + 1; j < reviewerIds.length; j++) {
      const kappa = await calculateCohenKappa(reviewerIds[i], reviewerIds[j])
      pairwiseKappa[reviewerIds[i]][reviewerIds[j]] = kappa
      if (!pairwiseKappa[reviewerIds[j]]) {
        pairwiseKappa[reviewerIds[j]] = {}
      }
      pairwiseKappa[reviewerIds[j]][reviewerIds[i]] = kappa
    }
  }

  // Calculate overall kappa (average of all pairwise kappas)
  const kappaValues = Object.values(pairwiseKappa).flatMap((inner) =>
    Object.values(inner)
  )
  const overallKappa =
    kappaValues.length > 0
      ? kappaValues.reduce((sum, k) => sum + k, 0) / kappaValues.length
      : 0

  // Build confusion matrix
  const confusionMatrix = {
    AA: 0,
    AB: 0,
    ATie: 0,
    BA: 0,
    BB: 0,
    BTie: 0,
    TieA: 0,
    TieB: 0,
    TieTie: 0,
  }

  for (let i = 0; i < reviewerIds.length; i++) {
    for (let j = i + 1; j < reviewerIds.length; j++) {
      const pairs = await sql`
        SELECT a.preference as pref_a, b.preference as pref_b
        FROM comparison_feedback a
        JOIN comparison_feedback b
          ON a.trajectory_a_id = b.trajectory_a_id
          AND a.trajectory_b_id = b.trajectory_b_id
        WHERE a.reviewer_id = ${reviewerIds[i]}
          AND b.reviewer_id = ${reviewerIds[j]}
      `

      pairs.forEach((p: any) => {
        const key = `${p.pref_a}${p.pref_b}` as keyof typeof confusionMatrix
        if (key in confusionMatrix) {
          confusionMatrix[key]++
        }
      })
    }
  }

  const [sampleSize] = await sql`
    SELECT COUNT(*) as count FROM comparison_feedback
  `

  return {
    overallKappa,
    pairwiseKappa,
    sampleSize: Number(sampleSize.count),
    confusionMatrix,
  }
}

export async function calculateQueueHealth(): Promise<QueueHealth> {
  // Current queue depth
  const [currentDepth] = await sql`
    SELECT COUNT(*) as count
    FROM comparison_queue
    WHERE status = 'pending'
  `

  // Average wait time (time from creation to first review)
  const [avgWait] = await sql`
    SELECT AVG(EXTRACT(EPOCH FROM (cf.reviewed_at - cq.created_at))) as avg_wait
    FROM comparison_queue cq
    JOIN comparison_feedback cf
      ON (cq.trajectory_a_id = cf.trajectory_a_id AND cq.trajectory_b_id = cf.trajectory_b_id)
    WHERE cq.created_at >= ${subDays(new Date(), 7)}
  `

  // Comparisons per day (last 30 days)
  const dailyComparisons = await sql`
    SELECT
      DATE(reviewed_at) as date,
      COUNT(*) as count
    FROM comparison_feedback
    WHERE reviewed_at >= ${subDays(new Date(), 30)}
    GROUP BY DATE(reviewed_at)
    ORDER BY date DESC
  `

  const trends = dailyComparisons.map((d: any) => ({
    date: new Date(d.date),
    depth: 0, // Would need historical queue depth data
    comparisons: Number(d.count),
  }))

  const avgComparisonsPerDay =
    trends.length > 0
      ? trends.reduce((sum, t) => sum + t.comparisons, 0) / trends.length
      : 0

  const backlogAlert = Number(currentDepth.count) > avgComparisonsPerDay * 3

  return {
    currentDepth: Number(currentDepth.count),
    avgWaitTime: Number(avgWait?.avg_wait || 0),
    comparisonsPerDay: avgComparisonsPerDay,
    backlogAlert,
    trends,
  }
}

export async function calculateAgentSummaries(): Promise<AgentSummary[]> {
  const agents = await sql`
    SELECT DISTINCT agent_name
    FROM prompt_versions
  `

  const summaries: AgentSummary[] = []

  for (const agent of agents) {
    const agentName = agent.agent_name

    // Production version
    const [prodVersion] = await sql`
      SELECT id, version_number, performance_metrics
      FROM prompt_versions
      WHERE agent_name = ${agentName}
        AND is_active = true
      ORDER BY version_number DESC
      LIMIT 1
    `

    // Trajectory count
    const [trajCount] = await sql`
      SELECT COUNT(*) as count
      FROM trajectories
      WHERE agent_name = ${agentName}
    `

    // Last deployment
    const [lastDeploy] = await sql`
      SELECT deployed_at
      FROM deployments
      WHERE agent_name = ${agentName}
      ORDER BY deployed_at DESC
      LIMIT 1
    `

    // Active branches
    const [branchCount] = await sql`
      SELECT COUNT(DISTINCT branch_name) as count
      FROM prompt_versions
      WHERE agent_name = ${agentName}
        AND is_active = true
    `

    // Population size
    const [popSize] = await sql`
      SELECT COUNT(*) as count
      FROM prompt_versions
      WHERE agent_name = ${agentName}
        AND is_active = true
    `

    // Fitness trend (compare last 7 days to previous 7 days)
    const recentFitness = await calculateFitnessTrends(agentName, '7d')
    const olderFitness = await sql`
      SELECT AVG(COALESCE((metadata->>'fitness_score')::float, 0)) as avg_fitness
      FROM trajectories
      WHERE agent_name = ${agentName}
        AND completed_at >= ${subDays(new Date(), 14)}
        AND completed_at < ${subDays(new Date(), 7)}
    `

    const currentAvgFitness =
      recentFitness.length > 0
        ? recentFitness.reduce((sum, f) => sum + f.fitness, 0) /
          recentFitness.length
        : 0
    const previousAvgFitness = Number(olderFitness[0]?.avg_fitness || 0)

    let fitnessTrend: 'up' | 'down' | 'stable' = 'stable'
    if (currentAvgFitness > previousAvgFitness * 1.05) fitnessTrend = 'up'
    else if (currentAvgFitness < previousAvgFitness * 0.95) fitnessTrend = 'down'

    summaries.push({
      name: agentName,
      productionVersion: prodVersion
        ? `v${prodVersion.version_number}`
        : 'N/A',
      fitnessScore: prodVersion?.performance_metrics?.avg_reward || 0,
      fitnessTrend,
      trajectoryCount: Number(trajCount.count),
      lastDeployment: lastDeploy?.deployed_at
        ? new Date(lastDeploy.deployed_at)
        : null,
      activeBranches: Number(branchCount.count),
      populationSize: Number(popSize.count),
    })
  }

  return summaries
}

function getTimeRangeCutoff(timeRange: TimeRange): Date {
  const now = new Date()
  switch (timeRange) {
    case '24h':
      return subHours(now, 24)
    case '7d':
      return subDays(now, 7)
    case '30d':
      return subDays(now, 30)
    case '90d':
      return subDays(now, 90)
    case 'all':
      return new Date(0)
    default:
      return subDays(now, 7)
  }
}
