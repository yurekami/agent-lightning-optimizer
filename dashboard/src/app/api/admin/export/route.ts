import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import {
  calculateSystemMetrics,
  calculateReviewerStats,
  calculateAgentSummaries,
} from '@/lib/metrics'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'json'

    // Gather all data
    const [metrics, reviewers, agents] = await Promise.all([
      calculateSystemMetrics('all'),
      calculateReviewerStats(),
      calculateAgentSummaries(),
    ])

    const exportData = {
      exportedAt: new Date().toISOString(),
      systemMetrics: metrics,
      reviewers,
      agents,
    }

    if (format === 'csv') {
      // Convert to CSV format
      const csvLines: string[] = []

      // System Metrics
      csvLines.push('System Metrics')
      csvLines.push('Metric,Value')
      csvLines.push(`Total Trajectories,${metrics.trajectories.total}`)
      csvLines.push(`Total Reviews,${metrics.reviews.total}`)
      csvLines.push(`Active Agents,${metrics.agents}`)
      csvLines.push(`Generations,${metrics.generations}`)
      csvLines.push(`Mutations,${metrics.mutations}`)
      csvLines.push('')

      // Reviewers
      csvLines.push('Reviewers')
      csvLines.push('Name,Email,Role,Review Count,Agreement Rate,Streak,Last Active')
      reviewers.forEach((r) => {
        csvLines.push(
          `${r.name},${r.email},${r.role},${r.reviewCount},${r.agreementRate.toFixed(3)},${r.streak},${r.lastActive ? r.lastActive.toISOString() : 'Never'}`
        )
      })
      csvLines.push('')

      // Agents
      csvLines.push('Agents')
      csvLines.push(
        'Name,Production Version,Fitness Score,Trajectory Count,Active Branches,Last Deployment'
      )
      agents.forEach((a) => {
        csvLines.push(
          `${a.name},${a.productionVersion},${a.fitnessScore.toFixed(3)},${a.trajectoryCount},${a.activeBranches},${a.lastDeployment ? a.lastDeployment.toISOString() : 'Never'}`
        )
      })

      const csv = csvLines.join('\n')
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="admin-export-${new Date().toISOString()}.csv"`,
        },
      })
    } else {
      // JSON format
      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="admin-export-${new Date().toISOString()}.json"`,
        },
      })
    }
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}
