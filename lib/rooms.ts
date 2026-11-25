import 'server-only'
import type { PoolClient } from 'pg'
import { pool } from './database'
import { bookingOpen } from './config'
import type { Booking, Inventory, Room, RoomDetail } from './types'

type RoomRecord = { id: string; room_label: string; hostel: string; floor: string | null; active: boolean; capacity: number }
type Occupied = { student_id: string; slot: number; display_name: string | null }
function roomView(room: RoomRecord, occupied: number): Room {
  return { id: room.id, label: room.room_label, hostel: room.hostel, floor: room.floor, occupied, capacity: room.capacity,
    status: !room.active ? 'unavailable' : occupied >= room.capacity ? 'full' : occupied > 0 ? 'partial' : 'empty' }
}
function bookingView(room: RoomRecord, date: Date | string): Booking {
  return { roomId: room.id, roomLabel: room.room_label, hostel: room.hostel, floor: room.floor, confirmedAt: new Date(date).toISOString() }
}
export async function inventory(): Promise<Inventory> {
  const { rows } = await pool().query<RoomRecord & { occupied: number }>(
    'SELECT r.*, count(b.student_id)::int AS occupied FROM rooms r LEFT JOIN bookings b ON r.id = b.room_id GROUP BY r.id')
  return { rooms: rows.map(r => roomView(r, r.occupied)), bookingOpen: bookingOpen() }
}
export async function roomDetail(roomId: string, studentId: string): Promise<RoomDetail | null> {
  const { rows } = await pool().query<RoomRecord & { occupants: Occupied[] }>(`
    SELECT r.*, COALESCE(
      json_agg(json_build_object('student_id', b.student_id, 'slot', b.slot, 'display_name', es.display_name) ORDER BY b.slot)
        FILTER (WHERE b.student_id IS NOT NULL), '[]'
    ) AS occupants
    FROM rooms r LEFT JOIN bookings b ON r.id = b.room_id LEFT JOIN eligible_students es ON es.student_id = b.student_id WHERE r.id = $1 GROUP BY r.id`, [roomId])
  const room = rows[0]
  const occupied = room?.occupants ?? []
  if (!room) return null
  return { ...roomView(room, occupied.length), occupants: occupied.map(b => ({
    displayName: b.display_name ?? 'Occupied', isYou: b.student_id === studentId,
  })) }
}
export async function existingBooking(studentId: string, client?: PoolClient): Promise<Booking | null> {
  const { rows } = await (client ?? pool()).query<RoomRecord & { created_at: Date }>(
    'SELECT r.*, b.created_at FROM bookings b JOIN rooms r ON r.id = b.room_id WHERE b.student_id = $1', [studentId])
  return rows[0] ? bookingView(rows[0], rows[0].created_at) : null
}
type BookingResult =
  | { status: 200 | 201; booking: Booking }
  | { status: 409; code: 'ALREADY_BOOKED'; booking: Booking }
  | { status: 403 | 404 | 409; code: 'BOOKING_CLOSED' | 'ROOM_NOT_FOUND' | 'ROOM_UNAVAILABLE' | 'ROOM_FULL' }
function retry(booking: Booking, roomId: string): BookingResult {
  return booking.roomId === roomId ? { status: 200, booking } : { status: 409, code: 'ALREADY_BOOKED', booking }
}
function available(room: RoomRecord | undefined) {
  if (!bookingOpen()) return { status: 403, code: 'BOOKING_CLOSED' } as const
  if (!room) return { status: 404, code: 'ROOM_NOT_FOUND' } as const
  if (!room.active) return { status: 409, code: 'ROOM_UNAVAILABLE' } as const
  return null
}
export async function book(roomId: string, studentId: string): Promise<BookingResult> {
  const client = await pool().connect()
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED')
    const result = await claim(client, roomId, studentId)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}
async function claim(client: PoolClient, roomId: string, studentId: string): Promise<BookingResult> {
  const { rows: [room] } = await client.query<RoomRecord>('SELECT * FROM rooms WHERE id = $1 FOR UPDATE', [roomId])
  const existing = await existingBooking(studentId, client)
  if (existing) return retry(existing, roomId)
  const failure = available(room)
  if (failure) return failure
  const { rows: occupied } = await client.query<{ slot: number }>('SELECT slot FROM bookings WHERE room_id = $1', [roomId])
  const slot = Array.from({ length: room!.capacity }, (_, index) => index + 1).find(number => !occupied.some(row => row.slot === number))
  if (!slot) return { status: 409, code: 'ROOM_FULL' }
  const { rows: [inserted] } = await client.query<{ created_at: Date }>(
    'INSERT INTO bookings (student_id, room_id, slot) VALUES ($1, $2, $3) ON CONFLICT (student_id) DO NOTHING RETURNING created_at', [studentId, roomId, slot])
  if (inserted) return { status: 201, booking: bookingView(room, inserted.created_at) }
  const confirmed = await existingBooking(studentId, client)
  if (!confirmed) throw new Error('Booking could not be reconciled.')
  return retry(confirmed, roomId)
}
