# lockfiles — round-2 merged inventory

Seats read: `grok.md` (2 findings), `sol.md` (3), `fable.md` (4; independent Grok medium fallback seat), plus `BRIEF.md` and `BRIEF.grok3.md`. No part-N directories. Reviewed commit: `60fcfb5ebcdc26765a66cc1f13afc88adcb05d11`; live branch: `@lab/effected-2`. The source/test tree has no diff against the reviewed commit.

Required: **4** | Backlog: **2** | Handled by the deviation codemod: **0** | Rejected: **0** | Groups: **2**.

Binding basis: the complete operator revision block, including both 2026-10-09 ruling blocks and subsequent revisions, D1–D20, sections 12.4–12.5 and 14 of `scratchpad/EFFECTED_PORT_GOAL.md`, and the task's narrower write-surface rules. The briefs' claims about completed S2/S3 gates do not override the task's instruction to backlog documentation, coverage and vitest-canon findings. All nine seat records are represented below after deduplication.

The current `standards/effect-laws.allowlist.jsonc` contains **zero entries for `scratchpad/effected/lockfiles/**`**, so no `allow-<n>` findings are added. The collection finding below is an independently evidenced gate miss, not an allowlist entry.

This inventory retains the seats' read-only probe evidence and checks it against current source; no new probes, compiler checks, tests or coverage runs were performed. File history and the `63645ee483` S3 source diff were read. No finding alleges an unforced lab divergence or asks to restore a diagnostic- or law-forced representation. The two bugs are reproduced in the pinned upstream oracle as well as the port and qualify for section 14's upstream-bug exception. Ledger and README Port-notes bookkeeping remains central; none is assigned to a fix group.

`required.json` assigns g1 the public API, framing schema and affected examples/tests; g2 owns all three parser sources and their regression suites. Ownership does not overlap. The shared framing kit is consumed unchanged, so `internal/shared.ts` does not need a write assignment.

## Required

### sol-2-1 — Read npm workspace targets through own-property lookup
- file: scratchpad/effected/lockfiles/internal/npm.ts:218,237
- class: bug
- severity: required
- standard: D11; D9 and section 14's verified upstream-bug exception; missing-workspace-entry and hostile-key behavior.
- evidence: Sol's read-only probes against the reviewed commit and the pinned oracle parsed `{"lockfileVersion":3,"packages":{"node_modules/foo":{"link":true,"resolved":"constructor"}}}` and returned a workspace package named `Object` with instanceId `node_modules/foo`, although there is no own `constructor` target. Both source passes index `raw.packages[resolved]` without an own-property check; the inherited Object constructor supplies its `.name`. Existing hostile-key tests cover own entries rather than an absent prototype-named target.
- failure: Missing workspace metadata is fabricated from a prototype member, corrupting package identity and the workspace-name set and potentially changing inter-workspace dependency extraction.
- fix: Replace the resolved-target indexed lookup in both passes with `R.get` plus Option handling. Preserve current absent-target name/version fallbacks and own-key behavior. Add absent-`constructor` and own-`constructor` regressions to `scratchpad/test/lockfiles/internal/npm.coverage.test.ts`. Supply the verified upstream-bug evidence for central D9 bookkeeping; do not edit the ledger or Port notes in this group.
- seats: sol-2-1

### sol-2-2 — Resolve only to normalized package instances actually emitted
- file: scratchpad/effected/lockfiles/internal/pnpm.ts:496,513-524; scratchpad/effected/lockfiles/internal/npm.ts:116-148,287-299; scratchpad/effected/lockfiles/internal/bun.ts:131-175,223-234
- class: bug
- severity: required
- standard: D11; D9 and section 14's verified upstream-bug exception; `ResolvedPackage.ts` contract that resolved targets identify real normalized package instances.
- evidence: Sol's port and pinned-oracle probes used pnpm root importer `.` with `publishDirectory: dist` and importer `packages/app` depending on `root` with `specifier: workspace:*`, `version: link:../../dist`. Both emitted `resolved: { root: "." }` and no unresolved edge, while `packageByInstanceId(".")` returned None. The publish-directory index includes the root but package emission skips it. Sol also reproduced dangling targets for an npm versionless entry, a bun skipped malformed tuple and a pnpm skipped malformed snapshot key. Current source indexes raw keys before applying row-emission filters.
- failure: A resolved edge can name a skipped or unmodeled row, so traversing an apparently resolved dependency returns no package. pnpm also loses the required unresolved-edge signal.
- fix: Build resolution membership from identities that will produce normalized package rows, preserving each format's existing precedence and workspace identity rules. Exclude the unmodeled pnpm root from publish-directory targets and mark its recorded edge unresolved. Exclude malformed pnpm snapshot/package keys. For npm and bun, continue positional search past skipped entries and omit the edge if no modeled target exists. In the three `internal/{npm,pnpm,bun}.coverage.test.ts` suites, add the reported counterexamples and assert that every emitted resolved value is found by `packageByInstanceId`; retain valid publish-directory and ancestor-resolution behavior. Supply upstream-bug evidence for central D9 bookkeeping without editing the ledger or Port notes.
- seats: sol-2-2

### sol-2-3 — Replace the public withImporterNames native Map parameter
- file: scratchpad/effected/lockfiles/Lockfile.ts:395,398,418-419
- class: law
- severity: required
- standard: `standards/effect-laws-v1.md` law 6; EF-5; D5; 2026-10-09 grilling permits public collection API changes to remove native runtime collections.
- evidence: `withImporterNames` takes `ReadonlyMap<string, string>` and calls native `names.get` three times. Its source example at line 386 and README quick start at line 26 construct `new Map`. The seats identify why a green gate misses this: `NoNativeRuntime.ts` checks Map/Set NewExpression constructors and does not recognize the typed parameter's `.get` calls; documentation constructors do not establish runtime-source coverage. Round 1 addressed `extractWorkspaceDeps` and `configDependencies`, not this parameter.
- failure: A public domain operation still requires a native Map and cannot accept an Effect HashMap, leaving the law-required migration incomplete.
- fix: Accept `HashMap.HashMap<string, string>` and use `HashMap.get` plus Option handling. Preserve missing-key, empty-string and unchanged-name behavior, all package fields, and untouched importers. Retarget the method example, README quick start, `Lockfile.test.ts:394,460,476` and `Lockfile.coverage.test.ts:38,43` to Effect HashMaps. Test-local byId Maps are outside this defect. Central bookkeeping may extend the native-runtime deviation; do not hand-edit README Port notes or the shared ledger.
- seats: grok-2-1, sol-2-3, fable-2-1

### fable-2-2 — Reuse the existing FramingReason literal domain
- file: scratchpad/effected/lockfiles/Lockfile.ts:141
- class: schema
- severity: required
- standard: `standards/effect-laws-v1.md` laws 17 and 19; EF-12b; D5; discovery/reuse rule.
- evidence: `internal/shared.ts:497` already exports the annotated `FramingReason` LiteralKit and `FramingFailure.reason` consumes it. `LockfileFramingError.reason` independently repeats the same three literals using `S.Literals`; `materializeFailure` transfers that domain from internal failure to public error. The shared module does not import Lockfile.ts, so direct reuse introduces no cycle. The green gates did not catch this repeated domain, consistent with round-1 sol-1-5's kit-law miss.
- failure: A reused, named framing-reason domain has two independently maintained schemas; changing either literal list can make internal and public validation disagree.
- fix: Import the existing `FramingReason` value from `internal/shared.ts` and use it for `LockfileFramingError.reason`, retaining the field's annotateKey description. Keep the three accepted values and error behavior unchanged; retain and extend the existing framing checks in `Lockfile.coverage.test.ts` and the round-trip checks in `Lockfile.property.test.ts` as needed. No edit to `internal/shared.ts` or added export is needed.
- seats: fable-2-2

## Backlog

### grok-2-2 — Correct descriptions of non-finite format versions
- file: scratchpad/effected/lockfiles/internal/npm.ts:61,68; scratchpad/effected/lockfiles/internal/pnpm.ts:50; scratchpad/effected/lockfiles/internal/bun.ts:72-73; scratchpad/effected/lockfiles/internal/yarn.ts:47-49
- class: docs
- severity: backlog
- standard: Documentation truthfulness; accepted numeric-domains deviation; operator's S.Finite law-forced-change ruling. Documentation work is deferred under the task's S2 classification rule.
- evidence: npm/pnpm comments say the version gate rejects non-finite values and preserves them in its typed cause, while their S.Finite schema boundary fails first. bun/yarn comments claim non-finite version preservation; YarnMetadata's schema description explicitly says there is no finite-number restriction, while its version schema is `S.optionalKey(S.Union([S.String, S.Finite]))`. Both seats identify the same stale upstream acceptance description.
- failure: Readers expect NaN or Infinity to reach version-error formatting or be stringified, although schema validation rejects them first. This is a description defect, not evidence that the law-forced S.Finite representation is wrong.
- fix: In S2, describe string-or-finite version preservation where allowed and non-finite rejection at the schema boundary. Correct the comments and YarnMetadata description; retain S.Finite and the accepted numeric-domains deviation.
- seats: grok-2-2, fable-2-4

### fable-2-3 — Describe the remaining nested schema fields
- file: scratchpad/effected/lockfiles/LockfileIntegrity.ts:84-89; scratchpad/effected/lockfiles/PnpmExtension.ts:81-82; scratchpad/effected/lockfiles/ResolvedPackage.ts:114
- class: schema
- severity: backlog
- standard: Operator revision step 4 field annotations; EF-12. The requested descriptions are documentation metadata, deferred under the task's S2 classification rule.
- evidence: The unsatisfiedConstraints nested workspace/dependency/constraint/resolved/depType fields, settings.autoInstallPeers and settings.excludeLinksFromLockfile, and peerDependenciesMeta.optional lack annotateKey descriptions. Their parent fields are annotated, and the internal pnpm/settings and shared/peer twins have leaf descriptions. The seat identifies specific missed leaves despite the identity-annotation pass.
- failure: Public schema metadata omits leaf descriptions present on corresponding internal structs. Decoding, defaults and accepted types remain unchanged.
- fix: Add annotateKey descriptions only to those nested fields during S2; keep their schemas and defaults unchanged. This asks to add missing descriptions, not merely to record an already-completed identity-key change.
- seats: fable-2-3

## Handled by the deviation codemod

None. No round-2 seat record solely requests recording a law-forced change. Incidental recording requests attached to the required API migration and bug fixes are central follow-through, not additional required findings or worker-owned ledger/Port-notes edits.

## Rejected

None. Every distinct reported defect has evidence and a concrete fix. The accepted required law/schema findings demonstrate green-gate misses; neither asks to reverse an operator-forced representation. Duplicate seat records are merged, not counted as rejected.
