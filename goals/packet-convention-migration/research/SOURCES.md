# SOURCES — Packet Convention Migration

This goal inherits its research from the parent exploration; it links rather
than copying the evidence.

## Inherited decisions and reports

- [`packet-system-redesign/MAP.md`](../../../explorations/packet-system-redesign/MAP.md)
  — candidate 6, Session B amendments, change tree, symbols, and sequencing.
- [`packet-system-redesign/DECISIONS.md`](../../../explorations/packet-system-redesign/DECISIONS.md)
  — D17–D26, including campaign priority, ownership, first slice, and PR shape.
- [`Session B research`](../../../explorations/packet-system-redesign/research/2026-08-26-session-b/README.md)
  — repository audits and prior-art sweeps behind H/I/J and the migration
  method.
- [`ontology-tooling recon`](../../../explorations/packet-system-redesign/research/2026-08-25-ontology-tooling-recon.md)
  — actual-shape probes, severity tiers, drift classification, and fleet lint.

## Live capability references

- `packages/tooling/tool/cli/src/commands/Goals/PacketCore/` — event schemas,
  canonical digests, store, fold, repair plan, transition writer, projector.
- `packages/tooling/tool/cli/src/commands/Goals/{Goals.schemas,Migration,Inventory}.ts`
  — v2 goal contract, existing surgical migration, and live fleet inventory.
- `packages/tooling/tool/cli/src/commands/Explore/Check.ts` — final packet
  stream acceptance surface.
- `packages/tooling/tool/cli/test/fixtures/packet-core/fork/` — committed fork
  proof fixture.

No upstream code is copied. External repositories in the parent source ledger
remain reference-only.
