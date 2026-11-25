import 'server-only'
import { pool } from './database'
import type { Student } from './config'

export async function activeStudent(email: string): Promise<Student | null> {
  const { rows } = await pool().query<Student>(`
    SELECT student_id AS "studentId", university_email AS "universityEmail", display_name AS "displayName"
    FROM eligible_students WHERE university_email = $1 AND active = true`, [email.trim().toLowerCase()])
  return rows[0] ?? null
}
