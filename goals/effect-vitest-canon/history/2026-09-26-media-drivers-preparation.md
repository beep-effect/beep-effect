# ExifTool and Face Detection preparation

This wave consumes the existing 61 inventory rows for seven files in
`@beep/exiftool` and `@beep/face-detection`. Five files changed since the frozen
census; current membership remains the same. Source preparation follows D12
and must preserve the real native resource subjects. No source migration is
included in this baseline checkpoint.

ExifTool 13.55 is installed. Its baseline includes real PNG/GIF metadata
roundtrips and video-container refusal in native temporary directories. The
three live cases passed and emitted no log-only skip message. The existing
availability helper can turn a typed version error into a successful log-only
return; that reviewed finding remains pending rather than being hidden by
these successful baseline runs.

The ONNX installer test exercises the installed script with mocked HTTPS
responses and real temporary files, symlinks and ZIP bytes. The reviewed
`installPackages` path does not invoke the child-process branch, download a
model or perform GPU inference. Native filesystem/rename behavior is the
subject and must remain native.

All four baseline runs passed with stable source hashes. Public raw reports
and runtime/load/pressure context are under the `media-drivers` baseline
timing directories. These samples do not establish a performance improvement.

- exiftool node: 17 passed, 0 skipped; 4.653 seconds
- exiftool bun: 17 passed, 0 skipped; 2.423 seconds
- face-detection node: 14 passed, 0 skipped; 4.471 seconds
- face-detection bun: 14 passed, 0 skipped; 2.612 seconds

## Scope checkpoint

Face Detection scope commit `2520171e0e` removes its local provide wrapper,
preserves both public withDetector call forms under harness ownership, and
adds the native ONNX fixture hook budget. Full audit/docgen passed (8.1 / 3.2
seconds). Its existing 13-domain native property suite also passed with the
400-run floor and seed 20260708, retaining fcRuns(20) and existing domains.
No additional assertion or flake repair is justified for this package.

ExifTool's six fake-spawner cases now use isolated MemoryFileSystem + Path
harness layers. Service, fake spawner and test body share each fixture's
filesystem. Command captures reset on every invocation. Native integration
retains real filesystem/process services with excludeTestServices and a
bounded layer hook, while each test owns its temporary image directory.
Both wrapper definitions, imported scoped provider and redundant whole-body
scopes are removed. All 38 unit and 16 integration expectation expressions
and embedded PNG/GIF bytes are preserved. Final full audit/docgen passed
(15.1 / 4.8 seconds), including the three native integration cases.

ExifTool properties, availability masking and instrumentation remain for their
later D12 phases. No production code changed.

## Assertions and Face Detection instrumentation

ExifTool assertion commit `9528437796` replaces 22 existing Option/Boolean
assertions while preserving exact operands and polarity. Full audit/docgen
passed (9.3 / 3.1 seconds). The encoded provenance equality, six command
capture resets and native PNG/GIF fixtures remain unchanged.

Face Detection runner commit `ba75dec0b8` adopts `@beep/test-runner` in all
three test files, with its workspace dependency and generated references.
Full audit/docgen passed (7.7 / 3.2 seconds). CI tracing passed all 14 tests
across three files, including the native ONNX installer fixtures. Final
timing samples passed 14 tests with no skips and stable source hashes:
Node 3.283 seconds; Bun 1.407 seconds. Load and pressure context accompanies
the raw reports. These single samples do not establish a speedup.

Cache dependency accounting, Fallow projection and final ledger reconciliation
remain before this wave can be published.

## ExifTool property, flake and runner completion

Property commit `bd8b169294` exposes fourteen named native laws with the
existing fcRuns(25), encode/decode equality and opaque-cause filter. Full
audit/docgen passed (7.8 / 2.9 seconds); all fourteen laws passed with a
400-run floor and seed 20260708. The two stale EV001 findings were removed
upstream by `b1aa7e320c` before this wave and receive that attribution.

Flake commit `00fe7b69a6` distinguishes typed missing-executable errors from
genuine process failures. Runtime probes prove three native passes, three
explicit skips when the binary is absent, and three failures when it resolves
to an executable returning exit 1. Fixture bytes and all native oracles are
unchanged. Full audit/docgen passed (10.3 / 3.0 seconds).

Runner commit `90272ce408` covers all four ExifTool files and generated
dependency projections. Full audit/docgen passed (16.8 / 6.9 seconds), and
CI tracing passed all 30 tests. The missing/failing executable probes were
repeated through this runner with the same exact skipped/failed outcomes.
The increase from 17 to 30 registrations is the aggregate-to-fourteen law
split, with no added domain or in-scope file.

After both runner dependencies were present, the final timing runs passed
with stable source/lock hashes and no skipped tests: ExifTool Node 8.221
seconds / Bun 4.205 seconds; Face Detection Node 11.834 seconds / Bun 3.895
seconds. Each report includes workstation load and pressure context. These
samples vary with concurrent workstation work and do not establish a speedup.
They supersede the earlier Face-only dependency-state samples above.

Cache accounting changes only eighteen runner dependency edges and the
review reference. Cache audit reports zero blocking findings and 1251
unassessed cached computations; no qualification is promoted.

## Reconciliation checkpoint

Strict validation passes all 61 rows across the same seven files with zero
missing lens coverage: 30 fixed (including two upstream fixes), five retained
native historical exceptions and 26 no-additional-finding attestations. The
current detector baseline retains only the two native-platform occurrences;
all unrelated baseline rows are unchanged. The three historical live-test
exceptions preserve the reason for native execution after their registrations
moved under the live harness.

The normal ratchet passes with zero introduced/resolved rows after baseline
reconciliation; its 24.657-second scan does not prove the under-ten-second
performance target. Fallow boundary freshness, generated TypeScript references,
workspace dependency checks and cache audit pass. Full hosted and merged-preview
readiness remain publication gates, not claims made by these package proofs.
