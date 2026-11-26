import 'server-only'
import { selectRows } from './supabase-server'

export type Student = {
  studentId: string
  universityEmail: string
  displayName: string
}

type StudentRecord = {
  student_id: string
  university_email: string
  display_name: string
}

export async function findStudentByEmail(email: string): Promise<Student | null> {
  const normalizedEmail = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+$/.test(normalizedEmail)) return null

  const rows = await selectRows<StudentRecord>('eligible_students', {
    select: 'student_id,university_email,display_name',
    university_email: `eq.${normalizedEmail}`,
    limit: '1',
  })
  const row = rows[0]
  if (!row) return null
  if (!row.student_id || !row.university_email || !row.display_name) {
    throw new Error('The student eligibility row is incomplete.')
  }

  return {
    studentId: row.student_id,
    universityEmail: row.university_email.trim().toLowerCase(),
    displayName: row.display_name.trim(),
  }
}

export async function studentNamesById(studentIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(studentIds)].filter(id => /^[\w./-]{1,80}$/.test(id))
  if (!ids.length) return new Map()

  const rows = await selectRows<Pick<StudentRecord, 'student_id' | 'display_name'>>('eligible_students', {
    select: 'student_id,display_name',
    student_id: `in.(${ids.join(',')})`,
  })
  return new Map(rows.map(row => [row.student_id, row.display_name]))
}
