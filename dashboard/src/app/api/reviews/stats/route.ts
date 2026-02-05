import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const reviewerId = searchParams.get('reviewer_id') || 'default-reviewer'

    // Get total reviews
    const [totalResult] = await sql`
      SELECT COUNT(*) as total
      FROM comparison_feedback
      WHERE reviewer_id = ${reviewerId}
    `

    // Get reviews today
    const [todayResult] = await sql`
      SELECT COUNT(*) as today
      FROM comparison_feedback
      WHERE reviewer_id = ${reviewerId}
        AND DATE(reviewed_at) = CURRENT_DATE
    `

    // Get reviews this week
    const [weekResult] = await sql`
      SELECT COUNT(*) as week
      FROM comparison_feedback
      WHERE reviewer_id = ${reviewerId}
        AND reviewed_at >= DATE_TRUNC('week', CURRENT_DATE)
    `

    // Calculate agreement rate
    // This compares the reviewer's choices with other reviewers on the same pairs
    const [agreementResult] = await sql`
      WITH reviewer_choices AS (
        SELECT
          trajectory_a_id,
          trajectory_b_id,
          preference
        FROM comparison_feedback
        WHERE reviewer_id = ${reviewerId}
      ),
      other_choices AS (
        SELECT
          cf.trajectory_a_id,
          cf.trajectory_b_id,
          cf.preference,
          rc.preference as reviewer_preference
        FROM comparison_feedback cf
        JOIN reviewer_choices rc ON
          (cf.trajectory_a_id = rc.trajectory_a_id AND cf.trajectory_b_id = rc.trajectory_b_id)
          OR (cf.trajectory_a_id = rc.trajectory_b_id AND cf.trajectory_b_id = rc.trajectory_a_id)
        WHERE cf.reviewer_id != ${reviewerId}
      )
      SELECT
        COALESCE(
          AVG(CASE WHEN preference = reviewer_preference THEN 1.0 ELSE 0.0 END),
          0.0
        ) as agreement_rate
      FROM other_choices
    `

    // Calculate streak
    const [streakResult] = await sql`
      WITH daily_reviews AS (
        SELECT DISTINCT DATE(reviewed_at) as review_date
        FROM comparison_feedback
        WHERE reviewer_id = ${reviewerId}
        ORDER BY review_date DESC
      ),
      numbered_dates AS (
        SELECT
          review_date,
          ROW_NUMBER() OVER (ORDER BY review_date DESC) as rn,
          review_date - (ROW_NUMBER() OVER (ORDER BY review_date DESC) || ' days')::INTERVAL as group_date
        FROM daily_reviews
      )
      SELECT COUNT(*) as streak
      FROM numbered_dates
      WHERE group_date = (
        SELECT group_date
        FROM numbered_dates
        WHERE review_date = CURRENT_DATE
        LIMIT 1
      )
    `

    // Calculate average review time (in seconds)
    const [avgTimeResult] = await sql`
      SELECT
        COALESCE(
          AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at))),
          0
        ) as avg_time
      FROM (
        SELECT
          cf.reviewed_at,
          LEAST(t1.started_at, t2.started_at) as created_at
        FROM comparison_feedback cf
        JOIN trajectories t1 ON cf.trajectory_a_id = t1.id
        JOIN trajectories t2 ON cf.trajectory_b_id = t2.id
        WHERE cf.reviewer_id = ${reviewerId}
      ) as review_times
    `

    // Get leaderboard position
    const [positionResult] = await sql`
      WITH reviewer_counts AS (
        SELECT
          reviewer_id,
          COUNT(*) as review_count,
          DENSE_RANK() OVER (ORDER BY COUNT(*) DESC) as position
        FROM comparison_feedback
        GROUP BY reviewer_id
      )
      SELECT COALESCE(position, 0) as position
      FROM reviewer_counts
      WHERE reviewer_id = ${reviewerId}
    `

    const stats = {
      totalReviews: parseInt(totalResult.total, 10),
      reviewsToday: parseInt(todayResult.today, 10),
      reviewsThisWeek: parseInt(weekResult.week, 10),
      agreementRate: parseFloat(agreementResult.agreement_rate),
      currentStreak: parseInt(streakResult?.streak || '0', 10),
      leaderboardPosition: parseInt(positionResult?.position || '0', 10),
      avgReviewTime: Math.round(parseFloat(avgTimeResult.avg_time)),
    }

    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Failed to fetch review stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch review stats' },
      { status: 500 }
    )
  }
}
