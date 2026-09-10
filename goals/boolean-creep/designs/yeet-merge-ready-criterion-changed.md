# Current shape

R28 P2 design for stable `yeet-merge-ready-criterion-changed`. Frozen source: HEAD `93217d998f851e2e93d9864e2b5315552eaa58a7`, origin/main `d1b4d769fbaffddd55717f3b1ba461897dd545c5`. The successful R28 R–Z/Yeet contract corrections independently confirmed source eligibility; this is designed, with independent P3 design review still pending. Full source and prior-design byte receipts are preserved by `data/r28-cli-last-integration.json`.

`packages/tooling/tool/cli/src/commands/Yeet/internal/WatchStream.ts:389–406` exports `YeetMergeReadyCriterionChanged`. The actual class has two required Boolean fields, `from` and `to`, alongside `kind: "merge-ready-criterion-changed"`, the current watch schema version, `at: string`, `headSha: NonEmptyString`, and the complete eight-value `YeetMergeReadyCriterion`. Its schema description explicitly calls it a criterion flip. The current D1 claim that stayed-false and stayed-true are legitimate events conflicts with the event writer.

`diffYeetWatchSnapshots` at `:799–812` compares the two observations and emits no event for equality. This does not make the separate snapshot observations exclusive: both equal pairs are legitimate snapshot inputs and must continue to produce an empty event list.

# Cardinality gap

The event pair represents four tuples but has two legitimate values: false→true and true→false. The writer's `before === after ? [] : [event]` at `:802–810` is E2 defensive suppression of no-op events; the event description at `:403–404` is E1. An event is emitted for either inequality with no directional restriction.

`test/yeet-watch-stream.test.ts:108–111` verifies unchanged snapshots emit nothing, and `:184–204` exercises eight false→true criterion events. The same public differ accepts the reversed pair of these concrete snapshots and follows the symmetric inequality branch, producing true→false. The only direct class example at `WatchStream.ts:379–382` is false→true. Exhaustive source search found no supported equal-pair class fixture or consumer relying on no-op events. Generic acceptance by `S.Boolean` is not a supported no-op event contract.

# Target schema

Use a small file-local `LiteralKit(["became-satisfied", "became-unsatisfied"])` for the event transition, with the same-name runtime type and repository identity annotation. Keep the `YeetMergeReadyCriterionChanged` class name and shared payload fields, replacing the two stored Booleans with this single transition. This is a payload-free literal domain inside the existing event class, not a second tagged event hierarchy. The existing `YeetMergeReadyCriterion` remains the identity vocabulary; satisfaction direction is a distinct two-state transition domain.

Create a schema-owned compatibility codec with two exact legacy encoded arms: `{ from: false, to: true }` and `{ from: true, to: false }`, each carrying the unchanged common event fields. Use `S.Literal(false/true)` in those wire arms and the repository's `S.decodeTo`/`SchemaTransformation` pattern already used by `Verdict.ts:507–514`. Decode to the new transition and encode the inverse through the LiteralKit matcher. Do not add a broad Boolean bag followed by a custom coherence guard. The union's literal fields exclude unsupported equal-pair event data at the boundary.

For the producer, preserve the equality check that suppresses events. Once inequality is known, derive transition from `after`; do not store the old pair and add a third redundant field. Before/after observations remain local input facts and retain all four supported combinations.

# Migration inventory

| Location | Required migration or preserved behavior |
| --- | --- |
| `WatchStream.ts:379–406` | Update constructor example and decoded event class; colocate transition LiteralKit and legacy codec. |
| `WatchStream.ts:623–637` | Assemble the event union with this member's compatibility codec so the union's decoded event is narrow while its encoded event remains the old pair. Keep all seven other event members exact. |
| `WatchStream.ts:647,676–677` | Keep one schema JSON encoding route through `encodeWatchEvent` / `renderYeetWatchEventLine`; ensure the union uses the inverse above. |
| `WatchStream.ts:753–815` | Preserve head-change suppression, check/thread/mergeability ordering and eight-criterion ordering. Change only the emitted criterion constructor at `:805`. |
| `internal/WatchMode.ts:360–364` | Preserve schema-error mapping and NDJSON emission. The event enters this route from snapshot diffs; no raw JSON alternative is permitted. |
| `internal/WatchMode.ts:712–789`; `internal/Porcelain.ts`; `Yeet.command.ts` | Preserve watch polling, termination, until-event and command routing; no new control flow. |
| `src/test/Yeet.test-kit.ts:71`; CLI `package.json:66` | Preserve public test facade and command-subpath access, including generic class and union codec consumers. Document the decoded constructor change. |
| `test/yeet-watch-stream.test.ts`; `test/yeet-watch-mode.test.ts:1345–1355` | Migrate direct decoded inspections as needed while keeping emitted JSON event kinds/order and the old from/to values. |

Graft's complete incoming closure found WatchMode, Porcelain, Yeet.command and the watch-stream tests. Exhaustive source searches across packages and apps found this single criterion-event writer, the class example, the union member and the two test files; no other current direct reader of criterion `from` or `to` was found. This establishes the current migration inventory, not an assertion that external consumers of the command's JSONL do not exist. Their encoded interface is preserved by construction.

# Guard-deletion accounting

Delete one redundant stored Boolean degree of freedom and replace the old two-field constructor assignment with one transition. Delete zero runtime suppression guards: `before === after` remains necessary to decide whether an event exists. Add no custom check, repair branch or normalization fallback. The exact literal wire arms provide schema validation; inverse encoding derives both Booleans from one transition. Do not claim this change removes the legitimate four-state input observation comparison.

# Encoded-side impact

Tier 2, wire exposure: `renderYeetWatchEventLine` emits the event as NDJSON. Preserve exactly the existing kind, schemaVersion value/default, timestamp string, nonempty head SHA, full eight-value criterion identity and from/to keys for every legitimate event. False→true encodes identically; true→false encodes identically. The transition key is decoded/internal and must not leak into JSON. No file format version bump or key removal is needed when the compatibility codec is used everywhere.

The only narrowed wire values are equal-pair objects claiming to be a criterion-changed event; no source-backed legitimate constructor or fixture supports them. If independent review discovers an actual supported no-op encoded event, stop this migration and revisit 4/2 rather than silently dropping or rewriting that input. Other watch event variants and legacy fields remain unchanged.

# Test impact

Add explicit rise/fall class-codec round trips preserving full event metadata and all eight criterion literals. Confirm decoded events carry only one transition and encoded JSON carries exactly the former from/to pair. Test that both equal snapshot pairs still emit no event, and equal-pair event JSON is rejected as unsupported. Preserve stream event ordering, head-change suppression, until-event behavior and the current JSONL decoding tests. Exercise rendering through the event union so a bypass of the compatibility codec is caught. Required CLI package verification belongs to implementation; no tests or package commands ran for this P2 design.

# Risk

The principal risk is changing the public decoded class without routing every union encoder through its legacy inverse. A second risk is conflating snapshot facts with emitted transitions and deleting the equality suppression. The independent R28 correction confirms that no-op events are unsupported; preserve that proof during P3. No product implementation or P3 approval accompanies this P2 design.

Landing: Tier 2 remains a singleton PR. Coordinate sequentially with the remote-status/readiness compatibility work and keep shared WatchStream, Status and Handler edits serial.
