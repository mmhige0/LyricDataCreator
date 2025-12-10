import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { withBasePath } from '@/lib/basePath'
import type { ScoreEntry } from '@/lib/types'
import type { BuiltMapLine, TypingWord, InputMode } from 'lyrics-typing-engine'
import { evaluateKanaInput, evaluateRomaInput, isTypingKey } from 'lyrics-typing-engine'
import { createTypingWordForPage, skipSpaces } from '@/lib/typingEngineAdapter'
import {
  createBeforeFirstPageState,
  createEmptyTypingWord,
  findTargetPageIndexByTime,
  type PageState,
} from '@/lib/typingGameUtils'

type GameStatus = 'playing' | 'completed'

interface GameStats {
  totalTypes: number
  totalMiss: number
  accuracy: number
}

interface UseTypingGameProps {
  scoreEntries: ScoreEntry[]
  builtMapLines: BuiltMapLine[]
  currentVideoTime: number
  onGameEnd?: () => void
  onRestartVideo?: () => void
  onTogglePlayPause?: () => void
  onSkipToNextPage?: () => void
  onPageChange?: (direction: 'prev' | 'next') => void
  isPlaying?: boolean
}

export const useTypingGame = ({
  scoreEntries,
  builtMapLines,
  currentVideoTime,
  onGameEnd,
  onRestartVideo,
  onTogglePlayPause,
  onSkipToNextPage,
  onPageChange,
  isPlaying,
}: UseTypingGameProps) => {
  const [gameStatus, setGameStatus] = useState<GameStatus>('playing')
  const [inputMode, setInputMode] = useState<InputMode>(() => {
    if (typeof window === 'undefined') return 'roma'
    const storedInputMode = localStorage.getItem('typingInputMode')
    return storedInputMode === 'roma' || storedInputMode === 'kana' ? storedInputMode : 'roma'
  })
  const [pageState, setPageState] = useState<PageState>({
    ...createBeforeFirstPageState(),
  })

  const [totalTypes, setTotalTypes] = useState(0)
  const [totalMiss, setTotalMiss] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)

  const correctSoundRef = useRef<HTMLAudioElement | null>(null)
  const missSoundRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const correctSoundPath = withBasePath('/sounds/daken.mp3')
    const missSoundPath = withBasePath('/sounds/miss.mp3')

    correctSoundRef.current = new Audio(correctSoundPath)
    missSoundRef.current = new Audio(missSoundPath)

    if (correctSoundRef.current) {
      correctSoundRef.current.volume = 1
    }
    if (missSoundRef.current) {
      missSoundRef.current.volume = 1
    }
  }, [])

  const initializePage = useCallback(
    (pageIndex: number) => {
      const playablePages = Math.max(0, builtMapLines.length - 1) // 最後のend行は除外
      if (pageIndex >= playablePages) {
        setGameStatus('completed')
        onGameEnd?.()
        return
      }

      const typingWord = skipSpaces(createTypingWordForPage(builtMapLines, pageIndex) ?? createEmptyTypingWord())

      setPageState({
        pageIndex,
        typingWord,
        pageStartTime: currentVideoTime,
        pageLastInputTime: null,
      })
    },
    [builtMapLines, currentVideoTime, onGameEnd]
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
      ...createBeforeFirstPageState(),
    })
    onRestartVideo?.()
  }, [onRestartVideo])

  const setInputModeWithStorage = useCallback((next: InputMode | ((prev: InputMode) => InputMode)) => {
    setInputMode((prev) => {
      const resolved = typeof next === 'function' ? (next as (value: InputMode) => InputMode)(prev) : next
      if (typeof window !== 'undefined') {
        localStorage.setItem('typingInputMode', resolved)
      }
      return resolved
    })
  }, [])

  // 入力モード切り替え（入力状態は保持）
  const toggleInputMode = useCallback(() => {
    setInputModeWithStorage((prev) => (prev === 'roma' ? 'kana' : 'roma'))
  }, [setInputModeWithStorage])

  // 動画の再生位置に応じてページを追従
  useEffect(() => {
    if (
      gameStatus !== 'playing' ||
      scoreEntries.length === 0 ||
      builtMapLines.length === 0
    ) {
      return
    }

    const targetPageIndex = findTargetPageIndexByTime(scoreEntries, currentVideoTime)

    if (targetPageIndex !== pageState.pageIndex && targetPageIndex !== -1) {
      // ページを進めるときに、打ち切り状態ならコンボを切る
      if (targetPageIndex > pageState.pageIndex) {
        const currentTypingWord = pageState.typingWord
        const isIncomplete = !!currentTypingWord.nextChunk.kana || currentTypingWord.wordChunks.length > 0
        if (isIncomplete) {
          setCombo(0)
        }
      }

      initializePage(targetPageIndex)
    }
  }, [
    currentVideoTime,
    gameStatus,
    scoreEntries,
    builtMapLines.length,
    pageState.pageIndex,
    pageState.typingWord,
    initializePage,
  ])

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (gameStatus !== 'playing') return

      const target = event.target as HTMLElement | null
      const tagName = target?.tagName?.toLowerCase()
      if (
        target?.isContentEditable ||
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select'
      ) {
        return
      }

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
        setCombo(0)
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
          !!pageState.typingWord &&
          !pageState.typingWord.nextChunk.kana &&
          pageState.typingWord.wordChunks.length === 0

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
          setCombo(0)
          onPageChange?.('prev')
        }
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        if (isPlaying && pageState.pageIndex < scoreEntries.length - 1) {
          setCombo(0)
          onPageChange?.('next')
        }
        return
      }

      // 1文字キー以外はここでは処理しない（Tab など）
      if (event.key.length !== 1) {
        return
      }

      const currentTypingWord = pageState.typingWord
      const currentEntry = scoreEntries[pageState.pageIndex]
      if (!currentEntry || !currentTypingWord) return

      if (!isTypingKey(event)) return

      const hasRemainingChars =
        !!currentTypingWord.nextChunk.kana || currentTypingWord.wordChunks.length > 0
      if (!hasRemainingChars) return

      event.preventDefault()

      const typingResult =
        inputMode === 'roma'
          ? evaluateRomaInput({ event, typingWord: currentTypingWord })
          : evaluateKanaInput({ event, typingWord: currentTypingWord })

      if (typingResult.successKey) {
        setTotalTypes((prev) => prev + 1)

        if (correctSoundRef.current) {
          correctSoundRef.current.currentTime = 0
          correctSoundRef.current
            .play()
            .catch((e) => console.error('Failed to play correct sound:', e))
        }

        let updatedTypingWord = typingResult.nextTypingWord

        const isSpaceChunk = (chunk: TypingWord['nextChunk']) =>
          chunk.type === 'space' || chunk.kana === ' ' || chunk.kana === '　'

        const isWordCompletedFlag =
          isSpaceChunk(updatedTypingWord.nextChunk) ||
          (!updatedTypingWord.nextChunk.kana && updatedTypingWord.wordChunks.length === 0)

        if (isWordCompletedFlag) {
          setCombo((prev) => {
            const newCombo = prev + 1
            setMaxCombo((max) => Math.max(max, newCombo))
            return newCombo
          })
        }

        updatedTypingWord = skipSpaces(updatedTypingWord)

        const isPageFullyTyped =
          !updatedTypingWord.nextChunk.kana && updatedTypingWord.wordChunks.length === 0

        if (isPageFullyTyped && isPlaying === false && pageState.pageIndex >= 0) {
          initializePage(pageState.pageIndex)
          return
        }

        setPageState((prev) => {
          return {
            ...prev,
            typingWord: updatedTypingWord,
            pageLastInputTime: currentVideoTime,
          }
        })
      } else if (typingResult.failKey) {
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
      initializePage,
      isPlaying,
      pageState.pageIndex,
      pageState.typingWord,
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
