# RRSI (arXiv 2609.24972, 2026-09-23/25) vs beep-effect authored prose

Scope searched: AGENTS.md, standards/, docs/, explorations/, goals/, research/ (README, ledger,
sampled packets), .patterns/, .claude/skills, .claude/agents. Dates = `git log --diff-filter=A`
first-add date of the file (or `git log -S` for a specific phrase where noted). Paths are repo-relative
to `$HOME/YeeBois/projects/beep-effect19`.

Headline: the repo already ran a literal harness-evolution loop on one of its own skills
(`goals/skillopt-training-pilot`, 2026-07-06): edit budget 1, held-out validation gate, rejected-edit
log, and the finding that appended guidance made validation worse. Two later packets
(`goals/coding-agent-effectiveness-evidence-loop`, 2026-07-31; `explorations/context-rent-telemetry`,
2026-07-31/08-01) describe held-out, paired-trial, Goodhart-guarded changes to the harness and
"prune what doesn't earn its rent". All of this predates the paper by 2 to 11 weeks. What's missing:
annealing, stall-triggered exploration, and an automated leakage critic.

---

## A. Annealed update sparsity (edit budget per candidate)

| Repo file | First written | Quote | Closeness |
|---|---|---|---|
| goals/skillopt-training-pilot/history/p5-training/FINDINGS.md:10 | 2026-07-06 | "batch 2, minibatch 2, edit budget 1, patch mode" | **Adjacent/same knob, no anneal.** A fixed L0 budget of one edit per step. Line 45 then suggests the opposite direction ("Lift, if available, likely requires: bigger edit budgets + more analyst rounds"), so no annealing schedule. |
| goals/coding-agent-effectiveness-evidence-loop/PLAN.md:382 | 2026-07-31 | "One variable at a time: AGENTS/CLAUDE context weight; skill trigger precision ..." | **Adjacent.** The P7 portfolio allows one attributable harness change per treatment. This is the paper's late-phase b_min regime applied from the start. |
| goals/skillopt-training-pilot/SPEC.md:44 | 2026-07-06 | "First vertical slice FIRST: one task end-to-end at n=1 before any generalization." | Superficial. The scope is kept sparse, but the edits themselves are not. |
| AGENTS.md "Keep changes focused and testable" (Code Laws) | pre-2026-07 | "Apply schema defaults when safe. Keep changes focused and testable." | Superficial. It's a general small-diff norm, not a search budget. |

## B. Evidence-aware credit assignment (per-candidate ledger, negative evidence kept)

| Repo file | First written | Quote | Closeness |
|---|---|---|---|
| goals/skillopt-training-pilot/SPEC.md:15-16 | 2026-07-06 | "held-out validation split whose artifacts (best_skill.md, per-epoch scores, rejected-edit log, run report) land in this packet's `history/`" | **Same idea, partial.** Scores and rejected edits are kept for every candidate. Nothing says the proposer is conditioned on the log. |
| goals/nightly-research-routine/SPEC.md:106-112 (§6 Novelty) | 2026-08-10 (demurrage phrase: 2026-09-03) | "append-only, single-writer disposition ledger ... admitted, rejected, deferred, superseded, or duplicated ... a tombstoned idea returns only with evidence that post-dates its death." | **Same idea (research domain).** This is the paper's rule against re-testing falsified hypotheses, with a revival condition added. It applies to research suggestions, not harness diffs. |
| goals/coding-agent-effectiveness-evidence-loop/SPEC.md:79-80 | 2026-07-31 | "every improvement item ends shipped / deferred with trigger / rejected with reason / explicitly waived, with evidence." | **Same idea.** Each harness-improvement candidate gets an accept/reject disposition, and rejections are kept as evidence. |
| goals/coding-agent-effectiveness-evidence-loop/SPEC.md:97-99 | 2026-07-31 | "Refuse-don't-guess attribution. An event that fails identity-registry lookup lands in a quarantine ledger" | **Adjacent.** Attribution hygiene for credit: nothing gets credit by default. |
| AGENTS.md:132 | 2026-07-14 (`git log -S`) | "Attribute verification failures before repairing — introduced / inherited / unrelated / environment-only" | **Adjacent.** A four-way credit-assignment taxonomy for failures, used as a standing law. The pulse (below) says it was added because agents asked for it in their reflections. |
| AGENTS.md:232 + research/README.md (`RUN.json.frictions[]`) | 2026-08-06 | "Friction is a first-class output: ... record a receipt — what you were doing, the evidence ..., what would have prevented it" | **Adjacent.** A failure-evidence ledger that feeds the next harness edit. It records friction, not candidate score deltas. |
| goals/agent-reflection-loop/SPEC.md (Decisions 1-6) | 2026-06-09 | "persisting structured artifacts that compound into durable, reusable knowledge" | **Adjacent.** The feedback-summarization stage of the loop, with a schema-validated reflection per packet. |

## C. Structured exploration on stall

| Repo file | First written | Quote | Closeness |
|---|---|---|---|
| goals/nightly-research-routine/SPEC.md:110-111 | 2026-08-10 (`-S`) | "A self-reject gate re-searches when more than 40% of findings collide." | **Adjacent.** A novelty-collapse detector (a stall proxy) forces a re-search. It triggers on redundancy, not on a flat score. |
| .claude/skills/adhd/SKILL.md (header + :186) | 2026-08-04 | "Spawns N isolated branches under different cognitive frames ... Absurd ideas earn their place by seeding viable ones." | **Adjacent (third-party MIT skill).** Diversity is forced on purpose, but the user invokes it. Nothing detects a stall. |
| goals/skillopt-training-pilot/history/p5-training/FINDINGS.md:45-47 | 2026-07-06 | "Lift ... likely requires: bigger edit budgets + more analyst rounds, skill-aware reflection / rewrite modes ..., per-rule-class targeting" | Adjacent. After the zero-lift plateau, a person listed the unexplored levers. This is the paper's C done by hand. |

Verdict: **no automatic stall detector that reserves budget for never-exercised components.**

## D. Leakage screening of diffs (critic before eval)

| Repo file | First written | Quote | Closeness |
|---|---|---|---|
| explorations/skillopt-training-pilot/BRIEF.md:58-60 / goals/skillopt-training-pilot/SPEC.md:47 | 2026-07-06 | "Scorer gaming: a skill could learn to write trivial code that passes lints; reference criteria must include task completion checks" | **Adjacent.** The target is the same failure mode (specification gaming), but the fix is on the scorer side, not a critic reading the diff. |
| goals/coding-agent-effectiveness-evidence-loop/PLAN.md:362-364 | 2026-07-31 | "a memory-ablated eval profile controls Cognee + shared auto-memory as an explicit variable (cross-clone memory makes \"held-out\" leaky by default)." | **Same concern, different channel.** It names memory leaking into held-out tasks, a vector the paper does not treat. |
| research/README.md:34 (Laws: Blinding) | 2026-08-10 | "research runs are blinded to `research/**` except the digest handed to them" | Adjacent. Input-side contamination control. |
| goals/skillopt-training-pilot/SPEC.md:27,82 | 2026-07-06 | "Weakening any gate to make rollouts pass." (non-goal / stop condition) | Adjacent. A hard stop on the easiest route to gaming. |
| .claude/skills/quality-review-fix-loop/SKILL.md:83,107-113 | 2026-05-05 | "Reviewer/critic agents are read-only ... classify findings ... return `0 required findings` when clean." | **Superficial for D.** It has the same shape as the paper's critic (a read-only panel over the diff), but it screens code quality, not benchmark leakage. |

Verdict: **no critic that rejects diffs encoding task names, answers, or inert machinery.**

## E. Noise-adjusted acceptance floor

| Repo file | First written | Quote | Closeness |
|---|---|---|---|
| goals/per-module-imports/history/p2-pilot-verdict.md:31-33 | 2026-09-03 | "`Noise floor` is twice the larger state's relative MAD. Timing, RSS, Types, and Instantiations must exceed both their normative threshold and this floor to be stable." | **Same mechanism, perf domain.** δ comes from repeated runs, and a change must clear both the threshold and the noise band. |
| goals/ci-fleet-residue/history/reflections/2026-08-24-claude.md:193-196 | 2026-08-24 | "measure a control noise floor before changing capacity posture — the 528-run on-demand baseline made ... classifier meaningful" | **Same idea (infra).** Measure the unchanged-baseline noise before judging the change. This is the paper's δ procedure. |
| goals/coding-agent-effectiveness-evidence-loop/SPEC.md:173-174 | 2026-07-31 | "wait reduced across paired trials with a 95% bootstrap interval excluding zero" | **Same idea, stricter.** Harness treatments need a statistically significant gain, not just S >= S* − δ. |
| explorations/oppold-corpus-overhaul/DECISIONS.md:45-50 | 2026-08-17 | "each stage evaluated against a fixed metadata-safe regression set in shadow mode; stop when no candidate clears its predeclared quality-gain and cost/regression thresholds" | **Same idea (pipeline self-improvement).** A candidate must clear pre-declared gain and regression thresholds. |
| standards/architecture/DECISIONS.md:1171-1175 | 2026-07-30 | "the lane promotes from advisory to blocking after three consecutive clean runs ... Baselines only shrink" | Adjacent. Ratchet semantics: the best-seen value becomes the floor, like S*. The three-clean-runs rule guards against noise. |

## F. Cost-justified (complexity-aware) acceptance

| Repo file | First written | Quote | Closeness |
|---|---|---|---|
| goals/coding-agent-effectiveness-evidence-loop/PLAN.md:398-399 | 2026-07-31 | "edit survival and rework do not regress; expected cost per successful solve does not increase" | **Same idea, harness domain.** Cost is a co-equal acceptance guard, but it is a hard constraint (ΔC <= 0), not the paper's ΔC <= β0 + β1·ΔS trade-off. |
| explorations/oppold-corpus-overhaul/DECISIONS.md:47-48 | 2026-08-17 | "predeclared quality-gain and cost/regression thresholds" | **Same idea.** Cost sits next to gain in the acceptance rule. |
| goals/skillopt-training-pilot/SPEC.md:25,82 | 2026-07-06 | "Any always-loaded-context growth" (non-goal); "grow always-loaded context" (stop condition) | **Adjacent, stricter.** Any growth in context cost is forbidden outright rather than priced against gain. |
| goals/skillopt-training-pilot/history/p5-training/FINDINGS.md:39-41 | 2026-07-06 | "edits (uniformly append-style guidance, +450–900 chars) consistently *degraded* validation scores. The gate is the reason the skill did not get worse" | **Same empirical finding** as the paper's "complexity accumulation" failure mode: additive guidance raised cost and lowered held-out score. |
| explorations/packet-system-redesign/DECISIONS.md:234-236 | 2026-08-11 | "if approval-wait and parked-lane age dominate, stop adding gates and fix envelopes/memoization first." | Adjacent. Process machinery has to pay for its cost. |
| standards/architecture/DECISIONS.md:1156+ (Complexity Ceilings Become Law) | 2026-07-30 | "Function complexity is governed by two mechanisms ... gate for the margin, ratchet for the mass" | Superficial for F. It limits code complexity, not harness test-time compute. |

## G. Structural pruning ("must keep earning its place")

| Repo file | First written | Quote | Closeness |
|---|---|---|---|
| explorations/context-rent-telemetry/CAPTURE.md:14-31 + README.md Spark | 2026-07-31 (file 2026-08-01) | "every line charges rent in every session of every agent ... A line with high cost and no measurable lift is a prune candidate; a cheap line that prevents a recurring failure class is load-bearing." | **Same idea.** L1 pruning of harness components by cost against measured lift. It was parked on 2026-08-13 and never built. |
| goals/knowledge-surface-automation/SPEC.md:185, 293-299 | 2026-08-01 | "context-bloat pruning proposals are presented as a diff with token-weight estimates" | **Same idea, proposal-only.** Deletion targets go to a human, matching the paper's "reported to proposer as deletion targets". |
| explorations/agent-effectiveness-pulse/DECISIONS.md:105-118 | 2026-07-14 | "Mechanical cleanup now (delete the 4 dead ponytail helper skills; evict volatile state from AGENTS.md's cache prefix ...). Law DELETIONS ... wait for H1 evidence or the replay suite." | **Same idea.** Harness components with zero usage are pruned, and other deletions are gated on evidence. Carried out by goals/harness-hygiene-mechanical (2026-07-14). |
| goals/nightly-research-routine/SPEC.md:111 | 2026-09-03 (`-S`) | "Demurrage may tombstone suggestions unactioned for N runs" | Adjacent. Items that aren't earning are pruned over a time window, the paper's pruning window. |
| goals/fallow-zero-dead-code, standards/fallow.dead-code.regression-baseline.jsonc | 2026-07 | (dead-code ratchet) | Superficial. It prunes code, not harness mechanisms. |

## H. Evolve / held-out / OOD evaluation discipline

| Repo file | First written | Quote | Closeness |
|---|---|---|---|
| goals/skillopt-training-pilot/history/p5-training/FINDINGS.md:9-10 | 2026-07-06 | "12-task corpus (4 SFV4 rule classes), 8 train / 4 validation" | **Same idea (ID split only).** Evolve and held-out splits are separate, and candidates are gated on the held-out one. No OOD suite. |
| goals/coding-agent-effectiveness-evidence-loop/PLAN.md:355-360 | 2026-07-31 | "12-task time-held-out corpus ... repository revision, model, effort, tools, permissions, cache lane, budget, timeout, and grader held constant. Retro-mined history is candidate-generation only, never primary evidence." | **Same idea, arguably stronger.** A time-held-out split with everything held constant, the paper's "same window, no infra drift". Mined history can generate candidates but cannot serve as evidence. |
| explorations/packet-system-redesign/research/2026-08-10-notion-strict-planning-three-pass.md:330 | 2026-08-11 | "Goodhart / specification-gaming research: agents find technically-compliant workarounds; what actually works is code enforcement plus hidden/holdout evaluation." | **Same idea, stated as a principle.** |
| explorations/packet-system-redesign/DECISIONS.md:233-234 | 2026-08-11 | "All metrics are observational, never optimization targets (Goodhart / pass 2 B8)." | Adjacent. This is stronger than the paper: metrics are never optimization targets at all. |
| goals/coding-agent-effectiveness-evidence-loop/research/2026-07-31-adhd-amendments.md:79-81 | 2026-07-31 | "Goodhart counter-metric: silent-decision audit; a canary that wins by skipping human gates reads as a regression." | **Adjacent / beyond the paper.** A counter-metric for gaming by skipping steps. |
| goals/coding-agent-effectiveness-evidence-loop/SPEC.md:170-171 | 2026-07-31 | "deterministic graders first" | Same as the paper's use of deterministic, simulator-graded suites to rule out judge-gaming. |

## I. "Harness" framing (prompts + control flow + tools + memory/skills + context)

| Repo file | First written | Quote | Closeness |
|---|---|---|---|
| explorations/agent-effectiveness-pulse/BRIEF.md:18-19 | 2026-07-14 | "the harness carries confirmed dead weight (4 dead skills, volatile state in the permanent cache prefix, 3 missing laws agents keep requesting)" | **Same framing.** Skills, the AGENTS.md cache prefix, and laws are all treated as parts of the harness. |
| goals/harness-hygiene-mechanical/SPEC.md:11-13 | 2026-07-14 | "The agent-facing instruction surface sheds confirmed dead weight and gains the three laws agents repeatedly requested" | **Same.** The packet is named after the harness. |
| goals/coding-agent-effectiveness-evidence-loop/PLAN.md:382-388 | 2026-07-31 | "AGENTS/CLAUDE context weight; skill trigger precision ...; MCP/tool exposure ...; hook batching ...; subagent decomposition ...; prompt/model/effort/cache configuration" | **Same decomposition** as the paper's H: prompts, tools, memory/skills, context, control flow, and subagents as separate treatment axes. |
| AGENTS.md "Context Economy" | pre-2026-08 | "Always-loaded files ... are the prompt cache prefix: batch edits to them, keep them lean" | Adjacent. Context management treated as a harness cost. |

## J. The overall RSI loop (self-improving harness)

| Repo file | First written | Quote | Closeness |
|---|---|---|---|
| goals/skillopt-training-pilot/README.md:13-19 + SPEC.md:5-17 | 2026-07-06 | "Compose the repo's existing eval bricks into a SkillOpt training loop and run it end-to-end on `.claude/skills/schema-first-development`" | **Same loop, executed.** Run, reflect, propose a patch, evaluate on validation, keep the best, applied to a harness component. Result: 0 accepted of 6, verdict PARK. |
| goals/agent-effectiveness-loop/SPEC.md:16-27 | 2026-05-20 | "Design a repo-specific feedback loop for improving coding-agent effectiveness ... which repo guidance, config, prompt, or workflow changes improve outcomes?" | **Same aim, earliest.** It's the first written statement of the harness-improvement loop. |
| goals/coding-agent-effectiveness-evidence-loop/PLAN.md:405-406 | 2026-07-31 | "Never automate AGENTS/skill changes, permissions, MCP enablement, architecture decisions, or human gates from anomalous traces." | **Deliberate divergence.** The loop is kept human-in-the-loop, not recursive. |
| explorations/oppold-corpus-overhaul/DECISIONS.md:45-50 | 2026-08-17 | "Per-step self-improvement = one immutable pipeline version per run ... accepted changes apply only to the next run. No same-run mutation of rules, prompts, schemas, engines, or ontology version." | **Same loop, pipeline domain.** It has explicit version immutability within a run. |
| explorations/graphnosis-prior-art/research/mining/paper-trained-skills.md:699-705 | 2026-08-08 | "The self-improvement triad: retrospective-learning → adaptive-skill-creation → train_skill → skill-dispatch retrain" | Prior-art mining of an external self-referential skill loop. The repo records its counterexample: gains vanish when skills are "instructed but not walked". |
| explorations/semantica-lab/research/adhd-reasoning.md:140 | (semantica-lab) | "a standing invitation for the evals spine to become a self-improving loop." | Superficial mention. |

---

## Ideas the repo has that the paper does NOT

1. **Memory as a held-out leakage channel.** Shared cross-clone auto-memory and Cognee make held-out tasks "leaky by default", so an ablated eval profile is required (evidence-loop PLAN:362-364). The paper evolves memory files but doesn't treat memory as contamination of the test split.
2. **Goodhart counter-metrics for step-skipping.** The silent-decision audit and the non-increasing mistrial rate mean a candidate that wins by skipping human gates counts as a regression (adhd-amendments:79-81, PLAN:402-404).
3. **Evidence-tier propagation and refuse-don't-guess attribution.** Derived metrics inherit the weakest input tier, and unattributable events go to a quarantine ledger (evidence-loop SPEC:97-104).
4. **Tombstone with a revival condition.** A falsified or unactioned idea can return only with evidence that post-dates its death (nightly-research SPEC:111-112). The paper keeps negative evidence but has no rule for when it may be revisited.
5. **Treatment assignment verified from observed config fingerprints**, not from intent (PLAN:361).
6. **Explicit refusal to automate harness self-modification** (PLAN:405-406), with "machine proposes, human admits" as law (research/README Laws).
7. **Immutable version per run.** No same-run mutation of prompts, rules, or schemas; accepted changes take effect next run (oppold DECISIONS:45-50).
8. **Failure attribution taxonomy.** introduced / inherited / unrelated / environment-only, as a standing law (AGENTS.md:132).
9. **Ratchet/baseline promotion.** Advisory to blocking after three consecutive clean runs; baselines only shrink (DECISIONS 2026-07-30).
10. **A negative result at scale.** Edit budget 1 plus generic appended guidance gave zero lift, and the gate rejected all 6 candidates (skillopt FINDINGS). This is direct evidence for the paper's claim that additive guidance hurts held-out performance.

## Ideas the paper has that the repo does NOT

1. **Annealing** the edit budget (cosine schedule from b_max to b_min). The repo uses a fixed budget of 1, or one variable per treatment.
2. **Stall detection that reserves proposal budget for never-exercised components.** The nearest analogue is the >40% novelty-collision re-search in research, not harness evolution.
3. **An LLM leakage critic that reads each candidate diff before evaluation** for task names, entities, answers, or inert machinery. The repo relies on scorer design, blinding, and read-only quality reviewers.
4. **A priced cost/gain trade-off** (ΔC <= β0 + β1·ΔS). The repo uses hard constraints instead: no always-loaded context growth, and cost per solve must not increase.
5. **Automated pruning inside the loop** (no strictly positive gain over a window, so the component is flagged for deletion). The repo's context-rent pruning was parked before implementation, and knowledge-surface pruning is proposal-only.
6. **An OOD benchmark suite and a cross-policy transfer test.** The repo has ID held-out and time-held-out splits only, with no separate suite that uses different tasks, tools, and verifiers, and no test across models.
7. **A proposer conditioned on the full candidate history** as an explicit design element. The repo logs rejected edits, but nothing says the log feeds the next proposal.
