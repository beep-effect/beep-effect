<!-- Lane brief as issued 2026-10-06 for goal phase P2; the survey notes it names live in the lane scratch, not in the repo. -->
# W6 body brief (phase B): the planEpisode body, lane-plan emission, golden and CQ-020 sibling

Read `brief-p2-common.md`, GD P2 Rulings 1–7, `01-s7-seam.md` §4–§6, `02-handoff.md`, `04-effect-graph.md`
(the verified Graph API and sketch), `05-cq-and-gates.md` §1–§3 and D1/D3/D10, `06-critic.md` D3–D11, and the
phase-A result (the amended CT §8 and the schemas now in `Schemas.ts`). Files you own: a new
`LAB/src/projection/LanePlan.ts` (pure core), `LAB/src/projection/CiOpsProjection.ts` (the body and the
`emitLanePlan` member), `LAB/src/projection/Turtle.ts` (lane-plan emission), `LAB/test/lane-plan.test.ts`,
`LAB/test/fixtures/lane-plan-v1.ttl` (golden), new `LAB/scripts/check-lane-plan-cq.py`, new
`LAB/scripts/generate-lane-plan-golden.ts` plus its two generated package scripts
(`evidence:lane-plan` check-by-default, `evidence:lane-plan:write`), and `Schemas.ts` ONLY for surgical
edits inside the planner section (the W5 lane edits the admission-journal section of the same file at the
same time: re-read before every edit, anchor edits on unique planner-section lines, never rewrite the file).
Remove `PlannerNotImplementedError` and `plannerNotImplemented` from the shape, the schemas and the tests in
this phase (Ruling 5).

## Deliverables

1. **`LanePlan.ts` pure core:** `decodeHandoffView(text) → Effect<GateOrderHandoffView, HandoffDecodeError>`
   (subset decode; duplicate `laneId` and a rank set that is not exactly `0..n-1` are decode failures);
   `planLanes(lanes, precedences) → Effect<ReadonlyArray<LaneStep>, CyclicPlanError>` (Ruling 4: nodes keyed by
   `laneId` inserted in ascending `declarationIndex`, `Graph.directed` with a `MutableHashMap<laneId, NodeIndex>`
   capturing the indices `addNode` returns, edges from the explicit precedence list, `Graph.findCycle` before
   `Graph.topo`, cycle path mapped back to lane ids as `cycleNodes`, `Graph.topo` order → 0-based lane steps);
   `rankChain(lanes) → precedences` (rank r → r+1); a check that the topological order equals the rank order
   (fail `HandoffDecodeError` otherwise — it cannot happen for a chain, and the test proves the agreement is
   real by inserting in declaration order). Every helper small (fallow).
2. **`planEpisode` body (Ruling 5):** read the bytes at `repoRoot/path` through the captured `FileSystem`
   (`HandoffReadError` on failure; refuse `..` segments and absolute paths), digest the raw bytes with
   `Sha256HexFromBytes` through the captured `Crypto`, compare with `input.handoff.sha256`
   (`HandoffDigestMismatchError` before any decode), decode the subset, plan, build `LanePlanProposal`
   (`planId` derived from the sha256). The repo root: a layer input or a `PlanEpisodeInput` member? Choose the
   one the phase-A schema already carries; if neither, add `repoRoot` to `GateOrderHandoffRef`'s sibling input
   as the smallest change and say so. `planEpisode` never touches the `TxRef` shell.
3. **Emission (Ruling 3):** `emitLanePlan(plan: LanePlanProposal) → Effect<TurtleDocument>` in `Turtle.ts`,
   reusing `pnLocalSlug`, `turtleLiteral`, the prefix block and the two-section layout; the ratified section
   carries only the episode node typed `ciops-prov:VerificationEpisode`? — no: the episode node and its type are
   already provisional in the admission emission; follow the same placement, but every lane-plan term is the
   provisional vocabulary §8 names; never `hasCurrentProposal`, `hasProjectionSpecification`, `hasStep`,
   `hasScopeTag`, `stepIndex`, `ScheduleStep`, `ciops:ScheduleProposal` typing, `VerificationLane`,
   `schedulesWorkUnit`, `hasScope`, `Scope`. Emit the consecutive-step precedence edges. Byte-deterministic
   (sorted sections). Add the member to the service shape.
4. **Golden and tests:** `test/fixtures/lane-plan-v1.ttl` generated once by `generate-lane-plan-golden.ts --write`
   (from the fixture handoff, a fixed episode id) and checked by `--check` and by a test; tests: byte-determinism
   (`it.effect.prop` over a permutation of the lane array with the same ranks → byte-equal Turtle), totality
   (every fixture lane appears exactly once, in rank order, count from the decoded document), the cyclic
   must-fail (hand-built precedence set with a cycle → `CyclicPlanError` as a typed `Fail`, assert the
   `cycleNodes` witness), the digest-mismatch and read failures typed, the live-path drift sensor (already in
   phase A), the admission golden `emission-v2.ttl` still byte-equal (regression), no forbidden term in the
   lane golden (string assertion over the Turtle), and the `CiOpsProjectionLive` end-to-end plan through the
   service with `BunFileSystem.layer` + `BunCrypto.layer`.
5. **CQ-020 sibling (Ruling 7):** `scripts/check-lane-plan-cq.py` (stdlib + pyoxigraph, exactly as `check-emission-cq.py`, run with
   `UV_CACHE_DIR=$HOME/.cache/beep/uv-cache ~/.local/bin/uv run --with pyoxigraph python`; the baseline script prints PASS today) loads `emission-v2.ttl` and
   `lane-plan-v1.ttl` into one graph, extracts the amended CQ-020 SPARQL from
   `explorations/beep-ci-operational-ontology/ontology/docs/competency-questions.yaml` the way
   `check-emission-cq.py` does, requires its admission rows unchanged (2), and runs the provisional lane queries:
   lane-step count equals the fixture lane count, precedence edges = count − 1 in rank order, no ratified
   ordering term on any lane node, and no `schedulesWorkUnit`/`hasScope`/`Scope` anywhere. Prints one PASS line
   with the counts; exit 1 otherwise. Run it and report the output.

## Return

Structured: files changed, the service shape after the change, the provisional terms emitted, test counts
per file, every gate command with its last lines (check, test, lint, test-tsgo, lint laws, effect-vitest
rows/splice, package-scripts --write diff), the golden's sha256, the CQ sibling's output line, and follow-ups.


## Addenda after phase A (binding; the seam landed as CT §8 — read it in full first)

B1. The schemas exist: `GateOrderHandoffRef`, `PlanEpisodeInput {episodeId, repoRoot, handoff}`, `HandoffLane`,
    `GateOrderHandoffView` (uniqueness of laneId and declarationIndex and the 0..n−1 rank set are already
    decode-checked there), `LaneScope`, `LaneOrderRule`, `LaneStep`, `LanePlanProposal {episodeId, planId,
    handoffPath, handoffSha256, orderRule, scope, laneSteps}` with class-level checks (`planId` =
    `lane-plan-${handoffSha256}`, positional `laneStepIndex`), and the three `Handoff*Error`s. Do not redefine
    them; add nothing to `Schemas.ts` unless the body cannot work without it (then a surgical planner-section
    edit, re-reading the file first; the W5 lane edits the admission section concurrently).
B2. Vocabulary is fixed by CT §8.3: `LanePlan`, `LaneStep`, `hasLanePlan`, `hasLaneStep`,
    `hasLanePlanSpecification`, `LanePlanSpecification`, `laneStepIndex`, `laneIdRef`, `precedesLaneStep`,
    `handoffDigest`, `laneOrderRule`; plan IRI `ciops-prov:${pnLocalSlug(planId)}`; lane-step IRI
    `${planNode}-lane-${laneStepIndex}`; specification tuple `(s7-lane-plan/v1, handoffSha256, orderRule, scope)`.
    Never `hasCurrentLanePlan` or `scheduledLaneRef` (rejected), never the ratified ordering cluster.
B3. Tests CT §8 assigns the body (each is required): (a) an admission document and a lane-plan document emitted
    with distinct episode ids have disjoint episode nodes; (b) `planLanes` with an acyclic precedence list that is
    not the rank chain dies (assert the Die, e.g. through `Effect.exit` and the cause reason), never
    `HandoffDecodeError`; (c) `cycleNodes` drops `CycleResult.path`'s closing repeat and renders a self-loop as
    the one-element list; (d) the permutation byte-determinism test targets the pure core (`planLanes` + the
    emitter over a permuted decoded lane array with a fixed supplied sha256), not `planEpisode`;
    (e) `LanePlanProposal.make` rejects a `schedule-` planId and a misplaced `laneStepIndex`; plus the brief's
    totality, cyclic must-fail, digest-mismatch, read-failure, admission-golden regression, forbidden-term and
    end-to-end service tests.
B4. Retire `PlannerNotImplementedError`, `plannerNotImplemented` and the `PlanEpisodeError` union member in
    this phase; update the stub assertion in `projection.test.ts` to the real plan (keep its line 5 import
    block as it is).
B5. The lab gates and the effect-vitest row splice are the same as phase A; `bun run beep ci lane fallow --base
    <phase-A commit>` must stay at 0 findings, and `bun run beep lint schema-catalog` will report staleness only
    for other packages (inherited) — if your new exports add lab entries, regenerate and splice ONLY the
    `apps/labs/ciops` entries as the orchestrator did (never a whole-file write).
