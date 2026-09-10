# Instance

- id: `yeet-status-remote-check-phase`
- file:line: `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:206`
- symbol: `YeetStatusRemote`
- members: `available`, `checked`
- evidence classes:
  - E1 at `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:858-972` — writers emit skipped `(false,false)`, checked without usable PR `(false,true)`, or checked with decoded PR `(true,true)`.
  - E4 at `packages/tooling/tool/cli/src/commands/Yeet/internal/Status.ts:972-998` — availability is written only after checking and decoding a PR.

# Current shape

`YeetStatusRemote` at `Status.ts:206-237` stores two required booleans beside detail, check partitions, PR fields, review-thread fields, and Option-from-optional-key `unresolvedThreads`/`headSha`. `YeetStatusSnapshot` at `:267-312` persists it. Writers are `:858-862`, `:926-937`, and `:972-998`. Readers reconstruct phase at `:1111-1114`, `:1153-1163`, `:1231-1240`, `:1281-1297`, and `:1358`.

# Cardinality gap

Two booleans represent four combinations. Three are legal: `skipped`, `checked-absent`, and `checked-present`. `(available=true, checked=false)` is illegal.

# Target schema

Define `YeetStatusRemotePhase = LiteralKit(["skipped", "checked-absent", "checked-present"])`. Retain a private `YeetStatusRemoteEncoded` containing required `available`/`checked` and every sibling field with current optionality/defaults. Add decoded `YeetStatusRemoteValue` with `phase` and identical remaining decoded fields. Export `YeetStatusRemote` as the fallible codec and its decoded type via `typeof YeetStatusRemote.Type`.

Decode the three legal pairs exactly and reject `(true,false)`; encode phases back to the same pairs. Internal writers use `YeetStatusRemoteValue.make`. Readers use kit guards/match. Add no parallel booleans and do not attach `.make` to the codec.

# Migration inventory

- `Status.ts:199-237` — update example and define encoded/decoded sides, preserving every payload field and both Option codecs.
- `Status.ts:245-312` — update snapshot examples; keep snapshot JSON on the compatibility codec.
- `Status.ts:858-862,926-937,972-998` — construct phases while preserving detail and PR/check payloads.
- `Status.ts:1083-1098` — update example with supported Result-based decoding.
- `Status.ts:1111-1114` — require checked-present for merge-readiness derivation.
- `Status.ts:1153-1163` — select commands by phase with current priority.
- `Status.ts:1231-1240` — preserve `checks: not checked` for skipped and checked-absent records without counts; checked-present retains partitioned and legacy-unsplit rendering.
- `Status.ts:1269-1297` — preserve `review threads: not checked` unless checked-present.
- `Status.ts:1327-1358` — render `remote not checked` only for skipped; both checked phases retain detail.
- `commands/Yeet/index.ts:21-41` — export phase kit/type beside public `YeetStatusRemote`; keep the decoded constructor internal.
- `test/yeet-status-triage.test.ts:91-174,293,342,456-469`, `test/yeet.test.ts:2261,2293,2325,2332`, and `test/yeet-artifact-writers.test.ts:356-364` — migrate fixtures and preserve assertions.

# Guard-deletion accounting

Delete implication guards at `Status.ts:1112` and `:1282`, reconstructed branches at `:1157-1158`, and the `checked` summary assumption at `:1358`. The boundary decoder becomes the sole illegal-pair guard.

# Encoded-side impact

`available` and `checked` remain required encoded booleans with no defaults. Every sibling field keeps its encoded optionality, Option transformation, values, diagnostic text, and order. `phase` never appears in artifacts. All legal old pairs round-trip exactly; the illegal pair rejects.

# Test impact

Test phase options, all exact legal pairs, illegal rejection, no encoded phase, and every check-count partition. Retain exact commands, diagnostics/order, review threads, snapshots, and artifact writers.

# Risk & sequencing

Tier 2 singleton. The main risks are confusing checked-absent with skipped or dropping check partitions. Land codec, writers/readers, export, and focused suites atomically. No new stored state or generic helper is introduced.
