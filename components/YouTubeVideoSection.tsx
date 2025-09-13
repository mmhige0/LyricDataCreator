import React from 'react'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Play, Pause, Rewind, FastForward, ChevronLeft, ChevronRight, SkipBack } from "lucide-react"
import { formatTime } from "@/lib/timeUtils"
import type { YouTubePlayer } from '@/lib/types'

interface YouTubeVideoSectionProps {
  youtubeUrl: string
  setYoutubeUrl: (url: string) => void
  videoId: string
  player: YouTubePlayer | null
  isPlaying: boolean
  currentTime: number
  duration: number
  playbackRate: number
  isLoadingVideo: boolean
  isYouTubeAPIReady: boolean
  loadYouTubeVideo: () => void
  togglePlayPause: () => void
  seekBackward: () => void
  seekForward: () => void
  seekBackward1Second: () => void
  seekForward1Second: () => void
  seekToBeginning: () => void
  changePlaybackRate: (rate: number) => void
  seekTo: (time: number) => void
}

export const YouTubeVideoSection: React.FC<YouTubeVideoSectionProps> = ({
  youtubeUrl,
  setYoutubeUrl,
  videoId,
  player,
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  isLoadingVideo,
  isYouTubeAPIReady,
  loadYouTubeVideo,
  togglePlayPause,
  seekBackward,
  seekForward,
  seekBackward1Second,
  seekForward1Second,
  seekToBeginning,
  changePlaybackRate,
  seekTo
}) => {
  return (
    <Card className="mb-6 bg-white dark:bg-slate-900 border shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <div className="p-2 rounded-lg bg-red-500 text-white">
            <Play className="h-5 w-5" />
          </div>
          YouTube動画
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="YouTube URLを入力してください (例: https://www.youtube.com/watch?v=...)"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            className="flex-1"
          />
          <Button onClick={loadYouTubeVideo} disabled={!youtubeUrl || !isYouTubeAPIReady || isLoadingVideo}>
            {isLoadingVideo ? "読み込み中..." : "読み込み"}
          </Button>
        </div>

        {!isYouTubeAPIReady && (
          <div className="text-sm text-muted-foreground text-center">YouTube APIを読み込み中...</div>
        )}

        {videoId && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <div id="youtube-player" className="rounded-lg overflow-hidden"></div>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={seekToBeginning}>
                  <SkipBack className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={togglePlayPause}>
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
                <Button variant="outline" size="sm" onClick={seekBackward}>
                  <Rewind className="h-4 w-4" />
                  <span className="ml-1 text-xs">-5秒</span>
                </Button>
                <Button variant="outline" size="sm" onClick={seekForward}>
                  <FastForward className="h-4 w-4" />
                  <span className="ml-1 text-xs">+5秒</span>
                </Button>
                <Button variant="outline" size="sm" onClick={seekBackward1Second}>
                  <ChevronLeft className="h-4 w-4" />
                  <span className="ml-1 text-xs">-1秒</span>
                </Button>
                <Button variant="outline" size="sm" onClick={seekForward1Second}>
                  <ChevronRight className="h-4 w-4" />
                  <span className="ml-1 text-xs">+1秒</span>
                </Button>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-sm font-mono">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>

                <div className="flex items-center gap-2">
                  <Label className="text-sm">速度:</Label>
                  <select
                    value={playbackRate}
                    onChange={(e) => changePlaybackRate(Number(e.target.value))}
                    className="text-sm border rounded px-2 py-1"
                  >
                    <option value={0.25}>0.25x</option>
                    <option value={0.5}>0.5x</option>
                    <option value={0.75}>0.75x</option>
                    <option value={1}>1x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <input
                type="range"
                min="0"
                max={duration}
                value={currentTime}
                onChange={(e) => seekTo(Number(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground text-center">動画の総時間: {duration.toFixed(1)}秒</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}