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

P0 Prototype gauntlet — **complete. All four spikes pass every contract
assertion** ([`ops/handoffs/p0-gauntlet-contract.md`](./ops/handoffs/p0-gauntlet-contract.md)):
spike 1 (6/6), spike 2 (3/3), spike 3 (3/3), spike 4 (3/3). No gated decision
was re-opened — OS-enforced config immutability, the applicator contract and
identity binding, the secrets bootstrap exception and rotation surface, and
the OpenClawGeneration state machine all stand as decided. P1 (driver) is
unblocked.

## Latest Evidence

- 2026-07-25 — Spike 2 (non-interactive user-manager apply): **PASS**,
  [`history/p0/spike-2-user-manager/NOTES.md`](./history/p0/spike-2-user-manager/NOTES.md).
- 2026-07-25 — Spike 4 (upgrade + failed-health rollback across SQLite
  stamps): **PASS** in the v3 rerun (20 assertions, forward-recovery leg,
  full pins, zero-residual postflight),
  [`history/p0/spike-4-upgrade-rollback/NOTES.md`](./history/p0/spike-4-upgrade-rollback/NOTES.md).
  The interrupted v2 run and its adversarial adjudication are archived
  alongside as run history.
- 2026-07-26 — Spike 1 (filesystem bypass/drift + writer surface): **PASS,
  6 of 6**,
  [`history/p0/spike-1-filesystem-writer/NOTES.md`](./history/p0/spike-1-filesystem-writer/NOTES.md).
  Assertions 1–4 on 2026-07-25; the writer surface and its compatibility
  matrix on 2026-07-26 with no INCOMPATIBLE row. The pairing case is the
  strongest single result: a live externally triggered first-owner pairing
  completes and persists the sender in mutable state while the
  `OPENCLAW_NIX_MODE` guard refuses the owner-config write, with the root
  inventory byte-identical. Its live-fire sections record fourteen
  execution-only harness defects that adversarial review did not catch, plus
  applicator findings (app-layer refusal as a second defense, the
  `config_health_entries` drift surface, cross-writer mode-encoding
  variance).
- 2026-07-27 — Spike 3 (same-reference rotation/reload): **PASS, 3 of 3**,
  [`history/p0/spike-3-secret-rotation/NOTES.md`](./history/p0/spike-3-secret-rotation/NOTES.md).
  Rotation behind an unchanged `op://` reference evicts the cold owner within
  a second, the degraded-reload alert fires and recovers, and a gateway-served
  model completion plus a live Telegram probe are both bound to the same
  reload event. Records eight harness defects, the single-use bootstrap
  credential constraint, and a disclosed earlier isolation deviation.

## Session Handoff

Gauntlet closed 2026-07-27; the next session starts P1 (driver). The
mid-gauntlet handoff
[`ops/handoffs/p0-session-handoff-2026-07-25.md`](./ops/handoffs/p0-session-handoff-2026-07-25.md)
is retained as run history — its operator prerequisites are satisfied, but its
privileged-run mechanics still apply (YubiKey-FIDO sudo needs a single armed
pty session; spikes 1 and 3 must never run concurrently on the shared root;
the spike-3 bootstrap credential is single-use per cycle and its creation
needs an interactive 1Password approval).

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
