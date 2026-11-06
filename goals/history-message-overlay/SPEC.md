# History Message Overlay Spec

## Objective

Give the ~940 low-signal pre-July-2026 commits on `main` (`saving`, `updated
deps`, `merged in main`, ...) readable messages without changing a single SHA.
The reviewed July correction map becomes tracked data at
`docs/history/commit-message-map.json`; `beep history notes` projects it into
the git notes ref `refs/notes/history`; every clone fetches and displays that
ref; a post-merge workflow is the only writer of origin's ref. The out-of-repo
July cutover folder is retired.

Shaped in [`explorations/git-history-rewrite/BRIEF.md`](../../explorations/git-history-rewrite/BRIEF.md);
decisions in [`explorations/git-history-rewrite/DECISIONS.md`](../../explorations/git-history-rewrite/DECISIONS.md);
evidence in [`explorations/git-history-rewrite/RESEARCH.md`](../../explorations/git-history-rewrite/RESEARCH.md).

## Non-Goals

- No `git filter-repo`, no history rewrite, no force-push of any branch or tag
  (the rewrite was decided against; reopening goes through the exploration's
  align stage).
- No change to existing commit messages, signatures or SHAs.
- No direct workstation push of the notes ref; only the post-merge job writes
  origin's `refs/notes/history`.
- No fleet inventory, local paths or local-only branch names in the public repo.
- No attempt to make github.com display notes (unsupported since 2014).
- No regeneration or re-review of the 939 map rows; single rows are fixed by PR.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `docs/history/` — `commit-message-map.json`, its exclusion list, `README.md`.
- `packages/drivers/git` (`@beep/git`) — notes read/write operations.
- `packages/tooling/tool/cli` (`@beep/repo-cli`) — new `History` command family
  (`beep history notes --check | --write | sync`), and the `worktree new` sync hook.
- `scripts/cloud/bootstrap.sh` — sync step.
- `.github/workflows/` — one post-merge publication workflow.
- The git or worktree standards doc — overlay and blobless-clone section.
- Out of repo: `~/YeeBois/projects/beep-effect-cutover` → `~/.local/state/beep/archive/beep-effect-cutover/`.

## Constraints

- The map is schema-decoded at the boundary (commit SHA key → conventional
  subject plus optional body); reuse an existing commit SHA schema
  (`KnowledgeCommitSha` or `GitCommitSha`), don't add a third.
- Every map key must be an ancestor of `origin/main`; `--check` fails otherwise.
- `--write` is deterministic: the same map always produces the same notes tree.
- `sync` is idempotent and sets `+refs/notes/history:refs/notes/history` on
  `remote.origin.fetch` and `refs/notes/history` on `notes.displayRef`.
  Linked worktrees share their clone's config, so one run per clone suffices.
- Notes operations go through `@beep/git`, not ad-hoc shell-outs in the command.
- Rabbit holes, kept out: rewriting history "just for the subtree";
  re-reviewing rows; GitHub notes display; SHA-citation rewriting; GitHub
  server-side size reduction.

## Acceptance Criteria

- [ ] `docs/history/commit-message-map.json` is tracked and decodes; it covers
      every `saving` commit on `main` (the July map missed one).
- [ ] `bun run beep history notes --check` passes on `main` and against origin's ref.
- [ ] `git log` in a freshly bootstrapped worktree shows `Notes (history):` on a
      mapped commit with no manual config.
- [ ] The post-merge workflow published `refs/notes/history` to origin.
- [ ] `~/YeeBois/projects/beep-effect-cutover` is archived under
      `~/.local/state/beep/archive/beep-effect-cutover/` and removed;
      `goals/legacy-drain` is told its archive line is done.
- [ ] Docs explain the overlay and the `--filter=blob:none` clone recipe.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/history-message-overlay/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/history-message-overlay/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/history-message-overlay` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add history-message-overlay --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug history-message-overlay`; add a `kind: decision` file there, never edit this block._

### Track the map, archive the rest of the cutover folder, 2026-11-06

Map and validators move into docs/history/; scripts, curation, decision sheet, fleet inventory and research reports go to ~/.local/state/beep/archive/beep-effect-cutover/ and the folder is removed, closing goals/legacy-drain's archive line. The inventory names local paths and stays out of the public repo. Source: explorations/git-history-rewrite/DECISIONS.md (2026-11-06).

Lane `docs/git-history-rewrite-exploration`

Reverse: Restore the folder from ~/.local/state/beep/archive/beep-effect-cutover/

### Map at docs/history/, command as new beep history family, 2026-11-06

The map outlives the goal packet so it lives in docs/history/ with a README; beep refs already means the .repos reference workspace, so a new History family owns the command. Source: explorations/git-history-rewrite/DECISIONS.md (2026-11-06).

Lane `docs/git-history-rewrite-exploration`

Reverse: Move the map file and re-point the command; no SHAs depend on the location

### No history rewrite; notes overlay instead, 2026-11-06

Keep every SHA. Publish the July map as a git notes overlay; size relief via blobless clones. A force-push cannot clean GitHub (read-only refs/pull, 14 forks), drops 5,326 signatures and stales SHA citations. honest-repo-signal D6 stands. Source: explorations/git-history-rewrite/DECISIONS.md (2026-11-06).

Lane `docs/git-history-rewrite-exploration`

Reverse: Reopen explorations/git-history-rewrite at align; the July cutover scripts are archived under ~/.local/state/beep/archive/beep-effect-cutover/

### Dedicated refs/notes/history delivered by bootstrap sync, 2026-11-06

Dedicated ref shown through notes.displayRef; beep worktree new, scripts/cloud/bootstrap.sh and beep history notes sync set the fetch refspec and display ref. Source: explorations/git-history-rewrite/DECISIONS.md (2026-11-06).

Lane `docs/git-history-rewrite-exploration`

Reverse: Delete refs/notes/history on origin and drop the fetch refspec and notes.displayRef via the sync command

### Notes ref is a projection of the tracked map, published only by a post-merge job, 2026-11-06

beep history notes --write builds the ref deterministically from docs/history/commit-message-map.json; --check fails on drift; a post-merge workflow on main is origin's only writer. A refs/notes/* ruleset is optional later hardening. Source: explorations/git-history-rewrite/DECISIONS.md (2026-11-06).

Lane `docs/git-history-rewrite-exploration`

Reverse: Remove the workflow and the History command; the tracked map stays as plain data

### July validator scripts are archived, not tracked, 2026-11-06

Refines the cutover-folder decision. Only the map data moves to docs/history/ (commit-message-map.json, commit-message-map.excluded.json, README.md). The July .mjs validators (merge-map, validate-map, build-dossier) go to the archive: beep history notes --check owns validation (decode, ancestry, drift), and loose scripts in the tree run against the scripts-to-beep-cli direction. Also adds the one saving commit the July map missed (6f33208961, a pure .repos/effect-tsgo deletion).

Lane `docs/git-history-rewrite-exploration`

Reverse: Copy census/*.mjs from ~/.local/state/beep/archive/beep-effect-cutover/ into docs/history/

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
