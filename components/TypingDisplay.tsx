import type { TypingWord } from 'lyrics-typing-engine'

interface TypingDisplayProps {
  lines: string[]
  typingWord: TypingWord | null
  overlayText?: string
  overlayLines?: string[]
}

export const TypingDisplay = ({ lines, typingWord, overlayText, overlayLines }: TypingDisplayProps) => {
  const typedKanaLength = typingWord?.correct.kana.length ?? 0
  const joinedLines = lines.join(' ')
  const clampedTypedLength = Math.min(typedKanaLength, joinedLines.length)

  let cursor = 0

  return (
    <div className="relative text-left py-8 px-6 bg-gray-100 dark:bg-gray-800 rounded-lg h-64 flex flex-col justify-start select-none overflow-hidden">
      {lines.map((line, lineIndex) => {
        const lineStart = cursor
        const lineEnd = cursor + line.length
        const typedWithinLine = Math.max(0, Math.min(clampedTypedLength - lineStart, line.length))

        const isCompletedLine = clampedTypedLength > lineEnd
        const isCurrentLine = clampedTypedLength >= lineStart && clampedTypedLength <= lineEnd

        cursor = lineEnd + 1 // 次の行の先頭（行間スペース1文字分を想定）

        const typedPart = line.slice(0, typedWithinLine)
        const remainingPart = line.slice(typedWithinLine)

        return (
          <p key={lineIndex} className="text-3xl font-bold tracking-wider leading-tight h-12 mb-2">
            {isCompletedLine ? (
              <span className="text-gray-400 dark:text-gray-500">{line || '\u00A0'}</span>
            ) : isCurrentLine ? (
              <>
                {typedPart && <span className="text-gray-400 dark:text-gray-500">{typedPart}</span>}
                <span className="text-blue-600 dark:text-blue-400">{remainingPart || '\u00A0'}</span>
              </>
            ) : (
              <span className="text-black dark:text-white">{line || '\u00A0'}</span>
            )}
          </p>
        )
      })}
      {overlayText && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-slate-900/70 text-blue-900 dark:text-blue-100 text-2xl font-semibold rounded-lg">
          {overlayText}
        </div>
      )}
      {!overlayText && overlayLines && overlayLines.length > 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 dark:bg-slate-900/70 text-gray-600 dark:text-gray-300 text-2xl font-semibold rounded-lg">
          <div className="space-y-2 text-center opacity-90">
            {overlayLines.map((line, index) => (
              <p key={index} className="leading-snug">
                {line || '\u00A0'}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
