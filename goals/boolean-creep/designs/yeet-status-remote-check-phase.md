# Instance

- id: `yeet-status-remote-check-phase`
- source: `3ba9c6bc603e73732ba18e40a29781ac87156a41`
- file:line: `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:244`
- symbol: `YeetStatusRemote`; members: `available`, `checked`, `isDraft`
- classification: E4; stored; persisted; literalkit; Tier 2 singleton
- authority: `DECISIONS.md`, 2026-09-24 constitutional citation and remote status rulings

This is a full current-owner P2 proposal following the explicit owner ruling.
The seven exclusions are authorized contract restrictions, not conclusions from
producer reachability. The historical hold remains accurate for its date.
No source implementation, independent P3, dry census, or GATE 2 credit is claimed.
File references below are under `packages/tooling/tool/cli/` unless qualified.

# Current shape

`src/commands/Yeet/internal/Status.ts:244-281` exports an S.Class with **31 fields**.
Three are the selected axes: required `available` and `checked`, and exact
optional `isDraft`. No selected field has a default. The encoded field order is:

```text
available, checked, detail, checks, checkCount, failingCheckCount, isDraft,
labels, mergeStateStatus, mergeable, number, pendingCheckCount,
requiredCheckCount, failingRequiredCheckCount, pendingRequiredCheckCount,
optionalCheckCount, failingOptionalCheckCount, pendingOptionalCheckCount,
unresolvedReviewThreadCount, unresolvedReviewThreads, unresolvedThreads,
followUpThreadCount, followUpThreads, acknowledgedThreadCount,
acknowledgedThreads, headSha, rerunFailedCommand, rerunFailedDecision,
reviewDecision, state, url
```

All **28 independent siblings** survive. Required detail accepts all strings.
The thirteen optional finite numbers are checkCount, failingCheckCount, number,
pendingCheckCount, requiredCheckCount, failingRequiredCheckCount,
pendingRequiredCheckCount, optionalCheckCount, failingOptionalCheckCount,
pendingOptionalCheckCount, unresolvedReviewThreadCount, followUpThreadCount,
and acknowledgedThreadCount. Do not impose positivity, integrality, matching
array lengths, phase presence, or cross-count relationships.

The seven optional strings are mergeStateStatus, mergeable, rerunFailedCommand,
rerunFailedDecision, reviewDecision, state and url. unresolvedReviewThreads
remains an optional array of strings. checks retains YeetSettleCheck elements;
labels retains strings. Both retain existing empty-array key and constructor
defaults. unresolvedThreads, followUpThreads, acknowledgedThreads and headSha
retain their OptionFromOptionalKey codecs and None constructor defaults.
Each nested review thread at Status.ts:215-229 preserves required threadId,
author and excerpt, and optional-key Options path, finite line and finite
commentDatabaseId with their existing defaults. No new thread restrictions.

The previous 27-field hold predates four new follow-up/acknowledgement fields.
Readiness now counts unresolved plus follow-up threads at Status.ts:1388-1401;
acknowledgements remain advisory. Preserve these current semantics.

Status.ts:311-336 nests remote in the full snapshot, including timeline,
mergeReady, staleGates and unprovenGates. Artifact encoding uses
YeetStatusSnapshotJson at :359 and writeYeetStatusSnapshot at :1806.
Handler.ts:1421 instead passes a decoded snapshot to generic printCommandJson.
The distinct serializers are both supported output boundaries.

# Cardinality gap

The old schema represents 2 × 2 × 3 = **12** tuples. The owner explicitly requires
available => checked and present draft => available AND checked. Exactly five
are legal. Draft absence remains distinct from false. Independent payloads do
not change this projection and remain unrestricted by phase.

| available | checked | isDraft | Result / phase |
| --- | --- | --- | --- |
| false | false | absent | skipped |
| false | false | false | reject |
| false | false | true | reject |
| false | true | absent | checked-absent |
| false | true | false | reject |
| false | true | true | reject |
| true | false | absent | reject |
| true | false | false | reject |
| true | false | true | reject |
| true | true | absent | checked-present-draft-unknown |
| true | true | false | checked-present-not-draft |
| true | true | true | checked-present-draft |

Corroborating writer family: Status.ts:1197 (skipped), :1265 and :1272 (checked absent),
:1310 (checked present with view.isDraft). E4 is the explicit owner contract in
DECISIONS, corroborated by readiness :1473-1478 and rendering :1686.
Those readers and producers alone were insufficient to exclude historical schema
inputs. E1 exclusive-write qualification is not claimed: the skipped constructor
does not establish mutual exclusion. The current exported codec accepts all
twelve tuples; the owner ruling supplies the normative E4 phase implications.

# Target schema

Retain ownership in the existing tooling CLI Status module. No new package,
shared-kernel promotion or general-purpose schema concept is needed.
Define annotated `YeetStatusRemotePhase = LiteralKit([...])` with exactly the
five accepted labels above, no inline `as const`, and derived same-name type.
Use the existing canonical LiteralKit primitive; namespace-first imports apply
when consuming multi-member @beep/schema concepts. Preserve kit helpers after
annotation using its supported primitive rather than hand-copying statics.

A private annotated S.Class `YeetStatusRemoteValue` owns phase plus the exact
28 sibling fields. All three old selected axes disappear from decoded business
state. No available/checked/isDraft getters, duplicate draft Option, redundant
booleans or compatibility domain alias remain. The five phases require no
distinct sibling payloads, so a LiteralKit field is sufficient.

A private encoded-boundary S.Class `YeetStatusRemoteEncoded` retains the exact
31-field legacy layout, schemas, order and defaults. Reuse a single private
sibling field definition when deriving both classes; do not fork sibling shapes.
The business constructor is Value, not the legacy flat class.

The exported `YeetStatusRemote` becomes a compatibility codec and same-name Type:
`YeetStatusRemoteEncoded.pipe(S.decodeTo(S.toType(YeetStatusRemoteValue), mapping))`.
S.toType is required because the mapping already receives decoded Option values;
its target must not attempt OptionFromOptionalKey a second time. A schema-owned
fallible decode maps the five tuples and rejects the other seven through
SchemaGetter.transformEffect and SchemaIssue.InvalidValue. Encode uses
SchemaGetter.transform and kit-derived matching for the total inverse. Both
explicitly omit replaced fields rather than spreading legacy axes into Value
or leaking phase into output. Defaulting and scalar validation remain at the
legacy boundary before phase selection. Missing required flags, explicit null,
and explicit undefined retain the exact existing field validation behavior.

Current Effect reference: Schema.ts:2500 (toType), :5439-5470 (decodeTo),
SchemaGetter.ts:742 (transformEffect), :702 (transform), SchemaIssue.ts:747
(InvalidValue). **transformOrFail from the historical design is absent from
the current SchemaGetter API** and must not be reused. The current API accepts
Effect success/failure getters with ParseOptions. This is inspected API evidence,
not a compiled or executed implementation proof.

Derive a second private boundary codec from S.toType(YeetStatusRemoteEncoded)
through the exact same mapping to S.toType(Value). Its Encoded is the old decoded
remote with runtime Options; it restores generic CLI JSON input without changing
artifact output. A narrow internal printYeetStatusCommandJson encodes only
snapshot.remote with that codec, reconstructs the snapshot with remote at its
existing property position, and delegates to the unchanged printCommandJson.
Do not replace CLI output with whole-snapshot artifact encoding. The separate
readiness design may also adapt mergeReady: when both owners land, compose both
bounded projections once in this printer, without serializing either twice.

Export phase kit/type through the existing Yeet facade so consumers and tests
can name phases. Keep Value, Encoded and mapping private. Replace all public
YeetStatusRemote.make examples/fixtures with legitimate Effect or Result decode;
do not add an old-shape `.make` shim. Export the command printer only internally
for Handler and the focused test facade when needed. All new exported symbols
require the repository's titled Example/Details JSDoc and identity annotations.

# Migration inventory

| Current site | Required migration / preservation |
| --- | --- |
| Status.ts:235-281 | Replace public class and example with the codec, phase and private models. |
| Status.ts:289-359 | Update snapshot example; retain all outer fields, timeline, defaults, version and JSON codec. |
| Status.ts:1197 | Construct skipped Value, preserving detail. |
| Status.ts:1252-1346 | Construct checked-absent on each no-PR/truncated branch; checked-present known draft from view; preserve GitHub decode, check summarization, full triage including follow-ups/acknowledgements, head binding, rerun guidance and omissions. |
| Status.ts:1360-1410 | Preserve independent checks, merge/review policy, outstanding count and closeout/head binding. |
| Status.ts:1472-1489 | Present-phase membership replaces flags; only not-draft phase supplies notDraft=true. Preserve dual forms and all independent criteria. |
| Status.ts:1495-1551 | Preserve thread-only-blocker rule and command priority: repair, dirty publish, checked-absent PR creation, present remote guidance, fallback. |
| Status.ts:1571-1609 | Collect snapshot with phase model; retain next-command and readiness computation and all outer fields. |
| Status.ts:1619-1628 | Only skipped short-circuits checks rendering; checked-absent may still have count payloads. Preserve required/legacy/no-count precedence. |
| Status.ts:1685-1716 | Present-phase membership replaces compound guard; preserve structured unresolved/legacy fallback and separate follow-up and acknowledgement sections. |
| Status.ts:1768-1788 | Replace checked conditional by skipped predicate; all checked phases display original detail. Preserve exact line order. |
| Status.ts:1806-1819 | Retain artifact error mapping, path, writing and newline. |
| Status.ts:1875-1888 | Retain dual test helper with migrated type. |
| Handler.ts:1089-1092,1126-1145 | Preserve rerun suffix and count-based unresolved+follow-up enforcement; acknowledgement is advisory; payload lists alone cannot waive counts. |
| Handler.ts:1408-1426 | Keep artifact write first, human comment replay only outside JSON, and use narrow JSON projector at :1421. Keep current YeetCommandError message. |
| MonitorLoop.ts:1042-1050 | Convert draft using phase kit: true only for checked-present-draft. All other legal phases retain existing local false fallback, including unknown. |
| MonitorLoop.ts:1085-1109,1127,1170-1203,1293-1337,1373-1377,1403-1440 | Preserve checks/labels admission, registered census, head identity, lifecycle terminals, announcement and rerun policy. Do not gate independent sibling observations by phase. |
| src/commands/Yeet/index.ts:33; src/test/Yeet.test-kit.ts | Preserve facade and codec type; expose phase and focused printer through lawful existing paths. |
| test/yeet-status-triage.test.ts | Migrate openRemote :86-119 and make fixtures :160,:181,:201,:214,:283,:350,:474,:593,:615,:634,:692,:822,:835, including unknown-draft rendering and readiness. |
| test/yeet-artifact-writers.test.ts:354 | Migrate whole-snapshot fixture and extend exact artifact coverage across all phases. |
| test/yeet.test.ts:168-171,2533-2604 | Keep decode/encode helpers; replace make fixtures; retain full codecs and rendering/command coverage. |
| test/yeet-monitor-ready.test.ts:60-116 | Migrate remote fixture; preserve admission, check census and readiness behavior. |
| test/yeet-settle.test.ts:71,186-214,903-920,959,1168 | Migrate decoding/fixtures and updates; preserve arbitrary independent sibling updates and settling. |

Search combined exhaustive symbol and selected-field queries, caller closure,
parent snapshot consumers, source-wide field confirmation and facade inspection.
The empty class caller graph is not evidence of no consumers. No remote.fields
consumer or additional source selected-axis consumer was found. Refresh this
inventory if any source hash changes before implementation.

# Guard-deletion accounting

- Remove available, checked and isDraft from Value; they exist only in actual
  encoded/legacy-runtime boundaries, whose mapping is the sole tuple validator.
- Delete four producer families' paired flag assignments and live draft copy;
  choose one phase, keeping every independent sibling.
- Delete Status.ts:1473 and :1686 compound availability/checking guards; replace
  with derived present-phase membership.
- Delete :1478 draft-false comparison; use not-draft phase. Unknown still fails.
- Replace :1545/:1546 reconstruction with checked-absent/present membership,
  retaining ordering and exact guidance.
- Replace :1620 and :1778 checked observations with skipped membership.
- Replace MonitorLoop.ts:1047 optional draft fallback with known-draft membership.
  This is consumer-specific behavior, not global unknown-to-false normalization.
- No credit for deleting payload checks, defaulting, review count/array fallback,
  current-head tests, first-criterion ordering, census binding, process errors,
  admission policy, or settlement conditions: those represent independent facts.

# Encoded-side impact

All five supported tuples retain legacy encoding: required available/checked and
omitted/false/true draft exactly. Phase never leaks. Seven tuples now reject by
explicit ruling, with no silent normalization or stripping supplied known keys.
All 28 siblings remain legal in all five phases as before; preserve negative and
fractional finite counts, zeros/absence, empty strings/arrays, unknown enum-like
strings, nested threads and None versus Some(empty array). No payload constraint
follows merely from observed producer output.

Keep `yeet-status/v1`, all outer snapshot fields including timeline, JSON key
order and newline behavior. Artifact Options encode through the schema. Generic
CLI output receives restored runtime Options through the shared inverse and
keeps current unknown-value JSON semantics, output injection and chunk handling.
Preserve existing field defaults rather than promising omission where the old
codec already materialized defaults. Compare against the old encoder's canonical
output, not identity on noncanonical input bytes. No artifact rewrite or version
bump is required for this owner-authorized restriction.

# Test impact

1. Enumerate all twelve tuples through public decode: five accept and round-trip;
   seven reject. Verify phase, absence versus false/true, no decoded old axes,
   no encoded phase, missing flags and existing explicit undefined/null behavior.
2. Derive Value arbitraries/equivalence from production schemas. Round-trip minimal
   and maximal sibling data across every phase, checks/labels defaults, all four
   Options, None and Some(empty/nonempty), negative/fractional/zero counts,
   empty strings, legacy arrays, nested optional thread fields and timeline.
3. Preserve readiness: skipped/checked-absent yield None; unknown and draft fail
   notDraft; only explicit non-draft can pass that criterion. Preserve all other
   criteria, criterion order, head binding and thread-follow-up gating.
4. Preserve Monitor admission: unknown draft and absent remote yield local false,
   draft=true yields true, with labels/changed paths unchanged. Independently test
   settled-check census, absent head, merged/closed terminal and rerun behavior.
5. Capture actual artifact bytes and real Handler status JSON bytes independently
   for all phases with rich Options and outer fields. Retain generic stdout
   injection, payload above64KiB, compact serialization and exactly one newline.
   Generic output must never be justified by artifact-only tests.
6. Preserve rendering and command priority including checked-absent count payloads,
   follow-up sections versus acknowledgements, thread-only remediation guidance,
   dirty-worktree precedence, and non-JSON comment replay without JSON pollution.
7. After GATE2 and authorized implementation, run owning CLI checks/tests,
   `bun run beep lint schema-first`, exported-doc `bun run docgen:local`, and
   `bun run beep quality package-verify @beep/repo-cli`, followed by campaign Yeet
   proof. No package tests were run for this design-only proposal.

# Risk

Tier2 singleton after fresh independent P3. Existing historical reviews cannot
approve current fields, Effect API, or the newly authorized public restriction.
Main risks are globally treating unknown draft as false, loss of the four new
triage fields, using outdated transformOrFail, double-converting Options,
leaking phase into generic JSON, or narrowing independent siblings. Acceptance
requires current-source finite proof and independent whole-boundary fixtures.
The separate readiness model remains a separate owner; integrate its bounded
JSON projection once if it lands first. No dependency on unapproved source work
is assumed. Re-audit at the eventual implementation head.
