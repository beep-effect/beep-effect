# HTTP intake refactor review — 2026-10-29

Independent reviewer: existing `review.panel` Astra xhigh session
`/root/foundation_panel_astra`, separate from the implementing orchestrator.
The reviewer inspected source only and did not run or certify tests.

## Source binding

Paths below are relative to `packages/tooling/library/ai-metrics/src`.

| File | Original SHA-256 | Accepted final SHA-256 |
| --- | --- | --- |
| `native-http.ts` | `2b377713771e5ccb8168e73f74518c7dfd5a0113af2e1ba7529894ba9fc95114` | `f05649b9dc34b67cb4752c7d215d3d1be06c98417b1aabb3f8728a025c52fa4d` |
| `observation-launch-http.ts` | `c173247d0ade3132c9a2a35cc3b433e6adbf94c21f06d3184d0817132059f2fe` | `5a698aa03cc5c0464484a9b3071c92d0589678bd43ba78d9ea5b61ae43004996` |

Both original snapshots and intermediate accepted comparisons are archived with
`ops/delivery-http-intake-verification.json`.

## Bounded acceptance

No actionable semantic or installed Effect API compatibility regression was found.

Native body, acceptance and admission helpers use lazy generator callbacks.
Route/method/media/encoding/declared-length checks retain their order before
no-queue admission. Web-request conversion and absent-body normalization remain
before the timeout; the timeout still encloses both bounded byte collection and
bounded gzip expansion. Empty protobuf remains supported. Error handling remains
inside shared control for body/projection/intake failures and outside that work
but inside the permit for control refusals. Interruptions are not converted into
counted refusals by a new catch-all. Counters and accepted/partial receipts retain
their timing after durable journal acceptance. Valid empty requests count
acceptance without creating a receipt.

The private encoding schema accepts exactly identity and gzip after the existing
default/trim/lowercase normalization. Its schema-derived guard supplies the type
narrowing needed at helper boundaries without coercion or expanded support.
An intermediate version passed runtime tests but failed TS2345; it is not a
fully qualified result. A later import-order lint failure was corrected as well.

Response message strings, interpolated counts, JSON/protobuf shapes and field
order are preserved. Error code mapping remains 503 to 14, 413 to 8, 410 to 9,
otherwise 3. Headers, string rejected-span counts, selected protobuf message type
and encoder invocation remain unchanged. Method and route responses remain
uncounted; unsupported media and encodings still increment unsupported.

Launch context is a rerunnable effect, not a cached snapshot. Launch submission
and the extracted route stages are lazy generators. Disabled routes, path,
method and header checks remain before admission and body consumption. The same
permit encloses shared control and typed error mapping; the outer 503 fallback
still encloses both routes. Destination/epoch/prepared/allowlist validation and
fact commit still precede receipt encoding and success acknowledgment.

Final review used intermediate native hash
`a7c807131a76046641a36bd4e2b56910f5db99ebf1eca86b9252bf2bf089a5f2`
and launch hash
`c28380b0bd4237bb00a1dda89d85df82fed4e42b8722d859c26230036380b729`,
each previously compared to its original snapshot. Final hashes were rechecked.

This review qualifies the bounded refactors only. Full package checks, generated
policy/catalog gates, installed/canary proof, complete panel and hosted delivery
remain separate requirements. No real harness coverage or production rollout is
claimed. The historical recovery hold is unchanged.
