'use client'

import { useState } from 'react'
import { Branch } from '@/lib/prompts'

// =============================================================================
// TYPES
// =============================================================================

interface BranchManagerProps {
  agentId: string
  branches: Branch[]
  currentBranchId: string | null
  onBranchChange: (branchId: string) => void
  onCreateBranch: (name: string, parentBranchId?: string) => Promise<void>
  onDeleteBranch: (branchId: string) => Promise<void>
  onMergeBranch: (sourceBranchId: string, targetBranchId: string) => Promise<void>
}

interface BranchNode {
  branch: Branch
  children: BranchNode[]
  depth: number
}

// =============================================================================
// COMPONENT
// =============================================================================

export function BranchManager({
  agentId,
  branches,
  currentBranchId,
  onBranchChange,
  onCreateBranch,
  onDeleteBranch,
  onMergeBranch,
}: BranchManagerProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showMergeDialog, setShowMergeDialog] = useState(false)
  const [selectedSourceBranch, setSelectedSourceBranch] = useState<string | null>(null)
  const [selectedTargetBranch, setSelectedTargetBranch] = useState<string | null>(null)
  const [newBranchName, setNewBranchName] = useState('')
  const [parentBranchId, setParentBranchId] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Build branch tree
  const branchTree = buildBranchTree(branches)
  const currentBranch = branches.find((b) => b.id === currentBranchId)
  const mainBranch = branches.find((b) => b.isMain)

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) {
      setError('Branch name is required')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onCreateBranch(newBranchName, parentBranchId || undefined)
      setShowCreateDialog(false)
      setNewBranchName('')
      setParentBranchId(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBranch = async (branchId: string) => {
    if (!confirm('Are you sure you want to delete this branch?')) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onDeleteBranch(branchId)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleMergeBranch = async () => {
    if (!selectedSourceBranch || !selectedTargetBranch) {
      setError('Please select both source and target branches')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await onMergeBranch(selectedSourceBranch, selectedTargetBranch)
      setShowMergeDialog(false)
      setSelectedSourceBranch(null)
      setSelectedTargetBranch(null)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Branches</h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMergeDialog(true)}
            className="rounded bg-purple-500 px-3 py-1 text-sm text-white hover:bg-purple-600 disabled:bg-gray-300"
            disabled={branches.length < 2}
          >
            Merge
          </button>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="rounded bg-blue-500 px-3 py-1 text-sm text-white hover:bg-blue-600"
          >
            + New Branch
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Current branch selector */}
      <div className="rounded-lg border p-4">
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Current Branch
        </label>
        <select
          value={currentBranchId || ''}
          onChange={(e) => onBranchChange(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
        >
          {branches.map((branch) => (
            <option key={branch.id} value={branch.id}>
              {branch.name} {branch.isMain ? '(main)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Branch tree visualization */}
      <div className="rounded-lg border p-4">
        <div className="mb-2 text-sm font-medium text-gray-700">Branch Tree</div>
        <div className="space-y-1">
          {branchTree.map((node) => (
            <BranchTreeNode
              key={node.branch.id}
              node={node}
              currentBranchId={currentBranchId}
              onSelect={onBranchChange}
              onDelete={handleDeleteBranch}
            />
          ))}
        </div>
      </div>

      {/* Create branch dialog */}
      {showCreateDialog && (
        <Dialog onClose={() => setShowCreateDialog(false)}>
          <h3 className="mb-4 text-lg font-semibold">Create New Branch</h3>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Branch Name
              </label>
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="feature/new-improvement"
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Branch From
              </label>
              <select
                value={parentBranchId || ''}
                onChange={(e) => setParentBranchId(e.target.value || null)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select parent branch...</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name} {branch.isMain ? '(main)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => setShowCreateDialog(false)}
              className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleCreateBranch}
              className="rounded bg-blue-500 px-4 py-2 text-sm text-white hover:bg-blue-600 disabled:bg-gray-300"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Branch'}
            </button>
          </div>
        </Dialog>
      )}

      {/* Merge dialog */}
      {showMergeDialog && (
        <Dialog onClose={() => setShowMergeDialog(false)}>
          <h3 className="mb-4 text-lg font-semibold">Merge Branches</h3>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Source Branch (merge from)
              </label>
              <select
                value={selectedSourceBranch || ''}
                onChange={(e) => setSelectedSourceBranch(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select source branch...</option>
                {branches
                  .filter((b) => b.id !== selectedTargetBranch)
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} {branch.isMain ? '(main)' : ''}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Target Branch (merge into)
              </label>
              <select
                value={selectedTargetBranch || ''}
                onChange={(e) => setSelectedTargetBranch(e.target.value)}
                className="w-full rounded border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none"
              >
                <option value="">Select target branch...</option>
                {branches
                  .filter((b) => b.id !== selectedSourceBranch)
                  .map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name} {branch.isMain ? '(main)' : ''}
                    </option>
                  ))}
              </select>
            </div>

            {selectedSourceBranch && selectedTargetBranch && (
              <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                This will merge {branches.find((b) => b.id === selectedSourceBranch)?.name} into{' '}
                {branches.find((b) => b.id === selectedTargetBranch)?.name}
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <button
              onClick={() => setShowMergeDialog(false)}
              className="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleMergeBranch}
              className="rounded bg-purple-500 px-4 py-2 text-sm text-white hover:bg-purple-600 disabled:bg-gray-300"
              disabled={loading || !selectedSourceBranch || !selectedTargetBranch}
            >
              {loading ? 'Merging...' : 'Merge Branches'}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function BranchTreeNode({
  node,
  currentBranchId,
  onSelect,
  onDelete,
}: {
  node: BranchNode
  currentBranchId: string | null
  onSelect: (branchId: string) => void
  onDelete: (branchId: string) => void
}) {
  const isCurrent = node.branch.id === currentBranchId
  const indent = node.depth * 24

  return (
    <div>
      <div
        className={`flex items-center gap-2 rounded px-2 py-1 ${
          isCurrent ? 'bg-blue-100' : 'hover:bg-gray-50'
        }`}
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        {node.depth > 0 && (
          <span className="text-gray-400">└─</span>
        )}
        <button
          onClick={() => onSelect(node.branch.id)}
          className="flex-1 text-left text-sm"
        >
          <span className={isCurrent ? 'font-medium text-blue-700' : 'text-gray-700'}>
            {node.branch.name}
          </span>
          {node.branch.isMain && (
            <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
              main
            </span>
          )}
        </button>
        {!node.branch.isMain && (
          <button
            onClick={() => onDelete(node.branch.id)}
            className="text-red-500 hover:text-red-700"
            title="Delete branch"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </div>
      {node.children.map((child) => (
        <BranchTreeNode
          key={child.branch.id}
          node={child}
          currentBranchId={currentBranchId}
          onSelect={onSelect}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

function Dialog({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        {children}
      </div>
    </div>
  )
}

// =============================================================================
// UTILITIES
// =============================================================================

function buildBranchTree(branches: Branch[]): BranchNode[] {
  const branchMap = new Map<string, BranchNode>()

  // Create nodes
  for (const branch of branches) {
    branchMap.set(branch.id, {
      branch,
      children: [],
      depth: 0,
    })
  }

  // Build tree
  const roots: BranchNode[] = []
  for (const node of branchMap.values()) {
    if (node.branch.parentBranchId) {
      const parent = branchMap.get(node.branch.parentBranchId)
      if (parent) {
        parent.children.push(node)
        node.depth = parent.depth + 1
      } else {
        roots.push(node)
      }
    } else {
      roots.push(node)
    }
  }

  // Sort: main branch first, then by creation date
  roots.sort((a, b) => {
    if (a.branch.isMain) return -1
    if (b.branch.isMain) return 1
    return a.branch.createdAt.getTime() - b.branch.createdAt.getTime()
  })

  return roots
}
