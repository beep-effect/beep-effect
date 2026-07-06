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
