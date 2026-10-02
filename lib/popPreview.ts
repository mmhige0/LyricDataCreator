import type { CentralPop } from './types'
import { POP_DURATIONS } from './scoreFormat'

export const POP_FADE_IN_SECONDS = 0.1
export const POP_FADE_OUT_SECONDS = 0.2
export const POP_OPACITY = 0.5

export function popPreviewTiming(duration: CentralPop['duration']) {
  const hold = POP_DURATIONS[duration]
  const total = POP_FADE_IN_SECONDS + hold + POP_FADE_OUT_SECONDS
  return {
    total,
    keyframes: [
      { offset: 0, opacity: 0, transform: 'scale(0.6)' },
      { offset: POP_FADE_IN_SECONDS / total, opacity: POP_OPACITY, transform: 'scale(1)' },
      { offset: (POP_FADE_IN_SECONDS + hold) / total, opacity: POP_OPACITY, transform: 'scale(1)' },
      { offset: 1, opacity: 0, transform: 'scale(0.6)' },
    ],
  }
}
