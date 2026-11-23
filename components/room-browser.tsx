'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { statusLabels, type Booking, type Inventory, type Room, type RoomDetail } from '../lib/types'
import { Icon } from './icon'
import { Occupants } from './occupants'

const sorter = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })
function floorName(floor: string) {
  if (floor.toLowerCase() === 'ground') return 'Ground floor'
  if (floor.toLowerCase() === 'top') return 'Top floor'
  return `Floor ${floor}`
}
function compareFloors(a: string, b: string) {
  const rank = (value: string) => value.toLowerCase() === 'ground' ? -1 : value.toLowerCase() === 'top' ? Infinity : Number(value)
  const first = rank(a)
  const second = rank(b)
  if (!Number.isNaN(first) && !Number.isNaN(second)) return first === second ? 0 : first < second ? -1 : 1
  return sorter.compare(a, b)
}
const mobileQuery = '(max-width: 760px)'
const bookingErrors: Record<string, string> = {
  BOOKING_CLOSED: 'Room booking is currently closed.',
  ROOM_FULL: 'The last place was just taken. Choose another room.',
  ROOM_UNAVAILABLE: 'This room is currently unavailable.',
  ROOM_NOT_FOUND: 'This room is no longer listed.',
}
class RequestError extends Error {
  constructor(readonly status: number) { super('Request failed') }
}
async function read<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { cache: 'no-store', signal })
  if (!response.ok) throw new RequestError(response.status)
  return response.json()
}
function sessionRedirect(error: unknown) {
  if (!(error instanceof RequestError)) return
  if (error.status === 401) window.location.assign('/')
  if (error.status === 403) window.location.assign('/access-denied')
}
function RoomCard({ room, selected, booked, onSelect }: { room: Room; selected: boolean; booked: boolean; onSelect: () => void }) {
  const openSpots = room.capacity - room.occupied
  const hasSpace = room.status === 'empty' || room.status === 'partial'
  const availability = hasSpace ? `${openSpots} ${openSpots === 1 ? 'spot' : 'spots'} open` : statusLabels[room.status]
  return <button className="room-card" type="button" data-status={room.status} aria-pressed={selected}
    aria-label={`Room ${room.label}, ${room.hostel}, ${availability}${booked ? ', your room' : ''}`} onClick={onSelect}>
    <span className="room-card-label">{room.label}</span>
    <span className="room-card-status">{booked ? 'Your room' : hasSpace ? `${openSpots} open` : availability}</span>
    {hasSpace && <span className="room-card-places" aria-hidden="true">{Array.from({ length: room.capacity }, (_, index) => <i key={index} data-occupied={index < room.occupied}/>)}</span>}
  </button>
}

type PanelProps = {
  room?: Room; detail: RoomDetail | null; error: boolean; retry: () => void; open: boolean;
  booking: Booking | null; bookingKnown: boolean; readOnly: boolean; onConfirm: () => void; onClose?: () => void;
}
function RoomPanel({ room, detail, error, retry, open, booking, bookingKnown, readOnly, onConfirm, onClose }: PanelProps) {
  const current = detail?.id === room?.id ? detail : null
  const display = current ?? room
  const available = display?.status === 'empty' || display?.status === 'partial'
  return <>
    <div className="panel-top"><div><Icon name="door" size={18}/><h2>Room details</h2></div>
      {onClose && <button type="button" className="icon-button" aria-label="Close room details" onClick={onClose}><Icon name="close"/></button>}
    </div>
    {display ? <>
      <div className="panel-body">
        <p className="eyebrow">{display.hostel}{display.floor && ' · ' + floorName(display.floor)}</p>
        <h3 className="panel-title">Room {display.label}</h3>
        <div className="panel-occupancy"><span>{display.occupied} of {display.capacity} occupied</span><span className={'status ' + display.status}><i/>{available ? `${display.capacity - display.occupied} open` : statusLabels[display.status]}</span></div>
        <h4>Occupants</h4>
        {error ? <p role="status">We couldn’t load the room details. <button className="text-button" type="button" onClick={retry}>Try again</button></p>
          : current ? <Occupants room={current}/> : <p role="status">Loading occupants…</p>}
      </div>
      <div className="panel-footer">
        {readOnly ? <p>This account has viewing access.</p>
          : booking ? <Link className="button secondary wide" href="/my-room">Open my room <Icon name="arrow" size={17}/></Link>
          : !open ? <p>Room booking is currently closed.</p>
          : display.status === 'full' ? <p>This room is full. Choose another room.</p>
          : display.status === 'unavailable' ? <p>This room is currently unavailable.</p>
          : <button className="button primary wide" type="button" disabled={!current || error || !bookingKnown} onClick={onConfirm}>Confirm room <Icon name="arrow" size={17}/></button>}
      </div>
    </> : <div className="empty-panel">
      <div className="empty-icon"><Icon name="door" size={28}/></div>
      <h3>No room selected</h3><p>Select a room to see who’s in it.</p>
    </div>}
  </>
}

export function RoomBrowser({ initialInventory, initialBooking, initialBookingKnown, readOnly }: {
  initialInventory: Inventory | null; initialBooking: Booking | null; initialBookingKnown: boolean; readOnly: boolean
}) {
  const [inventory, setInventory] = useState(initialInventory)
  const [booking, setBooking] = useState(initialBooking)
  const [bookingKnown, setBookingKnown] = useState(initialBookingKnown)
  const [loadError, setLoadError] = useState(!initialInventory)
  const [hostel, setHostel] = useState('')
  const [floor, setFloor] = useState('')
  const [query, setQuery] = useState('')
  const [hasSpace, setHasSpace] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<RoomDetail | null>(null)
  const [detailError, setDetailError] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [pending, setPending] = useState(false)
  const [notice, setNotice] = useState('')
  const [revision, setRevision] = useState(0)
  const sheetDialog = useRef<HTMLDialogElement>(null)
  const confirmDialog = useRef<HTMLDialogElement>(null)
  const inventoryRequest = useRef<AbortController | null>(null)
  const detailRequest = useRef<AbortController | null>(null)
  const submitLock = useRef(false)

  const refresh = useCallback(async () => {
    inventoryRequest.current?.abort()
    const request = new AbortController()
    inventoryRequest.current = request
    const [rooms, mine] = await Promise.allSettled([
      read<Inventory>('/api/rooms', request.signal),
      read<{ booking: Booking | null }>('/api/me/booking', request.signal),
    ])
    if (request.signal.aborted) return
    if (rooms.status === 'fulfilled') { setInventory(rooms.value); setLoadError(false) }
    else { sessionRedirect(rooms.reason); setLoadError(true) }
    if (mine.status === 'fulfilled') { setBooking(mine.value.booking); setBookingKnown(true) }
    else { sessionRedirect(mine.reason); setBookingKnown(false) }
  }, [])

  useEffect(() => {
    const update = () => {
      if (document.visibilityState === 'visible' && !submitLock.current) {
        void refresh()
        setRevision(value => value + 1)
      }
    }
    const timer = window.setInterval(update, 30_000)
    window.addEventListener('focus', update)
    document.addEventListener('visibilitychange', update)
    return () => {
      inventoryRequest.current?.abort()
      window.clearInterval(timer)
      window.removeEventListener('focus', update)
      document.removeEventListener('visibilitychange', update)
    }
  }, [refresh])
  useEffect(() => {
    if (!selected) return
    const request = new AbortController()
    detailRequest.current = request
    read<RoomDetail>('/api/rooms/' + encodeURIComponent(selected), request.signal).then(room => {
      if (!request.signal.aborted) { setDetail(room); setDetailError(false) }
    }).catch(error => {
      if (!request.signal.aborted) { sessionRedirect(error); setDetailError(true) }
    })
    return () => request.abort()
  }, [selected, revision])
  useEffect(() => {
    const dialog = sheetDialog.current
    if (sheet && !dialog?.open) dialog?.showModal()
    if (!sheet && dialog?.open) dialog.close()
  }, [sheet])
  useEffect(() => {
    const dialog = confirmDialog.current
    if (confirm && !dialog?.open) dialog?.showModal()
    if (!confirm && dialog?.open) dialog.close()
  }, [confirm])
  useEffect(() => {
    const media = window.matchMedia(mobileQuery)
    const resize = () => { if (!media.matches) setSheet(false) }
    media.addEventListener('change', resize)
    return () => media.removeEventListener('change', resize)
  }, [])

  const rooms = inventory?.rooms ?? []
  const selectedRoom = rooms.find(room => room.id === selected)
  const hostels = useMemo(() => [...new Set(rooms.map(room => room.hostel))].sort(sorter.compare), [rooms])
  const floors = useMemo(() => [...new Set(rooms.filter(room => !hostel || room.hostel === hostel).flatMap(room => room.floor ? [room.floor] : []))].sort(compareFloors), [rooms, hostel])
  const filtered = rooms.filter(room => (!hostel || room.hostel === hostel) && (!floor || room.floor === floor) &&
    (!hasSpace || room.status === 'empty' || room.status === 'partial') && room.label.toLowerCase().includes(query.trim().toLowerCase()))
  const groups = hostels.map(name => {
    const grouped = filtered.filter(room => room.hostel === name)
    const levels = [...new Set(grouped.map(room => room.floor))].sort((a,b) => compareFloors(a ?? '', b ?? ''))
    return { name, levels: levels.map(level => ({ level, rooms: grouped.filter(room => room.floor === level).sort((a,b) => sorter.compare(a.label,b.label)) })) }
  }).filter(group => group.levels.length)

  function select(room: Room) {
    if (room.id !== selected) {
      detailRequest.current?.abort()
      setDetail(null)
      setDetailError(false)
      setSelected(room.id)
    }
    setNotice('')
    if (window.matchMedia(mobileQuery).matches) setSheet(true)
  }
  function refreshDetails() {
    setDetailError(false)
    setRevision(value => value + 1)
  }
  async function submit() {
    if (!selectedRoom || submitLock.current) return
    submitLock.current = true
    setPending(true)
    setNotice('')
    inventoryRequest.current?.abort()
    detailRequest.current?.abort()
    try {
      const response = await fetch('/api/bookings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: selectedRoom.id }) })
      const outcome = await response.json()
      if (response.ok && outcome.booking) {
        window.location.assign('/my-room')
        return
      }
      if (outcome.code === 'ALREADY_BOOKED' && outcome.booking) {
        setBooking(outcome.booking)
        setNotice('You already have a confirmed room.')
      } else if (response.status === 401 || outcome.code === 'INELIGIBLE') {
        sessionRedirect(new RequestError(response.status))
        return
      } else if (bookingErrors[outcome.code]) {
        setNotice(bookingErrors[outcome.code])
      } else {
        throw new Error('Booking status needs reconciliation')
      }
    } catch {
      try {
        const result = await read<{ booking: Booking | null }>('/api/me/booking')
        if (result.booking?.roomId === selectedRoom.id) {
          window.location.assign('/my-room')
          return
        }
        setBooking(result.booking)
        setNotice(result.booking ? 'You already have a confirmed room.' : 'We couldn’t save your booking. You can try again.')
      } catch (error) {
        sessionRedirect(error)
        setBookingKnown(false)
        setNotice('We couldn’t verify your booking. Refresh availability before trying again.')
      }
    } finally {
      submitLock.current = false
      setPending(false)
    }
    setConfirm(false)
    await refresh()
    refreshDetails()
  }

  const panel: PanelProps = { room: selectedRoom, detail, error: detailError, retry: refreshDetails,
    open: inventory?.bookingOpen ?? false, booking, bookingKnown, readOnly, onConfirm: () => setConfirm(true) }
  const availability = rooms.filter(room => room.status === 'empty' || room.status === 'partial').length

  return <main id="main" className="room-page">
    <div className="page-intro">
      <div><p className="eyebrow">E24 · Hostel allocation</p><h1>Choose a room</h1><p>Select a room to view its occupants and claim one place.</p></div>
      {inventory && <div className={'allocation-state' + (inventory.bookingOpen ? ' is-open' : '')}><i/>{inventory.bookingOpen ? 'Booking open' : 'Booking closed'}</div>}
    </div>
    {booking && <div className="booking-banner"><span className="banner-icon"><Icon name="check"/></span><div><strong>Your room is confirmed</strong><span>Room {booking.roomLabel} · {booking.hostel}</span></div><Link href="/my-room">Open my room <Icon name="arrow" size={17}/></Link></div>}
    {(!loadError && inventory && !inventory.bookingOpen && !booking) && <p className="notice" role="status">Room booking is currently closed.</p>}
    {(!bookingKnown || loadError) && <div className="notice" role="status">
      {loadError ? 'We couldn’t load the rooms.' : 'We couldn’t verify your booking.'}
      <button className="text-button" type="button" onClick={() => { void refresh(); refreshDetails() }}>Try again</button>
    </div>}
    <div className="room-layout">
      <section className="inventory" aria-labelledby="inventory-title">
        <div className="inventory-heading"><div><h2 id="inventory-title">Explore rooms</h2><p>Dots show occupied and open places.</p></div>{inventory && <span>{availability} rooms with space</span>}</div>
        <div className="filters">
          <label className="search-field"><Icon name="search" size={19}/><span className="sr-only">Search room number</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search room number"/></label>
          {hostels.length > 1 && <label className="select-field"><span className="sr-only">Hostel</span><select value={hostel} onChange={event => { setHostel(event.target.value); setFloor('') }}><option value="">All hostels</option>{hostels.map(value => <option key={value}>{value}</option>)}</select><Icon name="chevron" size={15}/></label>}
          {floors.length > 0 && <label className="select-field"><span className="sr-only">Floor</span><select value={floor} onChange={event => setFloor(event.target.value)}><option value="">All floors</option>{floors.map(value => <option key={value} value={value}>{floorName(value)}</option>)}</select><Icon name="chevron" size={15}/></label>}
          <label className="space-filter"><input type="checkbox" checked={hasSpace} onChange={event => setHasSpace(event.target.checked)}/> Has space</label>
        </div>
        <div className="announcements" role="status" aria-live="polite">{notice && <p className="notice">{notice}</p>}</div>
        {inventory && !groups.length && <div className="inventory-empty">{rooms.length ? <>
          <p>No rooms match your filters.</p><button className="text-button" type="button" onClick={() => { setQuery(''); setHostel(''); setFloor(''); setHasSpace(false) }}>Clear filters</button>
        </> : <p>Rooms have not been published yet.</p>}</div>}
        {groups.map(group => <section className="hostel-group" key={group.name}>
          <h3>{group.name}</h3>
          {group.levels.map(level => <div className="floor-group" key={level.level ?? ''}>
            {level.level && <div className="floor-heading"><h4>{floorName(level.level)}</h4><span>{level.rooms.length} {level.rooms.length === 1 ? 'room' : 'rooms'}</span></div>}
            <ul className="room-grid" role="list">{level.rooms.map(room => <li key={room.id}><RoomCard room={room} selected={room.id === selected} booked={room.id === booking?.roomId} onSelect={() => select(room)}/></li>)}</ul>
          </div>)}
        </section>)}
      </section>
      <aside className="detail-panel"><RoomPanel {...panel}/></aside>
    </div>
    <dialog className="sheet-dialog" ref={sheetDialog} aria-label="Room details" onClose={() => setSheet(false)} onClick={event => { if (event.target === event.currentTarget) setSheet(false) }}>
      <div className="sheet-surface">
        <RoomPanel {...panel} onClose={() => setSheet(false)}/>
        {notice && <p role="status" className="sheet-notice">{notice}</p>}
      </div>
    </dialog>
    <dialog className="confirm-dialog" ref={confirmDialog} aria-labelledby="confirm-title" onClose={() => setConfirm(false)} onCancel={event => { if (pending) event.preventDefault() }}>
      <div className="login-mark"><Icon name="door" size={23}/></div>
      <h2 id="confirm-title">Confirm room {selectedRoom?.label}?</h2>
      <p>This claims one place in the room. Other eligible E24 students can see your name in the room details. To request a change, contact the allocation team.</p>
      <div className="dialog-actions"><button className="button secondary" type="button" autoFocus disabled={pending} onClick={() => setConfirm(false)}>Go back</button>
        <button className="button primary" type="button" disabled={pending || !bookingKnown} onClick={() => void submit()}>{pending ? 'Confirming…' : 'Confirm booking'}</button></div>
    </dialog>
  </main>
}
