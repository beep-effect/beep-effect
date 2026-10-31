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

Credentials come from 1Password through `op run`, never from an Alchemy profile.
Run from this directory:

```bash
CLOUDFLARE_API_TOKEN="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ALCHEMY_TOKEN" \
CLOUDFLARE_ACCOUNT_ID="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ACCOUNT_ID" \
  op run -- bunx alchemy plan --stage prod
```

Swap `plan` for `deploy` to apply. Without `--stage`, the deploy goes to a
personal `live_$USER` stage. Decisions and the rollout plan are recorded in
`goals/beep-effect-web-alchemy`.

## License

MIT
