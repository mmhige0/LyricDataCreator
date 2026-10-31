// Runs only against a disposable database; CI provisions PostgreSQL and applies migrations.
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'

vi.mock('next/cache', () => ({ unstable_cache: (fn: () => unknown) => fn, revalidateTag: vi.fn() }))
vi.mock('@/lib/songQueries', () => ({ revalidateSongCache: vi.fn(), revalidateSongsCache: vi.fn() }))
const database = process.env.SUBMISSION_TEST_DATABASE_URL
let db: PrismaClient
let create: typeof import('@/app/api/submissions/route').POST
let update: typeof import('@/app/api/submissions/[id]/route').PUT
let get: typeof import('@/app/api/submissions/[id]/route').GET
let decide: typeof import('@/app/api/admin/submissions/[id]/route').POST
const id = 'a1b7a034-5a5b-413b-b8b7-56d9d881c911'
const other = 'a1b7a034-5a5b-413b-b8b7-56d9d881c912'
const token = 'a'.repeat(43)
const admin = 'b'.repeat(43)
const input = { id, creatorName: '架空の作者', title: "架空の曲名 '; DROP TABLE song; --", artist: '<script>alert(1)</script>', level: '5+', youtubeUrl: 'https://youtu.be/abcdefghijk', txtContent: '10\nあ/い/う/え/1\n!/!/!/!/999.9\n', turnstileToken: 'valid' }
const request = (body?: unknown, secret = token, method = 'POST') => new Request('https://example.test/api/submissions/', {
  method, headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
  ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
})
const context = (value = id) => ({ params: Promise.resolve({ id: value }) })
const approve = (revision = 1, gameSongId = '001') => decide(request({ action: 'approve', revision, gameSongId }, admin), context())
let rankingFails = false
let rankingCalls = 0

describe.skipIf(!database)('submission workflow with PostgreSQL', () => {
  beforeAll(async () => {
    if (!database || !new URL(database).pathname.endsWith('_test')) throw new Error('Use a disposable *_test database')
    vi.stubEnv('DATABASE_URL', database)
    vi.stubEnv('SUBMISSIONS_ENABLED', 'true')
    vi.stubEnv('SUBMISSION_RATE_SECRET', 'c'.repeat(43))
    vi.stubEnv('SUBMISSION_ADMIN_KEY', admin)
    vi.stubEnv('RANKING_ADMIN_API_KEY', 'test-ranking-key')
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'test-secret')
    vi.stubEnv('TURNSTILE_HOSTNAME', 'example.test')
    vi.stubEnv('VERCEL', '')
    db = (await import('@/lib/db')).prisma
    create = (await import('@/app/api/submissions/route')).POST
    const owned = await import('@/app/api/submissions/[id]/route')
    update = owned.PUT; get = owned.GET
    decide = (await import('@/app/api/admin/submissions/[id]/route')).POST
  })
  beforeEach(async () => {
    rankingFails = false; rankingCalls = 0
    vi.stubEnv('SUBMISSION_DAILY_LIMIT', '50'); vi.stubEnv('SUBMISSION_IP_DAILY_LIMIT', '5'); vi.stubEnv('SUBMISSION_TOTAL_LIMIT', '2000')
    await db.chartSubmission.deleteMany(); await db.submissionQuota.deleteMany(); await db.song.deleteMany()
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => {
      if (String(url).includes('siteverify')) return Response.json({ success: true, hostname: 'example.test', action: 'chart-submit' })
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
    if (db) { await db.chartSubmission.deleteMany(); await db.submissionQuota.deleteMany(); await db.song.deleteMany(); await db.$disconnect() }
    vi.unstubAllGlobals(); vi.unstubAllEnvs()
  })
  it('stores an anonymous pending submission, literal symbols and only the token hash; retry does not duplicate', async () => {
    expect((await create(request(input))).status).toBe(201)
    const row = await db.chartSubmission.findUniqueOrThrow({ where: { id } })
    expect(row).toMatchObject({ title: input.title, artist: input.artist, status: 'pending', revision: 1 })
    expect(row.editTokenHash).not.toBe(token)
    expect(await db.song.count()).toBe(0)
    expect((await create(request(input))).status).toBe(201)
    expect(await db.chartSubmission.count()).toBe(1)
    expect((await db.submissionQuota.findMany()).map(row => row.count)).toEqual([1, 1])
    expect(rankingCalls).toBe(0)
  })
  it('retains the exact published song number for revision proposals and rejects missing targets', async () => {
    expect((await create(request({ ...input, gameSongId: '001' }))).status).toBe(404)
    expect((await create(request({ ...input, gameSongId: 1 }))).status).toBe(400)
    await db.song.create({ data: { gameSongId: '001', title: '公開曲', youtubeUrl: input.youtubeUrl, scoreEntries: '[]', scoreTxt: input.txtContent } })
    expect((await create(request({ ...input, gameSongId: '001' }))).status).toBe(201)
    expect((await create(request({ ...input, gameSongId: '001' }))).status).toBe(201)
    expect((await create(request({ ...input, gameSongId: '0001' }))).status).toBe(409)
    expect((await update(request({ ...input, revision: 1, gameSongId: '0001' }, token, 'PUT'), context())).status).toBe(200)
    expect((await db.chartSubmission.findUniqueOrThrow({ where: { id } })).gameSongId).toBe('001')
    expect((await db.song.findUniqueOrThrow({ where: { gameSongId: '001' } })).title).toBe('公開曲')
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
    const changed = { ...input, title: '架空の修正', revision: 1 }
    expect((await update(request(changed, token, 'PUT'), context())).status).toBe(200)
    expect((await update(request(changed, token, 'PUT'), context())).status).toBe(200)
    expect((await update(request({ ...input, revision: 1 }, token, 'PUT'), context())).status).toBe(409)
    expect((await approve(1)).status).toBe(409)
    expect(rankingCalls).toBe(0)
    expect((await approve(2)).status).toBe(200)
  })
  it('atomically publishes the complete chart and deletes the submission and edit access', async () => {
    await create(request(input))
    const response = await approve()
    expect(response.status).toBe(200)
    const publicSong = await db.song.findFirstOrThrow()
    expect(publicSong).toMatchObject({ title: input.title, artist: input.artist, level: input.level, youtubeUrl: 'https://www.youtube.com/watch?v=abcdefghijk', gameSongId: '001', creatorName: input.creatorName, scoreTxt: input.txtContent })
    expect(JSON.parse(publicSong.scoreEntries).length).toBeGreaterThan(0)
    expect(await response.json()).toEqual({ status: 'approved', gameSongId: '001' })
    expect(await db.chartSubmission.count()).toBe(0)
    expect((await get(request(undefined, token, 'GET'), context())).status).toBe(404)
    expect((await update(request({ ...input, title: '修正版', revision: 1 }, token, 'PUT'), context())).status).toBe(404)
    expect((await approve()).status).toBe(404)
    expect(await db.song.count()).toBe(1)
    expect(rankingCalls).toBe(1)
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
    await db.song.create({ data: { gameSongId: '001', title: '公開中', youtubeUrl: input.youtubeUrl, scoreEntries: '[]' } })
    await create(request(input))
    await db.chartSubmission.update({ where: { id }, data: { gameSongId: '001' } })
    expect((await decide(request({ action: 'reject', revision: 1 }, admin), context())).status).toBe(200)
    expect((await db.song.findFirstOrThrow()).title).toBe('公開中')
    expect((await update(request({ ...input, revision: 1, title: '再修正版' }, token, 'PUT'), context())).status).toBe(200)
    expect((await db.song.findFirstOrThrow()).title).toBe('公開中')
    expect((await approve(2)).status).toBe(200)
    expect((await db.song.findFirstOrThrow()).title).toBe('再修正版')
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
    vi.stubGlobal('fetch', vi.fn(async (url: string | URL, init?: RequestInit) => String(url).includes('siteverify') ? successfulFetch(url, init) : Response.json({ error: 'conflict' }, { status: 409 })))
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
    expect((await db.submissionQuota.findMany()).map(row => row.count)).toEqual([1, 1])
  })
  it('updates an imported public song by its game number without an internal ID link', async () => {
    await db.song.create({ data: { gameSongId: '001', title: '架空の既存曲', youtubeUrl: input.youtubeUrl, scoreEntries: '[]' } })
    await create(request(input))
    await db.chartSubmission.update({ where: { id }, data: { gameSongId: '001' } })
    expect((await db.song.findUniqueOrThrow({ where: { gameSongId: '001' } })).title).toBe('架空の既存曲')
    expect((await approve()).status).toBe(200)
    expect(await db.song.count()).toBe(1)
    expect(await db.song.findUniqueOrThrow({ where: { gameSongId: '001' } })).toMatchObject({ title: input.title, gameSongId: '001' })
    expect(await db.chartSubmission.count()).toBe(0)
  })
  it('allows multiple proposals for the same public song and serializes duplicate approvals', async () => {
    await db.song.create({ data: { gameSongId: '001', title: '公開中', youtubeUrl: input.youtubeUrl, scoreEntries: '[]' } })
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
      if (!String(url).includes('siteverify')) { entered(); await blocked }
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
    expect((await decide(request({ action: 'approve', revision: 1, gameSongId: '001' }, admin), context(other))).status).toBe(200)
    expect((await db.song.findUniqueOrThrow({ where: { gameSongId: '001' } })).title).toBe('別の修正案')
    expect((await approve()).status).toBe(404)
    expect(rankingCalls).toBe(2)
  })
  it('blocks another proposal while a failed approval for the same song needs retry', async () => {
    await db.song.create({ data: { gameSongId: '001', title: '公開中', youtubeUrl: input.youtubeUrl, scoreEntries: '[]' } })
    await create(request(input)); await create(request({ ...input, id: other }))
    await db.chartSubmission.updateMany({ data: { gameSongId: '001' } })
    rankingFails = true
    expect((await approve()).status).toBe(502)
    rankingFails = false
    expect((await decide(request({ action: 'approve', revision: 1, gameSongId: '001' }, admin), context(other))).status).toBe(409)
    expect(rankingCalls).toBe(1)
    expect((await approve()).status).toBe(200)
    expect((await decide(request({ action: 'approve', revision: 1, gameSongId: '001' }, admin), context(other))).status).toBe(200)
  })
  it('lists public song numbers in numeric order across pages and searches the displayed numbers', async () => {
    const { getSongsPage, getRandomSongs } = await vi.importActual<typeof import('@/lib/songQueries')>('@/lib/songQueries')
    for (const gameSongId of ['1000', '099', '010', '001', '100', '0001']) {
      await db.song.create({ data: { title: `曲${gameSongId}`, artist: 'カタカナ', level: '5+', levelValue: 15, youtubeUrl: input.youtubeUrl, scoreEntries: '[]', gameSongId } })
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
    const songs = ['001', '0001'].map(gameSongId => ({ ...input, gameSongId, title: '同名の別曲' }))
    const imported = await importSongs(adminRequest({ songs }))
    expect((await imported.json()).results.map((song: { gameSongId: string }) => song.gameSongId)).toEqual(['001', '0001'])
    expect(await db.song.count()).toBe(2)
    expect((await getSongByGameSongId('001'))?.gameSongId).toBe('001')
    expect(await getSongByGameSongId('1')).toBeNull()
    await importSongs(adminRequest({ songs: [{ ...songs[0], title: '更新された曲' }] }))
    expect((await getSongByGameSongId('001'))?.title).toBe('更新された曲')
    expect((await getSongByGameSongId('0001'))?.title).toBe('同名の別曲')
    const levelResponse = await updateLevels(adminRequest({ songs: [{ gameSongId: '001', level: '7+' }, { id: 1, level: '9' }] }, 'PATCH'))
    const result = await levelResponse.json()
    expect(result.updated).toHaveLength(1)
    expect(result.updated[0]).toMatchObject({ gameSongId: '001', level: '7+' })
    expect(result.errors).toHaveLength(1)
    expect((await getSongByGameSongId('0001'))?.level).toBe(input.level)
    expect((await getSongByGameSongId('001'))).not.toHaveProperty('id')
  })
  it('requires administrator authorization before reading the body', async () => {
    expect((await decide(request({ action: 'approve', revision: 1, gameSongId: '001' }), context())).status).toBe(401)
    expect(rankingCalls).toBe(0)
  })
  it('enforces daily limits under concurrent requests without retaining rejected rows', async () => {
    vi.stubEnv('SUBMISSION_DAILY_LIMIT', '1')
    const responses = await Promise.all([create(request(input)), create(request({ ...input, id: other }))])
    expect(responses.map(row => row.status).sort()).toEqual([201, 429])
    expect(await db.chartSubmission.count()).toBe(1)
    expect((await db.submissionQuota.findMany()).map(row => row.count)).toEqual([1, 1])
  })
  it('counts edits toward the IP limit and bounds total submissions', async () => {
    vi.stubEnv('SUBMISSION_IP_DAILY_LIMIT', '1')
    await create(request(input))
    expect((await update(request({ ...input, revision: 1 }, token, 'PUT'), context())).status).toBe(429)
    expect((await db.chartSubmission.findUniqueOrThrow({ where: { id } })).revision).toBe(1)
    vi.stubEnv('SUBMISSION_IP_DAILY_LIMIT', '5'); vi.stubEnv('SUBMISSION_TOTAL_LIMIT', '1')
    expect((await create(request({ ...input, id: other }))).status).toBe(429)
    expect(await db.chartSubmission.count()).toBe(1)
  })
})
