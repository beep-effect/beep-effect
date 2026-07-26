# OpenClaw Workstation Agent

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Deploy a legal-focused OpenClaw agent on the Linux workstation as immutable,
generation-based, Pulumi+Effect-managed infrastructure — prototype gauntlet
first, then driver, then live agent. This platform is how new OpenClaw
instances get deployed; the workstation is the first target (dankserver is
never migrated — GATE C decision in the source exploration).

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/openclaw-workstation-agent/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger
   (inherited from the exploration; licenses are load-bearing).
6. [`history/`](./history/) - evidence and closeouts, if present.

Provenance:
[`explorations/openclaw-deployment-platform`](../../explorations/openclaw-deployment-platform/README.md)
— BRIEF (shape), MAP (decomposition), DECISIONS (29 dated entries through
GATE C), research legs + adversarial review.

## Current Phase

P0 Prototype gauntlet — not started. Next concrete action: run the four
hard-gating spikes on the workstation per the executable contract in
[`ops/handoffs/p0-gauntlet-contract.md`](./ops/handoffs/p0-gauntlet-contract.md)
(filesystem bypass/drift + writer surface, non-interactive user-manager
apply, same-ref rotation/reload, upgrade+failed-health rollback across
SQLite stamps) and archive evidence under `history/p0/`. No implementation
phase may run before every contract assertion passes.

## Latest Evidence

- 2026-07-26: **Spike 2 (non-interactive user-manager apply) — 3/3 assertions
  PASS**, no blockers; evidence + harness at
  [`history/p0/spike-2/NOTES.md`](./history/p0/spike-2/NOTES.md). The gated
  decision *applicator contracts + identity binding* stands as written.
  Contract findings for P1: gate preflight on a bus round-trip, not
  `systemctl --user is-system-running` (returns `degraded` on healthy desktop
  managers); use `UnitsLoadTimestampMonotonic` as the daemon-reload drift
  witness; UNIX socket paths cap at 108 bytes under deep content-hashed roots.
  Recorded residual: the positive lane ran with an active session present —
  the genuinely session-less linger case is a named P1 follow-up. Spikes 1, 3,
  and 4 remain gated on operator prerequisites (sudo; scoped 1Password service
  token; throwaway Telegram bot + group; two adjacent stamped OpenClaw
  versions).

## Notes

- Appetite (binding, GATE C 2026-07-25): one focused build cycle, gauntlet
  allocated ~the first fifth. Sanctioned cuts (via dated SPEC decision-log
  entry): proof skill, local-model provider profile. Never cut: immutable
  posture, generation state machine, typed intent schema.
- Bulk implementation and gate-review judgment run as separate session
  roles; the operator's session routing lives outside the repo.
- Licenses: `nix-openclaw` upstream is AGPL-3.0 — clean-room study only;
  `schemalabz/nix-openclaw` is unlicensed — reference only. See
  `research/SOURCES.md`.
