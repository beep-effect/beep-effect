# Frozen grants and lab deletion preparation

Two private drafts cover existing inventory while the previous grouped package
proof runs. No package source is changed and no findings are closed.

Frozen-grant tests contain ten runtime boundaries and ten terminal cwd uses.
The draft replaces the local cwd wrapper with the shared scoped constructor
and moves platform/TSMorph provisioning into a serial public fixture. It
preserves Effect.orDie and every existing assertion. The old local acquisition
changes cwd before its outer release is registered; the shared constructor
registers directory cleanup before that operation.

Lab deletion tests contain ten runtime boundaries: six ordinary temporary
roots and four cwd fixtures for commands. The draft gives these resources
per-test scope ownership, retains visible cleanup failures, and uses a public
serial command fixture. The fixture drops its shared console layer; all ten
Effect callbacks receive fresh consoles, preserving the four command tests'
log/error assertions. Plain synchronous cases remain plain.

The unchanged baseline passes 32 tests on both runtimes, with stable source
hashes and zero temporary residue. Whole-command observations are Node 6.825
seconds and Bun 3.269 seconds. Load/pressure and runtime receipts are retained;
the concurrent package proof prevents controlled performance claims.

Draft comparison preserves all 87 assertion trees (34 frozen-grant, 53 labs)
with zero exclusions. Historical runtime line/evidence/title matching locates
ten rows per file uniquely, with no absent or duplicate matches. Resource
wrapper findings require separate occurrence/evidence reconciliation.

Before application, complete the transitive native clock audit. Then apply
hash-guarded drafts, check actual diagnostics and ratchet, run both runtimes,
and verify resource cleanup, cwd restoration and fresh-console behavior in the
actual suites. Draft evidence does not count as completed migration proof.

## Clock and service audit

Frozen-grant calls runLawScan, which resolves the current cwd through
TSMorphService.inspectProject and inspects a syntax project. Service root
resolution occurs per request; project/symbol caches are keyed by repository
root rather than capturing the fixture-construction cwd. Each case owns a
fresh temporary root. This supports a serial shared service fixture while
preserving independent filesystem subjects.

The six non-command labs callbacks perform changeset filesystem writes or
registration inspection. All four command callbacks pass --dry-run. The
handler constructs the plan and policy, then returns before runApplyMode,
lockfile refresh and subprocess baseline writers. No Effect clock delays or
retry loops were found in these exercised scan/inspection paths. The draft
therefore retains the default test clock; it does not add live clocks merely
because native filesystem services are present. Actual post-application tests
remain required to validate this static analysis.

The preview removes 20 EV001 and four EV003 findings, introduces none, and
retains both EV010 native-platform reviews. Runtime and wrapper lineage must
be reconciled against applied source rather than this draft.

## Prepared actual-suite controls

Private builders now produce failure and interruption injections immediately
after all 20 resource acquisitions, plus fresh-console checks for ten callbacks
per file. Each probe also checks process cwd after every test; each subprocess
uses an isolated temporary root checked for leftover files. The harness guards
against unapplied source and restores bytes in finally. Builders pass draft
cardinality checks; the probes have not executed against applied suites.
Chained pipes were flattened in the private draft before application, preserving
all 87 assertion trees. Applied timing, assertion, detector and historical
lineage scripts are ready for the next source window.

## Applied status

The drafts were applied and verified in source commit db2d065683. Actual suite
and resource evidence is recorded in cli-frozen-labs-runtime-proof.md, including
full package-proof status. No new live-clock overrides were needed.
