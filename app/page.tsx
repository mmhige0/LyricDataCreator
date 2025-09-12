"use client"

import type React from "react"
import { useState, useRef } from "react"
import { useYouTubeAPI, useYouTubePlayer, useYouTubeVideo } from "@/hooks/useYouTube"
import { useScoreManagement } from "@/hooks/useScoreManagement"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"
import { useFileOperations } from "@/hooks/useFileOperations"
import { YouTubeVideoSection } from "@/components/YouTubeVideoSection"
import { LyricsInputSection } from "@/components/LyricsInputSection"
import { ScoreManagementSection } from "@/components/ScoreManagementSection"
import type { ScoreEntry, YouTubePlayer, LyricsArray } from "@/lib/types"


export default function LyricsTypingApp() {
  const { isYouTubeAPIReady } = useYouTubeAPI()
  
  const [duration, setDuration] = useState<number>(0)
  const [player, setPlayer] = useState<YouTubePlayer | null>(null)
  const [songTitle, setSongTitle] = useState<string>("")

  // YouTube Video hook
  const { 
    youtubeUrl, 
    setYoutubeUrl, 
    videoId, 
    player: videoPlayer, 
    isLoadingVideo, 
    loadYouTubeVideo 
  } = useYouTubeVideo({
    isYouTubeAPIReady,
    setPlayer,
    setDuration,
    setIsPlaying: (playing) => setIsPlaying(playing)
  })

  // YouTube Player hook
  const {
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    playbackRate,
    togglePlayPause,
    seekBackward,
    seekForward,
    seekBackward1Second,
    seekForward1Second,
    changePlaybackRate,
    seekTo,
    getCurrentTimestamp
  } = useYouTubePlayer({ player: videoPlayer || player, duration })

  // Use player from video hook if available, fallback to local state
  const currentPlayer = videoPlayer || player

  // Score Management hook
  const {
    scoreEntries,
    setScoreEntries,
    lyrics,
    setLyrics,
    timestamp,
    setTimestamp,
    editingId,
    editingLyrics,
    setEditingLyrics,
    editingTimestamp,
    setEditingTimestamp,
    lyricsInputRefs,
    timestampInputRef,
    deleteScoreEntry,
    startEditScoreEntry,
    saveEditScoreEntry,
    cancelEditScoreEntry,
    addScoreEntry,
    getCurrentLyricsIndex,
    clearAllScoreEntries
  } = useScoreManagement({ currentTime, currentPlayer })

  const handleGetCurrentTimestamp = () => {
    const timestampValue = getCurrentTimestamp()
    setTimestamp(timestampValue)
  }

  // Initialize keyboard shortcuts hook
  useKeyboardShortcuts({
    player: currentPlayer,
    getCurrentTimestamp: handleGetCurrentTimestamp,
    addScoreEntry,
    seekBackward1Second,
    seekForward1Second,
    lyricsInputRefs,
    timestampInputRef
  })

  // Initialize file operations hook
  const { fileInputRef, exportScoreData, importScoreData, handleFileImport } = useFileOperations({
    scoreEntries,
    setScoreEntries,
    duration,
    setDuration,
    songTitle,
    setSongTitle
  })

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

      <main className="max-w-[1600px] mx-auto p-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-start">
          {/* Left Column: YouTube Video & Lyrics Input */}
          <div className="space-y-6" id="left-column">
            <YouTubeVideoSection
              youtubeUrl={youtubeUrl}
              setYoutubeUrl={setYoutubeUrl}
              videoId={videoId}
              player={currentPlayer}
              isPlaying={isPlaying}
              currentTime={currentTime}
              duration={duration}
              playbackRate={playbackRate}
              isLoadingVideo={isLoadingVideo}
              isYouTubeAPIReady={isYouTubeAPIReady}
              loadYouTubeVideo={loadYouTubeVideo}
              togglePlayPause={togglePlayPause}
              seekBackward={seekBackward}
              seekForward={seekForward}
              seekBackward1Second={seekBackward1Second}
              seekForward1Second={seekForward1Second}
              changePlaybackRate={changePlaybackRate}
              seekTo={seekTo}
            />

            <LyricsInputSection
              lyrics={lyrics}
              setLyrics={setLyrics}
              timestamp={timestamp}
              setTimestamp={setTimestamp}
              player={currentPlayer}
              lyricsInputRefs={lyricsInputRefs}
              timestampInputRef={timestampInputRef}
              addScoreEntry={addScoreEntry}
            />
          </div>

          {/* Right Column: Page Management */}
          <div className="lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] lg:min-h-0">
            <ScoreManagementSection
              scoreEntries={scoreEntries}
              player={currentPlayer}
              editingId={editingId}
              editingLyrics={editingLyrics}
              editingTimestamp={editingTimestamp}
              setEditingLyrics={setEditingLyrics}
              setEditingTimestamp={setEditingTimestamp}
              getCurrentLyricsIndex={getCurrentLyricsIndex}
              importScoreData={importScoreData}
              exportScoreData={exportScoreData}
              deleteScoreEntry={deleteScoreEntry}
              startEditScoreEntry={startEditScoreEntry}
              saveEditScoreEntry={saveEditScoreEntry}
              cancelEditScoreEntry={cancelEditScoreEntry}
              clearAllScoreEntries={clearAllScoreEntries}
              seekTo={seekTo}
            />
          </div>
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