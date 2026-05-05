import type { PracticeLineSettings } from './types'

export const ALL_LINE_INDEXES = [0, 1, 2, 3] as const

export const DEFAULT_PRACTICE_LINE_SETTINGS: PracticeLineSettings = {
  mode: 'all',
  selectedLineIndexes: [...ALL_LINE_INDEXES],
}

export const normalizePracticeLineSettings = (
  value: Partial<PracticeLineSettings> | null | undefined
): PracticeLineSettings => {
  const mode = value?.mode === 'random' || value?.mode === 'selected' ? value.mode : 'all'
  const selectedLineIndexes = (value?.selectedLineIndexes ?? [])
    .filter((lineIndex) => lineIndex >= 0 && lineIndex < ALL_LINE_INDEXES.length)
    .filter((lineIndex, index, lineIndexes) => lineIndexes.indexOf(lineIndex) === index)
    .sort((a, b) => a - b)

  return {
    mode,
    selectedLineIndexes: selectedLineIndexes.length > 0
      ? selectedLineIndexes
      : [...DEFAULT_PRACTICE_LINE_SETTINGS.selectedLineIndexes],
  }
}

export const getPracticeLineIndexes = (
  lines: string[],
  settings: PracticeLineSettings,
  random = Math.random
): number[] => {
  const nonEmptyLineIndexes = ALL_LINE_INDEXES.filter((lineIndex) => (lines[lineIndex] ?? '').trim().length > 0)

  if (settings.mode === 'random') {
    if (nonEmptyLineIndexes.length === 0) return []
    const randomIndex = Math.floor(random() * nonEmptyLineIndexes.length)
    return [nonEmptyLineIndexes[randomIndex]]
  }

  if (settings.mode === 'selected') {
    return settings.selectedLineIndexes.filter((lineIndex) => nonEmptyLineIndexes.some((targetIndex) => targetIndex === lineIndex))
  }

  return nonEmptyLineIndexes
}
