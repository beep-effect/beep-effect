# Semantica Reasoning Spike Plan

## Status

Status: `pending`

Not started. P1 (the fixture's schema and its R-a, R-b, R-d, R-e classes) can
begin now; R-c and P2–P4 wait for the storage spike's P-S1 (R1.g); P3 waits
for the v3 archive to be located (R2.g).

## Phases

Each phase ships as one or more PRs driven to mergeable via `/yeet`; the
completion gate binds per phase, not only at close. Phase ids match
`ops/manifest.json` `phases[]`. P1–P4 are one stage of one S1 candidate
(R2.f): a failed probe buys exactly one redesigned candidate for that probe
(R0.a); a second failure parks the family.

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P1 Rules fixture | pending | `g-entailment-rules/v1` family, then twenty cases in five classes under the pinned EYE; no engine. | Fixture committed with per-case proof digests; generator idempotent; negation gap typed; R-c generated only after P-S1. |
| P2 P-R1 proof-ledger kernel | pending | `CanonicalProofNodeV1` + deterministic encoder + hash. | Stable across premise-order permutations and cold replays on every case; C2 digests unchanged. |
| P3 P-R2 budget-certified rules | pending | `RuleCertificate` + pure `compileRuleCertificate`; `rete` behavioural tests ported as the match oracle. | R-d cases emit the proof-linked `InferenceTruncated` fact; unbudgeted equals EYE; 46 ported tests green. |
| P4 P-R3 evidence-graph workspace | pending | `EvidenceBatch` → kernel → `InferenceEvent` on R-c/R-e with retraction; ablation rete-port vs naive vs EYE. | Identity and invalidation stable across re-extraction and replay; ablation verdict recorded. |
| P5 Close | pending | Verdict (or park) to the exploration's `DECISIONS.md`; reflection; state flip in the same PR. | Dated entry + Current law "Reasoning" row and O4 gate status amended; reflection validates; packet `completed-retained`. |

## P1 Rules fixture

Schema first, then the generator, then cases:

1. `src/schema/Reasoning.ts`: the `g-entailment-rules/v1` tagged family
   (case, expectation, witness) beside the pinned rdfs/v1 classes; a branded
   rule id replacing the seven-member `RdfsRuleId` where rules are user
   vocabulary; `InferenceEngine` as a domain; `InferenceTruncated`; the
   statement-level conflict witness (distinct from the claim-level
   `ConflictWitness` in `src/schema/Evidence.ts`).
2. `scripts/generate-g-entailment.ts` extended: same `EyeOracleChild`, same
   pins (EYE 11.24.5 via `eyereasoner` 21.1.18, `--restricted`), per-case
   `eyeProofDigest`, twice-run byte identity.
3. Cases, four per class, with EYE gold and lab-owned expectation separated
   as MAP §R's class table states: R-a join, R-b recursion (depth 3–6),
   R-d budget (chain 50, product 10×10, declared depth or fan-out budget),
   R-e contradiction — now; R-c retraction (asserted minus one `Invalidated`
   premise, two EYE closures) — after P-S1 lands.
4. Record the negation gap in the fixture as a typed entry (R2.d).
5. Publish; `merge-ready: yes`; record pins and digests under
   `history/p1-*.md`.

## P2 P-R1 proof-ledger kernel

1. Schema: `CanonicalProofNodeV1`; the deterministic encoder and hash over
   the existing `ProofDag` / `InferenceEvent` ids (already content-addressed
   from C2).
2. Tests: premise-order permutations and cold replays on every fixture case;
   the C2 report digests must not move.
3. Kill: canonicalization drift. Publish; record under `history/p2-*.md`.

## P3 P-R2 budget-certified rules

Entry condition: the archived `beep-effect-logos` root is located and its
LICENSE re-verified as Apache-2.0; record the path and digest under
`history/` and flip the exploration's `research/SOURCES.md` row from
reference-only (R2.g).

1. Port the 46 `rete` behavioural tests first as the oracle for match
   semantics (Apache-2.0 attribution/NOTICE for copied tests).
2. Schema: `RuleCertificate`; pure `compileRuleCertificate` over rules as
   data (`RdfsRule` shape, widened).
3. R-d: unbudgeted run equals EYE; budgeted run emits `InferenceTruncated`
   at the declared boundary with the last complete proof node and a
   deterministic budget-prefix witness.
4. Kill: certificate unsoundness. Publish; record under `history/p3-*.md`.

## P4 P-R3 evidence-graph workspace

1. `EvidenceBatch` → kernel → `InferenceEvent` end to end through
   `LedgerLive.appendBatch` on R-c and R-e with retraction under the ledger's
   `Invalidated` law.
2. Ablation on the rules fixture: rete-port vs naive fixpoint vs EYE; record
   closure equality, per-event validation, and Tier-L numbers per engine in
   the sidecar.
3. Kill: unstable identity or invalidation across re-extraction and replay.
   Publish; record under `history/p4-*.md`.

## P5 Closeout Checklist

1. Write the reasoning-spike verdict (or park) as a dated entry in the
   exploration's `DECISIONS.md`; amend the Current law "Reasoning" row and
   the O4 `reasoning-package` gate status in the same PR.
2. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; its frontmatter must
   validate against `ReflectionFrontmatter`.
3. Run `bun run beep lint reflection-artifacts`.
4. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status` (`bun run beep goals set-status`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive probe outputs under `history/`.
- T2 stands: never wait on overlapping upstream PRs.

## Verification Commands

```sh
test "$(wc -m < goals/semantica-reasoning-spike/GOAL.md)" -le 4000
jq . goals/semantica-reasoning-spike/ops/manifest.json
rg -n "semantica-reasoning-spike|GOAL.md|agentLaunchers|packetAnchorDocument" goals/semantica-reasoning-spike
git diff --check -- goals/semantica-reasoning-spike explorations/semantica-lab
bun run beep goals index --check
bun run beep goals doctor
bun run beep lint reflection-artifacts
bun run beep yeet verify
```
