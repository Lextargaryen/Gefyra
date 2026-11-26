# E24 Hostel Allocation

Room selection for the University of Peradeniya Faculty of Engineering, Batch E24. The app includes the login screen, searchable room inventory, occupant details, booking confirmation, My room, and privacy information.

## Run locally

Requires Node.js 22.12 or later, a Supabase project, and a Google OAuth client.

```sh
npm ci
cp .env.example .env.local
```

Fill in `.env.local` using the live configuration steps below. The app reads its student, room, and booking data through Supabase’s server API. Keep the Supabase service-role key server-only. `DATABASE_URL` and `DATABASE_DIRECT_URL` are only needed for the optional database maintenance scripts.

```sh
npm run dev
```

Open http://localhost:3000 and sign in with a Google account whose email appears in `eligible_students`. Supabase is the source of truth for student access, room availability, and bookings.

## Supabase quick setup

1. In your Supabase project, open **SQL Editor**, create a new query, and run [`db/supabase-setup.sql`](db/supabase-setup.sql).
2. The setup creates `public.eligible_students`, `public.rooms`, and `public.bookings`, enables row-level security without public client policies, and inserts missing Akbar rooms. Existing student rows, bookings, and room configuration are preserved.
3. Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as server-only environment variables. Never prefix the service-role key with `NEXT_PUBLIC_` or send it to a browser.
4. The `eligible_students` table is the access list. A row with the verified Google email grants access; the app reads `student_id` and `display_name` from that same row. Remove a row to revoke access. No domain allowlist or JSON roster is used; any legacy `active` column is ignored.
5. The app uses Supabase for runtime room and booking reads/writes. PostgreSQL connection strings are optional and only needed for maintenance commands.

For later schema-only updates use `db/schema.sql` or the setup SQL. To apply intentional room inventory changes, use `npm run db:import -- db/akbar-rooms.json`; that optional script needs `DATABASE_URL` or `DATABASE_DIRECT_URL`.

## Configure live allocation

The setup enables row-level security on all three tables without public client policies. The app accesses them only from server-side code with the Supabase service-role key. Review the room capacities and reserved rooms against the final allocation list before opening bookings.

1. Import the project into Vercel and select Node.js 22.x or later. Configure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` for server use only. Set `APP_BASE_URL` to the exact canonical HTTPS origin and configure `AUTH_SECRET` (at least 32 characters) for encrypted session cookies.
2. Create a Google OAuth web client and set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. The current production redirect URI is `https://gefyra-eta.vercel.app/api/auth/callback`; add it under **Authorized redirect URIs**. It must match `APP_BASE_URL` exactly. For local sign-in, also register `http://localhost:3000/api/auth/callback`.
3. Add each approved student to `public.eligible_students` with their stable student ID, exact Google email, and display name. Access is determined only by the verified Google email matching a row. There are no extra domain checks or hardcoded personal-email exceptions.
4. Run the SQL setup once to create or update the tables. Optional `npm run db:migrate` and `npm run db:import -- db/akbar-rooms.json` maintenance commands require a Postgres connection string; the app itself does not.
5. Set `SUPPORT_EMAIL` and `RETENTION_TERMS` when provided by the organizers. Test a listed student and an unlisted email. Test simultaneous claims with two eligible accounts in a staging database.
6. Open allocation with `BOOKING_ENABLED=true`. Use optional ISO 8601 bounds such as `2026-12-01T09:00:00+05:30` for Sri Lanka time. The opening instant is inclusive and the closing instant is exclusive. Existing bookings remain visible after closing.

### Student access records

The `public.eligible_students` table is the single source of truth for access and occupant names:

| Column | Purpose |
| --- | --- |
| `student_id` | Stable student number used by bookings |
| `university_email` | Google account email to match, stored in lowercase |
| `display_name` | Name shown to other students in room details |

Keep student IDs stable across roster updates so existing bookings remain associated with the correct person. Remove a row to revoke access; existing bookings remain and the occupant is shown as **Occupied**. Any legacy `active` column is ignored.

### Room inventory format

```json
[
  {
    "id": "building-a-101",
    "roomLabel": "A-101",
    "hostel": "Hostel A",
    "floor": "1",
    "active": true
  }
]
```

Use a stable ID for each physical room. Imports update labels, location fields and availability by ID. Set `active: false` for a removed room. Rooms omitted from a file retain their previous state. PostgreSQL rejects duplicate hostel-and-room labels and protects referenced room IDs against deletion.

### Booking behavior

A rostered student can confirm one place per round. Booking writes rely on database uniqueness for student IDs and room positions; if concurrent requests race for the same place, the app rechecks the booking and remaining slots. A same-room retry returns the original booking. Room positions are internal and do not assign beds.

Students can select **Change room** on My room and confirm another available room while booking is open. A single conditional Supabase update moves the existing booking, so a failed update or a destination slot conflict leaves the old place reserved. The database's existing unique room/slot constraint prevents two students taking the same place. Concurrent edits compare the original room and confirmation time, and conflicts retry against refreshed availability. This feature uses the existing Supabase API credentials and tables: no SQL migration or Vercel configuration changes are required.

The Google OAuth flow uses the documented authorization-code and JWKS endpoints with PKCE, state and nonce checks. Token verification is implemented with Node's cryptography APIs. The callback requires the configured Google OAuth client and the exact authorized redirect URI.

- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Next.js 16.4.6 release](https://github.com/vercel/next.js/releases/tag/v16.4.6)
- [Deploying from GitHub to Vercel](https://vercel.com/docs/git/vercel-for-github)
