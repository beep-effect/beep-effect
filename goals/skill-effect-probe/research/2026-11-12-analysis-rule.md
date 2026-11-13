# Analysis rule, 2026-11-12

Fixed before the first scored run record. It is not edited after that commit;
a change is a new dated file in this directory that says what changed and why.
`bun run beep agent-effectiveness evals probe report` implements every number below,
and its tests pin the arithmetic.

## Units

- **Task.** One of the 12 archived tasks at archive commit
  `94b8d15cd23bd07a95f6f1ab0680d24b94c5103b`, minus any task the preflight
  drops (named in `history/preflight.json`).
- **Family.** The rule class in the task id (`fn-schema`, `getsomes-struct`,
  `normalization`, `null-return`): four families of three tasks.
- **Cell.** A (archived prompt, no plugin skill), B (archived prompt plus the
  Code Laws section of `AGENTS.md`, no plugin skill), C (as B, with the
  `schema-first-development` skill available through the plugin).
- **Run.** One `claude plugin eval` agent run, tied to its case, cell and run
  index by the `tracePath` of its entry in the harness JSON, whose directory
  is the kept run directory.

## Measures

- **Primary: all-lanes pass.** 1 when the law scorer reports status `scored`
  with completion, schema-first, tsgo and Biome all equal to 1 (no violation
  of any kind), else 0.
- **Lane fraction.** The scorer's `score` (completion and law weighted per
  the task manifest), in `[0, 1]`.
- **Fired.** 1 when the run's trace has a `Skill` tool call naming
  `schema-first-development` (the case's `skill-fired` grader).
- **Turns** and **wall seconds** as the harness reports them.

A task-cell mean is the mean of a measure over that cell's counted runs.

## Counting and exclusion

- Analysis as run: every counted run in a cell counts whether or not the
  skill fired. Fired-only means for cell C are reported as secondary.
- A run is **excluded** when its harness entry carries an error that names an
  API, rate-limit, overload, authentication or server failure, or when its
  trace's final result is an error naming one of those. It is rerun and never
  scored as 0. Values are rounded to six decimals before any threshold
  comparison.
- A run that hit `max_turns` or `timeout_seconds`, or left the fixture
  unchanged, is **counted** and scored from what it left.
- A run with no kept directory (the harness never started the agent) or
  whose kept directory holds no fixture copy is excluded and named.
- A scorer `environment-failure` is a scorer fault, not a run outcome: the
  run is rescored once; if it persists the run is excluded and named.
- Excluded runs are counted per cell in the run records and the findings.
- Target: 5 counted runs per task and cell (180 in all). Missing runs after
  reruns are reported; no imputation.

## Differences and intervals

For each task `t` and measure, the paired difference is
`d_t = mean_C(t) - mean_B(t)` (the production question) and, separately,
`mean_B(t) - mean_A(t)`. Pairing is at the task level; runs inside a cell are
independent.

- **Overall.** `d = mean over tasks of d_t`. Its standard error is the
  cluster-robust one with the family as cluster (Miller 2024, section on
  clustered questions):
  `SE = sqrt( G/(G-1) * sum_g ( sum_{t in g} (d_t - d) )^2 ) / T`, with `G`
  families and `T` tasks. The 95% interval is `d ± t_{0.975, G-1} * SE`
  (`t_{0.975,3} = 3.182` for four families). The unclustered interval
  (`sd(d_t)/sqrt(T)`, `t_{0.975, T-1}`) is reported beside it and is not used
  by the decision.
- **Family.** The mean of `d_t` over the family's tasks, with
  `sd/sqrt(n)` and `t_{0.975, n-1}`.
- **Task.** `d_t` with `SE = sqrt(var_C/n_C + var_B/n_B)` (sample variances
  over runs) and `± 1.96 * SE`. With five runs this interval is approximate;
  a cell whose runs all agree has zero variance and a zero-width interval.
- **Cell means.** Mean with `sd/sqrt(n)` and `± 1.96 * SE`.

## Decision

- **Effect** when the overall all-lanes difference C minus B is at least
  0.10 and the lower end of its clustered interval is above 0. The source
  exploration reopens at `decompose`.
- **Null** otherwise. The trainer question closes for lint-enforceable
  skills, the tombstones stay, and the findings carry a prune proposal.
- **Fired-rate gate** when fewer than 80% of counted cell C runs fired the
  skill. Reported as its own finding whichever way the main result falls; it
  fires the activation-probe gate in the exploration map.

Secondary measures (lane fraction, B minus A, turns, wall time, fired-only
C minus B) are reported with their intervals and carry no threshold.
