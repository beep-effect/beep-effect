# Cache baseline review: W2 leaf libraries (2026-11-03)

Reviewer: Claude Opus 5.5 (W2 lane, `refactor/beep-cli-w2-leaf`).

W2 moves four leaf schema modules out of `@beep/repo-cli`: the skills and
skills-lock schemas and the model catalog go to `@beep/ai-sync`, and the QA
inventory goes to `@beep/qa-capture`. Both libraries were already repo-cli
dependencies, so no package manifest or task-graph edge changes. No task,
cache flag, output or `passThroughEnv` changes, and no qualification is
granted. Only the root subject moves.

## `//` (root)

`bun run beep lint policy-fingerprint --write` regenerated the seal inputs in
`turbo.json` and `standards/policy-tools.fingerprint.json`. Three seals drift
only because their import closures now name the moved files at their library
paths:

| Seal task | Input change |
| --- | --- |
| `//#lint:policy-fingerprint:knowledge` | the skills and skills-lock schemas resolve to `packages/tooling/library/ai-sync/src/` |
| `//#lint:policy-fingerprint:laws` | the skills-lock schemas (read by the markdown-fence law) resolve to `@beep/ai-sync` |
| `//#lint:policy-fingerprint:lint-judge-rubric` | the QA inventory schemas resolve to `packages/tooling/library/qa-capture/src/QaInventory.schemas.ts` |

`turbo.json` is the only configuration source that changed.
