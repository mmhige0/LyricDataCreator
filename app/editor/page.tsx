"use client"

import { useState, useEffect, useCallback, useRef, type MouseEvent, type KeyboardEvent } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Edit3, Keyboard, ArrowLeftRight } from "lucide-react"
import { useYouTube } from "@/hooks/useYouTube"
import { useScoreManagement } from "@/hooks/useScoreManagement"
import { useKeyboardShortcuts, registerEditorKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts"
import { useFileOperations } from "@/hooks/useFileOperations"
import { useLyricsCopyPaste } from "@/hooks/useLyricsCopyPaste"
import { useDraftAutoSave } from "@/hooks/useDraftAutoSave"
import { YouTubeVideoSection } from "@/components/YouTubeVideoSection"
import { CentralPopEditor } from '@/components/CentralPopEditor'
import { TimestampOffsetControl } from "@/components/TimestampOffsetControl"
import { ScoreManagementSection } from "@/components/ScoreManagementSection"
import { EditorShortcuts } from "@/components/EditorShortcuts"
import { popContent, serializePopClipboard, parsePopClipboard } from "@/lib/popClipboard"
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
  const [listView, setListView] = useState<'pages' | 'pops'>('pages')
  const [selectedPopId, setSelectedPopId] = useState<string | null>(null)
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
    centralPops,
    setCentralPops,
    addCentralPop,
    updateCentralPop,
    deleteCentralPop,
    clearAllCentralPops,
    resetPopEdit,
    toggleDecoration,
    updateDecorationAlign,
    adjustTimings,
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

  const selectedPop = listView === 'pops' ? centralPops.find(pop => pop.id === selectedPopId) : undefined
  const popStateRef = useRef({ centralPops, updateCentralPop, resetPopEdit })
  useEffect(() => { popStateRef.current = { centralPops, updateCentralPop, resetPopEdit } }, [centralPops, updateCentralPop, resetPopEdit])
  const addPop = () => {
    const id = addCentralPop()
    setSelectedPopId(id)
    requestAnimationFrame(() => {
      const input = document.getElementById(`pop-text-${id}`)
      input?.focus({ preventScroll: true }); input?.scrollIntoView({ block: 'nearest' })
    })
  }
  const deletePop = (id: string) => {
    const index = centralPops.findIndex(pop => pop.id === id)
    if (index < 0) return
    deleteCentralPop(id)
    if (id === selectedPopId) setSelectedPopId((centralPops[index + 1] ?? centralPops[index - 1])?.id ?? null)
  }
  const copyPop = async () => {
    if (!selectedPop) return
    try { await navigator.clipboard.writeText(serializePopClipboard(selectedPop)) }
    catch { toast.error('ポップをコピーできませんでした。') }
  }
  const pastePop = async () => {
    if (!selectedPop) return
    const expected = JSON.stringify(popContent(selectedPop))
    try {
      const content = parsePopClipboard(await navigator.clipboard.readText())
      const current = popStateRef.current.centralPops.find(pop => pop.id === selectedPop.id)
      if (!current || JSON.stringify(popContent(current)) !== expected) { toast.info('ポップが変更されたため、貼り付けを中止しました。'); return }
      popStateRef.current.resetPopEdit()
      popStateRef.current.updateCentralPop(current.id, content)
      popStateRef.current.resetPopEdit()
    } catch { toast.error('ポップをコピーしたデータを貼り付けてください。') }
  }

  const handleGetCurrentTimestamp = useCallback(() => {
    if (!player) return
    const popId = listView === 'pops' ? selectedPop?.id : undefined
    if (listView === 'pops') {
      if (popId) updateCentralPop(popId, { timestamp: Number(getCurrentTimestamp(timestampOffset)) })
      return
    }
    const focusedPage = document.activeElement?.closest('[data-page-id]')?.getAttribute('data-page-id')
    const id = focusedPage ?? selectedLyrics?.id
    if (id) updateInlineTimestamp(getCurrentTimestamp(timestampOffset), id)
  }, [player, getCurrentTimestamp, timestampOffset, selectedLyrics, updateInlineTimestamp, updateCentralPop, listView, selectedPop])

  const { copyLyricsToClipboard, pasteLyricsFromClipboard } = useLyricsCopyPaste()
  const focusedPageId = () => document.activeElement?.closest('[data-page-id]')?.getAttribute('data-page-id') ?? selectedLyrics?.id
  const handleCopyLyrics = () => {
    const entry = scoreEntries.find(item => item.id === focusedPageId())
    if (entry) void copyLyricsToClipboard(entry.lyrics, entry.decorations, entry.decorationAligns)
  }
  const pasteTargetRef = useRef(replacePageLyrics)
  useEffect(() => { pasteTargetRef.current = replacePageLyrics }, [replacePageLyrics])
  const handlePasteLyrics = useCallback(async () => {
    const entry = scoreEntries.find(item => item.id === selectedLyrics?.id)
    if (!entry) return
    const pastedLyrics = await pasteLyricsFromClipboard()
    if (pastedLyrics && !pasteTargetRef.current(entry.id, pastedLyrics.lyrics, entry.lyrics, pastedLyrics.decorations, entry.decorations, pastedLyrics.decorationAligns, entry.decorationAligns)) {
      toast.info('歌詞が変更されたため、貼り付けを中止しました。')
    }
  }, [pasteLyricsFromClipboard, scoreEntries, selectedLyrics])

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
    popShortcuts: selectedPop ? {
      capture: handleGetCurrentTimestamp,
      navigate: direction => {
        const index = centralPops.findIndex(pop => pop.id === selectedPop.id)
        const next = centralPops[index + direction]
        if (!next) return
        setSelectedPopId(next.id)
        requestAnimationFrame(() => {
          const row = document.getElementById(`pop-row-${next.id}`)
          row?.focus({ preventScroll: true }); row?.scrollIntoView({ block: 'nearest' })
        })
      },
      copy: () => { void copyPop() }, paste: () => { void pastePop() },
      delete: () => deletePop(selectedPop.id),
    } : undefined,
    playSelectedPage: () => {
      if (listView === 'pops') { if (player && selectedPop) seekToAndPlay(selectedPop.timestamp); return }
      const focused = document.activeElement
      if (!player || !(focused instanceof Element)) return
      const time = pagePlaybackTimestamp(scoreEntries, focused.closest('[data-page-id]')?.getAttribute('data-page-id') ?? selectedLyrics?.id ?? null)
      if (time !== null) seekToAndPlay(time)
    },
    addPage: listView === 'pages' ? () => addEmptyScoreEntry() : addPop,
    deleteSelectedPage: listView === 'pages' ? () => { if (selectedLyrics) deleteScoreEntry(selectedLyrics.id) } : undefined,
    getCurrentTimestamp: handleGetCurrentTimestamp,
    seekBackward1Second,
    seekForward1Second,
    timestampOffset,
    pasteLyrics: listView === 'pages' ? handlePasteLyrics : undefined,
    copyLyrics: listView === 'pages' && selectedLyrics ? handleCopyLyrics : undefined,
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
        saveCurrentState()
        setScoreEntries(draft.scoreEntries)
        setCentralPops(draft.centralPops ?? [])
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
    [setYoutubeUrl, setScoreEntries, setCentralPops, saveCurrentState, setSongTitle, loadYouTubeVideo],
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
    centralPops,
    songTitle,
    enabled: isInitialized && !isRestoreDialogOpen,
    isComposing,
  })

  const { fileInputRef, exportScoreData, importScoreData, handleFileImport } = useFileOperations({
    scoreEntries,
    setScoreEntries,
    centralPops,
    setCentralPops,
    onBeforeImport: saveCurrentState,
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
            <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,0.95fr)_minmax(0,1.25fr)] gap-6 lg:items-start">
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

              <div id="right-column" className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)] lg:min-h-0">
                <div id="pops-list-panel" aria-label="ポップ一覧" hidden={listView !== 'pops'} className="min-h-0 flex-1">
                  <CentralPopEditor titleAction={<Button variant="ghost" size="sm" className="h-7 gap-1 px-1 text-xs font-normal" title="ページ一覧に切り替え" onClick={() => setListView('pages')} aria-label="ページ一覧に切り替え"><ArrowLeftRight className="h-4 w-4" aria-hidden="true" /><span>ページ一覧</span></Button>} pops={centralPops} selectedId={selectedPopId} onSelect={setSelectedPopId}
                    onAdd={addPop} onAdjust={adjustTimings} pageCount={scoreEntries.length} onClear={() => { clearAllCentralPops(); setSelectedPopId(null) }} onUpdate={(id, changes) => updateCentralPop(id, changes, 'edit')} onDelete={deletePop}
                    onEditBoundary={resetPopEdit} onPlay={player ? seekToAndPlay : undefined} onCompositionChange={setIsComposing} />
                </div>
                <div id="pages-list-panel" aria-label="ページ一覧" hidden={listView !== 'pages'} className="min-h-0 flex-1">
                <ScoreManagementSection
                  titleAction={<Button variant="ghost" size="sm" className="h-7 gap-1 px-1 text-xs font-normal" title="ポップ一覧に切り替え" onClick={() => setListView('pops')} aria-label="ポップ一覧に切り替え"><ArrowLeftRight className="h-4 w-4" aria-hidden="true" /><span>ポップ一覧</span></Button>}
                  addEmptyScoreEntry={addEmptyScoreEntry}
                  selectedLyrics={selectedLyrics}
                  inlineActions={{
                    onToggleDecoration: toggleDecoration,
                    onDecorationAlign: updateDecorationAlign,
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
                  centralPopCount={centralPops.length}
                  bulkAdjustTimings={adjustTimings}
                  undoLastOperation={undoLastOperation}
                  redoLastOperation={redoLastOperation}
                  canUndo={canUndo}
                  canRedo={canRedo}
                />
                </div>
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
