# Cache baseline review: generated USPTO doctest tasks

Reviewer: Codex claim-element-antecedent-check owner, self-review. This is a review of baseline posture, not independent cache qualification.

Hosted PR #2411 identifies missing generated `doctest` / `beep:doctest` tasks in `packages/drivers/uspto/package.json`. The canonical package-scripts writer adds exactly `doctest: bun run beep:doctest` and `beep:doctest: BEEP_VITEST_DOCTEST=1 bunx vitest run`. Every pre-existing script and all non-script manifest fields are unchanged. The generated task executes three tests successfully; that does not qualify cache reuse.

The cache audit names only subject `@beep/uspto`, with these ten task findings:

- build: configuration drift in the reviewed manifest bytes; selected script unchanged.
- check: configuration drift in the reviewed manifest bytes; selected script unchanged.
- docgen: configuration drift in the reviewed manifest bytes; selected script unchanged.
- doctest: new generated task, recorded as an unassessed computation under existing policy; no qualification or activation is granted.
- lint: configuration drift in the reviewed manifest bytes; selected script unchanged.
- lint:deprecated-apis: configuration drift in the reviewed manifest bytes; selected script unchanged.
- lint:jsdoc: configuration drift in the reviewed manifest bytes; selected script unchanged.
- lint:laws: configuration drift in the reviewed manifest bytes; selected script unchanged.
- test: configuration drift in the reviewed manifest bytes; selected script unchanged.
- test:property: configuration drift in the reviewed manifest bytes; selected script unchanged.

Scope, profile and epoch remain exactly those of the current accepted baseline. No root task, cache flag, input/output declaration, qualification, ledger entry, policy exception or unrelated subject is changed by this request. The qualification ledger must remain byte-identical. The previous/current manifest byte hashes below bind the exact review. Re-run the cache audit after the canonical writer; unassessed computations must remain reported as unknown.

Previous manifest SHA-256: `32650ce2b2f673670a52fe96d9eb523e8ff7d630556ca9fa6af5a6e5d6336e65`.

Current manifest SHA-256: `a67cef19eb9274a45be8e1a8b8f616190d7edb43699041963a08ccaa093336c1`.

Qualification ledger SHA-256: `13067bf343f413b4cc99b4cefca3ce7d094a1f09247a54ffc20114e766d4d2bb`.

Reversal: revert the generated task addition only if its source markers are retired, then submit a new reviewed baseline request for that actual input change. Never reset qualification state or broaden scope to suppress a failure.
