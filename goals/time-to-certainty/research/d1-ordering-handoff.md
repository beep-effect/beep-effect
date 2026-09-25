# D1 — pre-push ordering handoff: contract (2026-09-25)

Item D1 (`SPEC.md:162-166`: "order the pre-push wave so the cheapest lane most likely to prove the
change wrong runs first. This is the first body for the planner seam the ontology packet declared in
its S7 projection contract; it ships here only as the ordering of existing lanes and hands its inputs
to that packet's S8/S9 stages. The lane-DAG planner itself is not in scope"; `PLAN.md:184-185`:
"inputs handed to the ontology packet's planner seam with a receipt"). This note is the design
contract the implementation follows. Rulings 76–79 below are proposed by the orchestrator; the merge
of the PR that lands them is the lock, as for rulings 73–75. "D1" here means SPEC §D D1. It is not
the C3 table's D1 (ruling 26, `research/c3-lane-task-table.md:157`), not pr-event-awareness D1, and
not the 2026-09-09 quality-lane audit's `REPORT-local.md` finding D1 or its PLAN decisions D2, D4
and D8 (`research/decisions.md:275-281`; `WaveOrder.ts:219-220`, `:275-276`). Ruling ids are
written `D1-k`.

Rulings 71–72 stay reserved for the unlocked C5 grill draft
(`research/c5-must-fail-fixtures-grill.md:127`, `:142`), so round 24 numbers from 76.

**Operator decision:** numbering. Keep 71–72 reserved for the C5 grill draft and number round 24
from 76 (A, recommended), or give D1 71–74 and renumber the C5 draft when it locks (B).

Every line marked **Operator decision:** is a call only Benjamin can make; the text around it is
written for the recommended option, and §5 lists all of them in one place, each with the assumption
the implementation PR proceeds under.

Shape in one sentence: D1 ships no new ordering policy, command or service. It (a) seeds the one
declared pre-push lane that has no A1 row, (b) makes the seed's A1 provenance, including which A1 row
each cost comes from, a checked fact instead of an assertion, and (c) commits one fixture-guarded
`gate-order-handoff/v1` document that the ontology packet can read by path and sha256, with a
receipt in both packets.

## 0. What B3 left undone for D1 (findings)

1. **B3 already ships the ordering; its key has no ruling of record.** `orderWaveLanes`
   (`packages/tooling/tool/cli/src/commands/Yeet/internal/WaveOrder.ts:377-393`) sorts by the
   lexicographic key at `WaveOrder.ts:330-351`: seeded before unseeded, `policy-preflight` before
   `heavy`, `costP50Seconds` ascending, `redProbability` descending (`Order.flip`), `precise` before
   `imprecise`, then declaration index. The seed is the committed constant `DEFAULT_GATE_ORDER_SEED`
   (`WaveOrder.ts:172-319`, `gate-order/v1`, schema at
   `packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts:1100-1151`). B3's order is
   specified by `SPEC.md:83-85` as policy gates before any heavy lane, "ordering is by (cost,
   precision) from A1", and the seed's lane-class bases cite it (`WaveOrder.ts:29-30`); ruling 26 Q4
   ratifies ordered policy invocations with local fail-fast (`research/decisions.md:256-263`). The
   first-red tiebreak, seeded-first and declaration-index keys and the seed itself have no ruling;
   `research/decisions.md` has no B3 ruling.
2. **One declared pre-push lane has no seed row, so it runs last.** `quality:cache-policy` is declared
   in the repo-sanity group (`packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts:561-567`),
   was added by #1068 (2086a0a090) after B3 (#1006) and after the A1 window
   (`measurementAsOf` 2026-09-03). Unseeded lanes sort after every seeded one, so it runs after
   `quality:coverage` (603 s), and its `O.none()` estimate takes the stop-after-red default
   (`packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:1882-1892`). `yeet.test.ts:801-834`
   pins it at the tail (`:833`). `WaveOrder.ts:275-276` records the same defect class, fixed then for
   `fallow:health`. It is the only declared lane without a row, and no row lacks a declared lane
   (scratchpad probe `order-probe.ts`).
3. **The seed's JSON pointers are provenance strings nothing reads.** `WaveOrder.ts:8-21` imports no
   `FileSystem`; the pointer builders at `WaveOrder.ts:32-34` return strings; the only pointer strings
   in tests are placeholders (`packages/tooling/tool/cli/test/quality-tasks.test.ts:501-504`). The A3
   contract's "`WaveOrder.ts` reads the committed `research/economics.json` by JSON pointer"
   (`research/a3-economics-surface.md:30-31`) is inaccurate. A read-only probe re-run on 2026-09-25
   against d9f74d230a (`pointer-probe.ts`): 30 of 31 duration pointers resolve to a number equal to
   `costP50Seconds*1000` (storybook's is the `/hosted/laneRows` sentinel, which resolves to the
   array); the 14 exact first-red pointers (`/firstFailure/actionableLaneMix/<i>`) resolve to counts
   equal to `redProbability*832`; the other 17 are the absent sentinel with share 0. Two costs are
   not what their bases say. `quality:jsdoc-ratchet` resolves to `hosted.laneRows[16]`, whose `context` is
   `"Heavy / Doctest"`, the same row as `quality:doctest` (`WaveOrder.ts:217`, `:222`), under the
   basis "A1 hosted required-context P50 for this lane family" (`WaveOrder.ts:27`): a proxy the basis
   does not name. `quality:storybook`'s `durationPointer` is the array `/hosted/laneRows`; its 584 s
   comes from main run 34323229096 (`WaveOrder.ts:237-248`, basis at `:241`), not from
   `economics.json`, so no pointer can check it. Of the 31 rows, 16 read their lane's own A1 row, 14
   read a group aggregate or wrapper row shared with siblings, and 1 is that external run.
4. **`redProbability` is a first-red share, not P(red).** Rows divide an A1 actionable-lane count by
   832, the reconstructable first failures (basis text at `WaveOrder.ts:54-55`); `firstFailurePopulation`
   is the pointerless literal 832 (`WaveOrder.ts:176`). In `research/economics.json`,
   `.firstFailure.actionableLaneMix` sums to 1610, which equals `.firstFailure.redAttempts`, while
   `.firstFailure.attemptsWithReconstructableOuterFailure` is 832. The A3 fold counts the mix the same
   way (`packages/tooling/tool/cli/src/commands/Yeet/internal/Economics.ts:1058`). The rescale is
   uniform, so the order is unaffected; the value is a rank weight.
5. **Red share binds only in exact-cost ties; precision never binds.** Per-adjacency census of the
   deciding key (probe `d1-onto-decided-probe.ts`, re-run 2026-09-25 against d9f74d230a):
   - today (31 rows): cost-p50 19, first-red-share 6, declaration-index 4, lane-class 1, seeded 1
     (the seeded adjacency is `quality:coverage` → `quality:cache-policy`);
   - after this PR (32 rows): cost-p50 19, first-red-share 6, declaration-index 5, lane-class 1;
     precision 0 and seeded 0.
   Red share decides only inside the 183 s repo-sanity group and the 1.863 s fallow trio: dropping
   the red key reorders positions 11–18 and nothing else, and dropping the precision key changes
   nothing (probe `key-probe.ts`, re-run 2026-09-25). Precision acts only through `onRed`
   (`Tasks.ts:1882-1892`): 28 lanes stop after red, and `quality:coverage`, `quality:security`,
   `quality:sast` and `quality:nix` continue after an imprecise red (`WaveOrder.ts:223-231`,
   `:290-318`). A cost/red ratio order (lane class, then cost over share, zero-share lanes after,
   by cost) differs from the shipped order at 20 of 32 positions, both on today's seed with
   `quality:cache-policy` last and on the post-PR 32-row seed (probe `d1-ratio-diff-probe-v2.ts`,
   2026-09-25, which keys a zero-share lane `[1, cost]`). The first probe keyed it
   `Number.MAX_VALUE / 2 + cost`; float absorption dropped the cost, so zero-share lanes tied, fell
   back to declaration index, and the probe reported 29, which matches neither the stated rule nor
   the 32-row seed (27 on the post-PR seed under those semantics). The ratio order is not what B3
   ships.
6. **The seam is S7-v2 `planEpisode`, which takes only `episodeId`; S8/S9 consume the terms
   later.** `SPEC.md:163-166` already names the S7 projection contract as the seam D1 is the first
   body for, and S8/S9 as the stages that take the inputs; in that packet S8 is "OWL 2 RL + SHACL
   formalization, rules compilation" and S9 is "dogfood proof & graduation"
   (`explorations/beep-ci-operational-ontology/README.md:189-192`), so SPEC and the ontology agree.
   The planner seam is `planEpisode` (`ontology/docs/s7-projection-contract.md:100-102`), an unconditional
   `PlannerNotImplementedError` stub (`apps/labs/ciops/src/projection/CiOpsProjection.ts:45`, `:97`;
   `apps/labs/ciops/src/projection/Schemas.ts:885-887`) whose input carries only `episodeId`
   (`Schemas.ts:843-848`). The contract's non-goals forbid a planner body and repo-cli integration
   (`s7-projection-contract.md:255-259`); a tooling package must not import a lab
   (`standards/architecture/15-lab-apps.md:130-136`).
7. **The lab consumes repo-cli facts only as documents, and none from `goals/` yet.** It mirrors
   `yeet-admission-journal` v1–v3 in its own classes (`apps/labs/ciops/src/projection/Schemas.ts:601-760`)
   and reads packet artifacts by repo path plus a computed sha256
   (`apps/labs/ciops/scripts/generate-replay-evidence.ts:17-20`, `:41-54`). Those three paths are all
   in its own exploration (`explorations/beep-ci-operational-ontology/...`); no ciops code reads a
   `goals/` path. A TypeScript constant in repo-cli is therefore not a handoff; a committed document
   is, and D1 offers it by path without wiring it.
8. **Plan and runtime compose the pre-push lane set twice.** `Planner.ts:413-421`
   (`proofLanesForTier`, tier `full`) and `Quality.command.ts:1008-1019` (`runPrePushChecks`) spell
   the same five-group concatenation. The plan calls `orderWaveLanes(DEFAULT_GATE_ORDER_SEED, …)`
   directly (`Planner.ts:431`); the runtime yields `WaveOrder` provided by `WaveOrder.Default`
   (`Quality.command.ts:1019`, `WaveOrder.ts:425-431`). On `main` the plan drops
   `quality:changeset-status` (`Planner.ts:410-411`), and so does the runtime
   (`Quality.command.ts:905-921`).
9. **The frozen A1 seed and the live A3 fleet disagree by up to about 300x.** From
   `yeet-economics/v1 --fleet` (read-only capture, 2026-09-25; seed → live inner P50): `quality:lint`
   267 → 5.129 s, `quality:jsdoc-ratchet` 82 → 279.713 s, `quality:storybook` 584 → 1.785 s,
   `quality:cache-policy` (unseeded) live 7.493 s. A3 lane rows merge tiers (phase hard-coded
   `"full"`, `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:761`), keep legacy
   `pre-push:*` ids beside `quality:*`, and cannot produce precision, lane class or hosted P50s. A live
   reseed would move 30 of 32 lanes (`surface-counterfactual-probe.ts`, re-run 2026-09-25 against the
   same capture). That reseed is a policy change that needs its own ruling; ruling 8
   (`research/decisions.md:68-73`) governs only the row-by-row close re-run and says nothing about the
   seed. Unlike the rest of §0, the live numbers here (5.129 s, 279.713 s, 1.785 s, 7.493 s) and the
   30-of-32 count come from an uncommitted `--fleet` capture of live attempt journals and scratchpad
   probes; nothing committed reproduces them, and the round-3 review (2026-09-25) could not confirm
   them from code. That review did reproduce the other §0 numbers from the committed seed and
   `economics.json`: the 19/6/4/1/1 → 19/6/5/1 census, rank 31 → 19, the ratio order's 20 of 32
   before and after, 27 under float absorption, the 16/15/1 cost bases, the sha256 `37e854ef…` and
   the cache baseline digest `bd8649cc…` (the two digests re-checked with `sha256sum` on 2026-09-25).
10. **Two seed rows point at pre-ruling-28 lane ids.** `quality:security` → `actionableLaneMix[27]`
    (`lane: "pre-push:security"`, 5) and `quality:secrets` → `[31]` (`"pre-push:secrets"`, 4)
    (`WaveOrder.ts:290-299`; ruling 28 at `research/decisions.md:283-296`). A count-only check would
    not see a pointer that drifted to another lane, and a value-only duration check would not see one
    either: `quality:jsdoc-ratchet` and `quality:doctest` share `laneRows[16]`, and `laneRows[13]`
    (`"SAST"`) has the same 82 000 ms.
11. **The ontology packet owes a control-intervention row for B3, and the row is its steward's.** Its
    2026-08-27 purity-vs-control-interventions ruling names the "cost-ordered fail-fast ladder" as a
    lever to be "recorded in this packet against the KPI time-series before/after"
    (`explorations/beep-ci-operational-ontology/DECISIONS.md:118-129`, answer at `:123-124`);
    `research/control-interventions.yaml:11-35` holds only `iv-870-weighted-admission`. That file "is
    the pre-A-Box seed — at S6 these become ciops:OperationalChangeEvent individuals verbatim"
    (`control-interventions.yaml:4-5`), and `ciops:landedAt` is seed-only
    (`ontology/extraction/s6/PREDICATES.yaml:474-482`), so a row there is an A-Box seed individual,
    which ruling 79 leaves to that packet.
12. **A repo-cli test that reads a goals/ JSON file is invisible to the turbo cache.**
    `packages/tooling/tool/cli/turbo.json` declares `test.inputs` as `$TURBO_EXTENDS$` plus the root
    `turbo.json` only; the root sets `futureFlags.affectedUsingTaskInputs: true` (`turbo.json:3-4`).
    Without an input edit, a PR that changes only `economics.json` leaves the repo-cli test cached
    green and main goes red later as an inherited failure. The path is not docs-only for Heavy
    admission: `heavyDocsOnlyPattern`
    (`packages/tooling/tool/cli/src/commands/Ci/HeavyAdmission.ts:269-270`) admits `goals/INDEX.md`,
    `goals/README.md`, a goal's `GOAL|PLAN|README|SPEC|DECISIONS.md` and `ops/manifest.json`, anything
    under `docs/`, `explorations/` or top-level `research/`, `.changeset/*.md`, and any path ending in
    `.md`; a `goals/*/research/*.json` path is not docs-only.

## Proposed ruling 76 (D1-1) — the D1 order is B3's lexicographic key, named, over a seed that covers every declared pre-push lane

- **Ruling**: the pre-push wave keeps B3's key over `DEFAULT_GATE_ORDER_SEED`, named
  `gate-order-lexicographic/v1`: seeded first, `policy-preflight` before `heavy`, A1 cost P50
  ascending, A1 first-red share descending, `precise` before `imprecise`, declaration index. This is
  D1's reading of "(cost, red probability, precision)". Any change of key, sequence or direction is a
  new `orderRule` literal.
- Every lane the non-main full-tier pre-push plan declares (the lanes
  `githubCheckPrePushLanes` in `GithubChecks.ts` returns with `githubCheckChangesetStatusLane`)
  carries exactly one seed row, and every seed row names a lane of
  that plan. `quality:cache-policy` gets the Repo Sanity aggregate proxy its eight repo-sanity
  siblings use: 183 s at `/hosted/laneRows/7/p50DurationMs`, first-red share 0 by absence,
  `precise`, `policy-preflight`. Its basis prose says the lane postdates the A1 window; it does not
  reuse `repoSanityRow`, whose bases claim "zero of 832 was observed" and "inner-lane durations were
  not yet recorded" (`WaveOrder.ts:28`, `:113-129`). The four seeded lanes that already joined the
  plan after the A1 window, `fallow:health` (#1021), `quality:doctest` (#1049), `quality:storybook`
  and `repo-sanity:config-typecheck` (#1054), get the same postdates-the-window first-red basis in
  this PR; their values, pointers and order do not change. Their current basis, "zero of 832 was
  observed" (`WaveOrder.ts:28`, used by `seedRow` at `:54-56`), is wrong for them: none of the four
  is declared at 88fa371cb0, the last commit before `measurementAsOf` (`git grep` of
  `packages/tooling/tool/cli/src` finds only the CI `doctest` lane), and their first appearance as
  lane ids is 2026-09-08/09. `quality:cache-policy` moves from rank 31 to rank 19 (0-based), after
  `repo-sanity:config-typecheck` and before `quality:build`; the other 31 lanes keep their relative
  order.
- **Seeding rule for any later pre-push lane.** The A1 window is the one the seed pins: it ends at
  `measurementAsOf` 2026-09-03T06:29:38.367Z (`WaveOrder.ts:175`), the ruling-8 baseline window
  2026-08-04 to 2026-09-03. A lane that joins the plan after it gets a
  seed row and a cost-source entry (ruling 77) in the PR that adds it: its duration is the A1 row its
  group or wrapper siblings use (cost basis `a1-proxy-row`), or, when no A1 row covers it, a named
  external run behind the `/hosted/laneRows` sentinel (`external-run`, the `quality:storybook`
  precedent); its first-red share is 0 by absence with `NO_EXACT_FIRST_RED_POINTER` and a basis that
  says the lane postdates the A1 window; it is `precise` unless an A4 attribution says otherwise; its
  lane class is `policy-preflight` when its `GithubCheckLaneSpec.wave` is `preflight`
  (`Quality.schemas.ts:1183`) and `heavy` otherwise, which holds for all 32 lanes today. The rule
  holds while the seed is `gate-order/v1` over the pinned `37e854ef…` bytes; the ruling that
  reseeds (from live A3 or from the P4 close report) replaces it and restates the rule for its own
  window.
- **Rationale**: SPEC B3 fixed (lane class, cost, precision); B3 (#1006) added the first-red
  tiebreak; ruling 76 records that key as D1's order (§0.1). The one unseeded lane has run after the
  603-second coverage lane since #1068 (§0.2). A ratio order is admissible under SPEC D1
  (`SPEC.md:165-166` scopes D1 to "the ordering of existing lanes" and puts only the lane-DAG planner
  out of scope) but would be a new `orderRule` literal; it is rejected here because it reorders 20 of
  32 lanes on a rank weight that is not P(red) (§0.4, §0.5). UC-001 does not support cost-first
  ordering: its main flow puts ascending cost third, after diff-touched and topological tie-break
  (`ontology/docs/use-cases.yaml:13`), and its goal, minimizing expected
  time-to-first-actionable-failure (`:7`), is closer to the rejected ratio order. D1 rejects that
  order for want of a probability to divide by (CQ-018 stays deferred), not on UC-001's authority.
  Naming the rule lets any later change show up
  as a literal the consumer can detect.
- **Rejected**: a cost/(red share) ratio order in D1 (it reorders 20 of 32 positions on a share that
  is not a probability; admissible, but a new literal with no evidence behind it); a reseed from live
  `yeet-economics/v1` (§0.9); the live A3 P50 of 7.493 s for `quality:cache-policy` (it mixes sources
  inside one `gate-order/v1` seed); recording the unseeded lane as a receipt only (the handed order
  would stay wrong).

**Operator decision:** lock the lexicographic cost-first key as the meaning of SPEC D1's "(cost, red
probability, precision)" / "cheapest lane most likely to prove the change wrong" (A, recommended),
or require a cost/red ratio order now as a new `orderRule` literal (B).

**Operator decision:** seed `quality:cache-policy` from the frozen 183 s Repo Sanity proxy with a
"0 by absence" red basis (A, recommended; moves rank 31 → 19 and changes runtime early-stop, so a
cache-policy red now stops before `quality:build` through `quality:coverage`), from its live 7.493 s
(B), or leave it unseeded with a receipt (C).

## Proposed ruling 77 (D1-2) — the seed's A1 provenance is checked against pinned bytes, and the red term is carried as counts

- **Ruling**: a repo-cli fixture resolves every seed `durationPointer` and `firstRedPointer`, plus
  `measurementAsOf` and the 832 population, against the bytes of
  `goals/time-to-certainty/research/economics.json`, decoded through a schema-first view of only the
  resolved subset. Pointers are parsed into a closed kind set; an unknown shape is a finding, never a
  guess. The pre-push runtime still never reads the file.
- Each seeded lane has one cost-source entry with a closed cost basis: `a1-lane-row` (the A1 row of
  the lane's own hosted context), `a1-proxy-row` (a group aggregate or wrapper row shared with
  siblings) or `external-run` (a named run outside A1, behind the `/hosted/laneRows` sentinel). The
  fixture checks that each resolved A1 row's `context` or `id` equals the entry's source key, so a
  pointer that drifts to another row with the same value is a finding, and that the key names
  exactly one row of the pointer's array, so a key that repeats is a finding too
  (`localWrapperLanes` ids repeat: `publish:00-head-install-preflight` at `[13]`, `[14]`, `[21]`,
  `commit:01-git-commit` at `[18]`, `[24]` with the same `phase`, `publish:01-git-push` at `[19]`,
  `[25]`; the three wrapper keys the seed uses and all 17 hosted contexts are unique). An
  `external-run` cost is not fixture-verified, and the handoff says so.
- The handoff carries the red term as data: the A1 first-failure population (832) and the red-attempt
  population the numerators come from (1610), and for exact-row pointers the resolved A1 lane key, so
  the `pre-push:security` / `pre-push:secrets` aliases are visible. The red check multiplies
  `redProbability` by the seed's own `firstFailurePopulation` (the denominator its shares were divided
  by, `WaveOrder.ts:54-55`, `:176`), and one separate check compares that population with A1's
  `attemptsWithReconstructableOuterFailure`, so a population drift is one finding, not fourteen.
  The mix must also sum to A1's `redAttempts` (1610). The field name `redProbability`
  stays frozen at `gate-order/v1`; the contract and the JSDoc call the value a first-red share, a
  rank weight and not P(red).
- The seed pins the P0 baseline bytes (sha256 `37e854ef…`); where the P4 close report lands is
  P4's call under `SPEC.md:185`. If P4 rewrites `economics.json`, fixtures 2–4 go red and any reseed
  needs its own ruling.
- **Pin move, not reseed.** A PR that edits `research/scripts/economics.py` and re-renders
  `economics.json` without a P4 re-run moves the file's bytes through the script's self-receipt
  (the `reproduction-script` entry with `bytes` and `sha256_12`, `economics.json:5561-5566`), as
  #964, #978 and #1026 did (`git show 58e063757b c772d25970 247d22465b --
  goals/time-to-certainty/research/economics.json`: #964 and #1026 change only that entry's `bytes`
  and `sha256_12`; #978 also adds six zero-valued left-censoring counters and rewords two episode
  labels). The script fix owed in
  `research/OPPORTUNITIES.md:2409-2415` would be one such PR. That is a pin move: the PR updates
  `GATE_ORDER_SOURCE.sha256`, regenerates the handoff (fixture 4's two runs) and needs no ruling,
  provided fixture 2 still reports zero findings against the new bytes. If any value, row key or
  population a seed pointer resolves to changes, it is a reseed and needs its own ruling. Receipts
  that cite `37e854ef…` are dated history and are not edited. The self-receipt is already stale on
  main: #1143 (8a99d4aac9) edited `economics.py` without re-rendering, so the file is 102754 bytes
  with `sha256_12` `c216899f5978`, while `economics.json:5562-5565` records 102635 bytes and
  `18d03bfaab75` (checked 2026-09-25 against d9f74d230a). D1 pins the committed bytes as they are
  and does not re-render them.
- **Rationale**: provenance handed to another packet must be checked, not asserted (§0.3); the
  population mismatch (§0.4), the alias ids and the shared duration rows (§0.10) are exactly what a
  consumer would misread from prose alone. The ontology's CQ-018 `estimatedFailureProbability` stays
  deferred until its steward decides a scheduling decision consumes a probability
  (`ontology/docs/competency-questions.yaml:448-465`).
- **Rejected**: reading `economics.json` in the pre-push runtime (an I/O failure mode on every push);
  a `gate-order/v2` bump or renaming `redProbability` (no consumer needs it before P4); re-denominating
  the share (a uniform rescale leaves the order unchanged and D1 has no evidence to choose a
  denominator); an untyped `JsonStringCodec(S.Unknown)` walk (schema-first law, `GOAL.md:31-32`);
  binding the P4 close re-run to reseed in its PR (P4 is not D1's to bind).

**Operator decision:** keep `redProbability` at `gate-order/v1` as a count/832 rank weight with 1610
carried beside it as data (A, recommended), or rename or re-denominate before handing it to CQ-018
(B).

**Operator decision (recorded for P4; D1 decides nothing here):** where the P4 A1 close report
lands. `research/scripts/economics.py:32`, `:50` write the report to `research/economics.json`, the
path the seed pins. (A) a new path beside the baseline through a P4 output option in the script,
which P4 must reconcile with the "same script, row by row" of rulings 8 and 73; (B) P4 overwrites
`economics.json`, `SPEC.md:185` then still requires the baseline to survive in `research/` under
another name, and fixtures 2–4 stay red until a reseed ruling. §5 decision 7 has the SPEC
reconciliation.

## Proposed ruling 78 (D1-3) — the handoff is one committed, fixture-guarded `gate-order-handoff/v1` document

- **Ruling**: `goals/time-to-certainty/research/gate-order-handoff.json` is a `GateOrderHandoff`
  (`S.Class`, `schemaVersion: "gate-order-handoff/v1"`). It carries the `gate-order/v1` seed
  verbatim; `orderRule: "gate-order-lexicographic/v1"`; `scope: "pre-push:non-main"`; the source as a
  reused `CacheEvidenceReference { path, sha256 }` plus the A1 `measurementAsOf`, 832 and 1610; and
  the 32 lanes in execution order, each with rank, declaration index, the key that separated it from
  its predecessor (`decidedBy`), its red-scheduling consequence, its cost basis, the resolved A1
  duration row key with that row's P50 and P95 in ms, and the resolved A1 first-red lane key.
- No repo-cli command writes it and no clock, host path or commit id is in it. Its bytes are
  two-space pretty JSON with a trailing newline: `S.encodeEffect(S.fromJsonString(GateOrderHandoff,
  { space: 2 }))` of the value, plus `"\n"` (the `space` option of `fromJsonString`, installed
  `node_modules/effect/src/Schema.ts:9198-9206`). `GateOrderHandoffJson` is a `JsonStringCodec`, which
  builds `S.fromJsonString(schema)` with no options and so encodes compact JSON
  (`packages/tooling/tool/cli/src/internal/schema/JsonCodec.ts:78-85`), so it never produces the
  committed bytes: fixture 4 uses its decode on the computed bytes, and its compact encode is used
  only in fixture 7's round trip.
  A repo-cli fixture fails whenever its bytes differ from the bytes the checkout computes, and those
  computed bytes must decode back to the computed value, so the committed value is guarded through
  its bytes; the only writer is that fixture's vitest file snapshot, updated by a `-u` run and a
  plain run after it, with the diff reviewed by a person. Its commit is its checkout identity; its sha256 is what the receipts cite.
- The repo-cli `test` and `test:property` tasks declare `economics.json` and
  `gate-order-handoff.json` as inputs (§0.12; operator decision 8). Both scripts run the same
  `bunx --bun vitest run` (`packages/tooling/tool/cli/package.json:160-161`, `:169`), so both run the
  fixture, and both carry the same `inputs` today (`packages/tooling/tool/cli/turbo.json`). This is
  not the blanket cache-key tuning `SPEC.md:175-176` rejects: it names the two files one fixture
  reads so the task's key covers what it tests, and changes no key to move a hit rate.
- To reproduce the order it records without the file, the existing
  `bun run beep yeet verify --plan --json` prints the same `full:pre-push` lane ids
  (`packages/tooling/tool/cli/src/commands/Yeet/Yeet.command.ts:142-145`).
- **Rationale**: the lab takes repo-cli facts only as documents read by path and sha256 (§0.7), and
  S7 forbids repo-cli integration (§0.6), so a TypeScript constant is not a handoff. The consumer is
  the ontology steward through the receipt. The fixture guards freshness only. No code reads the
  document until the S7-v2 seam widens, which is that packet's call. The path is not docs-only, so a
  PR that edits it still runs Heavy (§0.12).
- **Rejected**: a new subcommand printing the document (the lab cannot run repo-cli, and a stdout
  document has nothing to pin by sha256); a section in `yeet economics` (live window and clock); a
  `gate-order/v2` bump carrying the order (the seed feeds the order, so that is circular); an
  embedded commit SHA (a file cannot name its own commit, and squash merges rewrite it);
  `blockedBy` edges in the document (every lane's list is empty and nothing reads one); a mirrored
  `gate-order` schema in `apps/labs/ciops` (§ruling 79).

**Operator decision:** handoff medium. A committed fixture-guarded JSON with no code reader yet (A,
recommended), a print-only command with no persisted bytes (B), or a committed JSON plus a ciops
mirror that decodes it into a widened `PlanEpisodeInput` (C). Ruling 73's "nothing reads one"
(`research/decisions.md:970-971`) rejected a persisted artifact for the `yeet economics` surface
only; whether a document read today only by a steward is worth committing is the operator's call.

**Operator decision:** accept the `packages/tooling/tool/cli/turbo.json` `test.inputs` and
`test:property.inputs` edit (adding `economics.json` and `gate-order-handoff.json` to both) and the
reviewed `standards/cache-qualification-baseline.json` re-record it forces (that `turbo.json` is one
of the baseline's `projection.sources`), redone after every merge of main in the §4 order (A,
recommended), or accept the cached-green hole of §0.12 (B).

## Proposed ruling 79 (D1-4) — the receipt lands in both packets; the ontology seam stays as it is

- **Ruling**: SPEC D1's "hands its inputs to that packet's S8/S9 stages" is discharged by the
  committed document offered, by path and not wired, as input to the ontology packet's S7-v2
  `planEpisode` seam; S8 later formalizes the cost and red terms, S9 dogfoods them, as SPEC already
  says (`SPEC.md:163-166`). `SPEC.md` gains one dated parenthetical on D1 that names where the
  document is offered (the S7-v2 seam) and these rulings; it records a landing, not a SPEC error
  (dated-parenthetical precedent #1184, `SPEC.md:150-151`). The same PR writes, in
  `explorations/beep-ci-operational-ontology`:
  - one dated entry in `research/OPPORTUNITIES.md` naming the document, its sha256, its target, the
    unit and measure mismatches (seconds vs CQ-003 `p50Ms`; first-red share vs CQ-018; precision has
    no CQ or term; the cost-basis literals against CQ-003's `measured`/`census`/`default`), the
    ruling numbers, and one open item for the ontology steward: `iv-1006-wave-order`, with draft
    values in §4 of this note. The open item goes there, not into the exploration manifest's
    `exploration.openQuestions`, which "mirrors the unresolved questions in `DECISIONS.md`"
    (`explorations/README.md:134-135`) while this ruling leaves that log unchanged, and not into the
    README "Next Open Question" (`README.md:22`), the steward's own resume narrative; the steward may
    promote it to either. Unlike the #964 precedent, which recorded a fact already carried, this
    entry offers an open item;
  - one clause in the `research/SOURCES.md` §4 Yeet-internals REUSE bullet naming
    `internal/WaveOrder.ts` (`WaveOrder`, `DEFAULT_GATE_ORDER_SEED`, `gate-order/v1`) and the
    document;
  - one dated README Trail line (newest first, above the 2026-09-16 line), outside the generated
    Status region.
- `research/control-interventions.yaml`, `PlanEpisodeInput`, `apps/labs/ciops`,
  `ontology/docs/s7-projection-contract.md`, the ontology `DECISIONS.md`, every vocabulary file,
  `ontology/extraction/**` and `research/auditor-run4-intake.md` stay unchanged.
- **Rationale**: ruling 14's eviction handoff set the one-line receipt precedent
  (`research/decisions.md:113-121`, realized as ontology `research/OPPORTUNITIES.md:36-37` in #964);
  ruling 41 set the Trail-plus-SOURCES pair (`research/decisions.md:477-482`, #1149). The ontology's
  own law asks for the B3 ladder to be recorded against the KPI before and after (§0.11), but a row in
  `control-interventions.yaml` is an A-Box seed individual and needs a before/after pointer, so the
  receipt names it for the steward with draft values instead of writing it. The PR takes a stated
  exception to the explorations session law (`explorations/README.md:188-190`: a session that
  touches a packet writes the next open question into its README, syncs the manifest and runs the
  Atlas writer). The #964 and #1149 receipts wrote into other packets the same way: 58e063757b
  touches only the ontology `research/OPPORTUNITIES.md`, and 9e77f17410 only the pr-event-awareness
  README Trail and `research/SOURCES.md`. A ttc receipt writer is not a session of that packet, so
  its README "Next Open Question" and `ops/manifest.json` (including `updated`, `2026-09-16` today)
  stay as they are for the steward's next session; `ATLAS.md` is an ignored local projection
  (`:192-194`), so the Atlas writer leaves nothing tracked. Widening the seam,
  emitting A-Box facts, minting `ciops-prov:` terms or promoting CQ-003/CQ-018 are calls for that
  packet's steward and auditor (`s7-projection-contract.md:255-259`; ontology `DECISIONS.md:633-641`).
- **Rejected**: writing the `iv-1006-wave-order` row from a ttc PR (A-Box seed, steward's call); a
  ciops mirror plus a `PlanEpisodeInput.laneOrder` widening in this PR; a provisional lane-order A-Box
  (16 new `ciops-prov:` terms with no Must/Should CQ); ontology DECISIONS rulings ratified by a ttc
  merge; `links.goals` (graduation semantics); an INBOX entry (a triage queue); a run-4 docket row
  (pre-pin draft owned by its lanes); rewriting SPEC D1's sentence.

**Operator decision:** cross-packet write scope. OPPORTUNITIES entry with the `iv-1006-wave-order`
open item, SOURCES clause and README Trail line (A, recommended); also write the row, with an explicit
carve-out that a seed row is not an emitted A-Box fact plus a before/after KPI pointer (B; the
carve-out is an ontology ruling, so B also needs a DECISIONS entry by that packet's steward, which
conflicts with this ruling's list of ontology files that stay unchanged); or also the ciops mirror,
contract amendments and ontology DECISIONS rulings (C).

**Operator decision:** the SPEC D1 parenthetical. A dated SPEC.md parenthetical naming where the
document is offered (the S7-v2 seam) and rulings 76–79 (A, recommended; dated-parenthetical precedent
#1184, `SPEC.md:150-151`; #1168, `SPEC.md:135`, shows an in-place ruling cite), or no SPEC edit, the
rulings alone (B).

**Operator decision:** P3 closure. Tick D1 and flip P3 complete in PLAN and the manifest in this PR,
although "handed" is not "consumed", and refresh the stale GOAL.md Status and manifest `statusNote`
with the §4 drafts (A, recommended); or leave P3 in progress until the ontology steward acts on the
open item (B).

## 1. Data model (schema first) — `packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts`

All additions sit directly after `GateOrderSeed` (`:1140-1151`), before `OptionalGateOrderSeedRow`
(`:1153`). `GateOrderSeedRow` and `GateOrderSeed` (`:1100-1151`) are unchanged and stay
`gate-order/v1`. Every class passes `$I.annote(...)`; every literal domain is a `LiteralKit` without
`as const`, piped through `$I.annoteSchema(...)` and paired with `export type X = typeof X.Type`, as
`GateRedSchedulingDecision` and `GateOrderLaneClass` are (`:1024-1037`, `:1053-1066`); every export
has titled `**Example**` / `**Details**` / `**Gotchas**` JSDoc (`.patterns/jsdoc-documentation.md`).
Options encode as `null` (`S.OptionFromNullOr`). New imports: `CacheEvidenceReference` from
`@beep/repo-configs/cache` (already imported by repo-cli at
`commands/Cache/Cache.entrypoints.schemas.ts:8`; class at
`packages/tooling/policy-pack/repo-configs/src/cache/Cache.policy.ts:261-267`), `JsonStringCodec`
from `../../internal/schema/JsonCodec.ts` (`JsonCodec.ts:78`; precedent
`commands/Yeet/internal/Economics.schemas.ts:15`, `:848`), and `effect/HashSet`, `effect/HashMap`,
`effect/Equal` and `effect/Option` for the filter and the pointer classifier (the file already imports `A` from `@beep/utils`, `:10`, which
re-exports `effect/Array`, `packages/foundation/modeling/utils/src/Array.ts:614`). No new source file,
so no new-file row in `standards/coverage.regression-baseline.jsonc`.

```ts
export const GateOrderRule = LiteralKit(["gate-order-lexicographic/v1"]).pipe(
  $I.annoteSchema("GateOrderRule", { description: "Named D1 ordering rule over the gate-order seed (ruling 76)." })
);
export type GateOrderRule = typeof GateOrderRule.Type;

export const GateOrderSortKey = LiteralKit([
  "seeded", "lane-class", "cost-p50", "first-red-share", "precision", "declaration-index",
]).pipe( // the six Order.mapInput components of WaveOrder.ts:330-351, in comparison order
  $I.annoteSchema("GateOrderSortKey", { description: "Component of the D1 key that separated a lane from its predecessor." })
);
export type GateOrderSortKey = typeof GateOrderSortKey.Type;

export const GateOrderHandoffScope = LiteralKit(["pre-push:non-main"]).pipe(
  $I.annoteSchema("GateOrderHandoffScope", { description: "Plan the handoff order covers: the full pre-push tier on a non-main branch." })
);
export type GateOrderHandoffScope = typeof GateOrderHandoffScope.Type;

export const GateOrderPointerKind = LiteralKit([
  "hosted-lane-row", "hosted-lane-array", "local-wrapper-row", "first-failure-row", "first-failure-absent",
]).pipe(
  $I.annoteSchema("GateOrderPointerKind", { description: "Closed set of JSON pointer shapes a gate-order seed row may carry." })
);
export type GateOrderPointerKind = typeof GateOrderPointerKind.Type;

// Anchored, non-global (stateless `exec`), no leading zeros; tried in this order, first match wins.
const GATE_ORDER_POINTER_SHAPES: ReadonlyArray<readonly [GateOrderPointerKind, RegExp]> = [
  ["hosted-lane-row", /^\/hosted\/laneRows\/(0|[1-9]\d*)\/p50DurationMs$/],
  ["hosted-lane-array", /^\/hosted\/laneRows$/], // external-run sentinel, WaveOrder.ts:237-248
  ["local-wrapper-row", /^\/localWrapperLanes\/(0|[1-9]\d*)\/p50DurationMs$/],
  ["first-failure-row", /^\/firstFailure\/actionableLaneMix\/(0|[1-9]\d*)$/],
  ["first-failure-absent", /^\/firstFailure\/actionableLaneMix$/], // NO_EXACT_FIRST_RED_POINTER, WaveOrder.ts:25
];

// None = unknown shape (a `pointer-shape-unknown` finding). The index is Some for the three row
// kinds and None for `hosted-lane-array` and `first-failure-absent`, which carry no index.
export const classifyGateOrderPointer = (
  pointer: string
): O.Option<readonly [GateOrderPointerKind, O.Option<number>]> =>
  A.findFirst(GATE_ORDER_POINTER_SHAPES, ([kind, shape]) =>
    O.map(O.fromNullishOr(shape.exec(pointer)), (match) => [kind, O.map(O.fromNullishOr(match[1]), Number)] as const)
  );

export const GateOrderCostBasis = LiteralKit(["a1-lane-row", "a1-proxy-row", "external-run"]).pipe(
  $I.annoteSchema("GateOrderCostBasis", {
    description: "Where a seeded lane's cost comes from: its own A1 row, a shared A1 group or wrapper row, or a named run outside A1.",
  })
);
export type GateOrderCostBasis = typeof GateOrderCostBasis.Type;

export const GateOrderSeedFindingKind = LiteralKit([
  "pointer-shape-unknown", "duration-unresolved", "duration-mismatch", "duration-source-mismatch",
  "duration-source-ambiguous", "red-unresolved", "red-mismatch", "red-lane-mismatch", "absent-red-nonzero",
  "population-mismatch", "red-attempts-mismatch", "measurement-mismatch",
  "unseeded-lane", "orphan-seed-row", "cost-basis-unmapped", "lane-class-wave-mismatch",
]).pipe(
  $I.annoteSchema("GateOrderSeedFindingKind", { description: "Kinds of disagreement between the gate-order seed, the plan and the pinned A1 document." })
);
export type GateOrderSeedFindingKind = typeof GateOrderSeedFindingKind.Type;
```

Source view (decodes only what the seed resolves; excess keys are stripped by default,
`SchemaAST.ts:463`; `verification-economics/v1` itself stays owned by
`research/scripts/economics.py:55-58`):

```ts
const A1DurationMs = S.Int.check(S.isGreaterThanOrEqualTo(0));
export class EconomicsSeedSourceView extends S.Class<EconomicsSeedSourceView>($I`EconomicsSeedSourceView`)({
  schemaVersion: S.Literal("verification-economics/v1"),
  measurementAsOf: S.NonEmptyString,
  hosted: S.Struct({ laneRows: S.Array(S.Struct({ context: S.NonEmptyString, p50DurationMs: A1DurationMs, p95DurationMs: A1DurationMs })) }),
  localWrapperLanes: S.Array(S.Struct({ id: S.NonEmptyString, p50DurationMs: A1DurationMs, p95DurationMs: A1DurationMs })),
  firstFailure: S.Struct({
    attemptsWithReconstructableOuterFailure: S.Int.check(S.isGreaterThan(0)),
    redAttempts: S.Int.check(S.isGreaterThan(0)),
    actionableLaneMix: S.Array(S.Struct({ lane: S.NonEmptyString, attempts: S.Int.check(S.isGreaterThanOrEqualTo(0)) })),
  }),
}, $I.annote("EconomicsSeedSourceView", { description: "The subset of the A1 economics document the gate-order seed points into." })) {}
export const EconomicsSeedSourceViewJson = JsonStringCodec(EconomicsSeedSourceView)
```

Key names checked against `economics.json` at d9f74d230a: `hosted.laneRows[7]` has `context`
(`"Repo Sanity"`), `p50DurationMs` (183000) and `p95DurationMs` (307000); `localWrapperLanes[i]` has
`id`, `p50DurationMs` and `p95DurationMs`; every P95 in both arrays is an integer.

Cost source (one per seeded lane; the table lives in `WaveOrder.ts`, §2):

```ts
export class GateOrderCostSource extends S.Class<GateOrderCostSource>($I`GateOrderCostSource`)({
  laneId: S.NonEmptyString,
  costBasis: GateOrderCostBasis,
  sourceKey: S.OptionFromNullOr(S.NonEmptyString), // A1 hosted `context` or local wrapper `id`; None iff external-run
}, $I.annote("GateOrderCostSource", { description: "The A1 row, by context or wrapper id, a seeded lane's cost P50 is read from, and why." })) {}
```

Finding (the fixture surface; empty for the committed seed):

```ts
export class GateOrderSeedFinding extends S.Class<GateOrderSeedFinding>($I`GateOrderSeedFinding`)({
  kind: GateOrderSeedFindingKind,
  laneId: S.OptionFromNullOr(S.NonEmptyString),
  pointer: S.OptionFromNullOr(S.NonEmptyString),
  expected: S.OptionFromNullOr(S.Finite), // in the pointer's unit: ms, count or population
  actual: S.OptionFromNullOr(S.Finite),
  detail: S.OptionFromNullOr(S.NonEmptyString), // expected vs resolved row key or lane key
}, $I.annote("GateOrderSeedFinding", { description: "One disagreement between the gate-order seed, the declared plan and the pinned A1 document." })) {}
```

Handoff document:

```ts
export class GateOrderHandoffSource extends S.Class<GateOrderHandoffSource>($I`GateOrderHandoffSource`)({
  reference: CacheEvidenceReference,          // { path: "goals/time-to-certainty/research/economics.json", sha256 }
  schemaVersion: S.Literal("verification-economics/v1"),
  measurementAsOf: S.NonEmptyString,          // equals /measurementAsOf; the filter checks it equals seed.measurementAsOf
  firstFailurePopulation: S.Int.check(S.isGreaterThan(0)),   // /firstFailure/attemptsWithReconstructableOuterFailure (832); filter: equals seed's
  firstFailureRedAttempts: S.Int.check(S.isGreaterThan(0)),  // /firstFailure/redAttempts (1610), the numerator population
}, $I.annote("GateOrderHandoffSource", { description: "The pinned A1 document the handoff's seed was verified against." })) {}

export class GateOrderHandoffLane extends S.Class<GateOrderHandoffLane>($I`GateOrderHandoffLane`)({
  rank: S.Int.check(S.isGreaterThanOrEqualTo(0)),            // 0-based execution position
  laneId: S.NonEmptyString,                                  // ruling-28 id; its seed row is the seed.lanes entry whose laneId matches (looked up by id, never by index)
  declarationIndex: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  decidedBy: S.OptionFromNullOr(GateOrderSortKey),           // None iff rank 0
  redScheduling: GateRedSchedulingDecision,                  // Quality.schemas.ts:1024
  costBasis: GateOrderCostBasis,
  durationSourceKey: S.OptionFromNullOr(S.NonEmptyString),   // resolved A1 context / wrapper id; None iff external-run
  durationP50Ms: S.OptionFromNullOr(S.Int),                  // resolved row P50 (CQ-003 p50Ms); None iff external-run
  durationP95Ms: S.OptionFromNullOr(S.Int),                  // resolved row P95 (CQ-003 p95Ms); None iff external-run
  firstRedSourceLane: S.OptionFromNullOr(S.NonEmptyString),  // resolved A1 .lane; Some iff the seed row's firstRedPointer is a first-failure-row
}, $I.annote("GateOrderHandoffLane", { description: "One lane of the D1 pre-push order with the key that placed it and its resolved A1 sources." })) {}

export class GateOrderHandoff extends S.Class<GateOrderHandoff>($I`GateOrderHandoff`)(
  S.Struct({
    schemaVersion: S.Literal("gate-order-handoff/v1"),
    scope: GateOrderHandoffScope,   // pre-push tier on a non-main branch (Planner.ts:410-411 drops changeset-status on main)
    orderRule: GateOrderRule,
    source: GateOrderHandoffSource,
    seed: GateOrderSeed,            // gate-order/v1 verbatim: cost, first-red share, precision, bases, pointers
    lanes: S.Array(GateOrderHandoffLane),
  }).pipe(S.check(GateOrderHandoffCoherence)),
  $I.annote("GateOrderHandoff", { description: "SPEC D1 handoff: the A1/A4 gate-order seed, its pinned source, and the pre-push order it produces." })
) {}
export const GateOrderHandoffJson = JsonStringCodec(GateOrderHandoff) // never writes the committed bytes: compact on encode (JsonCodec.ts:78-85), encode used only by fixture 7's round trip
```

The committed bytes are not `GateOrderHandoffJson.encode`: that codec builds `S.fromJsonString(schema)`
with no options (`JsonCodec.ts:79`) and emits compact JSON. The canonical bytes are
`` `${yield* S.encodeEffect(S.fromJsonString(GateOrderHandoff, { space: 2 }))(handoff)}\n` ``: the
installed `fromJsonString(schema, { reviver?, replacer?, space? })` passes `space` to
`JSON.stringify` on encode (`node_modules/effect/src/Schema.ts:9198-9206`, same signature in the
reference at `:9459`), and `S.encodeEffect` is at installed `Schema.ts:1908`. Options encode as `null`,
keys follow field declaration order, and the trailing `"\n"` is appended by the caller. Only the
fixture computes these bytes (§3 fixture 4), so the helper is test-local and nothing else is exported.

`GateOrderHandoffCoherence` is declared before the class, over structure only, in the form of
`YeetMergeReadyCoherenceCheck` (`packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts:338-367`):

```ts
const issueUnless = (holds: boolean, path: ReadonlyArray<PropertyKey>, issue: string) =>
  holds ? O.none() : O.some({ path, issue });

const GateOrderHandoffCoherence = S.makeFilter(
  (value: {
    readonly source: GateOrderHandoffSource;
    readonly seed: GateOrderSeed;
    readonly lanes: ReadonlyArray<GateOrderHandoffLane>;
  }) => {
    const laneIds = HashSet.fromIterable(A.map(value.lanes, (lane) => lane.laneId));
    const seedIds = HashSet.fromIterable(A.map(value.seed.lanes, (row) => row.laneId));
    const declarationIndexes = HashSet.fromIterable(A.map(value.lanes, (lane) => lane.declarationIndex));
    const seedRows = HashMap.fromIterable(A.map(value.seed.lanes, (row) => [row.laneId, row] as const));
    const isExternal = (lane: GateOrderHandoffLane) => GateOrderCostBasis.is["external-run"](lane.costBasis);
    const hasExactFirstRed = (lane: GateOrderHandoffLane) =>
      O.exists(
        O.flatMap(HashMap.get(seedRows, lane.laneId), (row) => classifyGateOrderPointer(row.firstRedPointer)),
        ([kind]) => kind === "first-failure-row"
      );
    return A.getSomes([
      issueUnless(A.every(value.lanes, (lane, index) => lane.rank === index), ["lanes"], "Lane ranks must be 0..n-1 in array order."),
      issueUnless(HashSet.size(laneIds) === value.lanes.length, ["lanes"], "Lane ids must be unique."),
      issueUnless(HashSet.size(declarationIndexes) === value.lanes.length, ["lanes"], "Declaration indexes must be unique."),
      issueUnless(A.every(value.lanes, (lane) => O.isNone(lane.decidedBy) === (lane.rank === 0)), ["lanes"], "decidedBy is None exactly at rank 0."),
      issueUnless(
        A.every(value.lanes, (lane) => O.isNone(lane.durationSourceKey) === GateOrderCostBasis.is["external-run"](lane.costBasis)),
        ["lanes"],
        "A lane has no resolved A1 duration row exactly when its cost basis is external-run."
      ),
      issueUnless(
        HashSet.size(seedIds) === value.seed.lanes.length && Equal.equals(laneIds, seedIds),
        ["seed", "lanes"],
        "Every lane has exactly one seed row by laneId and every seed row names a lane."
      ),
      issueUnless(
        A.every(value.lanes, (lane) =>
          O.isNone(lane.durationP50Ms) === isExternal(lane) && O.isNone(lane.durationP95Ms) === isExternal(lane)
        ),
        ["lanes"],
        "A lane has no resolved A1 P50 or P95 exactly when its cost basis is external-run."
      ),
      issueUnless(
        A.every(value.lanes, (lane) => O.isSome(lane.firstRedSourceLane) === hasExactFirstRed(lane)),
        ["lanes"],
        "A lane carries a resolved A1 first-red lane exactly when its seed row points at an exact actionableLaneMix row."
      ),
      issueUnless(
        value.source.measurementAsOf === value.seed.measurementAsOf,
        ["source", "measurementAsOf"],
        "The source and the seed carry the same A1 measurementAsOf."
      ),
      issueUnless(
        value.source.firstFailurePopulation === value.seed.firstFailurePopulation,
        ["source", "firstFailurePopulation"],
        "The source and the seed carry the same first-failure population."
      ),
      issueUnless(
        value.source.reference.path === value.seed.sourcePath,
        ["source", "reference", "path"],
        "The source reference names the file the seed's pointers resolve in."
      ),
    ]);
  },
  {
    identifier: $I`GateOrderHandoffCoherence`,
    title: "Gate-order handoff coherence",
    description: "Ranks, ids, deciding keys, resolved-source presence, source-seed agreement and the seed-to-lane bijection of a gate-order handoff.",
  }
);
```

`GateOrderHandoffCoherence` references `GateOrderHandoffSource`, `GateOrderHandoffLane` and
`classifyGateOrderPointer`, so it is declared after them and before `GateOrderHandoff`.

Why the checked struct stays a struct inside `S.Class` (reference lines; installed rc.117 lines in
brackets): `Schema.Class` keeps its argument when `isStruct(schema)` holds and wraps it in
`Struct(schema)` only otherwise (`Schema.ts:14963` [`:14906`]), and `isStruct` is `isSchema`
(`Schema.ts:14875-14877` [`:14614-14616`]), true for any schema value. `S.check` returns
`self.check(...)` (`:5006` [`:4954-4958`]), which rebuilds through `make(ast, options)` with the same
`options` object (`internal/schema/make.ts:20-21`, `:38` [`:20-22`, `:38`]), so the checked struct
keeps the `fields` that `makeStruct` passes to `make` (`Schema.ts:3405-3407` [`:3353-3355`]) and the
class decodes through the checked AST.
`YeetMergeReady` (`Verdict.ts:477-487`) already ships this exact form in repo-cli, and fixture 7's
decode must-fails prove it for `GateOrderHandoff`. An empty issue array passes
(`SchemaIssue.ts:1069-1078`, the non-empty test at `:1076`). Whether the order agrees with the key is
a fixture, not a filter (the filter would import `WaveOrder.ts` and make a cycle).

JSDoc **Gotchas** on `GateOrderHandoff` and `GateOrderSeedRow.redProbability`: the value is an A1
actionable-lane count over 832 reconstructable first failures while the counts span 1610 red
attempts; it is a rank weight, not P(red). Precision never decides an adjacency on today's seed; it
sets `redScheduling`. `scope` is non-main only. An `external-run` lane's cost is not checked against
A1.

Effect v4 APIs relied on, checked against the reference checkout
(`$HOME/YeeBois/references/effect/effect` @3495bd8858 through the primary clone's `.repos/effect`
symlink; the worktree has no `.repos`) and against the installed `effect` 4.0.0-rc.117 that the
implementer compiles against (`node_modules/effect/src/…`, whose line numbers differ). Reference line
first, installed line in brackets: `S.Class` (`Schema.ts:14947` [`:14686`]), `S.Literal` (`:2639`
[`:2639`]), `S.makeFilter` (`:6507` [`:6455`]; `FilterOutput` `:6558` [`:6506`]), `S.check`
(`:5006` [`:4954`]), `S.OptionFromNullOr` (`:13822` [`:13561`]), `S.fromJsonString` with `space`
(`:9459` [`:9198-9206`]), `S.encodeEffect` (`:1908` [`:1908`]), `S.decodeEffect` (`:1503` [`:1503`]),
`S.toEquivalence` (`:15229` [`:15421-15423`]; the class declaration's `toEquivalence` annotation
delegates to its struct, `:14864` [`:14603`]), `S.Int` (`:7652` [`:7581`]), `S.NonEmptyString`
(`:8816` [`:8555`]), `S.Finite` (`:7168` [`:7097`]), `Order.combineAll` (`Order.ts:400` [`:484`],
takes an `Iterable<Order<A>>`), `Order.mapInput` (`:446` [`:530`]), `Order.flip` (`:269` [`:269`]),
`Tuple.get` (`Tuple.ts:75` [`:75`], dual), `HashSet.fromIterable` (`HashSet.ts:170` [`:170`]),
`HashSet.size` (`:316` [`:510`]), `HashSet` structural `Equal` (`internal/hashSet.ts:32` [`:30`]),
`Equal.equals` (`Equal.ts:173-175` [`:172-174`]), `HashMap.fromIterable` (`HashMap.ts:284`
[`:322`]), `HashMap.get` (`:327` [`:365`]), `Array.every` with index (`Array.ts:4231-4236`
[`:8660`]), `Array.getSomes` (`:3693` [`:7743`]), `Array.findFirst` with an `Option`-returning
function, data-first (`:1741` [`:3387`]), `Option.fromNullishOr` (`Option.ts:773` [`:1070`]),
`Option.map` (`:1090` [`:1453`]), `Option.flatMap` (`:1218` [`:1685`]), `Option.exists` (`:2156`
[`:3855`]), `Effect.promise` (`Effect.ts:892` [`:1330`]), filter-output normalization
(`SchemaIssue.ts:1069-1078` [`:1069-1084`, non-empty test `:1076`]), excess-key stripping
(`SchemaAST.ts:463` [`:463`]). v4 has no `Tuple.getSecond`; do not write it.

## 2. Service contract — no new `Context.Service`

There is no runtime reader, so there is no new service, layer, error class or command. `planEpisode`
is an unconditional stub and repo-cli may not call the lab (§0.6). The handoff is data produced by
pure functions; the invariants live in the fixture, the only repo-cli reader.

`WaveOrder` (`WaveOrder.ts:401-431`) keeps its shape `{ order }`, its `make(seed)` and its
`static Default = Layer.effect(WaveOrder, WaveOrder.make(DEFAULT_GATE_ORDER_SEED))`. Its callers
(`Quality.command.ts:808-810`, `:1019`; `quality-tasks.test.ts:1719-1779`) are untouched.

Changes, all pure and behavior-preserving except the one new seed row:

- **Keyed order table (`WaveOrder.ts:330-351`).** `indexedLaneOrder` becomes
  `WAVE_ORDER_KEYS: ReadonlyArray<readonly [GateOrderSortKey, Order.Order<IndexedLane>]>` holding the
  same six `Order.mapInput` orders in the same sequence, and
  `indexedLaneOrder = Order.combineAll(A.map(WAVE_ORDER_KEYS, Tuple.get(1)))` (if the data-last form
  cannot infer the tuple type inside `A.map`, write `(entry) => Tuple.get(entry, 1)`). One table
  drives both the sort and the explanation; the comparator is never duplicated.
- **`rankWaveLanes`** (dual, like `orderWaveLanes`): the same `HashMap` enrichment and `A.sort`,
  returning `{ rank, declarationIndex, decidedBy, lane }` where `decidedBy` is None at rank 0 and
  otherwise the first key in `WAVE_ORDER_KEYS` whose order compares the predecessor and the lane as
  non-equal (`A.findFirst`). `orderWaveLanes = (seed, lanes) => A.map(rankWaveLanes(seed, lanes), (r) => r.lane)`.
- **`redSchedulingDecision`** (`Tasks.ts:1882-1892`) gains `export` and titled JSDoc; the body does
  not move. It reaches tests through `src/test/Quality.test-kit.ts:58` (`export * from Tasks`).
  `WaveOrder.ts` gains the explicit import `import { redSchedulingDecision } from
  "../../Quality/Tasks.ts";` beside its `Quality.schemas.ts` import (`WaveOrder.ts:15-21`). No cycle:
  the only modules importing `WaveOrder.ts` are `Quality.command.ts`, `Planner.ts` and
  `src/test/Yeet.test-kit.ts`, and `Tasks.ts`'s import block imports none of them and no `Yeet`
  module.
- **`githubCheckPrePushLanes(repoRoot, changesetStatusLanes)`** is exported from `GithubChecks.ts` and
  returns `[...changesetStatusLanes, ...repoSanity, ...quality, ...fallow, ...prePushExternal]`.
  `Planner.ts:413-421` (`proofLanesForTier`, `full`) calls it. It is added to the named export list
  in `src/test/Quality.test-kit.ts:64-69`, which re-exports `GithubChecks.ts` by name, not by `*`.
  `Quality.command.ts:1008-1019` stays as it is in this PR (see Stays out); the duplication is
  recorded as a receipt.
- **Seed row.** `DEFAULT_GATE_ORDER_SEED` gains, after the repo-sanity rows (after `:188`), a
  `GateOrderSeedRow.make` row: `laneId "quality:cache-policy"`, `costP50Seconds 183`,
  `durationPointer hostedDurationPointer(7)`, `durationBasis "A1 hosted Repo Sanity aggregate P50
  proxy; the lane joined the group on 2026-09-10 (#1068), after the A1 window."`, `redProbability 0`,
  `firstRedPointer NO_EXACT_FIRST_RED_POINTER`, `firstRedBasis POSTDATES_A1_FIRST_RED_BASIS`,
  `precision "precise"` with `PRECISE_BASIS`, `laneClass "policy-preflight"` with
  `POLICY_PREFLIGHT_BASIS`. This row is the one behavior change, and it reaches the runtime as well
  as the plan: `beep quality github-checks pre-push` orders its lanes through `WaveOrder.Default`
  (`Quality.command.ts:808-810`, `:1019`), which is built from the same `DEFAULT_GATE_ORDER_SEED`,
  so the runtime also moves `quality:cache-policy` from rank 31 to rank 19, and under fail-fast a
  red there (stop-after-red, as when it was unseeded) now records `quality:build` and the eleven
  heavy lanes after it, through `quality:coverage`, as `not-run-early-stop`, where before it ran
  last and stopped nothing.
- **Postdating bases.** A new constant beside `NO_EXACT_FIRST_RED_BASIS` (`WaveOrder.ts:28`):
  `POSTDATES_A1_FIRST_RED_BASIS = "The lane postdates the A1 window; the share is 0 by absence, not by
  observation."`, and a pure `postdatesA1Window(row) => GateOrderSeedRow.make({ ...row, firstRedBasis:
  POSTDATES_A1_FIRST_RED_BASIS })` (the spread-into-`make` form the existing seed tests use,
  `quality-tasks.test.ts:1730`). It wraps the `fallow:health` (`WaveOrder.ts:278-289`),
  `quality:doctest` (`:222`), `quality:storybook` (`:237-248`) and `repo-sanity:config-typecheck`
  (`:187`) rows; only
  their `firstRedBasis` changes. No test pins the old text (`rg 'zero of 832' packages/tooling/tool/cli`
  finds only `WaveOrder.ts:28`). The `DEFAULT_GATE_ORDER_SEED`
  **Details** say every pointer except `quality:storybook`'s `/hosted/laneRows` sentinel is
  fixture-verified, including which A1 row it resolves to, and that storybook's 584 s is one external
  run (`WaveOrder.ts:241`).
- **`DEFAULT_GATE_ORDER_COST_SOURCES`** in `WaveOrder.ts` beside the seed, one
  `GateOrderCostSource.make` per seed row (32), exported through `Yeet.test-kit.ts:91`:
  - `a1-lane-row` (16): `quality:lint` "Lint", `quality:lint-policy` "Heavy / Lint Policy",
    `quality:check` "Heavy / Check", `quality:knip` "Knip", `quality:docgen` "Heavy / Docgen",
    `quality:doctest` "Heavy / Doctest", `quality:coverage` "Heavy / Coverage Regression",
    `quality:codegen` "Codegen Drift", `quality:commitlint` "Commitlint", `quality:desktop-ipc`
    "Professional Desktop IPC Stdio", `quality:test-unit` "Test Unit", `quality:test-integration`
    "Heavy / Test Integration", `quality:secrets` "Secret Scanning", `quality:security` "Security",
    `quality:sast` "SAST", `quality:nix` "Nix Shell";
  - `a1-proxy-row` (15): `quality:changeset-status` "full:00-cheap-gates"; the eight `repo-sanity:*`
    rows and `quality:cache-policy` "Repo Sanity"; `quality:build` "feedback:01-build";
    `quality:jsdoc-ratchet` "Heavy / Doctest"; `fallow:audit`, `fallow:dead-code`, `fallow:health`
    "advisory:01-fallow-feedback";
  - `external-run` (1): `quality:storybook`, source key None.
  Every source key above is the `context` or `id` the 2026-09-25 pointer probe resolved. The
  `hostedRow` basis constant (`WaveOrder.ts:27`) is not reworded; the cost source is where a proxy is
  named.
- **`GATE_ORDER_SOURCE`** in `WaveOrder.ts` beside `ECONOMICS_SOURCE_PATH` (`:24`):
  `CacheEvidenceReference.make({ path: ECONOMICS_SOURCE_PATH, sha256: "37e854ef859c00e4930cb1b23cfba5989a2947c121a9f0bc88c30e2fc2785230" })`
  (`sha256sum` of the committed file at d9f74d230a).
- **Pure folds in `WaveOrder.ts`** (the fixture surface; reach tests through `Yeet.test-kit.ts:91`
  `export * from WaveOrder`). `classifyGateOrderPointer` is not here: it sits in `Quality.schemas.ts`
  beside `GateOrderPointerKind` (§1) because the coherence filter needs it too.
  - `gateOrderSeedFindings(seed, costSources, declaredLanes, view: EconomicsSeedSourceView): ReadonlyArray<GateOrderSeedFinding>`.
    Seed rows and cost sources are looked up by `laneId` through `HashMap`, never by index.
    Coverage first (unseeded / orphan, via `HashSet`); every later check runs only over rows that name
    a declared lane, and each check runs only when its inputs resolved, so an unresolved or unknown
    pointer yields only its own finding. A `durationPointer` must classify as `hosted-lane-row`,
    `hosted-lane-array` or `local-wrapper-row`, and a `firstRedPointer` as `first-failure-row` or
    `first-failure-absent`; `O.none()` or a kind in the wrong slot is `pointer-shape-unknown`. A
    row kind whose index is past its array's end is `duration-unresolved` / `red-unresolved`. Then:
    cost-source coverage (`cost-basis-unmapped` for a seeded lane without an entry or an entry naming
    no seed row); lane class against `GithubCheckLaneSpec.wave` (`lane-class-wave-mismatch`);
    durations (`Math.round(costP50Seconds*1000)` against `p50DurationMs`); duration source (the
    resolved row's `context` or `id` equals the entry's `sourceKey`, and a `hosted-lane-array`
    pointer pairs with an `external-run` entry and nothing else, else `duration-source-mismatch`;
    when the `sourceKey` names more than one row of the array the pointer indexes,
    `duration-source-ambiguous`); red (`Math.round(redProbability*seed.firstFailurePopulation)`
    against `.attempts`, the seed's own denominator; `first-failure-absent` requires
    `redProbability === 0`; `first-failure-row` requires `.lane` to equal the lane id or its
    ruling-28 alias `pre-push:<suffix>`); population (`seed.firstFailurePopulation` against
    `view.firstFailure.attemptsWithReconstructableOuterFailure`, `population-mismatch`); red attempts
    (`redAttempts` equals the mix sum); and `measurementAsOf`.
  - `gateOrderHandoff(seed, costSources, declaredLanes, source: GateOrderHandoffSource, view): GateOrderHandoff`
    — `rankWaveLanes`, then per lane `redSchedulingDecision(lane.orderEstimate)`, the cost source,
    the resolved duration row's key, P50 and P95, and `firstRedSourceLane`.

## 3. Must-have fixtures (`packages/tooling/tool/cli/test/gate-order-handoff.test.ts`, effect-vitest)

Test shape: `it.effect(name, Effect.fnUntraced(function* () { … }, provideScopedLayer(NodeServices.layer)))`,
imports `provideScopedLayer` from `@beep/test-utils` and `NodeServices` from `@effect/platform-node`
(precedent `packages/tooling/tool/cli/test/ci-runner-security.test.ts:2`, `:4`, `:263-297`). Schemas
import from `@beep/repo-cli/commands/Quality` (barrel `commands/Quality/index.ts:56` is
`export * from "./Quality.schemas.ts"`); folds and constants from `@beep/repo-cli/test/Yeet`;
`githubCheckPrePushLanes` and `redSchedulingDecision` from `@beep/repo-cli/test/Quality`.

Repo root: `findRepoRoot()` from `@beep/repo-utils/Root` (`packages/tooling/library/repo-utils/src/Root.ts:46-74`),
which walks up from `process.cwd()` to the first directory holding `.git` or `bun.lock` (`:21`). Under
Turbo the cwd is `packages/tooling/tool/cli`; in a linked worktree `.git` is a file and `fs.exists`
still finds it. It needs only the `FileSystem` service, so it resolves the same root on Node and on
Bun; precedent `ci-runner-security.test.ts:1`, `:185` and `yeet.test.ts:143`, `:3855`. Committed files
are read as `path.join(repoRoot, "goals/time-to-certainty/research/<file>")` with `FileSystem`; the
digest uses `S.decodeEffect(Sha256HexFromBytes)` (`packages/foundation/modeling/schema/src/Sha256.ts:113`).
`declaredLanes = githubCheckPrePushLanes("/repo", [githubCheckChangesetStatusLane("/repo")])`.

1. **Seed coverage (must-fail).** `gateOrderSeedFindings(DEFAULT_GATE_ORDER_SEED, DEFAULT_GATE_ORDER_COST_SOURCES, declaredLanes, view)`
   has no `unseeded-lane`, `orphan-seed-row`, `cost-basis-unmapped` or `lane-class-wave-mismatch`.
   The pre-D1 seed (the `quality:cache-policy` seed row and cost-source entry filtered out) yields
   exactly one `unseeded-lane` for it. A seed with an extra row copied from `repo-sanity:versions` and
   renamed `quality:retired` (pointers `/hosted/laneRows/7/p50DurationMs` and
   `/firstFailure/actionableLaneMix`, cost 183, share 0) yields exactly one `orphan-seed-row`, because
   no later check runs over a row that names no declared lane. The coverage assertion's message is:
   `gate-order seed does not cover the pre-push plan (unseeded: <ids>; orphan: <ids>). Add a
   DEFAULT_GATE_ORDER_SEED row and a DEFAULT_GATE_ORDER_COST_SOURCES entry in
   packages/tooling/tool/cli/src/commands/Yeet/internal/WaveOrder.ts under the ruling 76 seeding rule
   (goals/time-to-certainty/research/decisions.md, round 24), then rerun this file once with vitest -u,
   which writes goals/time-to-certainty/research/gate-order-handoff.json when the run ends, and once
   without -u, which must pass; review the handoff diff.`
2. **Pointer agreement (must-fail).** Against the committed `economics.json` the default seed has zero
   findings of any kind. Must-fail, one finding each on a copy of the seed, the cost sources or the
   view: `quality:lint` cost 268 → `duration-mismatch`; `quality:lint` pointed at
   `/hosted/laneRows/17/p50DurationMs` (past the array end) → `duration-unresolved`;
   `/hosted/laneRows/7/p95DurationMs` → `pointer-shape-unknown`; `quality:jsdoc-ratchet` pointed at
   `/hosted/laneRows/13/p50DurationMs` (`"SAST"`, also 82 000 ms) → `duration-source-mismatch`;
   `quality:storybook`'s cost source with basis `a1-lane-row` and key `"SAST"` →
   `duration-source-mismatch`; an absent-red row with `redProbability 1/832` → `absent-red-nonzero`;
   `quality:security` pointed at `[26]` (`cheap-gates:knip`, 5 attempts, the same count as `[27]`) →
   `red-lane-mismatch`; a view whose `attemptsWithReconstructableOuterFailure` is 833 →
   `population-mismatch` (the red check multiplies by the seed's 832, so no red finding joins it,
   whatever the rounding); a view whose `redAttempts` is 1611 → `red-attempts-mismatch`;
   `quality:knip` with `laneClass "heavy"` → `lane-class-wave-mismatch`; `quality:build` re-pointed
   at `/localWrapperLanes/13/p50DurationMs` with cost 5.455 and cost-source key
   `publish:00-head-install-preflight` (the value and the id both match row 13, but the id also names
   rows 14 and 21) → `duration-source-ambiguous`.
3. **Source pin (must-fail).** The sha256 of the committed `economics.json` bytes equals
   `GATE_ORDER_SOURCE.sha256`; a one-byte-changed copy does not.
4. **Handoff freshness (must-fail).** The order of steps inside this test is part of the contract.
   (a) Compute
   `computed = gateOrderHandoff(DEFAULT_GATE_ORDER_SEED, DEFAULT_GATE_ORDER_COST_SOURCES, declaredLanes, source, view)`
   and ``bytes = `${yield* S.encodeEffect(S.fromJsonString(GateOrderHandoff, { space: 2 }))(computed)}\n` ``
   (the §1 canonical encoding, a test-local helper). (b) The first assertion, before anything reads
   the committed file, is the byte snapshot:
   `yield* Effect.promise(() => expect(bytes).toMatchFileSnapshot(handoffPath))`, where `handoffPath`
   is the absolute `path.join(repoRoot, "goals/time-to-certainty/research/gate-order-handoff.json")`
   and `expect` comes from `@effect/vitest`, which re-exports `vitest`
   (`node_modules/@effect/vitest/dist/index.d.ts:14`). (c) The value check is a round trip of the
   computed `bytes`, not a read of the file: `decoded = yield* GateOrderHandoffJson.decode(bytes)`,
   then `expect(S.toEquivalence(GateOrderHandoff)(decoded, computed)).toBe(true)`. The class's
   declaration annotation hands `toEquivalence` its struct's equivalence (installed
   `Schema.ts:14603`, `:15421-15423`), and `Option` fields compare by tag and value
   (`internal/schema/toEquivalence.ts:169-172`); `toEqual` on the two `S.Class` instances is not used.
   The fixture never reads or decodes the committed file. The byte snapshot alone guards it; since
   the file's bytes equal `bytes` and `bytes` decodes back to `computed`, the committed file decodes
   to the computed value too.
   Why this order: the installed vitest 5.0.1 does not write a file snapshot during the test.
   `_addSnapshot` only pushes the raw snapshot onto `this._rawSnapshots`
   (`node_modules/vitest/dist/chunks/index.m3L2HgmY.js:518-521`), and `save()` writes the queue
   through `saveRawSnapshots` (`:360-364`, `:620-635`) from `pack()` (`:744`, `:758`) when the
   test file's run ends (`finish`, `:797-800`, called at `:8452`). Inside a `-u` run, then, a
   `FileSystem` read of `handoffPath` still returns the old bytes, or fails with NoSuchFile on
   bootstrap, so a `-u` run cannot also check the file it is about to write. An assertion on the
   committed file placed before the matcher would throw (stale) or fail its read (missing) before
   any raw snapshot was queued, and `-u` would never write the file. A committed-file decode placed
   after the matcher would report the stale value once in the `-u` run and pass only on the next run.
   Matcher facts: in the installed vitest 5.0.1 the matcher is
   `toMatchFileSnapshot(filepath, hint?) => Promise<void>`
   (`node_modules/vitest/dist/chunks/task-utils.d.BZm4GSQD.d.ts:78`); an absolute path is used as
   given (`node_modules/vitest/dist/chunks/node.CfQ_OGWr.js:16-18`); a string is compared byte for
   byte with no trim (`index.m3L2HgmY.js:681-689`). The test calls the matcher once for
   `handoffPath`: `saveRawSnapshots` writes every queued raw snapshot under `Promise.all`
   (`:360-364`), so a second call on the same path in a `-u` run would race two writes.
   On mismatch vitest prints the diff. Bootstrap and regeneration are two runs from
   `packages/tooling/tool/cli` (via `zsh -ic`): `bunx vitest run test/gate-order-handoff.test.ts -u`,
   which queues `bytes` and writes the file when the file's run ends, then the same command without
   `-u`, which must pass against the file now on disk; the author reviews the diff and commits it.
   This is a test-runner flag, not a repo-cli writer. Without `-u` a mismatch never rewrites the
   file; with `CI` set vitest does not write a missing snapshot either. No repo test uses a file
   snapshot today (`rg toMatchFileSnapshot packages` is empty), so this is the first; a comment
   above the assertion names the two runs. Must-fail, without the matcher and without the file: the
   bytes computed from a seed with `quality:lint` `costP50Seconds 266`, or from a source whose sha256
   is the empty-input digest, differ from `bytes` (`expect(altered).not.toBe(bytes)`), so either
   change would fail the snapshot.
5. **Order agreement.** In this file, `handoff.lanes` laneIds equal
   `A.map(orderWaveLanes(DEFAULT_GATE_ORDER_SEED, declaredLanes), (lane) => lane.id)`, and for every
   adjacent pair the keys before `decidedBy` compare equal and `decidedBy`'s order compares strictly
   less. The plan half lives in `yeet.test.ts` (fixture 8), because the `RepoRunContext` that
   `buildYeetRunPlanForTesting` (`src/commands/Yeet/internal/Handler.ts:2260`) needs is built by
   file-local helpers there (`turboTask` `:395`, `turboPackagesFromTasks` `:418`, `turboSnapshot`
   `:426`, `contextWithTasks` `:438`, `context` `:453`), none exported. Both halves compare with the
   same pure `orderWaveLanes` ids, so plan rendering (`Planner.ts:431`) and the handoff cannot
   diverge.
6. **Census.** On the default seed the `decidedBy` counts are exactly
   `{cost-p50: 19, first-red-share: 6, declaration-index: 5, lane-class: 1}` with no `seeded` or
   `precision`; `redScheduling` is `continue-after-imprecise-red` for exactly `quality:coverage`,
   `quality:security`, `quality:sast`, `quality:nix` and `stop-after-red` for the other 28; and the
   `costBasis` counts are exactly `{a1-lane-row: 16, a1-proxy-row: 15, external-run: 1}`; and
   exactly `fallow:health`, `quality:doctest`, `quality:storybook`, `repo-sanity:config-typecheck` and
   `quality:cache-policy` carry `POSTDATES_A1_FIRST_RED_BASIS`.
7. **Schema boundary (must-fail).** `GateOrderHandoffJson` round-trips the default handoff. Decode
   rejects `schemaVersion "gate-order-handoff/v0"`, `scope "pre-push:main"`, a source sha256 `"XYZ"`,
   a rank gap (0, 2), a duplicate lane id, `decidedBy` set at rank 0, `decidedBy` null at rank 1, a
   lane id with no seed row, and an `external-run` lane carrying a `durationSourceKey`; and, one
   must-fail per added filter check: `quality:storybook` carrying `durationP50Ms` 584000; `quality:lint`
   with `durationP95Ms` null; `quality:lint` with `firstRedSourceLane` null (its seed row points at
   `actionableLaneMix/6`); `quality:docgen` with `firstRedSourceLane` `"quality:docgen"` (its seed row
   points at the absent sentinel); `source.measurementAsOf` `"2026-09-04T00:00:00.000Z"`;
   `source.firstFailurePopulation` 833; `source.reference.path` `"research/economics.json"`.
8. **Order pin update (`yeet.test.ts:801-834`).** `quality:cache-policy` moves from the tail (`:833`)
   to index 19, between `repo-sanity:config-typecheck` and `quality:build`; the other 31 lanes keep
   their relative order. Beside the literal pin, where `context` (`:453`) is in scope, the same
   flattened `full:pre-push` laneIds also equal
   `A.map(orderWaveLanes(DEFAULT_GATE_ORDER_SEED, githubCheckPrePushLanes("/repo", [githubCheckChangesetStatusLane("/repo")])), (lane) => lane.id)`;
   the new names come in through the file's existing `@beep/repo-cli/test/Yeet` (`:21-142`) and
   `@beep/repo-cli/test/Quality` (`:1-8`) imports. This is the plan half of fixture 5.
9. **Existing, kept green unchanged:** `quality-tasks.test.ts:1719-1779` (seed-change must-fail,
   policy-before-heavy, precise-before-imprecise tie). It is the proof that the keyed-table refactor
   preserves behavior.

## 4. Gates before handoff (from the lane, `zsh -ic`) and packet bookkeeping

Code gates: `bunx turbo run check --filter=@beep/repo-cli`; `bunx vitest run` on
`gate-order-handoff.test.ts`, `yeet.test.ts` and `quality-tasks.test.ts`;
`bun run beep lint effect-vitest --write` (eight inventory rows for the new test file at b14139a476:
seven open `EV002` `unresolved-layer-provide` rows, one per `it.effect` that wraps its own
`provideScopedLayer(NodeServices.layer)` as the §3 test shape prescribes, and one `EV010` row for
the `@effect/platform-node` import; plus re-anchored `yeet.test.ts` lines; review that the diff
touches only those); the JSDoc ratchet at zero introduced
(new exports: the literal kits, the classes, `DEFAULT_GATE_ORDER_COST_SOURCES`, `GATE_ORDER_SOURCE`,
`rankWaveLanes`, `redSchedulingDecision`, `githubCheckPrePushLanes`, the folds);
`bunx biome check <touched files>`; `bun run beep quality package-verify @beep/repo-cli`;
`bun run beep ci lane fallow --base origin/main`, the lane the hosted `Fallow Advisory Envelopes`
job runs: despite the job's name its audit, dead-code and health sub-lanes are blocking
(`FALLOW_BLOCKING_LANES` in `commands/Ci/CiLane.ts`), and at f0219b5d61 an introduced
cognitive-complexity finding in the new test file failed it (hosted run 36171449800, fixed in
d6f8fc5e48); `bun run lint:oxlint`, a policy-state step of `quality:lint-policy`
(`policyStateTasks` in `Tasks.ts`) that the hosted `Heavy / Lint Policy` lane runs only once
`ready-for-heavy` is applied, so the local run is its first signal. No new
source file, so no hand-spliced coverage row is expected; if the hosted coverage lane still reports a
lowered row, splice the hosted measured row by hand (precedent 71a11ae563).
`packages/tooling/tool/cli/turbo.json` gains
`"$TURBO_ROOT$/goals/time-to-certainty/research/economics.json"` and
`"$TURBO_ROOT$/goals/time-to-certainty/research/gate-order-handoff.json"` in both `test.inputs` and
`test:property.inputs` (ruling 78; precedent `packages/tooling/policy-pack/repo-configs/turbo.json:6-10`),
followed by a reviewed `bun run beep cache baseline --request <json>` re-record of
`standards/cache-qualification-baseline.json` (`packages/tooling/tool/cli/src/commands/Cache/Cache.command.ts:688-697`,
which decodes the file with `JsonStringCodec(CacheBaselineRequest)`; path at
`commands/Cache/Cache.service.ts:48`). The request file stays outside the repo and is not committed.
Its body is a `CacheBaselineRequest` (`commands/Cache/Cache.schemas.ts:701-710`; `review` is a
`CacheReviewDecision`, `packages/tooling/policy-pack/repo-configs/src/cache/Cache.governance.policy.ts:38-39`):

```json
{
  "review": {
    "reviewer": "time-to-certainty D1 implementer",
    "reason": "Declare the two goals/time-to-certainty/research JSON files the repo-cli gate-order fixture reads as test and test:property inputs.",
    "basis": {
      "path": "goals/time-to-certainty/research/d1-cache-review.md",
      "sha256": "<sha256sum of d1-cache-review.md>"
    }
  },
  "scope": ["@beep/identity#lint", "@beep/types#lint", "@beep/fc-runs#lint", "@beep/test-runner#lint"],
  "profile": "local-linux-x64-bun1.4.2",
  "epoch": "qualification-v2",
  "previous": "<sha256sum of standards/cache-qualification-baseline.json just before the re-record>"
}
```

`scope`, `profile` and `epoch` are copied from the baseline as it stands at re-record time (the
values above are main's at 5488de57c7, the lane's latest `origin/main` merge, whose baseline digest
is `c0c04efe7c1e3f42454d915de6409b9e78e414213053bb60ff8d79d102b1f85c`; at d9f74d230a the scope held
only the first two entries and the digest was
`bd8649cc4cdaf393ae5f5ec4e198c7e01fc8204adb94d98005747479bb8b6f5a`).
`previous` is compared with the digest of the current baseline text and a mismatch refuses the write
(`Cache.service.ts:281-288`). The basis is a new dedicated review note, not this contract: every
baseline load re-verifies the basis bytes (`Cache.service.ts:100-101` → `verifyReference` `:83-89`
→ digest check `commands/Cache/Cache.evidence.ts:116-117`), so the basis file must never change
after the re-record, and this note will (§8 re-anchoring). Precedent: the current basis
`goals/effect-vitest-canon/research/wave-b-cache-review.md`. The review note says what changed (two
named inputs on `@beep/repo-cli#test` and `#test:property`), why (§0.12), and why it is not blanket
key tuning (ruling 78); it names no `bun run beep` span. Every later re-record reuses it unchanged;
only `previous` changes. That `turbo.json` is one of the baseline's `projection.sources`, which is
why the edit forces the re-record.

Stale-baseline order after every merge of `origin/main` into the lane (no force push), in this
order, because each step's output feeds the next:

1. `bunx vitest run test/gate-order-handoff.test.ts` from `packages/tooling/tool/cli`. If main added,
   removed or re-declared a pre-push lane or changed `economics.json`, fix the seed and cost sources
   first (fixtures 1–3), then regenerate the handoff with one `-u` run followed by a plain run that
   must pass (fixture 4), and review its diff.
2. `bun run beep lint effect-vitest --write`, since the merge and step 1 move test lines; review that
   the diff only re-anchors. When the merge brought another lane's new test files (for example
   `yeet-pr-events-slice-1`, §8), this regenerates `standards/effect-vitest.inventory.jsonc` instead
   of hand-resolving its conflict.
3. `bun run beep quality jsdoc-ratchet --write-baseline`, only when the ratchet reports lowered rows
   inherited from main (the command at
   `packages/tooling/tool/cli/src/commands/Quality/Quality.command.ts:3506`, the flag at `:3516`).
   The hosted `jsdoc-ratchet` job checks out with no `ref` under `on: pull_request`
   (`.github/workflows/check.yml:3-4`, `:877-882`), so it runs on the PR merge ref that
   `actions/checkout` defaults to for that event, not on the branch head.
4. The `bun run beep cache baseline --request <json>` re-record last, since it digests the turbo
   inputs and config that steps 1–3 may change; then `bun run beep quality cache-policy` must pass
   (the lane's command, `GithubChecks.ts:561-567`).
5. At the final head only, recompute the handoff sha256 cited by both ontology receipts.

Placeholders. `2026-09-2X` (decisions heading, SPEC parenthetical, PLAN lines, GOAL.md Status,
manifest `statusNote`, ontology receipt and Trail line) and `<digest>` / `<final-head digest>` are
filled by the implementer in the PR's last commit before merge-ready: the date is that commit's UTC
date, the digest is the `sha256sum` of `goals/time-to-certainty/research/gate-order-handoff.json` at
that commit (step 5). A later push that changes the handoff recomputes both in the same push. After
the merge neither is edited; receipts are dated history.

Doc gates: `knowledge semantic-delta` (no new `bun run beep` span in live Markdown; the SPEC.md
parenthetical and PLAN lines name none; this note sits under `research/`, which is archival),
`knowledge refs --check` (host paths as `$HOME/…`), `goals doctor`,
`jq . goals/time-to-certainty/ops/manifest.json`, GOAL.md at or under 4000 characters (3635 now),
`git diff --check`.

Bookkeeping in the same PR:

- `goals/time-to-certainty/research/decisions.md`, appended after `:1047`: `## 2026-09-2X — SPEC D1
  ordering handoff, round 24 (four rulings, proposed by the orchestrator; the merge of this PR is the
  lock)`, then §6 below verbatim (its Context paragraph carries the numbering and the D-id
  disambiguation).
- `SPEC.md:164-166` (D1) gains one dated parenthetical after "S8/S9 stages":
  `(landed 2026-09-2X as a committed input document for the ontology packet's S7-v2 planEpisode seam,
  rulings 76–79)` — the form of `SPEC.md:150-151`.
- `PLAN.md:184-185` → `- [x] D1 … — done 2026-09-2X (rulings 76–79): …`, naming only
  `research/gate-order-handoff.json` and no `bun run beep` span. `PLAN.md:182` →
  `## P3 — Ordering handoff — COMPLETE 2026-09-2X` (D2 is already `[x]`; same-PR phase-flip law,
  `PLAN.md:3-5`).
- `ops/manifest.json:69-71` P3 `"status": "complete"`; `initiative.updated` (`:8`) set to the
  lock date; `statusNote` (`:13`, stale: "sixty ratified rulings", "next: C4, A3") replaced with:
  `P0 complete 2026-09-03; P1 hygiene complete 2026-09-15; P3 ordering handoff complete 2026-09-2X. Baseline ratified (ruling 8: M1 P50 43.3 min / P95 3.95 h; M5 327 of 3,069 starts unfinished, 10.7%); seventy-seven rulings in research/decisions.md (1-70 and 73-79; 71-72 reserved for the C5 grill draft). Landed: A3 (rulings 73-75), A4, A5 + A5b + A5c (PRs #978, #993), B1-B6 (B3 PR #1006, B6 PR #1005, B5 PR #1143), C1/C2 ledger, C3 complete (coverage, tsgo tests, lint-policy C3.1-C3.6, labs, ruling 58), C4a (rulings 59-60), C4.1 shadow mode (rulings 61-64), C5 must-fail fixtures (rulings 68-70), D1 pre-push order handed to the ontology packet as research/gate-order-handoff.json (rulings 76-79), D2 review follow-ups (rulings 65-67); next: C4.2 enforcement, then the P4 A1 close re-run.`
- `GOAL.md:40-48` (Status, stale: "sixty-four rulings", "Next: C5 fixtures … A3") replaced with the
  paragraph below, which keeps GOAL.md at 3545 characters and names no command:
  `Status (2026-09-2X): P0, P1 and P3 complete. research/baseline.md is ratified (ruling 8: M1 P50 43.3 min / P95 3.95 h; pre-push wave 65.9% of local wrapper time; M3/M4 unmeasurable until journals carry fingerprints and inner lanes). research/decisions.md holds seventy-seven rulings (1–70 and 73–79; 71–72 reserved for the C5 grill draft), the latest C4 shadow mode (61–64), D2 review follow-ups (65–67), the C5 tripwire (68–70), the A3 economics surface (73–75) and the D1 ordering handoff (76–79). Landed: A3, A4, A5/A5b/A5c, B1–B6, C1/C2, C3, C4a, C4.1, C5, D1 (the pre-push order handed to the ontology packet as research/gate-order-handoff.json) and D2. Next: C4.2 enforcement once the shadow report reads ready; then the P4 A1 close re-run.`
  (in GOAL.md all three paths, `research/baseline.md`, `research/decisions.md` and
  `research/gate-order-handoff.json`, are backticked, as the first two are today; that is the 3545
  count, measured 2026-09-25 by substituting the draft for lines 40-48 with `wc -m`. With only the
  first two backticked it is 3543).
- `.claude/skills/yeet/SKILL.md:781-788` (the economics-seed paragraph) gains two sentences: a lane
  added to `githubCheckPrePushLanes` needs a gate-order seed row and cost-source entry under the
  ruling 76 seeding rule, or `gate-order-handoff.test.ts` fails; the runtime pre-push check still
  assembles its own lane list in `Quality.command.ts` until the follow-up PR (§8), so a lane group
  added only there escapes the fixture and runs last.
- `research/OPPORTUNITIES.md`, appended after `:2415` in the `## <date> — <lowercase title>` +
  `- Doing:` / `- Evidence:` / `- Prevention:` form (`:2394-2415`). Receipts 1–4 below were found on
  2026-09-25 by the §0 probes against d9f74d230a, so they are appended on 2026-09-25 in this lane,
  when found (`GOAL.md:36-37`: "at the moment they happen"; `AGENTS.md`: "never saved for
  closeout"), with Prevention naming the fix as pending; the implementation PR only fills in their
  Prevention lines. The earlier draft's receipt on SPEC's "S8/S9" wording is dropped: SPEC already
  names S7 as the seam and S8/S9 as the consuming stages (§0.6), so there is no friction to record.
  1. `## 2026-09-25 — quality:cache-policy ran unseeded after coverage since #1068` — Evidence
     `GithubChecks.ts:561-567`, `WaveOrder.ts:275-276`, `yeet.test.ts:833`; Prevention landed in
     this PR (fixture 1 and the ruling 76 seeding rule).
  2. `## 2026-09-25 — the seed's JSON pointers were provenance strings nothing resolved` — Evidence
     `a3-economics-surface.md:30-31` vs `WaveOrder.ts:8-21`; `quality:jsdoc-ratchet` reads the
     Doctest row under a lane-family basis (`WaveOrder.ts:27`, `:217`); storybook's cost is one
     external run (`WaveOrder.ts:241`); four absent-share rows that postdate the A1 window
     (`fallow:health`, `quality:doctest`, `quality:storybook`, `repo-sanity:config-typecheck`) say
     "zero of 832 was observed" (`WaveOrder.ts:28`); Prevention landed (fixtures 2–3, the cost
     sources and the postdating basis).
  3. `## 2026-09-25 — the frozen A1 seed diverges from live A3 by up to ~300x and A3 lane rows merge
     tiers` — Evidence §0.9 numbers, `Verdict.ts:761`; Prevention not in this PR; a reseed needs its
     own ruling.
  4. `## 2026-09-25 — plan and runtime spell the pre-push lane set twice` — Evidence
     `Planner.ts:413-421` vs `Quality.command.ts:1008-1019`; Prevention partly landed
     (`githubCheckPrePushLanes` used by the plan and the fixtures); runtime adoption left for a later
     PR.
- Ontology packet (`explorations/beep-ci-operational-ontology`), per ruling 79:
  - `research/OPPORTUNITIES.md`, appended at EOF (after `:774`; the last entry's heading is `:758`
    and its body runs to `:774`). The form chosen is the `## YYYY-MM-DD: title` + single-bullet form
    of `:36-37`, the ruling-14 precedent (#964); recent entries (`:690-774`) use multi-bullet
    **Work**/**Evidence**/**Handling**/**Prevention** bodies, which a receipt that records no friction
    does not need:
    `## 2026-09-2X: time-to-certainty D1 hands the pre-push ordering inputs to the planner seam` /
    `- goals/time-to-certainty/research/gate-order-handoff.json (gate-order-handoff/v1, sha256 <final-head digest>) carries the 32-lane pre-push order with each lane's A1 cost P50 (seconds in the seed; resolved P50/P95 in ms beside it, as CQ-003's p50Ms/p95Ms), a cost basis (a1-lane-row 16, a1-proxy-row 15, external-run 1; draft CostProvenance mapping census, default and measured, the steward's call), A1 first-red share (count over 832 first failures, numerators over 1610 red attempts; not CQ-018's probability), A4 precision (no CQ or term) and verified pointers into goals/time-to-certainty/research/economics.json (sha256 37e854ef…); it is offered by path as input to the S7-v2 planEpisode seam and not wired (no ciops code reads a goals/ path; S8 formalizes the terms, S9 dogfoods them); PlanEpisodeInput, apps/labs/ciops and research/control-interventions.yaml are unchanged. Open item for the steward: iv-1006-wave-order (B3, PR #1006), with #1068 and this PR's merge as later landing instants of the same ladder, draft values in goals/time-to-certainty/research/d1-ordering-handoff.md §4 (ttc rulings 76–79).`
  - `research/SOURCES.md` §4 Yeet-internals REUSE bullet (`:54-58`) gains
    `internal/WaveOrder.ts` (`WaveOrder`, `DEFAULT_GATE_ORDER_SEED`, `gate-order/v1`; handoff document
    `goals/time-to-certainty/research/gate-order-handoff.json`).
  - `README.md` Trail, a new first line above `:197`: `- 2026-09-2X: time-to-certainty D1 (rulings
    76–79) hands the pre-push gate order as gate-order-handoff/v1 (sha256 <digest>) and names
    iv-1006-wave-order as an open item; no auditor run, corpus recapture, ratification, CQ,
    control-intervention or ciops change.` The generated region `README.md:5-8` is not touched.
- Draft values for the steward's `iv-1006-wave-order` open item, in the keys of `iv-870`
  (`research/control-interventions.yaml:11-35`); D1 does not write them to that file:
  `id: iv-1006-wave-order`; `title: "PR #1006 — cost-ordered fail-fast pre-push wave (gate-order/v1)"`;
  `class: OperationalChangeEvent`; `causalStatus: observational`;
  `landedAt: "2026-09-04T05:34:17Z"`; `mergeCommit: d7a08b513b67a97f2554689c8d701addce132d8a`
  (both from `git show -s d7a08b513b`, 2026-09-25; re-verify with `gh api` before the steward writes
  them); `pr: 1006`; `mechanismChanged: ordering` (a new value; the file's only value today is
  `admission`, `:18`); `hypothesis`: earlier time-to-first-actionable-failure for red pre-push
  attempts; `measurementCaveats`: adoption-qualified membership (checkout HEAD ancestry at or after
  `mergeCommit`, as `:30`); costs frozen at the 2026-09-03 A1 window; #1006 also changed early stop
  for precise reds, so ordering and early stop are confounded; `quality:cache-policy` ran last from
  #1068 until D1; `evidence`: the handoff path and sha256, and `gh pr view 1006 --json
  mergedAt,mergeCommit`; KPI before/after pointer (ontology `DECISIONS.md:123-124`): before = the A1
  baseline window 2026-08-04 to 2026-09-03 (`research/baseline.md`, ruling 8), after = the P4 A1
  close window, partitioned at `landedAt` (CQ-016). The same ladder changed twice more, and each
  change is a landing instant the partition needs (CQ-016, `competency-questions.yaml:400-402`,
  asks when each change event landed): #1068 (`2086a0a090`, committer 2026-09-10T22:38:52Z, from
  `git show -s`) added `quality:cache-policy` unseeded, so it ran last; the D1 merge (this PR's
  merge commit and time, filled in after merge) seeds it at rank 19 and changes its early stop.
  Whether they become their own rows (for example `iv-1068-…` and `iv-<D1 PR>-…`) or caveats on
  `iv-1006-wave-order` is the steward's call. Whether a seed row there counts as an emitted A-Box
  fact (`control-interventions.yaml:4-5`) is the steward's call too.

The handoff sha256 in both ontology receipts is computed at the final head. Receipts are dated
history; a later regeneration does not edit them.

## 5. Operator decisions (all in one place)

1. **Handoff medium** — committed fixture-guarded JSON with no code reader yet (recommended) /
   print-only command / committed JSON plus ciops mirror. Ruling 73's "nothing reads one" binds only
   the `yeet economics` surface (`research/decisions.md:965-971`).
   **Assumed for the implementation PR:** the committed fixture-guarded JSON, offered by path to the
   ontology steward, regenerated only through the fixture's `-u`.
2. **Cross-packet write scope** — OPPORTUNITIES entry with the `iv-1006-wave-order` open item,
   SOURCES clause and README Trail line (recommended) / also write the row, with a "seed row is not
   an emitted A-Box fact" carve-out and a before/after KPI pointer, which needs an ontology DECISIONS
   entry by that packet's steward and so conflicts with ruling 79's list of unchanged ontology files
   / also ciops, contract and ontology DECISIONS. This absorbs the former control-intervention
   question: the row is named as an open item for the ontology steward with the §4 draft values,
   because the file is the A-Box seed (`control-interventions.yaml:4-5`) and the law asks for
   before/after evidence (`DECISIONS.md:123-124`). The open item's home is the ontology
   `research/OPPORTUNITIES.md`, not the manifest's `openQuestions` (which mirrors that packet's
   DECISIONS log, `explorations/README.md:134-135`) or the README "Next Open Question".
   **Assumed for the implementation PR:** the three receipts with the open item;
   `control-interventions.yaml`, the ontology manifest and its README "Next Open Question" untouched.
3. **Ordering objective** — lock the lexicographic key as SPEC D1's meaning (recommended) / a
   cost/red ratio order now as a new `orderRule` literal (admissible under SPEC D1; it reorders 20 of
   32 positions, §0.5).
   **Assumed for the implementation PR:** the lexicographic key, named `gate-order-lexicographic/v1`.
4. **SPEC D1 parenthetical** — a dated SPEC.md parenthetical naming where the document is offered
   (the S7-v2 seam) and rulings 76–79, recording a landing rather than correcting SPEC, which already
   names S7 as the seam (recommended; dated-parenthetical precedent #1184, `SPEC.md:150-151`; #1168,
   `SPEC.md:135`, shows an in-place ruling cite) / no SPEC edit, the rulings alone.
   **Assumed for the implementation PR:** the dated parenthetical in §4; SPEC D1's sentence is not
   rewritten.
5. **`quality:cache-policy` basis** — 183 s proxy, 0 by absence (recommended; changes runtime
   early-stop) / live 7.493 s / receipt only.
   **Assumed for the implementation PR:** the 183 s `a1-proxy-row` seed row of §2.
6. **Red-share semantics** — keep `redProbability` at v1 with 1610 as data (recommended) / rename or
   re-denominate now.
   **Assumed for the implementation PR:** `redProbability` unchanged at `gate-order/v1`; 832 and 1610
   carried in the handoff source.
7. **P4 close report location (P4's call; recorded here, not decided by D1)** — the SPEC text pulls
   two ways: `SPEC.md:49-50` names `research/economics.json` as A1's output and says it "is re-run at
   close", while `SPEC.md:185` requires that "both reports are in `research/`"; ruling 8
   (`research/decisions.md:71`) and ruling 73 (`:968`) require the close to re-run "the same script,
   row by row", and that script writes only `research/economics.json` (`economics.py:32`, `:50`).
   Option A: a P4 output option in `economics.py` puts the close report beside the baseline; P4 must
   then say whether a script with a new output path is still "the same script" of rulings 8 and 73.
   Option B: P4 overwrites `economics.json`; `SPEC.md:185` then still requires the baseline to
   survive in `research/` under another name, and D1's fixtures 2–4 go red until a reseed ruling.
   Ruling 77 binds P4 neither way.
   **Assumed for the implementation PR:** nothing for P4; the seed and `GATE_ORDER_SOURCE` pin the
   baseline bytes `37e854ef…`.
8. **Turbo inputs** — accept the `test.inputs` and `test:property.inputs` edit (ruling 78's inputs
   bullet; both tasks run the same `vitest run`) and the cache-baseline re-record with the dedicated
   `research/d1-cache-review.md` basis, redone after each main merge in the §4 order (recommended) /
   accept the cached-green hole and drop the bullet from ruling 78.
   **Assumed for the implementation PR:** the two-task inputs edit plus a reviewed re-record whose
   basis is `research/d1-cache-review.md`.
9. **P3 closure** — tick D1 and flip P3 complete in PLAN and manifest in this PR although "handed" is
   not "consumed", and replace the stale GOAL.md Status and manifest `statusNote` with the §4 drafts
   (recommended; no command names, GOAL.md 3545 ≤ 4000) / leave P3 in progress until the ontology
   steward acts on the open item. Inline under ruling 79.
   **Assumed for the implementation PR:** P3 flipped complete; GOAL.md Status and `statusNote`
   replaced with the §4 drafts.
10. **Numbering** — keep rulings 71–72 reserved and number round 24 from 76 (recommended) / give D1
    71–74 and renumber the C5 draft when it locks. Inline at the top of this note.
    **Assumed for the implementation PR:** rulings 76–79.

## 6. Proposed rulings — decisions.md round 24 text

## 2026-09-2X — SPEC D1 ordering handoff, round 24 (four rulings, proposed by the orchestrator; the merge of this PR is the lock)

Context: PLAN D1 orders the pre-push wave by (cost, red probability, precision) from A1 and hands
its inputs to the ontology packet's planner seam with a receipt. The design contract is
`research/d1-ordering-handoff.md`; its §0 findings are why D1 adds no planner, command or service:
B3 (#1006) already ships the order, one declared lane (`quality:cache-policy`) has no seed row, the
seed's pointers were never read, and the ontology's seam is S7-v2 `planEpisode`, which takes
repo-cli facts only as documents. "D1" is SPEC §D D1. It is not the C3 table's D1 (ruling 26),
pr-event-awareness D1, or the 2026-09-09 quality-lane audit's `REPORT-local.md` finding D1 and PLAN
decisions D2, D4 and D8 (round 8 above; the seed comments in `WaveOrder.ts` cite D2 and D8). Rulings
71–72 stay reserved for the C5 grill draft (`research/c5-must-fail-fixtures-grill.md:127`, `:142`), so
these rulings are 76–79. Lane ranks below are 0-based execution positions (rank 0 runs first), as
`GateOrderHandoffLane.rank` records them.

**Ruling 76 (D1-1) — the D1 order is B3's lexicographic key, named, over a seed that covers every
declared pre-push lane.** The pre-push wave keeps B3's `orderWaveLanes` key over
`DEFAULT_GATE_ORDER_SEED` and names it `gate-order-lexicographic/v1`: seeded first, policy-preflight
before heavy, A1 cost P50 ascending, A1 first-red share descending, precise before imprecise, then
declaration index. This is D1's reading of "(cost, red probability, precision)"; any change of key,
sequence or direction is a new literal. Every lane the non-main full-tier pre-push plan declares
(the lanes `githubCheckPrePushLanes` in `GithubChecks.ts` returns with
`githubCheckChangesetStatusLane`) carries exactly one seed row, and every
seed row names a lane of that plan. `quality:cache-policy` gets the Repo Sanity aggregate proxy (183 s
at `/hosted/laneRows/7/p50DurationMs`, first-red share 0 by absence because the lane postdates the A1
window, precise, policy-preflight); the four seeded lanes that already postdate the window
(`fallow:health`, `quality:doctest`, `quality:storybook`, `repo-sanity:config-typecheck`) get the same
postdates-the-window first-red basis in place of "zero of 832 was observed", with values, pointers and
order unchanged. `quality:cache-policy` moves from rank 31 to rank 19 (ranks are 0-based
execution positions), after `repo-sanity:config-typecheck` and before `quality:build`; the other 31
lanes keep their relative order. The A1 window is the one the seed pins, ending at its
`measurementAsOf` 2026-09-03T06:29:38.367Z (the ruling-8 baseline window 2026-08-04 to 2026-09-03). A
lane that joins the plan after that window gets a seed row and a cost-source entry in the PR that adds
it: the A1 row its group or wrapper siblings use (`a1-proxy-row`), or a named external run behind the
`/hosted/laneRows` sentinel (`external-run`) when no A1 row covers it; first-red share 0 by absence;
precise unless A4 says otherwise; policy-preflight when its wave is `preflight`, else heavy. This
seeding rule holds while the seed is `gate-order/v1` over the pinned `37e854ef…` bytes; the ruling
that reseeds replaces it and restates the rule for its own window. Rationale: SPEC B3 fixed (lane
class, cost, precision); B3 (#1006) added the first-red tiebreak; ruling 76 records that key as D1's
order. The unseeded lane has run after the 603-second coverage lane since #1068. A ratio order is
admissible under SPEC D1, which puts only the lane-DAG planner out of scope, but would be a new
literal; it is rejected here because it reorders 20 of 32 lanes on a rank weight that is not P(red).
UC-001 does not support cost-first ordering: its main flow puts ascending cost third, after
diff-touched and topological tie-break, and its goal, minimizing expected
time-to-first-actionable-failure, is closer to the rejected ratio order; D1 rejects that order for
want of a probability to divide by (CQ-018 stays deferred), not on UC-001's authority. Naming the
rule makes a later objective change detectable. Rejected: a cost/red ratio order in D1 (it reorders 20 of 32 positions on a share
that is not a probability; admissible, but a new literal with no evidence behind it); a reseed from
live `yeet-economics/v1` (a policy change that needs its own ruling); the live 7.493 s value for
`quality:cache-policy` (mixes sources in one seed); a receipt without the row (the handed order would
stay wrong).

**Ruling 77 (D1-2) — the seed's A1 provenance is checked against pinned bytes, and the red term is
carried as counts.** A repo-cli fixture resolves every seed duration and first-red pointer, plus
`measurementAsOf` and the 832 population, against the bytes of `research/economics.json` (sha256
pinned as a `CacheEvidenceReference`), decoded through a schema view of only the resolved subset, with
pointers parsed into a closed kind set; an unknown shape is a finding, never a guess. Each seeded lane
has one cost source with a closed basis (`a1-lane-row`, `a1-proxy-row` or `external-run`), and the
fixture checks that each resolved A1 row's context or wrapper id equals that source's key and names
exactly one row of its array; an `external-run` cost is not fixture-verified and the handoff says so.
The red check multiplies each share by the seed's own 832; one separate check compares 832 with A1's
reconstructable first failures, and another checks that the actionable-lane mix sums to A1's 1610 red
attempts. The handoff carries the 832 first-failure population, the 1610 red attempts the counts come
from, and the resolved A1 lane key for exact rows. The field `redProbability` stays at `gate-order/v1`,
and it means a first-red share, a rank weight and not P(red). The pre-push runtime never reads the
file. The seed pins the P0 baseline bytes (sha256 `37e854ef…`); where the P4 close report lands is
P4's call under `SPEC.md:185`. If P4 rewrites `economics.json`, fixtures 2–4 go red and any reseed
needs its own ruling. A PR that edits `research/scripts/economics.py` and re-renders
`economics.json` without a P4 re-run (the script's self-receipt moves, as in #964, #978 and #1026)
is a pin move: it updates `GATE_ORDER_SOURCE.sha256` and regenerates the handoff with no ruling,
provided every value, row key and population the seed resolves is unchanged; otherwise it is a
reseed. Receipts citing `37e854ef…` are not edited. Rationale: provenance handed to another packet
must be checked rather than asserted, and the population mismatch, the `pre-push:*` alias ids and the shared duration rows are
what a consumer would misread from prose. Rejected: reading the file at runtime (an I/O failure mode
on every push); a `gate-order/v2` bump or a rename; re-denominating the share (a uniform rescale
changes nothing and D1 has no evidence for a denominator); an untyped pointer walk; binding the P4
close re-run to reseed in its PR.

**Ruling 78 (D1-3) — the handoff is one committed, fixture-guarded `gate-order-handoff/v1`
document.** `goals/time-to-certainty/research/gate-order-handoff.json` is a `GateOrderHandoff`
carrying the `gate-order/v1` seed verbatim, the `orderRule`, `scope: "pre-push:non-main"`, the pinned
source with both populations, and the 32 lanes in execution order with 0-based rank, declaration
index, deciding key, red-scheduling consequence, cost basis, resolved A1 duration row with its P50 and
P95, and resolved A1 lane key. No repo-cli command writes it; it holds no clock, host path or commit
id; its bytes are two-space pretty JSON of the encoded value with a trailing newline; a repo-cli
fixture fails whenever its bytes differ from the bytes the checkout computes, and those computed
bytes must decode back to the computed value, so the committed value is guarded through its bytes;
its only writer is that fixture's vitest file snapshot, updated by a `-u` run and a plain run after
it, with the diff reviewed by a person. The repo-cli `test` and
`test:property` tasks declare `economics.json` and `gate-order-handoff.json` as inputs, so a change to
either reruns the fixture; naming two files one fixture reads is not the blanket cache-key tuning the
SPEC rejects. Rationale: the ciops lab takes repo-cli facts only as documents read by path and sha256
and S7 forbids repo-cli integration, so a TypeScript constant is not a handoff. The consumer is the
ontology steward through the receipt. The fixture guards freshness only. No code reads the document
until the S7-v2 seam widens, which is that packet's call. Rejected: a new subcommand (the lab cannot
run repo-cli, and stdout has nothing to pin); a `yeet economics` section (live window and clock);
carrying the order in a `gate-order/v2` seed (circular); an embedded commit SHA (a file cannot name
its own commit, and squash merges rewrite it); `blockedBy` edges (all empty, nothing reads them); a
mirrored `gate-order` schema in `apps/labs/ciops`.

**Ruling 79 (D1-4) — the receipt lands in both packets; the ontology seam stays as it is.** SPEC D1's
"hands its inputs to that packet's S8/S9 stages" is discharged by the committed document offered, by
path and not wired, as input to the ontology packet's S7-v2 `planEpisode` seam, with S8 formalizing
the cost and red terms and S9 dogfooding them, as SPEC D1 already says; `SPEC.md` gains one dated
parenthetical on D1 that names where the document is offered and these rulings, recording a landing
rather than a SPEC error, and D1's sentence is not rewritten. The same PR adds one dated entry to
`explorations/beep-ci-operational-ontology/research/OPPORTUNITIES.md` naming the document, its
sha256, its target, the unit and measure mismatches, and one open item for the ontology steward:
`iv-1006-wave-order`, with draft values in the design contract (the steward may promote it to that
packet's DECISIONS log and manifest `openQuestions`, which this PR does not touch); one
`research/SOURCES.md` §4 REUSE clause; and one README Trail line. `research/control-interventions.yaml`,
`PlanEpisodeInput`, `apps/labs/ciops`, the S7 contract, the ontology DECISIONS log, every vocabulary
file, `ontology/extraction/**` and the run-4 intake stay unchanged. Rationale: ruling 14 (#964) set
the one-line receipt precedent and ruling 41 (#1149) the Trail-plus-SOURCES pair; the ontology's
purity-vs-control-interventions ruling asks for the cost-ordered fail-fast ladder to be recorded
against the KPI before and after, but a `control-interventions.yaml` row is an A-Box seed individual,
so the receipt names it for the steward instead of writing it; the PR takes a stated exception to the
explorations session law (next open question, manifest sync, Atlas writer), as the #964 and #1149
receipts did, because a ttc receipt writer is not a session of that packet, and the steward's next
session syncs them; and widening the seam, emitting A-Box facts or promoting CQ-003/CQ-018 belong to
that packet's steward and auditor. Rejected: writing the
`iv-1006-wave-order` row from a ttc PR; a ciops mirror with a widened `PlanEpisodeInput`; a
provisional lane-order A-Box; ontology DECISIONS rulings ratified by a ttc merge; `links.goals`
(graduation semantics); an INBOX entry; a run-4 docket row; rewriting SPEC D1's sentence.

## 7. Stays out

- Any lane-DAG planner, `planEpisode` body, `Graph` construction or `PlanEpisodeInput` widening
  (`s7-projection-contract.md:100-102`, `:255-259`).
- Any change under `apps/labs/ciops`: no mirrored schema, fixture, Turtle, A-Box or `ciops-prov:`
  term; no ontology T-Box, TAXONOMY, PREDICATES, CQ, IRI (S8) or DECISIONS edit; no run-4 docket or
  `ontology/extraction/**` edit; no `research/control-interventions.yaml` row (the steward's open
  item); no `links.goals`.
- Any new CLI command or subcommand that writes the handoff JSON (ruling 78). Nothing new writes
  `economics.json` either (ruling 73: `yeet economics` writes nothing to `research/`,
  `research/decisions.md:965`).
- Any new lock, scheduler, admission or `QualityScheduler` change (`SPEC.md:177-178`;
  `ops/manifest.json` `stopConditions[4]`, `:90`).
- Hosted proof reuse without the parity ledger; any merge-queue work.
- Reseeding from live `yeet-economics/v1` or from the P4 close report; per-tier A3 lane identity; a
  lane-id alias map beyond the ruling-28 check in the fixture; key-addressed pointers (index pointers
  stay); rewording the `hostedRow` basis constants.
- Any change to the ordering key, or a ratio / expected-cost objective (each would be a new
  `orderRule` literal under its own ruling).
- A4 precision or lane class regenerated from data (both stay declarative bases; the fixture only
  checks lane class against the lane's declared wave).
- Routing `Planner.ts:431` through the `WaveOrder` service, and switching `Quality.command.ts:1008-1019`
  to `githubCheckPrePushLanes` (runtime assembly stays as is; receipt 4).
- Ordering for the cheap-gates and review-fix tiers (`Planner.ts:431-442`) and for labs (labs is not
  in the full-tier lane set, `githubCheckPrePushLanes`).
- Rulings 71–72 and any C4.2 work.

## 8. Implementation slices

- **Slice 1 (one PR, `feat(repo-cli): …(time-to-certainty)`)**: everything in §1–§4 — the schema
  additions, the keyed order table and `rankWaveLanes`, the exported `redSchedulingDecision` and
  `githubCheckPrePushLanes` (plus its `Quality.test-kit.ts` export), the seed row, the cost sources
  and `GATE_ORDER_SOURCE`, the new fixture file, the `yeet.test.ts` pin, the committed handoff JSON
  (first written by the fixture's `-u` run, then confirmed by a plain run), the turbo inputs for `test` and `test:property`, the new
  basis note `research/d1-cache-review.md` and the cache-baseline re-record, the effect-vitest
  inventory, the yeet skill sentence, decisions round 24, the SPEC parenthetical, PLAN/manifest
  flips with the §4 GOAL.md Status and `statusNote` drafts, the Prevention lines of the ttc
  OPPORTUNITIES receipts appended on 2026-09-25, and the three ontology receipts. Gates: §4. The
  code and the document must land together: the fixture reads the document and the receipts cite its
  sha256.
- **Merge order with the concurrent lane `yeet-pr-events-slice-1`** (branch
  `feat/yeet-pr-events-slice-1`, uncommitted on e0b25a63fb as of 2026-09-25, read-only `git diff` and
  `git status` in that worktree): among the files D1 cites, its hand-edited hunks touch
  `src/test/Yeet.test-kit.ts` (one export added at `:14`, so D1's cited `:91` becomes `:92`),
  `Yeet.command.ts` (four import lines above `:142`, so the cited `:142-145` becomes `:146-149`, and a
  hunk at `:813-826`), `Planner.ts` (`:704-734`, after D1's `:405-445`) and `yeet.test.ts`
  (`:1008-1013`, after D1's `:801-834` and its import lists). It also edits two files D1 edits:
  `goals/time-to-certainty/research/decisions.md`, in-place amendments at `:500` and `:547` (+2/-2,
  no new ruling numbers), which do not overlap D1's append after `:1047`; and
  `.claude/skills/yeet/SKILL.md` (+144/-27, hunks from `:87` to `:722` of its version, as of
  2026-09-25T17:06Z; that lane is live, so counts can move), which moves the economics-seed paragraph
  D1 cites as `SKILL.md:781-788` to `:898-905` (`grep -n 'versioned economics seed'` returns `:899`
  there). No hand-edited hunk overlaps a D1 edit, and D1 edits neither `Yeet.test-kit.ts` nor
  `Yeet.command.ts`. Generated files do collide: that
  lane adds six test files (`yeet-base-conflict`, `yeet-check-fidelity`, `yeet-converge`,
  `yeet-pr-comment-rows`, `yeet-push-ack-timeline`, `yeet-wave-exempt`) and one source file
  (`internal/Converge.ts`, a new-file row in `standards/coverage.regression-baseline.jsonc`), and D1
  adds `gate-order-handoff.test.ts`, so both lanes regenerate `standards/effect-vitest.inventory.jsonc`.
  Neither PR has to land first. The second to land merges `origin/main`, re-runs
  `bun run beep lint effect-vitest --write` after the merge (§4 step 2) instead of hand-resolving the
  generated file, takes main's coverage baseline row for `Converge.ts` as is, runs the rest of the §4
  stale-baseline order, re-anchors the line citations in this note and in the round-24 text it lands
  (including the `SKILL.md` economics-seed cite, `:781-788` before that lane merges and about
  `:898-905` after; the sentence D1 adds goes at the end of that paragraph either way), and re-runs
  fixtures 5 and 8, whose plan half reads `Planner.ts`.
- **Follow-up (not D1, recorded in receipt 4)**: `Quality.command.ts` adopts
  `githubCheckPrePushLanes` with a runtime-parity fixture, and optionally `Planner.ts:431` goes
  through the `WaveOrder` service.
- **P4 close (owned by P4)**: where the A1 close report lands is P4's call under `SPEC.md:185`
  (§5 decision 7). If P4 rewrites `economics.json`, fixtures 2–4 go red and any reseed needs its own
  ruling. Reseeding the gate order from the close report, and regenerating `gate-order-handoff.json`
  with it, is a separate ruling P4 may propose; ruling 77 does not require it.
