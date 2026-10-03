import type { TextAlign } from './types'

export const defaultDecorationAligns = (): [TextAlign, TextAlign, TextAlign, TextAlign] => ['l', 'l', 'l', 'l']

export function parseDecorationField(value: string): { text: string; decorated: boolean; align: TextAlign } {
  if (value === '!') return { text: '', decorated: false, align: 'l' }
  if (!value.startsWith('!')) return { text: value, decorated: false, align: 'l' }
  const match = value.match(/^!\[([lcr])\]([\s\S]*)$/)
  if (!match) throw new Error('装飾行は![l]／![c]／![r]で寄せを指定してください。')
  return { text: match[2], decorated: true, align: match[1] as TextAlign }
}

export function formatDecorationField(text: string, align: TextAlign = 'l'): string {
  if (!['l', 'c', 'r'].includes(align)) throw new Error('装飾行の寄せが不正です。')
  return `![${align}]${text}`
}
