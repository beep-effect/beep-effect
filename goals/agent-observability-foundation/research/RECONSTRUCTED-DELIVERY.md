# Reconstructed metadata delivery

The existing sender, durable attempt ledger, read-back checker and fair scheduler
now accept verified native pages and reconstructed transcript pages. Their public
factory names retain `Native` for source compatibility; their documented delivery
scope is now both streams. No producer or production service was enrolled.

## Projection and interpretation

Each accepted physical transcript occurrence becomes a separate `observed.*`
CHAIN point, with `ai_metrics.stream=reconstructed` and scope version
`transcript-export/v1`. Deterministic host/namespace/occurrence-derived trace and
span IDs are separate from the source's native tracing IDs. Equal repeated
messages retain separate occurrence identity. Explicit session hashes can group
observations; source format does not identify desktop versus CLI, repository,
provider, task or attempt. Those unresolved identities are not fabricated.

Strict source timestamps retain nanoseconds in the actual protobuf and a managed
attribute. Missing time uses the durable local acceptance time and is labelled
`intake_observation`. Start equals end, `duration_known=false`, and no parent is
invented. Consequently these points must be excluded from model-call latency
and native trace-volume comparisons. A larger Phoenix trace count after enabling
reconstruction would not demonstrate improved completeness or more real tasks.

Usage remains a non-additive snapshot with its message/last-request/cumulative
basis. Observed input/output/cache values are preserved, including unknown versus
zero. Reconstruction deliberately emits no standard `llm.token_count.*` fields:
streamed updates and overlapping native observations cannot safely be summed.
Actual native provider-specific normalization remains unchanged. Model and cwd
stay hashed; prompt/output text, raw IDs, source paths and secrets are excluded.

## Durable delivery and compatibility

One internal retained-page reader verifies receipt hash, byte count, namespace,
source key and frame count before selecting accepted occurrences. Rejected frames
remain local evidence and never become backend observations. The same reader
reconstructs original wire bytes for sending and reconciliation. Attempts are
reserved before network I/O, and exact attempt replay never sends again. Backend
visibility still requires exact identity, parent/kind/status, managed metadata and
timestamps at Phoenix query precision. Invented standard totals or parentage fail
reconciliation. Missing queries do not authorize blind resend.

The shared scheduler traverses retained pages in sequence, claims each canonical
event offset before I/O, and resumes after restart. Each selection reads at most
two bounded pages. Empty/rejected-only pages advance the durable cursor; there is
no whole-journal JSON sort or growing scheduling queue. A pass with no event
outcome but retained pages reports `scanning`, not `idle`. Fixed metrics now use
`delivery_pass_*`, since calling mixed observations native would be misleading.
No metric label includes a source/event ID or private path.

Target profile `observation-target/v3` binds both native-export/v1 and
transcript-export/v1 plus the existing exact destination/query/project inputs.
Scheduler profile `observation-schedule/v2` binds the new canonical offset
semantics. Earlier synthetic journals are preserved and refuse profile drift;
no implicit migration rewrites them. Native event/session/trace/span identities
are unchanged. Existing historical stores and the masked forwarder are untouched.

## Proof and remaining work

`ops/history/reconstructed-delivery-verification.json` records focused and package results
and the actual paused-entrypoint proof. That process proof uses only synthetic
files and a bounded loopback receiver: one native and one reconstructed POST,
distinct event identities, controlled restart, no resend despite missing backend
queries, source-cursor persistence, private-canary exclusion and worker cleanup.
It does not substitute a mock receiver for actual Phoenix integration.

The subsequent actual-image qualification extends the owned collector guard to
both projections and verifies stored records and GraphQL aggregates. See
[MIXED-COLLECTOR-ROUTE.md](MIXED-COLLECTOR-ROUTE.md), including the nested filter
syntax and misleading mixed latency/partial token totals. This does not claim
that the currently deployed collector accepts reconstructed records. Live UI
configuration, lag/expected-source denominators, managed service/frontend,
external notifications, backup lifecycle, real CLI/desktop and bounded live canary,
review and repository delivery remain open. Reversal before enrollment is to
leave these new components unenrolled and retain the recovery hold; no historical
source or queued backend data is deleted.
