# Local verification reuse, 2026-11-06

Fable round 2 proposed reusing final-check's entire cheap battery and removing
duplicate root lint sweeps after a policy run widens to full scope. This change
accepts the sweep consolidation and preserves a live Cache qualification guard.
It does not enable blanket cheap-battery reuse.

## One owner for full root sweeps

Final-check now asks the existing lint-policy scope resolver before planning. A
validated full scope and sweep configuration produce an explicit
`beep lint policy --full --base <merge-base>` command. That command owns the
root documentation sweep, so final-check omits its separate duplicate. When the
configured deprecated-API engine is oxlint, the full policy command also owns
that root sweep and final-check omits its duplicate.

A policy configured to use Turbo still retains final-check's independent full
deprecated-API command. A changed scope, an unavailable probe or unreadable
configuration retains both existing standalone guards. The child command is
explicitly full; a second scope decision cannot silently narrow it after the
parent omitted a guard. Existing command arguments and proof identity distinguish
this plan from an affected command. No log parsing, new persisted receipt or
fabricated successful substep is involved.

The documentation plugin is still rebuilt by its existing owner, with the
existing source-config fallback if prebuilding fails. The final-check dirty-tree
and moved-tree checks, command failure handling and exact-input resume remain.

The reviewer observed 6.7 seconds for a separate docs command and 38.4 seconds
for a separate deprecated-API command on one previous receipt. Whether that
receipt's first policy command had widened was not recorded. Those durations
therefore establish neither confirmed duplicate time nor a measured saving here.
The implemented full plan removes two subprocesses in the oxlint case, one in
the Turbo case, and none when scope/configuration is unknown or affected.
Five sequential read-only scope/config probes in the real checkout took 106.04,
94.95, 104.10, 86.01 and 87.36 ms (median 94.95 ms). Every sample selected full
scope and read the configuration. This measures the incremental calls inside
one process, excludes CLI startup, and executes no lint body. End-to-end gains
have not been measured.

## Keep independent Cache authority live

The existing lane-proof identity captures source, head, base, command,
environment and Bun/Node/host facts. A qualified Cache policy also authenticates
acceptance against independent approval stores and current hosted-producer
facts, and that acceptance can expire. Those mutable authority facts are not
part of the lane-proof identity. `quality:cache-policy` now joins the existing
non-reusable security/audit lane IDs and always executes.

Existing acceptance tests demonstrate refusal after advancing the clock by
25 hours, changing the accepted producer attempt, or changing independent
approval/file posture. The inspected qualification ledger currently has five
excluded entries. This is a latent correctness guard for supported qualified
policy, not evidence that an excluded entry produced an observed stale pass.

Blanket cheap-battery active reuse remains rejected. The cited security and
Bun-audit exclusions are not themselves cheap-tier members. A later narrow
source-check allowlist needs collector support and independent lane eligibility
validation; this change adds neither that API nor another cache protocol.

## Validation and reversal

Focused controls cover explicit-full dispatch, retained fallback guards,
Turbo-engine refusal to drop the root API sweep, both public calling forms,
failed full-command propagation without invented sweep credits, and live
cache-policy execution after ignored acceptance posture changes. The acceptance
posture fixture models the live leaf; it does not impersonate a real qualified
production ledger.

The three final-check/deduplication/wiring suites pass 143 tests. Package quick
verification passes lint (1.6 seconds) and check (9.5 seconds). After merging the
main OwnerCheckpoint repair, the combined hook/final-check package verification
passed audit (219.1 seconds) and docgen (53.3 seconds). A bounded replay of the
143 focused tests measured FinalCheck L/S/B/F coverage at
98.35/97.97/92.04/94.36 percent, above the earlier focused source floors.
Scoped Fallow audit passes for the six changed CLI files with no dead-code,
complexity or duplication findings. The existing Effect-Vitest detector reports
no introduced findings in the three changed final-check tests; the existing
wiring finding is unchanged. Scoped `docgen:local` also passes.
These controls establish dispatch and verdict behavior; no end-to-end speedup
was measured.

Reversal restores the two unconditional final-check root sweep steps. The
cache-policy refusal can remain independently; it changes no receipt format or
migration contract.
