# Headroom pilot, cell A, 2026-11-13

Cell A only (archived prompt, no skill), 12 tasks by 2 runs, Opus 5.5
(`claude-opus-5-5`), Claude Code 2.1.323, scorer profile
`skill-probe-scorer/v2`, the run configuration of the
[amendment](../../research/2026-11-13-analysis-rule-amendment.md). These runs
are not scored evidence and are outside the 216-attempt cap. Records:
[`runs.jsonl`](./runs.jsonl). Cost 4.09 USD-equivalent, no excluded runs.

## Go or no-go: no-go

No all-lanes pass in cell A on 12 of 12 tasks (the threshold is more than
8). The scored run is held and the lane census went to the packet author.

## Lane census (share of the task's 2 runs scoring 1 on the lane)

| Task | Completion | Schema-first | tsgo | Biome | All lanes |
| --- | ---: | ---: | ---: | ---: | ---: |
| `sfv4-fn-schema-001` | 0 | 1 | 0 | 0 | 0 |
| `sfv4-fn-schema-002` | 0 | 1 | 0 | 0.5 | 0 |
| `sfv4-fn-schema-003` | 0 | 1 | 0.5 | 1 | 0 |
| `sfv4-getsomes-struct-001` | 0 | 0.5 | 0 | 0 | 0 |
| `sfv4-getsomes-struct-002` | 0 | 0 | 0.5 | 0.5 | 0 |
| `sfv4-getsomes-struct-003` | 0 | 0 | 0 | 0 | 0 |
| `sfv4-normalization-001` | 0 | 1 | 0 | 0 | 0 |
| `sfv4-normalization-002` | 0 | 1 | 0 | 0 | 0 |
| `sfv4-normalization-003` | 0 | 0.5 | 0 | 0.5 | 0 |
| `sfv4-null-return-001` | 0 | 0.5 | 0.5 | 0 | 0 |
| `sfv4-null-return-002` | 0 | 0 | 0 | 0.5 | 0 |
| `sfv4-null-return-003` | 0 | 0.5 | 0 | 0 | 0 |

## What the runs missed

Counts are run occurrences over the two runs of a task.

| Task | Completion requirements missed | Other lanes |
| --- | --- | --- |
| `sfv4-fn-schema-001` | `pattern /export\s+class\s+FrameFileNameInput\s+extends\s+S\.(?:Class\|O` ×2; `pattern /export\s+const\s+FormatFrameFileName\s*=\s*Fn\s*\(/.` ×2; `pattern /FormatFrameFileName\.implementSync\s*\(/.` ×2 | tsgo `preferEffectArray` ×7; biome `assist/source/useSortedInterfaceMembers` ×2; biome `format` ×2; tsgo `globalJson` ×2; tsgo `preferEffectRecord` ×2; tsgo `preferEffectString` ×2; biome `lint/suspicious/noExplicitAny` ×1 |
| `sfv4-fn-schema-002` | `pattern /BuildExtractFramesArgs\.implementSync\s*\(/.` ×2; `pattern /export\s+class\s+ExtractFramesInput\s+extends\s+S\.(?:Class\|O` ×2; `pattern /export\s+const\s+BuildExtractFramesArgs\s*=\s*Fn\s*\(/.` ×2; `pattern /export\s+const\s+ExtractFramesArgs\s*=/.` ×1 | tsgo `preferEffectArray` ×8; biome `assist/source/useSortedInterfaceMembers` ×1; biome `format` ×1; tsgo `globalJson` ×1; tsgo `preferEffectRecord` ×1; tsgo `schemaNumber` ×1 |
| `sfv4-fn-schema-003` | `pattern /export\s+class\s+SourceMetadataInput\s+extends\s+S\.(?:Class\|` ×2; `pattern /export\s+class\s+SourceMetadata\s+extends\s+S\.(?:Class\|Opaqu` ×2; `pattern /export\s+const\s+MakeSourceMetadata\s*=\s*Fn\s*\(/.` ×2; `pattern /MakeSourceMetadata\.implementSync\s*\(/.` ×2 | tsgo `schemaSync` ×2 |
| `sfv4-getsomes-struct-001` | `pattern /export\s+class\s+ContactSubmissionDraft\s+extends\s+S\.(?:Cla` ×2; `pattern /import\s+\{\s*O\s*\}\s+from\s+"@beep/utils"/.` ×2; `pattern /O\.getSomesStruct\s*\(/.` ×2 | biome `format` ×2; tsgo `preferEffectRecord` ×2; schema-first `schema-first-inventory` ×1 |
| `sfv4-getsomes-struct-002` | `forbidden /export\s+type\s+BoxErrorDetails\s*=\s*\{/ matched.` ×2; `pattern /export\s+class\s+BoxErrorDetails\s+extends\s+S\.(?:Class\|Opaq` ×2; `pattern /import\s+\{\s*O\s*\}\s+from\s+"@beep/utils"/.` ×2; `pattern /O\.getSomesStruct\s*\(/.` ×2; `forbidden /from\s+"effect/Record"/ matched.` ×1; `forbidden /R\.getSomes\s*\(/ matched.` ×1 | schema-first `schema-first-inventory` ×2; biome `assist/source/organizeImports` ×1; biome `format` ×1; tsgo `preferEffectRecord` ×1 |
| `sfv4-getsomes-struct-003` | `pattern /export\s+class\s+RunpodDiagnostics\s+extends\s+S\.(?:Class\|Op` ×2; `pattern /import\s+\{\s*O\s*\}\s+from\s+"@beep/utils"/.` ×2; `pattern /O\.getSomesStruct\s*\(/.` ×2 | biome `assist/source/organizeImports` ×2; schema-first `schema-first-inventory` ×2; tsgo `schemaNumber` ×2; tsgo `TS2835` ×1 |
| `sfv4-normalization-001` | `pattern /S\.decode(?:To)?\s*\(/.` ×2; `pattern /S\.decodeUnknownOption\s*\(\s*CorpusExtension\s*\)/.` ×2; `forbidden /export\s+type\s+CorpusExtension\s*=\s*string/ matched.` ×1; `pattern /export\s+const\s+CorpusExtension\s*=/.` ×1; `pattern /SchemaTransformation\.toLowerCase\s*\(/.` ×1 | tsgo `preferEffectString` ×5; biome `format` ×2; tsgo `schemaSync` ×1 |
| `sfv4-normalization-002` | `forbidden /export\s+type\s+OperationCode\s*=\s*string/ matched.` ×2; `pattern /SchemaTransformation\.toUpperCase\s*\(/.` ×2; `pattern /S\.decode(?:To)?\s*\(/.` ×2; `pattern /S\.decodeUnknownOption\s*\(\s*OperationCode\s*\)/.` ×2; `forbidden /operation\.toUpperCase\s*\(/ matched.` ×1 | biome `assist/source/organizeImports` ×2; tsgo `preferEffectString` ×2; biome `format` ×1 |
| `sfv4-normalization-003` | `pattern /SchemaTransformation\.trim\s*\(/.` ×2; `pattern /S\.decode(?:To)?\s*\(/.` ×2; `pattern /S\.decodeUnknownOption\s*\(\s*HtmlInnerText\s*\)/.` ×2; `forbidden /rawText\.trim\s*\(/ matched.` ×1; `pattern /export\s+const\s+HtmlInnerText\s*=/.` ×1 | biome `assist/source/useSortedInterfaceMembers` ×1; biome `format` ×1; schema-first `schema-first-inventory` ×1; tsgo `preferEffectString` ×1; tsgo `schemaSync` ×1 |
| `sfv4-null-return-001` | `pattern /O\.none\s*\(/.` ×2; `pattern /O\.Option\s*<\s*string\s*>/.` ×2; `pattern /O\.some\s*\(/.` ×2; `pattern /S\.is\s*\(\s*Curie\s*\)/.` ×2; `pattern /export\s+const\s+Curie\s*=/.` ×1 | tsgo `preferEffectString` ×3; biome `format` ×2; biome `assist/source/organizeImports` ×1; biome `assist/source/useSortedInterfaceMembers` ×1; schema-first `schema-first-inventory` ×1 |
| `sfv4-null-return-002` | `pattern /export\s+const\s+JSDocTagName\s*=/.` ×2; `pattern /O\.none\s*\(/.` ×2; `pattern /O\.Option\s*<\s*JSDocTagMetadata\s*>/.` ×2; `pattern /O\.some\s*\(/.` ×2; `pattern /S\.is\s*\(\s*JSDocTagName\s*\)/.` ×2 | schema-first `schema-first-inventory` ×2; tsgo `preferEffectRecord` ×2; tsgo `TS2835` ×2; biome `format` ×1 |
| `sfv4-null-return-003` | `pattern /O\.none\s*\(/.` ×2; `pattern /O\.Option\s*<\s*string\s*>/.` ×2; `pattern /O\.some\s*\(/.` ×2; `pattern /S\.is\s*\(\s*QualitySummary\s*\)/.` ×2; `pattern /export\s+const\s+QualitySummary\s*=/.` ×1 | tsgo `preferEffectString` ×8; biome `format` ×2; tsgo `TS2835` ×2; biome `assist/source/useSortedInterfaceMembers` ×1; schema-first `schema-first-inventory` ×1; tsgo `preferEffectArray` ×1 |

## Reading

- The completion lane is 0 in all 24 runs. No archived prompt names Effect
  or a `@beep/*` package, six say to keep the fixture standalone, and the
  completion contract requires repository idioms: `S.` and `O.` namespace
  aliases, `Fn(...).implementSync` from `@beep/schema`, `O.getSomesStruct`
  from `@beep/utils`. 11 of 24 runs imported `effect` at all and none
  imported a `@beep/*` package; the others hand-rolled `Option` and
  `Schema` types inside the fixture.
- Cell A therefore cannot reach the completion contract by construction,
  whatever headroom cells B and C have: only the Code Laws text (B, C) or
  the skill (C) tells a run which packages exist.
- Biome `format` fails in 10 of 12 tasks; no run has Bash, so none can run
  the formatter. tsgo misses are mostly the `preferEffect*` rules, which the
  Code Laws state.
