import React from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Clock, Play } from "lucide-react"
import type { YouTubePlayer } from '@/lib/types'

interface TimestampInputProps {
  timestamp: string
  setTimestamp: (timestamp: string) => void
  player: YouTubePlayer | null
  seekToInput?: (inputValue: string) => void
  timestampInputRef?: React.MutableRefObject<HTMLInputElement | null>
  label?: string
  showLabel?: boolean
}

export const TimestampInput: React.FC<TimestampInputProps> = ({
  timestamp,
  setTimestamp,
  player,
  seekToInput,
  timestampInputRef,
  label = "ページ表示タイム（秒）",
  showLabel = true
}) => {
  const handleGetCurrentTimestamp = () => {
    if (player) {
      setTimestamp(player.getCurrentTime().toFixed(2))
    }
  }



  return (
    <div>
      {showLabel && <Label>{label}</Label>}
      <div className="flex gap-2 items-center">
        <Input
          ref={timestampInputRef}
          type="number"
          step="0.01"
          placeholder="0.00"
          value={timestamp}
          onChange={(e) => setTimestamp(e.target.value)}
          className="h-12 text-lg px-4 w-32"
        />
        <Button
          variant="outline"
          onClick={handleGetCurrentTimestamp}
          disabled={!player}
          className="h-12"
        >
          <Clock className="h-4 w-4 mr-2" />
          タイムスタンプ取得
        </Button>
        <Button
          variant="outline"
          onClick={() => seekToInput?.(timestamp)}
          disabled={!seekToInput || !timestamp}
          className="h-12"
        >
          <Play className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}