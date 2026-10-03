import type { CentralPop } from './types'
import { POP_DURATIONS } from './scoreFormat'

export const POP_FADE_IN_SECONDS = { s: 0.05, m: 0.1, l: 0.15, x: 0.2 } as const
export const POP_FADE_OUT_SECONDS = 0.2
export const POP_PREVIEW_START_DELAY_SECONDS = 0.5
export const POP_PREVIEW_RESTORE_DELAY_SECONDS = 0.5
export const POP_OPACITY = 0.5
export const POP_DURATION_LABELS = { s: '短', m: '中', l: '長', x: '極長' } as const

export const popPlaybackSeconds = (duration: CentralPop['duration']) =>
  POP_FADE_IN_SECONDS[duration] + POP_DURATIONS[duration] + POP_FADE_OUT_SECONDS

export function popPreviewTiming(duration: CentralPop['duration']) {
  const fadeIn = POP_FADE_IN_SECONDS[duration]
  const hold = POP_DURATIONS[duration]
  const playback = popPlaybackSeconds(duration)
  const start = POP_PREVIEW_START_DELAY_SECONDS
  const total = start + playback + POP_PREVIEW_RESTORE_DELAY_SECONDS
  // Sample the game's cubic/back and quint curves independently for opacity and scale.
  // Linear interpolation between 100 samples keeps the scale error below 0.0004.
  const steps = 100
  const keyframes = [
    { offset: 0, opacity: 0, transform: 'scale(0.6)' },
    { offset: start / total, opacity: 0, transform: 'scale(0.6)' },
  ]
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const progress = 1 + 5.9 * (t - 1) ** 3 + 4.9 * (t - 1) ** 2
    keyframes.push({
      offset: (start + fadeIn * t) / total,
      opacity: POP_OPACITY * (1 - (1 - t) ** 3),
      transform: `scale(${0.6 + 0.4 * progress})`,
    })
  }
  keyframes.push({ offset: (start + fadeIn + hold) / total, opacity: POP_OPACITY, transform: 'scale(1)' })
  for (let i = 1; i <= steps; i++) {
    const t = i / steps
    const progress = t ** 5
    keyframes.push({
      offset: (start + fadeIn + hold + POP_FADE_OUT_SECONDS * t) / total,
      opacity: POP_OPACITY * (1 - progress),
      transform: `scale(${1 - 0.4 * progress})`,
    })
  }
  keyframes.push({ offset: 1, opacity: 0, transform: 'scale(0.6)' })
  return { total, keyframes }
}
