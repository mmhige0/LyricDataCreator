export type SubmissionCredentials = { id: string; token: string; title: string; draftSessionId?: string }
const STORAGE_KEY = 'chart-submission-keys'
export function getSubmissionKeys(): SubmissionCredentials[] {
  try {
    const rows: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
    if (!Array.isArray(rows)) return []
    return rows.filter((row): row is SubmissionCredentials => Boolean(row) && typeof row.id === 'string' && typeof row.token === 'string' && typeof row.title === 'string')
  } catch { return [] }
}
export function saveSubmissionKey(key: SubmissionCredentials) {
  const previous = getSubmissionKeys()
  const existing = previous.find(row => row.id === key.id)
  const list = previous.filter(row => row.id !== key.id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify([{ ...key, draftSessionId: key.draftSessionId ?? existing?.draftSessionId }, ...list]))
}
export function getSubmissionForDraft(sessionId: string): SubmissionCredentials | undefined {
  return getSubmissionKeys().find(key => key.draftSessionId === sessionId)
}
export function removeSubmissionKey(id: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(getSubmissionKeys().filter(key => key.id !== id)))
}
export class SubmissionRequestError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
export function newSubmissionKey(title: string): SubmissionCredentials {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return { id: crypto.randomUUID(), token, title }
}
export const statusLabel: Record<string, string> = { pending: '承認待ち', publishing: '承認処理中（管理者の再試行待ちを含む）', approved: '承認済み', rejected: '却下（修正して再申請できます）' }

export async function submissionFetch(url: string, token: string, init: RequestInit = {}) {
  const response = await fetch(url, { ...init, cache: 'no-store', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...init.headers } })
  const data = await response.json()
  if (!response.ok) throw new SubmissionRequestError(response.status, data.error ?? '処理に失敗しました。')
  return data
}
