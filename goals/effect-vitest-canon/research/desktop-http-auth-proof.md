# Desktop RPC HTTP authentication boundary

The existing header-predicate tests remain intact. An additional test serves the
real ListContradictionCandidates RPC descriptor through the real HTTP NDJSON
protocol and RpcSessionAuthLayer on an ephemeral Node HTTP socket. Its handler
returns a deterministic schema-valid empty page so handler execution is observable
without involving a database, provider, session credential or desktop process.

Missing and wrong bearer tokens each receive HTTP 401 with the exact unauthorized
response, and neither reaches the handler. The active fixture token receives
HTTP 200, the exact decoded successful RPC response, and exactly one handler call.
This proves the mounted authentication boundary; it does not claim packaged
sidecar startup, database authorization or all DesktopRpcs handler behavior.
The four-descriptor epistemic contract test remains a separate unchanged proof.

Removing RpcSessionAuthLayer from the served protocol makes the missing-token
assertion fail with `expected 200 to be 401`; the real middleware is restored.
The initial boundary test passes under both Node and Bun. Package verification
also checks types, ensuring that the wire fixture is a real schema instance.

Before this Desktop batch, all 239 unit tests passed under both runtimes with no
skips and stable source hashes. Whole-command times were 13.9464 seconds for
Node and 8.4297 seconds for Bun. Private receipts retain source hashes, runtime
versions, process limits, host load and CPU/memory/I/O pressure. Integration tests
are excluded from this baseline and require separate evidence. These measurements
do not establish a causal performance comparison.
