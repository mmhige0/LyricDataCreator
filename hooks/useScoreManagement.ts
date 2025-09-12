import { useState, useRef } from 'react'
import type { ScoreEntry, LyricsArray, YouTubePlayer } from '@/lib/types'

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

  const lyricsInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const timestampInputRef = useRef<HTMLInputElement>(null)

  const deleteScoreEntry = (id: string) => {
    const confirm = window.confirm("このページエントリを削除しますか？")
    if (confirm) {
      setScoreEntries((prev) => prev.filter((entry) => entry.id !== id))
    }
  }

  const startEditScoreEntry = (entry: ScoreEntry) => {
    setEditingId(entry.id)
    setEditingLyrics(entry.lyrics)
    setEditingTimestamp(entry.timestamp.toString())
  }

  const saveEditScoreEntry = () => {
    if (!editingId) return

    setScoreEntries((prev) => {
      const updatedEntries = prev.map((entry) =>
        entry.id === editingId
          ? { ...entry, lyrics: editingLyrics, timestamp: Number.parseFloat(editingTimestamp) }
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
    const currentLyrics: LyricsArray = [
      lyrics[0] || "",
      lyrics[1] || "",
      lyrics[2] || "",
      lyrics[3] || ""
    ]
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
    const confirm = window.confirm("すべてのページを削除しますか？この操作は取り消せません。")
    if (confirm) {
      setScoreEntries([])
    }
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
    lyricsInputRefs,
    timestampInputRef,

    // Functions
    deleteScoreEntry,
    startEditScoreEntry,
    saveEditScoreEntry,
    cancelEditScoreEntry,
    addScoreEntry,
    getCurrentLyricsIndex,
    clearAllScoreEntries
  }
}