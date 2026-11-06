# t3code production Alchemy stacks: patterns for beep-effect (2026-11-06)

P0 research report for `goals/infra-alchemy-rebuild`. It covers the two production Alchemy
stacks in the t3code checkout, `infra/relay` (`T3CodeRelay`) and `infra/task-cache`
(`T3TaskCache`), and the GitHub workflows that deploy them. Each pattern ends with a verdict
for beep-effect: **Copy**, **Adapt** or **Avoid**, with a one-line reason tied to the packet's
constraints (SPEC "Constraints": one S3 `BucketState` store, prod only from CI, `op run`
credentials, Effect-first repo laws, `@alchemy.run/test` harness, greenfield D12).

- t3code checkout: `~/YeeBois/references/effect/t3code` at
  `6577c6b6185167c0e502fa01f9e8e8f2dee6ff25` (2026-11-06 03:11:59 -0800).
- Alchemy reference checkout (used only to check `AWS.state()` and `BucketState`):
  `~/YeeBois/references/effect/alchemy` at `17fb76f4f`, tag `v2.0.0-beta.85`.
- Pins (t3code `pnpm-workspace.yaml:32-36,70`): `alchemy`, `@alchemy.run/axiom`,
  `@alchemy.run/cloudflare`, `@alchemy.run/drizzle`, `@alchemy.run/planetscale` and
  `@alchemy.run/test` are all `2.0.0-beta.85`, the same version beep-effect pins today.
  `@distilled.cloud/cloudflare` is `1.0.0-rc.18`, with a comment that it "Must match the version
  alchemy depends on: the relay overrides its Cloudflare retry policy through this package's
  Retry service" (`pnpm-workspace.yaml:44-46`).
- Patches on those pins (`pnpm-workspace.yaml:232,265-266`) are covered in
  [`t3code-alchemy-patches.md`](./t3code-alchemy-patches.md) and are not repeated here.

Citations use `infra/relay/<file>:<line>`, `infra/task-cache/<file>:<line>` and
`.github/workflows/<file>:<line>`, all relative to the t3code checkout.

## 1. Package file layout

```
infra/relay/                         infra/task-cache/
  alchemy.run.ts   (stack entry)       alchemy.run.ts
  package.json     (t3code-relay)      package.json   (@t3tools/task-cache)
  tsconfig.json                        tsconfig.json
  README.md                            README.md
  .env.example                         install.sh     (3-line exec of scripts/install.ts)
  src/  worker.ts db.ts zone.ts        src/  worker.ts resources.ts observability.ts
        observability.ts monitoring.ts       deploymentConfig.ts WriterRegistry.ts ...
        previewTunnelSweep.ts               *.test.ts beside each module
        previewStages.ts deploymentConfig.ts
        clientConfig.ts Config.ts queues.ts
        <domain dirs>/ (http, auth, ...)
        *.test.ts beside each module
  scripts/  tunnel-census.ts ...       scripts/  manage.ts smoke.ts install.ts install-ci.ts
  migrations/postgres/<ts>_<name>/     migrations/savings/000N_*.sql
                                       vendor/vite-plus-remote-cache-cloudflare/ (pinned upstream)
                                       types/upstream.d.ts
```

- The stack entry is `alchemy.run.ts` at the package root, and it is in the `include` list of
  `tsconfig.json` (`infra/relay/tsconfig.json:7`, `infra/task-cache/tsconfig.json:8`), so the stack
  is typechecked like the rest of the package.
- Infrastructure (resource declarations) and Worker runtime code share one package. The Worker
  module's default export is the runtime layer that Alchemy's generated entry imports
  (`infra/task-cache/src/worker.ts:116-117`, `infra/relay/src/worker.ts:590`).
- Package scripts are thin CLI wrappers: `"deploy": "alchemy deploy"` and
  `"destroy": "alchemy destroy"` (`infra/relay/package.json:6,10`); the task cache hardcodes
  `"deploy": "alchemy deploy --stage prod"` (`infra/task-cache/package.json:9`).
- Shared resource declarations get their own module (`src/resources.ts`, `src/queues.ts`,
  `src/db.ts`, `src/zone.ts`, `src/observability.ts`), and `alchemy.run.ts` only composes them.

**Verdict: Adapt.** Keep `alchemy.run.ts` at the package root, typechecked, with resource
modules under `src/`. Scaffold through `bun run beep create-package` so the scripts block is
generated, and put tests under `test/`, not beside each module.

## 2. `alchemy.run.ts` structure

### 2.1 Stack, providers, state

```ts
export default Alchemy.Stack(
  "T3CodeRelay",
  {
    providers: Layer.mergeAll(
      Axiom.providers(),
      Cloudflare.providers(),
      Drizzle.providers(),
      Planetscale.providers(),
      PreviewTunnelSweepProvider(),
    ),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () { ... }).pipe(Effect.provide(RelayWorker.layer)),
);
```
(`infra/relay/alchemy.run.ts:19-30,82`)

```ts
export default Alchemy.Stack(
  "T3TaskCache",
  {
    providers: Axiom.providers().pipe(Layer.provideMerge(Cloudflare.providers())),
    state: Cloudflare.state(),
    secrets: [Secrets.DotEnv(), Secrets.ProcessEnv(), WriterSecrets],
  },
  Effect.gen(function* () { ... }).pipe(Effect.provide(Worker.layer), adopt(true)),
);
```
(`infra/task-cache/alchemy.run.ts:12-18,27`)

- The stack name is PascalCase and unique (`T3CodeRelay`, `T3TaskCache`), and it becomes the
  state key prefix (`T3CodeRelay/prod/output`, `.github/workflows/release.yml:443`).
- `providers` is a single merged `Layer`, and a custom provider layer is just one more member of
  that merge (`infra/relay/alchemy.run.ts:27`).
- The program body yields resources, which are Effects, and returns a plain record of outputs.
  The record mixes `Output` values with `Redacted` tokens (`infra/relay/alchemy.run.ts:62-81`).
- The first line of the file turns off two Effect diagnostics:
  `// @effect-diagnostics anyUnknownInErrorContext:off layerMergeAllWithDependencies:off - Alchemy provider helpers expose framework-owned any requirements.`
  (`infra/relay/alchemy.run.ts:1`).

**Verdict (Stack/providers shape): Copy.** It matches `apps/beep-effect-web/alchemy.run.ts:25-30`
already. A custom provider is merged into `providers` exactly as here.
**Verdict (diagnostics header): Adapt.** Expect the same two `tsgo` diagnostics on our stacks.
Suppress them per file with the reason text and list them in the packet's exception ledger, not
repo-wide.

### 2.2 State store

Both stacks use `Cloudflare.state()`. The task-cache README says "Alchemy stores deployment state
remotely with `Cloudflare.state()`" (`infra/task-cache/README.md:11`). Our own
`apps/beep-effect-web/alchemy.run.ts:33-35` records that the Cloudflare store "has no stage
lock", which is why we gate `prod` on `CI`.

What this means for D6 (one AWS S3 `BucketState`), checked against the alchemy tag
`v2.0.0-beta.85`:

- `AWS.state()` **defaults to DynamoDB**. The S3 store is selected only when
  `backend: "s3"` or one of `bucketName`, `prefix` or `encryption` is set:
  ```ts
  const usesS3 = (options: StateOptions) =>
    options.backend === "s3" ||
    (options.backend === undefined &&
      (options.bucketName !== undefined || options.prefix !== undefined || options.encryption !== undefined));
  export const state = (options: StateOptions = {}) =>
    usesS3(options) ? s3State(options) : dynamoDBState(options);
  ```
  (`packages/aws/src/StateStore/Store.ts:23-28,117-118` at `v2.0.0-beta.85`; the default came from
  `1e5fbafec feat(aws)!: DynamoDB is the default AWS.state() ...`).
- `BucketState` keeps a per `(stack, stage)` lease object, `{prefix}{stack}/{stage}/__lease__.json`,
  written with conditional puts: "The second deploy fails immediately instead of mixing rows"
  (`packages/alchemy/src/State/BucketState.ts:21-29` at `v2.0.0-beta.85`). The S3 store therefore
  has the lock that the Cloudflare store lacks.

**Verdict: Avoid** `Cloudflare.state()`, because D6 names AWS S3. **Adapt:** every stack must call
`AWS.state({ backend: "s3", bucketName: <new bucket> })` with the bucket set explicitly, or it
silently gets DynamoDB. Keep the CI-only `prod` guard anyway: the lease stops concurrent
deploys, but it does not stop an unreviewed local deploy.

### 2.3 Stage handling

- Stages in use: `prod` (shared), `dev_$USER` (the Alchemy default for personal deploys,
  `infra/relay/README.md:104`) and `pr-<n>` (previews, `.github/workflows/relay-preview.yml:30`).
- Stage-dependent behaviour is a pure function of `stage`, read with
  `const { stage } = yield* Alchemy.Stack` (`infra/relay/alchemy.run.ts:32`,
  `infra/relay/src/db.ts:39`):
  ```ts
  export function relayDatabaseMode(stage: string): RelayDatabaseMode {
    return stage === "prod" ? "shared-database" : "stage-branch";
  }
  ```
  (`infra/relay/src/dbConfig.ts:3-5`)
- Preview stages are recognised by an anchored pattern, so destroy jobs cannot reach `prod`:
  `const PREVIEW_STAGE_PATTERN = /^pr-[1-9][0-9]*$/u;` (`infra/relay/src/previewStages.ts:8`).
- Physical names repeat Alchemy's stage sanitisation, so that names created at runtime line up
  with names Alchemy creates (`infra/relay/src/deploymentConfig.ts:55-66`, comment "Match
  Alchemy's post-stage name sanitization"). Names for `prod` drop the suffix:
  `stage === "prod" ? "t3-task-cache" : \`t3-task-cache-${stage}\``
  (`infra/task-cache/src/resources.ts:12`).
- **Ownership by stage.** `prod` owns shared resources, and every other stage takes a `.ref`
  pinned to `prod`:
  ```ts
  : yield* Planetscale.PostgresDatabase.ref("RelayPostgresDatabase", { stage: "prod" });
  ```
  (`infra/relay/src/db.ts:56-58`; the same pattern for DNS zones at `infra/relay/src/zone.ts:54-59`).
- There is no guard in code against a local `prod` deploy. t3code relies on the workflow
  (`.github/workflows/deploy-relay.yml:29`), and the task cache is deployed `prod` from a
  maintainer laptop (`infra/task-cache/README.md:13-16`).

**Verdict (stage predicates as pure functions, anchored preview pattern): Copy.** It is cheap
and it is safe for teardown. Model them as a `LiteralKit`/schema-checked stage domain instead of
bare regex helpers.
**Verdict (`.ref(..., { stage: "prod" })` for shared singletons): Copy.** It fits the hosted
zone, the VPC and the state bucket, where personal stages must not create duplicates.
**Verdict (no in-code prod guard): Avoid.** Keep our `Config.Literal("true", "CI")` guard from
`apps/beep-effect-web/alchemy.run.ts:36-38` in every stack.

## 3. Custom provider: `PreviewTunnelSweep`

Purpose (`infra/relay/src/previewTunnelSweep.ts:15-17`):

> Managed endpoint tunnels and their CNAMEs are created by the Worker at runtime, so Alchemy
> never tracks them and `alchemy destroy` leaves them behind. This resource exists only so its
> delete runs during a preview stage's destroy.

### 3.1 Resource declaration

```ts
export interface PreviewTunnelSweepProps {
  readonly stage: string;
  readonly tunnelZoneName: string;
  // Depending on the Worker makes Alchemy delete this sweep before the Worker,
  // because dependents go first. ...
  readonly workerName: string;
}
export interface PreviewTunnelSweepAttributes { readonly stage: string; readonly tunnelZoneName: string; readonly workerName: string; }
export type PreviewTunnelSweep = Resource<
  "T3CodeRelay.PreviewTunnelSweep",
  PreviewTunnelSweepProps,
  PreviewTunnelSweepAttributes
>;
export const PreviewTunnelSweep = Resource<PreviewTunnelSweep>("T3CodeRelay.PreviewTunnelSweep");
```
(`infra/relay/src/previewTunnelSweep.ts:19-40`)

- The type name and the value constructor share one identifier. The type id is namespaced
  `<Stack>.<Resource>`.
- `workerName` is a prop only to create a dependency edge, which sets the delete order
  (dependents are deleted first).

### 3.2 Provider layer

```ts
export const PreviewTunnelSweepProvider = () =>
  Provider.succeed(
    PreviewTunnelSweep,
    PreviewTunnelSweep.Provider.of({
      reconcile: ({ news }) =>
        Effect.succeed({ stage: news.stage, tunnelZoneName: news.tunnelZoneName, workerName: news.workerName }),
      // Nothing in Cloudflare is created for this resource, so there is nothing to list.
      list: () => Effect.succeed([]),
      delete: Effect.fn(function* ({ output }) {
        if (!isPreviewStage(output.stage)) {
          return yield* Effect.die(`Refusing to sweep non-preview stage '${output.stage}'`);
        }
        const accountId = yield* Config.String("CLOUDFLARE_ACCOUNT_ID");
        const token = yield* Config.Redacted("CLOUDFLARE_API_TOKEN");
        yield* sweepPreviewStage({ stage: output.stage, tunnelZoneName: output.tunnelZoneName, accountId, token })
          .pipe(Effect.provide(FetchHttpClient.layer));
      }),
    }),
  );
```
(`infra/relay/src/previewTunnelSweep.ts:153-183`, condensed)

### 3.3 Lifecycle methods: what exists in beta.85

The task brief asks about create/update/delete/read/diff. In `2.0.0-beta.85` the provider
contract (`node_modules/alchemy/lib/Provider.d.ts`) is:

| Method | Required | Role (from the `.d.ts` doc comments) | Used by the sweep |
| --- | --- | --- | --- |
| `reconcile` | yes | "replaces the previous `create` and `update` pair"; must handle `output`/`olds` undefined (create), `output` set and `olds` unset (adopted), both set (update) | yes, echoes props as attributes |
| `delete` | yes | "Idempotent; fail with `DeleteInProgress` when the cloud cannot finish the delete yet" | yes, does the real work |
| `list` | yes | enumerate for `nuke`; "should return an empty array rather than throwing" when nothing is enumerable | yes, `[]` |
| `read` | optional | report existing/owned/`Unowned` for adoption | no |
| `diff` | optional | return a `Diff` (update vs replace) | no |
| `observe`, `precreate`, `stables`, `tail`, `logs` | optional | cycle handling, stable attrs, logs | no |

So there is no separate create or update. The sweep is a degenerate resource: `reconcile` has
no side effects, and `delete` is the payload.

### 3.4 Registration and use

The provider is registered by merging it into `providers`
(`infra/relay/alchemy.run.ts:27`). The resource is declared only on preview stages:

```ts
if (isPreviewStage(stage)) {
  const { managedEndpointZoneName } = yield* RelayDeploymentConfig;
  yield* PreviewTunnelSweep("PreviewTunnelSweep", { stage, tunnelZoneName: managedEndpointZoneName, workerName: api.workerName });
}
```
(`infra/relay/alchemy.run.ts:40-47`)

### 3.5 The delete body (`sweepPreviewStage`)

- It is an `Effect.fn("PreviewTunnelSweep.sweep")` over `HttpClient.HttpClient`, with response
  bodies decoded by `Schema.Struct` codecs (`infra/relay/src/previewTunnelSweep.ts:45-59,73-89`).
- It is idempotent, and a 404 counts as success:
  "A 404 means the object is already gone ... Any other failure, including 429, fails the step
  so the next run retries it" (`infra/relay/src/previewTunnelSweep.ts:90-101`).
- Order matters: DNS records go before tunnels, and a tunnel's connections go before the tunnel
  (`infra/relay/src/previewTunnelSweep.ts:140-150`).
- Target selection is a pure function: a record is deleted only when its CNAME points at one of
  this stage's tunnels (`infra/relay/src/previewStages.ts:54-74`).
- Credentials come from `Config`, not from the Cloudflare provider service, "so the provider
  needs no extra service in its layer" (`infra/relay/src/previewTunnelSweep.ts:171-174`).

**Verdict (Resource + `Provider.succeed` + `.Provider.of` + merge into `providers`): Copy.** This
is the shape `@beep/alchemy-vercel`, `@beep/alchemy-aws-extras` and `@beep/alchemy-github-runners`
should use. Real resources must also implement `read` (for adoption and drift), `diff` (for
replacement), a real `list`, and an idempotent `reconcile`.
**Verdict (delete-only "sweep" resource for objects created at runtime): Copy for the runner
fleet.** The scale-up Lambda creates EC2 instances and GitHub runner registrations outside
Alchemy state, so a `RunnerSweep` resource that depends on the Lambda can terminate and
deregister them on `destroy`, with the same non-prod refusal guard.
**Verdict (credentials via `Config.String`/`Config.Redacted` inside `delete`): Adapt.** Use it,
but read the same env names that `op run` injects. Prefer the provider's environment service
when the resource already depends on that provider.
**Verdict (code style inside the sweep): Avoid** as written: `for` loops with `Array.push`,
`new Set` (`infra/relay/src/previewStages.ts:66`) and plain `interface` props break our laws.
Use `effect/Array`, `HashSet`, and schema-declared props and attributes.

## 4. Secrets and configuration

### 4.1 `Secrets.DotEnv` / `Secrets.ProcessEnv` (task cache only)

`secrets: [Secrets.DotEnv(), Secrets.ProcessEnv(), WriterSecrets]`
(`infra/task-cache/alchemy.run.ts:17`). From `alchemy/lib/Secrets/*.d.ts` at beta.85:

- `DotEnv` "Add[s] dotenv files to Effect's ConfigProvider without touching `process.env`". A
  missing `.env` is ignored when no path is given, and a callback can pick files by stage.
- `ProcessEnv` "is implicit: every stack ends its `secrets` list with the shell, so a variable
  exported in the terminal or by CI overrides every provider".
- Later list entries win over earlier ones.

The relay declares no `secrets` and relies on the CLI's default dotenv loading: "Alchemy loads
that file from the relay directory" (`infra/relay/README.md:88-89`).

**Verdict: Avoid** `Secrets.DotEnv` for beep-effect. `op run --env-file` resolves `op://`
references into the process environment, and `DotEnv` would read the unresolved `op://` strings
from disk. Rely on the implicit `ProcessEnv`. If a stack lists `secrets`, set
`Secrets.DotEnv` aside and put no ciphertext or `.env` in the repo.

### 4.2 Custom secrets source via `ConfigProvider.layerAdd`

```ts
// An absent registry must fail deployment rather than revoke every existing writer.
export const WriterSecrets = ConfigProvider.layerAdd(
  Effect.gen(function* () {
    const configured = yield* Config.Redacted("DEVELOPER_KEYS").pipe(Config.option);
    ...
    return ConfigProvider.fromUnknown({ ...readerKeys, DEVELOPER_KEYS: yield* encodeWriters(...) });
  }),
);
```
(`infra/task-cache/src/deploymentConfig.ts:15-38`)

The stack derives a Worker secret (a JSON map of writer-token digests) from a private file in
`~/.config/t3-task-cache/`, unless an env var overrides it. The design fails closed: a missing
registry fails the deploy instead of revoking every writer.

**Verdict: Adapt** for `@beep/infra-turbo-cache` per-team tokens. Keep the fail-closed
`ConfigProvider.layerAdd` entry, but source the registry from an `op://` reference injected by
`op run`, never from `$HOME`. A `$HOME` file cannot exist on the CI runner that does prod
deploys.

### 4.3 `Config` and `Redacted` at the resource boundary

- Plain and optional values: `Config.NonEmptyString("RELAY_API_ZONE_NAME")` and
  `Config.String("RELAY_DOMAIN").pipe(Config.option, ...)` (`infra/relay/src/zone.ts:24-34`).
- Schema-checked values: `Config.schema(RelayConfiguration.ApnsEnvironment, "APNS_ENVIRONMENT")`
  (`infra/relay/src/worker.ts:147`), and a literal domain with a default plus
  `Config.mapEffect(decode)` (`infra/relay/src/Config.ts:18-27`).
- Secrets: `Config.Redacted("CLERK_SECRET_KEY")` and `Config.Redacted("APNS_PRIVATE_KEY")`
  (`infra/relay/src/worker.ts:151,164`), handed to the Worker's runtime configuration layer
  as `Redacted` (`infra/relay/src/worker.ts:228-250`).
- Feature flags with defaults: `Config.Boolean("APNS_ENABLED").pipe(Config.withDefault(true))`
  (`infra/relay/src/worker.ts:144`).
- Generated secrets: `Alchemy.KeyPair("CloudMintKeyPair")` and
  `Alchemy.makeRandom("ApnsDeliveryJobSigningSecret", { bytes: 32 })`
  (`infra/relay/src/worker.ts:109-112`). Both are state-owned, so they stay stable across deploys.

**Verdict (Config/Redacted at the boundary, `Config.schema` for literal domains): Copy.** It is
already Effect-native and works unchanged with `op run`.
**Verdict (`Alchemy.makeRandom` / `Alchemy.KeyPair`): Copy.** Use them for the runner webhook
secret and cache signing keys instead of hand-minting values in 1Password.

### 4.4 Rotation-visible digest for Redacted inputs

```ts
/** Alchemy hashes JSON inputs; Redacted hides token rotation, so hash the tokens without persisting secrets. */
readonly tokenDigest: string;
```
(`infra/relay/src/clientConfig.ts:22`, computed with `node:crypto` sha256 at
`infra/relay/src/clientConfig.ts:92-93`)

**Verdict: Adapt.** Any Action or resource that takes a `Redacted` input needs a digest prop, or
a rotation is invisible to the diff. Compute it with `effect/crypto/Digest`, which the relay
itself uses elsewhere (`infra/relay/src/environments/ManagedEndpointProvider.ts:8`), not with
`node:crypto`.

### 4.5 Reading stack outputs without provider credentials

```sh
npx alchemy state read T3CodeRelay/prod/output --backend cloudflare --log-level error --no-input | sed -n '/^{/,$p'
```
(`.github/workflows/release.yml:443`). The comment says to "Select the backend explicitly to
avoid loading the stack's unrelated provider credentials", and notes that Redacted outputs are
persisted as `{"__redacted__": "<value>"}`, which the job unwraps with `jq` and masks with
`::add-mask::` (`.github/workflows/release.yml:432-451`). `scripts/manage.ts` does the same from
Effect with `ChildProcess.make` (`infra/task-cache/scripts/manage.ts:29-46`).

**Verdict: Copy** for CI jobs that need a stack output, such as the turbo-cache URL for
`heavy.yml` enrolment or the runner webhook URL for `@beep/infra-github`. Verify the S3 backend
flag value against the beta.85 CLI before relying on it. Note that Redacted outputs are stored
**in plaintext** in the state bucket, so the bucket needs KMS encryption and tight IAM.

### 4.6 `Alchemy.Action` writing outputs to the repo `.env`

`PublishClientConfig = Alchemy.Action("PublishClientConfig", ...)` writes the deployed URL and
tokens into the repository-root `.env`. It reruns only when its inputs change, and in CI an env
var redirects the target to `$RUNNER_TEMP` (`infra/relay/src/clientConfig.ts:95-117`,
`.github/workflows/deploy-relay.yml:73-75`).

**Verdict: Avoid** writing secrets to a repo `.env`, because our credentials live in 1Password.
**Adapt** the `Alchemy.Action` primitive itself for side effects that run after a deploy, such
as publishing a non-secret output to a GitHub Actions variable.

## 5. Observability with Axiom

Resources (relay, `infra/relay/src/observability.ts:31-116`; task cache,
`infra/task-cache/src/observability.ts:39-53,254-304`):

- `Axiom.Dataset` per signal, with `kind: "otel:traces:v1"` / `"otel:logs:v1"` /
  `"otel:metrics:v1"` and `retentionDays: 30` (`infra/relay/src/observability.ts:33-39,66-79`).
- `Axiom.ApiToken` per producer, scoped to ingest on one dataset through `Output.map`:
  ```ts
  datasetCapabilities: Output.map(traces.name, (dataset) => ({ [dataset]: { ingest: ["create" as const] } })),
  ```
  (`infra/relay/src/observability.ts:41-47`). Separate tokens for the Worker, mobile and
  client mean one can rotate without breaking the others.
- `Axiom.View` holds saved APL queries (`infra/relay/src/observability.ts:96-101`), and
  `Axiom.Dashboard` gets a JSON spec whose charts and layout are computed from the dataset name
  (`infra/relay/src/monitoring.ts:383-407`).
- `Axiom.Monitor` threshold monitors are generated from a typed table that records thresholds,
  the healthy baseline and a runbook link (`infra/relay/src/monitoring.ts:34-55,367-381`).
- Paging is opt-in per deployment:
  ```ts
  const page = yield* notifierConfig("RELAY_ALERT_NOTIFIER_ID");
  if (Option.isNone(page)) return;
  ```
  (`infra/relay/src/monitoring.ts:360-361`). Non-prod stages get a `[stage]` name prefix
  (`infra/relay/src/monitoring.ts:369`). `.env.example` explains: "unset creates neither, so
  personal stages never page anyone" (`infra/relay/.env.example:18-23`).

Telemetry wiring: the Worker runtime gets an Axiom OTLP exporter built from the stack's own
resources, and Alchemy's duplicate HTTP span is turned off:

```ts
Layer.provideMerge(Alchemy.Telemetry.layer(Layer.succeed(HttpMiddleware.TracerDisabledWhen)(() => true))),
Layer.provideMerge(
  Layer.unwrap(Effect.map(RelayObservability, (observability) =>
    Axiom.Telemetry({ serviceName: "t3code-relay", token: observability.workerIngestToken, traces: observability.traces }),
  )),
),
```
(`infra/relay/src/worker.ts:570-584`; task cache `infra/task-cache/src/worker.ts:108-112`)

The CLI's own telemetry is disabled in every workflow with `ALCHEMY_TELEMETRY_DISABLED: "1"`
(`.github/workflows/deploy-relay.yml:51`).

**Verdict (Axiom resources): Avoid** for now. Axiom is a new paid service and needs the
operator. Our monitoring is Grafana and CloudWatch.
**Verdict (alarm-as-code from a typed threshold table, gated by a notifier env var so non-prod
stages never page): Copy.** Apply it to the turbo-cache throttle and error-rate alarm (D7) with
CloudWatch or Cloudflare analytics resources.
**Verdict (`ALCHEMY_TELEMETRY_DISABLED=1` in CI): Copy.**
**Verdict (one ingest token per producer, built from stack outputs): Copy** for any token we mint.

## 6. `adopt(true)` and `retain()`

- Production DNS zones are adopted, because they existed before the stack. Other stages only
  reference them:
  ```ts
  ? Cloudflare.Zone.Zone("ManagedEndpointZone", { name: managedEndpointZoneName }).pipe(adopt(true))
  : Cloudflare.Zone.Zone.ref("ManagedEndpointZone", { stage: MANAGED_ENDPOINT_ZONE_OWNER_STAGE }).pipe(...)
  ```
  (`infra/relay/src/zone.ts:50-59,68`). The README states: "Production adopts the configured API
  and tunnel DNS zones as retained Cloudflare resources" (`infra/relay/README.md:90-92`).
- The task cache applies `adopt(true)` to the **whole stack program**
  (`infra/task-cache/alchemy.run.ts:27`) and to each pre-existing store
  (`infra/task-cache/src/resources.ts:20,35`). The README says the stack "adopts the existing
  resources and preserves their data and repository authorization policy"
  (`infra/task-cache/README.md:3`). The new stores (`NativeClients`, `Savings`) use only `retain()`
  (`infra/task-cache/src/resources.ts:51,60`).
- What adoption means at beta.85 (`alchemy/lib/AdoptPolicy.d.ts`): when `read` finds an
  `Unowned` resource, `adopt: false` fails with `OwnedBySomeoneElse` and `adopt: true` takes it
  over. Owned or ownership-less resources are adopted silently either way.
- `RemovalPolicy.retain()` on data-bearing resources (the PlanetScale database at
  `infra/relay/src/db.ts:55`, D1 and R2 at `infra/task-cache/src/resources.ts:20,35,51,60`).
  Non-prod buckets get `forceDestroy: stage !== "prod"`, because "R2 refuses to delete a
  non-empty bucket, which would half tear down every non-prod stage"
  (`infra/relay/src/observability.ts:90-94`).
- Workaround to note: `Resource.ref` returns a lazy proxy without a `LogicalId`, so the relay
  wraps it in a hand-written `Proxy` for DNS policies (`infra/relay/src/zone.ts:14-20,57-58`).

**Verdict (stack-wide `adopt(true)`): Avoid.** D12 is greenfield under new names, and a blanket
adopt would silently take over Pulumi-owned resources during the side-by-side cutover.
**Verdict (per-resource `adopt(true)` for things that must pre-exist): Adapt.** The GitHub
repository in `@beep/infra-github`, the `beep-effect.com` and `oip.law` zones, and the move of
`BeepEffectWeb` into the S3 store (D6) cannot be greenfield. Record each adopt as a decision
file.
**Verdict (`retain()` on data and `forceDestroy` off-prod): Copy** for the state bucket, cache R2
bucket and flow-log buckets.
**Verdict (`withLogicalId` Proxy hack): Avoid.** If we hit this, fix it upstream or carry it as a
recorded patch.

## 7. Drizzle and PlanetScale bindings and migrations

- The schema is a resource. `Drizzle.Schema` generates migrations from the TS schema into a
  directory:
  ```ts
  const schema = yield* Drizzle.Schema("RelaySchema", { schema: "./src/persistence/schema.ts", out: "./migrations/postgres", dialect: "postgres" });
  ```
  (`infra/relay/src/db.ts:40-44`; output under `infra/relay/migrations/postgres/<ts>_<name>/{migration.sql,snapshot.json}`).
- Migrations apply as a resource prop, and per-stage isolation uses branches: `prod` creates
  `Planetscale.PostgresDatabase` with `migrations: { dir: schema.out, table: "relay_migrations" }`
  and `retain()`, and other stages create a `Planetscale.PostgresBranch` off the `prod` database
  ref with the same migrations (`infra/relay/src/db.ts:46-65`).
- A least-privilege runtime role is a resource (`Planetscale.PostgresRole` with inherited
  read/write roles, `infra/relay/src/db.ts:67-71`). Its `origin` feeds
  `Cloudflare.Hyperdrive.Connection` (`infra/relay/src/db.ts:76-85`), and the Worker binds it as
  `Drizzle.Postgres(hyperdrive.connectionString, { client: { prepare: false } })`, with a comment
  on named-statement collisions behind Hyperdrive pooling (`infra/relay/src/worker.ts:179-183`).
- The task cache's D1 databases take `migrations: <dir>` directly on `Cloudflare.D1.Database`
  (`infra/task-cache/src/resources.ts:15-21,55-61`).

**Verdict: Avoid** for this packet (no Postgres or PlanetScale in scope).
**Adapt** the "migrations directory as a resource prop" pattern if the turbo-cache Worker needs a
D1 index for per-team policy. Our current design (Worker + R2) does not need one.

## 8. Scripts and CI deploy flow

### 8.1 Production deploy (`.github/workflows/deploy-relay.yml`)

- Triggers: `push` to `main`, plus `workflow_dispatch` with a `force` boolean that adds `--force`
  ("Redeploy every resource, including ones with no detected changes", lines 3-14, 71).
- One deploy at a time, never cancelled:
  ```yaml
  concurrency:
    group: relay-production
    cancel-in-progress: false
  ```
  (lines 21-23)
- Branch guard: "A manual run from another branch would deploy that branch to production."
  `if: github.repository == 'pingdotgg/t3code' && github.ref == 'refs/heads/main'` (lines 28-29).
- `environment: production` holds the stage-specific variables and secrets (lines 32-33).
  Account-scoped credentials are repository-level (`infra/relay/README.md:128-139`).
- Non-secret config is passed as `vars.*` at job level, and secrets as `secrets.*` only on the
  deploy step (lines 34-51, 76-83).
- Install is filtered to the stack package and its dependencies (`--filter=t3code-relay...`,
  lines 66-68).
- Command: `vp run --filter t3code-relay deploy --stage prod --yes --no-input` (line 71).
- After the deploy, a commit status `Relay deploy / production` is posted (lines 85-97).
- Workflow permissions: `contents: read`, `id-token: none` (lines 16-19). The workflow uses
  long-lived API tokens, not OIDC.

### 8.2 Preview stages (`relay-preview.yml`, `relay-preview-cleanup.yml`)

- A `relay:preview` label on a same-repository PR deploys stage `pr-<n>`, behind the
  `relay-preview` environment's required approval, because "This job runs the PR's own code with
  account credentials" (`.github/workflows/relay-preview.yml:3-6,22-28,30`).
- Per-PR concurrency group `relay-preview-${{ github.event.pull_request.number }}`, shared by
  deploy, teardown and the scheduled retry (`.github/workflows/relay-preview.yml:15-17`,
  `.github/workflows/relay-preview-cleanup.yml:36-38,137-139`).
- Previews disable side effects: `APNS_ENABLED: "false"`, no notifier and no tunnel cleanup
  (`.github/workflows/relay-preview.yml:38-40`).
- Teardown runs under `pull_request_target` from the default branch, so "a PR cannot edit its own
  teardown to reach secrets" (`.github/workflows/relay-preview-cleanup.yml:8-12`). It runs
  `destroy --stage "$STAGE" --yes --no-input`, which also runs the tunnel sweep
  (`.github/workflows/relay-preview-cleanup.yml:78-80`).
- The label doubles as the teardown marker. It is restored after a failed destroy, and a daily
  cron retries closed PRs that still carry it (`.github/workflows/relay-preview-cleanup.yml:1-6,
  90-99,101-123`).

### 8.3 Task cache

The task cache has no deploy workflow. It is deployed `prod` by hand from a maintainer machine
(`infra/task-cache/README.md:9-16`, `infra/task-cache/package.json:9`). CI only consumes a
read-only cache token through `.github/actions/setup-ci-deps` (`.github/workflows/ci.yml:89`). An
admin CLI built on `effect/cli` manages writers and then asks for a redeploy
(`infra/task-cache/scripts/manage.ts:59-77`). The CI hook installer refuses to run outside the
maintainer repository's Actions (`infra/task-cache/scripts/install-ci.ts:7-8`).

**Verdict (prod deploy job: push `main` + `workflow_dispatch` `force`, ref guard, environment,
per-stack concurrency group with `cancel-in-progress: false`, `--yes --no-input`, filtered
install, commit status): Copy.** It is exactly the SPEC's "prod only from `main`, concurrency
group per stack". In our version the deploy step runs `op run --env-file=<stack env> -- bunx
alchemy deploy --stage prod --yes --no-input`, with the `op` service-account token as the only
GitHub secret.
**Verdict (secrets as GitHub secrets): Adapt.** Swap them for `op://` refs resolved by `op run`
on the runner.
**Verdict (label-driven previews with `pull_request_target` teardown and a retry marker): Adapt**
later for Storybook and OIP previews. It is not needed for the platform stacks.
**Verdict (manual laptop prod deploy, as in the task cache): Avoid.** It violates prod-from-CI.
**Verdict (admin CLI in `scripts/` on `effect/cli`): Adapt.** Put it in `beep` commands, not
per-package scripts (`scripts-to-beep-cli` owns that surface).

## 9. Testing

- `@alchemy.run/test` harness with in-memory state and no cloud providers, which tests an Action
  through real deploys, redeploys and failure cases:
  ```ts
  const { test } = Test.make({ providers: Layer.empty, state: inMemoryState() });
  test.provider("writes the env file on deploy and skips an unchanged redeploy", (stack) =>
    Effect.gen(function* () {
      ...
      yield* stack.deploy(PublishClientConfig(clientConfig("v1"))).pipe(configured);
  ```
  (`infra/relay/src/clientConfig.test.ts:2-3,51-54,68-81`). Config is injected with
  `ConfigProvider.layer(ConfigProvider.fromUnknown({...}))` (lines 75-79). The tests cover
  "skips an unchanged redeploy" and the rotation path (`v1` to `v2`, lines 88-95).
- Provider logic is tested without the harness, with a fake `HttpClient` that records every
  request and answers by path:
  ```ts
  const client = HttpClient.make((request) => { ... seen.push(`${request.method} ${url.pathname}`); ... });
  ... .pipe(Effect.provideService(HttpClient.HttpClient, cloudflare.client));
  ```
  (`infra/relay/src/previewTunnelSweep.test.ts:14-52`). The cases cover idempotence, a missing
  zone, a 404 counted as success, and a 429 counted as failure so the next run retries (lines 54-100).
- Pure predicates have plain unit tests (`infra/relay/src/previewStages.test.ts:14-59`,
  `infra/relay/src/deploymentConfig.test.ts:9-32`).
- Tests use `@effect/vitest` `it.effect` (`infra/relay/src/previewTunnelSweep.test.ts:1,55`).
  The harness is patched for vite-plus (see `t3code-alchemy-patches.md`).
- No test deploys to a real cloud account, and no test exercises a real provider's lifecycle
  against `inMemoryState`.

**Verdict (`Test.make({ providers, state: inMemoryState() })` + `test.provider` + `stack.deploy`,
plus a fake `HttpClient` for provider bodies): Copy.** It meets the SPEC's "stack tests on the
`@alchemy.run/test` harness" without credentials. For our custom providers, pass the provider
layer (not `Layer.empty`) and test reconcile, redeploy no-op, and delete.
**Verdict (colocated `src/*.test.ts`, relative imports): Avoid.** Our tests live under `test/` and
import through `@beep/*`.

## 10. Other runtime patterns worth noting

- Per-call retry override on a distilled client:
  `Effect.provideService(CloudflareRetry.Retry, withoutRateLimitRetries)`
  (`infra/relay/src/environments/ManagedEndpointProvider.ts:470-476,519`). This is why the
  catalog pins `@distilled.cloud/cloudflare` to the version alchemy resolves.
  **Verdict: Copy** the pin rule: `@distilled.cloud/vercel` and `@distilled.cloud/aws` must match
  what the pinned `@alchemy.run/*` depends on, or two copies of the `Retry` service tag diverge.
- Worker placement next to its database (`placement: { region: "aws:us-west-2" }`, with the
  latency reason in a comment, `infra/relay/src/worker.ts:124-127`). **Verdict: Adapt** for the
  turbo-cache Worker if the R2 bucket's jurisdiction makes it matter.
- Rate limits, crons and queues declared next to the Worker body
  (`infra/task-cache/src/worker.ts:34-41,80-89`). **Verdict: Copy** for cache GC and
  rate-limiting in `@beep/infra-turbo-cache`.
- Repo-law gaps in t3code code: `throw new RelayPublicDomainLabelTooLongError(...)` in a pure
  function (`infra/relay/src/deploymentConfig.ts:76-80`), `node:crypto`
  (`infra/relay/src/observability.ts:2`), plain `Map`/`Set`, and `interface` props.
  **Verdict: Avoid.** Port the ideas, not the code.

## Patterns to copy

1. Custom provider shape: `Resource<T>("<Stack>.<Name>")` type + value, `Provider.succeed(R,
   R.Provider.of({ reconcile, list, delete, read?, diff? }))`, merged into `providers`
   (`infra/relay/src/previewTunnelSweep.ts:34-40,153-183`, `infra/relay/alchemy.run.ts:22-28`).
2. A delete-only sweep resource for cloud objects created at runtime, ordered by a dependency
   prop and guarded against non-preview stages. Use it for runner instances and registrations
   (`infra/relay/src/previewTunnelSweep.ts:15-26,165-170`).
3. Idempotent delete bodies: 404 counts as success, 429 fails so the next run retries, and
   dependents are deleted first (`infra/relay/src/previewTunnelSweep.ts:90-101,140-150`).
4. `prod` owns shared singletons, and other stages use `.ref(id, { stage: "prod" })`
   (`infra/relay/src/db.ts:56-58`, `infra/relay/src/zone.ts:54-59`).
5. `retain()` on data-bearing resources, and `forceDestroy` off-prod
   (`infra/task-cache/src/resources.ts:20,35`, `infra/relay/src/observability.ts:90-94`).
6. `Config.Redacted` / `Config.schema` at the boundary, and `Alchemy.makeRandom` /
   `Alchemy.KeyPair` for generated secrets (`infra/relay/src/worker.ts:109-112,144-170`).
7. A digest prop next to any `Redacted` input, so rotation shows in the diff
   (`infra/relay/src/clientConfig.ts:22`). Compute it with `effect/crypto/Digest`.
8. Alarms as code from a typed threshold table, created only when a notifier env var is set
   (`infra/relay/src/monitoring.ts:34-55,358-381`).
9. A fail-closed custom secrets entry (`ConfigProvider.layerAdd`) for derived Worker secrets
   (`infra/task-cache/src/deploymentConfig.ts:15-38`), sourced from `op://`.
10. CI prod deploy: push `main` + dispatch `force`, ref guard, environment, per-stack concurrency
    with `cancel-in-progress: false`, `--yes --no-input`, `ALCHEMY_TELEMETRY_DISABLED=1`, filtered
    install, commit status (`.github/workflows/deploy-relay.yml:3-97`).
11. `alchemy state read <Stack>/prod/output --backend <b>` for downstream jobs, which need no
    provider credentials (`.github/workflows/release.yml:432-451`).
12. `@alchemy.run/test` `Test.make({ state: inMemoryState() })` + `test.provider` + `stack.deploy`,
    and a fake `HttpClient` for provider bodies (`infra/relay/src/clientConfig.test.ts:51-95`,
    `infra/relay/src/previewTunnelSweep.test.ts:14-100`).
13. `@distilled.cloud/*` pinned to the version alchemy resolves (`pnpm-workspace.yaml:44-46`).

## Patterns to avoid

1. `Cloudflare.state()`. D6 is S3, and `AWS.state()` with no options gives DynamoDB at beta.85,
   so always pass `backend: "s3"` and `bucketName` (`infra/relay/alchemy.run.ts:29`; alchemy
   `packages/aws/src/StateStore/Store.ts:23-28,117-118` at `v2.0.0-beta.85`).
2. Stack-wide `adopt(true)` (`infra/task-cache/alchemy.run.ts:27`). It conflicts with greenfield
   D12. Adopt per resource, only for things that must pre-exist, each with a decision file.
3. `Secrets.DotEnv()` and a repo `.env` (`infra/task-cache/alchemy.run.ts:17`,
   `infra/relay/README.md:87-89`). `op run` injects the environment, and `DotEnv` would read raw
   `op://` strings.
4. Deriving deploy secrets from `$HOME` files and doing manual laptop prod deploys
   (`infra/task-cache/src/deploymentConfig.ts:24-27`, `infra/task-cache/README.md:9-16`).
5. An `Alchemy.Action` that writes tokens into the repo-root `.env`
   (`infra/relay/src/clientConfig.ts:95-117`).
6. No in-code prod guard. Keep `Config.Literal("true", "CI")` from our current stack.
7. Axiom resources. They are a new paid service and need the operator.
8. Long-lived cloud API tokens as GitHub secrets (`.github/workflows/deploy-relay.yml:76-83`).
   Use the `op` service-account route.
9. The `withLogicalId` Proxy around `Resource.ref` (`infra/relay/src/zone.ts:14-20`).
10. Colocated `src/*.test.ts`, `node:crypto`, native `Map`/`Set`, `throw` in pure helpers, and
    `interface` data models. These are repo-law violations to drop when porting.
11. Assuming Redacted outputs are encrypted at rest. They are stored as
    `{"__redacted__": "<value>"}` (`.github/workflows/release.yml:436-437`), so the S3 state
    bucket needs SSE-KMS and narrow IAM.

## Sources

- `~/YeeBois/references/effect/t3code` at `6577c6b6185167c0e502fa01f9e8e8f2dee6ff25`:
  - `~/YeeBois/references/effect/t3code/infra/relay/` (`alchemy.run.ts`, `package.json`,
    `tsconfig.json`, `README.md`, `.env.example`, `src/{previewTunnelSweep,previewStages,
    deploymentConfig,db,dbConfig,zone,queues,Config,WebCrypto,clientConfig,observability,
    monitoring,worker}.ts`, `src/{previewTunnelSweep,previewStages,deploymentConfig,clientConfig}.test.ts`,
    `src/environments/ManagedEndpointProvider.ts`, `scripts/*.ts`, `migrations/postgres/`)
  - `~/YeeBois/references/effect/t3code/infra/task-cache/` (`alchemy.run.ts`, `package.json`,
    `tsconfig.json`, `README.md`, `install.sh`, `src/{resources,deploymentConfig,worker,
    observability,WriterRegistry}.ts`, `scripts/{manage,install-ci}.ts`, `migrations/savings/`)
  - `~/YeeBois/references/effect/t3code/.github/workflows/{deploy-relay,relay-preview,relay-preview-cleanup,release,ci}.yml`
  - `~/YeeBois/references/effect/t3code/pnpm-workspace.yaml` (catalog pins and patches)
  - `~/YeeBois/references/effect/t3code/node_modules/.pnpm/alchemy@2.0.0-beta.85_*/node_modules/alchemy/lib/{Provider,AdoptPolicy}.d.ts`,
    `lib/Secrets/{DotEnv,ProcessEnv,Provider}.d.ts`, `lib/State/BucketState.d.ts`
- `~/YeeBois/references/effect/alchemy` tag `v2.0.0-beta.85`:
  `packages/aws/src/StateStore/Store.ts`, `packages/alchemy/src/State/BucketState.ts`
- beep-effect worktree: `goals/infra-alchemy-rebuild/SPEC.md`,
  `apps/beep-effect-web/alchemy.run.ts`, `goals/infra-alchemy-rebuild/research/t3code-alchemy-patches.md`
- https://github.com/pingdotgg/t3code (upstream of the reference checkout)
- https://alchemy.run (linked from `infra/task-cache/README.md:3`)
- https://github.com/pingdotgg/t3code/blob/main/docs/operations/relay-observability.md#alerts
  (runbook URL embedded at `infra/relay/src/monitoring.ts:10-11`)
