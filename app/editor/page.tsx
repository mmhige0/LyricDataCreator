"use client"

import { useState, useEffect, useCallback, useRef, type MouseEvent, type KeyboardEvent } from "react"
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
import { extractVideoId } from "@/lib/youtubeUtils"
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

  const extractSongMetadata = useCallback(async () => {
    if (!youtubeUrl) return
    if (songTitle.trim()) return
    if (!extractVideoId(youtubeUrl)) return
    const extractKey = youtubeUrl
    if (lastExtractKeyRef.current === extractKey) return
    lastExtractKeyRef.current = extractKey

    try {
      const response = await fetch('/api/extract-song-meta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ youtubeUrl }),
      })

      if (!response.ok) {
        console.warn('Failed to extract metadata', response.status)
        return
      }

      const data = await response.json()
      if (lastExtractKeyRef.current !== extractKey) return

      const extractedTitle = typeof data?.title === 'string' ? data.title.trim() : ''

      if (extractedTitle && (!songTitle || songTitle === autoTitleRef.current)) {
        autoTitleRef.current = extractedTitle
        setSongTitle(extractedTitle)
      }
    } catch (error) {
      console.warn('Failed to extract metadata', error)
    }
  }, [songTitle, youtubeUrl])

  const handleLoadYouTubeVideo = useCallback(() => {
    loadYouTubeVideo()
    void extractSongMetadata()
  }, [extractSongMetadata, loadYouTubeVideo])

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

  const editorTabRef = useRef<HTMLButtonElement>(null)
  const playTabRef = useRef<HTMLButtonElement>(null)
  const canPlay = scoreEntries.length > 0 && Boolean(youtubeUrl)

  const handleExport = useCallback((event?: MouseEvent<HTMLButtonElement>) => {
    const format = event?.shiftKey ? 'lrc' : 'txt'
    exportScoreData(format, () => {
      toast.success(`${format.toUpperCase()}を書き出しました`)
    })
  }, [exportScoreData])

  const handleTabKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return
    }

    event.preventDefault()
    const nextView = event.key === 'ArrowRight' ? 'play' : 'editor'
    if (nextView === 'play' && !canPlay) {
      return
    }

    setActiveView(nextView)
    if (nextView === 'play') {
      playTabRef.current?.focus()
      return
    }

    editorTabRef.current?.focus()
  }, [canPlay])

  return (
    <div className="min-h-screen page-shell pb-16">
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
            className="inline-flex items-center gap-1 rounded-full bg-muted p-1 text-sm shadow-inner"
            role="tablist"
            aria-label="画面モード切り替え"
            onKeyDown={handleTabKeyDown}
          >
            <Button
              ref={editorTabRef}
              variant="ghost"
              size="sm"
              onClick={() => setActiveView("editor")}
              role="tab"
              id="editor-tab"
              aria-controls="editor-panel"
              aria-selected={activeView === "editor"}
              tabIndex={activeView === "editor" ? 0 : -1}
              className={cn(
                "rounded-full px-4 font-medium transition-colors",
                activeView === "editor"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Edit3 className="h-5 w-5 mr-2" />
              編集
            </Button>
            <Button
              ref={playTabRef}
              variant="ghost"
              size="sm"
              onClick={handlePlay}
              disabled={!canPlay}
              role="tab"
              id="play-tab"
              aria-controls="play-panel"
              aria-selected={activeView === "play"}
              tabIndex={activeView === "play" ? 0 : -1}
              className={cn(
                "rounded-full px-4 font-medium transition-colors",
                activeView === "play"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
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
          <div id="play-panel" role="tabpanel" aria-labelledby="play-tab">
            <TypingGameContent
              onClose={() => setActiveView("editor")}
              showHeader={false}
              scoreEntries={scoreEntries}
              songTitle={songTitle || "無題"}
              youtubeUrl={youtubeUrl}
              totalDuration={duration}
            />
          </div>
        ) : (
          <div id="editor-panel" role="tabpanel" aria-labelledby="editor-tab">
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
                  loadYouTubeVideo={handleLoadYouTubeVideo}
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
                  lyrics={lyrics}
                  setLyrics={setLyrics}
                  timestamp={timestamp}
                  setTimestamp={setTimestamp}
                  player={player}
                  seekToInput={seekToInput}
                  mode="add"
                  isDisabled={Boolean(editingId)}
                  disabledReason="ページ編集中"
                  onAdd={addScoreEntry}
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
                  editingLyrics={editingLyrics}
                  setEditingLyrics={setEditingLyrics}
                  editingTimestamp={editingTimestamp}
                  setEditingTimestamp={setEditingTimestamp}
                  saveEditScoreEntry={saveEditScoreEntry}
                  cancelEditScoreEntry={cancelEditScoreEntry}
                  saveCurrentState={saveCurrentState}
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

            <section className="mt-8">
              <HelpSection />
            </section>
          </div>
        )}
      </main>

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
