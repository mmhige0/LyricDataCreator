import { describe, expect, it } from 'vitest'
import { getPracticeLineIndexes, normalizePracticeLineSettings } from '../lib/practiceLineSettings'

describe('practice line settings', () => {
  it('uses every non-empty line in all mode', () => {
    expect(getPracticeLineIndexes(['a', '', 'c', 'd'], { mode: 'all', selectedLineIndexes: [0, 1, 2, 3] })).toEqual([0, 2, 3])
  })

  it('keeps selected mode within non-empty lines', () => {
    expect(getPracticeLineIndexes(['a', '', 'c', ''], { mode: 'selected', selectedLineIndexes: [1, 2, 3] })).toEqual([2])
  })

  it('selects one non-empty line in random mode', () => {
    expect(getPracticeLineIndexes(['a', '', 'c', 'd'], { mode: 'random', selectedLineIndexes: [0, 1, 2, 3] }, () => 0.6)).toEqual([2])
  })

  it('normalizes invalid settings', () => {
    expect(normalizePracticeLineSettings({ mode: 'selected', selectedLineIndexes: [3, 8, 3, 0] })).toEqual({
      mode: 'selected',
      selectedLineIndexes: [0, 3],
    })
  })
})
