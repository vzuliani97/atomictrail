# Public demo deployment

A public, free demo of NekoBet with synthetic data. It is a simulation, with no real money and no data from any
external provider, and it is a demonstration, not a production environment: the documented production design
(AWS with Terraform, in [OpsCircuit](https://github.com/vzuliani97/opscircuit)) was never applied, and nothing
here stands in for it.

## Architecture

```text
Browser ──HTTPS──> Netlify (frontend/, static build, CDN, security headers)
   │
   └──HTTPS: API calls and the live Server-Sent Events stream
        └──> Render free web service (backend/Dockerfile, production stage)
                 │
                 └──TLS──> Neon free PostgreSQL
```

| Part | Where | Notes |
|---|---|---|
| Frontend | Netlify, site `nekobet` | Built from `frontend/` by `netlify.toml`; calls the API and opens the live stream at `VITE_API_BASE_URL` |
| API | Render, web service `nekobet-api-demo` | The existing production image; listens on Render's `PORT`; health check `/health`; runs the simulated odds feed while it is awake |
| Database | Neon, its own project and a database named for the demo | Direct (non-pooled) connection string: migrations and the feed's leader election take advisory locks |

Not deployed: nginx (Netlify serves the static files), Prometheus and Grafana (OpsCircuit), and the AWS Terraform.

## Free-plan limits (checked 2026-11-04)

- **Netlify Free:** 300 credits a month, with no card. A production deploy costs 15 credits, so `netlify.toml`
  rebuilds only when `frontend/` or the file itself changes. When the credits run out, the site pauses until
  the next month; nothing is charged.
- **Render Free:** no card. The service spins down after 15 minutes without traffic, and the next request
  wakes it in about a minute, which is why the frontend shows a start-up screen. Free services share 750
  instance-hours a month per workspace, and this workspace also runs the Yamesi demo. The live stream closes
  when its browser tab is hidden, so a forgotten tab does not keep the API awake.
- **Neon Free:** no card. 100 CU-hours of compute and 1 GB of storage per project; compute suspends after
  5 minutes idle. While the API is awake, the odds feed writes every few seconds, so the database stays active
  exactly as long as the API does. Over the limit the project is suspended, not billed.

No keep-alive pings are configured. A cold start is the accepted cost of a free demo.

## Demo mode and its safeguards

| Setting | Effect |
|---|---|
| `PUBLIC_DEMO=true` | `CORS_ORIGIN` must be one exact `https` origin; requests are limited per client address (`RATE_LIMIT_PER_MINUTE`, 240 by default, bounded memory); `/metrics` answers 404, because no nginx keeps it internal; the API refuses to start unless the connected database's name equals `DEMO_DATABASE_CONFIRMATION` |
| `DEMO_RESET_ON_BOOT=true` | Allowed only with `PUBLIC_DEMO=true`. On every boot, which on Render means every wake-up and every deploy, one statement empties the business tables (balances, bets, casino rounds, events, sales, partners, users, products, stores). Then the seed reloads the store, its users and products, and the live feed fills the board again. There is no HTTP endpoint that resets anything |
| `SEED_DEMO_DATA=true` | Loads the demo data into an empty database, as in local runs |

Unchanged from local and production: JWT (HS256, placeholder secrets refused), roles, the login lockout, the
ledger and its idempotency keys, the 10 kB body limit, and helmet's headers on the API. Production mode refuses
the published demo signing secrets, so the casino provider and the demo partner get random ones. The partner
API keeps its address allowlist (loopback and private ranges), so it does not answer signed calls from the
internet.

**Threats considered:**
- abuse of a public endpoint: rate limit and login lockout;
- a wrong `DATABASE_URL` that would wipe a real base: the database-name confirmation;
- operational data leaking through `/metrics`: closed in demo mode;
- signed casino or partner calls with the published demo secrets: refused in production mode;
- cross-origin misuse: exact CORS and a CSP limited to the API origin;
- leftover state from visitors: reset on boot;
- secrets in the repository: none, because all of them live in the providers' dashboards.

## Provider settings (names only; values live in each dashboard)

**Render (`nekobet-api-demo`):**

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `PUBLIC_DEMO` | `true` |
| `SEED_DEMO_DATA` | `true` |
| `DEMO_RESET_ON_BOOT` | `true` |
| `DEMO_DATABASE_CONFIRMATION` | The demo database name |
| `TRUST_PROXY` | `1` |
| `CORS_ORIGIN` | The Netlify site's HTTPS origin |

Secrets: `DATABASE_URL`, `JWT_SECRET`, `DEMO_PASSWORD`, `CASINO_PROVIDER_SECRET` and `DEMO_PARTNER_SECRET`.
Generate each signing secret with `openssl rand -hex 32`; the demo password is shown to visitors and is used
nowhere else.

**Netlify (`nekobet`):** `VITE_DEMO_PASSWORD` (the same public demo password). `VITE_PUBLIC_DEMO` and
`VITE_API_BASE_URL` are in `netlify.toml`.

## Deploy, roll back, remove

- **Deploy:** a push to `main` deploys both sides. Netlify builds when `frontend/` changes; Render rebuilds the
  image from `backend/Dockerfile`.
- **Roll back:**
  - Netlify: Deploys → pick a previous deploy → "Publish deploy".
  - Render: Events → a previous deploy → "Rollback".
  - The database needs no rollback, because the next boot restores the demo data.
- **Remove everything:**
  1. Netlify: Site configuration → Delete site.
  2. Render: the service → Settings → Delete web service.
  3. Neon: Project settings → Delete project.
  4. GitHub: Settings → Applications → revoke Netlify's and Render's access to this repository, if no other site uses it.
- **Local run is unchanged:** `make up` still uses Docker Compose, nginx and the defaults (`PUBLIC_DEMO` off).
