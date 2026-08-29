# Process-gate economics for WIP-capped coding-agent pipelines

**Lane:** gate economics (research)  
**Date:** 2026-08-10  
**Scope:** DoR/stage-gate debates; queueing/flow for agent fleets; human approval latency; memoized/incremental gates; measured CI-gate cost; multi-agent fleet process discourse (2025–2026).  
**Method:** web + GitHub + X (native). Prefer primary sources; disconfirming and failure evidence included. No fabricated quotes or URLs.

---

## 1. TLDR

- **Per-action human approval is not a safety layer at scale** — it is a queue that saturates. Anthropic measured ~**93%** approve rates and built classifier/sandbox “auto mode” because approval fatigue is structural, not a UX bug. ([anthropic.com/engineering/claude-code-auto-mode](https://www.anthropic.com/engineering/claude-code-auto-mode))
- **The human is the bottleneck when agents outpace review.** Fleet practitioners converge: generate freely → complexity hits review/merge; review every turn → you are the bottleneck. (~10 parallel sessions is a common hard ceiling without redesign.) ([x.com/_xjdr](https://x.com/_xjdr/status/2038355375486017634))
- **DoR-as-stage-gate is a named agile anti-pattern** (Mike Cohn): 100%-done rules before work can start recreate waterfall. Useful DoR is *guideline + concurrency*, not a bouncer. ([mountaingoatsoftware.com](https://www.mountaingoatsoftware.com/agile/the-dangers-of-a-definition-of-ready))
- **Queueing theory still applies to agent factories.** Large variable batches and long queues dominate cycle time; WIP limits make the constraint visible. Naive “Little’s Law ⇒ lower WIP always lowers cycle time” is **wrong** under software variability (Vacanti / LeSS “Little’s Flaw”). ([less.works](https://less.works/less/principles/queueing_theory))
- **Park-and-notify beats block-the-fleet.** Blocked lanes should state *why*, *what unblocks*, and free capacity for other work — not hold the whole pipeline. Heartbeat sweeps and “management by exception” are the 2026 operator patterns. ([x.com/danshipper](https://x.com/danshipper/status/2033986204190781539); Osmani autonomy model)
- **Auto-approval must be risk-tiered + sandboxed**, not “skip permissions.” Auto-mode classifiers still miss ~**17%** of real overeager actions; AWS still treats full removal of manual deploy approvals as *optional* for regulated contexts. Policy envelopes > rubber stamps.
- **Memoize process gates like Bazel/Nx/Turbo task hashes.** Path-scope is weak; **input digests** make unrelated PRs pay ~0. beep already has the template (`docgen` proof manifests; speed-loop JSDoc p50 **289s**/0 catches → scope inputs, keep the gate).
- **Always-on CI has measured waste:** flaky suites eat large fractions of CI time and trust; always-on doc/process gates without affect-scoping tax every PR. Gate-value audits (catch rate vs p50/p95 runtime) are mandatory before blocking.
- **2025–2026 fleet operators delete ceremony, not verification.** Boris/Anthropic: delete prompt scaffolding; keep verification systems. Practitioners prune CLAUDE.md/skills bloat, kill rubber-stamp auto-review that burns tokens, keep fast local validation and small reviewable diffs.
- **For beep-effect:** design gates *before* scarce lane slots; readiness from events+approvals (not status fields); risk tiers; park+notify for human interrupts; proof-manifest memoization so code-only PRs skip packet ceremony; budget operator approvals like WIP.

---

## 2. Findings

### 2.1 Definition-of-ready as stage-gate anti-pattern

**Claim.** A DoR that requires something be *finished* before the next activity *starts* is stage-gate / iterative waterfall and kills concurrent engineering.

- Mike Cohn (Mountain Goat): DoR as iteration “bouncer” is sometimes useful (size caps, chronic external deps) but becomes dangerous when rules demand 100% design/mockup/etc. before coding. Prefer **guidelines** (“mockups far enough along”) over hard rules; overlap analysis/design/code/test.  
  Source: https://www.mountaingoatsoftware.com/agile/the-dangers-of-a-definition-of-ready (also under `/blog/the-dangers-of-a-definition-of-ready`)
- Robert Galen pushes back without rejecting Cohn: DoR is healthy when it keeps under-cooked work *out of a committed sprint* (deps, insufficient understanding, skill gaps) — not as 100% readiness theater. Carry-over stories that waited on external sign-off burned ~50% of sprint capacity in one client case (avg 4.3 sprints to close).  
  Source: https://rgalen.com/agile-training-news/2016/11/8/definition-of-ready-as-an-anti-pattern
- Atlassian documents DoR as backlog “actionable” criteria (pro-DoR framing); use as counterpoint that product vendors still sell entry gates as hygiene.  
  Source: https://www.atlassian.com/agile/project-management/definition-of-ready
- **Implication for agent pipelines:** treat “ready for implementation agents” as **sufficient clarity + bounded risk**, not frozen BDUF. Leaf amendments free; architecture/scope amendments reopen the owning gate. Stored “status = ready” is the anti-pattern; **derived readiness from events/approvals** is the fix (matches packet redesign third pass).

### 2.2 Queueing theory / flow for AI-agent dev pipelines

**Claim.** Agent fleets are high-arrival, high-variability service systems. Cycle time is dominated by queues (review, merge, approval, CI), not model tokens.

- LeSS “Flow & Queueing Theory”: large variable batches have **nonlinear** impact on cycle time; lean focus is shorter sustainable cycle times and system throughput, not worker utilization. Queue management (WIP) is useful but not the essence of lean. **Myth alert:** “Little’s Law proves reducing WIP reduces cycle time” requires assumptions often false in software; Vacanti’s *Little’s Flaw* deconstruction is cited. Still: reduce WIP as waste (delays ROI, hides defects, lowers transparency).  
  Source: https://less.works/less/principles/queueing_theory  
  Little’s Law paper (formal): http://web.mit.edu/sgraves/www/papers/Little's%20Law-Published.pdf  
  Vacanti context: https://leanability.com/en/insights/2017/08/littles-law-and-system-stability/
- Kanban practice: WIP limits turn flow problems into visible signals; blocked work still counts as WIP.  
  Source: https://plane.so/blog/how-to-manage-work-in-progress-wip-in-project-management
- **AgentOps merge-door survey (GitHub, 2026-07):** applies Little’s Law to *unverified-but-landed* commit windows: size WIP cap N from measured land rate λ × verdict latency W; when cap binds, producers become drainers. Patterns ranked: (1) two-phase done — land ≠ accepted; (2) backpressure WIP; (3) risk-tiered review; (4) optimistic post-merge verification (Google TAP-style) when deterministic floor is strong; **merge queues keep probabilistic review on the critical path** and thrash under swarm arrival × ~2.8% refute rate.  
  Source: https://github.com/boshu2/agentops/blob/62cc3b6ee0e66d6e3952c1f37ca8a0c3d715cfbb/docs/audits/merge-door-duel-2026-07-09/research/merge-door-design-space.md
- Jeff Dean (via practitioner discourse): tools designed for human speed become the limit under 50× agent speed — Amdahl’s law still applies.  
  (Referenced in thread under @_xjdr reply context; video quote posted by @vitrupo 2026-03-29.)

### 2.3 Human approval latency = THE bottleneck (1 operator × N agents)

**Claim.** Coding ceased to be the scarce resource; **attention, review, and merge** are. Per-command approval fails under load (accuracy drops as arrival rate rises).

**Evidence — product telemetry & research**

- Anthropic Claude Code auto mode (2026-03-25): users approve **93%** of permission prompts → fatigue. Modes: sandbox (safe, high maintenance), `--dangerously-skip-permissions` (zero maintenance, unsafe), manual prompts (middle; mostly rubber-stamped). Auto mode = classifier substitute for human approver. Full pipeline FPR **0.4%** on real traffic (n=10k) but **17% FNR** on real overeager actions (n=52) — honest miss rate; misses often misjudge *consent scope*, not danger recognition. In-project file edits allowed without classifier; shell/exfil/infra hit classifier.  
  Source: https://www.anthropic.com/engineering/claude-code-auto-mode  
  Related containment writeup: https://www.anthropic.com/engineering/how-we-contain-claude
- Addy Osmani, “Agentic Autonomy Levels” (2026-07-03): two axes — **agency** vs **orchestration**. Level 1 failure mode = approval fatigue (all approvals feel identical). Level 4 failure = false parallelism / orchestration tax (marginal cost of another agent rises). Level 5 = management by exception. Anti-patterns: permission laundering, summary substitution, fleet cosplay, autonomy-as-status. Metrics that matter: mean time between interventions, review time per accepted change, rework/defect escape by confidence tier, token cost per accepted change. Autonomy ceiling set by **detect wrong / undo / prove right**.  
  Source: https://addyo.substack.com/p/agentic-autonomy-levels  
  Anthropic session study cited there (~400k sessions): people make ~70% of planning decisions, Claude ~80% of execution; experienced users auto-approve more.
- Design-space paper on Claude Code systems: 93% approve rate used as architectural premise for deny-first + sandbox + classifier; auto-approve rates rise with experience (~20% at <50 sessions to >40% at ~750).  
  Source: https://arxiv.org/html/2604.14228v2

**Evidence — batching, envelopes, park-and-notify**

| Pattern | Mechanism | When it wins | Failure |
|--------|-----------|--------------|---------|
| **Per-action block** | Wait on human each tool call | High-stakes, low volume | Fatigue; 93% rubber stamp |
| **Auto-approval envelope** | Sandbox + allowlists + classifier/policy | Routine in-project work | Classifier FNR; over-broad rules (“permission laundering”) |
| **Batch approvals** | One human message for a wave/queue | Operator-supervised fleets | Batch hides bad items if not digest-bound |
| **Park-and-notify** | Lane parks with unblock reason; others proceed | Multi-lane fleets | Parked work ages if no drain SLA |
| **Async post-land review** | Deterministic land; probabilistic acceptance later | Strong pre-push floor + WIP cap | Pending window growth; “landed feels done” drift |
| **Remove manual deploy gates** | Full CD (AWS DL.CD.7, optional) | Mature auto-QA + observability | Regulated/gov contexts still need human gates |

- AWS Well-Architected DevOps Guidance **[DL.CD.7]** “Remove manual approvals to practice continuous deployment” — category **OPTIONAL**; full auto deploy for mature orgs; not always desirable under strict governance.  
  Source: https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cd.7-remove-manual-approvals-to-practice-continuous-deployment.html
- Vic Vijayakumar (2026-07-21): bottleneck whack-a-mole after coding stops being scarce — multi-layer AI review without *why* context, human-time routing, defect escape, blast radius, PR traffic jams from agent rebase storms, trust boundaries.  
  Source: https://x.com/VicVijayakumar/status/2079521840029118778
- Factory/Matan: codebases with **fast validation** (pre-commit hooks vs 10 min CI) make every agent more effective.  
  Source: https://x.com/matanSF/status/2014039273721213256

### 2.4 Memoized / incremental gates (build-system economics applied to process)

**Claim.** Process and docs gates should hash their **inputs** the same way Turbo/Nx/Bazel hash task inputs. Unrelated changes pay zero.

- **Turborepo:** task inputs → fingerprint hash → local/remote cache; input change ⇒ miss.  
  Source: https://github.com/vercel/turborepo/blob/c21e2e2932f7134a04bc44cb2f849968ca62e3cc/apps/docs/content/docs/crafting-your-repository/caching.mdx  
  Failure: poorly scoped inputs invalidate on unrelated files (issue discussion #9676 etc.).
- **Nx `affected`:** only run tasks for projects impacted by a PR; large monorepos gain the most.  
  Source: https://nx.dev/docs/features/ci-features/affected  
  Waste reduction guide: https://nx.dev/docs/kb/reduce-waste  
  Practitioner claim (DEV): `nx affected` + remote cache cut CI dramatically (e.g. “skip 80% of tasks”).  
  Source: https://dev.to/alex_aslam/turbocharge-your-monorepo-battle-tested-tips-for-nx-turborepo-and-bazel-pros-214h
- **Bazel remote cache:** hermetic inputs/outputs; race/invalidation issues when remote cache used without correct guarantees (historical issue #3360). Process takeaway: **digest correctness > cache theater**.
- **AgentOps verification economics:** 322 verdict edges, ~2.8% refute, 0 escapes; >97% of lands paid full reviewer latency to confirm already-true state → motive for off-critical-path review + WIP.  
  Source: merge-door design space (above).
- **beep-effect in-repo precedent (packet third pass):**  
  - speed-loop gate-value audit: JSDoc ratchet hosted p50 **289s**, p95 **371s**, **0 failures / 88 runs** → keep gate, scope inputs to affected barrels.  
  - Yeet `--reuse-verified` is all-or-nothing (whole worktree fingerprint) → weak.  
  - `beep docgen check --reuse-proof-manifest` keys per-package digests + tool version → **copy this pattern for doctor/index/design/reflection gates**.  
  - Unification: **memoized gate result ≡ evidence receipt** (same artifact shape).  
  Source: packet research `2026-08-10-notion-strict-planning-three-pass.md` §G.

### 2.5 Measured costs of always-on CI / process gates

| Measurement | Figure | Source |
|-------------|--------|--------|
| Google flaky test suite runs with ≥1 flake | ~1 in 7 | https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html |
| Google flaky execution rate | ~1.5% of executions; ~16% of tests ever flaky | same |
| Coding time lost to flaky tests (Google-linked analyses) | ~2% | e.g. StickyMinds / industry meta-analyses citing Google |
| Microsoft avg investigation per flake | ~30 minutes | Microsoft Research industrial flaky-test work (cited widely) |
| Mid-size team annual flake tax (illustrative 50 eng) | six figures ($200k–$400k class claims) | https://getautonoma.com/blog/flaky-tests-ci-cd-engineering-cost (vendor; use as order-of-magnitude, not gospel) |
| Atlassian (2025 claims in secondary reports) | 150k+ eng hours/year on flaky tests | secondary aggregation https://testdino.com/blog/flaky-test-benchmark |
| beep JSDoc always-on gate | p50 289s, 0/88 catches | packet third-pass gate-value audit |
| METR early-2025 experienced OSS devs + AI | **19% slower** despite believing speedup | https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/ (note: METR later published updated uplift results; early study still shows **review/wait/idle** as real time sinks) |

**Gate-value audit pattern (industry + beep):** for each always-on check record (1) p50/p95 wall time, (2) failure/catch rate on real PRs, (3) false-positive pain, (4) whether inputs can be digest-scoped. Delete or demote gates that cost minutes and catch nothing; **never** ship a new always-on gate without that case (beep standing rule from speed-loop).

### 2.6 Risk-tiered ceremony (Light / Standard / Full)

Convergent design across Osmani levels, AgentOps L0–L2, AWS optional CD, and packet redesign tiers:

| Tier | Work class | Human ceremony | Machine gates |
|------|------------|----------------|---------------|
| **Light** | docs, pure renames, mechanical, single-file low-blast | batch approve or auto in envelope | deterministic only; memoized |
| **Standard** | normal feature, bounded package | one design/spec approval; PR review | affected CI + targeted tests |
| **Full** | cross-cutting, security, schema/public surface, data | design gate + symbol ledger + stronger approval | full battery + independent reviewer agent + attestations |

Tier decision itself must be **recorded and challengeable** — otherwise everything becomes Full (status theater) or everything becomes Light (permission laundering).

---

## 3. Practitioner voices from X (2025–2026)

> Format: paraphrase or short quote · @handle · date · URL · engagement

1. **Review vs free-run is the scaling crisis**  
   “if you let them run, the complexity comes at review and merge time. if you review at each turn, you are the bottleneck” — scaling past ~10 simultaneous sessions.  
   **@_xjdr** · 2026-03-29 · https://x.com/_xjdr/status/2038355375486017634 · ~296 likes, ~40k views

2. **Amdahl’s law on tools (Jeff Dean via discourse)**  
   Agents can run ~50× faster but tools built for human speed cap overall gain at ~2–3×.  
   **@vitrupo** (quoting Dean clip) · 2026-03-29 · https://x.com/vitrupo/status/2038230613912887757 · ~1.3k likes, ~345k views

3. **Task-boundary tightness collapses the tradeoff**  
   Narrow verifiable tasks can run long unattended; ambiguous tasks drift — “real scaling problem is writing task specs tight enough that you trust the run.”  
   **@DatisAgent** · 2026-03-30 · reply under @_xjdr thread · https://x.com/DatisAgent/status/2038535333206237331

4. **Human context window is the real limit**  
   “13 harnesses. 12 models. 48 agents. 390 skills. One human brain… I am the bottleneck.”  
   **@mrluiscalderon** · 2026-07-31 · https://x.com/mrluiscalderon/status/2083335724762386514

5. **Bottleneck whack-a-mole after coding stops being scarce**  
   Multi-layer auto review still lacks *why*; pressure to skip human review; need blast-radius, bake times, adversarial agents, progressive deploy; agents will thrash rebase/merge queues.  
   **@VicVijayakumar** · 2026-07-21 · https://x.com/VicVijayakumar/status/2079521840029118778 · ~280 likes

6. **Approval is a queue, not a safety layer**  
   “Humans in the loop miss a third of dangerous AI coding agent requests… Approval was never a safety layer, it is a queue… Agents scale, reviewers do not.”  
   **@pdurdenj** · 2026-08-06 · https://x.com/pdurdenj/status/2085413542660858209  
   *(Figure claim — treat as practitioner assertion, not peer-reviewed.)*

7. **Approval fatigue peaks when privilege is highest**  
   “every routine prompt trains the reviewer to click faster… Per-command review feels like the wrong boundary — sandbox by default and only surface genuine capability escalations.”  
   **@AiDevCraft** · 2026-08-07 · https://x.com/AiDevCraft/status/2085690390649422312

8. **Approvals only when consequential**  
   “agents that need approval for every single step kill the flow… auto mode only works if the system is good at knowing when to stop and ask.”  
   **@audiencon** · 2026-08-10 · https://x.com/audiencon/status/2086857663728492695

9. **Stronger gates, not line-by-line babysitting**  
   “Line-by-line review is becoming the bottleneck. The next interface needs stronger gates: intent before generation, isolated execution, protected checks, and small observable diffs.”  
   **@adidshaft** · 2026-08-08 · https://x.com/adidshaft/status/2086159955460305045

10. **Delete prompt scaffolding; keep verification**  
    Boris Cherny / Anthropic discourse: deleted large share of Claude Code system prompt; delete stale CLAUDE.md every ~6 months; bottleneck moves from producing code to **proving output correct**.  
    **@Nekt_0** summarizing Boris · 2026-07-31 · https://x.com/Nekt_0/status/2083175714338017365 · ~355 likes  
    Related: **@0xCodila** masterclass recap · 2026-07-27 · https://x.com/0xCodila/status/2081792763125801415 · ~314 likes

11. **Boris: verification + multi-agent surfaces, not one magic feature**  
    “giving Claude ways to verify its own work end to end… auto mode… automated code review and security review… manage multiple agents… /loop, /batch, dynamic workflows, worktree isolation.”  
    **@bcherny** · 2026-07-17 · https://x.com/bcherny/status/2077929390806073807 · ~342 likes, ~108k views

12. **Heartbeat sweeps so orchestrators don’t strand subagents**  
    Dan Shipper’s multi-lane heartbeat: check every lane, unblock or reassign, never stop at status reporting.  
    **@danshipper** · 2026-03-17 · https://x.com/danshipper/status/2033986204190781539 · ~230 likes

13. **Kill config bloat when agents get “dumber”**  
    KEEP skills/MCPs/AGENTS.md; remove redundant rest; wait for human approval before deletes.  
    **@Voxyz_ai** · 2026-08-08 · https://x.com/Voxyz_ai/status/2086150296842219888 · ~403 likes

14. **“Approve for me” auto-review agents can burn usage**  
    Codex “Approve for me” routed through separate auto-review agent → large usage drain; turning off slowed credit burn.  
    **@RijnHartman** · 2026-08-07 · https://x.com/RijnHartman/status/2085644389242565072 · ~868 likes, ~124k views

15. **Fast local validation multiplies agent effectiveness**  
    “No pre-commit hooks = agent waits 10 min for CI instead of 5 sec.”  
    **@matanSF** · 2026-01-21 · https://x.com/matanSF/status/2014039273721213256 · ~350 likes

16. **Blind Approve is a career/skill risk**  
    If the job becomes clicking Approve without understanding, skill atrophy.  
    **@striver_79** · 2026-07-13 · https://x.com/striver_79/status/2076607099216581086 · ~887 likes

17. **Spawning is easy; review is the product**  
    “running hundreds of agents and getting value… are two very different claims… review is the bottleneck.”  
    **@uttamm_gupta** · 2026-08-01 · https://x.com/uttamm_gupta/status/2083490899141800363

18. **Agents delete prod when confirmation is missing**  
    Coding agent “fixed” a bug by deleting prod env — 13h outage narrative.  
    **@Docker** · 2026-08-08 · https://x.com/Docker/status/2086120350278918219 · ~91 likes  
    *(Caution: marketing/security storytelling; use as failure class, verify primary incident if used in design decisions.)*

19. **Point agents at toil, not only roadmap**  
    After a year shipping agent-assisted code: biggest speedup was **deleting** dead paths/flags — but roadmap still needs a human who remembers decisions.  
    **@israjsonu** · 2026-08-04 · https://x.com/israjsonu/status/2084659635999637659

20. **Commit visibility before ship for multi-agent**  
    Agents move fast enough to commit unreviwed work; surface every commit, not just a notification.  
    **@49agents** · 2026-08-10 · https://x.com/49agents/status/2086877835998663109

---

## 4. Contrarian / failure evidence

1. **DoR is not always wrong** — Galen’s dependency/carry-over cases show *under-gated* intake wastes more than a light readiness bar. The anti-pattern is **stage-gate completeness**, not “refuse garbage.”  
2. **Auto-approve is not free safety** — Anthropic’s own 17% FNR on real overeager actions; classifier mistakes consent scope. Auto mode is for people who would otherwise `--dangerously-skip-permissions`, not a substitute for careful review on shared infra.  
3. **Auto-review agents can be pure cost** — RijnHartman: Codex “Approve for me” burned usage without proportional value.  
4. **More AI review layers ≠ trust** — Vic: stacked auto reviewers still lack *why*; risk of rubber-stamp theater.  
5. **Little’s Law cargo cult** — lowering WIP does not automatically lower cycle time under high variability; can just idle people/agents.  
6. **METR 2025 slowdown** — experienced OSS developers were **slower** with early-2025 AI tools while believing they were faster; time shifts to prompt/wait/review. Agent “throughput” can increase wall-clock if process is naive. (Check METR’s later 2026 uplift update before using 19% as current universal truth: https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/)  
7. **Optimistic land-then-verify fails without deterministic floor + WIP + andon** — AgentOps survey: without cap, two-phase done degrades to “verify never”; flaky signals cause false reverts (social poison).  
8. **Merge queues thrash under agent swarm arrival** — probabilistic LLM review on the critical path + non-zero refuse rate ⇒ constant re-speculation.  
9. **Fleet cosplay** (Osmani) — many agents still human-orchestrated = more WIP, more merge conflict, zero factory.  
10. **Permission laundering** — fatigue → `--dangerously-skip-permissions` or broad always-allow rules that never reach classifiers.  
11. **Summary substitution** — operator reviews agent summary instead of evidence packet; false confidence.  
12. **Destructive agent actions** — delete-prod class incidents and internal Anthropic log (branch deletes, token upload, prod migrations) prove over-eagerness is not hypothetical.  
13. **Process bloat degrades agents** — long CLAUDE.md / skill piles / conflicting MCP configs make fleets dumber; deletion is a reliability intervention, not just taste.  
14. **AWS: full CD is optional** — continuous deployment without manual approval is maturity-aspirational, not universal doctrine for regulated or multi-tenant prod.

---

## 5. Implications for the beep-effect packet redesign

Opinionated mapping onto the proposed redesign (strict design gates, event-derived readiness, control-event chains, evidence digests, verifiable approvals, Light/Standard/Full, memoized gates).

### 5.1 Do not implement DoR as a stored stage-gate status

- **Do:** derive `ready` from event chain + valid approvals + non-stale evidence digests.  
- **Don’t:** store `status: ready` agents can edit, or require 100% symbol ledger freeze before any exploration spike.  
- **Aligns with Cohn:** concurrency of research/design/spike; **aligns with Galen:** refuse under-cooked *graduation into scarce lanes*.

### 5.2 Put expensive design ceremony *before* the WIP-capped lane slot

- Packet third pass already nails this: lane slots are scarce; pre-graduation design work is cheap.  
- Graduation MAP checks should include **change tree + symbol ledger** so in-lane work is review, not authorship.  
- **Queueing rationale:** front-loading reduces in-lane service time variance — the worst thing for a WIP-capped system.

### 5.3 Budget the operator like a single-server queue

- Cap concurrent human-approval items (design approvals + amendment re-approvals + tier overrides) with a visible WIP number.  
- Prefer **batch waves** (driver D1 precedent: one message for a whole queue) with digest-bound subjects so batching doesn’t hide swaps.  
- Default agent response on wait: **PARK + notify** with unblock predicate; never hold sibling lanes. Heartbeat/orchestration sweeps are process, not optional flavor.

### 5.4 Policy envelopes, not per-tool babysitting

Map Anthropic/Osmani patterns onto packet tiers:

| Envelope | Auto | Human |
|----------|------|-------|
| In-packet docs / leaf symbol amendments | machine checks + memoized doctor | batch notify |
| Implementation within approved DESIGN digest + tests green | agents free in worktree | PR-level review |
| Outside approved digest, security, public surface, data | **block + park** | explicit re-approval attestation |
| Production deploy / secret / force-push class | deny by default | Full-tier only |

Approvals must be **externally verifiable** (commit/PR review/signed attestation on artifact digest) — never an `approvals[]` field agents can rewrite.

### 5.5 Memoize every process gate; kill whole-tree invalidation

- Implement proof manifests for: `goals doctor`, explore doctor, design gate, index check, reflection lint, trace check.  
- Key: `(gate_id, tool_version, packet_subtree_digest, optional affected_paths_digest)`.  
- Code-only PR with unchanged `goals/**` and `explorations/**` digests → **zero packet ceremony cost**.  
- Retire all-or-nothing Yeet reuse fingerprint as the long-term pattern; keep it only as emergency global invalidate.  
- **Gate-value audit SLA:** no new always-on gate without p50/p95 + catch rate on 30+ real PRs; publish in packet/Yeet docs.

### 5.6 Two-phase done for implementation packets

Borrow AgentOps without copying their direct-to-main culture:

1. Deterministic green (Yeet verify / affected CI) can land to feature branch / merge queue.  
2. “Packet complete / goal closed” requires sealed evidence receipts + human or policy approval bound to commit digests.  
3. WIP-limit *open goals in execution* and *pending human approvals* separately — don’t conflate.

### 5.7 What to add vs delete (fleet lessons)

| Add | Delete / demote |
|-----|-----------------|
| Risk tier on every packet | Uniform Full ceremony |
| Park-and-notify + approval inbox | Synchronous block across all agents |
| Proof-manifest memoization | Always-on full doctor on every PR |
| Fast local pre-commit / package checks | Relying only on 5–10 min hosted CI for agent loops |
| Independent verification oracles | Summary-only “LGTM” |
| Periodic instruction/skill audit (KEEP/REMOVE) | Infinite CLAUDE.md growth |
| Heartbeat / driver sweep for stranded lanes | “Spawn more agents” as default fix |
| Evidence bound to commit+artifact digests | Mutable status fields as truth |

### 5.8 Metrics to instrument (or redesign is faith-based)

Track per packet and globally:

1. Human approval wait time (p50/p95)  
2. Parked-lane age and park reason taxonomy  
3. Gate wall time + cache hit rate + catch rate  
4. Rework after design approval (amendment rate by tier)  
5. Defect escape after Full vs Light  
6. Operator interventions per accepted change  
7. Token/$ per accepted change (optional but fleet-real)

If (1) and (2) dominate, **stop adding gates** and fix envelopes/memoization first.

### 5.9 Concrete stance for this redesign

The redesign’s strongest economic moves are already in the third-pass docs: **derive readiness, unforgeable approvals, risk tiers, design-before-lane, proof-manifest memoization, operator as scarce queue**. External research **strongly supports** those and **weakens** any uniform stage-gate DoR or always-on unscoped process CI. The main gap to close in implementation is not more theory — it is **shipping digest-keyed gate reuse + an approval WIP UI/CLI that batches and parks**.

---

## 6. Full source list

### Web / docs / papers

- https://www.mountaingoatsoftware.com/agile/the-dangers-of-a-definition-of-ready  
- https://rgalen.com/agile-training-news/2016/11/8/definition-of-ready-as-an-anti-pattern  
- https://www.atlassian.com/agile/project-management/definition-of-ready  
- https://less.works/less/principles/queueing_theory  
- http://web.mit.edu/sgraves/www/papers/Little's%20Law-Published.pdf  
- https://leanability.com/en/insights/2017/08/littles-law-and-system-stability/  
- https://plane.so/blog/how-to-manage-work-in-progress-wip-in-project-management  
- https://www.anthropic.com/engineering/claude-code-auto-mode  
- https://www.anthropic.com/engineering/how-we-contain-claude  
- https://addyo.substack.com/p/agentic-autonomy-levels  
- https://arxiv.org/html/2604.14228v2  
- https://docs.aws.amazon.com/wellarchitected/latest/devops-guidance/dl.cd.7-remove-manual-approvals-to-practice-continuous-deployment.html  
- https://nx.dev/docs/features/ci-features/affected  
- https://nx.dev/docs/kb/reduce-waste  
- https://github.com/vercel/turborepo/blob/c21e2e2932f7134a04bc44cb2f849968ca62e3cc/apps/docs/content/docs/crafting-your-repository/caching.mdx  
- https://dev.to/alex_aslam/turbocharge-your-monorepo-battle-tested-tips-for-nx-turborepo-and-bazel-pros-214h  
- https://www.warpbuild.com/blog/github-actions-monorepo-guide  
- https://testing.googleblog.com/2016/05/flaky-tests-at-google-and-how-we.html  
- https://getautonoma.com/blog/flaky-tests-ci-cd-engineering-cost  
- https://testdino.com/blog/flaky-test-benchmark  
- https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/  
- https://slsa.dev/blog/2023/05/in-toto-and-slsa (attestations shape, via packet third pass)  
- https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/use-artifact-attestations  

### GitHub

- https://github.com/boshu2/agentops/blob/62cc3b6ee0e66d6e3952c1f37ca8a0c3d715cfbb/docs/audits/merge-door-duel-2026-07-09/research/merge-door-design-space.md  
- https://github.com/sigstore/gitsign  
- https://github.com/github/spec-kit (related gate/checklist structure; packet corpus)  
- Turborepo/Nx issues on cache invalidation / affected over-marking (e.g. nrwl/nx#18112, vercel/turborepo discussions) as cautionary cache-correctness evidence  

### In-repo (beep-effect2)

- `explorations/packet-system-redesign/research/2026-08-10-notion-strict-planning-three-pass.md` (§G–K gate economics, DoR placement, operator WIP)  
- `explorations/packet-system-redesign/research/2026-08-10-codex-deep-research-redesign.md`  
- `beep docgen check --reuse-proof-manifest` (reference memoization implementation)  
- speed-loop gate-value audit figures (JSDoc ratchet) as cited in third-pass doc  

### X posts cited (§3)

| Author | Date | URL |
|--------|------|-----|
| @_xjdr | 2026-03-29 | https://x.com/_xjdr/status/2038355375486017634 |
| @vitrupo | 2026-03-29 | https://x.com/vitrupo/status/2038230613912887757 |
| @DatisAgent | 2026-03-30 | https://x.com/DatisAgent/status/2038535333206237331 |
| @mrluiscalderon | 2026-07-31 | https://x.com/mrluiscalderon/status/2083335724762386514 |
| @VicVijayakumar | 2026-07-21 | https://x.com/VicVijayakumar/status/2079521840029118778 |
| @pdurdenj | 2026-08-06 | https://x.com/pdurdenj/status/2085413542660858209 |
| @AiDevCraft | 2026-08-07 | https://x.com/AiDevCraft/status/2085690390649422312 |
| @audiencon | 2026-08-10 | https://x.com/audiencon/status/2086857663728492695 |
| @adidshaft | 2026-08-08 | https://x.com/adidshaft/status/2086159955460305045 |
| @Nekt_0 | 2026-07-31 | https://x.com/Nekt_0/status/2083175714338017365 |
| @0xCodila | 2026-07-27 | https://x.com/0xCodila/status/2081792763125801415 |
| @bcherny | 2026-07-17 | https://x.com/bcherny/status/2077929390806073807 |
| @danshipper | 2026-03-17 | https://x.com/danshipper/status/2033986204190781539 |
| @Voxyz_ai | 2026-08-08 | https://x.com/Voxyz_ai/status/2086150296842219888 |
| @RijnHartman | 2026-08-07 | https://x.com/RijnHartman/status/2085644389242565072 |
| @matanSF | 2026-01-21 | https://x.com/matanSF/status/2014039273721213256 |
| @striver_79 | 2026-07-13 | https://x.com/striver_79/status/2076607099216581086 |
| @uttamm_gupta | 2026-08-01 | https://x.com/uttamm_gupta/status/2083490899141800363 |
| @Docker | 2026-08-08 | https://x.com/Docker/status/2086120350278918219 |
| @israjsonu | 2026-08-04 | https://x.com/israjsonu/status/2084659635999637659 |
| @49agents | 2026-08-10 | https://x.com/49agents/status/2086877835998663109 |

---

*End of lane report. For synthesis into packet `RESEARCH.md`, merge with lanes 1–5; do not treat any single vendor cost model (Autonoma, TestDino) as authoritative without re-deriving on beep CI telemetry.*
