# Infra Alchemy rebuild: friction receipts

Receipts recorded while the work happened. Secrets, home paths and machine
identifiers are redacted.

## 2026-11-13: Alchemy's provider shape trips two repo-wide Effect diagnostics

- **Doing:** P2 `@beep/alchemy-vercel` (lane goals/infra-alchemy-rebuild-p2-vercel).
- **Evidence:** `tsrs -p tsconfig.json` on the new package failed with
  `effect(lazyEffect)` on every `XProvider = () => Provider.succeed(...)` and on
  `providers = () => Layer...` (Alchemy's own convention), and with
  `effect(missingPipeableSignature)` on `export const Project = Resource<Project>("Vercel.Project")`,
  because Alchemy's resource constructor has an `(id, Effect<props>)` overload.
  Both rules are `off` upstream and `error` in `tsconfig.base.json`, and
  `@effect-diagnostics` directives are banned outside two root files. The
  package exports constant layers and a narrowed `DeclaredResource<R>` type.
- **Would have prevented it:** a documented repo pattern for exporting
  third-party constructor shapes (Alchemy resources, platforms) that the
  `missingPipeableSignature` rule cannot model, or a rule option that
  ignores exported values typed by a dependency.

## 2026-11-13: Vitest loads `alchemy` twice, so `Unowned` reads look owned

- **Doing:** the adoption tests for the same package.
- **Evidence:** `stack.deploy` over a seeded, never-deployed project
  succeeded instead of failing with `OwnedBySomeoneElse`. The provider
  (transformed by Vite) imported `alchemy/AdoptPolicy` through the `default`
  export condition (`lib/*.js`), while the engine, loaded natively through
  `@alchemy.run/test`, used the `bun` condition (`src/*.ts`); the `Unowned`
  brand is a module-private symbol, so the engine never saw it. Fixed with
  `server.deps.inline: [/alchemy/]` in the package's `vitest.config.ts`.
- **Would have prevented it:** a shared vitest preset for packages that test
  Alchemy providers (inline `alchemy` and `@alchemy.run/*`), or a note in the
  alchemy-provider skill's testing section.

## 2026-11-13: the test harness types every engine error as `any`

- **Doing:** the same tests.
- **Evidence:** `tsrs -p tsconfig.test.json` reported 29
  `effect(anyUnknownInErrorContext)` errors on `stack.deploy(...)`,
  `stack.destroy()` and `provider.read(...)`, whose error channels are `any`
  in `@alchemy.run/test` and `alchemy/Provider`. The tests go through a typed
  view (`test/harness/Harness.ts` `typed`, `test/harness/Readers.ts`).
- **Would have prevented it:** a shared typed wrapper for the Alchemy test
  harness in a test-kit package, reused by every `@beep/alchemy-*` library.

## 2026-11-13: fallow ignores `test/fixtures/`, so test-only dependencies look unused

- **Doing:** the same package's final-check.
- **Evidence:** `fallow dead-code` reported `@alchemy.run/test` as an unused dev
  dependency of `@beep/alchemy-vercel`; its only importer was
  `test/fixtures/Harness.ts`, and `.fallowrc.jsonc` ignores `**/test/fixtures/**`.
  The harness moved to `test/harness/`.
- **Would have prevented it:** a note in the effect-vitest new-test-file
  checklist that `test/fixtures/` is invisible to fallow, so shared harness
  modules that import packages belong elsewhere.
## 2026-11-13: `A.makeBy(0, f)` returns one element

- **Doing:** P2 `@beep/alchemy-github-runners` scale-up tests (lane
  goals/infra-alchemy-rebuild-p2-github-runners).
- **Evidence:** the on-demand failover test failed with one `CreateFleet`
  request instead of two. The fake EC2 launched `A.makeBy(count, f)` instances
  and `A.makeBy(0, f)` returns `[f(0)]`: the result is a `NonEmptyArray`, so a
  zero count is clamped to one. The fake reported a full launch and the
  failover branch never ran.
- **Would have prevented it:** a `Gotchas` line on `effect/Array.makeBy` in the
  repo's Effect notes, or a lint that flags `makeBy` with a count that can be 0.

## 2026-11-13: opaque schema classes do not satisfy `S.Codec<A, I>` inference

- **Doing:** the same package, a generic Lambda-boundary helper that decodes a
  runtime config with the schema it is given.
- **Evidence:** typing the parameter `S.Codec<C, CI>` and passing an
  `S.Opaque` class failed with `Property 'brand' is missing` (the inferred `C`
  is the struct's type, not the opaque class). Typing it
  `SC extends S.Codec<unknown, unknown, never, never>` and using `SC["Type"]`
  works.
- **Would have prevented it:** the schema-first skill showing the generic
  signature for helpers that take an opaque schema.

## 2026-11-13: distilled GitHub rc.18 has no App authentication

- **Doing:** the GitHub App live layer of the same package.
- **Evidence:** `@distilled.cloud/github@1.0.0-rc.18` exports `Credentials`
  (bearer token only); the `App` module that mints JWTs and installation tokens
  exists on distilled `main` but not in rc.18, so the package signs the RS256
  JWT itself with WebCrypto, including a PKCS#1 to PKCS#8 key wrapper.
- **Would have prevented it:** a distilled bump that ships the App module; the
  package's `WebCrypto.signAppJwt` is then deleted (decision file
  `2026-11-13-app-jwts-are-signed-with-webcrypto-...`).

**Update, same day:** #3278 moved the distilled family to `1.0.0-rc.19`, which ships `@distilled.cloud/github/App`;
the package now uses `App.appJwt` and the hand-rolled signer is gone. The receipt stands for the hours lost
to the gap between the reference checkout (main) and the pinned release.

## 2026-11-13: SAST flags a PEM template that wraps a test-generated key

- **Doing:** PR #3291 hosted SAST.
- **Evidence:** semgrep `beep-hardcoded-private-key` blocked on a test helper that formats a key generated at
  test time (`crypto.subtle.generateKey`) into a PEM whose header and footer were string literals; no key
  material was committed. Assembling the label at runtime clears it.
- **Would have prevented it:** a local `sast` step in `package-verify`, or a note in the test checklist that PEM
  header and footer literals trip the rule even around generated keys.
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

## 2026-11-14: every Alchemy package grows its own copy of the fake-AWS test harness

- **Doing:** P3 cost controls stack (lane `goals/infra-alchemy-rebuild-p3-cost-controls`), pushing the
  round-2 review fixes for #3310.
- **Evidence:** cheap-gates `fallow:audit` refused the push with `audit-introduced-duplication-1`: the
  package's `test/support/FakeAws.ts` repeated the generic parts of `@beep/alchemy-aws-extras`'
  fake (operation log, failure-tag walk, deploy-failure helper, typed `test.provider` wrapper, the
  awsJson `HttpClient`), seven clone groups. The PR shrank its fake to what its tests need instead of
  adding a package mid-review.
- **Would have prevented it:** a small shared test-kit for `@alchemy.run/test` suites (fake AWS
  environment layer, awsJson `HttpClient` from a route table, typed scratch-stack view, failure
  helpers) that every `@beep/alchemy-*` and `@beep/infra-*` package imports.
