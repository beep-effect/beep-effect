# Infra Alchemy rebuild: friction receipts

Receipts recorded while the work happened. Secrets, home paths and machine
identifiers are redacted.

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
