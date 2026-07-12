# BAF Engine API (v6)

[![test](https://github.com/OWNER/REPO/actions/workflows/test.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/test.yml)

Real, runnable backend for the Behavioral Algorithm Framework scoring engine.
Implements the API surface documented in `BAF_Technical_Architecture.docx` Section 3.5.

## Run it

```
docker-compose up -d      # local Postgres on :5432 (user/pass/db: baf/baf/baf)
npm install
npm run migrate           # creates profiles / weight_config / sessions tables
npm start
```

Server boots on `http://localhost:4000` (override with `PORT=xxxx npm start`).
Set `DATABASE_URL` to point at a different Postgres instance; it defaults to
`postgres://baf:baf@localhost:5432/baf`, matching `docker-compose.yml`.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/v1/health` | liveness check, reports sub-layer count |
| POST | `/v1/profile` | score a profile from sub-layer input vectors |
| GET | `/v1/profile/:id` | fetch a stored profile |
| GET | `/v1/profile` | list all stored profiles (id/date/completeness only) |
| GET | `/v1/weights/:version` | fetch a weight config (`:version` = number, or `latest`) |
| POST | `/v1/weights` | publish a new weight version (must sum to 1.00) |

### Example: score a profile

```bash
curl -X POST http://localhost:4000/v1/profile \
  -H "Content-Type: application/json" \
  -d '{
    "precisionVectors": {
      "terrain": {"RT":2,"SC":1,"ER":1,"AR":-1,"DS":0,"SR":1},
      "ego": {"RT":-1,"SC":0,"ER":2,"AR":1,"DS":-1,"SR":-2}
    }
  }'
```

Valid sub-layer ids (22 total): `terrain, climate, density, energy, health, age, nutrition,
temperament, parenting, birthorder, stability, collectivism, tradition, density_net,
digital_ratio, current_stability, formative_scarcity, education, schema_flex, ego, stress, sleep`

Each value is a `{RT,SC,ER,AR,DS,SR}` vector, range -2..2 (auto-clamped). `nutrition` is
capped at 1.00 and `temperament` at 1.25 by the confidence-correction documented in the
architecture doc (Section 3.2b.4) — the API doesn't enforce this at the input layer, the
pre-authored magnitudes in the frontend do; raw API callers can technically exceed it up
to the global ±2 clamp.

## Architecture notes

- **Scoring logic** (`src/core-engine.js`) is copied byte-for-byte from the file backing
  the 85-case regression suite (`tests/test-cases.js`, `tests/core-engine.js`, run via
  `npm test`) and mirrored in `BAF_Simulator_v6.html`. No math is duplicated or re-derived
  here — same source, three consumers (test suite, browser tool, this API).
- **Persistence** (`src/store.js`) is PostgreSQL, per the architecture doc's tech stack
  table (Section 4) and Data Layer schema (Section 3.4). Schema lives in
  `migrations/001_init.sql` (`profiles`, `weight_config`, `sessions`); run new migration
  files with `npm run migrate`. `store.js` keeps the same exported function names/params
  as the earlier JSON-file phase (`saveProfile`, `getProfile`, `listProfiles`,
  `saveWeightVersion`, `getWeightVersion`) — they're async now since `pg` has no
  synchronous driver, so `server.js`'s route handlers `await` them.
- **Validation**: unknown sub-layer ids are rejected (400) with the full valid-id list
  in the response. Weight publishes are rejected (400) unless they sum to 1.00 ± 0.001.

## What this is not

This is a scoring-math API, not a validated psychological instrument. See the
disclaimer field on every profile response, and Section 3.2b.5 of the architecture
doc ("Honest Scope") for what this system can and cannot claim.

## Tested

All 6 routes exercised live during build: health, weights/latest, profile create
(partial fill), profile get-by-id, 404 on missing profile, 400 on invalid sub-layer id,
400 on weight-sum violation, profile list. Persistence confirmed across a server restart.
