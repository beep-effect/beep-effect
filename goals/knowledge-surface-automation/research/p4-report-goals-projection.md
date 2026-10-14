# P4 report — capability projection over the live census (FP-eyeball input)

Status: phase-0 evidence for Workstream D's projection slice. Read-only: every number
below came from `bun run beep goals next|explain|catalog` against the tracked
`goals/*/ops/manifest.json` census on 2026-10-13 (base `main` at `6eb3d03677`). No
manifest, index, or doctor rule was changed to produce it. Doctor gates for the
D5/D8 finding classes (design PR 3) and the Mermaid INDEX block (PR 2) wait for this
report's verdict.

Design: `research/p4-goals-projection-design.md`. Mini-grill outcomes:
`research/p4-goals-projection-decisions.md` (G1–G6).

## What shipped

- `Graph.schemas.ts`: the projection rows, the engine-neutral `CapabilityGraphAnswers`
  value, and the three versioned reports (`goal-frontier/v1`, `goal-explain/v1`,
  `capability-catalog/v1`). Readiness is a single-member `nominal` literal kit;
  evidence-backed readiness joins later as a second member.
- `Graph.projection.ts`: the pure `compileCapabilityProjection`, the pure-TS reference
  evaluator `evaluateCapabilityGraph`, and the report builders and renderers.
- `Graph.sqlite.ts`: the SQL engine. Availability, fog, and frontier are plain
  queries; cycles and unlock walks are recursive CTEs. It is written against the
  Effect `SqlClient` service. `GraphSqliteLive` supplies a fresh `:memory:` database:
  `bun:sqlite` under Bun (every CLI run) and `node:sqlite` only when Node loads the
  module (the hosted coverage lane's test workers). See "Engine deviation" below.
- `Graph.ts`: the fail-closed census loader and the three read-only subcommands.

## Proof

`packages/tooling/tool/cli/test/goals-graph.test.ts`, 14 tests, green under both
`bunx --bun vitest` and the Node coverage path:

- **Differential.** The six sealed fixtures (AND gate, orphan, cycle, completed
  provider, multi-provider OR, duplicate/order) plus a D7 control (route through a
  non-execution-capable packet) and a D8 control (superseded and reference providers).
  Each fixture is compiled from manifests in forward, reverse, and seeded-shuffle
  order, and the SQL engine is loaded with its row families in the same three orders.
  The canonical JSON of the projection and of the SQL answers must equal the reference
  evaluator's byte for byte in every order.
- **Generated differential.** A schema-derived property (`Arbitrary.schema` over small
  generated censuses on a dense four-capability alphabet, 64 runs) requires the SQL and
  reference answers to match byte for byte, covering graph shapes beyond the fixtures.
- **Evergreen census.** Every tracked manifest decodes, the SQL answers equal the
  reference answers on the live census, this packet is the provider of its four
  capabilities, and `git status --porcelain` is identical before and after.
- **Command surface.** JSON and human output for all three commands; an unknown slug
  fails with the `goals bootstrap` funnel message; an invalid slug, an undecodable
  manifest, unparsable JSON, a missing manifest, and an `initiative.id` that differs
  from its directory each refuse the whole projection.
- **Coverage.** `Graph.projection.ts` 100% lines; `Graph.sqlite.ts` 96.7% lines under
  Node. The two uncovered lines are the Bun import branch, which every Bun run executes.

## Live census

Corrected 2026-10-14 per the independent verdict (`research/p1-fp-eyeball-verdicts.md`,
Workstream D projection): the first draft counted `goals/_template`, which the loader
excludes, and misattributed two fog providers.

| Measure | Value |
| --- | --- |
| Packets | 211 (51 active, 15 paused, 140 completed-retained, 4 reference, 1 superseded) |
| Packets declaring any capability | 28 |
| Capabilities | 45 |
| Actionable frontier | 43 |
| Active but blocked | 7 |
| Active, not execution-capable | 1 (`agentic-professional-runtime`) |
| Fog capabilities | 4 |
| Cycles | 0 |
| Collisions (D4) | 0 |
| Duplicate declarations (D5) | 0 |
| Stranded capabilities (D8) | 0 |
| Reference-provided capabilities (D8) | 0 |

Of the 43 frontier packets, 42 declare no requirements, so they are vacuously ready;
one (`coding-agent-effectiveness-evidence-loop`) is ready because
`harness-evidence-ledger` completed `tooling/harness-ledger`. The frontier answers
"what may start", not "what to do next". Prioritisation is out of v1 scope.

The blocked set is the graph's real signal: the fleet chain
(`fleet-root-registry` → `lane-bootstrap`/`ops-seat-timers` → `legacy-drain`, plus
`ai-metrics-raw-retention` on `fleet/ops-seat`), `canonical-proof-reconciliation`
on `slice-topology-audit`, `semantica-reasoning-spike` on
`semantica-storage-inversion`, and `practice-mail-tagging` on three fog capabilities.
`goals explain legacy-drain` reports `fleet-root-registry` (ready),
`lane-bootstrap`, and `ops-seat-timers` at depth 1, which matches the packets'
own plans.

## Candidate false positives

The engine produced no false positives on the live census: every flagged row
traces to manifest content. The four fog rows are true positives of a kind the
projection cannot fix by itself. Each names an ability that an existing packet
delivered or is building but never declared:

| Fog capability | Consumer | Likely provider (undeclared) |
| --- | --- | --- |
| `box/driver` | `practice-mail-tagging` | `box-driver` (completed-retained, `provides` absent) |
| `law-practice/practice-kg-matter-lookup` | `practice-mail-tagging` | `practice-kg-mcp` (completed-retained, `provides` absent) |
| `m365/message-category-write` | `practice-mail-tagging` | `practice-docket-intake` (completed-retained; the category verbs landed in #1456, `provides` absent) |
| `goals/packet-core` | `packet-convention-migration` (completed) | `packet-control-plane-core` (`provides` absent) |

Remedy, after the verdict: one manifest-only PR that adds the missing `provides`
declarations. All three providers are `completed-retained`, so after the fix
`practice-mail-tagging` turns ready (frontier 44), which matches its README and SPEC
D-43 (live, unattended category writes).

Two observations that are not engine findings:

1. **Namespace drift (D2).** The census uses both `practice/` (box tree, contacts,
   docket intake) and `law-practice/` (mail tagging, KG lookup) for the same domain.
   The strict grammar accepts both. A rename is a governed manifest edit (D3), not an
   alias. Recommend settling on one namespace in the same manifest PR.
2. **Completed consumer with a fog requirement.** `packet-convention-migration`
   completed while still declaring `goals/packet-core`, which nobody provides. A
   terminal packet never enters the frontier, so this is harmless, but it is the
   cleanest example of why declarations need a gate.

## Engine deviation from contract 1

The design's contract 1 named raw `bun:sqlite` behind `Effect.acquireRelease`. The
first implementation did exactly that, and the hosted coverage lane would have broken
on it. That lane runs vitest workers on Node 22 (`.github/workflows/heavy.yml`, the
`coverage` matrix entry), and a static `import "bun:sqlite"` fails at module load
there. Because `Graph.ts` is reachable from the Goals barrel and the root CLI, the
failure would have spread to every coverage test that imports the CLI, not only this
slice.

The engine now targets the `SqlClient` service (the Effect contract) and the layer
picks the driver at runtime by dynamic import, following the precedent of
`@beep/test-utils`'s SQLite test drivers. SPEC's ratified decision ("bun:sqlite
projection engine") still holds for every real run: the CLI only runs on Bun. The
Node driver exists so the same SQL is exercised where coverage is measured. Both
drivers are SQLite, so the recursive-CTE semantics are identical, and the
differential suite passes on both. Recorded in the SPEC Decision Log.

Reverse: if hosted coverage moves to Bun workers, drop the Node branch and the
`@effect/sql-sqlite-node` dependency. The engine code does not change.

## Asks for the verdict

1. Accept the four fog rows as true positives (undeclared providers), and authorise
   the manifest-only `provides` PR, including a `practice/` vs `law-practice/`
   namespace settlement.
2. Accept zero engine false positives as sufficient to unlock design PR 2 (Mermaid
   INDEX block with relic collapse, G4) and PR 3 (doctor findings: duplicate
   declaration under the ratchet, stranded advisory, reference-provides under the
   ratchet).
3. Accept the `SqlClient` engine deviation above.
