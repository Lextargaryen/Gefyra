BEGIN;
CREATE TABLE IF NOT EXISTS eligible_students (
  student_id text PRIMARY KEY,
  university_email text NOT NULL UNIQUE,
  display_name text NOT NULL
);
ALTER TABLE eligible_students ENABLE ROW LEVEL SECURITY;
CREATE TABLE IF NOT EXISTS rooms (
  id text PRIMARY KEY,
  room_label text NOT NULL,
  hostel text NOT NULL,
  floor text,
  active boolean NOT NULL DEFAULT true,
  capacity smallint NOT NULL DEFAULT 3 CHECK (capacity BETWEEN 1 AND 4),
  UNIQUE (hostel, room_label)
);
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS capacity smallint NOT NULL DEFAULT 3 CHECK (capacity BETWEEN 1 AND 4);
CREATE TABLE IF NOT EXISTS bookings (
  student_id text PRIMARY KEY,
  room_id text NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  slot smallint NOT NULL CHECK (slot BETWEEN 1 AND 4),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, slot)
);
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_slot_check;
ALTER TABLE bookings ADD CONSTRAINT bookings_slot_check CHECK (slot BETWEEN 1 AND 4);
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
COMMIT;
