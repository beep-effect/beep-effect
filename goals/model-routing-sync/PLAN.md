# Model Routing Sync Plan

## Status

P1 Implement, slice 1 landed (2026-09-22) in worktree `model-routing-sync`, branch
`feat/model-routing-sync`. The packet was materialized from the compiled bootstrap plan. Slice 1 is
deliberately read-only (R12); its smoke run is recorded in [`README.md`](./README.md).

2026-09-24 acceptance follow-up: P2 local evidence now covers lossless external
decoding, every conflict category, read-only hashes, missing JSDoc targets, and
the JudgePack template. See `history/2026-09-24-slice-1-acceptance.md`. Full package
proof and schema-first pass; P3 full Yeet proof and hosted closeout remain delivery
gates; S2 and S3 remain outside this goal.

2026-09-25 coverage follow-up: the operator approved three package-local Vitest
isolation exceptions (wink, utils, identity). PR #1224 reached hosted merge
readiness and was merged by the operator before implementation of these
exceptions. Deliver the exceptions and final packet closeout in a follow-up PR,
left open and mergeable. The agreed scope is recorded in `DECISIONS.md`.

2026-09-25 final packet closeout: the operator also merged #1240 after its
head-local proof and hosted readiness passed, while merged-preview verification
continued. The approved documentation-only follow-up carries final acceptance,
reflection, and lifecycle updates. Leave that PR open and verify its final head
through Yeet before reporting the goal complete.

## Phases

- **P0 Research — complete.** Three Opus 5 exploration lanes (CLIProxyAPI catalog, `repo-cli` sync
  surface, repo/user surface census) plus the `$HOME` sweep, then a grill on 2026-09-22 that locked
  12 rulings. Corpus: `research/2026-09-22-0{0,1,2,3,4}-*.md`.
- **P1 Implement** — three slices, in order:
  1. **S1 schemas + catalog + `check`.** `ModelCatalog` / `ModelBinding` / `ModelSyncTarget`
     schemas; fetch the upstream manifest (fallback to the raw GitHub URL); read
     `$HOME/.codex/models_cache.json`; run `cursor-agent models`; read proxy `GET /v1/models` as an
     availability overlay only (R1); decode; diff against the ledger; print drift per declared
     target. No projection writes (R12). Command group `commands/Models/` in `@beep/repo-cli` (R5).
  2. **S2 write path.** `--write` with `$HOME/.config-backups/` backups, idempotent line-anchored
     rewrites, the dirty-checkout refusal for repo targets, and the one-time prose rewrite that
     adopts `<!-- beep-models:begin -->` blocks with a `superseded:` list (R4, R7).
     **Gate: the operator must ratify ONE Codex effort value** before any doctrine file is written;
     the live tree currently carries three (`medium` / `high` / `xhigh`).
     Two seed gaps the slice-1 smoke run exposed also close here:
     - **Context-window suffix.** `$HOME/.claude/settings.json` holds `claude-fable-5-1[1m]` while
       the manifest binding names the bare `claude-fable-5-1`, so the `orchestrator x claude-code`
       row reports `stale` on a value that is arguably correct. Either the binding grows a
       context-window axis or the `json-key` locator grows a suffix-tolerant render.
     - **`Qa/JudgePack.ts` locator — resolved in the acceptance follow-up.** The R9 target is a `--model gpt-6-astra
       --effort medium` fragment inside a template literal, not an `export const <symbol> = "…"`,
       so the `ts-literal` grammar cannot address it. The read-only `line-value`
       locator now covers both its model and effort without rewriting the template.
  3. **S3 lint + timer + shim.** Register `beep lint model-ids` with the R11 exclusions; render the
     daily `systemd --user` timer via `beep models install-timer` with the critical-notification
     drift path (R8); land the `$HOME/.local/bin/beep-models` shim (R5).
- **P2 Verify** — `bun run beep quality package-verify @beep/repo-cli --quick`, a `check` run whose
  report names all seven known live conflicts, and an idempotence proof once S2 exists (two `write`
  runs, second reports `changed: 0`).
- **P3 Yeet** — `bun run beep yeet publish --start-pr-early --monitor --pr`; goal slug in the commit
  message.
- **P4 Close** — reflection via `/reflect model-routing-sync`; flip status in the same PR.

## P4 Closeout Checklist

- [x] Reflection at `history/reflections/<date>-<agent>.md`; `bun run beep lint reflection-artifacts`.
- [x] `bun run beep goals set-status model-routing-sync completed-retained` in the final packet PR; final-head delivery proof remains the handoff gate.
- [x] Friction receipts recorded in the active packet's opportunities ledger as they happen, not at
      closeout.
- [x] `bun run beep goals index --write`; Atlas regenerated if `explore atlas --check` says stale.

## Execution Notes

- Never edit the user's global files unprompted. S1 writes no projection target — only the R6
  ledger, the optional `--report-dir` output, and the `init` seed manifest; S2 adds the
  `--write` path, and only after the operator ratifies the Codex effort value.
- Prose naming a not-yet-existing command uses the bare form `beep models check`, never
  `bun run beep models check`, until the command is registered — the semantic-delta gate treats the
  latter as an introduced broken reference.
- The six seeded JSDoc example files are cosmetic; the docgen ratchet is the real risk on that target, so they
  move last inside S2.

## Verification Commands

```sh
bun run beep quality package-verify @beep/repo-cli --quick
jq . goals/model-routing-sync/ops/manifest.json
git diff --check -- goals/model-routing-sync
test "$(wc -m < goals/model-routing-sync/GOAL.md)" -le 4000
bun run beep lint reflection-artifacts
```
