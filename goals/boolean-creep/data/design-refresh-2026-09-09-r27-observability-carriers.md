# R27 observability carrier adjudication

Native read-only source adjudication; not an independent Grok census, P3 review,
design approval, or lifecycle advance. Proposed inventory records below are a
handoff for parent integration and independent correction, not admissions made
by this file.

Source HEAD: `8f266b878445ca8a7f751f9248da428a4dde39a1`.
Corpus `origin/main`: `663904610cce2a38c06b0619a8c414646b69361c`.
Both refs were checked locally; no fetch, merge, or git mutation was performed.
The unrelated local `main` branch is not the corpus pin.

Scope: all ten records in
`data/sweeps/refresh-2026-09-09-r27-main-663904/r27-tooling-library-observability.jsonl`,
the four seed declarations named in that lane's execution receipt, and directly
encountered existing readiness owners and attribution migration dependencies.
Paths below are repository-relative. Source references identify the frozen
checkout. Tests are producer/compatibility evidence, not additional census roots.

The applicable boundary is carrier eligibility before cardinality: actual
named/returned data and genuine optional payload or literal alternatives can
qualify. An anonymous function input or a predicate fabricated from a required
number/string does not supply another member. D2 requires an external mirror;
the application's sanitized telemetry projections do not become D2 merely by
crossing DuckDB or Phoenix. The schema-first-development skill was consulted.

## Disposition of every raw record

| Raw id | Source disposition | Exact parent action |
| --- | --- | --- |
| `r27-tooling-library-observability-outcomes-dataset-scorecard-presence` | Eligible returned data; E1/E3/E4; 4/3 | Retain proposal; change kind from `sibling-state` to `object-literal`; preserve derived/wire/Tier 2 and the present scorecard payload. |
| `r27-tooling-library-observability-config-snapshots-dataset-presence` | Eligible returned data; E1/E3; 4/2 | Retain proposal; change kind to `object-literal`; the id's absence is real in the returned arms. |
| `hook-pulse-v1-owned-fields` | Eligible canonical schema; E1/E2; raw cardinality omits a literal alternative | Expand members to include `hookEvent`; correct 12/5 to 162/14. The original three-member projection alone is 18/6. Independently correct the Grok count and codec-direction description before admission. |
| `ai-metrics-source-attribution-thread-spawn` | Eligible application-owned attribution; E1/E4; 9/5 | Retain proposal; correct `storage` to `derived` and direct `exposure` to `internal`; retain Tier 2 for coordinated encoded consumers and the public `.fields` dependency. No standalone persistence of this class was found. |
| `ai-metrics-discovered-transcript-file-thread-spawn` | Eligible application-owned discovery result; E1/E4; 9/5 | Retain proposal; correct direct `exposure` from `persisted` to `wire` (public discovery JSON/CLI), derived/Tier 2. |
| `ai-metrics-otlp-turn-export-row-thread-spawn` | Eligible application-owned joined row, but raw E4 and E3 explanations are false | Replace evidence and 9/5 with the supported 9/7 table below. Independently correct Grok before admission; do not force current session provenance onto historical turns. |
| `scorecard-summary-row-completion-ready` | OUT OF NET: one Boolean plus three required numbers | Reject; do not add a D1/D2 row. Existing summary-readiness design already owns this SQL-reader seam, and its own count-axis eligibility must also be corrected. |
| `ai-metrics-benchmark-run-input-passed-quality-gate` | Eligible named input schema; D1 | Retain D1. `qualityGate` is the full four-value literal domain, independently recorded beside `passed`. |
| `benchmark-run-annotation-row-passed-quality-gate` | OUT OF NET: `passed: S.Boolean`, `qualityGate: S.String` | Reject; do not copy the upstream four-value schema into a declaration that actually says required `S.String`. It is not a second Boolean/presence/literal member here. |
| `agent-effectiveness-phoenix-sync-new-options` | Eligible named type; D1 | Retain D1 with corrected note: `dryRun` is required in this type; its default belongs to the separate input class. |

Native result for the ten raw rows: six eligible qualified proposals, two
eligible D1 proposals, two out-of-net rejections. This is not permission to count
the raw lane's seven claimed qualifications as seven accepted discoveries.

## Dataset outputs: two real returned carriers

`outcomesDataset` at
`packages/tooling/library/ai-metrics/src/agent-effectiveness.ts:3391` builds the
output at `:3401`. Its actual returned object at `:3404` contains two Boolean
values. The `onSome` object at `:3405` contains `completionReady`,
`scorecardPresent`, `scorecardId`, and `totalScore`. These are object properties,
not the flags of an anonymous function parameter. The wrapper's generic record
type at `:1541` erases the relationship; it does not erase the source carrier.

Full selected-member table, ordered `(completionReady, scorecardPresent)`:

| Legal tuple | Source witness and payload |
| --- | --- |
| `(false, false)` | `latestScorecard=None`; `:3404` returns both false, omitting both payload keys. |
| `(false, true)` | `latestScorecard=Some(unready scorecard)`; `:3405` copies false and writes both payload keys. A persisted unready row is explicitly constructed in `test/agent-effectiveness.test.ts:109`; the query reads its stored bit at `src/agent-effectiveness.ts:2702` and forwards it at `:2732`. |
| `(true, true)` | `latestScorecard=Some(ready scorecard)`; the ready summary constructor is documented at `src/agent-effectiveness.ts:800`, and `test/ingest.test.ts:1119` asserts a produced ready weekly scorecard. The same `:3405` arm copies true. |

`(true, false)` has no producer. Required `totalScore` may be zero or any
otherwise valid score without making a new Boolean axis. `scorecardId` and
`totalScore` must remain present on both present arms, including the unready one.

`configSnapshotsDataset` at the same source file `:3418` returns an absent
object at `:3431` and a present object at `:3432`. Its selected-member table,
ordered `(configSnapshotPresent, presence(configSnapshotId))`, is exactly
`(false, absent)` and `(true, present)`. The present branch also carries
`archiveObjectCount`, `ingestRunId`, and `turnCount`; their full payload values
survive. The absent branch actually omits these keys. No zero/nonzero partition
of the required count values is used. The upstream query is at `:2688`, and the
branch copies the actual `latestForwarder` Option at `:3429`.

Both outputs flow through `datasetExample` at `:3345` into
`AgentEffectivenessDatasetExample.output` at `:1541`, and through the public
bundle builder's dataset entries at `:3546`. The module is exported by
`packages/tooling/library/ai-metrics/src/index.ts:16`. Bundle JSON encoding is at
`agent-effectiveness.ts:4474`; the CLI emits it at
`packages/tooling/tool/cli/src/commands/AgentEffectiveness/AgentEffectiveness.command.ts:242`.
Phoenix input mapping copies the output object unchanged at
`agent-effectiveness.ts:3692`, then appends examples at `:3734` or creates the
dataset at `:3746`. These payload keys are application-authored examples, not an
SDK-defined fixed record eligible for D2.

Existing test exposure: `test/agent-effectiveness.test.ts:865` constructs the
bundle, `:868` encodes it, and `:875` checks its named datasets. That test does not
exhaustively assert these output tuples. A design must add the three outcome
and two configuration branch fixtures and compare exact pre/post JSON and SDK
arguments, including absent keys, payloads, score values, and output property
order where byte comparison is promised. Do not recompute `completionReady`.

Design requirements: derive named schema-owned variants from the upstream
Options; keep the derived character of both outputs; encode the existing flat
Phoenix payload through a boundary projection. Keep each dataset's id, kind,
name, input, metadata, split, and all payload fields. Guard-deletion accounting
must point to the old flat object assembly/branch truth-table obligation at
`:3403` and `:3430`; do not claim an existing runtime guard where there is none.
No extra flag cache or persistent state is needed.

## HookPulse: keep the complete optional domains and the owner

The actual carrier is `HookPulseV1`,
`packages/tooling/library/ai-metrics/src/hook-pulse.ts:882`:

- `hookEvent` at `:888` uses all nine `HookPulseEvent` literals declared at
  `:257`: PreToolUse, PermissionRequest, PostToolUse, PostToolUseFailure,
  Notification, UserPromptSubmit, Stop, SessionEnd, PermissionDenied.
- `notificationType` at `:903` is `Option<HookPulseNotificationType>`, and the
  kit at `:546` contains both `permission_prompt` and `idle_prompt`.
- `sessionEndReason` at `:905` is `Option<string>`; use absence/presence as the
  finite structural payload axis while preserving the entire string payload.
- `isInterrupt` at `:909` is `Option<boolean>`: None, Some(false), Some(true).

The independent structural product is `9 × 3 × 2 × 3 = 162`. The owned-field
check already enforces the legal subset at runtime (`:913`–`:935`), but the flat
TypeScript product leaves the invariant outside the variant type. The E2
guard-deletion opportunity is real; 162 is not a claim that all 162 survive
current decoding.

Full legal table, ordered `(hookEvent, notificationType, sessionEndReason,
isInterrupt)`. `N` means None and `Some(reason)` retains any supported string:

| Owner | Legal suffixes `(notificationType, sessionEndReason, isInterrupt)` | Count |
| --- | --- | ---: |
| PreToolUse | `(N,N,N)` | 1 |
| PermissionRequest | `(N,N,N)` | 1 |
| PostToolUse | `(N,N,N)` | 1 |
| UserPromptSubmit | `(N,N,N)` | 1 |
| Stop | `(N,N,N)` | 1 |
| PermissionDenied | `(N,N,N)` | 1 |
| Notification | `(N,N,N)`, `(Some(permission_prompt),N,N)`, `(Some(idle_prompt),N,N)` | 3 |
| SessionEnd | `(N,N,N)`, `(N,Some(reason),N)` | 2 |
| PostToolUseFailure | `(N,N,N)`, `(N,N,Some(false))`, `(N,N,Some(true))` | 3 |
| Total | All fourteen owner/payload alternatives | 14 |

If the parent elects to retain only the original three members, their complete
projection is 18/6: all absent; either of the two notification literals present;
reason present; interrupt false; interrupt true. Never retain raw 12/5.

Producer evidence: ownership is mapped at `hook-pulse.ts:798`; the actual
raw-to-canonical **decode** transformation begins at `:1128` and filters these
three fields at `:1166`, `:1172`, and `:1177`. Raw-to-canonical decoding, not
encoding, is what the raw report's `:1166` citation shows. The reverse encode
transformation begins at `:1185` and filters at `:1205`, `:1211`, and `:1216`.
Both preserve optional absence on the owning event. Unknown notification names
are dropped to None, not mapped onto either accepted literal.

Persistence and consumer evidence: canonical JSON methods live at
`hook-pulse.ts:966`–`:969`; the public barrel exports the module at
`index.ts:111`. `.claude/hooks/hook-pulse.sh:310`–`:313` independently writes the
same event-owned fields, with absence retained; `:356` appends the NDJSON shard.
This script is outside the scanner corpus but is an essential producer/encoded
compatibility dependency. The legacy migration codec targets `HookPulseV1` at
`hook-pulse.ts:1031`. Its reason for omitting legacy `isInterrupt` is explicit at
`:972` and must survive the design.

Supported fixtures are stronger than permissive schema acceptance:
`test/hook-pulse.test.ts:551`–`:577` proves None, Some(true), Some(false), and
false-preserving reverse encoding; `:631`–`:660` round-trips SessionEnd reason
and idle notification; `:513`, `:532`, and `:611` reject all three foreign-owned
canonical fields; `:588`–`:606` drops those fields from foreign raw events.
`test/hook-pulse-writer.test.ts:620`–`:634` proves both shell allowlists match the
complete literal kits. Its `:714`–`:725` fixture preserves Notification with
unknown raw notification type as `(N,N,N)` and waitReason `unknown`. For each
owner, the existing optional raw schema and the explicit conditional producer
provide the absent-owned-field witness; this is a data-preserving producer
path, not a conclusion from unconstrained canonical decoding alone.

Design requirements: use the existing `hookEvent` domain for nine variants,
retain optional payloads on their owning arm, and retain all three interrupt
alternatives. Preserve the canonical `hook-pulse/v1` JSON, raw snake-case
projection, field omission, hashes, salt behavior, evidence-tier clamp, and
legacy migration. Keep the wait-reason invariant at `hook-pulse.ts:937` unless a
separately proven model absorbs it. The event-agnostic `toolName`, `toolUseId`,
and `durationMs` contract at `:1194` remains legal for all supported events.
Account for removing the canonical owned-field guard and its type-only helper
obligation; keep raw normalization where untrusted foreign fields must still be
dropped. A union that silently strips previously rejected canonical fields is
not an equivalent decoder. Add all fourteen positive owner fixtures and the
foreign-owner rejection matrix without narrowing the string payload domain.

## Attribution and discovery: five legal states each

`AiMetricsSourceAttribution` declares `sourceRole` and `threadSpawn` at
`packages/tooling/library/ai-metrics/src/models.ts:378`–`:379`.
`AiMetricsSourceRole` has exactly `primary`, `subagent`, and `gateway_metadata`
at `:335`. `threadSpawn` is a genuine three-way Option<Boolean> with None
default; neither false nor absence can be identified with primary.

All supported selected-member tuples, ordered `(sourceRole, threadSpawn)`, are:

| Tuple | Producer/input witness |
| --- | --- |
| `(primary, None)` | Codex content without a subagent source; `privacy.ts:565` chooses primary and `:566` returns None. Claude primary paths also use `:624`–`:627`. The explicit public constructor example is `models.ts:364`. |
| `(subagent, None)` | Claude path classified as a subagent at `privacy.ts:578`, forwarded at `:626` without threadSpawn; alternatively a Codex `source.subagent` object with no `thread_spawn`. |
| `(subagent, Some(false))` | Codex `source.subagent.thread_spawn=false`; the exact optional Boolean source is `privacy.ts:343`, selected through `:522` and copied through `:566`, `:639`, and `:646`. |
| `(subagent, Some(true))` | Same producer with true. Existing raw fixture `test/ingest.test.ts:1648`, assertions `:1681`–`:1682`, storage assertions `:1730`–`:1731`. |
| `(gateway_metadata, None)` | Explicit OpenClaw constructor at `privacy.ts:650`–`:653`, which omits threadSpawn. |

This is `3 × 3 = 9` structural states and five supported legal states. The
supported input recipes for the Codex alternatives can use a `session_meta`
line whose `payload.source` is absent, whose `subagent` is `{}`, or whose
`subagent.thread_spawn` is false/true, respectively. These are witnesses through
the explicit producer, not a demand to accept every arbitrary class instance.
The false/absent subagent cases need dedicated regression fixtures; the existing
true fixture does not prove them exhaustively. The Claude subagent producer is
exercised at `test/ingest.test.ts:450`–`:459` and `:3239`–`:3240`.

`AiMetricsDiscoveredTranscriptFile` has the same real pair at
`source-discovery.ts:164`–`:165`. The ordinary producer gets one attribution at
`:378` and copies both values at `:398`–`:399`. Its separate OpenClaw constructor
at `:568`–`:575` explicitly sets gateway_metadata and omits threadSpawn. Thus
the same five tuples are supported, without combining unrelated declarations.
The ordinary file inputs admit primary Codex, both Boolean values in Codex
subagent metadata, and Claude subagent paths; the gateway file is constructed
separately. `test/ingest.test.ts:3184` and `:3208`–`:3209` prove discovery's true
case. Its discovery JSON fixture at `:2991`–`:3004` covers the three source kinds,
and `:3027` asserts `gateway_metadata` in encoded output.

These are application-owned sanitization models. The raw Codex mirror is the
different `CodexSubagentSource` at `privacy.ts:336`; normalization and hashing
occur in the application before these carriers are constructed. A D2 label for
the canonical provenance would be incorrect.

Exposure and migration dependencies:

- `models.ts` and `privacy.ts` are publicly exported by `index.ts:165` and
  `:183`. `makeAiMetricsSourceAttribution` is exported at `privacy.ts:610`.
  Live consumers are `rawEventEnvelopes` (`:726`, copying role at `:748`),
  sanitized transcript construction (`:805`, `:820`, `:833`–`:834`), and source
  discovery (`source-discovery.ts:378`). The attribution object itself was not
  found directly encoded/persisted; it is a derived intermediate.
- `AgentSession` spreads `AiMetricsSourceAttribution.fields` at `models.ts:758`
  and overrides sourceRole with a primary default at `:761`. It is a public
  schema and a required migration dependency even though no runtime
  `AgentSession.make` call was found beyond its explicit documented primary
  example at `:743`. A union replacement cannot leave a broken `.fields` spread
  or quietly erase this default. Do not invent a new qualification based on
  that generic schema's permissiveness alone.
- The separate real pair on `AiMetricsSanitizedTranscript` is at
  `privacy.ts:228`–`:232`, copied from the same attribution at `:833`–`:834`.
  It is embedded in privacy results at `:285` and encoded at `:935`; storage
  writes its values at `derived-storage.ts:1377`–`:1379`. The named sourceRole
  default and every optional hash payload must survive. This is an explicit
  dependency for the bounded independent correction, not a seventh raw-row
  admission or a renamed salvage of the invalid snake/camel seed.
- Discovery nests files at `source-discovery.ts:197`, encodes its public result
  at `:691`–`:704`, and is exported by `index.ts:235`. The CLI emits the JSON at
  `packages/tooling/tool/cli/src/commands/AIMetrics/internal/Programs.ts:1328`.
  That proves wire exposure; the raw report did not identify a persisted file
  containing this exact discovered-file class.

Design requirements: use the existing sourceRole literal domain, with
`threadSpawn: Option<boolean>` retained on the subagent variant and absent on
primary/gateway variants. Preserve both Some values and None. Do not require a
parent/session hash merely because a role sounds delegated; existing fallback
payload selection at `privacy.ts:553` and `:557` permits parent hashes from
payload-level metadata too. Keep all six optional attribution hash fields and
their exact hash bytes. Preserve constructor/decoder defaults and current
optional-key encoding at each boundary. Tier 2 coordination is required for
the public schema reuse, privacy JSON, discovery JSON, and database consumers
even though the attribution instance's direct exposure is internal.

Account honestly for replacing the role/thread-spawn parallel assembly at
`privacy.ts:565`–`:566` with a schema-owned variant and for migrating all three
constructor branches at `:623`, `:629`, and `:649`. There is no current
contradictory-pair runtime guard to claim as deleted. Keep SQL null handling
where the persisted consumer needs it. Compare all five supported tuples through
attribution, discovery JSON, privacy JSON, and stored session columns; prove
that Some(false) is emitted as false and None stays omitted/null as appropriate.

## OTLP joined rows: seven states, not the source-attribution five

`AiMetricsOtlpTurnExportRow` is a private declared class at
`packages/tooling/library/ai-metrics/src/otlp.ts:358`; its real pair is
`sourceRole: AiMetricsSourceRole` (`:374`) and
`threadSpawn: S.OptionFromNullOr(S.Boolean)` (`:375`). The flat structural product
is nine. It is an application-owned SQL projection of the application's store,
not an external DB/API mirror.

The query does **not** copy both values from one sanitized object. It uses
`COALESCE(t.source_role, s.source_role, 'primary')` at `otlp.ts:454` and
`s.thread_spawn` at `:463`. The session row is replaced under the same
source-kind/path identity at `derived-storage.ts:1329`–`:1331`; its role and
threadSpawn are updated together at `:1377`–`:1379`. Turn rows are content-keyed
at `:1392` and `INSERT OR IGNORE` at `:1404`, retaining their first-seen role at
`:1435`. The comments at `:469`–`:479` explicitly support transcripts that later
reveal subagent metadata. `otlp.ts:505`–`:510` explicitly preserves the divergent
role in trace identity.

Full legal tuple table:

| `(sourceRole, threadSpawn)` | Supported source path |
| --- | --- |
| `(primary, None)` | Ordinary primary transcript. |
| `(primary, Some(false))` | Retain an unexported primary turn, then ingest the same file with later Codex subagent metadata carrying false; the session is replaced while the old turn role remains primary. |
| `(primary, Some(true))` | The identical supported role-flip sequence carrying true. |
| `(subagent, None)` | Subagent transcript with no thread_spawn, including Claude's path-derived subagent. |
| `(subagent, Some(false))` | Ordinary Codex subagent with false. |
| `(subagent, Some(true))` | Ordinary Codex subagent with true. |
| `(gateway_metadata, None)` | OpenClaw transcript producer at `ingest.ts:115` and `:148` feeds the privacy path whose OpenClaw attribution omits threadSpawn (`privacy.ts:650`). The generic envelope producer preserves its source kind/role at `privacy.ts:742`–`:749`. |

The two unsupported tuples are gateway_metadata with either Some Boolean. No
producer derives gateway_metadata from a Codex subagent. A later Codex ingest
cannot replace the gateway session because sourceKind is part of the session
key. Thus the narrower source-supported invariant is
`sourceRole == gateway_metadata => threadSpawn == None`, giving **9/7**.
The Some-implies-subagent raw claim is disproved, not merely missing a citation.

Existing fixtures prove primary OTLP role attributes at
`test/ingest.test.ts:1487`–`:1504`, ordinary stored subagent true at
`:1648`–`:1734`, and real pending/retry/partial-export behavior at `:888`, `:936`,
`:968`, `:980`, and `:994`. The duplicated session/turn fixtures at `:944`–`:965`
copy existing source_role/thread_spawn together and do not prove a new illegal
gateway/Some state. No dedicated false-thread-spawn or role-flip fixture was
found. The seven-row positive test plan must therefore include the explicit
two-ingest role-flip producer sequence for both Boolean values, not synthesize
those tuples solely via permissive row decoding. For the gateway tuple use the
supported OpenClaw JSON transcript route, not an assumption that a systemd unit
text file necessarily contains a turn.

The class is not exported, but `readAiMetricsOtlpSpanProjections` at `otlp.ts:653`
is exported through `index.ts:174`. It reads the row decoder at `:474`. Session
projection emits the optional Boolean with `O.getSomesStruct` at `:531`–`:538`
and emits role independently at `:544`; false is a value and None is omission.
Grouping and identity depend on `sessionSeed` at `:509` and `:615`. This is
derived wire exposure/Tier 2 even though the row type itself is private.

Design requirements: never reuse the attribution five-case union for this
joined row. A role-owned target must admit all three threadSpawn alternatives
for **both** primary and subagent and only None for gateway_metadata. Keep the
SQL aliases, required columns, null codec, typed decode-failure mapping,
first-seen turn role, current session metadata, grouping, trace/span seeds,
attributes, and watermark/retry behavior. Do not rewrite persisted roles to
make a proposed type look coherent. Identify the parallel joined-row exposure
at `:454`/`:463` and its projection obligation at `:538`/`:544` in guard-deletion
accounting; there is no existing implication guard to delete. The independent
correction must confirm the narrower gateway implication and all seven legal
paths before this corrected qualification is admitted.

## Rejected scalar axes and the existing readiness owners

`ScorecardSummaryRow` at
`packages/tooling/library/ai-metrics/src/agent-effectiveness.ts:2035` contains
exactly the declared members `benchmarkRunCount: S.Finite` (`:2037`),
`completionReady: S.Boolean` (`:2038`), `labelCount: S.Finite` (`:2041`), and
`taskCount: S.Finite` (`:2043`). None of the counts is optional, nullable,
Boolean-valued, or a literal domain. `scorecardCompletionReady` at
`scorecard.ts:1234` computes one real Boolean at `:1242`; the caller's named
`completionReady` value at `:1267` is also real. Neither introduces declared
`taskCount > 0`, `labelCount > 0`, or `benchmarkRunCount > 0` members on the SQL
row. The raw 16/8 table invents three predicate axes. It also incorrectly
asserts that every persisted readiness judgment must equal that particular
writer's fold.

The related **existing** canonical ids require the same eligibility correction:

| Existing id | Actual declaration/member types | Proposed action |
| --- | --- | --- |
| `ai-metrics-scorecard-readiness` | `Scorecard`, `models.ts:1023`; `completionReady: SchemaUtils.BoolKeyDefaultFalse` at `:1026`; counts `AiMetricsNonNegativeInteger` at `:1025`, `:1031`, `:1034` | Withdraw the four-member virtual-count qualification; preserve its source receipts and design in history through the parent's archive procedure. |
| `ai-metrics-scorecard-summary-readiness` | `AgentEffectivenessScorecardSummary`, `agent-effectiveness.ts:820`; `completionReady: S.Boolean` at `:825`; counts `S.Finite` at `:824`, `:828`, `:830` | Withdraw the same virtual-count qualification and archive the design/source receipts. Do not add the raw SQL row as a third owner. |

The current designs already cover `ScorecardSummaryRow` under the public summary
owner (`designs/ai-metrics-scorecard-summary-readiness.md:25`). Their corrected
16/6 coarse truth tables and false/111 source receipts must remain available in
history; a correct table of fabricated predicates does not cure carrier
ineligibility. The explicit `Scorecard.make` example at `models.ts:1002` supplies
positive counts while omitting completionReady, so its false constructor
default is supported. The legacy storage fixture at
`test/ingest.test.ts:1772` preserves a false backfill. The latest-row query at
`agent-effectiveness.ts:2702` and copy at `:2732` preserve the stored judgment.
None of that authorizes recomputing readiness or changing product behavior.
The new two-Boolean outcome dataset remains eligible on its own actual returned
properties even after these count-axis records are withdrawn.

`BenchmarkRunAnnotationRow` at `agent-effectiveness.ts:2072` likewise declares
one Boolean (`:2078`) and a required arbitrary string (`:2079`). Upstream
business values often belonging to a four-value domain do not change that
actual declaration. Reject its raw D1 census row. In contrast,
`AiMetricsBenchmarkRunInput` at `scorecard.ts:305` actually declares
`qualityGate: AiMetricsQualityGateStatus` at `:312`, whose full four alternatives
are defined at `models.ts:504`. The public recording API copies `passed` and
`qualityGate` independently at `scorecard.ts:1011`–`:1012`, stores both, and
aggregates them separately at `:1097` and `:1104`, combining scores only at
`:1155`. This is a real D1 input carrier: all eight `{false,true} ×
{passed,failed,not_run,unknown}` combinations remain separate observations.
`test/ingest.test.ts:1092` covers one producer example; generic arbitrary-schema
round trips in `test/scorecard.test.ts` are compatibility coverage, not the
reason for legal-state support. The existing distinct output-model D1 id
`r25-tooling-library-policy-test-benchmark-run-quality-gate` stays separate.

`AgentEffectivenessPhoenixSyncNewOptions` at `agent-effectiveness.ts:1905` is
a real named type: `dryRun: boolean` at `:1906`, optional `confirmToken` at
`:1907`. Its four Boolean/presence combinations are accepted by the explicit
dual constructor at `:1964`–`:1968`, which forwards both independently.
`test/agent-effectiveness.test.ts:914`–`:927` covers preview, blocked live, and
authorized live input-class paths. The options type's required dryRun does not
inherit the separate class schema's default at `:1949`. Optional absence and a
present token, including a nonmatching token, stay distinct payload cases;
token equality does not create a new member. Keep this named-type D1 proposal
and the distinct existing class D1 id
`r25-tooling-library-policy-test-phoenix-sync-input-gates`.

## Four seed withdrawals

All four seed claims are accurate about drift. Each inventory row combines
fields that do not belong to its named declaration. Withdraw them from the live
projection rather than retaining an invalid member set under D1/D2. Do not
alter the underlying driver/wire contracts.

| Exact canonical id | Declared source evidence | Why the row cannot be retained |
| --- | --- | --- |
| `r2-tooling-hook-pulse-interrupt` | `HookPulseRawEvent`, `hook-pulse.ts:608`, owns only `is_interrupt` at `:628`; `isInterrupt` belongs to `HookPulseV1` at `:909`. Reverse mapping is at `:1216`. | Cross-declaration rename; there is no two-member raw carrier. Its old `:622` anchor is not a remedy. |
| `r2-tooling-qa-beacon-polarity` | `BeaconEvent`, `packages/tooling/library/qa-capture/src/ActionEvent.models.ts:1271`, owns `isWhite` at `:1285`; `BeaconEdge` owns `toWhite` at `packages/tooling/library/qa-capture/src/ClockCorrelator.service.ts:92`. | The clock fit compares separately supplied edge/event values at `ClockCorrelator.service.ts:197` and `:202`; they are not sibling Boolean state of one named record. |
| `r2-tooling-ai-metrics-thread-spawn-wire` | `AiMetricsSanitizedTranscript.threadSpawn`, `privacy.ts:232`; separate `CodexSubagentSource.thread_spawn`, `privacy.ts:343`. Mapping is at `:566` and `:834`. | Two sides of a transformation, not two members of the sanitized transcript. Do not misclassify the application's sanitized shape itself as D2. |
| `r2-tooling-phoenix-insufficient-storage-wire` | `AgentEffectivenessPhoenixSection.serverInsufficientStorage`, `agent-effectiveness.ts:663`; separate `PhoenixGraphqlServerStatus.insufficientStorage`, `:2285`. Copy at `:2665`. | GraphQL mirror and application report are different declarations. `:2667` derives report status, but that does not make the raw field name a second report member. |

The new HookPulse ownership and provenance proposals use actual members and
are not semantic renames of these invalid clusters. Search of the current
inventory, designs, and prior ai-metrics source receipt found no existing
admitted cluster with the six proposed raw-row member sets. The existing
summary design's SQL-row coverage and the two existing named-input/output D1
owners are the relevant overlaps recorded above. Preserve every old receipt
while reconciling by actual file/symbol/member set.

## Corrected schema-shaped handoff records

These six qualified records and two D1 records are proposals only. The
`confirmed` values below are the schema-required shape of a candidate proposed
for admission; no current inventory status is advanced by this handoff. The
independent correction must resolve HookPulse and OTLP before parent admission.

```jsonl
{"schemaVersion":"boolean-creep-inventory/v1","id":"r27-tooling-library-observability-outcomes-dataset-scorecard-presence","file":"packages/tooling/library/ai-metrics/src/agent-effectiveness.ts","line":3404,"symbol":"outcomesDataset","kind":"object-literal","members":["completionReady","scorecardPresent"],"status":"confirmed","evidence":[{"class":"E1","cite":{"file":"packages/tooling/library/ai-metrics/src/agent-effectiveness.ts","line":3404},"note":"The actual returned output object is false/false without a scorecard; the Some arm writes scorecardPresent true and copies the stored completionReady value."},{"class":"E3","cite":{"file":"packages/tooling/library/ai-metrics/src/agent-effectiveness.ts","line":3405},"note":"The present arm carries scorecardId and totalScore; the absent arm omits both. Preserve both false and true readiness on the present arm."}],"cardinality":{"representable":4,"legal":3},"storage":"derived","exposure":"wire","targetShape":"tagged-union","tier":2,"notes":"Actual returned properties, not anonymous input flags. Legal completionReady/scorecardPresent tuples false/false, false/true, true/true. Preserve payload values, omitted keys, public dataset JSON and Phoenix arguments; never recompute stored readiness."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r27-tooling-library-observability-config-snapshots-dataset-presence","file":"packages/tooling/library/ai-metrics/src/agent-effectiveness.ts","line":3431,"symbol":"configSnapshotsDataset","kind":"object-literal","members":["configSnapshotPresent","configSnapshotId"],"status":"confirmed","evidence":[{"class":"E1","cite":{"file":"packages/tooling/library/ai-metrics/src/agent-effectiveness.ts","line":3431},"note":"The actual None output omits configSnapshotId and sets configSnapshotPresent false; the Some output writes both the id and true."},{"class":"E3","cite":{"file":"packages/tooling/library/ai-metrics/src/agent-effectiveness.ts","line":3432},"note":"The present arm carries configSnapshotId, ingestRunId, archiveObjectCount and turnCount together. Count values are payloads, not zero/nonzero axes."}],"cardinality":{"representable":4,"legal":2},"storage":"derived","exposure":"wire","targetShape":"tagged-union","tier":2,"notes":"Legal flag/id-presence tuples false/absent and true/present. Preserve all present payloads and exact omission in public dataset JSON and Phoenix output."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"hook-pulse-v1-owned-fields","file":"packages/tooling/library/ai-metrics/src/hook-pulse.ts","line":888,"symbol":"HookPulseV1","kind":"schema-struct","members":["hookEvent","notificationType","sessionEndReason","isInterrupt"],"status":"confirmed","evidence":[{"class":"E2","cite":{"file":"packages/tooling/library/ai-metrics/src/hook-pulse.ts","line":913},"note":"The canonical owned-field check rejects a present notificationType, sessionEndReason or isInterrupt unless hookEvent is its unique owner."},{"class":"E1","cite":{"file":"packages/tooling/library/ai-metrics/src/hook-pulse.ts","line":1166},"note":"Raw-to-canonical decode filters the three owned fields by hookEvent; the reverse encode has matching filters at 1205, 1211 and 1216. Owning arms preserve optional absence."}],"cardinality":{"representable":162,"legal":14},"storage":"stored","exposure":"persisted","targetShape":"tagged-union","tier":2,"notes":"Full domains: nine events, notification None/permission_prompt/idle_prompt, reason None/Some(string), interrupt None/Some(false)/Some(true). Six nonowner events admit all absent; Notification has three cases, SessionEnd two, PostToolUseFailure three. Preserve waitReason, legacy codecs and exact ledger/raw keys. Raw 12/5 requires independent correction."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"ai-metrics-source-attribution-thread-spawn","file":"packages/tooling/library/ai-metrics/src/models.ts","line":378,"symbol":"AiMetricsSourceAttribution","kind":"schema-struct","members":["threadSpawn","sourceRole"],"status":"confirmed","evidence":[{"class":"E1","cite":{"file":"packages/tooling/library/ai-metrics/src/privacy.ts","line":565},"note":"The Codex producer chooses subagent iff subagent metadata is present and obtains optional threadSpawn only from that metadata; false and None are preserved."},{"class":"E4","cite":{"file":"packages/tooling/library/ai-metrics/src/privacy.ts","line":623},"note":"Claude primary/subagent constructors omit threadSpawn, Codex copies its paired metadata, and the OpenClaw constructor at 650 emits gateway_metadata with None. Some(threadSpawn) implies subagent on this attribution carrier."}],"cardinality":{"representable":9,"legal":5},"storage":"derived","exposure":"internal","targetShape":"tagged-union","tier":2,"notes":"Legal sourceRole/threadSpawn: primary/None, gateway_metadata/None, subagent/None, subagent/Some(false), subagent/Some(true). Derived intermediate; Tier 2 coordinated dependencies include AgentSession.fields, privacy JSON, discovery JSON and session persistence. This five-case invariant must not be imposed on historical OTLP joins."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"ai-metrics-discovered-transcript-file-thread-spawn","file":"packages/tooling/library/ai-metrics/src/source-discovery.ts","line":164,"symbol":"AiMetricsDiscoveredTranscriptFile","kind":"schema-struct","members":["threadSpawn","sourceRole"],"status":"confirmed","evidence":[{"class":"E1","cite":{"file":"packages/tooling/library/ai-metrics/src/source-discovery.ts","line":398},"note":"The discovered file copies sourceRole and threadSpawn from one attribution object; the separate gateway constructor at 568 sets gateway_metadata and omits threadSpawn."},{"class":"E4","cite":{"file":"packages/tooling/library/ai-metrics/src/privacy.ts","line":565},"note":"The shared normalized attribution producer can supply Some(threadSpawn) only for a subagent, preserving both Boolean values and absence."}],"cardinality":{"representable":9,"legal":5},"storage":"derived","exposure":"wire","targetShape":"tagged-union","tier":2,"notes":"Five tuples match the attribution carrier. Public sourceDiscoveryToJson and CLI output prove wire exposure; preserve all optional hash fields, both Some Boolean values and absent-key encoding. Application-owned sanitized output, not D2."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"ai-metrics-otlp-turn-export-row-thread-spawn","file":"packages/tooling/library/ai-metrics/src/otlp.ts","line":374,"symbol":"AiMetricsOtlpTurnExportRow","kind":"schema-struct","members":["threadSpawn","sourceRole"],"status":"confirmed","evidence":[{"class":"E4","cite":{"file":"packages/tooling/library/ai-metrics/src/privacy.ts","line":650},"note":"Only the OpenClaw producer supplies gateway_metadata and it omits threadSpawn. The session key includes sourceKind at derived-storage.ts:1329, so later Codex subagent metadata cannot give a gateway turn a Some Boolean."},{"class":"E1","cite":{"file":"packages/tooling/library/ai-metrics/src/derived-storage.ts","line":469},"note":"Supported role flips update the same session while INSERT OR IGNORE keeps first-seen turn roles. The export joins turn-preferred role at otlp.ts:454 with current session threadSpawn at 463, so primary plus either Some Boolean is legal."}],"cardinality":{"representable":9,"legal":7},"storage":"derived","exposure":"wire","targetShape":"tagged-union","tier":2,"notes":"Primary and subagent each admit None/Some(false)/Some(true); gateway_metadata admits only None. Some(threadSpawn) does not imply subagent for this joined row. Preserve historical role, current session metadata, null/false distinction, SQL decode errors, trace seeds and wire attributes. Independent Grok correction required before admission."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"ai-metrics-benchmark-run-input-passed-quality-gate","file":"packages/tooling/library/ai-metrics/src/scorecard.ts","line":311,"symbol":"AiMetricsBenchmarkRunInput","kind":"schema-struct","members":["passed","qualityGate"],"status":"disqualified","disqualifier":{"class":"D1","note":"Actual Boolean plus four-literal qualityGate domain. recordAiMetricsBenchmarkRun copies both independently at scorecard.ts:1011-1012; aggregation scores them separately at 1097 and 1104. All eight observation pairs remain legal; this named input is distinct from BenchmarkRun."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"agent-effectiveness-phoenix-sync-new-options","file":"packages/tooling/library/ai-metrics/src/agent-effectiveness.ts","line":1906,"symbol":"AgentEffectivenessPhoenixSyncNewOptions","kind":"type-literal","members":["dryRun","confirmToken"],"status":"disqualified","disqualifier":{"class":"D1","note":"Actual named options type with required dryRun Boolean and optional confirmToken payload. The dual constructor at agent-effectiveness.ts:1964-1968 forwards them independently, preserving all four Boolean/presence combinations. The true default belongs to AgentEffectivenessPhoenixSyncInput, not this type."}}
```

## Parent integration and independent correction

1. Preserve the raw lane and execution receipt. Their successful completion and
   ten rows are provenance, not acceptance of seven qualified claims.
2. Reject the two out-of-net raw proposals. Withdraw the four exact cross-owner
   seed ids above. Withdraw/archive the two existing count-axis readiness ids
   with all prior source receipts; this audit changes no product behavior and
   does not replace those findings with D1.
3. Request one bounded independent Grok correction using this frozen source.
   It must correct HookPulse's missing notification literal and include the
   owner, disprove/replace the OTLP Some-implies-subagent assertion with all
   seven supported paths, reject the raw count/required-string axes, and
   acknowledge the same existing readiness eligibility defect. It must verify
   the six actual proposed carriers rather than treat their raw status as proof.
4. Ask that correction to account explicitly for the real sanitized-transcript
   pair and the `AgentSession.fields` migration dependency. Do not salvage the
   invalid snake/camel seed by merely renaming its members, and do not invent a
   new qualification for generic constructor permissiveness. Any additional
   proposal requires its own exact-source receipt before admission.
5. Parent may integrate the two D1 records and source metadata corrections,
   then independently adjudicated qualified proposals. No new design files
   were written here. Once accepted, each design must provide the per-carrier
   compatibility/guard-deletion proof above before any independent P3 review
   or application. The Grok correction is a census correction, not P3.

Validation for this handoff is limited to source inspection, source/consumer
searches, exact local refs, and schema validation of the eight embedded records.
Extracting the JSONL block into the existing validator through `/dev/stdin`
returned exit 0: `inventory OK: 8 records, 8 unique ids`. All ten raw ids occur
in the disposition table; the embedded block contains six qualified proposals
and two D1 records. Final ref verification still returned the frozen HEAD and
`origin/main` values recorded above.
No product tests, builds, services, or live telemetry were run or changed.
