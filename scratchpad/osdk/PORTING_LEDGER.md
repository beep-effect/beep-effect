# Porting ledger: `@osdk/api` 2.88.0 to `scratchpad/osdk`

## Status after the fix wave (2026-11-12)

Written by the last writer of the fix wave, after the code was finished. The rows of section 1 are kept as
written. A cell there that begins with **(superseded 2026-11-12 ...)** holds a statement that is no longer
true; the marker says which part, and this section has the current value under the same row number. Two
markers are dated 2026-11-13: they were set by stage F6 of the second fix wave, whose subsection is near the
end of this section. Section
7, at the end of the file, is the earlier note of one fixer and still holds, except that README section 3 now
names the typed actions, the typed queries and the operations facade in its `Model` and `Client` rows instead
of in a row of their own. Everything stated here was checked against the code on 2026-11-12: every `rg`
command was run from `scratchpad/osdk`, and every local target was resolved to an `export` line.

Result in one paragraph: of 310 symbols, 173 are ported, 61 redesigned, 43 subsumed, 13 rejected and 20
MISSING, all 20 declared in README section 7. Typed actions and typed queries, the two gaps a user would have
felt first, are built: `Model.action`, `Model.query` and a facade of four functions in `Client`. What is
missing now is interface-typed models, running services (subscriptions, media and time-series reads,
transformation jobs, agent polling) and the static types OSDK computes for aggregations, derived properties
and shapes.

### Rows whose disposition changed

| # | Symbol | Was | Is | Local target | Proof |
| --- | --- | --- | --- | --- | --- |
| 7 | `ActionDefinition` | MISSING (undeclared) | redesigned | `Model/Model.action.ts` `action`:927, `ActionModelDefinition`:870, `requiredParameter`:747, `optionalParameter`:802, `argumentsOf`:852, `actionConformance`:1357; `Client/Client.operations.ts` `applyAction`:183, `applyActionWithEdits`:262, `validateAction`:331, `ActionModel`:53; `Client/Client.errors.ts` `ActionRejected`:391 | `test/Operations.test.ts` (28 tests; "a typed action applies and the next typed read sees the new object", "untouched, cleared and set optional parameters reach the handler as three wire records", "wrong arguments and wrong specs do not compile"); `test/Readme.test.ts` block (g); doctest on 9 of 11 targets (the two interfaces have none) |
| 79 | `QueryDefinition` | MISSING (undeclared) | redesigned | `Model/Model.query.ts` `query`:435, `QueryModelDefinition`:373, `inputsOf`:357, `setOf`:104, `mapOf`:172, `unionOf`:212, `queryConformance`:762; `Client/Client.operations.ts` `executeQuery`:416, `QueryModel`:71 | `test/Operations.test.ts` ("a typed query sends its parameters and returns its typed output", "a query call names its version and a malformed answer is a DecodeError", "the Parameters and Output codecs of a query are exact"); `test/Readme.test.ts` block (g); doctest on 7 of 9 targets (the two interfaces have none) |
| 35 | `UpdateCipherText` | MISSING (undeclared) | MISSING (declared) | none | `README.md` has: `OSDK's `UpdateCipherText``; `rg -c 'CipherChannelStrategy' src --glob '!src/CipherText/CipherText.model.ts'` = 0 |
| 40 | `Media`, `MediaMetadata`, `MediaFullMetadata`, `MediaPropertyLocation` [4] | MISSING (undeclared) | MISSING (declared) | none | `README.md` has: `Reading media and attachment metadata.`; `rg -c '(?i)media/\|mediaset' src/Api src/Client` = 0 |
| 102 | `executeStreamingFunction` | MISSING (undeclared) | MISSING (declared) | none | `README.md` has: `Streaming function execution.`; `rg -c '(?i)QueryStream\|streamingExecute\|executeStreaming' src/Api src/Client` = 0 |
| 119 | `ShapeInstance` | MISSING (undeclared) | MISSING (declared) | none | `README.md` has: `OSDK's `ShapeInstance` and `LinkStatus``; `src/Shape/Shape.behavior.ts:470` has: `type ShapedRecord = Readonly<Record<string, unknown>>;` |
| 122 | `LinkStatus` | MISSING (undeclared) | MISSING (declared) | none | same README sentence; `rg -c '(?i)isLoading\|hasMore\|fetchMore' src/Shape` = 0 |

Row 7 in more words. The typed action handle is `Model.action({ apiName, parameters })`: a record of parameter
specs mapped to the struct codec `Arguments` with one heterogeneous map, no conditional type. The call sites
are `Client.applyAction(model)(args)` (returns nothing), `Client.applyActionWithEdits(model)(args)` (returns
`ActionEdits`) and `Client.validateAction(model)(args)` (returns `ActionValidation`); each also has a data-first
form. An application the platform reports invalid fails with `ActionRejected`, a case of `ClientError`.
**Shortfall:** no typed batch application (OSDK's `batchApplyAction`); see the gap list.

Row 79 in more words. The typed query handle is `Model.query({ apiName, version, parameters, output })` with
the codecs `Parameters` and `Output`; the call site is `Client.executeQuery(model)(parameters)`. A `set` is a
`HashSet`, an `entrySet` a `HashMap`, a union with `null` an `Option`. **Shortfall:** no value spec for four of
the 26 query tags (a by-name type reference, `void`, `null` on its own, `unsupported`); see the gap list.

### Totals per disposition, recomputed

| Disposition | Rows | Symbols | `@osdk/api` (211) | `unstable` (91) | `shapes-internal` (8) |
| --- | --- | --- | --- | --- | --- |
| ported | 54 | 173 | 135 | 33 | 5 |
| redesigned | 32 | 61 | 29 | 32 | 0 |
| subsumed | 25 | 43 | 28 | 13 | 2 |
| rejected | 10 | 13 | 9 | 3 | 1 |
| MISSING (declared) | 12 | 20 | 10 | 10 | 0 |
| MISSING (undeclared) | 0 | 0 | 0 | 0 | 0 |
| **Total** | **133** | **310** | **211** | **91** | **8** |

What moved: rows 7 and 79 (2 symbols of `@osdk/api`) from MISSING (undeclared) to redesigned; rows 35 and 40
(5 symbols of `@osdk/api`) and rows 102, 119 and 122 (3 symbols of `unstable`) from undeclared to declared,
because README section 7 now names each of them. The script that parses section 1 still finds 133 rows and
310 symbols.

- 290 of 310 symbols (94%) have a local home, up from 288.
- 30 of the non-MISSING rows (50 symbols) carry a shortfall, up from 28 rows (48 symbols): rows 7 and 79 join
  with the shortfalls above. Rows 6, 82 and 9 stay in the count with a smaller shortfall (next table).
- Nothing is missing that the README does not say is missing.

### Rows whose local target, reason or proof changed

| # | Symbol | What changed |
| --- | --- | --- |
| 1 | `ActionReturnTypeForOptions` | Still redesigned, now at two levels. At the port, as the row says. At the typed facade, what an applied action returns is chosen by the function that is called: `Client/Client.operations.ts` `applyAction`:183 (nothing), `applyActionWithEdits`:262 (`ActionEdits`), `validateAction`:331 (`ActionValidation`). Added proof: `test/Operations.test.ts` ("an action applied for its edits returns what the handler changed", "a request carries the encoded arguments and asks for edits only when edits are wanted"). |
| 6 | `ActionParam` | The shortfall "static argument types are not computed" is closed for five of the six members: the static type of an argument record is `typeof Model.action(...).Arguments.Type` (`Model/Model.action.ts` `argumentsOf`:852, `objectReference`:303, `interfaceObject`:414, `structOf`:641, `optionalParameter`:802 for `NullValueType`). **Shortfall (smaller):** an object-set argument is typed `ObjectSetArgument` whatever its object type; `Model.objectSetOf(target)`:391 keeps the target for conformance only (`test/Operations.test.ts:492`). An object reference is the primary key of its model, not an object instance, by design. |
| 9 | `ValidAggregationKeys` | The tables are read by a validator, `Aggregation/Aggregation.policy.ts` `checkAggregation`:591 (section 7). **Shortfall (smaller):** `Client.aggregate` does not call it and `Model` has no typed metric constructor. |
| 20 | `WhereClause` | The typed constructors now return `Model/Model.filter.ts` `TypedFilter`:384, the pair `{ owner, filter }`, and `Model/Model.set.ts` `where`:127 takes only a filter of the set's model. Combinators `and`:1288, `or`:1328, `not`:1362 in `Model.filter.ts`. Proof added: `staticGuarantees` in `test/Model.object.test.ts`. |
| 43, 110 | `MediaItemMetadata` family, `MediaTransformation` | The proofs cite `test/_wireConformance.scratch.test-d.ts`, a parallel reviewer's scratch file that no longer exists. Current proofs: `test/MediaMetadata.test.ts` ("MediaItemMetadata wire fixtures", one exact fixture for each of the 10 cases) and `test/MediaOperations.test.ts` ("MediaTransformation wire fixtures", one for each of the 18 cases). |
| 51 | `NullabilityAdherence` | `Model/Model.spec.ts` `required`:715 is accepted for the primary key only; a required spec on any other property or on a struct field is a compile error (REVIEW F3). The rest of the row holds. |
| 54, 66, 70 | `FetchPageResult` / `SingleOsdkResult`, `ObjectSet`, link accessors | The read facade takes the typed set whole: `Client.fetchPage(set, options)`, `fetchOne(set, options)`, `stream(set, options)` (`Client/Client.behavior.ts` :202, :373, :286; `aggregate`:533 and `count`:430 take the plain `set.objectSet`). The model that decodes a page is the model of the set (REVIEW F2). |
| 56 | `Result`, `isOk` | `Client/Client.errors.ts` `ClientError`:478 has a sixth case, `ActionRejected`:391. |
| 74 | `InterfaceDefinition` | Still MISSING (declared). The row's command now returns 3, because `Model.action.ts` and `Model.query.ts` export the value specs `interfaceObject`, `interfaceObjectOf` and `interfaceObjectSetOf` (references to interface objects in arguments, not a typed interface model). Corrected proof: `rg -c '^export const (interfaceModel\|interface)\b' src/Model` = 0. |
| 82 | `QueryParam`, `QueryResult` | The shortfall "static parameter and result types are not computed" is closed for the tags that have a value spec: the static types are `typeof Model.query(...).Parameters.Type` and `.Output.Type` (`Model/Model.query.ts` `inputsOf`:357, `setOf`:104, `mapOf`:172, `unionOf`:212, and the shared specs of `Model.action.ts`). **Shortfall (smaller):** four tags have no value spec (row 79). |
| 95, 96 | `AgentDefinition`, `AgentParam` | Unchanged: no typed agent model (`rg -ci agent src/Model` = 0). They were filed under gap G1; they are now the agent part of what is left of it. |
| 103 | by-RID fetches | Still subsumed. The call is now `Client.fetchPage({ model, objectSet: ObjectSet.objects(rids) }, options)`: the pair is written by hand (`test/Faux.test.ts:761-764`). README section 7 no longer says by-RID fetches are not built; it says there is no helper for them. |

Line numbers. Section 1 cites 443 exports by line. All 443 still resolve to an `export` of the named file (0
names are gone); 329 are at the cited line and 114 have moved, in 48 rows:

| # | Cited line is now |
| --- | --- |
| 1 | `Action/Action.model.ts` `ApplyActionResponse`:2759 is :2722, `ActionValidation`:2714 is :2677 |
| 2 | `Action/Action.model.ts` `ActionEdits`:2128 is :2091, `ObjectEdits`:2042 is :2005, `LargeScaleEdits`:2090 is :2053, `editedObjectTypes`:2232 is :2195 |
| 3 | `Action/Action.model.ts` `ActionValidation`:2714 is :2677, `ParameterEvaluation`:2662 is :2625, `EvaluatedConstraint`:2607 is :2570, `SubmissionCriterion`:2642 is :2605 |
| 4 | `Action/Action.model.ts` `ApplyActionOptions`:1727 is :1690 |
| 5 | `Action/Action.model.ts` `BatchApplyActionOptions`:1785 is :1748 |
| 6 | `Action/Action.model.ts` `ActionArguments`:1688 is :1651, `ArgumentValue`:1634 is :1597 |
| 8 | `Action/Action.model.ts` `ActionType`:1577 is :1540, `ActionParameter`:1274 is :1237, `ActionParameterType`:626 is :589, `ActionOperation`:1520 is :1483 |
| 9 | `Aggregation/Aggregation.policy.ts` `allowedMetrics`:73 is :83, `metricsFor`:117 is :127 |
| 10 | `Client/Client.model.ts` `AggregateObjectSetRequest`:563 is :556 |
| 12 | `Client/Client.model.ts` `AggregationResult`:657 is :650, `AggregatedGroup`:616 is :609 |
| 15 | `Filter/Filter.model.ts` `WithinDistance`:945 is :946, `WithinBoundingBox`:963 is :964, `WithinPolygon`:975 is :976, `IntersectsBoundingBox`:987 is :988, `IntersectsPolygon`:1001 is :1002, `CircularArea`:527 is :528 |
| 16 | `Filter/Filter.model.ts` `IntervalRule`:337 is :338 |
| 18 | `Filter/Filter.model.ts` `And`:1080 is :1081, `Or`:1122 is :1123, `Not`:1163 is :1164 |
| 20 | `Filter/Filter.model.ts` `ObjectFilter`:1340 is :1341; `Filter/Filter.policy.ts` `checkFilter`:839 is :807; `Model/Model.filter.ts` `eq`:481 is :545, `typedOperators`:339 is :348 |
| 21 | `Aggregation/Aggregation.policy.ts` `durationUnits`:236 is :246 |
| 22 | `Aggregation/Aggregation.policy.ts` `allowedGroupings`:164 is :174 |
| 23 | `Property/Property.behavior.ts` `valueCodec`:72 is :79, `fieldCodec`:126 is :133; `Model/Model.spec.ts` `PropertySpec`:72 is :79, `required`:405 is :715 |
| 24 | `Property/Property.behavior.ts` `valueCodec`:72 is :79 |
| 25 | `Property/Property.behavior.ts` `valueCodec`:72 is :79; `Value/Value.model.ts` `ScalarValue`:617 is :730, `LongValue`:230 is :255, `DecimalValue`:378 is :430, `DateValue`:435 is :512, `TimestampValue`:494 is :571 |
| 28 | `DataType/DataType.values.ts` `PropertyTypeKind`:106 is :121; `Property/Property.model.ts` `PropertyType`:315 is :330, `StructType`:246 is :261, `ArrayType`:123 is :138 |
| 29 | `DataType/DataType.values.ts` `PrimaryKeyKind`:399 is :535 |
| 30 | `Model/Model.spec.ts` `PropertySpec`:72 is :79, `array`:331 is :587, `required`:405 is :715 |
| 31 | `Model/Model.spec.ts` `PropertySpec`:72 is :79; `Property/Property.model.ts` `PropertyDefinition`:590 is :619 |
| 49 | `Client/Client.model.ts` `FetchOptions`:285 is :279, `LoadObjectsRequest`:387 is :381; `Property/Property.model.ts` `PropertyAtLoadLevel`:761 is :790 |
| 50 | `Client/Client.model.ts` `FetchOptions`:285 is :279 |
| 51 | `Model/Model.spec.ts` `required`:405 is :715 |
| 52 | `Model/Model.set.ts` `pick`:425 is :510 |
| 54 | `Client/Client.behavior.ts` `fetchPage`:166 is :202, `fetchOne`:360 is :373, `stream`:263 is :286 |
| 55 | `Page/Page.model.ts` `Page`:294 is :298 |
| 56 | `Client/Client.errors.ts` `ClientError`:421 is :478 |
| 58 | `Model/Model.object.ts` `object`:181 is :232 |
| 59 | `Model/Model.object.ts` `object`:181 is :232 |
| 61 | `Model/Model.object.ts` `object`:181 is :232, `ObjectModel`:295 is :352 |
| 63 | `Model/Model.object.ts` `object`:181 is :232 |
| 66 | `Model/Model.set.ts` `TypedObjectSet`:50 is :57; `Client/Client.behavior.ts` `fetchPage`:166 is :202, `fetchOne`:360 is :373, `stream`:263 is :286, `aggregate`:517 is :533 |
| 68 | `Model/Model.set.ts` `traverse`:268 is :291; `Model/Model.object.ts` `LinkSpec`:42 is :49 |
| 69 | `Link/Link.model.ts` `Link`:84 is :85, `LinkPage`:349 is :348, `LoadLinksRequest`:291 is :292 |
| 70 | `Model/Model.set.ts` `traverse`:268 is :291; `Client/Client.behavior.ts` `fetchOne`:360 is :373 |
| 71 | `Model/Model.object.ts` `object`:181 is :232, `ObjectModel`:295 is :352; `Model/Model.policy.ts` `conformance`:488 is :494 |
| 72 | `ObjectType/ObjectType.model.ts` `ObjectType`:1211 is :1221, `ObjectTypeDefinition`:1423 is :1437, `InterfaceImplementation`:1019 is :1025; `Property/Property.model.ts` `PropertyDefinition`:590 is :619 |
| 75 | `InterfaceType/InterfaceType.model.ts` `InterfaceType`:514 is :519 |
| 77 | `Model/Model.object.ts` `PropertyReference`:86 is :121; `Model/Model.filter.ts` `EquatableKind`:79 is :88, `OrderedKind`:123 is :132 |
| 83 | `DerivedProperty/DerivedProperty.model.ts` `DerivedProperty`:948 is :949, `SelectedPropertyOperation`:445 is :446 |
| 90 | `ValueFormat/ValueFormat.values.ts` `DatetimePreset`:427 is :430 |
| 91 | `ValueFormat/ValueFormat.values.ts` `KnownType`:476 is :480 |
| 103 | `Client/Client.behavior.ts` `fetchPage`:166 is :202, `fetchOne`:360 is :373 |
| 104 | `Link/Link.model.ts` `BulkLink`:410 is :409, `LoadLinksRequest`:291 is :292, `LinkPage`:349 is :348 |
| 105 | `Link/Link.model.ts` `LinkSubscribeRequest`:478 is :477, `LinkSubscribeRequests`:530 is :529, `LinkUpdate`:620 is :619, `LinkState`:571 is :570, `RefreshLinks`:660 is :659, `LinkStreamMessage`:712 is :711 |

Proofs. Section 1 cites a test file as proof 170 times. 168 of the cited files exist and still use the named
target outside their import lines; the other two are the scratch file of rows 43 and 110 above. The use
counts in brackets (`x13` and the like) were not recounted and have drifted with the tests the fix wave
added.

### What is missing, re-ranked

Same order of concern as section 4: how much an OSDK user would feel it. The original numbers are kept so the
two lists can be read together.

1. **G3. Interface-typed models and `$as`.** Open, declared. `InterfaceDefinition` (74), `ConvertProps` (62);
   shortfall in rows 76 and 61. `rg -c MultipleObjectTypes src` = 0 and
   `rg -c '^export const (interfaceModel|interface)\b' src/Model` = 0.
2. **G4. Live subscriptions.** Open, declared. Rows 66, 67, 105, 106. The protocol is schemas; "websocket"
   appears only in the documentation and schema descriptions of `Link.model.ts` and `Subscription.model.ts`.
3. **G5. Media reads, and attachment metadata by RID.** Open, now declared (README section 7, "Reading media
   and attachment metadata"). Rows 40, 37, 42. The port has 10 members and the API 10 routes; none touches
   media, and the attachment routes are upload and content only.
4. **G6. Time-series reads.** Open, declared. Row 87.
   `rg -c '(?i)timeseries|firstPoint|lastPoint|streamPoints' src/Api src/Client` = 0.
5. **G7. Aggregations and derived properties in the typed layer.** Narrowed. `AggregationsResults` (13) is
   still MISSING, declared; rows 12, 83 and 30 keep their shortfalls. The undeclared half closed:
   `Aggregation.checkAggregation` reads the tables (section 7). Left: `Client.aggregate` does not call it,
   `Faux` does not consult the tables, `Model` has no typed metric constructor
   (`rg -l 'allowedMetrics|allowedGroupings' src` lists the policy file only).
6. **G8. Instance conveniences.** Open, partly declared. Rows 61, 70, 89. Since stage F6 (2026-11-13, below) a
   typed instance is `{ locator, rid, title, score, properties, undeclared }`: it carries the ordinary
   `ObjectLocator`, so it can be handed to a link read or an action without being rebuilt. Still absent: a
   per-instance link accessor, `$clone`, typed property securities, a formatted value.
7. **G1 and G2, what is left of them.** Typed actions and typed queries are built (rows 7 and 79). Left, all
   declared in README section 7:
   - no typed batch application: the port has `applyActionBatch` (`src/Client/Client.service.ts:148`), no
     facade function takes a model and a list of argument records
     (`rg -ci batch src/Model src/Client/Client.operations.ts` = 0), and `Faux.layer` refuses the request
     (`src/Faux/Faux.layer.ts:305`);
   - no value spec for a by-name type reference (so no recursive query type), `void`, `null` on its own or
     `unsupported` (`rg '"typeReference"|"void"|"unsupported"' src/Model` finds nothing);
   - `actionConformance` and `queryConformance` compare a vector by tag, not dimension, and a union by tag,
     not alternatives (`vector: () => none`, `union: () => none` at `src/Model/Model.action.ts:1240`, `:1280`
     and `src/Model/Model.query.ts:648`, `:649`);
   - an object-set argument is not typed by its object type (row 6);
   - agents have no typed model (rows 95, 96).
8. **G9. Media transformation flow and its errors.** Open, declared. Rows 107, 109.
   `rg -c 'TaggedError|extends Error' src/Media` = 0.
9. **G10. Shapes: typed results, link loading, source-key placeholder.** Open, now declared in full. Rows 119,
   122, 124; shortfalls in 117 and 120.
10. **G11. Streaming function execution.** Open, now declared. Row 102.
11. **G12. Cipher text.** Open, now declared. Rows 35, 33, 32. `rg -ci decrypt src/Api src/Client` = 0.
12. **G13. Agent polling.** Open, declared. Rows 97, 99, 100. The two timeout errors are still raised by
    nothing (`rg -l 'AgentStateTimeout|AgentEventTimeout' src` lists `Agent.behavior.ts` only).

The minor shortfalls of section 4 are unchanged: no create / update value tables (row 24), `userAgent` dropped
(row 78; `rg -ci 'user-?agent' src/Api src/Client` = 0), bulk links one page per call (row 104).

### Section 5, "README claims the ledger contradicts"

Every claim listed there is settled. The two false sentences of README section 7 are gone. Its silent
absences are either built (typed actions and queries) or listed (media and attachment-metadata reads, cipher
text, streaming execution, typed shape results and link state, aggregation checks, the transformation job's
error classes, the six unmodelled wire unions). The naming-ledger row on `AGG_FOR_TYPE` names the validator
that reads the tables. The "Replaces" column of README section 3 claims the runtime half for `Aggregation`,
`Action`, `Query` and `Subscription` / `Link`, and names `Model.action` and `Model.query` as the static half.
README section 8 reports 37 test files and 4,211 tests, measured with no scratch file in `test/`.

### The reference moved

The ledger is of `@osdk/api` 2.88.0 at commit `f0ed727d6c`: 12,291 lines in 111 source files, tests left out.
The local checkout of `osdk-ts` is now at `2e21feeca3` (2.89.0), whose only change under `packages/api/src`
is one new type-only export of `@osdk/api/unstable`, the namespace `AgentResult` (two aliases that type the
objects and object sets an agent's state returns). It is not one of the 310 and has no row. By the rules of
section 0 it would sit with row 96: there is no typed agent result here.

### Second fix wave, stage F6 (2026-11-13): rows that name a symbol the stage changed

Stages F4 and F5 of the second fix wave did not touch this file. Stage F6 made the instance codec one function
and the rows of a page wire records (REVIEW F6), and wrote this subsection from the code as it then stood. No
disposition changed and the totals above stand: 310 symbols, 20 MISSING, all declared. Six rows of section 1
say something about an instance or a read that is no longer the whole truth; the current statement is here,
under the same row number.

| # | Symbol | What changed |
| --- | --- | --- |
| 52 | `SelectArgToKeys` | Still subsumed by `Model/Model.set.ts` `pick`:517. The `Instance` of a narrowed model types the selected keys and the key. What a row holds beyond them is no longer dropped: it is kept as JSON in `undeclared` and written back. Proof: `test/Model.object.test.ts` ("picks a model that decodes and types only the picked properties and the primary key"). |
| 54 | `FetchPageResult`, `SingleOsdkResult` | Still subsumed by inference. The result is a page of whatever the set's row codec decodes to: `Client/Client.behavior.ts` `fetchPage`:277, `fetchOne`:440 and `stream`:356 are generic in that decoded type (`InstanceSet`:101), and `untyped`:174 gives the same three reads an `OntologyObject` per row. A row is decoded once (`test/Client.test.ts`, "every read decodes each row exactly once, with the codec the set carries"). |
| 58 | `OsdkBase` | Still ported. Identity is an `ObjectLocator` in every decoded shape: `Object/Object.model.ts` `OntologyObject`:564 and now a model's `Instance` too, which is `{ locator, rid, title, score, properties, undeclared }` where it had `objectType` and no locator (`Model/Model.object.ts` `object`:249). The flat record is named: `Object/Object.model.ts` `ObjectRecord`:466. |
| 61 | `Osdk` | Still redesigned, with the same shortfall. `Osdk.Instance<Q, OPTIONS, P, R>` is `typeof Model.Instance.Type`, and that codec is `Object/Object.behavior.ts` `InstanceOf`:191 applied to the struct of the model's specs; `instanceCodec`:437 is the same function for a served definition, so the typed and the dynamic instance are one shape with one set of checks (`Model/Model.object.ts` `ObjectModel`:310). Proof added: `test/Model.object.test.ts` ("one instance codec for both tiers"), `test/Object.test.ts` ("InstanceOf"); doctest on `InstanceOf`. |
| 63 | `MaybeScore` | Unchanged in substance: `score: Option<number>` is a field of every instance. It is now stated once, in `InstanceOf`, for both tiers. |
| 103 | by-RID fetches | Still subsumed, and in two ways: `Client.fetchPage({ model, objectSet: ObjectSet.objects(rids) }, options)` for typed instances, as before, and `Client.fetchPage(Client.untyped(ObjectSet.objects(rids)), options)` for `OntologyObject`s when there is no model. |

New exports of the stage, none of them the first home of an `@osdk/api` symbol: `Object/Object.model.ts`
`ObjectRecord`:466; `Object/Object.behavior.ts` `PropertyCodec`:61, `InstanceShape`:76,
`InstanceOf`:191; `Client/Client.model.ts` `LoadObjectsResponseOf`:502; `Client/Client.behavior.ts`
`untyped`:174. `Client/Client.errors.ts` `ObjectNotFound`:321 and `MultipleObjectsFound`:366 (row 56)
carry `objectType` as an `Option`, none for a read of an untyped set.

Line numbers. Section 1 cites 48 exports of the twelve files the stage edited. All 48 still resolve to an
`export` of the named file, and 48 of them have moved since section 1 was written. Where the table of
2026-11-12 above gives a line for the same export, this one supersedes it. The exports of files that stages F4
and F5 edited and F6 did not (`Value.model.ts`, `Property.behavior.ts`, `Filter.*`, `Action.behavior.ts`,
`Query.behavior.ts`, `Agent.behavior.ts`, `Model.filter.ts`, `Model.action.ts`, `Model.query.ts`,
`Model.policy.ts`, `Identifier.model.ts`, `DataType.values.ts`) were not re-resolved.

| # | Cited line is now |
| --- | --- |
| 1 | `Client/Client.service.ts` `OntologyTransport`:107 is :113 |
| 10 | `Client/Client.model.ts` `AggregateObjectSetRequest`:563 is :603 |
| 12 | `Client/Client.model.ts` `AggregationResult`:657 is :697, `AggregatedGroup`:616 is :656 |
| 23 | `Model/Model.spec.ts` `PropertySpec`:72 is :212, `required`:405 is :878 |
| 30 | `Model/Model.spec.ts` `PropertySpec`:72 is :212, `array`:331 is :740, `required`:405 is :878 |
| 31 | `Model/Model.spec.ts` `PropertySpec`:72 is :212 |
| 37 | `Client/Client.service.ts` `OntologyTransport`:107 is :113 |
| 49 | `Client/Client.model.ts` `FetchOptions`:285 is :237, `LoadObjectsRequest`:387 is :339 |
| 50 | `Client/Client.model.ts` `FetchOptions`:285 is :237 |
| 51 | `Model/Model.spec.ts` `required`:405 is :878 |
| 52 | `Model/Model.set.ts` `pick`:425 is :517 |
| 54 | `Client/Client.behavior.ts` `fetchPage`:166 is :277, `fetchOne`:360 is :440, `stream`:263 is :356 |
| 56 | `Client/Client.errors.ts` `ClientError`:421 is :507 |
| 57 | `Object/Object.model.ts` `ObjectLocator`:302 is :296 |
| 58 | `Object/Object.model.ts` `OntologyObject`:523 is :564, `ObjectLocator`:302 is :296; `Model/Model.object.ts` `object`:181 is :249 |
| 59 | `Object/Object.model.ts` `PrimaryKeyValue`:92 is :86; `Model/Model.object.ts` `object`:181 is :249 |
| 60 | `Object/Object.model.ts` `ObjectLocator`:302 is :296 |
| 61 | `Model/Model.object.ts` `object`:181 is :249, `ObjectModel`:295 is :310; `Object/Object.behavior.ts` `instanceCodec`:160 is :437 |
| 63 | `Model/Model.object.ts` `object`:181 is :249 |
| 64 | `Object/Object.model.ts` `ObjectSpecifier`:340 is :334 |
| 66 | `Model/Model.set.ts` `TypedObjectSet`:50 is :58; `Client/Client.behavior.ts` `fetchPage`:166 is :277, `fetchOne`:360 is :440, `stream`:263 is :356, `aggregate`:517 is :595 |
| 68 | `Model/Model.set.ts` `traverse`:268 is :292; `Model/Model.object.ts` `LinkSpec`:42 is :52 |
| 70 | `Model/Model.set.ts` `traverse`:268 is :292; `Client/Client.behavior.ts` `fetchOne`:360 is :440 |
| 71 | `Model/Model.object.ts` `object`:181 is :249, `ObjectModel`:295 is :310 |
| 77 | `Model/Model.object.ts` `PropertyReference`:86 is :124 |
| 78 | `Client/Client.model.ts` `OntologyScope`:131 is :89 |
| 103 | `Client/Client.behavior.ts` `fetchPage`:166 is :277, `fetchOne`:360 is :440 |
| 104 | `Client/Client.service.ts` `OntologyTransport`:107 is :113 |

Package state after the stage: the type-check prints nothing, and the unit suite, the doctests and the four
law gates pass; the numbers are in `REVIEW.md` ("Package state after the F6 stage") and README section 8.

### Package state when this section was written

```text
$ ./node_modules/.bin/tsrs -p scratchpad/osdk/tsconfig.json --noEmit --pretty false
(no output)

$ bunx --bun vitest run --config osdk/vitest.config.ts
 Test Files  37 passed (37)
      Tests  4211 passed (4211)

$ BEEP_VITEST_DOCTEST=1 bunx --bun vitest run --config osdk/vitest.config.ts
 Test Files  74 passed (74)
      Tests  740 passed (740)
```

---

Lens: completeness. One disposition for each of the 310 public symbols of `@osdk/api` (entries `@osdk/api` 211,
`@osdk/api/unstable` 91, `@osdk/api/shapes-internal` 8), taken from `osdk-maps/00-api-export-census.md`, then the
wire-only families, then totals, the ranked gap list and the README claims the ledger contradicts.

**(superseded 2026-11-12: the status section above has the current result.)** Result in one paragraph: of 310 symbols, 173 are ported, 59 redesigned, 43 subsumed,
13 rejected and 22 MISSING (12 that README section 7 or a source comment admits,
10 that nothing admits). The data side of the port is complete: every wire union the package claims has the
wire's member count (section 2). The gaps are all on the typed and operational side: actions and queries have no
typed call site and no facade, media and time series cannot be read, and several static projections that OSDK
computes are runtime-only here (`S.Codec<unknown, unknown>`).

## 0. Method and legend

- A row covers one symbol, or a family of sibling symbols that share one disposition; the count is in brackets and
  the counts add up to 310 (checked by script, each symbol exactly once).
- Local target: `file` then `export`:line. Every target was resolved against the `export` statements of that file;
  a name that did not resolve was removed, not kept.
- Proof: the test file that imports the target from its concept and uses it (import lines excluded; the count is
  uses of the most-used target), a doctest in the target's own JSDoc, or, for an absence, the `rg -c` command that
  returns 0 (run from the package root) and the line of README or source that states it.
  In the raw file a `|` inside a table cell is written `\|`; drop the backslash to run the command.
- Dispositions: **ported** (recognisable local equivalent); **redesigned** (capability kept through a different
  model); **subsumed** (a broader local primitive, a schema projection, or Effect itself provides it); **rejected**
  (deliberately omitted); **MISSING** (the capability the symbol exists for has no local home). MISSING is split
  into *declared* (README section 7 or a source comment says it is not built, without saying why it is not needed)
  and *undeclared* (nothing says so).
- A type-plumbing helper is marked subsumed when a projection produces the same thing. Where that projection is
  typed `unknown`, the row says "runtime only" and the static half is counted once, at the symbol that owns the
  capability (`ActionDefinition`, `QueryDefinition`, `AggregationsResults`, `ShapeInstance`).
- "Shortfall" marks a row that is not MISSING but delivers less than the OSDK symbol did. Shortfalls are listed
  again in section 4.

## 1. The ledger

### `@osdk/api`: actions (8 symbols)

| # | Symbol or family | Subsystem | Disposition | Local target | Reason | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `ActionReturnTypeForOptions` | actions | redesigned | `Client/Client.service.ts` `OntologyTransport`:107; `Action/Action.model.ts` `ApplyActionResponse`:2759, `ActionValidation`:2714 | No type depends on an option value. Validate-only is its own transport member (`validateAction` returns `ActionValidation`); `applyAction` returns `ApplyActionResponse` whose `validation` and `edits` are `Option`s. | `test/Action.test.ts` (2 of 3 targets used; `ActionValidation` x10); `test/Faux.test.ts` (1 of 3 targets used; `OntologyTransport` x5); doctest on 3 of 3 targets |
| 2 | `ActionEditResponse` | actions, results | ported | `Action/Action.model.ts` `ActionEdits`:2128, `ObjectEdits`:2042, `LargeScaleEdits`:2090, `editedObjectTypes`:2232 | Same two-case union on `type` (`edits` / `largeScaleEdits`); `editedObjectTypes` is a total function over both cases instead of an intersection field. | `test/Action.test.ts` (4 of 4 targets used; `ActionEdits` x12); doctest on 2 of 4 targets |
| 3 | `ActionValidationResponse` | actions, results | ported | `Action/Action.model.ts` `ActionValidation`:2714, `ParameterEvaluation`:2662, `EvaluatedConstraint`:2607, `SubmissionCriterion`:2642 | Wire `ValidateActionResponseV2`; the evaluated-constraint union has the wire's 11 cases (OSDK's copy has 9). | `test/Action.test.ts` (4 of 4 targets used; `EvaluatedConstraint` x23); doctest on 2 of 4 targets |
| 4 | `ApplyActionOptions` | actions | redesigned | `Action/Action.model.ts` `ApplyActionOptions`:1727; `Action/Action.values.ts` `ApplyActionMode`:680, `ReturnEditsMode`:721 | Two mutually exclusive booleans become `mode` and `returnEdits` enums with documented defaults. | `test/Action.test.ts` (3 of 3 targets used; `ApplyActionOptions` x9); doctest on 3 of 3 targets |
| 5 | `ApplyBatchActionOptions` | actions | ported | `Action/Action.model.ts` `BatchApplyActionOptions`:1785; `Action/Action.values.ts` `BatchReturnEditsMode`:761 | Batch options carry `returnEdits` only, as in OSDK. | `test/Action.test.ts` (2 of 2 targets used; `BatchReturnEditsMode` x8); doctest on 1 of 2 targets |
| 6 | `ActionParam` | actions | subsumed | `Action/Action.behavior.ts` `argumentCodec`:166, `argumentsCodec`:253; `Action/Action.model.ts` `ActionArguments`:1688, `ArgumentValue`:1634; `ObjectSet/ObjectSet.model.ts` `ObjectSetArgument`:904 | **(superseded 2026-11-12 in its last two sentences: the static types are computed by `Model.action`)** Namespace of 6 members. Subsumed by the projection `Action.argumentCodec(parameterType)`; `NullValueType` is `Option.none()` in `ActionArguments`. Runtime only: both projections return `S.Codec<unknown, unknown>` / `Codec<Record<string, unknown>>`, so no accepted-input TYPE is computed. **Shortfall:** static argument types are not computed (see gap G1). | `test/Arguments.test.ts` (2 of 5 targets used; `argumentCodec` x13); `test/Action.test.ts` (2 of 5 targets used; `ActionArguments` x11); doctest on 5 of 5 targets |
| 7 | `ActionDefinition` | metamodel, actions | **(superseded 2026-11-12)** **MISSING** (undeclared) | **(superseded 2026-11-12)** none | **(superseded 2026-11-12)** The typed action handle (phantom `signatures`). Nothing plays `Model.object`'s role for actions: no `Model.action`, no `Client.applyAction` facade, and `argumentsCodec` is `Codec<Readonly<Record<string, unknown>>>`. The untyped identity half exists (`Identifier.ActionTypeApiName`). README section 7 does not list it. | **(superseded 2026-11-12)** absent: `rg -c '^export (const\|function) (action\|applyAction\|validateAction)\b' src/Model src/Client/Client.behavior.ts` = 0; `src/Action/Action.behavior.ts` has: `}: Pick<ActionType, "parameters">): S.Codec<Readonly<Record<string,...` |
| 8 | `ActionMetadata` | metamodel, actions | ported | `Action/Action.model.ts` `ActionType`:1577, `ActionParameter`:1274, `ActionParameterType`:626, `ActionOperation`:1520 | Wire `ActionTypeV2`. `Parameter` and `DataType.*` are `ActionParameter` and the 22-case `ActionParameterType`; `modifiedEntities` is derivable from the 9-case `ActionOperation` list; `nullable` is the wire's `required`. | `test/Action.test.ts` (4 of 4 targets used; `ActionParameterType` x53); `test/Arguments.test.ts` (2 of 4 targets used; `ActionType` x7); doctest on 4 of 4 targets |

### `@osdk/api`: aggregate/where/groupby (21 symbols)

| # | Symbol or family | Subsystem | Disposition | Local target | Reason | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 9 | `ValidAggregationKeys` | aggregate | subsumed | `Aggregation/Aggregation.model.ts` `MetricKey`:1118; `Aggregation/Aggregation.behavior.ts` `MetricKeyFromName`:128; `Aggregation/Aggregation.policy.ts` `allowedMetrics`:73, `metricsFor`:117 | **(superseded 2026-11-12 from "The table is data only" on: `checkAggregation` reads the tables)** The `prop:metric` key generator is the `MetricKey` structure plus the table `allowedMetrics`. The table is data only: no function in `src` reads it outside its own file, and no typed metric constructor exists in `Model`, so a metric that the property's tag does not allow is neither a type error nor a finding. **Shortfall:** `allowedMetrics` / `allowedGroupings` are read by no validator or builder (see gap G7). | `test/Aggregation.test.ts` (4 of 4 targets used; `MetricKeyFromName` x15); doctest on 4 of 4 targets |
| 10 | `AggregateOpts` | aggregate | ported | `Aggregation/Aggregation.model.ts` `AggregateRequest`:941; `Client/Client.model.ts` `AggregateObjectSetRequest`:563; `Aggregation/Aggregation.behavior.ts` `sum`:402, `count`:382, `exact`:638 | `$select` is a list of `Aggregation` values, `$groupBy` a list of `GroupBy` values; constructors replace the keyed record. | `test/Aggregation.test.ts` (4 of 5 targets used; `count` x55); `test/Faux.test.ts` (3 of 5 targets used; `sum` x11); doctest on 5 of 5 targets |
| 11 | `AggregateOptsThatErrorsAndDisallowsOrderingWithMultipleGroupBy` | aggregate | redesigned | `Aggregation/Aggregation.model.ts` `AggregationOrderingChecks`:879 | Type-level error strings become two annotated runtime checks on the request schema. | `test/Aggregation.test.ts` (1 of 1 targets used; `AggregationOrderingChecks` x1); doctest on 1 of 1 targets |
| 12 | `AggregationResultsWithGroups`, `AggregationResultsWithoutGroups` [2] | aggregate, results | redesigned | `Client/Client.model.ts` `AggregationResult`:657, `AggregatedGroup`:616; `Aggregation/Aggregation.model.ts` `MetricLookup`:1167; `Aggregation/Aggregation.behavior.ts` `regroupMetrics`:268, `ungroupedRow`:348, `metricValue`:308 | Rows are `AggregatedGroup { group, metrics }` keyed by `MetricKey`; grouped and ungrouped answers share one shape. Untyped: `group` is `Record<GroupKey, Json>`. **Shortfall:** group values and metric values are not typed from the request (declared, README section 7). | `test/Aggregation.test.ts` (4 of 6 targets used; `metricValue` x8); `test/Client.test.ts` (2 of 6 targets used; `AggregationResult` x2); doctest on 5 of 6 targets |
| 13 | `AggregationsResults` | aggregate, results | **MISSING** (declared) | none | The dispatcher that computes a result type from the request. README section 7 declares it: "Typed aggregation results ... no result type is computed from the request". | `README.md` has: `Typed aggregation results.` |
| 14 | `AggregationClause` | aggregate | ported | `Aggregation/Aggregation.model.ts` `Aggregation`:523, `OrderDirection`:69; `Aggregation/Aggregation.behavior.ts` `ordered`:590 | 8-case union on `type`; ordering is the `direction` field set by `ordered`. | `test/Aggregation.test.ts` (3 of 3 targets used; `Aggregation` x48); `test/Client.test.ts` (1 of 3 targets used; `ordered` x2); doctest on 3 of 3 targets |
| 15 | `GeoFilterOptions`, `GeoFilter_Within`, `GeoFilter_Intersects` [3] | where, geo | redesigned | `Filter/Filter.model.ts` `WithinDistance`:945, `WithinBoundingBox`:963, `WithinPolygon`:975, `IntersectsBoundingBox`:987, `IntersectsPolygon`:1001, `CircularArea`:527; `Filter/Filter.behavior.ts` `withinDistance`:519, `intersectsPolygon`:598 | The `$within` / `$intersects` bags with five alternative payloads become one filter case per payload (the wire's own cases), plus the wire's `doesNotIntersect*` and `geoShapeV2` cases OSDK has no key for. | `test/Filter.test.ts` (8 of 8 targets used; `CircularArea` x9); `test/Model.object.test.ts` (3 of 8 targets used; `withinDistance` x2); doctest on 3 of 8 targets |
| 16 | `IntervalRule` | where | ported | `Filter/Filter.model.ts` `IntervalRule`:337; `Filter/Filter.behavior.ts` `matchesInterval`:459 | 5-case recursive union (`match`, `prefixOnLastToken`, `allOf`, `anyOf`, `fuzzy`). | `test/Filter.test.ts` (2 of 2 targets used; `IntervalRule` x23); `test/Model.object.test.ts` (1 of 2 targets used; `matchesInterval` x1); doctest on 2 of 2 targets |
| 17 | `DistanceUnitMapping` | geo | rejected | `Geo/Geo.model.ts` `DistanceUnit`:905, `Distance`:948 | Runtime alias table (20 aliases to 8 units). README section 7 rejects input sugar: "unit alias tables ... Constructors replace them". `DistanceUnit` has the wire's 9 units. | `test/Geo.test.ts` (2 of 2 targets used; `Distance` x25); `test/Faux.test.ts` (1 of 2 targets used; `Distance` x2); doctest on 2 of 2 targets |
| 18 | `AndWhereClause`, `OrWhereClause`, `NotWhereClause` [3] | where | ported | `Filter/Filter.model.ts` `And`:1080, `Or`:1122, `Not`:1163; `Filter/Filter.behavior.ts` `and`:736, `or`:767, `not`:792 | Tagged cases `and`, `or`, `not`. | `test/Filter.test.ts` (6 of 6 targets used; `and` x59); `test/Faux.test.ts` (1 of 6 targets used; `not` x3); doctest on 3 of 6 targets |
| 19 | `PossibleWhereClauseFilters` | where | ported | `Filter/Filter.policy.ts` `FilterOperator`:78, `PropertyOperator`:109 | Literal domain of operators: the kit of the filter union's 28 tags (OSDK's 17 keys plus the wire-only ones). | `test/Filter.test.ts` (2 of 2 targets used; `FilterOperator` x5); `test/Model.object.test.ts` (1 of 2 targets used; `PropertyOperator` x2); doctest on 2 of 2 targets |
| 20 | `WhereClause` | where | redesigned | `Filter/Filter.model.ts` `ObjectFilter`:1340; `Filter/Filter.behavior.ts` `foldFilter`:840; `Filter/Filter.policy.ts` `checkFilter`:839, `allowedOperators`:363; `Model/Model.filter.ts` `eq`:481, `typedOperators`:339 | The `$`-keyed recursive bag becomes the wire's 28-case tagged tree. Per-property operator typing (`FilterFor<PD>`) is parameter types over tag families in `Model.filter` and the data table `allowedOperators`, applied at runtime by `checkFilter`. `$title` / `$primaryKey` are `PropertySelector` cases. | `test/Filter.test.ts` (4 of 6 targets used; `ObjectFilter` x71); `test/Model.object.test.ts` (4 of 6 targets used; `eq` x12); doctest on 6 of 6 targets |
| 21 | `DurationMapping` | groupby | rejected | `Aggregation/Aggregation.policy.ts` `durationUnits`:236; `TimeSeries/TimeSeries.model.ts` `TimeUnit`:162 | Runtime alias table (22 aliases). Rejected as input sugar (README section 7); `durationUnits` keeps the per-tag unit rule as data. | `test/TimeSeries.test.ts` (1 of 2 targets used; `TimeUnit` x10); `test/Aggregation.test.ts` (2 of 2 targets used; `durationUnits` x5); doctest on 2 of 2 targets |
| 22 | `AllGroupByValues`, `GroupByClause`, `GroupByRange` [3] | groupby | ported | `Aggregation/Aggregation.model.ts` `GroupBy`:806, `ExactGrouping`:662, `FixedWidthGrouping`:691, `RangesGrouping`:711, `DurationGrouping`:757, `AggregationRange`:575; `Aggregation/Aggregation.policy.ts` `allowedGroupings`:164 | 4-case union on `type` (`exact`, `fixedWidth`, `ranges`, `duration`); a range is `AggregationRange`; `allowedGroupings` holds the per-tag table (`GroupByMapper`). | `test/Aggregation.test.ts` (7 of 7 targets used; `GroupBy` x46); `test/Faux.test.ts` (1 of 7 targets used; `AggregationRange` x3); doctest on 3 of 7 targets |

### `@osdk/api`: values (22 symbols)

| # | Symbol or family | Subsystem | Disposition | Local target | Reason | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 23 | `OsdkObjectPropertyType` | values | subsumed | `Property/Property.behavior.ts` `valueCodec`:72, `fieldCodec`:126; `Model/Model.spec.ts` `PropertySpec`:72, `required`:405 | Subsumed by the projection `Property.valueCodec(type)`; the nullable and array wrappers are `Option` (`fieldCodec`) and the `array` case. Static type: the `Type` side of a `PropertySpec`'s codec. | `test/Property.test.ts` (2 of 4 targets used; `valueCodec` x29); `test/Model.test.ts` (4 of 4 targets used; `valueCodec` x13); doctest on 2 of 4 targets |
| 24 | `OsdkObjectCreatePropertyType`, `OsdkObjectUpdatePropertyType`, `OsdkObjectCreateWirePropertyType`, `OsdkObjectUpdateWirePropertyType` [4] | values | subsumed | `Property/Property.behavior.ts` `valueCodec`:72 | The four write-side wrappers (used by `@osdk/functions` edits). Subsumed by the encode side of the one bidirectional `valueCodec`. No distinct create / update input table exists: the write-only alternatives (plaintext for cipher text, an upload for an attachment) are separate schemas that no create codec folds in. **Shortfall:** no create / update value table; object writes go through actions only. | `test/Property.test.ts` (1 of 1 targets used; `valueCodec` x29); `test/Model.test.ts` (1 of 1 targets used; `valueCodec` x13); doctest on 1 of 1 targets |
| 25 | `PropertyValueWireToClient` | values, property-types | redesigned | `Property/Property.behavior.ts` `valueCodec`:72; `Value/Value.model.ts` `ScalarValue`:617, `LongValue`:230, `DecimalValue`:378, `DateValue`:435, `TimestampValue`:494 | The 22-row type table is one exhaustive match over `PropertyType`; rows are codecs, so `long` is `bigint`, `decimal` is `BigDecimal`, `date` is `LocalDate`. | `test/Value.test.ts` (5 of 6 targets used; `DecimalValue` x44); `test/Property.test.ts` (1 of 6 targets used; `valueCodec` x29); doctest on 5 of 6 targets |
| 26 | `DataValueWireToClient`, `DataValueClientToWire` [2] | values | redesigned | `Action/Action.behavior.ts` `argumentCodec`:166, `fieldValueCodec`:99; `Query/Query.behavior.ts` `valueCodec`:329 | The two 25-row tables (returned / accepted) are one codec per data type, read in both directions. | `test/Arguments.test.ts` (3 of 3 targets used; `valueCodec` x17); doctest on 3 of 3 targets |
| 27 | `AllowedBucketTypes`, `AllowedBucketKeyTypes` [2] | queries, aggregate | ported | `Query/Query.model.ts` `QueryAggregationKey`:1161, `QueryRange`:1113, `QueryAggregationKeyType`:204 | Bucket keys are `QueryAggregationKey` (a scalar or a `QueryRange`). | `test/Query.test.ts` (3 of 3 targets used; `QueryAggregationKeyType` x29); doctest on 3 of 3 targets |
| 28 | `BaseWirePropertyTypes`, `WirePropertyTypes` [2] | property-types | ported | `DataType/DataType.values.ts` `PropertyTypeKind`:106; `Property/Property.model.ts` `PropertyType`:315, `StructType`:246, `ArrayType`:123 | 22 tags, the wire's own: the three OSDK time-series tags are one `timeseries` case with an item type, `datetime` is `date`, and `struct` / `array` are cases, not a record shape and a flag. | `test/Property.test.ts` (4 of 4 targets used; `PropertyType` x93); `test/Model.test.ts` (4 of 4 targets used; `PropertyTypeKind` x11); doctest on 1 of 4 targets |
| 29 | `PrimaryKeyTypes` | property-types | ported | `DataType/DataType.values.ts` `PrimaryKeyKind`:399 | Pick of 9 tags (OSDK lists 8; `boolean` is added, matching the wire's `PrimaryKeyValueV2`). | `test/DataType.test.ts` (1 of 1 targets used; `PrimaryKeyKind` x9); `test/ObjectType.test.ts` (1 of 1 targets used; `PrimaryKeyKind` x3) |
| 30 | `SimplePropertyDef` | property-types, derived-properties | subsumed | `Model/Model.spec.ts` `PropertySpec`:72, `array`:331, `required`:405 | Type + 8 helper members. A `PropertySpec` pairs a tag with its codec; `Make` / `Extract*` / `ToRuntimeProperty` are the spec's fields and its codec's `Type`. Its second use, typing derived-property results, has no local counterpart (declared, README section 7). **Shortfall:** derived-property result typing absent (declared). | `test/Model.test.ts` (3 of 3 targets used; `array` x11); `test/Model.object.test.ts` (2 of 3 targets used; `required` x4); doctest on 1 of 3 targets |
| 31 | `PropertyDef` | property-types | subsumed | `Model/Model.spec.ts` `PropertySpec`:72; `Property/Property.model.ts` `PropertyDefinition`:590 | `ObjectMetadata.Property` narrowed by five literal parameters; the spec's generics carry tag, value codec and requiredness. | `test/Property.test.ts` (1 of 2 targets used; `PropertyDefinition` x36); `test/ObjectType.test.ts` (1 of 2 targets used; `PropertyDefinition` x9); doctest on 1 of 2 targets |
| 32 | `CipherChannelStrategy` | values | ported | `CipherText/CipherText.model.ts` `CipherChannelStrategy`:81 | 4-literal mapped kit. Referenced by no other schema in `src`. **Shortfall:** the kit is used by nothing (see `UpdateCipherText`). | `test/References.test.ts` (1 of 1 targets used; `CipherChannelStrategy` x7); doctest on 1 of 1 targets |
| 33 | `CipherText` | values | redesigned | `CipherText/CipherText.model.ts` `CipherText`:142, `DecryptionResult`:294, `Plaintext`:199 | The read handle becomes the parsed envelope `{ channel, ciphertext }`. `decrypt()` is not runnable: `DecryptionResult` exists as a schema, but `OntologyTransport` has no decrypt member and `OntologyApi` no route. **Shortfall:** `decrypt()` has no transport member or route (see gap G12). | `test/References.test.ts` (3 of 3 targets used; `CipherText` x21); `test/Arguments.test.ts` (1 of 3 targets used; `CipherText` x1); doctest on 3 of 3 targets; absent: `rg -c '(?i)decrypt' src/Api src/Client` = 0 |
| 34 | `CreateCipherText`, `CipherTextValue` [2] | values | ported | `CipherText/CipherText.model.ts` `EncryptionRequest`:232, `EncryptionResult`:259, `Plaintext`:199 | `{plaintext}` is `EncryptionRequest` with a `Redacted` plaintext; `{ciphertext}` is `EncryptionResult` / `CipherText`. | `test/References.test.ts` (3 of 3 targets used; `EncryptionResult` x7); doctest on 3 of 3 targets |
| 35 | `UpdateCipherText` | values | **(superseded 2026-11-12)** **MISSING** (undeclared) | none | **(superseded 2026-11-12 in its last sentence: README section 7 now states the absence)** `{plaintext; strategy?}`. No schema pairs a plaintext with a `CipherChannelStrategy`: `EncryptionRequest` has `plaintext` only. Not stated anywhere. | absent: `rg -c 'CipherChannelStrategy' src --glob !src/CipherText/CipherText.model.ts` = 0 |
| 36 | `PropertySecurity`, `PropertyMarkings` [2] | values | ported | `Security/Security.model.ts` `PropertySecurity`:237, `PropertyMarkings`:131, `PropertySecurities`:282, `SecuredValue`:348 | 3-case union on `type` and the four marking lists. | `test/References.test.ts` (4 of 4 targets used; `PropertyMarkings` x27); doctest on 4 of 4 targets |

### `@osdk/api`: attachment/media (59 symbols)

| # | Symbol or family | Subsystem | Disposition | Local target | Reason | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 37 | `Attachment` | attachment | redesigned | `Attachment/Attachment.model.ts` `AttachmentReference`:163; `Client/Client.service.ts` `OntologyTransport`:107 | The handle becomes the value `AttachmentReference` plus `OntologyTransport.readAttachment(rid)`. `fetchMetadata()` has no counterpart: metadata comes back from `uploadAttachment` only, and no member or route reads it by RID. **Shortfall:** attachment metadata by RID cannot be read (see gap G5). | `test/References.test.ts` (1 of 2 targets used; `AttachmentReference` x11); `test/Faux.test.ts` (1 of 2 targets used; `OntologyTransport` x5); doctest on 2 of 2 targets; absent: `rg -c 'attachments/:attachmentRid\"' src/Api/Api.definition.ts` = 0 |
| 38 | `AttachmentMetadata` | attachment | ported | `Attachment/Attachment.model.ts` `AttachmentMetadata`:198, `SizeBytes`:109 | `sizeBytes` is a `bigint`. | `test/References.test.ts` (2 of 2 targets used; `SizeBytes` x13); `test/MediaTransformation.test.ts` (1 of 2 targets used; `SizeBytes` x5); doctest on 2 of 2 targets |
| 39 | `AttachmentUpload` | attachment | ported | `Attachment/Attachment.model.ts` `AttachmentUpload`:232 | The `filename` of an upload; the bytes are a separate argument of `uploadAttachment` (OSDK pairs `name` with a `Blob`). | `test/References.test.ts` (1 of 1 targets used; `AttachmentUpload` x4); `test/Api.test.ts` (1 of 1 targets used; `AttachmentUpload` x2); doctest on 1 of 1 targets |
| 40 | `Media`, `MediaMetadata`, `MediaFullMetadata`, `MediaPropertyLocation` [4] | media | **(superseded 2026-11-12)** **MISSING** (undeclared) | none | **(superseded 2026-11-12 in its last sentence: README section 7 now states the absence)** The media read surface: `fetchContents`, `fetchMetadata`, `fetchFullMetadata`, `getMediaSourceLocation`, and the three records they return or take (`getMediaReference` alone survives, as the `MediaReference` value). No transport member, no route, no `MediaMetadata` (`path`, `sizeBytes`, `mediaType`) record, no property-location record. README section 7 names "media upload and transformation flows" only; reading media is not named. | absent: `rg -c '(?i)fetchFullMetadata\|MediaPropertyLocation\|getMediaSourceLocation' src` = 0; absent: `rg -c '(?i)media/\|mediaset' src/Api src/Client` = 0 |
| 41 | `MediaReference` | media | ported | `Media/Media.model.ts` `MediaReference`:212, `MediaSetViewItem`:118, `MediaItemLocator`:165, `MediaItemReadToken`:54 | Same record; the read token is `Redacted`. | `test/References.test.ts` (4 of 4 targets used; `MediaSetViewItem` x10); `test/Arguments.test.ts` (1 of 4 targets used; `MediaReference` x3); doctest on 4 of 4 targets |
| 42 | `MediaUpload` | media | ported | `Media/Media.model.ts` `MediaUploadRequest`:245 | Schema only: no transport member uploads media (declared, README section 7). **Shortfall:** no upload operation (declared). | `test/References.test.ts` (1 of 1 targets used; `MediaUploadRequest` x3); doctest on 1 of 1 targets |
| 43 | `MediaItemMetadata`, `DocumentMediaItemMetadata`, `ImageryMediaItemMetadata`, `AudioMediaItemMetadata`, `VideoMediaItemMetadata`, `DicomMediaItemMetadata`, `EmailMediaItemMetadata`, `Model3dMediaItemMetadata`, `SpreadsheetMediaItemMetadata`, `UntypedMediaItemMetadata` [10] | media | ported | `Media/MediaMetadata.model.ts` `MediaItemMetadata`:1462, `DocumentMetadata`:1220, `ImageryMetadata`:1241, `AudioMetadata`:1268, `VideoMetadata`:1283, `DicomMetadata`:1302, `EmailMetadata`:1325, `Model3dMetadata`:1350, `SpreadsheetMetadata`:1369, `UntypedMetadata`:1390, `CadMetadata`:1407 | The union and its 9 OSDK cases, plus the wire's tenth case `cad`. | **(superseded 2026-11-12 for the scratch file, which no longer exists)** `test/MediaTransformation.test.ts` (6 of 11 targets used; `MediaItemMetadata` x19); `test/_wireConformance.scratch.test-d.ts` (1 of 11 targets used; `MediaItemMetadata` x4); doctest on 1 of 11 targets |
| 44 | `UnknownMediaItemMetadata` | media | rejected | none | Client-synthesised fallback for unmodelled tags. Rejected on purpose (README section 7, sharp edges: "`MediaItemMetadata` has no `unknown` fallback on purpose"), at the cost that a new server tag fails the decode. | `README.md` has: ``MediaItemMetadata` has no `unknown` fallback on purpose.` |
| 45 | `AudioDecodeFormat`, `VideoDecodeFormat`, `DocumentDecodeFormat`, `SpreadsheetDecodeFormat`, `ImageryDecodeFormat`, `EmailDecodeFormat`, `DicomMediaType`, `Model3dDecodeFormat`, `Model3dType`, `DataType`, `ColorInterpretation`, `PaletteInterpretation`, `RotationAngle`, `FlipAxis`, `Modality` [15] | media | ported | `Media/MediaMetadata.model.ts` `AudioDecodeFormat`:94, `VideoDecodeFormat`:130, `DocumentDecodeFormat`:163, `SpreadsheetDecodeFormat`:199, `ImageryDecodeFormat`:236, `EmailDecodeFormat`:271, `DicomMediaType`:331, `Model3dDecodeFormat`:367, `Model3dType`:402, `BandDataType`:436, `ColorInterpretation`:481, `PaletteInterpretation`:530, `RotationAngle`:567, `FlipAxis`:603, `Modality`:643 | 15 literal domains as kits, same names except `DataType` (raster band sample type), here `BandDataType`. | `test/MediaTransformation.test.ts` (15 of 15 targets used; `Modality` x5); doctest on 15 of 15 targets |
| 46 | `AudioSpecification`, `VideoSpecification`, `Dimensions`, `BandInfo`, `UnitInterpretation`, `GeoMetadata`, `CoordinateReferenceSystem`, `AffineTransform`, `GcpList`, `GroundControlPoint`, `GpsMetadata`, `Orientation`, `DicomMetaInformation`, `DicomMetaInformationV1`, `CommonDicomDataElements`, `Mailbox`, `MailboxOrGroup`, `EmailAttachment` [18] | media | ported | `Media/MediaMetadata.model.ts` `AudioSpecification`:768, `VideoSpecification`:782, `Dimensions`:799, `BandInfo`:830, `UnitInterpretation`:812, `GeoMetadata`:941, `CoordinateReferenceSystem`:847, `AffineTransform`:866, `GroundControlPoints`:907, `GroundControlPoint`:887, `GpsMetadata`:923, `Orientation`:958, `DicomMetaInformation`:1019, `DicomFileMetaInformation`:981, `CommonDicomDataElements`:1042, `Mailbox`:1074, `EmailRecipient`:1159, `EmailAttachment`:1180 | 18 records and unions, same shapes. Renamed: `GcpList` to `GroundControlPoints`, `DicomMetaInformationV1` to `DicomFileMetaInformation`, `MailboxOrGroup` to `EmailRecipient`. | `test/MediaTransformation.test.ts` (17 of 18 targets used; `EmailRecipient` x8); doctest on 2 of 18 targets |
| 47 | `MailboxWrapper`, `GroupWrapper`, `Group` [3] | media | redesigned | `Media/MediaMetadata.model.ts` `MailboxRecipient`:1089, `GroupRecipient`:1108, `EmailRecipient`:1159 | Conjure wrappers `{type, [type]: payload}` are flattened (sanctioned upgrade C1): the payload fields sit on the union member. | `test/MediaTransformation.test.ts` (1 of 3 targets used; `EmailRecipient` x8); doctest on 1 of 3 targets |
| 48 | `ImageAttributeDomain`, `ImageAttributeKey`, `DicomDataElementKey` [3] | media | subsumed | `Media/MediaMetadata.model.ts` `ImageryMetadata`:1241, `DicomMetadata`:1302 | Three unbranded `string` aliases; here the key schema `S.String` of the two records that used them (`attributes`, `otherDataElements`). | `test/MediaTransformation.test.ts` (2 of 2 targets used; `ImageryMetadata` x1) |

### `@osdk/api`: fetch args/results (21 symbols)

| # | Symbol or family | Subsystem | Disposition | Local target | Reason | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 49 | `SelectArg`, `AsyncIterArgs`, `FetchPageArgs` [3] | objectset | ported | `Client/Client.model.ts` `FetchOptions`:285, `LoadObjectsRequest`:387; `ObjectSet/ObjectSet.model.ts` `OrderBy`:1075; `Property/Property.model.ts` `PropertyAtLoadLevel`:761 | Every `$` option has a field: `selection`, `includeRid`, `loadOntologyDefinedDerivedProperties`, `orderBy`, `pageToken`, `pageSize`, `defaultLoadLevel`, `snapshot`, and `loadPropertySecurities` on the request. `$applyModifiers` is a `PropertyAtLoadLevel` selector; `$includeAllBaseObjectProperties` sits on `InterfaceBaseObjectSet`, where the wire has it. | `test/Client.test.ts` (2 of 4 targets used; `LoadObjectsRequest` x16); `test/Faux.test.ts` (2 of 4 targets used; `FetchOptions` x11); doctest on 3 of 4 targets |
| 50 | `ObjectSetArgs` | objectset | subsumed | `Client/Client.model.ts` `FetchOptions`:285 | The older, narrower argument family (5 members); the one `FetchOptions` record covers it. | `test/Faux.test.ts` (1 of 1 targets used; `FetchOptions` x11); `test/Client.test.ts` (1 of 1 targets used; `FetchOptions` x7); doctest on 1 of 1 targets |
| 51 | `NullabilityAdherence` | objectset | redesigned | `Model/Model.spec.ts` `required`:405; `Shape/Shape.model.ts` `NullPolicy`:340; `Shape/Shape.behavior.ts` `applyShape`:600 | `false` is the default (`Option` on every property that is not `required`); `"throw"` and `"drop"` are the `require` and `dropIfNull` policies of a shape. | `test/Shape.test.ts` (3 of 3 targets used; `applyShape` x29); `test/Model.test.ts` (1 of 3 targets used; `required` x10); doctest on 2 of 3 targets |
| 52 | `SelectArgToKeys` | objectset | subsumed | `Model/Model.set.ts` `pick`:425 | Subsumed by `Model.pick(model, names)`: a narrowed model is a model, so its `Instance` has the selected keys. The link between a `selection` passed to `fetchPage` and the model is by convention, not by type. | `test/Model.object.test.ts` (1 of 1 targets used; `pick` x9); doctest on 1 of 1 targets |
| 53 | `Augment`, `Augments` [2] | objectset | rejected | none | Legacy helpers that feed a phantom generic only (census section 14). No phantom generics exist here (design contract section 1). | none |
| 54 | `FetchPageResult`, `SingleOsdkResult` [2] | results | subsumed | `Client/Client.behavior.ts` `fetchPage`:166, `fetchOne`:360, `stream`:263 | Subsumed by inference: the result type is `Page` of the model's `Instance["Type"]`. | `test/Client.test.ts` (3 of 3 targets used; `fetchOne` x12); `test/Faux.test.ts` (2 of 3 targets used; `fetchPage` x11); doctest on 3 of 3 targets |
| 55 | `PageResult` | results | ported | `Page/Page.model.ts` `Page`:294, `PageToken`:48, `TotalCount`:147 | `Page(identifier, item)`; `totalCount` is a `bigint`, the token a brand. | `test/Client.test.ts` (1 of 3 targets used; `PageToken` x5); `test/Subscription.test.ts` (1 of 3 targets used; `PageToken` x3); doctest on 3 of 3 targets |
| 56 | `Result`, `isOk` [2] | results | subsumed | `Client/Client.errors.ts` `ClientError`:421 | Subsumed by Effect: failures are in the error channel (`ClientError`), and `effect/Result` is used where a pure either is wanted (`Shape.applyShape`). | `test/Client.test.ts` (1 of 1 targets used; `ClientError` x14); doctest on 1 of 1 targets; `src/Shape/Shape.behavior.ts` has: `Result.Result<ShapedRecord, ShapeRejection>` |
| 57 | `ObjectIdentifiers` | values, metamodel | ported | `Object/Object.model.ts` `ObjectLocator`:302 | `{ objectType, primaryKey }`. | `test/Object.test.ts` (1 of 1 targets used; `ObjectLocator` x32); `test/Subscription.test.ts` (1 of 1 targets used; `ObjectLocator` x7); doctest on 1 of 1 targets |
| 58 | `OsdkBase` | values | ported | `Object/Object.model.ts` `OntologyObject`:523, `ObjectLocator`:302; `Model/Model.object.ts` `object`:181 | **(superseded 2026-11-13 in its last clause: a model's `Instance` now has `locator` and `undeclared` and no `objectType`; see the F6 subsection of the status section)** Identity (`locator`, `rid`, `title`) beside the properties; a model's `Instance` has `objectType`, `rid`, `title`, `score`, `properties`. | `test/Object.test.ts` (2 of 3 targets used; `ObjectLocator` x32); `test/Client.test.ts` (1 of 3 targets used; `object` x20); doctest on 3 of 3 targets |
| 59 | `PrimaryKeyType` | values | subsumed | `Object/Object.model.ts` `PrimaryKeyValue`:92; `Model/Model.object.ts` `object`:181 | The key property's own spec: `Model.object` requires the key spec to be `required` and of a `PrimaryKeyKind`. | `test/Client.test.ts` (1 of 2 targets used; `object` x20); `test/Object.test.ts` (1 of 2 targets used; `PrimaryKeyValue` x17); doctest on 2 of 2 targets |
| 60 | `OsdkObject` | values | rejected | `Object/Object.model.ts` `ObjectLocator`:302 | Deprecated predecessor of `OsdkBase` (census section 14). | `test/Object.test.ts` (1 of 1 targets used; `ObjectLocator` x32); `test/Subscription.test.ts` (1 of 1 targets used; `ObjectLocator` x7); doctest on 1 of 1 targets |
| 61 | `Osdk` | values | redesigned | `Model/Model.object.ts` `object`:181, `ObjectModel`:295; `Object/Object.behavior.ts` `instanceCodec`:160 | `Osdk.Instance<Q, OPTIONS, P, R>` is `typeof Model.Instance.Type`. Of its composition (census 7.5), identity, selected properties and `$score` exist. Absent: `$link`, `$as`, `$clone`, typed `$propertySecurities`, `$metadata`, `getFormattedValue`, and derived properties. **Shortfall:** `$link`, `$as`, `$clone`, typed `$propertySecurities`, formatted values absent (see gaps G3, G8). | `test/Client.test.ts` (1 of 3 targets used; `object` x20); `test/Model.object.test.ts` (1 of 3 targets used; `object` x6); doctest on 2 of 3 targets |
| 62 | `ConvertProps` | values | **MISSING** (declared) | none | Maps selected property names across `$as` (object to interface and back). No `$as` and no interface model exist; README section 7 declares interface-typed models absent. | `README.md` has: `Interface-typed models.` |
| 63 | `MaybeScore` | values | subsumed | `Model/Model.object.ts` `object`:181 | `score: Option<number>` is a field of every model `Instance`; no conditional on the ordering. | `test/Client.test.ts` (1 of 1 targets used; `object` x20); `test/Model.object.test.ts` (1 of 1 targets used; `object` x6); doctest on 1 of 1 targets |
| 64 | `ObjectSpecifier` | values | ported | `Object/Object.model.ts` `ObjectSpecifier`:340 | A codec from the text to an `ObjectLocator`, split at the first colon. | `test/Object.test.ts` (1 of 1 targets used; `ObjectSpecifier` x21); doctest on 1 of 1 targets |

### `@osdk/api`: objectset/links/subscriptions (10 symbols)

| # | Symbol or family | Subsystem | Disposition | Local target | Reason | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 65 | `BaseObjectSet` | objectset | subsumed | `ObjectSet/ObjectSet.model.ts` `ObjectSet`:797 | Marker carrying hidden internals. The object set is itself the value, so there is nothing to mark. | `test/ObjectSet.test.ts` (1 of 1 targets used; `ObjectSet` x46); `test/Arguments.test.ts` (1 of 1 targets used; `ObjectSet` x4); doctest on 1 of 1 targets |
| 66 | `ObjectSet` | objectset | redesigned | `ObjectSet/ObjectSet.model.ts` `ObjectSet`:797; `ObjectSet/ObjectSet.behavior.ts` `where`:214, `union`:249, `intersect`:284, `subtract`:325, `traverse`:363, `narrowTo`:417, `withProperties`:454, `nearestNeighbors`:490; `Model/Model.set.ts` `TypedObjectSet`:50; `Client/Client.behavior.ts` `fetchPage`:166, `fetchOne`:360, `stream`:263, `aggregate`:517 | The closure object becomes the wire's 15-case tagged union with pipeable combinators; reading is `Client.fetchPage` / `fetchOne` / `stream` / `aggregate`. Of the 16 methods: `fetchOne(primaryKey)` has no helper (declared), `subscribe` has no running service (declared), `experimental_asyncIterLinks` is the raw `transport.loadLinks` only, and `withProperties`, `nearestNeighbors`, `narrowToType` exist untyped only (not on `TypedObjectSet`). **Shortfall:** `withProperties`, `nearestNeighbors`, `narrowTo` are not in the typed layer; no `subscribe`. | `test/ObjectSet.test.ts` (9 of 14 targets used; `ObjectSet` x46); `test/Shape.test.ts` (6 of 14 targets used; `where` x11); doctest on 13 of 14 targets |
| 67 | `ObjectSetSubscription` | objectset | redesigned | `Subscription/Subscription.model.ts` `ObjectSetSubscribeRequest`:173, `StreamMessage`:856, `ObjectSetUpdate`:590, `ObjectState`:440, `SubscriptionStatus`:915 | `Options` is the subscribe request (`propertySet`, `objectLoadingResponseOptions`); the four `Listener` callbacks are the four `StreamMessage` cases. Protocol only: nothing opens a socket or delivers updates (declared, README section 7). **Shortfall:** no running subscription (declared). | `test/Subscription.test.ts` (5 of 5 targets used; `StreamMessage` x30); doctest on 4 of 5 targets |
| 68 | `LinkTypeApiNamesFor`, `LinkNames`, `LinkedType` [3] | links | subsumed | `Model/Model.set.ts` `traverse`:268; `Model/Model.object.ts` `LinkSpec`:42 | Subsumed by `Model.traverse(link, target)`: its type parameters read link name and target from the model's `LinkSpec`s. | `test/Model.object.test.ts` (2 of 2 targets used; `traverse` x12); `test/Faux.test.ts` (1 of 2 targets used; `traverse` x5); doctest on 1 of 2 targets |
| 69 | `MinimalDirectedObjectLinkInstance`, `FetchLinksPageResult` [2] | links, results | ported | `Link/Link.model.ts` `Link`:84, `LinkPage`:349, `LoadLinksRequest`:291 | `{ source, target, linkType }` rows and their page. | `test/Subscription.test.ts` (3 of 3 targets used; `Link` x20); `test/Faux.test.ts` (1 of 3 targets used; `Link` x1); doctest on 3 of 3 targets |
| 70 | `OsdkObjectLinksObject`, `SingleLinkAccessor` [2] | links | redesigned | `Model/Model.set.ts` `traverse`:268; `Client/Client.behavior.ts` `fetchOne`:360 | Links are followed on sets, not on instances: build the set (`Model.where(Model.eq(key, value))`), `Model.traverse`, then `Client.fetchOne` or `fetchPage`. No per-instance `$link` accessor. **Shortfall:** no per-instance link accessor. | `test/Model.object.test.ts` (1 of 2 targets used; `traverse` x12); `test/Client.test.ts` (1 of 2 targets used; `fetchOne` x12); doctest on 2 of 2 targets |

### `@osdk/api`: metamodel (18 symbols)

| # | Symbol or family | Subsystem | Disposition | Local target | Reason | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 71 | `ObjectTypeDefinition` | metamodel | redesigned | `Model/Model.object.ts` `object`:181, `ObjectModel`:295; `Model/Model.policy.ts` `conformance`:488 | The generated constant with phantom metadata is `Model.object({ apiName, primaryKey, properties, links })`, written by hand and checked against the served type with `Model.conformance`. | `test/Client.test.ts` (1 of 3 targets used; `object` x20); `test/Model.object.test.ts` (2 of 3 targets used; `conformance` x7); doctest on 2 of 3 targets |
| 72 | `ObjectMetadata` | metamodel | ported | `ObjectType/ObjectType.model.ts` `ObjectType`:1211, `ObjectTypeDefinition`:1423, `InterfacePropertyImplementation`:961, `InterfaceImplementation`:1019; `Property/Property.model.ts` `PropertyDefinition`:590; `LinkType/LinkType.model.ts` `LinkTypeSide`:101; `DataType/DataType.model.ts` `MarkingType`:221 | Wire `ObjectTypeV2` and `ObjectTypeFullMetadata`. The 8 namespace members: `Property` is `PropertyDefinition`, `Link` is `LinkTypeSide`, `PropertyTypeMetadata` is `MarkingType`, and the 5 interface-implementation types are the 4-case `InterfacePropertyImplementation`. `interfaceMap` / `inverseInterfaceMap` are derivable from `InterfaceImplementation`, not stored. | `test/ObjectType.test.ts` (6 of 7 targets used; `ObjectType` x51); `test/Property.test.ts` (2 of 7 targets used; `PropertyDefinition` x36); doctest on 6 of 7 targets |
| 73 | `CompileTimeMetadata`, `VersionBound` [2] | metamodel | rejected | none | Accessor for phantom `__DefinitionMetadata` and the phantom minimum-client marker. No phantom metadata and no generated SDK exist here (design contract section 1; README section 7 "A code generator"). | none |
| 74 | `InterfaceDefinition` | metamodel | **MISSING** (declared) | none | The typed interface handle. README section 7 declares it: "Interface-typed models. `Model.object` describes object types only". | **(superseded 2026-11-12: the command now returns 3; the corrected command is in the status section)** absent: `rg -c '^export const interface\|interfaceModel' src/Model` = 0; `README.md` has: `Interface-typed models.` |
| 75 | `InterfaceMetadata` | metamodel | ported | `InterfaceType/InterfaceType.model.ts` `InterfaceType`:514, `InterfaceLinkType`:416, `LinkedEntity`:367 | Wire `InterfaceType`; `InterfaceMetadata.Link` is `InterfaceLinkType` with a 2-case `LinkedEntity` target. | `test/InterfaceType.test.ts` (3 of 3 targets used; `InterfaceType` x36); `test/Ontology.test.ts` (1 of 3 targets used; `InterfaceType` x3); doctest on 3 of 3 targets |
| 76 | `ObjectOrInterfaceDefinition` | metamodel | redesigned | `ObjectSet/ObjectSet.model.ts` `EntityType`:120; `ObjectSet/ObjectSet.behavior.ts` `baseType`:678 | Union on `type` of the two handles. Untyped: `EntityType` (object or interface). Typed: object models only. **Shortfall:** typed side covers object types only (declared). | `test/ObjectSet.test.ts` (2 of 2 targets used; `EntityType` x12); doctest on 2 of 2 targets |
| 77 | `PropertyKeys` | metamodel | subsumed | `Model/Model.object.ts` `PropertyReference`:86; `Model/Model.filter.ts` `EquatableKind`:79, `OrderedKind`:123 | `keyof Specs` on `model.property(name)`; `PropertyKeys.Filtered<Q, T>` is the tag-family constraint on a `PropertyReference` parameter. | `test/Model.object.test.ts` (3 of 3 targets used; `EquatableKind` x5); doctest on 2 of 3 targets |
| 78 | `OntologyMetadata` | metamodel | ported | `Ontology/Ontology.model.ts` `OntologyIdentity`:83; `Client/Client.model.ts` `OntologyScope`:131 | `ontologyRid` and `ontologyApiName` are `OntologyIdentity` / `OntologyScope`. `userAgent` and the unused `expectsClientVersion` are dropped; no user-agent header is modelled. **Shortfall:** `userAgent` dropped. | `test/Ontology.test.ts` (1 of 2 targets used; `OntologyIdentity` x10); `test/Client.test.ts` (1 of 2 targets used; `OntologyScope` x8); doctest on 2 of 2 targets; absent: `rg -c '(?i)user-?agent' src/Api src/Client` = 0 |
| 79 | `QueryDefinition` | metamodel, queries | **(superseded 2026-11-12)** **MISSING** (undeclared) | **(superseded 2026-11-12)** none | **(superseded 2026-11-12)** The typed query handle (phantom `signature`). No `Model.query`, no `Client.executeQuery` facade; `parametersCodec` is `Codec<Record<string, unknown>>` and `outputCodec` is `Codec<unknown, unknown>`. The untyped identity half exists (`Ontology.QuerySelector`: API name and `Option<FunctionVersion>`). README section 7 does not list it. | **(superseded 2026-11-12)** absent: `rg -c '^export (const\|function) (query\|executeQuery)\b' src/Model src/Client/Client.behavior.ts` = 0; `src/Query/Query.behavior.ts` has: `}: Pick<QueryType, "output" \| "typeReferences">): S.Codec<unknown, ...` |
| 80 | `QueryMetadata`, `QueryParameterDefinition`, `QueryDataTypeDefinition`, `ObjectQueryDataType`, `InterfaceQueryDataType`, `ObjectSetQueryDataType`, `TwoDimensionalQueryAggregationDefinition`, `ThreeDimensionalQueryAggregationDefinition` [8] | metamodel, queries | ported | `Query/Query.model.ts` `QueryType`:977, `QueryParameter`:928, `QueryDataType`:729, `ObjectReferenceType`:584, `InterfaceObjectReferenceType`:638, `ObjectSetType`:609, `TwoDimensionalAggregationType`:281, `ThreeDimensionalAggregationType`:302, `nonNullAlternative`:886, `resolveTypeReference`:1069 | Wire `QueryTypeV2` and the 26-case `QueryDataType` (OSDK's union has 13 variants over 23 literals). `nullable` on every member is a union with the `null` tag, read by `nonNullAlternative`. | `test/Query.test.ts` (10 of 10 targets used; `QueryDataType` x85); `test/Arguments.test.ts` (3 of 10 targets used; `QueryType` x12); doctest on 4 of 10 targets |

### `@osdk/api`: queries (5 symbols)

| # | Symbol or family | Subsystem | Disposition | Local target | Reason | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 81 | `Range`, `TwoDimensionalAggregation`, `ThreeDimensionalAggregation` [3] | queries | ported | `Query/Query.model.ts` `QueryRange`:1113, `TwoDimensionalAggregation`:1243, `ThreeDimensionalAggregation`:1284 | Wire value shapes (`{ groups: [...] }`). | `test/Query.test.ts` (3 of 3 targets used; `QueryRange` x18); `test/Arguments.test.ts` (2 of 3 targets used; `TwoDimensionalAggregation` x3); doctest on 3 of 3 targets |
| 82 | `QueryParam`, `QueryResult` [2] | queries | subsumed | `Query/Query.behavior.ts` `valueCodec`:329, `parametersCodec`:386, `outputCodec`:440; `ObjectSet/ObjectSet.model.ts` `ObjectSetArgument`:904 | **(superseded 2026-11-12 in its last two sentences: the static types are computed by `Model.query`)** Two namespaces (7 and 8 members) mapping a data type to the accepted and the returned TS type. Subsumed by the projection `Query.valueCodec(dataType, typeReferences)`. Runtime only: the result is `S.Codec<unknown, unknown>`. **Shortfall:** static parameter and result types are not computed (see gap G2). | `test/Arguments.test.ts` (3 of 4 targets used; `valueCodec` x17); `test/ObjectSet.test.ts` (1 of 4 targets used; `ObjectSetArgument` x9); doctest on 4 of 4 targets |

### `@osdk/api`: derived properties (1 symbol)

| # | Symbol or family | Subsystem | Disposition | Local target | Reason | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 83 | `DerivedProperty` | derived-properties | redesigned | `DerivedProperty/DerivedProperty.model.ts` `DerivedProperty`:948, `SelectedPropertyOperation`:445; `ObjectSet/ObjectSet.behavior.ts` `selectProperty`:786, `aggregate`:817, `plus`:849, `extractPart`:1054, `withProperties`:454; `ObjectSet/ObjectSet.policy.ts` `checkDerivedProperty`:272 | Namespace of 9 members. The builder DSL (`Builder`, `AggregateBuilder`, `SelectPropertyBuilder`, the numeric and datetime `Definition`s) is the wire's 11-case recursive union with constructors (`selectProperty`, `aggregate`, `plus`, `minus`, `times`, `dividedBy`, `least`, `greatest`, `abs`, `negate`, `extractPart`); `ValidParts` is `DatePart`. Untyped: which builder a link cardinality allows and the result type of an expression are not tracked (declared, README section 7). **Shortfall:** no typed derived properties (declared). | `test/ObjectSet.test.ts` (8 of 8 targets used; `DerivedProperty` x28); doctest on 8 of 8 targets |

### `@osdk/api`: timeseries (6 symbols)

| # | Symbol or family | Subsystem | Disposition | Local target | Reason | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 84 | `TimeseriesDurationMapping` | timeseries | rejected | `TimeSeries/TimeSeries.model.ts` `SeriesTimeUnit`:202 | Runtime alias table (22 aliases to 8 units). Rejected as input sugar (README section 7); `SeriesTimeUnit` has the 8 units. | `test/TimeSeries.test.ts` (1 of 1 targets used; `SeriesTimeUnit` x4); doctest on 1 of 1 targets |
| 85 | `TimeSeriesQuery` | timeseries | redesigned | `TimeSeries/TimeSeries.model.ts` `TimeRange`:435, `AbsoluteTimeRange`:351, `RelativeTimeRange`:375, `RelativeTime`:321 | The four-way exclusive bag becomes the wire's tagged `TimeRange` with constructors `last`, `since`, `until`, `between`. | `test/TimeSeries.test.ts` (4 of 4 targets used; `TimeRange` x44); doctest on 2 of 4 targets |
| 86 | `TimeSeriesPoint` | timeseries | ported | `TimeSeries/TimeSeries.model.ts` `TimeSeriesPoint`:522, `PointValue`:482 | `time` is a `DateTime.Utc`. | `test/TimeSeries.test.ts` (2 of 2 targets used; `TimeSeriesPoint` x19); doctest on 2 of 2 targets |
| 87 | `TimeSeriesProperty`, `GeotimeSeriesProperty` [2] | timeseries, geo | **MISSING** (declared) | none | The two read handles (`getFirstPoint`, `getLastPoint`, `getAllPoints`, `asyncIterPoints`; `getLatestValue`, `getAllValues`, `asyncIterValues`). The request and response schemas exist (`StreamPointsRequest`, `StreamValuesRequest`, `GeotimeSeriesValue`), but no transport member or route reads a series. README section 7 declares it: "time-series reads". | absent: `rg -c '(?i)timeseries\|firstPoint\|lastPoint\|streamPoints' src/Api src/Client` = 0; `README.md` has: `time-series reads` |
| 88 | `TimeSeriesReference` | timeseries, actions | ported | `TimeSeries/TimeSeries.model.ts` `TimeSeriesReference`:1169, `SeriesReference`:1050, `QualifiedSeriesReference`:1074, `TemplateSeriesReference`:1099 | A 3-case union: a series id alone, a series id with its sync (OSDK's optional `$syncRid`), a template. | `test/TimeSeries.test.ts` (4 of 4 targets used; `TimeSeriesReference` x34); `test/Arguments.test.ts` (1 of 4 targets used; `TimeSeriesReference` x1); doctest on 1 of 4 targets |

### `@osdk/api`: formatting (39 symbols)

| # | Symbol or family | Subsystem | Disposition | Local target | Reason | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 89 | `PropertyValueFormattingRule`, `PropertyBooleanFormattingRule`, `PropertyDateFormattingRule`, `PropertyTimestampFormattingRule`, `PropertyKnownTypeFormattingRule`, `PropertyNumberFormattingRule` [6] | formatting | ported | `ValueFormat/ValueFormat.model.ts` `ValueFormat`:1012, `BooleanValueFormat`:949, `DateValueFormat`:932, `TimestampValueFormat`:914, `KnownTypeValueFormat`:967, `NumberValueFormat`:896 | The 5-case union and its members (`Property…FormattingRule` to `…ValueFormat`). Data only: nothing renders a value (declared, README section 7 "Rendering"). **Shortfall:** no renderer (declared). | `test/ValueFormat.test.ts` (6 of 6 targets used; `ValueFormat` x44); `test/Property.test.ts` (1 of 6 targets used; `ValueFormat` x2); doctest on 1 of 6 targets |
| 90 | `DatetimeFormat`, `DatetimeStringFormat`, `DatetimeLocalizedFormat`, `DatetimeLocalizedFormatType`, `DatetimeTimezone`, `DatetimeTimezoneStatic`, `DatetimeTimezoneUser` [7] | formatting | ported | `ValueFormat/ValueFormat.model.ts` `DatetimeFormat`:796, `DatetimeStringFormat`:739, `DatetimeLocalizedFormat`:761, `DatetimeTimezone`:866, `StaticTimezone`:821, `UserTimezone`:840; `ValueFormat/ValueFormat.values.ts` `DatetimePreset`:427 | Two 2-case unions and the 7-literal preset domain (`DatetimeLocalizedFormatType` to `DatetimePreset`). | `test/ValueFormat.test.ts` (7 of 7 targets used; `DatetimeFormat` x24); doctest on 3 of 7 targets |
| 91 | `KnownType` | formatting | ported | `ValueFormat/ValueFormat.values.ts` `KnownType`:476 | 3-literal mapped kit. | `test/ValueFormat.test.ts` (1 of 1 targets used; `KnownType` x9); doctest on 1 of 1 targets |
| 92 | `PropertyNumberFormattingRuleType`, `NumberFormatOptions`, `NumberFormatNotation`, `NumberRoundingMode`, `NumberFormatStandard`, `NumberFormatFixedValues`, `NumberFormatCurrency`, `NumberFormatCurrencyStyle`, `NumberFormatStandardUnit`, `NumberFormatCustomUnit`, `NumberFormatAffix`, `Affix`, `NumberFormatDuration`, `DurationFormatStyle`, `HumanReadableFormat`, `TimeCodeFormat`, `DurationPrecision`, `DurationBaseValue`, `NumberFormatScale`, `NumberScaleType`, `NumberFormatRatio`, `NumberRatioType` [22] | formatting | ported | `ValueFormat/ValueFormat.model.ts` `NumberFormat`:699, `NumberFormatOptions`:175, `NumberFormatStandard`:444, `NumberFormatFixedValues`:493, `NumberFormatCurrency`:512, `NumberFormatStandardUnit`:533, `NumberFormatCustomUnit`:553, `NumberFormatAffix`:578, `Affix`:341, `NumberFormatDuration`:603, `DurationFormatStyle`:417, `HumanReadableDuration`:370, `TimecodeDuration`:390, `NumberFormatScale`:626, `NumberFormatRatio`:644; `ValueFormat/ValueFormat.values.ts` `NumberNotation`:127, `NumberRoundingMode`:172, `CurrencyStyle`:213, `DurationPrecision`:343, `DurationInputUnit`:379, `NumberScale`:255, `NumberRatio`:299 | The 9-case number union, its 9 members' records and 7 literal domains, one to one. | `test/ValueFormat.test.ts` (22 of 22 targets used; `NumberFormat` x70); doctest on 11 of 22 targets |
| 93 | `PropertyTypeReferenceOrStringConstant`, `StringConstant`, `PropertyTypeReference` [3] | formatting | ported | `ValueFormat/ValueFormat.model.ts` `PropertyOrConstant`:126, `StringConstant`:60, `PropertyLookup`:79 | 2-case union: a literal or the value of a sibling property. | `test/ValueFormat.test.ts` (3 of 3 targets used; `PropertyOrConstant` x20); doctest on 1 of 3 targets |

### `@osdk/api`: logging (1 symbol)

| # | Symbol or family | Subsystem | Disposition | Local target | Reason | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 94 | `Logger` | logging | subsumed | none | pino-shaped logger interface (+ `LogFn`). Subsumed by Effect: logging is ambient (`Effect.log*`, the `Logger` service, `Effect.fn` spans); the package takes no logger argument. | `src/Client/Client.behavior.ts` has: `Effect.fn("Client.fetchPage")` |

### `@osdk/api/unstable`: agents (10 symbols)

| # | Symbol or family | Subsystem | Disposition | Local target | Reason | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 95 | `AgentDefinition` | agents, metamodel | redesigned | `Agent/Agent.model.ts` `AgentDefinition`:935, `AgentParameter`:847, `AgentDataType`:750 | The handle with phantom signatures becomes a decoded definition (parameters, events, context items) over the wire's 16-case `AgentDataType`. Argument typing is runtime only. **Shortfall:** static argument types not computed (gap G1 applies). | `test/Agent.test.ts` (3 of 3 targets used; `AgentDataType` x33); doctest on 2 of 3 targets |
| 96 | `AgentParam` | agents | subsumed | `Agent/Agent.behavior.ts` `valueCodec`:113, `argumentsCodec`:231; `Agent/Agent.model.ts` `AgentObjectReference`:1573 | Namespace of 2 members. Subsumed by the projection `Agent.valueCodec(dataType)`; runtime only (`S.Codec<unknown, unknown>`). **Shortfall:** runtime only. | `test/Agent.test.ts` (3 of 3 targets used; `valueCodec` x40); doctest on 3 of 3 targets |
| 97 | `AgentSession` | agents | redesigned | `Agent/Agent.model.ts` `AgentSession`:1113, `CreateAgentSessionRequest`:1087, `SendAgentEventRequest`:1182, `SendAgentEventResponse`:1266, `AgentStateResponse`:1512 | The session handle becomes the session record and the request / response schemas of its two operations. `experimental_getState` / `experimental_sendEvent` (poll until ready) are not built (declared, README section 7 "agent session polling"). **Shortfall:** no polling operations (declared). | `test/Agent.test.ts` (5 of 5 targets used; `AgentStateResponse` x16); doctest on 2 of 5 targets |
| 98 | `AgentSessionState`, `AgentSessionStatus`, `AgentContextItem` [3] | agents | ported | `Agent/Agent.model.ts` `AgentSessionState`:1439, `AgentSessionStatus`:1305, `AgentContextItem`:1390; `Agent/Agent.behavior.ts` `isTerminal`:253 | Same records; the 4-literal status kit plus `isTerminal`. | `test/Agent.test.ts` (4 of 4 targets used; `AgentSessionStatus` x11); doctest on 3 of 4 targets |
| 99 | `AgentGetStateOptions`, `AgentSendEventOptions` [2] | agents | redesigned | `Agent/Agent.behavior.ts` `defaultPollTimeout`:287, `defaultPollInterval`:305 | The two identical option records are their defaults as `Duration` constants (30 s, 1 s). There is no options record because there is no polling function to pass it to. **Shortfall:** defaults only. | `test/Agent.test.ts` (2 of 2 targets used; `defaultPollTimeout` x3); doctest on 2 of 2 targets |
| 100 | `AgentGetStateTimeoutError`, `AgentSendEventTimeoutError` [2] | agents, errors | ported | `Agent/Agent.behavior.ts` `AgentStateTimeout`:338, `AgentEventTimeout`:391 | `S.TaggedError`s with fields. Nothing in `src` raises them. **Shortfall:** declared but never raised. | `test/Agent.test.ts` (2 of 2 targets used; `AgentStateTimeout` x13); doctest on 2 of 2 targets |

### `@osdk/api/unstable`: experimental (17 symbols)

| # | Symbol or family | Subsystem | Disposition | Local target | Reason | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 101 | `Experiment`, `ExperimentFns` [2] | experimental | rejected | none | Capability tokens that gate a function on a minimum client version through `client(token)`. There is no `client(x)` indirection here: a capability is a function or a transport member. Reason inferred; neither README nor source states it. | none |
| 102 | `__EXPERIMENTAL__NOT_SUPPORTED_YET__executeStreamingFunction` | experimental, queries | **(superseded 2026-11-12)** **MISSING** (undeclared) | none | **(superseded 2026-11-12 in its last sentence: README section 7 now states the absence)** Streaming function execution. The stream's wire events exist (`Query.QueryStreamEvent`, `QueryStreamData`, `QueryStreamFailure`), but `OntologyTransport.executeQuery` is request / response only and no route streams. Not stated in README section 7. | absent: `rg -c '(?i)QueryStream\|streamingExecute\|executeStreaming' src/Api src/Client` = 0; `src/Query/Query.model.ts` has: `export const QueryStreamEvent` |
| 103 | `__EXPERIMENTAL__NOT_SUPPORTED_YET__fetchOneByRid`, `__EXPERIMENTAL__NOT_SUPPORTED_YET__fetchPageByRid`, `FetchPageByRidPayload` [3] | experimental, objectset | subsumed | `ObjectSet/ObjectSet.behavior.ts` `objects`:151; `ObjectSet/ObjectSet.model.ts` `StaticObjectSet`:283; `Client/Client.behavior.ts` `fetchPage`:166, `fetchOne`:360 | **(superseded 2026-11-12 in its call shape and its last sentence)** Subsumed by composition: `Client.fetchPage(model, ObjectSet.objects(rids), options)`; the no-type form is `transport.loadObjects` over the same set. `test/Faux.test.ts:760-768` does exactly this. README section 7 says by-RID fetches are not built: it understates. | `test/Client.test.ts` (2 of 4 targets used; `fetchOne` x12); `test/ObjectSet.test.ts` (2 of 4 targets used; `objects` x13); doctest on 3 of 4 targets; `test/Faux.test.ts` has: `ObjectSets.objects([adaRid, "ri.phonograph2-objects.main.object.nob...` |
| 104 | `__EXPERIMENTAL__NOT_SUPPORTED_YET__getBulkLinks`, `EXPERIMENTAL_BulkLinkResult` [2] | experimental, links | ported | `Link/Link.model.ts` `BulkLink`:410, `LoadLinksRequest`:291, `LinkPage`:349; `Client/Client.service.ts` `OntologyTransport`:107 | `BulkLink` is the result row; the read is `OntologyTransport.loadLinks`, one page per call. No paging stream over links, and `Faux.layer` refuses `loadLinks`. **Shortfall:** one page per call; no stream facade. | `test/Subscription.test.ts` (3 of 4 targets used; `BulkLink` x14); `test/Faux.test.ts` (1 of 4 targets used; `OntologyTransport` x5); doctest on 4 of 4 targets |
| 105 | `__EXPERIMENTAL__NOT_SUPPORTED_YET__linkSubscriptions`, `LinkSubscription` [2] | experimental, links | redesigned | `Link/Link.model.ts` `LinkSubscribeRequest`:478, `LinkSubscribeRequests`:530, `LinkUpdate`:620, `LinkState`:571, `RefreshLinks`:660, `LinkStreamMessage`:712 | `Args` is the subscribe request, `LinkUpdate` the update, `OutOfDateEvent` is `RefreshLinks`, and the `Listener` callbacks are the 4 `LinkStreamMessage` cases. Protocol only (declared, README section 7). **Shortfall:** no running subscription (declared). | `test/Subscription.test.ts` (6 of 6 targets used; `LinkStreamMessage` x24); doctest on 4 of 6 targets |
| 106 | `__EXPERIMENTAL__NOT_SUPPORTED_YET__subscribeToNoTypeObjectSet` | experimental, objectset | redesigned | `Subscription/Subscription.model.ts` `ObjectSetSubscribeRequest`:173; `ObjectSet/ObjectSet.behavior.ts` `saved`:171 | A subscribe request over `ObjectSet.saved(rid)`. Protocol only (declared). **Shortfall:** no running subscription (declared). | `test/Subscription.test.ts` (1 of 2 targets used; `ObjectSetSubscribeRequest` x13); `test/Client.test.ts` (1 of 2 targets used; `saved` x11); doctest on 1 of 2 targets |
| 107 | `transformAndWait`, `TransformOptions` [2] | experimental, media | **MISSING** (declared) | none | Start a transformation job and poll it to a `Response`. The request, job and default constants exist (`TransformMediaItemRequest`, `TransformationJob`, `DefaultPollInterval`, `DefaultPollTimeout`), but no operation runs a job. README section 7 declares it: "media upload and transformation flows". | absent: `rg -c '(?i)transformMedia\|TransformationJob\|transformAndWait\|mediaTransformation' src/Api src/Client` = 0; `README.md` has: `media upload and transformation flows`; `src/Media/MediaTransformation.model.ts` has: `export class TransformMediaItemRequest` |
| 108 | `MinimalObjectSet` | objectset | subsumed | `ObjectSet/ObjectSet.model.ts` `ObjectSet`:797 | A reduced method set for untyped object sets. The union value needs no reduced variant: every operation is a function over it. | `test/ObjectSet.test.ts` (1 of 1 targets used; `ObjectSet` x46); `test/Arguments.test.ts` (1 of 1 targets used; `ObjectSet` x4); doctest on 1 of 1 targets |
| 109 | `MediaTransformationError`, `MediaTransformationFailedError`, `MediaTransformationTimeoutError` [3] | media, errors | **MISSING** (declared) | none | The three error classes of a transformation job. No error class exists for media; the job's failed state is a literal of `TransformationJobStatus` only. They fall under the declared flow gap (README section 7), but unlike the agent timeouts they were not modelled. | absent: `rg -c 'TaggedError\|extends Error' src/Media` = 0 |

### `@osdk/api/unstable`: media transformation (44 symbols)

| # | Symbol or family | Subsystem | Disposition | Local target | Reason | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 110 | `MediaTransformation` | media | redesigned | `Media/MediaTransformation.model.ts` `MediaTransformation`:3241; `Media/MediaTransformation.values.ts` `MediaTransformationKind`:41 | The single-`$key` union of 18 becomes the wire's 18-case union on `type` (README: "the `$key` records are client sugar"). | **(superseded 2026-11-12 for the scratch file, which no longer exists)** `test/MediaTransformation.test.ts` (2 of 2 targets used; `MediaTransformation` x36); `test/_wireConformance.scratch.test-d.ts` (1 of 2 targets used; `MediaTransformation` x4); doctest on 2 of 2 targets |
| 111 | `ImageOperation`, `VideoOperation`, `AudioOperation`, `VideoToAudioOperation`, `AudioToTextOperation`, `EmailToTextOperation`, `EmailToAttachmentOperation`, `SpreadsheetToTextOperation`, `VideoToArchiveOperation`, `VideoToTextOperation`, `ImageToTextOperation`, `VideoToImageOperation`, `ImageToDocumentOperation`, `DicomToImageOperation`, `DocumentToDocumentOperation`, `DocumentToImageOperation`, `ImageToEmbeddingOperation`, `DocumentToTextOperation` [18] | media | redesigned | `Media/MediaTransformation.model.ts` `ImageOperation`:1490, `VideoOperation`:1572, `AudioOperation`:1660, `VideoToAudioOperation`:1704, `AudioToTextOperation`:1779, `EmailToTextOperation`:2027, `EmailToAttachmentOperation`:2087, `SpreadsheetToTextOperation`:2144, `VideoToArchiveOperation`:1839, `VideoToTextOperation`:1893, `ImageToTextOperation`:2280, `VideoToImageOperation`:1973, `ImageToDocumentOperation`:2329, `DicomToImageOperation`:2439, `DocumentToDocumentOperation`:2510, `DocumentToImageOperation`:2588, `ImageToEmbeddingOperation`:2384, `DocumentToTextOperation`:2876 | The 18 operation unions, same names, as wire unions on `type`. 48 operations counted against OSDK's 46: `ImageToTextOperation` has the wire's 4 cases where OSDK has 2. | `test/MediaTransformation.test.ts` (18 of 18 targets used; `ImageOperation` x15); doctest on 18 of 18 targets |
| 112 | `ImageryEncoding`, `VideoEncoding`, `AudioEncoding`, `ArchiveEncoding`, `DocumentEncoding` [5] | media | ported | `Media/MediaTransformation.model.ts` `ImageryEncoding`:218, `VideoEncoding`:254, `AudioEncoding`:459, `ArchiveEncoding`:290, `DocumentEncoding`:326 | Same names; `AudioEncoding` is a 3-case union (`mp3`, `wav` with its layout, `ts`). | `test/MediaTransformation.test.ts` (5 of 5 targets used; `AudioEncoding` x7); doctest on 5 of 5 targets |
| 113 | `PageRange`, `OcrOutputFormat`, `OcrLanguageOrScript`, `OcrParameters`, `LayoutAwareExtractionParameters`, `DocumentTextExtractionConfig`, `TranscribeOutputFormat`, `LlmSpec`, `VlmPreprocessingConfig`, `ImageSpec` [10] | media | ported | `Media/MediaTransformation.model.ts` `PageRange`:484, `OcrOutputFormat`:512, `OcrLanguageOrScript`:588, `OcrParameters`:611, `LayoutAwareExtractionParameters`:630, `DocumentTextExtractionConfig`:663, `TranscribeOutputFormat`:739, `LlmSpec`:889, `VlmPreprocessingConfig`:992, `ImageSpec`:1015 | Same names and members, `type`-tagged where OSDK uses a `$key`. | `test/MediaTransformation.test.ts` (10 of 10 targets used; `OcrLanguageOrScript` x9); doctest on 5 of 10 targets |
| 114 | `OcrLanguage`, `OcrScript`, `TranscriptionLanguage` [3] | media | ported | `Media/MediaTransformation.values.ts` `OcrLanguage`:581, `OcrScript`:735, `TranscriptionLanguage`:816 | Kits of 123, 37 and 212 literals (counted at runtime), matching the census. | `test/MediaTransformation.test.ts` (3 of 3 targets used; `OcrLanguage` x6); doctest on 3 of 3 targets |
| 115 | `Annotation`, `AnnotateGeometry`, `BoundingBox`, `Color`, `ContrastType`, `ImagePixelCoordinate`, `ImageRegionPolygon` [7] | media | ported | `Media/MediaTransformation.model.ts` `Annotation`:1124, `AnnotateGeometry`:1105, `BoundingBoxGeometry`:1066, `Color`:1040, `ContrastType`:1216, `ImagePixelCoordinate`:1237, `ImageRegionPolygon`:1268 | Same names except `BoundingBox`, here `BoundingBoxGeometry` (`Geo.BoundingBox` is the geographic one). | `test/MediaTransformation.test.ts` (6 of 7 targets used; `AnnotateGeometry` x6); doctest on 3 of 7 targets |

### `@osdk/api/unstable`: shapes (20 symbols)

| # | Symbol or family | Subsystem | Disposition | Local target | Reason | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 116 | `ShapeDefinition` | shapes | ported | `Shape/Shape.model.ts` `ShapeDefinition`:651, `ShapeId`:212; `Shape/Shape.behavior.ts` `shapeId`:714, `canonicalJson`:667 | A schema value (`objectType`, `properties`, `links`) that decodes from JSON; its id is a SHA-256 of the canonical JSON, not a field. | `test/Shape.test.ts` (4 of 4 targets used; `ShapeDefinition` x21); doctest on 4 of 4 targets |
| 117 | `ShapeBuilder`, `createShapeBuilder` [2] | shapes | redesigned | `Shape/Shape.behavior.ts` `shape`:89, `select`:141, `require`:169, `dropIfNull`:197, `withDefault`:224, `withTransform`:270, `deriveLink`:341; `Shape/Shape.model.ts` `Shape`:728 | The fluent builder is `Shape.shape(objectType)` plus pipeable functions; there is no terminal `build`. Untyped: the builder takes a string and property names are not checked against a model. **Shortfall:** property names unchecked (see gap G10). | `test/Shape.test.ts` (8 of 8 targets used; `shape` x65); doctest on 7 of 8 targets |
| 118 | `ShapeLinkBuilder`, `ShapeLinkResult` [2] | shapes | redesigned | `Shape/Shape.model.ts` `ShapeLinkSet`:499, `DerivedLink`:579; `Shape/Shape.behavior.ts` `linkSet`:306, `linkedShape`:392, `toObjectSet`:445 | The fluent link query is the schema value `ShapeLinkSet` (`segments`, `where`, `order`, `limit`, `distinct`, `operations`); `.as(target)` is the `target` argument of `deriveLink`. Its `$primaryKey` placeholder is absent (see `SourcePrimaryKeySymbol`). | `test/Shape.test.ts` (5 of 5 targets used; `linkSet` x34); doctest on 4 of 5 targets |
| 119 | `ShapeInstance` | shapes | **(superseded 2026-11-12)** **MISSING** (undeclared) | none | **(superseded 2026-11-12 in its last sentence: README section 7 now states the absence)** The static type of a shaped object (`require` narrows to non-null, `withTransform` to the transform's result, derived links to arrays of shaped objects). `applyShape` is `(Shape, Readonly<Record<string, unknown>>) => Result<Readonly<Record<string, unknown>>, ShapeRejection>` and a `Shape` has no type parameter. Not stated in README section 7. | `src/Shape/Shape.behavior.ts` has: `type ShapedRecord = Readonly<Record<string, unknown>>;` |
| 120 | `ShapeBaseType`, `ShapeDerivedLinks`, `PropertyType`, `RequiredProperty`, `InferShapeDefinition` [5] | shapes | subsumed | `Shape/Shape.model.ts` `ShapeDefinition`:651 | Five extractors over the shape's type parameters. Value-level only: `definition.objectType`, `definition.links`, `definition.properties`. With no type parameters on `Shape` there is nothing to extract statically. **Shortfall:** value-level only (see gap G10). | `test/Shape.test.ts` (1 of 1 targets used; `ShapeDefinition` x21); doctest on 1 of 1 targets |
| 121 | `LinkLoadConfig` | shapes | rejected | none | `pageSize`, `autoFetchMore`, `streamUpdates`, `defer`. Rejected with a stated reason for `defer` (`Shape.model.ts`, `DerivedLink`: "when to load a link is the consumer's decision, not part of what the shape is"); the other three fields are not mentioned. | `src/Shape/Shape.model.ts` has: `OSDK's `defer` flag is absent: when to load a link is the consumer's` |
| 122 | `LinkStatus` | shapes | **(superseded 2026-11-12)** **MISSING** (undeclared) | none | **(superseded 2026-11-12 in its last sentence: README section 7 now states the absence)** Load state of a derived link (`isLoading`, `error`, `hasMore`, `fetchMore`). Nothing loads a shape's derived links (`toObjectSet` only builds the set to read), so there is no state to report. Not stated. | absent: `rg -c '(?i)isLoading\|hasMore\|fetchMore' src/Shape` = 0 |
| 123 | `NullabilityViolation`, `ShapeNullabilityError` [2] | shapes, errors | redesigned | `Shape/Shape.model.ts` `ShapeViolation`:813, `ShapeRejection`:893, `ViolatedShape`:857, `DroppedByShape`:838; `Shape/Shape.behavior.ts` `applyShape`:600 | A thrown error carrying violations becomes the failure side of a `Result`: `ViolatedShape` with every violation, or `DroppedByShape`. | `test/Shape.test.ts` (5 of 5 targets used; `applyShape` x29); doctest on 3 of 5 targets |
| 124 | `SourcePrimaryKeySymbol`, `isSourcePkSymbol` [2] | shapes | **MISSING** (declared) | none | Placeholder for "the source object's primary key" inside a link filter. README section 7 declares it absent. | absent: `rg -c 'Symbol\.for\|sourcePk' src/Shape` = 0; `README.md` has: `OSDK's `SourcePrimaryKeySymbol`` |
| 125 | `configToShapeDefinition`, `InlineShapeConfig`, `InlineLinkConfig` [3] | shapes | subsumed | `Shape/Shape.model.ts` `ShapeDefinition`:651, `DerivedLink`:579 | The declarative config and its converter. `ShapeDefinition` is itself declarative data: decode it. A property cannot appear under two policies because policies are a record keyed by property. | `test/Shape.test.ts` (2 of 2 targets used; `ShapeDefinition` x21); doctest on 1 of 2 targets |

### `@osdk/api/shapes-internal`: shapes-internal (8 symbols)

| # | Symbol or family | Subsystem | Disposition | Local target | Reason | Proof |
| --- | --- | --- | --- | --- | --- | --- |
| 126 | `NullabilityOp` | shapes | ported | `Shape/Shape.model.ts` `NullPolicy`:340 | 5-case union on `type`; a transform is named (`TransformName`) and its function supplied beside the definition. | `test/Shape.test.ts` (1 of 1 targets used; `NullPolicy` x21); doctest on 1 of 1 targets |
| 127 | `ShapePropertyConfig` | shapes | subsumed | `Shape/Shape.model.ts` `ShapeDefinition`:651 | A one-field wrapper around the op; `ShapeDefinition.properties` maps a property straight to its `NullPolicy`. | `test/Shape.test.ts` (1 of 1 targets used; `ShapeDefinition` x21); doctest on 1 of 1 targets |
| 128 | `DerivedLinkConfig` | shapes | rejected | none | `defer?: boolean`. Rejected, reason stated in `Shape.model.ts` (`DerivedLink`). | `src/Shape/Shape.model.ts` has: `OSDK's `defer` flag is absent: when to load a link is the consumer's` |
| 129 | `ShapeDerivedLinkDef` | shapes | ported | `Shape/Shape.model.ts` `DerivedLink`:579, `DerivedLinkName`:104 | `{ linkSet, shape }`; the name is the record key, so names cannot collide. | `test/Shape.test.ts` (2 of 2 targets used; `DerivedLinkName` x3); doctest on 1 of 2 targets |
| 130 | `ShapeLinkObjectSetDef` | shapes | ported | `Shape/Shape.model.ts` `ShapeLinkSet`:499, `LinkLimit`:172 | Recursive through `operations`. | `test/Shape.test.ts` (2 of 2 targets used; `ShapeLinkSet` x14); doctest on 2 of 2 targets |
| 131 | `ShapeLinkSegment` | shapes | ported | `Shape/Shape.model.ts` `TraversalSegment`:374 | `link` only: `sourceType` / `targetType` are not carried. | `test/Shape.test.ts` (1 of 1 targets used; `TraversalSegment` x4) |
| 132 | `ShapeLinkOrderBy` | shapes | subsumed | `ObjectSet/ObjectSet.model.ts` `OrderBy`:1075, `PropertyOrdering`:967 | Subsumed by the object set's own `OrderBy`, which `ShapeLinkSet.order` holds. | `test/ObjectSet.test.ts` (2 of 2 targets used; `OrderBy` x14); `test/Model.object.test.ts` (1 of 2 targets used; `OrderBy` x2); doctest on 1 of 2 targets |
| 133 | `ShapeLinkSetOperation` | shapes | ported | `Shape/Shape.model.ts` `LinkSetOperation`:425, `LinkSetOperator`:403 | `{ operator, other }` over the 3-literal operator kit. | `test/Shape.test.ts` (2 of 2 targets used; `LinkSetOperation` x10); doctest on 1 of 2 targets |

## 2. Wire-only families the package claims to model

Wire counts are the ones the maps state (reference in the third column). Local counts were taken at runtime from
the exported union or kit (`.members.length`, else `.literals.length`, else the union AST's member count), by
importing `src/index.ts` under bun; none is copied from documentation.

| Family | Wire union | Wire members (map) | Local union | Local members (counted) | Verdict |
| --- | --- | --- | --- | --- | --- |
| Object sets | `ObjectSet` | 15 (08 s.9) | `ObjectSet.ObjectSet` | 15 | equal |
| Object sets | `NearestNeighborsQuery` | 2 (08 s.9) | `ObjectSet.NearestNeighborsQuery` | 2 | equal |
| Object sets | `PropertyIdentifier` | 5 (07 s.17.2) | `Property.PropertySelector` | 5 | equal |
| Object sets | `PropertyLoadLevel` | 4 (09 s.4) | `Property.PropertyLoadLevel` | 4 | equal; a literal here, the four empty records are its encoding |
| Object sets | `ObjectPropertyType` | 22 (08 s.5.1) | `Property.PropertyType` | 22 | equal |
| Object sets | `PrimaryKeyValueV2` | 7 (07 s.8) | `Object.TypedPrimaryKeyValue` | 7 | equal |
| Object sets | `ObjectTypeDatasourceDefinition` | 10 (08 s.6) | `ObjectType.DatasourceDefinition` | 10 | equal |
| Search queries | `SearchJsonQueryV2` | 28 (09 s.7.1) | `Filter.ObjectFilter` | 28 | equal |
| Search queries | `IntervalQueryRule` | 5 (07 s.17.3) | `Filter.IntervalRule` | 5 | equal |
| Search queries | `GeoShapeV2Geometry` | 2 (07 s.30) | `Filter.SearchGeometry` | 2 | equal |
| Search queries | `SearchJsonQuery` (V1) | 14 (09 s.7.2) | none | 0 | not modelled (V1) |
| Aggregations | `AggregationV2` | 8 (07 s.6) | `Aggregation.Aggregation` | 8 | equal |
| Aggregations | `AggregationGroupByV2` | 4 (07 s.6) | `Aggregation.GroupBy` | 4 | equal |
| Aggregations | `Aggregation` (V1) | 6 (07 s.6) | none | 0 | not modelled (V1) |
| Aggregations | `AggregationGroupBy` (V1) | 4 (07 s.6) | none | 0 | not modelled (V1) |
| Aggregations | `DerivedPropertyDefinition` | 11 (07 s.9) | `DerivedProperty.DerivedProperty` | 11 | equal |
| Aggregations | `SelectedPropertyOperation` | 11 (07 s.9) | `DerivedProperty.SelectedPropertyOperation` | 11 | equal |
| Actions and edits | `ActionParameterType` | 22 (07 s.5.2) | `Action.ActionParameterType` | 22 | equal |
| Actions and edits | `OntologyDataType` | 23 (08 s.5.2) | `Action.OntologyDataType` | 23 | equal |
| Actions and edits | `LogicRule` | 9 (07 s.5.3) | `Action.ActionOperation` | 9 | equal |
| Actions and edits | `ActionLogicRule` | 14 (07 s.5.3) | `Action.ActionLogicRule` | 14 | equal |
| Actions and edits | `LogicRuleArgument` | 8 (07 s.5.3) | `Action.LogicRuleArgument` | 8 | equal |
| Actions and edits | `ActionResults` | 2 (07 s.30) | `Action.ActionEdits` | 2 | equal |
| Actions and edits | `ObjectEdit` | 5 (08 s.16) | `Action.ObjectEdit` | 5 | equal |
| Actions and edits | `BatchActionObjectEdit` | 3 (08 s.16) | `Action.BatchObjectEdit` | 3 | equal |
| Actions and edits | `BatchActionResults` | 2 (07 s.30) | `Action.BatchActionEdits` | 2 | equal |
| Actions and edits | `TransactionEdit` | 5 (08 s.16) | none | 0 | not modelled (transaction edits) |
| Actions and edits | `EditHistoryEdit` | 3 (07 s.5.6) | none | 0 | not modelled (edit history) |
| Actions and edits | `ActionTypeSearchJsonQueryV2` | 23 (07 s.5.7) | none | 0 | not modelled (action-type search) |
| Validation | `ParameterEvaluatedConstraint` | 11 (08 s.15) | `Action.EvaluatedConstraint` | 11 | equal; OSDK's own copy has 9 |
| Validation | `StructFieldEvaluatedConstraint` | 5 (08 s.2) | `Action.StructFieldConstraint` | 5 | equal |
| Validation | `ParameterAllowedValues` | 8 (08 s.15) | `Action.AllowedValues` | 8 | equal |
| Queries | `QueryDataType` | 26 (09 s.9.1) | `Query.QueryDataType` | 26 | equal; OSDK's own union has 13 variants |
| Queries | `QueryAggregationKeyType` | 7 (09 s.9.2) | `Query.QueryAggregationKeyType` | 7 | equal |
| Queries | `QueryAggregationRangeSubType` | 4 (09 s.9.2) | `Query.QueryAggregationBoundType` | 4 | equal |
| Queries | `QueryAggregationValueType` | 3 (09 s.9.2) | `Query.QueryAggregationValueType` | 3 | equal |
| Value types | `ValueTypeFieldType` | 18 (09 s.10.1) | `ValueType.ValueTypeFieldType` | 18 | equal |
| Value types | `ValueTypeConstraint` | 9 (09 s.10.2) | `ValueType.ValueTypeConstraint` | 9 | equal |
| Subscriptions | `StreamMessage` | 4 (09 s.14) | `Subscription.StreamMessage` | 4 | equal |
| Subscriptions | `LinksMessage` | 4 (08 s.20) | `Link.LinkStreamMessage` | 4 | equal |
| Subscriptions | `ObjectSetSubscribeResponse` | 3 (09 s.14) | `Subscription.SubscribeResponse` | 3 | equal |
| Subscriptions | `ObjectSetUpdate` | 2 (09 s.14) | `Subscription.ObjectSetUpdate` | 2 | equal |
| Subscriptions | `SubscriptionClosureCause` | 2 (09 s.14) | `Subscription.SubscriptionClosureCause` | 2 | equal |
| Subscriptions | `ReferenceValue` | 1 (09 s.14) | `Subscription.ReferenceValue` | 1 | equal |
| Media | `MediaItemMetadata` | 10 (02 s.2.4) | `Media.MediaItemMetadata` | 10 | equal; OSDK types 9 and sends `cad` to `unknown` |
| Media | `MediaTransformation` | 18 (02 s.3.2) | `Media.MediaTransformation` | 18 | equal |
| Media | operations across the 18 operation unions | 46 (00 ledger U, OSDK's count) | the 18 `Media.*Operation` unions | 48 | superset; local has the wire's 4 `ImageToTextOperation` cases, OSDK has 2; the maps state no wire total |
| Time series | `TimeRange` | 2 (09 s.15) | `TimeSeries.TimeRange` | 2 | equal |
| Time series | `TimeSeriesAggregationStrategy` | 3 (09 s.15) | `TimeSeries.TimeSeriesAggregationStrategy` | 3 | equal |
| Time series | `TimeSeriesRollingAggregateWindow` | 2 (09 s.15) | `TimeSeries.RollingWindow` | 2 | equal |
| Time series | `TimeSeriesAggregationMethod` (literals) | 11 (09 s.1.1) | `TimeSeries.TimeSeriesAggregationMethod` | 11 | equal |
| Time series | `TimeUnit` (literals) | 9 (09 s.2.1) | `TimeSeries.TimeUnit` | 9 | equal |
| Time series | `RelativeTimeSeriesTimeUnit` (literals) | 8 (09 s.2.1) | `TimeSeries.SeriesTimeUnit` | 8 | equal |
| Time series | `PreciseTimeUnit` (literals) | 6 (09 s.2.1) | `TimeSeries.PreciseTimeUnit` | 6 | equal |
| Formatting | `PropertyValueFormattingRule` | 5 (09 s.6) | `ValueFormat.ValueFormat` | 5 | equal |
| Formatting | `PropertyNumberFormattingRuleType` | 9 (09 s.18.3) | `ValueFormat.NumberFormat` | 9 | equal |
| Formatting | `DatetimeFormat` | 2 (07 s.30) | `ValueFormat.DatetimeFormat` | 2 | equal |
| Formatting | `DatetimeTimezone` | 2 (07 s.30) | `ValueFormat.DatetimeTimezone` | 2 | equal |
| Formatting | `DurationFormatStyle` | 2 (07 s.30) | `ValueFormat.DurationFormatStyle` | 2 | equal |
| Formatting | `PropertyTypeReferenceOrStringConstant` | 2 (07 s.19) | `ValueFormat.PropertyOrConstant` | 2 | equal |
| Cross-cutting | distinct type tags across the five data-type unions | 44 (08 s.5.3) | `DataType.DataTypeKind` | 44 | equal |
| Cross-cutting | `GeoJsonObject` | 9 (09 s.1.2) | `Geo.GeoJsonObject` | 9 | equal |
| Cross-cutting | `DistanceUnit` (literals) | 9 (09 s.18.3) | `Geo.DistanceUnit` | 9 | equal; OSDK's alias table reaches 8 |
| Cross-cutting | agent `DataType` | 16 (06 s.2.2) | `Agent.AgentDataType` | 16 | equal |

58 wire unions or literal domains are modelled; 58 have at least the wire's member count and 0 fall short.
6 wire unions in the same families are not modelled at all (V1 search and aggregation, transaction edits, edit
history, action-type search). The package does not claim them, and README section 7 does not list them either.

## 3. Totals per disposition

**(superseded 2026-11-12)** The table and the three notes below describe the package before the fix wave. The
status section at the top of this file has the recomputed totals.

| Disposition | Rows | Symbols | `@osdk/api` (211) | `unstable` (91) | `shapes-internal` (8) |
| --- | --- | --- | --- | --- | --- |
| ported | 54 | 173 | 135 | 33 | 5 |
| redesigned | 30 | 59 | 27 | 32 | 0 |
| subsumed | 25 | 43 | 28 | 13 | 2 |
| rejected | 10 | 13 | 9 | 3 | 1 |
| MISSING (declared) | 7 | 12 | 5 | 7 | 0 |
| MISSING (undeclared) | 7 | 10 | 7 | 3 | 0 |
| **Total** | **133** | **310** | **211** | **91** | **8** |

Read with care:

- 288 of 310 symbols (93%) have a local home. That figure overstates the port for a user, because 28 of the
  non-MISSING rows (48 symbols) carry a shortfall: the symbol's data is here and part of what it did is not.
- The 22 MISSING symbols are few because OSDK concentrates a capability in one exported name and hangs many helper
  types off it. `ActionDefinition` and `QueryDefinition` are two symbols; they are also every typed action and
  function call an OSDK application makes.
- Nothing is MISSING on the data side. Of the 64 wire unions and literal domains listed in section 2, 58 are
  modelled and none falls short of the wire's member count; 6 are not modelled (V1 search, V1 aggregation, V1
  group-by, transaction edits, edit history, action-type search).

## 4. What is missing, ranked by how much an OSDK user would feel it

Each entry: the symbols and their ledger rows, whether README section 7 admits it, what the user loses, the evidence,
and what closing it takes. MISSING rows and shortfalls are ranked together, because a user feels a shortfall in a
central symbol more than the absence of a peripheral one.

**(superseded 2026-11-12: built; what is left is item 7 of the re-ranked list in the status section.)**
**G1. Typed actions.** MISSING, undeclared. `ActionDefinition` (row 7); static halves of `ActionParam` (6),
`ActionReturnTypeForOptions` (1), `AgentDefinition` / `AgentParam` (95, 96).
OSDK: `client(createEmployee).applyAction({ name, office })`, parameters checked by the compiler. Here: load the
ontology, look the `ActionType` up, build a `Record<string, unknown>`, encode it with `Action.argumentsCodec`, wrap
it in `ApplyActionRequest`, call the raw port. Nothing is checked before runtime and there is no facade.
Evidence: `src/Action/Action.behavior.ts:253` returns `S.Codec<Readonly<Record<string, unknown>>, ...>`; `:166`
`argumentCodec` returns `S.Codec<unknown, unknown>`; `src/Client/Client.behavior.ts` exports only `fetchPage` (166),
`stream` (263), `fetchOne` (360), `count` (418), `aggregate` (517); `rg -c '^export (const|function) (action|applyAction|validateAction)\b' src/Model src/Client/Client.behavior.ts` = 0.
`Faux.layer` also refuses `applyActionBatch` (`src/Faux/Faux.layer.ts:305`).
To close: an action spec in `Model` built like `Model.object` (a record of parameter specs mapped to a struct
schema, no conditional types), and `Client.applyAction(model, arguments, options)` / `Client.validateAction`.

**(superseded 2026-11-12: built; what is left is item 7 of the re-ranked list in the status section.)**
**G2. Typed queries.** MISSING, undeclared. `QueryDefinition` (row 79); static halves of `QueryParam`, `QueryResult`
(82). Same loss for function calls: `Query.parametersCodec` is `Codec<Record<string, unknown>>` and `outputCodec`
is `S.Codec<unknown, unknown>` (`src/Query/Query.behavior.ts:386`, `:440`), and no `Client.executeQuery` exists
(`rg -c '^export (const|function) (query|executeQuery)\b' src/Model src/Client/Client.behavior.ts` = 0).
To close: `Model.query({ apiName, version, parameters, output })` and `Client.executeQuery(model, parameters)`.

**G3. Interface-typed models and `$as`.** MISSING, declared (README section 7, first bullet).
`InterfaceDefinition` (74), `ConvertProps` (62); shortfall in `ObjectOrInterfaceDefinition` (76) and `Osdk` (61).
A user cannot read through an interface with types, nor convert an instance between an object type and an
interface. The untyped algebra has it (`ObjectSet.interfaceType`, `narrowTo`, `InterfaceType`), and
`Faux.evaluateObjectSet` evaluates `interfaceBase` and `asType`; the typed layer and the multi-type load response
are absent (`rg -c MultipleObjectTypes src` = 0).

**G4. Live subscriptions.** Shortfall, declared. `ObjectSet.subscribe` (66), `ObjectSetSubscription` (67),
link subscriptions (105), no-type subscribe (106). The protocol is complete as schemas (`StreamMessage` 4 of 4,
`LinkStreamMessage` 4 of 4); nothing opens a socket (the only "websocket" in `src` is in two schema descriptions).

**G5. Media reads, and attachment metadata by RID.** MISSING, undeclared. `Media`, `MediaMetadata`,
`MediaFullMetadata`, `MediaPropertyLocation` (40); shortfall in `Attachment` (37) and `MediaUpload` (42).
README section 7 names "media upload and transformation flows"; it does not say that media cannot be READ.
`OntologyTransport` has 10 members (`src/Client/Client.service.ts:113-167`) and `OntologyApi` has 10 routes
(`src/Api/Api.definition.ts:127-220`); none touches media, and the attachment routes are upload and content only,
so `Attachment.fetchMetadata()` has no counterpart although `AttachmentMetadata` is modelled.
`rg -c '(?i)media/|mediaset' src/Api src/Client` = 0.

**G6. Time-series reads.** MISSING, declared. `TimeSeriesProperty`, `GeotimeSeriesProperty` (87). The request and
response schemas exist (`StreamPointsRequest` at `src/TimeSeries/TimeSeries.model.ts:950`); no member reads a series.

**G7. Aggregations and derived properties in the typed layer.** `AggregationsResults` (13) MISSING, declared;
shortfalls in the result rows (12), `DerivedProperty` (83), `SimplePropertyDef` (30), all declared; and one
undeclared shortfall in `ValidAggregationKeys` (9): the tables `allowedMetrics` and `allowedGroupings`
(`src/Aggregation/Aggregation.policy.ts:73`, `:164`) are read by nothing. No `checkAggregation` exists, `Faux` does
not consult them, and `Model` has no typed metric constructor, so `sum` over a string property is neither a compile
error nor a finding (`rg 'allowedMetrics|allowedGroupings|metricsFor|groupingsFor' src` matches only the policy
file). Filters, by contrast, have both `Model.filter` types and `Filter.checkFilter`.

**G8. Instance conveniences.** Shortfall, partly declared. `Osdk` (61), `OsdkObjectLinksObject` /
`SingleLinkAccessor` (70), the formatting rules (89). **(superseded 2026-11-13 in the next sentence: an instance
is `{ locator, rid, title, score, properties, undeclared }`, built by `Object.InstanceOf`; see the F6 subsection of
the status section)** An instance is `{ objectType, rid, title, score, properties }`
(`src/Model/Model.object.ts`). There is no `$link` (follow a link from one object), no `$clone`, no typed
`$propertySecurities` (README sharp edges: such a record does not decode with `Instance`), no formatted value
(declared: "Rendering"). Following a link from one object is possible by composition (`Model.where(Model.eq(key,
value))`, `Model.traverse`, `Client.fetchOne`); a fetch-by-key helper is declared absent.

**G9. Media transformation flow and its errors.** MISSING, declared. `transformAndWait`, `TransformOptions` (107),
the three `MediaTransformation*Error` classes (109). The algebra is complete (18 of 18 transformations, 48
operations); the job request, job record and polling defaults exist; nothing submits or polls, and no error class
exists for a failed or timed-out job (`rg -c 'TaggedError|extends Error' src/Media` = 0). The agent timeouts, whose
flow is equally unbuilt, do exist, so the omission is uneven rather than principled.

**G10. Shapes: typed results, link loading, source-key placeholder.** `ShapeInstance` (119) MISSING, undeclared;
`LinkStatus` (122) MISSING, undeclared; `SourcePrimaryKeySymbol`, `isSourcePkSymbol` (124) MISSING, declared;
shortfalls in rows 117 and 120. OSDK's point with shapes is the static result type (`require` gives non-null,
`withTransform` gives the transform's result). Here `applyShape` maps `Readonly<Record<string, unknown>>` to
`Readonly<Record<string, unknown>>` (`src/Shape/Shape.behavior.ts:468-470`, `:600`), `Shape.shape` takes a string,
and a `Shape` has no type parameter, so a misspelt property name is not caught. Nothing loads a shape's derived
links (`toObjectSet` only builds the set), so a derived link that must filter on its source's key cannot be written.

**G11. Streaming function execution.** MISSING, undeclared. `executeStreamingFunction` (102). The stream's events
are modelled (`QueryStreamEvent`, `src/Query/Query.model.ts:1428`); `executeQuery` is request / response only.

**G12. Cipher text.** `UpdateCipherText` (35) MISSING, undeclared; shortfalls in `CipherText` (33) and
`CipherChannelStrategy` (32). `decrypt()` cannot run (`rg -ci decrypt src/Api src/Client` = 0, although
`DecryptionResult` is modelled at `src/CipherText/CipherText.model.ts:294`), and the strategy kit (`:81`) is
referenced by no schema: `EncryptionRequest` (`:232`) carries `plaintext` only.

**G13. Agent polling.** Shortfall, declared. `AgentSession` (97), the option records (99), the timeouts (100).
The two timeout errors are defined and never raised (`rg 'AgentStateTimeout|AgentEventTimeout' src` matches only
`Agent.behavior.ts`).

Minor shortfalls, not ranked: no create / update value tables for function-backed edits (row 24);
`OntologyMetadata.userAgent` dropped and no user-agent header (78); bulk links are one page per call with no stream
(104).

What is NOT a gap, although README section 7 lists it: by-RID fetches (row 103) and inline object-set arguments
(rows 6, 82). See section 5.

## 5. README claims the ledger contradicts

**(superseded 2026-11-12)** Every claim listed in this section has since been settled in the README or in the
code; the status section at the top of this file says how.

### Section 7 ("What it does not do")

1. **"by-RID fetches" are listed as not built (README line 513). They exist.** `ObjectSet.objects(rids)`
   (`src/ObjectSet/ObjectSet.behavior.ts:151`) is the wire's `static` object set, and the package's own test does a
   typed by-RID read through the client facade: `test/Faux.test.ts:760-768`
   (`fetchPage(Employee, ObjectSets.objects([adaRid, ...]), FetchOptions.make({ includeRid: true }))`, asserting the
   row and its RID). `fetchOneByRid`, `fetchPageByRid` and the no-type form are therefore subsumed (ledger row 103).
   Only a named helper is absent.
2. **"an object set passed inline as an action or query argument (those codecs take an object set RID). Both carry
   a `crispen:` note in the source" (README lines 520-521). False on both counts.**
   `ObjectSetArgument = S.Union([ObjectSetRid, ObjectSet])` (`src/ObjectSet/ObjectSet.model.ts:904`) accepts an inline
   definition; `Action.argumentCodec` uses it (`src/Action/Action.behavior.ts:122`, `:187`) and so does
   `Query.valueCodec` (`src/Query/Query.behavior.ts:225`, `:227`); `test/Arguments.test.ts:195-213` (the law
   `objectSetArgumentLaw`, run for each argument universe) and `:1487-1494` decode and re-encode an inline `filter`
   object set as an argument, a query parameter and a query output.
   `rg -n 'crispen:' src` finds three notes: precision and scale twice (`Property.behavior.ts:80`,
   `Action.behavior.ts:172`) and the map encoding (`Action.behavior.ts:117`). None is about object sets.
3. **Section 7 reads as the list of what is not built, and it is silent on these absences** (all verified above):
   typed actions and typed queries, and any client facade for them (G1, G2); reading media content and metadata, and
   attachment metadata by RID (G5; the bullet on running services names media upload and transformation only);
   cipher text decryption and `UpdateCipherText`'s strategy (G12); streaming function execution (G11); typed shape
   results and `LinkStatus` (G10); validation of an aggregation request against the metric and grouping tables (G7);
   the media transformation error classes (G9). The six unmodelled wire unions of section 2 are also unlisted.
   These are omissions, not false statements, but a reader who takes section 7 as the boundary of the port will
   place actions and queries inside it.

### Section 6 ("What it does better")

No row of section 6 is contradicted by the ledger. Two rows were checked because the ledger depends on them and
both hold: "All nine wire distance units are constructible" (`Geo.DistanceUnit` has 9 literals, counted at runtime),
and "Validation returns every problem, not the first: ontology, filter, object set, derived property, shape"
(`applyShape` separates and merges every rejection, `src/Shape/Shape.behavior.ts:600`). Note what that row does not
list: aggregations, which have tables and no validator (G7).

### Adjacent claims in sections 3 and 5 that the same evidence contradicts

- Section 5, row "`AGG_FOR_TYPE`, `GroupByMapper`": the tables are described as "data that validators and builders
  read at runtime". No validator or builder in `src` reads `allowedMetrics`, `allowedGroupings` or `durationUnits`.
- Section 3, "Replaces" column: `Aggregation` is said to replace `AggregationsResults`, which section 7 says is not
  computed; `Action` to replace `ActionParam.*` and `Query` to replace `QueryParam.*`, `QueryResult.*`, which are
  static type helpers replaced by codecs typed `unknown`; `Subscription`, `Link` to replace
  `ObjectSetSubscription.*`, `LinkSubscription.*`, whose listener side has no successor. "Replaces" is true of the
  runtime half only in each case.
- Section 8 reports 32 test files and 3,628 tests. On 2026-11-12 20:51 the run printed 33 files and 3,637 tests, all
  passing; the difference is scratch files that parallel reviewers added under `test/` (`_wireRuntime.scratch.test.ts`).

## 6. How this ledger was checked

- The 310 symbols were extracted from the census tables and every one is covered by exactly one row (script
  assertion; 133 rows).
- Every local target was resolved to an `export` line in the named file (0 unresolved in the final run; the line
  numbers in section 1 are those export lines).
- Every proof names a test that imports the target from its concept folder and uses it outside the import, or a
  doctest in the target's JSDoc. No row with a local target is without one.
- Every absence was checked with the `rg -c` command quoted in its row, run from `scratchpad/osdk`; all return 0.
- Local member counts in section 2 were read from the live modules under bun.
- Package state while this was written (2026-11-12, about 20:51 to 20:55 local):
  - `bunx --bun vitest run --config osdk/vitest.config.ts`: `Test Files 33 passed (33)`, `Tests 3637 passed (3637)`.
  - `BEEP_VITEST_DOCTEST=1 bunx --bun vitest run --config osdk/vitest.config.ts`: `Test Files 71 passed (71)`,
    `Tests 651 passed (651)`.
  - `./node_modules/.bin/tsrs -p scratchpad/osdk/tsconfig.json --noEmit --pretty false`: one error, in a parallel
    reviewer's scratch file (`scratchpad/osdk/test/_wireConformance.scratch.test-d.ts(134,41)`, TS2344 on
    `DicomDataElementKey`), none in `src` or in the package's own tests.

## 7. After the fix wave (2026-11-12, consistency and wire-leniency fixer)

This section is appended; no row above was rewritten. It records what one of the four parallel fixers changed that
moves a row, a gap or a claim of this ledger. Line numbers are those of 2026-11-12, about 21:40 local.

### Gaps closed or narrowed

- **G7, the undeclared half (row 9, `ValidAggregationKeys`).** The tables are now read.
  `Aggregation.checkAggregation(request, properties)` (`src/Aggregation/Aggregation.policy.ts:591`) holds the metrics
  and groupings of a request to `allowedMetrics`, `allowedGroupings` and `durationUnits` and returns an
  `AggregationViolation` (`:450`, four cases: `unknownProperty`, `metricNotAllowed`, `groupingNotAllowed`,
  `durationUnitNotAllowed`). It takes anything that carries `aggregations` and `groupBy`, so both request envelopes
  are checked by it. `test/Aggregation.test.ts:1626` holds it, with two property laws that tie the validator to the
  tables for every property type. Still open: `Client.aggregate` does not call it, `Faux` does not consult the
  tables, and `Model` has no typed metric constructor (README section 7 says so). `AggregationsResults` (row 13)
  is unchanged: declared missing.
- **Section 5, "adjacent claims", first bullet** (the tables are "data that validators and builders read at
  runtime"): now true of a validator; the README row names `checkAggregation`.
- **Row 78 (`OntologyMetadata`) and the `getFullMetadata` route.** The route declares the wire's
  `includeActionTypeFullMetadata` and `includeDatasources` query parameters (`src/Api/Api.definition.ts:136`), the
  port's `loadOntology` takes an optional `OntologyInclusions` (`src/Client/Client.service.ts:117`,
  `src/Ontology/Ontology.model.ts:522`), and `test/Api.test.ts` pins the exact query string. `preview` on that
  route stays undeclared (OSDK does not send it); `userAgent` is still dropped.
- **Section 5, section 7 items 1 and 2** (by-RID fetches listed as absent; inline object-set arguments said to be
  impossible): both sentences are gone from the README.
- **Section 5, section 7 item 3** (silent absences): README section 7 now lists media and attachment-metadata
  reads (G5), cipher text decryption and update (G12), streaming function execution (G11), typed shape results
  and link load state (G10) and the six unmodelled wire unions of section 2. Typed actions and queries (G1, G2)
  are not listed as absent: another fixer built `Model.action`, `Model.query` and the `Client` operations in the
  same wave, and README section 3 carries one row for them.
- **Section 5, "Replaces" column of README section 3**: the four cells (`Aggregation`, `Action`, `Query`,
  `Subscription` / `Link`) now claim the runtime half only.

### Wire conformance: absent collections

One rule, stated in README section 4: a wire-required array or record that a saved document may leave out
decodes as the empty collection and is always written on encode (`S.withDecodingDefaultKey` plus the constructor
default). It now holds for every collection of `ObjectTypeDefinition` (4), `InterfaceImplementation` (4),
`InterfaceType` (9) and `OntologyDefinition` (7), and for `VectorType.supportsSearchWith`.
`OntologyDefinition.actionTypeDefinitions` (wire `actionTypesFullMetadata`) changed from an `Option` that encoding
omitted to a record that encoding always writes, as wire 2.87 requires the key.

Evidence, from the nine `ontology.json` documents under `osdk-ts/packages` (probe run on 2026-11-12, after the
change, with every issue collected): no decode failure that remains in any of the nine is a missing collection. Three documents decode whole (`e2e.sandbox.officeassignment`, `e2e.sandbox.officenetwork`,
`e2e.sandbox.peopleapp`); the other six stop at a wire-required scalar that the document leaves out (`rid` on a
property 281 times, `displayName` on an action parameter 79, `required` on a query parameter 51, `linkTypeRid` 18,
and nine rarer keys). Those are not collections and were left alone; README section 7 states it.
`test/Ontology.test.ts:1023` transcribes three real fragments (the people app's `ExampleObjects` with its
interface as a trimmed document, and `NihalbCastingObjectTypeA` with its interface from `e2e.generated.catchall`)
and asserts the defaults and the canonical re-encoding.

### Naming: one literal rule

README section 4 states it: the domain literal of a mapped enum is the lowerCamel form of the wire word, nothing
else. Renamed to follow it (wire word, old literal, new literal):

| Enum | Wire | Was | Is |
| --- | --- | --- | --- |
| `Filter.RelativeDateUnit` | `DAY`, `WEEK`, `MONTH`, `YEAR` | `days`, `weeks`, `months`, `years` | `day`, `week`, `month`, `year` |
| `DerivedProperty.DatePart` | `DAYS`, `MONTHS`, `QUARTERS`, `YEARS` | `day`, `month`, `quarter`, `year` | `days`, `months`, `quarters`, `years` |
| `Filter.TextAnalyzer` | `BASE_ANALYZER`, `PHONETIC_ANALYZER` | `base`, `phonetic` | `baseAnalyzer`, `phoneticAnalyzer` |
| `Action.ReturnEditsMode` | `ALL_V2_WITH_DELETIONS` | `allWithDeletions` | `allV2WithDeletions` |
| `ValueFormat.NumberRoundingMode` | `ROUND_CLOSEST` | `nearest` | `roundClosest` |
| `ValueFormat.DatetimePreset` | `DATE_FORMAT_*` (7) | `relativeToNow`, `date`, `yearAndMonth`, `dateTime`, `dateTimeShort`, `time`, `isoInstant` | `dateFormatRelativeToNow`, `dateFormatDate`, `dateFormatYearAndMonth`, `dateFormatDateTime`, `dateFormatDateTimeShort`, `dateFormatTime`, `dateFormatIsoInstant` |
| `ValueFormat.KnownType` | `USER_OR_GROUP_ID`, `RESOURCE_RID`, `ARTIFACT_GID` | `userOrGroup`, `resource`, `artifact` | `userOrGroupId`, `resourceRid`, `artifactGid` |

`test/LiteralRule.test.ts` walks every mapped enum the package exports (68 enums, 258 pairs at the time of
writing) and holds each pair to the rule. Three literals still deviate, all in `src/DataType/DataType.values.ts`, which this fixer did
not own: `VectorSimilarity` `COSINE_SIMILARITY` -> `cosine`, `EUCLIDEAN_DISTANCE` -> `euclidean`, and
`HostedEmbeddingModel` `OPENAI_TEXT_EMBEDDING_ADA_002` -> `openAiTextEmbeddingAda002` (the rule gives
`openaiTextEmbeddingAda002`). The test names them as known deviations and fails on any other.

### Rows whose local target moved

- Rows that cite `Action.model.ts` for `AnyType`, `ObjectTypeParameterType` or `ScenarioReferenceType`: the three
  classes were deleted there (REVIEW F8) and the kernel's `AnyType`, `ObjectTypeReferenceType` and
  `ScenarioReferenceType` (`src/DataType/DataType.model.ts`) are used instead.
- `Page` (`PageRequest`, `Page(identifier, item)`) now has consumers (REVIEW F9): `LoadObjectsRequest` and
  `FetchOptions` take both paging arguments from `PageRequest.fields` (`src/Client/Client.model.ts:217`),
  `LoadLinksRequest` takes its cursor from them (`src/Link/Link.model.ts:297`), and `LoadObjectsResponse` spreads
  the fields of `Page("ObjectPage", OntologyObject)` and declares `totalCount` again as required (`:440`, `:490`).
  `LinkPage` keeps its own `nextPageToken`: its `data` is a codec, not an array of items, and its wire has no
  count. `test/Page.test.ts` is new and holds `PageToken`, `PageSize`, `TotalCount`, `PageRequest` and `Page`.
- The private selector resolution of `Filter.policy.ts` moved to `Property.selectedType`
  (`src/Property/Property.behavior.ts:211`), which the filter check and the aggregation check now share.
- Line numbers in section 1 that point into `ObjectType.model.ts`, `InterfaceType.model.ts`, `Ontology.model.ts`,
  `Aggregation.policy.ts`, `Filter.policy.ts`, `Property.behavior.ts`, `Client.model.ts`, `Link.model.ts` and
  `Action.model.ts` have shifted by the lines added or removed; the export names are unchanged except as listed
  here.

### Law gate

`bun run beep laws terse-effect --check --include <every src file this fixer owned>` exits 0 (REVIEW F11): the
16 findings were fixed by hand (helper references for thunks, one `flow`, two nested `Option.match`es flattened).
Files under `src/Model`, `src/Media`, `Client.behavior.ts`, `Client.operations.ts`, `DataType.values.ts` and
`Value.model.ts` were not in that run.
