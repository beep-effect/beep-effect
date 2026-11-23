# P3 commit 8 validation

Commit subject: `feat(langextract)!: emit a verified annotation document from the handoff`.
This receipt covers design section 10, row 8, on top of commit 7 (`8d2e63b4f5a`).
No push or GitHub operation was performed. Commits 9 through 11 are outside this receipt.

## Result and approved decisions

The extraction request identifies its source capture. The producer verifies that capture before generation,
starts a content-addressed extraction activity, and returns a checked annotation document, readings and
lossless residual candidates. Targets declare mention or relation semantics. Relation endpoints use the
same evidence-scoped unique alignment policy as the previous semantica reader. IrToLaw reads the checked
handoff; office-action review constructs a versioned capture and carries the handoff through admission.
Semantica and the Lejeune smoke consume the new result while preserving their existing output formats.

Three orchestrator rulings amend details of the design:

- Semantica grounds historical `unmapped-predicate` residuals with its existing endpoint alignment.
  The handoff accepts only the six declared predicate surfaces. Residual anchors survive. Historical
  predicates are never registered as terms. This departs from the letter of section 5.4.
- The deterministic Tika scaffold declares the exported `text-scaffold/1` version on its descriptor and
  on both text and image-metadata results. Its engine name stays `apache-tika`. The Java app and server
  runtime paths were not changed. The package is private, so this change needs no publication changeset.
- Candidates beyond `maxExtractions` enter the handoff through an optional raw `overCap` input. Their
  reason is `over-extraction-cap`, their alignment is `unaligned` (no aligned proof; not attempted), and
  they have no anchor. The reason distinguishes them from failed alignment. Candidate count equals
  parsed count; the alignment work cap, existing diagnostics and IrToLaw error wire stay intact.

Separate decision records explain explicit Digest injection into the pure review factory, acyclic result
and wire-codec leaves, and the shared module-scoped extraction document codec.

## Design row gates

| Gate | Result |
| --- | --- |
| Required `GroundedExtraction` search in IrToLaw and semantica layers | Empty |
| Full package-verify, `@beep/langextract` | Passed: lint, audit and docgen |
| Full package-verify, `@beep/annotation` | Passed: lint, audit and docgen |
| Full package-verify, `@beep/law-practice-use-cases` | Passed: lint, audit and docgen |
| Full package-verify, `@beep/law-practice-server` | Passed: lint 0.8 s, audit 1,301.5 s, docgen 22.6 s; single invocation |
| Full package-verify, `@beep/anthropic` | Passed: lint, audit and docgen |
| Quick package-verify, `@beep/practice-kg-mcp` | Passed |
| Semantica package tests, including frozen hosted batches | Passed: 152 tests in 17 files |
| Offline semantica relation preview | Passed: 10 grounded; byte-for-byte frozen report match |
| Lejeune package tests | Passed: 31 tests in 4 files |
| Server standing and frozen-entities suites | Passed in server unit phase: 298 files, 1,718 passed and one skipped; boundary suite four passed |
| Use-cases standing suites and new office-action flow | Passed: 418 tests in 44 files; five flow tests |
| Langextract tests, including eight P3-H cases | Passed: 110 tests in 7 files |
| Both goal design and operations tsconfig checks | Passed |

The preview report SHA-256 and the committed fixture SHA-256 both equal
`296bcd0d919d49b4ad6b7ef9299b82c763a24fc0489e3245e81ea2691aaa9ae6`.
The replay used offline mode and the existing external provider cache. No corpus material was copied
into the repository. Semantica fixtures remain identical to the commit-1 baseline `525c61bb090`;
server fixtures remain identical to commit 7.

## Additional required checks

| Gate | Result |
| --- | --- |
| Full package-verify, `@beep/tika` | Passed: lint, audit (60 tests) and docgen |
| Quick package-verify, `@beep/semantica` | Passed |
| Quick package-verify, `@beep/lejeune-bolt-workbench` | Passed |
| Changed-file Biome and oxlint (`--quiet --disable-nested-config`) | Passed |
| `beep laws schema-tag-idioms --check` | Passed |
| `lint:schema-first` | Passed |
| `beep lint effect-vitest` | Passed: 661 inherited findings, zero introduced |
| Core touched-package JSDoc checks | Passed for langextract, use-cases, server, anthropic and Tika |
| Lab JSDoc wrapper | Excluded by repository configuration; exits with `No files found` |
| Explicit touched lab-file JSDoc syntax check | Passed with the same rule and only the lab ignore removed in temporary configuration |
| Package docgen | Passed in all full package verifications; direct final use-cases docgen checked 612 examples |
| Lab docgen | Not applicable: neither lab defines a docgen script |
| Langextract, use-cases and server test tsconfigs | Passed by direct compiler checks |
| Semantica and Lejeune canonical check tsconfigs | Passed |
| Langextract and server package-test-typecheck | Passed; actual result artifact had `exitCode: 0` and empty output |
| Schema and instrumentation generated catalogs | Regenerated successfully |
| Decision projection and validation | Passed after final split: 149 decisions, zero invalid records and zero drift |
| Whitespace and frozen-fixture diff checks | Passed |

Node/V8 targeted coverage used `bunx vitest run`, without `--bun`, on Handoff.test.ts and Service.test.ts,
with coverage includes limited to Handoff, Extraction.result.ts and Service.layer.ts. All four measures
are 100 percent: 190/190 statements, 38/38 branches, 42/42 functions and 176/176 lines. Both new source
files are covered completely. No whole-package coverage was run for a large package.

## Failures observed and corrected

- Historical replay predicates initially produced zero grounded relations. The approved consumer fallback
  restored the frozen report without widening the declared vocabulary.
- The capture gate exposed the unversioned deterministic Tika scaffold. The approved pin fixes both
  result paths and is asserted by the Tika tests.
- Node coverage exposed a TestClock race after asynchronous digest work was introduced. Timeout tests
  now wait for model generation to start through a Deferred before advancing the clock.
- The previous cap discarded parsed candidates from the handoff. The raw over-cap residual path preserves
  their text, attributes and confidence and pins parsed count with the existing two-candidate test.
- Initial test, schema-first, effect-vitest, formatting and docgen findings were repaired before the final
  passing gates. No coverage or lint baseline was relaxed.
- A focused server command expanded the package's compound test script into its full suite. That owned
  attempt was stopped; it is not claimed as proof. The server package audit then passed in one invocation with
  a one-hour timeout. It was not duplicated.
- Checking the lab's raw build tsconfig exposed declaration/composite diagnostics; the canonical check
  config passed. No fixture include workaround remains.

Friction receipts are recorded in OPPORTUNITIES.md. Heavy commands ran serially at niceness 19 while
five-minute load was below 128. New schema and instrumentation shards were refreshed; broader inventory
registration remains the later design commit's work.

## Proof limits

These are local deterministic and offline gates. They do not establish live provider behavior, hosted CI,
publication, deployment, or completion of later design commits. The preview preserves the frozen replay;
it does not redefine the declared predicate vocabulary. No source or fixture changes were made for
commits 9 through 11.
