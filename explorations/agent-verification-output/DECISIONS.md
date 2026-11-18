# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-11-18 — port-not-import

**Question:** Does the repo take `@vitest-agent/*` as a dependency or port it?

**Answer:** Port. The code moves into canonical `@beep/*` packages with its
license and attribution. Nothing from `@vitest-agent/*` or `@effected/*` is
added to a manifest.

**Rationale:** Operator ruling in capture: third-party Effect-ecosystem
packages are imported only when the maintainer is trusted at the level of
Effect itself or alchemy. The agent had recommended taking the reporter as a
dependency and porting only the idea; that recommendation is withdrawn. The
attribution form is the one `goals/effected-promotion` set: an MIT `LICENSE`
carrying both copyright lines and a README `Provenance` paragraph with an
`Attribution` list. Files derived from the two Vitest files that upstream
vendors keep the Vitest notice too.

## 2026-11-18 — port-breadth

**Question:** How much of vitest-agent's 43k lines does the port carry?

**Answer:** The core, into a gate-neutral model. The model (gate > unit >
item) is designed first. The pure pieces are then ported into it: the
shape-by-outcome dispatch table and its cells, the history classifier, the
honest-count rules, the failure signature and the GitHub summary. Vitest is
one adapter beside typecheck, lint, build and CI jobs.

**Rationale:** Operator chose the recommended option. Rejected: a
whole-project lab copy in the effected manner, because effected was a kit of
libraries each wanted for itself, while most of vitest-agent's database and
all thirty of its MCP tools serve its own TDD-session product; and "core now,
TDD workflow later", which would have kept that product on the map. The TDD
workflow, the Ink live view, the Claude hooks, the sidecar binary and the MCP
server are no-gos for this packet. Design order follows the repo law: schema,
then service contract, then implementation.

## 2026-11-18 — history-baseline

**Question:** What does a history label (new, persistent, flaky, recovered)
compare against?

**Answer:** The lane's own earlier runs plus main's latest hosted results.
Every run is recorded with its branch. Output distinguishes a failure
introduced on the lane from one already red on main.

**Rationale:** Operator chose the recommended option. Upstream shares one
history across every worktree and branch, so with a dozen live lanes a red on
one relabels the same test on all of them. Rejected: lane history alone,
which cannot identify an inherited red; and shipping without history, which
drops the piece that computes the repo's attribute-before-repairing law.

## 2026-11-18 — agent-surface

**Question:** How does an agent reach detail beyond the verdict lines?

**Answer:** Files and `beep` commands. Every run writes one typed record to
disk. The console prints the verdict, the failures and the record's path
with its size. A `beep` subcommand queries records and history. No MCP tools
and no hooks are added.

**Rationale:** Operator chose the recommended option. It adds nothing to
always-loaded context and behaves the same under Claude, Codex, Cursor and
Grok. Rejected: an additional MCP server, and upstream's MCP-first footer
that names tools as the next step. Footer pointers become runnable commands.

## 2026-11-18 — scope-gates-only

**Question:** Does the packet cover verification gates or command output in
general?

**Answer:** Gates only: test, check, lint, build, docgen, quality, Yeet and
CI logs, under one verdict contract.

**Rationale:** Operator chose the recommended option. The census found shell
search-and-read output costs 16.5% of context read against 6.3% for
verification, so the wider problem is the larger one; it is a different
problem (the agent chooses those commands and their arguments) and gets its
own exploration. Rejected: keeping a general command wrapper on this
packet's map, and widening the packet now.

## 2026-11-18 — audience-three-projections

**Question:** Who is the designed console for?

**Answer:** Everyone. One record, three projections chosen by detection with
a flag to override: agent (plain, bounded, verdict at head and tail),
terminal (the same structure with colour and live progress) and CI (a GitHub
job summary plus a grouped log).

**Rationale:** Operator chose the recommended option. Humans and agents read
the same facts in the same order, so a human can check what an agent saw.
Rejected: leaving the terminal on raw tool output, and building the agent
projection alone.

## 2026-11-18 — core-enhancements

**Question:** Which enhancements beyond upstream belong in the design?

**Answer:** All four offered. (1) Fix-loop delta: a re-run on a lane reports
fixed, still failing and newly failing against the lane's previous run.
(2) Cause folding: diagnostics that share a root cause collapse to one line
with a count and the cause. (3) Heartbeat: a gate that outlives a threshold
emits one progress line at a fixed interval. (4) Block until changed: status
commands gain a mode that returns only when state changes and prints only
the changed rows.

**Rationale:** Operator selected every option. Each removes a measured cost
in the census: re-reading a failure list after every fix, the 701-line
TS6305 cascade, kill-and-rerun on gates that look hung, and gate-table rows
polled every four minutes. Two further properties were already part of the
design and were not optional: the verdict sits at the head and the tail
inside the harness excerpt window, and next steps are runnable commands.

## 2026-11-18 — first-slice

**Question:** Which gates prove the contract first?

**Answer:** Test and check together: Vitest through the ported report
builder and tsgo through the existing diagnostic parser, rendered by the
same code.

**Rationale:** Operator chose the recommended option. One test-shaped gate
and one diagnostic-shaped gate through one renderer is the proof that the
model is gate-neutral. Rejected: test alone, which proves only the port; and
Yeet lanes first, which aggregate gates that would not yet speak the
contract.

## 2026-11-18 — graduation-breadth

**Question:** How far does the exploration graduate now?

**Answer:** The whole map, sequenced. Goal packets are created for the full
design; each is sequenced behind its dependency and a packet holds at most
three open PRs.

**Rationale:** Operator chose the recommended option. Rejected: graduating
only the first two goals with the rest gated, and graduating the located
fixes alone.

## 2026-11-18 — record-is-the-source

**Question:** What does a console render from: the tool's stream or a
record?

**Answer:** The record. A gate writes one typed, versioned record; every
console is a projection of it; the raw stream goes to a log file whose path
and size the console prints. Under Turbo the record is a declared task
output, so a cache hit restores the record and the console is rendered from
it, never from a replayed log.

**Rationale:** Agent decision, following the settled agent surface. Turbo
replays the log recorded by whichever audience ran first; the experiment in
`RESEARCH.md` shows a 48-fold difference between the two. Rendering from the
record makes the console independent of cache state. Reversal: render from
streams again and drop the task output declaration.

## 2026-11-18 — tdd-workflow-no-go

**Question:** Is upstream's TDD-session workflow (goals, behaviors,
hypotheses, notes, the `tdd-task` agent) carried?

**Answer:** No. It is a no-go for this packet.

**Rationale:** Follows from `port-breadth`: the operator chose the core
option over "core now, TDD workflow later". It is a separate product. An
operator who wants it later opens a new exploration.

## 2026-11-18 — census-is-the-acceptance-instrument

**Question:** How is the effect of each goal measured?

**Answer:** The transcript census becomes a repeatable `beep` command that
writes aggregates only. Its 2026-11-18 numbers are the baseline, and each
goal's acceptance names the census rows it moves.

**Rationale:** Agent decision. The baseline was produced by session-local
scripts that no longer exist outside this session; a claim of improvement
needs the same instrument. Transcripts are private and the repository is
public, so the command emits counts and shares, never transcript text.
Reversal: delete the command and judge goals by output-size fixtures alone.

## 2026-11-18 — interchange-projections — DEFERRED

**Question:** Does the model ship SARIF and CTRF projections?

**Answer:** DEFERRED. The model is shaped so both projections are lossless
(a closed status set, stable rule and diagnostic codes, file regions,
fingerprints), and neither projection is built until a consumer needs one.

**Rationale:** Agent decision. No repo consumer reads SARIF or CTRF today;
GitHub code scanning upload would be the first. The constraint on the model
costs nothing now and keeps the door open.

## 2026-11-18 — search-read-output — DEFERRED

**Question:** Who owns the larger cost the census found, shell search and
read output at 16.5% of context read?

**Answer:** DEFERRED to its own exploration. It is recorded in
`explorations/INBOX.md` by this packet.

**Rationale:** Follows from `scope-gates-only`.

## 2026-11-18 — brief-accepted

**Question:** Does the brief match the operator's picture?

**Answer:** Yes, as drafted: one gate report per run, three projections, the
ten console laws and six sequenced goals. Decompose it.

**Rationale:** Operator chose "Matches, decompose it" at the shape review.
No revision was requested.

## 2026-11-18 — vocabulary-gate-report

**Question:** What is the per-run record called?

**Answer:** A gate report. "Verdict" means only its one-line outcome.
`YeetVerdict` keeps its name and becomes a consumer that aggregates gate
reports. Packages follow: a gate-report model and a gate-run library.

**Rationale:** Operator chose the recommended option. Rejected: calling the
record itself the verdict and re-expressing `YeetVerdict` on it, which would
give one word two meanings during the migration; and "proof", which already
names detached proof jobs and final-check receipts.

## 2026-11-18 — graduation-corrections

**Question:** Which statements in the brief and the map did the goal authors
find wrong against the checkout?

**Answer:** Seven, all corrected in `BRIEF.md`, `MAP.md` and `RESEARCH.md`
and carried into the goal packets:

1. The check gate runs `tsrs`, not tsgo. The `first-slice` entry above keeps
   its original wording; read "tsgo" there as the type checker.
2. The located fixes number six, not five.
3. A Vitest reporter runs in Vitest's main process (Bun or Node depending on
   the command), so the adapter must load on both. The earlier "workers are
   Node processes" framing was beside the point.
4. `ci-gate-reports` chooses the carrier for hosted reports; the history
   goal consumes it. Workflow artifacts are a candidate, not a given, and the
   Turbo remote cache does not store failed tasks.
5. The transcript library is `@beep/repo-ai-metrics`, and it drops tool
   payloads by design, so reading tool calls is new work.
6. Only the lane-run envelope has a durable copy today; the check-run
   envelope needs one before its stdout line goes. Package `check` scripts
   call `beep:check` directly, so the unbuilt-dependency probe must reach the
   generated script.
7. No `yeet gh` subcommand fetches logs. The reusable pieces are the
   failed-job log read in `MonitorLoop.ts` and the REST recipe in the yeet
   skill.

Goal manifests express dependencies as capability slugs
(`gate-report/model`, `gate-report/console`, `gate-report/recorder`,
`ci/gate-report-feed`) plus `blockedBy`, because the manifest schema does not
accept a goal slug in `requires`.

**Rationale:** Agent decision. The packets are the contract an implementer
reads; a known error left in the map would be copied forward.
