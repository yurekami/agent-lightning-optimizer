'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Branch,
  PromptVersion,
  LineageNode,
  getMainBranch,
  listBranches,
  listVersions,
  getLatestVersion,
  getProductionVersion,
  getLineage,
  createBranch,
  deleteBranch,
  mergeBranch,
  approveVersion,
  deployVersion,
  getVersion,
} from '@/lib/prompts'
import { diffPromptContent, PromptDiff } from '@/lib/diff'
import { BranchManager } from '@/components/BranchManager'
import { VersionTimeline } from '@/components/VersionTimeline'
import { PromptDiffViewer } from '@/components/PromptDiffViewer'
import { LineageGraph } from '@/components/LineageGraph'

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default function PromptManagementPage() {
  const params = useParams()
  const router = useRouter()
  const agentId = params.agentId as string

  // State
  const [branches, setBranches] = useState<Branch[]>([])
  const [currentBranch, setCurrentBranch] = useState<Branch | null>(null)
  const [versions, setVersions] = useState<PromptVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<PromptVersion | null>(null)
  const [productionVersion, setProductionVersion] = useState<PromptVersion | null>(null)
  const [lineage, setLineage] = useState<LineageNode[]>([])
  const [diffToProduction, setDiffToProduction] = useState<PromptDiff | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'timeline' | 'lineage' | 'diff'>('timeline')

  // Load initial data
  useEffect(() => {
    loadData()
  }, [agentId])

  async function loadData() {
    try {
      setLoading(true)
      setError(null)

      // Load branches
      const branchList = await listBranches(agentId)
      setBranches(branchList)

      // Get main branch
      const main = await getMainBranch(agentId)
      setCurrentBranch(main)

      // Load versions for main branch
      await loadVersionsForBranch(main.id)

      // Load production version
      const prod = await getProductionVersion(agentId)
      setProductionVersion(prod)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  async function loadVersionsForBranch(branchId: string) {
    try {
      const versionList = await listVersions(branchId)
      setVersions(versionList)

      if (versionList.length > 0) {
        const latest = versionList[0]
        setSelectedVersion(latest)
        await loadVersionDetails(latest.id)
      }
    } catch (err) {
      setError((err as Error).message)
    }
  }

  async function loadVersionDetails(versionId: string) {
    try {
      // Load lineage
      const lineageData = await getLineage(versionId)
      setLineage(lineageData)

      // Load diff to production
      if (productionVersion) {
        const version = await getVersion(versionId)
        const diff = diffPromptContent(productionVersion.content, version.content)
        setDiffToProduction(diff)
      }
    } catch (err) {
      console.error('Failed to load version details:', err)
    }
  }

  // Handlers
  async function handleBranchChange(branchId: string) {
    const branch = branches.find((b) => b.id === branchId)
    if (branch) {
      setCurrentBranch(branch)
      await loadVersionsForBranch(branchId)
    }
  }

  async function handleCreateBranch(name: string, parentBranchId?: string) {
    await createBranch(agentId, name, parentBranchId)
    await loadData()
  }

  async function handleDeleteBranch(branchId: string) {
    await deleteBranch(branchId)
    await loadData()
  }

  async function handleMergeBranch(sourceBranchId: string, targetBranchId: string) {
    // TODO: Get reviewer ID from auth
    const reviewerId = 'test-reviewer@example.com'
    await mergeBranch(sourceBranchId, targetBranchId, reviewerId)
    await loadData()
  }

  async function handleSelectVersion(versionId: string) {
    const version = await getVersion(versionId)
    setSelectedVersion(version)
    await loadVersionDetails(versionId)
  }

  async function handleApproveVersion(versionId: string) {
    // TODO: Get reviewer email from auth
    const reviewerEmail = 'test-reviewer@example.com'
    await approveVersion(versionId, reviewerEmail)
    await loadData()
  }

  async function handleDeployVersion(versionId: string) {
    if (!confirm('Are you sure you want to deploy this version to production?')) {
      return
    }

    // TODO: Get reviewer ID from auth
    const reviewerId = 'test-reviewer-id'
    await deployVersion(versionId, reviewerId)
    await loadData()
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="rounded-lg bg-red-50 p-4 text-red-700">{error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Prompt Management</h1>
            <p className="mt-1 text-gray-600">Agent: {agentId}</p>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="rounded border px-4 py-2 hover:bg-gray-100"
          >
            Back to Dashboard
          </button>
        </div>

        {/* Production version info */}
        {productionVersion && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-blue-900">
                  Current Production Version: v{productionVersion.version}
                </h3>
                <p className="text-sm text-blue-700">
                  {productionVersion.fitness.winRate !== null &&
                    `Win Rate: ${Math.round(productionVersion.fitness.winRate * 100)}%`}
                </p>
              </div>
              <span className="rounded bg-blue-500 px-3 py-1 text-sm text-white">
                PRODUCTION
              </span>
            </div>
          </div>
        )}

        {/* Main content grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left sidebar - Branch manager */}
          <div className="rounded-lg border bg-white p-6">
            <BranchManager
              agentId={agentId}
              branches={branches}
              currentBranchId={currentBranch?.id || null}
              onBranchChange={handleBranchChange}
              onCreateBranch={handleCreateBranch}
              onDeleteBranch={handleDeleteBranch}
              onMergeBranch={handleMergeBranch}
            />
          </div>

          {/* Main content area */}
          <div className="space-y-6 lg:col-span-2">
            {/* Tab navigation */}
            <div className="flex gap-2 border-b">
              <button
                onClick={() => setActiveTab('timeline')}
                className={`px-4 py-2 ${
                  activeTab === 'timeline'
                    ? 'border-b-2 border-blue-500 font-semibold text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Timeline
              </button>
              <button
                onClick={() => setActiveTab('lineage')}
                className={`px-4 py-2 ${
                  activeTab === 'lineage'
                    ? 'border-b-2 border-blue-500 font-semibold text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Lineage
              </button>
              <button
                onClick={() => setActiveTab('diff')}
                className={`px-4 py-2 ${
                  activeTab === 'diff'
                    ? 'border-b-2 border-blue-500 font-semibold text-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Diff to Production
              </button>
            </div>

            {/* Tab content */}
            <div className="rounded-lg border bg-white p-6">
              {activeTab === 'timeline' && (
                <VersionTimeline
                  versions={versions}
                  selectedVersionId={selectedVersion?.id}
                  productionVersionId={productionVersion?.id}
                  onSelectVersion={handleSelectVersion}
                  onApproveVersion={handleApproveVersion}
                  onDeployVersion={handleDeployVersion}
                />
              )}

              {activeTab === 'lineage' && lineage.length > 0 && (
                <LineageGraph
                  lineage={lineage}
                  selectedVersionId={selectedVersion?.id}
                  productionVersionId={productionVersion?.id}
                  onSelectVersion={handleSelectVersion}
                />
              )}

              {activeTab === 'diff' && diffToProduction && (
                <PromptDiffViewer
                  diff={diffToProduction}
                  oldLabel={`Production (v${productionVersion?.version})`}
                  newLabel={`v${selectedVersion?.version}`}
                />
              )}

              {activeTab === 'diff' && !diffToProduction && (
                <div className="text-center text-gray-500">
                  {!productionVersion
                    ? 'No production version to compare against'
                    : 'Select a version to see the diff'}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Selected version details */}
        {selectedVersion && (
          <div className="rounded-lg border bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold">Version Details</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="text-sm text-gray-600">Version</div>
                <div className="font-semibold">v{selectedVersion.version}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Status</div>
                <div className="capitalize">{selectedVersion.status}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Created</div>
                <div>{new Date(selectedVersion.createdAt).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Created By</div>
                <div className="capitalize">{selectedVersion.createdBy}</div>
              </div>
              {selectedVersion.mutationType && (
                <div>
                  <div className="text-sm text-gray-600">Mutation Type</div>
                  <div className="capitalize">
                    {selectedVersion.mutationType.replace(/_/g, ' ')}
                  </div>
                </div>
              )}
              <div>
                <div className="text-sm text-gray-600">Comparisons</div>
                <div>{selectedVersion.fitness.comparisonCount}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
