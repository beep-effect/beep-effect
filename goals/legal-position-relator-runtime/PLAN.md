# Legal Position Relator Runtime Plan

## Status

Status: `pending`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Re-verify the live surfaces in `research/SOURCES.md` §4, then make the binding rung-2 candidate-handoff pick from the four shapes enumerated in `SPEC.md` Constraints — emitted events (unavailable), a promoted `shared/use-cases` contract (unavailable without waiving its bar), foundation-mediated port inversion (available but with two admission problems), or extending the slice's documented bounded epistemic exception (adds no package edge but may trip that exception's own removal condition) — with an `architecture-guardian` check and a read of `goals/law-practice-office-action-spike/SPEC.md:258`. | Surfaces confirmed current; the handoff shape chosen (or explicitly deferred with recorded evidence, per the sibling precedent) and recorded in the `SPEC.md` decision log together with the exact consumer and binding files; if the pick needs a new package or widens the bounded exception, an Exception Ledger entry and owner sign-off exist before P2 starts. |
| P1 Rung 1: domain proof | pending | Schemas (`HohfeldPosition`, `LegalActContent`, both derivations, `Party`, `LegalRole`, `LegalPositionRelator`, `LegalScopeContext`) → the `LegalPositionRelatorPolicy` contract → failing-then-green `LegalPositionRelatorPolicy.test.ts` over in-memory layers. | All rung-1 acceptance criteria met; the test green after first failing; `packages/law-practice/domain` still declares no epistemic dependency. |
| P2 Rung 2: transitions, correction contract, durability | pending | `PowerExercise`/`ActFrame`, `CorrectionDelta`, `PriorityBasis`, durable append-only ports/repo/layer on the in-slice `CandorRecord` precedent, the slice's second db-admin migration + PGlite test + `AcceptedProofManifest`, the CQ acceptance fixtures, and the candidate handoff. | All rung-2 acceptance criteria met, or the handoff explicitly deferred with its evidence recorded in `SPEC.md`. |
| P3 Yeet: PR to mergeable | pending | Ship through `bun run beep yeet publish --pr` and drive checks/review to mergeable. | Completion gate satisfied (PR mergeable, checks green, review clean, zero unresolved threads). |
| P4 Close | pending | Closeout reflection, packet status/evidence updates, final readiness. | Packet status and evidence updated; a closeout reflection exists. |

Rung ordering is strict: P2 never starts before P1's test is green, and nothing
is sequenced between them. The budget circuit-breaker applies inside P1 — drop
`LegalScopeContext` and the scope-overlap check first, then degrade `Party`
linkage to an opaque reference id; never the `(kind, content)` derivation
soundness requirement or the one-stored-relation invariant.

## P4 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**
   (what worked, what didn't, what was frustrating, what you wished existed), the
   **implementation** (improvement opportunities), and the **goal/prompt** (would
   you revise it to be clearer/easier/more efficient?). Capture TODOs worth
   codifying. Its YAML frontmatter must validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Re-check `goals/epistemic-contradiction-triage`'s state at each phase start —
  it is landed-but-unverified (P2 Verify in progress, acceptance criteria
  unchecked), so its contract is composable but not finished.
- Gated criteria (verified triage contract, act-verb scheme, release-capable
  runtime vocabulary, versioned norm identity) are tracked in `SPEC.md`; check
  their owning goals' state at each phase start, but never block on them.

## Verification Commands

```sh
test "$(wc -m < goals/legal-position-relator-runtime/GOAL.md)" -le 4000
jq . goals/legal-position-relator-runtime/ops/manifest.json
rg -n "legal-position-relator-runtime|GOAL.md|agentLaunchers|packetAnchorDocument" goals/legal-position-relator-runtime
git diff --check -- goals/legal-position-relator-runtime
```
