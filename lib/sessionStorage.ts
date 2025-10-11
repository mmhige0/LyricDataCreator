import type { SessionInfo } from './types'

const SESSION_KEY = 'lyric-session-info'

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Get current session ID (from SessionStorage)
 */
export function getSessionId(): string | null {
  if (typeof window === 'undefined') return null

  try {
    const sessionJson = sessionStorage.getItem(SESSION_KEY)
    if (sessionJson) {
      const session: SessionInfo = JSON.parse(sessionJson)
      return session.sessionId
    }
    return null
  } catch (error) {
    console.error('Error reading session ID:', error)
    return null
  }
}

/**
 * Set session ID (to SessionStorage)
 */
export function setSessionId(sessionId: string): void {
  if (typeof window === 'undefined') return

  try {
    const session: SessionInfo = { sessionId }
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch (error) {
    console.error('Error setting session ID:', error)
  }
}

/**
 * Get or create session ID
 */
export function getOrCreateSessionId(): string {
  let sessionId = getSessionId()

  if (!sessionId) {
    sessionId = generateSessionId()
    setSessionId(sessionId)
  }

  return sessionId
}

/**
 * Clear session ID
 */
export function clearSessionId(): void {
  if (typeof window === 'undefined') return

  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch (error) {
    console.error('Error clearing session ID:', error)
  }
}
