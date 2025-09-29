import { useRef, useEffect } from 'react'
import type { ScoreEntry } from '@/lib/types'

interface UseAutoScrollProps {
  getCurrentLyricsIndex: () => number
  scoreEntries: ScoreEntry[]
  enabled: boolean
}

export const useAutoScroll = ({ getCurrentLyricsIndex, scoreEntries, enabled }: UseAutoScrollProps) => {
  const entryRefs = useRef<(HTMLDivElement | null)[]>([])
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  // Auto-scroll to currently playing entry within the scroll container only
  useEffect(() => {
    if (!enabled) return

    const currentIndex = getCurrentLyricsIndex()
    if (currentIndex >= 0 && currentIndex < scoreEntries.length) {
      const currentEntryRef = entryRefs.current[currentIndex]
      const scrollContainer = scrollContainerRef.current

      if (currentEntryRef && scrollContainer) {
        // Calculate position within scroll container
        const entryOffsetTop = currentEntryRef.offsetTop
        const containerHeight = scrollContainer.clientHeight
        const entryHeight = currentEntryRef.clientHeight

        // Calculate target scroll position to center the entry
        const targetScrollTop = entryOffsetTop - (containerHeight / 2) + (entryHeight / 2)

        // Scroll only within the container
        scrollContainer.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        })
      }
    }
  }, [enabled, getCurrentLyricsIndex, scoreEntries.length])

  // Update refs array when scoreEntries change
  useEffect(() => {
    entryRefs.current = entryRefs.current.slice(0, scoreEntries.length)
  }, [scoreEntries.length])

  return {
    entryRefs,
    scrollContainerRef
  }
}