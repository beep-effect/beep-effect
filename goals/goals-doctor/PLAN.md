# Goals Doctor & Index Plan

## Status

Status: `in-progress`

## Phases

Each phase carries an executable done-check (the oracle) authored here, at
shaping time — the executing agent must paste the oracle's actual output into
`history/` at phase close.

| Phase | Status | Goal | Exit criteria (oracle) |
| --- | --- | --- | --- |
| P0 Research | complete | Re-verify the audit inventory: full status-token census, the 5 manifest-less packets, 8 GOAL.md violations, README↔manifest disagreements. | `research/status-token-census.md` committed with the jq census script and its output; census total equals packet-dir count. |
| P1 Schema + set-status + migrate | complete | `GoalManifest` v2 schema (D1-D3), `beep goals set-status` incl. `--migrate`, manifests migrated, 5 missing manifests backfilled. | `bun run beep goals set-status --migrate --write` then every `goals/*/ops/manifest.json` decodes via `GoalManifest`; zero unknown tokens; unit tests for the mapping pass. |
| P2 Index | complete | `beep goals index --write/--check`; `goals/INDEX.md` committed; README snapshot replaced by pointer. | `bun run beep goals index --check` exits 0; scratch-edit a manifest → exits 1 (evidence recorded, edit reverted). |
| P3 Doctor + wiring | pending | `beep goals doctor` (alias `beep lint goal-packets`) with D5 findings, baseline ratchet, ReflectionArtifact integration (D7), yeet verify wiring. | `bun run beep goals doctor` exits 0 with committed baseline; fixture test proves a synthetic new finding exits 1; `bun run beep yeet verify` shows the new lanes green. |
| P4 Yeet: PR to mergeable | pending | Ship via yeet (repair → verify → publish → monitor). | PR open with all required checks green and `MERGEABLE`. |
| P5 Close | pending | Reflection, INDEX regenerated, packet closed via `beep goals set-status` (dogfood). | `bun run beep lint reflection-artifacts` exits 0; this packet's own status flipped with the new command. |

## P5 Closeout Checklist

1. Write a closeout reflection via `/reflect` to
   `history/reflections/<YYYY-MM-DD>-<agent>.md` (frontmatter must validate
   against `ReflectionFrontmatter`; quote the date; no `: ` inside plain
   scalars — use `>-` block scalars for long text).
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`).
3. Close the packet with `bun run beep goals set-status goals-doctor
   completed-retained` — the command this packet ships must be its own
   closeout writer.

## Execution Notes

- P5's closing commits (reflection, status flip, INDEX regen) re-drive the
  SAME PR opened at P4 — P4's oracle (all required checks green, MERGEABLE)
  must hold again after they land; do not open a second PR.
- Preserve unrelated worktree changes; the user edits this tree in parallel.
- Migration commits should be separated from implementation commits so the
  mechanical manifest rewrite is reviewable in isolation.
- If a legacy manifest resists mechanical mapping, park it with a recorded
  question rather than guessing (SPEC stop condition).
- Command implementations follow `commands/Lint/ReflectionArtifact.ts` idioms:
  `S.Class` schemas, findings-based reporting, `Effect.fn` helpers, typed
  errors, no `unknown` in error channels.

## Verification Commands

```sh
test "$(wc -m < goals/goals-doctor/GOAL.md)" -le 4000
jq . goals/goals-doctor/ops/manifest.json
bun run beep goals doctor
bun run beep goals index --check
bun run beep lint reflection-artifacts
git diff --check -- goals/goals-doctor
```
