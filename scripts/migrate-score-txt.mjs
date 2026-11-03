// For databases that already applied an earlier version of this PR's migration.
// The conversion and column removal are one transaction; existing TXT is preserved.
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import pg from 'pg'

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
const migration = readFileSync(new URL('../prisma/migrations/20261029000000_chart_submissions/migration.sql', import.meta.url), 'utf8')
const sql = migration.split('-- BEGIN SCORE TXT CONVERSION')[1].split('-- END SCORE TXT CONVERSION')[0]
const client = new pg.Client({ connectionString: process.env.DATABASE_URL })
try {
  await client.connect()
  await client.query('BEGIN')
  const columns = await client.query("SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'song'")
  if (columns.rows.some(row => row.column_name === 'scoreEntries')) {
    await client.query(sql)
    console.log('Converted missing TXT and removed song.scoreEntries.')
  } else {
    console.log('song.scoreEntries is already removed.')
  }
  await client.query('COMMIT')
} catch {
  await client.query('ROLLBACK').catch(() => {})
  console.error('Conversion failed; changes rolled back. Check legacy score data and the database connection.')
  process.exitCode = 1
} finally { await client.end() }
