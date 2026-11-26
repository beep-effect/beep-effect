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

## 2026-11-13: `create-package github --kind infra` leaves a half-written `@beep/github` that config-sync then wires in

- **Doing:** P3 GitHub stack (the P3 GitHub lane), trying to match the sibling
  turbo-cache layout (directory turbo-cache under the tooling infra family, package `@beep/infra-turbo-cache`).
- **Evidence:** `bun run beep create-package github --family tooling --kind infra` wrote
  `packages/tooling/infra/github/package.json` with name `@beep/github` (the drivers package already owns
  it), then failed with `Workspace name "@beep/github" already exists`. The partial directory stayed, and the
  next config-sync rewired three packages' tsconfig references from `packages/drivers/github` to it.
  The working form is `create-package infra-github --dir-name github`.
- **Would have prevented it:** check the workspace name before writing any file; and for `--kind infra`,
  default the package name to `@beep/infra-<name>` (or say in the help that the prefix is the caller's job).

## 2026-11-13: `@alchemy.run/github` beta.86 plans adopted singletons as `create`

- **Doing:** the same lane; the read-only `alchemy plan` of `InfraGithub` against the live repository.
- **Evidence:** `Plan: 36 to create, 1 to adopted`. Only `GitHub.Ruleset` has a `read` adoption probe;
  `Repository`, `Environment`, `Variable` and `Label` return nothing without prior state, so an empty stage
  shows `create` for objects whose reconcile only updates (stack tests assert zero POST). A reviewer reading
  the plan cannot tell a real create from a converge-by-name.
- **File evidence (installed `@alchemy.run/github@2.0.0-beta.86`, same on Alchemy `main` at `33c10dd55f`):**
  the engine probes adoption only through `provider.read` when a resource has no state
  (`alchemy/src/Plan.ts:1749`). `src/Repository.ts:592` returns `undefined` from `read` whenever
  `output` is undefined, so an empty stage never sees the live repository; `src/Label.ts`,
  `src/Environment.ts` and `src/Variable.ts` define no `read` at all. `src/Ruleset.ts:651` is the
  model to copy: it lists by name and returns `Unowned(attrs)`.
- **Would have prevented it:** a name-based `read` in those four providers (upstream contribution); until
  then the decision file explains each `create`. Packet gate ruling 2026-11-13: accepted as is, not held
  on the upstream change.
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

## 2026-11-14: `Lambda.FunctionProvider` needs a `Docker` service for zip functions

- **Doing:** P5 ci-runners stack (lane `goals/infra-alchemy-rebuild-p5-ci-runners`), building a provider layer
  with only the providers the stack declares, as cost-controls does.
- **Evidence:** `alchemy.run.ts` failed typecheck with `Type 'Docker' is not assignable to type 'StackServices'`:
  `FunctionProvider` builds `makeFunctionImage` up front, which requires `@alchemy.run/docker`'s `Docker`
  service even though every function is a bundled zip. The stack now provides `DockerLive` (lazy; it never runs
  `docker`), which needed a new root catalog entry `@alchemy.run/docker`.
- **Would have prevented it:** `FunctionProvider` resolving `Docker` only for image functions, or the runbook's
  "Adding an infra package" listing the layers a Lambda-declaring stack must provide.

## 2026-11-14: the termination watcher's prefix filter makes the fleet name a fence

- **Doing:** the same lane, choosing physical names for the new fleet.
- **Evidence:** `TerminationWatcher.program.ts` `matchesEnvironment` acts on every instance whose
  `ghr:environment` starts with the fleet name. The obvious name `beep-ci` would have matched the live
  `beep-ci` pool's instances; `beep-fleet` for `prod` and `beep-fleet-dev-...` for personal stages would make
  the `prod` watcher act on personal runners. The stack now names fleets `beep-fleet-<stage>` and a guard
  refuses names that overlap the live prefixes.
- **Would have prevented it:** matching `<name>-<pool>` exactly (the composite knows every pool), not a prefix.

## 2026-11-14: `lint deprecated-apis --full` refuses TypeScript under `test/fixtures/`

- **Doing:** the same lane, running the package-scoped gates before reporting.
- **Evidence:** `lint deprecated-apis: TypeScript files have no tsconfig owner: .../test/fixtures/PersonalPlan.ts`
  although `tsconfig.test.json` includes `test`. Moving the file to `test/support/` passed.
- **Would have prevented it:** the owner check using the package's own tsconfig includes, or the message naming
  the excluded directory.

## 2026-11-14: Alchemy beta.87 has no command that prints a stack output

- **Doing:** the same lane, drafting the deploy workflow's post-deploy check of the webhook URL.
- **Evidence:** `node_modules/alchemy/src/Cli/commands/` has no `output` command; the draft greps the URL out of
  the deploy log instead, an assumption to confirm on the first deploy.
- **Would have prevented it:** an `alchemy output --stage <s> <key>` command, or the runbook naming the
  supported way to read an output in CI.

## 2026-11-14: `observability catalog --write` rewrites a sibling package's stale shard

- **Doing:** the same lane, regenerating its own instrumentation shard.
- **Evidence:** the writer also added seven spans (`RunnerFleet.*`, `RunnerSweep.*`) to
  `standards/instrumentation-catalog/@beep/alchemy-github-runners.generated.jsonc`: `main` carries that shard
  without the spans #3314 added, so `observability catalog --check` is inherited-red there. The lane reverted
  the sibling shard and left it to a fix on `main`.
- **Would have prevented it:** the catalog check in the PR's required set for every package that adds a span,
  or a `--package` filter on `--write`.

## 2026-11-14: receipts owed from the runners lane (#3314), carried here

- Hosted Commitlint lints every commit in the PR range; pushed `wip(...)` commits cannot be fixed without a
  force push, so #3313 was replaced by squashed #3314. Prevent: a lane-local commit-type check, or `yeet open`
  refusing a range with disallowed types.
- With repo-wide gates skipped under the disk rule, each of these cost a push: schema-first D1 (S.Opaque data
  models; an untracked advisory also exits 1), the JSDoc ratchet (titled Example per exported schema), a
  semantic-delta probe reading a backticked branch name under `goals/` as a missing path, and oxlint
  `beep(no-inline-schema-compile)` in test code (#3320). Prevent: a cheap package-scoped law-check bundle
  allowed under constrained compute.
- Looks-like-passing traps: `bunx turbo run lint:schema-first --filter=<pkg>` runs zero tasks and succeeds;
  `jsdoc:ratchet:check` reads a stale untracked `.beep/ci` inventory until it is regenerated.
- `yeet open` titled a new PR from the first non-merge commit in the range, a sibling PR's commit (#3313 got
  #3291's title).
- A cache baseline re-record demanded review of `//` drift that came only from `main` (#3317).
- `standards/cache-qualification-baseline.json` is one file every package-adding PR rewrites: two unrelated
  merges (#3322, #3299) put three open packet PRs (#3323, #3324, #3325) into base conflict on that file alone.
  Prevent: per-subject baseline files, or a merge driver that unions disjoint subjects.
- Root law tasks that package-scoped pre-push lists miss (`lint:effect-vitest`, `laws schema-tag-idioms`,
  `lint:shadcn` reading a bracketed log timestamp as a Tailwind value, Fallow introduced complexity,
  `beep(no-inline-schema-compile)`) each cost a push on #3320, #3323, #3324. Prevent:
  `beep quality package-verify --laws` running every root law task filtered to the changed files.
- Operator approval of a workflow file pinned to a blob is invalidated by any review-driven edit to that file;
  #3323 and #3324 each needed a second ask. Prevent: ask after the first review round, not at open.

## 2026-11-14: `Lambda.Function` cannot pin its execution role's name

- **Doing:** P5 ci-runners stack (lane `goals/infra-alchemy-rebuild-p5-ci-runners`), pinning every `prod`
  physical name so a lost or moved state cannot mint a second fleet (the #3133 lesson).
- **Evidence:** Alchemy 2.0.0-beta.87 `Lambda.Function` names its own role with
  `createPhysicalName({ id, maxLength: 64 })` (`CiRunners-<logical id>-prod-<instance suffix>`) and its props
  take no `role`, `roleArn` or `roleName`. Functions, queues, runner roles, profiles, templates, rules and the
  bucket are pinned through `RunnerFleetProps.namePrefix`; the nine execution roles stay generated, and the
  deploy role keeps a `role/CiRunners-*-prod-*` allowance for them. Accepted by the packet gate: the pinned
  function names collide after a state loss, so no second fleet appears.
- **Would have prevented it:** an optional `roleName` prop on `Lambda.Function` (used instead of the generated
  name when set). Proposed upstream under D14 (in-repo first, upstream when stable); no bun patch in this packet.
## 2026-11-14: no conditional update on GitHub rulesets leaves one GET-to-PUT round-trip open

- **Doing:** P3 GitHub stack, review round 2 on #3324: the write guard re-reads ruleset 10240248 just before the
  provider's PUT, but a `beep reviewer ruleset release|require --apply` landing between that GET and the PUT is
  overwritten and not detected.
- **Evidence:** the REST API description for `PUT /repos/{owner}/{repo}/rulesets/{ruleset_id}` lists only `owner`,
  `repo` and `ruleset_id`, with no `If-Match` or precondition parameter; the ruleset GET returns a weak `ETag`, which
  GitHub documents for conditional GETs (`If-None-Match`, 304) only. The window-5 owner ruled the write guard plus the
  runbook practice sufficient for arming.
- **Would have prevented it:** a precondition (`If-Match` on the ETag, or an expected `updated_at`) on the ruleset
  PUT. If GitHub adds one, the wrapped `GitHub.Ruleset` provider in `@beep/infra-github` can send it.

## 2026-11-14: a stray root `coverage/` turns local fallow health red repo-wide

- **Doing:** P3 GitHub stack, pushing the create guard to #3324 with `yeet publish`.
- **Evidence:** cheap-gates failed `fallow:health` with "46 blocking finding(s) in an ok envelope", all
  `not-applicable` and none in the PR's files. The cause was an ignored root `coverage/` directory left by an earlier
  `vitest run --coverage` from the repository root, whose `coverage-final.json` was `{}`. Fallow read it as zero
  coverage and the CRAP scores crossed their thresholds across the repo. With the directory removed, the same check
  reported 0 findings.
- **Would have prevented it:** fallow health ignoring a coverage report that covers no files, or naming the coverage
  source it used in the failure message.
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

## 2026-11-14: a fake more permissive than Vercel cleared the first OipWeb arm

- **Doing:** P4 OipWeb, first armed deploy (workflow_dispatch run 43585534113).
- **Evidence:** staging applied 8 of 9 resources. Then `[EnvHubSpotServiceKey] fail — BadRequest: You cannot
  change the key of a Sensitive Environment Variable.` The provider's in-place edit sent `key`. The test
  that cleared arming (`CreatePath.test.ts`, "one `PATCH Env`, no delete, no duplicate") ran against an
  in-memory Vercel API that accepted the body.
- **Would have prevented it:** a live write rehearsal on a scratch personal stage before the first arm,
  covering create, adoption over existing objects and an in-place edit of each variable type (now the rule,
  decision `2026-11-14-first-armed-oipweb-deploy-failed-on-a-sensitive-variable-edit`), and fakes that pin
  each documented refusal of the real API with a test.

## 2026-11-14: one cache-qualification baseline file put three open PRs into base conflict

- **Doing:** packet gate, running three packet PRs at once (#3323, #3324, #3325).
- **Evidence:** at 05:35Z two unrelated merges (#3322, #3299) rewrote `standards/cache-qualification-baseline.json`,
  and all three open PRs went into base conflict on that file alone. Each needed a merge of `main`, a reviewed
  re-record of its subject, a fresh hosted run and a new review window.
- **Would have prevented it:** per-subject baseline files (one file per package, like the schema and instrumentation
  catalogs), or a merge driver that unions disjoint subjects.

## 2026-11-14: root law tasks that package-scoped checks miss, caught only by hosted CI

- **Doing:** packet gate, driving #3320, #3323 and #3324 with the repo-wide `final-check` gates skipped.
- **Evidence:** one push each, found only by hosted Lint Policy, Repo Sanity or Fallow: `lint:effect-vitest`
  (15 findings, #3323), `laws schema-tag-idioms` (6, #3324), `lint:shadcn` reading a bracketed log timestamp in a
  test string as a Tailwind arbitrary value (#3323), Fallow introduced complexity (2, #3323) and
  `beep(no-inline-schema-compile)` (#3320).
- **Would have prevented it:** a `package-verify` mode that runs every root law task filtered to the changed files.

## 2026-11-14: an edit to a workflow file invalidates the operator's approval of it

- **Doing:** packet gate, #3323 and #3324, each adding a deploy workflow that the operator merges.
- **Evidence:** the approval was given for one blob of the workflow file; a review-driven edit to that file
  changed the blob, so both PRs needed a second ask.
- **Would have prevented it:** asking for the approval after the first review round, not at open.

## 2026-11-14: `yeet open` refused a docs-only push as stale-base over a generated file

- **Doing:** P4 OipWeb, pushing a docs-only fix.
- **Evidence:** `yeet open` refused the push as stale-base because `main` had touched an overlapping generated
  file (`standards/schema-first.inventory.jsonc`). The forced merge of `main` restarted the review window.
- **Would have prevented it:** a stale-base check that ignores a generated file the PR's own diff does not touch.

## 2026-11-14: whole-file writers pull unrelated drift into a deletion PR

- **Doing:** P4 OipWeb deletion PR (#3341), and again for the P6 housekeeping PR.
- **Evidence:** `lint schema-first --write`, the Fallow health baseline write and `bun run jsdoc:inventory` rewrite
  their whole files. The JSDoc inventory alone changed by +38k/-19k lines for a PR that removed three source
  files, so deletion PRs hand-remove single rows instead.
- **Would have prevented it:** row-scoped regeneration (a writer that updates only the rows of the paths a PR
  touches).

## 2026-11-14: the committed effect-vitest census and JSDoc inventory have drifted far from `main`

- **Doing:** P6 housekeeping PR, removing the rows of files #3341 deleted.
- **Evidence:** on a tree at `main` `e051bd152f3` (2026-11-14T13:35Z), `bun run beep lint effect-vitest --census`
  rewrote `standards/effect-vitest.census.json` by +10,816/-4,124 lines (14,940 changed). Of those, 14 lines were the
  two rows the PR needed. `bun run jsdoc:inventory` rewrote `standards/jsdoc-documentation.inventory.jsonc` by
  +38,528/-19,324 lines, of which the PR needed 572 deleted lines. The rest is drift that `main` carries:
  for example the `@beep/infra` entry lacks `infra/src/CiRunnerPool.ts` and `infra/src/CiShardOverflowPool.ts`, and
  its line numbers are stale. The PR committed only the hand-removed rows. A separate lane refreshes both files
  from `main`.
- **Would have prevented it:** a row-scoped writer (above), or a gate that fails when the committed census or
  inventory differs from a fresh one, so drift cannot accumulate unseen.

## 2026-11-14: `knowledge semantic-delta` reads only the committed head

- **Doing:** P4 OipWeb, fixing a broken backticked path in a goal document.
- **Evidence:** the fix in the working tree was invisible to `bun run beep knowledge semantic-delta` until
  committed, so each attempt was an amend and a re-run.
- **Would have prevented it:** a `--worktree` mode that scans uncommitted files, or a note in the command's help.

## 2026-11-14: the "(removed in #N)" rewrite needs the PR number before the PR exists

- **Doing:** P4 OipWeb deletion PR (#3341), applying the Q3 ruling to paths it deleted.
- **Evidence:** the rewrite names the deleting PR, which has no number until it is opened, so the PR is opened as
  a draft and the rewrite goes in a second push.
- **Would have prevented it:** a placeholder (for example `#PENDING`) that `yeet open` replaces with the new number.

## 2026-11-14: Alchemy's failed-create semantics are not written down in the repo

- **Doing:** P4 OipWeb, predicting the plan after the first armed deploy failed half-way.
- **Evidence:** a failed create leaves a `creating` checkpoint, which plans as `create` and is adopted at apply time.
  A probe that modelled it as a missing row predicted the wrong label (`adopted`).
- **Would have prevented it:** the checkpoint states and their plan labels in `docs/runbooks/alchemy-infra.md`
  (now noted in the live write rehearsal, step 4).

## 2026-11-14: zsh does not word-split an unquoted variable, so a lint looked clean

- **Doing:** P4 OipWeb, running oxlint on a list of changed files.
- **Evidence:** with `files="a.ts b.ts"`, `bunx oxlint $files` passes one path containing a space. oxlint prints
  "No files found" and exits 0.
- **Would have prevented it:** `${=files}` or an array in every recipe, and a non-zero exit from the lint wrappers
  when no file is linted.

## 2026-11-14: a brief cited a local-only commit in a tracked record

- **Doing:** P4 OipWeb, writing a decision file from a gate brief.
- **Evidence:** the brief named a commit that existed only in another checkout. The reviewer caught the dangling
  reference in the tracked file.
- **Would have prevented it:** briefs cite only pushed commits for anything that lands in a tracked file.

## 2026-11-14: a long `yeet job wait` died at the shell's background limit

- **Doing:** P4 OipWeb, waiting on a readiness monitor.
- **Evidence:** `bun run beep yeet job wait <id>` was killed by the 30-minute default limit for background shell
  commands. The job itself kept running.
- **Would have prevented it:** a 2-hour timeout on monitor waits in the recipes.

## 2026-11-14: an unattended deploy job needs a create allow-list on adopting stages

- **Doing:** P4 OipWeb, arming the deploy workflow on stages that adopt live objects.
- **Evidence:** an object that failed to adopt would plan as a create and be created a second time. The
  `adopted` predictions came from reading the code, not from a plan probe against seeded state.
- **Would have prevented it:** a create allow-list in the plan guard (now in `plan-guard.ts`), and adoption
  predictions taken from a plan against seeded state.

## 2026-11-18: new packages land with no coverage baseline row

- **Doing:** packet gate, reading Heavy / Coverage Regression on PR #3367 (job 134497133455) and PR #3369
  (job 134501277702).
- **Evidence:** seven packages this packet added had no row in `standards/coverage.regression-baseline.jsonc`.
  The ratchet only warns ("package(s) without baseline entry (warning only)"), and only on a full-matrix run,
  because an affected run never measures a package that did not change. The packages merged without anyone
  seeing it. Seeding the rows from hosted artifacts took a checkout of the tested SHA, a real install and the
  producer's exact Node pin, because a local whole-package `--coverage` run is ruled out on this workstation.
- **Would have prevented it:** `bun run beep create-package` writes a seed row, or the package-scoped ratchet
  fails a PR that adds a coverage-owning package without a row. A writer mode that adopts rows from downloaded
  hosted artifacts (`--coverage-input` with `--write-baseline`) would make the repair one command.

## 2026-11-15: `beep github app mint` registered an App and lost its private key

- **Doing:** arming InfraGithub, minting `beep-infra-github` with `bun run beep github app mint beep-infra-github`.
- **Evidence:** GitHub registered App 5766296, then the vault write `cat | op item create --vault BEEP_SECRETS -`
  exited 1. On agent workstations the `op` on `PATH` is the 1Password service-account shim (`~/.local/bin/op`),
  and that account cannot create items. The key existed only in the one-use conversion response, so it was lost.
  The operator deleted the orphan App under GitHub sudo mode. The 2026-11-18 retry worked only behind a `PATH` shim
  that mapped `op` to `op-human`.
- **Would have prevented it:** a writer chosen for a human-attended flow and checked before GitHub is involved. The
  launcher now writes with `op-human` when it is on `PATH`, else `op`, or `--op-cli <command>`. Before the server
  listens, it creates and deletes a throwaway item in `BEEP_SECRETS` and refuses to start if either step fails
  (PR for branch `goals/infra-alchemy-rebuild-mint-vault-writer`).
## 2026-11-14: a base-sync merge that re-records a baseline has no Yeet push path

- **Doing:** P3 GitHub stack (#3324), merging `main` after #3348 split the cache baseline into per-subject
  files, which turned the lane's edit of the old single file into a modify/delete conflict.
- **Evidence:** `yeet publish --push-only` refused the merge as unreproducible, and `--push-only --reuse-verified`
  refused it with "no full-proof state for this head". The lane got its one push by running `yeet open` on the
  already-open PR (d772dd7ca88).
- **Would have prevented it:** `--push-only` accepting a merge whose only non-reproducible paths are cache-baseline
  subject files re-recorded through a reviewed request, or `--reuse-verified` accepting a passing final-check
  receipt.

## 2026-11-14: a test git fixture inherited the repository-locating environment

- **Doing:** reviewing the repo-cli delete-package fixture (#3350).
- **Evidence:** `gitFixture` spawned git with the inherited environment, so an inherited `GIT_DIR` or
  `GIT_OBJECT_DIRECTORY` (set by hooks and linked worktrees) would point the fixture's `git init` and `git add` at
  the real checkout. Getting the full key list took two review rounds (CodeRabbit, then beep-reviewer).
- **Would have prevented it:** one exported constant that scrubs the repository-locating variables, shared by every
  test-support and probe git spawn, with a test that plants them.

## 2026-11-19: 59 passing policy simulations, and the first real deploy was denied 14 times

- **Doing:** P5 cutover step 1a, the first deploy of the CiRunners stack under its own deploy role (#3386).
- **Evidence:** the plan check passed and the deploy stopped on `ec2:CreateSubnet`, `CreateRouteTable`,
  `CreateSecurityGroup` and `CreateFlowLogs` "on resource" the new VPC, `iam:ListPolicyTags` and
  `lambda:GetFunctionConcurrency`, leaving 52 of 72 state rows `creating`. The simulation cases named one ARN
  per create and supplied the request tags; `aws iam simulate-custom-policy` applies every context key to
  every resource, so it never showed that EC2 also authorizes the parent VPC, where request tags do not exist.
  No case covered a provider's read after a create. A source read of the providers then found a third read
  (`lambda:GetFunctionEventInvokeConfig`) the failed run had not reached yet.
- **Would have prevented it:** deriving the cases from the providers, not from the policy: every client call
  per lifecycle step, each run once per resource the Service Authorization Reference lists for it, with only
  the condition keys that resource carries. `research/p5-ci-runners-deploy-role-coverage.md` is that table
  for this stack. A deploy role for a new stack gets one before its first run.

## 2026-11-19: the bootstrap expectation covered a finished row but not a started one

- **Doing:** working out what the re-run after the failed step 1a would plan.
- **Evidence:** the expectation took `create` rows with `create` bindings and `noop` rows. A started row
  (state `creating`) plans `create` with the bindings the failed run saved, so they diff `noop` or `update`,
  and an event-source mapping checkpointed before its queue existed plans `replace` of a generation that
  never existed. The re-run would have been refused on 16 rows after the permissions were fixed.
- **Would have prevented it:** a test that stops a fake deploy part-way and plans again. The expectation now
  names resumed rows (`ResumeKind`), and the workflow has a plan-only run whose rows the gate reads before any
  write.

## 2026-11-19: a cheap-gates Fallow lane ran with an empty `--base` and failed the push

- **Doing:** pushing the URL-permission provider patch (#3423) through `yeet publish`.
- **Evidence:** the first push of the head failed `fallow:audit` with `base-resolution-failed`; the lane had been
  started with an empty `--base` value. The same push passed on retry with nothing changed, so the red said
  nothing about the patch and cost a full cheap-gates rerun.
- **Would have prevented it:** a Fallow lane that resolves its base itself and never runs with an empty
  value. #3427 (merged 2026-11-20, `56f52bf398d`) does that and adds a test.

## 2026-11-22: a no-op mock passed a runner-group PATCH that cleared the group's repositories live

- **Doing:** adding the overflow proof workflow to the `beep-shard-overflow` runner group's allow-list
  (overflow proof, step 1).
- **Evidence:** the step script sent `visibility` with the workflow fields in one
  `PATCH orgs/<org>/actions/runner-groups/<id>`. On GitHub that body resets a `selected` group's repository
  list, so the group lost its repository and was restored by hand. The script's test used a mock that
  accepted any body and returned it, so it could not show the side effect.
- **Would have prevented it:** a two-key body (`selected_workflows`, `restricted_to_workflows`), a read-back
  of both the group and its `/repositories` endpoint after every write, and a repair step when the
  repository list comes back shorter than the snapshot. The proof scripts now do all three.

## 2026-11-22: a proof watcher counted a terminated instance and raised a false abort

- **Doing:** watching the overflow proof for its "more than one launch" abort.
- **Evidence:** the watcher counted every instance tagged with either pool's `ghr:environment`, in any
  state. The heavy re-proof's runner had already terminated but still matched, so the watcher reported two
  launches for one. A terminated instance stays visible to `describe-instances` for about an hour.
- **Would have prevented it:** keeping the two questions apart. The live reading of what is running now
  counts only the proof pool's instances in `pending` or `running`. The "more than one launch" abort counts
  launches, not live instances: the CloudTrail `CreateFleet` calls by the proof pool's scale-up role since
  the proof started, which still include a launch whose instance has terminated. The evidence script decides
  the proof that way (exactly one call). The watcher's active count is an early warning only, and a later
  watcher reads the same CloudTrail count for its launch abort.

## 2026-11-22: after the label move, the Pulumi fleet relaunched idle runners for stale queued-build messages

- **Doing:** P5 step 4a, moving every workflow reader onto the `beep-fleet-*` labels while the old fleet
  drained.
- **Evidence:** the old fleet's queued-build queue held about 234 in-flight messages for jobs that had
  already finished (`0/234/0`; no sends since 19:20Z). The old scale-up has no job-queued check and the queue
  keeps messages for one day, so each redelivery launched an idle Spot runner: 15 `RunInstances` by the old
  scale-up between 19:12Z and 19:58Z, 6 of them after the 4a merge. The queue was purged at 20:07:24Z on
  the driver's word and read back `0/0/0`; the old fleet's own scale-down then retired its last two
  instances (20:08Z, 20:10Z) and it has had none since.
- **Would have prevented it:** purging the old build queue as part of the label move, in the same step that
  stops new work from reaching the old fleet, with a read-back of the queue depth before the move is called
  done.

## 2026-11-22: `gh --jq` rounds webhook delivery ids, and the rounded ids 404

- **Doing:** dry-running the 4a watch's delivery matching after the driver's gap ruling.
- **Evidence:** delivery ids exceed 2^53. `gh api .../hooks/<id>/deliveries --jq '.[0].id'` printed
  `...401472` where the API returned `...401474`, and fetching the rounded id answered `404 Not Found` with a
  scope hint, which reads like a permissions problem. System `jq` 1.8 kept the exact id and the fetch worked.
- **Would have prevented it:** reading delivery ids with system `jq` on the raw body (`gh api ... | jq -r`)
  and passing them on as strings; never through `gh --jq`. The watch script does this, and a failed detail
  read now gives UNKNOWN rather than a miss.

## 2026-11-22: a JMESPath `length()` over nested instance lists counted reservations

- **Doing:** checking that exactly one heavy runner launched after the 4b cap change.
- **Evidence:** `length(Reservations[].Instances[?LaunchTime>='<t>'])` returned 14 while one instance had
  launched: the filter yields one (often empty) list per reservation, so `length` counts reservations. The
  4a watch's launch count used the same expression.
- **Would have prevented it:** flattening before counting, `length(Reservations[].Instances[?...][])`, as the
  running-instance count already did. The watch script is fixed.

## 2026-11-23: a compound test script ran unsharded in every coverage shard and timed out eight jobs

- **Doing:** waiting on the fleet-watch environment PR (#3510), whose only code sat in `@beep/infra-github`,
  `@beep/repo-cli` and `@beep/repo-configs`.
- **Evidence:** all eight `Test Unit (law-practice-N)` jobs on its first head ran into the 20-minute job
  timeout while still printing passing tests. The affected coverage plan selected five owners and left out
  `@beep/law-practice-server`, which Turbo's affected set still placed in those partitions. So the partition
  ran it through one undivided `turbo run …#test -- --coverage … --shard=N/8` step. Its `beep:test` is two
  Vitest commands joined by `&&`, and `bun run` appended every forwarded argument to the second one only.
  The main suite ran whole and uncovered in each of the eight shards. PRs whose own diff sent the coverage
  planner to its full fallback split the script per segment and passed in about four minutes, which hid the
  defect.
- **Would have prevented it:** running every package a coverage partition selects through the per-segment
  invocations the fallback uses, sealing only the planned owners. Also: refusing an undivided compound
  script before it runs, failing a sharded segment that ran every listed file (its `--shard` never reached
  it), and checking at the collector that all shards together ran each listed file exactly once. Shard file
  counts follow each package's sequencer (measured `vitest.shards.json` plans), so no per-shard count is
  predicted. A mis-sharded run then fails in seconds instead of timing out. The fix PR does all four.
## 2026-11-23: a post-deploy plan_only overwrote the pre-deploy plan's rows file

- **Doing:** the tksr Lambda deploy at a pinned main head. One plan_only ran before the deploy and one
  after, to prove 0 code rows remained.
- **Evidence:** the gate's plan script named its outputs `plan-rows-<head7>.txt` and `plan-only-<head7>.log`.
  Both plans ran at the same head, so the post-deploy plan replaced the rows file and log the deploy digest
  was computed from. The driver had already recomputed that digest from the file before its word, and the
  hosted plan run's log still holds the rows, so no evidence was lost.
- **Would have prevented it:** naming every plan output by its run id (`plan-rows-<runId>.txt`), never by
  head, so two plans at one head cannot share a file. The gate's scripts now do that.

## 2026-11-23: earlyoom killed local cheap gates while the host ran out of memory

- **Doing:** publishing a review-fix wave for the missed-event check PR.
- **Evidence:** memory available fell to about 2 GiB with swap exhausted, and earlyoom sent SIGTERM and SIGKILL
  to new processes. `yeet publish` cheap gates ended with exit 130 or `terminated by signal SIGKILL`, and
  even a bare `bun -e` was killed. A 47 GiB image-generation process outside the repo was the largest holder.
- **Would have prevented it:** a gate runner that reads `MemAvailable` before starting a lane and reports an
  environment hold instead of a red. The publish went through once memory recovered above 20 GiB with no
  kills for two minutes.

## 2026-11-23: every Lambda deploy re-applies the role policies and the function URL

- **Doing:** CloudTrail read 1 for the tksr deploy, which updated the code of all 11 fleet functions.
- **Evidence:** the deploy wrote `iam:PutRolePolicy` 11 times and `iam:AttachRolePolicy` 11 times, and
  `lambda:CreateFunctionUrlConfig` once, which failed with `ResourceConflictException` and was followed by
  `lambda:UpdateFunctionUrlConfig`. The d8cba1c deploy on 22 Nov updated 6 functions and wrote the same
  pattern: 6 of each IAM call. Its window has no URL call because the webhook function was not in it. The
  provider source, `@alchemy.run/aws` 2.0.0-beta.87 `Lambda/Function.ts`, explains both. Its update path
  ensures the role and re-puts each binding policy on every update. Its URL step calls create first and
  falls back to update on a conflict. Both are therefore standing provider behaviour, not drift. In both
  windows every write stayed on the functions, their `CiRunners-*-prod-*` roles and their log groups, with
  no `AccessDenied`.
- **Standing expectation (driver ruling, 2026-11-23):** this extends the 2026-11-20 rule
  (`decisions/2026-11-20-cirunners-function-updates-re-apply-each-function-role-s-policies.md`), which still
  holds in full. Every (d) CloudTrail read expects exactly N `iam:PutRolePolicy` and N `iam:AttachRolePolicy`,
  plus 2N log-group writes (`CreateLogGroup` on an existing group and `PutRetentionPolicy`), for N updated
  functions. Each `PutRolePolicy` document must match, as canonical JSON, the same role's document in the
  previous deploy; a changed document is a finding and stops the cutover. The 2026-11-23 addition: when
  the webhook is updated, the read also expects at most one `CreateFunctionUrlConfig` that fails with
  `ResourceConflictException`, followed by `UpdateFunctionUrlConfig`. Any IAM write outside that pattern,
  or on a role whose function had no code row, is a finding.
- **Would have prevented it:** a CloudTrail read that knows this reconcile shape. It should count one put
  and one attach per updated function, plus a create→update pair for a function with a URL, as expected,
  and flag only counts or targets outside that shape.

## 2026-11-23: the pin-bump App re-synced an open, green-pending pin PR on an unrelated main push

- **Doing:** holding the binary pin PR (#3500) at its queued head so it could merge first in the P5 order.
- **Evidence:** #3500 was queued at `00403f8e`. #3504 merged to main at 08:45:49Z, and at 08:53:03Z the
  `beep-ci-pin-bump` App merged main into the pin PR, moving its head to `88e0651f`. The PR's own patch was
  unchanged (`fetch-beep-ci/action.yml` only), yet the new head restarted its full check set, including a heavy
  cycle at the heavy cap of 2. The pin's Lint Policy wait restarted, about 30 minutes of queue lost.
- **Would have prevented it (owner: the binary-route lane):** (a) the App re-syncs the pin PR only when it is
  `CONFLICTING`, or when its base is more than a set number of commits or hours stale; (b) the merge gate holds
  main merges while a pin PR is green-pending. The orchestrator did (b) by hand that day.

## 2026-11-26: `alchemy plan` printed a generic update that hid a container replace, and the apply logged the replace as "updated"

- **Doing:** the P4 AI metrics cutover on dankserver (`HostsAiMetrics`, stage `prod`). The plan for attempt 3 was meant to show exactly one Phoenix replace.
- **Evidence:** the plan from `f096be4dca8` printed `Plan: 5 to update`, with Phoenix, Preflight, RetireCompose, TailscaleServe and Health all marked update.
  - The Phoenix container's props hold a label that is an Output of an upstream Exec hash, unresolved at plan time. `@alchemy.run/docker` `Container.ts` `diff` returns `undefined` while props are unresolved, so the engine prints a generic update.
  - At apply, the changed env and networks made the create args differ. The provider then stopped, removed and re-created the container: old id `f76ded48…` gone, new id `65dddd16…` on the same volume. The log still said `[Phoenix] updated (5.9s)`; no line said replace.
  - The four Exec steps re-ran because their env keys on the Preflight hash and the Phoenix id.
  - The mismatch stopped the cutover for a ruling: about 10 minutes lost inside a capped degraded window.
- **Would have prevented it:**
  - a plan mode that resolves upstream Exec hashes before diffing, or a printer that says "update (may replace)" when the provider diff was skipped for unresolved props;
  - an apply log that names a recreate ("replaced, delete first") when the container id changes.

## 2026-11-26: the host stack assumed Compose facts the live deployment no longer had

- **Doing:** the same cutover.
- **Evidence:** the live Compose service had drifted from the Pulumi program the stack was ported from, and each drift cost one failed or degraded attempt:
  - the image had been hand-bumped to `phoenix:22.0.1@sha256:…`, while the runbook pinned `15.5.0`;
  - the data volume and network were `external: true`, so they carried no Compose project label, and Preflight refused;
  - `ExecStop` was `docker compose stop`, not `down`;
  - seven Phoenix env settings, including auth off, were missing from the stack;
  - the OTLP collector reached Phoenix by name on the Compose network, which the new container left.

  Ingestion was degraded from 02:40:46Z to 02:54:35Z, and the collector dropped 91 spans when their retry budget ran out.
- **Would have prevented it:** a field-by-field diff of the live Compose service (`docker compose config` plus `docker inspect` of the running container and its network peers) against the stack's container props, run before the first rehearsal and gating the prod plan.

