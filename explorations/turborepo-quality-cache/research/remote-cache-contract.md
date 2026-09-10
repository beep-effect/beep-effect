# Remote Cache Contract

Snapshot: official OpenAPI blob
`4938812fcc199b66bbbe15c2e9c29fc9c84f5dbe`, SHA-256
`1080314512226dc48535fe24648fc0abb10c1cd405c1fd74eacfdc95e22d70b8`.
The blob is identical at Turbo `v2.10.12`, `v2.10.13-canary.1`, the inspected
local upstream checkout, and live upstream `main` on 2026-09-04.

## Three contracts, not one

Every conformance result must report three independent verdicts:

1. **Strict OpenAPI:** the response matches the published status, schema,
   content type, and headers.
2. **Published stable client:** the exact `2.10.12` executable completes the
   intended operation and the direct wire receipt explains its result.
3. **Published canary client:** the exact `2.10.13-canary.1` executable does the
   same in an isolated namespace.

These can disagree. The current client accepts any successful `2xx` upload
even though the OpenAPI documents only `200` or `202`; it does not decode the
documented upload response. Bruno currently returns `201`, so it can be
client-compatible while failing strict response conformance. That distinction
must remain visible rather than being averaged into one score.

## Surface inventory

The document lists paths without a version prefix, while the published Turbo
clients mount every request under `/v8`.

| Effective route | OpenAPI role | Current client use | Required classification |
| --- | --- | --- | --- |
| `GET /v8/artifacts/status` | Service status | Yes | Core |
| `HEAD /v8/artifacts/{hash}` | Existence and metadata | Yes | Core |
| `GET /v8/artifacts/{hash}` | Artifact bytes and metadata | Yes | Core |
| `PUT /v8/artifacts/{hash}` | Store artifact | Yes | Core |
| `POST /v8/artifacts` | Batch hash query | No stable/canary call found | Optional capability |
| `POST /v8/artifacts/events` | Usage events | Yes | Optional capability |

An absent optional route does not fail basic compatibility. If a backend
implements an optional route, its result is still tested and may be marked
nonconformant. The corpus generator must apply the `/v8` mount explicitly.

## Request and response semantics

- Bearer authentication is specified on every operation.
- `teamId` and `slug` are optional alternative tenant selectors. The client
  sends a `teamId` only when it starts with `team_`; it sends `slug` when
  present. The OpenAPI does not define how a bearer is authorized to that
  tenant, so credential-to-tenant binding is an additional Beep hard gate.
- `PUT` requires `Content-Length`, uses `application/octet-stream`, and includes
  duration. It may include `x-artifact-tag`, `x-artifact-sha`, and
  `x-artifact-dirty-hash`.
- `HEAD` and `GET` expose stored metadata. `GET` returns the raw octet stream.
- A missing duration is interpreted as zero. A malformed returned duration is
  an error. SHA and dirty-hash metadata are consumed when present.
- Artifact bytes and opaque metadata must round-trip exactly. A server must not
  compute a new Turbo signature or learn the client signing key merely to
  preserve `x-artifact-tag`.

## Integrity and authenticity verification

With `remoteCache.signature` enabled, Turbo computes HMAC-SHA256 over a
length-delimited message containing the `artifact-signature:v2` domain prefix,
artifact hash, team identity, and artifact bytes. It uploads the result in
`x-artifact-tag`. On restore, a missing or invalid tag is rejected before
outputs are materialized.

`futureFlags.longerSignatureKey` enforces a minimum 32-byte key. It should be
qualified and then enabled with the signature rollout rather than left as an
independent latent downgrade.

The official configuration documentation correctly frames this mechanism as
defense in depth for artifact integrity, not a complete supply-chain security
or producer-attestation feature. Anyone holding the shared verification key
can forge a valid tag offline. The separate write token, protected producer
workflow, tenant binding, namespace epoch, and producer receipt remain
load-bearing.

## Client fail-soft behavior

Direct API behavior and task-level behavior differ:

- `404` is the API client's ordinary miss sentinel.
- `403` receives special API-client handling; other non-success statuses are
  errors.
- the cache multiplexer drops remote fetch errors and returns no artifact;
  existence-check errors are debug-logged and also become no result;
- missing/invalid signatures and malformed metadata can therefore look like a
  cache miss and recomputation at task level.

A green Turbo exit code, “remote caching enabled,” or a recomputed task is not
conformance evidence. Every fault test needs a proxy/server receipt that
distinguishes genuine `404` from authentication, signature, metadata,
transport, storage, and throttling failures.

## Current Beep implementation

The incumbent consists of API Gateway, an authorizer, separate reader and
writer Lambdas/IAM roles, S3, and a pinned Ducktors `2.12.0` shim.

| Property | Checked-in posture | Consequence |
| --- | --- | --- |
| Reader/writer tokens | Separate; either reads, only trusted token writes | Stronger than named candidates' default static-token modes. |
| Reader/writer execution | Separate Lambdas and IAM roles | Read role has no object write permission. |
| Storage | Private S3, AES-256, 30-day expiry | Suitable baseline; live parity remains unproven. |
| Core routes | Status, `HEAD/GET/PUT`, events | Optional batch query is absent. |
| Turbo signature | Not configured | Native artifact tag transport/verification is currently inactive. |
| Writer HMAC | Covers request ID, method, and raw path | Protects gateway-to-writer invocation, not artifact bytes, tenant, query, or Turbo tag. |
| Tenant selection | Caller-controlled query selector | Token class is enforced, but token-to-tenant binding is not. |
| Payload path | API Gateway + synchronous Lambda | Effective artifact ceiling is materially below a streaming service. |
| Observability | CloudWatch logs and heuristic counters | Cannot reliably distinguish all false-miss classes. |

The pinned Ducktors shim only stores and returns `x-artifact-tag` when its
server environment contains `TURBO_REMOTE_CACHE_SIGNATURE_KEY`. Source shows
that it uses the setting as a feature switch, not as cryptographic verification.
The desired design is opaque tag transport without sharing the client signing
key with the server; an incumbent evolution can patch or adapt that behavior.

## Candidate static compatibility notes

### Bruno `turbo-cache-server` 4.0.17

- mounts all core and optional surfaces;
- streams uploads to S3-compatible storage;
- transparently preserves tag and duration metadata;
- implements batch query as an empty-list compatibility stub rather than the
  OpenAPI map;
- returns undocumented `201` for uploads/events;
- has one optional global static token with no read/write split;
- derives tenant storage path from a caller-controlled selector;
- exposes OTLP telemetry, but the GitHub Action prints the full server log and
  requires a token-redaction capture before use.

### Ducktors `turborepo-remote-cache` 2.12.3

- supports local, S3, GCS, Azure, and MinIO storage;
- mounts core artifact routes and events, not optional batch query;
- registers status outside its auth scope;
- supports static, JWT, or no auth; static tokens do not separate read/write,
  while JWT scopes require deliberate configuration;
- has an instance-wide `READ_ONLY` mode, not per-credential capability;
- uses caller-controlled tenant selectors;
- conditionally preserves tags as described above;
- defaults to a buffered 100 MiB parser, while a Lambda/API Gateway topology
  still imposes a much smaller synchronous transport ceiling;
- redacts the authorization header in Pino logs but has no native structured
  hit/miss or OTEL surface.

### Vercel `remote-cache` SDK

The inspected MPL-2.0 repository is a client SDK for Vercel's hosted service,
not a deployable self-hosted cache backend. It is useful clean-room/reference
material for `HEAD`, `GET`, `PUT`, request metadata, and opaque tag transport,
but it cannot be scored as a self-host candidate.

## Normative primary sources

- [Remote Cache OpenAPI at stable](https://github.com/vercel/turborepo/blob/v2.10.12/apps/docs/lib/remote-cache-openapi.json)
- [Stable API client](https://github.com/vercel/turborepo/blob/v2.10.12/crates/turborepo-api-client/src/lib.rs)
- [Stable cache multiplexer](https://github.com/vercel/turborepo/blob/v2.10.12/crates/turborepo-cache/src/multiplexer.rs)
- [Stable signature implementation](https://github.com/vercel/turborepo/blob/v2.10.12/crates/turborepo-cache/src/signature_authentication.rs)
- [Turborepo configuration reference](https://turborepo.dev/docs/reference/configuration)
- [`CiTurboCache.ts`](../../../infra/src/CiTurboCache.ts)
- [`standards/turbo-remote-cache.md`](../../../standards/turbo-remote-cache.md)
