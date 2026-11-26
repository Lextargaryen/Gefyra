import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { databaseConfig } from '../lib/database-config.mjs'
import { validateRoster, importRoster } from './roster.mjs'

const [input, ...flags] = process.argv.slice(2)
let client
try {
  if (!input || input.startsWith('--') || flags.some(flag => !['--validate', '--dry-run'].includes(flag)) || flags.length > 1) {
    throw new Error('Usage: npm run db:students -- /private/path/eligible-students.json [--validate|--dry-run]')
  }
  let records
  try { records = JSON.parse(await readFile(input, 'utf8')) }
  catch { throw new Error('Could not read a valid JSON roster file.') }
  const students = validateRoster(records)
  if (flags.includes('--validate')) {
    console.log(`Validated ${students.length} unique students. No database connection or changes.`)
  } else {
    client = new pg.Client({ ...databaseConfig(true), connectionTimeoutMillis: 10_000 })
    try { await client.connect() } catch { throw new Error('Could not connect to the database; check the server-only maintenance configuration.') }
    const counts = await importRoster(client, students, { dryRun: flags.includes('--dry-run') })
    console.log(JSON.stringify(counts))
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await client?.end()
}
