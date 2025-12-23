import React from 'react'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { LyricsArray } from '@/lib/types'

interface LyricsInputFieldsProps {
  lyrics: LyricsArray
  setLyrics: (lyrics: LyricsArray) => void
  lyricsInputRefs?: React.MutableRefObject<(HTMLInputElement | null)[]>
  placeholder?: string
}

export const LyricsInputFields: React.FC<LyricsInputFieldsProps> = ({
  lyrics,
  setLyrics,
  lyricsInputRefs,
  placeholder = "空行の場合は入力不要"
}) => {

  const handleEnterKey = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (e.key !== 'Enter' || e.ctrlKey || e.metaKey || index >= lyrics.length - 1) return

    e.preventDefault()

    const { selectionStart, selectionEnd, value } = e.currentTarget
    const start = selectionStart ?? value.length
    const end = selectionEnd ?? start

    const before = value.slice(0, start)
    const after = value.slice(end)
    const nextLine = lyrics[index + 1] ?? ''

    const newLyrics = [...lyrics] as LyricsArray
    newLyrics[index] = before
    const shouldAddSpace = after.length > 0 && nextLine.length > 0
    newLyrics[index + 1] = `${after}${shouldAddSpace ? '　' : ''}${nextLine}`
    setLyrics(newLyrics)

    const nextInput = lyricsInputRefs?.current?.[index + 1]
    if (nextInput) {
      requestAnimationFrame(() => {
        nextInput.focus()
        nextInput.setSelectionRange(0, 0)
      })
    }
  }

  return (
    <>
      {lyrics.map((line, index) => (
        <div key={index} className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground min-w-[3rem]">
            {index + 1}行目
          </Label>
          <Input
            ref={lyricsInputRefs ? (el) => {
              lyricsInputRefs.current[index] = el
            } : undefined}
            placeholder={placeholder}
            value={line}
            onChange={(e) => {
              const newLyrics = [...lyrics] as LyricsArray
              newLyrics[index] = e.target.value
              setLyrics(newLyrics)
            }}
            onKeyDown={(e) => handleEnterKey(e, index)}
            className="h-12 text-lg px-4"
          />
        </div>
      ))}
    </>
  )
}
