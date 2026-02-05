'use client'

import { PromptVersion } from '@/lib/prompts'
import { formatDistanceToNow } from 'date-fns'

// =============================================================================
// TYPES
// =============================================================================

interface VersionTimelineProps {
  versions: PromptVersion[]
  selectedVersionId?: string | null
  productionVersionId?: string | null
  onSelectVersion: (versionId: string) => void
  onApproveVersion?: (versionId: string) => void
  onDeployVersion?: (versionId: string) => void
}

// =============================================================================
// COMPONENT
// =============================================================================

export function VersionTimeline({
  versions,
  selectedVersionId,
  productionVersionId,
  onSelectVersion,
  onApproveVersion,
  onDeployVersion,
}: VersionTimelineProps) {
  if (versions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-gray-500">
        No versions yet. Create your first version to get started.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Version History</h3>

      {/* Timeline */}
      <div className="relative space-y-6">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 h-full w-0.5 bg-gray-200" />

        {versions.map((version, index) => (
          <VersionCard
            key={version.id}
            version={version}
            isSelected={version.id === selectedVersionId}
            isProduction={version.id === productionVersionId}
            isFirst={index === 0}
            isLast={index === versions.length - 1}
            onSelect={() => onSelectVersion(version.id)}
            onApprove={onApproveVersion ? () => onApproveVersion(version.id) : undefined}
            onDeploy={onDeployVersion ? () => onDeployVersion(version.id) : undefined}
          />
        ))}
      </div>
    </div>
  )
}

// =============================================================================
// VERSION CARD
// =============================================================================

function VersionCard({
  version,
  isSelected,
  isProduction,
  isFirst,
  isLast,
  onSelect,
  onApprove,
  onDeploy,
}: {
  version: PromptVersion
  isSelected: boolean
  isProduction: boolean
  isFirst: boolean
  isLast: boolean
  onSelect: () => void
  onApprove?: () => void
  onDeploy?: () => void
}) {
  const statusColor = {
    candidate: 'bg-yellow-100 text-yellow-700',
    approved: 'bg-green-100 text-green-700',
    production: 'bg-blue-100 text-blue-700',
    retired: 'bg-gray-100 text-gray-700',
  }[version.status]

  const winRate = version.fitness.winRate
  const fitnessScore = winRate !== null ? Math.round(winRate * 100) : null

  return (
    <div className="relative flex gap-4">
      {/* Timeline dot */}
      <div className="relative z-10 flex h-12 w-12 flex-shrink-0 items-center justify-center">
        <div
          className={`h-4 w-4 rounded-full ${
            isSelected
              ? 'border-4 border-blue-500 bg-white'
              : isProduction
                ? 'bg-blue-500'
                : 'bg-gray-300'
          }`}
        />
      </div>

      {/* Card */}
      <div
        onClick={onSelect}
        className={`flex-1 cursor-pointer rounded-lg border p-4 transition-all ${
          isSelected
            ? 'border-blue-500 bg-blue-50 shadow-md'
            : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow'
        }`}
      >
        {/* Header */}
        <div className="mb-2 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">v{version.version}</span>
              {isProduction && (
                <span className="rounded bg-blue-500 px-2 py-0.5 text-xs text-white">
                  PRODUCTION
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-gray-500">
              {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-col items-end gap-1">
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${statusColor}`}>
              {version.status}
            </span>
            {fitnessScore !== null && (
              <span className="rounded bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">
                {fitnessScore}% win rate
              </span>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="mb-3 space-y-1 text-sm">
          {version.mutationType && (
            <div className="flex items-center gap-2 text-gray-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <span className="capitalize">{version.mutationType.replace(/_/g, ' ')}</span>
            </div>
          )}

          {version.parentIds.length > 0 && (
            <div className="flex items-center gap-2 text-gray-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
              <span>
                {version.parentIds.length === 1 ? '1 parent' : `${version.parentIds.length} parents (crossover)`}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 text-gray-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span className="capitalize">{version.createdBy}</span>
          </div>
        </div>

        {/* Fitness metrics */}
        {version.fitness.comparisonCount > 0 && (
          <div className="mb-3 rounded bg-gray-50 p-2">
            <div className="grid grid-cols-3 gap-2 text-xs">
              {version.fitness.winRate !== null && (
                <div>
                  <div className="text-gray-500">Win Rate</div>
                  <div className="font-semibold">{Math.round(version.fitness.winRate * 100)}%</div>
                </div>
              )}
              {version.fitness.successRate !== null && (
                <div>
                  <div className="text-gray-500">Success Rate</div>
                  <div className="font-semibold">{Math.round(version.fitness.successRate * 100)}%</div>
                </div>
              )}
              <div>
                <div className="text-gray-500">Comparisons</div>
                <div className="font-semibold">{version.fitness.comparisonCount}</div>
              </div>
            </div>
          </div>
        )}

        {/* Approvals */}
        {version.approvedBy.length > 0 && (
          <div className="mb-3 flex items-center gap-2 text-xs text-gray-600">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>Approved by: {version.approvedBy.join(', ')}</span>
          </div>
        )}

        {/* Actions */}
        {isSelected && (
          <div className="mt-3 flex gap-2 border-t pt-3">
            {version.status === 'candidate' && onApprove && (
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onApprove()
                }}
                className="rounded bg-green-500 px-3 py-1 text-sm text-white hover:bg-green-600"
              >
                Approve
              </button>
            )}
            {(version.status === 'approved' || version.status === 'production') &&
              !isProduction &&
              onDeploy && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onDeploy()
                  }}
                  className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
                >
                  Deploy to Production
                </button>
              )}
          </div>
        )}
      </div>
    </div>
  )
}
