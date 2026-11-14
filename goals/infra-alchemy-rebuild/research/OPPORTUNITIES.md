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

## 2026-11-14: the Pulumi passphrase in 1Password does not decrypt the oip-web stacks

- **Doing:** P4 oip-web census (lane goals/infra-alchemy-rebuild-p4-oip-web), reading where the HubSpot
  service key lives today.
- **Evidence:** `pulumi config get oipWeb:hubSpotServiceKey --stack production` (and `staging`) under
  `PULUMI_CONFIG_PASSPHRASE=op://BEEP_SECRETS/BEEP_SECRETS/PULUMI_ENCRYPTION_PASSPHRASE op run --` exits 1 with
  `error: incorrect passphrase`; plain config reads on the same stacks work. The value is also stored in
  Vercel as `sensitive`, which the API never returns, so no recorded copy of the live key is readable.
- **Would have prevented it:** a check that every Pulumi project's `encryptionsalt` decrypts with the
  1Password passphrase (run when the passphrase or a stack changes), and a 1Password field per runtime secret
  so the IaC copy is never the only one.
- **Correction (packet gate session, 2026-11-14):** the oip-web stacks decrypt with
  `op://BEEP_SECRETS/OIP_SECRETS/PULUMI_CONFIG_PASSPHRASE`; the `BEEP_SECRETS` item's passphrase belongs to
  the runners stack. The live HubSpot token is `op://BEEP_SECRETS/OIP_SECRETS/CRM_HUBSPOT_SERVICE_KEY` and equals
  the value both stacks held. The receipt stands as friction: the lane had no pointer from the Pulumi project to its
  1Password item.

## 2026-11-14: Alchemy persists a `Redacted` prop's plain text in state

- **Doing:** the same lane, designing how the HubSpot key reaches Vercel without entering state.
- **Evidence:** `alchemy/src/State/StateEncoding.ts` writes `Redacted<T>` as `{ "__redacted__": <inner> }`
  "so the actual string is persisted rather than the `<redacted>` placeholder"; `@beep/alchemy-vercel`'s
  `EnvVar.value` prop was documented as "redacted in state and logs". Any secret passed as `value` lands in
  the state bucket in clear JSON (SSE-KMS at rest only). The lane added `valueFrom: { config }`, resolved in
  `diff` and `reconcile`, with only a SHA-256 kept in state.
- **Would have prevented it:** an Alchemy-level deferred secret input (resolved at apply time, digest in
  state) so every provider gets the property, and a harness assertion in provider tests that no `Redacted`
  value appears in persisted state.

## 2026-11-14: `alchemy plan` lines in CI carry a logger prefix

- **Doing:** the same lane, writing the pre-deploy plan check.
- **Evidence:** the `dev_$USER` plan printed `[20:33:03.096] INFO: [Project] create`, not the bare
  `[Project] create` that `formatPlanLines` renders; a parser anchored at line start found no `Plan:` summary
  and failed closed. Only a real plan run showed it.
- **Would have prevented it:** a machine-readable plan output (`alchemy plan --json`, or a documented
  changes-pending exit code, open question 9 of the P0 matrix).

## 2026-11-14: the Alchemy Cloudflare token cannot read the oip.law zones' DNS records

- **Doing:** the same lane, census of the Pulumi-owned DNS records.
- **Evidence:** with `CLOUD_CLOUDFLARE_ALCHEMY_TOKEN`, `GET /zones/<id>` succeeds for both zones and
  `GET /zones/<id>/dns_records` returns 403; `CLOUD_CLOUDFLARE_ACCOUNT_IAC_TOKEN` reads them. Of the two
  Vercel fields, `CLOUD_VERCEL_TOKEN` reads the team and `CLOUD_VERCEL_API_TOKEN` returns 403 on every call.
- **Would have prevented it:** a token inventory naming each 1Password field's scope, checked by a
  read-only probe per stack before a lane starts.
## 2026-11-13: `@alchemy.run/test` `test(name, effect)` takes an Effect, not a thunk

- **Doing:** P4 hosts stacks (lane `goals/infra-alchemy-rebuild-p4-hosts`), first hermetic stack tests on
  `Test.make(...)` from `@alchemy.run/test/Vitest`.
- **Evidence:** written in the `@effect/vitest` shape `test("…", () => Effect.gen(…))`, every test failed with
  `TypeError: (testDev ? provideTestServices(body) : body).pipe is not a function` from
  `@alchemy.run/test/src/Core.ts:575`. The harness's `TestFn` is `(name, eff: TestEffect<void>)`: the second
  argument is the Effect itself. The type checker did not flag the thunk because the call was not yet checked.
- **Would have prevented it:** a worked stack-test example in `docs/runbooks/alchemy-infra.md` ("Adding an
  infra package") showing `test("…", Effect.gen(…))`, fake providers and `inMemoryState`, or an upstream
  `Test.make` overload that rejects a function.

## 2026-11-13: adopting a Compose-managed Docker volume would replace it

- **Doing:** the same lane, mapping the AI metrics Compose volume onto `Docker.Volume`.
- **Evidence:** `@alchemy.run/docker` `Volume.diff` returns `replace` with `deleteFirst: true` whenever the
  observed user labels differ from the declared ones (`node_modules/@alchemy.run/docker/src/Volume.ts`, diff),
  and a Compose volume carries `com.docker.compose.*` labels, so `adopt(true)` on the Phoenix data volume
  would plan a delete of the data. `Docker.Volume.lookup` (read, never created or removed) is the safe
  primitive; the stack uses it.
- **Would have prevented it:** a note in the P0 matrix row for `@beep/infra-hosts` that named data volumes
  are looked up, not adopted.

## 2026-11-13: Fallow does not know a second Alchemy entry file

- **Doing:** the same lane; the OpenClaw stack is a second entry, `openclaw.alchemy.run.ts`, beside the
  package's `alchemy.run.ts`.
- **Evidence:** `fallow dead-code --config .fallowrc.jsonc` reported
  `unused-file packages/tooling/infra/infra-hosts/openclaw.alchemy.run.ts` (the CLI loads it by path,
  `alchemy deploy <file>`); fixed with an entry glob `packages/tooling/infra/*/*.alchemy.run.ts`.
- **Would have prevented it:** the `infra` package kind registering `*.alchemy.run.ts` entries with Fallow
  when it registers `alchemy.run.ts`.

## 2026-11-13: code moved out of `infra/` meets the docs lint and JSDoc ratchet for the first time

- **Doing:** P4 hosts lane, moving the OpenClaw renderers from `infra/src/OpenClaw.ts` into
  `@beep/infra-hosts`.
- **Evidence:** the root docs lint (`oxlint . --config .oxlintrc.docs.json --max-warnings=0`) reported about
  30 functions without `@param`/`@returns`, and `jsdoc:ratchet:check` reported
  `multiple-description-paragraphs: 167 > 157`; the same doc blocks had passed while they lived under `infra/`.
  Fixed by adding the tags and a `**Details**` section (the ratchet then read 137).
- **Would have prevented it:** `package-verify` running the docs oxlint rules and the package-scoped JSDoc
  ratchet, so a move into `packages/` fails before hosted CI.

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

## 2026-11-14: hosted Commitlint lints every commit in the PR range

- **Doing:** P2 runner composite lane (`@beep/alchemy-github-runners`), recorded here for that retired lane.
- **Evidence:** pushed `wip(...)` commits failed hosted Commitlint, which checks every commit in the range; a
  pushed commit cannot be fixed without a force push, so #3313 was replaced by the squashed #3314.
- **Would have prevented it:** a lane-local commit-type check before push, or `yeet open` refusing a range that
  holds a disallowed type.

## 2026-11-14: skipped repo-wide gates hide package-scoped law reds until hosted CI

- **Doing:** the same runner lane, with the repo-wide `final-check` gates skipped under the disk-load rule.
- **Evidence:** each of these cost a push: schema-first D1 (plain-data `S.Class` must be a branded
  `S.Opaque`; an untracked advisory row also exits 1), the JSDoc ratchet (a titled Example on each new exported
  schema; module docs with more than one paragraph), `semantic-delta` reading a backticked goal branch name as a
  missing path, and oxlint `beep(no-inline-schema-compile)` in test code (#3320).
- **Would have prevented it:** a cheap package-scoped law-check bundle that the constrained-compute rule allows.

## 2026-11-14: two gates look green while checking nothing

- **Doing:** the same runner lane.
- **Evidence:** `bunx turbo run lint:schema-first --filter=<pkg>` runs zero tasks and exits 0, because the task is
  root-declared; `jsdoc:ratchet:check` reads an untracked `.beep/ci` inventory that stays stale until it is
  regenerated, so it passes or fails on old findings.
- **Would have prevented it:** both commands refusing to report success when they evaluated nothing or read an
  inventory older than the working tree.

## 2026-11-14: `yeet open` took a sibling PR's title

- **Doing:** the same runner lane, opening #3313.
- **Evidence:** `yeet open` titled the PR from the first non-merge commit in the range, which belonged to a
  sibling PR (#3313 got the title of #3291).
- **Would have prevented it:** titling from the first commit unique to the head, not reachable from the base or
  an open sibling.

## 2026-11-14: an orphaned test fixture blocked `sweep --retire`

- **Doing:** retiring the runner lane.
- **Evidence:** a repo-cli test fixture process (`exchange-crash-writer.ts`) ignored SIGTERM, kept the lane
  checkout busy and blocked `yeet sweep --retire`.
- **Would have prevented it:** the fixture exiting on SIGTERM, or the retire fence naming the holding process.

## 2026-11-14: `yeet publish` cannot push a fix wave while an inherited cheap gate is red

- **Doing:** P4 hosts lane, pushing review-round-1 fixes and a main merge to the open #3325 while
  `observability:catalog-check` was red from #3314 (the runners instrumentation catalog, fixed by #3327).
- **Evidence:** `yeet publish --push-only` answered `requires --reuse-verified unless HEAD is a reproducible
  merge of the base`; `--reuse-verified` answered `No reusable Yeet proof state found`; `publish --amend
  --no-edit` re-runs cheap-gates, which has no `--skip` for an attributed inherited lane. The head had a passing
  `final-check` receipt recording that skip. A plain `git push` went through instead, losing nothing (the
  readiness monitor followed the new head and the body kept its provenance footer), but outside Yeet.
- **Would have prevented it:** `yeet publish` naming `yeet open` as the route for a committed head with a
  passing receipt on an already open PR, or accepting the receipt's recorded skips for its own cheap-gates run.
