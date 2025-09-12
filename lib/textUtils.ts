import type { LyricsArray } from './types'

/**
 * 半角文字を全角文字に変換する
 */
export const halfWidthToFullWidth = (text: string): string => {
  return text
    .replace(/[a-z]/g, (char) => String.fromCharCode(char.charCodeAt(0) - "a".charCodeAt(0) + "ａ".charCodeAt(0)))
    .replace(/[A-Z]/g, (char) => String.fromCharCode(char.charCodeAt(0) - "A".charCodeAt(0) + "Ａ".charCodeAt(0)))
    .replace(/ /g, "　")
}

/**
 * 全ての歌詞行を全角に変換する
 */
export const convertAllLyricsToFullWidth = (
  lyrics: LyricsArray,
  setLyrics: (lyrics: LyricsArray) => void
): void => {
  const newLyrics = lyrics.map(line => halfWidthToFullWidth(line)) as LyricsArray
  setLyrics(newLyrics)
}