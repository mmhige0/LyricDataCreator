// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { DomainMoveBanner } from '../components/DomainMoveBanner'

vi.mock('next/navigation', () => ({ usePathname: () => '/songs/12/' }))

// vitestのjsdom環境が公開するインスタンス
declare const jsdom: { reconfigure: (options: { url: string }) => void }
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function renderAt(url: string) {
  jsdom.reconfigure({ url })
  const host = document.createElement('div')
  const root = createRoot(host)
  act(() => root.render(<DomainMoveBanner />))
  return host
}

afterEach(() => {
  jsdom.reconfigure({ url: 'http://localhost:3000/' })
})

it('links the same path on the new domain when opened on the legacy vercel.app host', () => {
  const link = renderAt('https://lyric-data-creator.vercel.app/songs/12/').querySelector('a')
  expect(link?.getAttribute('href')).toBe('https://ldc.kayomodoki.com/songs/12/')
  expect(link?.textContent).toBe('ldc.kayomodoki.com')
})

it('stays hidden on the new domain, localhost, and during server rendering', () => {
  expect(renderAt('https://ldc.kayomodoki.com/songs/12/').innerHTML).toBe('')
  expect(renderAt('http://localhost:3000/songs/12/').innerHTML).toBe('')
  expect(renderToStaticMarkup(<DomainMoveBanner />)).toBe('')
})
