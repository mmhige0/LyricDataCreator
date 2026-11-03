'use client'

import Script from 'next/script'
import { useEffect, useRef, useState, useCallback } from 'react'

type Turnstile = {
  render: (container: HTMLElement, options: Record<string, unknown>) => string
  remove: (id: string) => void
}
declare global { interface Window { turnstile?: Turnstile } }

export function SubmissionTurnstile({ onToken }: { onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null)
  const widget = useRef<string | null>(null)
  const callback = useRef(onToken)
  const [error, setError] = useState('')
  const sitekey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  useEffect(() => { callback.current = onToken }, [onToken])
  const render = useCallback(() => {
    if (!sitekey || !container.current || !window.turnstile || widget.current !== null) return
    widget.current = window.turnstile.render(container.current, {
      sitekey, action: 'chart-submit',
      callback: (token: string) => { setError(''); callback.current(token) },
      'expired-callback': () => callback.current(''),
      'error-callback': () => { callback.current(''); setError('Bot確認を読み込めません。ページを再読み込みしてください。') },
    })
  }, [sitekey])
  useEffect(() => {
    render()
    return () => {
      if (widget.current !== null) window.turnstile?.remove(widget.current)
      widget.current = null
    }
  }, [render])
  if (!sitekey) return <p>現在、投稿受付の準備中です。</p>
  return <>
    <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" onReady={render} onError={() => setError('Bot確認を読み込めません。')} />
    <div ref={container} />
    {error && <p role="alert">{error}</p>}
  </>
}
