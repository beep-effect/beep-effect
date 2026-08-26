# LeJeune Knowledge Desk Lab

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Build a disposable, offline-capable customer-demo lab that runs the fixed 30-minute LeJeune
story from fragmented RFQ evidence to a reviewed quote, cited RFI, reviewed veteran correction,
and approval-gated non-executing supplier PO receipt.

Graduated on 2026-08-26 from the
[`lejeune-bolt-agentic-demo`](../../explorations/lejeune-bolt-agentic-demo/README.md)
exploration.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/lejeune-knowledge-desk-lab/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing and dependency.
5. [`research/`](./research/) - carried-forward source and capability ledger.
6. [`history/`](./history/) - evidence and closeouts, when present.
7. [`DECISIONS.md`](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md) - ratified
   architecture and shape decisions.

## Current Phase

P0 Lab and screen scaffold — not started. Start only on Benjamin's signal.

## Latest Evidence

The source exploration passed shape review and decompose on 2026-08-26. Its
[`MAP.md`](../../explorations/lejeune-bolt-agentic-demo/MAP.md) fixes the scenario, walking
skeleton, fallback rules, and dependency on the deterministic bundle packet.

## Notes

- Working title: "LeJeune Knowledge Desk," with beep branding.
- Create the proposed `lejeune-bolt-workbench` lab (under `apps/labs/`) only through
  `bun run beep create-package`; never hand-mint it.
- This packet requires the `lejeune/demo-corpus-and-ontology` capability from
  [`lejeune-demo-corpus-and-ontology`](../lejeune-demo-corpus-and-ontology/README.md).
  Days 1-2 may scaffold against stubs; bundle integration and acceptance remain gated.
- The lab and mutable corpus have a 2026-09-30 delete-or-promote disposition date.
