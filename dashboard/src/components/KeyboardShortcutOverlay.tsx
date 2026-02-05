'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Keyboard } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KeyboardShortcut {
  key: string
  description: string
  category: 'rating' | 'navigation' | 'action'
}

const shortcuts: KeyboardShortcut[] = [
  { key: '1', description: 'Select "A is better"', category: 'rating' },
  { key: '2', description: 'Select "B is better"', category: 'rating' },
  { key: '3', description: 'Select "Tie"', category: 'rating' },
  { key: 'A', description: 'Toggle A task success', category: 'rating' },
  { key: 'B', description: 'Toggle B task success', category: 'rating' },
  { key: '←/→', description: 'Adjust efficiency sliders', category: 'rating' },
  { key: 'Enter', description: 'Submit review (Ctrl+Enter)', category: 'action' },
  { key: 'S', description: 'Skip comparison', category: 'action' },
  { key: 'Tab', description: 'Navigate between fields', category: 'navigation' },
  { key: '?', description: 'Toggle this help overlay', category: 'navigation' },
  { key: 'Esc', description: 'Close overlay', category: 'navigation' },
]

export function KeyboardShortcutOverlay() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      if (event.key === '?' || (event.key === '/' && event.shiftKey)) {
        event.preventDefault()
        setIsVisible((prev) => !prev)
      } else if (event.key === 'Escape' && isVisible) {
        setIsVisible(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isVisible])

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-all z-50 group"
        aria-label="Show keyboard shortcuts"
      >
        <Keyboard className="h-5 w-5" />
        <span className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
          Press ? for shortcuts
        </span>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-auto">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-primary" />
              <CardTitle>Keyboard Shortcuts</CardTitle>
            </div>
            <button
              onClick={() => setIsVisible(false)}
              className="p-1 hover:bg-muted rounded-md transition-colors"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            {['rating', 'action', 'navigation'].map((category) => (
              <div key={category}>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                  {category}
                </h3>
                <div className="space-y-2">
                  {shortcuts
                    .filter((s) => s.category === category)
                    .map((shortcut, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-sm">{shortcut.description}</span>
                        <kbd className="px-2 py-1 bg-muted border border-border rounded font-mono text-xs">
                          {shortcut.key}
                        </kbd>
                      </div>
                    ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center">
              Shortcuts work when not typing in text fields.{' '}
              <span className="font-semibold">Press ? or Esc</span> to close this overlay.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
