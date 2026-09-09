# P0.5 MemoryFileSystem core promotion

Status: assigned core implementation and scoped verification complete; ready for Root's
independent review. Node and Bun each pass 50/50 promoted public-boundary tests, and full
test-utils package verification passes. See the final handoff below for files, closure,
commands and hashes. The initial stopped-lane observations remain historical only; Root's
completed boundary qualification permits scoped source/publish acceptance while retaining
the inherited workspace wildcard limitation. No phase/publication state changed.

Root accepted the corrected current-core Node/Bun 21+17+12 proof under original D8.
This lane owns only the new test-utils MemoryFileSystem source/tests, its exact export
entries, directly attributable canonical generated configuration, this report and new
private evidence. Scratchpad, prior evidence, conformance helper, platform patch,
dependencies and other package source remain unchanged.

Session permissions: unrestricted filesystem, approval never; no managed-profile mismatch.
Source commands use sibling `../effect-vitest-filesystem` explicitly, with Bun 1.4.2.

## Initial law/export integration finding (historical, superseded handoff)

- Reviewed completed readiness/characterization/correction handoffs, actual Resource charter,
  shared lane contract and SPEC D8/D9/D14. Historical copy-choice language is superseded;
  accepted green conformance is not being re-gated.
- Effect-first/schema-first skills and export JSDoc law govern the implementation. No vendor waiver.
- Required architecture command ran before any role creation: `beep architecture --help` and
  `beep architecture plan --help`. Plan supports slice/concept/domain-kind/stage, not an existing
  test-kit helper. No product slice was invented. Minimum remains `.test-kit.ts` + curated `index.ts`.
- Canonical `beep tsconfig-sync --dry-run --filter @beep/test-utils` exited 0: no changes.
- **Potential ownership obstacle under verification:** generated root `tsconfig.json:70` retains
  `@beep/test-utils/* -> .../src/*`. Null-export handling in
  `TsconfigSync.plan.ts:517–529,564–591` drops a blocked subpath rather than generating a barrier.
  Existing `./ConformanceLedger/*: null` is a directly comparable live source/publish boundary.
  A new private read-only resolver probe will test whether TypeScript bypasses that existing block.
  No package/export/config changes have been made; generator/law source is outside this ownership.
- Graft could not resolve private `copyEntryUnlocked`; live source is used, without rebuilding.

## Confirmed obstacle: null exports are bypassed by workspace aliases

Live control: `test-utils/package.json:17–18,82–83` already exposes exactly the
ConformanceLedger facade and blocks `./ConformanceLedger/*` in source and publish maps.
The private module exists at `src/ConformanceLedger/ConformanceLedger.test-kit.ts`.
The public alias resolves correctly in every probe. The blocked deep alias does not stay blocked:

| Resolution route | Extensionless private import | Explicit `.ts` private import |
| --- | --- | --- |
| TypeScript, actual root NodeNext options | unresolved (extension rule) | **resolves private source** |
| TypeScript, same aliases + Bundler mode | **resolves private source** | **resolves private source** |
| Node v24.20.0 `createRequire.resolve` | rejected, `ERR_PACKAGE_PATH_NOT_EXPORTED` | rejected, same code |
| Bun 1.4.2 `createRequire.resolve` | **resolves private source** | **resolves private source** |

- Probe: `.beep/p05-core-promotion/alias-boundary.mjs`, no source/config/manifest edits.
  The first run tested extensionless imports; the expanded run added `.ts` and Bundler to
  distinguish extension enforcement from real export blocking. Both raw expanded outputs and
  the initial observations are retained separately. No baseline test or expectation was changed.
- Root generated wildcard `tsconfig.json:70` supplies the bypass. `TsconfigSync.plan.ts:505–529`
  ignores null targets; `:560–591` retains the positive package wildcard with no blocked-subpath
  entry. `repo-utils/src/schemas/TsconfigAliasTargets.ts:223–231` represents null as absence.
- Existing Vitest shared routing also builds aliases from `vitest.aliases.generated.json`
  (`vitest.shared.ts:82–106`); its test-utils wildcard likewise targets all `src/*`.
  No Vitest negative-import execution is claimed from this resolver probe alone.
- Static law concern, not a fabricated lint result: `Laws/EffectImports.ts:533–545`
  lets a positive wildcard establish coverage without honoring a more-specific null block.
- Adding the authorized `./MemoryFileSystem` and `./MemoryFileSystem/*: null` pair cannot fix
  this inherited wildcard behavior: it is the same live export pattern just reproduced.
  Removing the package-wide wildcard would change other exports and is forbidden. Hand-authoring
  aliases, sentinel files or a private resolver bypass is also outside the authorized solution.
- **Root action needed:** assign canonical blocked-export precedence across alias generation/
  consumption and the import law, including extension-qualified NodeNext imports, Bundler mode,
  Bun and Vitest. Relevant source is repo-cli TsconfigSync/Laws, repo-utils alias targets and
  shared/generated alias routing. This lane may not repair those sources. Once that integration
  can reject deep private consumers while preserving public aliases, resume the same promotion.
  This is not a new approval gate for D8 or a request to waive privacy; it is an unmet named
  implementation requirement that cannot be met within current authored ownership.

## Work retained and remaining implementation

- No promoted source, tests, export entries or generated config were authored. No semantic change
  was made. The reviewed schema/helper extraction and complete public facade remain unfinished.
- Core inventory still contains **25 supplied FileSystem.make primitives**, without the optional
  inspection extension. Fresh method definition/wiring anchors are in private `core-closure-and-routing.txt`.
  Primitives: access, copy, copyFile, chmod, chown, glob, link, makeDirectory,
  makeTempDirectory, makeTempDirectoryScoped, makeTempFile, makeTempFileScoped, open,
  readDirectory, readFile, readLink, realPath, remove, rename, stat, symlink, truncate,
  utimes, watch, writeFile. Upstream-derived helpers must remain part of the promoted result.
- Public constructor is `volume.ts:2820`, layer `:3027`, FileSystem.make wiring `:2761–2788`;
  remove only the inspection extension and `currentState` declaration/implementation (`:185,:2705`).
  Keep the accepted copy source-path arm `:1352`, called only at `:1439`.
- Model/reuse plan remains the reviewed one: `$TestUtilsId`, LiteralKit, HasNullByte, precise
  local numeric constraints and pinned Schema HashMap/UTC/bytes/tagged cases; technical handles,
  generic transactions and mutable watcher/worklist machinery are not fake data schemas.
- Locks, commit/event atomicity, scope/interruption behavior, buffers, signed cursor, numeric
  defaults, code-unit versus locale sorts, parser rules/bounds and all 25 methods remain unchanged
  in the accepted scratchpad source. This is source preservation, not proof of an unbuilt promotion.

## Commands, integrity and handoff limit

All commands ran in the source worktree. Runtime/CLI commands used command-scoped Bun 1.4.2 PATH.
Exact initial commands/output remain in the lane's private cached receipts.

- `bun run beep architecture --help`: exit 0; `... architecture plan --help`: exit 0.
- `bun run beep tsconfig-sync --dry-run --filter @beep/test-utils`: exit 0, no changes.
- `node .beep/p05-core-promotion/alias-boundary.mjs`: exit 0, reports the boundary defect above.
- `bun .beep/p05-core-promotion/alias-boundary.mjs`: exit 0, same TypeScript results plus Bun bypass.
  These are resolver observations, not full compiler/Effect diagnostics or Memory Vitest proof.
- Before/after manifests contain **913 identical hashes**, including scratchpad core/facade/barrel/
  regressions, unchanged conformance and characterization, test-utils/repo-cli files, alias-generator
  helper, root configs/aliases, lock and platform patch/source/dist. No captured input changed.
- Core remains `3263694ece7deb17136ac0602e2b93d4cade06393e1d29cac1cadc56701c6084`;
  regression remains `302436cd5f9d3fee057c76dbf980841d7d6c8b1000ce754ae0c8bfb9ca81dacb`.
- No new-module 21+17+12 tests, compiler/lint/architecture/export/docgen gates or full
  `package-verify @beep/test-utils` were run: there is no promoted implementation or package edit
  to verify yet. Root's accepted scratchpad 50/50 per runtime and prior package proofs remain
  separate, unchanged evidence; they cannot establish promoted-module acceptance.
- Remaining: Root-owned alias/law integration; complete assigned core/schema/helper promotion and
  graduated public tests; Node/Bun 50-case proof, strict repository gates and full package handoff;
  independent Root review/publication gates. No deletion, P1/P2, inbox operation or git mutation.

Inspection friction: a packet PLAN read in the source checkout failed because that packet lives in
the primary worktree; it was then read at the correct location. Missing alternate test config names
were replaced by inspection of the existing configs, not by creating files. Exact receipts are private.

## Resumed implementation progress

- Core role and curated index now authored; optional inspection/currentState and the large facade
  are not promoted. Stored inode/descriptor/state/policy/parser shapes now derive from annotated
  schemas, keeping technical handles/transactions/watchers/worklists separate.
- Exact source/publish MemoryFileSystem exports and null deep subpaths are added. Canonical
  tsconfig-sync dry run showed only one root alias addition; applying it changed only root tsconfig.json.
  Existing wildcard behavior remains under Root's separate final qualification, not silently waived.
- First repository check exposed an introduced private mechanical-helper bug: prototype lookup
  mistook numeric `.toString(36)` for an array helper and emitted invalid syntax (TS1005).
  Repaired that one emission and the private transform lookup; baseline source was never changed.
  Strict compiler iteration and public test graduation continue; no green promotion claim yet.
- Repository tsgo then passed with Effect diagnostics. First promoted Node runtime run was
  20/50: an introduced over-escaped name regex rejected digit-zero names, including temp tokens.
  The original guard accepts these names. Fixed the schema constraint, not the tests, using
  the existing HasNullByte guard and exact dot/separator checks; retained node-1 JSON/log.
- Final authored core passes all 50 promoted public-boundary cases on actual Node v24.20.0
  and Bun 1.4.2: 21 conformance (both defaults true), all 17 graduated regressions and all
  12 retained characterization cases, zero skips/expected failures. Sharing order is suite-local.
- Full canonical `package-verify @beep/test-utils` exited 0: audit 8.7s, docgen 3.1s.
  Audit includes dependency closure build and package build/check/tests/lint. No quick mode,
  assertion suppression, baseline update, P0 acknowledgment or waiver was used.
- Root's completed boundary qualification supports scoped source/publish acceptance under the
  transitional wildcard posture. The inherited workspace bypass stays documented; isolated
  consumer proof for this actual new module is being added before handoff.
- Additional candidate law checks found one root Effect import and nine direct generator
  callbacks. These are introduced style violations, not runtime failures; all were converted
  to the dedicated Effect module and fnUntraced callbacks without moving transaction boundaries.
  First failure logs remain immutable. Strict law/package/runtime checks are being repeated on
  that final adaptation; no suppression or shared policy edit was made.
- Test-typecheck friction: the leaf command exited 0 while its result artifact contained
  exitCode 1 / TS377064 effect(globalConsole), from the copied runtime-identity console prelude.
  The aggregate consumes this artifact; a shell status alone was insufficient proof. Preserved
  the first artifact, moved only telemetry to a new private setup file, and retained all 12
  case bodies/assertions. No compiler diagnostic was disabled; final proof checks the artifact.
- Isolated actual MemoryFileSystem source and publish consumers passed on Node and Bun:
  public facade resolves by both resolver routes, all six deep forms reject by both routes,
  and executable make/layer probes verify independent observable files and scoped temp IO.
  Publish fixture uses the exact publish export map and newly built module artifacts, not
  a fabricated JS stub. Positive TypeScript and byte-integrity checks follow.
- Final artifact check confirms the 25 primitive names/wiring match the accepted core; all
  12 characterization callback ASTs are equivalent (formatting excluded), and all 17 regression
  titles remain. Curated role/index exports are exactly make/layer, with no inspection hook.
- Private proof friction only: isolated source compilation initially lacked Node ambient types;
  the new focused config adds the already installed Node types and passes. Publish declarations
  pass without ambient types. Hash-helper assumptions about trailing commas/formatting and a
  raw scanner's template handling were corrected using parsed config/AST evidence. The generator
  added one alias and only reformatted the adjacent pre-existing last alias; no target changed.
- Fixture creation through text patches added one trailing LF to each of eight build artifacts.
  Preserved first integrity failure; exact mechanical artifact copies now match all eight hashes,
  and publish runtime probes pass again. No package source was repaired for these harness issues.
- Final leaf test-typecheck artifact is exitCode 0/output empty. Full package verification after
  telemetry relocation passed: audit 6.9s, docgen 3.2s. Final focused Node/Bun runs are 50/50,
  zero skipped/todo/expected failures, with runtime identity captured by private worker setup.
- Before/after: 913 -> 918 captured inputs; 911 prior inputs unchanged, two authorized edits
  (package exports and generated root aliases), five new source/test files. Removing the four
  export lines reproduces the exact original manifest hash. Scratchpad/conformance/patch/lock/
  repo-cli and previous private characterization/config evidence remain byte-identical.

## Final implementation handoff — 2026-09-09

Authored package paths, relative to `packages/tooling/test-kit/test-utils/`:

- `src/MemoryFileSystem/MemoryFileSystem.test-kit.ts`: complete 2,997-line private engine.
- `src/MemoryFileSystem/index.ts`: only make/layer re-exports, no root barrel addition.
- `test/MemoryFileSystem/MemoryFileSystem.test.ts`: all 17 graduated regressions.
- `test/MemoryFileSystem/Characterization.test.ts`: all 12 retained cases; callback ASTs unchanged.
- `test/MemoryFileSystem/Conformance.test.ts`: public testLayer(layer), neither default flag overridden.
- `package.json:19–20,86–87`: exact source/publish facade entries and null deep entries only.
- Repository `tsconfig.json:2132`: canonically generated exact alias; adjacent final-alias formatting only.
  No package config/docgen config or shared generated Vitest routing changed.

Private model roles remain colocated with their sole consumer rather than adding artificial
service/config/error modules. Brands/constraints are at core :130–184; inode/descriptor/state/
resolution/clone schemas :187–328; open policy :714–750; parser schemas :2398–2457.
Reuse is live $TestUtilsId, HasNullByte, LiteralKit and Effect Schema/Array/Option/Predicate/
String/Tuple/Order helpers. Inode cases/guards/matching derive from the schema union.
Volume/MemoryFile behavior, generic transitions and mutable watch/worklist contracts remain
technical types, not Unknown-based data schemas. The impossible-state defect is a private
annotated TaggedError; public PlatformError/error/environment signatures stay unchanged.

The promoted closure removes only optional inspect/currentState. It preserves lock boundaries,
interruptible acquisition and atomic commit/events (:2796–2851), scoped finalizers, fresh-volume
allocation, sharing within one it.layer block, byte ownership, inode/link/copy identity, flags,
timestamps, full uint32 mode/owner checks and masking, signed cursor/zero-byte IO, parser escapes/
dotfiles/classes/braces and 256 bounds. Code-unit sorts and locale clone traversal remain distinct.
The en-US allocation characterization is not a universal locale guarantee. No virtual identity
permission enforcement, host fallback, seed/fault/inspect/sync facade or new service tag was added.
MIT notice/disclaimer and pinned provenance survive in both source and built JS; public examples
use the package alias and explain scope/sharing. D1–D14 remain unchanged.

### Exact 25-primitive closure

Definition/wiring lines below are in the new core; old definition lines are in unchanged
`scratchpad/memfs/internal/volume.ts`. AST checks assert the same ordered 25-property make input.

| Primitive | Old definition | New definition | New wiring |
| --- | ---: | ---: | ---: |
| access | 1877 | 2000 | 2903 |
| copy | 1422 | 1529 | 2904 |
| copyFile | 1403 | 1510 | 2905 |
| chmod | 2058 | 2185 | 2906 |
| chown | 2080 | 2208 | 2907 |
| glob | 2606 | 2747 | 2908 |
| link | 895 | 987 | 2909 |
| makeDirectory | 832 | 924 | 2910 |
| makeTempDirectory | 2193 | 2319 | 2911 |
| makeTempDirectoryScoped | 2197 | 2323 | 2912 |
| makeTempFile | 2239 | 2365 | 2913 |
| makeTempFileScoped | 2248 | 2374 | 2914 |
| open | 1866 | 1989 | 2915 |
| readDirectory | 1932 | 2058 | 2916 |
| readFile | 1957 | 2083 | 2917 |
| readLink | 940 | 1032 | 2918 |
| realPath | 956 | 1048 | 2919 |
| remove | 961 | 1053 | 2920 |
| rename | 1010 | 1103 | 2921 |
| stat | 2051 | 2178 | 2922 |
| symlink | 917 | 1009 | 2923 |
| truncate | 2028 | 2155 | 2924 |
| utimes | 2108 | 2236 | 2925 |
| watch | 2717 | 2857 | 2926 |
| writeFile | 1974 | 2100 | 2927 |

Pinned `packages/effect/src/FileSystem.ts:686–768` still supplies the five derived helpers:
exists, readFileString, stream, sink, writeFileString. New public make/layer are :2963/:2997.

### Final proof

| Proof | Result |
| --- | --- |
| Actual Node v24.20.0, promoted public alias | 21 conformance + 17 regressions + 12 characterization = 50 passed; 0 failed/skipped/todo |
| Actual Bun 1.4.2, promoted public alias | Same 50 passed; 0 failed/skipped/todo |
| Full canonical package-verify @beep/test-utils | Exit 0; audit 6.9s, docgen 3.2s; no quick mode |
| Canonical package-owned test tsgo | Command exit 0 AND result artifact exitCode 0/output empty |
| Effect imports candidate / effect-fn / native-runtime | Exit 0; respectively 2 / 1 / 2 source files scanned, no violations/allowlists added |
| Schema-first inventory | Exit 0; 90 live/tracked, 0 missing/stale/advisories; new sources included by filesystem glob |
| Package-test-imports / tsconfig-sync --check | Exit 0; public aliases valid / no drift |
| Isolated source + publish consumers, Node + Bun | Each: public 2/2 resolver routes; six private forms rejected by both routes; observable make/layer IO passes |
| Isolated TS public signatures / private resolution | Source and built declarations compile; six deep forms reject in NodeNext and Bundler |
| Architecture/export/closure private AST proof | Exit 0; test-kit role + curated index, exactly two public values, 25 primitives, eight build artifacts byte-identical |

Runtime commands were `node node_modules/vitest/vitest.mjs run` and
`bun node_modules/vitest/vitest.mjs run`, both with
`--config .beep/p05-core-promotion/vitest-final.config.mjs --configLoader native
--reporter verbose --reporter json --outputFile <private-json> --no-color`.
The private config includes exactly the three new test files, records worker runtime identity,
and adds no timeout/floor/suppression. Only the sharing suite is deliberately sequential.

Other exact command families: `bun run beep quality package-verify @beep/test-utils`;
`bun run --cwd packages/tooling/test-kit/test-utils package-test-typecheck`;
`bun run beep laws effect-imports --check --candidate --include-prefix <new-source-directory>`;
`bun run beep laws effect-fn --check --include <new-core>`;
`bun run beep laws native-runtime --check --include <new-core>,<new-index>`;
`bun run beep lint schema-first`;
`bun run beep lint package-test-imports --include-root packages/tooling/test-kit/test-utils`;
`bun run beep tsconfig-sync --check --filter @beep/test-utils`.
All source commands used the filesystem worktree and command-scoped Bun 1.4.2 PATH.
Exact private commands, paths, runtime identities, case names, first failures and final JSON are
in the lane's private cache handoff.json and logs. Architecture CLI has no applicable test-kit
operation-plan factory: the role review plus executable AST/layout checks are the architecture
evidence, not an invented CLI check. Compiler proof includes actual repository Effect diagnostics.

### Integrity and Root gates

The final re-snapshot still matches all 918 post-change inputs. 911/913 existing inputs are
unchanged; the other two are precisely the manifest and generated alias file. Five files are new.
New core SHA256: `ecdc7da0cfc649d2e1b5cf54687cf9a4afac1446a1eb0f547cfd1043a9f2424f`.
Accepted scratchpad core/regression hashes remain respectively
`3263694ece7deb17136ac0602e2b93d4cade06393e1d29cac1cadc56701c6084` /
`302436cd5f9d3fee057c76dbf980841d7d6c8b1000ce754ae0c8bfb9ca81dacb`.
Detailed manifests include all other package/repo-cli/conformance/patch/config/lock inputs.

Root's `p05-boundary-qualification.md` conclusion (a) supplies the binding transitional
interpretation. This lane proves actual new-module source/publish exports and canonical public
consumers; it does not claim workspace wildcard aliases reject private imports or repair them.
Root still owns independent implementation/integration review, acceptance of that qualified
boundary, incidental tool-artifact disposition, packet phase state and publication/PR gates.
No new copy-choice gate exists. Scratchpad deletion remains unapproved. No merge/phase completion
or adoption in another package is claimed.

Late tool friction: a final Graft query automatically reported refreshing one graph file.
No rebuild/install was requested and no cleanup was attempted outside ownership; Root is notified.
Schema scan eligibility was verified from source glob loading, not a tracked-files-only assumption.
No captured source/config/lock input changed from that query.

## R1 directory-guard repair — verified, Root review pending

Independent preservation review identified introduced full-schema directory validation on
already-typed inode lookup. This bounded repair will use the pinned schema-derived discriminant
primitive at trusted dispatch sites, preserve all models and boundary validation, and refresh
benchmark/runtime/compiler/package/isolated-consumer proof in new private receipts. Prior
promotion receipts remain immutable. P0.5 remains in progress; Root owns review and integration.

- Verified previous implementation process absent; only this resumed repair lane was present.
  Permissions remain unrestricted/never. Effect-first and schema-first skills were applied.
- Pinned and installed rc.112 Schema signatures accept already-typed union values and return
  a narrowed variant (:6231–6233,6417–6419); implementation :6326 reads only the tag and searches
  the supplied discriminants. Full guards at :6353 instead validate the member schema.
- Added three private, module-hoisted isAnyOf predicates and replaced all 58 inode guard uses:
  Directory 44, File 9, SymbolicLink 5. No schema/default/parser/input check or construction
  call was changed. The two parser guards target payload-free Star/Globstar variants and do
  not traverse inode entries; they remain untouched. Strict source tsgo check passed.
- Graft caller lookup found no indexed edges for the type alias; targeted live fallback found
  all sites, including fnUntraced bodies. This query reported no graph refresh.
- Same bounded Bun stat workload after repair: median original/repaired milliseconds were
  0.681/0.686 at 32 siblings and 0.381/0.613 at 1,024 siblings (five rounds of 100 stats,
  one 100-stat warmup each; all 2,400 size assertions passed). The earlier promoted 1,024-wide
  median was 56.564ms. Samples are observations, not thresholds or cross-machine promises;
  source inspection establishes that trusted dispatch no longer scans directory maps.
- Benchmark harness changes only the two import specifiers: original still refers to the
  review's unchanged original snapshot, promoted now refers to live repaired source. It reuses
  the exact review alias config/pins. First invocation used an unsupported --tsconfig spelling
  and emitted no results; retained as non-proof. Correct --tsconfig-override emitted complete
  results/exit 0 and the same inherited Bun directory-mismatch warning as the review. Warning
  is retained, not hidden; no config/version change or timing rerun was used to remove it.
- First full package proof: build/source check/package tests/docgen passed, but audit failed
  because three shortened guard expressions required Biome reflow. Introduced formatting-only
  failure retained in new private package-verify.log; only the owned core was formatted.
  Full verification and the same bounded benchmark are repeated for that final source revision.
  Package-wide tests reported 138 passed/7 existing skips across 14 files; the focused Memory
  scope remains exactly 50 passed/zero skips. No skip or package test was edited.

### R1 final repair evidence

Only `MemoryFileSystem.test-kit.ts` changed in package source. The three hoisted
schema-derived predicates are :220–222; ordinary getDirectory dispatch is :395–402.
All 58 old inode guard references are gone. Pinned/installed Schema source :6326 and actual
installed `dist/Schema.js:3082` implement tag membership only. The complete before/after AST
matches exactly the three hoists + 58 substitutions, apart from comments/formatting:
schemas, defaults, constructors, numeric/path/parser constraints, mutation/lock/scope/error
flow and all 25 FileSystem.make bindings remain intact. Public make/layer remain :2962/:2996.

Final-source benchmark, same operation/order/warmup/round count as review:

| Siblings | Original median ms/100 stats | Repaired median ms/100 stats |
| ---: | ---: | ---: |
| 32 | 0.689 | 0.678 |
| 1,024 | 0.368 | 0.507 |

All 2,400 stat size assertions passed. The final run followed formatter-only source reflow;
both runs' raw five-round samples and inherited warning remain separate immutable receipts.
No timing threshold was introduced and no fastest-round selection or operation substitution
was used. Removing full-map validation addresses R1 structurally; residual constant overhead,
JIT/GC noise and other unmeasured workloads are not claimed eliminated.

Final commands/results (all source commands used the filesystem worktree and Bun 1.4.2 PATH):

- `node node_modules/vitest/vitest.mjs run` and `bun node_modules/vitest/vitest.mjs run`,
  each with `--config .beep/p05-core-promotion/vitest-final.config.mjs --configLoader native
  --reporter verbose --reporter json --outputFile <new-private-json> --no-color`: exit 0.
  Actual Node v24.20.0/Bun 1.4.2 worker identity recorded; each 21+17+12 = 50 passed,
  zero failed/skipped/todo. Tests/configs/options remain unchanged.
- `bun run --cwd packages/tooling/test-kit/test-utils check`: exit 0, strict repository tsgo.
- `bun run --cwd packages/tooling/test-kit/test-utils package-test-typecheck`: exit 0;
  separately inspected result artifact has exitCode 0 and empty output.
- `bun run beep laws effect-imports --check --candidate --include-prefix
  packages/tooling/test-kit/test-utils/src/MemoryFileSystem`: exit 0, two source files scanned.
- `bun run beep laws effect-fn --check --include
  packages/tooling/test-kit/test-utils/src/MemoryFileSystem/MemoryFileSystem.test-kit.ts`:
  exit 0, one source file, zero violations.
- `bun run beep quality package-verify @beep/test-utils`: final exit 0,
  full audit 7.0s/docgen 3.3s, after the final source edit. No quick proof, suppression or waiver.
- New isolated source/publish consumer execution on Node/Bun: exit 0 in all four runs.
  Each exposes exactly make/layer, checks independent observable volumes and scoped temp IO,
  resolves the public facade in both routes, rejects all six deep forms in both routes.
  Original complete export maps and consumer assertions are unchanged; all eight freshly
  built artifacts are byte-copied and hash-matched, not old bytes or a stub.
- `bun x --no-install tsgo -p <new-consumer-config>`: source and published declaration
  consumers both exit 0. New private resolver/AST/hash proof exits 0; NodeNext and Bundler
  each reject all six deep forms for source and publish. As before, no workspace wildcard
  private-rejection claim is made.
- Benchmark uses `bun --tsconfig-override <unchanged-review-config> <new-probe.ts>`.
  Exact commands, executable paths, samples, warnings, first failures, guard-site line map,
  compiler artifact, source diff assertion and refreshed build hashes are in new private
  p05-directory-guard-repair-astra receipts, summarized by handoff.json.

Integrity: **917/918 prior protected inputs unchanged**, with exactly the one authorized core
delta. Core before SHA256 `ecdc7da0cfc649d2e1b5cf54687cf9a4afac1446a1eb0f547cfd1043a9f2424f`;
after `c2bf1cfe1e5e082123800f45791fed8ea008ef405f98d22c7dc98422e083eccd`.
All **175 prior receipt files** captured across promotion/correction/review caches remain
byte-identical. Tests, facade/index, manifests, aliases, scratchpad originals, conformance,
platform patch, lock/config and repo-cli sources are unchanged. Normal ignored build artifacts
were regenerated for this proof; the new publish fixture matches those current bytes.

R1's repair and assigned proof are ready for Root review. P0.5 remains in progress. Root owns
independent acceptance, refreshed-main integration, any inbox disposition and publication;
this lane performed no git/inbox operation, deletion, dependency change, delegation or network
research. The inherited benchmark warning and workspace alias limitation remain explicit.
Graft saved approximately 27,417 tokens in one query in this repair turn.

## Integrated Fallow core repair — active

The integrated-base cheap gate reports 21 Memory complexity findings and two core duplication
groups. This lane will repair all actual rows inside the existing core role, preserve the
accepted R1 behavior/schemas/public surface, and retain new focused evidence. The parallel
conformance writer owns that helper; Root owns aggregate verification, integration and packet.
No package-wide check will run while the writers share the package.

### Recovery and partial implementation

The first Fallow repair process stopped on the model service's capacity error, not a
compiler/test failure or an observation timeout. Root confirmed it absent and saved the
partial source separately. The accepted R1 preimage remains immutable. Allocation and
attachment validation are consolidated; watcher dispatch, path navigation, directory
creation, rename and copy responsibilities have been separated within the same role.
Open-target decomposition was the last submitted edit and is being checked against the
live bytes before continuation. Glob/parser and remaining traversal work still need repair;
no green result or completed implementation is claimed at this recovery point.

Friction: a failed Graft lookup for a `fnUntraced` binding required targeted live-source
fallback. Initial diagnostics used a nonexistent findings key and stale schema barrel
paths; corrected targeted queries found the live files. Oversized JSON output was replaced
with field-selecting queries. Root owns the separately observed Graft integration-file
drift and aggregate inbox; this lane does not modify either.

### Focused implementation evidence (join pending)

All 21 original rows now map to lower-complexity responsibilities in the same role. The
file-only Fallow scan reports maximum cyclomatic 9 and cognitive 8, with no violation of
either live ceiling. That intentionally narrow source root has no test graph: its 38 CRAP
rows are `coverage_tier: none`, not the integrated gate's `partial` estimate. This is retained
as a scope limitation, not called a green aggregate health gate. Core duplication is 0 groups
under the unchanged live Fallow configuration; both original allocation/validation groups
are gone. No threshold, baseline, exclusion or suppression changed.

Actual Node v24.20.0 and Bun 1.4.2 each pass 50/50 (21 conformance, 17 regressions,
12 characterization), zero skips. Focused Effect-enabled tsgo exits 0 with empty output.
Its first run caught two introduced issues: use `Effect.asSome`, and preserve the non-empty
array return type already guaranteed by `A.makeBy`; both were fixed without casts. Biome's
first findings were formatting/member order only and were fixed in the owned core. Focused
Effect import and function-law commands both exit 0.

The first reused direct-Bun width probe failed before measurement in imported GlobalValue
initialization (`self._root.get`), alongside the prior Bun directory-mismatch warning.
The runtime suites pass, so this is being attributed at the isolated harness dependency
boundary before any repair; the failed logs remain immutable. No timing result is claimed
from that attempt. Root still owns the combined-tree full package and cheap-gate proof.

### Integrated Fallow handoff — implementation done; Root join/gates pending

Authored source is only `packages/tooling/test-kit/test-utils/src/MemoryFileSystem/MemoryFileSystem.test-kit.ts`.
Accepted R1 preimage: `c2bf1cfe1e5e082123800f45791fed8ea008ef405f98d22c7dc98422e083eccd`.
Final source: `48548936e9a8c9ef35ba48aedad318ae3458818c6d8653ea9a08608ef4ccfe63`.
The report and new private evidence are the only other authored surfaces. The conformance
writer's helper, all public tests, index, manifests, aliases, locks, patches and scratchpad
originals were not edited. No package-wide proof ran during the shared-package lane.

All 21 original Memory rows are addressed (not the audit summary's erroneous 19):

| Original responsibility / rows | Consolidation and current core anchors |
| --- | --- |
| Watch inclusion, publication, inode paths / 3 | Directory-watch policy, per-watcher delivery; Option-preserving iterative child discovery (`:449`, `:454`, `:475`) |
| Path resolution / 1 | Navigation, symlink following and one-component lookup share the existing walk; root semantics and link bound preserved (`:688`) |
| Directory creation / 1 | Component decision and actual creation/attachment separated; early existing-final return still drops earlier events as before (`:960`) |
| Directory containment and rename / 2 | Iterative enqueue, replacement validation, namespace relocation; timestamp/read/link-count ordering preserved (`:1101`, `:1178`) |
| Copy validation, directory merge, destination resolution, top-level copy / 4 | Conflict validation, child merge, missing-parent/link resolution, clone installation; directory merges still detach before cloning, top-level copies clone before detach (`:1284`, `:1362`, `:1416`, `:1539`) |
| Descriptor opening / 1 | Existing target, missing target, linking/retry, truncation and descriptor allocation; schema-derived Ready/Retry dispatch (`:1775`) |
| Directory listing / 1 | Reused frame creation and Option-preserving descent; same sorted pre-order stack (`:2108`) |
| Whole-file writes / 1 | Event derivation after unchanged descriptor write/close operations (`:2192`) |
| Brace discovery/depth / 2 | Shared code-unit escape/class scanning, balanced-group scan and substitution; original outer-scan class distinction and both 256 bounds retained (`:2618`, `:2637`) |
| Character classes and segment parsing / 2 | Atom read, range compilation, escape/token parsing and explicit-dot matching (`:2725`, `:2763`) |
| Segment/path matching and glob traversal / 3 | Backtracking cursor step, two distinct right-to-left DP row operations, directory selection/worklist (`:2844`, `:2876`, `:2934`) |

Both core clone groups are removed by actual shared operations: `allocateInode` (`:516`)
owns clock/ID/map updates while variant schemas retain construction and file-byte copying;
`validateAttachment` (`:557`) preserves name → parent → existence → inode validation order.
No facade, service tag, role file, public API or filesystem primitive was added/removed.
New private schemas model ResolvedParent, OpenTarget, BraceGroup, GlobMatchCursor and
GlobSelection. ResolutionWalk/GlobWalk remain technical mutable worklists. New dispatch
predicates derive from tagged schemas and are hoisted; R1's original three remain identical.

The complete integrity check preserves all 28 original schema/guard declarations, 13
selected contract declarations (including transaction implementation, handle class,
descriptor IO/close, detach and make/layer), and the complete notice. `toFileSystem`'s AST
is unchanged: **25 bindings**, including watch, glob, both copy operations and all scoped
temp primitives; upstream-derived helpers remain supplied by FileSystem.make. Public
values remain exactly make/layer. There is no intended behavior change.

Final proof after the last source edit:

- Node v24.20.0 and Bun 1.4.2, Vitest 4.1.11, Effect/@effect/vitest rc.112: **50/50 each**,
  comprising 21 conformance + 17 regressions + 12 characterization; zero failed/pending/skipped.
- Focused inherited-config Effect-enabled tsgo: exit 0, empty output; one-file Biome and
  focused Effect import/fn laws: exit 0. These are not the full package/compiler handoff gate.
- File-only Fallow duplication: exit 0, **0 groups**. Structural health: max CC **9**, cognitive
  **8**, no CC/cognitive violations; exit 1 remains solely the documented no-test-root CRAP
  qualification. Under the canonical input's partial estimate even CC 9 is below CRAP 30;
  that is an inference, not a fabricated canonical gate result. Root must rerun in context.
- Additional pinned-Bun Vitest comparison: **2,400 patterns + 6 exclusions + 1 recursive
  ordering case** match the immutable R1 preimage, including exact glob errors and limits.
- Same 32/1,024-sibling benchmark, five rounds of 100 stats plus warmup: original/refactored
  medians **0.585/0.850 ms** at 32 and **0.358/0.649 ms** at 1,024. All 2,400 size assertions
  pass. Small constant overhead is visible; no timing SLA is asserted. Source inspection
  and width observations preserve R1's removal of full directory-map validation.

Benchmark recovery changed only private execution plumbing: pin the existing worktree
node_modules, copy the original snapshot byte-for-byte into a location without its missing
archived tsconfig ancestor, and execute the same measurement body through normal Vitest.
The original hash remains `3263694ece7deb17136ac0602e2b93d4cade06393e1d29cac1cadc56701c6084`.
The initial direct-Bun GlobalValue failure's exact cause remains unqualified; no runtime
state patch, import stub, old-byte rewrite or source workaround was applied. Cache-parent
Vitest selection and missing archived tsconfig were separately proven harness failures.
A private differential assertion import was corrected to pinned `deepStrictEqual`, retaining
its failed first input/log. The first AST census under-counted schemas due to same-name
type-alias shadowing; the complete census explicitly checks each constraint and passes.

Across the final-proof interval **920 of 921 captured inputs remained unchanged**; the
sole delta is final formatting of the owned core. This interval does not replace Root's
earlier integrated attribution. Raw canonical audit/health logs are unchanged. The accepted
preimage, capacity-stop snapshot, previous public suites and all old proof receipts remain.
Detailed exact commands, first failures, test outputs, hashes and complete AST checks live
under the new `~/.cache/beep/effect-vitest-canon/p05-fallow-core-astra-*/` evidence directory (`commands.md`,
`source-integrity-complete.json`, final runtime JSON/logs and input snapshots).

Root remaining gates: join both writers; rerun canonical cheap gates in the integrated
test graph and full `bun run beep quality package-verify @beep/test-utils`; own any required
combined test-compiler/build/consumer proof, attribution, inbox handling and publication.
P0.5 is still in progress; no phase, decision, merge or deletion approval is inferred.
Skills used: Effect-first development, schema-first development, Graft. Query telemetry
reported approximately 202k tokens saved across six Graft calls (one missing binding).
