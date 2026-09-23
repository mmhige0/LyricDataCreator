"use client"

import { useState, useEffect, useCallback, useRef, type MouseEvent, type KeyboardEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Edit3, Keyboard } from "lucide-react"
import { useYouTube } from "@/hooks/useYouTube"
import { useScoreManagement } from "@/hooks/useScoreManagement"
import { useKeyboardShortcuts, registerEditorKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"
import { useFileOperations } from "@/hooks/useFileOperations"
import { useLyricsCopyPaste } from "@/hooks/useLyricsCopyPaste"
import { useDraftAutoSave } from "@/hooks/useDraftAutoSave"
import { YouTubeVideoSection } from "@/components/YouTubeVideoSection"
import { TimestampOffsetControl } from "@/components/TimestampOffsetControl"
import { ScoreManagementSection } from "@/components/ScoreManagementSection"
import { EditorShortcuts } from "@/components/EditorShortcuts"
import { HelpSection } from "@/components/HelpSection"
import { DraftRestoreDialog } from "@/components/DraftRestoreDialog"
import { AppHeader } from "@/components/AppHeader"
import { TypingGameContent } from "@/components/TypingGameContent"
import { cn } from "@/lib/utils"
import { createNewSessionId, getOrCreateSessionId } from "@/lib/sessionStorage"
import { loadDraft, cleanupExpiredDrafts, getDraftList } from "@/lib/draftStorage"
import { adjacentLyricsPosition, pagePlaybackTimestamp } from '@/lib/lyricsNavigation'
import { extractVideoId } from "@/lib/youtubeUtils"
import type { DraftListEntry } from "@/lib/types"

export default function LyricsTypingApp() {
  const [isComposing, setIsComposing] = useState(false)
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
    resetPlayer,
  } = useYouTube()

  const {
    selectedLyrics,
    selectLyricsPosition,
    inlineEditing,
    startInlineEdit,
    changeInlineLyrics,
    replaceInlineLyrics,
    finishInlineEdit,
    updateInlineTimestamp,
    replacePageLyrics,
    scoreEntries,
    setScoreEntries,
    timestampOffset,
    setTimestampOffset,
    deleteScoreEntry,
    addEmptyScoreEntry,
    appendPageFromNavigation,
    getCurrentLyricsIndex,
    clearAllScoreEntries,
    undoLastOperation,
    redoLastOperation,
    canUndo,
    canRedo,
    saveCurrentState,
  } = useScoreManagement({ currentTime, currentPlayer: player })

  const handleGetCurrentTimestamp = useCallback(() => {
    if (!player) return
    const focusedPage = document.activeElement?.closest('[data-page-id]')?.getAttribute('data-page-id')
    const id = focusedPage ?? selectedLyrics?.id
    if (id) updateInlineTimestamp(getCurrentTimestamp(timestampOffset), id)
  }, [player, getCurrentTimestamp, timestampOffset, selectedLyrics, updateInlineTimestamp])

  const { pasteLyricsFromClipboard } = useLyricsCopyPaste()
  const pasteTargetRef = useRef(replacePageLyrics)
  useEffect(() => { pasteTargetRef.current = replacePageLyrics }, [replacePageLyrics])
  const handlePasteLyrics = useCallback(async () => {
    const entry = scoreEntries.find(item => item.id === selectedLyrics?.id)
    if (!entry) return
    const pastedLyrics = await pasteLyricsFromClipboard()
    if (pastedLyrics && !pasteTargetRef.current(entry.id, pastedLyrics, entry.lyrics)) {
      toast.info('歌詞が変更されたため、貼り付けを中止しました。')
    }
  }, [pasteLyricsFromClipboard, scoreEntries, selectedLyrics])

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
    playSelectedPage: () => {
      const focused = document.activeElement
      if (!player || !(focused instanceof Element)) return
      const time = pagePlaybackTimestamp(scoreEntries, focused.closest('[data-page-id]')?.getAttribute('data-page-id') ?? selectedLyrics?.id ?? null)
      if (time !== null) seekToAndPlay(time)
    },
    deleteSelectedPage: () => { if (selectedLyrics) deleteScoreEntry(selectedLyrics.id) },
    getCurrentTimestamp: handleGetCurrentTimestamp,
    seekBackward1Second,
    seekForward1Second,
    timestampOffset,
    pasteLyrics: handlePasteLyrics,
    undoLastOperation,
    redoLastOperation,
  })

  const keyboardHandlerRef = useRef(handleKeyDown)
  useEffect(() => { keyboardHandlerRef.current = handleKeyDown }, [handleKeyDown])
  useEffect(() => {
    if (activeView !== "editor" || isRestoreDialogOpen) return
    return registerEditorKeyboardShortcuts(event => keyboardHandlerRef.current(event))
  }, [activeView, isRestoreDialogOpen])

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
        // DOM要素の準備を待ってからロード
        if (draft.youtubeUrl) {
          setTimeout(() => {
            loadYouTubeVideo(draft.youtubeUrl)
          }, 200)
        }
      }
    },
    [setYoutubeUrl, setScoreEntries, setSongTitle, loadYouTubeVideo],
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
    enabled: isInitialized && !isRestoreDialogOpen,
    isComposing,
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

  const handleBackToEditor = useCallback(() => {
    if (activeView === "editor") return
    setActiveView("editor")
    // DOM要素の準備を待ってからロード
    if (youtubeUrl) {
      setTimeout(() => {
        loadYouTubeVideo()
      }, 200)
    }
  }, [activeView, youtubeUrl, loadYouTubeVideo])

  const handleTabKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
      return
    }

    event.preventDefault()
    if (event.key === 'ArrowRight') {
      if (!canPlay) return
      handlePlay()
      playTabRef.current?.focus()
    } else {
      handleBackToEditor()
      editorTabRef.current?.focus()
    }
  }, [canPlay, handlePlay, handleBackToEditor])

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
              onClick={handleBackToEditor}
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
              onClose={handleBackToEditor}
              showHeader={false}
              scoreEntries={scoreEntries}
              songTitle={songTitle || "無題"}
              youtubeUrl={youtubeUrl}
              totalDuration={duration}
            />
          </div>
        ) : (
          <div id="editor-panel" role="tabpanel" aria-labelledby="editor-tab">
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,0.8fr)_minmax(0,1.4fr)] gap-6 lg:items-start">
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

                <TimestampOffsetControl value={timestampOffset} onChange={setTimestampOffset} />
                <EditorShortcuts />
                <HelpSection />
              </div>

              <div className="min-w-0 lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] lg:min-h-0">
                <ScoreManagementSection
                  addEmptyScoreEntry={addEmptyScoreEntry}
                  selectedLyrics={selectedLyrics}
                  inlineActions={{
                    onAppendPage: appendPageFromNavigation,
                    onSelect: selectLyricsPosition,
                    onNavigate: (position, direction, unit) => adjacentLyricsPosition(scoreEntries, position, direction, unit),
                    onStart: startInlineEdit,
                    onChange: changeInlineLyrics,
                    onReplace: replaceInlineLyrics,
                    onFinish: finishInlineEdit,
                    onCompositionChange: setIsComposing,
                  }}
                  isInlineEditing={Boolean(inlineEditing)}
                  scoreEntries={scoreEntries}
                  duration={duration}
                  player={player}
                  onTimestampCapture={id => updateInlineTimestamp(getCurrentTimestamp(timestampOffset), id)}
                  onTimestampChange={updateInlineTimestamp}
                  onReplacePageLyrics={replacePageLyrics}
                  getCurrentLyricsIndex={getCurrentLyricsIndex}
                  importScoreData={importScoreData}
                  exportScoreData={handleExport}
                  deleteScoreEntry={deleteScoreEntry}
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


          </div>
        )}
      </main>

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
