# R28 first D census: source adjudication

This is a bounded Codex P2 source audit at frozen source HEAD
`93217d998f851e2e93d9864e2b5315552eaa58a7`, after main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. It proposes canonical changes; it
does not apply them or replace independent census correction or P3 review.
The four original lane reports and their execution receipts remain immutable.
The UI lane still needs the parent's one bounded independent correction.

The four driver additions have real object-literal carriers: three D2
FileSystem removal option bags and one D1 ECMAScript descriptor. All ten
callable withdrawals are supported. Two driver seed anchors and two todo
citations need repair. The authored `Brand.assets.ts` file must be restored to
the UI coverage claim, although its complete source contains no eligible
Boolean cluster. The three new private chart props require an independent
adjudication of their omitted `indicator`/`nestLabel` relation: the minimal
connected cluster has six representable and five supported states. Their
independent `hideIndicator` control is not part of that minimal cluster.

## Scope and receipts

Read the completed JSONL and full `completionSummary` for these four lanes.
Every receipt has source SHA equal to the frozen HEAD, exit code zero,
`endTurnEvent: true`, valid JSONL, no execution errors, and report validation
exit code zero. Their raw counts are evidence of what each lane emitted, not
a substitute for source adjudication or a renewed full-corpus coverage claim.

| Lane | Raw records | Raw qualified | Footer disposition audited here |
| --- | ---: | ---: | --- |
| `r28-drivers-a-f` | 4 | 0 | Four new D carriers; no seed drift claimed. |
| `r28-drivers-n-r` | 0 | 0 | Nine callable withdrawals and two declaration/member anchor repairs. |
| `r28-foundation-schema-n-z` | 0 | 0 | One callable Slug withdrawal. |
| `r28-foundation-ui` | 3 | 0 | Three new chart props pairs; mistaken Brand.assets exclusion; todo member-set assertion. |

The report directory is
`data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/`, relative to this goal.

| Receipt file | SHA-256 |
| --- | --- |
| `r28-drivers-a-f.jsonl` | `b55b567a86fdd66949f4b34efc63dd7ca5e7e222027a536d94e49831a4e429d0` |
| `r28-drivers-a-f.execution.json` | `905f1ec73bdde7bfa7632780bf2c408499a187d8fbe4023f952deb45e3eb985c` |
| `r28-drivers-n-r.jsonl` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `r28-drivers-n-r.execution.json` | `793f25a753a1a7bde14819d19693d00517d30de7eb02412ba88722fc4d28363d` |
| `r28-foundation-schema-n-z.jsonl` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| `r28-foundation-schema-n-z.execution.json` | `41e1e2ed30c79473182604b9ac59a60ce79dcb524efee0d8363e60d40a850b67` |
| `r28-foundation-ui.jsonl` | `54ba907f6d5a725bb744b1bd5434fcbbb0eda56bf4779e7ebd86fec9936437a6` |
| `r28-foundation-ui.execution.json` | `3a8404825fe725a151d6c59b13baa45542f4bed4f1a6040d1296b39b87244b92` |

## Driver D carriers and taxonomy

`packages/drivers/exiftool/src/Exiftool.service.ts:515` is the actual inline
`{ recursive: true, force: true }` object passed to `fs.remove` by the release
callback of `writeTagsCore`. Its surrounding acquisition/use/release is at
`479-516`; the output is renamed before release at `505-511`. Both fields
belong to the external Effect FileSystem API; the temporary-directory policy
does not turn them into application phase flags. The callable callback is not
the admitted owner: the concrete object literal it constructs is.

`packages/drivers/ffmpeg/src/FFmpeg.service.ts:1771` has the same two-member
options object in `withStagingDirectory` (`1756-1772`). Line `2092` constructs
a separate object in the release arm of `extractFrames`; successful frame
commit, result construction and completed-event emission precede it at
`2072-2090`. These are distinct object instances under distinct source owners,
not duplicate reports of the same object. The external contract can be read
locally at `.repos/effect/packages/effect/src/FileSystem.ts:271-283`:
`recursive` controls nested removal, and `force` controls missing-path errors.
This reference is supporting API evidence, outside the campaign corpus.

`packages/drivers/box/src/internal/Box.runtime.ts:46` constructs a descriptor
with `configurable`, `enumerable`, and `writable`, all true, plus required
`value: entry`. `pruneUndefined` rebuilds JSON-shaped objects while retaining
own `__proto__` data keys (`19-51`). The descriptor is not a Box wire response:
its three controls are independent ECMAScript attributes. Keep D1, consistent
with current `identity-property-descriptor-flags`,
`literalkit-attach-helper-descriptors`, `with-statics-attach-statics`,
`struct-from-entries-property-descriptor-flags`, and the other descriptor
census rows. D2 is not a generic label for every standard-library object.
The single all-true constructor is a selected descriptor configuration; it
does not establish a one-state application protocol. Required `value` is
payload, not an invented presence axis.

No member or taxonomy correction is needed for these four raw rows. The
proposals below make the actual carrier and consistent classification
explicit. There is no qualified driver design arising from these four cases.

## Three chart props: projection versus the complete relation

All source references in this section are to
`packages/foundation/ui-system/ui/src/components/chart.tsx`.

| Actual private React props owner | Carried fields relevant here | Sole JSX writer |
| --- | --- | --- |
| `ChartTooltipIndicator`, `293-310` | `hideIndicator: boolean` at `301`; `indicator: line | dot | dashed` at `302`; `nestLabel: boolean` at `304` | `ChartTooltipDefaultItem`, `370-376` |
| `ChartTooltipDefaultItem`, `351-383` | `hideIndicator` at `363`; `indicator` at `364`; `nestLabel` at `365` | `ChartTooltipItem`, `421-429` |
| `ChartTooltipItem`, `385-433` | `hideIndicator` at `402`; `indicator` at `403`; `nestLabel` at `405` | `ChartTooltipContent`, `520-532` |

The public `ChartTooltipContentProps` accepts optional `indicator` with all
three literals (`21-28`); `ChartTooltipContent` defaults it to `dot` at `467`
and defaults `hideLabel`/`hideIndicator` to false at `468-469`. It rejects
inactive/empty rendering at `501-503`. Line `506` derives
`nestLabel = items.length === 1 && indicator !== "dot"` from the original
unfiltered payload. Lines `517-518` subsequently remove `type === "none"`
items. Counting the filtered result instead would change behavior.

The raw two-Boolean projection `{ hideIndicator, nestLabel }` really permits
all four pairs. Hiding chrome does not prohibit nested labels; an icon also
overrides `hideIndicator` at `306-308`. However, each of these same real props
owners co-carries `indicator`, which the projection omitted. The actual
implication is `nestLabel => indicator !== "dot"`.

| `indicator` | `nestLabel` | Source support |
| --- | --- | --- |
| `dot` | false | Any positive original payload length. |
| `line` | false | Original payload length greater than one. |
| `line` | true | Original payload length exactly one. |
| `dashed` | false | Original payload length greater than one. |
| `dashed` | true | Original payload length exactly one. |
| `dot` | true | Impossible under the sole writer at `506`. |

The minimal connected cluster is exactly `indicator`/`nestLabel`: `3 × 2 = 6`
representable, five legal. `hideIndicator` is an independent factor of two;
the three-field product is `12/10`, but that factor is not needed to describe
or fix the relation. Required payload arrays, their counts, item names,
formatter results, colors and React nodes do not become additional Boolean
axes. `itemConfig` presence and optional icons do not change the five-state
indicator/nesting relation.

These are private React components, not hypothetical public option bags.
The export list at `676` exports the public content component and other
existing public chart APIs, not the three helpers. A targeted source search
finds precisely the JSX writer chain above; graft's missing JSX incoming
edges alone were not used as absence evidence. The existing fixture
`packages/foundation/ui-system/ui/test/ui.test.ts:10-39` calls public
`ChartTooltipContent` and covers formatter fallback/suppression/zero; it does
not construct the private helpers with `dot/true`. Generic TypeScript
acceptance of those private props is not a supported extra constructor.

There is a net-interpretation point for independent correction: each of the
three actual props owners has the required two Boolean members for initial
recall, but its minimal correlated cluster is one Boolean plus a three-valued
literal. The canonical campaign already requires full literal domains when
adjudicating an eligible owner; the proposal applies that rule here. If the
reviewer interprets the recall threshold as also requiring two Booleans
inside every final minimal cluster, that disagreement must be explicit. It
must not be hidden by adding independent `hideIndicator` to inflate the
minimal cluster.

Two companion scopes also need explicit treatment in the independent
correction. `ChartTooltipIndicatorMark` (`267-291`) co-carries `indicator` and
`nestLabel`, but only one Boolean; it is a necessary migration companion and
is not newly admitted by this audit. `ChartTooltipContent` derives the single
Boolean `nestLabel` beside its public input literals; it is the construction
site, not an invented multi-Boolean owner. `ChartTooltipLabels` (`327-343`)
receives only the nesting bit of this relation. Finally,
`tooltipIndicatorNestClass` (`264-265`) is a callable parameter carrier and
remains out of net even though implementation would replace its compound
predicate with a case on the five-state literal.

Preserve complete public behavior in any subsequent design: indicator
classes (`257-262`), dashed nested spacing (`264-265`), icon precedence
(`306-308`), formatter fallback versus `Some(null)`, `Some(undefined)` and
`Some(0)` (`312-318`, `420-429`), value formatting (`346-348`), label nesting
(`340`, `377-378`, `515`), dot alignment (`417`), color precedence (`324-325`),
item key/config lookup, original payload order, and public exported types.
This is source evidence, not a completed design or compatibility proof.

## Brand.assets footer coverage correction

`packages/foundation/ui-system/brand/src/Brand.assets.ts:1-6` is an authored
package-documentation header describing files the package generates. It does
not say this TypeScript source was generated and has no codegen/do-not-edit
marker. Its public `RenderedAsset` schema (`31-37`) contains only required
`path` and `content` strings. `accentOnDark`, `accentOnLight`, and `favicon`
(`39-60`) construct paint metadata. `renderBrandAssets` (`84-117`) constructs
five path/content outputs and calls renderer functions; its optional ground
payload is `O.some(MarkGround.make(...))` at `101`, not two Boolean fields.
Reading all 117 lines finds no eligible Boolean field/local cluster.

Exact proposed footer correction: “`brand/src/Brand.assets.ts` is authored
renderer source and is in scope. Its complete 117-line source was inspected;
it has no eligible Boolean cluster. The earlier generated-file exclusion was
incorrect.” The parent must have the independent UI lane confirm this
coverage correction. This audit does not claim full UI coverage, alter the
frozen report, or treat the authored renderer as an exception to the generated
surface exclusion. The separate generated-header audit remains separately
owned.

## Ten callable withdrawals

Withdraw these IDs from the live projection while retaining their exact old
D1 reasoning and original independent receipts in the archived projection.
They are out-of-net carriers, not newly classified D1 or D2 data shapes.
Source invocation results are not stored as the named sibling bit vectors.
The prior reasoning sometimes describes true logical relations between
predicates; that does not cure the missing carrier.

| Withdrawn ID | Exact source proof |
| --- | --- |
| `openclaw-live-acceptance-predicates` | `packages/drivers/openclaw/src/OpenclawProbe.service.ts:168-203` declares five functions taking `OpenclawLiveAcceptanceInput`; `243-252` calls them inline to build failure options. No `coordinateOpenclawLiveAcceptance.predicates` Boolean owner exists. |
| `rdf-canonize-budget-failure-heuristics` | `packages/drivers/rdf-canonize/src/adapters/canonicalization.ts:170-174` declares `(error: unknown) => boolean` and `(message: string) => boolean`; `179` invokes both directly in an OR. |
| `openclaw-schema-placeholder-predicates` | `packages/drivers/openclaw/src/OpenclawRender.ts:224-228` declares two record-accepting predicates; `230-231` invokes them inside another predicate. |
| `r3-drivers-arch-dataset-loader-host-probes` | `packages/drivers/nlp-mcp/src/Streaming/DatasetLoader.ts:413-420` defines `isPrivate172(host)` and `422-427` defines `isInternalIpv4(host)` that calls it. No co-carried results. |
| `r3-drivers-arch-postgres-error-extractors` | `packages/drivers/postgres/src/Postgres.errors.ts:141-143` declares `isError(value)` and `isPostgresError(value)` type guards. Their separate uses include message extraction at `162-163` and Postgres extraction at `319`. |
| `r3-drivers-arch-postgres-diagnostics-probes` | `packages/drivers/postgres/src/PostgresDiagnostics.service.ts:142-144` declares `isDate(value)` and `isPostgresError(value)` type guards; uses at `183` and `260/263/278` are callable classification, not a sibling Boolean state. |
| `r3-drivers-arch-pcl-failure-classifiers` | `packages/drivers/pacer/src/PclClient.service.ts:100-103` builds `isTaggedDecodeFailure` with `P.or` over predicates; `105-108` calls it inside `isDecodeFailure(error)`; `110-111` defines `isTerminalReportStatus(status)`. Uses at `121` and `272/275` consume predicates for different values. |
| `r3-drivers-arch-postgres-diagnostic-guards` | `packages/drivers/postgres/src/internal/PostgresDiagnosticGuards.ts:9-11` exports `isObject(value)` and `isCause(value)` type-guard functions. `safeBoolean` at `4-7` is a callable adapter, not a Boolean field. |
| `r3-drivers-arch-dataset-loader-url-ssrf` | `packages/drivers/nlp-mcp/src/Streaming/DatasetLoader.ts:402-403` exports `isUrl(location)`; `445-465` defines `isBlockedRemoteHost(hostname)`; `473` calls the latter in a URL-host check. The differently parameterized functions are not one data owner. |
| `r25-foundation-schema-n-z-slug-hyphen-edge-checks` | `packages/foundation/modeling/schema/src/Slug.ts:26-27` declares two `(value: unknown) => boolean` predicates. `SlugChecks` at `29-61` is `S.makeFilterGroup`; `37` and `43` pass those functions to `S.makeFilter`. The group does not store their Boolean results. |

The unchanged `detectEngineProfile.engineFamily` locals reported by N-R were
not re-adjudicated or withdrawn in this bounded task. Likewise, the UI footer's
`ChartStyle` callable-predicate prompt seed is already absent from current
inventory and needs no additional deletion.

## Surviving seed repairs and todo completeness

`drivers-openclaw-channel-health` retains D2 and its three-member owner. The
first Boolean field is `Openclaw.models.ts:594`, while `595` is its annotation
description. `restartPending` and `running` are at `597` and `600`; the class
describes a tolerant gateway-health projection at `610-612`.

`drivers-openai-compat-chat-completion-request` retains D2 and its
`parallel_tool_calls`/`stream` pair. The former field begins at
`OpenAiCompat.models.ts:850`; `852` closes its annotation. `stream` is at
`862`. The separate canonical `stream`/`stream_options` cluster remains at
`862/865`; it is not the same member set and is not superseded by this anchor
repair. No request-policy or wire-normalization change is proposed.

In `packages/foundation/ui-system/ui/src/components/todo-item.tsx`,
`hasDescription` (`131`) derives only description presence/nonempty text and
controls a paragraph at `191`. It is not an operand of `hasMetadata` (`149`).
The latter has exactly five independent input axes: four-valued `priority`
(`15`, `57`) and `hasDueDate`/`hasProject`/`hasLabels`/`hasSubtasks`
(`132-135`). Its Boolean output is determined by their OR, giving
`4 × 2^4 × 2 = 128` representable and `4 × 2^4 = 64` legal tuples.
The current six-member metadata cluster is complete; adding `hasDescription`
would only multiply it by an unrelated factor. Required arrays/counts do not
add axes. The metadata wrapper (`194`) and its children (`196-246`) preserve
independent child combinations.

Repair the metadata row's anchor from `131` to `132` and E4 citation from
`151` to `149`. Line `151` now counts completed subtasks. The related
`todo-item-due-tone` row still has the complete four-member `16/7` cluster;
only its prose reference to the `isToday` formula should change from
`143-150` to `141-148`. Earlier-today timestamps remain both today and overdue,
and `dueDateToneClassName` preserves today precedence at `17-27`.
`hasDueDate` is genuinely shared by two distinct relations, consistent with
the existing atomic implementation note. This bounded check found no clear
member omission; it is not a new full UI census.

## Exact proposed canonical rows

The following JSONL block contains eleven proposals: four driver additions,
three chart replacements for the raw D-only owner records, and four surviving
seed repairs. The chart proposals are **pending independent adjudication**,
including the explicit net interpretation above. Reusing their raw IDs keeps
the same actual file/symbol owner; the raw immutable report preserves the
valid two-Boolean D1 projection and its reasoning. Do not install both these
replacement records and another full-three-member record for the same
relation. No status in this fenced proposal changes canonical inventory.

```jsonl
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-drivers-a-f-exiftool-write-tags-core-remove-options","file":"packages/drivers/exiftool/src/Exiftool.service.ts","line":515,"symbol":"writeTagsCore","kind":"object-literal","members":["force","recursive"],"status":"disqualified","disqualifier":{"class":"D2","note":"Actual fs.remove options object in the writeTagsCore release callback at515. recursive removes nested temporary files and force tolerates a missing path under the external Effect FileSystem API contract; both are true at this boundary. The concrete object literal is the carrier, not the callback parameters."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-drivers-a-f-ffmpeg-with-staging-directory-remove-options","file":"packages/drivers/ffmpeg/src/FFmpeg.service.ts","line":1771,"symbol":"withStagingDirectory","kind":"object-literal","members":["force","recursive"],"status":"disqualified","disqualifier":{"class":"D2","note":"Actual fs.remove options object in withStagingDirectory's release callback at1771. These are independent external Effect FileSystem removal controls, both selected true for temporary-directory cleanup. The instantiated object is in net; the callable callback is not admitted as a parameter carrier."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-drivers-a-f-ffmpeg-extract-frames-remove-options","file":"packages/drivers/ffmpeg/src/FFmpeg.service.ts","line":2092,"symbol":"extractFrames","kind":"object-literal","members":["force","recursive"],"status":"disqualified","disqualifier":{"class":"D2","note":"Actual fs.remove options object in extractFrames' release callback at2092, a distinct source owner from withStagingDirectory1771. Both external Effect FileSystem removal controls are true for cleanup after frame extraction; no application state union is implied."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-drivers-a-f-box-runtime-prune-undefined-descriptor","file":"packages/drivers/box/src/internal/Box.runtime.ts","line":46,"symbol":"pruneUndefined","kind":"object-literal","members":["configurable","enumerable","writable"],"status":"disqualified","disqualifier":{"class":"D1","note":"Actual Object.defineProperty descriptor at46. configurable, enumerable and writable are independently meaningful ECMAScript attributes, all true in this own-property copy. The required value entry is payload. This is not a Box wire mirror; D1 matches the existing property-descriptor census taxonomy."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-foundation-ui-chart-tooltip-indicator-flags","file":"packages/foundation/ui-system/ui/src/components/chart.tsx","line":302,"symbol":"ChartTooltipIndicator","kind":"props","members":["indicator","nestLabel"],"status":"confirmed","storage":"derived","exposure":"internal","targetShape":"literalkit","tier":1,"cardinality":{"representable":6,"legal":5},"evidence":[{"class":"E4","cite":{"file":"packages/foundation/ui-system/ui/src/components/chart.tsx","line":506},"note":"The sole public-content writer derives nestLabel = original items.length === 1 && indicator !== dot; private props302/304 receive it through Item520, DefaultItem421 and Indicator370. indicator has line/dot/dashed, so nestLabel implies non-dot: exactly five of six literal/Boolean tuples are supported."}],"notes":"Proposed pending independent UI correction. Raw hideIndicator/nestLabel is a valid4/4 projection but omits the actual co-carried literal relation. Keep hideIndicator independent, out of this minimal cluster; its factor gives12/10 only for the larger product. Preserve icon precedence, all payloads and public indicator input/default. Owner has two Boolean props for recall; final minimal cluster has one Boolean plus a literal, an explicit net-adjudication point. Do not add a duplicate broad-three-member row."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-foundation-ui-chart-tooltip-default-item-flags","file":"packages/foundation/ui-system/ui/src/components/chart.tsx","line":364,"symbol":"ChartTooltipDefaultItem","kind":"props","members":["indicator","nestLabel"],"status":"confirmed","storage":"derived","exposure":"internal","targetShape":"literalkit","tier":1,"cardinality":{"representable":6,"legal":5},"evidence":[{"class":"E4","cite":{"file":"packages/foundation/ui-system/ui/src/components/chart.tsx","line":506},"note":"Actual private props364/365 co-carry the three-valued indicator and nestLabel from the sole JSX writer421-429. That writer forwards Content's original-payload derivation506, which excludes only dot/true from the six literal/Boolean tuples."}],"notes":"Proposed pending independent UI correction. Keep independent hideIndicator unchanged and outside the minimal6/5 cluster; preserve label nesting/alignment, value formatting, colors and item configuration. Raw two-Boolean D1 projection is historical evidence, not proof the full owner has no relation. The one-Boolean/literal minimal cluster passes through an owner with two Boolean props; independent net adjudication remains required. Land with the private chart family; no duplicate broad12/10 row."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-foundation-ui-chart-tooltip-item-flags","file":"packages/foundation/ui-system/ui/src/components/chart.tsx","line":403,"symbol":"ChartTooltipItem","kind":"props","members":["indicator","nestLabel"],"status":"confirmed","storage":"derived","exposure":"internal","targetShape":"literalkit","tier":1,"cardinality":{"representable":6,"legal":5},"evidence":[{"class":"E4","cite":{"file":"packages/foundation/ui-system/ui/src/components/chart.tsx","line":506},"note":"Actual props403/405 receive indicator/nestLabel from the sole JSX writer520-532. Content506 sets nestLabel exactly when the original unfiltered payload has one item and indicator is non-dot. line/dot/dashed times two nesting values admits six tuples, with dot/true unsupported and the other five constructible."}],"notes":"Proposed pending independent UI correction. Preserve independent hideIndicator, original payload ordering/filter timing, formatter fallback versus Some(null/undefined/0), key/config/color lookup and public API. One-Boolean/literal minimal-cluster interpretation requires explicit independent judgment although the real props owner has two Boolean members for recall. Do not retain another broad-three-member record for this same relation; Marker and Content remain migration companions unless separately admitted under the net."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"drivers-openclaw-channel-health","file":"packages/drivers/openclaw/src/Openclaw.models.ts","line":594,"symbol":"OpenclawChannelHealth","kind":"schema-struct","members":["connected","restartPending","running"],"status":"disqualified","disqualifier":{"class":"D2","note":"Representative OpenClaw CLI health/status JSON projection for this file; connected/restartPending/running (and OpenclawChannelAccountStatus configured/enabled/probeOk/running) are independently reported upstream facts."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"drivers-openai-compat-chat-completion-request","file":"packages/drivers/openai-compat/src/OpenAiCompat.models.ts","line":850,"symbol":"OpenAiCompatChatCompletionRequest","kind":"schema-struct","members":["parallel_tool_calls","stream"],"status":"disqualified","disqualifier":{"class":"D2","note":"OpenAI-compatible Chat Completions wire request; stream and parallel_tool_calls are independent provider knobs."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r3-foundation-todo-item-presence","file":"packages/foundation/ui-system/ui/src/components/todo-item.tsx","line":132,"symbol":"TodoItem.presence","kind":"sibling-state","members":["priority","hasDueDate","hasProject","hasLabels","hasSubtasks","hasMetadata"],"status":"designed","storage":"derived","exposure":"internal","targetShape":"literalkit","tier":1,"cardinality":{"representable":128,"legal":64},"evidence":[{"class":"E4","cite":{"file":"packages/foundation/ui-system/ui/src/components/todo-item.tsx","line":149},"note":"hasMetadata is non-none priority OR hasDueDate OR hasLabels OR hasProject OR hasSubtasks. Four declared priority values times sixteen presence assignments determine exactly64 tuples out of128 representable combinations."}],"notes":"Round26 D1 supersession: presence inputs are independent but the wrapper OR is an omitted invariant. Replace wrapper state with private TodoMetadataVisibility, preserve four priority values and independent child combinations. Remove unrelated hasDescription from this owner. Shared hasDueDate is a real input to two independently adjudicated relations under SPEC62-65, not a duplicate cluster; delete the local once in their atomic implementation."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"todo-item-due-tone","file":"packages/foundation/ui-system/ui/src/components/todo-item.tsx","line":139,"symbol":"TodoItem","kind":"sibling-state","members":["completed","hasDueDate","isToday","isOverdue"],"status":"designed","storage":"derived","exposure":"internal","targetShape":"literalkit","tier":1,"cardinality":{"representable":16,"legal":7},"evidence":[{"class":"E4","cite":{"file":"packages/foundation/ui-system/ui/src/components/todo-item.tsx","line":140},"note":"isOverdue requires a present parsed due date and incomplete item. isToday at141-148 imposes the same presence/completion prerequisites but may coincide with overdue for an earlier-today timestamp. These formulas produce exactly seven four-bit tuples."}],"notes":"Round26 raw completed/isToday/isOverdue8/4 omitted the legitimate earlier-today overlap and date presence. Preserve seven source tuples and today precedence via private TodoDueTone today/overdue/neutral. hasDueDate is also a source input to the distinct metadata relation; land both designs atomically and delete the local once. Public completed/dueDate props, UTC comparisons, labels, callbacks and styles stay exact."}
```

## Duplicate-cluster accounting and integration bounds

Current inventory was read by file, symbol, and member set, with SHA-256
`1a379afa07d78b906e97cf097b59a530ab97c57935fe6ebcf36b957dcd9cff87` at the
duplicate check. No record in the three driver source files owns these four
new carriers. The two FFmpeg objects have different actual enclosing symbols
and source construction sites. No duplicate was found among the four new
driver proposals.

The sole current chart row is `chart-tooltip-hide-flags` for public
`ChartTooltipContentProps` and its `hideLabel`/`hideIndicator` pair. It remains
D1 and does not duplicate any private indicator/nesting props owner. The
three private props are three distinct actual declarations carrying the same
derived relation; they should share one implementation literal and one atomic
migration, while canonical owner accounting remains distinct. The recommended
integration uses the three raw IDs for the three minimal correlated-cluster
proposals and preserves the old D1 projections in immutable raw evidence.
If the parent instead retains separate D1 projection rows, their notes must
state the exact independent two-Boolean relation and cross-reference the
distinct literal/nesting relation; they must not claim complete owner
independence or double-count a broad12/10 version of the latter. No such
alternative additional rows are proposed here.

The two DatasetLoader withdrawals concern different sets of callable symbols;
neither is replaced by a combined fabricated carrier. All ten withdrawal IDs
were present in the checked inventory snapshot. The two OpenAI-compatible
request clusters share `stream` but have different second members and
different external-contract questions; no duplicate deletion is supported by
this bounded audit. The two todo qualified relations share real `hasDueDate`
but have different complete member sets and invariants. No description-based
third relation or duplicate metadata row is proposed.

Before integration, the parent should reconcile against any concurrent
inventory updates. Only the new audit file was written by this task. No
canonical rows, current designs, source, tests, archived artifacts, prior
audits, reports, services, git refs/index/worktree state, or package commands
were changed or run. Read-only `git show` was used to compare the source bytes
to the frozen HEAD. A provisional chart design, if separately written after
this receipt, is not evidence of independent census acceptance.

## Frozen source hashes and local verification

Every authored source and auxiliary fixture below was read from the working
tree and byte-compared with `git show 93217d998f851e2e93d9864e2b5315552eaa58a7:<path>`;
all eighteen comparisons matched. The `.repos/effect` reference was hashed
separately and is not part of this frozen source projection.

| File | SHA-256 |
| --- | --- |
| `packages/drivers/box/src/internal/Box.runtime.ts` | `3c19e226aa917917356e5a5e64ef8f1d3f5c1d261865ab34e731f8711ab0da45` |
| `packages/drivers/exiftool/src/Exiftool.service.ts` | `812220050985518043ca27bd38d2bbe75829edf86f2c7e8a7e227201b9fe336d` |
| `packages/drivers/ffmpeg/src/FFmpeg.service.ts` | `6aba2508f67acc22da1ae0c44593bceb22cba09d7feb885e84a9c98cd489adb6` |
| `packages/foundation/ui-system/ui/src/components/chart.tsx` | `0b515cbd1ee51eb79ee36bb2d941507f180fdb1ce233b0db44526de62711e0c5` |
| `packages/foundation/ui-system/ui/src/components/todo-item.tsx` | `c1d62d3b50a9b7b44d8ab45ef1982acd2f5997c681067927369d4ac0ec5ba6c5` |
| `packages/foundation/ui-system/brand/src/Brand.assets.ts` | `52699c7e5676483ab71ab6f7b240d87c4d4725eacf3e5b2da67db13846184904` |
| `packages/drivers/openclaw/src/OpenclawProbe.service.ts` | `25c9964fcbe2846a8a55111425bba236b74d78f069513ae53691cd59e721bb26` |
| `packages/drivers/openclaw/src/OpenclawRender.ts` | `4cd74bccb250c9f94a610d89a4fdf35bd67536ee6d6ea1e8b18c23a54f41f2fc` |
| `packages/drivers/rdf-canonize/src/adapters/canonicalization.ts` | `ec143d3c6ac7a54466ca3dc899fbb3cc1f067962844b7f7646e0fdb1568ed946` |
| `packages/drivers/nlp-mcp/src/Streaming/DatasetLoader.ts` | `688ea2f12ce41b072e2502343bf0e8a3b137a7660150715e0719945ac76674a6` |
| `packages/drivers/postgres/src/Postgres.errors.ts` | `95852de434c01fbb56a94352588070b8e81a1afa150b66aae2a260ac5976bb36` |
| `packages/drivers/postgres/src/PostgresDiagnostics.service.ts` | `dc656ca425f45824aad5647451ae9a9f58634189ccc1ab96e31a6d85679b1e85` |
| `packages/drivers/postgres/src/internal/PostgresDiagnosticGuards.ts` | `b0f9a261fd9563b4047a71e72f2f953cf5ed9c8d0099c73499a4ceb51220355e` |
| `packages/drivers/pacer/src/PclClient.service.ts` | `7c3c27b7e4be912257f418019e8148798128f217bfd671997d8b46078c61c5ad` |
| `packages/foundation/modeling/schema/src/Slug.ts` | `5adc31210bca545b4c90f9e4f7b2336a35696d58a6fbdb6891e3fac394dda700` |
| `packages/drivers/openclaw/src/Openclaw.models.ts` | `7bb6d035f7a871b1a2654466e79594261fc41d73a4abe86093ee47ff92ec1917` |
| `packages/drivers/openai-compat/src/OpenAiCompat.models.ts` | `ce2d9ad62885ee4ee748557c02d6e37bddbf0530010accd55444b099bbbfae36` |
| `packages/foundation/ui-system/ui/test/ui.test.ts` | `b7008c03aa9fcafd925feb8971081874c7617e060abe2ff002a64fa00b924f7f` |
| `.repos/effect/packages/effect/src/FileSystem.ts` (API reference only) | `b9e289a8a0d18d04879d0fb507c2ad342aaaf8b9b01cff0cd0acae9cd23fba17` |

The previous deliverables were checked unchanged:

| Prior deliverable | SHA-256 |
| --- | --- |
| `data/design-refresh-2026-09-09-r28-docgen-files-impact.md` | `49d0d230d4124f87e09c4abe01ba2ab808e665dd8a41565241548bc2f1023d00` |
| `data/design-refresh-2026-09-09-r28-modeling-carriers.md` | `857d0014bb88e727bc28ec3c62145b387cab8df9fcc80bdc725d03efdce41e75` |
| `data/provisional-html-datalist-child-grammar.md` | `02a7be1d6ffd996da2e28919fb07cf6514f1983c0070e0ef833276a38df96cc2` |

Local verification parses the proposed JSONL, checks unique IDs and current
source citation bounds, verifies the ten withdrawal IDs against the read
inventory, and enumerates the five chart tuples and the factorized todo
cardinality. These are documentation/source checks only; no product tests or
package verification were run. The chart qualification/net question and the
UI coverage correction remain explicitly pending independent review.
