# Instance

- id: `ai-metrics-phoenix-sync-policy`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/library/ai-metrics/src/agent-effectiveness.ts:2012`
- symbol: `AgentEffectivenessPhoenixSyncResult`
- members: `dryRun`, `mutationPolicy`
- evidence: E3/E1 at `agent-effectiveness.ts:3814-3855,3917-4019` — seven
  sync policies determine the dry-run bit, and every result writer emits only
  the matching tuple.

# Current shape

The exported result schema stores counts, `dryRun`, the eight-value shared
`AgentEffectivenessMutationPolicy`, status, and written-id arrays. Its JSON
encoder is at lines 2032 and 4604-4610. The command renders both fields at
`AgentEffectiveness.command.ts:293-317` and emits JSON before converting failed
status to the command exit at lines 424-460. Schema-derived arbitrary tests at
`agent-effectiveness-command.test.ts:118-152` currently generate all 16 pairs,
but that proves codec permissiveness rather than supported sync behavior.

# Cardinality gap

Eight policy literals times one boolean give 16 representable tuples. The sync
writer supports exactly seven:

| dryRun | mutationPolicy |
| --- | --- |
| true | `dry-run-annotation-check-failed` |
| false | `blocked-annotation-check-failed` |
| true | `dry-run-dataset-check-failed` |
| false | `blocked-dataset-check-failed` |
| true | `dry-run-no-phoenix-mutation` |
| false | `blocked-missing-confirmation-token` |
| false | `confirmed-phoenix-write` |

`local-only-no-phoenix-mutation` is the legitimate eighth value of the shared
policy, but only for `AgentEffectivenessAnnotationPlan` at lines 1266-1288 and
3321-3327. It is not a Phoenix sync result under either boolean.

# Target schema

Keep `AgentEffectivenessMutationPolicy` unchanged for annotation-plan
compatibility. Define `AgentEffectivenessPhoenixSyncPolicy` as an annotated
LiteralKit over the seven exact sync values, preferably via
`AgentEffectivenessMutationPolicy.pickOptions(...)`. The decoded sync result
retains a single `mutationPolicy` of that narrower type and removes `dryRun`;
export a derived policy guard/helper for rendering when needed.

Keep a private encoded result schema with all current fields and property order,
including `dryRun: S.Boolean` and the existing eight-value policy schema. A
fallible `S.decodeTo` transformation accepts the seven supported pairs, derives
or verifies dry-run from policy, rejects the other nine, and encodes the exact
inverse.

# Migration inventory

- `agent-effectiveness.ts:275-311` — retain the shared eight-value policy and
  add the seven-value Phoenix subset plus a derived dry-run guard.
- `agent-effectiveness.ts:1973-2033` — split the exact legacy encoded result
  from its decoded result and install the compatibility transformation; update
  examples without changing neighboring payload fields.
- `agent-effectiveness.ts:3814-3855` — make `unconfirmedSyncResult` accept only
  the Phoenix subset and remove its separate dry-run argument after policy
  selection.
- `agent-effectiveness.ts:3917-4030` — preserve branch order and select one
  policy at each return; keep the input `dryRun` because it controls requested
  execution, but do not copy it as independent output state.
- `agent-effectiveness.ts:4564-4610` and
  `AgentEffectiveness.command.ts:293-317,424-460` — preserve JSON and text
  output, deriving the displayed boolean from policy.
- Leave `AgentEffectivenessAnnotationPlan` and its
  `local-only-no-phoenix-mutation` writer/encoder unchanged.

# Guard-deletion accounting

Delete the duplicated `dryRun` result field from decoded state, the dry-run
argument/field write in `unconfirmedSyncResult`, and every direct result
constructor pairing. Retain input-side `dryRun`, confirmation checks, and the
policy-selection helpers because they choose outcomes. The compatibility codec
contains the only result-pair validation.

# Encoded-side impact

Tier 2 JSON/wire compatibility. For all seven legitimate outcomes, compare old
and new canonical `encode(decode(result))`, preserving the exact `dryRun` key
and boolean, `mutationPolicy` key/value, all counts, status, written-id arrays,
and property order. Replace the arbitrary 16-pair property test with a
generator over seven legitimate policies plus arbitrary independent payload
fields. Reject the other nine pairs, including both uses of the annotation-only
policy; permissive historical decoding does not establish semantic support.

# Test impact

Add a seven-row codec table and nine incoherent decode failures. Retain default
dry-run command JSON, blocked confirmation, confirmed writes, annotation and
dataset check failures, Phoenix write failure ordering, append/create behavior,
and written-id assertions. Confirm text output still prints `dry-run: true` or
`false` and the same policy before failed status becomes the controlled CLI
exit.

# Risk and sequencing

Land as one Tier 2 sync-result codec change. Preserve failure precedence:
annotation check, dataset check, dry-run success, missing confirmation, then
Phoenix dataset/prompt/experiment/annotation writes. Do not narrow or rename
the shared annotation-plan policy and do not change input defaults or write
confirmation.
