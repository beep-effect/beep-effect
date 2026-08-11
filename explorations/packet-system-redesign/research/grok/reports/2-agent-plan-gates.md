# Plan-then-Implement Workflows for Coding Agents (Practice Report)

**Topic:** Plan-then-implement in production agent fleets — ExecPlans, HumanLayer FIC, Horthy 4-gate factory, Pocock skills, Anthropic skills, Claude plan mode; plan review leverage; drift; granularity.  
**Date:** 2026-08-10 · **Lens:** disconfirming + practitioner discourse · **Status:** research synthesis

---

## 1. TLDR

- **Living plans beat chat plans.** OpenAI ExecPlans require Progress / Surprises & Discoveries / Decision Log / Outcomes as *mandatory living sections*; multi-hour Codex runs treat the plan file as the restart surface.
- **Context is the product.** HumanLayer’s “frequent intentional compaction” (research → plan → implement, keep windows ~40–60%) is the dominant brownfield recipe; subagents exist for *context isolation*, not role-play.
- **Review leverage is upstream.** Horthy: a bad research line → thousands of bad LOC; a bad plan line → hundreds; humans should read ~200-line plans over 2k-line diffs. Industry echoes (Augment, Osmani light/dark factory).
- **4 gates push decisions before code.** Product → Architecture → Program Design (files, signatures, call stack, tests, least-confident decisions) → Vertical Slices, with explicit re-approval when later gates invalidate earlier ones.
- **Composable skills > process frameworks.** Pocock’s public skills (grill → to-spec → to-tickets → implement) deliberately avoid owning the full SDLC (contrast GSD/BMAD/Spec-Kit); Anthropic skills use progressive disclosure and freedom-tiered instructions.
- **Plan mode is mostly UX + prompt.** Ronacher: Claude plan mode ≈ read-only reinjection + phases + plan file + approval UI; many power users prefer durable markdown on disk they can edit.
- **Plan compliance is weak without reinforcement.** arXiv 2026 (16,991 trajectories): plans are advisory; a *bad* plan hurts more than no plan; periodic plan reminders improve compliance; agents often fall back to internalized workflows.
- **Drift is the default mid-implementation.** Conversation drift + evidence drift leave stale plan.md as a confident wrong memory; recovery = stop, rewrite body (not append-only footnotes), then resume.
- **Granularity that works:** program-design level (file tree + signatures + verification) for Standard/Full; milestone intent for Light; exact symbol ledgers only when risk tier pays for them—and they must stay living, not frozen.
- **Contrarian:** dark factories fail on comprehension debt; “build a factory” is cargo-cult (Horthy/Arnaldi); some keep research/plans *outside* VCS to avoid stale branch pollution; ceremony without engagement is cargo-cult.

---

## 2. Findings

### 2.1 OpenAI Codex ExecPlans (living plans)

- Official cookbook (Aaron Friel, Oct 2025; still current 2026): ExecPlans are **self-contained living design docs** a novice/stateless agent can execute; AGENTS.md points agents to PLANS.md for complex work. Claimed multi-hour runs (>7h) from a single prompt when plans are maintained.  
  Source: https://developers.openai.com/cookbook/articles/codex_exec_plans  
  Raw template: https://github.com/openai/openai-cookbook/blob/main/articles/codex_exec_plans.md  
  Also checked into agent repos, e.g. https://github.com/openai/openai-agents-python/blob/main/PLANS.md

- **Mandatory living sections:** Progress (timestamped checkboxes; every pause splits done vs remaining), Surprises & Discoveries (evidence-backed), Decision Log (decision/rationale/date-author), Outcomes & Retrospective.

- **Structural sections:** Purpose, Context & Orientation (full paths, no prior-plan memory), Plan of Work (file + location + change), Concrete Steps (cwd + commands + expected transcripts), Validation & Acceptance (**behavioral**, not “added a struct”), Idempotence & Recovery, Interfaces & Dependencies (prescriptive types/signatures).

- **Drift protocol baked in:** “If you change course mid-implementation, document why in the Decision Log and reflect implications in Progress.” “When you revise a plan… comprehensively reflected across all sections… note at the bottom… what changed and why.” Scope shift → rewrite so the doc stays coherent and self-contained.

- **Granularity stance:** concrete file/function edits and interface signatures; prose-first (checklists only in Progress); avoid “letter of the feature” that compiles without observable behavior.

### 2.2 HumanLayer — advanced context engineering / frequent intentional compaction

- Primary write-up: https://www.humanlayer.dev/blog/advanced-context-engineering  
  Companion: https://github.com/humanlayer/advanced-context-engineering-for-coding-agents · talk “No Vibes Allowed” (AIE 2025).

- **Problem frame:** Stanford/Yegor-style rework + brownfield productivity drop; 2k-line Go PRs unsustainable for review; Sean Grove “specs are the new code” as intellectual anchor (throwing away prompts while committing only code = shipping the JAR, not the source).

- **FIC workflow:** Research (codebase map, flow, causes) → Plan (exact steps, files, verification per phase) → Implement (phase-by-phase; compact status back into plan after verified phases). Keep context utilization ~**40–60%**. Subagents for search/summarize so parent stays clean. Worktrees mainly for implement.

- **Published plan command** (humanlayer repo) demands: full-file reads, parallel research subagents, file:line refs, phased plan with **automated vs manual** success criteria, “What We’re NOT Doing,” no open questions in final plan, interactive structure approval before detail write.  
  Source: https://raw.githubusercontent.com/humanlayer/humanlayer/main/.claude/commands/create_plan.md

- **Leverage claim (core):** “A bad line of code is a bad line of code. A bad line of a **plan** could lead to hundreds of bad lines… A bad line of **research**… thousands.” “I can’t read 2000 lines of golang daily. But I *can* read 200 lines of a well-written implementation plan.” Mental alignment (Blake Smith hierarchy) becomes primary code-review purpose under high agent throughput.

- **Evidence (anecdotal but concrete):** BAML 300k LOC Rust — researched plan PR approved vs weaker no-research plan closed; ~35k LOC cancel/WASM work in ~7h (3 research/plan + 4 implement). **Counter:** parquet-java hadoop removal failed when research was shallow; race-condition rabbit hole burned 2 weeks—FIC is not magic without domain experts.

### 2.3 Dex Horthy 4-gate software factory

- Community skill formalization (podcast-derived, heavily forked): https://gist.github.com/Maciejdziuba/88890d7e0eeefa5a8738bbe9fd5e20b8  
- Framing essays: Addy Osmani “Software Factories, Light and Dark” https://addyosmani.com/blog/software-factories/ · talk “Harness Engineering is not Enough.”

- **Gates:**  
  1. **Product** — user problem, success metric, “blog post before the feature,” HTML mockups; tech banned.  
  2. **Architecture** — fit to real codebase, endpoints, data, E2E flow.  
  3. **Program Design** — *the skipped step*: every file + why, types/signatures with **no bodies**, call stack, test plan (names + asserts), **least-confident decisions** list.  
  4. **Vertical Slices** — tracer bullet first; ban horizontal “all DB then all UI”; re-steer after each slice.

- **State:** `docs/plans/<feature>/00-status.md` + gate docs; compact at every gate/slice boundary (“dumb-zone”: hard thinking early, fresh context later). Approval protocol: write doc → short summary → “Approve Gate N?” → only clear yes counts.

- **Backtracking protocol:** if later work invalidates earlier approval → set earlier gate to in-progress, update doc, **re-approve**.

- **Risk tiering (skill-level):** skip for trivial tweaks / explicit “just vibe”; full gates for multi-file / ~100+ line review pain.

- **Dark factory failure mode (Horthy + Osmani):** months of lights-out generation → comprehension debt while tests stay green; bottleneck is verification/judgment, not generation. Autonomy only where oracles are cheap, high-frequency, hard to game.

### 2.4 Matt Pocock composable skills

- Repo: https://github.com/mattpocock/skills (~213k stars as of scrape, Aug 2026)  
- Philosophy: **small, hackable, composable** primitives; rejects process frameworks that “own” the SDLC (GSD, BMAD, Spec-Kit) because bugs in the process become unfixable.

- **Engineering chain (user-invoked):** ask-matt router → grill / grill-with-docs → to-spec → to-tickets (blocking edges; local file *or* tracker DAG) → implement (drives tdd + code-review) · wayfinder for multi-session decision maps · code-review as dual Standards/Spec axes.

- **Invocation hygiene:** most skills `disable-model-invocation` / Codex `allow_implicit_invocation: false` so they don’t eat context until called. Pocock (2026-08-10): chain costs ~50–100 tokens for the core set, ~600 for the lot.

- **Relevance:** alignment-before-build (grill) + ticket edges as plan graph + implement as execution skill = plan-then-implement without a single mega-plan document if you don’t want one.

### 2.5 Anthropic skill best practices

- Authoring guide: https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices  
- Conceptual: https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills (2025-10; skills open standard later)

- **Progressive disclosure:** metadata always loaded; SKILL.md on trigger; nested refs only when needed; keep SKILL.md lean (~500 lines guidance); one-level-deep references.

- **Freedom matching fragility:** high freedom for judgment tasks; low freedom (exact scripts) for migrations / fragile sequences.

- **Workflows:** explicit checklists agents copy into progress; validate → fix → revalidate loops; third-person descriptions for discovery; avoid time-sensitive “before Aug 2025” prose.

- **Implication for plans:** skills should *encode* plan-then-implement procedure and progressive detail, not dump entire monorepo doctrine into every session.

### 2.6 Claude Code plan mode

- Official: plan-before-edit permission mode https://code.claude.com/docs/en/common-workflows  
- Deep dive (Armin Ronacher, 2025-12-17): https://lucumr.pocoo.org/2025/12/17/what-is-plan-mode/

- **Mechanism:** not a separate tool sandbox—prompt reinjection (MUST NOT edit except plan file), 4-phase structure (understand → design → review → write final plan), ExitPlanMode reads plan file and surfaces approval UI. Plan = markdown in Claude’s plans folder; agent edits plan via Edit tool.

- **Power-user split:** many prefer explicit markdown handoffs they control (Ronacher, Amp removing plan mode cited); Boris-adjacent community tips still push “always use plan mode” + phase-gated tests + cross-model plan review (community roundups, e.g. techNmak summary mid-2026).

- **Boris-style habit (secondhand community digest, not first-party blog):** plan mode + interview questions + worktrees + phase-wise gated plans with tests + fresh-context code review + CLAUDE.md under ~200 lines. Treat as practitioner folk law; verify against current Claude Code docs for product claims.

### 2.7 Evidence: reviewing research/plans vs diffs

| Claim | Strength | Source |
| --- | --- | --- |
| Bad research/plan multiplies bad code; prefer 200-line plan over 2k diff | Strong practitioner, no RCT | HumanLayer ACE blog |
| Spec/intent review scales; line review does not under AI PR volume | Practitioner + vendor | Augment “Review the spec, not the code” https://www.augmentcode.com/blog/review-the-intent-not-the-code (2026-03); cites high AI PR reject rates / review queue math |
| Generation cheap, verification expensive; put lights on design/architecture | Synthesis of Horthy factory talk | Osmani software factories post |
| Plans improve issue resolution when aligned with model strategy; bad plan worse than none; periodic reminders help compliance | Empirical (agent trajectories) | Liu et al. arXiv:2604.12147 (2026-04) https://arxiv.org/html/2604.12147v1 — 16,991 SWE-agent trajectories |
| Stanford-style rework under AI tooling | Cited as motivation | HumanLayer (links Yegor/Stanford productivity talk) |

**Honest gap:** no large controlled study proving “plan review hours beat diff review hours” on production defect rates; the best *measured* result is plan-compliance ↔ SWE-bench success under scaffold plans, plus extensive field reports of mental-alignment collapse under unread agent diffs.

### 2.8 Plan drift mid-implementation

| Protocol | Mechanism | Source |
| --- | --- | --- |
| **Living ExecPlan rewrite** | Decision Log + Progress + full-section coherence on course change | OpenAI PLANS.md |
| **Gate reopening** | Later invalidation → earlier gate in-progress + re-approval | Software factory skill |
| **Phase compact-back** | After each implement phase, write status into plan | HumanLayer FIC |
| **plan-drift-recovery** | Stop coding; rewrite body (not footer-only); conversation vs evidence drift taxonomy | Arijit Dutta, Medium 2026-05 https://medium.com/@arijitdutta23/the-stale-plan-problem-in-coding-agents-cde2c741f8ab |
| **Let plan rot** | Common default; future sessions reassert wrong approach after compaction | Same + X practitioners on context drift |
| **Periodic plan reinjection** | Every N steps re-inject plan → fewer violations | arXiv plan compliance paper |
| **Plans outside VCS** | Avoid branch-stale docs polluting agent FS context | @dexhorthy + @paulodoestech discussion (2026-06) |

### 2.9 Plan granularity that works

| Level | Contents | When |
| --- | --- | --- |
| **Intent / milestone** | Outcomes, constraints, acceptance behaviors | Light tier, greenfield spikes, throwaway prototypes |
| **Program design** | File tree, signatures, call stack, test names, least-confident decisions | Standard brownfield features (Horthy Gate 3, HumanLayer create_plan) |
| **ExecPlan concrete** | Commands, expected transcripts, interfaces, recovery | Multi-hour autonomous Codex / long milestones |
| **Exact symbol ledgers** | Every significant export/symbol | Full/risk-tier only; brittle unless living + regenerated from research |

**Anti-patterns:** over-specifying phases that fight the model’s internalized workflow (hurts more than no plan—arXiv); freezing symbol lists that evidence will invalidate without re-open ceremony; horizontal “all layers then glue” plans.

---

## 3. Practitioner voices from X

> Format: paraphrase or tight quote · handle · date · URL · engagement when available.

1. **@dexhorthy** (2026-07-30) — On “you should not be building a software factory” (@MichaelArnaldi): agrees factories emerge from stacking small verified automations; “Figure out your bottleneck, automate it, then find the next bottleneck.”  
   https://x.com/dexhorthy/status/2082895696181817767 · ~653 likes

2. **@dexhorthy** (2026-08-03) — Clarifies factory critique: not “all factories fail” but “certain things will cause your factory to fail—don’t do those.”  
   https://x.com/dexhorthy/status/2084417166569570448 · ~87 likes

3. **@GeoffreyHuntley** (2026-07-29, quoted widely) — Factories are real but uncracked; vendors selling “the factory” outside a tiny hard-core cohort are selling bullshit; invest in sandboxing, monorepo, CI, secrets, agent DevEx.  
   https://x.com/GeoffreyHuntley/status/2082525589416923314 · ~874 likes (quoted by dex)

4. **@mattpocockuk** (2026-08-10) — Onboarding path: `/grill-me` → `/to-spec` + `/to-tickets` → `/implement` + `/code-review`; only code-review model-invocable; “Total context cost ~50-100 tokens for those skills, ~600 for the whole lot.”  
   https://x.com/mattpocockuk/status/2086933648834498649 · low likes, high signal

5. **@mattpocockuk** (2026-08-10) — After vibing an app and not reading internals: recovered via `/improve-codebase-architecture` (“lovely, warm bath of a skill”). Implicit: architecture skills as post-hoc plan recovery.  
   https://x.com/mattpocockuk/status/2086838432102228008 · ~1505 likes

6. **@dexhorthy** (2026-06-22) — Research/plan docs **should not live in core VCS**: no merge semantics needed; branch-bound plans get lost/stale; prefer external FS with linear history, still agent-accessible.  
   https://x.com/dexhorthy/status/2069143768901791934 · ~498 likes

7. **@paulodoestech** (2026-06-22) — Agrees: stale research+plan in-repo confuses agents across days; keeps research/plan **outside** repo especially for parallel agents.  
   https://x.com/paulodoestech/status/2069155424037945432

8. **@Alexvx_nft** summarizing @shmidtqq (2026-07-24) — “ASK THE AGENT FOR A PLAN FIRST / WRITE IT INTO AN .MD / after every pass: log what changed / read the file before the next move” — living plan as team fan-out state.  
   https://x.com/Alexvx_nft/status/2080631297609724411 · ~53 likes

9. **@gaoscode** (2026-07-05) — Feature request: Plan Mode as durable execution state (task graph, criteria, review gates, resume)—chat-text plans outgrow long tasks.  
   https://x.com/gaoscode/status/2073653454292361278

10. **@EugBass** (2026-08-04) — Context engineering pillars: write plans to persistent scratchpad outside window; select tools; compress; isolate subtasks.  
    https://x.com/EugBass/status/2084628688109244901 · ~26 likes

11. **@aiDotEngineer** featuring @dexhorthy 12-factor agents (2025-07-03) — Factor 3 “Own your context window,” Factor 8 “Own your control flow,” Factor 10 “Small, focused agents,” Factor 12 “stateless reducer.”  
    https://x.com/aiDotEngineer/status/1940876485939564586 · ~272 likes

12. **@omarsar0** on ACE / living playbooks (2025-10-10) — Treat prompts/memory as living playbook; append-only deltas + semantic de-dupe; execution signals as supervision (paper citation thread).  
    https://x.com/omarsar0/status/1976746822204113072 · ~1121 likes

13. **@muratcan** (2026-02-23) — Monolithic AGENTS.md: developer-written context ~+4% AGENTBENCH; LLM-generated ~−3%; prefer protocol routing + focused skill/persona files + maintenance agent.  
    https://x.com/muratcan/status/2025978504773328946 · ~383 likes

14. **@dany_dev** (2026-07-29) — Still asking peers: “are you using ExecPlan anymore? codex planning mode? PLANS.md?” — signals **pluralism and churn**, not settled monoculture.  
    https://x.com/dany_dev/status/2082372312142127359

15. **@sergeonsamui** (2026-08-07) — GSD-style 5-stage loop with fresh 200k contexts + STATE.md/CONTEXT.md against context rot (multi-agent claim).  
    https://x.com/sergeonsamui/status/2085653666678112703 · open-gsd/gsd-core

---

## 4. Contrarian / failure evidence

1. **Dark / lights-out factories rot comprehension.** Horthy’s multi-month factory experiment and Osmani’s write-up: tests green, humans lost the system; recovery is painful and late.  
2. **“Build a factory” as goal fails.** Arnaldi + Horthy: factories emerge from bottleneck automation, not top-down ceremony.  
3. **Bad plans are worse than no plan.** arXiv plan-compliance study: subpar or misaligned augmented plans degrade success; agents ignore or half-follow advisory plans without enforcement.  
4. **FIC still fails on deep domain gaps.** HumanLayer parquet-java attempt: shallow research → wrong dependency assumptions; race-condition week-long thrash.  
5. **Plan mode is not a silver product feature.** Ronacher: mostly prompt + UX; Amp reportedly removed plan mode; custom markdown handoffs often preferred.  
6. **Stale plans actively re-poison sessions.** After compaction/subagent/new session, old plan.md reasserts discarded approach (Dutta). Letting plans rot is the silent default.  
7. **In-repo plan docs can become context pollution** when stale across branches/days (dex / Paulo); event-sourced or external linear stores may beat git-tracked plans.  
8. **Process frameworks that own the SDLC** (Pocock critique of GSD/BMAD/Spec-Kit): hard to debug when the *process* is wrong; prefer small skills.  
9. **Overloading plans with early extra phases** can hurt when they fight model priors (arXiv RQ3–5).  
10. **AI PR volume without trust** → reviewers deprioritize diffs (~70% AI PR reject claims in vendor writing)—line review doesn’t scale; but abandoning all code reading is also how dark factories die. Light factory = judgment upstream *and* selective downstream reading of risky diffs.

---

## 5. Implications for beep-effect packet redesign

Opinionated mapping to the proposed redesign (pre-code gates, file/symbol ledgers, event+approval readiness, append-only control events, evidence digests, risk tiers, memoized gates).

### 5.1 Adopt (high confidence)

1. **Make plans living control surfaces, not stage labels.** ExecPlan living sections map cleanly onto append-only **control events**: `progress`, `surprise`, `decision`, `retrospective` as event types with parent digests—derive “status” from chain tip + approvals, do not store a mutable `status: implementing` field that lies.

2. **Risk-tier ceremony = Light/Standard/Full gates.**  
   - **Light:** milestone intent + acceptance behaviors + implement (Claude plan-mode equivalent or single grill→implement).  
   - **Standard:** research receipt → plan (file tree + verification) → implement phases with compact-back.  
   - **Full:** Horthy four gates, especially **Program Design** (signatures/call stack/least-confident list)—this is your “exact file change tree + significant symbols” home.

3. **Put human approval on research + plan digests, not on megadiffs.** Align with Horthy leverage cascade and mental-alignment theory. Diff review becomes *sampling + risk hotspots* (auth, money, public API, Effect service boundaries) plus automated proof, not full-line duty.

4. **Mandatory drift/amendment protocol.** On conversation override or evidence falsification: emit `plan_amended` / `gate_reopened` events; rewrite normative plan body (SPEC/PLAN) to current truth; **re-open** affected gates for Full tier; never leave “actually we changed approach” only in chat or a footer. Dutta + ExecPlan + factory backtracking all converge here.

5. **Phase boundaries = compaction + evidence receipt points.** After each vertical slice: artifact digests (tests, QA inventory, commit SHA) bound to the plan version digest that authorized the slice. Fresh agent sessions must boot from events+docs alone.

6. **Composable skills, not a mega process agent.** Packet stages as *invocable skills* (explore research, grill-with-docs, create plan, implement, drift-recovery, code-review Standards×Spec) with progressive disclosure—Anthropic + Pocock pattern. Memoize: unrelated PRs load only metadata until a gate skill fires.

### 5.2 Adapt carefully

1. **Exact symbol ledgers:** yes for Full Program Design; regenerate from research tools; treat as living set with event diffs—not a frozen checklist that freezes wrong architecture. Pair with “least-confident decisions” to force human attention where models are weakest.

2. **Plans in-repo vs external:** beep-effect already uses tracked `explorations/` + `goals/`—good for public auditability. Mitigate dex’s staleness concern via: (a) readiness from events so outdated PLAN.md without fresh approval is non-executable; (b) active vs archived plan paths; (c) branch-local plan digests in PR evidence only after gate approval.

3. **Vertical slices over horizontal packet phases.** Prefer “tracer E2E slice works” as Gate-N exit over “all schemas then all services then all UI.”

### 5.3 Avoid / challenge

1. **Do not implement dark-factory “agents approve agents” as default** without human gate digests on Product/Architecture/Program Design for Full work. Your attestation story is the lit factory, not FANUC.

2. **Do not over-encode workflow in always-on AGENTS.md.** Protocol routing + on-demand skills (muratcan evidence; Anthropic progressive disclosure). Memoized gates should mean *zero ceremony cost* when skill metadata doesn’t match the task.

3. **Do not treat plan compliance as automatic.** Build **reminders/reinjection** of the approved plan digest into implement agents (arXiv periodic reminders) and a **plan-vs-diff** checker skill for Standard/Full.

4. **Do not freeze status fields.** If readiness is truly event-derived, delete contradictory lifecycle enums or make them pure projections with no write path for agents.

### 5.4 Concrete packet shape suggestion

```
goal/<slug>/
  SPEC.md                 # normative intent (Gate1–2 outputs)
  PLAN.md                 # living program design + slices (Gate3–4)
  control/events.ndjson   # append-only: research|plan|approve|amend|progress|surprise|decision|evidence|complete
  evidence/<sha>/         # commit + artifact digests
  history/                # retrospectives
```

- **Approve** events carry human attestation payload (identity, plan_digest, risk_tier).  
- **Implement agent** refuses work unless tip projects `ready_for_impl` for that tier.  
- **Drift** → `amend` + optional `reopen_gate` before next implement.  
- **Unrelated PRs:** no plan skill load → no events → no gate tax.

---

## 6. Full source list

### Primary docs / repos
- https://developers.openai.com/cookbook/articles/codex_exec_plans  
- https://github.com/openai/openai-cookbook/blob/main/articles/codex_exec_plans.md  
- https://github.com/openai/openai-agents-python/blob/main/PLANS.md  
- https://github.com/openai/openai-agents-python/blob/main/AGENTS.md  
- https://www.humanlayer.dev/blog/advanced-context-engineering  
- https://github.com/humanlayer/advanced-context-engineering-for-coding-agents  
- https://raw.githubusercontent.com/humanlayer/humanlayer/main/.claude/commands/create_plan.md  
- https://github.com/humanlayer/humanlayer/blob/main/.claude/commands/research_codebase.md (linked from blog)  
- https://github.com/humanlayer/humanlayer/blob/main/.claude/commands/implement_plan.md (linked from blog)  
- https://gist.github.com/Maciejdziuba/88890d7e0eeefa5a8738bbe9fd5e20b8  
- https://github.com/mattpocock/skills  
- https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices  
- https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills  
- https://code.claude.com/docs/en/common-workflows  
- https://lucumr.pocoo.org/2025/12/17/what-is-plan-mode/  
- https://addyosmani.com/blog/software-factories/  
- https://www.augmentcode.com/blog/review-the-intent-not-the-code  
- https://medium.com/@arijitdutta23/the-stale-plan-problem-in-coding-agents-cde2c741f8ab  
- https://arxiv.org/html/2604.12147v1 (Liu et al., plan compliance, 2026)  
- https://github.com/humanlayer/12-factor-agents  
- https://www.youtube.com/watch?v=rmvDxxNubIg (Horthy, No Vibes Allowed)  
- https://www.youtube.com/watch?v=IS_y40zY-hc (Advanced Context Engineering)  
- https://www.youtube.com/watch?v=8rABwKRsec4 (Sean Grove, Specs are the new code)  
- https://www.heavybit.com/library/podcasts/high-leverage/ep-12-the-limits-of-lights-out-coding-with-dexter-horthy  

### Secondary / community
- https://github.com/open-gsd/gsd-core  
- https://community.openai.com/t/plans-md-file-mentioned-in-the-shipping-with-codex-talk-at-dev-day/1361628  
- https://latitude.so/blog/context-engineering-guide-coding-agents  
- https://codewithmukesh.com/blog/plan-mode-claude-code/  
- https://hannahstulberg.substack.com/p/claude-code-for-everything-how-the  
- https://dev.to/jamilxt/superpowers-vs-agent-skills-vs-pocock-three-philosophies-of-ai-coding-workflows-e6n  
- https://github.com/intelligent-internet/ii-agent/blob/0e57985d3f6e5c8ea340418ed259665b8e86301d/docs/PLANS.md  
- https://github.com/tiann/execplan-skill (community ExecPlan skill; cited in Hermes plugin discourse)

### X posts cited above
- https://x.com/dexhorthy/status/2082895696181817767  
- https://x.com/dexhorthy/status/2084417166569570448  
- https://x.com/GeoffreyHuntley/status/2082525589416923314  
- https://x.com/mattpocockuk/status/2086933648834498649  
- https://x.com/mattpocockuk/status/2086838432102228008  
- https://x.com/dexhorthy/status/2069143768901791934  
- https://x.com/paulodoestech/status/2069155424037945432  
- https://x.com/Alexvx_nft/status/2080631297609724411  
- https://x.com/gaoscode/status/2073653454292361278  
- https://x.com/EugBass/status/2084628688109244901  
- https://x.com/aiDotEngineer/status/1940876485939564586  
- https://x.com/omarsar0/status/1976746822204113072  
- https://x.com/muratcan/status/2025978504773328946  
- https://x.com/dany_dev/status/2082372312142127359  
- https://x.com/sergeonsamui/status/2085653666678112703  
- https://x.com/dexhorthy/status/2083210700474986728 (factory won’t save a bad business)

---

*End of report. No URLs fabricated; engagement counts from tool snapshots at research time and may change.*
