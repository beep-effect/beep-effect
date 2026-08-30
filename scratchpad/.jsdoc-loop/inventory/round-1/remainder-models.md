# Round 1 inventory: remainder-models

Read-only JSDoc review of pack `remainder` filtered to `scratchpad/ontoskills/**` and `scratchpad/metadata/**`. `scratchpad/microdata/Microdata.model.ts` is in the remainder pack but out of this filter and was not reviewed. `scratchpad/ontoskills/registry/Registry.models.ts` is already dirty; findings below review the working tree as-is and must not be used as a reason to revert it.

`fixerGroup` is `remainder-models` on every item.

## Reviewed files

| File | Owning exports | Census mechanical export findings |
| --- | --- | --- |
| `scratchpad/metadata/Metadata.models.ts` | 6 | 6 open |
| `scratchpad/metadata/services/officeparser/OfficeParser.models.ts` | 83 | 0 open (module header only) |
| `scratchpad/ontoskills/OntoSkills.models.ts` | 85 | 29 open (24 same-name types + 5 namespaces) |
| `scratchpad/ontoskills/registry/Registry.models.ts` | 29 | 29 open |

Total owning exports reviewed: 203.

## Rejected false positives

Census classifies `export declare namespace` as `kind: value` and then requires a titled Example. Binding law treats namespaces as pure type-level; Example is optional. Reject only the `@example` miss on:

- `ProcedureStep` (`OntoSkills.models.ts:1112`)
- `BulletItem` (`OntoSkills.models.ts:1239`)
- `ContentBlock` (`OntoSkills.models.ts:1446`)
- `Section` (`OntoSkills.models.ts:1529`)
- `SkeletonNode` (`OntoSkills.models.ts:1648`)

Keep the `@category` / `@since` misses on those namespaces (item remainder-models-R1-011).

No other census mechanical flags in this filter were false positives. OfficeParser’s 83 owning exports really do have leads, `@category`, and `@since`. OntoSkills’ 56 value-level exports really do have titled `**Example**` headings; the defect is editorial (no `ts` fence, section order, non-canonical category).

---

### remainder-models-R1-001: Metadata.models.ts missing module fileoverview

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/metadata/Metadata.models.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-module-summary|missing-packageDocumentation|missing-module-since`. File opens on commented imports and `$I` with no `/**` fileoverview. Confirmed.
- `impact`: Exporting modules must ship a useful lead, `@packageDocumentation`, and `@since 0.0.0` or the census/ratchet stays open.
- `suggestedFix`: Add a fileoverview that states these LiteralKits classify file media, metadata provenance, and extraction confidence for the metadata pipeline. Tags: `@packageDocumentation` then `@since 0.0.0`. Never `@module`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-models
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### remainder-models-R1-002: Metadata.models.ts owning exports lack JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/metadata/Metadata.models.ts:10; scratchpad/metadata/Metadata.models.ts:16; scratchpad/metadata/Metadata.models.ts:18; scratchpad/metadata/Metadata.models.ts:40; scratchpad/metadata/Metadata.models.ts:42; scratchpad/metadata/Metadata.models.ts:48
- `symbol`: FileCategory, MetadataSource, MetadataConfidence
- `kind`: value
- `evidence`: All six owning exports confirmed. Values `FileCategory` (L10), `MetadataSource` (L18), `MetadataConfidence` (L42) have no lead, `@category`, `@since`, or titled Example. Same-name types at L16/L40/L48 have no lead, `@category`, or `@since`. Census `missing-summary|missing-required-tags` is correct; type-level `@example` is not required and was not flagged.
- `impact`: Three runtime LiteralKits and their decoded companions are invisible in hovers and fail the owning-export ratchet.
- `suggestedFix`: On each const: one purpose lead (media class of a file; provenance store the field came from; how strongly the extractor trusts the value), one titled `**Example**` with a single `ts` fence that decodes or `S.is`s a realistic member (`FileCategory.Enum.image`, `MetadataSource.Enum.exif`, `MetadataConfidence.Enum.exact`) and logs an observable result, then `@category schemas` `@since 0.0.0`. On each type: “Decoded member of {@link FileCategory}.” plus described `@see`, `@category type-level`, `@since 0.0.0`. Do not restate the identifier as the lead.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-models
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: remainder-models-R1-003
- `status`: open
- `fixedCommit`: pending

### remainder-models-R1-003: Metadata.models.ts $I.annoteSchema descriptions are empty

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/metadata/Metadata.models.ts:11; scratchpad/metadata/Metadata.models.ts:36; scratchpad/metadata/Metadata.models.ts:44
- `symbol`: FileCategory, MetadataSource, MetadataConfidence
- `kind`: value
- `evidence`: Each LiteralKit is piped through `$I.annoteSchema("…", { description: "" })`. Annotation law requires a meaningful description on exported non-class schemas. Same-name type aliases already exist (good); the identity payload is empty.
- `impact`: Schema identity/docgen surface publishes blank descriptions even after JSDoc is added.
- `suggestedFix`: Fill each `description` with the same purpose sentence as the JSDoc lead (file media class; metadata provenance store; extractor confidence). Keep `$I.annoteSchema` on the `.pipe` (already the non-class form).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-models
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: remainder-models-R1-002
- `status`: open
- `fixedCommit`: pending

### remainder-models-R1-004: OfficeParser.models.ts missing module fileoverview

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/metadata/services/officeparser/OfficeParser.models.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-module-summary|missing-packageDocumentation|missing-module-since`. File starts at imports. Confirmed. The 83 owning exports already carry leads/`@category`/`@since`; this item is module-only.
- `impact`: The largest documented models file in this filter still fails the exporting-module gate.
- `suggestedFix`: Fileoverview lead: these types are the OfficeParser parse/generate AST, diagnostics, chunking, and destination configs. `@packageDocumentation` `@since 0.0.0`. Never `@module`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-models
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### remainder-models-R1-005: OfficeErrorType / OfficeWarningType Examples are placeholders

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/metadata/services/officeparser/OfficeParser.models.ts:21; scratchpad/metadata/services/officeparser/OfficeParser.models.ts:97
- `symbol`: OfficeErrorType, OfficeWarningType
- `kind`: value
- `evidence`: Census treats both as closed (`hasTitledExample: true`). The fences are `const code = OfficeErrorType.Options[0]; console.log(code)` and the same for `OfficeWarningType`. Binding law: placeholder Examples (`console.log(fn)`) are defects; the Example must show the symbol doing its job with realistic inputs.
- `impact`: Callers learn the first option string, not how to decode/guard a parser failure or warning code. Docgen will compile this and still teach the wrong use.
- `suggestedFix`: Replace each fence with a decode/`S.is` of a real member (`"REQUIRED_PART_MISSING"`, `"OCR_FAILED"`) and an observable success vs reject. Namespace-import `effect/Schema` as `S` if used. Keep the existing title or rename to “(Guard a parser failure code)” / “(Guard a non-fatal warning code)”.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-models
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: remainder-models-R1-006
- `status`: open
- `fixedCommit`: pending

### remainder-models-R1-006: OfficeParser LiteralKits missing meaningful $I annotations

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/metadata/services/officeparser/OfficeParser.models.ts:80; scratchpad/metadata/services/officeparser/OfficeParser.models.ts:108
- `symbol`: OfficeErrorType, OfficeWarningType
- `kind`: value
- `evidence`: `OfficeErrorType` pipes `$I.annoteSchema("OfficeErrorType", { description: "" })`. `OfficeWarningType` is a bare `LiteralKit([...])` with no `$I.annote` / `$I.annoteSchema`. Same-name types at L92/L162 are already documented with described `@see` (good). Remaining 81 owning exports are interfaces/type aliases, not runtime schemas.
- `impact`: The only two runtime schemas in this file do not publish identity descriptions; WarningType has no identity annotation at all.
- `suggestedFix`: Give `OfficeErrorType` a real description (“Stable failure codes from OfficeParser parse and generate operations.”). Annotate `OfficeWarningType` the same way (`.pipe($I.annoteSchema(...))` or `.annotate($I.annote(...))` per LiteralKit pattern).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-models
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: remainder-models-R1-005
- `status`: open
- `fixedCommit`: pending

### remainder-models-R1-007: CitationSyntax lead injects a TSDoc `@citekey` tag

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/metadata/services/officeparser/OfficeParser.models.ts:1365
- `symbol`: CitationSyntax
- `kind`: type
- `evidence`: Lead is `Selects \`[@citekey]\` citations or disables citation syntax.` Census parsed `@citekey` as a tag (`tags` includes `@citekey`) but filed no mechanical finding. TSDoc still treats `@citekey` as an unknown tag.
- `impact`: Hover/docgen can swallow the citation example as a tag instead of showing the Markdown syntax the union selects.
- `suggestedFix`: Rewrite without an `@` tag, e.g. “Selects Pandoc-style at-citekey citations (`[@` + `citekey]`) or disables citation syntax.” Keep `@category type-level` `@since 0.0.0`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-models
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### remainder-models-R1-008: OfficeParser docs still name removed OCR APIs

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/metadata/services/officeparser/OfficeParser.models.ts:165; scratchpad/metadata/services/officeparser/OfficeParser.models.ts:190; scratchpad/metadata/services/officeparser/OfficeParser.models.ts:282; scratchpad/metadata/services/officeparser/OfficeParser.models.ts:355; scratchpad/metadata/services/officeparser/OfficeParser.models.ts:3105
- `symbol`: OcrTimeoutConfig, OcrConfig, CommonOfficeParserConfig, OfficeAttachment
- `kind`: type
- `evidence`: Implementation-level comments already warn, but they point at APIs that are not on these types. `OcrTimeoutConfig` lead/Details say flat `OcrConfig` timeouts (e.g. `autoTerminateTimeout`) are deprecated and lose to `timeout.autoTerminate`; `OcrConfig` has no such fields. `autoTerminate` Details `{@link terminateOcr}` has no sibling in this module. `CommonOfficeParserConfig.ocrConfig` says `ocrLanguage` is ignored in favor of `ocrConfig.language`; there is no `ocrLanguage` field. `OfficeAttachment.ocrText` says OCR uses `config.ocrLanguage`.
- `impact`: Callers will look for `ocrLanguage`, `autoTerminateTimeout`, and `terminateOcr` that this models file does not export, and will miss `ocrConfig.language` / `timeout.*`.
- `suggestedFix`: Point every timeout override at `OcrConfig.timeout` keys only. Point language at `ocrConfig.language`. Drop or qualify `{@link terminateOcr}` unless that helper is documented in this slice. Put the “nested timeout wins” rule in **Gotchas** on `OcrTimeoutConfig` / `OcrConfig.timeout`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-models
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### remainder-models-R1-009: OntoSkills.models.ts missing module fileoverview

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/ontoskills/OntoSkills.models.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-module-summary|missing-packageDocumentation|missing-module-since`. File opens on imports and `$I`. Confirmed.
- `impact`: The OntoSkills schema module fails the exporting-module gate despite 56 documented value exports.
- `suggestedFix`: Fileoverview: schema-first port of OntoSkills extraction/compiler models (requirements, execution payloads, knowledge nodes, SKILL.md frontmatter, Phase 1 content blocks). `@packageDocumentation` `@since 0.0.0`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-models
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### remainder-models-R1-010: OntoSkills same-name type companions missing @category/@since

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/ontoskills/OntoSkills.models.ts:42; scratchpad/ontoskills/OntoSkills.models.ts:89; scratchpad/ontoskills/OntoSkills.models.ts:119; scratchpad/ontoskills/OntoSkills.models.ts:172; scratchpad/ontoskills/OntoSkills.models.ts:226; scratchpad/ontoskills/OntoSkills.models.ts:254; scratchpad/ontoskills/OntoSkills.models.ts:276; scratchpad/ontoskills/OntoSkills.models.ts:321; scratchpad/ontoskills/OntoSkills.models.ts:416; scratchpad/ontoskills/OntoSkills.models.ts:489; scratchpad/ontoskills/OntoSkills.models.ts:528; scratchpad/ontoskills/OntoSkills.models.ts:639; scratchpad/ontoskills/OntoSkills.models.ts:723; scratchpad/ontoskills/OntoSkills.models.ts:755; scratchpad/ontoskills/OntoSkills.models.ts:777; scratchpad/ontoskills/OntoSkills.models.ts:902; scratchpad/ontoskills/OntoSkills.models.ts:934; scratchpad/ontoskills/OntoSkills.models.ts:1000; scratchpad/ontoskills/OntoSkills.models.ts:1034; scratchpad/ontoskills/OntoSkills.models.ts:1164; scratchpad/ontoskills/OntoSkills.models.ts:1291; scratchpad/ontoskills/OntoSkills.models.ts:1443; scratchpad/ontoskills/OntoSkills.models.ts:1597; scratchpad/ontoskills/OntoSkills.models.ts:1697
- `symbol`: RequirementType, ExecutionPayloadExecutor, DurationFromSeconds, StateUri, StateTransitionFromWire, ExecutionPayloadFromWire, SeverityLevel, KnowledgeNodeType, KnowledgeNodesFromLLM, TemplateAnnotationType, ReferenceFilePurpose, SkillId, RelationId, IsUserInvocable, SkillType, SkillName, FrontmatterDescription, FlowchartType, ContentBlockType, ProcedureStep, BulletItem, ContentBlock, Section, SkeletonNode
- `kind`: type
- `evidence`: Census `missing-required-tags` (`@category`, `@since`) confirmed on all 24 same-name aliases. One-line leads exist (`/** Decoded requirement category. */`), so `missing-summary` was correctly not filed. Example is optional here; do not add one.
- `impact`: Twenty-four decoded companions fail the type-level tag ratchet and do not meet the annotation-patterns companion template.
- `suggestedFix`: Expand each one-liner to “Decoded value produced by {@link Name}.” Add described `@see {@link Name} for the runtime schema and decoding behavior.`, `@category type-level`, `@since 0.0.0`. See remainder-models-R1-015 for the `@see` requirement.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-models
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: remainder-models-R1-015
- `status`: open
- `fixedCommit`: pending

### remainder-models-R1-011: OntoSkills recursive namespaces missing @category/@since

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/ontoskills/OntoSkills.models.ts:1112; scratchpad/ontoskills/OntoSkills.models.ts:1239; scratchpad/ontoskills/OntoSkills.models.ts:1446; scratchpad/ontoskills/OntoSkills.models.ts:1529; scratchpad/ontoskills/OntoSkills.models.ts:1648
- `symbol`: ProcedureStep, BulletItem, ContentBlock, Section, SkeletonNode
- `kind`: type
- `evidence`: Each `export declare namespace` has a one-line lead only (`/** Recursive procedure-step decoded and encoded shapes. */`). Confirmed missing `@category` `@since`. Census also lists `@example` because it classified these as `value/namespace`; reject that part (see Rejected false positives). The paired `export const` codecs at L1153/L1280/L1421/L1584/L1687 already have value-level docs.
- `impact`: Callers of `ProcedureStep.Type` / `.Encoded` (and siblings) get no category/since on the namespace that exists specifically to name those recursive shapes.
- `suggestedFix`: Keep the lead; add described `@see` to the runtime const of the same name; `@category type-level` `@since 0.0.0`. Do not add an Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-models
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### remainder-models-R1-012: OntoSkills value Examples have no compilable ts fence

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/ontoskills/OntoSkills.models.ts:29
- `symbol`: RequirementType, Requirement, ExecutionPayloadExecutor, DurationFromSeconds, ExecutionPayload, StateUri, StateTransition, StateTransitionFromWire, ExecutionPayloadFromWire, SeverityLevel, KnowledgeNodeType, KnowledgeNode, KnowledgeNodesFromLLM, CodeAnnotation, TableAnnotation, FlowchartAnnotation, TemplateAnnotationType, TemplateAnnotation, ReferenceFilePurpose, ReferenceFile, Example, WorkflowStep, Workflow, SkillId, RelationId, IsUserInvocable, SkillType, ExtractedSkill, SkillName, FrontmatterDescription, Frontmatter, FileInfo, FlowchartType, ContentBlockType, CodeBlock, MarkdownTable, FlowchartBlock, ProcedureStep, OrderedProcedure, TemplateBlock, Paragraph, BulletItem, BulletListBlock, BlockQuoteBlock, HTMLBlock, FrontmatterBlock, HeadingBlock, ContentBlock, Section, ContentExtraction, FlatBlock, SkeletonNode, SkeletonListItem, DocumentSkeleton, DirectoryScan, CompiledSkill
- `kind`: value
- `evidence`: All 56 value-level owning exports have `**Example** (Title)` so census `missing-required-tags` for `@example` is closed. There is not a single fenced `ts` block in the file. Examples are prose/backticks (`"Tool"` identifies…, `Requirement.make({...})`.). Law: every Example contains exactly one fenced `ts` block and must compile under docgen. Concrete error inside the prose: `Workflow` is titled “(Single-step workflow)” but the snippet uses `steps: []`.
- `impact`: Docgen cannot typecheck these Examples; callers cannot paste them. The census will stay green while the quality bar and `enforceExamples` docgen config fail.
- `suggestedFix`: Rewrite each Example to one titled fence that constructs or `S.decodeUnknownSync`/`S.is`s the schema with realistic input and an observable result (`console.log` or `// =>`). Use `import * as S from "effect/Schema"` and `import * as O from "effect/Option"` when those modules appear; never named Schema/Option imports. Fix the Workflow example to include one `WorkflowStep` or retitle it. Do this together with remainder-models-R1-013 so Details/Gotchas move above the fence.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-models
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: remainder-models-R1-013
- `status`: open
- `fixedCommit`: pending

### remainder-models-R1-013: OntoSkills Details/Gotchas appear after Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/ontoskills/OntoSkills.models.ts:47; scratchpad/ontoskills/OntoSkills.models.ts:94; scratchpad/ontoskills/OntoSkills.models.ts:145; scratchpad/ontoskills/OntoSkills.models.ts:326; scratchpad/ontoskills/OntoSkills.models.ts:390; scratchpad/ontoskills/OntoSkills.models.ts:694; scratchpad/ontoskills/OntoSkills.models.ts:782; scratchpad/ontoskills/OntoSkills.models.ts:879; scratchpad/ontoskills/OntoSkills.models.ts:1142; scratchpad/ontoskills/OntoSkills.models.ts:1269; scratchpad/ontoskills/OntoSkills.models.ts:1573; scratchpad/ontoskills/OntoSkills.models.ts:1676
- `symbol`: Requirement, DurationFromSeconds, StateUri, KnowledgeNode, KnowledgeNodesFromLLM, RelationId, ExtractedSkill, SkillName, ProcedureStep, BulletItem, Section, SkeletonNode
- `kind`: value
- `evidence`: Canonical order is When to use → Details → Gotchas → Examples last. These twelve blocks put `**Details**` or `**Gotchas**` after `**Example**`. Example: `KnowledgeNodesFromLLM` Example then Gotchas (“This codec has no logging side effect…”). The Gotcha content is worth keeping; the placement is a grammar fail.
- `impact`: Touched OntoSkills docs fail the section-order law even after fences are added.
- `suggestedFix`: Move each Details/Gotchas block above the Example. Do not invent empty When-to-use sections.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-models
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: remainder-models-R1-012
- `status`: open
- `fixedCommit`: pending

### remainder-models-R1-014: OntoSkills uses non-canonical @category transformations

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts
- `affectedFiles`: scratchpad/ontoskills/OntoSkills.models.ts:102; scratchpad/ontoskills/OntoSkills.models.ts:213; scratchpad/ontoskills/OntoSkills.models.ts:241; scratchpad/ontoskills/OntoSkills.models.ts:399; scratchpad/ontoskills/OntoSkills.models.ts:702; scratchpad/ontoskills/OntoSkills.models.ts:745; scratchpad/ontoskills/OntoSkills.models.ts:888
- `symbol`: DurationFromSeconds, StateTransitionFromWire, ExecutionPayloadFromWire, KnowledgeNodesFromLLM, RelationId, IsUserInvocable, SkillName
- `kind`: value
- `evidence`: `@category transformations` is not in `CANONICAL_JSDOC_CATEGORIES`, not a legacy alias, and not a rejected topology slug. New/touched blocks must use a canonical role. These seven are decode/encode boundary codecs (`S.decodeTo`, JSON-string unions, lossy name normalization).
- `impact`: Category normalization will mark these `unknown`; docgen grouping will not place them with other codecs.
- `suggestedFix`: Use `@category codecs` (or `decoding` where the symbol is ingress-only: `StateTransitionFromWire`, `ExecutionPayloadFromWire`, `KnowledgeNodesFromLLM`). Leave `models` / `validation` / `schemas` on the other OntoSkills values; those are canonical.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-models
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### remainder-models-R1-015: OntoSkills type companions lack described @see {@link}

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md; .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/ontoskills/OntoSkills.models.ts:41
- `symbol`: RequirementType, ExecutionPayloadExecutor, DurationFromSeconds, StateUri, StateTransitionFromWire, ExecutionPayloadFromWire, SeverityLevel, KnowledgeNodeType, KnowledgeNodesFromLLM, TemplateAnnotationType, ReferenceFilePurpose, SkillId, RelationId, IsUserInvocable, SkillType, SkillName, FrontmatterDescription, FlowchartType, ContentBlockType, ProcedureStep, BulletItem, ContentBlock, Section, SkeletonNode
- `kind`: type
- `evidence`: Annotation-patterns same-name alias template requires a described `@see {@link MySchema} for the runtime schema and decoding behavior.` These 24 aliases have neither `{@link}` in the lead nor `@see`. Bare `@see` is forbidden; described `@see` is missing entirely. File-wide grep for `@see` in OntoSkills.models.ts is empty.
- `impact`: Hover on the type does not send the reader to the codec that actually validates/decodes.
- `suggestedFix`: While adding tags for remainder-models-R1-010, add the described `@see` and an inline `{@link}` in the lead. Tag order: `@see` then `@category` then `@since`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-models
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: remainder-models-R1-010
- `status`: open
- `fixedCommit`: pending

### remainder-models-R1-016: Registry.models.ts missing module fileoverview

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/ontoskills/registry/Registry.models.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-module-summary|missing-packageDocumentation|missing-module-since`. Confirmed. Working-tree file is already dirty; document in place, do not revert.
- `impact`: Registry models fail the exporting-module gate.
- `suggestedFix`: Fileoverview: installed-package lock, source indexes, trust tiers, and install-target resolution for OntoSkills. `@packageDocumentation` `@since 0.0.0`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-models
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### remainder-models-R1-017: Registry.models.ts owning exports lack required JSDoc

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/ontoskills/registry/Registry.models.ts:11
- `symbol`: TrustTier, SourceKind, PackageSkillManifest, PackageManifest, InstalledSkillState, InstalledSkillStateValueBase, InstalledPackageVerifiedStateValue, InstalledPackageOfficialStateValue, InstalledPackageCommunityStateValue, InstalledPackageLocalStateValue, InstalledPackageStateValue, InstalledPackageStateBase, InstalledOntologyPackageState, InstalledSourcePackageState, InstalledPackageState, RegistryLock, RegistrySource, RegistryPackageEntry, EmbeddingModelInfo, RegistryIndex, AuthorTarget, PackageTarget, SkillTarget, InstallTarget
- `kind`: value
- `evidence`: All 29 owning exports confirmed. Values missing lead+`@category`+`@since`+Example except four classes with leads only: `EmbeddingModelInfo` L216 (“Global embedding model declaration for the registry.”), `AuthorTarget` L242, `PackageTarget` L256, `SkillTarget` L269 (census `missing-required-tags` only). `RegistryIndex` L229 is an empty `/** */` so `missing-summary` is correct. Types `TrustTier` L21, `SourceKind` L34, `InstalledPackageStateValue` L133, `InstalledPackageState` L174, `InstallTarget` L297 need lead+`@category`+`@since` only (no Example). Same-name aliases exist for the three unions and two LiteralKits.
- `impact`: The registry lock/index/install-target model is undocumented; census open-owning count for this file stays at 29.
- `suggestedFix`: Document in the dirty file; do not revert. Value-level: purpose lead (not a name echo), titled Example that `make`s/`S.decode`s a minimal realistic value (e.g. `TrustTier.Enum.community`, an `InstallTarget` tagged member), `@category schemas` or `models`, `@since 0.0.0`. Type companions: annotation-patterns template with described `@see`. For empty-field classes see remainder-models-R1-019. Discriminated extensions should `@see` the sibling trust-tier / source-kind variants so callers can choose.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-models
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: remainder-models-R1-018, remainder-models-R1-019
- `status`: open
- `fixedCommit`: pending

### remainder-models-R1-018: Registry.models.ts $I identity and annotation payloads are wrong

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/ontoskills/registry/Registry.models.ts:9; scratchpad/ontoskills/registry/Registry.models.ts:16; scratchpad/ontoskills/registry/Registry.models.ts:73; scratchpad/ontoskills/registry/Registry.models.ts:236
- `symbol`: TrustTier, InstalledSkillStateValueBase, RegistryIndex
- `kind`: value
- `evidence`: `$I` is `$ScratchpadId.create("ontoskills/OntoSkills.models")` in a registry file, so every `$I.annote` / `$I.annoteSchema` identifier collides with OntoSkills.models. Every annotation uses `description: ""`. Copy-paste identifier bugs: `InstalledSkillStateValueBase` is annotated `"InstalledSkillStateBase"` (L73); `RegistryIndex` is annotated `"EmbeddingModelInfo"` (L236). Review only; do not revert other dirty edits.
- `impact`: Schema identity strings will clash with OntoSkills models and two classes publish the wrong name. Empty descriptions fail annotation-patterns.
- `suggestedFix`: Point `$I` at `"ontoskills/registry/Registry.models"`. Match each annote identifier to the exported symbol. Fill descriptions with the JSDoc lead purpose. Keep `$I.annote` on classes and `$I.annoteSchema` on unions/LiteralKits.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-models
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: remainder-models-R1-017
- `status`: open
- `fixedCommit`: pending

### remainder-models-R1-019: Registry empty Class schemas need an explicit stub Gotcha

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/ontoskills/registry/Registry.models.ts:36; scratchpad/ontoskills/registry/Registry.models.ts:44; scratchpad/ontoskills/registry/Registry.models.ts:52
- `symbol`: PackageSkillManifest, PackageManifest, InstalledSkillState
- `kind`: value
- `evidence`: These three `S.Class` exports have `{}` fields. The empty shape is the behavior; a lead that restates the name (“Package skill manifest”) would hide that callers currently get no fields. `InstalledSkillStateValueBase.skills` is typed as `InstalledSkillState`, so the empty class is already on a live field.
- `impact`: Callers will assume a populated manifest/state object and invent fields that will fail decode.
- `suggestedFix`: Lead must say the class is currently an empty schema shell (no decoded fields) used as a placeholder in `InstalledSkillStateValueBase.skills` / future manifest ports. **Gotchas**: constructing `PackageSkillManifest.make({})` is the only valid instance until fields are ported. Example: `PackageSkillManifest.make({})` and log `S.encodeSync(PackageSkillManifest)(value)`. Do not write vague “represents a package skill manifest” prose.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: remainder-models
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: remainder-models-R1-017
- `status`: open
- `fixedCommit`: pending

---

## Pack verdict

- files reviewed: 4
- owning exports reviewed: 203
- confirmed mechanical items: 8
- editorial items: 11
- rejected false positives: 5
- accepted findings: 19

Every exporting module and every owning export in the ontoskills/metadata filter was reviewed. Mechanical census misses were confirmed except the five namespace `@example` flags. OfficeParser’s 83 owning exports are mechanically closed and were still editorially reviewed; remaining defects there are placeholder LiteralKit Examples, empty/missing `$I` annotations, a `@citekey` TSDoc collision, stale OCR field names, and the missing module header.
