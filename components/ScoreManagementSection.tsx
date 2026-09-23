import { memo, useState, type FC, type MouseEvent } from 'react'
import { toast } from 'sonner'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Upload, Download, Clock, Play, Plus, Trash2, Undo, Redo, ScrollText, Scroll } from "lucide-react"
import { useLyricsCopyPaste } from '@/hooks/useLyricsCopyPaste'
import { useKpmCalculation } from '@/hooks/useKpmCalculation'
import { useAutoScroll } from '@/hooks/useAutoScroll'
import { InlineLyricsInput, type InlineLyricsActions } from '@/components/InlineLyricsInput'
import { PageActionsMenu } from '@/components/PageActionsMenu'
import { PageTimestampInput, PageLyricsActions } from '@/components/PageEditControls'
import type { ScoreEntry, YouTubePlayer, LyricsArray } from '@/lib/types'
import type { LyricsPosition } from '@/lib/lyricsNavigation'
import type { PageKpmInfo } from '@/lib/kpmUtils'

interface EntryDisplayProps {
  selectedLyrics?: LyricsPosition | null
  inlineActions?: InlineLyricsActions
  pageNumber: number
  entry: ScoreEntry
  kpmData: PageKpmInfo | null
  kpmMode: 'roma' | 'kana'
}

const EntryDisplay: FC<EntryDisplayProps> = memo(({ entry, kpmData, kpmMode, inlineActions, pageNumber, selectedLyrics }) => {
  return (
    <div className="space-y-0.5">
      {entry.lyrics.map((line, lineIndex) => {
        const lineKpm = kpmData?.lines[lineIndex]
        return (
          <div key={lineIndex} className="flex justify-between items-center">
            <div className="flex-1 min-w-0">
              {inlineActions ? (
                <InlineLyricsInput entry={entry} line={lineIndex} pageNumber={pageNumber} actions={inlineActions} selected={selectedLyrics?.id === entry.id && selectedLyrics.line === lineIndex} />
              ) : (
                <div className={`select-text break-words ${line ? "text-foreground" : "text-muted-foreground"}`}>
                  {line || "!"}
                </div>
              )}
            </div>
            {lineKpm && lineKpm.charCount[kpmMode] > 0 && (
              <div className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground ml-2 select-none">
                {lineKpm.kpm[kpmMode].toFixed(0)} kpm
              </div>
            )}
          </div>
        )
      })}
      {kpmData && <div className="mt-1 text-right text-xs tabular-nums text-muted-foreground" aria-label={`ページ${pageNumber}の合計KPM`}>
        合計 {kpmData.totalKpm[kpmMode].toFixed(0)} kpm
      </div>}
    </div>
  )
})

EntryDisplay.displayName = 'EntryDisplay'

interface ScoreManagementSectionProps {
  addEmptyScoreEntry?: () => void
  selectedLyrics?: LyricsPosition | null
  inlineActions?: InlineLyricsActions
  onTimestampCapture?: (id: string) => void
  onTimestampChange?: (value: string, id: string) => boolean | undefined
  onReplacePageLyrics?: (id: string, lyrics: LyricsArray, expected?: LyricsArray) => boolean
  isInlineEditing?: boolean
  scoreEntries: ScoreEntry[]
  duration: number
  player: YouTubePlayer | null
  getCurrentLyricsIndex: () => number
  importScoreData: () => void
  exportScoreData: (event?: MouseEvent<HTMLButtonElement>) => void
  deleteScoreEntry: (id: string) => void
  clearAllScoreEntries: () => void
  seekToAndPlay: (time: number) => void
  bulkAdjustTimings: (offsetSeconds: number) => void
  undoLastOperation: () => void
  redoLastOperation: () => void
  canUndo: boolean
  canRedo: boolean
  readOnly?: boolean
  kpmModeOverride?: 'roma' | 'kana'
  pageNumberOffset?: number
  timeOffsetControl?: {
    value: string
    displayValue: number
    onChange: (value: string) => void
    onApply: () => void
    onReset: () => void
  }
}

export const ScoreManagementSection: FC<ScoreManagementSectionProps> = ({
  addEmptyScoreEntry,
  selectedLyrics,
  inlineActions,
  isInlineEditing = false,
  onTimestampChange,
  onTimestampCapture,
  onReplacePageLyrics,
  scoreEntries,
  duration,
  player,
  getCurrentLyricsIndex,
  importScoreData,
  exportScoreData,
  deleteScoreEntry,
  clearAllScoreEntries,
  seekToAndPlay,
  bulkAdjustTimings,
  undoLastOperation,
  redoLastOperation,
  canUndo,
  canRedo,
  readOnly = false,
  kpmModeOverride,
  pageNumberOffset = 0,
  timeOffsetControl,
}) => {
  const { copyLyricsToClipboard } = useLyricsCopyPaste()
  const { kpmDataMap } = useKpmCalculation(scoreEntries, duration)
  const [adjustValue, setAdjustValue] = useState<string>('0')
  const [isLyricsFocused, setIsLyricsFocused] = useState(false)
  const [autoScroll, setAutoScroll] = useState<boolean>(readOnly ? true : false)
  const [kpmMode, setKpmMode] = useState<'roma' | 'kana'>('roma')
  const effectiveKpmMode = kpmModeOverride ?? kpmMode
  const { entryRefs, scrollContainerRef } = useAutoScroll({
    getCurrentLyricsIndex,
    scoreEntries,
    enabled: autoScroll && !isInlineEditing && !isLyricsFocused,
    onUserScroll: () => setAutoScroll(false)
  })

  const selectedEntry = scoreEntries.find(entry => entry.id === selectedLyrics?.id)
  const selectedPageNumber = selectedEntry ? scoreEntries.indexOf(selectedEntry) + 1 - pageNumberOffset : null

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
    <Card className="bg-card text-card-foreground border shadow-lg h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-amber-500 text-white">
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
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
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
                  className={`px-2 py-1 rounded border text-xs font-mono ${kpmMode === 'roma' ? 'border-primary text-primary bg-primary/10' : 'border-muted-foreground/30'
                    }`}
                >
                  roma
                </button>
                <button
                  type="button"
                  onClick={() => setKpmMode('kana')}
                  className={`px-2 py-1 rounded border text-xs font-mono ${kpmMode === 'kana' ? 'border-primary text-primary bg-primary/10' : 'border-muted-foreground/30'
                    }`}
                >
                  kana
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={undoLastOperation}
                aria-label="元に戻す"
                disabled={!canUndo}
                className="text-xs h-7"
              >
                <Undo className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={redoLastOperation}
                aria-label="やり直す"
                disabled={!canRedo}
                className="text-xs h-7"
              >
                <Redo className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {!readOnly && (
          <div data-page-toolbar className="mb-2 flex flex-wrap items-center gap-2 border-y py-2" aria-label="選択ページの編集">
            <span className="min-w-20 text-sm font-medium text-primary" aria-live="polite">{selectedPageNumber === null ? '未選択' : `#${selectedPageNumber}`}</span>
            {onTimestampCapture && <Button variant="outline" size="sm" disabled={!player || !selectedEntry}
              onClick={() => selectedEntry && onTimestampCapture(selectedEntry.id)}>
              <Clock className="size-4" />タイムスタンプ入力 <kbd className="rounded border px-1 text-xs">F2</kbd>
            </Button>}
            {onReplacePageLyrics && (selectedEntry
              ? <PageLyricsActions key={selectedEntry.id} entry={selectedEntry} onReplace={onReplacePageLyrics} />
              : <Button variant="outline" size="sm" disabled>かな変換</Button>)}
          </div>
        )}
        <div className="flex-1 flex flex-col min-h-0">
            <div
              ref={scrollContainerRef}
              className={`flex-1 overflow-y-auto min-h-0 ${readOnly ? 'space-y-4 pr-2' : 'divide-y'}`}
              onFocusCapture={event => {
                const focused = event.target instanceof Element && Boolean(event.target.closest('[data-page-id]'))
                setIsLyricsFocused(focused)
                if (focused) setAutoScroll(false)
              }}
              onBlurCapture={event => {
                if (!(event.relatedTarget instanceof Element) || !event.relatedTarget.closest('[data-page-id]')) setIsLyricsFocused(false)
              }}
            >
              {scoreEntries.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">ページがありません。</p>}
              {scoreEntries.map((entry, index) => {
                const isSelected = selectedLyrics?.id === entry.id
                const isCurrentlyPlaying = getCurrentLyricsIndex() === index
                const kpmData = kpmDataMap.get(entry.id) || null
                const isClickable = readOnly && Boolean(player)
                const displayPageNumber = Math.max(0, index + 1 - pageNumberOffset)

                return (
                  <div
                    key={entry.id}
                    data-page-id={readOnly ? undefined : entry.id}
                    ref={(el) => { entryRefs.current[index] = el }}
                    className={readOnly
                      ? `relative rounded-lg border bg-card p-3 ${isCurrentlyPlaying ? 'border-primary/40 bg-secondary' : ''} ${isClickable ? 'cursor-pointer' : ''}`
                      : `relative border-l-2 px-2 py-2 ${isSelected ? 'border-l-primary bg-primary/5' : 'border-l-transparent'} ${isCurrentlyPlaying ? 'bg-secondary/50' : ''}`}
                    onFocusCapture={event => {
                      if (!readOnly && event.target instanceof Element && !event.target.closest('[data-lyrics-navigation]')) {
                        inlineActions?.onSelect?.({ id: entry.id, line: isSelected ? selectedLyrics.line : 0 })
                      }
                    }}
                    onClick={
                      isClickable
                        ? () => {
                          seekToAndPlay(entry.timestamp)
                        }
                        : event => {
                          if (event.target instanceof Element && !event.target.closest('button, input, [data-lyrics-navigation], [data-page-menu]')) {
                            inlineActions?.onSelect?.({ id: entry.id, line: isSelected ? selectedLyrics.line : 0 })
                          }
                        }
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
                    <div className={readOnly ? 'space-y-2' : 'grid grid-cols-[minmax(0,1fr)_2rem] gap-x-2 gap-y-1 sm:grid-cols-[8.75rem_minmax(0,1fr)_2rem]'}>
                      <div className="col-start-1 row-start-1 flex flex-wrap items-center gap-2 sm:block">
                        <div className="flex items-center gap-2 text-xs tabular-nums text-muted-foreground sm:mb-1">
                          <span>#{displayPageNumber}</span>
                          {!readOnly && scoreEntries[index + 1] && <span title="次のページまでの時間">{(scoreEntries[index + 1].timestamp - entry.timestamp).toFixed(2)}s</span>}
                          {isCurrentlyPlaying && <span aria-label="再生中" title="再生中" className="text-primary">▶</span>}
                        </div>
                        {!readOnly && <div className="flex items-center gap-1">
                          {onTimestampChange && <PageTimestampInput timestamp={entry.timestamp} pageNumber={displayPageNumber} onCommit={value => onTimestampChange(value, entry.id)} />}
                          <Button variant="ghost" size="sm" className="size-8 p-0 [@media(pointer:coarse)]:size-11" aria-label={`ページ${displayPageNumber}から再生`} title="このページから再生"
                            disabled={!player} onClick={() => seekToAndPlay(entry.timestamp)}><Play className="size-4" /></Button>
                        </div>}
                      </div>
                      <div className={`${readOnly ? 'text-base' : 'col-span-2 row-start-2 text-sm sm:col-span-1 sm:col-start-2 sm:row-start-1'} min-w-0 ${isCurrentlyPlaying ? 'font-semibold text-primary' : ''}`}>
                        <EntryDisplay selectedLyrics={selectedLyrics} entry={entry} kpmData={kpmData} kpmMode={effectiveKpmMode} pageNumber={displayPageNumber} inlineActions={!readOnly ? inlineActions : undefined} />
                      </div>
                      {!readOnly && <div className="col-start-2 row-start-1 sm:col-start-3">
                        <PageActionsMenu pageNumber={displayPageNumber} empty={entry.lyrics.every(line => !line.trim())}
                          onCopy={() => { void copyLyricsToClipboard(entry.lyrics) }}
                          onClear={onReplacePageLyrics ? () => onReplacePageLyrics(entry.id, ['', '', '', '']) : undefined}
                          onDelete={() => deleteScoreEntry(entry.id)} />
                      </div>}
                    </div>

                  </div>
                )
              })}
            </div>

            {!readOnly && addEmptyScoreEntry && <div className="flex shrink-0 justify-center border-t py-2">
              <Button type="button" variant="outline" className="size-8 rounded-full p-0 [@media(pointer:coarse)]:size-11" aria-label="空ページを追加" title="空ページを追加" onClick={() => addEmptyScoreEntry()}>
                <Plus className="size-4" aria-hidden="true" />
              </Button>
            </div>}

            {/* 編集モード: タイム調整 + 自動スクロール + 全ページ削除 */}
            {!readOnly && (
              <div className="mt-2 pt-2 border-t flex flex-wrap gap-2 justify-between items-center">
                <div className="flex flex-wrap items-center gap-2">
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
                    className={`text-xs ${autoScroll ? 'bg-primary/10 border-primary/30 text-primary' : ''}`}
                  >
                    {autoScroll ? <ScrollText className="h-3 w-3 mr-1" /> : <Scroll className="h-3 w-3 mr-1" />}
                    自動スクロール
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllScoreEntries}
                    className="text-muted-foreground hover:text-destructive hover:border-destructive/40 hover:bg-muted text-xs"
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
                    <span className="font-medium text-foreground">タイム調整</span>
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
                  className={`text-xs px-2 ${autoScroll ? 'bg-primary/10 border-primary/30 text-primary' : ''}`}
                  aria-label="自動スクロール"
                >
                  {autoScroll ? <ScrollText className="h-4 w-4" /> : <Scroll className="h-4 w-4" />}
                </Button>
              </div>
            )}
          </div>

      </CardContent>
    </Card>
  )
}
