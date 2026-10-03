import { isTypingCharacter } from '@/lib/textUtils'

/** Keep display-only characters visible, with a separate color from typing targets. */
export function LyricsText({ text, decorated = false }: { text: string; decorated?: boolean }) {
  if (decorated) return <>{text}</>
  return <>{Array.from(text).map((char, index) => isTypingCharacter(char) || /\s/u.test(char)
    ? char
    : <span key={index} className="text-muted-foreground" data-display-only>{char}</span>)}</>
}
