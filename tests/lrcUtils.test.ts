import { describe, expect, it } from 'vitest'
import { createLrcFromScoreEntries, parseLrcToScoreEntries } from '../lib/lrcUtils'
import type { LyricsArray } from '../lib/types'

describe('LRC export and reimport', () => {
  it.each<{ name: string; lyrics: LyricsArray; text: string }>([
    { name: 'four populated lines', lyrics: ['あ', 'い', 'う', 'え'], text: 'あ/い/う/え' },
    { name: 'leading, middle and trailing empty lines', lyrics: ['', 'い', '', ''], text: '/い//' },
    { name: 'an empty page', lyrics: ['', '', '', ''], text: '///' },
  ])('preserves line positions and timestamp for $name', ({ lyrics, text }) => {
    const exported = createLrcFromScoreEntries([{ id: 'page', timestamp: 12.5, lyrics }])

    expect(exported).toBe(`[00:12.50]${text}`)
    const restored = parseLrcToScoreEntries(exported)
    expect(restored).toHaveLength(1)
    expect(restored[0]).toMatchObject({ timestamp: 12.5, lyrics })
  })
})
