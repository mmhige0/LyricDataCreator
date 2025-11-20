import type { LineWord } from '@/lib/typingUtils'

interface TypingDisplayProps {
  lineWords: LineWord[]
  currentLineIndex: number
}

export const TypingDisplay = ({ lineWords, currentLineIndex }: TypingDisplayProps) => {
  return (
    <div className="text-left py-8 px-6 bg-gray-100 dark:bg-gray-800 rounded-lg h-64 flex flex-col justify-start select-none">
      {lineWords.map((lineWord, lineIndex) => {
        const isCompletedLine = lineIndex < currentLineIndex
        const isCurrentLine = lineIndex === currentLineIndex

        // 入力済み部分と未入力部分を結合
        const fullText =
          lineWord.correct.k + lineWord.nextChar.k + lineWord.word.map((chunk) => chunk.k).join('')

        return (
          <p key={lineIndex} className="text-3xl font-bold tracking-wider leading-tight h-12 mb-2">
            {isCompletedLine ? (
              // 完了した行は全体をグレーアウト
              <span className="text-gray-400 dark:text-gray-500">{fullText || '\u00A0'}</span>
            ) : isCurrentLine ? (
              // 現在入力中の行（青色）
              <>
                {lineWord.correct.k && (
                  <span className="text-gray-400 dark:text-gray-500">{lineWord.correct.k}</span>
                )}
                <span className="text-blue-600 dark:text-blue-400">
                  {lineWord.nextChar.k}
                  {lineWord.word.map((chunk) => chunk.k).join('')}
                </span>
              </>
            ) : (
              // 未着手の行
              <span className="text-black dark:text-white">{fullText || '\u00A0'}</span>
            )}
          </p>
        )
      })}
    </div>
  )
}
