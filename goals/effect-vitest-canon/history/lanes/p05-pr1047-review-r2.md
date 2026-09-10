# PR 1047 filesystem review R2

Status: bounded R2 remediation and focused proof finished. Four supported defects
are repaired; the watch-method claim is invalid against pinned rc.112. Root's
coverage measurement exited before edits. Root retains package-wide, coverage,
aggregate/hosted verification, review replies, integration and publication gates.

Owned source: `MemoryFileSystem.test-kit.ts`; owned test: `Characterization.test.ts`.
All 13 existing cases, accepted R1 fixes, schemas, guards and public surfaces must
remain intact. Other repository paths are read-only, including the conformance
helper and concurrent coverage lane's separate tests.

Effect-first/schema-first and Graft instructions are being applied. This report
records progressive findings; private preimages, runtime controls and exact commands
will be retained under `~/.cache/beep/effect-vitest-canon/p05-pr1047-review-r2-evidence/`.

## Coverage boundary and source grounding

Root's existing coverage status was already `exited` (exit 1, 13.3 seconds) when first
read; no duplicate run, termination or waiting process was started. Preimages and
protected-input hashes were captured afterward, before source/test mutations.

Graft located the five public primitive bindings and traced each to `toFileSystem`.
It missed fnUntraced `cloneInode`; targeted live reads establish recursive clone and
directory-merge callers. The timestamp helper currently copies mtime but omits atime;
link follows the last symlink; symlink validates null bytes but accepts an empty target;
temporary-file allocation publishes only the file event. Pinned shared Node watch
registration itself first calls `stat(path)`, so the claimed lookup error method defect
requires runtime qualification rather than blindly changing it to `watch`.

## Initial runtime findings

Both actual Node v24.20.0 and Bun 1.4.2 ran 15 observational controls successfully.
Regular-file copy preserves atime/mtime on both platforms; Memory loses atime. Native
directory and symlink inode timestamps are newly allocated, not preserved. Public stat
follows symlinks, so symlink inode observation used native lstat/lutimes only for host
platform controls, never for Memory. The supported fix is regular-file atime; existing
Memory directory/symlink metadata behavior will not be broadened or removed.

Both platforms hard-link the symlink inode, including dangling links; Memory instead
links the target or fails on dangling input. Both reject empty symlink targets without
creating entries; Memory creates an empty link. Both return method `stat` for missing
and NUL-invalid watch registration paths, confirming the method claim is not a defect
against rc.112. Memory's NUL-invalid reason differs (NotFound versus BadArgument); that
pre-existing path-validation difference is recorded, not silently expanded into this
method-only review request.

The first host public-watch event observation raced its async stat preflight and saw
only a later sentinel; those logs remain immutable and are not proof of missing host
events. A new control registers the native watcher used by the pinned adapter
synchronously before public makeTempFile, then waits for its actual child-directory
event. Memory regression tests use its synchronous public registration and a sentinel
event to terminate deterministically, without sleeps or timeout changes.

Qualified host controls again pass on both runtimes. Empty targets fail exactly with
`PlatformError / NotFound / FileSystem / symlink / pathOrDescriptor: ""`. Native
parent watchers, registered before public makeTempFile, receive the created child
directory name. Symlink inode metadata is now sampled before readLink, avoiding its
atime side effect; neither symlink time is preserved by the platforms.

Four minimal source repairs are authored: file-only preserved atime in the existing
clone metadata helper; final-follow false for hard links; a hoisted NonEmptyString
predicate rejecting empty symlink targets before inode creation; directory Create then
file Create in the unchanged temporary-file transaction. Watch lookup code is unchanged.
Cases 14–18 are appended; the first 13 are untouched. Case 18 registers both direct
and recursive public Memory watchers, creates scoped/unscoped temporary files, and
terminates both streams via an explicit sentinel event even against the buggy preimage.

## Focused proof progress

The new cases against the immutable preimage produce four expected failures (atime,
hard-linked symlink, empty symlink, temporary-directory event); the pinned watch-method
case passes. All terminate without sleeps: 4 failed, 1 passed, 13 name-filtered, exit 1.
The repaired source passes 101/101 on both runtimes: the previous 96-case R1 suite plus
five new cases, zero skips. After-controls also pass 15/15 on each runtime.

The focused strict Effect-aware compiler passes with empty output. Actual repository
Oxlint passes both owned files. First Biome found only formatting of two new multiline
timestamp assertions; that output is retained and only those new lines were reformatted.
Final hash/proof receipts follow; Root still owns package-wide and coverage acceptance.

## Final decisions and regression anchors

Paths below are relative to `packages/tooling/test-kit/test-utils/`; `core` means
`src/MemoryFileSystem/MemoryFileSystem.test-kit.ts` and `tests` means
`test/MemoryFileSystem/Characterization.test.ts`.

| Review comment | Disposition and exact protected behavior |
| --- | --- |
| 3966768884 (`PRRT_kwDOPbO_N86gljgs`) | File-only atime preservation added at core:1240. Case 14, tests:385, checks exact requested atime/mtime, default allocation times and copied bytes. No new directory/symlink timestamp promise. |
| 3966768893 (`PRRT_kwDOPbO_N86gljgz`) | Final-symlink following disabled for link at core:1004. Case 15, tests:413, proves alias readLink, unchanged target link count, target removal/recreation independence and dangling-link behavior. |
| 3966768902 (`PRRT_kwDOPbO_N86gljg6`) | Hoisted `S.is(S.NonEmptyString)` at core:167; empty target fails through existing NotFound route at core:1030 before inode allocation. Case 16, tests:438, checks exact typed payload, empty listing and allocation parity with an independent fresh volume. Existing NUL/parent error ordering stays intact. |
| 3966768917 (`PRRT_kwDOPbO_N86gljhF`) | No source repair: watch lookup at core:3037 correctly retains stat. Case 17, tests:458, locks missing-path NotFound/stat/path. Pinned platform preflight and both runtime controls agree. |
| 3966768927 (`PRRT_kwDOPbO_N86gljhL`) | Core:2470 emits directory Create before file Create in the same transaction. Case 18, tests:474, checks direct/recursive event sequences for scoped and unscoped creation, resulting directory/file contents and scoped cleanup. Sentinel-driven completion also works against the preimage. |

Reference source is exclusively the rc.112 cache at the supplied pinned revision
`2600f62f4532026928454dcea8d1c48557b3f942`: `packages/effect/src/FileSystem.ts:94`
defines copy/options; `packages/platform/node-shared/src/NodeFileSystem.ts:56`
delegates to native cp with preserveTimestamps, :121 delegates hard links, :394 creates
the temp directory then file, :519 delegates symlink and :598–613 forwards stat
preflight failures into watch. `packages/platform/bun/src/BunFileSystem.ts:20` uses
that shared layer. Runtime evidence, not an inferred universal POSIX rule, qualifies
the file-versus-directory/symlink timestamp decision.

## Final proof and integrity

Exact reproducible commands, file selectors and exit classifications are in private
`commands.md`; final outputs are retained without replacing first-failure evidence.
All commands used the filesystem worktree. Node was the installed nvm v24.20.0;
Bun was installed 1.4.2 invoked with `--bun` through Vitest 4.1.11, never `bun test`.
Private logs record executable/runtime identity. Bun's Node-compatibility version
string is not claimed as a second actual Node runtime. Pins remain rc.112.

| Proof | Final result / retained evidence |
| --- | --- |
| Actual Node, live package Vitest config, six explicit R1 files | Exit 0; 101/101, zero failed/skipped; `node-final.log/json`. |
| Actual Bun, identical config/selectors | Exit 0; 101/101, zero failed/skipped; `bun-final.log/json`. |
| Composition on each runtime | 21 Node + 21 Bun + 21 Memory conformance, 17 existing Memory regressions, 18 characterization and 3 write-compatibility cases. No conformance options changed. |
| New cases against immutable original core | Intentional exit 1: 4 failures, watch case passes, 13 filtered by explicit name selection; `node-before-regressions.log`. This is regression sensitivity, not a green run. |
| Qualified platform/Memory observations | Exit 0, 15/15 per runtime before and after repair; `*-controls-qualified.log`, `*-controls-after.log`. First raced observation logs remain preserved and qualified above. |
| Focused strict Effect-aware `tsgo` | Exit 0, final output empty; private config extends live package check config and includes both owned entries/import closure; `compiler-final.log`. |
| Actual repository Oxlint config, two owned files | Exit 0; `oxlint.log`. Exact S.Int/S.Finite guard hoists and schemas unchanged. |
| Focused Biome after two new-assertion formatting repairs | Exit 0, two files checked, no fixes applied; `biome-final.log`. First formatting-only exit 1 remains `biome-first.log`. |
| Effect fn law, owned core | Exit 0, one file, zero violations; `effect-fn.log`. |
| Effect import law, MemoryFileSystem source prefix | Exit 0, two files, zero changes/manual reviews; `effect-imports.log`. |
| Structural/raw-text and protected-input integrity | Exit 0; `integrity-final.json/log`, before/after hash lists and exact text diffs. |

Final source hashes, rechecked at handoff:

| File | Before SHA256 | After SHA256 |
| --- | --- | --- |
| core | `7fb3466b8adf7eba2666c03bf94386c0147b50e2dc602b70fa13b3d41602c1b9` | `4993bd3b1d5cd8d0a0765c80f2ad2e81a6ecc80ecb19d396a7f0ecaad6e45566` |
| tests | `b0a340125d63cc8d963c962330425fa7433e9cbfdf4dff9ba62c865cb804a03c` | `9147f5afdc56fa87bbc0ab39cd1d52e9526deb125ce3c43bf475e41284d01d89` |

Among 369 captured inputs, exactly these two owned files differ; no other captured
delta was found. This does not claim ownership or an inventory of newly created
concurrent coverage files. All 13 original callback texts are identical; five cases
are appended. The comparison preserves 258 other top-level core declarations,
the full MIT header, all 25 FileSystem.make primitive bindings and exactly make/layer
public values. It explicitly checks unchanged MemoryFile/open cursor logic, watch,
transactions via makeVolume, R1's three discriminant predicates and isInt/isFinite.
The accepted positive-copy helper, existing 17 regressions, scratchpad, configs,
patch/lock and captured instruction files remain unchanged.

Effect-first/schema-first instructions kept the repair in existing composition and
schema-derived guards; no schema, helper role, export or validation policy was removed.
Graft caller discovery was followed by targeted live fallback for its fnUntraced miss:
six queries, approximately 147,260 reported tokens saved. No graph initialization,
git, inbox, delegation, network research or permission prompts occurred.

## Remaining Root gates and qualified limitations

Root must run combined package-verify, canonical policy/coverage and aggregate/hosted
proof after the writers join, then own review replies and publication. This lane ran
no package-wide proof and makes no merge-ready or P0.5-complete claim. Its explicit
test selectors do not measure the concurrent coverage lane's new tests.

The pre-existing NUL-path watch reason mismatch remains separately reported for Root
triage, not silently repaired beyond the method claim. Host watch evidence uses a
synchronously registered native backend observer because the public adapter's async
stat preflight made the first observation racy; Memory regressions use the public API
and no sleeps. Directory/symlink timestamps remain characterized, not standardized
beyond the unchanged Memory behavior. Earlier accepted R1 and other raw receipts are
immutable; no baseline, waiver, timeout or policy adjustment was made.

## Follow-up: deprecated suite shorthand

Root's terminal canonical lint proof attributed one introduced deprecated API to
Characterization.test.ts:25. This bounded follow-up replaces only describe.sequential
with the installed equivalent describe options form, preserving every callback.
Implementation/coverage writers and the combined proof have finished; this lane owns
only the characterization file. Preimage, declaration/config evidence and focused
receipts are recorded separately in
`~/.cache/beep/effect-vitest-canon/p05-pr1047-deprecated-describe-evidence/`.
Root retains all package, coverage, canonical lint and publication gates.

Completed: line 25 now uses
`describe("ordered sharing characterization", { concurrent: false }, callback)`.
Installed Vitest `@vitest/runner/dist/tasks.d-DEYaIMIu.d.ts:794–806,1199–1202`
documents the replacement and overload; `dist/chunk-artifact.js:1922–1946`
treats the old shorthand and explicit false as sequential specification. Existing
repo examples are `test/integration/SqlTest.pglite.test.ts:216,407` in test-utils.
No suite ordering, scope, name, assertion, import or callback changed.

The exact package-file ESLint command used
`BEEP_ESLINT_PROFILE=deprecated-apis ./node_modules/.bin/eslint --config eslint.config.mjs`
with only the owned test path. Before: exit 1, exactly the reported no-deprecated
finding; after: exit 0, output empty. The focused `bun x --no-install tsgo -p`
private config extends the live package check config, preserving strict Effect
diagnostics: exit 0, output empty. Actual Node v24.20.0 and Bun 1.4.2 each ran
only Characterization.test.ts through the unchanged installed package Vitest config:
18/18 passed, zero skips/todo, exit 0. Exact commands/logs are in the new evidence
directory's commands.md; no aggregate proof or package verification was run here.

Integrity proof compares the exact one-line replacement and all 32 function/arrow
expressions as raw source text: identical callbacks, including all 18 test bodies.
Seven captured input hashes confirm only the owned test delta; the conformance
helper, core, captured configs and lock remain unchanged. The exact diff is retained.

- Test before: `9147f5afdc56fa87bbc0ab39cd1d52e9526deb125ce3c43bf475e41284d01d89`.
- Test after: `3f844b3958f460d61ad29a6a9043866ffc7c928a8aeb88a73db8ab6c6e3dab3b`.
- Core before/after: `4993bd3b1d5cd8d0a0765c80f2ad2e81a6ecc80ecb19d396a7f0ecaad6e45566`.

Effect-first testing guidance preserved the existing scoped behavior without new
helpers. One Graft discovery query reported approximately 4,120 tokens saved.
Root's accepted 101-case plus coverage proof remains historical; Root owns the
fresh combined package/coverage/canonical lint rerun and publication after this delta.
