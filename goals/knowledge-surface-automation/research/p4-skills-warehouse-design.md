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
3. **Plan before write.** `beep skills lock migrate --plan --json` is read-only. It
   emits a `skills-lock-migration-plan/v1` report: per skill, the v1 entry, the
   computed v2 entry, drift paths, generated patch hunks with proposed labels, and
   conflicts. `--write` performs an atomic rename only when the plan has no conflicts
   and its digest matches `--expect <digest>`. That is the shared plan-contract shape
   from Workstream E.
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
6. **Drift is classified before it becomes a patch.** The migration plan compares each
   drifted file with the tracking ref's current upstream head and names only what that
   proves: `matches-upstream-head` (the floating updater pulled newer upstream content;
   the remedy is a pin bump to `upstreamHead`) or `differs-from-upstream-head` (the
   file matches neither the pin nor the current head). A differing file may be a repo
   customization or a pull of an intermediate upstream revision. The plan does not walk
   every upstream commit to tell those apart, so it never asserts "local". Differing
   files become `temporary-drift` patch candidates that the HITL hunk review classifies
   (B8).
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
- **PR B-3 (write, after the plan's verdict):** `--write`, the lock flip, the
  generated patch series, `provenance` reading from the lock, `skills update --check`
  over v2.
- **Later:** `materialize` + the clearing-house equivalence check (P4); Renovate +
  hunk ledger (P5).

### Tracked follow-ups (from #1633 review, round 3)

- **B-3 input:** a per-skill `SkillsCommandError` from `resolveSkillProvenance`
  still aborts the whole plan. Catch it per skill, as the content error already is,
  and emit an `unresolved` row instead.
- **B-3 input:** `matches-upstream-head` is not yet a safe pin-bump signal, because
  `classifyDrift` sees only the drifted paths and never the rest of the tree at the
  head. Before the lock write relies on it, either compare the whole tree at the
  head or reword the promise. The path-history reclassification in the B verdict
  (`p1-fp-eyeball-verdicts.md`) subsumes this.

## Decisions (B5–B10)

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
  what a comparison with the current head proves (review on #1633). Walking every
  upstream commit to separate intermediate pulls from customizations is deferred to the
  HITL review. Reverse: allow
  floating refetch for skills explicitly marked `tracking: floating` in the lock.
- **B9 — patch owner resolves from `.github/CODEOWNERS`** at the merge-base, with
  GitHub last-match semantics over the skill's installed path, exactly as the knowledge
  doctor binds lease owners (K6). The file exists today (`* @kriegcloud`), so every
  generated patch is owned by `@kriegcloud`; a PR cannot grant itself ownership because
  the base copy is read. Reason: answers the P1 report's open question with the ownership
  policy the repo already has, and keeps one owner-resolution rule across workstreams
  (review on #1626). Reverse: a dedicated owner registry, if per-path ownership outgrows
  CODEOWNERS.
