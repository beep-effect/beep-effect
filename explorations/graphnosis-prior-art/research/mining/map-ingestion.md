# Graphnosis → beep-effect mapping — territory: ingestion, extraction, enrichment & examples

Repo mapped: `/home/elpresidank/YeeBois/projects/beep-effect15` (branch `main`, `d1dfc4b3c1`).
Source survey: `scratchpad/graphnosis/survey-ingestion.md` (read in full, both pages).
Source repo for spot-checks: `/home/elpresidank/YeeBois/dev/Graphnosis`.

---

## 0. Orientation — where beep-effect's ingest territory actually lives

Before mapping anything I established beep's ingest funnel, because most of the
Graphnosis findings only make sense relative to it.

```
bytes ──FileProcessingService.process(operation)──▶ ExtractionResult { engine, engineVersion, text, metadata, warnings }
                                                       │
                                    SourceTextIdentity { scopeRef, sourceRef, locator,
                                                         sourceDigest, textDigest,
                                                         extractor{name,version},
                                                         normalizationVersion }
                                                       │
                                    TextAnchor / VerifiedTextAnchor (UTF-16 half-open + verbatim quote)
                                                       │
                                    EvidenceSpan → Evidence → CandidateClaim ──ClaimGate(SHACL)──▶ admitted/rejected
                                                       │
                                    EdgeVersion (bitemporal [validFrom,validTo) × [recordedAt,expiredAt))
```

Key packages found (all verified with `ls`/`rg`, not assumed):

| beep brick | path |
|---|---|
| ingest capability contract | `packages/foundation/capability/file-processing/src/{Extraction,Operation,Service,Strategy,SourceText,PathSafety}/index.ts` |
| PDF/DOCX engine | `packages/drivers/doc-text/src/DocText.service.ts` |
| Tika engine + libpff PST | `packages/drivers/tika/`, `packages/drivers/libpff/` |
| source-text identity | `packages/foundation/modeling/provenance/src/SourceTextIdentity.ts` |
| anchor verification | `packages/foundation/modeling/provenance/src/VerifiedTextAnchor.ts` |
| LLM extraction (prompt/parse/align) | `packages/foundation/capability/langextract/src/{Service,Extraction,Alignment,VerifiedSpan,Target,Handoff}/index.ts` |
| deterministic NLP | `packages/foundation/capability/nlp-processing/src/Tools/*.ts` (contracts) + `packages/drivers/wink/src/WinkTools.service.ts` (impl) |
| generic annotation IR | `packages/foundation/modeling/nlp/src/Handoff/Contract.ts` (`TextChunk`, `Span`, `Provenance`, `Mention`) |
| epistemic spine | `packages/epistemic/{domain,use-cases,server,tables}/src/**` |
| candor / liveness derivation | `packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.service.ts` |
| KG tool surface | `packages/law-practice/use-cases/src/PracticeKg.tools.ts` |
| markdown AST + render adapters | `packages/foundation/modeling/md/src/Md.render.ts` |

The single biggest structural difference from Graphnosis: **beep never funnels to
prose.** Graphnosis funnels every source to `ParsedDocument{sections}` and then to
text chunks; beep funnels to *canonical text + a digest + verifiable char offsets*,
and everything downstream must be able to re-slice `sourceText.slice(start,end) === quote`
(`VerifiedTextAnchor.ts:372`). That inverts the cost/benefit on several Graphnosis
choices (notably gai-11), and it makes gai-10 far more load-bearing for beep than it
is for Graphnosis.

---

## 1. Per-finding mapping

### gai-01 — MIN_CHUNK_LENGTH exempts complete units → `partial`

**Searched.**
```
rg -n 'MIN_CHUNK|minChunkChars|isCompleteUnit|dropShort' --glob 'packages/**' \
   --glob '!**/node_modules/**' --glob '!**/dist/**'
```
Only hit is an unrelated test helper (`nlp-processing/test/Graph/TypeClass.test.ts:45`).
```
rg -n 'MIN_CHUNK|minChunk|minLength|MIN_LENGTH' --glob 'packages/**/src/**'
```
No chunker floor anywhere; every `minLength` hit is fast-check arbitrary config or
JSON-Schema keyword modelling.

**Brick that exists.** beep has exactly one chunker:
- contract `packages/foundation/capability/nlp-processing/src/Tools/ChunkBySentences.ts`
  (`maxChunkChars`, `chunks`, `originalSentenceCount` — no minimum anywhere);
- implementation `packages/drivers/wink/src/WinkTools.service.ts:452-530` — greedy
  sentence accumulation up to `maxChars`, filtering only `Str.isNonEmpty`.

So the Graphnosis bug (a length floor eating short-but-whole answers) **cannot occur
today** — because there is no floor at all, and because this chunker is an agent tool,
not the ingest path.

**What is missing.** The real ingest chunker does not exist yet and is a *named*
net-new gap owned by `explorations/rag-retrieval-projection`:
- `research/SOURCES.md:63-68` — "Char-span chunking (NET-NEW windowing layer)… `doc-haus#11`
  is the concrete recipe"; `lawyergpt#6`'s fixed-size chunker explicitly **skipped**.
- `research/SOURCES.md:242` — "**Offset-preserving char-span chunker** (windowing/sectionizer
  between `@beep/md` and …)".
- `research/SOURCES.md:257-258` — `goals/langextract-capability` SPEC non-goals *decline*
  a standalone windowing chunker; "This packet owns the chunker".

Nothing in that packet specifies a minimum-length policy. The transferable rule —
*derive "was this truncated?" from the splitter's own output count, not from content* —
is one line in that chunker's spec and it is exactly the kind of silent-loss defect
a malpractice-grade corpus cannot tolerate (a one-word answer in an office action,
a `FINAL` marker on its own line, a date cell).

**Verdict:** partial. Land the rule in `explorations/rag-retrieval-projection`.
Value 3 (cheap, prevents a real silent-loss class in unbuilt code). Effort S.

---

### gai-02 — one canonical chunk identity; parentId must be the resolver's key → `already-have`

beep solved this class better, and wrote down why.

`packages/epistemic/domain/src/values/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts`:
- module doc: *"the application-side canonicalization whose digest becomes the
  `logical_key` column every bitemporal backstop partitions on… a multi-column key
  cannot carry the partition: SQL treats NULL components as distinct under `=`, so
  optional scopes would silently split one logical edge into several."*
- `canonicalEncodingVersion = "v1"` — *"Bump it whenever the canonical encoding changes
  so old and new keys can never collide in a table that holds both."*
- `absentScopeMarker = "<none>"` — *"a distinct token rather than an empty string so
  `none` can never collide with a real scope value."*
- endpoint encoding is shared, not reimplemented: `import { EdgeEndpoint, encodeEdgeEndpointKey }`
  (`:21`) — the producer literally calls the resolver's key function, which is
  Graphnosis's stated fix.

Endpoints themselves are typed opaque refs kept in distinct brands so they cannot be
substituted (`packages/epistemic/domain/src/values/EdgeEndpoint/EdgeEndpoint.model.ts`:
`EdgeEntityRef`, `EdgeObservationRef`), and unresolvable/conflicting writes fail loudly
via typed errors rather than being dropped — `EdgeConstraintViolation`,
`SupersessionConflict`, `EdgeRepositoryUnavailable`
(`packages/epistemic/use-cases/src/EdgeAuthority/EdgeAuthority.errors.ts:143,262,314`).

The silent-drop half is also absent from the LLM path: langextract counts what it could
not resolve instead of discarding it — `LangExtractDiagnostics{alignedCount, candidateCount,
unalignedCount, promptChars}` (`langextract/src/Service/index.ts:315-322`).

Repo-wide the same discipline is the `$I` / `IdentityComposer` law (`@beep/identity`,
`goals/identity-iri-core` completed-retained, PR #289).

**Verdict:** already-have. The only forward-looking action: when the net-new char-span
chunker mints chunk ids, it must reuse this discipline (one versioned canonical encoding
function, called by producer and resolver) rather than string-templating a second key
format. Value 2. Effort S.

---

### gai-03 — a source may corroborate without the right to originate → `partial`

**Searched.**
```
rg -n -i 'corroborat|originat' --glob 'packages/**/src/**'   # 0 hits
rg -n -i 'trustTier|sourceQuality|provenanceTier' --glob 'packages/**/src/**'  # 0 relevant hits
```

**Bricks that exist, at a *different granularity*.** beep has originate-vs-corroborate
as an **operation-level** distinction, not a **source-level** one:
- Contradiction detection is non-authoritative by construction:
  `explorations/agent-memory-tiers-bitemporal-edges/MAP.md` — *"evidence-backed,
  confidence-bearing, reviewable `CONTRADICTS` candidates and an approval path that may
  resolve as atomic `SUPERSEDES` **without detection mutating authority**"*; implemented as
  `packages/epistemic/{domain,use-cases,server}/src/**/Contradiction*`.
- `PracticeKgEpistemicStatus = LiteralKit(["derived-from-official-records",
  "candidate-unreviewed"])`
  (`packages/law-practice/domain/src/values/PracticeKgEpistemicStatus/PracticeKgEpistemicStatus.model.ts:38`)
  — every KG tool row carries an authority label.
- `ClaimGate` requires ≥1 evidence quote to admit
  (`packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts:58-67`, `minCount: 1`).

Also relevant: beep's entity extraction is a real typed NER model (wink
`wink-eng-lite-web-model`, `packages/drivers/wink/src/Wink.service.ts:288`), not a
Title-Case regex, so the *specific* Graphnosis over-firing failure and its A1
antipattern do not transfer.

**What is missing.** No per-source right-to-originate attribute. A structural node
(a heading, a filename, a DMS folder label, an email subject line, an OCR page header)
is treated the same as body text by every extraction consumer. beep's own gold intake
already captured the adjacent idea and did not build it:
`explorations/_gold-intake/GOLD_SYNTHESIS.md:680` — BAML `Source{quality_score,
authority_level, is_primary_source, recency, potential_issues}` vs *"beep's `Evidence`
has only confidence"*.

**Verdict:** partial. Land in `explorations/agent-memory-tiers-bitemporal-edges` — that
packet's whole premise is *"every consolidated fact carries confidence + source links"*,
and `epistemic-memory-retention-projections` (its queued third packet) is where a
three-valued per-source right (`originate | corroborate | excluded`) would live instead
of a boolean trust flag. Value 4 — it changes the shape of the confidence model.
Effort M.

---

### gai-04 — gate every content *exit* on one liveness predicate; ranking is not gating → `partial`

**Brick that exists, and it is excellent.**
`packages/law-practice/use-cases/src/CandorPolicy/CandorPolicy.service.ts:30-57`:

- `retiredDispositionIds` — *"deliberately computed over the WHOLE recorded set, never
  over a subset already filtered to one event… filtering first would drop the retiring
  row before its `supersedes` reference was ever read and leave a retired judgment
  looking effective — **a fail-open hole in a gate whose entire purpose is to fail
  closed**."*
- `effectiveDispositions` — *"A disposition is effective only if it declares itself live
  and nothing later retires it. Both halves matter."*

Plus `ClaimDispositionStatus = ["active","rejected","superseded"]`, `EdgeVersion`
bitemporal intervals with two-axis `asOf(validAt, knownAt)`, and `CandorPolicy.coverageReason`
which re-resolves the source and re-verifies the anchor before promotion, returning a
typed `UncoveredReason` rather than raising.

So beep already has **one liveness derivation, fail-closed, with the ranking-is-not-gating
trap avoided** — the hard half of gai-04.

**What is missing: the exit enumeration.** Nothing in the repo enumerates the paths by
which stored content leaves and routes them through one predicate. The exits I can name
from the live tree:

| exit | path | gated today? |
|---|---|---|
| LLM classification prompt | `packages/documents/server/src/aggregates/Document/FilingDecisionLlm.ts` (`promptFor` embeds `input.textExcerpt`) | no liveness/confidentiality predicate |
| LLM extraction prompt | `packages/foundation/capability/langextract/src/Service/index.ts:282-283` (`buildPrompt(request)` embeds `request.text`) | only `LangExtractRemotePolicy` (remote-allowed check) |
| MCP tool responses to Claude Desktop | `packages/law-practice/use-cases/src/PracticeKg.tools.ts` | *labels* rows (`PracticeKgEpistemicStatus`), does not gate |
| DMS mirror (Box/OneDrive) | `packages/documents/server/src/aggregates/Sync/DmsMirror*.ts` | out of scope of any predicate |
| error/log/telemetry | `packages/foundation/capability/observability/src/CauseRedaction.ts` | its own separate pattern bank |
| agent-metrics derived storage | `packages/tooling/library/ai-metrics/src/privacy.ts:660` `safeForDerivedUi` | its own separate pattern bank |

And `goals/ingestion-secret-scrub` (lifecycle `active`) is currently specced to build
`safeForPrompt` for **one** of those exits:
```
rg -n 'safeForPrompt' --glob 'packages/**/src/**'   # 0 hits — not built yet
```
`explorations/ingestion-security-secret-governance/MAP.md:12` — *"sanitized text,
category/count proof, `safeForPrompt`…"* — and RESEARCH.md:96-97 already notes there are
**three** independent secret-pattern banks in-tree and says *"fold into one canonical bank,
do not start a fourth"*, which is the same disease one level down.

**Verdict:** partial, and the highest-leverage mapping in this territory. The
recommendation is concrete and checkable: before `ingestion-secret-scrub` locks its
contract, enumerate the six exits above in SPEC and state for each whether it routes
through the predicate or is explicitly out of scope with a reason. Value 5 — it changes
how that gate is specified. Effort M.

---

### gai-05 — optional LLM pass: pure prompt/parse, metadata-only writes, prompt-version cache key → `partial`

**Already-have (three of four parts).**
- Pure prompt builder: `buildPrompt` (`langextract/src/Service/index.ts:249-259`) is an
  exported pure function with its own `@example`; `promptFor`
  (`documents/server/.../FilingDecisionLlm.ts:70-88`) likewise.
- Defensive parse: `parseModelOutput(response.text)` returns a typed
  `LangExtractError.fromReason("model-generation-failed" | "model-generation-timeout" | …)`
  channel, never a throw (`Service/index.ts:283-303,311`).
- Caller-owned network call: the LLM is `LanguageModel.LanguageModel` from
  `effect/unstable/ai`, resolved from context (`Service/index.ts:278`) — Effect layers give
  this for free and *more* strongly than Graphnosis's convention, since the pure core can
  be tested with a stub layer.
- Additive-only writes + tally: `LangExtractDiagnostics{alignedCount, candidateCount,
  promptChars, unalignedCount}` (`Service/index.ts:315-322`); extraction never rewrites
  the canonical text or its digest.
- Free-tier-first / paid-tier-opt-in: `FilingDecisionHeuristic.ts` (deterministic taxonomy
  token match, `deterministicConfidence = 1`) and `FilingDecisionLlm.ts` as separate
  layers selected at composition.

**Gap (one part, and it is the postmortem part).** No LLM response cache exists at all:
```
rg -n 'CACHE_VERSION|CacheEnvelope|cacheOnly|PROMPT_VERSION' --glob 'packages/**/src/**'
# 0 hits
rg -n -i 'promptCache|llmCache|responseCache' --glob 'packages/**/src/**'
# 0 hits
```
Therefore no cache key, therefore no prompt-version-in-the-key, therefore no `cacheOnly`
offline-measurement flag. beep does already practise the underlying discipline one lane
over — `promptHash` is recorded on agent-effectiveness eval records
(`packages/tooling/tool/cli/src/commands/AgentEffectiveness/internal/EvalRecord.ts:88`,
`hashPublicTextSha256(task.prompt)`) — so the idea is present, just not on the product
LLM path.

Note beep would *not* inherit antipattern A2 (32-bit DJB2 as cache key): every content
key in this repo is SHA-256 (`SourceTextDigest = "sha256:<hex>"`, `Sha256Hex`,
`hashPublicTextSha256`).

**Verdict:** partial. The transferable is narrow and precise: *if/when an LLM response
cache lands, the key must mix an explicit prompt version and the envelope must carry a
`version` field so a bump is a mass miss with no eviction pass; and there must be a
`cacheOnly` flag so measurement runs cannot pay for or pollute the cache.* Land in
`explorations/multi-provider-llm-dispatch-fallback` (graduated; its retained MAP
candidate `llm-runtime-dispatch` is the dispatch-boundary owner where a cache belongs).
Value 4. Effort M.

---

### gai-06 — query-time preference extraction: category-gated, cap 3, prefer zero → `partial`

**Searched.**
```
rg -ni 'PreferenceStatement|extractPreference|userPreference' --glob 'packages/**/src/**'
# 0 hits
```

**Bricks that exist.** Two of the three transferable ideas are already beep law:
- *Prefer abstention over a loose match.* `explorations/deterministic-doc-structure-extraction/BRIEF.md`:
  *"The workflow emits no candidate unless both required structures survive source
  verification. It fails closed with `absent`, `ambiguous`, `unsupported`,
  `low-quality-source`, or `rule-not-covered`."* That is Graphnosis's "return an empty
  list — this is the correct answer for most sessions", expressed as a typed reason union.
- *Voice attribution is first-class.* `MessageRole` is a typed persisted column on
  `packages/workspace/domain/src/entities/Message/Message.model.ts:72,86` — beep does
  **not** have Graphnosis antipatterns A3/A4 (role destroyed into a display string, or
  fabricated from paragraph parity).

**What is missing.** The prompt-assembly discipline:
1. an extraction pass **gated on a router category** so it never runs on questions it
   cannot help (beep has no query router at all);
2. **enumerated disqualifiers** as a list rather than adjectives — beep's only extraction
   prompt is three lines (`buildPrompt`, `Service/index.ts:249-259`);
3. **distilled evidence prepended to raw evidence** in a labelled block with
   `[session:|date:|turn:]` provenance tags, so the answer model sees the distillation
   before the transcript.

For beep the analogue is not hotel preferences — it is *"what has this client already
decided / instructed / disclosed"* pulled ahead of raw correspondence in a matter prompt,
where "the attorney previously suggested X" is the dominant false positive, exactly as
Graphnosis found.

**Verdict:** partial. Land in `explorations/rag-retrieval-projection` — it owns the
candidate seam feeding `ClaimGate` and is where evidence ordering into a prompt is
decided. Value 3. Effort M.

---

### gai-07 — session summaries as level-1 nodes above the pruner floor, in the same index → `partial`

**Searched.**
```
rg -n 'session-summary|SessionSummary|summarizes' --glob 'packages/**/src/**'   # 0 hits
```

**Captured but not built.** `explorations/_gold-intake/GOLD_SYNTHESIS.md:852` —
*"`UtilitySaveResearchContext` builds a compressed `MemorySnapshot`… beep's workspace
Turn/Message persistence is durable but **there is no progressive context-reduction or
recovery for long matters**. Study this as the design for an agents-memory compaction
step: a `MemorySnapshot` schema persisted alongside Threads, produced by a summarization
Turn and consumed to rehydrate context."*

And `explorations/agent-memory-tiers-bitemporal-edges/MAP.md` queues
`epistemic-memory-retention-projections` — *"rebuildable retention/tier projections over
accepted authority records… Shape this independently after observed use can justify tiers,
decay, thresholds"*; BRIEF.md:121 — *"decay and tier thresholds need observed calibration"*.

**What the finding adds that the packet does not have.** Four concrete mechanics:
1. the summary is **a node of the same kind at a distinct `level` and `type`**, not a side
   table — so one retrieval path serves both "what happened in March" and "what exactly
   did I say";
2. its confidence is deliberately **below** primary evidence (0.8 vs 0.9) so it ranks
   under, not over, the thing it summarizes;
3. its `source.file` is the session's own source, so it stays attributable;
4. its edge weight is chosen **against a named downstream threshold** (`0.7 > pruner
   minDirectedWeight`) *and the comment says so* — a coupling that normally goes
   undocumented and later breaks silently.

(3) is the one beep cannot copy verbatim: a synthesized summary has **no verbatim span**,
so it cannot carry a `VerifiedTextAnchor` and would fail `verifyTextAnchor`'s
`quote-mismatch` check by construction (`VerifiedTextAnchor.ts:372`). beep's version has
to be a distinct node kind that carries *derived-from* edges to the anchored evidence
rather than an anchor of its own — which is precisely `PracticeKgEpistemicStatus`'s
existing distinction one level up.

**Verdict:** partial. Land in `explorations/agent-memory-tiers-bitemporal-edges`
(the `epistemic-memory-retention-projections` lane). Value 4. Effort L.

---

### gai-08 — multilingual by construction + prompts forbidding translation → `partial`

**What beep has.**
- Language is an **untyped metadata string** on extraction output — the only occurrence is
  a doc example: `packages/foundation/capability/file-processing/src/Extraction/index.ts:159`
  `metadata: { language: "en" }`. There is no `language` field on `ExtractionResult`,
  `SourceTextIdentity`, or `@beep/nlp` `TextChunk`.
- The deterministic NLP layer is **English-only by construction**:
  `packages/drivers/wink/src/Wink.service.ts:288` — *"Live layer that loads `wink-nlp` with
  the bundled English lite web model"*; `packages/drivers/wink/package.json:70`
  `wink-eng-lite-web-model`.
- BCP-47 language tags exist but only in presentation/semantic layers:
  `packages/foundation/modeling/html/src/internal/Html.language-tag.ts`,
  `packages/foundation/modeling/rdf/src/Rdf.ts`.
- Unicode handling in the *alignment* layer is genuinely stronger than Graphnosis:
  `packages/foundation/capability/langextract/src/VerifiedSpan/index.ts:337-395` —
  NFKC normalization with a raw-offset index map, combining-mark cluster detection
  (`isCombiningMark`, `joinsNormalizedCluster`), and smart-quote folding, so the
  normalized match remaps back to verbatim source offsets.

**Why beep is partly protected without trying.** The extraction prompt says *"Use exact
text copied from the source whenever possible. Do not invent offsets."*
(`langextract/src/Service/index.ts:251`), and any candidate that does not re-slice is
marked `unaligned` and counted. So for *extraction*, transliteration is caught
structurally, not by prompt instruction — stronger than Graphnosis's approach.

**What is missing.** Any pass that **synthesizes** rather than extracts (summaries,
rationales, distilled preference statements — see gai-06/gai-07) has no such protection,
and beep is heading toward lexical retrieval (`explorations/rag-retrieval-projection`
three-channel RRF with a literal floor). Graphnosis's mechanical insight applies verbatim:
a synthesized node re-indexed into the same lexical index that transliterated an entity
cannot be retrieved by the query that retrieves its own evidence. For an IP practice this
is not exotic — foreign-priority documents, PCT/EPO/JPO/KIPO family members and their
translations are routine, and `Müller`/`München`/`東京` in an inventor or assignee field
is the normal case.

**Verdict:** partial. Land in `explorations/rag-retrieval-projection` — the mechanism is a
*lexical-index recall* property and that packet owns the lexical channel. Also worth a
typed `language` on the ingest IR rather than a metadata string. Value 3. Effort M.

---

### gai-09 — ingest hardening: scan caps, bounded quantifiers, page caps, event-loop yields → `partial`

**Already-have — beep has been bitten by this exact class and remediated it.**
- ReDoS bound on attacker-supplied patterns:
  `packages/drivers/nlp-mcp/src/StreamingHandlers.ts:54-58` —
  `MAX_PATTERN_LENGTH = 1_000`, *"Patterns above this are rejected before reaching
  `new RegExp`, bounding the ReDoS surface from catastrophic backtracking on adversarial
  inputs (the pattern is attacker-controlled via the MCP tool parameters)."*
- Byte cap + timeout + defensive copy at document intake:
  `packages/documents/server/src/aggregates/Document/FilingTextExtraction.ts:159-190`
  (`config.maxMaterializedBytes` pre-check, `maxMaterializedBytes` on the operation,
  `new Uint8Array(input.content)` — *"an engine must never be able to detach or mutate the
  intake bytes"*, `Effect.timeoutOrElse({ duration: config.extractionTimeout })`).
- Prior findings, all triaged real: `goals/codex-security-findings-2026-06-17/findings/CSF-032.md`
  ("Unbounded fuzzy alignment enables CPU denial of service", already fixed),
  `.../CSF-038.md` ("Quadratic JSON extraction enables CLI CPU denial of service", already
  fixed), `goals/codex-security-findings-2026-07-14/findings/CSF-005.md` ("Unbounded
  document text extraction enables intake DoS", lane RL-002, remediated by the caps above).
- Linear-time-engine research already done:
  `explorations/court-vocabulary-resolver/research/span-gated-resolver-algorithm-in-effect.md`
  — 2,100 hand-crafted patterns over untrusted OCR text, RE2JS/node-re2 mitigation,
  *"Node has no built-in per-regex timeout"*.
- The batch-validate-before-write half is **not-applicable**: beep has real Postgres
  transactions in `packages/epistemic/server/src/**` repositories, so a half-mutated store
  is not a failure mode it has to hand-roll around.

**What is missing — two specific things.**
1. **`Effect.timeoutOrElse` does not interrupt the parse.**
   `packages/drivers/doc-text/src/DocText.service.ts:124-133` builds the parse as
   `Effect.tryPromise({ try: () => getDocumentProxy(new Uint8Array(bytes), {verbosity:0})
   .then((proxy) => extractText(proxy, {mergePages:true})) })` — **no AbortSignal is passed**,
   so interruption cannot propagate into pdfjs. `FilingTextExtraction`'s timeout stops the
   fiber *waiting*; the parse keeps consuming CPU and memory to completion. Graphnosis's
   `PAGE_BATCH_SIZE = 10` + `await new Promise(r => setImmediate(r))` + `DEFAULT_MAX_PAGES`
   is the mechanism that actually bounds it. `rg -n 'Effect.yieldNow|setImmediate'
   --glob 'packages/**/src/**'` returns one unrelated doc example
   (`ui-system/dock/src/Minima.ts:184`).
2. **No resource-exhaustion lane in the owning packet.** `explorations/ingestion-security-secret-governance`
   covers prompt injection, secrets/PII, SSRF, mXSS, hidden content — verified by grepping
   its RESEARCH/MAP/DECISIONS — but not algorithmic complexity or resource exhaustion.
   The three named techniques (scan cap; bounded quantifiers with domain-justified limits;
   narrowed character class justified by the domain) are a written law that packet does not
   have, and it is about to author a repo-wide regex pattern bank.

**Verdict:** partial. Land in `explorations/ingestion-security-secret-governance`.
Value 4. Effort M.

---

### gai-10 — PDF glyph joining by position-relative gap, NFC after the join → `gap`

**Searched.**
```
rg -n 'transform\[4\]|joinPdfItems|hasEOL|fontSize \*' --glob 'packages/**/src/**'   # 0 hits
rg -n "normalize\(['\"]NF" --glob 'packages/**/src/**'
# 4 hits, none in a parser: Knowledge.service.ts:194, Taxonomy.projection.ts:146 (NFKD slug),
# gov-legal-mcp/ToolNames.ts:372 (NFKD), langextract/VerifiedSpan/index.ts:340 (NFKC aligner)
```

**What beep does today.** `packages/drivers/doc-text/src/DocText.service.ts:126-133`
delegates entirely to unpdf's stock text extractor:
```ts
getDocumentProxy(new Uint8Array(bytes), { verbosity: 0 })
  .then((proxy) => extractText(proxy, { mergePages: true }))
```
and unpdf's `extractText` is, verbatim from `node_modules/unpdf/dist/index.mjs:394`:
```js
(await (await document.getPage(pageNumber)).getTextContent())
  .items.filter((item) => item.str != null)
  .map((item) => item.str + (item.hasEOL ? "\n" : ""))
  .join("")
```
Pure concatenation. No inter-item spacing decision. No Unicode normalization.

Notably beep and Graphnosis **independently chose the same library** — Graphnosis's
`pdf-parser.ts:70-75` documents unpdf over pdf-parse@2/pdfreader/pdf2json/mupdf-js — but
Graphnosis then wrote its own ~20-line `joinPdfItems` on top of `getTextContent()` while
beep takes the library's default join.

**Why this is worth more to beep than it was to Graphnosis.** In Graphnosis a garbled
join degrades retrieval. In beep the extracted text **is** the substrate everything else
is defined against:
- `DOC_TEXT_ENGINE_VERSION = "1"` — *"Increment this value when PDF or DOCX extraction
  semantics change in a way that can alter the canonical text or its UTF-16 offsets"*
  (`DocText.service.ts:26-41`);
- that version is pinned into `SourceTextIdentity.extractor{name,version}`
  (`provenance/src/SourceTextIdentity.ts:71-88,119-144`);
- every `TextAnchor` / `EvidenceSpan` / `CandidateClaim` is verified by
  `sourceText.slice(startChar,endChar) === quote` (`VerifiedTextAnchor.ts:372`).

So a join that shreds or fuses words in a diacritic-heavy PDF produces quotes that are
*verifiably* wrong-but-consistent: they will re-verify forever against the same bad text
while being unquotable in a real document. It is silent on English and wrong on exactly
the foreign-priority documents an IP practice handles.

The two portable insights hold exactly: (a) spacing must be measured in **font-size-relative**
units (`gap > fontSize * 0.2` where `fontSize = |item.transform[3]|`), not absolute PDF
units; (b) **NFC must run after the join**, because combining marks arrive as separate
`TextItem`s so per-item normalization is a no-op.

Caveat on effort: the change itself is ~20 lines against `getTextContent()`, but it is a
`DOC_TEXT_ENGINE_VERSION` bump, which by design invalidates every stored
`SourceTextIdentity` (`verifyTextAnchor` returns `stale-source` on any identity
difference — `VerifiedTextAnchor.ts:355-357`). That is the real cost, and it is cheaper
now than after the corpus is anchored.

**Verdict:** gap, verbatim-portable. Land in `goals/legal-document-intake` (lifecycle
`active`, owns the drag-and-drop → extraction → knowledge-graph surface); the change
itself is in `@beep/doc-text`. Value 5. Effort M.

---

### gai-11 — non-prose sources rendered as prose at parse time; LLM strictly opt-in → `already-have` (structural half) / deliberate divergence (prose half)

**The structural idea is already beep's architecture.** Every engine — `@beep/doc-text`
(PDF/DOCX), `@beep/tika`, `@beep/libpff` (PST) — emits the same `ExtractionResult`
(`file-processing/src/Extraction/index.ts`), selected by one `Strategy` and run by one
`FileProcessingService.process(operation)` (`Service/index.ts:539`). Adding a source type
is one engine descriptor and nothing else in the system changes. Verified by
`FileProcessingEngineDescriptor{capabilities, engine, name, supportedFormats, version}`
(`DocText.service.ts:57-64`).

**The `$0 path` framing is also already-have**, and expressed as layers rather than
booleans: `FilingDecisionHeuristic.ts` (deterministic taxonomy token match,
`deterministicConfidence = UnitInterval.fromUnknown(1)`) vs `FilingDecisionLlm.ts`
(model + `FILING_DECISION_CONFIDENCE_THRESHOLD_ENV` + timeout), selected at composition;
plus `LangExtractRemotePolicy` gating remote extraction
(`langextract/src/Service/index.ts:279-281`).

**The prose-rendering half is a deliberate divergence, not a gap.** `@beep/exiftool`
returns typed metadata models (`Exiftool.models.ts:420` "Camera make text, when the file
reported one"), and that is correct for beep: a fabricated sentence
("Image was taken at GPS coordinates…") is text with **no source span**, so it cannot
carry a `VerifiedTextAnchor` and cannot be cited. Graphnosis pays verbosity + fabricated
phrasing to get downstream uniformity; beep already has downstream uniformity from the
typed `ExtractionResult` and would pay *unciteable evidence* for nothing. beep's
equivalent of "the LLM reads natural language" is a render adapter at the prompt boundary
(`@beep/md` `PlainTextAdapter`, `Md.render.ts:1361`), applied to typed data at
serialization time rather than at parse time.

**Verdict:** already-have for the funnel; record the prose-at-parse-time variant as an
explicitly **rejected** alternative with the reason, so it is not re-proposed. Value 2.
Effort S.

---

### gai-12 — Giki: LLM-free typed topic pages with per-line node citations → `gap`

**Searched.**
```
rg -ni 'generateGiki|topicPage|generateWiki|nodeCitation' --glob 'packages/**/src/**'   # 0 hits
rg -i 'wiki|report|human.readable|render|markdown' goals/practice-kg-mcp/SPEC.md
# only one incidental hit about catalog reports
```

**Bricks that make this cheap in beep, all verified:**
- `@beep/md` is a typed markdown AST with **pure render adapters** —
  `renderMarkdownBlock` / `renderHtmlBlock` / `renderMarkdownBlocks`,
  `MarkdownAdapter` / `HtmlFragmentAdapter` / `PlainTextAdapter`
  (`packages/foundation/modeling/md/src/Md.render.ts:654-1361`). Rendering is
  `S.encode`-shaped, so a "page" is a value, not string concatenation.
- The typed node vocabulary already exists at *extraction* time, which is the whole
  reason Graphnosis's page schema is derivable with zero render-time inference:
  `CandidateClaim`, `Evidence`, `EvidenceSpan`, `ClaimDispositionStatus`,
  `KgNodeKind`, `PracticeKgProvenanceKind`.
- The honest-epistemic label already exists and already ships on every row:
  `PracticeKgEpistemicStatus = LiteralKit(["derived-from-official-records",
  "candidate-unreviewed"])`
  (`law-practice/domain/src/values/PracticeKgEpistemicStatus/PracticeKgEpistemicStatus.model.ts:38`).
  That *is* Graphnosis's "attributed claims, not verified facts" banner, typed.
- Citations reverse-map for free: `VerifiedTextAnchor` + `kg_provenance`
  (`PracticeKg.tools.ts:802-805` — "Resolve node or document provenance").

**What is missing.** The human-auditable derived surface itself. Today beep's KG is
machine-readable only (MCP tool rows to Claude Desktop). There is no zero-inference,
citation-bearing, type-partitioned document a human can read to audit what the graph
believes. `explorations/knowledge-workspace`'s open question is literally *"What is the
smallest current-repo vertical that proves journal → graph projection → **wiki-link
authoring** → temporal replay as one coherent experience?"* — this is a concrete answer
to it, and one that needs no LLM.

Do **not** port antipattern A5: `getTopicRelationships(graph, nodeIds, topic)` ignores
`topic`, index generation is O(pages × graph) with three full scans per page, and dedup is
applied in only one branch so the footer double-counts.

**Verdict:** gap. Land in `explorations/knowledge-workspace`. Value 4. Effort L.

---

### gai-13 — example corpora selected for graph density, one fetcher contract, one registry → `gap`

**Searched.**
```
rg -n 'fetchAll|DATASETS' --glob 'packages/**/src/**' --glob 'apps/**/src/**'   # 0 hits
fd -t d 'fixtures' packages/ --max-depth 6
# 12 per-package test/fixtures dirs; no shared corpus, no registry, no fetcher contract
```

**What beep has instead.** A single **private, out-of-repo** corpus:
`goals/oppold-corpus-pipeline` (completed-retained) — 8,438 files / 31.7 GB salvaged to
`/home/elpresidank/data-home/oppold-corpus/`, DuckDB catalog, 7,330 distinct digests,
6,702 text artifacts. It is confidential by standing rule and can never be committed.
Everything in-repo is hand-built per-package fixtures.

Also relevant: beep already owns the fetchers a public corpus would need —
`@beep/uspto`, `@beep/govinfo`, `@beep/pacer`, and a codegen sync target with
`packages/tooling/tool/cli/src/commands/SyncDataToTs/internal/FreeLawProject.ts` +
`targets/CourtsDb.ts`. But there is no per-source documented rate limit, no uniform
`fetchAll<X>(onProgress)` contract, and no slug→fetcher registry.

**Why it matters here.** The Graphnosis point is not "ship a demo" — it is *a demo corpus
for a graph product must be selected for **edges**, and say so in the config file*. beep's
KG/retrieval work (`hybrid-retrieval-fusion-core`, `practice-kg-mcp`,
`rag-retrieval-projection`) has no non-confidential, edge-dense corpus to test against, so
its integration coverage is hand-authored fixtures that encode the author's assumptions
(a known beep failure mode). A curated set chosen for cross-citation density — e.g. a
patent family with its own continuity + forward/backward citations + the PTAB proceeding
+ the Federal Circuit opinion — would exercise the parser matrix (PDF text layer, scanned
PDF, XML, JSON API rows, email) *and* produce real cross-source shares-entity edges, with
zero confidentiality exposure.

**Verdict:** gap. No existing packet fits (oppold-corpus-* are the private corpus;
official-data-sync-foundation is completed-retained and is about schema codegen, not
corpora). Propose `NEW:public-demo-corpus-suite`. Value 3. Effort L.

---

### gai-14 — ingest-policy provenance per graph and per node, proven by a semantic parity test → `partial`

**Already-have, and better — the stamping half.**
`packages/foundation/modeling/provenance/src/SourceTextIdentity.ts:119-144` stamps
**per record**: `extractor: SourceTextExtractor{name, version}` +
`normalizationVersion: S.NonEmptyString` ("Version of the locator-only normalization
contract"), alongside `sourceDigest` and `textDigest`.
`packages/drivers/doc-text/src/DocText.service.ts:26-41` documents the bump rule:
*"Increment this value when PDF or DOCX extraction semantics change in a way that can
alter the canonical text or its UTF-16 offsets."*

beep does **not need** Graphnosis's `'mixed'` container marker, because the vintage is not
merely legible — it is **enforced**. `verifyTextAnchor`
(`VerifiedTextAnchor.ts:349-374`) compares the whole `SourceTextIdentity` via
`sourceTextIdentityEquivalence` and fails `stale-source` on any difference, including a
changed extractor version, before it ever compares the quote. A mixed-vintage store
therefore fails closed per record rather than advertising itself at the container. That is
strictly stronger than a marker.

**Gap — the test-craft half.**
```
rg -n -i 'deliberately outside|out of scope for this (test|assertion)|not asserted here|explicitly excludes' \
   --glob 'packages/**/test/**'          # 0 hits
fd -t f -e ts . packages/ --glob '**/test/**' | xargs basename | grep -i 'regression|defect|CSF'   # 0 hits
```
Two portable practices are absent:
1. **Declaring what an invariant excludes.** Graphnosis's parity test opens by naming its
   exclusions ("Random node/edge ids, corpus-wide identity extraction, forward-only
   cross-document relationships, and exact undirected-edge equality are deliberately
   outside this assertion"). Without that, the next person either weakens the assertion or
   chases nondeterminism that was never in scope. beep's `*.SchemaParity.test.ts` files
   and property lanes state what they check, never what they don't.
2. **Naming tests after defect classes, not modules** (`C1…C6`, "six defects that all
   shared one symptom: content entered the system and quietly failed to be findable"), and
   failure messages that state the *consequence*. beep has the raw material — the
   `goals/codex-security-findings-*` packets are a defect-class ledger with stable ids —
   but no test file cites one.
3. **The fixture asserting its own premise** ("ids may have become deterministic, revisit
   this test") is the direct antidote to beep's own recorded `vacuous-test-pattern` /
   `vacuous-effect-fn-test-body` failure classes.

**Verdict:** partial. Stamping is done better; the test-craft law is a small, real
addition. Land in `explorations/graphnosis-prior-art` (needs shaping into a repo law
before it belongs anywhere else). Value 3. Effort S.

---

## 2. Antipattern check — does beep risk any of these?

| Graphnosis antipattern | beep risk | evidence |
|---|---|---|
| A1 `isLikelyPerson` mints Title-Case phrases as people; dead mention threshold; O(P²·M²) co-mention | **low** | entity extraction is a typed NER model (`wink-eng-lite-web-model`, `drivers/wink/src/Wink.service.ts:288`), not a capitalization regex; there is no person-node minting pass at all (`rg 'isLikelyPerson\|inferPersonAttributes' packages/` → 0) |
| A2 32-bit DJB2 as an LLM cache key | **none today, and structurally excluded** | every content key in the repo is SHA-256: `SourceTextDigest = "sha256:<hex>"` (`SourceTextIdentity.ts:29`), `Sha256Hex`, `hashPublicTextSha256`; also there is no cache (see gai-05) |
| A3 role destroyed at parse time, string-sniffed back from a display label | **none** | `MessageRole` is a typed persisted column: `packages/workspace/domain/src/entities/Message/Message.model.ts:72,86` |
| A4 `parseRaw` fabricates roles from paragraph parity, and is the universal fallback | **none** | beep's fallbacks fail closed with typed reasons, e.g. `makeDocTextError("empty-text-layer")` → `FileProcessingOperationError.fromReason("file-extraction-failed", …)` (`DocText.service.ts:69-84`); nothing invents provenance |
| A5 unused `topic` param; O(pages × graph) index; branch-local dedup | **N/A today**; a real trap **if gai-12 is built** | flagged in the gai-12 recommendation |
| A6 unimplemented feature writes a roadmap advertisement into the knowledge store as retrievable prose | **low, keep the law** | the analogous beep branch fails instead of fabricating: `DocText.service.ts` returns `empty-text-layer` with `details: { outcome: "empty-text-layer", ocr: "disabled" }` rather than a placeholder section. Worth writing down as an ingest law before anyone adds an "OCR coming soon" note — beep's OCR is spec-deferred (`goals/file-processing-capability` P5 notes) |

---

## 3. Highest-value three, if only three land

1. **gai-10** (PDF glyph join + NFC-after-join) — the only finding that changes the
   quality of the substrate every span, quote, and claim in the epistemic spine rests on,
   and it gets more expensive to fix with every anchored document.
2. **gai-04** (enumerate every exit, one predicate) — arrives exactly when
   `goals/ingestion-secret-scrub` is specifying `safeForPrompt` for one exit out of six.
3. **gai-07 + gai-03** (summary nodes at a distinct level + per-source
   originate/corroborate rights) — the two mechanics
   `epistemic-memory-retention-projections` needs before it can be shaped.
