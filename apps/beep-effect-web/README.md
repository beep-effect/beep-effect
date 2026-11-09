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
`Cloudflare.Website.Vite` Worker. Its state lives in the repo's shared AWS S3
state store (`AWS.state({ backend: "s3" })`, bucket
`alchemy-state-<accountId>-<region>-an`, SSE-KMS); every stack in the repo
shares that store, see `docs/runbooks/alchemy-infra.md`. Only the `prod` stage
attaches `beep-effect.com`, with `www` redirecting to the apex. Every other
stage serves from `workers.dev`.

`prod` deploys run only in CI: the `Deploy beep-effect-web` workflow (on push to
`main`, or a manual run) under one concurrency group, with AWS credentials from
the GitHub OIDC state role and the store's stage lease as the second guard. The
stack refuses `--stage prod` unless `CI=true`.

Locally, deploy a personal stage. Cloudflare credentials come from 1Password
through `op run`, never from an Alchemy profile; AWS credentials for the state
store are exported into the environment from an AWS profile that can read and
write the state bucket (Alchemy reads `AWS_ACCESS_KEY_ID` and friends, not
`AWS_PROFILE`; recipe in `docs/runbooks/alchemy-infra.md`). Pass `--stage`
explicitly: without it, Alchemy uses `$ALCHEMY_STAGE` when that is
set, and only then `live_$USER`. Run from this directory:

```bash
eval "$(aws configure export-credentials --profile <state-bucket profile> --format env)"
AWS_REGION=us-east-1 \
CLOUDFLARE_API_TOKEN="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ALCHEMY_TOKEN" \
CLOUDFLARE_ACCOUNT_ID="op://BEEP_SECRETS/BEEP_SECRETS/CLOUD_CLOUDFLARE_ACCOUNT_ID" \
  op run -- bunx alchemy deploy --stage "live_$USER"
```

Swap `deploy` for `plan` to preview, or `destroy` to remove the personal stage.
Decisions and the rollout plan are recorded in `goals/beep-effect-web-alchemy`
(archived) and `goals/infra-alchemy-rebuild` (state store move).

## License

MIT
