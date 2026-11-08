# G2. Legal evaluation validity: responsive authority and prosecution evidence

## Question

Cluster G2 of `goals/research-intake-2026-11/research/CONTRADICTIONS.md` asks
two things. First, do legal-research and legal-citation benchmarks measure
recall of responsive authority, or only overlap with the citations of one
opinion? The anchor case is arXiv 2605.10186 (LegalCiteBench) Cat1/Cat2.
Second, is there independent, measured evidence, not vendor marketing, that AI
tools in patent prosecution save time or raise allowance rates? Background:
2605.10186 scores against the citation list of one source opinion, and its
appendix concedes that unmatched authorities can be real and responsive.
Vendor pages such as DeepIP's prosecution product cite efficiency and
allowance gains with no study design.

## Method

- Process: the deep-research skill. Three researchers ran in parallel, one per
  lane:
  - a ground-truth audit of legal citation and retrieval benchmarks;
  - evaluation designs that grade responsive authority;
  - measured evidence for AI in patent prosecution.

  One report writer synthesized their notes.
- Sources: public web and academic sources only. These were arXiv full texts
  (HTML and PDF), the TREC Legal Track overviews, ACL Anthology, Federal
  Register text on govinfo.gov, law-school repositories, and vendor product
  pages, which were read only as sources of claims.
- alphaXiv tools were not available in the session, so arXiv was read
  directly. Several sources could not be fetched: SSRN returned 403, AIPLA is
  paywalled, and no copy of the Blair & Maron primary PDF was found.
- Date: 2026-11-07. Model: `claude-opus-5-5`.
- Confidence: items marked "secondhand", "unverified" or "snippet only" were
  not read in the primary text.

## Findings

### 2605.10186 scores overlap with one opinion and does not report its audit

- Ground truth is the source opinion's citation list. "Cat1 is therefore an
  opinion-anchored authority-recovery task". The corpus is 1,000 CAP opinions
  and 23,646 instances ([2605.10186](https://arxiv.org/html/2605.10186)).
- Scoring is citation-level F1. A GPT-4o-mini judge does case-insensitive
  substring matching. Its output JSON lists "matched citations, fabricated or
  unmatched citations, missed ground-truth citations". A real authority the
  court did not cite is therefore scored the same as a fabrication.
- MAR ("exceeding 94% for 20 of 21 evaluated models") is a low-overlap rate
  (s ≤ τ = 40). The authors call τ "a benchmark-specific low-overlap
  criterion". The best Cat1 score is 6.80 (claude-sonnet-4.5).
- The paper states its scope plainly: it evaluates "exact recovery relative to
  an opinion-anchored authority set rather than exhaustive legal research",
  and its reference sets "should not be interpreted as the only legally
  relevant authorities for open-ended research questions".
- Appendix C.1 designs a targeted audit of out-of-reference authorities. The
  audit has four categories, including "(iv) real and potentially relevant
  authority that is not part of the source-opinion reference set". The paper
  reports none of the following for it:
  - the number of authorities audited;
  - the sampling frame or the models sampled;
  - per-category counts or the category (iv) rate;
  - reviewer qualifications;
  - any inter-rater agreement (no kappa or agreement statistic appears
    anywhere).
- The only human-validation table covers construction fidelity: 100 root
  cases, 3 reviewers, about 2,100 examples, 90.5% pass. It checks
  transcription, not completeness.
- Reading: the "conservative" label holds for the recall denominator but not
  for precision. F1 is a lower bound on legal usefulness, and MAR is an upper
  bound on fabrication.

### Common-law benchmarks inherit citation-as-truth

- CLERC: the passage cited by the removed central citation is the only
  relevant item. Other cited cases that BM25 retrieves are labelled
  "distraction" ([2406.17186](https://arxiv.org/html/2406.17186)).
- LePaRD: the quoted passage is gold among about 3.9M candidates. One attorney
  checked 100 samples (99% supported); the check covers support, not
  exclusivity ([2311.09356](https://arxiv.org/html/2311.09356)).
- COLIEE Task 1: "In COLIEE, the cases cited are considered relevant"
  ([2310.17609](https://arxiv.org/abs/2310.17609)). IRLeD and AILA 2019 also
  derive labels from citations
  ([2404.00596](https://arxiv.org/html/2404.00596);
  [Zenodo 4063986](https://zenodo.org/record/4063986), secondary).
- CaseHOLD (closed five-way multiple choice), AusLaw citation prediction and
  SG-LegalCite (one gold case and 999 random negatives) all score against the
  court's own citation
  ([2104.08671](https://arxiv.org/html/2104.08671);
  [2412.06272](https://arxiv.org/html/2412.06272v2);
  [2605.21057](https://arxiv.org/html/2605.21057)).
- ECtHR-PCR names the problem directly: hard negatives may be "relevant
  documents that simply have not been cited (false negatives)". Human
  relevance evaluation is deferred
  ([2404.00596](https://arxiv.org/html/2404.00596)).
- Locke & Zuccon's survey: "Relevance assessments based on citations are not
  appropriate". Citations "may not be exhaustive", especially where courts
  are cautioned against cumulative citation
  ([2202.07209](https://arxiv.org/abs/2202.07209)).
- Expert answer-graded evaluations do not compute authority recall:
  - Magesh et al. hand-graded 202 queries for correctness and groundedness
    (κ 0.77 on 48 double-coded responses). Missed authority is discussed only
    qualitatively ([2405.20362](https://arxiv.org/html/2405.20362)).
  - VLAIR Legal Research uses "a minimum correct reference answer" and
    evaluator discretion to credit more complete answers. It concedes "an
    almost limitless number of potential sources" for some questions but
    publishes no credit rate and no evaluator agreement
    ([Vals](https://www.vals.ai/industry-reports/vlair-10-14-25)).
  - LegalBench-RAG uses expert span labels over contracts and privacy
    policies, not case law, with exactly one answering document per query
    ([2408.10343](https://arxiv.org/html/2408.10343)).

### No measured miss rate exists; the nearest analogue says it is large

- No legal benchmark found re-judges uncited authorities to measure how many
  responsive authorities the opinion's list omits. Both research lanes
  report this absence.
- Nearest measured analogue, Wikipedia news-citation recommendation
  (Fetahu): 11,803 system "false positives" were re-judged by crowd workers.
  38.2% were as good as the ground truth, and 19.4% were preferred over it
  (inter-worker agreement 64%). Precision rose by an average of 18%. Recall
  was not reported as "not feasible"
  ([1804.07583](https://arxiv.org/abs/1804.07583)). This is not legal
  authority, and the share is of system errors, not of the corpus.
- ACM-CR names "uncited, yet relevant papers" as future work and does not
  measure them ([2108.07571](https://arxiv.org/abs/2108.07571)).
- Mart 2017 (109 Law Libr. J. 387), secondhand: about 40% of cases were
  unique to one of six databases, and about 7% were returned by all six.
  Secondary sources disagree on some figures, and the tables were not checked
  ([Above the Law](https://abovethelaw.com/2017/07/legal-research-services-vary-widely-in-results-study-finds/);
  [LawNext](https://www.lawnext.com/2017/07/turns-legal-research-services-vary-widely-results.html)).
- Blair & Maron 1985 (CACM, [DOI 10.1145/3166.3197](https://doi.org/10.1145/3166.3197)),
  secondhand via Locke & Zuccon: users "thought they had retrieved at least
  75% of relevant documents, they had retrieved close to 20%". This is a
  discovery study, not case law. The primary text was not read.
- Expert labels are noisy too:
  - TREC Legal re-judging re-confirmed only 62–64% of relevant documents, and
    10–18% of non-relevant documents flipped to relevant
    ([TREC 2009 Legal Overview](https://trec-legal.umiacs.umd.edu/oldpage/LegalOverview09.pdf)).
  - LeCaRDv2 Overall Relevance κ = 0.5190 across three experts
    ([2310.17609](https://arxiv.org/abs/2310.17609)).

### Responsive-authority designs exist (TREC Legal, LeCaRDv2)

- TREC Legal Interactive, the components:
  - a Topic Authority (a senior lawyer) defines responsiveness;
  - documents are stratified by submission and sampled;
  - first-pass assessors judge the samples;
  - participants appeal to the Topic Authority, whose judgment is final.
- TREC Legal Interactive, the results:
  - every team's appeal success rate was at least 0.7, and ten exceeded 0.9;
  - recall and F1 are estimated over the collection;
  - in 2009, 5 of 24 runs reached recall of 0.7 or more;
  - the known gap is that confidence intervals reflect sampling error, not
    assessment error
    ([TREC 2009](https://trec-legal.umiacs.umd.edu/oldpage/LegalOverview09.pdf)).
- LeCaRDv2 is the only public legal case-retrieval dataset found with pooled,
  multi-annotator expert relevance and reported κ:
  - 800 queries and 55,192 candidates;
  - "a two-level candidate set pooling strategy" to depth 30;
  - aspect relevance (characterization, penalty, procedure).

  It covers Chinese criminal law, where courts do not cite
  ([2310.17609](https://arxiv.org/abs/2310.17609)). LeCaRD v1 is the
  predecessor.
- US collections with attorney judgments:
  - AIRS has few queries and "cannot be reliably used to evaluate methods
    that were not pooled";
  - the Turtle/Westlaw collections are internal
    ([2202.07209](https://arxiv.org/abs/2202.07209)).
- Metrics for incomplete judgments (secondary descriptions; primaries not
  read):
  - bpref ([DOI 10.1145/1008992.1009000](https://doi.org/10.1145/1008992.1009000));
  - infAP ([DOI 10.1007/s10115-007-0101-7](https://doi.org/10.1007/s10115-007-0101-7));
  - Sakai condensed-list AP′/nDCG′
    ([J-STAGE](https://www.jstage.jst.go.jp/article/imt/4/2/4_2_547/_article/-char/en)).
- LLM judge versus expert labels on LeCaRD, κ:
  - GPT-3.5: 0.67 legal facts, 0.62 material facts;
  - fine-tuned Qwen-2: 0.69 / 0.60;
  - Llama-2: 0.41 / 0.25.

  Chinese only ([2403.18405](https://arxiv.org/abs/2403.18405)).
  Counterpoint: LLM labels "still can't replace" human relevance assessment
  ([2412.17156](https://arxiv.org/abs/2412.17156), secondary).
- Grossman & Cormack 2011 (TAR versus manual review on TREC 2009 data,
  [Richmond JOLT](https://scholarship.richmond.edu/jolt/vol17/iss3/5/)):
  unverified. The full text was not retrieved, and the commonly repeated
  recall/precision figures should not be cited until checked against the
  paper.

### Patent prosecution: one drafting RCT, no allowance evidence

- Autor, Rodchenko, Martin, Iscenko, Strand, Pearl, Ferere (Oct 7, 2026,
  working paper, not peer reviewed;
  [MIT PDF](https://economics.mit.edu/sites/default/files/2026-10/Does%20AI%20Assistance%20Enhance%20or%20Erode%20Expertise%20Evidence%20from%20a%20Three-Month%20Field%20Experiment%20in%20Patent%20Drafting.pdf)).
  - Design: pre-registered (AEARCTR-0015823) RCT. 133 practicing patent
    lawyers at eleven US firms, randomized 2:1 and stratified by firm and
    experience. Blinded graders from an independent firm. 91 completed the
    protocol (32% attrition).
  - Time: "treated participants finished an estimated 10 minutes faster than
    controls (p = 0.05), against a control-group mean of 110 minutes", about
    9%. The 90-day estimate is the same size but p = 0.27. There was no time
    saving on unassisted redlining. The task was capped at two hours.
  - Quality: +0.34 SD (10 days) and +0.38 SD (90 days). Junior lawyers gained
    more.
  - Independence: "Funding for the direct costs of this experiment was
    provided by Google". Six of the seven authors are Google employees, all
    firms draft for Google, and the tool was an unreleased Google product.
  - Scope: benchmark drafting tasks only. There are no office actions,
    examiner responses or allowance outcomes.
- Schwarcz et al., "AI-Powered Lawyering" (127 law students, gains of
  34–140%): no patent task; the word "patent" does not appear in the paper
  ([Berkeley PDF](https://www.law.berkeley.edu/wp-content/uploads/archive/2025/12/AI-Powered-Lawyering.pdf)).
- Weaker designs:
  - Bombardier (SSRN 6873558): a single-practitioner case series of 75
    filings, about 4 h falling to about 2 h 20. Snippet only; SSRN returned
    403 ([SSRN](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=6873558)).
  - Pap2Pat: 8 of 15 attorney evaluations reported time savings. Snippet only
    ([2410.07009](https://arxiv.org/pdf/2410.07009)).
- Office-action response time: no disclosed study found.
- Allowance rate: no independent pre/post, difference-in-differences or RCT
  study found.
  - USPTO 89 FR 25609 says "Nor is there a general obligation to disclose to
    the USPTO the use of such tools", so USPTO data carry no AI-use flag
    ([govinfo](https://www.govinfo.gov/content/pkg/FR-2024-04-11/html/2024-07629.htm)).
  - Examiner-side tools (Similarity Search since September 2022, ASAP!) have
    no published outcome evaluation. ASAP! only plans to "collect data to
    inform next steps"
    ([90 FR 48161](https://www.govinfo.gov/content/pkg/FR-2025-10-08/html/2025-19493.htm)).
- Vendor claims (self-reported; none states a design, comparison group,
  sample or workload definition):
  - DeepIP: "Cut prosecution time in half and boost your allowance rates" and
    "One client saved approximately 555 attorney hours in a single quarter"
    ([DeepIP](https://www.deepip.ai/products/patent-prosecution)). Elsewhere
    DeepIP claims 40% and 70%, which contradict each other.
  - Solve: "up to 60–80% time savings"
    ([Solve](https://www.solveintelligence.com/blog/post/solve-intelligence-raises-40m-series-b-to-build-ai-for-patents-and-launches-charts)).
  - Rowan: "18% reduction in the number of Office Actions"
    ([Clarivate](https://clarivate.com/intellectual-property/ip-management-software/rowan-patents/)).
  - Juristat (2016, analytics rather than generative AI): +14.5 points,
    customers versus non-customers, with selection bias
    ([Juristat](https://blog.juristat.com/2016/6/9/update-juristat-usage-increased-customers-average-allowance-rate-by-15)).

## Verdict

Legal citation benchmarks measure overlap with the citations of one opinion,
not recall of responsive authority. 2605.10186 says so in its scope statement.
It scores uncited real authorities as errors, and it defines but does not
report the audit that would measure the gap. The same design runs through
CLERC, LePaRD, COLIEE, AILA, ECtHR-PCR, CaseHOLD, AusLaw and SG-LegalCite.

No legal source measures the miss rate. The nearest analogue (1804.07583)
found that 57.6% of the system's "false positives" were acceptable on
re-review. Expert labels are themselves noisy (κ about 0.52, re-confirmation
62–64%), so a single expert pass is not truth either.

Patent prosecution: the one methodologically disclosed RCT is Google-funded
and covers drafting only. It measured about a 9% time saving (p = 0.05 at 10
days, not significant at 90) and a larger quality gain. No study measures
office-action time or allowance. Vendor figures have no design behind them.

Still open:

- the category (iv) rate in 2605.10186's audit (the code or data release was
  not checked);
- a measured share of uncited-but-responsive authority on any common-law
  benchmark;
- the effect of AI on office-action responses and allowance;
- ASAP! outcome data.

## Implications

### goals/effect-native-legal-eval

- Grade responsive authority, not overlap with one opinion:
  - Pool candidates from many diverse systems (lexical, dense, citation-graph,
    and the opinion's own list) to about depth 30, following LeCaRDv2.
  - Have at least two lawyers judge each pooled item on a graded, aspect-wise
    scale, with a Topic-Authority adjudication step (TREC Legal).
  - Score with incomplete-judgment metrics (bpref, infAP, condensed-list
    nDCG′).
  - Estimate recall by stratified sampling of unpooled items. Never treat
    unjudged items as non-relevant.
- Keep citation overlap only as a secondary diagnostic. Report it alongside
  the share of retrieved items that are relevant but uncited.
- Separate "fabricated" from "real but unmatched". Never merge them into one
  field, as the 2605.10186 judge does.
- Report audit sample size, sampling frame, per-category counts, reviewer
  qualifications and inter-rater agreement (κ) for every human validation.
- Validate any LLM relevance judge against lawyer labels on a held-out slice
  before using it, and report κ. Legal judges reach about 0.6–0.7 against
  LeCaRD expert labels, which is Chinese-only evidence. Use the LLM judge as
  triage or an extra assessor, not as a replacement.
- Do not cite 2605.10186's MAR as a fabrication rate.

### goals/citation-extraction-engine

- Extraction accuracy (did we transcribe what the opinion cites?) and
  completeness (does the list cover responsive law?) are different claims.
  Validate only the first against the opinion's list.
- If an opinion's citation list is used as a retrieval label downstream,
  carry an explicit "opinion-anchored, non-exhaustive" flag, and expect
  false negatives (ECtHR-PCR, Locke & Zuccon).

### goals/uspto-prosecution-read

- Do not cite vendor time or allowance figures (DeepIP, Solve, Rowan,
  Juristat) as evidence. They have no design, comparison group or workload
  definition.
- The only independent prosecution-adjacent RCT is Autor et al. 2026. It is
  Google-funded and covers drafting only, with about a 9% time saving and
  about +0.35 SD quality. Cite it with those qualifiers, and note that it
  says nothing about office actions or allowance.
- Allowance-rate effects are unmeasured. One reason is that USPTO 89 FR 25609
  imposes no AI-use disclosure, so any measurement needs firm-recorded tool
  use and adjustment for examiner, art unit and claim strategy.
- Secondhand or unverified items: Blair & Maron (via Locke & Zuccon), Mart
  2017 (legal press), Grossman & Cormack (figures not retrieved), Bombardier
  (snippet only), Pap2Pat (snippet only). Do not cite their numbers as
  primary.
