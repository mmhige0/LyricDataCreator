import { useState, useEffect } from 'react'
import { extractVideoId } from '@/lib/youtubeUtils'
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

/**
 * YouTube IFrame API の初期化を管理するフック
 */
export const useYouTubeAPI = () => {
  const [isYouTubeAPIReady, setIsYouTubeAPIReady] = useState<boolean>(false)

  useEffect(() => {
    // Load YouTube IFrame API
    if (!window.YT) {
      const tag = document.createElement("script")
      tag.src = "https://www.youtube.com/iframe_api"
      const firstScriptTag = document.getElementsByTagName("script")[0]
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag)
    }

    // Set up the callback function
    ;(window as any).onYouTubeIframeAPIReady = () => {
      setIsYouTubeAPIReady(true)
    }

    // Check if API is already loaded
    if (window.YT && window.YT.Player) {
      setIsYouTubeAPIReady(true)
    }

    // Fallback: Set a timeout to enable the button after a few seconds
    const fallbackTimer = setTimeout(() => {
      if (!window.YT) {
        setIsYouTubeAPIReady(true) // Enable button even if API fails to load
      }
    }, 5000)

    return () => {
      clearTimeout(fallbackTimer)
    }
  }, [])

  return {
    isYouTubeAPIReady
  }
}

interface UseYouTubePlayerProps {
  player: YouTubePlayer | null
  duration: number
}

/**
 * YouTube プレイヤーの再生制御を管理するフック
 */
export const useYouTubePlayer = ({ player, duration }: UseYouTubePlayerProps) => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [playbackRate, setPlaybackRate] = useState<number>(1)

  // Update current time when playing
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

  const togglePlayPause = () => {
    if (player) {
      if (isPlaying) {
        player.pauseVideo()
      } else {
        player.playVideo()
      }
    }
  }

  const seekBackward = () => {
    if (player) {
      const currentTime = player.getCurrentTime()
      const newTime = Math.max(0, currentTime - 5)
      player.seekTo(newTime, true)
      setCurrentTime(newTime)
    }
  }

  const seekForward = () => {
    if (player) {
      const currentTime = player.getCurrentTime()
      const newTime = Math.min(duration, currentTime + 5)
      player.seekTo(newTime, true)
      setCurrentTime(newTime)
    }
  }

  const seekBackward1Second = () => {
    if (player) {
      const currentTime = player.getCurrentTime()
      const newTime = Math.max(0, currentTime - 1)
      player.seekTo(newTime, true)
      setCurrentTime(newTime)
    }
  }

  const seekForward1Second = () => {
    if (player) {
      const currentTime = player.getCurrentTime()
      const newTime = Math.min(duration, currentTime + 1)
      player.seekTo(newTime, true)
      setCurrentTime(newTime)
    }
  }

  const changePlaybackRate = (rate: number) => {
    if (player) {
      player.setPlaybackRate(rate)
      setPlaybackRate(rate)
    }
  }

  const seekTo = (time: number) => {
    if (player) {
      player.seekTo(time, true)
    }
  }

  const getCurrentTimestamp = () => {
    if (player) {
      const currentTime = player.getCurrentTime()
      return currentTime.toFixed(2)
    }
    return "0.00"
  }

  return {
    isPlaying,
    setIsPlaying,
    currentTime,
    setCurrentTime,
    playbackRate,
    togglePlayPause,
    seekBackward,
    seekForward,
    seekBackward1Second,
    seekForward1Second,
    changePlaybackRate,
    seekTo,
    getCurrentTimestamp
  }
}

interface UseYouTubeVideoProps {
  isYouTubeAPIReady: boolean
  setPlayer: (player: YouTubePlayer | null) => void
  setDuration: (duration: number) => void
  setIsPlaying: (isPlaying: boolean) => void
}

/**
 * YouTube 動画の読み込みを管理するフック
 */
export const useYouTubeVideo = ({ 
  isYouTubeAPIReady, 
  setPlayer, 
  setDuration, 
  setIsPlaying 
}: UseYouTubeVideoProps) => {
  const [youtubeUrl, setYoutubeUrl] = useState<string>("")
  const [videoId, setVideoId] = useState<string>("")
  const [player, setPlayerState] = useState<YouTubePlayer | null>(null)
  const [isLoadingVideo, setIsLoadingVideo] = useState<boolean>(false)

  const loadYouTubeVideo = () => {
    const id = extractVideoId(youtubeUrl)
    if (!id) {
      alert("有効なYouTube URLを入力してください")
      return
    }

    // Try to load video even if API status is uncertain
    if (!isYouTubeAPIReady && !window.YT) {
      alert("YouTube APIの読み込み中です。しばらく待ってから再試行してください。")
      return
    }

    setIsLoadingVideo(true)
    setVideoId(id)

    if (player) {
      player.loadVideoById(id)
      setIsLoadingVideo(false)
    } else {
      setTimeout(() => {
        try {
          const playerDiv = document.getElementById("youtube-player")
          if (!playerDiv) {
            setIsLoadingVideo(false)
            alert("プレイヤーの準備ができていません。もう一度お試しください。")
            return
          }

          const newPlayer = new window.YT.Player("youtube-player", {
            height: "450",
            width: "800",
            videoId: id,
            playerVars: {
              controls: 0,
              disablekb: 1,
              fs: 0,
              modestbranding: 1,
              rel: 0,
            },
            events: {
              onReady: (event: { target: YouTubePlayer }) => {
                setPlayer(event.target)
                setPlayerState(event.target)
                setDuration(event.target.getDuration())
                setIsLoadingVideo(false)
              },
              onStateChange: (event: { data: number }) => {
                setIsPlaying(event.data === window.YT.PlayerState.PLAYING)
              },
              onError: (event: { data: number }) => {
                setIsLoadingVideo(false)
                alert("動画の読み込みでエラーが発生しました。URLを確認してください。")
              },
            },
          })
        } catch (error) {
          setIsLoadingVideo(false)
          alert("プレイヤーの作成でエラーが発生しました。")
        }
      }, 100)
    }
  }

  return {
    youtubeUrl,
    setYoutubeUrl,
    videoId,
    player,
    isLoadingVideo,
    loadYouTubeVideo
  }
}