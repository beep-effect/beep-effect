# Ingestion Secret Scrub

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Deliver the pre-LLM secret scrub: a narrow `@beep/file-processing` transform
that turns authorized extracted text into sanitized, prompt-gated output with
non-secret proof and honest coverage/residue status.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/ingestion-secret-scrub/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - inherited implementation provenance.
6. [`history/`](./history/) - evidence and closeouts, when present.
7. [`ingestion-security-secret-governance`](../../explorations/ingestion-security-secret-governance/README.md) - source exploration.

## Current Phase

P0 complete. P1 implementation is next: canonical bank, scrub transform and
FilingDecisionLlm prompt gate.

## Latest Evidence

P0 audit baseline: `36027982f2`. All declared prerequisites re-confirmed; adoption
plan reports zero conflicts. Rule inventory and autonomy decisions are recorded.
Synthetic fixtures: 25 scrub cases and 7 old/new consumer cases. Single-file fixture
integrity: 2 tests pass. Live legacy-rendering comparison: 0 mismatches. Exact-canary
scan of fixture/test/scanner source, inventory, friction receipt, SPEC and handoff:
each count 0, pass. Direct fixture gitleaks scan: pass. Commit-range secrets lane
will run after the signed wave-1 commit. Package proof remains pending; no runtime
scrub or prompt-gate implementation is claimed.

## Notes

Injection findings are the next gated increment. PII/OOXML, sanitizer, guarded
fetch, resolver, and credential vault work remain outside this packet.
