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
