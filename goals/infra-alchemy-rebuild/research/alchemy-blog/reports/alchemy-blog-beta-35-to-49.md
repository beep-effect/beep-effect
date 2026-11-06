# Alchemy blog catalog: v2.0.0-beta.35 through v2.0.0-beta.49

Scope is the fifteen release posts named in the research brief, dated 2026-05-08 through 2026-06-01. Every claim below is taken from those posts. Published pages: `https://alchemy.run/blog/<slug>/`. Authoring source linked from each page's "Edit page" control: `https://github.com/alchemy-run/alchemy/blob/main/website/src/content/docs/blog/<slug>.md`. Local copies: `research_notes/<slug>.md`.

Nothing in this range documents GitHub repository settings, a Vercel provider, `@distilled.cloud/vercel`, Docker over SSH, an EC2 autoscaling fleet, Lambda beyond entrypoint codegen and `FunctionProps.timeout`, S3, IAM, KMS, budgets, or an S3 `BucketState` store. Those absences are called out in section 3 so they are not inferred from neighboring features.

---

## 1. Per post

### beta.35 — Queue Streams & R2 Domains

- **URL:** https://alchemy.run/blog/2026-05-08-beta-35/
- **Date:** 2026-05-08
- **Version:** `v2.0.0-beta.35`
- **Resources / APIs:** `Cloudflare.Queues.messages(queue).subscribe(...)` (Effect `Stream` consumer; per-message `ack` / `retry`; `batchSize`, `maxRetries`; crash mid-batch redelivers unprocessed messages); `Cloudflare.QueueBinding.bind`; `Cloudflare.R2.ReadWriteBucket` / `bucket.put`; `Cloudflare.R2.Bucket` `customDomains: string[]`; `Cloudflare.Worker` `bindings` accept numbers, booleans, and objects (deploy-time serialize, typed runtime shape); `Neon.Project` `enableLogicalReplication` (default off, in-place toggle, no replacement).
- **Provider packages:** `alchemy/Cloudflare` (shown). `Neon.Project` is used without a new package name in the post. Distilled Cloudflare runtime bumped to 0.3.1.
- **CLI:** startup npm version check (skipped in CI and non-TTY; nudge is `bun add alchemy@latest`); non-TTY deploy UI downgrades to a plain-text progress renderer (no ANSI in CI logs); new provider namespaces, with `alchemy cloudflare state ls` and `alchemy aws state get <key>` shown. Top-level `deploy`, `destroy`, `plan`, `dev`, `test` are unchanged (named, not added here).
- **State store:** Cloudflare-backed store is inspectable via `alchemy cloudflare state`. AWS store is readable via `alchemy aws state get <key>`. No store implementation (S3 or otherwise) is described.
- **Testing:** none added. `test` is only named as an existing top-level command.
- **Effect concepts:** queue consumer is another `yield*` in the Worker init phase, a peer of init, not a separate file; `Stream.runForEach`; `Effect.provide` + `Layer.mergeAll` of `Cloudflare.R2.ReadWriteBucketBinding`, `Cloudflare.QueueBindingLive`, and `Cloudflare.Queues.EventSourceLive` (required for `messages(...)` to dispatch). Bindings already on the Worker (`bucket`, `queue`) are in scope inside the stream handler. Auth providers moved into layers: the `R` channel on stack effects is `never` again (credentials no longer leak into the user-facing stack type).
- **Breaking / migration:** R2 custom domain props simplified from a verbose object shape to a plain string array. No other break is labeled. Worker non-string bindings replace the old `JSON.stringify` / `JSON.parse` + `as` cast round-trip.
- **Tips:** edit the `customDomains` array and the next deploy reconciles live attachments; pair a domain with a Cloudflare `Zone` to provision DNS in the same stack; each custom domain points at the bucket's public origin. `Consumer.listConsumers` now paginates (previously truncated at the API default) and errors clearly on conflicting consumer registrations. Drizzle schema flag is marked updated only when migrations drift, not on every `drizzle-kit generate`. Vite `builder.sharedConfigBuild` disabled (fixes Worker bundling failures). Dev-mode Node compatibility and AWS/Cloudflare credential profile handling fixed. Example: `examples/cloudflare-worker/src/Api.ts`. Tutorial: `/cloudflare/messaging/queues`.

### beta.36 — Images & Hyperdrive Bindings

- **URL:** https://alchemy.run/blog/2026-05-09-beta-36/
- **Date:** 2026-05-09
- **Version:** `v2.0.0-beta.36`
- **Resources / APIs:** `Cloudflare.Images.Images` (`name`) and `Cloudflare.Images.bind` — input is `Stream<Uint8Array>` (typically `request.stream`); `images.info`, `images.input(...).transform(...).output(...)`; `Cloudflare.Hyperdrive` either from an origin connection string (`origin: { connectionString }`, for databases Alchemy does not own: RDS, Supabase, etc.) or from `Neon.Branch` `origin` (direct, non-pooled Neon endpoint); `Cloudflare.Hyperdrive.bind` → `hd.connectionString`; `Cloudflare.R2.Bucket` `lifecycleRules` (age delete, storage-class transition, multipart abort).
- **Provider packages:** none newly named. Implementation file cited: `packages/alchemy/src/Cloudflare/Images/Images.ts`.
- **CLI:** `bun alchemy dev` (`*.localhost` routing).
- **State store:** none.
- **Testing:** internal only — smoke tests install canaries at the workspace root instead of per fixture; batched smoke runs are faster on cold caches. Not a user-facing test API.
- **Effect concepts:** `Effect.provide(Cloudflare.ImagesBindingLive)` and `Cloudflare.HyperdriveConnectionLive`; `HttpServerResponse.stream` / `HttpServerResponse.json`; `Effect.promise` around a fresh `pg` `Client` per request. Hyperdrive does the pooling so the Worker does not exhaust the database. `Neon.Project` → `Neon.Branch` → `Cloudflare.Hyperdrive` is ordered by the deploy graph (`branch.origin` is an output). Worker `compatibility.flags: ["nodejs_compat"]` for `pg`.
- **Breaking / migration:** none stated.
- **Tips:** max 1000 lifecycle rules per bucket; pass `[]` or omit to clear all rules; each rule is reconciled in place on the next deploy. Lifecycle example uses `maxAge` in seconds (`60 * 60 * 24 * N`), `storageClass: "InfrequentAccess"`, `deleteObjectsTransition`, `abortMultipartUploadsTransition`. `*.localhost` fetches go through a custom undici dispatcher to the local sidecar instead of failing DNS (`https://backend.localhost`). Tutorial: `/cloudflare/data/hyperdrive`.

### beta.37 — Cross-Stack References & Bindings

- **URL:** https://alchemy.run/blog/2026-05-12-beta-37/
- **Date:** 2026-05-12
- **Version:** `v2.0.0-beta.37`
- **Resources / APIs:** `Neon.Project.ref(id, { stage })` and owned `Neon.Project`; `Neon.Branch` with `migrationsDir: schema.out`; `Drizzle.Schema`; `Alchemy.Stack` class outputs (`class Backend extends Alchemy.Stack<Backend, { url: string }>()("Backend") {}`) and `yield* Backend` / `Backend.stage.prod` / `Backend.stage["pr-42"]`; `Alchemy.Secret` / `Alchemy.Variable` (later removed in beta.45); Worker-to-Worker binding (`BACKEND: Backend`) plus `Cloudflare.toPromiseApi<Backend>` and `Backend.bind`; `Cloudflare.Workflow` generic over input and output, `Cloudflare.Workflows.task` / `.sleep`, `notifier.create` / `.get` / `.status().output`; `Cloudflare.Workers.cron(expr).subscribe`; `Cloudflare.AnalyticsEngine.Dataset` + `Cloudflare.AnalyticsEngineDataset.bind` / `.writeDataPoint`; `Cloudflare.R2.Bucket` drains itself on destroy (`emptyOnDestroy`, default on); `Cloudflare.Website.Vite` `env`.
- **Provider packages:** `alchemy`, `alchemy/Drizzle`, `alchemy/Neon`, `alchemy/Cloudflare`. Stack example uses `providers: Cloudflare.providers(), state: Cloudflare.state()`.
- **CLI:** `alchemy deploy --stage staging`, `alchemy deploy --stage pr-147`, `alchemy destroy --stage pr-147`.
- **State store:** cross-stage `Resource.ref` and cross-stack `Output.stackRef` read the other stage's persisted state store at plan time. Missing state fails the plan with `InvalidReferenceError`. Destroy of a consumer stage does not delete resources it only references. Docs linked from the post: `/state-store`, `/infrastructure-as-code/outputs#ref`, `/infrastructure-as-code/resource#ref`, `/infrastructure-as-code/references`, `/project-structure/monorepo`.
- **Testing:** R2 empty-on-destroy is called out so integration tests and ephemeral PR previews tear down with one `alchemy destroy` instead of `BucketNotEmpty`.
- **Effect concepts:** references are lazy typed handles of the same resource type as the owned resource. `Alchemy.Secret` yields `Output<Redacted<string>>` at deploy and `Redacted<string>` inside `fetch`; `Alchemy.Variable` is the non-redacted form (literals, `Effect`, `Config`, or `ConfigProvider` lookup by name). Secret routes to Cloudflare `secret_text`; the post also says Lambda encrypted env vars on AWS. Workflow body is `Effect.fn` over typed input; outer gen is the init phase (resolve KV, DO, secret once); each `task` is a replay checkpoint. Cron handler runs in the same Worker context; multiple `cron(...)` calls register multiple schedules. Analytics `writeDataPoint` uses the same Effect error channel as other bindings (`indexes`, `blobs`, `doubles`). `Effect.fn("Backend.hello")` RPC methods vs `fetch` HTTP. Four call styles: raw platform API (`env.BUCKET.get`), service-binding `fetch`, `toPromiseApi` (throws on `Effect.fail`, unwraps stream envelopes), and `yield* Backend.bind`.
- **Breaking / migration:** D1 `prepare()` / `bind()` are synchronous (no `yield*` on statement construction). Unresolved `Output` JS coercion throws instead of becoming `"[object Output]"` (template literals outside an Effect). Deprecated libsodium wrapper types removed (internal; public API unaffected unless those internals were imported). `emptyOnDestroy: false` restores fail-if-non-empty.
- **Tips:** same logical id across stages (`"app-db"`); PR stages share staging's Neon project and own only a branch. Deploy the shared stage first. `yield* Backend` defaults to the consumer's stage; pin with `Backend.stage.<name>` when prod frontend must always read prod backend. HTTP binding when you need request/response and streaming bodies; RPC when you want typed methods. Wrap replay-sensitive workflow side effects in `task`. Cheapest Cloudflare cron is one minute (`* * * * *`). `Cloudflare.KV.ReadWriteNamespace` used from both cron and workflow examples. WASM modules bundle into the local sidecar under `bun alchemy dev`. Guides: shared database, monorepo, branch-from-shared-database, Vite SPA + Worker bridge, workflows, secrets.

### beta.38 — Email Routing & Actions

- **URL:** https://alchemy.run/blog/2026-05-13-beta-38/
- **Date:** 2026-05-13
- **Version:** `v2.0.0-beta.38`
- **Resources / APIs:** `Cloudflare.Email.Routing`, `Cloudflare.Email.Address`, `Cloudflare.Email.Rule` (matchers + actions such as `forward`), `Cloudflare.Email.SendEmail` (`destinationAddress`, `allowedSenderAddresses`; id is the env key), runtime `Cloudflare.SendEmail.bind` with `send` (parsed) and `sendRaw` (RFC 822); `Alchemy.Action(name, Effect.fn | init Effect.gen)`.
- **Provider packages:** Neon `Project` and `Branch` now call `@distilled.cloud/neon` (`getProject`, `updateProject`, `deleteProject` from `@distilled.cloud/neon/Operations`). User-facing Neon API unchanged. The hand-rolled `api.ts` shim is gone.
- **CLI:** `--force` flips skipped actions to run, same as resources.
- **State store:** an Action persists an input hash. Removing the Action drops that persisted state in the GC pass; the body is not re-invoked on delete. Not a new store backend.
- **Testing:** none.
- **Effect concepts:** Action is a DAG node that runs an arbitrary Effect during apply when the resolved input hash changes. It returns `Output<A>` that downstream resources or actions can depend on. No create/update/replace/delete lifecycle. Plan rows: `λ` will run, `·` hash matches so skip. Header example: `Plan: 1 to create | 1 to update | 1 to run`. Init-style Action body: outer `Effect.gen` pulls services (`Database`, `Logger`) once per process (memoized); inner `Effect.fn` is the runner. Scheduler waits on a "stable" signal so the body never sees a resource's precreate stub — only terminal cloud state. Email binding provided via `Cloudflare.SendEmailBindingLive`. Neon 404s use SDK tagged error `Effect.catchTag("NotFound", ...)`. Retries hang off `Schedule` instead of hand-written try/catch. Apply transport treats transient send/receive errors as retryable: backoff, reconnect, resume, rather than aborting the stack.
- **Breaking / migration:** none labeled for Alchemy's public API. Apps that pin Effect themselves should bump in lockstep to `effect@4.0.0-beta.66` (no Alchemy API change).
- **Tips:** use Action for migrations, cache invalidation, deploy announcements — anything that is not a cloud resource but must run in order with one. `ignore` is vendored to drop a transitive dependency for `alchemy deploy` in CI. Self-hosted OTel dashboards gain resource-usage ranking and error-rate charts per Stack / Stage (dashboard config only; no user-code change). Docs: `/providers/cloudflare/email/{routing,address,rule,send}`, `/infrastructure-as-code/action`.

### beta.39 — HTTP Lifecycle & Vite Env

- **URL:** https://alchemy.run/blog/2026-05-13-beta-39/
- **Date:** 2026-05-13T18:00:00Z
- **Version:** `v2.0.0-beta.39`
- **Resources / APIs:** `Cloudflare.Website.Vite` `env` is now also passed through Vite's `define` hook. `SendEmail` is a first-class member of the Worker binding union and emits `send_email` metadata at deploy (beta.38 had missed both sites, so `bindings: { EMAIL: Email }` errored and deploys silently dropped the binding). Worker HTTP adapter rewritten onto Effect's handled lifecycle.
- **Provider packages:** none new. Adapter alignment is with `@effect/platform`'s HTTP lifecycle (named in prose).
- **CLI:** none.
- **State store:** none in this post. The next post says this release's `scopeTransferToStream` change broke the Cloudflare state store; that is recorded under beta.40.
- **Testing:** none.
- **Effect concepts:** `import.meta.env.VITE_*` inlining; non-`VITE_` keys stay runtime Worker bindings. `Redacted` values are unwrapped when the key is `VITE_`-prefixed — naming them that way is the explicit opt-in to the public bundle. Worker adapter now uses `HttpEffect.toHandled` / `toWebHandler` while keeping `cf-connecting-ip` → `remoteAddress`, the original Cloudflare `Request` service, patched `request.raw`, and existing 500 mapping from `serveWebRequest`. Newly preserved: stream-scope transfer, HEAD body suppression, request-abort interruption. `RpcServer.toHttpEffect` no longer hangs under Alchemy's Worker adapter (it already worked under raw Wrangler).
- **Breaking / migration:** none stated in this post. Superseded the same day by the beta.40 caution (below).
- **Tips:** `env: { VITE_API_URL: worker.url.as<string>() }` so the SPA sees the deployed Worker URL. Tutorial section "Inject the Worker URL at build time" at `/cloudflare/frontend/vite-spa`. Only `VITE_`-prefixed keys match Vite's default `envPrefix`.

### beta.40 — Vite Dev Server

- **URL:** https://alchemy.run/blog/2026-05-15-beta-40/
- **Date:** 2026-05-15T22:00:00Z
- **Version:** `v2.0.0-beta.40`
- **Resources / APIs:** `Cloudflare.Website.Vite` local dev is a real `vite.createServer` (client, SSR, and Worker in one process, HMR) via `@distilled.cloud/cloudflare-vite-plugin`, replacing "bundle then serve through the sidecar." `Cloudflare.AI.Gateway` diffing fixed (was diffing against `news` instead of observed cloud state; defaults now match API `0` / `false` / `null`). Worker HTTP 500s log the full `Cause` server-side and return generic `Internal Server Error`. `Cloudflare.start` forwards startup options to the container runtime (they were dropped). `Axiom.Chart` gains `smartfilter` (used by the internal OTel dashboard; available for user charts). Entrypoint codegen for Lambda, ECS, EC2-hosted, Cloudflare Worker, and Cloudflare Container.
- **Provider packages:** `@distilled.cloud/cloudflare-vite-plugin`. Dev lockfile moved to `@alchemy.run/node-utils`; legacy `Sidecar/Lock.ts` removed.
- **CLI:** `bun alchemy dev`, `bun alchemy deploy`.
- **State store:** Cloudflare state store version bumped to **v5**. Older clients refuse mismatched state and prompt an upgrade. This is a format gate, not a description of an S3 backend.
- **Testing:** none.
- **Effect concepts:** `props.env` keeps beta.39 rules (`VITE_` → `import.meta.env.*`, everything else is a runtime Worker binding). Worker 500 behavior aligned with `HttpServer.serve` defaults. `scopeTransferToStream` from beta.39 is reverted (it caused **415** from Workers and **500** against the Cloudflare state store).
- **Breaking / migration:** upgrade immediately off beta.39. State-store clients older than v5 will not load mismatched state. `importPath` in generated entrypoints is now `JSON.stringify(importPath)` so Windows backslashes, quotes, and non-ASCII paths emit a valid JS string literal.
- **Tips:** Vite is resolved from the project's own `node_modules` via `createRequire`, so the app controls the Vite version. HMR: route component hot-reloads; worker edit reloads the Worker. `Diff.ts` gained observed-vs-desired helpers (the AiGateway spurious-update fix).

### beta.41 — Worker Runtime Rewrite

- **URL:** https://alchemy.run/blog/2026-05-20-beta-41/
- **Date:** 2026-05-20T22:00:00Z
- **Version:** `v2.0.0-beta.41`
- **Resources / APIs:** no new resource types. Runtime rewrite of `Cloudflare.Worker`, `Cloudflare.DurableObject`, and `Cloudflare.Workflow`. Generated entrypoint is a thin shell over type-checked `WorkerBridge.ts` (`packages/alchemy/src/Cloudflare/Workers/WorkerBridge.ts`). `WorkerProps.env` flows into `InferEnv` (declared `env` keys type as `worker.env.MY_VAR`, not only bindings). Fetch handler exposes Effect `ExecutionContext` (request scope) and raw workerd `WorkerExecutionContext` (`ctx.waitUntil` without a cast). DO RPC methods receive the Worker env (previously empty). Worker `destroy` force-deletes scripts so stuck Durable Object migrations cannot hang teardown.
- **Provider packages:** none new.
- **CLI:** while a resource waits on dependencies the CLI shows `pending`, and it emits terminal status (created/updated/failed) as soon as that resource finishes, not batched at the end.
- **State store:** none.
- **Testing:** none.
- **Effect concepts:** one `Scope.makeUnsafe()` per request, provided into the user Effect, closed via `ctx.waitUntil` when the response finishes streaming. The user Worker Effect is re-evaluated per request. Nothing is cached as a module-scope `Promise` (that cache caused "promise resolved on the wrong I/O context", hung `fetch`, dropped responses, finalizers against closed scopes, and request services captured from a previous request). Schema-driven pattern: one `Schema.Class` / `Schema.TaggedClass` feeds both `HttpApiBuilder.group` → `HttpApiBuilder.layer` → `HttpRouter.toHttpEffect` and `RpcGroup.make` / `Rpc.make` → `RpcServer.toHttpEffect` + `RpcSerialization.layerJson`. DO client: `HttpApiClient.makeWith` or `RpcClient.layerProtocolHttp` with `baseUrl: "http://localhost"` and `httpClient: Cloudflare.toHttpClient(tasksDO.getByName(id))` — `toHttpClient` short-circuits to the stub `fetch` and never leaves the isolate. `RpcSerialization.layerNdjson` for the DO RPC client. `Redacted` survives sidecar RPC JSON round-trips (dev logs no longer unwrap secrets). Bundler externalizes `lightningcss` and `fsevents`.
- **Breaking / migration:** caution says upgrade if you use `Cloudflare.Worker` with `HttpApi` or `RpcServer`. Not an API rename. Per-request setup is intentionally not cached; a follow-up to cache promise-free pieces is deferred.
- **Tips:** return `{ fetch }` from the Worker or DO. Reuse one schema for HTTP API and RPC. Guides: `/cloudflare/apis/effect-http-api`, `/cloudflare/apis/effect-rpc`. Do not cache promises across requests (the post's own postmortem).

### beta.42 — npm Install Hotfix

- **URL:** https://alchemy.run/blog/2026-05-20-beta-42/
- **Date:** 2026-05-20T23:30:00Z
- **Version:** `v2.0.0-beta.42`
- **Resources / APIs:** none.
- **Provider packages:** none. Crash is in the published npm layout of `alchemy`, at `node_modules/alchemy/src/Cloudflare/Workers/Worker.ts`, not in the local workspace.
- **CLI:** none.
- **State store:** none.
- **Testing:** none.
- **Effect concepts:** `Platform(WorkerTypeId, { onCreate, createRuntimeContext })` hooks. `Worker.ts` import-cycles with `WorkerAsyncBindings.ts` (`bindWorkerAsyncBindings`) and `WorkerRuntimeContext.ts` (`makeWorkerRuntimeContext`). Passing those exports straight into `Platform(...)` read them at module load; Bun entering the cycle from the other side hit a temporal dead zone (`ReferenceError: Cannot access 'bindWorkerAsyncBindings' before initialization`).
- **Breaking / migration:** none.
- **Tips:** wrap hook callbacks in arrows so the references resolve at call time, not module-load time. Only reproduced from the npm package layout.

### beta.43 — PlanetScale Provider

- **URL:** https://alchemy.run/blog/2026-05-21-beta-43/
- **Date:** 2026-05-21T22:00:00Z
- **Version:** `v2.0.0-beta.43`
- **Resources / APIs:** `alchemy/Planetscale` — `PostgresDatabase` / `MySQLDatabase`, `PostgresBranch` / `MySQLBranch`, `PostgresRole` / `MySQLPassword`. `Drizzle.Schema` (`schema`, `out`) writes a migration dir when `./src/schema.ts` drifts from the latest snapshot; branch `migrationsDir: schema.out` applies new SQL files transactionally. `Drizzle.postgres(connectionString, { relations })` (no `Drizzle.mysql` yet). `Resource.ref()` shipped on every resource type (example: `Planetscale.PostgresDatabase.ref("app-db", { stage })`).
- **Provider packages:** `alchemy/Planetscale` (`Planetscale.providers()`), `alchemy/Drizzle` (`Drizzle.providers()`), `alchemy/Cloudflare`. Stack snippet uses `state: Alchemy.localState()` and `Layer.mergeAll(Cloudflare.providers(), Planetscale.providers())`.
- **CLI:** next `bun alchemy login` reads `PLANETSCALE_API_TOKEN_ID`, `PLANETSCALE_API_TOKEN`, and `PLANETSCALE_ORGANIZATION` from the environment or stores them at `~/.alchemy/credentials/<profile>/planetscale-stored.json`.
- **State store:** `Resource.ref()` reads output attributes from another stage's state instead of provisioning. `Alchemy.localState()` is the state backend in the registration snippet. Referenced resources are not destroyed with the consumer stage.
- **Testing:** none.
- **Effect concepts:** `role.origin` / `password.origin` are `Output`s, so the graph is `PostgresDatabase` → `PostgresBranch` → `PostgresRole` → `Hyperdrive` → `Worker` with no `dependsOn` and no `await`. MySQL passes `password.origin`; Hyperdrive sees `scheme: "mysql"`. `Cloudflare.Hyperdrive.bind` + `Drizzle.postgres`; queries are `yield*`-able and errors land on the Effect error channel; provide `Cloudflare.HyperdriveBindingLive`. Binding methods no longer leak `WorkerEnvironment` in `R`. Each `*BindingLive` closes over it once. The remaining requirement is `Alchemy.RuntimeContext` ("runs inside a deployed Function or Worker"). Example diff: `kv.get` goes from `Effect<Job | null, NamespaceError, WorkerEnvironment>` to `Effect<..., RuntimeContext>`. A service can expose `Effect<Job, _, RuntimeContext>` without mentioning Cloudflare.
- **Breaking / migration:** none labeled. Add `Drizzle.providers()` next to `Planetscale.providers()`.
- **Tips:** two-tier stages — `staging-*` owns the long-lived cluster, `pr-*` references it and owns branch, role, Hyperdrive, and Worker. PR teardown does not touch the cluster. For MySQL, pair `mysql2` inside `fetch` until a `Drizzle.mysql` helper exists. Fresh `pg` client is not repeated here; Hyperdrive still pools. Docs: `/infrastructure-as-effects/layers`, `/cloudflare/data/hyperdrive`, `/cloudflare/data/drizzle`, `/cloudflare/data/branch-from-shared-database`. Examples: `examples/cloudflare-planetscale-postgres-drizzle`, `examples/cloudflare-planetscale-mysql-drizzle`.

### beta.44 — Config & Bundle Analyzer

- **URL:** https://alchemy.run/blog/2026-05-22-beta-44/
- **Date:** 2026-05-22T20:00:00Z
- **Version:** `v2.0.0-beta.44`
- **Resources / APIs:** `Cloudflare.Zaraz.Config` (tools, triggers, variables, consent, analytics, workflow mode; typed helpers `defineZarazEvents`). Worker `build.bundleAnalyzer` (`true`, or `{ fileName, format }`; default `analyze-data.md` beside the bundle in `.alchemy/bundles/<id>`; `format: "json"` shown). Wraps rolldown's `bundleAnalyzerPlugin`, also exported as `Bundle.bundleAnalyzerPlugin`. `Cloudflare.Artifacts.Artifacts` works under `bun alchemy dev` (previously deploy-only). Local providers move from an in-process sidecar to `RpcProvider` / `RpcSpawner` (`Local/Rpc*`).
- **Provider packages:** none newly named. Rolldown bumped to 1.0.1 stable. `@alchemy.run/node-utils` ESM resolution fix on Node.
- **CLI:** `alchemy dev` / `bun alchemy dev` honors Workers `assets` config; forwards `x-forwarded-for` and `x-forwarded-proto`; filters Bun's "not in project directory" watcher warning.
- **State store:** none.
- **Testing:** none.
- **Effect concepts:** `RpcProvider.effect(Worker, import.meta.resolve(...), Effect.gen(...))`. `RpcProvider.providerServicesEffect` builds heavy provider layers (Cloudflare local runtime and proxy) lazily in the child. Parent talks RPC. `exitHook` `SIGKILL`s the child process group on parent exit, plus a scoped finalizer for the graceful path. Sessions cached per `(serverEntryUrl, alchemyContext, stack)` and respawned if the child dies.
- **Breaking / migration:** `build.metafile` is removed. Use `build.bundleAnalyzer`.
- **Tips:** omitted Zaraz fields (`tools`, `triggers`, `variables`, `workflow`) are left alone, so an existing zone config can be adopted incrementally. Destroy removes the resource from Alchemy state but leaves Zaraz intact unless `delete: true`, which restores Cloudflare defaults (including `workflow` back to real-time). Vite-style `import sql from "./schema.sql?raw"` works in the Worker bundler. Local DO fixes: `className` / `namespaceId` no longer swapped; local `namespaceId` is deterministic and independent of the binding name; DOs declared on other Workers in the stack are not registered on the current Worker. `mysql2` no longer errors at Worker bundle time. Dangling `workerd` processes after Ctrl-C, crash, or HMR restart are the bug this release removes — do not hand-kill them as the design.

### beta.45 — Config & RPC Workers

- **URL:** https://alchemy.run/blog/2026-05-29-beta-45/
- **Date:** 2026-05-29T22:00:00Z
- **Version:** `v2.0.0-beta.45`
- **Resources / APIs:** `Alchemy.Secret` and `Alchemy.Variable` removed. `WorkerProps.bindings` collapsed into `WorkerProps.env` (resources, plain values, or `Config`). `Cloudflare.RpcWorker` (`props.schema`, init returns `RpcServer.toHttpEffect(schema)`; `Cloudflare.RpcWorker.bind` → typed `RpcClient`). `Cloudflare.RpcDurableObject` (`{ schema }`, handlers via `state.storage.put` / `get`, `RpcSerialization.layerNdjson`). Modular form: `(name, { schema })` with no impl is a tagged identifier; `Class.make(impl)` is the runtime `Layer`; `Class.from(Worker)` binds cross-script without pulling the DO runtime into the caller bundle. `Cloudflare` Browser Rendering binding (headless Chrome). Cross-script Durable Object binding. `Random.KeyPair` managed public/private key pair. `timeout` on `FunctionProps` (AWS Lambda timeout). `Cloudflare.Queues.Queue` / `messages()` time props accept `Duration.Input` (`"30 seconds"` instead of raw seconds). `Worker.url` infers the canonical URL and preserves domain order. Workflows, Analytics Engine, SendEmail, and custom ports work in `alchemy dev`.
- **Provider packages:** none newly named. Config is `effect/Config`.
- **CLI:** `alchemy dev` coverage expanded (preview subdomain reconcile, websocket upgrades in vite dev, external `require`, tighter `Cloudflare.providers()` types — listed as a batch, details deferred to the changelog).
- **State store:** DO storage (`state.storage.put` / `get`) is Durable Object storage, not the Alchemy state store. No Alchemy store change in this post.
- **Testing:** the new RpcWorker tutorial includes an integration test. No new test runner.
- **Effect concepts:** a `Config` (`Config.redacted`, `Config.string`, combinators `withDefault` / `orElse` / `mapAttempt`) `yield*`ed in the Worker **Init** phase is recorded by a custom `ConfigProvider` inside a Platform context and bound to the deploy target. The same value is usable immediately in Init (the old Secret accessor had to be yielded twice). Combinators bind the **source** env var, not the transformed result, and re-run at runtime against that source. A `Config` yielded only inside `fetch` is **never bound**, because `fetch` does not run at deploy. Async (non-Effect) Workers cannot `yield*` `Config`; put `Config.redacted` / `Config.string` on `env` instead. `RpcWorker.bind` is an in-account service binding, not the public network; schema is recovered from the class. `getByName(id)` returns `Effect<RpcClient>`; yield it inside a per-request `Effect.scoped` handler so the client is freed with the request. Built-in DO method bridge `JSON.stringify`s return values and strips `Schema.Class` identity; `RpcDurableObject` shares one `RpcSerialization` codec and supports streaming. Docs: `/environments/secrets`, `/cloudflare/compute/workers#call-another-worker`, `/cloudflare/compute/durable-objects#schemaless-rpc`, `/cloudflare/apis/effect-rpc`.
- **Breaking / migration:** **`Alchemy.Secret` and `Alchemy.Variable` are gone.** Replace `yield* Alchemy.Secret("API_KEY")` with `yield* Config.redacted("API_KEY")` and delete the second yield inside `fetch`. Rename `bindings` to `env`. The post does not restate the beta.37 "Lambda encrypted env vars" mapping for `Config`; do not assume it.
- **Tips:** resolve Config in the outer Init `Effect.gen` and close over the `const`. Beta.37's Secret-inside-workflow-init pattern has to move to `Config`.

### beta.46 — Vectorize

- **URL:** https://alchemy.run/blog/2026-05-31-beta-46/
- **Date:** 2026-05-31T08:00:00Z
- **Version:** `v2.0.0-beta.46`
- **Resources / APIs:** `Cloudflare.VectorizeIndex` (`dimensions` + `metric: "cosine"`, or `preset` such as `"@cf/baai/bge-base-en-v1.5"`). Immutable: `dimensions`, `metric`, `preset`, `description` — changing any of them replaces the index. `Cloudflare.VectorizeIndex.bind` client methods, all yieldable: `upsert`, `query`, `queryById`, `insert`, `deleteByIds`, `getByIds`, `describe`. `Cloudflare.VectorizeMetadataIndex` (`indexName`, `propertyName`, `indexType: "string"`); also immutable (property name, type, or parent index replace it). Query `filter` (example `{ kind: { $eq: "second" } }`) works only after the metadata index exists.
- **Provider packages:** none new. Provide `Cloudflare.VectorizeIndexBindingLive`.
- **CLI:** `bun alchemy cloudflare bootstrap --force` updates the Cloudflare state-store stack against real state without rotating keys.
- **State store:** bugfix for the **Cloudflare** state store, not an S3 store. Bootstrap used to start from fresh local state and regenerate the auth token and the encryption key on every update, so previously persisted state could no longer be decrypted. Bootstrap now reads **remote state**, which already holds the token and key. Decrypt failure returns `undefined` instead of throwing. Invalid auth tokens are detected and refreshed. If the profile thinks the store exists but it is gone, it is recreated.
- **Testing:** none.
- **Effect concepts:** bind in Init (`yield* Cloudflare.VectorizeIndex.bind(index)`), use the client inside `fetch`, `Effect.provide(Cloudflare.VectorizeIndexBindingLive)`.
- **Breaking / migration:** upgrade if you use the Cloudflare state store, otherwise a later bootstrap can rotate the key out from under existing ciphertext. Vectorize indexes are replacements, not in-place updates. Create metadata indexes before inserting vectors (filter only sees indexed metadata).
- **Tips:** `preset` pins dimensions and metric to a managed embedding model so you do not set them by hand. `topK` on `query`.

### beta.47 — AI Gateway Models

- **URL:** https://alchemy.run/blog/2026-06-01-beta-47/
- **Date:** 2026-06-01T03:00:00Z
- **Version:** `v2.0.0-beta.47`
- **Resources / APIs:** `Cloudflare.AI.Gateway` becomes an Effect AI `LanguageModel` provider. Prose: bind the gateway in Init, call `.model({ client, model, parameters })` with a Workers AI model id (`@cf/meta/llama-3.1-8b-instruct`), get a `LanguageModel` layer. The published snippet writes `yield* Cloudflare.AIbind(Gateway)` (recorded as printed; the prose name is `Cloudflare.AI.Gateway`). Provide `Cloudflare.AI.GatewayBindingLive` once at the bottom of Init. Implicit Worker and Durable Object RPC methods may return a `Stream` directly (no `Effect<Stream>` wrapper). Value methods stay `Effect`s. Fix is in `WorkerBridge` and `DurableObjectBridge` (a bare `Stream` used to hit `Fiber.runLoop: Not a valid effect`). `props.env` `Config` values are wired into the local Worker provider under `alchemy dev`.
- **Provider packages:** none newly named. Effect AI providers listed as already existing: OpenAI, Anthropic, Workers AI. Gateway sits beside them.
- **CLI:** `bun alchemy login` no longer evaluates the stack. Providers and state are read statically. State-store init is deferred until actually used. Previously login could fail on a missing `Config` or build the state store before auth existed and brick the flow.
- **State store:** initialization postponed until use. No new backend.
- **Testing:** none.
- **Effect concepts:** `LanguageModel.generateText` / `streamText`, tool calls, structured output, provider-agnostic once the layer is in scope. `Effect.provide(languageModel)` on the handler and `Effect.provide(Cloudflare.AI.GatewayBindingLive)` on Init. `makeLanguageModel` translates Effect AI requests into Workers AI `ai.run(...)` (SSE for streaming, schema-typed usage, tools, structured output) and inherits gateway caching, rate limiting, retries, and the unified request log. `Config.redacted` is how the Effect AI guide reads keys. DO example: `yield* Cloudflare.DurableObjectState`, `state.storage.get`, `Stream.iterate` / `Stream.take` / `Stream.map` / `Stream.encodeText`, `HttpServerResponse.stream`. Client stub: `counters.getByName("default").tick(5)`.
- **Breaking / migration:** none labeled.
- **Tips:** the binding supplies auth and the gateway URL; do not pass an API key or `Layer.unwrap`. Guides: `/cloudflare/ai/effect-ai`, `/cloudflare/ai/ai-gateway`.

### beta.48 — Zones, Tunnels & Tokens

- **URL:** https://alchemy.run/blog/2026-06-01-beta-48/
- **Date:** 2026-06-01T09:00:00Z
- **Version:** `v2.0.0-beta.48`
- **Resources / APIs:** `Cloudflare.Zone.Zone` (`name`; outputs `zone.zoneId`, `zone.nameServers`, `zone.status`). Creates the zone if missing. Default removal is retain. `AdoptPolicy.adopt()` imports an existing zone. `RemovalPolicy.destroy()` deletes on teardown. Engine: `Resource(type, { defaultRemovalPolicy })` so a type can override destroy-by-default (`Zone` uses `"retain"`). `destroy()` / `retain()` default to `true` with no argument. Runtime tunnel clients: `Cloudflare.Tunnel.ReadTunnel` (`get`, `list`, `getToken`, `getConfiguration`), `WriteTunnel` (`create`, `update`, `delete`, `putConfiguration`), `ReadWriteTunnel` (full CRUD). `Cloudflare.TunnelReadWrite.bind()` + `Cloudflare.TunnelReadWriteLive`. `Cloudflare.RateLimit({ namespaceId, simple: { limit, period } })` — data marker in `env` and yieldable in an effect-native Worker; `throttle.limit({ key })`; `InferEnv` maps it to native `cf.RateLimit` for async Workers; `Cloudflare.RateLimitBindingLive`. `Cloudflare.BrowserRendering` renamed to `Cloudflare.Browser` (binding, client, and error exports). `Browser`, `Images`, and `DynamicWorkerLoader` are yieldable binding markers (one `yield*` attaches the binding and returns the client).
- **Provider packages:** `alchemy/AdoptPolicy`, `alchemy/RemovalPolicy`. Distilled bumped to `0.22.3` for the `ZoneAlreadyExists` tag (replaces error-message matching). The same bump widened generated enums to open unions, narrowed back at the API boundary across several providers. Tunnel binding creates `Cloudflare.ApiToken.AccountApiToken` with an allow policy whose permission groups match the chosen surface (`cfd_tunnel`), resource `com.cloudflare.api.account.${accountId}`, and injects `token.value` as `secret_text`.
- **CLI:** `alchemy cloudflare create-token --name ci-token` (curated permissions for typical Alchemy deploys) and `--all-permissions --name admin`. Standalone: no auth profile, token is never stored, permission groups resolved live from the account, minted token verified via `/user/tokens/verify`. Authenticates with the account Global API Key (`CLOUDFLARE_API_KEY` / `CLOUDFLARE_EMAIL`, or prompted) because Cloudflare only grants permissions the calling credential holds. Guide: `/cli/cloudflare`.
- **State store:** none.
- **Testing:** none.
- **Effect concepts:** bind tunnels once in Init, call from `fetch`, provide `TunnelReadWriteLive`. Rate limit is dual-natured (env marker and yieldable). Yieldable `Browser` / `Images` / `DynamicWorkerLoader` follow the same "attach + client" step. Docs refocus: Bindings section; Providers page centers on the lifecycle interface (`/cli` also linked).
- **Breaking / migration:** `Cloudflare.BrowserRendering` → `Cloudflare.Browser` is a rename (the post does not print the word "breaking," but the old name is gone). Zone will not be deleted on teardown unless you pipe `RemovalPolicy.destroy()`. `destroy()` / `retain()` with no args now mean `true`.
- **Tips:** `adopt()` for a zone that already exists; do not let a default destroy delete DNS. Tunnel `putConfiguration` ingress example ends with `{ service: "http_status:404" }`. `getToken` returns the connector token. Scoped `AccountApiToken` is created for you — do not hand-mint a tunnel token and stuff it into `secret_text` unless you are outside this binding.

### beta.49 — DNS Bindings & Output.flatMap

- **URL:** https://alchemy.run/blog/2026-06-01-beta-49/
- **Date:** 2026-06-01T19:00:00Z
- **Version:** `v2.0.0-beta.49`
- **Resources / APIs:** runtime DNS clients bound to a `Cloudflare.Zone.Zone`. `Cloudflare.DNS.ReadDns` (`getDnsRecord`, `listDnsRecords`), `WriteDns` (`createDnsRecord`, `updateDnsRecord`, `patchDnsRecord`, `deleteDnsRecord`, `batchDnsRecords`), `ReadWriteDns` (full CRUD). `Cloudflare.DnsReadWrite.bind(Zone)` and `Cloudflare.DnsReadWriteLive`. Calls take no `zoneId`; the bound zone fixes it. Alternatively `yield* Zone` first. `Output.flatMap` plus method-style `output.map`, `output.mapEffect`, `output.flatMap` (`apply` / `effect` kept as aliases). Under the covers the binding creates a least-privilege `AccountApiToken` scoped to that single zone (`DNS Read` / `DNS Write`) and binds the token value plus zone id as `secret_text`. Policy resource: `com.cloudflare.api.account.zone.${zoneId}`.
- **Provider packages:** none new.
- **CLI:** none.
- **State store:** none.
- **Testing:** none.
- **Effect concepts:** `Output.flatMap` resolves `Output<A>`, passes the value to `f`, flattens the `Output<B>` `f` returns. Sits beside `Output.map` and `Output.mapEffect`. Short-circuits while the source is unresolved, so it composes in the deploy graph. Example: `zone.zoneId.pipe(Output.flatMap(zoneId => Output.interpolate\`com.cloudflare.api.account.zone.${zoneId}\`))`. Method results are named `ApplyExpr`, `EffectExpr`, `FlatMapExpr`. Security fix: every `Config` resolved in Worker Init is recorded as a secret binding (`secret_text`). Runtime read-back calls `Redacted.value` only when the value is actually `Redacted`.
- **Breaking / migration:** security hotfix, not a signature change. Some `Config` values yielded in Init on earlier betas were stored as plain text. Upgrade and redeploy so those secrets are stored encrypted.
- **Tips:** same ergonomics as beta.48 tunnel bindings. Bind the zone once in Init. Do not pass `zoneId` on each DNS call. Concepts: `/environments/secrets`.

---

## 2. Timeline of capabilities

Dates are the post `date` frontmatter. Versions are `v2.0.0-beta.N`.

| Date | Version | Capability added or changed |
| --- | --- | --- |
| 2026-05-08 | beta.35 | Queue consumer as an Effect `Stream` in Worker init (`messages().subscribe`, `ack`/`retry`, `EventSourceLive`). R2 `customDomains` string array, reconciled on deploy. Worker bindings accept non-string JSON values. Neon `enableLogicalReplication` (in place). CLI version nudge, plain-text non-TTY renderer, `alchemy cloudflare` / `alchemy aws` namespaces (`state ls`, `aws state get`). Provider auth layers; stack `R` is `never`. Queue consumer pagination. Drizzle schema dirty-bit only on real drift. Vite `sharedConfigBuild` off. Distilled CF runtime 0.3.1. |
| 2026-05-09 | beta.36 | Cloudflare Images binding (`Stream` in, transform or metadata out). Hyperdrive binding over a raw origin string or `Neon.Branch.origin`. R2 lifecycle rules (≤1000, empty array clears). `*.localhost` dev routing. Internal smoke-test canaries hoisted to the workspace root. |
| 2026-05-12 | beta.37 | Cross-stage `Resource.ref` and cross-stack `Alchemy.Stack` outputs (`yield* Backend`, `Backend.stage.<name>`), plan-time state read, `InvalidReferenceError`, destroy does not cascade to referenced resources. `Alchemy.Secret` / `Alchemy.Variable` (Cloudflare `secret_text`; post also names Lambda encrypted env vars). Typed Worker-to-Worker RPC and service-binding `fetch`, `toPromiseApi`, `Backend.bind`. Typed `Cloudflare.Workflow` with `task` checkpoints and `sleep`. `Cloudflare.Workers.cron`. Analytics Engine dataset binding. R2 `emptyOnDestroy` (opt out with `false`). D1 `prepare`/`bind` sync. Unresolved `Output` coercion throws. WASM in the dev sidecar. |
| 2026-05-13 | beta.38 | Email Routing + Address + Rule + `SendEmail` (`send` / `sendRaw`). `Alchemy.Action` (input-hash Effect during apply, GC drops state, `--force` reruns, stable-signal so no precreate stubs). Neon moved onto `@distilled.cloud/neon` tagged errors. Apply transport retries dropped connections. `effect@4.0.0-beta.66` lockstep. Vendored `ignore`. OTel dashboards: usage rank and error rate per Stack/Stage. |
| 2026-05-13 | beta.39 | `VITE_*` env inlined into Vite client/SSR bundles; other env stays Worker bindings; `VITE_` + `Redacted` is a public-bundle opt-in. Worker HTTP adapter uses Effect's handled lifecycle (`RpcServer.toHttpEffect` unblocked; stream scope, HEAD, abort). `SendEmail` actually inferred and deployed as `send_email`. |
| 2026-05-15 | beta.40 | **Upgrade off beta.39.** Revert `scopeTransferToStream` (415s and state-store 500s). Cloudflare state store **v5** (older clients refuse the file). Real Vite dev server (HMR, SSR, worker, one process) via `@distilled.cloud/cloudflare-vite-plugin`. AiGateway diffs against observed state. Worker 500s hide `Cause` from the client. `JSON.stringify` on Lambda, ECS, EC2-hosted, Worker, and Container entrypoint import paths. `Cloudflare.start` options reach the container runtime. Dev lockfile in `@alchemy.run/node-utils`. `Axiom.Chart` `smartfilter`. |
| 2026-05-20 | beta.41 | Per-request Worker/DO/Workflow scopes (`Scope.makeUnsafe`, no cached promise). `WorkerBridge.ts`. `env` participates in `InferEnv`. `ExecutionContext` + `WorkerExecutionContext`. DO methods see Worker env. `Redacted` preserved across sidecar RPC. `destroy` force-deletes Worker scripts. CLI `pending` and eager terminal status. `toHttpClient` + `getByName` for typed DO HTTP/RPC clients. |
| 2026-05-20 | beta.42 | npm-only TDZ hotfix: Platform `onCreate` / `createRuntimeContext` wrapped in arrows. |
| 2026-05-21 | beta.43 | `alchemy/Planetscale` MySQL and Postgres database, branch, and role/password. `Drizzle.Schema` migrations applied transactionally via `migrationsDir`. `Drizzle.postgres` on Hyperdrive (no `Drizzle.mysql`). `Resource.ref()` on every resource. `Alchemy.localState()` shown. Login stores PlanetScale credentials. Binding `R` collapses to `Alchemy.RuntimeContext` (no leaked `WorkerEnvironment`). |
| 2026-05-22 | beta.44 | `Cloudflare.Zaraz.Config` (omit = leave live config; `delete: true` to reset). `build.bundleAnalyzer` replaces removed `build.metafile`. Artifacts binding in dev. `RpcProvider` / `RpcSpawner` supervise local `workerd` (process-group kill, session cache, lazy provider layers). `?raw` imports. Local DO id fixes. `alchemy dev` honors `assets` and forwarded proto/for headers. `mysql2` bundles. Rolldown 1.0.1. |
| 2026-05-29 | beta.45 | **Breaking:** `Alchemy.Secret` / `Alchemy.Variable` removed; `bindings` renamed `env`; `effect/Config` bound only from Init (or `env` for async Workers). `Cloudflare.RpcWorker` and `Cloudflare.RpcDurableObject` plus modular `Class.make` / `Class.from`. Browser Rendering binding. Cross-script DO binding. `Random.KeyPair`. Lambda `FunctionProps.timeout`. Queue durations accept `Duration.Input`. `Worker.url` canonical inference. Workflows, Analytics Engine, SendEmail, custom ports in `alchemy dev`. |
| 2026-05-31 | beta.46 | `Cloudflare.VectorizeIndex` (immutable; `preset` or dimensions+metric) and `VectorizeMetadataIndex` (create before insert; then `filter`). Cloudflare state-store bootstrap reads remote state and stops rotating the encryption key and auth token. `bun alchemy cloudflare bootstrap --force`. Decrypt → `undefined`, invalid token self-heals, missing store is recreated. |
| 2026-06-01 | beta.47 | AI Gateway as Effect AI `LanguageModel` (`.model`, `generateText` / `streamText`, gateway cache/limit/retry/log). Worker/DO bridge accepts a returned `Stream`. `alchemy login` does not eval the stack; state-store init is deferred. `props.env` Config reaches local Workers. |
| 2026-06-01 | beta.48 | `Cloudflare.Zone.Zone` retain-by-default, `adopt()`, `destroy()`. `defaultRemovalPolicy`, `retain()`/`destroy()` default true. Runtime Tunnel Read/Write/ReadWrite bindings mint a scoped `AccountApiToken` as `secret_text`. `Cloudflare.RateLimit`. `alchemy cloudflare create-token` (`--all-permissions`, Global API Key, token not stored). `BrowserRendering` → `Browser`. Yieldable `Browser`, `Images`, `DynamicWorkerLoader`. Distilled 0.22.3 `ZoneAlreadyExists`. |
| 2026-06-01 | beta.49 | Runtime DNS Read/Write/ReadWrite bound to one zone (no `zoneId` arg; zone-scoped `AccountApiToken`). `Output.flatMap` and method `.map` / `.mapEffect` / `.flatMap`. **Security:** every Init `Config` is `secret_text`; redeploy secrets that were stored as plain text on earlier betas. `Redacted.value` only on real `Redacted` values. |

### Consolidated inventory (beta.35–49 only)

**Resources and bindings:** Queues consumer, R2 bucket custom domains, R2 lifecycle, R2 empty-on-destroy, Images, Hyperdrive, Email Routing / Address / Rule / SendEmail, Analytics Engine dataset, Workflow, cron, Vectorize index + metadata index, AI Gateway, Zone, Tunnel Read/Write/ReadWrite, DNS Read/Write/ReadWrite, RateLimit, Browser (renamed from BrowserRendering), Artifacts (dev), Zaraz Config, PlanetScale MySQL/Postgres database+branch+password/role, Neon project/branch (logical replication; Hyperdrive origin; SDK swap), Drizzle Schema + `Drizzle.postgres`, Random.KeyPair, Alchemy.Action, RpcWorker, RpcDurableObject, Website.Vite, Worker, DurableObject.

**CLI surface named in these posts:** `deploy`, `destroy`, `plan`, `dev`, `test` (pre-existing; `--stage`, `--force`); `alchemy cloudflare state ls`; `alchemy aws state get <key>`; `bun alchemy cloudflare bootstrap --force`; `alchemy cloudflare create-token [--name] [--all-permissions]`; `bun alchemy login`; `bun alchemy dev`; `bun alchemy deploy`.

**State:** `Cloudflare.state()`, `Alchemy.localState()`, cross-stage/stack reads, Cloudflare store format v5, bootstrap that preserves remote encryption key and auth token, AWS read command `alchemy aws state get`. No S3 `BucketState` type is named.

**Effect model named in these posts:** Init-phase `yield*` binds Config, queues, cron, tunnels, DNS, images, and vectorize; `fetch` does not bind Config. Per-request `Scope`. `Alchemy.RuntimeContext` instead of `WorkerEnvironment`. `Output.map` / `mapEffect` / `flatMap` / `stackRef` / unresolved-coercion throw. `Resource.ref`. Actions as hash-keyed apply Effects. `RpcServer.toHttpEffect`, `HttpRouter.toHttpEffect`, `LanguageModel`, `Stream` as a legal Worker/DO RPC return.

---

## 3. Relevance to this monorepo

Target shape used as the filter: Cloudflare Workers + R2; AWS EC2 autoscaling runner fleet, Lambda, S3, IAM, KMS, budgets; GitHub repository settings; a custom Vercel provider over `@distilled.cloud/vercel`; Docker over SSH; an AWS S3 `BucketState` store.

### Use now (Workers + R2)

These posts are mostly a Workers/R2 design guide. Do not rebuild them.

- **R2.** Custom domains as a string array reconciled on deploy, optionally with a `Zone` for DNS (beta.35, https://alchemy.run/blog/2026-05-08-beta-35/). Lifecycle rules, max 1000, empty array clears (beta.36, https://alchemy.run/blog/2026-05-09-beta-36/). Destroy drains the bucket unless `emptyOnDestroy: false` (beta.37, https://alchemy.run/blog/2026-05-12-beta-37/). Runtime client is `Cloudflare.R2.ReadWriteBucket` + `ReadWriteBucketBinding`.
- **Workers.** Non-string bindings (beta.35); `bindings` renamed to `env` and `effect/Config` bound from Init as `secret_text` (beta.45, https://alchemy.run/blog/2026-05-29-beta-45/, and the beta.49 hotfix, https://alchemy.run/blog/2026-06-01-beta-49/). Per-request scopes if you serve `HttpApi` or `RpcServer` (beta.41, https://alchemy.run/blog/2026-05-20-beta-41/). `RpcWorker` / `RpcDurableObject` for typed in-account calls (beta.45). Vite site + `VITE_*` inlining + real dev server (beta.39–40). Queue Stream consumer, cron, workflows, email, analytics, vectorize, AI Gateway, rate limit, images, hyperdrive, browser rendering — all bindable, all in the posts above.
- **Zones, DNS, tunnels.** `Cloudflare.Zone.Zone` is retain-by-default with `adopt()` / `destroy()` (beta.48, https://alchemy.run/blog/2026-06-01-beta-48/). Runtime DNS and Tunnel clients mint a least-privilege `AccountApiToken` into `secret_text` (beta.48 and beta.49). That is the zone/DNS half of "pair an R2 custom domain with a Zone" from beta.35.
- **Tokens.** `alchemy cloudflare create-token` for a CI `CLOUDFLARE_API_TOKEN`, curated or `--all-permissions`, not stored by the CLI (beta.48).
- **Monorepo stage graph.** `Resource.ref` / `Backend.stage.<name>` / `Alchemy.Stack` outputs are the PR-preview pattern: one shared stage owns the expensive resource, PR stages own the cheap branch and the Worker (beta.37, beta.43). `InvalidReferenceError` if the shared stage was never deployed. `alchemy deploy --stage` / `alchemy destroy --stage`.
- **Actions.** Migrations, cache busts, and deploy announcements that must sit in the DAG are `Alchemy.Action`, not a shell step beside deploy (beta.38, https://alchemy.run/blog/2026-05-13-beta-38/).
- **Local dev.** `RpcSpawner` owns `workerd` (beta.44, https://alchemy.run/blog/2026-05-22-beta-44/). `*.localhost` (beta.36). Artifacts, workflows, analytics, send-email, and custom ports in `alchemy dev` (beta.44, beta.45). Login must not need the stack to eval (beta.47, https://alchemy.run/blog/2026-06-01-beta-47/).

### AWS — only what these posts actually say

- **State CLI, not a bucket resource.** `alchemy aws state get <key>` exists as of beta.35 (https://alchemy.run/blog/2026-05-08-beta-35/). The post does not say the backend is S3, does not name `BucketState`, and does not show `put`, locking, or encryption-at-rest.
- **Lambda.** Entrypoint codegen exists and stringifies `importPath` (beta.40, https://alchemy.run/blog/2026-05-15-beta-40/). `timeout` on `FunctionProps` sets Lambda timeout (beta.45, https://alchemy.run/blog/2026-05-29-beta-45/). Beta.37 says `Alchemy.Secret` mapped to "Lambda encrypted env vars on AWS"; beta.45 deletes `Alchemy.Secret` and does not say `Config` still does that. Do not invent a KMS binding from that sentence.
- **EC2.** The only mention is "EC2-hosted" entrypoint codegen in the same `JSON.stringify(importPath)` fix (beta.40). No autoscaling group, launch template, runner fleet, or instance resource appears in beta.35–49.
- **ECS.** Named only as an entrypoint codegen target (beta.40). Not a fleet API.
- **S3, IAM, KMS, budgets.** Not mentioned in these fifteen posts.

### Cloudflare state store — relevant, and not S3

If the monorepo's store is the Cloudflare one, beta.40 and beta.46 are operational:

- Format **v5**; older clients refuse the file (https://alchemy.run/blog/2026-05-15-beta-40/).
- Bootstrap must read remote state. `bun alchemy cloudflare bootstrap --force` updates without rotating the encryption key or auth token. A rotated key makes old state undecryptable. Decrypt failure now returns `undefined`; bad tokens refresh; a missing store is recreated (https://alchemy.run/blog/2026-05-31-beta-46/).
- Login defers store init until use, so a missing `Config` during `alchemy login` does not brick store creation (https://alchemy.run/blog/2026-06-01-beta-47/).
- Beta.39's stream-scope change caused **500**s against this store; beta.40 reverted it. Do not carry that patch forward.

`Alchemy.localState()` is the other backend shown (beta.43 example, https://alchemy.run/blog/2026-05-21-beta-43/). `Cloudflare.state()` is what the cross-stack sample passes (beta.37).

### Custom Vercel provider over `@distilled.cloud/vercel`

No Vercel resource, no `@distilled.cloud/vercel`, no Vercel CLI in these posts.

The pattern a custom provider is supposed to follow is visible on Neon, not on Vercel: beta.38 deletes Alchemy's hand-rolled HTTP shim and calls `@distilled.cloud/neon/Operations`, catching SDK tagged errors (`NotFound`) and retrying with `Schedule` (https://alchemy.run/blog/2026-05-13-beta-38/). Beta.40 plugs `@distilled.cloud/cloudflare-vite-plugin` rather than reimplementing Vite (https://alchemy.run/blog/2026-05-15-beta-40/). Beta.48 bumps distilled to `0.22.3` for `ZoneAlreadyExists` instead of matching error strings (https://alchemy.run/blog/2026-06-01-beta-48/). Beta.43's `Planetscale.providers()` + `bun alchemy login` credential file is the registration shape (`Layer.mergeAll` into `Alchemy.Stack` `providers`). That is as far as these posts go.

### Docker over SSH

Not mentioned. Adjacent and easy to over-read:

- `Cloudflare.start` forwards options to the **Cloudflare container runtime** (beta.40). That is not SSH and not Docker.
- Entrypoint codegen includes "Cloudflare Container" (beta.40).
- Local `workerd` is supervised by `RpcSpawner`, which `SIGKILL`s the process group (beta.44). That is a local dev process, not a remote Docker daemon.

### GitHub repository settings

Not mentioned in beta.35–49. No repo, branch protection, environment, or Actions resource.

### Secrets (applies to every provider above)

Beta.49 is a hard requirement if any beta.45–48 deploy bound `Config` on a Worker: those values may be plain text in Cloudflare, and a redeploy after beta.49 stores them as `secret_text` (https://alchemy.run/blog/2026-06-01-beta-49/). Do not `JSON.stringify` secrets into bindings (beta.35 already removed that pattern for non-strings; beta.45/49 replace it with `Config`).

---

## 4. Do not roll your own

Things these posts show Alchemy already provides. Each line is one of the fifteen posts, not a guess about later betas.

1. **Queue batch consumer.** `Cloudflare.Queues.messages(...).subscribe` is an Effect `Stream` with `ack`/`retry`, `maxRetries`, and redelivery on mid-batch crash. Needs `Cloudflare.Queues.EventSourceLive`. https://alchemy.run/blog/2026-05-08-beta-35/
2. **R2 custom hostnames.** `customDomains: string[]` on `Cloudflare.R2.Bucket`; Alchemy reconciles attachments. Pair with `Zone` for DNS. https://alchemy.run/blog/2026-05-08-beta-35/
3. **R2 lifecycle.** Age, storage class, multipart abort, in the bucket props. Empty array clears. https://alchemy.run/blog/2026-05-09-beta-36/
4. **R2 teardown.** Destroy empties the bucket first. Opt out with `emptyOnDestroy: false`. https://alchemy.run/blog/2026-05-12-beta-37/
5. **Typed non-string Worker config.** Numbers, booleans, and objects as bindings; no `JSON.stringify` / `as` cast. https://alchemy.run/blog/2026-05-08-beta-35/
6. **Secrets and env.** `effect/Config` (`Config.redacted`, `Config.string`) yielded in Init, or placed on `env` for async Workers. Not `Alchemy.Secret` / `Alchemy.Variable` (removed). Not a hand-rolled secret binder. Redeploy after beta.49 so values are `secret_text`. https://alchemy.run/blog/2026-05-29-beta-45/ https://alchemy.run/blog/2026-06-01-beta-49/
7. **Cross-stage and cross-stack references.** `Resource.ref`, `yield* SomeStack`, `SomeStack.stage.<name>`. Plan reads the other state file. Destroy does not delete what you do not own. https://alchemy.run/blog/2026-05-12-beta-37/ https://alchemy.run/blog/2026-05-21-beta-43/
8. **Worker-to-Worker calls.** Service binding, `toPromiseApi`, `Backend.bind`, or `Cloudflare.RpcWorker` / `RpcWorker.bind` (in-account, typed from the schema). https://alchemy.run/blog/2026-05-12-beta-37/ https://alchemy.run/blog/2026-05-29-beta-45/
9. **Durable Object RPC that keeps `Schema.Class`.** `Cloudflare.RpcDurableObject` plus `getByName` inside `Effect.scoped`. The built-in bridge's `JSON.stringify` drops class identity. https://alchemy.run/blog/2026-05-29-beta-45/
10. **DO/Worker HTTP clients that stay in the isolate.** `Cloudflare.toHttpClient(stub)` with a placeholder `baseUrl`. https://alchemy.run/blog/2026-05-20-beta-41/
11. **Per-request Worker scopes.** Do not cache the Worker Effect as a module promise. beta.41 already fixed hung `fetch` and cross-context promises. https://alchemy.run/blog/2026-05-20-beta-41/
12. **Workflows.** `Cloudflare.Workflow` typed in/out, `Workflows.task` checkpoints, `Workflows.sleep`. https://alchemy.run/blog/2026-05-12-beta-37/
13. **Cron.** `Cloudflare.Workers.cron(...).subscribe` in the same Worker. https://alchemy.run/blog/2026-05-12-beta-37/
14. **Analytics Engine.** `Cloudflare.AnalyticsEngine.Dataset` and `writeDataPoint`. https://alchemy.run/blog/2026-05-12-beta-37/
15. **Email.** Routing, destination address, rules, and `SendEmail` (`send` / `sendRaw`). https://alchemy.run/blog/2026-05-13-beta-38/ https://alchemy.run/blog/2026-05-13-beta-39/
16. **Apply-time side effects.** `Alchemy.Action` (hash, skip, `--force`, DAG edges, no delete hook). https://alchemy.run/blog/2026-05-13-beta-38/
17. **Images.** `Cloudflare.Images` over a `Stream<Uint8Array>`. https://alchemy.run/blog/2026-05-09-beta-36/
18. **Hyperdrive.** Over a foreign connection string or `Neon.Branch.origin` / PlanetScale `role.origin`. Fresh `pg` client per request is the documented pattern; Hyperdrive pools. https://alchemy.run/blog/2026-05-09-beta-36/ https://alchemy.run/blog/2026-05-21-beta-43/
19. **Drizzle as a resource.** `Drizzle.Schema` plus `migrationsDir` transactional apply. `Drizzle.postgres` for the Worker client. (No `Drizzle.mysql` in this range.) https://alchemy.run/blog/2026-05-21-beta-43/
20. **PlanetScale.** Database, branch, role/password, `Planetscale.providers()`, login credential file. https://alchemy.run/blog/2026-05-21-beta-43/
21. **Neon client.** Use Alchemy's `Neon.Project` / `Branch`, which already call `@distilled.cloud/neon`. Do not keep a private HTTP wrapper. https://alchemy.run/blog/2026-05-13-beta-38/
22. **Vite on Workers.** `Cloudflare.Website.Vite` for build-time `VITE_*` and for the dev server (HMR, SSR, worker). https://alchemy.run/blog/2026-05-13-beta-39/ https://alchemy.run/blog/2026-05-15-beta-40/
23. **Bundle report.** `build.bundleAnalyzer`. `build.metafile` is gone. https://alchemy.run/blog/2026-05-22-beta-44/
24. **`?raw` imports** in the Worker bundler. https://alchemy.run/blog/2026-05-22-beta-44/
25. **Local provider processes.** `RpcProvider` / `RpcSpawner` (exit hook, respawn). Do not leak `workerd` and pkill it by hand. https://alchemy.run/blog/2026-05-22-beta-44/
26. **Artifacts binding in dev.** No extra code. https://alchemy.run/blog/2026-05-22-beta-44/
27. **Zaraz.** `Cloudflare.Zaraz.Config`; omitted fields are not wiped; destroy does not reset the zone unless `delete: true`. https://alchemy.run/blog/2026-05-22-beta-44/
28. **Vectorize.** Index + metadata index + Effect client (`upsert`, `query`, filter). https://alchemy.run/blog/2026-05-31-beta-46/
29. **Effect AI via AI Gateway.** `.model(...)` → `LanguageModel` for `generateText` / `streamText`. Gateway already does cache, rate limit, retry, and request log. https://alchemy.run/blog/2026-06-01-beta-47/
30. **Returning a `Stream` from Worker/DO RPC.** Legal as of beta.47; do not wrap it in `Effect.succeed` to dodge the old crash. https://alchemy.run/blog/2026-06-01-beta-47/
31. **Zones.** `Cloudflare.Zone.Zone`, `AdoptPolicy.adopt()`, `RemovalPolicy.destroy()` / `retain()`, `defaultRemovalPolicy`. https://alchemy.run/blog/2026-06-01-beta-48/
32. **Runtime Cloudflare Tunnels** with a scoped account token. https://alchemy.run/blog/2026-06-01-beta-48/
33. **Runtime DNS CRUD** bound to one zone, no `zoneId` argument. https://alchemy.run/blog/2026-06-01-beta-49/
34. **Rate limiting.** `Cloudflare.RateLimit` yieldable or on `env`. https://alchemy.run/blog/2026-06-01-beta-48/
35. **API token mint.** `alchemy cloudflare create-token`. https://alchemy.run/blog/2026-06-01-beta-48/
36. **Browser rendering binding** (`Cloudflare.Browser`, not `BrowserRendering`). Yieldable, like Images and `DynamicWorkerLoader`. https://alchemy.run/blog/2026-06-01-beta-48/ https://alchemy.run/blog/2026-05-29-beta-45/
37. **Key pair resource.** `Random.KeyPair`. https://alchemy.run/blog/2026-05-29-beta-45/
38. **Lambda timeout.** `FunctionProps.timeout`. https://alchemy.run/blog/2026-05-29-beta-45/
39. **Queue time props.** `Duration.Input` (`"30 seconds"`), not hand-converted seconds. https://alchemy.run/blog/2026-05-29-beta-45/
40. **Output combinators.** `Output.map`, `Output.mapEffect`, `Output.flatMap` (and the methods). Unresolved outputs throw on JS coercion instead of shipping `"[object Output]"`. https://alchemy.run/blog/2026-06-01-beta-49/ https://alchemy.run/blog/2026-05-12-beta-37/
41. **Binding requirement channel.** Depend on `Alchemy.RuntimeContext`, not `WorkerEnvironment`. https://alchemy.run/blog/2026-05-21-beta-43/
42. **State inspection CLI.** `alchemy cloudflare state ls`, `alchemy aws state get <key>`. https://alchemy.run/blog/2026-05-08-beta-35/
43. **Cloudflare state-store bootstrap.** `bun alchemy cloudflare bootstrap --force` against remote state so the encryption key and auth token stay put. https://alchemy.run/blog/2026-05-31-beta-46/
44. **Login.** `bun alchemy login` reads providers/state statically and does not eval the stack or init the store early. PlanetScale creds land in `~/.alchemy/credentials/<profile>/`. https://alchemy.run/blog/2026-06-01-beta-47/ https://alchemy.run/blog/2026-05-21-beta-43/
45. **Worker canonical URL.** `Worker.url` infers it and keeps domain order. https://alchemy.run/blog/2026-05-29-beta-45/
46. **OTel dashboards** per Stack/Stage (usage and error rate) and `Axiom.Chart` `smartfilter`. Dashboard config, not an app metrics client. https://alchemy.run/blog/2026-05-13-beta-38/ https://alchemy.run/blog/2026-05-15-beta-40/
47. **Apply transport retries.** Dropped apply-worker connections back off and resume. https://alchemy.run/blog/2026-05-13-beta-38/
48. **Dev hostname routing.** `*.localhost` to the sidecar. https://alchemy.run/blog/2026-05-09-beta-36/
49. **Entrypoint path codegen** for Lambda, ECS, EC2-hosted, Worker, and Cloudflare Container (`JSON.stringify`). https://alchemy.run/blog/2026-05-15-beta-40/
50. **Stuck Worker teardown.** `destroy` force-deletes scripts with wedged DO migrations. https://alchemy.run/blog/2026-05-20-beta-41/

### Not in this range — do not treat the list above as covering them

GitHub repository settings; Vercel and `@distilled.cloud/vercel`; Docker over SSH; EC2 autoscaling or a runner fleet; S3 buckets; IAM; KMS; budgets; an S3 `BucketState` store. The only AWS state operation these posts name is `alchemy aws state get <key>` (https://alchemy.run/blog/2026-05-08-beta-35/). The only Lambda knobs they name are entrypoint path codegen (https://alchemy.run/blog/2026-05-15-beta-40/) and `FunctionProps.timeout` (https://alchemy.run/blog/2026-05-29-beta-45/).
