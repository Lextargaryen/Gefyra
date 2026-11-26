// Private input validation and database import. Never log roster values.
export function validateRoster(records) {
  if (!Array.isArray(records) || !records.length) throw new Error('Expected a nonempty roster array.')
  const ids = new Set()
  const emails = new Set()
  return records.map((record, index) => {
    const studentId = typeof record?.studentId === 'string' ? record.studentId : ''
    const universityEmail = typeof record?.universityEmail === 'string' ? record.universityEmail.trim().toLowerCase() : ''
    const displayName = typeof record?.displayName === 'string' ? record.displayName : ''
    if (!/^[\w./-]{1,80}$/.test(studentId) || /^demo-/i.test(studentId) ||
      !displayName.trim() || displayName.length > 120 || !/^[^\s@]+@[^\s@]+$/.test(universityEmail)) {
      throw new Error(`Invalid roster fields at entry ${index + 1}.`)
    }
    if (ids.has(studentId) || emails.has(universityEmail)) throw new Error(`Duplicate ID or normalized email at entry ${index + 1}.`)
    ids.add(studentId)
    emails.add(universityEmail)
    return { studentId, universityEmail, displayName }
  })
}

export async function importRoster(client, records, { dryRun = false } = {}) {
  const students = validateRoster(records)
  await client.query('BEGIN')
  try {
    await client.query('LOCK TABLE eligible_students IN SHARE ROW EXCLUSIVE MODE')
    const { rows: existing } = await client.query('SELECT student_id, university_email FROM eligible_students')
    const owners = new Map(existing.map(row => [row.university_email, row.student_id]))
    const knownIds = new Set(existing.map(row => row.student_id))
    for (const student of students) {
      const owner = owners.get(student.universityEmail)
      if (owner && owner !== student.studentId) throw new Error('Email belongs to a different student ID. Resolve ownership before importing.')
    }
    const { rows: bookings } = await client.query('SELECT student_id FROM bookings')
    const inputIds = new Set(students.map(student => student.studentId))
    // Detect the legacy E/24/001 form without rewriting existing bookings.
    const canonical = id => id.replace(/^E\/24\/(\d+)$/, 'E24-$1')
    if (bookings.some(row => !inputIds.has(row.student_id) && inputIds.has(canonical(row.student_id)))) {
      throw new Error('Existing bookings use legacy E/24/... IDs. Coordinate an ID migration before importing; no changes were saved.')
    }
    for (const student of students) {
      await client.query(`INSERT INTO eligible_students (student_id, university_email, display_name)
        VALUES ($1, $2, $3) ON CONFLICT (student_id) DO UPDATE
        SET university_email = EXCLUDED.university_email, display_name = EXCLUDED.display_name`,
      [student.studentId, student.universityEmail, student.displayName])
    }
    const inserted = students.filter(student => !knownIds.has(student.studentId)).length
    const unmatchedBookings = bookings.filter(row => !inputIds.has(row.student_id) && !knownIds.has(row.student_id)).length
    await client.query(dryRun ? 'ROLLBACK' : 'COMMIT')
    return { total: students.length, inserted, updated: students.length - inserted, unmatchedBookings, dryRun }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    // Raw database errors can contain private row values; never expose them.
    if (error.code) throw new Error('Roster import failed a database check. Transaction rolled back; no roster values logged.')
    throw error
  }
}
