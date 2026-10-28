# Retention mechanism verification

## Requirement-to-evidence map

| Requirement | Owning implementation | Executable evidence |
| --- | --- | --- |
| Standalone tier and pressure report | domain Retention contracts; use-case generate/render/encode operations; server CLI | Retention unit suite and migrated-database report drill |
| Both as-of axes | reader SQL half-open predicates; generator defense in depth | early/later known-time answers, before valid-time start, exact transaction upper bound |
| Disposition views and groups | endpoint disposition selection by `(resolvedAt, id)` at knownAt | active/rejected history, future/foreign-tenant disposition exclusion, filter and summary assertions |
| Policy schemas and calibration gate | RetentionPolicy; discriminated RetentionPolicyAdmission; deployment-owned registry port | unordered/non-finite/nonpositive policy rejection; synthetic/wrong-policy/wrong-org/future/expired receipt rejection; missing receipt inert |
| Complete delete/rebuild identity | server rebuildRetentionStore | full directory removal including extra cache; byte equality for JSON and text; report answer equality at two coordinates |
| Authority unchanged | SELECT-only read-only repeatable-read adapter | all edge and disposition rows compared before and after the drill |
| Repo-native implementation | P0 provenance inventory and source review | no donor imports, copied constants, authority migrations, operator memory, or fusion arithmetic |

The eleven use-case reporting tests, three domain tests, dedicated server authority
rebuild property and ten core-authority integration tests pass in their owning
packages (25 focused tests in total). The new rebuild drill runs against migrated embedded
Postgres through the real authority repository and the new Drizzle reader/store.
The report and rebuild properties generate ordered candidate policies constructively
from the policy schema's positive-number field, including shrink-safe minimal windows.
The database authority is seeded once and remains read-only across property cases.
This is fixture proof; no production database was read or changed.

Full package verification (`bun run beep quality package-verify <package>`) is
required for each of `@beep/epistemic-domain`, `@beep/epistemic-use-cases`, and
`@beep/epistemic-server`, including audit and documentation generation. Initial
quick checks were followed by full checks; they are not substitutes for them.
The standalone script has a tracked `scripts/tsconfig.json` and a separate
typecheck because the package's source and test configurations do not include
scripts. Native deprecated-API audits cover it and the test helper under
`test/helpers`; both packages report zero unmatched TypeScript files. Its no-argument runtime path
returns usage guidance before database configuration or connection acquisition.
A live production CLI connection is not part of the synthetic drill.

## Determinism and boundary review

Canonical encoding reuses the existing repo encoder. Requested keys and filters,
report rows and disposition tie-breaking have explicit ordering. No clock,
random identifier, generated-at stamp or store path enters output. Text and JSON
are independent of directory enumeration order. Snapshot reads are scoped by
organization and explicit keys; report filters never become authority writes.
Candidate policy data is present for inspection, but only the calibrated union
case can carry active policy and receipt data. The shipped CLI always composes
the inert registry. Synthetic receipts are never admitted by the gate.

Each generated report is transaction-consistent. Byte identity across rebuilds
requires unchanged authority/configuration. Store directories have one writer;
JSON is the commit artifact, text is derived, and an interrupted write is repaired
by rebuilding. This goal adds no cross-process store coordinator or production
calibration registry.

## Publication gate

Local package checks and fixture results do not prove publication or completion.
Yeet publication, exact-head final-check, hosted checks, review resolution and
review-window readiness remain required. Packet closure is proposed in the same
PR as the implementation and reflection; the conversation goal remains active
until its full completion audit succeeds.

## Resource judgment review

The authoritative Effect-test detector reports no findings for the use-case
Retention.test.ts; domain tests separately cover policy identity, admission shape
and canonical UTF-8 measurement.
The rebuild property has two documented judgment exceptions in
`standards/effect-vitest.inventory.jsonc`: EV004 is the shorter artifact lifetime
that closes before the final authority reread, and EV010 is the native filesystem
which is the chosen projection-store subject. Neither is an assertion migration
or a policy waiver. Platform services are provided at the `it.layer` boundary;
the database is seeded once and is read-only throughout generated rebuild cases.

## Publication fallback

The local Yeet pre-push run exceeded ten minutes. Its documentation regeneration
passed after approximately 392 seconds. Schema-first, Effect test usage, aliases,
span catalogs, reflection, and the other completed policy lanes passed. The only
introduced dead-code/audit finding was the manually invoked report script; it is
now declared as an entry point in `.fallowrc.jsonc`. The native CLI remains part
of the product mechanism, not a dead file or an ignored source path.

Per the standing constrained-compute rule, publication proceeds to hosted CI
after the targeted Fallow checks. The local Fallow health scan was unfinished
when this chat's run was stopped. Hosted checks, exact-head final-check with
explicitly recorded local skips where needed, review resolution and the review
window still gate completion. No other session's job was stopped.

## Command runtime proof and verification repairs

The actual command succeeds for an empty scoped query with a deliberately
unreachable synthetic Postgres URI, writes both files, and reports an inert
policy with zero rows and bytes. This proves the empty scope avoids SQL access.
The same command with a nonempty key fails with `RetentionUnavailable`; hashes
of both prior artifacts remain unchanged. This is bounded command/runtime
evidence, not a production connection or accepted-edge CLI deployment claim.
The migrated-database property supplies accepted-edge reader/store proof.

Local final-check identified an unwrapped transaction callback and two
TypeScript ownership gaps. The callback now uses `Effect.fnUntraced`; the helper
lives in `test/helpers`, and the script has its native program configuration.
Targeted laws and deprecated-API audits pass, the command configuration
typechecks, and full server/use-case audits and docgen pass again. No quality
baseline or authority behavior changed.

## Landing closeout

[PR #2322](https://github.com/beep-effect/beep-effect/pull/2322) carries the
implementation and retained packet state together. The retained status is the
proposed state at merge, not an assertion that an open draft has already shipped.
The conversation goal stays active until current-head required checks, answered
reviews, review window, merge and lane retirement are verified.

Hosted Fallow caught two file-local helper values still exported after the
helper move. Removing only those exports restored a zero-finding local audit;
full use-case audit/docgen passed again. Hosted health passed. Cancelled unit
shards and their dependent coverage summaries on superseded heads are not
measured coverage regressions.

The base advanced during verification. The only conflicts were generated root
TypeScript and Vitest aliases, regenerated with `beep tsconfig-sync`; frozen
dependency installation passed. An independently published merge of the same
base had a byte-identical tree and its ancestry is preserved.

The standing constrained-compute fallback (after the original pre-push exceeded
ten minutes) also parks the full local lint-policy replay. Targeted laws, native
deprecated-API ownership audits, script typecheck, schema/test gates and package
audits passed; exact-head hosted Lint Policy remains required. The full repository docgen replay was interrupted for history repair; full
package audits/docgen passed for all three touched packages. The `cheap-gates`,
`lint-policy`, `docgen` and `coverage` local skips must be explicit in the final-check receipt and PR
body. No baseline is weakened.

## Preserved history and replacement PR

[PR #2322](https://github.com/beep-effect/beep-effect/pull/2322) supersedes
[PR #2321](https://github.com/beep-effect/beep-effect/pull/2321). A separately
published merge on the original branch used a commit type rejected by Commitlint.
Yeet's inherited-red exception applies to main, so it does not cover that branch
commit. Rather than rewrite published history or relax the check, the original
branch and PR are preserved and the same feature diff is committed conventionally
on current main. The epistemic package trees are byte-identical across this
transfer; only closeout links/evidence change afterward. The replacement PR must
satisfy all current-head required hosted checks and the normal review window.

## Bounded full-repository coverage replay

The final-check replay passed lint, repository sanity, type checking and Fallow
(including health). Nine of ten coverage shards passed, including the shards
containing epistemic domain, use cases and server. The repository CLI shard was
still running at ten minutes and was stopped under the standing compute rule.
Its result is parked, not claimed green or attributed as a source failure.
The final receipt records an explicit `coverage` skip alongside the other local
skips; current-head hosted Test Unit and Coverage Regression remain required.
No coverage baseline is changed.
