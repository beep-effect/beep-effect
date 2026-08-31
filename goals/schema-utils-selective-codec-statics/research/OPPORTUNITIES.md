# Opportunities

## 2026-08-30 — Goal doctor treats a new untracked active packet as stale

- **What I was doing:** Validating a newly materialized goal packet before the
  first `/grilling` round.
- **Evidence:** `bun run beep goals doctor` returned zero blocking findings but
  emitted `schema-utils-selective-codec-statics [stale-active] active packet
  untouched for 21+ days` even though the manifest's `created` and `updated`
  dates are 2026-08-30 and the packet is new and untracked.
- **What would have prevented it:** The stale-active advisory should recognize
  an untracked/new packet's manifest dates or suppress age advice until the
  packet has a first commit.

## 2026-08-30 — Architecture preflight cannot load the broad-static graph

- **What I was doing:** Running the required architecture preflight before
  deciding whether the selective implementation needed a new role file.
- **Evidence:** `bun run beep architecture --help` failed while loading
  `packages/foundation/modeling/md/src/Md.model.ts` with `Cannot redefine
  non-configurable static 'is'` from `SchemaUtils/withStatics.ts`.
- **What would have prevented it:** The broad codec-static helpers should not
  eagerly attach shared keys that collide with an owning schema's explicit
  companions. The selective migration removes that load-time failure mode.

## 2026-08-30 — Textual static cleanup cannot distinguish schema ownership

- **What I was doing:** Reducing broad attachments to the smallest evidenced
  static tuple across generated and authored schemas.
- **Evidence:** A goal-local textual used-name pass confused shared roots such
  as `S.Unknown` with schema-owned declarations and a symbol-aware whole-repo
  retry did not finish within the bounded edit loop.
- **What would have prevented it:** A repository inventory should expose
  declaration ownership and cross-package property reads from the type graph,
  rather than asking one-off codemods to infer ownership from identifier text.

## 2026-08-30 — Tagged-union augmentation hides a second static surface

- **What I was doing:** Applying strict selected statics to schemas that also
  used `S.toTaggedUnion` utilities.
- **Evidence:** The first repository test-tsgo pass found that
  `DistinctionDetail.guards` and `.match` were used from
  `packages/law-practice/server/test/LawPracticeServer.test.ts`, after a local
  declaration-only scan had classified the tagged helpers as unused. Strict
  runtime imports also exposed ordering conflicts when tagged/custom statics
  preceded selection.
- **What would have prevented it:** The migration inventory should follow
  exported-schema reads across package boundaries and report source/root own
  statics such as `cases`, `guards`, and `match`. The closing inventory now
  records those source traits and rejects risky ordering.

## 2026-08-30 — Missing generated Pulumi boundary obscures repository test-tsgo proof

- **What I was doing:** Re-running the repository-wide test tsgo lane after all
  migration-owned package checks were green.
- **Evidence:** `bun run beep quality test-tsgo` failed only in
  `infra/node_modules/@pulumi/gharunners` with TS1295 CommonJS versus
  `verbatimModuleSyntax` diagnostics and related source errors because the
  generated package `bin` directory was absent. Running
  `bun run infra:prepare-gha-runners` generated the expected JavaScript and
  declarations; repository test-tsgo then passed, and Yeet's frozen install
  reproduced the preparation through root postinstall.
- **What would have prevented it:** Run the repository preparation/postinstall
  path before direct compiler lanes, or have the lane detect the missing
  generated `@pulumi/gharunners` boundary and name the preparation command.

## 2026-08-30 — Aggregate coverage found rebuild behavior missed by package tests

- **What I was doing:** Regenerating the coverage baseline after focused
  package verification had passed.
- **Evidence:** The aggregate import graph exposed two load-time failures:
  `withStatics` attempted to replace a rebuilt, non-configurable selected
  static after `S.toTaggedUnion`, and `S.make(RawLexicalNode.ast)` had erased
  the runtime `members` required by `S.toTaggedUnion`. A follow-up aggregate
  run also found that the same generic rebuild had removed
  `FilingOutcome.guards`; the focused server test passed after rebuilding from
  the union and reapplying `S.toTaggedUnion` after codec selection.
- **What would have prevented it:** Add a focused compatibility test for
  selected statics carried through legacy wrappers and annotations, and avoid
  generic `S.make(ast)` rebuilds when a schema combinator requires specialized
  runtime structure such as union `members`.

## 2026-08-30 — Coverage comparison resurrected deleted source identities

- **What I was doing:** Running the full coverage ratchet after deleting the
  superseded broad codec-static helper modules.
- **Evidence:** The comparison reader merged every committed file row back into
  the current package snapshot, so deleted helper paths were reported as
  missing coverage even though they no longer existed in the workspace.
- **What would have prevented it:** Retain committed metrics only for file paths
  that still exist in the current package snapshot. The reader now filters the
  committed rows by current ownership, with a regression test for a deleted
  base-only path.

## 2026-08-30 — Detached coverage parent discarded a completed shard run

- **What I was doing:** Regenerating the repository coverage baseline after
  merging the latest main branch.
- **Evidence:** All spawned coverage shards completed, but the parent process
  detached before aggregating and writing the baseline; the baseline timestamp
  remained unchanged and the full run had to be repeated while attached.
- **What would have prevented it:** Coverage baseline generation should persist
  aggregate state independently of its terminal parent, or support resuming
  from successful shard receipts without rerunning the entire repository.
