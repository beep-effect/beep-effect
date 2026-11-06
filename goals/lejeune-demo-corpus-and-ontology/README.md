# LeJeune Demo Corpus and Ontology

## Status

Lifecycle: `active` (P0-P3 complete; `completed-retained` proposed by the final PR)

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Build the deterministic machine-local bundle that turns public material and synthetic Office
fixtures into exact source spans, the frozen fastener ontology, cited rule results, and local
PGlite, DuckDB, and bounded Oxigraph projections.

Graduated on 2026-08-26 from the
[`lejeune-bolt-agentic-demo`](../../explorations/lejeune-bolt-agentic-demo/README.md)
exploration.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/lejeune-demo-corpus-and-ontology/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - carried-forward source and capability ledger.
6. [`history/`](./history/) - evidence and closeouts, when present.
7. [`DECISIONS.md`](../../explorations/lejeune-bolt-agentic-demo/DECISIONS.md) - ratified
   architecture and shape decisions.

## Current Phase

Closed. The lab, bundle builder, projections, rule checks, provider recording and
offline replay merged in #872 (2026-08-30). That PR predates the Yeet publish
verdict and was pushed without one, so this docs-only final PR carries the
`completed-retained` proposal and the gating verdict. The closeout reflection is
`history/reflections/2026-08-27-codex.md`.

## Latest Evidence

- 2026-11-06: 2026-09-30 disposition recorded. No promotion or consented pilot
  was granted, so the mutable machine-local corpus falls to `delete`. Nothing
  durable existed to delete: the lab writes bundles only under its ignored
  `.beep/` directory and test-scoped temporary directories, and no such root is
  present on the workstation. The builder's fail-closed boundary (no publication
  on or after the disposition date without a reviewed extension) stays proven by
  the clock-controlled tests. Authored packet history and source ledgers remain.
The 2026-08-27 [golden bundle report](./history/evidence/2026-08-27-golden-bundle.md) records
four frozen synthetic source hashes, 20 exact spans, two explicit missing fields, six rule
outcomes, deterministic PGlite/DuckDB/Oxigraph rebuilds, one sanitized live Anthropic
recording, and byte-identical offline replay receipts.

## Notes

- This packet creates no second workspace package. It delivers lab-local schemas, fixtures, and
  operations into the same proposed `lejeune-bolt-workbench` lab (under `apps/labs/`) used by
  [`lejeune-knowledge-desk-lab`](../lejeune-knowledge-desk-lab/README.md).
- The mutable machine-local corpus had a 2026-09-30 delete-or-promote disposition date;
  it fell to `delete` with nothing durable on disk (see Latest Evidence, 2026-11-06).
- The lunch artifact is replay-first. Live provider output is recorded for deterministic
  offline replay; raw corpus payloads never enter the repository.
