import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, ClipboardPaste, Eraser, Languages } from "lucide-react"
import { LyricsInputFields } from '@/components/LyricsInputFields'
import { TimestampInput } from '@/components/TimestampInput'
import { useLyricsCopyPaste } from '@/hooks/useLyricsCopyPaste'
import { convertLyricsArrayToHiragana } from '@/lib/hiraganaUtils'
import type { YouTubePlayer, LyricsArray } from '@/lib/types'

interface LyricsAddCardProps {
  // Common props
  lyrics: LyricsArray
  setLyrics: React.Dispatch<React.SetStateAction<LyricsArray>>
  timestamp: string
  setTimestamp: React.Dispatch<React.SetStateAction<string>>
  player: YouTubePlayer | null
  seekToInput?: (inputValue: string) => void

  // Callbacks
  onAdd?: () => void

  // Input refs
  lyricsInputRefs?: React.MutableRefObject<(HTMLInputElement | null)[]>
  timestampInputRef?: React.MutableRefObject<HTMLInputElement | null>

  // Timestamp offset props
  timestampOffset?: number
  setTimestampOffset?: (offset: number) => void
  getCurrentTimestamp?: (offset: number) => string

  // Undo/Redo support
  saveCurrentState?: () => void
}

export const LyricsAddCard: React.FC<LyricsAddCardProps> = ({
  lyrics,
  setLyrics,
  timestamp,
  setTimestamp,
  player,
  seekToInput,
  onAdd,
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


  return (
    <Card
      className="bg-card text-card-foreground border shadow-lg"
    >
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <div className="p-2 rounded-lg text-white bg-green-500"><Plus className="h-5 w-5" /></div>
          ページ追加
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="mb-8">
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
        </div>

        <div className="flex items-center justify-between mb-2">
          <div className="text-base font-medium text-muted-foreground">
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

        {conversionError && (
          <div className="text-sm text-destructive mb-2 p-2 bg-destructive/10 border border-destructive/20 rounded">
            {conversionError}
          </div>
        )}

        <div>
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
            <Button onClick={onAdd} disabled={!timestamp} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              ページ追加 ( Ctrl + Enter )
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
