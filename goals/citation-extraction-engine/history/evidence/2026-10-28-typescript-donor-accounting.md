# TypeScript donor export/test accounting — 2026-10-28

Scope: P0 evidence at the two pinned donor commits. All 5,674 disposition
obligations remain `unresolved` / `audit`; none is claimed as target parity,
adopted behavior or a terminal rejection. P0 and the full goal remain active.

## Authorization and exact source

The earlier explicit authorization for both frozen-lockfile donor suites
continues to apply. Fresh machine-readable runs use those same isolated,
already-installed copies. No new install, lockfile edit, global configuration
change or dependency was introduced.

- eyecite-ts: `34133d03143ea65861f48a5ed0eb32c931581666`, tree
  `f1243d0723cea1e53a5263ef67c9e066230729fc`, version 0.34.2, MIT.
- eyecite-js: `53a49f2412da668aaf262e5f92584c2c3781043b`, tree
  `521fc394d7130f9b21e206d2bf236ffebcca932c`, version 2.7.6-alpha.28,
  BSD-2-Clause.

License and frozen-lock hashes are schema-fixed and agree with the
[source baseline receipt](./2026-10-28-source-baselines.md). The only tracked
post-suite change remains the previously recorded eyecite-ts `llms.txt` build
output. The exporter rejects other tracked/untracked changes. Both original
reference checkouts remain untouched.

## Independent discovery and executable observations

`ops/inventory-typescript-donors.mjs` uses the compiler APIs already installed
by each authorized frozen donor install: TypeScript 5.9.3 for eyecite-ts and
5.8.3 for eyecite-js. The repository's TypeScript 7 package exposes version
metadata without the former JavaScript compiler API, so it is not used as an
AST parser. This maintainer-only tool adds no target runtime dependency.

The tool derives every source entry point from the published package export
map, resolves re-exports through the type checker, and retains declaration
origins, hashes, type/value flags and own public class-member declarations.
Private/protected members are excluded by their declared visibility. A donor
class export still carries its source-bound inheritance declaration; this is
not an assertion that own-member enumeration replaces inherited behavior.

It independently inventories test calls and source `expect` chains. Runtime
locations distinguish a direct call, a modifier such as `.skip`, and the final
registration call in `.each(...)`. Assertion expressions outside direct test
callbacks remain visible with null direct ownership: 16 in eyecite-ts and ten
in eyecite-js. These are source observations, not an exhaustive normalized
operand capture or a claim of 10,229 independently replayed target assertions.

Fresh runner reports bind every actual case to one static registration:

| Evidence | eyecite-ts | eyecite-js |
| --- | ---: | ---: |
| Public exports | 127 | 70 |
| Own public class members | 3 | 188 |
| Static test declarations | 3,850 | 423 |
| Source `expect` chains | 9,134 | 1,095 |
| Runtime cases | 4,862 | 423 |
| Passed | 4,844 | 423 |
| Skipped | 10 | 0 |
| Todo | 8 | 0 |
| Unobserved static declarations | 1 | 0 |

The eyecite-ts source-only declaration is
`tests/integration/expandedCorpus.test.ts:86:11:testDeclaration`: a conditional
`it.skip` registration for fixture rows with `knownLimitation` and without a
performance benchmark. Its pinned 165-row `expanded-corpus.json` has zero
qualifying rows. The branch is retained with the fixture hash, condition
rationale and zero count; it is not silently dropped or reported as passing.
Any other unobserved declaration fails export.

The raw Vitest JSON and Bun JUnit reports stay in the maintainer cache. The
portable fixture retains stable titles, ancestors, status, exact registration
location, declaration ID, per-declaration ordinal and normalized observation
hash. It excludes timing, hostnames, absolute paths and runner start times.
The successful runtime record proves the donor case only. Implementation and
source-level expected behavior still need focused disposition review and
corresponding target regression proof.

## Portable artifact and obligations

`ops/export-typescript-donors.py` validates commits/trees, source and origin
hashes, source cleanliness, exact test-location binding, unique identities,
suite totals and the explicit empty branch. It produces
`packages/law-practice/use-cases/test/fixtures/eyecite/typescript-extensions.json`.
The schema exports only as `CitationTypescriptDonors` from
`@beep/law-practice-use-cases/test`.

Every public export, own public class-member declaration, runtime test case and
source-only branch has exactly one separate disposition obligation. There are
197 + 191 + 5,285 + 1 = 5,674 obligations. Canonical overlap may later be
subsumed with equivalent target proof; a large donor suite does not make a
behavior normative or imply automatic adoption.

The portable checker verifies published subpath coverage, exact pins/licenses,
source and origin hashes, registration ownership/ordinals, observation hashes,
suite summaries, branch classification and exact obligation-set equality.
Terminal rows additionally require rationale and proof; adopted/subsumed rows
require a target test; proof/test paths must exist inside this repository.
Follow-ups require an existing successor goal. The strict `--complete` mode
rejects the current unfinished dispositions. This remains a component of the
future full parity gate, not an alternative completion gate.

## Reproduction and verification

```sh
cd "$EYECITE_TS_ROOT"
NPM_CONFIG_USERCONFIG=/dev/null NPM_CONFIG_IGNORE_SCRIPTS=true \
  pnpm exec vitest run --includeTaskLocation --reporter=json \
  --outputFile="$CACHE_ROOT/ts-runtime-tests.json"
cd "$EYECITE_JS_ROOT"
bun test --reporter=junit \
  --reporter-outfile="$CACHE_ROOT/js-runtime-tests.xml"
cd "$BEEP_CITATION_WORKTREE"
bun run goals/citation-extraction-engine/ops/inventory-typescript-donors.mjs \
  "$EYECITE_TS_ROOT" "$CACHE_ROOT/ts-static-inventory.json"
bun run goals/citation-extraction-engine/ops/inventory-typescript-donors.mjs \
  "$EYECITE_JS_ROOT" "$CACHE_ROOT/js-static-inventory.json"
python goals/citation-extraction-engine/ops/export-typescript-donors.py \
  --cache-root "$CACHE_ROOT" \
  --output packages/law-practice/use-cases/test/fixtures/eyecite/typescript-extensions.json
bun run goals/citation-extraction-engine/ops/check-typescript-donors.ts
python goals/citation-extraction-engine/ops/verify-donor-controls.py \
  --scratch-root "$CACHE_ROOT"
bun run beep quality package-verify @beep/law-practice-use-cases
```

Observed: the portable audit passes; incomplete completion is rejected; all
23 actual-validator corruption controls pass. Controls cover omitted donors,
subpaths, exports, members, declarations, runtime cases and dispositions;
duplicates; stale or mismatched hashes; a registration-location corruption
with a fresh hash; false suite totals; an unclassified empty branch; unknown
or composite states; adopted rows without proof; nonexistent successor goals;
and terminal decisions pointing to absent evidence.

A fresh second compiler inventory and export produce byte-identical fixture
bytes: 13,448,401 bytes, SHA-256
`f61df469c654e5dc82ee81b4a51300f351589afd9406ec59947099a93e4bb1a5`.
Full package audit and docgen pass. Logs are retained beside this receipt.

## Remaining work

Assign source-grounded family and case-level decisions, distinguishing canonical
overlap, unique legal forms, representation conveniences and broader document
analysis. Terminal decisions need applicable target proof or an existing named
successor. Supplemental official-oracle probes, vocabulary-version mapping,
limits/regex strategy, final parity-gate integration, implementation and the
one-PR hosted closeout remain required.
