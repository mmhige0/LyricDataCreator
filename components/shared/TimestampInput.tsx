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
  size?: 'default' | 'small'
  showLabel?: boolean
}

export const TimestampInput: React.FC<TimestampInputProps> = ({
  timestamp,
  setTimestamp,
  player,
  seekToInput,
  timestampInputRef,
  label = "ページ表示タイム（秒）",
  size = 'default',
  showLabel = true
}) => {
  const handleGetCurrentTimestamp = () => {
    if (player) {
      setTimestamp(player.getCurrentTime().toFixed(2))
    }
  }


  const inputClassName = size === 'small' ? 'text-sm font-mono' : 'h-12 text-lg px-4'
  const buttonClassName = size === 'small' ? 'px-2' : 'h-12'
  const inputWidth = size === 'small' ? 'w-20' : 'w-32'

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
          className={`${inputClassName} ${inputWidth}`}
        />
        {size === 'small' ? (
          <>
            <span className="text-sm">秒</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGetCurrentTimestamp}
              disabled={!player}
              className={buttonClassName}
            >
              <Clock className="h-3 w-3" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => seekToInput?.(timestamp)}
              disabled={!seekToInput || !timestamp}
              className={buttonClassName}
            >
              <Play className="h-3 w-3" />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={handleGetCurrentTimestamp}
              disabled={!player}
              className={buttonClassName}
            >
              <Clock className="h-4 w-4 mr-2" />
              タイムスタンプ取得
            </Button>
            <Button
              variant="outline"
              onClick={() => seekToInput?.(timestamp)}
              disabled={!seekToInput || !timestamp}
              className={buttonClassName}
            >
              <Play className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </div>
  )
}