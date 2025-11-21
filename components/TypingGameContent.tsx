"use client"

import { useEffect, useState, useRef } from "react"
import type { ScoreEntry } from "@/lib/types"
import { useTypingGame } from "@/hooks/useTypingGame"
import { useYouTube } from "@/hooks/useYouTube"
import { TypingDisplay } from "@/components/TypingDisplay"
import { TypingStats } from "@/components/TypingStats"
import { ScoreManagementSection } from "@/components/ScoreManagementSection"
import { AppHeader } from "@/components/AppHeader"
import { Button } from "@/components/ui/button"
import {
  Play,
  Pause,
  Rewind,
  FastForward,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  Volume2,
  VolumeX,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react"

const PLAYBACK_RATES = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]

const getNextPlaybackRate = (current: number, direction: "slower" | "faster"): number => {
  let index = PLAYBACK_RATES.findIndex((rate) => rate === current)

  if (index === -1) {
    let nearestIndex = 0
    let minDiff = Math.abs(PLAYBACK_RATES[0] - current)
    for (let i = 1; i < PLAYBACK_RATES.length; i++) {
      const diff = Math.abs(PLAYBACK_RATES[i] - current)
      if (diff < minDiff) {
        minDiff = diff
        nearestIndex = i
      }
    }
    index = nearestIndex
  }

  if (direction === "slower" && index > 0) {
    return PLAYBACK_RATES[index - 1]
  }

  if (direction === "faster" && index < PLAYBACK_RATES.length - 1) {
    return PLAYBACK_RATES[index + 1]
  }

  return PLAYBACK_RATES[index]
}

interface TypingGameContentProps {
  onClose: () => void
  /**
   * 内部の AppHeader を描画するかどうか
   * - /typing ページ: true
   * - トップページのタブ表示: false（外側のヘッダーのみ表示したい）
   */
  showHeader?: boolean
}

export function TypingGameContent({ onClose, showHeader = true }: TypingGameContentProps) {
  const [showPageList, setShowPageList] = useState(true)
  const [scoreEntries, setScoreEntries] = useState<ScoreEntry[]>([])
  const [songTitle, setSongTitle] = useState('')
  const [youtubeUrl, setYoutubeUrlState] = useState('')
  const [isDataLoaded, setIsDataLoaded] = useState(false)
  const [isTabEnabled, setIsTabEnabled] = useState(true)
  const hasLoadedData = useRef(false)
  const hasLoadedVideo = useRef(false)

  // セッションストレージからプレイ用データを取得
  useEffect(() => {
    if (hasLoadedData.current) return
    hasLoadedData.current = true

    const dataString =
      typeof window !== "undefined" ? sessionStorage.getItem("typingGameData") : null

    if (dataString) {
      try {
        const data = JSON.parse(dataString) as {
          scoreEntries?: ScoreEntry[]
          songTitle?: string
          youtubeUrl?: string
        }
        setScoreEntries(data.scoreEntries || [])
        setSongTitle(data.songTitle || '無題')
        setYoutubeUrlState(data.youtubeUrl || '')
        setIsDataLoaded(true)
        sessionStorage.removeItem('typingGameData')
      } catch (e) {
        console.error("Failed to parse typingGameData:", e)
        onClose()
      }
    } else {
      onClose()
    }
  }, [onClose])

  const {
    player,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    volume,
    isMuted,
    togglePlayPause,
    seekBackward,
    seekForward,
    seekBackward1Second,
    seekForward1Second,
    seekToBeginning,
    changePlaybackRate,
    setPlayerVolume,
    adjustVolume,
    toggleMute,
    loadYouTubeVideo,
    setYoutubeUrl,
    youtubeUrl: youtubeUrlFromHook,
    isYouTubeAPIReady,
    seekTo,
    seekToAndPlay: seekToAndPlayRaw,
  } = useYouTube({ elementId: "typing-youtube-player" })

  const handlePageChange = (direction: 'prev' | 'next') => {
    if (!player) return

    if (direction === 'prev') {
      const currentPageTimestamp = scoreEntries[pageState.pageIndex]?.timestamp || 0
      const seekTime = Math.max(0, currentPageTimestamp - 1)
      seekTo(seekTime)

      if (!isPlaying) {
        player.playVideo()
      }
    } else {
      const targetPageIndex = pageState.pageIndex + 1
      if (targetPageIndex < scoreEntries.length) {
        const targetTimestamp = scoreEntries[targetPageIndex].timestamp
        const adjustedTimestamp = Math.max(0, targetTimestamp - 1)
        const finalTimestamp = Math.max(currentTime, adjustedTimestamp)

        if (finalTimestamp !== currentTime) {
          seekTo(finalTimestamp)
        }

        if (!isPlaying) {
          player.playVideo()
        }
      }
    }
  }

  const {
    gameStatus,
    inputMode,
    pageState,
    totalTypes,
    totalMiss,
    combo,
    maxCombo,
    gameStats,
    restartGame,
    toggleInputMode,
    changePageManually,
  } = useTypingGame({
    scoreEntries,
    currentVideoTime: currentTime,
    onRestartVideo: () => {
      seekToAndPlayRaw(0)
    },
    onTogglePlayPause: togglePlayPause,
     onSkipToNextPage: () => handlePageChange("next"),
     onPageChange: (direction) => handlePageChange(direction),
    isPlaying: isPlaying,
  })

  // YouTube URL を設定（データ読み込み完了後、一度だけ）
  useEffect(() => {
    if (hasLoadedVideo.current) return

    if (isDataLoaded && youtubeUrl) {
      setYoutubeUrl(youtubeUrl)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDataLoaded, youtubeUrl])

  // YouTube 動画をロード（URL 設定完了後、一度だけ）
  useEffect(() => {
    if (hasLoadedVideo.current) return

    if (isDataLoaded && isYouTubeAPIReady && youtubeUrlFromHook) {
      hasLoadedVideo.current = true
      const timer = setTimeout(() => {
        loadYouTubeVideo()
      }, 1000)

      return () => clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDataLoaded, isYouTubeAPIReady, youtubeUrlFromHook])

  // F9 / F10 で再生速度を変更
  useEffect(() => {
    const handleSpeedKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "F9" && event.key !== "F10") return

      event.preventDefault()

      const direction = event.key === "F9" ? "slower" : "faster"
      const nextRate = getNextPlaybackRate(playbackRate, direction)

      if (nextRate !== playbackRate) {
        changePlaybackRate(nextRate)
      }
    }

    window.addEventListener("keydown", handleSpeedKeyDown)
    return () => window.removeEventListener("keydown", handleSpeedKeyDown)
  }, [playbackRate, changePlaybackRate])

  // Tab 縺ｧ蜈･蜉帙Δ繝ｼ繝峨・繧ｳ繝ｳ繝医Ο繝ｼ繝ｫ繧貞､画峩
  useEffect(() => {
    const handleTabKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      event.preventDefault()

      if (!isTabEnabled) return

      toggleInputMode()
    }

    window.addEventListener('keydown', handleTabKeyDown)
    return () => window.removeEventListener('keydown', handleTabKeyDown)
  }, [isTabEnabled, toggleInputMode])

  const toggleTabEnabled = () => {
    setIsTabEnabled((prev) => !prev)
  }

  const handleRestart = () => {
    restartGame()
  }

  const handleClose = () => {
    if (player) {
      player.pauseVideo()
    }
    onClose()
  }

  const getCurrentLyricsIndex = () => {
    return pageState.pageIndex
  }

  const seekToAndPlay = (time: number) => {
    if (!player) return

    const seekTime = Math.max(0, time - 1)
    seekTo(seekTime)

    if (!isPlaying) {
      player.playVideo()
    }
  }

  const calculatePageTimeProgress = (): number => {
    if (scoreEntries.length === 0) return 0

    if (pageState.pageIndex >= scoreEntries.length - 1) {
      const pageStartTime = scoreEntries[pageState.pageIndex]?.timestamp || 0
      const pageDuration = duration - pageStartTime
      const elapsed = currentTime - pageStartTime
      return pageDuration > 0 ? Math.min((elapsed / pageDuration) * 100, 100) : 0
    } else {
      const pageStartTime = scoreEntries[pageState.pageIndex]?.timestamp || 0
      const nextPageTime = scoreEntries[pageState.pageIndex + 1]?.timestamp || duration
      const pageDuration = nextPageTime - pageStartTime
      const elapsed = currentTime - pageStartTime
      return pageDuration > 0 ? Math.min((elapsed / pageDuration) * 100, 100) : 0
    }
  }

  const nextPagePreviewLines: string[] = (() => {
    const nextPageIndex = pageState.pageIndex + 1
    if (nextPageIndex >= scoreEntries.length) return []

    const nextEntry = scoreEntries[nextPageIndex]
    if (!nextEntry || !Array.isArray(nextEntry.lyrics)) return []

    // 空行も含めて先頭4行をそのまま使う
    return nextEntry.lyrics.slice(0, 4)
  })()

  // 全角スペースを半角スペースに統一
  const normalizeSpaces = (text: string): string => text.replace(/\u3000/g, ' ')
  
  const currentLineWord = pageState.lineWords[pageState.currentLineIndex]
  const romajiCorrect = currentLineWord?.correct.r ?? ''
  const romajiRemaining =
    (currentLineWord?.nextChar.r[0] ?? '') +
    (currentLineWord?.word.map((chunk) => chunk.r[0] ?? '').join('') ?? '')
  const hasRomaji = (romajiCorrect + romajiRemaining).trim().length > 0

  // read-only 用ダミー関数群
  const dummyFunction = () => {}
  const dummyFunctionWithId = (_id: string) => {}
  const dummyFunctionWithEntry = (_entry: ScoreEntry) => {}
  const dummyFunctionWithNumber = (_n: number) => {}

  return (
    <>
      {showHeader && (
        <AppHeader
          title="Lyric Data Creator"
          subtitle="プレイ"
          songTitle={songTitle}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPageList(!showPageList)}
              >
                {showPageList ? (
                  <PanelRightClose className="h-4 w-4 mr-2" />
                ) : (
                  <PanelRightOpen className="h-4 w-4 mr-2" />
                )}
                ページ一覧
              </Button>
              <Button variant="outline" onClick={handleClose}>
                戻る
              </Button>
            </div>
          }
        />
      )}

      {!showHeader && (
        <div className="container mx-auto px-4 pt-4 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPageList(!showPageList)}
          >
            {showPageList ? (
              <PanelRightClose className="h-4 w-4 mr-2" />
            ) : (
              <PanelRightOpen className="h-4 w-4 mr-2" />
            )}
            ページ一覧
          </Button>
        </div>
      )}

      <div className="container mx-auto p-4 max-w-[1600px]">
        <div className="flex justify-center gap-8 items-start">
          {/* 左側: ゲーム画面 */}
          <div className="space-y-6 max-w-5xl w-full">
            <main className="bg-white dark:bg-slate-900 rounded-lg shadow-lg p-6 flex flex-col">
              {/* YouTube 動画プレイヤー */}
              <div className="flex justify-center mb-4">
                <div id="typing-youtube-player" className="rounded-lg overflow-hidden" />
              </div>

              {/* 動画コントロール */}
              <div className="space-y-3 p-4 bg-muted rounded-lg mb-4">
                {/* 1段目: 再生コントロールボタン */}
                <div className="flex items-center justify-between">
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
                </div>

                {/* 2段目: 再生速度 + 音量コントロール */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">速度:</span>
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

                  <div className="flex items-center gap-2">
                    <Button
                      onClick={toggleMute}
                      variant="outline"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={!player}
                    >
                      {isMuted ? (
                        <VolumeX className="h-4 w-4" />
                      ) : (
                        <Volume2 className="h-4 w-4" />
                      )}
                    </Button>
                    <span className="text-sm">音量</span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={isMuted ? 0 : volume}
                      onChange={(e) => setPlayerVolume(Number(e.target.value))}
                      className="w-20 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      disabled={!player}
                    />
                    <span className="text-sm text-gray-600 min-w-[3rem]">
                      {isMuted ? 0 : Math.round(volume)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* シークバー */}
              <div className="mb-4">
                <input
                  type="range"
                  min={0}
                  max={duration}
                  value={currentTime}
                  onChange={(e) => seekTo(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              {/* 統計 */}
              <div className="mb-4 flex items-center justify-between">
                <TypingStats
                  currentTime={currentTime}
                  duration={duration}
                  combo={combo}
                  totalMiss={totalMiss}
                />
              {/* 入力モード */}
                <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                  <span className="inline-flex items-center h-8">
                    <span className={inputMode === 'roma' ? 'font-bold' : ''}>ローマ字</span>
                    <span className="mx-1">/</span>
                    <span className={inputMode === 'kana' ? 'font-bold' : ''}>かな</span>
                  <span className="ml-2">&nbsp;Tabで切り替え</span>
                  </span>
                  <button
                    type="button"
                    onClick={toggleTabEnabled}
                    className={`ml-3 relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      isTabEnabled
                        ? 'bg-blue-500 dark:bg-blue-400'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        isTabEnabled ? 'translate-x-4' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
              {/* 歌詞表示エリア */}
              <div className="mb-3">
                <TypingDisplay
                  lineWords={pageState.lineWords}
                  currentLineIndex={pageState.currentLineIndex}
                />
              </div>
              <div className="py-8 px-6 bg-gray-100 dark:bg-gray-800 rounded-lg h-16 flex items-center select-none">
                {hasRomaji && (
                  <p className="text-2xl font-mono leading-relaxed tracking-wide break-all">
                    <span className="text-gray-400 dark:text-gray-500">
                      {normalizeSpaces(romajiCorrect)}
                    </span>
                    <span className="text-black dark:text-white">
                      {normalizeSpaces(romajiRemaining)}
                    </span>
                  </p>
                )}
              </div>

              {/* ページ表示時間ゲージ */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 my-4">
                <div
                  className="bg-blue-500 h-2.5 rounded-full transition-all"
                  style={{ width: `${calculatePageTimeProgress()}%` }}
                />
              </div>

              {nextPagePreviewLines.length > 0 && (
                <div className="mt-2 mb-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="h-40 pl-4 overflow-hidden flex flex-col justify-center space-y-1 text-2xl leading-snug text-gray-800 dark:text-gray-100 text-left select-none">
                    {nextPagePreviewLines.map((line, index) => (
                      <p key={index} className="truncate">
                        {line || '\u00A0'}
                      </p>
                    ))}
                  </div>
                </div>
              )}


              {/* ショートカットキー説明 */}
              <div className="mt-4">
                <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
                  <span className="ml-3">
                    <kbd className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
                      Esc
                    </kbd>{' '}
                    一時停止 / 再生
                  </span>
                  <span className="ml-3">
                    <kbd className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
                      ←
                    </kbd>{' '}
                    <kbd className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
                      →
                    </kbd>{' '}
                    前 / 次のページ
                  </span>
                  <span className="ml-3">
                    <kbd className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
                      F4
                    </kbd>{' '}
                    最初から
                  </span>
                </div>
              </div>
            </main>
          </div>

          {/* 右側: ページ一覧 */}
          {showPageList && (
            <div className="w-full max-w-md lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] lg:min-h-0">
              <ScoreManagementSection
                scoreEntries={scoreEntries}
                duration={duration}
                player={player}
                editingId={null}
                getCurrentLyricsIndex={getCurrentLyricsIndex}
                importScoreData={dummyFunction}
                exportScoreData={dummyFunction}
                deleteScoreEntry={dummyFunctionWithId}
                startEditScoreEntry={dummyFunctionWithEntry}
                clearAllScoreEntries={dummyFunction}
                seekToAndPlay={seekToAndPlay}
                bulkAdjustTimings={dummyFunctionWithNumber}
                undoLastOperation={dummyFunction}
                redoLastOperation={dummyFunction}
                canUndo={false}
                canRedo={false}
                readOnly
              />
            </div>
          )}
        </div>
      </div>
    </>
  )
}
