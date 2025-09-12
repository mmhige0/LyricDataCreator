import React from 'react'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { LyricsArray } from '@/lib/types'

interface LyricsInputFieldsProps {
  lyrics: LyricsArray
  setLyrics: (lyrics: LyricsArray) => void
  lyricsInputRefs?: React.MutableRefObject<(HTMLInputElement | null)[]>
  placeholder?: string
  size?: 'default' | 'small'
}

export const LyricsInputFields: React.FC<LyricsInputFieldsProps> = ({
  lyrics,
  setLyrics,
  lyricsInputRefs,
  placeholder = "空行の場合は入力不要",
  size = 'default'
}) => {
  const inputClassName = size === 'small' ? 'text-sm' : 'h-12 text-lg px-4'

  return (
    <>
      {lyrics.map((line, index) => (
        <div key={index}>
          <Label>{index + 1}行目</Label>
          <Input
            ref={lyricsInputRefs ? (el) => {
              lyricsInputRefs.current[index] = el
            } : undefined}
            placeholder={size === 'small' ? `${index + 1}行目` : placeholder}
            value={line}
            onChange={(e) => {
              const newLyrics = [...lyrics] as LyricsArray
              newLyrics[index] = e.target.value
              setLyrics(newLyrics)
            }}
            className={inputClassName}
          />
        </div>
      ))}
    </>
  )
}