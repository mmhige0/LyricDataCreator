import React from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, ClipboardPaste } from "lucide-react"
import { LyricsInputFields } from '@/components/shared/LyricsInputFields'
import { TimestampInput } from '@/components/shared/TimestampInput'
import { useLyricsCopyPaste } from '@/hooks/useLyricsCopyPaste'
import type { YouTubePlayer, LyricsArray } from '@/lib/types'

interface LyricsInputSectionProps {
  lyrics: LyricsArray
  setLyrics: React.Dispatch<React.SetStateAction<LyricsArray>>
  timestamp: string
  setTimestamp: React.Dispatch<React.SetStateAction<string>>
  player: YouTubePlayer | null
  lyricsInputRefs: React.MutableRefObject<(HTMLInputElement | null)[]>
  timestampInputRef: React.MutableRefObject<HTMLInputElement | null>
  addScoreEntry: () => void
}

export const LyricsInputSection: React.FC<LyricsInputSectionProps> = ({
  lyrics,
  setLyrics,
  timestamp,
  setTimestamp,
  player,
  lyricsInputRefs,
  timestampInputRef,
  addScoreEntry
}) => {
  const { pasteLyricsFromClipboard, copyStatus } = useLyricsCopyPaste()

  const handlePasteLyrics = async () => {
    const pastedLyrics = await pasteLyricsFromClipboard()
    if (pastedLyrics) {
      setLyrics(pastedLyrics)
    }
  }
  return (
    <Card className="bg-white dark:bg-slate-900 border shadow-lg">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-green-500 text-white">
              <Plus className="h-5 w-5" />
            </div>
            歌詞入力
          </CardTitle>
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
      </CardHeader>
      <CardContent className="space-y-4">
        <TimestampInput
          timestamp={timestamp}
          setTimestamp={setTimestamp}
          player={player}
          timestampInputRef={timestampInputRef}
        />

        <LyricsInputFields
          lyrics={lyrics}
          setLyrics={setLyrics}
          lyricsInputRefs={lyricsInputRefs}
        />

        <Button
          onClick={addScoreEntry}
          disabled={!timestamp}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          ページ追加
        </Button>
      </CardContent>
    </Card>
  )
}