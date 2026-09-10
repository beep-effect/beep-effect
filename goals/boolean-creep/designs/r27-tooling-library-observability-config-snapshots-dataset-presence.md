# Configuration-snapshot dataset presence

Inventory id: `r27-tooling-library-observability-config-snapshots-dataset-presence`.
P2 design only; derived, wire, tagged union, **Tier 2 singleton PR**.
Source: `8f266b878445ca8a7f751f9248da428a4dde39a1`; corpus main:
`663904610cce2a38c06b0619a8c414646b69361c`.

Qualification evidence is the native
[`observability carrier audit`](../data/design-refresh-2026-09-09-r27-observability-carriers.md)
and the completed independent
[`correction report`](../data/sweeps/refresh-2026-09-09-r27-main-663904/r27-observability-contract-correction1.jsonl)
with its sibling execution receipt. The returned carrier is `object-literal`
under the binding inventory schema. Preserve the raw report's historical
`sibling-state` label without treating it as a schema restriction. This is a
P2 artifact and does not supply independent P3 approval.

## Current shape

Paths are relative to `packages/tooling/library/ai-metrics/` unless another
root is named. `configSnapshotsDataset`, `src/agent-effectiveness.ts:3418`,
projects `doctor.aiMetrics.latestForwarder` at `:3429`. The None arm at `:3431`
returns only `{ configSnapshotPresent: false }`. The Some arm at `:3432`
returns `archiveObjectCount`, `configSnapshotId`, `configSnapshotPresent: true`,
`ingestRunId`, and `turnCount`.

These are actual properties of a returned object. The optional id's absence is
real: the None arm omits the key. This differs from inventing a presence flag
for one of the required numeric counts. The object reaches the generic
`AgentEffectivenessDatasetExample.output` record at `:1541`, then public bundle
JSON and Phoenix example inputs.

`AgentEffectivenessForwarderSummary` at `:759` supplies the complete payload.
Its query at `:2688` takes the latest ingest run by completion time; the
summary's optional presence is exposed on `AgentEffectivenessAiMetricsSection`
at `:887`. This design does not change the query or invent a new snapshot
lookup and does not inspect counts to decide whether the summary exists.

## Cardinality gap

The selected product is Boolean × id presence: four structural states, two
legal states.

| `configSnapshotPresent` | `configSnapshotId` | Witness and complete output payload |
| --- | --- | --- |
| false | absent | None at `:3431`; all four payload keys are absent. |
| true | present | Some at `:3432`; id, `archiveObjectCount`, `ingestRunId`, and `turnCount` are all copied. |

False with an id and true without an id have no producer. E1 is the shared
upstream Option branch; E3 is the four-field payload owned by presence. Id
values remain `S.String`, including its existing empty-string acceptance;
counts remain `S.Finite`, including zero. A count's sign or zero/nonzero split
does not form another inventory axis or authorize narrowing its schema.

## Target schema

Add a private annotated `AgentConfigSnapshotEvidenceState` with
`LiteralKit(["absent", "present"])` next to the dataset builders in the
existing `src/agent-effectiveness.ts`. Build annotated `S.Class` members and
assemble `AgentConfigSnapshotEvidence` with `.mapMembers(...)` and
`S.toTaggedUnion("state")`, deriving its TypeScript alias from the schema.

| `state` | Member payload |
| --- | --- |
| `absent` | None |
| `present` | `archiveObjectCount`, `configSnapshotId`, `ingestRunId`, `turnCount` |

Reuse those exact field schemas from
`AgentEffectivenessForwarderSummary.fields`. There is no decoded presence
Boolean or partial optional-payload bag. The only construction decision is
the existing `latestForwarder` Option: None constructs `absent`; Some
constructs `present` with all four values. This transient union is derived
evidence and is not a new stored cache.

Project the union with its schema-derived `.match` at the `datasetExample`
output boundary. The absent arm emits the single false property; the present
arm emits the four payload fields and true in the original order. No internal
`state` reaches the public record. This total pure projection preserves the
public synchronous builder and requires no new sync codec or service.

Keep `AgentEffectivenessDatasetExample.output` generic. Caller-supplied bundle
records and its default `{}` remain accepted. The producer's named model
protects its derivation before the generic wire boundary; it does not impose
this generated-output contract on every externally supplied example. There
is no typed output read API to migrate and no need to invent one.

## Migration inventory

| Writer, reader, or export | Migration or preservation obligation |
| --- | --- |
| `src/agent-effectiveness.ts:759`, `:887`, `:2688` — forwarder summary, Option, SQL query | Read unchanged; preserve ordering, numeric/id schemas, null handling and full summary payload. |
| `src/agent-effectiveness.ts:3418`–`:3443` — sole configuration output producer | Construct the private union and project it at the wire boundary. Preserve all four payload values. |
| `src/agent-effectiveness.ts:3330`, `:3345`, `:3362` — name/example/spec helpers | Same versioned dataset name, example id, description, input, split and metadata defaults. |
| `src/agent-effectiveness.ts:1534`, `:1584`, `:1621` — generic envelope schemas | Preserve their general accepted record shapes, artifact version and JSON encoding. |
| `src/agent-effectiveness.ts:3540` — public bundle builder | Same synchronous signature, five datasets in order, timestamp and project. |
| `src/agent-effectiveness.ts:3659`, `:3815`, `:3919` — experiment specification and sync/report callers | Same identities, counts, dry-run and confirmation behavior. |
| `src/agent-effectiveness.ts:3682`, `:3692`, `:3725` — Phoenix adapter and create/append branches | Forward the identical example output, metadata, id, input and split; preserve dataset selection and errors. |
| `src/agent-effectiveness.ts:4153`, `:4171`, `:3939` — example and bundle privacy checks | Inspect the same flat record. Do not add a state tag or bypass scanning. |
| `src/agent-effectiveness.ts:4474` — public JSON helper | Same bytes for deterministic fixture bundles, including absent keys and output field order. |
| `packages/tooling/tool/cli/src/commands/AgentEffectiveness/AgentEffectiveness.command.ts:232`, `:382`, `:400` | Preserve dataset JSON/text and experiment output. |
| `src/index.ts:16`, package `./*` exports | Keep the current public module surface; private evidence schemas need no export. |

Source searches for `configSnapshotPresent` and `config-snapshot-current`
find this sole producer; the generic consumers above remain compatibility
dependencies even though they do not name these fields. No new file role or
package is needed. The separate outcomes-dataset design may touch the same
source and tests; land the two singleton PRs serially and preserve each
other's already-reviewed changes.

## Guard-deletion accounting

Delete the producer's manual presence/payload coherence obligation at
`:3430`–`:3438`: the boolean and four fields are currently coordinated only by
the author of two object literals. Named absent/present constructors own that
relationship; the present constructor cannot omit one of its payload fields.
The final schema matcher is the single explicit flat-wire projection.

No runtime contradiction check currently exists here. Do not claim one was
removed, and do not add a synthetic guard merely to report its deletion. The
Option branch remains because it observes actual absence. Flat field mapping
remains at the encoded boundary; query decoding, general dataset defaults,
Phoenix error classification, and privacy checks remain necessary.

## Encoded-side impact

Preserve the exact output shapes and original property insertion order:

```json
{"configSnapshotPresent":false}
{"archiveObjectCount":0,"configSnapshotId":"config-1","configSnapshotPresent":true,"ingestRunId":"run-1","turnCount":0}
```

The absent arm omits all four payload keys. The present arm retains all four,
including zero counts and every accepted id string. Never substitute null,
undefined-valued own keys, or fabricated empty payloads for None; never omit
present values by truthiness.

Keep example id `config-snapshot-current`, input `dataRoot` and `target`,
metadata `{}`, split `current`, kind `agent-config-snapshots`, name
`agent-config-snapshots-v1`, description, bundle version
`agent-effectiveness-datasets/v1`, timestamp, project, and the other four
datasets. Phoenix receives the same examples whether the dataset is newly
created or receives appended examples. No record is rewritten, no dataset is
recreated, and no version is bumped. The upstream report's encoded Option
uses null; the dataset output's absent payload uses omission. Preserve that
deliberate difference rather than applying one absence convention globally.

## Test impact

These are required implementation checks; none were executed during P2.

1. Extend `test/agent-effectiveness.test.ts:847` with None and Some forwarder
   fixtures through the public bundle builder. Assert the complete example,
   exact own-key absence, full-bundle JSON parity, original output field
   order, and zero/nonzero count payloads. Include accepted empty id strings
   at the schema boundary so a future truthiness check cannot silently erase
   a present snapshot.
2. Capture full Phoenix create and append requests in the existing SDK stub
   at `:363`. Name-only recording at `:386` and `:395` is insufficient; compare
   every example field for both absence and presence through new-dataset
   creation (`:891`) and existing-dataset append (`:960`). Preserve dry-run,
   no-write-on-transport-failure, and experiment behavior without live calls.
3. Retain `test/agent-effectiveness-laws.test.ts:33` report null/Option proof
   and `:64` version/default proof. Verify that generic public examples with
   arbitrary output records still round-trip and that the default output
   remains `{}`.
4. Extend or preserve
   `packages/tooling/tool/cli/test/agent-effectiveness-command.test.ts:274`
   so the actual generated configuration example is compared, alongside the
   existing dataset-count and sanitized-output assertions.
5. Type-check the exhaustive two-arm projection and required present fields.
   Run mandatory `@beep/repo-ai-metrics` package verification and
   `@beep/repo-cli` verification if CLI tests are edited, followed by the
   prescribed Yeet proof for the singleton PR.

## Risk

The main risks are losing one of the companion payload fields, dropping zero
counts or empty ids by truthiness, leaking `state`, confusing report nulls
with dataset omission, or narrowing the generic envelope. Exact branch
fixtures plus complete Phoenix request capture address those risks.

This case changes the local derived model while preserving application-owned
wire data, so it remains Tier 2 despite its small producer. It has no stored
readiness judgment to redesign; it must not revive either withdrawn count-axis
case or alter scorecard policy. Source inspection supports this design but
does not replace compilation, implementation tests, independent P3 review,
or GATE 2. Refresh the frozen anchors before application. Rollback needs only
the code change because encoded artifacts remain compatible.
