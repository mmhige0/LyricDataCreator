import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DEFAULT_TIMESTAMP_OFFSET } from '@/lib/timestampCapture'
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
  const adjust = (delta: number) => {
    setDraft(null)
    onChange(Math.round(Math.max(-2, Math.min(2, value + delta)) * 100) / 100)
  }
  return <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-sm">
    <label htmlFor="timestamp-offset">タイムスタンプ入力の補正</label>
    <Button variant="outline" size="sm" className="size-8 p-0" aria-label="入力補正を0.01秒減らす" disabled={value <= -2} onClick={() => adjust(-0.01)}><ChevronLeft className="size-4" /></Button>
    <Input id="timestamp-offset" type="number" min="-2" max="2" step="0.01" className="h-8 w-20 px-2 text-center font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      value={draft ?? value.toFixed(2)} onChange={event => setDraft(event.target.value)} onBlur={commit}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return
        if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
        if (event.key === 'Escape') { event.preventDefault(); setDraft(null) }
      }} />
    <Button variant="outline" size="sm" className="size-8 p-0" aria-label="入力補正を0.01秒増やす" disabled={value >= 2} onClick={() => adjust(0.01)}><ChevronRight className="size-4" /></Button>
    <span className="text-muted-foreground">秒</span>
    <Button variant="ghost" size="sm" disabled={value === DEFAULT_TIMESTAMP_OFFSET && draft === null} onClick={() => { setDraft(null); onChange(DEFAULT_TIMESTAMP_OFFSET) }}>リセット</Button>
  </div>
}
