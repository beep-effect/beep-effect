# REVIEW: laws, consistency and elegance lens

## Status after the fix wave (2026-11-12)

Written by the last writer of the fix wave, after the code was finished. Each row was decided by reading the
code and running it on 2026-11-12, not by taking a fixer's report. Line numbers are those of that day.
Everything below the rule at the end of this section is the review as it was written before the fix wave; no
line of it was changed, so its counts and line numbers describe the package as it was then (105 source files,
32 test files, 3,628 tests).

Second fix wave, stage F4, later on 2026-11-12: the F4 row, the counts, the package state and the closing
paragraph of this section were rewritten after that stage, by the agent that did it, from the code as it then
stood. Rows F16 and F18 were corrected where the stage changed the fact they state. The other rows are as the
first writer left them; where they cite a line of a file the stage edited (`Value.model.ts`, `Object.model.ts`,
`Object.behavior.ts`, `Property.behavior.ts`, `Filter.model.ts`, `Filter.policy.ts`, `Filter.behavior.ts`,
`Model.filter.ts`, `Faux.behavior.ts`, `Aggregation.model.ts`, `Query.model.ts`, `ValueType.model.ts`,
`Identifier.model.ts`, `Client.model.ts`, `Agent.model.ts`, `Api.definition.ts`, `Link.model.ts`), the line is
that of the first writing.

Second fix wave, stage F5, 2026-11-13: the F5 row, the counts, the package state and the closing paragraph of
this section were rewritten after that stage, by the agent that did it, from the code as it then stood. The
`@ts-expect-error` census in the notes below was brought up to date. The stage edited `DataType.values.ts`, `Value.model.ts`, `Property.behavior.ts`,
`Action.behavior.ts`, `Query.behavior.ts`, `Agent.behavior.ts`, `Model.spec.ts`, `Model.action.ts`,
`Model.query.ts` and `Model.policy.ts` and added `Value.behavior.ts`; where another row cites a line of one of
them, the line is that of the earlier writing.

Second fix wave, stage F6, 2026-11-13: the F6 row, the counts, the package state and the closing paragraph of
this section were rewritten after that stage, by the agent that did it, from the code as it then stood. Row F9
was corrected where the stage changed the fact it states (and the pointer of row F4 into README section 4,
which is no longer the last item of that list), and the `@ts-expect-error` census in the notes below
was brought up to date. The stage edited `Object.model.ts`, `Object.behavior.ts`, `Model.spec.ts`,
`Model.object.ts`, `Model.set.ts`, `Client.model.ts`, `Client.behavior.ts`, `Client.errors.ts`,
`Client.service.ts`, `Api.definition.ts`, `Faux.behavior.ts` and `Faux.layer.ts`; where another row cites a line
of one of them, the line is that of the earlier writing.

Repair after the review of that wave, 2026-11-13: every `file:line` in rows F4, F5 and F6 was resolved again
from the code as it stands, by script, so those three rows cite the current tree (rows F4 and F5 had kept the
lines of their own stage, and row F4 named a schema, `FlatObject`, that stage F6 renamed `ObjectRecord`).
`Model.struct` now refuses a field with the empty name where the spec is written, as `Model.vector` refuses a
dimension no vector type has, so `Model.typeOf` throws for no spec the constructors build; the F5 row, the doc
of `typeOf` and README section 4 say total over those specs. The sizes below were measured again. No count of
findings changed.

Counts: 13 fixed, 1 partly fixed, 9 open (all minor). Of the twelve majors, F1, F2, F3, F4, F5, F6, F8, F9,
F10, F11 and F12 are fixed and F7 is partly fixed. Of the eleven minors, F13 is fixed in
the README and F15 is fixed by stating the two transformations in the README; F18 is half done by the F4 stage;
the other eight were not touched.

| # | Sev | Status | Evidence |
| --- | --- | --- | --- |
| F1 | major | fixed | A filter knows its model. `PropertyReference` carries `owner` as data (`src/Model/Model.object.ts:121`); the typed constructors return `TypedFilter`, the pair `{ owner, filter }` (`src/Model/Model.filter.ts:384`); `Model.and`, `Model.or`, `Model.not` keep the owner (`:1288`, `:1328`, `:1362`); `Model.where` takes `TypedFilter<Owner>` for a `TypedObjectSet<Model extends ObjectModel<Owner>>` (`src/Model/Model.set.ts:127`); `Model.orderBy` and `Model.thenBy` take a reference of the set's model with an ordered tag and return an `OrderedObjectSet` (`:385`, `:444`, `:339`). Held by `staticGuarantees` in `test/Model.object.test.ts` (the `@ts-expect-error` lines at 687-747: a filter over Office properties does not filter Employee objects, a geopoint has no order, an Office property does not order Employee objects) and by README block (c). |
| F2 | major | fixed | `Client.fetchPage`, `stream` and `fetchOne` take `(set, options)`; the model is read from the set (`src/Client/Client.behavior.ts:202`, `:286`, `:373`, `InstanceSet` at `:88`). Held by `staticGuarantees` in `test/Client.test.ts` (the `@ts-expect-error` lines at 1232-1256: a read takes one typed set, not a model and an object set) and by README block (f), which pipes the set into the read. |
| F3 | major | fixed | By the first of the two fixes offered: the narrowing is not available outside the key. `ObjectModelDefinition` requires the `"required"` presence under `primaryKey` and the `"optional"` presence for every other spec (`src/Model/Model.object.ts:153`); `Model.struct` takes optional specs only (`src/Model/Model.spec.ts:667`). `Model.required` stays exported (`:715`) and its documentation says where it is accepted. Held by `test/Model.object.test.ts:756-799` ("only the primary key may be required", "a struct field can be absent") and `test/Model.test.ts:575` ("struct accepts optional field specs only: a required field is a compile error"). No `presenceMismatch` finding was added; none is needed. |
| F4 | major | fixed | The rule is one sentence (README section 4, the item that begins with the same words): the tier that knows a property's type carries the rich value, the tier that does not carries the wire scalar, and no schema claims a `Type` it cannot decode to. `ScalarValue` is `S.Union([S.String, S.Finite, S.Boolean])` (`src/Value/Value.model.ts:753`), so `Type` = `Encoded` = `string \| number \| boolean`; `PrimaryKeyValue` is that union under its own identifier (`src/Object/Object.model.ts:86`), and the two places that had a private copy of it, `ObjectRecord` (`:466`) and `Link.model.ts:107`, read it. `GroupDefaultValue`, which took any scalar and decoded text, is text (`src/Aggregation/Aggregation.model.ts:610`). The projection the old doc promised exists: `Property.operandType(type)` (`src/Property/Property.behavior.ts:182`) says what an operand is compared with (an array's innermost element type, else the type itself) and `Property.operandCodec(type)` (`:235`) is `ScalarValue` composed with `valueCodec` of that type; `Filter.operandsOf` (`src/Filter/Filter.policy.ts:542`) and the in-memory transport read the same `operandType`. `Faux`'s `decodeOperand` is one decode through `operandCodec` (`src/Faux/Faux.behavior.ts:223`; `encodeScalar` is gone), and comparison, equality and membership on an array property now test its elements, as the operator table says. The typed constructors take `Value["Type"]` of a reference whose codec is bounded by `S.Codec<unknown, ScalarValue>` and write the wire scalar with that codec (`wireOperand`, `src/Model/Model.filter.ts:414`; `withValue` `:451`, `oneOf` `:635`, `contains` `:685`, which uses the element codec); an operand the codec refuses throws the codec's `SchemaError` with the property name as the issue path. `Object.instanceCodec` keeps the ordinary `ObjectLocator` (wire scalar key) and compares it with the key property in the key's own domain (`src/Object/Object.behavior.ts:200`, `:229`). `OperandFamily` is the three JSON forms and `operandFamily` ends in `Match.exhaustive` (`src/Filter/Filter.policy.ts:435`, `:464-468`). `OntologyIdentifier` is declared once, with its `OntologyRid` member gated by the resource identifier form (`src/Identifier/Identifier.model.ts:588`), and imported by `Client.model.ts:40`, `Agent.model.ts:38` and `Api.definition.ts:77`. Tests: the finding's command, `rg -c '^\s*(wireStable\|lawfulOnTheWire\|fixedPointLawsOf)\(' test`, counted 78 and now finds nothing; every one of those registrations is the strict law of its file and the helpers are deleted. New suites and cases: `operandCodec` (`test/Property.test.ts:1839`: the defining law over all 22 cases, canonical text of each rich scalar, look-through, refusals), "the operand table and operandCodec" (`test/Filter.test.ts:1480`: every operand the codec writes is of a family the table admits; the two places they differ are named), the typed constructors (`test/Model.object.test.ts:1565`, `:1645`: canonical wire text, refusal with the property as path), a rich value refused where a wire scalar is expected, at compile time and on decode (`test/Value.test.ts:1654`, `test/Filter.test.ts:999`, and `@ts-expect-error` rows in the `Object`, `Aggregation`, `ValueType`, `Query`, `Agent` and `Readme` tests), the transport (`test/Faux.test.ts:657`, `:680`) and `OntologyIdentifier` in both directions (`test/Identifier.test.ts:403`). One schema keeps a weaker law for a reason that is not this finding: `ObjectSpecifier` (`src/Object/Object.model.ts:334`) is one string, which spells a number key and a text key alike, so decoding yields a text key; its test states the reason and README section 7 lists it. Not built: a filter-level reader of operands. The only consumer in the package, the in-memory transport, resolves a selector against an object type and not a property table, so the function would have no user. |
| F5 | major | fixed | One keyed table, read by every projection and by the typed specs. `SharedValueKind` (`src/DataType/DataType.values.ts:586`) names the 16 tags every universe reads with the same codec: the 13 scalars and `cipherText`, `mediaReference`, `geoshape`, which were checked to be one codec in every universe that has them (`attachment` is not: `AttachmentReference` for a property, `AttachmentRid` for an argument). `sharedCodec` (`src/Value/Value.behavior.ts:75`) is the rows picked by that kit, `Struct.pick(rows, SharedValueKind.literals)`: a kit tag without a row does not compile and each key keeps its own codec type. Each universe exports `leafCodec`, the shared rows plus its own, picked by the kit of its leaf tags (`Property.behavior.ts:74`, `Action.behavior.ts:100` for both action universes, `Query.behavior.ts:134`), and its projection is `Union.matchOrElse({ ...the types that hold other types }, (leaf) => leafCodec[leaf.type])` (`Property.behavior.ts:116-123`, `Action.behavior.ts:153-160` and `:203-210`, `Query.behavior.ts:271`; `Agent.behavior.ts:105-143` and the aggregation keys, bounds and values of a query, `Query.behavior.ts:169-176`, index `sharedCodec` directly). A tag with neither a handler nor a row is a type error; there is no assertion. `rg -n 'boolean: (\(\) => )?BooleanValue' src` finds one line, the row in `Value.behavior.ts`; it found six before. The vector rule is `VectorOf(dimension)` (`src/Value/Value.model.ts:717`), called by the two projections and `Model.vector`. The spec is one representation: `ValueSpec` is `{ kind, value, shape }` with the tagged `SpecShape` (`src/Model/Model.spec.ts:139`, `:112`); `PropertySpec` (`:212`), `ExchangeSpec` (`:167`, adds `member`) and `ParameterSpec` (`src/Model/Model.action.ts:528`) extend it. `PropertySpec` has no `element`, `fields` or `dimension`; its `shape` is typed by its tag (`PropertyShapes`, `Model.spec.ts:180`), so a spec tagged a vector that states no dimension does not compile. `AnyValueSpec`, `ScalarSpec`, `valueSpec`, `isValueSpec`, both `valueSpecOfParameter` and the private 16-tag `ScalarKind` of `Model.action.ts` are deleted (`rg 'valueSpec\b\|AnyValueSpec\|ScalarSpec' src` = 0): a property spec is admitted to a typed action or query by having `member`, which the leaf constants of the shared tags get by construction (`sharedLeaf`, `Model.spec.ts:269`, takes `LeafKind & SharedValueKind`) and `Model.vector` by `VectorOf`. A leaf constant is `leaf("boolean")`: the tag and `leafCodec[tag]`, with the codec type recovered by indexed access (`Model.spec.ts:265`, `:288`); the leaf specs only an argument has read `Action.leafCodec` the same way (`Model.action.ts:75`, `:91`, `:295`) and `interfaceObjectSetOf` reads `Query.leafCodec` (`Model.query.ts:252`). `Model.typeOf` (`Model.spec.ts:942`) is the projection from a property spec to the `PropertyType` it denotes, total over the specs the constructors build: what no property type could state is refused where the spec is written, a dimension that is not a positive integer by `Model.vector` and a field with the empty name by `Model.struct` (`Model.spec.ts:714`, `:830`), so `typeOf` has no `@throws`; and `conformance` compares `typeOf(spec)` with the served type (`src/Model/Model.policy.ts:390`, `:539`) instead of walking the spec. Tests: `test/Value.test.ts:266` registers, for each of the five universes, "the projection gives each of its N shared tags the row of the shared table" (15, 11, 15, 10 and 9 tags, compared by identity), and `:307` holds every leaf table to the shared rows; `test/Model.test.ts:477` ("leaf specs and the tables they are read from") and `:537` ("typeOf", with the law "Property.valueCodec(typeOf(spec)) and spec.value agree on generated values, for every spec constructor" at `:650`, 25 specs); `test/Operations.test.ts:540` and `:570`. The reconciliation tests of `test/Model.test.ts` and `agree` in `test/Operations.test.ts` still run and now pass by construction for leaves; none was deleted. Left written twice, and listed in README section 7: the rules that compose codecs (array, set, map, struct, nullable) exist once in the projections and once in the typed constructors, and differ for a struct with no fields (the spec drops an undeclared key, the projection refuses it); an action and a query each state the rows of `attachment`, `object`, `objectSet`, `interfaceObject` and `unsupported`, held equal by `test/Operations.test.ts:540`, because `Object` and `ObjectSet` come after `Value` in the dependency order. `Value` now imports `CipherText`, `Geo` and `Media`; README section 3 moved its row below `Media` and the order was re-checked by script (288 imports, 0 to a later row, 0 through a barrel). |
| F6 | major | fixed | Two shapes, one implementation, one decode. `Object.InstanceOf(shape)` (`src/Object/Object.behavior.ts:191`) is the only function that builds an instance codec. It is generic in the struct that reads the properties (`InstanceShape`, `:76`; a property codec is one that needs no service, `PropertyCodec`, `:61`) and decodes the flat wire record to `{ locator, rid, title, score, properties, undeclared }`. `Object.instanceCodec(signature)` (`:437`) is that function at the struct projected from the definitions, and a model's `Instance` is the same call at the struct of its specs (`src/Model/Model.object.ts:272`). The second transformation that file held is deleted: `rg -c 'transformEffect\|decodeIdentity\|encodeIdentity' src/Model/Model.object.ts` counted 5 and now finds nothing. So that a typed model can make the call, `PropertySpec` bounds its two codecs by `PropertyCodec` where it had `S.Top` (`src/Model/Model.spec.ts:212`). The checks are stated once: the object type is a filter on the `locator` field (`Object.behavior.ts:219`), the agreement of `__primaryKey` with the key property, read in the key's own domain, is a filter on the decoded record (`:229`), and an undeclared key that shadows a declared one is refused on encode (`:301`). The typed tier gained what only the dynamic tier had: the ordinary `ObjectLocator` in `locator`, the undeclared keys, and the refusal of a stale `__primaryKey` (it ignored the key and dropped the keys). The two-key rule ties two fields together, and Effect's arbitrary derivation can only reject for a rule across fields, so the checked record is restated as a declaration that says how to generate itself (`:251`, `toCodecArbitrary` at `:259`: draw everything but the locator, locate the object by its key property). Run on the tree before the stage, `Arbitrary.sampleEffect(Arbitrary.schema(instanceCodec(...)))` failed with `SampleError` after 1 generated value and 101 discards; it now generates, for both tiers. Rows: `Object.ObjectRecord` (`src/Object/Object.model.ts:466`) names the flat wire record, `Type` = `Encoded`; `OntologyObject` (`:564`) and every instance codec have it as their encoded side. `Client.LoadObjectsResponseOf(identifier, row)` (`src/Client/Client.model.ts:502`) is the answer to a load for any row codec, built on `Page(identifier, row)`; `LoadObjectsResponse` (`:555`) is its instantiation at `ObjectRecord` and is what the port returns (`src/Client/Client.service.ts:128`), the HTTP route declares (`src/Api/Api.definition.ts:153`) and the in-memory platform writes (`recordOf`, `src/Faux/Faux.behavior.ts:1048`, one `S.encodeEffect(OntologyObject)` per object; `loadObjects`, `:1165`). The facade decodes each row once, with `S.decodeEffect` of the codec the set carries (`decodeRows`, `src/Client/Client.behavior.ts:188`); `rg -c 'encodeObject\|decodeObjects' src` finds nothing. A `DecodeError` names the row by its index and by the locator its own two keys yield (`locatorOf`, `:183`). `InstanceModel<A>` (`:70`) asks for a codec of the wire record (`S.ConstraintCodec<A, ObjectRecord>`), so a schema of anything else is a compile error, and `Client.untyped(objectSet)` (`:174`) pairs a plain object set with `OntologyObject`: `fetchPage` (`:277`), `stream` (`:356`) and `fetchOne` (`:440`) have one path and two codecs. An untyped read is typed by no object type, so `ObjectNotFound` and `MultipleObjectsFound` carry `objectType` as an `Option` (`src/Client/Client.errors.ts:321`, `:366`). Tests: "one instance codec for both tiers" (`test/Model.object.test.ts:1001`): one wire row read by a model and by the projection of the type the model denotes (`Model.typeOf` of each spec) gives equal values, and each codec accepts and writes the other's instance (`:1011`); the two tiers refuse with the same words (`:1026`); the strict round-trip law holds on generated instances of four models (`:1048`) and of one model per kind a key may have, nine in all, in both tiers (`:1061`). "holds __primaryKey to the key property in both directions, comparing in the key's own domain" (`:498`) replaces "writes __primaryKey from the key property, whatever the record said on the way in", and "keeps the keys the model does not declare as JSON, and writes them back" (`:541`) replaces "ignores keys the model does not declare"; the exact static type of an instance is at `:586`. `test/Object.test.ts` has `ObjectRecord` (`:819`), `InstanceOf` (`:1443`) and generated instances of each stub object type (`:1409`). `test/Client.test.ts` has "every read decodes each row exactly once, with the codec the set carries" (`:1225`: a codec that notes the key of every row it is handed sees two keys for a page, three for a stream, one for `fetchOne`), "the port hands rows on as the records that arrived" (`:1212`), the `LoadObjectsResponseOf` suite (`:647`), the untyped reads (`:1266`, `:1318`) and a row that names no object type (`:1407`); `test/Api.test.ts:503` and `test/Faux.test.ts:793` hold the two transports to wire rows. Left as it is, and listed in README section 7: a decoded instance is validated a second time by the declaration; `fetchPage` returns the page shape (rows, cursor, count), so the security table and the compute usage of an answer are read through the port or through `LoadObjectsResponseOf`. |
| F7 | major | partly | One rule is stated (README section 4: the domain literal is the lowerCamel form of the wire word) and held by `test/LiteralRule.test.ts` ("every domain literal is the lowerCamel form of its wire word", "the same wire word has the same domain literal in every enum that uses it"). Renamed to follow it: `Filter.RelativeDateUnit` `DAY` is `day` (`src/Filter/Filter.model.ts:142`), `DerivedProperty.DatePart` `DAYS` is `days` (`src/DerivedProperty/DerivedProperty.model.ts:66`), `BASE_ANALYZER` is `baseAnalyzer`, `ALL_V2_WITH_DELETIONS` is `allV2WithDeletions`, `ROUND_CLOSEST` is `roundClosest`, `DATE_FORMAT_RELATIVE_TO_NOW` is `dateFormatRelativeToNow`, `USER_OR_GROUP_ID` is `userOrGroupId`. The false sentence in `Filter.model.ts` is gone. Still open: three literals in `src/DataType/DataType.values.ts` (`COSINE_SIMILARITY` is `cosine` at `:622`, `EUCLIDEAN_DISTANCE` is `euclidean` at `:624`, `OPENAI_TEXT_EMBEDDING_ADA_002` is `openAiTextEmbeddingAda002` at `:660`); the test lists them as known deviations (`test/LiteralRule.test.ts:54`). |
| F8 | major | fixed | `Action.model.ts` no longer declares `AnyType`, `ObjectTypeParameterType` or `ScenarioReferenceType` (`rg '^export class (AnyType\|ObjectTypeParameterType\|ScenarioReferenceType)' src/Action` = 0); it imports the kernel's `AnyType`, `ObjectTypeReferenceType` and `ScenarioReferenceType` (`src/Action/Action.model.ts:31`, `:47`, `:48`; declared at `src/DataType/DataType.model.ts:597`, `:611`, `:625`). |
| F9 | major | fixed | `Page` is used and tested. `LoadObjectsRequest` and `FetchOptions` spread `PageRequest.fields` (`src/Client/Client.model.ts:217`), `LoadLinksRequest` picks its cursor from them (`src/Link/Link.model.ts:297`), and the answer to an object load spreads `Page(identifier, row).fields` for whatever row codec it is given (`LoadObjectsResponseOf`, `src/Client/Client.model.ts:502`; before the F6 stage it was `Page("ObjectPage", OntologyObject)`). `test/Page.test.ts` is new and has a suite each for `PageToken`, `PageSize`, `TotalCount`, `PageRequest` and `Page`. `LinkPage` still declares its own `nextPageToken` (`src/Link/Link.model.ts:351`). Using `Page` did not close F6 by itself; making the row its parameter did (row F6). |
| F10 | major | fixed | `test/MediaMetadata.test.ts` and `test/MediaOperations.test.ts` are new and table-driven. Counted from a verbose run: 109 exact wire fixtures (84 cases of the 28 tagged unions of `MediaTransformation.model.ts`, 13 cases of the 3 unions of `MediaMetadata.model.ts`, 12 literals that travel as tag records), each decoded from its exact wire form, matched as itself and encoded back. Every union also has "there is exactly one fixture per case, in declaration order" and "an exhaustive match sends every generated value to the handler of its own tag". The generation and round-trip laws are registered from schema tables that a test holds to the module's exports: "the table lists each of the 133 schemas the module exports" (`MediaTransformation.model`), 19 (`MediaTransformation.values`) and 49 (`MediaMetadata.model`). The three `Media*` test files hold 734 tests. `Media` is still one folder of three subjects (weakness 10). |
| F11 | major | fixed | The last three findings (two helper references in `src/Model/Model.query.ts`, one `flow` candidate in `src/Value/Value.model.ts`) were fixed after this table was first written. `bun run beep laws terse-effect --check --include <the 108 files of src>` now reports `blocking_files=0`; `native-runtime` (`errors=0`), `effect-imports` (`manual_reviews=0`) and `effect-fn` (`violations=0`) exit 0 over the same tree. The one `as const` the fix wave left in `test/ObjectType.test.ts` is also gone. |
| F12 | major | fixed | Every item the finding lists now has an Example: the 13 kits, `EmbeddingSource`, the 9 value codecs, `one`, `many`, `fieldsOf`, `required` and the leaf spec constructors. Counted by script over `src`: 614 of 685 exported constants have a runnable Example in the JSDoc block above them; the 71 without are 70 brands of the form `S.NonEmptyString.pipe(...)` and `Security.ConjunctiveMarkings` (`S.Array(MarkingId)`). 109 of 680 exported classes have one. README section 9 now states these numbers instead of the general sentence. The doctest run holds 740 examples in 74 files. |
| F13 | minor | fixed | The false sentence about inline object-set arguments is gone from README section 7. Section 7 now has a paragraph on the open design findings (F4, F5, F6), moves F4 out of "sharp edges", and lists what typed actions and queries still lack. Its omissions (a) and (b) are closed in code: F1-F3 above, and `Model.action` / `Model.query` with the `Client` operations facade (`src/Model/Model.action.ts:927`, `src/Model/Model.query.ts:435`, `src/Client/Client.operations.ts:183-416`; `test/Operations.test.ts`, README block (g)). |
| F14 | minor | open | `ObjectType` is still the one `S.Class` (`src/ObjectType/ObjectType.model.ts:1221`), with `ObjectTypeSeed` (`:1157`) and `primaryKeyType` (`:1144`). The three checks were not moved to `Ontology.policy.ts`. README section 7 keeps the sharp edge. |
| F15 | minor | fixed (in the README) | The code is unchanged (`IncludeRid` negates in both directions, `src/Client/Client.model.ts:200`; `select` and `selectV2` are one field, `:319`). README section 4 now lists both transformations in its closed table ("a flag the wire asks backwards", "a superseded key beside its successor"), which is the first of the two fixes offered. |
| F16 | minor | open | No shared law file (`ls test` shows only `*.test.ts`). `rejects` is declared in 19 test files, `lawful` in 16, `wireFixture` in 13, `lawsOf` in 7, `generates` and `roundTrips` in 6 each. The two new Media test files added their own copies. The F4 stage deleted the ten `wireStable` copies (and `lawfulOnTheWire`, `fixedPointLawsOf`) with the law they stated. |
| F17 | minor | open | `src/internal/AbsentKey.ts` still exists and is still called only from the two large `Media` files (52 and 46 call sites); `S.withConstructorDefault(Effect.succeedNone)` is written out 204 times in `src`. |
| F18 | minor | open (half) | `compareValues` (`src/Faux/Faux.behavior.ts:234`) and `numberOf` (`:259`) are unchanged, and there is no `Property.valueOrder`. The `operandFamily` half is done by the F4 stage: an operand is one of three JSON scalars, so the match has three arms and ends in `Match.exhaustive` (`src/Filter/Filter.policy.ts:464-468`); nothing unrecognised is a date any more. |
| F19 | minor | open | `foldFilter` still tests the discriminator with a guard chain (`src/Filter/Filter.behavior.ts:840`). |
| F20 | minor | open | `ObjectFilterKind` is still private (`src/Filter/Filter.model.ts:1197`) and `FilterOperator` is still rebuilt from `ObjectFilter.discriminants` (`src/Filter/Filter.policy.ts:78`). |
| F21 | minor | open | All four duplicates remain: `InterfaceLinkCardinality` (`src/InterfaceType/InterfaceType.model.ts:285`) beside `LinkCardinality` (`src/LinkType/LinkType.model.ts:48`); `OrderDirection` (`src/Aggregation/Aggregation.model.ts:69`) beside `SortDirection` (`src/ObjectSet/ObjectSet.model.ts:943`); `SetOperator` (`src/ObjectSet/ObjectSet.policy.ts:69`) beside `LinkSetOperator` (`src/Shape/Shape.model.ts:403`); the error body with `errorName: S.String` in `src/Query/Query.model.ts:1378` beside `errorBodyFields` in `src/Client/Client.errors.ts:75`. |
| F22 | minor | open | `FauxActionOutcome` is still an exported interface of plain data (`src/Faux/Faux.layer.ts:56`) and `FauxOptions.actions` / `.queries` are still keyed by `string` (`:98`, `:100`). |
| F23 | minor | open | Not re-measured. Nothing generates a schema description from the JSDoc lead or the other way round, so the two copies are still held together by hand. |

New since the review, found while checking the rows above:

- One `as const` entered a test with the fix wave (`test/ObjectType.test.ts:1142`, on a wire fixture). The
  review counted 0 in `src` and 0 in `test`; `src` is still at 0. The type-check accepts it.
- The sweep of "Check 1" still returns 0 for sync codecs, `JSON.parse` / `JSON.stringify`, `switch`, native
  `Set` / `Map` / `Date`, `any` as a type, `@ts-ignore` and `console` in `src` and `test`. `@ts-expect-error`
  appears only in negative type tests: 64 in `test/Model.object.test.ts`, 12 in `test/Client.test.ts`, 10 in
  `test/Operations.test.ts`, 6 in `test/Model.test.ts` and 6 in `test/Readme.test.ts`. The F4 stage added 21, each
  over a rich value handed to a position that takes the wire scalar: 6 in `test/Filter.test.ts`, 4 in
  `test/Value.test.ts`, 3 each in `test/Aggregation.test.ts` and `test/ValueType.test.ts`, 2 in
  `test/Object.test.ts`, and 1 each in `test/Query.test.ts`, `test/Agent.test.ts` and `test/Readme.test.ts`.
  The F5 stage added 9, each over a spec that is not what its position takes: 5 in `test/Model.test.ts` (a
  vector spec with the shape of a leaf or of an array, a spec of an action where a property spec is read, the
  dimension of an array or a struct spec), 2 in `test/Operations.test.ts` (a point property and a spec marked as
  a primary key handed to a typed action), 1 in `test/Model.object.test.ts` (a vector spec that states no
  dimension handed to `conformance`) and 1 in `test/Value.test.ts` (the shared table has no row for an
  attachment). The F6 stage added 3: 2 in `test/Client.test.ts` (a schema that does not read an object record
  given as the codec of a set, and `untyped` applied to a typed set) and 1 in `test/Model.object.test.ts` (a record
  without `__primaryKey` handed to the typed decoder of a model). Counted with `rg -c '@ts-expect-error'`, the
  files now hold 66, 14, 12, 11 and 7 in the order of the first list, and `test/Value.test.ts` 5.
- `ActionRejected`, the tagged error of a refused action, was declared in `Client.operations.ts` by the fix
  wave. It now sits with the other errors (`src/Client/Client.errors.ts:391`) and is the sixth case of
  `ClientError` (`:478`); `TransportFailure` is unchanged, because the transport answers such a request
  successfully and the facade decides it is a failure. `test/Client.test.ts` builds, guards and matches the new
  case, and `test/Operations.test.ts` ("an action the platform reports invalid fails with the validation
  report") raises it through the facade.
- The dependency order still holds after the fix wave: checked by script over every relative import in `src`
  (294 of them after the F6 stage, which added `Model` and `Client` imports of `Object`), 0 imports point to a
  later row of README section 3 and 0 go through a barrel. All 59 files that declare an
  identity composer use the path of their own file.
- The typed-operations fixer left three things out and said so; README section 7 lists them: no value spec for
  a by-name type reference, `void`, `null` on its own or `unsupported`
  (`rg '"typeReference"|"void"|"unsupported"' src/Model` finds nothing); no typed batch application (`rg -i batch src/Model src/Client/Client.operations.ts` = 0); and
  `actionConformance` / `queryConformance` compare a vector and a union by tag only (`vector: () => none`,
  `union: () => none`, `src/Model/Model.action.ts:1240`, `:1280`; `src/Model/Model.query.ts:648`, `:649`).

Package state after the F6 stage of the second fix wave and the repair of its review (2026-11-13):

```text
$ ./node_modules/.bin/tsrs -p scratchpad/osdk/tsconfig.json --noEmit --pretty false
(no output)

$ bunx --bun vitest run --config osdk/vitest.config.ts
 Test Files  37 passed (37)
      Tests  4282 passed (4282)

$ BEEP_VITEST_DOCTEST=1 bunx --bun vitest run --config osdk/vitest.config.ts
 Test Files  75 passed (75)
      Tests  754 passed (754)
```

Size: 109 files and 57,762 lines under `src`, 37 test files and 46,011 lines under `test`. The four law gates
exit 0 over `src` (`native-runtime` `errors=0` and `warnings=0`, `effect-imports` `manual_reviews=0`, `effect-fn`
`violations=0`, `terse-effect` `blocking_files=0`).

What would move the one major that is not fully closed: F7 is three literals in one file plus the three
entries of the test's deviation list. F6 is closed by the stage of that name: the answer to a load takes its
row codec as a parameter, the port returns wire rows, and the dynamic and the typed instance codec are one
function. What F5 left written twice (the rules that compose codecs, once per layer, and the reference rows an
action and a query both have) and what F6 left as it is (a second validation of a decoded instance, a read that
returns the page shape and not the whole envelope) are in README section 7.

---

Reviewer: independent (laws / consistency / elegance). Date: 2026-11-12. Read-only on `src/` and `test/`.
Scope: `scratchpad/osdk/src` (105 files, 52,793 lines), `scratchpad/osdk/test` (32 files), `README.md`.
Status: FINAL. Every finding below was checked against the files and, where it says so, by running code
(type probes with `tsrs`, run-time probes with `bun`, both kept outside the package).

## Verdict

1. The mechanical laws hold almost everywhere: 0 type assertions, 0 `any`, 0 sync codecs, 0 native `Set` / `Map` /
   `Date` / `JSON` / `switch`, 0 exported decode/guard walls, 665 of 665 schema classes branded, 386 of 386 exported
   schema constants identified, 1,896 of 1,896 exports documented with a closed-vocabulary `@category` and
   `@since 0.0.0`. Type-check prints nothing; 3,628 tests pass at the default depth and at `BEEP_FC_NUM_RUNS=300`.
2. One law gate is RED: `beep laws terse-effect --check` exits 1 with 16 blocking findings in 9 files (12 in the
   behavior / policy / layer / service subset). `native-runtime`, `effect-imports` and `effect-fn` are clean.
3. No blocker. Twelve majors (F1-F12): three typed-layer holes, one family of unions that cannot decode their
   own members, two ideas stated more than once, three cross-concept inconsistencies, two test gaps and the red gate.
4. The typed layer has holes the compiler confirms and the README does not admit: a filter built from one model
   narrows a set of another, a set is fetched with a different model, and `Model.required` removes `Option` from
   any property with nothing to check it (F1-F3).
5. The core algebra does not round-trip: 78 schemas (every filter, object set, derived property, object locator,
   load request and the ontology itself) are held to "wire stability", not to C9(b), because `ScalarValue` and
   `PrimaryKeyValue` decode JSON-natively. Run: an `ObjectLocator` with a `bigint` key comes back with a `string`
   key and is not equivalent to itself (F4).
6. Two ideas that the design promises to state once are stated several times and held together by tests: the
   tag -> value codec rows (five projections; `boolean -> BooleanValue` is written 6 times, `date -> DateValue` 8)
   and the instance codec (`Object.instanceCodec` and `Model.object`'s `Instance`, bridged at run time by
   decode -> encode -> decode) (F5, F6).
7. Cross-concept consistency slipped where two agents met the same wire fact: `DAY` decodes to `"days"` in `Filter`
   and to `"day"` in `Action`; three kernel tag records are redeclared in `Action`; `Page(...)` and `PageRequest`
   have no consumer while three concepts re-declare their fields (F7-F9).
8. Tests are deep on the kernel and thin on the largest concept: 90 of 206 named `Media` schemas are never named
   in a test and 36 of 91 `Media` tags never appear in a wire fixture; no test exercises `Page` (F9, F10).
9. The README's section 6 holds up claim by claim, and its dependency-order claim is exact (0 upward imports
   among 33 concepts). Its "unions, kits, codecs, projections and public functions carry a runnable example" does
   not hold (45 lack one, all in the kernel), and section 7 has one stale sentence and three omissions (F12, F13).
10. Ship as a design study: yes. Ship as the reference the user's standard asks for: after F1-F9.

## Findings

Severity: blocker (wrong or unusable), major (breaks a stated law, a design promise or a README claim), minor
(local, cheap). `src/` and `test/` prefixes are relative to `scratchpad/osdk/`.

| # | Sev | Where | Evidence | Smallest fix |
| --- | --- | --- | --- | --- |
| F1 | major | `src/Model/Model.set.ts:112` (`where`), `src/Model/Model.filter.ts` (every constructor returns a bare `ObjectFilter`) | A filter forgets the model it was built from. This compiles (probe checked with `tsrs`, controls fail as expected): `Model.where(Model.all(Employee), Model.eq(Office.property("officeId"), "LYS"))`. OSDK's `WhereClause<Q>` rejects it. `orderBy` (`Model.set.ts:334`) has the same hole and also takes any tag: `Model.orderBy(Office.property("entrance"), "asc")` (a geopoint) compiles. | Give `PropertyReference` a fourth parameter, the owning model's `ApiName`, set by `model.property(name)`; make the typed constructors return `TypedFilter<ApiName>` (a phantom-tagged `ObjectFilter`) and `where` accept only `TypedFilter<Model["apiName"]>`. Restrict `orderBy` to `OrderedKind`. No conditional types needed. |
| F2 | major | `src/Client/Client.behavior.ts:166, 263, 360` (`fetchPage`, `stream`, `fetchOne`), `README.md:314` | The facade takes the model and the untyped `ObjectSet` as two arguments, so `TypedObjectSet` is pulled apart by its only consumer: README (f) writes `Client.fetchPage(lyon.model, lyon.objectSet, ...)`. `Client.fetchPage(Office, Model.all(Employee).objectSet, options)` compiles; only a run-time `DecodeError` catches it (`test/Client.test.ts:983`). The data-last form pipes the model, not the set (`pipe(Employee, fetchOne(onlyRavi, defaults))`, `test/Client.test.ts:925`), so a set built with `pipe(Model.all(M), Model.where(...))` cannot be piped into a read. | `fetchPage(set: TypedObjectSet<M>, options)`: delete the `model` parameter and read `set.model.Instance`. One argument fewer, one hole closed. |
| F3 | major | `src/Model/Model.spec.ts:405` (`required`), `src/Model/Model.policy.ts:126` (finding kinds) | `Model.required(spec)` turns `Option<Value>` into `Value` for any property (`fullName: Model.required(Model.string)` types `fullName: string`; probe compiled). The doc says "use it for the primary key", but nothing enforces that, and `conformance` has no presence finding: its nine kinds are object type, key, missing property, tag, struct field, vector dimension, missing link, cardinality, target. A narrowing the wire does not guarantee, with no check. | Either make `required` private to `Model.object` (applied to `Key` only, which the definition type already demands), or add a `presenceMismatch` finding that compares `spec.presence` with the served nullability. The first is a deletion. |
| F4 | major | `src/Value/Value.model.ts:617` (`ScalarValue`), `src/Object/Object.model.ts:92` (`PrimaryKeyValue`), `src/Client/Client.model.ts:85` (`OntologyIdentifier`) | Unions whose members share an encoded type: decode always takes the first, so the `Type` side promises values decode never yields. `ScalarValue` = `[String, Finite, Boolean, LongValue, DecimalValue, DateValue, TimestampValue]`: a `bigint`, `BigDecimal`, `LocalDate` or `DateTime` operand never comes back. Consequence: 78 schemas are tested with `wireStable` instead of the C9(b) round trip (`rg -c '^\s*(wireStable\|lawfulOnTheWire\|fixedPointLawsOf)\(' test`: ObjectSet 23, Subscription 12, Filter 12, Query 6, Aggregation 6, ValueType 5, Arguments 5, Object 4, Client 3, Ontology 1, Agent 1), including `ObjectFilter`, `ObjectSet`, `DerivedProperty`, `ObjectLocator`, `OntologyObject`, `LoadObjectsRequest`, `OntologyDefinition`. `ObjectLocator` is an identity: a locator with a `bigint` key is not `Equal` to itself after a round trip. Run with `bun`: `ObjectLocator.make({ objectType: "Employee", primaryKey: 9007199254740993n })` encodes to `{"objectType":"Employee","primaryKey":"9007199254740993"}` and decodes to a `string` key, `S.toEquivalence(ObjectLocator)(before, after)` = `false`; `Filter.eq("badge", 5n)` likewise. `OntologyIdentifier` = `[OntologyRid, OntologyApiName]` brands `"default-ontology"` as an `OntologyRid` (documented at `Client.model.ts:64`; the same union is declared a second time, privately, at `Agent.model.ts:294`). `Faux.behavior.ts:214` (`decodeOperand`) already implements "encode the operand, decode it with the property's own codec", privately. The doc of `ScalarValue` says "decoding with the ontology restores the rich type exactly" and no such projection exists (`rg 'operandCodec\|filterCodec' src`: 0). | Add the missing projection: `Filter.codec(objectType)`: the `ObjectFilter` codec whose operand at each leaf is `valueCodec` of the addressed property (the same `.match` as `checkFilter`). Then the ontology-free codec can be honest: its decoded operand type is `string \| number \| boolean`, and the rich members become encode-only inputs of the constructors. For `OntologyIdentifier`: one brand, or check the `ri.` prefix on the first member. |
| F5 | major | `src/Property/Property.behavior.ts:72` (`valueCodec`), `src/Model/Model.spec.ts:120-306` (19 leaf specs, `vector`, `array`, `struct`), `src/Action/Action.behavior.ts:95-190`, `src/Query/Query.behavior.ts`, `src/Agent/Agent.behavior.ts:113` | The tag -> value codec rows are written by hand in five projections. Counted in code: `boolean: () => BooleanValue` 6 times, `string -> StringValue` 6, `integer -> IntegerValue` 7, `double`, `date` and `timestamp` 8 each; the vector rule `VectorValue.check(S.isMinLength(dimension), S.isMaxLength(dimension))` 3 times (`Property.behavior.ts:94`, `Model.spec.ts:306`, `Action.behavior.ts:183`). The contract described `Value` as "scalar value codecs keyed by kind"; `Value.model.ts` exports 14 loose constants and no keyed table. For properties the table exists twice in full: 22 arms of `PropertyType.match` and 22 spec constructors. Agreement is a test (`test/Model.test.ts:344-400`), which needs a third hand-written table pairing tags with types. `PropertySpec` is an interface, not data, and an optional-field bag (`element: Option`, `fields: Record`, `dimension: Option`, "a leaf holds none of them", `Model.spec.ts:86-95`): law A7 says a discriminated union. | One typed table in `Value` (`scalarCodec: { readonly [K in ScalarKind]: ... }`, `ScalarKind` a `DataTypeKind.pick`), read by all five: each projection spreads the rows its universe shares and writes only the rows that differ (`attachment` is `AttachmentReference` for a property and `AttachmentRid` for an argument); `Model.<kind>` is `leaf(kind, scalarCodec[kind])`. Add `Model.typeOf(spec): PropertyType` (total, ten lines); then `conformance` is a structural diff of two `PropertyType`s and the agreement test is one property: `valueCodec(typeOf(spec))` and `spec.value` accept the same values. |
| F6 | major | `src/Client/Client.behavior.ts:65-90` (`decodeObjects`), `src/Model/Model.object.ts:197-262` (`Instance`), `src/Object/Object.behavior.ts:160` (`instanceCodec`) | Three shapes for "one object": `OntologyObject` `{ locator, rid, title, score, properties: Json }`; the result of `instanceCodec` `{ locator, rid, title, score, properties, undeclared }` (layered on `OntologyObject`, keeps undeclared keys, checks key agreement); a model's `Instance` `{ objectType, rid, title, score, properties }` (its own transformation from `S.Record(S.String, S.Unknown)`, no locator, strips undeclared keys). The naming ledger says `ObjectLocator` is "one name for which object"; the typed instance does not carry one. The facade bridges them at run time: each row the transport already decoded is re-encoded to the flat record and decoded again ("each object goes back to that record first", `Client.behavior.ts:67`). Behaviour was added where a schema parameter was missing. | Make the row codec a parameter of the response: `LoadObjectsResponse(row)` built on the `Page(identifier, item)` factory that already exists and has no consumer (F9). The typed facade passes `model.Instance`; a row is decoded once. `Model.object`'s `Instance` should be `instanceCodec` specialised by the spec table, not a second transformation. |
| F7 | major | `src/Filter/Filter.model.ts:140` (`RelativeDateUnit`), `src/Action/Action.values.ts:599` (`RelativeDatetimeUnit`), `src/DerivedProperty/DerivedProperty.model.ts:64` (`DatePart`) | The same wire literal has two domain spellings: `DAY` -> `"days"` in `Filter`, `DAY` -> `"day"` in `Action`; and `DAYS` -> `"day"` in `DerivedProperty` while `DAYS` -> `"days"` in `TimeSeries` and `ValueFormat`. `Filter.model.ts:122-124` justifies its choice with a false claim: "The domain literals are the plural words every other time unit of the library uses." C1 sanctions lowerCamel of the wire word, not a change of grammatical number. Other editorial renames beyond lowerCamel: `ROUND_CLOSEST` -> `nearest`, `COSINE_SIMILARITY` -> `cosine`, `EUCLIDEAN_DISTANCE` -> `euclidean`, `BASE_ANALYZER` -> `base`, `USER_OR_GROUP_ID` -> `userOrGroup`, `ALL_V2_WITH_DELETIONS` -> `allWithDeletions`, `DATE_FORMAT_RELATIVE_TO_NOW` -> `relativeToNow`. | Decide once: lowerCamel of the wire word (`DAY` -> `day`, `DAYS` -> `days`), prefix and suffix dropped only when it is the enum's own name. Change `RelativeDateUnit` to singular and `DatePart` to plural or keep `DatePart` and state the rule in README section 4. Fix the false sentence. |
| F8 | major | `src/Action/Action.model.ts:243` (`AnyType`), `:568` (`ObjectTypeParameterType`), `:582` (`ScenarioReferenceType`); `src/DataType/DataType.model.ts:579, 593, 607` | C3: "Shared type-tag records come from `DataType/DataType.model.ts`: never redeclare." `Action.model.ts` imports 20 tag records from the kernel and redeclares three it also exports: `AnyType` and `ScenarioReferenceType` under the same names (different identity, different brand, different description), `ObjectTypeParameterType` for the kernel's `ObjectTypeReferenceType`. The kernel's three are consumed by nothing but their own test (`rg` over `src`: 0 imports). | Delete the three classes from `Action.model.ts` and import the kernel's (3 deletions, 3 names added to an import). |
| F9 | major | `src/Page/Page.model.ts:198` (`PageRequest`), `:294` (`Page`); `src/Client/Client.model.ts:216-223, 494`; `src/Link/Link.model.ts:295, 352` | An abstraction that does not earn its keep: `Page(identifier, item)` and `PageRequest` have 0 consumers in `src` and 0 references in `test` (`rg '\bPage\(' src` outside JSDoc: 0; `rg 'PageRequest\|PageSize\|TotalCount' test`: 0). `LoadObjectsRequest`, `LoadObjectsResponse`, `LoadLinksRequest` and `LinkPage` each re-declare `pageSize` / `pageToken` / `nextPageToken` by hand. `Page` is also the one concept no test exercises: `PageSize`, `TotalCount`, `PageRequest` and the factory are named in no test file, and only `PageToken` is imported, as a constructor. | Use it or delete it. Using it closes F6; deleting it removes about 130 lines (`Page.model.ts:170-303`) and two exports. |
| F10 | major | `test/MediaTransformation.test.ts` against `src/Media/*.ts` (5,952 lines, 206 named schemas, 91 tags) | 90 of 206 named `Media` schemas are never named in any test; they are reached only through 25-run union arbitraries. 36 of 91 declared tags never appear in a wire literal (among them `ocr`, `dicomToImage`, `spreadsheetToText`, `videoToText`, `convertDocument`, `renderPage`, `extractAllText`): C9(c) "exact wire fixtures" is missing for 40 percent of the tag surface. `casesOf` asserts the key list of `.cases`, it does not build each case through `.cases` (C9(d) shallow). | A table of one exact fixture per tag (the maps have them), driven through the existing `wireFixture`; one loop that builds every case through `.cases.<tag>.make`. |
| F11 | major | law gate | `bun run beep laws terse-effect --check --include <22 behavior/policy/layer/service files>` exits 1: `blocking_files=6`, 12 findings (9 `helper-ref`, 1 `flow-candidate`, 2 `nested-option-match`). Over all 105 files: 9 blocking files, 16 findings. Examples: `() => O.none<PropertyType>()` for `O.none<PropertyType>` (`Filter.policy.ts:700`), `pipe(text, O.map(isValid), O.getOrElse(constTrue))` for a `flow` (`ObjectType.policy.ts:437`), a nested `O.match` (`Filter.policy.ts:786`, `ValueType.behavior.ts:59`). The other three gates are clean. | `bun run beep laws terse-effect --write --include ...` fixes the 12 `helper-ref`s; the 2 `flow-candidate`s and 2 nested matches by hand. |
| F12 | major | `README.md:592-593` | "Unions, kits, codecs, projections and public functions carry a runnable example in their JSDoc" is overstated. Without an Example: 13 kits (`DataType.values.ts:106-496`: `PropertyTypeKind`, `ActionParameterTypeKind`, `QueryDataTypeKind`, `ValueTypeKind`, `LegacyDataTypeKind`, `NumericKind`, `TemporalKind`, `GeospatialKind`, `PrimaryKeyKind`, `VectorSimilarity`, `HostedEmbeddingModel`; `Property.model.ts:74` `ArrayReducerDirection`, `:521` `Nullability`), 1 union (`DataType.model.ts:490` `EmbeddingSource`), 9 codecs (`Value.model.ts:122-570`: `ByteValue`, `ShortValue`, `FloatValue`, `DoubleValue`, `StringValue`, `DateValue`, `BinaryValue`, `MarkingValue`, `VectorValue`), 4 public functions (`Model.object.ts:54` `one`, `:66` `many`; `Model.spec.ts:352` `fieldsOf`, `:405` `required`) and the 18 leaf spec constructors (`Model.spec.ts:120-278`): 45 in all. C8 is violated at the same places. All sit in the kernel the contract calls "the style exemplars". | 45 examples (the 18 spec constructors can share one table-driven example per group only if C8 is amended), or narrow the sentence to what is true. |
| F13 | minor | `README.md:499-527` (section 7) | One false sentence: "an object set passed inline as an action or query argument (those codecs take an object set RID). Both carry a `crispen:` note in the source." `Action.argumentCodec` and `Query.valueCodec` take `ObjectSetArgument`, a RID or an inline `ObjectSet` (`Action.behavior.ts:122, 187`, `Query.behavior.ts:225, 227`; tested at `test/Arguments.test.ts:205-212`); only `Agent.behavior.ts:156` takes a RID. The three `crispen:` notes in `src` are about decimal scale (x2) and the action `map` value; none is about object sets. The list also omits: (a) F1-F3; (b) typed actions and typed queries: `Model` has `object` only, so OSDK's `ActionParam.*`, `QueryParam.*`, `QueryResult.*` static types have no counterpart (the projections in `Action.behavior.ts` and `Query.behavior.ts` return `S.Codec<unknown, unknown>`); (c) F4's consequence that the core algebra satisfies wire stability, not round trip, is filed under "sharp edges" as a property of `ScalarValue` rather than of the 78 schemas that hold one. | Delete the stale half-sentence; add three bullets. |
| F14 | minor | `src/ObjectType/ObjectType.model.ts:1095-1245` | `ObjectType` is the package's one `S.Class` because three cross-field checks (key declared, title declared, key kind) were put in the wire codec; they in turn need `ObjectTypeSeed`, `primaryKeyType` and a `toCodecArbitrary` link (about 90 lines) so arbitraries can satisfy them. The contract (section 11) lists "primary key or title not declared" as a `validateOntology` FINDING. As a decode check, one such object type fails the decode of the whole `OntologyDefinition`, which contradicts README section 6 "validation returns every problem, not the first". | Move the three checks to `Ontology.policy.ts` as three finding kinds; `ObjectType` becomes `S.Opaque` like the other 657; delete the seed, the link and the README sharp edge about `S.is(ObjectType)(plainObject)`. |
| F15 | minor | `src/Client/Client.model.ts:199-202, 325` | `excludeRid` -> `includeRid` negates a boolean in both directions. Negation is not in C1's closed list ("never invent a transformation that is not one of these") nor in README section 4's ("a schema never invents another"). Same file: two wire keys (`select`, `selectV2`) merged into one field. Both are documented in JSDoc and defensible; the closed-list claim is what is false. | Add "a wire flag asked backwards -> the positive flag" and "a superseded key and its successor -> one field" to the list in README section 4, or keep `excludeRid`. |
| F16 | minor | 28 test files | The law helpers are re-declared per file under eleven names: 80 declarations (`rejects` in 19 files, `lawful` 16, `wireFixture` 12, `wireStable` 10, `lawsOf` 7, `generates` 6, `roundTrips` 6, and four one-offs), each 10 to 30 lines, with run counts that drift (25, 50, 100). `@beep/test-utils` already ships `assertSchemaArbitraryDecodesToSelf`. | One `test/_laws.ts` (relative imports are allowed for local helpers); on the order of 1,000 lines deleted. |
| F17 | minor | `src/internal/AbsentKey.ts:44` (`absent`), 207 sites elsewhere | One idiom, two spellings. `absent(item, description)` wraps `S.OptionFromOptionalKey(item).pipe(S.withConstructorDefault(Effect.succeedNone), S.annotateKey({ description }))`. It is called 98 times, all in the two wave-4 `Media` files; the other 31 concepts write the three lines out 207 times. | Decide once. Either the helper is right (move it beside the kernel and delete about 400 lines) or, by the "refuse a helper a combinator already provides" rule, it is not (inline its 98 uses and delete the file). |
| F18 | minor | `src/Faux/Faux.behavior.ts:230-246` (`compareValues`), `:255-262` (`numberOf`); `src/Filter/Filter.policy.ts:474` (`operandFamily`) | Behaviour standing in for a projection. `compareValues(left: unknown, right: unknown)` is a seven-deep ternary over run-time forms (number, bigint, BigDecimal, DateTime, LocalDate, string, boolean) in a module that holds the property's `PropertyType`. `operandFamily` ends in `Match.orElse(() => "date")`: anything it does not recognise is a date. `Faux.behavior.ts` has 25 of the package's 57 ternary continuation lines and 6 of its 13 `if`s. | `Property.valueOrder: (type: PropertyType) => Option<Order<...>>` as one `.match`, the sibling of `valueCodec` (equality already precipitates: `S.toEquivalence(valueCodec(type))`). `operandFamily`: replace `orElse` with an `isLocalDate` arm and `Match.exhaustive`. |
| F19 | minor | `src/Filter/Filter.behavior.ts:840` (`foldFilter`) | The fold tests the discriminator with a guard chain (`isAnd(node) ? ... : isOr(node) ? ... : isNot(node) ? ... : algebra.property(node)`), where `foldObjectSet` (`ObjectSet.behavior.ts:600`) uses `ObjectSet.match`. 11 section D2: do not branch on the discriminator in the module that owns the schema. | `ObjectFilter.matchOrElse(node, { and, or, not }, algebra.property)`. |
| F20 | minor | `src/Filter/Filter.model.ts:1196` (`ObjectFilterKind`, private), `src/Filter/Filter.policy.ts:78` (`FilterOperator`) | Whether a union's anchoring kit is exported differs by author: `Action`, `Aggregation`, `Media`, `ValueFormat`, `ValueType` export theirs (about 30 `*Kind` kits); the other concepts keep about 70 private. `Filter` then needs a second kit with the same 28 literals, rebuilt from `ObjectFilter.discriminants`. | Export the anchoring kit under its domain name (`FilterOperator`) and delete the rebuilt one; state the rule in README section 4. |
| F21 | minor | `src/InterfaceType/InterfaceType.model.ts:285`, `src/LinkType/LinkType.model.ts:48`; `src/Aggregation/Aggregation.model.ts:69`, `src/ObjectSet/ObjectSet.model.ts:943`; `src/ObjectSet/ObjectSet.policy.ts:69`, `src/Shape/Shape.model.ts:403`; `src/Query/Query.model.ts:1377-1383`, `src/Client/Client.errors.ts:72-82` | Small duplicates between concepts: `InterfaceLinkCardinality` is `LinkCardinality` again (same pairs); `OrderDirection` and `SortDirection` are one domain under two names (two wire spellings justify two codecs, not two domain names); `SetOperator` and `LinkSetOperator` hold the same three literals; the five-field platform error body is declared in `Query` (with `errorName: S.String`) and in `Client` (with the `ErrorName` brand). | Import instead of redeclare; move the error body below both consumers (`Identifier` already owns `ErrorName`). |
| F22 | minor | `src/Faux/Faux.layer.ts:56` (`FauxActionOutcome`), `:94` (`FauxOptions`) | `FauxActionOutcome` is an exported pure-data interface (law A1). `FauxOptions.actions` / `.queries` are keyed by `string` where `ActionTypeApiName` and `QueryApiName` exist (C5). | An `S.Opaque` for the outcome; branded record keys. |
| F23 | minor | all `.model.ts` files | 759 of 1,048 identified schema descriptions are the JSDoc lead of the same export, verbatim (135 more share their first 40 characters). Nothing holds the two copies together. Not a law breach; it is the largest single body of duplicated text in the package. | Out of scope for a quick fix; worth one decision: generate one from the other, or let the lead say why and the description say what. |

## Elegance (five)

1. **`Property.valueCodec` is one exhaustive `.match` (`src/Property/Property.behavior.ts:72`, `fieldCodec` at `:126`).** Twenty-two arms,
   no `switch`, no default: adding a tag to `PropertyTypeKind` is a compile error until the projection answers it.
   `fieldCodec` is the same function composed with `S.OptionFromOptionalNullOr`. OSDK needs
   `PropertyValueWireToClient` and five sibling tables for this.
2. **The operator vocabulary precipitates from the union (`src/Filter/Filter.policy.ts:78`).**
   `FilterOperator = LiteralKit(ObjectFilter.discriminants)`, then `.pick` / `.omit` for every operator family, and
   `allowedOperators: { readonly [K in PropertyTypeKind]: ... }` is total by its type. Nothing is spelled twice
   inside this file. (The model file keeps its own private kit of the same 28 literals: F20.)
3. **The HTTP surface is a value (`src/Api/Api.definition.ts`).** Each route is path, parameter brands, payload schema,
   success schema, error schema; the comment above each endpoint cites the OSDK route tuple it replaces. The
   in-memory transport and the HTTP transport satisfy the same `OntologyTransport` port, so README block (f) runs
   unchanged on either.
4. **Findings are tagged unions, not strings, and graph questions go to `effect/Graph`
   (`src/Ontology/Ontology.policy.ts:627-646`).** The interface-cycle rule is `Graph.isAcyclic` then
   `stronglyConnectedComponents`; every rule has type `(ontology) => ReadonlyArray<OntologyFinding>` and
   `validateOntology` is their concatenation. The same shape repeats in `Filter.policy`, `ObjectSet.policy`,
   `Model.policy`, `Shape`.
5. **The identity and discriminator discipline is uniform across twenty authors.** 113 of 113 schema unions are on
   `type` (the two `_tag` unions are the error unions, which is the law), 57 of 57 files with a composer use the
   path of the file, 33 of 33 barrels have the same shape, 66 mapped enums all have lowerCamel domain literals, no
   file imports another concept through a barrel, and the 33 concepts form a strict order: checked against the
   README's table, 0 imports point upward.

## Weakness (ten)

Ordered by how much of the "one representation" promise each one costs. Each names the smallest fix.

1. **A filter does not know its model (F1).** The typed constructors check tag and operand, then return an untyped
   tree. Fix: phantom model name on `PropertyReference` and on the filter.
2. **The facade un-types the typed set (F2).** Fix: `fetchPage(set, options)`.
3. **`ScalarValue` is a union that cannot decode most of its own members (F4).** Fix: the projection
   `Filter.codec(objectType)`; make the ontology-free operand type honest.
4. **The tag -> codec rows are written in five projections, and for properties the whole table twice (F5).** Fix:
   one keyed table in `Value`, `Model.typeOf`.
5. **Two instance codecs and a run-time bridge between them (F6).** Fix: a row-parameterised response.
6. **`Model.required` is an unchecked narrowing (F3).** Fix: delete it from the public surface.
7. **`ObjectType` is a class to serve three checks that the contract assigned to a policy (F14).** Fix: move the
   checks, delete the seed.
8. **Abstractions that do not earn their keep: `Page` / `PageRequest` (exported, documented, unused, untested, F9)
   and `absent` (used by one author, F17).** Fix: use or delete, both.
9. **The operator matrix is stated three ways and operand kinds are sniffed at run time.** `Filter.policy.ts`
   `allowedOperators`, `Model.filter.ts` `familyKinds` x `familyOperators`, and the type parameters of the typed
   constructors are reconciled by `test/Model.object.test.ts:804-847`, which carves out the six reference-valued
   tags by hand; `operandFamily` and `Faux`'s `compareValues` classify values by their run-time form (F18). Fix:
   derive `allowedOperators[kind]` from the families (plus one explicit `referenceEquality` family) so the test
   has nothing to reconcile; add `Property.valueOrder(type)`.
10. **`Media` is three concepts in one folder with the thinnest tests in the package (F10).** 5,952 lines, 206 named
    schemas, files named for other concepts (`MediaMetadata.model.ts`, `MediaTransformation.model.ts`,
    `MediaTransformation.values.ts`), 90 schemas no test names. Fix: split into `Media`, `MediaMetadata` and
    `MediaTransformation` (the file names already say so, and the file-role grammar is restored); one fixture per
    tag.

Also considered and not ranked: `ObjectTypeSignature` (`Object.behavior.ts:47`), a structural interface so that
`instanceCodec` need not take an `ObjectType`: it earns its keep. `OntologyTransport` (10 members) mirrors the
`OntologyApi` value route for route; that is the price of a port two layers satisfy, and it is paid once.

## Raw counts

### Check 1: smell sweep (11 section K), `src` / `test`

| Pattern | src | test | Classification |
| --- | --- | --- | --- |
| `.annotate($I.annote` / `identifier: $I` (A4) | 0 | 0 | clean |
| `S.optional(` / `S.withDecodingDefault(` / `S.OptionFromOptional(` (A8) | 0 | 0 | clean |
| `S.(decode\|encode)(Unknown)?Sync` / `JSON.(parse\|stringify)` (A13) | 0 | 0 | clean |
| `const (is\|decode\|encode)\w+ = S.` (A14) | 66 | n/a | 31 are JSDoc example lines; 35 are private module-level hoists (`const encodeScalar = S.encodeEffect(ScalarValue)`), which 11 section H asks for. 0 exported. Lawful. Nit: 4 are `S.is(<Kit>)` where the kit's own `.is` exists (`Faux.behavior.ts:247`, `ObjectType.model.ts:1093`, `Aggregation.behavior.ts:65`, `ValueType.behavior.ts:32`), and `Client.behavior.ts:376` hand-builds `S.Natural`. |
| ` as [A-Z]` / ` as unknown` / `@ts-ignore` / `@effect-diagnostics` / `\bany\b` (A20) | 1,573 | 385 | All false positives: `import * as X` and the English word "any" in prose. Type assertions: 0. `as const`: 0 in src, 0 in test (the one hit is the phrase "has constructors"). `any` as a type: 0. `@ts-ignore`: 0. `@effect-diagnostics`: 0. Non-null `!`: 0. |
| `^export (interface\|type) \w+ = \{` (A1) | 0 | n/a | clean by this pattern. By hand: 16 `export interface`: 13 are generic typed-layer carriers or algebras with function members (lawful); `FauxActionOutcome` (`Faux.layer.ts:56`) and `FauxOptions` (`:94`) are plain data without a function member in the first and with handlers in the second: `FauxActionOutcome` is a true A1 violation (minor); `PropertySpec` is the A7 violation in F5. |
| `export const \w+Schema` / bigint literal / `new (Set\|Map)(` / `switch (` (A3, A16) | 0 | n/a | clean |
| `@example` / `@remarks` / `@module` / `@template` (G) | 2 | 7 | All false positives (`a@example.com`). |

Added checks:

| Check | Count | Notes |
| --- | --- | --- |
| Exported schema constants without `$I.annoteSchema` | 0 of 386 | (script hit `QuerySelectorFromVersionedApiName`; false positive, it is annotated at `Ontology.model.ts:306`) |
| `S.Opaque` / `S.Class` / `S.TaggedError` without the brand argument | 0 of 665 | 657 Opaque, 1 Class, 7 TaggedError |
| Identity composer path differs from file path | 0 of 57 files with a composer | 48 files have no composer; they declare no identified schema |
| Exported `is*` / `decode*` / `encode*` | 6 | `isNull`, `isNotNull` (x2: filter constructors), `isTerminal` (domain predicate), `decodeAddressTo` (schema combinator). No wall. |
| Functions returning `Effect` without `Effect.fn` | 0 | `effect-fn` gate: `scanned_files=104 violations=0` |
| Native `Set` / `Map` / `Date` / `JSON` / `switch` | 0 | `new RegExp` x2 (`Faux.behavior.ts:410`, `ValueType.behavior.ts:70` wrapped in `O.liftThrowable`), `new TextEncoder` x2, `Math.*` x8 in `Faux.behavior.ts` (haversine, percentile): lawful, no Effect equivalent |
| `as` assertions / `as const` | 0 / 0 | |
| `@ts-expect-error` outside type-level negative tests | 0 | 3 in `test/Readme.test.ts`, 31 in `test/Model.object.test.ts`, all negative type tests with a reason |

Sample of 40 fields typed `S.String` / `S.Finite` (of 62 + 52 bare sites), judged against the kernel:

- Fine, no brand or codec exists and the wire is free text or a free number (27): `displayName` x8, `description`
  x2, `message` x3, `query`, `term`, `pattern` x2, `systemPrompt`, `userPrompt`, `sheetName`, `groupName`,
  `emailAddress`, `valueIfTrue`, `valueIfFalse`, `color`, `kind`, `name` (type-class hint), `sigma`.
- A kernel brand or a C1 upgrade exists and is not used (7): `Query.model.ts:1378` `errorName: S.String`
  (`ErrorName` brand exists and `Client.errors.ts:76` uses it for the same body; the five-field error body is
  declared twice); `Property.model.ts:469` `deadline: S.String` ("ISO 8601 date or date-time": an instant kept as
  text); `MediaMetadata.model.ts:1331` `date: S.String` (when an email was sent); `Action.model.ts:864`
  `duration: S.String` ("as the wire's string": a number in a string, C1 says number); `Agent.model.ts:468`
  `name: S.String` (a field name; every other field name is a non-empty brand); `Object.model.ts:439` and
  `Link.model.ts:105` `__apiName: S.String` (private wire structs, re-branded later: fine in effect, listed for
  completeness).
- Looser than C10's own example "positive dimensions" (6): `MediaMetadata.model.ts:801-802` `width` / `height`,
  `MediaTransformation.model.ts:2695` `pageNumber`, `:1546` `chunkIndex`, `:2057` `attachmentIndex`, `:356`
  `numberOfChannels`, all `S.Finite` (admit `-2.5`). The reference `.d.ts` says `number`, so this is defensible
  under "narrow only when the wire guarantees it"; it is inconsistent with `PageSize` (`S.Int`, at least 1) and
  with `ArrayConstraint.minimumSize` (`S.Natural`).

### Check 2: law gates

```text
$ bun run beep laws native-runtime --check --include-prefix scratchpad/osdk/src
[effect-governance-native-runtime] scanned_files=104  warnings=0  errors=0            (exit 0)
$ bun run beep laws effect-imports --check --include-prefix scratchpad/osdk/src
[effect-governance-imports] scanned_files=105 scanned_fences=651 touched_files=0 manual_reviews=0   (exit 0)
$ bun run beep laws effect-fn --check --include <22 files>
[effect-governance-effect-fn] scanned_files=22 touched_files=0 violations=0           (exit 0; 104 files: also 0)
$ bun run beep laws terse-effect --check --include <22 files>
[effect-governance-terse-effect] helper_refs_simplified=9 flow_candidates_detected=1 nested_option_match_candidates_detected=2
[effect-governance-terse-effect] blocking_files=6
  ValueType/ValueType.behavior.ts:59:3 nested-option-match    Query/Query.behavior.ts:142:3 helper-ref
  ObjectType/ObjectType.policy.ts:437:3 flow-candidate        Filter/Filter.policy.ts:700:5, 715:71, 789:17 helper-ref
  Filter/Filter.policy.ts:786:5 nested-option-match           Ontology/Ontology.behavior.ts:298:23, 503:15 helper-ref
  Ontology/Ontology.policy.ts:461:20, 527:3, 640:24 helper-ref
error: script "beep" exited with code 1
```

Over all 105 source files the same gate reports 9 blocking files and 16 findings (adds `Link/Link.model.ts:241:22`,
`Query/Query.model.ts:893:24` and `:904:3`, `Value/Value.model.ts:460:28`).

### Check 3: consistency

- Discriminator: 113 `S.toTaggedUnion("type")`, 2 `S.toTaggedUnion("_tag")` (`Client.errors.ts:385, 422`, unions of
  `S.TaggedError`s: lawful). 21 plain `S.Union`: value unions without a tag on the wire. No other discriminator.
- Enum mapping: 190 kit sites, 66 `MappedLiteralKit`, 124 `LiteralKit`. Every mapped kit's domain side is
  lowerCamel. Raw kits that hold UPPER_CASE or non-camel literals (7):
  - `Media/MediaMetadata.model.ts:643` `Modality` (88 DICOM codes): lawful, codes of an external standard.
  - `Media/MediaTransformation.values.ts:581` `OcrLanguage` (123): defensible (language codes), though the doc's
    "the recognition engine's own" is not accurate: the engine spells them lowercase.
  - `Media/MediaTransformation.values.ts:735` `OcrScript` (37: `ARABIC`, `CANADIAN_ABORIGINAL`, `HANGUL_VERT`):
    English words in UPPER_SNAKE: a C1 violation (should be mapped: `arabic`, `canadianAboriginal`).
  - `Media/MediaTransformation.values.ts:816` `TranscriptionLanguage` (212: 100 codes then 112 names such as
    `CANTONESE`): the names half is a C1 violation. (The contract row said "as kits", so the agent followed the
    letter.)
  - `Geo/Geo.model.ts:476` `GeoJsonKind` (`Point` ...): lawful, a `type` tag as GeoJSON spells it.
  - `Object/Object.model.ts:430` `ReservedKey` (`__apiName` ...): lawful, private, wire keys.
  - `Faux/Faux.model.ts:65` `FauxErrorName` (PascalCase error names): lawful, the platform's error names.
  - Duplicated kits: `LinkCardinality` (`LinkType.model.ts:48`) and `InterfaceLinkCardinality`
    (`InterfaceType.model.ts:285`) are the same pairs; `OrderDirection` (`Aggregation.model.ts:69`, wire `ASC`) and
    `SortDirection` (`ObjectSet.model.ts:943`, wire `asc`) are one domain under two names.
- Key renames: 53 `S.encodeKeys` sites, 75 renames of 48 distinct wire keys. Consistent where it matters:
  `subType` -> `elementType` at all 5 array / set sites (and `boundType` for a range, a different thing),
  `itemType` -> `elementType`, `selectedPropertyApiName` -> `property` x4, `properties` -> `operands` x4,
  `required` -> `requireImplementation` x3. One real inconsistency: `propertyIdentifier` -> `selector`
  (`Property.model.ts:769`) and -> `property` (`ObjectSet.model.ts:554`). `value` -> `filters` x2 and -> `filter`
  (`Filter.model.ts:1087, 1129, 1168`) is correct (and / or / not).
- Naming: no `V2`, no `Schema` suffix, no `$` or `__` sigil, no `Wire` / `Modern` in any export name.
  `LegacyDataTypeKind` and `ClientError` contain words C5 bans but are names the contract itself assigned.
  Same name, different meaning across concepts (4): `StructConstraint` and `ArrayConstraint` (`Action.model.ts:2507,
  2562` evaluated constraints; `ValueType.model.ts:625, 664` value-type constraints), `aggregate`
  (`ObjectSet.behavior.ts:817` builds a derived selection; `Client.behavior.ts:517` runs a request), `count`
  (`Aggregation.behavior.ts:382` a metric; `Client.behavior.ts:418` an effect). Same name, same meaning (deliberate
  parallels): `valueCodec` x3, `fieldCodec` x2, `argumentsCodec` x2, and the 30 typed twins of the filter and set
  constructors in `Model`. Same name, same shape, redeclared: F8.
- Barrels: 33 of 33 have `@packageDocumentation`, one `export *` per role file, each with `@category` and `@since`.
- File-role grammar: 33 `model`, 13 `behavior`, 6 `policy`, 5 `values`, 2 `layer`, 1 each `errors`, `service`,
  `definition`, `rules`, `addressing`, `spec`, `object`, `filter`, `set`. Four files break `<Concept>/<Concept>.<role>`:
  `TimeSeries/GeotimeSeries.model.ts`, `Media/MediaMetadata.model.ts`, `Media/MediaTransformation.model.ts`,
  `Media/MediaTransformation.values.ts`. Validation lives in a `.behavior.ts` twice (`Shape.behavior.ts`
  `applyShape`, which README section 6 lists under validation, and `ValueType.behavior.ts` `constraintCheck`) where
  six concepts use `.policy.ts`.
- Tests per concept (C9 "one `test/<Concept>.test.ts` per concept"): 25 of 33 concepts have their own file. No own
  file: `Attachment`, `CipherText`, `Security` and the reference half of `Media` (in `References.test.ts`; the rest
  of `Media` in `MediaTransformation.test.ts`), `Link` (in `Subscription.test.ts`), `LinkType` (in
  `ObjectType.test.ts`), `DerivedProperty` (in `ObjectSet.test.ts`), `Page` (nowhere). Extra files that are not a
  concept: `Arguments`, `References`, `GeotimeSeries`, `MediaTransformation`, `Model.object`, `Readme`,
  `RecursionHint`.

### Check 4: documentation

- Exports: 1,896 (668 class, 643 const, 394 type, 101 `export *`, 74 namespace, 16 interface). With a doc block:
  1,896. With exactly one `@category` from the closed vocabulary: 1,896. With `@since 0.0.0`: 1,896. Files below
  100 percent: 0 of 105.
- Category histogram: models 1,261, identifiers 175, constructors 111, type-level 78, codecs 76, combinators 43,
  projections 31, validation 18, getters 17, policies 16, errors 14, queries 9, constants 8, layers 6, folding 5,
  value-objects 5, then 14 categories with 3 or fewer.
- Examples: 527 of 643 exported constants have a runnable Example. The 116 without: 71 brands and plain schemas (not in
  C8's list; 11 section G does require them), 13 kits, 1 union, 9 codecs, 4 functions, 18 spec constructors (F12). 107 of 668
  classes have one; of the 561 without, 478 are union members (exempt by C8) and 83 are standalone records
  (required by 11 section G, not by C8): 16 in `MediaMetadata.model.ts`, 14 in `Action.model.ts`, 12 in
  `Agent.model.ts`, 9 in `MediaTransformation.model.ts`, 8 in `Query.model.ts`.
- "Restates the name", doc leads: of 1,311 value exports, 6 leads draw 80 percent or more of their content words
  from the name (`ApplyActionRequest`: "A request to apply one action."; `ActionTypeApiName`: "API name of an action
  type."; `ExtractUnstructuredTextFromPageOperation`; `InterfaceLinkTypeApiName`; `InterfaceSharedPropertyType`;
  `DicomFileMetaInformation`). In a random sample of 25, 0 restate the name. Type companions: 392 of 394 use the
  formula "Runtime type of {@link X}." (allowed by C8; it is a restatement by construction).
- "Restates the name", schema descriptions: 1,155 identified descriptions; 7 at 80 percent or more (the same six
  plus `TransformMediaItemRequest`). In a random sample of 25, 0 restate the name.
- README section 6 (18 rows): every cited file and test exists and holds the claim. Spot-proved: `LongValue`
  (`test/Value.test.ts:485`), decimal scale (`:738-748`), 30 February (`:1109`), nested arrays
  (`test/Property.test.ts:1594`), first-colon split (`test/Object.test.ts:682`), 3D bounding box
  (`test/Geo.test.ts:525`; OSDK `makeGeoFilterBbox.ts:42, 46` does read `bbox[3]` and `bbox[2]`), last-dot metric
  name (`test/Aggregation.test.ts:1229`), SHA-256 (`test/Shape.test.ts:1039`), redaction
  (`test/References.test.ts:235, 389`), empty page with a token (`test/Client.test.ts:927`). One wrong pointer:
  "`Page/Page.model.ts` `TotalCount` ... held by `test/Client.test.ts`": the test exercises a `totalCount` field of
  `LoadObjectsResponse`, and `TotalCount` itself is named in no test (F9).
- README section 7: accurate as far as it goes; incomplete (F13).
- README section 4: "a schema never invents another [upgrade]" is false in two documented places (F15) and for the
  editorial enum renames (F7).
- README section 9: "Unions, kits, codecs, projections and public functions carry a runnable example" (F12).

### Check 6: tests

- Type-check: at the start of this review `tsrs -p scratchpad/osdk/tsconfig.json --noEmit --pretty false` printed
  nothing. At the end it prints 57 lines, every one from three scratch files that another reviewer placed in
  `test/` while this review ran (`_wireConformance.scratch.test-d.ts` 1, `_wireFixtures.scratch.test.ts` 30,
  `_wireRuntime.scratch.test.ts` 26: native string helpers and `JSON.stringify`). The package's own 105 source and
  32 test files are still clean. Two of the three match the vitest include glob, so they also change the test
  count until their owner removes them. This review's probes live outside the package.
- Doctests: `Test Files 71 passed (71)`, `Tests 651 passed (651)`, 32.63 s (matches README section 8).
- Default depth: `Test Files 32 passed (32)`, `Tests 3628 passed (3628)`, 6.64 s.
- `BEEP_FC_NUM_RUNS=300`: `Test Files 32 passed (32)`, `Tests 3628 passed (3628)`, 41.76 s. No failure, no timeout.
  113 `it.prop` sites, all with `fcRuns(n)` (61 at 50, 12 at 100, 8 at 25, 8 at 200), so the depth run does deepen
  them. 23 `Arbitrary.sampleEffect` sites use a fixed count and seed and do not deepen.
- Named schemas: 1,066. Never named in any test: 94 (90 `Media`, 3 `Page`, `FauxErrorName`).
- Five concepts read against their model:
  - `Media` (F10): (a) and (b) through unions only, at 25 runs; (c) 19 fixture calls for 91 tags; (d) key lists only;
    (e) 8 rejection tests, good.
  - `Page`: no test. (a)-(e) all missing for `PageSize`, `TotalCount`, `PageRequest`, `Page`.
  - `Model` (typed layer): `test/Model.test.ts` has 0 properties; agreement with `valueCodec` is sampled at fixed
    seeds (20 values per tag). 31 negative type tests cover tags, operands, names and links; none covers F1-F3
    because those compile. (c) and (e) are good.
  - `Client`: envelopes have (a), (c), (e); (b) is replaced by `wireStable` for the three requests that hold an
    object set (F4). The facade is tested against a stub transport with 14 effect tests: good coverage of paging
    and failure. No test that a `TypedObjectSet` reaches the facade whole (F2).
  - `Filter`: (a), (c), (d), (e) present for all 28 operators; (b) is `wireStable` for the 12 schemas that hold an
    operand; no law that `checkFilter` accepts every filter the typed constructors can build (the link between
    `Model.filter` and `Filter.policy` is tested on the operator sets, not on values).
