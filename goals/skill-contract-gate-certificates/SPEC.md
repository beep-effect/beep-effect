# Skill Contract Gate Certificates Spec

## Objective

Skill Contract Gate Certificates (graduated from explorations/typed-agent-skill-contracts).

## Non-Goals

- Signing certificates or verifying them externally. The in-toto Statement envelope
  shape is used internally only (MAP §Amendment J, binding input 1).
- Reopening the completed `skill-contract-kernel` goal, or absorbing this work into
  candidate 3 (Yeet and bounded recovery) without a MAP amendment.
- Coupling to `packet-convention-migration`.
- Certificate producers other than the first QA judge settlement.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/foundation/modeling/skill-contract`: the certificate schemas (`Gate.ts`,
  `EvidenceReceipt.ts` and new certificate modules), shipped as the next
  `@beep/skill-contract` version with a changeset.
- `packages/tooling/tool/cli/src/commands/Qa/` (`JudgeContract.ts`, `JudgeLint.ts`,
  `QaJudgeGateId.ts`): the QA judge settlement that produces the first certificate.
- This packet's `SPEC.md`, `PLAN.md`, `README.md` and `ops/manifest.json`.

## Constraints

Binding inputs from `explorations/typed-agent-skill-contracts/MAP.md` §Amendment J
re-entry (ruled 2026-10-14, recorded in that exploration's `DECISIONS.md`):

- Envelope: a digest-bound in-toto Statement shape (subject digests plus predicate),
  unsigned.
- Outcomes are the EARL/ACT five: `passed | failed | cantTell | untested |
  inapplicable`. They replace the kernel's two-valued `allowed | denied` for
  certificates, and verdicts stay values, never errors (kernel doctrine).
- Reach is explicit: `complete | incomplete | unknown`. It is never a nullable
  `conforms`.
- The producer excludes inconclusive checks (`cantTell`, `untested`) from aggregate
  success. The aggregate is never `passed` when any in-reach check is inconclusive.
- Apply-by-id is a separate digest-bound plan that refuses stale or unknown ids.
- The package stays schemas-only in `foundation/modeling`. Dependency rules are
  unchanged: modeling depends only on primitive and modeling.

## Acceptance Criteria

- [ ] `@beep/skill-contract` exports the certificate schemas (envelope, five outcomes,
      reach, aggregate) with codec round-trip and property tests.
      (`src/GateCertificate.ts`, `test/GateCertificate.test.ts`; 2026-11-02, pending review)
- [ ] The QA judge settlement produces one certificate per run whose per-check
      outcomes match the existing judge checks (behavioural parity test against the
      current `JudgeCheck` results on the same fixtures).
      (production: `judge-lint` and `judge-ingest` write `gate-certificate.json`;
      frozen-legacy parity in `test/qa-round-pipeline.test.ts`; pending review)
- [ ] An aggregate containing any in-reach `cantTell` or `untested` check is never
      `passed` (property test). (kernel property plus QA untested-gate property)
- [ ] Apply-by-id refuses a stale digest and an unknown id (tests). (kernel and QA tests)
- [ ] No unrelated refactors or formatting churn. (pending independent review)

Unchecked on purpose (2026-11-02, after the independent review of `f6bdfc74`):
the parenthetical evidence is local and recorded in
[`history/2026-11-02-p0-p1-evidence.md`](./history/2026-11-02-p0-p1-evidence.md).
Boxes are ticked only after the independent panel accepts the production path,
exact-head `yeet final-check` passes, and the PR merges.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/skill-contract-gate-certificates/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/skill-contract-gate-certificates/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/skill-contract-gate-certificates` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-11-02 | New flat module `GateCertificate.ts` in `@beep/skill-contract`; no new package. | `bun run beep architecture add role` scaffolds slice `<slice> <concept> <role>` files only; this package is a flat foundation/modeling module set (`Gate.ts`, `EvidenceReceipt.ts`, ...). Searched `@beep/schema` (incl. `Conformance`) and the kernel: no existing EARL/ACT outcome or reach schema. | Delete `GateCertificate.ts`, its barrel line and test. |
| 2026-11-02 | The envelope reuses the kernel `EvidenceReceipt(predicateType, predicate)` factory with predicate type `.../evidence/gate-certificate/v1`; no `_type` field. | One in-toto-aligned envelope vocabulary in the kernel (MAP Amendment J input 1, DECISIONS 2026-08-26 "prevents a second certificate vocabulary"). Unsigned; no DSSE. | Swap the factory call for a dedicated Statement struct. |
| 2026-11-02 | Aggregate rule order: in-reach blocking `failed` -> `failed`; any in-reach `cantTell` -> `cantTell`; else any in-reach `untested` -> `untested`; reach not `complete` -> `cantTell`; any `passed` -> `passed`; else `inapplicable`. Advisory `failed` does not fail the aggregate. Decode rejects any stated outcome other than the settled one. | Implements "aggregate never passed with an in-reach inconclusive check" and makes non-complete reach unable to certify a pass; advisory handling matches the existing `GateSummary` blocking policy. | Edit `settleGateCertificateOutcome`; the coherence filter follows it. |
| 2026-11-02 | Reach is certificate-level (`complete/incomplete/unknown`); each check carries `inReach: boolean`. | Amendment J forbids a nullable `conforms`; a per-check scope bit is what "in-reach check" needs. | Replace the boolean with a per-check literal. |
| 2026-11-02 | Apply-by-id plan binds to the certificate envelope's own `EvidenceSubject` (name + digest the caller computes over the encoded bytes); stale digest is refused before ids are read; any unknown id refuses the whole plan; refusal is a value. | The kernel stays schemas-only (no hashing service); the producer owns digest computation, as for every other kernel receipt. | Change `applyGateCertificatePlan`. |
| 2026-11-02 | QA producer: `certifyQaJudgeSettlement` in `JudgeContract.ts` maps allowed -> `passed`, denied -> `failed`, gate not run -> `untested`, reach `complete` (all five declared gates listed and in reach); `settleAgainstRound` in `JudgeCheck.ts` is now the single settlement behind `crossCheckAgainstRound` and the certificate. | Fixture parity with existing `JudgeCheck` outcomes; `untested` is the honest outcome when a flow stops early at decode. | Inline `settleAgainstRound` back into `crossCheckAgainstRound` and drop the producer. |
| 2026-11-02 | ~~`judge-lint`/`judge-ingest` do not write a certificate file yet.~~ Superseded the same day by the next row after parent review. | The acceptance criterion needs one certificate per real run. | — |
| 2026-11-02 | Production emission: every `judge-lint` run that finds `inventory.json` writes `<round>/gate-certificate.json`, failures included: evaluated gates as `passed`/`failed`, gates after the first denial (or after an event-log read failure) as `untested`. `judge-ingest` writes it only when it writes `inventory.json` (all five gates passed); a refused ingest writes nothing, as before. The envelope subject is the SHA-256 of the exact `inventory.json` bytes (lint hashes the bytes it read; ingest hashes the bytes it writes). Printed lines, error messages and exit codes are unchanged. | Parent ruling (one certificate per actual run, persisted at the existing round artifact boundary, legacy results preserved). The inventory file is the only stable subject, so a refused ingest has nothing to bind. | Remove the `writeQaJudgeCertificate` calls in `JudgeLint.ts` and `JudgeIngest.ts`. |
| 2026-11-02 | Digest binding: `writeQaJudgeCertificate` returns `QaJudgeCertificate { receipt, subject }` where `subject` is the SHA-256 of the exact `gate-certificate.json` bytes written; `applyQaJudgeCertificatePlan(plan, bytes)` decodes and re-hashes the bytes before calling the kernel, so a changed receipt is refused as `stale-digest`. The kernel stays schemas-only and documents that its caller must recompute the subject. | Independent review R1: the kernel compared a caller-supplied subject that nothing tied to the receipt. Hashing stays in `@beep/repo-cli`, which already has `Sha256HexFromBytes` and a Digest service. | Drop the wrapper; callers go back to supplying the subject. |
| 2026-11-02 | Fix wave after the named panel (`192d4405`): `judge-ingest` prepares `inventory.json`, `inventory.md` and `gate-certificate.json` in memory, writes each with `writeFileWithinRootAtomically`, and on any write failure restores every target to its prior bytes (or removes it) so a failed run never leaves a new inventory beside an old or missing certificate. Rollback on failure only; not crash-atomic across files. | Panel P1/P2 (paired artifact boundary). No existing multi-file transaction helper; the single-file atomic helper is reused. | Return to sequential writes. |
| 2026-11-02 | `judge-lint` failure paths keep the run's own error and print a certificate-write failure to stderr; a clean run prints its verdict first and then fails hard if its certificate cannot be written; a missing inventory removes the stale generated `gate-certificate.json` (warning on stderr if it cannot). `applyQaJudgeCertificatePlan` compares the digest before decoding. | Panel P1/P2 and Fable A1/A2. | Revert the `JudgeLint.ts`/`JudgeIngest.ts` hunks. |
| 2026-11-02 | Kernel policy (Fable A3): in-reach checks evaluated as advisory `failed` count as evaluated, so an aggregate with no blocking failure and no inconclusive check settles `passed`, not `inapplicable`; `inapplicable` now means nothing in reach was evaluated. | Consistency with the gate-summary blocking policy and with "evaluated" meaning. | Restore rule 4 to `passed` checks only. |
| 2026-11-02 | Fable A4 (move writer/consumer into a `JudgeCertificate` role module) not taken. | `JudgeIngest.ts` already owns the round artifact file names (`INVENTORY_JSON_FILE`, `INVENTORY_MARKDOWN_FILE`) and their writes; the certificate is a third artifact of the same round commit, and `commitRoundArtifacts` must see all three. `beep architecture add role` scaffolds slice roles only. A later split can move `encodeQaJudgeCertificate`/`applyQaJudgeCertificatePlan` without API change because callers import the `commands/Qa` facade. | Move the functions; the facade keeps imports stable. |
| 2026-11-02 | Re-review of `33dbd070`: the ingest commit tracks which targets it actually wrote and rolls back only those (a first-write failure changes nothing and says so); every committed target is restored even if an earlier restore fails, with each failure reported by file; commit plus rollback is one uninterruptible section, so cooperative interruption ends with a complete old or new set. The lint certificate writer uses `writeFileWithinRootAtomically`, so a failed write never truncates an existing certificate. The stale-certificate prune runs only on a typed `NotFound` inventory read. | Panel P2s (Astra, Grok, Fable N2/N3/N5). Process-kill atomicity across files stays out of scope. | Revert the `commitRoundArtifacts`, `writeQaJudgeCertificate` and `JudgeLint.ts` hunks. |
| 2026-11-02 | Fable N4: round artifacts written through `writeFileWithinRootAtomically` get mode `0600` instead of the umask default (`0644`). Kept as is. | They are local working files read by the same user; git records only the executable bit, so copies carried into packets are unaffected; the helper's owner-only mode is its documented security posture. No reader depends on group/other read access. | `fs.chmod` each committed target back to `0o644`. |
| 2026-11-02 | Re-recorded `standards/cache-qualification-baseline.json` for subject `//` (`beep cache baseline --request`, review in `research/cache-baseline-review-2026-11-02.md`). | `beep lint policy-fingerprint --write` adds `GateCertificate.ts` to `//#lint:policy-fingerprint:quality` inputs, which `quality cache-policy` flags as configuration drift. Inputs only; no qualification granted. | Revert the baseline, `turbo.json` and fingerprint lines with the module. |
| 2026-11-02 | No changeset. | `@beep/skill-contract` is `private: true`; `.changeset/README.md` says private workspaces need no notes and the graph guard rejects notes naming them. The change is additive. | Add a changeset if the package becomes publishable. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
