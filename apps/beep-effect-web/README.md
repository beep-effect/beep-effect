# @beep/beep-effect-web

beep-effect.com public website (TanStack Start on Cloudflare via Alchemy)

## Development

```bash
bun run dev
bun run check
bun run test
bun run lint
```

This workspace is a runtime app, not a public TypeScript package. Keep app internals behind `@/*`; promote reusable contracts and domain code to slice or shared packages.

The dev server runs through portless at `http://beep-effect-web.beep.localhost:1355`.

## Deploy

`alchemy.run.ts` declares the `BeepEffectWeb` Alchemy stack: one
`Cloudflare.Website.Vite` Worker. Its state lives in the account's
`Cloudflare.state()` store. Only the `prod` stage attaches `beep-effect.com`,
with `www` redirecting to the apex. Every other stage serves from `workers.dev`.

`prod` deploys run only in CI: the `Deploy beep-effect-web` workflow (on push to
`main`, or a manual run) under one concurrency group. The Cloudflare state store has
no stage lock, so a local run would race it. The stack refuses `--stage prod`
unless `CI=true`.

Locally, deploy a personal stage. Credentials come from 1Password through
`op run`, never from an Alchemy profile. Pass `--stage` explicitly: without it,
Alchemy uses `$ALCHEMY_STAGE` when that is set, and only then `live_$USER`.
Run from this directory:

```bash
CLOUDFLARE_API_TOKEN="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ALCHEMY_TOKEN" \
CLOUDFLARE_ACCOUNT_ID="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ACCOUNT_ID" \
  op run -- bunx alchemy deploy --stage "live_$USER"
```

Swap `deploy` for `plan` to preview, or `destroy` to remove the personal stage.
Decisions and the rollout plan are recorded in `goals/beep-effect-web-alchemy`.

## License

MIT
