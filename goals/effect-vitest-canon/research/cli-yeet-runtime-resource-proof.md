# Yeet runtime and resource migration proof

Source `75fa5f27131fc5d93672582770b30f6bc6e1bba8` moves 74 runPromise callbacks
into the public Effect test harness. An anonymous it.layer owns the existing
native filesystem, path, crypto and process services without changing suite
names. Sixty-eight wrapper call sites become scoped acquisitions: 30 temporary
directories, twelve tracked repositories and 26 proof-coordinator repositories.
No timeout, property budget, assertion, native filesystem or git subject was
removed or weakened.

Temporary directories use makeTempDirectoryScoped. Tracked repository setup
runs inside that ownership. The proof coordinator registers its lock, fallback
and claim cleanup through acquireRelease. Its runtime-root override still wraps
both coordinator acquisition and the existing test program; nested repositories
remain on the same disposable runtime root. Scope finalizers surface filesystem
cleanup failures as defects via orDie; they are not ignored. The outer directory
scope remains responsible for the complete root when setup or cleanup fails.
MemoryStats and configuration stubs are supplied as pure service values.

Two native journal contention cases use TestClock.withLive around their existing
programs. The first draft inherited the test clock and timed out those two cases
at their unchanged 30-second limits (168 passed, two failed). The native retry
loops need the same advancing clock that their previous runPromise boundary
provided. The final migration preserves that clock only for those two cases.
The existing explicit test-clock case remains intact. Failed-draft results are
archived separately from the final comparison.

## Preserved behavior and proof

All 545 assertion call trees exactly match pre-migration traversal order after
normalizing redundant parentheses and formatting. All 170 file/fullName test
registrations have identical multiplicities across before/after Node and Bun
runs, with zero failures or skips in the final cohorts and stable source hashes.

| Runtime | Before | After | Tests |
| --- | ---: | ---: | ---: |
| Node | 25.622 s | 19.956 s | 170 |
| Bun | 20.966 s | 15.139 s | 170 |

The before runs overlapped the docgen package audit and higher workstation load.
Load, pressure, runtime versions and source hashes accompany the receipts. These
single observations do not prove a causal performance improvement. Actual test
compiler diagnostics have exit code zero and empty output. Biome and diff checks
pass.

Extracted copies of the actual final resource constructors pass five controls
under Node and Bun: success, failure, interruption, setup failure and cleanup
failure. Successful acquisition releases lock, claim and fallback files before
the enclosing root is removed. Setup and cleanup failures remain visible and
the outer scope removes the root. These controls use inert git setup and a
fixed lock-path seam; the installed 170-test suite supplies real git and
coordinator behavior coverage. The controls do not replace that integration
proof.

## Detector, inventory and remaining judgments

The root ratchet passes over 1,217 files with 3,465 findings, zero introduced
and 1,552 resolved. This batch removes 79 live findings without any baseline
anchor or membership edits. Its shorter environment-restoration helper and
native-filesystem judgment remain open.

All 74 historical runtime rows have exact recorded line/evidence matches in
committed source and a unique unchanged test title in the pre-migration source.
Five initially appeared ambiguous because the private comparison retained a
trailing space after truncating the evidence. The detector trims after its
200-character cutoff. Matching that canonical operation resolves all five;
no heuristic correspondence or finding waiver is needed.

Three older rows (one direct decoder runtime plus the verdict property's runtime
and direct-Arbitrary call) belong to upstream b1aa7e320c, PR #1200. Original
evidence matches its parent commit. Both current registrations exactly match
its landed source after whitespace normalization, including the schema arbitrary
and fcRuns(32). Both cases pass in the same 170-case Node/Bun cohort.

The ledger closes 79 historical rows for this migration and three upstream rows,
and records four provider judgments exposed by the runtime-only draft as fixed
by the combined migration. No baseline entries were added for intermediate
findings. The CLI ledger now has 1,356 fixed, seven exception and 2,105 open
records: 3,468 strict schema-valid, unique rows. Only the shorter environment
wrapper and native-filesystem judgment remain open in yeet.test.ts.

Full CLI package verification passed for source 75fa5f2713: audit 682.7 seconds
and docgen 20.9 seconds. Package source remained unchanged during the proof;
intervening edits updated only packet documentation and inventory. The preceding docgen migration has its own completed full
package proof in cli-docgen-runtime-resource-proof.md. No hosted readiness or
goal completion is claimed. Private receipt prefixes are cli-yeet-runtime,
cli-yeet-resource, cli-yeet-final-detector, cli-yeet-assertion-preservation,
cli-yeet-history-lineage and cli-yeet-ledger.
