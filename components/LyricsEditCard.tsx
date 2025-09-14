import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, ClipboardPaste, Check, X, Edit, Eraser, Languages } from "lucide-react"
import { LyricsInputFields } from '@/components/LyricsInputFields'
import { TimestampInput } from '@/components/TimestampInput'
import { useLyricsCopyPaste } from '@/hooks/useLyricsCopyPaste'
import { convertLyricsArrayToHiragana } from '@/lib/hiraganaUtils'
import type { YouTubePlayer, LyricsArray, ScoreEntry } from '@/lib/types'

interface LyricsEditCardProps {
  // Common props
  lyrics: LyricsArray
  setLyrics: React.Dispatch<React.SetStateAction<LyricsArray>>
  timestamp: string
  setTimestamp: React.Dispatch<React.SetStateAction<string>>
  player: YouTubePlayer | null
  seekToInput?: (inputValue: string) => void

  // Mode-specific props
  mode: 'add' | 'edit'
  editingEntry?: ScoreEntry | null
  editingEntryIndex?: number

  // Callbacks
  onAdd?: () => void
  onSave?: () => void
  onCancel?: () => void

  // Refs (for add mode)
  lyricsInputRefs?: React.MutableRefObject<(HTMLInputElement | null)[]>
  timestampInputRef?: React.MutableRefObject<HTMLInputElement | null>

  // Timestamp offset props
  timestampOffset?: number
  setTimestampOffset?: (offset: number) => void
  getCurrentTimestamp?: (offset: number) => string
}

export const LyricsEditCard: React.FC<LyricsEditCardProps> = ({
  lyrics,
  setLyrics,
  timestamp,
  setTimestamp,
  player,
  seekToInput,
  mode,
  editingEntryIndex,
  onAdd,
  onSave,
  onCancel,
  lyricsInputRefs,
  timestampInputRef,
  timestampOffset,
  setTimestampOffset,
  getCurrentTimestamp
}) => {
  const { pasteLyricsFromClipboard, copyStatus } = useLyricsCopyPaste()
  const [isConverting, setIsConverting] = useState(false)
  const [conversionError, setConversionError] = useState<string | null>(null)

  const handlePasteLyrics = async () => {
    const pastedLyrics = await pasteLyricsFromClipboard()
    if (pastedLyrics) {
      setLyrics(pastedLyrics)
    }
  }

  const handleConvertToHiragana = async () => {
    if (isConverting) return

    try {
      setIsConverting(true)
      setConversionError(null)

      const convertedLyrics = await convertLyricsArrayToHiragana(lyrics)
      setLyrics(convertedLyrics)
    } catch (error) {
      console.error('Hiragana conversion error:', error)
      setConversionError(error instanceof Error ? error.message : '変換中にエラーが発生しました')
    } finally {
      setIsConverting(false)
    }
  }

  const handleClearLyrics = () => {
    setLyrics(["", "", "", ""])
  }

  const getTitle = () => {
    if (mode === 'edit' && editingEntryIndex !== undefined) {
      return `ページ #${editingEntryIndex + 1} 編集`
    }
    return 'ページ追加'
  }

  const getIcon = () => {
    return mode === 'edit' ? <Edit className="h-5 w-5" /> : <Plus className="h-5 w-5" />
  }

  const getIconColor = () => {
    return mode === 'edit' ? 'bg-blue-500' : 'bg-green-500'
  }

  return (
    <Card className="bg-white dark:bg-slate-900 border shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <div className={`p-2 rounded-lg text-white ${getIconColor()}`}>
            {getIcon()}
          </div>
          {getTitle()}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <TimestampInput
          timestamp={timestamp}
          setTimestamp={setTimestamp}
          player={player}
          seekToInput={seekToInput}
          timestampInputRef={timestampInputRef}
          timestampOffset={timestampOffset}
          setTimestampOffset={setTimestampOffset}
          getCurrentTimestamp={getCurrentTimestamp}
        />

        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-muted-foreground">歌詞入力</div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleConvertToHiragana}
              disabled={isConverting || lyrics.every(line => line.trim() === '')}
              className={`${conversionError ? 'bg-red-50 border-red-200' : ''}`}
            >
              <Languages className="h-4 w-4 mr-2" />
              {isConverting ? '変換中...' : 'ひらがな'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePasteLyrics}
              className={`${copyStatus === 'success' ? 'bg-green-50 border-green-200' : copyStatus === 'error' ? 'bg-red-50 border-red-200' : ''}`}
            >
              <ClipboardPaste className="h-4 w-4 mr-2" />
              貼り付け
            </Button>
          </div>
        </div>

        {conversionError && (
          <div className="text-sm text-red-600 mb-2 p-2 bg-red-50 border border-red-200 rounded">
            {conversionError}
          </div>
        )}

        <LyricsInputFields
          lyrics={lyrics}
          setLyrics={setLyrics}
          lyricsInputRefs={lyricsInputRefs}
        />

        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearLyrics}
            className="text-xs"
          >
            <Eraser className="h-3 w-3 mr-1" />
            クリア
          </Button>
        </div>

        <div className="flex gap-2">
          {mode === 'add' ? (
            <Button
              onClick={onAdd}
              disabled={!timestamp}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              ページ追加
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={onSave}
                className="flex-1"
              >
                <Check className="h-4 w-4 mr-2" />
                保存
              </Button>
              <Button
                variant="outline"
                onClick={onCancel}
                className="flex-1"
              >
                <X className="h-4 w-4 mr-2" />
                キャンセル
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}