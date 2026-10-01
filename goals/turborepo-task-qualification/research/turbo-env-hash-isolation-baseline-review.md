# Accept the narrowed `build` env declarations

PR #1381 stops per-checkout `.env` drift from splitting the shared workstation
Turbo cache. The root `build` task declared twelve app env patterns
(`APP_ADMINS_EMAILS`, `ALLOWED_EMAILS`, `DATABASE_URL`,
`DATABASE_URL_UNPOOLED`, `EMAIL_*`, `AUTH_*`, `OPENAI_*`, `SECURITY_*`,
`OAUTH_*`, `NEXT_PUBLIC_*`, `LIVEBLOCKS_*`, `RESEND_*`) as hashed inputs for
every workspace. No library build reads them, but `bun run` entrypoints load
each clone's untracked `.env`, so every clone computed different build hashes
at the same commit (measured: 0/141 cross-clone hits).

The branch removes that list from the root `build` task and declares it only
on the Next app builds that inline and prerender with it: `apps/oip-web`
(alongside its existing `ANALYZE`) and a new `apps/todox/turbo.json`.
`apps/professional-desktop` adds `VITE_*` beside `TAURI_*`, since Vite inlines
those.

`beep quality cache-policy` therefore reports `configuration-drift` for every
`#build` computation (the env declaration changed) and
`configuration-source-drift` for the four edited `turbo.json` files. No
command, dependency edge, cache flag, input, output or global configuration
changed.

Accept the narrowed env declarations in the legacy configuration baseline.
This review grants no runtime qualification. Retain the identity/types/fc-runs/
test-runner lint scope, `local-linux-x64-bun1.4.2` profile and
`qualification-v2` epoch; the qualification ledger is untouched.
