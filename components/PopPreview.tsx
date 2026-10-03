import { useEffect, useRef } from 'react'
import { Play } from 'lucide-react'
import type { CentralPop } from '@/lib/types'
import { POP_DEFAULTS } from '@/lib/scoreFormat'
import { POP_OPACITY, popPreviewTiming } from '@/lib/popPreview'

const PREVIEW_FONT_HEIGHTS = { s: 30, m: 60, l: 250 / 3 } as const

export function PopPreview({ pop, number }: { pop: CentralPop; number: number }) {
  const text = useRef<HTMLSpanElement>(null)
  const animation = useRef<Animation | null>(null)
  useEffect(() => () => { animation.current?.cancel() }, [pop.text, pop.duration, pop.align, pop.size, pop.color])
  const replay = () => {
    if (!text.current) return
    animation.current?.cancel()
    const timing = popPreviewTiming(pop.duration)
    animation.current = text.current.animate(timing.keyframes, { duration: timing.total * 1000, easing: 'linear' })
  }
  return <button type="button" aria-label={`ポップ${number}のプレビューを再生`} title="クリックしてプレビューを再生"
    style={{ containerType: 'size' }} className="relative flex aspect-[24/5] min-w-0 flex-1 items-center overflow-hidden rounded bg-black px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={replay}>
    <span ref={text} data-pop-preview-text className="block w-full whitespace-pre" style={{
      fontFamily: 'var(--font-pop-preview), sans-serif',
      fontWeight: 400,
      fontSize: `${PREVIEW_FONT_HEIGHTS[pop.size]}cqh`,
      lineHeight: 1,
      opacity: POP_OPACITY,
      color: pop.color || POP_DEFAULTS.color,
      textAlign: pop.align === 'l' ? 'left' : pop.align === 'r' ? 'right' : 'center',
      transformOrigin: 'center',
    }}>{pop.text}</span>
    <Play className="absolute bottom-1 right-1 h-3 w-3 text-white/60" aria-hidden="true" />
  </button>
}
