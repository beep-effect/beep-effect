# Requirements-to-test traceability that does not rot

**Lane:** 5-traceability · **Date:** 2026-08-10 · **Scope:** automated link generation & continuous maintenance; EARS outside aerospace; trace decay; derived (not stored) matrices; LLM conformance of diffs; orphaned evidence in docs-as-code.

---

## 1. TLDR

- **Stored RTMs rot by design.** Practitioner consensus (IIBA, QA blogs, tool vendors) is that a stale spreadsheet matrix is *worse* than no matrix: it creates false confidence for coverage, impact analysis, and audit.
- **Classical RE already knew this.** Gotel’s contribution structures and Mäder/Gotel maintenance work treat decay as the central problem: links must be updated when artifacts change, or they become fiction.
- **Value when fresh is real.** Controlled experiments (Mäder et al.) show developers with usable traceability complete evolution tasks ~24% faster and produce ~50% more correct solutions—so the goal is continuous usability, not ceremonial matrices.
- **LLM recovery is assistive, not authoritative.** 2025 evals put best LLM docs↔code link F1 around ~79–80% (beats IR/CodeBERT), with high partial-explanation rates but many false positives from naming assumptions and phantom architectural links. Human-in-the-loop remains required.
- **Derive the matrix; store only anchors.** Winning OSS pattern: stable IDs in requirements + tests + commits; CI linters for orphans/duplicates/broken chains; regenerate coverage reports—never hand-edit the matrix.
- **EARS left aerospace long ago.** Intel, Bosch, Dyson, nuclear design, and (2025+) AI IDE / agent-spec workflows use EARS; limits are known (math, decision tables, heavy multi-precondition, many NFRs).
- **Spec-conformance of diffs is emerging, not solved.** Tools like `agent-spec` verify contracts against bound tests and *recompute* liveness from verdicts; industry “AI RTM” products still mostly generate/link tests, not prove “this diff implements REQ-X and nothing else.”
- **Orphan failure modes dominate agent-era docs-as-code:** broken ID refs, green tests that never touch the code under claim, evidence files with no commit/digest binding, CLAUDE.md/SPEC.md that agents claim “updated” while page N is stale.
- **For beep-effect:** treat REQ/test IDs as first-class anchors; make readiness a *projection* of events+receipts (never a mutable status field); lint orphans continuously; use LLMs only for *candidate* link recovery / scoped diff review, never as the stored source of truth.

---

## 2. Findings

### 2.1 Lineage: Gotel, Mäder, continuous maintenance

**Pre- and post-requirements traceability.** Gotel & Finkelstein’s program distinguishes *pre-requirements* (who contributed, why a requirement exists—**contribution structures**) from *post-requirements* links (design, code, test). Industrial case work showed contribution structures answer questions pure RTMs cannot (human source of a requirement under change). Sources: [UCL modelling contribution structure](https://discovery.ucl.ac.uk/853/1/3.2_rtqual.pdf), [Gotel 1996 extended RT (PDF)](http://csis.pace.edu/~ogotel/research/GOTEL96%20Extended%20Requirements%20Traceability%20A%20Framework%20for%20Changing%20Requirements.pdf), [Ramesh reference models](https://www.cs.kent.edu/~jmaletic/cs63902/Papers/Ramesh99.pdf).

**Maintenance is the hard problem.** Mäder, Gotel & Philippow (ECMDA 2009) state the deterrent explicitly: establishing links is costly and they are “subject to almost instantaneous decay”; investment is only retained if maintenance is automated/semi-automated when models change. Their approach recognizes structural UML change activities and updates impacted relations ([paper PDF](http://www.patrickmaeder.de/pdf/ECMDA09_maeder_gotel_TraceabilityMaintenanceThroughUpkeepOfTraceability.pdf)). Later line: interaction-based *continuous* creation/maintenance of usable links ([EMSE 2020 / Springer](https://link.springer.com/article/10.1007/s10664-020-09831-w)).

**Empirical payoff of *usable* links.** Mäder & Egyed (EMSE 2015): subjects *with* traceability performed evolution/maintenance tasks on average **24% faster** and created **~50% more correct solutions** ([ACM](https://dl.acm.org/doi/10.1007/s10664-014-9314-z)). Implication: ceremony without freshness is waste; freshness without ceremony is the product.

### 2.2 Trace decay and false confidence (hand matrices)

Repeated practitioner claim, not just vendor marketing:

| Claim | Source |
|-------|--------|
| “An outdated RTM can be more dangerous than no RTM because it creates **false confidence**.” | [The Testing Academy RTM guide (2026)](https://app.thetestingacademy.com/blog/requirement-traceability-matrix) |
| “A stale matrix is worse than no matrix… On a fast-moving project, the matrix is out of date within **days**.” | [DEV.to RTM guide](https://dev.to/depapp/how-to-write-a-requirements-traceability-matrix-with-free-template-59ap) |
| Excel RTMs in review meetings look complete; nobody can answer “is this feature delivering what we promised?”—poor traceability “breeds **false confidence**.” | [IIBA: Requirements Traceability Without Excel](https://www.iiba.org/iiba-business-analysis-member-articles/requirements-traceability-without-excel-building-live-links-that-actually-get-maintained/) |
| “If nobody updates the matrix, it becomes **fiction**.” | [TestRail coverage vs traceability](https://www.testrail.com/blog/test-coverage-traceability/) |
| Static spreadsheet RTM is dead for continuous delivery; live links required. | [Virtuoso QA RTM](https://www.virtuosoqa.com/post/requirements-traceability-matrix-rtm), [Jama Live Traceability framing](https://www.jamasoftware.com/requirements-management-guide/requirements-traceability/traceability-matrix/) |

IIBA’s operational fix matches docs-as-code: **embed live links in the tools of work** (commits, issues, test runners), assign ownership per link type, measure **orphaned requirements / untested features**, not row counts in Excel.

### 2.3 Automated / continuous link generation (classical + modern)

**IR → ML → RAG/LLM pipeline (academic).** Requirements-to-code TLR is a two-decade line; 2024–2026 work shifts to embeddings + LLMs + RAG for inter-requirements and requirements-to-code recovery ([Wang et al. 2024 survey-style RC-TLR study](https://link.springer.com/article/10.1016/j.jksuci.2024.102118); [RAG inter-req TLR (KIT)](https://publikationen.bibliothek.kit.edu/1000178589/156854596); [Synergistic LLM data-aug for R2C](https://arxiv.org/html/2509.20149v2)).

**LLM docs→code (strong recent eval).** Alor, Khatoonabadi & Shihab, *Evaluating the Use of LLMs for Documentation to Code Traceability* (arXiv:2506.16440, Jun 2025): Claude 3.5 Sonnet / GPT-4o / o3-mini vs TF-IDF, BM25, CodeBERT on post-cutoff OSS projects. Best LLM **F1 ≈ 79.4% and 80.4%** on two datasets vs baselines best ~54–69%; fully correct explanations **42.9–71.1%** but partial accuracy **>97%**; multi-step chains keep endpoints accurate but intermediate capture **13–80%**. Error modes: naming-based assumptions, **phantom links**, overgeneralized architecture. Authors position LLMs as **assistants** needing human-in-the-loop tooling ([HTML](https://arxiv.org/html/2506.16440v1), [PDF](https://arxiv.org/pdf/2506.16440)).

**Security req ↔ goal recovery.** Hassine et al.: LLM approach with reported precision **100%**, recall **78.5%**, F1 **87.9%** on their security-goal setting—high precision, incomplete recall ([ACM](https://dl.acm.org/doi/10.1145/3661167.3661261)). Pattern: LLMs are safer as *proposers* when over-link risk is reviewed.

**Graph-RAG compliance.** Practitioner/paper summary circulating 2024: Graph-RAG + ToT for regulatory compliance ~**86–88% F1**, +15–20% over baseline RAG; human oversight still required for nuance ([discussion summary of Graph-RAG compliance work](https://x.com/rohanpaul_ai/status/1868268117094527178)—treat metrics as paper-dependent, not gospel).

**Commercial “AI RTM”.** Vendor narrative converges: generate tests *from* requirements so the link exists at birth; flag downstream items when upstream changes (Jama Advisor/Live Traceability, TestMax, Virtuoso agentic generation). Useful product pattern; does not by itself solve **diff-scope** (“nothing else”) or **evidence digests**.

### 2.4 EARS adoption outside aerospace

**Origin.** Rolls-Royce airworthiness/engine control; Mavin et al. RE’09. Official patterns and industry claim list: [alistairmavin.com/ears](https://alistairmavin.com/ears/) — Airbus, Bosch, Dyson, Honeywell, **Intel**, NASA, Rolls-Royce, Siemens; taught across universities.

**Non-aerospace adoption evidence.**

- **Intel (from 2010):** industry presentation documents introduction into RE training; example reqs for software/jumper/DRAM config (not flight software). [SlideShare: EARS (Intel)](https://www.slideshare.net/slideshow/ears-the-easy-approach-to-requirements-syntax/51558506).
- **Nuclear power plant safety design:** ResearchGate/publication trail on EARS in NPP safety design ([RG](https://www.researchgate.net/publication/328460114_Easy_Approach_to_Requirements_Syntax_in_Nuclear_Power_Plant_Safety_Design)).
- **AI/spec tooling (2025–2026):** Wikipedia notes Amazon **Kiro** IDE adopting EARS as native requirements notation for agentic SDD ([Wikipedia: EARS](https://en.wikipedia.org/wiki/Easy_Approach_to_Requirements_Syntax)); X practitioners cite Kiro + EARS skills ([@ivklgn 2026-07-15](https://x.com/ivklgn/status/2077411502374465547)); Archcore AI specs reworked to EARS-style WHEN/WHILE/IF ([@archcore_ai 2026-07-09](https://x.com/archcore_ai/status/2075186631837896902)); agent-spec lint-knowledge includes **EARS · ISO-29148** gates ([agent-spec README](https://github.com/ZhangHanDong/agent-spec)).

**Limits (disconfirming “use EARS for everything”).** QRA *When Not to Use EARS*: multi-precondition unwieldy sentences; prefer **decision tables** for combinatorial responses; pure **mathematical formulae**; audience/context exceptions ([qracorp.com](https://qracorp.com/when-not-to-use-ears/)). Wikipedia: less suitable for many **non-functional** / architectural constraints.

### 2.5 Conventions that make traceability *derived*

Pattern that survives: **anchors in-band, matrix out-of-band (generated).**

| Convention | Role | Tools / practice |
|------------|------|------------------|
| Stable REQ IDs (not row numbers) | Primary key | Universal RTM guidance |
| Markdown tags `<!-- @REQ-001@ -->` + chain `FROM:` | Req → arch → impl → test | [shtracer](https://github.com/qq3g7bad/shtracer) — verify orphans/duplicates, JSON/HTML matrix, zero deps |
| Test docstrings `Tests: FR-1.1` / patterns | Bidirectional req↔test | [pytreqt](https://github.com/joernpreuss/pytreqt) — pytest plugin, coverage, typo lint |
| `// Verifies: SPEC-001` in tests | Spec ledger ↔ test | [tdm](https://github.com/mafron/tdm) — 18 machine invariants, impact analysis, snapshot gates |
| Task contracts `satisfies: REQ-*` + bound test selectors | Intent compiler | [agent-spec](https://github.com/ZhangHanDong/agent-spec) — **liveness recomputed from verdicts, never stored** |
| Cross-doc ID/ref graph lint | Orphans, cycles, broken links | [contextlint](https://github.com/nozomi-koborinai/contextlint) — REF/GRP rules; [formal-ai duplicate R-ID lint](https://github.com/link-assistant/formal-ai/issues/964) |
| Commit trailers / issue IDs | Temporal provenance | Conventional Commits + `Refs`/`Closes`; HN/Lobsters: trailers as in-band metadata ([Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/), [Alchemists git trailers](https://alchemists.io/articles/git_trailers), [HN on issue trailers](https://news.ycombinator.com/item?id=48414027)) |
| Same-PR docs+code | Anti-rot | Practitioner: “Reference rot kills trust. Keep docs in the same PR…” ([@SydneyLarsson 2026-07-28](https://x.com/SydneyLarsson/status/2082089630707466641)) |

**Critical design property (agent-spec):** governance state machines and digests are stored; **liveness is a pure function of latest verify verdicts**. That is the anti-rot property for “status fields.”

### 2.6 LLM / agent conformance of diffs vs requirements

What exists today:

1. **Link recovery** (is there a path REQ→code?) — strong research, imperfect.
2. **Contract verification** (does bound test set pass under declared boundaries?) — agent-spec style: deterministic lifecycle, not freeform LLM judge.
3. **Specification acceptance agents** (drive app from NL acceptance criteria) — early failure reports: empty evidence when environment fails ([@atimisMoon 2026-08-04](https://x.com/atimisMoon/status/2084653858710815210)).
4. **“Does this diff implement REQ-X and nothing else?”** — **under-specified in production tools.** Closest pieces: boundaries/allow-lists in contracts; `impact` from file→SPEC→REQ (tdm); human review of over-scope. Pure LLM judges inherit SDD ceiling problems (next section).

Code Gradients (RE 2024 Next): automated traceability of *LLM-generated* code ([RE 2024 entry](https://conf.researchr.org/details/RE-2024/RE-2024-re-next--papers/8/Code-Gradients-Automated-Traceability-of-LLM-Generated-Code)) — generation-time provenance, complementary to maintenance.

### 2.7 Orphaned-evidence failure modes (docs-as-code / agents)

Observed / reported modes:

1. **Catalogue without store** — IDs that pass static checks but have no artifact behind them (liveness residual); agent analogy to “dead catalogue row” ([@andon_thinking 2026-08-06](https://x.com/andon_thinking/status/2085184527937266051)).
2. **Green test, zero contact** — “a green test that never touches the code is worthless” ([@meliksahbars 2026-08-08](https://x.com/meliksahbars/status/2085982686376820978)).
3. **Agent-maintained docs still rot** — large projects: mandatory doc updates after code changes still fail because “worker X forgot page 568”; context bloat hides facts ([@nishffx 2026-07-29](https://x.com/nishffx/status/2082471638809862225)).
4. **CLAUDE.md / instruction file decay** — detailed agent memory files become half-true without continuous anchoring to code ([@anieasyy 2026-07-16](https://x.com/anieasyy/status/2077578855754371180)).
5. **Message history ≠ environment truth** — partial stdout / killed process survives compaction as “confirmed result” without artifact proof ([@TambaClan 2026-08-10](https://x.com/TambaClan/status/2086645204124352721)): “Recover the history. Then prove the history is true.”
6. **Coverage ≠ depth** — RTM maps *existence* of a test, not assertion quality (Testing Academy: one weak login test still “covers”).
7. **Duplicate / reused IDs** — silent merge of unrelated requirements under one ID (formal-ai issue above).

---

## 3. Practitioner voices (X)

> “At my previous work, we spent so much time breaking system requirements down into high-level ones, then low-level ones, keeping full bidirectional traceability all the way through from the low-level requirements to the code/tests… this is exactly why this kind of thinking is going to be a huge accelerator for agentic development.”  
> — **@itzbanknotez**, 2026-08-09, [post](https://x.com/itzbanknotez/status/2086569479085965510) · 1 like, 62 views (reply in DO-178C thread). Earlier: industries with real safety stakes require top-down req→test traceability ([2025-12-06](https://x.com/itzbanknotez/status/1997172090231775711), 9 likes).

> EARS patterns (WHEN/WHILE/IF/WHERE/SHALL) presented as agent-friendly; links to Kiro and QRA “when not to use.”  
> — **@ivklgn**, 2026-07-15, [post](https://x.com/ivklgn/status/2077411502374465547) · low engagement, high signal for tooling pipeline.

> “Specs now cover features & subsystems… Reworked with EARS-style requirements (WHEN/WHILE/IF + MUST/SHOULD/MAY)”  
> — **@archcore_ai**, 2026-07-09, [post](https://x.com/archcore_ai/status/2075186631837896902).

> “And whatever AI you use, you must ‘guard-rail’ it using something like ‘requirement as code’… LLMs reading a 6 months old .md file, then switching LLM, you lose. Using requirement as code, you get type safety and tests.”  
> — **@JeanEmile134131**, 2026-08-06, [post](https://x.com/JeanEmile134131/status/2085488301549445569).

> “It's 2026. Where's your Spec Kit? … Start with a spec… easier for your AI agents to generate, test, and validate.”  
> — **@github**, 2026-01-09, [post](https://x.com/github/status/2009700466129559579) · 261 likes, 82k views.

> Spec as “unit test of product intent”; 2026 is “spec heavy code light”; wants CI gates on specs.  
> — **@off_thetarget**, 2026-04-11, [post](https://x.com/off_thetarget/status/2043001301928448160) · 227 likes (links [agent-spec](https://github.com/ZhangHanDong/agent-spec)).

> Spec-driven development **ceiling**: code can pass every test and satisfy the spec and still be the wrong system; need “trust infrastructure” (ownership, evidence, reverse conditions).  
> — **@ServerlessEdge**, 2026-08-07, [post](https://x.com/ServerlessEdge/status/2085732150783979785) · article [theserverlessedge.com](https://theserverlessedge.com/spec-driven-development-limits/).

> “Possible in theory, unfortunately not feasible… (1) ongoing maintenance… to prevent docs from turning stale (2) context bloat… agents make mistakes and later tell you ‘yes, the docs are stale because worker X forgot…’”  
> — **@nishffx**, 2026-07-29, [post](https://x.com/nishffx/status/2082471638809862225).

> “Given enough time, every detailed CLAUDE.md becomes a half written one as no one ensures the facts aren’t stale.”  
> — **@anieasyy**, 2026-07-16, [post](https://x.com/anieasyy/status/2077578855754371180).

> “Reference rot kills trust. Keep your docs in the same PR as code changes.”  
> — **@SydneyLarsson**, 2026-07-28, [post](https://x.com/SydneyLarsson/status/2082089630707466641).

> “A green test that never touches the code is worthless… Tests must prove the promise, not assert it.”  
> — **@meliksahbars**, 2026-08-08, [post](https://x.com/meliksahbars/status/2085982686376820978).

> “Recover the history. Then prove the history is true.” (execution → persistence → verification, not message logs alone)  
> — **@TambaClan**, 2026-08-10, [post](https://x.com/TambaClan/status/2086645204124352721).

---

## 4. Contrarian / failure evidence

1. **RTM as liability.** Multiple independent sources argue stale RTMs are *worse* than absence (false confidence)—see §2.2. This is the primary disconfirming argument against “just keep a matrix in SPEC.md.”

2. **LLM links are not truth.** arXiv:2506.16440 documents systematic FPs (phantom links, name coincidence). Precision-heavy security TLR still misses ~21% of true links. Using LLM output as *stored* edges recreates rot + hallucination.

3. **Spec satisfaction ≠ right product.** The Serverless Edge “EveryCompany” case: approvals workflow matched spec line-for-line, duplicated another team’s capability, conflict only in production ([article](https://theserverlessedge.com/spec-driven-development-limits/)). Traceability to a bad or incomplete requirement amplifies wrong delivery.

4. **EARS is not universal.** QRA/Wikipedia limitations: combinatorial logic, math, many NFRs—forcing EARS everywhere produces unreadable or false-precise sentences.

5. **Over-engineering pushback.** French SRE voice on requirement-as-code: reliability needs the right cursor; don’t over-engineer ([@rben_ll 2026-08-07](https://x.com/rben_ll/status/2085530638283903261)). Trace ceremony that isn’t risk-tiered becomes rubber-stamp.

6. **Agent acceptance testing failed first attempt.** Spec-acceptance agent: simulator never started; report empty ([@atimisMoon](https://x.com/atimisMoon/status/2084653858710815210)). Orphaned “evidence” risk if report is treated as receipt.

7. **agent-spec’s own honesty.** Explicit non-goals: cold-start product judgment; architectural taste; NFR ceiling (`uncertain`/`pending_review`); **false sense of security**—passing lifecycle ≠ comprehensive contract; test selector rename tax ([README](https://github.com/ZhangHanDong/agent-spec)).

8. **Manual matrices die in days** on agile pace—so “we’ll update it at release” is a known failure mode (DEV.to).

---

## 5. Implications for the beep-effect packet redesign

Opinionated, concrete:

### 5.1 Never store a status matrix; project it

Align packet **readiness** with agent-spec’s *liveness*:  
`ready(req) = f(events, approvals, evidence_receipts, gate_verdicts)`  
not `manifest.status = "done"`. Mutable status fields are RTM rot by another name.

### 5.2 Anchors only: stable IDs as the durable surface

- Normative `SPEC.md` / goal clauses get immutable IDs (`REQ-…`, `ACC-…`, `GATE-…`).  
- Tests, plan phases, commit trailers, and evidence receipts **cite** those IDs.  
- The RTM is **always regenerated** by a doctor/CLI (akin to shtracer/pytreqt/tdm). Hand-edited matrices are forbidden artifacts.

### 5.3 Lint orphans as hard CI (Light→Full risk tiers)

Minimum deterministic checks (no LLM):

| Check | Fail meaning |
|-------|----------------|
| REQ ID unique | Silent merge of unrelated intents |
| REQ without test/evidence (tier-dependent) | Untested / unproven |
| Test/evidence cites unknown REQ | Orphaned evidence / gold-plating |
| Evidence receipt without commit+artifact digests | Non-replayable claim |
| Spec change without invalidating dependent receipts | Stale confidence |
| Duplicate ID / broken markdown cross-ref | contextlint-class graph break |

**Light:** ID uniqueness + evidence digest presence for touched REQs.  
**Standard:** + bidirectional coverage on goal scope.  
**Full:** + impact closure (every changed file maps to SPEC/REQ) + human approval chain.

### 5.4 Evidence receipts > green checkmarks

Borrow from attestation lanes: a test “covering” REQ-X is only evidence if bound to:

- commit SHA (or tree digest),  
- artifact digests (report, coverage, qa inventory),  
- parent event digest (append-only chain).  

Unbound “TEST_COVERAGE.md” snapshots without digests are catalogue rows without store.

### 5.5 LLMs as candidate-link / scoped-diff assistants only

- **OK:** propose links when agents forget IDs; draft “does this PR touch REQ-X?” for human/doctor review; recover historical links for import.  
- **Not OK:** auto-commit link edges into the control chain without deterministic re-verify; treat F1≈80% recovery as certification.  
- For “implements REQ-X and nothing else”: enforce **declared change tree** + symbol ledger (pre-code gate) + boundary allowlist; LLM critique is advisory under Full tier only.

### 5.6 EARS as optional quality syntax, not the packet schema

Adopt EARS **patterns** for acceptance clauses that are event/state/unwanted-behaviour shaped (agent-readable, test-derivable). Do **not** force EARS for NFRs, architectural constraints, or combinatorial tables—use structured schema / decision tables. Matches Intel+Kiro adoption without QRA failure modes.

### 5.7 Same-PR / same-event coupling

Packet law: code, SPEC deltas, tests, and evidence receipts land as one control-event family (or same PR). Cross-PR “docs later” is the #1 rot vector in agent fleets.

### 5.8 Memoize gate cost by digest

Unrelated PRs that do not touch REQ set R pay **zero** re-trace: gate results keyed by `(req_set_digest, tree_digest, tool_version)`. This is the economics twin of continuous trace—without it, full-repo RTM regeneration becomes the new ceremony tax.

### 5.9 Explicit anti-patterns for beep

| Anti-pattern | Why it fails |
|--------------|--------------|
| Spreadsheet or markdown table as source of truth | Decays in days; false confidence |
| `status: complete` without receipts | Non-replayable; agent self-report |
| LLM-written “traceability complete” claims | Phantom links |
| One test linked to many REQs without scoping | Coverage theater |
| Evidence in chat/transcript only | Environment truth ≠ message log |
| Full ceremony on every PR | Gate tax → rubber stamps |

### 5.10 What to steal wholesale

1. **agent-spec:** derived liveness; REQ IR vs derived code graph; human acceptance at intake *and* exit; mechanical middle.  
2. **shtracer/pytreqt/tdm:** tag/docstring/`Verifies` conventions + CI orphan detect.  
3. **contextlint:** graph rules for markdown packet graphs.  
4. **Gotel contribution structures:** for Full-tier, record *who/why* (human approval + source event), not only post-req links.  
5. **Mäder lesson:** invest in **maintenance automation** (on change events), not one-time establishment.

---

## 6. Full source list

### Academic / classical RE

- Gotel & Finkelstein — modelling contribution structures: https://discovery.ucl.ac.uk/853/1/3.2_rtqual.pdf  
- Gotel 1996 extended RT framework PDF: http://csis.pace.edu/~ogotel/research/GOTEL96%20Extended%20Requirements%20Traceability%20A%20Framework%20for%20Changing%20Requirements.pdf  
- Ramesh & Jarke reference models: https://www.cs.kent.edu/~jmaletic/cs63902/Papers/Ramesh99.pdf  
- Mäder, Gotel, Philippow — automated maintenance (ECMDA 2009): http://www.patrickmaeder.de/pdf/ECMDA09_maeder_gotel_TraceabilityMaintenanceThroughUpkeepOfTraceability.pdf  
- Mäder & Egyed — developer benefit of RT (EMSE 2015): https://dl.acm.org/doi/10.1007/s10664-014-9314-z  
- Interaction-based continuous links (EMSE 2020): https://link.springer.com/article/10.1007/s10664-020-09831-w  
- Wang et al. RC-TLR methods study (2024): https://link.springer.com/article/10.1016/j.jksuci.2024.102118  
- RAG for inter-requirements TLR (KIT): https://publikationen.bibliothek.kit.edu/1000178589/156854596  
- Alor et al. LLM docs→code traceability (arXiv:2506.16440, 2025): https://arxiv.org/abs/2506.16440 · https://arxiv.org/html/2506.16440v1  
- Synergistic LLM R2C enhancement: https://arxiv.org/html/2509.20149v2  
- Hassine et al. LLM security TLR: https://dl.acm.org/doi/10.1145/3661167.3661261  
- Code Gradients, RE 2024: https://conf.researchr.org/details/RE-2024/RE-2024-re-next--papers/8/Code-Gradients-Automated-Traceability-of-LLM-Generated-Code  
- Enhancing RT link recovery (arXiv:2603.11800): https://arxiv.org/pdf/2603.11800  

### EARS

- Official EARS site (Mavin): https://alistairmavin.com/ears/  
- Wikipedia: https://en.wikipedia.org/wiki/Easy_Approach_to_Requirements_Syntax  
- When not to use EARS (QRA): https://qracorp.com/when-not-to-use-ears/  
- Intel industry slides: https://www.slideshare.net/slideshow/ears-the-easy-approach-to-requirements-syntax/51558506  
- Nuclear EARS (RG): https://www.researchgate.net/publication/328460114_Easy_Approach_to_Requirements_Syntax_in_Nuclear_Power_Plant_Safety_Design  
- Jama adopting EARS: https://www.jamasoftware.com/requirements-management-guide/writing-requirements/adopting-the-ears-notation-to-improve-requirements-engineering/  

### Decay / live links (practice)

- Testing Academy RTM (false confidence): https://app.thetestingacademy.com/blog/requirement-traceability-matrix  
- DEV.to RTM (stale = days): https://dev.to/depapp/how-to-write-a-requirements-traceability-matrix-with-free-template-59ap  
- IIBA live links: https://www.iiba.org/iiba-business-analysis-member-articles/requirements-traceability-without-excel-building-live-links-that-actually-get-maintained/  
- TestRail coverage vs traceability: https://www.testrail.com/blog/test-coverage-traceability/  
- Virtuoso QA RTM: https://www.virtuosoqa.com/post/requirements-traceability-matrix-rtm  
- Jama traceability matrix: https://www.jamasoftware.com/requirements-management-guide/requirements-traceability/traceability-matrix/  
- TestCollab “why RT still breaks teams”: https://testcollab.com/blog/why-requirement-traceability-still-breaks-teams--and-how-testcollab-fixes-it  
- TestMax AI RTM automation (2026): https://www.testmax.ai/blog/requirements-traceability-matrix-automation  

### OSS tools (derived matrices / lints)

- shtracer: https://github.com/qq3g7bad/shtracer  
- pytreqt: https://github.com/joernpreuss/pytreqt  
- tdm: https://github.com/mafron/tdm  
- agent-spec: https://github.com/ZhangHanDong/agent-spec  
- contextlint: https://github.com/nozomi-koborinai/contextlint  
- formal-ai duplicate R-ID lint issue: https://github.com/link-assistant/formal-ai/issues/964  
- sdd-framework (spec→tests table pattern): https://github.com/francisco-coder-mx-ai/sdd-framework  

### Spec-driven / trust ceiling

- Spec-Driven Development Has Hit Its Ceiling: https://theserverlessedge.com/spec-driven-development-limits/  
- Conventional Commits: https://www.conventionalcommits.org/en/v1.0.0/  
- Git trailers (Alchemists): https://alchemists.io/articles/git_trailers  
- HN on issue-ID trailers: https://news.ycombinator.com/item?id=48414027  

### X posts cited (handles · date · URL)

| Handle | Date (UTC) | URL | Notes |
|--------|------------|-----|-------|
| @itzbanknotez | 2026-08-09 | https://x.com/itzbanknotez/status/2086569479085965510 | DO-178C bidirectional RT → agents |
| @itzbanknotez | 2025-12-06 | https://x.com/itzbanknotez/status/1997172090231775711 | Safety-critical req→test |
| @ivklgn | 2026-07-15 | https://x.com/ivklgn/status/2077411502374465547 | EARS + Kiro + limits link |
| @archcore_ai | 2026-07-09 | https://x.com/archcore_ai/status/2075186631837896902 | EARS-style specs in product |
| @JeanEmile134131 | 2026-08-06 | https://x.com/JeanEmile134131/status/2085488301549445569 | Requirement-as-code vs stale .md |
| @github | 2026-01-09 | https://x.com/github/status/2009700466129559579 | Spec Kit / SDD |
| @off_thetarget | 2026-04-11 | https://x.com/off_thetarget/status/2043001301928448160 | agent-spec as “spec unit test” |
| @ServerlessEdge | 2026-08-07 | https://x.com/ServerlessEdge/status/2085732150783979785 | SDD ceiling / trust infra |
| @nishffx | 2026-07-29 | https://x.com/nishffx/status/2082471638809862225 | Docs maintenance failure + bloat |
| @anieasyy | 2026-07-16 | https://x.com/anieasyy/status/2077578855754371180 | CLAUDE.md staleness |
| @SydneyLarsson | 2026-07-28 | https://x.com/SydneyLarsson/status/2082089630707466641 | Same-PR docs anti-rot |
| @meliksahbars | 2026-08-08 | https://x.com/meliksahbars/status/2085982686376820978 | Green test without contact |
| @TambaClan | 2026-08-10 | https://x.com/TambaClan/status/2086645204124352721 | Prove history is true |
| @atimisMoon | 2026-08-04 | https://x.com/atimisMoon/status/2084653858710815210 | Spec acceptance agent empty evidence |
| @rben_ll | 2026-08-07 | https://x.com/rben_ll/status/2085530638283903261 | Don’t over-engineer req-as-code |
| @homeserversltd | 2026-07-07 | https://x.com/homeserversltd/status/2074351873570546131 | EARS for agents/infra |
| @felipefontoura | 2026-07-04 | https://x.com/felipefontoura/status/2073275968165196003 | EARS overkill for one-hour scripts |
| @simonwongio | 2026-06-24 | https://x.com/simonwongio/status/2069729208797134975 | EARS patterns for AI + test derivation |
| @rohanpaul_ai | 2024-12-15 | https://x.com/rohanpaul_ai/status/1868268117094527178 | Graph-RAG compliance summary |
| @andon_thinking | 2026-08-06 | https://x.com/andon_thinking/status/2085184527937266051 | Dead catalogue IDs / residual checks |

### Method note

Web search/scrape via Firecrawl (2026-08-10); GitHub via raw READMEs + issue links; X via keyword + semantic search (native). No fabricated URLs. Engagement counts as returned at crawl time; low-view technical posts included when content is high-signal. Where paper metrics appear only in secondary summaries (e.g. Graph-RAG F1), treat as provisional and re-check the primary paper before normative use.
