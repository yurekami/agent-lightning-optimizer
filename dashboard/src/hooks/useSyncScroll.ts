'use client'

import { useEffect, useRef, useState } from 'react'

interface UseSyncScrollOptions {
  enabled?: boolean
  threshold?: number
}

export function useSyncScroll(options: UseSyncScrollOptions = {}) {
  const { enabled = true, threshold = 5 } = options
  const ref1 = useRef<HTMLDivElement>(null)
  const ref2 = useRef<HTMLDivElement>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const syncTimeoutRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (!enabled || !ref1.current || !ref2.current) return

    const element1 = ref1.current
    const element2 = ref2.current

    const handleScroll1 = () => {
      if (isSyncing) return
      setIsSyncing(true)

      const scrollPercentage = element1.scrollTop / (element1.scrollHeight - element1.clientHeight)
      const targetScroll = scrollPercentage * (element2.scrollHeight - element2.clientHeight)

      element2.scrollTop = targetScroll

      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
      syncTimeoutRef.current = setTimeout(() => setIsSyncing(false), 50)
    }

    const handleScroll2 = () => {
      if (isSyncing) return
      setIsSyncing(true)

      const scrollPercentage = element2.scrollTop / (element2.scrollHeight - element2.clientHeight)
      const targetScroll = scrollPercentage * (element1.scrollHeight - element1.clientHeight)

      element1.scrollTop = targetScroll

      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
      syncTimeoutRef.current = setTimeout(() => setIsSyncing(false), 50)
    }

    element1.addEventListener('scroll', handleScroll1, { passive: true })
    element2.addEventListener('scroll', handleScroll2, { passive: true })

    return () => {
      element1.removeEventListener('scroll', handleScroll1)
      element2.removeEventListener('scroll', handleScroll2)
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current)
    }
  }, [enabled, isSyncing])

  return { ref1, ref2 }
}
