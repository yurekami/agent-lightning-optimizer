'use client'

import { ComparisonItem } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckCircle2, Clock, Layers } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

interface ReviewQueueProps {
  queue: ComparisonItem[]
  currentId?: string
  onSelect: (item: ComparisonItem) => void
  className?: string
}

export function ReviewQueue({ queue, currentId, onSelect, className }: ReviewQueueProps) {
  if (queue.length === 0) {
    return (
      <Card className={cn('h-full', className)}>
        <CardHeader className="border-b">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Review Queue
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-muted-foreground/50 mb-3" />
            <h3 className="font-semibold mb-1">All caught up!</h3>
            <p className="text-sm text-muted-foreground">No pending comparisons at the moment.</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn('h-full flex flex-col', className)}>
      <CardHeader className="border-b shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Review Queue
          </CardTitle>
          <Badge variant="secondary">{queue.length}</Badge>
        </div>
      </CardHeader>
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border">
          {queue.map((item, index) => (
            <QueueItem
              key={item.id}
              item={item}
              index={index}
              isActive={item.id === currentId}
              onClick={() => onSelect(item)}
            />
          ))}
        </div>
      </ScrollArea>
    </Card>
  )
}

interface QueueItemProps {
  item: ComparisonItem
  index: number
  isActive: boolean
  onClick: () => void
}

function QueueItem({ item, index, isActive, onClick }: QueueItemProps) {
  const isPriority = item.priority >= 8

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left p-4 transition-all hover:bg-muted/50 border-l-4',
        isActive ? 'bg-primary/5 border-l-primary' : 'border-l-transparent',
        isPriority && !isActive && 'border-l-orange-500/50'
      )}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-mono font-bold text-muted-foreground shrink-0">
              #{index + 1}
            </span>
            <span className="text-sm font-semibold truncate">{item.taskType}</span>
          </div>
          {isPriority && (
            <Badge variant="destructive" className="text-xs shrink-0">
              Priority
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span className="font-mono">{formatDate(item.createdAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Badge variant="outline" className="font-mono text-xs">
            A: v{item.trajectoryA.prompt_version_id}
          </Badge>
          <span className="text-muted-foreground">vs</span>
          <Badge variant="outline" className="font-mono text-xs">
            B: v{item.trajectoryB.prompt_version_id}
          </Badge>
        </div>
      </div>
    </button>
  )
}
