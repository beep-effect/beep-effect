# Main integration and hosted failure repair

The resumed branch was a343c95a88949a3e8582edc4c2f67f102d388e5c, five main
commits behind. Main through 405727310e was merged in 30acb824f6. Four test
conflicts were resolved: equivalent Git W7 bindings use main's names; claim
input retains the schema-based property test with main's fcRuns policy; the
CI-security test retains both the branch permission-ceiling assertion and
main's dependency-diagnostic checks. All 27 Git W7, 14 claim-input and 50
CI-security tests pass after resolution. Normal merge hooks pass.

## Actual hosted failures

Run 41708733664 failed on the prior journal head:

- Heavy / Check, job 126240315308: three yieldInCallArgument errors in the
  retained CI-security permission test. Reads/diagnostics are now bound before
  parsing/assertion calls. The exact retained permission test passes again.
- Test Unit (unit-d), job 126240315188: CitationRegexProgram.test.ts still
  expected (?=x) to be unsupported. The test now verifies the accepted zero-width
  structural lookahead; other unsupported cases still reject. Independent source
  profiles and actual-worker lookahead tests remain the semantic proof.
- Heavy / Lint Policy, job 126240314087: eleven fixture fields used S.Literal
  where the single-field policy requires S.tag. They now use S.tag without
  changing corpus values. The exact schema-tag check reports zero findings.
- The same policy job's deprecated-import lane failed on one warning. Replaying
  that exact lint rule isolated extractor-recipes.json: its 2332900 bytes exceeded
  Biome's existing 1 MiB input ceiling. There was no deprecated source import.
- Heavy / Coverage Regression, job 126240317285, stopped at its UNIT_RESULT
  success prerequisite because that result was failure. It did not execute a
  coverage comparison on that attempt. This is not evidence of coverage success
  or a measured coverage regression; a fresh hosted comparison is still needed.

The aggregate unit result follows its failing shard. New main also supplies the
separately owned inherited coverage/policy fixes from #2682. Full latest-head
hosted results remain authoritative and pending after publication.

## Lossless fixture compaction

Extractor recipe corpus v2 stores all 2533 edition references once, 6409 distinct
constructor-extra value tuples, and all 6805 ordered pattern/extra-index rows.
Class names, flags, exact/variation occurrence order, duplicates and short flags
remain explicit. Source ordinal remains recipe id. The producer reconstructs
all expanded rows and asserts equality with its original observations before
writing. A separate comparison against the prior committed corpus also proves
all expanded rows, edition references and counts are identical.

The shared test decoder schema checks table lengths and every index before
lookup, then expands each recipe into fresh arrays. Production recipe schemas,
registry behavior, default catalog identity and resource policies are unchanged.
The formatted fixture is 1009544 bytes, below the existing 1048576-byte ceiling.
No formatter/linter exclusion or size override was added.

The exact canonical tokenizer oracle was rerun using its existing explicitly
captured edition-hash profile. All seventeen cases and all edition observations
remain identical; only inputs.extractor-recipes.json changes. No fresh-process
hashing qualification is inferred. Both recipe and canonical producers regenerate
byte-identically with PYTHONHASHSEED=0.

New recipe producer SHA-256:
`b618fceabb7bac1bfa23e0c0429359a697f274ba1ad393a5dc68eff096221324`.
New extractor-recipes.json SHA-256:
`5b7438f1026b059bbe4ab76fd8cfec624de64e0e4c0561fa87d51a0a4ad159ca`.
Regenerated catalog fixture SHA-256:
`7f624597ee68176326cd8252a9858acd48faa7be27f1dc3e986119140a4080f3`.

## Focused verification

In addition to the merge tests, 27 citation tests in six files pass for the
reported assertion and fixture changes. Twelve recipe/compiler tests in two
files pass. The canonical catalog test authenticates all 6805 recipes and 2533
editions, compares a real citation, and confirms eleven actual child exits.
The retained permission test passes after its syntax repair. Scoped server
lint/type checks, scoped Oxlint, exact deprecated-import lint over the repository,
schema-tag checking and new-only Fallow pass with zero introduced findings.
Normal commit/push hooks run. Broad local aggregate verification and the CLI's
complete type-check replay remain deferred under the operator's hosted-CI
instruction; the three reported sites are repaired, with full hosted proof still
pending. No quality floor, scope, semantic waiver or CI workflow was changed.

Case metadata, corrected rendering, public engine/Layer and exhaustive source,
safety, coverage and lifecycle acceptance remain open. This repair wave does not
complete the citation engine goal.
