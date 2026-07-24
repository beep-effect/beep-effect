# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

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

<!-- Codex OSS/web landscape sweep lands here: research/oss-landscape.md -->
<!-- Grok x.com field notes land here: research/x-com-field-notes.md -->
<!-- OpenClaw config-internals source-dive lands here:
     research/openclaw-config-internals.md -->

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
