# PR1047 public filesystem coverage lane

Bounded test-only remediation in the existing gpt-6-astra/xhigh lane. Repository ownership is only new `packages/tooling/test-kit/test-utils/test/MemoryFileSystem/Coverage.test.ts`. Root owns source, git, configuration, orchestration and package-wide proof. R2 concurrently owns the core implementation and Characterization tests; this lane preserves all existing tests and avoids R2's five scenarios. Every command runs from `~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-filesystem`. No package verification or aggregate coverage will run here.

## Inputs, discovery and first implementation pass

Immutable input copies (`lcov.info`, `core.lcov.info`, `coverage-summary.json`, HTML, core source) and hashes were created before any coverage run in `~/.cache/beep/effect-vitest-canon/p05-pr1047-coverage-tests-evidence/inputs/`. Core snapshot matches R1 `7fb3466b8adf7eba2666c03bf94386c0147b50e2dc602b70fa13b3d41602c1b9`. Input core: 326 functions/286 hit, 1,155 lines/1,009 hit, 565 branches/386 hit. Root's 96 R1 cases and package branch floor are preserved; this lane runs only its new file.

Graft skeleton and scoped exhaustive test-registration search preceded source discovery (32,269 estimated tokens saved, two calls). Graft omits several `fnUntraced` definitions; the exact LCOV/HTML locations justified targeted source reads. Live tests and source/barrels were searched for reuse. Public MemoryFileSystem entrypoint is `src/MemoryFileSystem/index.ts`, exporting only `layer`/`make`; an initial search for the old flat path exited 2 because it does not exist. Another read-only search referenced a nonexistent `packages/vitest.shared.ts`; the real package configuration remained unchanged. Existing assertion helpers are local to other tests, so the new file has small private assertions over public PlatformError fields and one scoped directory fixture. No shared source helper, schema or export was added. Established Effect-first/schema-first skills and live AGENTS were read.

The initial 22 cases target merge/replace/no-op copy, failure atomicity, rename/reclamation, link validation, symlink resolution, descriptor permissions/lifetimes/allocation failure, temporary resources, utimes, glob parsing/exclusions and deterministic watch delivery. They avoid R2's timestamp-preserving copy, hard links to symlinks, empty symlinks, missing-path watch attribution and temp-parent Create event tests.

First focused Node run: **exit 1, 21/22 passed**. One draft case incorrectly used Node-style `rs`/`as` flags; rc.112 publicly accepts exactly r/r+/w/wx/w+/wx+/a/ax/a+/ax+. First focused compile: **exit 1**, rejected those flags, nine draft `file.fd` accesses (not on public File), and four direct Date constructions. Those draft assumptions were removed: all flags now use the public union; descriptor failure assertions inspect only public PlatformError fields, with no private handle access; valid Date arguments come from DateTime, and an invalid Date boundary value is formed by invalidating a DateTime-produced public Date value. No casts, suppression or source change was used. Initial and subsequent single-file Biome formatting checks exited 0.

The live R2 source was already `4993bd3b1d5cd8d0a0765c80f2ad2e81a6ecc80ecb19d396a7f0ecaad6e45566` during the first runtime/compiler pass, stable before/after each command. The evidence runner snapshots core source for every invocation and records exact cwd/argv/exit, core hashes and owned test hash. Draft runs are not final public-API proof. No existing test was run or modified.

## Progressive coverage evidence

The corrected 22-case file passed under Node and actual Bun; focused compiler exit 0. Its Node-only coverage of the core was functions 307/326 (94.17%), lines 1,094/1,157 (94.55%), statements 1,183/1,284 (92.13%), branches 453/571 (79.33%). The subsequent 26-case pass, still running only the owned file, reached functions 311/326 (95.39%), lines 1,115/1,157 (96.36%), statements 1,217/1,284 (94.78%), branches 491/571 (85.98%). These are core metrics under the R2 measured hash, not package aggregate metrics or ratchet acceptance. Both runs used the existing package config, only private report directories and explicit json/json-summary/lcov reporters; no include/exclude, threshold or coverage policy override was applied.

The extra cases exercise missing/non-directory parents, default-root glob matching/exclusion, recursive directory modes, literal/invalid character-class edges, and collisions between a public temporary-directory candidate and a pre-existing namespace entry. The collision candidate is observed from another freshly acquired public Subject.make volume; no internal counter/token state is inspected or reconstructed. An invalid Date is ordinary API input, not a mocked clock or platform primitive. Oversized allocation tests use Number.MAX_SAFE_INTEGER, which is a safe-integer API argument beyond Node/Bun's typed-array capacity; both runtimes fail through the expected typed channel without changing file bytes/cursor. No source array `.slice()` allocation failure is fabricated.

A read-only gap analyzer initially exited 1 because Istanbul uses empty location objects for synthetic else branches. The corrected private analyzer preserves those empty locations and records the enclosing conditional as context; it does not invent source positions or hide branches. Exact remaining function/statement/branch/line inventories are stored privately. Source alignment with unchanged R1 lines is explicitly advisory because R2 changed the source hash; it is not an Istanbul merge or combined coverage claim.

The remaining review found two further reachable branches worth exercising: direct-child events on a root watch, and writeFile's remapping of invalid open-mode arguments. Those assertions have been added to the same 26 cases; final receipts below will use the resulting test hash. Source invariant guards, rather than valid behavioral inputs, account for the remaining seven function candidates beyond the mapped prior hits. Root retains the provenance/baseline decision.

## Terminal result

Implemented **26 new cases** in the only owned repository file, `packages/tooling/test-kit/test-utils/test/MemoryFileSystem/Coverage.test.ts` (737 lines, 35688 bytes). No existing test or source file was edited. Final test SHA256: `a7d66be4097d57527e3e994ddbbc433c5ef3b0d34112978bf9f3e61f78aaa409`.

Actual **Node v24.20.0: 26/26** and **Bun 1.4.2: 26/26**, both Vitest 4.1.11, no skips. The Node run also collected coverage using the existing package config. All terminal command receipts record the same stable source SHA256 before and after: `4993bd3b1d5cd8d0a0765c80f2ad2e81a6ecc80ecb19d396a7f0ecaad6e45566`. The R1 source hash in the immutable inputs is different; all line references below refer to the measured R2 snapshot `node-terminal-coverage.core-before.ts`, not a moving live file.

Focused compiler, Biome, configured Oxlint and AST law proof all exited **0**. The AST proof confirms 26 explicit `it.effect` registrations, 127 direct assertion sites and 74 typed-error assertion-helper calls. These are static site counts; loops execute some sites repeatedly, so they are not presented as a runtime assertion-counter measurement. Error assertions check tags, module/method and original public path where exposed; descriptor failures check the public numeric descriptor field without accessing private handle members. The proof rejects casts, suppression comments, private member access/imports, skips, timeouts and manual Effect runtime entrypoints.

### Cases and observable assertions

All rows passed in both terminal runtime receipts. Each layer-based case acquires its own scoped directory. Cases using `Subject.make` need an independent virtual root (deep trees, relative paths, root metadata or default-temp-parent state), and do not allocate host resources. Open handles belong to the test scope, except the explicit shorter scope proving behavior after close. Watch tests use public Stream/Fiber registration, with a Deferred event acknowledgment where continued queue delivery is under test; there are no sleeps or clock substitutions.

| Case | Owned lines | Direct assertion sites | Typed-error assertion calls |
| --- | --- | ---: | ---: |
| copy clones symbolic links and merges trees without removing destination-only entries | 52–77 | 7 | 0 |
| copy validates nested file-directory conflicts before changing any destination bytes | 79–112 | 5 | 2 |
| copy rejects top-level type conflicts, self copies and copying into a descendant atomically | 114–144 | 4 | 5 |
| copy replacement detaches the old inode while an open handle can still read it | 146–162 | 4 | 0 |
| copyFile overwrites the existing inode and follows live and dangling destination links | 164–191 | 8 | 0 |
| copyFile attributes invalid sources and destinations without changing existing data | 193–222 | 3 | 6 |
| rename replaces files and empty directories across parents while preserving open victims | 224–246 | 8 | 0 |
| rename failures preserve both trees and normalized self rename is a no-op | 248–273 | 3 | 4 |
| link and symlink reject invalid names, occupied destinations and directories atomically | 275–302 | 3 | 7 |
| path resolution follows absolute links and rejects cycles and wrong node kinds | 304–330 | 3 | 11 |
| open creates dangling symlink targets but preserves links on read and cycle failures | 332–363 | 4 | 5 |
| exclusive create flags fail without truncating a previously created file | 365–379 | 2 | 1 |
| read-only and write-only descriptors reject incompatible IO without advancing or changing buffers | 381–409 | 8 | 5 |
| unlinked open files retain bytes and metadata until the test-owned handle scope closes | 411–442 | 7 | 4 |
| read allocation and truncation failures preserve bytes and descriptor progress | 444–472 | 8 | 5 |
| temporary resources honor prefixes and suffixes and tolerate explicit removal before finalization | 474–500 | 6 | 0 |
| temporary creation validates fragments and parent kinds without leaving partial directories | 502–531 | 2 | 5 |
| utimes validates both epoch numbers and Date inputs before mutating either timestamp | 533–558 | 7 | 2 |
| glob question marks, exclusions and comma-free nested braces select only matching public paths | 560–585 | 6 | 1 |
| invalid glob syntax reports typed argument errors without changing the directory | 587–599 | 2 | 2 |
| watch continues delivering after the first event confirms registration | 601–623 | 2 | 0 |
| deep merge validation and recursive removal fail atomically at the public tree bound | 626–654 | 5 | 2 |
| relative paths, recursive directory modes and root-inclusive globs use the virtual root | 656–677 | 8 | 3 |
| root directory watches deliver metadata and direct child events | 679–698 | 4 | 0 |
| temporary allocation preserves pre-existing names and reports a removed default parent | 700–719 | 4 | 2 |
| classes distinguish literal hyphens and reject descending or incomplete ranges | 722–736 | 4 | 2 |

Failure atomicity is asserted through unchanged file bytes, unchanged directory entries, retained inode/link counts, unchanged timestamps or cursor position as appropriate. Copy and rename replacement tests retain open victim handles and prove old bytes remain readable with link count zero. Tree merge failures are checked before any early destination entry can change. The over-deep merge/removal case uses a fresh public volume so an intentionally invalid-for-recursive-removal tree cannot poison shared cleanup. Existing R1 cases and R2's five review cases were neither run nor duplicated as claimed proof.

### Focused core coverage and exact remaining gaps

| Metric | Covered / total | Percent | Uncovered |
| --- | ---: | ---: | ---: |
| Functions | 314 / 326 | 96.31% | 12 |
| Lines | 1119 / 1157 | 96.71% | 38 |
| Statements | 1221 / 1284 | 95.09% | 63 |
| Branches | 499 / 571 | 87.39% | 72 |

**This is not a package ratchet pass.** Only this new test file ran. Root must combine it with the unchanged R1 tests and R2 tests, then run the canonical package-filtered coverage command and package-verify. A new-file comparator requiring zero uncovered units remains a distinct blocker; none of these percentages authorize changing that comparator, provenance, a baseline or a floor.

Exact current inventories are in `remaining-gaps-terminal.json`: all **12 uncovered functions, 38 lines, 63 statements and 72 branches**, including statement/branch IDs and locations. Synthetic else branches retain their empty Istanbul location and the enclosing conditional location separately. Full coverage JSON, summary, LCOV and the exact measured core snapshot are preserved. No aggregate coverage reports were overwritten.

Comparing byte-identical source spans with the immutable R1 LCOV is useful triage, but **is not a merged coverage measurement**. Five current function misses (lines 1198, 1203, 2158, 2161, 2824) align with already-hit R1 source: no-destination rename continuations, recursive directory traversal callbacks, and a valid character-class range matcher. R2 owns the newly changed timestamp-preservation and empty-symlink rejection branches. Their executions are intentionally left to Root's combined proof.

Seven function candidates remain beyond those mapped prior hits:

| Measured core line / function | Evidence and why additional ordinary public tests cannot deterministically execute it |
| --- | --- |
| 283, State.descriptors constructor default callback | The sole `State.make` call at 2983–3006 supplies `descriptors: HashMap.empty()` explicitly. The AST proof verifies the sole constructor and that property. State is private; invoking its unused schema default would require exporting/reaching private construction. |
| 395, getInode missing-inode callback | Namespace entries and descriptors refer to allocated inode IDs. The permit-serialized mutations preserve those links; reclamation retains linked or open inodes. Missing public paths fail resolution before a missing allocated inode can be requested. Exercising this callback requires inconsistent internal maps. |
| 438, parentOfPath missing-slash fallback | Watch events carry canonical absolute paths. Direct root-child watching now exercises the valid separator-at-zero branch; a missing slash cannot arise from the publisher. |
| 808, symbolicLinkTargetPath missing-slash fallback | Callers pass resolved link paths, which are canonical absolute paths. Relative and absolute dangling-target creation, including a root-level link, are tested. The `-1` fallback requires a noncanonical internal link path. |
| 938, createDirectoryEntry attachment error mapper | The same locked transition resolves/validates the parent and final name, checks absence, allocates a fresh directory and attaches it. No competing mutation can insert a name or change the parent between those steps. Public invalid-name/parent/conflict cases fail before attachment. |
| 1463, copyFile existing-file `.slice()` allocation catch | **Resource-exhaustion guard, not proved logically unreachable.** The source bytes already exist and have a valid typed-array length; a same-size copy can fail only under runtime allocation pressure. Unlike the tested MAX_SAFE_INTEGER allocation rejection, no safe deterministic public fixture forces this failure without host-memory manipulation or mocking. It is intentionally unforced. |
| 2496, makeTempFileScoped missing-slash fallback | Temporary files always live inside an allocated absolute temporary directory. Prefix/suffix inputs cannot insert separators or NULs. Even a requested root parent yields `/directory/file`, so the fallback and separator-at-zero alternative cannot describe a valid generated file path. |

Additional unexecuted defensive branches/lines beyond the mapped R1 hits are justified by the following invariants. These are source explanations for Root's review, not waivers or permission to remove guards:

| Measured core locations | Invariant or scope limitation |
| --- | --- |
| 483, 703, 1109, 2947 | Local worklists are checked nonempty immediately before pop/shift; no external actor can mutate them. Undefined-element fallbacks are defensive. |
| 497 | Root inode is installed at construction and cannot be removed/renamed through the public path mutation API. Root-missing watch enumeration requires corrupt state. |
| 582–588 | `attachDirectory` receives fresh/cloned directory inodes with the expected self/child link count and a distinct parent. Hard links to directories are rejected by the separate public link path, which is covered. The invalid topology arm is not a valid public state. |
| 664 | R2 rejects empty targets before storing a symbolic link (1030); clones preserve a previously valid target. The traversal fallback for an already-stored empty target cannot be reached through that corrected public API. R2 owns the rejection test. |
| 692 | The AST proof found **30/30** internal resolve calls explicitly supply a policy; the private optional-policy fallback has no public caller. |
| 775–776, 1839 | An open descriptor pins its file inode until close; removal reduces link count without discarding an open inode. The tests cover unlink/read/write/stat and close errors. Missing/wrong-kind inode behind a live descriptor requires inconsistent private state. |
| 783 | The current `withSystemErrorPath` callers handle namespace SystemErrors; argument validation runs before them or through `withOperationError`'s separate BadArgument arm. The latter arm is now exercised by invalid writeFile mode with unchanged data. |
| 828–829 | resolveParent rejects empty/root/trailing-slash/NUL paths first. Filtering separators leaves a final component for every remaining valid candidate; the undefined popped name is a defensive fallback. |
| 933, 938 | Directory existence checks and fresh attachment run under the same single volume permit, preventing an insertion race. |
| 1283 | Existing top-level copy targets with overwrite disabled are rejected before entering merge validation. The inner overwrite-disabled conflict branch has no public merge route. |
| 1345, 1384–1385 | Copy preflight validates the entire merge's matching directory structure and depth before copying children. It rejects kind conflicts or depth >256 before the corresponding copy-time backstops. The deep validation failure is tested with all original data preserved. |
| 1658–1659 | createFile constructs the File schema variant, and linkInode preserves that inode. The non-File assertion is a private allocation/link consistency guard. |
| 1711–1716, 1730–1731 | Target selection, absence validation, new File allocation and attachment share the permit. Neither an AlreadyExists race nor a newly occupied parent entry can arise between those operations through public calls. |
| 1787 | Invalid open strings are excluded by the exact public `Fs.OpenFlag` union. The first draft demonstrated the runtime guard, but that invalid-typed draft is not retained or counted as final proof. Testing arbitrary invalid flags would require a cast, reflection or another disallowed typing escape. |
| 1832, 2004 | Public File exposes no close method; its scope finalizer closes once. The repeated/missing-descriptor close alternatives defend against private repeated close, not ordinary repeated `Scope.close` (which finalizes once). |
| 1861 | Path stat follows the final symlink; descriptor stat refers only to File inodes. A SymbolicLink entry cannot be supplied to fileInfo through those public stat paths. |
| 1976 | A successful nonempty descriptor write preserves its descriptor under the same permit. Zero progress returns before event lookup. The missing-descriptor event fallback requires an inconsistent transition. |
| 2677 | A deterministic findBraceExpansion call immediately follows a successful search using the same immutable pattern and predicate. The second call cannot switch from Some to None. |
| 2497 | Scoped temporary files have a containing generated directory, so the last slash cannot be absent or at offset zero. |

The exact beyond-mapped-R1 uncovered **line** list is `283, 588, 776, 829, 938, 1385, 1463, 1659, 1712, 1713, 1714, 1716, 1731`. This aligned triage list deliberately does not label already-covered R1 paths as unreachable. It also does not substitute for Root measuring the actual combined source revision.

### Command receipts and failures

All command receipts/logs live under `~/.cache/beep/effect-vitest-canon/p05-pr1047-coverage-tests-evidence/`. Every runner invocation records exact cwd, argv, exit, source hashes and test hash, and writes a separate immutable core snapshot. All commands ran from the required worktree. Early failures are retained and attributed above.

| Receipt label | Exit | Interpretation |
| --- | ---: | --- |
| `node-first.receipt.json` | 1 | Draft error retained; corrected without source/policy changes |
| `compiler-first.receipt.json` | 1 | Draft error retained; corrected without source/policy changes |
| `compiler-second.receipt.json` | 0 | Earlier focused proof; preserved |
| `node-coverage.receipt.json` | 0 | Earlier focused proof; preserved |
| `bun-first.receipt.json` | 0 | Earlier focused proof; preserved |
| `node-final-coverage.receipt.json` | 0 | Earlier focused proof; preserved |
| `bun-final.receipt.json` | 0 | Earlier focused proof; preserved |
| `compiler-final.receipt.json` | 0 | Earlier focused proof; preserved |
| `oxlint-final.receipt.json` | 0 | Earlier focused proof; preserved |
| `biome-final.receipt.json` | 0 | Earlier focused proof; preserved |
| `node-terminal-coverage.receipt.json` | 0 | Terminal proof for the final test hash |
| `bun-terminal.receipt.json` | 0 | Terminal proof for the final test hash |
| `compiler-terminal.receipt.json` | 0 | Terminal proof for the final test hash |
| `oxlint-terminal.receipt.json` | 0 | Terminal proof for the final test hash |
| `biome-terminal.receipt.json` | 0 | Terminal proof for the final test hash |
| `ast-terminal.receipt.json` | 0 | Terminal proof for the final test hash |

Exact terminal commands (all exited 0):

```sh
~/.nvm/versions/node/v24.20.0/bin/node node_modules/vitest/vitest.mjs run --config ~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-filesystem/packages/tooling/test-kit/test-utils/vitest.config.ts --root ~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-filesystem/packages/tooling/test-kit/test-utils test/MemoryFileSystem/Coverage.test.ts --coverage --coverage.reportsDirectory ~/.cache/beep/effect-vitest-canon/p05-pr1047-coverage-tests-evidence/coverage-node-terminal --coverage.reporter json --coverage.reporter json-summary --coverage.reporter lcov --reporter verbose
```

```sh
bun --bun node_modules/vitest/vitest.mjs run --config ~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-filesystem/packages/tooling/test-kit/test-utils/vitest.config.ts --root ~/YeeBois/projects/beep-effect2-worktrees/effect-vitest-filesystem/packages/tooling/test-kit/test-utils test/MemoryFileSystem/Coverage.test.ts --reporter verbose
```

```sh
node_modules/.bin/tsgo -p ~/.cache/beep/effect-vitest-canon/p05-pr1047-coverage-tests-evidence/focused.tsconfig.json --pretty false
```

```sh
node_modules/.bin/oxlint -c .oxlintrc.json packages/tooling/test-kit/test-utils/test/MemoryFileSystem/Coverage.test.ts
```

```sh
node_modules/.bin/biome check packages/tooling/test-kit/test-utils/test/MemoryFileSystem/Coverage.test.ts
```

```sh
~/.nvm/versions/node/v24.20.0/bin/node ~/.cache/beep/effect-vitest-canon/p05-pr1047-coverage-tests-evidence/verify-test.mjs
```

The real private compiler config extends the existing package `tsconfig.check.json`, selects only the owned test, and supplies the workspace typeRoots for its external cache location. It does not override Effect diagnostics or package policy. No package-verify, rootcheck, aggregate coverage, scheduler, inbox, git, publication or delegation command ran. Both private gap analyzers completed after the explicitly reported synthetic-branch-location correction; their exact scripts and inventories are preserved. Single-file Biome `check --write` passes formatted only the new owned test; terminal read-only Biome reports no fixes/diagnostics. Oxlint uses the unchanged `.oxlintrc.json` and reports no diagnostics. Runtime version probes returned Node v24.20.0 and Bun 1.4.2.

### Handoff and ownership

Implementation is complete in the new owned test file. All 96 R1 cases remain untouched by this lane, as do R2's implementation and Characterization file. The terminal proof uses the final test hash and stable measured R2 core hash above; it does not claim broader source acceptance. The explicit guard/resource-exhaustion evidence explains why this lane cannot honestly produce zero-gap coverage solely by valid deterministic public-API tests.

Root must run the full package-filtered coverage command and package-verify after both writers are terminal, then decide the legitimate provenance/baseline path if unreachable/private guards still trip the new-file comparator. No such policy decision was implemented or pre-approved here. Existing floors, exclusions, configs, schemas, dependencies and source assertions were preserved.

Final private artifacts: `Coverage.final.test.ts`, `test-proof.json`, `remaining-gaps-terminal.json`, `coverage-node-terminal/{coverage-final.json,coverage-summary.json,lcov.info,core.lcov.info}`, exact measured core snapshots, all command logs/receipts, and `input-integrity-final.json`. The original immutable coverage-before inputs still match their privately copied hashes. The initial input manifest also contains its own empty-at-creation hash; the final integrity receipt correctly verifies only the five actual input files and does not treat that self-entry as a data input.

Every lane-launched test/compiler/check process has exited. No source or test changes remain planned for this lane.

Graft tally: approximately **32,269 tokens saved**, two calls (tool-reported estimate).
