# Docgen runtime and resource migration proof

Source commit `f309935aded4bdba9dbbe0a624aae69145710a90` replaces 60 direct
runPromise callbacks with public Effect tests. All 19 explicit test options
are retained in the public effect tester argument position. The 73 temporary
repository wrapper calls now acquire a scoped repository inside their existing
generators. Node services, crypto, HTTP, FsUtils and TSMorph belong to it.layer;
the shared TSMorph service relies on the separately proved repository-isolation
repair in `f26bf72626` (see tsmorph-repository-isolation-proof.md).

Each temporary directory registers deletion before cwd acquisition registers
restoration. Finalization therefore restores cwd before removing the directory,
and a subsequent .git creation failure also releases both resources. The suite
runs without concurrent tests. Fresh TestConsole.make instances preserve local
capture. Process, Configuration, Runpod, HTTP and child-process stubs are pure
service values supplied directly; no per-test resource layer remains. The git
command helper uses the public spawner exitCode operation, which owns the
shorter process lifetime, and retains the original zero-exit assertion.

## Focused proof

All 339 assertion call trees match their pre-migration traversal order after
normalizing only parentheses and formatting. Matcher polarity and arguments are
unchanged. All 83 file/fullName registrations have identical multiplicities in
four before/after Node/Bun executions, with zero failures or skips and stable
source hashes throughout each run.

| Runtime | Before | After | Tests |
| --- | ---: | ---: | ---: |
| Node | 7.075 s | 7.928 s | 83 |
| Bun | 4.622 s | 4.773 s | 83 |

The before cohort was refreshed after the TSMorph repair, so both cohorts use
the same fixed dependency. Source hashes cover CLI and repo-utils. Load,
pressure, runtime versions and limits accompany the timing receipts. The
workstation was busier during the after cohort; these single observations do
not establish a causal performance change. Earlier pre-repair runs are archived
separately and are not used in this comparison.

Actual package-test-typecheck diagnostics have exit code zero and empty output.
Biome and diff checks pass. Extracted copies of the actual repository fixture
pass Node and Bun controls for success, typed failure, interruption, cwd
acquisition failure and .git creation failure. All five restore cwd and remove
the allocated directory. Fresh-console controls pass independently. These
controls support lifecycle behavior; the installed-suite proof is the 83-test
execution, not the extracted controls alone.

## Detector and inventory

The root ratchet passes over 1,217 files with 3,544 findings, zero introduced
and 1,473 resolved. This batch removes 80 live findings. One existing native
platform provenance anchor changes because the redundant named spawner import
is gone; baseline membership and severity remain unchanged. The native
filesystem choice remains an open judgment: consolidating imports into
NodeServices does not itself prove Memory conformance or justify an exception.
Both historical native-platform rows remain open.

Seventy-nine historical rows are fixed: 60 runtime boundaries, seven provider
judgments and twelve wrapper findings. Every runtime boundary is identified in
the original census source by exact recorded evidence and maps to one unchanged
test title in the pre-migration source. Six runtime expressions are identical;
54 contain earlier edits whose proof belongs to their earlier batches. This
batch preserves the complete pre-migration assertion trees. Four additional historical rows (two runSync and two direct-property rows)
map to upstream b1aa7e320c (PR #1200). Their original evidence matches the census,
and both current property registrations exactly match that upstream commit,
including schema arbitraries, equivalence checks and fcRuns(16). The two
properties pass in the same Node/Bun cohorts.
The CLI ledger contains 1,270 fixed, seven exception and 2,187 open records
(3,464 total), strictly schema-valid with unique IDs.

Full CLI package verification passed for source f309935ade: audit 777.9 seconds
and docgen 20.4 seconds. Source remained unchanged during that proof; the
intervening edits updated packet documentation only. No hosted readiness or goal completion is claimed. Private
receipts use cli-docgen-runtime, cli-docgen-resource, cli-docgen-final-detector,
cli-docgen-assertion-preservation, cli-docgen-lineage and cli-docgen-ledger.
