import { describe, expect, it } from 'vitest'
import { buildPageKpmMap } from '../lib/kpmUtils'
import { kpmTestCases } from './fixtures/kpmTestCases'

describe('buildPageKpmMap', () => {
  it.each(kpmTestCases)('calculates expected KPM for $name', async (testCase) => {
    const map = await buildPageKpmMap({
      scoreEntries: testCase.scoreEntries,
      totalDuration: testCase.totalDuration,
    })
    const page = map.get(testCase.scoreEntries[0]?.id ?? '')
    expect(page).toBeTruthy()
    if (!page) return

    const line = page.lines.find((entry) => entry.line === testCase.expect.line)
    expect(line).toBeTruthy()
    if (!line) return

    expect(line.charCount.kana).toBe(testCase.expect.kanaCharCount)
    expect(line.kpm.kana).toBe(testCase.expect.kanaKpm)
    expect(line.charCount.roma).toBe(testCase.expect.romaCharCount)
    expect(line.kpm.roma).toBe(testCase.expect.romaKpm)
  })
})

it('excludes decorations while preserving the next page boundary', async () => {
  const pages = [
    { id: 'a', timestamp: 0, lyrics: ['あ', '', '', ''] as [string, string, string, string] },
    { id: 'b', timestamp: 10, lyrics: ['飾り', '', '', ''] as [string, string, string, string], decorations: [true, false, false, false] as [boolean, boolean, boolean, boolean] },
    { id: 'c', timestamp: 20, lyrics: ['ア', '', '', ''] as [string, string, string, string] },
  ]
  const map = await buildPageKpmMap({ scoreEntries: pages, totalDuration: 30 })
  expect(map.get('a')?.duration).toBe(10)
  expect(map.get('b')?.totalKpm).toEqual({ roma: 0, kana: 0 })
  expect(map.get('a')?.totalKpm).toEqual(map.get('c')?.totalKpm)
})
