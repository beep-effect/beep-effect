# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-09-12

### Original brief (verbatim, WebStorm scratch `scratch_65.md`)

> Can you clone the effect repo somewhere & checkout a pre rc 112 branch &
> compare the following files against the latest effect source code main to
> identify new features, changes & additions?
>
> I want a new exploration packet that orchestrates sub-agents to find more
> idiomatic solutions, api's & combinators that could replace current
> implementations, useage & styles in beep-effect's schema usage.
>
> This shouldn't be limited to only new apis but the entire set of schema
> modules & documentation in general so that we can learn, migrate, optimize &
> enhance existing effect/Schema usage throughout this entire repo so that the
> repo uses the most performant, idiomatic, precise & clean solutions new and
> going forward. Further more I would like to remove any hand rolled
> implementations or custom schemas we've made in for example `@beep/schema`
> & completely delete any things we made or maintain ourselves to the official
> effect solutions. For example if we have our own `TaggedError` with a
> customization that is now fully baked in the effect source then we should
> that module entirely (no deprecation) & migrate the code to use the effect
> shipped one.
>
> [56 module/doc paths under `$HOME/YeeBois/dev/effect` — reproduced with
> role tags below]
>
> I want an exploration packet where a document is produced for each module
> where we copy all the jsdocs from a listed module that contains schema
> relevance where we have a section for each symbol that contains enough
> information that could later be used by agents in a dynamic workflow with
> maximally optimized specialized sub-agent prompts to make it so that we have
> certainty that we are always using the best solutions to the problems, the
> most idiomatic solutions, not rolling our own implementations, optimizing
> schema performance at all costs.
>
> Essentially if we could have a querable knowledge

### Facts verified during capture

- No clone needed. `.repos/effect` is a symlink to `$HOME/YeeBois/dev/effect`,
  on upstream `main` at `51d4a2f08a` (2026-09-12) with every `effect@4.0.0-rc.*`
  tag present. Tag dates: rc.112 = 2026-08-25, rc.113 = 2026-09-10,
  rc.115 = 2026-09-11.
- The repo is on `effect@4.0.0-rc.115` (root catalog + `bun.lock`). There are
  zero schema-relevant upstream commits between rc.115 and main. The
  interesting window is rc.112..main: 28 commits touching `Schema*.ts`,
  `JsonSchema.ts`, `unstable/schema/`, `SCHEMA.md`, `migration/schema.md`.
- `migration/schema.md` lives at the effect repo root, not under
  `packages/effect/`.
- `@beep/schema` (`packages/foundation/modeling/schema`, 271 source files) is
  imported from 2,508 files across `packages/` and `apps/`.
- Name-level overlap is weak evidence of equivalence: upstream `Toml`, `Yaml`,
  `Ini` are encoding codecs with 0-1 schema references; upstream `HttpStatus`,
  `HttpMethod`, `Url`, `UrlParams`, `Headers` carry no schemas at all. But
  upstream commit `46d83101e8` "Move unstable HTTP schemas to Schema (#7553)"
  means some of those concepts now live on `Schema` itself.
- Doctrine `standards/architecture/11-evolution-and-deprecation.md`
  ("In-repo deprecations without a release train") already allows same-change
  removal for in-repo symbols with zero remaining consumers. "No deprecation"
  therefore means: delete in the same PR that migrates every consumer.
- Nearest doctrine precedent for upstream-first: DECISIONS 2026-07-08 "Use
  Upstream PGlite Without A Repo Driver Wrapper".
- Adjacent packets, none owning this: `goals/schema-first-v4-capabilities`
  and `goals/beep-schema-topology` (completed-retained),
  `goals/schema-utils-selective-codec-statics` (active),
  `goals/effect-native-migration` (completed-retained, native Map/Set only),
  `explorations/effect-jsdoc-quality` (our doc style, not upstream parity).
- Existing gate machinery to reuse: `packages/tooling/tool/cli/src/commands/Lint/internal/SchemaFirst*.ts`
  (detectors, policy, store, scan, ratchet) and the `effect-vitest-rc115`
  fixture pattern (sha-pinned inventory re-pinned on every effect bump).
- graft: one index per repo; every command takes a `[dir]`; `build` has
  `--only-dir`; graft dirs are git-ignored and `.repos/effect` is
  machine-local, so hosted CI cannot query a graft index.
- Precedent for one giant PR: #1060 migrated ~830 files (18,818 TS errors to
  0) in a single PR. Known mechanics: Yeet's 512 KiB base-delta capture cap
  (merge main early and often), manual `gh pr` for very large path counts,
  squash merges drop pushes after merge.
- Codex pool: a second ChatGPT subscription was added 2026-09-12; Codex lanes
  are available now.

### Module list with roles

Role A = adoption surfaces (feed retirement + adoption audits).
Role B = idiom exemplars (how effect's own authors consume Schema; feed the
idiom rubric, not adoption targets).

Paths relative to `$HOME/YeeBois/dev/effect/`:

A  packages/effect/src/Schema.ts
A  packages/effect/src/SchemaAST.ts
A  packages/effect/src/SchemaGetter.ts
A  packages/effect/src/SchemaParser.ts
A  packages/effect/src/SchemaIssue.ts
A  packages/effect/src/SchemaRepresentation.ts
A  packages/effect/src/SchemaTransformation.ts
A  packages/effect/src/StandardSchema.ts
A  packages/effect/src/JsonSchema.ts
A  packages/effect/src/unstable/schema/index.ts
A  packages/effect/src/unstable/schema/VariantSchema.ts
A  packages/effect/src/unstable/schema/Model.ts
A  packages/effect/src/unstable/arbitrary/index.ts
A  packages/effect/src/unstable/arbitrary/Arbitrary.ts
A  packages/effect/SCHEMA.md
A  migration/schema.md
B  packages/effect/src/unstable/ai/McpSchema.ts
B  packages/effect/src/unstable/ai/AnthropicStructuredOutput.ts
B  packages/effect/src/unstable/ai/Prompt.ts
B  packages/effect/src/unstable/ai/Tool.ts
B  packages/effect/src/unstable/ai/Toolkit.ts
B  packages/effect/src/unstable/ai/Response.ts
B  packages/effect/src/unstable/devtools/DevToolsSchema.ts
B  packages/effect/src/unstable/encoding/Yaml.ts
B  packages/effect/src/unstable/encoding/Toml.ts
B  packages/effect/src/unstable/encoding/SchemaBinary.ts
B  packages/effect/src/unstable/encoding/Ini.ts
B  packages/effect/src/unstable/encoding/Ndjson.ts
B  packages/effect/src/unstable/http/Mime.ts
B  packages/effect/src/unstable/http/HttpStatus.ts
B  packages/effect/src/unstable/http/HttpIncomingMessage.ts
B  packages/effect/src/unstable/http/HttpClientError.ts
B  packages/effect/src/unstable/http/HttpServerRespondable.ts
B  packages/effect/src/unstable/http/HttpBody.ts
B  packages/effect/src/unstable/http/HttpTraceContext.ts
B  packages/effect/src/unstable/http/Multipart.ts
B  packages/effect/src/unstable/http/HttpServerRequest.ts
B  packages/effect/src/unstable/http/HttpClientRequest.ts
B  packages/effect/src/unstable/http/HttpStaticServer.ts
B  packages/effect/src/unstable/http/HttpMethod.ts
B  packages/effect/src/unstable/http/MultipartParser.ts
B  packages/effect/src/unstable/http/HttpServerError.ts
B  packages/effect/src/unstable/http/Headers.ts
B  packages/effect/src/unstable/http/HttpServerResponse.ts
B  packages/effect/src/unstable/http/HttpClientResponse.ts
B  packages/effect/src/unstable/http/Template.ts
B  packages/effect/src/unstable/http/Url.ts
B  packages/effect/src/unstable/http/UrlParams.ts
B  packages/effect/src/unstable/httpapi/HttpApiSchema.ts
B  packages/effect/src/unstable/net/NetAddress.ts
B  packages/effect/src/unstable/net/IpInterface.ts
B  packages/effect/src/unstable/net/IpNetwork.ts
B  packages/effect/src/unstable/observability/OtlpSerialization.ts
B  packages/effect/src/unstable/rpc/RpcSchema.ts
B  packages/effect/src/unstable/sql/SqlSchema.ts

### Upstream hint list: schema-relevant commits rc.112..main

`git -C .repos/effect log effect@4.0.0-rc.112..main -- 'packages/effect/src/Schema*.ts' packages/effect/src/JsonSchema.ts packages/effect/src/unstable/schema packages/effect/SCHEMA.md migration/schema.md`

- 657254b821 2026-09-11 Optimize Schema initialization (#8196)  <- performance lane lead
- 482b7d7eb0 2026-09-10 feat(SchemaRepresentation): improve JSON Schema imports (#8169)
- 716e0c0094 2026-09-11 fix: remove dangling @internal references from published declarations (#8162)
- 53909a9bf1 2026-09-09 feat(Schema): improve JSON Schema generation (#8147)
- c8349ede1a 2026-09-09 refactor(Schema): rename transformOrFail to transformEffect (#8143)
- 10d2c983a8 2026-09-08 Backport Schema interpreter behavior (#8131)
- 0a08ae0626 2026-09-08 Add shared network address values (#7524)
- db995df19b 2026-09-06 Separate template literal validation from codec parsing (#8094)
- 74dd9b3be8 2026-09-05 fix(Schema): return compose from encodeTo without transformation (#8077)
- fa6027b16e 2026-09-04 feat(http): reduce web handler cold start on Cloudflare (#7927)
- 4372c79a32 2026-09-03 fix(effect): centralize JavaScript array index validation (#7855)
- 180b635aea 2026-09-03 fix(Schema): centralize JSON Pointer URI fragment handling (#7823)
- 53511efcd1 2026-09-03 fix(Schema): preserve ArrayEnsure element branches and encoding cardinality (#7796)
- d3c6b73cc4 2026-09-02 fix(Model): preserve omitted variants in FieldOption (#7665)
- 6f090d4c20 2026-09-02 fix(VariantSchema): preserve classes in default extraction (#7663)
- 243c72f001 2026-09-02 Fix SchemaAST declaration parser contract (#7651)
- a1177caf27 2026-09-02 Refactor ByteSize as branded bigint (#7648)
- a2c9e7c17a 2026-09-02 Simplify Graph protocol and runtime guard (#7644)
- 629870d461 2026-09-02 fix(SchemaGetter): preserve duplicate array-valued leaves (#7641)
- 46d83101e8 2026-09-02 Move unstable HTTP schemas to Schema (#7553)  <- retirement lead for @beep/schema http concepts
- 9642776614 2026-09-01 Hide SchemaAST and SchemaIssue class implementations (#7560)
- 5641ad333a 2026-09-01 Refactor Schema internals and representation APIs (#7558)
- 40466bf397 2026-09-01 Fix JSDoc validation violations (#7549)
- 53843f6490 2026-08-31 Add exact ByteSize value module (#7525)
- 145d8e1013 2026-08-28 Fix Schema.mutable with encoded arrays (#7519)
- b945ded23a 2026-08-27 Align type IDs with module paths (#7483)
- a63dcbf04e 2026-08-25 Native Arbitraries (#7254)  <- retirement lead for arbitrary helpers
- 84864bc30c 2026-08-25 Fix Schema class equivalence derivation (#7451)

### First-glance retirement candidates (name-level only; research must prove intent)

`@beep/schema` concepts with a same-named effect main module: Toml, Yaml,
HttpMethod, HttpStatus, URL, JSONSchema, Json, Duration, BigDecimal, RegExp,
Html. Likely hand-rolled overlaps by content: `EffectSchema.ts`, `Opaque.ts`
(`Defect` wrapper), `SchemaUtils/withCodecStatics.ts`, `Float16/32/64Array`,
`ArrayBuffer`, `MappedLiteralKit`, `StatusCauseError`, the `Arbitrary`
companions. Not name-matched upstream (verify intent anyway): Jsonl, MimeType,
HttpHeaders, Timestamp, LocalDate, Csv, Xml, Markdown, Port, Semver, Cuid,
Email, Percentage.
