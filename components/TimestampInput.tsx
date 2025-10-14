import React from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Clock, Play, ChevronLeft, ChevronRight } from "lucide-react"
import type { YouTubePlayer } from '@/lib/types'

interface TimestampInputProps {
  timestamp: string
  setTimestamp: (timestamp: string) => void
  player: YouTubePlayer | null
  seekToInput?: (inputValue: string) => void
  timestampInputRef?: React.MutableRefObject<HTMLInputElement | null>
  timestampOffset?: number
  setTimestampOffset?: (offset: number) => void
  getCurrentTimestamp?: (offset: number) => string
}

export const TimestampInput: React.FC<TimestampInputProps> = ({
  timestamp,
  setTimestamp,
  player,
  seekToInput,
  timestampInputRef,
  timestampOffset = 0,
  setTimestampOffset,
  getCurrentTimestamp
}) => {
  const handleGetCurrentTimestamp = () => {
    if (getCurrentTimestamp) {
      setTimestamp(getCurrentTimestamp(timestampOffset))
    } else if (player) {
      setTimestamp(player.getCurrentTime().toFixed(2))
    }
  }

  const adjustOffset = (delta: number) => {
    if (setTimestampOffset) {
      const newOffset = Math.max(-2, Math.min(2, timestampOffset + delta))
      setTimestampOffset(Number(newOffset.toFixed(2)))
    }
  }



  return (
    <div>
      <div className="text-base font-medium text-muted-foreground mb-2">ページ表示タイミング（秒）</div>
      <div className="flex gap-2 items-center flex-wrap">
        <Button
          variant="outline"
          onClick={() => seekToInput?.(timestamp)}
          disabled={!seekToInput || !timestamp}
          className="h-12"
        >
          <Play className="h-4 w-4" />
        </Button>
        <Input
          ref={timestampInputRef}
          type="number"
          step="0.01"
          placeholder="0.00"
          value={timestamp}
          onChange={(e) => setTimestamp(e.target.value)}
          className="h-12 text-lg px-4 w-24"
        />
        <Button
          variant="outline"
          onClick={handleGetCurrentTimestamp}
          disabled={!player}
          className="h-12"
        >
          <Clock className="h-4 w-4 mr-2" />
          タイムスタンプ入力
        </Button>

        {setTimestampOffset && (
          <>
            <div className="h-6 border-l border-gray-300 mx-2" />
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                補正:
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => adjustOffset(-0.05)}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                step="0.1"
                min="-2"
                max="2"
                value={timestampOffset.toFixed(2)}
                onChange={(e) => {
                  const value = parseFloat(e.target.value)
                  if (!isNaN(value) && value >= -2 && value <= 2) {
                    setTimestampOffset(value)
                  }
                }}
                className="h-8 w-20 text-center text-sm font-mono"
              />
              <span className="text-muted-foreground">s</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => adjustOffset(0.05)}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {timestampOffset !== 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTimestampOffset(0)}
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                >
                  リセット
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}