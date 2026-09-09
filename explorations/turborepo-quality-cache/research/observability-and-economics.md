# Observability and Economics

## Outcome order

Optimize in this order:

1. correctness and security;
2. critical-path time to reliable verdict;
3. reliability and attributable failure rate;
4. compute, storage, transfer, and operating cost;
5. cache hit rate.

Hit rate is diagnostic, not the objective. A high hit rate can reward stale,
unsafe, irrelevant, or off-critical-path work.

## Minimum viable signal stack

Start with stable, bounded surfaces:

- Turbo run summaries and task hashes;
- qualification and ProofLedger-style receipts;
- direct status/`HEAD`/`GET`/`PUT` conformance receipts;
- structured backend request/result events;
- object-store operation metrics;
- GitHub job/run/SHA/workflow-definition metadata;
- scheduler/runner-class and environment-profile identifiers.

The existing cache dashboard deduplicates first touches by source SHA, task ID,
and task hash and reports remote-hit rate plus p50/p95 wall time. Preserve that
useful seam, but replace heuristic uppercase log-substring counters with typed
backend result classes. The current restoration probe proves only that a
remote-read Turbo run can be followed by a local-only run; it cannot distinguish
auth failure, a genuine miss, missing/invalid tag, or backend failure.

## Correlation receipt

One bounded identifier should connect:

`verification episode -> hosted job -> Turbo run -> task hash -> backend
request -> object operation -> cache result -> quality verdict`.

Recommended low-cardinality fields:

- schema version, timestamp bucket, repository, workflow kind;
- exact source SHA and resolved workflow SHA;
- lane ID, sanitized task family, task hash;
- client/backend version digests, environment profile, namespace epoch;
- reuse layer and result class;
- byte-size bucket, latency bucket, producer/consumer runner class;
- whether normal execution or shadow was authoritative.

Never emit bearer values, signature material, raw environment values, artifact
content, full filesystem roots, arbitrary branch names, session IDs, or
unbounded task/log labels.

## Metrics and SLO candidates

| Signal | Why it matters | Guardrail |
| --- | --- | --- |
| Qualified-hit critical-path seconds saved | Measures user-visible value | Only count hits on the critical path and within a qualified profile. |
| Fresh versus hit divergence | Detects incorrect reuse | Target zero unexplained divergence. |
| False-miss rate by result class | Exposes swallowed auth/signature/backend failures | Requires direct backend receipt, not Turbo output alone. |
| Remote read/write p50/p95/p99 | Finds backend latency and tail regressions | Segment by size bucket and runner class. |
| Remote availability and throttle rate | Explains reliability cost | Separate genuine misses from errors. |
| Bytes uploaded/downloaded/restored | Drives transfer/storage economics | Bounded buckets; no artifact content. |
| Compute minutes avoided | Connects reuse to fleet economics | Attribute by lane and runner class. |
| Recompute cost after remote fault | Prices fail-soft behavior | Do not count it as ordinary miss. |
| Qualification coverage | Shows audited versus assumed reuse | Denominator is the 1,503-script census by layer/profile. |
| Warm-only dependency | Detects fragile placement evidence | Require cold and warm samples per lane. |

Final thresholds belong to measured baselines. This packet does not invent
latency or savings targets that the current data cannot support.

## Experimental OpenTelemetry gate

Turbo stable exposes experimental observability, and Bruno enables OTLP
telemetry by default unless disabled. Turbo can optionally reuse the remote
cache token for OTLP authentication; do not enable that coupling. Experimental
OTEL remains behind all of these gates:

1. capture exported payloads with synthetic secrets and paths;
2. demonstrate redaction and a field allowlist;
3. set sampling, queue, size, timeout, and retention bounds;
4. prove no material critical-path regression;
5. isolate telemetry credentials from cache credentials;
6. provide an immediate disable switch with stable-summary fallback.

Until then, stable summaries and explicit events are the authority.

## Warmer design

Replace a guessed fixed task list with an evidence-derived warmer:

1. start from recent protected-main computations;
2. retain only `qualified` Turbo-task entries for the writer's exact profile
   and epoch;
3. rank by expected critical-path seconds saved, miss frequency, artifact size,
   compute cost, and downstream fan-out;
4. exclude volatile verdicts, low-value large artifacts, suspended entries,
   and anything already warm enough;
5. enforce time, compute, byte, concurrency, and request budgets;
6. emit a receipt explaining every selected and skipped computation.

The warmer remains a protected write workflow. It cannot manufacture hosted
required statuses or promote a qualification state.

## Economics ownership

The active `ci-lane-economics` goal owns current required-context population,
cache-warm lane timings, p95 placement decisions, and the representative
measurement window. This packet may consume those measurements and add
cache-layer attribution, but it must not publish a competing lane baseline.

The backend lab should report incremental monthly cost by storage, requests,
transfer, compute, observability, engineering maintenance, and rollback
capacity. Backend selection uses the frozen rubric only after hard gates pass;
the cheapest unsafe or opaque backend is ineligible.

## Rollout observation windows

- seven days in a non-production soak namespace;
- seven days on a named hosted cohort;
- fourteen days of broader observation;
- incumbent retained and rollback rehearsed throughout.

Each window must compare the same qualified computation/profile population and
report correctness, failure taxonomy, critical path, cost, and hit rate in that
order.
