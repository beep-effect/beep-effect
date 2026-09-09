# P0.5 PR 1047 review remediation R1

Status: bounded remediation implemented; final focused runtime, compiler and Oxlint
proof passed. Root's full package/hosted/integration gates remain pending.
Published starting revision supplied by
Root: `5eef61179500a7550508b8e60bd500a93e4d1844`. No git commands are authorized here.

Scope: verify closed-descriptor seek against pinned rc.112 source and real runtimes;
repair the copy conformance false negative without losing existing assertions/cases.
Only the four assigned test-utils source/test paths may change. Root owns package-wide
proof, integration, replies and publication. Existing evidence remains immutable.

Effect-first, Graft and Yeet skill guidance loaded. Runtime and graph discovery,
before snapshots and focused behavioral evidence follow. The required inbox handling
will retain Root's existing thread ownership, without waivers or fabricated fix SHAs.

## Early evidence and friction

The supplied mise Node location is absent. The installed nvm Node binary reports
v24.20.0; Bun reports 1.4.2. Command-scoped PATH selects those binaries without changing
trust, versions or configuration. Graft's first query failed at mise trust; correcting
the Node routing allowed later caller queries. `MemoryFile` is ambiguous with the lab
class and has no indexed callers; `testLayer` tracing also collides with another helper.
Targeted live reads establish the actual local boundaries. No Graft initialization ran.

The six injected inbox rows were acknowledged with the same existing Root thread URL,
not marked fixed/environment-only/wontfix/waived. All six commands exited 0; exact
identifiers, URL and receipts stay private. Root retains attribution and closeout.

Before source edits, both runtime probes executed the actual registered copy case with
a successful no-op `copy`; both archived and current helper accepted that mutant.
The first combined probe commands exited 1 because a separate seek-control assertion
incorrectly assumed the platform read-after-close error tag equals Memory's `BadResource`.
This is a private test-expectation failure, not a seek failure or source regression.
The first logs and harness bytes are preserved; the observation probe now records
the actual platform error and still requires read failure, method/descriptor and bytes.

## Contract decision and planned correction

Pinned `packages/effect/src/FileSystem.ts:1040–1049` gives `seek` an infallible
`Effect<Size>` signature, unlike stat/sync/read/write/truncate. Pinned shared Node
`NodeFileSystem.ts:253–287` stores a handle-local position and implements seek with
`Effect.sync`, without descriptor access. Its open finalizer only closes the native
fd (`:195–214`); Node and Bun public layers both delegate to this shared implementation.
The cached upstream suite still hashes to the accepted pinned SHA256.

The repaired observation harness passes on actual Node and Bun (5 selected cases per
runtime, including the two mutant copy cases; 40 cases intentionally name-filtered).
Both platform layers produce closed seek positions `[3n, 5n, 7n, 3n]`; Memory produces
`[0n, 0n, 0n, 0n]`. Read after close fails on both: platforms map native EBADF to
`Unknown`, while Memory uses `BadResource`; method/descriptor and unchanged bytes pass.
No raw Bun/GlobalValue probe is involved.

Therefore the requested typed seek failure is invalid for rc.112. The smaller genuine
mismatch is the discarded cursor. The bounded correction will snapshot the last position
under the existing volume permit while closing, retain it only on the file handle, and
let closed seek update that scalar without restoring a descriptor or inode reference.
Existing live-descriptor seek/IO and close/reclaim transactions retain their semantics.

The copy case now uses existing `Effect.flip` style followed by all three original
reason/method/source assertions and both original file-content assertions. Unexpected
success fails instead of bypassing checks. This was the helper's sole Result outcome
branch; analogous negative cases already use `Effect.flip`, so no wider suite rewrite
is justified. The now-unused Result import is removed; all 21 cases remain.

## Root integration finding — platform copy also silently succeeds

After strengthening the helper, the same private mutant fails exactly the selected
current copy case on Node and Bun (exit 1, intentional), while the immutable archived
helper still passes. All three seek controls now return `[3n, 5n, 7n, 3n]`.
`Effect.flip` exposes the mutant's `undefined` success as a failure; Vitest renders that
as `Unknown Error: undefined`, not as an engine crash. The selected probe totals are
one expected mutant failure, four passes and 40 name-filtered cases on each runtime.

The real package-config focused run then exits 1 on each runtime: **94/96 pass, zero
skips**. The two failures are the existing-destination copy case in NodeFileSystem and
BunFileSystem; both silently return success. Memory conformance is 21/21, all 17 original
regressions pass, all 12 retained characterization cases plus the new closed-seek case
pass, and all three positional-write compatibility cases pass. This is an exposed
platform behavior, not permission to weaken the new assertion or broaden source scope.
Root owns the platform patch/integration decision; its full package proof will encounter
these two failures until that behavior is resolved. No platform/dependency patch changed.

Exact platform source: pinned and installed shared `NodeFileSystem.ts:57–69` forward
`force: options?.overwrite ?? false` to native `cp` but do not enable `errorOnExist`.
This matches the observed successful no-op. The helper's original conditional masked
the platform mismatch too; retaining all original assertions now makes it visible.

One earlier focused launch failed before tests because a relative `--config` was resolved
under `--root` twice. Both startup logs are retained; using the absolute existing package
config fixed only that command-path error. The real 94/96 results are separate receipts.

Focused compiler first pass found an introduced regression-test mistake: `File.fd` is
not on the public rc.112 interface even though both implementations hold that field.
The test now acquires a fresh public Memory volume and checks the exact initial
descriptor payload `3`, without reading a private field or casting. The private platform
observation likewise checks a numeric descriptor payload rather than an undeclared field.
Original logs/harness snapshots are retained. First focused Biome passed all four files.

## Superseding integration decision and focused lint repair

Root clarified the pinned contract: successful no-op **collision** with `overwrite:false`
is permitted; `force:false` without `errorOnExist` is canonical, not a platform defect.
The earlier platform-defect attribution and mandatory `Effect.flip` proposal above are
superseded. Their logs remain immutable. The repair will restore every original
conditional error/content assertion, first require a real copy into an absent destination,
and retain 21 cases. The always-no-op mutant was indistinguishable from valid behavior
when tested only on collisions; the new positive-copy leg will distinguish it.

Root also assigned the two hosted Oxlint findings for inline `S.is(S.Int)` and
`S.is(S.Finite)` compilation. Only these predicates will be hoisted, preserving their
exact schemas and error paths. Schema-first skill guidance governs this guard extraction.
No platform patch, rule, policy, baseline, package-wide proof or runtime configuration
change is authorized. The previous turn's final Biome handle is absent after interruption;
its persisted log is retained and fresh focused proof follows the final source edits.

## Final accepted behavior and source changes

`FileSystemConformance.ts:378–402` now first proves the destination is absent, copies
with `overwrite:false`, and reads the copied `source` content. It then writes distinct
destination content and executes the original collision leg unchanged, including its
conditional AlreadyExists reason/method/source-path checks and both content assertions.
Only the case title and three positive-leg statements differ from the original helper.
Both option defaults and all 21 cases are preserved. No platform patch is needed.

`MemoryFileSystem.test-kit.ts:1982–2107` retains a scalar closed cursor on the private
resource handle. Its finalizer snapshots the last descriptor position and removes the
descriptor in the same volume transaction; close/reclaim is still idempotent. Closed
seek remains infallible and updates only that handle scalar. It cannot resurrect the
descriptor, retain its inode or mutate a reopened handle. The public File interface and
exact make/layer exports remain unchanged. No typed seek failure was introduced.

The two hoisted bindings at core lines 165–166 are exactly `S.is(S.Int)` and
`S.is(S.Finite)`. Existing `isSafeSize` and `isModeOrOwner` impose different constraints,
so neither substitutes for these predicates. The write-size and timestamp call sites
change only to reuse the compiled guards. All validation/error payloads remain intact.
Caller tracing missed fnUntraced bindings; live callers are `writeDescriptor`/`writeFile`
for the write guard and `utimes` for the date guard. No broader lint repair occurred.

`Characterization.test.ts:334–382` adds case 13. It proves the final read cursor survives
scope closure (`3 → 5 → 7 → 3 → -1`), all seven descriptor operations remain BadResource
with exact method/descriptor/description, failure preserves caller/file bytes, and a
reopened handle starts independently. It fails against the archived original core at
`0n !== 3n` (intentional regression-control exit 1), then passes against the repair.
Every original characterization callback is AST-identical; all 17 regressions and the
Memory conformance entry remain byte-identical.

## Final focused proof

Actual runtimes: Node v24.20.0 (nvm binary) and Bun 1.4.2. Bun reports a Node-compatible
version string separately; it is not an actual Node v26 run. Both use installed
Effect/@effect/vitest rc.112 and Vitest 4.1.11. Exact commands and logs are in private
`p05-pr1047-review-r1-astra-evidence/commands.md`; all commands use the filesystem worktree.

| Proof | Node | Bun | Scope |
| --- | --- | --- | --- |
| Real package-config focused tests | exit 0, 96/96 | exit 0, 96/96 | 21 Node + 21 Bun + 21 Memory conformance, 17 regressions, 13 characterization, 3 write compatibility; zero skips |
| Actual registered copy case with always-no-op mutant | exit 1, expected | exit 1, expected | Archived case passes; strengthened case fails NotFound at destination content read; three closed-seek controls pass; 40 unrelated cases name-filtered |
| Closed-seek regression against archived core | exit 1, expected | not repeated | New public-API case fails at `0n !== 3n`; 12 unrelated cases name-filtered |

The mutant returns success for **every** copy; no assertion logic is mirrored. Its
behavior was already always-no-op in the first harness, but the earlier collision-only
selection could not distinguish valid platform behavior. The final failure is the
absent-destination read, not the superseded mandatory collision failure.

Focused `bun x --no-install oxlint --config .oxlintrc.json <core>` reproduces exactly
two `beep/no-inline-schema-compile` errors before hoisting (exit 1); the identical
command after hoisting exits 0 with empty output. It uses the actual repository plugin,
config and severities. Focused `bun x --no-install tsgo -p <private-config>` inherits
the package's strict Effect diagnostics and checks the two owned source entries plus
both owned tests and imports: exit 0, empty output. Focused Biome checks all four paths:
exit 0, four files, no fixes applied. These do not replace Root's package/lint-policy gates.
Final focused Effect-fn check exits 0 (one core file, zero violations); Effect import
check exits 0 (two files under the Memory prefix, zero changes/manual reviews). The
three final source hashes remain unchanged after all checks. The fourth owned path,
`test/MemoryFileSystem/Conformance.test.ts`, stays at SHA256
`a356833ea4473da0d067acdef43355f063c04f5b0a39bb358b65ecb4ff4546b7`.

## Final integrity and handoff

Private `integrity.mjs` exits 0. Across 369 captured source/test/config/lock/patch and
instruction inputs, exactly the three authorized paths below changed; 366 are stable.
The core's 256 other top-level declarations, complete header/MIT notice, all schema
models, three R1 inode predicates, transaction/event machinery and 25 primitive bindings
are AST-identical. Only private handle/open/close behavior and the two exact guard calls
changed, with two module-level predicate bindings added. No schema weakening occurred.

| Path (relative to test-utils) | Before SHA256 | After SHA256 |
| --- | --- | --- |
| `src/FileSystemConformance.ts` | `39526e917bc9e007d2272583317fd12e145a14a3e4db2c814a972dcd448ffd5e` | `0df3ac8a6266de7ef5da9bb71265cc833e840dd63baaa9aa39adb44e44fac2fc` |
| `src/MemoryFileSystem/MemoryFileSystem.test-kit.ts` | `820c35e92308f20f790f2acd7cd932166c3d18b28d30eec44fb847713809fa80` | `7fb3466b8adf7eba2666c03bf94386c0147b50e2dc602b70fa13b3d41602c1b9` |
| `test/MemoryFileSystem/Characterization.test.ts` | `1661738a890ec04b7dae15e3ca6d22ce3e8fc0b6f346b84d81fb517366a9d12b` | `b0a340125d63cc8d963c962330425fa7433e9cbfdf4dff9ba62c865cb804a03c` |

Root can reply that the requested BadResource seek is incompatible with the pinned
signature/runtime, while the genuine discarded-cursor mismatch is repaired. The copy
test now detects an implementation that never copies without rejecting valid collision
no-ops. Both hosted guard-hoisting findings are repaired with focused policy proof.
Root retains full package-verify, canonical lint-policy, aggregate/hosted review, git,
PR replies and publication. No phase completion or merge is claimed. No git, delegation,
global configuration, threshold, suppression, dependency or platform-patch changes ran.
Skills applied: Effect-first, schema-first (repo laws), Graft and Yeet, restricted to
the assigned proof scope and required Root-thread inbox acknowledgements.
