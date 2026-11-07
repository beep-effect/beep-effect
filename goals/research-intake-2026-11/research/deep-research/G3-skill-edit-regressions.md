# G3. Skill and prompt edits break mastered items behind aggregate gains

## Question

Cluster G3 of `goals/research-intake-2026-11/research/CONTRADICTIONS.md` asks
whether edits to skills, prompts or instruction files for LLM coding agents
preserve behavior the agent had already mastered. Which controlled,
same-harness, item-level studies report regressions alongside gains? The
edits in scope are skill optimization, prompt optimization, AGENTS.md or
CLAUDE.md-style context files, and DSPy/GEPA-style optimizers. Background:
captures report aggregate gains. Critiques in the same captures note three
problems. Aggregate improvement does not show that item-level regressions are
absent (arXiv 2609.36043). Cross-harness benchmark charts are not controlled
comparisons. A governed-skills evaluation measured the infrastructure workflow
rather than agent outcomes (arXiv 2606.16523).

## Method

- Process: the deep-research skill. Three researchers ran in parallel, one per
  lane:
  - prompt and skill optimizers (SAGE, GEPA, MIPROv2, ACE, GRASP, SkillsBench);
  - context files, agent skills and harness variance (AGENTS.md studies,
    SkillsBench, SWE-Skills-Bench, SkillWiki, Epoch, Terminal-Bench, run-to-run
    noise);
  - measurement methods for negative flips (model-update compatibility,
    prompt sensitivity, instruction interference, paired statistics).

  One report writer synthesized their notes.
- Sources: public web and academic sources only. These were arXiv abstract and
  HTML pages, ICLR and ACL listings, and the Epoch AI blog. Pages were read
  through a summarizing fetch tool, so quotes are short verbatim fragments it
  returned. Table figures should be spot-checked against the PDFs before
  anyone republishes them.
- Date: 2026-11-07. Model: `claude-opus-5-5`.
- Read in primary text: SAGE (2609.36043, full HTML), SkillsBench (2602.12670,
  current HTML; Appendix G with the CI method not read), SWE-Skills-Bench
  (2603.15401), Gloaguen et al. (2602.11988), SkillWiki (2606.16523),
  Terminal-Bench (2601.11868), Bjarnason et al. (2602.07150), MUSCLE
  (2407.09435), Ma et al. (2311.11123), Harada et al. (2509.21051), Miller
  (2411.00640), τ-bench (2406.12045), the Epoch AI post. GEPA (2507.19457v2)
  and ACE (2510.04618) were read only to about the first 100k characters, so
  their appendices are unread.
- Abstract-only: GRASP (2605.29668), Why Prompt Optimization Works
  (2605.26655), stability-aware prompt optimization (2601.22373), Library
  Drift (2605.19576), FormatSpread (2310.11324), State of What Art
  (2401.00595), IFScale (2507.11538), Positive-Congruent Training
  (2011.09161), and Lulla et al. (2601.20404, from the search snippet).
- Secondhand (snippet, blog or summary, not read): OPRO (2309.03409),
  PromptBridge (2512.01420), BReAD (2507.09839), PromptCOS (2509.03117), GEPA
  blog and DSPy case-study posts, Designer RSI (2609.22086), RepairGate,
  Memento-Skills, Xie et al. (2105.03048), Prompting in the Wild (2412.17298),
  the original curse-of-instructions paper, the harness survey 2606.20683,
  2603.25764, 2608.13867, the Epoch GPT-5.1 68% vs 76.3% blog figure, and
  earlier-version SkillsBench figures. Their numbers are not used as primary
  evidence below.

## Findings

### SAGE measures the hidden regressions directly: up to 46% of solved items

- arXiv 2609.36043 is SAGE, "A Statistical Acceptance Gate for Self-Evolving
  Agents". It is an empirical gate design, not a general critique. It defines
  regression rate as "the fraction of the items the current skill already
  solves that an accepted edit breaks", measured by a paired
  incumbent-vs-candidate run on identical validation items
  ([2609.36043](https://arxiv.org/html/2609.36043)).
- The naive gate "keeps any edit which improves an aggregate validation
  score". The paper names two defects. The gate "admits permanent regressions,
  since an edit can raise the average while breaking items the skill already
  solves". It is also biased by the Optimizer's Curse: "choosing the edit with
  the highest observed score is upward biased"
  ([abs](https://arxiv.org/abs/2609.36043)).
- Setup: 5 benchmarks (LiveMath, SpreadsheetBench, SearchQA, OfficeQA Pro,
  ALFWorld) × 4 backbones (DeepSeek-V4-flash, GLM-5.2, MiniMax-M3, Qwen3.6).
  Three arms run on the same SkillOpt optimizer at equal budget: the naive
  aggregate gate, paired comparison without a test, and full SAGE.
- Under the naive gate, accepted edits broke **2.4% to 45.6%** of
  already-solved items. Examples: OfficeQA Pro 38.7–45.6% and LiveMath
  27.5–39.4% across backbones. SAGE cut the rate in 19 of 20 settings, mostly
  to 0.0% (the one tie is GLM-5.2 SearchQA at 2.4%). It also had the highest
  final score in all 20, an average of +8.73 points
  ([2609.36043](https://arxiv.org/html/2609.36043)).
- The test is a one-sided exact conditional binomial on discordant pairs. At
  λ = 1 it is the one-sided exact McNemar test. λ, τ and α are "tuned on
  held-out data only".
- Limits the paper states or that the text shows:
  - "the validation set is reused across optimization steps, so
    trajectory-level error rates are not controlled". The regression rates are
    therefore in-sample.
  - Seeds and held-out-test regression rates are not reported.
  - The results cover one optimizer on the authors' benchmark set.
- The CONTRADICTIONS.md phrasing "aggregate improvement does not show
  item-level regressions are absent" is a paraphrase. The closest verbatim
  line is that paired comparison "exposes regressions that an aggregate score
  hides".

### Skill benchmarks show averages riding on harmful tasks and skills

- SkillsBench (current version, [2602.12670](https://arxiv.org/html/2602.12670))
  is the most controlled same-harness, same-model comparison found. "Each task
  runs under two matched conditions" (no Skills vs curated Skills) in the same
  pinned container. It uses three trials per (configuration, task, condition)
  cell, paired deltas, and 95% CIs in the figures.
  - Curated Skills raise pass rate "from 33.9% to 50.5%" across 18
    model-harness configurations. Yet "13 of 87 tasks show negative Skills
    deltas". The largest drops are −7.4 pp (exam-block-sequencing,
    suricata-custom-exfil). The stated cause is "a single 'correct' pipeline
    without applicability boundaries or lightweight fallbacks."
  - Self-generated Skills "land below the no-Skills baseline on all three
    configurations": −8.1 pp (Claude Code + Opus 4.7), −11.3 pp (Codex +
    GPT-5.5), −11.5 pp (Gemini CLI + Gemini 3.1 Pro).
  - Design matters. "Comprehensive" skills add +0.7 pp against +19.0 for
    compact ones, and four or more skills add +10.1 pp against +19.0 for 2–3.
  - Caveat: a −5.6 to −7.4 pp task delta at three trials per cell amounts to
    one or two flipped trials. Without per-task CIs these are not established
    regressions. Versions disagree: v1 reported 16 of 84 negative tasks and
    +16.2 pp ([v1](https://arxiv.org/abs/2602.12670v1)).
- SWE-Skills-Bench ([2603.15401](https://arxiv.org/html/2603.15401)) tests 98
  public skills, each paired with a real repository, over 3,920 paired runs.
  - "92 of 98 skills have no statistically significant effect". Four help and
    two harm. asyncio-patterns drops "from a pass ratio of 83.20 to 66.24" and
    is negative in all four configurations. The average moves 76.6%→76.9%.
  - A configuration-specific regression hides behind an "ineffective" label.
    github-actions-templates is −5.14 overall but −22.78 pp under Claude Code +
    Haiku 4.5, because the agent wrote deliverables to `.github/workflows/`
    instead of `ci/`. The mechanism is that harmful skills anchor the agent on
    their templates and override task instructions.
  - The statistics are item-level and paired: "an exact two-sided paired
    sign-flip test" over each skill's ten requirement deltas. But each
    condition runs once per configuration, so "no significant effect" is weak
    evidence of no effect.
- Both benchmarks compare skill vs no skill. Neither tests a revision of a
  skill (v1 vs v2), which is what "preserving mastered behavior" needs.

### Context files and optimizer papers report aggregates only

- Gloaguen et al. ([2602.11988](https://arxiv.org/html/2602.11988), ICLR 2026)
  hold harness and model fixed and vary the context file: none, LLM-generated
  or developer-written.
  - Context files "does not generally improve task success rates" while
    "increasing inference cost by over 20% on average".
  - LLM-generated files lowered success in 5 of 8 cells, by up to −8.0 pp
    (Claude Code + Sonnet-4.5, 73.2→65.2) on the repository benchmark. The
    differences are not significant (CMH p = 0.37 and p = 0.87). The cost
    increase is (p < 0.00001 and p = 0.00064).
  - "We sample completions for each agent once." There is no per-task
    gain/regression table.
- Lulla et al. ([2601.20404](https://arxiv.org/abs/2601.20404), snippet only)
  report lower median runtime and output tokens with AGENTS.md, but measure
  efficiency, not correctness.
- GEPA ([2507.19457v2](https://arxiv.org/html/2507.19457v2)) uses per-instance
  scores only inside the optimizer ("GEPA records the highest score across all
  candidates, forming a Pareto frontier"), not as reported evidence.
  - Its Table 1 still shows benchmark-level regressions on Qwen3 8B. MIPROv2 is
    below baseline on IFBench (36.22 vs 36.90), AIME-2025 (20.00 vs 27.33) and
    LiveBench-Math. GEPA+Merge drops IFBench to 28.23, and the text concedes
    Merge can "lead to performance degradation when used with Qwen3 8B."
  - No seeds, CIs or significance tests appear in the text read.
  - Its cross-model transfer to GPT-4.1 Mini improved every benchmark. That is
    benchmark-level, not item-level.
- ACE ([2510.04618](https://arxiv.org/html/2510.04618)) gives the clearest
  forgetting analogue, context collapse. A full rewrite took the context from
  18,282 tokens to 122, "with accuracy dropping to 57.1". That is below the
  no-adaptation baseline of 63.7. ACE reports split aggregates only, with no
  seeds.
- Abstract-only signals point the same way. GRASP's regression-budget gate
  "lifts each of them in-domain and none of them out of distribution"
  ([2605.29668](https://arxiv.org/abs/2605.29668)). 2605.26655 finds that
  "the superiority of the optimized prompt on one benchmark often fails to
  transfer to another" ([2605.26655](https://arxiv.org/abs/2605.26655)).

### SkillWiki governs edits procedurally and never measures outcomes

- SkillWiki ([2606.16523](https://arxiv.org/html/2606.16523)) "places all skill
  changes under an auditable governance workflow". Its evaluation counts
  conversions: of 125 source artifacts, "99 were successfully converted into
  governed skill candidates". It then walks one artifact through lifecycle
  states S0–S7.
- Its Limitations section says it measures "the effectiveness of the proposed
  infrastructure and governance workflow," not "the downstream impact of
  SkillWiki on diverse agent benchmarks." The critique in CONTRADICTIONS.md
  is accurate. The paper is not evidence about regressions in either
  direction.

### Harness swaps and run noise dwarf most edit effects

- For a fixed model, the harness moves scores by about 6–17 pp:
  - Epoch reports that "simply switching the scaffold makes up to an 11%
    difference for GPT-5" and up to 15% for Kimi K2 Thinking on SWE-bench
    Verified. It also says that "The choice of scaffold has the single biggest
    impact on the overall performance"
    ([Epoch AI](https://epoch.ai/gradient-updates/why-benchmarking-is-hard)).
  - Terminal-Bench reports that "agent and model performance are hard to
    decouple", that each model's scaffold "was chosen to maximize
    performance", and that Gemini-2.5-Pro gains 17% with Terminus 2 over
    OpenHands. Opus 4.5 scores 57.8% (Terminus 2), 52.1% (Claude Code) and
    51.9% (OpenHands). The project built Terminus 2 as "a neutral testbed"
    ([2601.11868](https://arxiv.org/html/2601.11868v1)).
  - In SkillsBench, Opus 4.7 scores 61.2% in Claude Code vs 53.1% in
    OpenHands.
- The direction of the effect is unstable. Vendor harnesses win in SkillsBench
  but lose to Terminus 2 for Opus 4.5. A chart of "model A in harness X" vs
  "model B in harness Y" cannot attribute the gap to the model.
- Run-to-run noise sets the floor ([2602.07150](https://arxiv.org/html/2602.07150v2)):
  - "single-run pass@1 estimates vary by 2.2 to 6.0 percentage points", with
    SD above 1.5 pp "even at temperature 0".
  - Detecting a 2-point improvement at p < 0.05 with 80% power needs about 9
    runs per agent. A 1-point improvement needs about 36.
  - τ-bench shows the same: gpt-4o falls from 61.2 pass^1 to below 25% pass^8
    on retail ([2406.12045](https://arxiv.org/html/2406.12045)).
- Repetition in the edit studies is mostly below that floor. Gloaguen and
  SWE-Skills-Bench run once per condition. SkillsBench runs 3 trials and
  Terminal-Bench at least 5. None reports per-item flip rates across repeated
  runs.

### Model-update and instruction literature supplies the measurement method

- Negative flip rate (NFR) is the established metric: "previously correct
  instances are now predicted incorrectly"
  ([MUSCLE, 2407.09435](https://arxiv.org/html/2407.09435v2)).
  - LLM version bumps that raise accuracy still flip 3–12% of items on
    classification and math benchmarks. Examples: GSM8K Llama 1→2 8.49%;
    HellaSwag Vicuna 1.3→1.5 10.48%.
  - MUSCLE finds "more negative flips for model updates with a smaller delta
    in performance gain", which makes marginal edits the worst case.
- Ma et al. ([2311.11123](https://arxiv.org/html/2311.11123v2)) cross prompts
  with API model updates. Paraphrased in the fetch summary: about 10.9% of
  predictions went from correct to wrong, and 87.9% of accuracy-improving
  updates still regressed at least one item. Most regressions were
  high-confidence. The paper recommends tracking individual flips, slice-level
  tests, and prompt versioning.
- Adding instructions erodes joint compliance even when per-instruction
  compliance holds ([2509.21051](https://arxiv.org/html/2509.21051)).
  - On StyleMBPP, Claude 3.5 Sonnet prompt-level accuracy falls from 0.96 at
    one instruction to 0.01 at six, while instruction-level accuracy stays at
    0.80.
  - IFScale reports "68% accuracy at the max density of 500 instructions" and
    a "bias towards earlier instructions"
    ([2507.11538](https://arxiv.org/abs/2507.11538)).
- Statistics: Miller recommends "the paired version of the standard error
  estimate wherever practicable", per-item resampling, and power analysis, and
  warns that clustered SEs "can be over 3X larger than naive standard errors"
  ([2411.00640](https://arxiv.org/html/2411.00640)). SAGE's exact McNemar gate
  is the one source found that applies a paired discordant-item test to skill
  edits specifically.

### No study combines all four controls

- Searched for: one harness and model, multiple independent seeds or repeats, a
  held-out set, and per-item flip reporting for an edit to the same prompt,
  skill or context file.
- None found:
  - SAGE has per-item pairing on an optimizer trajectory, but no seeds and
    in-sample validation.
  - SkillsBench has repeats and pairing, but fixed skill sets and no flip
    counts.
  - SWE-Skills-Bench has a per-requirement paired test and a single run.
  - Gloaguen varies the context file with a single run and aggregates only.
  - GEPA, MIPROv2 and ACE report single-run aggregates.
- Secondhand mentions of matched replay gates (Designer RSI) and learned
  repair gates (RepairGate) were not read and cannot fill the gap.

## Verdict

Skill, prompt and instruction-file edits do not reliably preserve mastered
behavior. Aggregate gains routinely coexist with broken items. The strongest
direct evidence is SAGE: accepted edits that raised the validation average
broke 2.4–45.6% of already-solved items, and a paired exact gate removed most
of that churn without losing score. SkillsBench (13 of 87 negative tasks
under a +16.6 pp average), SWE-Skills-Bench (a −17 pp skill and a −22.8 pp
configuration hidden under a +0.3 pp average), and the model-update NFR
literature (3–12% flips under accuracy gains) point the same way.

The evidence is still weaker than the G3 gap demands. SAGE's rates are
in-sample and unseeded. The skill benchmarks compare presence against absence,
not revisions. Context-file and optimizer papers report single-run aggregates
whose per-cell differences sit inside the 2–6 pp run-to-run noise floor. No
study found combines same harness, repeats, a held-out set and per-item flip
reporting for an edit.

Two critiques in CONTRADICTIONS.md are confirmed outright. Cross-harness
charts are confounded by 6–17 pp harness effects. 2606.16523 measures its
governance workflow, not agent outcomes. Anyone who needs the claim "this edit
preserves mastered behavior" must produce that evidence themselves; the
literature does not supply it.

## Implications

### goals/coding-agent-effectiveness-evidence-loop

- The SPEC's eval corpus (12 held-out tasks, 3 paired repetitions) is too small
  to see item-level regressions. Bjarnason et al. put the cost of a 2-point
  aggregate effect at about 9 runs per agent. With 12 tasks, a one-sided exact
  binomial on discordant items with zero wins needs 5 broken tasks to reach
  p < 0.05 (0.5^5 ≈ 0.031; this arithmetic is ours). Size reps from the noise
  study, not by convention, and grow the corpus before using it as a
  regression gate.
- Add a mastered suite as a separate acceptance gate for any skill, prompt,
  hook or `AGENTS.md` treatment:
  - Admit only items the incumbent config passes reliably, for example pass^k
    = 1 over k ≥ 5 baseline runs, on the same harness and model fingerprint.
  - Evaluate the candidate on identical items.
  - Report NFR (mastered→failing) next to the net delta.
  - Accept only if a one-sided exact McNemar/binomial test on discordant items
    favors the candidate, with an asymmetric loss weight in SAGE's style.
- Define a flip on per-item pass rates across repeats, not on one trajectory.
  Single-run flips are mostly noise.
- Keep the gate's tuning items apart from its test items. SAGE's own stated
  weakness is reusing the validation set across steps. The packet's
  time-held-out corpus is the right shape for this.
- Score multi-constraint tasks jointly (all checks pass) as well as per
  check. Per-instruction averages hide the prompt-level collapse documented
  in 2509.21051.
- The bootstrap interval already required for wait reduction should come with
  a paired item-level regression count for outcome and quality families. A
  faster agent that newly fails mastered tasks is a Goodhart failure the
  current guardrails (silent-decision audit, mistrial rate) do not catch.

### goals/agent-rating-critique-fixes

- P1 edits always-loaded context: `AGENTS.md` pin dedup, skill frontmatter,
  runbooks. Its acceptance is byte count and grep checks, which say nothing
  about agent behavior. The literature gives no prior that such edits are
  neutral.
  - Gloaguen found context files mostly add cost without significant success
    change. Shrinking the prefix is therefore a defensible cost move.
  - SWE-Skills-Bench shows a skill can override task instructions (the
    `.github/workflows/` vs `ci/` failure).
  - Instruction-count interference means a removal can matter.
- State the P1 claim as cost and prefix size only, unless a paired mastered
  suite run backs a behavioral claim.
- The P4 re-rating applies the same rubric and counting commands. Like
  SkillWiki, that measures repository and infrastructure properties, not agent
  outcomes. Do not present a higher Agent-friendliness score as evidence that
  agents perform better.
- When editing `.agents/skills/`, favor compact skills with applicability
  boundaries and fallbacks. SkillsBench ties its negative tasks to single
  "correct" pipelines and finds that comprehensive or numerous skills add
  little. Do not admit agent-authored skill text without a paired check:
  self-generated skills fell 8–12 pp below baseline.

### goals/agent-pool-doctrine

- Never admit or rank a model from cross-harness benchmark charts. For one
  model, a harness swap moves scores by 6–17 pp, and the direction is not
  stable. The pool's fallback steps change harness and model together
  (Claude Code Opus, Codex Sol, Cursor Opus, grok-build). No public chart
  establishes that these routes are interchangeable on this repo's work.
- The Cursor admission proof (D9: pulse rows from a real headless run) is
  infrastructure evidence, the same kind SkillWiki reports. It shows the lane
  is instrumented and guarded, not that its outcomes match the step it
  replaces. Label it that way in the runbook.
- If outcome parity between routes ever matters, use the evidence loop's
  paired design: the same held-out mastered tasks on each route, repeats sized
  from the noise study, and NFR plus McNemar on discordant items, not an
  aggregate pass-rate comparison.
- Model or harness bumps under a fixed pin, for example a CLIProxyAPI or
  Claude Code update, are model-update events in MUSCLE's sense. A 3–12% flip
  rate under an aggregate gain is the realistic prior. `beep models check`
  verifies identifiers, not behavior.
