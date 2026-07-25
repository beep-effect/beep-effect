# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.

Rewritten post-GATE-B: the solution sketch reflects the adversarial-review
outcomes recorded in DECISIONS.md (OpenClawGeneration, OS-enforced config
root, desired-intent schema, applicator contracts, Telegram, secrets
bootstrap exception, prototype gauntlet).

Amended at GATE C (2026-07-25): the dankserver migration is struck entirely
— the platform deploys NEW OpenClaw instances, workstation first; appetite
finalized. See the dated GATE C entries in DECISIONS.md.
-->

## Problem

Running OpenClaw well is imperative, drift-prone ops. dankserver's Ansible
openclaw role is 4790 lines / 252 tasks that patch live `openclaw.json`
through the CLI, binary-patch installed bundles, and hand-manage plugins,
versions, and channel secrets. The community independently confirms the
premise: config breaks on updates, agents edit their own config, and the
folklore mitigations (git-tracked config, `.last-good` backups,
"config set only" rules) are people hand-rolling a declarative owner
([`research/x-com-field-notes.md`](./research/x-com-field-notes.md)).

This repo already has an Effect-native Pulumi workspace with a proven
schema-decoded-config + secret-ref + preflight→apply→health pattern
(`infra/src/AIMetrics.ts`), and OpenClaw ships real declarative seams: an
immutable-config mode, config schema/validate, runtime `op://` secret
resolution, and lockfile-based skill installs ([`RESEARCH.md`](./RESEARCH.md)).
The adversarial review ([`research/adversarial-review.md`](./research/adversarial-review.md))
established what a credible declarative owner actually requires — OS-enforced
immutability, a generation concept, and staged upgrades — now locked into
[`DECISIONS.md`](./DECISIONS.md).

Why now: a new professional, legal-focused agent is wanted on the
workstation, and this platform is how new OpenClaw instances get deployed
from here on — this Linux workstation first. dankserver's role stays as-is
indefinitely: it is the evidence of the problem, never a migration target
(GATE C decision, 2026-07-25). Enabling substrate for
agentic-professional-runtime (dogfooding + ops learning), firewalled from
product work.

## Appetite

Locked at GATE C (2026-07-25): **one focused build cycle** for the
workstation slice — a contiguous run of implementation sessions with this as
the primary bet — sequenced as prototype gauntlet first (~the first fifth of
the cycle), then driver + generation engine + applicator, then the live
agent. If the workstation slice threatens its cycle, cut the proof skill or
the local-model provider profile — never the immutable-config posture, the
generation state machine, or the typed intent schema, which are the point. A
failed P0 prototype does not extend the budget; it re-opens the gated
decision and re-shapes.

## Solution Sketch

One core concept, two repo artifacts, four gates.

**The core concept — `OpenClawGeneration`:** every deploy produces a
hash-versioned, immutable revision binding: pinned OpenClaw package version +
rendered `openclaw.json` + systemd `--user` unit + workspace artifacts
(SOUL.md/persona) + pinned, integrity-checked skills + plugins. Generations
live under root-owned, world-readable paths
(`/etc/beep/openclaw/<content-hash>/…`); the gateway sees the active one via
`OPENCLAW_CONFIG_PATH`, with `OPENCLAW_NIX_MODE=1` as defense-in-depth and an
independent drift audit (preflight hash check + recurring canary). Upgrades
are a staged state machine: stage side-by-side → validate with the candidate
binary → stop → snapshot shared + per-agent SQLite (incl. WAL) → switch one
pointer → start → acceptance probes → commit or restore; irreversible DB
migrations are pre-classified and operator-gated.

**Artifact 1 — `packages/drivers/openclaw` (`@beep/openclaw`):**

- Desired-intent Effect schema: OUR deployment intent (gateway, agent
  identity, Telegram channel, model providers incl. a local OpenAI-compat
  profile, guardrails, skills) — small, stable, consumer-facing.
- Versioned render adapter: intent → `openclaw.json` for the pinned OpenClaw
  version; acceptance = the candidate binary's plugin-aware
  `config validate` + negative fixtures; CI fails on lossy schema-export
  placeholders for declared extensions.
- CLI process wrapper (`onepassword-cli` style): version query, doctor
  (read-only lint), config validate, service control, `secrets reload`.
- Probes: liveness (`/health`), readiness (`/ready`), and an acceptance set
  (authenticated model completion, local-provider probe, skill
  inventory/hash, secret-degradation check, Telegram synthetic
  send/receive).

**Artifact 2 — `infra/openclaw` Pulumi project + `infra/src/OpenClaw.ts`:**

- AIMetrics-style stack: `S.Class`-decoded `openclaw:*` Pulumi config;
  local passphrase state + automated encrypted off-machine state backup (to
  dankserver over Tailscale).
- Shared pure renderers (generation content), plus explicit **applicator
  contracts**: workstation-local is the only one built; remote-SSH remains a
  designed seam for future new instances — each declaring target user/UID,
  runtime dir, bus reachability, linger ownership, privilege boundary;
  preflight exercises the exact non-interactive context and binds the stack
  to target identity (`/etc/machine-id` + hostname + UID), failing before
  mutation on mismatch.
- Secrets: `op://` references as data everywhere (typed as
  `OnePasswordReference`), resolved by OpenClaw's native exec provider at
  runtime; ONE recorded bootstrap exception — a scoped
  `OP_SERVICE_ACCOUNT_TOKEN` as a root-owned systemd credential provisioned
  out-of-band; rotation is an operational surface (post-rotation
  `secrets reload` + degraded alerting + authenticated probe).

**The agent (v1):** legal-professional persona (SOUL.md) with guardrails at
two explicit assurance levels — enforceable config (workspace boundary,
tool/command allowlists, sandbox policy, `configWrites: false`) and
**advisory** persona guidance ("no client identifiers in channel traffic" is
prompt text, not a confidentiality boundary; no real client data in v1) —
Control UI + Telegram DM, hosted primary model + local llama-server provider
profile, exactly one benign proof skill installed declaratively as a
generation artifact.

**The four gates (goal P0 prototype gauntlet, hard-gating implementation):**
filesystem bypass/drift, non-interactive user-manager apply, same-ref
rotation/reload, upgrade + failed-health rollback across SQLite schema
stamps. A failed prototype re-opens its gated decision.

## Rabbit Holes

- **Writer-surface completeness.** There is no finite runtime-written key
  list (`config set`, gateway RPC, migration providers target arbitrary
  paths); the bounded thing is the writer-surface inventory in
  [`research/openclaw-config-internals.md`](./research/openclaw-config-internals.md).
  The gauntlet must confirm nothing operationally essential breaks under the
  guard — especially Telegram's writeback skip paths.
- **Auth bootstrap ceremony.** Login/paste flows write secrets to SQLite AND
  `auth.profiles` metadata to config; under immutability the stack renders
  the non-secret metadata declaratively and provisions credentials
  out-of-band — the exact ceremony needs a worked runbook.
- **Non-interactive `systemd --user`**: linger, `XDG_RUNTIME_DIR`, DBus in
  whatever shell Pulumi applies from — the applicator preflight owns this.
- **JSON5 vs JSON canonicalization**: upstream reads JSON5, writes canonical
  JSON; our renderer emits canonical JSON and never depends on comments.
- **Upgrade runbook**: doctor migrations are blocked by design; upgrades are
  re-render + generation switch, with `meta.lastTouchedVersion` and the
  future-version guard respected.
- **Preview fidelity**: `command.*` resources skip execution during preview
  and have no read/refresh; the drift audit lives outside them, and the
  stack binds to machine identity to avoid silent wrong-target no-ops.
- **Schema drift vs upstream cadence**: the render adapter is per pinned
  version; CI validates against the exact candidate binary, not docs.
- **Node-not-Bun runtime**: the launcher rejects Bun (needs `node:sqlite`);
  the generation pins a supported Node for the service even though repo
  tooling is Bun.

## No-Gos

- Migrating dankserver at all (GATE C, 2026-07-25) — its Ansible role
  (OS layers, openclaw layer, and bundle patches alike) keeps owning that
  instance indefinitely; this platform deploys new instances only.
- Voice (cloudflared/Twilio/streaming/ElevenLabs) in the greenfield build.
- llama-server lifecycle management (it already runs; we only reference it).
- Gateway HTTP/WS API client in the driver (no consumer yet).
- Real legal capabilities (USPTO MCP, docketing, …) — they arrive via the
  SDK-adapter path, not this substrate packet.
- Discord as the v1 channel.
- Enforceable outbound DLP — v1 confidentiality is advisory-only, so real
  client data stays out entirely.
- Plaintext secrets anywhere: tracked files, Pulumi state, rendered configs,
  Command outputs.
