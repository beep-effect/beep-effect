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

P0 complete. P1 implementation is in progress: the canonical bank, scrub transform
and FilingDecisionLlm gate are implemented locally; required package proof is queued.

## Latest Evidence

P0 audit baseline: `36027982f2`. All declared prerequisites re-confirmed; adoption
plan reports zero conflicts. Rule inventory and autonomy decisions are recorded.
Synthetic fixtures: 25 scrub cases and 7 old/new consumer cases. Single-file fixture
integrity: 2 tests pass. Live legacy-rendering comparison: 0 mismatches. Exact-canary
scan of fixture/test/scanner source, inventory, friction receipt, SPEC and handoff:
each count 0, pass. Direct fixture gitleaks scan: pass. Commit-range secrets lane
passed on the signed wave-1 commits. PR #1570 is draft with `ready-for-heavy`.

P1 focused proof: 5 canonical-bank tests, 31 scrub/admission/retention tests,
5 FilingDecisionLlm gate tests, 2 CauseRedaction compatibility/error tests and
1 metrics compatibility/count test pass. Together with the 2 P0 integrity tests,
46 focused tests pass. The gate cases cover clean, masked, blocked, unknown and
absent excerpts; blocked and unknown make zero model calls. All captured prompts,
logs and span attributes/failure causes contain zero tested canaries. Serialized
scrub results and evidence contain zero tested canaries; no TextAnchor is emitted.
The TestClock proves seven-day raw, thirty-day proof, pin/purpose decisions and
twelve calendar months across a leap year. Persisted exact-canary scans cover six
fixture/test sources, five focused-test output files and five packet support files:
each count 0, pass. Package/default proof and hosted parity remain pending.

First-wave hosted Check: introduced scanner error construction repaired locally
with schema `.make`. First-wave hosted Lint Policy and local knowledge references:
one inherited gated observation in another goal's SPEC, confirmed on `origin/main`;
the orchestrator owns its consolidated repair. The lane changes no shared policy.

## Notes

Injection findings are the next gated increment. PII/OOXML, sanitizer, guarded
fetch, resolver, and credential vault work remain outside this packet.
