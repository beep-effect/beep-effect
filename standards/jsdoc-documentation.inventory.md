# JSDoc Documentation Compliance Inventory

Generated: 2026-09-03T20:25:14.249Z

## Scope

The package universe is the current `bun run topo-sort` output. This inventory checks repo JSDoc rules that package docgen does not fully validate yet: kind-aware Example presence, summaries, section grammar, described links, retired tags, TSDoc grammar, example import aliases, unsafe examples, root TSDoc custom tag registration, and schema annotation/type-alias gaps.

## Totals

| Metric | Count |
|---|---:|
| packages | 136 |
| cleanPackages | 17 |
| packagesWithoutPublicSrcSurface | 3 |
| packagesNeedingRemediation | 116 |
| publicModules | 3005 |
| publicExports | 21286 |
| openModules | 370 |
| openExports | 3451 |
| missingExportExamples | 4 |
| missingExportCategories | 0 |
| missingExportSince | 0 |
| forbiddenTagFindings | 0 |
| malformedConditionalTagFindings | 0 |
| exampleImportFindings | 3731 |
| unsafeExampleFindings | 0 |
| schemaAnnotationFindings | 0 |
| undescribed-see | 12 |
| multiple-description-paragraphs | 427 |
| leading-blank | 0 |
| trailing-blank | 1 |
| invalid-heading | 1 |
| section-out-of-order | 0 |
| duplicate-section | 0 |
| empty-section | 0 |
| section-after-example | 0 |
| invalid-when-to-use-prefix | 4 |
| malformed-example | 0 |
| duplicate-example | 0 |
| loose-ts-fence | 0 |
| forbidden-remarks | 0 |
| no-root-package-import | 3730 |
| rootPolicyOpen | 0 |

## Root Policy

| File | Tag | Status | Missing |
|---|---|---|---|
| tsdoc.json | `@effects` | resolved | none |
| tsdoc.json | `@precondition` | resolved | none |
| tsdoc.json | `@postcondition` | resolved | none |
| tsdoc.json | `@invariant` | resolved | none |

## Package Summary

| Order | Package | Path | Status | Modules | Exports | Open Modules | Open Exports |
|---:|---|---|---|---:|---:|---:|---:|
| 1 | `@beep/hubspot` | `packages/drivers/hubspot` | needs-remediation | 4 | 23 | 0 | 1 |
| 2 | `@beep/agents-domain` | `packages/agents/domain` | needs-remediation | 16 | 75 | 0 | 1 |
| 3 | `@beep/ontology` | `packages/foundation/modeling/ontology` | needs-remediation | 10 | 110 | 5 | 54 |
| 4 | `@beep/rdf-canonize` | `packages/drivers/rdf-canonize` | clean | 2 | 2 | 0 | 0 |
| 5 | `@beep/architecture-lab-ui` | `packages/architecture-lab/ui` | clean | 3 | 7 | 0 | 0 |
| 6 | `@beep/root` | `.` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 7 | `@beep/pacer` | `packages/drivers/pacer` | needs-remediation | 13 | 89 | 12 | 13 |
| 8 | `@beep/workspace-tables` | `packages/workspace/tables` | clean | 19 | 48 | 0 | 0 |
| 9 | `@beep/mcp-kit` | `packages/foundation/capability/mcp-kit` | needs-remediation | 10 | 63 | 8 | 53 |
| 10 | `@beep/law-practice-server` | `packages/law-practice/server` | needs-remediation | 22 | 81 | 1 | 36 |
| 11 | `@beep/db-admin` | `packages/_internal/db-admin` | needs-remediation | 13 | 46 | 2 | 2 |
| 12 | `@beep/shared-domain` | `packages/shared/domain` | needs-remediation | 104 | 368 | 3 | 51 |
| 13 | `@beep/discord` | `packages/drivers/discord` | needs-remediation | 4 | 15 | 0 | 1 |
| 14 | `@beep/face-detection` | `packages/drivers/face-detection` | needs-remediation | 4 | 33 | 0 | 7 |
| 15 | `@beep/gov-legal-mcp` | `packages/drivers/gov-legal-mcp` | needs-remediation | 8 | 38 | 6 | 3 |
| 16 | `@beep/ontology-use-cases` | `packages/ontology/use-cases` | needs-remediation | 23 | 214 | 1 | 17 |
| 17 | `@beep/architecture-lab-client` | `packages/architecture-lab/client` | needs-remediation | 3 | 7 | 0 | 4 |
| 18 | `@beep/dock` | `packages/foundation/ui-system/dock` | needs-remediation | 20 | 212 | 0 | 189 |
| 19 | `@beep/repo-cli` | `packages/tooling/tool/cli` | needs-remediation | 223 | 1820 | 47 | 286 |
| 20 | `@beep/pglite` | `packages/drivers/pglite` | needs-remediation | 4 | 11 | 3 | 0 |
| 21 | `@beep/ai-sync` | `packages/tooling/library/ai-sync` | needs-remediation | 10 | 86 | 0 | 18 |
| 22 | `@beep/agents-server` | `packages/agents/server` | needs-remediation | 11 | 39 | 2 | 7 |
| 23 | `@beep/workspace-use-cases` | `packages/workspace/use-cases` | needs-remediation | 12 | 46 | 1 | 13 |
| 24 | `@beep/editor` | `packages/foundation/ui-system/editor` | needs-remediation | 36 | 211 | 13 | 14 |
| 25 | `@beep/nlp-mcp` | `packages/drivers/nlp-mcp` | needs-remediation | 9 | 123 | 8 | 4 |
| 26 | `@beep/law-practice-domain` | `packages/law-practice/domain` | needs-remediation | 214 | 648 | 9 | 67 |
| 27 | `@beep/repo-docgen` | `packages/tooling/tool/docgen` | needs-remediation | 10 | 86 | 0 | 23 |
| 28 | `@beep/file-processing` | `packages/foundation/capability/file-processing` | needs-remediation | 26 | 130 | 0 | 55 |
| 29 | `@beep/ontology-config` | `packages/ontology/config` | needs-remediation | 7 | 19 | 1 | 7 |
| 30 | `@beep/ai-provider-cli` | `packages/drivers/ai-provider-cli` | needs-remediation | 7 | 44 | 3 | 5 |
| 31 | `@beep/dock-react` | `packages/foundation/ui-system/dock-react` | needs-remediation | 3 | 12 | 0 | 10 |
| 32 | `@beep/lint-rules` | `packages/tooling/policy-pack/lint-rules` | needs-remediation | 9 | 32 | 1 | 0 |
| 33 | `@beep/ontology-server` | `packages/ontology/server` | needs-remediation | 8 | 24 | 0 | 2 |
| 34 | `@beep/colors` | `packages/foundation/capability/colors` | needs-remediation | 1 | 9 | 1 | 9 |
| 35 | `@beep/agents-use-cases` | `packages/agents/use-cases` | needs-remediation | 31 | 128 | 2 | 23 |
| 36 | `@beep/skill-contract` | `packages/foundation/modeling/skill-contract` | needs-remediation | 9 | 111 | 0 | 79 |
| 37 | `@beep/m365-mcp` | `packages/drivers/m365-mcp` | needs-remediation | 4 | 21 | 1 | 2 |
| 38 | `@beep/cosmos` | `packages/drivers/cosmos` | needs-remediation | 6 | 22 | 0 | 1 |
| 39 | `@beep/workspace-server` | `packages/workspace/server` | needs-remediation | 12 | 32 | 0 | 4 |
| 40 | `@beep/chalk` | `packages/foundation/capability/chalk` | needs-remediation | 1 | 35 | 1 | 35 |
| 41 | `@beep/epistemic-client` | `packages/epistemic/client` | needs-remediation | 4 | 25 | 0 | 1 |
| 42 | `@beep/uspto` | `packages/drivers/uspto` | needs-remediation | 5 | 26 | 0 | 3 |
| 43 | `@beep/phoenix` | `packages/drivers/phoenix` | needs-remediation | 5 | 50 | 0 | 2 |
| 44 | `@beep/shared-use-cases` | `packages/shared/use-cases` | needs-remediation | 6 | 15 | 0 | 1 |
| 45 | `@beep/openclaw` | `packages/drivers/openclaw` | needs-remediation | 9 | 130 | 7 | 22 |
| 46 | `@beep/law-practice-tables` | `packages/law-practice/tables` | needs-remediation | 34 | 89 | 1 | 16 |
| 47 | `@beep/test-utils` | `packages/tooling/test-kit/test-utils` | needs-remediation | 11 | 43 | 1 | 3 |
| 48 | `@beep/types` | `packages/foundation/primitive/types` | needs-remediation | 5 | 12 | 1 | 12 |
| 49 | `@beep/oip-web` | `apps/oip-web` | needs-remediation | 31 | 86 | 0 | 14 |
| 50 | `@beep/storybook` | `apps/storybook` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 51 | `@beep/exiftool` | `packages/drivers/exiftool` | needs-remediation | 5 | 55 | 1 | 1 |
| 52 | `@beep/agents-tables` | `packages/agents/tables` | clean | 6 | 14 | 0 | 0 |
| 53 | `@beep/ontology-domain` | `packages/ontology/domain` | clean | 6 | 41 | 0 | 0 |
| 54 | `@beep/lexical-schema` | `packages/foundation/modeling/lexical` | needs-remediation | 7 | 126 | 4 | 62 |
| 55 | `@beep/langextract` | `packages/foundation/capability/langextract` | needs-remediation | 26 | 126 | 0 | 31 |
| 56 | `@beep/shared-tables` | `packages/shared/tables` | clean | 9 | 12 | 0 | 0 |
| 57 | `@beep/scratchpad` | `scratchpad` | needs-remediation | 469 | 4226 | 3 | 693 |
| 58 | `@beep/md` | `packages/foundation/modeling/md` | needs-remediation | 10 | 263 | 4 | 116 |
| 59 | `@beep/practice-kg-mcp` | `apps/practice-kg-mcp` | needs-remediation | 7 | 14 | 0 | 3 |
| 60 | `@beep/tailscale` | `packages/drivers/tailscale` | needs-remediation | 5 | 29 | 0 | 3 |
| 61 | `@beep/law-practice-use-cases` | `packages/law-practice/use-cases` | needs-remediation | 32 | 113 | 4 | 23 |
| 62 | `@beep/epistemic-ui` | `packages/epistemic/ui` | clean | 5 | 12 | 0 | 0 |
| 63 | `@beep/workspace-domain` | `packages/workspace/domain` | clean | 30 | 58 | 0 | 0 |
| 64 | `@beep/todox` | `apps/todox` | clean | 2 | 3 | 0 | 0 |
| 65 | `@beep/semantic-web` | `packages/foundation/capability/semantic-web` | needs-remediation | 8 | 56 | 0 | 15 |
| 66 | `@beep/utils` | `packages/foundation/modeling/utils` | needs-remediation | 28 | 214 | 6 | 118 |
| 67 | `@beep/repo-ai-metrics` | `packages/tooling/library/ai-metrics` | needs-remediation | 28 | 463 | 0 | 81 |
| 68 | `@beep/architecture-lab-tables` | `packages/architecture-lab/tables` | clean | 7 | 21 | 0 | 0 |
| 69 | `@beep/tika` | `packages/drivers/tika` | needs-remediation | 8 | 34 | 3 | 7 |
| 70 | `@beep/libpff` | `packages/drivers/libpff` | needs-remediation | 7 | 40 | 4 | 8 |
| 71 | `@beep/venice-ai` | `packages/drivers/venice-ai` | needs-remediation | 3 | 35 | 0 | 4 |
| 72 | `@beep/graph-3d` | `packages/drivers/graph-3d` | needs-remediation | 7 | 17 | 2 | 1 |
| 73 | `@beep/identity` | `packages/foundation/modeling/identity` | needs-remediation | 8 | 228 | 2 | 204 |
| 74 | `@beep/drizzle` | `packages/drivers/drizzle` | needs-remediation | 3 | 11 | 0 | 3 |
| 75 | `@beep/ontology-ui` | `packages/ontology/ui` | clean | 15 | 28 | 0 | 0 |
| 76 | `@beep/api-transport` | `packages/foundation/capability/api-transport` | needs-remediation | 4 | 11 | 2 | 7 |
| 77 | `@beep/box` | `packages/drivers/box` | needs-remediation | 7 | 859 | 0 | 15 |
| 78 | `@beep/openai-compat` | `packages/drivers/openai-compat` | needs-remediation | 4 | 54 | 0 | 9 |
| 79 | `@beep/shacl` | `packages/drivers/shacl` | clean | 3 | 6 | 0 | 0 |
| 80 | `@beep/documents-server` | `packages/documents/server` | needs-remediation | 28 | 103 | 2 | 8 |
| 81 | `@beep/nlp-processing` | `packages/foundation/capability/nlp-processing` | needs-remediation | 48 | 312 | 13 | 80 |
| 82 | `@beep/anthropic` | `packages/drivers/anthropic` | needs-remediation | 5 | 29 | 0 | 10 |
| 83 | `@beep/professional-desktop` | `apps/professional-desktop` | needs-remediation | 58 | 200 | 25 | 0 |
| 84 | `@beep/epistemic-domain` | `packages/epistemic/domain` | needs-remediation | 54 | 236 | 8 | 18 |
| 85 | `@beep/ontology-client` | `packages/ontology/client` | clean | 3 | 93 | 0 | 0 |
| 86 | `@beep/architecture-lab-use-cases` | `packages/architecture-lab/use-cases` | needs-remediation | 18 | 64 | 0 | 10 |
| 87 | `@beep/firecrawl` | `packages/drivers/firecrawl` | needs-remediation | 5 | 267 | 0 | 2 |
| 88 | `@beep/ecfr` | `packages/drivers/ecfr` | needs-remediation | 6 | 139 | 2 | 4 |
| 89 | `@beep/oxigraph` | `packages/drivers/oxigraph` | clean | 3 | 6 | 0 | 0 |
| 90 | `@beep/acp` | `packages/drivers/acp` | needs-remediation | 10 | 412 | 0 | 6 |
| 91 | `@beep/nlp` | `packages/foundation/modeling/nlp` | needs-remediation | 28 | 313 | 9 | 40 |
| 92 | `@beep/infra` | `infra` | needs-remediation | 10 | 101 | 3 | 23 |
| 93 | `@beep/runpod` | `packages/drivers/runpod` | needs-remediation | 7 | 180 | 0 | 1 |
| 94 | `@beep/fc-runs` | `packages/tooling/test-kit/fc-runs` | needs-remediation | 2 | 5 | 1 | 0 |
| 95 | `@beep/repo-utils` | `packages/tooling/library/repo-utils` | needs-remediation | 63 | 675 | 18 | 36 |
| 96 | `@beep/documents-domain` | `packages/documents/domain` | needs-remediation | 26 | 82 | 0 | 3 |
| 97 | `@beep/schema` | `packages/foundation/modeling/schema` | needs-remediation | 263 | 1605 | 26 | 170 |
| 98 | `@beep/epistemic-server` | `packages/epistemic/server` | needs-remediation | 23 | 51 | 8 | 18 |
| 99 | `@beep/box-provisioning` | `packages/drivers/box-provisioning` | needs-remediation | 11 | 110 | 0 | 10 |
| 100 | `@beep/rdf` | `packages/foundation/modeling/rdf` | needs-remediation | 29 | 266 | 1 | 8 |
| 101 | `@beep/onepassword-cli` | `packages/drivers/onepassword-cli` | needs-remediation | 4 | 16 | 0 | 2 |
| 102 | `@beep/architecture-lab-config` | `packages/architecture-lab/config` | needs-remediation | 9 | 21 | 0 | 3 |
| 103 | `@beep/govinfo` | `packages/drivers/govinfo` | needs-remediation | 32 | 86 | 2 | 3 |
| 104 | `@beep/data` | `packages/foundation/primitive/data` | needs-remediation | 12 | 162 | 10 | 16 |
| 105 | `@beep/xai` | `packages/drivers/xai` | needs-remediation | 7 | 70 | 0 | 6 |
| 106 | `@beep/architecture-lab-server` | `packages/architecture-lab/server` | needs-remediation | 13 | 34 | 0 | 17 |
| 107 | `@beep/duckdb` | `packages/drivers/duckdb` | needs-remediation | 6 | 28 | 0 | 4 |
| 108 | `@beep/ffmpeg` | `packages/drivers/ffmpeg` | needs-remediation | 5 | 111 | 0 | 2 |
| 109 | `@beep/obs` | `packages/drivers/obs` | needs-remediation | 6 | 73 | 3 | 2 |
| 110 | `@beep/agents-client` | `packages/agents/client` | needs-remediation | 6 | 39 | 2 | 9 |
| 111 | `@beep/uspto-mcp` | `packages/drivers/uspto-mcp` | needs-remediation | 7 | 30 | 7 | 6 |
| 112 | `@beep/architecture-lab-proof` | `apps/architecture-lab-proof` | clean | 1 | 2 | 0 | 0 |
| 113 | `@beep/epistemic-config` | `packages/epistemic/config` | needs-remediation | 7 | 21 | 3 | 7 |
| 114 | `@beep/epistemic-use-cases` | `packages/epistemic/use-cases` | needs-remediation | 28 | 126 | 9 | 20 |
| 115 | `@beep/m365` | `packages/drivers/m365` | needs-remediation | 6 | 74 | 2 | 5 |
| 116 | `@beep/observability` | `packages/foundation/capability/observability` | needs-remediation | 25 | 164 | 8 | 112 |
| 117 | `@beep/tsgo-shim` | `tools/tsgo-shim` | no-public-src-surface | 0 | 0 | 0 | 0 |
| 118 | `@beep/html` | `packages/foundation/modeling/html` | needs-remediation | 16 | 546 | 9 | 52 |
| 119 | `@beep/n3` | `packages/drivers/n3` | needs-remediation | 3 | 11 | 0 | 1 |
| 120 | `@beep/ui` | `packages/foundation/ui-system/ui` | needs-remediation | 134 | 554 | 1 | 7 |
| 121 | `@beep/pandoc-ast` | `packages/foundation/modeling/pandoc-ast` | needs-remediation | 7 | 203 | 0 | 18 |
| 122 | `@beep/repo-configs` | `packages/tooling/policy-pack/repo-configs` | needs-remediation | 25 | 139 | 0 | 14 |
| 123 | `@beep/openai` | `packages/drivers/openai` | needs-remediation | 4 | 17 | 0 | 5 |
| 124 | `@beep/documents-tables` | `packages/documents/tables` | clean | 15 | 40 | 0 | 0 |
| 125 | `@beep/wink` | `packages/drivers/wink` | needs-remediation | 14 | 73 | 1 | 34 |
| 126 | `@beep/postgres` | `packages/drivers/postgres` | needs-remediation | 7 | 43 | 0 | 3 |
| 127 | `@beep/brand` | `packages/foundation/ui-system/brand` | needs-remediation | 7 | 50 | 0 | 43 |
| 128 | `@beep/codegen-kit` | `packages/tooling/library/codegen-kit` | needs-remediation | 5 | 37 | 0 | 1 |
| 129 | `@beep/architecture-lab-domain` | `packages/architecture-lab/domain` | needs-remediation | 15 | 48 | 0 | 4 |
| 130 | `@beep/pretext` | `packages/drivers/pretext` | needs-remediation | 6 | 36 | 6 | 5 |
| 131 | `@beep/provenance` | `packages/foundation/modeling/provenance` | needs-remediation | 4 | 28 | 1 | 4 |
| 132 | `@beep/epistemic-tables` | `packages/epistemic/tables` | needs-remediation | 28 | 87 | 4 | 0 |
| 133 | `@beep/qa-capture` | `packages/tooling/library/qa-capture` | needs-remediation | 11 | 155 | 10 | 3 |
| 134 | `@beep/doc-text` | `packages/drivers/doc-text` | clean | 3 | 12 | 0 | 0 |
| 135 | `@beep/documents-use-cases` | `packages/documents/use-cases` | needs-remediation | 23 | 120 | 0 | 20 |
| 136 | `@beep/sanity` | `packages/drivers/sanity` | needs-remediation | 4 | 16 | 0 | 2 |

## Open Findings

### @beep/hubspot

Path: `packages/drivers/hubspot`

Export findings:
- `src/HubSpot.service.ts:348` `HubSpotShape` (type) - 1 example import violation(s)

### @beep/agents-domain

Path: `packages/agents/domain`

Export findings:
- `src/entities/Skill/Skill.model.ts:95` `SkillFrontmatter` (const) - 1 example import violation(s)

### @beep/ontology

Path: `packages/foundation/modeling/ontology`

Module findings:
- `src/Fold.assembly.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fold.markdown.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fold.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fold.projections.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Ontology.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Fold.assembly.ts:67` `BoundComposer` (type) - 2 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.assembly.ts:886` `fold` (const) - 3 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.markdown.ts:47` `MarkdownLinkMode` (const) - 1 example import violation(s)
- `src/Fold.markdown.ts:68` `MarkdownLinkMode` (type) - 1 example import violation(s)
- `src/Fold.markdown.ts:85` `MarkdownOptions` (class) - 1 example import violation(s)
- `src/Fold.markdown.ts:296` `toMarkdown` (const) - 3 example import violation(s)
- `src/Fold.models.ts:40` `AbsoluteIri` (type) - 1 example import violation(s)
- `src/Fold.models.ts:65` `SchemaHandle` (type) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:81` `Subject` (type) - 1 example import violation(s)
- `src/Fold.models.ts:97` `LiteralScalar` (type) - 1 example import violation(s)
- `src/Fold.models.ts:116` `TypedLiteral` (type) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:136` `TupleObject` (type) - 1 example import violation(s)
- `src/Fold.models.ts:155` `Triple` (type) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:171` `OntologyFoldInput` (type) - 1 example import violation(s)
- `src/Fold.models.ts:202` `isSchemaHandle` (const) - 1 example import violation(s)
- `src/Fold.models.ts:276` `TripleValue` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:296` `TripleValue` (type) - 1 example import violation(s)
- `src/Fold.models.ts:312` `SkosClassification` (const) - 1 example import violation(s)
- `src/Fold.models.ts:332` `SkosClassification` (type) - 1 example import violation(s)
- `src/Fold.models.ts:351` `AssembledPredicateKind` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:371` `AssembledPredicateKind` (type) - 1 example import violation(s)
- `src/Fold.models.ts:388` `FactLiteral` (class) - 1 example import violation(s)
- `src/Fold.models.ts:413` `FactObject` (const) - 1 example import violation(s)
- `src/Fold.models.ts:435` `FactObject` (type) - 2 example import violation(s)
- `src/Fold.models.ts:460` `AssembledFact` (class) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:493` `AssembledPredicate` (class) - 1 example import violation(s)
- `src/Fold.models.ts:528` `AssembledClass` (class) - 1 example import violation(s)
- `src/Fold.models.ts:556` `OntologyWarningCode` (const) - 1 example import violation(s)
- `src/Fold.models.ts:580` `OntologyWarningCode` (type) - 1 example import violation(s)
- `src/Fold.models.ts:603` `OntologyValidationWarning` (class) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Fold.models.ts:636` `AssembledOntology` (class) - 1 example import violation(s)
- `src/Fold.models.ts:664` `OntologyAssemblyErrorReason` (const) - 1 example import violation(s)
- `src/Fold.models.ts:693` `OntologyAssemblyErrorReason` (type) - 1 example import violation(s)
- `src/Fold.models.ts:718` `OntologyAssemblyError` (class) - 1 example import violation(s)
- `src/Fold.models.ts:750` `isFactLiteral` (const) - 1 example import violation(s)
- `src/Fold.projections.ts:45` `JsonLdTerm` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:69` `JsonLdContext` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:86` `JsonLdNodeValue` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:109` `JsonLdNode` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:130` `JsonLdDocument` (type) - 1 example import violation(s)
- `src/Fold.projections.ts:236` `toContext` (const) - 3 example import violation(s)
- `src/Fold.projections.ts:389` `toJsonLd` (const) - 3 example import violation(s)
- `src/Fold.projections.ts:632` `toTurtle` (const) - 3 example import violation(s)
- `src/SemanticFoundation.models.ts:189` `ConceptAlignment` (class) - 1 example import violation(s)
- `src/SemanticFoundation.models.ts:220` `TaxonomyConcept` (class) - 1 example import violation(s)
- `src/SemanticFoundation.models.ts:287` `FilingRoot` (class) - 1 example import violation(s)
- `src/TaxonomyLoader.ts:174` `VendorAlignmentManifestEntry` (class) - 1 example import violation(s)
- `src/TaxonomyLoader.ts:233` `VendorConceptSlice` (class) - 1 example import violation(s)
- `src/TaxonomyLoader.ts:429` `VendorSliceConceptMismatch` (class) - 1 example import violation(s)
- `src/TaxonomyLoader.ts:463` `VendorAlignmentTargetNotFound` (class) - 1 example import violation(s)
- `src/TaxonomyRegistry.ts:34` `LibrarianInput` (class) - 1 example import violation(s)
- `src/TaxonomyRegistry.ts:103` `TaxonomyConceptNotFound` (class) - 1 example import violation(s)
- `src/TaxonomyRegistry.ts:125` `UnsupportedDocumentClass` (class) - 1 example import violation(s)
- `src/TaxonomyRegistry.ts:156` `runLibrarianLoop` (const) - 2 example import violation(s)

### @beep/pacer

Path: `packages/drivers/pacer`

Module findings:
- `src/CsoAuth.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pacer.config.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pacer.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pacer.layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pacer.mock-data.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pacer.mock.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pacer.tokens.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PacerAuth.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pcl.api.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pcl.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PclClient.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Pacer.config.ts:103` `PacerConfigBase` (class) - 1 example import violation(s)
- `src/Pacer.config.ts:135` `PacerConfigQA` (class) - 1 example import violation(s)
- `src/Pacer.config.ts:161` `PacerConfigProd` (class) - 1 example import violation(s)
- `src/Pacer.config.ts:275` `loadPacerConfig` (const) - 1 example import violation(s)
- `src/Pacer.mock-data.ts:153` `defaultCasePages` (const) - 1 example import violation(s)
- `src/Pacer.mock-data.ts:174` `loopingCaseReportBody` (const) - 1 example import violation(s)
- `src/Pacer.mock-data.ts:193` `defaultPartyBody` (const) - 1 example import violation(s)
- `src/Pacer.mock-data.ts:211` `authSuccessBody` (const) - 1 example import violation(s)
- `src/Pacer.mock-data.ts:235` `authInvalidBody` (const) - 1 example import violation(s)
- `src/Pacer.mock-data.ts:259` `logoutBody` (const) - 1 example import violation(s)
- `src/Pacer.mock-data.ts:283` `logoutInvalidBody` (const) - 1 example import violation(s)
- `src/Pacer.mock-data.ts:361` `reportInfoBody` (const) - 1 example import violation(s)
- `src/Pacer.mock-data.ts:396` `downloadResultsBody` (const) - 1 example import violation(s)

### @beep/mcp-kit

Path: `packages/foundation/capability/mcp-kit`

Module findings:
- `src/ApiKeyRequired.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/FieldTier.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SanitizedSpan.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SourceAuth.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/TierGate.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ToolAnnotations.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ToolkitComposition.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/ApiKeyRequired.ts:68` `ApiKeyRequiredFailure` (class) - 1 example import violation(s)
- `src/ApiKeyRequired.ts:124` `apiKeyRequiredFailure` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/FieldTier.ts:47` `FieldTierName` (const) - 1 example import violation(s)
- `src/FieldTier.ts:68` `FieldTierName` (type) - 1 example import violation(s)
- `src/FieldTier.ts:93` `FieldTierSet` (interface) - 1 example import violation(s)
- `src/FieldTier.ts:127` `defineFieldTiers` (const) - 1 example import violation(s)
- `src/FieldTier.ts:154` `stripNulls` (const) - 1 example import violation(s)
- `src/FieldTier.ts:186` `projectFieldTier` (const) - 1 example import violation(s)
- `src/FieldTier.ts:221` `estimateJsonSize` (const) - 1 example import violation(s)
- `src/FieldTier.ts:248` `OversizedFieldProjection` (class) - 2 example import violation(s)
- `src/FieldTier.ts:286` `FetchableHandle` (class) - 2 example import violation(s)
- `src/FieldTier.ts:331` `FieldProjectionOutcome` (const) - 1 example import violation(s)
- `src/FieldTier.ts:368` `FieldProjectionOutcome` (type) - 2 example import violation(s)
- `src/FieldTier.ts:417` `projectWithinBudget` (const) - 2 example import violation(s)
- `src/FieldTier.ts:453` `ColumnarEnvelope` (class) - 1 example import violation(s)
- `src/FieldTier.ts:500` `toColumnarEnvelope` (const) - 1 example import violation(s)
- `src/McpCaller.ts:42` `McpCallerIdentity` (class) - 2 example import violation(s)
- `src/McpCaller.ts:71` `CurrentMcpCaller` (const) - 2 example import violation(s)
- `src/SanitizedSpan.ts:58` `defaultSanitizedSpanKeys` (const) - 1 example import violation(s)
- `src/SanitizedSpan.ts:83` `sanitizeTracerAttributes` (const) - 2 example import violation(s)
- `src/SanitizedSpan.ts:172` `withSanitizedToolSpan` (const) - 2 example import violation(s); 1 documentation section/link violation(s)
- `src/SanitizedSpan.ts:380` `sanitizedToolkit` (const) - 2 example import violation(s); 1 documentation section/link violation(s)
- `src/SourceAuth.ts:53` `SourceAuthGate` (const) - 1 example import violation(s)
- `src/SourceAuth.ts:75` `SourceAuthGate` (type) - 1 example import violation(s)
- `src/SourceAuth.ts:98` `SourceAuthRegistration` (class) - 1 example import violation(s)
- `src/SourceAuth.ts:147` `resolveSourceCredential` (const) - 2 example import violation(s)
- `src/SourceAuth.ts:176` `SourceAuthDecision` (type) - 2 example import violation(s)
- `src/SourceAuth.ts:197` `SourceAuthDecision` (const) - 1 example import violation(s)
- `src/SourceAuth.ts:226` `decideSourceAuthMount` (const) - 2 example import violation(s)
- `src/TierGate.ts:60` `TierGateSettlement` (const) - 1 example import violation(s)
- `src/TierGate.ts:82` `TierGateSettlement` (type) - 1 example import violation(s)
- `src/TierGate.ts:102` `TierGateOutcome` (const) - 1 example import violation(s)
- `src/TierGate.ts:125` `TierGateOutcome` (type) - 2 example import violation(s)
- `src/TierGate.ts:155` `TierGateAuditRecord` (class) - 1 example import violation(s)
- `src/TierGate.ts:215` `TierGateVerdict` (const) - 1 example import violation(s)
- `src/TierGate.ts:250` `TierGateVerdict` (type) - 1 example import violation(s)
- `src/TierGate.ts:275` `ToolCallRequest` (interface) - 1 example import violation(s)
- `src/TierGate.ts:325` `TierGateShape` (interface) - 3 example import violation(s)
- `src/TierGate.ts:371` `TierGate` (class) - 2 example import violation(s)
- `src/TierGate.ts:391` `TierGatePolicy` (class) - 1 example import violation(s)
- `src/TierGate.ts:461` `fromApprovedToolsPolicy` (const) - 2 example import violation(s)
- `src/TierGate.ts:513` `TierGateDispatchResult` (type) - 1 example import violation(s)
- `src/TierGate.ts:548` `TierGateDispatchResult` (const) - 1 example import violation(s)
- `src/TierGate.ts:597` `dispatchWithTierGate` (const) - 2 example import violation(s)
- `src/TierGate.ts:635` `withEnabledWhenApprovedTool` (const) - 1 example import violation(s)
- `src/ToolAnnotations.ts:42` `FourHintAnnotations` (class) - 1 example import violation(s)
- `src/ToolAnnotations.ts:101` `AnnotatedTool` (type) - 1 example import violation(s)
- `src/ToolAnnotations.ts:120` `annotateFourHints` (const) - 1 example import violation(s)
- `src/ToolAnnotations.ts:153` `readOnlyToolHints` (const) - 1 example import violation(s)
- `src/ToolAnnotations.ts:171` `destructiveWriteToolHints` (const) - 1 example import violation(s)
- `src/ToolkitComposition.ts:53` `GatedLayer` (interface) - 3 example import violation(s)
- `src/ToolkitComposition.ts:89` `gatedLayer` (const) - 2 example import violation(s)
- `src/ToolkitComposition.ts:134` `composeGatedLayers` (const) - 2 example import violation(s); 1 documentation section/link violation(s)

### @beep/law-practice-server

Path: `packages/law-practice/server`

Module findings:
- `src/Layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/CandorPromotionGate/CandorPromotionGate.layer.ts:45` `makeCandorPromotionGate` (const) - 1 example import violation(s)
- `src/CandorPromotionGate/CandorPromotionGate.ports.ts:136` `CandorPromotionSubjectResolver` (class) - 1 example import violation(s)
- `src/CandorRecord/CandorRecord.layer.ts:36` `CandorRecordRepositoryInMemory` (const) - 1 example import violation(s)
- `src/CandorRecord/CandorRecord.layer.ts:62` `CandorRecordRepositoryLive` (const) - 1 example import violation(s)
- `src/CandorRecord/CandorRecord.repo.ts:155` `makeInMemoryCandorRecordRepository` (const) - 1 example import violation(s)
- `src/CandorRecord/CandorRecord.repo.ts:236` `makeCandorRecordRepository` (const) - 1 example import violation(s)
- `src/LegalPositionRecord/LegalPositionRecord.layer.ts:37` `LegalPositionRecordRepositoryInMemory` (const) - 1 example import violation(s)
- `src/LegalPositionRecord/LegalPositionRecord.layer.ts:70` `LegalPositionRecordRepositoryLive` (const) - 1 example import violation(s)
- `src/LegalPositionRecord/LegalPositionRecord.repo.ts:180` `makeInMemoryLegalPositionRecordRepository` (const) - 1 example import violation(s)
- `src/LegalPositionRecord/LegalPositionRecord.repo.ts:261` `makeLegalPositionRecordRepository` (const) - 1 example import violation(s)
- `src/PracticeKg.claims.ts:189` `PracticeKgClaimsSummary` (class) - 1 example import violation(s)
- `src/PracticeKg.claims.ts:295` `runPracticeKgClaimsBatch` (const) - 1 example import violation(s)
- `src/PracticeKg.emails.ts:183` `readEmailRows` (const) - 1 example import violation(s)
- `src/PracticeKg.errors.ts:50` `PracticeKgProjectionError` (class) - 1 example import violation(s)
- `src/PracticeKg.fts.ts:272` `buildDuckDb` (const) - 1 example import violation(s)
- `src/PracticeKg.projections.ts:572` `buildPracticeKgBundleImpl` (const) - 1 example import violation(s)
- `src/PracticeKg.projections.ts:700` `PracticeKgProjections` (class) - 1 example import violation(s)
- `src/PracticeKg.projections.ts:737` `PracticeKgProjectionsLive` (const) - 1 example import violation(s)
- `src/PracticeKg.projections.ts:786` `buildPracticeKgBundle` (const) - 1 example import violation(s)
- `src/PracticeKg.rows.ts:181` `withDuckDb` (const) - 1 example import violation(s)
- `src/PracticeKg.rows.ts:226` `decodePracticeKgGraphRows` (const) - 1 example import violation(s)
- `src/PracticeKg.rows.ts:245` `decodePracticeKgFamilyRows` (const) - 1 example import violation(s)
- `src/PracticeKg.rows.ts:266` `decodePracticeKgDocumentRows` (const) - 1 example import violation(s)
- `src/PracticeKg.rows.ts:287` `decodePracticeKgEmailRows` (const) - 1 example import violation(s)
- `src/PracticeKg.rows.ts:306` `decodePracticeKgCandidateClaimRows` (const) - 1 example import violation(s)
- `src/PracticeKg.schemas.ts:269` `PracticeKgEmailHeaderRow` (class) - 1 example import violation(s)
- `src/PracticeKg.schemas.ts:380` `PracticeKgCounts` (class) - 1 example import violation(s)
- `src/PracticeKg.schemas.ts:429` `PracticeKgBundleManifest` (class) - 1 example import violation(s)
- `src/PracticeKg.schemas.ts:481` `PracticeKgSummary` (class) - 1 example import violation(s)
- `src/PracticeKg.schemas.ts:534` `encodePracticeKgBundleManifestJson` (const) - 2 example import violation(s)
- `src/PracticeKg.schemas.ts:563` `encodePracticeKgCountsJson` (const) - 2 example import violation(s)
- `src/PracticeKg.schemas.ts:592` `encodePracticeKgNodePayloadJson` (const) - 1 example import violation(s)
- `src/PracticeKg.schemas.ts:634` `encodePracticeKgSummaryJson` (const) - 2 example import violation(s)
- `src/PracticeKg.tool-handlers.ts:137` `PracticeKgToolkitHandlersLive` (const) - 1 example import violation(s)
- `src/Tools.ts:103` `PracticeKgToolkitLayer` (const) - 1 example import violation(s)
- `src/Tools.ts:128` `makePracticeKgServerLayer` (const) - 1 example import violation(s)

### @beep/db-admin

Path: `packages/_internal/db-admin`

Module findings:
- `src/migrate.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/migrate.ts:79` `migrateOnBoot` (const) - 1 example import violation(s)
- `src/targets.ts:90` `listDbAdminMigrationTargets` (const) - 1 example import violation(s)

### @beep/shared-domain

Path: `packages/shared/domain`

Module findings:
- `src/values/ClaimLifecycle/ClaimLifecycle.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/LocalDate/LocalDate.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/entities/Organization/Organization.behavior.ts:38` `isTenantRoot` (const) - 1 example import violation(s)
- `src/entities/Organization/Organization.behavior.ts:88` `hasValidTenantPlacement` (const) - 1 example import violation(s)
- `src/entities/Organization/Organization.values.ts:36` `LicenseTier` (const) - 1 example import violation(s)
- `src/entities/Organization/Organization.values.ts:88` `Settings` (class) - 1 example import violation(s)
- `src/entity/EntityId.ts:89` `EntityIdValue` (const) - 1 example import violation(s)
- `src/entity/EntityRef.ts:53` `EntityType` (const) - 1 example import violation(s)
- `src/entity/EntityRef.ts:108` `EntityRef` (class) - 1 example import violation(s)
- `src/entity/EntityRef.ts:184` `makeResult` (const) - 1 example import violation(s)
- `src/entity/EntityRef.ts:233` `make` (const) - 1 example import violation(s)
- `src/entity/Principal.ts:256` `PrincipalSchema` (interface) - 1 documentation section/link violation(s)
- `src/entity/SourceKind.ts:37` `SourceKindSchema` (interface) - 1 documentation section/link violation(s)
- `src/entity/primitives.ts:65` `Sha256` (const) - 2 example import violation(s)
- `src/entity/primitives.ts:104` `Ed25519Signature` (const) - 1 example import violation(s)
- `src/entity/primitives.ts:148` `EncryptionKeyId` (const) - 1 example import violation(s)
- `src/entity/primitives.ts:192` `HybridLogicalClock` (const) - 1 example import violation(s)
- `src/entity/primitives.ts:236` `VectorClock` (const) - 1 example import violation(s)
- `src/identity/Agents/AgentId.ts:53` `AgentId` (type) - 1 example import violation(s)
- `src/identity/Agents/ProviderInstanceId.ts:53` `ProviderInstanceId` (type) - 1 example import violation(s)
- `src/identity/Agents/SkillId.ts:53` `SkillId` (type) - 1 example import violation(s)
- `src/identity/Epistemic/ActivityId.ts:53` `ActivityId` (type) - 1 example import violation(s)
- `src/identity/Epistemic/CandidateClaimId.ts:53` `CandidateClaimId` (type) - 1 example import violation(s)
- `src/identity/Epistemic/ClaimDispositionId.ts:53` `ClaimDispositionId` (type) - 1 example import violation(s)
- `src/identity/Epistemic/EdgeVersionId.ts:53` `EdgeVersionId` (type) - 1 example import violation(s)
- `src/identity/Epistemic/EvidenceId.ts:53` `EvidenceId` (type) - 1 example import violation(s)
- `src/identity/Epistemic/UsageRecordId.ts:53` `UsageRecordId` (type) - 1 example import violation(s)
- `src/identity/Shared/ActivityId.ts:53` `ActivityId` (type) - 1 example import violation(s)
- `src/identity/Shared/AgentId.ts:53` `AgentId` (type) - 1 example import violation(s)
- `src/identity/Shared/AgentVersionId.ts:53` `AgentVersionId` (type) - 1 example import violation(s)
- `src/identity/Shared/ConnectorAccountId.ts:53` `ConnectorAccountId` (type) - 1 example import violation(s)
- `src/identity/Shared/LocalMachineId.ts:53` `LocalMachineId` (type) - 1 example import violation(s)
- `src/identity/Shared/MembershipId.ts:53` `MembershipId` (type) - 1 example import violation(s)
- `src/identity/Shared/OrganizationId.ts:53` `OrganizationId` (type) - 1 example import violation(s)
- `src/identity/Shared/ServiceAccountId.ts:53` `ServiceAccountId` (type) - 1 example import violation(s)
- `src/identity/Shared/TeamId.ts:53` `TeamId` (type) - 1 example import violation(s)
- `src/identity/Shared/UserId.ts:53` `UserId` (type) - 1 example import violation(s)
- `src/identity/Workspace/ApprovalGateId.ts:53` `ApprovalGateId` (type) - 1 example import violation(s)
- `src/identity/Workspace/CandidateDraftId.ts:53` `CandidateDraftId` (type) - 1 example import violation(s)
- `src/identity/Workspace/CandidateProjectId.ts:53` `CandidateProjectId` (type) - 1 example import violation(s)
- `src/identity/Workspace/CandidateTaskId.ts:53` `CandidateTaskId` (type) - 1 example import violation(s)
- `src/identity/Workspace/ContextPacketId.ts:53` `ContextPacketId` (type) - 1 example import violation(s)
- `src/identity/Workspace/EmailArtifactId.ts:53` `EmailArtifactId` (type) - 1 example import violation(s)
- `src/identity/Workspace/MessageId.ts:53` `MessageId` (type) - 1 example import violation(s)
- `src/identity/Workspace/ThreadId.ts:53` `ThreadId` (type) - 1 example import violation(s)
- `src/identity/Workspace/TurnId.ts:53` `TurnId` (type) - 1 example import violation(s)
- `src/identity/Workspace/WorkspaceId.ts:53` `WorkspaceId` (type) - 1 example import violation(s)
- `src/identity/index.ts:84` `isIdentityComposer` (const) - 1 example import violation(s)
- `src/identity/index.ts:119` `AnyIdentityComposer` (const) - 1 example import violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:100` `makeEffect` (const) - 1 example import violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:205` `fromString` (const) - 1 example import violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:272` `todayEffect` (const) - 1 example import violation(s)
- `src/values/LocalDate/LocalDate.behavior.ts:705` `LocalDateFromString` (const) - 1 example import violation(s)

### @beep/discord

Path: `packages/drivers/discord`

Export findings:
- `src/Discord.service.ts:273` `Discord` (class) - 1 example import violation(s)

### @beep/face-detection

Path: `packages/drivers/face-detection`

Export findings:
- `src/FaceDetection.models.ts:144` `RawFaceDetectionConfidence` (const) - 1 example import violation(s)
- `src/FaceDetection.models.ts:606` `decodeFaceDetectionModelConfig` (const) - 1 example import violation(s)
- `src/FaceDetection.models.ts:634` `decodeFaceDetectionImageRequest` (const) - 1 example import violation(s)
- `src/FaceDetection.service.ts:206` `LoadedFaceDetector` (interface) - 1 example import violation(s)
- `src/FaceDetection.service.ts:254` `FaceDetectionServiceShape` (interface) - 1 example import violation(s)
- `src/FaceDetection.service.ts:313` `FaceDetectionService` (class) - 1 example import violation(s)
- `src/FaceDetection.service.ts:886` `withDetector` (const) - 1 example import violation(s)

### @beep/gov-legal-mcp

Path: `packages/drivers/gov-legal-mcp`

Module findings:
- `src/Handlers.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Server.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SourceAuth.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ToolNames.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Tools.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Handlers.ts:88` `GovinfoToolkitHandlersLive` (const) - 1 example import violation(s)
- `src/Handlers.ts:110` `EcfrToolkitHandlersLive` (const) - 1 example import violation(s)
- `src/Server.ts:80` `makeServerLayer` (const) - 1 example import violation(s)

### @beep/ontology-use-cases

Path: `packages/ontology/use-cases`

Module findings:
- `src/aggregates/Session/worker.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/aggregates/Session/Session.ports.ts:329` `TurtleCodec` (class) - 1 example import violation(s)
- `src/aggregates/Session/Session.ports.ts:521` `OntologyFileStoreShape` (interface) - 1 example import violation(s)
- `src/aggregates/Session/Session.ports.ts:546` `OntologyFileStore` (class) - 1 example import violation(s)
- `src/aggregates/Session/Session.projections.ts:876` `buildOntologySnapshotWithInference` (const) - 1 example import violation(s)
- `src/aggregates/Session/Session.reasoner.ts:295` `OntologyInferenceResult` (class) - 1 example import violation(s)
- `src/aggregates/Session/Session.reasoner.ts:885` `inferredSessionGraphPartitions` (const) - 1 example import violation(s)
- `src/aggregates/Session/Session.reasoner.ts:917` `OntologyReasoner` (class) - 1 example import violation(s)
- `src/aggregates/Session/Session.service.ts:169` `SessionUseCases` (class) - 1 example import violation(s)
- `src/aggregates/Session/Session.sparql.ts:210` `RunOntologySparqlResult` (class) - 1 example import violation(s)
- `src/aggregates/Session/Session.sparql.ts:650` `OntologySparqlRunner` (class) - 1 example import violation(s)
- `src/aggregates/Session/Session.validation.ts:127` `OntologyRepairProposal` (class) - 1 example import violation(s)
- `src/aggregates/Session/Session.validation.ts:345` `OntologyValidationRunnerShape` (interface) - 1 example import violation(s)
- `src/aggregates/Session/Session.validation.ts:876` `OntologyValidationRunner` (class) - 1 example import violation(s)
- `src/aggregates/Session/Session.worker-protocol.ts:285` `encodeWorkerCommand` (const) - 1 documentation section/link violation(s)
- `src/aggregates/Session/Session.worker-protocol.ts:325` `encodeWorkerResult` (const) - 1 documentation section/link violation(s)
- `src/aggregates/Session/Session.worker-protocol.ts:365` `OntologyWorkerUndecodableCommand` (class) - 1 documentation section/link violation(s)
- `src/tools/OntologyToolService.ts:360` `OntologyToolService` (class) - 1 example import violation(s)

### @beep/architecture-lab-client

Path: `packages/architecture-lab/client`

Export findings:
- `src/aggregates/WorkItem/WorkItem.client.ts:80` `WorkItemClientTransport` (interface) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.client.ts:146` `WorkItemClientShape` (interface) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.client.ts:198` `WorkItemClient` (class) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.client.ts:259` `makeWorkItemClient` (const) - 1 example import violation(s)

### @beep/dock

Path: `packages/foundation/ui-system/dock`

Export findings:
- `src/AnchoredBox.ts:27` `TopLeft` (class) - 1 example import violation(s)
- `src/AnchoredBox.ts:48` `TopRight` (class) - 1 example import violation(s)
- `src/AnchoredBox.ts:69` `BottomLeft` (class) - 1 example import violation(s)
- `src/AnchoredBox.ts:90` `BottomRight` (class) - 1 example import violation(s)
- `src/AnchoredBox.ts:111` `AnchoredSize` (class) - 1 example import violation(s)
- `src/AnchoredBox.ts:131` `TopLeftAnchoredBox` (class) - 1 example import violation(s)
- `src/AnchoredBox.ts:155` `TopRightAnchoredBox` (class) - 1 example import violation(s)
- `src/AnchoredBox.ts:179` `BottomRightAnchoredBox` (class) - 1 example import violation(s)
- `src/AnchoredBox.ts:203` `BottomLeftAnchoredBox` (class) - 1 example import violation(s)
- `src/AnchoredBox.ts:233` `AnchoredBox` (const) - 1 example import violation(s)
- `src/AnchoredBox.ts:262` `AnchoredBox` (type) - 1 example import violation(s)
- `src/AnchoredBox.ts:284` `AnchoredBox` (namespace) - 1 example import violation(s)
- `src/Dock.atoms.ts:50` `DockAtomObservabilityLive` (const) - 2 example import violation(s)
- `src/Dock.atoms.ts:208` `makeDockAtomsWith` (const) - 2 example import violation(s)
- `src/Dock.atoms.ts:242` `makeDockAtoms` (const) - 2 example import violation(s)
- `src/Dock.commands.ts:33` `UserCommandOrigin` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:58` `ApiCommandOrigin` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:85` `CommandOrigin` (const) - 1 example import violation(s)
- `src/Dock.commands.ts:109` `CommandOrigin` (type) - 1 example import violation(s)
- `src/Dock.commands.ts:126` `OpenPanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:152` `ActivatePanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:178` `UpdatePanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:198` `MovePanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:224` `MoveGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:245` `UpdateGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:265` `ClosePanelCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:290` `ResizeSplitCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:316` `ClearWorkspaceCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:340` `MaximizeGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:360` `RestoreMaximizedCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:380` `FloatGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:399` `DockFloatingGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:418` `MoveFloatingGroupCommand` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:455` `DockCommand` (const) - 1 example import violation(s)
- `src/Dock.commands.ts:494` `DockCommand` (type) - 1 example import violation(s)
- `src/Dock.commands.ts:511` `DockCommandEnvelope` (class) - 1 example import violation(s)
- `src/Dock.commands.ts:537` `AllowedRenderers` (const) - 1 example import violation(s)
- `src/Dock.commands.ts:560` `AllowedRenderers` (type) - 1 example import violation(s)
- `src/Dock.commands.ts:577` `RestoreSnapshotRequest` (class) - 1 example import violation(s)
- `src/Dock.errors.ts:29` `DockRejectionReason` (const) - 1 example import violation(s)
- `src/Dock.errors.ts:64` `DockRejectionReason` (type) - 1 example import violation(s)
- `src/Dock.errors.ts:81` `DockCommandRejected` (class) - 1 example import violation(s)
- `src/Dock.errors.ts:108` `DockInvariantReason` (const) - 1 example import violation(s)
- `src/Dock.errors.ts:135` `DockInvariantReason` (type) - 1 example import violation(s)
- `src/Dock.errors.ts:152` `DockInvariantViolation` (class) - 1 example import violation(s)
- `src/Dock.errors.ts:178` `DockInputBoundary` (const) - 1 example import violation(s)
- `src/Dock.errors.ts:198` `DockInputBoundary` (type) - 1 example import violation(s)
- `src/Dock.errors.ts:215` `DockInputError` (class) - 1 example import violation(s)
- `src/Dock.errors.ts:241` `DockPersistenceOperation` (const) - 1 example import violation(s)
- `src/Dock.errors.ts:261` `DockPersistenceOperation` (type) - 1 example import violation(s)
- `src/Dock.errors.ts:278` `DockPersistenceError` (class) - 1 example import violation(s)
- `src/Dock.errors.ts:304` `DockSnapshotMissing` (class) - 1 example import violation(s)
- `src/Dock.errors.ts:329` `DockTransitionError` (const) - 1 example import violation(s)
- `src/Dock.errors.ts:351` `DockTransitionError` (type) - 1 example import violation(s)
- `src/Dock.events.ts:31` `PanelOpenedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:57` `PanelActivatedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:83` `PanelTitleChangedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:103` `PanelViewChangedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:123` `PanelRenderModeChangedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:144` `PanelTabComponentChangedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:173` `PanelConstraintsChangedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:202` `PanelMovedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:230` `PanelReorderedEvent` (class) - 2 example import violation(s)
- `src/Dock.events.ts:250` `GroupMergedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:272` `GroupMovedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:292` `GroupUpdatedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:312` `PanelClosedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:338` `SplitResizedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:364` `WorkspaceClearedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:389` `WorkspaceRestoredEvent` (class) - 2 example import violation(s)
- `src/Dock.events.ts:415` `GroupMaximizedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:435` `GroupRestoredEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:454` `GroupFloatedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:473` `GroupDockedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:492` `FloatingGroupMovedEvent` (class) - 1 example import violation(s)
- `src/Dock.events.ts:536` `DockEvent` (const) - 1 example import violation(s)
- `src/Dock.events.ts:582` `DockEvent` (type) - 1 example import violation(s)
- `src/Dock.ids.ts:29` `PanelId` (const) - 1 example import violation(s)
- `src/Dock.ids.ts:54` `PanelId` (type) - 1 example import violation(s)
- `src/Dock.ids.ts:71` `GroupId` (const) - 1 example import violation(s)
- `src/Dock.ids.ts:96` `GroupId` (type) - 1 example import violation(s)
- `src/Dock.ids.ts:113` `SplitId` (const) - 1 example import violation(s)
- `src/Dock.ids.ts:138` `SplitId` (type) - 1 example import violation(s)
- `src/Dock.ids.ts:155` `CommandId` (const) - 1 example import violation(s)
- `src/Dock.ids.ts:180` `CommandId` (type) - 1 example import violation(s)
- `src/Dock.ids.ts:197` `RendererKey` (const) - 1 example import violation(s)
- `src/Dock.ids.ts:222` `RendererKey` (type) - 1 example import violation(s)
- `src/Dock.ids.ts:240` `SplitRatio` (const) - 1 example import violation(s)
- `src/Dock.ids.ts:271` `SplitRatio` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:46` `PanelRenderMode` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:66` `PanelRenderMode` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:83` `PanelParameterValue` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:103` `PanelParameterValue` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:120` `PanelParameters` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:140` `PanelParameters` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:157` `ComponentPanelView` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:183` `TextPanelView` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:208` `PanelView` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:230` `PanelView` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:259` `PanelConstraints` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:286` `Panel` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:337` `PanelPatch` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:365` `GroupLockedMode` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:383` `GroupLockedMode` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:400` `GroupHeaderPosition` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:418` `GroupHeaderPosition` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:435` `GroupMetadata` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:465` `GroupPatch` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:502` `TabsNode` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:664` `HorizontalSplitLayout` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:693` `VerticalSplitLayout` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:724` `SplitLayout` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:791` `SplitLayout` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:810` `SplitNode` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:904` `DockNode` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1051` `DockNode` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1094` `DockNode` (namespace) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1164` `FloatingMember` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1184` `EmptyWorkspace` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1212` `PopulatedWorkspace` (class) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1293` `DockWorkspace` (const) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1513` `DockWorkspace` (type) - 1 example import violation(s)
- `src/Dock.models-tree.ts:1530` `DockSnapshot` (class) - 1 example import violation(s)
- `src/Dock.outcomes.ts:32` `DockUnchangedReason` (const) - 1 example import violation(s)
- `src/Dock.outcomes.ts:63` `DockUnchangedReason` (type) - 1 example import violation(s)
- `src/Dock.outcomes.ts:81` `DockChanged` (class) - 2 example import violation(s)
- `src/Dock.outcomes.ts:109` `DockUnchanged` (class) - 2 example import violation(s)
- `src/Dock.outcomes.ts:136` `DockMutationResult` (const) - 2 example import violation(s)
- `src/Dock.outcomes.ts:158` `DockMutationResult` (type) - 2 example import violation(s)
- `src/Dock.outcomes.ts:176` `DockMutationOutcome` (class) - 2 example import violation(s)
- `src/Dock.placement.ts:30` `RootPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:55` `TabPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:82` `DockSide` (const) - 1 example import violation(s)
- `src/Dock.placement.ts:102` `DockSide` (type) - 1 example import violation(s)
- `src/Dock.placement.ts:119` `SplitPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:153` `RootSplitPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:181` `GroupSplitPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:209` `GroupRootSplitPlacement` (class) - 1 example import violation(s)
- `src/Dock.placement.ts:238` `DockPlacement` (const) - 1 example import violation(s)
- `src/Dock.placement.ts:262` `DockPlacement` (type) - 1 example import violation(s)
- `src/Dock.placement.ts:279` `DockMoveTarget` (const) - 1 example import violation(s)
- `src/Dock.placement.ts:300` `DockMoveTarget` (type) - 1 example import violation(s)
- `src/Dock.placement.ts:317` `DockGroupMoveTarget` (const) - 1 example import violation(s)
- `src/Dock.placement.ts:338` `DockGroupMoveTarget` (type) - 1 example import violation(s)
- `src/Dock.protocol.ts:38` `DispatchDockCommand` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:63` `DispatchUnknownDockCommand` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:88` `SaveDockSnapshot` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:112` `RestoreDockSnapshot` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:137` `DockAtomOperationKind` (const) - 1 example import violation(s)
- `src/Dock.protocol.ts:162` `DockAtomOperationKind` (type) - 1 example import violation(s)
- `src/Dock.protocol.ts:179` `DockAtomOperation` (const) - 1 example import violation(s)
- `src/Dock.protocol.ts:208` `DockAtomOperation` (type) - 1 example import violation(s)
- `src/Dock.protocol.ts:226` `DockMutationCompleted` (class) - 2 example import violation(s)
- `src/Dock.protocol.ts:251` `DockSnapshotSaved` (class) - 1 example import violation(s)
- `src/Dock.protocol.ts:278` `DockAtomOperationOutcome` (const) - 1 example import violation(s)
- `src/Dock.protocol.ts:302` `DockAtomOperationOutcome` (type) - 1 example import violation(s)
- `src/Dock.protocol.ts:319` `DockAtomSessionError` (const) - 1 example import violation(s)
- `src/Dock.protocol.ts:346` `DockAtomSessionError` (type) - 1 example import violation(s)
- `src/Dock.protocol.ts:364` `DockAtomFeedSuccess` (class) - 2 example import violation(s)
- `src/Dock.protocol.ts:392` `DockAtomFeedFailure` (class) - 2 example import violation(s)
- `src/Dock.protocol.ts:420` `DockAtomFeedEntry` (const) - 2 example import violation(s)
- `src/Dock.protocol.ts:442` `DockAtomFeedEntry` (type) - 2 example import violation(s)
- `src/DockEngine.service.ts:87` `DockEngineShape` (interface) - 3 example import violation(s)
- `src/DockEngine.service.ts:129` `DockEngine` (class) - 2 example import violation(s)
- `src/DockEngine.service.ts:165` `DockEngineLive` (const) - 2 example import violation(s)
- `src/DockEngine.service.ts:188` `DockSnapshotStoreShape` (interface) - 2 example import violation(s)
- `src/DockEngine.service.ts:213` `DockSnapshotStore` (class) - 2 example import violation(s)
- `src/DockEngine.service.ts:239` `makeDockSnapshotStoreMemory` (const) - 3 example import violation(s)
- `src/DockEngine.service.ts:270` `requireSnapshot` (const) - 2 example import violation(s)
- `src/DockPolicy.ts:45` `DockCommandPolicy` (type) - 3 example import violation(s)
- `src/DockPolicy.ts:124` `lockedGroupsPolicy` (const) - 2 example import violation(s)
- `src/DockPolicy.ts:205` `makePolicyDockEngineLayer` (const) - 2 example import violation(s)
- `src/Geometry.models.ts:39` `Extent` (const) - 1 example import violation(s)
- `src/Geometry.models.ts:63` `DockBox` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:88` `GroupGeometry` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:108` `SashGeometry` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:128` `FloatingGeometry` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:148` `DockGeometry` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:186` `resolveAnchoredBox` (const) - 1 example import violation(s)
- `src/Geometry.models.ts:229` `GeometryOptions` (class) - 1 example import violation(s)
- `src/Geometry.models.ts:263` `GroupMinimumLookup` (type) - 2 example import violation(s)
- `src/Geometry.models.ts:280` `GroupMinimaRecord` (type) - 1 example import violation(s)
- `src/Minima.ts:63` `TabChrome` (class) - 1 example import violation(s)
- `src/Minima.ts:88` `titleWords` (const) - 1 example import violation(s)
- `src/Minima.ts:140` `titleMinima` (const) - 1 example import violation(s)
- `src/Minima.ts:199` `makeTitleMinimaAtom` (const) - 2 example import violation(s)
- `src/Recency.ts:40` `touchedGroupsInEvents` (const) - 1 example import violation(s)
- `src/Recency.ts:80` `touchedGroups` (const) - 2 example import violation(s)
- `src/Recency.ts:129` `makeMruGroupsAtom` (const) - 2 example import violation(s)

### @beep/repo-cli

Path: `packages/tooling/tool/cli`

Module findings:
- `src/commands/Ci/CiLane.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codegen/Codegen.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.capture.schemas.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.csv.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.normalize.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.packet.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.scan.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.schemas.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.triage.schemas.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Codex/Findings.write.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/CreatePackage/CreatePackage.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Docgen/Docgen.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Docs/Docs.aggregate.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Goals/Doctor.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Goals/Goals.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Goals/Inventory.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Goals/Migration.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Goals/PortfolioIndex.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Goals/SetStatus.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Knowledge/Knowledge.refs.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Laws/FrozenGrantSet.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Lint/IdentityRegistry.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Lint/PackageTestTypecheck.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Lint/ReflectionArtifact.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Lint/RoadmapRefs.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Control.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Doctor.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Extract.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Inventory.schemas.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgeCheck.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgeIngest.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgeLint.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgePack.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Qa.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Qa.render.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Qa.schemas.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Qa.session.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Record.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Qa/Report.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Worktree/Fleet.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Worktree/Fleet.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Worktree/Worktree.command.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Worktree/Worktree.schemas.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/commands/Worktree/Worktree.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 2 documentation section/link violation(s)

Export findings:
- `src/commands/AIMetrics/AIMetrics.command.ts:1206` `aiMetricsCommand` (const) - 1 example import violation(s)
- `src/commands/AIMetrics/AIMetrics.errors.ts:164` `runAiMetricsProgram` (const) - 1 example import violation(s)
- `src/commands/AgentEffectiveness/AgentEffectiveness.command.ts:666` `agentEffectivenessCommand` (const) - 1 example import violation(s)
- `src/commands/AgentEffectiveness/AgentEffectiveness.schemas.ts:286` `decodeTaskManifestJson` (const) - 1 example import violation(s)
- `src/commands/AgentEffectiveness/AgentEffectiveness.schemas.ts:312` `encodeAgentEffectivenessEvalScoreReportJson` (const) - 1 example import violation(s)
- `src/commands/Architecture/Architecture.plan.ts:246` `makeArchitectureOperationPlan` (const) - 1 example import violation(s)
- `src/commands/Architecture/Architecture.plan.ts:331` `makeArchitecturePackageOperationPlan` (const) - 1 example import violation(s)
- `src/commands/Architecture/Architecture.schemas.ts:953` `encodeCanonicalSliceOperationPlanJson` (const) - 1 example import violation(s)
- `src/commands/Architecture/Architecture.schemas.ts:983` `decodeCanonicalSliceOperationPlanJson` (const) - 1 example import violation(s)
- `src/commands/Architecture/OperationPlanExecution.ts:183` `checkCanonicalSliceOperationPlan` (const) - 1 example import violation(s)
- `src/commands/Architecture/OperationPlanExecution.ts:280` `applyCanonicalSliceOperationPlan` (const) - 1 example import violation(s)
- `src/commands/Architecture/OperationPlanPackageJson.ts:92` `renderPackageJsonOperation` (const) - 1 example import violation(s)
- `src/commands/Cache/Cache.command.ts:223` `runCacheWarm` (const) - 1 example import violation(s)
- `src/commands/Cache/Cache.command.ts:249` `runCacheWarmForTesting` (const) - 1 example import violation(s)
- `src/commands/Cache/Cache.command.ts:408` `buildCacheDashboard` (const) - 1 example import violation(s)
- `src/commands/Cache/Cache.command.ts:463` `runCacheRestorationProbe` (const) - 1 example import violation(s)
- `src/commands/Cache/Cache.schemas.ts:232` `CacheDashboardReportJson` (const) - 1 example import violation(s)
- `src/commands/Cache/Cache.schemas.ts:249` `CacheWarmReceiptJson` (const) - 1 example import violation(s)
- `src/commands/Ci/Ci.command.ts:269` `appendTurboSummary` (const) - 1 example import violation(s)
- `src/commands/Ci/CiLane.ts:361` `CI_LANE_DESCRIPTORS` (const) - 1 documentation section/link violation(s)
- `src/commands/Ci/CiLane.ts:1302` `ciLaneStepsForTesting` (const) - 1 documentation section/link violation(s)
- `src/commands/Ci/LaneTimings.ts:688` `decodeCiWorkflowJobsPage` (const) - 1 example import violation(s)
- `src/commands/Ci/LaneTimings.ts:781` `collectCiLaneTimings` (const) - 1 example import violation(s)
- `src/commands/Codex/Findings.capture.schemas.ts:576` `CodexFindingsCapturePayload` (class) - 1 example import violation(s)
- `src/commands/Codex/Findings.capture.schemas.ts:635` `decodeCodexFindingsCapturePayload` (const) - 1 example import violation(s)
- `src/commands/Codex/Findings.csv.ts:329` `decodeCodexFindingsCsv` (const) - 1 example import violation(s)
- `src/commands/Codex/Findings.normalize.ts:240` `priorIdsOfEntries` (const) - 1 example import violation(s)
- `src/commands/Codex/Findings.normalize.ts:296` `planPacket` (const) - 1 example import violation(s)
- `src/commands/Codex/Findings.refresh.ts:243` `validateCodexFindingsIngestModes` (const) - 1 example import violation(s)
- `src/commands/Codex/Findings.refresh.ts:314` `loadCodexRefreshLedgerSource` (const) - 1 example import violation(s)
- `src/commands/Codex/Findings.schemas.ts:411` `decodeCodexFindingsIngestOptions` (const) - 1 example import violation(s)
- `src/commands/Codex/Findings.triage.schemas.ts:494` `decodeCodexTriageLedger` (const) - 1 example import violation(s)
- `src/commands/Codex/Findings.write.ts:160` `assertPacketDocumentsClean` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.errors.ts:124` `PreservationCeilingExceededError` (class) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.errors.ts:187` `PreservationVerificationFailure` (class) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.errors.ts:219` `PreservationUnapprovedRowsError` (class) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.errors.ts:302` `CorpusArchiveMoveDigestMismatchError` (class) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.recyclebin.ts:101` `parseRecycleBinMetadata` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:247` `CorpusCommandService` (class) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:352` `archiveMoveCorpus` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:379` `catalogCorpus` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:412` `extractCorpus` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:439` `enrichCorpus` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:466` `organizeCorpus` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:496` `salvageCorpus` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:523` `verifySalvage` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:565` `preserveRestorationArchive` (const) - 2 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:593` `reconcileRestorationAcceptance` (const) - 1 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:631` `restoreMail` (const) - 2 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:669` `restoreLegacyWord` (const) - 2 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:703` `restoreRecycle` (const) - 2 example import violation(s)
- `src/commands/Corpus/Corpus.service.ts:731` `verifyRestorationArchive` (const) - 1 example import violation(s)
- `src/commands/CreatePackage/CreatePackage.command.ts:107` `resolveCreatePackageTemplateDir` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/commands/CreatePackage/CreatePackage.command.ts:1103` `createPackageCommand` (const) - 1 example import violation(s)
- `src/commands/DeletePackage/DeletePackage.command.ts:377` `rewritePendingChangesets` (const) - 1 example import violation(s)
- `src/commands/Docgen/Doctest.service.ts:46` `DoctestFenceAnalyzer` (class) - 1 example import violation(s)
- `src/commands/Docgen/Doctest.service.ts:80` `DoctestFenceRewriter` (class) - 1 example import violation(s)
- `src/commands/Explore/Atlas.ts:524` `buildExplorationProjection` (const) - 1 example import violation(s)
- `src/commands/Explore/Atlas.ts:644` `buildExplorationAtlasContent` (const) - 1 example import violation(s)
- `src/commands/Explore/Atlas.ts:676` `explorationProjectionDriftPaths` (const) - 1 example import violation(s)
- `src/commands/Explore/Atlas.ts:723` `writeExplorationAtlas` (const) - 1 example import violation(s)
- `src/commands/Explore/Check.ts:358` `runExploreCheck` (const) - 1 example import violation(s)
- `src/commands/Fallow/Fallow.command.ts:520` `fallowCommand` (const) - 1 example import violation(s)
- `src/commands/Files/Files.command.ts:896` `filesCommand` (const) - 1 example import violation(s)
- `src/commands/Files/Files.errors.ts:120` `failOnExtensionlessFile` (const) - 1 example import violation(s)
- `src/commands/Files/Files.plan.ts:195` `uniqueNormalizeTargetName` (const) - 1 example import violation(s)
- `src/commands/Files/Files.plan.ts:230` `uniqueArchiveTargetName` (const) - 1 example import violation(s)
- `src/commands/Files/Files.service.ts:2726` `flattenMediaFiles` (const) - 1 example import violation(s)
- `src/commands/Goals/Adopt.ts:163` `readPacketSnapshot` (const) - 1 example import violation(s)
- `src/commands/Goals/Bootstrap.ts:718` `renderMaterializationPlanJson` (const) - 1 example import violation(s)
- `src/commands/Goals/Doctor.ts:784` `runGoalsDoctor` (const) - 1 example import violation(s)
- `src/commands/Goals/Goals.schemas.ts:489` `decodeGoalManifest` (const) - 1 example import violation(s)
- `src/commands/Goals/Inventory.ts:187` `listGoalPackets` (const) - 1 example import violation(s)
- `src/commands/Goals/Inventory.ts:212` `listGoalPacketsStrict` (const) - 1 example import violation(s)
- `src/commands/Goals/Migration/PacketMutation.ts:99` `PacketForkRepairApplier` (class) - 1 example import violation(s)
- `src/commands/Goals/Migration/PacketMutation.ts:494` `isRecoverableGenesisSeed` (const) - 1 example import violation(s)
- `src/commands/Goals/Migration/PacketMutation.ts:612` `planPacketGenesisRecovery` (const) - 1 example import violation(s)
- `src/commands/Goals/Migration/PacketMutation.ts:666` `planPacketGenesisSeed` (const) - 1 example import violation(s)
- `src/commands/Goals/Migration/PacketMutation.ts:751` `quarantineOwnedGenesisEvents` (const) - 1 example import violation(s)
- `src/commands/Goals/PacketCore/PacketCore.schemas.ts:942` `decodePacketEvent` (const) - 1 example import violation(s)
- `src/commands/Goals/PacketCore/PacketCore.schemas.ts:1408` `decodePacketTraceProjection` (const) - 1 example import violation(s)
- `src/commands/Goals/PacketCore/PacketDigest.ts:227` `packetEventDigest` (const) - 1 example import violation(s)
- `src/commands/Goals/PacketCore/PacketDigest.ts:259` `renderPacketEventFile` (const) - 1 example import violation(s)
- `src/commands/Goals/PacketCore/PacketEventStore.ts:160` `PacketEventStore` (class) - 1 example import violation(s)
- `src/commands/Goals/PacketCore/PacketEventStore.ts:234` `foldUnambiguousStream` (const) - 1 example import violation(s)
- `src/commands/Goals/PacketCore/PacketFold.ts:474` `renderPacketTraceFile` (const) - 1 example import violation(s)
- `src/commands/Goals/PacketCore/PacketFold.ts:627` `planForkRepair` (const) - 1 example import violation(s)
- `src/commands/Goals/PacketCore/PacketTransitionWriter.ts:366` `PacketTransitionWriter` (class) - 1 example import violation(s)
- `src/commands/Goals/PortfolioIndex.ts:193` `buildPortfolioIndexContent` (const) - 1 example import violation(s)
- `src/commands/Goals/PortfolioIndex.ts:247` `writePortfolioIndex` (const) - 1 example import violation(s)
- `src/commands/Goals/SetStatus.ts:315` `loadGoalPacketManifest` (const) - 1 example import violation(s)
- `src/commands/Image/Image.command.ts:142` `imageCommand` (const) - 1 example import violation(s)
- `src/commands/Image/Image.schemas.ts:306` `decodeExtractFramesOptions` (const) - 1 example import violation(s)
- `src/commands/Image/Image.schemas.ts:327` `decodeExtractFramesDirOptions` (const) - 1 example import violation(s)
- `src/commands/Image/Image.service.ts:94` `ImageCommandService` (class) - 1 example import violation(s)
- `src/commands/Image/Image.service.ts:305` `ImageCommandServiceLive` (const) - 1 example import violation(s)
- `src/commands/Image/Image.service.ts:326` `extractFrames` (const) - 1 example import violation(s)
- `src/commands/Image/Image.service.ts:351` `extractFramesDir` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.command.ts:403` `applyKnowledgeRefsCheck` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.errors.ts:74` `KnowledgeOperationalError` (class) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.errors.ts:206` `KnowledgeIntroducedFindingsError` (class) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.errors.ts:247` `KnowledgeHostPathDebtError` (class) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.refs.ts:887` `KnowledgeRefObservation` (class) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.refs.ts:995` `encodeKnowledgeRefsReportJson` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.refs.ts:1022` `decodeKnowledgeRefsReportJson` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.refs.ts:1085` `knowledgeSha256Hex` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.refs.ts:1117` `makeKnowledgeRefId` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.refs.ts:2173` `decodeKnowledgeUtf8` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.refs.ts:2643` `scanKnowledgeRefsTree` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.schemas.ts:339` `KnowledgeFindingLocation` (class) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.schemas.ts:412` `KnowledgeFinding` (class) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.schemas.ts:469` `decodeKnowledgeFinding` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.schemas.ts:510` `encodeKnowledgeFinding` (const) - 2 example import violation(s)
- `src/commands/Knowledge/Knowledge.schemas.ts:578` `KnowledgeRename` (class) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.schemas.ts:904` `encodeKnowledgeSemanticDeltaReportJson` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.service.ts:271` `KnowledgeService` (class) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.service.ts:309` `makeKnowledgeFindingId` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.service.ts:875` `scanKnowledgePair` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.service.ts:1035` `guardKnowledgeCloneAttributes` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.service.ts:1523` `resolveKnowledgeProbePolicy` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.service.ts:1647` `makeKnowledgeTreeOracle` (const) - 1 example import violation(s)
- `src/commands/Knowledge/Knowledge.service.ts:1732` `KnowledgeServiceLive` (const) - 1 example import violation(s)
- `src/commands/Labs/Labs.command.ts:190` `labsListCommand` (const) - 1 example import violation(s)
- `src/commands/Labs/Labs.command.ts:218` `labsCommand` (const) - 1 example import violation(s)
- `src/commands/Laws/EffectFn.ts:393` `runEffectFnRules` (const) - 1 example import violation(s)
- `src/commands/Laws/FrozenGrantSet.ts:328` `runFrozenGrantSetRules` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/commands/Laws/NoNativeRuntime.ts:570` `runNoNativeRuntimeRules` (const) - 1 documentation section/link violation(s)
- `src/commands/Laws/SchemaDiagnostics.ts:64` `formatSchemaDiagnostics` (const) - 1 example import violation(s)
- `src/commands/Laws/SchemaDiagnostics.ts:95` `formatRedactedSchemaDiagnostics` (const) - 1 example import violation(s)
- `src/commands/Lint/EcosystemPolarity.ts:384` `runEcosystemPolarityCheck` (const) - 1 example import violation(s)
- `src/commands/Lint/Lint.schemas.ts:550` `encodeSchemaFirstInventoryDocument` (const) - 1 example import violation(s)
- `src/commands/Lint/PackageTestTypecheck.ts:769` `collectTestTypecheckBlindSpots` (const) - 1 example import violation(s)
- `src/commands/Lint/PackageTestTypecheck.ts:881` `runPackageTestTypecheckLint` (const) - 1 example import violation(s)
- `src/commands/Lint/ReflectionArtifact.ts:207` `reflectionFrontmatterIsValid` (const) - 1 example import violation(s)
- `src/commands/Lint/RoadmapRefs.ts:293` `runRoadmapRefsLint` (const) - 1 example import violation(s)
- `src/commands/Lint/SchemaCatalog.ts:620` `generateSchemaCatalogDocument` (const) - 1 example import violation(s)
- `src/commands/Lint/SchemaCatalog.ts:676` `renderSchemaCatalogDocument` (const) - 1 example import violation(s)
- `src/commands/Lint/SchemaCatalog.ts:701` `generateSchemaCatalogText` (const) - 1 example import violation(s)
- `src/commands/Lint/SchemaCatalog.ts:757` `runSchemaCatalog` (const) - 1 example import violation(s)
- `src/commands/Lint/SchemaCatalog.ts:796` `lintSchemaCatalogCommand` (const) - 1 example import violation(s)
- `src/commands/Lint/SchemaFirst.ts:130` `export { makeSchemaFirstOwnerResolver, makeSchemaFirstProject } from "./internal/SchemaFirstProject.ts";` (re-export) - 1 example import violation(s)
- `src/commands/Lint/SchemaFirst.ts:147` `export { runSchemaFirstLint } from "./internal/SchemaFirstScan.ts";` (re-export) - 1 example import violation(s)
- `src/commands/Lint/SchemaFirst.ts:380` `lintSchemaFirstCommand` (const) - 1 example import violation(s)
- `src/commands/Lint/SchemaTopology.ts:433` `collectSchemaTopologyViolations` (const) - 1 example import violation(s)
- `src/commands/Qa/CitedArtifactExistsGate.ts:235` `evaluateCitedArtifactExists` (const) - 1 example import violation(s)
- `src/commands/Qa/Control.ts:39` `requireLiveHandle` (const) - 1 example import violation(s)
- `src/commands/Qa/Control.ts:86` `stopLiveSession` (const) - 1 example import violation(s)
- `src/commands/Qa/Control.ts:115` `markLiveSession` (const) - 1 example import violation(s)
- `src/commands/Qa/Doctor.ts:292` `runQaDoctor` (const) - 1 example import violation(s)
- `src/commands/Qa/Extract.ts:142` `extractionPlanPath` (const) - 1 example import violation(s)
- `src/commands/Qa/Extract.ts:183` `artifactBudgetPath` (const) - 1 example import violation(s)
- `src/commands/Qa/Extract.ts:205` `writeArtifactBudget` (const) - 1 example import violation(s)
- `src/commands/Qa/Extract.ts:231` `readArtifactBudget` (const) - 1 example import violation(s)
- `src/commands/Qa/Extract.ts:259` `readExtractionPlan` (const) - 1 example import violation(s)
- `src/commands/Qa/Extract.ts:321` `resolveRoundLayout` (const) - 1 example import violation(s)
- `src/commands/Qa/Extract.ts:787` `runQaExtract` (const) - 1 example import violation(s)
- `src/commands/Qa/Inventory.schemas.ts:534` `decodeQaInventory` (const) - 1 example import violation(s)
- `src/commands/Qa/Inventory.schemas.ts:562` `encodeQaInventory` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeCheck.ts:360` `crossCheckAgainstRound` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeCheck.ts:395` `raiseCrossCheckFailure` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeCheck.ts:453` `requireInventoryRound` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeCheck.ts:512` `extractLastJsonBlock` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgeContract.ts:177` `evaluateCitedEventIdExists` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeContract.ts:313` `evaluateDeclaredRoundCoherent` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeContract.ts:707` `evaluateJudgeOutputInventoryDecodes` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeIngest.ts:101` `inventoryJsonPath` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeIngest.ts:121` `parseJudgeOutput` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeIngest.ts:165` `runQaJudgeIngest` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeLint.ts:53` `runQaJudgeLint` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgePack.ts:361` `readLegacyManifest` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgePack.ts:541` `renderTimeline` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgePack.ts:642` `selectJudgeEvidence` (const) - 1 documentation section/link violation(s)
- `src/commands/Qa/JudgePack.ts:837` `runQaJudgePack` (const) - 1 example import violation(s)
- `src/commands/Qa/JudgeSkill.ts:78` `runQaJudgeSkill` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.command.ts:66` `QaCommandLayers` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.command.ts:319` `qaCommand` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.schemas.ts:325` `decodeQaRecordOptions` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.schemas.ts:345` `decodeQaExtractOptions` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.schemas.ts:365` `decodeQaReportOptions` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.schemas.ts:385` `decodeQaMarkOptions` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.schemas.ts:405` `decodeQaJudgePackOptions` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.schemas.ts:425` `decodeQaJudgeIngestOptions` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.schemas.ts:445` `decodeQaJudgeLintOptions` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:61` `qaRootPath` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:193` `resolveAppHostTarget` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:313` `resolveCaptureTarget` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:377` `resolveRound` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:406` `resolveExistingRound` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:481` `readEventLog` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:561` `readCommitProvenance` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:605` `collectToolVersions` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:674` `recordHintPath` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:700` `readRecordStartHint` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:727` `writeRecordStartHint` (const) - 1 example import violation(s)
- `src/commands/Qa/Qa.session.ts:760` `discoverRecordedVideo` (const) - 1 example import violation(s)
- `src/commands/Qa/Record.ts:243` `requireCapturedEvents` (const) - 1 example import violation(s)
- `src/commands/Qa/Record.ts:469` `runQaRecord` (const) - 1 example import violation(s)
- `src/commands/Qa/Report.ts:40` `runQaReport` (const) - 1 example import violation(s)
- `src/commands/Quality/ChangesetGraph.ts:384` `changesetPackageReferencesFromText` (const) - 1 example import violation(s)
- `src/commands/Quality/FallowQuality.command.ts:1238` `collectAuditDiffInputForTesting` (const) - 1 example import violation(s)
- `src/commands/Quality/FallowQuality.command.ts:2376` `qualityFallowCommand` (const) - 1 example import violation(s)
- `src/commands/Quality/Quality.command.ts:731` `runBunAudit` (const) - 1 documentation section/link violation(s)
- `src/commands/Quality/Quality.command.ts:857` `devQualityStepsForTesting` (const) - 1 example import violation(s)
- `src/commands/Quality/Quality.osv-ignore.ts:105` `selectOsvIgnoreIdsForAudit` (const) - 1 example import violation(s)
- `src/commands/Quality/Quality.osv-ignore.ts:154` `activeOsvIgnoreIdsForTesting` (const) - 1 example import violation(s)
- `src/commands/Quality/Quality.render.ts:71` `printQualityProfileConfig` (const) - 1 example import violation(s)
- `src/commands/Quality/Quality.render.ts:113` `printQualityProfileDetection` (const) - 1 example import violation(s)
- `src/commands/Quality/Quality.schemas.ts:375` `decodePackageJsonDocument` (const) - 1 example import violation(s)
- `src/commands/Quality/Quality.schemas.ts:774` `decodeGithubChecksFallowFeatureMatrix` (const) - 1 example import violation(s)
- `src/commands/Research/Research.schemas.ts:242` `ResearchHistorySiftOptions` (class) - 1 example import violation(s)
- `src/commands/Research/Research.schemas.ts:275` `ResearchHistorySiftSummary` (class) - 1 example import violation(s)
- `src/commands/Research/Research.schemas.ts:342` `ResearchRepoCardSummary` (class) - 1 example import violation(s)
- `src/commands/Research/Research.schemas.ts:405` `ResearchNotionPullSummary` (class) - 1 example import violation(s)
- `src/commands/Research/Research.schemas.ts:437` `ResearchDailyOptions` (class) - 1 example import violation(s)
- `src/commands/Research/Research.schemas.ts:521` `ResearchCognifySummary` (class) - 1 example import violation(s)
- `src/commands/Research/Research.schemas.ts:577` `ResearchDigestSummary` (class) - 1 example import violation(s)
- `src/commands/Research/Research.schemas.ts:690` `ResearchSourceTypeCount` (class) - 1 example import violation(s)
- `src/commands/Research/Research.schemas.ts:722` `ResearchStatusSummary` (class) - 1 example import violation(s)
- `src/commands/Research/Research.service.ts:60` `ResearchCommandServiceRequirements` (type) - 1 example import violation(s)
- `src/commands/Research/Research.service.ts:161` `ResearchCommandService` (class) - 1 example import violation(s)
- `src/commands/Research/Research.service.ts:263` `captureResearchUrl` (const) - 1 example import violation(s)
- `src/commands/Research/Research.service.ts:290` `researchStatus` (const) - 1 example import violation(s)
- `src/commands/Research/Research.service.ts:317` `cognifyResearchCards` (const) - 1 example import violation(s)
- `src/commands/Research/Research.service.ts:351` `runResearchDaily` (const) - 2 example import violation(s)
- `src/commands/Research/Research.service.ts:378` `writeResearchDigest` (const) - 1 example import violation(s)
- `src/commands/Research/Research.service.ts:410` `siftResearchHistory` (const) - 2 example import violation(s)
- `src/commands/Research/Research.service.ts:442` `writeResearchRepoCards` (const) - 1 example import violation(s)
- `src/commands/Research/Research.service.ts:469` `pullResearchNotionLinks` (const) - 1 example import violation(s)
- `src/commands/Runners/Runners.command.ts:38` `resolveBakeMode` (const) - 1 example import violation(s)
- `src/commands/Runners/Runners.schemas.ts:119` `BakeConfig` (class) - 1 example import violation(s)
- `src/commands/Runners/Runners.schemas.ts:165` `BakeReport` (class) - 1 example import violation(s)
- `src/commands/Runners/Runners.schemas.ts:245` `BakePlan` (class) - 1 example import violation(s)
- `src/commands/Runners/Runners.schemas.ts:304` `BakeCheckReport` (class) - 1 example import violation(s)
- `src/commands/Runners/Runners.service.ts:154` `BakeLocalInputs` (class) - 1 example import violation(s)
- `src/commands/Runners/Runners.service.ts:203` `RunnersService` (class) - 1 example import violation(s)
- `src/commands/Skills/Skills.command.ts:908` `runSkillsUpdate` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.command.ts:1058` `skillsCommand` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:556` `SkillSnapshot` (class) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1174` `decodeSkillUpstream` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1207` `encodeSkillUpstream` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1234` `decodeSkillSnapshotFile` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1261` `encodeSkillSnapshotFile` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1291` `decodeSkillSnapshot` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1321` `encodeSkillSnapshot` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1348` `decodeSkillLicense` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1375` `encodeSkillLicense` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1404` `decodeSkillProvenance` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1433` `encodeSkillProvenance` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1462` `decodeSkillPatch` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1491` `encodeSkillPatch` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1518` `decodeSkillPatches` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1545` `encodeSkillPatches` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1573` `decodeSkillEffective` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1601` `encodeSkillEffective` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1622` `decodeSkillLockV2Entry` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1643` `encodeSkillLockV2Entry` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1664` `decodeSkillsLockV2` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1685` `encodeSkillsLockV2` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1715` `decodeSkillsLockV2Json` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.schemas.ts:1741` `encodeSkillsLockV2Json` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.service.ts:616` `SkillUpstreamContentSource` (class) - 1 example import violation(s)
- `src/commands/Skills/Skills.service.ts:655` `SkillUpstreamContentSourceLive` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.service.ts:708` `resolveSkillProvenance` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.service.ts:855` `SkillProvenanceService` (class) - 1 example import violation(s)
- `src/commands/Skills/Skills.service.ts:907` `SkillProvenanceServiceLayer` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.service.ts:934` `SkillProvenanceServiceLive` (const) - 1 example import violation(s)
- `src/commands/Skills/Skills.service.ts:972` `runSkillProvenance` (const) - 1 example import violation(s)
- `src/commands/SyncDataToTs/SyncDataToTs.command.ts:545` `syncDataToTsCommand` (const) - 1 example import violation(s)
- `src/commands/TsconfigSync/TsconfigSync.command.ts:49` `tsconfigSyncCommand` (const) - 1 example import violation(s)
- `src/commands/TsconfigSync/TsconfigSync.schemas.ts:266` `byStringAscending` (const) - 1 example import violation(s)
- `src/commands/TsconfigSync/TsconfigSync.service.ts:79` `syncTsconfigAtRoot` (const) - 1 example import violation(s)
- `src/commands/VersionSync/VersionSync.command.ts:50` `versionSyncCommand` (const) - 1 example import violation(s)
- `src/commands/Worktree/Fleet.service.ts:329` `parseProcStatStartTime` (const) - 1 example import violation(s)
- `src/commands/Worktree/Fleet.service.ts:435` `FleetMirrorService` (class) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.command.ts:334` `resolveWorktreeContext` (const) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.command.ts:390` `addWorktree` (const) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.command.ts:437` `copyLocalFiles` (const) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.command.ts:535` `worktreeDoctorReportForContext` (const) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.command.ts:790` `renderWorktreeRemovalReceipt` (const) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.command.ts:953` `worktreeCommand` (const) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.schemas.ts:211` `WorktreeResidueManifest` (class) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.schemas.ts:288` `WorktreeRemovalRequest` (class) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.service.ts:196` `worktreeArchivePlan` (const) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.service.ts:316` `WorktreeRemovalService` (class) - 1 example import violation(s)
- `src/commands/Worktree/Worktree.service.ts:370` `runWorktreeGitCapture` (const) - 1 example import violation(s)
- `src/commands/Yeet/Yeet.command.ts:674` `yeetCommand` (const) - 1 example import violation(s)

### @beep/pglite

Path: `packages/drivers/pglite`

Module findings:
- `src/Pglite.test-layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PgliteClient.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/ai-sync

Path: `packages/tooling/library/ai-sync`

Export findings:
- `src/drift.ts:54` `getGeneratedSourceMetadata` (const) - 1 example import violation(s)
- `src/drift.ts:89` `checkGeneratedArtifacts` (const) - 1 example import violation(s)
- `src/drift.ts:165` `checkSourceDriftWithFetcher` (const) - 1 example import violation(s)
- `src/drift.ts:216` `checkStrictDrift` (const) - 1 example import violation(s)
- `src/drift.ts:249` `assertNoStrictDrift` (const) - 1 example import violation(s)
- `src/generator.ts:371` `hashSourceText` (const) - 1 example import violation(s)
- `src/generator.ts:419` `fetchSourceText` (const) - 1 example import violation(s)
- `src/generator.ts:509` `generateAiSyncArtifacts` (const) - 1 example import violation(s)
- `src/index.ts:46` `export * from "./drift.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:137` `export * from "./validation.ts";` (re-export) - 1 example import violation(s)
- `src/schemas.ts:88` `NormalizedAgentInstructionDocument` (const) - 1 example import violation(s)
- `src/validation.ts:390` `validateRepoConfig` (const) - 1 example import violation(s)
- `src/validation.ts:433` `validateRepoSafetyPolicy` (const) - 1 example import violation(s)
- `src/validation.ts:474` `validateDogfoodConfig` (const) - 1 example import violation(s)
- `src/validation.ts:502` `validateDogfoodConfigs` (const) - 1 example import violation(s)
- `src/validation.ts:528` `defaultRepoRoot` (const) - 1 example import violation(s)
- `src/validation.ts:556` `validateCurrentCheckoutDogfood` (const) - 1 example import violation(s)
- `src/validation.ts:585` `validateCurrentCheckoutDogfoodConfigs` (const) - 1 example import violation(s)

### @beep/agents-server

Path: `packages/agents/server`

Module findings:
- `src/AssistantTurn/AnthropicTurnCodec.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/AssistantTurn/AnthropicTurnKernel.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/AssistantTurn/AnthropicTurnKernel.ts:282` `AnthropicTurnKernel` (const) - 1 example import violation(s)
- `src/AssistantTurn/BlockRepair.ts:218` `BlockRepairCall` (type) - 1 example import violation(s)
- `src/AssistantTurn/BlockRepair.ts:261` `RepairInvalidBlocks` (type) - 1 example import violation(s)
- `src/AssistantTurn/BlockRepair.ts:670` `makeRepairInvalidBlocks` (const) - 1 example import violation(s)
- `src/AssistantTurn/BlockRepair.ts:714` `repairInvalidBlocks` (const) - 1 example import violation(s)
- `src/AssistantTurn/index.ts:51` `export * from "./AnthropicTurnKernel.ts";` (re-export) - 1 example import violation(s)
- `src/AssistantTurn/index.ts:81` `export * from "./BlockRepair.ts";` (re-export) - 1 example import violation(s)

### @beep/workspace-use-cases

Path: `packages/workspace/use-cases`

Module findings:
- `src/aggregates/Thread/ThreadStore.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/aggregates/Thread/Thread.errors.ts:45` `ThreadStoreNotFound` (class) - 1 example import violation(s)
- `src/aggregates/Thread/Thread.errors.ts:81` `ThreadStoreConflict` (class) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadStore.ts:52` `CreateThreadInput` (class) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadStore.ts:95` `AppendTurnInput` (class) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadStore.ts:172` `SetThreadTitleIfEmptyInput` (class) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadStore.ts:257` `ThreadStore` (class) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadTimeline.ts:52` `TimelineMessageItem` (class) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadTimeline.ts:93` `TimelineToolCallItem` (class) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadTimeline.ts:129` `TimelineItem` (const) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadTimeline.ts:184` `TimelineTurn` (class) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadTimeline.ts:237` `ThreadTimeline` (class) - 1 example import violation(s)
- `src/aggregates/Workspace/WorkspaceVault.ts:235` `WorkspaceVaultStoreShape` (interface) - 1 example import violation(s)
- `src/aggregates/Workspace/WorkspaceVault.ts:274` `WorkspaceVaultStore` (class) - 1 example import violation(s)

### @beep/editor

Path: `packages/foundation/ui-system/editor`

Module findings:
- `src/chat/atoms.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/attachment-model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/attachments.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/chat-composer.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/code-fence.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/commands.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/config.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/send.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/toolbar.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/typeahead.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/code-block-node.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/mermaid-node.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/nodes.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/capability/catalog.ts:90` `editorCapabilityCatalog` (const) - 1 example import violation(s)
- `src/capability/projection.ts:39` `ShortcutHelpEntry` (class) - 1 example import violation(s)
- `src/capability/resolver.ts:489` `resolveEditorProfile` (const) - 1 example import violation(s)
- `src/capability/resolver.ts:547` `resolveEditorProfileEffect` (const) - 1 example import violation(s)
- `src/capability/schemas.ts:445` `KeyChordFromString` (const) - 1 example import violation(s)
- `src/capability/schemas.ts:928` `CapabilityCatalog` (const) - 1 example import violation(s)
- `src/chat/atoms.ts:408` `composerRuntime` (const) - 1 example import violation(s)
- `src/chat/atoms.ts:899` `onSendAtom` (const) - 1 example import violation(s)
- `src/chat/attachment-model.ts:527` `fileToAttachment` (const) - 1 example import violation(s)
- `src/chat/config.ts:235` `SlashItems` (const) - 1 example import violation(s)
- `src/chat/config.ts:332` `MentionOptions` (const) - 1 example import violation(s)
- `src/runtime.ts:61` `decodeEditorStateForRuntimeResult` (const) - 1 example import violation(s)
- `src/runtime.ts:98` `decodeEditorStateForRuntime` (const) - 1 example import violation(s)
- `src/viewer.tsx:245` `EditorViewer` (function) - 1 example import violation(s)

### @beep/nlp-mcp

Path: `packages/drivers/nlp-mcp`

Module findings:
- `src/Server.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Streaming/DatasetLoader.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Streaming/Jsonl.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Streaming/Pipeline.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Streaming/TextStream.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/StreamingHandlers.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/StreamingTools.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/bin.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Server.ts:107` `makeServerLayer` (const) - 1 example import violation(s)
- `src/Streaming/DatasetLoader.ts:648` `loadJsonl` (const) - 1 documentation section/link violation(s)
- `src/Streaming/TextStream.ts:136` `resolveLocalPath` (const) - 1 example import violation(s)
- `src/StreamingHandlers.ts:107` `StreamingToolkitHandlersLive` (const) - 1 example import violation(s)

### @beep/law-practice-domain

Path: `packages/law-practice/domain`

Module findings:
- `src/values/Citation/Citation.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/CitationBase/CitationBase.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/CitationType/CitationType.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/CitationWarning/CitationWarning.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/CourtInference/CourtInference.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/DurableLocator/DurableLocator.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/FullCitationType/FullCitationType.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ShortFormCitationType/ShortFormCitationType.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/entities/PatentCitationEvent/PatentCitationEvent.values.ts:190` `PatentCitationDiscovery` (const) - 1 example import violation(s)
- `src/values/AnnotationCitation/AnnotationCitation.model.ts:55` `AnnotationCitation` (class) - 1 example import violation(s)
- `src/values/CanonCitation/CanonCitation.model.ts:52` `CanonCitation` (class) - 1 example import violation(s)
- `src/values/CaseGroup/CaseGroup.model.ts:56` `CaseGroup` (class) - 1 example import violation(s)
- `src/values/Citation/Citation.models.ts:242` `FullCaseCitation` (class) - 1 example import violation(s)
- `src/values/Citation/Citation.models.ts:801` `IdCitation` (class) - 1 example import violation(s)
- `src/values/Citation/Citation.models.ts:1041` `SupraCitation` (class) - 1 example import violation(s)
- `src/values/Citation/Citation.models.ts:1228` `ShortFormCaseCitation` (class) - 1 example import violation(s)
- `src/values/CitationBase/CitationBase.model.ts:61` `CitationBase` (class) - 1 example import violation(s)
- `src/values/CitingApplicationIdentity/CitingApplicationIdentity.model.ts:237` `CitingApplicationIdentity` (const) - 1 example import violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:58` `CaseComponentSpan` (class) - 1 example import violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:142` `StatuteComponentSpan` (class) - 1 example import violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:220` `ConstitutionalComponentSpan` (class) - 1 example import violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:302` `JournalComponentSpan` (class) - 1 example import violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:381` `NeutralComponentSpan` (class) - 1 example import violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:454` `IdComponentSpan` (class) - 1 example import violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:523` `SupraComponentSpan` (class) - 1 example import violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:592` `ShortFormCaseComponentSpan` (class) - 1 example import violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:666` `PublicLawComponentSpan` (class) - 1 example import violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:742` `FederalRegisterComponentSpan` (class) - 1 example import violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:821` `StatutesAtLargeComponentSpan` (class) - 1 example import violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:900` `FederalRuleComponentSpan` (class) - 1 example import violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:977` `RestatementComponentSpan` (class) - 1 example import violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:1055` `TreatiseComponentSpan` (class) - 1 example import violation(s)
- `src/values/ComponentSpan/ComponentSpan.models.ts:1133` `AnnotationComponentSpan` (class) - 1 example import violation(s)
- `src/values/ConstitutionalCitation/ConstitutionalCitation.model.ts:53` `ConstitutionalCitation` (class) - 1 example import violation(s)
- `src/values/ContextOptions/ContextOptions.model.ts:52` `ContextOptions` (const) - 1 example import violation(s)
- `src/values/DocketCitation/DocketCitation.model.ts:54` `DocketCitation` (class) - 1 example import violation(s)
- `src/values/DurableLocator/DurableLocator.model.ts:112` `DurableLocator` (const) - 1 example import violation(s)
- `src/values/DurableLocatorOptions/DurableLocatorOptions.model.ts:60` `DurableLocatorOptions` (const) - 1 example import violation(s)
- `src/values/FederalRegisterCitation/FederalRegisterCitation.model.ts:54` `FederalRegisterCitation` (class) - 1 example import violation(s)
- `src/values/FederalRuleCitation/FederalRuleCitation.model.ts:54` `FederalRuleCitation` (class) - 1 example import violation(s)
- `src/values/Footnote/Footnote.model.ts:82` `Zone` (class) - 1 example import violation(s)
- `src/values/JournalCitation/JournalCitation.model.ts:54` `JournalCitation` (class) - 1 example import violation(s)
- `src/values/KindCode/KindCode.model.ts:37` `KindCode` (const) - 1 documentation section/link violation(s)
- `src/values/LegislativeMaterialCitation/LegislativeMaterialCitation.model.ts:54` `LegislativeMaterialCitation` (class) - 1 example import violation(s)
- `src/values/LocalOrdinanceCitation/LocalOrdinanceCitation.model.ts:52` `LocalOrdinanceCitation` (class) - 1 example import violation(s)
- `src/values/NeutralCitation/NeutralCitation.model.ts:56` `NeutralCitation` (class) - 1 example import violation(s)
- `src/values/OfficeCode/OfficeCode.model.ts:38` `OfficeCode` (const) - 1 documentation section/link violation(s)
- `src/values/PatentDocument/PatentDocument.model.ts:165` `PatentClaim` (const) - 1 example import violation(s)
- `src/values/PatentDocument/PatentDocument.model.ts:217` `PatentClaimDependencyIssue` (const) - 1 example import violation(s)
- `src/values/PatentDocument/PatentDocument.model.ts:334` `inspectPatentClaimDependencies` (const) - 1 example import violation(s)
- `src/values/PatentDocument/PatentDocument.model.ts:428` `PatentClaims` (const) - 1 example import violation(s)
- `src/values/PatentDocument/PatentDocument.model.ts:467` `PatentApplicationSection` (class) - 1 example import violation(s)
- `src/values/PatentDocument/PatentDocument.model.ts:572` `PatentApplicationSections` (const) - 1 example import violation(s)
- `src/values/PatentDocument/PatentDocument.model.ts:660` `PatentApplicationDocument` (class) - 1 example import violation(s)
- `src/values/PatentDocument/PatentDocument.normalizer.ts:494` `normalizePatentApplicationDocument` (const) - 2 example import violation(s)
- `src/values/PatentDocumentTriplet/PatentDocumentTriplet.model.ts:61` `PatentDocumentTriplet` (const) - 4 documentation section/link violation(s)
- `src/values/PatentNumber/PatentNumber.model.ts:38` `PatentNumber` (const) - 1 documentation section/link violation(s)
- `src/values/PinciteInfo/PinciteInfo.model.ts:156` `PinciteInfo` (class) - 1 example import violation(s)
- `src/values/PublicLawCitation/PublicLawCitation.model.ts:54` `PublicLawCitation` (class) - 1 example import violation(s)
- `src/values/RegulationCitation/RegulationCitation.model.ts:52` `RegulationCitation` (class) - 1 example import violation(s)
- `src/values/ResolutionResult/ResolutionResult.model.ts:46` `ResolutionResult` (class) - 1 example import violation(s)
- `src/values/RestatementCitation/RestatementCitation.model.ts:55` `RestatementCitation` (class) - 1 example import violation(s)
- `src/values/Segment/Segment.model.ts:40` `Segment` (class) - 1 example import violation(s)
- `src/values/SessionLawCitation/SessionLawCitation.model.ts:56` `SessionLawCitation` (class) - 1 example import violation(s)
- `src/values/Span/Span.model.ts:45` `Span` (class) - 1 example import violation(s)
- `src/values/Span/Span.model.ts:192` `TransformationMap` (class) - 1 example import violation(s)
- `src/values/StateRuleCitation/StateRuleCitation.model.ts:55` `StateRuleCitation` (class) - 1 example import violation(s)
- `src/values/StatuteCitation/StatuteCitation.model.ts:55` `StatuteCitation` (class) - 1 example import violation(s)
- `src/values/StatutesAtLargeCitation/StatutesAtLargeCitation.model.ts:52` `StatutesAtLargeCitation` (class) - 1 example import violation(s)
- `src/values/StructuredDate/StructuredDate.model.ts:43` `ParsedDate` (class) - 1 example import violation(s)
- `src/values/StructuredDate/StructuredDate.model.ts:131` `StructuredDate` (class) - 1 example import violation(s)
- `src/values/SubsequentHistoryEntry/SubsequentHistoryEntry.model.ts:50` `SubsequentHistoryEntry` (class) - 1 example import violation(s)
- `src/values/SurroundingContext/SurroundingContext.model.ts:41` `SurroundingContext` (class) - 1 example import violation(s)
- `src/values/TreatiseCitation/TreatiseCitation.model.ts:57` `TreatiseCitation` (class) - 1 example import violation(s)
- `src/values/TreatyCitation/TreatyCitation.model.ts:51` `TreatyCitation` (class) - 1 example import violation(s)

### @beep/repo-docgen

Path: `packages/tooling/tool/docgen`

Export findings:
- `src/CLI.ts:224` `cli` (const) - 1 example import violation(s)
- `src/Checker.ts:318` `checkModule` (function) - 1 example import violation(s)
- `src/Configuration.ts:305` `Configuration` (class) - 1 example import violation(s)
- `src/Configuration.ts:546` `load` (const) - 1 example import violation(s)
- `src/Configuration.ts:635` `configProviderLayer` (const) - 1 example import violation(s)
- `src/Core.ts:842` `program` (const) - 1 example import violation(s)
- `src/Domain.ts:1197` `Process` (class) - 1 example import violation(s)
- `src/Parser.ts:234` `parseInterfaces` (const) - 1 example import violation(s)
- `src/Parser.ts:356` `parseFunctions` (const) - 1 example import violation(s)
- `src/Parser.ts:407` `parseTypeAliases` (const) - 1 example import violation(s)
- `src/Parser.ts:452` `parseConstants` (const) - 1 example import violation(s)
- `src/Parser.ts:554` `parseExports` (const) - 1 example import violation(s)
- `src/Parser.ts:616` `parseNamespaces` (const) - 1 example import violation(s)
- `src/Parser.ts:802` `parseClasses` (const) - 1 example import violation(s)
- `src/Parser.ts:860` `parseModule` (const) - 1 example import violation(s)
- `src/Printer.ts:422` `print` (const) - 1 example import violation(s)
- `src/Printer.ts:522` `printModule` (const) - 1 example import violation(s)
- `src/ProofManifest.ts:155` `DocgenProofManifestFile` (class) - 1 example import violation(s)
- `src/ProofManifest.ts:190` `DocgenProofManifestFingerprint` (class) - 1 example import violation(s)
- `src/ProofManifest.ts:254` `DocgenProofManifest` (class) - 1 example import violation(s)
- `src/ProofManifest.ts:460` `writeDocgenProofManifest` (const) - 1 example import violation(s)
- `src/ProofManifest.ts:533` `verifyDocgenProofManifest` (const) - 1 example import violation(s)
- `src/Version.ts:44` `readModuleVersion` (const) - 1 example import violation(s)

### @beep/file-processing

Path: `packages/foundation/capability/file-processing`

Export findings:
- `src/Artifact/Artifact.constructors.ts:41` `deriveArtifactId` (const) - 1 example import violation(s)
- `src/Artifact/Artifact.schema.ts:269` `ArtifactLocator` (class) - 1 example import violation(s)
- `src/Artifact/Artifact.schema.ts:314` `SourceArtifact` (class) - 2 example import violation(s)
- `src/Artifact/Artifact.schema.ts:361` `ArtifactReference` (class) - 2 example import violation(s)
- `src/Extraction/Extraction.codec.ts:71` `encodeProcessRunManifestJson` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.codec.ts:108` `encodeFileProcessingCoverageSummaryJson` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.codec.ts:146` `encodeSourceProcessingRecordJson` (const) - 2 example import violation(s)
- `src/Extraction/Extraction.codec.ts:185` `encodeFileProcessingFailureRecordJson` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.codec.ts:222` `encodeChildArtifactRecordJson` (const) - 2 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:68` `SucceededSourceProcessingRecord` (class) - 2 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:125` `SkippedSourceProcessingRecord` (class) - 2 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:180` `FailedSourceProcessingRecord` (class) - 2 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:231` `SourceProcessingRecord` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:274` `SourceProcessingRecord` (type) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:294` `FileProcessingFailureReason` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:323` `FileProcessingFailureReason` (type) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:351` `SkippedFileProcessingFailureRecord` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:403` `FailedFileProcessingFailureRecord` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:447` `FileProcessingFailureRecord` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:489` `FileProcessingFailureRecord` (type) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:516` `ChildArtifactRecord` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:556` `FileProcessingCoverageSummary` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.manifest.ts:610` `ProcessRunManifest` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.schema.ts:89` `TextArtifactReference` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.schema.ts:115` `TextSpan` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.schema.ts:140` `TextSpan` (type) - 1 example import violation(s)
- `src/Extraction/Extraction.schema.ts:168` `ExtractionResult` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.schema.ts:209` `ArchiveExportResult` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.schema.ts:263` `ExtractedProcessFileResult` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.schema.ts:317` `ArchiveExportProcessFileResult` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.schema.ts:367` `SkippedProcessFileResult` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.schema.ts:414` `ProcessFileResult` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.schema.ts:454` `ProcessFileResult` (type) - 1 example import violation(s)
- `src/Operation/Operation.schema.ts:48` `DetectFileOperation` (class) - 1 example import violation(s)
- `src/Operation/Operation.schema.ts:83` `DetectionResult` (class) - 1 example import violation(s)
- `src/Operation/Operation.schema.ts:130` `ExtractFileOperation` (class) - 1 example import violation(s)
- `src/Operation/Operation.schema.ts:176` `ExportArchiveOperation` (class) - 1 example import violation(s)
- `src/Operation/Operation.schema.ts:223` `ProcessFileOperation` (class) - 1 example import violation(s)
- `src/PathSafety/PathSafety.policy.ts:112` `validateResolvedPath` (const) - 1 example import violation(s)
- `src/PathSafety/PathSafety.service.ts:50` `isResolvedPathWithinRoot` (const) - 1 example import violation(s)
- `src/PathSafety/PathSafety.service.ts:104` `resolvePathWithinRoot` (const) - 1 example import violation(s)
- `src/PathSafety/PathSafety.service.ts:226` `resolvePathWithinCanonicalRoot` (const) - 1 example import violation(s)
- `src/PathSafety/PathSafety.service.ts:346` `writeFileWithinCanonicalRootAtomically` (const) - 1 example import violation(s)
- `src/PathSafety/PathSafety.service.ts:400` `writeFileWithinRootAtomically` (const) - 1 example import violation(s)
- `src/Service/FileProcessing.layer.ts:108` `makeFileProcessingServiceLayer` (const) - 1 example import violation(s)
- `src/Service/FileProcessing.service.ts:102` `FileProcessingService` (class) - 1 example import violation(s)
- `src/Service/FileProcessing.service.ts:181` `detectFile` (const) - 2 example import violation(s)
- `src/Service/FileProcessing.service.ts:236` `extractFile` (const) - 2 example import violation(s)
- `src/Service/FileProcessing.service.ts:290` `exportArchive` (const) - 2 example import violation(s)
- `src/Service/FileProcessing.service.ts:345` `processFile` (const) - 2 example import violation(s)
- `src/SourceText/SourceText.paging.ts:107` `pageSourceText` (const) - 2 example import violation(s)
- `src/SourceText/SourceText.paging.ts:148` `pageSourceTextContainingOffset` (const) - 2 example import violation(s)
- `src/Strategy/Strategy.schema.ts:438` `SelectedStrategy` (const) - 1 example import violation(s)
- `src/Strategy/Strategy.schema.ts:476` `SelectedStrategy` (type) - 1 example import violation(s)
- `src/test.ts:77` `decodeTestOperationIdentifiers` (const) - 1 example import violation(s)

### @beep/ontology-config

Path: `packages/ontology/config`

Module findings:
- `src/McpConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/McpConfig.ts:47` `OntologyMcpMutationsEnabledConfig` (const) - 1 example import violation(s)
- `src/McpConfig.ts:117` `OntologyMcpConfig` (class) - 1 example import violation(s)
- `src/ServerConfig.ts:37` `OntologyWorkspaceRootConfig` (const) - 1 example import violation(s)
- `src/ServerConfig.ts:105` `OntologyConfig` (class) - 1 example import violation(s)
- `src/TestLayer.ts:53` `makeOntologyMcpConfigTest` (const) - 1 example import violation(s)
- `src/layer.ts:55` `OntologyConfigLive` (const) - 1 example import violation(s)
- `src/layer.ts:87` `OntologyMcpConfigLive` (const) - 1 example import violation(s)

### @beep/ai-provider-cli

Path: `packages/drivers/ai-provider-cli`

Module findings:
- `src/AiProviderCliHome.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/AiProviderCliHome.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/AiProviderCliHome.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/AiProviderCli.service.ts:66` `AiProviderCliRunner` (type) - 1 example import violation(s)
- `src/AiProviderCli.service.ts:312` `AiProviderCli` (class) - 1 example import violation(s)
- `src/AiProviderCliHome.service.ts:456` `AiProviderCliHome` (class) - 1 example import violation(s)
- `src/index.ts:89` `export * from "./AiProviderCli.service.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:151` `export * from "./AiProviderCliHome.service.ts";` (re-export) - 1 example import violation(s)

### @beep/dock-react

Path: `packages/foundation/ui-system/dock-react`

Export findings:
- `src/DockReact.types.ts:33` `DockAtomGraph` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:52` `DockPanelApi` (class) - 2 example import violation(s)
- `src/DockReact.types.ts:76` `DockPanelProps` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:97` `DockTabProps` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:114` `DockRenderer` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:131` `DockTabRenderer` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:148` `DockviewAdapterApi` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:184` `DockTitleMinimaOptions` (type) - 1 example import violation(s)
- `src/DockReact.types.ts:208` `DockviewReactProps` (type) - 1 example import violation(s)
- `src/DockviewReact.tsx:235` `DockviewReact` (const) - 3 example import violation(s)

### @beep/lint-rules

Path: `packages/tooling/policy-pack/lint-rules`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/ontology-server

Path: `packages/ontology/server`

Export findings:
- `src/aggregates/Session/Session.file-store.ts:227` `makeFileSystemOntologyFileStore` (const) - 1 example import violation(s)
- `src/aggregates/Session/Session.layer.ts:104` `OntologyFileStoreLayer` (const) - 1 example import violation(s)

### @beep/colors

Path: `packages/foundation/capability/colors`

Module findings:
- `src/Colors.ts:1` (packageDocumentation) - 2 example import violation(s)

Export findings:
- `src/Colors.ts:63` `ProcessLikeStdout` (class) - 1 example import violation(s)
- `src/Colors.ts:91` `ProcessLike` (class) - 1 example import violation(s)
- `src/Colors.ts:197` `Formatter` (const) - 1 example import violation(s)
- `src/Colors.ts:214` `Formatter` (type) - 1 example import violation(s)
- `src/Colors.ts:253` `supportsColor` (const) - 1 example import violation(s)
- `src/Colors.ts:269` `isColorSupported` (const) - 1 example import violation(s)
- `src/Colors.ts:293` `Colors` (class) - 1 example import violation(s)
- `src/Colors.ts:342` `createColors` (const) - 1 example import violation(s)
- `src/Colors.ts:410` `default` (const) - 1 example import violation(s)

### @beep/agents-use-cases

Path: `packages/agents/use-cases`

Module findings:
- `src/processes/AssistantTurn/AssistantTurn.fixture.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/processes/AssistantTurn/AssistantTurn.kernel.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/entities/ProviderInstance/ProviderInstance.repository.ts:88` `ProviderInstanceRepositoryShape` (interface) - 1 example import violation(s)
- `src/entities/ProviderInstance/ProviderInstance.repository.ts:117` `ProviderInstanceRepository` (class) - 1 example import violation(s)
- `src/entities/ProviderInstance/ProviderInstance.repository.ts:170` `ProviderProbeShape` (interface) - 1 example import violation(s)
- `src/entities/ProviderInstance/ProviderInstance.repository.ts:189` `ProviderProbe` (class) - 1 example import violation(s)
- `src/entities/ProviderInstance/ProviderInstance.service.ts:40` `makeProviderInstanceUseCases` (const) - 1 example import violation(s)
- `src/entities/ProviderInstance/ProviderInstance.use-cases.ts:39` `ProviderInstanceUseCasesShape` (interface) - 1 example import violation(s)
- `src/entities/ProviderInstance/ProviderInstance.use-cases.ts:69` `ProviderInstanceUseCases` (class) - 1 example import violation(s)
- `src/processes/AssistantTurn/AssistantTurn.contracts.ts:179` `ProviderUsageMetadata` (class) - 1 example import violation(s)
- `src/processes/AssistantTurn/AssistantTurn.fixture.ts:169` `FixtureTurnKernel` (const) - 1 example import violation(s)
- `src/processes/AssistantTurn/AssistantTurn.kernel.ts:42` `AgentTurnKernelShape` (interface) - 1 example import violation(s)
- `src/processes/AssistantTurn/AssistantTurn.kernel.ts:79` `AgentTurnKernel` (class) - 1 example import violation(s)
- `src/processes/AssistantTurn/index.ts:63` `export * from "./AssistantTurn.kernel.ts";` (re-export) - 1 example import violation(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.commands.ts:66` `ProposeCandidateOutputSet` (class) - 1 example import violation(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:387` `RuntimeDraftRecipient` (class) - 1 example import violation(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:436` `RuntimeCandidateDraft` (class) - 1 example import violation(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts:827` `CandidateOutputSet` (class) - 1 example import violation(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.fixture-service.ts:298` `makeInMemoryProfessionalRuntimeSdk` (const) - 1 example import violation(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.fixtures.ts:749` `runRuntimeFixture` (const) - 1 example import violation(s)
- `src/processes/ProfessionalRuntime/ProfessionalRuntime.service.ts:38` `ProfessionalRuntimeSdk` (interface) - 1 example import violation(s)
- `src/proof.ts:49` `export { makeInMemoryProfessionalRuntimeSdk } from "./processes/ProfessionalRuntime/ProfessionalRuntime.fixture-service.ts";` (re-export) - 1 example import violation(s)
- `src/proof.ts:89` `export {
  RuntimeFixtureInput,
  runRuntimeFixture,
} from "./processes/ProfessionalRuntime/ProfessionalRuntime.fixtures.ts";` (re-export) - 1 example import violation(s)
- `src/public.ts:169` `export type { ProfessionalRuntimeSdk } from "./processes/ProfessionalRuntime/ProfessionalRuntime.service.ts";` (re-export) - 1 example import violation(s)
- `src/test.ts:28` `export * from "./proof.ts";` (re-export) - 1 example import violation(s)

### @beep/skill-contract

Path: `packages/foundation/modeling/skill-contract`

Export findings:
- `src/EvidenceLadder.ts:34` `EvidenceReceiptReference` (class) - 1 example import violation(s)
- `src/EvidenceLadder.ts:59` `EvidenceLadderReceiptTypes` (class) - 1 example import violation(s)
- `src/EvidenceLadder.ts:85` `Accepted` (class) - 1 example import violation(s)
- `src/EvidenceLadder.ts:111` `Persisted` (class) - 1 example import violation(s)
- `src/EvidenceLadder.ts:138` `Delivered` (class) - 1 example import violation(s)
- `src/EvidenceLadder.ts:166` `SemanticallyApplied` (class) - 1 example import violation(s)
- `src/EvidenceLadder.ts:195` `EvidenceLadderState` (const) - 1 example import violation(s)
- `src/EvidenceLadder.ts:254` `evidenceLadderFor` (const) - 1 example import violation(s)
- `src/EvidenceLadder.ts:289` `transportCompleted` (const) - 1 example import violation(s)
- `src/EvidenceLadder.ts:309` `advanceToPersisted` (const) - 1 example import violation(s)
- `src/EvidenceLadder.ts:335` `advanceToDelivered` (const) - 1 example import violation(s)
- `src/EvidenceLadder.ts:361` `advanceToSemanticallyApplied` (const) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:43` `EvidenceDigest` (class) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:75` `EvidenceSubject` (class) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:132` `EvidenceReceipt` (const) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:158` `AttestationResource` (class) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:182` `GateSummaryVerifier` (class) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:206` `GateVerificationResult` (const) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:234` `GateVerifiedLevel` (const) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:282` `GateResultSummary` (class) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:359` `GateSummary` (class) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:380` `GateSummaryPredicateType` (const) - 1 example import violation(s)
- `src/EvidenceReceipt.ts:398` `GateSummaryReceipt` (const) - 1 example import violation(s)
- `src/Gate.ts:39` `GateId` (const) - 1 example import violation(s)
- `src/Gate.ts:78` `makeGateId` (const) - 1 example import violation(s)
- `src/Gate.ts:101` `GateSeverity` (const) - 1 example import violation(s)
- `src/Gate.ts:129` `GateApplicabilityKind` (const) - 1 example import violation(s)
- `src/Gate.ts:157` `AlwaysGateApplicability` (class) - 1 example import violation(s)
- `src/Gate.ts:188` `ConditionalGateApplicability` (class) - 1 example import violation(s)
- `src/Gate.ts:220` `GateApplicability` (const) - 1 example import violation(s)
- `src/Gate.ts:252` `EvidencePredicateType` (const) - 1 example import violation(s)
- `src/Gate.ts:284` `GateEvidenceRequirement` (class) - 1 example import violation(s)
- `src/Gate.ts:324` `GateDeclaration` (class) - 1 example import violation(s)
- `src/Gate.ts:377` `GateRegistry` (class) - 1 example import violation(s)
- `src/Gate.ts:398` `GateOutcome` (const) - 1 example import violation(s)
- `src/Gate.ts:463` `GateAuditRecord` (const) - 1 example import violation(s)
- `src/Gate.ts:530` `GateVerdict` (const) - 1 example import violation(s)
- `src/Recovery.ts:46` `BudgetDuration` (const) - 1 example import violation(s)
- `src/Recovery.ts:75` `RecoveryBudget` (class) - 1 example import violation(s)
- `src/Recovery.ts:101` `RecoveryBudgetConsumed` (class) - 1 example import violation(s)
- `src/Recovery.ts:126` `RecoveryAttemptOutcome` (const) - 1 example import violation(s)
- `src/Recovery.ts:154` `RecoveryAttemptReceipt` (class) - 1 example import violation(s)
- `src/Recovery.ts:183` `FailureTerminalReason` (const) - 1 example import violation(s)
- `src/Recovery.ts:295` `FailureReceiptPredicate` (class) - 1 example import violation(s)
- `src/Recovery.ts:316` `FailurePredicateType` (const) - 1 example import violation(s)
- `src/Recovery.ts:334` `FailureReceipt` (const) - 1 example import violation(s)
- `src/Recovery.ts:358` `NoRecoveryPolicy` (class) - 1 example import violation(s)
- `src/Recovery.ts:381` `BoundedRecoveryPolicy` (class) - 1 example import violation(s)
- `src/Recovery.ts:412` `RecoveryPolicy` (const) - 1 example import violation(s)
- `src/SchemaReference.ts:27` `SchemaReferenceId` (const) - 1 example import violation(s)
- `src/SchemaReference.ts:64` `SchemaReference` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:59` `SkillCompletionReceipt` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:115` `SkillCompletion` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:142` `toSkillCompletionReceipt` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:165` `EvaluateSkillCompletionInput` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:193` `CompletionInvariantReason` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:232` `CompletionInvariantError` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:258` `CompletionAllowed` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:284` `CompletionDenied` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:310` `CompletionEvaluation` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:393` `evaluateSkillCompletion` (const) - 1 example import violation(s)
- `src/SkillCompletion.ts:460` `LiveVerified` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:486` `DeployableBlocked` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:514` `FailedWithPartialEffects` (class) - 1 example import violation(s)
- `src/SkillCompletion.ts:541` `SkillTerminal` (const) - 1 example import violation(s)
- `src/SkillContract.ts:33` `SkillContractId` (const) - 1 example import violation(s)
- `src/SkillContract.ts:62` `ReceiptTypeBindings` (class) - 1 example import violation(s)
- `src/SkillContract.ts:94` `SkillContract` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:62` `SkillMarkdownProjection` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:86` `SkillArtifactDenialReason` (const) - 1 example import violation(s)
- `src/SkillProjection.ts:124` `SkillArtifactCheck` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:175` `SkillArtifactAllowed` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:201` `SkillArtifactDenied` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:228` `SkillArtifactVerdict` (const) - 1 example import violation(s)
- `src/SkillProjection.ts:259` `VerifySkillArtifactInput` (class) - 1 example import violation(s)
- `src/SkillProjection.ts:365` `projectSkillDocument` (const) - 1 example import violation(s)
- `src/SkillProjection.ts:397` `renderSkillMarkdown` (const) - 1 example import violation(s)
- `src/SkillProjection.ts:439` `decodeSkillFrontmatter` (const) - 2 example import violation(s)
- `src/SkillProjection.ts:548` `verifySkillArtifact` (const) - 1 example import violation(s)

### @beep/m365-mcp

Path: `packages/drivers/m365-mcp`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 example import violation(s)

Export findings:
- `src/M365Handlers.ts:103` `M365ToolkitHandlersLive` (const) - 1 example import violation(s)
- `src/Server.ts:68` `makeServerLayer` (const) - 1 example import violation(s)

### @beep/cosmos

Path: `packages/drivers/cosmos`

Export findings:
- `src/Cosmos.renderer.ts:688` `renderCosmosGraph` (const) - 1 example import violation(s)

### @beep/workspace-server

Path: `packages/workspace/server`

Export findings:
- `src/SourceText/WorkspaceSourceTextResolver.ts:335` `WorkspaceSourceTextResolverLayer` (const) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadStore.repo.ts:236` `makeInMemoryThreadStore` (const) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadStore.repo.ts:401` `makeDrizzleThreadStore` (const) - 1 example import violation(s)
- `src/aggregates/Thread/ThreadStore.repo.ts:624` `makeThreadStore` (const) - 1 example import violation(s)

### @beep/chalk

Path: `packages/foundation/capability/chalk`

Module findings:
- `src/Chalk.ts:1` (packageDocumentation) - 1 example import violation(s)

Export findings:
- `src/Chalk.ts:93` `ChalkInstance` (interface) - 1 example import violation(s)
- `src/Chalk.ts:127` `Chalk` (type) - 1 example import violation(s)
- `src/Chalk.ts:158` `Chalk` (const) - 1 example import violation(s)
- `src/Chalk.ts:181` `BackgroundColorName` (const) - 1 example import violation(s)
- `src/Chalk.ts:198` `BackgroundColorName` (type) - 1 example import violation(s)
- `src/Chalk.ts:221` `ChalkConstructorOptions` (const) - 1 example import violation(s)
- `src/Chalk.ts:243` `ChalkConstructorOptions` (type) - 1 example import violation(s)
- `src/Chalk.ts:266` `ChalkOptions` (const) - 1 example import violation(s)
- `src/Chalk.ts:283` `ChalkOptions` (type) - 1 example import violation(s)
- `src/Chalk.ts:306` `ColorInfo` (const) - 1 example import violation(s)
- `src/Chalk.ts:323` `ColorInfo` (type) - 1 example import violation(s)
- `src/Chalk.ts:346` `ColorName` (const) - 1 example import violation(s)
- `src/Chalk.ts:363` `ColorName` (type) - 1 example import violation(s)
- `src/Chalk.ts:391` `ColorSupport` (const) - 1 example import violation(s)
- `src/Chalk.ts:408` `ColorSupport` (type) - 1 example import violation(s)
- `src/Chalk.ts:430` `ColorSupportLevel` (const) - 1 example import violation(s)
- `src/Chalk.ts:447` `ColorSupportLevel` (type) - 1 example import violation(s)
- `src/Chalk.ts:470` `ColorSupportLevelInput` (const) - 1 example import violation(s)
- `src/Chalk.ts:487` `ColorSupportLevelInput` (type) - 1 example import violation(s)
- `src/Chalk.ts:510` `ForegroundColorName` (const) - 1 example import violation(s)
- `src/Chalk.ts:527` `ForegroundColorName` (type) - 1 example import violation(s)
- `src/Chalk.ts:550` `ModifierName` (const) - 1 example import violation(s)
- `src/Chalk.ts:567` `ModifierName` (type) - 1 example import violation(s)
- `src/Chalk.ts:584` `modifierNames` (const) - 1 example import violation(s)
- `src/Chalk.ts:601` `foregroundColorNames` (const) - 1 example import violation(s)
- `src/Chalk.ts:618` `backgroundColorNames` (const) - 1 example import violation(s)
- `src/Chalk.ts:635` `colorNames` (const) - 1 example import violation(s)
- `src/Chalk.ts:652` `modifiers` (const) - 1 example import violation(s)
- `src/Chalk.ts:669` `foregroundColors` (const) - 1 example import violation(s)
- `src/Chalk.ts:686` `backgroundColors` (const) - 1 example import violation(s)
- `src/Chalk.ts:703` `colors` (const) - 1 example import violation(s)
- `src/Chalk.ts:725` `supportsColor` (const) - 1 example import violation(s)
- `src/Chalk.ts:747` `supportsColorStderr` (const) - 1 example import violation(s)
- `src/Chalk.ts:774` `chalkStderr` (const) - 1 example import violation(s)
- `src/Chalk.ts:806` `default` (const) - 1 example import violation(s)

### @beep/epistemic-client

Path: `packages/epistemic/client`

Export findings:
- `src/Protocol.ts:99` `HttpEpistemicProtocolLive` (const) - 1 example import violation(s)

### @beep/uspto

Path: `packages/drivers/uspto`

Export findings:
- `src/Uspto.config.ts:70` `UsptoConfigInput` (class) - 1 example import violation(s)
- `src/Uspto.errors.ts:155` `makeUsptoError` (const) - 1 example import violation(s)
- `src/Uspto.service.ts:52` `UsptoShape` (interface) - 1 example import violation(s)

### @beep/phoenix

Path: `packages/drivers/phoenix`

Export findings:
- `src/Phoenix.config.ts:75` `PhoenixConfigInput` (class) - 1 example import violation(s)
- `src/Phoenix.service.ts:666` `Phoenix` (class) - 1 example import violation(s)

### @beep/shared-use-cases

Path: `packages/shared/use-cases`

Export findings:
- `src/PromotionGate/PromotionGate.service.ts:62` `PromotionGate` (class) - 1 example import violation(s)

### @beep/openclaw

Path: `packages/drivers/openclaw`

Module findings:
- `src/Openclaw.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/OpenclawCli.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/OpenclawProbe.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/OpenclawRender.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/OpenclawSystemd.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Openclaw.models.ts:122` `OpenclawDiagnosticText` (const) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:175` `OpenclawProcessRequest` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:341` `OpenclawConfigInvalid` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:414` `OpenclawDoctorReport` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:449` `OpenclawSecretsReloadOutput` (class) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:478` `OpenclawSecretsReloaded` (class) - 1 example import violation(s)
- `src/Openclaw.models.ts:514` `OpenclawSecretsReloadDegraded` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:549` `OpenclawSecretsReload` (const) - 1 example import violation(s)
- `src/Openclaw.models.ts:575` `OpenclawSecretsReload` (type) - 1 example import violation(s)
- `src/Openclaw.models.ts:634` `OpenclawGatewayHealth` (class) - 1 example import violation(s)
- `src/Openclaw.models.ts:1034` `OpenclawLiveAcceptanceInput` (class) - 1 example import violation(s)
- `src/Openclaw.models.ts:1178` `OpenclawInvocationContext` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1266` `OpenclawSystemdUnitState` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1353` `OpenclawHttpProbe` (class) - 1 documentation section/link violation(s)
- `src/Openclaw.models.ts:1424` `OpenclawSchemaPlaceholderFinding` (class) - 1 documentation section/link violation(s)
- `src/OpenclawCli.service.ts:404` `OpenclawCliRunner` (type) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/OpenclawCli.service.ts:748` `OpenclawCli` (class) - 1 example import violation(s)
- `src/OpenclawIntent.models.ts:52` `OpenclawSecretReference` (const) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:100` `OpenclawTargetVersion` (const) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:1056` `OpenclawSkillPin` (class) - 1 documentation section/link violation(s)
- `src/OpenclawIntent.models.ts:1156` `OpenclawDeploymentIntent` (class) - 1 documentation section/link violation(s)
- `src/OpenclawSystemd.service.ts:224` `OpenclawSystemd` (class) - 1 example import violation(s)

### @beep/law-practice-tables

Path: `packages/law-practice/tables`

Module findings:
- `src/Tables.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/entities/ActFrame/ActFrame.converters.ts:80` `toActFrameInsert` (const) - 1 example import violation(s)
- `src/entities/ActFrame/ActFrame.converters.ts:114` `fromActFrameRow` (const) - 1 example import violation(s)
- `src/entities/CandorDisposition/CandorDisposition.converters.ts:79` `toCandorDispositionInsert` (const) - 1 example import violation(s)
- `src/entities/CandorDisposition/CandorDisposition.converters.ts:108` `fromCandorDispositionRow` (const) - 1 example import violation(s)
- `src/entities/CorrectionDelta/CorrectionDelta.converters.ts:79` `toCorrectionDeltaInsert` (const) - 1 example import violation(s)
- `src/entities/CorrectionDelta/CorrectionDelta.converters.ts:112` `fromCorrectionDeltaRow` (const) - 1 example import violation(s)
- `src/entities/IdsSubmissionFact/IdsSubmissionFact.converters.ts:79` `toIdsSubmissionFactInsert` (const) - 1 example import violation(s)
- `src/entities/IdsSubmissionFact/IdsSubmissionFact.converters.ts:108` `fromIdsSubmissionFactRow` (const) - 1 example import violation(s)
- `src/entities/LegalOppositionCandidate/LegalOppositionCandidate.converters.ts:80` `toLegalOppositionCandidateInsert` (const) - 1 example import violation(s)
- `src/entities/LegalOppositionCandidate/LegalOppositionCandidate.converters.ts:116` `fromLegalOppositionCandidateRow` (const) - 1 example import violation(s)
- `src/entities/LegalPositionRelator/LegalPositionRelator.converters.ts:80` `toLegalPositionRelatorInsert` (const) - 1 example import violation(s)
- `src/entities/LegalPositionRelator/LegalPositionRelator.converters.ts:116` `fromLegalPositionRelatorRow` (const) - 1 example import violation(s)
- `src/entities/PatentCitationEvent/PatentCitationEvent.converters.ts:74` `toPatentCitationEventInsert` (const) - 1 example import violation(s)
- `src/entities/PatentCitationEvent/PatentCitationEvent.converters.ts:103` `fromPatentCitationEventRow` (const) - 1 example import violation(s)
- `src/entities/PowerExercise/PowerExercise.converters.ts:80` `toPowerExerciseInsert` (const) - 1 example import violation(s)
- `src/entities/PowerExercise/PowerExercise.converters.ts:114` `fromPowerExerciseRow` (const) - 1 example import violation(s)

### @beep/test-utils

Path: `packages/tooling/test-kit/test-utils`

Module findings:
- `src/FastCheckRuns.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Layer.ts:34` `provideScopedLayer` (const) - 1 example import violation(s)
- `src/Schema.ts:37` `assertSchemaArbitraryDecodesToSelf` (const) - 1 example import violation(s)
- `src/SqlTest.ts:1022` `makePgliteTestcontainerResource` (const) - 1 example import violation(s)

### @beep/types

Path: `packages/foundation/primitive/types`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 example import violation(s)

Export findings:
- `src/TArray.types.ts:30` `Elem` (type) - 1 example import violation(s)
- `src/TString.types.ts:33` `NonEmpty` (type) - 1 example import violation(s)
- `src/TString.types.ts:67` `NonEmptyTrimmed` (type) - 1 example import violation(s)
- `src/TString.types.ts:89` `Chars` (type) - 1 example import violation(s)
- `src/TString.types.ts:132` `DotPropertyName` (type) - 1 example import violation(s)
- `src/TUnsafe.types.ts:29` `Any` (type) - 1 example import violation(s)
- `src/TUtils.types.ts:28` `UnionToIntersection` (type) - 1 example import violation(s)
- `src/TUtils.types.ts:54` `Simplify` (type) - 1 example import violation(s)
- `src/index.ts:43` `export type * as TArray from "./TArray.types.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:61` `export type * as TString from "./TString.types.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:77` `export type * as TUnsafe from "./TUnsafe.types.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:95` `export type * as TUtils from "./TUtils.types.ts";` (re-export) - 1 example import violation(s)

### @beep/oip-web

Path: `apps/oip-web`

Export findings:
- `src/app/api/contact/ContactHttpApiRoute.ts:74` `makeOipContactHttpApiWebHandlerWithSubmit` (const) - 1 example import violation(s)
- `src/app/api/contact/ContactRouteResponse.ts:106` `contactRequestResponseWithSubmit` (const) - 1 example import violation(s)
- `src/app/api/contact/ContactRouteResponse.ts:150` `contactRequestResponse` (const) - 1 example import violation(s)
- `src/contact/ContactSubmission.http.ts:101` `ContactSubmissionPayload` (const) - 1 example import violation(s)
- `src/contact/ContactSubmission.http.ts:132` `ContactSubmissionPayload` (type) - 1 example import violation(s)
- `src/contact/ContactSubmission.model.ts:189` `ContactSubmission` (class) - 2 example import violation(s)
- `src/contact/ContactSubmission.model.ts:244` `ContactSubmissionFormPayload` (class) - 1 example import violation(s)
- `src/contact/ContactSubmission.model.ts:325` `contactSubmissionPayloadFromFormDataEffect` (const) - 1 example import violation(s)
- `src/contact/ContactSubmission.model.ts:409` `decodeContactSubmission` (const) - 2 example import violation(s)
- `src/contact/ContactSubmission.service.ts:288` `submitContact` (const) - 2 example import violation(s)
- `src/content/OipContent.model.ts:683` `decodeOipSiteContentResult` (const) - 1 example import violation(s)
- `src/content/OipContent.model.ts:704` `decodeOipSiteContent` (const) - 1 example import violation(s)
- `src/runtime/OipRuntimeConfig.ts:54` `makeTextConfigOptionReader` (const) - 1 example import violation(s)
- `src/runtime/OipRuntimeConfig.ts:86` `makeRedactedConfigOptionReader` (const) - 1 example import violation(s)

### @beep/exiftool

Path: `packages/drivers/exiftool`

Module findings:
- `src/ExiftoolConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Exiftool.service.ts:64` `ExiftoolShape` (interface) - 1 example import violation(s)

### @beep/lexical-schema

Path: `packages/foundation/modeling/lexical`

Module findings:
- `src/Lexical.behavior.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Lexical.codec.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Lexical.normalize.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Lexical.behavior.ts:38` `nodeToPlainText` (const) - 1 example import violation(s)
- `src/Lexical.behavior.ts:83` `editorStateToPlainText` (const) - 1 example import violation(s)
- `src/Lexical.codec.ts:92` `ArtifactUri` (const) - 1 example import violation(s)
- `src/Lexical.codec.ts:392` `blockToLexical` (const) - 1 example import violation(s)
- `src/Lexical.codec.ts:502` `documentToEditorState` (const) - 1 example import violation(s)
- `src/Lexical.codec.ts:665` `nodeToBlocks` (const) - 1 example import violation(s)
- `src/Lexical.codec.ts:712` `editorStateToDocument` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:99` `LexicalNodeVersion` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:236` `TextFormatMask` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:272` `hasTextFormat` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:294` `withTextFormat` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:404` `TextDetailMask` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:440` `LexicalIndentDepth` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:518` `TableCellSpan` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:559` `TableDimension` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:880` `SafeInlineStyle` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:941` `SafeStyleValue` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:999` `SafeUrl` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:1082` `BaseNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1138` `ElementNode` (class) - 1 documentation section/link violation(s)
- `src/Lexical.model.ts:1197` `ElementNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1280` `TextBase` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1329` `TextNode` (class) - 1 example import violation(s)
- `src/Lexical.model.ts:1355` `TextNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1398` `TabNode` (class) - 1 example import violation(s)
- `src/Lexical.model.ts:1429` `TabNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1474` `LineBreakNode` (class) - 1 example import violation(s)
- `src/Lexical.model.ts:1499` `LineBreakNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1560` `RootNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1621` `ParagraphNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1684` `HeadingNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1756` `QuoteNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1854` `ListNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:1912` `ListNodeValue` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:1996` `ListItemNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2075` `LinkNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2155` `CodeNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2202` `ArtifactRefNode` (class) - 1 example import violation(s)
- `src/Lexical.model.ts:2235` `ArtifactRefNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2283` `YouTubeNode` (class) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Lexical.model.ts:2316` `YouTubeNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2422` `TableCellNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2508` `TableRowNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2591` `TableNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2669` `LexicalNode` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:2730` `LexicalNode` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2819` `SerializedEditorState` (class) - 1 example import violation(s)
- `src/Lexical.model.ts:2884` `SerializedEditorState` (namespace) - 1 example import violation(s)
- `src/Lexical.model.ts:2934` `LexicalNodeWire` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:3024` `SerializedEditorStateWire` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:3078` `EditorStateWireFromJson` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:3102` `LexicalDecodeError` (class) - 1 example import violation(s)
- `src/Lexical.model.ts:3162` `LexicalCompatibilityResult` (class) - 1 example import violation(s)
- `src/Lexical.model.ts:3240` `decodeEditorStateStrictResult` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Lexical.model.ts:3275` `decodeEditorStateStrict` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:3296` `decodeEditorStateLossless` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:3323` `analyzeEditorStateCompatibilityResult` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Lexical.model.ts:3359` `analyzeEditorStateCompatibility` (const) - 1 example import violation(s)
- `src/Lexical.model.ts:3384` `EditorStateFromJson` (const) - 1 example import violation(s)
- `src/index.ts:26` `export { editorStateToPlainText, nodeToPlainText } from "./Lexical.behavior.ts";` (re-export) - 2 example import violation(s)
- `src/index.ts:41` `export {
  ARTIFACT_URI_PREFIX,
  ArtifactUri,
  blockToLexical,
  documentToEditorState,
  editorStateToDocument,
  nodeToBlocks,
} from "./Lexical.codec.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:73` `export {
  ArtifactRefId,
  ArtifactRefNode,
  analyzeEditorStateCompatibility,
  BaseNode,
  CodeNode,
  Direction,
  decodeEditorStateLossless,
  decodeEditorStateStrict,
  EditorStateFromJson,
  EditorStateWireFromJson,
  ElementFormat,
  ElementNode,
  HeadingNode,
  HeadingTag,
  hasTextFormat,
  LexicalCompatibilityIssue,
  LexicalCompatibilityResult,
  LexicalDecodeError,
  LexicalIndentDepth,
  LexicalNode,
  LexicalNodeVersion,
  LexicalNodeWire,
  LineBreakNode,
  LinkNode,
  ListItemNode,
  ListNode,
  ListNodeValue,
  ListTag,
  ListType,
  ParagraphNode,
  QuoteNode,
  RootNode,
  SafeInlineStyle,
  SafeStyleValue,
  SafeUrl,
  SerializedEditorState,
  SerializedEditorStateWire,
  TableCellHeaderState,
  TableCellNode,
  TableCellSpan,
  TableDimension,
  TableNode,
  TableRowNode,
  TabNode,
  TEXT_DETAIL_MASK_ALL,
  TEXT_FORMAT_MASK_ALL,
  TextBase,
  TextDetailBit,
  TextDetailBits,
  TextDetailMask,
  TextFormatBit,
  TextFormatBits,
  TextFormatMask,
  TextMode,
  TextNode,
  withTextFormat,
  YouTubeNode,
} from "./Lexical.model.ts";` (re-export) - 2 example import violation(s)

### @beep/langextract

Path: `packages/foundation/capability/langextract`

Export findings:
- `src/Alignment/Alignment.behavior.ts:73` `spanFromMatch` (const) - 1 example import violation(s)
- `src/Alignment/Alignment.model.ts:76` `MatchedText` (const) - 1 example import violation(s)
- `src/Alignment/Alignment.model.ts:117` `ScoredMatch` (const) - 1 example import violation(s)
- `src/Alignment/Alignment.model.ts:162` `AlignedMatch` (const) - 1 example import violation(s)
- `src/Alignment/Alignment.model.ts:294` `CurrentAlignmentSource` (class) - 1 example import violation(s)
- `src/Alignment/Alignment.model.ts:323` `SpanFromMatch` (const) - 1 example import violation(s)
- `src/Alignment/Alignment.model.ts:373` `MatchedTextFromScored` (const) - 1 example import violation(s)
- `src/Alignment/Alignment.model.ts:407` `AlignedMatchFromMatchedText` (const) - 1 example import violation(s)
- `src/Alignment/Alignment.model.ts:458` `GroundedExtractionFromCandidate` (const) - 1 example import violation(s)
- `src/Alignment/Alignment.model.ts:500` `GroundedExtractionsFromCandidates` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.behavior.ts:100` `parseModelOutput` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.model.ts:115` `LangExtractOptions` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.model.ts:256` `GroundedExtraction` (const) - 1 example import violation(s)
- `src/Extraction/Extraction.model.ts:357` `LangExtractDiagnostics` (class) - 1 example import violation(s)
- `src/Extraction/Extraction.model.ts:406` `LangExtractResult` (class) - 1 example import violation(s)
- `src/Service/Service.layer.ts:163` `layer` (const) - 1 example import violation(s)
- `src/Service/Service.policy.ts:41` `allowRemoteExtractionPolicy` (const) - 1 example import violation(s)
- `src/Service/Service.policy.ts:120` `ensureRemoteExtractionAllowed` (const) - 1 example import violation(s)
- `src/Service/Service.prompt.ts:85` `buildPrompt` (const) - 1 example import violation(s)
- `src/Service/Service.service.ts:34` `LangExtractServiceShape` (interface) - 1 example import violation(s)
- `src/Service/Service.service.ts:57` `LangExtractRemotePolicyShape` (interface) - 1 example import violation(s)
- `src/Service/Service.service.ts:127` `LangExtractService` (class) - 2 example import violation(s)
- `src/Service/Service.service.ts:148` `LangExtractRemotePolicy` (class) - 1 example import violation(s)
- `src/Service/Service.service.ts:176` `LangExtractGenerationTimeout` (class) - 1 example import violation(s)
- `src/VerifiedSpan/VerifiedSpan.behavior.ts:311` `locateRawText` (const) - 1 example import violation(s)
- `src/VerifiedSpan/VerifiedSpan.behavior.ts:392` `convertTextOffsetRange` (const) - 2 example import violation(s)
- `src/VerifiedSpan/VerifiedSpan.behavior.ts:438` `reconstructSourceText` (const) - 2 example import violation(s)
- `src/VerifiedSpan/VerifiedSpan.behavior.ts:494` `locateGroundedExtractions` (const) - 1 example import violation(s)
- `src/VerifiedSpan/VerifiedSpan.model.ts:127` `TextOffsetRange` (class) - 1 example import violation(s)
- `src/VerifiedSpan/VerifiedSpan.model.ts:194` `Utf16TextRange` (class) - 1 example import violation(s)
- `src/VerifiedSpan/VerifiedSpan.model.ts:224` `RawTextChunk` (class) - 1 example import violation(s)

### @beep/scratchpad

Path: `scratchpad`

Module findings:
- `jsonc/index.ts:1` (packageDocumentation) - 1 example import violation(s)
- `schemastore/index.ts:1` (packageDocumentation) - 1 example import violation(s)
- `semver/index.ts:1` (packageDocumentation) - 1 example import violation(s)

Export findings:
- `beep-docs/api-reference/ApiReferenceDataset.ts:559` `loadApiReferenceDataset` (const) - 1 example import violation(s)
- `beep-docs/api-reference/DatasetPath.ts:68` `resolveWithinDataset` (const) - 1 example import violation(s)
- `beep-docs/api-reference/Reflection.ts:251` `loadReflection` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Command.ts:45` `CommandFrontmatter_` (class) - 1 example import violation(s)
- `claudecode/Frontmatter/Command.ts:89` `CommandFrontmatter` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/OutputStyle.ts:38` `OutputStyleFrontmatter_` (class) - 1 example import violation(s)
- `claudecode/Frontmatter/OutputStyle.ts:70` `OutputStyleFrontmatter` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Parser.ts:190` `parse` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Parser.ts:229` `parseFile` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Parser.ts:260` `parseSkillFile` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Parser.ts:289` `parseCommandFile` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Parser.ts:318` `parseSubagentFile` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Parser.ts:349` `parseOutputStyleFile` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Render.ts:141` `render` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Render.ts:164` `renderCommand` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Render.ts:188` `renderSkill` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Render.ts:215` `renderSubagent` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Render.ts:239` `renderOutputStyle` (const) - 1 example import violation(s)
- `claudecode/Frontmatter/Skill.ts:129` `SkillFrontmatter` (class) - 1 example import violation(s)
- `claudecode/Frontmatter/Subagent.ts:81` `SubagentFrontmatter` (class) - 1 example import violation(s)
- `claudecode/Testing.ts:257` `RunHookResult` (class) - 1 example import violation(s)
- `codemode/Codemode.result.ts:370` `encodeResultModel` (const) - 1 example import violation(s)
- `codemode/Codemode.service.ts:177` `resolveExecutionLimits` (const) - 1 example import violation(s)
- `codemode/Codemode.service.ts:206` `execute` (const) - 1 example import violation(s)
- `codemode/Codemode.service.ts:247` `make` (const) - 1 example import violation(s)
- `codemode/Codemode.tool-runtime.ts:1105` `prepare` (const) - 1 example import violation(s)
- `codemode/Codemode.tool-runtime.ts:1140` `searchIndex` (const) - 1 example import violation(s)
- `codemode/Codemode.tool-runtime.ts:1317` `make` (const) - 1 example import violation(s)
- `codemode/Codemode.values.ts:102` `CodeModePromise` (class) - 1 example import violation(s)
- `codemode/Codemode.values.ts:427` `isCodeModeValue` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.errors.ts:251` `constructAggregateErrorValue` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.execute.ts:77` `executeWithLimits` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.iterator.ts:101` `preserveConsumerError` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.methods.ts:219` `invokeIntrinsic` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.methods.ts:602` `invokeArrayFrom` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.methods.ts:685` `invokeGroupBy` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.methods.ts:889` `applyCollectionCallback` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.model.ts:291` `Scope` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.model.ts:481` `MemberReference` (class) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.model.ts:552` `CodeModeFunction` (class) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.model.ts:634` `CodeModeGenerator` (class) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.model.ts:709` `GeneratorMethodReference` (class) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.model.ts:1106` `PromiseInstanceMethodReference` (class) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.model.ts:1940` `tryInterpreter` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.model.ts:2019` `asNode` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.promises.ts:100` `PromiseRuntime` (class) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.promises.ts:395` `resolvePromiseValue` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.promises.ts:467` `resolvePromise` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.promises.ts:555` `invokePromiseMethod` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.promises.ts:711` `invokePromiseInstanceMethod` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.promises.ts:794` `constructPromise` (const) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.runtime.ts:463` `Interpreter` (class) - 1 example import violation(s)
- `codemode/interpreter/Interpreter.scope.ts:67` `ScopeStack` (class) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.runtime.ts:682` `invoke` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.specification.ts:529` `componentDefinitions` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.specification.ts:924` `operationInput` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.specification.ts:1117` `operationOutput` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.specification.ts:1283` `operationPath` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.specification.ts:1349` `validateBaseUrl` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.specification.ts:1391` `specServerUrl` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.specification.ts:1429` `securityRequirements` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.specification.ts:1494` `operationSecurityRequirements` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.specification.ts:1581` `securitySchemes` (const) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.types.ts:559` `CredentialBearer` (class) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.types.ts:588` `CredentialBasic` (class) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.types.ts:626` `CredentialApiKey` (class) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.types.ts:657` `CredentialHeader` (class) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.types.ts:798` `AuthConfig` (class) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.types.ts:1173` `SecurityRequirement` (class) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.types.ts:1216` `Plan` (class) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.types.ts:1273` `AppliedAuth` (class) - 1 example import violation(s)
- `codemode/openapi/OpenAPI.types.ts:1391` `FromSpecResult` (class) - 1 example import violation(s)
- `codemode/openapi/index.ts:412` `fromSpec` (const) - 2 example import violation(s)
- `codemode/stdlib/StdLib.json.ts:71` `invokeJsonMethod` (const) - 1 example import violation(s)
- `codemode/stdlib/StdLib.math.ts:182` `invokeMathSumPrecise` (const) - 1 example import violation(s)
- `codemode/stdlib/StdLib.object.ts:199` `invokeObjectFromEntries` (const) - 1 example import violation(s)
- `codemode/stdlib/StdLib.url.ts:156` `invokeUriFunction` (const) - 1 example import violation(s)
- `effect-ontology/Cli/ErrorHandler.ts:60` `withErrorHandler` (const) - 1 example import violation(s)
- `effect-ontology/Cluster/BackpressureHandler.ts:189` `withBackpressure` (const) - 1 example import violation(s)
- `effect-ontology/Cluster/BackpressureHandler.ts:319` `withBackpressureMetered` (const) - 1 example import violation(s)
- `effect-ontology/Cluster/ExtractionEntityHandler.ts:525` `ExtractionEntityHandlerLayer` (const) - 1 example import violation(s)
- `effect-ontology/Contract/ProgressStreaming.ts:1903` `BackpressureConfig` (class) - 1 example import violation(s)
- `effect-ontology/Domain/Error/Base.ts:268` `OptionalNonNegativeInt` (const) - 1 example import violation(s)
- `effect-ontology/Domain/Error/Embedding.ts:208` `EmbeddingDimensionMismatchError` (class) - 1 example import violation(s)
- `effect-ontology/Domain/Error/Embedding.ts:252` `EmbeddingTokenLimitError` (class) - 1 example import violation(s)
- `effect-ontology/Domain/Error/EventBus.ts:121` `DeadLetterError` (class) - 1 example import violation(s)
- `effect-ontology/Domain/Error/Image.ts:115` `ImageTimeoutError` (class) - 1 example import violation(s)
- `effect-ontology/Domain/Error/Image.ts:260` `ImageError` (const) - 1 example import violation(s)
- `effect-ontology/Domain/Error/Image.ts:286` `ImageError` (type) - 1 example import violation(s)
- `effect-ontology/Domain/Model/Agent.ts:333` `Agent` (interface) - 1 example import violation(s)
- `effect-ontology/Domain/Model/Agent.ts:461` `IntermediateResult` (class) - 1 example import violation(s)
- `effect-ontology/Domain/Model/Agent.ts:500` `PipelineState` (class) - 1 example import violation(s)
- `effect-ontology/Domain/Model/Agent.ts:766` `AgentStarted` (class) - 1 example import violation(s)
- `effect-ontology/Domain/Model/Agent.ts:798` `AgentProgress` (class) - 1 example import violation(s)
- `effect-ontology/Domain/Model/Agent.ts:830` `AgentCompleted` (class) - 1 example import violation(s)
- `effect-ontology/Domain/Model/Agent.ts:863` `AgentFailed` (class) - 1 example import violation(s)
- `effect-ontology/Domain/Model/Agent.ts:940` `PipelineCheckpoint` (class) - 1 example import violation(s)
- `effect-ontology/Domain/Model/Agent.ts:985` `AgentEvent` (const) - 1 example import violation(s)
- `effect-ontology/Domain/Model/BatchWorkflow.ts:143` `BatchIdentity` (class) - 1 example import violation(s)
- `effect-ontology/Domain/Model/CoreOntology.ts:627` `EventInterval` (const) - 1 example import violation(s)
- `effect-ontology/Domain/Model/EntityResolutionGraph.ts:287` `EntityResolutionGraph` (class) - 2 example import violation(s)
- `effect-ontology/Domain/Model/ExtractionRun.ts:129` `OutputMetadata` (class) - 1 example import violation(s)
- `effect-ontology/Domain/Model/ExtractionRun.ts:170` `AuditEvent` (class) - 1 example import violation(s)
- `effect-ontology/Domain/Model/ExtractionRun.ts:200` `AuditError` (class) - 1 example import violation(s)
- `effect-ontology/Domain/Model/ExtractionRun.ts:516` `GroundingPolicy` (const) - 1 example import violation(s)
- `effect-ontology/Domain/Model/ExtractionTelemetry.ts:130` `ExtractionOutcome` (class) - 1 example import violation(s)
- `effect-ontology/Domain/Model/Image.ts:324` `ImageManifest` (class) - 1 example import violation(s)
- `effect-ontology/Domain/PathLayout.ts:788` `RunChunkPath` (const) - 1 example import violation(s)
- `effect-ontology/Domain/Rdf/Types.ts:40` `Triple` (class) - 1 example import violation(s)
- `effect-ontology/Domain/Schema/DocumentMetadata.ts:590` `DocumentMetadata` (class) - 1 example import violation(s)
- `effect-ontology/Domain/Schema/EventSchema.ts:332` `OntologyEventEntry` (const) - 1 example import violation(s)
- `effect-ontology/Domain/Schema/KnowledgeModel.ts:390` `RdfObject` (const) - 1 example import violation(s)
- `effect-ontology/Domain/Schema/KnowledgeModel.ts:816` `EntityRef` (class) - 1 example import violation(s)
- `effect-ontology/Prompt/RuleSet.ts:328` `RuleSet` (const) - 1 example import violation(s)
- `effect-ontology/Repository/Article.ts:195` `ArticleRepository` (class) - 1 example import violation(s)
- `effect-ontology/Repository/CachedArticle.ts:79` `CachedArticleRepository` (class) - 1 example import violation(s)
- `effect-ontology/Repository/CachedClaim.ts:80` `CachedClaimRepository` (class) - 1 example import violation(s)
- `effect-ontology/Repository/Claim.ts:293` `ClaimRepository` (class) - 1 example import violation(s)
- `effect-ontology/Repository/Conflict.ts:212` `canonicalConflictPair` (const) - 1 example import violation(s)
- `effect-ontology/Repository/Conflict.ts:353` `ConflictRepository` (class) - 1 example import violation(s)
- `effect-ontology/Repository/Embedding.ts:130` `HybridSearchResult` (class) - 1 example import violation(s)
- `effect-ontology/Repository/Embedding.ts:479` `EmbeddingRepository` (class) - 1 example import violation(s)
- `effect-ontology/Repository/EntityRegistry.ts:134` `BlockingCandidate` (class) - 1 example import violation(s)
- `effect-ontology/Repository/EntityRegistry.ts:185` `CanonicalEntityFilter` (class) - 2 example import violation(s)
- `effect-ontology/Repository/EntityRegistry.ts:446` `EntityRegistryRepository` (class) - 1 example import violation(s)
- `effect-ontology/Repository/Examples.ts:412` `ExamplesRepository` (class) - 1 example import violation(s)
- `effect-ontology/Repository/index.ts:71` `DrizzleLive` (const) - 1 example import violation(s)
- `effect-ontology/Repository/index.ts:95` `PgClientLive` (const) - 1 example import violation(s)
- `effect-ontology/Repository/index.ts:239` `RepositoriesLive` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/AssetRouter.ts:48` `AssetRouter` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/AuthRouter.ts:166` `AuthRouter` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/CircuitBreaker.ts:88` `CircuitBreakerConfig` (class) - 1 example import violation(s)
- `effect-ontology/Runtime/CircuitBreaker.ts:168` `makeCircuitBreaker` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/ClusterRuntime.ts:130` `ClusterSqliteLiveFromEnv` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/ClusterRuntime.ts:171` `ClusterAutoLiveFromEnv` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/EmbeddingLayers.ts:63` `EmbeddingProviderFromConfig` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/EmbeddingLayers.ts:109` `EmbeddingRateLimiterFromConfig` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/EmbeddingLayers.ts:207` `EmbeddingInfrastructure` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/EventBridge.ts:85` `EventBridgeService` (class) - 1 example import violation(s)
- `effect-ontology/Runtime/EventBroadcastRouter.ts:289` `EventBroadcastHub` (class) - 1 example import violation(s)
- `effect-ontology/Runtime/EventBroadcastRouter.ts:335` `EventBroadcastConfig` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/EventBroadcastRouter.ts:537` `EventBroadcastHubMemory` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/EventBroadcastRouter.ts:612` `EventBroadcastRouter` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/EventBroadcastRouter.ts:772` `broadcastDomainEvent` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/HealthCheck.ts:155` `HealthCheckService` (class) - 1 example import violation(s)
- `effect-ontology/Runtime/HttpMiddleware.ts:48` `CurrentConflictActor` (class) - 1 example import violation(s)
- `effect-ontology/Runtime/HttpMiddleware.ts:114` `makeAuthMiddleware` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/HttpMiddleware.ts:204` `makeShutdownMiddleware` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/HttpMiddleware.ts:240` `makeLoggingMiddleware` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/HttpServer.ts:377` `TimelineRouter` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/HttpServer.ts:676` `SearchRouter` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/HttpServer.ts:1074` `ExtractionRouter` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/HttpServer.ts:1125` `HealthRouter` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/HttpServer.ts:1179` `OntologyRouter` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/ImageRouter.ts:65` `ImageRouter` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/InferenceRouter.ts:69` `InferenceJobStore` (class) - 1 example import violation(s)
- `effect-ontology/Runtime/InferenceRouter.ts:101` `InferenceJobStoreLive` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/InferenceRouter.ts:397` `InferenceRouter` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/JobPushHandler.ts:205` `JobPushRouter` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/JobPushHandler.ts:205` `default` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/LinkIngestionRouter.ts:73` `LinkIngestionBackgroundTasks` (class) - 1 example import violation(s)
- `effect-ontology/Runtime/LinkIngestionRouter.ts:109` `LinkIngestionRouter` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/LlmSemaphore.ts:40` `SemaphoreTimeoutError` (class) - 1 example import violation(s)
- `effect-ontology/Runtime/LlmSemaphore.ts:84` `LlmSemaphoreService` (class) - 1 example import violation(s)
- `effect-ontology/Runtime/Persistence/PostgresLayer.ts:140` `PostgresConfigFromEnv` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/Persistence/PostgresLayer.ts:209` `PgClientLive` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/Persistence/PostgresLayer.ts:226` `DrizzleLive` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/Persistence/PostgresLayer.ts:371` `PostgresPersistenceLive` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/ProductionRuntime.ts:143` `makeLanguageModelLayer` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/ProductionRuntime.ts:291` `ProductionInfrastructure` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/Shutdown.ts:37` `ShutdownConfig` (class) - 1 example import violation(s)
- `effect-ontology/Runtime/Shutdown.ts:61` `DEFAULT_SHUTDOWN_CONFIG` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/Shutdown.ts:123` `ShutdownService` (class) - 1 example import violation(s)
- `effect-ontology/Runtime/TestRuntime.ts:111` `TestConfigProvider` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/TestRuntime.ts:146` `MockShaclService` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/TestRuntime.ts:280` `TestLayers` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/TestRuntime.ts:314` `TestRuntime` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/WorkflowLayers.ts:458` `CliExtractionLayer` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/WorkflowLayers.ts:492` `makeCliExtractionLayer` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/WorkflowLayers.ts:527` `NlpBundleOpen` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/WorkflowLayers.ts:553` `EmbeddingBundleOpen` (const) - 1 example import violation(s)
- `effect-ontology/Runtime/WorkflowLayers.ts:602` `StorageBundleOpen` (const) - 1 example import violation(s)
- `effect-ontology/Service/Agent/AgentCoordinator.ts:135` `ExecutionHooks` (interface) - 1 example import violation(s)
- `effect-ontology/Service/Agent/AgentCoordinator.ts:204` `ExecutionResult` (class) - 1 example import violation(s)
- `effect-ontology/Service/Agent/AgentCoordinator.ts:285` `AgentCoordinator` (class) - 1 example import violation(s)
- `effect-ontology/Service/Agent/AgentKit.ts:357` `AgentKit` (class) - 1 example import violation(s)
- `effect-ontology/Service/Agent/CorrectorAgent.ts:441` `BatchCorrectionResult` (class) - 1 example import violation(s)
- `effect-ontology/Service/Agent/CorrectorAgent.ts:725` `CorrectorAgent` (class) - 1 example import violation(s)
- `effect-ontology/Service/Agent/types.ts:786` `RefinementResult` (class) - 1 example import violation(s)
- `effect-ontology/Service/Agent/types.ts:959` `ExecutionContext` (class) - 2 example import violation(s)
- `effect-ontology/Service/Agent/types.ts:1055` `PipelineExecutionError` (class) - 1 example import violation(s)
- `effect-ontology/Service/Agent/types.ts:1115` `CheckpointTimeoutError` (class) - 1 example import violation(s)
- `effect-ontology/Service/Assertion.ts:351` `AssertionService` (class) - 1 example import violation(s)
- `effect-ontology/Service/Assertion.ts:769` `AssertionServiceLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/BatchState.ts:138` `BatchStateHub` (class) - 1 example import violation(s)
- `effect-ontology/Service/BatchState.ts:165` `BatchStateHubLayer` (const) - 1 example import violation(s)
- `effect-ontology/Service/BatchState.ts:184` `BatchStatePersistenceLayer` (const) - 1 example import violation(s)
- `effect-ontology/Service/BatchState.ts:225` `persistState` (const) - 1 example import violation(s)
- `effect-ontology/Service/BatchState.ts:271` `getBatchStateFromStore` (const) - 1 example import violation(s)
- `effect-ontology/Service/BatchState.ts:340` `publishState` (const) - 1 example import violation(s)
- `effect-ontology/Service/BatchStateBridge.ts:78` `BatchStateBridge` (class) - 1 example import violation(s)
- `effect-ontology/Service/BatchStateBridge.ts:167` `BatchStateBridgeLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/BatchStateBridge.ts:189` `BatchStateBridgeDefault` (const) - 1 example import violation(s)
- `effect-ontology/Service/Claim.ts:210` `ClaimService` (class) - 1 example import violation(s)
- `effect-ontology/Service/ClaimPersistence.ts:83` `PersistenceResult` (class) - 1 example import violation(s)
- `effect-ontology/Service/ClaimPersistence.ts:130` `ClaimPersistenceService` (class) - 1 example import violation(s)
- `effect-ontology/Service/Config.ts:390` `DEFAULT_CONFIG` (const) - 1 example import violation(s)
- `effect-ontology/Service/Config.ts:641` `ConfigService` (class) - 1 example import violation(s)
- `effect-ontology/Service/Config.ts:664` `ConfigServiceDefault` (const) - 1 example import violation(s)
- `effect-ontology/Service/Config.ts:682` `makeConfigServiceLayer` (const) - 1 example import violation(s)
- `effect-ontology/Service/ContentEnrichmentAgent.ts:175` `ContentEnrichmentAgent` (class) - 1 example import violation(s)
- `effect-ontology/Service/CrossBatchEntityResolver.ts:88` `CrossBatchResolutionResult` (class) - 1 example import violation(s)
- `effect-ontology/Service/CrossBatchEntityResolver.ts:128` `MergedEntity` (class) - 1 example import violation(s)
- `effect-ontology/Service/CrossBatchEntityResolver.ts:163` `ResolutionStats` (class) - 1 example import violation(s)
- `effect-ontology/Service/CrossBatchEntityResolver.ts:258` `CrossBatchEntityResolver` (class) - 2 example import violation(s)
- `effect-ontology/Service/CrossBatchEntityResolver.ts:606` `CrossBatchEntityResolverLive` (const) - 2 example import violation(s)
- `effect-ontology/Service/Curation.ts:123` `CurationService` (class) - 1 example import violation(s)
- `effect-ontology/Service/CurationJobProcessor.ts:102` `CurationJobProcessor` (class) - 1 example import violation(s)
- `effect-ontology/Service/DocumentClassifier.ts:399` `DocumentClassifier` (class) - 1 example import violation(s)
- `effect-ontology/Service/Embedding.ts:117` `EmbeddingService` (class) - 1 example import violation(s)
- `effect-ontology/Service/Embedding.ts:166` `EmbeddingServiceLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/Embedding.ts:283` `EmbeddingServiceDefault` (const) - 1 example import violation(s)
- `effect-ontology/Service/EmbeddingCache.ts:109` `EmbeddingCacheConfig` (class) - 2 example import violation(s)
- `effect-ontology/Service/EmbeddingCache.ts:190` `EmbeddingCache` (class) - 1 example import violation(s)
- `effect-ontology/Service/EmbeddingCache.ts:287` `EmbeddingCacheTest` (const) - 1 example import violation(s)
- `effect-ontology/Service/EmbeddingCache.ts:369` `PersistentEmbeddingCache` (class) - 1 example import violation(s)
- `effect-ontology/Service/EmbeddingCache.ts:429` `makePersistentEmbeddingCache` (const) - 1 example import violation(s)
- `effect-ontology/Service/EmbeddingCache.ts:807` `EmbeddingCacheWithPersistence` (const) - 1 example import violation(s)
- `effect-ontology/Service/EmbeddingCircuitBreaker.ts:204` `EmbeddingCircuitBreaker` (class) - 1 example import violation(s)
- `effect-ontology/Service/EmbeddingCircuitBreaker.ts:364` `EmbeddingCircuitBreakerLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/EmbeddingFallback.ts:169` `EmbeddingProviderFallbackLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/EmbeddingFallback.ts:338` `EmbeddingProviderFallbackDefault` (const) - 1 example import violation(s)
- `effect-ontology/Service/EmbeddingProvider.ts:252` `EmbeddingProvider` (class) - 1 example import violation(s)
- `effect-ontology/Service/EmbeddingRateLimiter.ts:166` `EmbeddingRateLimiter` (class) - 1 example import violation(s)
- `effect-ontology/Service/EmbeddingRateLimiter.ts:209` `makeEmbeddingRateLimiter` (const) - 1 example import violation(s)
- `effect-ontology/Service/EmbeddingRateLimiter.ts:278` `EmbeddingRateLimiterVoyage` (const) - 1 example import violation(s)
- `effect-ontology/Service/EmbeddingRateLimiter.ts:303` `EmbeddingRateLimiterLocal` (const) - 1 example import violation(s)
- `effect-ontology/Service/EmbeddingRateLimiter.ts:327` `EmbeddingRateLimiterNoop` (const) - 1 example import violation(s)
- `effect-ontology/Service/EmbeddingResolver.ts:74` `makeEmbeddingResolver` (const) - 1 example import violation(s)
- `effect-ontology/Service/EntityIndex.ts:358` `EntityIndex` (class) - 1 example import violation(s)
- `effect-ontology/Service/EntityIndex.ts:393` `EntityIndexDefault` (const) - 1 example import violation(s)
- `effect-ontology/Service/EntityIndex.ts:505` `PersistentEntityIndex` (class) - 1 example import violation(s)
- `effect-ontology/Service/EntityIndex.ts:535` `makePersistentEntityIndex` (const) - 1 example import violation(s)
- `effect-ontology/Service/EntityIndex.ts:680` `PersistentEntityIndexLayer` (const) - 1 example import violation(s)
- `effect-ontology/Service/EntityLinker.ts:62` `getCanonicalId` (const) - 1 example import violation(s)
- `effect-ontology/Service/EntityLinker.ts:103` `getMentionsForEntity` (const) - 1 example import violation(s)
- `effect-ontology/Service/EntityLinker.ts:166` `toMermaid` (const) - 1 example import violation(s)
- `effect-ontology/Service/EntityResolution.ts:75` `EntityResolutionService` (class) - 1 example import violation(s)
- `effect-ontology/Service/EventBus.ts:69` `JobWithMetadata` (class) - 1 example import violation(s)
- `effect-ontology/Service/EventBus.ts:112` `EventEntry` (const) - 1 example import violation(s)
- `effect-ontology/Service/EventBus.ts:233` `EventBusService` (class) - 1 example import violation(s)
- `effect-ontology/Service/EventBus.ts:338` `EventBusServiceMemory` (const) - 1 example import violation(s)
- `effect-ontology/Service/EventBus.ts:554` `EventBusServiceSql` (const) - 1 example import violation(s)
- `effect-ontology/Service/EventBus.ts:757` `EventBusServiceSqlLayers` (const) - 1 example import violation(s)
- `effect-ontology/Service/EventBus.ts:795` `EventBusServiceSqlLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/EventBus.ts:822` `EventBusServiceDefault` (const) - 1 example import violation(s)
- `effect-ontology/Service/Examples.ts:202` `ExamplesService` (class) - 1 example import violation(s)
- `effect-ontology/Service/ExecutionDeduplicator.ts:90` `makeExecutionDeduplicator` (const) - 1 example import violation(s)
- `effect-ontology/Service/ExecutionDeduplicator.ts:187` `ExecutionDeduplicator` (class) - 1 example import violation(s)
- `effect-ontology/Service/ExecutionDeduplicator.ts:215` `ExecutionDeduplicatorLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/Extraction.ts:94` `EntityExtractor` (class) - 1 example import violation(s)
- `effect-ontology/Service/Extraction.ts:329` `MentionExtractor` (class) - 1 example import violation(s)
- `effect-ontology/Service/Extraction.ts:432` `RelationExtractor` (class) - 1 example import violation(s)
- `effect-ontology/Service/ExtractionCache.ts:129` `makeFileSystemExtractionCache` (const) - 1 example import violation(s)
- `effect-ontology/Service/ExtractionCache.ts:181` `ExtractionCache` (class) - 1 example import violation(s)
- `effect-ontology/Service/ExtractionCache.ts:207` `ExtractionCacheLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/ExtractionCache.ts:229` `FileSystemExtractionCacheLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/ExtractionRun.ts:294` `ExtractionRunService` (class) - 1 example import violation(s)
- `effect-ontology/Service/ExtractionRun.ts:682` `ExtractionRunServiceLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/ExtractionRun.ts:705` `ExtractionRunServiceDefault` (const) - 1 example import violation(s)
- `effect-ontology/Service/ExtractionWorkflow.ts:53` `ExtractionWorkflow` (class) - 1 example import violation(s)
- `effect-ontology/Service/GraphRAG.ts:110` `ScoredNode` (class) - 2 example import violation(s)
- `effect-ontology/Service/GraphRAG.ts:145` `RetrievalStats` (class) - 1 example import violation(s)
- `effect-ontology/Service/GraphRAG.ts:249` `RetrievalResult` (class) - 2 example import violation(s)
- `effect-ontology/Service/GraphRAG.ts:438` `GroundedAnswer` (class) - 2 example import violation(s)
- `effect-ontology/Service/GraphRAG.ts:489` `ReasoningStep` (class) - 1 example import violation(s)
- `effect-ontology/Service/GraphRAG.ts:547` `ReasoningTrace` (class) - 1 example import violation(s)
- `effect-ontology/Service/GraphRAG.ts:1019` `GraphRAG` (class) - 1 example import violation(s)
- `effect-ontology/Service/GraphRAG.ts:1287` `GraphRAGDefault` (const) - 2 example import violation(s)
- `effect-ontology/Service/Grounder.ts:144` `EntityVerificationInput` (class) - 1 example import violation(s)
- `effect-ontology/Service/Grounder.ts:181` `EntityGrounderResult` (class) - 1 example import violation(s)
- `effect-ontology/Service/Grounder.ts:270` `RelationEntityContext` (class) - 1 example import violation(s)
- `effect-ontology/Service/Grounder.ts:306` `RelationVerificationInput` (class) - 1 example import violation(s)
- `effect-ontology/Service/Grounder.ts:517` `GrounderResult` (class) - 1 example import violation(s)
- `effect-ontology/Service/Grounder.ts:605` `GroundingProtocolError` (class) - 1 example import violation(s)
- `effect-ontology/Service/Grounder.ts:747` `Grounder` (class) - 1 example import violation(s)
- `effect-ontology/Service/ImageBlobStore.ts:130` `ImageBlobStore` (class) - 1 example import violation(s)
- `effect-ontology/Service/ImageExtractor.ts:190` `ImageExtractor` (class) - 1 example import violation(s)
- `effect-ontology/Service/ImageFetcher.ts:273` `ImageFetcher` (class) - 1 example import violation(s)
- `effect-ontology/Service/ImagePromptAdapter.ts:135` `ImagePromptAdapter` (class) - 1 example import violation(s)
- `effect-ontology/Service/ImageStore.ts:171` `ImageStore` (class) - 1 example import violation(s)
- `effect-ontology/Service/Inheritance.ts:47` `InheritanceService` (class) - 1 example import violation(s)
- `effect-ontology/Service/JinaReaderClient.ts:189` `JinaReaderClient` (class) - 1 example import violation(s)
- `effect-ontology/Service/LinkIngestionService.ts:272` `LinkIngestionService` (class) - 1 example import violation(s)
- `effect-ontology/Service/LlmControl/RateLimiter.ts:123` `RateLimiterConfig` (class) - 1 example import violation(s)
- `effect-ontology/Service/LlmControl/RateLimiter.ts:183` `CentralRateLimiterService` (class) - 2 example import violation(s)
- `effect-ontology/Service/LlmControl/RateLimiter.ts:373` `CentralRateLimiterServiceLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/LlmControl/RateLimiter.ts:395` `CentralRateLimiterServiceTest` (const) - 1 example import violation(s)
- `effect-ontology/Service/LlmControl/StageTimeout.ts:101` `StageTimeoutConfig` (class) - 1 example import violation(s)
- `effect-ontology/Service/LlmControl/StageTimeout.ts:130` `StageTimeoutConfigInput` (type) - 1 example import violation(s)
- `effect-ontology/Service/LlmControl/StageTimeout.ts:166` `TimeoutError` (class) - 1 example import violation(s)
- `effect-ontology/Service/LlmControl/StageTimeout.ts:235` `StageTimeoutService` (class) - 1 example import violation(s)
- `effect-ontology/Service/LlmControl/StageTimeout.ts:288` `StageTimeoutServiceLive` (const) - 2 example import violation(s)
- `effect-ontology/Service/LlmControl/StageTimeout.ts:308` `StageTimeoutServiceTest` (const) - 1 example import violation(s)
- `effect-ontology/Service/LlmControl/TokenBudget.ts:136` `TokenBudgetService` (class) - 2 example import violation(s)
- `effect-ontology/Service/LlmControl/TokenBudget.ts:264` `TokenBudgetServiceLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/LlmControl/TokenBudget.ts:286` `TokenBudgetServiceTest` (const) - 1 example import violation(s)
- `effect-ontology/Service/LlmProvider.ts:102` `LlmProviderParams` (class) - 1 example import violation(s)
- `effect-ontology/Service/Nlp.ts:106` `SimilarityResult` (class) - 1 example import violation(s)
- `effect-ontology/Service/Nlp.ts:160` `TextChunk` (const) - 1 example import violation(s)
- `effect-ontology/Service/Nlp.ts:393` `OntologySearchResult` (const) - 1 example import violation(s)
- `effect-ontology/Service/Nlp.ts:672` `NlpService` (class) - 1 example import violation(s)
- `effect-ontology/Service/NomicEmbeddingProvider.ts:58` `NomicEmbeddingProviderLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/NomicEmbeddingProvider.ts:124` `NomicEmbeddingProviderDefault` (const) - 1 example import violation(s)
- `effect-ontology/Service/NomicNlp.ts:174` `NomicNlpService` (class) - 1 example import violation(s)
- `effect-ontology/Service/NomicNlp.ts:238` `NomicNlpConfig` (class) - 1 example import violation(s)
- `effect-ontology/Service/NomicNlp.ts:268` `NomicNlpServiceLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/NomicNlp.ts:382` `NomicNlpServiceDefault` (const) - 1 example import violation(s)
- `effect-ontology/Service/NomicNlp.ts:413` `NomicNlpConfigFromConfigService` (const) - 1 example import violation(s)
- `effect-ontology/Service/NomicNlp.ts:452` `NomicNlpServiceFromConfig` (const) - 1 example import violation(s)
- `effect-ontology/Service/Ontology.ts:241` `parseOntologyFromStore` (const) - 1 example import violation(s)
- `effect-ontology/Service/Ontology.ts:634` `OntologyService` (class) - 1 example import violation(s)
- `effect-ontology/Service/OntologyAgent.ts:1129` `OntologyAgent` (class) - 1 example import violation(s)
- `effect-ontology/Service/OntologyLoader.ts:46` `OntologyLoader` (class) - 1 example import violation(s)
- `effect-ontology/Service/OntologyRegistry.ts:176` `OntologyRegistryService` (class) - 1 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:118` `ProgressBuilderState` (class) - 1 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:158` `makeProgressBuilder` (const) - 2 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:205` `createExtractionStarted` (const) - 2 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:275` `createChunkingProgress` (const) - 2 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:338` `createChunkProcessingStarted` (const) - 2 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:402` `createEntityFound` (const) - 2 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:475` `createRelationFound` (const) - 2 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:551` `createChunkProcessingComplete` (const) - 2 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:625` `createExtractionComplete` (const) - 2 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:711` `createExtractionFailed` (const) - 2 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:787` `createRecoverableError` (const) - 2 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:852` `markChunkProcessed` (const) - 2 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:883` `setPhaseProgress` (const) - 2 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:949` `makeBackpressureHandler` (const) - 1 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:1068` `enqueueEvent` (const) - 2 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:1154` `dequeueEvent` (const) - 1 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:1183` `getQueueSize` (const) - 1 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:1210` `combineProgressStreams` (const) - 1 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:1245` `withBackpressure` (const) - 1 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:1351` `ResumableExtractionState` (class) - 1 example import violation(s)
- `effect-ontology/Service/ProgressStreaming.ts:1394` `extractResumableState` (const) - 2 example import violation(s)
- `effect-ontology/Service/PubSubClient.ts:252` `PubSubClientConfig` (const) - 1 example import violation(s)
- `effect-ontology/Service/PubSubClient.ts:219` `PubSubClient` (class) - 1 example import violation(s)
- `effect-ontology/Service/PubSubClient.ts:290` `PubSubClientLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/PubSubClient.ts:465` `EventBusPubSubBridge` (const) - 1 example import violation(s)
- `effect-ontology/Service/PubSubClient.ts:507` `PubSubClientDefault` (const) - 1 example import violation(s)
- `effect-ontology/Service/Rdf.ts:283` `rdfStoreQuads` (const) - 1 example import violation(s)
- `effect-ontology/Service/Rdf.ts:315` `rdfStoreAllQuads` (const) - 1 example import violation(s)
- `effect-ontology/Service/Rdf.ts:412` `rdfStoreApplyRules` (const) - 1 example import violation(s)
- `effect-ontology/Service/Rdf.ts:568` `rdfStoreToDataset` (const) - 1 example import violation(s)
- `effect-ontology/Service/Rdf.ts:944` `RdfBuilder` (class) - 1 example import violation(s)
- `effect-ontology/Service/Reasoner.ts:241` `ReasoningResult` (class) - 1 example import violation(s)
- `effect-ontology/Service/Reasoner.ts:636` `Reasoner` (class) - 2 example import violation(s)
- `effect-ontology/Service/ReconciliationService.ts:273` `ReconciliationService` (class) - 1 example import violation(s)
- `effect-ontology/Service/RelationLinker.ts:57` `LinkedRelation` (class) - 1 example import violation(s)
- `effect-ontology/Service/RelationLinker.ts:87` `LinkingResult` (class) - 1 example import violation(s)
- `effect-ontology/Service/RelationLinker.ts:124` `RelationLinker` (class) - 1 example import violation(s)
- `effect-ontology/Service/Retry.ts:98` `RetryPolicy` (class) - 1 example import violation(s)
- `effect-ontology/Service/Retry.ts:152` `RetryPolicyInput` (type) - 1 example import violation(s)
- `effect-ontology/Service/Retry.ts:290` `retryEffect` (const) - 1 example import violation(s)
- `effect-ontology/Service/Shacl.ts:227` `ShaclWorkflowService` (class) - 1 example import violation(s)
- `effect-ontology/Service/SimilarityScorer.ts:84` `SimilarityScorer` (class) - 1 example import violation(s)
- `effect-ontology/Service/SparqlGenerator.ts:214` `SparqlGenerator` (class) - 1 example import violation(s)
- `effect-ontology/Service/Storage.ts:276` `StorageService` (class) - 1 example import violation(s)
- `effect-ontology/Service/Storage.ts:379` `StorageConfig` (class) - 1 example import violation(s)
- `effect-ontology/Service/Storage.ts:1041` `StorageServiceLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/Storage.ts:1086` `StorageServiceTest` (const) - 1 example import violation(s)
- `effect-ontology/Service/SubgraphExtractor.ts:43` `NodeDistance` (class) - 1 example import violation(s)
- `effect-ontology/Service/SubgraphExtractor.ts:69` `Subgraph` (class) - 1 example import violation(s)
- `effect-ontology/Service/SubgraphExtractor.ts:408` `SubgraphExtractorDefault` (const) - 1 example import violation(s)
- `effect-ontology/Service/Ticket.ts:261` `TicketService` (class) - 1 example import violation(s)
- `effect-ontology/Service/Ticket.ts:290` `TicketServiceLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/ViolationExplainer.ts:247` `BatchExplanationResult` (class) - 1 example import violation(s)
- `effect-ontology/Service/ViolationExplainer.ts:343` `ViolationExplainer` (class) - 2 example import violation(s)
- `effect-ontology/Service/VoyageEmbeddingProvider.ts:326` `VoyageProviderConfig` (class) - 1 example import violation(s)
- `effect-ontology/Service/VoyageEmbeddingProvider.ts:356` `VoyageProviderConfigInput` (type) - 1 example import violation(s)
- `effect-ontology/Service/VoyageEmbeddingProvider.ts:379` `makeVoyageProvider` (const) - 1 example import violation(s)
- `effect-ontology/Service/VoyageEmbeddingProvider.ts:575` `VoyageEmbeddingProviderLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/VoyageEmbeddingProvider.ts:630` `VoyageEmbeddingProviderDefault` (const) - 1 example import violation(s)
- `effect-ontology/Service/WikidataClient.ts:89` `WikidataRateLimitError` (class) - 1 example import violation(s)
- `effect-ontology/Service/WikidataClient.ts:407` `WikidataClient` (class) - 1 example import violation(s)
- `effect-ontology/Service/WorkflowOrchestrator.ts:211` `BatchExtractionWorkflow` (const) - 1 example import violation(s)
- `effect-ontology/Service/WorkflowOrchestrator.ts:338` `pollToBatchState` (const) - 1 example import violation(s)
- `effect-ontology/Service/WorkflowOrchestrator.ts:380` `BatchExtractionWorkflowLayer` (const) - 1 example import violation(s)
- `effect-ontology/Service/WorkflowOrchestrator.ts:1094` `WorkflowOrchestrator` (class) - 1 example import violation(s)
- `effect-ontology/Service/WorkflowOrchestrator.ts:1125` `makeWorkflowOrchestrator` (const) - 1 example import violation(s)
- `effect-ontology/Service/WorkflowOrchestrator.ts:1182` `WorkflowOrchestratorLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/WorkflowOrchestrator.ts:1215` `WorkflowOrchestratorFullLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/WorkflowPersistence.ts:44` `StorageKeyValueStoreLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/WorkflowPersistence.ts:93` `WorkflowPersistenceLive` (const) - 1 example import violation(s)
- `effect-ontology/Service/WorkflowPersistence.ts:119` `WorkflowPersistenceTest` (const) - 1 example import violation(s)
- `effect-ontology/Service/WorkflowPersistence.ts:144` `WorkflowPersistenceMemory` (const) - 1 example import violation(s)
- `effect-ontology/Telemetry/ExtractionTelemetry.ts:95` `ExtractionTelemetryCollector` (class) - 1 example import violation(s)
- `effect-ontology/Telemetry/ExtractionTelemetry.ts:174` `recordProviderAttempt` (const) - 1 example import violation(s)
- `effect-ontology/Telemetry/ExtractionTelemetry.ts:208` `recordProviderUsage` (const) - 1 example import violation(s)
- `effect-ontology/Telemetry/ExtractionTelemetry.ts:245` `recordExtractionChunkCount` (const) - 1 example import violation(s)
- `effect-ontology/Telemetry/ExtractionTelemetry.ts:287` `captureExtractionTelemetry` (const) - 1 example import violation(s)
- `effect-ontology/Telemetry/Metrics.ts:48` `ExtractionMetrics` (class) - 2 example import violation(s)
- `effect-ontology/Telemetry/Metrics.ts:87` `LlmCallMetrics` (class) - 2 example import violation(s)
- `effect-ontology/Telemetry/Metrics.ts:123` `EmbeddingCacheMetrics` (class) - 2 example import violation(s)
- `effect-ontology/Telemetry/Metrics.ts:215` `MetricsService` (class) - 2 example import violation(s)
- `effect-ontology/Telemetry/TracingContext.ts:56` `TracingContext` (class) - 1 example import violation(s)
- `effect-ontology/Utils/Activity.ts:48` `activityRetryPolicy` (const) - 1 example import violation(s)
- `effect-ontology/Utils/ClaimFactory.ts:182` `IriCollisionWarning` (class) - 1 example import violation(s)
- `effect-ontology/Utils/ClaimFactory.ts:215` `IriCollisionReport` (class) - 1 example import violation(s)
- `effect-ontology/Utils/ClaimFactory.ts:422` `checkIriCollisions` (const) - 1 example import violation(s)
- `effect-ontology/Utils/ClaimFactory.ts:1039` `claimExtractionArtifactToQuads` (const) - 1 example import violation(s)
- `effect-ontology/Utils/ClaimFactory.ts:1086` `claimExtractionArtifactFromQuads` (const) - 1 example import violation(s)
- `effect-ontology/Utils/Datatype.ts:45` `NormalizedValue` (class) - 1 example import violation(s)
- `effect-ontology/Utils/Entity.ts:70` `mergeEntityFields` (const) - 1 example import violation(s)
- `effect-ontology/Utils/Hash.ts:82` `sha256` (const) - 1 example import violation(s)
- `effect-ontology/Utils/Hash.ts:111` `hashEmbeddingKey` (const) - 1 example import violation(s)
- `effect-ontology/Utils/Hash.ts:227` `hashVersionedEmbeddingKey` (const) - 1 example import violation(s)
- `effect-ontology/Utils/Hash.ts:273` `sha256Bytes` (const) - 1 example import violation(s)
- `effect-ontology/Utils/IdempotencyKey.ts:230` `computeIdempotencyKeyEffect` (const) - 1 example import violation(s)
- `effect-ontology/Utils/IdempotencyKey.ts:292` `parseIdempotencyKey` (const) - 1 example import violation(s)
- `effect-ontology/Utils/Iri.ts:57` `buildCaseInsensitiveIriMap` (const) - 1 example import violation(s)
- `effect-ontology/Utils/Iri.ts:93` `normalizeIri` (const) - 1 example import violation(s)
- `effect-ontology/Utils/Iri.ts:210` `makeLocalNameSchema` (const) - 1 example import violation(s)
- `effect-ontology/Utils/Iri.ts:259` `LocalNameMapResult` (class) - 1 example import violation(s)
- `effect-ontology/Utils/Iri.ts:315` `buildLocalNameToIriMapSafe` (const) - 1 example import violation(s)
- `effect-ontology/Utils/Iri.ts:368` `expandLocalNameToIri` (const) - 1 example import violation(s)
- `effect-ontology/Utils/Iri.ts:407` `expandTypesToIris` (const) - 1 example import violation(s)
- `effect-ontology/Utils/QuadDelta.ts:73` `QuadDelta` (class) - 1 example import violation(s)
- `effect-ontology/Utils/QuadDelta.ts:110` `computeQuadDelta` (const) - 1 example import violation(s)
- `effect-ontology/Utils/QuadDelta.ts:165` `groupDeltaByPredicate` (const) - 1 example import violation(s)
- `effect-ontology/Utils/QuadDelta.ts:193` `filterTypeInferences` (const) - 1 example import violation(s)
- `effect-ontology/Utils/QuadDelta.ts:212` `summarizeDelta` (const) - 1 example import violation(s)
- `effect-ontology/Utils/Rdf.ts:55` `canonicalNamedNode` (const) - 1 example import violation(s)
- `effect-ontology/Utils/Rdf.ts:107` `canonicalQuad` (const) - 1 example import violation(s)
- `effect-ontology/Utils/RefineKG.ts:59` `refineKnowledgeGraph` (const) - 2 example import violation(s)
- `effect-ontology/Utils/Similarity.ts:54` `getNeighbors` (const) - 2 example import violation(s)
- `effect-ontology/Utils/Similarity.ts:129` `computeEntitySimilarity` (const) - 1 example import violation(s)
- `effect-ontology/Utils/Similarity.ts:260` `shouldConsiderMerge` (const) - 1 example import violation(s)
- `effect-ontology/Utils/Similarity.ts:322` `detectResolutionMethod` (const) - 1 example import violation(s)
- `effect-ontology/Utils/Sql.ts:33` `normalizeDrizzleError` (const) - 1 example import violation(s)
- `effect-ontology/Workflow/DurableActivities.ts:194` `ValidationOutput` (const) - 1 example import violation(s)
- `effect-ontology/Workflow/DurableActivities.ts:313` `CrossBatchResolutionOutput` (class) - 2 example import violation(s)
- `effect-ontology/Workflow/EntityResolution.ts:231` `resolveEntities` (const) - 2 example import violation(s)
- `effect-ontology/Workflow/EntityResolutionGraph.ts:116` `clusterEntities` (const) - 2 example import violation(s)
- `effect-ontology/Workflow/EntityResolutionGraph.ts:453` `buildEntityResolutionGraph` (const) - 2 example import violation(s)
- `effect-ontology/Workflow/Merge.ts:357` `mergeGraphs` (const) - 1 example import violation(s)
- `effect-ontology/Workflow/Merge.ts:400` `mergeGraphsWithConflicts` (const) - 1 example import violation(s)
- `effect-ontology/Workflow/StreamingExtraction.ts:178` `makeExtractionWorkflow` (const) - 1 example import violation(s)
- `effect-ontology/Workflow/StreamingExtraction.ts:827` `ExtractionWorkflowLive` (const) - 1 example import violation(s)
- `effect-ontology/Workflow/StreamingExtractionActivity.ts:234` `buildRunConfig` (const) - 1 example import violation(s)
- `effect-ontology/Workflow/StreamingExtractionActivity.ts:335` `enrichEntityMetadata` (const) - 2 example import violation(s)
- `glob/GlobPattern.ts:83` `GlobPatternError` (class) - 1 example import violation(s)
- `glob/GlobPattern.ts:155` `GlobPatternOptions` (class) - 1 example import violation(s)
- `glob/GlobPattern.ts:265` `GlobPattern` (class) - 1 example import violation(s)
- `glob/GlobSet.ts:110` `GlobSet` (class) - 2 example import violation(s)
- `glob/index.ts:27` `export { GlobPattern, GlobPatternError, GlobPatternOptions } from "./GlobPattern.ts";` (re-export) - 1 example import violation(s)
- `glob/index.ts:45` `export { GlobSet } from "./GlobSet.ts";` (re-export) - 1 example import violation(s)
- `glob/internal/limits.ts:51` `MAX_PATTERN_LENGTH` (const) - 1 example import violation(s)
- `glob/internal/limits.ts:76` `EXPANSION_MAX` (const) - 1 example import violation(s)
- `glob/internal/limits.ts:101` `MAX_GLOBSTAR_RECURSION` (const) - 1 example import violation(s)
- `glob/internal/limits.ts:128` `MAX_EXTGLOB_RECURSION` (const) - 1 example import violation(s)
- `glob/internal/limits.ts:153` `MAX_NESTING_DEPTH` (const) - 1 example import violation(s)
- `jsonc/Jsonc.ts:151` `JsoncParseError` (class) - 1 example import violation(s)
- `jsonc/Jsonc.ts:219` `JsoncParseOptions` (class) - 1 example import violation(s)
- `jsonc/Jsonc.ts:307` `JsoncStringifyOptions` (class) - 1 example import violation(s)
- `jsonc/Jsonc.ts:344` `JsoncStringifyError` (class) - 1 example import violation(s)
- `jsonc/Jsonc.ts:514` `Jsonc` (class) - 1 example import violation(s)
- `jsonc/JsoncEdit.ts:130` `JsoncFormattingOptionsLike` (const) - 1 example import violation(s)
- `jsonc/JsoncFingerprint.ts:398` `JsoncFingerprint` (class) - 1 example import violation(s)
- `jsonc/JsoncModifier.ts:70` `JsoncModificationError` (class) - 1 example import violation(s)
- `jsonc/JsoncModifier.ts:173` `JsoncModifier` (class) - 1 example import violation(s)
- `jsonc/JsoncNode.ts:43` `JsoncSegment` (const) - 1 example import violation(s)
- `jsonc/JsoncNode.ts:182` `JsoncNode` (class) - 1 example import violation(s)
- `jsonc/JsoncVisitor.ts:118` `JsoncVisitor` (class) - 1 example import violation(s)
- `jsonc/index.ts:32` `export type { JsoncBoundCodec } from "./Jsonc.ts";` (re-export) - 1 example import violation(s)
- `jsonc/internal/navigate.ts:209` `NavigateResult` (const) - 1 example import violation(s)
- `jsonc/internal/parser.ts:92` `ParseCode` (const) - 1 example import violation(s)
- `jsonc/internal/scanner.ts:41` `SyntaxKind` (const) - 1 example import violation(s)
- `jsonc/internal/scanner.ts:93` `ScanError` (const) - 1 example import violation(s)
- `jsonl/Envelope.ts:82` `EnvelopeFrame` (const) - 1 example import violation(s)
- `jsonl/Envelope.ts:291` `Envelope` (const) - 1 example import violation(s)
- `jsonl/JsonlError.ts:68` `MalformedLine` (class) - 1 example import violation(s)
- `jsonl/JsonlError.ts:183` `InvalidData` (class) - 1 example import violation(s)
- `jsonl/Line.ts:54` `ParsedLine` (class) - 1 example import violation(s)
- `jsonl/Slice.ts:142` `matchesFrame` (const) - 1 example import violation(s)
- `jsonl/internal/tail.ts:163` `probeBomBytes` (const) - 1 example import violation(s)
- `jsonl/internal/tail.ts:231` `readTail` (const) - 1 example import violation(s)
- `jsonl/internal/tail.ts:322` `readTailUntil` (const) - 1 example import violation(s)
- `jsonl/internal/tail.ts:402` `readRangeText` (const) - 1 example import violation(s)
- `memfs/MemoryFileSystem.ts:362` `MemoryFileSystemSeedEntry` (const) - 1 example import violation(s)
- `memfs/MemoryFileSystem.ts:489` `MemoryFileSystemTransientFault` (const) - 1 example import violation(s)
- `memfs/MemoryFileSystem.ts:916` `MemoryFileSystem` (class) - 1 example import violation(s)
- `memfs/internal/volume.ts:2824` `make` (const) - 1 example import violation(s)
- `memfs/internal/volume.ts:3002` `makeInspectable` (const) - 1 example import violation(s)
- `memfs/internal/volume.ts:3031` `layer` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:326` `HtmlYearString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:363` `HtmlMonthString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:400` `HtmlDateString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:436` `HtmlYearlessDateString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:473` `HtmlTimeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:510` `HtmlLocalDateTimeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:549` `HtmlTimeZoneOffsetString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:584` `HtmlGlobalDateTimeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:620` `HtmlWeekString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:657` `HtmlDurationUnit` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:693` `HtmlIsoDurationString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:735` `HtmlHumanDurationString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:770` `HtmlDurationString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:802` `HtmlUrlTokenString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:844` `HtmlUrlPotentiallySurroundedBySpaces` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:889` `makeHtmlUrlFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:922` `MicrodataSerializedUrlString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:964` `MicrodataUrlFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1114` `HtmlDurationValue` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1167` `MicrodataDurationFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1226` `MicrodataDateTimeFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1264` `XsdIntegerString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1333` `XsdIntegerFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1397` `XsdDoubleString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1445` `XsdDoubleFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1483` `MicrodataNumericValueFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1529` `MicrodataDataValueFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1574` `MicrodataXsdDateString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1611` `MicrodataXsdYearMonthString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1652` `MicrodataXsdYearString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1689` `MicrodataXsdTimeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1729` `MicrodataXsdDateTimeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1775` `MicrodataRdfTimeValueFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1822` `MicrodataRuntimeValueFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1957` `VCardValueType` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:1993` `VCardValueTypeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2031` `VCardValueTypeFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2068` `VCardIanaValueTypeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2111` `VCardExperimentalValueTypeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2152` `VCardDeclaredValueTypeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2189` `VCardTextString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2224` `VCardUriString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2257` `VCardDateString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2295` `VCardTimeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2331` `VCardDateTimeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2370` `VCardDateAndOrTimeString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2405` `VCardTimestampString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2439` `VCardZonedTimestampString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2479` `VCardBooleanString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2517` `VCardIntegerString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2550` `VCardFloatString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2585` `VCardUtcOffsetString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2620` `VCardLanguageTagString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2660` `VCardBooleanFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2742` `VCardIntegerFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2782` `VCardFloatValue` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2838` `VCardFloatFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2924` `VCardUtcOffsetValue` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:2975` `VCardUtcOffsetFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:3046` `VCardTimestampValue` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:3096` `VCardTimestampFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:3141` `VCardUrlFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:3184` `MicrodataContextualValueFromString` (const) - 1 example import violation(s)
- `microdata/Microdata.model.ts:3237` `VCardTypedScalarFromString` (const) - 1 example import violation(s)
- `schemastore/AnnotationCarriers.ts:276` `AnnotationCarriers` (class) - 1 example import violation(s)
- `schemastore/CanonicalJson.ts:60` `NonJsonValueError` (class) - 1 example import violation(s)
- `schemastore/CanonicalJson.ts:264` `CanonicalJson` (class) - 1 example import violation(s)
- `schemastore/DocumentDiff.ts:54` `SchemaChange` (const) - 1 example import violation(s)
- `schemastore/SchemaFile.ts:197` `WriteOutcome` (const) - 1 example import violation(s)
- `schemastore/SchemaFile.ts:232` `WriteChange` (const) - 1 example import violation(s)
- `schemastore/SchemaFile.ts:506` `SchemaFile` (class) - 1 example import violation(s)
- `schemastore/SchemaPipeline.ts:444` `SchemaPipeline` (class) - 1 example import violation(s)
- `schemastore/SchemaTarget.ts:114` `SchemaTarget` (class) - 1 example import violation(s)
- `schemastore/SchemaValidator.ts:274` `SchemaValidator` (class) - 1 example import violation(s)
- `schemastore/SchemaVersioning.ts:80` `InvalidSchemaVersionError` (class) - 1 example import violation(s)
- `schemastore/SchemaVersioning.ts:155` `SchemaVersion` (const) - 1 example import violation(s)
- `schemastore/SchemaVersioning.ts:305` `SchemaVersioning` (class) - 1 example import violation(s)
- `schemastore/StoreDocument.ts:261` `StoreDocument` (class) - 1 example import violation(s)
- `schemastore/index.ts:51` `export { AnnotationCarriers, CarrierDepthExceededError } from "./AnnotationCarriers.ts";` (re-export) - 1 example import violation(s)
- `semver/Comparator.ts:43` `InvalidComparatorError` (class) - 1 example import violation(s)
- `semver/Comparator.ts:107` `Comparator` (class) - 1 example import violation(s)
- `semver/Range.ts:46` `InvalidRangeError` (class) - 1 example import violation(s)
- `semver/Range.ts:165` `Range` (class) - 1 example import violation(s)
- `semver/Range.ts:584` `UnsatisfiableConstraintError` (class) - 1 example import violation(s)
- `semver/SemVer.ts:68` `InvalidVersionError` (class) - 1 example import violation(s)
- `semver/SemVer.ts:175` `SemVer` (class) - 1 example import violation(s)
- `semver/VersionCache.ts:45` `EmptyCacheError` (class) - 1 example import violation(s)
- `semver/VersionCache.ts:109` `VersionNotFoundError` (class) - 1 example import violation(s)
- `semver/VersionCache.ts:179` `UnsatisfiedRangeError` (class) - 1 example import violation(s)
- `semver/VersionCache.ts:335` `VersionCache` (class) - 1 example import violation(s)
- `semver/VersionDiff.ts:66` `VersionDiff` (class) - 1 example import violation(s)
- `semver/index.ts:35` `export { Comparator, InvalidComparatorError } from "./Comparator.ts";` (re-export) - 1 example import violation(s)
- `semver/internal/grammar.ts:42` `ParseResult` (const) - 1 example import violation(s)
- `semver/internal/order.ts:72` `ComparatorOperator` (const) - 1 example import violation(s)
- `toml/Toml.ts:56` `TomlStringifyOptions` (class) - 1 example import violation(s)
- `toml/Toml.ts:87` `TomlParseError` (class) - 1 example import violation(s)
- `toml/Toml.ts:127` `TomlStringifyError` (class) - 1 example import violation(s)
- `toml/Toml.ts:270` `Toml` (class) - 1 example import violation(s)
- `toml/TomlDocument.ts:111` `TomlDocument` (class) - 1 example import violation(s)
- `toml/TomlEdit.ts:46` `TomlSegment` (const) - 1 example import violation(s)
- `toml/TomlFormat.ts:69` `TomlRangeLike` (const) - 1 example import violation(s)
- `toml/TomlFormat.ts:138` `TomlModificationError` (class) - 1 example import violation(s)
- `toml/TomlFormat.ts:927` `TomlFormat` (class) - 1 example import violation(s)
- `toml/TomlVisitor.ts:229` `TomlVisitor` (class) - 1 example import violation(s)
- `toml/internal/scanner.ts:47` `ScanResult` (const) - 1 example import violation(s)
- `toml/internal/scanner.ts:92` `ScalarValue` (const) - 1 example import violation(s)
- `yaml/Yaml.ts:74` `YamlParseOptions` (class) - 1 example import violation(s)
- `yaml/Yaml.ts:152` `YamlStringifyOptions` (class) - 1 example import violation(s)
- `yaml/Yaml.ts:256` `YamlParseError` (class) - 1 example import violation(s)
- `yaml/Yaml.ts:321` `YamlStringifyError` (class) - 1 example import violation(s)
- `yaml/Yaml.ts:637` `Yaml` (class) - 1 example import violation(s)
- `yaml/YamlDocument.ts:109` `YamlDocument` (class) - 1 example import violation(s)
- `yaml/YamlFormat.ts:141` `YamlModificationError` (class) - 1 example import violation(s)
- `yaml/YamlFormat.ts:609` `YamlFormat` (class) - 1 example import violation(s)
- `yaml/YamlLint.ts:594` `YamlStyleConflictError` (class) - 1 example import violation(s)
- `yaml/YamlLint.ts:843` `YamlLint` (class) - 1 example import violation(s)
- `yaml/YamlNode.ts:1131` `aliasExpansionLimit` (function) - 1 example import violation(s)
- `yaml/YamlNode.ts:1080` `AliasExpansionBudgetExceeded` (class) - 1 example import violation(s)
- `yaml/YamlNode.ts:1175` `nodeToJsValue` (const) - 1 example import violation(s)
- `yaml/YamlToken.ts:216` `YamlTokens` (class) - 1 example import violation(s)
- `yaml/YamlVisitor.ts:246` `YamlVisitor` (class) - 1 example import violation(s)
- `yaml/internal/composer/anchors.ts:293` `buildAnchorMap` (function) - 1 example import violation(s)
- `yaml/internal/composer/anchors.ts:57` `checkAnchorOnAlias` (const) - 1 example import violation(s)
- `yaml/internal/composer/anchors.ts:96` `makeAlias` (const) - 1 example import violation(s)
- `yaml/internal/composer/anchors.ts:150` `registerAnchor` (const) - 1 example import violation(s)
- `yaml/internal/composer/anchors.ts:182` `getAnchorName` (const) - 1 example import violation(s)
- `yaml/internal/composer/anchors.ts:214` `getAliasName` (const) - 1 example import violation(s)
- `yaml/internal/composer/anchors.ts:242` `scanName` (const) - 1 example import violation(s)
- `yaml/internal/composer/anchors.ts:345` `getNodeValue` (const) - 1 example import violation(s)
- `yaml/internal/composer/block.ts:115` `composeBlockMap` (const) - 1 example import violation(s)
- `yaml/internal/composer/block.ts:260` `flattenBlockMapChildren` (const) - 1 example import violation(s)
- `yaml/internal/composer/block.ts:1501` `checkDuplicateKeys` (const) - 1 example import violation(s)
- `yaml/internal/composer/block.ts:1627` `checkMultilineImplicitKeys` (const) - 1 example import violation(s)
- `yaml/internal/composer/block.ts:1728` `checkTrailingContentOnSameLine` (const) - 1 example import violation(s)
- `yaml/internal/composer/block.ts:1952` `composeBlockSeq` (const) - 1 example import violation(s)
- `yaml/internal/composer/block.ts:2336` `composeFlatBlockMap` (const) - 1 example import violation(s)
- `yaml/internal/composer/comments.ts:319` `blankAboveIsKeepChompContent` (const) - 1 example import violation(s)
- `yaml/internal/composer/document.ts:259` `composeDocument` (const) - 1 example import violation(s)
- `yaml/internal/composer/document.ts:991` `validateCrossDocumentDirectives` (const) - 1 example import violation(s)
- `yaml/internal/composer/document.ts:1152` `EMPTY_DOCUMENT` (const) - 1 example import violation(s)
- `yaml/internal/composer/document.ts:1189` `composeFirstDocument` (const) - 1 example import violation(s)
- `yaml/internal/composer/flow.ts:208` `composeFlowMap` (const) - 1 example import violation(s)
- `yaml/internal/composer/flow.ts:299` `flattenFlowChildren` (const) - 1 example import violation(s)
- `yaml/internal/composer/flow.ts:527` `composeFlowSeq` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:219` `getScalarStyle` (function) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:249` `getBlockChomp` (function) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:280` `getBlockIndent` (function) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:476` `foldFlowLines` (function) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:1021` `blockMapStartsWithValueSep` (function) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:1150` `findFirstContent` (function) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:1176` `findLastContent` (function) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:325` `getScalarValue` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:862` `findNextSignificantChild` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:900` `hasValueSepAfterInList` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:924` `hasBlockMapAfterInList` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:956` `findValueSepOffset` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:989` `hasValueSepBetween` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:1056` `hasValueSepThroughPlainScalars` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:1204` `findNextContentChild` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:1240` `indexOfChild` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:1266` `hasValueSepAfter` (const) - 1 example import violation(s)
- `yaml/internal/composer/scalars.ts:1718` `shouldPreserveRaw` (const) - 1 example import violation(s)
- `yaml/internal/composer/state.ts:270` `hasMeta` (function) - 1 example import violation(s)
- `yaml/internal/composer/state.ts:291` `clearMeta` (function) - 1 example import violation(s)
- `yaml/internal/composer/state.ts:555` `exitNesting` (function) - 1 example import violation(s)
- `yaml/internal/composer/state.ts:144` `sameLine` (const) - 1 example import violation(s)
- `yaml/internal/composer/state.ts:172` `hasNonWhitespaceBeforeOnLine` (const) - 1 example import violation(s)
- `yaml/internal/composer/state.ts:203` `lineIndentColumn` (const) - 1 example import violation(s)
- `yaml/internal/composer/state.ts:435` `createState` (const) - 1 example import violation(s)
- `yaml/internal/composer/state.ts:491` `MAX_NESTING_DEPTH` (const) - 1 example import violation(s)
- `yaml/internal/composer/state.ts:519` `enterNesting` (const) - 1 example import violation(s)
- `yaml/internal/composer/tags.ts:113` `parseDirective` (function) - 1 example import violation(s)
- `yaml/internal/composer/tags.ts:45` `resolveTagHandle` (const) - 1 example import violation(s)
- `yaml/internal/composer/tags.ts:154` `validateTagHandlesInDocument` (const) - 1 example import violation(s)
- `yaml/internal/cst-parser.ts:1104` `parseCSTAll` (function) - 1 example import violation(s)
- `yaml/internal/cst-visitor.ts:794` `cstEvents` (function) - 1 example import violation(s)
- `yaml/internal/diagnostics.ts:30` `YAML_LEX_ERROR_CODES` (const) - 1 example import violation(s)
- `yaml/internal/diagnostics.ts:63` `YAML_PARSE_ERROR_CODES` (const) - 1 example import violation(s)
- `yaml/internal/diagnostics.ts:101` `YAML_COMPOSE_ERROR_CODES` (const) - 1 example import violation(s)
- `yaml/internal/diagnostics.ts:140` `YAML_STRINGIFY_ERROR_CODES` (const) - 1 example import violation(s)
- `yaml/internal/diagnostics.ts:177` `YAML_MODIFY_ERROR_CODES` (const) - 1 example import violation(s)
- `yaml/internal/diff.ts:94` `computeEdits` (const) - 1 example import violation(s)
- `yaml/internal/fold.ts:199` `isControlChar` (function) - 1 example import violation(s)
- `yaml/internal/fold.ts:224` `hasInteriorTrailingWhitespace` (function) - 1 example import violation(s)
- `yaml/internal/fold.ts:267` `hasNewlineSpacesTab` (function) - 1 example import violation(s)
- `yaml/internal/fold.ts:61` `foldScalarLine` (const) - 1 example import violation(s)
- `yaml/internal/fold.ts:139` `foldRenderedScalar` (const) - 1 example import violation(s)
- `yaml/internal/fold.ts:308` `renderSingleQuotedMultiline` (const) - 1 example import violation(s)
- `yaml/internal/lexer.ts:118` `createScanner` (function) - 1 example import violation(s)
- `yaml/internal/lexer.ts:1514` `lexAll` (function) - 1 example import violation(s)
- `yaml/internal/rules/util.ts:220` `coveringToken` (const) - 1 example import violation(s)
- `yaml/internal/stringifier.ts:439` `renderSingleQuoted` (function) - 1 example import violation(s)
- `yaml/internal/stringifier.ts:73` `StringifyFailure` (class) - 1 example import violation(s)
- `yaml/internal/stringifier.ts:121` `StringifyDepthExceeded` (class) - 1 example import violation(s)
- `yaml/internal/stringifier.ts:369` `renderDoubleQuoted` (const) - 1 example import violation(s)
- `yaml/internal/stringifier.ts:2014` `stringifyValue` (const) - 1 example import violation(s)
- `yaml/internal/stringifier.ts:2056` `stringifyDocument` (const) - 1 example import violation(s)

### @beep/md

Path: `packages/foundation/modeling/md`

Module findings:
- `src/Md.behavior.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Md.escape.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Md.html.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Md.safe.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Md.behavior.ts:96` `segmentInlineRuns` (const) - 1 example import violation(s)
- `src/Md.behavior.ts:132` `renderPlainTextInline` (const) - 1 example import violation(s)
- `src/Md.behavior.ts:149` `renderPlainTextBlock` (const) - 1 example import violation(s)
- `src/Md.behavior.ts:166` `renderPlainTextBlocks` (const) - 1 example import violation(s)
- `src/Md.conformance.ts:235` `CommonMarkDocument` (const) - 1 example import violation(s)
- `src/Md.conformance.ts:285` `GfmDocument` (const) - 1 example import violation(s)
- `src/Md.conformance.ts:331` `BeepMarkdownDocument` (const) - 1 example import violation(s)
- `src/Md.conformance.ts:382` `refineStrictMarkdownDocument` (const) - 2 example import violation(s)
- `src/Md.conformance.ts:466` `inspectMarkdownSpecificationConformance` (const) - 1 example import violation(s)
- `src/Md.escape.ts:158` `UrlPolicySpec` (const) - 1 example import violation(s)
- `src/Md.escape.ts:708` `maxBackticks` (const) - 1 example import violation(s)
- `src/Md.escape.ts:773` `renderFencedCode` (const) - 1 example import violation(s)
- `src/Md.html.ts:43` `renderSafeHtml` (const) - 2 example import violation(s)
- `src/Md.model.ts:57` `CodeFenceLanguage` (const) - 1 example import violation(s)
- `src/Md.model.ts:88` `CodeFenceLanguage` (type) - 1 example import violation(s)
- `src/Md.model.ts:113` `YouTubeVideoId` (const) - 1 example import violation(s)
- `src/Md.model.ts:192` `TableAlignment` (const) - 1 example import violation(s)
- `src/Md.model.ts:232` `AdmonitionKind` (const) - 1 example import violation(s)
- `src/Md.model.ts:272` `EmbedKind` (const) - 1 example import violation(s)
- `src/Md.model.ts:313` `InlineChildren` (const) - 1 example import violation(s)
- `src/Md.model.ts:1192` `Inline` (const) - 1 example import violation(s)
- `src/Md.model.ts:1342` `BlockChildren` (const) - 1 example import violation(s)
- `src/Md.model.ts:1416` `ListItemChild` (const) - 1 example import violation(s)
- `src/Md.model.ts:1514` `ListItemChildren` (const) - 1 example import violation(s)
- `src/Md.model.ts:1649` `HeadingLevel` (const) - 1 example import violation(s)
- `src/Md.model.ts:1673` `HeadingLevel` (type) - 1 example import violation(s)
- `src/Md.model.ts:1929` `ListChildren` (const) - 1 example import violation(s)
- `src/Md.model.ts:2074` `OrderedListStart` (const) - 1 example import violation(s)
- `src/Md.model.ts:2297` `TaskItemChildren` (const) - 1 example import violation(s)
- `src/Md.model.ts:3294` `Block` (const) - 1 example import violation(s)
- `src/Md.render.ts:595` `renderMarkdownInline` (function) - 1 example import violation(s)
- `src/Md.render.ts:656` `renderHtmlInline` (function) - 1 example import violation(s)
- `src/Md.render.ts:192` `EffectRenderAdapter` (interface) - 1 example import violation(s)
- `src/Md.render.ts:675` `renderMarkdownBlock` (const) - 1 example import violation(s)
- `src/Md.render.ts:730` `renderHtmlBlock` (const) - 1 example import violation(s)
- `src/Md.render.ts:767` `renderMarkdownBlocks` (const) - 1 example import violation(s)
- `src/Md.render.ts:787` `renderHtmlBlocks` (const) - 1 example import violation(s)
- `src/Md.render.ts:812` `renderUnsafe` (const) - 1 example import violation(s)
- `src/Md.render.ts:833` `renderHtmlUnsafe` (const) - 1 example import violation(s)
- `src/Md.render.ts:854` `renderPlainTextUnsafe` (const) - 1 example import violation(s)
- `src/Md.render.ts:899` `renderWithUnsafe` (const) - 1 example import violation(s)
- `src/Md.render.ts:934` `renderEffectWithUnsafe` (const) - 2 example import violation(s)
- `src/Md.render.ts:976` `renderEffectWith` (const) - 2 example import violation(s)
- `src/Md.render.ts:1345` `makeMarkdownAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1371` `makeHtmlFragmentAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1395` `MarkdownAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1419` `HtmlFragmentAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1438` `PlainTextAdapter` (const) - 1 example import violation(s)
- `src/Md.render.ts:1465` `renderWith` (const) - 2 example import violation(s)
- `src/Md.render.ts:1499` `render` (const) - 2 example import violation(s)
- `src/Md.render.ts:1524` `renderHtml` (const) - 2 example import violation(s)
- `src/Md.render.ts:1549` `renderPlainText` (const) - 2 example import violation(s)
- `src/Md.safe.ts:79` `DocumentSafetyPathSegment` (const) - 1 example import violation(s)
- `src/Md.safe.ts:739` `documentSafetyIssues` (const) - 1 example import violation(s)
- `src/Md.safe.ts:765` `inlineSafetyIssuesAtRoot` (const) - 1 example import violation(s)
- `src/Md.safe.ts:806` `SafeInline` (const) - 1 example import violation(s)
- `src/Md.safe.ts:833` `SafeInline` (type) - 1 example import violation(s)
- `src/Md.safe.ts:855` `SafeDocument` (const) - 1 example import violation(s)
- `src/Md.safe.ts:882` `SafeDocument` (type) - 1 example import violation(s)
- `src/Md.safe.ts:900` `decodeSafeDocument` (const) - 1 example import violation(s)
- `src/Md.safe.ts:921` `decodeSafeDocumentEffect` (const) - 1 example import violation(s)
- `src/Md.safe.ts:959` `refineSafeDocument` (const) - 2 example import violation(s)
- `src/Md.ts:121` `InlineContent` (type) - 1 example import violation(s)
- `src/Md.ts:177` `BlockContent` (type) - 1 example import violation(s)
- `src/Md.ts:200` `BlockTemplateValue` (type) - 1 example import violation(s)
- `src/Md.ts:239` `ListItemChildInput` (type) - 1 example import violation(s)
- `src/Md.ts:257` `ListItemContent` (type) - 1 example import violation(s)
- `src/Md.ts:296` `ListItemInput` (type) - 1 example import violation(s)
- `src/Md.ts:331` `TableRowInput` (type) - 1 example import violation(s)
- `src/Md.ts:541` `text` (const) - 1 example import violation(s)
- `src/Md.ts:558` `rawMarkdown` (const) - 1 example import violation(s)
- `src/Md.ts:579` `rawHtml` (const) - 1 example import violation(s)
- `src/Md.ts:596` `strong` (const) - 1 example import violation(s)
- `src/Md.ts:613` `em` (const) - 1 example import violation(s)
- `src/Md.ts:630` `del` (const) - 1 example import violation(s)
- `src/Md.ts:647` `code` (const) - 1 example import violation(s)
- `src/Md.ts:664` `a` (const) - 1 example import violation(s)
- `src/Md.ts:693` `img` (const) - 1 example import violation(s)
- `src/Md.ts:716` `br` (const) - 1 example import violation(s)
- `src/Md.ts:733` `inlineMath` (const) - 1 example import violation(s)
- `src/Md.ts:750` `footnoteRef` (const) - 1 example import violation(s)
- `src/Md.ts:768` `h1` (const) - 1 example import violation(s)
- `src/Md.ts:785` `h2` (const) - 1 example import violation(s)
- `src/Md.ts:802` `h3` (const) - 1 example import violation(s)
- `src/Md.ts:819` `h4` (const) - 1 example import violation(s)
- `src/Md.ts:836` `h5` (const) - 1 example import violation(s)
- `src/Md.ts:853` `h6` (const) - 1 example import violation(s)
- `src/Md.ts:870` `p` (const) - 1 example import violation(s)
- `src/Md.ts:887` `li` (const) - 1 example import violation(s)
- `src/Md.ts:904` `ul` (const) - 1 example import violation(s)
- `src/Md.ts:921` `ol` (const) - 1 example import violation(s)
- `src/Md.ts:948` `taskItem` (const) - 1 example import violation(s)
- `src/Md.ts:978` `taskListFromItems` (const) - 1 example import violation(s)
- `src/Md.ts:995` `blockquote` (const) - 1 example import violation(s)
- `src/Md.ts:1012` `pre` (const) - 1 example import violation(s)
- `src/Md.ts:1036` `tableCell` (const) - 1 example import violation(s)
- `src/Md.ts:1053` `tableRow` (const) - 1 example import violation(s)
- `src/Md.ts:1071` `table` (const) - 1 example import violation(s)
- `src/Md.ts:1108` `mathBlock` (const) - 1 example import violation(s)
- `src/Md.ts:1125` `footnoteDef` (const) - 1 example import violation(s)
- `src/Md.ts:1149` `admonition` (const) - 1 example import violation(s)
- `src/Md.ts:1173` `embed` (const) - 1 example import violation(s)
- `src/Md.ts:1221` `youtube` (const) - 2 example import violation(s)
- `src/Md.ts:1240` `youtubeEffect` (const) - 2 example import violation(s)
- `src/Md.ts:1263` `youtubeUnsafe` (const) - 1 example import violation(s)
- `src/Md.ts:1279` `hr` (const) - 1 example import violation(s)
- `src/Md.ts:1296` `make` (const) - 1 example import violation(s)
- `src/Md.ts:1330` `Md` (const) - 2 example import violation(s)
- `src/index.ts:23` `export * from "./Md.behavior.ts";` (re-export) - 2 example import violation(s)
- `src/index.ts:39` `export * from "./Md.conformance.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:54` `export * from "./Md.escape.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:71` `export * from "./Md.html.ts";` (re-export) - 2 example import violation(s)
- `src/index.ts:86` `export * from "./Md.model.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:101` `export * from "./Md.render.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:117` `export * from "./Md.safe.ts";` (re-export) - 2 example import violation(s)
- `src/index.ts:134` `export * from "./Md.ts";` (re-export) - 2 example import violation(s)

### @beep/practice-kg-mcp

Path: `apps/practice-kg-mcp`

Export findings:
- `src/entrypoint.ts:27` `runEntrypoint` (const) - 1 example import violation(s)
- `src/runtime/Host.ts:51` `loadPracticeKgBundleContext` (const) - 1 example import violation(s)
- `src/runtime/Layer.ts:54` `makePracticeKgBuildLayer` (const) - 1 example import violation(s)

### @beep/tailscale

Path: `packages/drivers/tailscale`

Export findings:
- `src/Tailscale.service.ts:73` `parseTailscaleMagicDnsName` (const) - 1 example import violation(s)
- `src/Tailscale.service.ts:114` `parseTailscaleStatus` (const) - 1 example import violation(s)
- `src/Tailscale.service.ts:152` `readTailscaleStatus` (const) - 1 example import violation(s)

### @beep/law-practice-use-cases

Path: `packages/law-practice/use-cases`

Module findings:
- `src/IrToLaw/IrToLaw.ports.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/IrToLaw/IrToLaw.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/OfficeActionReview/OfficeActionReview.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PracticeKg.tools.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/CandorPolicy/CandorPolicy.ports.ts:101` `CandorRecordReaderShape` (class) - 1 example import violation(s)
- `src/CandorPolicy/CandorPolicy.ports.ts:161` `CandorRecordReader` (class) - 1 example import violation(s)
- `src/CandorPolicy/CandorPolicy.ports.ts:210` `CandorPolicyShape` (class) - 1 example import violation(s)
- `src/CandorPolicy/CandorPolicy.ports.ts:275` `CandorPolicy` (class) - 1 example import violation(s)
- `src/CandorPolicy/CandorPolicy.service.ts:299` `CandorPolicyLive` (const) - 1 example import violation(s)
- `src/CandorRecord/CandorRecord.ports.ts:197` `CandorRecordRepositoryShape` (class) - 1 example import violation(s)
- `src/CandorRecord/CandorRecord.ports.ts:298` `CandorRecordRepository` (class) - 1 example import violation(s)
- `src/CandorRecord/CandorRecord.reader.ts:64` `CandorRecordReaderFromRepository` (const) - 1 example import violation(s)
- `src/IrToLaw/IrToLaw.errors.ts:91` `IrToLawExtractionError` (class) - 1 example import violation(s)
- `src/IrToLaw/IrToLaw.ports.ts:152` `IrToLawShape` (class) - 1 example import violation(s)
- `src/IrToLaw/IrToLaw.ports.ts:192` `IrToLaw` (class) - 1 example import violation(s)
- `src/IrToLaw/IrToLaw.service.ts:177` `makeIrToLaw` (const) - 1 example import violation(s)
- `src/LegalPositionRecord/LegalPositionRecord.ports.ts:214` `LegalPositionRecordRepositoryShape` (class) - 1 example import violation(s)
- `src/LegalPositionRecord/LegalPositionRecord.ports.ts:332` `LegalPositionRecordRepository` (class) - 1 example import violation(s)
- `src/LegalPositionRelatorPolicy/LegalPositionRelatorPolicy.ports.ts:146` `LegalPositionRelatorPolicy` (class) - 1 example import violation(s)
- `src/LegalPositionRelatorPolicy/LegalPositionRelatorPolicy.service.ts:219` `LegalPositionRelatorPolicyLive` (const) - 1 example import violation(s)
- `src/OfficeActionReview/OfficeActionReview.ports.ts:72` `OfficeActionReviewInput` (class) - 2 example import violation(s)
- `src/OfficeActionReview/OfficeActionReview.ports.ts:214` `OfficeActionReviewShape` (interface) - 1 example import violation(s)
- `src/OfficeActionReview/OfficeActionReview.ports.ts:254` `OfficeActionReview` (class) - 1 example import violation(s)
- `src/OfficeActionReview/OfficeActionReview.service.ts:242` `makeOfficeActionReview` (const) - 2 example import violation(s)
- `src/PatentClaimCandidate/PatentClaimCandidate.ts:49` `PatentClaimCandidateInput` (class) - 1 example import violation(s)
- `src/PatentClaimCandidate/PatentClaimCandidate.ts:212` `patentClaimCandidateFrom` (const) - 1 example import violation(s)
- `src/PracticeKg.tools.ts:187` `PracticeKgToolResult` (class) - 2 example import violation(s)

### @beep/semantic-web

Path: `packages/foundation/capability/semantic-web`

Export findings:
- `src/identity/IdentityRdfBinding.ts:95` `IdentityRdfBinding` (class) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:121` `DefaultIdentityRdfBinding` (const) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:142` `IdentityFiberPathError` (class) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:168` `IdentityEntryIriError` (class) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:194` `IdentityDatasetDecodeError` (class) - 1 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:235` `decodeEntrySubject` (const) - 2 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:417` `entriesToDataset` (const) - 2 example import violation(s)
- `src/identity/IdentityRdfBinding.ts:472` `datasetToEntries` (const) - 2 example import violation(s)
- `src/identity/IdentityRegistryDataset.ts:42` `layerDataset` (const) - 1 example import violation(s)
- `src/identity/IdentityShaclProjection.ts:90` `IdentityShapePolicy` (class) - 1 example import violation(s)
- `src/identity/IdentityShaclProjection.ts:128` `projectShapes` (const) - 2 example import violation(s)
- `src/services/canonicalization.ts:354` `CanonicalizationService` (class) - 1 example import violation(s)
- `src/services/shacl-validation.ts:428` `ShaclValidationService` (class) - 1 example import violation(s)
- `src/services/sparql-query.ts:361` `SparqlQueryService` (class) - 1 example import violation(s)
- `src/services/sparql-query.ts:397` `UnsupportedSparqlQueryServiceLive` (const) - 1 example import violation(s)

### @beep/utils

Path: `packages/foundation/modeling/utils`

Module findings:
- `src/Bool.ts:1` (jsdoc) - 1 example import violation(s)
- `src/Data.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/FileSystem.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/GlobalValue.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/NodeUrl.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Path.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Array.ts:617` `export * from "effect/Array";` (re-export) - 1 example import violation(s)
- `src/Array.ts:42` `matchToBoolean` (const) - 1 example import violation(s)
- `src/Array.ts:72` `assertNonEmptyArray` (const) - 1 example import violation(s)
- `src/Array.ts:96` `assertNonEmptyReadonlyArray` (const) - 1 example import violation(s)
- `src/Array.ts:141` `mapNonEmpty` (const) - 2 example import violation(s)
- `src/Array.ts:180` `flatMapNonEmpty` (const) - 2 example import violation(s)
- `src/Array.ts:221` `mapNonEmptyReadonly` (const) - 2 example import violation(s)
- `src/Array.ts:266` `flatMapNonEmptyReadonly` (const) - 2 example import violation(s)
- `src/Array.ts:327` `indexOf` (const) - 2 example import violation(s)
- `src/Array.ts:359` `lastIndexOf` (const) - 2 example import violation(s)
- `src/Array.ts:389` `slice` (const) - 2 example import violation(s)
- `src/Array.ts:415` `entries` (const) - 1 example import violation(s)
- `src/Array.ts:433` `keys` (const) - 1 example import violation(s)
- `src/Array.ts:453` `values` (const) - 1 example import violation(s)
- `src/Array.ts:479` `appendInPlace` (const) - 1 example import violation(s)
- `src/Array.ts:509` `appendAllInPlace` (const) - 1 example import violation(s)
- `src/Array.ts:543` `sortInPlace` (const) - 1 example import violation(s)
- `src/Array.ts:578` `spliceInPlace` (const) - 1 example import violation(s)
- `src/Array.ts:645` `makeReadonly` (const) - 1 example import violation(s)
- `src/Array.ts:668` `fromIterableNonEmpty` (const) - 1 example import violation(s)
- `src/Array.ts:692` `emptyReadonly` (const) - 1 example import violation(s)
- `src/Bool.ts:18` `export * from "effect/Boolean";` (re-export) - 1 example import violation(s)
- `src/DrainableWorker.ts:31` `DrainableWorker` (interface) - 1 example import violation(s)
- `src/DrainableWorker.ts:80` `makeDrainableWorker` (const) - 1 example import violation(s)
- `src/Equal.ts:22` `export * from "effect/Equal";` (re-export) - 1 example import violation(s)
- `src/Errors.ts:165` `mapToError` (function) - 2 example import violation(s)
- `src/Errors.ts:45` `ErrorMapper` (type) - 2 example import violation(s)
- `src/Errors.ts:98` `mapCauseError` (const) - 2 example import violation(s)
- `src/FileSystem.ts:313` `existsSync` (const) - 1 example import violation(s)
- `src/FileSystem.ts:437` `readdirSync` (const) - 1 example import violation(s)
- `src/FileSystem.ts:467` `statSync` (const) - 1 example import violation(s)
- `src/FileSystem.ts:507` `makeWaitForFile` (const) - 1 example import violation(s)
- `src/Glob.ts:249` `Glob` (interface) - 1 example import violation(s)
- `src/Glob.ts:273` `Glob` (const) - 1 example import violation(s)
- `src/Glob.ts:552` `layer` (const) - 1 example import violation(s)
- `src/GlobalValue.ts:73` `globalValue` (const) - 1 example import violation(s)
- `src/HostProcess.ts:84` `HostProcessPlatform` (const) - 1 example import violation(s)
- `src/HostProcess.ts:109` `HostProcessArchitecture` (const) - 1 example import violation(s)
- `src/NodeUrl.ts:88` `fromFileUrl` (const) - 2 example import violation(s)
- `src/NodeUrl.ts:141` `toFileUrl` (const) - 2 example import violation(s)
- `src/Number.ts:44` `isPositive` (const) - 1 documentation section/link violation(s)
- `src/Number.ts:88` `isInteger` (const) - 1 example import violation(s)
- `src/Option.ts:63` `propFromNullishOr` (const) - 2 example import violation(s)
- `src/Option.ts:112` `getSomesStruct` (const) - 1 example import violation(s)
- `src/Path.ts:69` `export { fromFileUrl, toFileUrl } from "./NodeUrl.ts";` (re-export) - 1 example import violation(s)
- `src/Predicate.ts:207` `chainRefinements` (function) - 1 example import violation(s)
- `src/Predicate.ts:156` `hasInspectableObjectShape` (const) - 1 example import violation(s)
- `src/Str.ts:834` `export * from "effect/String";` (re-export) - 1 example import violation(s)
- `src/Str.ts:41` `equivalence` (const) - 2 example import violation(s)
- `src/Str.ts:71` `orderAsc` (const) - 2 example import violation(s)
- `src/Str.ts:118` `prefix` (const) - 2 example import violation(s)
- `src/Str.ts:159` `prefixThunk` (const) - 2 example import violation(s)
- `src/Str.ts:212` `postfix` (const) - 2 example import violation(s)
- `src/Str.ts:253` `postfixThunk` (const) - 2 example import violation(s)
- `src/Str.ts:294` `mapPrefix` (const) - 2 example import violation(s)
- `src/Str.ts:343` `mapPostfix` (const) - 2 example import violation(s)
- `src/Str.ts:378` `camelCase` (const) - 1 example import violation(s)
- `src/Str.ts:396` `snakeCase` (const) - 1 example import violation(s)
- `src/Str.ts:414` `kebabCase` (const) - 1 example import violation(s)
- `src/Str.ts:433` `screamingSnake` (const) - 1 example import violation(s)
- `src/Str.ts:452` `pascalCase` (const) - 1 example import violation(s)
- `src/Str.ts:470` `pascalToSnake` (const) - 1 example import violation(s)
- `src/Str.ts:489` `snakeToCamel` (const) - 1 example import violation(s)
- `src/Str.ts:508` `snakeToKebab` (const) - 1 example import violation(s)
- `src/Str.ts:527` `camelToSnake` (const) - 1 example import violation(s)
- `src/Str.ts:546` `snakeToPascal` (const) - 1 example import violation(s)
- `src/Str.ts:565` `kebabToSnake` (const) - 1 example import violation(s)
- `src/Str.ts:592` `startsWith` (const) - 2 example import violation(s)
- `src/Str.ts:632` `endsWith` (const) - 2 example import violation(s)
- `src/Str.ts:677` `contains` (const) - 2 example import violation(s)
- `src/Str.ts:721` `repeat` (const) - 2 example import violation(s)
- `src/Str.ts:757` `replaceWith` (const) - 2 example import violation(s)
- `src/Str.ts:801` `replaceAllWith` (const) - 2 example import violation(s)
- `src/Str.ts:854` `trimThunk` (const) - 1 example import violation(s)
- `src/Str.ts:874` `fromNumber` (const) - 1 example import violation(s)
- `src/Str.ts:891` `toSlug` (const) - 1 example import violation(s)
- `src/Str.ts:929` `truncate` (const) - 2 example import violation(s)
- `src/Str.ts:955` `orEmpty` (const) - 1 example import violation(s)
- `src/Str.ts:1003` `matchEmpty` (const) - 1 example import violation(s)
- `src/Stream.ts:46` `streamFilterJson` (const) - 1 example import violation(s)
- `src/Struct.ts:171` `dotGet` (const) - 2 example import violation(s)
- `src/Struct.ts:218` `dotGetOption` (const) - 2 example import violation(s)
- `src/Struct.ts:285` `mapPath` (const) - 2 example import violation(s)
- `src/Struct.ts:363` `mapPathLazy` (const) - 1 example import violation(s)
- `src/Struct.ts:445` `getLazy` (const) - 2 example import violation(s)
- `src/Struct.ts:480` `pathsOf` (const) - 1 example import violation(s)
- `src/Struct.ts:600` `entriesNonEmpty` (const) - 1 example import violation(s)
- `src/Struct.ts:631` `keys` (const) - 1 example import violation(s)
- `src/Struct.ts:657` `keysNonEmpty` (const) - 1 example import violation(s)
- `src/Struct.ts:692` `fromEntries` (const) - 1 example import violation(s)
- `src/Struct.ts:800` `reverse` (const) - 1 example import violation(s)
- `src/Struct.ts:920` `deepMerge` (const) - 1 example import violation(s)
- `src/Text.ts:34` `splitCommaSeparatedTrimmed` (const) - 1 example import violation(s)
- `src/Text.ts:62` `formatNameWithAliases` (const) - 1 example import violation(s)
- `src/Text.ts:94` `joinLines` (const) - 1 example import violation(s)
- `src/index.ts:30` `export * as A from "./Array.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:45` `export * as Bool from "./Bool.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:63` `export * as Data from "./Data.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:78` `export * as DateTime from "./DateTime.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:106` `export * as Eq from "./Equal.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:133` `export * as Err from "./Errors.ts";` (re-export) - 2 example import violation(s)
- `src/index.ts:151` `export * as FileSystem from "./FileSystem.ts";` (re-export) - 2 example import violation(s)
- `src/index.ts:173` `export * from "./HostProcess.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:189` `export * as Html from "./Html.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:205` `export * as N from "./Number.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:221` `export * as O from "./Option.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:236` `export * as Path from "./Path.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:252` `export * as P from "./Predicate.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:267` `export * from "./Random.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:283` `export * as R from "./Record.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:299` `export * as Str from "./Str.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:314` `export * as Stream from "./Stream.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:330` `export * as Struct from "./Struct.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:346` `export * as Text from "./Text.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:362` `export * from "./thunk.ts";` (re-export) - 1 example import violation(s)
- `src/thunk.ts:247` `thunkEffect` (const) - 1 example import violation(s)
- `src/thunk.ts:309` `thunkEffectSucceedNull` (const) - 1 example import violation(s)
- `src/thunk.ts:367` `thunkEmptyReadonlyRecord` (const) - 1 example import violation(s)

### @beep/repo-ai-metrics

Path: `packages/tooling/library/ai-metrics`

Export findings:
- `src/agent-effectiveness.ts:2934` `makeAgentEffectivenessDoctorReport` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:3301` `makeAgentEffectivenessAnnotationPlan` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:3540` `makeAgentEffectivenessDatasetBundle` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:3911` `syncAgentEffectivenessPhoenix` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:4279` `makeAgentEffectivenessAnnotationCheckReport` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:4336` `agentEffectivenessDoctorReportToJson` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:4388` `agentEffectivenessAnnotationPlanToJson` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:4431` `agentEffectivenessAnnotationCheckReportToJson` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:4474` `agentEffectivenessDatasetBundleToJson` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:4511` `agentEffectivenessPromptBundleToJson` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:4555` `agentEffectivenessExperimentBundleToJson` (const) - 1 example import violation(s)
- `src/agent-effectiveness.ts:4604` `agentEffectivenessPhoenixSyncResultToJson` (const) - 1 example import violation(s)
- `src/archive.ts:272` `AiMetricsRawArchiveKey` (const) - 1 example import violation(s)
- `src/archive.ts:294` `AiMetricsRawArchiveKey` (type) - 1 example import violation(s)
- `src/archive.ts:421` `writeEncryptedRawArchiveObject` (const) - 1 example import violation(s)
- `src/archive.ts:538` `decryptEncryptedRawArchiveEnvelope` (const) - 1 example import violation(s)
- `src/compose.ts:44` `renderAiMetricsLocalPhoenixCompose` (const) - 1 example import violation(s)
- `src/config-snapshot.ts:946` `makeAiMetricsConfigSnapshot` (const) - 1 example import violation(s)
- `src/config-snapshot.ts:1118` `writeAiMetricsConfigSnapshotArtifacts` (const) - 1 example import violation(s)
- `src/config-snapshot.ts:1218` `configSnapshotToJson` (const) - 1 example import violation(s)
- `src/data-root.ts:494` `requireAbsoluteAiMetricsDataRoot` (const) - 1 example import violation(s)
- `src/derived-storage.ts:1023` `ensureAiMetricsDerivedStorage` (const) - 1 example import violation(s)
- `src/duckdb.ts:91` `withAiMetricsDuckDb` (const) - 1 example import violation(s)
- `src/forwarder.ts:134` `AiMetricsForwarderInput` (class) - 1 example import violation(s)
- `src/forwarder.ts:1019` `runAiMetricsForwarder` (const) - 1 example import violation(s)
- `src/forwarder.ts:1153` `forwarderRunResultToJson` (const) - 1 example import violation(s)
- `src/forwarder.ts:1199` `forwarderTimerPlanToJson` (const) - 1 example import violation(s)
- `src/hook-pulse.ts:608` `HookPulseRawEvent` (class) - 1 example import violation(s)
- `src/hook-pulse.ts:752` `hookPulseHashSalt` (const) - 1 example import violation(s)
- `src/hook-pulse.ts:882` `HookPulseV1` (class) - 1 example import violation(s)
- `src/hook-pulse.ts:1124` `HookPulseV1FromRawEvent` (const) - 1 example import violation(s)
- `src/identity-registry.ts:534` `isNestedGitRoot` (const) - 1 example import violation(s)
- `src/identity-registry.ts:588` `makeAiMetricsCanonicalRoot` (const) - 1 example import violation(s)
- `src/identity-registry.ts:740` `readAiMetricsIdentityRegistry` (const) - 1 example import violation(s)
- `src/identity-registry.ts:810` `identityRegistryToJson` (const) - 1 example import violation(s)
- `src/identity-registry.ts:972` `upsertAiMetricsIdentityRegistry` (const) - 1 example import violation(s)
- `src/ingest.ts:190` `summarizeTranscriptText` (const) - 1 example import violation(s)
- `src/ingest.ts:250` `summaryToJson` (const) - 1 example import violation(s)
- `src/install.ts:1301` `makeAiMetricsInstallSpec` (const) - 1 example import violation(s)
- `src/install.ts:1366` `makeAiMetricsInstallPlan` (const) - 1 example import violation(s)
- `src/install.ts:1431` `makeAiMetricsInstallDoctorResult` (const) - 1 example import violation(s)
- `src/install.ts:1558` `makeAiMetricsInstallApplyDryRunResult` (const) - 1 example import violation(s)
- `src/install.ts:1604` `aiMetricsInstallPlanToJson` (const) - 1 example import violation(s)
- `src/install.ts:1645` `aiMetricsInstallDoctorToJson` (const) - 1 example import violation(s)
- `src/install.ts:1682` `aiMetricsInstallApplyDryRunToJson` (const) - 1 example import violation(s)
- `src/mirror.ts:361` `aiMetricsMirrorPayloadContainsJsonStringPrefix` (const) - 1 example import violation(s)
- `src/mirror.ts:794` `locateLatestAiMetricsMirrorBundle` (const) - 1 example import violation(s)
- `src/mirror.ts:930` `buildAiMetricsMirrorBundle` (const) - 1 example import violation(s)
- `src/mirror.ts:1120` `aiMetricsMirrorBundleToJson` (const) - 1 example import violation(s)
- `src/otlp.ts:654` `readAiMetricsOtlpSpanProjections` (const) - 1 example import violation(s)
- `src/otlp.ts:877` `AiMetricsOtlpSpanSenderShape` (interface) - 1 example import violation(s)
- `src/otlp.ts:1035` `runAiMetricsOtlpProjectionBatchExport` (const) - 1 example import violation(s)
- `src/otlp.ts:1099` `runAiMetricsOtlpExport` (const) - 1 example import violation(s)
- `src/otlp.ts:1147` `otlpExportResultToJson` (const) - 1 example import violation(s)
- `src/privacy.ts:446` `hashPublicTextSha256` (const) - 1 example import violation(s)
- `src/privacy.ts:486` `hashPrivateIdentifier` (const) - 1 example import violation(s)
- `src/privacy.ts:610` `makeAiMetricsSourceAttribution` (const) - 1 example import violation(s)
- `src/privacy.ts:791` `makeSanitizedTranscript` (const) - 1 example import violation(s)
- `src/privacy.ts:873` `makeAiMetricsPrivacyCheckResult` (const) - 1 example import violation(s)
- `src/privacy.ts:933` `privacyCheckToJson` (const) - 1 example import violation(s)
- `src/retention.ts:680` `AiMetricsRetentionRestoreDrillInput` (class) - 1 example import violation(s)
- `src/retention.ts:1018` `listAiMetricsRetentionInventory` (const) - 1 example import violation(s)
- `src/retention.ts:1187` `enforceAiMetricsRetentionPolicy` (const) - 1 example import violation(s)
- `src/retention.ts:1319` `runAiMetricsRetentionDelete` (const) - 1 example import violation(s)
- `src/retention.ts:1377` `runAiMetricsRetentionCompact` (const) - 1 example import violation(s)
- `src/retention.ts:1445` `runAiMetricsRetentionRestoreDrill` (const) - 1 example import violation(s)
- `src/retention.ts:1603` `aiMetricsRetentionInventoryToJson` (const) - 1 example import violation(s)
- `src/retention.ts:1644` `aiMetricsRetentionEnforcementToJson` (const) - 1 example import violation(s)
- `src/retention.ts:1686` `aiMetricsRetentionMutationToJson` (const) - 1 example import violation(s)
- `src/retention.ts:1728` `aiMetricsRetentionRestoreDrillToJson` (const) - 1 example import violation(s)
- `src/scorecard.ts:945` `listAiMetricsBenchmarkCases` (const) - 1 example import violation(s)
- `src/scorecard.ts:1518` `aiMetricsLabelQueueToJson` (const) - 1 example import violation(s)
- `src/scorecard.ts:1557` `aiMetricsOutcomeLabelToJson` (const) - 1 example import violation(s)
- `src/scorecard.ts:1589` `aiMetricsBenchmarkCaseToJson` (const) - 1 example import violation(s)
- `src/scorecard.ts:1629` `aiMetricsBenchmarkCaseListToJson` (const) - 1 example import violation(s)
- `src/scorecard.ts:1667` `aiMetricsBenchmarkRunToJson` (const) - 1 example import violation(s)
- `src/scorecard.ts:1709` `aiMetricsWeeklyReportToJson` (const) - 1 example import violation(s)
- `src/source-discovery.ts:619` `discoverAiMetricsSources` (const) - 1 example import violation(s)
- `src/source-discovery.ts:691` `sourceDiscoveryToJson` (const) - 1 example import violation(s)
- `src/telemetry-v2-store.ts:221` `TelemetryV2StoreShape` (interface) - 1 example import violation(s)
- `src/telemetry-v2-store.ts:442` `TelemetryV2Store` (class) - 1 example import violation(s)

### @beep/tika

Path: `packages/drivers/tika`

Module findings:
- `src/Tika.error-translation.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Tika.response.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Tika.server.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Tika.error-translation.ts:159` `tikaOperationError` (const) - 1 example import violation(s)
- `src/Tika.errors.ts:79` `TikaErrorOptions` (class) - 1 example import violation(s)
- `src/Tika.response.ts:100` `decodeTikaResponseRecord` (const) - 1 example import violation(s)
- `src/Tika.response.ts:153` `readTikaContentText` (const) - 1 example import violation(s)
- `src/Tika.server.ts:165` `makeTikaServerFileProcessingEngine` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Tika.server.ts:311` `makeTikaServerFileProcessingEngineFromEnv` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/Tika.tikaapp.ts:89` `makeTikaAppFileProcessingEngine` (const) - 1 example import violation(s); 1 documentation section/link violation(s)

### @beep/libpff

Path: `packages/drivers/libpff`

Module findings:
- `src/Libpff.eml.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Libpff.error-translation.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Libpff.messages.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Libpff.pffexport.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Libpff.eml.ts:179` `rfc5322DateFromOutlookTimestamp` (const) - 1 example import violation(s)
- `src/Libpff.eml.ts:439` `assembleEml` (const) - 1 example import violation(s)
- `src/Libpff.error-translation.ts:177` `libpffOperationError` (const) - 1 example import violation(s)
- `src/Libpff.errors.ts:76` `LibpffErrorOptions` (class) - 1 example import violation(s)
- `src/Libpff.errors.ts:172` `makeLibpffError` (const) - 1 example import violation(s)
- `src/Libpff.messages.ts:85` `PffexportMessageRecord` (class) - 1 example import violation(s)
- `src/Libpff.messages.ts:132` `encodePffexportMessageRecordJson` (const) - 1 example import violation(s)
- `src/Libpff.pffexport.ts:536` `makePffexportFileProcessingEngine` (const) - 1 example import violation(s); 1 documentation section/link violation(s)

### @beep/venice-ai

Path: `packages/drivers/venice-ai`

Export findings:
- `src/VeniceAI.service.ts:418` `VeniceAIConfigInput` (class) - 1 example import violation(s)
- `src/VeniceAI.service.ts:1385` `VENICE_AI_OPERATION_DESCRIPTORS` (const) - 2 example import violation(s)
- `src/VeniceAI.service.ts:2041` `VeniceAI` (class) - 1 example import violation(s)
- `src/VeniceAI.service.ts:2114` `VeniceAiChat` (class) - 1 example import violation(s)

### @beep/graph-3d

Path: `packages/drivers/graph-3d`

Module findings:
- `src/Graph3D.react.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph3D.renderer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Graph3D.renderer.ts:949` `renderGraph3D` (const) - 1 example import violation(s)

### @beep/identity

Path: `packages/foundation/modeling/identity`

Module findings:
- `src/Id.ts:1` (packageDocumentation) - 1 example import violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 example import violation(s)

Export findings:
- `src/Curie.ts:110` `expandOption` (const) - 2 example import violation(s)
- `src/Curie.ts:163` `contractOption` (const) - 2 example import violation(s)
- `src/Curie.ts:254` `expand` (const) - 1 example import violation(s)
- `src/Curie.ts:302` `contract` (const) - 1 example import violation(s)
- `src/Curie.ts:358` `expandPredicate` (const) - 1 example import violation(s)
- `src/Curie.ts:378` `makeCurieCodec` (const) - 1 example import violation(s)
- `src/Curie.ts:398` `CoreCurieCodec` (const) - 1 example import violation(s)
- `src/Curie.ts:416` `makeCurieFromIri` (const) - 1 example import violation(s)
- `src/Curie.ts:440` `CurieFromIri` (const) - 1 example import violation(s)
- `src/Fibered.ts:217` `Fibered` (const) - 1 example import violation(s)
- `src/Id.ts:149` `IdentityInterpolationError` (class) - 1 example import violation(s)
- `src/Id.ts:182` `IdentitySegmentCountError` (class) - 1 example import violation(s)
- `src/Id.ts:216` `VERSION` (const) - 1 example import violation(s)
- `src/Id.ts:238` `SegmentValue` (type) - 1 example import violation(s)
- `src/Id.ts:374` `TitleFromIdentifier` (type) - 1 example import violation(s)
- `src/Id.ts:399` `IriFromIdentity` (type) - 1 example import violation(s)
- `src/Id.ts:428` `CurieFromIdentity` (type) - 1 example import violation(s)
- `src/Id.ts:458` `SlugFromIdentifier` (type) - 1 example import violation(s)
- `src/Id.ts:501` `ModuleSegmentValue` (type) - 1 example import violation(s)
- `src/Id.ts:522` `ModuleAccessor` (type) - 1 example import violation(s)
- `src/Id.ts:543` `TaggedAccessor` (type) - 1 example import violation(s)
- `src/Id.ts:562` `IdentityString` (type) - 2 example import violation(s)
- `src/Id.ts:583` `IdentitySymbol` (type) - 2 example import violation(s)
- `src/Id.ts:606` `SchemaAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:632` `DeclarationAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:668` `ErrorAnnotationRecord` (interface) - 1 example import violation(s)
- `src/Id.ts:691` `KeyAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:714` `SkosClassification` (type) - 1 example import violation(s)
- `src/Id.ts:737` `OntologyKeyOptions` (type) - 1 example import violation(s)
- `src/Id.ts:768` `OntologyClassExtras` (type) - 1 example import violation(s)
- `src/Id.ts:802` `HttpAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:828` `IdentityAnyAnnotationExtras` (type) - 1 example import violation(s)
- `src/Id.ts:854` `IdentityAnnotation` (type) - 1 example import violation(s)
- `src/Id.ts:909` `IdentityAnnotationResult` (type) - 1 example import violation(s)
- `src/Id.ts:943` `AnnotatedSchema` (type) - 1 example import violation(s)
- `src/Id.ts:960` `TaggedModuleRecord` (type) - 1 example import violation(s)
- `src/Id.ts:1023` `IdentityComposer` (interface) - 1 example import violation(s)
- `src/Id.ts:1630` `BaseIdentityInput` (const) - 1 example import violation(s)
- `src/Id.ts:1659` `BaseIdentityInput` (type) - 1 example import violation(s)
- `src/Id.ts:2175` `make` (const) - 2 example import violation(s)
- `src/IdentityRegistry.ts:30` `IdentityEncoding` (const) - 1 example import violation(s)
- `src/IdentityRegistry.ts:62` `IdentityRef` (const) - 1 example import violation(s)
- `src/IdentityRegistry.ts:100` `IdentityEntry` (class) - 1 example import violation(s)
- `src/IdentityRegistry.ts:177` `IdentityNotFoundError` (class) - 1 example import violation(s)
- `src/IdentityRegistry.ts:205` `IdentityRegistryConflictError` (class) - 1 example import violation(s)
- `src/IdentityRegistry.ts:247` `IdentityRegistry` (class) - 2 example import violation(s)
- `src/PnLocal.ts:136` `SafePnLocal` (const) - 1 example import violation(s)
- `src/PnLocal.ts:165` `SafePnLocal` (type) - 1 example import violation(s)
- `src/PnLocal.ts:184` `SafePnPrefix` (const) - 1 example import violation(s)
- `src/PnLocal.ts:213` `SafePnPrefix` (type) - 1 example import violation(s)
- `src/PnLocal.ts:232` `isSafeLocal` (const) - 1 example import violation(s)
- `src/PnLocal.ts:249` `isSafePrefix` (const) - 1 example import violation(s)
- `src/PnLocal.ts:342` `EscapedPnLocal` (const) - 1 example import violation(s)
- `src/PnLocal.ts:371` `EscapedPnLocal` (type) - 1 example import violation(s)
- `src/PnLocal.ts:389` `acceptsEscapedLocal` (const) - 1 example import violation(s)
- `src/PnLocal.ts:405` `unescapeLocal` (const) - 1 example import violation(s)
- `src/PnLocal.ts:427` `escapeLocal` (const) - 1 example import violation(s)
- `src/PnLocal.ts:447` `prefixedNameOrIri` (const) - 1 example import violation(s)
- `src/Vocab.ts:36` `VocabShape` (type) - 1 example import violation(s)
- `src/Vocab.ts:62` `VocabEntry` (class) - 1 example import violation(s)
- `src/Vocab.ts:88` `VocabRegistry` (const) - 1 example import violation(s)
- `src/Vocab.ts:109` `VocabRegistry` (type) - 1 example import violation(s)
- `src/Vocab.ts:128` `CoreVocab` (const) - 1 example import violation(s)
- `src/Vocab.ts:376` `CoreVocab` (type) - 1 example import violation(s)
- `src/Vocab.ts:393` `Curie` (type) - 1 example import violation(s)
- `src/Vocab.ts:412` `Predicate` (type) - 1 example import violation(s)
- `src/Vocab.ts:429` `Expand` (type) - 1 example import violation(s)
- `src/Vocab.ts:471` `mergeVocab` (const) - 1 example import violation(s)
- `src/Vocab.ts:496` `SemanticFoundationVocab` (const) - 1 example import violation(s)
- `src/Vocab.ts:523` `SemanticFoundationVocab` (type) - 1 example import violation(s)
- `src/index.ts:32` `export * from "./Curie.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:57` `export * from "./Fibered.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:73` `export * from "./Id.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:88` `export * from "./IdentityRegistry.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:106` `export * from "./PnLocal.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:121` `export * from "./packages.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:136` `export * from "./Vocab.ts";` (re-export) - 1 example import violation(s)
- `src/packages.ts:232` `$ApiDocsId` (const) - 1 example import violation(s)
- `src/packages.ts:249` `$CiopsId` (const) - 1 example import violation(s)
- `src/packages.ts:266` `$LejeuneBoltWorkbenchId` (const) - 1 example import violation(s)
- `src/packages.ts:284` `$SemanticaId` (const) - 1 example import violation(s)
- `src/packages.ts:301` `$TrustgraphWorkbenchId` (const) - 1 example import violation(s)
- `src/packages.ts:321` `$DataId` (const) - 1 example import violation(s)
- `src/packages.ts:337` `$IdentityId` (const) - 1 example import violation(s)
- `src/packages.ts:353` `$SchemaId` (const) - 1 example import violation(s)
- `src/packages.ts:369` `$ProvenanceId` (const) - 1 example import violation(s)
- `src/packages.ts:385` `$RdfId` (const) - 1 example import violation(s)
- `src/packages.ts:433` `$TypesId` (const) - 1 example import violation(s)
- `src/packages.ts:449` `$UtilsId` (const) - 1 example import violation(s)
- `src/packages.ts:467` `$UiId` (const) - 1 example import violation(s)
- `src/packages.ts:485` `$RepoAiMetricsId` (const) - 1 example import violation(s)
- `src/packages.ts:501` `$RepoCliId` (const) - 1 example import violation(s)
- `src/packages.ts:517` `$RepoConfigsId` (const) - 1 example import violation(s)
- `src/packages.ts:533` `$RepoUtilsId` (const) - 1 example import violation(s)
- `src/packages.ts:549` `$TestUtilsId` (const) - 1 example import violation(s)
- `src/packages.ts:567` `$SharedDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:600` `$SharedTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:616` `$SemanticWebId` (const) - 1 example import violation(s)
- `src/packages.ts:632` `$NlpId` (const) - 1 example import violation(s)
- `src/packages.ts:664` `$LangExtractId` (const) - 1 example import violation(s)
- `src/packages.ts:680` `$ObservabilityId` (const) - 1 example import violation(s)
- `src/packages.ts:696` `$ColorsId` (const) - 1 example import violation(s)
- `src/packages.ts:712` `$ChalkId` (const) - 1 example import violation(s)
- `src/packages.ts:728` `$RepoDocgenId` (const) - 1 example import violation(s)
- `src/packages.ts:744` `$InfraId` (const) - 1 example import violation(s)
- `src/packages.ts:762` `$WorkspaceDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:778` `$EpistemicDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:795` `$EpistemicUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:812` `$AgentsDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:828` `$AgentsServerId` (const) - 1 example import violation(s)
- `src/packages.ts:844` `$AgentsUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:860` `$AgentsClientId` (const) - 1 example import violation(s)
- `src/packages.ts:876` `$LawPracticeDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:894` `$LawPracticeUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:912` `$LawPracticeServerId` (const) - 1 example import violation(s)
- `src/packages.ts:929` `$ProfessionalDesktopId` (const) - 1 example import violation(s)
- `src/packages.ts:1075` `$AnthropicId` (const) - 1 example import violation(s)
- `src/packages.ts:1124` `$AcpId` (const) - 1 example import violation(s)
- `src/packages.ts:1141` `$OpenaiCompatId` (const) - 1 example import violation(s)
- `src/packages.ts:1158` `$WorkspaceTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:1175` `$WorkspaceUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:1193` `$WorkspaceServerId` (const) - 1 example import violation(s)
- `src/packages.ts:1210` `$DocumentsDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:1227` `$DocumentsUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:1245` `$DocumentsServerId` (const) - 1 example import violation(s)
- `src/packages.ts:1262` `$ArchitectureLabDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:1280` `$ArchitectureLabUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:1298` `$ArchitectureLabConfigId` (const) - 1 example import violation(s)
- `src/packages.ts:1316` `$ArchitectureLabServerId` (const) - 1 example import violation(s)
- `src/packages.ts:1334` `$ArchitectureLabTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:1352` `$ArchitectureLabClientId` (const) - 1 example import violation(s)
- `src/packages.ts:1370` `$ArchitectureLabUiId` (const) - 1 example import violation(s)
- `src/packages.ts:1388` `$ArchitectureLabProofId` (const) - 1 example import violation(s)
- `src/packages.ts:1406` `$RunpodId` (const) - 1 example import violation(s)
- `src/packages.ts:1423` `$OnepasswordCliId` (const) - 1 example import violation(s)
- `src/packages.ts:1440` `$DiscordId` (const) - 1 example import violation(s)
- `src/packages.ts:1457` `$AiProviderCliId` (const) - 1 example import violation(s)
- `src/packages.ts:1474` `$SanityId` (const) - 1 example import violation(s)
- `src/packages.ts:1491` `$HubspotId` (const) - 1 example import violation(s)
- `src/packages.ts:1508` `$PhoenixId` (const) - 1 example import violation(s)
- `src/packages.ts:1525` `$AiSyncId` (const) - 1 example import violation(s)
- `src/packages.ts:1542` `$BoxId` (const) - 1 example import violation(s)
- `src/packages.ts:1559` `$NlpMcpId` (const) - 1 example import violation(s)
- `src/packages.ts:1593` `$WinkId` (const) - 1 example import violation(s)
- `src/packages.ts:1610` `$FileProcessingId` (const) - 1 example import violation(s)
- `src/packages.ts:1627` `$TikaId` (const) - 1 example import violation(s)
- `src/packages.ts:1644` `$LibpffId` (const) - 1 example import violation(s)
- `src/packages.ts:1661` `$FirecrawlId` (const) - 1 example import violation(s)
- `src/packages.ts:1678` `$UsptoId` (const) - 1 example import violation(s)
- `src/packages.ts:1695` `$LexicalSchemaId` (const) - 1 example import violation(s)
- `src/packages.ts:1712` `$EditorId` (const) - 1 example import violation(s)
- `src/packages.ts:1729` `$ScratchpadId` (const) - 1 example import violation(s)
- `src/packages.ts:1746` `$HtmlId` (const) - 1 example import violation(s)
- `src/packages.ts:1763` `$PandocAstId` (const) - 1 example import violation(s)
- `src/packages.ts:1780` `$PgliteId` (const) - 1 example import violation(s)
- `src/packages.ts:1797` `$M365Id` (const) - 1 example import violation(s)
- `src/packages.ts:1814` `$M365McpId` (const) - 1 example import violation(s)
- `src/packages.ts:1831` `$GovinfoId` (const) - 1 example import violation(s)
- `src/packages.ts:1848` `$EcfrId` (const) - 1 example import violation(s)
- `src/packages.ts:1865` `$ApiTransportId` (const) - 1 example import violation(s)
- `src/packages.ts:1882` `$McpKitId` (const) - 1 example import violation(s)
- `src/packages.ts:1899` `$UsptoMcpId` (const) - 1 example import violation(s)
- `src/packages.ts:1916` `$PacerId` (const) - 1 example import violation(s)
- `src/packages.ts:1933` `$FcRunsId` (const) - 1 example import violation(s)
- `src/packages.ts:1950` `$CosmosId` (const) - 1 example import violation(s)
- `src/packages.ts:1967` `$DbAdminId` (const) - 1 example import violation(s)
- `src/packages.ts:1984` `$EpistemicServerId` (const) - 1 example import violation(s)
- `src/packages.ts:2001` `$EpistemicTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:2018` `$LintRulesId` (const) - 1 example import violation(s)
- `src/packages.ts:2035` `$N3Id` (const) - 1 example import violation(s)
- `src/packages.ts:2052` `$PretextId` (const) - 1 example import violation(s)
- `src/packages.ts:2069` `$Graph3dId` (const) - 1 example import violation(s)
- `src/packages.ts:2086` `$DockId` (const) - 1 example import violation(s)
- `src/packages.ts:2103` `$DockReactId` (const) - 1 example import violation(s)
- `src/packages.ts:2120` `$OntologyClientId` (const) - 1 example import violation(s)
- `src/packages.ts:2137` `$OntologyConfigId` (const) - 1 example import violation(s)
- `src/packages.ts:2154` `$OntologyDomainId` (const) - 1 example import violation(s)
- `src/packages.ts:2171` `$OntologyServerId` (const) - 1 example import violation(s)
- `src/packages.ts:2188` `$OntologyUiId` (const) - 1 example import violation(s)
- `src/packages.ts:2205` `$OntologyUseCasesId` (const) - 1 example import violation(s)
- `src/packages.ts:2222` `$OxigraphId` (const) - 1 example import violation(s)
- `src/packages.ts:2239` `$ShaclId` (const) - 1 example import violation(s)
- `src/packages.ts:2256` `$StorybookId` (const) - 1 example import violation(s)
- `src/packages.ts:2273` `$TsgoShimId` (const) - 1 example import violation(s)
- `src/packages.ts:2290` `$DocTextId` (const) - 1 example import violation(s)
- `src/packages.ts:2307` `$DocumentsTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:2324` `$TailscaleId` (const) - 1 example import violation(s)
- `src/packages.ts:2341` `$AgentsTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:2358` `$EpistemicConfigId` (const) - 1 example import violation(s)
- `src/packages.ts:2375` `$LawPracticeTablesId` (const) - 1 example import violation(s)
- `src/packages.ts:2393` `$PracticeKgMcpId` (const) - 1 example import violation(s)
- `src/packages.ts:2410` `$OpenclawId` (const) - 1 example import violation(s)
- `src/packages.ts:2427` `$ObsId` (const) - 1 example import violation(s)
- `src/packages.ts:2444` `$ExiftoolId` (const) - 1 example import violation(s)
- `src/packages.ts:2461` `$QaCaptureId` (const) - 1 example import violation(s)
- `src/packages.ts:2478` `$GovLegalMcpId` (const) - 1 example import violation(s)
- `src/packages.ts:2494` `$EpistemicClientId` (const) - 1 example import violation(s)
- `src/packages.ts:2510` `$EpistemicUiId` (const) - 1 example import violation(s)
- `src/packages.ts:2543` `$SkillContractId` (const) - 1 example import violation(s)
- `src/packages.ts:2560` `$CodegenKitId` (const) - 1 example import violation(s)
- `src/packages.ts:2577` `$BrandId` (const) - 1 example import violation(s)
- `src/packages.ts:2594` `$OpenaiId` (const) - 1 example import violation(s)
- `src/packages.ts:2611` `$TodoxId` (const) - 1 example import violation(s)
- `src/packages.ts:2628` `$BoxProvisioningId` (const) - 1 example import violation(s)

### @beep/drizzle

Path: `packages/drivers/drizzle`

Export findings:
- `src/Drizzle.service.ts:95` `DrizzleClient` (interface) - 1 example import violation(s)
- `src/Drizzle.service.ts:135` `DrizzleShape` (interface) - 1 example import violation(s)
- `src/Drizzle.service.ts:175` `Drizzle` (class) - 1 example import violation(s)

### @beep/api-transport

Path: `packages/foundation/capability/api-transport`

Module findings:
- `src/EgressDenied.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Transport.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/EgressDenied.ts:46` `EgressDenied` (class) - 1 example import violation(s)
- `src/Transport.ts:61` `ApiAuth` (const) - 1 example import violation(s)
- `src/Transport.ts:108` `ApiAuth` (type) - 1 example import violation(s)
- `src/Transport.ts:171` `RateLimitSnapshot` (class) - 1 example import violation(s)
- `src/Transport.ts:271` `ApiTransportOptions` (class) - 1 example import violation(s)
- `src/Transport.ts:345` `ApiTransport` (interface) - 2 example import violation(s)
- `src/Transport.ts:384` `makeApiTransport` (const) - 2 example import violation(s)

### @beep/box

Path: `packages/drivers/box`

Export findings:
- `src/Box.config.ts:48` `BoxDeveloperTokenConfig` (class) - 1 example import violation(s)
- `src/Box.config.ts:83` `BoxCcgConfig` (class) - 1 example import violation(s)
- `src/Box.config.ts:116` `BoxConfig` (class) - 1 example import violation(s)
- `src/Box.config.ts:144` `BoxConfigLayer` (const) - 1 example import violation(s)
- `src/Box.config.ts:184` `layer` (const) - 1 example import violation(s)
- `src/Box.config.ts:208` `layerConfig` (const) - 1 example import violation(s)
- `src/Box.service.ts:118` `Box` (class) - 1 example import violation(s)
- `src/Box.streaming.ts:78` `BoxByteInput` (type) - 1 example import violation(s)
- `src/Box.streaming.ts:96` `BoxByteStream` (type) - 1 example import violation(s)
- `src/Box.streaming.ts:120` `BoxPartAccumulator` (class) - 1 example import violation(s)
- `src/Box.streaming.ts:427` `BoxUploadFilePartByUrlPayload` (class) - 1 example import violation(s)
- `src/Box.streaming.ts:501` `BoxChunkedUploadReducerPayload` (class) - 1 example import violation(s)
- `src/Box.streaming.ts:534` `BoxUploadBigFilePayload` (class) - 1 example import violation(s)
- `src/Box.streaming.ts:587` `BoxGetZipDownloadContentPayload` (class) - 1 example import violation(s)
- `src/Box.streaming.ts:1074` `makeStreamingOperations` (const) - 1 example import violation(s)

### @beep/openai-compat

Path: `packages/drivers/openai-compat`

Export findings:
- `src/OpenAiCompat.models.ts:1204` `decodeChatCompletionResponse` (const) - 1 example import violation(s)
- `src/OpenAiCompat.models.ts:1228` `decodeChatCompletionChunk` (const) - 1 example import violation(s)
- `src/OpenAiCompatClient.service.ts:56` `OpenAiCompatClientOptions` (class) - 1 example import violation(s)
- `src/OpenAiCompatClient.service.ts:91` `OpenAiCompatClientShape` (interface) - 1 example import violation(s)
- `src/OpenAiCompatClient.service.ts:368` `OpenAiCompatClient` (class) - 1 example import violation(s)
- `src/OpenAiCompatLanguageModel.service.ts:146` `OpenAiCompatProvider` (type) - 1 example import violation(s)
- `src/OpenAiCompatLanguageModel.service.ts:174` `OpenAiCompatLanguageModelOptions` (type) - 1 example import violation(s)
- `src/OpenAiCompatLanguageModel.service.ts:961` `makeFromProvider` (const) - 1 example import violation(s)
- `src/OpenAiCompatLanguageModel.service.ts:1010` `layerFromProvider` (const) - 1 example import violation(s)

### @beep/documents-server

Path: `packages/documents/server`

Module findings:
- `src/aggregates/Sync/DmsMirrorBox.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/aggregates/Sync/DmsMirrorFixture.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/aggregates/Document/DocumentIntake.service.ts:96` `makeDocumentIntake` (const) - 1 example import violation(s)
- `src/aggregates/Document/FilingDecisionLlm.config.ts:199` `FilingDecisionLlmConfigValue` (class) - 1 example import violation(s)
- `src/aggregates/Document/FilingTextExtraction.ts:70` `FilingTextExtractionShape` (interface) - 1 example import violation(s)
- `src/aggregates/Sync/DmsMirrorFixture.ts:213` `DmsMirrorFixtureHandleShape` (interface) - 1 example import violation(s)
- `src/aggregates/Sync/DmsMirrorFixture.ts:316` `makeDmsMirrorFixture` (const) - 1 example import violation(s)
- `src/aggregates/Sync/VaultSync.config.ts:98` `VaultSyncConfigValue` (class) - 1 example import violation(s)
- `src/aggregates/Sync/VaultSyncEngine.service.ts:419` `makeVaultSyncEngine` (const) - 1 example import violation(s)
- `src/entities/internal/RepoSupport.ts:110` `makeEntityStore` (const) - 1 example import violation(s)

### @beep/nlp-processing

Path: `packages/foundation/capability/nlp-processing`

Module findings:
- `src/Backend/Composition.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Backend/NLPBackend.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/AnnotatedTextGraph.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/EffectGraph.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Catalog.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Executor.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Operation.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/ResultStore.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/GraphOperations/Types.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/TextGraph.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/TypeClass.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/NLPService.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Backend/Composition.ts:127` `withFallback` (const) - 1 example import violation(s)
- `src/Backend/Composition.ts:217` `CachingOptions` (class) - 2 example import violation(s)
- `src/Backend/Composition.ts:277` `withCaching` (const) - 2 example import violation(s)
- `src/Backend/Composition.ts:389` `selectByCapability` (const) - 1 example import violation(s)
- `src/Backend/NLPBackend.ts:334` `NLPBackendShape` (interface) - 1 example import violation(s)
- `src/Backend/NLPBackend.ts:410` `supportsCapability` (const) - 1 example import violation(s)
- `src/Backend/NLPBackend.ts:455` `getSupportedCapabilities` (const) - 1 example import violation(s)
- `src/Backend/NLPBackend.ts:486` `notSupported` (const) - 1 example import violation(s)
- `src/Core/Tokenization.ts:103` `tokenize` (const) - 1 example import violation(s)
- `src/Core/Tokenization.ts:141` `sentences` (const) - 1 example import violation(s)
- `src/Core/Tokenization.ts:182` `tokenizeToDocument` (const) - 1 example import violation(s)
- `src/Core/Tokenization.ts:223` `tokenCount` (const) - 1 example import violation(s)
- `src/Graph/AnnotatedTextGraph.ts:386` `fromDocumentAnnotated` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:98` `generateNodeId` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:151` `NodeMetadata` (class) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:184` `GraphNode` (interface) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:262` `makeNode` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:329` `singleton` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:373` `addNode` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:435` `getNode` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:464` `getChildren` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:493` `getRoots` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:548` `cata` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:599` `GraphCoalgebra` (type) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:621` `ana` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:665` `map` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:719` `toArray` (const) - 1 example import violation(s)
- `src/Graph/EffectGraph.ts:759` `show` (const) - 1 example import violation(s)
- `src/Graph/GraphOperations/Executor.ts:515` `GraphExecutorLive` (const) - 1 example import violation(s)
- `src/Graph/GraphOperations/Executor.ts:548` `GraphExecutorTest` (const) - 1 example import violation(s)
- `src/Graph/GraphOperations/Operation.ts:59` `GraphOperation` (interface) - 1 example import violation(s)
- `src/Graph/GraphOperations/Operation.ts:103` `make` (const) - 1 example import violation(s)
- `src/Graph/GraphOperations/ResultStore.ts:184` `CacheStats` (class) - 1 example import violation(s)
- `src/Graph/GraphOperations/ResultStore.ts:365` `ResultStoreLive` (const) - 1 example import violation(s)
- `src/Graph/GraphOperations/ResultStore.ts:391` `ResultStoreTest` (const) - 1 example import violation(s)
- `src/Graph/GraphOperations/Types.ts:162` `ExecutionMetrics` (class) - 1 example import violation(s)
- `src/Graph/GraphOperations/Types.ts:268` `ConstantOperationCost` (class) - 1 example import violation(s)
- `src/Graph/GraphOperations/Types.ts:308` `LinearOperationCost` (class) - 1 example import violation(s)
- `src/Graph/GraphOperations/Types.ts:348` `LinearithmicOperationCost` (class) - 1 example import violation(s)
- `src/Graph/GraphOperations/Types.ts:388` `QuadraticOperationCost` (class) - 1 example import violation(s)
- `src/Graph/GraphOperations/Types.ts:433` `OperationCost` (const) - 1 example import violation(s)
- `src/Graph/GraphOperations/Types.ts:497` `OperationCost` (type) - 1 example import violation(s)
- `src/Graph/GraphOperations/Types.ts:718` `generateExecutionId` (const) - 1 example import violation(s)
- `src/Graph/GraphOperations/Types.ts:782` `makeOperationResult` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:143` `singleton` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:213` `fromDocument` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:284` `addChildren` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:390` `tokenizeNodes` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:496` `mapNodes` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:517` `filterNodes` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:552` `dfs` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:577` `bfs` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:602` `topo` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:619` `toArray` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:674` `findNodesByType` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:698` `getRoots` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:716` `getLeaves` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:742` `getChildren` (const) - 1 example import violation(s)
- `src/Graph/TextGraph.ts:826` `show` (const) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:60` `TextOperation` (interface) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:81` `makeOperation` (const) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:265` `foldableGraph` (const) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:303` `executeOperation` (const) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:347` `executeOperations` (const) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:411` `ForgetfulOperation` (interface) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:537` `collectData` (const) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:555` `depth` (const) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:677` `flatMap` (const) - 1 example import violation(s)
- `src/Graph/TypeClass.ts:927` `traverse` (const) - 1 example import violation(s)
- `src/NLPService.ts:52` `NLPServiceShape` (interface) - 1 example import violation(s)
- `src/NLPService.ts:124` `make` (const) - 1 example import violation(s)
- `src/NLPService.ts:179` `layer` (const) - 1 example import violation(s)
- `src/NLPService.ts:233` `processText` (const) - 1 example import violation(s)
- `src/NLPService.ts:284` `extractEntities` (const) - 1 example import violation(s)
- `src/NLPService.ts:335` `extractRelations` (const) - 1 example import violation(s)
- `src/NLPService.ts:388` `tagPartsOfSpeech` (const) - 1 example import violation(s)
- `src/Tools/ToolExport.ts:115` `ExportedToolError` (class) - 1 example import violation(s)
- `src/Tools/ToolExport.ts:197` `ExportedTool` (interface) - 1 example import violation(s)
- `src/Tools/ToolExport.ts:424` `exportTools` (const) - 1 example import violation(s)
- `src/Tools/index.ts:1038` `exportTools` (const) - 1 example import violation(s)

### @beep/anthropic

Path: `packages/drivers/anthropic`

Export findings:
- `src/Anthropic.config.ts:115` `ANTHROPIC_DEFAULT_MAX_TOKENS` (const) - 1 example import violation(s)
- `src/Anthropic.config.ts:250` `AnthropicLanguageModelOptions` (class) - 1 example import violation(s)
- `src/Anthropic.repair.ts:66` `ANTHROPIC_REPAIR_MAX_TOKENS` (const) - 1 example import violation(s)
- `src/Anthropic.repair.ts:143` `makeAnthropicRepairPlan` (const) - 1 example import violation(s)
- `src/Anthropic.repair.ts:189` `collectToolParamsJson` (const) - 1 example import violation(s)
- `src/Anthropic.repair.ts:266` `collectToolParamsJsonWithUsage` (const) - 1 example import violation(s)
- `src/Anthropic.repair.ts:332` `generateAnthropicToolJson` (const) - 1 example import violation(s)
- `src/Anthropic.service.ts:44` `AnthropicLive` (const) - 1 example import violation(s)
- `src/Anthropic.service.ts:78` `makeAnthropicLanguageModelLayer` (const) - 1 example import violation(s)
- `src/Anthropic.service.ts:113` `AnthropicLanguageModelLive` (const) - 1 example import violation(s)

### @beep/professional-desktop

Path: `apps/professional-desktop`

Module findings:
- `src/App.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ChatOrchestrator.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/UsageRecordSink.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ui/ChatApp.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ui/Composer.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ui/MessageView.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ui/Sidebar.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ui/StreamingBlocks.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ui/ThemeToggle.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ui/Thread.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ui/editor-state.atoms.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/chat/ui/layout.atoms.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/contradiction/ContradictionQaSeed.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/intake/VaultDirectoryPickerOrchestrator.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ontology/OntologyWorkspaceSeed.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/runtime/Layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/runtime/Migrations.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/runtime/Observability.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/runtime/Pglite.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/spikes/Graph3DSpike.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/sync/DmsMirrorDisconnected.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/transport/IpcChatClient.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/transport/IpcSpikePanel.tsx:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/transport/TauriIpcSocket.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/workspace/dock.atoms.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/epistemic-domain

Path: `packages/epistemic/domain`

Module findings:
- `src/entities/EdgeVersion/EdgeVersion.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ClaimLifecycle/ClaimLifecycle.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/EvidenceSpan/EvidenceSpan.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ExecutionGrant/ExecutionGrant.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ExecutionVerdict/ExecutionVerdict.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/GrantSet/GrantSet.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/values/Contradiction/Contradiction.model.ts:1400` `contradictionProposalDigest` (const) - 1 example import violation(s)
- `src/values/Contradiction/Contradiction.model.ts:1570` `contradictionCandidateDigest` (const) - 1 example import violation(s)
- `src/values/EvidenceSpan/EvidenceSpan.model.ts:47` `Confidence` (const) - 1 example import violation(s)
- `src/values/EvidenceSpan/EvidenceSpan.model.ts:72` `Confidence` (type) - 1 example import violation(s)
- `src/values/EvidenceSpan/EvidenceSpan.model.ts:162` `EvidenceSpan` (class) - 1 example import violation(s)
- `src/values/EvidenceSpan/EvidenceSpan.model.ts:222` `isEvidenceSpanInternallyConsistent` (const) - 1 example import violation(s)
- `src/values/EvidenceSpan/index.ts:30` `export * from "./EvidenceSpan.model.ts";` (re-export) - 1 example import violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.model.ts:480` `ExecutionDecisionContent` (type) - 1 example import violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.model.ts:536` `sealExecutionDecision` (const) - 2 example import violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.model.ts:577` `verifyExecutionDecisionHash` (const) - 2 example import violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.model.ts:782` `sealExecutionOutcome` (const) - 1 example import violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.model.ts:811` `verifyExecutionOutcomeHash` (const) - 1 example import violation(s)
- `src/values/GrantSet/GrantSet.model.ts:146` `FrozenGrantSet` (class) - 1 example import violation(s)
- `src/values/GrantSet/GrantSet.model.ts:279` `addGrant` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/values/GrantSet/GrantSet.model.ts:361` `freezeGrantSet` (const) - 1 example import violation(s)
- `src/values/GrantSet/GrantSet.model.ts:397` `verifyFrozenGrantSetDigest` (const) - 1 example import violation(s)
- `src/values/GrantSet/GrantSet.model.ts:425` `ExecutionRequestEvaluationOptions` (class) - 1 example import violation(s)
- `src/values/GrantSet/GrantSet.model.ts:493` `evaluateExecutionRequest` (const) - 1 example import violation(s); 1 documentation section/link violation(s)

### @beep/architecture-lab-use-cases

Path: `packages/architecture-lab/use-cases`

Export findings:
- `src/aggregates/WorkItem/WorkItem.repository.ts:228` `WorkItemRepositoryShape` (interface) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.repository.ts:272` `WorkItemRepository` (class) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.service.ts:157` `makeWorkItemUseCases` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.use-cases.ts:56` `WorkItemUseCasesShape` (interface) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.use-cases.ts:108` `WorkItemUseCases` (class) - 1 example import violation(s)
- `src/entities/Worker/Worker.repository.ts:225` `WorkerRepositoryShape` (interface) - 1 example import violation(s)
- `src/entities/Worker/Worker.repository.ts:265` `WorkerRepository` (class) - 1 example import violation(s)
- `src/entities/Worker/Worker.service.ts:115` `makeWorkerUseCases` (const) - 1 example import violation(s)
- `src/entities/Worker/Worker.use-cases.ts:44` `WorkerUseCasesShape` (interface) - 1 example import violation(s)
- `src/entities/Worker/Worker.use-cases.ts:86` `WorkerUseCases` (class) - 1 example import violation(s)

### @beep/firecrawl

Path: `packages/drivers/firecrawl`

Export findings:
- `src/Firecrawl.config.ts:128` `FirecrawlConfigInput` (class) - 1 example import violation(s)
- `src/Firecrawl.service.ts:753` `Firecrawl` (class) - 1 example import violation(s)

### @beep/ecfr

Path: `packages/drivers/ecfr`

Module findings:
- `src/Ecfr.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/_generated/Ecfr.gen.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Ecfr.errors.ts:81` `EcfrErrorOptions` (class) - 1 example import violation(s)
- `src/Ecfr.service.ts:144` `EcfrSearchParams` (class) - 1 example import violation(s)
- `src/Ecfr.service.ts:286` `EcfrShape` (interface) - 1 example import violation(s)
- `src/Ecfr.service.ts:528` `Ecfr` (class) - 1 example import violation(s)

### @beep/acp

Path: `packages/drivers/acp`

Export findings:
- `src/AcpAgent.service.ts:221` `AcpAgent` (class) - 1 example import violation(s)
- `src/AcpClient.service.ts:291` `AcpClient` (class) - 1 example import violation(s)
- `src/AcpProtocol.service.ts:48` `AcpUnknownExtRequestHandler` (type) - 1 example import violation(s)
- `src/AcpProtocol.service.ts:69` `AcpUnknownExtNotificationHandler` (type) - 1 example import violation(s)
- `src/AcpProtocol.service.ts:95` `AcpExtensionRegistrars` (interface) - 1 example import violation(s)
- `src/AcpProtocol.service.ts:484` `makeAcpPatchedProtocol` (const) - 2 example import violation(s)

### @beep/nlp

Path: `packages/foundation/modeling/nlp`

Module findings:
- `src/Algebra/NLPMonoid.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/GraphOps.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph/Schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Handoff/Contract.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Handoff/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Ontology/Kind.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Operations/Composable.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Operations/Definition.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Operations/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Algebra/Monoid.ts:387` `MultiSet` (const) - 1 example import violation(s)
- `src/Core/Document.ts:200` `Document` (class) - 1 example import violation(s)
- `src/Core/Pattern.ts:525` `Pattern` (class) - 1 example import violation(s)
- `src/Core/PatternBuilders.ts:275` `withMark` (const) - 1 example import violation(s)
- `src/Core/PatternBuilders.ts:299` `withoutMark` (const) - 1 example import violation(s)
- `src/Core/PatternBuilders.ts:412` `getMark` (const) - 1 example import violation(s)
- `src/Core/Sentence.ts:114` `Sentence` (class) - 1 example import violation(s)
- `src/Graph/GraphOps.ts:788` `traverseNodes` (const) - 1 example import violation(s)
- `src/Graph/GraphOps.ts:834` `traverseNodesCollect` (const) - 1 example import violation(s)
- `src/Graph/GraphOps.ts:881` `mapNodesEffect` (const) - 1 example import violation(s)
- `src/Graph/GraphOps.ts:941` `streamNodes` (const) - 1 example import violation(s)
- `src/Graph/GraphOps.ts:968` `streamNodesWithIndex` (const) - 1 example import violation(s)
- `src/Graph/GraphOps.ts:995` `batchNodes` (const) - 1 example import violation(s)
- `src/Handoff/Contract.ts:234` `Span` (const) - 1 example import violation(s)
- `src/Handoff/Contract.ts:276` `Span` (type) - 1 example import violation(s)
- `src/Handoff/Contract.ts:347` `TextChunk` (class) - 1 example import violation(s)
- `src/Handoff/Contract.ts:383` `Mention` (class) - 1 example import violation(s)
- `src/Operations/Composable.ts:53` `NLPOperation` (type) - 1 example import violation(s)
- `src/Operations/Composable.ts:79` `OperationBuilder` (class) - 1 example import violation(s)
- `src/Operations/Composable.ts:280` `makeOperation` (const) - 1 example import violation(s)
- `src/Operations/Composable.ts:325` `fromDefinition` (const) - 1 example import violation(s)
- `src/Operations/Composable.ts:353` `makePureOperation` (const) - 1 example import violation(s)
- `src/Operations/Composable.ts:393` `map` (const) - 1 example import violation(s)
- `src/Operations/Composable.ts:434` `product` (const) - 1 example import violation(s)
- `src/Operations/Composable.ts:476` `zipWith` (const) - 1 example import violation(s)
- `src/Operations/Composable.ts:523` `compose` (const) - 1 example import violation(s)
- `src/Operations/Composable.ts:555` `identity` (const) - 1 example import violation(s)
- `src/Operations/Composable.ts:577` `traverse` (const) - 1 example import violation(s)
- `src/Operations/Definition.ts:49` `OperationDefinition` (interface) - 1 example import violation(s)
- `src/Operations/Definition.ts:82` `OperationInput` (type) - 1 example import violation(s)
- `src/Operations/Definition.ts:109` `OperationOutput` (type) - 1 example import violation(s)
- `src/index.ts:23` `export * as Algebra from "./Algebra/index.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:38` `export * as Core from "./Core/index.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:53` `export * as Graph from "./Graph/index.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:69` `export * as Handoff from "./Handoff/index.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:85` `export * as IdentifierText from "./IdentifierText.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:100` `export * as Ontology from "./Ontology/index.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:116` `export * as PathText from "./PathText.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:132` `export * as QueryText from "./QueryText.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:148` `export * as VariantText from "./VariantText.ts";` (re-export) - 1 example import violation(s)

### @beep/infra

Path: `infra`

Module findings:
- `src/CiFleetController.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/CiRunners.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/CiFleetController.ts:582` `CiFleetControllerPulumiConfigValues` (const) - missing @example
- `src/CiFleetController.ts:618` `CiFleetControllerConfig` (class) - missing @example
- `src/CiFleetController.ts:644` `makeCiFleetControllerConfig` (const) - missing @example
- `src/CiFleetController.ts:668` `loadCiFleetControllerConfig` (const) - missing @example
- `src/OpenClaw.ts:402` `OpenClawExpectedIdentity` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:572` `OpenClawDeploymentConfig` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:769` `OpenClawBackupConfig` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:829` `OpenClawGeneration` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1163` `makeOpenClawGeneration` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1239` `renderOpenClawUnit` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1310` `renderOpenClawRunScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1409` `renderOpenClawGenerationTree` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1472` `renderOpenClawPreflightScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1600` `renderOpenClawStageScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1729` `renderOpenClawApplyScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1848` `renderOpenClawRollbackScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:1996` `renderOpenClawDriftAuditScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2049` `renderOpenClawProbeScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2121` `renderOpenClawLiveAcceptanceScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2218` `renderOpenClawBackupShipScript` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2282` `OpenClawStackArgs` (class) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2366` `makeOpenClawStackArgsFromConfigValues` (const) - 1 documentation section/link violation(s)
- `src/OpenClaw.ts:2569` `OpenClawStack` (class) - 1 documentation section/link violation(s)

### @beep/runpod

Path: `packages/drivers/runpod`

Export findings:
- `src/RunpodDocs.service.ts:281` `parseRunpodDocsIndex` (const) - 1 example import violation(s)

### @beep/fc-runs

Path: `packages/tooling/test-kit/fc-runs`

Module findings:
- `src/FastCheckRuns.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/repo-utils

Path: `packages/tooling/library/repo-utils`

Module findings:
- `src/Dependencies.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/DependencyIndex.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/FsUtils.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Graph.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/JSDoc/models/TagValue.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/JsonUtils.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ProcessArgs.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Root.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/TsConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/UniqueDeps.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Workspaces.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/errors/CyclicDependencyError.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/errors/DomainError.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/errors/NoSuchFileError.ts:1` (jsdoc) - 1 documentation section/link violation(s)
- `src/errors/OptionInjectionError.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/schemas/PackageJson.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/schemas/TSConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/schemas/WorkspaceDeps.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Dependencies.ts:79` `extractWorkspaceDependencies` (const) - 1 example import violation(s)
- `src/DependencyIndex.ts:56` `buildRepoDependencyIndex` (const) - 1 example import violation(s)
- `src/FsUtils.ts:177` `FsUtils` (class) - 1 example import violation(s)
- `src/FsUtils.ts:195` `FsUtilsLive` (const) - 1 example import violation(s)
- `src/FsUtils.ts:429` `walkFiles` (const) - 1 example import violation(s)
- `src/FsUtils.ts:528` `exists` (const) - 1 example import violation(s)
- `src/FsUtils.ts:570` `findNearestPackageDir` (const) - 1 example import violation(s)
- `src/Graph.ts:104` `topologicalSort` (const) - 1 example import violation(s)
- `src/Graph.ts:158` `detectCycles` (const) - 1 example import violation(s)
- `src/Graph.ts:309` `computeTransitiveClosure` (const) - 1 example import violation(s)
- `src/JSDoc/models/CanonicalJSDocSourceMetadata.model.ts:33` `CanonicalJSDocSourceMetadata` (class) - 1 example import violation(s)
- `src/JsonUtils.ts:39` `jsonStringifyPretty` (const) - 1 example import violation(s)
- `src/JsonUtils.ts:67` `jsonStringifyCompact` (const) - 1 example import violation(s)
- `src/JsonUtils.ts:94` `jsonParse` (const) - 1 example import violation(s)
- `src/Root.ts:46` `findRepoRoot` (const) - 1 example import violation(s)
- `src/TSMorph/TSMorph.service.ts:391` `TSMorphService` (class) - 1 example import violation(s)
- `src/TSMorph/TSMorph.service.ts:697` `createTSMorphService` (const) - 1 example import violation(s)
- `src/TSMorph/TSMorph.service.ts:1367` `TSMorphServiceLive` (const) - 1 example import violation(s)
- `src/TsConfig.ts:51` `collectTsConfigPaths` (const) - 1 example import violation(s)
- `src/Workspaces.ts:120` `resolveWorkspaceDirs` (const) - 1 example import violation(s)
- `src/Workspaces.ts:227` `getWorkspaceDir` (const) - 1 example import violation(s)
- `src/Workspaces.ts:303` `resolveWorkspacePackages` (const) - 1 example import violation(s)
- `src/schemas/BiomeJson.ts:60` `renderBiomeJson` (const) - 1 example import violation(s)
- `src/schemas/DocgenConfig.ts:457` `createCanonicalDocgenConfig` (const) - 1 example import violation(s)
- `src/schemas/PackageJson.ts:1778` `decodePackageJsonEffect` (const) - 1 example import violation(s)
- `src/schemas/PackageJson.ts:1811` `encodePackageJsonEffect` (const) - 1 example import violation(s)
- `src/schemas/PackageJson.ts:1841` `encodePackageJsonToJsonEffect` (const) - 1 example import violation(s)
- `src/schemas/PackageJson.ts:1876` `encodePackageJsonPrettyEffect` (const) - 1 example import violation(s)
- `src/schemas/PackageJson.ts:1910` `readPackageJsonFile` (const) - 1 example import violation(s)
- `src/schemas/PackageJsonTools.ts:341` `normalizePackageJsonEffect` (const) - 1 example import violation(s)
- `src/schemas/PackageJsonTools.ts:453` `getPackageJsonSchemaIssues` (const) - 1 example import violation(s)
- `src/schemas/TSConfig.ts:1959` `decodeTSConfigEffect` (const) - 1 example import violation(s)
- `src/schemas/TSConfig.ts:1993` `decodeTSConfigFromJsoncTextEffect` (const) - 1 example import violation(s)
- `src/schemas/TSConfig.ts:2022` `encodeTSConfigEffect` (const) - 1 example import violation(s)
- `src/schemas/TSConfig.ts:2045` `encodeTSConfigToJsonEffect` (const) - 1 example import violation(s)
- `src/schemas/TSConfig.ts:2073` `encodeTSConfigPrettyEffect` (const) - 1 example import violation(s)

### @beep/documents-domain

Path: `packages/documents/domain`

Export findings:
- `src/values/Taxonomy/Taxonomy.projection.ts:232` `projectFiledDocumentPath` (const) - 1 example import violation(s)
- `src/values/Taxonomy/Taxonomy.projection.ts:309` `projectInboxDocumentPath` (const) - 1 example import violation(s)
- `src/values/Taxonomy/Taxonomy.projection.ts:340` `projectIntakeInboxPath` (const) - 1 example import violation(s)

### @beep/schema

Path: `packages/foundation/modeling/schema`

Module findings:
- `src/BigDecimal.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Color/Color.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/CryptoTxnHash/CryptoTxnHash.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/CryptoWalletAddress/CryptoWalletAddress.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EffectSchema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EthAmount/EthAmount.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EthereumValidatorPublicKey/EthereumValidatorPublicKey.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EvmAddress/EvmAddress.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/FileInfo.ts:1` (packageDocumentation) - 1 example import violation(s)
- `src/Float16Array.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Float32Array.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Float64Array.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Fn/Fn.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/JSONSchema/JSONSchema.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/JSONSchema/JSONSchema.shared.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/LiteralKit/LiteralKit.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/LocalDate/LocalDate.schema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Options.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Percentage.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PromiseSchema.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SafeObject/index.ts:1` (packageDocumentation) - 1 example import violation(s)
- `src/SchemaUtils/pluck.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SchemaUtils/split.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SchemaUtils/withConstructorDefaults.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Semver.ts:1` (packageDocumentation) - 1 example import violation(s)
- `src/UnitInterval.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/ArrayBuffer.ts:98` `ArrayBuf` (const) - 2 example import violation(s)
- `src/AtURI.ts:231` `AtUri` (const) - 1 example import violation(s)
- `src/AtURI.ts:294` `AtUri` (type) - 1 example import violation(s)
- `src/AtURI.ts:317` `AtUri` (namespace) - 1 example import violation(s)
- `src/Bytes.ts:50` `Bytes` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.annotations.ts:138` `Annotation` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.annotations.ts:189` `makeAnnotationResult` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.collector.ts:43` `collectConformanceAnnotationsResult` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.invariant.schema.ts:231` `InvariantEnforcement` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.invariant.schema.ts:350` `InvariantDescriptor` (class) - 1 example import violation(s)
- `src/Conformance/Conformance.policy.schema.ts:80` `ConformancePolicy` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.profile.schema.ts:67` `ConformanceProfile` (class) - 1 example import violation(s)
- `src/Conformance/Conformance.report.schema.ts:77` `ConformanceIssue` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.report.schema.ts:223` `ConformanceReport` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.source.schema.ts:36` `GitObjectId` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.source.schema.ts:81` `SpecificationDate` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.source.schema.ts:233` `SpecificationRevision` (const) - 1 example import violation(s)
- `src/Conformance/Conformance.source.schema.ts:283` `SpecificationSource` (class) - 1 example import violation(s)
- `src/Conformance/Conformance.source.schema.ts:323` `SpecificationReference` (class) - 1 example import violation(s)
- `src/CrossOriginOpenerPolicy/CrossOriginOpenerPolicy.schema.ts:156` `CrossOriginOpenerPolicyHeader` (const) - 1 example import violation(s)
- `src/CrossOriginOpenerPolicy/CrossOriginOpenerPolicy.schema.ts:256` `Header` (const) - 1 example import violation(s)
- `src/Csp/Csp.schema.ts:955` `ContentSecurityPolicyHeader` (const) - 1 example import violation(s)
- `src/Csp/Csp.schema.ts:1063` `Header` (const) - 1 example import violation(s)
- `src/Csv/Csv.schema.ts:72` `CsvDocument` (type) - 1 example import violation(s)
- `src/Csv/Csv.schema.ts:315` `Csv` (const) - 1 example import violation(s)
- `src/Csv/Csv.schema.ts:315` `CSV` (const) - 1 example import violation(s)
- `src/Csv/Csv.schema.ts:381` `CSV` (type) - 1 example import violation(s)
- `src/Csv/Csv.schema.ts:315` `Schema` (const) - 1 example import violation(s)
- `src/Csv/Csv.schema.ts:403` `Schema` (type) - 1 example import violation(s)
- `src/CsvFormatter/CsvFormatter.formatter.ts:112` `formatCsvHeaderRow` (const) - 1 example import violation(s)
- `src/CsvFormatter/CsvFormatter.formatter.ts:148` `formatCsvDataRow` (const) - 1 example import violation(s)
- `src/CsvFormatter/CsvFormatter.formatter.ts:186` `formatCsvDocument` (const) - 1 example import violation(s)
- `src/CsvFormatter/CsvFormatter.formatter.ts:186` `format` (const) - 1 example import violation(s)
- `src/CsvParser/CsvParser.parser.ts:415` `parseCsvRows` (const) - 1 example import violation(s)
- `src/CsvParser/CsvParser.parser.ts:415` `parse` (const) - 1 example import violation(s)
- `src/Cuid.ts:40` `sha512` (const) - 1 example import violation(s)
- `src/Cuid.ts:158` `CuidState` (class) - 1 example import violation(s)
- `src/Cuid.ts:213` `cuid` (const) - 1 example import violation(s)
- `src/Did.ts:79` `Did` (const) - 1 example import violation(s)
- `src/Did.ts:112` `Did` (type) - 1 example import violation(s)
- `src/Did.ts:135` `Did` (namespace) - 1 example import violation(s)
- `src/Double.ts:58` `Double` (const) - 1 example import violation(s)
- `src/Duration/Duration.input.ts:289` `DurationFromInput` (const) - 1 example import violation(s)
- `src/Duration/Duration.input.ts:320` `DurationFromInput` (type) - 1 example import violation(s)
- `src/Duration/Duration.schema.ts:31` `Schema` (const) - 1 example import violation(s)
- `src/Duration/Duration.schema.ts:50` `Schema` (type) - 1 example import violation(s)
- `src/Duration/Duration.schema.ts:69` `Duration` (const) - 1 example import violation(s)
- `src/Duration/Duration.schema.ts:88` `Duration` (type) - 1 example import violation(s)
- `src/EffectSchema.ts:60` `isEffect` (const) - 1 example import violation(s)
- `src/EffectSchema.ts:85` `EffectSchema` (const) - 1 example import violation(s)
- `src/Email.ts:33` `EmailString` (const) - 1 example import violation(s)
- `src/Email.ts:52` `EmailString` (type) - 2 example import violation(s)
- `src/Email.ts:76` `Email` (const) - 1 example import violation(s)
- `src/Email.ts:96` `Email` (type) - 1 example import violation(s)
- `src/FileDiff.schema.ts:52` `Added` (class) - 2 example import violation(s)
- `src/FileDiff.schema.ts:86` `Deleted` (class) - 2 example import violation(s)
- `src/FileDiff.schema.ts:121` `Modified` (class) - 2 example import violation(s)
- `src/FileDiff.schema.ts:155` `Info` (const) - 2 example import violation(s)
- `src/FileDiff.schema.ts:177` `Info` (type) - 1 example import violation(s)
- `src/FileDiff.schema.ts:195` `Info` (namespace) - 1 example import violation(s)
- `src/FileInfo.ts:146` `FileInfo` (const) - 1 example import violation(s)
- `src/FileInfo.ts:183` `FileInfo` (type) - 1 example import violation(s)
- `src/Fixed32.ts:68` `Fixed32` (const) - 1 example import violation(s)
- `src/Fixed64.ts:58` `Fixed64` (const) - 1 example import violation(s)
- `src/Float.ts:63` `Float` (const) - 1 example import violation(s)
- `src/Fn/Fn.schema.ts:523` `ThunkOf` (function) - 3 example import violation(s)
- `src/Fn/Fn.schema.ts:593` `Fn` (function) - 5 example import violation(s)
- `src/Fn/Fn.schema.ts:476` `AnyFn` (const) - 1 example import violation(s)
- `src/Fn/Fn.schema.ts:498` `AnyFn` (type) - 1 example import violation(s)
- `src/Graph/Graph.edge.ts:228` `Edge` (const) - 1 example import violation(s)
- `src/Graph/Graph.guards.ts:32` `isEdge` (const) - 1 example import violation(s)
- `src/Graph/Graph.guards.ts:52` `isGraph` (const) - 1 example import violation(s)
- `src/Graph/Graph.rebuild.ts:83` `rebuildImmutableGraph` (const) - 1 example import violation(s)
- `src/Graph/Graph.rebuild.ts:146` `rebuildMutableGraph` (const) - 1 example import violation(s)
- `src/Graph/Graph.shared.ts:239` `toRawEdgeEncoded` (const) - 1 example import violation(s)
- `src/Graph/Graph.shared.ts:265` `toRawGraphEncoded` (const) - 1 example import violation(s)
- `src/Graph/Graph.shared.ts:312` `formatGraph` (const) - 1 example import violation(s)
- `src/Graph/Graph.shared.ts:387` `makeGraphEquivalence` (const) - 1 example import violation(s)
- `src/Graph/Graph.shared.ts:463` `isImmutableGraphValue` (const) - 1 example import violation(s)
- `src/Graph/Graph.shared.ts:483` `isMutableGraphValue` (const) - 1 example import violation(s)
- `src/Http/Http.headers.shared.ts:275` `makeHeaderEncodeForbidden` (const) - 1 example import violation(s)
- `src/HttpStatus/HttpStatus.shared.ts:26` `$I` (const) - 1 example import violation(s)
- `src/Int64.ts:124` `Int64FromString` (const) - 1 example import violation(s)
- `src/Json.ts:117` `decodeJsonString` (const) - 1 example import violation(s)
- `src/Json.ts:139` `encodeJsonString` (const) - 1 example import violation(s)
- `src/Jsonc.ts:94` `JsoncTextToUnknown` (const) - 1 example import violation(s)
- `src/Jsonc.ts:139` `decodeJsoncTextAs` (const) - 1 example import violation(s)
- `src/Jsonl.ts:107` `JsonlTextToUnknown` (const) - 1 example import violation(s)
- `src/Jsonl.ts:151` `decodeJsonlTextAs` (const) - 1 example import violation(s)
- `src/KebabStr.ts:29` `KebabCaseStr` (const) - 1 example import violation(s)
- `src/KebabStr.ts:64` `KebabCaseStr` (type) - 2 example import violation(s)
- `src/LiteralKit/LiteralKit.schema.ts:730` `LiteralKit` (function) - 1 example import violation(s)
- `src/LocalDate/LocalDate.schema.ts:239` `fromString` (const) - 1 example import violation(s)
- `src/LocalDate/LocalDate.schema.ts:317` `todayEffect` (const) - 1 example import violation(s)
- `src/LocalDate/LocalDate.schema.ts:338` `fromDateTime` (const) - 1 example import violation(s)
- `src/Markdown.ts:182` `MarkdownTextToHtml` (const) - 1 example import violation(s)
- `src/Markdown.ts:220` `decodeMarkdownTextAs` (const) - 1 example import violation(s)
- `src/MutableHashMap.ts:113` `MutableHashMapFromSelf` (interface) - 1 example import violation(s)
- `src/MutableHashMap.ts:196` `MutableHashMapFromSelf` (const) - 1 example import violation(s)
- `src/MutableHashMap.ts:170` `isMutableHashMap` (const) - 1 example import violation(s)
- `src/MutableHashSet.ts:83` `MutableHashSetFromSelf` (interface) - 1 example import violation(s)
- `src/MutableHashSet.ts:161` `MutableHashSetFromSelf` (const) - 1 example import violation(s)
- `src/MutableHashSet.ts:135` `isMutableHashSet` (const) - 1 example import violation(s)
- `src/NoSniff/NoSniff.schema.ts:152` `NoSniffHeader` (const) - 1 example import violation(s)
- `src/NoSniff/NoSniff.schema.ts:254` `Header` (const) - 1 example import violation(s)
- `src/Opaque.ts:52` `Defect` (const) - 2 example import violation(s)
- `src/Opaque.ts:92` `OpaqueUnknown` (const) - 2 example import violation(s)
- `src/Opaque.ts:114` `OpaqueUnknown` (type) - 1 example import violation(s)
- `src/Options.ts:89` `OptionFromOptionalNullishKey` (function) - 2 example import violation(s)
- `src/PascalStr.ts:29` `PascalCaseStr` (const) - 1 example import violation(s)
- `src/PascalStr.ts:64` `PascalCaseStr` (type) - 2 example import violation(s)
- `src/Port.ts:71` `Port` (const) - 1 example import violation(s)
- `src/Port.ts:125` `PortFromString` (const) - 1 example import violation(s)
- `src/Port.ts:152` `PortFromString` (type) - 1 example import violation(s)
- `src/Record/Record.schema.ts:31` `UnknownRecord` (const) - 1 example import violation(s)
- `src/Record/Record.schema.ts:53` `UnknownRecord` (type) - 1 example import violation(s)
- `src/RegExp.ts:108` `RegExpFromStr` (const) - 1 example import violation(s)
- `src/RegExp.ts:138` `RegExpFromStr` (type) - 1 example import violation(s)
- `src/SafeObject/SafeObject.schema.ts:40` `SafeObject` (const) - 1 example import violation(s)
- `src/SafeObject/SafeObject.schema.ts:93` `SafeObjectFromObjectKeyword` (const) - 1 example import violation(s)
- `src/SafeObject/SafeObject.schema.ts:40` `Schema` (const) - 1 example import violation(s)
- `src/SafeRemoteHost.ts:92` `BlockedHostError` (class) - 1 example import violation(s)
- `src/SafeRemoteHost.ts:278` `isBlockedRemoteHost` (const) - 1 example import violation(s)
- `src/SafeRemoteHost.ts:323` `assertAllowedRemoteHost` (const) - 1 example import violation(s)
- `src/SafeRemoteHost.ts:388` `assertAllowedRemoteUrl` (const) - 1 example import violation(s)
- `src/SchemaUtils/encoders.ts:59` `encodeEffect` (const) - 1 example import violation(s)
- `src/SchemaUtils/encoders.ts:116` `encodeUnknownEffect` (const) - 1 example import violation(s)
- `src/SchemaUtils/optional.ts:47` `optional` (const) - 1 example import violation(s)
- `src/SchemaUtils/toEquivalence.ts:70` `toEquivalence` (const) - 1 example import violation(s)
- `src/SchemaUtils/withCodecStatics.ts:422` `withCodecStatics` (const) - 1 example import violation(s)
- `src/SchemaUtils/withKeyDefaults.ts:120` `withEmptyArrayDefaults` (function) - 1 example import violation(s)
- `src/SecureHeaderError/SecureHeaderError.errors.ts:403` `SecureHeaderError` (type) - 1 example import violation(s)
- `src/SecureHeaderError/SecureHeaderError.errors.ts:403` `Error` (type) - 1 example import violation(s)
- `src/SecureHeaderOptions/SecureHeaderOptions.schema.ts:168` `createHeadersObject` (const) - 1 example import violation(s)
- `src/SecureHeaderOptions/SecureHeaderOptions.schema.ts:200` `createSecureHeaders` (const) - 1 example import violation(s)
- `src/SemanticVersion.ts:57` `SemanticVersionSchema` (interface) - 1 documentation section/link violation(s)
- `src/Semver.ts:648` `SemverFromString` (const) - 1 example import violation(s)
- `src/Sfixed32.ts:68` `Sfixed32` (const) - 1 example import violation(s)
- `src/Sfixed64.ts:58` `Sfixed64` (const) - 1 example import violation(s)
- `src/Sha256.ts:116` `Sha256HexFromBytes` (const) - 1 example import violation(s)
- `src/Sha256.ts:149` `Sha256HexFromBytes` (type) - 1 example import violation(s)
- `src/Sha256.ts:172` `Sha256HexFromHexBytes` (const) - 1 example import violation(s)
- `src/Sha256.ts:199` `Sha256HexFromHexBytes` (type) - 1 example import violation(s)
- `src/Sint32.ts:68` `Sint32` (const) - 1 example import violation(s)
- `src/Sint64.ts:58` `Sint64` (const) - 1 example import violation(s)
- `src/SnakeStr.ts:29` `SnakeCaseStr` (const) - 1 example import violation(s)
- `src/SnakeStr.ts:64` `SnakeCaseStr` (type) - 2 example import violation(s)
- `src/StatusCauseError.ts:48` `StatusCauseFields` (const) - 1 example import violation(s)
- `src/StatusCauseError.ts:228` `makeStatusCauseError` (const) - 1 example import violation(s)
- `src/String.ts:241` `StrFromUnknown` (const) - 1 example import violation(s)
- `src/String.ts:271` `StrFromUnknown` (type) - 1 example import violation(s)
- `src/String.ts:290` `OptionFromOptionalStrWithNoneDefault` (const) - 1 example import violation(s)
- `src/Timestamp/Timestamp.schema.ts:335` `fromDateTime` (const) - 1 example import violation(s)
- `src/Timestamp/Timestamp.schema.ts:373` `fromString` (const) - 1 example import violation(s)
- `src/Timestamp/Timestamp.schema.ts:418` `nowEffect` (const) - 1 example import violation(s)
- `src/Toml.ts:84` `TomlTextToUnknown` (const) - 1 example import violation(s)
- `src/Toml.ts:125` `decodeTomlTextAs` (const) - 1 example import violation(s)
- `src/Transformations.ts:49` `destructiveTransform` (const) - 1 example import violation(s)
- `src/Uint32.ts:68` `Uint32` (const) - 1 example import violation(s)
- `src/Uint64.ts:58` `Uint64` (const) - 1 example import violation(s)
- `src/Unknown.ts:43` `Unknown` (const) - 1 example import violation(s)
- `src/Unknown.ts:75` `UnknownFromJsonString` (const) - 2 example import violation(s)
- `src/Xml.ts:86` `XmlTextToUnknown` (const) - 1 example import violation(s)
- `src/Xml.ts:130` `decodeXmlTextAs` (const) - 1 example import violation(s)
- `src/Yaml.ts:86` `YamlTextToUnknown` (const) - 1 example import violation(s)
- `src/Yaml.ts:127` `decodeYamlTextAs` (const) - 1 example import violation(s)
- `src/index.ts:226` `export * as HttpMethod from "./HttpMethod/index.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:262` `export * as JSONSchema from "./JSONSchema/index.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:362` `export * from "./Port.ts";` (re-export) - 2 example import violation(s)
- `src/index.ts:407` `export { SafeObject, SafeObjectFromObjectKeyword } from "./SafeObject/index.ts";` (re-export) - 2 example import violation(s)

### @beep/epistemic-server

Path: `packages/epistemic/server`

Module findings:
- `src/ClaimDisposition/ClaimDisposition.repo.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EdgeAuthority/EdgeAuthority.repo.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ExecutionLedger/ExecutionLedger.repo.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/GovernedEgress/GovernedEgress.fetch.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/GovernedEgress/GovernedEgress.layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/ClaimDisposition/ClaimDisposition.repo.ts:80` `makeInMemoryClaimDispositionRepository` (const) - 1 example import violation(s)
- `src/ClaimDisposition/ClaimDisposition.repo.ts:119` `makeDrizzleClaimDispositionRepository` (const) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.layer.ts:388` `ContradictionTriageRepositoryDrizzle` (const) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.layer.ts:408` `ContradictionTriageServiceLive` (const) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.layer.ts:428` `ContradictionTriageRepositoryFixture` (const) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.repo.ts:434` `makeDrizzleContradictionTriageRepository` (const) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.rpc-handlers.ts:27` `ContradictionHandlersLive` (const) - 1 example import violation(s)
- `src/EdgeAuthority/EdgeAuthority.repo.ts:406` `makeDrizzleEdgeAuthorityRepository` (const) - 1 example import violation(s)
- `src/ExecutionLedger/ExecutionLedger.repo.ts:85` `makeDrizzleExecutionLedger` (const) - 1 example import violation(s)
- `src/GovernedEgress/GovernedEgress.fetch.ts:119` `GovernedEgressOptions` (class) - 1 example import violation(s)
- `src/GovernedEgress/GovernedEgress.fetch.ts:212` `makeGovernedEgressFetch` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/GovernedEgress/GovernedEgress.layer.ts:64` `GovernedEgressLiveOptions` (interface) - 1 example import violation(s)
- `src/GovernedEgress/GovernedEgress.layer.ts:99` `GovernedEgressLive` (const) - 1 example import violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:124` `GovernedTierGateOptions` (class) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:181` `refusalGuidance` (const) - 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.gate.ts:238` `makeGovernedTierGate` (const) - 1 example import violation(s); 1 documentation section/link violation(s)
- `src/GovernedTierGate/GovernedTierGate.layer.ts:52` `GovernedTierGateLive` (const) - 1 example import violation(s)
- `src/ShaclValidation/BoundedShaclValidator.layer.ts:81` `BoundedShaclValidationServiceLive` (const) - 1 example import violation(s)

### @beep/box-provisioning

Path: `packages/drivers/box-provisioning`

Export findings:
- `src/BoxProvisioning.ts:174` `BoxProvisioning` (class) - 1 example import violation(s)
- `src/BoxProvisioningErrors.ts:140` `BoxProvisioningDriftError` (class) - 1 example import violation(s)
- `src/BoxProvisioningIntent.ts:508` `BoxWebhookIntent` (class) - 1 example import violation(s)
- `src/BoxProvisioningObserved.ts:322` `BoxObservedWebhook` (class) - 1 example import violation(s)
- `src/BoxProvisioningPlan.ts:397` `BoxForeignResource` (class) - 1 example import violation(s)
- `src/BoxProvisioningPlanner.ts:705` `BoxProvisioningPlanner` (class) - 1 example import violation(s)
- `src/BoxProvisioningReceipt.ts:313` `BoxActionApplied` (class) - 1 example import violation(s)
- `src/BoxProvisioningReceipt.ts:342` `BoxActionSkipped` (class) - 1 example import violation(s)
- `src/BoxProvisioningReceipt.ts:369` `BoxActionBlocked` (class) - 1 example import violation(s)
- `src/BoxProvisioningReceipt.ts:427` `BoxApplyReceipt` (class) - 2 example import violation(s)

### @beep/rdf

Path: `packages/foundation/modeling/rdf`

Module findings:
- `src/Vocab/Dcterms.ts:1` (jsdoc) - 1 documentation section/link violation(s)

Export findings:
- `src/Iri.ts:939` `IRIReference` (const) - 1 example import violation(s)
- `src/Iri.ts:987` `RelativeIRIReference` (const) - 1 example import violation(s)
- `src/Iri.ts:1032` `AbsoluteIRI` (const) - 1 example import violation(s)
- `src/Iri.ts:1077` `IRI` (const) - 1 example import violation(s)
- `src/SemanticSchemaMetadata/SemanticSchemaMetadata.annotations.ts:62` `makeSemanticSchemaMetadataResult` (const) - 1 example import violation(s)
- `src/SemanticSchemaMetadata/SemanticSchemaMetadata.annotations.ts:162` `collectSemanticSchemaMetadataResult` (const) - 1 example import violation(s)
- `src/SemanticSchemaMetadata/SemanticSchemaMetadata.annotations.ts:221` `getSemanticSchemaMetadataResult` (const) - 1 example import violation(s)
- `src/Vocab/Xsd.ts:27` `XSD_NAMESPACE` (const) - 1 documentation section/link violation(s)

### @beep/onepassword-cli

Path: `packages/drivers/onepassword-cli`

Export findings:
- `src/OnePasswordCli.models.ts:124` `OnePasswordCliDiagnosticText` (const) - 1 example import violation(s)
- `src/OnePasswordCli.service.ts:45` `OnePasswordCliRunner` (type) - 1 example import violation(s)

### @beep/architecture-lab-config

Path: `packages/architecture-lab/config`

Export findings:
- `src/aggregates/WorkItem/WorkItem.layer.ts:110` `WorkItemConfig` (class) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.layer.ts:190` `ArchitectureLabConfigLive` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.layer.ts:217` `ArchitectureLabConfigTest` (const) - 1 example import violation(s)

### @beep/govinfo

Path: `packages/drivers/govinfo`

Module findings:
- `src/Govinfo.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/domain/contracts/Api.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Govinfo.config.ts:128` `GovinfoConfigInput` (class) - 1 example import violation(s)
- `src/Govinfo.service.ts:64` `GovinfoShape` (interface) - 2 example import violation(s)
- `src/Govinfo.service.ts:165` `Govinfo` (class) - 1 example import violation(s)

### @beep/data

Path: `packages/foundation/primitive/data`

Module findings:
- `src/Calendar.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/CurrencyCodes.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/KeyboardShortcuts.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Timezones.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/generated/cldr-territories.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/generated/iana-media-types.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/generated/iana-timezones.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/generated/iso4217.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Blockchain.ts:26` `Networks` (const) - 1 example import violation(s)
- `src/MimeTypes.ts:36` `MimeType` (type) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:192` `FileExtension` (type) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:326` `mimes` (const) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:604` `getTypes` (const) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:625` `getExtensions` (const) - 1 documentation section/link violation(s)
- `src/MimeTypes.ts:650` `lookup` (const) - 1 documentation section/link violation(s)
- `src/Timezones.ts:35` `TimezoneName` (type) - 1 documentation section/link violation(s)
- `src/Timezones.ts:75` `TimezoneNameValues` (const) - 1 documentation section/link violation(s)
- `src/index.ts:26` `export * as Blockchain from "./Blockchain.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:41` `export * as Calendar from "./Calendar.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:56` `export * as CurrencyCodes from "./CurrencyCodes.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:75` `export * as KeyboardShortcuts from "./KeyboardShortcuts.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:90` `export * as MimeTypesData from "./MimeTypes.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:105` `export * as Territories from "./Territories.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:120` `export * as Timezones from "./Timezones.ts";` (re-export) - 1 example import violation(s)

### @beep/xai

Path: `packages/drivers/xai`

Export findings:
- `src/XAi.config.ts:168` `XAiConfigInput` (class) - 1 example import violation(s)
- `src/XAi.service.ts:108` `XAiEndpointMethod` (type) - 1 example import violation(s)
- `src/XAi.service.ts:127` `XAiStreamMethod` (type) - 1 example import violation(s)
- `src/XAi.service.ts:186` `XAiWebSocketMethod` (type) - 1 example import violation(s)
- `src/XAi.service.ts:1026` `XAi` (class) - 1 example import violation(s)
- `src/XAiLanguageModel.service.ts:245` `make` (const) - 1 example import violation(s)

### @beep/architecture-lab-server

Path: `packages/architecture-lab/server`

Export findings:
- `src/Layer.ts:36` `ArchitectureLabServerLive` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.http.ts:184` `makeWorkItemHttpHandlers` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.layer.ts:41` `makeWorkItemServer` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.layer.ts:68` `WorkItemServer` (class) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.layer.ts:99` `WorkItemServerLayer` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.repo.ts:74` `makeInMemoryWorkItemRepository` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.repo.ts:174` `makeDrizzleWorkItemRepository` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.repo.ts:248` `makeWorkItemRepository` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.rpc.ts:52` `makeWorkItemRpcHandlers` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.tools.ts:78` `makeWorkItemToolHandlers` (const) - 1 example import violation(s)
- `src/entities/Worker/Worker.layer.ts:39` `makeWorkerServer` (const) - 1 example import violation(s)
- `src/entities/Worker/Worker.layer.ts:66` `WorkerServer` (class) - 1 example import violation(s)
- `src/entities/Worker/Worker.layer.ts:91` `WorkerServerLayer` (const) - 1 example import violation(s)
- `src/entities/Worker/Worker.repo.ts:72` `makeInMemoryWorkerRepository` (const) - 1 example import violation(s)
- `src/entities/Worker/Worker.repo.ts:164` `makeDrizzleWorkerRepository` (const) - 1 example import violation(s)
- `src/entities/Worker/Worker.repo.ts:220` `makeWorkerRepository` (const) - 1 example import violation(s)
- `src/test.ts:36` `ArchitectureLabServerTest` (const) - 1 example import violation(s)

### @beep/duckdb

Path: `packages/drivers/duckdb`

Export findings:
- `src/DuckDb.errors.ts:169` `DuckDbError` (class) - 1 example import violation(s)
- `src/DuckDb.service.ts:82` `DuckDbClient` (interface) - 1 example import violation(s)
- `src/DuckDb.service.ts:176` `DuckDbShape` (interface) - 1 example import violation(s)
- `src/DuckDb.service.ts:491` `DuckDb` (class) - 1 example import violation(s)

### @beep/ffmpeg

Path: `packages/drivers/ffmpeg`

Export findings:
- `src/FFmpeg.service.ts:129` `FFmpegEventSink` (type) - 1 example import violation(s)
- `src/FFmpeg.service.ts:157` `FFmpegShape` (interface) - 1 example import violation(s)

### @beep/obs

Path: `packages/drivers/obs`

Module findings:
- `src/Obs.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ObsProtocol.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ObsProtocol.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Obs.service.ts:117` `ObsShape` (interface) - 1 example import violation(s)
- `src/ObsProtocol.service.ts:207` `ObsProtocolShape` (interface) - 1 example import violation(s)

### @beep/agents-client

Path: `packages/agents/client`

Module findings:
- `src/Chat.atoms.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClientObservability.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Chat.atoms.ts:92` `chatProtocolLayerAtom` (const) - 1 example import violation(s)
- `src/Chat.atoms.ts:707` `SendTurnRequest` (class) - 2 example import violation(s)
- `src/Chat.atoms.ts:739` `EditTurnRequest` (class) - 2 example import violation(s)
- `src/Chat.atoms.ts:777` `TurnRequest` (const) - 2 example import violation(s)
- `src/Chat.atoms.ts:805` `TurnRequest` (type) - 2 example import violation(s)
- `src/Chat.atoms.ts:872` `runTurnAtom` (const) - 2 example import violation(s)
- `src/Chat.layer.ts:74` `HttpChatProtocolLive` (const) - 1 example import violation(s)
- `src/ClientObservability.ts:91` `ClientObservabilityLive` (const) - 1 example import violation(s)
- `src/index.ts:52` `export * from "./ClientObservability.ts";` (re-export) - 1 example import violation(s)

### @beep/uspto-mcp

Path: `packages/drivers/uspto-mcp`

Module findings:
- `src/Server.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/UsptoDocumentTiers.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/UsptoHandlers.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/UsptoSourceAuth.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/UsptoTools.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/bin.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Server.ts:88` `makeServerLayer` (const) - 1 example import violation(s)
- `src/UsptoDocumentTiers.ts:210` `MintFetchableHandle` (const) - 2 example import violation(s)
- `src/UsptoDocumentTiers.ts:269` `ProjectDocumentsWithinBudgetOptions` (class) - 2 example import violation(s)
- `src/UsptoDocumentTiers.ts:321` `projectDocumentsWithinBudget` (const) - 2 example import violation(s)
- `src/UsptoHandlers.ts:102` `UsptoToolkitHandlersLive` (const) - 1 example import violation(s)
- `src/UsptoTools.ts:245` `UsptoGetDocumentsParams` (class) - 1 example import violation(s)

### @beep/epistemic-config

Path: `packages/epistemic/config`

Module findings:
- `src/Audience.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ServerConfig.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/TestLayer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/ServerConfig.ts:71` `EpistemicDestinationAllowlistConfig` (const) - 1 example import violation(s)
- `src/ServerConfig.ts:99` `EpistemicPolicyRevisionConfig` (const) - 1 example import violation(s)
- `src/ServerConfig.ts:177` `EpistemicConfig` (class) - 1 example import violation(s)
- `src/TestLayer.ts:70` `fixtureFrozenAt` (const) - 1 example import violation(s)
- `src/TestLayer.ts:143` `makeEpistemicConfigTest` (const) - 1 example import violation(s)
- `src/TestLayer.ts:160` `EpistemicConfigTest` (const) - 1 example import violation(s)
- `src/layer.ts:42` `EpistemicConfigLive` (const) - 1 example import violation(s)

### @beep/epistemic-use-cases

Path: `packages/epistemic/use-cases`

Module findings:
- `src/ClaimDisposition/ClaimDisposition.commands.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClaimDisposition/ClaimDisposition.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClaimGate/ClaimGate.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClaimLifecycle/ClaimLifecycle.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClaimProjection/ClaimProjection.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EdgeAuthority/EdgeAuthority.commands.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/EdgeAuthority/EdgeAuthority.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ExecutionLedger/ExecutionLedger.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ExecutionLedger/ExecutionLedger.ports.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/ClaimDisposition/ClaimDisposition.ports.ts:160` `ClaimDispositionRepositoryShape` (interface) - 1 example import violation(s)
- `src/ClaimDisposition/ClaimDisposition.ports.ts:197` `ClaimDispositionRepository` (class) - 1 example import violation(s)
- `src/ClaimDisposition/ClaimDisposition.service.ts:211` `ClaimGateOutcomeResolverShape` (interface) - 1 example import violation(s)
- `src/ClaimDisposition/ClaimDisposition.service.ts:246` `ClaimGateOutcomeResolver` (class) - 1 example import violation(s)
- `src/ClaimDisposition/ClaimDisposition.service.ts:328` `makeClaimGateOutcomeResolver` (const) - 1 example import violation(s)
- `src/ClaimGate/ClaimGate.ports.ts:43` `ClaimGateShape` (interface) - 1 example import violation(s)
- `src/ClaimGate/ClaimGate.ports.ts:80` `ClaimGate` (class) - 1 example import violation(s)
- `src/ClaimGate/ClaimGate.service.ts:132` `makeClaimGate` (const) - 1 example import violation(s)
- `src/ClaimLifecycle/ClaimLifecycle.service.ts:39` `ClaimTransitionShape` (interface) - 1 example import violation(s)
- `src/ClaimLifecycle/ClaimLifecycle.service.ts:76` `ClaimTransition` (class) - 1 example import violation(s)
- `src/ClaimLifecycle/ClaimLifecycle.service.ts:116` `makeClaimTransition` (const) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.commands.ts:259` `ListContradictionCandidates` (class) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.commands.ts:308` `GetContradictionCandidate` (class) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.commands.ts:356` `GetExpandedContradictionCandidate` (class) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.ports.ts:65` `ContradictionReviewer` (class) - 1 example import violation(s)
- `src/ContradictionTriage/ContradictionTriage.ports.ts:89` `ContradictionReviewScope` (class) - 1 example import violation(s)
- `src/EdgeAuthority/EdgeAuthority.ports.ts:63` `EdgeAuthorityRepositoryShape` (interface) - 1 example import violation(s)
- `src/EdgeAuthority/EdgeAuthority.ports.ts:104` `EdgeAuthorityRepository` (class) - 1 example import violation(s)
- `src/ExecutionLedger/ExecutionLedger.ports.ts:64` `ExecutionLedgerShape` (interface) - 1 example import violation(s)
- `src/ExecutionLedger/ExecutionLedger.ports.ts:112` `ExecutionLedger` (class) - 1 example import violation(s)

### @beep/m365

Path: `packages/drivers/m365`

Module findings:
- `src/M365.auth.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/M365.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/M365.auth.ts:145` `M365InteractiveAuthorizer` (type) - 1 example import violation(s)
- `src/M365.auth.ts:280` `M365AuthShape` (type) - 1 example import violation(s)
- `src/M365.auth.ts:300` `M365Auth` (class) - 1 example import violation(s)
- `src/M365.service.ts:568` `M365ListMessagesRequest` (class) - 1 example import violation(s)
- `src/M365.service.ts:629` `M365ListEventsRequest` (class) - 1 example import violation(s)

### @beep/observability

Path: `packages/foundation/capability/observability`

Module findings:
- `src/CauseDiagnostics.ts:1` (packageDocumentation) - 2 example import violation(s)
- `src/CauseRedaction.ts:1` (packageDocumentation) - 2 example import violation(s)
- `src/HttpError.ts:1` (packageDocumentation) - 2 example import violation(s)
- `src/Logging.ts:1` (packageDocumentation) - 2 example import violation(s)
- `src/Metric.ts:1` (packageDocumentation) - 2 example import violation(s)
- `src/Observed.ts:1` (packageDocumentation) - 2 example import violation(s)
- `src/PhaseProfiler.ts:1` (packageDocumentation) - 2 example import violation(s)
- `src/index.ts:1` (packageDocumentation) - 2 example import violation(s)

Export findings:
- `src/CauseDiagnostics.ts:59` `CauseClassification` (const) - 2 example import violation(s)
- `src/CauseDiagnostics.ts:80` `CauseClassification` (type) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:98` `ExitOutcome` (const) - 2 example import violation(s)
- `src/CauseDiagnostics.ts:119` `ExitOutcome` (type) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:136` `CauseFingerprint` (class) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:203` `CauseSummary` (type) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:273` `ObservedExitSummary` (const) - 2 example import violation(s)
- `src/CauseDiagnostics.ts:294` `ObservedExitSummary` (type) - 1 example import violation(s)
- `src/CauseDiagnostics.ts:424` `classifyCause` (const) - 2 example import violation(s)
- `src/CauseDiagnostics.ts:447` `fingerprintCause` (const) - 2 example import violation(s)
- `src/CauseDiagnostics.ts:472` `summarizeCause` (const) - 2 example import violation(s)
- `src/CauseDiagnostics.ts:523` `summarizeExit` (const) - 2 example import violation(s)
- `src/CauseDiagnostics.ts:582` `renderObservedCause` (const) - 2 example import violation(s)
- `src/CauseRedaction.ts:67` `REDACTION_PLACEHOLDER` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:88` `DEFAULT_MESSAGE_LIMIT` (const) - 2 example import violation(s)
- `src/CauseRedaction.ts:109` `DEFAULT_DETAIL_LIMIT` (const) - 2 example import violation(s)
- `src/CauseRedaction.ts:128` `RedactionChannel` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:149` `RedactionChannel` (type) - 1 example import violation(s)
- `src/CauseRedaction.ts:201` `sanitizeSensitiveText` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:226` `redactString` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:256` `RedactedCause` (class) - 2 example import violation(s)
- `src/CauseRedaction.ts:294` `RedactCauseOptions` (class) - 1 example import violation(s)
- `src/CauseRedaction.ts:388` `redactCauseSummary` (const) - 2 example import violation(s)
- `src/CauseRedaction.ts:424` `redactCause` (const) - 2 example import violation(s)
- `src/CauseRedaction.ts:454` `redactCauseForClient` (const) - 2 example import violation(s)
- `src/CauseRedaction.ts:478` `RedactedCauseError` (class) - 2 example import violation(s)
- `src/CauseRedaction.ts:513` `redactCauseEffect` (const) - 2 example import violation(s)
- `src/CauseRedaction.ts:542` `RedactedCauseLogLevel` (const) - 1 example import violation(s)
- `src/CauseRedaction.ts:563` `RedactedCauseLogLevel` (type) - 1 example import violation(s)
- `src/CauseRedaction.ts:580` `LogRedactedCauseOptions` (class) - 1 example import violation(s)
- `src/CauseRedaction.ts:626` `logRedactedCause` (const) - 2 example import violation(s)
- `src/CauseRedaction.ts:668` `tapRedactedCause` (const) - 2 example import violation(s)
- `src/CoreConfig.ts:45` `ObservabilityCoreConfig` (const) - 1 example import violation(s)
- `src/CoreConfig.ts:75` `ObservabilityCoreConfig` (type) - 1 example import violation(s)
- `src/HttpError.ts:93` `ClientHttpError` (class) - 2 example import violation(s)
- `src/HttpError.ts:129` `ServerHttpError` (class) - 2 example import violation(s)
- `src/HttpError.ts:160` `BadRequestError` (class) - 2 example import violation(s)
- `src/HttpError.ts:187` `UnauthorizedError` (class) - 2 example import violation(s)
- `src/HttpError.ts:214` `ForbiddenError` (class) - 2 example import violation(s)
- `src/HttpError.ts:241` `NotFoundError` (class) - 2 example import violation(s)
- `src/HttpError.ts:268` `ConflictError` (class) - 2 example import violation(s)
- `src/HttpError.ts:295` `UnprocessableEntityError` (class) - 2 example import violation(s)
- `src/HttpError.ts:322` `TooManyRequestsError` (class) - 2 example import violation(s)
- `src/HttpError.ts:349` `InternalServerErrorError` (class) - 2 example import violation(s)
- `src/HttpError.ts:376` `BadGatewayError` (class) - 2 example import violation(s)
- `src/HttpError.ts:403` `ServiceUnavailableError` (class) - 2 example import violation(s)
- `src/HttpError.ts:430` `GatewayTimeoutError` (class) - 2 example import violation(s)
- `src/HttpError.ts:456` `makeBadRequestError` (const) - 1 example import violation(s)
- `src/HttpError.ts:476` `makeUnauthorizedError` (const) - 1 example import violation(s)
- `src/HttpError.ts:496` `makeForbiddenError` (const) - 1 example import violation(s)
- `src/HttpError.ts:516` `makeNotFoundError` (const) - 1 example import violation(s)
- `src/HttpError.ts:536` `makeConflictError` (const) - 1 example import violation(s)
- `src/HttpError.ts:556` `makeUnprocessableEntityError` (const) - 1 example import violation(s)
- `src/HttpError.ts:576` `makeTooManyRequestsError` (const) - 1 example import violation(s)
- `src/HttpError.ts:596` `makeInternalServerError` (const) - 1 example import violation(s)
- `src/HttpError.ts:616` `makeBadGatewayError` (const) - 1 example import violation(s)
- `src/HttpError.ts:636` `makeServiceUnavailableError` (const) - 1 example import violation(s)
- `src/HttpError.ts:656` `makeGatewayTimeoutError` (const) - 1 example import violation(s)
- `src/Logging.ts:54` `LogFormat` (const) - 1 example import violation(s)
- `src/Logging.ts:75` `LogFormat` (type) - 1 example import violation(s)
- `src/Logging.ts:92` `PrettyLogTheme` (const) - 1 example import violation(s)
- `src/Logging.ts:113` `PrettyLogTheme` (type) - 1 example import violation(s)
- `src/Logging.ts:130` `BannerMode` (const) - 1 example import violation(s)
- `src/Logging.ts:151` `BannerMode` (type) - 1 example import violation(s)
- `src/Logging.ts:172` `PrettyLoggerConfig` (class) - 1 example import violation(s)
- `src/Logging.ts:201` `LoggingConfig` (class) - 1 example import violation(s)
- `src/Logging.ts:235` `layerMinimumLogLevel` (const) - 2 example import violation(s)
- `src/Logging.ts:254` `RenderLogBannerOptions` (class) - 1 example import violation(s)
- `src/Logging.ts:364` `renderLogBanner` (const) - 1 example import violation(s)
- `src/Logging.ts:454` `layerConsoleLogger` (const) - 2 example import violation(s)
- `src/Metric.ts:52` `TrackDurationOptions` (class) - 1 example import violation(s)
- `src/Metric.ts:79` `TrackDurationOptionsInput` (type) - 1 example import violation(s)
- `src/Metric.ts:153` `statusClass` (const) - 1 example import violation(s)
- `src/Metric.ts:188` `measureElapsedMillis` (const) - 2 example import violation(s)
- `src/Metric.ts:272` `trackDuration` (const) - 2 example import violation(s)
- `src/Metric.ts:398` `observeWorkflow` (const) - 2 example import violation(s)
- `src/Metric.ts:549` `observeHttpRequest` (const) - 2 example import violation(s)
- `src/Observed.ts:47` `ObservedError` (const) - 1 example import violation(s)
- `src/Observed.ts:68` `ObservedError` (type) - 1 example import violation(s)
- `src/Observed.ts:87` `ObservedErrorWithStack` (const) - 1 example import violation(s)
- `src/Observed.ts:108` `ObservedErrorWithStack` (type) - 1 example import violation(s)
- `src/Observed.ts:127` `ObservedDefect` (const) - 1 example import violation(s)
- `src/Observed.ts:148` `ObservedDefect` (type) - 1 example import violation(s)
- `src/Observed.ts:167` `ObservedDefectWithStack` (const) - 1 example import violation(s)
- `src/Observed.ts:188` `ObservedDefectWithStack` (type) - 1 example import violation(s)
- `src/Observed.ts:209` `ObservedCauseReason` (const) - 2 example import violation(s)
- `src/Observed.ts:230` `ObservedCauseReason` (type) - 1 example import violation(s)
- `src/Observed.ts:249` `ObservedCause` (const) - 2 example import violation(s)
- `src/Observed.ts:271` `ObservedCause` (type) - 1 example import violation(s)
- `src/Observed.ts:290` `ObservedExit` (const) - 2 example import violation(s)
- `src/Observed.ts:312` `ObservedExit` (type) - 1 example import violation(s)
- `src/PhaseProfiler.ts:70` `PhaseOutcome` (const) - 2 example import violation(s)
- `src/PhaseProfiler.ts:91` `PhaseOutcome` (type) - 1 example import violation(s)
- `src/PhaseProfiler.ts:118` `PhaseProfile` (class) - 2 example import violation(s)
- `src/PhaseProfiler.ts:302` `profilePhase` (const) - 2 example import violation(s)
- `src/experimental/server/DevToolsRelay.ts:44` `DevToolsSnapshot` (class) - 1 example import violation(s)
- `src/experimental/server/DevToolsRelay.ts:76` `DevToolsRelayService` (class) - 1 example import violation(s)
- `src/experimental/server/DevToolsRelay.ts:123` `makeDevToolsRelayService` (const) - 1 example import violation(s)
- `src/experimental/server/DevToolsRelay.ts:232` `layerDevToolsRelayServer` (const) - 1 example import violation(s)
- `src/experimental/server/OtlpPacketLab.ts:121` `OtlpPacket` (class) - 1 example import violation(s)
- `src/experimental/server/OtlpPacketLab.ts:155` `OtlpPacketLab` (class) - 1 example import violation(s)
- `src/experimental/server/OtlpPacketLab.ts:296` `layerJson` (const) - 1 example import violation(s)
- `src/experimental/server/OtlpPacketLab.ts:318` `layerProtobuf` (const) - 1 example import violation(s)
- `src/server/DevTools.ts:34` `DevToolsSpanFilter` (const) - 1 example import violation(s)
- `src/server/DevTools.ts:60` `DevToolsSpanFilter` (type) - 1 example import violation(s)
- `src/server/ErrorReporting.ts:138` `layerErrorReporter` (const) - 1 example import violation(s)
- `src/server/HttpApiTelemetry.ts:68` `HttpApiTelemetryDescriptor` (class) - 1 example import violation(s)
- `src/server/HttpApiTelemetry.ts:494` `observeHttpApiEffect` (const) - 2 example import violation(s)
- `src/server/HttpApiTelemetry.ts:559` `HttpApiTelemetryMiddleware` (class) - 1 example import violation(s)
- `src/server/HttpApiTelemetry.ts:708` `observeHttpApiHandler` (const) - 2 example import violation(s)
- `src/server/TraceContext.ts:54` `injectTraceContextHeaders` (const) - 1 example import violation(s)
- `src/server/TraceContext.ts:115` `withIncomingTraceContext` (const) - 1 example import violation(s)

### @beep/html

Path: `packages/foundation/modeling/html`

Module findings:
- `src/Html.attributes.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.conformance.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.contract.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.meta.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.model.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.nodes.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.policy.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Html.serialize.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 2 example import violation(s)

Export findings:
- `src/Html.attributes.ts:78` `makeAsciiCaseInsensitiveEnumerated` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:706` `CrossOrigin` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:797` `Utf8Charset` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:836` `FormAutocomplete` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:891` `ButtonCommand` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:1197` `HtmlStep` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:1396` `HtmlRelationList` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:1442` `LinkRelationList` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:1490` `HtmlIdReferenceList` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:1552` `MetadataName` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:1631` `AutocompleteAttribute` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:1833` `EnumeratedGlobalAttributes` (const) - 1 example import violation(s)
- `src/Html.attributes.ts:1943` `DatasetKey` (type) - 1 example import violation(s)
- `src/Html.conformance.ts:171` `ConformantHtml` (const) - 1 example import violation(s)
- `src/Html.conformance.ts:213` `ConformantHtmlNode` (const) - 2 example import violation(s)
- `src/Html.conformance.ts:2256` `conform` (const) - 1 example import violation(s)
- `src/Html.conformance.ts:2288` `conformantRoot` (const) - 1 example import violation(s)
- `src/Html.contract.ts:103` `HtmlDocumentChild` (type) - 1 example import violation(s)
- `src/Html.form-control.ts:43` `InputState` (const) - 1 example import violation(s)
- `src/Html.form-control.ts:128` `resolveInputState` (const) - 1 example import violation(s)
- `src/Html.form-control.ts:157` `inputStateAllowedAttributes` (const) - 1 example import violation(s)
- `src/Html.form-control.ts:231` `ButtonState` (const) - 1 example import violation(s)
- `src/Html.form-control.ts:303` `resolveButtonState` (const) - 1 example import violation(s)
- `src/Html.meta.ts:603` `HTML_GLOBAL_ATTRIBUTE_NAMES` (const) - 1 documentation section/link violation(s)
- `src/Html.meta.ts:1425` `HtmlBooleanAttributeName` (type) - 1 example import violation(s)
- `src/Html.policy.ts:346` `SafeImageUrlAttribute` (type) - 1 example import violation(s)
- `src/Html.policy.ts:395` `HtmlPolicyRule` (type) - 1 example import violation(s)
- `src/Html.policy.ts:501` `SafeHtmlAst` (const) - 2 example import violation(s)
- `src/Html.policy.ts:528` `SafeHtmlAst` (type) - 2 example import violation(s)
- `src/Html.policy.ts:549` `SafeHtmlNode` (const) - 2 example import violation(s)
- `src/Html.policy.ts:805` `inspectSafeHtml` (const) - 2 example import violation(s)
- `src/Html.policy.ts:835` `enforceSafeHtml` (const) - 2 example import violation(s)
- `src/Html.policy.ts:862` `safeHtmlAstConformant` (const) - 2 example import violation(s)
- `src/Html.policy.ts:891` `safeHtmlAstRoot` (const) - 2 example import violation(s)
- `src/Html.script.ts:42` `HtmlMimeType` (const) - 2 example import violation(s)
- `src/Html.script.ts:82` `JavaScriptMimeTypeEssence` (const) - 1 example import violation(s)
- `src/Html.script.ts:136` `ScriptDataBlockMimeType` (const) - 2 example import violation(s)
- `src/Html.script.ts:189` `ScriptState` (const) - 1 example import violation(s)
- `src/Html.script.ts:230` `InvalidScriptType` (class) - 1 example import violation(s)
- `src/Html.script.ts:286` `resolveScriptState` (const) - 2 example import violation(s)
- `src/Html.serialize.ts:91` `UntrustedHtml` (type) - 1 example import violation(s)
- `src/Html.serialize.ts:141` `SafeHtml` (const) - 2 example import violation(s)
- `src/Html.serialize.ts:176` `SafeHtml` (type) - 2 example import violation(s)
- `src/Html.serialize.ts:226` `HtmlSerializeRule` (type) - 1 example import violation(s)
- `src/Html.serialize.ts:608` `serialize` (const) - 2 example import violation(s)
- `src/Html.serialize.ts:634` `serializeConformant` (const) - 2 example import violation(s)
- `src/Html.serialize.ts:684` `serializeSafe` (const) - 2 example import violation(s)
- `src/Html.serialize.ts:706` `untrustedHtmlValue` (const) - 2 example import violation(s)
- `src/Html.serialize.ts:740` `safeHtmlValue` (const) - 2 example import violation(s)
- `src/Html.source-size.ts:205` `SourceSizeIssue` (class) - 1 example import violation(s)
- `src/Html.source-size.ts:238` `SourceSizeAnalysis` (class) - 1 example import violation(s)
- `src/Html.source-size.ts:831` `inspectSourceSizeList` (const) - 1 example import violation(s); 1 documentation section/link violation(s)

### @beep/n3

Path: `packages/drivers/n3`

Export findings:
- `src/N3.service.ts:344` `N3TurtleCodec` (class) - 1 example import violation(s)

### @beep/ui

Path: `packages/foundation/ui-system/ui`

Module findings:
- `src/index.ts:1` (packageDocumentation) - 1 example import violation(s)

Export findings:
- `src/components/effect-date-time-picker.tsx:676` `EffectDateTimeLocalizationProvider` (function) - 1 example import violation(s)
- `src/components/effect-date-time-picker.tsx:708` `EffectDatePicker` (function) - 1 example import violation(s)
- `src/components/effect-date-time-picker.tsx:755` `EffectDateTimePicker` (function) - 1 example import violation(s)
- `src/components/effect-date-time-picker.tsx:795` `EffectTimePicker` (function) - 1 example import violation(s)
- `src/components/effect-date-time-picker.tsx:326` `AdapterEffectDateTime` (class) - 1 example import violation(s)
- `src/hooks/useNumberInput.ts:481` `getStepFactor` (const) - 1 example import violation(s)
- `src/index.ts:29` `export { VERSION } from "./Version.ts";` (re-export) - 1 example import violation(s)

### @beep/pandoc-ast

Path: `packages/foundation/modeling/pandoc-ast`

Export findings:
- `src/Pandoc.codec.ts:256` `PandocDecodeError` (class) - 1 example import violation(s)
- `src/Pandoc.codec.ts:461` `PandocLosslessDocument` (const) - 1 example import violation(s)
- `src/Pandoc.codec.ts:493` `PandocLosslessDocument` (type) - 1 example import violation(s)
- `src/Pandoc.codec.ts:1315` `decodePandocJson` (const) - 1 example import violation(s)
- `src/Pandoc.codec.ts:1357` `decodePandocJsonString` (const) - 1 example import violation(s)
- `src/Pandoc.codec.ts:1857` `decodePandocJsonLossless` (const) - 1 example import violation(s)
- `src/Pandoc.codec.ts:1879` `decodePandocJsonStringLossless` (const) - 1 example import violation(s)
- `src/Pandoc.conformance.ts:239` `PandocConformanceResult` (const) - 1 example import violation(s)
- `src/Pandoc.conformance.ts:330` `inspectPandocConformance` (const) - 1 example import violation(s)
- `src/Pandoc.mapping.ts:66` `PandocMappingError` (class) - 1 example import violation(s)
- `src/Pandoc.model.ts:3341` `PandocTablePayload` (type) - 1 example import violation(s)
- `src/Pandoc.model.ts:3669` `PandocMetaValue` (namespace) - 1 example import violation(s)
- `src/Pandoc.model.ts:4227` `PandocMeta` (const) - 1 example import violation(s)
- `src/index.ts:22` `export * from "./Pandoc.codec.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:43` `export * from "./Pandoc.conformance.ts";` (re-export) - 2 example import violation(s)
- `src/index.ts:58` `export * from "./Pandoc.mapping.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:73` `export * from "./Pandoc.model.ts";` (re-export) - 1 example import violation(s)
- `src/index.ts:88` `export * from "./Pandoc.report.ts";` (re-export) - 1 example import violation(s)

### @beep/repo-configs

Path: `packages/tooling/policy-pack/repo-configs`

Export findings:
- `src/next/NextConfig.model.ts:423` `decodeNextConfig` (const) - 1 example import violation(s)
- `src/next/SharedNextConfig.model.ts:284` `BeepNextConfigOptions` (class) - 1 example import violation(s)
- `src/next/SharedNextConfig.model.ts:515` `decodeBeepNextConfigEnv` (const) - 1 example import violation(s)
- `src/next/models/AllowedDevOrigin.schema.ts:32` `AllowedDevOrigin` (const) - 1 example import violation(s)
- `src/next/models/Compiler.schema.ts:224` `SassOptions` (const) - 1 example import violation(s)
- `src/next/models/ImageConfig.schema.ts:238` `ImageConfigComplete` (class) - 1 documentation section/link violation(s)
- `src/next/models/Routes.schema.ts:29` `RouteHasType` (const) - 1 example import violation(s)
- `src/next/models/Routes.schema.ts:90` `RouteHas` (const) - 1 example import violation(s)
- `src/next/models/Routes.schema.ts:267` `Rewrite` (const) - 1 example import violation(s)
- `src/next/models/Routes.schema.ts:304` `Header` (const) - 1 example import violation(s)
- `src/next/models/Routes.schema.ts:345` `Redirect` (const) - 1 example import violation(s)
- `src/next/models/Routes.schema.ts:392` `Middleware` (const) - 1 example import violation(s)
- `src/next/models/Shared.schema.ts:34` `FileSizeSuffix` (const) - 1 example import violation(s)
- `src/next/models/Shared.schema.ts:89` `SizeLimit` (const) - 1 example import violation(s)

### @beep/openai

Path: `packages/drivers/openai`

Export findings:
- `src/OpenAi.config.ts:173` `OpenAiEmbeddingModelOptions` (class) - 1 example import violation(s)
- `src/OpenAi.service.ts:45` `OpenAiLive` (const) - 1 example import violation(s)
- `src/OpenAi.service.ts:104` `makeOpenAiEmbeddingModelLayer` (const) - 1 example import violation(s)
- `src/OpenAi.service.ts:133` `OpenAiLanguageModelLive` (const) - 1 example import violation(s)
- `src/OpenAi.service.ts:173` `makeOpenAiEmbeddingModelLive` (const) - 2 example import violation(s)

### @beep/wink

Path: `packages/drivers/wink`

Module findings:
- `src/WinkBackend.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Wink.layer.ts:41` `WinkLayerLive` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:74` `WinkLayerAllLive` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:93` `WinkCorpusManagerLive` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:114` `WinkEngine` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:137` `WinkEngineLive` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:159` `WinkEngineRefLive` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:183` `WinkSimilarityLive` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:199` `WinkTokenization` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:223` `WinkTokenizationLive` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:245` `WinkUtilsLive` (const) - 1 example import violation(s)
- `src/Wink.layer.ts:267` `WinkVectorizerLive` (const) - 1 example import violation(s)
- `src/Wink.service.ts:142` `WinkEngineRuntimeState` (type) - 1 example import violation(s)
- `src/Wink.service.ts:291` `WinkEngine` (class) - 1 example import violation(s)
- `src/Wink.service.ts:315` `WinkEngineLive` (const) - 1 example import violation(s)
- `src/WinkBackend.service.ts:169` `WinkBackendLive` (const) - 1 example import violation(s)
- `src/WinkCorpus.service.ts:821` `WinkCorpusManager` (class) - 1 example import violation(s)
- `src/WinkCorpus.service.ts:851` `WinkCorpusManagerLive` (const) - 1 example import violation(s)
- `src/WinkEngineRef.service.ts:74` `WinkEngineRef` (class) - 1 example import violation(s)
- `src/WinkEngineRef.service.ts:100` `WinkEngineRefLive` (const) - 1 example import violation(s)
- `src/WinkEngineRef.service.ts:124` `WinkEngineRuntimeState` (type) - 1 example import violation(s)
- `src/WinkObservability.ts:80` `WinkWorkflowObservationOptions` (class) - 1 example import violation(s)
- `src/WinkObservability.ts:198` `observeWinkWorkflow` (const) - 1 example import violation(s)
- `src/WinkObservability.ts:309` `mapWinkToolError` (const) - 1 example import violation(s)
- `src/WinkObservability.ts:351` `observeWinkTool` (const) - 1 example import violation(s)
- `src/WinkSimilarity.service.ts:297` `WinkSimilarity` (class) - 1 example import violation(s)
- `src/WinkSimilarity.service.ts:331` `WinkSimilarityLive` (const) - 1 example import violation(s)
- `src/WinkTokenization.service.ts:374` `WinkTokenization` (const) - 1 example import violation(s)
- `src/WinkTokenization.service.ts:397` `WinkTokenizationLive` (const) - 1 example import violation(s)
- `src/WinkTools.service.ts:369` `WinkNlpToolkitLive` (const) - 1 example import violation(s)
- `src/WinkUtils.service.ts:324` `WinkUtils` (class) - 1 example import violation(s)
- `src/WinkUtils.service.ts:348` `WinkUtilsLive` (const) - 1 example import violation(s)
- `src/WinkVectorizer.service.ts:74` `ScopedVectorizer` (interface) - 1 example import violation(s)
- `src/WinkVectorizer.service.ts:365` `WinkVectorizer` (class) - 1 example import violation(s)
- `src/WinkVectorizer.service.ts:390` `WinkVectorizerLive` (const) - 1 example import violation(s)

### @beep/postgres

Path: `packages/drivers/postgres`

Export findings:
- `src/PostgresDiagnostics.service.ts:309` `formatSql` (const) - 1 example import violation(s)
- `src/PostgresDiagnostics.service.ts:362` `formatPostgresErrorWith` (const) - 1 example import violation(s)
- `src/PostgresDiagnostics.service.ts:437` `logPostgresError` (const) - 1 example import violation(s)

### @beep/brand

Path: `packages/foundation/ui-system/brand`

Export findings:
- `src/Brand.assets.ts:31` `RenderedAsset` (class) - 1 example import violation(s)
- `src/Brand.assets.ts:84` `renderBrandAssets` (const) - 1 example import violation(s)
- `src/Brand.css.ts:28` `GENERATED_CSS_BANNER` (const) - 1 example import violation(s)
- `src/Brand.css.ts:76` `fontStack` (const) - 1 example import violation(s)
- `src/Brand.css.ts:147` `renderThemeCss` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:31` `PrintableText` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:59` `PrintableText` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:75` `ScaleStep` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:94` `ScaleStep` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:110` `SurfaceStep` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:129` `SurfaceStep` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:145` `ColorScale` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:175` `SurfaceScale` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:201` `Foreground` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:224` `Border` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:246` `Semantic` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:269` `Alpha` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:289` `Alpha` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:305` `GlowStop` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:327` `GlowLayer` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:349` `Glow` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:372` `ColorScheme` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:398` `SchemeName` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:417` `SchemeName` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:433` `FontStack` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:457` `Typography` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:479` `SvgPathData` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:512` `SvgPathData` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:528` `MarkPoint` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:550` `MarkRotation` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:572` `PixelGlasses` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:597` `BrandMark` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:626` `BrandIdentity` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:651` `SvgPaint` (const) - 1 example import violation(s)
- `src/Brand.schema.ts:671` `SvgPaint` (type) - 1 example import violation(s)
- `src/Brand.schema.ts:688` `MarkPaint` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:711` `MarkGround` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:740` `MarkSvgRequest` (class) - 1 example import violation(s)
- `src/Brand.schema.ts:773` `WordmarkSvgRequest` (class) - 1 example import violation(s)
- `src/Brand.svg.ts:52` `glassesTransform` (const) - 1 example import violation(s)
- `src/Brand.svg.ts:121` `renderMarkSvg` (const) - 1 example import violation(s)
- `src/Brand.svg.ts:159` `renderWordmarkSvg` (const) - 1 example import violation(s)
- `src/Brand.tokens.ts:134` `beep` (const) - 1 example import violation(s)

### @beep/codegen-kit

Path: `packages/tooling/library/codegen-kit`

Export findings:
- `src/CodegenKit.service.ts:493` `CodegenKit` (class) - 1 example import violation(s)

### @beep/architecture-lab-domain

Path: `packages/architecture-lab/domain`

Export findings:
- `src/aggregates/WorkItem/WorkItem.model.ts:242` `assign` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.model.ts:287` `complete` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.model.ts:334` `reopen` (const) - 1 example import violation(s)
- `src/aggregates/WorkItem/WorkItem.model.ts:374` `archive` (const) - 1 example import violation(s)

### @beep/pretext

Path: `packages/drivers/pretext`

Module findings:
- `src/Pretext.errors.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Pretext.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PretextCapture.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/PretextCapture.test-layer.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/browser.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/Pretext.models.ts:304` `naturalWidth` (const) - 1 example import violation(s)
- `src/Pretext.models.ts:338` `lineRanges` (const) - 1 example import violation(s)
- `src/Pretext.models.ts:395` `lineStats` (const) - 1 example import violation(s)
- `src/Pretext.models.ts:431` `lineCount` (const) - 1 example import violation(s)
- `src/Pretext.models.ts:474` `textHeight` (const) - 1 example import violation(s)

### @beep/provenance

Path: `packages/foundation/modeling/provenance`

Module findings:
- `src/TextAnchor.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/TextAnchor.ts:161` `TextAnchor` (class) - 1 example import violation(s)
- `src/VerifiedTextAnchor.ts:512` `toTextAnchorVerificationReceipt` (const) - 2 example import violation(s)
- `src/VerifiedTextAnchor.ts:576` `verifySourceTextIdentity` (const) - 1 example import violation(s)
- `src/VerifiedTextAnchor.ts:708` `verifyTextAnchor` (const) - 2 example import violation(s)

### @beep/epistemic-tables

Path: `packages/epistemic/tables`

Module findings:
- `src/entities/EdgeVersion/EdgeVersion.converters.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/entities/EdgeVersion/EdgeVersion.table.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.converters.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/values/ExecutionRecord/ExecutionRecord.table.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

### @beep/qa-capture

Path: `packages/tooling/library/qa-capture`

Module findings:
- `src/ActionEvent.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ClockCorrelator.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Collector.api.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Collector.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ExtractionPlan.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/ExtractionPlanner.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/QaCapture.models.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/SessionStore.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/Witness.service.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)
- `src/index.ts:1` (packageDocumentation) - 1 documentation section/link violation(s)

Export findings:
- `src/ClockCorrelator.service.ts:330` `ClockCorrelatorShape` (interface) - 1 example import violation(s)
- `src/Collector.service.ts:241` `CollectorShape` (interface) - 1 example import violation(s)
- `src/Witness.service.ts:68` `WitnessShape` (interface) - 1 example import violation(s)

### @beep/documents-use-cases

Path: `packages/documents/use-cases`

Export findings:
- `src/aggregates/Document/DocumentIntake.ts:138` `DocumentIntakeShape` (interface) - 1 example import violation(s)
- `src/aggregates/Document/DocumentIntake.ts:164` `DocumentIntake` (class) - 1 example import violation(s)
- `src/aggregates/Document/FilingDecision.ts:136` `FilingDecisionShape` (interface) - 1 example import violation(s)
- `src/aggregates/Document/FilingDecision.ts:167` `FilingDecision` (class) - 1 example import violation(s)
- `src/aggregates/Sync/DmsMirror.ts:441` `DmsMirrorShape` (interface) - 1 example import violation(s)
- `src/aggregates/Sync/DmsMirror.ts:486` `DmsMirror` (class) - 1 example import violation(s)
- `src/aggregates/Sync/DmsMirror.ts:632` `DmsMirrorAvailabilityShape` (interface) - 1 example import violation(s)
- `src/aggregates/Sync/DmsMirror.ts:663` `DmsMirrorAvailability` (class) - 1 example import violation(s)
- `src/aggregates/Sync/VaultSyncEngine.ts:368` `VaultSyncEngineShape` (interface) - 1 example import violation(s)
- `src/aggregates/Sync/VaultSyncEngine.ts:423` `VaultSyncEngine` (class) - 1 example import violation(s)
- `src/entities/SyncConflict/SyncConflict.repository.ts:252` `SyncConflictRepositoryShape` (interface) - 1 example import violation(s)
- `src/entities/SyncConflict/SyncConflict.repository.ts:296` `SyncConflictRepository` (class) - 1 example import violation(s)
- `src/entities/SyncCursor/SyncCursor.repository.ts:171` `SyncCursorRepositoryShape` (interface) - 1 example import violation(s)
- `src/entities/SyncCursor/SyncCursor.repository.ts:208` `SyncCursorRepository` (class) - 1 example import violation(s)
- `src/entities/SyncItem/SyncItem.repository.ts:49` `SyncItemSeed` (class) - 1 example import violation(s)
- `src/entities/SyncItem/SyncItem.repository.ts:362` `SyncItemRepositoryShape` (interface) - 1 example import violation(s)
- `src/entities/SyncItem/SyncItem.repository.ts:411` `SyncItemRepository` (class) - 1 example import violation(s)
- `src/entities/SyncOperation/SyncOperation.repository.ts:53` `SyncOperationSeed` (class) - 1 example import violation(s)
- `src/entities/SyncOperation/SyncOperation.repository.ts:397` `SyncOperationRepositoryShape` (interface) - 1 example import violation(s)
- `src/entities/SyncOperation/SyncOperation.repository.ts:455` `SyncOperationRepository` (class) - 1 example import violation(s)

### @beep/sanity

Path: `packages/drivers/sanity`

Export findings:
- `src/Sanity.service.ts:164` `SanityShape` (type) - 1 example import violation(s)
- `src/Sanity.service.ts:359` `Sanity` (class) - 1 example import violation(s)
