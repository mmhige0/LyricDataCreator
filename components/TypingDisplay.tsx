import type { TypingWord } from 'lyrics-typing-engine'
import { LyricsText } from '@/components/LyricsText'
import { normalizeTypingDisplay } from '@/lib/textUtils'
import type { TextAlign } from '@/lib/types'

const alignment = (align?: TextAlign) => align === 'c' ? 'center' : align === 'r' ? 'right' : 'left'

interface TypingDisplayProps {
  lines: string[]
  typingWord: TypingWord | null
  targetLineIndexes?: number[]
  overlayText?: string
  overlayLines?: string[]
  hideBaseLines?: boolean
  lineAligns?: TextAlign[]
  overlayLineAligns?: TextAlign[]
  decorations?: boolean[]
  overlayDecorations?: boolean[]
}

export const TypingDisplay = ({
  lines,
  typingWord,
  targetLineIndexes,
  overlayText,
  overlayLines,
  hideBaseLines = false,
  lineAligns,
  overlayLineAligns,
  decorations,
  overlayDecorations,
}: TypingDisplayProps) => {
  const typedKanaLength = typingWord?.correct.kana.length ?? 0
  const effectiveTargetLineIndexes = targetLineIndexes ?? lines
    .map((line, lineIndex) => !decorations?.[lineIndex] && normalizeTypingDisplay(line).trim().length > 0 ? lineIndex : -1)
    .filter((lineIndex) => lineIndex >= 0)
  const targetLineIndexSet = new Set(effectiveTargetLineIndexes)
  const targetLines = effectiveTargetLineIndexes.map((lineIndex) => normalizeTypingDisplay(lines[lineIndex] ?? ''))
  const joinedTargetLines = targetLines.join(' ')
  const leadingWhitespaceLength = joinedTargetLines.length - joinedTargetLines.trimStart().length
  const trailingWhitespaceLength = joinedTargetLines.length - joinedTargetLines.trimEnd().length
  const trimmedLength = Math.max(0, joinedTargetLines.length - leadingWhitespaceLength - trailingWhitespaceLength)
  const hasTypedAll = trimmedLength === 0 ? true : typedKanaLength >= trimmedLength
  const adjustedTypedLength = Math.min(
    typedKanaLength + leadingWhitespaceLength + (hasTypedAll ? trailingWhitespaceLength : 0),
    joinedTargetLines.length
  )
  const clampedTypedLength = adjustedTypedLength

  let targetCursor = 0
  const shouldShowOverlayLines = hideBaseLines && overlayLines && overlayLines.length > 0

  return (
    <div className="relative text-left py-8 px-6 bg-secondary rounded-lg h-64 flex flex-col justify-start select-none overflow-hidden">
      {shouldShowOverlayLines
        ? overlayLines!.map((line, lineIndex) => (
          <p
            key={lineIndex}
            className="text-3xl font-bold tracking-wider leading-tight h-12 mb-2 whitespace-pre text-muted-foreground/60"
            style={{ textAlign: alignment(overlayLineAligns?.[lineIndex]) }}
          >
            <LyricsText text={line || '\u00A0'} decorated={overlayDecorations?.[lineIndex]} />
          </p>
        ))
        : lines.map((line, lineIndex) => {
          const isTargetLine = targetLineIndexSet.has(lineIndex)
          const lineStart = targetCursor
          const chars = Array.from(line)
          const lineEnd = targetCursor + chars.length
          const typedWithinLine = Math.max(0, Math.min(clampedTypedLength - lineStart, chars.length))

          const isCompletedLine = isTargetLine && clampedTypedLength > lineEnd
          const isCurrentLine = isTargetLine && clampedTypedLength >= lineStart && clampedTypedLength <= lineEnd

          if (isTargetLine) {
            targetCursor = lineEnd + 1 // 次の対象行の先頭（行間スペース1文字分を想定）
          }

          const typedPart = chars.slice(0, typedWithinLine).join('')
          const remainingPart = chars.slice(typedWithinLine).join('')

          return (
            <p
              key={lineIndex}
              className="text-3xl font-bold tracking-wider leading-tight h-12 mb-2 whitespace-pre"
              style={{ textAlign: alignment(lineAligns?.[lineIndex]) }}
            >
              {!isTargetLine ? (
                <span className="text-muted-foreground/40"><LyricsText text={line || '\u00A0'} decorated={decorations?.[lineIndex]} /></span>
              ) : isCompletedLine ? (
                <span className="text-muted-foreground/60"><LyricsText text={line || '\u00A0'} decorated={decorations?.[lineIndex]} /></span>
              ) : isCurrentLine ? (
                <>
                  {typedPart && <span className="text-muted-foreground/60"><LyricsText text={typedPart} /></span>}
                  <span className="text-primary"><LyricsText text={remainingPart || '\u00A0'} /></span>
                </>
              ) : (
                <span className="text-foreground"><LyricsText text={line || '\u00A0'} decorated={decorations?.[lineIndex]} /></span>
              )}
            </p>
          )
        })}
      {overlayText && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/80 text-foreground text-2xl font-semibold rounded-lg">
          {overlayText}
        </div>
      )}
    </div>
  )
}
