import { expect, it } from 'vitest'
import { popPreviewTiming, POP_OPACITY } from '../lib/popPreview'

it.each([['s', 0.1, 0.4], ['m', 0.3, 0.6], ['l', 0.5, 0.8], ['x', 1, 1.3]] as const)('uses fixed fade timings around the %s hold period', (code, hold, total) => {
  const timing = popPreviewTiming(code)
  expect(timing.total).toBeCloseTo(total + 0.5)
  expect(timing.keyframes[1].offset * timing.total).toBeCloseTo(0.1)
  expect((timing.keyframes[2].offset - timing.keyframes[1].offset) * timing.total).toBeCloseTo(hold)
  expect((timing.keyframes[3].offset - timing.keyframes[2].offset) * timing.total).toBeCloseTo(0.2)
  expect((1 - timing.keyframes[3].offset) * timing.total).toBeCloseTo(0.5)
  expect(timing.keyframes.map(frame => frame.opacity)).toEqual([0, 0.5, 0.5, 0, 0])
  expect(timing.keyframes.map(frame => frame.transform)).toEqual(['scale(0.6)', 'scale(1)', 'scale(1)', 'scale(0.6)', 'scale(0.6)'])
})
it('uses the shared fixed opacity', () => {
  expect(POP_OPACITY).toBe(0.5)
})
