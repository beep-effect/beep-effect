# Remote Cache Trust Model

## Security objective

Reuse must never turn an incorrect, unauthorized, corrupted, cross-tenant, or
sensitive artifact into trusted quality evidence. Performance is subordinate
to that rule.

## Five independent trust planes

| Plane | Question | Primary controls | Native Turbo HMAC covers it? |
| --- | --- | --- | --- |
| Computation correctness | Did the task hash include every semantic input and replay every required output/log? | Qualification experiments, input contracts, must-fail perturbations | No |
| Artifact integrity | Are restored bytes exactly what a key holder signed for this hash/team? | `remoteCache.signature`, 32-byte-minimum key, tag preservation | Yes, within shared-key domain |
| Producer authorization | Was upload authority limited to an approved protected workflow and exact source context? | Write token, IAM, protected job, producer receipt | No |
| Tenant/confidentiality boundary | Can a bearer select another namespace or can logs/artifacts leak sensitive data? | Token-to-tenant binding, namespace validation, storage policy, redaction | No |
| Operational evidence | Can a miss, auth fault, corruption, throttle, or rollback be distinguished later? | Structured correlated receipts, bounded telemetry, direct probes | No |

Calling HMAC alone “artifact authenticity” can obscure the shared-key boundary.
Readers need the verification key and can therefore forge valid tags offline.
They still cannot publish without a write bearer and write-capable execution
role. Both controls are mandatory.

## Actors and threats

- an untrusted fork with no remote credential;
- a same-repository pull request with read bearer and verification key;
- a compromised or buggy trusted writer;
- a valid bearer attempting another caller-selected tenant;
- a backend/operator defect that drops or rewrites metadata;
- a storage or transport fault returning truncated/corrupted bytes;
- a task with undeclared inputs, nondeterminism, unsafe logs, or absolute paths;
- a mixed fleet during key/backend/toolchain rotation;
- an observer receiving high-cardinality traces or sensitive task output.

The model does not assume cache confidentiality merely because the bucket is
private. Terminal logs are cache artifacts, verification-key holders can forge
tags, and a signed artifact can still be semantically wrong when its task hash
is incomplete.

## Credential topology

| Principal | Read bearer | Write bearer | Signature key | Allowed behavior |
| --- | --- | --- | --- | --- |
| Fork PR | No | No | No | Local-only execution |
| Same-repo PR | Yes | No | Yes | Signed remote reads; no upload |
| Approved workstation | Yes | No | Yes | Signed remote reads within qualified profile |
| Protected main/warm writer | Yes | Yes | Yes | Signed read/write plus producer receipt |
| Backend service | Validates bearer | Validates bearer | No | Preserve opaque tags; enforce tenant/method policy |

A reader missing its required signature key falls back to an attributable
local-only mode. A trusted writer or canary missing the key fails hard; it must
not publish unsigned artifacts into a signed namespace.

## Namespace and rotation

Native verification accepts one key, so rotation cannot be modeled as an
atomic dual-key swap. Use explicit namespace epochs that bind:

- signature key generation;
- backend/topology version;
- Turbo client qualification version;
- relevant environment/toolchain profile;
- tenant identity and retention window.

Writers switch only after the new epoch passes signed canary tests. Readers may
fall back to local execution when the epoch is unavailable, but never to
unsigned remote restore. Old epochs remain read-only for the bounded rollback
window and then expire through lifecycle policy.

## Protected producer receipt

Every accepted write path should emit a compact, signed or otherwise
tamper-evident workflow receipt containing only bounded identifiers:

- repository and protected workflow identity;
- exact source SHA and resolved workflow SHA;
- Turbo/client and backend deployment digests;
- tenant and namespace epoch;
- task hash and sanitized task identity;
- upload result class, timestamp, and correlation identifier.

The receipt does not need to contain artifact bytes, environment values, raw
headers, or secret references. It complements Turbo HMAC; it does not replace
client verification.

## Incumbent gaps to remediate or test

1. Native Turbo signing is absent from root configuration and workflows.
2. The pinned shim does not preserve tags unless a misleading server-side
   signature-key setting is present.
3. Bearer class is enforced, but caller-controlled tenant selection is not
   bound to the bearer.
4. The gateway-to-writer HMAC covers request ID, method, and path, not query,
   tenant, body, artifact bytes, or Turbo tag.
5. Five-minute per-process secret caches create a possible mixed-key rotation
   window without an explicit dual-key protocol.
6. Historical source/protocol evidence does not prove the live deployed stack
   matches the checked-in Pulumi program.
7. Existing telemetry cannot reliably distinguish auth, signature, corruption,
   metadata, transport, storage, and ordinary-miss outcomes.

## Implementation error taxonomy

The graduated trust/observability goal should use typed, fail-closed result
classes rather than string matching. At minimum:

`CacheMiss`, `AuthenticationDenied`, `WriteDenied`, `TenantDenied`,
`SignatureMissing`, `SignatureInvalid`, `MetadataInvalid`, `ArtifactCorrupt`,
`PayloadRejected`, `BackendUnavailable`, `BackendThrottled`, `WriteAmbiguous`,
`ReceiptInvalid`, `ProfileMismatch`, and `EpochMismatch`.

Turbo may still recompute after a remote failure, but the correlated receipt
must preserve which class occurred. Silent recomputation is a resilience
behavior, not an acceptable audit trail.

## No-go conclusions

- Do not share the signing key with the cache server merely to toggle tag
  persistence; patch the carrier behavior instead.
- Do not give same-repository PRs write authority.
- Do not treat a valid tag as proof of exact-main provenance, complete inputs,
  confidentiality, freshness, or non-repudiation.
- Do not add asymmetric signing/PKI until a concrete consumer requirement or a
  demonstrated residual gap survives the lab.
- Do not enable OTLP or full server-log publication until captured synthetic
  secrets prove headers, paths, and artifact content remain safe.
