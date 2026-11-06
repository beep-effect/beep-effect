# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-11-06 — seed from the July 2026 cutover workspace

Operator asked which goal or exploration packets cover fixing the git history
through the cutover planned in `~/YeeBois/projects/beep-effect-cutover/`. None
did. This packet opens to own that work.

### What the July workspace holds (2026-07-24/25, never executed)

`~/YeeBois/projects/beep-effect-cutover/` is a plain notes folder (no `.git`),
about 1.1 MB:

- `census/`: the commit-message rewrite map. `final-map.json` (939 rewrites
  after a three-model adversarial review with 53 fixes applied),
  `census.jsonl`, `map-output/*.jsonl` (43 fleet batches, 1,181 rows, all
  passing the repo's own `commitlint.config.ts`), `excluded-from-map.json`
  (50 upstream-authored and 5 rich-body merges keep their original message),
  `keep-original.txt`, `upstream-authored-excluded.txt`,
  `validation-report.md`, `review-dossier.md`, `REVIEW-map-skim.md`, plus the
  tooling `rehearse.sh`, `predict-pruning.py`, `merge-map.mjs`,
  `validate-map.mjs`, `build-dossier.mjs`.
- `cutover/`: `cutover.sh` (the real run, five stages 0-4, each gated by
  `BEEP_CUTOVER_STAGE_<N>=go`, resumable by `RUN_ID`), `converge.sh` (resets
  each checkout and worktree onto the rewritten main afterwards),
  `curation-proposal.md` (branch disposition: 52 DELETE, 97 ATTIC, 24
  KEEP-ACTIVE, 21 NEEDS-USER-EYES, 1 in flight), `DECISION-SHEET.md` (open
  operator inputs as of 07-25), `rehearsal-6-verification.txt` (the rehearsal
  that passed every check).
- `research/`: `rewrite-blast-radius.md` (message census, diff sizes, tracked
  files embedding SHAs, signing, fleet sizing), `checkout-fleet-inventory.md`
  (every local clone's unpushed work before a rewrite), `repos-coupling-report.md`
  (keep / untrack / purge options for the vendored `.repos/` subtree).

The July plan had two goals in one `git filter-repo` pass:

1. Purge the vendored `.repos/` subtree graph from history (grafting off the
   `Squashed '.repos/...'` commits). Rehearsal 6 took `.git` from 856M to 337M.
2. Rewrite low-signal commit subjects (`saving`, `updated deps`, `merged in
   main`, ...) from `final-map.json`.

Six gotchas from the rehearsals are written inline in `cutover.sh` (subtree
detection by the squash commit's second-parent subject, `--force`, `--refs main`
plus manual reflog expire and gc, removing `origin` from the filter clone so it
does not pin the old graph, NUL-separated path handling, cascade-aware pruning
prediction).

July sequence to GO, per the decision sheet: land the open PRs, quiesce
(rescue dirty hotspots, export stashes from every clone, prune DELETE branches,
push everything ATTIC to a private `beep-effect/beep-effect-attic` repo, zero
open PRs), line-read `cutover.sh`, staged run, explicit operator GO before the
force-push stage. Still open then: the attic repo creation, the
`experiment-stella` and beep-effect4 rescue calls, and two PRs that had to land
first.

### What changed since July (measured 2026-11-06 on `origin/main`)

- 12,485 commits on main (July census: 10,356). 2,122 landed since 2026-07-25,
  and only 6 of those have a low-signal subject. The squash-PR flow already
  stopped new junk; the problem is confined to pre-July history.
- 544 subjects still start with `saving`; 766 match
  `saving|wip|updated deps|merged `. 961 merge commits.
- `.repos/` is no longer tracked (0 tracked files): the July option (b),
  untrack plus a pinned reference workspace, has happened
  (`beep refs provision`, `.repos/*` symlinks into `~/YeeBois/references/effect`).
  The history still carries 226 `Squashed '.repos/...'` commits.
- Local pack: 2.49 GiB (`.git` 5.3 GiB in the primary clone, with garbage
  temp packs present).
- Origin: 27 heads, 135 `refs/archive/*` backups from the 2026-11-06 branch
  purge (these pin pre-rewrite history if left on origin), 6 tags, 8 open PRs.
- The repo is public: 77 stars, 14 forks. GitHub keeps `refs/pull/<n>/head`
  for every PR, and forks keep their own copy of the old graph. A rewrite
  cannot remove old objects from GitHub's view; it changes what `main` is.
- Signatures on main: 5,326 signed (`E` locally only because no
  `allowedSignersFile` is configured), 7,159 unsigned. A rewrite re-creates
  every commit, so every signature is lost unless the rewrite re-signs.
- SHA citations in tracked files: 1,403 Markdown files carry 10-hex short
  SHAs (decision files, receipts, reflections, memories point at merge
  commits). 10,625 files match 40-hex, an upper bound that includes lockfile
  and content hashes, not only commit SHAs. All commit citations go stale
  after a rewrite unless a SHA map rewrites them.
- The fleet is much larger than July's 9 clones: about 23 numbered
  `beep-effect*` clones plus `-worktrees` roots, and 61 worktrees on the
  primary clone alone. `goals/legacy-drain` (active) is draining legacy clones
  and plans to archive `beep-effect-cutover`.

### Prior rulings that touch this

- `goals/honest-repo-signal` (completed-retained) put the rewrite out of
  scope: `SPEC.md:16` non-goal "Rewriting git history / filter-repo", and D6
  at `SPEC.md:81`, "Subtree policy in README only. No filter-repo. ... History
  rewrite is not a night."
- `explorations/agent-fleet-layout` `DECISIONS.md:160-162`: archive
  `beep-effect-cutover` into `~/.local/state/beep` or the research tree, then
  remove it. `goals/legacy-drain` `SPEC.md:5` carries that as "`beep-effect-cutover`
  is archived."
- The July census map is about 2,100 commits behind main. Every SHA key in
  `final-map.json` is still valid (history has not been rewritten), so the
  map is stale only in coverage, not in identity.

### Loose thoughts

- The two goals may be worth splitting. Subtree purge is a size and clone-time
  win with a mechanical, verifiable rule. Message rewrite is cosmetic for a
  history nobody reads commit by commit, and it costs every SHA citation.
- The fleet drain (`legacy-drain`) shrinks the reconvergence blast radius.
  Doing the rewrite after the drain means fewer clones to converge.
- Alternative to rewriting: leave history, ship a `git replace`/notes-based
  SHA-to-message overlay, or start a fresh repository with an archived old one.
- Whatever moves from the cutover folder into this tracked public packet must
  be redacted first: the fleet inventory names local paths and local-only
  branches.
