import { PromptContent } from './prompts'

// =============================================================================
// TYPES
// =============================================================================

export interface PromptDiff {
  systemPrompt: TextDiff
  toolDescriptions: Record<string, TextDiff>
  subagentPrompts?: Record<string, TextDiff>
  summary: {
    additions: number
    deletions: number
    changes: number
  }
}

export interface TextDiff {
  type: 'unchanged' | 'added' | 'removed' | 'modified'
  hunks: DiffHunk[]
  original?: string
  modified?: string
}

export interface DiffHunk {
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  lines: DiffLine[]
}

export interface DiffLine {
  type: 'context' | 'add' | 'delete'
  content: string
  oldLineNumber?: number
  newLineNumber?: number
}

// =============================================================================
// DIFF ALGORITHM
// =============================================================================

/**
 * Compute the longest common subsequence (LCS) using dynamic programming
 */
function computeLCS(a: string[], b: string[]): number[][] {
  const m = a.length
  const n = b.length
  const lcs: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0))

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        lcs[i][j] = lcs[i - 1][j - 1] + 1
      } else {
        lcs[i][j] = Math.max(lcs[i - 1][j], lcs[i][j - 1])
      }
    }
  }

  return lcs
}

/**
 * Generate diff lines from LCS table
 */
function generateDiffLines(
  oldLines: string[],
  newLines: string[],
  lcs: number[][]
): DiffLine[] {
  const result: DiffLine[] = []
  let i = oldLines.length
  let j = newLines.length
  let oldLineNum = oldLines.length
  let newLineNum = newLines.length

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      // Context line (unchanged)
      result.unshift({
        type: 'context',
        content: oldLines[i - 1],
        oldLineNumber: oldLineNum,
        newLineNumber: newLineNum,
      })
      i--
      j--
      oldLineNum--
      newLineNum--
    } else if (j > 0 && (i === 0 || lcs[i][j - 1] >= lcs[i - 1][j])) {
      // Addition
      result.unshift({
        type: 'add',
        content: newLines[j - 1],
        newLineNumber: newLineNum,
      })
      j--
      newLineNum--
    } else if (i > 0) {
      // Deletion
      result.unshift({
        type: 'delete',
        content: oldLines[i - 1],
        oldLineNumber: oldLineNum,
      })
      i--
      oldLineNum--
    }
  }

  return result
}

/**
 * Group diff lines into hunks with context
 */
function groupIntoHunks(lines: DiffLine[], context: number = 3): DiffHunk[] {
  const hunks: DiffHunk[] = []
  let currentHunk: DiffLine[] = []
  let lastChangeIndex = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isChange = line.type === 'add' || line.type === 'delete'

    if (isChange) {
      // Include context before the change
      const contextStart = Math.max(0, lastChangeIndex + 1, i - context)
      for (let j = currentHunk.length === 0 ? contextStart : i; j < i; j++) {
        currentHunk.push(lines[j])
      }
      currentHunk.push(line)
      lastChangeIndex = i
    } else if (lastChangeIndex >= 0 && i - lastChangeIndex <= context) {
      // Include context after the change
      currentHunk.push(line)
    } else if (currentHunk.length > 0) {
      // End of hunk
      hunks.push(createHunk(currentHunk))
      currentHunk = []
      lastChangeIndex = -1
    }
  }

  if (currentHunk.length > 0) {
    hunks.push(createHunk(currentHunk))
  }

  return hunks
}

/**
 * Create a hunk from a group of lines
 */
function createHunk(lines: DiffLine[]): DiffHunk {
  const oldStart = lines.find((l) => l.oldLineNumber)?.oldLineNumber || 1
  const newStart = lines.find((l) => l.newLineNumber)?.newLineNumber || 1

  const oldLines = lines.filter((l) => l.type !== 'add').length
  const newLines = lines.filter((l) => l.type !== 'delete').length

  return {
    oldStart,
    oldLines,
    newStart,
    newLines,
    lines,
  }
}

/**
 * Diff two text strings
 */
export function diffText(a: string, b: string): TextDiff {
  // Handle identical texts
  if (a === b) {
    return {
      type: 'unchanged',
      hunks: [],
      original: a,
      modified: b,
    }
  }

  // Handle one being empty
  if (!a && b) {
    return {
      type: 'added',
      hunks: [],
      original: a,
      modified: b,
    }
  }

  if (a && !b) {
    return {
      type: 'removed',
      hunks: [],
      original: a,
      modified: b,
    }
  }

  // Split into lines
  const oldLines = a.split('\n')
  const newLines = b.split('\n')

  // Compute LCS
  const lcs = computeLCS(oldLines, newLines)

  // Generate diff lines
  const diffLines = generateDiffLines(oldLines, newLines, lcs)

  // Group into hunks
  const hunks = groupIntoHunks(diffLines)

  return {
    type: 'modified',
    hunks,
    original: a,
    modified: b,
  }
}

/**
 * Diff two prompt contents
 */
export function diffPromptContent(a: PromptContent, b: PromptContent): PromptDiff {
  // Diff system prompt
  const systemPrompt = diffText(a.systemPrompt, b.systemPrompt)

  // Diff tool descriptions
  const allToolKeys = new Set([
    ...Object.keys(a.toolDescriptions || {}),
    ...Object.keys(b.toolDescriptions || {}),
  ])

  const toolDescriptions: Record<string, TextDiff> = {}
  for (const key of allToolKeys) {
    const oldTool = a.toolDescriptions?.[key] || ''
    const newTool = b.toolDescriptions?.[key] || ''
    toolDescriptions[key] = diffText(oldTool, newTool)
  }

  // Diff subagent prompts (if present)
  let subagentPrompts: Record<string, TextDiff> | undefined
  if (a.subagentPrompts || b.subagentPrompts) {
    const allSubagentKeys = new Set([
      ...Object.keys(a.subagentPrompts || {}),
      ...Object.keys(b.subagentPrompts || {}),
    ])

    subagentPrompts = {}
    for (const key of allSubagentKeys) {
      const oldSubagent = a.subagentPrompts?.[key] || ''
      const newSubagent = b.subagentPrompts?.[key] || ''
      subagentPrompts[key] = diffText(oldSubagent, newSubagent)
    }
  }

  // Compute summary
  const summary = computeSummary({ systemPrompt, toolDescriptions, subagentPrompts })

  return {
    systemPrompt,
    toolDescriptions,
    subagentPrompts,
    summary,
  }
}

/**
 * Compute summary statistics for a diff
 */
function computeSummary(diff: Omit<PromptDiff, 'summary'>): PromptDiff['summary'] {
  let additions = 0
  let deletions = 0
  let changes = 0

  const countDiff = (textDiff: TextDiff) => {
    if (textDiff.type === 'added') {
      changes++
      additions += (textDiff.modified || '').split('\n').length
    } else if (textDiff.type === 'removed') {
      changes++
      deletions += (textDiff.original || '').split('\n').length
    } else if (textDiff.type === 'modified') {
      changes++
      for (const hunk of textDiff.hunks) {
        for (const line of hunk.lines) {
          if (line.type === 'add') additions++
          if (line.type === 'delete') deletions++
        }
      }
    }
  }

  countDiff(diff.systemPrompt)

  for (const toolDiff of Object.values(diff.toolDescriptions)) {
    countDiff(toolDiff)
  }

  if (diff.subagentPrompts) {
    for (const subagentDiff of Object.values(diff.subagentPrompts)) {
      countDiff(subagentDiff)
    }
  }

  return { additions, deletions, changes }
}

/**
 * Apply a unified diff patch to text (for future use)
 */
export function applyPatch(original: string, hunks: DiffHunk[]): string {
  const lines = original.split('\n')
  const result: string[] = []
  let originalIndex = 0

  for (const hunk of hunks) {
    // Add lines before hunk
    while (originalIndex < hunk.oldStart - 1) {
      result.push(lines[originalIndex])
      originalIndex++
    }

    // Apply hunk
    for (const line of hunk.lines) {
      if (line.type === 'context' || line.type === 'delete') {
        originalIndex++
      }
      if (line.type === 'context' || line.type === 'add') {
        result.push(line.content)
      }
    }
  }

  // Add remaining lines
  while (originalIndex < lines.length) {
    result.push(lines[originalIndex])
    originalIndex++
  }

  return result.join('\n')
}

/**
 * Format diff as unified diff string (for export/debugging)
 */
export function formatUnifiedDiff(
  oldPath: string,
  newPath: string,
  diff: TextDiff
): string {
  if (diff.type === 'unchanged') {
    return ''
  }

  const lines: string[] = []
  lines.push(`--- ${oldPath}`)
  lines.push(`+++ ${newPath}`)

  for (const hunk of diff.hunks) {
    lines.push(
      `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`
    )

    for (const line of hunk.lines) {
      const prefix = line.type === 'add' ? '+' : line.type === 'delete' ? '-' : ' '
      lines.push(prefix + line.content)
    }
  }

  return lines.join('\n')
}

/**
 * Get diff statistics
 */
export function getDiffStats(diff: TextDiff): {
  additions: number
  deletions: number
  unchanged: number
} {
  let additions = 0
  let deletions = 0
  let unchanged = 0

  for (const hunk of diff.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'add') additions++
      else if (line.type === 'delete') deletions++
      else unchanged++
    }
  }

  return { additions, deletions, unchanged }
}
