# RRSI (arXiv 2609.24972) — core concepts, for comparison

Setting: agent A = (frozen policy π, harness H). Harness = prompts, control flow, tool interfaces,
memory/skill files, context management, subagents. Harness evolution = loop: run H_t on a finite
evolve set → summarize feedback → LLM proposer emits candidate edits → evaluate on same evolve set →
keep the best. The paper calls this recursive self-improvement (RSI) at the agent-system level.

Problem: adaptive reuse of a finite evolve set overfits. Three failure modes:
 1. benchmark-specific fitting (edits that encode task/entity names, answers, suite-specific logic)
 2. noise chasing (stochastic winners promoted to permanent state)
 3. complexity accumulation (edits that raise score via more test-time compute, not better mechanism)
Result: evolve-set gains that shrink/vanish out-of-distribution; several prior methods end BELOW H_0 OOD.

RRSI = regularize the SEARCH TRAJECTORY, keep the edit space fully open.

Proposal-side regularizers (how search capacity is used):
 A. Annealed update sparsity (L0-style): cap number of independently attributable edits per candidate;
    cosine-anneal the cap from b_max to b_min over rounds. Early = broad coordinated edits, late = sparse,
    attributable single-mechanism edits.
 B. Evidence-aware credit assignment: record, per evaluated candidate, the component modified, the
    hypothesis tested, the source diff, score+cost deltas, accepted/rejected. Proposer conditions on the
    full history; rejected mechanisms stay as negative evidence; don't re-test falsified hypotheses
    (cites Dwork et al. 2015 adaptive data analysis).
 C. Structured exploration: detect stall (progress over last w rounds within noise band δ); during a
    stall reserve part of the proposal budget for components never exercised in the run (entropy /
    diversity regularization analogy).

Selection-side regularizers (which gains may become permanent state):
 D. Leakage screening: a critic reads each candidate DIFF before evaluation and rejects edits encoding
    task names, entity names, task-specific values, answers, or inert machinery.
 E. Noise-adjusted performance floor: pre-measure the noise band δ by re-running the unchanged base
    harness; a candidate must satisfy S(H') >= S* − δ (S* = best score seen). Prevents walking downhill
    through individually-small regressions.
 F. Complexity-aware acceptance (Ridge/L2-style): ΔC (relative policy-token cost) must satisfy
    ΔC <= β0 + β1·ΔS. Extra cost must be paid for by measured gain.
 G. Structural pruning (Lasso/L1-style): components with no strictly positive measured gain over a
    pruning window are reported to the proposer as deletion targets. "A mechanism must keep earning
    its place."

Evaluation discipline: evolve on one suite, run UNCHANGED on held-out ID split and OOD benchmarks
with different tasks/tools/verifiers; all numbers vs H_0 measured in the same window (no infra drift);
deterministic simulator-graded suites used to rule out judge-gaming; cross-policy transfer test.

Key claims: up to +14.1 evolve split, up to +4.7 OOD, 30% fewer policy tokens than unregularized;
ablations: removing acceptance regularizers raises evolve score, lowers OOD, +50% tokens.
