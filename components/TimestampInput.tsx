import React, { useEffect, useState } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  const [offsetInputValue, setOffsetInputValue] = useState<string>(timestampOffset.toFixed(2))
  const [isOffsetFocused, setIsOffsetFocused] = useState(false)

  const formatOffset = (value: number) => {
    return Object.is(value, -0) ? '-0.00' : value.toFixed(2)
  }

  useEffect(() => {
    if (isOffsetFocused) return
    setOffsetInputValue(formatOffset(timestampOffset))
  }, [timestampOffset, isOffsetFocused])

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
      const rounded = Number(newOffset.toFixed(2))
      setTimestampOffset(rounded)
      setOffsetInputValue(formatOffset(rounded))
    }
  }

  const handleOffsetChange = (value: string) => {
    setOffsetInputValue(value)
    if (!setTimestampOffset) return

    const parsed = Number.parseFloat(value)
    if (!Number.isNaN(parsed) && parsed >= -2 && parsed <= 2) {
      setTimestampOffset(parsed)
    }
  }

  const handleOffsetBlur = () => {
    if (!setTimestampOffset) return
    setIsOffsetFocused(false)
    const parsed = Number.parseFloat(offsetInputValue)
    if (Number.isNaN(parsed)) {
      setOffsetInputValue(formatOffset(timestampOffset))
      return
    }
    const clamped = Math.max(-2, Math.min(2, parsed))
    const rounded = Number(clamped.toFixed(2))
    setTimestampOffset(rounded)
    setOffsetInputValue(formatOffset(rounded))
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
                onClick={() => adjustOffset(-0.01)}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                step="0.01"
                min="-2"
                max="2"
                value={offsetInputValue}
                onFocus={() => setIsOffsetFocused(true)}
                onChange={(e) => handleOffsetChange(e.target.value)}
                onBlur={handleOffsetBlur}
                className="h-8 w-20 text-center text-sm font-mono appearance-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="text-muted-foreground">s</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => adjustOffset(0.01)}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              {timestampOffset !== 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (!setTimestampOffset) return
                    setTimestampOffset(0)
                    setOffsetInputValue('0.00')
                  }}
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
