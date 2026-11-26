const assert = require('node:assert/strict')
const { test } = require('node:test')
const { readFileSync } = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')

function load(path, imports, globals = {}) {
  const module = { exports: {} }
  const source = ts.transpileModule(readFileSync(require.resolve(path), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  vm.runInNewContext(source, { module, exports: module.exports, ...globals,
    require(name) {
      if (name === 'server-only') return {}
      if (name in imports) return imports[name]
      throw new Error(`Unexpected import: ${name}`)
    },
  })
  return module.exports
}

// An atomic API double checks conditional writes and slot conflicts. Live database
// concurrency and credentials remain a separate staging integration check.
function fixture({ destination = {}, occupied = [], open = true, fail = false, booked = true, conflict = false } = {}) {
  const rooms = ['old', 'new', 'third'].map((id, i) => ({ id, room_label: String(101 + i), hostel: 'Akbar', floor: '1', capacity: 3, active: true, ...(id === 'new' ? destination : {}) }))
  const bookings = booked ? [{ student_id: 's1', room_id: 'old', slot: 1, created_at: '2026-11-25T00:00:00.123456+00:00' }] : []
  bookings.push(...occupied.map((slot, i) => ({ student_id: `other${i}`, room_id: 'new', slot })))
  let writes = 0
  const api = {
    async selectRows(table, query) {
      return structuredClone((table === 'rooms' ? rooms : bookings).filter(row => Object.entries(query).every(([key, value]) => !value.startsWith('eq.') || String(row[key]) === value.slice(3))))
    },
    async updateBooking(query, values) {
      writes++
      if (fail) throw new Error('Simulated network failure')
      if (conflict && writes === 1) {
        bookings.push({ student_id: 'racer', room_id: values.room_id, slot: values.slot })
        return null
      }
      const booking = bookings.find(row => Object.entries(query).every(([key, value]) => String(row[key]) === value.slice(3)))
      if (!booking) return []
      if (bookings.some(row => row.room_id === values.room_id && row.slot === values.slot)) return null
      Object.assign(booking, values)
      return [{ created_at: booking.created_at }]
    },
    async insertRows() { throw new Error('A room change must not insert or delete a booking') },
  }
  const { book } = load('../lib/rooms.ts', {
    './config': { bookingOpen: () => open }, './supabase-server': api, './students': {},
  })
  return { book, bookings, writes: () => writes }
}

test('moves exactly one booking and preserves full timestamp precision in the condition', async () => {
  const f = fixture({ occupied: [1, 3] })
  const result = await f.book('new', 's1', 'old')
  assert.equal(result.status, 200)
  assert.equal(result.booking.roomId, 'new')
  assert.equal(f.bookings.filter(b => b.student_id === 's1').length, 1)
  assert.equal(f.bookings[0].slot, 2)
})
for (const [name, options, target, code] of [
  ['full destination', { occupied: [1, 2, 3] }, 'new', 'ROOM_FULL'],
  ['inactive destination', { destination: { active: false } }, 'new', 'ROOM_UNAVAILABLE'],
  ['missing destination', {}, 'missing', 'ROOM_NOT_FOUND'],
  ['closed window', { open: false }, 'new', 'BOOKING_CLOSED'],
]) test(`${name} preserves the original room`, async () => {
  const f = fixture(options)
  assert.equal((await f.book(target, 's1', 'old')).code, code)
  assert.equal(f.bookings[0].room_id, 'old')
  assert.equal(f.writes(), 0)
})
test('a failed request preserves the original booking', async () => {
  const f = fixture({ fail: true })
  await assert.rejects(f.book('new', 's1', 'old'), /Simulated network failure/)
  assert.equal(f.bookings[0].room_id, 'old')
})
test('a last-place race retries a different free slot', async () => {
  const f = fixture({ conflict: true })
  const result = await f.book('new', 's1', 'old')
  assert.equal(result.status, 200)
  assert.equal(f.bookings[0].slot, 2)
  assert.equal(f.writes(), 2)
})
test('losing the final destination slot keeps the old booking', async () => {
  const f = fixture({ conflict: true, occupied: [1, 2] })
  assert.equal((await f.book('new', 's1', 'old')).code, 'ROOM_FULL')
  assert.equal(f.bookings[0].room_id, 'old')
})
test('retries are idempotent and stale edits cannot overwrite the new room', async () => {
  const f = fixture()
  const first = await f.book('new', 's1', 'old')
  const retry = await f.book('new', 's1', 'old')
  assert.equal(retry.booking.confirmedAt, first.booking.confirmedAt)
  assert.equal((await f.book('third', 's1', 'old')).code, 'BOOKING_CHANGED')
  assert.equal(f.writes(), 1)
})
test('competing edits from two tabs result in one successful change', async () => {
  const f = fixture()
  const results = await Promise.all([f.book('new', 's1', 'old'), f.book('third', 's1', 'old')])
  assert.equal(results.filter(r => r.status === 200).length, 1)
  assert.equal(results.filter(r => r.code === 'BOOKING_CHANGED').length, 1)
})
test('students without a booking cannot create one through a change', async () => {
  const f = fixture({ booked: false })
  assert.equal((await f.book('new', 's1', 'old')).code, 'BOOKING_CHANGED')
  assert.equal(f.bookings.length, 0)
})
test('POST does not implicitly change an existing booking', async () => {
  const f = fixture()
  assert.equal((await f.book('new', 's1')).code, 'ALREADY_BOOKED')
  assert.equal(f.bookings[0].room_id, 'old')
})
test('Supabase helper sends a filtered PATCH with server credentials', async () => {
  let request
  const api = load('../lib/supabase-server.ts', {}, {
    process: { env: { SUPABASE_URL: 'https://db.example.com', SUPABASE_SERVICE_ROLE_KEY: 'test-server-key' } }, URL, AbortSignal,
    fetch: async (url, options) => { request = { url, options }; return { ok: true, status: 200, json: async () => [{ created_at: 'now' }] } },
  })
  await api.updateBooking({ student_id: 'eq.s1', room_id: 'eq.old' }, { room_id: 'new', slot: 1 })
  assert.equal(request.url.pathname, '/rest/v1/bookings')
  assert.equal(request.url.searchParams.get('student_id'), 'eq.s1')
  assert.equal(request.options.method, 'PATCH')
  assert.equal(request.options.headers.Authorization, 'Bearer test-server-key')
  assert.equal(request.options.headers.Prefer, 'return=representation')
})

test('change endpoint validates its payload and passes only the signed-in student ID', async () => {
  let called
  const route = load('../app/api/bookings/route.ts', {
    '../../../lib/api': { protectedApi: handler => handler({ studentId: 'signed-in' }), respond: (body, status = 200) => ({ body, status }) },
    '../../../lib/config': { sameOrigin: () => true },
    '../../../lib/rooms': { book: async (...args) => { called = args; return { status: 200, booking: { roomId: 'new' } } } },
  })
  const request = body => new Request('https://app.example/api/bookings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal((await route.PATCH(request({ roomId: 'new' }))).status, 400)
  assert.equal((await route.PATCH(request({ roomId: 'new', fromRoomId: 'old', studentId: 'someone-else' }))).status, 400)
  assert.equal(called, undefined)
  assert.equal((await route.PATCH(request({ roomId: 'new', fromRoomId: 'old' }))).status, 200)
  assert.equal(called.join(','), 'new,signed-in,old')
})

test('change endpoint rejects cross-origin requests before writing', async () => {
  const route = load('../app/api/bookings/route.ts', {
    '../../../lib/api': { protectedApi: handler => handler({ studentId: 's1' }), respond: (body, status) => ({ body, status }) },
    '../../../lib/config': { sameOrigin: () => false },
    '../../../lib/rooms': { book: () => { throw new Error('Must not write') } },
  })
  assert.equal((await route.PATCH(new Request('https://app.example/api/bookings'))).status, 403)
})
