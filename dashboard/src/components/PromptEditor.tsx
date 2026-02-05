'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PromptVersion } from '@/types'

interface PromptEditorProps {
  initialVersion?: PromptVersion
  onSave: (version: Partial<PromptVersion>) => void
}

export function PromptEditor({ initialVersion, onSave }: PromptEditorProps) {
  const [agentName, setAgentName] = useState(initialVersion?.agent_name || '')
  const [promptTemplate, setPromptTemplate] = useState(
    initialVersion?.prompt_template || ''
  )
  const [branchName, setBranchName] = useState(
    initialVersion?.branch_name || 'main'
  )

  const handleSave = () => {
    onSave({
      agent_name: agentName,
      prompt_template: promptTemplate,
      branch_name: branchName,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {initialVersion ? 'Edit Prompt Version' : 'Create Prompt Version'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Agent Name */}
        <div>
          <label className="text-sm font-medium">Agent Name</label>
          <Input
            value={agentName}
            onChange={(e) => setAgentName(e.target.value)}
            placeholder="e.g., executor, architect"
            className="mt-2"
          />
        </div>

        {/* Branch Name */}
        <div>
          <label className="text-sm font-medium">Branch</label>
          <Input
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            placeholder="main"
            className="mt-2"
          />
        </div>

        {/* Prompt Template */}
        <div>
          <label className="text-sm font-medium">Prompt Template</label>
          <textarea
            value={promptTemplate}
            onChange={(e) => setPromptTemplate(e.target.value)}
            placeholder="Enter your prompt template here..."
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
            rows={12}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Use variables like {'{input}'}, {'{context}'} in your template
          </p>
        </div>

        {/* Performance Metrics (if editing) */}
        {initialVersion?.performance_metrics && (
          <div className="rounded-md border border-border p-4">
            <h4 className="mb-2 text-sm font-semibold">Performance Metrics</h4>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Reward</span>
                <span className="font-medium">
                  {initialVersion.performance_metrics.avg_reward.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Success Rate</span>
                <span className="font-medium">
                  {(initialVersion.performance_metrics.success_rate * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Steps</span>
                <span className="font-medium">
                  {initialVersion.performance_metrics.avg_steps.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Runs</span>
                <span className="font-medium">
                  {initialVersion.performance_metrics.total_runs}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleSave}>
            {initialVersion ? 'Save Changes' : 'Create Version'}
          </Button>
          <Button variant="outline">Cancel</Button>
        </div>
      </CardContent>
    </Card>
  )
}
