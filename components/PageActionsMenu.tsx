import { useEffect, useId, useRef, useState } from 'react'
import { Copy, Eraser, MoreHorizontal, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function PageActionsMenu({ pageNumber, onCopy, onClear, onDelete, empty }: {
  pageNumber: number
  onCopy: () => void
  onClear?: () => void
  onDelete: () => void
  empty: boolean
}) {
  const id = useId()
  const popup = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [open, setOpen] = useState(false)
  // The top layer avoids clipping by the scrolling page list.
  useEffect(() => {
    if (!open) return
    const close = () => popup.current?.hidePopover()
    window.addEventListener('resize', close)
    document.addEventListener('scroll', close, true)
    return () => { window.removeEventListener('resize', close); document.removeEventListener('scroll', close, true) }
  }, [open])
  const close = () => { popup.current?.hidePopover(); trigger.current?.focus() }
  return <div data-page-menu>
    <Button ref={trigger} variant="ghost" size="sm" popoverTarget={id} aria-expanded={open}
      aria-label={`ページ${pageNumber}の操作`} title="ページ操作" className="size-8 p-0 [@media(pointer:coarse)]:size-11"
      onClick={event => {
        event.stopPropagation()
        const rect = event.currentTarget.getBoundingClientRect()
        const height = 160
        setPosition({ left: Math.max(8, Math.min(rect.right - 176, window.innerWidth - 184)), top: rect.bottom + height + 8 > window.innerHeight ? Math.max(8, rect.top - height - 4) : rect.bottom + 4 })
      }}><MoreHorizontal className="size-4" aria-hidden="true" /></Button>
    <div ref={popup} id={id} popover="auto" aria-label={`ページ${pageNumber}の操作一覧`}
      onToggle={event => setOpen((event.nativeEvent as ToggleEvent).newState === 'open')}
      className="fixed m-0 w-44 max-w-[calc(100vw-1rem)] rounded-md border bg-popover p-1 text-popover-foreground shadow-md" style={position}>
      <Button variant="ghost" size="sm" className="w-full justify-start [@media(pointer:coarse)]:h-11" onClick={() => { onCopy(); close() }}><Copy />歌詞をコピー</Button>
      {onClear && <Button variant="ghost" size="sm" className="w-full justify-start [@media(pointer:coarse)]:h-11" disabled={empty} onClick={() => { onClear(); close() }}><Eraser />歌詞をクリア</Button>}
      <hr className="my-1" />
      <Button variant="ghost" size="sm" className="w-full justify-start text-destructive [@media(pointer:coarse)]:h-11" onClick={() => { close(); onDelete() }}><Trash2 />ページを削除</Button>
    </div>
  </div>
}
