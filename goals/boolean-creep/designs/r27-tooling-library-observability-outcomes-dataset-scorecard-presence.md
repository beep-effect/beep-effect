# Outcomes dataset scorecard presence

Inventory id: `r27-tooling-library-observability-outcomes-dataset-scorecard-presence`.
P2 design only; derived, wire, tagged union, **Tier 2 singleton PR**.
Source: `8f266b878445ca8a7f751f9248da428a4dde39a1`; corpus main:
`663904610cce2a38c06b0619a8c414646b69361c`.

Qualification evidence is the native
[`observability carrier audit`](../data/design-refresh-2026-09-09-r27-observability-carriers.md)
and completed independent
[`correction report`](../data/sweeps/refresh-2026-09-09-r27-main-663904/r27-observability-contract-correction1.jsonl)
with its sibling execution receipt. The actual carrier is an `object-literal`,
which the binding inventory schema supports. The correction's historical
`sibling-state` label does not override that schema; preserve its raw report.
This document is not the replacement independent P3 review.

## Current shape

All source paths in the next sections are relative to
`packages/tooling/library/ai-metrics/` unless another root is named.

`outcomesDataset`, `src/agent-effectiveness.ts:3391`, creates one example whose
output is the returned object at `:3404` or `:3405`. The selected real members
are `completionReady` and `scorecardPresent`. With no scorecard both are false;
with a scorecard, presence is true and readiness is copied from the stored
summary. The present object also owns `scorecardId` and `totalScore`.
`AgentEffectivenessDatasetExample.output` at `:1541` widens this object to a
generic record; the source producer still owns the relationship.

The upstream Option is `doctor.aiMetrics.latestScorecard`. Its SQL query reads
`completion_ready` at `:2702`, and the summary constructor copies that bit at
`:2732`. Readiness is a stored judgment, including a supported false judgment
with a present scorecard. Neither this design nor its encoder recomputes it
from counts, coverage gaps, score magnitude, or a newer scorecard algorithm.
The withdrawn count-axis readiness designs remain historical; this case owns
the actual two-Boolean returned object only.

## Cardinality gap

The independent Boolean product has four states and three supported states.
Payload domains are retained without counting numeric predicates as members.

| `completionReady` | `scorecardPresent` | Source witness | Required payload |
| --- | --- | --- | --- |
| false | false | `latestScorecard=None`, `:3404` | Neither payload key exists. |
| false | true | `Some` of an unready summary, `:3405`; persisted false fixture in `test/agent-effectiveness.test.ts:109` | `scorecardId`, `totalScore` |
| true | true | `Some` of a ready summary, same arm; ready summary example at `:800` and produced weekly scorecard assertion in `test/ingest.test.ts:1119` | `scorecardId`, `totalScore` |

`true/false` has no producer. E1 is the shared Option branch, E3 is the payload
owned by presence, and E4 is readiness implying presence for this output.
An unready scorecard may have a zero or nonzero score. Preserve the full
`S.String` id and `S.Finite` score domains already declared by
`AgentEffectivenessScorecardSummary` at `:820`.

## Target schema

Graft onto the existing `src/agent-effectiveness.ts` dataset section first.
Keep the new model private: no new package, module, public export, dependency,
or generic dataset-envelope redesign is needed.

Define an annotated `LiteralKit(["absent", "unready", "ready"])` named
`AgentOutcomesEvidenceState`. Define three annotated `S.Class` members and
assemble `AgentOutcomesEvidence` through the kit's `.mapMembers(...)` and
`S.toTaggedUnion("state")`. Derive its same-name TypeScript alias from the
schema. The member fields are:

| `state` | Member payload |
| --- | --- |
| `absent` | None |
| `unready` | `scorecardId`, `totalScore` |
| `ready` | `scorecardId`, `totalScore` |

Reuse `AgentEffectivenessScorecardSummary.fields.scorecardId` and `.totalScore`
as the payload building blocks. There is no decoded `scorecardPresent` or
`completionReady` field on this model. Construct `absent` from None; within
Some, match the stored `scorecard.completionReady` with `effect/Boolean` and
construct exactly one present member carrying its id and score. The transient
model remains derived from the existing Option; it is not cached or persisted.

At the existing `datasetExample` output boundary, use the schema union's
`.match` to project the member to the exact flat output below. This total,
pure boundary projection keeps `makeAgentEffectivenessDatasetBundle`
synchronous. No new throwing sync schema codec or Effect service is required.
Only this final boundary projection emits the legacy Booleans. Never spread
the internal model into `output`, since that would publish `state`.

`AgentEffectivenessDatasetExample` remains a generic public envelope. Its
constructor and decoder still accept arbitrary output records, including the
documented default `{}`. This design does not install a restrictive decoder
over public caller-supplied bundles; it gives this particular generated output
an honest internal source model. A future typed read API for outputs would be
a separately reviewed extension, not an unneeded compatibility codec here.

## Migration inventory

| Writer, reader, or export | Migration or preservation obligation |
| --- | --- |
| `src/agent-effectiveness.ts:820`, `:888`, `:2699`, `:2732` — summary model, Option, SQL read and stored-bit copy | Read unchanged. Preserve summary payload, defaults, null handling, query ordering, and readiness judgment. |
| `src/agent-effectiveness.ts:3391`–`:3415` — sole outcomes output producer | Replace the flat flag/payload assembly with variant construction and its total boundary projection. Keep the example id, input counts, description, and kind. |
| `src/agent-effectiveness.ts:3330`, `:3345`, `:3362` — name, example, and spec helpers | Preserve `agent-outcomes-v1`, generic-record erasure at the final boundary, metadata and split defaults. |
| `src/agent-effectiveness.ts:1534`, `:1584`, `:1621` — public envelope schemas | No narrowing of their general accepted records. Preserve the dataset artifact version and JSON encoder. |
| `src/agent-effectiveness.ts:3540` — exported bundle producer | Remains synchronous; five datasets in the current order, same `generatedAt` and project name. |
| `src/agent-effectiveness.ts:3659`, `:3815`, `:3919` — experiment bundle and Phoenix sync/report flow | Same dataset identity, experiment specification, counts, dry-run behavior, confirmation handling, and error paths. |
| `src/agent-effectiveness.ts:3682`, `:3692`, `:3725` — Phoenix mapping and sync | Forward only the projected output; preserve create versus append selection and existing examples, metadata, split, and name. |
| `src/agent-effectiveness.ts:4153`, `:4171`, `:3939` — privacy scan of example output and bundle | Scan the same flat keys/values. No internal discriminator reaches this scan or changes its findings. |
| `src/agent-effectiveness.ts:4474` — public JSON renderer | Same complete bundle JSON, including omitted keys and field order. |
| `packages/tooling/tool/cli/src/commands/AgentEffectiveness/AgentEffectiveness.command.ts:232`, `:382`, `:400` | Dataset JSON, text summary, and experiment commands consume the unchanged bundle. No command flags, output envelope, or exit changes. |
| `src/index.ts:16` and package `./*` exports | Existing public module exports remain; the local model needs no new exports. |

Source search for `scorecardPresent` and `agent-outcomes-current` finds this
producer only. Generic record consumers are nevertheless included above;
searching only the property name would miss Phoenix and privacy readers.
The sibling configuration dataset is independently designed and lands in its
own Tier 2 PR. Reconcile shared-file edits serially without combining cases.

## Guard-deletion accounting

There is no existing contradictory-pair runtime validator to claim as deleted.
The concrete deletion is the parallel flag assembly and implicit truth-table
obligation in the `O.match` at `:3403`–`:3410`: None manually coordinates two
false bits, and Some manually coordinates a true bit, a readiness bit, and two
payload fields. Replace that obligation with named constructors whose shape
requires the right payload and with one exhaustive legacy-output projection.

The source Option branch and the selection by the stored readiness bit remain
necessary observations. The flat key assembly remains only in the explicit
encoded projection, where each schema variant determines every output field.
There is no runtime guard count reduction beyond this assembly obligation;
do not manufacture an unused validator just to delete it. SQL and privacy
checks are unrelated boundaries and remain in place.

## Encoded-side impact

No wire change. Preserve these exact output shapes and insertion order:

```json
{"completionReady":false,"scorecardPresent":false}
{"completionReady":false,"scorecardId":"scorecard-1","scorecardPresent":true,"totalScore":0}
{"completionReady":true,"scorecardId":"scorecard-1","scorecardPresent":true,"totalScore":0.91}
```

The example payload values above are illustrative; copy the original values
without normalization. In the absent case omit `scorecardId` and `totalScore`;
never substitute null, undefined-valued own properties, empty id, or zero score.
In both present cases retain both fields, including `totalScore=0`.

The enclosing example remains `agent-outcomes-current` with input
`benchmarkRunCount` and `labelCount`, default metadata `{}` and split
`current`. Preserve description, kind `agent-outcomes`, dataset name
`agent-outcomes-v1`, bundle version `agent-effectiveness-datasets/v1`, project,
timestamp, and all other dataset entries. `PhoenixDatasetExample.output`
receives the same object through `:3692`; dataset create and append requests
must have equivalent full payloads. There is no dataset recreation, storage
rewrite, new state field, or schema-version bump.

## Test impact

Implementation proof belongs in the eventual singleton PR; no product tests
were run or changed during P2.

1. Extend `test/agent-effectiveness.test.ts:847` with the three legal branches
   through the public bundle builder. For each, compare the complete relevant
   example and `agentEffectivenessDatasetBundleToJson` result against frozen
   pre-change expectations. Assert exact own-key omission and full present
   payloads; include unready/zero, unready/nonzero, and ready/zero-score payload
   preservation, plus stored false with otherwise positive counts.
2. Extend the existing Phoenix SDK stub at `:363` to capture complete create
   and append inputs. The current stub at `:386` and `:395` records only names,
   which is insufficient compatibility proof. Exercise both existing-dataset
   append (`:960`) and new-dataset create (`:891`), comparing each full output,
   id, metadata, input, split, and dataset name. Retain transport-failure and
   dry-run assertions without live Phoenix calls.
3. Keep `test/agent-effectiveness-laws.test.ts:33` and `:64` proving report
   Option/null handling and bundle-version defaults. Add a generic envelope
   round-trip with an arbitrary output record to prove that the public model
   was not narrowed to the generated examples.
4. Preserve `packages/tooling/tool/cli/test/agent-effectiveness-command.test.ts:274`
   JSON coverage and experiment/text behavior. The normal CLI fixture should
   assert the unchanged generated outcome object, not merely five datasets.
5. Type-check the constructor/projection exhaustiveness. The model has no
   `true/false` tuple or missing payload on a present branch to construct.
   Run required `@beep/repo-ai-metrics` package verification; if CLI tests are
   edited, verify `@beep/repo-cli` too, then the prescribed Yeet gates.

## Risk

The principal risk is replacing a stored readiness judgment with a newly
derived scorecard policy. The source-copy rule and false-with-positive-counts
fixture prohibit that. Other risks are leaking the discriminator to Phoenix,
dropping unready payloads, changing omission/order, narrowing the generic
public envelope, and treating required count or score values as Boolean axes.
All are covered by the full-bundle and SDK-argument compatibility matrix.

The change is local in code but wire-exposed, so it remains a Tier 2 singleton
PR after independent review and GATE 2. Rollback is the code change; emitted
artifacts require no migration because their encoded shape is unchanged.
This source-inspected design is not compiled proof, a package handoff, or an
implementation approval. Source drift requires refreshing these anchors and
the compatibility fixtures before application.
