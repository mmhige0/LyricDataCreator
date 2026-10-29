'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SubmissionTurnstile } from './SubmissionTurnstile'
import { createScoreTxt, parseScoreTxt } from '@/lib/scoreFormat'
import { getSubmissionKeys, newSubmissionKey, saveSubmissionKey, statusLabel, submissionFetch, type SubmissionCredentials } from '@/lib/submissions/client'
import type { CentralPop, ScoreEntry } from '@/lib/types'

type LoadedSubmission = { title: string; youtubeUrl: string; duration: number; scoreEntries: ScoreEntry[]; centralPops: CentralPop[] }
type Props = LoadedSubmission & { onLoad: (data: LoadedSubmission) => void }

export function SubmissionPanel({ title, youtubeUrl, duration, scoreEntries, centralPops, onLoad }: Props) {
  const [credentials, setCredentials] = useState<SubmissionCredentials | null>(null)
  const [creatorName, setCreatorName] = useState('')
  const [submittedTitle, setSubmittedTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [level, setLevel] = useState('')
  const [version, setVersion] = useState<number | null>(null)
  const [status, setStatus] = useState('')
  const [needsLoad, setNeedsLoad] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [token, setToken] = useState('')
  const [challenge, setChallenge] = useState(0)
  const [editUrl, setEditUrl] = useState('')
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('submission')
    const fragment = new URLSearchParams(location.hash.slice(1)).get('key')
    if (!id) return
    if (fragment) {
      saveSubmissionKey({ id, token: fragment, title: '投稿した譜面' })
      history.replaceState(null, '', location.pathname + location.search)
    }
    const key = getSubmissionKeys().find(row => row.id === id)
    if (key) { setCredentials(key); setNeedsLoad(true) }
    else setMessage('この投稿の編集URLを開いてください。')
  }, [])
  useEffect(() => {
    setEditUrl(credentials ? `${location.origin}/editor?submission=${credentials.id}#key=${credentials.token}` : '')
  }, [credentials])
  const load = async () => {
    if (!credentials) return
    setBusy(true)
    try {
      const row = await submissionFetch(`/api/submissions/${credentials.id}`, credentials.token)
      const parsed = parseScoreTxt(row.txtContent)
      onLoad({ title: row.title, youtubeUrl: row.youtubeUrl, ...parsed })
      setSubmittedTitle(row.title); setCreatorName(row.creatorName); setArtist(row.artist ?? ''); setLevel(row.level ?? '')
      setVersion(row.revision); setStatus(row.status); setNeedsLoad(false)
      setMessage(`第${row.revision}版を読み込みました。`)
    } catch (error) { setMessage(error instanceof Error ? error.message : '読み込めませんでした。') }
    finally { setBusy(false) }
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (needsLoad) { setMessage('先に投稿内容を読み込んでください。'); return }
    setBusy(true); setMessage('')
    try {
      const txtContent = createScoreTxt(duration, scoreEntries, centralPops)
      const name = submittedTitle.trim() || title
      const key = credentials ?? newSubmissionKey(name)
      // Persist before sending, so a lost response never loses edit access.
      saveSubmissionKey({ ...key, title: name })
      setCredentials(key)
      const row = await submissionFetch(`/api/submissions${version === null ? '' : `/${key.id}`}`, key.token, {
        method: version === null ? 'POST' : 'PUT',
        body: JSON.stringify({ id: key.id, revision: version, title: name, creatorName, artist, level, youtubeUrl, txtContent, turnstileToken: token }),
      })
      setVersion(row.revision); setStatus(row.status); setNeedsLoad(false)
      history.replaceState(null, '', `/editor?submission=${key.id}`)
      setMessage('申請を保存しました。編集URLを控えてください。公開には管理者の承認が必要です。')
    } catch (error) { setMessage(error instanceof Error ? error.message : '投稿に失敗しました。') }
    finally { setBusy(false); setToken(''); setChallenge(value => value + 1) }
  }
  // For a failed initial create the same credentials can be retried without loading a nonexistent row.
  const canSubmit = Boolean(token) && !busy && status !== 'publishing' && !needsLoad
  return <section className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 space-y-4" aria-labelledby="submission-heading">
    <h2 id="submission-heading" className="text-lg font-semibold">譜面の投稿・管理</h2>
    <p className="text-sm text-muted-foreground">ログイン不要。制作者名は自己申告です。承認後に公開し、申請は削除します。編集URLは承認前のみ使えます。公開後の修正は管理者へご相談ください。</p>
    <Link href="/submissions" className="underline">自分の投稿一覧</Link>
    {credentials && <div className="space-y-2">
      <p>{statusLabel[status] ?? '投稿内容を読み込んでください。'}</p>
      <Button type="button" variant="outline" disabled={busy} onClick={() => void load()}>投稿内容を読み込む</Button>
      <Button type="button" variant="ghost" onClick={() => { setCredentials(null); setVersion(null); setStatus(''); setNeedsLoad(false); history.replaceState(null, '', '/editor') }}>別の譜面として投稿</Button>
    </div>}
    <form onSubmit={submit} className="space-y-3">
      <label className="block">制作者名<Input required maxLength={40} value={creatorName} onChange={event => setCreatorName(event.target.value)} /></label>
      <label className="block">曲名<Input required maxLength={200} value={submittedTitle || title} onChange={event => setSubmittedTitle(event.target.value)} /></label>
      <label className="block">アーティスト<Input maxLength={200} value={artist} onChange={event => setArtist(event.target.value)} /></label>
      <label className="block">難易度<Input maxLength={4} placeholder="5+ / - / ?（空欄可）" value={level} onChange={event => setLevel(event.target.value)} /></label>
      <SubmissionTurnstile key={challenge} onToken={setToken} />
      <Button type="submit" disabled={!canSubmit}>{busy ? '処理中…' : version === null ? '承認を申請する' : '現在の内容で再申請する'}</Button>
    </form>
    {message && <p role="status" className="text-sm">{message}</p>}
    {editUrl && <label className="block text-sm">編集URL（他人に共有しないでください）<Input readOnly value={editUrl} onFocus={event => event.target.select()} /><span>このURLを知る人は編集できます。紛失すると自分での編集はできません。</span></label>}
  </section>
}
