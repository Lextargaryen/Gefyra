import { readFile } from 'node:fs/promises'
import pg from 'pg'

const [command, input] = process.argv.slice(2)
const url = process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL
if (!url || !['migrate', 'import'].includes(command) || (command === 'import' && !input)) {
  console.error('Set DATABASE_URL and run npm run db:migrate or npm run db:import -- rooms.json.')
  process.exit(1)
}
const client = new pg.Client({ connectionString: url })
try {
  await client.connect()
  if (command === 'migrate') {
    await client.query(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'))
    console.log('Schema ready.')
  } else {
    const records = JSON.parse(await readFile(input, 'utf8'))
    if (!Array.isArray(records) || !records.length) throw new Error('Expected a nonempty room array.')
    const ids = new Set()
    const labels = new Set()
    const rooms = records.map(record => {
      const id = record?.id?.trim?.()
      const label = record?.roomLabel?.trim?.()
      const hostel = record?.hostel?.trim?.()
      const floor = record?.floor == null ? null : record.floor.trim()
      const active = record?.active ?? true
      const capacity = record?.capacity ?? 3
      const key = JSON.stringify([hostel?.toLowerCase(), label?.toLowerCase()])
      if (!id || !/^[\w-]{1,100}$/.test(id) || !label || !hostel || label.length > 100 || hostel.length > 100 ||
        floor?.length > 100 || typeof active !== 'boolean' || !Number.isInteger(capacity) || capacity < 1 || capacity > 4 || ids.has(id) || labels.has(key)) throw new Error('A room has invalid or duplicate fields.')
      ids.add(id)
      labels.add(key)
      return [id, label, hostel, floor || null, active, capacity]
    })
    await client.query('BEGIN')
    for (const room of rooms) {
      const result = await client.query(`INSERT INTO rooms (id, room_label, hostel, floor, active, capacity) VALUES ($1,$2,$3,$4,$5,$6)
        ON CONFLICT(id) DO UPDATE SET room_label = EXCLUDED.room_label, hostel = EXCLUDED.hostel,
        floor = EXCLUDED.floor, active = EXCLUDED.active, capacity = EXCLUDED.capacity
        WHERE NOT EXISTS (SELECT 1 FROM bookings WHERE room_id = rooms.id AND slot > EXCLUDED.capacity)
        RETURNING id`, room)
      if (!result.rowCount) throw new Error(`Cannot reduce capacity for ${room[0]} while a higher slot is occupied.`)
    }
    await client.query('COMMIT')
    console.log(`Imported ${rooms.length} rooms.`)
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined)
  console.error(error.message)
  process.exitCode = 1
} finally {
  await client.end()
}
