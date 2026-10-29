'use client'

import { useState } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TypingGameContent } from '@/components/TypingGameContent'
import { parseScoreTxt } from '@/lib/scoreFormat'
import { statusLabel, submissionFetch } from '@/lib/submissions/client'
import { PORTAL_ORIGIN } from '@/lib/site'

type Summary = { id: string; title: string; creatorName: string; status: string; revision: number }
type Submission = Summary & { artist: string | null; level: string | null; youtubeUrl: string; txtContent: string; gameSongId: string | null; publishedSongId: number | null }

export default function AdminSubmissionsPage() {
  const [key, setKey] = useState('')
  const [rows, setRows] = useState<Summary[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [selected, setSelected] = useState<Submission | null>(null)
  const [gameSongId, setGameSongId] = useState('')
  const [preview, setPreview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('')
    try { await action() }
    catch (error) { setMessage(error instanceof Error ? error.message : '処理に失敗しました。') }
    finally { setBusy(false) }
  }
  const list = async (cursor?: string) => {
    const result = await submissionFetch(`/api/admin/submissions${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, key)
    setRows(result.submissions); setNextCursor(result.nextCursor)
  }
  const open = async (id: string) => {
    const row = await submissionFetch(`/api/admin/submissions/${id}`, key)
    setSelected(row); setGameSongId(row.gameSongId ?? ''); setPreview(false)
  }
  const decide = async (action: 'approve' | 'reject') => {
    if (!selected) return
    const result = await submissionFetch(`/api/admin/submissions/${selected.id}`, key, {
      method: 'POST', body: JSON.stringify({ action, revision: selected.revision, gameSongId }),
    })
    setSelected(action === 'approve' ? null : result); await list(); setMessage(action === 'approve' ? '承認・ランキング登録が完了しました。ゲームへの公開は別途行ってください。' : '却下しました。')
  }
  const download = () => {
    if (!selected) return
    const url = URL.createObjectURL(new Blob([selected.txtContent], { type: 'text/plain;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url; link.download = `chart-${selected.id}-v${selected.revision}.txt`; link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const parsed = selected ? parseScoreTxt(selected.txtContent) : null
  return <div className="min-h-screen page-shell">
    <AppHeader title="Song Typing Theater" titleHref={PORTAL_ORIGIN} />
    <main className="max-w-5xl mx-auto p-6 space-y-6 [overflow-wrap:anywhere]">
      <h1 className="text-2xl font-semibold">譜面の承認</h1>
      <form className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 space-y-3" onSubmit={event => { event.preventDefault(); void run(() => list()) }}>
        <label className="block">管理用キー<Input type="password" autoComplete="off" value={key} onChange={event => { setKey(event.target.value); setRows([]); setSelected(null) }} /></label>
        <p className="text-sm">キーはこの画面を閉じると消えます。</p>
        <Button disabled={busy || !key}>申請一覧を読み込む</Button>
      </form>
      <ul className="space-y-2">{rows.map(row => <li key={row.id} className="rounded-xl border bg-card text-card-foreground shadow-sm p-4 flex flex-wrap justify-between gap-3">
        <div>{row.title} ／ {row.creatorName} ／ 第{row.revision}版 ／ {statusLabel[row.status]}</div>
        <Button disabled={busy} variant="outline" onClick={() => void run(() => open(row.id))}>確認する</Button>
      </li>)}</ul>
      {nextCursor && <Button disabled={busy} onClick={() => void run(() => list(nextCursor))}>次の20件</Button>}
      {selected && <section className="rounded-xl border bg-card text-card-foreground shadow-sm p-5 space-y-4">
        <h2 className="text-xl">{selected.title}（第{selected.revision}版）</h2>
        <p>制作者：{selected.creatorName} ／ アーティスト：{selected.artist || '未指定'} ／ 難易度：{selected.level || '未指定'}</p>
        <p>{statusLabel[selected.status]}{selected.publishedSongId ? '・公開済み譜面の修正' : '・新規投稿'}</p>
        <p>{selected.youtubeUrl}</p>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={download}>TXTをダウンロード</Button>
          <Button variant="outline" onClick={() => setPreview(!preview)}>プレビュー{preview ? 'を閉じる' : 'を開く'}</Button>
        </div>
        {preview && parsed && <TypingGameContent onClose={() => setPreview(false)} showHeader={false} scoreEntries={parsed.scoreEntries} songTitle={selected.title} youtubeUrl={selected.youtubeUrl} totalDuration={parsed.duration} />}
        <details><summary>申請された譜面の全文</summary><pre className="overflow-auto max-h-96 whitespace-pre-wrap text-sm">{selected.txtContent}</pre></details>
        <label className="block">ゲームの曲番号<Input value={gameSongId} maxLength={8} inputMode="numeric" disabled={Boolean(selected.gameSongId)} onChange={event => setGameSongId(event.target.value)} /></label>
        <p className="text-sm">承認するとランキングへ登録し、LDCの公開版を切り替えます。公開済み曲の修正でも既存の成績は残ります。承認後は申請を削除し、編集URLは無効になります。</p>
        <div className="flex flex-wrap gap-3">
          <Button disabled={busy || !gameSongId || !['pending', 'publishing'].includes(selected.status)} onClick={() => void run(() => decide('approve'))}>第{selected.revision}版を承認する</Button>
          <Button variant="outline" disabled={busy || selected.status !== 'pending'} onClick={() => void run(() => decide('reject'))}>却下する</Button>
          <Button variant="ghost" disabled={busy} onClick={() => void run(() => open(selected.id))}>内容を再読み込み</Button>
        </div>
      </section>}
      {message && <p role="status">{message}</p>}
    </main>
  </div>
}
