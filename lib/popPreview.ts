import type { CentralPop } from './types'
import { POP_DURATIONS } from './scoreFormat'

export const POP_FADE_IN_SECONDS = 0.1
export const POP_FADE_OUT_SECONDS = 0.2
export const POP_PREVIEW_START_DELAY_SECONDS = 0.5
export const POP_PREVIEW_RESTORE_DELAY_SECONDS = 0.5
export const POP_OPACITY = 0.5

export function popPreviewTiming(duration: CentralPop['duration']) {
  const hold = POP_DURATIONS[duration]
  const playback = POP_FADE_IN_SECONDS + hold + POP_FADE_OUT_SECONDS
  const start = POP_PREVIEW_START_DELAY_SECONDS
  const total = start + playback + POP_PREVIEW_RESTORE_DELAY_SECONDS
  return {
    total,
    keyframes: [
      { offset: 0, opacity: 0, transform: 'scale(0.6)' },
      { offset: start / total, opacity: 0, transform: 'scale(0.6)' },
      { offset: (start + POP_FADE_IN_SECONDS) / total, opacity: POP_OPACITY, transform: 'scale(1)' },
      { offset: (start + POP_FADE_IN_SECONDS + hold) / total, opacity: POP_OPACITY, transform: 'scale(1)' },
      { offset: (start + playback) / total, opacity: 0, transform: 'scale(0.6)' },
      { offset: 1, opacity: 0, transform: 'scale(0.6)' },
    ],
  }
}
