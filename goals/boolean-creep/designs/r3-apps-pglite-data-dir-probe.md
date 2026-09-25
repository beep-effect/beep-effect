# r3-apps-pglite-data-dir-probe

P2 at `0be1f13d62fa00cb65e34ff69ec99043380f8d81`, 2026-09-22.
Paths refer to apps/professional-desktop unless otherwise noted. No independent
P3 or implementation credit.

## Current shape

src/runtime/Pglite.ts252-292 exports ensureCompatibleChatDbDataDir(dataDir:string).
After obtaining FileSystem and Path services and joining the marker path256,
it stores dataDirExists257, then conditionally obtains markerExists258 or forces
false. It interprets marker first260, then missing directory265; the unmarked
branch reads entries270. These are local derived observations, not persisted
or externally constructible facts. pathExists142-143 catches exists failures and
returns false, so names describe observed outcomes rather than proof of actual
absence. Do not replace error fallback with a new failure or physical-state claim.

## Cardinality gap

| Directory observation | Marker observation | Result |
| --- | --- | --- |
| false | false | missing |
| false | true | impossible: marker never probed |
| true | false | unmarked |
| true | true | marked |

Four representable Boolean pairs, three reachable observation states (4/3).
The implication is directly enforced by the conditional writer258, not inferred
from a lack of examples. Filesystem changes between calls do not add a fourth
captured state: a true marker cannot be recorded after directory false because
that call is skipped. Preserve time/order of observations; no atomic snapshot,
stat/type check, retry, or directory identity guarantee is introduced. The full
path string and eventual directory entries are independent payloads, not extra
Boolean axes. shouldMarkDataDir402 is a separate returned decision.

## Target schema

Define private annotated payload-free ChatDbDataDirMarkerState LiteralKit with
missing/unmarked/marked, using the current narrow @beep/schema/LiteralKit import
and existing identity composer. Preserve literal helper statics through the
repo's annotation pattern. No class wrapper, string union, Boolean getters,
compatibility codec or newly stored lifecycle state.

Classify once at the original observation site: call existing pathExists for
dataDir; false returns missing without marker access. True calls pathExists
for the already-joined markerPath and returns marked or unmarked. Pass existing
FileSystem/path values through this bounded effectful helper, preserving service
access/path-join order and failure-as-false semantics. Do not construct the old
two-Boolean bag inside the helper. Match the one literal exhaustively in the
exported preflight; keep its current Effect environment/error/Boolean result.

## Migration inventory

- Pglite.ts100 marker constant stays .beep-pglite-inprocess-v2; add private mode
  near compatibility definitions without exporting it through app surfaces.
- pathExists142-143 remains exact fs.exists(...).orElseSucceed(false). Neither
  existence error is reclassified as unreadable or retried by this change.
- Replace local bits257-258 and interpretation260-268 with classifier/match.
  Marked runs assertCanOpenInProcessPgliteDataDir then returns false. Missing
  makes the directory recursively then returns true. Neither branch reads entries.
- Unmarked270-292 retains readDirectory; empty returns true, PGlite-shaped entries
  run compatibility open then preserved info log and true, other populated
  entries read Clock.currentTimeMillis, rename to full dataDir + .pre-inprocess-
  timestamp, create original directory recursively, log warning, return true.
  Preserve rename-before-create and failure propagation; no cleanup/new retry.
- hasPgliteDataDirShape145-146 requires existing PG_VERSION/base/global names.
  Do not inspect contents or replace its predicate as unrelated cleanup.
- Compatibility opener185-217 builds bundled layer, executes SELECT1 without
  transforms, scopes resource release, then on failure logs redacted cause and
  fails IncompatiblePgliteDataDir with full cause/dataDir/recovery message.
  Marked and unmarked PGlite failures remain in place, never quarantined.
- Marker writer148-161 and public markCompatibleChatDbDataDir177 remain unchanged:
  recursive mkdir then clock then write runtime/version/createdAtMillis lines
  and trailing newline. No marker write during state classification/preflight.
- PgliteDrizzleLive402-410 keeps Boolean shouldMarkDataDir, real bundled layer
  open, migrations, then conditional marker write. Layer.orDie and provisioned
  services remain unchanged. Do not mark on migration failure or trust marker
  presence as proof the current driver can open the directory.
- Exhaustive source search found this exported function used by its production
  layer and test/integration/PgliteDataDirCompatibility.test.ts only. It is
  directly imported from @/runtime/Pglite; private new mode/classifier need no
  barrel export. Preserve all existing exports and signature.

## Guard-deletion accounting

Remove the two correlated stored local observations, forced-false second value,
and paired marker/missing interpretation. One effectful observation classifier
and exhaustive mode match own the three-state result. Filesystem existence still
requires its original conditional call order; do not claim those physical probes
are deleted. Keep entries-empty/shape checks, open failures, marker-after-migration
Boolean and Layer behavior outside deletion credit. No unrelated helper rewrites.

## Encoded-side impact

Private ephemeral literal has no actual encoding consumer. Preserve on-disk
marker name/content/order/newline, full directory/backup paths, clock sampling,
logs and annotations, typed error cause/dataDir/recovery fields and Boolean return.
No persisted codec/version/changeset requirement arises solely from introducing
this private mode; apply actual touched-package release policy at implementation.
Filesystem mutations remain only those current branches already perform.

## Test impact

Keep integration fixtures146-290: fresh directory, marked compatible/incompatible,
unmarked compatible/prior-incompatible PGlite, non-PGlite quarantine and unreadable
entries; preserve retained bytes and absent backups on failure. Keep production
boot marker-after-migrations test294 onward. Existing fresh fixture manually calls
markCompatibleChatDbDataDir, so it alone does not prove production timing.

Add bounded fake-filesystem call-order checks: directory false skips marker;
directory true probes marker once; exists failure retains false fallback; missing
mkdir and unmarked readDirectory follow the mode. Explicitly distinguish exists
failure fallback from readDirectory failure, which remains a boot failure with
no quarantine. Keep empty unmarked case and rename/mkdir failures; no new live
filesystem/running database work is required during P2. Exercise all three mode
values and rejection of an unknown literal, without exporting private helpers
solely for tests. Preserve complete dataDir strings and already-joined marker.

After implementation run focused PgliteDataDirCompatibility integration checks
and `bun run beep quality package-verify @beep/professional-desktop`, then required
campaign/Yeet gates. This audit runs no product code, database, filesystem fixture
or package verification, and claims no runtime proof.

## Risk

The main risks are treating exists errors as new failures, probing the marker
when directory observation was false, moving path/clock/rename effects, skipping
marked compatibility opens, or writing markers before successful migrations.
The literal models captured observations only; it does not assert atomic state
or introduce stronger filesystem semantics. Land in the approved desktop Tier1
sequence after independent P3 and packet ratification, preserving unrelated app work.
