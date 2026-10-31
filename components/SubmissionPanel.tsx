'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SubmissionTurnstile } from './SubmissionTurnstile'
import { createScoreTxt, parseScoreTxt } from '@/lib/scoreFormat'
import { getSubmissionKeys, newSubmissionKey, saveSubmissionKey, statusLabel, submissionFetch, type SubmissionCredentials } from '@/lib/submissions/client'
import type { CentralPop, ScoreEntry } from '@/lib/types'

type LoadedSubmission = { title: string; youtubeUrl: string; duration: number; scoreEntries: ScoreEntry[]; centralPops: CentralPop[] }
type Props = LoadedSubmission & { onLoad: (data: LoadedSubmission) => void }

export function SubmissionPanel({ title, youtubeUrl, duration, scoreEntries, centralPops, onLoad }: Props) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [reloadOffered, setReloadOffered] = useState(false)
  const [success, setSuccess] = useState(false)
  const [gameSongId, setGameSongId] = useState<string | null>(null)
  const [sourceSong, setSourceSong] = useState<string | null>(null)
  const [submittedYoutubeUrl, setSubmittedYoutubeUrl] = useState<string | null>(null)
  useEffect(() => {
    if (open) dialog.current?.showModal()
    else dialog.current?.close()
  }, [open])
  const close = () => { setOpen(false); setToken('') }
  const [credentials, setCredentials] = useState<SubmissionCredentials | null>(null)
  const [creatorName, setCreatorName] = useState('')
  const [submittedTitle, setSubmittedTitle] = useState<string | null>(null)
  const [artist, setArtist] = useState('')
  const [notes, setNotes] = useState('')
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
    const song = new URLSearchParams(location.search).get('song')
    if (song && !id) { setSourceSong(song); setNeedsLoad(true); setOpen(true) }
    if (!id) return
    setOpen(true); setNeedsLoad(true)
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
    if (!credentials && !sourceSong) return
    setBusy(true)
    try {
      const row = credentials
        ? await submissionFetch(`/api/submissions/${credentials.id}`, credentials.token)
        : await submissionFetch(`/api/songs/${encodeURIComponent(sourceSong!)}/edit`, '')
      const parsed = parseScoreTxt(row.txtContent)
      onLoad({ title: row.title, youtubeUrl: row.youtubeUrl, ...parsed })
      setSubmittedTitle(row.title); setCreatorName(row.creatorName); setArtist(row.artist ?? ''); setNotes(row.notes ?? '')
      setSubmittedYoutubeUrl(row.youtubeUrl); setGameSongId(row.gameSongId ?? null)
      setVersion(row.revision ?? null); setStatus(row.status ?? ''); setNeedsLoad(false)
      setMessage(''); setReloadOffered(false); setOpen(false)
    } catch (error) { setMessage(error instanceof Error ? error.message : '読み込めませんでした。') }
    finally { setBusy(false) }
  }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (needsLoad) { setMessage('先に投稿内容を読み込んでください。'); return }
    setBusy(true); setMessage(''); setSuccess(false)
    try {
      const txtContent = createScoreTxt(duration, scoreEntries, centralPops)
      const name = (submittedTitle ?? title).trim()
      const key = credentials ?? newSubmissionKey(name)
      // Persist before sending, so a lost response never loses edit access.
      saveSubmissionKey({ ...key, title: name })
      setCredentials(key)
      const row = await submissionFetch(`/api/submissions${version === null ? '' : `/${key.id}`}`, key.token, {
        method: version === null ? 'POST' : 'PUT',
        body: JSON.stringify({ id: key.id, revision: version, title: name, creatorName, artist, notes, youtubeUrl: submittedYoutubeUrl ?? youtubeUrl, gameSongId, txtContent, turnstileToken: token }),
      })
      setVersion(row.revision); setStatus(row.status); setNeedsLoad(false)
      history.replaceState(null, '', `/editor?submission=${key.id}`)
      setSuccess(true)
      setMessage(row.discordNotification === 'failed'
        ? '申請を受け付けました。Discordへの通知は失敗しましたが、申請は保存されています。'
        : '申請を受け付けました。承認後に公開されます。')
    } catch (error) {
      const message = error instanceof Error ? error.message : '投稿に失敗しました。'
      setMessage(message); setReloadOffered(/読み込/.test(message))
    }
    finally { setBusy(false); setToken(''); setChallenge(value => value + 1) }
  }
  // For a failed initial create the same credentials can be retried without loading a nonexistent row.
  const canSubmit = Boolean(token) && !busy && status !== 'publishing' && !needsLoad
  return <>
    <Button type="button" size="sm" onClick={() => setOpen(true)}>
      {credentials ? '申請内容を確認' : gameSongId ? '変更を申請する' : '投稿する'}
    </Button>
    <dialog ref={dialog} aria-labelledby="submission-heading" aria-describedby="submission-description"
      onCancel={event => { event.preventDefault(); close() }} onClose={close}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50">
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="submission-heading" className="text-lg font-semibold">{success ? '申請を受け付けました' : credentials ? '申請内容の確認' : gameSongId ? '公開曲の修正を申請' : '譜面を投稿'}</h2>
          <Button type="button" variant="ghost" size="sm" onClick={close}>閉じる</Button>
        </div>
        <p id="submission-description" className="text-sm text-muted-foreground">ログイン不要。申請した譜面は、管理者の承認後に公開されます。</p>
        {needsLoad ? <div className="space-y-3">
          <p className="text-sm">{sourceSong ? `曲番 ${sourceSong} の譜面を読み込んで編集します。` : '申請中の譜面を読み込んで編集します。'}現在のエディターの内容は置き換わります。</p>
          <Button type="button" disabled={busy} onClick={() => void load()}>{busy ? '読み込み中…' : '編集を始める'}</Button>
        </div> : success ? <p className="text-sm">承認前の確認・修正には、下の編集用リンクを使ってください。</p> : <form onSubmit={submit} className="space-y-4">
          {gameSongId && <p className="rounded-md bg-muted p-3 text-sm">修正対象：曲番 {gameSongId}</p>}
          {status && <p className="text-sm">{statusLabel[status]}</p>}
          <fieldset disabled={busy || status === 'publishing'} className="space-y-4">
            <label className="block text-sm">曲名 <span className="ml-1 text-xs font-medium text-destructive">必須</span><Input required maxLength={200} value={submittedTitle ?? title} onChange={event => setSubmittedTitle(event.target.value)} /></label>
            <label className="block text-sm">アーティスト <span className="ml-1 text-xs text-muted-foreground">任意</span><Input maxLength={200} value={artist} onChange={event => setArtist(event.target.value)} /></label>
            <label className="block text-sm">YouTube URL <span className="ml-1 text-xs font-medium text-destructive">必須</span><Input required type="url" maxLength={500} value={submittedYoutubeUrl ?? youtubeUrl} onChange={event => setSubmittedYoutubeUrl(event.target.value)} /></label>
            <label className="block text-sm">制作者名 <span className="ml-1 text-xs font-medium text-destructive">必須</span><Input required maxLength={40} value={creatorName} onChange={event => setCreatorName(event.target.value)} /></label>
            <label className="block text-sm">補足情報 <span className="ml-1 text-xs text-muted-foreground">任意</span>
              <textarea maxLength={2000} rows={4} value={notes} onChange={event => setNotes(event.target.value)}
                placeholder="修正した箇所や、確認してほしいことなど"
                className="mt-1 flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
            </label>
            <p className="text-xs text-muted-foreground">補足情報は譜面と一緒に公開されます。</p>
          </fieldset>
          {open && status !== 'publishing' && <SubmissionTurnstile key={challenge} onToken={setToken} />}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={close}>編集に戻る</Button>
            <Button type="submit" disabled={!canSubmit}>{busy ? '送信中…' : version === null ? '申請する' : '変更を再申請'}</Button>
          </div>
        </form>}
        {message && <p role="status" className="text-sm">{message}</p>}
        {reloadOffered && !needsLoad && <Button type="button" variant="outline" onClick={() => setNeedsLoad(true)}>保存済みの申請を読み直す</Button>}
        {editUrl && <div className="space-y-2 border-t pt-4">
          <label className="block text-sm">編集用リンク<Input readOnly value={editUrl} onFocus={event => event.target.select()} /></label>
          <Button type="button" variant="outline" onClick={async () => {
            try { await navigator.clipboard.writeText(editUrl); setMessage('編集用リンクをコピーしました。') }
            catch { setMessage('コピーできませんでした。リンクを選択してコピーしてください。') }
          }}>編集用リンクをコピー</Button>
          <p className="text-xs text-muted-foreground">このリンクを知る人は申請を編集できます。大切に保管してください。承認後は使えなくなります。</p>
          {success && <Button type="button" variant="ghost" onClick={() => { setSuccess(false); setMessage('') }}>申請内容を確認・修正</Button>}
        </div>}
      </div>
    </dialog>
  </>
}
