'use client'

import { useEffect, useCallback, useState } from 'react'

interface UseKeyboardNavigationOptions {
  itemCount: number
  onSelect?: (index: number) => void
  onExpand?: (index: number) => void
  onCollapse?: (index: number) => void
  onCollapseAll?: () => void
  loop?: boolean
  initialIndex?: number
}

export function useKeyboardNavigation({
  itemCount,
  onSelect,
  onExpand,
  onCollapse,
  onCollapseAll,
  loop = true,
  initialIndex = 0,
}: UseKeyboardNavigationOptions) {
  const [selectedIndex, setSelectedIndex] = useState(initialIndex)
  const [expandedIndices, setExpandedIndices] = useState<Set<number>>(new Set())

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Ignore if user is typing in an input/textarea
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      switch (event.key) {
        case 'ArrowDown':
        case 'j': // Vim-style navigation
          event.preventDefault()
          setSelectedIndex((prev) => {
            const next = prev + 1
            if (next >= itemCount) {
              return loop ? 0 : prev
            }
            return next
          })
          break

        case 'ArrowUp':
        case 'k': // Vim-style navigation
          event.preventDefault()
          setSelectedIndex((prev) => {
            const next = prev - 1
            if (next < 0) {
              return loop ? itemCount - 1 : prev
            }
            return next
          })
          break

        case 'Enter':
        case ' ': // Space
          event.preventDefault()
          const isExpanded = expandedIndices.has(selectedIndex)
          if (isExpanded) {
            setExpandedIndices((prev) => {
              const next = new Set(prev)
              next.delete(selectedIndex)
              return next
            })
            onCollapse?.(selectedIndex)
          } else {
            setExpandedIndices((prev) => new Set(prev).add(selectedIndex))
            onExpand?.(selectedIndex)
          }
          onSelect?.(selectedIndex)
          break

        case 'Escape':
          event.preventDefault()
          setExpandedIndices(new Set())
          onCollapseAll?.()
          break

        case 'Home':
          event.preventDefault()
          setSelectedIndex(0)
          break

        case 'End':
          event.preventDefault()
          setSelectedIndex(itemCount - 1)
          break

        default:
          break
      }
    },
    [itemCount, selectedIndex, expandedIndices, onSelect, onExpand, onCollapse, onCollapseAll, loop]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const toggleExpanded = useCallback(
    (index: number) => {
      const isExpanded = expandedIndices.has(index)
      if (isExpanded) {
        setExpandedIndices((prev) => {
          const next = new Set(prev)
          next.delete(index)
          return next
        })
      } else {
        setExpandedIndices((prev) => new Set(prev).add(index))
      }
    },
    [expandedIndices]
  )

  const expandAll = useCallback(() => {
    setExpandedIndices(new Set(Array.from({ length: itemCount }, (_, i) => i)))
  }, [itemCount])

  const collapseAll = useCallback(() => {
    setExpandedIndices(new Set())
  }, [])

  return {
    selectedIndex,
    setSelectedIndex,
    expandedIndices,
    toggleExpanded,
    expandAll,
    collapseAll,
    isExpanded: (index: number) => expandedIndices.has(index),
    isSelected: (index: number) => selectedIndex === index,
  }
}
