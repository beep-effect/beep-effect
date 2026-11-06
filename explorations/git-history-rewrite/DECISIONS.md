# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-11-06 — rewrite or not

**Question:** Rewrite beep-effect's git history at all, and with which scope
(subtree purge, message rewrite, both)?

**Answer:** No rewrite. Keep every SHA. Publish the July commit-message map as
a git notes overlay so local `git log` shows the corrected subject beside the
original. Size relief for new clones comes from documented partial clones
(`--filter=blob:none`), not from purging the `.repos` subtree graph.

**Rationale:** RESEARCH.md 2026-11-06. A force-push cannot clean GitHub's side
(read-only `refs/pull/*`, 14 forks, SHA-addressable cached views; Support GC
only for sensitive data), so the size win reaches only fresh clones, which a
blobless clone already gets. A rewrite drops 5,326 signatures, makes thousands
of tracked SHA citations stale, and breaks ancestry-based lane tooling, for a
cosmetic gain in history that has been clean since July (6 low-signal subjects
in 2,122 commits). Rejected: subtree purge only (pays the full SHA and
reconvergence cost for a server-side size gain that never arrives); the full
July plan (adds a NET-NEW tracked-file SHA rewrite on top); killing the idea
(throws away a reviewed 939-row map that costs nothing to publish as notes).
Recommendation given: notes overlay.

## 2026-11-06 — honest-repo-signal D6

**Question:** Does this packet supersede `goals/honest-repo-signal` D6 ("No
filter-repo")?

**Answer:** No. D6 stands; this packet confirms it with current evidence.

**Rationale:** Follows from the rewrite decision above. No supersession record
is needed in the completed goal.

## 2026-11-06 — cutover folder ownership

**Question:** What happens to `~/YeeBois/projects/beep-effect-cutover` before
`goals/legacy-drain` archives it?

**Answer:** Track the message map in this packet (`census/final-map.json`,
`excluded-from-map.json`, the validators). Move everything else (cutover and
rehearsal scripts, branch curation, decision sheet, fleet inventory, research
reports) to `~/.local/state/beep/archive/beep-effect-cutover/`, with a pointer
in `research/SOURCES.md`. Then the folder is removed, which satisfies
legacy-drain's "archived" line.

**Rationale:** The map derives from public commits and is the one input the
overlay needs. The fleet inventory names local paths and local-only branches
and stays out of the public repo. The rewrite scripts are moot after the
no-rewrite decision but are kept in the archive in case it is ever reopened.
Rejected: archive everything (the overlay would depend on an untracked file);
track everything redacted (redaction work for scripts nobody will run).

## 2026-11-06 — overlay design (round 2)

**Question:** Notes ref, delivery to checkouts, write path, and who publishes.

**Answer:**
- Ref: dedicated `refs/notes/history`, shown through `notes.displayRef`.
- Delivery: bootstrap config. `beep worktree new`, `scripts/cloud/bootstrap.sh`
  and a sync command set the notes fetch refspec and `notes.displayRef`.
- Write path: a beep CLI projection. The tracked, schema-decoded map is the
  truth (changed only by PR); `--write` builds the ref deterministically and
  `--check` fails when ref and map differ.
- Publish: a post-merge GitHub Actions job on `main` runs `--write` and pushes
  the ref when the tracked map changes. A ruleset over `refs/notes/*` is an
  optional later hardening.

**Rationale:** A dedicated ref can't be clobbered by tools that write default
notes and drops cleanly (delete one ref). Bootstrap delivery means agent lanes
see the overlay without anyone remembering a recipe. Projection plus check
matches the repo's generated-projection pattern and keeps the PR-only rule
meaningful: the only human-reviewed input is the map. Rejected:
`refs/notes/commits` (shared namespace), docs-only delivery (nobody would set
it), a one-off script (no drift check), agent pushes from workstations (an
unreviewed write path to origin), a ruleset first (adds setup before value;
can follow).

## 2026-11-06 — shape review

**Question:** Map home, command home, and whether the brief matches.

**Answer:** The map lives at `docs/history/commit-message-map.json` with a
README; the command is a new `beep history notes` family (write / check /
sync) with notes operations in `@beep/git`; the brief is locked as written.

**Rationale:** The map is the source of truth for a permanent projection, so
it can't live in a goal packet that will be archived, and it shouldn't be tied
to repo-cli releases. `beep refs` already means the `.repos` reference
workspace. Rejected: goal-packet `data/`, repo-cli package data, `beep refs
history-notes`.
