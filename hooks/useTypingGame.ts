import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { ScoreEntry } from '@/lib/types'
import type { InputMode, LineWord } from '@/lib/typingUtils'
import { initializeLineWord } from '@/lib/typingUtils'
import { useInputJudge } from './useRomajiConverter'

type GameStatus = 'playing' | 'completed'

interface PageState {
  pageIndex: number
  currentLineIndex: number
  lineWords: LineWord[]
  pageStartTime: number | null
  pageLastInputTime: number | null
}

interface GameStats {
  totalTypes: number
  totalMiss: number
  accuracy: number
}

interface UseTypingGameProps {
  scoreEntries: ScoreEntry[]
  currentVideoTime: number
  onGameEnd?: () => void
  onRestartVideo?: () => void
  onTogglePlayPause?: () => void
  onSkipToNextPage?: () => void
  onPageChange?: (direction: 'prev' | 'next') => void
  isPlaying?: boolean
}

const createEmptyLineWord = (): LineWord => ({
  correct: { k: '', r: '' },
  nextChar: { k: '', r: [''], t: undefined },
  word: [],
})

const createBeforeFirstPageState = (): PageState => ({
  pageIndex: -1,
  currentLineIndex: 0,
  lineWords: [createEmptyLineWord(), createEmptyLineWord(), createEmptyLineWord(), createEmptyLineWord()],
  pageStartTime: null,
  pageLastInputTime: null,
})

const findTargetPageIndexByTime = (entries: ScoreEntry[], currentVideoTime: number): number => {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (currentVideoTime >= entries[i].timestamp) {
      return i
    }
  }
  return -1
}

const isLineIncomplete = (lineWord: LineWord | undefined): boolean => {
  if (!lineWord) return false
  return !!lineWord.nextChar.k || lineWord.word.length > 0
}

const isEmptyLine = (line: string): boolean => {
  return line.trim() === ''
}

const findNextNonEmptyLineIndex = (lyrics: string[], startIndex: number): number => {
  for (let i = startIndex; i < lyrics.length; i++) {
    if (!isEmptyLine(lyrics[i])) {
      return i
    }
  }
  // 空行しか残っていない場合は末尾を返す
  return lyrics.length
}

export const useTypingGame = ({
  scoreEntries,
  currentVideoTime,
  onGameEnd,
  onRestartVideo,
  onTogglePlayPause,
  onSkipToNextPage,
  onPageChange,
  isPlaying,
}: UseTypingGameProps) => {
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing')
  const [inputMode, setInputMode] = useState<InputMode>('roma')
  const [pageState, setPageState] = useState<PageState>({
    pageIndex: 0,
    currentLineIndex: 0,
    lineWords: [],
    pageStartTime: null,
    pageLastInputTime: null,
  })

  const [totalTypes, setTotalTypes] = useState(0)
  const [totalMiss, setTotalMiss] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)

  const { judgeInput } = useInputJudge()
  const hasInitializedPage = useRef(false)
  const hasInitializedOnMount = useRef(false)
  const hasLoadedInputMode = useRef(false)

  const correctSoundRef = useRef<HTMLAudioElement | null>(null)
  const missSoundRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const isGitHubPages = typeof window !== 'undefined' && window.location.hostname.includes('github.io')
    const basePath = isGitHubPages ? '/LyricDataCreator' : ''
    const soundBasePath = `${basePath}/sounds`

    correctSoundRef.current = new Audio(`${soundBasePath}/daken.mp3`)
    missSoundRef.current = new Audio(`${soundBasePath}/miss.mp3`)

    if (correctSoundRef.current) {
      correctSoundRef.current.volume = 1
    }
    if (missSoundRef.current) {
      missSoundRef.current.volume = 1
    }
  }, [])

  const initializePage = useCallback(
    (pageIndex: number) => {
      if (pageIndex >= scoreEntries.length) {
        setGameStatus('completed')
        onGameEnd?.()
        return
      }

      const entry = scoreEntries[pageIndex]
      const lineWords = entry.lyrics.map((line) => initializeLineWord(line))

      const firstNonEmptyLineIndex = findNextNonEmptyLineIndex(entry.lyrics, 0)

      setPageState({
        pageIndex,
        currentLineIndex: firstNonEmptyLineIndex,
        lineWords,
        pageStartTime: currentVideoTime,
        pageLastInputTime: null,
      })

      hasInitializedPage.current = true
    },
    [scoreEntries, currentVideoTime, onGameEnd]
  )

  const startGame = useCallback(() => {
    setGameStatus('playing')
    setTotalTypes(0)
    setTotalMiss(0)
    setCombo(0)
    setMaxCombo(0)
    initializePage(0)
  }, [initializePage])

  const restartGame = useCallback(() => {
    setGameStatus('playing')
    setTotalTypes(0)
    setTotalMiss(0)
    setCombo(0)
    setMaxCombo(0)
    setPageState({
      pageIndex: 0,
      currentLineIndex: 0,
      lineWords: [],
      pageStartTime: null,
      pageLastInputTime: null,
    })
    hasInitializedPage.current = false
    onRestartVideo?.()
  }, [onRestartVideo])

  // 入力モード切り替え（入力状態は保持）
  const toggleInputMode = useCallback(() => {
    setInputMode((prev) => (prev === 'roma' ? 'kana' : 'roma'))
  }, [])

  // 入力モードの保存・復元
  useEffect(() => {
    if (hasLoadedInputMode.current) return
    hasLoadedInputMode.current = true

    if (typeof window === 'undefined') return

    const storedInputMode = localStorage.getItem('typingInputMode')
    if (storedInputMode === 'roma' || storedInputMode === 'kana') {
      setInputMode(storedInputMode)
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('typingInputMode', inputMode)
  }, [inputMode])

  // 初回マウント時にページ0を初期化
  useEffect(() => {
    if (!hasInitializedOnMount.current && gameStatus === 'playing' && scoreEntries.length > 0) {
      hasInitializedOnMount.current = true
      initializePage(0)
    }
  }, [gameStatus, scoreEntries.length, initializePage])

  // 動画の再生位置に応じてページを追従
  useEffect(() => {
    if (gameStatus !== 'playing' || scoreEntries.length === 0 || !hasInitializedOnMount.current) {
      return
    }

    const targetPageIndex = findTargetPageIndexByTime(scoreEntries, currentVideoTime)

    // まだ最初のページより前の場合はダミー行を表示
    if (targetPageIndex === -1 && pageState.pageIndex !== -1) {
      setPageState(createBeforeFirstPageState())
      return
    }

    if (targetPageIndex !== pageState.pageIndex && targetPageIndex !== -1) {
      // ページを進めるときに、打ち切り状態ならコンボを切る
      if (targetPageIndex > pageState.pageIndex) {
        const currentLineWord = pageState.lineWords[pageState.currentLineIndex]
        if (isLineIncomplete(currentLineWord)) {
          setCombo(0)
        }
      }

      initializePage(targetPageIndex)
    }
  }, [
    currentVideoTime,
    gameStatus,
    scoreEntries,
    pageState.pageIndex,
    pageState.lineWords,
    pageState.currentLineIndex,
    initializePage,
  ])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (gameStatus !== 'playing') return

      // 修飾キーは無視
      if (
        event.key === 'Shift' ||
        event.key === 'Control' ||
        event.key === 'Alt' ||
        event.key === 'Meta'
      ) {
        return
      }

      // Esc: 再生/一時停止
      if (event.key === 'Escape') {
        event.preventDefault()
        onTogglePlayPause?.()
        return
      }

      // F4: ゲーム再スタート
      if (event.key === 'F4') {
        event.preventDefault()
        restartGame()
        return
      }

      // Space: 条件を満たすときに次ページへスキップ
      if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault()

        const hasNextPage = pageState.pageIndex < scoreEntries.length - 1
        if (!hasNextPage) return

        const nextPageTime = scoreEntries[pageState.pageIndex + 1].timestamp
        const remainingTime = nextPageTime - currentVideoTime

        const isPageFullyTyped =
          pageState.lineWords.length > 0 &&
          pageState.lineWords.every(
            (lineWord) => !lineWord.nextChar.k && lineWord.word.length === 0
          )

        const canSkip =
          !!isPlaying && hasNextPage && remainingTime >= 3 && isPageFullyTyped
        if (canSkip) {
          onSkipToNextPage?.()
        }
        return
      }

      // ←: 前のページ、→: 次のページ
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        if (isPlaying && pageState.pageIndex > 0) {
          onPageChange?.('prev')
        }
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        if (isPlaying && pageState.pageIndex < scoreEntries.length - 1) {
          onPageChange?.('next')
        }
        return
      }

      // 1文字キー以外はここでは処理しない（Tab など）
      if (event.key.length !== 1) {
        return
      }

      const currentEntry = scoreEntries[pageState.pageIndex]
      if (!currentEntry) return

      if (pageState.currentLineIndex >= currentEntry.lyrics.length) return

      event.preventDefault()

      const currentLineWord = pageState.lineWords[pageState.currentLineIndex]
      if (!currentLineWord) return

      const result = judgeInput(event, currentLineWord, inputMode)

      if (result.successKey) {
        setTotalTypes((prev) => prev + 1)

        if (correctSoundRef.current) {
          correctSoundRef.current.currentTime = 0
          correctSoundRef.current
            .play()
            .catch((e) => console.error('Failed to play correct sound:', e))
        }

        let updatedLineWord = result.newLineWord

        const isSpace = (char: string) => char === ' ' || char === '　'

        const nextCharAfterInput = updatedLineWord.nextChar.k
        const isWordCompletedFlag =
          isSpace(nextCharAfterInput) ||
          (!nextCharAfterInput && updatedLineWord.word.length === 0)

        if (isWordCompletedFlag) {
          setCombo((prev) => {
            const newCombo = prev + 1
            setMaxCombo((max) => Math.max(max, newCombo))
            return newCombo
          })
        }

        while (isSpace(updatedLineWord.nextChar.k) && updatedLineWord.word.length > 0) {
          updatedLineWord = {
            correct: {
              k: updatedLineWord.correct.k + updatedLineWord.nextChar.k,
              r: updatedLineWord.correct.r + updatedLineWord.nextChar.r[0],
            },
            nextChar: updatedLineWord.word[0],
            word: updatedLineWord.word.slice(1),
          }
        }

        setPageState((prev) => {
          const newLineWords = [...prev.lineWords]
          newLineWords[prev.currentLineIndex] = updatedLineWord

          const isLineCompleted =
            !updatedLineWord.nextChar.k && updatedLineWord.word.length === 0

          let nextLineIndex = prev.currentLineIndex
          if (isLineCompleted) {
            const entry = scoreEntries[prev.pageIndex]
            nextLineIndex = findNextNonEmptyLineIndex(entry.lyrics, prev.currentLineIndex + 1)
          }

          return {
            ...prev,
            lineWords: newLineWords,
            pageLastInputTime: currentVideoTime,
            currentLineIndex: nextLineIndex,
          }
        })
      } else if (result.failKey) {
        setTotalMiss((prev) => prev + 1)

        if (missSoundRef.current) {
          missSoundRef.current.currentTime = 0
          missSoundRef.current
            .play()
            .catch((e) => console.error('Failed to play miss sound:', e))
        }
      }
    },
    [
      currentVideoTime,
      gameStatus,
      inputMode,
      isPlaying,
      judgeInput,
      pageState.currentLineIndex,
      pageState.lineWords,
      pageState.pageIndex,
      restartGame,
      scoreEntries,
      onPageChange,
      onSkipToNextPage,
      onTogglePlayPause,
    ]
  )

  useEffect(() => {
    if (gameStatus === 'playing') {
      window.addEventListener('keydown', handleKeyDown)
      return () => {
        window.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [gameStatus, handleKeyDown])

  const gameStats: GameStats = useMemo(() => {
    const accuracy =
      totalTypes + totalMiss > 0 ? (totalTypes / (totalTypes + totalMiss)) * 100 : 0

    return {
      totalTypes,
      totalMiss,
      accuracy: Math.round(accuracy * 10) / 10,
    }
  }, [totalTypes, totalMiss])

  const changePageManually = useCallback(
    (direction: 'prev' | 'next') => {
      const targetPageIndex =
        pageState.pageIndex + (direction === 'next' ? 1 : -1)
      if (targetPageIndex >= 0 && targetPageIndex < scoreEntries.length) {
        initializePage(targetPageIndex)
        return scoreEntries[targetPageIndex].timestamp
      }
      return null
    },
    [pageState.pageIndex, scoreEntries, initializePage]
  )

  return {
    gameStatus,
    inputMode,
    pageState,
    totalTypes,
    totalMiss,
    combo,
    maxCombo,
    gameStats,
    startGame,
    restartGame,
    toggleInputMode,
    changePageManually,
  }
}
