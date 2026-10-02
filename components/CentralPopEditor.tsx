import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { CentralPop } from '@/lib/types'
import { decorationLength, normalizeDecoration } from '@/lib/decorationText'
import { POP_DURATIONS } from '@/lib/scoreFormat'

function PopTime({ pop, onChange }: { pop: CentralPop; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<{ base: number; value: string } | null>(null)
  const [invalid, setInvalid] = useState(false)
  if (draft && draft.base !== pop.timestamp) { setDraft(null); setInvalid(false) }
  return <Input aria-label="ポップ開始時刻（秒）" aria-invalid={invalid} type="number" min="0" step="0.01" className="w-28" value={draft?.value ?? pop.timestamp.toFixed(2)}
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

export function CentralPopEditor({ pops, onAdd, onUpdate, onDelete, onEditBoundary, captureTime, onCompositionChange }: {
  pops: CentralPop[]
  onAdd: () => void
  onUpdate: (id: string, changes: Partial<Omit<CentralPop, 'id'>>) => void
  onDelete: (id: string) => void
  onEditBoundary: () => void
  captureTime?: () => number
  onCompositionChange: (value: boolean) => void
}) {
  return <Card data-pop-editor>
    <CardHeader className="flex flex-row items-center justify-between gap-2">
      <CardTitle className="text-lg">中央ポップ <span className="text-sm text-muted-foreground">{pops.length}件</span></CardTitle>
      <Button variant="outline" size="sm" onClick={onAdd}>ポップを追加</Button>
    </CardHeader>
    <CardContent className="space-y-4">
      <p className="text-xs text-muted-foreground">歌詞ページとは別のタイミングで表示します。半角0.5・全角1で25文字まで。絵文字・改行は使用できません。</p>
      {!pops.length && <p className="text-sm text-muted-foreground">中央ポップはありません。</p>}
      {pops.map((pop, index) => <fieldset key={pop.id} className="space-y-2 rounded-lg border p-3" onFocusCapture={onEditBoundary}>
        <legend className="px-1 text-sm">ポップ {index + 1}</legend>
        <div className="flex items-center gap-2">
          <Input aria-label={`ポップ${index + 1}の文字列`} placeholder="Hey!" value={pop.text}
            onChange={event => onUpdate(pop.id, { text: event.target.value })}
            onCompositionStart={() => onCompositionChange(true)} onCompositionEnd={() => onCompositionChange(false)}
            onPaste={event => { if (/[\r\n]/.test(event.clipboardData.getData('text'))) { event.preventDefault(); toast.error('中央ポップに改行は貼り付けできません。') } }}
            onBlur={event => {
              onCompositionChange(false)
              const text = normalizeDecoration(event.target.value)
              if (text !== event.target.value) toast.info('禁止文字を除き、25文字以内に整えました。')
              onUpdate(pop.id, { text })
              onEditBoundary()
            }} />
          <span className={`shrink-0 text-xs tabular-nums ${decorationLength(pop.text) > 25 ? 'text-destructive' : 'text-muted-foreground'}`}>{decorationLength(pop.text)}/25</span>
          <Button variant="ghost" size="sm" aria-label={`ポップ${index + 1}を削除`} onClick={() => onDelete(pop.id)}>削除</Button>
        </div>
        <div className="flex flex-wrap items-end gap-3 text-xs">
          <label className="space-y-1"><span>開始時刻（秒）</span><PopTime pop={pop} onChange={timestamp => onUpdate(pop.id, { timestamp })} /></label>
          <Button size="sm" variant="outline" disabled={!captureTime} onClick={() => { if (captureTime) onUpdate(pop.id, { timestamp: captureTime() }) }}>現在時刻を取得</Button>
          <label className="grid gap-1">表示時間<select aria-label="表示時間" className="h-9 rounded border bg-background px-2" value={pop.duration} onChange={event => onUpdate(pop.id, { duration: event.target.value as CentralPop['duration'] })}>
            {Object.entries(POP_DURATIONS).map(([value, seconds]) => <option key={value} value={value}>{seconds.toFixed(1)}秒</option>)}
          </select></label>
          <label className="grid gap-1">寄せ<select aria-label="寄せ" className="h-9 rounded border bg-background px-2" value={pop.align} onChange={event => onUpdate(pop.id, { align: event.target.value as CentralPop['align'] })}>
            <option value="l">左</option><option value="c">中央</option><option value="r">右</option>
          </select></label>
          <label className="grid gap-1">サイズ<select aria-label="サイズ" className="h-9 rounded border bg-background px-2" value={pop.size} onChange={event => onUpdate(pop.id, { size: event.target.value as CentralPop['size'] })}>
            <option value="s">小</option><option value="m">中</option><option value="l">大</option>
          </select></label>
          <label className="grid gap-1">色<input className="h-9 w-12 rounded border" type="color" aria-label="色" value={pop.color} onChange={event => onUpdate(pop.id, { color: event.target.value.toUpperCase() })} /></label>
          <span className="pb-2 font-mono">{pop.color}</span>
        </div>
        <p className="text-xs text-muted-foreground">フェードイン／アウト＋拡大表示。透明度はゲーム側の固定値です。</p>
      </fieldset>)}
    </CardContent>
  </Card>
}
