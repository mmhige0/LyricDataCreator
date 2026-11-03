'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import useSWR from 'swr'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TypingGameContent } from '@/components/TypingGameContent'
import { SONG_INPUT_LIMITS } from '@/lib/songInputLimits'
import { parseScoreTxt } from '@/lib/scoreFormat'
import { submissionFetch } from '@/lib/submissions/client'
import type { Registration } from '@/lib/submissions/registration'
import { PORTAL_ORIGIN } from '@/lib/site'

type Summary = { id: string; title: string; artist: string | null; creatorName: string; status: string; revision: number; gameSongId: string | null; level: string | null; duplicateCount?: number }
type Submission = Summary & { youtubeUrl: string; txtContent: string; notes: string }
type Collision = { gameSongId: string; rankingSong: Registration | null; publicSong: Registration | null; otherSubmissions: { id: string; title: string; status: string }[] }
const states: Record<string, string> = { pending: '承認待ち', publishing: '登録処理中', rejected: '却下' }
const empty: Registration = { gameSongId: '', title: '', artist: '', level: '' }
const cell = 'px-3 py-3 text-left align-top'

export default function AdminSubmissionsPage() {
  const [key, setKey] = useState('')
  const [rows, setRows] = useState<Summary[]>([])
  const [tableAction, setTableAction] = useState<{ kind: 'register' | 'delete'; row: Summary } | null>(null)
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
      ? [`/api/admin/ranking-song?gameSongId=${lookupNumber}&submissionId=${selected.id}&revision=${selected.revision}`, key] : null,
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
  const list = async (nextPage = 1) => {
    const params = new URLSearchParams({ page: String(nextPage), q: search })
    if (status) params.set('status', status)
    const result = await submissionFetch(`/api/admin/submissions?${params}`, key)
    setRows(result.submissions ?? []); setPage(nextPage); setHasNext(result.hasNext); setLoaded(true)
  }
  const adopt = (row: Submission) => {
    setSelected(row); setAllowOverwrite(false); setPreview(false)
    setRegistration({ gameSongId: row.gameSongId ?? '', title: row.title, artist: row.artist ?? '', level: row.level ?? '' })
  }
  const open = async (id: string) => adopt(await submissionFetch(`/api/admin/submissions/${id}`, key))
  const save = async () => {
    if (!selected) return
    const row = await submissionFetch(`/api/admin/submissions/${selected.id}`, key, {
      method: 'POST', body: JSON.stringify({ action: 'save', revision: selected.revision, registration }),
    })
    adopt(row); await list(page); setMessage('LDCの申請に変更を保存しました。ランキングにはまだ登録していません。')
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
      <h1 className="text-2xl font-semibold">歌詞データ・曲情報の管理</h1>
      <form className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4" onSubmit={event => { event.preventDefault(); void run(() => list()) }}>
        <label className="block text-sm">管理用キー<Input type="password" autoComplete="off" value={key} onChange={event => { setKey(event.target.value); setRows([]); setSelected(null); setLoaded(false) }} /></label>
        <Button disabled={busy || !key}>一覧を読み込む</Button>
      </form>
      <Link className="inline-block text-sm underline" href="/songs">公開曲一覧を開く</Link>
      <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); void run(() => list()) }}>
        <label className="block flex-1 text-sm">曲番号・曲名・アーティスト<Input value={search} onChange={event => setSearch(event.target.value)} /></label>
        <label className="block text-sm">状態<select className="block h-10 rounded-md border bg-background px-3" value={status} onChange={event => setStatus(event.target.value)}>
          <option value="">すべて</option><option value="pending">承認待ち</option><option value="publishing">登録処理中</option><option value="rejected">却下</option>
        </select></label>
        <Button variant="outline" disabled={busy || !key}>検索</Button>
      </form>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="border-b bg-muted"><tr>{['曲番号', '曲名', 'アーティスト', '難易度', '投稿者名', '状態', '操作'].map(label => <th key={label} scope="col" className={cell}>{label}</th>)}</tr></thead>
          <tbody>
            {rows.map(row => <tr key={row.id} className={`border-b last:border-0 ${selected?.id === row.id ? 'bg-muted/60' : ''}`}>
              <td className={cell}>{row.gameSongId ?? '未設定'}{Boolean(row.duplicateCount) && <span className="mt-1 block text-xs text-destructive">同じ曲番号の申請が他に{row.duplicateCount}件</span>}</td>
              <td className={cell}>{row.title}</td><td className={cell}>{row.artist || '—'}</td>
              <td className={cell}>{row.level || '—'}</td><td className={cell}>{row.creatorName}</td><td className={`${cell} whitespace-nowrap`}>{states[row.status]}</td>
              <td className={cell}><div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(() => open(row.id))}>確認・編集</Button>
                <Button size="sm" disabled={busy || !row.gameSongId || !['pending', 'publishing'].includes(row.status)} onClick={() => setTableAction({ kind: 'register', row })}>{row.status === 'publishing' ? '登録を再試行' : 'ランキングに登録'}</Button>
                <Button size="sm" variant="outline" disabled={busy || row.status === 'publishing'} onClick={() => setTableAction({ kind: 'delete', row })}>削除</Button>
              </div></td>
            </tr>)}
            {loaded && !rows.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">該当する曲はありません。</td></tr>}
          </tbody>
        </table>
      </div>
      {loaded && <div className="flex items-center justify-end gap-3"><Button variant="outline" size="sm" disabled={busy || page <= 1} onClick={() => void run(() => list(page - 1))}>前へ</Button><span className="text-sm">{page}ページ</span><Button variant="outline" size="sm" disabled={busy || !hasNext} onClick={() => void run(() => list(page + 1))}>次へ</Button></div>}
      {selected && <section className="space-y-5 rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold">{selected.title}</h2><p className="text-sm text-muted-foreground">{selected.creatorName} · {states[selected.status]}</p></div><Button variant="ghost" disabled={busy} onClick={() => setSelected(null)}>閉じる</Button></div>
        <p className="whitespace-pre-wrap break-words text-sm">{selected.notes || '補足情報はありません。'}</p>
        <p className="break-all text-sm">{selected.youtubeUrl}</p>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={download}>TXTをダウンロード</Button><Button variant="outline" onClick={() => setPreview(!preview)}>プレビュー{preview ? 'を閉じる' : 'を開く'}</Button></div>
        {preview && parsed && <TypingGameContent onClose={() => setPreview(false)} showHeader={false} scoreEntries={parsed.scoreEntries} songTitle={selected.title} youtubeUrl={selected.youtubeUrl} totalDuration={parsed.duration} />}
        <details><summary>歌詞データの全文</summary><pre className="max-h-96 overflow-auto whitespace-pre-wrap text-sm">{selected.txtContent}</pre></details>
        <form className="space-y-4 border-t pt-5" onSubmit={event => { event.preventDefault(); void run(save) }}>
          <h3 className="font-semibold">曲情報を編集してランキングに登録</h3>
          <fieldset disabled={busy || publishing} className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">曲番号<Input inputMode="numeric" maxLength={8} value={registration.gameSongId} onChange={event => { setAllowOverwrite(false); setRegistration({ ...registration, gameSongId: event.target.value }) }} /></label>
            <label className="block text-sm">難易度<Input maxLength={4} placeholder="5+ / - / ?" value={registration.level ?? ''} onChange={event => setRegistration({ ...registration, level: event.target.value })} /></label>
            <label className="block text-sm">曲名<Input required maxLength={SONG_INPUT_LIMITS.title} value={registration.title} onChange={event => setRegistration({ ...registration, title: event.target.value })} /></label>
            <label className="block text-sm">アーティスト<Input maxLength={SONG_INPUT_LIMITS.artist} value={registration.artist ?? ''} onChange={event => setRegistration({ ...registration, artist: event.target.value })} /></label>
          </fieldset>
          {checked && collision?.otherSubmissions?.length ? <p role="alert" className="text-sm text-destructive">同じ曲番号の申請が他に{collision.otherSubmissions.length}件あります。登録する申請を確認してください。</p> : null}
          {publishing ? <p className="text-sm">登録結果の確認・再試行中は登録情報を変更できません。</p> : <div className="space-y-2 rounded-md bg-muted p-3 text-sm" aria-live="polite">
            {!validNumber ? <p>曲番号を3〜8桁で入力してください。先頭のゼロも保持します。</p> : checkError ? <><p>{checkError.message}</p><Button type="button" size="sm" variant="outline" onClick={() => void recheck()}>再確認</Button></> : !checked ? <p>曲番号を確認中…</p> : existing ? <>
              <p className="font-medium">この曲番号は登録済みです。</p>
              <p>{existing.gameSongId} · {existing.title} · {existing.artist || 'アーティスト未設定'} · 難易度 {existing.level || '未設定'}</p>
              <Button type="button" size="sm" variant="outline" onClick={() => setRegistration(existing)}>既存曲の情報を入力</Button>
              <label className="flex items-center gap-2"><input type="checkbox" checked={allowOverwrite} onChange={event => setAllowOverwrite(event.target.checked)} />この既存曲を更新する</label>
            </> : <p>ランキング・LDCとも、この曲番号は未登録です。</p>}
          </div>}
          <div className="space-y-1 text-sm text-muted-foreground">
            <p>曲情報と曲番号はどちらからでも設定できます。曲番号が未定でも変更を保存できます。</p>
            <p>変更を保存：LDCの申請内容を更新します。</p>
            <p>ランキングに登録：ランキング登録後、LDCの公開曲を追加・更新し、申請を削除します。ゲームへの反映は別途必要です。</p>
          </div>
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
      {tableAction && <TableActionDialog key={`${tableAction.kind}:${tableAction.row.id}`} row={tableAction.row} kind={tableAction.kind} adminKey={key}
        onClose={() => setTableAction(null)} onDone={id => {
          const kind = tableAction.kind
          setTableAction(null); if (selected?.id === id) setSelected(null)
          void run(async () => { await list(page); setMessage(kind === 'delete' ? '申請を削除しました。' : 'ランキングへの登録とLDCへの公開が完了しました。') })
        }} />}
      {message && <p role="status" className="text-sm">{message}</p>}
    </main>
  </div>
}

function TableActionDialog({ row, kind, adminKey, onClose, onDone }: {
  row: Summary; kind: 'register' | 'delete'; adminKey: string; onClose: () => void; onDone: (id: string) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [current, setCurrent] = useState(row)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [overwrite, setOverwrite] = useState(false)
  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])
  const publishing = current.status === 'publishing'
  const { data, error, isLoading, mutate } = useSWR<Collision>(
    kind === 'register' && !publishing && current.gameSongId
      ? [`/api/admin/ranking-song?gameSongId=${current.gameSongId}&submissionId=${current.id}&revision=${current.revision}`, adminKey] : null,
    ([url, secret]: [string, string]) => submissionFetch(url, secret),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  )
  const existing = data?.rankingSong ?? data?.publicSong
  const ready = publishing || (current.status === 'pending' && !isLoading && !error && data?.gameSongId === current.gameSongId && (!existing || overwrite))
  const execute = async () => {
    setBusy(true); setMessage('')
    try {
      await submissionFetch(`/api/admin/submissions/${current.id}`, adminKey, {
        method: kind === 'delete' ? 'DELETE' : 'POST',
        body: JSON.stringify(kind === 'delete' ? { revision: current.revision } : {
          action: 'approve', revision: current.revision, allowOverwrite: overwrite,
          registration: { gameSongId: current.gameSongId, title: current.title, artist: current.artist, level: current.level },
        }),
      })
      onDone(current.id)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '処理に失敗しました。')
      if (kind === 'register') {
        try { setCurrent({ ...current, ...await submissionFetch(`/api/admin/submissions/${current.id}`, adminKey) }) } catch { /* Preserve the original error. */ }
      }
    } finally { setBusy(false) }
  }
  return <dialog ref={dialog} aria-labelledby="table-action-heading" onCancel={event => { event.preventDefault(); if (!busy) onClose() }}
    className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-lg max-h-[90dvh] overflow-y-auto rounded-xl border bg-card p-5 text-card-foreground shadow-xl backdrop:bg-black/50">
    <div className="space-y-4">
      <h2 id="table-action-heading" className="text-lg font-semibold">{kind === 'delete' ? '申請を削除しますか？' : publishing ? '同じ内容で登録を再試行' : '保存済みの内容でランキングに登録'}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm"><dt>曲番号</dt><dd>{current.gameSongId || '未設定'}</dd><dt>曲名</dt><dd>{current.title}</dd><dt>アーティスト</dt><dd>{current.artist || '未入力'}</dd><dt>難易度</dt><dd>{current.level || '未入力'}</dd></dl>
      {kind === 'delete' ? <p className="text-sm">この申請と編集用リンクを削除します。この操作は取り消せません。</p> : <>
        <p className="text-sm">ランキング登録後、LDCの公開曲を追加・更新し、申請を削除します。ゲームへの反映は別途必要です。</p>
        {Boolean(current.duplicateCount || data?.otherSubmissions?.length) && <p role="alert" className="text-sm text-destructive">同じ曲番号の申請が他にもあります。登録する申請を確認してください。</p>}
        {publishing ? <p className="text-sm">登録処理中に保存した内容で再試行します。</p> : error ? <><p className="text-sm">{error.message}</p><Button variant="outline" size="sm" onClick={() => void mutate()}>再確認</Button></> : !data || isLoading ? <p className="text-sm">曲番号を確認中…</p> : existing ? <div className="space-y-2 text-sm"><p>この曲番号は登録済みです：{existing.title} / {existing.artist || '未入力'} / {existing.level || '未入力'}</p><label className="flex items-center gap-2"><input type="checkbox" checked={overwrite} onChange={event => setOverwrite(event.target.checked)} />この既存曲を更新する</label></div> : <p className="text-sm">ランキング・LDCとも、この曲番号は未登録です。</p>}
      </>}
      {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>キャンセル</Button><Button disabled={busy || (kind === 'register' ? !ready : publishing)} onClick={() => void execute()}>{busy ? '処理中…' : kind === 'delete' ? '削除する' : '登録する'}</Button></div>
    </div>
  </dialog>
}
