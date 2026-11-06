# Representation laws and fidelity question ledger

The required `divergences.json` artifact and independent checker now exist.
The ledger records eleven representation laws and four fidelity questions.
Every row remains in audit. No target test, semantic waiver, completed proof
or zero-difference result is claimed by this checkpoint.

## Accounting contract

`ops/divergence-plan.json` separately fixes rule IDs, statements, source paths,
question IDs, blockers, observation IDs and required focused test identities.
`ops/export-divergences.py` binds those declarations to current source bytes
and supplemental payload digests. Generation always starts rows in audit;
it does not transfer completion claims across changed evidence.

Two generations and the committed fixture were byte-identical: 11,991 bytes,
SHA-256 `f89c16192ba2b866b166b759448015b6a3e3e3f25439dec344f026000136e291`.
The artifact includes the official commit/tree/license, plan and producer
hashes, and the complete supplemental file hash. The decoder and focused-proof
receipt schema export only from `@beep/law-practice-use-cases/test`.

The eleven representation laws cover:

- Python code-point to UTF-16 conversion with exact source slices.
- Edition-candidate bag ordering with multiplicity and decisions preserved.
- Exact decimal wrappers for large integers.
- ISO datetime representation with date components preserved.
- Unordered collection canonicalization without dropping members.
- Immutable content-addressed artifacts without memoizing mutable resources.
- Source-bound callable descriptors in oracle evidence.
- Python class to semantic tag mapping without legal field/behavior loss.
- Explicit document ownership and relations in place of cycles.
- Test-local object identities with identity relations/hash integers preserved.
- Public vocabulary identities with frozen parser semantics preserved.

These statements describe evidence formats and required target equivalence.
Their existence does not authorize dropping fields, ignoring a stage mismatch
or changing legal meaning. Final target comparison still must classify every
difference under a proved applicable rule. It cannot infer zero unexplained
differences from this catalog alone.

The four questions bind to exact supplemental observations: repeated-source
selection, a deleted occurrence collapsing to a point, zero-width annotation
insertion, and warning arguments containing source text. They remain blockers
to their own completion. No architecture interpretation or redaction strategy
is treated as a proved answer yet.

## Completion and proof boundaries

The schema has separate audit and complete variants. An audit law requires
null proof; a complete law requires a focused test and receipt. An audit
question requires its exact blocker. A complete question must declare either
separate operation contracts or preservation of observable behavior, with
rationale and proof. There is no semantic-waiver resolution. The required
`semanticWaivers` tuple must remain empty.

Each row pins a future server test path/name. The planned tests do not yet
exist. A proof for another test is rejected even if that test passed. Completed
rows must bind the current test bytes, the plan, subject ID, evidence files,
runner version and a passed receipt produced by the fixed future
`ops/run-divergence-proof.ts` entrypoint. That producer is also not implemented
in this checkpoint. These are reserved proof contracts, not execution evidence.
Their completed execution paths still require implementation and positive
validation when the target tests land.

The checker never executes commands supplied by evidence. File references are
resolved through the Effect filesystem/path services and checked after realpath
resolution, including repository containment. Tests and receipt paths have
additional scope restrictions. Source hashes and a named test string establish
reference integrity; the independent final target verifier remains required
for actual comparisons and coverage.

## Portable integration and checks

`check-divergences.ts --audit` validates the plan's exact projections, globally
unique IDs, unchanged statements/blockers, source files and hashes, required
test identities, and observation ownership/payload hashes. Default mode rejects
the fifteen current unfinished rows. Existing evidence references remain
source-bound; cataloging a row does not approve its normalization for the
unimplemented target engine.

The package audit now runs nine components. Its default mode requires divergence
completion alongside the canonical, donor and supplemental gates. The regex
benchmark and full target verifier entrypoints remain absent. The historical
warning/P0 audit's statement that the divergence artifact was absent is
superseded by this note; P0 remains open for its other missing artifacts.

The audit baseline and default rejection passed. Thirty-seven corruption
controls rejected missing/duplicate rules and questions, ID collisions,
unplanned statements/references, stale hashes, invalid states/proofs, missing
blockers and observations, semantic-waiver attempts, wrong pins/licenses and
changed planned tests. Both actual package audit baselines and fourteen
package-command rejection controls passed. Package audit/docgen and the
standalone command's strict TypeScript/Effect check passed. Formatting,
Markdown, manifest/packet and diff checks cover this local checkpoint.

Supporting logs are under
`/home/elpresidank/.cache/beep/citation-extraction-engine/`:
`divergence-check.log`, `divergence-controls.log`,
`divergence-parity-controls.log`, `divergence-package-verify.log`,
`divergence-typecheck.log`, `divergence-markdown.log` and
`divergence-goals-doctor.log`.
