import { afterEach, describe, expect, it, vi } from 'vitest'
import { canonicalYouTubeUrl, MAX_BODY_BYTES, parseSubmission } from '@/lib/submissions/validation'
import { clientIp, editToken, readJson, requireAdmin } from '@/lib/submissions/http'
import { verifyTurnstile } from '@/lib/submissions/turnstile'

const input = { creatorName: '架空の制作者', title: "架空の曲名 '; DROP TABLE song; --", artist: '<script>alert(1)</script>', level: '5+', youtubeUrl: 'https://youtu.be/abcdefghijk', txtContent: '10\nあ/い/う/え/1\n!/!/!/!/999.9\n' }
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })
describe('anonymous submission boundary', () => {
  it('accepts literal punctuation as data and validates the score structure', () => {
    expect(parseSubmission(input)).toMatchObject({ title: input.title, artist: input.artist, youtubeUrl: 'https://www.youtube.com/watch?v=abcdefghijk' })
    expect(() => parseSubmission({ ...input, txtContent: '1\na/b/c/d/2\n' })).toThrow('総時間')
    expect(() => parseSubmission({ ...input, txtContent: '10\n'.repeat(2201) })).toThrow('行数')
    expect(() => parseSubmission({ ...input, txtContent: 'あ'.repeat(128 * 1024) })).toThrow('128KiB')
    expect(() => parseSubmission({ ...input, txtContent: '10\n<script>/b/c/d/1\n' })).not.toThrow()
  })
  it.each(['http://youtu.be/abcdefghijk', 'https://youtube.com.evil.test/watch?v=abcdefghijk', 'https://evil.test/youtube.com/watch?v=abcdefghijk', 'https://user:pass@youtube.com/watch?v=abcdefghijk', 'http://127.0.0.1', 'javascript:alert(1)'])('rejects arbitrary URLs: %s', url => {
    expect(() => canonicalYouTubeUrl(url)).toThrow()
  })
  it('requires a bearer edit key and a separate administrator key', () => {
    const request = (key: string) => new Request('https://example.test', { headers: { Authorization: `Bearer ${key}` } })
    const token = 'a'.repeat(43)
    expect(editToken(request(token))).toBe(token)
    expect(() => editToken(request('short'))).toThrow()
    vi.stubEnv('SUBMISSION_ADMIN_KEY', 'b'.repeat(43))
    expect(() => requireAdmin(request(token))).toThrow()
    expect(() => requireAdmin(request('b'.repeat(43)))).not.toThrow()
    vi.stubEnv('SUBMISSION_ADMIN_KEY', '')
    expect(() => requireAdmin(request(''))).toThrow()
  })
  it('only trusts Vercel-sanitized IP headers on Vercel', () => {
    vi.stubEnv('VERCEL', '1')
    expect(clientIp(new Request('https://example.test', { headers: { 'x-forwarded-for': '192.0.2.1' } }))).toBe('192.0.2.1')
    expect(() => clientIp(new Request('https://example.test', { headers: { 'x-forwarded-for': '192.0.2.1, 192.0.2.2' } }))).toThrow()
    vi.stubEnv('VERCEL', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(() => clientIp(new Request('https://example.test'))).toThrow()
  })
  it('limits streamed body size without trusting Content-Length', async () => {
    const request = new Request('https://example.test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ value: 'a'.repeat(MAX_BODY_BYTES) }) })
    await expect(readJson(request)).rejects.toMatchObject({ status: 413 })
  })
  it('fails closed when Turnstile is missing, unreachable or validates the wrong site/action', async () => {
    vi.stubEnv('TURNSTILE_SECRET_KEY', '')
    await expect(verifyTurnstile('token', '192.0.2.1')).rejects.toMatchObject({ status: 503 })
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret')
    vi.stubEnv('TURNSTILE_HOSTNAME', 'example.test')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: true, hostname: 'evil.test', action: 'chart-submit' })))
    await expect(verifyTurnstile('token', '192.0.2.1')).rejects.toMatchObject({ status: 400 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: true, hostname: 'example.test', action: 'wrong' })))
    await expect(verifyTurnstile('token', '192.0.2.1')).rejects.toMatchObject({ status: 400 })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(verifyTurnstile('token', '192.0.2.1')).rejects.toMatchObject({ status: 503 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ success: true, hostname: 'example.test', action: 'chart-submit' })))
    await expect(verifyTurnstile('token', '192.0.2.1')).resolves.toBeUndefined()
  })
})

it('accepts bounded multiline notes while rejecting control characters', () => {
  expect(parseSubmission({ ...input, notes: ' 修正箇所\n2ページ目を調整\t確認お願いします ' }).notes).toBe('修正箇所\n2ページ目を調整\t確認お願いします')
  expect(parseSubmission(input).notes).toBe('')
  expect(() => parseSubmission({ ...input, notes: 'a'.repeat(2001) })).toThrow()
  expect(() => parseSubmission({ ...input, notes: 'a\u0000b' })).toThrow()
})

it('only accepts official dummy verification metadata in development', async () => {
  vi.stubEnv('TURNSTILE_SECRET_KEY', '1x0000000000000000000000000000000AA')
  vi.stubEnv('TURNSTILE_HOSTNAME', 'localhost')
  vi.stubEnv('NODE_ENV', 'development')
  const reply = (success: boolean) => vi.stubGlobal('fetch', vi.fn(async () => Response.json({ success, hostname: 'localhost', action: 'test' })))
  reply(true)
  await expect(verifyTurnstile('XXXX.DUMMY.TOKEN.XXXX', '127.0.0.1')).resolves.toBeUndefined()
  await expect(verifyTurnstile('other-token', '127.0.0.1')).rejects.toMatchObject({ status: 400 })
  reply(false)
  await expect(verifyTurnstile('XXXX.DUMMY.TOKEN.XXXX', '127.0.0.1')).rejects.toMatchObject({ status: 400 })
  reply(true)
  vi.stubEnv('NODE_ENV', 'production')
  await expect(verifyTurnstile('XXXX.DUMMY.TOKEN.XXXX', '127.0.0.1')).rejects.toMatchObject({ status: 400 })
})
