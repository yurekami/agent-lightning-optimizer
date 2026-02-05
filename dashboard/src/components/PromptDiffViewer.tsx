'use client'

import { useState } from 'react'
import { TextDiff, DiffLine, PromptDiff } from '@/lib/diff'

// =============================================================================
// TYPES
// =============================================================================

interface PromptDiffViewerProps {
  diff: PromptDiff
  oldLabel?: string
  newLabel?: string
}

interface TextDiffViewerProps {
  diff: TextDiff
  title?: string
  oldLabel?: string
  newLabel?: string
}

// =============================================================================
// COMPONENTS
// =============================================================================

/**
 * Main prompt diff viewer component
 */
export function PromptDiffViewer({
  diff,
  oldLabel = 'Original',
  newLabel = 'Modified',
}: PromptDiffViewerProps) {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified')
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['systemPrompt'])
  )

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const hasChanges = (textDiff: TextDiff) => {
    return textDiff.type !== 'unchanged'
  }

  const sections = [
    { key: 'systemPrompt', title: 'System Prompt', diff: diff.systemPrompt },
    ...Object.entries(diff.toolDescriptions).map(([key, value]) => ({
      key: `tool-${key}`,
      title: `Tool: ${key}`,
      diff: value,
    })),
    ...(diff.subagentPrompts
      ? Object.entries(diff.subagentPrompts).map(([key, value]) => ({
          key: `subagent-${key}`,
          title: `Subagent: ${key}`,
          diff: value,
        }))
      : []),
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">Prompt Changes</h3>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-green-600">+{diff.summary.additions}</span>
            <span className="text-red-600">-{diff.summary.deletions}</span>
            <span className="text-gray-600">{diff.summary.changes} changes</span>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-2 rounded-lg border p-1">
          <button
            onClick={() => setViewMode('unified')}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              viewMode === 'unified'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Unified
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`rounded px-3 py-1 text-sm transition-colors ${
              viewMode === 'split'
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Split
          </button>
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-2">
        {sections.map((section) => (
          <div key={section.key} className="overflow-hidden rounded-lg border">
            {/* Section header */}
            <button
              onClick={() => toggleSection(section.key)}
              className="flex w-full items-center justify-between bg-gray-50 px-4 py-2 text-left hover:bg-gray-100"
            >
              <div className="flex items-center gap-2">
                <svg
                  className={`h-4 w-4 transition-transform ${
                    expandedSections.has(section.key) ? 'rotate-90' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <span className="font-medium">{section.title}</span>
                {hasChanges(section.diff) && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                    Modified
                  </span>
                )}
              </div>
            </button>

            {/* Section content */}
            {expandedSections.has(section.key) && (
              <div className="border-t">
                <TextDiffViewer
                  diff={section.diff}
                  oldLabel={oldLabel}
                  newLabel={newLabel}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Text diff viewer for a single text field
 */
function TextDiffViewer({ diff, oldLabel, newLabel }: TextDiffViewerProps) {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified')

  if (diff.type === 'unchanged') {
    return (
      <div className="p-4 text-sm text-gray-500">
        No changes
      </div>
    )
  }

  if (diff.type === 'added') {
    return (
      <div className="space-y-2 p-4">
        <div className="text-sm font-medium text-green-700">Added</div>
        <pre className="rounded bg-green-50 p-3 text-sm">
          <code>{diff.modified}</code>
        </pre>
      </div>
    )
  }

  if (diff.type === 'removed') {
    return (
      <div className="space-y-2 p-4">
        <div className="text-sm font-medium text-red-700">Removed</div>
        <pre className="rounded bg-red-50 p-3 text-sm">
          <code>{diff.original}</code>
        </pre>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      {viewMode === 'unified' ? (
        <UnifiedDiffView diff={diff} />
      ) : (
        <SplitDiffView diff={diff} oldLabel={oldLabel} newLabel={newLabel} />
      )}
    </div>
  )
}

/**
 * Unified diff view (like git diff)
 */
function UnifiedDiffView({ diff }: { diff: TextDiff }) {
  return (
    <div className="font-mono text-xs">
      {diff.hunks.map((hunk, hunkIndex) => (
        <div key={hunkIndex} className="border-b last:border-b-0">
          {/* Hunk header */}
          <div className="bg-blue-50 px-4 py-1 text-blue-700">
            @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
          </div>

          {/* Hunk lines */}
          {hunk.lines.map((line, lineIndex) => (
            <DiffLineView key={lineIndex} line={line} />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * Split diff view (side by side)
 */
function SplitDiffView({
  diff,
  oldLabel,
  newLabel,
}: {
  diff: TextDiff
  oldLabel?: string
  newLabel?: string
}) {
  return (
    <div className="grid grid-cols-2 gap-px bg-gray-200">
      {/* Headers */}
      <div className="bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
        {oldLabel || 'Original'}
      </div>
      <div className="bg-green-50 px-4 py-2 text-sm font-medium text-green-700">
        {newLabel || 'Modified'}
      </div>

      {/* Content */}
      {diff.hunks.map((hunk, hunkIndex) => (
        <div key={hunkIndex} className="col-span-2 grid grid-cols-2 gap-px">
          {hunk.lines.map((line, lineIndex) => (
            <SplitDiffLineView key={lineIndex} line={line} />
          ))}
        </div>
      ))}
    </div>
  )
}

/**
 * Single line in unified view
 */
function DiffLineView({ line }: { line: DiffLine }) {
  const bgColor =
    line.type === 'add'
      ? 'bg-green-50'
      : line.type === 'delete'
        ? 'bg-red-50'
        : 'bg-white'

  const textColor =
    line.type === 'add'
      ? 'text-green-700'
      : line.type === 'delete'
        ? 'text-red-700'
        : 'text-gray-700'

  const prefix = line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '

  return (
    <div className={`flex ${bgColor} ${textColor}`}>
      <div className="w-12 select-none px-2 py-0.5 text-right text-gray-400">
        {line.oldLineNumber || line.newLineNumber || ''}
      </div>
      <div className="w-6 select-none px-1 py-0.5">{prefix}</div>
      <div className="flex-1 py-0.5 pr-4">
        <code>{line.content}</code>
      </div>
    </div>
  )
}

/**
 * Single line in split view
 */
function SplitDiffLineView({ line }: { line: DiffLine }) {
  if (line.type === 'context') {
    return (
      <>
        <div className="flex bg-white">
          <div className="w-10 select-none px-2 py-0.5 text-right text-xs text-gray-400">
            {line.oldLineNumber}
          </div>
          <div className="flex-1 py-0.5 pr-4">
            <code className="text-xs text-gray-700">{line.content}</code>
          </div>
        </div>
        <div className="flex bg-white">
          <div className="w-10 select-none px-2 py-0.5 text-right text-xs text-gray-400">
            {line.newLineNumber}
          </div>
          <div className="flex-1 py-0.5 pr-4">
            <code className="text-xs text-gray-700">{line.content}</code>
          </div>
        </div>
      </>
    )
  }

  if (line.type === 'delete') {
    return (
      <>
        <div className="flex bg-red-50">
          <div className="w-10 select-none px-2 py-0.5 text-right text-xs text-gray-400">
            {line.oldLineNumber}
          </div>
          <div className="flex-1 py-0.5 pr-4">
            <code className="text-xs text-red-700">{line.content}</code>
          </div>
        </div>
        <div className="bg-gray-100" />
      </>
    )
  }

  if (line.type === 'add') {
    return (
      <>
        <div className="bg-gray-100" />
        <div className="flex bg-green-50">
          <div className="w-10 select-none px-2 py-0.5 text-right text-xs text-gray-400">
            {line.newLineNumber}
          </div>
          <div className="flex-1 py-0.5 pr-4">
            <code className="text-xs text-green-700">{line.content}</code>
          </div>
        </div>
      </>
    )
  }

  return null
}
