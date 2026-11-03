// Runs only against a disposable database; CI provisions PostgreSQL and applies migrations.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn, revalidateTag: vi.fn() }))
vi.mock('@/lib/songQueries', () => ({ revalidateSongCache: vi.fn(), revalidateSongsCache: vi.fn() }))
const database = process.env.SUBMISSION_TEST_DATABASE_URL
let db: PrismaClient
let create: typeof import('@/app/api/submissions/route').POST
let update: typeof import('@/app/api/submissions/[id]/route').PUT
let get: typeof import('@/app/api/submissions/[id]/route').GET
let decide: typeof import('@/app/api/admin/submissions/[id]/route').POST
let remove: typeof import('@/app/api/admin/submissions/[id]/route').DELETE
const id = 'a1b7a034-5a5b-413b-b8b7-56d9d881c911'
const other = 'a1b7a034-5a5b-413b-b8b7-56d9d881c912'
const token = 'a'.repeat(43)
const admin = 'b'.repeat(43)
const input = { id, creatorName: '架空の作者', title: "架空の曲名 '; DROP TABLE song; --", artist: '<script>alert(1)</script>', level: '5+', youtubeUrl: 'https://youtu.be/abcdefghijk', txtContent: '10\nあ/い/う/え/1\n!/!/!/!/999.9\n', turnstileToken: 'valid', notes: '修正箇所\n2ページ目を調整' }
const request = (body?: unknown, secret = token, method = 'POST') => new Request('https://example.test/api/submissions/', {
  method, headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
  ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
})
const context = (value = id) => ({ params: Promise.resolve({ id: value }) })
const approve = (revision = 1, gameSongId = '001') => decide(request({ action: 'approve', revision, gameSongId, allowOverwrite: true }, admin), context())
let rankingFails = false
let rankingCalls = 0
let discordCalls = 0
let discordFails = false
let rankingExisting: { gameSongId: string; title: string; artist: string | null; level: string | null } | null = null

describe.skipIf(!database)('submission workflow with PostgreSQL', () => {
  beforeAll(async () => {
    if (!database || !new URL(database).pathname.endsWith('_test')) throw new Error('Use a disposable *_test database')
    vi.stubEnv('DATABASE_URL', database)
    vi.stubEnv('SUBMISSION_ADMIN_KEY', admin)
    vi.stubEnv('RANKING_ADMIN_API_KEY', 'test-ranking-key')
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret')
    vi.stubEnv('TURNSTILE_HOSTNAME', 'example.test')
    vi.stubEnv('VERCEL', '')
    db = (await import('@/lib/db')).prisma
    create = (await import('@/app/api/submissions/route')).POST
    const owned = await import('@/app/api/submissions/[id]/route')
    update = owned.PUT; get = owned.GET
    const adminRoute = await import('@/app/api/admin/submissions/[id]/route')
    decide = adminRoute.POST; remove = adminRoute.DELETE
  })
  beforeEach(async () => {
    rankingFails = false; rankingCalls = 0; discordCalls = 0; discordFails = false; rankingExisting = null
    vi.stubEnv('DISCORD_SUBMISSION_WEBHOOK_URL', '')
    vi.stubEnv('SUBMISSION_TOTAL_LIMIT', undefined)
    await db.chartSubmission.deleteMany(); await db.song.deleteMany()
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes('siteverify')) {
        expect((init?.body as URLSearchParams).has('remoteip')).toBe(false)
        return Response.json({ success: true, hostname: 'example.test', action: 'chart-submit' })
      }
      if (String(url).includes('/rankings?')) return rankingExisting ? Response.json({ song: rankingExisting }) : new Response('', { status: 404 })
      if (String(url).startsWith('https://discord.com/')) {
        discordCalls++
        expect(await db.chartSubmission.count()).toBe(1)
        return discordFails ? new Response('', { status: 500 }) : Response.json({ id: '123456789' })
      }
      expect(String(url)).toContain('/api/v1/admin/songs/')
      expect(init?.redirect).toBe('error')
      const headers = new Headers(init?.headers)
      expect(headers.has('X-LDC-Submission-Id')).toBe(false)
      expect(headers.has('X-LDC-Revision')).toBe(false)
      expect(headers.get('Authorization')).toBe('Bearer test-ranking-key')
      expect(init?.method).toBe('PUT')
      const body = JSON.parse(String(init?.body))
      expect(Object.keys(body).sort()).toEqual(['artist', 'level', 'title'])
      rankingCalls++
      if (rankingFails) throw new Error('simulated network loss')
      return Response.json({ status: 'created', song: { gameSongId: String(url).split('/').pop(), ...body } })
    }))
  })
  afterAll(async () => {
    if (db) { await db.chartSubmission.deleteMany(); await db.song.deleteMany(); await db.$disconnect() }
    vi.unstubAllGlobals(); vi.unstubAllEnvs()
  })
  it('stores an anonymous pending submission, literal symbols and only the token hash; retry does not duplicate', async () => {
    expect((await create(request(input))).status).toBe(201)
    const row = await db.chartSubmission.findUniqueOrThrow({ where: { id } })
    expect(row).toMatchObject({ title: input.title, artist: input.artist, status: 'pending', revision: 1, notes: input.notes, level: '-' })
    expect(row.editTokenHash).not.toBe(token)
    expect(await db.song.count()).toBe(0)
    expect((await create(request(input))).status).toBe(201)
    expect(await db.chartSubmission.count()).toBe(1)
    expect(rankingCalls).toBe(0)
  })
  it('retains the exact published song number for revision proposals and rejects missing targets', async () => {
    expect((await create(request({ ...input, gameSongId: '001' }))).status).toBe(404)
    expect((await create(request({ ...input, gameSongId: 1 }))).status).toBe(400)
    await db.song.create({ data: { gameSongId: '001', title: '公開曲', youtubeUrl: input.youtubeUrl, scoreTxt: input.txtContent } })
    expect((await create(request({ ...input, gameSongId: '001' }))).status).toBe(201)
    expect((await create(request({ ...input, gameSongId: '001' }))).status).toBe(201)
    expect((await create(request({ ...input, gameSongId: '0001' }))).status).toBe(409)
    expect((await update(request({ ...input, revision: 1, gameSongId: '0001' }, token, 'PUT'), context())).status).toBe(200)
    expect((await db.chartSubmission.findUniqueOrThrow({ where: { id } })).gameSongId).toBe('001')
    expect((await db.song.findUniqueOrThrow({ where: { gameSongId: '001' } })).title).toBe('公開曲')
  })
  it('notifies Discord once per saved revision and survives notification failures', async () => {
    vi.stubEnv('DISCORD_SUBMISSION_WEBHOOK_URL', 'https://discord.com/api/webhooks/123/test-token')
    discordFails = true
    const created = await create(request(input))
    expect(created.status).toBe(201)
    expect(await created.json()).toMatchObject({ discordNotification: 'failed' })
    expect(await db.chartSubmission.count()).toBe(1)
    expect(discordCalls).toBe(1)
    await create(request(input))
    expect(discordCalls).toBe(1)
    discordFails = false
    const changed = { ...input, revision: 1, notes: '更新したメモ' }
    expect(await (await update(request(changed, token, 'PUT'), context())).json()).toMatchObject({ discordNotification: 'sent' })
    expect(discordCalls).toBe(2)
    await update(request(changed, token, 'PUT'), context())
    expect(discordCalls).toBe(2)
  })
  it('checks collisions and freezes edited registration fields for retries', async () => {
    await create(request(input))
    rankingExisting = { gameSongId: '007', title: '既存曲', artist: '既存作者', level: '6' }
    const registration = { gameSongId: '007', title: '登録用の曲名', artist: '登録用アーティスト', level: '8+' }
    const attempt = (allowOverwrite: boolean, data = registration) => decide(request({ action: 'approve', revision: 1, registration: data, allowOverwrite }, admin), context())
    expect((await attempt(false)).status).toBe(409)
    expect((await db.chartSubmission.findUniqueOrThrow({ where: { id } })).status).toBe('pending')
    expect(rankingCalls).toBe(0)
    rankingFails = true
    expect((await attempt(true)).status).toBe(502)
    expect(await db.chartSubmission.findUniqueOrThrow({ where: { id } })).toMatchObject({ ...registration, status: 'publishing' })
    expect((await attempt(true, { ...registration, title: '変更できない' })).status).toBe(409)
    rankingFails = false
    expect((await attempt(true)).status).toBe(200)
    expect(await db.song.findUniqueOrThrow({ where: { gameSongId: '007' } })).toMatchObject({ ...registration, levelValue: 25 })
  })
  it('saves edits in submission columns and exposes them to the submitter and search', async () => {
    await create(request(input))
    const registration = { gameSongId: '003', title: '管理者の曲名', artist: null, level: '5-' }
    const saved = await decide(request({ action: 'save', revision: 1, registration }, admin), context())
    expect(saved.status).toBe(200)
    expect(await saved.json()).toMatchObject({ revision: 2, ...registration })
    expect(rankingCalls).toBe(0)
    expect((await decide(request({ action: 'approve', revision: 1, registration }, admin), context())).status).toBe(409)
    expect(await (await get(request(undefined, token, 'GET'), context())).json()).toMatchObject(registration)
    expect((await update(request({ ...input, revision: 1 }, token, 'PUT'), context())).status).toBe(409)
    await update(request({ ...input, revision: 2 }, token, 'PUT'), context())
    expect(await db.chartSubmission.findUniqueOrThrow({ where: { id } })).toMatchObject({ title: input.title, artist: input.artist, gameSongId: '003', level: '5-' })
    await decide(request({ action: 'reject', revision: 3 }, admin), context())
    const { GET: list } = await import('@/app/api/admin/submissions/route')
    const listed = await list(new Request('https://example.test/api/admin/submissions?status=rejected', { headers: { Authorization: `Bearer ${admin}` } }))
    expect((await listed.json()).submissions[0]).toMatchObject({ id, status: 'rejected' })
    await db.song.create({ data: { gameSongId: '001', title: '公開曲', youtubeUrl: input.youtubeUrl, scoreTxt: input.txtContent, level: '5+' } })
  })
  it('saves before assigning a number and restores rejected submissions without changing registration fields', async () => {
    await create(request(input))
    const registration = { gameSongId: '', title: '番号未定の曲', artist: null, level: '6+' }
    const save = await decide(request({ action: 'save', revision: 1, registration }, admin), context())
    expect(save.status).toBe(200)
    expect(await save.json()).toMatchObject({ gameSongId: null, title: registration.title, level: '6+', revision: 2, status: 'pending' })
    expect((await decide(request({ action: 'approve', revision: 2, registration }, admin), context())).status).toBe(400)
    expect((await decide(request({ action: 'reject', revision: 2 }, admin), context())).status).toBe(200)
    expect((await decide(request({ action: 'restore', revision: 2 }, admin), context())).status).toBe(409)
    const { GET: list } = await import('@/app/api/admin/submissions/route')
    const response = await list(new Request('https://example.test/api/admin/submissions?status=rejected&q=' + encodeURIComponent('番号未定'), { headers: { Authorization: `Bearer ${admin}` } }))
    expect((await response.json()).submissions).toEqual([expect.objectContaining({ title: registration.title, status: 'rejected', level: '6+' })])
    const restored = await decide(request({ action: 'restore', revision: 3 }, admin), context())
    expect(await restored.json()).toMatchObject({ title: registration.title, level: '6+', status: 'pending', revision: 4 })
    expect(rankingCalls).toBe(0)
    expect((await decide(request({ action: 'approve', revision: 4, registration: { ...registration, gameSongId: '009' } }, admin), context())).status).toBe(200)
    expect(await db.song.findUniqueOrThrow({ where: { gameSongId: '009' } })).toMatchObject({ title: registration.title, level: '6+' })
  })
  it('warns about matching submission numbers across filters and deletes with revision and state checks', async () => {
    await create(request(input)); await create(request({ ...input, id: other }))
    await db.chartSubmission.updateMany({ data: { gameSongId: '007' } })
    await decide(request({ action: 'reject', revision: 1 }, admin), context(other))
    const { GET: list } = await import('@/app/api/admin/submissions/route')
    const listed = await list(new Request('https://example.test/api/admin/submissions?status=pending', { headers: { Authorization: `Bearer ${admin}` } }))
    expect((await listed.json()).submissions).toEqual([expect.objectContaining({ id, duplicateCount: 1 })])
    const { GET: lookup } = await import('@/app/api/admin/ranking-song/route')
    const collisions = await lookup(new Request(`https://example.test/api/admin/ranking-song?gameSongId=007&submissionId=${id}`, { headers: { Authorization: `Bearer ${admin}` } }))
    expect((await collisions.json()).otherSubmissions).toEqual([{ id: other, title: input.title, status: 'rejected' }])
    expect((await remove(request({ revision: 2 }, token, 'DELETE'), context(other))).status).toBe(401)
    expect((await remove(request({ revision: 1 }, admin, 'DELETE'), context(other))).status).toBe(409)
    await db.chartSubmission.update({ where: { id: other }, data: { status: 'publishing' } })
    expect((await remove(request({ revision: 2 }, admin, 'DELETE'), context(other))).status).toBe(409)
    await db.chartSubmission.update({ where: { id: other }, data: { status: 'rejected' } })
    expect((await remove(request({ revision: 2 }, admin, 'DELETE'), context(other))).status).toBe(200)
    expect((await get(request(undefined, token, 'GET'), context(other))).status).toBe(404)
    expect(await db.chartSubmission.count()).toBe(1)
    expect(rankingCalls).toBe(0)
  })
  it('initializes revision proposals with difficulty dash even when the public song has a level', async () => {
    await db.song.create({ data: { gameSongId: '001', title: '公開曲', level: '8+', youtubeUrl: input.youtubeUrl, scoreTxt: input.txtContent } })
    expect(await (await create(request({ ...input, gameSongId: '001' }))).json()).toMatchObject({ level: '-', gameSongId: '001' })
  })
  it('rejects access and updates using somebody else’s key', async () => {
    await create(request(input))
    expect((await get(request(undefined, 'x'.repeat(43), 'GET'), context())).status).toBe(404)
    expect((await update(request({ ...input, revision: 1 }, 'x'.repeat(43), 'PUT'), context())).status).toBe(404)
    const response = await get(request(undefined, token, 'GET'), context())
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).not.toHaveProperty('editTokenHash')
  })
  it('allows pending changes but rejects stale edit/approval versions', async () => {
    await create(request(input))
    const changed = { ...input, title: '架空の修正', revision: 1, notes: '変更後のメモ\n2行目' }
    expect((await update(request(changed, token, 'PUT'), context())).status).toBe(200)
    expect((await update(request(changed, token, 'PUT'), context())).status).toBe(200)
    expect((await update(request({ ...input, revision: 1 }, token, 'PUT'), context())).status).toBe(409)
    expect(await (await get(request(undefined, token, 'GET'), context())).json()).toMatchObject({ notes: changed.notes })
    expect((await approve(1)).status).toBe(409)
    expect(rankingCalls).toBe(0)
    expect((await approve(2)).status).toBe(200)
  })
  it('atomically publishes the complete chart and deletes the submission and edit access', async () => {
    await create(request(input))
    const response = await approve()
    expect(response.status).toBe(200)
    const publicSong = await db.song.findFirstOrThrow()
    expect(publicSong).toMatchObject({ title: input.title, artist: input.artist, level: '-', youtubeUrl: 'https://www.youtube.com/watch?v=abcdefghijk', gameSongId: '001', creatorName: input.creatorName, scoreTxt: input.txtContent })
    expect(publicSong).not.toHaveProperty('scoreEntries')
    expect(publicSong).not.toHaveProperty('notes')
    expect(await response.json()).toEqual({ status: 'approved', gameSongId: '001' })
    expect(await db.chartSubmission.count()).toBe(0)
    expect((await get(request(undefined, token, 'GET'), context())).status).toBe(404)
    expect((await update(request({ ...input, title: '修正版', revision: 1 }, token, 'PUT'), context())).status).toBe(404)
    expect((await approve()).status).toBe(404)
    expect(await db.song.count()).toBe(1)
    expect(rankingCalls).toBe(1)
  })
  it('preserves the first submitter on revisions and never fills missing submitters with revision authors', async () => {
    await create(request(input)); await approve()
    await create(request({ ...input, id: other, gameSongId: '001', creatorName: '修正者', title: '修正後', notes: '修正申請の補足' }))
    expect((await decide(request({ action: 'approve', revision: 1, gameSongId: '001', allowOverwrite: true }, admin), context(other))).status).toBe(200)
    const revised = await db.song.findUniqueOrThrow({ where: { gameSongId: '001' } })
    expect(revised).toMatchObject({ title: '修正後', creatorName: input.creatorName })
    expect(revised).not.toHaveProperty('notes')
    await db.song.update({ where: { gameSongId: '001' }, data: { creatorName: null } })
    await create(request({ ...input, id: other, gameSongId: '001', creatorName: '別の修正者' }))
    expect((await decide(request({ action: 'approve', revision: 1, gameSongId: '001', allowOverwrite: true }, admin), context(other))).status).toBe(200)
    expect((await db.song.findUniqueOrThrow({ where: { gameSongId: '001' } })).creatorName).toBeNull()
  })
  it('pins the version/number after an uncertain response and completes publication on retry', async () => {
    await create(request(input))
    rankingFails = true
    expect((await approve()).status).toBe(502)
    expect(await db.chartSubmission.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'publishing', gameSongId: '001' })
    expect(await db.song.count()).toBe(0)
    expect((await update(request({ ...input, revision: 1 }, token, 'PUT'), context())).status).toBe(409)
    expect((await decide(request({ action: 'reject', revision: 1 }, admin), context())).status).toBe(409)
    expect((await approve(1, '002')).status).toBe(409)
    rankingFails = false
    expect((await approve()).status).toBe(200)
    expect((await approve()).status).toBe(404)
    expect(await db.chartSubmission.count()).toBe(0)
    expect(await db.song.count()).toBe(1)
    expect(rankingCalls).toBe(2)
  })
  it('rejects a linked revision without changing its public song, and allows resubmission', async () => {
    await db.song.create({ data: { gameSongId: '001', title: '公開中', level: '7+', levelValue: 22, youtubeUrl: input.youtubeUrl, scoreTxt: input.txtContent } })
    await create(request({ ...input, gameSongId: '001' }))
    expect((await decide(request({ action: 'reject', revision: 1 }, admin), context())).status).toBe(200)
    expect((await db.song.findFirstOrThrow()).title).toBe('公開中')
    expect((await update(request({ ...input, revision: 2, title: '再修正版' }, token, 'PUT'), context())).status).toBe(200)
    expect((await db.song.findFirstOrThrow()).title).toBe('公開中')
    expect((await approve(3)).status).toBe(200)
    expect(await db.song.findFirstOrThrow()).toMatchObject({ title: '再修正版', level: '-', levelValue: null })
    expect(await db.chartSubmission.count()).toBe(0)
  })
  it('recovers when ranking succeeds but the local public-song write fails', async () => {
    await create(request(input))
    await db.$executeRawUnsafe(`CREATE FUNCTION fail_song_write() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated song failure'; END $$`)
    await db.$executeRawUnsafe(`CREATE TRIGGER fail_song_write BEFORE INSERT ON song FOR EACH ROW EXECUTE FUNCTION fail_song_write()`)
    try {
      expect((await approve()).status).toBe(500)
      expect((await db.chartSubmission.findUniqueOrThrow({ where: { id } })).status).toBe('publishing')
      expect(await db.song.count()).toBe(0)
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER fail_song_write ON song')
      await db.$executeRawUnsafe('DROP FUNCTION fail_song_write()')
    }
    expect((await approve()).status).toBe(200)
    expect(await db.song.count()).toBe(1)
    expect(await db.chartSubmission.count()).toBe(0)
  })
  it('rolls back publication if deleting the submission fails, then recovers on retry', async () => {
    await create(request(input))
    await db.$executeRawUnsafe(`CREATE FUNCTION fail_submission_cleanup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated cleanup failure'; END $$`)
    await db.$executeRawUnsafe(`CREATE TRIGGER fail_submission_cleanup BEFORE DELETE ON chart_submission FOR EACH ROW EXECUTE FUNCTION fail_submission_cleanup()`)
    try {
      expect((await approve()).status).toBe(500)
      expect(await db.song.count()).toBe(0)
      expect((await db.chartSubmission.findUniqueOrThrow({ where: { id } })).status).toBe('publishing')
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER fail_submission_cleanup ON chart_submission')
      await db.$executeRawUnsafe('DROP FUNCTION fail_submission_cleanup()')
    }
    expect((await approve()).status).toBe(200)
    expect(await db.song.count()).toBe(1)
    expect(await db.chartSubmission.count()).toBe(0)
  })
  it('keeps the reserved song number when the existing ranking API rejects the request', async () => {
    await create(request(input))
    const successfulFetch = globalThis.fetch
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => init?.method !== 'PUT' ? successfulFetch(url, init) : Response.json({ error: 'conflict' }, { status: 409 })))
    expect((await approve()).status).toBe(502)
    expect(await db.chartSubmission.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'publishing', gameSongId: '001' })
    vi.stubGlobal('fetch', successfulFetch)
    expect((await approve(1, '002')).status).toBe(409)
    expect((await approve()).status).toBe(200)
  })
  it('does not create duplicates for simultaneous identical submissions', async () => {
    const responses = await Promise.all([create(request(input)), create(request(input))])
    expect(responses.map(row => row.status)).toEqual([201, 201])
    expect(await db.chartSubmission.count()).toBe(1)
  })
  it('updates an imported public song by its game number without an internal ID link', async () => {
    await db.song.create({ data: { gameSongId: '001', title: '架空の既存曲', youtubeUrl: input.youtubeUrl, scoreTxt: input.txtContent } })
    await create(request(input))
    await db.chartSubmission.update({ where: { id }, data: { gameSongId: '001' } })
    expect((await db.song.findUniqueOrThrow({ where: { gameSongId: '001' } })).title).toBe('架空の既存曲')
    expect((await approve()).status).toBe(200)
    expect(await db.song.count()).toBe(1)
    expect(await db.song.findUniqueOrThrow({ where: { gameSongId: '001' } })).toMatchObject({ title: input.title, gameSongId: '001' })
    expect(await db.chartSubmission.count()).toBe(0)
  })
  it('allows multiple proposals for the same public song and serializes duplicate approvals', async () => {
    await db.song.create({ data: { gameSongId: '001', title: '公開中', youtubeUrl: input.youtubeUrl, scoreTxt: input.txtContent } })
    await create(request(input))
    await create(request({ ...input, id: other, title: '別の修正案' }))
    await db.chartSubmission.updateMany({ data: { gameSongId: '001' } })
    expect(await db.chartSubmission.count({ where: { gameSongId: '001' } })).toBe(2)
    const originalFetch = globalThis.fetch
    let entered!: () => void
    let release!: () => void
    const started = new Promise<void>(resolve => { entered = resolve })
    const blocked = new Promise<void>(resolve => { release = resolve })
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      const response = await originalFetch(url, init)
      if (init?.method === 'PUT') { entered(); await blocked }
      return response
    }))
    const first = approve()
    await started
    const duplicate = approve()
    try {
      await new Promise(resolve => setTimeout(resolve, 20))
      expect(rankingCalls).toBe(1)
    } finally { release() }
    const responses = await Promise.all([first, duplicate])
    vi.stubGlobal('fetch', originalFetch)
    expect(responses.map(row => row.status).sort()).toEqual([200, 404])
    expect(rankingCalls).toBe(1)
    expect(await db.chartSubmission.count()).toBe(1)
    expect((await decide(request({ action: 'approve', revision: 1, gameSongId: '001', allowOverwrite: true }, admin), context(other))).status).toBe(200)
    expect((await db.song.findUniqueOrThrow({ where: { gameSongId: '001' } })).title).toBe('別の修正案')
    expect((await approve()).status).toBe(404)
    expect(rankingCalls).toBe(2)
  })
  it('blocks another proposal while a failed approval for the same song needs retry', async () => {
    await db.song.create({ data: { gameSongId: '001', title: '公開中', youtubeUrl: input.youtubeUrl, scoreTxt: input.txtContent } })
    await create(request(input)); await create(request({ ...input, id: other }))
    await db.chartSubmission.updateMany({ data: { gameSongId: '001' } })
    rankingFails = true
    expect((await approve()).status).toBe(502)
    rankingFails = false
    expect((await decide(request({ action: 'approve', revision: 1, gameSongId: '001', allowOverwrite: true }, admin), context(other))).status).toBe(409)
    expect(rankingCalls).toBe(1)
    expect((await approve()).status).toBe(200)
    expect((await decide(request({ action: 'approve', revision: 1, gameSongId: '001', allowOverwrite: true }, admin), context(other))).status).toBe(200)
  })
  it('lists public song numbers in numeric order across pages and searches the displayed numbers', async () => {
    const { getSongsPage, getRandomSongs } = await vi.importActual<typeof import('@/lib/songQueries')>('@/lib/songQueries')
    for (const gameSongId of ['1000', '099', '010', '001', '100', '0001']) {
      await db.song.create({ data: { title: `曲${gameSongId}`, artist: 'カタカナ', level: '5+', levelValue: 15, youtubeUrl: input.youtubeUrl, scoreTxt: input.txtContent, gameSongId } })
    }
    const options = { search: '', sortKey: 'gameSongId' as const, sortDirection: 'asc' as const, pageSize: 2 }
    const pages = await Promise.all([1, 2, 3].map(page => getSongsPage({ ...options, page })))
    expect(pages.flatMap(page => page.data.map(song => song.gameSongId))).toEqual(['0001', '001', '010', '099', '100', '1000'])
    expect(pages.map(page => page.hasNext)).toEqual([true, true, false])
    const descending = await getSongsPage({ ...options, page: 1, pageSize: 10, sortDirection: 'desc' })
    expect(descending.data.map(song => song.gameSongId)).toEqual(['1000', '100', '099', '010', '001', '0001'])
    const searched = await getSongsPage({ ...options, page: 1, search: '1000' })
    expect(searched.data.map(song => song.gameSongId)).toEqual(['1000'])
    const random = await getRandomSongs({ search: '1000' })
    expect(random.data.map(song => song.gameSongId)).toEqual(['1000'])
    expect((await getSongsPage({ ...options, page: 1, search: 'かたかな' })).data).toHaveLength(2)
    expect((await getSongsPage({ ...options, page: 1, search: "'; DROP TABLE song; --" })).data).toEqual([])
    expect(await db.song.count()).toBe(6)
  })
  it('imports, updates levels and reads practice songs using exact game-number strings', async () => {
    vi.stubEnv('IMPORT_SECRET', 'test-import-key')
    const { POST: importSongs } = await import('@/app/api/import-songs/route')
    const { PATCH: updateLevels } = await import('@/app/api/songs/route')
    const { getSongByGameSongId } = await vi.importActual<typeof import('@/lib/songQueries')>('@/lib/songQueries')
    const adminRequest = (body: unknown, method = 'POST') => new Request('https://example.test/api/import-songs', {
      method, headers: { 'x-import-secret': 'test-import-key', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const fullTxt = '30\n![c]装飾\\/文字/い/う/え/1\n!/!/!/!/999.9\n_\n共有ポップ/2\n'
    const songs = ['001', '0001'].map((gameSongId, i) => ({ ...input, gameSongId, title: '同名の別曲', txtContent: i === 1 ? fullTxt : input.txtContent }))
    const imported = await importSongs(adminRequest({ songs }))
    expect((await imported.json()).results.map((song: { gameSongId: string }) => song.gameSongId)).toEqual(['001', '0001'])
    expect(await db.song.count()).toBe(2)
    expect((await getSongByGameSongId('001'))?.gameSongId).toBe('001')
    expect(await getSongByGameSongId('1')).toBeNull()
    await importSongs(adminRequest({ songs: [{ ...songs[0], title: '更新された曲' }] }))
    expect((await getSongByGameSongId('001'))?.title).toBe('更新された曲')
    expect((await getSongByGameSongId('0001'))?.title).toBe('同名の別曲')
    const saved = await getSongByGameSongId('0001')
    expect(saved?.scoreTxt).toBe(fullTxt)
    expect(saved).not.toHaveProperty('scoreEntries')
    const parsed = (await import('@/lib/scoreFormat')).parseScoreTxt(saved!.scoreTxt)
    expect(parsed).toMatchObject({ duration: 30, centralPops: [expect.objectContaining({ text: '共有ポップ' })] })
    expect(parsed.scoreEntries[0].lyrics[0]).toBe('装飾/文字')
    const levelResponse = await updateLevels(adminRequest({ songs: [{ gameSongId: '001', level: '7+' }, { id: 1, level: '9' }] }, 'PATCH'))
    const result = await levelResponse.json()
    expect(result.updated).toHaveLength(1)
    expect(result.updated[0]).toMatchObject({ gameSongId: '001', level: '7+' })
    expect(result.errors).toHaveLength(1)
    expect((await getSongByGameSongId('0001'))?.level).toBe(input.level)
    expect((await getSongByGameSongId('001'))).not.toHaveProperty('id')
  })
  it('applies metadata length limits to the import route as well as submissions', async () => {
    vi.stubEnv('IMPORT_SECRET', 'test-import-key')
    const { POST: importSongs } = await import('@/app/api/import-songs/route')
    const base = { ...input, gameSongId: '001', title: '曲'.repeat(100), artist: '歌'.repeat(100) }
    const send = (song: typeof base) => importSongs(new Request('https://example.test/api/import-songs', {
      method: 'POST', headers: { 'x-import-secret': 'test-import-key', 'Content-Type': 'application/json' }, body: JSON.stringify({ songs: [song] }),
    }))
    expect((await (await send(base)).json()).results[0].status).toBe('created')
    for (const song of [
      { ...base, title: '曲'.repeat(101) }, { ...base, artist: '歌'.repeat(101) },
      { ...base, youtubeUrl: 'x'.repeat(101) },
    ]) expect((await (await send(song)).json()).results[0].status).toBe('error')
    expect(await db.song.findUniqueOrThrow({ where: { gameSongId: '001' } })).toMatchObject({ title: base.title, artist: base.artist, youtubeUrl: base.youtubeUrl })
  })
  it('does not publish oversized metadata from an older stored submission', async () => {
    await create(request(input))
    for (const data of [{ creatorName: 'あ'.repeat(21) }, { creatorName: input.creatorName, youtubeUrl: 'x'.repeat(101) }]) {
      await db.chartSubmission.update({ where: { id }, data })
      expect((await approve()).status).toBe(400)
      expect((await db.chartSubmission.findUniqueOrThrow({ where: { id } })).status).toBe('pending')
      expect(rankingCalls).toBe(0)
    }
    expect(await db.song.count()).toBe(0)
  })
  it('requires administrator authorization before reading the body', async () => {
    expect((await decide(request({ action: 'approve', revision: 1, gameSongId: '001' }), context())).status).toBe(401)
    expect(rankingCalls).toBe(0)
  })
  const seedRows = async (count: number) => db.chartSubmission.createMany({ data: Array.from({ length: count }, () => ({
    id: randomUUID(), editTokenHash: 'unused', creatorName: input.creatorName, title: input.title,
    artist: input.artist, youtubeUrl: input.youtubeUrl, txtContent: input.txtContent, status: 'rejected',
  })) })
  it('enforces the default limit of 50 stored rows under concurrent new submissions', async () => {
    await seedRows(49)
    const responses = await Promise.all([create(request(input)), create(request({ ...input, id: other }))])
    expect(responses.map(row => row.status).sort()).toEqual([201, 429])
    expect(await db.chartSubmission.count()).toBe(50)
  })
  it('allows edits at capacity and accepts a new submission when publication frees a slot', async () => {
    await create(request(input))
    await seedRows(49)
    expect((await create(request({ ...input, id: other }))).status).toBe(429)
    expect((await create(request(input))).status).toBe(201)
    for (let revision = 1; revision <= 3; revision++) {
      expect((await update(request({ ...input, title: `編集${revision}`, revision }, token, 'PUT'), context())).status).toBe(200)
    }
    expect(await db.chartSubmission.count()).toBe(50)
    expect((await approve(4)).status).toBe(200)
    expect((await create(request({ ...input, id: other }))).status).toBe(201)
    expect(await db.chartSubmission.count()).toBe(50)
  })
  it('respects a configured capacity override', async () => {
    vi.stubEnv('SUBMISSION_TOTAL_LIMIT', '1')
    await create(request(input))
    expect((await create(request({ ...input, id: other }))).status).toBe(429)
  })
})
