import { useState, useEffect, useCallback, useRef } from 'react'
import type { ScoreEntry } from '@/lib/types'
import { calculatePageKpm, type PageKpmInfo } from '@/lib/kpmUtils'

// エントリの変更検出用のキーを生成
const getEntrySignature = (entry: ScoreEntry, nextTimestamp: number | null): string => {
  return `${entry.id}_${entry.timestamp}_${JSON.stringify(entry.lyrics)}_${nextTimestamp}`
}

export const useKpmCalculation = (scoreEntries: ScoreEntry[]) => {
  const [kpmDataMap, setKpmDataMap] = useState<Map<string, PageKpmInfo>>(new Map())
  const processedSignaturesRef = useRef<Map<string, string>>(new Map())
  const isCalculatingRef = useRef(false)

  useEffect(() => {
    // 既に計算中の場合はスキップ
    if (isCalculatingRef.current) return

    const recalculateKpm = async () => {
      isCalculatingRef.current = true

      const currentEntryIds = new Set(scoreEntries.map(e => e.id))
      const newSignatures = new Map<string, string>()
      const updates = new Map<string, PageKpmInfo>()
      const entriesToCalculate: Array<{
        entry: ScoreEntry
        nextTimestamp: number | null
      }> = []

      // 計算が必要なエントリを収集
      for (let index = 0; index < scoreEntries.length; index++) {
        const entry = scoreEntries[index]
        const nextEntry = scoreEntries[index + 1]
        const nextTimestamp = nextEntry ? nextEntry.timestamp : null
        const signature = getEntrySignature(entry, nextTimestamp)

        newSignatures.set(entry.id, signature)

        // 前回と署名が異なる場合は再計算が必要
        if (processedSignaturesRef.current.get(entry.id) !== signature) {
          entriesToCalculate.push({ entry, nextTimestamp })
        }
      }

      // バッチで計算を実行
      if (entriesToCalculate.length > 0) {
        await Promise.all(
          entriesToCalculate.map(async ({ entry, nextTimestamp }) => {
            try {
              const pageKpmInfo = await calculatePageKpm(entry, nextTimestamp)
              updates.set(entry.id, pageKpmInfo)
            } catch (error) {
              console.error('kpm calculation error for entry:', entry.id, error)
            }
          })
        )
      }

      // 状態を一度だけ更新
      setKpmDataMap(prev => {
        const newMap = new Map<string, PageKpmInfo>()
        
        // 既存のデータをコピー（削除されたエントリは除外）
        prev.forEach((data, entryId) => {
          if (currentEntryIds.has(entryId)) {
            newMap.set(entryId, data)
          }
        })
        
        // 新しく計算されたデータを追加
        updates.forEach((data, entryId) => {
          newMap.set(entryId, data)
        })
        
        return newMap
      })

      // 処理済み署名を更新
      processedSignaturesRef.current = newSignatures
      isCalculatingRef.current = false
    }

    recalculateKpm()
  }, [scoreEntries])

  return {
    kpmDataMap
  }
}