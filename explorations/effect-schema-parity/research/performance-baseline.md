# Performance baseline — 2026-09-12

| Provenance | Verified value |
|---|---|
| Upstream reference | `51d4a2f08a5c7691dc876415bc9fc0ecf467e153` (`git -C .repos/effect rev-parse HEAD`) |
| Installed dependency | rc.115; **repo** `package.json:161`, `node_modules/effect/package.json:4` |
| Compiler | `bun run tsc --version` → `7.0.2+effect-tsgo.0.39.1`; `readlink node_modules/.bin/tsc` → `../@typescript/native/bin/tsc` |
| Measurement mode | One fresh build-info destination per package; `--noEmit --extendedDiagnostics`; all package invocations exited 0 |
| Filesystem boundary | Compiler build-info redirected into this research directory; inherited destination is outside the permitted write scope (**repo** `tsconfig.base.json:7`) |
| Scope | Individual package projects including their resolved dependency declarations; no full build, no test suite, no network, no changes to application/library source |

Upstream citations are relative to `.repos/effect/`; **repo** citations are relative to beep-effect. These are measurements of the current dirty checkout, not an isolated historical revision and not a before/after optimization result. A baseline alone cannot justify a readability regression.

## What initialization optimization actually changed

Evidence command: `git -C .repos/effect show 657254b821 -- packages/effect/src packages/effect/runtimeperf`.

| Change | Before → after | Current upstream evidence | Consumer action / performance interpretation |
|---|---|---|---|
| Constructor parser | `makeEffect(schema)` immediately projected/compiled the type-side AST → captures AST and initializes parser with `??=` on first construction call | `packages/effect/src/SchemaParser.ts:43` | Automatic after upgrade; rc.115 already has it. Construction shifts work to first `.make`/`.makeEffect` use. Do not call a cold schema benchmark a warm decode benchmark. |
| Schema function options | Always spreads options and copies property descriptors → ordinary options use Object.assign, with descriptor path retained for own name/length/__proto__ | `packages/effect/src/internal/schema/make.ts:26` | Automatic; no consumer rewrite. Special-property semantics remain guarded. |
| Duplicate field validation | map/filter/indexOf over property names → one Set-backed pass | `packages/effect/src/SchemaAST.ts:2757` | Removes quadratic comparison pattern for wide objects; actual speedup on this workstation UNVERIFIED. |
| Record key validation | Materializes `toEncoded(ast)` → walks final encoding and permitted key-node tags | `packages/effect/src/SchemaAST.ts:2588` | Avoids eager encoded-tree derivation during construction; no public API change. |
| Template initialization | WeakSet → short-lived Set for validated parts; defers formatting ordinary index-path strings | `packages/effect/src/SchemaAST.ts:1380`, `packages/effect/src/SchemaAST.ts:1492` | Automatic; encoding rejection rules remain. |
| Recursive thunks | Generic memoizeThunk closure → local nullish-assignment caches in Suspend, formatter and equivalence | `packages/effect/src/SchemaAST.ts:3891`, `packages/effect/src/internal/schema/toFormatter.ts:225`, `packages/effect/src/internal/schema/toEquivalence.ts:156` | Automatic. The removed memoizeThunk was internal; it is not a supported consumer migration target. |
| Added benchmark coverage | Object creation at different widths, encoded Record creation, first make, large template, warm make | `packages/effect/runtimeperf/suites/schema/fixtures/cold.ts:17`, `packages/effect/runtimeperf/suites/schema/fixtures/adapters.ts:14` | Reuse measurement boundaries; no type-instantiation improvement is established by this runtime patch. |

## Import ranking and type-check numbers

Import census command (default rg ignore rules; TS/TSX only):

```sh
rg -n '(?:from\s*|import\s*\(|require\s*\()\s*["\x27]@beep/schema(?:/[^"\x27]*)?["\x27]' packages apps -g '*.ts' -g '*.tsx'
```

Group each hit by the nearest ancestor containing `package.json`; count hit lines and distinct file paths. This is a lexical import census: docs/examples inside TS source can match, re-export `from` lines match, and multiline syntax can evade it. Exclude `@beep/schema` itself when ranking external consumers. Both file count and matching-line count select the same external packages. Broader `rg -l '@beep/schema' packages apps` includes manifests and documentation and is not an import count.

| Package | Matching files | Matching import lines | Selection |
|---|---:|---:|---|
| `@beep/schema` | 319 | 1,351 | Baseline target; includes self-importing tests/docs/examples |
| `@beep/repo-cli` | 330 | 531 | Heaviest external consumer |
| `@beep/law-practice-domain` | 101 | 165 | Next heaviest external consumer |

Executed commands (requested command plus the necessary write-scope override):

```sh
bun run tsc -p packages/foundation/modeling/schema/tsconfig.json --noEmit --extendedDiagnostics --tsBuildInfoFile explorations/effect-schema-parity/research/schema.baseline.tsbuildinfo
bun run tsc -p packages/tooling/tool/cli/tsconfig.json --noEmit --extendedDiagnostics --tsBuildInfoFile explorations/effect-schema-parity/research/repo-cli.baseline.tsbuildinfo
bun run tsc -p packages/law-practice/domain/tsconfig.json --noEmit --extendedDiagnostics --tsBuildInfoFile explorations/effect-schema-parity/research/law-practice-domain.baseline.tsbuildinfo
```

The patched compiler accepted extendedDiagnostics, so the TypeScript JS fallback was unnecessary. Stdout/stderr receipts are sibling files. Build-info files were fresh for these measurements and were removed after recording the results. Future before/after runs must also start with fresh build-info destinations; do not compare an incremental rerun to this baseline.

Metric extraction command:

```sh
rg -n '^(Files|Types|Instantiations|Memory used|Check time|Total time|BuildInfo read time):' explorations/effect-schema-parity/research/*-diagnostics.log
```

| Package / log | Instantiations | Types | Check time | Memory used, compiler-reported | Files | Total time | Exit |
|---|---:|---:|---:|---:|---:|---:|---:|
| schema / [schema-diagnostics.log](schema-diagnostics.log) | 1,307,910 | 427,107 | 0.427 s | 728,957 K | 1,025 | 0.671 s | 0 |
| repo-cli / [repo-cli-diagnostics.log](repo-cli-diagnostics.log) | 7,786,120 | 2,028,265 | 3.628 s | 3,697,902 K | 2,374 | 4.536 s | 0 |
| law-practice-domain / [law-practice-domain-diagnostics.log](law-practice-domain-diagnostics.log) | 1,289,820 | 375,500 | 0.645 s | 1,284,659 K | 1,454 | 1.414 s | 0 |

| Interpretation limit | Consequence |
|---|---|
| References/declarations resolved from existing workspace state | Counts include the resolved program; they do not isolate the marginal cost of @beep/schema imports. No dependency rebuild was performed. |
| Single sample; no process isolation or host-load control | Times/memory are observed baseline values, not confidence intervals, peak RSS measurements, or regression thresholds. |
| Different source programs | Law-practice can have fewer types than schema itself despite depending on it; avoid adding package counts together or dividing by import count as a causal metric. |
| Compiler version matters | Compare with the same effect-tsgo binary and flags; JS TypeScript results would form a different baseline. |
| Current upstream and installed versions already include initialization change | No measured parent-versus-657254b821 speedup. Runtime decode throughput was intentionally not run; the requested harness is proposed below. |

## Type-instantiation drivers: evidence versus folklore

Discovery commands:

```sh
rg -n -i 'instantiat|type.check|performance|recursive|suspend|class.*struct|struct.*class' .repos/effect/packages/effect/SCHEMA.md
rg -n 'type (View|MakeInView|Encoded|AppendType)|interface (Union|Class|brand|suspend)|type Intersect' .repos/effect/packages/effect/src/Schema.ts
rg --files .repos/effect/packages/effect/typeperf/suites/schema/fixtures
```

| Candidate cost driver | Verified mechanism / evidence | Measurement status |
|---|---|---|
| Wide/deep Struct, optional/mutable/default fields | Multiple mapped conditional projections compute Type, Encoded, Iso, MakeIn and service unions; optional/mutable paths add Pick/Omit/intersections. `packages/effect/src/Schema.ts:3173`, `:3199`, `:3275` | Mechanism verified. Relative depth/width costs and TS2589 thresholds **UNVERIFIED**. Upstream fixtures separate required/optional/mutable/mixed structs. |
| Union nesting and width | Member maps project each view and index by number; nested members retain their own generic structure. `packages/effect/src/Schema.ts:4673` | Mechanism verified; no evidence here that all union nesting is exponential. `typeperf/suites/schema/fixtures/union.ts` is a bounded measurement lead. |
| Template literal products | Recursive Encoded tuple fold and AppendType interpolations compute literal strings; parser Type recursively constructs tuple types. `packages/effect/src/Schema.ts:2695`, `:2706`, `:2785` | Mechanism verified; claims about blow-up for a particular literal-product cardinality **UNVERIFIED** until measured. |
| Class versus Struct | Class retains Self/Inherited, declaration+codec structure, conditional constructor args and extension-field assignment; Struct computes field views. `packages/effect/src/Schema.ts:13684`, `:13705`, `:13763` | “Class always cheaper” and “Struct always cheaper” are both **UNVERIFIED**. Class changes runtime representation too (`packages/effect/SCHEMA.md:3565`). |
| Recursive schemas / suspend | Explicit Codec annotation stabilizes self-reference; docs describe implicit-any failure without it. Reusing one lazy reference avoids duplicated lazy values. `packages/effect/SCHEMA.md:2110`, `:2128`, `:2186`; `packages/effect/src/Schema.ts:4887` | Need annotations for sound inference. “suspend automatically fixes deep-instantiation cost” **UNVERIFIED**; runtime laziness is not a type-check benchmark. |
| Brands | brand wraps projected schema types with branded types while retaining the underlying generic schema. `packages/effect/src/Schema.ts:5015` | Marginal and stacked-brand cost **UNVERIFIED**. Upstream has a brand fixture; it was not run. |
| Tuple / TupleWithRest / StructWithRest | Recursive tuple projections and intersection of records' views. `packages/effect/src/Schema.ts:4061`, `:4289`, `:3867` | Mechanism verified; compare equivalent forced views, not only schema declarations. |
| Codec derivation and statics | toCodecJson/StringTree/Type/Encoded create further schema views; local codec statics may retain generic type surfaces (**repo** `packages/foundation/modeling/schema/src/SchemaUtils/withCodecStatics.ts`) | Attribution of measured package cost to statics **UNVERIFIED**; no basis to remove them on performance grounds yet. |

Upstream already has **22** schema typeperf fixture files (count `rg --files .../typeperf/suites/schema/fixtures | wc -l`). The harness subtracts a shared baseline and gates instantiations/types, not wall time (`packages/effect/typeperf/README.md:3`, `:12`, `:19`). It explicitly forces exported type views (`:96`). This is a stronger starting point than speculative “Class is faster” rules. No claim that SCHEMA.md itself documents type-check performance rankings: its performance section at `packages/effect/SCHEMA.md:40` is runtime data.

## Existing runtime benchmarks and minimal proposed harness

Discovery/count commands:

```sh
rg -n 'bench' packages/foundation/modeling/schema
rg --files --hidden -g '!node_modules' -g '!.git' -g '!.repos' | rg '(^|/)(bench[^/]*|runtimeperf)/'
rg --files .repos/effect/packages/effect/benchmark/schema
rg --files .repos/effect/packages/effect/runtimeperf/suites/schema/fixtures
rg -n 'decode|encode|Bench|validate' .repos/effect/packages/effect/benchmark/schema/*.ts .repos/effect/packages/effect/runtimeperf/suites/schema/fixtures/*.ts
```

| Surface | Verified result | Relevance |
|---|---|---|
| Local schema package | 0 matching `bench` lines under default ignore rules | No existing in-package benchmark found. Not a claim about ignored files. |
| Local bench-prefixed/runtimeperf directories | 0 discoverable file paths from command above | Workbench filenames are not benchmark harnesses. |
| Upstream benchmark/schema | 4 files: SchemaBinary.ts/.md, SchemaError.ts, Optic.ts | SchemaBinary contains actual schema/encoding cases (`packages/effect/benchmark/schema/SchemaBinary.ts:11`); SchemaError is constructor cost (`SchemaError.ts:15`), not decoding. |
| Upstream runtimeperf schema fixtures | 4 files: cold.ts, adapters.ts, behavior.ts, comparison.ts | Cold creation/first use, adapter overhead and steady-state decode; `packages/effect/runtimeperf/suites/schema/fixtures/comparison.ts:5` constructs parser outside run and validates result separately. |
| Upstream runtimeperf schema-benchmarks | Product-schema cross-library suite | See `packages/effect/runtimeperf/README.md:23`; SCHEMA.md published numbers are upstream historical measurements, not this lane's results. |

Proposed only; no harness built or runtime trial executed:

| Phase | Smallest useful measured design | Required output |
|---|---|---|
| Type cost first | Same before/after consumer fixture importing public package entry points, same compiler, fresh build-info path. Force Type/Encoded/Iso/MakeIn. Include baseline import-only program; compare actual intended replacement, e.g. NormalizedBooleanString versus BooleanLiterals. | Raw diagnostics, compiler/version, source hashes, baseline-subtracted instantiations/types; same package checks as above for integration impact. |
| Construction | Fixed object fields with widths 2/32/256, encoded Record, fixed template parts; measure schema-only creation separately from schema+first `.make` and schema+first decode. | ns/op, median/spread across fresh-process replicates; separate setup from timed operation. |
| Warm decode | Hoist schema and Schema.decodeUnknownResult / Schema.decodeUnknownSync adapters outside timed loop. Valid payload and one invalid field at the end; compare errors:first and errors:all separately. Keep exception handling only in the invalid sync case. Add encode using the same declared semantic contract. | Throughput/latency by adapter, validity and error mode; failure/output correctness checked outside timed loop. Sync versus Result differences must include the chosen error-handling contract. |
| Real hot path | Select one measured application hot path before expanding synthetic coverage; exercise identical accepted input domain where possible. For intentional behavior changes, partition shared-domain performance and changed-domain correctness. | Before/after table with input-set hash and acceptance differences; no conflation of rejected work with faster decoding. |
| Sampling | Warm up, fixed iteration budget, deterministic fixtures and consumed output; proposed minimum five fresh-process replicates with order alternated. Record Node/Bun and CPU, host load and package revision. | Median and dispersion, raw samples, measured allocation/peak RSS only if separately instrumented. No unmeasured claims. |

Do not run upstream compare commands unchanged in this lane: the typeperf comparison runner creates worktrees (`packages/effect/typeperf/README.md:73`), and runtimeperf may materialize fixtures. Those writes exceed the research-only boundary. Reuse the design in an authorized later implementation lane.

## Independent verification correction

See [performance-verification-supplement.md](performance-verification-supplement.md) for this concurrent lane's evidence. **The earlier recommendation to adopt Schema.BooleanLiterals is withdrawn: it is marked `@internal` and absent from installed public declarations. Schema.withArrayLengthConstraints is also internal.** Preserve the independent logs and census rather than mixing measurement samples.
