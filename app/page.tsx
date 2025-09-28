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

        {/* 1. Basic Usage */}
        <div className="mb-8">
          <div className="text-base font-semibold text-foreground mb-4 border-b pb-2">基本的な使い方</div>
          <div className="text-sm text-gray-700 dark:text-gray-300">
            <ol className="list-decimal ml-4 space-y-1">
              <li>作成する曲のYouTubeのURLを入力し、「読み込み」をクリック</li>
              <li>1ページ単位での歌詞（最大4行）と、そのページの表示開始のタイムスタンプを入力し、「ページ追加」ボタンをクリック<br />（何も表示されないページを追加する場合は、4行とも空行にして追加）</li>
              <li>すべてのページを追加し終わったら、「エクスポート」をクリック</li>
            </ol>
          </div>
        </div>

        {/* 2. File Operations */}
        <div className="mb-8">
          <div className="text-base font-semibold text-foreground mb-4 border-b pb-2">ファイル操作</div>
          
          {/* Import/Export Information */}
          <div className="mb-6">
            <div className="text-sm font-medium text-foreground mb-3">インポート・エクスポート</div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left py-2 pr-4 font-medium w-32 border-b border-gray-200 dark:border-gray-700 pl-2">操作</th>
                    <th className="text-left py-2 font-medium border-b border-gray-200 dark:border-gray-700 pl-2">対応形式・備考</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <td className="py-3 pr-4 font-medium align-top pl-2">インポート</td>
                    <td className="py-3 pl-2">
                      <div className="mb-2">
                        <span className="font-mono text-xs bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded mr-2">.txt</span>
                        <span className="font-mono text-xs bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded">.lrc</span>
                      </div>
                      <div className="text-xs text-gray-700 dark:text-gray-300">
                        ※ LRCファイル：1行目に歌詞が読み込まれ、2〜4行目は空行になります
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td className="py-3 pr-4 font-medium align-top pl-2">エクスポート</td>
                    <td className="py-3 pl-2">
                      <span className="font-mono text-xs bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">.txt</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* File Format Information */}
          <div className="mb-6">
            <div className="text-sm font-medium text-foreground mb-2">ファイルフォーマット <span className="font-mono text-xs bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">.txt</span></div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <div className="font-mono text-xs bg-gray-100 dark:bg-gray-800 p-4 rounded mb-3">
                <div className="text-blue-600 dark:text-blue-400">120.5</div>
                <div>最初の歌詞/!/!/!/12.50</div>
                <div>次の歌詞/2行目/!/!/25.30</div>
                <div>!/!/!/!/999.9</div>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Controls and Shortcuts */}
        <div className="mb-8">
          <div className="text-base font-semibold text-foreground mb-4 border-b pb-2">ショートカットキー</div>
          
          {/* Keyboard Shortcuts Help */}
          <div className="mb-6">
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <kbd className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 border rounded font-mono min-w-[80px] text-center">F2</kbd>
                  <span className="text-sm">タイムスタンプ取得</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <kbd className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 border rounded font-mono min-w-[80px] text-center">Ctrl+Enter</kbd>
                  <span className="text-sm">ページ追加</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <kbd className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 border rounded font-mono min-w-[80px] text-center">Ctrl+Space</kbd>
                  <span className="text-sm">再生/一時停止</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <kbd className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 border rounded font-mono min-w-[80px] text-center">Ctrl+←</kbd>
                  <span className="text-sm">1秒巻き戻し</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <kbd className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-800 border rounded font-mono min-w-[80px] text-center">Ctrl+→</kbd>
                  <span className="text-sm">1秒早送り</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Other Features */}
        <div className="mb-8">
          <div className="text-base font-semibold text-foreground mb-4 border-b pb-2">その他の機能</div>
          
          {/* Text Processing Information */}
          <div className="mb-6">
            <div className="text-sm font-medium text-foreground mb-2">歌詞変換</div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <div>ページ追加・編集時に以下の変換が自動で行われます：</div>
              <ul className="ml-4 mt-1 list-disc">
                <li>前後のスペース削除</li>
                <li>記号削除</li>
                <li>半角文字 → 全角文字変換</li>
                <li>カタカナ → ひらがな変換</li>
              </ul>
            </div>
          </div>

          {/* kpm Information */}
          <div className="mb-6">
            <div className="text-sm font-medium text-foreground mb-2">kpm計算</div>
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <div>打ち切りに必要なkpmをローマ字入力換算で計算します。</div>
              <div className="text-xs mt-1 text-gray-700 dark:text-gray-300">※ 実際の打鍵数と誤差が生じる場合があります</div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}