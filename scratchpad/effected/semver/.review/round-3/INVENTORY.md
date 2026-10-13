# semver — round-3 merged inventory

Seats read: `grok.md` (4 findings), `sol.md` (3), and `fable.md` (3), with the adjacent `BRIEF.md` and `BRIEF.grok3.md`. There are no `part-N` reports. The `fable` report identifies its actual fallback route as a separate Grok 4.7 medium seat. Review commit: `3ad7b305790c7f0903f6d55766c55186745ba2d1`. Oracle: the briefs' pinned `af7566a9da2eff169cb74955efcc5ede1e5de9f8` semver package.

**REQUIRED: 4  BACKLOG: 0  CODEMOD: 0  REJECTED: 0  GROUPS: 1**

Ten seat records merge into four findings. The complete operator revision block, including the 2026-10-09 rulings and later grilling, D1–D20, sections 12.4/12.5 and 14, and the merge task's explicit overrides govern classification. The task defers documentation, JSDoc, coverage and vitest-canon findings despite the briefs' S2/S3 completion claims. Bug regressions and corrections to existing incorrect expectations remain part of the required runtime fixes; they are not coverage-floor findings.

The live checkout is `@lab/effected-2`, rather than the requested `@lab/effected`; no branch was changed. Read-only `git diff 3ad7b305790c7f0903f6d55766c55186745ba2d1 -- scratchpad/effected/semver scratchpad/test/semver` is empty. No tests, gates, diagnostic scripts, session/ledger commands or cache-refreshing graph commands were run. Runtime differential results below are attributed to the seats; source, standards, the pinned oracle, installed node-semver source and commit history were inspected directly.

The current `standards/effect-laws.allowlist.jsonc` has **zero entries for `scratchpad/effected/semver/**`**, so no `allow-<n>` findings are added. Source-path logs show the squashed port checkpoint `7929b1f529` and, for desugar, round-2 fix `d859bbb583`. Available historical step-2 diff `d3ae047218` confirms diagnostic-forced dual overloads, typed array access and parser constructor changes; law diff `03bf79d41b` confirms predicate/import rewrites. Neither changes the defective bounds or wildcard-order handling identified here. The three range bugs exist in the pinned oracle, so they are verified upstream bugs, not unforced lab divergences to restore. The schema interfaces also originate upstream, but their repair is required by the cited schema-first law. No seat submits a standalone forced-change recording request. Central deviation/added-export bookkeeping is not assigned to a fix group.

`g1` owns all four findings: three source files (`internal/desugar.ts`, `internal/grammar.ts`, `internal/order.ts`) and their listed tests. Sharing desugar and public Range regression files requires a single group. No file belongs to another group, and the group is below the six-source-file limit. README Port notes, `PORT_LEDGER.json`, root/package manifests, lockfiles and repository configuration are excluded.

## Required

### grok-3-1 — Strict partial-version upper bounds omit the minimum prerelease sentinel

- file: scratchpad/effected/semver/internal/desugar.ts:192; same defect at :212
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); `Range` promises the node-semver range dialect.
- evidence: Sol's read-only differential probes report that both lab and pinned oracle normalize `>=1.0.0-alpha <1.x` to `>=1.0.0-alpha <1.0.0` and accept `1.0.0-beta`; node-semver produces `>=1.0.0-alpha <1.0.0-0` and rejects it. The same split occurs for `>=1.2.0-alpha <1.2.x` and `1.2.0-beta`. Direct source inspection confirms bare stable `sv(major, 0, 0)` and `sv(major, minor, 0)` in the two partial `<` arms. Installed `node_modules/semver/classes/range.js:470–472` sets `pr = '-0'` for this rewritten strict upper bound. `scratchpad/test/semver/internal/desugar.coverage.test.ts:36` explicitly expects `<1.0.0` and `<1.2.0`, proving a green-suite miss. Pinned oracle desugar.ts:135–157 contains the same defect. This is distinct from the closed round-2 strict full-wildcard bug.
- failure: A comparator elsewhere in the set can grant the boundary tuple prerelease permission, causing matching, filtering, maximum selection and cache resolution to admit versions the dialect excludes. The demonstrated comparator sets should match no version.
- fix: Pass `[0]` in both partial `<` arms: `sv(major, 0, 0, [0])` and `sv(major, minor, 0, [0])`. Correct the two existing internal/desugar.coverage.test.ts expectations. Add public Range.parse/membership/filter/maxSatisfying and VersionCache.resolveString regressions for `<1.x`, `<1`, `<1.2.x` and `<1.2` with a lower prerelease comparator granting the same tuple. Preserve concrete-version comparison behavior and diagnostic-forced overloads. Do not route malformed `<1.x.2` through this expansion; grok-3-3 requires its rejection. The orchestrator records the verified upstream-bug deviation centrally.
- seats: grok-3-1; sol-3-1

### grok-3-2 — Caret and hyphen floors retain components after a wildcard

- file: scratchpad/effected/semver/internal/desugar.ts:98; related lower-bound construction at :246
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); node-semver caret and hyphen expansion semantics.
- evidence: Sol's differential probes and both other seats report `^1.x.3` becomes `>=1.0.3 <2.0.0-0` in lab and oracle, rejecting `1.0.0`; node-semver produces `>=1.0.0 <2.0.0-0` and accepts it. `^1.x.0-alpha` wrongly admits `1.0.0-alpha`, and `^0.x.5` wrongly floors at `0.0.5`. Hyphen examples include `1.x.3 - 2` rejecting `1.0.0`, `*.1.3 - 2` rejecting `0.0.0`, and Fable's `x.2 - 1.0.0` rejecting `0.1.0` that node-semver accepts. Direct inspection confirms the caret `lower` retains `patch`/prerelease despite a null minor, and the hyphen `lowerVersion` independently substitutes zeros without discarding later components. Pinned oracle desugar.ts:62 and :170 has the same expressions. Installed range.js:356–359 and :514–524 stop at the first wildcard and retain prerelease suffixes only on fully specified lower endpoints. The property generator at internal/desugar.property.test.ts:13–20 generates only trailing omissions and cannot expose these inputs. Tilde already discards the suffix on a null minor. This is distinct from the closed round-2 wildcard-major caret ceiling.
- failure: Later numeric components incorrectly tighten caret/hyphen lower bounds, excluding allowed stable versions. A retained prerelease suffix can also grant tuple permission the wildcard expansion should not create.
- fix: For caret with null minor, construct the lower bound as `major.0.0` with an empty prerelease and retain the existing upper-bound rules. For hyphen lower endpoints, discard every component following the first wildcard and retain prerelease identifiers only when all three numeric components are specified. A null major imposes no lower restriction: omit that lower comparator when an upper bound exists, preserving the existing stable-wildcard normalization for a fully unbounded range. Keep partial-upper expansion unchanged. Add internal expansion and public Range.parse/membership regressions for the cited examples, including `x` and `*` spellings, `^1.*.2`, `^0.*.2`, `x.2.3 - 2.0.0`, and `1.x.2 - 2.0.0`, with stable inclusion and prerelease exclusion assertions. Do not apply the primitive rejection rule to caret, tilde or hyphen sugar. Preserve diagnostic-forced overloads. The orchestrator records the verified upstream-bug deviation centrally.
- seats: grok-3-2; sol-3-2; fable-3-2; fable-3-3

### grok-3-3 — Primitive X-ranges accept a concrete component after a wildcard

- file: scratchpad/effected/semver/internal/grammar.ts:402; affected expansion branches at scratchpad/effected/semver/internal/desugar.ts:171,177
- class: bug   severity: required
- standard: D9, D11 and section 14 (`upstream-bug`); node-semver `invalidXRangeOrder` and strict comparator parsing.
- evidence: Both seats trace parsePartial continuing through numeric components after a null component, followed by parseSimple sending the result directly to desugarXRange. Lab and oracle therefore accept `1.x.2`/`1.*.2` as the `1.x` interval and accept `*.1`/`>=*.1` as stable match-all ranges. `>*.1` is accepted as an unsatisfiable range rather than rejected. Direct inspection confirms the absent primitive-path guard and pinned oracle grammar.ts:353–379 follows the same path. Installed range.js:280–283 identifies ill-ordered wildcards, :414–416 leaves the invalid comparator text unchanged, and comparator.js:40–41 throws `Invalid comparator` for it. Existing property spelling drops the patch when minor is null, so these malformed strings are absent from the green suite. Caret, tilde and hyphen deliberately use separate suffix-discard semantics.
- failure: Range.parse successfully accepts inputs the advertised dialect rejects; the resulting range either grants unintended membership or silently matches nothing.
- fix: In parseSimple's primitive optional-operator arm only, after parsePartial and before desugarXRange, fail when `(major === null && (minor !== null || patch !== null)) || (minor === null && patch !== null)`. Use the parser's existing typed failure route. Add public parse rejection regressions for `1.x.2`, `1.*.0`, `1.*.2`, `*.1`, `*.1.2`, `x.1`, `x.1.2`, `>1.x.2`, `>=*.1` and `>*.1`, plus internal grammar regressions. Retain controls accepting `1.x`, `1.x.x`, `1.2.x`, `*`, `~1.x.2` and `^1.x.2`; hyphen and caret membership must follow grok-3-2. The orchestrator records the verified upstream-bug deviation centrally.
- seats: grok-3-3; fable-3-1

### sol-3-3 — Reused parser domain models lack schema sources of truth

- file: scratchpad/effected/semver/internal/order.ts:27; related interface at :74 and scratchpad/effected/semver/internal/desugar.ts:18
- class: schema   severity: required
- standard: AGENTS.md Code Laws, “Use schema-first domain models”; standards/effect-first-development.md EF-33; standards/schema-first-development-prompt.md, Core Modeling Contract → Schema owns pure data. EF-12b additionally prefers named intermediate schemas.
- evidence: Direct inspection confirms exported pure-data interfaces VersionParts, ComparatorParts and PartialParts with no same-name schema values; the pinned oracle also defines these interfaces. They are shared parser/comparison/desugaring records, not service contracts, overloads or type-level transforms. Sol's runtime export probe confirms their absent schema values. Existing internal order, grammar and normalize property generators independently declare version/comparator structs. EF-33 requires a schema when a domain model can be expressed as one, and the Core Modeling Contract reserves plain interfaces for other categories. The four green Beep law gates do not enforce this model requirement; README's existing schema-first deviation only covers LiteralKit domains and the equality guard.
- failure: Three reusable pure-data domain models remain interface-authored instead of schema-derived, violating the schema-first contract and duplicating structural definitions in consumers.
- fix: Define annotated structural schemas named VersionParts, ComparatorParts and PartialParts and derive their same-name types. Use composer identities and field annotations. Keep the parser's plain-object representation, numeric/null intermediate semantics and cycle-free dependency direction; preserve final SemVer validation at its existing boundary rather than adding earlier decoding/throws or changing overflow behavior. Reuse these schema shapes in the existing internal order, grammar, normalize and desugar property generators while preserving their bounded valid-input constraints and existing assertions; add focused structural-schema/metadata regressions in the internal order/desugar tests. This is a model-law repair, not an instruction to expand coverage, alter canon, or replace the property floor. Added-export/deviation bookkeeping remains central.
- seats: sol-3-3; grok-3-4
- disposition: Grok labels this backlog based on EF-12b's preference wording. Sol cites the stronger AGENTS.md, EF-33 and Core Modeling Contract requirements. The merged finding is required under D11; its model implementation is missing, so it is not a codemod-only request to record an already-correct change.

## Backlog

None. No round-3 seat finding is solely documentation, JSDoc, coverage, vitest-canon, performance opinion, or a repair outside the port's write surface. Earlier round-2 backlog remains outside this round's counts.

## Handled by the deviation codemod

None as standalone findings. Law-forced deviation and added-export recording associated with the schema repair is centrally owned and excluded from the required write surface. The three verified upstream-bug records are likewise routed to the orchestrator; their actual runtime defects remain required above.

## Rejected

None. Each merged finding has concrete source evidence, a concrete fix and a cited D11 basis. The semantic bugs demonstrate holes in the green suite, and the schema model rule is not enforced by the four green Beep law gates. Duplicate seat records contribute evidence and seat IDs rather than separate rejected findings.
