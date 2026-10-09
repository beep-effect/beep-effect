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

P0 complete. P1 is implemented locally; the run-2 release ruling clears the
private-changeset blocker. Final schema/file-processing/documents-server default
proofs and hosted-parity retries are waiting for shared heavy slots. PR #1570
remains draft at the wave-1 head. P2/P3 and content-final publication remain.

## Latest Evidence

P0 audit baseline: `36027982f2`. All declared prerequisites re-confirmed; adoption
plan reports zero conflicts. Rule inventory and autonomy decisions are recorded.
Wave-1 synthetic fixtures: 25 scrub cases and 7 old/new consumer cases. Single-file fixture
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
each count 0, pass. The expanded matrix has 27 scrub and 9 renderer fixtures.
The latest exact scan covers all 81 accumulated local log surfaces, including
failure output: every count is 0, pass. Schema and file-processing default audits,
test-tsgo and coverage passed before the final compatibility/parser delta; that
delta and the three consumer default proofs remain pending. Documents-domain
package-verify, test-tsgo and coverage pass. Local docgen and the regenerated
JSDoc ratchet passed before the parser delta; the current final parity run is
still active. Fallow's introduced parser-complexity finding is repaired and
awaits re-verification.

First-wave hosted Check: introduced scanner error construction repaired locally
with schema `.make`. First-wave hosted Lint Policy and local knowledge references:
one inherited gated observation in another goal's SPEC, confirmed on `origin/main`;
the orchestrator owns its consolidated repair. The lane changes no shared policy.

## Notes

Injection findings are the next gated increment. PII/OOXML, sanitizer, guarded
fetch, resolver, and credential vault work remain outside this packet.

### Run 1 detached proof and former blocker

Observability, ai-metrics and documents-domain default package-verify, test-tsgo
and scoped coverage pass. Schema and file-processing default package-verify,
test-tsgo and coverage passed before the final internal parser/consumer-adapter
delta; their final retry was canceled while still waiting for admission. The
last documents-server audit failed on an introduced synthetic-model Effect.fn
policy error. Signed repair `0b100e151782912334784cfafae3d0865ceed1c7` fixes it;
all five focused gate tests pass, and the inbox row is acknowledged. Its default
retry was canceled before execution because of the confirmed release-policy
blocker. All six prior scoped test-tsgo runs passed; final deltas remain unproven
by default package checks.

Local docgen passes before the final internal parser delta. Regenerated JSDoc
ratchet passes. Fallow audit and health pass with zero introduced findings after
the parser complexity repair. Scoped coverage passed for all six packages on
those recorded runs; the final schema/file-processing/server retries did not run.
The post-merge knowledge-reference check passes with zero gated observations;
the earlier inherited observation is cleared by main. Initial hosted
Coverage Regression failures concern unchanged CLI files, and initial hosted
Check's scanner-construction error is repaired locally. Current implementation
has not been pushed, so none of those old hosted results proves the local head.
All owned jobs are stopped or terminal; no queued proof is reported as executed.

### Run 2 resume

The orchestrator release ruling clears the private-changeset conflict. All six
packages are private; release notes and the standalone Layer major compatibility
note live in the handoff and PR body. Changeset graph: pass, zero references.
Final schema/file-processing/documents-server default proofs, test-tsgo, coverage
and updated repo parity are queued through two owned heavy units. No canceled or
queued command is counted as a pass. P1 remains in progress.
