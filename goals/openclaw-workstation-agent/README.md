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

P0 Prototype gauntlet — in progress. Spikes 2 and 4 pass in full; spike 1
passes 4 of its 6 assertions (filesystem bypass, privileged pointer switch,
guarded CLI writers, alert-only drift canary) with the Telegram
writer-surface pair blocked on a disposable test group; spike 3 has a
reviewed harness blocked on a scoped 1Password service-account token. All
per the executable contract in
[`ops/handoffs/p0-gauntlet-contract.md`](./ops/handoffs/p0-gauntlet-contract.md).
No implementation phase may run before every contract assertion passes.

## Latest Evidence

- 2026-07-25 — Spike 2 (non-interactive user-manager apply): **PASS**,
  [`history/p0/spike-2-user-manager/NOTES.md`](./history/p0/spike-2-user-manager/NOTES.md).
- 2026-07-25 — Spike 4 (upgrade + failed-health rollback across SQLite
  stamps): **PASS** in the v3 rerun (20 assertions, forward-recovery leg,
  full pins, zero-residual postflight),
  [`history/p0/spike-4-upgrade-rollback/NOTES.md`](./history/p0/spike-4-upgrade-rollback/NOTES.md).
  The interrupted v2 run and its adversarial adjudication are archived
  alongside as run history.
- 2026-07-25 — Spike 1 (filesystem bypass/drift + writer surface):
  **INTERIM PASS on assertions 1–4**, assertions 5–6 blocked,
  [`history/p0/spike-1-filesystem-writer/NOTES.md`](./history/p0/spike-1-filesystem-writer/NOTES.md).
  Its live-fire section records seven execution-only harness defects that
  four adversarial review rounds did not catch, plus findings for the
  applicator design (app-layer refusal as a second defense, the
  `config_health_entries` drift surface, and cross-writer mode-encoding
  variance).

## Session Handoff

Paused mid-gauntlet on 2026-07-25 — read
[`ops/handoffs/p0-session-handoff-2026-07-25.md`](./ops/handoffs/p0-session-handoff-2026-07-25.md)
first: current spike verdicts, the two remaining operator prerequisites, how
to drive privileged runs (YubiKey-FIDO sudo needs one pty session), the
applicator design findings, and the nine harness defects that only execution
revealed.

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
