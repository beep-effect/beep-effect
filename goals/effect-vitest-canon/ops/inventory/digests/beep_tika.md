# @beep/tika — four-lens source audit

7 census files, 28 rows, 4 review items and 24 file-specific no-findings rows. All rows are open P1 judgments; P2 remains gated.

## Topology, native boundaries and limitations

Five executable files and two support files separate pure schemas/errors, injected HTTP behavior, native tika-app subprocess stubs and opt-in real server parsing. Server unit tests inject HttpClient.make with canned Web Responses; the production constructor requires only HttpClient and accepts caller-supplied bytes/text. NodeServices in the stub test layer is not evidence of required native I/O. Shared capturedUrls is used by one case; this audit does not invent a concurrent data race. The 5ms/500ms simulated timeout is wholly Effect-managed and can be controlled without falsifying the real server boundary.

The tika-app tests create executable shell stubs in scoped host directories, then use a real child process. Keep those native files and byte-authority checks; a fake in-memory filesystem would not be visible to the process. This is not real JVM/JAR conformance. The missing-executable logger test already verifies sanitized context and must retain those checks.

A concrete live-fixture contract mismatch is source-derived: liveOperation writes bytes to a temp file, then constructs SourceArtifact without bytes or text. Tika.server.ts188-203 explicitly rejects that input rather than reading a locator. With the URL gate enabled, supported extraction cases cannot dispatch rmeta from these inputs. Supply the existing bytes at the caller boundary during authorized P2; do not add production host-read fallback. The live gate currently permits all eleven registrations to finish via skipNotice, so historical passed statuses cannot prove this path worked. The PDF oracle additionally accepts unrelated nonempty text. Preserve all text marker checks, PNG metadata-only behavior and the unparseable payload's explicitly allowed success-or-typed-failure semantics.

fixtures.ts is canned adapter data, not binary parser evidence. live-fixtures.ts locally builds deliberately limited PDF/ZIP/PNG/CFB payloads, using native zlib for compression and fixed ZIP timestamps. Current ASCII marker fixtures do not advertise arbitrary XML/Word/PDF escaping support. Real parser acceptance remains gated and unexecuted here.

The canonical package history summary has zero mapped Tika observations. Its retained completion artifact contains four package-null rows with the exact Tika property name and `test/Tika.service.test.ts` stack. Source and stack comparison attributes these to one TikaError schema-equivalence failure family across four distinct jobs, after 146, 26, 949 and 153 generated trials. Each failed after re-encoded structural equality passed. The four historical test files are identical. The current test retains the comparator helper and assertion operands while changing generator and registration APIs. Original package-null records and canonical history counts remain unchanged.

Historical TikaError used `annote` without an explicit declared-field equivalence hook. Current `annoteError` installs that hook; the declared error fields and default-call sites are textually unchanged. Historical locks resolve Effect and its test adapter to rc.108 for the first two jobs and rc.109 for the last two, with Vitest 4.1.10 and fast-check 4.9.0 throughout. This establishes a comparator-policy source difference, but no replay proves it fixed the historical failures. Printed `new Error("")` counterexamples omit fields needed for causal attribution. Exact historical Effect internals and the historical run-options helper remain unverified. No current failure or flake is inferred. The explicit `fcRuns(1000)`, seed 1754546950 regression law remains intact.

## Review items

- **L-FLAKE-01 — synthetic-live-timeout-race**, `packages/drivers/tika/test/Tika.server.test.ts:516-533`. An injected HttpClient response delayed 500ms competes against a 5ms timeout under it.live. Control this entirely Effect-managed client delay with TestClock after the request and deadline are armed, retaining the 5ms budget, 500ms delay and exact operation-timed-out assertion. Keep the independent live server integration. This is source-derived scheduling sensitivity, not an established hosted flake.
- **L-RES-04 — locator-only-live-input-contract**, `packages/drivers/tika/test/integration/Tika.server.live.test.ts:49-79`. liveOperation writes bytes but omits source.bytes/text; Tika.server.ts188-203 rejects locator-only input. Supply the existing exact fixture bytes through SourceArtifact.bytes while preserving locator metadata, scoped temp cleanup and all native HTTP/parser assertions. The adapter explicitly refuses locator read authority; do not restore host fallback or weaken that production boundary. With the live gate enabled, supported extraction fixtures fail before rmeta HTTP dispatch. This is source-derived, not an executed server failure.
- **L-OBS-03 — unreported-live-gate**, `packages/drivers/tika/test/integration/Tika.server.live.test.ts:98-204`. The URL gate returns skipNotice in every live registration, so a green registration need not execute its assertions. Retain all eleven live registrations and their assertions, including allowed success-or-typed-failure behavior for the unparseable payload. Report absent URL capability as explicit non-execution through the approved gate. Do not equate the retained all-passed timing statuses with live parser execution or mark those historical registrations skipped.
- **L-PROP-04 — pdf-content-oracle-gap**, `packages/drivers/tika/test/integration/Tika.server.live.test.ts:144-162`. The PDF case checks content type and nonempty extracted text, but not the known fixture marker. Preserve both existing assertions and require extracted text to contain liveMarker, as the other text fixtures already do. Unrelated nonempty text currently satisfies this PDF oracle. Keep the real generated PDF and server parser; do not substitute canned metadata.

## Retained timing and provenance

Node22.22.3 / Bun1.4.2 / Vitest4.1.11 context: 70 passed registrations; reporter interval 6817.207031ms; whole command 7.174560s. Source head 662823dd960367046ba7d73dd8fd25d15782865a. Full executable-file representation is recorded; support files have no independent test timing. This is not coverage, compiler or package acceptance. No rerun or workload adjustment was performed. Runtime and workload identities remain in the public package timing context.

- Historical assertion-or-property-failure: https://github.com/beep-effect/beep-effect/actions/runs/31799253491/job/94763099676, head `b22d23fcab9c0c0cc8824d27d9ed245d2e7183d1`, path `test/Tika.service.test.ts`. 2026-08-14T12:24:03.3673376Z  FAIL  test/Tika.service.test.ts > @beep/tika > round-trips schema-derived extraction operation data through file-processing schemas 2026-08-14T12:24:03.3674924Z Error: Property failed after 146 tests
- Historical assertion-or-property-failure: https://github.com/beep-effect/beep-effect/actions/runs/31983137010/job/95253380701, head `195ef0ce5b7e1f687fc3a91763f9401611a1fa11`, path `test/Tika.service.test.ts`. 2026-08-17T01:09:00.5795848Z  FAIL  test/Tika.service.test.ts > @beep/tika > round-trips schema-derived extraction operation data through file-processing schemas 2026-08-17T01:09:00.5797657Z Error: Property failed after 26 tests
- Historical assertion-or-property-failure: https://github.com/beep-effect/beep-effect/actions/runs/32631750538/job/97175499726, head `287ff0afb9c1ab0b353b4795c1ac1b066d136da7`, path `test/Tika.service.test.ts`. 2026-08-23T09:44:38.0948394Z  FAIL  test/Tika.service.test.ts > @beep/tika > round-trips schema-derived extraction operation data through file-processing schemas 2026-08-23T09:44:38.0957812Z Error: Property failed after 949 tests
- Historical assertion-or-property-failure: https://github.com/beep-effect/beep-effect/actions/runs/32663831727/job/97254000452, head `793cda0db4541065becef6fc3dd76a98c2b3846b`, path `test/Tika.service.test.ts`. 2026-08-23T20:23:51.3426125Z  FAIL  test/Tika.service.test.ts > @beep/tika > round-trips schema-derived extraction operation data through file-processing schemas 2026-08-23T20:23:51.3427662Z Error: Property failed after 153 tests

## P2 ordering and uncertainty

After separate P2 authorization: establish resource ownership and preserve native subjects; strengthen identified assertions without removing originals; preserve generator inputs, seeds and run floors; control only justified Effect time or add native readiness evidence; then make gated execution and lifecycle output attributable. No timeout increases, retries, external service acquisition or flakyTest proposal is justified here. A passing timing cohort does not eliminate source-derived risks.

## Top files and counts

- `packages/drivers/tika/test/Tika.errors.test.ts`: 4 rows, 0 review items.
- `packages/drivers/tika/test/Tika.server.test.ts`: 4 rows, 1 review items.
- `packages/drivers/tika/test/Tika.service.test.ts`: 4 rows, 0 review items.
- `packages/drivers/tika/test/Tika.tikaapp.test.ts`: 4 rows, 0 review items.
- `packages/drivers/tika/test/fixtures.ts`: 4 rows, 0 review items.
- `packages/drivers/tika/test/integration/Tika.server.live.test.ts`: 4 rows, 3 review items.
- `packages/drivers/tika/test/integration/live-fixtures.ts`: 4 rows, 0 review items.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
