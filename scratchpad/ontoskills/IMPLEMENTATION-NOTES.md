# OntoSkills schema-first port notes

## Outcome

`OntoSkills.models.ts` now covers every class, alias, validator, computed field, and declared default in
`core/src/schemas.py`. The strict model is flat where the Python wire is flat, recursive structures use suspended
codecs with explicit decoded and encoded namespaces, and lenient Python pre-validation behavior is isolated in named
ingress codecs.

## Compatibility deviation — 1 total

### 1. Strict class encodings use camelCase keys

This is the sole compatibility deviation. The installed `effect@4.0.0-rc.112` exposes whole-codec
`S.encodeKeys(...)` (`node_modules/effect/src/Schema.ts:3627-3681`) but no clean per-field `fromKey` or
`propertySignature` equivalent. Applying `encodeKeys` to an `S.Class` produces a transformed codec and removes the
class extension surface required by `CompiledSkill extends ExtractedSkill.extend<CompiledSkill>()`.

Consequently, strict classes encode camelCase keys. This includes `ExtractedSkill` fields such as `argumentHint` and
the `ContentBlock` discriminator `blockType`. The explicit boundary codecs use Python snake_case wherever their
contract needs it:

- `StateTransitionFromWire` maps all three state keys.
- `KnowledgeNodesFromLLM` accepts snake_case knowledge-node objects and JSON strings.
- `ExecutionPayloadFromWire` needs no mapping because its three Python keys are already unchanged.

If Effect later supplies a class-preserving per-field encoded-key facility, replacing this fallback is the only wire
compatibility follow-up.

## Source-backed precision decisions

| Decision | Disposition | Receipt and reason |
| --- | --- | --- |
| Timeout unit | `DurationFromSeconds` | `core_ontology.py:621-627` defines execution timeout in seconds; `serialization.py:353-354` serializes that integer directly. Installed Effect supplies `Duration.seconds` and `Duration.toSeconds` at `node_modules/effect/src/Duration.ts:707,811`. |
| `hash` and `content_hash` | `Sha256` | `loader.py:182-188,296-322` and `extractor.py:52-57,202-207` compute SHA-256 and store full hexadecimal digests. |
| Version | `Option<string>` | `schemas.py:144,291` accepts arbitrary optional strings. Live values include `"1.0"` in `core/tests/test_loader_fields.py:39-42`, `"workspace"` in `registry/state.py:124`, and `"import-%Y%m%d%H%M%S"` in `registry/install.py:283`; SemVer would reject real values. |
| Provenance | `Option<NonEmptyTrimmedStr>` | `transformer.py:341-342` writes `str(skill_dir)` and `serialization.py:358-359` serializes the literal path; no structured PROV-O value contract exists at this boundary. |
| Positive/nonnegative values | `PosInt` / `NonNegativeInt` | One-based positions and orders use `PosInt`; byte sizes, counts, indexes, and document order values use `NonNegativeInt`. |
| Missing-or-null Python optionals | `S.OptionFromNullOr(...)` plus missing-key default | This preserves Pydantic's `T | None = None` acceptance without weakening the decoded model. |

The first four rows are intentional source-backed type choices, not compatibility deviations.

## Disposition ledger delta

Every item from PORT-REVIEW section B.1 is now `ported` or `redesigned-ok`:

| Python declaration or behavior | Status | Final disposition |
| --- | --- | --- |
| `Requirement` | `redesigned-ok` | One class uses the `RequirementType` LiteralKit field and a false default. |
| `ExecutionPayload` | `redesigned-ok` | One class uses the executor LiteralKit and an optional seconds-based Duration. |
| `StateTransition` | `redesigned-ok` | One strict class uses `StateUri` arrays; a named wire codec handles object or JSON input. |
| `StateTransition.validate_state_uris` | `ported` | The exact `oc:` grammar is a checked, branded `StateUri` used by every edge array. |
| `SeverityLevel` | `ported` | The four-value LiteralKit stands alone, with no misplaced member factory. |
| `KnowledgeNodeType` alias | `ported` | All 31 values and their dimension comments are preserved in one LiteralKit. |
| `KnowledgeNode` | `redesigned-ok` | One flat strict class uses required type/content and nullish-or-missing Options. |
| `CodeAnnotation` | `ported` | Code content, language, and nonnegative index are represented directly. |
| `TableAnnotation` | `ported` | Table content and nonnegative index are represented directly. |
| `FlowchartAnnotation` | `ported` | Mermaid content and nonnegative index are represented directly. |
| `TemplateAnnotation` | `redesigned-ok` | One class uses the prompt/output/boilerplate LiteralKit field. |
| `ExtractedSkill` | `redesigned-ok` | Python's complete flat field set is restored with strict schemas and defaults. |
| `validate_skill_relation_ids` | `redesigned-ok` | `RelationId` is a trim/URI-pass-through/final-segment transformation and is used on all relation arrays. |
| `coerce_is_user_invocable` | `ported` | Boolean or string input follows the exact lowercase true/yes/1 truth set and defaults true. |
| `parse_and_clean_nested_data` | `redesigned-ok` | Named codecs accept objects or JSON; the LLM collection codec drops invalid knowledge elements. |
| `skill_type` computed field | `ported` | A LiteralKit-backed static and getter derive executable/declarative from the payload Option. |
| `Frontmatter` | `ported` | Name, description, optional arbitrary version, and metadata record are present. |
| `Frontmatter.validate_name` | `redesigned-ok` | A lossy transform, checks, and brand implement the exact canonicalization contract. |
| `Frontmatter.validate_description` | `ported` | Maximum length and tag rejection are checked with explicit metadata. |
| `FileInfo` | `ported` | Relative path, SHA-256 content hash, byte size, and MIME type are represented. |
| `CodeBlock` | `ported` | Tagged code content, language, and document order are represented. |
| `MarkdownTable` | `ported` | Tagged headers, rows, nullable caption, and document order are represented. |
| `FlowchartBlock` | `ported` | Tagged Mermaid content, chart LiteralKit, and document order are represented. |
| `ProcedureStep` | `ported` | One-based position and recursively suspended child blocks are represented. |
| `OrderedProcedure` | `ported` | Tagged ordered steps and document order are represented. |
| `TemplateBlock` | `ported` | Tagged template content, detected variables, and document order are represented. |
| `Paragraph` | `ported` | Tagged paragraph text and document order are represented. |
| `BulletItem` | `ported` | Text and recursively suspended child blocks are represented. |
| `BulletListBlock` | `ported` | Tagged bullet items and document order are represented. |
| `BlockQuoteBlock` | `ported` | Tagged quote content, nullable attribution, and document order are represented. |
| `HTMLBlock` | `ported` | Tagged raw HTML and document order are represented. |
| `FrontmatterBlock` | `ported` | Tagged raw YAML, property record, and document order are represented. |
| `HeadingBlock` | `ported` | Tagged level, text, and document order are represented. |
| `ContentBlock` alias | `ported` | All eleven class members form a `blockType` discriminated union via thunk members. |
| `Section` | `ported` | Suspended content blocks and self-recursive subsections preserve decoded/encoded types. |
| `ContentExtraction` | `ported` | All six aggregate collections are present with fresh empty defaults. |
| `FlatBlock` | `ported` | Flat block projection and nullable parent relationship are represented. |
| `SkeletonNode` | `ported` | The skeleton tree is self-recursive through a suspended codec. |
| `SkeletonListItem` | `ported` | Text block and child block-id list are represented without false recursion. |
| `DocumentSkeleton` | `ported` | Section roots and list-item dictionary are represented with fresh defaults. |
| `DirectoryScan` | `ported` | File totals, hashes, inventories, and optional extraction aggregate are represented. |
| `ReferenceFile` | `ported` | Path, content, and purpose LiteralKit are represented. |
| `Example` | `ported` | Name, description, code, and tags are represented. |
| `WorkflowStep` | `ported` | Step id, action, optional outcome, and validated dependency ids are represented. |
| `Workflow` | `ported` | Workflow id, description, and ordered steps are represented. |
| `CompiledSkill extends ExtractedSkill` | `ported` | The installed-v4 class extension pattern adds all compiled artifacts and defaults. |

All 77 PORT-REVIEW section B.2 defaults are also closed:

| Default group | Count | Status | Final disposition |
| --- | ---: | --- | --- |
| Requirement, execution, state transition, and knowledge-node defaults | 11 | `ported` | Boolean, empty arrays, and nullish Options decode missing keys to the Python defaults. |
| `ExtractedSkill` defaults | 23 | `redesigned-ok` | Flat metadata, relations, annotations, workflows, coercion, and Options all default at their actual owning model. |
| `Frontmatter` defaults | 2 | `ported` | Version defaults to None and metadata to a fresh empty record. |
| Phase 1 blocks, recursion, extraction, skeleton, and scan defaults | 33 | `ported` | Tags, order values, recursive arrays, records, aggregate arrays, and nullable relationships match the source. |
| Phase 2 `Example` and `WorkflowStep` defaults | 3 | `ported` | Tags/dependencies default empty and expected outcome defaults to None. |
| `CompiledSkill` defaults | 5 | `ported` | Optional compiled artifacts and all compiled collections match the source defaults. |
| **Total** | **77** | **closed** | **Every declared default in the audit ledger has a final implementation.** |

## Proof

### Narrow real typecheck

Exact required command:

```sh
./node_modules/.bin/tsgo -p scratchpad/tsconfig.json --noEmit --pretty false
```

Result: exit 1 because the shared scratchpad project has 222 pre-existing diagnostics, but **zero diagnostics name
`scratchpad/ontoskills/OntoSkills.models.ts`**. The first unrelated diagnostic is
`scratchpad/beep-docs/api-reference/ApiReference.ts(36,9): TS2305` for a missing
`OptionFromOptionalStrWithNoneDefault` export. No unrelated file was touched.

The target attribution was counted from that command's output with:

```sh
rg -c 'scratchpad/ontoskills/OntoSkills\.models\.ts' /tmp/ontoskills-tsgo-final.log
```

Result: no match, therefore target diagnostic count 0.

### Runtime codec smoke proof

The inline Bun probe decoded a qualified relation, snake_case JSON transition, seconds timeout, tolerant knowledge
array, normalized frontmatter name, recursive content block, and minimal extracted skill. Exact command:

```sh
bun -e 'import * as Duration from "effect/Duration"; import * as S from "effect/Schema"; import { ContentBlock, ExecutionPayloadFromWire, ExtractedSkill, KnowledgeNodesFromLLM, RelationId, SkillName, StateTransitionFromWire } from "./scratchpad/ontoskills/OntoSkills.models.ts"; const decode = (schema, input) => S.decodeUnknownSync(schema)(input); const relation = decode(RelationId, "author/package/docx-review"); const transition = decode(StateTransitionFromWire, JSON.stringify({ requires_state: ["oc:Ready"] })); const payload = decode(ExecutionPayloadFromWire, JSON.stringify({ executor: "shell", code: "pwd", timeout: 30 })); const nodes = decode(KnowledgeNodesFromLLM, [{ node_type: "Standard", directive_content: "Keep it strict" }, "{bad", { node_type: "Standard", directive_content: "" }, { nodeType: "Procedure", directiveContent: "Constructed shape" }]); const name = decode(SkillName, "CKM:Banner Design"); const block = decode(ContentBlock, { blockType: "ordered_procedure", items: [{ text: "Do it", position: 1, children: [{ blockType: "paragraph", textContent: "Nested", contentOrder: 0 }] }] }); const skill = decode(ExtractedSkill, { id: "docx-review", hash: "0".repeat(64), nature: "review", genus: "document", differentia: "docx", intents: ["review docs"], dependsOn: ["author/package/office"], isUserInvocable: "YES" }); console.log(JSON.stringify({ relation, transition: transition.requiresState.length, timeoutSeconds: Duration.toSeconds(payload.timeout.value), nodes: nodes.length, name, block: block.blockType, dependsOn: skill.dependsOn[0], invocable: skill.isUserInvocable, skillType: skill.skillType }));'
```

Result: exit 0 with:

```json
{"relation":"docx-review","transition":1,"timeoutSeconds":30,"nodes":2,"name":"ckm-banner-design","block":"ordered_procedure","dependsOn":"office","invocable":true,"skillType":"declarative"}
```

The two retained nodes were one valid snake_case wire object and one valid strict camelCase object; malformed JSON and
an empty directive were dropped.

### Non-applicable formatter check

`./node_modules/.bin/biome check scratchpad/ontoskills/OntoSkills.models.ts` reported that the scratchpad path is
ignored and checked zero files. It was not treated as proof and did not write anything. An initial auxiliary invocation
of `./node_modules/.bin/bun` also failed because that shim does not exist; rerunning with mise's `bun` produced the
successful smoke proof above.

## Follow-up test laws worth writing

- `SkillName` normalization is idempotent, produces only its branded canonical grammar, and rejects empty, oversized,
  or reserved results.
- `RelationId` trims URI inputs unchanged, normalizes qualified references to their final segment, rejects any invalid
  segment, and round-trips decoded values through encoding.
- State-transition and execution-payload object/JSON branches decode equivalently; duration numbers are seconds.
- Every nullish-or-missing Python optional has equivalent decoded `Option` behavior, with stable encode/decode
  round-trips for canonical values.
- `KnowledgeNodesFromLLM` retains arbitrary valid mixtures, drops arbitrary invalid elements, and leaves warning
  emission to the service boundary.
- Every `ContentBlock` member preserves its discriminator; recursive procedure, bullet, section, and skeleton values
  round-trip at arbitrary depth.
- `ExtractedSkill.skillType` is declarative exactly when `executionPayload` is None and executable exactly when it is
  Some.
- SHA-256 fixtures from the Python loader/extractor decode as `Sha256`, while malformed or shortened digests fail.
