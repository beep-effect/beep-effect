# Round 3 seat I: ruling application and disposition audit

Status: complete — **NOT READY FOR S4**

Scope: current-tree verification of the final pre-S4 grill rulings, the round-1
and round-2 disposition maps, and the packet's internal cross-references.

Evidence policy: each conclusion below cites the current file and line where the
claim is implemented or contradicted. Read-only Git ancestry and generated-artifact
checks are recorded with their exact commands and results.

## Verdict summary

**8 BLOCKER / 0 WARN / 1 NOTE.** The packet must not launch S4. The following
current-tree blockers are proved; later sections give the complete ruling and
disposition maps.

### BLOCKER I-01: the packet's authority documents were never landed

The repository ignores every directory named `docs` (`.gitignore:48`). All nine
current files under this packet's `ontology/docs/` are therefore present only in the
local working tree: `git ls-files explorations/beep-ci-operational-ontology/ontology/docs`
returns no paths, and `git cat-file -e HEAD:<path>` fails for each of
`competency-questions.yaml`, `pre-glossary.csv`, `literal-domains.md`, `orsd.md`,
`scope.md`, `s4-lane-contract.md`, `closed-world.yaml`, `traceability-matrix.csv`, and
`use-cases.yaml`. This directly contradicts the lane contract's requirement to commit
the packet before S4 so the freeze has a Git anchor
(`ontology/docs/s4-lane-contract.md:17-20`) and the README's claim that the application
pass is applied and the corpus pin is satisfied from the working tree
(`README.md:22-29`, `README.md:77-92`). A clean checkout cannot run the committed
validator because its inputs at `research/scripts/validate_packet.py:23-25` are absent
from `HEAD`. Every ruling whose only carrier is under `ontology/docs/` is locally
implemented but **unlanded**.

### BLOCKER I-02: the S4 contract does not implement the current foundational-auditor gate

The lane contract labels denotation as S4A, foundation analysis as S4B, and the
OntoClean adversary as S4C, then ends with proposal synthesis
(`ontology/docs/s4-lane-contract.md:143-165`). The named skill instead requires S4A
deterministic observations, S4B denotation hypotheses, S4C foundational analysis, S4D
proposals, two independent adversarial seats, a mechanical gate, and a total
dispositions index (`~/.agents/skills/ontology-foundational-auditor/SKILL.md:73-195`).
More seriously, the packet lets extraction lanes hand-author already interpreted
`candidates` with `kind`, `definition`, `domain`, and `range` before the auditor
(`ontology/docs/s4-lane-contract.md:55-125`), while the skill forbids treating a source
symbol as an ontology term before script-produced `SourceObservation` records
(`~/.agents/skills/ontology-foundational-auditor/SKILL.md:20-30`,
`:87-109`). The packet also claims the skill's `_shared/schemas/` contracts at
`ontology/docs/s4-lane-contract.md:157-159`, but the skill's required shared files named
at `~/.agents/skills/ontology-foundational-auditor/SKILL.md:56-69` are absent in the
installed skill package. The claimed FULL gate is an obsolete abridgment and cannot
execute as written.

### BLOCKER I-03: the two-kind validator falsely licenses two terms

NFR-2 limits decision terms to those required by a Must/Should CQ
(`ontology/docs/orsd.md:39-47`). `CQ-018` is `could_have` but requires
`estimatedFailureProbability` (`ontology/docs/competency-questions.yaml:444-460`), and
the glossary sources that property only to CQ-018
(`ontology/docs/pre-glossary.csv:80`). The validator accumulates required terms from
**all** CQs at `research/scripts/validate_packet.py:145-154`, then seeds the licensed
set with that unfiltered collection at `:160-183`, falsely licensing the Could-only
property. It separately licenses a glossary term whenever the raw substring
`ciops:<term>` occurs in testable SPARQL (`:160-162`): that makes `dependsOn` look used
solely because `ciops:dependsOnTransitive` occurs in CQ-004, even though CQ-004 requires
only `dependsOnTransitive` (`ontology/docs/competency-questions.yaml:110-122`) and the
`dependsOn` glossary row does not name a `supports=` dependency
(`ontology/docs/pre-glossary.csv:53-54`). The correct Must/Should-rooted exact-token
calculation therefore has **two** unlicensed properties: `dependsOn` and
`estimatedFailureProbability`. The validator's `0 warns` result contradicts both the
ruling and the README's claimed closure.

### BLOCKER I-04: CQ-010's tri-split left a structured `MaxGrantCost` assertion

The current CQ correctly replaces the old P95/max comparison with charge versus token
capacity and explicitly separates prediction, charge, and hard limit
(`ontology/docs/competency-questions.yaml:236-254`). The structured UC-002 main flow
still says the active policy validates `MaxGrantCost`
(`ontology/docs/use-cases.yaml:21-33`). That is the retired cross-boundary concept the
ruling removed, so the landing is partial.

### BLOCKER I-05: observational naming remains contradictory on the KPI authority path

The event registry correctly re-tags iv-870 as `OperationalChangeEvent` with
`causalStatus: observational` (`research/control-interventions.yaml:11-16`), and the
measurement law requires observational labeling absent a supporting design
(`research/kpi-measurement-rules.md:35-44`). The still-authoritative baseline instead
calls #870 the packet's first `ControlIntervention`
(`research/kpi-baseline-2026-08-27.md:3-18`). The same event is thus observational in
one authority and causally named in another, contrary to the round-3 ruling.

### BLOCKER I-06: the retained-lock reality correction regressed in the event registry

The corrected baseline says #870 layers admission over the retained per-origin lock and
changes contender behavior (`research/kpi-baseline-2026-08-27.md:3-12`). The application
pass's event registry again describes `bounce-fail proof lock -> durable ticket/lease`
and says bounces "are replaced" by queue wait
(`research/control-interventions.yaml:18-23`). This reintroduces the exact deployed-
reality overstatement marked FIXED in round 2.

### BLOCKER I-07: the supposedly exact S4 source manifest still contains ellipsis paths

The contract promises exact source paths and no lane improvisation
(`ontology/docs/s4-lane-contract.md:22-27`), but unit 5 abbreviates
`AttemptJournal.ts` and `Verdict.ts` with `.../`, and unit 7 abbreviates
`QualityScheduler.ts` the same way (`:31-34`). This is not a resolvable file manifest and
regresses the round-2 seat-F finding marked FIXED by "full paths."

### BLOCKER I-08: `--s4-lane` is named but not implemented

The lane contract delegates its completion predicate to
`validate_packet.py --s4-lane <file>` (`ontology/docs/s4-lane-contract.md:189-203`).
The validator has no argument parsing or lane-record validation; it runs only the packet
checks at `research/scripts/validate_packet.py:41-225`. A read-only proof invocation with
`--s4-lane /definitely/missing/s4-lane.yaml` exited 0 and printed the ordinary packet
`RESULT: 0 blockers, 0 warns`. The round-2 "completion gate had no executable carrier"
finding is therefore still open at the exact pre-S4 boundary where that carrier is
required.

## Grill ruling to landed-artifact map

The ruling text is the twelve-item frontier summarized at
`DECISIONS.md:185-210`, `DECISIONS.md:237-268`, and expanded at
`DECISIONS.md:270-370`. "Current carrier" below distinguishes content that exists in
this working tree from content actually present in `HEAD`; that distinction is
decisive because a ruling with an ignored-only carrier is not landed.

| # | Ruling | Current carrier and exact anchor | Disposition |
|---:|---|---|---|
| 1 | Scheduling trio are Must CQs | CQ-020 is projection ordering and `must_have` (`ontology/docs/competency-questions.yaml:493-515`); CQ-021 is the request/grant queue and `must_have` (`:517-544`); CQ-022 is stopping/cancellation and `must_have` (`:546-569`). Their checked SPARQL carriers are `ontology/tests/cq-020.sparql:1-10`, `ontology/tests/cq-021.sparql:1-14`, and `ontology/tests/cq-022.sparql:1-13`. | **BLOCKER I-01.** The executable queries landed, but the authoritative CQ definitions did not. |
| 2 | Admit `ScheduleProposal` and `hasScope`; close CQ-019 scope provenance | The glossary admits `ScheduleProposal` (`ontology/docs/pre-glossary.csv:31`) and `hasScope` (`:83`). CQ-019 has the required two arms for evidence and schedule proposals (`ontology/docs/competency-questions.yaml:463-491`), and the checked query mirrors both arms (`ontology/tests/cq-019.sparql:6-19`). CQ-020 emits ordered proposal steps and scopes (`ontology/docs/competency-questions.yaml:493-515`). | **BLOCKER I-01.** Query implementation landed; authority definitions are ignored-only. The two-arm circularity repair itself survives. |
| 3 | FULL normalization through `ontology-foundational-auditor` | The contract names a denotation/foundation/OntoClean/proposal sequence and a fail-closed completeness check (`ontology/docs/s4-lane-contract.md:143-165`). | **BLOCKER I-02** (and I-01). Its stages, inputs, adversarial seats, and gate do not match the current named skill, whose required shared contracts are also missing. |
| 4 | Rename to `VerificationEvidence` and `AssuranceTier`; preserve vernacular labels; mandate three splits | The reasoner-facing renames are in the suite header (`ontology/docs/competency-questions.yaml:8-11`) and glossary (`ontology/docs/pre-glossary.csv:7`, `:13`). Vernacular labels and the obligation/procedure, specification/execution, and request/grant split instructions appear in glossary rows `:4`, `:18-19`, `:35`, `:46`, and in the normalization contract (`ontology/docs/s4-lane-contract.md:162-165`). No retired `ciops:Proof`, `ciops:CertaintyTier`, or reasoner-facing `ciops:ControlIntervention` IRI occurs in the current CQ/query surface. | **BLOCKER I-01.** The local content reflects the ruling, but its authority files never landed. The labels remain pre-S4 declarations in prose/CSV notes rather than RDF axioms, consistent with a pre-normalization glossary. |
| 5 | Two-kind admission law | NFR-2 states decision-term or supported semantic-support term (`ontology/docs/orsd.md:39-47`); the CQ header states the capped support rule (`ontology/docs/competency-questions.yaml:2-5`); the lane contract requires `admission_kind`, CQ justification, and named supports (`ontology/docs/s4-lane-contract.md:129-141`). | **BLOCKER I-03** (and I-01). The validator falsely licenses a Could-only property through all-priority roots and an undeclared support property through prefix-substring matching. |
| 6 | CQ-010 tri-split and reshape | CQ-010 tests admission charge against capacity (`ontology/docs/competency-questions.yaml:236-254`); CQ-026 separately retains the P95 screen as a non-guarantee Should CQ (`:640-658`); the glossary separates `admissionChargeTokens`, `capacityAtAdmissionTokens`, and `softP95BudgetMs` (`ontology/docs/pre-glossary.csv:69`, `:96`, `:99`). | **BLOCKER I-04** (and I-01). UC-002 still asserts the retired structured `MaxGrantCost`, so the split is partial. |
| 7 | Closure contract now; SHACL at S6 | `closed-world.yaml` declares the closed/open world, completeness scope, source, freshness, and safe negation behavior, and explicitly assigns enforcement shapes to S6 (`ontology/docs/closed-world.yaml:1-15`), including CQ-019's `scopedByComputation` closure (`:84-90`). | **BLOCKER I-01.** The local contract is internally populated, but the contract itself is absent from `HEAD`; a clean S6 cannot consume it. |
| 8 | Starvation hard invariant | CQ-023 is a zero-row Must constraint with declared bound and modeled-exception exclusion (`ontology/docs/competency-questions.yaml:571-592`). Its query and adversarial fixture landed at `ontology/tests/cq-023.sparql:1-13` and `ontology/tests/fixtures/must-fail/cq023-starved-request.ttl:1-8`. The KPI law keeps starvation beside percentiles (`research/kpi-measurement-rules.md:61-65`). | **BLOCKER I-01.** Executable evidence and KPI law landed, but the CQ authority did not. |
| 9 | Rebase/merge the corpus at or beyond `debbbb51f7` | `git merge-base --is-ancestor debbbb51f7 HEAD` exited 0. `git merge-base debbbb51f7 HEAD` returned `debbbb51f77ae10015788dec0b819f12b96c3552`; current `HEAD` is merge commit `b28b0724f45b5ddfe792bcf074f9b7667c42f264`. | **PASS.** Exact requested ancestry proof succeeded. |
| 10 | Author `kpi-measurement-rules.md` | The v1 law defines the seat-request episode clock and legacy zero queue wait (`research/kpi-measurement-rules.md:10-25`), tier/adoption/observational membership (`:32-44`), cut/uncut censorship reporting (`:48-55`), and starvation reporting (`:61-65`). | **PASS.** This tracked artifact implements every named measurement clause. |
| 11 | Cache-posture and cost-charging Should CQs | CQ-024 is cache posture and `should_have` (`ontology/docs/competency-questions.yaml:594-611`); CQ-025 is actual-versus-estimated execution cost and `should_have` (`:613-638`). Their checked query carriers are `ontology/tests/cq-024.sparql:1-7` and `ontology/tests/cq-025.sparql:1-13`. | **BLOCKER I-01.** The queries landed; the authoritative priorities and CQ definitions did not. |
| 12 | Observational naming: `OperationalChangeEvent`; re-tag iv-870 | The glossary uses `OperationalChangeEvent` and observational-default semantics (`ontology/docs/pre-glossary.csv:25`). The registry re-tags iv-870 and gives it `causalStatus: observational` (`research/control-interventions.yaml:11-16`). | **BLOCKER I-05** and **I-06.** The KPI baseline still causally names the event, while the registry also regresses the retained-lock reality correction. |

Result: only rulings 9 and 10 have complete tracked carriers with no contradictory
current artifact. The other ten are blocked by at least one exact defect above; seven
of those depend on the unlanded `ontology/docs/` authority surface.

## Disposition-map audit

I censused every table row whose disposition contains `FIXED`: 49 in round 1 and 40
in round 2. `SURVIVES LOCALLY / I-01` means the current working-tree content still
contains the repair, but its authority carrier is one of the ignored files proved
absent from `HEAD`; it is not a landed fix.

### Round 1: all 49 `FIXED` dispositions

| Triage row and finding | Current-tree evidence | Audit |
|---|---|---|
| `research/reviews/pre-s4/round1-triage.md:13` namespace qualifier | The settled IRI is in `ontology/docs/competency-questions.yaml:12-13` and `ontology/docs/orsd.md:25-26`. | **SURVIVES LOCALLY / I-01.** |
| `:14` property-count drift | ORSD now states 18/7/1 CQs and 40/69/4 glossary rows (`ontology/docs/orsd.md:55-69`), matching the parsed files. | **SURVIVES LOCALLY / I-01.** |
| `:15` silent all-zero probe | The probe exits 2 when no journals resolve and prints the resolved-root census (`research/scripts/kpi_baseline_probe.py:63-74`, `:116-123`). | **SURVIVES.** |
| `:22` global-versus-parameterized queries | The one-row, datatype-preserving, repeated-block convention is explicit (`ontology/docs/competency-questions.yaml:15-28`), and the generated queries carry marked bindings. | **SURVIVES LOCALLY / I-01.** The executable query copies landed. |
| `:23` CQ-004 touched arm | Both UNION arms repeat the touched pattern (`ontology/tests/cq-004.sparql:7-14`); the counterexample is registered at `research/scripts/run_cq_suite.py:59-62`. | **SURVIVES EXECUTABLY.** CQ authority remains I-01. |
| `:24` CQ-006 correlation | The tree/epoch correlation and invalidation exclusion are in `ontology/tests/cq-006.sparql:5-13`; invalidated and unrelated-evidence fixtures are registered at `research/scripts/run_cq_suite.py:61-62`. | **SURVIVES EXECUTABLY.** CQ authority remains I-01. |
| `:25` CQ-007 queue wait | `queueWaitMs` remains in the CQ and glossary (`ontology/docs/competency-questions.yaml:193-215`; `ontology/docs/pre-glossary.csv:84`). | **SURVIVES LOCALLY / I-01.** |
| `:26` CQ-007/010 derivation labels | CQ-007 records ETL derivation and CQ-010 direct lookup over materialized admission facts (`ontology/docs/competency-questions.yaml:193-215`, `:236-254`). | **SURVIVES LOCALLY / I-01.** |
| `:27` CQ-008 released grants | The fixed-domain Active/Waiting restriction remains (`ontology/tests/cq-008.sparql:5-10`). | **SURVIVES EXECUTABLY.** |
| `:28` CQ-011 time window | The query binds both time endpoints and filters `occurredAt` (`ontology/tests/cq-011.sparql:6-13`). | **SURVIVES EXECUTABLY.** |
| `:29` CQ-012 window and shares | The query now computes component shares over the bound window (`ontology/tests/cq-012.sparql:6-29`), further hardened in round 2. | **SURVIVES EXECUTABLY.** |
| `:30` CQ-013 ranking | The argmin lane is retained, with the lane join now OPTIONAL (`ontology/tests/cq-013.sparql:7-15`). | **SURVIVES EXECUTABLY.** |
| `:31` CQ-014 branch criterion | `hasCurrentEpoch` binds the current epoch in `ontology/tests/cq-014.sparql:5-10`. | **SURVIVES EXECUTABLY.** |
| `:32` CQ-015 bound ASK | Both evidence and other checkout are caller-bound in `ontology/tests/cq-015.sparql:5-9`; the false-value fixture is registered at `research/scripts/run_cq_suite.py:70`. | **SURVIVES EXECUTABLY.** |
| `:33` CQ-016 partition point | The NL and query now ask for event partition points rather than an OWL-computed distribution (`ontology/docs/competency-questions.yaml:396-413`). | **SURVIVES LOCALLY / I-01.** |
| `:34` CQ-017 asymmetry | Both directional UNION arms remain in `ontology/tests/cq-017.sparql:5-17`. | **SURVIVES EXECUTABLY.** |
| `:35` CQ-019 inventory/constraint split | CQ-019 is constraint-only and now enforces two closed-provenance arms (`ontology/docs/competency-questions.yaml:463-491`; `ontology/tests/cq-019.sparql:6-19`). | **SURVIVES EXECUTABLY / I-01 for authority.** |
| `:41` stale provisional wording | Current ORSD and scope use the settled namespace (`ontology/docs/orsd.md:25-26`; `ontology/docs/scope.md:78-80`). | **SURVIVES LOCALLY / I-01.** |
| `:42` purpose lacks tier/epoch | Purpose names tier-relative and epoch-relative KPI coordinates (`ontology/docs/orsd.md:5-9`). | **SURVIVES LOCALLY / I-01.** |
| `:43` cheap-gate/tier conflation | Scope separates Yeet proof tiers, and literal domains keep the domains distinct (`ontology/docs/scope.md:37-41`; `ontology/docs/literal-domains.md:32-35`). | **SURVIVES LOCALLY / I-01.** |
| `:44` blanket lever ban | ORSD preserves the evidence-backed intervention exception (`ontology/docs/orsd.md:10-12`). | **SURVIVES LOCALLY / I-01.** |
| `:45` stale Must/glossary censuses | The current exact counts are stated at `ontology/docs/orsd.md:55-69` and independently re-counted below. | **SURVIVES LOCALLY / I-01.** |
| `:46` Agent-row traceability | Agent is now sourced to CQ-021 in the glossary (`ontology/docs/pre-glossary.csv:27`), and ORSD no longer claims every row is itself a CQ root (`ontology/docs/orsd.md:66-72`). | **SURVIVES LOCALLY / I-01.** |
| `:47` prose unions | The member domains are enumerated in `ontology/docs/literal-domains.md:3-35`. | **SURVIVES LOCALLY / I-01.** |
| `:48` ScopeKind spelling | Canonical scope members are recorded at `ontology/docs/literal-domains.md:9-13`. | **SURVIVES LOCALLY / I-01.** |
| `:49` SharedCache punning | Resource members are individuals and the class/individual non-punning rule is explicit (`ontology/docs/literal-domains.md:26-31`; `ontology/docs/pre-glossary.csv:22`, `:26`). | **SURVIVES LOCALLY / I-01.** |
| `:50` WorkUnit admission-law misuse | The WorkUnit row now describes the scheduling quantum and charge relation, not term admission (`ontology/docs/pre-glossary.csv:4`). | **SURVIVES LOCALLY / I-01.** |
| `:51` GrantState placement | Grant states are a separate closed domain (`ontology/docs/pre-glossary.csv:20`; `ontology/docs/literal-domains.md:14-17`). | **SURVIVES LOCALLY / I-01.** |
| `:52` Agent note overreach | Agent is grounded in deployed ticket ownership (`ontology/docs/pre-glossary.csv:27`). | **SURVIVES LOCALLY / I-01.** |
| `:53` UC-001 rival objective | UC-001 makes the KPI primary and scheduling an optimizing use (`ontology/docs/use-cases.yaml:4-19`). | **SURVIVES LOCALLY / I-01.** |
| `:54` UC-001 missing CQ-010 | UC-001 traces the admission constraint, while ordering is now CQ-020 (`ontology/docs/use-cases.yaml:4-19`; `ontology/docs/competency-questions.yaml:493-515`). | **SURVIVES LOCALLY / I-01.** |
| `:56` UC-003 missing CQ-019 | UC-003 includes the affected-scope trust constraint (`ontology/docs/use-cases.yaml:48-60`). | **SURVIVES LOCALLY / I-01.** |
| `:57` UC-005 ranking promise | UC-005 assigns ranking to ETL over ontology-supplied partitions (`ontology/docs/use-cases.yaml:76-90`). | **SURVIVES LOCALLY / I-01.** |
| `:58` traceability drift | The generator defines requireds as the sole term source (`research/scripts/regen_cq_artifacts.py:8-12`, `:92-102`); an in-memory regeneration matched every current test, manifest, and matrix byte-for-byte. | **SURVIVES LOCALLY / I-01.** Generator/tests landed; generated matrix did not. |
| `:65` ring-buffer reality | The probe calls the vein a retained ring buffer (`research/scripts/kpi_baseline_probe.py:8-12`), and the baseline carries the same limitation (`research/kpi-baseline-2026-08-27.md:43-48`). | **SURVIVES.** |
| `:66` right censoring | The probe reports lower-bound censored spans (`research/scripts/kpi_baseline_probe.py:211-217`); the baseline discloses the censored population (`research/kpi-baseline-2026-08-27.md:78-81`, `:144-147`). | **SURVIVES.** |
| `:67` reproducible fleet recipe | All fleet flags are real parser arguments (`research/scripts/kpi_baseline_probe.py:127-133`), and the baseline records raw-versus-filtered provenance (`research/kpi-baseline-2026-08-27.md:96-102`, `:136-143`). | **SURVIVES.** |
| `:68` probe schema/dedupe/sort/root/estimator defects | Schema checks, dedupe, roots, sort key, and named estimator remain at `research/scripts/kpi_baseline_probe.py:24-25`, `:63-123`, `:149-155`, `:170-179`. | **SURVIVES.** |
| `:69` episode decomposition | The post-grill measurement law now fixes episode identity and decomposition (`research/kpi-measurement-rules.md:10-31`), with CQ-007/CQ-012 as query carriers. | **SURVIVES.** CQ authority remains I-01. |
| `:70` unmatched starts | Starts without finishes are counted and printed (`research/scripts/kpi_baseline_probe.py:116-123`). | **SURVIVES.** |
| `:71` limitation scoping | The baseline has an explicit limitations/censorship section (`research/kpi-baseline-2026-08-27.md:181-192`). | **SURVIVES.** |
| `:72` 15-item S4 contract | A local contract exists, but its normalization procedure is obsolete, its paths are abbreviated, and its named executable gate is absent (`ontology/docs/s4-lane-contract.md:143-165`, `:189-203`). | **REGRESSION: I-01, I-02, I-07, I-08.** |
| `:78` CQ-019 trust-edge meaning | The two-arm query detects fail-open trust and non-full scope without provenance (`ontology/tests/cq-019.sparql:6-19`); the harness requires both antecedent populations (`research/scripts/run_cq_suite.py:43-50`). | **SURVIVES EXECUTABLY.** Authority remains I-01. |
| `:85` KPI boundary games, partial fix | Queue wait remains admitted, and the v1 law now covers clocks, censoring, tiers, adoption, and observational status (`research/kpi-measurement-rules.md:10-65`). | **SURVIVES.** CQ/glossary authority remains I-01. |
| `:90` evidence-source hole | CQ-006's invalidation exclusion is executable (`ontology/tests/cq-006.sparql:8-13`), and local closure declarations cover `invalidates` and `dischargesObligation` (`ontology/docs/closed-world.yaml:25-51`). | **SURVIVES EXECUTABLY / I-01 for the closure authority.** |
| `:116` #870 deployed-reality packet repair | The branch ancestry and deployed/prospective qualification survive, but UC-002 still names `MaxGrantCost`, the baseline still calls #870 a `ControlIntervention`, and the new event record again claims replacement (`ontology/docs/use-cases.yaml:21-33`; `research/kpi-baseline-2026-08-27.md:3-18`; `research/control-interventions.yaml:18-23`). | **REGRESSION: I-01, I-04, I-05, I-06.** |
| `:117` affected-reason ingestion caveat | The lane contract still says the plan-task boundary drops `affectedReason` (`ontology/docs/s4-lane-contract.md:46-50`). | **SURVIVES LOCALLY / I-01.** |
| `:118` CQ-015 insufficiency | The CQ note still requires task-hash-granular epoch identity (`ontology/docs/competency-questions.yaml:376-394`). | **SURVIVES LOCALLY / I-01.** |
| `:119` manifest open questions | `openQuestions` is now empty (`ops/manifest.json:8`) because the frontier is explicitly closed (`DECISIONS.md:347-370`), not because the former questions vanished silently. | **HONESTLY SUPERSEDED; no regression.** |

Round-1 result: 47 rows preserve their repair content at least locally, while rows 72
and 116 contain current contradictions. Many of the 47 are nevertheless not landed
because their only authority carrier is ignored (I-01). The census includes all 49
dispositions containing `FIXED`; no such row was skipped.

### Round 2: all 40 `FIXED` dispositions

| Triage row and finding | Current-tree evidence | Audit |
|---|---|---|
| `research/reviews/pre-s4/round2-triage.md:15` CQ-004 UNION scoping | Touched-package matching is repeated inside each arm (`ontology/tests/cq-004.sparql:7-14`), and the counterexample oracle is registered (`research/scripts/run_cq_suite.py:59-62`). | **SURVIVES EXECUTABLY.** |
| `:16` CQ-006 invalidated discharge | The nested invalidation exclusion remains (`ontology/tests/cq-006.sparql:8-13`), with both invalidated and unrelated fixtures (`research/scripts/run_cq_suite.py:61-62`). | **SURVIVES EXECUTABLY.** |
| `:17` CQ-012 partial-episode bias | Query output separately counts decomposed and window episodes (`ontology/tests/cq-012.sparql:12-20`); the harness compares them on seed and mismatch fixture (`research/scripts/run_cq_suite.py:147-152`, `:178-185`). | **SURVIVES EXECUTABLY.** |
| `:18` CQ-012 zero denominator | `HAVING (SUM(?total) > 0)` remains at `ontology/tests/cq-012.sparql:29`. | **SURVIVES EXECUTABLY.** |
| `:19` batched parameter substitution | The one-row/multi-block rules remain in `ontology/docs/competency-questions.yaml:15-28`. | **SURVIVES LOCALLY / I-01.** |
| `:20` typed window parameters | The convention requires RDF-term datatype preservation (`ontology/docs/competency-questions.yaml:19-25`), and both window queries use `xsd:dateTime` (`ontology/tests/cq-011.sparql:5-9`; `ontology/tests/cq-012.sparql:5`, `:14-19`). | **SURVIVES EXECUTABLY / I-01 for the authority rule.** |
| `:21` CQ-013 missing-lane invisibility | The lane/cost join is OPTIONAL (`ontology/tests/cq-013.sparql:7-15`), and the harness's explicit allowance is limited to this CQ (`research/scripts/run_cq_suite.py:31`, `:137-145`). | **SURVIVES EXECUTABLY.** |
| `:22` CQ-015 boolean value | The harness requires seed `true` and fixture `false` (`research/scripts/run_cq_suite.py:17`, `:115-120`, `:160-165`). | **SURVIVES EXECUTABLY.** |
| `:23` destructive regen without preflight | The generator validates priorities, result enums, IDs, and output-path uniqueness before line 57 begins writes (`research/scripts/regen_cq_artifacts.py:30-53`, `:57-74`). | **SURVIVES.** |
| `:24` multiline-NL corruption | The same preflight rejects multiline natural language (`research/scripts/regen_cq_artifacts.py:43-50`). | **SURVIVES.** |
| `:35` cross-checkout branch collisions | Episode groups key on `(checkout, branch)` (`research/scripts/kpi_baseline_probe.py:170-178`). | **SURVIVES.** |
| `:36` fleet recipe/provenance | The baseline distinguishes raw census and filtered episode rows and records the command (`research/kpi-baseline-2026-08-27.md:136-147`); the probe has the matching flags (`research/scripts/kpi_baseline_probe.py:127-133`). | **SURVIVES.** |
| `:37` pre-#870 AC2 | ORSD explicitly maps legacy queue wait to zero and discloses unlabeled waiting (`ontology/docs/orsd.md:78-85`). | **SURVIVES LOCALLY / I-01.** |
| `:38` enum source-domain collision | Candidate/fact records include `source_domain`, and the unit exclusions are named (`ontology/docs/s4-lane-contract.md:93-107`, `:114-124`, `:31-34`). | **SURVIVES LOCALLY / I-01**, but the larger gate is blocked by I-02. |
| `:39` UC-002 deployed/prospective structure | The structured flow distinguishes active policy, deployed #870, and prospective DRR, but still includes retired `MaxGrantCost` (`ontology/docs/use-cases.yaml:21-33`). | **REGRESSION: I-01 and I-04.** |
| `:40` checkout exclusion overreach | Scope and CQ-009 limit exclusion to FullProofWork (`ontology/docs/scope.md:46-55`; `ontology/tests/cq-009.sparql:6-10`). | **SURVIVES EXECUTABLY / I-01 for scope authority.** |
| `:41` retained proof lock | The baseline still says #870 layered over the retained lock (`research/kpi-baseline-2026-08-27.md:3-12`), but the event registry again says the bounce lock is replaced (`research/control-interventions.yaml:18-23`). | **REGRESSION: I-06.** |
| `:42` staggered adoption | KPI membership requires checkout ancestry (`research/kpi-measurement-rules.md:35-39`); iv-870 repeats the adoption qualification (`research/control-interventions.yaml:25`), backed by the checkout census (`research/evidence/journal-snapshot-2026-08-27/CHECKOUT_HEADS.txt:1-28`). | **SURVIVES.** |
| `:43` bounce exclusion meaning | The baseline says only opening/counts lose bounce attempts while interior waiting stays (`research/kpi-baseline-2026-08-27.md:113-118`). | **SURVIVES.** |
| `:44` right-censor age label | The probe labels span to last recorded event as a lower bound without common cutoff (`research/scripts/kpi_baseline_probe.py:211-217`). | **SURVIVES.** |
| `:45` skipped schema assertion | Both journal and verdict versions are checked, and the output says skipped rather than asserted (`research/scripts/kpi_baseline_probe.py:85-101`, `:116-123`). | **SURVIVES.** |
| `:46` prose bounce classifier | The probe labels the classifier as a prose heuristic (`research/scripts/kpi_baseline_probe.py:38-40`), and the baseline records that limitation (`research/kpi-baseline-2026-08-27.md:124-128`). | **SURVIVES.** |
| `:47` CI-duration overclaim | The baseline now identifies the measure as a workflow-duration sample (`research/kpi-baseline-2026-08-27.md:174-177`). | **SURVIVES.** |
| `:48` single-checkout intro | The baseline opens as a fleet snapshot rather than a single-checkout claim (`research/kpi-baseline-2026-08-27.md:21-24`). | **SURVIVES.** |
| `:49` unqualified 17%/59% | Both figures are explicitly pre-intervention (`ontology/docs/scope.md:22-24`; `ontology/docs/orsd.md:93-97`). | **SURVIVES LOCALLY / I-01.** |
| `:50` constitutional source vein | The corrective ruling names retained `attempts.ndjson` and the real topology command (`DECISIONS.md:165-183`). | **SURVIVES.** |
| `:51` unit-7 facts schema | The lane contract has a separate fact record with subject, predicate, value, type, provenance, and admission fields (`ontology/docs/s4-lane-contract.md:114-124`). | **SURVIVES LOCALLY / I-01.** |
| `:52` topology command spelling | The contract uses `bun run beep topo-sort` and assigns edges to package manifests (`ontology/docs/s4-lane-contract.md:28-30`). | **SURVIVES LOCALLY / I-01.** |
| `:53` telemetry freeze | The contract names five inputs, corpus commit, and SHA-256 procedure (`ontology/docs/s4-lane-contract.md:12-20`, `:68-77`); the snapshot manifests 245 journal digests and 28 checkout heads (`research/evidence/journal-snapshot-2026-08-27/MANIFEST.md:11-15`). | **CONTENT SURVIVES, but source freeze is blocked by I-01.** |
| `:54` executable completion carrier | `validate_packet.py` exists, but its entire executable body is packet validation (`research/scripts/validate_packet.py:41-225`); it never parses or validates the named lane argument. | **REGRESSION: I-08.** |
| `:55` ledger schema/S5 coverage | The contract defines normalized candidate/fact/issue merge outputs and total S5 dispositions (`ontology/docs/s4-lane-contract.md:169-187`). | **SURVIVES LOCALLY / I-01**, subject to the obsolete-gate blocker I-02. |
| `:56` full source paths | The contract now names the design record but still abbreviates three TypeScript paths with `.../` (`ontology/docs/s4-lane-contract.md:31-34`). | **REGRESSION: I-07** (and I-01). |
| `:57` runner/model provenance | The prescribed command pins `-m gpt-5.6-sol` (`ontology/docs/s4-lane-contract.md:210-215`). | **SURVIVES LOCALLY / I-01.** |
| `:58` ORSD glossary count | ORSD states 40 classes, 69 properties, and 4 individuals (`ontology/docs/orsd.md:64-69`), matching the parsed CSV. | **SURVIVES LOCALLY / I-01.** |
| `:64` CQ-019 circularity | CQ-019 now has fail-open-trust and scope-provenance-gap arms (`ontology/tests/cq-019.sparql:6-19`), and both populations are mandatory in the harness (`research/scripts/run_cq_suite.py:43-50`). | **SURVIVES EXECUTABLY.** Authority remains I-01. |
| `:65` CQ-012 omitted queue share | Queue contributes to the numerator, required decomposition, and generated matrix (`ontology/tests/cq-012.sparql:6`, `:24-29`; `ontology/docs/traceability-matrix.csv:13`). | **SURVIVES EXECUTABLY / I-01 for generated authority.** |
| `:66` self-erasing #870 evidence | Snapshot manifests and digests remain (`research/evidence/journal-snapshot-2026-08-27/MANIFEST.md:1-15`; `research/evidence/journal-snapshot-2026-08-27/SHA256SUMS.txt:1-245`), but the intervention record now conflicts with its baseline on causal naming and retained-lock behavior. | **PARTIAL REGRESSION: I-05 and I-06.** |
| `:71` checker/harness ownership | Validator known limits remain explicit (`research/scripts/validate_packet.py:5-10`), while the harness executes every generated test and fixture (`research/scripts/run_cq_suite.py:1-20`, `:109-185`). | **SURVIVES.** This does not cure the separate missing S4-lane mode, I-08. |
| `:73` seeded graph | The seed is present and loaded before all CQ tests (`ontology/tests/fixtures/seed.ttl:1-5`; `research/scripts/run_cq_suite.py:109-114`). | **SURVIVES EXECUTABLY.** |
| `:74` CQ-007 binding wording | The generated header says “a given episode” and the VALUES row is harness-bound (`ontology/tests/cq-007.sparql:1`, `:5-10`). | **SURVIVES EXECUTABLY.** |

Round-2 result: 35 rows preserve their repair content at least locally; rows 39, 41,
54, 56, and 66 have current partial or full regressions. The census includes all 40
dispositions containing `FIXED`; no such row was skipped. In particular, every required
seat-E query repair passes, the seat-F full-proof/topo/adoption repairs survive, and
seat-G's CQ-019 repair is now the required two-arm form.

### Deferred, rejected, recorded, and superseded dispositions

- Round-1 grill rows (`research/reviews/pre-s4/round1-triage.md:16`, `:55`, `:59`, `:79-80`, `:84`,
  `:86-89`, `:120`) are no longer falsely open: their decisions are the twelve final
  rulings at `DECISIONS.md:270-370`, and their application status is in the ruling map
  above.
- The S6 vacuity/closure deferral (`research/reviews/pre-s4/round1-triage.md:81`) remains honestly staged:
  local `ontology/docs/closed-world.yaml:1-15` supplies declarations now, the harness
  enforces non-vacuous antecedents (`research/scripts/run_cq_suite.py:33-57`), and the
  closure contract assigns SHACL enforcement to S6 (`ontology/docs/closed-world.yaml:4-9`).
  I-01 still prevents the closure authority from existing in a clean checkout.
- CQ-012 demotion remains explicitly rejected (`research/reviews/pre-s4/round1-triage.md:82`); it is still Must
  and now has full counts plus a nonzero guard (`ontology/docs/competency-questions.yaml:281-323`;
  `ontology/tests/cq-012.sparql:6-29`).
- LaneKind's S5 revisit remains recorded (`research/reviews/pre-s4/round1-triage.md:83`); the current glossary
  and literal domain retain it (`ontology/docs/pre-glossary.csv:3`;
  `ontology/docs/literal-domains.md:3-8`).
- Negative/metamorphic fixtures remain an S6 posture and already have executable
  installments (`research/reviews/pre-s4/round1-triage.md:121`; `research/scripts/run_cq_suite.py:59-72`). The
  survival-estimator upgrade remains explicitly deferred (`research/reviews/pre-s4/round1-triage.md:122`); v1
  reports censored spans separately (`research/scripts/kpi_baseline_probe.py:211-217`).
- The source-freeze adoption (`research/reviews/pre-s4/round1-triage.md:123`) is **not honestly complete**:
  although five local digests exist, all five frozen authority inputs are absent from
  `HEAD` (I-01). The rejected reviewer-context artifact remains recorded with its reason
  (`research/reviews/pre-s4/round1-triage.md:124`).
- Round-2's temporal-vocabulary concerns remain explicitly staged rather than silently
  cleared: CQ-013 flags retroactive `attributedDelayMs` for S5
  (`research/reviews/pre-s4/round2-triage.md:67`; `ontology/docs/competency-questions.yaml:352`), and CQ-014/015
  retain the epoch-grain caveat (`research/reviews/pre-s4/round2-triage.md:68`;
  `ontology/docs/competency-questions.yaml:374`, `:394`).
- Round-3 reservation/fixer-independence rows are being executed by this report
  (`research/reviews/pre-s4/round2-triage.md:69-70`). The effort/capability action remains the executing 25-test,
  12-fixture harness (`research/reviews/pre-s4/round2-triage.md:72`; `research/scripts/run_cq_suite.py:59-72`,
  `:109-185`). The requireds-versus-query limitation remains disclosed
  (`research/reviews/pre-s4/round2-triage.md:75`; `research/scripts/validate_packet.py:5-10`).
- Foundational partner-review S5/S8 carriers remain recorded, not claimed complete
  (`research/reviews/pre-s4/round2-triage.md:135-139`). All three Won'ts remain verbatim at
  `ontology/docs/competency-questions.yaml:660-663`.

## Internal-consistency audit

### Counts and generated cross-references

The working-tree counts are internally exact:

| Surface | Declared | Read-only census | Result |
|---|---:|---:|---|
| ORSD §5.2 CQs (`ontology/docs/orsd.md:55-62`) | 18 Must, 7 Should, 1 Could, 3 recorded Won'ts | 26 YAML CQ records: 18/7/1; the three Won'ts are recorded comments at `ontology/docs/competency-questions.yaml:660-663` | **PASS locally** |
| ORSD §6 glossary (`ontology/docs/orsd.md:64-69`) | 40 classes, 69 properties, 4 individuals | 113 CSV data rows: 40/69/4 | **PASS locally** |
| README current suite (`README.md:22-24`, `:77-91`) | 25 generated tests, 12 must-fail fixtures | 25 `ontology/tests/cq-*.sparql` files; 25 manifest entries; 12 fixture registrations at `research/scripts/run_cq_suite.py:59-72` | **PASS** |
| Traceability matrix | One row per Must/Should CQ | 25 rows, exactly CQ-001 through CQ-017 and CQ-019 through CQ-026 | **PASS locally** |

I did not run the destructive generator. I reproduced
`research/scripts/regen_cq_artifacts.py:57-102` in memory from the current CQ and
use-case YAML. All 25 SPARQL files, `cq-test-manifest.yaml`, and
`traceability-matrix.csv` matched the generated bytes exactly. Thus there is no
post-rewrite generated-artifact drift in this working tree. I-01 still means the
authority YAML and generated matrix are not present in `HEAD`.

The two-kind audit deliberately used the ruled Must/Should roots rather than copying
the validator's implementation. It found the two false licenses proved in I-03:
`dependsOn` and `estimatedFailureProbability`. That is why the file-count and generated-
byte passes do not validate the README's `0 WARNS` claim (`README.md:22-25`, `:89-91`).

### README, manifest, and trail state

`ops/manifest.json:8` has `openQuestions: []`. That is honest with respect to decision
state because `DECISIONS.md:347-370` closes the frontier and labels the remaining items
as work. The README's sequencing — round 3 before S4 — is likewise current
(`README.md:20-29`). Its completion assertions are not: "application pass is APPLIED,"
"all 12 grill rulings applied and executing," the FULL skill gate, and validator 0/0
are contradicted by I-01 through I-08 (`README.md:22-29`, `:77-92`). The Trail therefore
describes the intended local delta, not a landed, clean-checkout result.

### Frozen inputs and S4 source surface

All five frozen inputs named at `ontology/docs/s4-lane-contract.md:12-20` exist in this
working tree and hash as follows:

| Frozen input | SHA-256 |
|---|---|
| `ontology/docs/competency-questions.yaml` | `02c72aaa72e0731c39d8192956801c850f98e5a29209db470d13219dd35fe8ba` |
| `ontology/docs/pre-glossary.csv` | `9c8feff3c5128e775dd53c9c8cb37dc65ae9c4362626f84126df60c62e92e67c` |
| `ontology/docs/literal-domains.md` | `110721b3839c105173d871fbc6d2f5a0da6c8895f8ffefcd2fa6408e93bb65cc` |
| `ontology/docs/orsd.md` | `51ee2dcda09f886f39c860251f26164fdbed58cb5b24e0fab052dbdee02ef243` |
| `ontology/docs/scope.md` | `6bb45d7e049072640b56ad821cf331969be1d9d216ee8ffbad20bfb2e8da4f0d` |

None is in `git ls-files` or `HEAD`, so the local hashes do not supply the required Git
freeze (I-01). Every source intended by units 1-7 also exists when the abbreviations are
manually expanded, including the named admission design record; the contract itself
does not provide those exact expansions for three paths (I-07).

### Closure surface

`closed-world.yaml` parses as 13 predicate records. Every record has `predicate`,
`world`, `complete_within`, `source`, `freshness`, and `negations`, as required by its
header (`ontology/docs/closed-world.yaml:1-15`). The set covers every predicate used by
the current negation/completeness-sensitive queries, including invalidation and
obligation discharge (`:25-51`), lane/cost coverage (`:53-66`), grant provenance and
starvation exceptions (`:68-82`), and CQ-019 scope provenance (`:84-90`). The content is
coherent locally; its absence from `HEAD` remains I-01.

### Relative links

A read-only scan of the 37 Markdown files touched by the application commit plus the
local ontology Markdown checked 204 relative links and found zero missing targets in
the current working tree. This is a local-state pass only. In the committed tree,
README links such as `README.md:27-29` and `README.md:86-88` target the ignored
`ontology/docs/` surface and therefore resolve to no object in `HEAD` (I-01).

### NOTE I-N01: the harness has a non-semantic API deprecation

The executing suite passed, but PyOxigraph warns that the positional format argument in
`Store.load` is deprecated at `research/scripts/run_cq_suite.py:82-86`. This is not a CQ
semantic failure and does not change the blocker result; it is a future maintenance
note.

No additional `WARN`-severity audit finding was found. The disposition is
**8 BLOCKER / 0 WARN**; S4 must not launch from this state.

## Read-only verification record

All Git commands were read-only. No generator or repair command was run.

| Check | Command/result |
|---|---|
| Required corpus ancestry | `git merge-base --is-ancestor debbbb51f7 HEAD` → exit 0; `git merge-base debbbb51f7 HEAD` → `debbbb51f77ae10015788dec0b819f12b96c3552` |
| Current commit | `git rev-parse HEAD` → `b28b0724f45b5ddfe792bcf074f9b7667c42f264`; it is a merge commit whose subject records the corpus pin. |
| Authority tracking | `git ls-files explorations/beep-ci-operational-ontology/ontology/docs` → no output; `git cat-file -e HEAD:<each of nine paths>` → exit 128 for each. `.gitignore:48` is the matching `**/docs` rule. |
| Packet validator | `PYTHONDONTWRITEBYTECODE=1 ... python research/scripts/validate_packet.py` → exit 0, 26 CQs, 5 UCs, 25 manifest entries, 25 parsed SPARQL files, 40/69/4 glossary, `RESULT: 0 blockers, 0 warns`. I-03 explains why that result is unsound. |
| Missing lane mode | The same validator with `--s4-lane /definitely/missing/s4-lane.yaml` → exit 0 and the same ordinary packet result, proving the argument is ignored. |
| Executing suite | `PYTHONDONTWRITEBYTECODE=1 ... python research/scripts/run_cq_suite.py` → exit 0; all 25 seed tests and all 12 must-fail fixtures passed, including the required CQ-004, CQ-006, CQ-012, CQ-013, and CQ-019 cases. |
| Generated surfaces | Read-only in-memory reproduction of `regen_cq_artifacts.py` → `testable=25`, all queries exact, manifest exact, traceability exact. |
| Counts/two-kind/closure | Read-only parser census → 26 CQs (18/7/1), 113 glossary rows (40/69/4), two unlicensed Must/Should terms, 13 complete closure records. |
| Links | Application-pass Markdown plus local ontology Markdown → 37 files, 204 relative links, zero missing in the working tree. |
