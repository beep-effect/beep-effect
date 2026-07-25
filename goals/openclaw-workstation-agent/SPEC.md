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

- **OS-enforced immutability** — hash-versioned config root with exact
  permissions: config file `0644 root:root`, directories `0755 root:root`,
  and a root-owned active-generation pointer whose parent is also
  root-owned; `OPENCLAW_CONFIG_PATH` points at it; `OPENCLAW_NIX_MODE=1` is
  defense-in-depth only; independent drift audit (preflight hash + recurring
  canary; the canary is alert-only in v1 — repair is an operator-driven
  redeploy, never automatic). P0 must prove the service user cannot write,
  truncate, replace, rename, or redirect the file or pointer while the
  privileged applicator can switch generations. Prototype-gated.
- **OpenClawGeneration state machine** — one hash-versioned revision binds
  package version, rendered config, unit, workspace artifacts, pinned
  skills, plugins. Upgrade: stage → validate with candidate binary → stop →
  snapshot shared+agent SQLite (incl. WAL) → switch one pointer → start →
  acceptance probes → commit or restore. Irreversible DB migrations
  pre-classified and operator-gated. Prototype-gated.
- **Desired-intent schema, not upstream mirror** — the driver owns OUR
  deployment intent; a versioned render adapter targets the pinned OpenClaw
  version; acceptance = the candidate binary's plugin-aware
  `config validate` + negative fixtures, AND a CI check that inspects the
  pinned binary's schema export and fails on lossy/omitted placeholders for
  any extension surface this deployment declares (channel, provider, plugin,
  skill). Node version, OpenClaw package, plugin artifacts, adapter version,
  and fixtures are versioned and tested as one compatibility set. Renderer
  emits canonical JSON (upstream reads JSON5, writes canonical JSON; never
  depend on comments).
- **Applicator contract + identity binding** — renderers stay pure and
  applicator-agnostic; the workstation-local applicator declares user/UID,
  runtime dir, bus reachability, linger ownership, privilege boundary;
  preflight exercises the exact non-interactive `systemd --user` context and
  binds the stack to `/etc/machine-id` + hostname + UID + expected home and
  runtime paths, failing before mutation on mismatch. The drift audit's
  inventory is normative and runs outside Command resources on every
  preview/refresh-equivalent path: active-generation pointer, OpenClaw
  package version, Node version, unit content, unit enabled/active state,
  config hash + `config validate` result, and target identity — not just
  the config file. Prototype-gated.
- **Secrets** — `op://` references as data everywhere (typed
  `OnePasswordReference`), resolved by OpenClaw's native exec provider at
  runtime; ONE bootstrap exception (see Exception Ledger); rotation is an
  operational surface: post-rotation `secrets reload` must leave no stale or
  cold owner on the revoked value, degraded-reload alerting must fire when
  resolution breaks, and an authenticated model completion AND channel probe
  must pass tied to the rotation event (not independently of it).
  Prototype-gated. Plaintext secrets never appear in tracked files, Pulumi
  inputs/outputs/state, rendered configs, or Command outputs.
- **Writer-surface completeness** — there is no finite runtime-written key
  list; the gauntlet + live soak must confirm nothing operationally
  essential breaks under the guard. The Telegram writer surfaces are tested
  explicitly (login/bootstrap, pairing/first-owner persistence, `defaultTo`
  writeback, reconnect, token swap, group→supergroup migration where
  triggerable), producing a channel/plugin immutable-mode compatibility
  matrix (writer → declarative render | graceful skip | INCOMPATIBLE); any
  INCOMPATIBLE essential path re-opens the Telegram decision. See
  [`ops/handoffs/p0-gauntlet-contract.md`](./ops/handoffs/p0-gauntlet-contract.md).
- **Auth bootstrap ceremony** — login flows write secrets to SQLite AND
  `auth.profiles` metadata to config; the stack renders non-secret metadata
  declaratively and provisions credentials out-of-band; a worked runbook is
  required before the providers increment.
- **Upgrade runbook** — doctor migrations are blocked by design; upgrades
  are re-render + generation switch, respecting `meta.lastTouchedVersion`
  and the future-version guard. The SQLite rollback proof is not one-time:
  EVERY OpenClaw version bump runs a permanent checklist — classify shared
  and per-agent migrations, exercise candidate startup against cloned state
  (incl. WAL), force post-migration rejection, restore, and prove the
  previous binary starts; irreversible migrations require a recorded
  operator gate and a forward-recovery plan.
- **Node-not-Bun service runtime** — the launcher rejects Bun (needs
  `node:sqlite`); the generation pins a supported Node even though repo
  tooling is Bun.
- **Preview fidelity** — `command.*` resources skip execution during preview
  and have no read/refresh; the drift audit lives outside them.
- **Repo laws** — schema-first domain models, effect-first implementation;
  the driver must NOT depend on `shared/*` (do not repeat the
  `onepassword-cli` → `shared-domain` drift); Pulumi state stays on the
  local passphrase backend. Off-machine backup covers BOTH classes:
  encrypted Pulumi state AND encrypted shared/per-agent SQLite generation
  snapshots (WAL-consistent), shipped to dankserver as dumb storage over
  Tailscale with evidence of receipt and a worked restore drill — dankserver
  itself is never modified beyond receiving files.
- **Appetite (GATE C)** — one focused build cycle, with the gauntlet
  allocated ~the first fifth; exhausting that allocation is itself a
  stop-and-reshape condition. Sanctioned cuts when the cycle is threatened:
  the proof skill, the local-model provider profile — a cut is exercised by
  recording a dated decision-log entry here, after which the corresponding
  acceptance criteria, PLAN exit criteria, manifest phase text, and README
  are updated together. Never cut: immutable posture, generation state
  machine, typed intent schema. A failed P0 prototype re-opens its decision;
  it does not extend the budget.

## Decision Log

Seeded 2026-07-25 from the exploration's 29 dated entries
([`DECISIONS.md`](../../explorations/openclaw-deployment-platform/DECISIONS.md)).
New decisions made during execution land HERE with dated entries; a failed
P0 prototype re-opens its gated decision here (not in the exploration).

| Date | Decision | Status |
| --- | --- | --- |
| 2026-07-25 | Inherited: all exploration GATE A/B/C resolutions | binding |
| 2026-07-25 | Post-graduation adversarial review (11 findings) tightened this SPEC, PLAN, and the P0 gauntlet contract; drift canary is alert-only in v1 (repair = operator-driven redeploy, never automatic) | binding |

## Acceptance Criteria

- [ ] **P0 gauntlet passed** — every assertion in
      [`ops/handoffs/p0-gauntlet-contract.md`](./ops/handoffs/p0-gauntlet-contract.md)
      demonstrated on the workstation with evidence archived under
      `history/p0/` (four spikes: filesystem bypass/drift + writer surface,
      non-interactive user-manager apply, same-ref rotation/reload,
      upgrade + failed-health rollback across SQLite stamps). Any failed
      assertion produced a dated decision-log revision before further work.
- [ ] **Driver shipped** — `@beep/openclaw` exports the desired-intent
      schema, a versioned render adapter whose output passes the pinned
      binary's `config validate` (plus negative fixtures) with the lossy
      schema-export CI guard in place, the CLI wrapper, and the probe set;
      package passes repo quality gates.
- [ ] **First vertical slice proven** — one minimal generation (gateway +
      Control UI, no channel/skills) deployed via `pulumi up`, healthy on
      liveness+readiness, and a second generation switch with a forced
      failed-health rollback restores the prior generation. The drift audit
      demonstrates detection across its normative inventory — deliberate
      drift in the generation pointer, package/Node version, unit content,
      unit enabled/active state, and config file — plus preflight failure on
      a wrong-identity target; both backup classes (encrypted Pulumi state,
      encrypted SQLite snapshots) land on dankserver with a restore drill.
- [ ] **Agent live** — Telegram DM round-trip and Control UI reachable;
      legal persona + guardrails rendered as generation artifacts
      (`configWrites: false`, advisory confidentiality, no real client
      data); the writer compatibility matrix verified against the live
      channel. Unless cut by a dated decision-log entry (sanctioned
      appetite cuts): hosted primary + local provider profile, and exactly
      one benign proof skill installed declaratively — repo-local or
      pinned, permissively licensed, no network/shell/secret access, no
      client data, narrowly specified harmless behavior.
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
