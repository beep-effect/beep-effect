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
- [ ] The QA judge settlement produces one certificate per run whose per-check
      outcomes match the existing judge checks (behavioural parity test against the
      current `JudgeCheck` results on the same fixtures).
- [ ] An aggregate containing any in-reach `cantTell` or `untested` check is never
      `passed` (property test).
- [ ] Apply-by-id refuses a stale digest and an unknown id (tests).
- [ ] No unrelated refactors or formatting churn.

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
| None | N/A | N/A | N/A |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
