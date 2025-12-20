import { memo, useState, type FC, type MouseEvent } from 'react'
import { toast } from 'sonner'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Upload, Download, Clock, Play, Copy, Edit, Trash2, Undo, Redo, ScrollText, Scroll } from "lucide-react"
import { useLyricsCopyPaste } from '@/hooks/useLyricsCopyPaste'
import { useKpmCalculation } from '@/hooks/useKpmCalculation'
import { useAutoScroll } from '@/hooks/useAutoScroll'
import type { ScoreEntry, YouTubePlayer } from '@/lib/types'
import type { PageKpmInfo } from '@/lib/kpmUtils'

interface EntryDisplayProps {
  entry: ScoreEntry
  kpmData: PageKpmInfo | null
  kpmMode: 'roma' | 'kana'
}

const EntryDisplay: FC<EntryDisplayProps> = memo(({ entry, kpmData, kpmMode }) => {
  return (
    <div className="space-y-1">
      {entry.lyrics.map((line, lineIndex) => {
        const lineKpm = kpmData?.lines[lineIndex]
        return (
          <div key={lineIndex} className="flex justify-between items-center">
            <div className="flex-1 min-w-0">
              <div className={line ? "" : "text-muted-foreground"}>
                {line || "!"}
              </div>
            </div>
            {lineKpm && lineKpm.charCount[kpmMode] > 0 && (
              <div className="text-xs font-mono text-muted-foreground ml-2">
                {lineKpm.kpm[kpmMode].toFixed(1)} kpm
              </div>
            )}
          </div>
        )
      })}
      {kpmData && (
        <div className="text-xs text-muted-foreground border-t pt-1 mt-1 text-right leading-tight">
          {kpmData.totalKpm[kpmMode].toFixed(1)} kpm
        </div>
      )}
    </div>
  )
})

EntryDisplay.displayName = 'EntryDisplay'

interface ScoreManagementSectionProps {
  scoreEntries: ScoreEntry[]
  duration: number
  player: YouTubePlayer | null
  editingId: string | null
  getCurrentLyricsIndex: () => number
  importScoreData: () => void
  exportScoreData: (event?: MouseEvent<HTMLButtonElement>) => void
  deleteScoreEntry: (id: string) => void
  startEditScoreEntry: (entry: ScoreEntry) => void
  clearAllScoreEntries: () => void
  seekToAndPlay: (time: number) => void
  bulkAdjustTimings: (offsetSeconds: number) => void
  undoLastOperation: () => void
  redoLastOperation: () => void
  canUndo: boolean
  canRedo: boolean
  readOnly?: boolean
  timeOffsetControl?: {
    value: string
    displayValue: number
    onChange: (value: string) => void
    onApply: () => void
    onReset: () => void
  }
}

export const ScoreManagementSection: FC<ScoreManagementSectionProps> = ({
  scoreEntries,
  duration,
  player,
  editingId,
  getCurrentLyricsIndex,
  importScoreData,
  exportScoreData,
  deleteScoreEntry,
  startEditScoreEntry,
  clearAllScoreEntries,
  seekToAndPlay,
  bulkAdjustTimings,
  undoLastOperation,
  redoLastOperation,
  canUndo,
  canRedo,
  readOnly = false,
  timeOffsetControl,
}) => {
  const { copyLyricsToClipboard, copyStatus } = useLyricsCopyPaste()
  const { kpmDataMap } = useKpmCalculation(scoreEntries, duration)
  const [adjustValue, setAdjustValue] = useState<string>('0')
  const [autoScroll, setAutoScroll] = useState<boolean>(readOnly ? true : false)
  const [kpmMode, setKpmMode] = useState<'roma' | 'kana'>('roma')

  const { entryRefs, scrollContainerRef } = useAutoScroll({
    getCurrentLyricsIndex,
    scoreEntries,
    enabled: autoScroll,
    onUserScroll: () => setAutoScroll(false)
  })


  const handleBulkTimingAdjust = () => {
    const value = parseFloat(adjustValue)
    if (isNaN(value)) {
      toast.error('正しい数値を入力してください。')
      return
    }

    if (Math.abs(value) > 10) {
      toast.error('調整値は-10秒から+10秒の範囲で入力してください。')
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
            ページ一覧
          </CardTitle>
          {!readOnly && (
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
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col min-h-0">
        {/* 動画の総時間表示とUndo/Redoボタン */}
        {!readOnly && (
          <div className="mb-4 flex items-center justify-between">
            {duration > 0 && (
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock className="h-4 w-4" />
                動画の総時間: {duration.toFixed(1)}秒
              </div>
            )}
            <div className="flex gap-2 ml-auto items-center">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <button
                  type="button"
                  onClick={() => setKpmMode('roma')}
                  className={`px-2 py-1 rounded border text-xs font-mono ${
                    kpmMode === 'roma' ? 'border-primary text-primary bg-primary/10' : 'border-muted-foreground/30'
                  }`}
                >
                  roma
                </button>
                <button
                  type="button"
                  onClick={() => setKpmMode('kana')}
                  className={`px-2 py-1 rounded border text-xs font-mono ${
                    kpmMode === 'kana' ? 'border-primary text-primary bg-primary/10' : 'border-muted-foreground/30'
                  }`}
                >
                  kana
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={undoLastOperation}
                disabled={!canUndo}
                className="text-xs h-7"
              >
                <Undo className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={redoLastOperation}
                disabled={!canRedo}
                className="text-xs h-7"
              >
                <Redo className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {scoreEntries.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            ページがありません。歌詞を入力して追加してください。
          </p>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <div ref={scrollContainerRef} className="space-y-3 flex-1 overflow-y-auto pr-2 min-h-0">
            {scoreEntries.map((entry, index) => {
              const isCurrentlyPlaying = getCurrentLyricsIndex() === index
              const isEditing = editingId === entry.id
              const kpmData = kpmDataMap.get(entry.id) || null
              const isClickable = readOnly && Boolean(player)

              return (
                <div
                  key={entry.id}
                  ref={(el) => { entryRefs.current[index] = el }}
                  className={`p-3 border rounded-lg hover:bg-muted/50 ${
                    isCurrentlyPlaying ? "bg-primary/10 border-primary" : ""
                  } ${isEditing ? "bg-blue-50 border-blue-200" : ""} ${
                    isClickable ? "cursor-pointer" : ""
                  }`}
                  onClick={
                    isClickable
                      ? () => {
                          seekToAndPlay(entry.timestamp)
                        }
                      : undefined
                  }
                  role={isClickable ? 'button' : undefined}
                  tabIndex={isClickable ? 0 : undefined}
                  onKeyDown={
                    isClickable
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            seekToAndPlay(entry.timestamp)
                          }
                        }
                      : undefined
                  }
                >
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col gap-1 min-w-fit justify-between self-stretch">
                      <div className="text-sm font-mono text-muted-foreground flex items-center justify-between">
                        <span>#{index + 1}</span>
                        {!readOnly && scoreEntries[index + 1] && (
                          <span className="text-xs">
                            {(scoreEntries[index + 1].timestamp - entry.timestamp).toFixed(2)}s
                          </span>
                        )}
                      </div>
                      {!readOnly && (
                        <div className="mt-auto">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => seekToAndPlay(entry.timestamp)}
                            disabled={!player}
                            className="text-xs font-mono h-6 px-2"
                          >
                            <Play className="h-3 w-3 mr-1" />
                            {entry.timestamp.toFixed(2)}s
                          </Button>
                        </div>
                      )}
                    </div>
                    <div className={`flex-1 text-sm ${isCurrentlyPlaying ? "font-semibold text-primary" : ""}`}>
                      <EntryDisplay entry={entry} kpmData={kpmData} kpmMode={kpmMode} />
                    </div>
                    {!readOnly && (
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
                    )}
                  </div>
                </div>
              )
            })}
            </div>

            {/* 編集モード: タイム調整 + 自動スクロール + 全ページ削除 */}
            {!readOnly && (
              <div className="mt-3 pt-3 border-t flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-muted-foreground">全ページタイム調整</span>
                  <Input
                    type="number"
                    step="0.01"
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
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAutoScroll(!autoScroll)}
                    className={`text-xs ${autoScroll ? 'bg-blue-50 border-blue-200' : ''}`}
                  >
                    {autoScroll ? <ScrollText className="h-3 w-3 mr-1" /> : <Scroll className="h-3 w-3 mr-1" />}
                    自動スクロール
                  </Button>
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

            {/* タイピングモード: 自動スクロールボタンのみ */}
            {readOnly && scoreEntries.length > 0 && (
              <div className="mt-3 pt-3 border-t flex flex-wrap items-center gap-3 justify-between">
                {timeOffsetControl && (
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-200">タイム調整</span>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        step="0.01"
                        min="-100"
                        max="100"
                        value={timeOffsetControl.value}
                        onChange={(e) => timeOffsetControl.onChange(e.target.value)}
                        onBlur={timeOffsetControl.onApply}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') timeOffsetControl.onApply()
                        }}
                        className="w-24 h-9 text-sm"
                      />
                      <Button variant="outline" size="sm" onClick={timeOffsetControl.onApply} className="text-xs">
                        適用
                      </Button>
                      <Button variant="ghost" size="sm" onClick={timeOffsetControl.onReset} className="text-xs">
                        リセット
                      </Button>
                    </div>
                  </div>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAutoScroll(!autoScroll)}
                  className={`text-xs px-2 ${autoScroll ? 'bg-blue-50 border-blue-200' : ''}`}
                  aria-label="自動スクロール"
                >
                  {autoScroll ? <ScrollText className="h-4 w-4" /> : <Scroll className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </div>
        )}

      </CardContent>
    </Card>
  )
}
