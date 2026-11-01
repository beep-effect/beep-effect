# Native trace projection refactor review

Independent Astra panel, 2026-10-29. Bounded read-only review against
`foundation-native-trace-before.ts` SHA-256
`be5e6d0cc330caa8f4e3974b05247f0d44e117fe977f600d1ddc1a061c6df0c8`.
No actionable semantic regression found. Final reviewed native-trace.ts SHA-256:
`3bb99f2b073d986b087cd57a0d0bce58f2317ee49456e0f5c3b4e71181a40a99`.

Span decode, trace/span/parent identity, selected session/model/kind/fixture
attributes and ordered timestamps still precede event hashing. Optional name,
session and model hashes follow in the same order, then input/output/cache-read/
cache-write decoding. Pure construction moved, but no effectful decode or hash
crosses another such operation.

The three absent-parent forms and JSON/protobuf ID handling are unchanged.
Route-bound event IDs, namespace and request hashes, exact nanoseconds, zero as
unknown, reversed endpoint refusal and two-endpoint duration evidence are retained.
Resource attributes precede span attributes; conflicting selected values reject
the span. Explicit valid OpenInference kinds override the same Claude-name fallback.
Missing/zero status remains unset; codes 1/2 map to ok/error. Optional hashes retain
absence behavior, approved model names and owner-gated synthetic fixture labels.

Usage keys retain the declared convention; absent measurements remain absent and
zero remains present. There is no inferred usage, normalization or new exported
content. Ordinary span failures remain invalid-span ordinals; captured hash-failure
fails the whole envelope before request-ID construction. Namespace/request hash
failures remain whole-envelope failures. Bounds and sequential traversal are intact.

The reviewer selectively inspected existing identity/time/privacy, rejection,
absent-measurement, zero and status assertions. Tests were not independently run;
parent receipts record execution. A subsequent parent-added test covers the name
fallback across declared conventions, explicit kind precedence, empty parents,
empty name hashes, status and privacy. It does not alter the reviewed source.
Recovery and full-goal holds remain in force.
