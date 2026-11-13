# Infra Alchemy rebuild: friction receipts

Receipts recorded while the work happened. Secrets, home paths and machine
identifiers are redacted.

## 2026-11-13: the stack's Cloudflare token could not reach R2, found only at deploy time

- **Doing:** P3 turbo cache, personal-stage deploy proof (lane goals/infra-alchemy-rebuild-p3-turbo-cache).
- **Evidence:** `bunx alchemy plan --stage dev_<user>` fails in `plan.diff.resource` with
  `Unauthorized: Authentication error` (Cloudflare code 10000); `GET /accounts/<id>/r2/buckets`
  with the same token returns `Authentication error`. The token was minted for one Worker stack
  (`mint-alchemy-token.sh`, 2026-10-28) and every later stack reuses it through each environment's
  `CLOUDFLARE_API_TOKEN` secret.
- **Would have prevented it:** a per-stack permission manifest checked before a lane starts
  (`beep` command that verifies the token against the groups each stack's resources need), or
  minting the stack token from IaC (`Cloudflare.ApiToken.AccountApiToken`, matrix row) so a new
  resource type widens it in the same PR.

## 2026-11-13: a stack's own `state` wins over `Test.make({ state })` for top-level deploys

- **Doing:** stack test for `TurboCache` on the `@alchemy.run/test` harness.
- **Evidence:** `deploy(Stack)` with `Test.make({ state: inMemoryState(), dev: true })` failed with
  `AuthError: Provider 'AWS' is not configured in profile 'default'`: the stack effect provides its
  declared `AWS.state(...)` inside, so the harness's state layer never applies.
- **Would have prevented it:** a documented pattern in `docs/runbooks/alchemy-infra.md`: export the
  stack program and deploy it on a `test.provider` scratch stack (what the package now does).

## 2026-11-13: Worker fixtures bundled by Alchemy cannot import a package's `internal/` modules

- **Doing:** moving the scratchpad handler into the package and its Worker fixtures into `test/`.
- **Evidence:** the scaffold's exports map sets `"./internal/*": null`; vitest resolves
  `@beep/<pkg>/internal/*` through aliases, but a fixture passed as a Worker `main` is bundled
  with package resolution, which honours the exports map.
- **Would have prevented it:** the `tooling/infra` file-role anchors saying that Worker runtime
  modules are public package modules.

## 2026-11-13: the `infra` scaffold's tsconfig does not own `alchemy.run.ts`

- **Doing:** final-check for `@beep/infra-turbo-cache`.
- **Evidence:** `lint deprecated-apis: TypeScript files have no tsconfig owner:` listing
  `alchemy.run.ts`, `token.ts` and `test/fixtures/*.ts`. `create-package --kind infra` emits the
  library tsconfig (`include: ["src"]`, `rootDir: "src"`), yet the kind's anchor puts
  `alchemy.run.ts` at the package root. The package now sets `rootDir: "."` with the root files
  included (declarations under `dist/src/`, `publishConfig.exports` pointed there) and gives
  `test/fixtures/` its own `tsconfig.json`, as `@beep/palantiri` does.
- **Would have prevented it:** the `infra` kind template emitting that tsconfig shape and a
  fixtures tsconfig, so the next infra package starts owned.
