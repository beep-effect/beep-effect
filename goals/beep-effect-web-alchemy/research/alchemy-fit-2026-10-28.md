# Alchemy fit notes (2026-10-28)

Fetched from `https://alchemy.run/*.md` on 2026-10-28. Alchemy v2 is
"Alchemy Effect": stacks and resources are Effect programs.

## Versions

- `alchemy@2.0.0-beta.84` (`latest` dist-tag; v2 is still beta).
- Peer `effect ^4.0.5`; the repo catalog pins `effect` 4.0.6, so no conflict.
- Cloudflare provider: `@alchemy.run/cloudflare@2.0.0-beta.84`. Next.js adds
  `@alchemy.run/frontend-frameworks` and `@opennextjs/cloudflare`.

## Monorepo guidance (`/project-structure/monorepo`)

- Option A: one `alchemy.run.ts` at the workspace root. Alchemy says to start here.
- Option B: one Stack per package, linked by typed cross-stack references.
  Use it when packages deploy on different cadences or need independent `destroy`.
- In either option, anchor paths with `import.meta.url` / `import.meta.dirname`,
  because the CLI resolves relative paths from the workspace root.

## State (`/state-store`)

- The default is local `.alchemy/` (gitignored). For teams and CI, Alchemy recommends `Cloudflare.state()`.
- `Cloudflare.state()` stores state in an account-level Worker
  (`alchemy-state-store`): a Durable Object with embedded SQLite. Its bearer
  token and encryption key live in Cloudflare Secrets Store, and state is encrypted at rest.
  Every stack and stage on the account shares this store.
- The first local run bootstraps the store. In CI (`CI=true`) a missing store fails the run;
  provision it ahead of time with `alchemy state bootstrap --backend cloudflare`.
- Only `postgresState()` documents a per-(stack, stage) lock. The Cloudflare
  store documents no lock, so CI needs a concurrency group.
- Compared with Terraform: the Cloudflare store takes the role of S3 plus DynamoDB.

## Frameworks (`/cloudflare/frontend/frontends`)

- `Cloudflare.Website.Vite` is the core resource. It covers TanStack Start,
  React Router, and SPAs. There is an Effect RPC + atom TanStack Start guide.
- `Cloudflare.Website.Nextjs` builds through OpenNext. It does not support
  edge-runtime routes or PPR/`"use cache"`, and `next/image` needs Cloudflare Images.

## Domains (`/cloudflare/networking/*`)

- The Worker `domain` prop (`name`, `aliases`, `redirects`) provisions the DNS
  record and certificate. The zone must already exist in the account.
- Existing records are not managed until adopted: Alchemy refuses to touch them
  without `adopt(true)`.

## Credentials (`/cloudflare/setup`, `/environments/ci`)

- Alchemy reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from the
  environment, which fits `op run`. Profiles (`~/.alchemy/profiles.json`) are
  the interactive path.

## Live zone snapshot (read-only API, 2026-10-28)

- `beep-effect.com` apex: two proxied A records pointing at registrar parking/forwarding IPs.
- `www`: proxied CNAME to the apex.
- `_domainconnect`: registrar CNAME. `_dmarc`: TXT.
- No Worker routes or custom domains. Pulumi `infra/` does not touch this zone.

## Repo constraints

- `bun run beep create-package --type app --app-kind nextjs|vite` is the
  only bootstrap path.
- `@beep/public-site` (foundation/modeling) owns the beep-effect.com route map:
  apex = projections, `/ns/` reserved (ruling 2026-10-20).
