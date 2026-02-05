'use client'

import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CollapsibleProps {
  children: React.ReactNode
  header: React.ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
  headerClassName?: string
  contentClassName?: string
  icon?: React.ReactNode
}

export function Collapsible({
  children,
  header,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange,
  className,
  headerClassName,
  contentClassName,
  icon,
}: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)

  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen

  const toggleOpen = () => {
    const newOpen = !isOpen
    if (!isControlled) {
      setUncontrolledOpen(newOpen)
    }
    onOpenChange?.(newOpen)
  }

  return (
    <div className={cn('border-l-4 border-primary/30 transition-all', className)}>
      <button
        onClick={toggleOpen}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors group',
          headerClassName
        )}
      >
        <ChevronRight
          className={cn(
            'h-4 w-4 shrink-0 transition-transform duration-200 text-muted-foreground group-hover:text-foreground',
            isOpen && 'rotate-90'
          )}
        />
        {icon && <div className="shrink-0">{icon}</div>}
        <div className="flex-1 min-w-0">{header}</div>
      </button>

      <div
        className={cn(
          'grid transition-all duration-200 ease-in-out',
          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className={cn('px-4 py-3 pl-11', contentClassName)}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

export function CollapsibleTrigger({ children, className, ...props }: React.HTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn('flex items-center gap-2 font-medium', className)}
      {...props}
    >
      {children}
    </button>
  )
}

export function CollapsibleContent({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('pt-2', className)} {...props}>
      {children}
    </div>
  )
}
