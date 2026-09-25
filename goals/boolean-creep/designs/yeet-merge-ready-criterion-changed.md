# Current shape

Current-source P2 refresh at source/main
`0be1f13d62fa00cb65e34ff69ec99043380f8d81`. Historical R28 findings remain
historical evidence, not replacement independent approval. This refresh keeps
status designed and the4/2 event relation. No product/runtime changes.

`packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:357–374` exports `YeetMergeReadyCriterionChanged`. The actual class has two required Boolean fields, `from` and `to`, alongside `kind: "merge-ready-criterion-changed"`, the current watch schema version, `at: string`, `headSha: NonEmptyString`, and the complete eight-value `YeetMergeReadyCriterion`. Its schema description explicitly calls it a criterion flip. The public description explicitly calls the event a truthful criterion flip.
That declared semantic contract, not merely producer reachability, excludes
unchanged pairs from the legitimate event domain.

`diffYeetWatchSnapshots` at `:856–870` compares the two observations and emits no event for equality. This does not make the separate snapshot observations exclusive: both equal pairs are legitimate snapshot inputs and must continue to produce an empty event list.

# Cardinality gap

The event pair represents four tuples but has two legitimate values: false→true and true→false. The writer's `before === after ? [] : [event]` at `:859–868` is E2 defensive suppression of no-op events; the event description at `:371–372` is E1. An event is emitted for either inequality with no directional restriction.

`test/yeet-watch-stream.test.ts:114–117` verifies unchanged snapshots emit nothing, and `:189–209` exercises eight false→true criterion events. The same public differ accepts the reversed pair of these concrete snapshots and follows the symmetric inequality branch, producing true→false. The only direct class example at `WatchStream.ts:347–350` is false→true. Exhaustive source search found no supported equal-pair class fixture or consumer relying on no-op events. Generic acceptance by `S.Boolean` is not a supported no-op event contract.

# Target schema

Use a small file-local `LiteralKit(["became-satisfied", "became-unsatisfied"])` for the event transition, with the same-name runtime type and repository identity annotation. Keep the public `YeetMergeReadyCriterionChanged` schema name and shared
payload fields, replacing the two decoded stored Booleans with one transition.
Use a private class-backed decoded model behind the public compatibility
transformation schema, plus its same-name Type alias. Do not leave the public
class schema encoding transition while only the event union encodes legacy
from/to: direct public schema consumers must receive the same compatibility
boundary as the union. This is a decoded constructor/API migration; validate
class-backed `.make` behavior and migrate examples/callers atomically. Do not
claim constructor/new/subclass compatibility without proof. This is a payload-free literal domain inside the existing event class, not a second tagged event hierarchy. The existing `YeetMergeReadyCriterion` remains the identity vocabulary; satisfaction direction is a distinct two-state transition domain.

Create a schema-owned compatibility codec with two exact legacy encoded arms: `{ from: false, to: true }` and `{ from: true, to: false }`, each carrying the unchanged common event fields. Use `S.Literal(false/true)` in those wire arms and the repository's `S.decodeTo`/`SchemaTransformation` pattern validated against current installed/local Effect (`transformEffect` in rc.117). Decode to the new transition and encode the inverse through the LiteralKit matcher. Do not add a broad Boolean bag followed by a custom coherence guard. The union's literal fields exclude unsupported equal-pair event data at the boundary.

For the producer, preserve the equality check that suppresses events. Once inequality is known, derive transition from `after`; do not store the old pair and add a third redundant field. Before/after observations remain local input facts and retain all four supported combinations.

# Migration inventory

| Location | Required migration or preserved behavior |
| --- | --- |
| `WatchStream.ts:340–374` | Update constructor example and decoded event class; colocate transition LiteralKit and legacy codec. |
| `WatchStream.ts:663–677` | Assemble the event union with this member's compatibility codec so the union's decoded event is narrow while its encoded event remains the old pair. Keep all eight other event members exact. |
| `WatchStream.ts:690,717–718` | Keep one schema JSON encoding route through `encodeWatchEvent` / `renderYeetWatchEventLine`; ensure the union uses the inverse above. |
| `WatchStream.ts:794–873` | Preserve head-change suppression, check/thread/mergeability ordering and eight-criterion ordering. Change only the emitted criterion constructor at `:862`. |
| `internal/WatchMode.ts:502–506` | Preserve schema-error mapping and NDJSON emission. The event enters this route from snapshot diffs; no raw JSON alternative is permitted. |
| `internal/WatchMode.ts`; `internal/Porcelain.ts`; `Yeet.command.ts` | Preserve watch polling, termination, until-event and command routing; no new control flow. |
| `src/test/Yeet.test-kit.ts`; CLI `package.json` | Preserve public test facade and command-subpath access, including generic class and union codec consumers. Document the decoded constructor change. |
| `test/yeet-watch-stream.test.ts`; `test/yeet-watch-mode.test.ts` | Migrate direct decoded inspections as needed while keeping emitted JSON event kinds/order and the old from/to values. |

Current scoped exhaustive Graft search finds the class/example, sole differ
writer, union member, encoder/WatchMode route and watch-stream rendering tests.
The broader command/watch routing remains unchanged. Public test facade and
command subpaths are real API exposure: no external absence claim is made.
Direct public schema and union encodings must both preserve the legacy shape.

# Guard-deletion accounting

Delete one redundant stored Boolean degree of freedom and replace the old two-field constructor assignment with one transition. Delete zero runtime suppression guards: `before === after` remains necessary to decide whether an event exists. Add no custom check, repair branch or normalization fallback. The exact literal wire arms provide schema validation; inverse encoding derives both Booleans from one transition. Do not claim this change removes the legitimate four-state input observation comparison.

# Encoded-side impact

Tier 2, wire exposure: `renderYeetWatchEventLine` emits the event as NDJSON. Preserve exactly the existing kind, schemaVersion value and constructor-only default, timestamp string, nonempty head SHA, full eight-value criterion identity and from/to keys for every legitimate event. False→true encodes identically; true→false encodes identically. The transition key is decoded/internal and must not leak into JSON. No file format version bump or key removal is needed when the compatibility codec is used everywhere.

Current Boolean schemas structurally accept equal-pair objects, despite the
public truthful-flip description. Proposed literal arms reject those inputs.
Record old structural acceptance versus intended semantic rejection explicitly;
this is not all-old-input acceptance compatibility. Independent P3 must validate
that declared flip semantics governs supported callers, and escalate any
contradictory documented consumer contract. Absence of a writer alone is not
that proof. Preserve the existing constructor default separately from decoding:
`schemaVersion` uses withConstructorDefault, not a newly invented decoding
default; `at` remains arbitrary S.String, not ISO-only, headSha remains nonempty,
criterion retains all eight values. Preserve kind tag behavior, key order,
unknown-property behavior and malformed input failures. If independent review discovers an actual supported no-op encoded event, stop this migration and revisit 4/2 rather than silently dropping or rewriting that input. Other watch event variants and legacy fields remain unchanged.

# Test impact

Add explicit rise/fall class-codec round trips preserving full event metadata and all eight criterion literals. Confirm decoded events carry only one transition and encoded JSON carries exactly the former from/to pair. Test that both equal snapshot pairs still emit no event, and equal-pair event JSON is rejected as unsupported. Preserve stream event ordering including the new settle event last, head-change
suppression returning head-change plus any settle transition, until-event behavior and the current JSONL decoding tests. Exercise rendering through the event union so a bypass of the compatibility codec is caught. Required CLI package verification belongs to implementation; no tests or package commands ran for this P2 design.

# Risk

The principal risk is changing the public decoded class without routing every union encoder through its legacy inverse. A second risk is conflating snapshot facts with emitted transitions and deleting the equality suppression. The public truthful-flip description supports the proposed semantic domain;
carry the explicit structural-acceptance counterexample into replacement P3
rather than treating historical review metadata as present compatibility proof. No product implementation or P3 approval accompanies this P2 design.

Landing: Tier 2 remains a singleton PR. Coordinate sequentially with the remote-status/readiness compatibility work and keep shared WatchStream, Status and Handler edits serial.
