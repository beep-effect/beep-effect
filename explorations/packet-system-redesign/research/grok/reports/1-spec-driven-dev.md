# Spec-Driven Development in Real-World Use (2025–2026)

**Lane:** `1-spec-driven-dev`  
**Research date:** 2026-08-10  
**Scope:** GitHub Spec Kit, Amazon Kiro, Tessl, SDD vs BDUF debates, gate survival, spec-first vs prompt-first outcomes, long-horizon sync  
**Method:** Web/GitHub primary sources + heavy X discourse; disconfirming and failure evidence preferred over vendor hype  

---

## 1. TLDR

- **SDD is not one thing.** Böckeler (Thoughtworks / martinfowler.com, Oct 2025) splits it into **spec-first** (guide one build, then drop), **spec-anchored** (keep + enforce), and **spec-as-source** (humans never edit code). Most marketed tools only deliver the first.
- **Spec Kit is a star machine, not a maturity proof.** `github/spec-kit` has ~126k stars / ~11k forks as of 2026-08-10; Thoughtworks keeps both SDD and Spec Kit in **Assess**, not Adopt/Trial.
- **Clarify survived. Ceremony did not.** Practitioners keep pre-code Q&A, constitutions/steering, EARS/GWT acceptance criteria, and phase-gate human review. They drop six-step pipelines for small work, multi-file markdown dumps, and “full system always under SDD.”
- **Kiro is the corporate SDD IDE bet** (Jassy Jul 2025 preview; GA Nov 2025): requirements → design → tasks + hooks + (later) property-based checks. Real use reports both “jaw on floor” wins and grotesque over-engineering (e.g. ~5k LOC for a tiny helper).
- **Tessl pushes hardest toward spec-as-source** (Framework closed beta; Registry with 10k+ OSS usage specs; `@generate` / `// GENERATED FROM SPEC - DO NOT EDIT`). Still experimental; MDD-history risk is explicit in critical literature.
- **BDUF backlash is real and high-signal.** Holub, Barbini, swyx, and many X threads treat heavy SDD as waterfall with LLMs. Uncle Bob’s steelman: keep SDD **but** “just enough specs for this sprint,” human-ferocious approval, iterative rewrite of specs.
- **No rigorous head-to-head RCTs** of spec-first vs prompt-first agent coding were found. Directional claims of better first-pass success sit next to careful time-matched anecdotes where full Spec Kit cost as much as “plain” agent coding with *worse* control feel.
- **Multi-month sync is the unsolved core.** Spec Kit’s branch-per-change model does not produce a living product model; Barbini argues non-deterministic regen makes “rebuild from spec” a rewrite, so teams edit code and specs rot. Consensus among skeptics: **executable tests are the only artifact that cannot lie.**
- **Value lives in thinking + gates, not binders.** Kindred (Apr 2026): AI made skipping specs expensive; the value is the thinking while writing, not the tooling around it. Pocock: grill-first specs should be **deleted**, not treated as source.
- **For beep-effect:** risk-tier ceremony, event-derived readiness, digest-bound evidence, and memoized gates map better to practitioner survivors than a permanent six-phase SDD harness on every PR.

---

## 2. Findings

### 2.1 Definitions and spectrum (foundational for 2025–26 debate)

| Level | Intent | Maintenance | Typical tools |
| --- | --- | --- | --- |
| **Spec-first** | Spec guides initial agent run | Spec often discarded after merge | Kiro (in practice), many Spec Kit runs |
| **Spec-anchored** | Spec + code co-evolve; tests/CI enforce | Ongoing dual maintenance | BDD/OpenAPI+contract tests; aspirational SDD |
| **Spec-as-source** | Humans edit only specs; code is generated | No hand-edits of code | Tessl Framework experiments; classic MDD/Simulink |

Sources: [Böckeler, martinfowler.com, 2025-10-15](https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html); [Piskala arXiv:2602.00180, 2026-01](https://arxiv.org/abs/2602.00180); [dev.to field guide 2026](https://dev.to/krlz/spec-driven-development-in-2026-what-it-is-the-tooling-and-how-teams-actually-use-it-2fk2).

Thoughtworks Technology Radar:

- **Spec-driven development** → **Assess** (Nov 2025): “definition still evolving”; structured functional specs broken into pieces/tasks; many internal variants.  
  https://www.thoughtworks.com/en-us/radar/techniques/spec-driven-development
- **GitHub Spec Kit** → **Assess** (Apr 2026 Vol. 34): two camps — minimal structure + better models vs defined workflows; TW teams mostly brownfield experiments.  
  https://www.thoughtworks.com/en-us/radar/languages-and-frameworks/github-spec-kit  
- Vol. 34 macro note: SDD folds into **harness engineering**; “feedback flywheel” added after spec→plan→implement.  
  https://thoughtworks.medium.com/macro-trends-in-the-tech-industry-april-2026-b45422a943df

### 2.2 GitHub Spec Kit — adoption shape and abandonment shape

**What it is.** Open-source CLI + agent slash-commands (Copilot, Claude Code, Cursor, Codex, Gemini, 25–30+ agents). Canonical pipeline:

`constitution → specify → clarify → plan → tasks → implement`  
(plus heavy in-file checklists as pseudo DoD).

Repo: https://github.com/github/spec-kit  
Live stats (2026-08-10 via GitHub API): **126,106 stars**, **11,267 forks**, **310 open issues**, created **2025-08-21**.  
GitHub marketing: https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/  
Official X push: https://x.com/github/status/2003935215404617865 (2025-12-24), https://x.com/github/status/2009700466129559579 (2026-01-09).

**What practitioners praise.**

- Forces ambiguity kill *before* code (`/clarify`).
- Constitution as durable memory bank (brownfield: archaeological, not aspirational) — [BrainGrid tutorial, 2026-06-27](https://www.braingrid.ai/blog/github-spec-kit-tutorial-existing-project).
- Portable across agents (no single-IDE lock-in vs Kiro).

**Where it stops / soft abandonment (not “uninstall drama,” but systematic non-use).**

From Böckeler hands-on (Sep–Oct 2025 usage):

- **Wrong size:** small bug → sledgehammer (4 user stories / 16 ACs for a nut-crack fix). Mid 3–5 point brownfield feature → so many markdown files she **never finished** implement; estimated same wall-clock as plain agent coding with *less* control.
- **Review tax:** verbose, repetitive markdown; “I’d rather review code.”
- **False control:** agents still ignored research notes (regenerated existing classes as new), or over-obeyed constitution.
- **One workflow for all sizes fails.**

From BrainGrid (commercial but concrete failure map, Jun 2026):

1. **Per-run, not product model** — feature specs do not accumulate into connected product knowledge.  
2. **No verification of “done”** — implement ends when code exists, not when ACs are demonstrated.  
3. **Terminal-only reach** — non-engineers who know “done” never run `uv tool install`.  
4. Community signal: “Spec-driven development with Spec-Kit is eating my tokens alive” (re-establishing context every run).

From GitHub discussion [#152 “Evolving specs”](https://github.com/github/spec-kit/discussions/152) (41 comments, Sep 2025→2026):

- Core confusion: new change = **new spec + branch**, not update to master system spec → “to know what the system does I need both specs.”
- Practical consensus from practitioners in-thread: **mix** SDD for non-trivial features with vibe/manual for tiny fixes; “whole system always under SDD is not practical.”
- Branch-per-spec produces unreviewable mega-PRs unless you further split tasks yourself.
- Philosophical split: code-as-truth vs intent-as-truth with hoped-for bidirectional sync — **tooling for reliable bidirectional sync is still “remaining engineering.”**

**Bottom line on “abandonment”:** no mass public “we deleted Spec Kit” post-mortems found. What exists is **selective abandonment**: full pipeline for greenfield demos and large features; skipped for small/medium brownfield; constitution kept; living master-spec dream deferred.

### 2.3 Amazon Kiro

- Launch framing: [Andy Jassy, 2025-07-14](https://x.com/ajassy/status/1944785963663966633) — specs + architecture diagrams; agent hooks on save/commit; free preview.
- Product: https://kiro.dev/ — “specs made planning-first the default”; GA post claims property-based tests against specs + CLI + IAM Identity Center ([@kirodotdev, 2025-11-17](https://x.com/kirodotdev/status/1990471410624373047)).
- Workflow (InfoQ + AWS blogs): **requirements.md** (user stories + GIVEN/WHEN/THEN) → **design.md** → **tasks.md**, with human review between phases; later claim of code↔spec sync.  
  https://www.infoq.com/news/2025/08/aws-kiro-spec-driven-agent/  
  https://aws.amazon.com/blogs/industries/from-spec-to-production-a-three-week-drug-discovery-agent-using-kiro/
- **Positive HN/InfoQ:** gnarly datetime parsing — forced clearer thinking; task list “left jaw on floor.”
- **Negative HN (via InfoQ):** tiny macOS shortcuts helper → **~5000 LOC** that worked but was over-engineered every axis; hand-trimmed to ~800.
- **Role shift complaint:** “great demo for a PM… at what point do you actually do engineering?”
- Yehuda Cohen: Kiro needs active project management of an agent that prefers workarounds and must be told not to move on until fixed — powerful, not hands-off.

Kiro’s unique durable idea vs Spec Kit: **hooks** (event-triggered automation for tests/docs/consistency) — closer to “harness engineering” than to a one-shot markdown pipeline.

### 2.4 Tessl

- Launch: [Tessl blog, 2025-09-23](https://tessl.io/blog/tessl-launches-spec-driven-framework-and-registry/) — CEO Guy Podjarny.
- **Spec Registry** (open beta): 10k+ pre-built **usage specs** for OSS to fight hallucinated APIs / version blur.
- **Tessl Framework** (closed beta): component specs with capabilities + linked tests + typed API surface; `@generate` vs `@describe`; import via `@use`; aspirational **spec-as-source** with generated code marked do-not-edit (Böckeler observed 1:1 spec↔file mapping and residual non-determinism when regenerating).
- Positioning: reliability/guardrails for agents, compliance-friendly audit trails in secondary writeups — not mass open-source star chase like Spec Kit.

### 2.5 Spec-as-source-of-truth debate

Two “truths” get conflated (well articulated in Spec Kit #152 by cuyler-at-scribe):

1. Truth of **what the system currently does** → code (+ runtime).  
2. Truth of **what was meant** → intent/spec.

Pro-spec-as-truth: natural language + diagrams are higher signal-per-token for humans *and* agents; historical code-as-truth was a tooling limitation (rosmur, 0xnerdben in #152).  
Anti: Barbini — a precise-enough-to-generate-the-system-you-want spec is **as complex as the system**; if imprecise, agent fills gaps → day-one drift. Regen is non-deterministic → not rebuild, rewrite. In practice people edit code; specs die.  
https://medium.com/@ramtop/spec-driven-development-the-new-waterfall-8426a908d4da

Steelman middle: **spec-anchored** with **executable** acceptance (EARS→tests, OpenAPI→contract tests). Piskala and the 2026 field guides call this the production sweet spot; Thoughtworks still refuses “specs alone suffice.”

### 2.6 Gates / checklists / clarification — what survived contact

| Mechanic | Survival | Evidence |
| --- | --- | --- |
| **Clarify / grill / elicit ambiguities before code** | Strong | Spec Kit’s most praised step; Pocock “grill-me”; BrainGrid; Kindred’s Cheshire Cat framing |
| **Constitution / steering / AGENTS.md** | Strong for brownfield | Prevents parallel-pattern invention; Böckeler “memory bank” |
| **Out-of-scope / explicit bounds** | Strong | Field guides; reduces agent expansion |
| **EARS / GWT acceptance criteria** | Strong when short | Kiro defaults; AWS aerospace-EARS marketing; maps to tests |
| **Human review between phases** | Strong when **few** phases | GitHub blog “role isn’t just to steer. It’s to verify.” |
| **Task lists with requirement traceability** | Medium | Survives when tasks are small and PR-sized; dies when branch = entire feature |
| **Multi-file research/plan/api/component dumps** | Weak | Böckeler: tedious, repetitive, prefer code review |
| **Fixed 6-command ceremony for every change** | Weak | X + HN: overkill for one-function / prototypes; Gray Cat “ceremony tax” |
| **BMAD multi-persona / Six Hats rituals** | Weak for maintenance | X: superb greenfield, overkill for one-line; BMAD “still on story three after six hours” |
| **Permanent living master-spec for whole product** | Weak under Spec Kit model | #152; BrainGrid “per-run”; soft mix with non-spec changes |
| **Spec-as-source / never edit code** | Aspirational only | Tessl experiment; Barbini/Böckeler MDD warnings |

### 2.7 Spec-first vs prompt-first outcomes

**What exists:**

- Qualitative: better constraint encoding → fewer silent wrong assumptions (payment idempotency example style in vendor blogs).  
- Böckeler time-matched anecdote: full Spec Kit on mid brownfield feature ≈ wall-clock of plain AI assist, **less** sense of control, incomplete.  
- Kiro HN: large win on hard parsing; large lose on tiny tool (LOC explosion).  
- Piskala arXiv: claims of tens-of-percent error reduction when LLMs work from refined specs — treat as **directional**, paper is practitioner guide not multi-org RCT.  
  https://arxiv.org/abs/2602.00180  
- Field guide honesty: vendor numbers “directional, not proven”; solid finding is **human time shifts** from typing to review/clarification.  
  https://dev.to/krlz/spec-driven-development-in-2026-what-it-is-the-tooling-and-how-teams-actually-use-it-2fk2

**What does not exist (as of this research):** large, pre-registered, multi-repo RCTs with rework/incident metrics comparing pure vibe vs full SDD tooling under equal model budgets.

### 2.8 Keeping specs and code in sync over months

Practitioner consensus clusters:

1. **Append-only change specs** (Spec Kit cultural default): history of deltas, no single readable system truth.  
2. **Update master + regenerate** (Tessl aspiration): blocked by non-determinism and fear of losing hand fixes (Barbini).  
3. **Bidirectional sync** (hoped for in #152): still engineering unsolved — conflict, provenance (human vs agent), multi-agent real-time vs git.  
4. **Abandon maintenance of prose, keep tests** (Barbini, Holub-adjacent agile critique): agents can regenerate short docs *from* tests; tests fail when intent is violated.  
5. **Kiro marketing claim** of “specs stay synced” via update-from-code / refresh-tasks — promising product direction; independent multi-month public case studies still thin.

X signal (2026): “stale specs caused confident wrong code” (@sebuzdugan); “only works when the spec stays close to the code and is updated by the same workflow” (@MindSparklxx4).

---

## 3. Practitioner voices from X

> “Everyone always confuses my skills with spec-driven-development. … The specs my skills create are intended to be **deleted immediately** — not kept around, or treated as source code. … The specs aren't that important. They're just a projection of the decisions made during grilling.”  
> — **@mattpocockuk**, 2026-08-01 · [post](https://x.com/mattpocockuk/status/2083563195671667176) · ~1.4k likes, ~102k views

> “I really don't get ‘spec-based development,’ which is nothing but a fancy way to describe a phase-gated ‘waterfall.’ An upfront specification is never correct… AI actually makes incremental development easier… Why would anybody throw away that advantage…?”  
> — **@allenholub**, 2026-04-15 · [post](https://x.com/allenholub/status/2044445712109150318) · ~345 likes, ~35k views

> “The whole SDD thing is very valuable for AI development; but it carries the risk of **BUFD**. … Just enough specs for the stories in this sprint… Specs will be co-authored by the humans and the AI, but with final approval, ferociously defended, by the humans. … Small Steps.”  
> — **@unclebobmartin**, 2026-02-12 · [post](https://x.com/unclebobmartin/status/2021998958579794052) · ~311 likes, ~23k views

> “blogpost I'm too lazy to write but you can extrapolate from the title: **Spec Driven Development is Wishful Thinking**”  
> — **@swyx**, 2025-11-04 · [post](https://x.com/swyx/status/1985607558162239619) · ~402 likes, ~50k views

> “Classic #SDD is dying. #BMAD, #OpenSpec and #SpecKit charge a **ceremony tax** the new models don't need. … Tested BMad's new autonomous loop anyway: six hours, still on story three, nothing shipped.”  
> — **@thegraytcat**, 2026-08-04 · [post](https://x.com/thegraytcat/status/2084597226467209578)

> “all those gsd/speckit/bmad feel like a huge overkill, cause you need to work FOR THEM… Instead, wouldn't it work to just.. you know.. **TALK TO THE AGENT** to plan?”  
> — **@PovilasKorop**, 2026-05-17 · [post](https://x.com/PovilasKorop/status/2055981714975936717)

> “If you’re using spec driven development with your LLM, might I suggest you’re overcomplicating things? Just use the grill-me skill plus plan mode…”  
> — **@schneidenbach**, 2026-07-09 · [post](https://x.com/schneidenbach/status/2075028373722501556)

> “Waterfall and heavy methodologies never worked. I wrote about why the **spec-driven development goes stale**, what agents are actually good for, and the one artifact in your project that cannot lie.”  
> — **@ramtop** (Uberto Barbini), 2026-08-04 · [post](https://x.com/ramtop/status/2084641557496627437) → Medium essay linked above

> “One file and one function. Still exploring. A throwaway prototype. Writing the spec costs more than the fix. The test that settles it: **would you be annoyed if the agent decided that differently?** If yes, write it down. If you shrug, vibe it.”  
> — **@0xJeyx**, 2026-08-10 · [post](https://x.com/0xJeyx/status/2086878998445817972)

> “GITHUB JUST KILLED THE WORST PART OF VIBE CODING… Spec Kit… already crossed 120,000 stars” (viral advocacy; treat as marketing amplification, not evaluation)  
> — **@crptAtlas**, 2026-07-13 · [post](https://x.com/crptAtlas/status/2076754607049449633) · ~2.5k likes, ~500k views

> “Kiro is generally available… Specs made ‘planning first’ the default… adds property based tests to check if your code actually matches your Spec. Real signals, not vibes.”  
> — **@kirodotdev**, 2025-11-17 · [post](https://x.com/kirodotdev/status/1990471410624373047) · ~352 likes

> “Now it is all about writing as detailed spec as possible and it makes me feel like a fucking bureaucrat manager that is a part of the waterfall development process.”  
> — **@KostjaPalovic**, 2026-08-07 · [post](https://x.com/KostjaPalovic/status/2085608578971304344)

---

## 4. Contrarian / failure evidence

1. **BDUF / waterfall rebrand (strongest philosophical pushback)**  
   Holub (X), Barbini (Medium 2026-08), swyx (X). Core claims: upfront detailed specs are never correct for product discovery; SDD throws away AI’s real advantage (cheap spikes / tight loops); document-about-document pipelines remove the only honest artifact (running code).

2. **MDD déjà vu (Böckeler)**  
   Spec-as-source recapitulates model-driven development: awkward abstraction level, dual artifacts, generators. LLMs remove parseable DSL constraints **and** determinism — risk of “inflexibility *and* non-determinism.”  
   https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html

3. **Over-engineering from “good” specs (Kiro HN)**  
   Short spec → 5k LOC working but absurd for a tiny helper. Specs can authorize bloat.

4. **False sense of control (Böckeler + Barbini)**  
   Checklists/templates do not force agent compliance; beautiful wrong specs are as confident as correct ones. Matching a wrong spec is not success.

5. **Token / review economics (community)**  
   Spec Kit “eating tokens”; multi-file review worse than code review; BMAD multi-hour ceremony with nothing shipped.

6. **Stars ≠ adoption depth**  
   Spec Kit’s 126k stars coexists with Thoughtworks **Assess**, unsolved evolving-spec discussion, and practitioner advice to mix/vibe for small changes. Viral X explainers overstate “killed vibe coding.”

7. **Semantic diffusion**  
   “Spec” often means “detailed prompt.” Pocock refuses SDD label for deletable grill projections. Radar Vol. 34 notes SDD/harness terminology inconsistency.

8. **GOTO 2026 (North & Adzic)**  
   “Spec-Driven Dev Is Back. But Not How You Think” — chapter titles include “Spec-to-Code AI will never work” and “We’ve seen this before (And it didn’t end well)”; nuanced position: AI for QoL, not core domain; automation speeds without magically improving quality.  
   https://www.youtube.com/watch?v=6mLYZF97oaU

9. **Kindred’s half-contrarian**  
   Not “SDD is wrong” but “SDD hype is old wine”: orgs always should have written specs; AI made skipping expensive; **value is thinking, not tooling**.  
   https://brandonkindred.medium.com/same-patterns-new-hype-spec-driven-development-5183d8e8f704

---

## 5. Implications for the beep-effect packet redesign

Opinionated, concrete, mapped to the proposed redesign (strict pre-code gates, symbol ledgers, event+approval readiness, append-only control events, digest-bound evidence, risk tiers Light/Standard/Full, memoized gates).

### 5.1 Adopt (high confidence from field)

1. **Risk-tiered ceremony is non-negotiable.**  
   Industry already votes with feet: full SDD for multi-session / multi-package / irreversible work; talk-to-agent or grill-then-delete for one-file fixes. Your Light/Standard/Full map is aligned — **enforce the test**: “would you be annoyed if the agent decided differently?” (Jeyx). Light = no multi-artifact pipeline.

2. **Clarify/grill is the highest-ROI gate; keep it mandatory above Light.**  
   Survived everywhere. Implement as a **recorded Q&A event** with parent digest, not as six markdown templates. Pocock’s “delete the intermediate projection” is compatible if the **decisions** (answers) land in SPEC/PLAN or in control events — not a permanent novel of plan.md clones.

3. **Prefer executable anchors over prose as long-term SoT.**  
   Barbini/Holub/Thoughtworks Assess all point here. Packet redesign should treat:  
   - **SPEC.md** = normative *intent* (what must be true),  
   - **tests + type-level schemas + property laws** = *proof*,  
   - **code** = realization.  
   Drift detection = fail CI when evidence digests / tests diverge — not “someone forgot to update a task checklist.”

4. **Event-sourced readiness > stored status fields.**  
   Spec Kit’s checklist-in-markdown is AI-interpreted theater. Your proposal (readiness derived from events+approvals) is strictly better: machine-checkable, append-only, no “status: complete” lies.

5. **Exact file change tree + significant-symbol ledger = the missing brownfield constitution.**  
   Spec Kit fails when agents invent parallel patterns. A **required symbol/file impact ledger** for Standard/Full is more useful than Kiro’s 16 GWT stories about “as a developer I want edge cases.” Make the ledger the review surface; dump narrative design only when Full risk.

6. **Memoized gates for unrelated PRs.**  
   Spec Kit’s per-run token tax is a known failure mode. If gate inputs (constitution hash, packet digest, touched paths) are unchanged, **skip re-ceremony**. This is harness engineering, not SDD religion.

### 5.2 Reject or demote (high confidence)

1. **Do not copy Spec Kit’s branch-per-feature mega-spec as the product model.**  
   Explorations→goals already separate fuzzy vs execution. Inside a goal, prefer **delta events** (append-only control chain) over “new master truth file every time” without a merge story.

2. **Do not aim for Tessl-style spec-as-source for the monorepo.**  
   Effect + schema-first already *is* a high-signal source language. Generating packages from natural-language specs as primary source recreates MDD with non-determinism. Keep NL specs as **contracts for agents**, not as the only editable artifact.

3. **Do not require multi-phase markdown review as default.**  
   Böckeler’s “I’d rather review code” is the agent-operator reality. Human gates should review: **intent delta, symbol ledger, risk tier, evidence digests** — not eight verbose research files.

4. **Do not store “done” as a checkbox in prose.**  
   Define done as: required approvals present + evidence receipts bound to commit+artifact digests + doctor/CI green. Matches Kiro’s later “property tests vs spec” instinct without Amazon lock-in.

### 5.3 Design nuances specific to beep-effect

| Redesign element | Field lesson | Concrete stance |
| --- | --- | --- |
| Pre-code design gates | Clarify survives; BDUF doesn’t | Gate on **ambiguity budget zero** + impact ledger, not on “design complete” narrative |
| Significant symbols ledger | Constitution/steering survivors | Make it machine-diffable against actual PR symbols (post-hoc gate if ledger lies) |
| Readiness from events | Checklists are fake DoD | No status fields; replay events |
| Parent digests on control events | Spec Kit lacks provenance human/agent | Every control event: actor, parent digest, artifact digests |
| Evidence receipts | Spec Kit stops before verify | Full tier: no merge without AC-linked evidence |
| Risk tiers | Ceremony tax kills adoption | Default Light for docs/tests-only; Full only for public API / security / multi-package |
| Memoized gates | Token/review economics | Cache by `(packet_id, content_digest, path_globs)` |

### 5.4 Steelman one-liner for the redesign

Beep-effect should not become “Spec Kit with better branding.” It should become the thing Spec Kit users invent after a month: **small durable constitutions, aggressive clarification, risk-tiered gates, append-only change history, and proof that cannot lie** — with **zero tax on unrelated work**.

---

## 6. Full source list

### Primary analyses & tools
- Birgitta Böckeler — *Understanding Spec-Driven-Development: Kiro, spec-kit, and Tessl* (2025-10-15): https://martinfowler.com/articles/exploring-gen-ai/sdd-3-tools.html  
- Deepak Babu Piskala — arXiv:2602.00180 (2026-01): https://arxiv.org/abs/2602.00180 · HTML https://arxiv.org/html/2602.00180v1  
- Brandon Kindred — *Same Patterns, New Hype* (2026-04-20): https://brandonkindred.medium.com/same-patterns-new-hype-spec-driven-development-5183d8e8f704  
- Uberto Barbini — *Spec-Driven Development: The New Waterfall* (2026-08): https://medium.com/@ramtop/spec-driven-development-the-new-waterfall-8426a908d4da  
- Field guide — *SDD in 2026* (dev.to): https://dev.to/krlz/spec-driven-development-in-2026-what-it-is-the-tooling-and-how-teams-actually-use-it-2fk2  
- GitHub Spec Kit repo: https://github.com/github/spec-kit  
- Spec Kit evolving-specs discussion #152: https://github.com/github/spec-kit/discussions/152  
- GitHub blog SDD + Spec Kit: https://github.blog/ai-and-ml/generative-ai/spec-driven-development-with-ai-get-started-with-a-new-open-source-toolkit/  
- Thoughtworks Radar — SDD: https://www.thoughtworks.com/en-us/radar/techniques/spec-driven-development  
- Thoughtworks Radar — Spec Kit: https://www.thoughtworks.com/en-us/radar/languages-and-frameworks/github-spec-kit  
- Thoughtworks macro trends Apr 2026: https://thoughtworks.medium.com/macro-trends-in-the-tech-industry-april-2026-b45422a943df  
- InfoQ — Kiro (2025-08-18): https://www.infoq.com/news/2025/08/aws-kiro-spec-driven-agent/  
- Kiro product: https://kiro.dev/  
- AWS blog — Kiro drug discovery case (2026-02): https://aws.amazon.com/blogs/industries/from-spec-to-production-a-three-week-drug-discovery-agent-using-kiro/  
- Tessl launch: https://tessl.io/blog/tessl-launches-spec-driven-framework-and-registry/  
- Tessl site: https://tessl.io/  
- BrainGrid Spec Kit brownfield tutorial (2026-06-27): https://www.braingrid.ai/blog/github-spec-kit-tutorial-existing-project  
- Augment — What is SDD: https://www.augmentcode.com/guides/what-is-spec-driven-development  
- GOTO 2026 — North & Adzic: https://www.youtube.com/watch?v=6mLYZF97oaU  
- AWS re:Invent 2025 — Spec-driven development with Kiro (DEV314): https://www.youtube.com/watch?v=4qcWgPb-8Fk  

### X posts cited (handle · date · URL)
- @github — 2025-12-24 — https://x.com/github/status/2003935215404617865  
- @github — 2026-01-09 — https://x.com/github/status/2009700466129559579  
- @ajassy — 2025-07-14 — https://x.com/ajassy/status/1944785963663966633  
- @kirodotdev — 2025-11-17 — https://x.com/kirodotdev/status/1990471410624373047  
- @swyx — 2025-11-04 — https://x.com/swyx/status/1985607558162239619  
- @unclebobmartin — 2026-02-12 — https://x.com/unclebobmartin/status/2021998958579794052  
- @allenholub — 2026-04-15 — https://x.com/allenholub/status/2044445712109150318  
- @PovilasKorop — 2026-05-17 — https://x.com/PovilasKorop/status/2055981714975936717  
- @crptAtlas — 2026-07-13 — https://x.com/crptAtlas/status/2076754607049449633  
- @schneidenbach — 2026-07-09 — https://x.com/schneidenbach/status/2075028373722501556  
- @mattpocockuk — 2026-08-01 — https://x.com/mattpocockuk/status/2083563195671667176  
- @thegraytcat — 2026-08-04 — https://x.com/thegraytcat/status/2084597226467209578  
- @ramtop — 2026-08-04 — https://x.com/ramtop/status/2084641557496627437  
- @KostjaPalovic — 2026-08-07 — https://x.com/KostjaPalovic/status/2085608578971304344  
- @0xJeyx — 2026-08-10 — https://x.com/0xJeyx/status/2086878998445817972  
- @sebuzdugan — 2026-07-20 — https://x.com/sebuzdugan/status/2079109254489800996  
- @MindSparklxx4 — 2026-07-25 — https://x.com/MindSparklxx4/status/2081142827099296244  

### Notes on evidence quality
- Star counts and API stats verified 2026-08-10.  
- No fabricated quotes; X engagement counts are as returned by the search tools at research time.  
- Reddit threads on Spec Kit token cost were referenced via secondary (BrainGrid); direct Reddit scrape was blocked by the scrape provider.  
- Vendor success metrics treated as directional only.

