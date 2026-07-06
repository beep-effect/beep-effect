# S3 Rule-Card Notes — merged from per-batch fragments (P1 baseline, 2026-07-05/06)


---

<!-- batch FA -->
# S3 Rule-Card Notes — Batch FA

## SFV4-getsomes-struct

- Detector heuristic: flag `R.getSomes({...})` from `effect/Record` when the argument is a heterogeneous struct literal of `Option` values. The repo-local struct helper is `O.getSomesStruct` at `packages/foundation/modeling/utils/src/Option.ts:102`; Effect v4 `R.getSomes` is the homogeneous record helper at `.repos/effect-v4/packages/effect/src/Record.ts:824`.
- D5 ordering: keep this card non-blocking via the per-owner policy until the Law 20/47 amendment lands. Remediation sweeps must not run before that amendment. Every discovery finding for this card remains `mechanization: "judgment"` until then.
- Batch FA scan result: no `R.getSomes` call sites were found in the scanned source for `@beep/nlp-processing`, `@beep/observability`, `@beep/semantic-web`, `@beep/md`, or `@beep/identity`.
- Existing positive pattern examples in this batch: `packages/foundation/capability/nlp-processing/src/Graph/TextGraph.ts:100`, `packages/foundation/capability/nlp-processing/src/Graph/AnnotatedTextGraph.ts:243`, and `packages/foundation/capability/semantic-web/src/adapters/jsonld-document.ts:146` already use `O.getSomesStruct`.
- False-positive escape hatch from this batch: `packages/foundation/modeling/identity/src/Id.ts:1331` conditionally emits `iri` and `curie` as an all-or-none binding pair. Do not auto-rewrite that shape to independent-key `O.getSomesStruct`; doing so would change the pair invariant if one side became undefined.

---

<!-- batch FB -->
# S3 Rule-Card Notes - batch FB

## SFV4-getsomes-struct

- Detector heuristic: flag `R.getSomes({...})` from `effect/Record` only when the argument is a fixed heterogeneous struct of `Option` values whose keys are known at the call site. Those call sites should use `O.getSomesStruct({...})`, whose definition is `packages/foundation/modeling/utils/src/Option.ts:102`.
- D5 ordering: keep this card non-blocking via the per-owner policy until the Law 20/47 amendment and mirrors are merged. The remediation sweep must not run early; even obvious heterogeneous struct-spread findings stay `mechanization: "judgment"` until D5 is cleared.
- Batch FB escape-hatch audit: no legitimate homogeneous dynamic-key `R.getSomes` call sites were found in the eight scanned package `src/` trees. The only `R.getSomes` hit was `packages/foundation/modeling/utils/src/Option.ts:103`, the implementation of `O.getSomesStruct`; record it as a definition-site exception, not a finding or escape-hatch fixture.
- Already-good target usage seen in this batch: `@beep/editor` uses `O.getSomesStruct` for Lexical optional JSON props and React prop spreading (`artifact-ref-node.tsx`, `composer.tsx`, `chat-composer.tsx`). Those are useful positive fixtures for heterogeneous known-key struct composition.

---

<!-- batch FC -->
# S3 RULE-CARD-NOTES batch-FC

Packages scanned: `@beep/html`, `@beep/nlp`, `@beep/rdf`.

## SFV4-getsomes-struct detector notes

- Detector heuristic stays: flag `R.getSomes({...})` from `effect/Record` only when the argument is a heterogeneous struct literal of `Option` values whose keys are fixed fields. The target remains `O.getSomesStruct({...})`, verified at `packages/foundation/modeling/utils/src/Option.ts:102`; `R.getSomes` remains the homogeneous dynamic-key dictionary form, verified at `.repos/effect-v4/packages/effect/src/Record.ts:824`.
- D5 ordering: keep this card non-blocking via the per-owner policy until effect-first Laws 20 and 47 and mirrors are amended. Do not activate a blocking `R.getSomes` -> `O.getSomesStruct` sweep before that amendment lands.
- Escape hatches from this batch: no `R.getSomes` calls were found in `@beep/html`, `@beep/nlp`, or `@beep/rdf`, so this batch produced no concrete homogeneous-dictionary examples. `@beep/rdf` already uses the intended heterogeneous struct helper at `packages/foundation/modeling/rdf/src/Rdf.ts:931` for `{ language: O.fromUndefinedOr(language) }`; that is a positive fixture candidate, not an escape hatch.
- Refinement note: keep manual conditional object spreads as a sibling detector only when the spread builds optional fixed fields independently. Do not flag all-or-none public annotation pairs or standard wire-shape unions; those belong in package-specific S3 exceptions, not this card.

---

<!-- batch FD -->
# S3 Rule-Card Notes - Batch FD

Packages scanned: `@beep/schema`.

## SFV4-getsomes-struct

- Detector heuristic stays: flag `R.getSomes({...})` from `effect/Record` only when the argument is an inline fixed-key heterogeneous struct literal of `Option` values. The target is `O.getSomesStruct({...})`, verified at `packages/foundation/modeling/utils/src/Option.ts:102`; Effect v4 `R.getSomes` is the homogeneous dynamic-key dictionary helper, verified at `.repos/effect-v4/packages/effect/src/Record.ts:824`.
- D5 ordering: keep this card non-blocking via the per-owner policy until effect-first Laws 20 and 47 and mirrors are amended. Do not activate a blocking `R.getSomes` -> `O.getSomesStruct` sweep before that amendment lands; every discovery finding for this card stays `mechanization: "judgment"` until then.
- Batch FD scan result: no `R.getSomes` call sites were found under `packages/foundation/modeling/schema` after excluding generated/build/doc/coverage surfaces, so this package produced no homogeneous-dictionary escape-hatch examples and no `SFV4-getsomes-struct` findings.
- Positive fixtures from this package: `packages/foundation/modeling/schema/src/MutableHashMap.ts:219` and `packages/foundation/modeling/schema/src/MutableHashSet.ts:181` already use `O.getSomesStruct` for fixed-key constraint option structs with `O.fromUndefinedOr(...)`.
- Refinement note from this package: keep the detector focused on `R.getSomes` inline object literals. The schema package contains many intentional public wire/config unions and schema-tooling implementation literals; those belong in S3 package exceptions, not in this card.

---

<!-- batch FE -->
# S3 Rule-Card Notes - Batch FE

Packages scanned: `@beep/data`.

## SFV4-getsomes-struct

- Detector heuristic stays: flag `R.getSomes({...})` or `Record.getSomes({...})` from `effect/Record` only when the argument is an inline fixed-key heterogeneous struct literal of `Option` values. The target is `O.getSomesStruct({...})`, verified at `packages/foundation/modeling/utils/src/Option.ts:102`; Effect v4 `R.getSomes` is the homogeneous dynamic-key dictionary helper, verified at `.repos/effect-v4/packages/effect/src/Record.ts:824`.
- D5 ordering: keep this card non-blocking via the per-owner policy until effect-first Laws 20 and 47 and mirrors are amended. Do not activate a blocking `R.getSomes` -> `O.getSomesStruct` sweep before that amendment lands; every discovery finding for this card stays `mechanization: "judgment"` until then.
- Batch FE scan result: no `R.getSomes`, `Record.getSomes`, or bare `getSomes(` call sites were found under non-generated `@beep/data` source, tests, or dtslint files, so this package produced no `SFV4-getsomes-struct` findings and no concrete homogeneous-dictionary `R.getSomes` escape-hatch examples.
- False-positive escape hatch from this batch: `packages/foundation/primitive/data/src/internal/data/mime-types/index.ts:156`, `:176`, and `:177` use `R.empty<...>()` for homogeneous mutable dictionary caches (`MimeType -> MimeTypeDefinition`, `MimeType -> FileExtension[]`, and `FileExtension -> MimeType`). Keep the detector keyed to `getSomes(...)` calls and inline object literals; do not broaden it to generic `effect/Record` usage.
- Package-boundary note from this batch: `@beep/data` is a primitive data package with dependencies limited to `@beep/utils` and `effect`, while `@beep/schema` depends on `@beep/data`. Raw data constants here should become downstream `LiteralKit` / `MappedLiteralKit` wrappers in `@beep/schema` when schema behavior is needed, not imports from `@beep/schema` back into `@beep/data`.

---

<!-- batch FF -->
## SFV4-getsomes-struct

- Detector heuristic stays: flag `R.getSomes({...})` or `Record.getSomes({...})` from `effect/Record` only when the argument is an inline fixed-key heterogeneous struct literal of `Option` values. The target is `O.getSomesStruct({...})`, verified at `packages/foundation/modeling/utils/src/Option.ts:102`; Effect v4 `R.getSomes` is the homogeneous dynamic-key dictionary helper, verified at `.repos/effect-v4/packages/effect/src/Record.ts:824`.
- D5 ordering: keep this card non-blocking via the per-owner policy until effect-first Laws 20 and 47 and mirrors are amended. Do not activate a blocking `R.getSomes` -> `O.getSomesStruct` remediation sweep before that amendment lands; every discovery finding for this card stays `mechanization: "judgment"` until then.
- Batch FF scan result: no `R.getSomes`, `Record.getSomes`, or `effect/Record` imports were found under non-generated `@beep/ui` package TypeScript/TSX surfaces, so this package produced no `SFV4-getsomes-struct` findings and no concrete homogeneous-dictionary `R.getSomes` escape-hatch examples.
- Positive examples from this package: `packages/foundation/ui-system/ui/src/hooks/use-scribe.ts:175-179` and `:248-256`, plus `packages/foundation/ui-system/ui/src/components/button-group.tsx:113`, already use `O.getSomesStruct` for fixed optional React/Web API option structs.
- False-positive refinement from this package: keep S3 detectors from broadening component prop literal families and browser/third-party JSX adapter casts into schema findings. Representative carve-outs are recorded in `beep__ui.json` for `CalendarEventCard` prop render state, `OrbBackground` visual prop style maps, and the `LiveWaveform` WebKit AudioContext compatibility cast.

---

<!-- batch DA -->
# S3 Rule-Card Notes Batch DA

## SFV4-getsomes-struct

Package: `@beep/acp` (`packages/drivers/acp`)

Detector heuristic confirmed: flag `R.getSomes({...})` from `effect/Record` only when the inline object literal is a heterogeneous Option struct whose keys have distinct value types and should retain literal keys through `O.getSomesStruct` (`packages/foundation/modeling/utils/src/Option.ts:102`). `Record.getSomes` is verified as the homogeneous record helper in effect v4 at `.repos/effect-v4/packages/effect/src/Record.ts:824-836`; `O.getSomesStruct` wraps it while preserving heterogeneous per-key types at `packages/foundation/modeling/utils/src/Option.ts:80-103`.

D5 ordering: keep this card non-blocking via the per-owner policy. Do not activate a remediation sweep until effect-first Law 20 and Law 47, plus mirrors, explicitly prefer `O.getSomesStruct` for heterogeneous struct-spreads while preserving `R.getSomes` for homogeneous dictionaries.

Escape hatch from this package: `packages/drivers/acp/src/Acp.errors.ts:194,218,242,287,311,335,359,383` are all single-key optional `data` spreads. They are not heterogeneous Option structs, so they were inventoried as a false-positive exception rather than actionable `SFV4-getsomes-struct` findings. No homogeneous dynamic-key `R.getSomes` dictionary use was found in `@beep/acp`.

Fixture/refinement candidate: add a negative fixture for `R.getSomes({ data: O.fromUndefinedOr(data) })` or otherwise require at least two keys with distinguishable value expressions before treating an inline literal as the heterogeneous-struct smell.

---

<!-- batch DB -->
# S3 Rule-Card Notes - batch DB

## SFV4-getsomes-struct

- Detector heuristic: flag `R.getSomes({...})` from `effect/Record` when the call participates in fixed known-key Option struct assembly that should preserve per-key value types through `O.getSomesStruct({...})`. The repo-local helper is verified at `packages/foundation/modeling/utils/src/Option.ts:102`; Effect v4 `R.getSomes` is the homogeneous record helper at `.repos/effect-v4/packages/effect/src/Record.ts:824`.
- D5 ordering: keep this card non-blocking via the per-owner policy. Do not run the remediation sweep until effect-first Law 20 and Law 47, plus mirrors, prefer `O.getSomesStruct` for heterogeneous struct-spreads while preserving `R.getSomes` for homogeneous dictionaries. Every `SFV4-getsomes-struct` finding in this batch is held at `mechanization: "judgment"`.
- Positive finding from this batch: `packages/drivers/runpod/src/Runpod.service.ts:580` and `:583` are adjacent single-key `R.getSomes` spreads that together form one heterogeneous diagnostics struct (`cause` string plus `status` number). The detector should either flag adjacent spreads in one object literal as one finding or prompt the remediation agent to coalesce them into one `O.getSomesStruct` call.
- False-positive escape hatches from this batch: `packages/drivers/firecrawl/src/Firecrawl.errors.ts:302` and `packages/drivers/runpod/src/RunpodDocs.service.ts:147` are single-key optional payload spreads. They are not homogeneous dynamic dictionaries, but they are also not heterogeneous structs; inventory them as exceptions, not actionable `SFV4-getsomes-struct` findings.
- Already-good target usage seen in this batch: `@beep/firecrawl` uses `OptionUtils.getSomesStruct` for diagnostics and watcher events at `packages/drivers/firecrawl/src/Firecrawl.service.ts:297,394,410,474,816`; `@beep/runpod` uses `O.getSomesStruct` in its error constructors at `packages/drivers/runpod/src/Runpod.errors.ts:151,167,183,226`.
- No legitimate homogeneous dynamic-key `R.getSomes` dictionary use was found in `@beep/firecrawl`, `@beep/runpod`, or `@beep/wink`.

---

<!-- batch DC -->
# S3 Rule-Card Notes Batch DC

## SFV4-getsomes-struct

- Detector heuristic: flag `R.getSomes({...})` from `effect/Record` only when the inline object literal is a fixed, heterogeneous Option struct whose per-key value types should be preserved by `O.getSomesStruct({...})`. The repo-local helper is verified at `packages/foundation/modeling/utils/src/Option.ts:102`; Effect v4 `Record.getSomes` is verified as the homogeneous record helper at `.repos/effect-v4/packages/effect/src/Record.ts:824`.
- D5 ordering: keep this card non-blocking via the per-owner policy. Do not run or activate the remediation sweep until effect-first Law 20 and Law 47, plus mirrors, prefer `O.getSomesStruct` for heterogeneous struct-spreads while preserving `R.getSomes` for homogeneous dictionaries. No positive `SFV4-getsomes-struct` findings were recorded in this batch.
- False-positive escape hatches from `@beep/box`: `packages/drivers/box/src/Box.service.ts:93` is a homogeneous optional string pair (`enterpriseId`/`userId`); `packages/drivers/box/src/Box.errors.ts:177` and `:218` split string-ish groups from singleton `context` and `status` calls. Inventory these as exceptions, not actionable heterogeneous-struct findings.
- False-positive escape hatches from `@beep/xai`: `packages/drivers/xai/src/XAi.service.ts:238`/`:408` and `packages/drivers/xai/src/XAi.errors.ts:124`/`:150` are singleton optional payload compactions. They are not heterogeneous structs. `packages/drivers/xai/src/XAiLanguageModel.service.ts:191` is already-good `O.getSomesStruct` usage.
- False-positive escape hatches from `@beep/nlp-mcp`: `packages/drivers/nlp-mcp/src/StreamingHandlers.ts:348`, `:389`, and `:405`, plus `packages/drivers/nlp-mcp/src/Streaming/DatasetLoader.ts:475`, are homogeneous optional boolean option objects; `DatasetLoader.ts:576` is a singleton optional `sizeBytes` spread. These should remain non-actionable for this card.
- Detector refinement: require either mixed value domains in the same `R.getSomes({...})` object or evidence that adjacent single-key spreads participate in one heterogeneous constructor payload. Do not treat `A.getSomes` array Option compaction as part of this card.

---

<!-- batch DD -->
# S3 Rule-Card Notes - Batch DD

Packages scanned: `@beep/postgres`, `@beep/m365`, `@beep/openai-compat`, `@beep/govinfo`, `@beep/venice-ai`.

## SFV4-getsomes-struct

- Detector heuristic stays: flag `R.getSomes({...})` from `effect/Record` only when the argument is an inline fixed-key heterogeneous struct literal of `Option` values. The target is `O.getSomesStruct({...})`, verified at `packages/foundation/modeling/utils/src/Option.ts:102`; Effect v4 `R.getSomes` is the homogeneous dynamic-key dictionary helper, verified at `.repos/effect-v4/packages/effect/src/Record.ts:824`.
- D5 ordering: keep this card non-blocking via the per-owner policy until effect-first Laws 20 and 47 and mirrors are amended. Do not activate a blocking `R.getSomes` -> `O.getSomesStruct` sweep before that amendment lands; every discovery finding for this card stays `mechanization: "judgment"` until then.
- Positive finding from this batch: `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:599` passes one fixed object literal containing optional numbers, booleans, response-format objects, stream flags, tool choice, tool arrays, and nullable sampling fields to `R.getSomes`; this is a good fixture for `SFV4-getsomes-struct`.
- Escape hatches from `@beep/openai-compat`: `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts:441` is a singleton `tool_calls` optional spread and should remain non-actionable.
- Escape hatches from `@beep/venice-ai`: `packages/drivers/venice-ai/src/VeniceAI.service.ts:594`, `:597`, `:620`, `:1336`, `:1339`, and `:1488` are singleton optional spreads or deliberately split single-field calls. They are not heterogeneous structs.
- Positive non-findings: `@beep/m365` already uses `getSomesStruct` for mixed optional config/request assembly at `packages/drivers/m365/src/M365.service.ts:991` and for MSAL cache options at `packages/drivers/m365/src/M365.auth.ts:344`; `@beep/govinfo` already uses `O.getSomesStruct` in `packages/drivers/govinfo/src/Govinfo.errors.ts:117` and `:132`.
- Refinement note: do not flag `A.getSomes` array compaction, singleton `R.getSomes` calls, or split adjacent one-key calls unless the detector can prove they are one fixed heterogeneous constructor payload.

---

<!-- batch DE -->
# S3 Rule-Card Notes - Batch DE

Packages scanned: `@beep/ffmpeg`, `@beep/phoenix`, `@beep/face-detection`, `@beep/drizzle`, `@beep/duckdb`, `@beep/hubspot`.

## SFV4-getsomes-struct

- Detector heuristic stays: flag `R.getSomes({...})` from `effect/Record` only when the argument is an inline fixed-key heterogeneous struct literal of `Option` values. The target is `O.getSomesStruct({...})`, verified at `packages/foundation/modeling/utils/src/Option.ts:102`; Effect v4 `R.getSomes` is the homogeneous dynamic-key dictionary helper, verified at `.repos/effect-v4/packages/effect/src/Record.ts:824`.
- D5 ordering: keep this card non-blocking via the per-owner policy until effect-first Laws 20 and 47 and mirrors are amended. Do not activate a blocking `R.getSomes` -> `O.getSomesStruct` sweep before that amendment lands; every discovery finding for this card stays `mechanization: "judgment"` until then.
- Positive finding from this batch: `packages/drivers/ffmpeg/src/FFmpeg.service.ts:262` is not an `R.getSomes` call, but it is a manual sibling shape worth a future fixture if the card grows beyond the core detector: `maybe(key, value)` hides fixed optional constructor payload spreads at `:299-303` and heterogeneous `outTimeSeconds`/`speed` spreads at `:445-446`.
- Escape hatch from `@beep/phoenix`: `packages/drivers/phoenix/src/Phoenix.errors.ts:169` is a singleton optional `cause` spread via `R.getSomes({ cause: ... })`; it is not a heterogeneous struct and was inventoried as a false-positive exception.
- Positive non-findings: `@beep/face-detection` already uses `O.getSomesStruct` for the optional `imagePath` payload at `packages/drivers/face-detection/src/FaceDetection.service.ts:288`; `@beep/drizzle` uses it for mixed `query`/`params` context at `packages/drivers/drizzle/src/Drizzle.errors.ts:56`; `@beep/duckdb` uses it for mixed connection/error context at `packages/drivers/duckdb/src/DuckDb.service.ts:180` and `packages/drivers/duckdb/src/DuckDb.errors.ts:141`; `@beep/hubspot` uses it for config and error option structs at `packages/drivers/hubspot/src/HubSpot.service.ts:533` and `packages/drivers/hubspot/src/HubSpot.errors.ts:111`.
- No legitimate homogeneous dynamic-key `R.getSomes` dictionary use was found in this batch. Refinement note: keep singleton `R.getSomes` calls non-actionable, and do not flag packages already using `O.getSomesStruct` unless a separate law explicitly asks for style-only cleanup.

---

<!-- batch DF -->
# S3 RULE-CARD-NOTES batch DF

## `SFV4-getsomes-struct`

- The detector should target fixed heterogeneous Option structs assembled through `R.getSomes` spreads, including the adjacent single-key form found in this batch:
  - `packages/drivers/uspto/src/Uspto.errors.ts:95`
  - `packages/drivers/libpff/src/Libpff.errors.ts:94`
  - `packages/drivers/tika/src/Tika.errors.ts:95`
- Remediation target is `O.getSomesStruct(...)`, verified at `packages/foundation/modeling/utils/src/Option.ts:102`. The rule card remains D5-held for remediation: every `SFV4-getsomes-struct` record in this batch is `mechanization: "judgment"` even when the local rewrite is straightforward.
- Do not flag homogeneous dynamic dictionaries. Batch DF false-positive fixtures:
  - `packages/drivers/uspto/src/Uspto.service.ts:132` uses a computed metadata key with homogeneous `Option<string>` values.
  - `packages/drivers/tika/src/Tika.tikaapp.ts:191` maps an arbitrary metadata record to homogeneous `Option<string>` values before `R.getSomes`.
  - `packages/drivers/sanity/src/Sanity.service.ts:396` passes a fixed config object, but the values normalize to homogeneous `Option<string>`; detectors should confirm per-field value domains before flagging.
  - Single-field spreads such as `packages/drivers/tika/src/Tika.service.ts:134` and `packages/drivers/discord/src/Discord.service.ts:163` are not heterogeneous struct findings.

## `SFV4-static-api`

- RDF adapters are good assisted fixtures for distinguishing in-repo schema-derived tagged unions from external declaration unions:
  - `packages/drivers/rdf-canonize/src/adapters/canonicalization.ts:93`, `:98`, and `:115` should prefer `Subject.match`, `ObjectTerm.match`, and `GraphTerm.match` from `@beep/rdf/Rdf`.
  - `packages/drivers/rdf-canonize/src/adapters/canonicalization.ts:136`, `:139`, and `:151` are external declaration unions and should prefer `Match.discriminatorsExhaustive("termType")`.
- Upstream Effect unions without per-variant helpers may be legitimate exceptions. `packages/drivers/discord/test/Discord.service.test.ts:44` branches on upstream `HttpBody._tag`; Effect v4 exposes `isHttpBody` but not a per-variant matcher/guard family for that local test use.

---

<!-- batch TA1 -->
# S3 Rule-Card Notes Batch TA1

## SFV4-getsomes-struct

Package: `@beep/repo-cli` (`packages/tooling/tool/cli`), part 1 scope only:
`src/commands/{AIMetrics,Architecture,Codex,Corpus,CreatePackage,Docgen,Docs,Files}/**`
plus `src/index.ts`.

Detector heuristic confirmed: flag `R.getSomes({...})` from `effect/Record` only
when the inline object literal is a heterogeneous Option struct whose keys carry
distinct value domains and the object is being spread into a typed constructor.
`Record.getSomes` is verified as the homogeneous record helper in effect v4 at
`.repos/effect-v4/packages/effect/src/Record.ts:824-836`; `O.getSomesStruct`
wraps it while preserving heterogeneous per-key types at
`packages/foundation/modeling/utils/src/Option.ts:83-103`.

D5 ordering: keep this card non-blocking via the per-owner policy. Do not
activate a remediation sweep until effect-first Law 20 and Law 47, plus mirrors,
explicitly prefer `O.getSomesStruct` for heterogeneous struct-spreads while
preserving `R.getSomes` for homogeneous dictionaries.

Positive fixture candidates from this batch:
- `packages/tooling/tool/cli/src/commands/CreatePackage/Handler.ts:1161`
  spreads `{ family: O.Option<PackageFamily>, kind: O.Option<PackageKind>,
  appKind: O.Option<AppKind> }` into `TemplateContext.make`.
- `packages/tooling/tool/cli/src/commands/Files/Files.service.ts:4272` and
  `:4294` spread `{ engine: O.Option<string>, format:
  O.Option<FileFormatFamily> }` into file-processing failure records.

Escape hatches from this batch:
- Single-key spreads are not findings: examples include
  `Codex/Codex.errors.ts:63`, `Docgen/Docgen.command.ts:597`,
  `Docs/Docs.aggregate.ts:53`, and the single-key entries grouped in
  `Files/Files.service.ts`.
- Homogeneous fixed structs are not findings for this card: examples include
  `AIMetrics/AIMetrics.command.ts:640` (epoch-millis window fields) and
  `Corpus/Corpus.service.ts:2463,2838` (all-string metadata/enrichment fields).
- Same-value string/text pairs should remain negative fixtures unless a future
  law intentionally broadens the card beyond mixed-type structs.

Fixture/refinement candidate: require at least two keys whose Option value
domains are distinguishable before treating an inline `R.getSomes({...})` spread
as `SFV4-getsomes-struct`. Keep single-key and all-same-domain structs as
non-actionable exceptions.

---

<!-- batch TA2 -->
# S3 Rule-Card Notes Batch TA2

## SFV4-getsomes-struct

Package: `@beep/repo-cli` (`packages/tooling/tool/cli`), part 2 scope only:
`src/commands/**` except `{AIMetrics,Architecture,Codex,Corpus,CreatePackage,Docgen,Docs,Files}`,
plus `src/internal/**` and `src/test/**`.

Detector heuristic confirmed: flag `R.getSomes({...})` from `effect/Record` only
when the inline object literal is a heterogeneous Option struct whose keys carry
distinct value domains and the object is being spread into a typed constructor.
`Record.getSomes` is verified as the homogeneous record helper in Effect v4 at
`.repos/effect-v4/packages/effect/src/Record.ts:824`; `O.getSomesStruct`
preserves per-key types at `packages/foundation/modeling/utils/src/Option.ts:102`.

D5 ordering: keep this card non-blocking via the per-owner policy. Do not
activate a remediation sweep until effect-first Law 20 and Law 47, plus mirrors,
explicitly prefer `O.getSomesStruct` for heterogeneous struct-spreads while
preserving `R.getSomes` for homogeneous dictionaries.

Positive fixture candidates from this batch:
- `packages/tooling/tool/cli/src/commands/Graphiti/Graphiti.errors.ts:107`
  spreads `{ command: Option<string>, exitCode: Option<number> }` into
  `GraphitiProxyOpsError.make`.
- `packages/tooling/tool/cli/src/commands/Quality/Quality.errors.ts:119`
  spreads `{ command: Option<string>, exitCode: Option<number> }` into
  `QualityScriptCommandError.make`.
- `packages/tooling/tool/cli/src/commands/Yeet/Yeet.errors.ts:70` spreads
  `{ command: Option<string>, exitCode: Option<number>, file: Option<string> }`
  into `YeetCommandError.make`.

Escape hatches from this batch:
- Homogeneous raw-string structs are not findings: `Graphiti/internal/ProxyConfig.ts:210`
  collects `Config.option(Config.string(...))` values before schema decoding.
- Single-key spreads are not findings: examples include
  `Quality/Quality.errors.ts:68`, `TsconfigSync/TsconfigSync.command.ts:1757`,
  `Yeet/internal/Verdict.ts:227`, and `Yeet/internal/Status.ts:303`.
- Homogeneous fixed structs are not findings: examples include
  `SyncDataToTs/SyncDataToTs.errors.ts:77` (targetId/file strings),
  `Yeet/internal/Status.ts:450` (numeric check counters), and
  `Yeet/internal/Status.ts:455` (PR string metadata).

Fixture/refinement candidate: require at least two inline object keys and at
least two distinguishable Option value domains before reporting. Preserve the
existing variable/identifier-argument escape hatch, and keep separately spread
single-key calls out of the actionable set unless a later law intentionally
broadens the rule.

---

<!-- batch TB -->
# S3 Rule-Card Notes - batch TB

## SFV4-getsomes-struct

- Package: `@beep/repo-utils` (`packages/tooling/library/repo-utils`)
- Detector heuristic: flag `R.getSomes({...})` from `effect/Record` when the argument is an inline heterogeneous `Option` struct literal whose keys carry different value domains. The replacement target remains `O.getSomesStruct` from `@beep/utils/Option`, verified at `packages/foundation/modeling/utils/src/Option.ts:102`; `R.getSomes` remains the homogeneous dictionary helper, verified at `.repos/effect-v4/packages/effect/src/Record.ts:824`.
- D5 ordering: keep this card non-blocking via the per-owner policy and do not run the remediation sweep until effect-first Law 20 and Law 47, plus mirrors, are amended to prefer `O.getSomesStruct` for heterogeneous struct-spreads while preserving `R.getSomes` for homogeneous dictionaries.
- Batch TB false-positive pass: no `R.getSomes` calls were found in `@beep/repo-utils` after excluding generated code and `test/fixtures/mock-monorepo/**`, so there are no homogeneous-dictionary escape-hatch examples from this package.
- Positive controls seen in this package: existing `O.getSomesStruct` usage in `src/FsUtils.ts:189-193` and `src/schemas/PackageJsonTools.ts:137-237` should not be reported by the `R.getSomes` detector.

---

<!-- batch TC -->
# S3 Rule-Card Notes - batch TC

## SFV4-getsomes-struct

- Packages: `@beep/repo-ai-metrics` (`packages/tooling/library/ai-metrics`) and `@beep/repo-docgen` (`packages/tooling/tool/docgen`).
- Detector heuristic: flag `R.getSomes({...})` from `effect/Record` only when the argument is an inline heterogeneous `Option` struct literal whose keys carry different value domains. The replacement target is `O.getSomesStruct` from `@beep/utils/Option`, verified at `packages/foundation/modeling/utils/src/Option.ts:102`; `R.getSomes` remains the homogeneous dictionary helper, verified at `.repos/effect-v4/packages/effect/src/Record.ts:824`.
- D5 ordering: keep this card non-blocking via the per-owner policy and do not run the remediation sweep until effect-first Law 20 and Law 47, plus mirrors, are amended to prefer `O.getSomesStruct` for heterogeneous struct-spreads while preserving `R.getSomes` for homogeneous dictionaries.
- Batch TC false-positive pass: `@beep/repo-ai-metrics` has two legitimate homogeneous dictionary uses in `src/otlp.ts:411` and `src/otlp.ts:436`; both assemble optional OTLP string attributes before `allowlistedAttributes: Record<string, AiMetricsOtlpAttributeValue>`. These should be fixture candidates for the homogeneous-dictionary escape hatch.
- Batch TC false-positive pass: `@beep/repo-docgen` has a one-key `R.getSomes({ reason: O.fromUndefinedOr(options.reason) })` in `src/ProofManifest.ts:382`. Treat single-key optional records as non-actionable for this card unless a future detector explicitly proves a heterogeneous struct shape.
- Positive controls seen in this batch: `@beep/repo-ai-metrics` already uses `O.getSomesStruct` heavily for heterogeneous optional assembly in `src/source-discovery.ts`, `src/privacy.ts`, `src/forwarder.ts`, and `src/derived-storage.ts`; the `R.getSomes` detector should not report those existing target-form uses.

---

<!-- batch TD -->
# S3 Rule-Card Notes - batch TD

## SFV4-getsomes-struct

- Packages: `@beep/repo-configs` (`packages/tooling/policy-pack/repo-configs`), `@beep/ai-sync` (`packages/tooling/library/ai-sync`), `@beep/test-utils` (`packages/tooling/test-kit/test-utils`), `@beep/lint-rules` (`packages/tooling/policy-pack/lint-rules`), and `@beep/infra` (`infra`, tooling family per `ops/progress.json` infraAssignment).
- Detector heuristic: flag `R.getSomes({...})` from `effect/Record` only when the argument is an inline heterogeneous `Option` struct literal whose fixed keys carry different value domains. The replacement target is `O.getSomesStruct` from `@beep/utils/Option`, verified at `packages/foundation/modeling/utils/src/Option.ts:102`; `R.getSomes` remains the homogeneous dictionary helper, verified at `.repos/effect-v4/packages/effect/src/Record.ts:824`.
- D5 ordering: keep this card non-blocking via the per-owner policy and do not run or auto-apply a remediation sweep until effect-first Law 20 and Law 47, plus mirrors, are amended and the owning family is deliberately flipped. Discovery records stay judgment-tier for this family.
- Batch TD false-positive pass: no actual `R.getSomes(...)` or `Record.getSomes(...)` calls were found in these five packages after excluding generated/build output. `packages/tooling/policy-pack/repo-configs/test/effect-steering-guidance.test.ts:28` contains the text `R.getSomes({...})` only as a documentation assertion; detectors should ignore string literals.
- Batch TD false-positive pass: `packages/tooling/policy-pack/lint-rules/test/oxlint-harness.ts:142` uses `A.getSomes` over an array of `Option` diagnostics, not `R.getSomes` over an object. This is outside the card and should remain an escape-hatch fixture.
- Positive controls seen in this batch: `@beep/ai-sync` already uses `O.getSomesStruct` in `src/transforms.ts:25` and `src/generator.ts:413`; `@beep/infra` uses it throughout `src/Storybook.ts`, `src/OipWeb.ts`, and `src/AIMetrics.ts`. These target-form uses should not be reported.
- Heuristic refinement candidate from this batch: `@beep/repo-configs` still has manual conditional optional-key spreads in `src/next/SharedNextConfig.model.ts:377-405`. They are the same fixed-key optional-struct shape as the target, but not an `R.getSomes` call; only report them if the card intentionally expands beyond its `R.getSomes({...})` detector.

---

<!-- batch AA -->
## SFV4-getsomes-struct

- Detector heuristic stays: flag `R.getSomes({...})` or `Record.getSomes({...})` from `effect/Record` when the inline object participates in a fixed heterogeneous Option-struct whose per-key types should be preserved by `O.getSomesStruct({...})`. Verified target helper: `packages/foundation/modeling/utils/src/Option.ts:102`; verified Effect v4 homogeneous record helper: `.repos/effect-v4/packages/effect/src/Record.ts:824-826`.
- D5 ordering: keep this card non-blocking via the per-owner policy until effect-first Law 20 and Law 47, plus mirrors, explicitly prefer `O.getSomesStruct` for heterogeneous struct-spreads while preserving `R.getSomes` for homogeneous dictionaries. Every `SFV4-getsomes-struct` finding in this batch is held at `mechanization: "judgment"` until that sweep is cleared.
- Positive findings from this batch: `apps/oip-web/src/content/OipContent.runtime.ts:57-63` and `:137-143` split one provider/providerReason/status optional struct into adjacent `R.getSomes` calls; `apps/oip-web/src/content/OipContent.runtime.ts:98-101` uses multiple `R.getSomes` spreads for a fixed `SanityConfigInput` payload mixing string config fields with a redacted token.
- Escape hatches from this batch: `apps/oip-web/src/contact/ContactSubmission.model.ts:233-240` and `:249-255` are all `Option<string>` values from the same `formTextOption` helper, so they are homogeneous form-text compactions rather than heterogeneous structs. `apps/oip-web/src/content/OipContent.runtime.ts:125` is a singleton optional status spread and is not heterogeneous. No legitimate homogeneous dynamic-key `R.getSomes` dictionary use was found in the scanned app packages.
- Positive target examples in this batch: `apps/oip-web/src/contact/ContactSubmission.service.ts:60-64` and `:298-302` already use `O.getSomesStruct` for the same provider/providerReason/status shape. `@beep/professional-desktop`, `@beep/architecture-lab-proof`, and `@beep/storybook` had no actionable `R.getSomes`/`Record.getSomes` hits after generated output was excluded.

---

<!-- batch AB -->
## SFV4-getsomes-struct

- Detector heuristic stays: flag `R.getSomes({...})` or `Record.getSomes({...})` from `effect/Record` only when the inline object is a fixed heterogeneous Option struct whose key-specific value types should be preserved by `O.getSomesStruct({...})`. Verified target helper: `packages/foundation/modeling/utils/src/Option.ts:102`; verified Effect v4 homogeneous record helper: `.repos/effect-v4/packages/effect/src/Record.ts:824-826`.
- D5 ordering: keep this card non-blocking via the per-owner policy until effect-first Law 20 and Law 47, plus mirrors, explicitly prefer `O.getSomesStruct` for heterogeneous struct-spreads while preserving `R.getSomes` for homogeneous dictionaries. Every future `SFV4-getsomes-struct` finding remains `mechanization: "judgment"` until that sweep is cleared.
- Batch AB scope: `@beep/agents-domain`, `@beep/agents-use-cases`, `@beep/agents-server`, and `@beep/agents-client` had no `R.getSomes` or `Record.getSomes` calls after generated-output exclusions.
- Escape hatches from this batch: `packages/agents/server/src/AssistantTurn/BlockRepair.ts:426` uses `A.getSomes` on an array/iterable of `Option` repair results, not `effect/Record.getSomes` on an object. Do not flag Array/Iterable `getSomes` calls for this card; require the callee alias to resolve to `effect/Record` and the argument to be an object literal before applying the heterogeneous-struct heuristic.
- Positive findings from this batch: none.

---

<!-- batch AC -->
## SFV4-getsomes-struct

- Detector heuristic stays: flag `R.getSomes({...})` or `Record.getSomes({...})` from `effect/Record` only when the inline object is a fixed heterogeneous Option struct whose key-specific value types should be preserved by `O.getSomesStruct({...})`. Verified target helper: `packages/foundation/modeling/utils/src/Option.ts:102`; verified Effect v4 homogeneous record helper: `.repos/effect-v4/packages/effect/src/Record.ts:824-826`.
- D5 ordering: keep this card non-blocking via the per-owner policy until effect-first Law 20 and Law 47, plus mirrors, explicitly prefer `O.getSomesStruct` for heterogeneous struct-spreads while preserving `R.getSomes` for homogeneous dictionaries. Every future `SFV4-getsomes-struct` finding remains `mechanization: "judgment"` until that sweep is cleared.
- Batch AC scope: `@beep/architecture-lab-domain`, `@beep/architecture-lab-use-cases`, `@beep/architecture-lab-server`, `@beep/architecture-lab-tables`, `@beep/architecture-lab-config`, `@beep/architecture-lab-client`, and `@beep/architecture-lab-ui` had no `R.getSomes` or `Record.getSomes` calls after generated-output exclusions.
- Escape hatches from this batch: none found for homogeneous dynamic-key `R.getSomes` dictionaries; the scoped architecture-lab packages simply do not call the Record helper. Keep requiring the callee alias to resolve to `effect/Record` and the argument to be an object literal before applying the heterogeneous-struct heuristic.
- Positive findings from this batch: none.

---

<!-- batch AD -->
# S3 Rule Card Notes — batch AD

## SFV4-getsomes-struct

- Detector heuristic retained: flag `R.getSomes({...})` from `effect/Record` only when the inline argument is a heterogeneous Option struct literal whose keys have distinct value types and are being spread into a record/object. The remediation target is `O.getSomesStruct` from `packages/foundation/modeling/utils/src/Option.ts:102`.
- D5 ordering retained: the detector may stay non-blocking via `standards/schema-crispening.policy.jsonc`, but the remediation sweep must not run until effect-first Law 20 and Law 47, plus mirrors, are amended to prefer `O.getSomesStruct` for heterogeneous struct-spreads while preserving `R.getSomes` for homogeneous dynamic-key dictionaries.
- Batch AD escape-hatch evidence: no `R.getSomes` calls were found in the seven scoped packages (`@beep/epistemic-domain`, `@beep/epistemic-use-cases`, `@beep/epistemic-tables`, `@beep/epistemic-server`, `@beep/law-practice-domain`, `@beep/law-practice-use-cases`, `@beep/law-practice-server`). This batch therefore contributes no concrete homogeneous-dictionary fixture.
- Heuristic refinement from this batch: keep `as`/discriminator findings separate from `SFV4-getsomes-struct`; row-converter casts and test-provider casts are false-positive-audited S3 `as` candidates, not Option-struct findings.

---

<!-- batch AE -->
# S3 Rule-Card Notes Batch AE

Packages scanned: `@beep/workspace-domain`, `@beep/workspace-tables`, `@beep/workspace-server`, `@beep/workspace-use-cases`, `@beep/shared-domain`, `@beep/shared-tables`, `@beep/db-admin`.

## SFV4-getsomes-struct

- Verified API split: `O.getSomesStruct` is the repo struct helper at `packages/foundation/modeling/utils/src/Option.ts:102`; Effect v4 `R.getSomes` is the homogeneous dictionary helper at `.repos/effect-v4/packages/effect/src/Record.ts:824`.
- D5 ordering remains binding: keep `SFV4-getsomes-struct` non-blocking via the per-owner policy until effect-first Law 20/47 and mirrors explicitly prefer `O.getSomesStruct` for heterogeneous Option struct-spreads while preserving `R.getSomes` for homogeneous dynamic-key dictionaries.
- Escape hatches found in this batch: none. No `R.getSomes` or `Record.getSomes` calls were present in the assigned packages.
- Detector refinement from this batch: do not treat persisted-model SQL `null` row fields in `packages/*/tables` as `SFV4-getsomes-struct` candidates. Fence 2 applies there: row codecs keep wire `null`; Option belongs at the domain boundary.
