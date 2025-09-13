import React from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, Download, Clock, Play, Check, X } from "lucide-react"
import { LyricsInputFields } from '@/components/shared/LyricsInputFields'
import { TimestampInput } from '@/components/shared/TimestampInput'
import type { ScoreEntry, YouTubePlayer, LyricsArray } from '@/lib/types'

interface ScoreManagementSectionProps {
  scoreEntries: ScoreEntry[]
  player: YouTubePlayer | null
  editingId: string | null
  editingLyrics: LyricsArray
  editingTimestamp: string
  setEditingLyrics: React.Dispatch<React.SetStateAction<LyricsArray>>
  setEditingTimestamp: React.Dispatch<React.SetStateAction<string>>
  getCurrentLyricsIndex: () => number
  importScoreData: () => void
  exportScoreData: () => void
  deleteScoreEntry: (id: string) => void
  startEditScoreEntry: (entry: ScoreEntry) => void
  saveEditScoreEntry: () => void
  cancelEditScoreEntry: () => void
  clearAllScoreEntries: () => void
  seekTo: (time: number) => void
}

export const ScoreManagementSection: React.FC<ScoreManagementSectionProps> = ({
  scoreEntries,
  player,
  editingId,
  editingLyrics,
  editingTimestamp,
  setEditingLyrics,
  setEditingTimestamp,
  getCurrentLyricsIndex,
  importScoreData,
  exportScoreData,
  deleteScoreEntry,
  startEditScoreEntry,
  saveEditScoreEntry,
  cancelEditScoreEntry,
  clearAllScoreEntries,
  seekTo
}) => {
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

              return (
                <div
                  key={entry.id}
                  className={`p-3 border rounded-lg hover:bg-muted/50 ${
                    isCurrentlyPlaying ? "bg-primary/10 border-primary" : ""
                  }`}
                >
                  {editingId === entry.id ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-mono text-muted-foreground w-12">#{index + 1}</div>
                        <TimestampInput
                          timestamp={editingTimestamp}
                          setTimestamp={setEditingTimestamp}
                          player={player}
                          size="small"
                          showLabel={false}
                        />
                      </div>
                      
                      <LyricsInputFields
                        lyrics={editingLyrics}
                        setLyrics={setEditingLyrics}
                        size="small"
                      />
                      
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={saveEditScoreEntry}>
                          <Check className="h-4 w-4 mr-1" />
                          保存
                        </Button>
                        <Button variant="outline" size="sm" onClick={cancelEditScoreEntry}>
                          <X className="h-4 w-4 mr-1" />
                          キャンセル
                        </Button>
                      </div>
                    </div>
                  ) : (
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
                        {entry.lyrics.map((line, lineIndex) => (
                          <div key={lineIndex} className={line ? "" : "text-muted-foreground"}>
                            {line || "!"}
                          </div>
                        ))}
                      </div>
                      <div className="flex flex-col gap-1 min-w-fit self-center">
                        <Button variant="outline" size="sm" onClick={() => startEditScoreEntry(entry)} className="text-xs">
                          編集
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => deleteScoreEntry(entry.id)} className="text-xs">
                          削除
                        </Button>
                      </div>
                    </div>
                  )}
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
              全ページ削除
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}