import 'server-only'
import { bookingOpen } from './config'
import { selectRows, insertRows, updateBooking } from './supabase-server'
import { studentNamesById } from './students'
import type { Booking, Inventory, Room, RoomDetail } from './types'

type RoomRecord = { id: string; room_label: string; hostel: string; floor: string | null; active: boolean; capacity: number }
type BookingRecord = { student_id: string; room_id: string; slot: number; created_at: string }
function roomView(room: RoomRecord, occupied: number): Room {
  return { id: room.id, label: room.room_label, hostel: room.hostel, floor: room.floor, occupied, capacity: room.capacity,
    status: !room.active ? 'unavailable' : occupied >= room.capacity ? 'full' : occupied > 0 ? 'partial' : 'empty' }
}
function bookingView(room: RoomRecord, date: Date | string): Booking {
  return { roomId: room.id, roomLabel: room.room_label, hostel: room.hostel, floor: room.floor, confirmedAt: new Date(date).toISOString() }
}
async function roomById(roomId: string) {
  const rows = await selectRows<RoomRecord>('rooms', {
    select: 'id,room_label,hostel,floor,active,capacity',
    id: `eq.${roomId}`,
    limit: '1',
  })
  return rows[0]
}
async function bookingsForRoom(roomId: string) {
  return selectRows<Pick<BookingRecord, 'student_id' | 'slot'>>('bookings', {
    select: 'student_id,slot',
    room_id: `eq.${roomId}`,
    order: 'slot.asc',
  })
}
export async function inventory(): Promise<Inventory> {
  const [rooms, bookings] = await Promise.all([
    selectRows<RoomRecord>('rooms', { select: 'id,room_label,hostel,floor,active,capacity' }),
    selectRows<Pick<BookingRecord, 'room_id'>>('bookings', { select: 'room_id' }),
  ])
  const occupied = new Map<string, number>()
  for (const booking of bookings) occupied.set(booking.room_id, (occupied.get(booking.room_id) ?? 0) + 1)
  return { rooms: rooms.map(room => roomView(room, occupied.get(room.id) ?? 0)), bookingOpen: bookingOpen() }
}
export async function roomDetail(roomId: string, studentId: string): Promise<RoomDetail | null> {
  const [room, occupants] = await Promise.all([roomById(roomId), bookingsForRoom(roomId)])
  if (!room) return null
  const names = await studentNamesById(occupants.map(occupant => occupant.student_id))
  return { ...roomView(room, occupants.length), occupants: occupants.map(occupant => ({
    displayName: names.get(occupant.student_id) ?? 'Occupied', isYou: occupant.student_id === studentId,
  })) }
}
async function bookingRecord(studentId: string) {
  const bookings = await selectRows<Pick<BookingRecord, 'room_id' | 'created_at'>>('bookings', {
    select: 'room_id,created_at',
    student_id: `eq.${studentId}`,
    limit: '1',
  })
  return bookings[0]
}
export async function existingBooking(studentId: string): Promise<Booking | null> {
  const booking = await bookingRecord(studentId)
  if (!booking) return null
  const room = await roomById(booking.room_id)
  if (!room) throw new Error('The booked room is unavailable.')
  return bookingView(room, booking.created_at)
}
type BookingResult =
  | { status: 200 | 201; booking: Booking }
  | { status: 409; code: 'ALREADY_BOOKED'; booking: Booking }
  | { status: 409; code: 'BOOKING_CHANGED'; booking: Booking | null }
  | { status: 403 | 404 | 409; code: 'BOOKING_CLOSED' | 'ROOM_NOT_FOUND' | 'ROOM_UNAVAILABLE' | 'ROOM_FULL' }
function retry(booking: Booking, roomId: string): BookingResult {
  return booking.roomId === roomId ? { status: 200, booking } : { status: 409, code: 'ALREADY_BOOKED', booking }
}
function availability(room: RoomRecord | undefined) {
  if (!bookingOpen()) return { status: 403, code: 'BOOKING_CLOSED' } as const
  if (!room) return { status: 404, code: 'ROOM_NOT_FOUND' } as const
  if (!room.active) return { status: 409, code: 'ROOM_UNAVAILABLE' } as const
  return null
}
export async function book(roomId: string, studentId: string, fromRoomId?: string): Promise<BookingResult> {
  if (fromRoomId !== undefined) return changeRoom(roomId, studentId, fromRoomId)
  const existing = await existingBooking(studentId)
  if (existing) return retry(existing, roomId)

  for (let attempt = 0; attempt < 4; attempt++) {
    const room = await roomById(roomId)
    const failure = availability(room)
    if (failure) return failure

    const occupied = await bookingsForRoom(roomId)
    const slots = new Set(occupied.map(booking => booking.slot))
    const slot = Array.from({ length: room!.capacity }, (_, index) => index + 1).find(value => !slots.has(value))
    if (!slot) return { status: 409, code: 'ROOM_FULL' }

    const inserted = await insertRows<Pick<BookingRecord, 'created_at'>>('bookings', {
      student_id: studentId,
      room_id: roomId,
      slot,
    })
    if (inserted?.[0]) return { status: 201, booking: bookingView(room!, inserted[0].created_at) }

    const confirmed = await existingBooking(studentId)
    if (confirmed) return retry(confirmed, roomId)
  }

  return { status: 409, code: 'ROOM_FULL' }
}

async function changeRoom(roomId: string, studentId: string, fromRoomId: string): Promise<BookingResult> {
  const original = await bookingRecord(studentId)
  const source = original ? await roomById(original.room_id) : undefined
  const existing = original && source ? bookingView(source, original.created_at) : null
  if (existing?.roomId === roomId) return { status: 200, booking: existing }
  if (!existing || existing.roomId !== fromRoomId) return { status: 409, code: 'BOOKING_CHANGED', booking: existing }

  for (let attempt = 0; attempt < 4; attempt++) {
    const room = await roomById(roomId)
    const failure = availability(room)
    if (failure) return failure
    const occupied = await bookingsForRoom(roomId)
    const slots = new Set(occupied.map(booking => booking.slot))
    const slot = Array.from({ length: room!.capacity }, (_, index) => index + 1).find(value => !slots.has(value))
    if (!slot) return { status: 409, code: 'ROOM_FULL' }

    // One atomic UPDATE retains the original booking if the destination slot is taken.
    // Compare both the room and confirmation time to reject stale or competing edits.
    const updated = await updateBooking<Pick<BookingRecord, 'created_at'>>({
      student_id: `eq.${studentId}`,
      room_id: `eq.${fromRoomId}`,
      created_at: `eq.${original!.created_at}`,
    }, { room_id: roomId, slot, created_at: new Date(Math.max(Date.now(), Date.parse(original!.created_at) + 1)).toISOString() })
    if (updated?.[0]) return { status: 200, booking: bookingView(room!, updated[0].created_at) }

    const confirmed = await existingBooking(studentId)
    if (confirmed?.roomId === roomId) return { status: 200, booking: confirmed }
    if (!confirmed || confirmed.roomId !== fromRoomId || confirmed.confirmedAt !== existing.confirmedAt) {
      return { status: 409, code: 'BOOKING_CHANGED', booking: confirmed }
    }
  }
  return { status: 409, code: 'ROOM_FULL' }
}
