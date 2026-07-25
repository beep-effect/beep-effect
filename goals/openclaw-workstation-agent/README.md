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
hard-gating spikes on the workstation (filesystem bypass/drift,
non-interactive user-manager apply, same-ref rotation/reload,
upgrade+failed-health rollback across SQLite stamps) and archive evidence
under `history/`. No implementation phase may run before the gauntlet
passes.

## Latest Evidence

Not started.

## Notes

- Appetite (binding, GATE C 2026-07-25): one focused build cycle. Sanctioned
  cuts: proof skill, local-model provider profile. Never cut: immutable
  posture, generation state machine, typed intent schema.
- Implementation volume routes to claudex sessions; gate judgment stays with
  Fable sessions (global routing doctrine).
- Licenses: `nix-openclaw` upstream is AGPL-3.0 — clean-room study only;
  `schemalabz/nix-openclaw` is unlicensed — reference only. See
  `research/SOURCES.md`.
