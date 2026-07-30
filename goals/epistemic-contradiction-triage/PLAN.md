# Epistemic Contradiction Triage Plan

## Status

Status: `active` (P0-P1 complete; P2 verification in progress)

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Fixture spike | complete (2026-07-29) | Prove the matching, symmetry, suppression, visibility, and transition rules against the real core before any schema commitment. | PASS — all five spike-B assertions plus the folded boundary fixtures passed in PGlite; evidence is archived in `history/p0/2026-07-29-fixture-spike.md`. |
| P1 Implement | complete (2026-07-29) | Build the candidate domain, additive tables, use-case ports/commands, server repository, and coordinated full-source human-triage surface. | PASS — the schema/Effect/Atom implementation and browser QA are archived in `history/p1/2026-07-29-implementation-and-browser-qa.md`; candidate writes never touch the core's authority tables. |
| P2 Verify | in progress | Prove two-axis candidate queries, the approval race lane, restart recovery, and repo-quality compliance. | Focused suites and browser QA are green; formal quality-review closure and `bun run beep yeet verify` remain. |
| P3 Yeet: PR to mergeable | pending | Drive the work to mergeable through `bun run beep yeet publish --pr` and `monitor`. | Hosted required checks green; PR mergeable. |
| P4 Close | pending | Closeout reflection and same-PR packet-state flip. | Reflection passes `bun run beep lint reflection-artifacts`; manifest/README state flipped in the same PR as the final work. |

## P0 — Fixture Spike (hard gate)

No implementation phase runs before this gate is green. The gate comes from
**Deferred spike B** in
[`explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md`](../../explorations/agent-memory-tiers-bitemporal-edges/DECISIONS.md);
its five assertions are normative in [`SPEC.md`](./SPEC.md).

1. **Identity/anchor matching** — when two candidates address the same logical
   lineage versus distinct ones, using the core's `LogicalEdgeIdentity`.
2. **Symmetric-edge representation** — both orderings of a `CONTRADICTS` pair
   collapse to one candidate through the core's symmetric-endpoint ordering; no
   second symmetric-encoding scheme is introduced.
3. **Duplicate suppression** — resubmitting the same candidate basis is a no-op
   with visible provenance; suppression is identity-based, never
   string-similarity-based.
4. **Unresolved-conflict visibility** — open candidates are queryable at
   `asOf(validAt, knownAt)` without touching authority reads.
5. **Candidate-to-approved transition** — approval resolves as one atomic
   `SUPERSEDES` through the core's conflict-safe close-and-insert path;
   rejection records a durable disposition; the losing lineage stays
   historically queryable.

Folded boundary fixtures from the unconsumed 2026-07-25 dispatch note
([`goals/epistemic-bitemporal-edge-core/research/2026-07-25-academia-corpus-mining-note.md`](../epistemic-bitemporal-edge-core/research/2026-07-25-academia-corpus-mining-note.md)),
each carried only where it bears on triage:

- **Competing lineages** — two incompatible assertions with distinct evidence
  scopes coexist; superseding one closes only that logical lineage.
- **Revision ordering** — deterministic replay across batch permutations, with
  explicit duplicate and late-arrival behavior.
- **Restart boundary** — every preceding fixture re-queries identically after
  restart plus the generated migration.

The interpretation/adoption, qualifier-complete-assessment,
correction/invalidation, and policy/model-trust fixtures are recorded as
evidence inputs only; they graduate with the packets that own those records.

**Hard gate:** if any assertion fails, stop and reshape the candidate model.
Do not begin P1 on an unproven gate.

## P1 — Implement

- Add schema-first candidate value objects and entities to
  `@beep/epistemic-domain`: candidate identity, match basis, confidence,
  evidence references, and typed candidate/approval errors.
- Add additive candidate table(s), indexes, and constraints to
  `@beep/epistemic-tables` plus the generated migration; the core's tables and
  constraints are not altered.
- Add `@beep/epistemic-use-cases` ports and commands: candidate submission,
  duplicate-suppressed upsert, open-candidate query, and the approval command
  composing the core's existing supersession path. Add the slice-local
  `ContradictionDispositionStatus` (`rejected | superseded`) and leave
  `ClaimDispositionStatus` unchanged.
- Implement the `@beep/epistemic-server` repository and layer wiring so approval
  writes the disposition and the supersession in one transaction.
- Register the migration target through the existing `@beep/db-admin`
  composition; follow that package's `AGENTS.md` consumer-sweep checklist if any
  new extension is ever needed (none is expected).

## P2 — Verify

- Two-axis queries over open and resolved candidates at paired `validAt` /
  `knownAt` values, without perturbing authority reads.
- Approval-to-atomic-supersession race lane: concurrent approvals of competing
  candidates over one logical lineage produce exactly one authoritative
  supersession and typed conflicts for the losers. Use the opt-in
  real-Postgres/concurrency pattern in
  `standards/architecture/08-testing.md`; SQL integration suites stay
  sequential.
- Restart/migration proof: repeat the P0 queries identically across the process
  boundary and the generated migration.
- Run the focused epistemic domain/use-cases/server/db-admin lanes, then
  `bun run beep yeet verify`; archive exact evidence under `history/`.

## P3 — Yeet: PR to mergeable

Use Yeet to repair, verify, publish a PR, and monitor checks and review until
mergeable. This is the completion gate; a green local proof is not achievement.

## P4 — Close

1. Write `history/reflections/<YYYY-MM-DD>-<agent>.md` via `/reflect`, starting
   from `history/reflections/_TEMPLATE.md`.
2. Run `bun run beep lint reflection-artifacts`.
3. Flip `README.md` status/evidence and `ops/manifest.json` phase states +
   `initiative.status` **in the same PR as the final work**.
4. Update the source exploration's map row and links if this packet closes the
   order-2 lane.

## Execution Notes

- Preserve unrelated worktree changes and keep this packet's scope strict.
- `SPEC.md` is normative; update this plan as P0 evidence resolves the
  candidate-model choices.
- Archive proof and closeout artifacts under `history/`.
- Detection heuristics or NLP inference are a stop condition, not a stretch
  goal — re-scope rather than absorb them.

## Verification Commands

```sh
test "$(wc -m < goals/epistemic-contradiction-triage/GOAL.md)" -le 4000
jq . goals/epistemic-contradiction-triage/ops/manifest.json
rg -n "epistemic-contradiction-triage|GOAL.md|agentLaunchers|packetAnchorDocument" goals/epistemic-contradiction-triage
git diff --check -- goals/epistemic-contradiction-triage
bun run beep yeet verify
bun run beep lint reflection-artifacts
```
