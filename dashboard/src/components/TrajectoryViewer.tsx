'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Collapsible } from '@/components/ui/collapsible'
import { SyntaxHighlighter } from '@/components/ui/syntax-highlighter'
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation'
import { Trajectory, TrajectoryStep, ToolCall } from '@/types'
import { formatDate, formatDuration, cn } from '@/lib/utils'
import {
  Brain,
  Wrench,
  Clock,
  Hash,
  Zap,
  CheckCircle2,
  XCircle,
  Circle,
  Sparkles,
  Terminal,
  AlertCircle,
} from 'lucide-react'

interface TrajectoryViewerProps {
  trajectory: Trajectory
  highlightStepIndex?: number
  onStepSelect?: (index: number) => void
  className?: string
}

export function TrajectoryViewer({
  trajectory,
  highlightStepIndex,
  onStepSelect,
  className,
}: TrajectoryViewerProps) {
  const {
    selectedIndex,
    expandedIndices,
    toggleExpanded,
    expandAll,
    collapseAll,
    isExpanded,
    isSelected,
  } = useKeyboardNavigation({
    itemCount: trajectory.steps.length,
    onSelect: (index) => {
      toggleExpanded(index)
      onStepSelect?.(index)
    },
    onExpand: (index) => onStepSelect?.(index),
  })

  const metrics = useMemo(() => calculateMetrics(trajectory), [trajectory])

  return (
    <Card className={cn('trajectory-viewer font-sans', className)}>
      <CardHeader className="border-b border-border bg-muted/30">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <CardTitle className="font-mono text-lg tracking-tight flex items-center gap-2">
              <Terminal className="h-5 w-5 text-primary" />
              {trajectory.id}
            </CardTitle>
            <div className="flex items-center gap-4 text-sm text-muted-foreground font-mono">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" />
                {trajectory.agent_name}
              </span>
              <span className="text-border">|</span>
              <span>v{trajectory.prompt_version_id}</span>
            </div>
          </div>
          <Badge
            variant={
              trajectory.status === 'completed'
                ? 'completed'
                : trajectory.status === 'failed'
                ? 'failed'
                : 'running'
            }
            size="lg"
          >
            {trajectory.status}
          </Badge>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
          <MetricCard
            icon={<Hash className="h-4 w-4" />}
            label="Total Steps"
            value={metrics.totalSteps}
          />
          <MetricCard
            icon={<Zap className="h-4 w-4" />}
            label="Total Tokens"
            value={metrics.totalTokens.toLocaleString()}
          />
          <MetricCard
            icon={<Clock className="h-4 w-4" />}
            label="Duration"
            value={metrics.duration}
          />
          <MetricCard
            icon={trajectory.status === 'completed' ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
            label="Status"
            value={trajectory.status === 'completed' ? 'Success' : 'In Progress'}
          />
        </div>

        {/* Timeline controls */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <div className="text-xs font-mono text-muted-foreground">
            <kbd className="px-2 py-1 bg-muted border border-border rounded">↑↓</kbd> Navigate
            <span className="mx-2 text-border">|</span>
            <kbd className="px-2 py-1 bg-muted border border-border rounded">Enter</kbd> Expand
            <span className="mx-2 text-border">|</span>
            <kbd className="px-2 py-1 bg-muted border border-border rounded">Esc</kbd> Collapse All
          </div>
          <div className="flex gap-2">
            <button
              onClick={expandAll}
              className="text-xs font-mono text-primary hover:text-primary/80 transition-colors px-2 py-1 border border-primary/30 rounded hover:bg-primary/10"
            >
              Expand All
            </button>
            <button
              onClick={collapseAll}
              className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors px-2 py-1 border border-border rounded hover:bg-muted"
            >
              Collapse All
            </button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Execution Steps Timeline */}
        <div className="divide-y divide-border">
          {trajectory.steps.map((step, index) => {
            const isHighlighted = highlightStepIndex === index
            const hasTools = step.tool_calls.length > 0
            const stepDuration = calculateStepDuration(step)

            return (
              <Collapsible
                key={step.id}
                open={isExpanded(index)}
                onOpenChange={() => toggleExpanded(index)}
                className={cn(
                  'transition-all border-l-4',
                  isSelected(index) && 'bg-primary/5 border-l-primary',
                  isHighlighted && 'bg-yellow-500/5 border-l-yellow-500',
                  !isSelected(index) && !isHighlighted && 'border-l-transparent hover:border-l-primary/30'
                )}
                header={
                  <div className="flex items-center justify-between gap-4 w-full min-w-0">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Step type icon */}
                      <div className="shrink-0">
                        {hasTools ? (
                          <Badge variant="tool" size="sm">
                            <Wrench className="h-3 w-3 mr-1" />
                            Tool
                          </Badge>
                        ) : (
                          <Badge variant="llm" size="sm">
                            <Brain className="h-3 w-3 mr-1" />
                            LLM
                          </Badge>
                        )}
                      </div>

                      {/* Step number and preview */}
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-sm font-bold">
                          Step {step.step_number}
                        </div>
                        <div className="text-xs text-muted-foreground truncate font-mono">
                          {truncatePrompt(step.prompt_text)}
                        </div>
                      </div>
                    </div>

                    {/* Metadata badges */}
                    <div className="flex items-center gap-2 shrink-0">
                      {step.reward !== null && (
                        <Badge variant="success" size="sm">
                          ⚡ {step.reward.toFixed(2)}
                        </Badge>
                      )}
                      {stepDuration && (
                        <Badge variant="default" size="sm">
                          <Clock className="h-3 w-3 mr-1" />
                          {stepDuration}
                        </Badge>
                      )}
                      {hasTools && (
                        <Badge variant="default" size="sm">
                          {step.tool_calls.length} tool{step.tool_calls.length > 1 ? 's' : ''}
                        </Badge>
                      )}
                    </div>
                  </div>
                }
                contentClassName="space-y-4"
              >
                {/* Step Details */}
                <StepDetails step={step} />
              </Collapsible>
            )
          })}
        </div>

        {trajectory.steps.length === 0 && (
          <div className="p-12 text-center text-muted-foreground">
            <Circle className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="font-mono text-sm">No steps recorded yet</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StepDetails({ step }: { step: TrajectoryStep }) {
  return (
    <div className="space-y-4">
      {/* Prompt Input */}
      <Section title="Prompt Input" icon={<Terminal className="h-4 w-4" />}>
        <SyntaxHighlighter
          code={step.prompt_text}
          language="text"
          showLineNumbers={false}
        />
      </Section>

      {/* Model Response */}
      {step.model_response && (
        <Section title="Model Response" icon={<Brain className="h-4 w-4" />}>
          <SyntaxHighlighter
            code={step.model_response}
            language="text"
            showLineNumbers={false}
          />
        </Section>
      )}

      {/* Thinking Trace */}
      {step.thinking_trace && (
        <Section title="Thinking Trace" icon={<Sparkles className="h-4 w-4" />}>
          <SyntaxHighlighter
            code={step.thinking_trace}
            language="text"
            showLineNumbers={false}
          />
        </Section>
      )}

      {/* Tool Calls */}
      {step.tool_calls.length > 0 && (
        <Section title={`Tool Calls (${step.tool_calls.length})`} icon={<Wrench className="h-4 w-4" />}>
          <div className="space-y-3">
            {step.tool_calls.map((toolCall, idx) => (
              <ToolCallCard key={idx} toolCall={toolCall} index={idx} />
            ))}
          </div>
        </Section>
      )}

      {/* Metadata */}
      {Object.keys(step.metadata).length > 0 && (
        <Section title="Metadata" icon={<Hash className="h-4 w-4" />}>
          <SyntaxHighlighter code={JSON.stringify(step.metadata, null, 2)} language="json" />
        </Section>
      )}
    </div>
  )
}

function ToolCallCard({ toolCall, index }: { toolCall: ToolCall; index: number }) {
  const hasError = toolCall.result?.error || toolCall.result?.success === false

  return (
    <div className="border border-border rounded-md overflow-hidden bg-muted/20">
      <div className="px-4 py-2 bg-muted/50 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="tool" size="sm">
            #{index + 1}
          </Badge>
          <span className="font-mono text-sm font-bold">{toolCall.tool_name}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={hasError ? 'failed' : 'success'} size="sm">
            {hasError ? (
              <>
                <XCircle className="h-3 w-3 mr-1" />
                Failed
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Success
              </>
            )}
          </Badge>
          <Badge variant="default" size="sm">
            {formatDuration(toolCall.duration_ms)}
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Parameters */}
        <div>
          <div className="text-xs font-mono font-bold text-muted-foreground mb-2 uppercase tracking-wider">
            Parameters
          </div>
          <SyntaxHighlighter
            code={JSON.stringify(toolCall.parameters, null, 2)}
            language="json"
            showLineNumbers={false}
          />
        </div>

        {/* Result */}
        <div>
          <div className="text-xs font-mono font-bold text-muted-foreground mb-2 uppercase tracking-wider">
            Result
          </div>
          {hasError && (
            <div className="mb-2 p-2 bg-red-500/10 border border-red-500/30 rounded flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
              <span className="text-xs font-mono text-red-400">
                {toolCall.result?.error || 'Tool execution failed'}
              </span>
            </div>
          )}
          <SyntaxHighlighter
            code={typeof toolCall.result === 'string' ? toolCall.result : JSON.stringify(toolCall.result, null, 2)}
            language={typeof toolCall.result === 'string' ? 'text' : 'json'}
            showLineNumbers={false}
          />
        </div>
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-mono font-bold uppercase tracking-wider text-muted-foreground">
        {icon}
        {title}
      </div>
      {children}
    </div>
  )
}

function MetricCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="border border-border rounded-md p-3 bg-card hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs font-mono uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-mono font-bold">{value}</div>
    </div>
  )
}

// Utility functions

function calculateMetrics(trajectory: Trajectory) {
  const totalSteps = trajectory.steps.length
  const totalTokens = trajectory.steps.reduce((sum, step) => {
    // Approximate token count: prompt + response length / 4
    const promptTokens = Math.ceil(step.prompt_text.length / 4)
    const responseTokens = Math.ceil(step.model_response.length / 4)
    return sum + promptTokens + responseTokens
  }, 0)

  let duration = 'N/A'
  if (trajectory.completed_at) {
    const start = new Date(trajectory.started_at).getTime()
    const end = new Date(trajectory.completed_at).getTime()
    duration = formatDuration(end - start)
  }

  return {
    totalSteps,
    totalTokens,
    duration,
  }
}

function calculateStepDuration(step: TrajectoryStep): string | null {
  // If tool calls exist, sum their durations
  if (step.tool_calls.length > 0) {
    const totalMs = step.tool_calls.reduce((sum, tc) => sum + tc.duration_ms, 0)
    return formatDuration(totalMs)
  }
  return null
}

function truncatePrompt(text: string, maxLength = 80): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  if (oneLine.length <= maxLength) return oneLine
  return oneLine.slice(0, maxLength) + '...'
}
