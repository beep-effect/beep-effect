# Boolean-Creep Eradication

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Find every place AI-generated code flattened one domain state variable into
parallel correlated booleans, prove each with cited evidence (E1–E4), and
refactor the confirmed instances to schema-first shapes (LiteralKit literal,
tagged union, or Option-of-literal) that delete the guards the booleans made
necessary.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/boolean-creep/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract;
[`DECISIONS.md`](./DECISIONS.md) holds the ratified campaign decisions.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`DECISIONS.md`](./DECISIONS.md) - ratified decisions (binding).
4. [`PLAN.md`](./PLAN.md) - active execution plan.
5. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
6. [`data/inventory.jsonl`](./data/inventory.jsonl) - campaign state of truth.
7. [`research/`](./research/) - supporting research.
8. [`history/`](./history/) - evidence and closeouts.

## Current Phase

The moving-main census and design refresh remain in progress. GATE 1 passed on
2026-08-17. Benjamin's 2026-09-03 amendment revoked the stale zero-findings
assertion and delegated GATE 2's transition to the packet evidence:
implementation becomes authorized only after two current-source dry census
rounds, the replacement exact-source zero-finding review receipt, and the
packet-only ratification PR are complete. That bounded mandate admits newly
introduced E1-E4 cases without another user gate; all original qualification
and compatibility laws remain binding.

## Latest Evidence

The canonical inventory now contains **764 records: 105 qualified and 659
disqualified** (D1 533 / D2 126). The qualified set is **94 Tier 1 and 11 Tier
2**; 45 retain the historical `reviewed` state and 60 are `designed` pending a
replacement all-record review. Round 22 at
`c78ee7471a35825e7757f49138d17189298491f9` added no canonical qualification,
but `origin/main` advanced and round 23 at
`53193e5a5e7ea29036368085635aef680c614d27` admitted
`r3-tooling-docgen-local-full-reason-input-kind`, resetting the dry counter.
That round is also inadmissible because its foundation and
drivers/architecture lanes exhausted their output budgets. The branch is now
at exact `42eecabbe1bc767161ee21c742c0f2c6d94a4e14`; no dry round is credited at
that source SHA.

The pre-refresh inventory is archived at
[`history/inventory/2026-09-03-pre-refresh.jsonl`](./history/inventory/2026-09-03-pre-refresh.jsonl):
294 records, including 46 qualified. Stable ids were retained for surviving
file-and-symbol pairs. The previous review receipt is historical evidence only
and cannot pass GATE 2; its replacement must name the exact source SHA and
cover all 105 qualified records and corrected designs.

## Notes

- The inventory is schema-validated JSONL; the record union makes
  "disqualified but designed against" unrepresentable
  ([`ops/validate-inventory.ts`](./ops/validate-inventory.ts)).
- The original two user gates were honored. The 2026-09-03 amendment grants a
  narrow evidence-triggered GATE 2 transition for completion of this campaign.
- Tier 2 instances (persisted/wire encoded exposure) land one PR each with an
  encoded-compat proof; Tier 1 lands batched by package/app.
- The agent never merges. Completion means all implementation and closeout PRs
  are merged by Benjamin and the completed packet is verified on `main`.
