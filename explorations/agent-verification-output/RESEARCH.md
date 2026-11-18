# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

Dated 2026-11-18. This file is the synthesis. The evidence lives in four
reports under [`research/`](./research/):

| Report | Holds |
| --- | --- |
| [`transcript-audit.md`](./research/transcript-audit.md) | Seven-day census of what verification output costs agents. The baseline. |
| [`vitest-agent-core.md`](./research/vitest-agent-core.md) | Source study of the upstream project, cited `path:line`, written to plan a port. |
| [`in-repo-inventory.md`](./research/in-repo-inventory.md) | What each gate prints today, the bricks that exist, the effected precedent. |
| [`external-landscape.md`](./research/external-landscape.md) | Built-in agent modes, prior art, interchange schemas, harness limits. Every claim carries a URL. |

## The problem, measured

From [`transcript-audit.md`](./research/transcript-audit.md):

- Verification is one fifth of all agent turns (10,117 of 51k in seven days)
  and each turn re-reads 418k tokens of context on average.
- Agents pipe more than nine in ten verification runs through
  `tail`/`head`/`grep`. The filter is a guess: 9% of runs need a follow-up
  turn to dig through the captured log.
- Verification output is 18% of tool output and 6.3% of context read. Tests
  are 22% of that. Yeet, check, lint, quality and CI-log output, all printed
  by the repo's own CLI, are the rest.
- Tool output measures 2.28 chars per token.

One finding was confirmed by experiment in this lane. Vitest 5.1.0 ships a
failures-only reporter and selects it automatically when `std-env` detects an
agent. Turbo runs tasks in strict environment mode and its pass-through list
carries neither `CLAUDECODE` nor `AI_AGENT`, so the reporter never switches
on under `turbo run test`:

| How `@beep/glob`'s 273 green tests were run | Output |
| --- | ---: |
| `vitest run` directly, agent variable set | 282 chars |
| `vitest run` directly, agent variables unset | 10,853 chars |
| `turbo run test --filter=@beep/glob --only --force`, agent variable set in the shell | 13,450 chars |

## External Landscape

Detail and URLs: [`external-landscape.md`](./research/external-landscape.md).

- **Tools we already run have agent modes.** Vitest 5 (`minimal`/`agent`
  reporter, automatic), oxlint (`agent` format, automatic), Bun test (quiet
  on `CLAUDECODE`, `AGENT` or `REPL_ID`, so Codex shells miss it). Turbo has
  `--output-logs=errors-only`, `--json` and `--summarize` but changes nothing
  when it detects an agent. Biome has reporters and no detection. tsgo has no
  structured diagnostics.
- **The closest console specification is Nx `--outputStyle=summary`:** run
  counts, then one line per failing task naming the file that holds its full
  log. Its size does not grow with what tasks logged.
- **Harness limits shape the contract.** Claude Code keeps about 10,000
  characters of a failing command as a head-and-tail excerpt; Codex cuts the
  middle too. A verdict placed mid-stream is the part that gets dropped.
- **Agent detection has a convention.** `AI_AGENT` first, then the `std-env`
  table. A wrapper should also export what child tools look for.
- **No single interchange schema covers tests and diagnostics.** CTRF fits
  test results; SARIF fits lint and type diagnostics and is already emitted by
  Biome and oxlint. GitHub Checks annotations are a capped, lossy sink.
- **vitest-agent** is the strongest prior art for history: it stores every
  run and labels each failure new, persistent, flaky or recovered. It is MIT,
  very active, and has one maintainer.

Twelve design principles distilled from these sources close that report.

## Upstream: vitest-agent

Detail: [`vitest-agent-core.md`](./research/vitest-agent-core.md).

- **Same runtime targets.** Effect 4.1.4, Vitest 5, Node 24.11 or later.
- **Size.** About 43k lines of source and 57k of tests across eight packages.
  The pure `sdk` is 5.7k lines; the `engine` (SQLite, services) is 13.3k; the
  Vitest `plugin` is 8.9k, of which one file is 3,141 lines.
- **The output design is a total table.** Four run shapes (single test, file,
  project, workspace) by three outcomes (all pass, some fail, threshold
  violation), one cell per file. A failure prints its path, a history label,
  the first message line and the diff, never the stack. The renderer reads
  its own report type and no Vitest object.
- **Honest counts.** An empty run is never green. Timeouts, unhandled errors
  and files that fail to load always count as failures. Rendering never waits
  on persistence.
- **Classification is a small pure function** over a ten-run window per test.
- **What is Vitest-specific** is the plugin, the report builder and the
  failure-signature matcher table. The classifier, the reducer, the dispatch
  table, the GitHub summary and the retention logic take any keyed
  pass/fail series once eleven named types are widened.
- **Most of the database is not about test results.** 44 tables, the majority
  for TDD-session and agent-turn bookkeeping.
- **Its weak points:** history is not partitioned by branch or worktree, so a
  red on one lane relabels the same test everywhere; two flaky rules disagree
  and Vitest's own retry flag is unused; the Claude hooks cost about 50 ms of
  library load plus Node cold starts on every tool call; footer pointers
  hard-code MCP tool names; output appears only at the end of a run.
- **Against this repo's laws:** 170 source files import the root `effect`
  barrel, 268 `Effect.gen(function*` against 4 `Effect.fn`, 46 native
  `Map`/`Set` constructions.

## In-Repo Capability Inventory

Detail and `path:line` citations:
[`in-repo-inventory.md`](./research/in-repo-inventory.md).

**Bricks that exist and are not yet used for this:**

| Brick | Home | Note |
| --- | --- | --- |
| Audience-aware document renderer | `@beep/cli-kit` (`Doc`, `Render`) | Renders plain for agents and a GitHub log form for CI. `beep` does not use it. |
| Agent and CI detection | `@beep/runtime-env` | Copies the `std-env` table. `beep` does not use it. |
| Run verdict | `YeetVerdict`, written to `.beep/yeet/runs/<branch>/verdict.json` | Written on every run; the path is never the last line printed. |
| Diagnostic parser and issue index | `IssueParser.ts`, `QualityIssueIndex` | Parses TypeScript diagnostics already. |
| Durable lane report | `BEEP_YEET_INNER_LANE_REPORT_PATH` | The same report is also printed to stdout as a JSON line nobody reads. |
| CI-log failure isolator | `isolateYeetMonitorJobLogFailure` | Cuts the failing region out of a job log. No command exposes it. |
| Output bound | `OutputBound` in `@beep/repo-cli-kit` | 512 KiB, head-and-tail retention. |
| In-repo Vitest reporter | `CiCoverage.reporter.ts` | Proof the reporter seam is already used. |
| SQLite driver and an append-only store | `@beep/sqlite`, `@beep/agent-memory-store` | The store precedent on Bun. |
| Flake quarantine incidents | `FlakeQuarantine.ts` | An existing flaky notion to reconcile with history labels. |

**Gaps (NOT FOUND):** a closing verdict line on any gate; a `--format` or
quiet flag on the task path; a command that prints the failing region of a CI
job; a run-history store keyed by gate and subject.

**The effected precedent.** Fourteen of the nineteen `@effected/*` kits that
vitest-agent uses already exist as `@beep/*` packages. They sit about ten
minor versions behind what vitest-agent pins and were reshaped on promotion,
so upstream call sites do not compile against them unchanged. NOT FOUND:
`kit`, `store`, `plugin`, `app`, and `mcp-kit` as a port (`@beep/mcp-kit` is a
different, home-grown API). Attribution precedent: an MIT `LICENSE` with two
copyright lines and a README `Provenance` paragraph plus `Attribution` list;
no `NOTICE` files, no per-file headers. Two vitest-agent files are copied
from Vitest and carry its notice as well.

**Four located defects with small fixes:** the TS6305 cascade (a filesystem
probe that already exists, `assertCheckCensusTreeBuilt`, is not on the
package-local check path); global-flag help boilerplate (one formatter option
in `effect/cli`); JSON envelopes on stdout (no production reader); gate-table
polling (no delta mode).

## Constraints Discovered

- **Dependency policy (operator, 2026-11-18).** Third-party Effect packages
  are ported into `@beep/*` with license and attribution, not imported.
- **Package ceilings** (`standards/ARCHITECTURE.md`). A tooling library may
  depend on foundation and tooling libraries only; the capability gate wants
  no wrapped external engine and at least two real consumers; `@beep/memfs`
  is a test kit, which a tooling library may not import, and vitest-agent's
  engine uses memfs at runtime.
- **Harness excerpt window.** About 10,000 characters, head and tail. The
  verdict and the failure index must sit at both ends.
- **Turbo strict environment.** Any agent signal must be on the pass-through
  list, and a cached task replays the log recorded in whichever mode ran
  first.
- **The type checker emits text only.** The check gate runs `tsrs`; neither
  it nor tsgo has a structured diagnostic format. Type diagnostics must be
  parsed; a parser exists.
- **A Vitest reporter runs in the main process**, which is Bun under
  `bunx --bun vitest run` and Node under the coverage commands. An adapter
  must load on both.
- **Shared-history hazard.** With a dozen live lanes, history that ignores
  branch produces wrong labels. Any ported classifier needs a partition.
- **Public repository.** The census reads private transcripts; only
  aggregates may be written to tracked files.
