import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Upload, Download, Clock, Play, Copy, Edit, Trash2 } from "lucide-react"
import { useLyricsCopyPaste } from '@/hooks/useLyricsCopyPaste'
import { useKpmCalculation } from '@/hooks/useKpmCalculation'
import type { ScoreEntry, YouTubePlayer } from '@/lib/types'
import type { PageKpmInfo } from '@/lib/kpmUtils'

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
  bulkAdjustTimings: (offsetSeconds: number) => void
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
  seekTo,
  bulkAdjustTimings
}) => {
  const { copyLyricsToClipboard, copyStatus } = useLyricsCopyPaste()
  const { kpmDataMap } = useKpmCalculation(scoreEntries)
  const [adjustValue, setAdjustValue] = useState<string>('0.1')


  const handleBulkTimingAdjust = () => {
    const value = parseFloat(adjustValue)
    if (isNaN(value)) {
      alert('正しい数値を入力してください。')
      return
    }

    if (Math.abs(value) > 10) {
      alert('調整値は-10秒から+10秒の範囲で入力してください。')
      return
    }

    bulkAdjustTimings(value)
  }

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
          <div className="flex-1 flex flex-col min-h-0">
            <div className="space-y-3 flex-1 overflow-y-auto pr-2 min-h-0">
            {scoreEntries.map((entry, index) => {
              const isCurrentlyPlaying = getCurrentLyricsIndex() === index
              const isEditing = editingId === entry.id
              const kpmData = kpmDataMap.get(entry.id) || null

              return (
                <div
                  key={entry.id}
                  className={`p-3 border rounded-lg hover:bg-muted/50 ${
                    isCurrentlyPlaying ? "bg-primary/10 border-primary" : ""
                  } ${isEditing ? "bg-blue-50 border-blue-200" : ""}`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col gap-1 min-w-fit justify-between self-stretch">
                      <div className="text-sm font-mono text-muted-foreground flex items-center justify-between">
                        <span>#{index + 1}</span>
                        {scoreEntries[index + 1] && (
                          <span className="text-xs">
                            {(scoreEntries[index + 1].timestamp - entry.timestamp).toFixed(2)}s
                          </span>
                        )}
                      </div>
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
                      <EntryDisplay entry={entry} kpmData={kpmData} />
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

            <div className="mt-3 pt-3 border-t flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">全ページタイム調整</span>
                <Input
                  type="number"
                  step="0.1"
                  min="-10"
                  max="10"
                  value={adjustValue}
                  onChange={(e) => setAdjustValue(e.target.value)}
                  placeholder="秒"
                  className="w-20 text-xs h-7"
                  disabled={scoreEntries.length === 0}
                />
                <Button
                  onClick={handleBulkTimingAdjust}
                  disabled={scoreEntries.length === 0}
                  variant="outline"
                  size="sm"
                  className="px-3 text-xs h-7"
                >
                  適用
                </Button>
              </div>
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
          </div>
        )}

      </CardContent>
    </Card>
  )
}