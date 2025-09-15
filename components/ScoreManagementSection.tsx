import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, Download, Clock, Play, Copy, Edit, Trash2 } from "lucide-react"
import { useLyricsCopyPaste } from '@/hooks/useLyricsCopyPaste'
import type { ScoreEntry, YouTubePlayer } from '@/lib/types'
import { calculatePageKpm, type PageKpmInfo } from '@/lib/kpmUtils'

interface ScoreManagementSectionProps {
  scoreEntries: ScoreEntry[]
  player: YouTubePlayer | null
  editingId: string | null
  getCurrentLyricsIndex: () => number
  importScoreData: () => void
  exportScoreData: () => void
  deleteScoreEntry: (id: string) => void
  startEditScoreEntry: (entry: ScoreEntry) => void
  clearAllScoreEntries: () => void
  seekTo: (time: number) => void
}

export const ScoreManagementSection: React.FC<ScoreManagementSectionProps> = ({
  scoreEntries,
  player,
  editingId,
  getCurrentLyricsIndex,
  importScoreData,
  exportScoreData,
  deleteScoreEntry,
  startEditScoreEntry,
  clearAllScoreEntries,
  seekTo
}) => {
  const { copyLyricsToClipboard, copyStatus } = useLyricsCopyPaste()
  const [kpmDataMap, setKpmDataMap] = useState<Map<string, PageKpmInfo>>(new Map())
  const [calculatingIds, setCalculatingIds] = useState<Set<string>>(new Set())

  // 単一ページのKPM計算
  const calculateSinglePageKpm = useCallback(async (entry: ScoreEntry, index: number) => {
    const nextEntry = scoreEntries[index + 1]
    const nextTimestamp = nextEntry ? nextEntry.timestamp : null

    setCalculatingIds(prev => new Set(prev).add(entry.id))

    try {
      const pageKpmInfo = await calculatePageKpm(entry, nextTimestamp)
      setKpmDataMap(prev => new Map(prev).set(entry.id, pageKpmInfo))
    } catch (error) {
      console.error('KPM calculation error for entry:', entry.id, error)
    } finally {
      setCalculatingIds(prev => {
        const newSet = new Set(prev)
        newSet.delete(entry.id)
        return newSet
      })
    }
  }, [scoreEntries])

  // scoreEntriesの変更を監視して必要なページのみ再計算
  useEffect(() => {
    scoreEntries.forEach((entry, index) => {
      // まだ計算されていないページのみ計算
      if (!kpmDataMap.has(entry.id) && !calculatingIds.has(entry.id)) {
        calculateSinglePageKpm(entry, index)
      }
    })

    // 削除されたページのデータをクリーンアップ
    const currentIds = new Set(scoreEntries.map(entry => entry.id))
    setKpmDataMap(prev => {
      const newMap = new Map()
      prev.forEach((data, id) => {
        if (currentIds.has(id)) {
          newMap.set(id, data)
        }
      })
      return newMap
    })
  }, [scoreEntries, calculatingIds])

  return (
    <Card className="bg-white dark:bg-slate-900 border shadow-lg h-full flex flex-col">
      <CardHeader className="pb-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-purple-500 text-white">
              <Clock className="h-5 w-5" />
            </div>
            ページ一覧 ({scoreEntries.length}件)
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={importScoreData}>
              <Upload className="h-4 w-4 mr-2" />
              インポート
            </Button>
            <Button variant="outline" size="sm" onClick={exportScoreData} disabled={scoreEntries.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              エクスポート
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col min-h-0">
        {scoreEntries.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            ページがありません。歌詞を入力して追加してください。
          </p>
        ) : (
          <div className="space-y-3 flex-1 overflow-y-auto pr-2 min-h-0">
            {scoreEntries.map((entry, index) => {
              const isCurrentlyPlaying = getCurrentLyricsIndex() === index
              const isEditing = editingId === entry.id

              return (
                <div
                  key={entry.id}
                  className={`p-3 border rounded-lg hover:bg-muted/50 ${
                    isCurrentlyPlaying ? "bg-primary/10 border-primary" : ""
                  } ${isEditing ? "bg-blue-50 border-blue-200" : ""}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col gap-1 min-w-fit justify-between self-stretch">
                      <div className="text-sm font-mono text-muted-foreground">#{index + 1}</div>
                      <div className="mt-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => seekTo(entry.timestamp)}
                          disabled={!player}
                          className="text-xs font-mono h-6 px-2"
                        >
                          <Play className="h-3 w-3 mr-1" />
                          {entry.timestamp.toFixed(2)}s
                        </Button>
                      </div>
                    </div>
                    <div className={`flex-1 text-sm ${isCurrentlyPlaying ? "font-semibold text-primary" : ""}`}>
                      {kpmDataMap.has(entry.id) && !calculatingIds.has(entry.id) ? (
                        // KPM表示モード（常に表示）
                        <div className="space-y-1">
                          {kpmDataMap.get(entry.id)!.lines.map((lineKpm, lineIndex) => (
                            <div key={lineIndex} className="flex justify-between items-center">
                              <div className={lineKpm.charCount > 0 ? "" : "text-muted-foreground"}>
                                {entry.lyrics[lineIndex] || "!"}
                              </div>
                              <div className="text-xs font-mono text-muted-foreground ml-2">
                                {lineKpm.kpm > 0 && `${lineKpm.kpm.toFixed(1)} KPM`}
                              </div>
                            </div>
                          ))}
                          <div className="text-xs text-muted-foreground border-t pt-1 mt-1 text-right">
                            {kpmDataMap.get(entry.id)!.totalKpm.toFixed(1)} KPM
                          </div>
                        </div>
                      ) : calculatingIds.has(entry.id) ? (
                        // 計算中
                        <div className="text-muted-foreground">KPM計算中...</div>
                      ) : (
                        // 歌詞のみ表示（KPM計算前）
                        entry.lyrics.map((line, lineIndex) => (
                          <div key={lineIndex} className={line ? "" : "text-muted-foreground"}>
                            {line || "!"}
                          </div>
                        ))
                      )}
                    </div>
                    <div className="flex flex-col gap-1 min-w-fit self-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyLyricsToClipboard(entry.lyrics)}
                        className={`text-xs ${copyStatus === 'success' ? 'bg-green-50 border-green-200' : copyStatus === 'error' ? 'bg-red-50 border-red-200' : ''}`}
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        コピー
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEditScoreEntry(entry)}
                        className={`text-xs ${isEditing ? 'bg-blue-100 border-blue-300' : ''}`}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        編集
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => deleteScoreEntry(entry.id)} className="text-xs">
                        <Trash2 className="h-3 w-3 mr-1" />
                        削除
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
        
        {scoreEntries.length > 0 && (
          <div className="mt-4 pt-3 border-t flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllScoreEntries}
              className="text-black hover:bg-gray-50 text-xs"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              全ページ削除
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}