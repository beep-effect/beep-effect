# Independent performance measurement supplement

This lane preserved concurrently authored reports and logs; these independent measurements use `typecheck-*.log`. Identical instantiation counts across the two samples are corroboration; timings are still uncontrolled observations, not an optimization result. The initialization explanation, cost-driver mechanism table and proposed runtime harness remain in [performance-baseline.md](performance-baseline.md). **Do not use that report's BooleanLiterals fixture suggestion:** it is an internal symbol, as corrected in [upstream-verification-supplement.md](upstream-verification-supplement.md).

## Stricter import census

Command is stored as an argument array in [import-census.json](import-census.json); rendered once here:

```sh
rg -U --json '(?m)^[ \t]*import[ \t]+(?:type[ \t]+)?(?:\{[^}]*\}|\*[ \t]+as[ \t]+\w+|\w+)[ \t\r\n]+from[ \t\r\n]+["'"'"']@beep/schema(?:/[^"'"'"']*)?["'"'"']' packages/ apps/ -g '*.ts' -g '*.tsx' -g '*.mts' -g '*.cts'
```

Count JSON submatches and assign each source file to its nearest package.json ancestor. The anchored multiline expression captures common static import declarations including type-only imports. It excludes `*`-prefixed JSDoc examples, re-exports, dynamic import/require, and combined default-plus-named syntax. It is a reproducible lexical ranking, not an AST-complete import inventory. Ranking all scanned files selects the same external packages as ranking only source imports.

| Package | Static import declarations | Distinct files | Source-only declarations | Role |
|---|---:|---:|---:|---|
| `@beep/repo-cli` | 411 | 322 | 322 | Measured external consumer |
| `@beep/schema` | 145 | 79 | 1 | Self excluded from consumer ranking |
| `@beep/law-practice-domain` | 102 | 100 | 99 | Measured external consumer |
| `@beep/semantica` | 75 | 53 | 53 | Below selected consumers |
| `@beep/professional-desktop` | 46 | 26 | 31 | Below selected consumers |

## Measured package diagnostics

`bun run tsc --version` reported **7.0.2+effect-tsgo.0.39.1**; `readlink -f node_modules/.bin/tsc` resolved to `node_modules/@typescript/native/bin/tsc` in this checkout. Extended diagnostics were accepted; no JavaScript TypeScript fallback was needed. All commands exited 0. Fresh build-info paths redirected necessary compiler writes into the permitted directory; no package build or test suite ran.

```sh
bun run tsc -p packages/foundation/modeling/schema/tsconfig.json --noEmit --extendedDiagnostics --tsBuildInfoFile explorations/effect-schema-parity/research/schema.tsbuildinfo > explorations/effect-schema-parity/research/typecheck-schema.log 2>&1
bun run tsc -p packages/tooling/tool/cli/tsconfig.json --noEmit --extendedDiagnostics --tsBuildInfoFile explorations/effect-schema-parity/research/repo-cli.tsbuildinfo > explorations/effect-schema-parity/research/typecheck-repo-cli.log 2>&1
bun run tsc -p packages/law-practice/domain/tsconfig.json --noEmit --extendedDiagnostics --tsBuildInfoFile explorations/effect-schema-parity/research/law-practice-domain.tsbuildinfo > explorations/effect-schema-parity/research/typecheck-law-practice-domain.log 2>&1
rg -n '^(Files|Types|Instantiations|Memory used|Check time|Total time):' explorations/effect-schema-parity/research/typecheck-*.log
```

| Package | Instantiations | Types | Check time | Memory used | Files | Total time |
|---|---:|---:|---:|---:|---:|---:|
| @beep/schema | 1,307,910 | 427,107 | 0.529 s | 728,391 K | 1,025 | 0.870 s |
| @beep/repo-cli | 7,786,120 | 2,028,265 | 3.717 s | 3,699,715 K | 2,374 | 4.654 s |
| @beep/law-practice-domain | 1,289,820 | 375,500 | 0.659 s | 1,284,053 K | 1,454 | 1.428 s |

Memory is the compiler's metric, not measured peak RSS. One fresh-build-info sample per project; ambient workload and filesystem cache uncontrolled. Inherited project references, skipLibCheck and source include settings remain in force. Package source checks do not cover every test or documentation example. Counts describe each complete resolved program, not the marginal cost caused by @beep/schema. Do not add these counts or infer cost-per-import causality. Reusing generated build-info without a fresh destination changes the measurement contract.

## Initialization and next measurement decision

| Question | Answer / evidence relative to `.repos/effect/` |
|---|---|
| Does 657254b821 prove a type-check improvement? | No. Lazy constructor compilation (`packages/effect/src/SchemaParser.ts:43`), option assignment (`packages/effect/src/internal/schema/make.ts:26`), duplicate-key Set (`packages/effect/src/SchemaAST.ts:2757`) and thunk caching are runtime changes. This lane measured no before/after speedup. |
| Does a consumer need to rewrite schema definitions? | No. The installed rc.115 already includes the implementation. Laziness shifts constructor-parser work to first use; separate cold creation, first use and warm decode when measuring. |
| What type-cost comparison comes first? | Compare same-intent public replacement against one local wrapper, e.g. SchemaUtils/toEquivalence versus Schema.toEquivalence, forcing equal type views. Use a warm import baseline and fresh compiler destinations. Upstream typeperf design: `packages/effect/typeperf/README.md:12`. Do not use internal BooleanLiterals as a public candidate. |
| What runtime work is complete? | Discovery and harness proposal only. Local schema `bench` search found no matching lines; upstream SchemaBinary provides actual encode/decode adapters (`packages/effect/benchmark/schema/SchemaBinary.ts:356`). Runtime decode numbers remain UNMEASURED. |

## Provenance and concurrent-write receipt

Another writer created the requested Markdown filenames and separate `*-diagnostics.log` receipts during this lane. This lane did not overwrite those reports or substitute its timings into their earlier tables. The linked supplements distinguish both evidence sets and correct public/internal classification. Prevent recurrence with one owner per deliverable path. Changes in this lane remained under this research directory; no git mutation, network, dependency build or full test suite was run.
