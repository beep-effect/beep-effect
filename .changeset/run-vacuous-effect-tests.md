---
{}
---

No release: make 80 tests that never executed actually run.

`it("...", () => Effect.gen(...))` hands Vitest an Effect it does not run, so the
body never executes and its assertions never evaluate — the test passes for the
wrong reason. 80 such sites across 13 files were passing unconditionally.
Converted to `it.effect`.

Running them surfaced five real problems: a docgen fixture that could not
exercise its own premise (`class A {}` then `A.make()`, so the inferred type
degenerated to `any`), a stale upstream error string in `Sha256HexFromHexBytes`,
and three `HttpHeaders` cases passing decoded values into encoded positions.

Two of those are defects the assertions were written to catch and never did.
Both are pinned to actual behaviour with comments rather than dropped:
`createValue` is typed for the decoded option but decodes its argument as
encoded, so with `reportURI` present no value satisfies both sides; and
`PermissionsPolicy` silently discards unrecognised directives, collapsing the
header to `None` so a typo removes the security control instead of failing.
Both need their own change, since fixing either alters security-header
behaviour.
