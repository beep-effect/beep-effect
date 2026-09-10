# R28 non-tooling source and design impact — 2026-09-09

## Source boundary and disposition

This is bounded native P2 source adjudication after the authorized merge. It is
not an independent P3 result, a replacement census, a status advance, or product
implementation. Current source is `93217d998f851e2e93d9864e2b5315552eaa58a7`;
current corpus pin is `origin/main@d1b4d769fbaffddd55717f3b1ba461897dd545c5`.
The comparison source is `8f266b878445ca8a7f751f9248da428a4dde39a1`, previously
paired with `origin/main@663904610cce2a38c06b0619a8c414646b69361c`.
Use origin/main, not the independently movable local main branch.

The impact map `data/main-d1b4d7-impact.json` names 12 changed non-tooling source
files and 17 canonical rows. All 17 rows are adjudicated below. Retain 12 with
current source metadata; withdraw five ineligible callable/synthetic rows,
including one qualified row. The spinner row is an additional consumer-only
impact outside those 17: its source is unchanged and its 8/4 qualification stays.
There are no new qualifications in this handoff.

Three owned current designs were refreshed: `ontology-inference-recompute-cause`,
`ontology-infer-session-recompute-latches`, and
`r27-boolean-state-foundation-spinner-state`. The fourth,
`r3-domains-reasoner-module-affected-flags`, remains byte-identical to its archive
pending parent removal together with its invalid inventory row. No inventory,
source, test, package, status, Git ref/index, archive, or R27 receipt was edited.

## Discovery and exact-source method

Graft was queried first: `inferOntologySession` callers returned no graph
symbol, while `useSpinner` callers identified `useNumberInput.ts:872–1036`.
A graph regex search found reasoner declarations and consumers, and a second
found chart/CSS, microphone/WebGL, and IPv6 anchors. These results guided source
reads; the missing graph symbol does not show that inference has no callers.
Read-only old/current Git diffs and direct numbered source established changed
spans. Complete symbol/subpath searches in packages/apps supplemented the graph
for inference result/request reads, transport forwarding, hook callers, and
exports. No graph rebuild, package command, test, or browser execution was run.

The binding eligibility rules are SPEC.md:30–42 and DECISIONS.md:12–20,107–120.
Named/co-carried Boolean values, schema members, state atoms, props and actual
constructed object arguments qualify for the net before E1–E4. Functions with
Boolean return types do not become sibling Boolean state. Required number,
string, array, or object payload comparisons do not invent extra members.
The schema-first-development, atom-reactivity-specialist and browser-qa-loop
skills inform the designs; implementation checks and gesture evidence remain
future gates.

## Complete 17-row source adjudication

Paths in this table are repo-relative. Each short filename is resolved by the
full canonical row in the JSONL section below or the withdrawal table.

| Canonical id | Current owner, declared members and proof | Parent disposition |
| --- | --- | --- |
| `ontology-inference-recompute-cause` | `Session.reasoner.ts:295–309` declares `drifted:S.Boolean` and `fullRecompute:S.Boolean`; actual locals814–815 and returned fields862–863 retain the implication. The helper extraction554–631 shifts these producers by21 lines. | Retain 4/3, Tier2, stored/wire. Correct E4 cite794→815 and producer note838–843→859–864. Refresh design. |
| `ontology-infer-session-recompute-latches` | Actual named `historyRewound`, `drifted`, `fullRecompute` Boolean values at810–815 inside `inferOntologySession`805. They are not the neighboring predicate functions. | Retain 8/4, Tier1 derived/internal. Anchor789→810 and E4 cites793/794→814/815. Refresh design. |
| `r3-domains-reasoner-module-affected-flags` | Three function declarations at482/485/493, invoked inline at820/821/834; no `inferOntologySession.moduleAffected` carrier. | Withdraw row and current design together; do not downgrade to D1 or manufacture a replacement. |
| `live-waveform-mode-flags` | `LiveWaveformProps:31–52`, optional Boolean active32,processing33,fadeEdges40; source declaration and priority reader54–64 unchanged. Active capture remains independent of processing/fade. | Retain D1. Include omitted/undefined options; preserve mode scrolling/static/omitted and full callback/numeric/string payloads. |
| `use-number-input-options` | `UseNumberInputOptions:702–731`, four independently optional Booleans707/714/720/724. Defaults878–885; blur helper88–113 called978. | Retain D1; anchor653→702. All16 supplied Boolean tuples remain, plus each omitted/undefined value; do not equate the raw option domain with just16 values. |
| `number-input-modifier-keys` | `ModifierKeyState:62–66`, each meta/ctrl/shift optional Boolean; constructor227–228 retains shift directly and ORs meta/ctrl. | Retain D1. All27 false/true/undefined value triples supported. |
| `number-input-step-modifiers` | Actual labeled tuple at68: coarse is `boolean|undefined`, fine is `boolean`. Constructor227–228 and priority reader230–240 support all six values, including undefined coarse with either fine value. | Retain D1 and real undefined alternative. Update old reader191→230–240; do not turn the tuple into two required Booleans. |
| `chart-tooltip-hide-flags` | New named `ChartTooltipContentProps:21–28` owns optional hideLabel23/hideIndicator24, consumed at463–477 with false defaults468–469. Label reader481, indicator reader295–308. | Retain D1; correct symbol to ChartTooltipContentProps and anchor284→21. This current named carrier is eligible independently of the old anonymous props annotation. |
| `r2-foundation-retry1-number-input-spin-disabled` | Actual values997–998; returned disabled/aria-disabled1023–1034. `min=max=value` supports both true; interior/disabled enforcement off supports both false; ordinary bounds support each one-sided case. | Retain D1; anchor968→997. Required numeric comparisons are explanations of these actual declared values, not additional virtual members. |
| `r2-foundation-iri-ipv6-segment-facts` | Actual Boolean locals isLast355/hasDot356, within unchanged parseIpv6Side341–377. Input parser supports recognizing/rejecting arbitrary text; dotted-middle yields rejection359, not a separate exclusive operational phase. | Retain D1 and anchor355. The merge changes optional query/fragment parsing at635–641,711–749, not these values. Full IPv4-tail/h16 and invalid-text parser outcomes remain. |
| `r3-domains-ontology-iri-kind-probes` | isVocabularyIri469, isOntologyTypeIri480, isPropertyTypeIri489 and isTBoxPredicateIri501 are functions; consumers now at526,653–655,683,698,723,730. | Withdraw callable/synthetic D1 row. |
| `r3-domains-reasoner-type-key-probes` | hasExistingTriple507, sameTypeKeys772 and typeBearingInferenceChanged784 are functions. Readers558,666,676,802,835 do not construct named Boolean members of a probes record. | Withdraw callable/synthetic D1 row. |
| `r3-domains-session-projections-term-view-probes` | sameIri382, isNamedNodeObject427 and exported overloaded function resourceVisibleInViewMode942–951; no termProbes declaration. Its return type remains Boolean, not a stored Boolean value. | Withdraw callable/synthetic D1 row. Preserve public function/real OntologyViewMode literals. |
| `r24-foundation-ui-orb-webgl-context` | Actual JSX Canvas gl object149–153 with alpha,antialias,premultipliedAlpha true, unchanged content after44-line shift. | Retain D2; anchor106→149. Descriptive Orb.gl identifies an actual API object, so lack of a local binding is not grounds for withdrawal. |
| `r24-foundation-ui-live-waveform-audio-constraints` | Actual getUserMedia audio object alternatives399–409 inside setupMicrophone395. Each writes three true fields; selected-device branch also includes deviceId:{exact:deviceId}. | Retain D2; anchor279→399. Preserve both full object alternatives and exact device selector. |
| `r24-foundation-ui-chart-css-sanitizer` | isSafeCssIdentifier145 and isSafeCssColorValue147 are functions, applied separately at184/205 by ChartStyle179. Neither is a stored member of ChartStyle. | Withdraw callable/synthetic D1 row. Sanitization behavior remains unchanged. |
| `r25-epistemic-ontology-bounded-shacl-conforms-truncated` | New `validationResult:203–223` returns actual ShaclValidationResult.make input objects211–215 and218–222; service callback266–273 forwards them. The old sibling-state anchor196 now points at focusSubjectKeys. | Retain D1, repair kind to object-literal, symbol validationResult, line211. Shared schema/producer proof below prevents local 4/3 redesign. |

## Exact withdrawal evidence and preservation

| Withdraw id | Canonical file | Old and current declaration evidence | Archive action |
| --- | --- | --- | --- |
| `r3-domains-reasoner-module-affected-flags` | `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts` | Old/current482–494 both declare `(signatures:ReadonlyArray<OntologyInferenceChangedSignature>)=>boolean` functions. Actual calls are old799/800/813 and current820/821/834. The disjointness call also ORs a separate function result at835; no tuple is stored. | Parent removes current row/design together. Pre-edit design already at `history/designs/2026-09-09-pre-main-d1b4d7/r3-domains-reasoner-module-affected-flags.md`; leave archive and current bytes unchanged in this task. |
| `r3-domains-ontology-iri-kind-probes` | `packages/ontology/use-cases/src/aggregates/Session/Session.projections.ts` | Old/current469/480/489/501 are `(iri:string)=>boolean`; resourceKindFor503 consumes types/IRI collections, not a declared iriProbes record. | Archive exact current canonical row on parent integration; no current design belongs to this D row. |
| `r3-domains-reasoner-type-key-probes` | `packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts` | Old functions507/751/763 moved to507/772/784; sameTypeKeys compares arrays, typeBearingInferenceChanged returns its negation. Those calls have no co-carried named values. | Archive canonical row; no replacement based on array equality. |
| `r3-domains-session-projections-term-view-probes` | `packages/ontology/use-cases/src/aggregates/Session/Session.projections.ts` | Old/current sameIri382 and isNamedNodeObject427; public function912→942 returns Boolean from the real all/tbox/abox LiteralKit. | Archive canonical row; leave the public function and full literal domain intact. |
| `r24-foundation-ui-chart-css-sanitizer` | `packages/foundation/ui-system/ui/src/components/chart.tsx` | Old136/138→current145/147 are `(value:string)=>boolean` functions. ChartStyle invokes them on different key/color values184/205. | Archive canonical row; preserve CSS checks and outputs. |

These defects predate the merge. The R27 receipts describe their historical
pin and remain immutable; the R28 integration receipt records the correction.
Subset implications among function outputs cannot establish a missing owner.
No callable withdrawal deletes a product guard, changes imports/exports, or
requires a replacement domain model.

## Qualified state proof and design preservation

`ontology-infer-session-recompute-latches` retains exactly four supported
triples in historyRewound/drifted/fullRecompute order: `000` (previous result,
within cap), `001` (initial within cap), `011` (cap exceeded without rewind,
including an initial over-cap run), and `111` (history rewind). E4 is explicit
at `Session.reasoner.ts:814–815`. Drift takes precedence over initial full.
The result owner at299–300 forgets the two drift triggers and emits exactly
false/false, false/true, true/true. No required count predicate was added to the
member list. Existing reasoner fixtures at `packages/ontology/use-cases/test/Session.test.ts:333–405`
cover initial/add/remove paths; the P2 plans still require focused cap/rewind
fixtures. The new closure extraction does not remove the separate type-change
OR at835 or change the supported module `full|incremental|reused` domain.

The Tier1 design creates the single exported cause kit and removes local
latches/helper Boolean input; its only legacy Boolean projections remain on
the returned result until Tier2. The Tier2 design reuses that owner. It now
exports the decoded `OntologyInferenceResultValue` constructor required by
cross-module examples and the old-shape `OntologyInferenceResultEncoded`
reference, uses decoded `S.toType` nested payload schemas, and counts no second
removal of the predecessor's recomputeMode guard. It preserves exact signature,
module, violation, Dataset, processed-count and drift-cap payloads.

Exact known migration surface: `Session.reasoner.ts:278–287,295–309,337–345,745–753,810–868,889–914`;
`Session.projections.ts:889–914`; `Session.validation.ts:171,456`;
`Session.sparql.ts:171,529`; the Session barrel42/49;
`packages/ontology/use-cases/src/tools/OntologyToolService.ts:270` (drift refusal);
`packages/ontology/ui/src/aggregates/Session/Session.metrics.tsx:48–55` (preserve
exact full/ok strings); `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:913,1007–1033,1508–1510`;
`Session.rpc.ts:410–414,496`; and
`apps/professional-desktop/src/ontology/OntologyOrchestrator.ts:138,175–188,208`.
Client protocol selection is at Session.atoms89/105/121–124, desktop App241–243,
IpcChatClient32–33 and DesktopHttpProtocol39. No second result serializer was
found by the complete source symbol search. Future implementation must prove
HTTP and IPC response/request compatibility, including nested optional
`previous` and both validation/SPARQL `inference` fields. Preserve None/omission,
Some(full result), default driftCap64, and exact old canonical encoded output
for every legitimate pair. Intentional rejection of old schema-permissive
true/false is a separate invalid-state test, not a claim that every old decoded
shape was a legitimate producer state.

Spinner source `packages/foundation/ui-system/ui/src/hooks/useSpinner.ts` is
unchanged. Its actual `number|undefined` timeout/interval fields and Boolean
runOnce retain the four writer states idle, initial-delay, repeat-delay and
repeating. Numeric zero remains a present timer. The current sole source call
is `useNumberInput.ts:894`, with starts907–923 and stops1017–1035. The merge adds
blur helper88–113 and TestKit133–135, called978; helper tests45–56 exercise its
normalization, not spinner state. Full TS/TSX/MDX symbol/subpath search across
packages/apps found no executable useNumberInput caller beyond its documentation.
Public package subpaths remain supported and cannot be called unexposed merely
because app callers are absent. The refreshed design retains both mounted
atoms179–180, latest-state finalizer111, TTL protection172–178, callback ordering,
300ms delay/350ms first repeat/50ms cadence, repeated-start behavior and all
existing stop gestures. Its existing planned hook/registry tests and recorded
browser QA remain required at implementation; no browser run occurred here.

## Shared SHACL producer proof

The new bounded helper is an actual returned data carrier, not a pair of
Boolean function handles. At `BoundedShaclValidator.layer.ts:210–215`, reached
maxResults with at least one accumulated violation returns false/true; at218–222
exhaustion returns `violations.length===0`/false. This is the same three-row
producer subset formerly at196–208. Preserve all violation fields; the array's
length test is not a third member.

The shared owner is `packages/foundation/capability/semantic-web/src/services/shacl-validation.ts:285–295`,
with conforms/truncated required Boolean and violations an Array. The public
request's optional maxResults accepts zero; `packages/drivers/shacl/src/Shacl.validation.ts:414–423`
computes retained findings independently from the engine verdict. The durable
`data/design-refresh-2026-09-08-nlp-shacl.md` already contains a public-service
reproduction of all four rows, including custom-severity findings with cap0
producing true/true. Current shared schema/driver source still preserves that
route. That reproduction was not rerun in this P2 audit. The bounded source
extraction cannot impose its local relation on this shared owner. ClaimGate's
actual reader at `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts:71–81`
admits only conforms&&!truncated while preserving rejected violation payloads.
Retain the existing canonical shared-owner D1 and the corrected bounded producer
D1; do not narrow to a three-state result.

## Changed files without affected canonical rows

The impact map contains no canonical rows for the face-detection service or
three theme files. Their changed spans were inspected for the assigned impact
review; this statement is not an independent empty census for those files.

- `packages/drivers/face-detection/src/FaceDetection.service.ts:370–431` extracts
  geometry and a test seam. The returned scale/padding/offsets388–394 are required
  numeric payloads. `inputDimensions` remains a real Option<ModelInputDimensions>
  (schema155–162); None pads the original image and Some preserves both supplied
  dimensions. Do not create virtual `offsetXPresent`/`offsetYPresent` or zero/nonzero
  members. Validation512–571 and tensor433–452 helpers keep typed image errors;
  preprocessImage574–618 carries the complete payload into PreprocessedImage.
  New strideFaceAt701–731/collectStrideFaces733–754 retain confidence/box/all five
  landmark payloads and array outputs. Confidence threshold749 is not a named
  Boolean state. Existing new test fixtures at FaceDetection.service.test225–238
  exercise both geometry routes. No canonical row correction is proposed here.
- `packages/foundation/ui-system/ui/src/themes/components/button.ts:12–157,223–257`
  extracts palette/size/style helpers and real style objects. Required dimensions,
  color/variant literals and CSS keys do not become Boolean flags through equality
  tests. `disableElevation:true` at220 is one external option; no affected pair
  is created by that single field.
- `packages/foundation/ui-system/ui/src/themes/components/chip.ts:33–198` and
  `controls.ts:194–314` name palette values and reuse them in returned style
  objects. Literal variant/size/color matching and CSS `.Mui-disabled` or checked
  selector text are not Boolean fields. Existing `clickable:true` atchip188 is
  one external option, and type-augmentation `large:true` is a literal capability
  entry in separate declarations, not sibling state. No invented pair is admitted.
- `Session.projections.ts:602–780` extracts a real SnapshotAccumulator with
  MutableHashSet/MutableHashMap collections and a relationship array. Collection
  emptiness, IRI equality and term-type predicates are not extra Boolean members.
  Preserve Subject NamedNode/BlankNode, ObjectTerm NamedNode/BlankNode/Literal,
  all/tbox/abox view modes and partition arrays. The actual predicates listed in
  the withdrawal table remain functions after extraction.
- `live-waveform.tsx:66–203,368–510` extracts numeric bar/layout/rendering and
  teardown helpers. Its full static/scrolling modes and nullable stream/context
  references remain; the existing D1 props and D2 constraint objects above are
  unaffected in eligibility. `orb.tsx:72–115,258–304` keeps null/listening/talking/
  thinking agent states and auto/manual mode with complete numeric/ref/callback
  payloads. Do not call an Exclude<AgentState,null> lookup table the whole domain.

## Exact proposed retained rows

These 12 full rows preserve current statuses; they are parent integration inputs,
not an inventory edit. Rows whose anchor remains correct receive only the
explicit domain/evidence note, or remain unchanged (`r2-foundation-iri-ipv6-segment-facts`).
The five withdrawals above have no replacement JSON record and must not be
encoded as D1/D2 merely to keep their counts.

```jsonl
{"schemaVersion":"boolean-creep-inventory/v1","id":"ontology-inference-recompute-cause","file":"packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts","line":299,"symbol":"OntologyInferenceResult","kind":"schema-struct","members":["drifted","fullRecompute"],"status":"reviewed","evidence":[{"class":"E4","cite":{"file":"packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts","line":815},"note":"At current source 93217d998f, fullRecompute = O.isNone(previous) || drifted at815; the actual OntologyInferenceResult fields drifted/fullRecompute at299-300 are written at862-863. drifted implies fullRecompute, so true/false has no supported producer; retain4/3 and exact legacy wire pairs."}],"cardinality":{"representable":4,"legal":3},"storage":"stored","exposure":"wire","targetShape":"literalkit","tier":2,"notes":"RPC compatibility codec preserves drifted/fullRecompute on the wire and exposes incremental|drifted|full after decode."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"live-waveform-mode-flags","file":"packages/foundation/ui-system/ui/src/components/live-waveform.tsx","line":32,"symbol":"LiveWaveformProps","kind":"props","members":["active","processing","fadeEdges"],"status":"disqualified","disqualifier":{"class":"D1","note":"D1 at current source93217d998f: LiveWaveformProps32-40 retains optional Boolean active,processing,fadeEdges. All eight supplied Boolean combinations are supported; omitted/undefined values also remain supported. waveformAriaLabel54-64 gives active priority and fade rendering at452,480 is independent; preserve scrolling/static mode and all other payloads."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"use-number-input-options","file":"packages/foundation/ui-system/ui/src/hooks/useNumberInput.ts","line":702,"symbol":"UseNumberInputOptions","kind":"type-literal","members":["allowMouseWheel","clampValueOnBlur","keepWithinRange","focusInputOnChange"],"status":"disqualified","disqualifier":{"class":"D1","note":"UseNumberInputOptions702-731 declares four independently optional Boolean behavior options; all16 supplied Boolean combinations and every omission/undefined alternative are supported (3^4 value quotient before defaults). Defaults at878-885 are focus=true,keepWithinRange=true,clamp=true,wheel=false. The extracted blur helper88-113/978 retains clamp behavior without coupling the options."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"number-input-modifier-keys","file":"packages/foundation/ui-system/ui/src/hooks/useNumberInput.ts","line":63,"symbol":"ModifierKeyState","kind":"type-literal","members":["metaKey","ctrlKey","shiftKey"],"status":"disqualified","disqualifier":{"class":"D1","note":"ModifierKeyState62-66 has three optional Boolean members (27 false/true/undefined value tuples). makeStepModifierState227-228 accepts each supplied/omitted modifier independently; shift and ctrl/meta chords may co-occur. No relation or exclusive state is required."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"number-input-step-modifiers","file":"packages/foundation/ui-system/ui/src/hooks/useNumberInput.ts","line":68,"symbol":"StepModifierState","kind":"type-literal","members":["coarse","fine"],"status":"disqualified","disqualifier":{"class":"D1","note":"StepModifierState68 is the actual readonly labeled tuple [coarse:boolean|undefined,fine:boolean]. makeStepModifierState227-228 retains shiftKey directly and ORs meta/ctrl into fine; all six value tuples are supported. getStepRatio230-240 prioritizes coarse then fine without rejecting their joint-true chord. Keep undefined coarse as a real alternative."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"chart-tooltip-hide-flags","file":"packages/foundation/ui-system/ui/src/components/chart.tsx","line":21,"symbol":"ChartTooltipContentProps","kind":"props","members":["hideLabel","hideIndicator"],"status":"disqualified","disqualifier":{"class":"D1","note":"Named props carrier extracted at21-28, consumed by ChartTooltipContent463-477. Optional hideLabel/hideIndicator remain independent (all four supplied Boolean pairs plus omission); defaults false at468-469. Label hiding at481 and indicator handling at295-308 are separate. Preserve indicator line/dot/dashed, nullable React label content, formatter behavior and complete Recharts payload."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r2-foundation-retry1-number-input-spin-disabled","file":"packages/foundation/ui-system/ui/src/hooks/useNumberInput.ts","line":997,"symbol":"useNumberInput","kind":"sibling-state","members":["incrementDisabled","decrementDisabled"],"status":"disqualified","disqualifier":{"class":"D1","note":"Actual sibling Boolean values at997-998 derive independent upper/lower-bound observations and project to disabled/aria-disabled at1023-1034. All four pairs have supported inputs: unbounded/interior or keepWithinRange=false gives00; upper bound10; lower bound01; min=max=value gives11. Required numeric value/min/max are payloads, not extra presence flags."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"ontology-infer-session-recompute-latches","file":"packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts","line":810,"symbol":"inferOntologySession","kind":"sibling-state","members":["historyRewound","drifted","fullRecompute"],"status":"designed","evidence":[{"class":"E4","cite":{"file":"packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts","line":814},"note":"Actual Boolean locals at810-815: drifted = historyRewound || changedOperations.length > driftCap; historyRewound implies drifted."},{"class":"E4","cite":{"file":"packages/ontology/use-cases/src/aggregates/Session/Session.reasoner.ts","line":815},"note":"fullRecompute = O.isNone(previous) || drifted at815; drifted implies fullRecompute. Four supported triples remain 000,001,011,111; required counts are not additional members."}],"cardinality":{"representable":8,"legal":4},"storage":"derived","exposure":"internal","targetShape":"literalkit","tier":1,"notes":"Current-corpus refresh admission; stage incremental|drifted|full cause before the dependent Tier 2 result codec and temporarily project its two legacy result booleans."}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r2-foundation-iri-ipv6-segment-facts","file":"packages/foundation/modeling/rdf/src/Iri.ts","line":355,"symbol":"parseIpv6Side","kind":"sibling-state","members":["isLast","hasDot"],"status":"disqualified","disqualifier":{"class":"D1","note":"Independently observed IPv6-segment facts: last-slot vs dotted IPv4 tail. Combined-true is the legal IPv4-mapped last segment; middle h16 and last h16 are also legal. The hasDot && !isLast arm is a validity reject over free combinations, not a masked union."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r24-foundation-ui-orb-webgl-context","file":"packages/foundation/ui-system/ui/src/components/orb.tsx","line":149,"symbol":"Orb.gl","kind":"object-literal","members":["alpha","antialias","premultipliedAlpha"],"status":"disqualified","disqualifier":{"class":"D2","note":"Actual inline Canvas gl object at149-153, now shifted by44 lines. alpha,antialias,premultipliedAlpha are external R3F/WebGL attributes, all written true here. D2 retains this actual instantiated API options carrier; descriptive Orb.gl is an anchor label, not evidence of a declared local. AgentState null/listening/talking/thinking and auto/manual volume mode remain distinct payload domains."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r24-foundation-ui-live-waveform-audio-constraints","file":"packages/foundation/ui-system/ui/src/components/live-waveform.tsx","line":399,"symbol":"LiveWaveform.setupMicrophone","kind":"object-literal","members":["echoCancellation","noiseSuppression","autoGainControl"],"status":"disqualified","disqualifier":{"class":"D2","note":"Actual inline getUserMedia audio objects at399-409 inside setupMicrophone395. Both branches write echoCancellation,noiseSuppression,autoGainControl=true; one additionally preserves deviceId:{exact:deviceId}. These are external browser MediaTrackConstraints (D2); the descriptive owner identifies real object literals, not callable Boolean members."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r25-epistemic-ontology-bounded-shacl-conforms-truncated","file":"packages/epistemic/server/src/ShaclValidation/BoundedShaclValidator.layer.ts","line":211,"symbol":"validationResult","kind":"object-literal","members":["conforms","truncated"],"status":"disqualified","disqualifier":{"class":"D1","note":"Anchor the actual returned ShaclValidationResult.make input objects at211-222 in validationResult203, not nonexistent Boolean locals in the service callback. Bounded writer produces false/true on a reached cap and false/false or true/false at exhaustion. Shared ShaclValidationResult285 has four supported pairs via the external-engine adapter including custom-severity maxResults0 => true/true; retain D1 and all violation payloads. Source-grounded public-service receipt data/design-refresh-2026-09-08-nlp-shacl.md remains applicable; this producer subset does not narrow the shared owner."}}
```

## Pre-edit design receipts

Exact pre-edit bytes were already archived by the parent in
`history/designs/2026-09-09-pre-main-d1b4d7/`; none were overwritten.

| Design id | SHA-256 of archived pre-edit bytes | Current disposition |
| --- | --- | --- |
| `ontology-inference-recompute-cause` | `ffa4209e91041e59a29e1fe2abf837307574f1c088f687a92f5db2296275bd7d` | Refreshed at current source |
| `ontology-infer-session-recompute-latches` | `dc75302edf78f1e698ca6db0a847e2b9b0986001012e5180fc9db237ccaa721a` | Refreshed at current source |
| `r3-domains-reasoner-module-affected-flags` | `8c0339955a0a966d1126e9e8a1991cb976f515d2e8718fe4f43553099688225b` | Unchanged; parent withdrawal pending |
| `r27-boolean-state-foundation-spinner-state` | `74827cb919841538e9e2dc988f3024f42118290bdd4c5a35a7d07a4d9169e18b` | Refreshed at current source |

## Validation and handoff

Completed scoped checks:

- Extracted this document's twelve JSONL proposals and ran
  `bun goals/boolean-creep/ops/validate-inventory.ts /dev/stdin`:
  `inventory OK: 12 records, 12 unique ids`.
- Every required section is present in the three refreshed designs. The fourth
  current design remains byte-identical to the pre-edit archive with SHA-256
  `8c0339955a0a966d1126e9e8a1991cb976f515d2e8718fe4f43553099688225b`.
- All 12 impacted non-tooling source files plus useSpinner match frozen HEAD.
  useSpinner is also byte-identical to the prior source. HEAD and origin/main
  match the full pins printed above.
- Scoped `git diff --check` passes. No package tests, services, browser QA,
  source mutations, status changes, or independent P3 work ran in this task.

Canonical reconciliation, archive/removal of five rows and one design,
aggregate count/design validation, the new exact-source census and independent
P3 review belong to the parent. R27 remains finalized at its old pin. A later
qualified review must use the refreshed source evidence; this handoff does not
carry old independent acceptance forward automatically.

Graft reported estimated whole-file-read savings of 100,803 tokens across three
successful queries; its separate missing-symbol query provided no completeness
proof. Direct source/diff/consumer verification was still required.
