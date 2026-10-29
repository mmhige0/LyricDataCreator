'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { getSubmissionKeys, type SubmissionCredentials } from '@/lib/submissions/client'
import { PORTAL_ORIGIN } from '@/lib/site'

export default function SubmissionsPage() {
  const [keys, setKeys] = useState<SubmissionCredentials[]>([])
  useEffect(() => { setKeys(getSubmissionKeys()) }, [])
  return <div className="min-h-screen page-shell">
    <AppHeader title="Song Typing Theater" titleHref={PORTAL_ORIGIN} />
    <main className="max-w-3xl mx-auto p-6 space-y-5">
      <h1 className="text-2xl font-semibold">自分の投稿</h1>
      <p>このブラウザに編集用キーが保存されている譜面です。別の端末では、控えておいた編集URLを開いてください。</p>
      <Link className="underline" href="/editor">新しい譜面を作る</Link>
      {!keys.length && <p>保存されている投稿はありません。</p>}
      <ul className="space-y-3">{keys.map(row => <li key={row.id} className="rounded-xl border bg-card text-card-foreground shadow-sm p-4">
        <Link className="underline" href={`/editor?submission=${row.id}`}>{row.title || '投稿した譜面'}</Link>
      </li>)}</ul>
    </main>
  </div>
}
