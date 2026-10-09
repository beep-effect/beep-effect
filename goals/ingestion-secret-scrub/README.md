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

P0-P2 complete; P3 is blocked at publication. PR #1570 remains draft at the
P2 head `ef87b84675`. The closing reflection and support scan are retained locally.
The required main sync brought an out-of-scope Effect Vitest finding from #1572;
no P3 content was pushed. The packet remains active until that inherited gate is
repaired by its owner and the closing wave can publish.

## Latest Evidence

- Canonical bank: `credential-pattern-bank/v1`, seven categories and one rule per
  category; both former banks delegate matching to the schema namespace barrel.
  P0 inventory and nine consumer cases pin union coverage and existing rendering.
- Synthetic scrub matrix: 27 cases with exact text/count/coverage/residue/admission
  expectations, plus independent action verdicts. Bank, scrub, fixture integrity,
  consumer and gate tests pass; no corpus or client document was read.
- Prompt boundary: five FilingDecisionLlm cases (clean, masked, blocked, unknown,
  absent) pass. Blocked/unknown make zero model calls; admitted excerpts use only
  the scrub-minted text. Captured prompts, logs, spans and failure causes contain
  zero tested canaries. Admission grants no action or egress permission.
- Serialization/error proof: every scrub result and evidence projection has zero
  exact canary counts; findings retain masks and offsets only. No TextAnchor is
  emitted. Redacted error messages, causes, detail and fingerprints pass absence
  assertions. Persisted sources, test output and accumulated logs are scanned too.
- Retention: TestClock proves success/seven-day raw, thirty-day proof unless pinned,
  and twelve-calendar-month audit eligibility across a leap year. Enforcement is
  the schema plus pure purge decision; no storage adapter or migration is claimed.
- All six edited-package default package-verify and test-tsgo commands pass. All
  six scoped coverage commands pass. Final source runs include schema 483 tests,
  file-processing 71 tests and documents-server 102 tests; unchanged domain proof
  retains its verified receipt.
- Updated docgen local, regenerated JSDoc ratchet and Fallow audit/health pass.
  Knip and all 16 publication cheap gates pass with zero introduced findings.
  Root alias synchronization reports no drift after the namespace-only repair.
- Exact-canary scan rebuilds three canaries from runtime fragments and counts
  only: 184 accumulated source/support/output surfaces, each 0, pass. This covers
  fixtures, errors, logs, telemetry test output, packet evidence, PR title/body and
  branch commit messages. P3 final-byte support re-scan is recorded below.
- Local commit-range gitleaks passes with no leaks. The P1 hosted Secret Scanning
  and SAST jobs failed before scanning on Docker image acquisition (pull rate
  limit and auth-endpoint timeout); their exact completed logs were read and rows
  acknowledged as environment-only. Hosted success is not inferred. Vercel build
  rate limits carry the explicit repository exception. Fresh heads run fresh CI.
- P3 final-byte scan rebuilds the same three runtime-fragment canaries: 195
  accumulated source/support/output surfaces, each 0, pass. It includes the closing
  handoff and reflection, inventory, friction, README, PR title/body and branch
  commit messages. Final evidence edits are rechecked before publication; AC4 is
  ticked from these counts. No review replies exist at the fresh thread read.
- Reflection lint passes with zero blocking and zero advisory findings. The final
  main sync is conflict-free and changes none of the six scrub packages, so the
  qualified source receipts remain applicable. Publication reran root cheap gates; fifteen pass and one inherited gate blocks push.
- Closing publication blocker: `lint:effect-vitest` reports one new finding in
  `packages/epistemic/use-cases/test/ContradictionDetection.golden.test.ts`. That
  file exactly matches origin/main and arrived via #1572; no scrub test is flagged.
  The local inbox row is attributed outside lane ownership. Owned monitor stopped
  and terminal receipt acknowledged. Completion flip is reversed to active/P3 in
  progress; the reflection is retained. No ready or merge-ready claim is made.
- R4 maps on-demand Yeet verify to exact-head hosted CI plus this hosted-parity
  set. Final reflection and readiness evidence are recorded at P3. This proof
  covers one confidentiality prompt boundary, not injection, tool-policy or egress.

## Notes

Injection findings are the next gated increment. PII/OOXML, sanitizer, guarded
fetch, resolver, and credential vault work remain outside this packet.
