import { useState, useRef, useEffect } from 'react'
import type { ScoreEntry, LyricsArray, YouTubePlayer } from '@/lib/types'
import { processLyricsForSave } from '@/lib/textUtils'
import { toast } from 'sonner'
import type { LyricsPosition } from '@/lib/lyricsNavigation'
import { updateLyricsLine, finishLyricsLine } from '@/lib/inlineLyrics'

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

  const [selectedLyricsPosition, selectLyricsPosition] = useState<LyricsPosition | null>(null)
  const selectedLyrics = selectedLyricsPosition && scoreEntries.some(entry => entry.id === selectedLyricsPosition.id) ? selectedLyricsPosition : null
  const [inlineEditing, setInlineEditing] = useState<{ id: string; line: number } | null>(null)
  const inlineHistorySaved = useRef(false)
  const inlineChangedLines = useRef(new Set<number>())

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

  const startInlineEdit = (id: string, line: number) => {
    inlineChangedLines.current.clear()
    inlineHistorySaved.current = false
    selectLyricsPosition({ id, line })
    setInlineEditing({ id, line })
  }

  const checkpointInlineEdit = () => {
    if (!inlineHistorySaved.current) {
      saveCurrentState()
      inlineHistorySaved.current = true
    }
  }

  const changeInlineLyrics = (id: string, line: number, value: string) => {
    inlineChangedLines.current.add(line)
    checkpointInlineEdit()
    setScoreEntries(prev => updateLyricsLine(prev, id, line, value))
  }

  const replaceInlineLyrics = (id: string, next: LyricsArray) => {
    const entry = scoreEntries.find(item => item.id === id)
    next.forEach((value, line) => {
      if (entry?.lyrics[line] !== value) inlineChangedLines.current.add(line)
    })
    checkpointInlineEdit()
    setScoreEntries(prev => prev.map(entry => entry.id === id ? { ...entry, lyrics: next } : entry))
  }

  const finishInlineEdit = (id: string, line: number, value: string) => {
    const entry = scoreEntries.find(item => item.id === id)
    const normalized = processLyricsForSave([value, '', '', ''])[0]
    if (entry && entry.lyrics[line] !== normalized) checkpointInlineEdit()
    const changedLines = new Set([...inlineChangedLines.current, line])
    setScoreEntries(prev => {
      let updated = prev
      for (const changedLine of changedLines) {
        const text = changedLine === line ? value : prev.find(item => item.id === id)?.lyrics[changedLine]
        if (text !== undefined) updated = finishLyricsLine(updated, id, changedLine, text)
      }
      return updated
    })
    inlineChangedLines.current.clear()
    setInlineEditing(null)
    inlineHistorySaved.current = false
  }

  const updateInlineTimestamp = (value: string, selectedId?: string) => {
    const id = inlineEditing?.id ?? selectedId
    if (!id || !scoreEntries.some(entry => entry.id === id)) return
    const time = Number(value)
    if (!Number.isFinite(time) || time < 0) return
    if (inlineEditing) checkpointInlineEdit()
    else saveCurrentState()
    // Keep the focused input mounted in place; sort when the line is finished.
    setScoreEntries(prev => {
      const updated = prev.map(entry => entry.id === id ? { ...entry, timestamp: time } : entry)
      return inlineEditing ? updated : updated.sort((a, b) => a.timestamp - b.timestamp)
    })
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

    setInlineEditing(null)
    inlineHistorySaved.current = false

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

    setInlineEditing(null)
    inlineHistorySaved.current = false

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
    if (selectedLyrics?.id === id) selectLyricsPosition(null)
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
    selectLyricsPosition(null)
    saveCurrentState()
    const count = scoreEntries.length
    setScoreEntries([])
    toast.success(`${count}件のページを削除しました (Ctrl+Zで元に戻せます)`)
  }

  return {
    selectedLyrics,
    selectLyricsPosition,
    inlineEditing,
    startInlineEdit,
    changeInlineLyrics,
    replaceInlineLyrics,
    finishInlineEdit,
    updateInlineTimestamp,
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

