I'll review those schema-org files against the port decisions and the pinned upstream oracle, and report findings only. First I'm loading the binding decisions, recorded deviations, and the files in scope.The ledger shows schema-org at S1 with no recorded deviations. I'll diff the named files against the pinned upstream and check the working tree matches that commit.### grok-1-1
- file: scratchpad/effected/schema-org/NodeRef.ts:60
- class: schema   severity: required
- standard: effect-laws-v1.md law 18; standards/effect-first-development.md EF-12; D5   evidence: `NodeId` is `S.String.check(S.isPattern(NODE_ID_PATTERN))` with no filter `identifier` / `title` / `description` and no `$I.annote`. Every other exported schema in these files carries `$ScratchpadId`.
- failure: The exported identifier constraint is anonymous. A failed `NodeId` decode names only the raw regexp, and identity tooling cannot see the schema.
- fix: Pass `identifier`, `title`, and `description` into `S.isPattern`, and `.annotate($I.annote("NodeId", { description }))`. Leave `message` unset so the issue text stays the upstream regexp wording, unless that text change is recorded as a `law:18` deviation.

### grok-1-2
- file: scratchpad/effected/schema-org/NodeRef.ts:142
- class: schema   severity: required
- standard: effect-laws-v1.md law 17; standards/schema-first-development-prompt.md "Derive behavior instead of duplicating truth"   evidence: `isValidId` calls `NODE_ID_PATTERN.test`. `NodeId` checks the same regexp through `S.isPattern`. `scratchpad/test/schema-org/nodes.test.ts:171` only locks eight strings.
- failure: The predicate and the schema are two copies of one rule. They agree on that list; a later edit to either side can accept an id the other rejects.
- fix: `return S.is(NodeId)(id)`.

### grok-1-3
- file: scratchpad/effected/schema-org/Conformance.ts:22
- class: schema   severity: required
- standard: effect-laws-v1.md law 19; EF-12b   evidence: `TermKind` is a named, referenced, `$I.annoteSchema` literal domain built with `S.Literals`. Law 19 reserves `S.Literals` for anonymous unions never referenced by name, and requires `LiteralKit` when the schema value is annotation-bearing.
- failure: `TermKind` has no `LiteralKit` `.Enum`, `.is`, or `.$match`, so the `"type" | "property"` domain is outside the repo's literal-domain constructor.
- fix: `LiteralKit(["type", "property"]).pipe($I.annoteSchema("TermKind", { description }))`. Do not add `as const`. Encoded values stay `"type"` and `"property"`.

### grok-1-4
- file: scratchpad/effected/schema-org/Vocabulary.ts:150
- class: effect-idiom   severity: required
- standard: EF-2   evidence: `MutableHashMap.get` already returns `Option`. `ancestorsOf` (150), `propertiesOf` (170), `isPropertyOn` (197), and `supersededBy` (218) pass that through `O.getOrUndefined` and branch on `=== undefined`. `supersedingName` (76) takes `number | undefined` and rebuilds an `Option`.
- failure: Missing vocabulary indexes are domain absence, and the port unwraps `Option` back into `undefined` before matching.
- fix: `O.match` / `O.flatMap` on the `MutableHashMap.get` results. Keep the same empty-set, `false`, and `O.none()` outcomes.

### grok-1-5
- file: scratchpad/effected/schema-org/Conformance.ts:261
- class: effect-idiom   severity: required
- standard: EF-2   evidence: `nativeTerm` returns `string | undefined`. Callers at lines 369, 383, and 385 branch on `undefined`. A foreign prefix is absence, not a successful term.
- failure: The native-versus-foreign decision is `| undefined` inside the checker, so the three call sites each reimplement the none branch.
- fix: Return `O.Option<string>` and match it at those call sites. Bare terms, `schema:` stripping, foreign skips, and unknown prefixed terms stay as they are.

### grok-1-6
- file: scratchpad/effected/schema-org/Conformance.ts:214
- class: schema   severity: backlog
- standard: effect-laws-v1.md law 13; schema-first "Schema owns pure data" and "Defaults live at the boundary"   evidence: `ConformanceOptions` is an interface. `validateResult` (426–428) defaults with `??`. A runtime string other than the two literals is not rejected; `unknownTerms === "fail"` is simply false, which matches upstream.
- failure: Gate policy is unvalidated configuration. Omitted fields and out-of-union runtime strings are normalized by ad-hoc fallbacks.
- fix: Decode options with a schema whose defaults are `"report"`, `"ignore"`, and `"ignore"`. Keep accepting out-of-union runtime strings on today's non-failing path unless that rejection is recorded under section 14.

### grok-1-7
- file: scratchpad/effected/schema-org/NodeRef.ts:87
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md carrier policy and hard requirements (operator: S2 is backlog, never required)   evidence: Export docs in the focus files still use `@example` and `@remarks` (`NodeRef.ts:37`, `Vocabulary.ts:143`, and the class docs in `APIReference.ts`, `Conformance.ts`, `CreativeWork.ts`, `JsonLdDocument.ts`, `Organization.ts`, `Person.ts`, `SoftwareSourceCode.ts`, `TechArticle.ts`, `index.ts`, `conformance-entry.ts`). `@category` and `@since 0.0.0` are absent.
- failure: Carriers and category tags do not match the JSDoc law, so docgen's S2 gate will reject these blocks.
- fix: Convert each export to a lead paragraph, `**Details**` / `**Gotchas**` where the extra prose earns it, titled `**Example** (Title)` sections, plus `@category` and `@since 0.0.0`.

### grok-1-8
- file: scratchpad/effected/schema-org/Thing.ts:32
- class: schema   severity: backlog
- standard: EF-12 (descriptions are the S2 annotation pass; backlog under the operator order)   evidence: `Person.email`, `Organization.legalName`, and the other fields written in a class body call `.annotateKey({ description })`. `ThingFields`, `CreativeWorkFields`, and `TechArticleFields` carry the same prose only as JSDoc, so a spread field such as `name` has no schema description while `email` does.
- failure: Schema AST descriptions cover only the fields declared in the class body. Inherited fields are blank in the schema even though their JSDoc states the contract.
- fix: `.annotateKey({ description })` on each schema in the three field bags, using the existing JSDoc lead as the description.

REQUIRED: 5
BACKLOG: 3
