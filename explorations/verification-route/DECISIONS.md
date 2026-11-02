# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-10-27 — packet home

**Question:** Where do this design's rulings live: a new exploration packet,
the ontology packet reopened at decompose via its `ciops-yeet-projection`
gate, or time-to-certainty workstream D?

**Answer:** A new exploration packet, this one, cross-linked to both parents.

**Rationale:** The mechanism is lane selection by change kind, not the ordering
projection the ontology packet's gate names, and that gate's condition
(projected order beating the deployed one in the KPI verdict) never fired.
Time-to-certainty rulings 76–79 declined to build a planner and handed the
order to the ontology seam; resuming D would reverse them first, and the packet
is paused on C4.2. Rejected: reopen the ontology packet (inherits 41 entries,
the auditor machinery and a gate this design does not meet); resume
time-to-certainty D.

## 2026-10-27 — first stage

**Question:** Which verification stage runs the route first?

**Answer:** `yeet final-check` first, shadow then enforced; hosted CI second
by extending B8's three-valued verdict (`run` / `skip-satisfied` / `hold`) per
lane once local recall is clean; the pre-push full proof inherits the selector.

**Rationale:** Since push-first (#1427) the local proof on most PRs is
cheap-gates only, so the pre-push tier is the population that stalled the
proof ledger (46 of 200 attempts by 2026-10-27). final-check is the scoped
replay every PR runs at content-final and already carries a merge base and
affected-range plumbing. Hosted is the KPI's unmeasured tier and the largest
lever, but a wrongly skipped required check on GitHub is the highest-blast-
radius place to learn a footprint is unsound. Rejected: hosted first; pre-push
first.

## 2026-10-27 — atom grain

**Question:** At what grain does `classify` read a diff?

**Answer:** Semantic (field-level) atoms for structured files — package.json,
bun.lock, turbo.json, tsconfig*, biome.jsonc, workflow YAML — and path-pattern
atoms with the owning package for everything else; an `unknown` catch-all kind
that maps to every lane.

**Rationale:** The measured loss came from turbo reading root package.json as
one blob; only field-level atoms can tell a dep-version bump from a script
edit. Path-only cannot express that distinction. Hunk/AST grain everywhere is
the most precise but the largest surface, and symbol-grain propagation (graft
callers) is a later refinement regardless. The catch-all makes the classifier
total and the route sound before the first refinement. Rejected: path pattern
only; hunk/AST grain everywhere.

## 2026-10-28 — footprint home

**Question:** Where do per-lane footprints live, given that pre-push,
final-check and hosted lanes all dispatch through `CiLaneId`?

**Answer:** A schema-owned total `Record<CiLaneId, CheckFootprint>` in
`packages/tooling/tool/cli/src/commands/Ci/`, beside `CiLane.ts`. Totality is a
compile error: every lane id has a footprint and a new lane cannot land
without one. Each row carries its fixture references.

**Rationale:** The lane id is the one key all three stages already share
(`ciLaneStep` in `GithubChecks.ts:163`, `lane()` in `FinalCheck.ts:120`,
`beep ci lane`). A field on `GithubCheckLaneSpec` is local-only, invisible to
hosted lanes, and spread over three declaration sites that can drift. A
committed sibling document (like `gate-order-handoff.json`) makes totality and
kind validity a lint instead of a type. Rejected: field on
`GithubCheckLaneSpec`; committed sibling document with pointer verification.

## 2026-10-28 — admission rule for refinements

**Question:** How is a footprint refinement (the claim that atom kind `k`
cannot move lane `L`'s verdict) admitted?

**Answer:** By measured loss. Run the loss census over merged PRs first and
refine kinds in rank order of machine-time turbo reran unnecessarily. A
refinement lands only with (a) a mutation fixture per claimed-absent kind,
driving the production classify and route path, and (b) 100% replay recall:
zero lanes the route would have skipped that went red on that head. Stop when
the next rank saves less than it costs to prove.

**Rationale:** The previous lineage admitted terms by ontological audit and
reached 52 without moving the KPI; the catch-all kind keeps the route sound
before the first refinement, so refinements can be admitted one at a time by
value. Declaring all ~500 footprint claims up front gives no ranking and ~500
unproven claims at once; refining on touch ignores where the census says the
loss is. Rejected: declare all up front; refine on touch.

## 2026-10-28 — propagation grain

**Question:** How does an atom in package P reach lanes on other packages?

**Answer:** Package-grain, per check class: `Propagation = none | reverse-deps
| covered-pkgs` on each footprint; `reverse-deps` walks turbo's package
dependency graph (already present in the dry-run output). Symbol-grain via
`graft callers` is a later refinement admitted by the same loss rule.

**Rationale:** Turbo propagates everything through `^build`; lint propagates
nothing; coverage reaches only the packages whose baseline the change can
move. Package grain is already a large, sound improvement and needs no fresh
index at route time. Symbol grain depends on a git-ignored regenerable index
and the census has not shown package grain to be the dominant loss. "Changed
packages only" is unsound for build, check and test under the soundness axiom.
Rejected: symbol-grain from the start; no propagation.

## 2026-10-28 — transformers

**Question:** How does the route treat lanes that write the tree
(effect-imports, terse-effect, config-sync, goals index, atlas, lint:fix,
docgen)?

**Answer:** Transformers first, route the post-transform diff. The prepare
phase keeps running writers before any check; `classify` reads the diff that
remains and `Required` is computed over it, so a writer's non-empty output
adds its atoms before routing. One pass, no fixpoint loop.

**Rationale:** Matches the step order yeet already has (`repairSteps` in
`Planner.ts:261`), and it is the formal version of "a biome bump needs lint
only, provided the format pass is an empty diff". Predicting writer outputs
up front is a second footprint table (writer -> emitted kinds) with its own
soundness burden; treating writers as checks lets one fire mid-route and
invalidate the route computed before it. Rejected: fold writer outputs into
the change up front; treat writers as checks.

## 2026-10-28 — code home

**Question:** Where do `classify`, `route` and the replay harness live?

**Answer:** In repo-cli, `packages/tooling/tool/cli/src/commands/Ci/`:
`ChangeAtom`, `CheckFootprint`, the total footprint record, `classify`,
`route`, and a `beep ci route plan|replay|census` surface. final-check and
the hosted phase call the same function the replay proves; tests and
mutation fixtures use repo-cli's existing test kit.

**Rationale:** The C3 and ciops lesson is that the one function that matters
must be the one that runs; the lab projection in `apps/labs/ciops` never
shipped into yeet. The route has no runtime dependency a lab would isolate.
A Python replay beside `economics.py` would be a second implementation of
`Required` that has to agree with the first. Rejected: lab via
create-package first; replay in Python.

## 2026-10-28 — enforcement gate

**Question:** What flips a refinement from shadow to enforced in final-check?

**Answer:** Its mutation fixture plus its replay recall over the corpus, both
green. The live final-check shadow (route-selected set against the run set,
would-skip lanes that went red) keeps running as a sentinel row that can
revoke a refinement, but never holds one. No sample size, no window.

**Rationale:** The operator's constraint is explicit: the machinery changes
daily, so a gate that waits on a live sample is forgotten and never closes
(time-to-certainty C4.2, 46 of 200 after a month). The corpus already holds
over a thousand hosted heads. Fixtures alone prove one edit per claim and
nothing about the real ones on record. Rejected: replay gate plus a live
shadow sample; fixtures only.

## 2026-10-28 — recall attribution and corpus

**Question:** How does the replay count a red against the route, and over
what corpus?

**Answer:** Base-green attribution over hosted heads. Corpus: every hosted PR
Check run since 2026-09-01, keyed by head sha (`refs/pull/N/head` fetched;
diff = head vs merge-base), outcomes pulled live with the existing
`capture_hosted` recipe (`goals/time-to-certainty/research/scripts/economics.py:816`)
and digest-pinned. A red on a lane the route would have skipped counts only
when that lane was green on main's latest push run at or before the
merge-base; an unknown base counts (fail-closed).

**Rationale:** Main is often red here and inherited reds are a standing
attribution class; counting every red makes recall unreachable for footprints
that are in fact sound. The frozen time-to-certainty inputs end 2026-09-28
and miss the push-first era, which is the population the route serves first.
Rejected: count every red; frozen inputs only.

## 2026-10-28 — ordering

**Question:** Does the route also order, or only select?

**Answer:** Select only: `Route = WaveOrder.order(Required(Δ))`. The existing
`gate-order-lexicographic/v1` seed, its pointer verification and
time-to-certainty rulings 76–79 stand unchanged.

**Rationale:** The ordering half is built, fixture-guarded and ruled; the
missing half is selection. Re-seeding from the census is a new literal under
rulings 76–77 and needs its own ruling; a selection-specific cost key has no
evidence yet. Rejected: re-seed the order from the census; order by
selection-specific cost.

## 2026-10-28 — hosted mechanics (phase 2)

**Question:** What does a skipped required lane look like on GitHub in the
hosted phase?

**Answer:** The lane's job still starts, computes the route, and completes as
`skip-satisfied` success with the route receipt (atoms, footprint, reason)
in its summary. Every required context is always present and the ruleset
never changes per PR. This extends B8's three-valued verdict
(`run` / `skip-satisfied` / `hold`) from docs-only to per-lane.

**Rationale:** A missing required context holds the PR unless the ruleset is
edited, and a skip that leaves no receipt is invisible on the PR. Routing
only locally has zero effect on the KPI's unmeasured hosted tier. Rejected:
remove skipped lanes from the matrix; local only.

## 2026-10-28 — compile layer

**Question:** Turbo's own input language can carry the file-grain footprint
(a per-task `!$TURBO_ROOT$/package.json` took the biome-bump invalidation
from 187 to 1 of 189) and generated field projections of root `package.json`
would let tasks name `root-scripts` and `root-catalog` separately. Does the
design get a compile layer?

**Answer:** Two layers. Layer 1 compiles file- and field-grain footprints
into `turbo.json` task inputs plus generated field projections of root
`package.json` (sound because a lane that reads root scripts names the
`root-scripts` projection). Layer 2, `beep ci route`, owns what turbo cannot
express: dependency-kind footprints, propagation classes, the hosted
`skip-satisfied` receipt and the replay. One footprint record feeds both;
the census ranks which lanes get which layer first.

**Rationale:** Layer 1 is a free, sound, hosted-side win (`affectedUsingTaskInputs`
is already on, so hosted `--affected` sharpens with it) and warms turbo's own
cache on every root `package.json` edit. Route-only leaves that on the table.
Negations alone are unsound: every package script delegates to a root script,
so the root `scripts` section is a real input and excluding the whole file
drops it. Rejected: route only, turbo untouched; turbo negations only.

## 2026-10-28 — appetite

**Question:** What is the appetite for the first graduated goal?

**Answer:** Three PR-sized slices, about one week of lane time. Slice 1:
schemas, the total footprint record at `unknown`, `classify`, `route`,
`beep ci route plan|census|replay` with the corpus fetch, and the loss census
printed. Slice 2: the first ranked refinements with fixtures and replay
recall, compiled to turbo where layer 1 applies, final-check shadow then
enforced. Slice 3: hosted `skip-satisfied` per lane behind the same gate.
Cut line: slice 1's census is the deliverable even if 2 and 3 slip.

**Rationale:** The route's first number is a replay, not a window, so a week
is a budget rather than a wait. A census-only PR would re-open the same
files for the route; a full program would pull the deferred ProofFact re-key
and the pre-push tier into a goal that needs time-to-certainty rulings first.
Rejected: one PR, census only; full program with no cut line.

## 2026-10-28 — shape review

**Question:** Does BRIEF.md match the picture (problem, three-slice appetite,
two-layer sketch, rabbit holes, no-gos)?

**Answer:** Yes, as drafted; decompose.

**Rationale:** The operator confirmed the brief without revision. Rejected:
cutting slice 3 (hosted) into a gated candidate; revising the problem framing
or appetite.

## 2026-10-28 — DEFERRED: ProofFact re-key on the footprint digest

**Question:** Should `ProofFact` be keyed on the footprint digest and
`ProofEpoch` drop `lockfileDigest`, so a lookup survives the edits the route
ignores?

**Answer:** DEFERRED. Reason: it edits time-to-certainty's C1/C4 surface
(`ProofFact.ts`, `ProofDigest.ts`, ruling 80's flip condition), which that
packet owns; and it is only worth doing once at least one refinement is
enforced with clean recall, which does not exist before slice 2. Carried as
the gated MAP candidate `proof-key-footprint`.
