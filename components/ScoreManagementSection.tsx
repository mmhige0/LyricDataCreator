import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, Download, Clock, Play, Copy, Edit, Trash2 } from "lucide-react"
import { useLyricsCopyPaste } from '@/hooks/useLyricsCopyPaste'
import type { ScoreEntry, YouTubePlayer } from '@/lib/types'
import { calculatePageKpm, type PageKpmInfo } from '@/lib/kpmUtils'

interface EntryDisplayProps {
  entry: ScoreEntry
  kpmData: PageKpmInfo | null
}

const EntryDisplay: React.FC<EntryDisplayProps> = React.memo(({ entry, kpmData }) => {
  if (kpmData) {
    // kpm表示モード
    return (
      <div className="space-y-1">
        {kpmData.lines.map((lineKpm, lineIndex) => (
          <div key={lineIndex} className="flex justify-between items-center">
            <div className={lineKpm.charCount > 0 ? "" : "text-muted-foreground"}>
              {entry.lyrics[lineIndex] || "!"}
            </div>
            <div className="text-xs font-mono text-muted-foreground ml-2">
              {lineKpm.kpm > 0 && `${lineKpm.kpm.toFixed(1)} kpm`}
            </div>
          </div>
        ))}
        <div className="text-xs text-muted-foreground border-t pt-1 mt-1 text-right">
          {kpmData.totalKpm.toFixed(1)} kpm
        </div>
      </div>
    )
  }

  // 歌詞のみ表示（kpm計算前）
  return (
    <>
      {entry.lyrics.map((line, lineIndex) => (
        <div key={lineIndex} className={line ? "" : "text-muted-foreground"}>
          {line || "!"}
        </div>
      ))}
    </>
  )
})

EntryDisplay.displayName = 'EntryDisplay'

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
    const changedEntryIds: string[] = []

    // 新規追加されたページを検出
    scoreEntries.forEach(entry => {
      if (!kpmDataMap.has(entry.id)) {
        changedEntryIds.push(entry.id)
      }
    })

    // 時間差が変わったページを検出（次のページのタイムスタンプが変わった場合）
    scoreEntries.forEach((entry, index) => {
      if (kpmDataMap.has(entry.id)) {
        const currentKpmData = kpmDataMap.get(entry.id)!
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
  }, [scoreEntries, kpmDataMap, recalculateKpm])

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

      <CardContent className="flex-1 overflow-auto">
        {scoreEntries.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            まだページが追加されていません
          </div>
        ) : (
          <div className="space-y-3">
            {scoreEntries.map((entry, index) => {
              const isCurrentPage = getCurrentLyricsIndex() === index
              const isEditing = editingId === entry.id
              const kpmData = kpmDataMap.get(entry.id) || null

              return (
                <div
                  key={entry.id}
                  className={`p-4 rounded-lg border transition-all duration-200 ${
                    isCurrentPage
                      ? 'bg-blue-50 dark:bg-blue-950 border-blue-300 dark:border-blue-700'
                      : isEditing
                      ? 'bg-yellow-50 dark:bg-yellow-950 border-yellow-300 dark:border-yellow-700'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-750'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className="text-sm font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {entry.timestamp.toFixed(2)}s
                      </span>
                      {isCurrentPage && (
                        <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded-full">
                          再生中
                        </span>
                      )}
                      {isEditing && (
                        <span className="text-xs bg-yellow-500 text-white px-2 py-1 rounded-full">
                          編集中
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => seekTo(entry.timestamp)}
                        title="この時間にシーク"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyLyricsToClipboard(entry.lyrics)}
                        title="歌詞をコピー"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditScoreEntry(entry)}
                        disabled={!!editingId}
                        title="編集"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteScoreEntry(entry.id)}
                        title="削除"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <EntryDisplay entry={entry} kpmData={kpmData} />
                </div>
              )
            })}
          </div>
        )}

        {copyStatus.visible && (
          <div className="fixed bottom-4 right-4 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg">
            {copyStatus.message}
          </div>
        )}

        {scoreEntries.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <Button
              variant="destructive"
              size="sm"
              onClick={clearAllScoreEntries}
              className="w-full"
            >
              すべてクリア
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}