# Executable corpus and local fixture design

Date: 2026-10-23. Pins: [pins-2026-10-23.json](./pins-2026-10-23.json).
Source plan: the 32-case
[conformance-corpus-plan.json](../../../explorations/turborepo-quality-cache/research/conformance-corpus-plan.json).

This turns the planned corpus into three executable parts: a generated corpus
document, a direct-wire runner that scores one backend target at a time, and a
local container lab that stands up each named topology on loopback. The
existing native runner (`cache protocol-run`) keeps owning the signed native
cases against the owned fixture. Nothing here deploys cloud resources.

## 1. Corpus document

`bun run beep cache conformance-corpus [--check]` writes
`research/conformance-corpus.json` (schema `cache-conformance-corpus/v1`).

- Inputs: the vendored OpenAPI blob, verified by SHA-256 before use, and the
  hand-authored case table in source. Regeneration is byte-deterministic;
  `--check` fails when the committed document differs.
- Case identity is the plan's `RC-NNN` id. Generated cases carry the OpenAPI
  `operationId` and the blob digest; hand-authored cases carry
  `origin: hand-authored`. A blob change regenerates generated wire shapes and
  keeps hand-authored cases.
- Each case names the verdict dimensions it scores (from the plan's six) and
  its executor:
  - `wire`: the direct HTTP runner can execute it against any target;
  - `native`: needs exact Turbo executables (RC-017..RC-022);
  - `lab`: needs a deployed boundary or measured load the local lab cannot
    supply (direct Lambda invocation, IAM split, retention timers, measured
    envelopes, cutback). Local runs report these `not-executed` with a reason.

## 2. Verdict model

Every (case, dimension) pair gets exactly one verdict:

| Verdict | Meaning |
| --- | --- |
| `pass` | Executed; the observed exchange satisfies the dimension's contract. |
| `fail` | Executed; a named expectation failed. Carries the expectation id. |
| `unsupported-optional` | An optional route (batch query, events) is absent and labelled so. An implemented optional route is still scored. |
| `not-applicable` | The dimension does not apply to this case. |
| `not-executed` | The executor cannot run here; carries the reason. Never counts as a pass. |

Strict OpenAPI, stable client, canary client, Beep security, observability and
capacity are reported separately; no roll-up hides a failed dimension. The
wire runner scores `strict-openapi` and `beep-security-policy`; client
dimensions come only from native runs; `observability` needs backend log
capture; `performance-envelope` needs measured load.

## 3. Target descriptor

The runner reads a target file (schema `cache-conformance-target/v1`):

- `topology`: one of `beep-incumbent`, `beep-incumbent-evolved`,
  `bruno-policy`, `bruno-loopback`, `ducktors-upstream`, `owned-fixture`;
- `baseUrl`: loopback only for the `local-container` profile;
- `backend`: package/release id and digest from the pin file;
- `namespace`: the team id the credentials are bound to, plus a foreign
  namespace for cross-tenant cases;
- `credentials`: names of environment variables holding reader, writer,
  foreign-tenant and unknown bearers. Values are read into `Redacted` and never
  serialized;
- `policy`: whether the topology claims reader/writer split and tenant binding.
  A topology that claims neither still runs those cases and fails them; the
  claim only changes the attribution text.

## 4. Wire receipts

Each executed case records sanitized exchanges: method, route template (never
the concrete URL), selector shape, status, request/response byte counts,
SHA-256 of bodies, `x-artifact-tag` presence and digest, duration header
presence, and elapsed milliseconds. Bearer values, tag values and bodies are
never written. A miss is recorded as a miss only for a 404 on a hash never
written in that namespace; every other non-2xx keeps its own status class, so
faults cannot masquerade as ordinary misses (RC-010, RC-023).

## 5. Local container lab

`infra/turbo-cache-lab/` holds a compose file and checksum-verified fetch
scripts. Every service binds `127.0.0.1` only, uses generated per-run tokens,
and writes to a lab-only MinIO bucket. No production credential, bucket or
endpoint is reachable from it.

| Topology | Local form |
| --- | --- |
| `beep-incumbent` | The built `infra/lambda/turbo-cache` handlers (Ducktors 2.12.0) behind a local HTTP API v2 event emulator, over MinIO. Emulates routes and authorizer; does not emulate API Gateway or Lambda payload limits, which stay `lab` cases. |
| `beep-incumbent-evolved` | Same with the minimal remediation (tag passthrough, tenant binding) once trust supplies it; until then it is not run. |
| `bruno-policy` | Bruno 4.0.20 behind the same authorizer emulator, over MinIO. |
| `bruno-loopback` | Bruno 4.0.20 alone on loopback with its single token, over MinIO; the shape of the R2 cohort adapter. |
| `ducktors-upstream` | Ducktors 2.14.3 with static auth and local storage. |

Local runs carry profile `local-container` and are never labelled
representative of deployed behaviour or load.

## 6. Ownership for this slice

- CLI (`packages/tooling/tool/cli/src/commands/Cache/Cache.conformance*`,
  their tests, command registration and curated exports): one implementer.
- Lab (`infra/turbo-cache-lab/`) and packet evidence: the orchestrator.
- `infra/lambda/turbo-cache` adapter source stays with the trust goal; the lab
  only consumes its built bundle.
