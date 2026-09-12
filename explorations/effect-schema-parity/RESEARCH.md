# Research

Stage 1, 2026-09-12. Two halves: the upstream landscape (cited) and the
in-repo inventory produced by six Codex lanes (`gpt-6-astra`, medium) over
`.repos/effect` main `51d4a2f08a` and this checkout on `effect@4.0.0-rc.115`.
Lane reports live in `research/` and are the evidence; this file is the map.
Nothing here is ratified: align (`DECISIONS.md`) decides.

## External Landscape (2026-09-12)

The "outside" for this packet is upstream effect itself: the reference checkout,
its two schema documents, and the rc.112..main commit window. No third-party
library competes for the role; the question is only how much of `@beep/schema`
upstream now covers.

### Upstream corpus

| Source | What it is | Verified how |
|--------|------------|--------------|
| `.repos/effect` -> `$HOME/YeeBois/dev/effect` | Effect-TS/effect `main` @ `51d4a2f08a` (2026-09-12); remotes `origin` = `git@github.com:Effect-TS/effect.git`, `fork` = `git@github.com:beep-effect/effect.git`; `LICENSE` = MIT (Effectful Technologies Inc) | `git remote -v`, `head LICENSE` |
| `packages/effect/SCHEMA.md` (7,223 lines, 216 KB) | The v4 Schema reference. Top-level sections: Schema, Design Philosophy, Runtime Performance, Defining Elementary Schemas, Defining Composite Schemas, Declaring Custom Types, Validation, Constructors, Transformations. The "Runtime Performance" section benchmarks against the public `schema-benchmarks` suite (Valibot, Zod). Checks are `.check()` runtime constraints that can report multiple issues; every schema exposes `make` with defaults/refinements/branding; transformations compose `Getter`s via `decodeTo`/`decode`. No top-level section covers JSON Schema, Standard Schema, arbitraries, or `ErrorClass`/`TaggedError`; those live in module JSDoc, which is why the symbol inventory (below) is needed. | Fetched `https://raw.githubusercontent.com/Effect-TS/effect/refs/heads/main/packages/effect/SCHEMA.md` (GitHub's rendered view at `https://github.com/Effect-TS/effect/blob/main/packages/effect/SCHEMA.md` failed to render server-side but reports the same size) |
| `migration/schema.md` (repo root) | v3 -> v4 migration guide: summary table (auto / semi-auto / manual / removed), rename notes (`*FromSelf`, `Date` encoded contract), structural changes (`Record`, `Union`, `Tuple`, `pick`/`omit`, `extend`), transformation patterns (`transform`, `transformOrFail`, `filter`, optional fields via `decodeTo`), specialized APIs (`validate*` removed, `Data` removed, manual `rename`/`split`). | Fetched `https://github.com/Effect-TS/effect/blob/main/migration/schema.md` |
| Commit `657254b821` "Optimize Schema initialization (#8196)" | 14 files, +279/-41. `make` uses `Object.assign` for standard props instead of always `Object.defineProperties`; `Suspend` thunk memoized with `??=`; `SchemaParser.makeEffect` compiles parsers lazily; `Objects` duplicate detection via a `Set`; adds creation benchmarks (2/32/256-field objects, template literals, encoded records). Consumer action: none required; the win is automatic on the next effect bump that includes it. rc.115 predates it (rc.115 = 2026-09-11 tag; commit = 2026-09-11 on main after the tag, see the delta lane). | Fetched `https://github.com/Effect-TS/effect/commit/657254b821` |
| Commit `46d83101e8` "Move unstable HTTP schemas to Schema (#7553)" | 15 files, +421/-330 (tim-smart). Moves `Cookie`, `Cookies`, `Headers`, `UrlParams` schemas plus their record / JSON-field helpers from `effect/unstable/http` onto `effect/Schema`. | Fetched `https://github.com/Effect-TS/effect/commit/46d83101e8` |
| Effect blog "Effect v4 Beta: June Updates" (2026-06-30) | Confirms upstream treats type-level cost as a first-class target: "Improved Schema type-level performance, reducing compile-time overhead for large schema definitions." Also: `Schema.toCodecStringTree` lost `keepDeclarations`; wrappers expose `source`; URL schema decoding adopted `URL.canParse`. | Fetched `https://effect.website/blog/effect-v4beta-june-recap/` |

Not usable: `https://effect-ts-effect-smol.mintlify.app/migration/schema` returns
404 (2026-09-12). The `Effect-TS/effect-smol` GitHub paths surfaced by search
are the pre-rename home of the same documents; the checkout above is the
authority.

### Reading of the landscape

- Upstream already benchmarks runtime decode publicly (SCHEMA.md "Runtime
  Performance") and ships creation benchmarks in `657254b821`; type-level cost is
  the axis upstream calls out in prose but does not benchmark in-repo. That
  matches the packet's "type-check cost first" ordering: the repo must measure
  it itself.
- The migration guide is v3 -> v4. It does not cover rc-to-rc drift inside v4,
  so the rc.112..main hint list plus the inventory diff is the only
  rc-window authority.
- License is MIT: porting upstream patterns with attribution is allowed, but the
  packet's direction is the reverse (delete repo code, import upstream), so no
  vendoring question arises.

## In-Repo Capability Inventory (2026-09-12)

### Report index

| File | What it holds | Size |
|------|---------------|------|
| `research/inventory/` + `research/tools/` | The knowledge-layer prototype: `schema-inventory/v1` JSONL rows for the 14 Role A `.ts` modules, generator, verifier, INDEX and README | 2,105 rows / 853 KB |
| `research/retirement-A-F.md`, `research/retirement-G-Z.md` | Per-concept retirement audit of every top-level `@beep/schema` concept (137) with upstream citations, consumer counts, dispositions and migration recipes | 43 + 54 KB |
| `research/idiom-families.md` | 30 usage families audited across 3,173 source files; 21 candidates, 9 rejected hypotheses, 1 correction to an existing gate | 582 lines |
| `research/upstream-delta.md` + `research/upstream-verification-supplement.md` | All 28 rc.112..main commits tagged ADOPT / MIGRATE / RETIRE-LEAD / NOOP with repo exposure counts; the supplement is an independent second pass that withdrew two recommendations | 22 + 8 KB |
| `research/performance-baseline.md` + `research/performance-verification-supplement.md` | What `657254b821` changed, measured type-check numbers for three packages, cost-driver mechanisms with citations, existing upstream perf suites, proposed harness | 15 + 5 KB |
| `research/gate-and-knowledge-plumbing.md` | Extension points in the schema-first lint for an `UpstreamParity*` detector family, pin/refresh procedure, hosted vs local split, graft route, NET-NEW vs reuse, risks, proposed doctrine text | 27 KB |
| `research/*.json`, `*.cjs`, `*.tsv`, `*.txt`, `*.log` | Evidence receipts the reports cite (census scripts, consumer ledgers, typecheck logs, graft help captures). Large ones: `idiom-census.json` 1.7 MB, `retirement-G-Z-searches.json` 476 KB | 3.7 MB total |

### Knowledge layer (DECISIONS "Knowledge layer")

- **Symbol inventory.** `research/tools/schema-inventory.ts` (TypeScript 6.0.3
  JS API, run with `bun run` from the repo root) extracts every exported
  declaration of the 14 Role A modules into `research/inventory/<module>.jsonl`.
  Row identity is `(module, symbol, kind)`; fields: `sha`, `file`, `line`,
  `symbol`, `kind`, `category`, `since`, `deprecated`, `internal`, `signature`
  (one line, 300 chars), `summary` (first JSDoc paragraph, 400 chars),
  `hasExample`, `overloads`. Totals: 2,105 rows; `effect/Schema` alone 1,026
  (165 consts, 149 functions, 193 interfaces, 453 members). Largest Schema.ts
  category: `models` (175). Extraction gaps are documented in
  `research/inventory/README.md` (bare `export *` not expanded, no
  binder-level declaration merging, one level of members, `@internal` rows
  retained and flagged rather than dropped).
- **Two extractors collided.** Two generations of the inventory lane ran at
  once; the survivor keys by `(module, symbol, kind)` while the verifier was
  written for a unique-symbol contract, so `verify-schema-inventory.ts`
  currently fails on `effect/unstable/arbitrary` rows. A single-writer
  reconcile lane is aligning generator, verifier, INDEX and README; until its
  PASS output is in the README, treat the inventory as UNVERIFIED.
- **graft index at the effect checkout.** Built 2026-09-12 with
  `graft build "$HOME/YeeBois/dev/effect" -e .ts`: 1,571 files, 30 s, 117 MB,
  structural only (no LLM pass). `graft skeleton
  packages/effect/src/StandardSchema.ts "$HOME/YeeBois/dev/effect"` answers in
  ~600 tokens. Side effect: graft appended a `/graft/` line to the effect
  checkout's tracked `.gitignore` (now `M .gitignore` there). Correction to the
  capture: installed graft 0.16.0 `build --help` does list `--only-dir`
  (`research/gate-graft-build-help.txt:41`); the earlier "no `--only-dir`"
  note came from a truncated help read. A scoped rebuild
  (`--only-dir packages/effect/src`) is available if the 117 MB index is too
  broad. The plumbing lane's proposed agent route: `graft ask '<q>' --source
  --in packages/effect/src --no-refresh "$HOME/YeeBois/dev/effect"`, and a
  second `graft mcp` server pointed at the effect checkout, kept separate from
  the repo index (no nested-repo following).

### Retirement audit (DECISIONS "Equivalence test for retirement")

Counts are whole top-level concepts under
`packages/foundation/modeling/schema/src` (directories count once):

| Half | Concepts | RETIRE | ADAPT | KEEP | UNSURE |
|------|---------:|-------:|------:|-----:|-------:|
| A–F | 61 | 16 | 1 | 44 | 0 |
| G–Z | 76 | 36 | 1 | 33 | 6 |
| Total | 137 | 52 | 2 | 77 | 6 |

Consumer counts are unique direct importing source files outside the package
(AST-checked, JSDoc excluded; transitive reach is NOT counted). Heaviest
RETIRE rows by blast radius:

| Concept | Consumers | Upstream same-intent | Note |
|---------|----------:|----------------------|------|
| LiteralKit | 536 | `Schema.Literals` (`Schema.ts:4768`, `:4800`), `Schema.TaggedUnion` | Retire per same-intent rule; helpers (`is.x`, `pickOptions`, Enum keys, match thunks) need call-shape rewrites, not import substitution. Conflicts with the standing repo rule "use LiteralKit for literal unions" (see Constraints). |
| Int (+ PosInt, serial ranges) | 143 | `Schema.Int`, `isGreaterThan`, `isBetween` (`Schema.ts:7581`, `:7335`, `:7458`) | Brands vanish from signatures; every sign/serial bound must survive as a check. |
| Unknown / UnknownFromJsonString | 128 | `Schema.Unknown`, `Schema.UnknownFromJsonString` (`:2946`, `:9209`) | Attached statics disappear. |
| Opaque (Defect, OpaqueUnknown) | 103 | `Schema.Defect`, `Schema.Unknown` + `toEquivalence` annotation (`:8732`, `:14305`) | Upstream equality is not beep's always-true equality; move identity-exclusion to the owning field. |
| URL (URLStr, HttpsUrl) | 38 | `Schema.URL`, `Schema.URLFromString` (`:9021`, `:8979`) | Keep the HTTPS-only policy as a check on the native codec. |
| Record | 32 | `Schema.Record(String, Unknown)` (`:3815`) | Pure alias. |
| Json | 17 | `Schema.JsonObject`, `Array(Json)`, `UnknownFromJsonString` | Pre-bound decode/encode statics vanish. |
| Timestamp | 16 | `Schema.DateTimeUtcFromString`, `DateTime.*` (`:11012`, `DateTime.ts:1617`) | Wire shape changes (epoch -1 accepted upstream). |

ADAPT: `SchemaUtils` (483 consumers) keeps only `collectAnnotationsAt`
(recursive annotation collection has no upstream equivalent); codec/default
statics facades go to `S.decodeSync`, `withConstructorDefault`,
`withDecodingDefaultTypeKey`. `Float` keeps its binary32 range check on top of
`Schema.Number`.

UNSURE (all six are the same conflict): `HttpMethod` (2), `HttpStatus` (11),
`MimeType` (4), `Jsonl` (0), `Toml` (2), `Yaml` (4) have same-intent upstream
coverage only in Role B modules (`unstable/http/HttpMethod.ts`, `HttpStatus.ts`,
`Mime.ts`, `unstable/encoding/Ndjson.ts`, `Toml.ts`, `Yaml.ts`). DECISIONS
"Module list roles" excludes Role B as adoption targets; DECISIONS
"Equivalence test" says same intent retires. Align must pick one.

KEEP is the majority (77): security-header policies (Csp, ExpectCt,
ReferrerPolicy, PermissionsPolicy, ...), CSV parser/formatter, Conformance,
Email, Cuid, SemanticVersion, Percentage, Port (no standalone upstream port
domain; `NetAddress` checks are private), PosixPath, DOM/React value schemas,
crypto/EVM domains. "KEEP" means no verified same-intent public API, not "no
reusable upstream substrate".

### Idiom families (feeds the gate rubric)

30 families evaluated over 3,173 files (`research/idiom-families.md`), counts
are matching lines / files, not confirmed defects. Ranked candidates:

| Rank | Family | Lines / files | Confidence |
|-----:|--------|--------------:|-----------:|
| 1 | F01 LiteralKit wrapper retirement | 1,458 / 568 | 0.95 |
| 2 | F05 Throwing decoders at Effect boundaries | 1,525 / 482 | 0.45 |
| 3 | F26 Stale tagged-error equivalence gate (correction: the existing detector is obsolete since rc.113) | 484 / 247 | 1.00 |
| 4 | F03 Custom key/default combinator wrappers | 406 / 104 | 0.95 |
| 5 | F06 Recursive annotations and gratuitous `suspend` | 716 / 19 | 0.40 |
| 6 | F15 Codec-static wrapper surface (`withCodecStatics`) | 238 / 134 | 0.90 |
| 7 | F13 Schema-derived guards vs duplicated predicates | 266 / 169 | 0.70 |
| 8 | F04 Opaque custom checks needing constraint classification | 325 / 130 | 0.55 |
| 9 | F24 Opaque defect/equivalence wrappers | 157 / 116 | 0.85 |
| 10–21 | F25, F14, F07, F19, F28, F16, F30, F18, F27, F29, F17, F02 | ≤153 / ≤50 each | 0.45–1.00 |

Rejected with evidence: mutable placement (upstream idiom), ArrayEnsure misuse
(0 hits), `transformOrFail` residue (0 hits), annotation vocabulary drift
(`documentation` is still valid), Standard Schema adapters (no consumer
contract), custom arbitraries (already native), hand-rolled Model variants
(effect-drizzle already uses `VariantSchema`), Struct+brand vs Class/Opaque
(different intents), NullOr vs optional (nullable wire fields are not
mistakes). Existing `SchemaFirstDetectors.ts` families are inventoried in the
report's "already gated" section; the lane's rule is extend those, do not
duplicate them as parity detectors.

### Upstream delta rc.112..main (DECISIONS "Comparison baseline")

28 commits: 5 ADOPT, 8 MIGRATE, 1 RETIRE-LEAD, 14 NOOP (`research/upstream-delta.md`).
The independent supplement then **withdrew** the one RETIRE-LEAD
(`NormalizedBooleanString` → `Schema.BooleanLiterals`: `TrueLiterals`,
`FalseLiterals`, `BooleanLiterals` are `@internal`, `Schema.ts:5432`–`:5438`,
absent from installed `dist/Schema.d.ts`) and excluded
`withArrayLengthConstraints` (`@internal`, `:4473`). Lesson: an `export`
keyword in upstream source is not a public API; check JSDoc and the installed
declarations.

Confirmed residual work: one stale `propertyOrder` recognition at
`packages/foundation/modeling/schema/src/SchemaUtils/isCodecDataFirst.ts:14`
(removed by `10d2c983a8`); a 29-line / 25-file audit of TemplateLiteral parts
that carry encodings (`db995df19b`); the ADOPT set (JSON Schema import
`482b7d7eb0`, JSON Schema export `onExcessProperty` `53909a9bf1`, HTTP
schemas on `Schema` `46d83101e8`, network address schemas `0a08ae0626`,
native arbitraries `a63dcbf04e`). `transformOrFail`: 0 residual hits, 73 lines
already on `transformEffect`.

### Performance (DECISIONS "Performance")

- `657254b821` is runtime initialization only: lazy constructor parser
  (`SchemaParser.ts:43`), `Object.assign` fast path in `internal/schema/make.ts:26`,
  Set-based duplicate-key check (`SchemaAST.ts:2757`), lazy encoded-key
  validation (`:2588`), `??=` thunk caches. rc.115 already contains it; no
  consumer action. It establishes nothing about type instantiation.
- Measured (tsgo `7.0.2+effect-tsgo.0.39.1`, `--noEmit --extendedDiagnostics`,
  one fresh build-info per project, uncontrolled workstation):

| Package | Instantiations | Types | Check time | Files |
|---------|---------------:|------:|-----------:|------:|
| `@beep/schema` | 1,307,910 | 427,107 | 0.53 s | 1,025 |
| `@beep/repo-cli` (heaviest consumer, 322 importing files) | 7,786,120 | 2,028,265 | 3.72 s | 2,374 |
| `@beep/law-practice-domain` (100 importing files) | 1,289,820 | 375,500 | 0.66 s | 1,454 |

- Cost drivers with verified mechanisms (`Schema.ts` line cites in the
  report): wide/deep Struct projections, Union member maps, template-literal
  tuple folds, Class vs Struct (neither is "always cheaper"), `suspend` without
  an explicit `Codec` annotation, brands (marginal cost UNVERIFIED), tuple/rest
  intersections, codec derivation statics (`withCodecStatics` retains generic
  surfaces). Upstream ships 22 schema `typeperf` fixtures (gates instantiations
  and types against a shared baseline) and `runtimeperf/suites/schema`
  (cold/warm creation, adapters). The repo has no schema benchmark of its own.
- Proposed harness (not built): per-change `--extendedDiagnostics` on the three
  packages above plus an upstream-style typeperf fixture per migrated concept;
  runtime decode via the upstream runtimeperf adapters.

### Gate and knowledge plumbing (DECISIONS "Gate home", "Goal closing condition")

Existing bricks (all `packages/tooling/tool/cli/src/commands/Lint/internal/`):
`SchemaFirst{ArbitraryCoverage,Detectors,Policy,Project,Scan,Store}.ts` (6),
`EffectVitest{Detectors,Policy,Primitives,Scan,Store,Syntax}.ts` (6),
`Lint.schemas.ts` (closed rule domain `:104`, finding `:247`, inventory `:307`,
identity key file+symbol+kind+rule+line `:586`), shared ratchet
`internal/ratchet/RatchetDiff.ts:71` / `RatchetLifecycle.ts:67`, hosted route
`heavy.yml` → `CiLane.ts:1478` → `Quality/Tasks.ts:2634` (schema-first is
already in lint-policy), local catalog `GithubChecks.ts:715`, pin guard
`EffectVitestScan.ts:75` (compares installed version only), rc115 fixture
layout (`.ts.txt` sources + charter excerpts), `scripts/setup-effect-ref.sh`
(provisioning only), `Graft.command.ts` (cache sync/deep only).

NET-NEW: `UpstreamParity{Detectors,Policy,Store,Scan}.ts`,
`UpstreamParity.schemas.ts`, a deterministic extractor (proposed
`scripts/upstream-parity-inventory.ts` → `test/fixtures/upstream-parity-rc115/`
with `symbols.jsonl` + pin manifest + license notice), reviewed rule→symbol
policy edges, an independent parity baseline (membership ratchet with no
growth after initialization), inventory-templated agent prompts. NOT FOUND: an
automated effect-vitest fixture generator to copy (the rc115 refresh was
hand-driven per `goals/effect-vitest-canon/PLAN.md:356`–`:365`).

Hosted vs local: hosted lint runs on committed JSONL + manifest + policy +
baseline + installed effect + repo AST only; `.repos/effect`, graft, network
and LLMs are local-only inputs to the refresh step.

Doctrine: the proposed DECISIONS entry ("Upstream-First Foundation/Modeling",
8 lines) and the 3-line `@beep/schema` README paragraph are drafted in
`research/gate-and-knowledge-plumbing.md` §(g), not applied.

## Constraints Discovered

1. **LiteralKit is both the top retirement (536 consumers) and a standing
   repo rule.** The user's coding standard says use `LiteralKit` for literal
   unions; AGENTS.md "Code Laws" names `LiteralKit` internal domains. Retiring
   it changes the rule text, the schema-first policy remediation strings
   (`SchemaFirstPolicy.ts:29` also names `SchemaUtils`, `Defect`, `Fn`,
   Email) and every `is.x` / `pickOptions` / Enum-key call shape. Align
   question, not a lane call.
2. **Role B exclusion contradicts the same-intent rule for six concepts**
   (HttpMethod, HttpStatus, MimeType, Jsonl, Toml, Yaml). One of the two
   decisions must bend.
3. **`SchemaUtils` ADAPT overlaps the active goal
   `goals/schema-utils-selective-codec-statics`.** Ratify the survivor
   (`collectAnnotationsAt`) against that goal before decompose.
4. **Upstream `export` ≠ public API.** `@internal` symbols leak into source
   greps and into the inventory (kept, flagged). Every adoption target must be
   checked against installed `dist/*.d.ts` or the `internal` flag.
5. **Consumer counts are direct imports only.** Barrel re-exports and runtime
   namespace aliases hide dependents; the one-PR plan needs a compiler-backed
   closure before sizing.
6. **Doctrine boundary.** `11-evolution-and-deprecation.md:98` allows
   immediate removal only for never-released in-repo symbols with no remaining
   consumers; `@beep/schema` is in-repo, so same-PR deletion is legal once
   consumers are migrated, but published/cross-slice contracts keep §11 rules.
7. **Hosted CI cannot see the knowledge layer.** Anything the gate needs must
   be committed (JSONL fixture); graft stays an agent aid.
8. **Line-keyed finding identity churns.** The existing schema-first key
   includes the line; a parity baseline needs occurrence anchors or it will
   report missing/stale entries on unrelated edits.
9. **Research-dir weight.** 3.7 MB of evidence receipts sit in `research/`;
   two JSON files exceed 400 KB. Decide at align what is committed, what is
   regenerable (scripts stay, big receipts may go), and note that the
   `.tsbuildinfo` outputs were deleted as regenerable.
10. **Friction receipt (2026-09-12).** The six lanes were launched as a
    background Bash task that the harness killed (exit 137) while its Codex
    children survived; the relaunch produced two generations writing the same
    files. Cost: duplicate quota, one inventory-contract collision (two
    extractors, one verifier), and three "verification supplement" files that
    are genuinely useful second passes. Prevention: launch lane batteries
    detached (`nohup setsid … & disown`) and watch markers with a persistent
    Monitor; give each output path exactly one writer.

## Align frontier (proposed)

1. LiteralKit: retire (same-intent rule) or carve out as a KEEP with a written
   reason, and what happens to the standing coding rule.
2. Role B adoption: allow Role B modules as retirement targets for the six
   UNSURE concepts, or keep the exclusion and KEEP them.
3. SchemaUtils survivor and the relationship to `schema-utils-selective-codec-statics`.
4. Wire-shape policy for retired transports (Timestamp epoch/ISO, Duration
   input forms, ArrayBuffer→Uint8Array, mutable Map/Set entry arrays, Graph
   snapshot serialization).
5. Case-string brands (Kebab/Pascal/Snake): accept normalization instead of
   rejection, or KEEP where rejection is application policy.
6. Which of the 21 idiom families become detectors in the first gate cut, and
   how F26 (obsolete tagged-error equivalence detector) is retired.
7. Inventory home and identity contract: `(module, symbol, kind)` rows in a
   repo-cli fixture, refreshed per effect bump by a committed generator.
8. Performance acceptance: the three-package `--extendedDiagnostics` numbers
   above as the baseline, and which upstream typeperf fixtures to mirror.
9. Whether the doctrine entry lands with the goal PR or ahead of it.
10. Evidence retention: which `research/` receipts are committed.
