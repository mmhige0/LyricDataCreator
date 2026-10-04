import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Play } from 'lucide-react'
import type { CentralPop } from '@/lib/types'
import { POP_DEFAULTS } from '@/lib/scoreFormat'
import { POP_OPACITY, popPreviewTiming } from '@/lib/popPreview'

const PREVIEW_FONT_HEIGHTS = { s: 30, m: 45, l: 60 } as const

export function PopPreview({ pop, number }: { pop: CentralPop; number: number }) {
  const text = useRef<HTMLSpanElement>(null)
  const animation = useRef<Animation | null>(null)
  const hovering = useRef(false)
  const [verticalOffset, setVerticalOffset] = useState(0)
  useLayoutEffect(() => {
    const element = text.current
    if (!element) return
    let active = true
    const measure = () => {
      if (!active) return
      const style = getComputedStyle(element)
      const context = document.createElement('canvas').getContext('2d')
      if (!context || !pop.text) { setVerticalOffset(0); return }
      context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      const lines = pop.text.split('\n')
      const metrics = lines.map(line => context.measureText(line || 'あ'))
      const lineHeight = parseFloat(style.lineHeight)
      const fontAscent = metrics[0].fontBoundingBoxAscent
      const fontDescent = metrics[0].fontBoundingBoxDescent
      if (!Number.isFinite(fontAscent) || !Number.isFinite(fontDescent)) return
      const baseline = (lineHeight + fontAscent - fontDescent) / 2
      const top = Math.min(...metrics.map((metric, index) => baseline + index * lineHeight - metric.actualBoundingBoxAscent))
      const bottom = Math.max(...metrics.map((metric, index) => baseline + index * lineHeight + metric.actualBoundingBoxDescent))
      setVerticalOffset((top + bottom - lines.length * lineHeight) / 2)
    }
    measure()
    document.fonts?.ready.then(measure)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(element)
    window.addEventListener('resize', measure)
    return () => { active = false; observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [pop.text, pop.size])
  const replay = useCallback(() => {
    if (!text.current) return
    animation.current?.cancel()
    const timing = popPreviewTiming(pop.duration)
    animation.current = text.current.animate(timing.keyframes, { duration: timing.total * 1000, easing: 'linear', iterations: hovering.current ? Infinity : 1 })
  }, [pop.duration])
  useEffect(() => {
    if (hovering.current) replay()
    return () => { animation.current?.cancel() }
  }, [pop.text, pop.align, pop.size, pop.color, replay])
  return <button type="button" aria-label={`ポップ${number}のプレビューを再生`}
    onPointerEnter={event => { if (event.pointerType === 'mouse') { hovering.current = true; replay() } }}
    onPointerLeave={() => { if (hovering.current) { hovering.current = false; animation.current?.cancel() } }}
    style={{ containerType: 'size' }} className="relative flex aspect-[24/5] min-w-0 flex-1 items-center overflow-hidden rounded bg-black px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={replay}>
    <span ref={text} data-pop-preview-text className="block w-full whitespace-pre" style={{
      fontFamily: 'var(--font-pop-preview), sans-serif',
      fontWeight: 400,
      fontSize: `${PREVIEW_FONT_HEIGHTS[pop.size]}cqh`,
      lineHeight: 1,
      opacity: POP_OPACITY,
      color: pop.color || POP_DEFAULTS.color,
      textAlign: pop.align === 'l' ? 'left' : pop.align === 'r' ? 'right' : 'center',
      position: 'relative',
      top: -verticalOffset,
      transformOrigin: `center calc(50% + ${verticalOffset}px)`,
    }}>{pop.text}</span>
    <Play className="absolute bottom-1 right-1 h-3 w-3 text-white/60" aria-hidden="true" />
  </button>
}
