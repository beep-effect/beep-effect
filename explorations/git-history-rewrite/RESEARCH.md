# Research

## 2026-11-06 — external landscape

### What GitHub does after a history rewrite and force-push

Source: GitHub Docs, "Removing sensitive data from a repository"
(<https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository>).
The page is written for secret removal, but every side effect it lists applies to
any rewrite:

- Every changed commit and all its descendants get new hashes, which "can break
  tooling that relies on stable hashes".
- `refs/pull/*` cannot be force-pushed: "GitHub marks those as read-only." Every
  PR keeps pointing at its old commits, so the old graph stays reachable on the
  server.
- PR diff views for the PR that introduced the change and later PRs built on it
  are lost, and comments on the old diff can be invalidated.
- Forks keep the old commits; GitHub cannot give out fork owners' contact
  details.
- Old commits stay readable by SHA through cached views until GitHub Support
  runs a server-side GC, and Support "will only assist in the removal of
  sensitive data". A size or cosmetic rewrite should expect no server-side
  cleanup.
- A stale clone that pulls and pushes brings old history back. Branches from the
  old history must be rebased, not merged.
- The page asks to "merge or close all open pull requests" first.

Consequence for this repository: a rewrite changes what `main` (and the other
pushed heads and tags) points at. It does not shrink GitHub's storage or remove
old commits from the PR, fork or SHA views. A default `git clone` fetches only
heads and tags, so fresh clones would shrink.

### git filter-repo

Sources: <https://github.com/newren/git-filter-repo> and its `COPYING`
(<https://raw.githubusercontent.com/newren/git-filter-repo/main/COPYING>), and
the manual page (`docs/man1/git-filter-repo.1` on the `docs` branch, read
2026-11-06).

- License: MIT for the tool and most files; dual-usable under git.git's GPL
  terms; the test harness is GPL-2.0. We run it as a tool and vendor nothing,
  so no port discipline is needed.
- Signatures: "signatures on commits and tags cannot continue to work and
  instead are just removed (thus signed tags become annotated tags)." Re-signing
  12k rewritten commits is a separate step filter-repo does not do.
- SHA references inside commit messages: rewritten by default, "abbreviated to
  the same length as the old reference" (`--preserve-commit-hashes` turns it
  off). This covers commit messages only, not tracked files.
- Mapping outputs: `$GIT_DIR/filter-repo/commit-map` (old → new for every
  commit), `ref-map`, `first-changed-commits`, plus `refs/replace/*` refs that
  "if manually pushed and fetched will allow users to continue to refer to new
  commits using (unabbreviated) old commit IDs".
- `--refs` implies `--partial`, which mixes old and new history and skips the
  automatic gc. July's rehearsals hit this (gotcha 3 in `cutover.sh`).
- Message rewriting: `--replace-message <file>` or `--message-callback`. The
  July map is SHA-keyed, so it would run as a callback keyed on the original id.
- Local install: `~/.local/bin/git-filter-repo`, version `a40bce548d2c`; git
  2.56.0. The GitHub page's `--sensitive-data-removal` mode needs filter-repo
  2.47 or later and is not needed for this rewrite.

## 2026-11-06 — in-repo capability inventory

No rewrite tooling exists in the repo: `rg -i 'commit-map|filter-repo'` over
`packages`, `scripts`, `standards`, `docs`, `.github` returns nothing. The July
scripts live only in the out-of-repo cutover folder.

| Capability | Status | Where |
| --- | --- | --- |
| History rewrite runner (filter + graft + message map) | NOT FOUND in repo | July draft `cutover.sh`, `rehearse.sh`, `predict-pruning.py` (out of repo) |
| Per-checkout reconvergence after a force-push | NOT FOUND in repo | July draft `converge.sh` (out of repo) |
| Fleet census, drain and retire | EXISTS (partial) | `goals/legacy-drain` (residue-reap `drainable` class); `packages/tooling/tool/cli/src/commands/Worktree/internal/ResidueTerminalLaneLive.ts`; `beep worktree remove --archive`; `yeet sweep --retire` (`commands/Yeet/internal/Sweep.ts`, `Retire.ts`) |
| `.repos` untracked, pinned references | EXISTS | `beep refs provision`, `scripts/references.json`; `.repos/*` symlinks into `~/YeeBois/references/effect` |
| Typed git access | EXISTS | `@beep/git` driver `packages/drivers/git/src/Git.ts`; GitHub driver `packages/drivers/github/src/GitCommit.ts` |
| Commit SHA schemas | EXISTS | `KnowledgeCommitSha` (`commands/Knowledge/Knowledge.refs.ts:510`), `GitCommitSha` (`commands/Codex/Findings.capture.schemas.ts:327`) |
| SHA-citation rewrite over tracked files (commit-map → files) | NOT FOUND | NET-NEW if the rewrite goes ahead |

History-dependent code that a rewrite touches:

- 57 `packages/**/src` files shell out to `git log` / `rev-list` /
  `merge-base` / `cat-file`. 11 use ancestry checks (`is-ancestor`), among them
  `Yeet/internal/Sweep.ts`, `Retire.ts`, `FinalCheckRefresh.ts`,
  `Worktree/internal/ResidueTerminalLaneLive.ts`,
  `Knowledge/KnowledgeDoctor.service.ts`, `Codex/Findings.packet.ts`,
  `Ci/RouteCensus.ts`. Ancestry-based retirement of lanes created before the
  cutover would give wrong answers: old lane heads are not ancestors of the new
  `main`.
- Yeet inbox rows and receipts key on `headSha` (`Yeet/internal/Inbox.ts:1215-1403`).
  Pre-cutover receipts would point at commits outside the new `main`.
- Memory `goal-completion-gate-needs-slug-in-commit`: the goal completion gate
  reads commit messages for the goal slug, so a message rewrite must keep slugs.

Tracked files carrying 40-hex SHAs on `origin/main` (upper bounds; they include
content hashes as well as commit ids):

| Surface | Files |
| --- | --- |
| `goals/**/*.json{,l}` | 2,486 |
| `explorations/**`, `research/**` | 5,542 |
| `packages/**/src/**` | 97 |
| `.github/**` | 15 (mostly third-party action pins, unaffected) |
| `*.md` with 10-hex short SHAs | 1,403 |

## 2026-11-06 — constraints discovered

1. A rewrite cannot clean GitHub's server side. Size gains only reach new
   clones; PR pages, forks and old-SHA URLs keep the old graph.
2. Every signature is dropped (5,326 signed commits today). Keeping signed
   history means a re-sign pass, which is a rabbit hole.
3. Every tracked SHA citation goes stale unless a commit-map pass rewrites
   thousands of tracked files in the same cutover, and that pass must
   distinguish commit ids from content hashes.
4. Ancestry-based tooling (sweep, retire, residue reap, final-check refresh)
   misreads pre-cutover lanes. Doing the cutover after `goals/legacy-drain`
   finishes, with zero live lanes, removes most of that risk.
5. The 135 `refs/archive/*` refs on origin pin the old graph and must be
   dropped, moved to an attic repository, or deliberately kept.
6. New history is already clean (6 low-signal subjects in 2,122 commits since
   2026-07-25), so the message problem is bounded and will not grow.
7. GitHub's guidance asks for zero open PRs at cutover; today there are 8.

Gaps for align or a rehearsal: the size of `.repos` subtree objects in today's
2.49 GiB pack (July measured 856M → 337M on a smaller repo), and the number of
tracked SHA citations that are commit ids rather than content hashes.

## 2026-11-06 — align loop: git notes as an overlay

Opened by the align round 1 answer (no rewrite, notes overlay).

- GitHub stopped displaying git notes on commit pages in August 2014; its
  2010 announcement now carries that update
  (<https://github.blog/2010-08-25-git-notes-display/>). Notes still push and
  fetch as ordinary refs, but they are visible only in local `git log` /
  `git show`, never on github.com.
- A default clone does not fetch notes. Origin's fetch refspec today is only
  `+refs/heads/*:refs/remotes/origin/*`, and no `notes.displayRef` is set, so
  every checkout needs a notes refspec before it sees the overlay.
- Origin has no `refs/notes/*` and its only ruleset (`main`, id 10240248)
  targets branches. A notes ref push is not PR-gated.
- No repo code reads or writes git notes (an `rg 'refs/notes|git notes'` over
  `packages`, `scripts`, `.github`, `docs` finds only unrelated uses of the
  word "notes").
- The July map still lines up with history: all 939 `final-map.json` keys are
  ancestors of `origin/main`, and only 1 `saving` commit on main is missing
  from it. History has not moved under the map, so it needs no refresh.
