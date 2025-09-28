import { useState, useRef, useEffect } from 'react'
import type { ScoreEntry, LyricsArray, YouTubePlayer } from '@/lib/types'
import { processLyricsForSave } from '@/lib/textUtils'
import { toast } from 'sonner'

interface UseScoreManagementProps {
  currentTime: number
  currentPlayer: YouTubePlayer | null
}

export const useScoreManagement = ({ currentTime, currentPlayer }: UseScoreManagementProps) => {
  const [scoreEntries, setScoreEntries] = useState<ScoreEntry[]>([])
  const [lyrics, setLyrics] = useState<LyricsArray>(["", "", "", ""])
  const [timestamp, setTimestamp] = useState<string>("0.00")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLyrics, setEditingLyrics] = useState<LyricsArray>(["", "", "", ""])
  const [editingTimestamp, setEditingTimestamp] = useState<string>("0.00")
  const [timestampOffset, setTimestampOffset] = useState<number>(0)
  const [previousScoreEntries, setPreviousScoreEntries] = useState<ScoreEntry[] | null>(null)

  const lyricsInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const timestampInputRef = useRef<HTMLInputElement>(null)

  // Load offset from localStorage on mount
  useEffect(() => {
    const savedOffset = localStorage.getItem('timestampOffset')
    if (savedOffset !== null) {
      setTimestampOffset(Number.parseFloat(savedOffset))
    }
  }, [])

  // Save offset to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('timestampOffset', timestampOffset.toString())
  }, [timestampOffset])

  // Save current state before modification
  const saveCurrentState = () => {
    setPreviousScoreEntries([...scoreEntries])
  }

  // Undo last operation
  const undoLastOperation = () => {
    if (previousScoreEntries !== null) {
      setScoreEntries(previousScoreEntries)
      setPreviousScoreEntries(null)
      toast.success('操作を元に戻しました')
    } else {
      toast.info('元に戻す操作がありません')
    }
  }

  const deleteScoreEntry = (id: string) => {
    saveCurrentState()
    setScoreEntries((prev) => prev.filter((entry) => entry.id !== id))
    toast.success('ページを削除しました')
  }

  const startEditScoreEntry = (entry: ScoreEntry) => {
    setEditingId(entry.id)
    setEditingLyrics(entry.lyrics)
    setEditingTimestamp(entry.timestamp.toString())
  }

  const saveEditScoreEntry = () => {
    if (!editingId) return

    saveCurrentState()
    const convertedLyrics = processLyricsForSave(editingLyrics)

    setScoreEntries((prev) => {
      const updatedEntries = prev.map((entry) =>
        entry.id === editingId
          ? { ...entry, lyrics: convertedLyrics, timestamp: Number.parseFloat(editingTimestamp) }
          : entry,
      )
      return updatedEntries.sort((a, b) => a.timestamp - b.timestamp)
    })

    setEditingId(null)
    setEditingLyrics(["", "", "", ""])
    setEditingTimestamp("0.00")
  }

  const cancelEditScoreEntry = () => {
    setEditingId(null)
    setEditingLyrics(["", "", "", ""])
    setEditingTimestamp("0.00")
  }

  const addScoreEntry = () => {
    saveCurrentState()
    const currentLyrics = processLyricsForSave(lyrics)
    const currentTimestamp = timestamp || "0.00"

    const newEntry: ScoreEntry = {
      id: `entry_${Date.now()}`,
      timestamp: Number.parseFloat(currentTimestamp),
      lyrics: currentLyrics,
    }

    setScoreEntries((prev) => {
      const newEntries = [...prev, newEntry]
      return newEntries.sort((a, b) => a.timestamp - b.timestamp)
    })

    setLyrics(["", "", "", ""])
    setTimestamp("0.00")
    lyricsInputRefs.current[0]?.focus()
  }

  const getCurrentLyricsIndex = (): number => {
    if (!currentPlayer || scoreEntries.length === 0) return -1

    for (let i = scoreEntries.length - 1; i >= 0; i--) {
      if (currentTime >= scoreEntries[i].timestamp) {
        return i
      }
    }
    return -1
  }

  const clearAllScoreEntries = () => {
    saveCurrentState()
    const count = scoreEntries.length
    setScoreEntries([])
    toast.success(`${count}件のページを削除しました`)
  }

  return {
    // State
    scoreEntries,
    setScoreEntries,
    lyrics,
    setLyrics,
    timestamp,
    setTimestamp,
    editingId,
    editingLyrics,
    setEditingLyrics,
    editingTimestamp,
    setEditingTimestamp,
    timestampOffset,
    setTimestampOffset,
    lyricsInputRefs,
    timestampInputRef,

    // Functions
    deleteScoreEntry,
    startEditScoreEntry,
    saveEditScoreEntry,
    cancelEditScoreEntry,
    addScoreEntry,
    getCurrentLyricsIndex,
    clearAllScoreEntries,
    undoLastOperation,
    canUndo: previousScoreEntries !== null,
    saveCurrentState
  }
}