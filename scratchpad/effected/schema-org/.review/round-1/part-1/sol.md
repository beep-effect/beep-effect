### sol-1-1

- file: scratchpad/effected/schema-org/JsonLdDocument.ts:95
- class: bug   severity: required
- standard: D9, D11, and section 14 (`upstream-bug` exception); `JsonLdDocument.danglingReferences` promises to report unresolved references, and [JSON-LD 1.1 defines an object containing only `@id` as a node reference](https://www.w3.org/TR/json-ld11/#dfn-node-reference).   evidence: A read-only `bun -e` probe against both this commit and the pinned oracle built `TechArticle.make({ "@id": "#article", additional: { mentions: { "@id": "#missing" } } })`. Both serialized the `mentions` reference, returned `danglingReferences: []`, returned no conformance issues, and returned `Success` from `Conformance.validateResult(graph, { danglingReferences: "report" })`. Replacing `"#missing"` with `"has space"` also returned a successful build.
- failure: References carried by the supported `additional` catch-all bypass identity validation and closure checking. `referencedIds` examines only direct fields and array elements that satisfy the nominal `NodeRef` schema; it never examines entries inside `additional`. `Conformance.referencesOf` at `Conformance.ts:283` has the same omission. A graph can therefore pass the explicit closure gate while its serialized document references an absent node.
- fix: Extend reference discovery to recognize scalar and array `{"@id": string}` reference objects in `additional`, retaining the originating property name. Use that discovery in build validation, dangling-reference reporting, and conformance checking. Record this verified upstream bug in the ledger and README before changing behavior, as section 14 requires, and add focused regressions for the demonstrated cases.

### sol-1-2

- file: scratchpad/effected/schema-org/NodeRef.ts:60
- class: schema   severity: required
- standard: D5; the operator’s step 4 requires identity annotations on every schema; `standards/effect-first-development.md`, EF-12.   evidence: The exported `NodeId` declaration has no `$I.annote(...)` or `$I.annoteSchema(...)`. A read-only runtime probe printed `NodeId.ast.annotations === undefined`, although this file already defines its identity composer.
- failure: The reusable identifier schema lacks the required canonical identity and descriptive runtime metadata. This concrete omission remains on the supplied green commit.
- fix: Annotate the existing schema with `$I.annoteSchema("NodeId", { description: ... })`, preserving its current accepted strings and deferred graph-validation behavior.

### sol-1-3

- file: scratchpad/effected/schema-org/Thing.ts:30
- class: schema   severity: required
- standard: The operator’s step 4 in `scratchpad/EFFECTED_PORT_GOAL.md` requires “annotations on fields and schemas.”   evidence: Every field declared in `ThingFields`, `CreativeWorkFields` (`CreativeWork.ts:26`), and `TechArticleFields` (`TechArticle.ts:15`) lacks `annotateKey(...)`. These records are spread into the exported node classes. A read-only AST probe showed no key description on `Person.fields["@id"]`, while `Person.fields.email.ast.context.annotations.description` was present; analogous probes showed missing descriptions for shared `name`, `author`, and `headline`.
- failure: The identity pass annotates class-specific fields but leaves the shared fields without runtime field metadata. Consequently, all six node schemas inherit incomplete annotations despite the prose comments at their declarations.
- fix: Add meaningful `annotateKey({ description: ... })` metadata at the shared field declarations, so every consuming class receives it through the existing spreads. Preserve the current `S.optional` semantics.

### sol-1-4

- file: scratchpad/effected/schema-org/Conformance.ts:22
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md`, law 19; `standards/effect-first-development.md`, EF-12b; D5. Named literal domains use `LiteralKit`; `S.Literals` is reserved for anonymous inline unions.
- evidence: `TermKind` is an exported, named, annotated domain reused by `UnknownTerm.fields.kind`, but it is constructed with `S.Literals(["type", "property"])`. A read-only probe confirmed `TermKind.Enum === undefined`.
- failure: This reusable literal domain bypasses the required kit construction and lacks the standard enum, guard, and matching helper surface. The violation remains on the supplied green commit.
- fix: Construct `TermKind` with `LiteralKit(["type", "property"])`, retaining its current identity annotation and same-name type alias. Its encoded and decoded literal values remain unchanged.

### sol-1-5

- file: scratchpad/effected/schema-org/NodeRef.ts:60
- class: schema   severity: required
- standard: `standards/effect-first-development.md`, EF-3: non-class schemas export a type alias with the same identifier; `standards/schema-first-development-prompt.md`, “Use Schema as the source of truth.”
- evidence: `NodeId` is an exported non-class schema, but `NodeRef.ts` contains no `export type NodeId = typeof NodeId.Type`. The root barrel exports the value without a corresponding type declaration.
- failure: Consumers can import the `NodeId` schema value but cannot use `NodeId` as its schema-derived runtime type. The module omits the required non-class schema/type pairing.
- fix: Add `export type NodeId = typeof NodeId.Type`. Preserve the existing root re-export and record the added type export in the port notes under D2.

### sol-1-6

- file: scratchpad/effected/schema-org/NodeRef.ts:142
- class: effect-idiom   severity: required
- standard: `standards/effect-laws-v1.md`, law 17; `standards/effect-first-development.md`, EF-12b and EF-35: derive domain guards from their schemas with `S.is(...)`.
- evidence: `NodeId` already models the identifier constraint, but the public `NodeRef.isValidId` independently executes `NODE_ID_PATTERN.test(id)`. Both `NodeRef.toCheckedResult` and graph assembly call that parallel predicate.
- failure: Checked reference construction and graph assembly bypass the exported schema as the source of validation truth. Changes to `NodeId` checks would not reach these callers, and the current implementation directly violates the schema-derived guard rule.
- fix: Keep the existing `(id: string) => boolean` public contract and implement it using a guard derived once from `S.is(NodeId)`. Retain deferred validation at graph assembly.

### sol-1-7

- file: scratchpad/effected/schema-org/Conformance.ts:214
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md`, “Schemas Are Executable Contracts”; `standards/effect-first-development.md`, EF-33; `standards/schema-first-development-prompt.md`, “Keep Schema as the source of truth.”
- evidence: `ConformanceOptions` is a pure configuration record with three finite policy fields, declared solely as an exported interface. It is neither a service contract nor type-level machinery, and its shape is directly representable by a schema.
- failure: The gate’s policy configuration has no runtime schema from which its type, metadata, codecs, or generators can be derived. The plain data interface remains on the supplied green commit.
- fix: Define an annotated `S.Struct` boundary schema with optional policy fields and derive `ConformanceOptions` from its `.Type`. Preserve acceptance of ordinary option objects, the existing defaults, and the current type-only entrypoint export; do not introduce new rejection behavior.

### sol-1-8

- file: scratchpad/effected/schema-org/APIReference.ts:13
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, “Hard requirements” and “Carrier policy”; backlog classification follows the explicit S2 deferral.
- evidence: The focused files retain `@example` carriers, and `NodeRef.ts:37` plus several `Vocabulary` methods retain `@remarks`. A search across all thirteen focused files found no `@category` or `@since` tags. Several value exports, including `ThingFields`, `CreativeWorkFields`, `TechArticleFields`, `NodeId`, and the conformance schemas, also lack the required examples.
- failure: The carried documentation does not yet satisfy the prescribed JSDoc grammar and public-export metadata requirements.
- fix: During S2, convert examples to titled `**Example** (Title)` sections, convert remarks to appropriate prose sections, add canonical categories and `@since 0.0.0`, and supply meaningful examples for value exports. Preserve the upstream documentation bodies.

### sol-1-9

- file: scratchpad/effected/schema-org/conformance-entry.ts:22
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`: examples must compile and must not use `declare`; backlog classification follows the explicit S2 deferral.
- evidence: The complete example imports only `Conformance` and `Vocabulary`, logs the vocabulary version, then calls `Conformance.check(graph)`. It never defines or imports `graph`.
- failure: The example is not self-contained and cannot compile as written because `graph` is undeclared.
- fix: Build a small graph within the example using `JsonLdDocument`, a node class, and `Result.getOrThrow`, then pass it to `Conformance.check`. Keep the example when converting its carrier during S2.

REQUIRED: 7
BACKLOG: 2