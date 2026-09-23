import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function TimestampOffsetControl({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  const commit = () => {
    const number = Number(draft)
    if (draft?.trim() && Number.isFinite(number)) onChange(Math.round(Math.max(-2, Math.min(2, number)) * 100) / 100)
    setDraft(null)
  }
  return <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-sm">
    <label htmlFor="timestamp-offset">タイムスタンプ入力の補正</label>
    <Input id="timestamp-offset" type="number" min="-2" max="2" step="0.01" className="h-8 w-24 font-mono"
      value={draft ?? value.toFixed(2)} onChange={event => setDraft(event.target.value)} onBlur={commit}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
        if (event.key === 'Escape') { event.preventDefault(); setDraft(null) }
      }} />
    <span className="text-muted-foreground">秒</span>
    <Button variant="ghost" size="sm" disabled={value === 0 && draft === null} onClick={() => { setDraft(null); onChange(0) }}>リセット</Button>
  </div>
}
