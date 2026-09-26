# HTML resource preparation

The isolated HTML worktree starts from main at 5201b02fe5. All 18 test/support
files match the previously reviewed frozen inventory source; no full recensus
was used to replace the existing work queue.

Before edits, the Node suite passed 193 tests with no failures or skips. The
observed command took 8.67s with stable source hashes; private evidence retains
runtime versions, resource limits, load and pressure. This is an observational
baseline, not a causal benchmark.

Both browser-import and entrypoint import tests now acquire their real child in
the existing Effect test scope. Stderr draining starts at acquisition. Cleanup
terminates a still-running unsignalled child and awaits process exit and stderr
settlement. The original process.execPath, cwd, import scripts, SharedArrayBuffer
deletion and exact zero-exit/empty-stderr assertions are retained. No runtime,
filesystem subject or timeout was replaced.

The initial check rejected an async cleanup function under the Effect language
service rule; cleanup now returns its promise from Effect.promise without an
async function. Full corrected package verification passed: audit 17.5s and
docgen 13.6s. This is a resource-stage checkpoint. Direct interruption controls,
remaining property/observability lenses, detector migration and final timing
and publication remain; inventory statuses have not been prematurely closed.

## Interruption controls and property witnesses

Both real acquisition/release expressions passed independent interruption probes.
Each probe substituted a held native child for the import script, waited for an
acquisition barrier, interrupted the owning scope, and asserted SIGKILL plus
completed stderr draining before interruption returned. Replacing the release
with Effect.void failed each corresponding negative control. An independent
finally block killed and awaited the negative-control child. Both original
source files remained byte-identical; temporary probe files were removed.
These controls prove cleanup; the unchanged package tests prove import behavior.
Private evidence: html-interruption-receipt.json and its four per-case logs.

The proof-provenance test now explicitly asserts the issued fragment tag before
its existing narrowed child-freeze checks. Every mutation and serialized-byte
assertion is retained. The source-size determinism law adds equality derived
from the production SourceSizeAnalysis and SourceSizeIssue schemas over the
complete Result, retaining the branch and first-code checks, maximum string
length 256, and fcRuns(250). This includes both success fields and the complete
ordered failure array with every code, entryIndex, and message.

Full package verification after these edits passed: audit 16.4s and docgen
13.9s (html-property-package-001.log). Resource exception review, observability,
detector migration, final timing and publication remain. This is a checkpoint,
not package-wave completion or a goal acceptance claim.

## Native boundaries and runner adoption

The remaining resource findings retain their intentional subjects. The ledger
suite validates actual package artifacts through validateConformanceLedgerArtifacts;
the annotation suite compares the selected production proof annotations with
those artifacts. The jsdom suite uses disconnected DOM elements, innerHTML and
namespace observations as an independent emulator parser oracle. Replacing these
with memory filesystem fixtures or production predicates would remove the
integrity/independence claims. This is not real-browser execution evidence.

All 18 test suites now import it from the public @beep/test-runner entrypoint.
Plain describe/expect imports remain on @effect/vitest. The two child tests have
spawn, import, exit, drain and cleanup spans with constant names and no captured
environment values. Their scopes, TestEnv, original process arguments and final
zero-exit/empty-stderr assertions are preserved. Dependency installation changed
only the HTML lockfile workspace entry; filtered tsconfig-sync generated the two
HTML reference updates.

Full package verification passed (html-runner-package-001.log): audit 18.2s,
docgen 13.8s. Temporary probes in both native child tests observed the runner's
start diagnostic through TestConsole.logLines with BEEP_TEST_TRACE=1. With
BEEP_TEST_TRACE=0 and CI=false, both otherwise identical trace assertions failed.
The original source bytes were restored in finally. Private evidence is
html-trace-receipt.json and html-trace-{positive,negative}.log. Detector migration,
ledger reconciliation, cache metadata, final timing and publication remain.

## Canonical property declarations

Migrated all 19 native Arbitrary.checkEffect wrappers in the eight affected
suites to it.prop or it.effect.prop. The installed/reference public API accepts
the same native Arbitrary values and CheckOptions under the arbitrary option.
Every original fcRuns setting (25, 50, 100, 250 and 500) is retained, with no
new filtering, reduced domains or seed override. Inline language-tag and URL
arbitraries preserve their original construction. The input/button laws now
have separate property declarations, and the URL representative examples and
invalid enumerated keywords retain separate explicit tests. This adds three
test declarations without dropping assertions.

Canonical TypeScript AST printing confirmed every property callback unchanged
apart from formatting. Private receipts: html-property-callback-parity.json and
html-property-run-floor-parity.json. The preliminary scanner-based comparison
misread template literal tails as trivia-bearing tokens; the AST printer check
resolved that diagnostic issue without changing callbacks.

The final package verification passed: audit 16.8s and docgen 14.1s, recorded in
html-properties-package-002.log. The remaining ordinary Effect runtime-boundary
and specialized-assertion detector findings are still queued; no baseline rows
have been removed merely because this property subset passes.

## Effect runtime boundaries

Converted 47 ordinary tests across six suites to it.effect and yielded their
existing Effect operations. Removed five synchronous wrappers by yielding the
underlying conformance, safe-policy or serialization operations at each call
site. No runSync/runPromise calls remain in the HTML test directory. Existing
failure checks inspect yielded Effect.exit values, keeping failures distinct
from successful payloads. The facade no-throw witness now yields its decode;
any failure or defect still fails that test.

A syntax-tree comparison preserved all runtime literal values and assertion
matcher counts in the six touched files, with the one intentional replacement
of expect(...).not.toThrow() by a successful yield. The private receipt is
html-runtime-parity.json. Native DOM parsing and serialized-byte witnesses stay
in place, including proof forgery checks and deep-freeze mutations.

Moving the forgery test into Effect.gen exposed native JSON calls to the Effect
language-service rule. The round trip now uses S.fromJsonString(S.Unknown),
encodeEffect and the typed decodeEffect; it still requires exact empty-object
JSON and rejects the reconstructed proof. The reference-only alias and an
unnecessarily unknown decoder were corrected without suppressing diagnostics.

Final full package verification passed: audit 18.1s and docgen 14.8s
(html-runtime-package-004.log). Specialized assertions, detector/ledger
reconciliation, final timing and publication remain queued.

## Assertion helpers and human-ledger reconciliation

Replaced eight None checks with assertNone and four pre-existing exact success
expectations with assertSuccess. Five Option payload equality checks now use
assertSome. Branch-only and compound Boolean assertions use the public
assertTrue helper with the full original predicate; the determinism branch
comparison uses strictEqual. No expected error payload or Cause was invented.
Input expressions, predicate polarity and existing message arguments in those
Boolean migrations were preserved. Private per-row evidence is retained in
html-assertion-migration-receipt.json.

The detector deliberately continues to report branch-only helper assertions as
review candidates: the intermediate scan reported 114 EV006 rows after the
helper substitutions. These are not automatically closed or removed from the
baseline. It would be incorrect to describe helper spelling changes as completed
structural-payload review. Detector reconciliation remains a separate next step.

The final full package proof passed: audit 33.7s and docgen 26.8s
(html-assertions-package-004.log). Initial proof caught an import placed above
the jsdom/DOM directives and a missed pipeable expression; both were corrected.
The jsdom environment and DOM reference remain at the top of that file.

All nine substantive human-lens findings now have dispositions: six fixed with
commit references and three reasoned native-boundary exceptions. The 63
no-findings rows remain intact. Existing row IDs are retained; source spans and
finding evidence were refreshed against the migrated files because several
original endLine values exceeded their shorter files. A historical-byte census
cannot validate a current checkout, so validation uses actual current byte and
line counts. The strict four-lens validator reports valid=true, complete=true,
missing=0 for 72 rows covering the same 18 existing files (private result
inventory-wrcfusd0/result.json). This is package lens coverage, not accepted P1
inventory, an empty detector baseline, or goal completion.

## Current-main snapshot refresh

Merged main fb5b01146f into the HTML branch at 14d4c0cc5d. The five conflicts
were import blocks: retain instrumented it and assertion helpers, adopt the new
effect/Arbitrary path, and keep the prior removal of unused Effect imports.
The installed Effect packages now use the 330b7475e2 snapshot from main.
Full package proof passed on this merge: audit 34.1s and docgen 15.2s
(html-main-refresh-package-001.log). The four human lenses revalidate against
current file bytes/lines: valid=true, complete=true, missing=0. The post-merge
syntax scan reports 113 EV006 rows; the remaining branch-only review and its
historical receipts are not closed merely because pipe syntax changes whether
a particular assertion is discovered.

During this refresh, PR #1277's import conflict was resolved and pushed at
38c00919ba, with package proof audit 19.5s/docgen 3.1s. Its SQLite interruption
review thread was answered and resolved after narrowing the PR body to distinguish
the committed bundle test from temporary SQLite controls. PRs #1273 and #1274
were confirmed MERGED and their lanes retired through Yeet. Hosted readiness
for #1277 remains separate; its OIP preview build failure and exhausted retry
quota are recorded in the opportunity ledger.

## Reviewed success outcomes

Fifteen success-only Effect checks now yield their original operation directly.
The Effect tester requires success and preserves typed failures/defects as test
failures; no synthetic payload, error or Cause is introduced. The private
html-success-yields-receipt.json records each before/after operation.

Three compound Result checks had independent expected fields already present:
UTF-8 charset, anonymous/strict-origin link metadata, and on/true global
attributes. They now assertSuccess over projections of exactly those fields,
retaining all existing values and both fields of each compound check. This is a
structural assertion of the supplied expectations, not an invented whole-object
oracle or a reduced single-field check.

Full package verification passed: audit 20.5s, docgen 17.1s
(html-outcome-package-001.log). A fresh syntax scan reports 95 EV006 candidates,
down from 113. Remaining branch-only candidates are still open and are not
waived by this checkpoint. The existing human-lens spans were refreshed and the
strict validator again reports valid=true, complete=true, missing=0 for all
72 rows and 18 files.

## Structural outcome assertions and timing checkpoint

The source-size error check now uses assertFailure over its existing first-issue
schema guard and diagnostic code. Its pass/fail contract is unchanged. Three
other assertions are deliberate strengthening: ASCII K decodes to canonical k,
case-sensitive ID references retain First first, and every generated element
metadata value survives encode/decode unchanged. The metadata assertion composes
the two Results, so either operation failing still fails the test. No expected
SchemaError, Cause or full diagnostic array was inferred from observed output.

Full package proof passed (audit 17.4s, docgen 17.2s). The syntax scan now reports
90 EV006 candidates, down from 95 before this batch. Remaining branch-only
contracts are open; this is not an empty-baseline or package-closeout claim.
The four human lenses revalidate against the changed file bytes and spans.

Node timing before this wave: 193 passed, zero failed/pending, 8.675s.
After these changes: Node 196 passed, zero failed/pending, 10.605s; Bun 196
passed, zero failed/pending, 4.492s. Three prior test declaration splits account
for the count increase. Each invocation had stable source/manifest/lock hashes.
The committed context receipts include runtime versions, load, pressure and
limits. Main moved and workstation load differed, so these measurements do not
isolate migration cost or establish a performance regression or improvement.
No paired pre-wave Bun timing is claimed.

The reviewed cache census changes exactly ten HTML task dependency lists for
its development-only test-runner dependency. Commands, configuration, cache
eligibility and unrelated baseline nodes are identical. Fallow regeneration adds
only HTML's runtime/type boundary allowance for that declared test dependency.

## Typed conformance-failure checkpoint

Eighteen conformance rejection tests now assertExitFailure over Exit.mapError's
projection of the documented HtmlConformanceError tag, with Cause.fail of that
literal tag as the independent expectation. This deliberately strengthens the
old any-failure contract: a defect, interruption or unrelated error no longer
satisfies the rejection test. Existing inspector assertions remain intact. The
installed Exit.mapError contract explicitly preserves defect/interruption
causes, and conform documents its typed HtmlConformanceError failure. No full
issue arrays, messages or expected values are sampled from production output.

The source-size helpers now project their existing usesAuto/positive-entry-count
and first-issue-code expectations into canonical Result assertions. Every
expectInvalid call already supplied its code, so its parameter is now required.
The policy acceptance loop yields the effect directly; only its rejection loop
captures an Exit. MIME acceptance now also asserts the exact branded
application/json value. The initial unbranded expected literal failed test
typecheck; constructing the fixed expectation with HtmlMimeType.make corrected
that type error without a cast.

Full package verification passed: audit 18.8s and docgen 16.0s. The detector scan
reports 70 remaining EV006 candidates, down from 90. The human lenses validate
against current bytes and spans: valid=true, complete=true, missing=0. The
checkout inbox has no unacknowledged rows. Remaining detector rows and their
historical reconciliation remain open; this checkpoint does not claim final
empty-baseline acceptance.

Fresh timing on this source checkpoint: Node 196 passed in 7.901s; Bun 196
passed in 3.362s, both zero failed/pending with stable input hashes. The current
after timing/context artifacts supersede the previous checkpoint measurements;
those earlier values remain historical observations above. Runtime, load and
pressure are retained, and no isolated performance effect is claimed.

## HTML detector-zero checkpoint

Source commit 9de811f2b4 completes the remaining outcome assertions. Schema,
conformance, serialization, script-type and safe-policy rejections now check
explicit documented error tags through canonical Result/Exit helpers. Successful
codec checks assert fixed canonical attribute values, preserve custom command
spelling/presence values, or compare decoded documents with independently
constructed fixtures. Existing inspection and byte-output assertions remain.
These are deliberate contract strengthenings, not claims that branch-only
predicates originally specified all these values.

The complete syntax scan examined 1,179 files and reported 7,855 findings, none
for HTML. This package milestone does not imply an empty repository baseline.
Full HTML package verification passed: audit 18.1s, docgen 14.7s. Node and Bun each
passed all 196 tests with zero failed/pending, in 8.270s and 3.093s respectively;
inputs were stable within both runs. The current after receipts bind this source
checkpoint and preserve workstation context without causal speed claims.

Baseline reconciliation exposed identity drift since the frozen inventory:
177 frozen detector rows versus 181 current-main baseline rows, with 85 identical
ids. The union contains 273 historical identities, all now fixed at 9de811f2b4;
this is not a claim of 273 distinct original defects. All 181 HTML baseline rows
were removed after the fresh zero scan. Every unrelated baseline entry is kept
byte-for-byte. Human-lens validation remains valid=true, complete=true, missing=0.
Publication and hosted proof remain outstanding.
