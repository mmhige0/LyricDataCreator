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
