# Isolated pinned recognizer — 2026-11-08

The actual worker invokes the selected eyecite-ts 0.34.2 driver through Effect's
RpcGroup, socket client, stdio server and SchemaBinary serialization. The
existing native admission and physical process owner retain cleanup deadlines,
exit acknowledgement and quarantine. The parser service has not yet switched;
verified semantic/source adaptation and public Layer acceptance remain open.

## Focused proof

Five test files pass, 34 tests total: CitationRecognizerWorker (9),
CitationNativeSocket, CitationNativeProcess, CitationSixFormResolution and
CitationResolve. The worker runs all 29 frozen inputs / 33 occurrences separately
on Bun and Node, with raw original ranges checked against frozen expectations.
An observed spawner confirms 29 creations and 29 exits per runtime. Eight further
owned process executions exercise refusal controls: 66 total acknowledged owned
executions in the new worker tests, excluding runtime bootstrap probes.

The controls establish source refusal before spawn; complete candidate-overflow
refusal; outbound request refusal before stdin bytes; oversized response refusal
before stdout bytes; source-free warning refusal; captured-clock deadline and
physical retirement; valid response followed by exit 7 refusal; and a diagnostic
after the response/EOF refusing publication. Encoded failures do not contain the
private diagnostic sentinel or working-directory path. The deadline fixture
calls the recognizer then blocks synchronously; it proves supervisor control,
not interruption inside an actual pathological donor parse.

The supplied stdio EOF shutdown interrupts its root after flushing. Installed
Runtime.defaultTeardown reports interruption-only completion as exit 130. Real
Bun and Node workers demonstrate this behavior; only 0/130 are accepted, and
successful RPC results remain private until exit and drained stderr agree.

The constructor captures dependencies and its returned recognize method has
R = never, checked by source/test types. Both directions reject oversized
encoded chunks before transport writes. Supplied frame sizing remains the
receive-side bound; no exact processMessageBytes safety tag is claimed for all
transport refusals. Fixed child clients configure zero reconnects and liveness
against the captured operation deadline.

Full server source/test type checking passes. Blocking server package laws have
zero findings; three inherited terse-name advisories remain. Package JSDoc
passes. Two terminal-refusal tests were rerun after package-import style repairs.
A read-only Effect/lifecycle review found no concrete defect and requested those
two controls before qualification. No broad coverage percentage is claimed.

## Cache and remaining delivery

The reviewed cache baseline records the new workspace and server dependency /
project references. Eight new driver tasks stay uncached, existing qualification
scope and epoch are unchanged, and cache audit has zero blocking findings.
The reviewed request and exact-byte basis are retained in research/.

Remaining: receiving-side genuine source verification and semantic adaptation,
correct recognizer/profile provenance, actual public Layer linking/resource
acceptance, runtime packaging, owned hosted checks, review, merge and retention.
Historical exhaustive parity capabilities remain superseded, not completed.
