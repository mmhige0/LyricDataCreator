import { useLayoutEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { convertLyricsArrayToHiragana } from '@/lib/hiraganaUtils'
import type { LyricsArray, ScoreEntry } from '@/lib/types'

export function PageTimestampInput({ timestamp, pageNumber, onCommit }: {
  timestamp: number
  pageNumber: number
  onCommit: (value: string) => boolean | undefined
}) {
  const [draft, setDraft] = useState<{ base: number; value: string } | null>(null)
  const [invalid, setInvalid] = useState(false)
  const cancelled = useRef(false)
  // Discard superseded input permanently, so Undo cannot revive it later.
  if (draft && draft.base !== timestamp) {
    setDraft(null)
    setInvalid(false)
  }
  const value = draft?.base === timestamp ? draft.value : timestamp.toFixed(2)
  return (
    <Input
      type="number"
      min="0"
      step="0.01"
      aria-label={`ページ${pageNumber}の時刻（秒）`}
      aria-invalid={invalid}
      title="秒数を入力し、Enterまたはフォーカス移動で確定。Escで取り消し"
      className="h-8 w-[6.5rem] shrink-0 px-2 text-sm tabular-nums font-mono [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [@media(pointer:coarse)]:h-11"
      value={value}
      onFocus={() => { cancelled.current = false }}
      onChange={event => { setDraft({ base: timestamp, value: event.target.value }); setInvalid(false) }}
      onBlur={() => {
        if (cancelled.current) { cancelled.current = false; return }
        if (!draft || draft.base !== timestamp) return
        if (onCommit(value)) { setDraft(null); setInvalid(false) }
        else setInvalid(true)
      }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return
        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          cancelled.current = true
          setDraft(null)
          setInvalid(false)
          event.currentTarget.blur()
        } else if (event.key === 'Enter') {
          event.preventDefault()
          event.stopPropagation()
          event.currentTarget.blur()
        }
      }}
    />
  )
}

export function PageLyricsActions({ entry, onReplace }: {
  entry: ScoreEntry
  onReplace: (id: string, lyrics: LyricsArray, expected?: LyricsArray) => boolean
}) {
  const [converting, setConverting] = useState(false)
  const pending = useRef(false)
  const latest = useRef({ entry, onReplace })
  const mounted = useRef(false)
  useLayoutEffect(() => { latest.current = { entry, onReplace } })
  useLayoutEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  const convert = async () => {
    if (pending.current) return
    pending.current = true
    setConverting(true)
    const original = [...entry.lyrics] as LyricsArray
    try {
      const converted = await convertLyricsArrayToHiragana(original)
      if (!mounted.current) return
      // Do not overwrite typing, clear, undo, or an imported page during the request.
      if (!latest.current.onReplace(entry.id, converted, original)) {
        toast.info('変換中に歌詞が変更されたため、変換結果を反映しませんでした。')
      }
    } catch (error) {
      if (mounted.current) toast.error(error instanceof Error ? error.message : '変換に失敗しました。')
    } finally {
      pending.current = false
      if (mounted.current) setConverting(false)
    }
  }
  const empty = entry.lyrics.every(line => !line.trim())
  return (
    <Button variant="outline" size="sm" className="text-xs" disabled={converting || empty} onClick={convert}>
      <Languages className="h-3 w-3 mr-1" />{converting ? '変換中…' : 'かな変換'}
    </Button>
  )
}
