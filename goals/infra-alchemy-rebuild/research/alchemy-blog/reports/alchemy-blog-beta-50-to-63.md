# Alchemy blog catalog: v2.0.0-beta.50 through v2.0.0-beta.63

Scope: the fourteen official release posts from 2026-06-01 through 2026-07-17. Every claim below is taken from the published post at the cited URL. The post bodies were cross-checked against the source markdown in the Alchemy repo (`website/src/content/docs/blog/<slug>.md` on `alchemy-run/alchemy` `main`). No other sources were used.

Posts, in order:

- https://alchemy.run/blog/2026-06-01-beta-50/
- https://alchemy.run/blog/2026-06-02-beta-51/
- https://alchemy.run/blog/2026-06-05-beta-52/
- https://alchemy.run/blog/2026-06-10-beta-53/
- https://alchemy.run/blog/2026-06-10-beta-54/
- https://alchemy.run/blog/2026-06-11-beta-55/
- https://alchemy.run/blog/2026-06-17-beta-56/
- https://alchemy.run/blog/2026-06-19-beta-57/
- https://alchemy.run/blog/2026-06-24-beta-58/
- https://alchemy.run/blog/2026-06-27-beta-59/
- https://alchemy.run/blog/2026-07-06-beta-60/
- https://alchemy.run/blog/2026-07-08-beta-61/
- https://alchemy.run/blog/2026-07-14-beta-62/
- https://alchemy.run/blog/2026-07-17-beta-63/

Empty cells mean the post does not introduce that category. "Effect concept" covers bindings, sinks, phases, telemetry, references, layers, and the plan/runtime split when the post names them.

---

## 1. Per-post catalog

### beta.50 — Reliable Dev Ports

- Date: 2026-06-01 (`2026-06-01T22:00:00Z`). Version: `v2.0.0-beta.50`. https://alchemy.run/blog/2026-06-01-beta-50/
- New or changed resources: none named as new types. Changed behavior: Vite in `alchemy dev` listens on a random port behind a `WorkerProxy`, and port-conflict detection in `cloudflare-runtime` actually fires ([#513](https://github.com/alchemy-run/alchemy/pull/513)). https://alchemy.run/blog/2026-06-01-beta-50/
- Provider package: `cloudflare-runtime` (conflict detection and `WorkerProxy`). https://alchemy.run/blog/2026-06-01-beta-50/
- CLI: `alchemy dev` (port assignment). https://alchemy.run/blog/2026-06-01-beta-50/
- State store: none.
- Testing: none.
- Effect concept: an `Output` (for example `backend.url.as<string>()`) passed into a Worker's `env` is no longer `yield*`'d at deploy time. `bindWorkerAsyncBindings` checks for an `Output` before yielding, because `Output.bind()` needs `RuntimeContext`, which does not exist at deploy. The crash was `Service not found: RuntimeContext` ([#514](https://github.com/alchemy-run/alchemy/pull/514)). https://alchemy.run/blog/2026-06-01-beta-50/
- Breaking change: none stated.
- Migration: none.
- Tips: put another Worker's URL into a Vite site's `env` as `VITE_API_URL: backend.url.as<string>()`; the reference is meant to resolve at runtime, not during deploy. https://alchemy.run/blog/2026-06-01-beta-50/

### beta.51 — Rulesets & Chat Persistence

- Date: 2026-06-02 (`2026-06-02T20:00:00Z`). Version: `v2.0.0-beta.51`. https://alchemy.run/blog/2026-06-02-beta-51/
- New or changed resources:
  - `Cloudflare.Ruleset` owns a zone ruleset phase entrypoint (WAF custom rules, redirects, or any ruleset phase). Inputs: `zone`, `phase`, `rules`. Outputs: `rulesetId`, `kind`, `version`, resolved `rules`. Zone or phase change replaces the ruleset; rule edits update in place. The resource owns the whole phase, so rules managed elsewhere in that phase are overwritten ([#240](https://github.com/alchemy-run/alchemy/pull/240)). https://alchemy.run/blog/2026-06-02-beta-51/
  - `Cloudflare.DurableObjectChatPersistence`: Effect AI `BackingPersistence` on the surrounding Durable Object's `state.storage` / SQLite, used under `Chat.makePersisted({ storeId })`, with `${storeId}:` key namespacing. TTL is ignored because DO storage has no native TTL ([#390](https://github.com/alchemy-run/alchemy/pull/390)). https://alchemy.run/blog/2026-06-02-beta-51/
  - `Cloudflare.SecretsStore.Secret` in a Worker's `env` maps to a native `secrets_store_secret` binding (`SecretsStoreSecret.get()`) ([#475](https://github.com/alchemy-run/alchemy/pull/475)). https://alchemy.run/blog/2026-06-02-beta-51/
  - S3 → Lambda notifications via `S3.notifications(bucket).subscribe(...)` are now actually applied to the bucket. The auto-created Lambda permission uses `lambda:InvokeFunction` (the old string `lambda.InvokeFunction` was invalid). Props gain `prefix` / `suffix` filters mapped to S3 `FilterRules` ([#470](https://github.com/alchemy-run/alchemy/pull/470)). https://alchemy.run/blog/2026-06-02-beta-51/
  - Drizzle `Schema` passes the previous snapshot id into `generateDrizzleJson` ([#519](https://github.com/alchemy-run/alchemy/pull/519)). https://alchemy.run/blog/2026-06-02-beta-51/
  - PlanetScale MySQL/Postgres Database outputs drop the `kind` attribute that collided with the output proxy discriminator ([#518](https://github.com/alchemy-run/alchemy/pull/518)). https://alchemy.run/blog/2026-06-02-beta-51/
- Provider package: Cloudflare (Ruleset, Secrets Store, Durable Object chat). AWS S3 notifications. PlanetScale output cleanup. https://alchemy.run/blog/2026-06-02-beta-51/
- CLI: resource-scoped `.pipe(adopt(true))` overrides the stack/CLI-wide adopt default in both directions; the planner honors it ([#521](https://github.com/alchemy-run/alchemy/pull/521)). https://alchemy.run/blog/2026-06-02-beta-51/
- State store: none.
- Testing: none named.
- Effect concept:
  - `Alchemy.Stack`, `Cloudflare.Worker`, and other Platform effects permit `ConfigError` instead of `never`. `Config.string` in a stack body no longer needs `Effect.orDie`; the error surfaces on the effect ([#487](https://github.com/alchemy-run/alchemy/pull/487)). https://alchemy.run/blog/2026-06-02-beta-51/
  - Outputs are identified by symbol, not a duck-typed `kind` property, so user data with a `kind` field is not misread as an Output expression ([#517](https://github.com/alchemy-run/alchemy/pull/517)). https://alchemy.run/blog/2026-06-02-beta-51/
  - S3 notifications are an event-source sink: `subscribe` runs a `Stream` of object events. https://alchemy.run/blog/2026-06-02-beta-51/
  - Chat persistence is a Layer: `Effect.provide(Cloudflare.DurableObjectChatPersistence)` under `Chat.makePersisted`, paired with `Cloudflare.AiGatewayBindingLive` and `Cloudflare.AiGateway.bind`. https://alchemy.run/blog/2026-06-02-beta-51/
- Breaking change: none called out as a migration. Behavior change: a `Ruleset` overwrites other rules in the same phase. https://alchemy.run/blog/2026-06-02-beta-51/
- Migration: drop `Effect.orDie` around stack bodies that only failed because of `ConfigError` (the post's diff removes `.pipe(Effect.orDie)`). https://alchemy.run/blog/2026-06-02-beta-51/
- Tips:
  - A prefix filter is required when an S3 notification handler writes back into the same bucket; otherwise `processed/` writes retrigger the subscription forever. https://alchemy.run/blog/2026-06-02-beta-51/
  - One Durable Object instance is one persisted chat thread. https://alchemy.run/blog/2026-06-02-beta-51/
  - Do not share a ruleset phase with rules managed outside Alchemy. https://alchemy.run/blog/2026-06-02-beta-51/

### beta.52 — Dev Servers & Browser Actions

- Date: 2026-06-05 (`2026-06-05T20:00:00Z`). Version: `v2.0.0-beta.52`. https://alchemy.run/blog/2026-06-05-beta-52/
- New or changed resources:
  - `Build.DevServer`: long-lived shell process scoped to the stack instance. Started in `alchemy dev`, restarted when inputs change, no-op on deploy, runs in the dev sidecar so it survives user-code HMR, mirrors stdout/stderr, and exposes the first `http(s)://` URL as `url`. `Cloudflare.StaticSite` grows a `dev` prop (`dev.command`, optional `dev.url`). `site.url` is the deployed URL on deploy and the local URL in dev ([#537](https://github.com/alchemy-run/alchemy/pull/537)). https://alchemy.run/blog/2026-06-05-beta-52/
  - `AssetsProps extends AssetsConfig`: `runWorkerFirst`, `htmlHandling`, and `notFoundHandling` sit directly on `assets` for `Worker`, `StaticSite`, and `Vite` ([#534](https://github.com/alchemy-run/alchemy/pull/534)). https://alchemy.run/blog/2026-06-05-beta-52/
  - `BrowserClient` from `yield* Cloudflare.Browser(...)`: JSON actions `content`, `markdown`, `links`, `scrape`, `snapshot`, `json` return parsed payloads and fail with `BrowserError`; `screenshot` and `pdf` return a byte `Stream`. Provide `Cloudflare.BrowserBindingLive`. `raw` and `fetch` remain for `@cloudflare/puppeteer` ([#525](https://github.com/alchemy-run/alchemy/pull/525)). https://alchemy.run/blog/2026-06-05-beta-52/
  - `Cloudflare.Vite` and `Cloudflare.StaticSite` gain the zero-arg class form (`extends Cloudflare.Vite<Website>()("Website", props)`), yieldable and referenceable, plus `Cloudflare.InferEnv<typeof Website>` ([#527](https://github.com/alchemy-run/alchemy/pull/527)). https://alchemy.run/blog/2026-06-05-beta-52/
  - `yield* Cloudflare.VersionMetadata()` attaches `version_metadata` and returns `id`, `tag`, and `timestamp`; also declarable on `env` ([#524](https://github.com/alchemy-run/alchemy/pull/524)). https://alchemy.run/blog/2026-06-05-beta-52/
  - Drizzle `Schema.out` is a cwd-relative path so drizzle-kit resolves migrations no matter where alchemy is launched ([#551](https://github.com/alchemy-run/alchemy/pull/551)). https://alchemy.run/blog/2026-06-05-beta-52/
- Provider package: `@distilled.cloud/*` bumped to `0.23.1` ([#539](https://github.com/alchemy-run/alchemy/pull/539)). https://alchemy.run/blog/2026-06-05-beta-52/
- CLI: `alchemy dev` runs the StaticSite dev command instead of rebuilding. https://alchemy.run/blog/2026-06-05-beta-52/
- State store: none.
- Testing: class-form sites are both a yieldable Effect and a type other resources can reference, which is the hook for swapping implementations (the post demonstrates the type, not a test runner). https://alchemy.run/blog/2026-06-05-beta-52/
- Effect concept:
  - Workflow runs get a per-invocation `ExecutionContext` (scope + cache), so `Drizzle.postgres` resolves inside workflow steps the same way it does in a fetch or queue handler ([#515](https://github.com/alchemy-run/alchemy/pull/515)). https://alchemy.run/blog/2026-06-05-beta-52/
  - `retain` removal policy is honored on replace: the old generation of a replaced resource is retained, not only orphan deletes ([#548](https://github.com/alchemy-run/alchemy/pull/548)). https://alchemy.run/blog/2026-06-05-beta-52/
  - Changing a `Redacted` config or secret now triggers an update; redacted wrappers are unwrapped during diffing ([#549](https://github.com/alchemy-run/alchemy/pull/549)). https://alchemy.run/blog/2026-06-05-beta-52/
  - Local dev: Vite websites get a populated assets binding ([#547](https://github.com/alchemy-run/alchemy/pull/547)); cross-script Durable Object bindings work ([#540](https://github.com/alchemy-run/alchemy/pull/540)); multi-worker dev is more reliable under bun ([#535](https://github.com/alchemy-run/alchemy/pull/535)). https://alchemy.run/blog/2026-06-05-beta-52/
- Breaking changes:
  - `props.assets` is one flat shape. `assets.config.runWorkerFirst` becomes `assets.runWorkerFirst`. StaticSite `assetsConfig` is renamed `assets`. Prebuilt `{ path, hash, config }` becomes `{ directory, hash, ...config }` ([#534](https://github.com/alchemy-run/alchemy/pull/534)). https://alchemy.run/blog/2026-06-05-beta-52/
  - `effect` peer dependency bumped to `4.0.0-beta.78` ([#542](https://github.com/alchemy-run/alchemy/pull/542)). https://alchemy.run/blog/2026-06-05-beta-52/
- Migration: one-level un-nesting of asset props; rename `assetsConfig` to `assets`; match the effect peer. https://alchemy.run/blog/2026-06-05-beta-52/
- Tips: if a dev server does not print a URL, set `dev.url` explicitly. `Build.DevServer` is a no-op on deploy, so the same stack describes both loops. https://alchemy.run/blog/2026-06-05-beta-52/

### beta.53 — AWS Auth & Config Props

- Date: 2026-06-10 (`2026-06-10T18:00:00Z`). Version: `v2.0.0-beta.53`. https://alchemy.run/blog/2026-06-10-beta-53/
- New or changed resources:
  - AWS credentials resolve through Alchemy's auth provider, not `AWSEnvironment.Default` reading `AWS_PROFILE` / SSO directly ([#574](https://github.com/alchemy-run/alchemy/pull/574)). https://alchemy.run/blog/2026-06-10-beta-53/
  - `AWSEnvironment` is lazy: the service holds `Effect<AWSEnvironmentShape>`. `makeEnvironment` and `loadDefault` are removed ([#567](https://github.com/alchemy-run/alchemy/pull/567)). https://alchemy.run/blog/2026-06-10-beta-53/
  - R2 custom-domain updates ride out `NoSuchBucket` during R2's endpoint eventual-consistency window, including a create that loses a race ([commit 448ba756](https://github.com/alchemy-run/alchemy/commit/448ba756)). https://alchemy.run/blog/2026-06-10-beta-53/
  - S3 bucket tag-fetch requirements narrowed to `Credentials | HttpClient | Region` ([#555](https://github.com/alchemy-run/alchemy/pull/555)). https://alchemy.run/blog/2026-06-10-beta-53/
  - Worker static-assets bundling fixed by a named import of `@alchemy.run/node-utils/ignore` ([#572](https://github.com/alchemy-run/alchemy/pull/572)). https://alchemy.run/blog/2026-06-10-beta-53/
- Provider package: AWS auth provider; `@distilled.cloud/cloudflare-runtime` `0.10.5` → `0.10.11`. https://alchemy.run/blog/2026-06-10-beta-53/
- CLI:
  - `alchemy login --configure` picks AWS auth: SSO (credentials from the AWS SSO cache), Environment Variables (`AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY`), or Stored (`~/.alchemy/credentials`). Profile selected by `ALCHEMY_PROFILE`. Account id comes from `STS.GetCallerIdentity` (Stored detects it from pasted keys; Environment Variables falls back to STS when `AWS_ACCOUNT_ID` is unset). CI automatically selects Environment Variables, so `aws-actions/configure-aws-credentials` keeps working ([#574](https://github.com/alchemy-run/alchemy/pull/574)). https://alchemy.run/blog/2026-06-10-beta-53/
  - `alchemy login` always refreshes credentials instead of trusting a non-expired cache ([#575](https://github.com/alchemy-run/alchemy/pull/575)). `--configure` no longer runs a redundant login after interactive setup. https://alchemy.run/blog/2026-06-10-beta-53/
- State store: none.
- Testing: none.
- Effect concept:
  - Auth providers are lazy: credentials resolve the first time a resource needs them. A stack that touches no AWS resources never prompts for AWS ([#567](https://github.com/alchemy-run/alchemy/pull/567)). https://alchemy.run/blog/2026-06-10-beta-53/
  - Inside lifecycle ops, read `yield* AWSEnvironment.current`, not `yield* AWSEnvironment`. https://alchemy.run/blog/2026-06-10-beta-53/
  - `effect/Config` resolves inside any resource input prop, top-level or nested in objects and arrays, against the deploy environment's `ConfigProvider`, so the concrete value enters diffing and hashing. `Config.redacted` stays a `Redacted` end to end ([#566](https://github.com/alchemy-run/alchemy/pull/566)). https://alchemy.run/blog/2026-06-10-beta-53/
  - Dev: race when a stack runs more than one Workflow in `alchemy dev` ([#573](https://github.com/alchemy-run/alchemy/pull/573)); Vite `require()` of Node built-ins in Worker code ([#556](https://github.com/alchemy-run/alchemy/pull/556)). https://alchemy.run/blog/2026-06-10-beta-53/
- Breaking changes: AWS auth path above; `AWSEnvironment.current`; removal of `makeEnvironment` and `loadDefault`. https://alchemy.run/blog/2026-06-10-beta-53/
- Migration: run `alchemy login --configure` once. Replace `yield* AWSEnvironment` with `yield* AWSEnvironment.current` in provider lifecycle code. https://alchemy.run/blog/2026-06-10-beta-53/
- Tips: do not plumb `AWS_PROFILE` / `AWS_ACCOUNT_ID` through the shell for Alchemy; the profile owns that. An opaque `Config` would hash the same regardless of its value, which is why props resolve Config before hashing. Example: `dev.port: Config.number("PORT").pipe(Config.withDefault(1338))`. https://alchemy.run/blog/2026-06-10-beta-53/

### beta.54 — Queues in Dev Mode

- Date: 2026-06-10 (`2026-06-10T22:00:00Z`). Version: `v2.0.0-beta.54`. https://alchemy.run/blog/2026-06-10-beta-54/
- New or changed resources: Cloudflare Queues and consumers work in `alchemy dev`. `Cloudflare.Queue.bind` is the producer; `Cloudflare.messages(queue).subscribe` is the consumer. Provide `Cloudflare.QueueBindingLive` and `Cloudflare.QueueEventSourceLive` ([#571](https://github.com/alchemy-run/alchemy/pull/571)). `QueueConsumer` persists `deadLetterQueue` and `settings` (batch size, concurrency, retries) via the exported `QueueConsumerSettings` interface. https://alchemy.run/blog/2026-06-10-beta-54/
- Provider package: local Cloudflare queue providers. PlanetScale promote/demote and Postgres resize waits; polling budgets 10 → 30 minutes, 60 for Postgres cluster-size changes ([#576](https://github.com/alchemy-run/alchemy/pull/576)). https://alchemy.run/blog/2026-06-10-beta-54/
- CLI: `alchemy dev` no longer requires Cloudflare credentials at startup; account id resolves lazily on the first live API call ([#578](https://github.com/alchemy-run/alchemy/pull/578)). `alchemy deploy` promotes local queues. Destroy of a stack that only ever ran locally skips the Cloudflare API. https://alchemy.run/blog/2026-06-10-beta-54/
- State store: local runtime storage under `.alchemy/local`. Local resources get `dev:` ids instead of live Cloudflare ids. https://alchemy.run/blog/2026-06-10-beta-54/
- Testing: none.
- Effect concept: the consumer is a stream sink (`Stream.runForEach`). Dev-to-live promotion is an in-place update keyed by the `dev:` id, never a replacement. https://alchemy.run/blog/2026-06-10-beta-54/
- Breaking change: none stated.
- Migration: none.
- Tips: write the Worker once; the first real deploy upgrades the local queue and consumer under the same logical resource. https://alchemy.run/blog/2026-06-10-beta-54/

### beta.55 — AI Gateway Spend Caps

- Date: 2026-06-11 (`2026-06-11T20:00:00Z`). Version: `v2.0.0-beta.55`. https://alchemy.run/blog/2026-06-11-beta-55/
- New or changed resources: `Cloudflare.AiGatewaySpendingLimit` is a per-account singleton hard cap on cumulative AI Gateway spend. Amounts are cents (minimum `1_00` = $1.00). `duration`: `daily` | `weekly` | `monthly`. Strategy: `fixed` or `sliding`. `topUp` satisfies Cloudflare's `NO_MANUAL_TOPUP` bootstrap by observing `first_topup_success` and charging the default payment method only if the account has never topped up. 3-D Secure fails with `AiGatewaySpendingLimitTopupRequired` and must be finished in the dashboard. Auto recharge is on by default (`threshold` / `amount`); `autoRecharge: false` is a one-time bootstrap. Declare exactly one ([#569](https://github.com/alchemy-run/alchemy/pull/569)). https://alchemy.run/blog/2026-06-11-beta-55/
- Provider package: `alchemy/Cloudflare/Bridge` re-exports `fromCloudflareFetcher`, `toCloudflareFetcher`, `toHttpClient`, `fromCloudflareSocket`. The from-* helpers accept global `Fetcher` / `Socket` ([#581](https://github.com/alchemy-run/alchemy/pull/581)). https://alchemy.run/blog/2026-06-11-beta-55/
- CLI: `alchemy deploy` / `alchemy destroy` no longer leave a dangling process. Local `RpcProvider` layers (`providerServices` / `providerServicesEffect`) construct only when `AlchemyContext.dev` is set ([#580](https://github.com/alchemy-run/alchemy/pull/580)). https://alchemy.run/blog/2026-06-11-beta-55/
- State store: none.
- Testing: the TanStack Start example's `/api/hello` serves one object four ways (raw R2 binding, service-binding `fetch`, typed RPC `toRpcAsync`, and the `HttpClient` form), each with an integration test. https://alchemy.run/blog/2026-06-11-beta-55/
- Effect concept: framework workers (TanStack Start, Astro) turn `env.BACKEND` into an Effect `HttpClient` with `toHttpClient(fromCloudflareFetcher(env.BACKEND))`. The request rides the in-account service binding, not the public network. https://alchemy.run/blog/2026-06-11-beta-55/
- Breaking change: none stated.
- Migration: none. Operational caveat: the spending-limit resource cannot be declared twice in one account. https://alchemy.run/blog/2026-06-11-beta-55/
- Tips: `topUp` becomes inert after the first successful manual top-up and does not charge again. If you only want the bootstrap, set `autoRecharge: false`. https://alchemy.run/blog/2026-06-11-beta-55/

### beta.56 — 200+ Cloudflare Resources

- Date: 2026-06-17 (`2026-06-17T20:00:00Z`). Version: `v2.0.0-beta.56`. https://alchemy.run/blog/2026-06-17-beta-56/
- New or changed resources:
  - Cloudflare provider grows from 22 resources to 230 in [#601](https://github.com/alchemy-run/alchemy/pull/601) (+101k lines, 542 files, 189 new live-test suites). Named surfaces: Zero Trust (Access, Tunnels, Devices, Gateway, DLP), Magic Transit, Magic Network Monitoring, Load Balancing, DNS and DNS Firewall, SSL/TLS and certificates, Waiting Rooms, Logpush, Spectrum, Turnstile, API Shield, Bot Management, Page Shield, Workers for Platforms, Snippets, Zaraz, Registrar, Addressing, Alerting. Zero Trust examples in the post: `Cloudflare.Tunnel`, `TunnelRoute`, `AccessPolicy`, `AccessApplication`, `DeviceDefaultProfile` ([#570](https://github.com/alchemy-run/alchemy/pull/570)). https://alchemy.run/blog/2026-06-17-beta-56/
  - `Cloudflare.FlagshipApp` and `Cloudflare.FlagshipFlag`, plus `FlagshipApp.bind` and `FlagshipBindingLive`. Async Workers can put the app on `env` and use the raw binding ([#602](https://github.com/alchemy-run/alchemy/pull/602)). https://alchemy.run/blog/2026-06-17-beta-56/
  - `GitHub.Repository`: full repo lifecycle, reconciles by stable numeric id so a rename does not corrupt state. Props shown: `owner`, `name`, `visibility`, `deleteBranchOnMerge` ([#607](https://github.com/alchemy-run/alchemy/pull/607)). https://alchemy.run/blog/2026-06-17-beta-56/
  - `GitHub.events(...).subscribe`: provisions `GitHub.Webhook` at the Worker's URL; runtime verifies HMAC-SHA256 in constant time and hands typed payloads (`event.name` narrowed to the subscribed events) ([#619](https://github.com/alchemy-run/alchemy/pull/619)). https://alchemy.run/blog/2026-06-17-beta-56/
  - `bundle: false` on `Cloudflare.Worker` uploads a prebuilt `main` byte-for-byte (no rolldown, no minify) with glob `rules` for extra modules. Called out as the path for OpenNext and other external bundles ([#592](https://github.com/alchemy-run/alchemy/pull/592)). https://alchemy.run/blog/2026-06-17-beta-56/
  - Lambda function URLs accept full config: `url: { authType: "AWS_IAM", cors, invokeMode: "RESPONSE_STREAM" }`. IAM-auth URLs drop the public permission statement ([#614](https://github.com/alchemy-run/alchemy/pull/614)). https://alchemy.run/blog/2026-06-17-beta-56/
- Provider package: providers may implement `list()` returning the same `Attributes` shape as `read`, so enumerated items are directly deletable ([#620](https://github.com/alchemy-run/alchemy/pull/620)). Distilled Cloudflare SDK patches grow from 369 to 1,087 operations across 94 of 114 services, driven by 288 live-test suites. https://alchemy.run/blog/2026-06-17-beta-56/
- CLI:
  - `alchemy unsafe nuke` enumerates everything a profile's providers can see and deletes it. `--include` / `--exclude` are provider-id globs; `--filter` is JS with `resource` in scope and a truthy result **spares** the resource; `--dry-run` previews; `--yes` skips confirmation. Hidden from `--help` ([#624](https://github.com/alchemy-run/alchemy/pull/624)). https://alchemy.run/blog/2026-06-17-beta-56/
  - `alchemy plan` warm start 8.2s → 1.8s by lazy-loading the TUI and vite plugin and deferring distilled schema construction ([#618](https://github.com/alchemy-run/alchemy/pull/618)). https://alchemy.run/blog/2026-06-17-beta-56/
  - `alchemy dev` stays alive when apply fails and logs the full cause ([#582](https://github.com/alchemy-run/alchemy/pull/582)). https://alchemy.run/blog/2026-06-17-beta-56/
- State store: `AWS.state()` mirrors `Cloudflare.state()`. Objects live at `s3://{bucket}/{prefix}{stack}/{stage}/{fqn}.json`. Default bucket is auto-created and account-regional: `alchemy-state-{accountId}-{region}-an`. Pass `bucketName` / `prefix` to use your own. Credential resolution and bucket creation wait until the first state operation ([#585](https://github.com/alchemy-run/alchemy/pull/585)). https://alchemy.run/blog/2026-06-17-beta-56/
- Testing: 189 new live-test suites against a real Cloudflare account; the distilled flywheel records API behavior as typed-error patches (example: Turnstile `WidgetNotFound` for codes 10404 and 10407) instead of catch-blocks in the consumer. https://alchemy.run/blog/2026-06-17-beta-56/
- Effect concept:
  - `worker.url` is stable across deploys when the first domain is unchanged, so downstream references (webhook delivery URLs) stop phantom-updating ([#616](https://github.com/alchemy-run/alchemy/pull/616)). Same for `worker.durableObjectNamespaces` when the DO class set is unchanged ([#617](https://github.com/alchemy-run/alchemy/pull/617)). https://alchemy.run/blog/2026-06-17-beta-56/
  - `GitHub.events` is an event source subscribed inside Worker init; secret via `Config.redacted`. https://alchemy.run/blog/2026-06-17-beta-56/
  - StaticSite forwards `dev.env`, including `Redacted` secrets, to the external dev command ([#587](https://github.com/alchemy-run/alchemy/pull/587)). https://alchemy.run/blog/2026-06-17-beta-56/
  - Local assets binding no longer 500s in `alchemy dev` ([#613](https://github.com/alchemy-run/alchemy/pull/613)). https://alchemy.run/blog/2026-06-17-beta-56/
  - Drizzle drift detection is cached per plan/apply so drizzle-kit's rename prompt appears once instead of hanging `alchemy dev` ([#597](https://github.com/alchemy-run/alchemy/pull/597)). https://alchemy.run/blog/2026-06-17-beta-56/
- Breaking change: none stated in the caution block.
- Migration: none. `AWS.state({ bucketName, prefix })` is how you point state at an existing bucket instead of the auto-created one. https://alchemy.run/blog/2026-06-17-beta-56/
- Tips:
  - Nuke filter example spares `resource.workerName === "alchemy-state-store"` while including `Cloudflare.*`. The filter keeps matches; it does not select victims. https://alchemy.run/blog/2026-06-17-beta-56/
  - Repository reconcile-by-numeric-id means a rename is an update, not a new resource and a lost state row. https://alchemy.run/blog/2026-06-17-beta-56/
  - Use `bundle: false` when another bundler (OpenNext) already produced the worker. https://alchemy.run/blog/2026-06-17-beta-56/

### beta.57 — Containers in Dev & AI Search

- Date: 2026-06-19 (`2026-06-19T20:00:00Z`). Version: `v2.0.0-beta.57`. https://alchemy.run/blog/2026-06-19-beta-57/
- New or changed resources:
  - Cloudflare Containers run locally under `alchemy dev`: rolldown bundle, generated Dockerfile (`FROM oven/bun:1` or `node:22-slim` from `runtime`, externals auto-installed), docker build, wired into the local DO namespace. Dev containers get `dev:<uuid>` application ids and promote to a real `ContainerApplication` on deploy ([#636](https://github.com/alchemy-run/alchemy/pull/636)). https://alchemy.run/blog/2026-06-19-beta-57/
  - `Cloudflare.AiSearch` construct over an R2 bucket (or a URL for the web crawler). For R2 it provisions a least-privilege `AccountApiToken` (AI Search Index Engine permission group), an `AiSearchToken`, and an `AiSearchInstance`. `prefix` / `include` / `exclude` globs scope indexing. `AiSearchInstance.bind` exposes `chatCompletions` (RAG) and `search` (retrieval). `answer.chunks` are citations. Binding works in `alchemy dev` ([#639](https://github.com/alchemy-run/alchemy/pull/639), local binding fix [#642](https://github.com/alchemy-run/alchemy/pull/642)). https://alchemy.run/blog/2026-06-19-beta-57/
  - AWS wave ([#631](https://github.com/alchemy-run/alchemy/pull/631)): CloudFront `VpcOrigin`; ELBv2 `ListenerRule` and `TrustStore` (mTLS); Route53 `HostedZone` and `HealthCheck`. S3 `Bucket` gains SSE-KMS/DSSE encryption, public access block, CORS, lifecycle, ownership/ACL, access logging, website hosting, replication, intelligent tiering, object lock, and inline `policy`. CloudFront `Distribution` gains origin groups, geo restriction, access logging, trusted key groups, origin shield, VPC origins, and gRPC. Route53 `Record` gains routing policies. RDS, ECS, ELBv2, and SQS props deepen (~8,700 lines). https://alchemy.run/blog/2026-06-19-beta-57/
  - `AWS.KMS.Key` and `AWS.KMS.Alias` ([#641](https://github.com/alchemy-run/alchemy/pull/641)). Lambda `Alias` with weighted `routingConfig.AdditionalVersionWeights` ([#625](https://github.com/alchemy-run/alchemy/pull/625)). `reservedConcurrentExecutions` on Lambda `Function` ([#628](https://github.com/alchemy-run/alchemy/pull/628)). `LogGroup` retention, KMS encryption, log class, deletion protection ([#630](https://github.com/alchemy-run/alchemy/pull/630)). https://alchemy.run/blog/2026-06-19-beta-57/
- Provider package: distilled Cloudflare SDK repatched and regenerated six times this release. Fixes named for PageRule, Schema Validation, Images `Variant`, origin post-quantum encryption, Origin TLS client auth, and Pages `Project`, each as a typed error tag. https://alchemy.run/blog/2026-06-19-beta-57/
- CLI: `alchemy cloudflare create-token` can mint user API tokens and select permissions interactively. `bun alchemy dev` plus a local curl is the container smoke path. https://alchemy.run/blog/2026-06-19-beta-57/
- State store: `LocalState` writes a temp file and renames, so a crash mid-write cannot corrupt state. https://alchemy.run/blog/2026-06-19-beta-57/
- Testing: quota- and entitlement-bound live tests skip cleanly; transient errors retry on the typed tag (Magic Network Monitoring retries `MnnConfigMissing`). https://alchemy.run/blog/2026-06-19-beta-57/
- Effect concept:
  - Container class plus `.make()`, then `Cloudflare.Container.bind` and `Cloudflare.start` from a Durable Object, then `container.getTcpPort(3000)`. This bind/start shape is replaced in beta.58. https://alchemy.run/blog/2026-06-19-beta-57/
  - `diff.stables` overrides `provider.stables` so a diff can narrow stability per update and avoid spurious replacements ([#635](https://github.com/alchemy-run/alchemy/pull/635)). https://alchemy.run/blog/2026-06-19-beta-57/
  - `alchemy dev` no longer watches `node_modules` ([#646](https://github.com/alchemy-run/alchemy/pull/646)). Queue consumers created in dev promote cleanly ([#647](https://github.com/alchemy-run/alchemy/pull/647)). Local service bindings keep their entrypoints ([#643](https://github.com/alchemy-run/alchemy/pull/643)). https://alchemy.run/blog/2026-06-19-beta-57/
  - `Build.Command` accepts relative and absolute paths. `Artifacts.cached` is allowed in the local `RpcProvider` ([#648](https://github.com/alchemy-run/alchemy/pull/648)). https://alchemy.run/blog/2026-06-19-beta-57/
  - AWS lifecycle retries for eventual consistency and throttling: Scheduler, SQS DLQ wiring, SNS Topic, CloudFront, DynamoDB, EC2, IAM, and Kinesis. https://alchemy.run/blog/2026-06-19-beta-57/
- Breaking change: `effect` bumped to `4.0.0-beta.84`. Upstream renamed `ConfigProvider.get` to `ConfigProvider.load`. No Alchemy API renames in this post. https://alchemy.run/blog/2026-06-19-beta-57/
- Migration: bump `effect`; rename direct `ConfigProvider.get` calls to `ConfigProvider.load`. https://alchemy.run/blog/2026-06-19-beta-57/
- Tips: GitHub `Repository` docs in this release cover templates, rename, archive, and secrets ([#629](https://github.com/alchemy-run/alchemy/pull/629)). S3 encryption example uses `sseAlgorithm: "aws:kms"` plus `bucketKeyEnabled: true`. https://alchemy.run/blog/2026-06-19-beta-57/

### beta.58 — Platform Ergonomics

- Date: 2026-06-24 (`2026-06-24T22:00:00Z`). Version: `v2.0.0-beta.58`. https://alchemy.run/blog/2026-06-24-beta-58/
- New or changed resources:
  - Platform tags (`Worker`, `Container`) become pure identity. Props and the runtime implementation move onto a Layer via `.make(props, impl)`. One tag can have many Layers (prod vs test, real vs stub). The inline `Cloudflare.Worker(id, props, impl)` form is unchanged. https://alchemy.run/blog/2026-06-24-beta-58/
  - `DynamicWorkerLoader` renamed `WorkerLoader`; `load(...)` returns an Effect ([#653](https://github.com/alchemy-run/alchemy/pull/653)). https://alchemy.run/blog/2026-06-24-beta-58/
  - `Build` module removed. `Command` module ([#673](https://github.com/alchemy-run/alchemy/pull/673)):
    - `Command.Build` (was `Build.Command`): command that produces an asset, tracks `outdir`, optional `memo` content-hashes inputs and outputs.
    - `Command.Exec` (new): side-effect command (migrations, codegen, seeding); success is exit code 0; `memo` re-runs only when inputs change.
    - `Command.Dev` (was `Build.DevServer`): long-lived dev server in the sidecar, `url` output, no-op on `alchemy deploy`.
  - `StaticSite` (AWS and Cloudflare) and `Cloudflare.Workers.Worker` build and dev-serve through `Command`. https://alchemy.run/blog/2026-06-24-beta-58/
- Provider package: none new. Binding transport split is Cloudflare-native vs scoped HTTP. https://alchemy.run/blog/2026-06-24-beta-58/
- CLI: none new. State implication: resource type ids `Build.Command` / `Build.DevServer` no longer match existing state. https://alchemy.run/blog/2026-06-24-beta-58/
- State store: `Command.Build` output hash changes from `{ outdir, hash }` to `{ outdir, hash: { input, output } }`. https://alchemy.run/blog/2026-06-24-beta-58/
- Testing: `.make(props, fakeImpl)` is the documented way to swap a stub Layer for tests or per-stage config. https://alchemy.run/blog/2026-06-24-beta-58/
- Effect concept:
  - `DurableObjectState` is yielded in the outer init Effect, so a Layer can capture DO storage (and an R2 bucket) and expose a cloud-agnostic service whose public error channel is only `Alchemy.RuntimeContext`. https://alchemy.run/blog/2026-06-24-beta-58/
  - Containers: `yield*` the class to get a **running container**, not the `ContainerApplication`. Provide `Cloudflare.layerContainer(Class, options)` to bind, start, and monitor. `Layer.provideMerge` supplies it once at the outermost init. External images (context / dockerfile / registry) have no `.make()`; declare props on the tag and register `layerContainer` from the hosting DO. https://alchemy.run/blog/2026-06-24-beta-58/
  - Container RPC works: typed Effect methods on the container (`ping`, `readObject`) round-trip as Effects. `getTcpPort` remains for a raw fetch into a process inside the container. https://alchemy.run/blog/2026-06-24-beta-58/
  - Bindings become least-privilege capabilities: `Cloudflare.R2.ReadBucket` / `WriteBucket` / `ReadWriteBucket`, implemented by `*Binding` (native `env`) or `*Http` (scoped `AccountApiToken`, secret injected as Worker `secret_text` or a Container secret, REST via the token). Same client interface. KV, Queues, and other capability resources follow. Full AWS/Cloudflare migration is promised for beta.59. https://alchemy.run/blog/2026-06-24-beta-58/
- Breaking changes (all in this post):
  - Props move from the tag to `.make()` on the Layer form of `Worker` / `Container`.
  - `DurableObjectState` resolves in the outer init Effect.
  - Replace `Cloudflare.Container.bind` / `Cloudflare.start` with `yield*`-the-class plus `Cloudflare.layerContainer`. Yielding the tag returns a running container.
  - A resource's single `.bind` is replaced by namespaced capabilities (`Cloudflare.R2.ReadWriteBucket`).
  - `Build.Command` → `Command.Build`; `Build.DevServer` → `Command.Dev`.
  - `DynamicWorkerLoader` → `WorkerLoader`, and `load` must be `yield*`'d.
- Migration: apply the diffs in the post. Existing state that names `Build.Command` or `Build.DevServer` will not match the renamed type ids. https://alchemy.run/blog/2026-06-24-beta-58/
- Tips: declare the container requirement in an inner Layer (`Bash` yields `Sandbox`) and provide `layerContainer` once at the host. A container process that has no native binding uses the `*Http` Layer, which mints a scoped token rather than an account-wide key. https://alchemy.run/blog/2026-06-24-beta-58/

### beta.59 — One Namespace, One Binding

- Date: 2026-06-27 (`2026-06-27T22:00:00Z`). Version: `v2.0.0-beta.59`. https://alchemy.run/blog/2026-06-27-beta-59/
- New or changed resources: almost no new behavior. Coordinated rename of ~900 symbols across ~1200 files ([#690](https://github.com/alchemy-run/alchemy/pull/690)). New type: `Cloudflare.WebSocket` for hibernatable WebSocket handlers. Folder moves: `Container/` → `Containers/`, `Queue` → `Queues`, workflows into `Workflows/`. https://alchemy.run/blog/2026-06-27-beta-59/
- Provider package: AWS and Cloudflare bindings share one convention. https://alchemy.run/blog/2026-06-27-beta-59/
- CLI: none new.
- State store: none new. Legacy Worker custom-domain state is coerced so old state still deploys (see below). https://alchemy.run/blog/2026-06-27-beta-59/
- Testing: none.
- Effect concept:
  - Every Cloudflare service is a namespace: `Cloudflare.KV.Namespace`, `Cloudflare.R2.Bucket`, `Cloudflare.D1.Database`, `Cloudflare.Workers.Worker`. Root re-exports that still work: `Cloudflare.Worker`, `Container`, `DurableObject`, `Workflow`, `RateLimit`, and `Cloudflare.cron`. `DurableObjectNamespace` → `DurableObject`. https://alchemy.run/blog/2026-06-27-beta-59/
  - `AiGateway` / `AiSearch` / `AiSecurity` collapse into `Cloudflare.AI` (`AI.Gateway`, `AI.Search`, `AI.Dataset`, `AI.SearchInstance`, `AI.SecuritySettings`). https://alchemy.run/blog/2026-06-27-beta-59/
  - Bindings are directly callable: `AWS.DynamoDB.GetItem(table)`, `Cloudflare.R2.ReadWriteBucket(bucket)`. Verb-first least privilege: `Read` / `Write` / `ReadWrite` (`KV.ReadNamespace`, and the same for DNS: `Cloudflare.DNS.ReadDns` / `WriteDns` / `ReadWriteDns`). https://alchemy.run/blog/2026-06-27-beta-59/
  - `*Binding` = native Cloudflare Worker binding. `*Http` = scoped HTTP client. AWS impls rename `*Live` → `*Http` (`DynamoDB.GetItemHttp`, `SQS.SendMessageHttp`, `S3.GetObjectHttp`) because AWS calls the distilled HTTP API with the Lambda role. AWS `*Http` emits a least-privilege IAM statement. Cloudflare `*Http` mints an `AccountApiToken` limited to that access level's permission groups. https://alchemy.run/blog/2026-06-27-beta-59/
  - `Binding.Policy` (and `Binding.ServiceClass`, `Policy`, `PolicyLike`) is removed. One `Binding.Service` does deploy-time wiring behind `if (!globalThis.__ALCHEMY_RUNTIME__)`, then always returns the typed client. At runtime the guard is set, the bind branch is skipped, and the bundle stays small. https://alchemy.run/blog/2026-06-27-beta-59/
  - Worker-only bindings take a string id: `Images("PIPELINE")` not `Images({ name })`. Native layers drop `*Live` / `*Layer` (`BrowserBindingLive` → `BrowserBinding`). https://alchemy.run/blog/2026-06-27-beta-59/
  - `Artifacts.Store` → `Artifacts.Namespace`; `ReadWriteStore` → `ReadWriteNamespace` (and `Read*` / `Write*`). https://alchemy.run/blog/2026-06-27-beta-59/
  - Event sources become `consume<Resource><Event>(resource, handler)`. The table in the post: `SQS.messages(q).subscribe` → `SQS.consumeQueueMessages`; `S3.notifications(b).subscribe` → `S3.consumeBucketEvents`; `SNS.notifications(t).subscribe` → `SNS.consumeTopicNotifications`; `Kinesis.records(s).process` → `Kinesis.consumeStreamRecords`; `DynamoDB.stream(t).process` → `DynamoDB.consumeTableChanges`; `GitHub.events(r).subscribe` → `GitHub.consumeRepositoryEvents`; `Queues.messages(q).subscribe` → `Queues.consumeQueueMessages`. Dropping `.subscribe` drops the handler's runtime requirements at the source boundary, so explicit `Body` type arguments no longer break inference. https://alchemy.run/blog/2026-06-27-beta-59/
  - `deleteFirst` is honored on replace: default remains create-first; `deleteFirst` deletes the previous generation before creating the replacement, for fixed physical names and singletons ([#692](https://github.com/alchemy-run/alchemy/pull/692)). https://alchemy.run/blog/2026-06-27-beta-59/
- Breaking changes: the whole rename list in the caution block (namespaces, `AI` collapse, callable least-privilege bindings, `Binding.Policy` removal, `*Live` → `*Binding`/`*Http`, `consume*` event sources, string ids for worker-only bindings, `Artifacts.Namespace`). https://alchemy.run/blog/2026-06-27-beta-59/
- Migration: find-and-replace using the post's diffs. Common root names (`Cloudflare.Worker`, `DurableObject`, `Container`, `Workflow`, `RateLimit`, `cron`) still resolve. https://alchemy.run/blog/2026-06-27-beta-59/
- Tips:
  - Worker custom-domain state from Alchemy ≤ beta.44 stored `{ id, hostname, zoneId }`; beta.45+ stores `https://<hostname>` strings. Older state is coerced so deploy does not throw `u.endsWith is not a function` ([#694](https://github.com/alchemy-run/alchemy/pull/694), issue [#546](https://github.com/alchemy-run/alchemy/issues/546)). https://alchemy.run/blog/2026-06-27-beta-59/
  - A `ReadNamespace` HTTP binding mints a read-only token; do not share one account-wide API key across capabilities. https://alchemy.run/blog/2026-06-27-beta-59/

### beta.60 — Docker, MicroVMs & RSC

- Date: 2026-07-06 (`2026-07-06T22:00:00Z`). Version: `v2.0.0-beta.60`. https://alchemy.run/blog/2026-07-06-beta-60/
- New or changed resources:
  - `alchemy/Docker`: `Image`, `RemoteImage`, `Container`, `Volume`, `Network`. They drive the `docker` CLI's active context: Docker Desktop, a remote/SSH context, or a CI daemon, in the same Stack as cloud resources. Secrets go through process env, never the CLI. Pulled tags are pinned so redeploys are no-ops. Containers created outside Alchemy follow standard adoption ([#649](https://github.com/alchemy-run/alchemy/pull/649)). https://alchemy.run/blog/2026-07-06-beta-60/
  - `AWS.Lambda.MicrovmImage`: snapshot-booted microVMs. Author the in-VM server in TypeScript (Alchemy bundles it, generates the Dockerfile, builds the snapshot server-side) or bring a Dockerfile or prebuilt artifact. Operations `RunMicrovm`, `GetMicrovm`, suspend/resume/terminate, auth tokens, and image builds are `Binding.Service`s with least-privilege IAM. `connectMicrovm` is typed RPC. Binding a MicroVM operation from a `Cloudflare.Worker` mints an IAM user plus an assume-role Role ([#712](https://github.com/alchemy-run/alchemy/pull/712)). https://alchemy.run/blog/2026-07-06-beta-60/
  - Workers for Platforms: `Cloudflare.WorkersForPlatforms.DispatchNamespace`, Worker `namespace` prop (no second resource type), `WorkersForPlatforms.Get` binding or `env.DISPATCH` for async workers ([#715](https://github.com/alchemy-run/alchemy/pull/715)). https://alchemy.run/blog/2026-07-06-beta-60/
  - `Cloudflare.Vite` `viteEnvironments: { entry, children }` for multi-environment builds, notably RSC (`{ entry: "rsc", children: ["ssr"] }`). Default remains `{ entry: "ssr", children: [] }`. The `client` environment always deploys as static assets. Dev-server restart fingerprint becomes an exact structural signature ([#685](https://github.com/alchemy-run/alchemy/pull/685)). https://alchemy.run/blog/2026-07-06-beta-60/
  - Class-based Workflows bind to async Workers via `env`, with `scriptName` for cross-script refs, same as async Durable Objects ([#707](https://github.com/alchemy-run/alchemy/pull/707)). https://alchemy.run/blog/2026-07-06-beta-60/
  - Cloudflare Container defaults match wrangler: `maxInstances: 20`, scale-from-zero, `instanceType: "lite"` when no custom limits are set (the old default `maxInstances: 1` serialized every DO through one slot). Readiness probes get per-probe timeouts mirroring `@cloudflare/containers`. A stopped or crashed container restarts on the next request; a crash loop fails fast ([#708](https://github.com/alchemy-run/alchemy/pull/708), [#711](https://github.com/alchemy-run/alchemy/pull/711)). https://alchemy.run/blog/2026-07-06-beta-60/
  - `ServerHost` + `{ fetch }` works on `AWS.ECS.Task`: Bun HTTP server entry, every chunk shipped into the image, build matches the task architecture, smoke-tested as a real Fargate service behind an ALB ([#713](https://github.com/alchemy-run/alchemy/pull/713)). https://alchemy.run/blog/2026-07-06-beta-60/
  - Hosted `AWS.EC2.Instance` serves HTTP the same way, with a reboot-safe systemd unit that self-heals transient boot failures ([#714](https://github.com/alchemy-run/alchemy/pull/714)). New `AWS.EC2.KeyPair`: generated private key captured once as `Redacted`. https://alchemy.run/blog/2026-07-06-beta-60/
  - Neon `Project` / `Branch` and PlanetScale `PostgresRole` expose `pooledOrigin` ([#718](https://github.com/alchemy-run/alchemy/pull/718), [#717](https://github.com/alchemy-run/alchemy/pull/717)). PlanetScale branch replica intent persists so `replicas: 0` converges ([#719](https://github.com/alchemy-run/alchemy/pull/719)). https://alchemy.run/blog/2026-07-06-beta-60/
- Provider package: `alchemy/Docker`. AWS Lambda MicroVM bindings. https://alchemy.run/blog/2026-07-06-beta-60/
- CLI:
  - `alchemy deploy --yes` auto-accepts the Cloudflare state-store upgrade and deploy prompts; no hang on a non-TTY ([#728](https://github.com/alchemy-run/alchemy/pull/728)). https://alchemy.run/blog/2026-07-06-beta-60/
  - CLI works on Windows: the stack entry loads via a `file://` URL ([#696](https://github.com/alchemy-run/alchemy/pull/696)). https://alchemy.run/blog/2026-07-06-beta-60/
  - Docs overhaul ([#721](https://github.com/alchemy-run/alchemy/pull/721)) includes first docs for `alchemy unsafe nuke` and adopting resources, plus a Testing section under Core. https://alchemy.run/blog/2026-07-06-beta-60/
- State store: partial state-store deploys are detected and recovered. The health check verifies a real store is serving, not only that a pre-create stub exists ([#700](https://github.com/alchemy-run/alchemy/pull/700)). https://alchemy.run/blog/2026-07-06-beta-60/
- Testing: ECS path is verified by a smoke test that deploys a real Fargate service behind an ALB. MicroVM cold-start numbers are in a separate post (700 isolated boots, 2–4.5s) and are not re-derived here. https://alchemy.run/blog/2026-07-06-beta-60/
- Effect concept:
  - MicroVM methods are `Binding.Service`s; `connectMicrovm` is typed RPC across the VM boundary. Cross-cloud: a Cloudflare Worker binding a MicroVM op gets an IAM user and assume-role Role. https://alchemy.run/blog/2026-07-06-beta-60/
  - `Command.Build` memo now includes the command and env, so two `StaticSite` builds that differ only by env (per-stage `EXPO_PUBLIC_*`, API ids) do not reuse each other's output ([#738](https://github.com/alchemy-run/alchemy/pull/738)). https://alchemy.run/blog/2026-07-06-beta-60/
  - Destroy reports `RemovalPolicy: "retain"` resources as `retained`, not deleted ([#739](https://github.com/alchemy-run/alchemy/pull/739)). https://alchemy.run/blog/2026-07-06-beta-60/
  - Durable Object classes created outside Alchemy adopt cleanly: class migrations fall back to the observed binding, so a wrangler/dashboard Worker keeps its DO classes ([#495](https://github.com/alchemy-run/alchemy/pull/495)). https://alchemy.run/blog/2026-07-06-beta-60/
  - Access Application `read` falls back to a domain scan and gates takeover on `--adopt`, instead of creating a duplicate app with a fresh `aud` ([#742](https://github.com/alchemy-run/alchemy/pull/742)). https://alchemy.run/blog/2026-07-06-beta-60/
  - AWS env-auth: `Region` is provided to STS during login ([#709](https://github.com/alchemy-run/alchemy/pull/709)); the `Region` / `AWSEnvironment` layer cycle in the account-id lookup is broken ([#710](https://github.com/alchemy-run/alchemy/pull/710)). https://alchemy.run/blog/2026-07-06-beta-60/
- Breaking change: the post says none. https://alchemy.run/blog/2026-07-06-beta-60/
- Migration: none required by the post. Container behavior changes (higher `maxInstances`, lite instance type) are new defaults when custom limits are absent, not a rename. https://alchemy.run/blog/2026-07-06-beta-60/
- Tips: Docker adoption uses the same rules as other resources. Pin is automatic for pulled tags. Pass `Redacted` env to `Docker.Container` via `environment`; it will not land on the CLI argv. `AWS.EC2.KeyPair` `keyName` goes to the instance; `privateKey` is `Redacted` and captured once. https://alchemy.run/blog/2026-07-06-beta-60/

### beta.61 — Workers Cache, Routes & Sync

- Date: 2026-07-08 (`2026-07-08T06:00:00Z`). Version: `v2.0.0-beta.61`. https://alchemy.run/blog/2026-07-08-beta-61/
- New or changed resources:
  - Workers Cache: `yield* Cloudflare.cache({ crossVersionCache: true })` returns a typed `purge` client (`CachePurgeError`). Async Workers use `cache: { enabled: true, crossVersionCache: true }` ([#752](https://github.com/alchemy-run/alchemy/pull/752)). https://alchemy.run/blog/2026-07-08-beta-61/
  - `Cloudflare.Worker` `routes`: Wrangler-style `{ pattern, zoneName | zoneId | zone }`. Omitted zone is inferred from the pattern hostname. Reconciled on deploy, removed on destroy ([#438](https://github.com/alchemy-run/alchemy/pull/438)). https://alchemy.run/blog/2026-07-08-beta-61/
  - `Cloudflare.AI.ProviderKey` owns the BYOK pair: a Secrets Store secret named `{gatewayId}_{providerSlug}_{alias}` plus a `GatewayProvider` ([#586](https://github.com/alchemy-run/alchemy/pull/586)). https://alchemy.run/blog/2026-07-08-beta-61/
  - Lambda `eventInvokeConfig` on `Function` and `Alias`: `maximumRetryAttempts`, `maximumEventAgeInSeconds`, `destinationConfig.OnFailure` / success destinations ([#627](https://github.com/alchemy-run/alchemy/pull/627)). https://alchemy.run/blog/2026-07-08-beta-61/
  - `Cloudflare.R2.Bucket` `cors` restored (flat S3-style rules: methods, origins, headers, expose headers, `maxAgeSeconds`), reconciled like `lifecycleRules` ([#771](https://github.com/alchemy-run/alchemy/pull/771)). https://alchemy.run/blog/2026-07-08-beta-61/
- Provider package: resource type `aliases` on the `Resource` declaration. https://alchemy.run/blog/2026-07-08-beta-61/
- CLI: `alchemy sync ./alchemy.run.ts --stage prod` converges live cloud to the last-deployed state without re-running the stack program. `--dry-run` detects only ([#766](https://github.com/alchemy-run/alchemy/pull/766)). https://alchemy.run/blog/2026-07-08-beta-61/
- State store:
  - `alchemy sync` per resource: `read` observes live state, deep-compare against persisted attributes, `reconcile` with persisted props as desired. Out-of-band deletes are recreated under the same instance id, so deterministic physical names regenerate. Resources sync concurrently; failures aggregate after every attempt. https://alchemy.run/blog/2026-07-08-beta-61/
  - Type `aliases` (example `Cloudflare.Queues.Queue` aliases `Cloudflare.Queue`) are resolved by plan, apply, destroy, `logs`, and `tail`. A noop deploy migrates state rows to the canonical name. All 74 resources renamed in beta.59 carry their pre-rename alias ([#765](https://github.com/alchemy-run/alchemy/pull/765)). https://alchemy.run/blog/2026-07-08-beta-61/
  - State-store errors include real messages; an unauthorized store tells you to run `alchemy login` ([#737](https://github.com/alchemy-run/alchemy/pull/737)). https://alchemy.run/blog/2026-07-08-beta-61/
  - Wedged stacks: a deploy interrupted mid-create used to persist Output-valued props that cannot round-trip and then crash every later plan/deploy/destroy. Provider `read`/`diff` is audited so the engine re-drives create and reconcile converges ([#767](https://github.com/alchemy-run/alchemy/pull/767), [#770](https://github.com/alchemy-run/alchemy/pull/770)). https://alchemy.run/blog/2026-07-08-beta-61/
- Testing: the test suite passes on Windows ([#735](https://github.com/alchemy-run/alchemy/pull/735)), including product fixes: `Drizzle.Schema` was passing OS-native paths to drizzle-kit (backslashes are glob escapes), and `Bundle.PurePlugin` could be hijacked by a stray `package.json` above `node_modules`. https://alchemy.run/blog/2026-07-08-beta-61/
- Effect concept:
  - `WorkerExecutionContext` is an Effect wrapper, yieldable from init like `DurableObjectState`. `waitUntil` takes an Effect and is `yield*`'d; it no longer wraps the raw `cf.ExecutionContext` ([#752](https://github.com/alchemy-run/alchemy/pull/752)). https://alchemy.run/blog/2026-07-08-beta-61/
  - Workflow wrapper matches the native binding ([#611](https://github.com/alchemy-run/alchemy/pull/611)): `create({ id, params, retention })`, `task` retries/timeout/rollback plus `WorkflowStepContext.attempt`, `waitForEvent` / `sendEvent`, `createBatch`, `restart`, rollback status, extended event metadata. https://alchemy.run/blog/2026-07-08-beta-61/
  - Worker metadata-only changes (compatibility flags/date, observability, placement, limits, bindings) enter the update diff via a metadata hash. Previously they planned as no-ops and never shipped. First deploy after upgrade plans one update per Worker to backfill the hash ([#747](https://github.com/alchemy-run/alchemy/pull/747)). https://alchemy.run/blog/2026-07-08-beta-61/
  - Script uploads retry every binding-target-not-found error (KV, R2, D1, Queues, DO classes, Hyperdrive, Vectorize, and more) to cover Cloudflare propagation lag ([#753](https://github.com/alchemy-run/alchemy/pull/753)). https://alchemy.run/blog/2026-07-08-beta-61/
  - `Resource.ref` values in Worker `env` bind natively instead of degrading to a JSON env var ([#756](https://github.com/alchemy-run/alchemy/pull/756)). https://alchemy.run/blog/2026-07-08-beta-61/
  - Multiple queue consumers on one Worker: dispatch runs every listener for an event type instead of letting the first subscription swallow the rest ([#466](https://github.com/alchemy-run/alchemy/pull/466)). https://alchemy.run/blog/2026-07-08-beta-61/
  - Drizzle query chains expose the full Effect protocol and compose with `Effect.all` ([#750](https://github.com/alchemy-run/alchemy/pull/750)). https://alchemy.run/blog/2026-07-08-beta-61/
  - `globalOutbound: null` is preserved on `WorkerLoader` (the documented "block all outbound" signal) ([#746](https://github.com/alchemy-run/alchemy/pull/746)). https://alchemy.run/blog/2026-07-08-beta-61/
  - Binding-hosted DO classes join the precreate stub, fixing `Worker did not expose Durable Object namespace` on fresh worker↔container cycles ([#764](https://github.com/alchemy-run/alchemy/pull/764)). https://alchemy.run/blog/2026-07-08-beta-61/
  - PlanetScale inherited roles compare by membership so API order does not replace a `PostgresRole` ([#761](https://github.com/alchemy-run/alchemy/pull/761)). https://alchemy.run/blog/2026-07-08-beta-61/
- Breaking changes:
  - `workflow.create(input)` → `workflow.create({ params: input })` ([#611](https://github.com/alchemy-run/alchemy/pull/611)). https://alchemy.run/blog/2026-07-08-beta-61/
  - `WorkerExecutionContext.waitUntil` takes an Effect ([#752](https://github.com/alchemy-run/alchemy/pull/752)). https://alchemy.run/blog/2026-07-08-beta-61/
  - `effect >= 4.0.0-beta.93` required; `UrlParams.makeUrl` moved to `Url.make` ([#748](https://github.com/alchemy-run/alchemy/pull/748)). https://alchemy.run/blog/2026-07-08-beta-61/
- Migration: wrap workflow create inputs in `{ params }`. Replace `ctx.waitUntil(promise)` with `yield* exec.waitUntil(effect)`. Bump effect. State from beta.58 and earlier deploys through the new aliases; do not hand-rewrite type strings. https://alchemy.run/blog/2026-07-08-beta-61/
- Tips: `alchemy sync` is the drift tool when someone edits the dashboard; it does not re-execute the stack program. Expect one planned Worker update on the first deploy after this version because of the metadata hash backfill. https://alchemy.run/blog/2026-07-08-beta-61/

### beta.62 — Build-Once Workers & GitHub Action

- Date: 2026-07-14 (`2026-07-14T06:00:00Z`). Version: `v2.0.0-beta.62`. https://alchemy.run/blog/2026-07-14-beta-62/
- New or changed resources:
  - Worker (and Durable Object) layers build once per isolate, on the first event, not on every request ([#774](https://github.com/alchemy-run/alchemy/pull/774)). https://alchemy.run/blog/2026-07-14-beta-62/
  - `GitHub.GitHubEnv` config: Actions metadata, `undefined` outside CI. `GitHub.Comment` posts a preview comment from `github.owner` / `repository` / `pr` / `sha`. https://alchemy.run/blog/2026-07-14-beta-62/
  - `Cloudflare.Website.Vite` accepts `main`, forwarded to the Vite plugin in dev and deploy, so the worker entry can export Durable Objects alongside the framework fetch handler ([#779](https://github.com/alchemy-run/alchemy/pull/779)). https://alchemy.run/blog/2026-07-14-beta-62/
- Provider package: provider lifecycle handlers receive the resource `fqn` alongside `id`, for collision-free ownership metadata ([#783](https://github.com/alchemy-run/alchemy/pull/783)). https://alchemy.run/blog/2026-07-14-beta-62/
- CLI:
  - Official action: `uses: alchemy-run/alchemy@main`. Opening a PR deploys `staging-{pr}`, closing destroys that stage, pushing to main deploys `prod` ([#699](https://github.com/alchemy-run/alchemy/pull/699)). https://alchemy.run/blog/2026-07-14-beta-62/
  - `alchemy login` offers PlanetScale browser OAuth, same shape as Cloudflare; env vars and service tokens still work ([#467](https://github.com/alchemy-run/alchemy/pull/467)). Shared `/auth/success` and `/auth/error` pages ([#780](https://github.com/alchemy-run/alchemy/pull/780)). https://alchemy.run/blog/2026-07-14-beta-62/
  - `alchemy state clear` respects `ALCHEMY_PROFILE` ([commit ba70585f](https://github.com/alchemy-run/alchemy/commit/ba70585f)). https://alchemy.run/blog/2026-07-14-beta-62/
- State store: state-store credentials are bound to the account. After `alchemy login --configure` switched accounts, reads and writes were still hitting the old account's store ([#760](https://github.com/alchemy-run/alchemy/pull/760)). https://alchemy.run/blog/2026-07-14-beta-62/
- Testing: `plan` no longer claims ownership of adopted resources. A read-only dry run could adopt an unowned cloud resource, and a later unrelated deploy would orphan-delete it ([#794](https://github.com/alchemy-run/alchemy/pull/794)). https://alchemy.run/blog/2026-07-14-beta-62/
- Effect concept:
  - Isolate-scoped layers need `handle_cross_request_promise_resolution`. Alchemy enables that compatibility flag automatically when the compatibility date is before 2024-10-14. Each awaiting event pins the in-flight build with `ctx.waitUntil`. Opting out with `no_handle_cross_request_promise_resolution` is a deploy-time error. https://alchemy.run/blog/2026-07-14-beta-62/
  - Disposable resources (pools, connections) move from init into the handler. The handler's per-event `Scope` finalizes after the response. Declaring `PgClient.make({ url })` in init acquires nothing; `yield*` it in the handler to connect on that event's `Scope`. https://alchemy.run/blog/2026-07-14-beta-62/
  - `proxyChain` from `alchemy/Util/proxy-chain` wraps a deferred client so yielding a query resolves the client on the current event's `Scope` and replays the chain. `Drizzle.postgres` is that pattern plus `Effect.cached`, so the first query in an event opens the pool, later queries reuse it, and the pool closes when the event settles. This is also why `Drizzle.postgres` works inside Durable Object methods. https://alchemy.run/blog/2026-07-14-beta-62/
  - Lambda's generated entry registers an internal extension, so the instance gets SIGTERM and about 500 ms to run init-level finalizers. https://alchemy.run/blog/2026-07-14-beta-62/
  - `Workers.cron` handlers keep their requirements on the Worker's init effect ([#791](https://github.com/alchemy-run/alchemy/pull/791)). https://alchemy.run/blog/2026-07-14-beta-62/
  - `alchemy dev`: hot reload no longer deletes the replacement worker's service-binding registration (`Worker not found` after every backend change) ([#812](https://github.com/alchemy-run/alchemy/pull/812)); container env vars work in dev ([#785](https://github.com/alchemy-run/alchemy/pull/785)); dev container images persist across restarts ([#727](https://github.com/alchemy-run/alchemy/pull/727)); remote images and external Dockerfiles work in `LocalContainerProvider` ([#790](https://github.com/alchemy-run/alchemy/pull/790)); the provider RPC session is cached ([#789](https://github.com/alchemy-run/alchemy/pull/789)); dev-URL detection prefers localhost/IP URLs ([#787](https://github.com/alchemy-run/alchemy/pull/787)). https://alchemy.run/blog/2026-07-14-beta-62/
  - Vite build output is read after the build resolves, fixing a bundling race in `Website` deploys ([#795](https://github.com/alchemy-run/alchemy/pull/795)). Container healthcheck durations must be unit-suffixed because Docker rejects bare numbers ([#778](https://github.com/alchemy-run/alchemy/pull/778)). https://alchemy.run/blog/2026-07-14-beta-62/
- Breaking changes:
  - Layers build once per isolate. Connections and pools must move from init to the handler ([#774](https://github.com/alchemy-run/alchemy/pull/774)). https://alchemy.run/blog/2026-07-14-beta-62/
  - `effect >= 4.0.0-beta.97`. effect removed several `Schedule` APIs; Alchemy is migrated and the peer floor matches ([#801](https://github.com/alchemy-run/alchemy/pull/801), [#813](https://github.com/alchemy-run/alchemy/pull/813)). https://alchemy.run/blog/2026-07-14-beta-62/
- Migration: move `acquirePool()`-style yields out of init. Keep client *descriptions* in init and yield them in the handler, or use `proxyChain` / `Drizzle.postgres`. Do not set `no_handle_cross_request_promise_resolution` on these Workers. Bump effect. https://alchemy.run/blog/2026-07-14-beta-62/
- Tips: init is for values that are safe to share for the life of the isolate (decoded config). Anything with a finalizer belongs on the event `Scope`. `GitHub.GitHubEnv` being `undefined` locally means the same stack can post a PR comment only in Actions. https://alchemy.run/blog/2026-07-14-beta-62/

### beta.63 — Durable Object Transfers & Action Bindings

- Date: 2026-07-17 (`2026-07-17T06:00:00Z`). Version: `v2.0.0-beta.63`. https://alchemy.run/blog/2026-07-17-beta-63/
- New or changed resources:
  - Durable Object class moves between Workers with storage intact, via Cloudflare `transferred_classes`. Declare `transferredFrom` on the class: a Worker logical id, a physical script name (cross-stack), the Worker class, or a thunk for import cycles. A second move is `transferredFrom: ["WorkerA", "WorkerB"]`; the namespace transfers from whichever listed host currently holds it. After completion the declaration is inert and can stay in code. An undeclared move fails before any upload with `DurableObjectTransferRequired`. Alchemy will not guess between transfer and delete ([#803](https://github.com/alchemy-run/alchemy/pull/803)). https://alchemy.run/blog/2026-07-17-beta-63/
  - DO metadata packs into a single script tag. One tag per DO binding hit Cloudflare's 10-tag-per-Worker limit at 7+ DOs ([#824](https://github.com/alchemy-run/alchemy/pull/824)). https://alchemy.run/blog/2026-07-17-beta-63/
  - PlanetScale MySQL `replicas` changes resize the keyspace in place instead of replacing the database ([#825](https://github.com/alchemy-run/alchemy/pull/825)). https://alchemy.run/blog/2026-07-17-beta-63/
  - The v2 site is served from `alchemy.run`; `v2.alchemy.run` 301s to it via a `Cloudflare.Ruleset.Ruleset` on phase `http_request_dynamic_redirect` ([#806](https://github.com/alchemy-run/alchemy/pull/806)). Note the doubled `Ruleset.Ruleset` name, which is the post-beta.59 namespace form. https://alchemy.run/blog/2026-07-17-beta-63/
- Provider package: `*Local` binding layers are a third variant next to `*Binding` and `*Http`. https://alchemy.run/blog/2026-07-17-beta-63/
- CLI:
  - `alchemy login` works with no `alchemy.run.ts`. It offers every built-in auth provider (AWS, Axiom, Cloudflare, GitHub, Neon, Planetscale); already-configured providers are pre-selected. In CI the prompt is skipped and all built-ins are configured non-interactively. With an entrypoint present, behavior is unchanged ([#842](https://github.com/alchemy-run/alchemy/pull/842)). https://alchemy.run/blog/2026-07-17-beta-63/
- State store: unresolved `Output` proxies are never persisted. An interrupted create could snapshot live proxies into state and poison later reads ([#835](https://github.com/alchemy-run/alchemy/pull/835)). https://alchemy.run/blog/2026-07-17-beta-63/
- Testing: `alchemy-test`, an Effect-native runner that executes the 4,000+ live-cloud suite in one bun process, lands in this release ([#848](https://github.com/alchemy-run/alchemy/pull/848)). The post points at a later write-up for the design; the capability claim (the runner exists and runs that suite in-process) is in this post. https://alchemy.run/blog/2026-07-17-beta-63/
- Effect concept:
  - `Alchemy.Action` can bind resources the way a Worker does and can read Outputs. `yield* database.databaseId` inside an Action records a dependency edge so the Action waits until the database exists. Provide a `*Local` layer (`Cloudflare.D1.QueryDatabaseLocal` in the example). `*Local` uses current CLI credentials and returns the same typed client. Every Cloudflare capability with an HTTP data plane has one: D1, KV, R2, Queues, DNS, Vectorize, Tunnel, AI Search, Browser Rendering, and more ([#807](https://github.com/alchemy-run/alchemy/pull/807)). https://alchemy.run/blog/2026-07-17-beta-63/
  - Vite-based Workers hash sibling workspace packages, so editing only a sibling package no longer skips the deploy ([#822](https://github.com/alchemy-run/alchemy/pull/822)). https://alchemy.run/blog/2026-07-17-beta-63/
  - Alchemy's Vite plugin does not double-register. Apps that also build standalone keep the plugin in `vite.config.ts`; Alchemy sets `ALCHEMY_CLOUDFLARE_VITE_INJECTED` when it injects its own ([#833](https://github.com/alchemy-run/alchemy/pull/833)). https://alchemy.run/blog/2026-07-17-beta-63/
  - Auto-bound `Config` resolves in request handlers. Re-yielding a `Config` inside a handler used to decode the secret marker JSON instead of the value ([#829](https://github.com/alchemy-run/alchemy/pull/829)). https://alchemy.run/blog/2026-07-17-beta-63/
  - `proxyChain` values pass `Effect.isEffect`, so chained Drizzle clients work with `Effect.catchTag` ([#827](https://github.com/alchemy-run/alchemy/pull/827)). https://alchemy.run/blog/2026-07-17-beta-63/
- Breaking change: none stated.
- Migration: when moving a DO class, add `transferredFrom` before deploy or the deploy fails closed. Do not delete the declaration after the first successful transfer if later stages may still be behind. https://alchemy.run/blog/2026-07-17-beta-63/
- Tips: `transferredFrom` is host history, not a one-shot flag. Physical script names are the cross-stack form. A thunk breaks import cycles between the class and its old host. Actions that seed data should use `*Local`, not a Worker `*Binding` and not a hand-rolled API token. https://alchemy.run/blog/2026-07-17-beta-63/

---

## 2. Timeline of capabilities

Dates are the post dates. Versions are `v2.0.0-beta.N`.

| Date | Version | What became possible |
| --- | --- | --- |
| 2026-06-01 | beta.50 | Deterministic Vite/Worker dev ports. `Output` values survive in Worker `env` until runtime. https://alchemy.run/blog/2026-06-01-beta-50/ |
| 2026-06-02 | beta.51 | Zone ruleset phases as a resource. DO-backed Effect AI chat history. S3→Lambda notifications that actually apply, with prefix/suffix. `Config` in stack bodies. Resource-scoped `adopt`. Secrets Store bindings. Symbol-identified Outputs. https://alchemy.run/blog/2026-06-02-beta-51/ |
| 2026-06-05 | beta.52 | Framework dev servers beside StaticSite (`Build.DevServer`). One flat `assets` shape. Typed Browser Rendering actions. Class-form Vite and StaticSite. Version metadata binding. Workflow step `ExecutionContext`. `retain` on replace. `Redacted` values participate in diff. effect `4.0.0-beta.78`. `@distilled.cloud/*` 0.23.1. https://alchemy.run/blog/2026-06-05-beta-52/ |
| 2026-06-10 | beta.53 | AWS auth on Alchemy profiles (`alchemy login --configure`: SSO, env, stored). Lazy `AWSEnvironment.current`. `Config` in any input prop, hashed as its concrete value. R2 custom domains tolerate `NoSuchBucket`. https://alchemy.run/blog/2026-06-10-beta-53/ |
| 2026-06-10 | beta.54 | Queues and consumers in `alchemy dev`, promoted in place from `dev:` ids. Dev starts without Cloudflare credentials. Consumer settings reconciled. https://alchemy.run/blog/2026-06-10-beta-54/ |
| 2026-06-11 | beta.55 | Account-wide AI Gateway spend cap. Framework workers wrap a service binding as an Effect `HttpClient` via `alchemy/Cloudflare/Bridge`. One-shot CLI no longer hangs on local provider layers. https://alchemy.run/blog/2026-06-11-beta-55/ |
| 2026-06-17 | beta.56 | Cloudflare catalog 22 → 230 resources, with `Provider.list` and `alchemy unsafe nuke`. Flagship flags. `GitHub.Repository` and webhook event source. `AWS.state()` S3 backend. `bundle: false`. Stable `worker.url`. Full Lambda function URL config. Faster `alchemy plan`. https://alchemy.run/blog/2026-06-17-beta-56/ |
| 2026-06-19 | beta.57 | Containers run under `alchemy dev` and promote. `AiSearch` construct over R2. Deep S3/CloudFront/Route53/ELB props. KMS key and alias, Lambda alias and reserved concurrency, log-group config. Atomic local state. effect `4.0.0-beta.84` / `ConfigProvider.load`. EC2, IAM, and other AWS lifecycles retry consistency and throttling. https://alchemy.run/blog/2026-06-19-beta-57/ |
| 2026-06-24 | beta.58 | Tags are identity; implementations are Layers. Running containers via `layerContainer` and working container RPC. Least-privilege R2/KV/Queue bindings, native or HTTP token. `Command.Build` / `Exec` / `Dev` replace `Build`. `WorkerLoader`. https://alchemy.run/blog/2026-06-24-beta-58/ |
| 2026-06-27 | beta.59 | One namespace per service. One `{Verb}{Resource}` binding convention on AWS and Cloudflare. `Binding.Policy` folded into the `__ALCHEMY_RUNTIME__` guard. Event sources are `consume*`. `deleteFirst` works. effect peers otherwise unchanged by Alchemy API behavior. https://alchemy.run/blog/2026-06-27-beta-59/ |
| 2026-07-06 | beta.60 | Docker resources on the active docker context, including SSH. Lambda MicroVMs with cross-cloud IAM. Workers for Platforms. Vite RSC environments. Async-worker Workflows. Wrangler-parity container defaults. Effectful HTTP on ECS/Fargate and EC2, plus `EC2.KeyPair`. Non-interactive `--yes`. State-store health check. Windows CLI. https://alchemy.run/blog/2026-07-06-beta-60/ |
| 2026-07-08 | beta.61 | Workers Cache and Effect `ExecutionContext`. Zone routes. `alchemy sync`. Full workflow create/task/event API. Type aliases for the beta.59 renames. AI Gateway BYOK. Lambda async invoke config. R2 CORS. Metadata-hash deploys. Wedged-state recovery. `Resource.ref` env bindings. effect `>=4.0.0-beta.93`. https://alchemy.run/blog/2026-07-08-beta-61/ |
| 2026-07-14 | beta.62 | Isolate-scoped Worker layers, `proxyChain`, per-event Drizzle pools, Lambda SIGTERM finalizers. GitHub Action with PR stages, `GitHubEnv`, PR comments. PlanetScale OAuth. Custom Vite worker entry. Account-bound state credentials. `plan` does not adopt. effect `>=4.0.0-beta.97`. https://alchemy.run/blog/2026-07-14-beta-62/ |
| 2026-07-17 | beta.63 | Declared DO transfers with data. Actions bind resources through `*Local` CLI-credential clients and read Outputs. `alchemy login` from any directory. Sibling workspace packages participate in Vite worker hashes. `alchemy-test` runs the live suite in one bun process. https://alchemy.run/blog/2026-07-17-beta-63/ |

Peer-dependency steps that a consumer must track: effect `4.0.0-beta.78` (beta.52), `4.0.0-beta.84` (beta.57), `>=4.0.0-beta.93` (beta.61), `>=4.0.0-beta.97` (beta.62). https://alchemy.run/blog/2026-06-05-beta-52/ https://alchemy.run/blog/2026-06-19-beta-57/ https://alchemy.run/blog/2026-07-08-beta-61/ https://alchemy.run/blog/2026-07-14-beta-62/

---

## 3. Relevance to this monorepo

Target: Cloudflare Workers + R2, AWS (EC2 autoscaling runner fleet, Lambda, S3, IAM, KMS, budgets), GitHub repository settings, a custom Vercel provider over `@distilled.cloud/vercel`, Docker over SSH, and an AWS S3 state store.

These posts do not mention AWS Budgets, an EC2 Auto Scaling group, or a Vercel provider. Those absences are absences in beta.50–63, not proof that the resources do not exist elsewhere.

### Cloudflare Workers + R2

Use the post-beta.59 names. Root `Cloudflare.Worker` still resolves; the namespaced form is `Cloudflare.Workers.Worker`. R2 is `Cloudflare.R2.Bucket`. https://alchemy.run/blog/2026-06-27-beta-59/

Workers, in the order they matter here:

- Dev loop: deterministic ports (beta.50); no Cloudflare credentials until a live call (beta.54); `alchemy dev` stays up when apply fails (beta.56); does not watch `node_modules` (beta.57); hot reload keeps service bindings (beta.62). https://alchemy.run/blog/2026-06-01-beta-50/ https://alchemy.run/blog/2026-06-10-beta-54/ https://alchemy.run/blog/2026-06-17-beta-56/ https://alchemy.run/blog/2026-06-19-beta-57/ https://alchemy.run/blog/2026-07-14-beta-62/
- Monorepo builds: Vite-based Workers hash sibling workspace packages, so a change in a dependent package redeploys (beta.63). `Command.Build` memo includes command and env, so per-stage public env does not collide (beta.60). `bundle: false` uploads a prebuilt worker if the monorepo bundler already ran (beta.56). `Website.Vite` `main` exports extra classes next to a framework handler (beta.62). Multi-environment Vite (`viteEnvironments`) covers RSC-style apps (beta.60). Set `ALCHEMY_CLOUDFLARE_VITE_INJECTED` awareness if the app also lists the Alchemy Vite plugin (beta.63). https://alchemy.run/blog/2026-07-17-beta-63/ https://alchemy.run/blog/2026-07-06-beta-60/ https://alchemy.run/blog/2026-06-17-beta-56/ https://alchemy.run/blog/2026-07-14-beta-62/
- Bindings: least-privilege `R2.ReadBucket` / `WriteBucket` / `ReadWriteBucket` with `*Binding` or `*Http` (beta.58, renamed in beta.59). `Resource.ref` in `env` stays a real binding (beta.61). `Output` URLs in `env` work (beta.50). Secrets Store secrets bind natively (beta.51). Metadata-only binding changes now actually deploy (beta.61). Uploads retry when a new R2/KV/D1/queue binding is not visible yet (beta.61). https://alchemy.run/blog/2026-06-24-beta-58/ https://alchemy.run/blog/2026-06-27-beta-59/ https://alchemy.run/blog/2026-07-08-beta-61/ https://alchemy.run/blog/2026-06-01-beta-50/ https://alchemy.run/blog/2026-06-02-beta-51/
- Runtime model: layers once per isolate; pools per event via `proxyChain` or `Drizzle.postgres`; do not opt out of cross-request promise resolution (beta.62). `Config` re-yielded in a handler returns the value, not the marker JSON (beta.63). Zone `routes` attach a Worker to a hostname pattern (beta.61). Workers Cache plus typed purge (beta.61). Version metadata binding (beta.52). https://alchemy.run/blog/2026-07-14-beta-62/ https://alchemy.run/blog/2026-07-17-beta-63/ https://alchemy.run/blog/2026-07-08-beta-61/ https://alchemy.run/blog/2026-06-05-beta-52/
- Durable Objects: outer-init `DurableObjectState` (beta.58); class is `Cloudflare.DurableObject` (beta.59); transfer between Workers only with `transferredFrom`, data kept, undeclared moves fail closed (beta.63); more than about seven DOs fit because metadata is one script tag (beta.63); adoption of classes created by wrangler (beta.60). https://alchemy.run/blog/2026-06-24-beta-58/ https://alchemy.run/blog/2026-06-27-beta-59/ https://alchemy.run/blog/2026-07-17-beta-63/ https://alchemy.run/blog/2026-07-06-beta-60/
- Queues: local dev with in-place promotion (beta.54); `consumeQueueMessages` (beta.59); multiple consumers on one Worker (beta.61); consumer settings including DLQ, batch, concurrency, retries (beta.54). https://alchemy.run/blog/2026-06-10-beta-54/ https://alchemy.run/blog/2026-06-27-beta-59/ https://alchemy.run/blog/2026-07-08-beta-61/

R2 specifically:

- Custom-domain updates tolerate `NoSuchBucket` (beta.53). https://alchemy.run/blog/2026-06-10-beta-53/
- `cors` is back, flat S3-style, reconciled against observed rules. The post's example is a public bucket serving browser range reads (beta.61). https://alchemy.run/blog/2026-07-08-beta-61/
- HTTP bindings mint a scoped `AccountApiToken` instead of an account-wide key, including from a container process (beta.58–59). Actions on a laptop or in CI use `*Local` with CLI credentials for the same client, and R2 is in that list (beta.63). https://alchemy.run/blog/2026-06-24-beta-58/ https://alchemy.run/blog/2026-06-27-beta-59/ https://alchemy.run/blog/2026-07-17-beta-63/
- `AiSearch` will provision token + instance over an R2 bucket if RAG is wanted; it is a construct, not one resource (beta.57). https://alchemy.run/blog/2026-06-19-beta-57/

### AWS

Auth first. `alchemy login --configure` stores SSO, env-var, or pasted credentials on `ALCHEMY_PROFILE`. CI selects env vars automatically, which matches `aws-actions/configure-aws-credentials` (beta.53). `Region` is provided to STS during login, and the Region/AWSEnvironment cycle is fixed (beta.60). Credentials are lazy, so a stack with no AWS resources does not prompt (beta.53). State-store credentials are bound to the account that logged in (beta.62). https://alchemy.run/blog/2026-06-10-beta-53/ https://alchemy.run/blog/2026-07-06-beta-60/ https://alchemy.run/blog/2026-07-14-beta-62/

S3 (application buckets, distinct from the state bucket):

- Notifications to Lambda work, with prefix/suffix, and the permission action is `lambda:InvokeFunction` (beta.51). After beta.59 the sink is `S3.consumeBucketEvents` (beta.59). https://alchemy.run/blog/2026-06-02-beta-51/ https://alchemy.run/blog/2026-06-27-beta-59/
- Bucket props that landed in beta.57 and should not be reimplemented: SSE-KMS and DSSE, public access block, CORS, lifecycle, ownership/ACL, access logging, website hosting, replication, intelligent tiering, object lock, inline policy. Tag fetches need only credentials, HTTP client, and region (beta.53). https://alchemy.run/blog/2026-06-19-beta-57/ https://alchemy.run/blog/2026-06-10-beta-53/

S3 state store: see the dedicated subsection below.

Lambda:

- Function URL config including `AWS_IAM` auth, CORS, and `RESPONSE_STREAM`; IAM auth does not leave a public invoke statement (beta.56). https://alchemy.run/blog/2026-06-17-beta-56/
- `Alias` with weighted routing, `reservedConcurrentExecutions` (beta.57), `eventInvokeConfig` retries/age/destinations on both Function and Alias (beta.61). https://alchemy.run/blog/2026-06-19-beta-57/ https://alchemy.run/blog/2026-07-08-beta-61/
- Generated Lambda entry gets SIGTERM and ~500 ms of init finalizers (beta.62). https://alchemy.run/blog/2026-07-14-beta-62/
- `MicrovmImage` if the fleet ever needs snapshot microVMs: TypeScript or a brought Dockerfile, least-privilege bindings, `connectMicrovm` RPC, and a Cloudflare Worker can assume a role Alchemy mints (beta.60). That is not the EC2 runner fleet. https://alchemy.run/blog/2026-07-06-beta-60/

IAM:

- AWS `*Http` bindings emit a least-privilege IAM statement on the Lambda role (beta.59). Do not hand-write those statements for SQS, S3, DynamoDB, and the other covered capabilities. https://alchemy.run/blog/2026-06-27-beta-59/
- IAM-authenticated Lambda URLs drop the public permission (beta.56). https://alchemy.run/blog/2026-06-17-beta-56/
- MicroVM-from-Worker mints an IAM user and assume-role Role (beta.60). https://alchemy.run/blog/2026-07-06-beta-60/
- IAM API operations retry eventual consistency and throttling (beta.57). The posts do not enumerate new IAM resource types such as `Role` or `Policy` in this window; they describe statements emitted by bindings and more robust IAM operations. https://alchemy.run/blog/2026-06-19-beta-57/

KMS:

- `AWS.KMS.Key` (`enableKeyRotation`) and `AWS.KMS.Alias` (beta.57). S3 bucket encryption can point at `aws:kms` with bucket keys. `LogGroup` takes `kmsKeyId`. https://alchemy.run/blog/2026-06-19-beta-57/

EC2 autoscaling runner fleet:

- Present: `AWS.EC2.Instance` can host the Effect `{ fetch }` server behind a reboot-safe systemd unit that retries transient boot failures, and `AWS.EC2.KeyPair` captures an ed25519 private key once as `Redacted` (beta.60). EC2 operations retry consistency and throttling (beta.57). https://alchemy.run/blog/2026-07-06-beta-60/ https://alchemy.run/blog/2026-06-19-beta-57/
- Not in these posts: an Auto Scaling group, launch template, scaling policy, or a GitHub-runner-specific resource. ECS/Fargate `Task` with an ALB is the closest "fleet behind a load balancer" pattern the posts actually add (beta.60), and it is a smoke-tested `ServerHost`, not a runner product. https://alchemy.run/blog/2026-07-06-beta-60/

Budgets: no AWS Budgets resource, alarm, or cost-filter API is described in beta.50–63. The only spend cap in this window is Cloudflare `AiGatewaySpendingLimit` (later `Cloudflare.AI`, beta.55 and the beta.59 rename). https://alchemy.run/blog/2026-06-11-beta-55/ https://alchemy.run/blog/2026-06-27-beta-59/

### GitHub repository settings

- `GitHub.Repository` is the lifecycle resource. Props the beta.56 post shows: `owner`, `name`, `visibility: "private"`, `deleteBranchOnMerge: true`. Reconcile is by stable numeric id, so a rename does not fork state (beta.56). Docs added in beta.57 cover templates, rename, archive, and secrets. https://alchemy.run/blog/2026-06-17-beta-56/ https://alchemy.run/blog/2026-06-19-beta-57/
- Webhooks: `GitHub.consumeRepositoryEvents` (the beta.59 name of `GitHub.events(...).subscribe`) provisions `GitHub.Webhook` and checks HMAC-SHA256. https://alchemy.run/blog/2026-06-17-beta-56/ https://alchemy.run/blog/2026-06-27-beta-59/
- CI around repos, which is not repository settings but is the deploy path: the official action maps PR open/close and main pushes to stages; `GitHub.GitHubEnv` and `GitHub.Comment` avoid a hand-rolled Actions metadata reader (beta.62). `alchemy login` can configure the GitHub provider with no local entrypoint (beta.63). https://alchemy.run/blog/2026-07-14-beta-62/ https://alchemy.run/blog/2026-07-17-beta-63/
- Not in these posts: branch protection, rulesets, actions permissions, environments, or merge queues as resources. Do not treat `GitHub.Repository` as that whole surface. https://alchemy.run/blog/2026-06-17-beta-56/

### Custom Vercel provider over `@distilled.cloud/vercel`

No Vercel resource is introduced in these posts. What they do document, and what a custom provider should copy:

- `@distilled.cloud/*` was bumped to 0.23.1 in beta.52, and `@distilled.cloud/cloudflare-runtime` 0.10.5 → 0.10.11 in beta.53. The package scope is the supported SDK surface. https://alchemy.run/blog/2026-06-05-beta-52/ https://alchemy.run/blog/2026-06-10-beta-53/
- The beta.56 flywheel is the provider pattern: implement resources against the generated SDK, live-test them, and when the API disagrees with the types, patch the SDK with a typed error (status/code → tag) instead of catching status codes in the provider. Beta.57 repeats that doctrine and regenerates distilled six times. https://alchemy.run/blog/2026-06-17-beta-56/ https://alchemy.run/blog/2026-06-19-beta-57/
- A provider can implement `list()` in the same `Attributes` shape as `read` (beta.56). Lifecycle handlers receive `fqn` as well as `id` so ownership metadata does not collide (beta.62). `diff.stables` can narrow `provider.stables` per update (beta.57). `deleteFirst` and `retain` are engine policies, not something a provider reimplements (beta.59, beta.52, beta.60). Resource `aliases` keep old state type strings working (beta.61). https://alchemy.run/blog/2026-06-17-beta-56/ https://alchemy.run/blog/2026-07-14-beta-62/ https://alchemy.run/blog/2026-06-19-beta-57/ https://alchemy.run/blog/2026-06-27-beta-59/ https://alchemy.run/blog/2026-07-08-beta-61/
- AWS bindings show the IAM-shaped version of the same idea: a capability Layer emits the least-privilege statement at plan time under the `__ALCHEMY_RUNTIME__` guard (beta.59). A Vercel provider's token scoping should follow that guard rather than a second `Binding.Policy` type, which beta.59 removed. https://alchemy.run/blog/2026-06-27-beta-59/

### Docker over SSH

`alchemy/Docker` does not speak SSH itself. `Image`, `RemoteImage`, `Container`, `Volume`, and `Network` use whatever context the `docker` CLI already has active, and the post names a remote/SSH context explicitly, next to Docker Desktop and a CI daemon (beta.60). Secrets are process env (`Redacted`-safe), never CLI arguments. Pulled tags are pinned. Externally created containers adopt through the normal adoption rules. https://alchemy.run/blog/2026-07-06-beta-60/

Related, not the same feature: Cloudflare Containers in `alchemy dev` generate a Dockerfile and docker-build locally (beta.57); beta.62 teaches `LocalContainerProvider` remote images and external Dockerfiles, persists dev images, and requires unit suffixes on healthcheck durations. Those are the Cloudflare container dev loop, not `alchemy/Docker` over an SSH context. https://alchemy.run/blog/2026-06-19-beta-57/ https://alchemy.run/blog/2026-07-14-beta-62/

### AWS S3 state store

`AWS.state()` is the first-party backend (beta.56):

- Wire it as `Alchemy.Stack(id, { providers: AWS.providers(), state: AWS.state() }, program)`.
- Key layout: `s3://{bucket}/{prefix}{stack}/{stage}/{fqn}.json`.
- Default bucket name: `alchemy-state-{accountId}-{region}-an`, created on first use, not at layer construction.
- Own bucket: pass `bucketName` and `prefix`.
- Nothing calls AWS until the first state operation. https://alchemy.run/blog/2026-06-17-beta-56/

Later posts harden state without inventing a second store:

- `LocalState` is atomic (temp file plus rename) for the local backend (beta.57). https://alchemy.run/blog/2026-06-19-beta-57/
- `alchemy deploy --yes` accepts the state-store upgrade prompt in CI (beta.60). The health check requires a real serving store, not a pre-create stub (beta.60). https://alchemy.run/blog/2026-07-06-beta-60/
- `alchemy sync` repairs drift, including recreating a deleted resource under the same instance id (beta.61). https://alchemy.run/blog/2026-07-08-beta-61/
- Type aliases migrate the 74 beta.59 renames inside state (beta.61). https://alchemy.run/blog/2026-07-08-beta-61/
- Interrupted creates must not persist live `Output` proxies (beta.63) and must not wedge the stack on Output-valued props (beta.61). https://alchemy.run/blog/2026-07-17-beta-63/ https://alchemy.run/blog/2026-07-08-beta-61/
- Credentials stick to the account (beta.62). `alchemy state clear` honors `ALCHEMY_PROFILE` (beta.62). Unauthorized access tells you to `alchemy login` (beta.61). https://alchemy.run/blog/2026-07-14-beta-62/ https://alchemy.run/blog/2026-07-08-beta-61/
- `plan` must not adopt an unowned resource as a side effect of a dry run (beta.62). Resource-scoped `adopt(true|false)` overrides the stack default (beta.51). https://alchemy.run/blog/2026-07-14-beta-62/ https://alchemy.run/blog/2026-06-02-beta-51/

The nuke example's filter exists specifically to spare a worker named `alchemy-state-store` (beta.56). That is a Cloudflare state-store worker name in the example, not the S3 bucket, but it is the warning: enumeration tools will see the state store unless filtered. https://alchemy.run/blog/2026-06-17-beta-56/

---

## 4. Do not roll your own

Things this window shows Alchemy already provides. Build on them; do not reimplement them in the monorepo.

1. Remote state on S3, including bucket creation, key layout, lazy credentials, and bring-your-own bucket/prefix. `AWS.state()`. https://alchemy.run/blog/2026-06-17-beta-56/
2. Drift repair that does not re-run the program (`alchemy sync`), wedged-create recovery, atomic local writes, account-bound store credentials, and "a stub object is not a healthy store." https://alchemy.run/blog/2026-07-08-beta-61/ https://alchemy.run/blog/2026-06-19-beta-57/ https://alchemy.run/blog/2026-07-06-beta-60/ https://alchemy.run/blog/2026-07-14-beta-62/
3. State compatibility across renames (`aliases` on all 74 beta.59 resources) and across legacy Worker custom-domain shapes. https://alchemy.run/blog/2026-07-08-beta-61/ https://alchemy.run/blog/2026-06-27-beta-59/
4. Adoption (`adopt` at resource or stack scope, `--adopt` for Access Applications, DO classes from wrangler, Docker containers created outside Alchemy) and the rule that `plan` must not adopt. https://alchemy.run/blog/2026-06-02-beta-51/ https://alchemy.run/blog/2026-07-06-beta-60/ https://alchemy.run/blog/2026-07-14-beta-62/
5. Replacement policies: `retain` (including on replace, and reported as `retained` on destroy) and `deleteFirst` for singletons and fixed names. https://alchemy.run/blog/2026-06-05-beta-52/ https://alchemy.run/blog/2026-07-06-beta-60/ https://alchemy.run/blog/2026-06-27-beta-59/
6. AWS login profiles (SSO, env, stored), CI env-var selection, STS account id, lazy auth, and `AWSEnvironment.current`. https://alchemy.run/blog/2026-06-10-beta-53/ https://alchemy.run/blog/2026-07-06-beta-60/
7. `Config` / `Config.redacted` in stack bodies and in nested resource props, with concrete values hashed, plus `Redacted` unwrapping during diff so secret rotation deploys. https://alchemy.run/blog/2026-06-02-beta-51/ https://alchemy.run/blog/2026-06-10-beta-53/ https://alchemy.run/blog/2026-06-05-beta-52/ https://alchemy.run/blog/2026-07-17-beta-63/
8. Output references into Worker `env`, symbol-based Output detection, stable `worker.url`, and the ban on persisting unresolved Output proxies. https://alchemy.run/blog/2026-06-01-beta-50/ https://alchemy.run/blog/2026-06-02-beta-51/ https://alchemy.run/blog/2026-06-17-beta-56/ https://alchemy.run/blog/2026-07-17-beta-63/
9. Least-privilege bindings and the `__ALCHEMY_RUNTIME__` single Layer. AWS side emits IAM; Cloudflare side mints scoped API tokens; `*Local` uses CLI credentials for Actions. Includes R2, KV, Queues, DNS, D1, S3, SQS, DynamoDB, and the rest of the verb-first set. https://alchemy.run/blog/2026-06-24-beta-58/ https://alchemy.run/blog/2026-06-27-beta-59/ https://alchemy.run/blog/2026-07-17-beta-63/
10. Event-source sinks already named `consume*`: S3 bucket events, SQS, SNS, Kinesis, DynamoDB streams, GitHub repository webhooks (HMAC included), Cloudflare queues. https://alchemy.run/blog/2026-06-27-beta-59/ https://alchemy.run/blog/2026-06-02-beta-51/ https://alchemy.run/blog/2026-06-17-beta-56/
11. S3 bucket features listed in beta.57 (encryption through object lock) and the S3→Lambda notification resource. https://alchemy.run/blog/2026-06-19-beta-57/ https://alchemy.run/blog/2026-06-02-beta-51/
12. KMS keys and aliases, Lambda aliases and reserved concurrency, Lambda function URLs, Lambda async invoke config, log groups with KMS. https://alchemy.run/blog/2026-06-19-beta-57/ https://alchemy.run/blog/2026-06-17-beta-56/ https://alchemy.run/blog/2026-07-08-beta-61/
13. EC2 instance HTTP hosting and one-shot key pairs. Not an autoscaler; do not wrap these in a second instance abstraction, and do not pretend the posts shipped an ASG. https://alchemy.run/blog/2026-07-06-beta-60/
14. Docker resources on an already-selected SSH (or other) docker context, with env-injected secrets and tag pinning. https://alchemy.run/blog/2026-07-06-beta-60/
15. `GitHub.Repository` lifecycle (visibility, delete-branch-on-merge, rename-by-id, and the documented template/archive/secrets flows) plus the official Action, `GitHubEnv`, and PR comments. https://alchemy.run/blog/2026-06-17-beta-56/ https://alchemy.run/blog/2026-06-19-beta-57/ https://alchemy.run/blog/2026-07-14-beta-62/
16. R2 CORS, custom-domain consistency retries, and AI Search over an R2 bucket if that product is in scope. https://alchemy.run/blog/2026-07-08-beta-61/ https://alchemy.run/blog/2026-06-10-beta-53/ https://alchemy.run/blog/2026-06-19-beta-57/
17. Worker dev promotion (`dev:` ids for queues and containers), `bundle: false`, sibling-package input hashing, `Command.Build` / `Exec` / `Dev`, and flat `assets`. https://alchemy.run/blog/2026-06-10-beta-54/ https://alchemy.run/blog/2026-06-19-beta-57/ https://alchemy.run/blog/2026-06-17-beta-56/ https://alchemy.run/blog/2026-07-17-beta-63/ https://alchemy.run/blog/2026-06-24-beta-58/ https://alchemy.run/blog/2026-06-05-beta-52/ https://alchemy.run/blog/2026-07-06-beta-60/
18. Isolate-scoped layers, `proxyChain`, and per-event Drizzle/Postgres pools. Do not cache a pg pool in init. https://alchemy.run/blog/2026-07-14-beta-62/
19. Durable Object transfers (`transferredFrom`) and the single script-tag metadata pack. https://alchemy.run/blog/2026-07-17-beta-63/
20. Zone rulesets (`Cloudflare.Ruleset`) for WAF and dynamic redirects. Owning a phase means not also managing that phase by hand. https://alchemy.run/blog/2026-06-02-beta-51/ https://alchemy.run/blog/2026-07-17-beta-63/
21. Provider mechanics for a custom distilled provider: typed-error SDK patches, `list()`, `fqn` in handlers, `diff.stables`, aliases. Not a Vercel implementation; the pattern is what the posts give you. https://alchemy.run/blog/2026-06-17-beta-56/ https://alchemy.run/blog/2026-06-19-beta-57/ https://alchemy.run/blog/2026-07-14-beta-62/ https://alchemy.run/blog/2026-07-08-beta-61/
22. `alchemy-test` for live-cloud suites in one bun process, rather than a new runner. https://alchemy.run/blog/2026-07-17-beta-63/
23. Non-interactive CI: `alchemy deploy --yes`, login without an entrypoint, Windows `file://` stack loading. https://alchemy.run/blog/2026-07-06-beta-60/ https://alchemy.run/blog/2026-07-17-beta-63/

`alchemy unsafe nuke` exists and is hidden from `--help` because it deletes real infrastructure. It is not a cleanup helper to wrap. https://alchemy.run/blog/2026-06-17-beta-56/
