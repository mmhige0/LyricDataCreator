import { preprocessAndConvertLyrics } from './textUtils'

const containsKanji = (text: string): boolean => /[\u4e00-\u9faf]/.test(text)

const requestHiraganaConversion = async (lines: string[]): Promise<string[]> => {
  const response = await fetch('/api/hiragana', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ lines }),
  })

  let payload: { lines?: string[]; error?: string } | null = null
  try {
    payload = await response.json()
  } catch (error) {
    console.error('Failed to parse hiragana API response', error)
  }

  if (!response.ok) {
    const message = payload?.error ?? 'ひらがな変換に失敗しました'
    throw new Error(message)
  }

  if (!payload?.lines || !Array.isArray(payload.lines)) {
    throw new Error('ひらがな変換の結果が不正です')
  }

  if (payload.lines.length !== lines.length) {
    throw new Error('ひらがな変換の結果に不足があります')
  }

  return payload.lines
}

/**
 * 漢字を含むテキストをひらがなに変換する（漢字変換のみ）
 * 注意: カタカナ変換や記号削除などの前処理は呼び出し側で行う
 * @param text 変換対象のテキスト（前処理済み）
 * @returns ひらがなに変換されたテキスト
 */
export const convertKanjiToHiragana = async (text: string): Promise<string> => {
  if (!text || text.trim() === '') return text
  if (!containsKanji(text)) return text

  const [converted] = await requestHiraganaConversion([text])
  return converted ?? text
}

/**
 * 歌詞配列の各行を一括でひらがなに変換（前処理付き）
 */
export const convertLyricsArrayToHiragana = async (
  lyrics: [string, string, string, string]
): Promise<[string, string, string, string]> => {
  const preprocessedLines = lyrics.map(line => {
    if (line.trim() === '') return ''
    return preprocessAndConvertLyrics(line)
  })

  if (preprocessedLines.every(line => line === '' || !containsKanji(line))) {
    return preprocessedLines as [string, string, string, string]
  }

  const convertedLines = await requestHiraganaConversion(preprocessedLines)
  return convertedLines as [string, string, string, string]
}
