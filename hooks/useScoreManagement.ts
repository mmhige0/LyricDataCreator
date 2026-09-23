import { useState, useRef, useEffect } from 'react'
import type { ScoreEntry, LyricsArray, YouTubePlayer } from '@/lib/types'
import { processLyricsForSave } from '@/lib/textUtils'
import { toast } from 'sonner'
import type { LyricsPosition } from '@/lib/lyricsNavigation'
import { updateLyricsLine, finishLyricsLine } from '@/lib/inlineLyrics'

import { captureTimestamp, DEFAULT_TIMESTAMP_OFFSET } from '@/lib/timestampCapture'

const MAX_HISTORY = 15

interface AppState {
  scoreEntries: ScoreEntry[]
}

interface UseScoreManagementProps {
  currentTime: number
  currentPlayer: YouTubePlayer | null
}

export const useScoreManagement = ({ currentTime, currentPlayer }: UseScoreManagementProps) => {
  const [scoreEntries, setScoreEntries] = useState<ScoreEntry[]>([])
  const [timestampOffset, setTimestampOffsetState] = useState<number>(DEFAULT_TIMESTAMP_OFFSET)
  const [undoHistory, setUndoHistory] = useState<AppState[]>([])
  const [redoHistory, setRedoHistory] = useState<AppState[]>([])

  const [selectedLyricsPosition, selectLyricsPosition] = useState<LyricsPosition | null>(null)
  const selectedLyrics = selectedLyricsPosition && scoreEntries.some(entry => entry.id === selectedLyricsPosition.id) ? selectedLyricsPosition : null
  const [inlineEditing, setInlineEditing] = useState<{ id: string; line: number } | null>(null)
  const inlineHistorySaved = useRef(false)
  const inlineChangedLines = useRef(new Set<number>())


  // Load offset from localStorage on mount
  useEffect(() => {
    const savedOffset = localStorage.getItem('timestampOffset')
    if (savedOffset !== null) {
      const parsed = savedOffset.trim() ? Number(savedOffset) : NaN
      if (Number.isFinite(parsed)) {
        setTimestampOffsetState(Math.max(-2, Math.min(2, parsed)))
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
    // Splits and multiline paste are separate operations from preceding typing.
    saveCurrentState()
    inlineHistorySaved.current = true
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
    const id = selectedId ?? inlineEditing?.id
    if (!id || !scoreEntries.some(entry => entry.id === id)) return
    const time = Number(value)
    if (!value.trim() || !Number.isFinite(time) || time < 0) {
      toast.error('タイムスタンプは0以上の数値で入力してください。')
      return false
    }
    if (scoreEntries.find(entry => entry.id === id)?.timestamp === time) return true
    if (inlineEditing?.id === id) checkpointInlineEdit()
    else saveCurrentState()
    // Keep the focused input mounted in place; sort when the line is finished.
    setScoreEntries(prev => {
      const updated = prev.map(entry => entry.id === id ? { ...entry, timestamp: time } : entry)
      return inlineEditing?.id === id ? updated : updated.sort((a, b) => a.timestamp - b.timestamp)
    })
    return true
  }

  // Page-level actions each receive their own undo checkpoint.
  const replacePageLyrics = (id: string, next: LyricsArray, expected?: LyricsArray) => {
    const entry = scoreEntries.find(item => item.id === id)
    if (!entry || (expected && entry.lyrics.some((line, i) => line !== expected[i]))) return false
    const normalized = processLyricsForSave(next)
    if (entry.lyrics.every((line, i) => line === normalized[i])) return true
    saveCurrentState()
    setScoreEntries(prev => prev.map(item => item.id === id ? { ...item, lyrics: normalized } : item))
    return true
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
    }
    setRedoHistory((prev) => {
      const newHistory = [currentState, ...prev]
      return newHistory.slice(0, MAX_HISTORY)
    })

    // Keep the focused inline field active; the next edit starts a new history group.
    inlineChangedLines.current.clear()
    inlineHistorySaved.current = false

    // Restore previous state
    setUndoHistory(restUndo)
    setScoreEntries(previousState.scoreEntries)
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
    }
    setUndoHistory((prev) => {
      const newHistory = [currentState, ...prev]
      return newHistory.slice(0, MAX_HISTORY)
    })

    // Keep the focused inline field active; the next edit starts a new history group.
    inlineChangedLines.current.clear()
    inlineHistorySaved.current = false

    // Restore next state
    setRedoHistory(restRedo)
    setScoreEntries(nextState.scoreEntries)
    toast.success('操作をやり直しました')
  }

  const deleteScoreEntry = (id: string) => {
    const index = scoreEntries.findIndex(entry => entry.id === id)
    if (index < 0) return
    if (selectedLyrics?.id === id) {
      const next = scoreEntries[index + 1] ?? scoreEntries[index - 1]
      const line = selectedLyrics.line
      selectLyricsPosition(next ? { id: next.id, line } : null)
      setInlineEditing(null)
      inlineChangedLines.current.clear()
      inlineHistorySaved.current = false
      requestAnimationFrame(() => {
        const target = next ? document.getElementById(`lyrics-selection-${next.id}-${line}`) : document.querySelector<HTMLElement>('[aria-label="空ページを追加"]')
        target?.focus({ preventScroll: true })
        target?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      })
    }
    saveCurrentState()
    setScoreEntries((prev) => prev.filter((entry) => entry.id !== id))
    toast.success('ページを削除しました (Ctrl+Zで元に戻せます)')
  }

  const addEmptyScoreEntry = (targetId?: string, position: 'before' | 'after' = 'after', line = 0, editing = true) => {
    const targetIndex = targetId ? scoreEntries.findIndex(entry => entry.id === targetId) : scoreEntries.length - 1
    if (targetId && targetIndex < 0) return
    const index = targetId && position === 'before' ? targetIndex - 1 : targetIndex
    const newEntry: ScoreEntry = {
      id: `entry_${crypto.randomUUID()}`,
      timestamp: currentPlayer ? captureTimestamp(currentPlayer.getCurrentTime(), timestampOffset, currentPlayer.getDuration()) : 0,
      lyrics: ['', '', '', ''],
    }
    saveCurrentState()
    setScoreEntries(prev => targetId
      ? [...prev.slice(0, index + 1), newEntry, ...prev.slice(index + 1)]
      : [...prev, newEntry].sort((a, b) => a.timestamp - b.timestamp))
    selectLyricsPosition({ id: newEntry.id, line })
    requestAnimationFrame(() => {
      const input = document.getElementById(`${editing ? 'lyrics' : 'lyrics-selection'}-${newEntry.id}-${line}`)
      input?.focus({ preventScroll: true })
      input?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
  }

  const appendPageFromNavigation = (lastId: string, line: number, editing: boolean) => {
    if (scoreEntries.at(-1)?.id !== lastId || line < 0 || line > 3) return
    addEmptyScoreEntry(lastId, 'after', line, editing)
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
    replacePageLyrics,
    // State
    scoreEntries,
    setScoreEntries,
    timestampOffset,
    setTimestampOffset,

    // Functions
    deleteScoreEntry,
    addEmptyScoreEntry,
    appendPageFromNavigation,
    getCurrentLyricsIndex,
    clearAllScoreEntries,
    undoLastOperation,
    redoLastOperation,
    canUndo: undoHistory.length > 0,
    canRedo: redoHistory.length > 0,
    saveCurrentState
  }
}
