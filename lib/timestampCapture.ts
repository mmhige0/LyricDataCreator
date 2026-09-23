export const DEFAULT_TIMESTAMP_OFFSET = -0.15

export function captureTimestamp(time: number, offset: number, duration: number) {
  if (!Number.isFinite(time)) return 0
  const adjusted = Math.max(0, time + (Number.isFinite(offset) ? offset : 0))
  return Number((Number.isFinite(duration) && duration > 0 ? Math.min(duration, adjusted) : adjusted).toFixed(2))
}
