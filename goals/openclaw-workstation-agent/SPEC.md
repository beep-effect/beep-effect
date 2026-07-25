# OpenClaw Workstation Agent Spec

## Objective

A legal-focused OpenClaw agent runs on the Linux workstation as immutable,
generation-based, Pulumi+Effect-managed infrastructure: every deploy produces
a hash-versioned `OpenClawGeneration` under a root-owned config root, applied
by `pulumi up` through a typed desired-intent schema, surviving drift audits,
secret rotation, and upgrade-with-rollback — with a live Telegram + Control UI
agent as the proof. This platform is how NEW OpenClaw instances get deployed
from here on; the workstation is the first target.

Seeded from the graduated exploration
[`explorations/openclaw-deployment-platform`](../../explorations/openclaw-deployment-platform/README.md)
(BRIEF → this spec; no-gos → non-goals; rabbit holes → constraints;
DECISIONS.md → decision log). Back-links, not copies: the exploration remains
the provenance record.

## Non-Goals

- Migrating dankserver in any form (GATE C, 2026-07-25) — its Ansible role
  (OS layers, openclaw layer, bundle patches) keeps owning that instance
  indefinitely. dankserver appears here only as problem evidence and as dumb
  storage for encrypted backups.
- Voice stack (cloudflared/Twilio/streaming/ElevenLabs).
- llama-server lifecycle management (it already runs; the stack only
  references it as an OpenAI-compatible provider profile).
- Gateway HTTP/WS API client in the driver (no consumer yet; the SDK adapter
  arrives via `goals/agentic-professional-runtime`).
- Real legal capabilities (USPTO MCP, docketing, …) — they arrive via the
  SDK-adapter path; this packet is enabling substrate, firewalled from
  product work.
- Discord as the v1 channel.
- Enforceable outbound DLP — v1 confidentiality is advisory-only, so no real
  client data touches the agent, period.
- Remote-SSH applicator implementation — the contract seam is designed, only
  the workstation-local applicator is built.

## Source Hierarchy

1. User objective: the GATE C-approved graduation of the exploration.
2. `AGENTS.md`, `CLAUDE.md`, and required skills
   (`/effect-first-development`, `/schema-first-development`, `/yeet`).
3. Governing architecture/package standards (`standards/ARCHITECTURE.md`,
   `standards/architecture/03-driver-boundaries.md`,
   `standards/architecture/07-non-slice-families.md`).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files, and the source
   exploration's `BRIEF.md` / `MAP.md` / `DECISIONS.md` /
   `research/SOURCES.md`.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/drivers/openclaw` (`@beep/openclaw`) — NET-NEW driver: desired-
  intent Effect schema, versioned render adapter, CLI process wrapper
  (`onepassword-cli` style), liveness/readiness/acceptance probes.
- `infra/` — new `infra/openclaw` Pulumi project + `infra/src/OpenClaw.ts`
  stack module (AIMetrics-style `S.Class`-decoded config, generation
  renderers, workstation applicator, drift audit).
- This goal packet (`goals/openclaw-workstation-agent/`).
- Workstation state outside the repo (root-owned
  `/etc/beep/openclaw/<content-hash>/`, systemd `--user` unit, workspace
  artifacts) — mutated only by the stack's applicator.

## Constraints

Binding design decisions (each traces to a dated entry in the exploration's
[`DECISIONS.md`](../../explorations/openclaw-deployment-platform/DECISIONS.md);
the four prototype-gated ones are re-openable ONLY via a failed P0 spike):

- **OS-enforced immutability** — root-owned, hash-versioned config root;
  `OPENCLAW_CONFIG_PATH` points at it; `OPENCLAW_NIX_MODE=1` is
  defense-in-depth only; independent drift audit (preflight hash + recurring
  canary). Prototype-gated.
- **OpenClawGeneration state machine** — one hash-versioned revision binds
  package version, rendered config, unit, workspace artifacts, pinned
  skills, plugins. Upgrade: stage → validate with candidate binary → stop →
  snapshot shared+agent SQLite (incl. WAL) → switch one pointer → start →
  acceptance probes → commit or restore. Irreversible DB migrations
  pre-classified and operator-gated. Prototype-gated.
- **Desired-intent schema, not upstream mirror** — the driver owns OUR
  deployment intent; a versioned render adapter targets the pinned OpenClaw
  version; acceptance = the candidate binary's plugin-aware
  `config validate` + negative fixtures. Renderer emits canonical JSON
  (upstream reads JSON5, writes canonical JSON; never depend on comments).
- **Applicator contract + identity binding** — renderers stay pure and
  applicator-agnostic; the workstation-local applicator declares user/UID,
  runtime dir, bus reachability, linger ownership, privilege boundary;
  preflight exercises the exact non-interactive `systemd --user` context and
  binds the stack to `/etc/machine-id` + hostname + UID, failing before
  mutation on mismatch. Prototype-gated.
- **Secrets** — `op://` references as data everywhere (typed
  `OnePasswordReference`), resolved by OpenClaw's native exec provider at
  runtime; ONE bootstrap exception (see Exception Ledger); rotation is an
  operational surface (post-rotation `secrets reload`, degraded alerting,
  authenticated probe). Prototype-gated. Plaintext secrets never appear in
  tracked files, Pulumi inputs/outputs/state, rendered configs, or Command
  outputs.
- **Writer-surface completeness** — there is no finite runtime-written key
  list; the gauntlet + live soak must confirm nothing operationally
  essential breaks under the guard, especially Telegram's
  `configWrites: false` skip paths.
- **Auth bootstrap ceremony** — login flows write secrets to SQLite AND
  `auth.profiles` metadata to config; the stack renders non-secret metadata
  declaratively and provisions credentials out-of-band; a worked runbook is
  required before the providers increment.
- **Upgrade runbook** — doctor migrations are blocked by design; upgrades
  are re-render + generation switch, respecting `meta.lastTouchedVersion`
  and the future-version guard.
- **Node-not-Bun service runtime** — the launcher rejects Bun (needs
  `node:sqlite`); the generation pins a supported Node even though repo
  tooling is Bun.
- **Preview fidelity** — `command.*` resources skip execution during preview
  and have no read/refresh; the drift audit lives outside them.
- **Repo laws** — schema-first domain models, effect-first implementation;
  the driver must NOT depend on `shared/*` (do not repeat the
  `onepassword-cli` → `shared-domain` drift); Pulumi state stays on the
  local passphrase backend with automated encrypted off-machine backup
  (dankserver as dumb storage over Tailscale).
- **Appetite (GATE C)** — one focused build cycle. Sanctioned cuts when
  threatened: the proof skill, the local-model provider profile. Never cut:
  immutable posture, generation state machine, typed intent schema. A
  failed P0 prototype re-opens its decision; it does not extend the budget.

## Decision Log

Seeded 2026-07-25 from the exploration's 29 dated entries
([`DECISIONS.md`](../../explorations/openclaw-deployment-platform/DECISIONS.md)).
New decisions made during execution land HERE with dated entries; a failed
P0 prototype re-opens its gated decision here (not in the exploration).

| Date | Decision | Status |
| --- | --- | --- |
| 2026-07-25 | Inherited: all exploration GATE A/B/C resolutions | binding |

## Acceptance Criteria

- [ ] **P0 gauntlet passed** — all four spikes ran on the workstation with
      recorded evidence in `history/`: (1) filesystem bypass/drift, (2)
      non-interactive user-manager apply, (3) same-ref rotation/reload, (4)
      upgrade + failed-health rollback across SQLite schema stamps. Any
      failure produced a dated decision-log revision before further work.
- [ ] **Driver shipped** — `@beep/openclaw` exports the desired-intent
      schema, a versioned render adapter whose output passes the pinned
      binary's `config validate` (plus negative fixtures), the CLI wrapper,
      and the probe set; package passes repo quality gates.
- [ ] **First vertical slice proven** — one minimal generation (gateway +
      Control UI, no channel/skills) deployed via `pulumi up`, healthy on
      liveness+readiness, drift audit detects a deliberate manual config
      edit, and a second generation switch with a forced failed-health
      rollback restores the prior generation.
- [ ] **Agent live** — Telegram DM round-trip and Control UI reachable;
      legal persona + guardrails rendered as generation artifacts
      (`configWrites: false`, advisory confidentiality, no real client
      data); hosted primary + local provider profile; exactly one proof
      skill installed declaratively.
- [ ] **Completion gate** — the work shipped as PR(s) driven to mergeable
      via `/yeet`; closeout reflection exists and
      `bun run beep lint reflection-artifacts` passes.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/openclaw-workstation-agent/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/openclaw-workstation-agent/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/openclaw-workstation-agent` | Passes |
| Repo quality | `bun run beep yeet verify` | Green |
| Render acceptance | pinned binary `openclaw config validate` on rendered output + negative fixtures | Passes / fails respectively |
| Slice proof | `pulumi up` ×2, probe set, drift canary, forced rollback — evidence in `history/` | Recorded |
| Reflection | `bun run beep lint reflection-artifacts` | Passes |

## Stop Conditions

- A P0 prototype fails and the gated decision is not yet re-resolved in the
  decision log — no implementation phase may proceed past it.
- The implementation would require plaintext secrets, real client data, or
  changes to dankserver beyond receiving backup files.
- The implementation would exceed named scope (new packages beyond
  `packages/drivers/openclaw`, non-`infra/` deploy surfaces, product
  semantics in the substrate).
- Required source files are missing or materially contradictory.
- Verification requires credentials, cost, destructive side effects, or
  policy approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| `OP_SERVICE_ACCOUNT_TOKEN` bootstrap credential | Root-owned systemd credential (`LoadCredential`), provisioned out-of-band; never via Pulumi inputs/outputs/state; preflight `op whoami` in the exact service env | Human operator | The 1Password service-account token cannot itself be an `op://` reference | A first-party secretless bootstrap (or hardware-backed credential) replaces it; rotation/revocation runbook retires with it |
