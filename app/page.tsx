"use client"

import type React from "react"
import { useState } from "react"
import { useYouTube } from "@/hooks/useYouTube"
import { useScoreManagement } from "@/hooks/useScoreManagement"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"
import { useFileOperations } from "@/hooks/useFileOperations"
import { YouTubeVideoSection } from "@/components/YouTubeVideoSection"
import { LyricsEditCard } from "@/components/LyricsEditCard"
import { ScoreManagementSection } from "@/components/ScoreManagementSection"
import type { ScoreEntry, YouTubePlayer, LyricsArray } from "@/lib/types"


export default function LyricsTypingApp() {
  const [songTitle, setSongTitle] = useState<string>("")


  // YouTube統合フック
  const {
    isYouTubeAPIReady,
    youtubeUrl,
    setYoutubeUrl,
    videoId,
    isLoadingVideo,
    loadYouTubeVideo,
    player,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    togglePlayPause,
    seekBackward,
    seekForward,
    seekBackward1Second,
    seekForward1Second,
    seekToBeginning,
    changePlaybackRate,
    seekTo,
    getCurrentTimestamp,
    seekToInput
  } = useYouTube()

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
    timestampOffset,
    setTimestampOffset,
    lyricsInputRefs,
    timestampInputRef,
    deleteScoreEntry,
    startEditScoreEntry,
    saveEditScoreEntry,
    cancelEditScoreEntry,
    addScoreEntry,
    getCurrentLyricsIndex,
    clearAllScoreEntries
  } = useScoreManagement({ currentTime, currentPlayer: player })

  const handleGetCurrentTimestamp = () => {
    const timestampValue = getCurrentTimestamp(timestampOffset)
    setTimestamp(timestampValue)
  }

  // Initialize keyboard shortcuts hook
  useKeyboardShortcuts({
    player,
    getCurrentTimestamp: handleGetCurrentTimestamp,
    addScoreEntry,
    seekBackward1Second,
    seekForward1Second,
    lyricsInputRefs,
    timestampInputRef,
    timestampOffset
  })

  // Initialize file operations hook
  const { fileInputRef, exportScoreData, importScoreData, handleFileImport } = useFileOperations({
    scoreEntries,
    setScoreEntries,
    duration,
    setDuration: () => {}, // duration is now managed by useYouTube
    songTitle,
    setSongTitle
  })

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-16">
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
              player={player}
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
              seekToBeginning={seekToBeginning}
              changePlaybackRate={changePlaybackRate}
              seekTo={seekTo}
            />

            <LyricsEditCard
              lyrics={editingId ? editingLyrics : lyrics}
              setLyrics={editingId ? setEditingLyrics : setLyrics}
              timestamp={editingId ? editingTimestamp : timestamp}
              setTimestamp={editingId ? setEditingTimestamp : setTimestamp}
              player={player}
              seekToInput={seekToInput}
              mode={editingId ? 'edit' : 'add'}
              editingEntry={editingId ? scoreEntries.find(entry => entry.id === editingId) : null}
              editingEntryIndex={editingId ? scoreEntries.findIndex(entry => entry.id === editingId) : undefined}
              onAdd={addScoreEntry}
              onSave={saveEditScoreEntry}
              onCancel={cancelEditScoreEntry}
              lyricsInputRefs={lyricsInputRefs}
              timestampInputRef={timestampInputRef}
              timestampOffset={timestampOffset}
              setTimestampOffset={setTimestampOffset}
              getCurrentTimestamp={getCurrentTimestamp}
            />
          </div>

          {/* Right Column: Page Management */}
          <div className="lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] lg:min-h-0">
            <ScoreManagementSection
              scoreEntries={scoreEntries}
              player={player}
              editingId={editingId}
              getCurrentLyricsIndex={getCurrentLyricsIndex}
              importScoreData={importScoreData}
              exportScoreData={exportScoreData}
              deleteScoreEntry={deleteScoreEntry}
              startEditScoreEntry={startEditScoreEntry}
              clearAllScoreEntries={clearAllScoreEntries}
              seekTo={seekTo}
            />
          </div>
        </div>
      </main>
      
      {/* Help Section */}
      <div className="mt-8 max-w-[1600px] mx-auto px-8">
        <div className="text-lg font-semibold text-foreground mb-6">使い方・機能説明</div>

        {/* Text Processing Information */}
        <div className="mb-6">
          <div className="text-sm font-medium text-foreground mb-2">歌詞変換</div>
          <div className="text-sm text-muted-foreground">
            <div>ページ保存・追加時に記号削除・半角→全角変換・カタカナ→ひらがな変換が行われます。</div>
          </div>
        </div>

        {/* kpm Information */}
        <div className="mb-6">
          <div className="text-sm font-medium text-foreground mb-2">kpm</div>
          <div className="text-sm text-muted-foreground">
            <div>ローマ字換算での計算です。</div>
            <div>実際の打鍵数と誤差がある可能性があります。</div>
          </div>
        </div>

        {/* Keyboard Shortcuts Help */}
        <div className="mb-0">
          <div className="text-sm font-medium text-foreground mb-2">ショートカットキー</div>
          <div className="text-sm text-muted-foreground flex flex-wrap gap-x-6 gap-y-2">
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
    </div>
  )
}