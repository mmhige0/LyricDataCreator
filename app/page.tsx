"use client"

import type React from "react"
import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Download, Upload, Clock, Plus, Play, Pause, SkipBack, SkipForward, Check, X, Rewind, FastForward, ChevronLeft, ChevronRight } from "lucide-react"

interface ScoreEntry {
  id: string
  timestamp: number
  lyrics: [string, string, string, string]
}

interface YouTubePlayer {
  pauseVideo(): void
  playVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  setPlaybackRate(suggestedRate: number): void
  loadVideoById(videoId: string): void
  getPlayerState(): number
}

declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, config: unknown) => YouTubePlayer
      PlayerState: {
        PLAYING: number
      }
    }
    onYouTubeIframeAPIReady: () => void
  }
}

export default function LyricsTypingApp() {
  const [scoreEntries, setScoreEntries] = useState<ScoreEntry[]>([])
  const [duration, setDuration] = useState<number>(0)
  const [lyrics, setLyrics] = useState<[string, string, string, string]>(["", "", "", ""])
  const [timestamp, setTimestamp] = useState<string>("0.00")
  const [youtubeUrl, setYoutubeUrl] = useState<string>("")
  const [videoId, setVideoId] = useState<string>("")
  const [player, setPlayer] = useState<YouTubePlayer | null>(null)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [playbackRate, setPlaybackRate] = useState<number>(1)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLyrics, setEditingLyrics] = useState<[string, string, string, string]>(["", "", "", ""])
  const [editingTimestamp, setEditingTimestamp] = useState<string>("0.00")
  const [isYouTubeAPIReady, setIsYouTubeAPIReady] = useState<boolean>(false)
  const [isLoadingVideo, setIsLoadingVideo] = useState<boolean>(false)
  const [songTitle, setSongTitle] = useState<string>("")

  const fileInputRef = useRef<HTMLInputElement>(null)
  const lyricsInputRefs = useRef<(HTMLInputElement | null)[]>([])
  const timestampInputRef = useRef<HTMLInputElement>(null)

  const togglePlayPause = () => {
    if (player) {
      if (isPlaying) {
        player.pauseVideo()
      } else {
        player.playVideo()
      }
    }
  }

  useEffect(() => {
    // Load YouTube IFrame API
    if (!window.YT) {
      const tag = document.createElement("script")
      tag.src = "https://www.youtube.com/iframe_api"
      const firstScriptTag = document.getElementsByTagName("script")[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
    }

    // Set up the callback function
    (window as any).onYouTubeIframeAPIReady = () => {
      setIsYouTubeAPIReady(true)
    }

    // Check if API is already loaded
    if (window.YT && window.YT.Player) {
      setIsYouTubeAPIReady(true)
    }

    // Fallback: Set a timeout to enable the button after a few seconds
    const fallbackTimer = setTimeout(() => {
      if (!window.YT) {
        setIsYouTubeAPIReady(true) // Enable button even if API fails to load
      }
    }, 5000)

    return () => {
      clearTimeout(fallbackTimer)
    }
  }, [])

  const extractVideoId = (url: string): string => {
    const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/\s]{11})/
    const match = url.match(regex)
    return match ? match[1] : ""
  }

  const loadYouTubeVideo = () => {
    const id = extractVideoId(youtubeUrl)
    if (!id) {
      alert("有効なYouTube URLを入力してください")
      return
    }

    // Try to load video even if API status is uncertain
    if (!isYouTubeAPIReady && !window.YT) {
      alert("YouTube APIの読み込み中です。しばらく待ってから再試行してください。")
      return
    }

    setIsLoadingVideo(true)
    setVideoId(id)

    if (player) {
      player.loadVideoById(id)
      setIsLoadingVideo(false)
    } else {
      setTimeout(() => {
        try {
          const playerDiv = document.getElementById("youtube-player")
          if (!playerDiv) {
            setIsLoadingVideo(false)
            alert("プレイヤーの準備ができていません。もう一度お試しください。")
            return
          }

          const newPlayer = new window.YT.Player("youtube-player", {
            height: "450",
            width: "800",
            videoId: id,
            playerVars: {
              controls: 0,
              disablekb: 1,
              fs: 0,
              modestbranding: 1,
              rel: 0,
            },
            events: {
              onReady: (event: { target: YouTubePlayer }) => {
                setPlayer(event.target)
                setDuration(event.target.getDuration())
                setIsLoadingVideo(false)
              },
              onStateChange: (event: { data: number }) => {
                setIsPlaying(event.data === window.YT.PlayerState.PLAYING)
              },
              onError: (event: { data: number }) => {
                setIsLoadingVideo(false)
                alert("動画の読み込みでエラーが発生しました。URLを確認してください。")
              },
            },
          })
        } catch (error) {
          setIsLoadingVideo(false)
          alert("プレイヤーの作成でエラーが発生しました。")
        }
      }, 100)
    }
  }

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (player && isPlaying) {
      interval = setInterval(() => {
        const time = player.getCurrentTime()
        setCurrentTime(time)
      }, 100)
    }
    return () => clearInterval(interval)
  }, [player, isPlaying])

  const exportScoreData = () => {
    if (scoreEntries.length === 0) {
      alert("ページがありません。")
      return
    }

    const title = prompt("曲名を入力してください:", songTitle || "")
    if (title === null) return

    setSongTitle(title)

    let exportData = `${duration.toFixed(1)}\n`

    scoreEntries.forEach((entry) => {
      const lyricsLine = entry.lyrics.map((line) => line || "!").join("/")
      exportData += `${lyricsLine}/${entry.timestamp.toFixed(2)}\n`
    })

    exportData += `!/!/!/!/${999.9}\n`

    const blob = new Blob([exportData], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    const now = new Date()
    const timestamp = now.getFullYear() + "-" + 
      String(now.getMonth() + 1).padStart(2, "0") + "-" + 
      String(now.getDate()).padStart(2, "0") + "_" + 
      String(now.getHours()).padStart(2, "0") + "-" + 
      String(now.getMinutes()).padStart(2, "0") + "-" + 
      String(now.getSeconds()).padStart(2, "0")
    const filename = title ? `${title}_${timestamp}.txt` : `譜面_${timestamp}.txt`
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const importScoreData = () => {
    fileInputRef.current?.click()
  }

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const filename = file.name
    const match = filename.match(/^(.+)_\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.txt$/)
    if (match) {
      setSongTitle(match[1])
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const lines = content.trim().split("\n")

        if (lines.length < 1) {
          alert("ファイルが空です。")
          return
        }

        const fileDuration = Number.parseFloat(lines[0])
        if (isNaN(fileDuration)) {
          alert("1行目の総時間が正しくありません。")
          return
        }

        if (Math.abs(fileDuration - duration) > 0.1) {
          const proceed = confirm(
            `ファイルの総時間（${fileDuration.toFixed(1)}秒）と現在の動画の総時間（${duration.toFixed(1)}秒）が異なります。続行しますか？`,
          )
          if (!proceed) return
        }

        const newEntries: ScoreEntry[] = []
        const errors: string[] = []

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim()
          if (!line) continue

          const parts = line.split("/")
          if (parts.length !== 5) {
            errors.push(`${i + 1}行目: フォーマットが正しくありません`)
            continue
          }

          const timestamp = Number.parseFloat(parts[4])
          if (isNaN(timestamp)) {
            errors.push(`${i + 1}行目: タイムスタンプが正しくありません`)
            continue
          }

          if (timestamp === 999.9) continue

          const lyrics: [string, string, string, string] = [
            parts[0] === "!" ? "" : parts[0],
            parts[1] === "!" ? "" : parts[1],
            parts[2] === "!" ? "" : parts[2],
            parts[3] === "!" ? "" : parts[3],
          ]

          newEntries.push({
            id: `import_${i}_${Date.now()}`,
            timestamp,
            lyrics,
          })
        }

        if (errors.length > 0) {
          alert(`以下のエラーがありました:\n${errors.join("\n")}`)
          return
        }

        newEntries.sort((a, b) => a.timestamp - b.timestamp)

        if (scoreEntries.length > 0) {
          const replace = confirm("既存のページを置き換えますか？")
          if (!replace) return
        }

        setScoreEntries(newEntries)
        setDuration(fileDuration)
        alert(`${newEntries.length}件のページをインポートしました。`)
      } catch (error) {
        alert("ファイルの読み込みに失敗しました。")
      }
    }

    reader.readAsText(file, "utf-8")
    event.target.value = ""
  }

  const deleteScoreEntry = (id: string) => {
    const confirm = window.confirm("このページエントリを削除しますか？")
    if (confirm) {
      setScoreEntries((prev) => prev.filter((entry) => entry.id !== id))
    }
  }

  const startEditScoreEntry = (entry: ScoreEntry) => {
    setEditingId(entry.id)
    setEditingLyrics(entry.lyrics)
    setEditingTimestamp(entry.timestamp.toString())
  }

  const saveEditScoreEntry = () => {
    if (!editingId) return

    setScoreEntries((prev) => {
      const updatedEntries = prev.map((entry) =>
        entry.id === editingId
          ? { ...entry, lyrics: editingLyrics, timestamp: Number.parseFloat(editingTimestamp) }
          : entry,
      )
      return updatedEntries.sort((a, b) => a.timestamp - b.timestamp)
    })

    setEditingId(null)
    setEditingLyrics(["", "", "", ""])
    setEditingTimestamp("0.00")
  }

  const cancelEditScoreEntry = () => {
    setEditingId(null)
    setEditingLyrics(["", "", "", ""])
    setEditingTimestamp("0.00")
  }

  const addScoreEntry = () => {
    // DOM要素から直接値を取得（より確実）
    const currentLyrics: [string, string, string, string] = [
      lyricsInputRefs.current[0]?.value || "",
      lyricsInputRefs.current[1]?.value || "",
      lyricsInputRefs.current[2]?.value || "",
      lyricsInputRefs.current[3]?.value || ""
    ]
    const currentTimestamp = timestampInputRef.current?.value || "0.00"
    
    const newEntry: ScoreEntry = {
      id: `entry_${Date.now()}`,
      timestamp: Number.parseFloat(currentTimestamp),
      lyrics: currentLyrics,
    }

    setScoreEntries((prev) => {
      const newEntries = [...prev, newEntry]
      return newEntries.sort((a, b) => a.timestamp - b.timestamp)
    })

    setLyrics(["", "", "", ""])
    setTimestamp("0.00")
    lyricsInputRefs.current[0]?.focus()
  }

  const getCurrentTimestamp = () => {
    if (player) {
      const currentTime = player.getCurrentTime()
      setTimestamp(currentTime.toFixed(2))
    }
  }


  const seekBackward = () => {
    if (player) {
      const currentTime = player.getCurrentTime()
      const newTime = Math.max(0, currentTime - 5)
      player.seekTo(newTime, true)
      setCurrentTime(newTime)
    }
  }

  const seekForward = () => {
    if (player) {
      const currentTime = player.getCurrentTime()
      const newTime = Math.min(duration, currentTime + 5)
      player.seekTo(newTime, true)
      setCurrentTime(newTime)
    }
  }

  const seekBackward1Second = () => {
    if (player) {
      const currentTime = player.getCurrentTime()
      const newTime = Math.max(0, currentTime - 1)
      player.seekTo(newTime, true)
      setCurrentTime(newTime)
    }
  }

  const seekForward1Second = () => {
    if (player) {
      const currentTime = player.getCurrentTime()
      const newTime = Math.min(duration, currentTime + 1)
      player.seekTo(newTime, true)
      setCurrentTime(newTime)
    }
  }

  const changePlaybackRate = (rate: number) => {
    if (player) {
      player.setPlaybackRate(rate)
      setPlaybackRate(rate)
    }
  }

  const seekTo = (time: number) => {
    if (player) {
      player.seekTo(time, true)
    }
  }

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }


  const halfWidthToFullWidth = (text: string): string => {
    return text
      .replace(/[a-z]/g, (char) => String.fromCharCode(char.charCodeAt(0) - "a".charCodeAt(0) + "ａ".charCodeAt(0)))
      .replace(/[A-Z]/g, (char) => String.fromCharCode(char.charCodeAt(0) - "A".charCodeAt(0) + "Ａ".charCodeAt(0)))
      .replace(/ /g, "　")
  }

  const convertLineToFullWidth = (index: number) => {
    const newLyrics = [...lyrics] as [string, string, string, string]
    newLyrics[index] = halfWidthToFullWidth(newLyrics[index])
    setLyrics(newLyrics)
  }

  const convertEditingLineToFullWidth = (index: number) => {
    const newLyrics = [...editingLyrics] as [string, string, string, string]
    newLyrics[index] = halfWidthToFullWidth(newLyrics[index])
    setEditingLyrics(newLyrics)
  }

  const convertAllToFullWidth = () => {
    const newLyrics = lyrics.map(line => halfWidthToFullWidth(line)) as [string, string, string, string]
    setLyrics(newLyrics)
  }

  const convertAllEditingToFullWidth = () => {
    const newLyrics = editingLyrics.map(line => halfWidthToFullWidth(line)) as [string, string, string, string]
    setEditingLyrics(newLyrics)
  }


  const getCurrentLyricsIndex = (): number => {
    if (!player || scoreEntries.length === 0) return -1

    for (let i = scoreEntries.length - 1; i >= 0; i--) {
      if (currentTime >= scoreEntries[i].timestamp) {
        return i
      }
    }
    return -1
  }

  const clearAllScoreEntries = () => {
    const confirm = window.confirm("すべてのページを削除しますか？この操作は取り消せません。")
    if (confirm) {
      setScoreEntries([])
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement
      const isInputFocused = activeElement?.tagName === "INPUT" || activeElement?.tagName === "TEXTAREA"
      const isSeekBarFocused = (activeElement as HTMLInputElement)?.type === "range"

      if (event.key === "F2") {
        event.preventDefault()
        getCurrentTimestamp()
        return
      }

      if (event.ctrlKey && event.key === "Enter") {
        event.preventDefault()
        addScoreEntry()
        return
      }

      if (event.ctrlKey && (event.key === " " || event.code === "Space")) {
        event.preventDefault()
        if (player) {
          const playerState = player.getPlayerState()
          if (playerState === window.YT.PlayerState.PLAYING) {
            player.pauseVideo()
          } else {
            player.playVideo()
          }
        }
        return
      }

      if (event.ctrlKey && event.key === "ArrowLeft") {
        event.preventDefault()
        seekBackward1Second()
        return
      }

      if (event.ctrlKey && event.key === "ArrowRight") {
        event.preventDefault()
        seekForward1Second()
        return
      }

      if (event.key === "Tab" && isInputFocused) {
        const currentIndex = lyricsInputRefs.current.findIndex((ref) => ref === activeElement)
        if (currentIndex >= 0 && currentIndex < 3) {
          event.preventDefault()
          lyricsInputRefs.current[currentIndex + 1]?.focus()
        } else if (currentIndex === 3) {
          event.preventDefault()
          timestampInputRef.current?.focus()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [player])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <input ref={fileInputRef} type="file" accept=".txt" onChange={handleFileImport} className="hidden" />
      
      {/* Header */}
      <header className="border-b bg-white dark:bg-slate-950">
        <div className="max-w-[1400px] mx-auto px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                Lyric Data Creator
              </h1>
            </div>
            {songTitle && (
              <div className="text-right">
                <div className="text-sm text-muted-foreground">現在の楽曲</div>
                <div className="font-semibold text-lg">{songTitle}</div>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1400px] mx-auto p-8">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <Card className="bg-white dark:bg-slate-900 border shadow-lg">
            <CardHeader className="pb-4">
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <div className="p-2 rounded-lg bg-green-500 text-white">
                  <Plus className="h-5 w-5" />
                </div>
                歌詞入力
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>ページ表示タイム（秒）</Label>
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
                  <Button variant="outline" onClick={getCurrentTimestamp} disabled={!player} className="h-12">
                    <Clock className="h-4 w-4 mr-2" />
                    タイムスタンプ取得
                  </Button>
                </div>
              </div>

              {lyrics.map((line, index) => (
                <div key={index}>
                  <Label>{index + 1}行目</Label>
                  <Input
                    ref={(el) => {
                      lyricsInputRefs.current[index] = el
                    }}
                    placeholder="空行の場合は入力不要"
                    value={line}
                    onChange={(e) => {
                      const newLyrics = [...lyrics] as [string, string, string, string]
                      newLyrics[index] = e.target.value
                      setLyrics(newLyrics)
                    }}
                    className="h-12 text-lg px-4"
                  />
                </div>
              ))}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={convertAllToFullWidth}
                  disabled={lyrics.every(line => !line.trim())}
                  className="flex-1"
                >
                  全角変換
                </Button>
              </div>

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

          <Card className="bg-white dark:bg-slate-900 border shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl font-semibold flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-purple-500 text-white">
                    <Clock className="h-5 w-5" />
                  </div>
                  ページ一覧 ({scoreEntries.length}件)
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={importScoreData}>
                    <Upload className="h-4 w-4 mr-2" />
                    インポート
                  </Button>
                  <Button variant="outline" size="sm" onClick={exportScoreData} disabled={scoreEntries.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    エクスポート
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {scoreEntries.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  ページがありません。歌詞を入力して追加してください。
                </p>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {scoreEntries.map((entry, index) => {
                    const isCurrentlyPlaying = getCurrentLyricsIndex() === index

                    return (
                      <div
                        key={entry.id}
                        className={`p-3 border rounded-lg hover:bg-muted/50 ${
                          isCurrentlyPlaying ? "bg-primary/10 border-primary" : ""
                        }`}
                      >
                        {editingId === entry.id ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-2">
                              <div className="text-sm font-mono text-muted-foreground w-12">#{index + 1}</div>
                              <Input
                                type="number"
                                step="0.01"
                                value={editingTimestamp}
                                onChange={(e) => setEditingTimestamp(e.target.value)}
                                className="w-20 text-sm font-mono"
                              />
                              <span className="text-sm">秒</span>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  if (player) {
                                    setEditingTimestamp(player.getCurrentTime().toFixed(2))
                                  }
                                }}
                                disabled={!player}
                                className="px-2"
                              >
                                <Clock className="h-3 w-3" />
                              </Button>
                            </div>
                            {editingLyrics.map((line, lineIndex) => (
                              <div key={lineIndex}>
                                <Input
                                  placeholder={`${lineIndex + 1}行目`}
                                  value={line}
                                  onChange={(e) => {
                                    const newLyrics = [...editingLyrics] as [string, string, string, string]
                                    newLyrics[lineIndex] = e.target.value
                                    setEditingLyrics(newLyrics)
                                  }}
                                  className="text-sm"
                                />
                              </div>
                            ))}
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={convertAllEditingToFullWidth}
                                disabled={editingLyrics.every(line => !line.trim())}
                                className="flex-1"
                              >
                                全角変換
                              </Button>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" onClick={saveEditScoreEntry}>
                                <Check className="h-4 w-4 mr-1" />
                                保存
                              </Button>
                              <Button variant="outline" size="sm" onClick={cancelEditScoreEntry}>
                                <X className="h-4 w-4 mr-1" />
                                キャンセル
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-4">
                            <div className="flex flex-col gap-1 min-w-fit justify-between self-stretch">
                              <div className="text-sm font-mono text-muted-foreground">#{index + 1}</div>
                              <div className="mt-auto">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => seekTo(entry.timestamp)}
                                  disabled={!player}
                                  className="text-xs font-mono h-6 px-2"
                                >
                                  <Play className="h-3 w-3 mr-1" />
                                  {entry.timestamp.toFixed(2)}s
                                </Button>
                              </div>
                            </div>
                            <div className={`flex-1 text-sm ${isCurrentlyPlaying ? "font-semibold text-primary" : ""}`}>
                              {entry.lyrics.map((line, lineIndex) => (
                                <div key={lineIndex} className={line ? "" : "text-muted-foreground"}>
                                  {line || "!"}
                                </div>
                              ))}
                            </div>
                            <div className="flex flex-col gap-1 min-w-fit self-center">
                              <Button variant="outline" size="sm" onClick={() => startEditScoreEntry(entry)} className="text-xs">
                                編集
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => deleteScoreEntry(entry.id)} className="text-xs">
                                削除
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              
              {scoreEntries.length > 0 && (
                <div className="mt-4 pt-3 border-t flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllScoreEntries}
                    className="text-black hover:bg-gray-50 text-xs"
                  >
                    全ページ削除
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
      
      {/* Keyboard Shortcuts Help */}
      <div className="mt-8 text-center">
        <div className="text-sm text-muted-foreground flex flex-wrap justify-center gap-x-6 gap-y-2">
          <span className="inline-flex items-center gap-2">
            <kbd className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-800 border rounded">F2</kbd>
            <span>タイムスタンプ取得</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <kbd className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-800 border rounded">Ctrl+Enter</kbd>
            <span>ページ追加</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <kbd className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-800 border rounded">Ctrl+Space</kbd>
            <span>再生/一時停止</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <kbd className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-800 border rounded">Ctrl+←</kbd>
            <span>1秒巻き戻し</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <kbd className="px-2 py-1 text-sm bg-gray-100 dark:bg-gray-800 border rounded">Ctrl+→</kbd>
            <span>1秒早送り</span>
          </span>
        </div>
      </div>
    </div>
  )
}