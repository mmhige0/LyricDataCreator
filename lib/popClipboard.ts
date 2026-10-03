import type { CentralPop } from './types'
import { normalizePopText } from './popText'

export type PopContent = Omit<CentralPop, 'id' | 'timestamp'>

export function popContent(pop: CentralPop): PopContent {
  return { text: pop.text, duration: pop.duration, align: pop.align, size: pop.size, color: pop.color }
}

export function serializePopClipboard(pop: CentralPop): string {
  return JSON.stringify({ type: 'lyric-pop', ...popContent(pop) })
}

export function parsePopClipboard(text: string): PopContent {
  const value = JSON.parse(text)
  if (!value || value.type !== 'lyric-pop' || typeof value.text !== 'string'
    || !['s', 'm', 'l', 'x'].includes(value.duration) || !['l', 'c', 'r'].includes(value.align)
    || !['s', 'm', 'l'].includes(value.size) || typeof value.color !== 'string'
    || !/^#[0-9a-f]{6}$/i.test(value.color)) throw new Error('ポップをコピーしたデータを貼り付けてください。')
  return { text: normalizePopText(value.text), duration: value.duration, align: value.align, size: value.size, color: value.color.toUpperCase() }
}
