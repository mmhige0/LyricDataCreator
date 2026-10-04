import type { CentralPop, LyricsArray, ScoreEntry } from './types'
import { normalizeDecoration, validateDecoration, validateDecorationCharacters } from './decorationText'
import { preprocessAndConvertLyrics } from './textUtils'
import { POP_TEXT_LIMIT, normalizePopText, validatePopCharacters, validatePopText } from './popText'
import { formatDecorationField, parseDecorationField } from './decorationFormat'

export const POP_DEFAULTS = { duration: 'm', align: 'c', size: 'm', color: '#FFFFFF' } as const
export const POP_DURATIONS = { s: 0.1, m: 0.3, l: 0.5, x: 1 } as const

export const escapeScoreText = (text: string) => text.replace(/\\/g, '\\\\').replace(/\//g, '\\/')

export function splitScoreFields(line: string, allowPopNewlines = false): string[] {
  const fields = ['']
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '\\') {
      const next = line[++i]
      if (next === 'n' && allowPopNewlines && fields.length === 1) { fields[0] += '\n'; continue }
      if (next !== '/' && next !== '\\') throw new Error('エスケープはスラッシュまたはバックスラッシュに使用してください。')
      fields[fields.length - 1] += next
    } else if (char === '/') fields.push('')
    else fields[fields.length - 1] += char
  }
  return fields
}

const parseTime = (value: string, label = '時刻'): number => {
  if (!/^\d+(?:\.\d+)?$/.test(value.trim())) throw new Error(`${label}は0以上の秒数で指定してください。`)
  const time = Number(value)
  if (!Number.isFinite(time)) throw new Error(`${label}が不正です。`)
  return time
}

export function validatePop(pop: CentralPop): void {
  validatePopText(pop.text)
  if (!Number.isFinite(pop.timestamp) || pop.timestamp < 0) throw new Error('表示開始時刻は0以上の秒数で指定してください。')
  if (!['s', 'm', 'l', 'x'].includes(pop.duration)) throw new Error('表示時間が不正です。')
  if (!['l', 'c', 'r'].includes(pop.align)) throw new Error('寄せが不正です。')
  if (!['s', 'm', 'l'].includes(pop.size)) throw new Error('サイズが不正です。')
  if (!/^#[\da-f]{6}$/i.test(pop.color)) throw new Error('色は#RRGGBB形式で指定してください。')
}

export function parseScoreTxt(content: string): { duration: number; scoreEntries: ScoreEntry[]; centralPops: CentralPop[]; warnings: string[] } {
  const lines = content.replace(/^\uFEFF/, '').split(/\r\n|\n|\r/)
  const duration = parseTime(lines[0] ?? '', '1行目の総時間')
  const scoreEntries: ScoreEntry[] = []
  const centralPops: CentralPop[] = []
  const warnings: string[] = []
  let inPops = false
  let ended = false
  const decoratedText = (text: string, line: number, limit = 25, label = '装飾') => {
    const normalized = normalizeDecoration(text, limit)
    // Overlength may be truncated; forbidden characters remain an import error.
    validateDecorationCharacters(text)
    if (normalized !== text) warnings.push(`${line}行目: ${label}文字列を${limit}文字以内に切り取りました。`)
    return normalized
  }
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    try {
      if (line.trim() === '_') {
        if (inPops) throw new Error('区切り行が重複しています。')
        inPops = true
        continue
      }
      const fields = splitScoreFields(line, inPops)
      if (inPops) {
        if (fields.length !== 2 && fields.length !== 6) throw new Error('ポップは2項目または6項目で指定してください。')
        validatePopCharacters(fields[0])
        const popText = normalizePopText(fields[0])
        if (popText !== fields[0]) warnings.push(`${i + 1}行目: ポップ文字列を${POP_TEXT_LIMIT}文字以内に切り取りました。`)
        const pop: CentralPop = {
          id: `pop_${crypto.randomUUID()}`,
          text: popText,
          timestamp: parseTime(fields[1]),
          ...POP_DEFAULTS,
        }
        if (fields.length === 6) {
          pop.duration = fields[2] as CentralPop['duration']
          pop.align = fields[3] as CentralPop['align']
          pop.size = fields[4] as CentralPop['size']
          pop.color = fields[5].toUpperCase()
        }
        validatePop(pop)
        centralPops.push(pop)
      } else {
        if (fields.length !== 5) throw new Error('歌詞ページは4行と時刻の5項目で指定してください。')
        const timestamp = parseTime(fields[4])
        if (timestamp === 999.9 && fields.slice(0, 4).every(value => value === '!')) { ended = true; continue }
        if (ended) throw new Error('終端行の後にはポップの区切り行が必要です。')
        const parsed = fields.slice(0, 4).map(parseDecorationField)
        const decorations = parsed.map(value => value.decorated) as NonNullable<ScoreEntry['decorations']>
        const decorationAligns = parsed.map(value => value.align) as NonNullable<ScoreEntry['decorationAligns']>
        const lyrics = parsed.map(value => value.decorated ? decoratedText(value.text, i + 1) : preprocessAndConvertLyrics(value.text)) as LyricsArray
        scoreEntries.push({ id: `entry_${crypto.randomUUID()}`, timestamp, lyrics, ...(decorations.some(Boolean) ? { decorations, decorationAligns } : {}) })
      }
    } catch (error) {
      throw new Error(`${i + 1}行目: ${error instanceof Error ? error.message : '不正なデータです。'}`)
    }
  }
  return { duration, scoreEntries: scoreEntries.sort((a, b) => a.timestamp - b.timestamp), centralPops: centralPops.sort((a, b) => a.timestamp - b.timestamp), warnings }
}

export function createScoreTxt(duration: number, entries: ScoreEntry[], pops: CentralPop[]): string {
  if (!Number.isFinite(duration) || duration < 0) throw new Error('動画の総時間が不正です。')
  const lines = [duration.toFixed(1)]
  for (const entry of [...entries].sort((a, b) => a.timestamp - b.timestamp)) {
    if (!Number.isFinite(entry.timestamp) || entry.timestamp < 0 || entry.timestamp === 999.9) throw new Error('歌詞の時刻が不正です（999.9は終端行専用）。')
    const fields = entry.lyrics.map((text, index) => {
      if (entry.decorations?.[index]) {
        validateDecoration(text)
        return formatDecorationField(escapeScoreText(text), entry.decorationAligns?.[index] ?? 'l')
      }
      return escapeScoreText(preprocessAndConvertLyrics(text)) || '!'
    })
    lines.push([...fields, entry.timestamp.toFixed(2)].join('/'))
  }
  lines.push('!/!/!/!/999.9')
  if (pops.length) lines.push('_')
  for (const pop of [...pops].sort((a, b) => a.timestamp - b.timestamp)) {
    validatePop(pop)
    const fields = [escapeScoreText(pop.text).replace(/\n/g, '\\n'), pop.timestamp.toFixed(2)]
    if (pop.duration !== 'm' || pop.align !== 'c' || pop.size !== 'm' || pop.color.toUpperCase() !== '#FFFFFF') {
      fields.push(pop.duration, pop.align, pop.size, pop.color.toUpperCase())
    }
    lines.push(fields.join('/'))
  }
  return `${lines.join('\n')}\n`
}
