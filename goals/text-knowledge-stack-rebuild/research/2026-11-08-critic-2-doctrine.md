# Architecture-steward adversarial review

Read-only review of `text-knowledge-rebuild-report.md`, especially §§2, 4, 5, 7. Reader D §§8–9 were read before checking the owning standards and code. No repository edits, Git mutations, installs, or compute launches. Findings below refute unsupported conclusions; proposed changes are not current violations merely because they would need an explicit amendment. `INFERENCE` marks deductions. Evidence paths are repository-relative unless explicitly identified otherwise.

## Findings

### 1. A universal foundation claim state machine contradicts two active ownership rulings

**Severity: blocking.** **Attacked:** §4 L4: “Replace the seven status vocabularies … with one labelled transition system”; §9 says the 2026-10-21 split is “Not changed.”

**Evidence:** `standards/architecture/DECISIONS.md:2301-2314` expressly retains product entities and mechanism in the epistemic slice, retains `ClaimLifecycle` in shared/domain, and excludes `ExecutionVerdict` from epistemics. `standards/architecture/GLOSSARY.md:578-594` assigns outcome semantics to different owners and says vocabularies stay decentralized. `packages/shared/domain/README.md:121-131` records the lifecycle promotion and its two consumers. Moving their state/meaning into one foundation LTS is not merely implementing the glossary stems.

**Fix:** Keep owner-specific state machines and typed outcomes; introduce a generic transition combinator only if demonstrated reusable. If centralization is intentional, list the 10-21 ruling, lifecycle promotion, and verdict ownership law as explicit amendments, with consumer and persistence migrations. Remove the claim that the split stays unchanged.

### 2. Extraction-capability ownership of the proposition union breaks the slice-owned contract

**Severity: blocking.** **Attacked:** §4 L2: “`Claim<SameReferent | Typed | Related>` whose proposition union is owned by the extraction capability.”

**Evidence:** `standards/architecture/DECISIONS.md:2322-2326`: each slice owns its proposition union and instantiates `Claim<P>`. `standards/ARCHITECTURE.md:278-282,617-622` makes capabilities unreachable from slice domain. A slice domain importing the capability's union would violate that rule; duplicating it in every slice defeats the proposed shared union. This does not mean every neutral extraction DTO is prohibited: the contradiction is treating the capability's union as the authoritative domain proposition union.

**Fix:** Extraction returns neutral observations or generic proposals parameterized by caller schemas; the consuming slice maps those to its own proposition union. Keep genuinely neutral proposition building blocks in modeling if warranted, without importing capability definitions into domain.

### 3. The proposed foundation WorkKind puts legal product semantics back into foundation

**Severity: blocking.** **Attacked:** §4 L1 schema: `Work.kind: WorkKind /* application | officeAction | statute | ... */`.

**Evidence:** `standards/ARCHITECTURE.md:49-60,705-707` routes product language to its owning slice and forbids foundation dependence on slices/shared kernel. `standards/architecture/DECISIONS.md:2322` keeps legal roles in law-practice. The draft correctly attacks legal seeds in foundation and then sketches another legal closed domain there.

**Fix:** Make the Work schema generic over a caller-supplied kind schema or use a neutral term reference. Law-practice owns application/office-action/statute distinctions. A comment-only sketch still needs this correction before becoming the implementation contract.

### 4. “No codec between any two” overlooks production Web Annotation codecs

**Severity: major.** **Attacked:** §0: “six anchor encodings coexist with no codec between any two”; §2 D1's broad objects-without-morphisms diagnosis; §4 L2 “absorbs … the Web Annotation adapter.”

**Evidence:** `packages/foundation/modeling/rdf/src/Adapters/WebAnnotation.ts:358-369` implements a bidirectional `S.decodeTo` selector codec; `:492` is the target codec; `:577-588` is the evidence-anchor/annotation codec; `:412,441,687,716` export both conversion directions. `packages/foundation/modeling/rdf/src/Evidence.ts:204-206` already defines the selector union. `packages/foundation/modeling/epistemics/src/EvidenceSpan/EvidenceSpan.model.ts:16-21,90,171-182` reuses TextAnchor fields and constructs TextAnchor for comparison.

**Fix:** Narrow the verified gap to `provenance.TextAnchor`/source-identity integration with the RDF adapters. Extend/move existing codecs with a compatibility census; do not describe selector algebra or all anchor mappings as absent.

### 5. “No transition system” is factually false, and Absent already exists

**Severity: major.** **Attacked:** §2 D7: “Seven overlapping claim-status vocabularies have no transition system”; §4 L4 and §7 step 5 present the LTS/Absent as missing substrate.

**Evidence:** `packages/epistemic/use-cases/src/ClaimLifecycle/ClaimLifecycle.service.ts:121-129` implements `advance`: rejection is a no-op; admission moves candidate to shape_valid; illegal advance returns `ClaimInvalidTransition`. `packages/epistemic/use-cases/test/EpistemicUseCases.test.ts:77-119` exercises admission, rejection, illegal transition. `packages/shared/domain/src/values/ClaimLifecycle/ClaimLifecycle.model.ts:74-102` models transition records and explicitly reserves legality to the slice. `packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts:69-70,311-317` already has tagged `Present | Absent` for all five signals.

**Fix:** Say which transitions or cross-owner compositions are missing. Reuse the current absence encoding; scope the default-1 fix to the lab extraction boundary and default-0.9 fix to the office-action spike rather than implying the foundation envelope defaults absence to certainty.

### 6. Byte-identical migration is incompatible with the shown selector and identity changes

**Severity: blocking.** **Attacked:** §7 step 2: “keep `TextAnchor`'s encoding as the `Position{utf16}` selector so published anchors are byte-identical”; §7 preface allows “dual-write with a migration” in each retirement step.

**Evidence:** Current `TextAnchor` encodes `startChar/endChar/quote` (`packages/foundation/modeling/provenance/src/TextAnchor.ts:54-66,156`); the proposed selector encodes a tag, unit, start and end, inside a new envelope. Those bytes differ. `standards/architecture/11-evolution-and-deprecation.md:159-176` requires unchanged persisted/served bytes in an upstream retirement and sends irreproducible boundary changes to a separate migration goal; brands and meanings on promoted contracts matter too. `standards/architecture/DECISIONS.md:2347-2361` records the caller-schema factory contract and 258 byte-identical identifiers.

**Fix:** Specify explicit old-wire codecs and retain brands/schema identifiers where required. Separate semantic/persisted migrations from retirement PRs; dual-write is a separate migration design, not an exception silently granted by chapter 11.

### 7. The census threshold is misdescribed and package counts are not the required census

**Severity: major.** **Attacked:** §7: “a census is required before retiring anything with more than 100 consumers; `@beep/rdf` has 17 packages, `@beep/provenance` 15”; §4 L6 fixes schema-org retirement in advance.

**Evidence:** `standards/architecture/11-evolution-and-deprecation.md:121-147` requires consumed-facet coverage and the uncovered/covered consumer-line comparison for upstream-first dispositions; `:153-158` adds line/file-per-facet documentation for a RETIRE with >100 audited consumers; `:164-169` requires a semantic-loss decision regardless of count. Rule 4 is not a universal rule about all kinds of package retirement. Search hits are not audited consumers: the exact-boundary search below finds identity composer descriptions and tooling strings. Renaming NLP into local packages is not automatically an Effect-covered RETIRE.

**Fix:** Separate renames, local consolidation, unused-symbol removal, and upstream-covered retirement. Do per-facet decisions wherever upstream-first applies; do the extended census if >100 audited consumers. Never use number of workspaces as a substitute. Leave schema-org/NLP disposition open until all exported facets have homes or justified deletion.

### 8. Schema-org is more than the duplicate vocabulary table the draft would relocate

**Severity: major.** **Attacked:** §4 L0 “`schema-org`'s separate 4.8k-line vocabulary table”; §4 L6/§5 “retire into `rdf/Vocab` (zero consumers, duplicate table).”

**Evidence:** `packages/foundation/modeling/schema-org/src/index.ts:1-11,38-52` exposes typed graph construction, NodeRef, duplicate/conflict errors, escaped script-body serialization, and a separately loaded conformance entrypoint. These capabilities are not a namespace constant table. Raw `rg -l '@beep/schema-org' packages apps --type ts` yields 44 files; most are its own files, and the four external matches are tooling/composer references, not demonstrated live API imports.

**Fix:** “No external runtime consumers found” is supportable after classifying matches; “only a duplicate table” is not. Inventory the serializer, reference validation, schemas, conformance, and vocabulary facets independently, preserve or explicitly retire them, then decide whether rdf/Vocab is an appropriate home.

### 9. Foundation ontology already authors OWL/RDFS declarations

**Severity: major.** **Attacked:** §2 D5 “triple fold with no axioms”; §4 L3 “Not OWL authoring … those are the … slice, which keeps the name”; §5 renaming ontology to taxonomy by denotation.

**Evidence:** `packages/foundation/modeling/ontology/src/Fold.models.ts:155-164` permits arbitrary predicates and demonstrates `rdfs:subClassOf`/`owl:Thing`; `packages/foundation/modeling/ontology/src/Fold.projections.ts:349-359` emits OWL ObjectProperty/DatatypeProperty declarations with RDFS domain and range. `packages/foundation/modeling/ontology/README.md:7-23` deliberately distinguishes reusable foundation ontology/identity/alignment primitives from the editing workbench. Absence of a reasoner does not imply absence of ontology authoring.

**Fix:** Retain ontology for this broader public surface, or split the SKOS registry as taxonomy while routing the fold/schema-to-OWL facet explicitly. Do not infer a pure taxonomy package from only its seed loaders.

### 10. Naming and new role files are policy proposals, not consistency fixes

**Severity: minor.** **Attacked:** §5 “Small forks are resolved by consistency with what the code already does most”; `<Concept>/<Concept>.model.ts|.codec.ts|.laws.ts`; “Reserve fold for catamorphisms.”

**Evidence:** `standards/ARCHITECTURE.md:709-717` canonizes modeling `.schema.ts/.brand.ts/.codec.ts` and package-specific roles only when canonized; `:743-808` supplies the existing namespace-first schema convention. `packages/foundation/modeling/ontology/src/Fold.assembly.ts:855-893` already deliberately names an assembly fold and has an internal `assembleClass` (`:913`). `standards/architecture/08-testing.md:46-52` already defines schema-based law tests; `standards/effect-laws-v1.md:1-3,39-57` is an existing (different, lint-oriented) laws convention. No modeling `.laws.ts` files were found. `LogicalEdgeKey` is already explicitly a SHA-256 digest (`packages/foundation/modeling/epistemics/src/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:106-110`), so the Id/Ref/Digest/Key partition changes an existing semantic contract.

**Fix:** Keep `.schema.ts` by default and `.model.ts` where already canonized, or present a deliberate amendment and lint/docgen migration. Keep TextAnchor/VerifiedTextAnchor as the established source-pointing nouns unless a generalization needs a different name. `text`, `taxonomy`, `assemble`, and strict brand suffixes need semantic reasons and migration receipts; existing usage does not mandate them. Propose law-test discoverability first; a filename suffix alone adds no execution.

### 11. World and foundational alignment novelty must be scoped to implementation gaps

**Severity: minor.** **Attacked:** §4 L3/L4/L7 introductions of gUFO, SSSOM, stance and new laws; §5 entries said to be “today absent.”

**Evidence:** `rg -ni 'stance|World|conjectur' packages/foundation/modeling/epistemics/src` found only the ordinary-word “world” at `ValidInterval/ValidInterval.model.ts:78`: no current typed stance/world algebra was found. This part is a real addition. Unit tagging already exists at `packages/foundation/capability/langextract/src/VerifiedSpan/VerifiedSpan.model.ts:42-43,73`. gUFO and OntoUML guidance exists in `.claude/skills/_shared/foundational-analysis.md:4,23,94`; `.claude/skills/ontology-foundational-auditor/SKILL.md:139` already names gUFO/BFO grounding. UFO-L competency tests exist at `packages/law-practice/server/test/CompetencyQuestions.test.ts:854-866`. SSSOM workflows exist at `.claude/skills/ontology-mapper/SKILL.md:97-110,133-164`. No NIF prefix occurrence was found under rdf/src. Installed Effect has `Combiner.d.ts:1-8` and `Reducer.d.ts:1-6`; presence alone is not a coverage proof.

**Fix:** Credit these exact existing mechanisms and distinguish vocabulary/workflow/test prior art from missing runtime integration. Preserve the draft's acknowledgement of the mapper/auditor skills; strengthen it with the existing acceptance gate and legal tests rather than suggesting everything is newly introduced.

### 12. Projection data loss is real but the named-graph claim is overstated

**Severity: major.** **Attacked:** §2 D3: “serializes triples without their named graph (`…RdfProjectionLive.ts:66-118`)”.

**Evidence:** `apps/labs/semantica/src/layers/RdfProjectionLive.ts:63-68` constructs named quads. `:113-117` returns both the dataset and serialized quads. Only `serializedTriples` at `:118-122` drops graph. Query execution uses `build.dataset` at `:132-134`. The omission of evidence fields in `claimQuads` is independently supported.

**Fix:** State that the triple-only artifact loses graph while dataset/quads preserve it. Name the affected consumer/artifact before claiming named-graph information is lost from the live pipeline as a whole. Extend the citation through line 122.

### 13. Quote-first identity and expression identity do not satisfy the claimed invariance as written

**Severity: major.** **Attacked:** §4 L1 “`AnchorId` … hash(expression, quote, disambiguating context)” and “invariant under re-indexing between equivalent Expressions”; §4 L2 stable annotation ids.

**Evidence:** `packages/foundation/modeling/provenance/src/SourceTextIdentity.ts:136-145` distinguishes the exact raw-text digest from a locator normalization version; the proposed Expression is keyed by text digest. The citation engine intentionally includes source digest, text digest and range (`packages/law-practice/server/src/internal/Citation/MentionIdentity.ts:127-145`), not quote alone. **INFERENCE:** normalization that changes expression bytes changes that digest, so a hash including ExpressionRef changes; quote/context alone also needs an explicit collision/disambiguation policy for repeated passages. This is a contradiction in the sketch, not a measured hash collision.

**Fix:** Define equivalence and canonical expression identity precisely, distinguish reindexing on unchanged raw text from changing raw text, and test duplicate quotations. Retain occurrence identity unless a separately versioned migration proves the intended new equivalence.

### 14. Legal asset-pack relocation has a direct precedent, but must preserve its admission protocol

**Severity: major.** **Attacked:** §4 L3/§7 step 6 move seeds “to a law-practice asset pack” without specifying how loading remains legal.

**Evidence:** `packages/foundation/modeling/ontology/README.md:10-16,39-56` already directs vendor-specific mappings to owning asset packs/product slices and loads manifested pinned data. `packages/foundation/modeling/ontology/src/TaxonomyLoader.ts:99,233-256` models vetted concept-alignment rows; `SemanticFoundation.seed.ts:36-42` explicitly gates external alignments on admitted manifests. Stable seed IRIs are documented at `README.md:85-88`.

**Fix:** Follow that manifested/pinned asset precedent. The app or slice supplies legal assets to the generic loader; foundation must never import law-practice to retain default seeds. Preserve TTL/JSON-LD/TS IRIs and approval/provenance metadata. Product seed relocation is sound in principle; it does not justify a new reverse dependency.

### 15. The dependency list is legal but incomplete; the layer tower is not an architectural constraint

**Severity: minor.** **Attacked:** §7 “Dependency direction (all within foundation/modeling except the capabilities)” and §4 L0 canonicalization.

**Evidence:** `standards/ARCHITECTURE.md:617-622` allows rdf→text, md/pandoc/lexical→text, epistemics→annotation, taxonomy→rdf, and capability nlp-processing→taxonomy when their declared kinds remain as shown. `:353-360` prohibits symmetry-only packages, not these edges. The actual proposal additionally requires annotation→rdf (§4 L2 codec) and epistemics→rdf (§4 L4 nanopub), absent from the listed graph. `standards/ARCHITECTURE.md:197-206` and `identity/src/Id.ts:77` allow the shown /ns/ authority, but /ns/vN/ and /ns/id/ are new conventions, not mandated ones. **INFERENCE:** implementing graph canonicalization by importing the existing rdf-canonize driver into modeling identity would violate the kind rule and can create a cycle if identity imports rdf while rdf imports identity.

**Fix:** Show the complete compile-time dependency graph, account for canonicalization's actual implementation owner, and keep external-engine calls in capability/driver composition. Retain the authority/composer invariant. Justify annotation/folio by exported contracts and consumers rather than the number of conceptual layers. Do not claim the listed arrows themselves violate current law.

### 16. Each migration step hides a distinct ordering or compatibility obligation

**Severity: major.** **Attacked:** all eight §7 migration steps, each claimed to be “one goal packet.”

**Evidence and concrete fixes:**

| Step | Hidden cost / ordering error | Evidence and concrete correction |
| --- | --- | --- |
| 1 Doctrine | The amendment list omits the substantive reversal of lifecycle, proposition, and execution ownership; broad package count is also inconsistent (five modeling stated in §4, six named in §7; L0–L7 is eight conceptual layers). | `DECISIONS.md:2301-2326`, `GLOSSARY.md:588-594`. Resolve these explicit laws and correct the inventory before calling doctrine complete. |
| 2 Text | Anchored/Expression already require the L0 instance/hash/term concepts postponed to step 4; renaming affects imports and generated composers; selector wire fields differ from TextAnchor. | `identity/src/packages.ts:415-428`; `provenance/src/TextAnchor.ts:54-66`; `SourceTextIdentity.ts:125-145`. Stabilize identities/codecs before consumers migrate, or supply unchanged old contracts in step 2. |
| 3 Annotation | Extraction relations/entities are moved to L4 claims, but L4 lands only at step 5; langextract, wink and NLP-processing need coordinated contracts; no legitimate capability-owned domain union. | `langextract/src/Handoff/Handoff.behavior.ts:39-59,106-112`; `nlp/package.json:38-57`; `DECISIONS.md:2322-2326`. Land caller-owned proposal contracts first and migrate all producers/consumers in the same working wave. |
| 4 Registry | This occurs after two consumers that already use new identity primitives. Binding-table introduction must preserve existing module-derived IRIs rather than simply remint /vN/. | `identity/test/IriBinding.test.ts:55-74`; `test-runner/src/Vitest.errors.ts:21-24,149-152`. Front-load a stable mapping and test old schema IDs/IRIs, not just new term snapshots. |
| 5 Envelope | Shared lifecycle is promoted; ids are supplied by factories; org scope participates in hash identity; status consolidation and semiring/absence encodings change persisted meaning. | `shared/domain/README.md:121-131`; `epistemics/src/Claim/Claim.model.ts:276-317`; `LogicalEdgeIdentity.model.ts:269-297`. Preserve factories and bindings; version changed wire/identity semantics separately and keep owner machines. |
| 6 Taxonomy | Rename may discard existing OWL authoring facets; moving seeds changes default loader data/IRIs; FOLIO DTO relocation may not warrant an entire driver without exported behavior/contract. | `ontology/src/Fold.projections.ts:349-359`; `ontology/README.md:85-88`; `ARCHITECTURE.md:353-360`. Census fold and loader facets, inject manifested legal data, then route actual external API contracts to a generated driver package if justified. |
| 7 Operations/RDF | This is too late for the “first PR” upstream algebra census promised by §4 L5. Dataset list→set, Literal variants and blank-node equality affect codecs/order/tests; schema-org has additional facets. | `rdf/src/Rdf.ts:484-488`; `semantica/src/layers/RdfProjectionLive.ts:113-122`; `semantica/fixtures/gold/v1/g-projection.json:21,26`; `schema-org/src/index.ts:1-11,38-52`. Census first; preserve ordering/serialization or stage an explicit migration; update pinned IRI fixtures with compatibility evidence. |
| 8 Docs | `.laws.ts` is not currently a canonical role or guaranteed docgen/test input; replacing THEORY with generated LAWS loses explanations not derivable from test declarations. | `ARCHITECTURE.md:717,743-808`; `08-testing.md:46-52`; `nlp/THEORY.md:134-144`. Land discovery/execution/docgen support with its role amendment and keep a narrative theory document grounded in executable law links. |

### 17. Consumer counts materially understate the change surface and need reproducible classification

**Severity: major.** **Attacked:** §7/§9 “Fifteen and seventeen packages import provenance and rdf.”

**Evidence:** Read-only `rg -l '@beep/provenance' packages apps --type ts` returned 156 matching files; rdf 144; nlp 158; ontology 124; epistemics 92; schema-org 44. An exact package-boundary search (`@beep/<name>(?:["/])`) excluding each package's own folder returned respectively 150/95/53/10/60/4 external matching TS files across 18/19/9/2/13/3 nearest workspace roots. These are search-hit reach, **not audited import/consumer counts**: they include comments, examples, identity composers, CI entries and tooling tests. For example identity package composers (`identity/src/packages.ts:415-444,730-759,3054-3068`) and schema-org CI configuration (`tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts:603`) are matches without runtime consumption.

**Fix:** Report query, exclusions, files, workspaces, and actual import sites separately; census every consumed facet including exports and generated metadata. Do not compare the current 15/17 workspace estimates with chapter 11's >100 audited-consumer threshold. Account for manifests, locks, package registry, tests, docs and IRI fixtures beyond TS imports.

## Citation spot-checks

`off-by` means the cited line/range misses the substantive implementation by more than a few lines; `overstated` means the location exists but does not establish the full sentence. Abbreviations in the table: `modeling/` = `packages/foundation/modeling/`; `langextract/` = `packages/foundation/capability/langextract/`; `semantica/` = `apps/labs/semantica/`. Verdicts apply to the draft's associated claim, not just file existence.

| # | Draft citation / associated claim | Verdict | Actual evidence / correction |
| --- | --- | --- | --- |
| 1 | `modeling/provenance/src/VerifiedTextAnchor.ts:172-263,354` — unforgeable VerifiedTextAnchor | off-by | 172 is source verification input; 225–265 describe VerifiedSourceText; receipt at 354 is right. Anchor issuance is 396–401; genuine proof use/verification continues at 639–659. |
| 2 | `modeling/provenance/src/SourceTextIdentity.ts:125-145` — dual digest/pinned normalization | correct | All named fields present. WEMI identification is an interpretation, not existing WEMI classes. |
| 3 | `modeling/epistemics/src/Claim/Claim.model.ts:276` — parametric envelope | correct | Factory generic over proposition and caller id schemas at 276–291. |
| 4 | `Claim.model.ts:311` — five signals | correct | 311–317 has five signals, each already supporting Absent. |
| 5 | `law-practice/server/src/internal/Citation/MentionIdentity.ts:111-128` — all source fields hashed | overstated | Docs support it; actual fields continue at 131–145, beyond citation. Extend range. |
| 6 | `…/Citation/AuthorityIdentity.ts:126-169` — separate authority identity | correct | makeCitationAuthorityId at 145; preimage logic starts within range. |
| 7 | `langextract/src/VerifiedSpan/VerifiedSpan.behavior.ts:320-403` — unit conversion | correct | Split-surrogate check at 324–330, code-point loop 350–351, unit match 403–405. Extend to 405 for both branches. |
| 8 | `modeling/nlp/src/Graph/GraphOps.ts:30` — Effect Graph reuse | correct | Import of effect/Graph exists (also recorded by Reader D). |
| 9 | `modeling/ontology/src/Fold.models.ts:17-18` — imports only IRI and LanguageTag | overstated | Those are the RDF imports, not all imports; lines 15–24 also import identity/schema/Effect. Narrow wording to “only these RDF symbols.” |
| 10 | `modeling/provenance/src/TextAnchor.ts:156` — canonical class | correct | S.Class declaration exists; ordering/width checks are elsewhere in same file. |
| 11 | `modeling/rdf/src/Evidence.ts:78-122` — two selectors | correct | Quote class 78; Position class starts 122. |
| 12 | `modeling/epistemics/src/EvidenceSpan/EvidenceSpan.model.ts:147` — separate anchor encoding | overstated | Class exists, but uses TextAnchor fields/checks and explicitly wraps it; see 16–21,90,171–182. Not six wholly disconnected models. |
| 13 | `modeling/nlp/src/Handoff/Contract.ts:249` — Span | correct | SpanFields refinement at 249–252; natural fields 213–217. |
| 14 | `modeling/nlp/src/Graph/Schema.ts:358` — float offsets/no order | correct | S.Finite start/end and no ordering check at 358–364. |
| 15 | `party/domain/src/entities/Provenance/Provenance.model.ts:470` — EvidenceAnchor | overstated | Union exists; includes HeaderField, MetadataTag, RecordRow as well as TextSpan. Replacing all with text selectors needs non-text target support. |
| 16 | `standards/architecture/GLOSSARY.md:302` — TextAnchor canonical | correct | Explicit at 302–307. |
| 17 | `docs/PROSE_TO_PROOF_VISION.md:65` — other canonical span | correct | Vision names GroundedExtraction.span, as Reader D notes; vision is not a package import ruling. |
| 18 | `langextract/src/Handoff/Handoff.behavior.ts:39-111` — generated IDs/loss | correct | IDs 42,53,92; attributes/tier absent; relations at 111; version/source remain, source/text digests absent. |
| 19 | `semantica/src/layers/RdfProjectionLive.ts:66-118` — evidence loss/named graph lost | overstated | Evidence fields omitted; graph survives in dataset and serializedQuads at 113–117; only triple artifact drops graph at 118–122. |
| 20 | `semantica/src/layers/ExtractorLive.ts:238` — missing confidence 1 | correct | Function starts 238; default at 239. |
| 21 | `law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:90` — constant 0.9 | off-by | Function starts 90; constant is line 95. Describe as this evidence/spike path, not universal office-action assessment. |
| 22 | `law-practice/use-cases/src/DocketIntake/DocketReview.policy.ts:280` — absent attachment citation passes | correct | isUnverifiable 280; bypass in citedSpanExists 282–285. It is the citation-existence check, not every docket check. |
| 23 | `law-practice/use-cases/src/IrToLaw/IrToLaw.ports.ts:6` — stale reason | correct | Details starts 6, stale no-mentions assertion 8–14. |
| 24 | `modeling/nlp/src/Handoff/Contract.ts:514` — mentions now in envelope | correct | mentions field 518. |
| 25 | `modeling/identity/src/Id.ts:60-77` — code-path IRI | correct | Authority/composer example at 61–77; not evidence that every term must follow a file path forever. |
| 26 | `modeling/identity/test/IriBinding.test.ts:58-71` — Ontology.models/HttpUrl binding | correct | Literal expectation at 58–68; runtime at 71–74. |
| 27 | `tooling/test-kit/test-runner/src/Vitest.errors.ts:23-151` — old test-utils IRIs | correct | Explicit literals at 23,141,151. Qualify the package path because test-utils also has a Vitest.errors.ts. |
| 28 | `modeling/ontology/src/Vocabulary.seed.ts:22-104` — legal seeds | correct | Docketing 22; patent OA 71; MPEP 34,74,84,104. |
| 29 | `standards/architecture/DECISIONS.md:2322` — LegalRole ownership | correct | Explicit legal-role retention plus slice-owned proposition unions. |
| 30 | `modeling/epistemics/src/LogicalEdgeIdentity/LogicalEdgeIdentity.model.ts:82,120` — orgScope required | correct | Nonempty string field required. It does not import a shared OrgId; “tenant-free” vocabulary need not mean scope-free instances. |
| 31 | `modeling/nlp/THEORY.md:72` — dead TypeClass path | correct | Names src/Graph/TypeClass.ts; current graph folder has Schema/GraphOps/index, per Reader D verified directory inventory. |
| 32 | `modeling/nlp/THEORY.md:139` — confidence in NLP provenance | overstated | Text accurately says confidence; glossary 302–305 prohibits confidence on the provenance anchor, not every computation-lineage structure named Provenance. Naming ambiguity is real; a direct violation is unproven. |
| 33 | `modeling/nlp/THEORY.md:141` — deleted downstream owner | correct | Named initiative exists in text; Reader D reports absent packet and ROADMAP retirement. Universal property remains an unverified claim. |
| 34 | `standards/architecture/GLOSSARY.md:304` — no confidence | correct | Quoted substring at 304; exclusion is 305 (nearby). See row 32 for scope overstatement. |
| 35 | `standards/ARCHITECTURE.md:717` — canonical modeling roles | correct | Exact role table. Its drift does not automatically make the most common alternative canonical. |
| 36 | `modeling/ontology/src/Ontology.models.ts:242-311` — FOLIO DTOs | correct | HealthStatus starts 242; API DTO section exists. This is a relocation candidate, not proof a new package is necessary. |

## Disposition

Refuted as an implementation-ready architecture. Most individual proposed dependency edges are legal and several identified pipeline losses are real. The blocking defects are authoritative ownership changes presented as preservation, legal types newly embedded in foundation, and incompatible wire/identity changes presented as byte-identical retirement. Fix those before using package renames or layer counts as the migration plan. No code was changed.
