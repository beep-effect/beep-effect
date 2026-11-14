# Infra Alchemy rebuild: friction receipts

Receipts recorded while the work happened. Secrets, home paths and machine
identifiers are redacted.

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

## 2026-11-14: the plan cannot show that an AWS services anomaly monitor is an account singleton

- **Doing:** P3 cost controls stack (lane `goals/infra-alchemy-rebuild-p3-cost-controls`); the brief and the
  matrix treated the anomaly monitor as a greenfield named resource to run beside the Pulumi one.
- **Evidence:** AWS allows one `DIMENSIONAL`/`SERVICE` anomaly monitor per account (Cost Management quotas
  page); the account has one, `beep-account-services`. `alchemy plan` never calls `CreateAnomalyMonitor`, so
  a second monitor plans as a clean create and would fail only at deploy. The stack adopts the live monitor
  in `prod` instead (`adopt(true)`).
- **Would have prevented it:** a quota column in the "use this, never roll that" matrix for every resource
  planned as greenfield beside a live one, filled from the service's quotas page.

## 2026-11-14: `create-package --kind infra` names the directory after the package, unlike its sibling

- **Doing:** the same lane, bootstrapping `@beep/infra-cost-controls`.
- **Evidence:** `bun run beep create-package infra-cost-controls --family tooling --kind infra` wrote
  `packages/tooling/infra/infra-cost-controls`; the turbo-cache lane's package lives at
  `packages/tooling/infra/turbo-cache`. Reverted and re-ran with `--dir-name cost-controls`. The scaffold also
  gives `alchemy.run.ts` no tsconfig owner; it was added to `tsconfig.test.json` by hand.
- **Would have prevented it:** the infra kind strips the `infra-` prefix for the directory, and its tsconfig
  template includes `alchemy.run.ts`.

## 2026-11-14: `AWS.Region.of` has no effect beside `AWS.providers()`

- **Doing:** the same lane, pinning the stack to `us-east-1` as the matrix row says.
- **Evidence:** `AWS.providers()` and `@beep/alchemy-aws-extras`' `providers` both `provideMerge` a fresh
  `Region.fromEnvironment` inside their own layer, so a `Region.of(...)` provided from outside is shadowed
  and the region still comes from `AWS_REGION`. The stack builds its own collection of the five providers it
  uses with `Region.of("us-east-1")` in that chain, and the account guard also checks the region.
- **Would have prevented it:** a `region` option on `AWS.providers()` and the extras layer, or the matrix row
  naming where `Region.of` must sit.
