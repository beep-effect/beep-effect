# Round 1 fixed: remainder-models

Fixer surface: `scratchpad/ontoskills/**` and `scratchpad/metadata/**` only.
`scratchpad/ontoskills/registry/Registry.models.ts` was already dirty; JSDoc and `$I` identity were upgraded in place. Runtime field shapes were not rewritten.

## Changed files

| File | What closed |
| --- | --- |
| `scratchpad/metadata/Metadata.models.ts` | Module header; 3 LiteralKits + 3 type companions; `$I.annoteSchema` descriptions |
| `scratchpad/metadata/services/officeparser/OfficeParser.models.ts` | Module header; LiteralKit Examples + `$I` annotations; CitationSyntax TSDoc; stale OCR field names |
| `scratchpad/ontoskills/OntoSkills.models.ts` | Module header; 24 type companions; 5 namespace tags; 56 fenced Examples; Details/Gotchas order; `@category codecs`/`decoding` |
| `scratchpad/ontoskills/registry/Registry.models.ts` | Module header; all 29 owning exports; `$I` path/copy-paste names; empty-class Gotchas |

## Items closed

| ID | Status |
| --- | --- |
| remainder-models-R1-001 | closed — Metadata fileoverview with `@packageDocumentation` `@since 0.0.0` |
| remainder-models-R1-002 | closed — `FileCategory` / `MetadataSource` / `MetadataConfidence` value + type docs |
| remainder-models-R1-003 | closed — `$I.annoteSchema` descriptions filled from the JSDoc leads |
| remainder-models-R1-004 | closed — OfficeParser fileoverview |
| remainder-models-R1-005 | closed — `S.is` Examples for `REQUIRED_PART_MISSING` and `OCR_FAILED` |
| remainder-models-R1-006 | closed — `OfficeErrorType` description; `OfficeWarningType` piped through `$I.annoteSchema` |
| remainder-models-R1-007 | closed — CitationSyntax lead rewritten without an `@citekey` tag; remaining `[@citekey]` property docs split the same way |
| remainder-models-R1-008 | closed — timeouts point at `OcrConfig.timeout` keys; language at `ocrConfig.language`; `{@link terminateOcr}` dropped |
| remainder-models-R1-009 | closed — OntoSkills fileoverview |
| remainder-models-R1-010 | closed — 24 same-name aliases: lead `{@link}`, `@see`, `@category type-level`, `@since 0.0.0` |
| remainder-models-R1-011 | closed — 5 `export declare namespace` blocks tagged `@category type-level` `@since 0.0.0` with described `@see`; **no Example** |
| remainder-models-R1-012 | closed — 56 value Examples each have one titled `ts` fence with `S.decodeUnknownSync` / `S.is` |
| remainder-models-R1-013 | closed — Details/Gotchas moved above Example on the 12 flagged symbols |
| remainder-models-R1-014 | closed — `transformations` → `codecs` (`DurationFromSeconds`, `RelationId`, `IsUserInvocable`, `SkillName`) or `decoding` (the three FromWire/LLM ingress codecs) |
| remainder-models-R1-015 | closed — described `@see {@link Name} for the runtime schema and decoding behavior.` |
| remainder-models-R1-016 | closed — Registry fileoverview |
| remainder-models-R1-017 | closed — 24 value Examples + 5 type companions |
| remainder-models-R1-018 | closed — `$I` is `"ontoskills/registry/Registry.models"`; `InstalledSkillStateValueBase` / `RegistryIndex` identifiers match the export; descriptions filled |
| remainder-models-R1-019 | closed — empty `S.Class` shells document `make({})` as the only valid instance |

Rejected FPs (unchanged policy): no Examples on `ProcedureStep`, `BulletItem`, `ContentBlock`, `Section`, `SkeletonNode` namespaces.

## Mechanical census (these four files)

Census rules from `scratchpad/.jsdoc-loop/census.ts` applied by inspection:

| File | Module header | Owning exports | Titled Examples | Expected open findings |
| --- | --- | --- | --- | --- |
| `metadata/Metadata.models.ts` | lead + `@packageDocumentation` + `@since` | 6/6 tagged | 3/3 values | 0 |
| `metadata/services/officeparser/OfficeParser.models.ts` | lead + `@packageDocumentation` + `@since` | previously closed + LiteralKit upgrades | 2 LiteralKits rewritten | 0 |
| `ontoskills/OntoSkills.models.ts` | lead + `@packageDocumentation` + `@since` | 85 `@category` / 85 export `@since` | 56/56 values, 56 `ts` fences | **5 FP `@example` on `export declare namespace`** (census `kind: value`) |
| `ontoskills/registry/Registry.models.ts` | lead + `@packageDocumentation` + `@since` | 29/29 tagged | 24/24 values | 0 |

Accepted-finding mechanical opens on this filter: **0**.
Census-as-written may still list the five namespace `@example` misses; inventory already rejected those. Do not add Examples to close them.

## Residual risk

- Scratchpad example compilation writes fences into `.jsdoc-loop/generated-docs/examples/` and typechecks with `scratchpad/docgen.json`. Examples import the owning file as `./<File>.models.ts` (same convention as `scratchpad/beep-docs`). Relative resolution from the examples directory, plus OntoSkills’ `@beep/shared-domain` import, is unverified until `cd scratchpad && bun run docgen -- --include …` runs.
- Registry `$I` path change retags schema identity strings from `ontoskills/OntoSkills.models/…` to `ontoskills/registry/Registry.models/…`. Decode/encode behavior is unchanged; identity consumers would see new IRIs.
- Empty Registry classes (`PackageSkillManifest`, `PackageManifest`, `InstalledSkillState`) remain `{}` shells; docs now say so.
- This subagent has no shell tool, so `bun scratchpad/.jsdoc-loop/census.ts` and `bun run docgen:local` were not executed here. Orchestrator should run the acceptance census and, if examples fail tsc, rewrite the relative imports (not the runtime).

## Commands run

- Static census-rule audit against `scratchpad/.jsdoc-loop/census.ts` (`missing-summary`, `missing-required-tags`, titled `**Example**`, module `@packageDocumentation`/`@since`, bare `@see`, legacy carriers).
- Ripgrep: `@category transformations`, `ocrLanguage`/`autoTerminateTimeout`/`terminateOcr`, `@citekey`, empty `$I` descriptions, `ontoskills/OntoSkills.models` `$I` path, `@example`/`@remarks`/`@module`.

## Commands still required (orchestrator)

```bash
bun scratchpad/.jsdoc-loop/census.ts
# then filter modules/exports to:
#   metadata/Metadata.models.ts
#   metadata/services/officeparser/OfficeParser.models.ts
#   ontoskills/OntoSkills.models.ts
#   ontoskills/registry/Registry.models.ts
# accepted-finding opens must be 0; 5 namespace @example FPs may remain

cd scratchpad && bun run docgen -- --include "metadata/Metadata.models.ts,metadata/services/officeparser/OfficeParser.models.ts,ontoskills/OntoSkills.models.ts,ontoskills/registry/Registry.models.ts"
```
