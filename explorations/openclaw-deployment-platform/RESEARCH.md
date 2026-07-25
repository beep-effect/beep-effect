# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

> Provenance note (2026-07-25): the dated legs below predate GATE C, which
> struck the dankserver migration entirely — dankserver stays on Ansible;
> the platform deploys new OpenClaw instances only. Migration-framed
> passages are historical context, not the plan of record. See the GATE C
> entries in [`DECISIONS.md`](./DECISIONS.md).

## External Landscape

### 2026-07-24 — OpenClaw operational surface (docs index survey)

Fetched https://docs.openclaw.ai/llms.txt 2026-07-24. Load-bearing facts for
this packet's design, each cited to the doc page the index names:

- **Secrets are first-party 1Password-aware.** The gateway can resolve secrets
  with the 1Password CLI and agents get a bundled `1password` skill
  ([gateway/1password](https://docs.openclaw.ai/gateway/1password)); there is
  an `openclaw secrets` CLI (reload, audit, configure, apply)
  ([cli/secrets](https://docs.openclaw.ai/cli/secrets)). Decision 5's op://
  posture may compose with native support instead of only wrapping systemd
  units in `op run`.
- **Config has a schema-aware CLI.** `openclaw config` supports
  get/set/patch/unset/file/**schema**/**validate**
  ([cli/config](https://docs.openclaw.ai/cli/config)), with a configuration
  reference, per-subsystem references (agents / channels / tools), and
  schema-accurate examples
  ([gateway/configuration-reference](https://docs.openclaw.ai/gateway/configuration-reference),
  [gateway/configuration-examples](https://docs.openclaw.ai/gateway/configuration-examples)).
  **TypeBox schemas are the single source of truth for the gateway protocol**
  ([concepts/typebox](https://docs.openclaw.ai/concepts/typebox)) — whether
  the config file itself is TypeBox-validated (and thus exportable for
  conformance-testing our Effect schema) is a source-dive question.
- **Service ops surface.** Gateway runbook
  ([gateway](https://docs.openclaw.ai/gateway)); `openclaw health` RPC
  snapshot ([cli/health](https://docs.openclaw.ai/cli/health)) plus
  [gateway/health](https://docs.openclaw.ai/gateway/health); `openclaw
  doctor` does health checks **and config migrations**
  ([gateway/doctor](https://docs.openclaw.ai/gateway/doctor)); gateway
  singleton guard = file lock + WS/HTTP bind
  ([gateway/gateway-lock](https://docs.openclaw.ai/gateway/gateway-lock));
  multiple gateways per host via isolation/ports/**profiles**
  ([gateway/multiple-gateways](https://docs.openclaw.ai/gateway/multiple-gateways))
  — relevant if the workstation ever runs a second gateway instance.
- **Install landscape.** First-party: installer scripts, npm/pnpm/bun, Docker,
  **declarative Nix install** ([install/nix](https://docs.openclaw.ai/install/nix)),
  an upstream **Ansible install** doc (hardened, Tailscale, firewall —
  [install/ansible](https://docs.openclaw.ai/install/ansible)),
  Kubernetes/Kustomize, Render IaC template. **No first-party Pulumi or
  Terraform surface** in the docs index. Release channels support pinning
  ([install/development-channels](https://docs.openclaw.ai/install/development-channels));
  `openclaw update` restarts the gateway
  ([cli/update](https://docs.openclaw.ai/cli/update)).
- **Agent-definition surface.** Persona lives in a `SOUL.md` file
  ([concepts/soul](https://docs.openclaw.ai/concepts/soul)); agent workspace
  contract ([concepts/agent-workspace](https://docs.openclaw.ai/concepts/agent-workspace));
  skills CLI search/install/update/**verify**/check
  ([cli/skills](https://docs.openclaw.ai/cli/skills)); ClawHub registry with a
  **lockfile-bearing CLI**
  ([clawhub/cli](https://docs.openclaw.ai/clawhub/cli)); sandbox modes +
  tool allow/deny policy + elevated exec gates
  ([gateway/sandbox-vs-tool-policy-vs-elevated](https://docs.openclaw.ai/gateway/sandbox-vs-tool-policy-vs-elevated));
  `openclaw security audit` with a check catalog
  ([gateway/security/audit-checks](https://docs.openclaw.ai/gateway/security/audit-checks))
  and an exposure runbook — the guardrail config surface decision 10 needs is
  real and declarative.
- **Models.** Provider config + failover via auth-profile rotation
  ([concepts/model-failover](https://docs.openclaw.ai/concepts/model-failover));
  local models via custom OpenAI-compatible endpoints
  ([gateway/local-models](https://docs.openclaw.ai/gateway/local-models)) —
  confirms decision 9's shape; on-demand local model service management exists
  ([gateway/local-model-services](https://docs.openclaw.ai/gateway/local-model-services))
  but stays out of scope.
- **Observability.** OTel export via diagnostics-otel plugin
  ([gateway/opentelemetry](https://docs.openclaw.ai/gateway/opentelemetry))
  and Prometheus plugin — future tie-in to the ai-metrics stack, not v1.

Takeaway: OpenClaw already leans declarative at the edges (config
schema/validate, Nix install, ClawHub lockfile, skills verify). The stack
should compose these first-party surfaces rather than fight them; the open
question remains who owns the file between deploys (source-dive gating
decision 7).

### 2026-07-24 — x.com field leg (Grok x_search)

Full notes with per-post citations:
[`research/x-com-field-notes.md`](./research/x-com-field-notes.md). Headlines:

- Community config pain **verifies the mission premise**: update-cycle
  `openclaw.json` breakage is a recurring complaint; agents editing their own
  config is a named security risk ("if you can write the config, you can
  disable the camera"); folklore mitigations (git-tracked config, `.last-good`
  backups, config-set-only agent rules) are exactly what a declarative
  external owner subsumes.
- Deploy reality is npm+systemd quickstarts, VPS scripts, Docker, managed
  platforms; **no meaningful TS-native IaC for OpenClaw on X** — the IaC
  surface lives on GitHub: first-party `nix-openclaw` (sets
  `OPENCLAW_NIX_MODE=1` immutable config) and `openclaw-ansible`, an official
  Pulumi blog (AWS/Hetzner, cloud-init + Tailscale + ESC), community
  Terraform/Helm/compose repos.
- Effect-native IaC prior art: **Alchemy** (pure-Effect IaC engine, Apache-2.0,
  endorsed by Effect's creator) as style reference; Arnaldi's abandoned 2022
  Effect+Pulumi integration failed on Pulumi's closure serializer — a blocker
  our command/file-resource shape never touches (proven by `infra/` today).

### 2026-07-24 — source-dive first pass (Fable verification leg)

Direct reads of `~/YeeBois/dev/openclaw` @ `663c4fba` ahead of the codex
deep-dive (which lands as
[`research/openclaw-config-internals.md`](./research/openclaw-config-internals.md)):

- **First-party immutable-config mode exists.**
  `src/config/nix-mode-write-guard.ts` throws
  `NixModeConfigMutationError` (`OPENCLAW_NIX_MODE_CONFIG_IMMUTABLE`) on every
  mutating config path when `OPENCLAW_NIX_MODE=1` — the error text itself
  enumerates the guarded flows: "setup, onboarding, openclaw update, plugin
  install/update/uninstall/enable, doctor repair/token-generation, config
  set". `OPENCLAW_CONFIG_PATH` relocates the config file (tested with Nix
  store paths in `src/config/config.nix-integration-u3-u5-u9.test.ts`).
  This is the exact mechanism decision 7's full-file ownership needs —
  maintained upstream because the first-party Nix distribution depends on it.
- Config subsystem is large (366 files in `src/config/`) and includes
  `includes.ts`/`includes-scan.ts` (include mechanism), `env-substitution.ts`
  (env-var substitution with `MissingEnvVarError` — secrets can stay out of
  the rendered file), `io.audit.ts`, `backup-rotation.ts`,
  `future-version-guard.ts`, and `runtime-source-projection.ts`
  ("projectConfigOntoRuntimeSourceSnapshot" — a declared-source vs runtime
  overlay seam worth mapping precisely).

### 2026-07-24 — OSS/web landscape sweep (codex leg)

Full cited sweep: [`research/oss-landscape.md`](./research/oss-landscape.md).
Headlines the synthesis relies on:

- **No reusable OpenClaw Pulumi component/provider, Terraform module, or CDK
  construct exists** — the closest implementation is
  `pandysp/openclaw-infra` (MIT): Pulumi provisions a Hetzner host, hands off
  to Ansible, runs the gateway as `systemd --user` behind Tailscale. Reference
  for ordering/verification, not the target architecture.
- **`op://` refs can stay in config as data**: OpenClaw documents runtime
  SecretRef resolution through an `op read` exec provider
  (docs.openclaw.ai/gateway/1password) — secret values never enter
  `openclaw.json` or Pulumi state. Exact mechanism to be confirmed by the
  config-internals dive.
- **`@pulumi/command` is the right substrate; dynamic providers are not**:
  Pulumi documents dynamic-provider limits (TS/Python only, no functional
  `read`, serialized provider functions, no Bun) that disqualify them for
  this Bun monorepo; a Command-backed `ComponentResource` (atomic
  content-hash-keyed file writes → `daemon-reload` → enable/restart → health)
  is the low-risk first slice. `loginctl enable-linger` is the always-on
  decision to make explicit.
- **No public Pulumi Automation API + Effect prior art found** — the Effect
  Schema decode-before-resources boundary we already use in `infra/` is ahead
  of the field; Pulumi's own `Config.requireObject<T>` explicitly does not
  validate shape.
- **Config ownership models articulated** (strict declarative / split
  ownership via includes / seed-only): upstream's include-aware config writer
  can update an included file without rewriting the root — the natural
  split-ownership bridge for the dankserver migration, while greenfield takes
  strict declarative ownership.
- Comparable stacks: first-party `nix-openclaw` (Home Manager module,
  immutable config; AGPL clean-room), `schemalabz/nix-openclaw` (read-only
  managed workspace vs mutable state dirs), ClawFleet (container fleet,
  version pinning), upstream Kustomize/Fly/Render surfaces.
- Sweep gaps worth carrying into the oracle review: no distribution-neutral
  externally-managed-config mode confirmed beyond `OPENCLAW_NIX_MODE=1`; the
  complete runtime config-writer matrix is unmapped (config-internals dive
  covers it); linger/user-manager behavior under non-interactive deploys
  needs a live prototype.

### 2026-07-24 — nix-openclaw behavioral study (clean-room; AGPL upstream)

Facts observed from `~/YeeBois/dev/nix-openclaw` @ `5f849be4` (behavioral
facts only — no code ported; AGPL-3.0 discipline per
[`research/SOURCES.md`](./research/SOURCES.md)):

- The first-party declarative distro renders the **entire** `openclaw.json`
  from typed module options (`programs.openclaw.config` /
  `instances.<name>.config`) into an immutable store file, exposes it at
  `<stateDir>/openclaw.json`, and runs the gateway with
  `OPENCLAW_CONFIG_PATH` pointing at it plus `OPENCLAW_NIX_MODE=1` in the
  service environment (`nix/modules/home-manager/openclaw/config.nix`).
- Under that mode, `openclaw plugins install/update/uninstall/enable/disable`
  **fail instead of mutating `~/.openclaw`** (README, "OpenClaw Runtime
  Plugins") — plugins and skills are wired declaratively by the distro, not
  imperatively by the CLI. Consequence for us: the v1 proof skill must be
  installed declaratively (rendered file wiring), not via `clawhub`/`openclaw
  skills install` at runtime.
- Mutable state (sessions, memory, logs) stays in the state dir beside the
  immutable config: "All state lives in `~/.openclaw/`" (README) — i.e. the
  config-vs-state split is **directory-level cohabitation with a file-level
  immutability guard**, not separate roots.
- Their CI validates every rendered config by running the real `openclaw`
  binary against it in a sandbox (`nix/scripts/check-config-validity.mjs`,
  `nix/checks/openclaw-config-validity.nix`) — the pattern our stack's
  preflight should copy: render → `openclaw config validate` (or
  equivalent) → only then install + restart.

Net: the first-party declarative distro already does full-file ownership in
production, with the exact env-var mechanism our Pulumi stack can reuse
verbatim (two env vars on a systemd unit). This is strong evidence toward a
HOLDS verdict for decision 7, pending the codex writer-matrix confirmation.

### 2026-07-24 — config-internals deep-dive (codex leg) + verdict

Full file:line-cited dive:
[`research/openclaw-config-internals.md`](./research/openclaw-config-internals.md)
(spot-check verified by the orchestrating session against the clone: the
central-writer guard call, the `z.strictObject` root, and the
`/health|/healthz|/ready|/readyz` probe map all confirmed verbatim).

**VERDICT on decision 7: HOLDS-WITH-CONDITIONS.** Full-file ownership of
`openclaw.json` works as an explicitly immutable operating mode. The six
conditions, abridged (full text in the dive):

1. Run gateway + every OpenClaw CLI/plugin process with
   `OPENCLAW_NIX_MODE=1` — the source-provided guard on the central mutation
   API (`assertConfigWriteAllowedInCurrentMode` inside the single
   `writeConfigFileFromContext` writer).
2. Render the **complete, strictly-valid** schema for the pinned version —
   the Zod root is strict; unknown keys are fatal at load, not preserved.
3. Every config-mutating workflow (wizards, `config set`, gateway config RPC,
   doctor repair, update's doctor pass, plugin/channel lifecycle, extension
   chat-command writebacks) becomes "change the Pulumi input and redeploy".
4. Mutable state stays writable and persistent beside the config: shared
   `state/openclaw.sqlite` (schema v5), per-agent `openclaw-agent.sqlite`
   (v14) — credentials, device/channel pairing live there, never in the file.
5. Auth bootstrap is the sharp edge: login/paste flows write secrets to
   SQLite **and** `auth.profiles`/`auth.order` metadata to config — under the
   guard the config half fails, so the stack must declaratively render the
   non-secret profile metadata after credential provisioning.
6. Pin the OpenClaw version together with the schema; upgrades are
   re-render + redeploy (doctor migrations are blocked by design), and
   `future-version-guard` protects against downgrade clobbering via
   `meta.lastTouchedVersion`.

Other stack-relevant facts: config is JSON5-read / canonical-JSON-written;
`$include` merges at any depth with confined roots (`OPENCLAW_INCLUDE_ROOTS`)
— and the mutation layer can write a single owned include directly, which is
the mechanical basis for the migration's split-ownership bridge;
`${ENV_NAME}` substitution reaches every string leaf (secrets stay out of the
rendered file); HTTP `GET /health`+`/ready` on gateway port (default 18789)
are the probe surface; the launcher **requires Node (rejects Bun** — it needs
`node:sqlite`), so the service runtime is Node even though this repo tooling
is Bun; service install uses a stable package symlink for version retargeting.

### 2026-07-24 — adversarial review (oracle pass, codex-executed)

Full review: [`research/adversarial-review.md`](./research/adversarial-review.md)
(12 findings, each with clone `file:line` evidence; one explicit HOLDS —
OAuth refresh is SQLite-locked and not a config-write casualty). The
findings that materially change the design:

- **CRITICAL:** `OPENCLAW_NIX_MODE=1` is an **in-process policy check**, not
  filesystem immutability — any process writing the path directly bypasses
  it. nix-openclaw's real guarantee comes from the read-only store +
  symlink, which the packet mistook for the env-var check. Strict ownership
  therefore needs an OS-enforced read-only boundary + independent drift
  audit/repair, with the guard as one defense layer.
- **CRITICAL:** SQLite schema migrations run on ordinary open and stamp
  `user_version`; older binaries then refuse the store — so a failed
  health check after upgrade can strand a rollback. Upgrades must be a
  generation state machine (side-by-side install, DB snapshots, atomic
  switch, deep acceptance, tested restore), not three commands.
- **MAJOR (design reshape):** the driver cannot honestly duplicate the full
  upstream config contract (effective schema is plugin-set-dependent; the
  schema export inserts lossy placeholders past size caps) — `@beep/openclaw`
  should own a **desired-intent schema + versioned render adapters**, with
  the candidate binary's plugin-aware `config validate` as the acceptance
  gate. Skills are **workspace mutations** with their own lockfile, not
  config fields — the sketch needs one `OpenClawGeneration` object binding
  package/config/unit/workspace/skills/plugins as a single revision.
- **MAJOR (ops surfaces):** same-`op://`-ref secret rotation is invisible to
  content hashes (eager resolution; `secrets reload` is the only refresh);
  the 1Password service-account token is an unavoidable bootstrap secret
  needing a recorded exception; `command.local` proves neither drift nor
  target identity (bind to machine-id + out-of-band audit); "flip only the
  executor" understates the separate session/privilege contracts of local
  vs SSH `systemd --user` applies; `/health` + `/ready` are too weak to
  authorize generation promotion; channel event writebacks need
  `configWrites: false` rendered per channel and live testing under the
  guard.

## Synthesis (revised after adversarial review)

Decision 7's verdict is tempered from HOLDS-WITH-CONDITIONS to
**HOLDS-ONLY-WITH-OS-ENFORCEMENT, prototype-gated**: strict declarative
full-file ownership remains the greenfield plan, but it is credible only as
(a) the `OPENCLAW_NIX_MODE=1` + `OPENCLAW_CONFIG_PATH` in-process guard,
**plus** (b) an OS-enforced read-only config boundary, **plus** (c) an
independent drift audit/repair loop — and the align stage now carries
blocking open questions with four disposable prototypes (filesystem
bypass/drift, non-interactive user-manager apply, same-ref secret
rotation/reload, upgrade+failed-health rollback across DB schema stamps)
before decisions 6/7/12/13 are re-closed. The managed-subset fallback (fully
mapped by the dive) remains the migration's bridge and the fallback if the
prototypes fail.

## In-Repo Capability Inventory

### 2026-07-24 — bricks this packet composes

| Brick | Path | Use here | Status |
| --- | --- | --- | --- |
| Pulumi workspace + per-surface projects | `infra/` root project, `infra/oip-web/Pulumi.yaml`, `infra/storybook/Pulumi.yaml` (each `main:` → `../src/internal/<surface>-entry.ts`) | New `infra/openclaw/` project + `infra/src/OpenClaw.ts` + `infra/src/internal/openclaw-entry.ts` follow this exact layout | reuse |
| Schema-decoded Pulumi config | `infra/src/internal/PulumiConfigSchema.ts` (`optionalPulumiConfigFields`, `withPulumiConfigDecodeEffect`) | Same decode pattern for `openclaw:*` config namespace | reuse |
| Tagged-union deploy target + preflight→apply→health chain | `infra/src/AIMetrics.ts` (`AiMetricsDeployTarget` local\|dankserver; `command.remote.Command` w/ triggers, stdout as `pulumi.secret`) | Decision 6: same shape, workstation target runs `command.local.Command` | reuse pattern |
| Install-spec library precedent | `packages/tooling/library/ai-metrics` (`@beep/repo-ai-metrics` `install.ts`, `models.ts`, consumed by infra) | Precedent for where a deploy/install spec may live; openclaw likely keeps schema in the driver instead — align question | precedent |
| 1Password CLI driver | `packages/drivers/onepassword-cli` (`probeReference`, `read` → `Redacted`, `whoami`; ChildProcessSpawner + `collectProcessOutput`) | Deploy-time secret probe/read; style model for the openclaw CLI wrapper | reuse |
| Typed op:// reference value | `packages/shared/domain/src/values/OnePasswordReference/OnePasswordReference.model.ts` (pattern-validated `op://vault/item/field[/section]`) | Upgrade over AIMetrics' raw `S.String` secret refs — use for every `*SecretRef` field | reuse |
| Tailscale driver | `packages/drivers/tailscale` (status/serve surfaces, `magicDnsName`, `baseUrl`) | dankserver-migration phase (remote executor); not needed for workstation v1 | reuse later |
| Provider drivers | `packages/drivers/{anthropic,openai-compat,xai,venice-ai,ai-provider-cli}` | Not consumed by the deploy stack; relevant to the later SDK-adapter path only | out of scope |
| Discord driver | `packages/drivers/discord` | Not needed — channel config is just OpenClaw config + a bot-token secret ref | out of scope |
| Schema kits | `@beep/schema` (`LiteralKit`, `SchemaUtils.withKeyDefaults`/`withNoneDefault`/`withStatics`, `TaggedErrorClass`, `Model.Class`) | Everything schema-shaped in driver + stack | reuse |
| Identity composers | `@beep/identity` (`$InfraId`, `$I.create`/`annote`/`annoteSchema`; new `$OpenclawId` needed) | Driver + stack identity | reuse/extend |
| Process plumbing | `@beep/utils/Stream` `collectProcessOutput`; `effect/unstable/process` `ChildProcess`/`ChildProcessSpawner` | openclaw CLI wrapper | reuse |
| Vendored-subtree readiness | `.gitleaks.toml` allowlists `.repos/openclaw/**` | Deferred vendoring trigger (decision 11) | ready |

**NOT FOUND** (net-new candidates):

- Any OpenClaw driver, schema, or config model in-repo (`packages/drivers/openclaw` is net-new).
- Any reusable systemd-unit or config-file rendering helper — `AIMetrics.ts`
  inlines unit/compose text as template strings. Decision 6's target-agnostic
  renderer layer is net-new (extraction candidate if it stays generic).
- Any generic local-vs-remote command-executor abstraction over
  `@pulumi/command` — net-new, and the piece the dankserver migration flips.

**Drift observed** (surface at align): `@beep/onepassword-cli` (drivers
family) imports `@beep/shared-domain/values/OnePasswordReference`, but
`standards/ARCHITECTURE.md` forbids `drivers/*` depending on `shared/*`.
Either the value belongs in a foundation package, or an exception needs a
recorded rationale. The openclaw driver must not repeat the pattern without
that resolution.

## Constraints Discovered

- **Version skew is a real design axis.** dankserver pins `2026.7.1-2`; the
  local clone is `2026.7.2`; upstream ships release channels with pinning.
  The stack must treat the OpenClaw version as declared config (like
  AIMetrics' pinned `phoenixImage`), not ambient state.
- **OpenClaw writes its own config.** The runtime mutates `openclaw.json`
  (auth profiles, channel state — extent to be established by the
  source-dive); decision 7's full-file ownership is conditional on the
  config-vs-state split holding at source level.
- **Public repo.** Packet content stays technical; no proxy tokens, secret
  values, or practice specifics in tracked files.
