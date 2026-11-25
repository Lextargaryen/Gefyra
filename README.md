# E24 Hostel Allocation

Room selection for the University of Peradeniya Faculty of Engineering, Batch E24. The app includes the login screen, searchable room inventory, occupant details, booking confirmation, My room, and privacy information.

## Run locally

Requires Node.js 22.12 or later, a PostgreSQL database, and a Google OAuth client.

```sh
npm ci
cp .env.example .env.local
```

Fill in `.env.local` using the live configuration steps below. For Supabase, copy the transaction pooler connection string into `DATABASE_URL`. Use a direct or session-mode connection in `DATABASE_DIRECT_URL` for schema changes and imports. On Vercel, the Supabase integration's `POSTGRES_URL` and `POSTGRES_URL_NON_POOLING` are supported without duplicating credentials. Explicit `DATABASE_*` URLs take precedence, so a custom runtime URL is never silently paired with a different integration database for maintenance. Supabase connections use verified TLS. Keep these values private and use a separate database for testing.

```sh
npm run db:migrate
npm run db:import -- db/akbar-rooms.json
npm run db:students -- /private/path/eligible-students.json --validate
npm run db:students -- /private/path/eligible-students.json
npm run dev
```

Open http://localhost:3000 and sign in with an eligible university Google account. The database is the source of truth for room availability and bookings.

## Supabase quick setup

1. In your Supabase project, open **SQL Editor**, create a new query, and paste the entire contents of [`db/supabase-setup.sql`](db/supabase-setup.sql). Click **Run**.
2. This creates `public.rooms`, `public.bookings`, and `public.eligible_students`, their constraints, row-level security, and the Akbar room inventory. Existing rooms and bookings are preserved on re-runs. Rooms reserved in the inventory remain inactive.
3. Use the project's **Connect** panel to obtain the PostgreSQL connection strings. Set the transaction pooler URL as server-only `DATABASE_URL`, and use a direct or session pooler URL for `DATABASE_DIRECT_URL`. Use the privileged Postgres connection for the current server implementation; a Supabase API key is not a connection string.
4. Configure the Google login, approved student roster, and booking window as described below. Student names and eligibility come from the private `eligible_students` table. Import the approved JSON using the commands below. The app does not depend on Supabase Auth.

The setup SQL intentionally has no browser access policies. The app authenticates students and checks eligibility in its Next.js server before querying Postgres. See [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).

For later schema-only updates use `db/schema.sql` or `npm run db:migrate`. To apply intentional room inventory changes, use `npm run db:import -- db/akbar-rooms.json`; the quick setup only inserts missing rooms and does not update existing configuration.

## Configure live allocation

The migration enables row-level security on all three tables. The server connection must use a database role that can access those tables. Do not expose database credentials in client code. Review the room capacities and reserved rooms against the final allocation list before opening bookings.

1. Update the framework lockfile before publishing. The included lockfile was verified against dependencies available offline. Use a current patched Next.js 15 release (at least 15.5.29) and the latest React 19 packages, then repeat `npm run build` and commit the updated lockfile.
   ```sh
   npm install 'next@^15.5.29' react@19 react-dom@19
   ```
2. Import the repository into Vercel and select Node.js 22.x or later. Use a single hosted PostgreSQL instance with a pooled `DATABASE_URL`. Use separate preview and live credentials. Set the exact canonical HTTPS origin as `APP_BASE_URL`. Generate a random session secret with `openssl rand -hex 32`.
3. Create a Google OAuth web client for the university deployment and set `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. Register `https://YOUR-LIVE-HOST/api/auth/callback` as an authorized redirect URI. For a configured local live test, also register `http://localhost:3000/api/auth/callback`.
4. Set `UNIVERSITY_HOSTED_DOMAINS` and `UNIVERSITY_EMAIL_DOMAINS` from the organizers' verified Google Workspace and student email domains. Use `eng.pdn.ac.lk` in `UNIVERSITY_EMAIL_DOMAINS`. `UNIVERSITY_HOSTED_DOMAINS` must match the verified Google `hd` claim: do not guess it from the email suffix. Import eligibility into Supabase as described below.
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

Replace the fictional example email with the approved university address. Keep the official student IDs stable across approved roster updates. If a booking's student ID is removed from the roster, the spot stays occupied and its name becomes **Occupied** in room details.

### Migrate an existing deployment to the database roster

Keep the supplied `eligible-students.json` outside this repository (for example, `../private/eligible-students.json`). Never put it under `public/`, commit it, or paste it into a migration. The roster is private input; only room occupants' display names are returned to authorized viewers.

1. Back up the database. In Supabase SQL Editor run the **contents** of [`db/migrations/001-eligible-students.sql`](db/migrations/001-eligible-students.sql) as the database owner. It only creates the private roster table and permissions; it does not rewrite rooms, bookings, or student IDs. Alternatively, `npm run db:migrate` applies the complete repeatable schema using the maintenance connection. Fresh projects can use `db/supabase-setup.sql`.
2. Validate the private input locally, then run a database dry run and the actual import:
   ```sh
   npm run db:students -- ../private/eligible-students.json --validate
   npm run db:students -- ../private/eligible-students.json --dry-run
   npm run db:students -- ../private/eligible-students.json
   ```
   `--validate` never connects to the database. `--dry-run` checks conflicts and attempts the upserts inside a transaction that is rolled back. The importer reports counts only, rejects duplicate IDs/emails and conflicting email ownership, and refuses legacy `E/24/001` bookings that correspond to incoming `E24-001` IDs. Resolve any discrepancy before deployment; never rewrite booking IDs blindly. Unmatched bookings retain their existing student IDs and display **Occupied**. No production booking ID audit has been performed by the code change itself.
3. Importing again updates names and emails by stable student ID without duplicating rows, deleting omitted students, or reactivating disabled students. `active` is true only by default for newly inserted records. Email reassignment to another student ID requires explicit review.
4. Deploy the updated code to Vercel. Keep existing Google OAuth credentials, server database URLs, `AUTH_SECRET`, and both verified university domain settings. Confirm that an active rostered student can sign in, an unlisted or disabled account is rejected, and an existing booking and occupant name still resolve correctly. Confirm that the read-only viewer can browse but cannot book. Live Google sign-in and shared database concurrency need staging credentials for validation.
5. After the new deployment works, remove the obsolete `ELIGIBLE_STUDENTS_JSON` variable from Vercel and local environment files. The updated code never reads it.

In **Supabase → Table Editor → eligible_students**:

- Add a student with a stable `student_id`, a lowercase trimmed `university_email`, a nonempty `display_name`, and `active = true`. Preserve leading zeroes in IDs.
- Edit `display_name` to change the name shown in room details. Do not change `student_id` once bookings reference it.
- Set `active = false` to revoke access on the next protected request, including requests from existing sessions. The student's booking remains occupied and retains its display name. Set it back to true only when access should be restored.

RLS and revoked `anon`/`authenticated` privileges prevent direct browser access to the roster. The existing privileged server PostgreSQL connection queries it with parameters. Do not create public roster policies. Domain checks and OAuth signature, nonce, state, PKCE, and verified-email checks remain in place.

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
