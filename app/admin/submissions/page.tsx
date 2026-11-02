'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TypingGameContent } from '@/components/TypingGameContent'
import { parseScoreTxt } from '@/lib/scoreFormat'
import { submissionFetch } from '@/lib/submissions/client'
import type { Registration } from '@/lib/submissions/registration'
import { PORTAL_ORIGIN } from '@/lib/site'

type Summary = { id: string; title: string; artist: string | null; creatorName: string; status: string; revision: number; gameSongId: string | null; level: string | null }
type Submission = Summary & { youtubeUrl: string; txtContent: string; notes: string }
type Published = Registration & { creatorName: string | null }
type Collision = { gameSongId: string; rankingSong: Registration | null; publicSong: Registration | null }
const states: Record<string, string> = { pending: '承認待ち', publishing: '登録処理中', rejected: '却下' }
const empty: Registration = { gameSongId: '', title: '', artist: '', level: '' }
const cell = 'px-3 py-3 text-left align-top'

export default function AdminSubmissionsPage() {
  const [key, setKey] = useState('')
  const [rows, setRows] = useState<Summary[]>([])
  const [songs, setSongs] = useState<Published[]>([])
  const [view, setView] = useState<'submissions' | 'published'>('submissions')
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('pending')
  const [loaded, setLoaded] = useState(false)
  const [selected, setSelected] = useState<Submission | null>(null)
  const [registration, setRegistration] = useState<Registration>(empty)
  const [lookupNumber, setLookupNumber] = useState('')
  const [allowOverwrite, setAllowOverwrite] = useState(false)
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setLookupNumber(registration.gameSongId), 400)
    return () => clearTimeout(timer)
  }, [registration.gameSongId])
  const validNumber = /^(?!000$)[0-9]{3,8}$/.test(registration.gameSongId)
  const { data: collision, error: checkError, isLoading: checking, mutate: recheck } = useSWR<Collision>(
    selected && selected.status !== 'publishing' && key && validNumber && lookupNumber === registration.gameSongId
      ? [`/api/admin/ranking-song?gameSongId=${lookupNumber}`, key] : null,
    ([url, secret]: [string, string]) => submissionFetch(url, secret),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  )
  const checked = !checkError && !checking && collision?.gameSongId === registration.gameSongId
  const existing = checked ? collision?.rankingSong ?? collision?.publicSong : null
  const publishing = selected?.status === 'publishing'
  const canApprove = selected?.status === 'pending' && registration.title.trim() && checked && (!existing || allowOverwrite)
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('')
    try { await action() }
    catch (error) { setMessage(error instanceof Error ? error.message : '処理に失敗しました。') }
    finally { setBusy(false) }
  }
  const list = async (nextPage = 1, nextView = view) => {
    const params = new URLSearchParams({ view: nextView, page: String(nextPage), q: search })
    if (nextView === 'submissions' && status) params.set('status', status)
    const result = await submissionFetch(`/api/admin/submissions?${params}`, key)
    setRows(result.submissions ?? []); setSongs(result.songs ?? []); setPage(nextPage); setHasNext(result.hasNext); setLoaded(true)
  }
  const adopt = (row: Submission) => {
    setSelected(row); setAllowOverwrite(false); setPreview(false)
    setRegistration({ gameSongId: row.gameSongId ?? '', title: row.title, artist: row.artist ?? '', level: row.level ?? '' })
  }
  const open = async (id: string) => adopt(await submissionFetch(`/api/admin/submissions/${id}`, key))
  const changeView = (next: typeof view) => {
    setView(next); setSelected(null); setLoaded(false); setRows([]); setSongs([])
    if (key) void run(() => list(1, next))
  }
  const save = async () => {
    if (!selected) return
    const row = await submissionFetch(`/api/admin/submissions/${selected.id}`, key, {
      method: 'POST', body: JSON.stringify({ action: 'save', revision: selected.revision, registration }),
    })
    adopt(row); await list(page); setMessage('変更を保存しました。まだランキングには反映していません。')
  }
  const decide = async (action: 'approve' | 'reject' | 'restore') => {
    if (!selected) return
    try {
      const result = await submissionFetch(`/api/admin/submissions/${selected.id}`, key, {
        method: 'POST', body: JSON.stringify({ action, revision: selected.revision, registration, allowOverwrite }),
      })
      if (action === 'approve') setSelected(null)
      else adopt(result)
      await list(page)
      setMessage(action === 'approve' ? 'ランキングへの登録とLDCへの公開が完了しました。ゲームへの反映は別途行ってください。' : action === 'restore' ? '承認待ちに戻しました。' : '申請を却下しました。')
    } catch (error) {
      // A committed reservation survives a failed ranking call. Display its immutable fields.
      try {
        const current = await submissionFetch(`/api/admin/submissions/${selected.id}`, key)
        if (current.status === 'publishing') adopt(current)
      } catch { /* Keep the original error and the current form. */ }
      throw error
    }
  }
  const resend = async () => {
    if (!selected) return
    const result = await submissionFetch(`/api/admin/submissions/${selected.id}`, key, { method: 'POST', body: JSON.stringify({ action: 'notify', revision: selected.revision }) })
    setMessage(result.discordNotification === 'sent' ? 'Discordへ送信しました。' : result.discordNotification === 'skipped' ? 'DiscordのWebhookが未設定です。' : 'Discordへ送信できませんでした。設定を確認して再試行してください。')
  }
  const download = () => {
    if (!selected) return
    const url = URL.createObjectURL(new Blob([selected.txtContent], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = 'chart.txt'; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const parsed = selected ? parseScoreTxt(selected.txtContent) : null
  return <div className="min-h-screen page-shell">
    <AppHeader title="Song Typing Theater" titleHref={PORTAL_ORIGIN} />
    <main className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 [overflow-wrap:anywhere]">
      <h1 className="text-2xl font-semibold">譜面・曲情報の管理</h1>
      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4" onSubmit={event => { event.preventDefault(); void run(() => list()) }}>
        <label className="block text-sm">管理用キー<Input type="password" autoComplete="off" value={key} onChange={event => { setKey(event.target.value); setRows([]); setSongs([]); setSelected(null); setLoaded(false) }} /></label>
        <Button disabled={busy || !key}>一覧を読み込む</Button>
      </form>
      <div className="flex gap-2" aria-label="表示する一覧">
        <Button variant={view === 'submissions' ? 'default' : 'outline'} disabled={busy} onClick={() => changeView('submissions')}>申請</Button>
        <Button variant={view === 'published' ? 'default' : 'outline'} disabled={busy} onClick={() => changeView('published')}>公開済み</Button>
      </div>
      <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); void run(() => list()) }}>
        <label className="block flex-1 text-sm">曲番号・曲名・アーティスト<Input value={search} onChange={event => setSearch(event.target.value)} /></label>
        {view === 'submissions' && <label className="block text-sm">状態<select className="block h-10 rounded-md border bg-background px-3" value={status} onChange={event => setStatus(event.target.value)}>
          <option value="">すべて</option><option value="pending">承認待ち</option><option value="publishing">登録処理中</option><option value="rejected">却下</option>
        </select></label>}
        <Button variant="outline" disabled={busy || !key}>検索</Button>
      </form>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-muted"><tr>{['曲番号', '曲名', 'アーティスト', '難易度', '制作者', '状態', '操作'].map(label => <th key={label} scope="col" className={cell}>{label}</th>)}</tr></thead>
          <tbody>
            {view === 'submissions' ? rows.map(row => <tr key={row.id} className={`border-b last:border-0 ${selected?.id === row.id ? 'bg-muted/60' : ''}`}>
              <td className={cell}>{row.gameSongId ?? '未設定'}</td>
              <td className={cell}>{row.title}</td><td className={cell}>{row.artist || '—'}</td>
              <td className={cell}>{row.level || '—'}</td><td className={cell}>{row.creatorName}</td><td className={`${cell} whitespace-nowrap`}>{states[row.status]}</td>
              <td className={cell}><Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => open(row.id))}>確認・編集</Button></td>
            </tr>) : songs.map(song => <tr key={song.gameSongId} className="border-b last:border-0">
              <td className={cell}>{song.gameSongId}</td><td className={cell}>{song.title}</td><td className={cell}>{song.artist || '—'}</td><td className={cell}>{song.level || '—'}</td><td className={cell}>{song.creatorName || '—'}</td><td className={`${cell} whitespace-nowrap`}>公開済み</td>
              <td className={`${cell} whitespace-nowrap`}><Link className="underline" href={`/songs/${song.gameSongId}`}>開く</Link><Link className="ml-3 underline" href={`/editor?song=${song.gameSongId}`}>修正する</Link></td>
            </tr>)}
            {loaded && !(view === 'submissions' ? rows.length : songs.length) && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">該当する曲はありません。</td></tr>}
          </tbody>
        </table>
      </div>
      {loaded && <div className="flex items-center justify-end gap-3"><Button variant="outline" size="sm" disabled={busy || page <= 1} onClick={() => void run(() => list(page - 1))}>前へ</Button><span className="text-sm">{page}ページ</span><Button variant="outline" size="sm" disabled={busy || !hasNext} onClick={() => void run(() => list(page + 1))}>次へ</Button></div>}
      {selected && <section className="space-y-5 rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{selected.title}</h2><p className="text-sm text-muted-foreground">{selected.creatorName} · {states[selected.status]}</p></div><Button variant="ghost" disabled={busy} onClick={() => setSelected(null)}>閉じる</Button></div>
        <p className="whitespace-pre-wrap break-words text-sm">{selected.notes || '補足情報はありません。'}</p>
        <p className="break-all text-sm">{selected.youtubeUrl}</p>
        <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void run(resend)}>Discordへ再送</Button><Button variant="outline" onClick={download}>TXTをダウンロード</Button><Button variant="outline" onClick={() => setPreview(!preview)}>プレビュー{preview ? 'を閉じる' : 'を開く'}</Button></div>
        {preview && parsed && <TypingGameContent onClose={() => setPreview(false)} showHeader={false} scoreEntries={parsed.scoreEntries} songTitle={selected.title} youtubeUrl={selected.youtubeUrl} totalDuration={parsed.duration} />}
        <details><summary>譜面の全文</summary><pre className="max-h-96 overflow-auto whitespace-pre-wrap text-sm">{selected.txtContent}</pre></details>
        <form className="space-y-4 border-t pt-5" onSubmit={event => { event.preventDefault(); void run(save) }}>
          <h3 className="font-semibold">曲情報を編集してランキングに登録</h3>
          <fieldset disabled={busy || publishing} className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">曲番号<Input inputMode="numeric" maxLength={8} value={registration.gameSongId} onChange={event => { setAllowOverwrite(false); setRegistration({ ...registration, gameSongId: event.target.value }) }} /></label>
            <label className="block text-sm">難易度<Input maxLength={4} placeholder="5+ / - / ?" value={registration.level ?? ''} onChange={event => setRegistration({ ...registration, level: event.target.value })} /></label>
            <label className="block text-sm">曲名<Input required maxLength={200} value={registration.title} onChange={event => setRegistration({ ...registration, title: event.target.value })} /></label>
            <label className="block text-sm">アーティスト<Input maxLength={200} value={registration.artist ?? ''} onChange={event => setRegistration({ ...registration, artist: event.target.value })} /></label>
          </fieldset>
          {publishing ? <p className="text-sm">登録結果の確認・再試行中は登録情報を変更できません。</p> : <div className="space-y-2 rounded-md bg-muted p-3 text-sm" aria-live="polite">
            {!validNumber ? <p>曲番号を3〜8桁で入力してください。先頭のゼロも保持します。</p> : checkError ? <><p>{checkError.message}</p><Button type="button" size="sm" variant="outline" onClick={() => void recheck()}>再確認</Button></> : !checked ? <p>曲番号を確認中…</p> : existing ? <>
              <p className="font-medium">この曲番号は登録済みです。</p>
              <p>{existing.gameSongId} · {existing.title} · {existing.artist || 'アーティスト未設定'} · 難易度 {existing.level || '未設定'}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => setRegistration(existing)}>既存曲の情報を入力</Button>
              <label className="flex items-center gap-2"><input type="checkbox" checked={allowOverwrite} onChange={event => setAllowOverwrite(event.target.checked)} />この既存曲を更新する</label>
            </> : <p>ランキング・LDCとも、この曲番号は未登録です。</p>}
          </div>}
          <p className="text-sm text-muted-foreground">曲情報と曲番号はどちらからでも設定できます。曲番号が未定でも変更を保存できます。</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="outline" disabled={busy || publishing || (!validNumber && registration.gameSongId !== '')}>変更を保存</Button>
            <Button type="button" disabled={busy || !(publishing || canApprove)} onClick={() => void run(() => decide('approve'))}>{publishing ? '同じ内容で登録を再試行' : 'ランキングに登録'}</Button>
            {selected.status === 'rejected'
              ? <Button type="button" variant="outline" disabled={busy} onClick={() => void run(() => decide('restore'))}>承認待ちに戻す</Button>
              : <Button type="button" variant="outline" disabled={busy || selected.status !== 'pending'} onClick={() => void run(() => decide('reject'))}>却下する</Button>}
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void run(() => open(selected.id))}>再読み込み</Button>
          </div>
        </form>
      </section>}
      {message && <p role="status" className="text-sm">{message}</p>}
    </main>
  </div>
}
