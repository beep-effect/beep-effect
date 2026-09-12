# Independent upstream verification supplement

This lane found concurrently authored `upstream-delta.md` and `performance-baseline.md`; their original evidence is preserved. This supplement corrects adoption-boundary errors and adds independently collected, more specific exposure counts. It does not certify the other writer's untruncated full-commit coverage. Reference SHA: `51d4a2f08a5c7691dc876415bc9fc0ecf467e153`.

## Public surface correction

| Original suggestion | Verified correction | Evidence relative to `.repos/effect/` |
|---|---|---|
| Retire NormalizedBooleanString directly to BooleanLiterals | **Withdraw this public-API recommendation.** TrueLiterals, FalseLiterals and BooleanLiterals have `@internal`; none appeared in installed `dist/Schema.d.ts`. A supported public replacement is UNVERIFIED in this lane. | `packages/effect/src/Schema.ts:5432`, `:5435`, `:5438` |
| Adopt withArrayLengthConstraints as new public Schema helper | **Exclude from public inventory/adoption.** It is exported source with `@internal`, absent from installed declaration surface. Public Array.check length filters remain separate APIs. | `packages/effect/src/Schema.ts:4473` |
| Derive retirement from export keyword alone | Source exports do not establish supported public API; inspect preceding JSDoc and published declarations. | Same evidence above |

Commands: `rg -n 'BooleanLiterals|TrueLiterals|FalseLiterals|withArrayLengthConstraints' .repos/effect/packages/effect/src/Schema.ts node_modules/effect/dist/Schema.d.ts`; inspect preceding JSDoc with `sed -n '5429,5442p'` and `sed -n '4471,4478p'` on upstream Schema.ts.

## Independent per-commit exposure and current action

Every row maps to the main report's consumer-facing change and upstream `path:line` evidence. Here action means **remaining local work**, rather than historical API-change category; this explains different tags for zero-residual renames. A retirement lead does not mean the named upstream capability originated in that commit.

Count command, once per exact regex stored in [delta-counts.json](delta-counts.json): `rg -n "$pattern" packages/ apps/`. Count output lines and distinct paths before the first colon. Default ignore rules; docs, tests and fixtures included. Counts are lexical matching lines/files, **not resolved calls or migration obligations**. Aliases can evade narrow expressions. Stored JSON contains every exact expression and example hits.

| Commit | Current action | Query key | Matching lines / files | Finding |
|---|---|---|---:|---|
| `657254b821` | NOOP | `construction` | 7096 / 1141 | Automatic initialization benefit already in rc.115; no application change required. |
| `482b7d7eb0` | ADOPT | `json_import` | 0 / 0 | No lexical import entry-point usage; evaluate best-effort JSON Schema ingestion, not semantic round-trip equivalence. |
| `716e0c0094` | NOOP | `arbitrary_constraint_old` | 0 / 0 | Historical rename is real; no residual ToArbitrary.Constraint reference found. |
| `53909a9bf1` | ADOPT | `json_export` | 12 / 5 | Existing PackageJsonTools exports already request onExcessProperty:error; review open-object defaults at other export boundaries. |
| `c8349ede1a` | NOOP | `old_transform` | 0 / 0 | No residual rename; new_transform records 73 lines / 48 files already using transformEffect. |
| `10d2c983a8` | MIGRATE | `parse_removed` | 1 / 1 | Confirmed stale propertyOrder recognition in SchemaUtils/isCodecDataFirst.ts:14. |
| `0a08ae0626` | ADOPT | `network` | 2 / 2 | Network-name hits are candidates only; 129 Port lines / 39 files do not establish a Schema.Port replacement. |
| `db995df19b` | MIGRATE | `all_template` | 29 / 25 | Audit encoding-bearing TemplateLiteral parts; present 4 Parser lines / 3 files already use the separate codec API. Transitive encoding closure UNVERIFIED. |
| `74dd9b3be8` | NOOP | `encode_to` | 1 / 1 | Only catalog text matched; composition type fix is installed. |
| `fa6027b16e` | NOOP | `schema_error` | 6 / 5 | Guard/internal dependency fix automatic; no locally measured HTTP cold-start improvement. |
| `4372c79a32` | NOOP | `bracket_tree` | 0 / 0 | No direct bracket-tree adapter names found; internal fix installed. |
| `180b635aea` | NOOP | `json_pointer` | 0 / 0 | No direct JsonPointer names found; JSON Schema exporters receive shared-reference fixes indirectly. |
| `53511efcd1` | NOOP | `array_ensure` | 0 / 0 | No lexical ArrayEnsure consumers found. |
| `d3c6b73cc4` | NOOP | `field_option` | 2 / 1 | EffectModel.FieldOption test and description matched; omission preservation installed. |
| `6f090d4c20` | NOOP | `variant` | 97 / 14 | Exposure includes own VariantSchema concepts; not all hits resolve to upstream. |
| `243c72f001` | NOOP | `declaration_run` | 0 / 0 | Removed exported DeclarationRun has no lexical reference; direct custom declaration contracts still deserve per-concept review. |
| `a1177caf27` | NOOP | `byte_size` | 30 / 8 | ByteSize is already consumed; branded-bigint representation installed. |
| `a2c9e7c17a` | RETIRE-LEAD | `graph_local` | 54 / 8 | Immutable GraphFromSelf / DirectedGraphFromSelf / UndirectedGraphFromSelf have same-intent Schema.Graph; mutable concepts remain unproven. |
| `629870d461` | NOOP | `bracket_tree` | 0 / 0 | Duplicate array-leaf handling installed; no direct names found. |
| `46d83101e8` | ADOPT | `http_old` | 0 / 0 | No old schema names; adopt public Schema HTTP codecs where needed. HttpHeaders security policy is a different intent. |
| `9642776614` | NOOP | `ast_base` | 0 / 0 | No SchemaAST.Base reference; prototype query also zero. Broad AST usage is not evidence of breakage. |
| `5641ad333a` | NOOP | `reviver` | 0 / 0 | No queried reviver references; XML encoder query also zero. BooleanLiterals is INTERNAL, not a public retirement target. |
| `40466bf397` | NOOP | `schema_ast` | 252 / 89 | Documentation cleanup; AST exposure count does not imply action. |
| `53843f6490` | ADOPT | `byte_size` | 30 / 8 | Use exact numeric byte schemas for sizes; local Bytes is a Uint8Array payload and has different intent. |
| `145d8e1013` | NOOP | `mutable` | 34 / 11 | Element/container encoding fix already installed; lexical S/Schema.mutable exposure only. |
| `b945ded23a` | NOOP | `old_marker` | 0 / 0 | No old SchemaError protocol marker found. |
| `a63dcbf04e` | ADOPT | `native_arbitrary` | 1626 / 342 | Native usage already extensive. Replace local forbidden() encode placeholders with public forbiddenEncoding; retain specialized generation until reviewed. |
| `84864bc30c` | RETIRE-LEAD | `equivalence_wrapper` | 32 / 17 | Delete SchemaUtils/toEquivalence wrapper and adapt dual calls to Schema.toEquivalence. Existing upstream capability; class-fix commit is a discovery lead, not its introduction. |

## Concrete follow-up evidence

| Item | Repo evidence (relative repo root) | Upstream evidence (relative `.repos/effect/`) | Adaptation / limit |
|---|---|---|---|
| Stale parse-option dispatcher | `packages/foundation/modeling/schema/src/SchemaUtils/isCodecDataFirst.ts:14` | `packages/effect/src/SchemaAST.ts:497` | Remove obsolete propertyOrder recognition; test a single data argument containing that key so option/data classification is deliberate. |
| Immutable graph schema concepts | `packages/foundation/modeling/schema/src/Graph/Graph.from-self.ts:41`, `:193` | `packages/effect/src/Schema.ts:12536`, `:12565` | Schema.Graph accepts node/edge schemas and immutable kind. Adapt encoded representation and argument order; generic local kind can use a union. Do not claim mutable graph support: upstream explicitly rejects mutable input. |
| Equivalence dual wrapper | `packages/foundation/modeling/schema/src/SchemaUtils/toEquivalence.ts:70` | `packages/effect/src/Schema.ts:13940` (class field-equivalence derivation) | Local implementation is dual(2, S.toEquivalence(schema)); same comparison intent. Replace data-last invocations, delete wrapper/export in consumer migration. No measured speedup asserted. |
| Forbidden encode placeholders | `packages/foundation/modeling/schema/src/Sha256.ts:116` | `packages/effect/src/SchemaGetter.ts:252` | 18 lines / 8 files from forbidden_encoding query. Use forbiddenEncoding; accept deliberate diagnostic changes. This deletes call-site construction, not an entire proved custom schema concept. |
| Already explicit JSON strictness | `packages/tooling/library/repo-utils/src/schemas/PackageJsonTools.ts:295`, `:311` | `packages/effect/src/Schema.ts:14350` | Both inspected source exporters already request error on excess properties; do not migrate arbitrary JSON additionalProperties fields as if they were old function options. |
| Byte payload versus size | `packages/foundation/modeling/schema/src/Bytes.ts:49` | `packages/effect/src/Schema.ts:10312` | Uint8Array payload versus numeric size: no intent-level replacement. |

## ADOPT/MIGRATE/RETIRE-LEAD rollup

Verification command: `rg -c '^\| `[0-9a-f]{10}` \| (ADOPT|MIGRATE|RETIRE-LEAD|NOOP) \|' upstream-verification-supplement.md` in this research directory; replace alternation with each tag for subtotals.

| Tag | Commits | Work |
|---|---:|---|
| ADOPT | 6 | JSON import/export capability review; network schemas; moved HTTP schemas; ByteSize; native arbitrary and forbiddenEncoding. |
| MIGRATE | 2 | Confirmed stale propertyOrder dispatcher; encoded TemplateLiteral audit (remaining broken call sites UNVERIFIED). |
| RETIRE-LEAD | 2 | Immutable GraphFromSelf family and SchemaUtils/toEquivalence; same-change consumer adaptation/deletion, no aliases. |
| NOOP | 18 | Installed fixes or no identified remaining direct migration; not a semantic zero-backlog certification. |

## Coverage limit

All 28 hint-list stats were read; schema-facing changes were inspected through hunks/current source and normalized declaration comparisons. Complete untruncated reading of every hunk of the requested large commits remains **UNVERIFIED**, especially `5641ad333a` and `a63dcbf04e`. This lane cannot honestly mark that requested full-read acceptance criterion complete. No runtime semantic probes were executed. Preserve this limitation when integrating the packet.
