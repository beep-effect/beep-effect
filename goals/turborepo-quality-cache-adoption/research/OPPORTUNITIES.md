# Friction and opportunities

Record friction as it occurs: work, minimum command/error/file evidence,
impact, prevention and owner/disposition.
Redact secrets, use portable paths, omit machine/session IDs and keep raw logs
in bounded artifacts.

Historical leads remain in the [exploration ledger](../../../explorations/turborepo-quality-cache/research/OPPORTUNITIES.md)
and [opportunity disposition](../../../explorations/turborepo-quality-cache/research/opportunity-disposition.md).
Refresh historical claims before treating them as current.

## 2026-10-28: current population exceeds the retained handoff

`cache census` observes 190 workspaces and 2,571 executable computations,
compared with 145 and 1,984 in the retained qualification handoff. Of the
current computations, 638 have no node in the retained population and 1,923
retain the same command text. Matching command text does not renew the old
runtime or semantic review. The current register preserves the prior review
leads and keeps every final disposition open. Owner: this goal.

## 2026-10-28: native client inference can invalidate a comparison

Launching the published canary binary from this checkout without
`--skip-infer` reports the installed stable version. With that flag, the
integrity-verified binary reports its pinned canary version. The existing pilot
already owns this control. All refreshed probes use that same selection rather
than treating two stable executions as a stable/canary comparison. Owner: this
goal; resolved for the refreshed pin observation, runtime comparisons pending.

## 2026-10-28: workstation timers are not cloud-enforced burst expiry

The earlier temporary runner cap was scheduled to return from eight to two at
12:54:43 UTC. Its local guard recorded restoration at 15:16:41 UTC, 2h21m58s
late. A fresh AWS read confirms cap two. The earlier 3.5-hour compute estimate
is not an actual billing receipt. Do not reuse this local-only procedure as a
hard expiry guarantee; prepare an independently available expiry control before
another bounded burst. Runner-cap control belongs to CI operations, not cache
qualification. The restored cap and original private launch receipts are retained.

### Refresh after source integration

Review found that the population receipt still held pre-integration census
source hashes. Re-ran the existing census and refresh recipe after main
integration; all retained census-source digests now match. Counts remain190
workspaces and2571 executable computations. The recipe now reads explicit UTF-8
and writes UTF-8 with LF under an ASCII locale. Source refresh is inventory
maintenance and grants no qualification or adoption.


## 2026-10-29: Census-source drift survived a later proxy repair

Review on PR #2352 found the population snapshot still retained an earlier
proxy digest. A proof that current census inputs are internally consistent did
not establish that the checked-in derived population had been regenerated.
Re-ran the canonical census and retained refresh recipe, verified every retained
source digest, and compared all population counts. Counts and qualification
states are unchanged. Future source-changing waves must regenerate the derived
population as well as inspecting a newly emitted private census.
## 2026-10-29: Native feature evidence needs the invoked runtime identity

The private controls were initially tied to local absolute paths. The retained
driver removes those paths, checks both client digests and the pinned Bun, and
cleans owned fixtures before success publication. Resolving the multiplexer
symlink and invoking its target directly changes argv-based tool selection;
that failed the Bun-pin preflight before any fixture execution. Resolve the
actual native executable through the selected Bun's `process.execPath` instead.
Both pinned clients now complete all eighteen executions. Description-only
configuration edits also change hashes here, so preserve this observation and
avoid promising metadata-only reuse without a supported implementation.


## 2026-10-29: Current pin blocked by a historical observation domain

The actual collector rejects Bun1.4.4 before qualification because the snapshot
schema permits only1.4.1/1.4.2. Expand observation support for the exact current
pin, while retaining the declared-pin and historical-key barriers. Current
native collection and a real wrong-pin fixture now pass/refuse respectively.
The first scratch driver had an incorrect export and omitted FsUtils; neither
result was accepted as runtime evidence. The retained driver uses curated test
APIs and provides the real platform/admission services.

A known encoded test fixture initially used decodeUnknownEffect. The type check
requires decodeEffect; retain the failed check and its repair. The2.5MiB census
exceeds Biome's default file limit. Keep the retained recipe's JSON serialization
and validate JSON/source hashes directly. Forcing a larger formatting limit
introduced unrelated array-layout churn, which was removed without changing
the observed data or the repository-wide limit.


## 2026-10-29: Ignored non-workspace metadata enters the real lint hash

Both exact pinned clients include an owned Git-ignored tmp/package.json fixture
in the real identity lint dry plan. The selected input count rises1153to1154
and its task hash changes; cleanup restores the exact original hash in both
clients. No quality task executes and no remote cache is used. Root-wide
metadata globs are a narrowing candidate, but exclusion still requires tracing
the wrapper's real reads and proving actual output/verdict equivalence. The
current task remains cache:false. Keep that work in this active adoption goal.
