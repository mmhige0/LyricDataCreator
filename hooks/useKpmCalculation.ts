import { useState, useEffect, useCallback, useRef } from 'react'
import type { ScoreEntry } from '@/lib/types'
import { calculatePageKpm, type PageKpmInfo } from '@/lib/kpmUtils'

export const useKpmCalculation = (scoreEntries: ScoreEntry[]) => {
  const [kpmDataMap, setKpmDataMap] = useState<Map<string, PageKpmInfo>>(new Map())
  const prevScoreEntriesRef = useRef<ScoreEntry[]>([])
  const prevKpmDataMapRef = useRef<Map<string, PageKpmInfo>>(new Map())

  // 変更されたページのKPMを再計算
  const recalculateKpm = useCallback(async (entryIds: string[]) => {
    for (const entryId of entryIds) {
      const entryIndex = scoreEntries.findIndex(e => e.id === entryId)
      if (entryIndex === -1) continue

      const entry = scoreEntries[entryIndex]
      const nextEntry = scoreEntries[entryIndex + 1]
      const nextTimestamp = nextEntry ? nextEntry.timestamp : null

      try {
        const pageKpmInfo = await calculatePageKpm(entry, nextTimestamp)
        setKpmDataMap(prev => new Map(prev).set(entry.id, pageKpmInfo))
      } catch (error) {
        console.error('kpm calculation error for entry:', entry.id, error)
      }
    }
  }, [scoreEntries])

  // scoreEntriesの変更を監視して、変更されたページのみ再計算
  useEffect(() => {
    const prevScoreEntries = prevScoreEntriesRef.current
    const prevKpmDataMap = prevKpmDataMapRef.current
    const changedEntryIds: string[] = []

    // 新規追加されたページを検出
    scoreEntries.forEach(entry => {
      if (!prevKpmDataMap.has(entry.id)) {
        changedEntryIds.push(entry.id)
      }
    })

    // 時間差が変わったページを検出（次のページのタイムスタンプが変わった場合）
    scoreEntries.forEach((entry, index) => {
      if (prevKpmDataMap.has(entry.id)) {
        const currentKpmData = prevKpmDataMap.get(entry.id)!
        const nextEntry = scoreEntries[index + 1]
        const currentNextTimestamp = nextEntry ? nextEntry.timestamp : null

        // 次のページのタイムスタンプが変わった場合
        if (currentKpmData.nextTimestamp !== currentNextTimestamp) {
          changedEntryIds.push(entry.id)
        }
      }
    })

    // 削除されたページのデータをクリア
    const currentEntryIds = new Set(scoreEntries.map(e => e.id))
    setKpmDataMap(prev => {
      const newMap = new Map()
      prev.forEach((data, entryId) => {
        if (currentEntryIds.has(entryId)) {
          newMap.set(entryId, data)
        }
      })
      return newMap
    })

    // 変更されたページがあれば再計算
    if (changedEntryIds.length > 0) {
      recalculateKpm(changedEntryIds)
    }

    // 現在の状態を保存
    prevScoreEntriesRef.current = [...scoreEntries]
    prevKpmDataMapRef.current = new Map(kpmDataMap)
  }, [scoreEntries, recalculateKpm]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    kpmDataMap
  }
}