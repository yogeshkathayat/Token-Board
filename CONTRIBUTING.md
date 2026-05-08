# Contributing

Thanks for considering a contribution. The project is small and intentionally so — please read the existing code before adding abstractions.

## Layout

```
apps/api/         Fastify + Postgres backend (TypeScript)
apps/cli/         The npm CLI (CommonJS Node)
apps/dashboard/   React + Vite SPA (TypeScript)
packages/shared/  Types shared between api and dashboard
infra/            docker-compose + nginx
docs/             User-facing docs
```

The three apps are independent npm workspaces — each has its own `package.json`, scripts, and tests.

## Setup

```bash
nvm use            # picks up .nvmrc → Node 20
npm install
```

## Running locally

Start a local Postgres and run the API in dev mode:

```bash
docker compose -f infra/docker-compose.yml -f infra/docker-compose.dev.yml --env-file infra/.env up db
npm run migrate
npm run dev:api
```

In another shell, the dashboard:

```bash
npm run dev:dashboard
```

For the CLI, install your local copy globally:

```bash
cd apps/cli
npm link
tokenboard --help
```

## Testing

```bash
npm test                       # runs all workspace tests
npm --workspace apps/api test
npm --workspace apps/cli test
```

The CLI uses Node's built-in test runner. The API uses tsx + node:test. The dashboard uses Vitest.

## Adding a parser

To add support for a new AI tool:

1. Create `apps/cli/src/parsers/<tool>.js` exporting `{ source, detect, parse }`.
2. Add the source name to `SOURCES` in `packages/shared/src/types.ts` (this also gates the API ingest validator).
3. Register the parser in `apps/cli/src/parsers/index.js`.
4. Write a unit test under `apps/cli/test/<tool>-parser.test.js`. Tests must verify (a) tokens are captured correctly, (b) no message content is captured, (c) parser is incremental across runs.
5. If the tool has a hook mechanism, add an installer in `apps/cli/src/lib/hooks.js` and wire it through `init.js`.

## Style

- Prettier + 2-space indent
- Semicolons + single quotes (TypeScript), CommonJS in CLI
- Strict TypeScript everywhere it's used
- Default to writing no comments; only add a comment for non-obvious *why*
- Don't add error handling for impossible cases

## Commits + PRs

- Conventional commit style: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `ci:`
- Keep PRs focused. One feature or fix per PR.
- Include a test for any bug fix or new parser
- Run `npm test` and `npm run typecheck` before pushing
