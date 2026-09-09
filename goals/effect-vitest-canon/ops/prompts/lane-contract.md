# Shared Effect Vitest lens contract

Read this contract together with the assigned lens charter, SPEC D1-D14, the
current census, the package's detector rows and the pinned primitives graph.
P0e authors these prompts; P1 execution waits for Benjamin's P0g ratification
and merge. P2 source edits wait for his P1 acknowledgement.

## Ownership and harness

The orchestrator assigns disjoint packages and explicitly names whether the
lane is auditing or remediating. You are not alone: preserve concurrent work
and never revert another lane's edits. Run through Codex CLI with
gpt-6-astra and explicit xhigh effort, per Benjamin's later AGENTS instructions. No git commands, agents,
publication, inbox waivers or phase/status changes inside a lane.

Create the assigned report in your first actions and append evidence as work
proceeds. The final response is only its path. The orchestrator owns package
verification and publication. A lane may not start a broad package check while
another writer owns that package. Source changes require the relevant
schema-first/Effect-first/JSDoc skills and live reuse search first.

In P1, write only assigned lens JSONL files, the package digest and the lane
report. In P2, write only the assigned package and its approved finding rows.
Preserve source assertions, production schema guarantees, coverage baselines,
property floors and global Vitest configuration. Never delete tests, add
flakyTest, change global timeouts/config/floors or merge without the packet's
required authorization. Request a concrete ownership extension in the report.

## Scope and coverage

Use the live test-files.json census, not the historical 955-file estimate.
D9 covers apps/packages/infra test/spec files and named test support modules.
Scratchpad, goals, explorations, docs, .claude and node_modules remain excluded.
Keep literal generated support declarations when the census includes them.
Treat fixture packages as files of their registered workspace owner.

Mechanical rules EV001-EV015 have already run. Audit their residue and identify
judgment beyond syntax; do not spend the lane reimplementing mechanical scans.
Record suspected detector false positives/negatives with exact evidence for
the orchestrator. Do not silently waive or delete detector rows.

Every assigned file gets at least one row for each assigned lens. An audited
file with no finding still gets class no-findings, ruleId L-<LENS>-NONE,
severity info, confidence 1, mechanization judgment and status open. The
replacement primitive is module.@effect/vitest with a sketch saying no change
is required and why. No fixSha is fabricated. Completeness and issue counts
must distinguish these coverage rows from actionable findings.

## Finding rows and digest

Use the existing EffectVitestFinding schema through the lint package's public
surface. Write one schema-validated JSONL row per file/line/lens/rule; never
create one Markdown file per test. Fields are:

- id; lens resource/flake/property/observability; stable L-<LENS>-NN ruleId.
- package and file from the census; one-based line and optional endLine,
  symbol and testName.
- class and evidence of at most 200 characters, sufficient to verify the claim.
- replacement with a real primitives-graph ID and a concrete sketch.
- severity blocker/major/minor/info, confidence in [0,1], mechanization judgment.
- status open/fixed/exception, reason for every exception, and fixSha only when
  an actual fix commit exists. The orchestrator supplies commit-backed closure.

A reason explains preserved behavior or a bounded exception, with evidence.
A flakyTest proposal needs the external cause, reason and follow-up; it is not
authorization to add that wrapper. Findings may reference another lens rather
than duplicating contradictory remediation.

Append the assigned package digest: totals/severity, ten highest-count files,
layer topology and rebuild points, MemoryFileSystem candidates, 30-day hosted
flake evidence with attribution limits, and proposed internal wave order.
Every file's coverage and every claim must be traceable to its rows.

## Evidence and delivery

All Effect APIs are pinned to @effect/vitest@4.0.0-rc.112,
commit 2600f62f4532026928454dcea8d1c48557b3f942. Use the graph's source anchors
and the supplied verified reference snapshot, never upstream HEAD.
Installed Vitest is 4.1.11; Bun is command-scoped 1.4.1. A successful
typecheck does not establish runtime behavior, especially synchronous prop.

P1/P2 package durations use the Node Vitest JSON reporter from package cwd,
with absolute output paths. Bun-native package tests are correctness proof,
not interchangeable baseline timing. Do not switch branches during a run.
P2 order is scope, assertions, property, flake, observability. Packages follow
topological waves near 150 changed files; modeling and tooling/tool ship alone.

Attribute every failure as introduced, inherited, unrelated or environment-only
before taking action. Keep exact commands, runtimes, exits, affected files and
proof limits. The orchestrator records friction immediately in
research/OPPORTUNITIES.md, with home paths shortened and secrets/session IDs
removed. A local or focused success never substitutes for package or hosted
acceptance, and no phase advances merely because a lane exits successfully.
