export interface ScoreEntry {
  id: string
  timestamp: number
  lyrics: [string, string, string, string]
}

export interface YouTubePlayer {
  pauseVideo(): void
  playVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getDuration(): number
  setPlaybackRate(suggestedRate: number): void
  loadVideoById(videoId: string): void
  getPlayerState(): number
  // Volume control methods
  getVolume(): number
  setVolume(volume: number): void
  mute(): void
  unMute(): void
  isMuted(): boolean
}

export type LyricsArray = [string, string, string, string]