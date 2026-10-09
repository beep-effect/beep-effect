# Domain Kernel Hardening

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Harden the shared-kernel persisted-entity audit pack (`EntityKit.auditColumns`) once, so every
product slice inherits soft-delete, a single canonical audit base, and the typed
domain-error (`.errors.ts`) convention the rest of the domain-layer hardening
builds on. (The `TemporalValidity`/`DomainEvent` VOs are deliberately deferred to
their consuming packets — a zero-consumer shared export is not promotable.)

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/domain-kernel-hardening/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.

## Provenance

First graduated slice of the
[`domain-layer-hardening`](../../explorations/domain-layer-hardening/README.md)
exploration. The audit (`synthesis/10`–`14` + rollup `19`), external grounding
(`synthesis/20`–`21`), and resolved decisions (`DECISIONS.md`, G1–G14 + N1–N8)
back this packet — read by reference, not copied. Sibling packets 2–7 are named
in [`MAP.md`](../../explorations/domain-layer-hardening/MAP.md).

## Current Phase

`P2 Verify` — P1 implementation and full local qualification are complete.
The amended run-order ruling publishes P1, P2 and P3 as separate waves; lifecycle
remains active until the P3 reflection and owner-command completion transition.

## Latest Evidence

`history/handoffs/domain-kernel-2026-10-09.md` — eleven passing package proofs,
repaired six-server gate, 64 migration-replay tests, full local hosted-parity set,
external bundle-schema decision D16 and mechanical fixture repair D17.
P0 grounding remains at `research/p0-kernel-surface-2026-10-09.md`.

## Notes

- This packet changes the **kernel only**. It does NOT migrate slice entities,
  replace `*FixtureKey` strings, or type any `snapshot: UnknownRecord` — those are
  sibling packets (`domain-typed-references`, `epistemic-claim-body`, …).
- `rowVersion` (`PosInt`, `incrementedOnWrite`) already subsumes `DomainModel.version`;
  do not add a second version field.
