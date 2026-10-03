import { decorationLength, normalizeDecoration, validateDecorationCharacters } from './decorationText'

export const POP_TEXT_LIMIT = 10

export const normalizePopText = (text: string) => normalizeDecoration(text, POP_TEXT_LIMIT)

export function validatePopText(text: string): void {
  validateDecorationCharacters(text)
  if (decorationLength(text) > POP_TEXT_LIMIT) throw new Error('ポップ文字列は全角10文字（半角20文字）以内にしてください。')
}
