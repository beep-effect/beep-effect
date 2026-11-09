# Six-form aggregate coverage repair

Hosted job 128782709984 on PR #2966 authenticated complete producer evidence,
then rejected the server package totals: lines 98.18 < 98.27, statements
97.23 < 97.38, branches 93.95 < 94.06, functions 95.27 < 95.38. The earlier
file-level regressions and extractor model gaps were restored. New-file
identity approval does not waive this independent aggregate gate.

## Changes

- NativeSocket now owns the optional captured encoded-chunk ceiling, so both
  writes and batches use one guarded queue implementation. The worker supplies
  its already validated policy. The duplicate worker writer wrapper is removed.
  Exact four-byte strings/bytes are accepted; five-byte writes and batches are
  refused before queuing; closing remains independent of the byte ceiling.
- Supplied Effect String.search and Option find one supra token and refuse a
  second without collecting all matches or retaining an optional regex index.
  Original UTF-16 offsets and word-boundary semantics are preserved.
- Identical source-free error factories are shared in the Layer and resolver;
  supplied Effect.fromResult owns canonical artifact success/error matching.
- The actual worker program runs with supplied Stdio.layerTest, Socket
  transform streams, SchemaBinary and RPC services. Controls verify startup
  refusal, real pinned recognition and amplified reply refusal before stdout.
  The byte-boundary control probes the real request/reply framing with fixed
  request IDs, then sets the ceiling to the exact admitted request size.
  These are program/port controls, not physical-isolation proof. Existing real
  Bun/Node child, responsiveness and independent retirement tests remain.
- Additional real RPC controls refuse schema-valid out-of-source observations
  and preserve the declared backend source-limit refusal. An internally
  interrupted spawn starts no child, preserves interruption and releases every
  process/admission count without quarantine.

## Scoped evidence and limits

Seven focused suites pass 61 tests, including actual Bun/Node frozen-profile
replay. The tested worker path has 100% scoped lines/statements/functions; its
remaining branches are the Layer's final non-limit resolution-error mapping and
stdio's string input arm unused by the installed binary protocol. NativeSocket
and SixFormProjection are fully covered in this run.

An official-Istanbul diagnostic projection combines the complete authenticated
prior hosted maps for unchanged files with current actual counters for changed
files: lines 98.32, statements 97.38, branches 94.09, functions 95.43. All exceed
or equal the unchanged original package floors. This mixed-execution projection
is diagnostic only; it is not exact-head hosted proof or a baseline source.

## New-file identity recording

The goal and coverage policy require final exact-head hosted acceptance and
reviewed measured new identities. They do not require a separate hosted cycle
before recording new rows. The earlier repair receipt's stricter sequencing was
self-imposed and is superseded here: commit/freeze source, instrument each
reviewed file completely, retain its actual provider/runtime/raw counters and
source hashes, review the exact path allowlist, and invoke only the canonical
addMissingFilesOnly writer. A focused summary remains a focused summary; its
package total is never adopted.

The canonical planner must preserve every existing package/file percentage and
uncovered count, add only approved absent file identities, and remove nothing.
No existing floor, assertion, timeout or resource ceiling may be lowered. The
resulting final head still requires complete hosted checks before merge.
