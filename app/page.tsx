"use client"

import type React from "react"
import { useState, useEffect, useCallback } from "react"
import { toast } from "sonner"
import { useYouTube } from "@/hooks/useYouTube"
import { useScoreManagement } from "@/hooks/useScoreManagement"
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"
import { useFileOperations } from "@/hooks/useFileOperations"
import { useLyricsCopyPaste } from "@/hooks/useLyricsCopyPaste"
import { useDraftAutoSave } from "@/hooks/useDraftAutoSave"
import { YouTubeVideoSection } from "@/components/YouTubeVideoSection"
import { LyricsEditCard } from "@/components/LyricsEditCard"
import { ScoreManagementSection } from "@/components/ScoreManagementSection"
import { HelpSection } from "@/components/HelpSection"
import { DraftRestoreDialog } from "@/components/DraftRestoreDialog"
import type { ScoreEntry, YouTubePlayer, LyricsArray } from "@/lib/types"
import { setSessionId } from "@/lib/sessionStorage"
import { loadDraft, cleanupExpiredDrafts, getDraftList } from "@/lib/draftStorage"


export default function LyricsTypingApp() {
  const [songTitle, setSongTitle] = useState<string>("")
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)


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
    seekTo,
    seekToAndPlay,
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
    clearAllScoreEntries,
    undoLastOperation,
    redoLastOperation,
    canUndo,
    canRedo,
    saveCurrentState
  } = useScoreManagement({ currentTime, currentPlayer: player })

  const handleGetCurrentTimestamp = useCallback(() => {
    const timestampValue = getCurrentTimestamp(timestampOffset)
    setTimestamp(timestampValue)
  }, [getCurrentTimestamp, timestampOffset, setTimestamp])

  // Initialize lyrics copy/paste hook
  const { pasteLyricsFromClipboard } = useLyricsCopyPaste()

  const handlePasteLyrics = useCallback(async () => {
    const pastedLyrics = await pasteLyricsFromClipboard()
    if (pastedLyrics) {
      if (editingId) {
        setEditingLyrics(pastedLyrics)
      } else {
        setLyrics(pastedLyrics)
      }
    }
  }, [pasteLyricsFromClipboard, editingId, setEditingLyrics, setLyrics])

  // Bulk timing adjustment function
  const handleBulkTimingAdjust = useCallback((offsetSeconds: number) => {
    saveCurrentState()
    const adjustedEntries = scoreEntries.map(entry => ({
      ...entry,
      timestamp: Math.max(0, entry.timestamp + offsetSeconds)
    }))
    setScoreEntries(adjustedEntries)
    toast.success(`${scoreEntries.length}件のページのタイミングを${offsetSeconds > 0 ? '+' : ''}${offsetSeconds.toFixed(2)}秒調整しました`)
  }, [saveCurrentState, scoreEntries, setScoreEntries])

  // Get keyboard shortcut handler
  const handleKeyDown = useKeyboardShortcuts({
    player,
    getCurrentTimestamp: handleGetCurrentTimestamp,
    addScoreEntry,
    saveScoreEntry: saveEditScoreEntry,
    editingId,
    seekBackward1Second,
    seekForward1Second,
    lyricsInputRefs,
    timestampInputRef,
    timestampOffset,
    pasteLyrics: handlePasteLyrics,
    undoLastOperation,
    redoLastOperation
  })

  // Register keyboard event listener
  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [handleKeyDown])

  // Initialize session and check for drafts
  useEffect(() => {
    // Cleanup expired drafts
    cleanupExpiredDrafts()

    // Always create a new session ID (even on page refresh)
    const sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
    setSessionId(sessionId)

    // Check if there are drafts available
    const draftList = getDraftList()
    if (draftList.length > 0) {
      // Show restore dialog if any drafts exist
      setIsRestoreDialogOpen(true)
    }

    setIsInitialized(true)
  }, [])

  // Restore draft from dialog
  const handleRestoreDraft = useCallback((sessionId: string) => {
    const draft = loadDraft(sessionId)
    if (draft) {
      setYoutubeUrl(draft.youtubeUrl)
      setScoreEntries(draft.scoreEntries)
      setSongTitle(draft.songTitle)
      toast.success('下書きを復元しました')
    }
  }, [setYoutubeUrl, setScoreEntries])

  // Auto-save draft
  useDraftAutoSave({
    youtubeUrl,
    scoreEntries,
    songTitle,
    enabled: isInitialized
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

  // Handle export
  const handleExport = useCallback(() => {
    exportScoreData(() => {
      toast.success('保存が完了しました')
    })
  }, [exportScoreData])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-16">
      <input ref={fileInputRef} type="file" accept=".txt,.lrc" onChange={handleFileImport} className="hidden" />
      
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
              volume={volume}
              isMuted={isMuted}
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
              setPlayerVolume={setPlayerVolume}
              adjustVolume={adjustVolume}
              toggleMute={toggleMute}
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
              duration={duration}
              player={player}
              editingId={editingId}
              getCurrentLyricsIndex={getCurrentLyricsIndex}
              importScoreData={importScoreData}
              exportScoreData={handleExport}
              deleteScoreEntry={deleteScoreEntry}
              startEditScoreEntry={startEditScoreEntry}
              clearAllScoreEntries={clearAllScoreEntries}
              seekToAndPlay={seekToAndPlay}
              bulkAdjustTimings={handleBulkTimingAdjust}
              undoLastOperation={undoLastOperation}
              redoLastOperation={redoLastOperation}
              canUndo={canUndo}
              canRedo={canRedo}
            />
          </div>
        </div>
      </main>

      <HelpSection />

      {/* Footer with Credits */}
      <footer className="mt-16 py-8 border-t">
        <div className="max-w-[1600px] mx-auto px-8">
          <div className="flex items-center justify-end text-sm text-muted-foreground">
            <div className="flex items-center space-x-1">
              <span>Favicon from</span>
              <a
                href="https://illust-stock.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors duration-200"
              >
                イラストストック
              </a>
              <span>様</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Draft Restore Dialog */}
      <DraftRestoreDialog
        isOpen={isRestoreDialogOpen}
        onClose={() => setIsRestoreDialogOpen(false)}
        onRestore={handleRestoreDraft}
      />
    </div>
  )
}