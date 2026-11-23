export type Status = 'empty' | 'partial' | 'full' | 'unavailable'
export type Room = { id: string; label: string; hostel: string; floor: string | null; occupied: number; capacity: number; status: Status }
export type RoomDetail = Room & { occupants: { displayName: string; isYou: boolean }[] }
export type Booking = { roomId: string; roomLabel: string; hostel: string; floor: string | null; confirmedAt: string }
export type Inventory = { rooms: Room[]; bookingOpen: boolean }
export const statusLabels: Record<Status, string> = { empty: 'Available', partial: 'Partly occupied', full: 'Full', unavailable: 'Unavailable' }
