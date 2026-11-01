# Foundation implementation evidence

Started by explicit operator launch on 2026-10-27. This is an execution log, not a completion certificate.

## Baseline and boundaries

- Dedicated sibling worktree `agent-observability-foundation`, branch `feat/agent-observability-foundation`, based on `bea57177a342284007f242a65a126c029791aea8`.
- Primary checkout's untracked exploration and three prepared goals are preserved. Only the foundation goal is active; enrollment and outcome experiments remain paused.
- At launch, user-manager inspection returned `LoadState=masked`, `ActiveState=inactive`, `SubState=dead` for both the forwarder service and timer. No unmask, restart, production intake, replay, archive mutation or deployment performed.
- Fixtures use synthetic strings, temporary directories and a loopback receiver. Existing real transcripts and the historical metrics database are not test inputs.

## Synthetic timing regression

Authoritative files: `packages/tooling/library/ai-metrics/src/ingest.ts`, `src/otlp.ts`, and `test/ingest.test.ts`.

Before repair, two new assertions failed:

1. Transcript bounds selected `09:00Z` before `10:00+02:00`, even though the latter is `08:00Z`. Invalid timestamp text could also become a bound.
2. A historical timestamp existed as an attribute but was absent from the protobuf Span start/end fields. The sender stamped export time into both fields.

Repair compares valid timestamps by instant while retaining their source representation. The protobuf sender uses valid source time; reconstructed session anchors use stored session start time rather than the current pending-turn subset. Reconstructed points explicitly carry `ai_metrics.duration_known=false`; equal OTLP endpoints represent a point, not measured zero-latency work. Missing, malformed or timezone-free values use an explicitly labelled export observation. Malformed timestamp text is removed from the outgoing timestamp attribute. Explicitly zoned nanosecond precision is preserved in OTLP. Calendar-edge validation and submillisecond transcript-bound ordering remain to be qualified.

Focused verification initially passed 3 tests (the two regression paths plus the existing Codex summary case). The real exporter test crosses 512-span boundaries with 1,200 synthetic records and equivalent UTC/offset timestamps. Assertions count all encoded start/end fields: 512, 512 and 176 per batch. Four additional cases cover nanosecond precision, malformed text, a missing value and a timezone-free value; only the first is labelled source event time.

First complete `bun run beep quality package-verify @beep/repo-ai-metrics` exited 0: audit 34.2 seconds, docgen 8.1 seconds. The final repeat after strengthening and repairing edge cases also exited 0: audit 33.1 seconds, docgen 6.3 seconds. Source fingerprints are in `ops/history/implementation-verification.json`. A direct package check before dependency build failed with missing upstream declaration artifacts; the canonical verifier built dependencies and passed.

## Discovery and attribution regressions

The next synthetic test reproduced scan starvation: two runs with `maxFiles=1` per source reached only two of four candidate transcripts. A transactional hash-only cursor now advances in deterministic order per scan root. It advances scheduling before reads, separately from ingestion and delivery receipts. A second fixture closes/reopens the database between attempts: an unreadable first file fails, the next run ingests the other file, and the failed file returns on the following round. Only one successful source row exists. This does not yet prove incremental byte reading, partial-line handling or oversized growth.

Another assertion reproduced false source attribution: all four metadata-only fixture transcripts received the collector checkout as their repository despite having no repository evidence. Derived task storage now separates `collector_root_hash` from nullable `repo_root_hash`. New unknown sources stay null; existing verified source values are retained when a task is rewritten. A one-time transactional migration preserves the legacy hash in collector context and withdraws the unproven source claim without changing task IDs. Its fixture proves preservation and idempotence, including a later explicitly supplied source attribution surviving repeated schema initialization. The mirror projection and AgentTask schema carry the distinction.

No historical production database has been migrated. Source-to-root resolution and clone/worktree/session/task identity reconciliation are still pending; replacing a false assertion with unknown is only the first part of that acceptance item.

Full package verification after these edits passed (audit 69.7 seconds, docgen 9.6 seconds). The final repeat after the nullable collector-field boundary correction also passed: audit 53.2 seconds, docgen 10.0 seconds. The current receipt fingerprints all seven edited source/test files.

## Declared inventory contract and read-only report

The existing `@beep/repo-ai-metrics` library now owns the typed host/root/route manifest and a public report API; the existing CLI exposes `ai-metrics inventory report --input <manifest> [--json]`. The contract names all seven requested harnesses but enum membership is not capability evidence. Capability, known-launch IDs and expected-event IDs remain independent. Unknown populations are tagged explicitly; an enumerated empty set requires evidence. Populations have an explicit inclusive-start/exclusive-end window ending by observation time. Shared launch/event IDs are deduplicated across routes on the same host; identical host-local IDs on different hosts remain separate. Deliberate exclusion, unsupported capability, unknown health, fresh idle/active/failure and expired/stale health remain distinct.

Host, repository, clone and worktree IDs are separate fields. Unproven repository/clone/worktree components remain explicitly unknown, including retired roots. Legacy root IDs are scoped to their host, since identical checkout paths can hash identically on different machines. Root bindings require evidence and must refer to the route's host. Duplicate IDs, dangling links, cross-host bindings, reversed health windows and population overflow are rejected. Input is limited to 4 MiB before parsing; UTF-8 must be valid; unexpected top-level and nested fields are rejected. Boundary errors omit the input, file path and input-bearing causes. These are metadata manifests, not arbitrary transcript containers.

Nine library inventory tests and three CLI integration tests cover the contract, deduplicated populations, explicitly evidenced zero, privacy rejection, size/encoding rejection, human output and JSON reports. The checked-in `research/fixtures/declared-inventory.synthetic.json` exercises the real CLI with all seven capabilities and populations unknown. It is explicitly hypothetical, not a live workstation inventory or proof of any harness's native OTLP support. Live inventory production and mapping from the existing identity registry remain pending. The existing registry's `cloneIdHash` is a checkout-path hash and deliberately differs for a linked worktree. It must remain available for legacy joins; the new owning-clone field needs separate common-Git-directory evidence. File-based Git pointers also need qualification for `commondir` and separate Git directories rather than assuming every `.git` file is a linked worktree.

The architecture planner was consulted with `--slice tooling --concept AgentObservation --domain-kind values --stage core`. Its proposed new tooling-domain package and unrelated proof-file changes were not applied: this packet expressly targets the existing metrics library, which already owns the collector boundary. No new package was introduced.

The full metrics-library verification passed after documentation/export-order corrections (audit 35.5 seconds, docgen 6.2 seconds). A direct CLI check initially lacked dependency declarations; canonical package verification built them and exposed one new test typing error, subsequently repaired. Final inventory/time package verification passed after the additional window and host-scope invariants: audit 55.0 seconds, docgen 9.6 seconds. Current fingerprint receipts supersede interim runs.

## Strict timestamp edge proof

A new synthetic regression first failed because `2026-02-30T00:00:00Z` became the first transcript timestamp. Parsing now shares one internal validator between ingest bounds and actual OTLP serialization. It requires an explicit timezone, verifies calendar round trips, forbids normalized `24:00`/leap-second values, retains up to nine fractional digits and rejects pre-epoch/unsigned-64-bit overflow values. Bounds compare seconds and nanoseconds separately, so two events one nanosecond apart remain ordered across timezone offsets.

The actual protobuf fixture now also covers invalid calendar/time values, valid leap day, a pre-epoch value, the exact unsigned OTLP maximum and one nanosecond beyond that maximum. It verifies the encoded maximum directly and rejects invalid timestamp strings from outgoing attributes. Three focused timing tests pass, followed by full metrics-library verification: audit 35.4 seconds, docgen 6.7 seconds. Native measured durations and downstream display/filtering of reconstructed unknown-duration points still require integration qualification.

## Dankserver collector render and collision proof

A separate clean-base worktree was created for dankserver at revision `33d932c7abfc132b0ced363f77cb1a0fe43da493`, branch `feat/agent-observability-foundation`. The managed template now contains the exact `transform/prom-label-collisions` statements and metrics-pipeline position captured by the source exploration's live audit. The original dankserver checkout remains untouched.

The repository-pinned collector 0.163.1 was pulled locally; the resolved image digest is recorded in `ops/dankserver-verification.json`. The full rendered configuration passes the collector's own `validate` command. A disposable collector with synthetic paired/dotted-only/underscore-only resource attributes then exports all three series. Both conflicting OS values survive under distinct Prometheus labels, and resource/datapoint email markers are absent. Both tests pass with no skips. The same runtime test against the unmodified Git baseline fails specifically because the conflicting-label resource does not survive export, confirming the reported regression.

Fixture containers were constrained to 256 MiB, one CPU, 64 processes, read-only filesystems and loopback-published random ports. Trace export was redirected to a closed loopback port inside the container. Cleanup removed the owned containers and temporary directories. This is local render/runtime proof, not a production rollout; live config drift must be refreshed before applying later queue/health changes. Neither Phoenix nor the held forwarder was restarted.

## Phoenix backup reporting proof

Synthetic execution of the rendered dankserver backup script first reproduced two errors: a failed service recovery left repository success at one, and a failed repository backup replaced the prior success timestamp with zero. A third fixture reproduced a failed start command being hidden by a healthy HTTP response. The script now treats required recovery as part of run success, preserves prior success timestamps on failure, and exposes snapshot-command success separately from service recovery. A failed start command fails immediately. Metrics are written to a same-filesystem temporary file, and failed publication fails the run while preserving the prior file.

Five tests now pass using fake sudo/systemd/curl/restic/SQLite commands, a constrained fixture environment and temporary paths. No service, archive or privilege route was accessed. The proof does not establish real restore integrity, telemetry buffering during cold backup or live deployment. Metric semantics and commands are documented with the owned tests; fingerprints are in `ops/dankserver-verification.json`.

## CLI verification frontier

The first full CLI run completed in 1,326.09 seconds with 7,919 passing tests and seven failures. Phase statuses in this authored packet were corrected from `active` to the canonical `in-progress` domain. The root lint continuation assertion now uses its existing label-normalization helper for the ambient ` (op run)` suffix. Current inventory fixtures include the explicit window and host-scoped identities.

A focused rerun passed seven assertions across the six previously failing files. The remaining assertion compares live packet manifests to HEAD, so the newly authored packet cannot match until the reviewed delivery commit exists. It remains unchanged and must pass in final committed-source verification. Current CLI type checks, Python tests (53 passed, three existing model-dependent skips), TypeScript/Python lint and docgen (3,539 examples) all pass. These do not replace the outstanding final full package run. The current full CLI package gate is therefore not claimed passed. No source or packet has been committed or published. See `research/OPPORTUNITIES.md` for the friction receipts.

## Versioned Git identity and declared-root producer

The existing identity registry now carries additive `gitEvidence` while every legacy root, clone, worktree and event ID retains its derivation. Older registry records decode as explicitly not observed. The new bounded read-only Git probe asks Git for the physical checkout, Git directory and shared Git directory; it no longer infers owning-clone identity from the checkout path. A linked worktree shares its owning clone but has a different worktree identity. Independent clones sharing a normalized remote share repository identity, while separate Git directories and filesystem aliases are qualified correctly. Remote credentials, query/fragment text, physical paths and salts never enter the evidence record. Local-only repository identity is explicitly scoped to its clone. Missing salt/process service, invalid roots, oversized output and timeouts remain explicit unknown observations. Probe output is capped at 16 KiB and each probe at five seconds; scope cleanup is tested.

The full metrics package verifier passed the Git identity addition before the producer work (audit 41.6 seconds, docgen 7.8 seconds). The new producer uses that evidence in `ai-metrics inventory probe-roots --input <private-declaration.json> [--json]`. The private declaration supplies one stable host key, a population window and at most 32 absolute roots. It is capped at 64 KiB, strict UTF-8 and exact fields. A nonblank configured hash salt is required. Probe concurrency is four and total runtime is capped at fifty seconds. Retired roots are never accessed; permission/missing-root failures remain inventoried as unreachable. Stable host identity scopes equal legacy checkout IDs on different machines. Path normalization refuses duplicate declarations. This command does not read transcripts, mutate the registry, enroll harnesses or start the held collector.

The result includes the typed inventory and content-addressed safe root receipts, so every asserted identity has inspectable evidence. All seven requested harnesses start with unknown transport, capability, heartbeat and launch/event populations. The route schema now admits unknown transport instead of forcing the producer to guess native OTLP. The metadata reader is shared with the existing bounded report path. The declaration contains private paths/host labels and must not be published; only the sanitized result is a candidate evidence artifact.

Focused library tests passed 21 assertions across Git identity, root producer and inventory contracts. They use real temporary Git repositories and synthetic credentials, and exercise owning-clone/worktree distinctions, host separation, receipt digests, retirement without file access, permission denial, unsupported roots, privacy, invalid scope and byte/encoding limits. Full metrics-package verification passed (audit 36.3 seconds, docgen 9.3 seconds). All five CLI inventory tests passed; CLI type checks, lint and documentation generation (3,539 examples) passed. A real CLI invocation of the synthetic retired-root fixture produced one root receipt and seven unknown transport routes. Current fingerprints and the distinction from the outstanding full committed-source CLI gate are recorded in `ops/history/implementation-verification.json`. The recovery service and timer were again checked masked/inactive/dead during this work. No production root inventory or harness enrollment is claimed by these synthetic tests.

## Incremental metadata pages and atomic local intake

`src/transcript-page.ts` adds an incremental source reader using the existing `@beep/jsonl` line parser. Its output contains only typed metadata, salted digests, physical byte offsets and explicit rejection reasons. It never archives or returns source text. The reader pins one file handle, limits a sampled page to at most 1 MiB and 4,096 frames, re-reads that bounded page to detect concurrent changes, and uses bounded prefix/cursor anchors. It requests a cooperative ten-second timeout; the eventual worker must enforce a hard process deadline for uninterruptible filesystem operations. Final-component symlinks are refused with `noFollow`; obvious non-files are refused before open.

A proposed cursor carries separate file generation and session evidence. Retries preserve occurrence IDs as a short file grows. Repeated identical records and copied files have distinct occurrence IDs, while salted content hashes identify duplicate candidates without silently collapsing them. Observed replacement, shrinkage or anchor mismatch starts a new generation. These anchors do not prove absence of an unobserved rewrite elsewhere in an already-consumed file. Partial final lines remain unconsumed. An oversized line is scanned in bounded chunks, with a stable rejection occurrence, until its terminator allows subsequent valid records to proceed. Session conflicts withdraw the current session binding rather than inventing one. Original valid timestamps and usage counting basis are retained; message, last-request and cumulative usage are not interchangeable.

Ten source-reader fixtures cover UTF-8/CRLF/BOM byte offsets, partial tails and cursor serialization, retries after growth, truncation/rewrite/rotation, copied files and repeated identical lines, oversized growth, malformed JSON/UTF-8/shape, session conflicts, provider cache fields, a sparse 40 MiB source with bounded reads, frame limits, permission failures, symlinks/directories and concurrent source mutation. Full package verification for the reader passed (audit 36.2 seconds, docgen 6.5 seconds).

`src/transcript-intake.ts` then adds a dedicated SQLite-backed local acceptance journal through the existing Effect SQL client. A page and its cursor compare-and-swap commit in one transaction. Exact page retries return the original receipt; stale cursors, namespace mismatch, queue capacity and storage refusal cannot advance progress. The journal stores metadata pages only, fixes host/namespace/limits as an immutable initialization profile, refuses foreign databases, and verifies its actual synchronization, journal mode, page size and database-page limit. This API does not mutate historical metrics stores, open source files, run a service, export spans or assert backend visibility.

Six real temporary SQLite tests pass: page/cursor commit and exact replay; same-connection reinitialization; injected cursor-write failure rolling back both writes; logical queue exhaustion retaining the old cursor while allowing exact replay; stale-cursor refusal; verified storage settings and ownership/configuration refusal; and actual physical SQLite page-cap exhaustion rolling back a 4,096-frame page. The reinitialization case is deliberately not represented as process-restart evidence. Separate-process kill/restart and lost-ack proofs are the next required qualification. Full package verification with both components passed (audit 39.0 seconds, docgen 6.8 seconds); final verification after pinning the resolved source path passed again (audit 35.5 seconds, docgen 6.5 seconds). CLI source/script/test type checking also passed. Fingerprints are in `ops/history/implementation-verification.json`.

The reader and local journal are building blocks for the replacement worker; they are not wired into the held forwarder or a native HTTP receiver. The following proof extends local crash and scheduling behavior. Launch/source attribution, receipt-derived delivery state, reclamation and live route evidence remain open. Existing services and historical archives are unchanged.

## Process crashes, lost acknowledgment and fair local sweeps

`test/transcript-intake-crash.test.ts` launches independent Bun processes against a synthetic file-backed journal. A test-only SQL proxy pauses after the page INSERT and before the cursor INSERT/commit; an atomic checkpoint proves that the uncommitted transaction contains one page and no cursor. The parent kills that exact child with SIGKILL. A fresh process finds zero accepted pages and no cursor, passes SQLite integrity checking, and accepts the retry once. A second case pauses after commit but before caller acknowledgment. After SIGKILL, a fresh process finds both page and cursor; replay returns the original receipt, including its sequence and acceptance time. No production crash hooks were added. Checkpoints use same-directory rename so the parent cannot observe a partially written marker. Child environments include only PATH, disable automatic environment-file loading, and have a scoped twenty-second test deadline.

`src/transcript-sweep.ts` connects declared source candidates to the incremental reader and local journal. At most 4,096 candidates enter one declaration and at most 32 are selected in a sweep. The journal persists a separate hash-only round-robin scheduling position before reads. A failed read or admission therefore cannot starve the next source, and cannot advance its own accepted byte cursor. Retired candidates remain counted but are excluded from reads. Normalized duplicate source/path declarations and namespace mismatch fail before journal initialization. Output reports only source hashes, typed outcomes and local receipts, with idle/partial-tail and failures distinct. An initial partial line does not create empty journal pages; an observed truncation can commit an empty checkpoint to withdraw the old position.

Four sweep tests prove N+1 fairness with an unavailable source, retired exclusion, payload-free reporting, capacity refusal preserving the unaccepted source cursor, partial tails without queue growth, truncation checkpoints, and duplicate/namespace refusal. The process fixture additionally proves reservations survive four independently opened processes and wrap across three candidates without creating accepted source pages. The three process tests and six original SQLite tests pass in the full metrics-package verification: audit 48.9 seconds, docgen 7.5 seconds. The earlier crash-only full package gate also passed (34.4/6.5 seconds). The SQLite driver was added as a test-only dependency; production storage remains an injected Effect SQL client.

These tests prove process-crash recovery on the tested filesystem, not hardware/power-loss resilience. Scheduling is over an explicit bounded declaration, not yet an incremental filesystem discovery producer. The sweep is not a hard-bounded deployed worker or native receiver. A crash after scheduling can delay reserved files until the next wrap; their source cursors remain unchanged. The additive scheduler table is confined to the new owned journal; no historical store is migrated. Recovery service and timer remain masked/inactive/dead.

## Native projection and local admission checkpoint (2026-10-28)

`src/native-trace.ts` projects bounded OTLP trace requests in JSON and protobuf into positive metadata schemas before persistence. The byte ceiling is 256 KiB, with explicit resource/scope/attribute bounds and at most 1,024 resulting span occurrences. The protobuf decoder uses the existing catalogued `protobufjs` package and a selective field-number schema tied to OpenTelemetry proto v1.9.0. Event/link content is skipped; recursive attribute collections stay opaque and are never decoded recursively. JSON unknown fields are ignored. Selected attributes require one scalar value kind. Equal aliases are allowed, but conflicting session/model/counter values reject the affected span instead of arbitrarily choosing one.

Original native trace, span and parent IDs survive, normalized to lowercase hex. Per-route event IDs and namespace IDs are separate salted digests. Source nanoseconds preserve their unsigned precision; missing/zero endpoints remain unknown and reversed endpoints reject. Span names and session/model identifiers are hashed, with exact approved model names the only plaintext model exception. Prompt/completion text, tool bodies, exception messages, arbitrary resource attributes, commands, event/link payloads and unapproved model names are absent from projected output. Native OpenInference kind and status are retained. Provider usage is kept under an explicitly declared `claude-code`, `openinference` or `unknown` convention; no totals are inferred or cache categories summed here.

`src/native-intake.ts` shares the owned SQLite journal and its page/payload/physical limits with transcript acceptance. A native batch, canonical unique-event index and admission receipt commit in one transaction. Exact batch retries return the original receipt, even at capacity. Identical event metadata in another request or within one batch is counted as duplicate; conflicting metadata for the same event ID is retained as conflict evidence and rejected without replacing the original. Batch read-back verifies its content-addressed identity; receipt read-back verifies a separate digest. `readNewEvents` verifies canonical metadata hashes and returns only newly accepted events, excluding duplicates/conflicts. `readBatch` is audit evidence, not an export queue. Accepted occurrence counters include duplicates and must not be reported as unique events or coverage.

Seven projection tests cover privacy canaries, JSON/protobuf parity with content-bearing fields, aliases, invalid IDs/times/scalars, zero versus absent usage, unapproved models, case-insensitive IDs, unsigned timestamp limits, malformed UTF-8/protobuf and population limits. Seven real SQLite tests cover atomic native acceptance/replay, duplicates/conflicts, malformed-span counts, receipt-write rollback, capacity shared with transcripts, canonical candidate filtering, and altered payload/receipt refusal. Full metrics-package verification passed: audit 41.6 seconds, docgen 9.9 seconds. The intermediate full gate also passed (38.4/6.6 seconds). These tests use synthetic requests and temporary databases only.

At that checkpoint no HTTP server was implemented or listening; the following HTTP checkpoint supersedes that boundary. A successful local API return is not an OTLP network ACK. Gzip with bounded expansion, streaming byte limits, admission concurrency, response encoding/partial success and native process-crash/lost-ACK behavior remain to be qualified. The 256 KiB ceiling must be reconciled with actual declared producer batching before enrollment. Metrics/log signal adapters, complete delivery facts/reclamation, Phoenix token read-back, hard worker bounds and live routes remain open. The historical service/timer hold is unchanged.

## Native HTTP and acknowledgment crash proof (2026-10-28)

`src/native-http.ts` now implements the trace intake boundary as an injected Effect HTTP handler. It accepts `POST /v1/traces` in JSON and protobuf, including gzip, under the administrator-owned route policy. It bounds both compressed input and decompressed output to 256 KiB, caps body reading/expansion at the configured 100–10,000 ms deadline, and permits one in-flight admission. Concurrent requests receive immediate retryable 503 responses; there is no application waiting queue. A capacity/storage failure produces a safe retryable refusal with no receipt header. Oversized bodies produce 413, invalid envelopes 400, and unsupported routes/types/encodings are refused. No raw failure cause is returned.

Full/partial OTLP 200 responses are generated only after the native journal transaction returns. They use the request's JSON/protobuf response type, standard rejected-span counts and static safe messages. Exact retries retain their original local receipt. The optional `x-observation-receipt` header identifies that local receipt, not downstream delivery. Empty valid requests consume no journal page. Platform qualification exposed a valid empty-protobuf edge: a platform request with no Web body rejected `.stream`. Using the public Effect Web-request adapter now preserves that empty body correctly. Retry admission also verifies the stored payload and canonical index before renewing an acknowledgment; a surviving receipt alone is insufficient when its owned evidence has been altered.

Six socket integration tests prove JSON/protobuf responses, gzip, partial rejection, exact retry at capacity, compressed expansion and streaming byte refusal, content-type/method/route handling, receipt-write rollback, immediate concurrent refusal, unfinished-upload expiry and permit recovery. These run through the repository's Vitest Bun compatibility surface. Three additional tests launch actual separate Bun workers on ephemeral `127.0.0.1` listeners: (1) kill after page/event INSERT but before receipt/COMMIT; (2) kill after commit but before the HTTP response is sent; (3) actual-runtime gzip, empty protobuf, compressed expansion refusal, malformed protobuf, concurrent refusal and unfinished-upload timeout. Fresh processes inspect SQLite integrity and counts. Precommit death leaves no accepted page/event/receipt; postcommit lost acknowledgment preserves them; network retry returns one unchanged durable page and receipt. Test children are scoped with forced-kill cleanup, and no fixture process remains.

All nine transport/process tests pass. Final full metrics-package verification after retry-integrity hardening passed (audit 37.1 seconds, docgen 7.0 seconds); the preceding HTTP gate also passed (38.8/6.4 seconds). Source fingerprints and exact proof boundaries are recorded in `ops/history/implementation-verification.json`. The additional `@effect/platform-bun` dependency is test-only; the production module remains an injected HTTP/SQL library. Tests use synthetic requests and disposable journals exclusively.

This proves bounded application-level trace-body admission and process-crash recovery on the tested filesystem. It does not prove power-loss durability, bounded listener connection/header allocation, hard worker CPU/RSS/deadlines, provider batching compatibility, metrics/log adapters, downstream delivery/visibility, or real harness enrollment. Deployment must compose the qualified handler with private authenticated routing and hard server/process bounds before canary use. SDK memory before intake remains an explicit loss window. No production listener was installed, no historical archive was read or migrated, and the original forwarder service/timer remain masked/inactive/dead.

## Delivery facts and response interpretation checkpoint (2026-10-28)

`src/delivery-ledger.ts` now provides bounded append-only delivery APIs over the same owned SQLite database. A fixed target identity scopes the backend/project/projection version; changing the target or limits requires an explicit migration. Verified locally accepted native/transcript pages are reconciled into canonical event enrollment. Native duplicate/conflict occurrences and malformed transcript frames are not enrolled as exportable events. The durable input page remains available if enrollment fails. Enrollment and its page marker commit together, so restart can retry safely. `unregisteredPages` exposes a bounded first page of up to 32 outstanding receipts; it is not yet a complete fair export scheduler.

Each actual network attempt must first commit its caller-owned attempt ID, explicit unique event IDs and exact outgoing payload digest. The API bounds event and attempt populations, limits an attempt to 512 events and caps each event at at most 128 attempts. Shared physical SQLite bounds include ledger indexes and facts. Full capacity refuses new work without deleting facts; exact replay remains idempotent. A result appends once per attempt, with contradictory rewrites refused. Positive visibility records require a known attempt, event membership and matching outgoing digest; the backend adapter still has to perform and validate the actual query. No method sends data, deletes evidence or reclaims payloads.

The snapshot reader derives exactly one state for each enrolled event: pending, accepted-unverified, visible, rejected or unresolved. A prepared attempt with no result stays unresolved after restart. Positive partial-success counts and lost replies remain ambiguous; no per-event rejected subset is invented. A complete later acknowledgment supports accepted-unverified, and a positive backend observation supports visible. A later rejected retry cannot erase earlier acceptance or uncertainty. Visibility means a positive historical observation, not perpetual backend retention. Unknown/unregistered source populations and policy exclusions remain outside this enrolled-event count.

`src/delivery-response.ts` interprets bounded OTLP trace responses in JSON/protobuf. HTTP 200 is accepted only after matching-content-type decoding and valid rejection counts. Positive counts remain partial even when equal to the sent population; zero rejected spans, including warning-only responses, are full hop acceptance. Impossible counts, malformed UTF-8/protobuf/JSON, unexpected statuses and mismatched content types remain unknown. OTLP's four retryable statuses remain distinct from permanent HTTP refusal. The decoder retains no raw server message. The future transport must enforce its 64 KiB response ceiling while streaming and record network failure separately; the decoder does not itself provide a network bound.

Eight SQLite tests prove native/transcript reconciliation, exclusive state precedence, partial/unknown replies, restart, duplicate/conflicting facts, bounded populations, rollback at enrollment/attempt/result writes, integrity refusal and target/configuration drift. Three reply-decoder tests cover full/partial responses in both encodings, warning-only responses, invalid bodies/counts and status classification. Two additional tests kill actual Bun processes before a result write and after its commit, reopen independently, verify SQLite integrity and prove unchanged replay counts. Before-result death leaves the durable attempt unresolved; after-result death preserves accepted-unverified. These process fixtures deliberately perform no network send and do not establish delivery to Phoenix.

All thirteen new tests pass in the full metrics-package verification (audit 53.8 seconds, docgen 8.3 seconds). The original native HTTP and transcript crash tests also remain in that package gate. Source fingerprints are recorded in `ops/history/implementation-verification.json`. Owned fixture processes have exited. The historical forwarder service and timer were rechecked masked/inactive/dead; no service or historical archive was mutated.

Next integration must build the actual metadata-only outgoing projection, commit an attempt before sending, stream/decode its bounded reply, persist outcomes after interruption, and query expected backend identities rather than treating a callback or HTTP status as proof. Bounded reclamation still needs an explicit retention/disposition policy and failure/replay tests; no deletion policy is implied by this checkpoint. Resource-limited worker/listener composition, metrics/log adapters, Phoenix token reconciliation, real route qualification and repository delivery remain open.

## Native sender and disposable Phoenix checkpoint (2026-10-28)

`native-export.ts` now encodes only canonical positive metadata into bounded deterministic OTLP protobuf. It preserves native trace/span/parent identifiers and source nanoseconds on the wire. A missing duration becomes a labelled point, using durable intake time only when both source endpoints are absent. Exact Claude span names supply a fallback kind when OpenInference kind is absent; arbitrary names remain hashed. The shared selective wire schema is internal, and approved model names remain the only plaintext model exception. No provider or dollar cost is inferred.

Claude's uncached input plus cache read plus cache creation becomes OpenInference prompt tokens only when all three are known. OpenInference input is already inclusive and is never summed again. Standard usage is emitted only for LLM spans; missing or overflowing totals remain absent. Invalid OpenInference cache breakdowns are refused as normalized usage. Raw known counters and completeness markers remain available. Three wire tests independently decode exact protobuf fields, check stable IDs/timestamps, exclude private canaries, and exercise incomplete/unknown/overflow/invalid usage.

`native-delivery.ts` reads canonical new events from a retained native receipt, selects at most 512, and derives its destination identity from endpoint/project/projection version. It accepts HTTPS or loopback HTTP `/v1/traces` without embedded credentials/query/fragment. A raw Effect HTTP client is required, without automatic retries or redirects. One in-flight send per worker has no waiting queue. `reserveSend` atomically creates an attempt and grants one send; existing or conflicting attempts cannot produce another network request. Four simultaneous reservations have exactly one winner in the SQLite fixture.

A durable attempt precedes I/O. The request and bounded streaming response share a cooperative deadline, and response collection is limited to 64 KiB. Full, partial, retryable, permanent refusal, malformed/oversized, timed-out and interrupted outcomes remain distinct. Only committed outcomes return `Recorded`; replay returns `ExistingAttempt`. A failed result write leaves the original attempt unresolved. No automatic network retry, backend visibility claim or payload reclamation occurs. Hard process/client limits, authentication, fair scheduling and production composition remain separate work.

Ten real-socket tests qualify successful and partial replies, 503/400/302 without automatic retry/redirect, malformed and streamed oversized bodies, timeout, overlap refusal, interruption, result-write failure and pre-network configuration/selection refusal. Two additional tests SIGKILL an actual Bun sender before its result insert and after its result commit, then reopen from another process and retry the same attempt. The parent server receives exactly one request across restart/replay; state remains unresolved or accepted-unverified respectively, with SQLite integrity preserved. Together with nine ledger tests and three wire tests, the focused run passes 24 tests. The full package gate also passes; the final fingerprint receipt records the current verification.

A disposable Phoenix 20.23.0 container used the exact dankserver-pinned image digest `sha256:c542e7de1dc1fdd0f938de337d44ebefa7266e91391eed6e7978523d7f6e1f2f`, an empty ephemeral database, loopback-only published HTTP port, read-only root, no capabilities, no-new-privileges, 2 GiB memory with no additional swap, one CPU, 128 PIDs and bounded 512 MiB tmpfs mounts. Telemetry and the agent assistant were disabled. The explicit `test/fixtures/native-phoenix-proof.ts` sent only three synthetic spans through the new journal/sender. `ops/verify-phoenix-native-proof.py` reads at most 64 KiB from that loopback project and checks every expected ID/session/kind and token mapping. The resulting `ops/phoenix-native-readback-verification.json` is backend evidence, independent of transport acceptance. It does not implement the production visibility adapter or change ledger state to visible.

Phoenix's REST read-back retained complete Claude and OpenInference cases as prompt=130, completion=5, total=135, cache-read=100 and cache-write=20. The incomplete Claude case retained completion=5 and no prompt/total. Private prompt/session/name canaries were absent; salted sessions and event IDs matched. Source timestamps kept their event date and 100 ms duration, but the standard REST timestamp fields truncated the source's 1 ns remainder to microseconds. The follow-up encoder also carries exact source start/end strings as explicit metadata. A fresh disposable instance confirmed both strings retain the 1 ns remainder. Standard timestamp/UI precision is still microseconds; exact source precision is available in metadata.

The browser verified three traces and three sessions in `foundation-synthetic-proof`, a 100 ms P50, both complete rows showing 135 cumulative tokens, and an incomplete row showing 5. Token/cache charts populated. This exposes a presentation hazard: the default cumulative-token cell is a known subtotal, and cost cells show `$0` while the cost charts report no cost data. Those displays must not become claims of complete usage or zero cost. The synthetic unpriced model also showed no top-model token data. Future operator views need explicit completeness/cost-coverage indicators and denominators. The empty `default` project appeared in this clean instance as well; its presence alone is not evidence of a stray producer.

The temporary browser tab was closed and the owned container is removed after evidence collection. The original forwarder service/timer remain masked/inactive/dead. No production service, historical archive, actual harness route or live Phoenix project was changed.

## Verified backend reconciliation checkpoint (2026-10-28)

The existing Phoenix driver now exposes `makePhoenixSpanReader` with a positive scalar projection, exact project/trace/span filters and a 256 KiB response ceiling while streaming. Each lookup has a five-second cooperative deadline and a single permit without a waiting queue. Only declared attribute keys leave the driver; raw input/output/event content and server error text are not returned or logged. It rejects paginated/duplicate/wrong-identity responses, invalid requested scalar values, unexpected content encodings/types and non-success statuses. An empty successful query returns None; HTTP 404 is a distinct `not-found` error, never proof of non-delivery. Configuration reuses `PhoenixConfigInput`, including explicit optional authentication, with no environment discovery. The injected HTTP client must have no automatic retries or redirects.

`native-readback.ts` is the collector-side verifier. It rebuilds the original canonical native page slice and checks its exact encoded-byte digest and event population against the durable send attempt before any query. It then checks identity, parent, name, kind, status, every managed scalar attribute, required absences and standard timestamps at Phoenix's microsecond precision. Explicit source timestamp metadata must match exact nanoseconds. Only a full match appends a visibility fact. Missing or mismatched metadata cannot advance state; later missing results do not erase a prior historical visibility fact. Visibility establishes that the expected event was observed at a particular time, not which network attempt caused its presence or that it will remain retained forever.

The immutable target is now `native-target/v2`: export endpoint, declared read-back origin, project and projection version. Direct Phoenix delivery defaults the read-back origin to the export origin; an intermediary collector requires an explicit backend origin. Query configuration must match that declaration. This closes a target-binding gap before enrollment. Existing event/trace/session identities are unchanged. Earlier synthetic target configurations are intentionally refused rather than silently migrated; no production or historical journal has been upgraded, and a future deployed target change requires an explicit new owned journal or migration.

Five driver tests cover exact identity, positive projection, empty results, duplicate/paginated replies, wrong identity, malformed attributes, HTTP refusal/not-found, byte exhaustion, timeout and overlapping queries. Three real-socket collector tests compare original encoded requests with stored responses and prove missing/tampered/extra metadata, nanosecond changes, invalid attempts, duplicate results, visibility-write failure, monotonic historical visibility and backend drift refusal. Existing sender and ledger tests remain in the metrics package gate.

A fresh exact-image Phoenix exposed eventual consistency: immediately after intake returned 200, the new project lookup returned 404. The failed proof retained one accepted attempt/result and zero visibility facts, verified independently. The driver now distinguishes not-found; only the explicit disposable fixture performs bounded polling of not-found/empty results (at most 20 lookups, each subject to the reader deadline). The production reader itself does not automatically retry.

The corrected disposable proof sent complete Claude, complete OpenInference and incomplete Claude cases through the actual sender and reconciler. All three transitioned from accepted-unverified to visible only after expected metadata matched. The independent REST verification still reconciles usage and exact timestamp metadata. A separate read-only SQLite reopen verified three attempts, three results, three visibility facts, their payload digests and `integrity_check=ok`. `ops/phoenix-native-readback-verification.json` records the current proof; its browser observations are explicitly labelled as the preceding sender/UI checkpoint, not a repeated UI inspection.

Full package verification passes for the Phoenix driver and metrics library; current source fingerprints and timings are in `ops/history/implementation-verification.json`. The temporary Phoenix container is removed after evidence capture. The hold and historical archives remain untouched. Native backend verification is implemented and qualified as an opt-in library route; host deployment, queue scheduling, bounded reclamation, hard worker limits and actual CLI/desktop qualification remain open.

## Remaining acceptance

All SPEC items remain open until their full evidence exists. In particular:

- Remaining timing integration: downstream exclusion of unknown-duration reconstructed points from latency claims. Encoded event-time, strict calendar, nanosecond ordering and fallback-label tests pass.
- Actual host enrollment and source-session/task/attempt/occurrence attribution. The bounded declared-root producer, versioned Git identity, metadata manifest and read-only report now have synthetic and real-Git fixture proof; no actual host/harness coverage is asserted.
- Incremental filesystem discovery and hard worker limits around the qualified declared-source sweep. The reader, local fair coordinator and journal now have bounded source/capacity/crash proof; the old forwarder remains held and is not silently switched to the new path.
- Production composition and scheduling of the qualified native sender, bounded reclamation and metrics/log adapters. The native backend visibility adapter, socket/process proof and disposable Phoenix reconciliation now pass. Trace HTTP local admission is also qualified; listener/process hard limits and actual producer enrollment remain open.
- Deployed Claude token/cache reconciliation and completeness-aware operator views. Wire, disposable backend and browser proof now pass with the precision and presentation limitations above.
- Dankserver persistent queue bounds, health/backup/retention fixes and tests, followed by refreshed live parity and rollout. The captured collision repair has local source/render/runtime regression proof.
- Declared CLI and desktop fixtures, bounded canary, resource ceilings, privacy ownership and tested rollback.
- Current package verification, required independent review, delivery/hosted gates and closeout.

No source publication, production rollout, recovery-hold release, fleet-coverage assertion or goal completion is claimed.

## Verified payload reclamation checkpoint (2026-10-28)

Implemented a bounded, separately configured verified-page reclaimer in the existing ai-metrics package. Payload deletion and checksummed disposition are atomic, while original acceptance, source progress, canonical identity and delivery facts survive. All accepted native occurrences, including duplicates referring to other pages, must resolve to verified event state. Pending or uncertain delivery is never promoted to success by reclamation. Replay and a new send are deliberately separate: the old receipt/attempt can be read idempotently, while a new send reservation for a reclaimed canonical page is refused.

Seven focused SQLite scenarios and two real Bun process-kill scenarios qualify this path. Full touched-package verification passed: audit 75.6 seconds and docgen 13.2 seconds. The receipt and 59 source fingerprints are recorded in `ops/history/implementation-verification.json`. This checkpoint does not implement uncertain expiry, compact-ledger epoch transition, production worker resource bounds, enrollment, or the remaining full SPEC gates. The recovery hold remains in force.

## Explicit uncertain payload expiry checkpoint (2026-10-28)

Implemented opt-in expiry with immutable deadlines, quiet periods, checksummed historical state snapshots, retained original receipts/cursors/canonical identity, and atomic deletion/disposition. Expiry never creates visibility or successful send evidence. Exact expired retries receive HTTP 410; fresh mixed batches reject expired identities precisely while admitting new events. Retained duplicate-only batches also check whether their original canonical event has expired. Earlier native receipt encodings remain readable with an empty expiry-index default.

The full ai-metrics package gate passed (audit 85.6 seconds, docgen 15.6 seconds). The combined retention suite now has 13 SQLite scenarios and four real Bun process-kill scenarios; the HTTP suite adds a real socket expiry/partial-success scenario, and native intake adds legacy receipt encoding proof. All 59 recorded source fingerprints match the checked files. The held forwarder service and timer remain masked/inactive. No production composition, historical migration, commit or publication occurred at this checkpoint.

Next: implement and qualify compact evidence retention and a bounded observation-epoch transition, including explicit replay horizon and retained aggregate uncertainty/coverage evidence. Then finish hard worker limits, production queue/health/deployment fixes, CLI/desktop qualification, bounded live canary/rollback and repository delivery. The full SPEC remains open; payload reclamation is not indefinitely renewable storage by itself.

## Bounded evidence-window retirement checkpoint (2026-10-28)

Implemented explicit local evidence epochs, atomic retirement of a fully disposed epoch, bounded aggregate uncertainty accounting and continued admission into the next epoch. Receipt identity includes the epoch after epoch zero; source event/trace/span IDs and transcript cursors remain unchanged. Native export and read-back use the retained receipt epoch. New OTLP attributes identify current-epoch duplicate scope and retired local history. Absence after retirement is explicitly current-window absence, never lifetime absence.

Retirement scans fixed groups of 32 records under a configured population cap and deadline. It preserves pending/accepted-unverified/visible/rejected/unresolved counts as window observations, not lifetime unique-event totals. A failed checkpoint write, deadline interruption or process death before commit restores detailed facts. A committed retirement reopens at the new epoch with the uncertainty summary preserved. Exact replay of the latest seal is idempotent; stale/conflicting requests fail.

Synthetic qualification adds eight retention scenarios, two real Bun process-kill scenarios, actual OTLP epoch-field decoding and an earlier-owned-table reopen/migration test. The migration test uses a fresh connection after constructing the older table; the fixture's DROP COLUMN operation had created a temporary schema that the ownership check correctly refused on the original connection. Production recovery data is untouched. The final package gate passed (audit 41.1 seconds, docgen 8.1 seconds); `ops/history/implementation-verification.json` records the evidence and 64 matching source fingerprints.

Before production retirement, qualify a bounded pre-retirement snapshot and guarded restoration. A restore must not discard observations admitted after the snapshot; admission pause/drain/resume and hard worker resource controls remain required. Production retention settings have not been selected. Then finish health/queue/deployment parity, CLI/desktop qualification, live canary/rollback, and repository delivery against the complete SPEC. This is implementation progress, not rollout or goal completion.

## Bounded pre-retirement copy and guarded restore (2026-10-28)

Implemented a one-generation logical recovery copy for the nine compact-evidence tables. Capture, retirement and epoch advancement share one transaction. A manifest and row-digest chain bind exactly what was copied; row/byte/deadline/page bounds prevent an unbounded secondary archive. A successful next retirement atomically replaces that generation. Restore checks the exact successor window, empty current evidence populations and intake/attempt sequence sentinels before restoring the predecessor window and compact facts. Source/scheduler cursors survive unchanged; disposed source payloads are never recreated. The API refuses later admitted observations and returns idempotently for a completed restoration.

Focused proof expanded from 8 to 16 SQLite scenarios and from 2 to 4 actual Bun SIGKILL scenarios (20 total). Added successful reopen/restore with original receipts, dispositions, outcomes, attempt membership and reservation sequences; bounded 33-source paging; refusal after later admission even with its rows removed; damaged-final-row rollback; row and byte exhaustion; preservation of the preceding recovery generation after a failed replacement; deadline interruption after partial restore; injected SQLite allocation exhaustion retaining all original evidence and integrity; and independent process death before/after restore commit with safe retry. Existing retirement-before/after-commit kill cases remain covered.

The recovery hold was rechecked: forwarder service and timer remain masked/inactive/dead. No production route, historical journal or archive was modified. This milestone proves local logical rollback only. Independent database/disaster backup, paused/drained worker composition and hard CPU/RSS/disk/connection ceilings, CLI/desktop route proof, dankserver rollout and bounded live canary remain required. Full acceptance and repository delivery are still open. See `ops/history/implementation-verification.json` for final package verification and source fingerprints.

## Paused worker composition and maintenance coordination (2026-10-28)

Added schema-first control policy/state/errors and a scoped controller with nonqueued bounded activity, close-before-drain pause, exclusive maintenance, explicit resume and terminal scope closure. Interruption and drain timeout keep admission closed; successful or failed maintenance leaves it paused. Added a private composite worker configuration and factory connecting native intake, durable sends, exact read-back, reconstructed sweeps, payload disposition and reversible evidence retirement. Mutating worker entry points share the controller; retirement/restore require paused and drained state. Read-only status, journal counts and event-state views remain available.

Five controller scenarios and three real local socket scenarios qualify the new boundary. Socket cases pause during an actual SQLite admission and an actual outbound HTTP exchange, verify retryable JSON/protobuf refusal without receipts, and complete the expiry/retirement/restore flow while retaining accepted-unverified uncertainty. Existing native HTTP/socket/Bun crash tests also pass after adding the shared control hook. The synthetic backend initially used a mismatched response encoding, which correctly remained unknown; correcting the fixture restored the intended accepted-unverified assertion. No decoder exception was added.

This milestone is library composition, not a deployed daemon. It does not yet prove cross-process journal ownership, hard worker resources, listener limits, scheduling, independent physical backup or live source routes. The final package gate and current source fingerprints are recorded in `ops/history/implementation-verification.json`. The recovery hold and full remaining SPEC/delivery scope remain active.

## Actual worker resource, ownership and restart proof (2026-10-28)

The actual composed Effect/Bun worker now has a reproducible synthetic process proof under user-systemd. Kernel cgroup/process state confirms the memory, zero-swap, CPU, task, descriptor, per-file and core limits; the worker owns the exact inherited advisory lock, and a second owner is refused. A checksum-pinned Caddy process fronts a private Unix socket with bounded HTTP timeouts and its own resource ceiling. Real oversized headers/bodies and incomplete headers/bodies are refused; no refused request adds a receipt. File-descriptor pressure is released, CPU pressure is throttled, and deliberate memory pressure kills only the disposable worker. Independent SQLite checks and a fresh paused worker then confirm intact data and the same receipt on exact replay after explicit resume.

The direct Bun idle-timeout and custom relay experiments failed actual sockets; the custom relay was removed. Normal signal-driven Effect shutdown exits 130, so the owned worker unit explicitly recognizes that exit code; the deliberately killed unit remains an OOM failure. All owned test processes are stopped. The forwarder service and timer remain masked/inactive/dead; no production source or historical archive was opened or modified for this proof.

Full ai-metrics package verification passed (audit 53.9 seconds; docgen 10.6 seconds). The evidence and 72 source/artifact fingerprints are in `ops/history/implementation-verification.json` and `ops/worker-resource-verification.json`. [Worker resource notes](WORKER-RESOURCES.md) record limits, failed experiments, the acknowledgment boundary and reproduction dependencies. This qualifies the tested process arrangement only: aggregate storage quota, independent physical backup/restore, production launcher/scheduling, self-metrics, CLI/desktop/live-canary qualification, dankserver deployment and repository delivery remain open. Continue with independent bounded backup/recovery and runtime integration, preserving the recovery hold.

## Independent physical backup and reboot continuation (2026-10-28)

After the operator's reboot, all 72 preceding fingerprints matched, the forwarder service/timer remained masked/inactive, and no proof units were running. Implemented bounded physical capture and fresh-destination restore, shared the journal table ownership list, and added paused-worker integration. Six SQLite scenarios, four real process-kill scenarios and the worker maintenance scenario passed; the full package gate passed (audit 44.7s, docgen 8.8s). The actual resource-limited worker captured and independently verified a 147,456-byte snapshot. See [physical backup details](PHYSICAL-BACKUP.md).

The operator reported a KDE memory warning. Exact kernel attribution confirmed it was this chat's deliberate 512 MiB cgroup OOM test. Routine resource runs now require an explicit flag to exercise OOM; all owned test processes are stopped and the kernel OOM count did not increase on the subsequent routine attempt. Other active build/lint jobs consume substantial memory outside the bounded agent-run slice and were preserved. See [notification investigation](MEMORY-NOTIFICATION-INVESTIGATION.md).

The routine attempt uncovered intermittent Caddy 502/broken-pipe handling of an oversized request, reopening listener qualification despite prior passes. Do not conceal this with retries or enroll sources yet. Next: repair the early-response boundary without another deliberate OOM, then finish runtime scheduling, aggregate storage/generation retention, health/deployment, CLI/desktop/canary and repository delivery. Current evidence has 78 fingerprints; no production rollout, commit or publication is claimed.


## Streaming discovery and native queue health checkpoint (2026-10-28)

The earlier HTTP early-rejection issue is repaired in the bounded proxy fixture;
current controlled-stop proof passes without exercising OOM. Streaming filesystem
discovery and its worker pause/resume binding passed 12 focused scenarios, the
full package gate, and the actual resource-limited helper proof. See
[discovery evidence](FILESYSTEM-DISCOVERY.md).

The dankserver branch now owns persistent native export storage, hard process
bounds, collector self-metrics and eight alert rules. Six collector tests pass,
including exact-identity replay after SIGKILL at queue and physical disk capacity,
observable refusal/permanent backend rejection and nine promtool scenarios.
Ansible syntax passes; deployment checks now require the actual queue mount,
process ceilings and working self-metrics scrape. See
[queue and health evidence](COLLECTOR-QUEUE-HEALTH.md).

Current-boot kernel evidence still contains only the original 14:26:17 synthetic
service-limit OOM, and no disposable collector containers remain. The old
forwarder service/timer are masked and inactive. No production setting, historical
archive, project deletion, commit or publication is claimed. Continue the full
SPEC with positive metadata boundary/runtime/identity, source and event-lag
health, backup lifecycle, CLI/desktop/live route and rollback, then mandated
reviews and repository delivery. Local queue proof does not close those gates.


## Projected native route checkpoint (2026-10-28)

Fixed a composition mismatch: the foundation emits normalized agent.* spans,
which the legacy collector filter would drop. The new source topology separates
private metadata intake on 4319 from the metrics-only 4318 receiver. The worker
owns positive sanitization; the collector guard is explicitly not a sanitizer
or authenticator. Raw producer migration is a prerequisite to deployment.

An exact-image actual projector/journal -> persistent collector -> Phoenix proof
passed for complete Claude/OpenInference and incomplete Claude usage. Private
markers in prompts, outputs, scope/resource fields, exceptions, links, trace
state and tool data are absent from the journal, queue and backend. Exact
identities, source time, usage and visibility states reconcile. The legacy raw
trace endpoint returns 404, and an unprojected span on the metadata route is
filtered and counted rather than mistaken for backend acceptance. Six collector
tests, ten alert scenarios, Ansible syntax and the full ai-metrics package gate
passed. See [route proof](NATIVE-COLLECTOR-ROUTE.md).

No live source or service was enrolled or changed. Runtime/private-route
composition, actual host/source/task identity and denominators, native metric
privacy, source/event-lag health, backup lifecycle, CLI/desktop/live canary and
rollback, review panel and repository delivery remain open. The recovery hold
and goal remain active.


## Durable native scheduling checkpoint (2026-10-28)

Added automatic bounded selection from durable native receipts, immutable policy
and a checksummed traversal position. One event is claimed before I/O, preserving
fairness after timeout or process death. Retryable replies back off; accepted and
uncertain sends reconcile rather than blindly resend. The scheduler shares worker
pause/drain admission. Six focused scheduler, six worker and three process-crash
tests passed, followed by the full package gate. Actual process death between
backend acceptance and result commit preserved uncertainty and continued with the
next event after restart.

Automatic scheduling also passed the actual disposable collector/Phoenix route.
The refreshed bounded worker/backup proof passed with controlled stop/restart and
no deliberate OOM. All owned proof resources were cleaned up; forwarder service
and timer remain masked/inactive. See [scheduling evidence](NATIVE-SCHEDULING.md).

A full-check attempt timed out during lint under an overly small soft memory
ceiling. The successful retry required the previous 8 GiB hard allowance even
with lint thread limits. This is evidence for explicit capacity admission, not
a claim that thread limiting fixes memory use. No new kernel OOM was recorded.
Production runtime/cadence, identity/coverage, source/event-lag health, reconstructed
stream delivery, metric privacy, backup lifecycle, CLI/desktop/live canary,
rollback, panel and repository delivery remain open under the full SPEC.


## Native cadence and health checkpoint (2026-10-28)

The explicit native runtime executes one scheduling cycle at a time and delays
after completion. Construction/start never resumes worker intake; interruption
pauses/drains it. Failure/deadline observations preserve unknown progress. Fresh
health distinguishes stopped, paused, idle-native, active, degraded, stale and
regressed-clock observations while source coverage stays unknown. Fixed metrics
exclude private identifiers and omit missing counts.

Seven runtime tests and seven actual worker/socket tests passed in the full
package gate (audit 120.8s; docgen 12.9s). The actual metric renderer's completed
synthetic sample passed promtool 3.15.1 parsing. See [runtime health](RUNTIME-HEALTH.md)
and ops/runtime-health-verification.json. No production listener, metrics scrape,
source/event-lag alarm or fleet coverage claim follows from these checks.

Continue with the owned production entrypoint/private health publication, source
discovery cadence and identity/coverage, external freshness and source/event-lag
health, backup lifecycle, CLI/desktop/live canary/rollback, mandated panel and
repository delivery. The historical recovery hold remains unchanged.

## Actual private worker entrypoint

The dedicated Bun entrypoint in the existing CLI package now starts paused,
requires private configuration and matching secret namespace, verifies actual
exclusive descriptor ownership and OS ceilings, and exposes native intake and
health/control only on its private Unix socket. It refuses unsafe creation modes,
symlinked databases and active sockets. Safe startup refusals go to stderr, and
cleanup checks the socket inode. The actual process proof covers autonomous
scheduling, degraded missing read-back, controlled stop/restart and exact receipt
replay with one backend POST total. All six synthetic worker processes are stopped;
no deliberate OOM was run. No live source or legacy unit changed.

Four launch-configuration tests pass. Full ai-metrics package verification passes
(audit 140.4s, docgen 13.3s); actual private metrics output passes promtool 3.15.1.
The CLI source typecheck passes under a separately admitted 8 GiB bounded job; the
earlier smaller scope timed out and is not passing evidence. The final current
receipt is `ops/worker-entrypoint-verification.json`. See
`research/WORKER-ENTRYPOINT.md` for limits and remaining acceptance.

The memory warning investigation was refreshed: the only recorded current-boot
kill still matches the original deliberate service-limit proof. Four preceding
boot queries returned no matching entries. Real workload pressure and swapping
remain distinct from that screenshot attribution; no unrelated job was stopped.

## Explicit source cadence and persistent traversal observations

The private launch schema now optionally declares exact transcript roots and
bounded reading/cadence. Missing configuration remains unconfigured. Source and
native cycles run independently under one owner/finalizer, preserving explicit
pause and preventing slow discovery from starving native scheduling. Current-root
read counters keep partial tails, failed reads and unread backlog visible across
later directory-only pages. Accepted pages carry remaining-byte and partial-tail
observations; a read receipt still proves only local acceptance.

The actual entrypoint proof passes with synthetic sources: no read before resume,
autonomous metadata collection, partial-tail health, controlled restart with no
duplicate source page, and one native backend POST despite missing read-back.
Private text is absent from stored metadata, native wire and health/metrics. All
owned workers are stopped and no deliberate OOM was run. Full package verification
passes (audit 162.0s, docgen 14.9s); actual metrics pass promtool 3.15.1. See
`ops/source-cadence-verification.json` and `research/SOURCE-CADENCE.md`.

This is source intake, not reconstructed backend delivery or fleet coverage.
Production enrollment, independent identity/denominators, event-time lag, external
monitoring/alerts, backup lifecycle, CLI/desktop/live canary and full repository
delivery remain open. The historical recovery hold is unchanged.


## Shared reconstructed delivery and exact reconciliation

The verified retained-page reader, positive reconstructed OTLP projection and
existing sender/ledger/read-back machinery now support accepted transcript
occurrences. Source event time is preserved without invented duration or parent;
usage snapshots retain their basis and remain non-additive. The fair durable
scheduler visits both streams, skips rejected frames and progresses through empty
pages. Mixed gauges are named delivery_pass; retained empty passes report scanning.
Target v3 and schedule v2 explicitly refuse incompatible older synthetic stores,
which remain preserved. Native source identities are unchanged.

The actual paused worker proof passes with two backend POSTs (one native, one
reconstructed), distinct event identities, no blind resend after controlled
restart, source-cursor persistence, private-canary absence and full owned-worker
cleanup. The final ai-metrics gate passes: audit 121.6s, docgen 13.0s, with 5.5 GiB
peak memory and zero additional swap in the bounded verification unit. Actual
metrics pass promtool 3.15.1; the CLI source typecheck also passes. See research/RECONSTRUCTED-DELIVERY.md and
ops/history/reconstructed-delivery-verification.json for exact scope and remaining gates.

The collector guard is still native-only. Actual reconstructed collector/Phoenix
qualification is next, followed by the remaining identity/coverage, lag/alerts,
managed deployment/backup and CLI/desktop/live-canary requirements. Full SPEC,
review and repository delivery remain open; the recovery hold is unchanged.


## Mixed collector route and Phoenix aggregate interpretation

The actual pinned collector and Phoenix images now pass the synthetic mixed
route: three native spans and six reconstructed observations, exact read-back,
invalid projection combinations filtered, and private canaries absent. The
collector guard accepts matching version/stream/name tuples for both projections.
Actual GraphQL checks establish nested attribute filters, distinct stream counts,
known-token subtotals and the effect of reconstructed point spans on unfiltered
latency. See research/MIXED-COLLECTOR-ROUTE.md and
ops/reconstructed-collector-route-verification.json.

Final package verification passed: audit 219.2s, docgen 21.1s, total service
runtime 243.246s, peak 5.5 GiB and zero additional swap. Fixture typecheck and
the actual rendered collector configuration/scrubbing checks also passed. The
queue crash suite was not rerun for this guard-only change; its earlier receipt
remains historical evidence. All disposable route resources were removed.

Independent host/root/route identities and launch/expected-event denominators,
lag and external monitoring, managed installation/backup, actual CLI/desktop
enrollment, bounded live canary, review and repository delivery remain open.
The recovery hold is unchanged.

## Independent population comparison

The new `inventory coverage` command binds a separate observation snapshot to the
inventory's exact window, evidence boundary and declared routes. Known launches,
locally accepted events and backend-visible events are compared independently.
Unknown denominators, unassessed routes, partial queries, unmatched expectations
and unexpected arrivals stay distinct. No capture percentage or inferred loss is
reported. Inputs are metadata-only, byte/population bounded and reject excess
fields without exposing schema payloads.

The retained disposable Phoenix proof supplies positive acceptance/read-back
observations for three expected native IDs independently calculated from its fixed
request contract. The actual CLI report matches all three while retaining unknown
launch counts and partial-query flags. This is a historical synthetic report, not
actual agent-launch proof or live collection. See research/COVERAGE-RECONCILIATION.md
and ops/history/coverage-reconciliation-verification.json for final verification status.

The refreshed managed-driver source uses an explicit environment allowlist and
verified session identity. Ambient OTEL inheritance cannot enroll it. Integrating
owned launch/result receipts and root/task/attempt identity, then real query adapters
and periodic freshness, remains the next coverage work. Full acceptance, review,
canary/rollback and repository delivery remain open; recovery hold unchanged.

## Complete journal ownership boundary

Managed-launch discovery exposed a fixed LIMIT 20 in reopening and backup capture,
exactly equal to the full worker's owned table count. Two actual full-worker
fixtures reproduced acceptance of an unexpected late table. A digest-valid older
snapshot fixture separately reproduced incorrect restoration success. The checks
now read the canonical allowed count plus one sentinel, and snapshot inspection
applies the same boundary before publishing a restore marker. All 26 focused
worker/intake/backup/crash tests pass. Final package status and fingerprints are
recorded in ops/history/journal-ownership-verification.json; details are in
research/JOURNAL-OWNERSHIP-BOUNDARY.md. No launch schema/table was added yet; its
lifecycle, retention and identity integration remain the next implementation work.

## Managed launch observations: local journal foundation

The replacement journal now holds bounded metadata-only Prepared, Started,
SessionBound and Finished facts with independent repository, clone, worktree,
task, attempt, source-session and launch identity. Preparation is not a started
process; process outcome is not task-quality evidence. Unknown identities remain
explicit. Exact retries return the original committed receipt; conflicting facts,
out-of-order phases, stale epochs and stored corruption are refused.

Preparation reserves four 8192-byte facts in the logical payload budget. Native
and transcript intake account for that reservation. The database still has its
independent physical ceiling; this is not a promise that arbitrary disk exhaustion
can never prevent a completion write. The worker exposes writes through its
existing paused admission boundary. Open launches hold retirement, and closed
launch-only epochs enter cumulative counters and reversible recovery snapshots.

The first focused run exposed shared SQL state across independent tests. Each
case now gets a fresh layer; all 38 focused tests in four files pass (487.8 MiB
peak, zero swap), and the package test typecheck passes (1.9 GiB peak, zero swap).
The full package verification is recorded separately in
ops/history/launch-facts-verification.json once terminal.

No real harness has been connected to this writer. Producer verification, actual
managed-launch/session joins, coverage query adapters, transport integration, and
end-to-end CLI/desktop canaries remain required. Historical recovery hold, source
files and databases remain untouched. This step does not establish all-harness
coverage or fulfill the goal's final acceptance.

## Private launch transport

An opt-in metadata endpoint now connects external launch controllers to the sole
owned journal process. It has explicit route enrollment, host/namespace/epoch
binding, byte and deadline bounds, shared pause/admission, and receipts only after
commit. The actual worker process exercised two synthetic CLI/desktop-marked
lifecycles and exact replay after restart. See research/PRIVATE-LAUNCH-TRANSPORT.md
and ops/history/launch-http-verification.json for tests and exact limitations. Actual
managed driver integration and all production acceptance remain open.


## Private launch client and destination context

The private client now verifies the owner-only Unix socket and exact committed
receipt, reads paused destination context, and preserves ambiguity without automatic
resend or epoch replacement. The separate-process actual-worker proof submits eight
synthetic lifecycle records and recovers identical receipts after a controlled
restart. All 24 focused tests and the full package audit/docgen pass. Details and
fingerprints are in ops/history/launch-client-verification.json. Actual managed producers,
coverage joins and live deployment remain open; the recovery hold is intact.


## Actual managed child observation boundary

The driver now exposes actual spawn and validated-session observations through an
explicit optional port, with bounded callbacks and cleanup before failed open
returns. The driver suite passes 55 tests. The real worker proof now includes an
actual synthetic Codex peer, hashed source-session agreement with native OTLP,
12 exact receipts across restart and full owned-process cleanup. See
research/MANAGED-LAUNCH-EVIDENCE.md and ops/history/managed-observer-verification.json.
Durable attempt claims, production producer reconciliation and live enrollment
remain required; successful observation callbacks alone cannot prevent a caller
from mistakenly launching a second process after a crash.


## Independent launch claim recovery

A separate bounded claim store now prevents the same attempt from launching again
when its producer fails or the collector is restored to a pre-launch backup.
Actual child/restarted-worker integration refuses a second launch while ordinary
telemetry remains replayable. See research/LAUNCH-CLAIM-RECOVERY.md and the dedicated
claim receipts for exact proof and remaining production boundaries. This does not
complete lifecycle reconciliation, live enrollment or the full packet.


## Durable lifecycle outbox and acknowledgment recovery

The claim owner now persists immutable lifecycle observations before transport and
reconciles exact acknowledgments without process-launch authority. A killed producer
retains Started metadata. The actual worker proof loses the final acknowledgment,
then a new producer recovers it after restart without launching the child again.
See research/LAUNCH-OUTBOX-RECOVERY.md and ops/history/launch-outbox-verification.json for
source-bound evidence. Real controller enrollment, conservative outcome closure,
independent coverage populations and production/delivery gates remain open.


## Existing managed-owner enrollment

The actual agent-message serve command now has explicit optional observation
enrollment, stable owner-bound attempts, local durable callbacks, bounded scoped
reconciliation and conservative actual-child closure. See
research/MANAGED-OWNER-ENROLLMENT.md for qualified scenarios and remaining rollout
boundaries. No real harness was enrolled and the historical hold remains intact.


## Existing managed-owner command recovery

Added bounded observation status/reconcile to the existing agent-message CLI.
The real serve command captures locally while collector intake is paused, closes
its actual synthetic child, and a fresh recovery-command process delivers the
original four facts after collector restart without relaunch. The shared proof
retains sixteen facts and stops all ten owned services. Each periodic flush now
releases its HTTP client scope immediately. See MANAGED-OWNER-ENROLLMENT.md and
ops/history/managed-owner-recovery-verification.json; broader CLI, real harness/canary,
production, independent population and repository-delivery gates remain open.


## Explicit managed-owner provisioning

Registered initialize-claims/enroll operations now replace manual hash/enrollment
construction in the actual command proof. They use strict private input, explicit
epoch/identity, independent-store ownership, exclusive output and durable sync.
Tests preserve missing/existing/partial/consumed state; no recovery fallback is
introduced. See MANAGED-OWNER-ENROLLMENT.md and the provisioning receipt. Population
publication, operational claim-store recovery, broad CLI and rollout/delivery
gates remain outstanding.


## Independent managed-owner cohort publication

The registered population command now derives claim-created-in-window cohorts
from the independent store, separating intentions, starts and acknowledgments.
Two bounded agreeing scans reject concurrent disagreement and duplicate claim IDs;
unknown starts, event populations and backend visibility remain explicit. Actual
human/JSON command proof covers paused intake and recovery. See
CLAIM-POPULATION-PUBLICATION.md and ops/history/claim-population-verification.json.
Operational claim-store recovery, broad CLI and live rollout/delivery remain open.


## Claim-store loss and live root inventory

Actual registered command processes now prove refusal at the claim-integrity
boundary for missing storage, a quarantined stale snapshot and a torn record.
All original outbox bytes survive, no child starts, and no automatic repair occurs.
This verifies a recovery hold; it does not qualify production claim backups or
permit restoring an old launch fence. See CLAIM-STORE-DISASTER-REHEARSAL.md.

A real read-only root probe captured 27 present Git roots among 28 declared paths
on this workstation, with seven explicitly unknown harness routes. Actual human
rendering exposed misleading zero-first wording, now corrected to lead with an
unknown population and separate counts of enumerated IDs. See
WORKSTATION-ROOT-INVENTORY.md. Live route qualification and deployment remain open.


## Live project interpretation and description ownership

Refreshed live project aggregates with and without an explicit seven-day window.
The default project retains one trace outside that window; effectiveness remains
empty with a named held producer. Added verified descriptions to all three
projects and matching idempotent dankserver tasks. Full playbook syntax and live
description-only read-back passed; no service/collector/retention deployment or
project deletion occurred. See LIVE-PHOENIX-PROJECTS.md and the update receipt.


## Replacement service deployment boundary

Added observation-plan under the existing AI-metrics install command, using the
shared systemd path constraints. Actual installed-unit proof bundles the worker,
verifies artifact checksums, limits the loopback frontend to POST traces, preserves
private controls, and stops both services on worker stop. Corrected directive
quoting and Caddy shared-autosave behavior discovered by the real installation.
See OBSERVATION-DEPLOYMENT.md; this bounded synthetic installation does not qualify
a production backend canary or automatically release the historical hold.


## Bounded live route qualification

The installed worker/frontend now has a two-record synthetic canary through an
isolated exact-image collector into deployed tailnet Phoenix. Backend event IDs
match the local ledger and two positive visibility receipts. Source nanoseconds
and separate session grouping survive; private test content and original session
strings do not. Pause, dependent service shutdown, exact unit removal, collector
shutdown/removal and preserved backend evidence pass. Historical forwarder remains
masked. See LIVE-CANARY.md for the retained initial DNS failure and the limited
meaning of this successful route. Production collector configuration was not
changed; this is not real harness enrollment or full goal completion.
