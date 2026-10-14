'use client'

import { useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { SITE_ORIGIN } from '@/lib/site'

const LEGACY_HOST_SUFFIX = '.vercel.app'

// ホスト名は表示中に変わらないので購読は不要
const subscribe = () => () => {}
const getIsLegacyHost = () => window.location.hostname.endsWith(LEGACY_HOST_SUFFIX)
const getServerIsLegacyHost = () => false

export function DomainMoveBanner() {
  const isLegacyHost = useSyncExternalStore(subscribe, getIsLegacyHost, getServerIsLegacyHost)
  const pathname = usePathname()

  if (!isLegacyHost) return null

  const newHost = new URL(SITE_ORIGIN).host

  return (
    <div className="border-b border-primary/30 bg-primary/10 px-4 py-2 text-center text-sm text-foreground">
      新しいURLは{' '}
      <a
        href={`${SITE_ORIGIN}${pathname}`}
        className="font-semibold text-primary underline underline-offset-2 hover:opacity-80"
      >
        {newHost}
      </a>{' '}
      です。下書きは引き継がれないため、必要な場合はファイル保存してから移動してください。
    </div>
  )
}
