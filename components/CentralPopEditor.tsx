import { useState, type ReactNode } from 'react'
import { Play, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CentralPop } from '@/lib/types'
import { normalizeDecoration } from '@/lib/decorationText'
import { POP_DURATIONS } from '@/lib/scoreFormat'

function PopTime({ pop, onChange }: { pop: CentralPop; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<{ base: number; value: string } | null>(null)
  const [invalid, setInvalid] = useState(false)
  if (draft && draft.base !== pop.timestamp) { setDraft(null); setInvalid(false) }
  return <Input aria-label="ポップ開始時刻（秒）" title="開始時刻（秒）" aria-invalid={invalid} type="number" min="0" step="0.01" className="h-8 w-20 shrink-0 text-xs" value={draft?.value ?? pop.timestamp.toFixed(2)}
    onChange={event => { setDraft({ base: pop.timestamp, value: event.target.value }); setInvalid(false) }}
    onBlur={() => {
      if (!draft) return
      const value = Number(draft.value)
      if (!draft.value.trim() || !Number.isFinite(value) || value < 0) { setInvalid(true); toast.error('表示開始時刻は0以上の秒数で入力してください。'); return }
      onChange(value)
      setDraft(null)
    }}
    onKeyDown={event => {
      if (event.nativeEvent.isComposing) return
      if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() }
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setDraft(null); setInvalid(false) }
    }} />
}

export function CentralPopEditor({ pops, onAdd, onUpdate, onDelete, onEditBoundary, titleAction, onPlay, onCompositionChange, selectedId, onSelect }: {
  selectedId?: string | null
  onSelect?: (id: string) => void
  pops: CentralPop[]
  onAdd: () => void
  onUpdate: (id: string, changes: Partial<Omit<CentralPop, 'id'>>) => void
  onDelete: (id: string) => void
  onEditBoundary: () => void
  titleAction?: ReactNode
  onPlay?: (timestamp: number) => void
  onCompositionChange: (value: boolean) => void
}) {
  return <Card data-pop-editor className="flex h-full min-h-0 flex-col">
    <CardHeader className="flex flex-row items-center justify-between gap-2">
      <CardTitle className="flex shrink-0 items-center gap-2 whitespace-nowrap text-lg sm:text-xl"><div className="rounded-lg bg-violet-500 p-2 text-white"><MessageSquare className="h-5 w-5" aria-hidden="true" /></div>ポップ一覧 {titleAction}</CardTitle>
      <Button variant="outline" size="sm" className="shrink-0" onClick={onAdd}>ポップを追加</Button>
    </CardHeader>
    <CardContent className="min-h-0 flex-1 overflow-y-auto">
      <div className="divide-y">
      {!pops.length && <p className="text-sm text-muted-foreground">ポップはありません。</p>}
      {pops.map((pop, index) => <div key={pop.id} id={`pop-row-${pop.id}`} data-pop-id={pop.id} tabIndex={0} aria-label={`ポップ${index + 1}を選択`} data-selected={selectedId === pop.id}
        className={`space-y-1 border-l-2 px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedId === pop.id ? 'border-l-primary bg-primary/5' : 'border-l-transparent'}`}
        onPointerDown={event => { onSelect?.(pop.id); if (!(event.target instanceof Element) || !event.target.closest('input, select, button, label')) event.currentTarget.focus() }}
        onFocusCapture={() => { onSelect?.(pop.id); onEditBoundary() }}>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">#{index + 1}</span>
          <PopTime pop={pop} onChange={timestamp => onUpdate(pop.id, { timestamp })} />
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`ポップ${index + 1}から再生`} title="この時刻から再生" disabled={!onPlay} onClick={() => onPlay?.(pop.timestamp)}><Play className="h-4 w-4" aria-hidden="true" /></Button>
          <Input aria-label={`ポップ${index + 1}の文字列`} className="h-8 min-w-0 text-sm" placeholder="Hey!" value={pop.text}
            onChange={event => onUpdate(pop.id, { text: event.target.value })}
            onCompositionStart={() => onCompositionChange(true)} onCompositionEnd={() => onCompositionChange(false)}
            onPaste={event => { if (/[\r\n]/.test(event.clipboardData.getData('text'))) { event.preventDefault(); toast.error('ポップに改行は貼り付けできません。') } }}
            onBlur={event => {
              onCompositionChange(false)
              const text = normalizeDecoration(event.target.value)
              if (text !== event.target.value) toast.info('禁止文字を除き、25文字以内に整えました。')
              onUpdate(pop.id, { text })
              onEditBoundary()
            }} />
          <Button variant="ghost" size="sm" aria-label={`ポップ${index + 1}を削除`} onClick={() => onDelete(pop.id)} className="h-8 px-2">削除</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-6 text-xs">
          <label className="flex items-center gap-1">表示時間<select aria-label="表示時間" className="h-7 rounded border bg-background px-2" value={pop.duration} onChange={event => onUpdate(pop.id, { duration: event.target.value as CentralPop['duration'] })}>
            {Object.entries(POP_DURATIONS).map(([value, seconds]) => <option key={value} value={value}>{seconds.toFixed(1)}秒</option>)}
          </select></label>
          <label className="flex items-center gap-1">寄せ<select aria-label="寄せ" className="h-7 rounded border bg-background px-2" value={pop.align} onChange={event => onUpdate(pop.id, { align: event.target.value as CentralPop['align'] })}>
            <option value="l">左</option><option value="c">中央</option><option value="r">右</option>
          </select></label>
          <label className="flex items-center gap-1">サイズ<select aria-label="サイズ" className="h-7 rounded border bg-background px-2" value={pop.size} onChange={event => onUpdate(pop.id, { size: event.target.value as CentralPop['size'] })}>
            <option value="s">小</option><option value="m">中</option><option value="l">大</option>
          </select></label>
          <label className="flex items-center gap-1">色<input className="h-7 w-8 rounded border" type="color" aria-label="色" value={pop.color} onChange={event => onUpdate(pop.id, { color: event.target.value.toUpperCase() })} /></label>
          <span className="font-mono text-[10px]">{pop.color}</span>
        </div>
      </div>)}
      </div>
    </CardContent>
  </Card>
}
