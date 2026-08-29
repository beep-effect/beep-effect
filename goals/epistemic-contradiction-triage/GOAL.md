# GOAL: Ship epistemic contradiction triage

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: deliver evidence-backed, reviewable `CONTRADICTS` candidates over the
bitemporal edge authority core, plus a human-approval path that resolves a
candidate as one atomic `SUPERSEDES` — with detection never mutating authority.

This is a compact `/goal` launcher. Read these first:

- `goals/epistemic-contradiction-triage/README.md`
- `goals/epistemic-contradiction-triage/SPEC.md`
- `goals/epistemic-contradiction-triage/PLAN.md`
- `goals/epistemic-contradiction-triage/ops/manifest.json`
- `goals/epistemic-contradiction-triage/research/SOURCES.md`

Then read `AGENTS.md`, `CLAUDE.md`, the exploration back-links named by
`SPEC.md`, and governing architecture/package standards. Use the required
Effect-first, schema-first, service, and symbol-discovery skills. Higher
priority repo standards outrank packet prose when they conflict.

Scope:

- In: `@beep/epistemic-domain` candidate values/entities; `@beep/epistemic-tables`
  additive candidate tables plus migration; `@beep/epistemic-use-cases` ports,
  commands, and the slice-local `ContradictionDispositionStatus`;
  `@beep/epistemic-server` repository and layer; `@beep/db-admin` migration
  registration; focused PGlite/Postgres fixture, race, and restart tests.
- Out: automatic supersession; preferred-view selection or belief repair
  (`explorations/epistemic-belief-view-revision`); retention, tier, or decay
  policy; NLP/semantic-graph detection engines; shared `ClaimLifecycle`
  widening; IP-law vocabulary; any alteration of the core's tables.

Workflow:

1. Inspect referenced files, live exports, current state, and unrelated work.
2. Run P0 first — the fixture spike is a **hard gate**. Prove all five spike-B
   assertions plus the folded boundary fixtures (competing lineages, revision
   ordering, restart boundary) against the real core, PGlite lane at minimum.
   Archive pass/fail per assertion under `history/p0/`.
3. If any gate assertion fails, stop and reshape the candidate model before P1.
   No implementation runs on an unproven gate.
4. Implement the smallest schema-first, Effect-first vertical slice. Candidate
   storage stays bitemporal, immutable, and additive; approval composes the
   core's existing supersession path in one transaction.
5. Prove two-axis queries over open and resolved candidates, the
   approval-to-supersession race lane (opt-in pattern per
   `standards/architecture/08-testing.md`), and restart/migration recovery.
6. Keep `PLAN.md`, manifest phase state, and evidence current.
7. At P4 Close, use `/reflect`, pass reflection lint, and land the packet-state
   flip in the same PR as the final work.

Acceptance:

- [ ] Every criterion and stop condition in `SPEC.md` is honored.
- [ ] Required verification is green or unrelated failures are reproduced and recorded.
- [ ] No unrelated refactors, formatting churn, or forbidden scope expansion.

Packet verification:

```sh
test "$(wc -m < goals/epistemic-contradiction-triage/GOAL.md)" -le 4000
jq . goals/epistemic-contradiction-triage/ops/manifest.json
git diff --check -- goals/epistemic-contradiction-triage
```

Completion gate: not achieved until this work ships as a PR driven to mergeable
via Yeet (`bun run beep yeet`: repair -> verify -> publish --pr -> monitor),
with the closeout reflection and the same-PR state flip. Otherwise report the
blocker with file/command evidence.
