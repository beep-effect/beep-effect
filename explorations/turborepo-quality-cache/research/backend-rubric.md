# Backend Differential Rubric

This rubric is frozen before the disposable lab runs. Static source inspection
records gaps; it does not award a pass. The incumbent, an evolved incumbent,
Bruno, and Ducktors receive identical cases and capacity envelopes.

## Hard gates

A candidate is ineligible if any gate remains failed or unexplained:

1. exact stable client completes status, signed `PUT`, `HEAD`, `GET`, miss, and
   fault cycles with direct receipts;
2. exact published canary completes the same matrix in an isolated namespace;
3. strict OpenAPI deviations are enumerated, and no core deviation breaks the
   published clients or Beep policy;
4. readers cannot write; writers exist only in protected workflows; storage
   permissions independently preserve that split;
5. a credential is bound to its allowed tenant/namespace and caller-controlled
   selectors cannot escape it;
6. valid `x-artifact-tag` values round-trip opaquely without giving the backend
   the signing key; missing, invalid, wrong-team, and corrupted artifacts are
   rejected before restore;
7. every error class is attributable despite Turbo's task-level fail-soft
   behavior;
8. logs, traces, summaries, and failure output pass synthetic-secret and
   artifact-content redaction tests;
9. measured payload and concurrency envelopes cover current p99/peak with the
   ratified safety multipliers;
10. retention, encryption, public-access block, lifecycle cleanup, backup
    assumptions, budget alarms, and teardown are explicit;
11. deployment pins immutable source/image/package digests and has a rehearsed
    incumbent rollback;
12. license and maintenance obligations are acceptable for the deployed and
    modified topology.

## Weighted score after hard gates

| Category | Weight | Evidence |
| --- | ---: | --- |
| Correctness and client compatibility | 20 | Stable/canary cycles, metadata, faults, atomicity, optional surfaces |
| Authorization and tenant isolation | 20 | Credential matrix, IAM, namespace binding, adversarial selectors |
| Integrity and producer trust | 15 | Opaque tag transport, signed restore, protected writer receipts, epochs |
| Reliability and rollback | 15 | Capacity, throttling, failure taxonomy, retention, restore/cutback drill |
| Critical-path performance | 10 | Warm/cold latency at observed size/concurrency distribution |
| Observability and privacy | 10 | Correlated structured signals, redaction, bounded cardinality/retention |
| Cost and operational burden | 5 | Measured monthly cost, on-call surface, upgrade effort, failure recovery |
| Maintainability and ecosystem fit | 5 | Release cadence, source clarity, patches carried, deployment ergonomics |

A replacement is selected only when it passes every hard gate and produces a
material win over the incumbent: at least ten weighted points, at least a
20-percent improvement in one predeclared decision metric, or removal of a
proven blocker without regression. If no candidate meets that bar, retain and
evolve the incumbent.

## Static pre-lab assessment

| Capability | Incumbent | Bruno 4.0.17 | Ducktors 2.12.3 |
| --- | --- | --- | --- |
| Core stable client route shape | Likely; used in production | Likely; runtime unproven | Likely; runtime unproven |
| Strict upload/event status | Matches shim topology; execute | Returns undocumented `201` | Source appears documented; execute |
| Optional batch query | Absent | Stub does not match schema | Absent |
| Split reader/writer bearer | Yes, external authorizer | No default support | Static no; JWT/external topology possible |
| Storage IAM split | Yes | Deployment-dependent | Deployment-dependent |
| Bearer-to-tenant binding | No checked-in binding | No | No |
| Opaque tag carriage | Disabled by current shim env | Yes | Conditional feature switch |
| Backend needs signing key | Current shim asks for setting | No | Setting used only as mode switch |
| Streaming large uploads | No, synchronous gateway/Lambda | Yes | Parser buffers; topology-dependent |
| Built-in structured telemetry | Heuristic logs/counters | OTLP traces/metrics | Pino logs; no OTEL/hit metrics |
| Authorization redaction | Needs capture | Needs capture | Pino redacts header; capture still required |
| Retention/encryption posture | S3 controls present | Deployment-dependent | Deployment-dependent |
| Current production evidence | Historical protocol proof; live parity not refreshed | None | Incumbent shim lineage only; upstream 2.12.3 not executed |

No row above constitutes a score. In particular, “likely client-compatible”
cannot pass the hard gate until the exact executable, proxy, server, and object
receipts agree.

## Topology rules

- Compare upstream Ducktors separately from Beep's Ducktors-based AWS wrapper;
  the same route code can have different authorization, payload, and failure
  behavior after API Gateway and Lambda.
- Place Bruno behind the same Beep policy boundary for a fair architecture
  comparison; its one-token default cannot be accepted as-is.
- Include “incumbent plus minimal fixes” as a first-class candidate. Migration
  complexity itself is a cost and risk.
- Treat the Vercel `remote-cache` repository as client reference material, not
  a self-host candidate.
- Use release tags and immutable deployment digests. Mutable `main`, Actions
  tags, and container tags are not scoring inputs.

## Rollout gate after selection

The selected topology receives a seven-day non-production soak, a seven-day
named hosted cohort, and a fourteen-day broader observation window. The
incumbent remains deployable and its rollback is rehearsed throughout. Cache
data may be disposable; authorization, status production, and cutover evidence
are not.
