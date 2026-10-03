import { expect, it } from 'vitest'
import { popPreviewTiming, POP_OPACITY, popPlaybackSeconds } from '../lib/popPreview'

const scale = (frame: { transform: string }) => Number(frame.transform.slice(6, -1))
it.each([['s', 0.05, 0.1, 0.35], ['m', 0.1, 0.3, 0.6], ['l', 0.15, 0.5, 0.85], ['x', 0.2, 1, 1.4]] as const)('matches the %s fade, hold and total times', (code, fade, hold, playback) => {
  const timing = popPreviewTiming(code)
  expect(popPlaybackSeconds(code)).toBeCloseTo(playback)
  expect(timing.total).toBeCloseTo(playback + 1)
  const at = (time: number) => timing.keyframes.find(frame => Math.abs(frame.offset * timing.total - time) < 1e-8)!
  expect(at(0.5)).toMatchObject({ opacity: 0, transform: 'scale(0.6)' })
  expect(at(0.5 + fade)).toMatchObject({ opacity: POP_OPACITY, transform: 'scale(1)' })
  expect(at(0.5 + fade + hold)).toMatchObject({ opacity: POP_OPACITY, transform: 'scale(1)' })
  expect(at(0.5 + playback)).toMatchObject({ opacity: 0, transform: 'scale(0.6)' })
  expect(timing.keyframes.at(-1)).toMatchObject({ offset: 1, opacity: 0, transform: 'scale(0.6)' })
  // Cubic fade-in reaches 87.5% opacity halfway; the Back curve overshoots ~120%.
  expect(at(0.5 + fade * 0.5).opacity).toBeCloseTo(POP_OPACITY * 0.875)
  expect(scale(at(0.5 + fade * 0.5))).toBeCloseTo(1.195)
  const peak = Math.max(...timing.keyframes.map(scale))
  expect(peak).toBeGreaterThan(1.2)
  expect(peak).toBeLessThan(1.201)
  // Quint fade-out retains 96.875% opacity/98.75% scale halfway, then fades rapidly.
  expect(at(0.5 + fade + hold + 0.1).opacity).toBeCloseTo(POP_OPACITY * 0.96875)
  expect(scale(at(0.5 + fade + hold + 0.1))).toBeCloseTo(0.9875)
  expect(at(0.5 + fade + hold + 0.18).opacity).toBeCloseTo(POP_OPACITY * (1 - 0.9 ** 5))
  expect(timing.keyframes.every((frame, index, frames) => index === 0 || frame.offset >= frames[index - 1].offset)).toBe(true)
})
it('uses the shared fixed opacity', () => {
  expect(POP_OPACITY).toBe(0.5)
})
