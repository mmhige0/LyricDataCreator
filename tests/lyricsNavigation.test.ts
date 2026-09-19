import { describe, expect, it } from 'vitest'
import { adjacentLyricsPosition, pagePlaybackTimestamp } from '../lib/lyricsNavigation'
import type { ScoreEntry } from '../lib/types'

const pages: ScoreEntry[] = [
  { id: 'a', timestamp: 0, lyrics: ['a', '', '', ''] },
  { id: 'b', timestamp: 10, lyrics: ['', '', '', 'b'] },
  { id: 'c', timestamp: 20, lyrics: ['c', '', '', ''] },
]

describe('lyrics navigation', () => {
  it('moves through empty lines and across page boundaries', () => {
    expect(adjacentLyricsPosition(pages, { id: 'a', line: 0 }, 1, 'line')).toEqual({ id: 'a', line: 1 })
    expect(adjacentLyricsPosition(pages, { id: 'a', line: 3 }, 1, 'line')).toEqual({ id: 'b', line: 0 })
    expect(adjacentLyricsPosition(pages, { id: 'b', line: 0 }, -1, 'line')).toEqual({ id: 'a', line: 3 })
  })
  it('preserves the line for page navigation without wrapping at either end', () => {
    expect(adjacentLyricsPosition(pages, { id: 'b', line: 2 }, 1, 'page')).toEqual({ id: 'c', line: 2 })
    expect(adjacentLyricsPosition(pages, { id: 'b', line: 2 }, -1, 'page')).toEqual({ id: 'a', line: 2 })
    expect(adjacentLyricsPosition(pages, { id: 'a', line: 3 }, -1, 'page')).toBeNull()
    expect(adjacentLyricsPosition(pages, { id: 'c', line: 0 }, 1, 'page')).toBeNull()
    expect(adjacentLyricsPosition(pages, { id: 'a', line: 0 }, -1, 'line')).toBeNull()
    expect(adjacentLyricsPosition(pages, { id: 'c', line: 3 }, 1, 'line')).toBeNull()
  })
  it('uses stable IDs after reordering, and tolerates missing or deleted pages', () => {
    expect(adjacentLyricsPosition([pages[1], pages[0], pages[2]], { id: 'a', line: 1 }, -1, 'page')).toEqual({ id: 'b', line: 1 })
    expect(adjacentLyricsPosition([], { id: 'a', line: 1 }, 1, 'line')).toBeNull()
    expect(adjacentLyricsPosition(pages, { id: 'deleted', line: 1 }, 1, 'line')).toBeNull()
  })
})

describe('head-start playback target', () => {
  it('plays the selected page including zero', () => {
    expect(pagePlaybackTimestamp(pages, 'a')).toBe(0)
    expect(pagePlaybackTimestamp(pages, 'b')).toBe(10)

  })
  it('does not substitute another page for a missing target or invalid stored time', () => {
    expect(pagePlaybackTimestamp(pages, null)).toBeNull()
    expect(pagePlaybackTimestamp(pages, 'deleted')).toBeNull()
    for (const time of ['-2', '12oops', 'NaN', 'Infinity']) {
      expect(pagePlaybackTimestamp([{ ...pages[0], timestamp: Number(time) }], 'a')).toBeNull()
    }
  })
})
