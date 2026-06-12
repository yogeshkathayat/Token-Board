# Deployment guide

A `tokenboard` deployment is one tenant — one company, one Postgres database. Engineers in that company point their CLIs at the deployment URL and see one another on the leaderboard. Other companies can clone this repo and run their own deployment.

## What you need before starting

- A Linux VM (≥ 2 vCPU, 2 GB RAM, 20 GB disk) reachable on a domain you own.
- Docker 24+ and docker compose v2.
- A TLS certificate for that domain. Let's Encrypt via certbot is easiest — see "TLS" below.
- An OIDC IdP (Google Workspace, Okta, Auth0, Azure AD, Keycloak, …) — *optional* but strongly recommended.
- 30 minutes.

## 1. Clone

```bash
git clone https://github.com/your-org/tokenboard.git
cd tokenboard/infra
```

## 2. Configure

```bash
cp .env.example .env
$EDITOR .env
```

Required values:

| Var | Example |
|---|---|
| `PUBLIC_URL` | `https://usage.acme.com` |
| `DB_PASSWORD` | `openssl rand -base64 32` |
| `JWT_SECRET` | `openssl rand -base64 48` |

To enable SSO (recommended), set `OIDC_ISSUER`, `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET`, and `OIDC_REDIRECT_URI=$PUBLIC_URL/api/v1/auth/oidc/callback`. Register that exact callback URI with your IdP.

To restrict signups to your company:

```bash
ALLOWED_EMAIL_DOMAINS=acme.com,acme.io
```

To make yourself an admin on first login:

```bash
BOOTSTRAP_ADMIN_EMAIL=you@acme.com
```

See [CONFIG.md](CONFIG.md) for every variable.

## 3. TLS

Drop your certificate at `infra/certs/`:

```
infra/certs/fullchain.pem    # cert chain
infra/certs/privkey.pem      # private key (mode 0600)
```

If you're using a separate reverse proxy (e.g., a corporate ALB or Cloudflare) that already terminates TLS, set `TLS_DISABLED=true` and forward HTTP to the `proxy` container's port 80.

To get a cert quickly with certbot:

```bash
sudo certbot certonly --standalone -d usage.acme.com
sudo cp /etc/letsencrypt/live/usage.acme.com/fullchain.pem infra/certs/
sudo cp /etc/letsencrypt/live/usage.acme.com/privkey.pem infra/certs/
sudo chmod 600 infra/certs/privkey.pem
```

## 4. Build the images

For first-time deploys, build locally:

```bash
docker compose -f docker-compose.yml --env-file .env build
```

For subsequent deploys, point at images you've pushed to a registry and let `make up` pull them.

## 5. Boot the stack

```bash
make setup       # creates infra/.env if missing, ensures certs/ + backups/ dirs
make up          # docker compose up -d
make migrate     # apply database migrations
make logs        # tail (Ctrl-C to detach)
```

In a fresh environment, run `make migrate` before serving traffic — until the schema exists, API requests that touch the database will error (and `GET /api/v1/healthz` reports `db: false`). After migration the leaderboard cron runs every 5 minutes. `make migrate` runs the compiled migrator inside the API container and is safe to re-run.

## 6. Smoke test

1. Open `$PUBLIC_URL` in a browser. Sign up (email/password) or sign in via SSO.
2. On a laptop:
   ```bash
   npx tokenboard init https://usage.acme.com
   ```
   Paste the link code from `Settings → Devices`. Choose hooks to install.
3. Use Claude Code (or whichever tool you installed) for one prompt.
4. Run `tokenboard sync` and confirm `Inserted N, skipped 0`.
5. Refresh the dashboard — your bucket appears.
6. Open `/leaderboard` — you appear once leaderboard cron fires (≤5 min).

## Operations

| Task | Command |
|---|---|
| Tail all logs | `make logs` |
| Tail one service | `make logs s=api` |
| psql shell | `make psql` |
| Restart api | `docker compose restart api` |
| Backup db | `make backup` (writes `infra/backups/YYYY-MM-DD_HHMM.sql.gz`) |
| Restore db | `make restore F=infra/backups/...sql.gz` |
| Migrate | `make migrate` |
| Update images | `docker compose pull && make up` |

A daily cron for backups is left as an exercise — wire `make backup` into a system crontab on the host.

## Upgrading

```bash
git pull
docker compose pull   # if using prebuilt images
docker compose -f docker-compose.yml --env-file .env build  # if building locally
make migrate          # safe to re-run; only pending migrations apply
docker compose up -d
```

Migrations are designed to be backwards-compatible across one version. Roll back with `npm --workspace apps/api run migrate:down` if needed.

## Multi-tenant note

This project is intentionally **single-tenant per deployment**. Cross-tenant features (an admin who owns multiple orgs) are out of scope. To support multiple companies, run multiple deployments — they're cheap (~$10/mo on a small VM) and isolated.

## Troubleshooting

**"Cannot reach $PUBLIC_URL" during `tokenboard init`**: confirm DNS, TLS cert, and that the proxy container is up (`docker compose ps`).

**Dashboard loads but leaderboard is empty**: it takes one cron tick (≤5 min) for snapshots to populate. Force one with `POST /api/v1/leaderboard/refresh` as an admin, or wait.

**"Email domain not allowed"**: an admin set `ALLOWED_EMAIL_DOMAINS` and your address doesn't match. Either log in with an allowed address or update `.env` and `docker compose up -d` to apply.

**OIDC callback fails**: the `OIDC_REDIRECT_URI` you registered with the IdP must match exactly. Trailing slashes matter.

**Ingest returns 401 from the CLI**: the device token was revoked, or the link code expired before exchange. Re-run `tokenboard init`.
