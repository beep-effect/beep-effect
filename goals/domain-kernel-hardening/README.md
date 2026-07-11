# Domain Kernel Hardening

## Status

Lifecycle: `paused`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Harden the shared-kernel persisted-entity base (`BaseEntity`) once, so every
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

`P0 Research` — confirm the `BaseEntity`/`DomainModel`/`persist` surface and the
soft-delete persistence strategy before any edit. Next concrete action: inspect
`packages/shared/domain/src/entity/BaseEntity.ts` and
`packages/foundation/modeling/schema/src/{DomainModel.ts,EntitySchema/*}`.

## Latest Evidence

Not started.

## Notes

- This packet changes the **kernel only**. It does NOT migrate slice entities,
  replace `*FixtureKey` strings, or type any `snapshot: UnknownRecord` — those are
  sibling packets (`domain-typed-references`, `epistemic-claim-body`, …).
- `rowVersion` (`PosInt`, `incrementedOnWrite`) already subsumes `DomainModel.version`;
  do not add a second version field.
