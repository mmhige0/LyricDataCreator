import { afterEach, expect, it, vi } from 'vitest'
import type { ChartSubmission } from '@prisma/client'
import { notifySubmission } from '@/lib/submissions/discord'

const row: ChartSubmission = {
  id: 'a1b7a034-5a5b-413b-b8b7-56d9d881c911', editTokenHash: 'never-send-this',
  title: '曲 @everyone', creatorName: '作者', artist: 'Artist', notes: '補足情報\n<@12345>',
  youtubeUrl: 'https://youtu.be/abcdefghijk', txtContent: '10\nあ/い/う/え/1\n',
  status: 'pending', revision: 2, gameSongId: '001', createdAt: new Date(), updatedAt: new Date(),
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
it('sends metadata, public notes and a TXT attachment without edit credentials or mentions', async () => {
  vi.stubEnv('DISCORD_SUBMISSION_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/test-token')
  const fetch = vi.fn(async (_url: URL, _init?: RequestInit) => Response.json({ id: '12345' }))
  vi.stubGlobal('fetch', fetch)
  expect(await notifySubmission(row, 'updated')).toBe('sent')
  const [url, init] = fetch.mock.calls[0]
  expect(url.searchParams.get('wait')).toBe('true')
  expect(init?.redirect).toBe('error')
  const body = init?.body as FormData
  const payload = JSON.parse(String(body.get('payload_json')))
  expect(payload.allowed_mentions).toEqual({ parse: [] })
  expect(payload.embeds[0]).toMatchObject({ title: '譜面の再申請', description: row.notes })
  expect(payload.embeds[0].url).toBe(`https://ldc.kayomodoki.com/admin/submissions/?submission=${row.id}`)
  expect(JSON.stringify(payload)).not.toContain(row.editTokenHash)
  expect(payload).not.toHaveProperty('level')
  const file = body.get('files[0]') as File
  expect(file.name).toBe(`chart-${row.id}-v2.txt`)
  expect(await file.text()).toBe(row.txtContent)
})
it('skips when unconfigured and refuses unexpected destinations without making a request', async () => {
  const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
  vi.stubEnv('DISCORD_SUBMISSION_WEBHOOK_URL', '')
  expect(await notifySubmission(row, 'new')).toBe('skipped')
  for (const url of ['http://discord.com/api/webhooks/123/key', 'https://evil.test/api/webhooks/123/key', 'https://discord.com@evil.test/api/webhooks/123/key']) {
    vi.stubEnv('DISCORD_SUBMISSION_WEBHOOK_URL', url)
    expect(await notifySubmission(row, 'new')).toBe('failed')
  }
  expect(fetch).not.toHaveBeenCalled()
})
it('handles rate limits, malformed success and network failures without losing submissions', async () => {
  vi.stubEnv('DISCORD_SUBMISSION_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/test-token')
  vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 429 })))
  expect(await notifySubmission(row, 'new')).toBe('failed')
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({})))
  expect(await notifySubmission(row, 'new')).toBe('failed')
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('network') }))
  expect(await notifySubmission(row, 'resend')).toBe('failed')
})
