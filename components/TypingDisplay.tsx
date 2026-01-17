import type { TypingWord } from 'lyrics-typing-engine'

interface TypingDisplayProps {
  lines: string[]
  typingWord: TypingWord | null
  overlayText?: string
  overlayLines?: string[]
  hideBaseLines?: boolean
}

export const TypingDisplay = ({
  lines,
  typingWord,
  overlayText,
  overlayLines,
  hideBaseLines = false,
}: TypingDisplayProps) => {
  const typedKanaLength = typingWord?.correct.kana.length ?? 0
  const joinedLines = lines.join(' ')
  const leadingWhitespaceLength = joinedLines.length - joinedLines.trimStart().length
  const trailingWhitespaceLength = joinedLines.length - joinedLines.trimEnd().length
  const trimmedLength = Math.max(0, joinedLines.length - leadingWhitespaceLength - trailingWhitespaceLength)
  const hasTypedAll = trimmedLength === 0 ? true : typedKanaLength >= trimmedLength
  const adjustedTypedLength = Math.min(
    typedKanaLength + leadingWhitespaceLength + (hasTypedAll ? trailingWhitespaceLength : 0),
    joinedLines.length
  )
  const clampedTypedLength = adjustedTypedLength

  let cursor = 0
  const shouldShowOverlayLines = hideBaseLines && overlayLines && overlayLines.length > 0

  return (
    <div className="relative text-left py-8 px-6 bg-secondary rounded-lg h-64 flex flex-col justify-start select-none overflow-hidden">
      {shouldShowOverlayLines
        ? overlayLines!.map((line, lineIndex) => (
          <p
            key={lineIndex}
            className="text-3xl font-bold tracking-wider leading-tight h-12 mb-2 text-muted-foreground/60"
          >
            {line || '\u00A0'}
          </p>
        ))
        : lines.map((line, lineIndex) => {
          const lineStart = cursor
          const lineEnd = cursor + line.length
          const typedWithinLine = Math.max(0, Math.min(clampedTypedLength - lineStart, line.length))

          const isCompletedLine = clampedTypedLength > lineEnd
          const isCurrentLine = clampedTypedLength >= lineStart && clampedTypedLength <= lineEnd

          cursor = lineEnd + 1 // 次の行の先頭（行間スペース1文字分を想定）

          const typedPart = line.slice(0, typedWithinLine)
          const remainingPart = line.slice(typedWithinLine)

          return (
            <p
              key={lineIndex}
              className="text-3xl font-bold tracking-wider leading-tight h-12 mb-2 whitespace-pre"
            >
              {isCompletedLine ? (
                <span className="text-muted-foreground/60">{line || '\u00A0'}</span>
              ) : isCurrentLine ? (
                <>
                  {typedPart && <span className="text-muted-foreground/60">{typedPart}</span>}
                  <span className="text-primary">{remainingPart || '\u00A0'}</span>
                </>
              ) : (
                <span className="text-foreground">{line || '\u00A0'}</span>
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
