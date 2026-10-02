import { useEffect, useRef } from 'react'
import { Play } from 'lucide-react'
import type { CentralPop } from '@/lib/types'
import { POP_DEFAULTS } from '@/lib/scoreFormat'
import { POP_GAME_FONT_SIZES, POP_OPACITY, popPreviewTiming } from '@/lib/popPreview'

export function PopPreview({ pop, number }: { pop: CentralPop; number: number }) {
  const text = useRef<HTMLSpanElement>(null)
  const animation = useRef<Animation | null>(null)
  useEffect(() => () => { animation.current?.cancel() }, [pop.text, pop.duration, pop.align, pop.size, pop.color])
  const replay = () => {
    if (!text.current) return
    animation.current?.cancel()
    const timing = popPreviewTiming(pop.duration)
    animation.current = text.current.animate(timing.keyframes, { duration: timing.total * 1000, easing: 'linear', fill: 'forwards' })
  }
  return <button type="button" aria-label={`ポップ${number}のプレビューを再生`} title="クリックしてプレビューを再生"
    className="relative flex h-16 w-40 shrink-0 items-center overflow-hidden rounded bg-black px-2 max-sm:w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={replay}>
    <span ref={text} data-pop-preview-text className="block w-full whitespace-pre font-bold" style={{
      fontSize: POP_GAME_FONT_SIZES[pop.size] / 10,
      opacity: POP_OPACITY,
      color: pop.color || POP_DEFAULTS.color,
      textAlign: pop.align === 'l' ? 'left' : pop.align === 'r' ? 'right' : 'center',
      transformOrigin: 'center',
    }}>{pop.text}</span>
    <Play className="absolute bottom-1 right-1 h-3 w-3 text-white/60" aria-hidden="true" />
  </button>
}
