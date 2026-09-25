# RRSI reference sweep: RSI, skills/memory evolution, theory

Source: alphaXiv full-text queries (2026-09-25). Axes per item:
(a) target + fitness, (b) proposal, (c) selection/acceptance + guards, (d) archive/ledger,
(e) credit assignment, (f) pruning/forgetting, (g) evolve/held-out/OOD discipline, (h) theory.

---

## RSI lineage

### 1. Darwin Gödel Machine (DGM), Zhang, Hu, Lu, Lange, Clune, ICLR 2026 (arXiv 2505.22954)
- (a) The coding agent's own Python repo (tools, workflow, prompts) with a frozen FM. Fitness is the pass rate on SWE-bench Verified subsets (staged 10→60→200 tasks) or Polyglot.
- (b) A separate FM reads the parent's benchmark eval logs and proposes "the next feature". The parent agent then implements it in its own codebase.
- (c) Nothing is rejected on score. Every child that compiles and can still edit code enters the archive. Parent sampling weight is sigmoid(λ(α−0.5)) × 1/(1+functioning_children), with λ=10, and every agent keeps nonzero probability. No noise band, no leakage screen, no cost term. The run cost about $22k against $10k for the baselines.
- (d) The archive keeps every valid agent as a tree, and those agents serve as stepping stones. The final best lineage passed through two score dips. Removing the archive ("latest only") hurts performance.
- (e) Nothing is attributed at the edit level. The only credit is the scalar score per node, plus a qualitative lineage narrative (e.g. node 24).
- (f) The archive is never pruned. Perfect-score agents drop out of parent selection.
- (g) Everything is evaluated on the same benchmark subsets. Transfer across models, benchmarks and languages is reported. There was no strict held-out split. Stability over 3 Polyglot runs was 40.7±2.3%.
- (h) Relaxes the Gödel machine from proof to empirical validation. Draws on open-endedness and quality-diversity (novelty bonus through child count).
- Relation to RRSI: this is the unregularized-archive baseline. It has open-ended search, but its selection accepts every valid mutant and ranks on the evolve-set score alone, so it guards against none of the three failure modes.

### 2. Huxley-Gödel Machine (HGM), Wang et al., arXiv 2510.21614
- (a) The same self-editing coding agent as DGM. Fitness is binary per-task success on SWE-Verified-60 or Polyglot.
- (b) DGM-style self-modification. Expanding the tree (a new child) and evaluating one more (agent, task) pair are separate actions.
- (c) Nodes are chosen by Thompson sampling on the clade estimate CMP̂(a) = Σ_clade successes / Σ_clade trials, i.e. Beta(τ(1+n_s^C), τ(1+n_f^C)). τ is an exploration→exploitation schedule that rises monotonically. Pooling across the clade reduces variance, and agents that fail repeatedly can be stopped early. There is no leakage or cost guard, although it spends 2.38× fewer CPU-hours than DGM.
- (d) The tree archive stores per-node success/failure counts, and the clade sums drive both expansion and evaluation.
- (e) Credit goes to lineages, not edits. The paper names the "metaproductivity–performance mismatch": a node's own score correlates only 0.28–0.44 with its descendants' best, while CMP̂ reaches 0.78 weighted. The correlation analysis explicitly excludes target-leaking subtrees.
- (f) No explicit pruning. Weak clades are simply sampled less.
- (g) Optimized on SWE-Verified with GPT-5-mini, then transferred to SWE-bench Lite with GPT-5, where it reaches human-level. That is a real dataset-plus-model shift.
- (h) Theorem 1 states that under repeatable trials, a final-agent-only objective and unit cost per modification, a CMP oracle suffices to implement the Gödel machine. It also frames the search as fixed-budget best-arm identification, MCTS, and infinite-armed bandits.
- Relation to RRSI: HGM is the closest precedent for treating the noise and variance of selection statistically. Its credit is at lineage level. RRSI's per-edit ledger and noise floor work at a finer grain, and HGM has no complexity or leakage term.

### 3. Hyperagents (DGM-H), Zhang et al., arXiv 2603.19461
- (a) A single editable program that holds both the task agent and the meta agent, so the improvement procedure can itself be edited. Fitness is domain task score across coding, paper review, robotics reward design, and Olympiad grading.
- (b) The meta agent sees the whole archive and all evaluations and may edit any code, including itself.
- (c) DGM parent selection with a fixed, handcrafted selector. Staged evaluation assigns 0 when a small subset fails. The best agent is chosen on validation, or on training when no validation split exists. No leakage, noise or cost guard.
- (d) Archive tree. The meta agent learns on its own to build persistent memory, performance tracking and eval-analysis utilities, which amounts to a ledger it invents for itself.
- (e) No formal attribution. The meta agent's self-built performance tracking is a learned version of credit assignment.
- (f) None.
- (g) Has train, validation and test splits. Gains hold on held-out test tasks, and meta-level improvements transfer across domains (review/robotics → math grading, measured by imp@k).
- (h) Metacognitive self-modification. Avoids infinite meta-regress through self-reference. Open-endedness.
- Relation to RRSI: evidence that an evidence ledger helps even when agents build it themselves. RRSI makes that ledger an explicit mechanism instead of hoping it emerges.

### 4. NeoHorse-1, arXiv 2609.08183
- (a) The weights of 4B/9B models. The routing harness is the data source, not the thing being evolved. The signal is a per-turn routing record (predicted tier C0–C3, the policy decision, the tier actually served) plus outcome and verification fields.
- (b) Trajectories become user-turn SFT examples. A routing-score curriculum orders them, and training extends to on-policy distillation.
- (c) Data admission requires structural validation, a six-dimension semantic evaluation, and subscene labels. Every annotation carries its derivation method and confidence, and a semantic judge cannot overwrite structural facts. Evaluation runs on a stratified suite that decontamination screening keeps disjoint from training.
- (d) The corpus keeps the prediction, action and outcome separately and versions tier semantics. It works as a provenance ledger for data, not for edits.
- (e) A "model-deficiency profile" aggregates results by attribute, routing tier and outcome, then shifts the next training mixture toward weak regions. This is attribution at capability-region level.
- (f) Existing and new data are re-allocated together each iteration. There is no explicit forgetting.
- (g) Ten benchmarks: macro 58.94→64.87 (4B) and 65.60→69.04 (9B). Only one pass of the loop was run. The authors state that compounding across iterations is untested.
- (h) Framed informally as an evaluation–selection–update loop, following Good and Yudkowsky.
- Relation to RRSI: the loop is at weight level, not harness level. Its useful contributions are provenance-preserving admission and separating the predicted, executed and outcome records.

### 5. RSI-Exam: NOT FOUND
- A title search on alphaXiv returned no "RSI-Exam". The nearest match is **RSIBench-Data** (arXiv 2607.25886, Meng et al.), summarized here as a substitute. RSI-Index (Vals AI) is another benchmark in the same family and was not read.
- (a) A researcher agent improves a fixed target model (Qwen3.5-35B-A3B, LoRA SFT) by writing training data. Fitness is the selection-eval score, with a separate "official" re-run.
- (b) The agent forms a hypothesis about the capability gap, then builds and validates a data strategy against a whitelisted config.
- (c) Final submission is the historical best selection score. The protocol separates infrastructure from research and forbids protected eval material in training data. Budget is fixed at 16h and $500.
- (d) Each attempt records hypothesis, data, config, checkpoint and eval, which makes runs auditable.
- (e) Process-level attribution only. The authors disclaim single-factor causal claims.
- (f) N/A.
- (g) Key negative results. In 14 of 24 settings a later attempt beats the first. In 18 of the 23 settings that continued past their peak, the final attempt scored below that peak (78%). Selection and official evaluation use the same task subset, and the authors admit there is no statistically held-out split.
- (h) None.
- Relation to RRSI: direct empirical evidence of noise-chasing and non-monotone search. Keeping the historical best masks regressions but does not fix the search. This supports RRSI's noise floor and its call for attribution and stall detection.

### 6. MetaClaw, Xia et al., arXiv 2603.17187
- (a) The meta-model M=(θ, S): policy weights plus a skill library. Signals are failure trajectories (for skills) and PRM scores (for RL).
- (b) An LLM evolver distills new skills from failures: S_{g+1}=S_g ∪ E(S_g, D_sup). GRPO LoRA updates run in idle windows (OMLS: sleep, keyboard idle, calendar).
- (c) There is no validation gate for a skill. It is added once the failure count reaches a threshold. The key guard is **skill-generation versioning**: every trajectory is stamped with a generation g, and when g advances the RL buffer is flushed of samples with version ≤g. Support data (failures that caused the skill) is kept apart from query data (post-adaptation), which prevents stale-reward contamination.
- (d) The generation counter works as a ledger. Skills are clustered into categories after the fact.
- (e) None per skill.
- (f) Append-only: S_{g+1} ⊇ S_g. No pruning.
- (g) Evaluated on an authored 44-day simulation benchmark plus cross-domain transfer to AutoResearchClaw (+18.3% robustness). The authors caution that the benchmark is synthetic.
- (h) Continual meta-learning (a MAML support/query analogy).
- Relation to RRSI: the support/query split and version flush are a leakage and staleness discipline that RRSI's ledger could adopt, since it records which harness version produced each score. Monotonic growth of the skill set is the complexity accumulation that RRSI's pruning targets.

### 7. Agent0, Xia et al., COLM 2026 (arXiv 2511.16043)
- (a) Weights of two agents, curriculum and executor, trained from one base with zero external data. The executor's reward is agreement with its own majority vote. The curriculum's reward is R_C = format · max(0, λ_unc·(1−2|p̂−0.5|) + λ_tool·γ·min(N_tool, C) − R_rep).
- (b) The curriculum agent generates tasks. Tasks are kept only if executor self-consistency p̂ ∈ [0.3, 0.8] (|p̂−0.5| ≤ δ=0.25).
- (c) Noise guard: ADPO scales the advantage by f(p̂), down-weighting ambiguous pseudo-labels, and relaxes the upper clip ε_high(p̂) on ambiguous tasks. Tool reward is capped at C=4 so spurious tool calls are not rewarded. A BLEU-cluster repetition penalty enforces diversity.
- (d) No archive. Each iteration regenerates the task pool.
- (e) None at edit level. The self-consistency signal acts as a per-sample reliability weight.
- (f) None.
- (g) Trained on synthetic math, then evaluated on external math benchmarks and on general OOD (SuperGPQA, MMLU-Pro, BBEH). Gains per iteration are +2%.
- (h) Co-evolution, curriculum at the frontier, self-play.
- Relation to RRSI: two mechanisms transfer. The capped tool reward is a local complexity or cost guard, and confidence-weighted updates are noise-aware acceptance at the sample level.

---

## Skills / memory evolution

### 8. SkillRL, Xia et al., arXiv 2602.08234
- (a) Policy weights (GRPO) plus a hierarchical SkillBank of general and task-specific skills. The signal is binary task success on ALFWorld, WebShop and search QA.
- (b) A teacher (o3) distills skills from successes and turns failures into "failure lessons". At each validation epoch it proposes new skills and refinements, but only for task categories with Acc(C) < δ (0.4). Failures are sampled with a diversity-aware, severity-prioritized round robin.
- (c) New skills are simply added (SKILLBANK ∪ S_new) with no score gate. The KL anchor to the SFT reference keeps the policy close. Context grows, but distillation keeps it roughly 10% below raw-memory baselines.
- (d) The SkillBank itself is the only record.
- (e) Credit is per category (the Acc(C) trigger) but not per skill.
- (f) None. Skills grow from 55 to 100 over 150 steps.
- (g) QA was trained on NQ and HotpotQA and evaluated on 5 OOD datasets, where it is strong (Bamboogle 73.8). ALFWorld and WebShop use the benchmarks' own validation splits.
- (h) Abstraction beats memorization. A continual-learning framing.
- Relation to RRSI: category-gated proposal is a crude form of evidence-aware targeting. The unbounded skill growth is exactly what RRSI's pruning answers.

### 9. SkillOpt, Yang et al. (Microsoft), arXiv 2605.23904
- (a) A single skill document (best_skill.md, 300–2k tokens) for a frozen agent. The signal is the benchmark score on scored rollouts.
- (b) A separate optimizer model reflects on failure and success minibatches separately and proposes add, delete or replace edits. Proposals are merged hierarchically with failure-first priority and ranked, then **clipped to an edit budget L_t**. This "textual learning rate" follows a cosine schedule (default L=4 decaying to 2).
- (c) **Strict held-out gate**: the edit is accepted only if the selection-split score is strictly greater than the current one. Ties are rejected. Splits are train/selection/test at 2:1:7, and the test split stays locked until the final report. Skill hashes are cached so the same skill is never re-evaluated. The prompts ban hard-coded task-specific values.
- (d) A **rejected-edit buffer** (per epoch) records attempted edits and the score drops they caused, and it is fed back to the optimizer as negative feedback. An `edit_apply_report.json` records per-edit accept or skip. An optimizer-side meta-skill summarizes which edit patterns helped or failed across epochs and is never shipped.
- (e) An epoch-wise **slow update** replays the same items under the previous and current skill and buckets them into improvements, regressions, persistent failures and stable successes. The resulting longitudinal guidance goes into a protected field, and that field still passes the gate.
- (f) Explicit delete edits exist. The deployed skill stays compact after only 1–4 accepted edits.
- (g) Reports train rollout, selection-best and unseen test per epoch. Transfers across model scale, across harnesses (Codex→Claude Code +59.7) and to a nearby benchmark.
- (h) An explicit deep-learning analogy: batch size ↔ evidence noise, edit budget ↔ learning rate, gate ↔ validation, slow update ↔ momentum.
- Relation to RRSI: **the closest precedent for its mechanisms**. It has cosine-annealed bounded edits (≈ annealed sparsity), a rejected-edit buffer (≈ negative evidence), and a held-out gate. It lacks a noise band δ (the gate is a strict > with no δ), a leakage critic on diffs, and a cost-aware acceptance term.

### 10. EvolveMem, Liu et al., arXiv 2605.13941
- (a) The retrieval configuration of a memory system: top-k per view, fusion mode, context budget, answer style, and per-category overrides. Fitness is F1 on LoCoMo or MemBench.
- (b) An LLM diagnosis module reads per-question raw logs (question, prediction, gold, sources) and proposes Δθ. It can invent new dimensions, which is how entity-swap, query decomposition and answer verification appeared.
- (c) A three-branch update. **Revert** to the best-so-far if f_{r−1}−f_r > τ_rev. **Explore** with a random perturbation if |Δf| < ε for 2 rounds (stall detection). Otherwise **apply** Δθ clamped to safe ranges. Evaluation and evolution use the same QA set, and there is no noise band or leakage guard.
- (d) Per-round raw logs and the best-so-far config.
- (e) Per-component ablation after the fact (e.g. −9.63 F1 when diagnosis is replaced by random search). There is no in-loop attribution.
- (f) Memory content decays linearly by importance (α_d=0.05 per 30 days, floor 0.15), with Jaccard dedup and capped entity reinforcement. The config itself is never pruned.
- (g) Evolved on the evaluation questions themselves, which is a real overfit risk. It transfers positively LoCoMo→MemBench (0.543 zero-shot, and 0.792 after continued evolution, which beats evolving on MemBench from scratch).
- (h) "AutoResearch" (observe, hypothesize, experiment, validate). Complementary learning systems and Ebbinghaus forgetting for content.
- Relation to RRSI: its stall→explore rule matches RRSI's structured exploration and revert-on-regression is a crude floor. It has no held-out split, so it is a candidate for the benchmark-fitting failure mode.

### 11. ReasoningBank, Ouyang et al., ICLR 2026 (arXiv 2509.25140)
- (a) A test-time memory of distilled strategy items (title, description, content). The signal is an LLM-as-judge success or failure label with no ground truth.
- (b) Each trajectory yields at most 3 items. Successes become strategies and failures become preventive lessons. The prompts forbid naming specific sites, queries or strings, a leakage-style abstraction guard at extraction time. MaTTS (parallel self-contrast over k trajectories, or sequential re-check) produces contrastive memory.
- (c) No acceptance gate. Consolidation is plain append.
- (d) A JSON bank of (query, trajectory, items), retrieved by embedding top-k (k=1).
- (e) None per item.
- (f) None. The authors call merging and forgetting future work.
- (g) A streaming test-time learning setting, with no train/test separation beyond the stream. Robust to judge noise: success rate stays flat for judge accuracy of 70–90%, measured against the real judge's 72.7%. Token cost is +4.3% against +20.5% success rate.
- (h) Memory as a new scaling dimension alongside test-time scaling.
- Relation to RRSI: its "no specific entities" rule is a proposal-side version of RRSI's leakage screen. Its judge-noise robustness study is a model for measuring δ. Its append-only memory is the accumulation that RRSI prunes.

### 12. Agent KB, Tang et al., arXiv 2507.06229
- (a) A knowledge base of experience units ⟨task embedding, goal predicates, (action, reasoning) pairs, compatibility metadata⟩ shared across smolagents, OWL, SWE-Agent and OpenHands.
- (b) Two-stage Reason→Retrieve→Refine. The planning stage retrieves workflows. The feedback stage retrieves fixes keyed on execution traces. Retrieval is hybrid BM25 plus embeddings, α=0.5, k=3.
- (c) **Disagreement gate**: a refined plan ρ′ is applied only if cos(φ(ρ), φ(ρ′)) ≥ β=0.8. This keeps edits close to the original plan and is a trust-region-like bound on how far a revision may move. Dedup applies when cos > 0.8, and an LLM ranker keeps the better entry.
- (d) The KB with per-entry utility u_j ← u_j + η(r_j − u_j), where r_j is retrieval success or execution gain.
- (e) **Per-entry utility credit**: an EMA of each entry's measured contribution.
- (f) **Utility-based eviction** balancing recency, frequency and transferability. Low-utility entries are evicted.
- (g) The KB is built from separate datasets (BrowseComp, HopRAG, SWE-Gym, etc.) and evaluated on GAIA, SWE-bench Lite, HLE and GPQA. Its "pass@2/3" lets failure diagnoses from earlier attempts on the same instance feed later attempts, which is a leakage-adjacent protocol. Transfer is asymmetric: reasoning experience transfers to SWE (37%), but SWE experience fails on GAIA.
- (h) A restructured case-based reasoning cycle (Retrieve–Reuse–Revise–Retain).
- Relation to RRSI: its EMA utility with eviction is the closest precedent to RRSI's structural pruning ("a mechanism must keep earning its place"), applied to memory entries rather than harness components.

### 13. AutoMem, Wu et al. (Stanford), arXiv 2607.01224
- (a) Two targets: (1) the memory scaffold (code, prompts, file schema, action vocabulary), and (2) a LoRA "memory specialist" model. The task model stays frozen. Fitness is BALROG progression (Crafter, MiniHack, NetHack).
- (b) A meta-LLM (Opus) reviews full episode traces of up to 10^5 steps and revises the scaffold. In loop 2 the meta-LLM selects the agent's own good memory operations as SFT data and chooses the LoRA config jointly.
- (c) Each scaffold revision is **kept only if average progression improves on the same fixed seeds**. It is a greedy gate with no noise band, and SE is large (e.g. 27.5±7.1). Keeping the task model frozen guards task competence.
- (d) Scaffold versions v0–v5 with gate and retry mechanics.
- (e) None per edit. The meta-LLM's diagnosis stands in for it.
- (f) The meta-LLM itself introduced dedup (a coordinate-keyed map) to fix unbounded map-file growth. That pruning was discovered, not built into the mechanism.
- (g) The same fixed 10 seeds are used for the gate and for reporting. Worlds are procedurally generated, but there is no separate held-out seed set.
- (h) Metamemory (Flavell, Nelson), the extended mind, and an explicit θ/∇L analogy (scaffold = parameters, revision = gradient).
- Relation to RRSI: an example of gate-on-evolve-seeds with a large SE, which is exactly where RRSI's noise-adjusted floor applies. It also shows that bloat (unbounded files) appears naturally and has to be pruned.

### 14. EnvHarness / EnvRigger, Huang et al. (Google), arXiv 2608.19880
- (a) The environment rather than the agent. Plug-in wrappers are Stage (initial state), Contract (action and observation filters and transition changes) and Chain (concatenated episodes). The original verifier is kept unchanged.
- (b) EnvRigger follows Observe→Diagnose→Write→Validate on a black-box policy's successes and failures, and makes the environment harder when the policy is at SR=1.
- (c) The Validate step decides ACCEPT, REFINE or REJECT from **rollout statistics over K runs, never a single trace**. It targets an SR band: candidates that are unsolvable (SR=0) or trivial are rejected. The prompt says to prefer narrow perturbations and to keep working hooks verbatim, adjusting only their magnitude. Reward (R) is deliberately not exposed, so the eval metric cannot be gamed.
- (d) Accepted components accumulate into the harness, with a revision budget.
- (e) Per-component: each candidate is validated in isolation against its diagnosed flaw.
- (f) No pruning. Components are non-commutative compositions.
- (g) Held-out instances and OOD splits (ALFWorld OOD +9.0). An RL variant was also run.
- (h) An analogy between agent harness and environment harness. Unsupervised environment design and curriculum learning.
- Relation to RRSI: the practice of "decide from K-rollout statistics", the SR band, and the "narrow perturbation" rule all echo RRSI's noise-aware acceptance and sparse, attributable edits. The verifier stays locked (the R axis is not exposed), which is an anti-leakage and anti-gaming design.

---

## Theory / evaluation

### 15. Dwork et al. 2015, "Generalization in Adaptive Data Analysis and Holdout Reuse" (arXiv 1506.02629)
- Problem: reusing a holdout adaptively overfits the holdout itself. In their synthetic experiment (n=10k, d=10k, labels independent of the data), the standard holdout reports more than 63% accuracy at k=500 while the true accuracy is 50%.
- **Thresholdout (exact rule, Fig. 1).** Inputs: training set S_t, holdout S_h, threshold T, noise rate σ, budget B.
  1. Sample γ ~ Lap(2σ) and set T̂ ← T + γ.
  2. For each query φ: X→[0,1]:
     - If B < 1, output ⊥ (stop answering).
     - Otherwise sample η ~ Lap(4σ).
     - If |E_{S_h}[φ] − E_{S_t}[φ]| > T̂ + η (overfitting detected): sample ξ ~ Lap(σ) and a fresh γ ~ Lap(2σ); set B ← B−1 and T̂ ← T + γ; **output E_{S_h}[φ] + ξ**.
     - Otherwise **output E_{S_t}[φ]**. The holdout leaks only one bit, "close enough".
  - Privacy: (2B/(σn), 0)-DP, or (√(32B ln(2/δ))/(σn), δ)-DP. It is Sparse Vector plus the Laplace mechanism.
  - Guarantee (Thm 25): set T = 3τ/4 and σ = τ/(96 ln(4m/β)). Then P[∃i: Z_i < B and |a_i − P[φ_i]| ≥ τ] ≤ β whenever n ≥ O(ln(m/β)/τ²)·min{B, √B·ln(ln(m/β)/τ)}. The number of queries m can be **exponential in n** as long as the number of overfitting events is B ≲ n^{2−c}. A one-sided variant charges the budget only when the holdout is worse than training.
  - The experiments used T=0.04 and τ=0.01 with Gaussian noise.
- **SparseValidate**: the analyst submits arbitrary Boolean tests ψ on the holdout, with a budget of m total queries and B that return 1. The false-positive probability inflates by at most ℓ_i = Σ_{j≤min(i−1,B)} C(i,j) ≤ m^B, a description-length argument. It gives no corrected estimate.
- Unifying frame: **approximate max-information**, which composes DP-based and description-length-based guarantees. Cross-validation and bootstrap do not fix adaptive reuse.
- Relation to RRSI: this supplies the theory for RRSI's claim that an adaptively reused evolve set overfits. The lesson is to let a finite validation set reveal as little as possible per query (bits, noise, a budget on "surprising" answers). RRSI's ledger ("do not re-test falsified hypotheses") limits adaptive queries, and its noise floor δ plays the role of T. RRSI does not add DP noise or an overfitting budget B, and that gap is worth noting.

### 16. Louizos, Welling, Kingma 2018, "Learning Sparse NNs through L0 Regularization" (arXiv 1712.01312)
- Each parameter group is multiplied by a stochastic gate z ∈ [0,1], so ‖θ‖₀ = number of active gates.
- Gates use the **hard concrete** distribution: a binary concrete sample s = σ((log u − log(1−u) + log α)/β) is stretched to (γ,ζ) = (−0.1, 1.1) and clipped with z = min(1, max(0, s̄)). This puts point masses at exactly 0 and 1.
- The expected L0 penalty Σ_j σ(log α_j − β log(−γ/ζ)) = Σ P(z_j ≠ 0) is differentiable through the reparameterization trick, so gates and weights train jointly by SGD.
- At test time ẑ = clip(σ(log α)(ζ−γ)+γ). It combines with L2 (group sparsity, expected L2 weighted by the gate's active probability). It is a surrogate for a spike-and-slab variational bound, and AIC and BIC are special cases for fixed λ.
- Relation to RRSI: the conceptual source of "annealed update sparsity". RRSI counts the non-zero edits per candidate, which is L0 over the edit vector, but uses a hard, annealed cap in place of a learned λ.

---

## Blogs

### 17. Ding et al., "What evolves when we talk about harness evolution?" (Harness-Delta Attribution)
- (a–c) Studies existing harness-evolution methods around a frozen LLM, covering prompts, tools, memory, skills, orchestration code and control flow.
- (e) **HDA** splits an observed gain into Overfitting (O), Test-time scaling (T) and Generalizable (G). It uses a compute-matched baseline B_cc and an evolved harness with detected shortcuts neutralized (E_neutral), and treats G as a conservative upper bound.
- Findings: most gains are illusory. ALFWorld is 98% O (hard-coded object layouts, zero LLM calls). LiveMath is 79% O (a recurring answer phrase in 21/35 questions). CREATE is 73% T (parallel sampling). In 4 of 16 settings the held-out score was worse than baseline despite training gains. Selecting on validation reduced O but still left gaps of 5.9–11.7 points below the training gains.
- Recommendations: report held-out results and overfitting, charge test-time compute in utility, and use benchmarks with fewer artifacts and real distribution shift.
- Relation to RRSI: this is the empirical diagnosis RRSI answers. O maps to leakage screening and benchmark-specific fitting. T maps to complexity-aware acceptance (ΔC ≤ β0 + β1ΔS). Its finding that validation selection is not enough matches Dwork's theory.

### 18. Weng, "Harness engineering for self-improvement" (2026-07-04)
- A harness is the orchestration around a base model: workflow, tools, context, evaluation. Self-improvement runs through harness optimization (prompt → structured context → workflow → executable harness code), meta-level context engineering (MCE, Meta-Harness), and evolutionary search (AlphaEvolve, DGM, ShinkaEvolve).
- Selection: Self-Harness uses weakness mining plus bounded proposals. AHE requires edits backed by observability evidence, each with a predicted next-round impact. Evolutionary methods keep a Pareto frontier.
- Archives: skill and eval databases, and file-based history. Failed attempts are kept as learning resources.
- Risks: "a loop optimizes whatever signal it is given" (reward hacking, gaming verifiers), over-optimism, and "numerical duct tape". Mitigations are held-in and held-out splits plus read-only evaluators and training systems. Diversity collapse is also a risk.
- Theory: bi-level optimization, where the inner loop is content and the outer loop is the mechanism.
- Relation to RRSI: this survey places RRSI's regularizers in context. AHE's "predicted impact per edit" is close to RRSI's hypothesis field in its ledger, and read-only evaluators are the infrastructure half of leakage defense.

### 19. Zhang & Khattab, "Language model harnesses are compositional generalizers"
- Claim: a good harness makes each LM call see a *locally in-distribution* input even when the whole task is OOD. Recursive LMs do this by offloading context into symbolic variables and calling sub-agents programmatically.
- Evidence: training on tasks 8–32× shorter generalizes to longer ones. Transfer across domains works when the structure is shared and the tokens differ, whereas plain Transformers fail.
- Implication: generalization capacity can sit in the harness's decomposition, and harness design changes the scaling coefficients.
- Relation to RRSI: the positive counterpart to the case for regularization. Harness edits that decompose problems (mechanism) should generalize OOD. Edits that encode instance content should not. That supports RRSI's leakage screen and its preference for single-mechanism, attributable edits.

---

## Cross-cutting patterns

### Archives / lineages / ledgers
- **Keep-everything archive (quality-diversity):** DGM (1) and DGM-H (3) keep every valid node, and HGM (2) keeps a tree with per-node counts. These serve as stepping stones, not as evidence.
- **Evidence ledgers of attempts:** SkillOpt (9) has a rejected-edit buffer, an edit_apply_report, and an optimizer meta-skill. RSIBench-Data (5) records hypothesis, data, config and result per attempt. NeoHorse (4) keeps separate prediction, action and outcome records. MetaClaw (6) stamps generation versions. DGM-H (3) grows its own performance tracking.
- **Contrast:** only SkillOpt feeds *rejected* edits back to the proposer as negative evidence, which is RRSI mechanism B in miniature. HGM uses lineage statistics for selection, not for proposal.

### Credit assignment / attribution
- **Lineage level:** HGM's CMP (2).
- **Per entry, online:** Agent KB's EMA utility (12).
- **Per category, triggering proposals:** SkillRL's Acc(C)<δ (8). NeoHorse's deficiency profile (4).
- **Longitudinal before/after replay:** SkillOpt's slow update (9), which sorts items into improvements, regressions, persistent failures and stable successes.
- **Post-hoc decomposition:** Ding HDA into O/T/G (17). EvolveMem's ablations (10).
- **No per-edit attribution:** DGM, DGM-H, AutoMem, ReasoningBank, MetaClaw. None of them caps edit count *to make* attribution possible. SkillOpt's edit budget comes closest.

### Noise handling
- **Statistical selection:** HGM uses Thompson sampling on clade-pooled counts (2). EnvRigger decides from K-rollout statistics, never one trace (14).
- **Sample-reliability weighting:** Agent0's ADPO advantage scaling by self-consistency (7).
- **Judge-noise robustness measured:** ReasoningBank flips labels at simulated judge accuracy of 50–100% (11).
- **Strict gate with no noise band:** SkillOpt's strict > with ties rejected (9) and AutoMem's same-seed gate (13).
- **Revert and floor-like rules:** EvolveMem reverts when the drop exceeds τ_rev (10). RSIBench-Data keeps the historical best (5), yet 78% of continued runs finish below their peak, which is evidence of noise-chasing.
- **Formal noise:** Dwork's Laplace-noised threshold (15).
- **Gap:** no item pre-measures a noise band δ by re-running an unchanged baseline, as RRSI mechanism E does.

### Forgetting / pruning / decay
- **Explicit eviction by utility:** Agent KB (12).
- **Importance decay, dedup, capped reinforcement (content only):** EvolveMem (10).
- **Delete edits in the proposal space:** SkillOpt (9).
- **Emergent dedup found by the meta-LLM:** AutoMem (13).
- **Append-only with monotone growth:** MetaClaw S_{g+1}⊇S_g (6), SkillRL 55→100 skills (8), ReasoningBank (11), DGM/DGM-H archives, EnvHarness components.
- **Takeaway:** almost none prune *harness mechanisms* for lack of measured gain. RRSI mechanism G is new in that respect, and Agent KB's eviction is the nearest analogue.

### Evolve vs held-out vs OOD discipline
- **Proper 3-way splits:** SkillOpt 2:1:7 with test locked (9). DGM-H train/val/test (3). EnvHarness held-out plus OOD (14). SkillRL on OOD QA (8).
- **Transfer shifts:** HGM across dataset and model at once (2). SkillOpt across model, harness and benchmark (9). EvolveMem LoCoMo→MemBench (10). DGM across models and languages (1). Agent KB's asymmetric domain transfer (12).
- **Evolve set = report set (weak discipline):** EvolveMem (10), AutoMem's fixed seeds (13), RSIBench-Data's selection = official subset (admitted) (5), DGM benchmark subsets (1). Agent KB's pass@k feeds earlier attempts forward on the same instance (12).
- **Reported generalization gaps:** Ding HDA shows validation-selected harnesses 5.9–11.7 points below training gains, and 4 of 16 settings end below baseline held-out (17). Dwork's classic 63% vs 50% (15).

### Leakage / benchmark-fitting guards
- **Proposal-side abstraction rules:** ReasoningBank bans specific sites, queries and strings (11). SkillOpt bans hard-coded task values (9).
- **Frozen verifier and read-only evaluator:** EnvHarness hides the R axis (14). Weng's read-only evaluators (18). RSIBench-Data forbids protected eval material (5). NeoHorse decontamination screening (4).
- **Staleness and leak separation:** MetaClaw support/query plus version flush (6). HGM target-leak exclusion in its analysis (2).
- **Gap:** none has a critic that reads each *diff* before evaluation, as RRSI mechanism D does.

### Cost / complexity growth
- **Capped local incentives:** Agent0 caps the tool reward at C (7).
- **Token accounting:** ReasoningBank +4.3% tokens (11). SkillRL about −10% context against raw memory (8). Agent KB overhead under 0.4% (12). EnvHarness −9.8% steps (14).
- **Cost as utility term:** only Ding HDA's T component (17) and Weng's discussion (18) treat test-time compute as something to charge for. No method has an acceptance rule like ΔC ≤ β0+β1ΔS. RRSI mechanism F is new here.
- **Bounded edit magnitude:** SkillOpt's edit budget (9). Agent KB's cosine disagreement gate β=0.8 (12). EnvRigger's "narrow perturbations" rule (14).

### Exploration / stall handling
- **Stall→explore:** EvolveMem adds random perturbation after 2 flat rounds (10). RRSI's structured exploration is a targeted version (unexercised components).
- **Scheduled exploration→exploitation:** HGM's τ (2). SkillOpt's cosine budget decay (9). RRSI's annealed b_max→b_min.
- **Novelty and diversity:** DGM child-count bonus (1). Agent0 BLEU repetition penalty (7). SkillRL categorical-entropy sampling (8).

### Theory
- **Gödel machine lineage:** DGM (empirical relaxation), HGM (Theorem 1: a CMP oracle is equivalent to a GM), DGM-H (metacognitive self-reference).
- **Adaptive data analysis:** Dwork (15). Ding's O/T/G is its empirical cousin (17). None of the evolution papers applies DP noise or a holdout budget.
- **Regularization:** L0 hard-concrete (16) maps to RRSI's sparsity cap. SkillOpt's DL analogy (learning rate, momentum, validation) and AutoMem's θ/∇L analogy are the practical counterparts.
- **Quality-diversity and open-endedness:** DGM, DGM-H. Bandits and best-arm identification: HGM. Meta-learning: MetaClaw. Curriculum and UED: Agent0, EnvHarness. Metamemory: AutoMem. Compositional generalization: Zhang & Khattab (19).

### Items not found
- RSI-Exam: no match on alphaXiv. RSIBench-Data (2607.25886) is used as the nearest substitute, and RSI-Index (Vals AI) is noted but was not read.
- All three blogs were fetched successfully.
