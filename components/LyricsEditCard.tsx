import React from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, ClipboardPaste, Check, X, Edit } from "lucide-react"
import { LyricsInputFields } from '@/components/shared/LyricsInputFields'
import { TimestampInput } from '@/components/shared/TimestampInput'
import { useLyricsCopyPaste } from '@/hooks/useLyricsCopyPaste'
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
}

export const LyricsEditCard: React.FC<LyricsEditCardProps> = ({
  lyrics,
  setLyrics,
  timestamp,
  setTimestamp,
  player,
  seekToInput,
  mode,
  editingEntry,
  editingEntryIndex,
  onAdd,
  onSave,
  onCancel,
  lyricsInputRefs,
  timestampInputRef
}) => {
  const { pasteLyricsFromClipboard, copyStatus } = useLyricsCopyPaste()

  const handlePasteLyrics = async () => {
    const pastedLyrics = await pasteLyricsFromClipboard()
    if (pastedLyrics) {
      setLyrics(pastedLyrics)
    }
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
        />

        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-medium text-muted-foreground">歌詞入力</div>
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

        <LyricsInputFields
          lyrics={lyrics}
          setLyrics={setLyrics}
          lyricsInputRefs={lyricsInputRefs}
        />

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