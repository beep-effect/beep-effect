# Alchemy docs catalog for infra-alchemy-rebuild

P0 research report. Catalogues the Alchemy documentation pages named in `SOURCES.md` and turns
each into concrete rules for the beep-effect stacks (`@beep/infra-*`, `@beep/alchemy-*`, the three
`alchemy.run.ts` app stacks).

- Primary source: `~/YeeBois/references/effect/alchemy/website/src/content/docs/` at
  `v2.0.0-beta.85-48-g17fb76f4f` (48 commits past the `v2.0.0-beta.85` tag). Citations use the form
  `website/src/content/docs/<page>.mdx:<line>`, shortened to `<page>.mdx:<line>` below.
- Cross-check: live site `https://alchemy.run` fetched 2026-11-06 (`/llms.txt`, `/state-store/`,
  `/cli/state/`, `/environments/stages/`, `/infrastructure-as-code/stack/`,
  `/providers/github/ruleset`, `/providers/github/label`). Drift between the two is recorded in
  [Live vs checkout drift](#live-vs-checkout-drift).
- Where the narrative docs say nothing (Docker `context` on Container/Volume, the S3 store lease,
  telemetry opt-out), a source file is cited instead, under `~/YeeBois/references/effect/alchemy/packages/`.
- Read-only: no alchemy, pulumi or cloud command was run for this report.

## Headline findings

1. **`AWS.state()` defaults to DynamoDB, not S3, as of beta.85.** The default is one on-demand
   DynamoDB table per account and region, `alchemy-state`, with an S3 overflow bucket
   (`state-store/index.mdx:178`, `:193`). The S3 store survives only behind `AWS.state({ backend: "s3" })`
   or `bucketName`/`prefix`/`encryption` (`state-store/index.mdx:227`), as a migration path
   (`alchemy state migrate`, `:205-223`). D6 ("AWS S3 BucketState, new bucket name") picks
   the legacy backend. Both backends hold a per `(stack, stage)` lease (DynamoDB:
   `packages/aws/src/StateStore/Store.ts` doc comment "Concurrent deploys of a stage fail fast on its
   lease"; S3: `packages/alchemy/src/State/BucketState.ts:100-107` `__lease__.json`). Decide D6 again in a
   decision file before P1.
2. **CI never bootstraps a store.** With `CI=true`, a missing store fails the run, so it has to be
   provisioned ahead with `alchemy state bootstrap` (`state-store/index.mdx:103-114`, `:195-199`). The S3 variant uses
   `--backend aws-s3` (`state-store/index.mdx:227`). `cli/state.mdx:132-134` still says `aws` creates a bucket, which is stale.
3. **Profiles are avoidable by design.** A provider whose full credential contract is in the
   environment ignores the profile, even outside CI (`environments/profiles.mdx:145-160`). With
   `CI=true` nothing is read from or written to `~/.alchemy` (`:164-166`). `op run` env injection is
   therefore a first-class path. The docs still steer users to `alchemy profile` in many places (see
   [Contradictions with our constraints](#contradictions-with-our-constraints)).
4. **`alchemy plan` has no "changes present" exit code.** Exit `0` means the command completed
   (`cli/index.mdx:109-115`). Only `alchemy drift` exits `2` when it finds drift (`cli/drift.mdx:24-32`). The SPEC's
   "plan is a no-op" check needs a parser, for example over `--log-format json` (`cli/index.mdx:76`), or
   drift as the gate.
5. **`Docker.Service` needs a swarm manager behind its context** (`docker/swarm.mdx:56-60`). AI metrics on
   dankserver therefore needs one of: `Docker.Container` with `context` (supported in source,
   `packages/docker/src/Container.ts:25-26`, but missing from the narrative docs), a `Docker.Swarm` on the
   context, or an existing swarm referenced by context.

---

## project-structure/monorepo

URL: https://alchemy.run/project-structure/monorepo

**Prescribes.** Two options. A single Stack at the workspace root deploys everything in one plan
(`monorepo.mdx:10-22`). Multiple Stacks, one per package, wire together with typed cross-stack
references (`:26-40`). Choose multiple Stacks when "packages deploy on different cadences (different
teams, different CI)" or when one package must be destroyed without touching the others (`:46-52`).

**APIs.** `alchemy.run.ts` per package. Typed handle at `src/Stack.ts`.

**Rule for our stacks.** Use Option B, multiple Stacks. Every `@beep/infra-*` package and each app
owns its own Stack. The SPEC's per-stack cutover order and per-stack CI concurrency group both
require independent deploy and destroy (D12), which only Option B gives.

## project-structure/monorepo-multi-stack

URL: https://alchemy.run/project-structure/monorepo-multi-stack

**Prescribes.** Each package has `alchemy.run.ts` plus `src/Stack.ts`, a typed handle that both
sides import (`monorepo-multi-stack.mdx:9-23`, `:35-50`). There is no shared plan. The upstream persists
its outputs, and the consumer reads them at plan time. The cost is a deploy order (`:25-29`).

```typescript
export class Backend extends Alchemy.Stack<
  Backend,
  {
    url: string;
  }
>()("Backend") {}
```
(`monorepo-multi-stack.mdx:39-44`)

- The producer uses `Backend.make({ providers, state }, effect)`, and a mismatched return type fails to
  typecheck (`:61-78`).
- The consumer does `yield* Backend` and resolves the **same stage** (`:111-115`). `Backend.stage.prod`
  or `Backend.stage["pr-42"]` pins a stage (`:139-152`).
- The handle travels as a `workspace:*` dependency (`:117-119`).
- A missing upstream stage fails with `InvalidReferenceError` (`:128-130`). Destroy in reverse order.
- Each `alchemy.run.ts` runs from its own package directory, so relative paths resolve against the
  package (`:132-135`).

**APIs.** `Alchemy.Stack<Self, Outputs>()(name)`, `.make`, `yield* Handle`, `Handle.stage.<name>`,
`InvalidReferenceError`.

**Rule for our stacks.** Every infra package exports its Stack handle from a dedicated
`src/Stack.ts`, on the public barrel, with an output shape. For example, `CiRunners` exports
`{ fleetRoleArn, webhookUrl, ... }`, and `@beep/infra-github` imports it as `workspace:^` and yields
`CiRunners.stage.prod`. Consumers pin `prod` explicitly, because our stacks have no symmetric
per-developer stages. Destroy order is the reverse of the SPEC cutover order. A missing upstream fails the plan
instead of deploying partially.

## project-structure/file-layout (and monorepo-single-stack)

URLs: https://alchemy.run/project-structure/file-layout ,
https://alchemy.run/project-structure/monorepo-single-stack

**Prescribes.** Three rules: one file per Resource or Layer, Resources that share a lifecycle grouped
in one file, and `alchemy.run.ts` as the composition root (`file-layout.mdx:19-22`, `:102-133`).

- A declaration is inert until a Stack yields it (`:71-72`).
- Units are exported `Effect.gen` values, memoized by logical ID (`:135-152`).
- Stage-conditional props sit next to the resource they change, through `yield* Alchemy.Stack` (`:154-170`).
- The root has four jobs: name the Stack, merge Providers, pick a State Store, wire outputs (`:212-218`).
- `.alchemy/` is gitignored (`:225`).
- Tests mirror `src/` under `test/` (`:234`).
- `--config` overrides discovery (`:214-215`).

The single-stack page warns that **relative paths resolve from where `alchemy` runs**
(`monorepo-single-stack.mdx:64-69`). Anchor them with `import.meta.url` / `import.meta.dirname`
(`:71-82`). `rootDir` defaults to `process.cwd()` (`:121-124`).

**Rule for our stacks.**

- Package layout: `alchemy.run.ts` at the package root (composition only), with resources in
  `src/<Concern>.ts`. Examples:
  - `src/Vpc.ts`
  - `src/Reaper.ts` (Lambda declaration and runtime in one file)
  - `src/FleetController.ts` (SSM + IAM + KMS share a lifecycle)
  - `src/Stack.ts` (handle)

  Tests go in `test/`.
- Anchor every path with `import.meta`. Agents and CI run from the repo root as well as the package
  dir; `apps/beep-effect-web/alchemy.run.ts` already does this (`rootDir: import.meta.dirname`).
- Add `.alchemy/` to the root `.gitignore` if it is not already there. It holds local logs even when
  state is remote (`cli/index.mdx:103`, `testing/test-harness.mdx:327-329`).

## testing/index

URL: https://alchemy.run/testing

**Prescribes.** Tests run against real clouds by default: deploy once per suite, assert, destroy
(`testing/index.mdx:7-30`). `Test.make` ships in `@alchemy.run/test` with three adapters:
`@alchemy.run/test/Alchemy`, `/Bun`, `/Vitest` (`:44-48`). Tests default to stage `test_$USER`
(`:54-59`). `ALCHEMY_TEST_STAGE` or `--stage` overrides it (`:61-68`). `dev: true` or `ALCHEMY_DEV=1` runs the suite
against local emulators (workerd, Docker AWS emulator) (`:74-83`).

**Rule for our stacks.** Use `@alchemy.run/test/Vitest` with `expect` from `@effect/vitest`. That
matches the repo's `@effect/vitest` standard, and repo-cli tests must run on Node and Bun, so the
alchemy-test runner is out. Stack tests that touch AWS cost money, so gate live deploys (see
testing-a-stack). Use `dev: true` where the AWS emulator covers the resource, for example SQS,
Lambda and S3 for the runner composite.

## testing/observability

URL: https://alchemy.run/testing/observability

**Prescribes.** The exporter is a Layer, and the receiving end (datasets, tokens, monitors,
notifiers, alarms) is provisioned in the same Stack as the code that emits (`observability.mdx:6-12`).

- `Alchemy.Telemetry.layerOtlp({ url, headers })` provided on the Function/Worker (`:22-34`).
- Axiom resources: `Dataset`, `ApiToken`, `Telemetry`, `Notifier`, `Monitor` (`:50-150`).
- Cloudflare platform push: `Cloudflare.Workers.ObservabilityDestination` (`:108-121`).
- AWS:
  - `AWS.SNS.Topic`
  - `AWS.CloudWatch.Alarm` (props in AWS casing: `MetricName`, `Namespace`, `Threshold`,
    `ComparisonOperator`, `AlarmActions`)
  - `AWS.CloudWatch.Dashboard`
  - `AWS.CloudWatch.CompositeAlarm` (`:163-208`)
- Stacks are per-stage, so each stage gets its own alarms (`:207-208`).

**Rule for our stacks.**

- The cost-controls and ci-runners stacks declare their CloudWatch alarms and SNS topics in code,
  next to the resources they watch: reaper Lambda errors, SQS age, ASG health.
- The D7 turbo-cache "throttle or error-rate alarm equivalent" is either a
  `Cloudflare.Workers.ObservabilityDestination` to our OTLP collector plus an alert there, or a
  `layerOtlp` on the Worker. Pick one in the P0 matrix.
- Webhook URLs used by notifiers come from `Config.Redacted`, never `process.env.X!`. The docs use
  `process.env.SLACK_WEBHOOK_URL!` (`:132`), which breaks repo law.

## testing/test-harness

URL: https://alchemy.run/testing/test-harness

**Prescribes.**

- `Test.make({ providers, state?, profile?, stage?, dev?, adopt?, sidecar? })` returns `test`,
  `beforeAll`, `beforeEach`, `afterAll`, `afterEach`, `deploy`, `destroy` (`test-harness.mdx:17-55`).
- `state` defaults to `localState()`. `Cloudflare.state()` is shown as the shared-across-runners
  example (`:74-82`).
- `stage` defaults to `test_$USER`. `ALCHEMY_TEST_STAGE` replaces it, and an explicit `stage` in
  `Test.make` or `deploy` wins (`:106-120`, `:369-380`).
- `adopt` matches `--adopt` (`:164-167`).
- `beforeAll` timeout is 120 s by default, overridden with `{ timeout }` (`:202-206`).
- `afterAll.skipIf(pred)` (`:216-226`).
- `HttpClient` is in scope, backed by `effect/http/FetchHttpClient` (`:266-285`).
- Vitest runs each `test` as `it.live` (`:364-365`).
- `ALCHEMY_TEST_DEV=1` forces dev mode in both directions (`:153-155`).

**Rule for our stacks.**

- Never pass `profile`. Credentials come from `op run` env, the same as deploy.
- Pass an explicit `stage`: `test_<user>_<worktree>` locally, `ci-pr-<n>` in CI.
- For any test that deploys a whole stack, pass the stack's real state layer, the shared AWS store.
- Set `beforeAll(deploy(Stack), { timeout: 600_000 })` for the runner composite, because ASG and
  Lambda creation runs past 120 s.

## testing/testing-providers

URL: https://alchemy.run/testing/testing-providers

**Prescribes.** `test.provider(name, (stack) => effect)` gives each test a scratch stack with private
in-memory state. `stack.deploy(effect)` is called twice with the same logical ID for update, followed
by `stack.destroy()` (`testing-providers.mdx:12-39`). Assert against the real cloud out-of-band, since
the providers Layer is in scope (`:43-45`). Replacement is verified by `v2.id !== v1.id` after changing a
`stables`/replace field (`:49-53`). To seed, deploy twice (`:65-67`).

**Rule for our stacks.** Every repo-owned resource gets a `test.provider` suite covering create,
in-place update, replace (when `diff` returns replace), out-of-band read-back through the
`@distilled.cloud/*` client, and destroy. The resources are `Vercel.Project`/`EnvVar`/`Domain`,
`KmsGrant`, `CostAllocationTag`, the two enrollments, and the runner composite's custom pieces. This
is the D14 upstreamability bar. Resources that cost money or are account-singletons (the
enrollments) need `test.provider.skipIf(!liveGate)`.

## testing/testing-a-stack

URL: https://alchemy.run/testing/testing-a-stack

**Prescribes.**

- `beforeAll(deploy(Stack))` with a lazy accessor (`testing-a-stack.mdx:38-51`).
- `Test.getWhenReady` / `executeWhenReady` retry 404/5xx 20 times, exponential from 500 ms (`:114-130`).
- Bounded `Effect.retry` / `Effect.repeat` with `Schedule`, never a deadline loop (`:132-158`).
- Teardown: `afterAll.skipIf(!!process.env.NO_DESTROY)` and `afterAll.skipIf(!process.env.CI)` (`:162-167`).
- `SKIP_DEPLOY` reads an existing deployment (`:173-181`).
- Identical state + stage across files makes the second file's deploy a no-op (`:185-196`).
- One stage per PR, `pr-${process.env.PR_NUMBER}` (`:200-207`).
- Harness `deploy`/`destroy` never prompt (`:209`).

**Rule for our stacks.**

- Read env gates through `effect/Config`, not `process.env`; the docs' `process.env` reads break repo law.
- Gate on `CI` and a `BEEP_ALCHEMY_LIVE` flag, so stack tests in hosted CI run only on labelled lanes.
- In CI, destroy every `ci-pr-<n>` test stage in `afterAll`.
- Hit the turbo-cache Worker URL through `getWhenReady`.

## environments/ci

URL: https://alchemy.run/environments/ci

**Prescribes.**

- "Credentials as code": a `stacks/github.ts` mints CI credentials and writes them into the repo as
  `GitHub.Secret`/`GitHub.Variable` (`ci.mdx:167-171`, `:310-320`).
- `alchemy provider check-env` is a CI preflight: one line per provider, exit 1 on a missing
  variable, with `--provider` and `--env-file` options (`:175-187`).
- Workflow: `concurrency.group: deploy-${{ github.ref }}`, `cancel-in-progress: false` (`:93-96`).
- Stage expression (`:98-99`, `:283-293`):

```yaml
STAGE: ${{ github.event_name == 'pull_request' && format('pr-{0}', github.event.number) || (github.ref == 'refs/heads/main' && 'prod' || github.ref_name) }}
```

- Deploy: `bun alchemy deploy --stage ${{ env.STAGE }}` with `PULL_REQUEST`, `GITHUB_SHA`,
  `GITHUB_TOKEN` (`:118-126`).
- Cleanup job on PR close, with a prod "Safety Check" (`:129-160`).
- Preview comments: `GitHub.GitHubEnv` and `GitHub.Comment` with `Output.interpolate` (`:226-260`).
- An `admin` profile, deployed with `alchemy deploy --config stacks/github.ts --profile admin`
  (`:322-360`).
- AWS OIDC (recommended): `AWS.IAM.OpenIDConnectProvider` + `AWS.IAM.Role` with a `sub` condition,
  the role ARN written as a `GitHub.Variable`, `id-token: write`, and
  `aws-actions/configure-aws-credentials@v4` (`:602-737`).
- The example role uses `AdministratorAccess`, with a tip to tighten it (`:667-698`).
- The `Secrets Store Write` note explains Cloudflare state-store reads in CI (`:465-476`).

**Rule for our stacks.**

- One workflow job per stack. `concurrency.group: alchemy-<stack>-prod`, `cancel-in-progress: false`.
- `prod` only from `push` on `main`. Most infra stacks do not need the PR-preview stage.
- `--yes` always.
- First step: `bunx alchemy provider check-env --provider AWS` (or the relevant set).
- AWS credentials through OIDC (`AWS.IAM.OpenIDConnectProvider` + scoped `AWS.IAM.Role`, not
  `AdministratorAccess`), owned by `@beep/infra-github` or a bootstrap stack. Keep this inside the
  existing account and existing subscriptions.
- Local and bootstrap deploys of the github stack use `op run --env-file=<lane env> -- bunx alchemy deploy`.
  Never `--profile admin`.
- Keep the stack-side `CI` guard pattern from `apps/beep-effect-web/alchemy.run.ts`: `prod` yields
  `Config.Literal("true", "CI")`.

## environments/worktrees

URL: https://alchemy.run/environments/worktrees

**Prescribes.** Default stages are named after the user, so parallel worktrees collide
(`worktrees.mdx:14-23`). Derive the stage from `basename "$(git rev-parse --show-toplevel)"` (`:27-32`).
Stage names must match `[a-z0-9][-_a-z0-9]*` (`:34-35`). Use scripts for deploy, dev, dev:destroy and test:

```json
"deploy": "alchemy deploy --stage live_${USER}_$(basename \"$(git rev-parse --show-toplevel)\")",
```
(`worktrees.mdx:44`)

The test variants are `alchemy-test --stage test_${USER}_...` or `ALCHEMY_TEST_STAGE=...` (`:97-121`).
Spell the rule out in `AGENTS.md` (`:127-138`). Destroy stages before `git worktree remove`, which works
from any checkout with a shared remote store (`:140-161`).

**Rule for our stacks.**

- Worktree stages are `live_elpresidank_<lane>` and `test_elpresidank_<lane>`. Lane dir names under
  `beep-effect-worktrees/` already match the regex.
- Repo law bans shell scripts, and package `scripts` are generated
  (`bun run beep lint package-scripts --write`). Stage derivation therefore belongs in a `beep` CLI
  command, for example `beep infra deploy|plan|destroy <pkg>`. Coordinate with
  `goals/scripts-to-beep-cli`. Do not hand-write the docs' `$(basename ...)` script strings.
- `yeet sweep --retire` (or the closeout runbook) has to destroy the lane's alchemy stages before
  removing the worktree. Add a stages section to `AGENTS.md` only through the normal batched-edit rule.
- `prod` is never derived from a worktree.

## environments/local-development

URL: https://alchemy.run/environments/local-development

**Prescribes.**

- `alchemy dev` emulates resources that have local providers (ids prefixed `dev:`) and runs Lambda/ECS
  in Docker. Everything else deploys live into `dev_$USER` (`local-development.mdx:38-55`).
- `Alchemy.remote()` pins a resource or scope live (`:104-129`).
- Moving between local and live is a replacement (`:136-142`).
- `destroy`, `plan`, `logs` and `drift` default to the deploy stage (`live_$USER`), so a dev stage has
  to be destroyed explicitly (`:146-166`).
- CI split: `ALCHEMY_DEV: ${{ github.ref == 'refs/heads/main' && 'false' || 'true' }}` (`:189-194`).

**Rule for our stacks.** `alchemy dev` is useful for the turbo-cache Worker (workerd + R2 simulator)
and the runner Lambdas (Docker emulator). Live-only resources (Budgets, Compute Optimizer, GitHub
rulesets) would deploy for real under `dev`, so never run `alchemy dev` on cost-controls, github or
hosts. Destroy every `dev_*` stage explicitly.

## environments/stages

URL: https://alchemy.run/environments/stages

**Prescribes.** Defaults: `alchemy deploy` uses `live_$USER`, `alchemy dev` uses `dev_$USER`,
`Test.make` uses `test_$USER` (`stages.mdx:16-25`). Resolution order (`:47-51`):

1. `--stage <name>` flag
2. `$ALCHEMY_STAGE` (process env, `--env-file`, or `.env`)
3. `live_${USER}` for deploy / destroy / plan / logs / drift (`dev_${USER}` for `alchemy dev`)
4. `live_unknown` / `dev_unknown`

Patterns: `live_<user>`, `dev_<user>`, `test_<user>`, `pr-<n>`, `staging`, `prod` (`:55-62`). Regex:
`[a-z0-9][-_a-z0-9]*` (`:64`). Each stage has its own state file, physical names and logs (`:74-90`). The
current stage comes from `yield* Stack`. `Stack.useSync` covers module-scope props (`:94-120`).
`RemovalPolicy.retain(stack.stage === "prod")` (`:103-105`). "Stage vs profile" is presented as orthogonal
(`:137-148`).

**Rule for our stacks.**

- The canonical stage set is `prod`, `staging` (OIP only, which keeps its staging site),
  `live_<user>_<lane>`, `test_<user>_<lane>` and `ci-pr-<n>`.
- Always pass `--stage` explicitly in scripts and CI; never rely on `$USER` resolution. An agent env
  without `USER` would land in `live_unknown`.
- Stateful resources (KMS keys, the assets bucket, the OIP assets bucket, R2 if its contents matter)
  use `RemovalPolicy.retain(stage === "prod")`.

## environments/secrets (brief)

URL: https://alchemy.run/environments/secrets

**Prescribes.** A `Config` yielded in the Construction phase of a Worker or Lambda is bound onto it at
deploy time, always as a secret (`secrets.mdx:19-22`). Only the raw source is bound, and combinators
re-run at runtime, so defaults must be deterministic (`:76-95`). Footgun: a `Config` yielded only
inside `fetch` is never bound (`:97-120`). Async Workers bind through the `env` prop (`:139-161`).
`Config.Redacted` prints `<redacted>` (`:50`).

**Rule for our stacks.** The reaper and scale-up/down Lambdas and the turbo-cache Worker read all
secrets with `Config.Redacted` in their constructor (outer `Effect.gen`): the GitHub App key and the
per-team cache tokens. Never read them inside the handler.

## environments/secret-providers (brief)

URL: https://alchemy.run/environments/secret-providers

**Prescribes.**

- The Stack option `secrets: [...]` is an ordered list; later entries win (`secret-providers.mdx:6-35`).
- The process env is the implicit last entry. `Alchemy.Secrets.ProcessEnv()` ranks it explicitly
  (`:37-48`), and `ProcessEnv({ disabled: true })` drops it (`:50-56`).
- `ALCHEMY_PROFILE` is pinned to `--profile`/process env when `secrets` is declared (`:58-61`).
- Per-stage callbacks (`:65-84`).
- `Secrets.DotEnv` never writes to `process.env` (`:88-95`).
- `--env-file` is refused when the stack declares `secrets` (`:97-99`).
- Bring your own source with `ConfigProvider.layerAdd(..., { asPrimary: true })` (`:116-126`).
- `--log-level debug` reports loaded key names (`:103-112`).

**Rule for our stacks.** Omit `secrets` or declare only `Alchemy.Secrets.ProcessEnv()`. `op run`
populates the process env and resolves `op://` references before alchemy starts. Do not use
`Secrets.DotEnv`, which would mean checked-in or on-disk plaintext. A future in-process 1Password
`ConfigProvider` (over `@distilled.cloud/onepassword`) would plug in through `ConfigProvider.layerAdd`,
but that is a P0-matrix question, not a default.

## environments/profiles (brief; forbidden for us)

URL: https://alchemy.run/environments/profiles

**Prescribes.** Profiles live in `~/.alchemy/profiles.json` and `~/.alchemy/credentials/<profile>/`
(`profiles.mdx:6-8`). Selection order: `--profile`, then `$ALCHEMY_PROFILE`, then `default` (`:21-26`).
`ALCHEMY_HOME` relocates them (`:203`). Load-bearing for us:

- "Provider credentials in the environment always win … never consults the profile" when the full
  contract is set (`:145-160`). This is per provider. A partial set is ignored.
- With `CI=true`, nothing is read from or written to `~/.alchemy` (`:164-166`).
- The CI variable table (`:177-190`):
  - AWS: `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, plus `AWS_REGION` or `AWS_DEFAULT_REGION`.
    Optional `AWS_SESSION_TOKEN`; `AWS_ACCOUNT_ID` skips STS.
  - Cloudflare: `CLOUDFLARE_ACCOUNT_ID` plus `CLOUDFLARE_API_TOKEN`.
  - GitHub: `GITHUB_ACCESS_TOKEN` or `GITHUB_TOKEN`.

**Rule for our stacks.** Every invocation supplies the full per-provider env contract through
`op run`. For AWS locally, the session credentials come from aws-vault (`aws-vault exec elpresidank --`
inside or around `op run`), because the AWS env contract has no `AWS_PROFILE`/`credential_process` path.
Never run `alchemy profile *`. Optionally set `ALCHEMY_HOME` to a lane-scoped empty dir in CI and
agents to prove no profile is read.

## infrastructure-as-effects/telemetry

URL: https://alchemy.run/infrastructure-as-effects/telemetry

**Prescribes.**

- Every runtime exports OTel built in. Without a telemetry layer nothing exports (`telemetry.mdx:6-12`,
  `:40-41`).
- `Alchemy.Telemetry.layerOtlp({ url, headers })` or per-signal `{ traces, logs }`. Values may be
  Outputs, and `Redacted` values bind as secrets (`:50-72`).
- A manual backend wraps `Config.Redacted` inside `Layer.unwrap` (`:86-95`).
- Multiple destinations fan out with shared trace ids (`:100-121`).
- `service.name` defaults to the physical name, overridable with `serviceName`. Every signal carries
  `alchemy.stack`/`alchemy.stage` (`:125-129`).
- Lambda flushes inline, with an early drain 500 ms before the kill (`:140-146`).
- Server runtimes batch on standard intervals (`:153-156`).
- A custom `Alchemy.Telemetry.layer` must disable or lengthen periodic export on per-event runtimes
  (`:176-194`).
- Standard `OTEL_EXPORTER_OTLP_*` env adds an implicit destination (`:198-204`).

**Rule for our stacks.** The runner Lambdas and the turbo-cache Worker provide one
`Alchemy.Telemetry.layerOtlp` pointing at the existing operator collector (Grafana stack). The
collector key comes from `Config.Redacted`. Set `serviceName` to a stable `beep-<stack>-<fn>` so
dashboards survive physical-name changes, and filter on `alchemy.stage`. The CLI's own usage
telemetry is a separate matter; see Cross-cutting rules.

## infrastructure-as-effects/circular-bindings

URL: https://alchemy.run/infrastructure-as-effects/circular-bindings

**Prescribes.** Split identity from implementation. Declare a Tag class, for example
`Cloudflare.Worker<A, Shape>()("A")` (`circular-bindings.mdx:47-58`), and attach the implementation
with `A.make({ main: import.meta.url }, effect)` (`:83-105`). The Stack provides both Layers with
`Effect.provide(Layer.mergeAll(ALive, BLive))` (`:150-172`). The engine resolves the cycle in passes:
`precreate` reserves, `create` runs with deferred Outputs, then a converge `update` runs (`:176-205`). The
split works for every Function resource, Lambda included (`:207-209`). Skip it when the graph is a
DAG (`:213-228`).

**Rule for our stacks.** The runner composite is a DAG: webhook Lambda to SQS to scale-up Lambda to
ASG/launch template, plus scale-down, syncer and the termination watcher. Use the single-expression
form. Reserve the Tag/`.make` split for a real cycle, for example a webhook Lambda whose URL must be
written into a GitHub App webhook that the Lambda itself verifies against. Even that is better
modelled as Lambda, then `GitHub.Webhook`, which is not a cycle. Repo-owned resources inside a cycle
must implement `precreate` and `observe` (provider.mdx).

## infrastructure-as-effects/phases

URL: https://alchemy.run/infrastructure-as-effects/phases

**Prescribes.** The outer Effect is Construction and runs at plan time **and** at cold start. The
inner one is Runtime and runs per request (`phases.mdx:17-43`). `Alchemy.RuntimeContext` exists only in
Runtime and is type-enforced (`:48-54`). `ALCHEMY_PHASE` is `plan` or `runtime` (`:86-98`).
`ALCHEMY_DEV` comes from `import { ALCHEMY_DEV } from "alchemy"` (`:100-117`). The
`globalThis.__ALCHEMY_RUNTIME__` guard fences `host.bind(...)` wiring out of the runtime bundle (`:119-143`).

**Rule for our stacks.** Lambda constructors stay side-effect-free apart from bindings and `Config`
reads, because they run during every `alchemy plan`. No AWS calls in Construction. A plan must not
call GitHub or EC2. Branch on `yield* ALCHEMY_DEV` only, never on raw env.

## infrastructure-as-effects/sinks

URL: https://alchemy.run/infrastructure-as-effects/sinks

**Prescribes.** A Sink is a write-side Binding that drains a `Stream` into a batch API with
least-privilege IAM (`sinks.mdx:6-13`).

```typescript
const sink = yield* AWS.SQS.QueueSink(OutboundQueue);
// → policy: sqs:SendMessage + sqs:SendMessageBatch on OutboundQueue's ARN
```
(`sinks.mdx:34-36`)

- Implementation Layers: `AWS.SQS.QueueSinkHttp.pipe(Layer.provideMerge(AWS.SQS.SendMessageBatchHttp))` (`:52-68`).
- Element types: `SQS.QueueSink` takes string, `SNS.TopicSink` takes string,
  `Kinesis.StreamSink` takes `PutRecordsRequestEntry`, `Cloudflare.Queues.QueueSink` takes a JSON body (`:77-85`).
- One stream chunk is one batch call; `Stream.rechunk(10)` sets the size (`:123-132`).
- Source to sink pipelines combine `AWS.Lambda.TableEventSource` with `consumeTableChanges` (`:141-178`).

**Rule for our stacks.** The runner webhook Lambda publishes `workflow_job` events to the scale-up
queue through `AWS.SQS.QueueSink(ScaleUpQueue)` with `Stream.rechunk(10)` (the SQS batch maximum).
No hand-rolled `SendMessageBatch` and no `QUEUE_URL` env var. The scale-up Lambda consumes through
the SQS event source binding. Record both in the P0 "use this, never roll that" matrix.

## infrastructure-as-code/custom-provider

URL: https://alchemy.run/infrastructure-as-code/custom-provider

**Prescribes.**

- Props and attributes types, then `type X = Resource<"Svc.Type", Props, Attrs>`, then
  `const X = Resource<X>("Svc.Type")`. The Type string must be globally unique (`custom-provider.mdx:30-93`).
- Provider: `Provider.succeed(X, X.Provider.of({ reconcile, delete, list, diff?, read?, precreate?, lookup?, stables? }))`.
  `Provider.effect` is for construction-time dependencies only (`:101-139`).
- Credentials resolve lazily with a double `yield* yield* Credentials` inside handlers (`:141-147`, `:197-198`).
- `reconcile` follows observe, ensure, sync, return. Do not branch on `output === undefined`. Trust
  observed state (`:149-176`). It must be idempotent (`:291-296`).
- `delete` treats 404 as success (`:310-314`).
- `diff` returns `noop` / `update{stables}` / `replace{deleteFirst}` / `undefined`, guarded by
  `isResolved(news)` from `alchemy/Diff` (`:336-388`).
- `read` handles recovery and adoption. `Unowned(attrs)` from `alchemy/AdoptPolicy` gates takeover behind `--adopt` (`:390-438`).
- `list` paginates exhaustively for `alchemy unsafe nuke` (`:440-464`).
- `lookup` takes its key as the sixth type parameter (`:466-500`).
- Bundle with `class Providers extends Provider.ProviderCollection<Providers>()("Stripe")` plus
  `Layer.effect(Providers, Provider.collection([X])).pipe(Layer.provide(XProvider()))` (`:508-523`).
- Namespaced re-exports, so callers write `Stripe.Product` (`:533-540`).
- Test with `Test.make({ providers })` and `test.provider` (`:596-651`).
- References: `packages/axiom/src/VirtualField.ts`, `packages/cloudflare/src/R2/Bucket.ts` (`:661-662`).

**Rule for our stacks.**

- Package shape for `@beep/alchemy-vercel`, `@beep/alchemy-aws-extras` and `@beep/alchemy-github-runners`:
  - one module per resource (`src/Project.ts`, `src/EnvVar.ts`, `src/Domain.ts`)
  - `src/Credentials.ts`
  - `src/Providers.ts` exporting `class Providers extends Provider.ProviderCollection<Providers>()("Vercel")`
    and `providers()`
  - a barrel re-exporting `Project`, `EnvVar` and `Domain` without the prefix, so callers write
    `Vercel.Project`
- Type strings `Vercel.Project`, `AWS.KMS.Grant` and so on. Before claiming a namespace like
  `AWS.KMS.Grant`, check upstream does not already use the type string.
- Schema-first: define props and attributes as `S.Class` schemas, then pass `typeof X.Type` into
  `Resource<...>`. The docs' bare `interface` types break repo law.
- Use `Effect.fn` for every handler and the `@distilled.cloud/*` clients with `catchTag` on their typed
  errors. Do not copy the docs' `Effect.tryPromise` + `cause.message.includes(...)` pattern
  (`:326-330`).
- `read` brands foreign resources `Unowned` using an ownership tag (stack/stage/id), so cutover never
  silently takes over a Pulumi-owned object.
- Credentials: a Credentials service built through the Custom Auth Provider guide with an env-only
  resolver (`VERCEL_TOKEN`, ...), so `check-env` covers it.

## infrastructure-as-code/provider

URL: https://alchemy.run/infrastructure-as-code/provider

**Prescribes.**

- Providers are Layers. Merge them with `Layer.mergeAll`. A missing provider is a compile error (`provider.mdx:13-69`).
- `reconcile` and `delete` are required (`:73-75`). The `output`/`olds` truth table (`:96-107`).
- Idempotency through deterministic physical names (`:109-112`).
- `diff` shapes, with the `deepEqual` / `anyPropsAreDifferent` helpers from `alchemy/Diff` (`:147-168`).
- `read` returns three ways: `undefined`, owned attrs (silent adopt), or `Unowned` (`OwnedBySomeoneElse`
  unless `--adopt`) (`:190-205`). No-ownership resources return plain attrs (`:224-229`).
- "Lifecycle methods don't gate on ownership" (`:231-234`).
- `precreate` (`:236-241`). `observe` with `Unresolved` (`:243-268`). `previous` during replacement (`:270-282`).
- `list` with the `nuke.singleton` / `nuke.skip` opt-outs (`:284-294`).
- `lookup` is read-only, always live, and writes no state row (`:296-325`).
- `tail`/`logs` (`:327-331`).

**Rule for our stacks.** Singletons (`ComputeOptimizerEnrollment`, `CostOptimizationHubEnrollment`,
`CostAllocationTag` activation) return plain attrs from `read`, so adoption is silent. Their `list`
returns `[]`, and they declare `nuke.singleton` so `alchemy unsafe nuke` resets them instead of failing.
Never run `nuke` against the shared account. `KmsGrant` declares `stables: ["grantId"]` and
`diff` returns replace on grantee/operations changes, because grants are immutable.

## infrastructure-as-code/references

URL: https://alchemy.run/infrastructure-as-code/references

**Prescribes.** References read persisted state at plan time and are re-read every plan
(`references.mdx:6-10`).

- `Resource.ref("LogicalId", { stage })` reads another stage of this stack. `{ stack, stage }` reads
  another stack. `{ stack, stage, id }` is the full address (`:14-45`).
- Typed Stack handles: `yield* Backend`, `Backend.stage.prod`, `Backend.stage["pr-42"]`. A third type
  parameter restricts the stages (`:49-84`).
- `Resource.lookup({...})` covers resources Alchemy does not manage. It fails the deploy if nothing
  matches, and fails with `LookupOfManagedResourceError` on the stack's own resources (`:86-125`).
- Escape hatches: `Output.ref`, `Output.stackRef` (`:127-149`).
- `InvalidReferenceError` when the upstream is not deployed. Destroy in reverse (`:151-166`).

**Rule for our stacks.**

- Cross-stack data goes through typed Stack handles with a declared stage union: `"prod"` for infra
  packages, `"prod" | "staging"` for OIP.
- Consumers yield `Handle.stage.prod`.
- `Resource.lookup` covers pre-existing, never-Alchemy objects that stay unmanaged, for example the
  existing Route 53 / Cloudflare zone if a stack must only read it.
- During cutover, `lookup` must not be used to "adopt" Pulumi resources. D12 is greenfield.

## infrastructure-as-code/resource-lifecycle (brief)

URL: https://alchemy.run/infrastructure-as-code/resource-lifecycle

**Prescribes.**

- Plan symbols `+ ~ ± - •` (`resource-lifecycle.mdx:43-47`). `alchemy plan` is `deploy --dry-run` (`:59-60`).
- Replace creates new, rewires dependents, then deletes old (`:84-93`).
- Removal policy: `destroy` (default) or `retain`, via `RemovalPolicy.retain()` / `.destroy()` piped
  onto a declaration or scope (`:120-154`). A policy change is a no-op diff but is persisted (`:156-160`).
  `retain` does not stop provider cascades (`:162-169`).
- Adoption through `read` (`:186-207`).
- Retryable errors are retried with backoff (`:211-215`).

**Rule for our stacks.** Mark every irreplaceable resource `RemovalPolicy.retain(stage === "prod")`
in the same PR that introduces it. That covers KMS keys, S3/R2 buckets with content, Docker volumes
with metrics data, and DNS zones. Rulesets and repositories are already retain by default.

## infrastructure-as-code/outputs (brief)

URL: https://alchemy.run/infrastructure-as-code/outputs

**Prescribes.** `Output<T>` lazy references with `Output.literal`, `asOutput`, `fromEffect`, `map`,
`mapEffect`, `all`, `interpolate`, `of`, `ref` (`outputs.mdx:59-245`). Helpers include
`Output.toEnvKey` (`:271-279`). `Redacted` survives into state and logs as `<redacted>` (`:285-299`).

**Rule for our stacks.** Build ARNs and URLs with `Output.interpolate`, not string concatenation on
`.as<string>()`. Secrets stay `Redacted` end to end, including `GitHub.Secret.value`.

## infrastructure-as-code/renaming (brief)

URL: https://alchemy.run/infrastructure-as-code/renaming

**Prescribes.** Changing a logical ID plans a replace unless the new declaration carries
`.pipe(Alchemy.renamedFrom("Old"))`, which migrates the state row as one update (`renaming.mdx:6-31`).
Namespaced and absolute forms `{ fqn }` (`:36-59`). Several former IDs, most recent first (`:61-70`).
Safety: identity is proven by instance ID, types must match, ambiguity and swaps fail (`:93-175`).

**Rule for our stacks.** Logical IDs are API. Any refactor that renames one carries `renamedFrom`
in the same PR, and the PR's `alchemy plan` must show `update (renamed from ...)`, never `±`.

## infrastructure-as-code/resource (brief)

URL: https://alchemy.run/infrastructure-as-code/resource

**Prescribes.** The logical ID is unique within a stack and stable across code moves
(`resource.mdx:142-166`). The physical name is generated as:

```text
{stack-name}-{stage}-{logical-id}-{instance-id}
```
(`resource.mdx:194`)

The instance ID changes only on replace (`:198-214`).

**Rule for our stacks.** D12's "new physical names" falls out for free. Let Alchemy generate names
unless an external contract needs a fixed one: the GitHub ruleset name, the Vercel project name, the
R2 bucket the turbo token policy names. Every fixed name gets a `read` with an ownership check in
repo-owned providers.

## infrastructure-as-code/stack (brief)

URL: https://alchemy.run/infrastructure-as-code/stack

**Prescribes.** `Alchemy.Stack(name, { providers, state }, effect)`. Name, options and effect (`stack.mdx:32-37`).
`--config` takes any file (`:39-51`). `state` is independent of `providers` (`:90-91`). Outputs (`:96-116`).
`yield* Stack` gives `name` and `stage` (`:141-157`). `Stack.useSync` (`:159-183`). Cross-stack handles (`:185-227`).

**Rule for our stacks.** Stack names are PascalCase and fixed per package (`BeepCiRunners`,
`BeepTurboCache`, `BeepCostControls`, `BeepGithub`, `BeepHosts`, `OipWeb`, `Storybook`; keep
`BeepEffectWeb`). They key the shared state store, so a rename orphans state. Every stack sets
`state:` explicitly.

**Drift flag.** `stack.mdx:121-122` says the stage "defaults to `dev_$USER`". That contradicts
`stages.mdx:16`, which says `live_$USER` for deploy. The live site has the same contradiction, so
trust `stages.mdx` and the CLI reference.

## command (index, what-is-command, memoization, dev-servers)

URLs: https://alchemy.run/command , /command/what-is-command , /command/memoization ,
/command/dev-servers

**Prescribes.**

- Import from `alchemy/Command`. `Command.providers()` is already merged into `AWS.providers()` and
  `Cloudflare.providers()`. A standalone stack registers it (`command/index.mdx:6-14`).
- `Command.Build(id, { command, cwd, outdir })` (`:20-31`). `Command.Exec(id, { command, cwd, env })`
  succeeds on exit 0, skips when inputs are unchanged, re-runs on a change to `command`, `env` or
  memoized files, and "Deleting an `Exec` never reverses its side effects" (`:37-57`).
- `Command.Dev` runs only under `alchemy dev` (`:59-70`).
- Caution: "Command strings are whitespace-split into a binary and arguments — there is no quoting
  support unless you set `shell`". `Redacted` env is unwrapped at spawn and kept out of logs and state
  (`:72-78`).
- Memo: by default every non-gitignored file under `cwd` plus the nearest lockfile is hashed. Narrow it
  with `memo: { include: [...] }`. Custom globs drop the lockfile unless `lockfile: true` is set.
  `memo: false` re-runs on every deploy (`command/memoization.mdx:37-57`).
- A prop change forces a re-run (`:59-69`). `outdir` is stored relative to `process.cwd()` (`:71-87`).
- After a destroy, an unchanged redeploy runs again (`:116-117`).
- `Command.Dev` exposes a best-effort `url` from the first `http(s)://` within 5 s. An exit inside the
  window raises `CommandError` with reason `UnexpectedExit`, checked with `Command.isCommandError`
  (`command/dev-servers.mdx:39-60`).
- All of these run **locally**, on the machine running `alchemy` (`command/what-is-command.mdx:8-10`, `:62-64`).

**Rule for our stacks.** OpenClaw through `Command.Exec` means the deploy host runs the command,
typically `ssh <host> ...`.

- Set `shell` if the command needs quoting or pipes.
- Set `memo: { include: [<the OpenClaw config/compose files>], lockfile: false }`. Without it, any
  repo-wide file change re-runs the remote deploy.
- Pass secrets as `Redacted` env.
- Exec has no delete semantics, so the destroy path for OpenClaw is a second `Command.Exec` or a
  documented runbook step. Record it in the irreversible-step decision.
- The storybook and OIP builds use `Command.Build` (or the Vercel provider's own build) with a narrow
  `memo.include`.

## docker (index, setup, what-is-docker, local-services, build-and-push, swarm)

URLs: https://alchemy.run/docker , /docker/setup , /docker/what-is-docker , /docker/local-services ,
/docker/build-and-push , /docker/swarm

**Prescribes.**

- Install `@alchemy.run/docker`. Register `providers: Docker.providers()` and merge with
  `Layer.merge(...)` (`docker/setup.mdx:8-24`).
- The provider shells out through the **active Docker CLI context**. It has no credentials of its own
  (`:28-33`, `docker/what-is-docker.mdx:39`).
- `DOCKER_BIN` overrides the binary (`docker/setup.mdx:37-40`).
- Registry auth is per resource, `registry: { server, username, password: Redacted }`, written to an
  isolated `DOCKER_CONFIG` without `docker login` (`:44-65`).
- Resources:
  - `Docker.RemoteImage`, pinned with `alwaysPull: false` (`docker/local-services.mdx:47-60`)
  - `Docker.Network` and `Docker.Volume`. A prop change on either is a **replacement**, so treat
    Volume props as fixed (`:66-75`)
  - `Docker.Container` with `environment` (Redacted values go through process env, not argv), `ports`,
    `volumes: [{ hostPath: volume.name, ... }]`, `networks`, `healthcheck` (Duration strings) and
    `start: true` (`:102-132`)
  - limits (`:156-175`) and hardening such as `readOnlyRootFilesystem`, `capDrop`, `noNewPrivileges`,
    `user`, `tmpfs` (`:179-200`)
  - log rotation, through `logDriver`/`logOptions` (`:228-244`)
- Create-time changes replace a container **delete-first** (`:246-250`).
- `Docker.inspectContainer` (`:141-148`).
- `Docker.Image` with `build`. Rebuild detection runs `docker build` and compares `imageId`.
  `skipPush`. `repoDigest` (`docker/build-and-push.mdx:31-96`).
- Swarm:
  - `Docker.Swarm("swarm", { context, advertiseAddr })` is an idempotent `docker swarm init`
    (`docker/swarm.mdx:26-35`, `:204-214`).
  - Remote engines go through `Docker.Context("vps", { docker: "host=ssh://deploy@example.com" })`,
    after which "every Docker operation — including image builds — runs on that machine"
    (`:190-200`).
  - Services need the engine behind `context` to already be a swarm manager. Referencing that way
    leaves the swarm untouched on destroy (`:56-60`).
  - `Docker.Swarm(...).pipe(Alchemy.adopt(true))` takes ownership, **including leaving the swarm on
    destroy** (`:62-73`).
  - `Docker.Service` updates in place on image, replicas, env and similar. It replaces on name,
    context, command or endpoint mode. `updateConfig: { order: "start-first", failureAction: "rollback" }`
    raises `DockerServiceUpdateFailed` (`:93-108`).
  - Overlay `Docker.Network({ context, driver: "overlay" })` (`:112-127`).
  - Effectful `Docker.Service` with `main: import.meta.url` (`:131-158`).
  - Dev/prod split with `Alchemy.ALCHEMY_DEV` (`:256-287`).
- Source facts:
  - `Docker.Context` props are `name?`, `description?` and `docker?`. They are "Connection metadata
    only — never credentials", and SSH authenticates through keys or the agent
    (`packages/docker/src/Context.ts:9-27`).
  - `Container` and `Volume` take `context?: Docker.ContextRef`
    (`packages/docker/src/Container.ts:25-26`, `Volume.ts:31-32`).

**Rule for our stacks.**

- `@beep/infra-hosts` declares `Docker.Context("dankserver", { docker: "host=ssh://<user>@dankserver" })`
  and passes it as `context` to every image, network, volume and container.
- Prefer `Docker.Container` with `context` over `Docker.Service`, unless dankserver is deliberately
  made a single-node swarm. If it is, declare `Docker.Swarm({ context })` and do not adopt an existing
  swarm. The SPEC text "Docker.Service/Network/Volume" needs this correction.
- Metrics volumes get `RemovalPolicy.retain()` and frozen props.
- Pin images by `RemoteImage` with `alwaysPull: false`.
- The deploying machine needs SSH access to dankserver without interaction. Our remote route is the
  YubiKey ControlMaster, which hosted CI cannot use, so the hosts stack deploys from a workstation
  under `op run` or a dedicated deploy key. That breaks the "prod only from CI" rule; record the
  exception as a decision.
- `Docker.Context` writes plaintext metadata to `~/.docker/contexts` on the deploy host. Harmless, but
  give it a fixed `name`.

## github (index, setup, accounts-and-tokens, what-is-github, repository, actions-config, events)

URLs: https://alchemy.run/github , /github/setup , /github/accounts-and-tokens ,
/github/what-is-github , /github/repository , /github/actions-config , /github/events

**Prescribes.**

- Install `@alchemy.run/github`. Register `GitHub.providers()` (`github/setup.mdx:8-19`).
- `alchemy profile edit --add GitHub` offers the `gh` CLI or a stored PAT (`:21-25`).
- `CI=true` reads `GITHUB_ACCESS_TOKEN`/`GITHUB_TOKEN` (`:27-28`).
- `GitHub.providers({ baseUrl })` and a per-resource `baseUrl`, where changing it replaces (`:57-83`).
- Scopes: `repo`, `workflow` for secrets and variables, `delete_repo` only for `destroy()` (`:85-91`).
- `GitHub.fromToken(token)` and `GitHub.fromEnv()` build credentials without profiles (`:95-112`).
- `GitHub.Repository`:
  - **silently adopts** an existing name and converges settings (`github/repository.mdx:48-62`)
  - settings: `visibility`, `hasIssues`/`hasProjects`/`hasWiki`/`hasDiscussions`,
    `allowSquashMerge`/`allowMergeCommit`/`allowRebaseMerge`/`allowAutoMerge`/`deleteBranchOnMerge`,
    `defaultBranch` (`:80-91`)
  - `topics` fully replaces the topic list (`:95-104`)
  - rename in place by keeping the logical ID (`:125-139`)
  - retain by default; `destroy()` from `alchemy/RemovalPolicy` deletes (`:156-171`)
  - escape hatch: `@distilled.cloud/github/repos` with `Effect.catchTag("NotFound", ...)` (`:175-209`)
- `GitHub.Secret`:
  - `value` is `Redacted`, sealed with libsodium (`github/actions-config.mdx:19-37`)
  - "GitHub never returns a secret's value, so there's nothing to diff: alchemy re-encrypts and
    re-uploads on every deploy" (`:39-40`)
  - `environment` takes a name or an `Environment` resource (`:44-58`, `:91`)
- `GitHub.Environment({ name, waitTimer, preventSelfReview, reviewers: { users, teams }, deploymentBranchPolicy })`.
  It is plan-gated on private repos (`:62-98`).
- `GitHub.Variable` diffs the live value (`:100-129`).
- `GitHub.Secrets` / `GitHub.Variables` are bulk maps where the key is both logical id and name (`:150-180`).
- `GitHub.Webhook({ url, events, secret })`, with `events` defaulting to `["push"]` (`github/events.mdx:20-37`).
- `consumeRepositoryEvents` + `RepositoryEventSourceLive` work on Cloudflare Workers only (`:63-119`).
- `GitHub.Comment` / `GitHub.GitHubEnv` for PR comments (`environments/ci.mdx:237-255`).
- Not in the narrative docs, only in the generated API reference (live) and source
  (`packages/github/src/`): `Ruleset.ts`, `Label.ts`, `BranchProtection.ts`, `TeamAccess.ts`,
  `Collaborator.ts`, `Milestone.ts`.
- `GitHub.Ruleset` (live `/providers/github/ruleset`):
  - props: `owner`, `repository`, `name`, `target`, `conditions.include` (with `~DEFAULT_BRANCH`)
  - rule props: `nonFastForward`, `deletion`, `requiredLinearHistory`, `pullRequest{...}`,
    `requiredStatusChecks{checks, strictRequiredStatusChecksPolicy}`, `mergeQueue{...}`,
    `bypassActors[{actorType, actorId}]`
  - retain by default
  - **a same-named existing ruleset is foreign until `adopt(true)` / `--adopt`**
  - beta.85 moved rules to top-level props (`blog/2026-11-01-beta-85.mdx:64`)
- `GitHub.Label` is documented under the Issue reference page with `owner`, `repository`, `name`,
  `color`, `description`. Removal and adoption are undocumented.

**Rule for our stacks.**

- `@beep/infra-github` declares, for `beep-effect/beep-effect`:
  - `GitHub.Repository` (silent adopt, retain), with `allowSquashMerge` etc. matching today's settings
  - `GitHub.Ruleset`, including the beep-reviewer advisory ruleset 10240248's rules
  - `GitHub.Environment`s
  - `GitHub.Secrets`/`GitHub.Variables` for Actions
  - `GitHub.Label`s
  - `GitHub.Webhook` for the runner fleet, with its URL taken from `CiRunners.stage.prod`
- Rulesets and labels already exist on the repo. Greenfield (D12) cannot hold for them, because names
  are unique per repo. Adopt them with `--adopt` in one recorded step after
  `alchemy plan --adopt --detailed` review, or create them under new names and delete the old ones.
  Decide in a decision file. The beep-reviewer `release|require` switch must then flip through this
  stack, not the REST call.
- Run `yeet`'s ruleset switch only through the stack, or `alchemy drift` will flag it.
- Credentials: a GitHub App installation token (from `beep github app mint`, sibling packet) exported as
  `GITHUB_TOKEN` under `op run`. The Actions-provided `GITHUB_TOKEN` cannot write rulesets, secrets or
  webhooks.
- Because secrets re-upload on every deploy, `alchemy plan` against `@beep/infra-github` may never
  show a pure no-op. Check against a real plan before the SPEC acceptance criterion "plan is a no-op"
  is applied to this stack.

## state-store (index)

URL: https://alchemy.run/state-store

**Prescribes.**

- State is keyed by FQN and scoped by stack and stage (`state-store/index.mdx:14-28`).
- Local `.alchemy/state/<Stack>/<stage>/` (`:30-50`).
- `Cloudflare.state()`:
  - a Durable Object Worker with secrets in Secrets Store (`:70-101`)
  - **in CI a missing store fails the run**, so provision it with `alchemy state bootstrap` (`:103-110`)
  - options `workerName` (`:131-143`), `accountId` (`:149-157`), `domain` (`:159-174`)
- AWS:

  > `AWS.state()` keeps state in one on-demand DynamoDB table per account and region, `alchemy-state`.

  (`state-store/index.mdx:178`)

  - Records over `overflowThreshold` (300 KiB) go to an `alchemy-state-overflow-<account>-<region>-an`
    bucket (`:193`).
  - In CI, bootstrap with `alchemy state bootstrap --backend aws` (`:195-199`).
  - `AWS.state({ name: "team-a" })` uses table `alchemy-state-team-a`. `tableName`. `kmsKeyId` for table
    and bucket (`:145-147`, `:201`).
  - A first deploy lists the old S3 store's bucket; `migrateFrom: false` skips that (`:203`).
  - `alchemy state migrate [--stack] [--stage] [--rollback]` moves S3 to DynamoDB (`:205-223`).
  - `AWS.state({ backend: "s3" })`, or passing `bucketName`/`prefix`/`encryption`, keeps S3. Bootstrap
    it with `--backend aws-s3` (`:227`).
- `postgresState()` from `@alchemy.run/sql/PostgresState` holds an advisory lock per (stack, stage) (`:231-249`).
- In-memory store: `@alchemy.run/test/TestState` (`:269-286`).
- Without a stack file: `alchemy state ... --backend <name>`, and `Alchemist.State.bootstrap/store/layer`
  from `alchemy/Alchemist` (`:288-333`).
- Source: both AWS backends take a per-(stack, stage) lease. A concurrent deploy fails fast
  (`packages/aws/src/StateStore/Store.ts` `state` doc, `packages/alchemy/src/State/BucketState.ts:100-107`).

**Rule for our stacks.**

- One shared store in the existing AWS account. Every stack, `BeepEffectWeb` included, sets the same
  `state:` expression, exported once from a shared module so it cannot drift per stack. For example, a
  `@beep/infra-state` leaf or a constant inside an existing tooling package.
- Recommendation for the D6 re-decision: take the default DynamoDB `AWS.state({ name: "beep", kmsKeyId? })`.
  If D6 stays S3, write `AWS.state({ backend: "s3", bucketName: "<new>", prefix: "..." })` explicitly.
- Bootstrap once, from a workstation, under aws-vault + `op run`:
  `alchemy state bootstrap --backend aws --name beep` (or `--backend aws-s3`). Record it as a
  decision with its teardown reversal (`alchemy state teardown`).
- The lease makes concurrent `prod` deploys fail fast, so the CI concurrency group becomes
  defence-in-depth instead of the only lock (contrast the comment in `apps/beep-effect-web/alchemy.run.ts`).
- The deploy role needs DynamoDB on the table and S3 on the overflow bucket (`:203`).

## state-store/custom-state-store

URL: https://alchemy.run/state-store/custom-state-store

**Prescribes.**

- A store is `Layer<State>` where `State` holds `Effect<StateService>`, built lazily and cached with
  `Layer.effect(State, Effect.cached(make(props)))` (`custom-state-store.mdx:20-60`).
- `StateService` methods: `listStacks`, `listStages`, `list`, `get`, `set`, `delete`, `deleteStack`,
  `getReplacedResources` (`:64-73`).
- `Layer.scoped` with `acquireRelease` (`:81-146`).
- `encodeState`/`reviveState`. `get` returns `undefined` when missing. `StateStoreError` only for
  transport failures (`:153-161`).
- FQNs contain `/`, so use `encodeFqn`/`decodeFqn` from `alchemy/FQN`. Concurrent per-key writes. The
  encoded shape is a migration surface (`:420-431`).
- References: `LocalState.ts`, `HttpStateStore.ts`, `InMemoryState.ts` (`:437-439`).

**Rule for our stacks.** Do not write one. The built-in AWS stores cover D6, and the D16 matrix should
record "custom state store: never roll". If an S3 store with a custom key layout were ever needed,
`makeBucketState` from `alchemy/State/BucketState` is the primitive
(`packages/alchemy/src/State/BucketState.ts:169`).

## cli/state

URL: https://alchemy.run/cli/state

**Prescribes.**

- Bare `alchemy state` opens the TUI explorer (`cli/state.mdx:16-21`). It needs a TTY; without one it
  exits 1 (`cli/index.mdx:114`).
- Shared options: `--backend configured|local|aws|cloudflare`, `--name`, `--domain`, `--profile`,
  `--env-file`, `--config`. There is no `--stage`; paths are positional (`cli/state.mdx:23-41`).
- `state list [path] [-r]`, with paths `<stack>/<stage>/<ns…>/<resource>` plus `output` (`:43-59`).
- `state read [path] [-r]`, where redacted values appear as `{ __redacted__: ... }` (`:61-83`).
- `state delete <path> [-r]` touches state records only (`:85-107`).
- `state bootstrap [--backend] [--force]` is idempotent (`:109-146`).
- `state teardown --backend <name> [--yes]` deletes the state itself (`:148-161`).
- `state logs` is Cloudflare only (`:163-184`).

**Rule for our stacks.** The canonical inspection commands, always under `op run` and never bare in
an agent shell (no TTY):

```sh
bunx alchemy state list --config <pkg>/alchemy.run.ts
bunx alchemy state list BeepCiRunners/prod --config <pkg>/alchemy.run.ts
bunx alchemy state read BeepCiRunners/prod -r --config <pkg>/alchemy.run.ts | jq ...
```

`state read` output includes `__redacted__` plaintext. Never paste it into a PR, packet or
transcript; reduce it to counts and keys. SPEC acceptance "the shared S3 state store lists every
stack including `BeepEffectWeb`" is proven by `alchemy state list` with no path.

## cli/inspecting-state

URL: https://alchemy.run/cli/inspecting-state

**Prescribes.** Explorer or `state list` drill-down, and `state read -r | jq` for the whole estate
(`inspecting-state.mdx:9-48`). Bad-diff causes: wrong stage (default `live_$USER`), drift, stale state
from a partial deploy (`:50-72`). Recovery: `state delete <stack>/<stage>`, then `deploy` (owned
resources re-import), then `deploy --adopt` on `OwnedBySomeoneElse` (`:74-95`). `--backend local` for
orphaned local state after a botched bootstrap (`:97-107`).

**Rule for our stacks.** The runbook per stack family carries this recovery ladder verbatim, with
`--stage prod --config ...` spelled out. `state delete` of a prod stage is an irreversible-step
decision that needs a `state read -r` export, stored outside the repo, first.

## cli/adopting-resources

URL: https://alchemy.run/cli/adopting-resources

**Prescribes.** `read` routes resources three ways (`adopting-resources.mdx:11-23`):

| `read` returns | without `--adopt` | with `--adopt` |
| --- | --- | --- |
| `undefined` | create | create |
| owned attrs | silent adopt | silent adopt |
| `Unowned` | `OwnedBySomeoneElse` | take over |

Recovery needs no flag (`:27-44`). `--adopt` applies to the whole deploy as one `AdoptPolicy` layer
(`:46-50`). `OwnedBySomeoneElse` carries `resourceType`, `logicalId` and `physicalName` (`:52-56`).
Programmatically, `import { adopt } from "alchemy/AdoptPolicy"` wraps **the deploy effect**:
"the combinator must wrap the *deploy* … not the inner resource-declaration effect" (`:60-72`).
`adopt(Effect<boolean>)` gives dynamic policies (`:74-79`).

**Rule for our stacks.** For D6, moving `BeepEffectWeb` to the shared store:

1. Switch `state:` to the shared store.
2. Run `alchemy plan --stage prod --adopt --detailed` in CI or an `op run` lane, and confirm only
   adoptions or no-ops.
3. Deploy.
4. Only after `state list` shows it in the new store, retire the Cloudflare store. Check first that
   nothing else uses it.

No backend-to-backend migrate exists for Cloudflare to AWS: `state migrate` is S3 to DynamoDB only
(`state-store/index.mdx:205-223`). For GitHub rulesets and labels, see the github section. The source
of `adopt` (`packages/alchemy/src/AdoptPolicy.ts:203-214`) just provides the `AdoptPolicy` service to
whatever effect it wraps. See the docs contradiction below before using it per resource.

## cli/drift

URL: https://alchemy.run/cli/drift

**Prescribes.** Re-observes every resource against persisted state and reports drifted or missing
ones (`cli/drift.mdx:10-14`). It prompts to repair, or `--repair`/`--yes` repairs without asking
(`:16-19`). It never recomputes outputs (`:21-22`). Exit `0` means clean or repaired, `1` a failed
check, `2` drift found (`:26-32`). Flags: `--stage`, `--profile`, `--env-file`, `--config` (`:36-43`).

**Rule for our stacks.** A scheduled GitHub Actions job runs
`bunx alchemy drift --stage prod --config <pkg>/alchemy.run.ts` per stack, with no `--repair`, and
alerts on exit 2. Required for `@beep/infra-github` by SPEC acceptance. Repairs run through a normal
deploy PR, never `--repair` from cron.

## cli/plan

URL: https://alchemy.run/cli/plan

**Prescribes.** `plan` is `deploy --dry-run`, with no prompt and no changes (`cli/plan.mdx:12-21`).
`--detailed` prints YAML before and after for declared inputs (a declaration diff, not a drift read),
with outputs shown as `(known after apply)` and secrets redacted (`:25-52`). Flags: `--config`,
`--stage`, `--profile`, `--env-file`, `--adopt`, `--detailed` (`:56-63`).

**Rule for our stacks.** Every infra PR posts `alchemy plan --stage prod --detailed` output for the
touched stack. The D13 Alchemy-bump PR runs it on every stack. "No-op" is asserted by parsing
`--log-format json` plan events or the plain `Plan:` line. Exit code alone proves nothing.

## cli/deploy

URL: https://alchemy.run/cli/deploy

**Prescribes.** Plan, approve, apply. The prompt is skipped when there are no changes
(`cli/deploy.mdx:12-44`). Flags: `--config`, `--stage`, `--yes`, `--dry-run`, `--detailed`, `--force`,
`--adopt`, `--profile`, `--env-file` (`:48-58`). Global: in plain mode (no TTY, `CI=1`, or agent env vars
`CLAUDECODE`/`CODEX_CLI`/…) it never prompts and fails without `--yes` (`cli/index.mdx:57-68`).
`--no-input` exists (`:47`). `--log-format json`/`$ALCHEMY_LOG_FORMAT` (`:76`). Each run writes
`.alchemy/log/<time>-pid<pid>.ndjson` (`:103`). `--fast-distilled` / `ALCHEMY_FAST_DISTILLED=1` lowers
Node memory (`:49`).

**Rule for our stacks.** The CI deploy is
`op run -- bunx alchemy deploy --stage prod --yes --config <pkg>/alchemy.run.ts --log-format json`.
Agents never run `deploy` without `--stage`. Agents run `plan` freely in `live_*`/`test_*` stages
and never `deploy --stage prod`. The stack-level `CI` guard enforces that.

## llms.txt

URL: https://alchemy.run/llms.txt (generated by `website/scripts/generate-llms-txt.ts`)

**Prescribes.** It is a navigation index, "a navigation index for the documentation site at
https://alchemy.run", with H2 sections: Start here, CLI, Infrastructure as Code, Infrastructure as
Effects, APIs, Environments, State Store, Project structure, Testing & observability, then one block
per provider (Docker, Command, GitHub, AWS, Cloudflare, ...). About 124 KB, with roughly 400 links.
Per-service API reference pages (for example `/providers/github/ruleset`) are indexed only in
`llms-full.txt` (about 201 KB). There is no version string.

**Rule for our stacks.** Agents look resources up in `llms-full.txt` or `/providers/<provider>/<resource>`.
Narrative pages omit many resources: Ruleset, Label, BranchProtection, and `context` on
Container/Volume. Pin research to the checkout tag that matches the catalog `alchemy` version (D13),
because the live site tracks main.

---

## Live vs checkout drift

| Page | Checkout (beta.85+48) | Live (2026-11-06) | Note |
| --- | --- | --- | --- |
| `/state-store/` | DynamoDB default, `backend: "s3"`, `state migrate`, Postgres store (`state-store/index.mdx:178-249`) | Same | No drift |
| `/cli/state/` | `--domain` row present (`cli/state.mdx:34`); `aws` bootstrap "creates the state bucket" (`:132-134`) | No `--domain` row; same stale bucket text; no `state migrate` subcommand listed | `--domain` landed after beta.85 (commit `1723adef5`, not in any tag yet). The bucket text is stale in both, contradicting `state-store/index.mdx:178` |
| `/environments/stages/` | Resolution order and regex `[a-z0-9][-_a-z0-9]*` (`stages.mdx:47-64`) | Identical | `cli/index.mdx:43` states the regex differently, as `[a-z0-9]+([-_a-z0-9]+)*`, but the two are equivalent |
| `/infrastructure-as-code/stack/` | "defaults to `dev_$USER`" (`stack.mdx:121-122`); providers and state "both required" (`:35-36`) | Identical | Internally inconsistent with stages.mdx and with `test-harness.mdx:74-82` (state optional, defaults to `localState()`) and `environments/ci.mdx:624-631` (stack without `state`) |
| `/providers/github/*` | Not in checkout (generated) | Ruleset and Label pages exist | Use live or source for these |
| `/llms.txt` | Generator script only | Live index lacks Ruleset/Label entries | Use `llms-full.txt` |

## Contradictions with our constraints

1. **`alchemy profile` everywhere.** The docs present profiles as the local credential path:
   - `environments/ci.mdx:322-360`: an `admin` profile and `alchemy deploy --config stacks/github.ts --profile admin`
   - `github/setup.mdx:21-25`, `github/accounts-and-tokens.mdx:22-28`, `github/actions-config.mdx:220-224`
   - `custom-provider.mdx:564-566`: `alchemy profile edit --add Stripe`
   - `state-store/index.mdx:109`, `:198`, `:210`: `--profile <your-ci-profile>` on bootstrap and migrate
   - `test-harness.mdx:88-102`: `profile` option

   Constraint: never. Replacement: the full env contract under `op run` (`profiles.mdx:145-160`).
2. **Cloudflare state as the default.** Almost every example uses `state: Cloudflare.state()`
   (`file-layout.mdx:48`, `monorepo-multi-stack.mdx:64`, `stack.mdx:24`, `testing/index.mdx:16`,
   `ci.mdx:400`). `state-store/index.mdx:72` calls it "recommended … for projects already running on
   Cloudflare", which describes `BeepEffectWeb` today. Constraint: one shared AWS store, so every
   copied snippet needs its `state:` line rewritten.
3. **S3 vs DynamoDB.** D6 names S3 BucketState. Upstream made DynamoDB the default in beta.85
   (commit `1e5fbafec`, `feat(aws)!`) and kept S3 as legacy or opt-in (`state-store/index.mdx:227`).
   Not a hard contradiction, since S3 is still supported and leased, but it should be re-decided.
4. **`alchemy provider aws bootstrap` requires an SSO or `aws login` profile** (`cli/aws.mdx:36-39`).
   It creates the Lambda assets bucket "required for deploying Lambda functions" (`:21-22`). Our rule
   is aws-vault `credential_process`, never `aws login`. The ci-runners stack (reaper, scale-up/down
   Lambdas) needs this bucket. Check in source whether the first deploy creates it lazily, or whether
   env credentials (`--env-file`) satisfy the command, before planning around it. This is a P0
   inventory item.
5. **Stage defaults keyed on `$USER`** (`stages.mdx:47-51`). Agent and CI shells may lack or share
   `USER`, which lands everything in `live_unknown`. Always pass `--stage`.
6. **Docs code breaks repo law.** It uses:
   - bare `interface` props (`custom-provider.mdx:32-41`)
   - `process.env.X!` (`observability.mdx:114`, `:132`; `testing-a-stack.mdx:165-206`; `custom-state-store.mdx:348`)
   - the v3-style `Effect.catchAll` (`custom-provider.mdx:210`, `:326`; `provider.mdx:184`), while
     `custom-provider.mdx:495` uses the v4 `Effect.catch`. The docs mix the two, so validate against
     `.repos/effect`.
   - `Effect.promise` in `delete`, which the same docs warn against (`provider.mdx:125-126` vs
     `custom-provider.mdx:219-223`)
   - `instanceof Error` + `message.includes` (`custom-provider.mdx:327`)

   Port the shapes, not the code.
7. **Where `adopt` is scoped.** `cli/adopting-resources.mdx:72` says `adopt()` must wrap the deploy,
   not the resource declaration. `docker/swarm.mdx:65` pipes `Alchemy.adopt(true)` onto a resource, and
   `local-development.mdx:126-127` says the policy is "captured at registration (like `adopt()`)". The
   source just provides a service. Verify per-resource scoping with a `test.provider` case before
   relying on it for rulesets.
8. **Worktree package scripts.** `worktrees.mdx:41-121` prescribes hand-written `package.json` scripts
   with `$(basename ...)` shell. Repo law generates scripts and bans shell, so a `beep` command has to
   own this.
9. **"Deploy once locally" credential stack** (`ci.mdx:312-315`, `:359-360`; `actions-config.mdx:184-227`).
   This conflicts with "prod deploys only from CI". `@beep/infra-github` is the bootstrap exception:
   its first deploy has to precede CI having credentials. Record the exception as a decision and use
   `op run`, not a profile.

## Cross-cutting rules

1. **Layout.** One Stack per package (`@beep/infra-*`) or app (`apps/*/alchemy.run.ts`).
   - `alchemy.run.ts` is composition only, with resources in `src/<Concern>.ts`.
   - The typed handle lives in `src/Stack.ts` and is exported from the barrel.
   - Tests go in `test/`.
   - Paths are anchored with `import.meta`.
   - `.alchemy/` is gitignored.
2. **Stack names are permanent** state keys. Fixed PascalCase. Renames are forbidden; resource renames
   use `Alchemy.renamedFrom`.
3. **Stages.** `prod` (and `staging` for OIP) only from CI on `main`. `live_<user>_<lane>` and
   `test_<user>_<lane>` for worktrees. `ci-pr-<n>` for CI tests. Always pass `--stage` explicitly. The
   regex is `[a-z0-9][-_a-z0-9]*`.
4. **State.** One shared AWS store expression, imported by every stack. DynamoDB default recommended;
   S3 only with an explicit `backend: "s3"`. Bootstrapped once with `alchemy state bootstrap --backend aws[-s3]`,
   as a recorded decision with a teardown reversal. CI never bootstraps. The store's lease plus a per-stack
   CI concurrency group (`alchemy-<stack>-prod`, `cancel-in-progress: false`) serialize prod.
5. **Credentials.** Full per-provider env contract under `op run` (AWS session vars via aws-vault
   locally, OIDC role in CI; `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`; `GITHUB_TOKEN` from the
   GitHub App mint). Never `alchemy profile`, `--profile`, `Test.make({ profile })`, `.env` or
   `Secrets.DotEnv`. Preflight with `alchemy provider check-env`.
6. **CI deploy invocation.**
   `bunx alchemy deploy --stage prod --yes --config <path> --log-format json`. `cancel-in-progress`
   is false. Prod destroy is never automatic; PR cleanup jobs carry a prod guard.
7. **Agent safety.** Agents run `plan`/`drift`, and `deploy`/`destroy` only on `live_*`/`test_*`
   stages. Stacks guard `prod` with `Config.Literal("true", "CI")`. Bare `alchemy state` (TUI) is
   never run without a TTY.
8. **Verification gates.** `plan` exit codes prove nothing, so parse plan output for "no changes".
   Run `drift --stage prod` on a schedule and alert on exit 2. GitHub secrets re-upload on every
   deploy, so the "plan no-op" acceptance needs a carve-out or a real check for `@beep/infra-github`.
9. **Phases.** Lambda and Worker constructors only bind and read `Config.Redacted`, never call cloud
   APIs (they run on every plan). Runtime handlers never `yield*` a `Config` that Construction has
   not already yielded.
10. **Bindings and sinks.** Use the shipped bindings, for example `AWS.SQS.QueueSink` +
    `QueueSinkHttp`/`SendMessageBatchHttp` and the event-source Layers, instead of SDK calls plus env vars.
    Tag/`.make` splits only for real cycles.
11. **Telemetry.** One `Alchemy.Telemetry.layerOtlp` per Function/Worker to the operator collector,
    with a stable `serviceName`. Alarms and monitors are declared in the same stack. For the CLI's
    own usage telemetry, decide whether to set `ALCHEMY_TELEMETRY_DISABLED=1` or `DO_NOT_TRACK=1` in
    CI (source: `packages/alchemy/src/Telemetry/Attributes.ts:122-123`; the docs only mention it at
    `cli/index.mdx:105`) and record the decision.
12. **References.** Cross-stack data only through typed handles with a declared stage union, pinned
    with `.stage.prod`. Deploy order follows the SPEC cutover order and destroy runs in reverse.
    `InvalidReferenceError` is the expected failure for an out-of-order deploy. `Resource.lookup` only
    for objects that stay unmanaged.
13. **Custom providers.** Follow the shape in `custom-provider.mdx`:
    - `Resource<"Ns.Type", Props, Attrs>` + `Resource<X>("Ns.Type")`
    - `Provider.succeed(X, X.Provider.of({...}))`
    - `Provider.ProviderCollection` + `providers()`, with namespaced barrel exports
    - observe/ensure/sync `reconcile`, idempotent `delete` (404 counts as success)
    - `diff` guarded by `isResolved`
    - `read` with `Unowned` branding
    - exhaustive `list` (or `nuke.singleton`)
    - a `test.provider` lifecycle suite

    Add our deltas: schema-first props, `Effect.fn`, `@distilled.cloud/*` typed errors, `Config`.
14. **Adoption.** Greenfield by default (D12). `--adopt` only for the `BeepEffectWeb` store move (D6)
    and for the repo-unique GitHub objects (rulesets, labels, the repository itself, which adopts
    silently). Each use follows a reviewed `plan --adopt --detailed` and gets a decision file.
15. **Removal policy.** `RemovalPolicy.retain(stage === "prod")` on every irreplaceable resource from
    its first PR. Remember that `Command.Exec` and `Docker.Container` deletes do not undo host
    side effects, and container replacement is delete-first.
16. **Hosts.** `Docker.Context("dankserver", { docker: "host=ssh://..." })` is threaded as `context`
    through every Docker resource. Use `Docker.Container`, not `Docker.Service`, unless a swarm is
    declared. Narrow `Command.Exec` `memo.include` for OpenClaw. Hosts deploys likely need a
    non-CI exception, because SSH runs over the YubiKey route.
17. **Inspection.**
    - `alchemy state list` / `state list <Stack>/<stage>` / `state read <path> -r | jq` with `--config`
      under `op run`. Never paste `state read` output, because it unwraps redacted values.
    - Recovery ladder: `state delete`, then `deploy`, then `deploy --adopt`.
    - Before any prod `state delete`, export the state outside the repo.

## Sources

Checkout files (`~/YeeBois/references/effect/alchemy/website/src/content/docs/`, at
`v2.0.0-beta.85-48-g17fb76f4f`):

- `project-structure/monorepo.mdx`, `project-structure/monorepo-multi-stack.mdx`,
  `project-structure/monorepo-single-stack.mdx`, `project-structure/file-layout.mdx`
- `testing/index.mdx`, `testing/observability.mdx`, `testing/test-harness.mdx`,
  `testing/testing-providers.mdx`, `testing/testing-a-stack.mdx`
- `environments/ci.mdx`, `environments/worktrees.mdx`, `environments/local-development.mdx`,
  `environments/stages.mdx`, `environments/secrets.mdx`, `environments/secret-providers.mdx`,
  `environments/profiles.mdx`
- `infrastructure-as-effects/telemetry.mdx`, `infrastructure-as-effects/circular-bindings.mdx`,
  `infrastructure-as-effects/phases.mdx`, `infrastructure-as-effects/sinks.mdx`
- `infrastructure-as-code/custom-provider.mdx`, `infrastructure-as-code/provider.mdx`,
  `infrastructure-as-code/references.mdx`, `infrastructure-as-code/resource-lifecycle.mdx`,
  `infrastructure-as-code/outputs.mdx`, `infrastructure-as-code/renaming.mdx`,
  `infrastructure-as-code/resource.mdx`, `infrastructure-as-code/stack.mdx`
- `command/index.mdx`, `command/what-is-command.mdx`, `command/memoization.mdx`,
  `command/dev-servers.mdx`
- `docker/index.mdx`, `docker/setup.mdx`, `docker/what-is-docker.mdx`, `docker/local-services.mdx`,
  `docker/build-and-push.mdx`, `docker/swarm.mdx`
- `github/index.mdx`, `github/setup.mdx`, `github/accounts-and-tokens.mdx`,
  `github/what-is-github.mdx`, `github/repository.mdx`, `github/actions-config.mdx`,
  `github/events.mdx`
- `state-store/index.mdx`, `state-store/custom-state-store.mdx`
- `cli/index.mdx`, `cli/state.mdx`, `cli/inspecting-state.mdx`, `cli/adopting-resources.mdx`,
  `cli/drift.mdx`, `cli/plan.mdx`, `cli/deploy.mdx`, `cli/aws.mdx`
- `blog/2026-11-01-beta-85.mdx:64`, `blog/2026-09-17-beta-78.md:417-430` (Ruleset mentions)
- `~/YeeBois/references/effect/alchemy/website/scripts/generate-llms-txt.ts`,
  `website/astro.config.ts:72` (providers reference is generated)

Checkout source files (`~/YeeBois/references/effect/alchemy/packages/`):

- `aws/src/StateStore/Store.ts` (`state()` doc and backend switch), `aws/src/StateStore/State.ts`,
  `aws/src/StateStore/DynamoDBState.ts` (lease lock)
- `alchemy/src/State/BucketState.ts` (S3 lease, `makeBucketState`)
- `alchemy/src/AdoptPolicy.ts:203-214`
- `alchemy/src/Telemetry/Attributes.ts:122-131`, `alchemy/src/Telemetry/Layer.ts:49-50`
- `docker/src/Context.ts:9-62`, `docker/src/Container.ts:25-26`, `docker/src/Volume.ts:31-32`
- `github/src/` listing (`Ruleset.ts`, `Label.ts`, `BranchProtection.ts`, `Environment.ts`,
  `Webhook.ts`, `Secret.ts`, `Variable.ts`)
- git: `1e5fbafec` (DynamoDB default, in `v2.0.0-beta.85`), `021002c19` (`Cloudflare.state` takes
  `workerName`, in beta.85), `1723adef5` (`--domain`, untagged)

Repo files:

- `goals/infra-alchemy-rebuild/SPEC.md`, `goals/infra-alchemy-rebuild/research/SOURCES.md`
- `apps/beep-effect-web/alchemy.run.ts`

Live URLs (fetched 2026-11-06):

- https://alchemy.run/llms.txt (and its pointer to https://alchemy.run/llms-full.txt)
- https://alchemy.run/state-store/
- https://alchemy.run/cli/state/
- https://alchemy.run/environments/stages/
- https://alchemy.run/infrastructure-as-code/stack/
- https://alchemy.run/providers/github/ruleset
- https://alchemy.run/providers/github/label

Pages cited by URL only (from the checkout, not fetched live): every `https://alchemy.run<path>`
named in the section headings above.
