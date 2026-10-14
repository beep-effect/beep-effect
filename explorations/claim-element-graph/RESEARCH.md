# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## External Landscape (2026-10-14)

Method:
- A 57-agent literature sweep across eight facets plus two critic-driven gap rounds. Every
  candidate was fetched and checked before it was kept.
- 139 papers were read in full and checked: 128 from full text, 11 from abstract only. 138 were
  verified (24 core, 67 relevant, 47 peripheral). The 345 arXiv IDs already in the research
  library or the repo were excluded.
- 15 headline claims went through an adversarial refutation pass; 7 needed corrections, now
  applied.
- Full report: [research/SWEEP-2026-10-14.md](./research/SWEEP-2026-10-14.md).
- Every paper with its disposition: [research/CATALOG.md](./research/CATALOG.md).
- Anchor deep-dive: [research/ANCHOR-2610.01553.md](./research/ANCHOR-2610.01553.md).

### The anchor: invention graphs at IPRally

[arXiv 2610.01553](https://arxiv.org/abs/2610.01553) (ECML PKDD 2026 ADS) distils IPRally's
five-year-old spaCy+regex parser, which has processed 150M patents, into a biaffine neural parser.
- **Model.** An XLM-RoBERTa-Longformer encoder with local sliding-window biaffine attention. The
  local and global scorers share weights, so the parser trains on 600-word inputs and runs on
  documents of 40k+ words.
- **Output.** One "invention graph" per document: a part-of / example-of feature tree plus
  functional relations, forming a DAG.
- **Intrinsic quality.** 0.653 IoU, measured as agreement with the teacher parser (IoU@90 is
  0.142).
- **Retrieval.** Downstream Graph Transformer Recall@3 on 90,082 EPO-style X/Y citation queries:
  0.4163 → 0.4183 on claims and 0.3336 → 0.3373 on descriptions.
- **Lineage.** The Graph Transformer is [arXiv 2508.10496](https://arxiv.org/abs/2508.10496)
  (Recall@3 0.4046 against BM25's 0.1866), trained on about 31.7M examiner citations.

Release: [iprally/invention_graph_eval](https://github.com/iprally/invention_graph_eval), MIT. We
inspected it after acquisition:
- **Graph format.** Pydantic `Node{id,type,value,items}`. Relations are `value: [{ref}|{text}]`
  lists. The format has no edge-type field.
- **Metric.** Set IoU over untyped `(parent, child)` string pairs. Feature values are lowercased;
  relation strings are not.
- **Evaluation archive.** 5,000 claim-length documents (median 138 words). Country mix: 1,886 CN,
  874 JP, 677 US. The word-level targets are empty (every row has `parent=0`, `edge=none`), so the
  untyped JSON graph is the only gold. The text is not lemmatized: 95% of feature tokens appear
  verbatim.
- **Training sample.** 5,000 documents. Its word-level targets do carry typed labels: `meronym`,
  `hyponym`, `normal`, `reference`, `syntactic` and `none`.

Strength of evidence:
- The parser-over-parser retrieval gain is small (+0.2 / +0.37 points), with no confidence
  intervals.
- The intrinsic metric cannot detect a wrong edge type.
- The labels are EPO X/Y categories; no US-only recall is reported.
- The cost argument (LLM extraction is unaffordable at 150M documents) does not apply at a solo
  practice's volume.

Usable from it: the schema idea and the released teacher-labelled data, as a regression or
interop target.

### Deterministic claim structure

Rules for claim structure are old and they work:
- **Element trees from punctuation and transition words.**
  [FLAN-Graph, arXiv 2404.14372](https://arxiv.org/abs/2404.14372), MIT code. Dependent claims
  attach to an ancestor *element* through preamble identity.
- **Typed claim edges.** [PHAGE, arXiv 2605.10073](https://arxiv.org/abs/2605.10073) defines
  `r_cite` (claim reference), `r_term` (antecedent: `a/an` introduces a term, `the/said` refers
  back) and `r_func`, all built deterministically.
- **Pointer-based generation.** [SPG, arXiv 2607.24040](https://arxiv.org/abs/2607.24040) measures
  dependency-edge accuracy and antecedent consistency, and finds scale does not fix structure.
- **Formal claim DAG.** [arXiv 2604.18882](https://arxiv.org/abs/2604.18882) is a Lean 4 claim DAG
  with 7 limitation types and an explicit trust boundary between ML output and verified output.
  It verifies arithmetic only, on one synthetic claim.

No paper reports how accurately these rules build the tree on real US claims.

### US prosecution evaluation data

- **ACE.** [arXiv 2604.04295](https://arxiv.org/abs/2604.04295) tests a cost-efficient §112(b)
  cascade on 204 real §112(b) rejections. Of 69 missed cases, 38 (55.1%) are cross-claim
  dependency or nested antecedent chains (Table 4). Data has been promised but not released.
- **PEDANTIC.** [arXiv 2505.21342](https://arxiv.org/abs/2505.21342) (PatentSemTech 2025) covers
  US §112(b) reasons in CPC G06F40 only. Antecedent basis is 36.35% of 9,215 reasons. An LLM picks
  the right category for about 70% of reasons (19/27 on a 50-claim check). Recited phrases are
  re-anchored to the claim by fuzzy matching. The README declares MIT code and CC-BY 4.0 data.
- **PANORAMA.** [arXiv 2510.24774](https://arxiv.org/abs/2510.24774) (NeurIPS 2025 Datasets and
  Benchmarks) covers 8,143 US examination records. The first non-final rejection of each is parsed
  claim by claim with GPT-4o, and experts judged 92.5% of claims correctly parsed. Licensed
  CC BY-NC 4.0, so internal evaluation only. On the novelty/obviousness classification task
  (NOC4PC) the best macro-F1 is 45.40 against 32.33 for random.
- **FiNE-Patents.** [arXiv 2605.02392](https://arxiv.org/abs/2605.02392) (SIGIR 2026), MIT. It
  scores three sub-tasks: feature- and claim-level passage retrieval, novel-feature
  identification, and claim-level novelty. A hierarchical workflow that segments features first
  scores 53.7 F1 on novel-feature identification with a 30B model, against 44.7 for a single-step
  397B model. A claim-only BERT scores 75.2 overall and 0.0 on the adversarial subset.
- **Grounded Revision.** [arXiv 2609.36550](https://arxiv.org/abs/2609.36550) builds file-wrapper
  4-tuples: pre-claim, rejection, art, post-claim. It defines deterministic grounding checks C1
  (overlap with the rejected limitation) and C2 (edit locality). Exemplar retrieval did not
  improve grounding.
- **ToC.** [arXiv 2511.16972](https://arxiv.org/abs/2511.16972) (AAAI 2026) labels each element
  Disclosed / Not / Partially with an evidence quote and defines 10 typed amendment operations. Its
  metric is scored by the same LLM it evaluates. The repo has no license.

### Scoring structure strictly

- **MarkushGlyph.** [arXiv 2607.28532](https://arxiv.org/abs/2607.28532) compares a lenient
  per-feature scorer with strict single-bijection equality. Of 566 disagreements in 3,821 pairs,
  541 are lenient passes that strict scoring fails. Rankings were unchanged, but absolute scores
  fell.
- **By Their Fruits.** [arXiv 2605.25186](https://arxiv.org/abs/2605.25186) uses SAT to enumerate
  disagreements between independent formalizations of the same text, a check that needs no
  reference answer. A candidate admission check for two independent extractions.
- **Semantic preservation.** [arXiv 2608.12326](https://arxiv.org/abs/2608.12326) measures how much
  meaning an ontology loses: accuracy on the source text minus accuracy on the derived ontology.
  The loss falls mostly on modal and qualifier language ("configured to", "substantially", "at
  least one"). This is the argument for keeping verbatim spans on every element node.

### Out of scope here, routed to existing owners

These findings came from the same sweep. The owner named in [CATALOG.md](./research/CATALOG.md)
keeps execution scope.
- **Citation grounding.** Checking that a citation exists is not enough; it has to support the
  statement. Papers: [2405.20362](https://arxiv.org/abs/2405.20362),
  [2608.12571](https://arxiv.org/abs/2608.12571), [2609.17546](https://arxiv.org/abs/2609.17546),
  [2606.21155](https://arxiv.org/abs/2606.21155), [2607.03325](https://arxiv.org/abs/2607.03325).
  Owner: `explorations/citation-grounding-hallucination-guard`.
- **Neuro-symbolic "verified" status.** LLMs report solver verdicts they never computed, so a
  "verified" status needs proof the solver ran. Paper:
  [2606.16118](https://arxiv.org/abs/2606.16118). Owner: the `epistemic-*` goals.
- **Temporal validity.** Errors from applying the wrong version of a law are fixed by storage,
  not prompting. Papers: [2608.09393](https://arxiv.org/abs/2608.09393),
  [2608.14610](https://arxiv.org/abs/2608.14610). Owner: `goals/gov-legal-mcp` successors.
- **Judge guardrails.** Paper: [2609.02246](https://arxiv.org/abs/2609.02246). Owner:
  `goals/effect-native-legal-eval`.

## In-Repo Capability Inventory (2026-10-14)

| Brick | Package · path | What it gives this packet | Use |
| --- | --- | --- | --- |
| `PatentClaim` (independent/dependent tagged union) | `@beep/law-practice-domain` · `packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts` | `claimNumber`, `claimText`, `preamble`, `transition` (`PatentClaimTransition`), `body`, plus `claimReferences` for dependent claims. **`body` is one opaque `S.NonEmptyString`.** | extend (sibling projection) |
| `inspectPatentClaimDependencies` / `PatentClaimDependencyIssue` | same file | Typed diagnostics at the dependency level: `duplicate-claim-number`, `nonconsecutive-claim-number`, `missing-parent`, `self-reference`, `forward-reference`, `cycle`. The pattern to copy for element-level diagnostics. | reuse pattern |
| `PatentClaimCandidate` mapper | `@beep/law-practice-use-cases` · `packages/law-practice/use-cases/src/PatentClaimCandidate/PatentClaimCandidate.ts` | Aligns a whole claim to its source span (`claimEvidenceFrom`) and maps it into epistemic candidate entities. An element layer would align at element granularity. | extend |
| `TextAnchor` | `@beep/provenance` · `packages/foundation/modeling/provenance/src/TextAnchor.ts` | A half-open UTF-16 range `[startChar, endChar)` with an exact quote, whose width must match the quote. This is the char-exact span every element node should carry. | reuse |
| `CandidateClaim` | `@beep/epistemic-domain` · `packages/epistemic/domain/src/entities/CandidateClaim/CandidateClaim.model.ts` | The epistemic lifecycle for machine-produced assertions. Extracted elements would enter as candidates, not facts. | reuse |
| `Rejection` | `@beep/law-practice-domain` · `packages/law-practice/domain/src/entities/Rejection/Rejection.model.ts` | Statutory rejection per claim, with `RejectionGround` stored as JSONB. Has no element-level mapping. | extend (consumer) |
| `Distinction` / `DistinctionDetail` | `@beep/law-practice-domain` · `packages/law-practice/domain/src/entities/Distinction/` | Has a `TextAnchor` and a `detail`. The only detail kind is `missing_limitation`, with **free-text** `limitation`. It should reference an element. | extend (consumer) |
| `KgNodeKind` | `@beep/law-practice-domain` · `packages/law-practice/domain/src/values/KgNodeKind/KgNodeKind.model.ts` | Closed `LiteralKit`: `client`, `docket_family`, `docket`, `application`, `patent`, `document`, `email_archive`. **No claim or element kind.** | extend later |
| Drafting ledger `ClaimLimitationSupportSet` | `goals/patent-drafting-episode-ledger/SPEC.md` (lifecycle `paused`) | A support gate over *ordered claim limitations*. Nothing produces those limitations today. | first consumer |
| Office-action extraction | `goals/law-practice-office-action-extraction-rung` (`completed-retained`), `goals/oa-evidence-consumer-conformance` (`paused`) | Keeps exact correspondence, proposition support and human promotion separate. An element-mapping record must fit that split. | consumer |
| Prior routing gate | `explorations/research-corpus-synthesis/research/ROUTING.md` R2-062 | Re-entry requires "one actual OA claim-element/reference/raw-span consumer". This packet would supply it. | re-entry evidence |
| Research library | `docs/runbooks/research-library.md`; `bun run beep research library` | 21 sources for this packet acquired on 2026-10-14 (15 papers, 6 repos). Verify reports 0 missing and 0 integrity failures. | reuse |

NOT FOUND:
- a claim-element or limitation schema
- element-level spans
- an antecedent-basis checker
- a per-element prior-art mapping record (Disclosed / Not / Partially + pinpoint)
- an IPRally invention-graph adapter
- a strict structural graph-equality metric
- any US claim fixture labelled at element level

## Constraints Discovered (2026-10-14)

- **Licenses.** IPRally, FLAN-Graph and FiNE-Patents are MIT: patterns and code may be ported
  with attribution. PEDANTIC's README declares MIT code and CC-BY 4.0 data but there is no LICENSE
  file, so verify before porting code. PANORAMA is CC BY-NC 4.0: internal evaluation only, never
  shipped. ToC has no license: reference only.
- **Jurisdiction.** The anchor, FiNE, PaECTER and PatentMatch labels are EPO-style. The only
  US-native sets are PANORAMA, PEDANTIC, Grounded Revision, ACE and ClaimCompare. IPRally's eval
  set is 13.5% US.
- **Domain slices.** PEDANTIC covers G06F40 only, and the ToC corpus is wireless. Category
  distributions will differ in mechanical and chemical work.
- **Metrics.** Teacher-agreement IoU does not measure correctness, and untyped edges hide wrong
  relation types. Strict structural equality under one mapping is the defensible primary metric.
- **Missing measurement.** No paper measures the false-positive rate of a §112(b) or antecedent
  checker on *allowed* claims, or how accurately deterministic rules build the tree on US claims.
  Both need our own labelled set.
- **Prosecution vs litigation.** Prosecution uses broadest reasonable interpretation (BRI);
  claim-construction research is mostly litigation-oriented (Phillips).
