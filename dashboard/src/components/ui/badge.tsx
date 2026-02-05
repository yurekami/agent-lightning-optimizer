import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center border font-mono text-xs font-bold tracking-wider uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        success: 'border-green-500 bg-green-500/10 text-green-400 hover:bg-green-500/20',
        failed: 'border-red-500 bg-red-500/10 text-red-400 hover:bg-red-500/20',
        pending: 'border-yellow-500 bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20',
        running: 'border-blue-500 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 animate-pulse',
        completed: 'border-emerald-500 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20',
        default: 'border-border bg-muted text-muted-foreground hover:bg-muted/80',
        llm: 'border-purple-500 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20',
        tool: 'border-cyan-500 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20',
        outline: 'border-border bg-transparent text-foreground hover:bg-muted/50',
        secondary: 'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80',
        destructive: 'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80',
      },
      size: {
        default: 'px-2 py-0.5',
        sm: 'px-1.5 py-0.5 text-[10px]',
        lg: 'px-3 py-1 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
