# Map

<!--
Stage 4 (decompose), written 2026-09-15 from BRIEF.md and the 25 DECISIONS.md
entries; re-cut the same day after the LiteralKit reopen. This is the
graduation surface: every major component below cites a live repo capability
(verified against the worktree on 2026-09-15) or is marked NET-NEW. Line
numbers are from that verification, not from the 2026-09-12 research, which
has drifted after merging main.
-->

## Candidate Goal Packets

| Slug | Mission | Depends on | Capabilities cited |
| --- | --- | --- | --- |
| `effect-schema-parity` | Retire every `@beep/schema` concept whose consumed surface upstream rc.115 covers, trim the ones it covers only in part, migrate consumers by codemod, and leave a schema-first gate plus an rc-pinned inventory that hold parity on every effect bump. | `goals/schema-utils-selective-codec-statics` (P5 only; its P4 Yeet PR must merge first) | `schema-first` lint lane, `internal/ratchet`, `quality check-census`, ts-morph rewrite precedent, `effect-vitest-rc115` fixture layout, packet `research/tools/*` generator; NET-NEW: `SFV4-*` rules for three families, inventory generator command, boundary table |
| GATED: `schema-idiom-probes` | Raise F05 / F06 / F04 confidence with focused probes; graduate them into detectors if any clears 0.70. | `effect-schema-parity` P4 merged | Reopens this packet at decompose when a probe clears the bar; not a goal now. |
| GATED: persisted-encoding migrations | Change a stored or served encoding the boundary table shows differs from the upstream default. | boundary table in the goal SPEC | One migration goal per boundary; out of the parity goal by decision "Wire shape". Not a goal now. |
| LATER: runtime hot-path schema perf | Decode/encode cost on hot paths (Result/sync codec APIs), second priority per decision "Performance". | `effect-schema-parity` closed | Unsequenced. |

One goal, six phases, one release train (decision "PR batching revised",
2026-09-14). The gated rows are re-entry points, not promises.

## Phase Components And Capability Check

Disposition key: REUSE (call it), EXTEND (add a field or rule to it), MOVE
(relocate packet code into repo-cli), NET-NEW (does not exist), PROSE
(authored doc text), DELETE, KEEP.

### P0 — Doctrine PR

| Component | Disposition | Capability cited |
| --- | --- | --- |
| "Upstream-First Foundation/Modeling" entry | PROSE | `standards/architecture/11-evolution-and-deprecation.md`; draft text in `research/gate-and-knowledge-plumbing.md` §(g), amended by decision "LiteralKit reopened" (2026-09-15): intent is judged on the consumed surface facet by facet; an uncovered dominant facet makes the concept ADAPT (trim the covered facets); every RETIRE over 100 consumers runs a static-facet census before its PR opens. Precedent `standards/architecture/DECISIONS.md:580` (2026-07-08 upstream PGlite, no wrapper). The existing "In-repo deprecations without a release train" section admits immediate removal only for zero-consumer symbols; the new entry widens it to same-intent coverage with consumer migration in the same PR, and must say so. |
| Standing-rule rewrites | PROSE | `AGENTS.md:65-66`: narrow, do not replace. `LiteralKit` stays the default for named literal domains; one clause adds `S.Literals` for anonymous inline unions never referenced by name; the `as const` note stays. `packages/foundation/modeling/schema/README.md` gets the retirement rule. Rule statements in `standards/effect-laws-v1.md`, `standards/ARCHITECTURE.md`, `standards/effect-first-development.md`, `standards/architecture/04-rich-domain-model.md`, `.claude/skills/{schema-first-development,effect-first-development,crispen}/`, `.claude/agents/{schema-first-developer,crispener,code-patterns-strategist}.md`, `.codex/agents/*.toml` get the same clause. Code examples that show retired facets (`Options`, `pickOptions`, `thunk`) move with the P2 trim, not here. |
| User's global rule | NO CHANGE | `~/.claude/rules/effect-coding-standards.md` says "use LiteralKit"; it stays true. |

### P1 — Knowledge layer

| Component | Disposition | Capability cited |
| --- | --- | --- |
| Inventory generator + verifier | MOVE | `explorations/effect-schema-parity/research/tools/schema-inventory.ts`, `verify-schema-inventory.ts`; contract `research/inventory/README.md` (`schema-inventory/v1`, identity `(module, symbol, kind)`, `@internal` rows kept and flagged). Candidate home: `packages/tooling/tool/cli/src/commands/Lint/` beside `EffectVitest.ts`, exposed as a `--write` / `--check` subcommand. |
| Fixture directory per RC | NET-NEW dir, REUSE layout | `packages/tooling/tool/cli/test/fixtures/effect-schema-rc115/inventory/*.jsonl` following `test/fixtures/effect-vitest-rc115/` (per-RC directory, LICENSE carried). That fixture is vendored, not generated; the generator is what is new here (research §(e) confirms no automated fixture generator exists). |
| Pin manifest and sha check | EXTEND | `verifyEffectVitestPin` (`commands/Lint/internal/EffectVitestScan.ts:65`) compares installed version only; the parity pin adds upstream sha and a row digest so hosted CI proves provenance without `.repos/effect`. |
| JSONL persistence | REUSE | `internal/artifacts/index.ts` adapters; store shape `EffectVitestStore.ts:63` (read) and `:99` (write, generated header). |
| Local `--check` input | REUSE | `.repos/effect` symlink provisioned by `scripts/setup-effect-ref.sh` (present in the main clone, absent in this worktree; the command must fail loud, never pass empty, when it is missing). |
| Tests | REUSE pattern | `packages/tooling/tool/cli/test/effect-vitest-primitives.test.ts`; repo-cli tests run on Node and Bun. |
| Knowledge-refs gate | REUSE | `commands/Knowledge/Knowledge.refs.ts`; fixture paths written home-relative so the gate admits them. |
| Agent prompt templates | NET-NEW | Prompt text templated from inventory rows for the P2–P5 Codex lanes; a script in the goal packet, not a package. |

### P2 — LiteralKit trim (ADAPT)

Rulings from decision "LiteralKit reopened at decompose" (2026-09-15).
Counts are kit-only usage outside the kit's sources.

| Component | Disposition | Capability cited |
| --- | --- | --- |
| Schema facet | KEEP (already upstream) | `LiteralKit.schema.ts:784` calls `S.Literals(literals)`; `MappedLiteralKit.schema.ts:230` calls `S.Literals(from).transform(to)`. Nothing to adopt. |
| Keyed value API | KEEP | `Enum` (1,172 lines / 227 files), `is` (603 / 259), `$match` (243 / 143), `toTaggedUnion` (36 / 27, every site a custom tag), `LiteralToKey` (17 non-string kits). Verified gaps: no upstream keyed map or guard; `Match` has record forms only for tagged values (`valueTags`, `Match.d.ts:379`); `S.TaggedUnion` is `_tag`-only (`Schema.d.ts`, `TaggedStruct<K, ...>`). |
| Retired facets | DELETE + codemod | `Options` → `.literals` (395 / 212); `pickOptions` → `.pick(...).literals`, `omitOptions` → explicit complement pick (52 / 34); `HashSet` → call-site `HashSet.fromIterable(X.literals)` (15 lines); `thunk` → `F.constant(X.Enum.k)` (65 / 15; `Function.d.ts:383`). |
| `enumMapping` and the `M` type parameter | DELETE | Two production consumers (`packages/tooling/tool/cli/src/internal/cli/TurboCache.ts`, `packages/foundation/modeling/md/src/internal/conformance/Md.semantic-inspector.ts`) plus the kit test. Removes `M` from `LiteralKit`, `IsGuards`, `EnumType`, `MatchFn` and the collision/coverage validators (`LiteralKit.schema.ts:338-445`). |
| Static re-attachment | EXTEND (fix) | `attachHelperDescriptors` wraps `annotate` only (`LiteralKit.schema.ts:608`), so `check` and `pipe` drop the statics today. Override upstream's public `rebuild(ast)` on `Bottom` (`Schema.d.ts:142`), which every derivation calls. |
| MappedLiteralKit | ADAPT alike | `MappedLiteralKit.schema.ts:231` composes `LiteralKit(from)`; `From`/`To` kits lose the same four facets and keep the keyed directional API. About 14 production files, mostly `packages/foundation/modeling/schema/src/HttpStatus/*`. |
| AST rewrite engine | REUSE | `ts-morph` is a repo-cli dependency (`packages/tooling/tool/cli/package.json:213`); project creation `commands/Lint/internal/SchemaFirstProject.ts:42`; apply pipeline precedent `commands/Quality/internal/JSDocMigrateApply.ts:578` (bind, rewrite, quarantine, write, biome format, `dryRun`). The rename rules are NET-NEW; the engine is reused by the P3 numeric and unknown groups. |
| Self-consumption | RISK, REUSE | repo-cli is the largest consumer family (230 files under `packages/tooling`), and the lint's own rule domain is a kit (`commands/Lint/Lint.schemas.ts:104`). Run the codemod on `packages/tooling` first so `bun run beep` boots before the rest is rewritten. |
| Done signal | REUSE | Type check green plus zero `rg` hits for the retired names; F01 is not a detector (dropped 2026-09-15). `literal-kit-const-assertion` (`Lint.schemas.ts:106`, `SchemaFirst.render.ts:79`) stays. |
| Performance receipt | REUSE | Before/after `tsgo --extendedDiagnostics` on the three baseline packages (`research/performance-baseline.md` commands); the `M` parameter removal is the expected drop. |
| Generated baselines to regenerate | REUSE | `standards/schema-catalog.generated.jsonc` (`commands/Lint/SchemaCatalog.ts`), `standards/coverage.regression-baseline.jsonc`, `standards/jsdoc-documentation.inventory.md`, `standards/schema-first.inventory.jsonc`. |
| Sizing | MEASURED | About 250 consumer files by facet union (Options 212 dominates), plus the two kit modules; likely under the Yeet 512 KiB capture cap. |

### P3 — Retirement train

Grouped by upstream target; each PR carries its consumer migration and cites
the P0 entry. Counts are the audit's direct importers (`research/retirement-A-F.md`,
`retirement-G-Z.md`); each PR re-sizes with a compiler-backed closure.

| Group | Concepts (consumers) | Upstream target | Notes |
| --- | --- | --- | --- |
| A instance and declare wrappers | AbortSignal, DomDragEvent, DomEvent, DomHtmlElement, DomMouseEvent, EffectSchema (5), PromiseSchema, Thunk | `S.instanceOf`, `S.declare`, `Predicate.*`, `Effect.isEffect` | Smallest; a good second PR to prove the train shape. |
| B numeric family | Number (361), Int (143), Int64, Uint32, Uint64, Fixed32, Sfixed32, Sfixed64, Sint32, Sint64, Double, Float (ADAPT) | `S.Number`, `S.Int`, `S.isInt32` / `isUint32` / `isBetween`, `S.BigInt` bounds + string codec | Codemod-class; Number and Int pass the facet census gate first. Sign and serial bounds survive as checks; Float keeps its binary32 check. |
| C unknown, opaque, record, json | Unknown (128), Opaque (103), Record (32), Json (17), Primitive, SafeObject, Options, Transformations | `S.Unknown`, `S.UnknownFromJsonString`, `S.Defect`, `S.Record`, `S.JsonObject`, `S.OptionFromOptionalNullOr`, `S.decodeTo` | Codemod-class; Unknown and Opaque pass the facet census gate first. Equality exclusion moves to the owning field. |
| D time and duration | Timestamp (16), DateTimeUtcFromValid (2), Duration (2), Timezone | `S.DateTimeUtcFromString` / `FromMillis`, `DateTime.*`, `S.Duration*`, `S.TimeZone` named | Boundary table required before the PR opens. |
| E binary and collections | ArrayBuffer, Bytes, ArrayOf (6), HashSet (4), MutableHashMap, MutableHashSet, Graph, RegExp | `S.Uint8Array(FromBase64)`, `S.Array`, `S.HashSet`, `S.Graph` + `S.toCodecJson`, `S.RegExp` | Boundary table required (array wire fields, base64). |
| F text and misc | String (21), CommonTextSchemas (3), KebabStr / PascalStr / SnakeStr, URL (38), BigDecimal, Logs (6), StatusCauseError, FileInfo, JSONSchema | `S.Trim`, `S.NonEmptyString`, `String.kebabCase` / `pascalCase` / `snakeCase` (verified `effect/dist/String.d.ts:1442-1532`) with `S.decodeTo`, `S.String.check(S.isPattern(...))` for rejection, `S.URL`, `S.BigDecimal`, `LogLevel`, `S.TaggedError`, `FileSystem.File.Info`, `effect/JsonSchema` | HTTPS-only stays as a check on the consumer field. |
| G Role B | HttpMethod (2), HttpStatus (11), MimeType (4), Jsonl (0), Toml (2), Yaml (4) | `effect/unstable/http/{HttpMethod,HttpStatus,Mime}`, `effect/unstable/encoding/{Ndjson,Toml,Yaml}` | Losses recorded per decision "Role B modules may be retirement targets". HttpStatus retires here per the Role B ruling: its named codes become `effect/unstable/http/HttpStatus` value-module lookups, so its MappedLiteralKit use is transient between P2 and this PR. |

| Component | Disposition | Capability cited |
| --- | --- | --- |
| Facet census gate | NET-NEW (procedure) | Before any RETIRE over 100 consumers opens its PR (Number, Int, Unknown, Opaque): count kit-only usage per exported facet the way the LiteralKit census did (`rg` per member, kit sources excluded). An uncovered dominant facet flips the row to ADAPT in the goal's DECISIONS. Command shape lives in the goal PLAN. |
| Boundary to codec table | NET-NEW (SPEC prose) | Columns: boundary (persisted column, HTTP payload, in-memory, log line), concept, upstream codec, byte-identical yes/no. Persisted and served encodings must be byte-identical or the row is a migration goal, not a retirement. |
| Consumer codemods for B and C | REUSE P2 engine | Same ts-morph pipeline, new rewrite rules per concept. |
| Closure sizing | REUSE | `graft callers <symbol> --depth all` plus `bun run beep quality package-verify` on touched packages. |
| KEEP set | UNTOUCHED | 77 concepts; no-go. |

### P4 — Gate cut

| Component | Disposition | Capability cited |
| --- | --- | --- |
| `SFV4-*` rules for F03, F13, F24 | NET-NEW rules | `commands/Lint/internal/SchemaFirstDetectors.ts` (finding constructors and grouped AST detectors), advisory gating `SchemaFirstScan.ts:395`, remediation strings `SchemaFirstPolicy.ts:32`, closed rule domain `Lint.schemas.ts:104`, render groups `SchemaFirst.render.ts`. Family definitions: `research/idiom-families.md` §F03 (:158), §F13 (:298), §F24 (:452). F01 was dropped on 2026-09-15: after the P2 trim the type checker is the gate. |
| F26 correction | DELETE | `SFV4-tagged-error-equivalence` at `SchemaFirstDetectors.ts:1169`, `SchemaFirstPolicy.ts:32`, `SchemaFirstScan.ts:395`, `Lint.schemas.ts:112`. The `SchemaUtils` remediation strings in `SchemaFirstPolicy.ts` are rewritten; the `LiteralKit` one is narrowed to the surviving facets. |
| Ratchet | REUSE | `internal/ratchet/RatchetDiff.ts:71` `diffMembership`, `RatchetLifecycle.ts:67` `enforceRatchet`; baseline `standards/schema-first.inventory.jsonc`. Membership floor, not a count. |
| Occurrence-anchored identity | EXTEND | The schema-first key includes the line (`Lint.schemas.ts:582`); the effect-vitest lane already keeps line numbers out of membership identity (`Lint.schemas.ts:1292`). Port that shape for the new rules; do not reuse Vitest-specific identities unchanged. |
| Gate-then-zero precedent | REUSE pattern | `goals/schema-first-v4-capabilities` and `goals/schema-first-zero-actionables` (both `completed-retained`). |
| Detector input | DECIDED | Rules detect census families by AST shape; the inventory feeds prompts and the bump procedure, not the detector. The research's proposed inventory-driven `UpstreamParity*` family (`research/gate-and-knowledge-plumbing.md` §(a)) was superseded by decision "First gate cut". |

### P5 — Statics and performance close

| Component | Disposition | Capability cited |
| --- | --- | --- |
| Precondition | EXTERNAL | `goals/schema-utils-selective-codec-statics` `PLAN.md:18` shows P4 Yeet in progress on 2026-09-15; its merged PR is cited in the parity PLAN before this phase opens. |
| F15 detector + `withCodecStatics` retirement | NET-NEW rule, DELETE | `packages/foundation/modeling/schema/src/SchemaUtils/withCodecStatics.ts:420`; `collectAnnotationsAt.ts:149` survives (no upstream equivalent for recursive annotation collection). Family §F15 (`idiom-families.md:326`). SchemaUtils has 483 audited importers, 44 direct `@beep/schema/SchemaUtils` import sites today. Codec statics are bound decode/encode functions duplicating free functions; the LiteralKit keyed members are derived data over the schema, which is upstream's own pattern (`Literals.members`, `Union.members`, `Struct.fields`), so the two rulings do not conflict. |
| Type-check performance ratchet | EXTEND | `commands/Quality/CheckCensus.ts` already runs each package's check program with `--extendedDiagnostics` (`:330`) via `runCheckCensus` (`:672`) and `checkCensusCommand` (`:851`), but records files, wall time and diagnostics only. Add `instantiations` and `checkTimeMs` to its rows and compare against a committed baseline for the three packages. Baseline numbers and commands: `research/performance-baseline.md`. |
| Upstream typeperf mirror | REUSE | `.repos/effect/packages/effect/typeperf/suites/schema` with `run.mjs` and `compare.mjs`; mirror one or two suites so `@beep/schema` numbers are comparable. |
| Closeout | REUSE | `/reflect` writes `history/reflections/`; lifecycle flip and packet-state flip in the same PR (AGENTS.md same-PR rule). |

## Sequencing

P0 → P1 → P2 → P3 → P4 → P5, with P5 also gated on the selective-statics
merge.

- **P0 first** because every later PR cites a rule that must already exist,
  and the amended rule (intent per facet, census gate) is what the P2 trim
  and the P3 census gate apply (decision "Doctrine lands ahead").
- **P1 before P2** because the P2 Codex lanes are prompted from inventory
  rows, and because the fixture is the first artifact hosted CI verifies.
- **P2 before P3** because the trim builds the ts-morph rewrite engine that
  groups B and C reuse, and lands the doctrine's first ADAPT precedent
  before the census gate is applied to Number, Int, Unknown and Opaque.
- **P3 order inside the train:** A (smallest, proves the PR shape), then B
  and C (codemod-class, each behind its facet census), then D and E once
  the boundary table is reviewed, then F, then G. The SPEC may merge
  groups; it may not split a concept from its consumers.
- **P4 after P3** because the three new rules would otherwise ratchet
  against consumers the train is about to delete.
- **P5 last** because it waits on another goal's merge and closes the
  performance receipt against everything above.

If an effect RC bump lands mid-train, the bump PR regenerates the inventory
directory and the train continues on the new sha (decision "Appetite").

## First Vertical Slice

P0 plus P1, two PRs. When they land:

- An agent opening any later retirement PR can cite the §11 entry, including
  the facet-level intent test and the census gate, and reads the narrowed
  LiteralKit line in AGENTS.md.
- `bun run beep lint <inventory-command> --check` reproduces the 14 JSONL
  files byte-for-byte from `.repos/effect` at the pinned sha locally, and
  fails loud when the checkout is absent or at another sha.
- Hosted CI verifies row shape, duplicate identities, and the pinned sha with
  no effect checkout.
- A Codex lane prompt for one Role A module can be generated from the rows.

Verification: fixture directory present with pin manifest; verifier tests
green on Node and Bun; `bun run beep quality package-verify @beep/repo-cli`
green; `bun run beep yeet monitor` reports merge-ready on both PRs.

## Capability Challenges (claims that fell on inspection)

- **LiteralKit is ADAPT, not RETIRE.** The audit judged same-intent on the
  schema facet with the static census marked UNVERIFIED; the census shows
  the keyed API (`Enum`, `is`, `$match`, `toTaggedUnion`) is the consumed
  surface and has no upstream form. Four facets retire, one option drops,
  the rebuild hack is fixed. Decision "LiteralKit reopened", 2026-09-15.
- **Performance ratchet is not net-new.** `quality check-census` already runs
  `--extendedDiagnostics` per package; it lacks two parsed fields and a
  committed baseline. EXTEND, not a new tool.
- **Codemod engine is not net-new.** ts-morph is already a repo-cli
  dependency and `jsdoc-migrate apply` is a working rewrite pipeline with a
  dry run and a formatting step. Only the rewrite rules are new.
- **Occurrence-anchored identity is not net-new.** The effect-vitest lane
  already excludes line numbers from membership identity; the parity rules
  port that shape.
- **Inventory generator is net-new in repo-cli but exists as a prototype.**
  The packet's `research/tools/` scripts move; `effect-vitest-rc115` is a
  vendored fixture, so its layout is the precedent, not its refresh.
- **F01 is not a detector.** A rule that fires only on code the compiler
  already rejects is frozen at zero; it left the gate cut.

## Open Risks Inherited From The Brief

- Consumer counts are direct imports only; each PR re-sizes with a
  compiler-backed closure. LiteralKit reads 536 (census) or 614 (`rg`, today).
- Upstream `export` is not public API; every adoption target is checked
  against installed `dist/*.d.ts`, and `@internal` rows are never targets.
- Wire-shape drift on stored data is controlled by the boundary table; a
  persisted encoding change is a migration goal, not a retirement PR.
- Line-keyed finding identity churns; the new rules use occurrence anchors.
- Yeet capture cap: the group B and C PRs likely take the manual `gh pr`
  path; merge main often; never push after the squash.
- Hosted CI cannot see `.repos/effect`, graft, or an LLM; only committed
  JSONL, policy and baselines run hosted.
- Added at decompose: repo-cli is the biggest LiteralKit consumer, so the
  trim rewrites the tool that verifies the trim; rewrite `packages/tooling`
  first and boot the CLI before touching the rest.
- Added at decompose: four generated tracked baselines name the retired
  concepts (schema catalog, coverage regression, jsdoc inventory,
  schema-first inventory); each retirement PR regenerates them or the
  cheap gates go red on files that no longer exist.
- Added at decompose: `.repos/effect` is absent in linked worktrees until
  `scripts/setup-effect-ref.sh` runs there; the generator must fail loud.
- Added at the reopen: any audit row whose consumed surface was not censused
  is suspect; the facet census gate covers the four rows over 100 consumers,
  and review must watch the smaller ones for the same shape.
- Added at the reopen: the `rebuild` override must be verified on
  MappedLiteralKit's `From`/`To` kits and on every `.check(...)` derivation
  of a kit in the repo, since those silently lose statics today.

## Later Candidates And Re-entry Gates

- **F05 / F06 / F04 probes** (confidence 0.45 / 0.40 / 0.55): skill prose
  for now; a focused probe that clears 0.70 reopens this packet at
  decompose for a detector.
- **Persisted-encoding migrations**: any boundary-table row that is not
  byte-identical becomes its own migration goal.
- **Runtime hot-path decode/encode**: second performance priority, after
  close.
- **Ranks 10–21 idiom families**: dropped from the gate; revisit only with a
  new census.

## Definition-Of-Ready Check (2026-09-15, after the reopen)

1. Brief complete: problem, appetite, sketch, rabbit holes, no-gos present in
   `BRIEF.md` and re-cut for the ADAPT ruling. PASS.
2. No unresolved blocking questions: manifest `openQuestions` empty; the
   2026-09-12 "PR batching" and 2026-09-14 "LiteralKit retires" entries are
   superseded, not open. PASS.
3. Map names the work: one slug, mission, dependency, first slice above.
   PASS.
4. Capability check: every component above cites a verified path or is
   marked NET-NEW, with six claims downgraded. PASS.

Graduation is the next stage: scaffold `goals/effect-schema-parity/` from
`goals/_template`, seed `SPEC.md` from the brief (no-gos to non-goals,
rabbit holes to constraints, DECISIONS to the decision log), carry
`research/SOURCES.md`, cross-link both manifests.
