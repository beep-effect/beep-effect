# Mine: schema-first synthetic corpus generation

**Date:** 2026-08-08
**Agent:** mine-synthetic-corpus (Opus 5)
**Lens:** port Harvey's withheld spec→feature→render pipeline to Effect Schema; land it
on OIP-shaped (patent-prosecution) synthetic corpora with computed ground truths.

**Sources read in full:** all five map reports in this directory
(`map-corpus`, `map-pipeline-docs`, `map-task-census`, `map-evaluation`,
`map-harness`), plus `CAPTURE.md` and the scraped X post. **No file under
`tasks/firm-knowledge/dms/` was opened by this agent** — every corpus claim below
is cited to `map-corpus.md`, which did the sampling under its own budget.

**In-repo claims** are verified against the live checkout at
`/home/elpresidank/YeeBois/projects/beep-effect13` (branch `main`, `6b42b239a6`).
Paths are repo-relative; harvey-labs paths are clone-relative and prefixed `[LAB]`.
Reproduction commands are in §8.

---

## 0. Recommendation

**Build the half Harvey deleted.** They shipped rendered `.docx` and prose rubrics;
the valuable artifact is the layer that was explicitly stripped before publication —
a typed matter spec whose *features are pinned to documents*, from which both the
documents **and** the grading rubric are derived
(`map-pipeline-docs.md` §1.2: commit `55510f0e6` removed `_source_id` and `_family`).

In beep terms that is **one schema kernel plus one missing process driver**:

1. **`MatterSpec` / `Feature` / `FeaturePin` / `MatterPlan` schemas** — NET-NEW,
   but composing almost entirely from existing bricks: `LiteralKit`,
   `S.Class`/`$I`, `S.toArbitrary`, and the *already-modeled* patent-prosecution
   vocabulary in `packages/law-practice/domain/src/entities/`
   (`OfficeAction`, `Rejection`, `Claim`, `PriorArtReference`, `IdsSubmissionFact`,
   `PatentAsset`, `Matter`, `LegalClient`).
2. **`@beep/pandoc` process driver** — the one missing leg of the render chain.
   `Md.Document → PandocDocument → Pandoc JSON` is already built and tested
   (`packages/foundation/modeling/pandoc-ast/src/Pandoc.mapping.ts:1271`,
   `Pandoc.codec.ts:1595`); nothing in the repo shells out to `pandoc`, so
   `Pandoc JSON → .docx` is the gap. Driver precedent exists twice over
   (`packages/drivers/tika/src/Tika.tikaapp.ts`,
   `packages/drivers/libpff/src/Libpff.pffexport.ts`).

Everything else in this report — rubric derivation, the `beep corpus synth`
operator surface, the extraction round-trip proof, the shadow-corpus statistics
mirror — falls out of those two.

**Why it is worth doing at all.** Pre-publication patent material can never reach a
cloud model (standing global rule; `~/.claude/rules/oip-confidentiality.md`). That
constraint means beep currently **cannot measure its own retrieval / KG / ingestion
quality on the one domain it exists to serve.** There is no graded eval for OIP work
and there cannot be one from real matters. A generated patent-prosecution corpus
with *computed* ground truth is the only path to a graded eval that is also
committable, publishable, and shareable with reviewers. Harvey proved the shape is
achievable at 266 matters / 9,288 files and that the output survives a partner-grade
read (`map-corpus.md` §5.1). They also proved which parts break (§5.2) — and every
one of those defects is preventable at the schema level (§4.3 below).

**Build order** is *O2 → O1 → O3 → O5 → O4* (the driver unblocks the kernel's proof),
even though the value ranking in §5 is *O1 > O2 > O3 > O5 > O4*.

---

## 1. The pattern, reconstructed

### 1.1 Six stages, one of which ships

`map-corpus.md` §6 reverse-engineered the pipeline from renderer fingerprints;
`map-pipeline-docs.md` §1.1 confirmed the negative space from the repo side.

| # | Stage | Output | Ships? | Fingerprint in the corpus |
|---|---|---|---|---|
| 1 | Matter **spec** (~1,000 tokens) | client, practice, parties, dates, **feature list** | **No** | cross-document numeric consistency ($4.2M budget in both an email and a billing xlsx) |
| 2 | **Folder plan** | free-text band labels | No | 559 distinct labels over ~1,900 instances; 8 matters where this stage produced nothing |
| 3 | **File plan** | slug + doctype + **assigned features** | No | 100% kebab filenames; per-patent fan-out (`…-{234,567,678,890}-patent.docx`) |
| 4 | **Content generation** | Markdown + directive dialect | No | leaked `<!-- indent:2 -->` in 6.4% of sampled docx |
| 5 | **Format render** | python-docx / openpyxl / python-pptx | No | `docProps/core.xml` → `<dc:creator>python-docx</dc:creator>` |
| 6 | **Filesystem write** | `matter/<label>/<slug>.<ext>` | **Yes (only this)** | path-injection: `FTC/DOJ Correspondence` became two directories |

### 1.2 The three properties that are the actual invention

**(a) Ground truth is computed, never read back.** The blog states it directly:
"tasks … are enumerated against the short-form specifications, with ground truths
computed as matters or documents containing a particular mix of features"
(X post §Environment and Task Definition). A ~1,000-token spec carries the answer
key for every question anyone will ever ask about that matter. Grading never
re-reads the 100M-token corpus.

**(b) Features are pinned at three granularities.** `map-corpus.md` §4 verified all
three end-to-end:

- *matter-level* — `[LAB] tasks/firm-knowledge/tasks/006/task.json` C-001:
  "Includes … matter 1001-00001 as a qualifying Antitrust & Competition matter in
  which an HSR notification was actually filed."
- *file-level* — `tasks/087` C-011: names
  `complaint-patent-infringement.docx` as *the source* alleging willfulness.
- *value-level* — `tasks/076` C-002: "reasonable-royalty estimate of **7.5%** …
  which is above 5%"; `tasks/092` C-002: "a **12-month** non-compete".

The value-level pins land in different *media*: the willfulness feature is a clause
in a 45,298-character pleading; the 12-month non-compete is a **spreadsheet cell**
in a per-provision comparison grid (`map-corpus.md` §4). Feature expression is a
first-class axis, not an afterthought.

**(c) Some features are topological.** The most under-appreciated finding in
`map-corpus.md` (§2.2): "IPO withdrawn" is expressed as a `Withdrawal/` folder that
**exists**, not as a sentence anywhere in the S-1 chain; "matter still open" is an
**absent** closing band (63 of 266 matters have no outcome band). Harvey's generator
produced this accidentally, as a side effect of the folder plan. A schema-first port
should *declare* it — see `FeatureExpression` in §4.2.

### 1.3 The multiplier

`map-task-census.md` §3 found systematic triads: for most features there is an
*enumeration* task, a *count* task, and a *most-recent* task over the same predicate
(006/007/008, 021/022/023, 152/153/154, 242/243/244, …), at median 11 / 7 / 4
criteria. **One ground-truth set yields three tasks at three difficulty tiers at
near-zero marginal authoring cost.** That is the economics of the whole approach: the
expensive artifact is the spec; tasks are free.

The corollary is the census's sharpest number: at the announced ~50% per-criterion
pass rate, expected all-pass across 250 tasks is **10.19** — because all-pass is
`p^n` (§2 of the census). Difficulty is a *dial on `n`*, and if you own the generator
you own the dial.

---

## 2. Why this is the OIP-shaped opportunity, specifically

Three facts stack:

1. **The confidentiality wall is absolute and permanent.** Corpus home
   `/home/elpresidank/data-home/oppold-corpus/` is confidential by default; a scoped
   waiver for a cognee demo (2026-07-03, 3–5 docket families) explicitly does not
   generalize. There will never be a real-corpus cloud eval.
2. **beep already owns the prosecution feature vocabulary as schema.** Not "could
   model" — *has modeled*. `packages/law-practice/domain/src/entities/` contains
   `Matter`, `LegalClient`, `LegalContact`, `PatentAsset`, `OfficeAction`,
   `Rejection`, `Claim`, `PriorArtReference`, `IdsSubmissionFact`,
   `PatentCitationEvent`, `CandorDisposition`, `Distinction`; the values directory
   adds `ApplicationNumber`, `PatentNumber`, `KindCode`, `PatentMetadata`,
   `DocketCitation`, `PatentDocumentTriplet`, `CitingApplicationIdentity`.
   `Matter.model.ts:48` already carries a `fixtureKey` field as a *first-class
   persisted column* — the domain was designed fixture-first.
3. **C&H does not cover prosecution.** Its closest matter is `1014-00003`, patent
   *litigation* — complaint, Markman, damages expert, settlement
   (`map-corpus.md` §2.2). There are no office actions, no IDS filings, no docket
   families, no shortened statutory periods, no terminal disclaimers. The X post
   concedes "the current version of C&H covers only part of the work performed by a
   law firm". **Prosecution is the uncovered part and it is exactly OIP's practice.**

So the port is not imitation — it is filling a hole in the open dataset with the one
practice area beep is already schema-complete for.

Secondary payoff, worth naming because it is larger than the eval: the same
generator produces **shareable demo corpora, onboarding fixtures, and regression
inputs for `beep corpus` / `@beep/file-processing` / the practice KG** that today
either do not exist or are drawn from privileged material and therefore cannot be
committed, screenshotted, or shown to a reviewer.

---

## 3. Capability inventory (verified against the live checkout)

| Capability needed | Verdict | Evidence |
|---|---|---|
| String-literal domains (bands, doc types, feature kinds, task shapes) | **reuse** | `packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts:747` |
| Tagged unions from a literal domain (the `Feature` union) | **reuse** | `LiteralKit([...]).toTaggedUnion("kind")({...})` — live use at `packages/epistemic/use-cases/src/ContradictionTriage/ContradictionTriage.rpc.ts:73` and `…/ContradictionTriage.commands.ts:376` |
| Structured ids (`1001-00001`) | **reuse** | `S.TemplateLiteral` — live use at `packages/tooling/tool/cli/src/commands/Qa/Inventory.schemas.ts:186` |
| Persisted domain models with identity composers | **reuse** | `packages/foundation/modeling/schema/src/DomainModel.ts:65`, `…/EntitySchema`, `BaseEntity.Class` (`packages/law-practice/domain/src/entities/Matter/Matter.model.ts:48`) |
| Patent-prosecution entity vocabulary | **reuse** | `packages/law-practice/domain/src/entities/{OfficeAction,Rejection,Claim,PriorArtReference,IdsSubmissionFact,PatentAsset,Matter,LegalClient}` |
| Schema-derived generation (arbitraries) | **reuse** | `S.toArbitrary` + `toArbitrary` annotations on constrained leaves across `packages/foundation/modeling/schema/src/` (≈30 files, e.g. `Cuid.ts:69`, `KebabStr.ts:36`, `FileName.ts:122`, `Glob/Glob.schema.ts:115`); helper `packages/tooling/test-kit/test-utils/src/Schema.ts` (`assertSchemaArbitraryDecodesToSelf`) |
| Seeded determinism | **reuse** | `Random.withSeed` — `.repos/effect/packages/effect/src/Random.ts:290` |
| Markdown AST + render | **reuse** | `@beep/md` — `packages/foundation/modeling/md/src/{Md.model.ts,Md.render.ts,Md.escape.ts,Md.safe.ts}` |
| Md → Pandoc AST → Pandoc JSON | **reuse** | `packages/foundation/modeling/pandoc-ast/src/Pandoc.mapping.ts:1271` (`documentToPandoc`), `Pandoc.codec.ts:1595` (`encodePandocJsonString`) |
| **Pandoc JSON → `.docx`** | **NET-NEW** | zero `pandoc` binary invocations repo-wide (§8); `@beep/pandoc-ast` README states explicitly "does not shell out to `pandoc`, manage DOCX files" |
| Process-driver pattern for a binary | **reuse (as template)** | `packages/drivers/tika/src/Tika.tikaapp.ts`, `packages/drivers/libpff/src/Libpff.pffexport.ts`, `packages/drivers/exiftool/`, `packages/drivers/ffmpeg/` |
| `.xlsx` / `.pptx` authoring | **NET-NEW** | only *read* paths exist (`packages/drivers/doc-text/src/DocText.service.ts`, `packages/drivers/tika/src/Tika.service.ts`, `packages/foundation/capability/file-processing/src/Extraction/`) |
| Tracked changes (`w:ins`/`w:del`) authoring | **NET-NEW, hard** | pandoc's docx *writer* cannot author revision marks; see §4.5 |
| Deterministic fixture-seed service pattern | **reuse (as template)** | `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.fixtures.ts` (753 lines) + `…fixture-service.ts` (280) — schema-classed seed inputs → deterministic scenario output |
| Corpus operator CLI | **extend** | `packages/tooling/tool/cli/src/commands/Corpus/` already ships `catalog`, `extract`, `enrich`, `organize`, `salvage`, `archive-move`, `recycle-bin` |
| Document ingest / extraction (for the round-trip proof) | **reuse** | `packages/foundation/capability/file-processing/src/{Extraction,Artifact,Operation,Service}/`, `packages/drivers/{doc-text,tika}` |
| Span-verified structured extraction (feature recovery) | **reuse** | `packages/foundation/capability/langextract/src/{Extraction,Alignment,VerifiedSpan,Target}` |
| LLM content authoring | **reuse** | `packages/drivers/{anthropic,openai-compat,venice-ai,xai}`; `goals/unified-ai-toolchain` |
| Rubric / criterion / judge modeling | **extend** | `packages/tooling/tool/cli/src/commands/Qa/Inventory.schemas.ts` (`QaFinding`, `QaInventory`, `QaEvidenceRef`, severity/lens LiteralKits) is the nearest existing shape; `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.rubric.ts` is a second precedent |
| Prior synthetic **legal corpus** generator | **NET-NEW** | none — no `packages/**/src` module generates document corpora (§8) |

**Net:** the schema kernel is ~90% composition of existing bricks. The genuinely new
code is (a) one process driver, (b) one feature/spec/plan schema family, (c) the
rubric derivation encode. `.xlsx` authoring and tracked-change authoring are real
NET-NEW work and should be **deferred out of v1**.

---

## 4. The port, at fat-marker fidelity

Design order is the standing law: **schema → `Context.Service` contract →
implementation.** What follows is stage 1 only, deliberately.

### 4.1 Naming and placement

Not decided here — slice placement is an architecture decision. The natural
candidates are a `packages/law-practice/…` sub-slice (the vocabulary lives there) or
a `packages/tooling/…` fixture-generation library (the consumer is evals and CLI).
`bun run beep create-package` / `bun run beep architecture` own the scaffold.

### 4.2 Schema kernel

```ts
const $I = $SynthCorpusDomainId.create("values/MatterSpec/MatterSpec.model");

// ── identity ────────────────────────────────────────────────────────────────
// check idiom verified against packages/tooling/tool/cli/src/commands/Qa/Inventory.schemas.ts:159
export const ClientSeq  = S.String.check(S.isPattern(/^1[0-9]{3}$/,  { identifier: $I`ClientSeqCheck`, /* … */ }));
export const MatterSeq  = S.String.check(S.isPattern(/^[0-9]{5}$/,   { identifier: $I`MatterSeqCheck`, /* … */ }));
export const MatterId   = S.TemplateLiteral([ClientSeq, "-", MatterSeq]).pipe(
  S.brand("MatterId"),                                              // "1001-00001"
);

// ── controlled vocabularies (the antidote to 559 free-text folder labels) ───
export const PracticeArea  = LiteralKit(["patent_prosecution", "patent_litigation",
  "trademark", "opinions", "licensing", "portfolio_management"]).pipe(/* annote */);

export const MatterBand    = LiteralKit(["intake", "substance", "communication",
  "outcome"]).pipe(/* annote */);

export const MatterLifecycle = LiteralKit(["prospective", "active",
  "closed_completed", "closed_terminated"]).pipe(/* annote */);

export const DocumentType  = LiteralKit(["engagement_letter", "conflicts_memo",
  "invention_disclosure", "application_as_filed", "office_action",
  "response_to_office_action", "claim_amendment", "ids_form_sb08",
  "terminal_disclaimer", "notice_of_allowance", "issue_fee_transmittal",
  "abandonment_notice", "docket_report", "client_status_letter",
  "matter_closing_memo"]).pipe(/* annote */);

export const DocumentVersion = LiteralKit(["none", "draft", "redline",
  "execution", "final", "amended"]).pipe(/* annote */);

// FolderLabel is a *branded* label, not a free string: the brand is what makes
// [LAB] `FTC/DOJ Correspondence` -> two directories unrepresentable.
export const FolderLabel = S.String.check(
  S.isMinLength(1),
  S.isPattern(/^[^/\\]+$/, { identifier: $I`FolderLabelNoSeparator`, /* … */ }),
).pipe(S.brand("FolderLabel"));

export const DocumentSlug = KebabStr;   // packages/foundation/modeling/schema/src/KebabStr.ts
```

The `Feature` union uses the repo's own idiom (`LiteralKit(...).toTaggedUnion`), so
the feature *kind* domain and the union stay in lockstep by construction:

```ts
const FeatureBase = LiteralKit([
  "officeActionFinal",
  "shortenedStatutoryPeriod",
  "rejection102",
  "rejection103",
  "restrictionRequirement",
  "terminalDisclaimerFiled",
  "idsFiledAfterAllowance",
  "claimAmendedInResponse",
  "continuationFiled",
  "appealNoticed",
  "abandonedForFailureToRespond",
  "thirdPartyPriorArtCited",
]).toTaggedUnion("kind")({
  officeActionFinal:          { mailedOn: DateTimeUtcFromValid },
  shortenedStatutoryPeriod:   { months: PositiveInt },
  rejection103:               { primaryReference: PatentNumber,
                                secondaryReferences: S.Array(PatentNumber) },
  idsFiledAfterAllowance:     { referenceCount: PositiveInt,
                                feeCode: IdsFeeCode },
  claimAmendedInResponse:     { claimNumbers: S.Array(PositiveInt) },
  // … one member per kind; a missing member is a compile error
});
```

Pinning — the piece Harvey stripped — is where the map reports pay off:

```ts
export const FeatureGranularity = LiteralKit(["matter", "document", "value"]);

// The media in which a feature is *expressed*. `folderPresence` / `folderAbsence`
// are the schema form of map-corpus §2.2's topological features: "IPO withdrawn"
// is a folder that exists; "still open" is an outcome band that does not.
export const FeatureExpression = LiteralKit([
  "prose", "tableCell", "trackedChange", "folderPresence", "folderAbsence",
  "filenameToken", "emailHeader",
]);

export class FeaturePin extends S.Class<FeaturePin>($I`FeaturePin`)({
  feature:        Feature,
  granularity:    FeatureGranularity,
  expression:     FeatureExpression,
  primary:        S.optional(DocumentSlug),          // required unless matter-level
  corroborations: S.Array(DocumentSlug),             // §4 of map-corpus: features are
                                                     // redundant across the band
}, $I.annote("FeaturePin", { description: "…" })) {}
```

And the spec itself — the ~1,000-token object that carries the answer key:

```ts
export class MatterSpec extends S.Class<MatterSpec>($I`MatterSpec`)({
  matterId:     MatterId,
  clientRef:    LegalClientFixtureKey,               // joins packages/law-practice/domain
  practiceArea: PracticeArea,
  lifecycle:    MatterLifecycle,
  openedOn:     DateTimeUtcFromValid,
  closedOn:     S.optional(DateTimeUtcFromValid),
  docketFamily: S.optional(DocketFamilyRef),         // parent / continuation / divisional
  features:     S.NonEmptyArray(FeaturePin),
  seed:         RenderSeed,
}, $I.annote("MatterSpec", { description: "…" })) {}
```

Stages 2 and 3 stop being implicit and become a decodable artifact:

```ts
export class DocumentPlan extends S.Class<DocumentPlan>($I`DocumentPlan`)({
  slug:    DocumentSlug,
  band:    MatterBand,
  folder:  FolderLabel,
  docType: DocumentType,
  version: DocumentVersion,
  pins:    S.Array(FeatureId),
}, /* … */) {}

export class MatterPlan extends S.Class<MatterPlan>($I`MatterPlan`)({
  spec:      MatterSpec,
  folders:   S.NonEmptyArray(FolderLabel),           // NonEmpty kills the `documents/` fallback
  documents: S.NonEmptyArray(DocumentPlan),
}, /* … */) {}
```

`HashSet`/`HashMap` (never native `Set`/`Map`) for feature sets and boundary sets;
`packages/foundation/modeling/schema/src/MutableHashSet.ts` / `MutableHashMap.ts`
already ship schemas with `toArbitrary` annotations if the set needs to be part of a
codec.

### 4.3 Fix-on-the-way-in

Every defect `map-corpus.md` §5.2 observed maps to a schema construct that makes it
unrepresentable. This table is the argument for doing the port at all rather than
just consuming C&H.

| C&H defect (map-corpus §5.2 / §6) | Rate | Schema construct that kills it |
|---|---|---|
| Leaked `<!-- indent:2 -->` / `<!-- center -->` directives in body text | 15/235 sampled docx (6.4%) | There is no directive dialect. Content is `Md.Document`; formatting is AST structure. If a directive vocabulary is ever needed, `LiteralKit` + a total `Match` makes a missing handler a **compile error**, not a 6.4% leak. |
| `FTC/DOJ Correspondence` → two directories (path injection) | ~12 folders | `FolderLabel` brand rejects `/` and `\` at decode |
| 8 matters with no taxonomy at all (`documents/` fallback) | 8/266 (3.0%) | `MatterPlan.folders: NonEmptyArray` — a plan that produced nothing **fails decode** instead of silently degrading |
| Empty `.eml` `Date:` / `Subject:` | 4 of 7 sampled emails | required `Instant` + required subject on the correspondence artifact schema |
| Firm-fact drift (two different SF addresses for one firm) | 2 of 6 sampled matters | a `FirmRegistry` service provided **once per corpus render**, not re-derived per matter |
| Identity drift (`alan.ngo@` vs `ango@` in one matter) | 1 of 6 | `Person` entity with one canonical email; render reads the registry, never invents |
| Unexpanded `TOC \o "1-2" \h \z \u` field text | 81/235 sampled docx (34.5%) | pandoc owns OOXML; no hand-built field codes |
| Stock names uncanonicalised (`conflict-check-memo` 47 / `-memorandum` 38 / `conflicts-check-memorandum` 9) | corpus-wide | `DocumentType → canonical slug` mapping; deliberate variation becomes an explicit, *dial-able* `SlugVariance` policy |
| 100% clean lowercase-kebab filenames — "the benchmark is easier than reality on exactly the axis the paper says agents rely on" (§5.2) | 9,288/9,288 | same dial, turned the other way: a `FilenameRealism` policy (`clean` \| `noisy` \| `hashed`) makes `map-corpus.md` §7.1's filename-ablation experiment a **render flag** instead of a post-hoc rewrite |

That last row is the strongest single argument for owning the generator. Harvey's
corpus hands agents a uniform, semantically-loaded filename channel no production DMS
has. If we generate, filename realism is a parameter and the ablation is free.

### 4.4 Determinism

- **Structure** from `Random.withSeed` (`.repos/effect/packages/effect/src/Random.ts:290`)
  over `MatterSpec.seed`, plus `S.toArbitrary` for structured filler.
- **Prose** is the one non-deterministic stage (an LLM writes it). Make it
  reproducible by *content-addressing the cache*: key generated prose on
  `(specHash, documentSlug, promptVersion, model)`. After the first render, a
  re-render is byte-identical and cheap; a prompt-version bump is a visible,
  reviewable diff.
- **Consequence:** the corpus becomes committable as a fixture and *diffable in
  review*. C&H is not reproducible from anything in its repo — the specs are gone.
  Ours would be regenerable from ~1,000 tokens per matter, which is also the answer
  to "do we really want 500 MB of binaries in git" (we do not; we want the specs in
  git and the render in CI or a cache).

The idiom already exists in-repo: `ProfessionalRuntime.fixtures.ts` is a
schema-classed deterministic seed → scenario expander (753 lines, no randomness at
all). This is the same shape with a render stage bolted on.

### 4.5 Render chain

```
MatterSpec
   └─ derive ─▶ MatterPlan                       (pure, schema-to-schema)
                   └─ author ─▶ Md.Document      (per document; LLM or template)
                                   ├─ documentToPandoc      pandoc-ast/Pandoc.mapping.ts:1271
                                   ├─ encodePandocJsonString pandoc-ast/Pandoc.codec.ts:1595
                                   └─ pandoc -f json -o <slug>.docx   ◀── NET-NEW driver
```

Notes that matter:

- **Harvey's own skill manual endorses this route.** `[LAB] harness/skills/docx/SKILL.md:33`
  (via `map-harness.md` §6): "When unsure, prefer the markdown + reference-doc path —
  Pandoc handles the OOXML correctness so you don't have to." They then rendered with
  python-docx and leaked directives at 6.4%. Taking their advice instead of their code
  is the whole trick.
- **`.eml` is nearly free** — plain text (`map-harness.md` §5), so it is a text render
  with a required header schema. Do it in v1; it is where temporal reasoning lives.
- **`.xlsx` is v2.** Keep C&H's convention when we get there — sheet 1 a
  `Field | Value` cover block, sheet 2+ the grid (`map-corpus.md` §5.1). It is a
  generator convention, but a plausible one, and it makes the file trivially
  parseable by our own extraction stack.
- **Tracked changes are the hard gap.** 169 C&H files carry real `w:ins`/`w:del`, and
  negotiation deltas are recoverable *only* by a tracked-changes-aware reader
  (`map-corpus.md` §5.1, §7.3). Pandoc's docx **writer** cannot author revision marks
  (it can only *read* them via `--track-changes`). And in prosecution, **claim
  amendments are literally redlines** — so this gap sits directly on the OIP use case.
  Name it, defer it, and plan for direct OOXML manipulation
  (`unpack → mutate XML → repack → validate`, the triple `map-pipeline-docs.md` §5.5
  flags as reusable) in a later slice.

### 4.6 Rubric derivation — ground truth as an encode, not an authoring task

This is the payoff and the part Harvey could not ship because the feature layer was
stripped. `_family` (`map-pipeline-docs.md` §1.2) is a *set-valued query over
features*:

```ts
export const FeaturePredicate = LiteralKit([
  "hasFeature", "featureValueAtLeast", "featureValueAtMost",
  "allOf", "anyOf", "not",
]).toTaggedUnion("op")({
  hasFeature:          { kind: FeatureKind },
  featureValueAtLeast: { kind: FeatureKind, field: S.String, value: S.Number },
  allOf:               { operands: S.Array(S.suspend((): S.Codec<FeaturePredicate,
                                    FeaturePredicate.Encoded> => FeaturePredicate)) },
  // … anyOf / not likewise recursive via S.suspend
});

export class TaskFamily extends S.Class<TaskFamily>($I`TaskFamily`)({
  familyId:  TaskFamilyId,
  predicate: FeaturePredicate,
  shapes:    S.NonEmptyArray(TaskShape),   // enumeration | count | superlative | …
  boundary:  BoundaryPolicy,
}, /* … */) {}

// The `ACCEPTABLE EITHER WAY` construct as DATA, not prose.
export class BoundaryPolicy extends S.Class<BoundaryPolicy>($I`BoundaryPolicy`)({
  required:             MatterIdSet,        // see note below
  acceptableEitherWay:  MatterIdSet,
  justification:        NonEmptyString,
}, /* … */) {}
```

> **API note (verified, not assumed).** `@beep/schema` ships `MutableHashSet` and
> `MutableHashMap` codecs (`packages/foundation/modeling/schema/src/MutableHashSet.ts`,
> `MutableHashMap.ts`, both exported from the barrel at `index.ts:320,325`) but **no
> immutable `HashSet` codec**, and effect v4 core has `HashSet` only as a data module,
> not a schema. So `MatterIdSet` is either `MutableHashSet(MatterId)` today or a small
> NET-NEW immutable `HashSet` codec modelled on the existing `MutableHashSet.ts`
> (which already carries a `toArbitrary` annotation at `:196`). Native `Set`/`Map` are
> banned by standing rule either way.

Then **rubric generation is `S.encode`**, not authoring. Evaluating `predicate`
against the spec set yields `required`; the *ambiguous* members — those whose
membership flips under a declared alternative reading — populate
`acceptableEitherWay` automatically. `map-task-census.md` §8.2 already recommends
modelling the boundary as a schema field rather than judge prose; the addition here
is that **if you own the generator, you do not author the boundary at all — it is a
by-product of the predicate evaluation.**

The three criterion archetypes the census found (§5.1) are three encoders over one
ground-truth set:

| Archetype | Census evidence | Encoder |
|---|---|---|
| qualifying-member (identity **+ reason**) | 792 criteria across 154 tasks open `Identifies …`; the `because <evidence>` tail defeats guessing | one criterion per `required` member, reason = the pinned feature rendered to prose |
| cardinality (with upward tolerance) | 183 criteria open `States that`; "equally acceptable" in 28 | `|required|`, tolerance = `|required ∪ acceptableEitherWay|` |
| **precision / closure** | 175 criteria; exactly one per task in 140 tasks; ~70% of tasks carry some closure test | `not(required ∪ acceptableEitherWay)` — the stopping test |

The precision criterion is the one genuinely novel rubric idea in the whole dataset
(`map-evaluation.md` §13.2: without it, all-pass rewards shotgunning). Derive it
mechanically and it can never be forgotten.

Plus the free multiplier from §1.3: **one `TaskFamily` → three tasks at three
difficulty tiers**, and `p^n` becomes a knob you can *target* rather than discover.

Two conventions worth copying verbatim while we are here:

- **Criterion ids are permanent keys, not array indices.** Six C&H tasks have
  non-contiguous ids because criteria were deleted without renumbering
  (`map-task-census.md` §5.4). Encode that: derived criterion ids must be stable
  across a spec revision that removes a feature.
- **Pick one grammatical voice.** C&H mixes `Identifies …` (792) with
  `The answer identifies …` (443); a judge prompt that concatenates both is being
  asked to normalize grammar as well as evaluate (`map-task-census.md` §5.1b). If the
  prose is generated, the voice is a template constant.

---

## 5. Ranked opportunities

Ranked by (leverage × certainty) / appetite. Build order differs — see §0.

### O1 — `MatterSpec` / `Feature` / `MatterPlan` schema kernel with derived rubrics

**What.** The withheld layer, schema-first: typed spec → feature pins → plan →
derived `TaskFamily` → derived rubric. Ships as schemas + a `Context.Service` that
derives a plan and a rubric from a spec set. **No rendering yet.**

**Why #1.** It is the artifact that makes every downstream thing cheap, it is 90%
composition of bricks we own (§3), and it is the only piece nobody can buy or clone —
Harvey deliberately deleted theirs. It also produces value *before* any document
exists: a spec set plus derived rubrics is already a testable answer key for
KG/retrieval work against any corpus we later render.

**Capability cites.** `LiteralKit.schema.ts:747`; `ContradictionTriage.rpc.ts:73`
(`toTaggedUnion` idiom); `Inventory.schemas.ts:186` (`S.TemplateLiteral`);
`packages/law-practice/domain/src/entities/*` (feature vocabulary);
`ProfessionalRuntime.fixtures.ts` (deterministic seed-expander precedent);
`Random.ts:290`.

**Appetite.** 2–3 weeks. **First proof:** 3 patent-prosecution `MatterSpec`s →
3 `MatterPlan`s → 4 `TaskFamily`s → 12 derived tasks whose criteria round-trip
through `S.encode`/`S.decode` and whose precision criterion is provably the complement
of `required ∪ acceptableEitherWay`.
**Kill criterion.** If the derived rubric for a hand-checked family disagrees with
what an IP attorney would grade, the feature vocabulary is wrong and the whole
approach needs re-grounding before any rendering spend.

### O2 — `@beep/pandoc` process driver (the missing render leg)

**What.** A thin `Context.Service` wrapping the `pandoc` binary: `PandocDocument →
.docx` (and `.docx → PandocDocument` for the round-trip, which we currently also
lack).

**Why #2 by value, #1 by build order.** It is the smallest, most certain piece of
work in this report, it unblocks O1's proof, and its value **exceeds** synthetic
corpora: `explorations/full-document-editor`, `goals/rich-text-foundation`,
`goals/pandoc-ast-foundation`, and `apps/oip-web` all want docx export, and
`@beep/pandoc-ast` was built for exactly this and then stopped one step short by
design ("does not shell out to `pandoc`").

**Capability cites.** `Pandoc.mapping.ts:1271`, `Pandoc.codec.ts:1595` (upstream half
done). Driver template: `packages/drivers/tika/src/Tika.tikaapp.ts`,
`packages/drivers/libpff/src/Libpff.pffexport.ts`. **NET-NEW:** the binary bridge —
verified absent (§8).

**Appetite.** 3–5 days. **First proof:** `Md.Document → .docx → @beep/doc-text →
text` recovers the paragraph structure, and a golden `.docx` is byte-stable across
runs on a pinned pandoc version.
**Kill criterion.** If pandoc's docx writer loses `@beep/md`'s typed extensions
(footnotes, admonitions, embeds, math) badly enough that documents stop reading like
work product, the render route must change before O1 renders anything.

### O3 — Closed-loop proof: render → extract → recover the pins

**What.** A property test, not a feature: for every rendered matter, run beep's own
ingest stack over the output and assert that every `FeaturePin` is recoverable at its
declared `FeatureExpression`, at the declared document, with a verified span.

**Why.** This is the thing Harvey never built, and its absence is visible in their
output: `map-corpus.md` §4 found a criterion (`tasks/092` C-003) requiring "all
executed versions of the driver ICOA" when a corpus-wide filename search returns
exactly one file — the executed ICOAs exist only as *described rows*. A
rubric/corpus desync shipped because nothing checked. With the loop closed, a spec
that promises a feature the renderer did not express **fails the build**.

It also doubles as the honest eval floor: if our own extraction cannot recover a
feature we deliberately planted, no retrieval agent is going to.

**Capability cites.** `packages/foundation/capability/langextract/src/{VerifiedSpan,Alignment,Extraction}`;
`packages/foundation/capability/file-processing/src/Extraction/`;
`packages/drivers/doc-text/src/DocText.service.ts`;
`packages/tooling/test-kit/test-utils/src/Schema.ts` (property-test idiom);
`packages/tooling/test-kit/fc-runs` (run-count floor law).

**Appetite.** 1 week after O1+O2. **First proof:** 100% pin recovery on the 3-matter
seed set, with a deliberate negative (a pin pointing at a document that does not
express it) failing loudly.

### O5 — Shadow-corpus: mirror the *statistics* of the real OIP corpus, never its content

**What.** Parameterize the generator from aggregate shape statistics of the real
Oppold corpus — file-type mix, matter size distribution, band frequencies, docket
family fan-out, temporal density — so the synthetic corpus stresses beep's ingest and
retrieval stack at the shape it will actually meet, while **no privileged content
ever crosses the boundary**.

**Why.** `goals/oppold-corpus-pipeline` already produced the substrate: 8,438 files
salvaged, 7,330 distinct digests, a DuckDB catalog, `@beep/file-processing` manifests
(completed-retained, 2026-06-11). Extracting histograms from a catalog is cheap. And
it converts a permanent liability (we can never test on the real thing) into a design
input.

**The boundary is a hard rule, not a guideline.** Only aggregate distributions cross;
no per-matter detail, no filenames, no party names, no dates tied to a real matter, no
content. Anything more specific than a histogram is a confidentiality question that
gets asked before it is answered.

**Capability cites.** `goals/oppold-corpus-pipeline` (catalog + manifests);
`packages/tooling/tool/cli/src/commands/Corpus/` (the catalog reader already exists).

**Appetite.** 3–4 days after O1. **First proof:** a `CorpusShapeProfile` schema
decoded from catalog aggregates, driving matter-count / doc-count / type-mix in a
render, with the extraction step in the profile audited by a human before first use.

### O4 — `beep corpus synth` operator surface with preflight-before-spend

**What.** Extend the existing `beep corpus` command family with `synth plan` /
`synth render` / `synth rubric`, and copy Harvey's single best-engineered idea:
**preflight the whole matrix before spending a cent** — validate every spec decodes,
every id is unique, every pin resolves to a planned document, every predicate has a
non-empty ground truth — then abort the run on any failure
(`map-pipeline-docs.md` §5.2 → `[LAB] utils/sweep.py:582-655`, `:711-713`).

**Why last.** Genuinely useful and genuinely cheap, but it is packaging: O1–O3 have
to exist first, and the CLI shape follows from what they need.

**Capability cites.** `packages/tooling/tool/cli/src/commands/Corpus/Corpus.command.ts`
(seven sub-commands already, `Flag.directory`/`Flag.file` idiom in place);
`Corpus.schemas.ts` barrel convention.

**Appetite.** 3 days. **First proof:** `beep corpus synth plan --preflight-only`
rejects a spec set with a dangling pin, and reports cost before rendering.

---

## 6. Risks and anti-patterns

- **Do not port the prose rubric.** Harvey's criteria are prose because the structured
  layer was stripped on the way out. Keep features structured all the way to the judge
  boundary and render prose only at the last step. (Their own leakage proves the
  structure existed: snake_case generator fields — `matter_type`, `deal_value_usd`,
  `closed_date`, `closed_terminated`, person ids `PER-0048` — survive inside rubric
  text, `map-task-census.md` §5.5.)
- **Cross-document numeric consistency is the hardest property and the most
  valuable.** `map-corpus.md` §4 calls it "the single most impressive property of this
  corpus and the thing that makes it a real retrieval benchmark rather than a bag of
  plausible prose" — the $4.2M board-approved budget appears independently in an email
  and a billing spreadsheet. It comes from putting numbers **in the spec and
  templating them**, never from asking a model to remember. Any design where the LLM
  invents a figure that must recur elsewhere is already broken.
- **Content generation costs real money.** Preflight before spend (O4), cache prose by
  content hash (§4.4), and render incrementally.
- **Do not make filenames the retrieval channel.** Build the realism dial in from day
  one (§4.3) or we will ship a benchmark that flatters grep, exactly as C&H does.
- **Scope discipline on formats.** `.docx` + `.eml` in v1. `.xlsx` v2. `.pptx` and
  tracked changes are separate slices with their own justification.
- **Confidentiality:** O5's boundary (aggregate statistics only) is the one place this
  work touches privileged material, and it is the one place to be paranoid. When
  unsure whether a statistic is specific enough to identify a matter, ask before
  extracting it.
- **Do not treat the C&H corpus as ground truth for our extraction quality.** Its
  serialization layer is leaky by their own accident (34.5% of sampled long memos open
  with `TOC \o` parser garbage). Those defects are excellent *ingest regression
  fixtures* (`map-corpus.md` §7.5) and terrible *accuracy baselines*.

---

## 7. UNVERIFIED / open

- **`pandoc` availability.** Zero references to the binary anywhere in the repo (§8).
  Whether it is installed on this workstation, in CI images, or needs a `mise` entry is
  unchecked. O2's appetite assumes "install a binary" is not itself a project.
- **Pandoc docx-writer fidelity for `@beep/md` extensions.** `@beep/pandoc-ast` reports
  *reader*-direction gaps (custom style wrappers, notes, math, tables, raw
  Markdown/HTML, task-list state). The **writer** direction — do admonitions, embeds,
  footnotes, and math survive `Pandoc JSON → .docx` — is untested in either repo.
- **Plausibility of `S.toArbitrary`-generated specs.** Derived arbitraries produce
  *valid* specs; plausible ones need hand-written `toArbitrary` annotations per
  constrained leaf (the repo already does this ~30 times, so the pattern is proven —
  but the prosecution-specific annotations do not exist yet).
- **Cost model.** No estimate for authoring a 35-document matter (C&H's median).
  `map-corpus.md` §8 never tokenized the corpus; per-matter on-disk size was 1.5–4.4 MB
  for six samples. Needed before O4's preflight can report spend.
- **Whether an LLM judge honours `ACCEPTABLE EITHER WAY`.** `map-task-census.md` §9
  flags this as a soft spot: the judge prompt is a bare PASS/FAIL with no special
  handling, so the hedge is enforced only by the judge model reading prose. If we
  derive the boundary as *data*, the judge contract should consume it as data too —
  which is the eval agent's brief, not mine, but it is a dependency of O1's value.
- **Slice placement.** No `synth`/`corpus-gen` package exists; where the kernel lands
  (law-practice sub-slice vs tooling library) is an architecture decision for the
  shaping stage.
- **Redline authoring approach.** Whether direct OOXML manipulation or a different
  writer is the right route for `w:ins`/`w:del` is unresearched.

---

## 8. Evidence appendix — reproduction

All commands run from `/home/elpresidank/YeeBois/projects/beep-effect13`.

```bash
# feature vocabulary already modeled
ls packages/law-practice/domain/src/entities/
#   CandorDisposition Claim Distinction IdsSubmissionFact LegalClient LegalContact
#   Matter OfficeAction PatentAsset PatentCitationEvent PriorArtReference Rejection

# generation primitives
rg -n "toArbitrary" --glob "packages/foundation/modeling/schema/src/**/*.ts" | wc -l
rg -n "^export function LiteralKit" packages/foundation/modeling/schema/src/LiteralKit/LiteralKit.schema.ts
rg -n "toTaggedUnion" --glob "packages/**/src/**/*.ts"
rg -n "^export const withSeed" .repos/effect/packages/effect/src/Random.ts   # :290

# render chain: upstream half present
rg -n "documentToPandoc|encodePandocJsonString" packages/foundation/modeling/pandoc-ast/src/*.ts

# render chain: binary bridge ABSENT (no hits outside the pure AST package)
rg -in "pandoc" --glob "packages/**/src/**/*.ts" -l | grep -v pandoc-ast
#   -> packages/tooling/policy-pack/lint-rules/... , packages/foundation/modeling/identity/src/packages.ts
#      (both are name references, not invocations)

# no prior synthetic legal-corpus generator
rg -il "synthetic" --glob "packages/**/src/**/*.ts" -l
#   -> only incidental hits (TSSyntaxKind, Gesture.models, file-processing test helpers)

# operator surface to extend
ls packages/tooling/tool/cli/src/commands/Corpus/
#   Corpus.command.ts Corpus.errors.ts Corpus.recyclebin.ts Corpus.schemas.ts
#   Corpus.service.ts index.ts internal

# deterministic fixture-expander precedent
wc -l packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.fixtures.ts
#   753
```
