# Map

## Candidate goals

| Slug | Mission | Depends on | When |
| --- | --- | --- | --- |
| `history-message-overlay` | Publish the reviewed July commit-message map as `refs/notes/history`, projected from `docs/history/commit-message-map.json` by `beep history notes`, delivered to every clone by bootstrap, written to origin only by a post-merge job; retire the out-of-repo cutover folder. | none (coordinates with `goals/legacy-drain` for the folder line) | now |

One goal fits the appetite (BRIEF.md: one goal, about two to three agent days).
A history rewrite is not a gated candidate: it was decided against
(DECISIONS 2026-11-06), and reopening it goes back through align.

## Sequencing

1. **Slice 1 (first vertical slice): map import and check.** Track
   `docs/history/commit-message-map.json` plus the exclusion list and README;
   add the map schema; add the `@beep/git` notes reads; ship
   `beep history notes --check` (read-only: decode the map, confirm every key
   is an ancestor of `origin/main`, diff against a local `refs/notes/history`
   if one exists). Proves the data and the schema before anything writes a ref.
2. **Slice 2: write and sync.** `--write` builds the ref deterministically
   (one note per key, stable ordering, so a rebuild with the same map gives the
   same notes tree). `sync` sets `+refs/notes/history:refs/notes/history` and
   `notes.displayRef` on the clone. `beep worktree new` and
   `scripts/cloud/bootstrap.sh` call sync.
3. **Slice 3: publication.** Post-merge workflow on `main`, path-filtered to
   `docs/history/**`, runs `--write` and pushes the ref; `--check` against the
   remote ref proves the result.
4. **Slice 4: folder retirement and docs.** Archive the remaining cutover
   folder to `~/.local/state/beep/archive/beep-effect-cutover/`, remove the
   folder, record it for `goals/legacy-drain`; document the overlay and the
   blobless-clone recipe.

Rationale: read-only proof first, then a local write path that can be checked,
then the one origin write path, then cleanup that depends on the map being
tracked.

## Capability check

| Component | Capability | Status |
| --- | --- | --- |
| Map file and schema | `effect/Schema` + `@beep/schema`; SHA schemas `KnowledgeCommitSha` (`packages/tooling/tool/cli/src/commands/Knowledge/Knowledge.refs.ts:510`), `GitCommitSha` (`commands/Codex/Findings.capture.schemas.ts:327`) | reuse (promote or reuse one SHA schema; don't add a third) |
| Notes read/write | `@beep/git` driver `packages/drivers/git/src/Git.ts` (no notes ops today) | extend |
| Ancestry check | existing `is-ancestor` call sites, e.g. `commands/Yeet/internal/Sweep.ts` | reuse via `@beep/git` |
| `beep history notes` | `@beep/repo-cli` command families under `packages/tooling/tool/cli/src/commands/` | NET-NEW command family on the existing CLI |
| Worktree bootstrap hook | `commands/Worktree/Worktree.command.ts` (`worktree new`) | extend |
| Cloud bootstrap | `scripts/cloud/bootstrap.sh` | extend |
| Post-merge publication | `.github/workflows/` (existing push/cron workflows such as `knowledge-baseline-mint.yml`) | NET-NEW workflow |
| Folder archive | `~/.local/state/beep` archive convention (`explorations/agent-fleet-layout/DECISIONS.md:160-162`, `goals/legacy-drain/SPEC.md:5`) | reuse convention |

## Inherited risks

- The notes ref is unprotected by rulesets (only `main` branch ruleset
  10240248). Mitigation: only the workflow writes it; `--check` detects drift.
  A `refs/notes/*` ruleset is an optional later hardening.
- A clone that fetched before the sync step doesn't see notes. Mitigation:
  `sync` is idempotent and run by every bootstrap path.
- Map rows judged wrong later are fixed by PR to the map; the workflow
  republishes.
