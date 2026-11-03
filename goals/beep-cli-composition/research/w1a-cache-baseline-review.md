# Cache baseline review: W1a hygiene (2026-11-02)

Reviewer: Claude Opus 5.5 (W1a lane, `refactor/beep-cli-w1a-hygiene`).

W1a moves files inside `@beep/repo-cli` (SPEC D25, D26; `w1-edge-census.md`).
No task is added or removed, no cache flag, output or `passThroughEnv`
changes, no script word or package manifest changes, and no qualification is
granted. Only the root subject moves.

## `//` (root)

`bun run beep lint policy-fingerprint --write` regenerated the per-prefix seal
inputs in `turbo.json` and the closure in `standards/policy-tools.fingerprint.json`.
The eleven drifted seal tasks change only because their import closures now
name the moved paths:

| Seal task | Input change |
| --- | --- |
| `//#lint:policy-fingerprint:quality` | `internal/repo-run/{TmpfsReap,ResidueReap,ResidueTerminalLane}*.ts` and `Quality/internal/ResidueTerminalLaneLive.ts` become `Worktree/internal/*`; adds `Worktree/Janitor.command.ts`, `Cache/CachePolicy.command.ts` and `internal/cli/EntryPath.ts` |
| `//#lint:policy-fingerprint:quality-bun-audit`, `-changeset-graph`, `-jsdoc-inventory`, `-jsdoc-module-tags`, `-jsdoc-ratchet`, `-tsgo-rules` | the same quality-command closure change, inherited through the `quality` prefix |
| `//#lint:policy-fingerprint:goals-doctor`, `:holds`, `:knowledge`, `:lint-deprecated-apis` | their closures reach `Quality/Tasks.ts`, which now imports `internal/cli/EntryPath.ts`, or the moved janitor files through `Yeet/internal/Sweep.ts` |

`turbo.json` is the only configuration source that changed (the REVIEW row).
