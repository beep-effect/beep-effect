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
## 2026-11-13: vitest loads two copies of Alchemy, so `Unowned` stops refusing

- **Doing:** P2 aws-extras lane, the adopt test for `RunnerLaunchTemplate`
  under `@alchemy.run/test` (`test.provider`, `inMemoryState()`).
- **Evidence:** a same-name launch template without Alchemy's ownership tags
  was adopted on a plain `stack.deploy`, with no `adopt(true)`. Instrumenting
  `read` showed it returned `Unowned(attrs)` while `AdoptPolicy` resolved to
  `false`. The planner checks the brand with `Unowned.is`, keyed by a
  module-private symbol, and vitest had loaded the engine (through
  `@alchemy.run/test`) separately from the package source that imports
  `alchemy/AdoptPolicy`. Inlining `alchemy` and `@alchemy.run/*` with
  `test.server.deps.inline` in the package `vitest.config.ts` fixed it: the
  deploy then fails with `OwnedBySomeoneElse`.
- **Would have prevented it:** a shared vitest preset for `@beep/alchemy-*`
  packages that inlines Alchemy, or an upstream `Unowned` brand registered
  with `Symbol.for`. Sibling lanes (vercel, github-runners) need the same
  config, or their adopt tests pass for the wrong reason.

## 2026-11-13: repo Effect diagnostics reject Alchemy's provider idioms

- **Doing:** the same lane, typing the resources and providers.
- **Evidence:** `tsrs -p tsconfig.json` reports
  `effect(missingPipeableSignature)` on every exported `Resource(...)` value
  (Alchemy's `(id, Effect<props>)` overload), `effect(lazyEffect)` on
  `XProvider = () => Provider.succeed(...)` and `providers = () => Layer...`,
  and `effect(anyUnknownInErrorContext)` on every `stack.deploy(...)` in
  tests, because `ScratchStack` types failures as `any`. Diagnostic
  directives are banned by the quality gate. The workarounds: export each
  resource through a narrowed `ExtrasResource` interface, make providers
  Layer constants, and give tests a `TypedStack` view of the scratch stack
  (`test/support/FakeAws.ts`). About an hour went to this.
- **Would have prevented it:** a short `@beep/alchemy-*` section in the
  `alchemy-provider` skill naming these three shapes, or one shared
  internal helper package the three P2 libraries import.

## 2026-11-13: a cache-baseline re-record has to review root drift inherited from `main`

- **Doing:** P3 Storybook stack (lane `goals/infra-alchemy-rebuild-p3-storybook`); a new script in
  `apps/storybook/package.json` drifted eight `@beep/storybook` computations.
- **Evidence:** `bun run beep cache baseline --request <request.json>` with `subjects: ["@beep/storybook"]`
  answered `Baseline review does not cover the changed subjects. Unreviewed: //.` The lane does not touch
  `turbo.json`; four PRs merged after the last record (#3242) had regenerated ten root-declared
  `@beep/repo-cli#lint:policy-fingerprint:*` input lists, which `main` reports only as
  `REVIEW configuration-source-drift: turbo.json`. The next lane to re-record inherits the review.
- **Would have prevented it:** the PR that regenerates root `turbo.json` input lists re-records `//` itself
  (make the source drift a BLOCK there), or the baseline command names inherited subjects apart from the
  lane's own so the reviewer knows which diff to read.

## 2026-11-13: `final-check` coverage replays the whole repo when `bun.lock` changes

- **Doing:** the same lane; the diff adds three dependencies to one app, so `bun.lock` gains four lines.
- **Evidence:** `final-check:coverage` selected the full workspace (`coverage:full`, shard 2 of the run) and
  was killed after 36 minutes with exit 143; the other gates took under seven minutes each. The receipt for
  the pushed head records the gate as skipped and hosted CI measures it.
- **Would have prevented it:** scope the coverage replay by the workspaces whose resolved dependencies
  changed in the lockfile diff, not by the lockfile path alone.
