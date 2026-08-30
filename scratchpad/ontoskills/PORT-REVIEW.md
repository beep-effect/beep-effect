# OntoSkills schema-first port review

Audit target: `scratchpad/ontoskills/OntoSkills.models.ts` against
`~/YeeBois/dev/ontoskills/core/src/schemas.py` (559 lines). This is a read-only
port audit; the WIP file was not changed.

## Executive verdict

**The WIP is neither compilable nor behaviorally equivalent.** The bounded
check

```text
timeout 30s ./node_modules/.bin/tsgo -p scratchpad/tsconfig.json --noEmit --pretty false
scratchpad/ontoskills/OntoSkills.models.ts(397,5): error TS1109: Expression expected.
```

stops in the unfinished `RelationId` predicate. Static review also finds a
nonexistent import, an optional field promoted to the wrong discriminator,
large encoded-shape changes, an unrelated provenance type, an invalid workflows
placeholder, all of Phase 1/2 missing, and `CompiledSkill` missing.

Inventory baseline: 37 Python classes (including `SeverityLevel`), 2 aliases,
7 decorated behaviors, and 77 declared defaults. Section B accounts for all
123 items individually.

## A. API verification table

### A.1 Source selection and drift

Both the installed package and `.repos/effect` declare `4.0.0-rc.112`
(`node_modules/effect/package.json:2-4`,
`.repos/effect/packages/effect/package.json:2-4`). Byte comparison nevertheless
shows `Schema.ts` and `SchemaGetter.ts` differ; `SchemaTransformation.ts` is
identical. Therefore the installed `node_modules/effect` is authoritative for
what this checkout compiles today. Relevant signatures were cross-checked in
`.repos/effect`; discrepancies in line location are called out below.

### A.2 Imported symbols

| WIP import | Exists at that path? | Correct use / actual contract | Evidence |
| --- | --- | --- | --- |
| `$ScratchpadId` from `@beep/identity` | Yes | `.create(path)` returns the identity composer used for `$I`; `annote`, `annoteKey`, and `annoteSchema` are valid. The WIP's calls are mechanically valid. | `packages/foundation/modeling/identity/src/packages.ts:1667`; barrel `.../identity/src/index.ts:121`; annotation signatures `.../identity/src/Id.ts:1187-1222`, implementation `:1913-1948` |
| `* as S` from `effect/Schema` | Yes | Valid module path. Individual members are audited in A.3. | `node_modules/effect/src/Schema.ts` |
| `LiteralKit` from `@beep/schema/LiteralKit` | Yes | Valid subpath. It extends Effect `S.Literals` and adds the static surface described in A.4. | `packages/foundation/modeling/schema/package.json:194-195`; `.../LiteralKit/LiteralKit.schema.ts:639-652` |
| `* as SchemaUtils` from `@beep/schema/SchemaUtils` | Yes | Valid subpath; every referenced helper is re-exported. | `packages/foundation/modeling/schema/package.json:244-245`; `.../SchemaUtils/index.ts:12-77` |
| `* as Tuple` from `effect/Tuple` | Yes | `Tuple.evolve` is valid but is a positional, different-function-per-index tool. See A.4. | `node_modules/effect/src/Tuple.ts:513-585` |
| `pipe`, `flow` from `effect/Function` | Yes | Both exist. `flow` at line 376 is type-correct; `pipe` is unused. | `node_modules/effect/src/Function.ts:783-800`, `:1267-1285` |
| `* as Str` from `@beep/utils/Str` | Yes | The subpath exists and re-exports `effect/String`; `split` exists and is correctly usable data-last in `flow`. | `packages/foundation/modeling/utils/package.json:47-51`; `.../utils/src/Str.ts:816-830`; `node_modules/effect/src/String.ts:474-511` |
| `* as O` from `@beep/utils/Option` | Yes | The subpath re-exports Effect Option, but the namespace is unused. | `packages/foundation/modeling/utils/src/Option.ts:126`; `node_modules/effect/src/Option.ts:256-286`, `:371` |
| `* as P` from `@beep/utils/Predicate` | Yes | The subpath re-exports Effect Predicate, but the namespace is unused. | `packages/foundation/modeling/utils/src/Predicate.ts:138` |
| `NonNegativeInt`, `PosInt` from `@beep/schema/Int` | **Mixed: first no, second yes** | `PosInt` is exported and checks `> 0`. `NonNegativeInt` is **not** in `Int.ts`; it is exported from `@beep/schema/Number` and the package root. Lines 266/281/296/312 therefore cannot type-check after the parser error is fixed. | `.../schema/src/Int.ts:30-41`, `:77-106`; actual `NonNegativeInt` at `.../schema/src/Number.ts:190-226`; root barrel `.../schema/src/index.ts:9` |
| `Sha256` from `@beep/shared-domain/entity/primitives` | Yes | A branded SHA-256 hex schema. It is stronger than Python's unconstrained `str`; that is a compatibility change requiring an explicit redesign decision and tests. | `packages/shared/domain/src/entity/primitives.ts:66-83` |
| `ProvO`, `URI` from `@beep/rdf` | Yes | Both export. `URI` is a generic RFC 3986 branded URI, not the `oc:` state grammar. `ProvO` is a structured `ProvBundle | ProvRecord`, not Python's `Optional[str]`. `URI.make(...)` is a valid inherited schema constructor, although the WIP's array-field example has the wrong value shape. | `packages/foundation/modeling/rdf/src/Uri.ts:339-350`; `.../rdf/src/Prov.ts:1085-1115`; schema `make` contract `node_modules/effect/src/Schema.ts:189-218` |
| `SemverFromString` from `@beep/schema/Semver` | Yes | Decodes a string to a structured `Semver` value. Python stores `version` as arbitrary `Optional[str]`; this narrows and changes the Type side. | `packages/foundation/modeling/schema/src/Semver.ts:650-676` |
| `SchemaGetter` from `effect` | Yes | Root namespace export exists, but this import is unused. Getter signatures relevant to transformations are in A.6. | `node_modules/effect/src/index.ts:532`; `node_modules/effect/src/SchemaGetter.ts:521-523`, `:561-565`, `:597-599` |
| `* as A` from `@beep/utils/Array` | Yes | Re-exports Effect Array. `A.every(RelationIdPart.is)` is valid; using it after `S.Array(PatternPart)` is redundant because element decoding already validates every element. | `packages/foundation/modeling/utils/src/Array.ts:617`; `node_modules/effect/src/Array.ts:8609-8648` |
| `NonEmptyTrimmedStr` from `@beep/schema` | Yes | Root barrel exports it; it trims, checks non-empty, brands, and has codec statics. It is unused. | `packages/foundation/modeling/schema/src/String.ts:64-89`; root barrel `.../schema/src/index.ts:474` |

### A.3 Every Effect schema member used by the WIP

| `S.*` member | Exists? | Signature / use verdict | Evidence |
| --- | --- | --- | --- |
| `S.Literal<T>` | Yes | The generic interface has a `.literal` value. The factory callbacks correctly accept literal member schemas. | `node_modules/effect/src/Schema.ts:2757-2794` |
| `S.String`, `S.Boolean` | Yes | Primitive schemas; uses are mechanically correct. | `node_modules/effect/src/Schema.ts:3136-3192` |
| `S.Int` (used in C) | Yes | Number schema checked as an integer; it preserves Python's unconstrained integer sign domain. | `node_modules/effect/src/Schema.ts:8343-8353` |
| `S.Struct(fields)` | Yes | Returns a schema for the exact fields. Factory uses are valid, but several model choices are not. | `node_modules/effect/src/Schema.ts:3477-3581` |
| `S.Array` | Yes | Unary pipeable lambda producing `ReadonlyArray` Type and Encoded arrays. Every `value.pipe(S.Array)` use is syntactically lawful and strict: it does not drop invalid elements. | `node_modules/effect/src/Schema.ts:4605-4652` |
| `S.NonEmptyArray` | Yes | Unary array constructor requiring at least one element. Line 382 is valid in isolation; its following `A.every(PatternPart.is)` repeats validation already performed by the element schema. | `node_modules/effect/src/Schema.ts:4660-4699` |
| `S.Union` (needed by recommendations) | Yes | Takes an array of schemas; Type and Encoded are member unions. | `node_modules/effect/src/Schema.ts:4839-4927` |
| `S.Class<Self>(identifier)(fields, annotations)` | Yes | WIP class construction is valid. Empty bodies are valid. Non-class schemas still need colocated `export type Name = typeof Name.Type`. | `node_modules/effect/src/Schema.ts:14317-14344`, `:14660-14705`; governing rule `standards/schema-first-development-prompt.md:183-194` |
| `S.tag(literal)` | Yes | A `Literal` plus **constructor-only** default. It makes the tag omittable to `.make`, but the tag remains required on the encoded wire. WIP uses are mechanically valid. | `node_modules/effect/src/Schema.ts:6076-6102` |
| `S.toTaggedUnion(tag)` | Yes | Requires an `S.Union` whose members' Type has the tag. It adds `cases`, `guards`, `isAnyOf`, `match`, and `matchOrElse`; all four WIP calls are mechanically valid. Their domain modeling is not. | `node_modules/effect/src/Schema.ts:6200-6330` |
| `S.OptionFromOptionalKey` | Yes | Missing encoded key becomes `Option.none`; `Some` encodes the key and `None` omits it. It does **not** accept explicit JSON `null`. Thus it is not automatic parity for Python `Optional[T] = None`. | installed `node_modules/effect/src/Schema.ts:9868-9887`; reference checkout `.repos/effect/packages/effect/src/Schema.ts:9816-9834` |
| `S.OptionFromNullOr` (used in C) | Yes | Required encoded `null | T` decodes to `Option<T>`; None encodes back to null. Combine with a missing-key decoding/constructor default when Python accepts both omission and null. | `node_modules/effect/src/Schema.ts:9776-9795` |
| `S.DurationFromMillis` | Yes | Codec from numeric milliseconds to `Duration`; NaN decodes as zero. Line 70 changes Python's `Optional[int]` Type into `Option<Duration>`, and the source does not establish milliseconds as its unit. | installed `node_modules/effect/src/Schema.ts:12514-12539`; reference checkout `.repos/effect/packages/effect/src/Schema.ts:12203-12229` |
| `S.check(...checks)` / `.check(...)` | Yes | Appends one or more runtime checks without changing the TypeScript type. Calls are valid; checks cannot perform normalization. | installed `node_modules/effect/src/Schema.ts:5116-5140`; reference checkout `.../Schema.ts:5133-5140` |
| `S.isPattern(regexp, annotations?)` | Yes | Returns a string filter. Line 358 correctly refines a string, but its annotations have only `message`; reusable checks must also supply identifier/title/description under the governing standard. | `node_modules/effect/src/Schema.ts:6803-6833`; standard `standards/schema-first-development-prompt.md:196-203` |
| `S.makeFilter(predicate, annotations?, abort?)` | Yes | Predicate may return boolean, issue(s), or success `undefined`. It is a validator, not a mapper. The outer RelationId predicate never returns and cannot implement the Python normalization even if completed as a boolean. | `node_modules/effect/src/Schema.ts:6659-6716` |
| `S.makeFilterGroup(checks, annotations?)` | Yes | Groups a non-empty list of checks. One check at lines 374-378 does not need a group. | `node_modules/effect/src/Schema.ts:6718-6730` |
| `S.brand(name)` | Yes | Adds nominal Type metadata; it does no validation. Line 379 is lawful only because the preceding check is supposed to validate. | `node_modules/effect/src/Schema.ts:5198-5240`; AST implementation `node_modules/effect/src/SchemaAST.ts:3563-3567` |

### A.4 `LiteralKit`, `mapMembers`, and the 31-way repetition

`LiteralKit` inherits Effect `S.Literals`, whose exact method is

```ts
mapMembers<To extends ReadonlyArray<S.Constraint>>(
  f: (members: this["members"]) => To
): S.Union<...>
```

and whose implementation is literally `Union(f(this.members))`
(`node_modules/effect/src/Schema.ts:4936-4945`, `:4969-4979`).
`Tuple.evolve` accepts a positional array of transform functions and applies
the function at each index (`node_modules/effect/src/Tuple.ts:513-585`). Thus
all four `mapMembers(Tuple.evolve([...]))` expressions are API-correct when the
function list has the member count. They are still the wrong abstraction for
identical payloads.

`Tuple.map` is the verified same-function-over-every-member operation, but it
requires a `Struct.Lambda`, not a plain generic factory
(`node_modules/effect/src/Tuple.ts:734-773`). A direct `A.map` is shorter at
runtime but normally loses the per-position tuple precision; the local
`LiteralKit.toTaggedUnion` implementation uses that route behind a controlled
assertion (`packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:791-813`).

The lawful terse answer for this WIP is more fundamental: **do not create a
tagged union when every literal has the identical payload**. Model
`Requirement` as one class/struct with `type: RequirementType`,
`ExecutionPayload` with `executor: ExecutionPayloadExecutor`,
`TemplateAnnotation` with `templateType: TemplateAnnotationType`, and
`KnowledgeNode` with `nodeType: KnowledgeNodeType`. The standard requires
discrimination for *case-specific payloads* and forbids nesting merely to show
an API (`standards/schema-first-development-prompt.md:250-261`). None of these
four has case-specific payloads in Python. This removes all 43 repeated factory
references and fixes the invented nesting/discriminator drift.

For genuine variant families, `LiteralKit` exposes `.Options`, `.HashSet`,
`.is`, `.Enum`, `.pickOptions`, `.omitOptions`, `.$match`, `.thunk`, and
`.toTaggedUnion` (`.../LiteralKit/LiteralKit.schema.ts:639-652`). Its
`.toTaggedUnion(tag)(cases)` is the preferred local builder when cases truly
have different fields.

### A.5 SchemaUtils defaults and statics

| Helper | Exists / pipe position | Contract actually affected | Verdict in WIP | Evidence |
| --- | --- | --- | --- | --- |
| `withStatics(factory)` | Yes; data-last pipe transform | Attaches arbitrary statics and preserves them across later `annotate`. | Factory attachment is correct. It is unnecessary once identical tagged members are removed. | `.../SchemaUtils/withStatics.ts:44-84`, `:121-124` |
| `withCodecStatics` | Yes; unary | Adds `is`, throwing `fromUnknown`, and non-throwing `decodeOption`. | Valid on `RelationIdPart`; the schema itself is under-annotated. | `.../SchemaUtils/withCodecStatics.ts:44-64`, `:92-99` |
| `withOptionCodecStatics` | Yes; unary, service-free codecs only | Adds Option-based direct and JSON-string decode/encode statics plus shared statics. | Line 385 is valid in isolation but `PatternParts` is unused and redundant. | `.../SchemaUtils/codecStatics.ts:217-233`, `:544-560` |
| `withNoneDefault` | Yes; unary | **Constructor default only**: `.make({})` supplies `Option.none`. It does not make an encoded key optional and does not define decode behavior. | Valid after `OptionFromOptionalKey`, but missing decode is already None because of that codec. It still does not accept encoded `null`. | `.../SchemaUtils/withConstructorDefaults.ts:49-54`; Effect constructor-only contract `node_modules/effect/src/Schema.ts:5797-5829` |
| `withConstantDefault(value)` | Yes; data-last | **Constructor default only**; encoded key stays required and decoding an omitted key fails. | Not used. Appropriate only where constructor convenience must not change the wire. | `.../SchemaUtils/withConstructorDefaults.ts:56-91` |
| `withKeyDefaults(value)` | Yes; dual/data-last | Combines constructor default with `S.withDecodingDefaultTypeKey`: encoded key becomes exact-optional, missing decode gets a Type-side default, encoding includes the value by default. | Correct for Python fields whose omitted input is valid and has the same canonical default, e.g. `optional=False`. | `.../SchemaUtils/withKeyDefaults.ts:53-72`; underlying contracts `node_modules/effect/src/Schema.ts:5844-5955` |
| `withEmptyArrayDefaults` | Yes; unary or `()` | Same constructor + decode-side missing-key behavior as `withKeyDefaults`, specialized to a fresh empty readonly array. | Mechanically correct for actual `default_factory=list` fields; wrong when applied to required `intents`. | `.../SchemaUtils/withKeyDefaults.ts:74-87`, `:120-172` |

The source standard explicitly separates constructor defaults, decoding
defaults, and encoded optionality (`standards/schema-first-development-prompt.md:207-218`).
Python `Optional[T] = None` accepts both omission and explicit `null`; use the
`S.OptionFrom*` codec matching the wire, for example an `OptionFromNullOr`
field plus a missing-key default when null must round-trip. `OptionFromOptionalKey`
instead deliberately normalizes absence to omitted encoding.

### A.6 Recursion, class extension, transformations, JSON, and lenient boundaries

| Mechanism | Verified contract | Evidence |
| --- | --- | --- |
| `S.suspend(() => schema)` | Defers schema evaluation; canonical for recursion. `S.Codec<T, E, RD, RE>` explicitly carries Type and Encoded. | `node_modules/effect/src/Schema.ts:1041-1046`, `:5066-5113` |
| In-repo recursive pattern | Declare `Type`/`Encoded` namespaces and annotate the thunk: `S.Array(S.suspend((): S.Codec<Inline.Type, Inline.Encoded> => Inline))`. | `packages/foundation/modeling/md/src/Md.model.ts:305-311`, namespace `:1154-1187` |
| `Parent.extend<Child>(identifier)(fields, annotations?)` | Identifier is required in installed v4. The prompt's shorthand `Parent.extend<X>()` is stale/incomplete for rc.112. | `node_modules/effect/src/Schema.ts:14389-14409`, implementation `:14482-14500`, official example `:14635-14651`; repo example `packages/shared/domain/src/values/Rule/Rule.model.ts:126-164` |
| `S.decodeTo(target, transformation)` | Source schema is piped in; result has target Type and source Encoded. The typed `decode` Getter maps source Type to target Encoded, and `encode` maps back. | installed `node_modules/effect/src/Schema.ts:5507-5527`, `:5585-5609`; reference checkout `.repos/effect/packages/effect/src/Schema.ts:5505-5599` |
| `SchemaTransformation.make` / `transform` / `transformOrFail` | `make` takes Getters; `transform` takes pure `{ decode, encode }`; `transformOrFail` takes functions returning `Effect<value, SchemaIssue.Issue>`. Runtime probe confirmed `decode("yes") -> true`, `encode(false) -> "no"`. | installed and reference-identical `SchemaTransformation.ts:143-165`, `:232-240`, `:286-294`, `:335-343` |
| `SchemaGetter` | `transform` wraps a pure present-value mapping; `transformOrFail` wraps an Effectful fallible mapping; `transformOptional` sees absence as `Option`. | installed `SchemaGetter.ts:521-523`, `:561-565`, `:597-599`; reference checkout `SchemaGetter.ts:551`, `:591`, `:627` |
| `S.fromJsonString(schema)` | Parses a JSON string, then decodes through `schema`; encoding runs the schema then `JSON.stringify`. `S.UnknownFromJsonString` also exists. | installed `node_modules/effect/src/Schema.ts:12756-12801`; reference checkout `.repos/effect/packages/effect/src/Schema.ts:12404-12449` |
| `S.decodeUnknownResult` | Synchronous non-throwing boundary returning `Result<Type, SchemaError>`. Suitable for deliberate inspect/drop policies. | `node_modules/effect/src/Schema.ts:1755-1777`; standard `standards/schema-first-development-prompt.md:600-605` |
| `S.decodeUnknownEffect` | Default Effect-returning external-boundary decoder. | `node_modules/effect/src/Schema.ts:1500-1523`; standard `standards/schema-first-development-prompt.md:233-235` |
| Array element dropping | No `S.Array` option in rc.112 drops invalid elements or emits warnings; Array is strict. Implement element-wise decode plus an owning boundary policy. `Effect.forEach`, `matchEffect`, `logWarning`, `map`, `as`, Option `some`/`none`, and `A.getSomes` all exist. | `node_modules/effect/src/Effect.ts:1088-1108`, `:3678-3688`, `:3837`, `:11055-11068`, `:22272`; `node_modules/effect/src/Option.ts:256-286`; `node_modules/effect/src/Array.ts:7692-7701` |
| Boolean string codec | No exported `S.BooleanFromString` exists in either source tree. There is only a private internal `booleanToString` link. The repo exports `NormalizedBooleanString`, implemented with `S.decodeTo` + `SchemaTransformation.transform`, but it additionally trims and treats `"on"` as true. | private `node_modules/effect/src/Schema.ts:16294-16299`; local `packages/foundation/modeling/schema/src/CommonTextSchemas.ts:15-19`, `:131-142` |
| Derived helpers | `S.is(schema)` derives a guard and `S.toEquivalence(schema)` derives structural equivalence. | `node_modules/effect/src/Schema.ts:1425-1442`, `:15577-15597`; real class-static use `packages/foundation/ui-system/dock/src/Dock.models-tree.ts:318` |
| String/array helpers used in C | `Str.trim`, `toLowerCase`, `replace`, `startsWith`, `split`; `A.lastNonEmpty`, `every`, `getSomes` all exist through the `@beep/utils` re-exports. | `node_modules/effect/src/String.ts:219`, `:283`, `:319`, `:474`, `:548`; `node_modules/effect/src/Array.ts:2016`, `:7692`, `:8609`; re-exports `.../utils/src/Str.ts:830`, `.../utils/src/Array.ts:617` |
| Additional checks used in C | `S.isNonEmpty` and `S.isMaxLength` are built-in checks; `S.encodeKeys` preserves camelCase Type fields with snake_case Encoded keys. | `node_modules/effect/src/Schema.ts:8942-8943`, `:8966-8984`, `:3651-3707` |

## B. Disposition ledger (Python -> TypeScript)

Disposition is about behavioral capability, not merely whether a similar name
appears. `ported` means the item itself is recognizably preserved;
`redesigned-ok` means a stronger local representation preserves the capability
and has no identified compatibility loss. A nested but unreferenced class is
not an effective port of a source field.

### B.1 Classes, aliases, validators, and computed fields

| Source item | Source lines | Disposition | TS target | What behavior is lost or changed | Recommended fix |
| --- | ---: | --- | --- | --- | --- |
| `Requirement` | 10-13 | `misported` | `Requirement` 44-57 | Shape is similar, but an identical-payload 5-way union was invented. | One class/struct with `type: RequirementType`, `value`, `optional`. |
| `ExecutionPayload` | 16-19 | `misported` | `ExecutionPayload` 78-93 | Identical-payload union invented; timeout becomes `Duration`; null is rejected. | One class with `executor: ExecutionPayloadExecutor`; retain integer contract unless unit redesign is proved. |
| `StateTransition` | 22-44 | `misported` | `StateTransition` 103-121 | Snake_case wire renamed without adapter; generic URI is broader; validator absent. | Add `StateUri`, snake_case encoded keys if compatibility matters, and keep list defaults. |
| `StateTransition.validate_state_uris` | 32-44 | `missing` | — | Exact `oc:` grammar is not enforced. | Put a branded checked `StateUri` on all three arrays; C.1. |
| `SeverityLevel` | 47-52 | `ported` | `SeverityLevel` 123-158 | Literal set is preserved. Its attached factory wrongly drives an invented union. | Keep only the LiteralKit domain. |
| `KnowledgeNodeType` alias | 56-79 | `ported` | `KnowledgeNodeType` 176-213 | All 31 literals are preserved. | Keep the LiteralKit; use it as the `nodeType` field. |
| `KnowledgeNode` | 82-97 | `misported` | `KnowledgeNodeInner` 162-174 + `KnowledgeNode` 216-257 | Flat object becomes `{ type, node }`; discriminator changes from required `node_type` to required severity; optional severity is made required; `has_rationale` is misspelled/required/string. | One flat class with `nodeType: KnowledgeNodeType` and optional severity/rationale fields. |
| `CodeAnnotation` | 100-104 | `misported` | `CodeAnnotation` 264-274 | Invalid `NonNegativeInt` import; even the real schema narrows Python's unconstrained `int`; snake_case policy is unstated. | Use `Int` unless nonnegative data is proved, then add annotations/encoded parity. |
| `TableAnnotation` | 107-110 | `misported` | `TableAnnotation` 279-288 | Same invalid import and unproved nonnegative narrowing. | Use `Int` unless strengthening is documented. |
| `FlowchartAnnotation` | 113-116 | `misported` | `FlowchartAnnotation` 294-303 | Same invalid import and unproved nonnegative narrowing. | Use `Int` unless strengthening is documented. |
| `TemplateAnnotation` | 119-122 | `misported` | `TemplateAnnotation` 323-338 | `template_type` becomes `type`; identical-payload tagged union is unnecessary; index import/narrowing is wrong. | One class with `templateType: TemplateAnnotationType` and source-compatible index. |
| `ExtractedSkill` | 125-275 | `misported` | `ExtractedSkill` 417-449 | Major shape/type/default drift; most metadata and annotations are moved under optional wrappers that are not part of this class; validators and computed field are absent. | Rebuild field-for-field, then apply explicit, tested boundary redesigns only. |
| `ExtractedSkill.validate_skill_relation_ids` | 160-190 | `misported` | broken `RelationId` 358-399 | Attempt is syntactically incomplete, is a filter rather than normalization, and is not used by relation fields. | Replace with a String-to-branded-String transform and use it in all three arrays; C.2. |
| `ExtractedSkill.coerce_is_user_invocable` | 192-200 | `missing` | — | Strings such as `"yes"` and `"1"` fail Boolean decoding. | Boolean|string boundary codec; C.3. |
| `ExtractedSkill.parse_and_clean_nested_data` | 202-269 | `missing` | — | JSON-string inputs fail; malformed knowledge nodes are not dropped/warned. | Strict object-or-JSON codecs plus an explicit collection decode policy; C.4. |
| `ExtractedSkill.skill_type` | 271-275 | `missing` | — | No `executable`/`declarative` derived behavior. | Colocate a pure static/getter; C.5. |
| `Frontmatter` | 282-327 | `missing` | — | Entire frontmatter boundary shape absent. `ExtractedSkillMeta` is a different model. | Add schema class with name/description codecs and metadata default. |
| `Frontmatter.validate_name` | 294-318 | `missing` | — | Normalization, reserved names, non-empty, and max length all absent. | Transform -> checks -> brand; C.6. |
| `Frontmatter.validate_description` | 320-327 | `missing` | — | Length and tag rejection absent. | Built-in max-length plus annotated custom no-tag check; C.7. |
| `FileInfo` | 330-335 | `missing` | — | File inventory shape absent. | Add class. |
| `CodeBlock` | 338-345 | `missing` | — | Extracted code-block shape absent. | Add class; literal block type need not create a separate union. |
| `MarkdownTable` | 348-354 | `missing` | — | Table extraction shape absent, including required-but-nullable caption. | Add class and preserve caption boundary semantics. |
| `FlowchartBlock` | 357-362 | `missing` | — | Flowchart extraction shape absent. | Add class. |
| `ProcedureStep` | 365-369 | `missing` | — | Recursive `children: list[ContentBlock]` absent. | Use suspended ContentBlock codec; C.8. |
| `OrderedProcedure` | 372-376 | `missing` | — | Procedure block absent. | Add class containing `ProcedureStep[]`. |
| `TemplateBlock` | 379-384 | `missing` | — | Template block absent. | Add class. |
| `Paragraph` | 387-391 | `missing` | — | Paragraph block absent. | Add class. |
| `BulletItem` | 394-398 | `missing` | — | Recursive bullet children absent. | Add class with suspended ContentBlock. |
| `BulletListBlock` | 401-405 | `missing` | — | Bullet-list block absent. | Add class. |
| `BlockQuoteBlock` | 408-413 | `missing` | — | Blockquote and nullable attribution absent. | Add class preserving explicit-null policy. |
| `HTMLBlock` | 416-420 | `missing` | — | HTML block absent. | Add class. |
| `FrontmatterBlock` | 423-428 | `missing` | — | Raw frontmatter block absent. | Add class with empty-record default. |
| `HeadingBlock` | 431-436 | `missing` | — | Heading block absent. | Add class. |
| `ContentBlock` alias | 439-444 | `missing` | — | Eleven-member `block_type` discriminated union absent. | Implement real tagged union; this one does have case-specific payloads. |
| `Section` | 447-453 | `missing` | — | Recursive subsections and content absent. | Suspended self codec and ContentBlock array; C.8. |
| `ContentExtraction` | 456-463 | `missing` | — | Aggregated extraction collections absent. | Add class with six array defaults. |
| `FlatBlock` | 466-473 | `missing` | — | Flattened block projection absent. | Add class. |
| `SkeletonNode` | 476-479 | `missing` | — | Recursive skeleton tree absent. | Suspended self codec; C.8. |
| `SkeletonListItem` | 482-485 | `missing` | — | List-item text block and child block-ID list absent. | Add a normal class; `children` is `string[]`, not recursive. |
| `DocumentSkeleton` | 488-491 | `missing` | — | Skeleton sections and list-item map absent. | Add class with dictionary defaults and nested list-item values. |
| `DirectoryScan` | 494-504 | `missing` | — | Scan summary absent. | Add class; preserve nullable content extraction. |
| `ReferenceFile` | 511-514 | `missing` | — | Phase 2 reference-file model absent. | Add class. |
| `Example` | 517-522 | `missing` | — | Example model absent. | Add class. |
| `WorkflowStep` | 525-530 | `missing` | — | Workflow step and dependency IDs absent. | Add class; decide whether dependency IDs share RelationId grammar. |
| `Workflow` | 533-538 | `missing` | — | Workflow model absent. | Add class with steps. |
| `CompiledSkill extends ExtractedSkill` | 545-559 | `missing` | — | Inheritance plus compiled artifacts absent. | Use installed-v4 `.extend<CompiledSkill>(identifier)`; C.9. |

### B.2 Declared defaults

#### Core and knowledge-node defaults

| Source item | Source lines | Disposition | TS target | What behavior is lost or changed | Recommended fix |
| --- | ---: | --- | --- | --- | --- |
| `Requirement.optional = False` | 13 | `ported` | line 34 | Constructor and missing-key decode both default false. | Retain on the single Requirement model. |
| `ExecutionPayload.timeout = None` | 19 | `misported` | line 70 | Omission becomes None, but explicit null is rejected; Type changes int -> Duration. | Match null/omission boundary and preserve/declare units. |
| `StateTransition.requires_state = []` | 28 | `ported` | line 106 | Empty default retained; URI invariant is separate and missing. | Retain with `StateUri[]`. |
| `StateTransition.yields_state = []` | 29 | `ported` | line 113 | Empty default retained. | Retain with `StateUri[]`. |
| `StateTransition.handles_failure = []` | 30 | `ported` | line 115 | Empty default retained. | Retain with `StateUri[]`. |
| `KnowledgeNode.applies_to_context = None` | 91 | `misported` | lines 135-138 | Exists only inside required severity variant; explicit null rejected. | Flat optional/null-aware field. |
| `KnowledgeNode.has_rationale = None` | 92 | `misported` | line 139 | Renamed `hasRational` and made required; source is optional string. | `hasRationale: Option<string>` with correct boundary. |
| `KnowledgeNode.severity_level = None` | 93 | `misported` | line 133 | Promoted to required discriminator. | Optional `SeverityLevel` field; `nodeType` is required. |
| `KnowledgeNode.code_language = None` | 95 | `misported` | lines 140-143 | Nested under severity; explicit null rejected. | Flat optional/null-aware string. |
| `KnowledgeNode.step_order = None` | 96 | `misported` | lines 144-147 | Nested, null rejected, and unconstrained int is narrowed to positive. | Preserve int unless positivity is a documented redesign. |
| `KnowledgeNode.template_variables = None` | 97 | `misported` | lines 148-151 | Nested under required severity; explicit null rejected. | Flat optional/null-aware array. |

#### `ExtractedSkill` defaults

| Source item | Source lines | Disposition | TS target | What behavior is lost or changed | Recommended fix |
| --- | ---: | --- | --- | --- | --- |
| `ExtractedSkill.requirements = []` | 132 | `ported` | line 425 | Empty default retained; element model is misdesigned. | Retain after fixing Requirement. |
| `ExtractedSkill.depends_on = []` | 133 | `ported` | line 426 | Empty default retained, but elements bypass normalization. | Change element to RelationId. |
| `ExtractedSkill.extends = []` | 134 | `ported` | line 427 | Empty default retained, but elements bypass normalization. | Change element to RelationId. |
| `ExtractedSkill.contradicts = []` | 135 | `ported` | line 428 | Empty default retained, but elements bypass normalization. | Change element to RelationId. |
| `ExtractedSkill.state_transitions = None` | 136 | `misported` | line 429 | Core optional-single-object shape matches, but explicit null and JSON-string input are rejected. | Null-aware Option of StateTransition accepting object or JSON string at ingress. |
| `ExtractedSkill.generated_by = "unknown"` | 137 | `ported` | lines 430-432 | Constructor and missing decode default retained. | Keep. |
| `ExtractedSkill.execution_payload = None` | 138 | `misported` | lines 433-436 | Explicit null rejected and payload itself is misdesigned. | Null-aware Option plus fixed payload. |
| `ExtractedSkill.provenance = None` | 139 | `misported` | lines 437-440 | Explicit null rejected and `str` becomes structured PROV-O. | Use optional string unless redesign is specified and adapted. |
| `ExtractedSkill.knowledge_nodes = []` | 140 | `ported` | line 441 | Empty default retained; element shape and lenient policy are not. | Retain after fixing element codec/boundary policy. |
| `ExtractedSkill.category = None` | 143 | `misported` | line 342 | Moved into optional `meta`, which ExtractedSkill does not expose; null rejected. | Put field on ExtractedSkill or add an explicit total adapter. |
| `ExtractedSkill.version = None` | 144 | `misported` | line 343 | Moved/unwired, null rejected, arbitrary string narrowed to structured Semver. | Preserve string or document/prove Semver redesign. |
| `ExtractedSkill.license = None` | 145 | `misported` | line 344 | Moved into unreferenced optional meta; null rejected. | Restore field/adapt explicitly. |
| `ExtractedSkill.author = None` | 146 | `misported` | line 345 | Moved into unreferenced optional meta; null rejected. | Restore field/adapt explicitly. |
| `ExtractedSkill.package_name = None` | 147 | `misported` | line 346 | Moved into unreferenced optional meta; null rejected. | Restore field/adapt explicitly. |
| `ExtractedSkill.is_user_invocable = True` | 148 | `misported` | line 347 | Default exists only in unreferenced meta and source coercion is gone. | Restore flat field with Boolean|string ingress codec. |
| `ExtractedSkill.argument_hint = None` | 149 | `missing` | — (`argumentHints` line 348 is different) | Singular nullable string becomes plural array defaulting empty, and is unreferenced. | Restore `argumentHint: Option<string>` with encoded key mapping. |
| `ExtractedSkill.allowed_tools = []` | 150 | `misported` | line 349 | Default is in unreferenced meta. | Restore effective field. |
| `ExtractedSkill.aliases = []` | 151 | `misported` | line 350 | Default is in unreferenced meta. | Restore effective field. |
| `ExtractedSkill.code_annotations = []` | 154 | `missing` | line 405 in unreferenced class | Not present on ExtractedSkill. | Add field or an explicit nested adapter. |
| `ExtractedSkill.table_annotations = []` | 155 | `missing` | line 406 in unreferenced class | Not present on ExtractedSkill. | Add field or adapter. |
| `ExtractedSkill.flowchart_annotations = []` | 156 | `missing` | line 407 in unreferenced class | Not present on ExtractedSkill. | Add field or adapter. |
| `ExtractedSkill.template_annotations = []` | 157 | `missing` | line 408 in unreferenced class | Not present on ExtractedSkill. | Add field or adapter. |
| `ExtractedSkill.workflows = []` | 158 | `misported` | line 409 in unreferenced class | Becomes default `["workflow"]` and element type literal `"workflow"`, not `Workflow`. | Implement Workflow and default an array of it to empty. |

#### Frontmatter and Phase 1 defaults

| Source item | Source lines | Disposition | TS target | What behavior is lost or changed | Recommended fix |
| --- | ---: | --- | --- | --- | --- |
| `Frontmatter.version = None` | 291 | `missing` | — | Nullable frontmatter version absent. | Add null-aware optional string. |
| `Frontmatter.metadata = {}` | 292 | `missing` | — | Metadata dictionary and fresh default absent. | Add record schema with decoding/constructor empty default. |
| `CodeBlock.block_type = "code_block"` | 340 | `missing` | — | Canonical discriminator default absent. | `S.tag("code_block")` plus appropriate wire default policy. |
| `CodeBlock.content_order = 0` | 345 | `missing` | — | Canonical order default absent. | Nonnegative/integer schema with key default 0 if omission is accepted. |
| `MarkdownTable.block_type = "table"` | 350 | `missing` | — | Canonical discriminator default absent. | Add tag/default. |
| `MarkdownTable.content_order = 0` | 354 | `missing` | — | Canonical order default absent. | Add key default 0. |
| `FlowchartBlock.block_type = "flowchart"` | 359 | `missing` | — | Canonical discriminator default absent. | Add tag/default. |
| `FlowchartBlock.content_order = 0` | 362 | `missing` | — | Canonical order default absent. | Add key default 0. |
| `ProcedureStep.children = []` | 369 | `missing` | — | Fresh recursive child list default absent. | Suspended ContentBlock array with empty default. |
| `OrderedProcedure.block_type = "ordered_procedure"` | 374 | `missing` | — | Canonical discriminator default absent. | Add tag/default. |
| `OrderedProcedure.content_order = 0` | 376 | `missing` | — | Canonical order default absent. | Add key default 0. |
| `TemplateBlock.block_type = "template"` | 381 | `missing` | — | Canonical discriminator default absent. | Add tag/default. |
| `TemplateBlock.content_order = 0` | 384 | `missing` | — | Canonical order default absent. | Add key default 0. |
| `Paragraph.block_type = "paragraph"` | 389 | `missing` | — | Canonical discriminator default absent. | Add tag/default. |
| `BulletItem.children = []` | 398 | `missing` | — | Fresh recursive child list default absent. | Suspended ContentBlock array with empty default. |
| `BulletListBlock.block_type = "bullet_list"` | 403 | `missing` | — | Canonical discriminator default absent. | Add tag/default. |
| `BlockQuoteBlock.block_type = "blockquote"` | 410 | `missing` | — | Canonical discriminator default absent. | Add tag/default. |
| `BlockQuoteBlock.attribution = None` | 412 | `missing` | — | Nullable attribution absent. | Add boundary-accurate Option codec. |
| `HTMLBlock.block_type = "html_block"` | 418 | `missing` | — | Canonical discriminator default absent. | Add tag/default. |
| `FrontmatterBlock.block_type = "frontmatter"` | 425 | `missing` | — | Canonical discriminator default absent. | Add tag/default. |
| `FrontmatterBlock.properties = {}` | 427 | `missing` | — | Fresh dictionary default absent. | Add record with empty default. |
| `HeadingBlock.block_type = "heading"` | 433 | `missing` | — | Canonical discriminator default absent. | Add tag/default. |
| `Section.content = []` | 452 | `missing` | — | Fresh ContentBlock list default absent. | Add suspended union array with empty default. |
| `Section.subsections = []` | 453 | `missing` | — | Fresh recursive section list default absent. | Add suspended self array with empty default. |
| `ContentExtraction.sections = []` | 458 | `missing` | — | Sections collection default absent. | Add empty-array default. |
| `ContentExtraction.code_blocks = []` | 459 | `missing` | — | Code blocks collection default absent. | Add empty-array default. |
| `ContentExtraction.tables = []` | 460 | `missing` | — | Tables collection default absent. | Add empty-array default. |
| `ContentExtraction.flowcharts = []` | 461 | `missing` | — | Flowcharts collection default absent. | Add empty-array default. |
| `ContentExtraction.procedures = []` | 462 | `missing` | — | Procedures collection default absent. | Add empty-array default. |
| `ContentExtraction.templates = []` | 463 | `missing` | — | Templates collection default absent. | Add empty-array default. |
| `FlatBlock.parent_block_id = None` | 473 | `missing` | — | Nullable parent relationship absent. | Add boundary-accurate Option. |
| `SkeletonNode.children = []` | 479 | `missing` | — | Fresh recursive child list default absent. | Suspended self array with empty default. |
| `SkeletonListItem.children = []` | 485 | `missing` | — | Fresh child block-ID list default absent. | Plain string array with empty default; no suspension needed. |
| `DocumentSkeleton.list_items = {}` | 491 | `missing` | — | Dictionary of recursive items and fresh default absent. | Record schema with empty default. |
| `DirectoryScan.content_extraction = None` | 504 | `missing` | — | Nullable extraction aggregate absent. | Add boundary-accurate Option. |

#### Phase 2 and compiled-skill defaults

| Source item | Source lines | Disposition | TS target | What behavior is lost or changed | Recommended fix |
| --- | ---: | --- | --- | --- | --- |
| `Example.tags = []` | 522 | `missing` | — | Fresh tag list default absent. | Add empty-array default. |
| `WorkflowStep.expected_outcome = None` | 529 | `missing` | — | Nullable expected outcome absent. | Add boundary-accurate Option. |
| `WorkflowStep.depends_on = []` | 530 | `missing` | — | Dependency list default absent. | Add empty-array default and validate identifiers. |
| `CompiledSkill.frontmatter = None` | 553 | `missing` | — | Nullable parsed frontmatter absent. | Add to class extension. |
| `CompiledSkill.files = []` | 554 | `missing` | — | File list default absent. | Add empty-array default to extension. |
| `CompiledSkill.reference_files = []` | 557 | `missing` | — | Reference list default absent. | Add empty-array default to extension. |
| `CompiledSkill.examples = []` | 558 | `missing` | — | Examples list default absent. | Add empty-array default to extension. |
| `CompiledSkill.content_extraction = None` | 559 | `missing` | — | Nullable extraction absent. | Add boundary-accurate Option to extension. |

Ledger cross-check: B.1 contains 37 classes, 2 aliases, and 7 decorated
behaviors; B.2 contains 77 distinct default rows. Enum members and Literal
members are part of their owning symbol rows, not field defaults.

## C. Mechanism recommendations

These are mechanism sketches, not a drop-in replacement file. Every Effect or
repo API shown below is verified in A. Names should receive the repository's
normal identity annotations and JSDoc during implementation.

Before the behavior-specific items, simplify the four false variant families:

```ts
export class Requirement extends S.Class<Requirement>($I`Requirement`)({
  type: RequirementType,
  value: S.String,
  optional: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
}) {}

export class ExecutionPayload extends S.Class<ExecutionPayload>($I`ExecutionPayload`)({
  executor: ExecutionPayloadExecutor,
  code: S.String,
  timeout: S.OptionFromNullOr(S.Int).pipe(
    SchemaUtils.withKeyDefaults(O.none()),
  ),
}) {}
```

`S.Class`, LiteralKit-as-field, and `withKeyDefaults` are verified in A.3/A.5.
The same simplification applies to `TemplateAnnotation` and `KnowledgeNode`.
This is the smallest precise model under the standard's case-specific-payload
rule (`standards/schema-first-development-prompt.md:250-261`).

### C.1 `StateTransition.validate_state_uris`

The current generic RDF `URI` accepts much more than the source invariant. Make
the invariant a reusable branded value and put it directly in every array:

```ts
export const StateUri = S.String.check(
  S.isPattern(/^oc:[A-Z][a-zA-Z0-9]*(?::[a-zA-Z0-9_-]+)?$/, {
    identifier: "StateUriPattern",
    title: "OntoSkills state URI",
    description: "An oc: state identifier with an optional state suffix.",
    message: "Expected oc:StateName or oc:StateName:suffix",
  }),
).pipe(S.brand("StateUri"), SchemaUtils.withCodecStatics);

export type StateUri = typeof StateUri.Type;
```

Then use `StateUri.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults)` for all
three fields. `S.check`, `isPattern`, and `brand` are verified at
`node_modules/effect/src/Schema.ts:5116-5140`, `:6820-6833`, and `:5198-5240`;
`withCodecStatics` is verified at
`packages/foundation/modeling/schema/src/SchemaUtils/withCodecStatics.ts:92-99`.
Test both the simple and optional-suffix forms; the WIP's comment at lines
100-102 currently documents only the simpler form.

### C.2 `ExtractedSkill.validate_skill_relation_ids`

This behavior trims and **changes** the value. A check can validate the input
but cannot return the normalized last segment. Use a checked input schema,
a checked/branded output schema, and `S.decodeTo` with a pure transformation:

```ts
const isRelationUri = (value: string): boolean =>
  Str.startsWith("http://")(value) ||
  Str.startsWith("https://")(value) ||
  Str.startsWith("oc:")(value);

const RelationPart = S.String.check(
  S.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    identifier: "RelationPartPattern",
    title: "Canonical relation path segment",
    description: "A lowercase alphanumeric relation segment with optional hyphens.",
    message: "Expected a lowercase kebab-case relation segment",
  }),
).pipe(SchemaUtils.withCodecStatics);

const RelationInput = S.String.check(S.makeFilter(
  (raw: string) => {
    const value = Str.trim(raw);
    return isRelationUri(value) || A.every(RelationPart.is)(Str.split("/")(value));
  },
  {
    identifier: "RelationInput",
    title: "OntoSkills relation reference",
    description: "A URI or slash-qualified sequence of canonical relation-id segments.",
    message: "Expected a URI or lowercase kebab-case relation path",
  },
));

const RelationValue = S.String.check(S.makeFilter(
  (value: string) => isRelationUri(value) || RelationPart.is(value),
  {
    identifier: "RelationValue",
    title: "Normalized relation identifier",
    description: "A pass-through URI or the final canonical segment of a relation path.",
    message: "Expected a URI or canonical relation id",
  },
)).pipe(S.brand("RelationId"));

export const RelationId = RelationInput.pipe(S.decodeTo(
  RelationValue,
  SchemaTransformation.transform({
    decode: (raw) => {
      const value = Str.trim(raw);
      return isRelationUri(value) ? value : A.lastNonEmpty(Str.split("/")(value));
    },
    encode: (value) => value,
  }),
));
export type RelationId = typeof RelationId.Type;
```

The input check guarantees the pure decode cannot encounter an empty/invalid
non-URI path; the target check guarantees the normalized value. `decodeTo` and
`SchemaTransformation.transform` signatures are verified at
`node_modules/effect/src/Schema.ts:5585-5609` and
`node_modules/effect/src/SchemaTransformation.ts:335-343`; string/array helpers
are verified in A.6. Apply `RelationId.pipe(S.Array,
SchemaUtils.withEmptyArrayDefaults)` to `dependsOn`, `extends`, and
`contradicts`. This replaces—not completes—the unfinished filter at lines
358-399.

### C.3 `coerce_is_user_invocable`

There is no public v4 `BooleanFromString`. Author the exact source semantics as
a boundary codec and union it with actual booleans:

```ts
const BooleanFromOntoSkillsString = S.String.pipe(S.decodeTo(
  S.Boolean,
  SchemaTransformation.transform({
    decode: flow(
      Str.toLowerCase,
      (value) => value === "true" || value === "yes" || value === "1",
    ),
    encode: String,
  }),
));

const UserInvocableInput = S.Union([
  S.Boolean,
  BooleanFromOntoSkillsString,
]);
```

`S.Union` is at `node_modules/effect/src/Schema.ts:4923-4927`; transform
evidence is above. The local `NormalizedBooleanString` uses the same v4
mechanism (`packages/foundation/modeling/schema/src/CommonTextSchemas.ts:131-142`)
but is not exact parity: it trims and also treats `"on"` as true
(`:15-19`). Reusing it is acceptable only as a documented redesign. Python's
fallback `bool(v)` for arbitrary non-string values is broad coercion; prefer
rejecting those values unless a real consumer proves compatibility is needed.

### C.4 JSON-string nested data and invalid-element dropping

Represent the accepted wire alternatives as strict codecs:

```ts
const StateTransitionInput = S.Union([
  StateTransition,
  S.fromJsonString(StateTransition),
]);

const ExecutionPayloadInput = S.Union([
  ExecutionPayload,
  S.fromJsonString(ExecutionPayload),
]);

const KnowledgeNodeInput = S.Union([
  KnowledgeNode,
  S.fromJsonString(KnowledgeNode),
]);
```

`S.fromJsonString` is verified in installed source at
`node_modules/effect/src/Schema.ts:12756-12798` and in the reference checkout at
`.repos/effect/packages/effect/src/Schema.ts:12404-12446`. Malformed JSON or a
bad decoded structure fails the owning schema. That is clearer than Python's
temporary "leave malformed string in place" step, whose eventual Pydantic
field validation also fails.

Dropping malformed *knowledge-node elements with a warning* is collection and
observability policy, not a property of a valid KnowledgeNode or strict array
schema. Keep it at the ingress boundary:

```ts
const decodeKnowledgeNodes = (inputs: ReadonlyArray<unknown>) =>
  Effect.forEach(inputs, (input, index) =>
    S.decodeUnknownEffect(KnowledgeNodeInput)(input).pipe(
      Effect.matchEffect({
        onSuccess: (node) => Effect.succeed(O.some(node)),
        onFailure: (error) => Effect.logWarning(
          "Dropping invalid knowledge node",
          { index, error },
        ).pipe(Effect.as(O.none())),
      }),
    )
  ).pipe(Effect.map(A.getSomes));
```

The decoder is at `node_modules/effect/src/Schema.ts:1516-1523`; traversal,
matching, logging, mapping, and `as` are at
`node_modules/effect/src/Effect.ts:1088-1108`, `:11055-11068`, `:22272`,
`:3678-3688`, and `:3837`; Option constructors and `A.getSomes` are at
`node_modules/effect/src/Option.ts:256-286` and
`node_modules/effect/src/Array.ts:7692-7701`. If the caller is deliberately
synchronous, an equivalent `S.decodeUnknownResult` + `Result.match` loop is
lawful (`Schema.ts:1773-1777`, `Result.ts:1182-1223`), but warning ownership
must remain explicit.

### C.5 Computed `skill_type`

Keep this small pure behavior on the class. Use one implementation for both the
static operation and ergonomic instance getter:

```ts
export const SkillType = LiteralKit(["executable", "declarative"]);
export type SkillType = typeof SkillType.Type;

export class ExtractedSkill extends S.Class<ExtractedSkill>($I`ExtractedSkill`)(
  fields,
) {
  static readonly is = S.is(ExtractedSkill);
  static readonly equivalence = S.toEquivalence(ExtractedSkill);

  static readonly skillType = (skill: ExtractedSkill): SkillType =>
    O.isSome(skill.executionPayload) ? "executable" : "declarative";

  get skillType(): SkillType {
    return ExtractedSkill.skillType(this);
  }
}
```

`S.is` and `S.toEquivalence` are verified at
`node_modules/effect/src/Schema.ts:1442` and `:15596-15597`; an in-repo class
static guard appears at `packages/foundation/ui-system/dock/src/Dock.models-tree.ts:318`.
The getter is Type-side behavior; it is not automatically an encoded schema
field. If consumers depend on Pydantic's computed field appearing in serialized
output, add it deliberately in an output adapter and test that encoded shape.

### C.6 `Frontmatter.validate_name`

This is a lossy canonicalization followed by validation and branding:

```ts
const normalizeFrontmatterName = flow(
  Str.replace(":", "-"),
  Str.toLowerCase,
  Str.trim,
  Str.replace(/[\s_]+/g, "-"),
  Str.replace(/[^a-z0-9-]/g, "-"),
  Str.replace(/-+/g, "-"),
  Str.replace(/^-+|-+$/g, ""),
);

const FrontmatterNameValue = S.String.check(
  S.isNonEmpty({ message: "Name must not be empty" }),
  S.isMaxLength(64, { message: "Name must be at most 64 characters" }),
  S.makeFilter(
    (name: string) => name !== "ontoskills" && name !== "index",
    {
      identifier: "FrontmatterNameNotReserved",
      title: "Non-reserved skill name",
      description: "Rejects the reserved OntoSkills and index names after normalization.",
      message: "Name is reserved",
    },
  ),
).pipe(S.brand("FrontmatterName"));

export const FrontmatterName = S.String.pipe(S.decodeTo(
  FrontmatterNameValue,
  SchemaTransformation.transform({
    decode: normalizeFrontmatterName,
    encode: (name) => name,
  }),
));
export type FrontmatterName = typeof FrontmatterName.Type;
```

The helper signatures are verified in A.6; built-in checks are at
`node_modules/effect/src/Schema.ts:8942-8943`, `:8966-8984`. Because the
normalization cannot reconstruct its original spelling, test
`normalize(normalize(x)) === normalize(x)` and canonical encoded output, not
raw decode/encode equality. That is the standard's explicit lossy-transform
carve-out (`standards/schema-first-development-prompt.md:646-651`). Include
edge tests for scoped first-colon replacement, underscores/whitespace,
punctuation-only input, repeated hyphens, both reserved names, and 64/65 chars.

### C.7 `Frontmatter.validate_description`

This is validation only; no transformation is needed:

```ts
export const FrontmatterDescription = S.String.check(
  S.isMaxLength(1024, {
    message: "Description must be at most 1024 characters",
  }),
  S.makeFilter(
    (description: string) => !/<[a-zA-Z][^>]*>/.test(description),
    {
      identifier: "FrontmatterDescriptionWithoutTags",
      title: "Tag-free frontmatter description",
      description: "Rejects XML and HTML opening-tag syntax.",
      message: "Description must not contain XML or HTML tags",
    },
  ),
);
export type FrontmatterDescription = typeof FrontmatterDescription.Type;
```

`S.isMaxLength` and `S.makeFilter` are verified at
`node_modules/effect/src/Schema.ts:8966-8984` and `:6659-6716`. Test the source
regex behavior exactly, including `<a>`, `<Tag attr="x">`, plain angle-bracket
text, and the 1024/1025 boundary.

### C.8 Recursive models

Use a suspended reference and declare both Type and Encoded forms. A compact
self-recursive example for `SkeletonNode` is:

```ts
export declare namespace SkeletonNode {
  export type Type = {
    readonly blockId: string;
    readonly children: ReadonlyArray<Type>;
  };
  export type Encoded = {
    readonly block_id: string;
    readonly children?: ReadonlyArray<Encoded>;
  };
}

export const SkeletonNode: S.Codec<SkeletonNode.Type, SkeletonNode.Encoded> =
  S.Struct({
    blockId: S.String,
    children: S.Array(S.suspend(
      (): S.Codec<SkeletonNode.Type, SkeletonNode.Encoded> => SkeletonNode,
    )).pipe(SchemaUtils.withEmptyArrayDefaults),
  }).pipe(S.encodeKeys({ blockId: "block_id" }));
```

The canonical in-repo pattern is
`packages/foundation/modeling/md/src/Md.model.ts:305-311` with declared Type
and Encoded unions at `:1154-1187`; `S.suspend` itself is
`node_modules/effect/src/Schema.ts:5066-5113`, and `S.encodeKeys` is
`:3651-3707`. Apply the same mechanism to `Section.subsections`. For the
mutually recursive block graph, define
`ProcedureStep.children` and `BulletItem.children` as suspended `ContentBlock`
references; `ContentBlock` is the real `block_type` tagged union that includes
`OrderedProcedure`, whose steps contain `ProcedureStep`.

### C.9 `CompiledSkill extends ExtractedSkill`

Installed rc.112 requires the child identifier:

```ts
export class CompiledSkill extends ExtractedSkill.extend<CompiledSkill>(
  $I`CompiledSkill`,
)({
  frontmatter: S.OptionFromNullOr(Frontmatter).pipe(
    SchemaUtils.withKeyDefaults(O.none()),
  ),
  files: FileInfo.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults),
  referenceFiles: ReferenceFile.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults),
  examples: Example.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults),
  contentExtraction: S.OptionFromNullOr(ContentExtraction).pipe(
    SchemaUtils.withKeyDefaults(O.none()),
  ),
}) {}
```

The signature is `node_modules/effect/src/Schema.ts:14389-14409`, its official
example is `:14635-14651`, and a real repo class extension is
`packages/shared/domain/src/values/Rule/Rule.model.ts:157-164`. Do not use
`Parent.extend<X>()({...})` without an identifier in this installed version.

### C.10 Where pure behavior belongs

| Candidate | Placement | Reason |
| --- | --- | --- |
| `ExtractedSkill.is`, `StateUri.is`, `RelationId.is` | Schema/class static, derived with `S.is` or `withCodecStatics` | Schema-derived guard is local truth, not duplicated validation. |
| Structural equivalence for models | Class/schema static via `S.toEquivalence` when frequently reused | Derived directly from fields. |
| `skillType(skill)` and optional getter | `ExtractedSkill` class | Small, total, value-local pure behavior. |
| Literal membership and exhaustive matching | LiteralKit `.is`, `.$match`, or tagged-union `.match` | Already derived; no hand-written switch/helper wall. |
| State URI, relation ID, frontmatter name/description rules | Their value schemas | These are invariants/normalization, not downstream behavior. |
| Knowledge-node element dropping + warnings | Owning decode boundary or `.policy.ts` | Collection operation and observability policy, not a property of one node. |
| Recursive traversal/flattening, skeleton construction, workflow graph algorithms | `.behavior.ts` | Large multi-model/collection algorithms. |
| External file reads, directory scans, compilation orchestration | Effect service/use-case layer | Runtime fallibility and capabilities do not belong on pure schema classes. |

This follows `standards/schema-first-development-prompt.md:220-243`: colocate
schema-derived helpers and small value-local behavior, while keeping large
algorithms, collection policies, and orchestration outside the model. Crispen's
consequence here is to delete the WIP's factory/helper wall only after the
invariants and transformations are absorbed by the schemas.

## D. Defect list for the current WIP file

Ranks are ordered by the first repair dependency, then semantic blast radius.

| Rank | Severity | WIP line(s) | Concrete defect and one-line fix direction |
| ---: | --- | ---: | --- |
| 1 | P0 | 388, 390, 397 | `const isV` is incomplete, `guard` has no body, and the filter callback has no expression/return; delete the attempt and replace it with C.2's checked transformation. |
| 2 | P0 | 10, 266, 281, 296, 312 | `@beep/schema/Int` does not export `NonNegativeInt`; import it from `@beep/schema/Number` or the package root. |
| 3 | P0 | 370-399 | `RelationId` is modeled as a filter even though Python normalizes values; use `S.decodeTo` + `SchemaTransformation.transform`. |
| 4 | P1 | 426-428 | Relation fields are `S.String[]`, so even a repaired `RelationId` remains dead code; use `RelationId[]`. |
| 5 | P1 | 429 | The optional StateTransition shape is present, but explicit null and source-supported JSON-string input fail. Use a null-aware object-or-JSON boundary codec. |
| 6 | P1 | 106, 113, 115 | Generic RFC 3986 `URI` does not enforce the source's `oc:` state grammar; use a branded checked `StateUri`. |
| 7 | P1 | 132-168 | Optional Python `severity_level` is promoted to the required discriminator; make `severityLevel` optional and use `nodeType` as the required finite field. |
| 8 | P1 | 139 | `has_rationale: Optional[str]` becomes misspelled required `hasRational: string`; rename to `hasRationale` and make it boundary-accurately optional. |
| 9 | P1 | 203-257 | Flat Python KnowledgeNode is changed to `{ type, node: severity-variant }`; replace the 31-way wrapper and severity union with one flat model. |
| 10 | P1 | 70, 135-151, 342-346, 429, 433-440 | `OptionFromOptionalKey` accepts omission but not explicit Python `None`/JSON null and encodes None as omission; choose `OptionFromNullOr` plus missing-key default where null parity is required. |
| 11 | P1 | 417-449 | Most source surface is absent: all Phase 1 extraction/skeleton models, all Phase 2 models, Frontmatter, and CompiledSkill. Implement the B ledger before calling the port complete. |
| 12 | P1 | 340-356, 443 | Source metadata fields are flattened; WIP invents optional nested `meta`, and the class is optional so defaults/required behavior change. Preserve flat shape or supply a total compatibility adapter. |
| 13 | P1 | 403-415, 417-449 | `ExtractedSkillAnnotations` is never referenced by `ExtractedSkill`; source annotation/workflow fields are effectively missing. Add the fields or a deliberate nested adapter. |
| 14 | P1 | 409 | `workflows` is `Array<"workflow">` defaulting to `["workflow"]`, not `list[Workflow]` defaulting `[]`; implement Workflow and use its array schema. |
| 15 | P1 | 424 | Required Python `intents` is given an empty missing-key default; remove `withEmptyArrayDefaults` unless empty/missing is an intentional redesign. |
| 16 | P1 | 348 | `argument_hint: Optional[str]` becomes `argumentHints: string[] = []`; restore singular optional string (and snake_case wire mapping if Type is camelCase). |
| 17 | P1 | 437-440 | Python provenance is `Optional[str]`; `ProvO` is a structured PROV-O union. Use string or document and test a real migration adapter. |
| 18 | P1 | 441 | Knowledge-node strings are not parsed and invalid elements are not dropped with warnings. Implement C.4's element-wise ingress policy. |
| 19 | P1 | 347 | Plain `S.Boolean` loses Python's `"true"`/`"yes"`/`"1"` coercion. Use C.3's Boolean|string codec. |
| 20 | P1 | 417-449 | Computed `skill_type` is absent. Add the class-local static/getter from C.5 and decide separately whether it is serialized. |
| 21 | P1 | 21-57 | Requirement's five members have identical payloads; the union adds no case-specific invariant and repeats a factory five times. Use a single model with a LiteralKit-typed field. |
| 22 | P1 | 61-93 | ExecutionPayload's four members also have identical payloads; additionally `int` silently becomes `Duration` with an unproved millisecond unit. Use one model and preserve/declare timeout units. |
| 23 | P1 | 305-338 | TemplateAnnotation's identical-payload union is unnecessary and renames source `template_type` to `type`. Use one model with `templateType`, preserving encoded key as needed. |
| 24 | P1 | 343 | Python version accepts arbitrary string; `SemverFromString` decodes to structured Semver. Treat this as a compatibility redesign and prove an adapter, or retain string. |
| 25 | P1 | 420 | Python hash is unconstrained `str`; `Sha256` rejects non-hex/non-64-char historical values. Keep only if source data audit and ingress tests prove the stronger invariant. |
| 26 | P1 | 103-115, 133-151, 340-350, 403-443 | CamelCase Type keys replace Python snake_case encoded keys without `S.encodeKeys` or another adapter. Define the encoded contract explicitly and add exact encoded parity tests. |
| 27 | P1 | 144-147, 266, 281, 296, 312 | Python `step_order` and annotation indices are unconstrained ints; WIP narrows them to positive/nonnegative. Use `Int` unless strengthening is documented and data-proved. |
| 28 | P2 | 73 | ExecutionPayloadExecutor is annotated as `"RequirementType"`, a copy/paste identity collision. Change the annotation identifier to `"ExecutionPayloadExecutor"`. |
| 29 | P2 | 38, 55, 74, 91, 118, 156, 170, 209, 255, 271, 285, 300, 317, 334, 353, 412, 446 | Exported schemas/classes use empty descriptions, violating useful identity/annotation rules. Supply domain descriptions and key annotations. |
| 30 | P2 | 61-76, 305-319, 370-399 | Non-class exported schemas `ExecutionPayloadExecutor`, `TemplateAnnotationType`, and `RelationId` lack colocated `export type Name = typeof Name.Type`. Add each type export after fixing the schemas. |
| 31 | P2 | 6, 8, 9, 14, 16 | `pipe`, `O`, `P`, `SchemaGetter`, and `NonEmptyTrimmedStr` are unused. Remove them unless the corrected implementation consumes them. |
| 32 | P2 | 106-110 | The field schema is an array but the `examples` entry is a single URI value, not an array example. Use an array-valued example such as `[[StateUri.make(...)]]` according to annotation shape. |
| 33 | P2 | 100-102 | JSDoc claims the grammar ends after the state name while Python also permits `:suffix`. Document the exact verified regex. |
| 34 | P2 | 373-386 | `PatternPart` and `PatternParts` are allocated inside a decode predicate; `PatternParts` is unused and rechecks every already-decoded element. Hoist the value schema and delete the redundant array helper. |
| 35 | P2 | 97-121, 261-303, 320-356, 403-449 | Exported classes lack the repository's required full JSDoc surface (`**Example** (Title)`, category, since, meaningful details) and most fields lack annotations. Run the JSDoc/annotation post-pass after semantic repair. |
| 36 | P2 | 19-449 | No exact encoded examples or tests establish snake_case, null, defaults, transformations, or lossy-normalization laws. Add parity examples plus invariant/default/transform/idempotence tests before port acceptance. |

### Repair order

1. Replace the broken RelationId block and fix the invalid import so TypeScript
   can expose the next error layer.
2. Restore source capabilities and boundary contracts from B, beginning with
   KnowledgeNode, ExtractedSkill, Frontmatter, recursive Phase 1, Phase 2, and
   CompiledSkill.
3. Apply only evidence-backed strengthening (`Sha256`, Semver, positive order,
   structured provenance) with explicit adapters and parity tests.
4. Finish annotations/JSDoc, then run focused TypeScript, source-fixture parity,
   schema law, and exact encoded-form tests.

No source file was modified during this audit.
