# E24 Hostel Allocation

Room selection for the University of Peradeniya Faculty of Engineering, Batch E24. The app includes the login screen, searchable room inventory, occupant details, booking confirmation, My room, and privacy information.

## Run locally

Requires Node.js 22.12 or later, a PostgreSQL database, and a Google OAuth client.

```sh
npm ci
cp .env.example .env.local
```

Fill in `.env.local` using the live configuration steps below. For Supabase, copy the transaction pooler connection string into `DATABASE_URL`. Use a direct or session-mode connection in `DATABASE_DIRECT_URL` for schema changes and imports. Keep these values private and use a separate database for testing.

```sh
npm run db:migrate
npm run db:import -- db/akbar-rooms.json
npm run dev
```

Open http://localhost:3000 and sign in with an eligible university Google account. The database is the source of truth for room availability and bookings.

## Supabase quick setup

1. In your Supabase project, open **SQL Editor**, create a new query, and paste the entire contents of [`db/supabase-setup.sql`](db/supabase-setup.sql). Click **Run**.
2. This creates `public.rooms` and `public.bookings`, their constraints, row-level security, and the Akbar room inventory. Existing rooms and bookings are preserved on re-runs. Rooms reserved in the inventory remain inactive.
3. Use the project's **Connect** panel to obtain the PostgreSQL connection strings. Set the transaction pooler URL as server-only `DATABASE_URL`, and use a direct or session pooler URL for `DATABASE_DIRECT_URL`. Use the privileged Postgres connection for the current server implementation; a Supabase API key is not a connection string.
4. Configure the Google login, approved student roster, and booking window as described below. Student names and eligibility are supplied by `ELIGIBLE_STUDENTS_JSON`; there is no separate students table or Supabase Auth dependency.

The setup SQL intentionally has no browser access policies. The app authenticates students and checks eligibility in its Next.js server before querying Postgres. See [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

For later schema-only updates use `db/schema.sql` or `npm run db:migrate`. To apply intentional room inventory changes, use `npm run db:import -- db/akbar-rooms.json`; the quick setup only inserts missing rooms and does not update existing configuration.

## Configure live allocation

The migration enables row-level security on both tables. The server connection must use a database role that can access those tables. Do not expose database credentials in client code. Review the room capacities and reserved rooms against the final allocation list before opening bookings.

1. Update the framework lockfile before publishing. The included lockfile was verified against dependencies available offline. Use a current patched Next.js 15 release (at least 15.5.29) and the latest React 19 packages, then repeat `npm run build` and commit the updated lockfile.
   ```sh
   npm install 'next@^15.5.29' react@19 react-dom@19
   ```
2. Import the repository into Vercel and select Node.js 22.x or later. Use a single hosted PostgreSQL instance with a pooled `DATABASE_URL`. Use separate preview and live credentials. Set the exact canonical HTTPS origin as `APP_BASE_URL`. Generate a random session secret with `openssl rand -hex 32`.
3. Create a Google OAuth web client for the university deployment and set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. Register `https://YOUR-LIVE-HOST/api/auth/callback` as an authorized redirect URI. For a configured local live test, also register `http://localhost:3000/api/auth/callback`.
4. Set `UNIVERSITY_HOSTED_DOMAINS` and `UNIVERSITY_EMAIL_DOMAINS` from the organizers' verified Google Workspace and student email domains. Set `ELIGIBLE_STUDENTS_JSON` with the approved roster. Supply each student's ID, exact university email, and roster display name. Keep the roster in environment configuration. If the roster exceeds the deployment's environment size limit, connect a private server-side roster source in `lib/config.ts` before launch.
5. Run the migration and import as a release step with a database connection that has the necessary permissions. An optional `DATABASE_DIRECT_URL` takes precedence for these commands.
   ```sh
   npm run db:migrate
   npm run db:import -- db/akbar-rooms.json
   ```
6. Set `SUPPORT_EMAIL` and `RETENTION_TERMS` when provided by the organizers. Test an eligible account, a university account outside the roster, and a personal account on the live hostname. Test simultaneous claims with two eligible accounts in a staging database.
7. Open allocation with `BOOKING_ENABLED=true`. Use optional ISO 8601 bounds such as `2026-12-01T09:00:00+05:30` for Sri Lanka time. The opening instant is inclusive and the closing instant is exclusive. Existing students retain access to their confirmed bookings after closing.

### Roster format

```json
[
  {
    "studentId": "E24-001",
    "universityEmail": "student1@verified-university-domain.example",
    "displayName": "Sample Student"
  }
]
```

The placeholder email domain above is rejected by live configuration. Keep the official student IDs stable across approved roster updates. If a booking's student ID is removed from the roster, the spot stays occupied and its name becomes **Occupied** in room details.

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

A student confirms one place per round. The live transaction locks the target room, picks a free position, and commits against separate uniqueness constraints for student IDs and room positions. A same-room retry returns the original booking. Room positions are internal and do not assign beds.

The live Google OAuth flow uses the documented authorization-code and JWKS endpoints with PKCE, state and nonce checks. Token verification is implemented with Node's cryptography APIs. The live provider callback and shared PostgreSQL concurrency require credentials and an external database for end-to-end validation.

- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Next.js 15.5.29 release](https://github.com/vercel/next.js/releases/tag/v15.5.29)
- [Deploying from GitHub to Vercel](https://vercel.com/docs/git/vercel-for-github)
