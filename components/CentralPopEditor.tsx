import { useState, type ReactNode } from 'react'
import { Play, MessageSquare, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CentralPop } from '@/lib/types'
import { normalizeDecoration } from '@/lib/decorationText'
import { PageTimestampInput } from './PageEditControls'
import { POP_DURATIONS } from '@/lib/scoreFormat'

export function CentralPopEditor({ pops, onAdd, onUpdate, onDelete, onEditBoundary, titleAction, onPlay, onCompositionChange, selectedId, onSelect, onAdjust, onClear }: {
  onAdjust?: (offset: number) => void
  onClear?: () => void
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
  const [adjustValue, setAdjustValue] = useState('0')
  const applyAdjustment = () => {
    const value = adjustValue.trim() ? Number(adjustValue) : NaN
    if (!Number.isFinite(value) || Math.abs(value) > 10) { toast.error('調整値は-10秒から+10秒の範囲で入力してください。'); return }
    onAdjust?.(value)
  }
  return <Card data-pop-editor className="flex h-full min-h-0 flex-col">
    <CardHeader className="flex flex-row items-center justify-between gap-2">
      <CardTitle className="flex shrink-0 items-center gap-2 whitespace-nowrap text-lg sm:text-xl"><div className="rounded-lg bg-violet-500 p-2 text-white"><MessageSquare className="h-5 w-5" aria-hidden="true" /></div>ポップ一覧 {titleAction}</CardTitle>
    </CardHeader>
    <CardContent className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 divide-y overflow-y-auto">
      {!pops.length && <p className="text-sm text-muted-foreground">ポップはありません。</p>}
      {pops.map((pop, index) => <div key={pop.id} id={`pop-row-${pop.id}`} data-pop-id={pop.id} tabIndex={0} aria-label={`ポップ${index + 1}を選択`} data-selected={selectedId === pop.id}
        className={`space-y-1 border-l-2 px-2 py-2 outline-none focus-visible:ring-2 focus-visible:ring-ring ${selectedId === pop.id ? 'border-l-primary bg-primary/5' : 'border-l-transparent'}`}
        onPointerDown={event => { onSelect?.(pop.id); if (!(event.target instanceof Element) || !event.target.closest('input, select, button, label')) event.currentTarget.focus() }}
        onFocusCapture={() => { onSelect?.(pop.id); onEditBoundary() }}
        onKeyDown={event => {
          if (event.key === 'Escape' && !event.defaultPrevented && !event.nativeEvent.isComposing && event.keyCode !== 229) {
            event.preventDefault(); event.stopPropagation(); event.currentTarget.focus()
          }
        }}>
        <div className="flex items-center gap-2">
          <span className="shrink-0 text-xs text-muted-foreground">#{index + 1}</span>
          <PageTimestampInput timestamp={pop.timestamp} pageNumber={index + 1} ariaLabel="ポップ開始時刻（秒）" onCommit={value => {
            const timestamp = Number(value)
            if (!value.trim() || !Number.isFinite(timestamp) || timestamp < 0) { toast.error('表示開始時刻は0以上の秒数で入力してください。'); return false }
            onUpdate(pop.id, { timestamp }); return true
          }} />
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" aria-label={`ポップ${index + 1}から再生`} title="この時刻から再生" disabled={!onPlay} onClick={() => onPlay?.(pop.timestamp)}><Play className="h-4 w-4" aria-hidden="true" /></Button>
          <Input id={`pop-text-${pop.id}`} aria-label={`ポップ${index + 1}の文字列`} className="h-8 min-w-0 text-sm" placeholder="Hey!" value={pop.text}
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
          <Button variant="ghost" size="sm" aria-label={`ポップ${index + 1}を削除`} onClick={() => onDelete(pop.id)} className="h-8 px-2 text-destructive hover:text-destructive">削除</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3 pl-6 text-sm">
          <label className="flex items-center gap-2">表示時間<select aria-label="表示時間" className="h-9 rounded border bg-background px-2" value={pop.duration} onChange={event => onUpdate(pop.id, { duration: event.target.value as CentralPop['duration'] })}>
            {Object.entries(POP_DURATIONS).map(([value, seconds]) => <option key={value} value={value}>{seconds.toFixed(1)}秒</option>)}
          </select></label>
          <label className="flex items-center gap-2">寄せ<select aria-label="寄せ" className="h-9 rounded border bg-background px-2" value={pop.align} onChange={event => onUpdate(pop.id, { align: event.target.value as CentralPop['align'] })}>
            <option value="l">左</option><option value="c">中央</option><option value="r">右</option>
          </select></label>
          <label className="flex items-center gap-2">サイズ<select aria-label="サイズ" className="h-9 rounded border bg-background px-2" value={pop.size} onChange={event => onUpdate(pop.id, { size: event.target.value as CentralPop['size'] })}>
            <option value="s">小</option><option value="m">中</option><option value="l">大</option>
          </select></label>
          <label className="flex items-center gap-2">色<input className="h-9 w-10 rounded border" type="color" aria-label="色" value={pop.color} onChange={event => onUpdate(pop.id, { color: event.target.value.toUpperCase() })} /></label>
          <span className="font-mono text-xs">{pop.color}</span>
        </div>
      </div>)}
      </div>
      <div className="flex shrink-0 justify-center border-t py-2">
        <Button type="button" variant="outline" className="size-8 rounded-full p-0 [@media(pointer:coarse)]:size-11" aria-label="空ポップを追加" title="空ポップを追加（Ctrl+Enter）" onClick={onAdd}><Plus className="size-4" aria-hidden="true" /></Button>
      </div>
      <div className="mt-2 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t pt-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">時刻の一括調整</span>
          <Input aria-label="ポップの一括調整（秒）" type="number" step="0.01" min="-10" max="10" placeholder="秒" value={adjustValue} onChange={event => setAdjustValue(event.target.value)} className="h-7 w-20 text-xs" disabled={!pops.length} />
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={applyAdjustment} disabled={!pops.length || !onAdjust}>適用</Button>
        </div>
        <Button variant="outline" size="sm" className="text-xs text-muted-foreground hover:text-destructive" onClick={onClear} disabled={!pops.length || !onClear}><Trash2 className="h-3 w-3" />全ポップ削除</Button>
      </div>
    </CardContent>
  </Card>
}
