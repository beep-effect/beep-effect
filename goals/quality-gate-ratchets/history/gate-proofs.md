# Gate Proofs — quality-gate-ratchets P1

Every gate proven two-way (synthetic regression FAILS; revert PASSES).
Full transcripts live in each lane summary under
[`lane-summaries/`](./lane-summaries/); this index records the proof shape
and the orchestrator's independent re-verifications.

| Gate | Fail proof | Pass proof | Independent re-check (orchestrator) |
| --- | --- | --- | --- |
| A1 coverage (`bun run coverage`) | baseline `@beep/types.lines` 0→1 → `coverage dropped below baseline ... lines: 0 < 1`, exit 1 | revert → `[coverage-ratchet] ok: compared 1 package(s) with epsilon 0.001` | re-ran pass case + 54/54 quality-tasks tests bun-backed ✔ |
| A2 knip (`bun run beep quality knip`) | synthetic dead export in apps/oip-web → `regression: 1 finding(s) not present in baseline`, exit 1 | remove → `ok: current=73 baseline=73 introduced=0`; shrink advisory proven with stale-entry baseline | determinism double-run diff clean per transcript; code reviewed line-by-line ✔ |
| A3 boundaries (`bun run beep fallow boundaries --check`) | synthetic `import "@beep/drizzle"` in architecture-lab domain → `doctrine:domain-deny-drivers-tables-server` violation with file:line, exit 1 | revert → `doctrine-pinned layer-legality checks passed`; regeneration round-trip diff empty (doctrine rows survive `--write`) | re-ran check on goal branch ✔; 73/73 yeet tests ✔; ajv schema validation per transcript |
| A4 jsdoc (`bun run beep quality jsdoc-ratchet`) | fixture inventory with increased totals → ratchet fail (transcript: quality-command-fail fixture) | clean fixture → pass; `--write-baseline` regenerates tracked totals | landed + verified by parallel operator session; wiring re-checked (quality:jsdoc-ratchet lane present) ✔ |
| A6 commitlint (CI `Commitlint` job) | scratch commit "saving" → `subject may not be empty / type may not be empty`, exit 1 | conventional message → exit 0; merge-commit ignores probed | range logic reviewed; PR-range run on lane branch exit 0 ✔ |

Known operational note (A6): merge-commit headers >100 chars fail the gate —
PR titles must stay ≤ ~93 chars (GitHub appends ` (#NNN)`), demonstrated by
pre-existing commit `2a0fca454c` (101 chars) failing `--last` probes.

## Live catch: A2 fired on the integration itself (2026-07-06)

Beyond the synthetic proofs, the knip gate caught a REAL regression during
lane integration — merging A1+A3+A4 introduced 5 genuine findings
(unnecessary `vitestCoverageRatchet` export, three undeclared shim deps,
dead `@effect/platform-bun` devDependency). The gate failed the integrated
branch; all five were fixed for real in `4fcaaadd65` (no baseline bump) and
the gate returned to `ok: current=73 baseline=73 introduced=0`. The same
commit documents the coverage-lane runtime design in `vitest.setup.ts`
(istanbul under `--bun` measures 0% — verified 0/555 on modeling/utils —
so `coverage` scripts run node vitest/v8 behind a guarded Bun-API shim while
`test` scripts stay bun-native).

## rqt-015 candidate: local pre-push composite races itself (2026-07-06)

Three consecutive local verify failures were intra-composite concurrency
artifacts, not code defects (every gate passes standalone on the same tree):
(a) repo-cli's yeet tests perform real `git stash` ops while
`lint:schema-first` scans the same tree → inventory mismatch, exit 1;
(b) docgen extracts @example blocks to temporary files while the
`lint:deprecated-apis` eslint glob collects them → ENOENT crash (exit 2)
when docgen deletes them mid-scan; (c) full docgen segfaults (exit 139)
under multi-session memory pressure. The verdict layer misattributed all
three to dual-arity. Hosted CI is immune (isolated checkouts per lane).
Follow-up: isolate mutating steps (tests, docgen) from tree-scanning steps
(schema-first, deprecated-apis) in the grouped-concurrency plan — the
greptile P2 on Tasks.ts concurrency called this. Shipping via the
documented fast-plus-monitor path with hosted checks as proof.

## A5 ruleset — live, refusal proven (2026-07-06)

Ruleset 10240248 activated post-merge: `~DEFAULT_BRANCH`, pull_request rule,
17 required status checks (verify matrix + all four new gates + security
lanes), deletion/non-FF kept, `bypass_actors: []`
(`current_user_can_bypass: "never"`; emergency hatch = disable the ruleset
via `gh api`, auditable). Direct-push probe:

```text
! [remote rejected] main -> main (push declined due to repository rule violations)
remote: - 17 of 17 required status checks are expected.
```
