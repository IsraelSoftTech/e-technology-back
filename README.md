# Backend

This folder contains the Node.js (Express) API, database schema (PostgreSQL), and integrations.

## Setup

1. Create a `.env` file in this folder with:
```
PORT=4000
DATABASE_URL=postgres://user:password@localhost:5432/e_tech
PGSSL=false
```

2. Install dependencies:
```
npm install
```

3. Start the server (dev):
```
npm run dev
```

### Permissions fixes (if you see "permission denied")

Run these helper scripts once using a Postgres superuser to grant the app role access:

```
node grant-create-courses.js
node grant-course-assignments.js
node grant-teacher-docs.js
node grant-classes.js
```

These ensure tables exist and grant SELECT/INSERT/UPDATE/DELETE to the `e_tech_user` role plus sequence usage.

## Endpoints
- `GET /api/health`: returns `{ status: 'ok' }`
- `GET /api/db-check`: verifies DB connectivity
