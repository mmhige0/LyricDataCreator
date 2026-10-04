import { characterWidth, decorationLength, normalizeDecoration, validateDecorationCharacters } from './decorationText'

export const POP_TEXT_LIMIT = 10
export const POP_MAX_LINES = 2

export function normalizePopText(text: string): string {
  const lines = text.replace(/\r\n|\r|\u2028|\u2029/g, '\n').split('\n').slice(0, POP_MAX_LINES)
  const clean = lines.map(line => normalizeDecoration(line, Infinity)).join('\n')
  let width = 0
  let result = ''
  for (const char of clean) {
    if (char !== '\n') width += characterWidth(char)
    if (width > POP_TEXT_LIMIT) break
    result += char
  }
  return result
}

export function validatePopCharacters(text: string): void {
  text.split('\n').forEach(validateDecorationCharacters)
  if (text.split('\n').length > POP_MAX_LINES) throw new Error('ポップは最大2行にしてください。')
}

export function validatePopText(text: string): void {
  validatePopCharacters(text)
  if (decorationLength(text.replace(/\n/g, '')) > POP_TEXT_LIMIT) throw new Error('ポップ文字列は改行を除いて全角10文字（半角20文字）以内にしてください。')
}
