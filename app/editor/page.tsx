"use client"

import { useState, useEffect, useCallback, useRef, type MouseEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Edit3, Keyboard } from "lucide-react"
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
import { AppHeader } from "@/components/AppHeader"
import { TypingGameContent } from "@/components/TypingGameContent"
import { CreditsSection } from "@/components/CreditsSection"
import { cn } from "@/lib/utils"
import { createNewSessionId, getOrCreateSessionId } from "@/lib/sessionStorage"
import { loadDraft, cleanupExpiredDrafts, getDraftList } from "@/lib/draftStorage"
import type { DraftListEntry } from "@/lib/types"

export default function LyricsTypingApp() {
  const [songTitle, setSongTitle] = useState<string>("")
  const [isRestoreDialogOpen, setIsRestoreDialogOpen] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [activeView, setActiveView] = useState<"editor" | "play">("editor")
  const [drafts, setDrafts] = useState<DraftListEntry[]>([])
  const hasRestoredDraftRef = useRef(false)
  const autoTitleRef = useRef<string | null>(null)
  const lastExtractKeyRef = useRef<string | null>(null)

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
    setDuration,
    videoTitle,
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
    seekToInput,
    resetPlayer,
  } = useYouTube()

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
    saveCurrentState,
  } = useScoreManagement({ currentTime, currentPlayer: player })

  const handleGetCurrentTimestamp = useCallback(() => {
    const timestampValue = getCurrentTimestamp(timestampOffset)
    if (editingId) {
      setEditingTimestamp(timestampValue)
    } else {
      setTimestamp(timestampValue)
    }
  }, [getCurrentTimestamp, timestampOffset, editingId, setTimestamp, setEditingTimestamp])

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

  const handleBulkTimingAdjust = useCallback(
    (offsetSeconds: number) => {
      saveCurrentState()
      const adjustedEntries = scoreEntries.map((entry) => ({
        ...entry,
        timestamp: Math.max(0, entry.timestamp + offsetSeconds),
      }))
      setScoreEntries(adjustedEntries)
      const sign = offsetSeconds > 0 ? "+" : ""
      toast.success(
        `${scoreEntries.length}件のページのタイミングを${sign}${offsetSeconds.toFixed(2)}秒ずらしました`,
      )
    },
    [saveCurrentState, scoreEntries, setScoreEntries],
  )

  const handlePlay = useCallback(() => {
    if (scoreEntries.length === 0) {
      toast.error("ページが登録されていません")
      return
    }
    if (!youtubeUrl) {
      toast.error("YouTube URLが設定されていません")
      return
    }

    // 編集ビューからプレイビューに切り替える前に、
    // 一度既存の YouTube プレイヤーを破棄しておく。
    // これにより、プレイモードから戻ったあと再度 URL を読み込めるようにする。
    resetPlayer()

    setActiveView("play")
  }, [scoreEntries, youtubeUrl, resetPlayer])

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
    redoLastOperation,
  })

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [handleKeyDown])

  useEffect(() => {
    cleanupExpiredDrafts()

    getOrCreateSessionId()

    const draftList = getDraftList()
    if (draftList.length > 0) {
      const sortedDrafts = [...draftList].sort((a, b) => b.lastModified - a.lastModified)
      setDrafts(sortedDrafts)
      hasRestoredDraftRef.current = false
      setIsRestoreDialogOpen(true)
    }

    setIsInitialized(true)
  }, [])

  useEffect(() => {
    if (!videoTitle) return
    if (songTitle.trim()) return
    const extractKey = videoTitle
    if (lastExtractKeyRef.current === extractKey) return
    lastExtractKeyRef.current = extractKey
    let isCancelled = false

    const extractMetadata = async () => {
      try {
        const response = await fetch('/api/extract-song-meta', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title: videoTitle }),
        })

        if (!response.ok) {
          console.warn('Failed to extract metadata', response.status)
          return
        }

        const data = await response.json()
        if (isCancelled) return

        const extractedTitle = typeof data?.title === 'string' ? data.title.trim() : ''

        if (extractedTitle && (!songTitle || songTitle === autoTitleRef.current)) {
          autoTitleRef.current = extractedTitle
          setSongTitle(extractedTitle)
        }
      } catch (error) {
        console.warn('Failed to extract metadata', error)
      }
    }

    extractMetadata()
    return () => {
      isCancelled = true
    }
  }, [videoTitle, songTitle])

  const handleRestoreDraft = useCallback(
    (sessionId: string) => {
      hasRestoredDraftRef.current = true
      const draft = loadDraft(sessionId)
      if (draft) {
        setYoutubeUrl(draft.youtubeUrl)
        setScoreEntries(draft.scoreEntries)
        setSongTitle(draft.songTitle)
        toast.success("下書きを復元しました")
      }
    },
    [setYoutubeUrl, setScoreEntries, setSongTitle],
  )

  const handleCloseRestoreDialog = useCallback(() => {
    setIsRestoreDialogOpen(false)
    if (!hasRestoredDraftRef.current) {
      createNewSessionId()
    }
  }, [])

  useDraftAutoSave({
    youtubeUrl,
    scoreEntries,
    songTitle,
    enabled: isInitialized,
  })

  const { fileInputRef, exportScoreData, importScoreData, handleFileImport } = useFileOperations({
    scoreEntries,
    setScoreEntries,
    duration,
    setDuration,
    songTitle,
    setSongTitle,
  })

  const handleExport = useCallback((event?: MouseEvent<HTMLButtonElement>) => {
    const format = event?.shiftKey ? 'lrc' : 'txt'
    exportScoreData(format, () => {
      toast.success(`${format.toUpperCase()}を書き出しました`)
    })
  }, [exportScoreData])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-16">
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.lrc"
        onChange={handleFileImport}
        className="hidden"
      />

      <AppHeader
        title="Song Typing Theater"
        titleHref="/"
        songTitle={songTitle || undefined}
        actions={
          <div
            className="inline-flex items-center gap-1 rounded-full bg-slate-100 p-1 text-sm shadow-inner dark:bg-slate-900"
            role="tablist"
            aria-label="画面モード切り替え"
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveView("editor")}
              role="tab"
              aria-selected={activeView === "editor"}
              className={cn(
                "rounded-full px-4 font-medium transition-colors",
                activeView === "editor"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-100"
                  : "text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
              )}
            >
              <Edit3 className="h-5 w-5 mr-2" />
              編集
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePlay}
              disabled={scoreEntries.length === 0 || !youtubeUrl}
              role="tab"
              aria-selected={activeView === "play"}
            className={cn(
              "rounded-full px-4 font-medium transition-colors",
              activeView === "play"
                ? "bg-white text-slate-900 shadow-sm dark:bg-slate-100"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white",
            )}
          >
              <Keyboard className="h-5 w-5 mr-2" />
              プレイ
            </Button>
          </div>
        }
      />

      <main className="max-w-[1600px] mx-auto p-4 lg:p-8">
        {activeView === "play" ? (
          <TypingGameContent
            onClose={() => setActiveView("editor")}
            showHeader={false}
            scoreEntries={scoreEntries}
            songTitle={songTitle || "無題"}
            youtubeUrl={youtubeUrl}
            totalDuration={duration}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:items-start">
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
                mode={editingId ? "edit" : "add"}
                editingEntry={editingId ? scoreEntries.find((entry) => entry.id === editingId) : null}
                editingEntryIndex={
                  editingId ? scoreEntries.findIndex((entry) => entry.id === editingId) : undefined
                }
                onAdd={addScoreEntry}
                onSave={saveEditScoreEntry}
                onCancel={cancelEditScoreEntry}
                lyricsInputRefs={lyricsInputRefs}
                timestampInputRef={timestampInputRef}
                timestampOffset={timestampOffset}
                setTimestampOffset={setTimestampOffset}
                getCurrentTimestamp={getCurrentTimestamp}
                saveCurrentState={saveCurrentState}
              />
            </div>

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
        )}
      </main>

      {activeView === "editor" && (
        <section className="mt-8">
          <HelpSection />
        </section>
      )}

      <CreditsSection />

      <DraftRestoreDialog
        isOpen={isRestoreDialogOpen}
        drafts={drafts}
        setDrafts={setDrafts}
        onClose={handleCloseRestoreDialog}
        onRestore={handleRestoreDraft}
      />
    </div>
  )
}
