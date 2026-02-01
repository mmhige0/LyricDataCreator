import { useState, useRef, useEffect } from 'react'
import type { ScoreEntry, LyricsArray, YouTubePlayer } from '@/lib/types'
import { processLyricsForSave } from '@/lib/textUtils'
import { toast } from 'sonner'

const MAX_HISTORY = 15

interface AppState {
  scoreEntries: ScoreEntry[]
  lyrics: LyricsArray
  timestamp: string
}

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
  const [timestampOffset, setTimestampOffsetState] = useState<number>(0)
  const [undoHistory, setUndoHistory] = useState<AppState[]>([])
  const [redoHistory, setRedoHistory] = useState<AppState[]>([])

  const lyricsInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const timestampInputRef = useRef<HTMLInputElement>(null)

  // Load offset from localStorage on mount
  useEffect(() => {
    const savedOffset = localStorage.getItem('timestampOffset')
    if (savedOffset !== null) {
      const parsed = Number.parseFloat(savedOffset)
      if (Number.isFinite(parsed)) {
        setTimestampOffsetState(parsed)
      }
    }
  }, [])

  const setTimestampOffset = (value: number | ((prev: number) => number)) => {
    setTimestampOffsetState((prev) => {
      const next = typeof value === 'function' ? value(prev) : value
      if (typeof window !== 'undefined') {
        localStorage.setItem('timestampOffset', next.toString())
      }
      return next
    })
  }

  // Save current state before modification
  const saveCurrentState = () => {
    const currentState: AppState = {
      scoreEntries: [...scoreEntries],
      lyrics: [...lyrics],
      timestamp
    }
    setUndoHistory((prev) => {
      const newHistory = [currentState, ...prev]
      return newHistory.slice(0, MAX_HISTORY)
    })
    setRedoHistory([])
  }

  // Undo last operation
  const undoLastOperation = () => {
    if (undoHistory.length === 0) {
      toast.info('元に戻す操作がありません')
      return
    }

    const [previousState, ...restUndo] = undoHistory

    // Save current state to redo history
    const currentState: AppState = {
      scoreEntries: [...scoreEntries],
      lyrics: [...lyrics],
      timestamp
    }
    setRedoHistory((prev) => {
      const newHistory = [currentState, ...prev]
      return newHistory.slice(0, MAX_HISTORY)
    })

    // Cancel any ongoing edit
    setEditingId(null)
    setEditingLyrics(["", "", "", ""])
    setEditingTimestamp("0.00")

    // Restore previous state
    setUndoHistory(restUndo)
    setScoreEntries(previousState.scoreEntries)
    setLyrics(previousState.lyrics)
    setTimestamp(previousState.timestamp)
    toast.success('操作を元に戻しました')
  }

  // Redo last undone operation
  const redoLastOperation = () => {
    if (redoHistory.length === 0) {
      toast.info('やり直す操作がありません')
      return
    }

    const [nextState, ...restRedo] = redoHistory

    // Save current state to undo history
    const currentState: AppState = {
      scoreEntries: [...scoreEntries],
      lyrics: [...lyrics],
      timestamp
    }
    setUndoHistory((prev) => {
      const newHistory = [currentState, ...prev]
      return newHistory.slice(0, MAX_HISTORY)
    })

    // Cancel any ongoing edit
    setEditingId(null)
    setEditingLyrics(["", "", "", ""])
    setEditingTimestamp("0.00")

    // Restore next state
    setRedoHistory(restRedo)
    setScoreEntries(nextState.scoreEntries)
    setLyrics(nextState.lyrics)
    setTimestamp(nextState.timestamp)
    toast.success('操作をやり直しました')
  }

  const deleteScoreEntry = (id: string) => {
    saveCurrentState()
    setScoreEntries((prev) => prev.filter((entry) => entry.id !== id))
    toast.success('ページを削除しました (Ctrl+Zで元に戻せます)')
  }

  const startEditScoreEntry = (entry: ScoreEntry) => {
    setEditingId(entry.id)
    setEditingLyrics(entry.lyrics)
    setEditingTimestamp(entry.timestamp.toString())
  }

  const saveEditScoreEntry = () => {
    if (!editingId) return

    // Save the state before editing so that Undo restores to pre-edit state
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
    toast.success(`${count}件のページを削除しました (Ctrl+Zで元に戻せます)`)
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
    redoLastOperation,
    canUndo: undoHistory.length > 0,
    canRedo: redoHistory.length > 0,
    saveCurrentState
  }
}
