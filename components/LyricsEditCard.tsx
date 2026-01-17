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
  isDisabled?: boolean
  disabledReason?: string

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

  // Undo/Redo support
  saveCurrentState?: () => void
}

export const LyricsEditCard: React.FC<LyricsEditCardProps> = ({
  lyrics,
  setLyrics,
  timestamp,
  setTimestamp,
  player,
  seekToInput,
  isDisabled = false,
  disabledReason = '編集中はページ追加できません',
  mode,
  editingEntryIndex,
  onAdd,
  onSave,
  onCancel,
  lyricsInputRefs,
  timestampInputRef,
  timestampOffset,
  setTimestampOffset,
  getCurrentTimestamp,
  saveCurrentState
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
    // Save current state before clearing (only if lyrics are not empty)
    if (saveCurrentState && lyrics.some(line => line.trim() !== '')) {
      saveCurrentState()
    }
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
  const isEditMode = mode === 'edit'

  return (
    <Card
      className={`bg-card text-card-foreground border shadow-lg ${isDisabled ? 'bg-muted/50 text-muted-foreground' : ''}`}
    >
      {!isEditMode && (
        <CardHeader className={`pb-4 ${isDisabled ? 'opacity-60 grayscale' : ''}`}>
          <CardTitle className="text-xl font-semibold flex items-center gap-2 flex-wrap">
            <div className={`p-2 rounded-lg text-white ${getIconColor()}`}>
              {getIcon()}
            </div>
            {getTitle()}
            {isDisabled && (
              <span className="text-xs font-medium text-warning-foreground bg-warning/20 border border-warning/30 rounded-full px-2 py-1">
                {disabledReason}
              </span>
            )}
          </CardTitle>
        </CardHeader>
      )}

      <CardContent className={`space-y-4 ${isDisabled ? 'opacity-60 grayscale' : ''}`}>
        <div className={`mb-8 ${isDisabled ? 'pointer-events-none' : ''}`}>
          <TimestampInput
            timestamp={timestamp}
            setTimestamp={setTimestamp}
            player={player}
            seekToInput={seekToInput}
            timestampInputRef={timestampInputRef}
            timestampOffset={timestampOffset}
            setTimestampOffset={setTimestampOffset}
            getCurrentTimestamp={getCurrentTimestamp}
            hideLabel={isEditMode}
          />
        </div>

        <div className={`flex items-center justify-between mb-2 ${isDisabled ? 'pointer-events-none' : ''}`}>
          <div className={`text-base font-medium text-muted-foreground ${isEditMode ? 'invisible' : ''}`}>
            歌詞
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleConvertToHiragana}
              disabled={isConverting || lyrics.every(line => line.trim() === '')}
              className={`${conversionError ? 'bg-destructive/10 border-destructive/20 text-destructive' : ''}`}
            >
              <Languages className="h-4 w-4 mr-2" />
              {isConverting ? '変換中...' : 'ひらがな'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePasteLyrics}
              className={`${copyStatus === 'success' ? 'bg-success/10 border-success/20 text-success' : copyStatus === 'error' ? 'bg-destructive/10 border-destructive/20 text-destructive' : ''}`}
            >
              <ClipboardPaste className="h-4 w-4 mr-2" />
              貼り付け
            </Button>
          </div>
        </div>

        {conversionError && !isDisabled && (
          <div className="text-sm text-destructive mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded">
            {conversionError}
          </div>
        )}

        <div className={isDisabled ? 'pointer-events-none' : ''}>
          <LyricsInputFields
            lyrics={lyrics}
            setLyrics={setLyrics}
            lyricsInputRefs={lyricsInputRefs}
            saveCurrentState={saveCurrentState}
          />

          <div className="flex justify-end my-2">
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
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                ページ追加 ( Ctrl + Enter )
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={onSave}
                  className="flex-1"
                >
                  <Check className="h-4 w-4 mr-2" />
                  保存 ( Ctrl + Enter )
                </Button>
                <Button
                  variant="outline"
                  onClick={onCancel}
                  className="flex-1"
                >
                  <X className="h-4 w-4 mr-2" />
                  キャンセル ( Esc )
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
