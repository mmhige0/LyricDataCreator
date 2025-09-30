import { useRef, useEffect } from 'react'
import type { ScoreEntry } from '@/lib/types'

interface UseAutoScrollProps {
  getCurrentLyricsIndex: () => number
  scoreEntries: ScoreEntry[]
  enabled: boolean
  onUserScroll?: () => void
}

export const useAutoScroll = ({ getCurrentLyricsIndex, scoreEntries, enabled, onUserScroll }: UseAutoScrollProps) => {
  const entryRefs = useRef<(HTMLDivElement | null)[]>([])
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const isAutoScrollingRef = useRef<boolean>(false)
  const autoScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastScrollTopRef = useRef<number>(0)
  const lastAutoScrollIndexRef = useRef<number>(-1)

  // Auto-scroll to currently playing entry within the scroll container only
  useEffect(() => {
    if (!enabled) return

    const currentIndex = getCurrentLyricsIndex()

    // Only auto-scroll if the index has changed
    if (currentIndex !== lastAutoScrollIndexRef.current && currentIndex >= 0 && currentIndex < scoreEntries.length) {
      const currentEntryRef = entryRefs.current[currentIndex]
      const scrollContainer = scrollContainerRef.current

      if (currentEntryRef && scrollContainer) {
        lastAutoScrollIndexRef.current = currentIndex

        // Calculate position within scroll container
        const entryOffsetTop = currentEntryRef.offsetTop
        const containerHeight = scrollContainer.clientHeight
        const entryHeight = currentEntryRef.clientHeight

        // Calculate target scroll position to center the entry
        const targetScrollTop = entryOffsetTop - (containerHeight / 2) + (entryHeight / 2)

        // Clear any existing timeout
        if (autoScrollTimeoutRef.current) {
          clearTimeout(autoScrollTimeoutRef.current)
        }

        // Mark that we're auto-scrolling
        isAutoScrollingRef.current = true

        // Scroll only within the container
        scrollContainer.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        })

        // Reset auto-scrolling flag after animation completes
        autoScrollTimeoutRef.current = setTimeout(() => {
          isAutoScrollingRef.current = false
          lastScrollTopRef.current = scrollContainer.scrollTop
        }, 600)
      }
    }
  }, [enabled, getCurrentLyricsIndex, scoreEntries.length])

  // Detect manual user scroll
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current
    if (!scrollContainer || !onUserScroll) return

    const handleScroll = () => {
      const currentScrollTop = scrollContainer.scrollTop

      // If we're currently auto-scrolling, just update the reference and ignore
      if (isAutoScrollingRef.current) {
        lastScrollTopRef.current = currentScrollTop
        return
      }

      // Check if scroll position actually changed from last known position
      if (Math.abs(currentScrollTop - lastScrollTopRef.current) > 5) {
        // This is a user-initiated scroll - immediately disable auto-scroll
        if (enabled) {
          onUserScroll()
        }
      }

      lastScrollTopRef.current = currentScrollTop
    }

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll)
    }
  }, [enabled, onUserScroll])

  // Update refs array when scoreEntries change
  useEffect(() => {
    entryRefs.current = entryRefs.current.slice(0, scoreEntries.length)
  }, [scoreEntries.length])

  return {
    entryRefs,
    scrollContainerRef
  }
}