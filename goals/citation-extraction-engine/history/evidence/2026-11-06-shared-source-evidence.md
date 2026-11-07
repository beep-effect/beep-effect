# Shared canonical source evidence for annotation integration

SourceEvidence now owns the existing canonical SourceTextResolver and provenance
verification path once, without extraction options or the eyecite shortcut.
SourceRequest reuses it for existing single/paired extraction preparation.
The annotation operation can install the same helper with its selected operation
reference, retaining genuine prerequisite proofs rather than minting structural
lookalikes or duplicating hashing/verification logic.

The helper snapshots request identity/text before asynchronous resolution,
preflights caller and resolver text against the effective source ceiling,
independently verifies returned identity/text and rejects a caller-text mismatch.
Canonical prerequisite constructors/verifier retain their existing copy/proof
ownership. Failures/logs contain only the selected operation and fixed stage/
dependency metadata. Resolver and Digest are captured; resolve requires R=never.
The explicit named VerifiedSourceText return type retains the prerequisite's
private capability in emitted declarations.

## Observed ownership and operation behavior

A focused control mutates the resolver's received root identity and, separately,
its nested extractor identity. Both are rejected while the caller's expectation
remains unchanged. This control already passed against the previous code before
refactoring: the initial alias concern was not reproduced. This is retained
regression evidence, not a newly discovered verification vulnerability or an
assertion that new copying repairs one.

Annotation-mode tests verify eyecite as ordinary source text without applying
an extraction shortcut. Caller mutation and later resolver replacement do not
change the installed behavior. Over-limit caller text refuses before resolution;
text mismatch and stale identity retain the selected annotation failure labels
and source-free encoding. A controlled resolver stall remains pending after the
unrelated 1ms extraction deadline and receives annotateDeadline at 50ms despite
later caller operation replacement.

The shared metadata owner now captures CitationRegexOperation in its dependency
Context and passes its selected operation to admission. Child construction/work
cannot inherit a later caller's replacement operation. A probe stage verifies
annotation admission and child operation with zero native children. Extraction
remains the upstream Context.Reference default. No new admission, scheduler,
resolver or proof framework is introduced.

## Verification

Fifteen tests across source evidence, single-source request and operation routing
pass in 8.00 seconds. Two actual Bun/Node paired-source tests pass separately in
53.33 seconds, preserving original both-branch behavior and source lineage.
Existing extraction shortcut/read-order, preflight, mismatch, redaction, lifetime
and captured-policy controls remain passing. The independent root/nested
resolver mutation control passed before the refactor in 1.28 seconds.

Server lint/types, declaration emission, blocking laws and scoped Fallow pass.
There are zero introduced findings and nine inherited clone groups under
unchanged policy. No baseline, threshold, expected source result or prerequisite
contract changes. The new helper uses the already-approved public prerequisite
symbols recorded in prerequisite-compatibility.md.

```sh
bun run beep quality package-verify @beep/law-practice-server --quick
bun run --cwd packages/law-practice/server beep:build
bun run beep lint laws --package packages/law-practice/server
cd packages/law-practice/server
bunx --bun vitest run test/CitationSourceEvidence.test.ts \
  test/CitationSourceRequest.test.ts test/CitationRegexOperation.test.ts
bunx --bun vitest run test/CitationPairedSource.test.ts
```

This is shared source-proof and operation ownership preparation. The admitted
annotation entry, complete raw-source annotation/public engine composition,
general host/nested callbacks, builtin difflib path and whole-engine safety/
scaling remain required. All eleven representation laws, four fidelity questions
and fifteen unfinished proof rows remain open without semantic waiver or
source/donor accounting promotion. New-head hosted proof remains pending.
