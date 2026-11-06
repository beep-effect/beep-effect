# Versioned engine artifact commitment

The production identity producer commits trusted build/runtime/selected-port
metadata together with the data assets actually authenticated by the default
configuration installer, its captured calendar ceiling and effective limits.
A separate server constructor composes default configuration and this identity.
No raw request field can choose the installed engine identity.

## Trust boundary

The installing server supplies an implementation digest covering code,
dependencies and native assets, an explicit runtime kind/version, and identities
for the selected cleaner and tokenizer ports. These are installer claims, not
self-attestation by the hash helper. The eventual deployment/Layer must bind
them to its actual build and selected services. This producer does not invent a
custom build-attestation protocol or promote a catalog hash into a code hash.

Build metadata and decoded policy are snapshotted through the existing
canonical codec snapshot helper before asynchronous asset loading. The default
installer independently loads and authenticates parser/helper/vocabulary data.
The identity descriptor uses those returned data digests and the installed
helper's calendar ceiling. Declared runtime kind must match the installed diff
backend. Final Layer binding of the remaining selected runtime/ports remains
required; arbitrary caller metadata alone is not execution attestation.

The fixed source profile is CPython 3.11.15, Unicode 14.0.0, hash seed zero and
captured-source-runtime, preserving the catalog's explicit qualification scope.
No additional hash/runtime profile is claimed.

## Frozen protocol

The citation-engine-artifact/v1 preimage is an ordered JSON tuple, encoded by
Effect Schema. It contains protocol/oracle/profile, implementation digest,
runtime kind/version, cleaner/tokenizer identities, the three data digests,
calendar ceiling and sorted policy key/value entries. Limits use their existing
schema encoding, including numeric deadline milliseconds. Tuple positions and
sorted keys remove object insertion-order dependence. The existing SHA-256
codec computes the digest; no hash or generic serializer is implemented.

The descriptor is annotated branded schema data. Invalid metadata, incomplete
policy and digest failures produce a closed source-free error. The helper
retains no caller paths, input values or nested driver/schema causes.

## Verification and connected use

The independent Python hashlib vector reads the existing numeric test policy,
constructs the documented ordered tuple, sorts its policy entries and uses
compact JSON separators. The fixed digest is
ea2281e1e3ade99638c47458d11eca2ee41a397886dd1d834e42b7d2922be94e.
The production producer matches. Reversing property insertion order does not
change identity. Ten controlled changes cover implementation, runtime version,
runtime kind, each selected port, each data asset, calendar and effective
policy. Every digest changes and remains distinct. Malformed metadata,
unsupported runtime, missing port/data, invalid year and incomplete policy
refuse through the closed error.

Connected extraction now uses the production identity producer rather than a
constant final engine hash. The harness explicitly supplies fake deployment
build/port metadata; it does not claim those fixtures attest a deployed build.
Actual installed asset hashes, calendar and policy are committed. Existing
verified extraction uses the resulting identity for canonical text lineage and
cm1 mentions on Bun and Node.

Initial artifact/default/verified regression passes seven tests in 34.03
seconds. The additional installation control mutates caller build metadata and
policy during the first asset stream; the installed descriptor must retain
its original snapshots. Final regression passes seven tests across three
files in 35.46 seconds.
Package lint/type checks, declaration generation, blocking laws and codec lint
pass. Scoped complexity/clone scans show no new findings; hosted results remain
authoritative. Hosted Fallow passes on preceding head 9ea746552e, Check run
42266637087, job 128060359853. Its scanner failure still requires independent
policy PR #2786 to land in main before this branch merges main and reruns.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bun run beep:build
bunx --bun vitest run test/CitationEngineArtifact.test.ts \
  test/CitationDefaultConfiguration.test.ts test/CitationVerifiedExtraction.test.ts
```

Deployment build/port binding, default captured ports, public request/error/
service/Layer, final document integration, transforms, broad host semantics,
exhaustive canonical/donor accounting and whole-engine safety/scaling remain
open. All eleven representation laws, four fidelity questions and fifteen
unfinished proof rows remain open. This wave does not claim full engine or
goal acceptance.
