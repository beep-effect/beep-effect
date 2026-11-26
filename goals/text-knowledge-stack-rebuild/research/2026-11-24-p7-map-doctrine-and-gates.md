# P7 map: doctrine, the knowledge-base selector and the gates

Measured at `f30c183f20a` (this lane's HEAD). The P6 lane was read at the same commit
`f30c183f20a`, plus its uncommitted row 4 and 5 work (`nlp-processing/src/Activity.ts`,
`jsonc/src/ActivityRecord.ts`, `bun.lock`, root `tsconfig.json`); none of it touches
`standards/architecture/` or `docs/`. `origin/main` was read at `9633244e6c8` without a fetch.
The merge base of HEAD with `origin/main` is `9a4f7b0258d`. The P0 PR #3420 merged as
`dcf6b16a77d`; the census base is `f9982f3b5e6` (`research/consumer-census.md` "Base and
method").

Scope: map C of P7. It covers (a) the chapter, the nine rulings, the glossary, the
chapter-11 amendment and the vision document; (b) the cli knowledge-base `Selector` text-quote
case; (c) the gates: S31 inventories, the three lints, the two closures and `bun.lock`. The
`@beep/nlp` and `@beep/schema-org` consumer residue is only touched here where a gate depends
on it.

## 1. Doctrine on `origin/main` against this stack

### 1.1 What is on `origin/main`

| Artefact | On `origin/main` | Only in this stack (P4, P5, P6 commits) |
| --- | --- | --- |
| `standards/architecture/16-knowledge-stack.md` | yes, at the P3 state (last change `c402896ccd5`, #3516) | 117 changed lines (`git diff --stat origin/main HEAD`), all P4, P5 and P6 "Implemented in Pn lane" and landed-state rewrites |
| `standards/architecture/DECISIONS.md`: the nine 2026-11-19 rulings | yes, all nine since `dcf6b16a77d` (`DECISIONS.md:2767,2831,2897,2935,2984,3031,3074,3123,3157`) | nothing: HEAD and `origin/main` are identical for this file |
| `DECISIONS.md`: the scoped chapter-11 amendment | yes, since `dcf6b16a77d` (`DECISIONS.md:3193-3281`) | nothing |
| `DECISIONS.md`: phase landing entries | L1 (`:3283`, P2) and L2 (`:3358`, P3) | none: the P4, P5 and P6 designs add no `DECISIONS.md` entry (`rg -n DECISIONS research/2026-11-2[34]-p[456]-design.md` finds only an exploration path) |
| `standards/architecture/GLOSSARY.md`: the 24 entries of the glossary ruling (`DECISIONS.md:3127-3134`) | all present as `##` entries (`GLOSSARY.md:48,59,82,115,149,164,246,360,391,505,522,549,558,594,605,615,631,644,827,872,959,988,1032,1075`), plus the P2 and P3 additions (Anchored, Annotation Document, Capture Id, Locator Map, Quote Key, Re-anchoring) | two hunks: `GLOSSARY.md:174-175` drops "(Pending P4)" for `makeClaimCore`, and `:662-663` replaces the epistemic `EvidenceSpan` example with `EvidencePosition` |
| `11-evolution-and-deprecation.md` rule 5 pointer to the amendment | yes, `11-evolution-and-deprecation.md:164-167`, from `dcf6b16a77d` | nothing |

The P7 exit "the chapter, rulings and glossary entries exist on `origin/main`" holds today for
the rulings, the amendment and every glossary entry. The chapter exists, but in its P3 state.
Its final text reaches `origin/main` only when the P4 to P7 layers merge.

### 1.2 The chapter-11 amendment is in force

- Merged with P0 in `dcf6b16a77d` on 2026-11-19. Its status reads "Active (expires when
  `goals/text-knowledge-stack-rebuild` reaches `completed-retained`)" (`DECISIONS.md:3195-3196`).
- Rule 5 cites it in place (`11-evolution-and-deprecation.md:164-167`).
- P2 (#3511, `c660085fdaa`) merged on 2026-11-23, after the amendment, so the "no PR of P2 to P7
  opens until it is on `origin/main`" clause (`DECISIONS.md:3248-3250`) was met.
- Both P7 packages are in the named list: `@beep/nlp` and `@beep/schema-org`
  (`DECISIONS.md:3211-3214`). `@beep/repo-cli` is not in that list, which matters for the
  knowledge-base case in section 2.
- Because of the expiry clause, the entry stops applying at closeout. See D7.

### 1.3 What in the chapter still reads as draft or names retired symbols

Every line below is at HEAD. Rows 4 to 17 of P6 rewrite the "Pending P6" notes in their row 16
(`research/2026-11-24-p6-design.md:1014-1016`); P7 owns everything else.

| Line | Text | Needed in P7 |
| --- | --- | --- |
| `16-knowledge-stack.md:10-19` | "The code reaches it over phases P1 to P7 … P1 made the L0 rules true … and P2 made the L1 rules true" | name P3 to P7 as landed. The "target doctrine" and "Pending Pn" framing has no remaining referent once P7 lands. |
| `:56-61` | the Lands column: `Implemented in P3 lane`, `Implemented in P5 lane`, `Implemented in P4 lane`, `Pending P6` | `P3`, `P4`, `P5`, `P6` (P3 is already on `origin/main` and still reads "lane" there) |
| `:384-388` | L5 owner "absorbs `nlp/Operations`, the `nlp/Algebra` instances … and … `nlp/Core` … (Pending P6)" | past tense: `Core` and the graph schema moved; `Operations`, `Algebra` and `GraphOps` were deleted after the census (decision `2026-11-24-p6-nlp-operations-and-algebra-are-replaced-not-moved`) |
| `:473-475` | the forbidden edges "are Pending P6 for the packages that have not landed" | drop the pending clause |
| `:556-559` | "the `@beep/nlp` Handoff and Graph spans were deleted in P3" | historical and true. It names a package that will no longer exist, so the delete-package dry run lists it as a baseline hit (section 3.5). Keep it as history. |
| `:562-564` | "The cli knowledge-base `Selector` has a text-quote case and is kept, because it is repo tooling with no consumer in the stack; P7 re-checks it." | restate it with the section 2 result. The "no consumer in the stack" clause needs care: the Kb module now consumes `@beep/text`, `@beep/epistemics` and `@beep/rdf` (section 2.1). |
| `:720`, `:727`, `:733`, `:735`, `:740` | "Pending P6" in sections 11 and 12 | P6 row 16 (prompt rendering is scoped out, decision `2026-11-24-p6-chapter-12-pending-notes-close-as-delivered-or-scoped`) |
| `:771-800` (section 14) | "That file is deleted with its package in P7; what stays true of it is below." | past tense. Also cover the THEORY claims the section never mentions (section 1.4). |
| `:802-813` (See also) | cites the packet SPEC and ledger | keep. The packet stays retained after closeout. |

The glossary at HEAD names no retired symbol: `rg -n -i "pending p|@beep/nlp\b|schema-org|THEORY|@beep/provenance|EvidenceSpan|Handoff"`
finds only the historical `makeClaimEnvelope` and `ClaimVersion` in the past tense
(`GLOSSARY.md:175`).

### 1.4 THEORY.md against chapter section 14

`packages/foundation/modeling/nlp/THEORY.md` (180 lines; P3 and P6 edited it, 64 changed lines
since `dcf6b16a77d`) has eleven sections. Section 14 of the chapter keeps six claims and
withdraws four. The table maps each THEORY section to section 14.

| THEORY section | Chapter section 14 | Status |
| --- | --- | --- |
| §1 objects (typed strata), `THEORY.md:17-29` | kept, `L2-5` (`16-knowledge-stack.md:783`) | absorbed |
| §2 annotated text graph; "colimit", merge as a monoid, `:31-42` | kept as the `L2-1` join (`:782`) and the `effect/Graph` row (`:785`) | absorbed |
| §3 Kleisli category, `:44-61` | kept, `L5-1` and `L5-2` (`:780-781`) | absorbed |
| §4 monoids and laws, `:63-71` | withdrawn (`:794-796`) | absorbed |
| §5 F-algebras: `cata` and `ana` as "first-class recursion schemes", `:73-86` | **not mentioned** | gap. No `cata` or `ana` exists (`rg -n -w "cata\|ana\|catamorphism\|anamorphism" packages --type ts` finds only email fixtures), and THEORY's own map row "Graph-level operations, cata/ana" (`:167`) names nothing. This needs a withdrawn bullet. |
| §6 paired directions (structure and projection, query and index), `:88-110` | withdrawn as triangle identities (`:797-798`) | absorbed, but only for the triangle identities. The §6.1 coherence law ("normalizing tokens you just produced agrees with normalizing the source") and the §6.2 "downstream knowledge-graph initiative" claim are not named. |
| §7 backends as a category of functors; capability detection total via `BackendNotSupported`, `:112-126` | **not mentioned** | gap. The typed `BackendNotSupported` failure exists (`nlp-processing/src/Backend/NLPBackend.ts`, test `nlp-processing/test/Backend/NLPBackend.test.ts`), but no ledger row names it. "Functors" predicts no law. Keep the operational part only if a ledger row backs it; otherwise withdraw (D3). |
| §8 generic IR as a free object, `:128-133` | withdrawn (`:789-793`) | absorbed |
| §9 proofs: monoid, Kleisli, triangle and handoff round-trip laws, `:135-148` | partly: Kleisli kept, monoid and triangle withdrawn | gap for "handoff round-trips — chunk ↔ reassemble, and provenance completeness". The handoff is deleted (P3), but the claim is not listed. |
| §10 deferred items, `:150-160` | not mentioned | stale. Streaming MCP tools now exist (`packages/drivers/nlp-mcp/src/StreamingTools.ts`). This is not a structural claim, so it can be dropped with the file. |
| §11 map: mathematics to modules, `:162-175` | not mentioned | dropped with the file. The chapter's layer table (`:52-61`) is the map. |
| footer "Upstream half of the `ip-law-knowledge-graph` initiative" `:179-180` | the withdrawn handoff bullet names the deleted downstream owner (`:791-793`) | absorbed |

### 1.5 The vision document

The PLAN's "vision document" is `docs/PROSE_TO_PROOF_VISION.md` (94 lines, last touched
`809ceb301b5`). The ruling `DECISIONS.md:3157-3191` names it and sends its correction to P7. The
SPEC gate is `rg -n "local-first|on-device" docs/PROSE_TO_PROOF_VISION.md` returning no sentence
that states either as architecture (`SPEC.md:482-483`). The ruling also leaves the BeepGraph
status line "settled in P7 from the code that exists then" (`DECISIONS.md:3168-3170`).

The table lists what is wrong against the delivered stack. Line numbers are in
`docs/PROSE_TO_PROOF_VISION.md`.

| Line | Vision text | Delivered stack | Kind |
| --- | --- | --- | --- |
| `:4` | "A local-first, provenance-grounded knowledge workbench" | local-first is withdrawn as architecture (`DECISIONS.md:3163-3167`; SPEC Non-Goals) | gate hit |
| `:15` | "flows through **one local machine**" | same ruling | architecture claim, not a gate hit |
| `:55` | "Local-first, on device by default; … Embeddings are computed locally." | same ruling; hosted providers welcome | gate hit |
| `:62` | principle 1 "Local-first, every matter walled. On-device by default; matters are named subgraphs that are also confidentiality boundaries" | two errors: the local-first posture, and the matter wall as a graph name. Chapter section 11: "A matter wall is authorization, not a graph name", one authority port checked at seven access paths (`16-knowledge-stack.md:701-720`) | gate hit plus a doctrine error |
| `:94` | footer "one graph, walled by matter · everything on device" | both rulings above | architecture claim ("on device" is spelled without the hyphen, so the gate regex misses it) |
| `:86` | "`apps/professional-desktop` (v0.0.3) is honestly a local-first **chat app**" | describes an app, not the architecture; the gate regex still hits it | gate hit, wording call (D4) |
| `:50`, `:51` | "One logical graph, **walled by matter** — each matter a named subgraph that doubles as an ethical wall"; "conflict-of-interest checks across matters — a query only a single unified graph can answer" | section 11: identical bytes in two matters never grant cross-matter access; scope is checked per path. A cross-matter conflict check needs its own authority grant (D5). | doctrine error |
| `:40` | "the one place where *confidence becomes provenance* … a **SHACL gate** validates its shape, a **consistency check** proves … **materialized** … with a permanent link to its source span" | chapter sections 1 and 7: admission is approval for a stated use, with a grounding witness that verifies against the current text digest and a human token bound to actor, action, revision and scope (`:610-628`). Section 8: signals never cross an admission; any ranking is a named triage policy (`:631-644`). | doctrine error |
| `:66` | principle 5 "Confidence routes a guess to review; only proof admits a fact." | section 8: no blended score, `Absent{reason}`, and triage policies "unable to cross an admission gate". Section 7: admission is not truth. | doctrine error |
| `:65` | principle 4 "A **character span** is the provenance link … This is built: `GroundedExtraction.span` (`packages/foundation/capability/langextract/src/Extraction`)" | section 5: the stack is occurrence-first; quotes locate, ranges identify, and `OccurrenceId` is the only text-occurrence identity (`:550-584`). `GroundedExtraction` has no `span` field since P3 (`8d2e63b4f5a`); it carries `anchor: TextAnchor` (`langextract/src/Extraction/Extraction.model.ts:190`). | names a retired field |
| `:50`, `:86` | "typed claims, evidence, and provenance (`@beep/epistemic-domain`)"; "PROV-O and bounded SHACL (`packages/foundation/capability/semantic-web`)" | the L4 claim core is `@beep/epistemics` (`foundation/modeling`), text identity is `@beep/text`, annotation is `@beep/annotation`, and the PROV projection is `@beep/rdf` `src/Prov.ts` (`16-knowledge-stack.md:52-61,410-434`). `@beep/epistemic-domain` is the slice domain. | stale owner names |
| `:50` | "a stack of published legal ontologies (FOLIO, BFO, LKIF-Core, the WEMI/LRMoo document model, ODRL, CPC/IPC …)" | section 10: registered `prov`, `oa`, `nif`, `xsd`, `gufo`, `as`; pinned eleven, including `skos`, `doco` and SPAR; LKIF and ELI are candidates with no commitment (`:665-683`). The foundational typing is gUFO, not BFO (`:296-303`). The FOLIO alignment lives in the legal intake scheme (P5 decision `2026-11-23-p5-the-folio-alignment-lives-in-the-legal-intake-scheme-and-alignments-resolve-within-one-manifest`). | stale vocabulary list |
| `:7`, `:90` | "**Architecture name:** BeepGraph"; "The architecture that gets us there — effect-ontology as the typed authority spine, TrustGraph as the projection/retrieval shell — is settled in [BeepGraph]" | `docs/BEEPGRAPH_ARCHITECTURE.md:4` reads "**Status**: Proposed". The memory-architecture log narrowed BeepGraph to the provenance and verification layers (`standards/memory-architecture/04-decision-log.md:325`). No package or app is named BeepGraph (`rg -l -i beepgraph packages apps` finds only a rewrite-rules data file). Chapter 16 is the binding doctrine for the knowledge stack. | the status line the ruling sends to P7 |
| `:15`, `:79` | "admits only what survives into one knowledge graph"; "proven graph" | section 1: "The file is canonical; the graph indexes it", and graphs and datasets are disposable projections, never a second writer (`:39-41`). Principle 2 (`:63`) already agrees. | wording, low |

The same posture appears in companion docs that the SPEC gate does not name: `rg -c -i
"local-first|on-device|on device"` counts `docs/product/prose-to-proof.md` 6,
`docs/BEEPGRAPH_ARCHITECTURE.md` 4, `docs/PROSE_TO_PROOF_ARCHITECTURE_MAP.md` 3, `README.md` 1
and `docs/ROADMAP.md` 1 (D4).

## 2. The cli knowledge-base `Selector` text-quote case

### 2.1 What it is

- Schema: `Selector = S.TaggedUnion({ TextQuote: { exact, prefix, suffix, start, end },
  MediaFragment: { start, end } })` with half-open UTF-16 offsets
  (`packages/tooling/tool/cli/src/commands/Kb/Kb.schemas.ts:102-124`). It is a field of
  `Assertion` (`kb-assertion/v2`, `Kb.schemas.ts:147-166`), next to `sourceRef` (`kind`,
  `locator`, `sha256`, optional `text`, `:96-100`) and `quote` and `quoteDigest`.
- Checks: `Kb.service.ts:55-95` checks `exact === quote`, consistency through `@beep/text`
  `TextAnchor.isInternallyConsistent`, UTF-16 boundaries through `isUtf16Boundary`, and
  prefix and suffix against the capture text when one is present.
- Projection: `Kb.projection.ts:69-83` emits the case as `urn:beep:kb:` quads (`exact`,
  `prefix`, `suffix`, `selectorKind`, `start`, `end`) in the `provenance` named graph
  (`Kb.projection.ts:13-22`). It uses no `oa:` term.
- Command: `beep kb validate|build|graph --root <dir>` (`Kb.command.ts:111-171`; dispatch
  `src/internal/dispatch/Dispatch.manifest.ts:186-188`). The ledger root is explicit; nothing
  defaults into the repository.
- Origin: #2715 (`a4c5145b820`, 2026-11-05). The P4 claims work (`2ced3e0a632`) rebound it to
  `@beep/epistemics` claim cores and added the frozen v1 readers.

### 2.2 Consumers and stored bytes

- Inbound: nothing in the stack imports it. `rg -l "commands/Kb" packages apps --type ts`
  outside the module finds only cli tests (`test/Kb.test.ts`, `test/CliClaimMigration.test.ts`,
  `test/ClaimOwner.laws.test.ts`), the dispatch manifest and the cli barrel.
- Outbound: since P2 and P4 the module consumes the stack (`@beep/text/TextAnchor`,
  `@beep/epistemics/*`, `@beep/rdf/Rdf`, `@beep/jsonc/ActivityStart`; `Kb.schemas.ts:1-9`,
  `Kb.service.ts:1-27`, `Kb.projection.ts:1-11`). "No consumer in the stack" (`DECISIONS.md:2869-2871`,
  census `consumer-census.md:345`) is still true read as "no stack package consumes it".
- Stored bytes: `assertions.jsonl`, `claims.jsonl` and `registry.jsonl` under the caller's
  `--root` (`Kb.service.ts:305,323-347`; `KbGraph.service.ts:225`). The frozen
  `KbAssertionV1Row` carries the same `selector` field (`internal/KbStore.ts:55-65`), so the
  case is in both stored formats. The repository tracks no such ledger: `git ls-files`, matched
  against `(assertions|registry)\.jsonl$` and against the `kb-assertion/v` tag, finds only the
  module and `test/Kb.test.ts`. The live ledgers are operator data outside git and were not read
  (no corpus access).
- Test fixtures: four `TextQuote` literals in `test/Kb.test.ts:128,287,292,737`.

### 2.3 Keep or delete: keep, by a decision file

Evidence for keep:

1. The case has stored rows in two declared formats (v2 and the frozen v1). `@beep/repo-cli` is
   not a package named in the amendment (`DECISIONS.md:3211-3219`), so rule 5 and the
   stored-format law apply unchanged. The bytes stay, and any change is a declared read-time
   transform.
2. It mints no identity. Assertions are keyed by `RegistryId`, and nothing derives an id from
   the selector. Chapter section 5's "only text-occurrence identity" (`16-knowledge-stack.md:550-556`)
   is not contested.
3. It already validates through L1 (`TextAnchor.isInternallyConsistent`, `isUtf16Boundary`), so
   no second offset semantics exists.
4. Deleting the `TextQuote` case would make every stored text assertion undecodable. The case
   is the module's main payload.

Against a plain keep:

- The decoded shape is a parallel in-memory form of what `@beep/text` `Selector` expresses
  (`Refined { base: Position, by: QuoteSelector }`, and a media `FragmentSelector` with
  `conformsTo` the W3C media-fragments IRI; `text/src/Selector.ts:27-171`). Under "best core over
  compatibility", the stronger option is ADAPT: decode the frozen bytes into the `@beep/text`
  selector at read time and drop the local union. Keeping the stored bytes is still required.
- The outward projection emits local `urn:beep:kb:` predicates where the stack's interchange is
  the `oa:` codec (`rdf/src/Adapters/WebAnnotation.ts`). That is acceptable for repo tooling,
  but the decision should record it.

Recommendation: keep, recorded by a decision file. The reasons are stored bytes outside the
amendment's package list, no identity minted, and L1 validation already used. Rewrite the
chapter sentence `16-knowledge-stack.md:562-564` to say so. The ADAPT option is the alternative
in the decision's reversal (D1).

A pre-existing comment-law finding was observed and not fixed: `Kb.projection.ts:33` holds a
free prose comment ("A claim enters the current graph only when …"), from `dfd2e0319de`, #2724.

## 3. Gates

### 3.1 S31 inventories

Definition (`SPEC.md:281-285`; census `consumer-census.md:539-563`): for each inventory or
allowlist the census names, count the lines that name `packages/foundation/(modeling|capability)/<pkg>/`.
That count at a phase head must be at or below the base count, with moved packages carrying
entries by rename. The census base is `f9982f3b5e6`. For every row below, `f9982f3b5e6` and
`dcf6b16a77d` give identical counts, so the choice between them makes no difference here (D6).

Per-package counts (script `grep -cE` per ref over `git show <ref>:<file>`):

| Package | Inventory | `f9982f3b5e6` | `dcf6b16a77d` | `origin/main` | HEAD | After P7 deletion |
| --- | --- | --- | --- | --- | --- | --- |
| nlp | `standards/coverage.regression-baseline.jsonc` | 29 | 29 | 25 | 5 | 0, but the nlp plan has no `coverage-baseline` step (D8) |
| nlp | `standards/schema-first.inventory.jsonc` | 1 | 1 | 0 | 0 | 0 |
| nlp | `standards/fallow.boundaries.provenance.jsonc` | 1 | 1 | 1 | 1 | 0 (`fallow-boundaries` rebuild) |
| nlp | `.gitleaks.toml` | 1 | 1 | 1 | 1 | 1: `.gitleaks.toml:296` sits in the frozen boolean-creep block and holds a recorded hash, not a live path (P6 design `:484-489`) |
| nlp | `lint-rules/src/rules/no-manual-effect-runtime-in-tests.ts` allowance | 3 | 3 | 0 | 0 | 0 |
| nlp | in-package suppressions | 0 | 0 | 0 | 0 | 0 |
| schema-org | coverage baseline | 15 | 15 | 15 | 15 | 0 |
| schema-org | schema-first inventory (`Person.ts`, `:1049-1055`) | 1 | 1 | 1 | 1 | 0 (`schema-first-inventory` rebuild) |
| schema-org | `_typos.toml` (exclude `:120`, comment `:14`) | 1 | 1 | 1 | 1 | must be edited by hand: the delete-package inverse plan has no `_typos` step and listed no hit there (section 3.5) |
| schema-org | in-package suppressions | 3 | 3 | 3 | 3 | 0 (they leave with the tree) |
| nlp-processing | coverage baseline | 50 | 50 | 50 | 50 | per rename |
| nlp-processing | `no-manual-effect-runtime-in-tests.ts` allowance | 0 | 0 | 0 | 2 | 2: moved from nlp by rename (3 to 2, the stale `Handoff/Contract.test.ts` row removed) |
| nlp-processing | in-package suppressions | 2 | 2 | 2 | **3** | **growth**: `nlp-processing/test/Operation.test.ts:133` `// @ts-expect-error an effectful arrow is not a Pure witness, so commute refuses it` (P6 row 4, `f30c183f20a`) |
| nlp-processing | schema-first 2, fallow health 1, boundaries provenance 1, `.gitleaks.toml` 2 | unchanged | | | | |

Whole-file totals, for attribution. Whole-file growth comes from `main`, not this stack:

| File (entry pattern) | `f9982f3b5e6` | merge base `9a4f7b0258d` | `origin/main` | HEAD |
| --- | --- | --- | --- | --- |
| coverage baseline (per-file rows) | 4,932 | 4,956 | 4,985 | 4,995 |
| schema-first inventory (`"file":`) | 282 | 286 | 285 | 283 |
| `standards/effect-vitest.inventory.jsonc` (`"id":`) | 647 | 661 | 670 | 661 |
| `standards/effect-laws.allowlist.jsonc` (`"rule":`) | 36 | 36 | 36 | 36 |
| `standards/fallow.health.regression-baseline.jsonc` (`"count":`) | 116 | 116 | 116 | 116 |
| `standards/fallow.boundaries.provenance.jsonc` (`"ruleId":`) | 93 | 93 | 93 | 93 |
| `standards/check-census.regression-baseline.jsonc` | 16 | 16 | 16 | 16 |
| `standards/entity-kit-freeze.baseline.jsonc` | 55 | 55 | 55 | 55 |
| `.gitleaksignore` (lines) | 116 | 116 | 116 | 116 |

- Effect-vitest inventory: the stack adds nothing (merge base 661, HEAD 661, no per-file
  difference). The growth from 647 is `main`.
- Coverage baseline, merge base to HEAD: −24 nlp, −5 ontology, −4 provenance, −2 rdf and others
  removed; +16 text, +15 rdf, +11 annotation, +10 law-practice domain, +9 epistemics, +7 ontology
  and others added. The added rows are new files registered at 100 percent (decision
  `2026-11-22-p2-coverage-rows-at-full-coverage-are-registration`).
- Schema-first, merge base to HEAD: −3 (`EvidenceSpan.model.ts`, `nlp/src/Handoff/Contract.ts`,
  `ontology/src/Fold.projections.ts`).

### 3.2 `bun run beep lint schema-first`: red at HEAD, inherited from P4

Exit 1. The parity and wrapper ratchets are at zero. Seven `schema-first-inventory` errors, each
reported twice, are in files only P4 touched (`2ced3e0a632` and `960b792a314`):

| File | Symbol | Finding |
| --- | --- | --- |
| `apps/labs/semantica/src/schema/LedgerEvidence.ts` | `LedgerEvidenceV1Outcome` | bare exported `S.Struct` (D1 opaque rule) |
| `packages/tooling/tool/cli/src/commands/Holds/Holds.schemas.ts` | `HoldClaimEvent` | bare exported `S.Struct` |
| `packages/tooling/tool/cli/src/commands/Holds/internal/HoldStore.ts` | `HoldProbeRunV1Row` | bare exported `S.Struct` |
| `packages/tooling/tool/cli/src/commands/Kb/Kb.schemas.ts` | `KbClaimEvent` (`:369`) | bare exported schema |
| `packages/tooling/tool/cli/src/commands/Kb/internal/KbStore.ts` | `KbAssertionV1Row` (`:60`) | bare exported `S.Struct` |
| `packages/tooling/tool/cli/src/internal/claims/ClaimHistory.ts` | `NativeFacts` (`:135`), `CoreEventFacts` (`:213`) | exported pure-data interfaces |

The remediation the lint offers, `--write`, would admit seven entries, which is S31 growth. The
fix that keeps S31 is to model them: `S.Opaque` with `$I.annoteSchema`, and the interfaces as
schemas. That fix belongs to the P4 layer, so the defect is routed to its owner (D2). The
remaining findings are warnings (`SFV4-fn-schema`, `SFV4-arbitrary-tests`).

### 3.3 `bun run beep lint identity-registry`: green

Exit 0 with the default base, which is the merge base `9a4f7b0258d`. That base has no term
snapshot, so the comparison is against the empty snapshot. Exit 0 also with
`--base origin/main`: "219 workspace packages registered; 6 lab(s) …; no orphan or local root
composers". After the deletion the count becomes 217. The delete-package `identity-segment` step
removes `$NlpId` (`identity/src/packages.ts:791,804`) and its `shape-stable.test.ts:161` row.
The schema-org plan's `identity-segment` step removes `$SchemaOrgId` (`packages.ts:220,3210-3224`)
the same way. No
registry namespace names either package (`identity/registry/namespaces/*.json`), so
`Registry.data.ts` is not touched.

### 3.4 `bun run beep lint package-scripts --check`: red at HEAD, inherited from P5

"219 manifests, 1 drifting": `packages/law-practice/domain/package.json: doctest: missing-task`
and `beep:doctest: missing-impl`. P5's `0ace3e35c3e` added doctest-bearing modules
(`values/IntakeTaxonomy`, `values/LegalVocabularyPack`), so the generator now wants the doctest
pair. The fix is `bun run beep lint package-scripts --write` in the P5 layer. The SPEC's narrower
form ("every package under `packages/foundation/modeling` and `packages/foundation/capability`",
`SPEC.md:474-476`) passes. The PLAN's form, the whole command, does not.

### 3.5 delete-package dry runs

`bun run beep delete-package <pkg> --dry-run` writes nothing (it returns before any apply,
`DeletePackage.command.ts:881`). The tree was unchanged before and after both runs.

- `@beep/schema-org`: no direct or transitive dependent. 12 hard `file-path` hits:
  `CiLanePartitions.ts:619` and `CoverageScope.ts:452` (registration tables);
  `cli/test/delete-package.test.ts:1297,1300,1307,1310,1354` and
  `cli/test/fixtures/dependency-review/manifest-inventory.json:698` (string fixtures);
  `repo-cli-kit/src/WholeToken.ts:9,54,64` (JSDoc examples that use `@beep/schema-org` as the
  look-alike of `@beep/schema`); `turbo.json`. Baseline hits: `identity/src/packages.ts:3210,3224`
  and `DECISIONS.md:3214`. Soft refusal: packet claims; it asks for `--rewrite-packets` or
  `--allow-stale-packets`.
- `@beep/nlp`: no direct or transitive dependent. 33 hard `file-path` hits: 15 in
  nlp-processing (prose JSDoc such as "Effect v4 `@beep/nlp` implementation notes:" in
  `NLPService.ts:12`, `Graph/Schema.ts:12`, …, `internal/observability.ts:2,16`, `CHANGELOG.md:1`),
  6 in nlp-mcp (`README.md:3`, `package.json:4`, `src/Server.ts:2,8`, `src/bin.ts:2`,
  `test/Server.test.ts:12`), 6 in wink (`AGENTS.md:4,5`, `CLAUDE.md:4,5`, `README.md:3`,
  `src/WinkBackend.service.ts:13`), 5 in repo-cli (`CiLanePartitions.ts:412,827`,
  `CoverageScope.ts:394`, `quality-tasks.test.ts:9343`, the dependency-review fixture `:673`), and
  `turbo.json`. Also 84 root baseline hits, mostly `standards/cache-baseline/*.json`, plus
  `16-knowledge-stack.md:558,773` and ten `DECISIONS.md` lines. Soft refusal: the packet
  reference `goals/boolean-creep/data/design-refresh-2026-09-09-main-52fcc8d-impact.md`.

Two exit-gate consequences:

- `rg -l "@beep/schema-org" packages apps` stays non-empty until `WholeToken.ts` and the
  delete-package test fixtures stop using the literal. They are not consumers, but the gate is
  lexical (D9).
- `rg -l '@beep/nlp["/]' packages apps standards tsconfig.json` today hits
  `nlp-processing/src/internal/observability.ts:16` (`package: "@beep/nlp"`). P6 row 6 renames it
  to `@beep/nlp-processing` (P6 design `:864`). The other hits are the package itself,
  `identity/src/packages.ts:804`, `identity/test/shape-stable.test.ts:161`, the two cli tables, the
  cli test, `tsconfig.json:76,144-153`, and generated standards files, which the delete-package
  rebuilds remove. Backticked prose (`` `@beep/nlp` ``) does not match the gate, but delete-package
  refuses it, so P7 rewrites it either way.

### 3.6 The CI binary closure and the runner-Lambda closure

CI binary closure (manifest `scratchpad/closure2/closure.txt`, 352 files, entry
`packages/tooling/tool/cli/src/bin-ci.ts`):

- No file under `packages/foundation/modeling/nlp/` or `schema-org/` is in it.
- The deletion edits three closure files: `bun.lock` (`closure.txt:2`), the root `tsconfig.json`
  (`:352`, aliases `tsconfig.json:76,144-153,2059-2064`) and `identity/src/packages.ts` (`:104`,
  `$NlpId` and `$SchemaOrgId`). P7 is therefore closure source and takes one release and pin cycle
  at merge, as P6 does (P6 design `:990-993`). `Registry.data.ts` (`:100`) is untouched unless a
  term changes.
- `CiLanePartitions.ts`, `CoverageScope.ts`, `WholeToken.ts`, `turbo.json`,
  `tsconfig.packages.json` and `standards/policy-tools.fingerprint.json` are not in the closure.

Runner-Lambda handler closure: per-file, and source maps embed text. The reachable identity
sources are `Id.ts`, `Root.ts`, `Authority.ts`, `internal/Segment.ts` and
`internal/schemaStatics.ts`, plus the `@beep/schema`, `@beep/alchemy-github-runners` and
`@beep/infra-ci-runners` modules (decision
`goals/infra-alchemy-rebuild/decisions/2026-11-19-ci-runner-handler-identity-leaves.md`; guard
`packages/tooling/infra/ci-runners/test/HandlerBundles.test.ts`). The deletion edits none of
them; `identity/src/packages.ts` is outside the set by design (#3431). So no handler redeploys,
provided P7 edits nothing in `@beep/schema/src`.

### 3.7 `bun.lock`

Neither package has a third-party dependency of its own. `@beep/nlp` depends on
`@beep/identity`, `@beep/schema`, `@beep/utils`, `@beep/text` and `effect`; `@beep/schema-org` on
`@beep/identity`, `@beep/schema` and `effect`. Dev dependencies are workspace or catalog entries.
No manifest depends on either package (`rg -l '"@beep/nlp"|"@beep/schema-org"' --glob package.json`
finds only the two packages). The lockfile therefore loses the two workspace blocks
(`bun.lock:3098-3099`, `:3275-3276`) and the two package entries (`:5609`, `:5733`), and no
external package drops. Both delete-package plans run the `tsconfig-sync` and `lockfile`
rebuilds.

## 4. Exit mapping (doctrine and gates only)

| P7 exit (`PLAN.md:31`) | State at HEAD | P7 work |
| --- | --- | --- |
| chapter, rulings and glossary entries exist on `origin/main` | rulings, amendment and glossary entries: yes. Chapter: P3 state. | rewrite section 1.3 and the section 1.4 gaps; they land on `origin/main` with the stack |
| chapter-11 amendment merged before P2 and in force | yes (`dcf6b16a77d`, before `c660085fdaa`) | record expiry handling (D7) |
| THEORY narrative absorbed before the file is retired | section 14 covers six kept and four withdrawn claims; THEORY §5, §7 and the §9 handoff round-trip are not covered | add them to section 14, then delete with the package |
| vision document corrected | eleven issues (section 1.5) | rewrite; settle BeepGraph status |
| Kb `Selector` re-checked, decision file | keep is supported (section 2.3) | decision file plus chapter `:562-564` |
| lint schema-first | red: 7 P4 errors | fix in P4 by modeling, not `--write` |
| lint identity-registry | green | stays green after `$NlpId` and `$SchemaOrgId` removal |
| lint package-scripts | red: law-practice domain doctest (P5) | `--write` in P5 |
| no S31 inventory grew | one per-package growth: nlp-processing suppressions 2 to 3 (P6 row 4) | resolve in P6 or rule on type-test `@ts-expect-error` (D6) |
| `rg` gates empty | not yet: section 3.5 | edit or rewrite the lexical fixtures (D9) |

## 5. Open questions

- **D1.** Kb `Selector`: keep (stored v1 and v2 bytes outside the amendment, no identity, L1
  already validates) or ADAPT (decode to `@beep/text` `Selector` at read time, bytes frozen)?
  This map recommends keep, with ADAPT as the reversal. The P7 decision file should also say
  whether the `urn:beep:kb:` quads in place of `oa:` are accepted for repo tooling.
- **D2.** Who fixes the seven P4 schema-first errors, and where? The P4 layer is the owner. If P4
  has merged by the time P7 runs, P7 inherits them, and the repo rule is one fix on the lowest
  open layer. Confirm that the remedy is modeling (`S.Opaque` and schemas), never
  `lint schema-first --write`, which would grow the inventory.
- **D3.** THEORY §7 "backends as functors": withdraw it entirely, or keep "unsupported backend
  operations fail with typed `BackendNotSupported`" as a kept claim? Keeping it needs a
  ledger row and a test titled with its id (chapter section 13: a structural claim links its
  test). The same question applies to the §6.1 normalization-coherence law and the §9 handoff
  round-trip.
- **D4.** Vision scope: does "corrected" cover only `docs/PROSE_TO_PROOF_VISION.md`, as the SPEC
  gate names, or also the companion docs with the same posture (`docs/product/prose-to-proof.md`
  6 hits, `docs/BEEPGRAPH_ARCHITECTURE.md` 4, `docs/PROSE_TO_PROOF_ARCHITECTURE_MAP.md` 3,
  `README.md` 1, `docs/ROADMAP.md` 1)? Is `:86`'s description of the desktop app as "local-first"
  a statement about the app that may stay, or must the gate regex return nothing at all?
- **D5.** Vision `:51` "conflict-of-interest checks across matters": restate it as a query that
  needs an explicit cross-matter authority grant under chapter section 11, or drop it until a
  decision scopes such a grant?
- **D6.** S31 reference and counting rule. Confirm the base is the census base `f9982f3b5e6`.
  Every per-package count is equal at `dcf6b16a77d`. Confirm also that the rule is per package as
  the census defines it, not whole-file: whole-file effect-vitest and coverage totals grew from
  `main` and cannot be held to the P0 count. Does a type-level `@ts-expect-error` in a negative
  type test (`Operation.test.ts:133`) count as a suppression entry? If it does, P6 replaces it
  with a non-suppressing type assertion before P7 measures.
- **D7.** The scoped amendment "expires when the packet reaches `completed-retained`"
  (`DECISIONS.md:3195-3196`). Does P7 or P8 flip its status (for example "Expired" with the
  closeout PR), and should a P7 landing entry be added to `DECISIONS.md`? P2 and P3 each added
  one (`:3283`, `:3358`); P4 to P6 added none. A landing entry would record L3 to L7 landing and
  both retirements, in the same form as the slice-retirement step 5 of chapter 11
  (`11-evolution-and-deprecation.md:15`), and would mark the nlp split ruling (`:2935`) executed.
- **D8.** The delete-package plans differ. The schema-org plan rebuilds `coverage-baseline`,
  `fallow-health-baseline`, `fallow-dead-code-baseline` and `test-typecheck-baseline`. The nlp
  plan has none of the four, although nlp still has 5 coverage-baseline rows at HEAD. Neither
  plan models `_typos.toml` (`:14,120`, the schema-org exclude). Is the nlp gap a delete-package
  geometry defect, perhaps because the probe keys on the package's current rows, to fix in its
  own small PR before P7? Or does P7 re-run the coverage writer for the removed rows by hand and
  edit `_typos.toml` in the same PR?
- **D9.** The lexical gate `rg -l "@beep/schema-org" packages apps` hits non-consumer fixtures in
  repo tooling (`WholeToken.ts:9,54,64`, `delete-package.test.ts:1297-1354`,
  `fixtures/dependency-review/manifest-inventory.json:698`). Should they be rewritten to a
  neutral look-alike (for example `@beep/schema-extra`), or should the decision file record
  them as allowed hits? A rewrite changes `@beep/repo-cli-kit`, which needs package-verify and
  JSDoc docgen, but neither file is in a closure.
- **D10.** The BeepGraph status line: the vision says "settled", `docs/BEEPGRAPH_ARCHITECTURE.md:4`
  says "Proposed", and the memory-architecture log narrows it to provenance and verification.
  Should P7 state "Proposed; the knowledge stack is chapter 16" in the vision, or also update
  `BEEPGRAPH_ARCHITECTURE.md`'s status?
