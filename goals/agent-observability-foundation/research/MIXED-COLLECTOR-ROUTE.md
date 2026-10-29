# Native and reconstructed collector/Phoenix qualification

## Proven route

The owned collector template now admits two explicit projection contracts under
service `beep-agent-observability` and scope `beep.agent-observation`:

- native-export/v1 + stream native + the declared agent.* kinds;
- transcript-export/v1 + stream reconstructed + the declared observed.* kinds.

Version, stream and name must agree. The raw legacy trace endpoint still returns
404. Raw input and five mismatched/unknown projection combinations on the private
metadata receiver were filtered and counted. An HTTP 200 from that receiver is
therefore not a storage receipt. The guard is neither authentication nor a
sanitizer: positive metadata projection remains the worker's responsibility.
The metadata port remains unpublished by production Compose.

The synthetic proof uses the existing persistent exporter, private queue and
separate export/query origins. It runs the actual projection, journal, scheduler,
sender and exact read-back against collector 0.163.1 and Phoenix 20.23.0 at the
image digests in `ops/reconstructed-collector-route-verification.json`. It stores
three native spans and six reconstructed observations, with nine distinct trace
identities and three explicit sessions. Repeated Claude message snapshots retain
different occurrences. Codex session and last-request/cumulative usage snapshots
preserve their separate counting bases. Equivalent timestamp offsets retain exact
source nanoseconds; standard Phoenix timestamps expose microsecond precision.

Every event transitions from local accepted-unverified to positively reconciled
visible. Reconstructed records remain CHAIN observation points with no invented
parent or duration and no standard token totals. Raw canaries are absent from the
journal, stopped collector queue file and backend response. Container/process
resource limits, queue file bounds and removal of all owned resources are verified.
No live harness, historical store, deployed project or held forwarder was changed.

## Query semantics: flattened REST keys are not literal query keys

Phoenix's REST response flattens `ai_metrics.stream`, but this pinned query
language expects the nested stored JSON path. The following filters were tested
against the actual GraphQL fields used for project aggregates:

| New-projection view | Tested filter |
| --- | --- |
| Native performance | `attributes["ai_metrics"]["stream"] == "native"` |
| Reconstructed observations | `attributes["ai_metrics"]["stream"] == "reconstructed"` |
| Complete native usage | `attributes["ai_metrics"]["stream"] == "native" and attributes["ai_metrics"]["usage"]["complete"] == True` |

The superficially plausible `attributes["ai_metrics.stream"] == "native"`
returned zero without a query error. The corrected nested query returned three.
The verifier retains both forms as an explicit semantic regression. This was a
qualification-query defect, not evidence that earlier live events were missing.
These filters apply to the new projection: historical records lacking its stream
attributes must remain a separate unknown/legacy population, not disappear from
coverage accounting.

## Aggregates require interpretation

| Actual synthetic query | Result | Meaning |
| --- | ---: | --- |
| All records / traces | 9 / 9 | Three native calls plus six reconstructed points; not nine tasks |
| Sessions | 3 | Explicit source grouping only; not coverage proof |
| Native records / traces | 3 / 3 | Qualified native population |
| Reconstructed records / traces | 6 / 6 | Physical source occurrences; repeated updates stay separate |
| Native known prompt + completion | 275 | 260 prompt + 15 completion, including an incomplete record |
| Complete-native-usage total | 270 | Two fully specified 135-token records |
| Reconstructed standard token contribution | 0 | Intentionally non-additive; not zero actual usage |
| Unfiltered trace P50 | 0 ms | Dominated by timestamp-only observations; unsuitable for performance |
| Native-filtered trace P50 | 100 ms | The synthetic calls' actual duration |

Phoenix 20.23.0's installed Project and token-count loader source was inspected
from the exact image. Its aggregate token loader sums prompt and completion on
leaf LLM spans and substitutes zero for absent columns; it does not establish
completeness. The REST explicit total attributes sum to 270, while the GraphQL
known subtotal is 275. Both are internally consistent and must be labelled by
what they measure. Unknown cost/usage must not be presented as measured zero.

## Verification and remaining acceptance

The actual-image route/aggregate receipt, source hashes and current package/config
checks are recorded in `ops/reconstructed-collector-route-verification.json`.
The rendered collector runtime also preserves the OS-label collision repair and
resource/datapoint email scrubbing in its metrics pipeline. Historical queue
crash/capacity evidence remains separate; this change keeps queue/exporter storage
IDs and settings unchanged.

This is disposable qualification, not a production deployment or complete
foundation acceptance. Independent source/launch/event denominators, complete
identity reconciliation, lag and external alert delivery, managed frontend/service,
backup generation/off-device/restore policy, historical recovery integrity,
CLI/desktop and bounded live canary/rollback, mandated review and repository
publication remain required. Reversal is to keep the new route unenrolled or
restore the preceding owned guard while preserving any queue; never delete queued
or historical data to simplify rollback. The old forwarder remains masked.
