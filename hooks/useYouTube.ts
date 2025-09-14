import { useState, useEffect } from 'react'
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
}

export const useYouTube = ({ onPlayerReady, onPlayerStateChange, onDurationChange }: UseYouTubeProps = {}) => {
  const [isYouTubeAPIReady, setIsYouTubeAPIReady] = useState<boolean>(false)
  const [youtubeUrl, setYoutubeUrl] = useState<string>("")
  const [videoId, setVideoId] = useState<string>("")
  const [isLoadingVideo, setIsLoadingVideo] = useState<boolean>(false)
  const [player, setPlayer] = useState<YouTubePlayer | null>(null)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [duration, setDuration] = useState<number>(0)
  const [playbackRate, setPlaybackRate] = useState<number>(1)

  useEffect(() => {
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

    const fallbackTimer = setTimeout(() => {
      if (!window.YT) {
        setIsYouTubeAPIReady(true)
      }
    }, 5000)

    return () => {
      clearTimeout(fallbackTimer)
    }
  }, [])

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

  const loadYouTubeVideo = () => {
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
      setIsLoadingVideo(false)
    } else {
      setTimeout(() => {
        try {
          const playerDiv = document.getElementById("youtube-player")
          if (!playerDiv) {
            setIsLoadingVideo(false)
            youtubeErrors.playerNotReady()
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
                const videoDuration = event.target.getDuration()
                setDuration(videoDuration)
                setIsLoadingVideo(false)
                onPlayerReady?.(event.target)
                onDurationChange?.(videoDuration)
              },
              onStateChange: (event: { data: number }) => {
                const playing = event.data === window.YT.PlayerState.PLAYING
                setIsPlaying(playing)
                onPlayerStateChange?.(playing)
              },
              onError: (event: { data: number }) => {
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
  }

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

  const getCurrentTimestamp = (offset: number = 0) => {
    if (player) {
      const currentTime = player.getCurrentTime()
      const adjustedTime = Math.max(0, Math.min(duration, currentTime + offset))
      return adjustedTime.toFixed(2)
    }
    return "0.00"
  }

  const seekToInput = (inputValue: string) => {
    if (inputValue) {
      const time = parseFloat(inputValue)
      if (!isNaN(time)) {
        seekTo(time)
      }
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
  }
}

export const useYouTubeAPI = () => {
  const { isYouTubeAPIReady } = useYouTube()
  return { isYouTubeAPIReady }
}

export const useYouTubePlayer = ({ player, duration }: { player: YouTubePlayer | null, duration: number }) => {
  const youtubeHook = useYouTube()
  
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (player && youtubeHook.isPlaying) {
      interval = setInterval(() => {
        const time = player.getCurrentTime()
        youtubeHook.setCurrentTime(time)
      }, 100)
    }
    return () => clearInterval(interval)
  }, [player, youtubeHook.isPlaying, youtubeHook.setCurrentTime])
  
  return {
    isPlaying: youtubeHook.isPlaying,
    setIsPlaying: youtubeHook.setIsPlaying,
    currentTime: youtubeHook.currentTime,
    setCurrentTime: youtubeHook.setCurrentTime,
    playbackRate: youtubeHook.playbackRate,
    togglePlayPause: youtubeHook.togglePlayPause,
    seekBackward: youtubeHook.seekBackward,
    seekForward: youtubeHook.seekForward,
    seekBackward1Second: youtubeHook.seekBackward1Second,
    seekForward1Second: youtubeHook.seekForward1Second,
    seekToBeginning: youtubeHook.seekToBeginning,
    changePlaybackRate: youtubeHook.changePlaybackRate,
    seekTo: youtubeHook.seekTo,
    getCurrentTimestamp: youtubeHook.getCurrentTimestamp
  }
}

export const useYouTubeVideo = ({ isYouTubeAPIReady, setPlayer, setDuration, setIsPlaying }: {
  isYouTubeAPIReady: boolean
  setPlayer: (player: YouTubePlayer | null) => void
  setDuration: (duration: number) => void
  setIsPlaying: (isPlaying: boolean) => void
}) => {
  const youtubeHook = useYouTube({
    onPlayerReady: setPlayer,
    onPlayerStateChange: setIsPlaying,
    onDurationChange: setDuration
  })
  
  return {
    youtubeUrl: youtubeHook.youtubeUrl,
    setYoutubeUrl: youtubeHook.setYoutubeUrl,
    videoId: youtubeHook.videoId,
    player: youtubeHook.player,
    isLoadingVideo: youtubeHook.isLoadingVideo,
    loadYouTubeVideo: youtubeHook.loadYouTubeVideo
  }
}