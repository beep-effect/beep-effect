# Codegen-kit resource preparation

The next saved dependency component after schema is @beep/codegen-kit (wave 5).
Work begins in the isolated effect-vitest-wave-d-codegen sibling branch from
schema publication 53aed542ea72b0d525424328faeab8ccc5cb7847. This is
preparation while prerequisite PRs remain open, not merge authorization.

All eight withTempDirectory call sites now acquire makeTempDirectoryScoped
inside the existing scoped Effect test. The higher-order acquireUseRelease
wrapper is removed. Directory placement and prefix are unchanged, keeping the
real formatter and diff subprocesses able to access their native input files.
Each test still receives a unique directory; no mutable directory is shared.
The two existing shared platform/service layers have explicit ten-second hook
budgets. No failing test was retried or given a longer body timeout.

All 82 expect assertion expressions are identical after whitespace normalization
against the parent source. This includes cache preservation on pin mismatch,
generated output, warning capture, and unified diff assertions. Native formatter
and diff execution remain intact; MemoryFileSystem cannot substitute for files
opened by those real child processes. Source-pin-only subcases still require
separate filesystem disposition during the resource-lens closeout.

Full package audit (9.0 seconds) and docgen (3.0 seconds) pass. Node and Bun
package test runs both pass. Instrumented runner adoption, stage annotations,
filesystem disposition, ledger fix references, timing and hosted proof remain
outstanding. No finding is marked fixed from this uncommitted preparation.

## Runner instrumentation and native boundary review

The public instrumented it.layer now owns both suites, with @beep/test-runner
added as a development dependency and package references/boundaries regenerated.
Thirteen nonsecret stage logs precede refresh/cache formatting, generation and
write/check work. These logs use Effect logging; existing TestConsole warning
and unified-diff assertions are unchanged.

Source review confirms that refreshJson invokes formatter.file(cachePath) after
writing the cache. Thus the source-pin refresh tests also require a real file
visible to the formatter subprocess; moving them to MemoryFileSystem would stop
exercising that production path. Pure generation cases allocate no test files,
so no separate fake volume is introduced merely to satisfy the scanner.

All 17 tests pass under Node and Bun with BEEP_TEST_TRACE=1. Full package audit
(7.8 seconds) and docgen (2.9 seconds) pass. The cache projection changes only
dependency edges on eight codegen-kit task nodes; all commands, configuration,
other nodes, profile, scope and epoch remain unchanged.

The earlier resource receipt's filesystem/runner review items are resolved by
this evidence. Final inventory dispositions, timings, publication and hosted
proof remain outstanding; this work is not yet committed.

## Detector and timing preparation

The fresh detector emission contains only EV010 for NodeServices. The codegen
baseline shrinks from 12 rows to this one reasoned native-filesystem exception.
All other package baseline entries retain their values and serialized row text.
The saved resource-lens native-formatter finding carries the same boundary
reason; repaired findings stay open until an implementation commit exists.

The configured Node JSON reporter run passes all 17 tests in one file. Whole
command time is 4.114 seconds, reporter span 3,390.00 ms, against historical
reporter span 4,165.50 ms under an older runtime. Source hashes stayed stable.
The context records load, process limits and CPU/memory/I/O pressure; maximum
I/O avg10 was 19.21 during this sample. No causal speedup or load-adjusted result
is claimed. Coverage and hosted proof are separate obligations.
