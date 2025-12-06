import { useState, useEffect, useRef } from 'react'
import type { ScoreEntry } from '@/lib/types'
import { buildPageKpmMap, type PageKpmInfo } from '@/lib/kpmUtils'

export const useKpmCalculation = (scoreEntries: ScoreEntry[], totalDuration: number) => {
  const [kpmDataMap, setKpmDataMap] = useState<Map<string, PageKpmInfo>>(new Map())
  const processedSignatureRef = useRef<string>('')

  useEffect(() => {
    const signature = JSON.stringify({ scoreEntries, totalDuration })
    if (signature === processedSignatureRef.current) return
    processedSignatureRef.current = signature

    const safeDuration = totalDuration > 0 ? totalDuration : (scoreEntries.at(-1)?.timestamp ?? 0) + 1

    const recalc = async () => {
      const map = await buildPageKpmMap({
        scoreEntries,
        totalDuration: safeDuration,
      })
      setKpmDataMap(map)
    }

    recalc().catch((error) => {
      console.error('kpm calculation error', error)
    })
  }, [scoreEntries, totalDuration])

  return {
    kpmDataMap,
  }
}
