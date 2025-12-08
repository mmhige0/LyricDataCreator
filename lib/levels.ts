export const LEVEL_DISPLAY_MIN = 1
export const LEVEL_DISPLAY_MAX = 10

export const clampDisplayLevel = (value: number) =>
  Math.min(Math.max(value, LEVEL_DISPLAY_MIN), LEVEL_DISPLAY_MAX)

export const normalizeDisplayLevelRange = (min?: number | null, max?: number | null) => {
  const hasMin = typeof min === "number" && !Number.isNaN(min)
  const hasMax = typeof max === "number" && !Number.isNaN(max)
  if (!hasMin && !hasMax) return null

  const normalizedMin = hasMin ? clampDisplayLevel(min as number) : LEVEL_DISPLAY_MIN
  const normalizedMax = hasMax ? clampDisplayLevel(max as number) : LEVEL_DISPLAY_MAX
  const lower = Math.min(normalizedMin, normalizedMax)
  const upper = Math.max(normalizedMin, normalizedMax)

  return { min: lower, max: upper }
}

export const displayLevelToValueBounds = (displayLevel: number) => ({
  minValue: displayLevel * 3 - 1,
  maxValue: displayLevel * 3 + 1,
})

export const displayRangeToValueRange = (min?: number | null, max?: number | null) => {
  const normalized = normalizeDisplayLevelRange(min, max)
  if (!normalized) return null

  const lower = displayLevelToValueBounds(normalized.min).minValue
  const upper = displayLevelToValueBounds(normalized.max).maxValue

  return { minValue: lower, maxValue: upper }
}

export const parseLevelValue = (value?: string | null) => {
  const match = value?.trim().match(/^([0-9]+)([+-])?$/)
  if (!match) return null
  const base = Number.parseInt(match[1], 10)
  const modifier = match[2] === "+" ? 1 : match[2] === "-" ? -1 : 0
  return base * 3 + modifier
}
