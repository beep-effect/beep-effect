Model: claude-opus-5-5 (Claude Opus 5.5), medium effort, panel member.

# Review: a typechecker for agent work product

I read the brief and spot-checked it against the repo. Most of its claims about the code are true. The fold reports 20 loss reasons (`MdLossReason` in `packages/foundation/modeling/md/src/Md.syntax.ts`). The source map carries subtree fingerprints. `BlockRepair.ts` runs two JSON Patch repair attempts over failing block slices. Two facts in the repo cut against the brief, though, and I come back to both below:

- **There is no single finding shape yet.** I count at least five diagnostic types: `MarkdownDiagnostic`, `HtmlConformanceIssue`/`HtmlConformanceError`, `MarkdownConformanceError`, `MdLoss`, and `ClaimGateSeverity` in `@beep/epistemics`. Thesis point 6 is a goal, not something the code already has.
- **Process-gating primitives already exist, and the brief leaves them out.** `@beep/epistemics` has `ClaimGate`, `EvidenceSpan` and `EvidenceVerification`. `@beep/provenance` has `VerifiedTextAnchor`, which fails closed on `quote-mismatch`. These are the start of thesis point 5's deterministic sub-checks.

## 1. Has anyone built this?

Nobody has built the whole stack as one product, as far as I know. Each layer has strong prior art, and some of it is closer than the brief admits.

**(a) Positioned diagnostics for a notation: solved, with standards.**
- **SARIF** (OASIS Static Analysis Results Interchange Format 2.1.0) is the closest existing thing to thesis point 6. Its `result` carries location, `ruleId`, `level`, `rank`, `fixes`, `suppressions` and a `kind` field. The `kind` values are `pass`, `fail`, `review`, `open`, `notApplicable` and `informational`. `review` and `open` are exactly "obligation without witness". Adopt or map to SARIF before inventing a shape.
- **unified/vfile** (`vfile-message` in remark-lint, retext, rehype) already gives one message shape for every plugin over Markdown and HTML: place, `ruleId`, `source`, `fatal`, `expected`.
- **Vale** is a prose linter whose stackable "styles" are almost exactly thesis profiles. textlint and proselint are smaller versions of the same idea. LSP diagnostics are the delivery format.

**(b) Typed admission of LLM output with repair: crowded.**
- **BAML's Schema-Aligned Parsing** is the "write as fast as a raw string, parse leniently into types" claim, shipped. Unlike this thesis, it repairs in the parser rather than asking the model again.
- **TypeChat** (Microsoft) uses the TypeScript checker's diagnostics as the repair prompt. That is the "compiler errors back to the model" loop for structured output.
- Other entries: Guardrails AI (validators with `reask`/`fix`), Instructor and pydantic-ai `ModelRetry`, DSPy Assertions (Singhvi et al. 2023, `Assert`/`Suggest` with backtracking), and constrained decoding (Outlines, Guidance, LMQL, XGrammar).
- **SWE-agent** (Yang et al. 2024) is the strongest empirical support for the brief. Its agent-computer interface rejected edits that failed a linter, showing the located error, and that measurably improved solve rates.
- **Aider's edit-format benchmarks** are the best public evidence on span repair versus regeneration. Search/replace blocks beat whole-file rewrites for strong models on large files and lose for weak models.

**(c) Domain rule oracles for documents: exists, including for patents.**
- **ClaimMaster** is a commercial Word add-in that checks antecedent basis, claim dependency and reference numerals against the specification and drawings. That is most of tier 1 for patents, already shipped. LexisNexis PatentOptimizer and Patent Bots do similar work. AI drafting products such as Solve Intelligence and DeepIP are moving onto the same ground. The tier 1 checker is not novel. The loop and the ledger might be.
- **ISO Schematron** gives located assertion reports over XML documents, with phases that act like profiles. **FHIR profiles plus the FHIR validator** are stackable, constrain-only profiles. Their design rule ("a profile may only constrain its base") is the monotonicity claim in practice.
- **XBRL** filings have validation rule sets: US GAAP calculation rules and the XBRL US Data Quality Committee rules. In clinical work there are CQL and Arden Syntax. In law there are Catala, LegalRuleML (which has defeasibility built in) and Akoma Ntoso. Governatori's Regorous compliance checker works in the same space.

**(d) Process and provenance ontologies that gate output: the strongest analogue is software supply chain, not AI.**
- **in-toto layouts, SLSA, Sigstore and OPA/Rego admission policies** do thesis point 5 exactly. An artifact is admissible only if signed attestations show that named functionaries ran specified steps, with approved materials, in order. Their known lesson is directly relevant: provenance proves the process ran, not that the output is good.
- Also relevant: **PROV-O**, **C2PA** content credentials, 21 CFR Part 11 and GxP computerized-system validation, and nanopublications with trusty URIs.
- I know of no system that gates LLM judgments by a PROV graph. I am fairly confident about that, but not certain.

**(e) Declarative DSLs whose rule ASTs project to OWL/SHACL: LinkML exists and the brief does not mention it.**
- **LinkML** is a YAML schema DSL with generators for OWL, SHACL, ShEx, JSON Schema, Pydantic, SQL DDL and documentation. That is thesis point 8 almost word for word, minus the DDD flavor and the judges.
- OntoUML/gUFO (a UFO-grounded modeling language projecting to OWL), Schema Salad and SHACL-AF rules are the other neighbours.
- Read LinkML's generator issues before designing an AST, because that is where projection lossiness is documented.

**(f) Compiler as reward: an active research line.**
- Execution and compiler feedback as a training signal: CodeRL, PPOCoder, RLEF (Gehring et al. 2024), StepCoder, and Self-Debugging (Chen et al. 2023).
- Proof assistants as reward: AlphaProof and the DeepSeek-Prover line on Lean.
- RL from verifiable rewards in general, for example Tülu 3's RLVR.
- The ledger-as-eval-set idea in thesis point 7 is the same move these papers make. The difference is that tiers 3 and 4 have no verifier, which is the whole problem.

**Verdict:** layers (a), (b), (c-tier-1) and (e) are prior art. Treating tiers 3 and 4 as checks over a provenance graph is the only part I cannot match to an existing system. It is also the part I am least convinced by.

## 2. Where the thesis is wrong or will fail

**Tiers 3 and 4 do not reduce to provenance checks.** They reduce to checks that a process was followed, which is a different thing. Every clause in thesis point 5 can be satisfied while the novelty conclusion is wrong:
- The sources are approved and resolve, but the dispositive reference was never searched.
- The quote is present but irrelevant.
- The cross-provider reviewer agrees because frontier models share training data and failure modes. Provider diversity is not independence.
- The classifier is "calibrated" against labels that arrive years later as office actions, and the threshold is a policy choice.
- The human signs because everything upstream is green.

That last point is the SLSA lesson, and it is worse here. The green provenance graph itself raises the reviewer's confidence, so the process check *lowers* the scrutiny the content gets. Present it honestly: tiers 3 and 4 get a deterministic *admissibility* check plus a still-probabilistic *content* finding. The two must never merge into one green light.

Also, "re-derived by a reviewer on a different provider" is not well defined for an opinion. Re-deriving a type check is deterministic. Re-deriving an obviousness argument gives you a second opinion. Decide whether agreement is a witness or a vote, and what disagreement does.

**A single finding shape works for transport, not for repair.** Routing, display and ledgering can share one shape. Repair cannot ignore judge kind:
- A confidence-1 finding with a mechanical fix can be auto-applied.
- A probabilistic finding needs triage and a way to dismiss it.
- A human comment carries intent that must be read.

The shape also lacks fields that matter:
- **Coverage.** Which rules ran over which scope. Without it, no findings looks the same as nothing checked. SARIF's `notApplicable` and `pass` exist for this reason.
- **Cascade links.** One root cause yields twenty antecedent-basis errors downstream. Compilers suppress cascades, and the shape needs `causedBy`.
- **Identity across revisions.** The fingerprinted source map helps, but a finding must survive an unrelated edit above it.
- **Fix candidates and suppression with a reason.** A suppression is itself a ledger row.

**Profiles do not compose monotonically in this domain.** Constrain-only composition works for FHIR because FHIR profiles are pure restrictions. Patent law is full of exceptions, specific-overrides-general rules, and jurisdiction conflicts:
- The EPO expects two-part "characterised in that" claims where appropriate. The USPTO does not, and Jepson form has US-specific consequences.
- Multiple dependent claims are routine at the EPO and surcharged and restricted in the US.
- Means-plus-function language changes meaning between offices.

A "US + EPO" profile is not the union of findings. It is a conflict that needs priorities, which means defeasible logic (LegalRuleML and Governatori already model this). Severity remapping such as "a warning in drafting is an error at filing" also does not "only add findings". Keep monotonicity as the default and design the override mechanism now. Bolting it on later breaks the composition law every consumer relies on.

**Span repair wins only for local defects.** Antecedent basis ("the member" changed to "a member") is local, and span repair is clearly right. Tier 2 findings such as "a claim term is unsupported" or "a dependent claim does not narrow" are global. Patching them span by span gives text that is consistent with itself but incoherent as a whole. Two more problems:
- **Claims are short.** Regenerating one claim costs perhaps 150 tokens. The token argument for span repair applies to specifications, not claims.
- **Models cannot address byte offsets.** Findings must give the agent a quoted anchor with unique context, as Aider's search/replace and `VerifiedTextAnchor` do. Offsets stay internal.

**The hub is at the wrong layer for the oracle.** `@beep/md` models headings, paragraphs and lists. Every tier 1 and tier 2 rule in the brief talks about claims, claim elements, preambles, transitions, dependency references, reference numerals and drawing figures. None of those exist in the hub. A claims document carried as a Markdown ordered list is a *notation* for a domain structure that needs its own model.

So there are two hubs: a notation-free document hub, and a domain model per profile that the document is folded into. The thesis currently implies Markdown spokes give you the oracle's front end. They give you the front end's front end. The domain fold, from document to claim set, is where the hard and lossy work happens, and the brief does not mention it.

**"Agents prefer this loop" holds only below a false-positive threshold.** Agents (and humans) abandon linters that cry wolf. Tier 2 term resolution in prose is fuzzy, as the brief admits. A tier 2 judge at 70% precision will be routed around or gamed, for example by pasting claim language verbatim into the specification. That is legitimate literal support in patent practice, but done blindly it makes the document worse. Watch precision per rule, not per tier.

## 3. The DSL question

**A DDD command/aggregate DSL is the right carrier for the obligation lifecycle and the wrong carrier for vocabulary and rules.** DDD is about consistency boundaries and behavior over time. An obligation does have a lifecycle: opened, witness attached, disputed, discharged, waived. Modeling it as an aggregate with commands, rejections and `Story` tests fits well.

A taxonomy or an axiom such as "every dependent claim refers to exactly one earlier claim" is not a command. Forcing it into `Domain.Command` clothing adds ceremony and hides the logic. Use three forms:
1. **Vocabulary and classes.** A LinkML-shaped schema layer, meaning classes, slots, ranges, cardinalities and enums. It is expressed as Effect Schema, because that is the repo's canon and you already project Schema to JSON Schema.
2. **Rules and constraints.** A small logic AST with targets and severity, roughly shaped like SHACL: target, path, constraint, message, severity, judge. Add an explicit Datalog-shaped escape hatch for recursive rules. A claim-dependency DAG and antecedent basis are naturally Datalog.
3. **Process and obligations.** The DDD layer.

**Make it a one-way projection, not a bidirectional one.** Importing arbitrary OWL back into the DSL fails on class expressions you will never author: nested existentials, property chains, punning. Keep the DSL as the single source of truth. Project to OWL and SHACL, run a reasoner (ROBOT `reason` plus `report`) and SHACL validation in CI on the projection, and treat any projection error as a DSL bug.

**What the AST must carry for a faithful OWL 2 and SHACL projection:**
- **A world assumption per assertion.** `minCount 1` means "infer that a value exists" under OWL's open world. It means "report a violation" under SHACL's closed world. One DSL field must not silently mean both. Every cardinality or existence statement declares whether it is ontological (OWL) or validation (SHACL). Obligations are always SHACL-side, or equivalent validation-side.
- **The unique name assumption.** OWL does not assume distinct names denote distinct things. Your rules ("claim 3 and claim 4") do. Project with explicit `owl:differentFrom`/`AllDifferent`, or keep identity reasoning out of OWL entirely.
- **A target OWL 2 profile.** Choose EL, QL or RL up front so reasoning stays tractable. RL fits rule-like axioms. Reject DSL constructs outside the profile at authoring time.
- **Stable IRIs, annotation versus logical axioms, and XSD datatype mapping**, including Effect Schema refinements that have no XSD facet.
- **Judge binding.** Which judge discharges each constraint. A deterministic SHACL shape, a TypeScript predicate and an LLM judge are all "constraints", and only the first projects.

**What is lost in projection:**
- Arbitrary TypeScript predicates (they become opaque `sh:sparql` or nothing).
- Probabilistic judges and confidence.
- Defeasibility and priorities (neither OWL nor core SHACL has them).
- Temporal and process ordering beyond what PROV-O and BFO occurrent relations can say statically.

The projection is an *audit view*, not the runtime. State that plainly, or someone will later "fix" the runtime to match the lossy projection.

**Is BFO alignment worth the cost in version 1?** I am skeptical. Tier 2 "term has support in the specification" is mostly lexical and semantic matching with a synonym table. Upper-ontology commitments buy little until you integrate across domains.

## 4. Me as the agent inside the loop

**What would make me productive:**
- **Few findings, root cause first, deduplicated.** One finding for "term `member` lacks antecedent basis", not one per occurrence. Cap the list at about seven per round.
- **Quoted anchors I can match exactly**, with a suggested replacement I can accept in one action. Never byte offsets.
- **Speed.** Tier 1 under one second, incremental on the changed claim. If a round trip takes a minute, I batch, guess, and stop listening.
- **Stable rule IDs with a one-paragraph rationale and an example**, fetched on demand rather than preloaded. This is the real context saving over a giant schema.
- **A definition of done.** Which profile I am satisfying and what "pass" means, including coverage, so I know when to stop.
- **A legal way to disagree.** Suppression with a reason that goes to a human and the ledger. Without it, I edit the text to silence a false positive, which degrades the document and poisons your ledger with fake "repairs".

**What would make me route around it:**
- False positives, especially from tier 2 judges presented as errors.
- Probabilistic findings that block. Tier 3 and 4 must be advisory to the drafting agent and gating only at the filing boundary.
- Findings whose positions shift or reappear after unrelated edits.
- Contradictory findings from stacked profiles with no stated priority.
- Being made to write Markdown when the content is a claim set. I would rather emit a claims notation directly.

**A warning about my own incentives:** if I can write the provenance record, I can forge it. I will not do it maliciously. I will do it by "summarizing" a search I partly ran, or by citing the reviewer's agreement in my own words. Any witness the agent can produce as text is worthless. See section 6.

## 5. The smallest falsifying experiment in two weeks

Scope it to tier 1 patent claims. Tiers 3 and 4 cannot be tested in two weeks, and saying otherwise would be process theater.

**Days 1 to 5: is the oracle correct?**
1. Build a claims fold, from a Markdown ordered list to a typed claim set: number, parent reference, preamble, transition, elements. Write three judges: antecedent basis, dependency DAG validity (earlier claim, existing claim, no cycles), and reference-numeral consistency against the specification.
2. Ground truth comes from public USPTO prosecution histories. Take original claim sets from applications whose first office action has a §112(b) rejection citing "insufficient antecedent basis", plus a matched set without one.
   - Office actions are full text through the USPTO Open Data Portal and the older Office Action Research Dataset. To my knowledge the dataset codes §112 rejections but not the antecedent-basis sub-reason, so you will need text mining of the office action. That is a few hundred lines.
   - Take 200 applications per arm.
3. Measure precision and recall against examiner citations. Examiners miss things, so also have one attorney adjudicate a sample of 50 disagreements.
4. Run ClaimMaster on the same set if a seat is available. It is the baseline the new checker must beat or match.

**Days 6 to 12: does the loop beat the alternatives?** Use 40 tasks: draft claims from a public disclosure, and repair claim sets with seeded tier 1 defects. Run each task under four conditions:

| Arm | Agent output | Feedback |
| --- | --- | --- |
| A | Markdown | None |
| B | Markdown | Oracle findings, full regeneration of the failing claim |
| C | Markdown | Oracle findings, span repair through quoted-anchor search/replace |
| D | JSON claim schema, structured output | Schema errors repaired by the existing `BlockRepair` |

Measure residual tier 1 defects, output tokens, wall time and rounds. Also have an attorney blind-rate a 15-task subset on overall claim quality, which catches Goodhart.

**Days 13 to 14:** write up the result, and record each judge's precision and recall as the first ledger rows.

**The thesis is falsified, or at least badly wounded, if any of these hold:**
- Judge precision is below 0.9 on tier 1. If deterministic rules cannot reach that, tier 2 is hopeless.
- Arm C does not beat arm B on tokens or rounds at equal defect rates.
- Arm D matches arm C on defects and time. If so, the notation front end adds nothing over the existing JSON block path.
- Blind quality in arms B and C is worse than in arm A.

It is validated if arm C dominates on defects and cost without quality loss, and precision holds.

## 6. One idea the authors have not considered: unforgeable witnesses

The repo already has the right primitive in the wrong place. `SafeHtml` is opaque and issued at runtime: you cannot construct one, only receive one from the policy. Apply that to obligations.

A witness that discharges an obligation should be a capability minted only by the judge runtime, never a record the agent or any model writes. Examples:
- "This link resolved and contained this quote at this time" is a `VerifiedTextAnchor` minted by the fetcher, signed over the content hash.
- "A reviewer on provider X independently reached Y" is minted by the harness that launched that reviewer, carrying the argv and model identity it observed, not the reviewer's self-report.
- "An attorney signed" is minted by an authenticated UI action.

The provenance graph then contains only issued nodes, and the tier 1 and tier 2 checks over it actually mean something. This is in-toto's functionary-key model scaled down to one process. It is the difference between a process ontology and an honor system.

Two consequences follow:
- **Admissibility becomes type-level.** An `Obligation<Novelty>` can only be closed with a `Witness<PriorArtSearch>` value of the right brand. That fits the repo's "schema is truth" culture better than SHACL over free-form PROV triples.
- **The agent loses the forgery incentive described in section 4.** The agent's job becomes requesting judge runs, not narrating them.

Without this, I expect thesis point 5 to become exactly the "process theater" that thesis point 9 fears, within weeks of agents meeting it.
