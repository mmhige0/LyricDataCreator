// Count the displayed text, before file escaping or adding a decoration marker.
const forbidden = /[\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u200D\uFE0F\u20E3\r\n\u2028\u2029]/gu
const keycaps = /[#*0-9]\uFE0F?\u20E3/gu

export function characterWidth(char: string): number {
  const code = char.codePointAt(0) ?? 0
  return code <= 0x7f || (code >= 0xff61 && code <= 0xffdc) || (code >= 0xffe8 && code <= 0xffee) ? 0.5 : 1
}

export function decorationLength(text: string): number {
  return Array.from(text).reduce((sum, char) => sum + characterWidth(char), 0)
}

export function normalizeDecoration(text: string, limit = 25): string {
  const clean = text.replace(keycaps, '').replace(forbidden, '')
  let width = 0
  let result = ''
  for (const char of clean) {
    width += characterWidth(char)
    if (width > limit) break
    result += char
  }
  return result
}

export function validateDecorationCharacters(text: string): void {
  if (text.replace(keycaps, '').replace(forbidden, '') !== text) {
    throw new Error('装飾文字列には絵文字・改行を使用できません。')
  }
}

export function validateDecoration(text: string): void {
  validateDecorationCharacters(text)
  if (decorationLength(text) > 25) throw new Error('装飾文字列は全角25文字（半角50文字）以内にしてください。')
}
