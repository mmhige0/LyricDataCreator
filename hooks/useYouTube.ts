import { useState, useEffect, useRef, useCallback } from 'react'
import { extractVideoId } from '@/lib/youtubeUtils'
import { youtubeErrors, handleError } from '@/lib/errorUtils'
import type { YouTubePlayer } from '@/lib/types'

declare global {
  interface Window {
    YT: {
      Player: new (elementId: string, config: unknown) => YouTubePlayer
      PlayerState: {
        PLAYING: number
      }
    }
    onYouTubeIframeAPIReady: () => void
  }
}

interface UseYouTubeProps {
  onPlayerReady?: (player: YouTubePlayer) => void
  onPlayerStateChange?: (isPlaying: boolean) => void
  onDurationChange?: (duration: number) => void
  /**
   * プレイヤーを埋め込む要素の ID
   * デフォルトは "youtube-player"
   */
  elementId?: string
  /**
   * 初期読み込み時に設定する YouTube URL
   */
  initialYoutubeUrl?: string
  /**
   * 初期URLを自動でロードするか
   */
  autoLoadInitialVideo?: boolean
}

const VOLUME_STORAGE_KEY = 'youtube-player-volume'

const getStoredVolume = (): number => {
  if (typeof window === 'undefined') return 100
  const stored = localStorage.getItem(VOLUME_STORAGE_KEY)
  if (stored) {
    const volume = parseInt(stored, 10)
    return isNaN(volume) ? 100 : Math.max(0, Math.min(100, volume))
  }
  return 100
}

export const useYouTube = ({
  onPlayerReady,
  onPlayerStateChange,
  onDurationChange,
  elementId = 'youtube-player',
  initialYoutubeUrl = '',
  autoLoadInitialVideo = false,
}: UseYouTubeProps = {}) => {
  const [isYouTubeAPIReady, setIsYouTubeAPIReady] = useState<boolean>(false)
  const [youtubeUrl, setYoutubeUrl] = useState<string>(initialYoutubeUrl)
  const [videoId, setVideoId] = useState<string>("")
  const [isLoadingVideo, setIsLoadingVideo] = useState<boolean>(false)
  const [player, setPlayer] = useState<YouTubePlayer | null>(null)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)
  const [videoTitle, setVideoTitle] = useState<string>("")
  const [channelName, setChannelName] = useState<string>("")
  const [playbackRate, setPlaybackRate] = useState<number>(1)
  const [volume, setVolume] = useState<number>(100)
  const [isMuted, setIsMuted] = useState<boolean>(false)
  const hasAutoLoadedInitialVideo = useRef(false)

  useEffect(() => {
    const setupYouTubeAPI = () => {
      if (!window.YT) {
        const tag = document.createElement("script")
        tag.src = "https://www.youtube.com/iframe_api"
        const firstScriptTag = document.getElementsByTagName("script")[0]
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
      }

      window.onYouTubeIframeAPIReady = () => {
        setIsYouTubeAPIReady(true)
      }

      if (window.YT && window.YT.Player) {
        setIsYouTubeAPIReady(true)
      }
    }

    const fallbackTimer = setTimeout(() => {
      if (!window.YT) {
        setIsYouTubeAPIReady(true)
      }
    }, 5000)

    setupYouTubeAPI()

    return () => {
      clearTimeout(fallbackTimer)
    }
  }, [])

  useEffect(() => {
    const storedVolume = getStoredVolume()
    setVolume(storedVolume)
    if (player) {
      player.setVolume(storedVolume)
    }
  }, [player])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (player && isPlaying) {
      interval = setInterval(() => {
        const time = player.getCurrentTime()
        setCurrentTime(time)
      }, 100)
    }
    return () => clearInterval(interval)
  }, [player, isPlaying])

  const resetPlayer = () => {
    if (player) {
      try {
        player.destroy()
      } catch {
        // ignore errors during cleanup
      }
    }

    setPlayer(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setVideoTitle("")
    setChannelName("")
  }

  const updateVideoMetadata = useCallback((currentPlayer: YouTubePlayer | null) => {
    if (!currentPlayer?.getVideoData) return
    const data = currentPlayer.getVideoData()
    setVideoTitle(data?.title ?? "")
    setChannelName(data?.author ?? "")
  }, [])

  const loadYouTubeVideo = useCallback(() => {
    const id = extractVideoId(youtubeUrl)
    if (!id) {
      youtubeErrors.invalidUrl()
      return
    }

    if (!isYouTubeAPIReady && !window.YT) {
      youtubeErrors.apiLoading()
      return
    }

    setIsLoadingVideo(true)
    setVideoId(id)

    if (player) {
      player.loadVideoById(id)
      // 新しい動画の総時間を取得するためのタイマーを設定
      setTimeout(() => {
        const videoDuration = player.getDuration()
        if (videoDuration && videoDuration > 0) {
          setDuration(videoDuration)
          onDurationChange?.(videoDuration)
        }
        updateVideoMetadata(player)
        setIsLoadingVideo(false)
      }, 1000)
    } else {
      setTimeout(() => {
        try {
          const playerDiv = document.getElementById(elementId)
          if (!playerDiv) {
            setIsLoadingVideo(false)
            youtubeErrors.playerNotReady()
            return
          }

          new window.YT.Player(elementId, {
            height: "450",
            width: "800",
            videoId: id,
            playerVars: {
              controls: 0,
              disablekb: 1,
              fs: 0,
              modestbranding: 1,
              rel: 0,
              enablejsapi: 1,
              origin: window.location.origin,
              iv_load_policy: 3,
              autoplay: 0,
              start: 0,
            },
            events: {
              onReady: (event: { target: YouTubePlayer }) => {
                setPlayer(event.target)
                const videoDuration = event.target.getDuration()
                setDuration(videoDuration)
                updateVideoMetadata(event.target)

                // localStorageから保存された音量を適用
                const storedVolume = getStoredVolume()
                event.target.setVolume(storedVolume)

                // ミュート状態を取得
                const initialMuted = event.target.isMuted()
                setIsMuted(initialMuted)

                setIsLoadingVideo(false)
                onPlayerReady?.(event.target)
                onDurationChange?.(videoDuration)
              },
              onStateChange: (event: { data: number }) => {
                const playing = event.data === window.YT.PlayerState.PLAYING
                setIsPlaying(playing)
                onPlayerStateChange?.(playing)
              },
              onError: () => {
                setIsLoadingVideo(false)
                youtubeErrors.videoLoadError()
              },
            },
          })
        } catch (error) {
          setIsLoadingVideo(false)
          handleError(error, 'YouTube Player Creation')
          youtubeErrors.playerCreationError()
        }
      }, 100)
    }
  }, [
    elementId,
    isYouTubeAPIReady,
    onDurationChange,
    onPlayerReady,
    onPlayerStateChange,
    player,
    updateVideoMetadata,
    youtubeUrl,
  ])

  useEffect(() => {
    if (!autoLoadInitialVideo) return
    if (hasAutoLoadedInitialVideo.current) return
    if (!isYouTubeAPIReady) return
    if (!youtubeUrl) return

    hasAutoLoadedInitialVideo.current = true
    loadYouTubeVideo()
  }, [autoLoadInitialVideo, isYouTubeAPIReady, loadYouTubeVideo, youtubeUrl])

  const togglePlayPause = () => {
    if (player) {
      if (isPlaying) {
        player.pauseVideo()
      } else {
        player.playVideo()
      }
    }
  }

  // Helper function for time boundary calculation
  const clampTime = (time: number) => Math.max(0, Math.min(duration, time))

  // Base seek function
  const seekTo = (time: number) => {
    if (player) {
      const clampedTime = clampTime(time)
      player.seekTo(clampedTime, true)
      setCurrentTime(clampedTime)
    }
  }

  // Generic relative seek function
  const seekRelative = (seconds: number) => {
    if (player) {
      const currentTime = player.getCurrentTime()
      seekTo(currentTime + seconds)
    }
  }

  const seekBackward = () => seekRelative(-5)
  const seekForward = () => seekRelative(5)
  const seekBackward1Second = () => seekRelative(-1)
  const seekForward1Second = () => seekRelative(1)
  const seekToBeginning = () => seekTo(0)

  const changePlaybackRate = (rate: number) => {
    if (player) {
      player.setPlaybackRate(rate)
      setPlaybackRate(rate)
    }
  }

  const setPlayerVolume = (newVolume: number) => {
    if (player) {
      const clampedVolume = Math.max(0, Math.min(100, newVolume))
      player.setVolume(clampedVolume)
      setVolume(clampedVolume)
      localStorage.setItem(VOLUME_STORAGE_KEY, clampedVolume.toString())
      if (clampedVolume > 0 && isMuted) {
        setIsMuted(false)
      }
    }
  }

  const adjustVolume = (delta: number) => {
    setPlayerVolume(volume + delta)
  }

  const toggleMute = () => {
    if (player) {
      if (isMuted) {
        player.unMute()
        setIsMuted(false)
      } else {
        player.mute()
        setIsMuted(true)
      }
    }
  }

  const getCurrentTimestamp = (offset: number = 0) => {
    if (player) {
      const currentTime = player.getCurrentTime()
      const adjustedTime = Math.max(0, Math.min(duration, currentTime + offset))
      return adjustedTime.toFixed(2)
    }
    return "0.00"
  }

  const seekToInput = (inputValue: string) => {
    if (inputValue && player) {
      const time = parseFloat(inputValue)
      if (!isNaN(time)) {
        seekToAndPlay(time)
      }
    }
  }

  const seekToAndPlay = (time: number) => {
    if (player) {
      seekTo(time)
      player.playVideo()
    }
  }

  return {
    isYouTubeAPIReady,
    youtubeUrl,
    setYoutubeUrl,
    videoId,
    isLoadingVideo,
    loadYouTubeVideo,
    player,
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    videoTitle,
    channelName,
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
  }
}
