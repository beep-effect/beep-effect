# Domain rule oracles over documents: prior art (patent primary; regulatory, clinical, financial secondary)

Scope note: researched 2026-10-28 with ~18 tool calls. Items marked **[bg]** come from background knowledge with a canonical URL but were NOT re-fetched this session; treat them as likely-correct but unverified. Everything else was read in a search result or fetched page this session. Vendor capability claims are marketing unless stated otherwise.

Tier key (from the brief): **T1** formal (names, graph shape, counts, order), **T2** structural/ontology-linked (support, narrowing, vocabulary), **T3** substantive/judgment, **T4** behavioral prior.

## Which patent drafting products do antecedent-basis and support checks today, and how (regex, NLP, LLM)?

### Takeaway
Antecedent basis, claim dependency, and reference-numeral consistency (T1) are commodity features in Word add-ins (ClaimMaster, Patent Bots, DeepIP, Questel, Patlytics, Solve Intelligence). The older tools are rule/parse-based and located in Word; the newer AI platforms advertise LLM-based "support" (T2) checks on top. No vendor publishes precision/recall, and user reviews of the oldest rule-based tool report both false positives and false negatives on antecedent basis.

### Cited Findings
**Product matrix**

| Product | Checks claimed | Tiers | Located? | Mechanism | Rule authoring |
|---|---|---|---|---|---|
| ClaimMaster (Word add-in) | missing antecedent basis, lack of spec support, inconsistent part numbers, inconsistent claims, wrong amendment/status indicators, "dozens of other checks" | T1, shallow T2 (term string present in spec) | Yes, in Word; also HTML/PDF reports | Rule/parse-based proofreading; separate OpenAI-GPT drafting tools (define terms, rewrite, generate Background) | Vendor-coded; user-configurable options (unclear depth) |
| Patent Bots (Word add-in) | claim numbering, dependency, antecedent basis, support; USPTO-focused | T1, shallow T2 | Yes (Word) | Described as pre-filing QC, rule-style | Vendor-coded |
| DeepIP AI Reviewer (Word) | antecedent basis, dependency gaps, claim inconsistencies, clarity, vague phrases, missing drawing call-outs, unsupported spec references, §101 risk | T1, T2, some T3 (§101 risk) | Yes (Word) | AI (LLM) reviewer, mechanism not disclosed | Not disclosed |
| Solve Intelligence (Review) | "hundreds of customizable review criteria", "50+ checks" for applications: antecedent basis, spec support, invention-disclosure coverage, template compliance, jurisdiction-specific compliance | T1, T2, partial T3 | In-editor | LLM; vendor itself frames antecedent/numbering as what "rule-based tools" do and positions AI as going further on support | "Customizable criteria" (natural-language criteria, apparently) |
| Patlytics | undefined terms, inconsistent phrasing, missing support, antecedent basis, dependency errors | T1, T2 | Unclear | LLM | Not disclosed |
| Questel drafting copilot | antecedent basis check among drafting tools | T1 | Unclear | Not disclosed | Not disclosed |

- ClaimMaster feature list (antecedent basis, spec support, part numbers, amendments; Word-native; HTML/PDF reports; GPT drafting tools listed separately from proofreading) — [ClaimMaster home](https://www.patentclaimmaster.com/), [proofreading page](https://www.patentclaimmaster.com/proofreading.html)
- ClaimMaster user reviews: one says it "does not catch as many antecedent basis issues as I would like", another reports mostly false negatives on antecedent checks, another reports "several false positives from antecedent basis and drawing reference number checks", another prefers over-flagging; complaints about slow repeated parsing and "occasional ambiguity in parsing the claims" — [Capterra reviews](https://www.capterra.com/p/219252/ClaimMaster/reviews/)
- Patsnap's roundup says ClaimMaster's drafting layer can work with "your own hosted or local LLM", and describes Patent Bots, DeepIP, Solve, Patlytics feature sets — [Patsnap 2026 comparison](https://www.patsnap.com/resources/blog/articles/ai-patent-drafting-tools-compared-2026/)
- DeepIP AI Reviewer product page — [DeepIP](https://www.deepip.ai/products/ai-reviewer)
- Solve Intelligence review capability ("hundreds of customizable review criteria … antecedent basis and specification support to jurisdiction-specific compliance"; "50+ checks") — [Solve review](https://www.solveintelligence.com/capabilities/review), [Solve AI review blog](https://www.solveintelligence.com/blog-posts/ai-review)
- Patlytics description (vendor-sourced content) — [Lexology 2026](https://www.lexology.com/library/detail.aspx?g=c20b5896-16ed-406a-bf30-91326b3b4f4f)
- Questel antecedent basis check — [Questel drafting software](https://www.questel.com/patent/patent-preparation-patent-prosecution-process-copilots/patent-drafting-software-with-ai/)
- Rule-based antecedent check is itself patented: US 9,542,360 "Patent analyzer" describes verifying that "the"/"said" before an element was introduced with "a"/"an" — [USPTO PDF 9542360](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9542360); a related "Patent drafting system" patent US 9,990,351 also surfaced — [USPTO PDF 9990351](https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/9990351)
- Hobbyist agent tooling: a Claude Code skill "patent-claims-analyzer" checks antecedent basis/definiteness (finds terms used without introduction) — [skills.sh listing](https://www.skills.sh/robthepcguy/claude-patent-creator/patent-claims-analyzer)

**Academic work on automated claim analysis (§112(b))**
- PEDANTIC (arXiv 2505.21342; CEUR-WS Vol-4062): 14,536 claims (7,268 definite / 7,268 indefinite) from NLP applications (CPC G06F40, filed 2014+); labels extracted from first office actions via USPTO Open Data Portal / File Wrapper API using Gemma 3 27B into JSON (verbatim reason, category, claim recitations, fuzzy-matched into claim text). Category shares of 9,215 reasons: Undefined Term ~37%, **Antecedent Basis ~36%**, Relative Term ~10%, Functional Claiming ~9%, Contradicting Limitation ~5%, Omission of Essential Elements ~2%, Exemplary Phrasing ~1%. Human check of 50 claims: all binary labels correct; categories correct for 19/27 (noisy, esp. "undefined term"). Baselines: logistic regression 56.7% acc / 59.5 AUROC; Qwen 2.5 72B agent 55.3% / 56.8; ensemble 59.2% / 60.3 — [PEDANTIC v2](https://arxiv.org/html/2505.21342v2), [CEUR](https://ceur-ws.org/Vol-4062/paper3.pdf)
- ACE-40k / ACE-Real112b (arXiv 2604.04295): 40k synthetic claims plus 204 real USPTO §112(b) rejections; zero-shot Llama-3-8B scored 13.2%, Llama-3-70B 8.3% on the real set — [arXiv 2604.04295](https://arxiv.org/html/2604.04295)
- "Vibe Patenting" (Koike-Akino et al., arXiv 2609.13422, Sep 2026): LLM judge with 5 rubric dimensions (Prosecution Resilience, Claim Strength, Disclosure Strength, Figure Quality, Filing Readiness); claim rubric covers antecedent basis, dependency, clarity, consistency, per-limitation support; figure rubric covers reference numerals/orphan numerals. **No deterministic checker** — the judge is an LLM ("patent-qa" skill), each draft scored 5x and averaged. Attorney agreement overall Pearson r=0.717, Spearman 0.513, MAE 1.85, bias +1.85; per dimension r: Figure 0.825, Disclosure 0.624, Filing Readiness 0.207, Claim Strength 0.103, Prosecution Resilience 0.042 — [arXiv HTML](https://arxiv.org/html/2609.13422v2)

### Inferences
- T1 checks are a solved-ish commodity, but nobody publishes measured accuracy; ClaimMaster's mixed reviews suggest regex/parse approaches struggle with real claim language (plural/singular, "at least one", "the first X" vs "a X", means-plus-function, inherent antecedent basis such as "the outer surface" of an introduced sphere, which MPEP 2173.05(e) accepts **[bg]**). This is exactly where a fit-to-office-actions precision/recall step matters.
- PEDANTIC's finding that antecedent basis + undefined term are ~73% of §112(b) reasons supports the brief's choice of antecedent basis as the flagship T1 rule: it is high-volume in real rejections.
- Vibe Patenting's per-dimension correlations are the strongest evidence for the brief's tier split: LLM judges agree with attorneys on surface/figure checks (r 0.83) and essentially not at all on claim strength/prosecution resilience (r 0.04-0.10). The LLM-judgeable stuff is the T1/T2 material; T3 is where LLM judges fail.
- "Support" checks in incumbents appear to be string presence (ClaimMaster) or opaque LLM judgments (Solve/DeepIP). No product found that resolves claim terms to a vocabulary/ontology and reports a resolution path with rejected candidates (the brief's T2 shape).

### Gaps
- PatentOptimizer (LexisNexis IP), TurboPatent/RoboReview, Specifio, Rowan Patents, PatentPal, XLSCOUT: searches returned nothing usable this session. **[bg, unverified]** PatentOptimizer historically did antecedent-basis and part-number proofreading in Word; Rowan Patents markets structured drafting with live consistency checks; Specifio and PatentPal are generation-first. Confirm on vendor pages before citing.
- USPTO-side tooling: not researched successfully. **[bg, unverified]** USPTO Patent Center DOCX filing produces a validation/feedback document for format issues (T1 formal, not substantive), and in 2025 USPTO announced an AI pre-examination search pilot ("ASAP!"); neither checks antecedent basis as far as I know.
- No vendor discloses mechanism (regex vs dependency parse vs LLM) or any precision/recall figure.

## Does any product feed those checks back to an LLM drafting agent in a repair loop?

### Takeaway
I found no patent product that documents a closed loop where deterministic T1/T2 findings are fed back to an LLM drafting agent for span repair. The closest are (a) research loops with an LLM judge, not a deterministic oracle (Vibe Patenting), and (b) validator-in-the-loop repair in clinical FHIR and general agent work, which shows structured, located feedback beats raw messages.

### Cited Findings
- ClaimMaster has both proofreading checks and GPT drafting tools, but they are described as separate tools; no documented feedback path from checks into GPT — [ClaimMaster](https://www.patentclaimmaster.com/)
- Solve Intelligence says AI can help with "correcting antecedent basis issues" and that its Patent Copilot is "guard-railed to prevent errors and hallucinations"; it does not document the loop mechanics — [Solve automate drafting blog](https://solveintelligence.com/blog-posts/how-to-automate-patent-drafting-with-ai)
- Vibe Patenting loop: each round the drafting agent gets previous draft + structured QA report (scores, weaknesses, suggestions) + original technical context; control gets the draft only. Results through round 4: Instant 5.43 -> 6.71 with QA vs 6.33 generic; Extra-High 6.26 -> 7.18 vs 6.73. "Judge-guided revision consistently improves judge-assessed quality, while unguided revision tends to saturate." Improvement is measured by the same kind of judge that gave the feedback (Goodhart risk) — [arXiv 2609.13422](https://arxiv.org/html/2609.13422v2)
- FHIR: SG-LLM (arXiv 2601.05847) uses schema-constrained decoding plus the official HL7 FHIR R4 validator; on error, structured diagnostics are routed back as a repair prompt until valid or budget exhausted — [arXiv 2601.05847](https://arxiv.org/html/2601.05847)
- Closed-loop validation-repair for clinical schema compliance (arXiv 2607.24371): deterministic field-level validator, max 3 repair rounds; authors state the validator checks only format/enum/range, not terminology existence, full profile conformance, or clinical correctness — [arXiv 2607.24371](https://arxiv.org/html/2607.24371v1)
- VeriHarness / "Structured Feedback Improves Repair in an LLM Agent Loop" (arXiv 2607.14167): compares raw validator messages vs feedback naming failure location, observed value, admissible alternatives — [arXiv 2607.14167](https://arxiv.org/abs/2607.14167)
- "Is Three the Magic Number?" (arXiv 2607.05197) empirically studies repair-loop budgets — [arXiv 2607.05197](https://arxiv.org/pdf/2607.05197)
- Legal formalization as reward: "Closing the Loop: Formally Verified Law as a Reward Signal for Self-Improving Legal AI" (Heydari, Leowald; arXiv 2606.23913, Jun 2026) — LLM autoformalizes into a Catala-extended calculus, a verification kernel checks it, explanations come from proof traces; claims provable correctness for computational rules and "structural guarantees" (all argument stages covered, links valid) for open-ended analysis; abstract reports no quantitative results — [arXiv 2606.23913](https://arxiv.org/abs/2606.23913)
- LLM-to-Catala: NLLP 2025 benchmark (Lorenzo, Pietromatera, Holzenberger) reports 88.8% syntactically valid Catala with GPT-4.1 few-shot on French tax law; ICML 2026 multi-agent pipeline translates the German KStG into Catala, evaluated with unit tests and expert review — [ACL Anthology 2025.nllp-1.4](https://aclanthology.org/2025.nllp-1.4/), [ICML 2026](https://icml.cc/virtual/2026/80583)
- GDPR auto-formalization with agents and human verification (arXiv 2604.14607) notes existing GDPR formalizations are largely manual/expert-driven — [arXiv 2604.14607](https://arxiv.org/pdf/2604.14607)

### Inferences
- The brief's "agent repairs by span against a deterministic located oracle" loop is unoccupied in patent drafting as of Oct 2026, as far as public sources show. The commercial pattern is "LLM drafts, LLM reviews, human fixes", or a rule checker the human reads.
- VeriHarness's location/observed/admissible-alternatives shape is almost exactly the brief's T2 finding shape (span, resolution path, rejected candidates), and is independent evidence for it.
- The Heydari/Leowald paper is the closest published statement of the brief's tier-3-as-structure idea ("structural guarantees" over an argument's stages), but it is a position paper without measurements. Cite it as convergent, not as validation.

### Gaps
- Could not inspect DeepIP/Solve/Patlytics internals; an internal check->LLM loop may exist without documentation.
- No study found that measures span repair vs full regeneration on documents (as opposed to code).

## Which public datasets contain office actions with rejection reasons mapped to claim text?

### Takeaway
PEDANTIC is the only public corpus found with claim-level §112(b) labels, reason category (including antecedent basis), and examiner-cited recitations located in claim text. The USPTO OCE Office Action Research Dataset and its successor APIs give per-office-action rejection-type flags and claim-number arrays at scale, and can be joined to claim text (Google Patents Public Data, HUPD, PatentsView) to build more. HUPD has accept/reject decisions only, not reasons.

### Cited Findings
- **USPTO Office Action Research Dataset (OCE)**: derived from office actions issued by examiners; legacy beta covered 2008-01-01 to 2017-06-30 — [data.gov catalog](https://catalog-old.data.gov/dataset/office-action-rejection-api-beta-version-1); queryable in BigQuery as `patents-public-data.uspto_oce_office_actions.office_actions` with per-type rejection flags including 112 (per search summary) — [USPTO API catalog](https://developer.uspto.gov/api-catalog/uspto-office-action-rejection-api-will-be-migrated-odp)
- **USPTO Office Action Rejection API (v2, migrating to ODP data.uspto.gov)**: OAs mailed from 2018-06-01 to ~180 days before present, daily refresh; fields include `hasRej112` (application-level flag) and `claimNumberArrayDocument`; pyUSPTO models describe rejection-level records with legal section codes and claim arrays — [USPTO developer](https://developer.uspto.gov/api-catalog/uspto-office-action-rejection-api-will-be-migrated-odp), [pyUSPTO OA rejection models](https://pyuspto.readthedocs.io/en/latest/api/models/oa_rejections.html)
- 112 subsections are not reliably separated in USPTO structured data; Chien et al. (2020) used the Office Action Text Retrieval API plus keyword search to split them — [Patently-O 2020 study PDF](https://cdn.patentlyo.com/media/2020/11/PatentlyO-LJ-2020-11-02.pdf)
- **PEDANTIC**: see section 1; source USPTO ODP + File Wrapper API; claims, specs, first OAs; claim-level labels with category and fuzzy-located recitations; dataset/code "will be publicly released", license unstated — [arXiv 2505.21342v2](https://arxiv.org/html/2505.21342v2)
- **ACE-Real112b**: 204 real §112(b) rejections (small but real) — [arXiv 2604.04295](https://arxiv.org/html/2604.04295)
- **HUPD** (Suzgun et al., arXiv 2207.04043, NeurIPS 2023 D&B): ~4.5M utility applications filed 2004-2018, original applicant claims (pre-grant), abstracts, descriptions, and final decision (accepted/rejected); headline task is decision prediction from claims; on Hugging Face as `HUPD/hupd` and patentdataset.org — [arXiv 2207.04043](https://arxiv.org/abs/2207.04043v1), [NeurIPS poster](https://neurips.cc/virtual/2023/poster/73442)
- **PatentBench** (`rhahn/patentbench`, Apache-2.0): ~7.2k rows (300-row mini) of prosecution tasks incl. OA parsing and argument drafting for 101/102/103/112, with `rejection_types`, `claims_at_issue`, `mpep_sections`, scoring layers (`deterministic`, `llm_judge`, `comparative`); visible examples use fictional examiners and possibly invented citations — likely synthetic; provenance not stated — [Hugging Face](https://huggingface.co/datasets/rhahn/patentbench)
- **[bg]** PatentsView: granted patents (and pre-grant pubs) with claims tables and dependency fields, no office action text — [patentsview.org](https://patentsview.org/); Google Patents Public Data (BigQuery `patents-public-data.patents.publications`) has full claims text per publication — [Google Cloud blog/dataset](https://console.cloud.google.com/marketplace/product/google_patents_public_datasets/google-patents-public-data)
- **[bg]** Other label sources worth checking: USPTO Office Action Text Retrieval API and Office Action Citations API (ODP); PTAB ex parte appeal decisions (examiner rejection + board reasoning, affirm/reverse = a second-opinion label).

### Inferences
- Concrete recipe for fitting and scoring a T1 antecedent-basis rule: positives = PEDANTIC claims whose 112(b) category is Antecedent Basis, with the recitation span as the gold location; negatives = PEDANTIC definite claims. Score span-level precision/recall, not just claim-level. Caveats: PEDANTIC's negatives are "OA never mentions 112(b)" (examiners miss defects, so some "definite" claims are defective → measured precision is a lower bound); category labels are noisy (19/27).
- PEDANTIC's pipeline (ODP → File Wrapper → LLM extraction → fuzzy span location) is reproducible for other rejection classes and other CPC areas; that is the cheapest route to a domain-specific eval corpus for this repo.
- Low baselines on PEDANTIC (~55-60% acc/AUROC for LLMs) and ACE-Real112b (8-13%) show T1-ish definiteness is not "easy for LLMs". That argues for deterministic T1 checkers fit to these corpora, with LLMs used for candidate generation, not as the judge.
- Examiner behavior varies (art unit, examiner); OA-derived labels carry a T4 signal (gatekeeper prior), which the brief's T4 tier could fit directly from the same corpus.

### Gaps
- Did not confirm PEDANTIC's actual release (repo/license) as of Oct 2026.
- Did not confirm a codebook for claim-level 112(a)/(b) fields in the ODP rejection API.
- No public corpus found with labeled §112(a) written-description rejections mapped to claim terms and spec passages (the T2 support rule's natural eval set).

## What does Schematron/XBRL/CDA validation teach about authoring located document rules declaratively?

### Takeaway
These ecosystems have run declarative, located, versioned document oracles for 15-20 years: Schematron (assertions + XPath context + SVRL report with location + optional QuickFix), FHIR profiles (FHIRPath invariants, OperationOutcome with `expression` location), and XBRL (Formula assertions; DQC rules in the Xule DSL run by Arelle, shipped with pass/fail test filings per rule). The lessons that transfer: separate rule language from runner, report every finding in one machine-readable shape with a path into the document, version rulesets independently of the engine, ship pass/fail fixtures per rule, and move locations to a format-independent path language.

### Cited Findings
**FHIR / HL7**
- OperationOutcome `issue.location` (restricted XPath: element names and repetition only, no predicates, f:/h: prefixes; root = resource or bundle; each must resolve to a single node) is deprecated in R4 as "XML specific" and replaced by `issue.expression` (FHIRPath), "format independent, and simpler to parse" — [FHIR R4 OperationOutcome definitions](https://www.hl7.org/fhir/R4/operationoutcome-definitions.html), [DSTU2](https://www.hl7.org/fhir/DSTU2/operationoutcome.html), [FHIR chat on location vs expression](https://chat-archive.fhir.org/stream/179166-implementers/topic/OperationOutcome.20location.20vs.2E.20expression.html)
- **[bg]** FHIR profiles (StructureDefinition) carry cardinality, binding (terminology, i.e. T2), and FHIRPath invariants with severity; the HL7 Java validator returns OperationOutcome issues with severity, code, expression, message — [FHIR validation](https://www.hl7.org/fhir/validation.html). Terminology bindings make it a T1+T2 oracle (code must exist in a ValueSet/CodeSystem).
- **[bg]** HL7 CDA / C-CDA conformance is published as Schematron generated from implementation guides; validators (e.g. ONC/NIST-hosted) report failed assertions with XPath locations.

**Schematron [bg]**
- ISO/IEC 19757-3: `pattern/rule[@context]/assert|report[@test]` with XPath; output in SVRL with `failed-assert/@location` (XPath to node), `@role`/`@flag` for severity, `diagnostic` for evidence; abstract patterns and phases give parameterized, stackable rule sets (phases ≈ the brief's profiles) — [schematron.com](https://www.schematron.com/)
- Schematron QuickFix (SQF) attaches declarative fix proposals (add/delete/replace/stringReplace at nodes) to assertions; supported in Oxygen XML — [SQF spec](https://schematron-quickfix.github.io/sqf/publishing-snapshots/April2015Draft/spec/SQFSpec.html). This is the closest standard to the brief's "error with span and mechanical fix".

**XBRL / SEC**
- XBRL US DQC rules are written in **Xule** (an XBRL rule language), compiled, and run by an Arelle plugin (`arelleCmdLine --plugin validate/DQC`) that returns validation messages; rulesets are versioned and swapped via a ruleset map without reinstalling the plugin; repo ships a test suite of pass and fail filings for each rule; rules go through public review before approval — [dqc_us_rules usage](https://github.com/DataQualityCommittee/dqc_us_rules/blob/master/usage_command_prompt.md), [ruleset usage](https://github.com/DataQualityCommittee/dqc_us_rules/blob/v21.0.0/usage_rulesets.md), [tests](https://github.com/DataQualityCommittee/dqc_us_rules/blob/v22.0.0RC1/tests), [XBRL US public review](https://xbrl.us/news/dqc-ruleset11-public-review/)
- XBRL International publicized "99 data rules, free for use in software tools" (DQC) — [xbrl.org](https://www.xbrl.org/?p=12554); XBRL US offers a hosted "check filing" service — [xbrl.us/check-filing](https://xbrl.us/check-filing)
- **[bg]** XBRL Formula 1.0 (value, existence, consistency assertions over facts, dimensional filters) is the standards-track declarative layer; Arelle (open source) implements Formula plus the SEC EDGAR Filer Manual (EFM) validations, and SEC's EDGAR Renderer is Arelle-based — [arelle.org](https://arelle.org/), [XBRL Formula spec](https://specifications.xbrl.org/work-product-index-formula-formula-1.0.html). Findings locate a fact/context (by id, element, and source line), which maps to a document span in Inline XBRL.

**Rules-as-code / legal formalization (summary)**
- Catala: default-logic language for statutes (tax/benefits), literate style interleaving law text and code, compiles to several targets; LLM translation benchmarks above — [catala-lang.org](https://catala-lang.org/) **[bg]**, [NLLP 2025](https://aclanthology.org/2025.nllp-1.4/). Tiers: computes outcomes (T1-ish over facts), not a document checker.
- DAPRECO: GDPR knowledge base in LegalRuleML, built on the PrOnto ontology, if-then rules in reified I/O logic — per search summary of Robaldo et al. — [ACL Anthology, Livio Robaldo](https://aclanthology.org/people/livio-robaldo/unverified/). T2 (ontology-linked) normative rules; no located document findings.
- **[bg]** LegalRuleML (OASIS) = rule/deontic layer; Akoma Ntoso / LegalDocML (OASIS) = structural XML for legislative and judicial documents (gives stable element ids/eIds that rules can anchor to); OpenFisca = Python tax-benefit engine with YAML test cases; Blawx = visual block editor over s(CASP) answer-set Prolog that returns human-readable justification trees; Stanford CodeX = computational law research center (Logic-based, Genesereth). None of these checks a draft document and returns located findings; they formalize the law and evaluate facts.
- **[bg]** Drools / DMN decision tables are used for regulatory compliance decisions over structured records (KYC, claims), deterministic, authored as spreadsheets/DMN; not span-located.

**Other domains [bg, low confidence]**
- NIH ASSIST/Grants.gov: pre-submission validation of SF424 R&R form packages producing errors (block submission) and warnings, then eRA Commons post-submission validations; errors reference form/field, not prose spans; rules authored by NIH in its system, published as a validation list — [NIH validations](https://grants.nih.gov/grants/how-to-apply-application-guide/due-dates-and-submission-policies/validations.htm) (URL not verified this session).
- Safety data sheets (GHS/REACH): I found no well-known open, located SDS checker; commercial SDS authoring tools (e.g. phrase-library based) enforce section structure and approved phrase codes. Treat as gap.

### Inferences
- **Locations should be format-independent paths into the model, not byte offsets alone.** FHIR's move from XPath `location` to FHIRPath `expression` is the same lesson as the brief's fingerprinted source map: store a semantic path into the hub model and project to bytes per notation, returning none when stale.
- **Phases/profiles compose in practice but not purely monotonically.** Schematron phases and FHIR profile derivation both narrow; FHIR profiles can also slice and fix values, which changes how parent findings read. Evidence that "stricter profile only adds findings" is a reasonable default, but profile derivation in FHIR is also the source of most validator ambiguity **[bg]**.
- **Ship fixtures per rule and version rulesets separately from the engine** (DQC pattern). This is the operational form of the brief's "fit and score before agents see it": every rule carries pass/fail exemplars; office-action-derived corpora play the role DQC's test filings play.
- **Declarative fixes exist (SQF)** but are XML-node edits; the brief's span-splice repair is the text-notation analogue. Nobody in these ecosystems feeds validator output to an LLM except the 2026 FHIR papers.
- **None of these standards carries confidence or judge identity.** SVRL/OperationOutcome/Arelle messages are deterministic-only (severity, code, location, message). The brief's single finding shape (adds evidence, judge, confidence) generalizes them; OperationOutcome's `issue.code` + `details` (CodeableConcept) + `expression` is a good minimum to align with.
- All four domains are T1 + T2 (terminology/taxonomy binding) oracles; none reaches T3. XBRL's taxonomy-anchored rules (DQC checks values against the US-GAAP taxonomy relationships) are the clearest existing example of a deterministic T2 oracle over an ontology, and the best analogue for "claim term must resolve in the spec vocabulary".

### Gaps
- Did not fetch Schematron/SQF, Arelle, XBRL Formula, FHIR validation, NIH ASSIST, Akoma Ntoso, OpenFisca, Blawx pages this session; marked [bg].
- No source found exposing Schematron, XBRL/Arelle, or Catala checks to an LLM agent as a repair loop (searches returned only FHIR examples).
- No measured precision/recall for any DQC or Schematron ruleset against real downstream rejections (SEC comment letters would be the XBRL analogue of office actions; not researched).
