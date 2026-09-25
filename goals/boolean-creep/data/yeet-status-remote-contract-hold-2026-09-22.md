# yeet-status-remote-check-phase

Contract audit at `0be1f13d62fa00cb65e34ff69ec99043380f8d81`,2026-09-22.
Proposed hold: no replacement qualified inventory row or legal count yet.

## Current shape

YeetStatusRemote in packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts
230-263 is an exported persisted schema with required available/checked:Boolean
and optional isDraft:Boolean, without defaults on those three fields. Its only
schema description is optional remote PR summary; no field annotation establishes
availability/checking/draft implications. Current writer family969/1037/1044/1083
uses skipped, checked-absent and checked-present known-draft states. Legacy tests
also support checked-present unknown draft.

Current remote has27 fields, including new checks and labels arrays, both with
empty-array key/constructor defaults. The old design's25-field inventory is stale.
Retain detail; all11 optional finite numeric count/PR fields; optional merge,
rerun,review,state,url strings; legacy unresolvedReviewThreads array; optional
Option-valued unresolvedThreads/headSha and nested thread payloads/defaults.
checks and labels are independent siblings, not new restrictions on the triple.

## Cardinality gap

The complete triple has12 strata:2×2×3. Five are exercised or produced:
FF/absent, FT/absent, TT/absent, TT/false, TT/true (available,checked,draft).
The seven disputed tuples are TF/absent, TF/false, TF/true, FF/false, FF/true,
FT/false and FT/true. The old12/5 qualification treats each as invalid, but its
historical independent correction expressly reasons about a produced draft value.
That establishes writer coverage, not an exported persisted-domain exclusion.

Current guards return defined behavior for disputed tuples: readiness1234 and
thread rendering1404 return None/not-checked unless both flags hold; next command
1280 can consume available even when unchecked. These are not rejection guards.
No narrower legal count or D1 independence is asserted. Owner contract is needed.

## Target schema

Do not admit the old five-phase union until the user settles whether these
relations are required for all accepted summaries: available implies checked;
a present draft value implies both available and checked. If both are required,
12/5 follows and unknown draft on checked-present remains distinct from false.
If only availability implies checked while draft metadata may survive unavailable
states,12/9 is the corresponding projection. If neither is required, the triple
alone has no proven cardinality gap. These are conditional options, not decisions.

No new codec or canonical phase is proposed during this hold. Preserve raw values
and siblings rather than normalizing stale draft data away. A later schema must
cover the chosen full contract, with no unsupported payload restrictions.

## Migration inventory

No source migration is authorized. Future owner audit must include Status schema,
remote collection1025-1115, deriveYeetMergeReady1230-1249, next-command1252-1285,
check/thread/summary renderers and snapshot artifact writer; Handler status JSON
at1385 plus rerun/unresolved consumers1080/1106; MonitorLoop admission1031,
required check census1074, head settlement1169, terminal1293/1322 and rerun1413.
Yeet/index.ts33 exports the schema, with test facade and direct test imports.

Current fixtures occur in yeet-status-triage, yeet-artifact-writers, yeet,
yeet-monitor-ready and yeet-settle tests. New monitor readers use checks/labels
independently. In particular admission1036 treats unknown draft as false through
??false, whereas merge readiness1240 requires explicitfalse. Preserve both
existing consumer-specific policies; do not globally reinterpret unknown draft.

## Guard-deletion accounting

None approved. Old proposed deletions assume five legal phases. Available/checked
compound guards currently define behavior rather than reject invalid input.
Keep counts, review fallbacks, head binding, readiness criterion order, monitor
admission and exact-head settlement untouched. New checks/labels defaults and
registered required-check accumulation are not this owner's deletion credit.

## Encoded-side impact

Preserve yeet-status/v1 and all27 fields/defaults. Draft absent, false and true
remain distinct. No false/null substitution or omitted-key default is introduced.
Keep full strings, finite numbers including supported negative/fractional values,
zero versus absence, and None versus Some(empty array).

Artifact serialization applies YeetStatusSnapshotJson; Handler1385 prints the
runtime snapshot through generic printCommandJson. These are different established
representations, including Option payloads. A later migration must preserve each
boundary independently rather than quietly replacing CLI output by artifact
encoding. No private phase may leak to either boundary if a phase is authorized.

## Test impact

The private finite table lists all12 tuples, the five historically supported
ones and seven requiring a ruling. No tuple is marked legally invalid before the
owner decision. Existing source/fixtures were inspected without running Yeet,
GitHub calls, proof jobs or serializers. No runtime/schema acceptance proof.

Following a ruling, test its complete domain through public constructors/codecs,
both output boundaries and each consumer's own unknown-draft behavior. Retain
check/label defaults, rich thread payloads, legacy unknown draft, full snapshot
output/newlines and bounded output behavior. Run required CLI package verification
only after authorized source edits, then campaign/Yeet gates.

## Risk

The prior independent census supports five observed/supported tuples but does not
supply the missing normative exclusion. Reusing it as P3 approval or hardening a
persisted public schema to writer reachability would silently narrow the contract.
Keep historical row/design unchanged in archive if parent withdraws the live row;
track the unresolved owner outside inventory/v1, without D1 or dry-round credit.
Remaining question: must available imply checked, and may an optional draft value
survive unavailable/unchecked summaries as stale metadata?
