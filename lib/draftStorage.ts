import type { LyricDraft, DraftListEntry, ScoreEntry } from './types'

const DRAFT_LIST_KEY = 'lyric-draft-list'
const DRAFT_KEY_PREFIX = 'lyric-draft-'
const DRAFT_EXPIRY_DAYS = 7
const MAX_DRAFTS = 100

/**
 * Get the draft key for a specific session
 */
function getDraftKey(sessionId: string): string {
  return `${DRAFT_KEY_PREFIX}${sessionId}`
}

/**
 * Get all draft list entries
 */
export function getDraftList(): DraftListEntry[] {
  if (typeof window === 'undefined') return []

  try {
    const listJson = localStorage.getItem(DRAFT_LIST_KEY)
    return listJson ? JSON.parse(listJson) : []
  } catch (error) {
    console.error('Error reading draft list:', error)
    return []
  }
}

/**
 * Update draft list entry
 */
function updateDraftList(entry: DraftListEntry): void {
  const list = getDraftList()
  const existingIndex = list.findIndex(item => item.sessionId === entry.sessionId)

  if (existingIndex >= 0) {
    list[existingIndex] = entry
  } else {
    list.push(entry)
  }

  localStorage.setItem(DRAFT_LIST_KEY, JSON.stringify(list))
}

/**
 * Remove draft from list
 */
function removeDraftFromList(sessionId: string): void {
  const list = getDraftList()
  const filtered = list.filter(item => item.sessionId !== sessionId)
  localStorage.setItem(DRAFT_LIST_KEY, JSON.stringify(filtered))
}

/**
 * Save draft to localStorage
 */
export function saveDraft(
  sessionId: string,
  youtubeUrl: string,
  scoreEntries: ScoreEntry[],
  songTitle: string
): void {
  if (typeof window === 'undefined') return

  const draft: LyricDraft = {
    sessionId,
    youtubeUrl,
    scoreEntries,
    songTitle,
    lastModified: Date.now()
  }

  try {
    // Check if we need to delete old drafts
    const list = getDraftList()
    const existingIndex = list.findIndex(item => item.sessionId === sessionId)

    // If adding new draft and already at max, delete oldest
    if (existingIndex < 0 && list.length >= MAX_DRAFTS) {
      const sortedList = [...list].sort((a, b) => a.lastModified - b.lastModified)
      const oldestDraft = sortedList[0]
      if (oldestDraft) {
        deleteDraft(oldestDraft.sessionId)
      }
    }

    // Save draft data
    localStorage.setItem(getDraftKey(sessionId), JSON.stringify(draft))

    // Update draft list
    updateDraftList({
      sessionId,
      songTitle: songTitle || '(無題)',
      pageCount: scoreEntries.length,
      lastModified: draft.lastModified
    })
  } catch (error) {
    console.error('Error saving draft:', error)
  }
}

/**
 * Load draft from localStorage
 */
export function loadDraft(sessionId: string): LyricDraft | null {
  if (typeof window === 'undefined') return null

  try {
    const draftJson = localStorage.getItem(getDraftKey(sessionId))
    return draftJson ? JSON.parse(draftJson) : null
  } catch (error) {
    console.error('Error loading draft:', error)
    return null
  }
}

/**
 * Delete draft from localStorage
 */
export function deleteDraft(sessionId: string): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(getDraftKey(sessionId))
    removeDraftFromList(sessionId)
  } catch (error) {
    console.error('Error deleting draft:', error)
  }
}

/**
 * Clean up expired drafts (older than DRAFT_EXPIRY_DAYS)
 */
export function cleanupExpiredDrafts(): void {
  if (typeof window === 'undefined') return

  const now = Date.now()
  const expiryTime = DRAFT_EXPIRY_DAYS * 24 * 60 * 60 * 1000
  const list = getDraftList()

  list.forEach(entry => {
    if (now - entry.lastModified > expiryTime) {
      deleteDraft(entry.sessionId)
    }
  })
}
