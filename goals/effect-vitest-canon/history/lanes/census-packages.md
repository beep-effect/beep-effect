# Package Test Census Lane

## Correction completed — 2026-09-08

Orchestrator review identified scope-shape, workspace-ownership, exclusion, historical-comparison,
exact-call, and wrapper-extraction defects in the first P0a output. The corrected live census now
replaces the affected owned JSON artifacts and has passed aggregate and path validation.

- Status: complete
- Model: `gpt-daybreak-blue-latest`
- Effort: `medium`
- Scope: P0a reconnaissance only; package test/spec sources and bounded test support modules.
- Evidence policy: counts and file references are live verified observations unless explicitly labeled heuristic, inference, unresolved, or dated estimate.

## Progress

- 2026-09-08: Created the owned report before discovery.
- 2026-09-08: Read the attached contract from the orchestrator-provided cache copy, including
  section 1.4 and EV001 through EV015 in section 7.
- 2026-09-08: Ran `rg --files packages` with bounded extension and exclusion filters before
  parsing content.
- 2026-09-08: Generated and structurally validated the owned JSON census.

## Outcome

Status: complete for P0a package reconnaissance. No detector implementation, package-source edit,
test, install, configuration change, secret access, or package verification was performed.

Verified live facts on 2026-09-08:

- `research/census/packages/scope.json` is a bare array containing 937 unique rows: 865 `test`
  files and 72 `support` files. Its only kind values are exactly `test` and `support`.
- The rows resolve to 128 actual root-registered package workspaces. No file has an unresolved
  workspace owner.
- Three rows under the embedded `@mock/pkg-*` fixture manifests are correctly owned by the
  containing `@beep/repo-utils` workspace; fixture manifests do not become owners.
- `research/census/packages/` contains 53 class JSON files plus `scope.json`, `wrappers.json`, and
  `summary.json`. All 56 JSON files parse successfully.
- Every class JSON has `class`, `method`, `fileCount`, `occurrenceCount`, `files`, and
  `limitations`; aggregate counts reconcile with its file rows.
- Every EV001 through EV015 candidate file exists, including the empty live EV015 candidate set.
- `wrappers.json` contains 136 balanced `withXyz` function declarations across the owned scope and
  call inventories for 101 distinct `withXyz` names. Every definition has `name`, `file`, `line`,
  `endLine`, `body`, `resourcesAcquired`, and `layersBuilt`; `body` holds the complete declaration.
  The syntax-only candidate tags identify 115 resource-wrapper candidates and 21 pure-data helper
  candidates. The latter are retained but are not asserted to acquire resources.

## Live headline counts

Counts below are verified lexical observations from the generated class files. Format is
`files / occurrences`.

| Class | Live count |
| --- | ---: |
| `@effect/vitest` imports | 757 / 757 |
| `@effect/vitest/plain` imports | 0 / 0 |
| plain `vitest` imports | 133 / 133 |
| `it.effect` | 456 / 3,247 |
| `it.live` | 33 / 166 |
| `it.layer` | 24 / 48 |
| `it.flakyTest` | 0 / 0 |
| `it.prop` | 1 / 2 |
| `it.effect.prop` | 1 / 1 |
| `fc.assert` | 292 / 450 |
| `Effect.runPromise` | 96 / 947 |
| `Effect.runSync` | 60 / 408 |
| `Effect.runFork` | 1 / 1 |
| combined Effect runners | 148 / 1,356 |
| exact `Effect.provide` | 108 / 206 |
| `Effect.scoped` | 125 / 236 |
| `Effect.exit` | 114 / 510 |
| `Effect.result` | 13 / 28 |
| `@effect/vitest/utils` imports | 1 / 1 |
| Option/Result/Exit-like `expect` candidates | 384 / 3,299 |
| files with `it.effect` and `expect` | 433 / 16,386 `expect` calls |
| files with `it.effect` and `assert.*` | 39 / 925 `assert.*` calls |
| `withTempDirectory` | 38 / 472 |
| `withTempWorkingDirectory` | 26 / 221 |
| `withTempRepo` | 7 / 90 |
| `withAdmissionTempRoot` | 1 / 90 |
| `withEnvVar` | 6 / 69 |
| `BunFileSystem` or `NodeFileSystem` | 64 / 215 |
| Node filesystem imports | 1 / 2 |
| `os.tmpdir`/Node OS candidates | 7 / 10 |
| `Effect.sleep` | 12 / 33 |
| `TestClock` | 27 / 90 |
| `vi.mock` or `vi.spyOn` | 13 / 16 |
| retry/attempt heuristic | 57 / 589 |

## EV candidate census

These are candidate inventories, not detector findings. Format is `files / occurrences`.

| Rule | Live candidate count | Evidence status |
| --- | ---: | --- |
| EV001 | 148 / 1,356 | conservative lexical runner calls; callback nesting unresolved |
| EV002 | 75 / 173 | exact provide calls in effect/live files; semantic heuristic |
| EV003 | 143 / 1,637 | broad `withXyz` call-like tokens, including declarations |
| EV004 | 92 / 199 | file-level effect-test plus `Effect.scoped` intersection |
| EV005 | 13 / 28 | all `Effect.result` calls; assertion intent unresolved |
| EV006 | 384 / 3,299 | broad Option/Result/Exit-like `expect` heuristic |
| EV007 | 292 / 450 | `fc.assert` in files containing property constructors |
| EV008 | 9 / 17 | effect-test file with sleep/Schedule and no file-level clock adjustment |
| EV009 | 21 / 88 | `it.live` lacking direct lexical live-service markers |
| EV010 | 67 / 220 | platform/raw filesystem and temporary-directory candidates |
| EV011 | 117 / 117 | plain Vitest import plus lexical Effect import |
| EV012 | 13 / 16 | all mock/spy sites; Effect-service target unresolved |
| EV013 | 57 / 589 | intentionally broad retry/attempt judgment inventory |
| EV014 | 24 / 48 | bounded-window `it.layer` calls lacking a timeout token |
| EV015 | 0 / 0 | file-level `it.layer` plus `TestClock.adjust`/`setTime` intersection |

## Method and scope

Verified method:

1. Used `rg --files` first to enumerate package candidates.
2. Included supported-extension files named `*.test.*` or `*.spec.*` as `test`, plus every
   remaining `packages/**/test/**/*.ts` candidate as `support`.
3. Expanded the root `package.json` workspace registrations and assigned ownership from the
   nearest registered workspace root. Nested fixture manifests were not considered workspaces.
4. Read only the resulting package test/support files and package manifests.
5. Used bounded lexical line scans, a syntax-like brace/statement balancer for complete wrapper
   declarations, and a ts-morph syntax-only project for exact `Effect.provide` `CallExpression`
   nodes. The project used `skipAddingFilesFromTsConfig`; no type checker, `getType`, or full
   tsconfig project was used.
6. Reconciled every class aggregate against its file rows and checked all generated JSON by
   parsing it again.

Verified explicit exclusions are exactly the D9 set relevant to discovery: `scratchpad`,
`.claude`, `goals`, `explorations`, `docs`, and `node_modules`. Ignored artifacts are absent by
`rg --files` discovery. Directories named `build`, `generated`, or `vendor` were not excluded by
name; a targeted `rg --files` check found no package test/support candidates beneath those names.
The two owned output locations are necessarily outside the package-source read scope.

The initial in-generator attempt to spawn `rg` failed with a sandbox `EPERM` despite returning
enumeration output. This is a verified tooling failure. Final generation instead consumes the
successful standalone `rg --files packages` discovery directly over standard input. No count was
inferred from the failed subprocess.

## Discrepancies and limitations

- Corrected comparison: the dated 2026-09-04 value 945 was apps plus packages test files, not a
  package-only value, and support files were not part of that count. It is therefore not compared
  with this lane's 937 total rows.
- The live package-only `test` count is 865, exactly matching the orchestrator's provisional 865
  package tests. The additional 72 rows are explicitly classified `support`. The provisional app
  and infra counts are outside this lane.
- The nested generated `@pulumi/gharunners` SDK is under `infra`, outside the packages lane. Root
  workspace registration makes its actual owner the `infra` workspace, not the nested SDK
  manifest. Its generated-SDK-test limitation must remain in the apps-infra lane; this packages
  census neither drops nor claims that file.
- Counts are line-oriented lexical observations. Comments, strings, aliases, multiline syntax,
  imported helpers, and nested callback boundaries can produce false positives or false negatives.
- EV001, EV002, EV004, EV008, EV009, EV011, EV014, and EV015 use file-level or bounded-window
  proximity and do not establish lexical callback/block ownership.
- EV002 does not distinguish pure `Layer.succeed`/`Layer.mock` stubs from non-stub layers.
- EV006 is intentionally broad because value types and aliases were not resolved. Its 3,299 rows
  are candidates for later semantic narrowing, not 3,299 verified violations.
- EV010 does not decide whether a test genuinely asserts platform lifecycle behavior.
- EV012 does not decide whether a mock/spy target is an Effect service.
- EV013 includes comments, descriptions, library APIs, and legitimate domain retry behavior; it
  is a judgment queue, not a violation count.
- Wrapper discovery covers named function declarations, const arrow functions, and
  `Effect.fn`/generator forms. String/comment-aware brace and statement balancing stores every
  discovered complete declaration. Resource and layer arrays and the candidate tag remain lexical
  evidence, not semantic proof.
- Dated estimate: no duration estimate or detector precision estimate was fabricated; later AST
  detector work is explicitly outside P0a.
