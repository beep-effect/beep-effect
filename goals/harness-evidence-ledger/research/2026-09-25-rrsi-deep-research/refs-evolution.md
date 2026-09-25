# RRSI reference lineage: harness evolution (arXiv 2609.24972 refs)

Source: alphaXiv full-text queries (answer_pdf_queries), 2026-09-25. Letters (a)–(i) follow the brief:
(a) harness/editable components, (b) proposal + feedback, (c) selection/acceptance (noise/cost/leakage),
(d) evolve vs held-out vs OOD, (e) edit attribution, (f) history/ledger, (g) pruning, (h) headline + gap,
(i) budget/sparsity/annealing. "n.r." = not reported in the pages retrieved.

---

## 1. Recursive Harness Self-Improvement (RHI) — Lee, Xu, Seely, Lee, Zaharia, Tang (Sakana/Berkeley) — 2607.15524

- (a) Harness = a *prompt-level* spec of a multi-agent loop: agent roles, instructions, contracts (what each subagent
  returns to the orchestrator) and hops (workflow steps), plus induced "auxiliary rules" (acceptance gates, failure
  fallbacks, recall triggers). Optimizer prompt emphasizes contracts and hops.
- (b) LLM harness optimizer rewrites H^(i) → H^(i+1) conditioned on the pairwise-preference history D^(i) over its own
  revision trajectory; the evaluator's rubric prompt x_eval is hidden from the optimizer.
- (c) Trajectory-local: compare current harness only against its immediate predecessor with LLM-judge pairwise
  preference (two judges, three seeds). Θ(1) cost per iteration vs Θ(m²) for population search. Framed as "noisy local
  ascent"; no explicit noise band, cost term, or leakage screen.
- (d) Per-task specialization on 30 synthetic ML-research tasks (finance/robotics/pharmacy); no held-out or OOD split —
  harnesses are deliberately task-specific.
- (e) Correlational only: embedding analyses (t-SNE/UMAP, cosine) show contracts change most; authors say this is
  correlational, not causal.
- (f) Revision history of harnesses + pairwise verdicts is the optimizer's context (preference history).
- (g) No pruning mechanism; an information-theoretic hypothesis (task info minus total correlation) reads as implicit
  redundancy reduction across components.
- (h) Few RHI iterations (1–4) let high-effort sonnet-4.6/opus-4.7/opus-4.8 beat xhigh/max/ultracode test-time scaling
  in pairwise wins, with up to 60% lower inference cost; gains attributed to context management, not longer reasoning.
  No generalization gap reported.
- (i) Budget = "few-shot" iterations (lightweight); no sparsity or annealing.
- **RRSI takes/contrasts:** shares the "recursive self-improvement at harness level" framing and cost-awareness, but RRSI
  keeps a scalar evolve score, a cross-task harness, held-out/OOD splits, and explicit noise/cost gates instead of
  pairwise local preference.

## 2. Meta-Harness: End-to-End Optimization of Model Harnesses — Lee, Nair, Zhang, Lee, Khattab, Finn — 2603.28052 (COLM 2026)

- (a) Harness = single-file Python program controlling prompt construction, retrieval, memory, and orchestration
  (100–1000 LOC); full rewrites allowed.
- (b) Agentic proposer (Claude Code, Opus-4.6) reads a filesystem holding *all* prior candidates' source, scores, and
  raw execution traces (up to ~10M tokens/eval; median 82 files read/iter); proposes k harnesses per iteration.
  Ablation: raw traces >> scores-only or scores+summary.
- (c) No parent-selection rule; keeps a population and a Pareto frontier (e.g., accuracy vs context tokens); the final
  pick is from the frontier on the search set. Only interface validation before evaluation. Noise isn't modelled;
  cost enters only as a Pareto axis. Leakage: manual inspection + regex audits for task-string leakage (TB2 only).
- (d) Text classification and math use a search set and a held-out test set (math also held-out *models*, +4.7 avg over
  5); TerminalBench-2 searches and reports on the *same* 89 tasks ("discovery problem").
- (e) No formal attribution; qualitative logs show the proposer spotting confounded edits (prompt + structural), isolating
  them, and moving to "purely additive" edits.
- (f) Ledger = the filesystem itself (per-candidate directory of code, scores, traces).
- (g) No pruning.
- (h) +7.7 over ACE on online text classification with 4× fewer context tokens; matches OpenEvolve/TTT-Discover with 10×
  fewer evaluations; TB2 76.4% (Opus 4.6), 37.6% (Haiku 4.5, #1). Fig. 7 plots search-vs-test accuracy per
  discovered strategy; no single gap number.
- (i) Budget ≈ 20 iterations / ~60 harnesses; no sparsity or annealing. Harness-as-code called "natural regularization bias".
- **RRSI takes/contrasts:** RRSI baseline. RRSI keeps full-history conditioning but turns it into a structured, typed
  ledger, and adds the gates Meta-Harness lacks (noise floor, cost rule, leakage critic, edit-cardinality cap).

## 3. Agentic Harness Engineering (AHE) — Lin, Liu, Pan, et al. (Fudan/PKU/Qiji) — 2604.25850

- (a) NexAU substrate exposes 7 editable component types as files: system prompt, tool description, tool implementation,
  middleware, skill, sub-agent config, long-term memory. Seed = bash-only, deliberately minimal so every component
  "earns its place". Verifier, tracer, model config, runs dir are read-only.
- (b) Evolve Agent reads a layered evidence corpus from an Agent Debugger (per-task root-cause reports + benchmark
  overview, raw traces for drill-down; ~10M → ~10K tokens) plus the prior round's attribution verdicts.
- (c) Every edit ships with a change-manifest entry (evidence, root cause, fix, predicted fixes + at-risk regressions). Next
  round intersects predictions with observed task deltas → per-edit verdict; rejected edits rolled back at file (git-
  commit) granularity. H_best tracked by pass@1. k ≥ 2 rollouts/task for stability; no explicit noise band; no cost
  gate; leakage only via read-only verifier/constraints.
- (d) Evolve on Terminal-Bench 2; frozen harness transferred to SWE-bench Verified (OOD) and to other model families.
  No in-distribution held-out split.
- (e) Yes: per-edit predicted vs observed task-level deltas. Self-attribution fix precision/recall 33.7%/51.4% (≈5×
  random) but regression precision/recall 11.8%/11.1% (≈2× random) → "regression blindness". Component ablation:
  tools, middleware, memory carry the gain; system prompt alone regresses; components interact non-additively
  (singles sum to +11.1 vs +7.3 full).
- (f) Versioned change manifest (the "evidence ledger") + git history, one commit per logical edit, iteration tags.
- (g) Evolve Agent may add/modify/*remove* components; rollback of rejected edits; seeded skills may be removed. No
  systematic pruning rule; "long-horizon harness cleanup" named as incomplete.
- (h) TB2 pass@1 69.7 → 77.0 in 10 iterations (beats Codex 71.9, ACE, TF-GRPO). SWE-bench Verified 75.6% vs seed 75.2%
  with 12% fewer tokens; cross-family +5.1 to +10.1 pp. The OOD gain is small (+0.4 on SWE-V).
- (i) 10 iterations; no edit-count budget or annealing.
- **RRSI takes/contrasts:** RRSI's evidence-aware history (component, hypothesis, diff, ΔS, ΔC, accepted) and the
  "earn its place" principle closely echo AHE's manifest and minimal seed. RRSI adds calibrated noise floors, cost
  acceptance, leakage screening, and an explicit deletion signal.

## 4. TTHE: Test-Time Harness Evolution — Nie, Zhang, Song, et al. (HKBU/USTC/HKUST) — 2607.08124

- (a) Harness = a Python class wrapping a frozen solver (context construction, tool calls, verification, recovery);
  baseline is ReAct (mini-swe-agent for SWE-bench, OpenClaw prompt+skills for claw-eval).
- (b) Per unlabeled test batch: G parallel branches evolved over R rounds; each branch's coding-agent proposer edits
  its own parent, reads other branches' traces, and is steered to a different role (conservative-repair, exploratory,
  adversarial). Feedback = raw execution traces plus label-free proxies: execution health, round-trip consistency,
  public-test pass rate.
- (c) Agentic judge (no gold) inspects code, traces, and proxies, may re-probe or re-execute, and commits one final-round
  branch. Proxies are deliberately *not* collapsed to a scalar to resist gaming. Budgets are fixed resource and
  wall-clock limits; malformed/non-terminating candidates are excluded. No explicit noise band or cost-acceptance rule.
- (d) Transductive: harness selected and scored on the same batch; gold used only for post-selection measurement. No
  held-out or OOD evaluation of the evolved harness.
- (e) No per-edit attribution; selection-regret analysis (better candidates generated but not committed) and trace audits
  blame the judge.
- (f) Per-batch decisions, code, and traces are released for inspection; proposers leave comments in code (e.g., "what
  I synthesized from 15 traces").
- (g) Invalid children fall back to parent; no pruning.
- (h) Gains over ReAct on BIRD, LiveCodeBench, SWE-bench Verified, DS-1000 hard slices; claw-eval 48.9 → 69.8 (+20.9).
  Performance is non-monotone in search budget; the judge can commit plausible-but-wrong programs.
- (i) Batch size, G, R are the budget knobs; no sparsity or annealing.
- **RRSI takes/contrasts:** RRSI baseline. RRSI treats judge/proxy unreliability as a selection problem it addresses
  with measured scores, calibrated noise floors, and held-out/OOD discipline, not with an agentic judge.

## 5. HarnessX: A Composable, Adaptive, and Evolvable Agent Harness Foundry — "Darwin Agent Team" (Chen et al.) — 2606.14249

- (a) Harness = (model config, harness config); config = processors attached to 8 typed lifecycle hooks, over 9
  orthogonal dimensions (model, context, memory, tools, sandbox, evaluate, control/safety, observe, train). Typed
  substitution algebra; edits are type-checked builder operations.
- (b) AEGIS 4-stage meta-agent pipeline: Digester (compresses ~10M-token traces into per-task summaries linked to
  cross-iteration history) → Planner ("adaptation landscape": failing tasks, attempted edits, implicated components,
  *untried edit types* — anti-under-exploration) → Evolver (typed candidates + change manifest + smoke test) → Critic.
- (c) Critic checks the manifest against trace evidence (anti reward hacking), allows one revision, and ranks candidates.
  A *deterministic* gate then runs manifest completeness, normalization, build/smoke tests, and the **seesaw
  constraint**: no regression on any previously solved task (pass@2). Noise handled only via pass@2. Sub-threshold
  regressions accumulated undetected (τ³ Telecom −14% at R7). No cost term. Reward hacking (format exploitation on
  GAIA) was shipped at R10 and only detected at R11.
- (d) No held-out evaluation: gains measured on the adaptation set, peak reported (authors flag selection bias).
- (e) Manifest predictions + ship-prediction accuracy tracking; no quantitative per-edit attribution.
- (f) Trace store = shipped/rejected edits with rejection reasons, regression signals, per-task outcome history.
- (g) Type-safe removal supported by the algebra; variant isolation *retires* the lowest-performing variant when the pool
  is full. No evidence-driven component-pruning rule.
- (h) +14.5% average over 15 model×benchmark configs (up to +44.0 on ALFWorld for Qwen3.5-9B); gains are largest for
  weaker agents. Global strategy on GAIA peaks at 73.8 (R4) then collapses to 49.5; variant isolation gives +13.6
  with no degradation. Co-evolution with GRPO adds +4.7.
- (i) Up to 15 rounds; variant pool size K; no edit sparsity or annealing.
- **RRSI takes/contrasts:** RRSI baseline. RRSI's typed component vocabulary K, its structured exploration of
  untried components, and its critic parallel AEGIS. RRSI replaces the seesaw (per-task, noise-blind) with a
  calibrated aggregate floor S* − δ plus a cost rule, and adds held-out and OOD evaluation, which HarnessX lacks.

## 6. Harness Updating Is Not Harness Benefit — Lin, Wu, et al. (PSU/UCSC/Amazon) — 2605.30621

- (a) Analysis paper. Editable: skills (SWE-bench Verified, SkillsBench); skills + prompts + memories (MCP-Atlas); tools
  and execution policy are fixed.
- (b) Generic solve→evolve loop: evolver e maps (H_{t−1}, execution evidence D_t) → ΔH_t. Prompt template, trajectory
  window, and evolution budget β are fixed across all 7×6 agent/evolver pairs.
- (c) No acceptance gate studied; each update is applied (Apply). In-situ scoring: each task is scored under H_{t−1}
  before its evidence is used, which is prequential and avoids evaluating on consumed evidence.
- (d) Single stream; no separate held-out or OOD split.
- (e) Attribution at the *role* level, not the edit level: decomposes gain into evolver harness-updating Δ_update and
  agent harness-benefit Δ_benefit.
- (f) Harness updates logged; evolvers barred from editing eval scripts.
- (g) No pruning.
- (h) Harness-updating is flat in capability (best-to-worst evolver ≤3.1 pp; Qwen3.5-9B ≈ Opus 4.6). Harness-benefit
  is non-monotone: mid-tier agents benefit most; weak agents fail to activate the harness (25% skill-load rate vs ≈96%)
  or fail to adhere to it (adherence 0.52 → 0.13 over the trajectory).
- (i) Fixed evolution budget β; no sparsity or annealing.
- **RRSI takes/contrasts:** supports RRSI's claim that proposer capability is not the bottleneck; selection and
  regularization matter more. It also motivates cross-policy transfer tests, since benefit depends on the policy.

## 7. Rethinking the Evaluation of Harness Evolution for Agents — Wang, Zhu, Hu, et al. (AI2/UW) — 2607.12227 (COLM 2026 workshop)

- (a) Uses AHE's harness (bash-only seed; prompt, middleware, tools, memory editable) with AHE's explore agent disabled
  to avoid importing benchmark-specific harnesses (a leakage vector).
- (b) The AHE loop, with the Agent Debugger as summarization map Φ. Adds "harness scaling", a per-instance harness
  revision baseline.
- (c) Studies selection, doesn't propose a rule: with no unit tests, evolved harness = last; with tests, argmax aggregate
  outcome. Makes the point that gains must be compared under matched feedback and inference budgets (K=5).
- (d) Core contribution: matched-budget comparison against parallel sampling and sequential refinement, plus a disjoint
  45 train / 10 val / 34 test split of Terminal-Bench 2.1.
- (e) Qualitative edit audit: edits are rational (prompt rules → middleware enforcement → tool fixes), but most
  "memorize fixes rather than distill strategies"; persistent prompt text causes context bloat.
- (f) Uses AHE's store; examines which edits were kept or rolled back.
- (g) n.r. (notes that accumulated prompt text offsets gains, an argument for pruning).
- (h) Without unit tests, harness evolution averages 67.4 vs initial 68.2 and parallel sampling 72.3 (GPT-5.4
  75.3 → 69.7). With tests, pass@1 is 75.8 vs parallel sampling 86.0. On the disjoint held-out split the gain is
  +0.6 average (Opus +1.2, GPT-5.4 +0.0), i.e., a large generalization gap.
- (i) Matched compute budget K; no sparsity or annealing.
- **RRSI takes/contrasts:** RRSI's motivating evidence (adaptive reuse overfits; gains vanish on held-out) and its
  evaluation discipline (held-out split, same-window baselines, cost reporting). RRSI's cost-aware acceptance directly
  targets the "gains = more compute" confound this paper raises.

## 8. Evo-Bench: Can Language Models Improve Agent Harness? — Huang, Yang, et al. (RUC/BOSS Zhipin) — 2608.09096

- (a) Benchmark of *evolvers*. The policy harness starts as a minimal CodeAct loop (shell + finish) and every surface
  is editable: system prompt, context manager, tools, skills. The evolve harness is fixed and Claude-Code-like.
- (b) Evolver runs a diagnose → hypothesize → edit → evaluate cycle with skills `query_rollouts`, `diff_task`,
  `analyze_evals`, `log_experiment`, `record_insight`, and `architecture_checkpoint` (forces a broader redesign after
  repeated local failures). It conditions on cumulative validation evidence: scores, task outcomes, trajectories,
  diagnostics.
- (c) Retain or revert is the evolver's call ("treat regressions as evidence"; restore best revision before freeze).
  No enforced statistical gate. Integrity rules: policy never sees answers/rubrics/judge prompts; source and
  trajectories are scanned for leakage/reward hacking (App. C.2); the evolver can't touch evaluation.
- (d) Yes: 160-task visible validation suite vs a disjoint 448-task held-out evaluation suite, built by
  *sensitivity-aware stratified splitting* so the two splits respond alike to harness changes. Cross-policy transfer
  is tested (Qwen, DeepSeek, GLM policies).
- (e) Qualitative: failure-mode case studies (Qwen misattributes a 4.3-pt regression to noise despite a 2.2-pt range
  on byte-identical revisions; bundled edits crash a verifier). Prescribes "one falsifiable mechanism per iteration".
- (f) Persistent experiment ledger of hypotheses and resolved insights; immutable evaluation snapshots; best-revision
  tracking; compaction keeps per-iteration mechanisms and scores.
- (g) Reversion only; no pruning rule.
- (h) Top evolvers (GPT-5.6 Sol, Opus 4.8) gain +16.6 / +16.1 over the seed on held-out, near the human-engineered
  harness at 47.5. GPT-5.6 Sol held-out: Search 44.5 < 46.7, Office 41.6 < 43.9, General 59.4 > 56.3, Overall 46.3 <
  47.5. Shows early saturation: good structure found early, then later rounds introduce harmful modifications.
- (i) Budget b = (20 iterations, 1000 steps, 48 h); a larger budget scales gains monotonically. Cost-vs-score Pareto plot
  over evolvers. No sparsity or annealing, though it recommends one mechanism per iteration.
- **RRSI takes/contrasts:** Evo-Bench's recommendations (single falsifiable mechanism per iteration, replicate before
  attributing to noise, best-revision recovery, architecture reset after repeated local failure) are close to what
  RRSI codifies as b_min = 1 annealing, the δ floor, and stall-triggered exploration. RRSI makes them algorithmic
  rather than leaving them to the evolver.

## 9. EvoHarnessBench: Can Your Agents Keep Pace with an Evolving Harness? — Ke, Patil, Shi, et al. (Salesforce/UNC) — 2609.04280

- (a) Different sense of "evolution": the *externally supplied* harness grows along one axis per stream (tools,
  skills, or specialist agents). 17 streams, 3–6 cumulative stages, 802 tasks, 520 tools, 42 skills, 62 agents.
  Optional inner self-evolving adaptation (memories, learned skills, prompts, routing) carries persistent artifacts
  across stages.
- (b) Not a proposer method; evaluates existing self-evolving adaptation methods on per-stage adaptation splits.
- (c) No acceptance rule; measures consequences.
- (d) Per stage: adaptation split vs held-out evaluation split; full cumulative harness (with distractors: 89% tools,
  77% agents at final stage) given at evaluation.
- (e) Lower-triangular performance matrix P_{t,τ}; backward transfer (BWT) and forward transfer (FWT) attribute
  retention vs adaptation per cohort. Not edit-level attribution.
- (f) Persistent adaptive state z_t is the carried artifact; no ledger.
- (g) Construction never removes capabilities; the paper calls for mechanisms that detect stale or harmful artifacts
  and retire them, and for replacement/retirement streams as future work.
- (h) Harness expansion alone causes forgetting (−12.1% tools, −13.8% skills, −46.4% agents). Self-evolving adaptation
  under an evolving harness underperforms task-specific reference harnesses (−3.3 skills, −2.2 tools, −1.2 agents).
  Retention and adaptation trade off.
- (i) Reports operating cost per stage (tokens, calls, latency); no edit budget.
- **RRSI takes/contrasts:** backs RRSI's complexity-accumulation failure mode: adding components/capabilities is not
  free and can degrade prior competence, which motivates RRSI's cost-aware acceptance and pruning.

## 10. HarnessCompass: Guiding Automatic Harness Evolution toward Generalizable and Effective Agent Harnesses — Zhang, Zhou, Song, et al. (BIT/CityU) — 2608.01918

- (a) AHE's 7 component types, split into structural (tool implementations, middleware, sub-agents) and guidance (system
  prompt, tool descriptions, skills, memory). Minimal bash-only seed so each component is loop-introduced and measured.
- (b) Meta-agent conditions on distilled trajectory evidence plus *proactive first-person feedback* from the code agent:
  a blind report (verdict hidden) and a hindsight report (verdict shown; cause attributed to harness / own reasoning /
  task ambiguity / environment). Feedback is kept only if grounded in the trajectory, and aggregated
  deterministically with confidence scores by component.
- (c) **Generalization gate** (a leakage critic in the meta-agent prompt): hard ban on task/instance IDs, test names,
  private symbols/paths of the task-under-test, task-token keyword branches, and "iteration N showed task X" notes.
  Every edit must carry an applicability criterion ("would this help a library I've never seen?"). Placement rule:
  capabilities go in code, guidance goes in prompt/memory. Accept if winner-track Pass@1 > current. No noise band or
  cost term.
- (d) Evolve on a 50-task SWE-bench Verified sample; 450 held-out tasks never seen; cross-model transfer to
  Claude-Sonnet-4.6.
- (e) Component-wise tracks isolate structural vs guidance effects each round. Ablations attribute gains to gate,
  feedback, and R³. Hindsight report does root-cause attribution.
- (f) Relies on the AHE-style loop; edits reverted next round if they don't help.
- (g) R³ merge: Revision (drop loser edits that regress, duplicate, conflict, or are task-specific), Recombination
  (winner wins file conflicts), **Refinement (removes redundant overlapping edits)**. That is pruning at merge time.
- (h) Sample 54 → 66% in 5 iterations (AHE 63% in 20). Held-out 51.6 → 60.4% (AHE 54.7%). Evolve-to-held-out gap
  ≈ 5.6 pts vs AHE ≈ 8.3. Sonnet-4.6 transfer 70.0 → 73.8%.
- (i) Few iterations (5); two parallel tracks per round; no edit-count budget or annealing.
- **RRSI takes/contrasts:** its generalization gate is the closest precedent to RRSI's leakage critic (reject diffs
  encoding task names/entities/answers), and its component tracks are an attribution device. RRSI adds calibrated noise
  and cost acceptance and uses edit-cardinality annealing instead of fixed two-track splitting.

## 11. HarnessBank (listed as "Self-evolving agent harnesses via gated semantic quality-diversity") — Luo, Xue, Wang, Hu, Deng (EverMind/Shanda) — 2607.13683

(alphaXiv resolves 2607.13683 to v2, retitled "HarnessBank: Semantic Gene-Bank Search with Gated Verification for
Agent-Harness Self-Evolution". Same authors and mechanism.)
- (a) Harness = immutable kernel K (evaluation, bookkeeping, interfaces) ∪ mutable surface X (prompts, injected
  knowledge, runtime control/recovery, tool specs, configs).
- (b) Evolver (Claude Opus 4.8) reads a full diagnosis of the parent (scores, trajectories, metadata per task × attempt)
  plus the whole gene bank. Offspring are *reinvented* from failures or *recombined* from compatible mechanisms in
  different cells. Each offspring declares (where, why): where ∈ {prompt, knowledge, runtime, config}, why = LLM-inferred
  failure pathology.
- (c) **Gated Harness Screening** on a sampled subset: validity gate (infrastructure failures get repair+retry, not
  counted as agent failures), **activation gate** (patch emits a deterministic beacon; never-triggered patches are
  inert and rejected), **paired significance gate** (task-level paired differences, z ≥ 1.96), and a gain gate. Survivors
  get a full train evaluation and compete for their MAP-Elites-style cell. No cost gate. Leakage handled by keying
  diversity on pathology, not tasks ("an archive keyed on tasks ... overfits by construction").
- (d) Disjoint train/test splits on 7 domains; the test set is never used in evolution; the credited claim is the
  held-out paired gain. Cross-model experiments.
- (e) The activation beacon plus the paired test give per-mechanism credit. The why label only steers search; credit comes
  solely from the gates. Pathology → patch "matching law" across models.
- (f) Gene bank A_t (cell → elite) plus protocol-valid evaluation ledger per candidate.
- (g) Cell competition replaces weaker elites; inert patches are rejected. No pruning of accepted mechanisms.
- (h) Held-out gains of +5.1 to +15.4 (TB2 +9.3, LiveCode +13.7, Omni-MATH +11.7, BrowseComp+ +13.9, GDPval +9.2,
  AppWorld +15.4, SWE-bench +5.1 at n=26, not significant). Test retains 37–148% of train gain. Ablation: without
  the 2σ gate, false elites enter the bank and the loop never stops ("phantom progress" in 62–76% of rounds). Beats GEPA
  and DGM; DGM shipped a regression on Omni-MATH.
- (i) Rollout budget (780–2,310), stop after R rounds or P rounds without a cell update; no edit sparsity or annealing.
- **RRSI takes/contrasts:** the nearest analogue of RRSI's noise-adjusted floor (a statistical gate) and its
  structured exploration (semantic cells ↔ RRSI's component vocabulary K and untried set U_t). RRSI uses a
  pre-calibrated δ band instead of a per-candidate paired z-test, and adds a cost rule and pruning.

## 12. Harness Handbook: Making Evolving Agent Harnesses Readable, Navigable, and Editable — Wang, Shi, et al. (Tencent HY/IU) — 2607.13285

- (a) Not an evolution loop. A behavior-centric representation of an existing harness codebase (Terminus-2, Codex):
  L1 system overview → L2 stage/component overviews → L3 source-anchored unit cards, plus a state-register view Z
  (every read/write site of each state register).
- (b) Built by static analysis (call graph, deterministic) + LLM propose-review mapping of functions/files to stages.
  Behavior-Guided Progressive Disclosure (BGPD) drives an agent from behavior to verified source locations for a
  natural-language modification request.
- (c) No acceptance rule; stale locators that can't be revalidated are frozen and excluded (a representation-level
  integrity check). Auto-resync after every non-empty diff.
- (d) Evaluates edit-plan quality on 30 requests × 2 harnesses (Query, Cross-file, Search-Hostile), judged by three LLMs.
- (e) Behavior localization = mapping a requested behavior to all implementation sites; per-register read/write
  registry surfaces scattered sites.
- (f) The handbook itself is a continuously synchronized behavioral map of the harness; proposes using it as "shared
  behavioral memory" for self-evolution.
- (g) n.r.
- (h) Win rates +10.0 (Codex) and +18.9 (Terminus-2) with 12.7% / 8.6% fewer planner tokens; a weaker planner matches
  stronger models' localization; complete-miss rate falls by up to 25.9 pts.
- (i) Token-efficiency is reported; no evolution budget.
- **RRSI takes/contrasts:** complementary infrastructure. RRSI's per-edit component tags (ℓ ∈ K) presuppose that a
  harness can be decomposed into attributable components; the Handbook shows how to recover that decomposition
  for real, tightly coupled harnesses.

## 13. Continual Harness: Online Adaptation for Self-Improving Foundation Agents — Karten, Zhang, et al. (Princeton/ARISE/GDM) — 2605.09998

- (a) Embodied agents (Pokémon Red/Emerald; GPP on Blue/Yellow/Crystal). Harness H = (system prompt p, sub-agents G,
  skills K, memory M), edited through meta-tools (define_agent, run_code, process_memory). Starts from a minimal
  interface.
- (b) Reset-free, online: every F steps after warm-up W, a Refiner (same model) reads the recent trajectory window for
  failure signatures (navigation loops, tool-call failures, stalled objectives) and makes four CRUD passes:
  rewrite p; create/edit/**delete** sub-agents; codify/repair skills; add/update/demote memory.
- (c) No acceptance gate: edits apply directly (H ← H ⊕ Δ). No noise, cost, or leakage screen. The metric is button
  presses to milestone (a cost-like objective).
- (d) No held-out split; same continuous episode. Bootstrap transfer (frozen vs updating) across runs; capability
  sweep (Gemini 3.1 Pro/Flash/Flash-Lite).
- (e) Per-component ablations (App. C); skill quality measured against a Dijkstra oracle (path-cost deficit
  falls from ~45% to single digits).
- (f) Monotonically accumulating trajectory; CRUD operation logs per component (Fig. 3 revision histories).
- (g) Yes: sub-agents "that have not been invoked productively" are deleted; memory importance is demoted; prompts
  cycle between growth and simplification with periodic structural rewrites.
- (h) Recovers most of the gap from H_min to a hand-engineered expert harness; strictly Pareto-dominant on Pro,
  high-variance on Flash, below floor on Flash-Lite. The co-learning loop with PRM + soft SFT drives milestone
  progress for Gemma-4.
- (i) Refinement period F and warm-up W; no edit sparsity or annealing.
- **RRSI takes/contrasts:** shares "a mechanism must keep earning its place" (deleting unproductive sub-agents) with
  RRSI's structural pruning, but has no selection-side regularization. It's the ungated online end of the spectrum
  that RRSI argues overfits.

## 14. Adaptive Auto-Harness: Sustained Self-Improvement on Open-Ended Task Streams — Liu, Shi, Sang, et al. (Emory/Amazon) — 2606.01770

- (a) Harness C = prompts, skills, memory, tools (plus infrastructure), with a **capacity budget |C| ≤ K**. The solver
  workspace is a git repo; the evolver builds regime-specific branches (a harness tree).
- (b) Stateful four-phase multi-agent evolver: Analyst (task board of prioritized failures) → 3 parallel Researchers
  (hypothesis tests) → Builder → Verifier (build gate, 3 retries). Conditions on stream trajectories and on labels
  surfaced by a **temporal-reveal gate**: outcomes appear only after a task resolves, so no future leakage.
  Human-in-the-loop hooks fire only when history lacks the signal.
- (c) An **EGL (Expected-Gain-from-Learning) trigger** gates whether a cycle runs at all (threshold 0.05, window 3).
  The Verifier runs tests. At solve time, a router picks a branch (confidence threshold 0.7). T=0 for solver and evolver,
  so gains are attributed to the algorithm rather than sampling noise. No explicit cost-acceptance rule.
- (d) Chronological streams (PolyBench 5,075 tasks, CTF-Dojo 261, FutureX 503). Every task is scored before its
  label is revealed, so evaluation is prequential. No separate OOD suite.
- (e) Regret decomposition: evolution loss L_evo (evolver-class capability gap) + adaptation loss L_adapt (one harness
  for heterogeneous tasks), diagnosed through bottleneck analyses and ablations, not per-edit attribution.
- (f) Persistent cross-cycle workspace: task board, **research logs of tested hypotheses with pass/fail verdicts**,
  architecture README, verification tests. Git lineage per branch.
- (g) Motivating evidence *for* pruning: an unbounded A-Evolve run grows from 12 to 34 skills and from a 2 KB to a 68 KB
  prompt, peaks early and then declines (later stopping budgets do worse). Addressed by the capacity budget and by
  branching, not by explicit deletion.
- (h) Full system: PolyBench accuracy 80.9 / return +330%, CTF-Dojo 50.2, FutureX 47.3 (multi-agent variant 49.5).
  Beats A-Evolve, GEPA, Meta-Harness, Continual Harness, SkillOS. Meta-Harness falls below no-evolution on FutureX.
- (i) Capacity budget K, EGL-gated cycles, batch sizes 100/20/20; no annealing.
- **RRSI takes/contrasts:** the unbounded-growth-then-decline curve is direct evidence for RRSI's complexity-accumulation
  failure mode. The hypothesis log with verdicts matches RRSI's negative-evidence ledger. The EGL gate is a
  stall/expected-gain trigger close to RRSI's σ_t stall indicator, used here to *skip* cycles rather than force exploration.

## 15. Self-Harness: Harnesses That Improve Themselves — Zhang, Zhang, Li, et al. (Shanghai AI Lab) — 2606.09498

- (a) DeepAgent-SDK harness definition file with declared editable surfaces: system prompt, memory sources, sub-agents,
  skills, bootstrap/execution/verification/failure-recovery instructions, runtime-control policy (tool-error and message
  caps).
- (b) Same fixed model (no stronger external agent) acts as proposer. Weakness mining clusters failed held-in traces by an
  exact failure signature φ = (verifier-level cause, causal status of agent behavior, abstract mechanism), ordered by
  support and actionability. The proposer gets these patterns, passing behaviors to preserve, and **summaries of
  previously attempted edits**. It emits K *diverse yet minimal* proposals. Each carries an audit record (target
  pattern, surface, expected effect, regression risks). Non-addressable clusters (task difficulty, instability,
  capability limits) are excluded.
- (c) Accept iff Δ_in ≥ 0 ∧ Δ_ho ≥ 0 ∧ max > 0 (improve one split without degrading the other). Repeats are aggregated
  when evaluation is stochastic. No-op and crash proposals are rejected. Compatible accepted edits are merged. No cost
  term. Leakage is controlled because held-out traces are never shown to the proposer, though the held-out split still
  gates promotion.
- (d) Fixed held-in/held-out split, but the held-out split is used by the promotion gate. So it's a validation split,
  not a clean test: reported held-out gains carry selection bias. No OOD.
- (e) Model and evaluator are fixed, so record changes are attributed to harness changes. Per-proposal audit plus split-wise
  deltas.
- (f) Harness lineage h_0, h_1, …; per candidate: changed surfaces, split-wise outcomes, repeats, summary, accept/reject.
  Rejected candidates are logged.
- (g) Minimality within each branch; no pruning.
- (h) All 9 model × benchmark pairs improve both splits. Up to +132% relative (Qwen3.5-35B-A3B AppWorld 22.5 → 52.2);
  GLM-5 AppWorld 44.4 → 85.0. Held-out relative gain exceeds held-in gain in 4 of 9 pairs. Authors warn that pass-rate
  non-regression alone is too weak for higher-stakes changes.
- (i) Proposal width K, rounds T; per-edit minimality is an informal sparsity constraint.
- **RRSI takes/contrasts:** close cousin. Minimal per-mechanism edits and history of attempted edits ≈ RRSI's
  sparsity and ledger. RRSI replaces the strict non-regression rule (noise-blind; a single-task flip decides) with a
  δ-calibrated floor, adds cost, and keeps its held-out split out of selection.

## 16. DarwinX: Evolving Agent Harnesses Through Natural Selection — Zhang, Dai, Tan, Yang, et al. (Salesforce) — 2608.07545

- (a) Full harness in two layers: skill (prompts, memory, distilled knowledge) and code (tools, control flow, agent loop).
  Model frozen. Evolves Salesforce's "Monet" agent.
- (b) Trace-guided additive edits; the proposer must preserve the parent's solved tasks and extend to a fragile/failing
  one. Three evidence types share one edit interface: failure-derived (default), teacher-derived (a reference solver's
  successful trajectory on "walls" with no passing rollout), and self-derived (contrast of the agent's own passing vs
  failing rollouts on variance-band tasks).
- (c) **Preserve-and-extend contract**: fitness enabler (gain g > 0, regression R ≤ δ) under the benchmark's own
  verifier, then stricter **noise-aware avg@k confirmation** and a **preservation probe** before a node may steer search.
  Children are classified by solved-set relations (improver / neutral / stepping stone / archived). Merges are kept only
  if S(child) ⊇ ∪ S(parents). Parent sampling: exploit the highest cumulative-lineage-gain node with probability 1 − β,
  else broaden. Cost is not in acceptance, but analysis shows extra compute goes only to newly solved tasks (22 vs 11
  turns). Reward-hacking audit: 2/370 trajectories flagged on TB2.1. WAI invalid trajectories 293 → 17.
- (d) Four rungs with increasing separation: in-domain TB2.1, held-out TerminalWorld, synthetic-to-real WebArena-Infinity
  (verifier changes from LLM judge to deterministic), cross-benchmark TB2.1 → SWE-bench Verified.
- (e) Skill-bundle ablation attributes TB2.1 gains to a verification/contract bundle ("plausibly rather than causally").
  Per-cluster no-regression footprint.
- (f) Archive tree: each node = harness snapshot + edit delta + per-task scores + trial evidence + distilled lessons.
- (g) Explicitly *no* removal: "nothing is thrown away"; edits are additive; losers are kept for recombination.
- (h) TB2.1 83.2% (+7.7) matched base, 84.7% on a stronger base; TerminalWorld held-out 68.3%, but the in-loop proxy
  saturated 0.505 → 1.000, a **31.7-pt proxy-vs-held-out gap**. The merged harness (28/41) beats each specialist (24–27).
  WAI 43.5 → 93.0 audit-clean. SWE-V transfer 84.2% (+3.4).
- (i) avg@k rollouts per candidate; β exploration; no edit sparsity or annealing.
- **RRSI takes/contrasts:** shares the noise-aware selection (δ-bounded regression) and exploration-vs-confirmation split.
  Contrasts on complexity: DarwinX is monotonically additive with no deletion or cost gate, which is exactly the
  accumulation RRSI's pruning and Ridge-style cost rule target. Its 31.7-pt proxy gap is evidence for RRSI's thesis.

## 17. AutoHarness: Improving LLM Agents by Automatically Synthesizing a Code Harness — Lou, Lázaro-Gredilla, Dedieu, Wendelken, Lehrach, Murphy (Google DeepMind) — 2603.03329

- (a) Harness = small Python code: `propose_action()` and `is_legal_action()`, as action-verifier (rejection sampler around
  the LLM), action-filter, or full code-policy (no LLM at inference). One harness per game (145 TextArena games).
- (b) The LLM (Gemini-2.5-Flash) acts as a mutation operator; a Critic consolidates up to 5 failed steps (illegal moves, code
  errors, rewards) and a Refiner rewrites the code. Refinement is targeted: if the verifier wrongly passed an illegal
  action, both functions are refined.
- (c) Tree search with **Thompson sampling** over code hypotheses (Tang et al. 2024). Node value = legal-action rate (or
  0.5 + 0.5·reward for policy). Stops at value 1.0 or timeout. Exploration/exploitation is explicit. No leakage or cost
  gate beyond removing "Valid moves" hints from observations.
- (d) Legal-action accuracy measured on fresh test rollouts (10 seeds × 1000 steps). Agent evaluation on 16 1P + 16 2P
  games against other models. Per-game, so no OOD.
- (e) n.r.
- (f) The search tree of code hypotheses with values.
- (g) n.r.
- (h) 100% legal-action rate on all 145 games (avg 14.5 iterations). Flash+harness beats Gemini-2.5-Pro in 9/16 2P games
  (56.3% win rate); 1P reward 0.745 vs 0.707. Harness-as-policy 0.870 > GPT-5.2-High 0.844 at near-zero test-time
  cost.
- (i) Iteration cap (up to 256 for policy); no sparsity.
- **RRSI takes/contrasts:** earliest "harness as searchable code" instance with a principled bandit selector. RRSI
  inherits the idea of an evidence-driven exploration budget but targets general multi-component harnesses where
  noise, cost, and leakage dominate.

## 18. Better Harnesses, Smaller Models: Building 90% Cheaper Agents via Automated Harness Adaptation — Yang, Zhao, Wu, Kästner (CMU) — 2607.08938

- (a) software-agent-sdk harness: contexts (system prompt, skills, dynamic context), tools (primitive, custom classes,
  scripts), **hooks** (tool-triggered scripts), context management (external FS, condensers), sub-agents. A failure-mode →
  adaptation taxonomy maps tool-use / instruction-following / knowledge / long-context / planning failures to context,
  tool, and loop edits.
- (b) Meta-agent (gemini-3.1-pro) conditions on raw JSON trajectories with outcomes, current harness code, **search memory**
  (summaries of past proposals and their observed effects, to avoid rediscovering fixes), and design-space API docs.
  Cheap sanity check with repair retries before evaluation.
- (c) GEPA-style Pareto sampling of parents. Accept if the proposal improves on the sampled training batch, then run full
  validation and add to the pool if it beats prior candidates. Each configuration run 3× and averaged. Cost is the
  motivating objective (SLM vs LLM), not an acceptance term.
- (d) 20/20/60 train/val/test per task; test held out for final evaluation. 7 business tasks × 3 SLMs.
- (e) Post-hoc taxonomy coding of retained edits: instruction-following (81%) and knowledge (81%) failures addressed
  most; adding contexts 86%, creating tools 43%, managing tools 29%. No sub-agent adaptation succeeded.
- (f) Harness pool with validation scores + search memory.
- (g) **Tool filtering is a first-class adaptation**: one harness cuts 40+ MCP tools to 7. "Managing contexts" (pruning,
  compressing) is the counterweight to added context.
- (h) 16/21 task×SLM pairs significantly improved; 7 close the SLM–LLM gap; best SLM recovers 89.7% of LLM performance
  at 4% of the cost. More diverse tasks and weaker models are harder to adapt.
- (i) Budget B = Σ_t (b_analyze + b_evaluate). Lessons: prioritize diagnosis quality and proposal diversity over
  iteration count; several independent searches beat one long one.
- **RRSI takes/contrasts:** supports RRSI's claim that cost is a first-class objective and that removal (tool filtering)
  is a productive edit. RRSI turns cost into an acceptance constraint rather than a model-selection motive.

## 19. Retrospective Harness Optimization (RHO): Evolving Agents in the Dark via Self-Preference — Pan, Liu, Lin, et al. (CityU/MSRA) — 2606.05922

- (a) Harness = directory of tools (scripts), skills, instructions for a Codex CLI agent (GPT-5.5 high), mounted read-only
  for solve and writable for optimize.
- (b) Label-free, single round: DPP coreset (k=10) of difficult and diverse past tasks → re-solve each G=3 times →
  diagnosis with **self-validation** (within-trajectory) and **self-consistency** (cross-trajectory divergence), with a
  severity weight in [0,1] → N=3 parallel optimizer calls. The optimize prompt requires cross-task pattern matching and
  discourages task-specific hardcoded fixes.
- (c) Best-of-N by **pairwise self-preference** of each candidate's rollout against a fixed baseline rollout (score in
  [−10,10], positions swapped to reduce bias, any parse failure = 0). Accept only if mean S_j > 0 *strictly*, "because
  pairwise self-preference is a noisy estimator". Identical-harness no-ops are dropped. Ground-truth-revealing commands
  are scrubbed from trajectory digests (a leakage guard). No cost term.
- (d) Trajectory set vs held-out test set per benchmark; graders used only for held-out evaluation. No OOD.
- (e) Ablations of self-validation/self-consistency; raw-trajectory baseline 0.60 vs full 0.78 on SWE-Bench Pro.
  Analysis ties new skills and tools to prior failure modes.
- (f) Full persistence of prompts, trajectories, diagnoses, candidate harnesses, diffs, scores.
- (g) The optimizer may remove files, but there is no pruning rule.
- (h) Held-out SWE-Bench Pro 0.59 → 0.78, Terminal-Bench 2 0.71 → 0.76, GAIA-2 0.29 → 0.37. Beats Dynamic Cheatsheet,
  ReasoningBank, and Sleep-time Compute. Reaches validation-feedback quality at about ⅓ of the compute.
- (i) Single pass with fixed k, G, N; no sparsity or annealing.
- **RRSI takes/contrasts:** shows that a strictly positive acceptance threshold under a noisy estimator is a de facto noise
  floor. RRSI's δ is its calibrated counterpart. RHO's single round sidesteps the adaptive-reuse overfitting that RRSI's
  multi-round loop has to regularize.

---

## Papers not found

None. Every paper resolved on alphaXiv. Two identity notes:
- Meta-Harness resolved by title to arXiv **2603.28052**.
- "Rethinking the evaluation of harness evolution for agents" resolved to arXiv **2607.12227** (v2).
- 2607.13683 resolves to v2 titled **"HarnessBank: Semantic Gene-Bank Search with Gated Verification for Agent-Harness
  Self-Evolution"** (same authors, Luo et al.). The listed title "Self-evolving agent harnesses via gated semantic
  quality-diversity" appears to be the v1 title or citation title.

---

## Cross-cutting patterns

1. **Ledgers / journals of edits and verdicts.** Almost universal, in several forms: raw filesystem of all candidates
   (Meta-Harness); versioned change manifest + git commits with predicted fixes/regressions (AHE); trace store with
   shipped/rejected edits and rejection reasons (HarnessX); experiment ledger of hypotheses and closed insights (Evo-Bench);
   research logs of tested hypotheses with pass/fail (Adaptive Auto-Harness); per-proposal audit records + summaries of
   attempted edits fed back to the proposer (Self-Harness); search memory of past proposals and effects (Better Harnesses);
   archive tree with deltas, per-task scores, distilled lessons (DarwinX); gene bank + protocol-valid ledger
   (HarnessBank); preference history (RHI); full persistence (RHO, TTHE); CRUD logs (Continual Harness). **RRSI's
   distinguishing move** is a *typed* per-atomic-edit record (component, hypothesis, diff, ΔS, ΔC, accepted) that is
   queried algorithmically (T_t, g_t(ℓ), B_t, U_t), not only read by the proposer.
2. **Attribution of gains to edits.** Falsifiable per-edit predictions checked next round (AHE: fix prediction good,
   regression prediction ≈ blind); activation beacons + paired tests (HarnessBank); component-wise tracks (HarnessCompass);
   role-level decomposition evolver vs agent (Harness Updating ≠ Benefit); regret decomposition L_evo + L_adapt (Adaptive
   Auto-Harness); BWT/FWT matrices (EvoHarnessBench); ablations (AHE, DarwinX, Continual Harness). Recurring finding:
   bundled edits confound attribution (Meta-Harness proposer discovers this; Evo-Bench prescribes "one falsifiable
   mechanism per iteration"; AHE finds non-additive interactions). **RRSI's annealed L0 cap** makes that
   one-mechanism rule a schedule.
3. **Noise floors / statistical acceptance.** Explicit: HarnessBank paired z ≥ 1.96 (and its ablation shows false elites
   and never-stopping loops without it); DarwinX R ≤ δ + avg@k confirmation; RHO strict S > 0 under a noisy judge;
   HarnessCompass/AHE k ≥ 2 rollouts. Implicit or none: Meta-Harness, TTHE, Continual Harness, RHI. Evidence of failure
   without it: Evo-Bench (misattributing regressions to noise), HarnessX (pass@2 seesaw lets sub-threshold regressions
   accumulate and collapses 73.8 → 49.5), Rethinking-Eval (gains ≈ repeated sampling). **RRSI** pre-calibrates δ by
   re-running H_0 and uses S* − δ as a running-best floor.
4. **Cost terms.** Mostly measured, rarely gated: Pareto accuracy-vs-context (Meta-Harness), token reductions reported
   (AHE, RHI, Harness Handbook), cost as the objective (Better Harnesses, AutoHarness harness-as-policy, Evo-Bench
   evolve-cost Pareto), matched-budget baselines (Rethinking-Eval), compute-concentration analysis (DarwinX), capacity
   budget |C| ≤ K (Adaptive Auto-Harness). None found except RRSI uses a **gain-dependent cost acceptance rule**
   ΔC ≤ β0 + β1·ΔS.
5. **Pruning / removal.** Deletion as an allowed edit: AHE (remove components, file-level rollback), Continual Harness
   (delete unproductive sub-agents, demote memory, periodic simplification rewrites), Better Harnesses (tool filtering
   40+ → 7), HarnessCompass (R³ Refinement removes redundant edits), HarnessX (variant retirement). Evidence that
   accumulation hurts: Adaptive Auto-Harness (12 → 34 skills, 2 → 68 KB prompt, peak then decline), EvoHarnessBench
   (harness growth causes forgetting), Rethinking-Eval (context bloat), AHE (non-additive stacking). Explicitly anti-pruning:
   DarwinX ("nothing is thrown away"). **RRSI** is the only method with an evidence-driven pruning target set
   B_t = {ℓ : g_t(ℓ) ≤ 0}.
6. **Held-out and OOD discipline.** Same set for search and report: Meta-Harness on TB2, HarnessX (acknowledged), TTHE
   (transductive), Continual Harness, RHI. Held-out split used as a *gate* (so not clean): Self-Harness. Clean disjoint
   held-out: Evo-Bench (sensitivity-stratified 160/448), HarnessCompass (50/450), HarnessBank, Better Harnesses (20/20/60),
   RHO, Rethinking-Eval (45/10/34). OOD/transfer: AHE (SWE-V, other models), DarwinX (four-rung ladder), Meta-Harness math
   (held-out models), HarnessCompass/Evo-Bench (cross-policy). Reported gaps: Rethinking-Eval +0.6 held-out vs large
   in-set gains; DarwinX 31.7-pt proxy gap; HarnessCompass ≈ 5.6 vs AHE ≈ 8.3 evolve-to-held-out; HarnessBank test
   retains 37–148% of train gain. **RRSI** does evolve / held-out ID / OOD with different tasks, tools, and verifiers,
   with baselines in the same window.
7. **Leakage critics / generalization gates.** Pre-evaluation diff screens: HarnessCompass generalization gate (ban task
   IDs, test names, private symbols, task-token branches, "iteration N showed task X"), HarnessX Critic (anti reward
   hacking, manifest vs trace evidence). Post-hoc audits: Meta-Harness regex audits for task strings, DarwinX
   reward-hacking and action-validity audits, Evo-Bench integrity scans. Structural guards: read-only verifier/config (AHE,
   Evo-Bench), temporal-reveal gate (Adaptive Auto-Harness), scrubbing ground-truth-revealing commands (RHO), disabling
   AHE's explore agent that imports benchmark-tuned harnesses (Rethinking-Eval), diversity keyed on pathology not task
   (HarnessBank). **RRSI's leakage critic** reads each candidate diff *before evaluation* and also rejects "inert
   machinery". HarnessBank's activation gate is the closest analogue for inert machinery.
8. **Structured exploration / anti-collapse.** Planner "untried edit types" (HarnessX), `architecture_checkpoint` after
   repeated local failure (Evo-Bench), semantic MAP-Elites cells (HarnessBank), steered branch roles (TTHE), population +
   recombination (DarwinX, Meta-Harness), Thompson sampling (AutoHarness), GEPA Pareto sampling (Better Harnesses), EGL
   trigger (Adaptive Auto-Harness), multiple independent runs (Better Harnesses). A common observation is collapse toward
   safe prompt edits (HarnessX, HarnessBank, Evo-Bench). **RRSI**: stall indicator σ_t with reserved slots m_draft for
   never-exercised components U_t = K \ T_t, plus a novelty bonus ν for structural component types in the
   within-band acceptance rule.
9. **Minimality / edit sparsity (related to 2).** Informal: Self-Harness "diverse yet minimal", Meta-Harness proposer
   shifting to additive edits, Evo-Bench "one falsifiable mechanism per iteration", HarnessCompass component tracks. None
   anneal it; RRSI's cosine schedule b_t from b_max to b_min = 1 is new.
10. **Proxy/noise-blind per-task non-regression rules are brittle.** Seesaw (HarnessX), Δ ≥ 0 on both splits (Self-Harness),
    preserve-and-extend (DarwinX, with δ). Per-task rules without calibration let sub-threshold regressions accumulate
    (HarnessX τ³ Telecom) or freeze search. RRSI uses an aggregate floor with calibrated δ.

---

## Appendix C algorithm details (RRSI, arXiv 2609.24972, pp. 18–23)

**Baselines (App. B).** Meta-Harness (agentic proposer over source/scores/traces of prior candidates), AHE
(observability-driven: component, experience, decision representations), TTHE (population + agentic judge
at test time, persisting harness), HarnessX (typed modular primitives, trace-driven adaptation).

**C.1 Round-level formulation.** Ω(H) = all harnesses reachable by arbitrary source edits and is left open; RRSI
regularizes the *transition*. Each round:
  𝓗_t ∼ P_reg(· | H_t, F_t, L_t, b_t, E_t, B_t) ⊆ Ω(H_t);   H_{t+1} = argmax_{H' ∈ 𝓗_t ∩ A_t} Ŝ(H'),  else H_{t+1} = H_t.
𝓗_t = sampled candidate collection; H_t = incumbent harness.
F_t = current-round feedback, L_t = edit history, b_t = annealed edit budget, E_t = exploration directives,
B_t = pruning targets, A_t = admissible set. Start S* = Ŝ(H_0). **Before evolution, the unchanged H_0 is evaluated
repeatedly to estimate δ.** The L0/L1/L2 names are analogies only; no norm-penalized objective is optimized and
components aren't coordinates of a shared vector.

**C.2 Proposal side (Algorithm 1).**
1. F_t ← Analyze(H_t, D_evolve).
2. b_t ← b_min + (b_max − b_min)·½(1 + cos(πt/T)): L0-style cap. The proposer drafts an atomic edit pool P_t
   (redrawn each round from open Ω); a candidate is a subset z_t ∈ {0,1}^{|P_t|} with ‖z_t‖_0 ≤ b_t. This caps
   *independently attributable edits bundled per candidate*, not which components may ever change.
3. Stall σ_t ← 𝟙[Ŝ_t − Ŝ_{t−w} ≤ δ].
4. T_t ← components with ≥1 measured edit; U_t ← K \ T_t (never-exercised components).
5. E_t ← (σ_t, U_t, m_draft): during a stall, reserve m_draft candidate slots for exploratory edits on U_t.
6. B_t ← {ℓ ∈ T_t : g_t(ℓ) ≤ 0}, with g_t(ℓ) = max{ΔS_i : ℓ_i = ℓ, t − t_i ≤ n_prune} (max ∅ = −∞): Lasso-style
   pruning targets. The proposer receives B_t *plus the previously accepted edits for those components* and is told to
   remove unproductive machinery.
7. Sample candidates; tag every atomic edit with component and hypothesis; return candidates passing the
   **pre-evaluation leakage screen** (critic reads diff before full evaluation).
- History record per atomic edit: L_t = {(t_i, ℓ_i, h_i, d_i, ΔS_i, ΔC_i, a_i)}, a_i = 1 iff its candidate won the
  round and entered the accepted path (admissible losers get a_i = 0). Multi-edit candidates contribute one record per
  edit, all sharing the candidate's ΔS, ΔC, outcome, so attribution sharpens as b_t → 1. Candidates failing before a
  valid measurement are excluded.
- Component vocabulary K = {prompt, control_flow, config, output_plumbing, context_mgmt, client_tool, skill, memory,
  subagent}.

**C.3 Selection side (Algorithm 2).** For each screened H' in parallel:
1. (Ŝ', Ĉ') ← Evaluate(H', D_evolve, k trials/task); ΔS = Ŝ' − Ŝ_t; ΔC = (Ĉ' − Ĉ_t)/Ĉ_t (relative policy tokens).
2. Novelty ν_t(H') = Σ_{ℓ ∈ K_str} 𝟙[ℓ ∈ comp(H') ∧ N_t(ℓ) = 0], K_str = {client_tool, skill, memory, subagent},
   N_t(ℓ) = prior accepted records tagged ℓ. Prompt/control-flow/config/plumbing/context edits get no bonus.
3. If ΔS > δ: c ← [ΔC ≤ β0 + β1·ΔS] (gain-dependent cost rule, Eq. 7; Ridge-like role).
   Else (within noise band): c ← [w_s·ΔS − w_c·ΔC + w_n·ν > 0] (Eq. 17; shaped admissibility / tie-break). The coding
   instance sets **w_s = 0**, so an in-band score gain alone can never admit a coding candidate; it needs lower cost or
   structural novelty. Workspace and engineering instances use w_s > 0.
4. g ← DomainGuard(H_t, H'): coding and workspace use none (g = 1); the engineering-design guard rejects if the valid-output
   rate drops > 0.03 or the no-submission rate rises > 0.02 vs incumbent (non-compensatory).
5. Admit iff **Ŝ' ≥ S* − δ** (non-compensatory noise-adjusted floor against the *running best*, preventing a walk
   downhill through small regressions) ∧ c ∧ g.
6. H_{t+1} = argmax admissible Ŝ', else keep H_t; S* ← max(S*, Ŝ_{t+1}); write history records with a = 1 for the winner.

**D.1 Hyperparameters (Table 5; tuned on evolve env only, never held-out/OOD).**

| param | coding (TB2.1) | agentic workspace (Harvey LAB) | engineering design (EngDesign) |
|---|---|---|---|
| T rounds | 20 | 20 | 40 |
| k trials/task | 2 | 2 | 4 |
| δ | 0.017 (≈3/178 trials) | 0.004 (≈60/14,100 criteria) | 0.020 (≈5/244 trials) |
| b_min / b_max | 1 / 4 | 1 / 3 | 1 / 4 |
| w (stall window) | 3 | 3 | 3 |
| m_draft | 1 | 1 | 1 |
| n_prune | 4 | 4 | 5 |
| β0 | 0.10 | 0.10 | 0.15 |
| β1 | 44.5 (≈25% tokens per extra pass) | 35.4 (per 100 extra criteria) | 24.4 (≈10% per extra pass) |

**E. Case study (Table 6).** Coding R0-A: bounded pre-completion verification audit + non-blocking polling guidance,
+3.93 → accepted. R0-B: similar edit, +1.69 at +26.1% cost → rejected by cost rule. R8-B: pin literal task instruction
into completion gate, −2.81 despite −13.6% cost → rejected by floor. Engineering R2: bounded recovery hint for "workdir
must be an existing directory" error, 122 → 128/244 passes at +1.6% tokens → accepted.

**Evaluation protocol notes (App. A).** Same window, tool environment, judge, and trial count for harness and baseline.
Infrastructure failures count as failures (APEX full 480 denominator). Harvey LAB split 120 evolve / 40 held-out.
EngDesign 61 tasks with no ID held-out (too small). Frontier-Eng is OOD-only, drops its EngDesign domain (overlap), and
scores 38/47 buildable tasks identically in both arms. GDPval uses a 3-judge cross-vendor panel with both presentation
orders.
