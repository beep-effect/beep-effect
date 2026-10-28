# Process/provenance ontologies for gating AI-generated judgments: prior art

Scope: is "tier 3 judgment is probabilistic, but admissibility of the process that produced it is axiomatized over a provenance graph and checked deterministically" (BRIEF thesis 5) already a published design? What are the closest systems?

Source labels: **[fetched]** means I read the page or abstract this session. **[search]** means it comes from search-result snippets only. **[background]** means it comes from prior knowledge, with the canonical URL given but not re-read this session. Treat [background] items as needing a spot-check.

Bottom line up front: I found **no publication or product that states the whole design**: probabilistic content judgment, plus deterministic admissibility axioms over a PROV/BFO process graph, plus witnesses discharging obligations, plus findings fed back to the producing agent. The pieces exist in separate communities:
- PROV-O + SHACL compliance-over-provenance: Pandit's GDPR work, Ontological Knowledge Blocks 2026, OntoKG-EQ 2026.
- Process axioms over signed step records: in-toto layouts and SLSA, with attestation-gated promotion of LLM artifacts appearing in 2026.
- Evidence-type and assertion-method ontologies: ECO, SEPIO, OBI.
- Proof standards and burdens: Carneades, ASPIC+.
- Calibrated abstention and routing: conformal and selective prediction, Trust-or-Escalate, TypeSafe Jev.
- Heterogeneous judge panels: PoLL.

The in-toto analogy is the strongest structural match. Almost none of these systems close the loop back to a generating agent with located, repairable findings.

---

## 1. Does PROV-O + SHACL get used to validate that an AI output was produced by an admissible process?

### Takeaway
Partly. 2026 papers use PROV-O to link AI decisions to the artifacts and activities behind them, and SHACL (Core plus SHACL-SPARQL) to validate those evidence graphs against stackable "governance profiles". But they audit the AI system's governance record. They do not gate an individual judgment by checking that its producing process was admissible, and none feeds findings back to an agent. Compliance checking over PROV graphs with SHACL is established in GDPR work (Pandit). In-toto is the mature, deployed instance of "process axioms over a signed provenance graph, checked deterministically", and it is being applied to ML and LLM artifact promotion in 2026.

### Cited Findings
**PROV-O + SHACL for AI governance**
- *Ontological Knowledge Blocks: Executable Compliance and Profile-Based Validation for Trustworthy AI Systems* (Sharma & Kunkel, arXiv 2605.23297, May 2026; STPSA workshop @ IEEE COMPSAC 2026). [fetched, abstract only] — [arXiv](https://arxiv.org/abs/2605.23297)
  - Design: PROV-O links AI decisions to model artifacts and activities. A "deterministic regulatory compiler" turns structured IR records into KB modules with executable SHACL rules.
  - Validation runs under four governance profiles. The authors report "strictly additive violation accumulation" across 24 runs, SHACL latency of 12.6–100.3 ms, and the "Combined" profile as the most comprehensive.
  - The abstract does not mention BFO, gating of decisions, an agent feedback loop, or open- versus closed-world issues.
  - Relevance: the closest published match to BRIEF items 5 and 7. Profile monotonicity ("a stricter profile only adds findings") appears here as an empirical observation.
- *OntoKG-EQ* (Nasir et al., arXiv 2609.08869, Sep 2026). [fetched, abstract only] — [arXiv](https://arxiv.org/abs/2609.08869)
  - Design: a bounded ontology governed by five frozen competency questions. Graph structure is validated against "declarative shape constraints" before any answer. Answers are rendered deterministically and each carries an evidence and provenance bundle.
  - LLMs are measured, not gated: provenance coverage of eight open models' transcriptions ranged from 0.00 to 1.00.
  - A 17-person convenience panel reported higher perceived trust with the evidence bundle.
  - Relevance: a deterministic shape gate plus a per-result provenance bundle. No obligation or witness semantics.
- Pandit et al., GDPR compliance over provenance graphs. [search] — [TCD repository](https://www.tara.tcd.ie/bitstreams/1e0ba5b8-78a3-4558-b248-36961b75a8d7/download)
  - Design: compliance is checked against PROV-O-based activity records, the validation run itself is recorded in PROV-O, and results go into a separate graph.
  - Relevance: the closest prior pattern for "the check is itself a provenance node", which corresponds to the judge identity in the BRIEF's finding shape.
- A W3C DXWG mailing-list thread (2018) suggests modelling a SHACL validation as a `prov:Activity`, with shapes, data and report as `prov:Entity` and the validator as `prov:Agent`. It is an informal pattern, not a standard. [search] — [W3C list](https://lists.w3.org/Archives/Public/public-dxwg-wg/2018Oct/0222.html)
- *PROV-AGENT* (Souza et al., ORNL/Argonne, arXiv 2508.02866, IEEE e-Science 2025). [search] — [arXiv](https://arxiv.org/abs/2508.02866); [Flowcept schemas](https://flowcept.readthedocs.io/en/stable/schemas.html)
  - Design: extends W3C PROV with `AIAgent` (a subclass of `prov:Agent`). It captures prompts, responses and decisions through MCP and data observability, so agent interactions sit inside end-to-end workflow provenance.
  - Purpose: capture and traceability of error propagation across agents. There is no admissibility checking.
- *AIRO* (AI Risk Ontology; Golpayegani, Pandit, Lewis; SEMANTiCS 2022). [search] — [w3id.org/AIRO](https://w3id.org/AIRO); [IOS Press](https://ebooks.iospress.nl/pdf/doi/10.3233/SSW220008); [Golpayegani 2025 thesis, with VAIR](https://www.tara.tcd.ie/items/9004680d-4af5-4a0b-84fe-a40442db4b0d)
  - Design: encodes EU AI Act Annex III high-risk determination as rules over concept combinations. Evaluated on AIAAIC cases.
  - I could not confirm that the rules are SHACL.
  - Scope: it classifies systems. It does not gate individual outputs.

**Closed-world validation semantics (needed for obligation checking)**
- W3C PROV-CONSTRAINTS defines validity rules for PROV instances: event ordering (generation before usage before invalidation), uniqueness, and typing. It is a deterministic "is this provenance graph well-formed" check. It is not an admissibility policy. [background] — [W3C PROV-CONSTRAINTS](https://www.w3.org/TR/prov-constraints/)
- SHACL (W3C Rec 2017) validates a data graph as given, closed over the shapes' targets. `sh:closed` restricts properties. SHACL-SPARQL allows arbitrary constraints. [background] — [W3C SHACL](https://www.w3.org/TR/shacl/)
- Delva et al., "Data provenance for SHACL" (EDBT 2023) is cited in a reference list. I did not read it. [search]

**Supply-chain attestation: process axioms over a provenance graph**
- The in-toto layout is a signed policy and a direct analogue of a process axiom set. [fetched] — [in-toto spec](https://github.com/in-toto/docs/blob/master/in-toto-spec.md)
  - Steps: each `step` declares `pubkeys` (authorized functionaries, i.e. role bindings), a `threshold` (k-of-n signed link files, i.e. independent re-derivation), and `expected_materials` and `expected_products` artifact rules (`MATCH`, `ALLOW`, `DISALLOW`, `REQUIRE`, `CREATE`, `DELETE`, `MODIFY`).
  - `MATCH` ties a step's inputs by name and hash to a prior step's outputs. That is the ordering and dataflow axiom, the equivalent of PROV `used`/`wasGeneratedBy` chains.
  - `inspect` entries are commands the verifier runs itself at verification time. This is the analogue of re-checking "does the link resolve, is the quote present".
  - The layout carries `expires`. A mismatched `expected_command` only warns, because commands can be forged.
  - Verification order: root signature, expiry, keys, per-step links (recursing into sublayouts), artifact rules, then inspections.
  - Each rule list ends in an implicit `ALLOW *`, and the spec recommends ending lists with `DISALLOW *`. The default is open, closed only on opt-in: the same open/closed pitfall the BRIEF faces.
- SLSA provenance (in-toto attestation predicate `https://slsa.dev/provenance/v1`) records builder identity, build definition and resolved dependencies. Verifiers check them against expectations. [background] — [SLSA spec](https://slsa.dev/spec/v1.0/provenance)
- ML applications of in-toto and SLSA. [search]
  - Atlas (arXiv 2502.19567): proposes in-toto for end-to-end ML pipeline policies ("expected parties performed each step in the expected order"). Its CLI has in-toto and SLSA modules. — [arXiv](https://arxiv.org/html/2502.19567v1); [docs.rs atlas-cli](https://docs.rs/atlas-cli)
  - OpenSSF AI/ML security SIG: roadmap for model-lifecycle attestation validated against in-toto policies, with a policy engine slated for Q4 2026. — [GitHub issue](https://github.com/ossf/ai-ml-security/issues/40)
  - Tan, Singer, Anagnostopoulos 2026: claims about LLM artifacts are issued as in-toto attestation predicates, and an admission gate verifies signatures and provenance before allowing, quarantining or blocking the artifact. — [eprints.gla.ac.uk](https://eprints.gla.ac.uk/382828/2/382828.pdf); related [arXiv 2603.28988](https://arxiv.org/pdf/2603.28988)
  - Dell talk at OpenSSF Community Day EU 2026: attestation-gated MLOps promotion using IETF RATS, SLSA and Sigstore. — [sched](https://openssfcdeu2026.sched.com/event/2RA4B)

**Content credentials**
- C2PA manifests carry an actions assertion (`c2pa.actions` or `c2pa.actions.v2`). For AI output, `c2pa.created` takes IPTC `digitalSourceType` `trainedAlgorithmicMedia` (or `compositeWithTrainedAlgorithmicMedia` for edits) and a `softwareAgent`. Manifests are signed and the hash binding is verified deterministically. [search] — [C2PA 2.2 guidance](https://c2pa.org/specifications/specifications/2.2/guidance/Guidance.html); [CAI docs](https://opensource.contentauthenticity.org/docs/manifest/writing/assertions-actions); [IPTC DST](https://metawatch.iptc.org/dst/)
- C2PA verifies that a claim is signed and bound. It says nothing about whether the producing process was admissible. One secondary source claims a dedicated AI-disclosure assertion was added in C2PA 2.3/2.4. That is unverified. [search] — [ppc.land](https://ppc.land/c2pa/)

### Inferences
- **The in-toto analogy holds and is the best framing for the BRIEF.** Each clause of thesis 5 has an in-toto counterpart:

  | Thesis 5 clause | in-toto counterpart |
  | --- | --- |
  | Novelty obligation | Layout step |
  | Approved sources | `ALLOW` / `DISALLOW` artifact rules over the materials |
  | Link resolves, quote present in fetched content | `inspect` run by the verifier at verification time |
  | Reviewer on a different provider | `threshold` ≥ 2 with distinct `pubkeys`. In-toto checks distinct *keys*, not distinct *model providers*, so provider diversity needs a role or attribute check on the functionary. |
  | Human signed | A step whose `pubkeys` are human keys |
  | Witness | A signed link file |

  What in-toto lacks:
  - (a) an ontology of process types (BFO/PROV)
  - (b) numeric predicates over the content of an attestation, such as confidence ≥ τ. In-toto would need an inspection or a custom predicate plus an external policy engine; in practice that engine is OPA/Rego or CUE.
  - (c) feedback to the producer
- **No found work combines PROV/BFO typing, obligation and witness semantics, a calibrated-confidence threshold as one admissibility clause, and agent-facing repair findings.** As far as this search can tell, the novelty is in the combination and the loop, not in any primitive.
- **An admissibility check is only as strong as the attestation's authenticity.** A provenance graph the agent writes about itself is self-report. Ontological Knowledge Blocks and OntoKG-EQ do not address forgery. In-toto does, with signatures by functionary keys. The BRIEF's "re-derived by a reviewer on a different provider" clause is enforceable only if the reviewer's record is signed by an orchestrator the agent does not control. Otherwise the agent can emit a well-formed, SHACL-conformant graph that describes a process that never ran. This is process theater at the data layer.

### Gaps
- I read only the abstracts of 2605.23297 and 2609.08869. I could not verify whether their SHACL shapes check process-step ordering, role bindings, or just structure.
- I found no published SHACL shape library for PROV-O records of AI outputs, and nothing combining BFO 2020 occurrent typing (ISO/IEC 21838-2:2021, [background](https://www.iso.org/standard/74572.html)) with AI-output gating.
- Not found: EU AI Act or NIST AI RMF conformance tooling that encodes process requirements as machine-checkable SHACL or Rego over per-output provenance. EU AI Act Art. 12 (automatic logging) and Art. 14 (human oversight) create the obligations ([background, EUR-Lex 2024/1689](https://eur-lex.europa.eu/eli/reg/2024/1689/oj)). NIST AI RMF 1.0 and the GenAI profile (AI 600-1) are outcome-level, not checkable rules ([background](https://www.nist.gov/itl/ai-risk-management-framework)). Vendor GRC tools exist, but I did not verify any that do per-output provenance checks.
- Clinical and e-discovery chain of custody (TAR protocols, FDA PCCP) were not covered by this search.

---

## 2. How do calibrated-confidence systems report confidence separately from probability, and how is it used for routing to humans?

### Takeaway
There are three distinct notions, and they should not be conflated:
- **(a)** a per-option probability (calibrated or not)
- **(b)** a scalar "confidence" summarizing the concentration of the distribution (TypeSafe)
- **(c)** a guarantee about a *policy*: conformal set coverage, or a selective-risk bound at a chosen coverage (conformal, Trust-or-Escalate)

Only (c) gives a statistically valid basis for a deterministic routing threshold, and only under exchangeability with the calibration data. Routing to humans is implemented as abstain or escalate when the set is too large, or when confidence falls below a threshold calibrated to a user risk level.

### Cited Findings
- **TypeSafe docs.** [fetched] — [docs.typesafe.ai](https://docs.typesafe.ai)
  - `Choice` returns `choice`, `probabilities`, `confidence`.
  - `Score` returns `score`, `probabilities`, `confidence`.
  - `Noul` returns only `noul` (0–1).
  - The landing page does not define `confidence`; it points to a separate Confidence page I did not read. It claims models are trained "for calibrated decisions instead of generated text" and gives no metrics there.
- **TypeSafe secondary write-ups.** [search] — [eesel.ai](https://www.eesel.ai/blog/typesafe-jev); [noze.it](https://www.noze.it/en/insights/jev-system-one-typed-decisions/); [TrueFoundry](https://www.truefoundry.com/blog/typesafe-ai-jev)
  - `confidence` is a 0–1 measure of how concentrated the distribution is, not the top option's probability.
  - Training is "RLCD" (Reinforcement Learning for Calibrated Decisions), targeting calibration in aggregate (80% probability ≈ right 80% of the time) with no per-instance guarantee.
  - `Choice` supports up to 255 options.
  - Suggested tiers: > 0.9 act; 0.5–0.9 act with confirmation or review; < 0.5 abstain and route.
  - All of this is third-party. Some latency and benchmark claims there are vendor-reported.
- **Trust or Escalate** (Jung, Brahman, Choi; arXiv 2407.18370, ICLR 2025). [search] — [arXiv](https://arxiv.org/pdf/2407.18370)
  - An LLM judge abstains unless confident. The threshold is calibrated so that agreement with humans on non-abstained items meets a user-set risk level with high probability, and the method extends to cascades of judges ("cascaded selective evaluation").
  - This is the most direct prior art for "confidence-gated judge with a provable human-agreement guarantee".
- **Prune 'n Predict** (arXiv 2501.00555): conformal set size is the deferral signal, and large sets go to a human or a stronger model. Raising the set-size cutoff lowers deferral and moves accuracy toward the LLM's marginal accuracy. [search] — [arXiv](https://arxiv.org/pdf/2501.00555)
- **Learning Conformal Abstention Policies** (arXiv 2502.06884): RL-learned conformal thresholds, ≥ 90% coverage reported. [search] — [arXiv](https://www.arxiv.org/abs/2502.06884)
- **Entropy Alone is Insufficient for Safe Selective Prediction in LLMs** (arXiv 2603.21172): entropy ranking does not control hallucination rate among accepted answers, and its own threshold tuning does not claim conformal validity under shift. [search] — [arXiv](https://arxiv.org/pdf/2603.21172)
- **Background references.** [background]
  - Selective classification (Geifman & El-Yaniv 2017, "Selective Classification for Deep Neural Networks") frames the risk–coverage trade-off and certifies selective risk at a target coverage. — [arXiv 1705.08500](https://arxiv.org/abs/1705.08500)
  - Conformal prediction gives marginal coverage P(y ∈ C(x)) ≥ 1−α under exchangeability (Angelopoulos & Bates, "A Gentle Introduction to Conformal Prediction"). — [arXiv 2107.07511](https://arxiv.org/abs/2107.07511)
  - Conformal Risk Control (Angelopoulos et al., arXiv 2208.02814) generalizes the guarantee to monotone losses.
- **PoLL** (Verga et al., Cohere, arXiv 2404.18796, 2024). [search] — [arXiv](https://arxiv.org/abs/2404.18796)
  - A panel of three judges from disjoint families (Command R, Claude Haiku, GPT-3.5) has higher Cohen's κ with human judgments than a single GPT-4 judge, at about 7x lower cost.
  - Aggregation: max voting for binary QA, average pooling for 1–5 scores.
  - Model rankings change drastically depending on the judge (KILT-NQ).
  - It reports agreement with humans, not agreement between judges as a calibrated confidence.

### Inferences
- **For the BRIEF's "probability and a separate confidence":** TypeSafe's `confidence` is a property of the output distribution, i.e. uncertainty about the answer. It is not a statement about how reliable the judge is on this kind of question. A deterministic admissibility clause such as `confidence ≥ 0.9` is a sound gate only if the threshold was calibrated against labeled outcomes for *this domain* (e.g. office-action outcomes). Otherwise it is a number that looks like a guarantee. Conformal or Trust-or-Escalate calibration is the principled way to choose τ. Running it requires the ledger the BRIEF proposes (item 7).
- **"Agreement as confidence" in multi-provider panels is not calibrated by default.** PoLL validates against human κ. It does not show that panel agreement predicts correctness. Correlated errors across providers trained on overlapping web data are the risk: unanimous agreement can be confidently wrong. Trust-or-Escalate's cascade is the closest formal treatment of combining judges with a guarantee.
- **The clean split for thesis 5:** the *value* of the confidence is probabilistic. *Whether a confidence was produced by a registered, calibrated judge version and compared against the threshold registered for this obligation* is deterministic and checkable over provenance. That split is coherent. It moves the epistemic burden to the calibration record, which itself needs a provenance check (a calibration dataset hash and the date it was computed).

### Gaps
- I did not read TypeSafe's Confidence page, so the exact definition of `confidence` (entropy-based? margin?) is unverified beyond secondary sources.
- I did not verify whether conformal guarantees for LLM judges survive the distribution shift between public rejection records and a firm's own drafts. This is likely the binding practical limit.

---

## 3. What does the legal notion of admissibility of evidence contribute as a formal model?

### Takeaway
Legal AI formalized *proof standards and burdens* (Carneades; ASPIC+ extensions by Prakken & Sartor, and Calegari & Sartor). These give a per-issue acceptability predicate: a statement is acceptable if the arguments for it meet that issue's standard. This maps well onto obligations with configurable discharge standards. In biomedicine, ECO and SEPIO formalize *evidence type plus assertion method* (manual versus automatic) as provenance on assertions, which is the closest ontology to "judge identity on a finding". I found no formal ontology of *admissibility* in the evidentiary-law sense: gatekeeping before weighing, as in FRE 702/Daubert reliability factors or chain of custody. LKIF did not surface in the search.

### Cited Findings
- **Carneades** (Gordon, Prakken, Walton, *Artificial Intelligence* 171, 2007). [search] — [paper record](https://datalearner.com/academic/journal-papers/0004-3702/volumes-and-issues/320/paper-detail/68488); [CMNA06 PDF](https://cgi.csc.liv.ac.uk/~floriana/CMNA6/CMNA06Gordon.pdf)
  - Proof standards determine acceptability issue by issue, and each statement can carry its own standard.
  - Burden of production and burden of persuasion are modelled separately, each with its own responsible party and standard.
  - Premises are typed: ordinary premises, assumptions, exceptions.
- **Prakken & Sartor** critique Carneades' burdens and give an ASPIC+ formalization that distinguishes default from inverted burdens via a modified defeat relation. [search] — [JURIX 2011 PDF](https://webspace.science.uu.nl/~prakk101/pubs/jurix11.pdf); [Utrecht portal](https://research-portal.uu.nl/en/publications/on-modelling-burdens-and-standards-of-proof-in-structured-argumen/)
- **Calegari & Sartor 2021** cover burdens of persuasion in structured argumentation. A separate result shows Carneades always induces a unique Dung extension, which makes it deterministic once the arguments are fixed. [search] — [Unibo PDF](https://cris.unibo.it/bitstream/11585/836296/1/Clar2021-2.pdf); [Argument & Computation](https://content.iospress.com/articles/argument-and-computation/661766)
- A Fraunhofer FOKUS Carneades project (2012–2017) planned a language specifying which party bears the burden for an issue and the applicable proof standard. [search] — [Fraunhofer](https://www.fokus.fraunhofer.de/en/dps/projects/carneades)
- **ECO** (Evidence & Conclusion Ontology, OBO). [search] — [evidenceontology.org](https://evidenceontology.org/); [Chibucos et al., NAR 2019](https://pmc.ncbi.nlm.nih.gov/articles/PMC6323956)
  - Two root classes, `evidence` and `assertion method`. `manual assertion` versus `automatic assertion` records whether a human or a pipeline made the call.
  - The `used_in` relation links evidence to assertion method.
  - ECO evidence classes are treated as IAO `conclusion` information artifacts about the results of OBI `planned process`es. OBI added "drawing a conclusion based on data" (OBI:0000338).
- **SEPIO** (Scientific Evidence and Provenance Information Ontology) defines an assertion process as a planned process with an evidence line as input and an assertion as output. [search] — [SEPIO docs](https://akswnc7.informatik.uni-leipzig.de/dstreitmatter/archivo/purl.obolibrary.org/obo--sepio--owl/2023.07.02-162611/obo--sepio--owl_type=generatedDocu.html)
- **SR 11-7** (Fed/OCC 2011) model risk management. Pillars: sound development, *effective challenge* through independent validation (validators with authority and no reporting line to developers), and governance. It also requires a model inventory with validation status and risk tier, plus periodic re-validation scaled to risk. [search, secondary] — [VerifyWise summary](https://verifywise.ai/solutions/sr-11-7); [DeepInspect](https://www.deepinspect.ai/blog/banking-ai-model-risk-sr-11-7)
  - One source mentions a 2026 successor, "SR 26-2". Unverified. — [Risk.net](https://www.risk.net/node/7964118)

### Inferences
- **Carneades and ASPIC+ map to thesis 5:**
  - obligation → issue
  - discharge standard → proof standard (e.g. "preponderance" = panel majority plus confidence ≥ τ; "clear and convincing" = unanimity plus human sign-off)
  - witness → argument
  - burden assignment → which judge must produce

  Carneades already provides a deterministic acceptability computation (a unique extension) over probabilistic or weighted arguments. That is the formal precedent for "probabilistic content, deterministic acceptance".
- **Legal admissibility contributes the distinction between gatekeeping (admissibility: was this evidence produced reliably, is the chain intact?) and weighing (probative value).** That is exactly the BRIEF's process-versus-content split. Daubert's reliability factors are tested methodology, known error rate, peer review and general acceptance ([background](https://www.law.cornell.edu/rules/fre/rule_702)). A "known error rate" factor maps to "calibrated judge with a measured precision/recall". This is a strong analogy for the panel. I found no ontology that formalizes it.
- **SR 11-7's "effective challenge" is the regulatory precedent for "re-derived by a reviewer on a different provider".** Its lesson: regulators judge independence by authority and incentive, not by procedural form. A different model provider gives you vendor independence, not epistemic independence.
- ECO's manual/automatic assertion split is the minimal judge-identity typing. The BRIEF's single finding shape is richer, but ECO is the OBO-native vocabulary to align with.

### Gaps
- LKIF Core (ESTRELLA project, ~2008) has classes for legal roles, actions and norms. I could not confirm through search that it models evidence admissibility. [background: LKIF Core exists at github.com/RinkeHoekstra/lkif-core; admissibility coverage unknown]
- I found no formal ontology of chain of custody for digital evidence aligned with PROV, though many informal digital-forensics vocabularies exist (e.g. CASE/UCO, [background](https://caseontology.org/)). CASE/UCO is probably the closest digital-forensics provenance ontology and deserves a follow-up check.

---

## 4. Any work on "process theater" / Goodhart in process-compliance checklists for AI?

### Takeaway
Yes, but as governance critique, not as a formal treatment of provenance-axiom gaming. Named concepts: "AI audit-washing" (Goodman & Tréhu 2022), "checklist mentality" and "ethics washing", "proxy compliance" (2026), and decoupling of hard standards from purpose, linked to Goodhart. None addresses an AI agent optimizing against a machine-checked process axiom set. That is a gap and a risk for the BRIEF.

### Cited Findings
- Goodman & Tréhu, "AI Audit-Washing and Accountability" (GMF 2022; Santa Clara High Tech LJ). Without specification and independent auditors, auditing becomes audit-washing. They propose who/what/why/how questions. [search] — [SSRN](https://papers.ssrn.com/abstract=4227350); [GMF](https://www.gmfus.org/news/ai-audit-washing-and-accountability)
- arXiv 2403.07904 (EU AI audit ecosystem): hard standards and technical targets "can also lead to decoupling from the intended purpose", linked to Goodhart. [search] — [arXiv](https://arxiv.org/pdf/2403.07904)
- State of AI Ethics Report Vol. 6 (2022): "checklist mentality" leads to performative "ethics washing". [search] — [arXiv](https://arxiv.org/pdf/2202.07435)
- "Scaling, Lock-In, and Proxy Compliance" (arXiv 2607.28023, 2026): proxy compliance is an equilibrium in which observable signals are cheaper than real mitigation. It cites Raji et al. on abstraction traps. [search; arXiv id and date unverified] — [arXiv](https://arxiv.org/pdf/2607.28023)
- arXiv 2601.03087 cites Feffer et al. (2025): red teaming as "security theatre", with firms auditing only the metrics they do well on. [search] — [arXiv](https://arxiv.org/pdf/2601.03087)
- A vendor benchmark reports that open-world SHACL conformed on all 300 graphs containing fabricated terms, while a closed vocabulary check caught them. This is a single vendor measurement and should be treated as illustrative. [search] — [Tesseract Academy](https://gov.tesseract.academy/research/ontology-correctness-benchmark)

### Inferences
- **Process-theater failure modes specific to thesis 5:**
  1. A self-reported provenance graph: the agent writes a well-formed graph for a process that never ran. Fix with in-toto-style functionary signatures by an orchestrator outside the agent's control.
  2. Searching to satisfy the axiom: a search runs, cites approved domains, and finds quotes that exist but miss the closest art. The axiom checks the presence of process, not adequacy. The quote-present check is a *grounding* check, not a *relevance* check.
  3. Reviewer collusion by correlation: a second provider rubber-stamps because both share training priors.
  4. Threshold gaming: the producing agent rephrases until the classifier's confidence clears τ. Mitigation: the confidence must come from a judge invocation the producer cannot re-roll freely, with the attempt count recorded as provenance and a cap on attempts. Trust-or-Escalate-style guarantees break if the producer can resample the judge adaptively.
- These are standard Goodhart dynamics. In-toto's threat model (compromised functionaries, `threshold`) and SR 11-7's independence requirement are the existing countermeasures. Nobody has packaged them for agent loops.

### Gaps
- No empirical study found on LLM agents gaming machine-checked process or provenance requirements, as distinct from gaming reward models or unit tests, where reward-hacking literature exists.

---

## Cross-cutting: open-world (OWL) versus closed-world (SHACL) pitfalls for obligation checking

### Cited Findings
- OWL (DL, open world) treats missing facts as unknown, so it cannot flag a missing required property. SHACL treats the data graph as complete. arXiv 2309.02723 argues SHACL fits regulatory modelling better. [search] — [arXiv 2309.02723](https://arxiv.org/pdf/2309.02723)
- Combining SHACL with OWL entailment has no agreed semantics, and naive approaches go wrong with negation. The SHACL spec anticipates entailment but gives no guidance. arXiv 2507.12286 (2025) proposes semantics and rewriting. [search] — [arXiv 2507.12286](https://arxiv.org/html/2507.12286v1)
- SHACL is closed only over what its shapes target, so untargeted nodes and terms pass silently. [search] — [Off the Edge of the Map](https://ontologist.substack.com/p/off-the-edge-of-the-map) (viewpoint piece)
- In-toto has the same default: an implicit `ALLOW *` with `DISALLOW *` opt-in. [fetched] — [in-toto spec](https://github.com/in-toto/docs/blob/master/in-toto-spec.md)

### Inferences
- **Obligations must be SHACL (or Datalog or Rego), never OWL axioms.** For example, `NoveltyObligation ⊑ ∃dischargedBy.Witness` in OWL is *satisfied* by inference, because a reasoner invents an anonymous witness. It never fails. Use OWL only for vocabulary, classification and the term hierarchy (tier 2). Use SHACL for "must exist", "exactly k", "ordered before" and "attested by a key in role R".
- **Target coverage is the silent killer.** If the obligation shape targets `:NoveltyClaim` but the agent types its claim `:Claim` and never asserts the subclass, nothing fires. Mitigations:
  - a closed vocabulary check (`sh:closed`, or an allowed-class list)
  - an "every claim must be classified" shape
  - targeting by structural position (every claim node in the document), not by the asserted type
- **Entailment regime must be fixed and recorded.** Run SHACL over a materialized closure computed by a pinned reasoner version (e.g. RDFS/OWL RL via ROBOT). Otherwise the same graph validates differently across tools. The reasoner run is itself a provenance node.
- **Temporal order** (search before review before sign-off) is awkward in plain SHACL. Use SHACL-SPARQL over PROV `startedAtTime`/`endedAtTime`, or check it in a host-language validator. PROV-CONSTRAINTS already defines the ordering vocabulary.
- **Monotonicity:** a SHACL profile that only adds shapes is monotone in violations (2605.23297 reports this empirically). Profiles that relax a parent's shape, or that use `sh:not` or `sh:closed`, can break the "stricter profile only adds findings" claim. `sh:closed` in a child profile can add violations for properties the parent permitted. That is consistent with monotonicity, but a child that *removes* `sh:closed` is not.

## Closest-systems summary

| System | Vocabulary | What is checked | Deterministic? | Loop to AI agent? |
| --- | --- | --- | --- | --- |
| in-toto layout + links | Own JSON schema (steps, materials/products, keys) | Step presence, role keys, k-of-n threshold, dataflow by hash, verifier-run inspections, expiry | Yes | No (gates artifact promotion) |
| SLSA provenance | in-toto predicate | Builder identity, build params, deps vs policy | Yes | No |
| Attestation-gated LLM promotion (Tan et al. 2026; Atlas; OpenSSF SIG) | in-toto/SLSA/Sigstore | Signatures + provenance before allow/quarantine/block | Yes | No (artifact-level, not judgment-level) |
| Ontological Knowledge Blocks (2026) | PROV-O + RDF/OWL + SHACL | Governance evidence graphs under stackable profiles | Yes | Not stated |
| OntoKG-EQ (2026) | CQ-bounded custom ontology + shapes | Graph shape before answering, provenance bundles | Yes (LLM only measured) | No |
| Pandit GDPR compliance | PROV-O (+ GDPR vocab) + SHACL | Activity records vs legal requirements; validation recorded as PROV | Yes | No |
| PROV-AGENT (2025) | PROV + AIAgent | Capture only | n/a | No |
| C2PA | C2PA assertions + IPTC DST | Signature and hash binding of a claimed action history | Yes | No |
| ECO/SEPIO/OBI | OBO (BFO-aligned) | Evidence type + manual/automatic assertion method (annotation, not gating) | n/a | No |
| Carneades / ASPIC+ | Argument graphs | Acceptability per proof standard | Yes, given args | No |
| Trust or Escalate | n/a | Calibrated abstention with human-agreement guarantee | Statistical guarantee | Escalates to human |
| TypeSafe Jev | Typed Choice/Score/Noul | `probabilities` + `confidence` | No (model output) | Vendor guidance to route |
| PoLL | n/a | Panel vote / mean | No | No |

### Inferences (overall)
- The BRIEF's thesis 5 is best described as **"in-toto layouts generalized from build steps to epistemic steps, typed with PROV/BFO, with SHACL as the policy language, Carneades-style proof standards as the discharge semantics, conformal or Trust-or-Escalate calibration as the only numeric clause, and the verifier's findings returned to the producing agent."** Each component has precedent. I found no system that assembles them.
- The claim "tiers 3/4 become tier 1/2 checks over the provenance graph" is true only of *admissibility*. It must not be presented as making the *judgment* checkable. Legal doctrine separates admissibility from weight for exactly this reason.
