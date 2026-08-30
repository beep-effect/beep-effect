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

## 2026-08-30 — Vendored Pulumi sources block repository test-tsgo proof

- **What I was doing:** Re-running the repository-wide test tsgo lane after all
  migration-owned package checks were green.
- **Evidence:** `bun run beep quality test-tsgo` failed only in
  `infra/node_modules/@pulumi/gharunners` with TS1295 CommonJS versus
  `verbatimModuleSyntax` diagnostics and related vendored-source errors. The
  same failure existed before the final migration fixes; no changed source
  file remained in the diagnostic set.
- **What would have prevented it:** The infra test project should exclude
  dependency source files or the installed Pulumi package should publish
  module metadata compatible with the repository's TypeScript configuration.
