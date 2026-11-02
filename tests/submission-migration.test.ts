// Runs only on a disposable *_test database; each case uses its own isolated schema.
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { createScoreTxt, parseScoreTxt } from '@/lib/scoreFormat'
import type { Prisma, PrismaClient } from '@prisma/client'

const database = process.env.SUBMISSION_TEST_DATABASE_URL
let db: PrismaClient
const sql = (name: string) => readFileSync(new URL(`../prisma/migrations/${name}/migration.sql`, import.meta.url), 'utf8')
const statements = (script: string) => script.replace(/--[^\n]*/g, '').split(';').map(part => part.trim()).filter(part => part && !['BEGIN', 'COMMIT'].includes(part))
const apply = async (tx: Prisma.TransactionClient, script: string) => {
  for (const statement of statements(script)) await tx.$executeRawUnsafe(statement)
}

describe.skipIf(!database)('game song primary key migration', () => {
  beforeAll(async () => {
    if (!database || !new URL(database).pathname.endsWith('_test')) throw new Error('Use a disposable *_test database')
    vi.stubEnv('DATABASE_URL', database)
    db = (await import('@/lib/db')).prisma
  })
  afterAll(async () => { if (db) await db.$disconnect(); vi.unstubAllEnvs() })
  it.each(['valid', 'missing', 'duplicate', 'invalid-score'] as const)('preserves existing data for %s game number mapping', async mode => {
    const pages = [{ id: 'first', timestamp: 2.25, lyrics: ['あ', '', '装飾/\\', 'う'], decorations: [false, false, true, false], decorationAligns: ['l', 'l', 'c', 'l'] }, { id: 'intro', timestamp: 0, lyrics: ['', 'い', '', ''] }]
    const expectedTxt = createScoreTxt(7.25, pages as Parameters<typeof createScoreTxt>[1], [])
    const schema = `migration_${randomUUID().replaceAll('-', '')}`
    const inSchema = <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => db.$transaction(async tx => {
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`)
      return fn(tx)
    })
    await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
    try {
      await inSchema(async tx => {
        await apply(tx, sql('20251201000000_init'))
        await apply(tx, sql('20260103000000_rename_song_table'))
        await tx.$executeRawUnsafe('ALTER TABLE song ADD COLUMN "gameSongId" TEXT')
        await tx.$executeRaw`INSERT INTO song (id, title, "youtubeUrl", "scoreEntries", "updatedAt", "gameSongId") VALUES (71, '保存する譜面', 'https://youtu.be/abcdefghijk', ${mode === 'invalid-score' ? '[{"timestamp":1,"lyrics":["あ"]}]' : JSON.stringify(pages)}, NOW(), ${mode === 'missing' ? null : '001'})`
        if (mode === 'duplicate') await tx.$executeRawUnsafe(`INSERT INTO song (id, title, "youtubeUrl", "scoreEntries", "updatedAt", "gameSongId") VALUES (99, '別曲', 'https://youtu.be/abcdefghijk', '[]', NOW(), '001')`)
      })
      const migration = inSchema(tx => apply(tx, sql('20261029000000_chart_submissions')))
      if (mode === 'valid') {
        await migration
        const rows = await inSchema(tx => tx.$queryRaw`SELECT "gameSongId", title, "scoreTxt" FROM song`)
        expect(rows).toEqual([{ gameSongId: '001', title: '保存する譜面', scoreTxt: expectedTxt }])
        const columns = await db.$queryRaw<Array<{ column_name: string }>>`SELECT column_name FROM information_schema.columns WHERE table_schema = ${schema} AND table_name = 'song'`
        const quotaTables = await db.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = ${schema} AND table_name = 'submission_quota'`
        expect(quotaTables).toEqual([])
        expect(columns.map(row => row.column_name)).not.toContain('id')
        expect(columns.map(row => row.column_name)).not.toContain('scoreEntries')
        expect(parseScoreTxt(expectedTxt).scoreEntries.map(page => page.timestamp)).toEqual([0, 2.25])
        expect(columns.map(row => row.column_name)).toContain('notes')
        expect(columns.map(row => row.column_name)).toContain('level')
        const submissionColumns = await db.$queryRaw<Array<{ column_name: string }>>`SELECT column_name FROM information_schema.columns WHERE table_schema = ${schema} AND table_name = 'chart_submission'`
        expect(submissionColumns.map(row => row.column_name)).toContain('level')
        expect(submissionColumns.map(row => row.column_name)).not.toContain('registrationData')
        await expect(inSchema(tx => tx.$executeRawUnsafe(`INSERT INTO song (title, "youtubeUrl", "scoreTxt", "updatedAt", "gameSongId") VALUES ('重複', 'url', '[]', NOW(), '001')`))).rejects.toThrow()
      } else {
        await expect(migration).rejects.toThrow()
        const rows = await inSchema(tx => tx.$queryRaw<Array<{ id: number; title: string }>>`SELECT id, title FROM song ORDER BY id`)
        expect(rows[0]).toEqual({ id: 71, title: '保存する譜面' })
        expect(rows).toHaveLength(mode === 'duplicate' ? 2 : 1)
      }
    } finally { await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`) }
  })
  it('converts only missing TXT on upgraded databases and preserves existing TXT verbatim', async () => {
    const schema = `upgrade_${randomUUID().replaceAll('-', '')}`
    await db.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`)
    const original = '30\nあ/い/う/え/1\n!/!/!/!/999.9\n_\n共有ポップ/2\n'
    try {
      await db.$transaction(async tx => {
        await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`)
        await tx.$executeRawUnsafe('CREATE TABLE song ("gameSongId" TEXT PRIMARY KEY, "scoreEntries" TEXT NOT NULL, "scoreTxt" TEXT)')
        await tx.$executeRaw`INSERT INTO song VALUES ('001', 'not JSON but TXT exists', ${original}), ('002', '[]', NULL)`
        const conversion = sql('20261029000000_chart_submissions').split('-- BEGIN SCORE TXT CONVERSION')[1].split('-- END SCORE TXT CONVERSION')[0]
        await apply(tx, conversion)
        const rows = await tx.$queryRaw<Array<{ gameSongId: string; scoreTxt: string }>>`SELECT * FROM song ORDER BY "gameSongId"`
        expect(rows).toEqual([{ gameSongId: '001', scoreTxt: original }, { gameSongId: '002', scoreTxt: '5.0\n!/!/!/!/999.9\n' }])
      })
    } finally { await db.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`) }
  })

})
