# P4 design: Workstream B lock materialization (`skills-lock/v2`)

Status: design (2026-10-13). The decided contract below is agent-decided under the 2026-10-06
autonomy charter. Reasons and reversals are in the B-series decisions at the end.
B1–B4 (`research/p2-grill-decisions.md`) are not reopened.

## Live state (2026-10-13)

- `skills-lock.json` is v1 (`version: 1`). It has 35 entries: 6 `github` (`adhd`,
  `grill-me`, `portless`, `shadcn`, `teach`, `turborepo`) and 29 `local`. Each entry is
  `source`, `sourceType`, `ref`, `skillPath`, `computedHash`.
- The v2 schema family exists from P1 (`Skills.schemas.ts`: `SkillUpstream`,
  `SkillSnapshot`, `SkillLicense`, `SkillProvenance`, `SkillPatches`, `SkillEffective`,
  `SkillLockV2Entry`, `SkillsLockV2`). `SkillsLockV2.skills` admits only fully
  specified `github` entries.
- `beep skills provenance` computes a full `SkillLockV2Entry` for `shadcn` only. Its
  ratified resolution input is hardcoded (`Skills.service.ts`, `shadcnResolutionInput`).
- B2's wave-1 list has drifted: `ponytail` and `ponytail-review` are no longer
  installed, and `adhd` was added as a `github` entry after the audit, with no ratified
  resolution yet.

- A live run on 2026-10-13 (`beep skills provenance <skill>` for all six seeds)
  validated every seed's pinned license hash. It also found that all six installed
  trees now differ from their pins, including `grill-me`, `teach`, and `shadcn`,
  which were byte-exact on 2026-07-31. The cause is `beep skills update`: in write
  mode it refetches `remoteSkillSources` at floating `main` and overwrites the
  installed copies, so upstream movement shows up as "drift" against the pin.

## Gap

Nothing writes v2 entries. A v2 lock that holds only GitHub entries cannot replace the
v1 file, because the 29 local skills would lose their installed-tree hash and
`beep skills update --check` would lose its oracle for them.

## Decided contract

1. **One lock file, a tagged union per entry.** `skills-lock.json` moves to
   `version: 2`. Each entry is `SkillLockEntry = Vendored | Local`.
   - `Vendored`: today's `SkillLockV2Entry` fields plus `_tag: "vendored"`.
   - `Local`: `_tag: "local"`, `installedTargets`, and `installedTreeHash` (the
     same mode-aware tree hash the effective layer uses, so both kinds share one
     hashing rule).

   Renovate's regex manager (B3) reads only `vendored` entries'
   `upstream.repository` + `upstream.sourceRevision`.
2. **Resolutions live in the lock after migration.** The v2 `upstream` +
   `provenance` blocks are the ratified resolution record. Migration takes them from
   a one-time `SkillResolutionSeed` table, transcribed from
   `research/p1-skill-upstream-resolution.md` for `grill-me`, `teach`, `shadcn`,
   `oracle` (inferred/medium, B1), `portless`, and `turborepo`. After migration the
   hardcoded `shadcnResolutionInput` is deleted, and `provenance <skill>` reads its
   resolution from the lock.
3. **Plan before write.** `beep skills lock-plan [--json]` (designed as `lock migrate
   --plan`) is read-only. It emits a `skills-lock-migration-plan/v3` report (v1 before
   B-3a, v2 before B-3b): per skill, the computed v2 entry at the proposed pin, the pin
   proposal, classified drift, the generated patch series with proposed labels, and the
   unresolved causes that block a write, sealed with the read lock's digest by
   `planDigest`. `lock-plan --write --expect <digest>` recomputes the plan and publishes
   only when the plan has no conflicts, its digest matches, and the lock is unchanged at
   the rename. That is the shared plan-contract shape from Workstream E.
4. **Patches are generated, then classified.** For a vendored skill whose installed
   tree differs from the pristine snapshot, migration emits one patch per drifted
   file under `.agents/skill-patches/<skill>/NNNN-<slug>.patch`, labelled
   `temporary-drift`, owned by the CODEOWNERS owner of the skill's path (B9), with drop condition "upstream
   contains an equivalent change". Classification into `policy` / `repo-adaptation`
   is the first HITL hunk review (SPEC B); until then every generated patch carries
   the conservative label.
5. **No pristine trees in the repo.** Pristine snapshots are fetched at the pinned
   `sourceRevision` through the existing `SkillUpstreamContentSource` and cached
   content-addressed under `~/.cache/beep/skills/<treeHash>`. The lock carries the
   tree manifest hash, so a fetched snapshot is verified before use.
6. **Drift is classified against the upstream path history before it becomes a patch.**
   The migration plan lists the commits touching the skill's tree path at its tracking
   ref (newest first, at most 100; a longer history is reported as truncated, never read
   as complete). It walks them newest to oldest. The newest revision whose whole
   mode-aware tree hash equals the installed tree is proposed as the pin
   (`pristine-at-revision`). Otherwise the seed pin is kept (`keep-seed-pin`), and each
   file that drifted from the seed pin is classified by what the walk proves:
   `matches-upstream-revision` names the newest revision carrying its bytes and mode;
   `matches-no-examined-revision` means no examined revision does, so the file is a
   `temporary-drift` patch candidate for the HITL hunk review (B8). The plan records the
   path-history head it classified against per skill and seals it into `planDigest`, so a
   reviewed plan stops matching once upstream changes the skill (B11).
7. **The floating updater stops touching vendored skills.** After the lock flip
   (B-3), `skills update` refuses to refetch a `vendored` entry at a floating ref.
   Vendored skills move only through a pinned bump (Renovate, B3) that replays the
   patch series.
8. **`adhd` stays out of the first write.** It has no ratified resolution. The
   migration plan reports it as `unresolved`, and it stays `local` until its own
   resolution lands.

## Sequencing

- **PR B-1 (docs):** this design and its decisions.
- **PR B-2 (read-only):** `SkillLockEntry` union, the `skills-lock/v2` document
  schema with a v1 decoder, `SkillResolutionSeed`, the pure migration compiler,
  `skills lock migrate --plan --json`, tests (golden plan per wave-1 skill,
  fail-closed on unresolved), and the committed plan report as the FP-eyeball input.
- **PR B-3a (read-only, after the plan's verdict):** path-history reclassification
  (B11): the content source lists the path history, the plan proposes the newest
  pristine revision as the pin, classifies drift by the newest matching revision or
  none, isolates a per-skill provenance refusal as `unresolved`, and seals the
  classified-against path-history heads into `planDigest`.
- **PR B-3b (write) — done:** `beep skills lock-plan --write --expect <planDigest>` and
  the lock flip (each vendored entry recomputed at its proposed pin, with the license
  re-checked there), plan schema `skills-lock-migration-plan/v3` (sealing the read
  lock's digest), the generated patch series (B12), owners from the merge-base
  CODEOWNERS, `provenance` reading its resolution from the lock, `skills update`
  (`--check` included) over v2, and the floating updater refusing to refetch a
  `vendored` entry (contract 7). Receipt and live outcome:
  `research/p4-report-skills-lock-plan.md` ("Write receipt").
- **Later:** `materialize` + the clearing-house equivalence check (P4); Renovate +
  hunk ledger (P5).

### Tracked follow-ups (from #1633 review, round 3)

Both are addressed by B-3a.

- **Addressed (B-3a):** a per-skill `SkillsCommandError` from `resolveSkillProvenance`
  (license digest mismatch, unsafe upstream path, unencodable entry) used to abort the
  whole plan. It is now caught per skill, like the content error, and emitted as an
  `unresolved` row (`provenance-unavailable: …`) that keeps the skill's local entry.
- **Addressed (B-3a):** `matches-upstream-head` was not a safe pin-bump signal, because
  `classifyDrift` saw only the drifted paths at the head. The class and the
  `upstreamHead` pin-bump promise are gone. A pin is proposed only when a whole
  upstream tree equals the installed tree (B11).

## Decisions (B5–B15)

- **B5 — tagged-union lock.** Reason: the 29 local skills need the same drift
  oracle, and one file is what Renovate and `update --check` already read. Reverse:
  split local entries into `skills-local.json`; vendored entries are unchanged.
- **B6 — resolutions migrate into the lock.** Reason: a second registry of ratified
  sources would drift from the lock. Reverse: keep a `skills-resolutions.json`
  sidecar keyed by skill.
- **B7 — plan/expect-digest/atomic write.** Reason: the Workstream E plan
  contract, reused, so lock writes are reviewable and replayable. Reverse: drop
  `--expect`; the plan stays read-only.
- **B8 — conservative patch label until HITL review.** Reason: SPEC B makes
  classification a human session; inventing a label would launder it. Reverse:
  relabel per hunk in the review session.
- **B10 — drift classification and the floating updater.** Reason: the live run
  shows floating `main` refetches are indistinguishable from local edits without
  classification, and would invalidate pins on every update. The classes name only
  what the plan's comparison proves (review on #1633). B11 replaces the head-only
  comparison with a path-history walk that separates intermediate upstream pulls from
  local edits. Reverse: allow
  floating refetch for skills explicitly marked `tracking: floating` in the lock.
- **B9 — patch owner resolves from `.github/CODEOWNERS`** at the merge-base, with
  GitHub last-match semantics over the skill's installed path, exactly as the knowledge
  doctor binds lease owners (K6). The file exists today (`* @kriegcloud`), so every
  generated patch is owned by `@kriegcloud`; a PR cannot grant itself ownership because
  the base copy is read. Reason: answers the P1 report's open question with the ownership
  policy the repo already has, and keeps one owner-resolution rule across workstreams
  (review on #1626). Reverse: a dedicated owner registry, if per-path ownership outgrows
  CODEOWNERS.
- **B11 — path-history reclassification (B-3a).** The plan walks the skill's upstream
  path history newest to oldest, proposes the newest revision whose whole tree equals
  the installed tree as the pin, and otherwise classifies each drifted file by the
  newest revision carrying its bytes (`matches-upstream-revision`) or none
  (`matches-no-examined-revision`). The walked history head is sealed into
  `planDigest`. Reason: the Workstream B lock-plan verdict
  (`p1-fp-eyeball-verdicts.md`) rejected head-only classification, because three of
  the five "differs from upstream head" files were byte-equal to older upstream path
  revisions that the floating updater had pulled. Reverse: revert to head-only
  classification (`matches-upstream-head` / `differs-from-upstream-head` against the
  tracking ref's current head).
- **B12 — the patch series covers every drifted file, as line-level unified diffs (B-3b).**
  A row that keeps its current pin gets one `temporary-drift` patch per file that differs
  from the pristine snapshot, numbered in path order
  (`.agents/skill-patches/<skill>/NNNN-<slug>.patch`), not only its
  `matches-no-examined-revision` files, so the snapshot plus the series always
  reconstructs the installed tree. Hunks carry three lines of context and Git's range
  and no-newline syntax, computed in-repo (no new dependency). The live oracle series
  applies to the fetched `d6e773a562` snapshot with `git apply` and yields the installed
  tree byte for byte. Each patch's owner is the merge-base CODEOWNERS owner of the
  installed file it changes (`.claude/skills/<skill>/<file>`, B9). Reason: a series that
  skipped a drifted file would not replay. Reverse: emit patches only for
  `matches-no-examined-revision` files and refuse a write whose kept-pin row has
  `matches-upstream-revision` drift.
- **B13 — no pristine-snapshot disk cache (contract 5, B-3b).** Snapshots are fetched
  on every plan through `SkillUpstreamContentSource`; blob bytes are cached in memory
  per process only. A full live plan costs about 20 seconds with a token, and a disk
  cache would add its own verification and eviction surface. Reverse: cache
  content-addressed under `~/.cache/beep/skills/<treeHash>`, verified against the
  entry's manifest hash before use.
- **B14 — the write is a fixed point (B-3b).** The plan seals the digest of the lock
  bytes it read, and after the flip each vendored row's baseline is the lock's own pin.
  Replaying a pre-write digest therefore refuses as `digest-mismatch`; the next plan
  (pristine rows now show no drift) writes nothing and reports `already-applied`; and
  every later plan repeats its digest until upstream or the installed trees move.
  Reason: a reviewed digest names exactly one lock transition. Reverse: keep classifying
  against the seed pin after the flip, which keeps the drift rows but reopens a second
  registry of pins (B6).
- **B15 — every installed skill gets a row (B-3b).** The plan covers installed skills
  the v1 lock never named (`closeout`, `orchestrate`) as `local`, and only
  `no-ratified-seed` unresolved rows are writable (as `local`); a missing install or an
  unreadable seeded upstream blocks the write rather than demoting the skill. After the
  flip `adhd` plans as an ordinary `local` row, because a v2 `local` entry carries no
  upstream; `skills update` still refetches it at its floating ref until its resolution
  lands. Reason: the lock is the drift oracle for every installed skill. Reverse: plan
  lock entries only and leave unlisted skills to `skills update`.
- **B23 — vendored trees and the lock stay outside repo formatting (PR #1679 review).**
  `biome.jsonc` (and the generated `biome.identity.jsonc`) excludes every vendored
  skill's `.claude/skills/<name>` tree; `.agents` was already excluded and
  `.agents/skills` is a symlink onto `.claude/skills`. ESLint ignores the same trees.
  `skills-command.test.ts` fails when a `vendored` lock entry's install target is not
  excluded, so a new vendored skill cannot be formatted silently. `skills-lock.json` is
  excluded as well: the `beep skills` renderer is its canonical byte form, and
  `skills update --check` compares the decoded document rather than bytes, so a
  reformatted lock is not drift and write mode leaves it alone. Reason: Biome rewrote
  `shadcn/assets/showcase/{color-pair,state-matrix}.tsx`, so no upstream revision
  matched the whole tree and the plan fell back to the July seed with 12
  `temporary-drift` patches. With the upstream bytes restored, `shadcn` pins pristine
  at `2d3f1cd4` with no patches (contract 5: vendored trees stay byte-exact upstream).
  Reverse: drop the excludes and the guard test, and record each formatter rewrite as a
  `repo-adaptation` patch the pinned bump replays.
