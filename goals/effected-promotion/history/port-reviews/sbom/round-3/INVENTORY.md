# sbom — round-3 merged inventory

Seats read: `grok.md` (0 findings), `sol.md` (2), and `fable.md` (0; Grok 4.7 medium fallback seat), together with the adjacent `BRIEF.md` and `BRIEF.grok3.md`. There are no part-N subdirectories. Reviewed commit: `3ad7b305790c7f0903f6d55766c55186745ba2d1`. Counts after deduplication: **Required 0 · Backlog 2 · Codemod 0 · Rejected 0 · Groups 0**.

Binding inputs: the entire operator revision block, including "Operator rulings, 2026-10-09" and "Grilling, 2026-10-09 (later)", D1–D20, §12.4–12.5 and §14 of `scratchpad/EFFECTED_PORT_GOAL.md`, plus the merge instructions for this inventory. Both submitted findings have evidence and concrete fixes. Neither duplicates the other or the closed round-2 schema finding. Both are deferred to Backlog under the explicit docs/JSDoc/S2/S3 merge rule, regardless of the briefs' green-gate/S3 premise. The seat evidence identifies omissions beyond the claimed gates; it does not ask to repair a compiler or docgen error those gates already enforce.

The live checkout is on `@lab/effected-2`, rather than the requested `@lab/effected`; no branch change was made. Read-only inspection confirms the cited JSDoc omission, README callback and `IdentityTokenShape.token` return type. The probes below are evidence reported by Sol, not probes rerun during this merge. No seat alleges an unforced upstream change or requests law-forced deviation bookkeeping, so no restoration or new codemod record is assigned. The round-2 serializer-options fix is present at `InTotoStatement.ts:521` and is not reopened.

`standards/effect-laws.allowlist.jsonc` currently contains **zero entries for `scratchpad/effected/sbom/**`**, so there are no `allow-<n>` findings. With no required findings, `required.json` has empty groups and findings. No source, test, README Port notes, manifest, lockfile, repository configuration or ledger is assigned for editing. Only this inventory and `required.json` were written; no tests, audits, scratch-copy diagnostics, session, Yeet or closeout commands were run.

## Required

None.

## Backlog

### sol-3-1

- file: scratchpad/effected/sbom/InTotoStatement.ts:501
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md:221` requires conditional `@throws` documentation for synchronous failures outside an Effect error channel; D11. Classification follows the explicit docs/JSDoc/S2/S3 deferral for this merge.
- evidence: Sol reports a read-only `bun -e` probe that created `const predicate: Record<string, unknown> = {}; predicate.self = predicate`, constructed `InTotoStatement.of({ subject: [], predicateType: "test", predicate })`, and called `statement.toJson()`. Construction succeeded; serialization threw `SchemaError` with `Expected a JSON-serializable value`. Current source confirms that the JSDoc at lines 501–520 documents formatting but contains no failure explanation or `@throws`, while lines 521–529 use `Result.getOrThrow(S.encodeResult(S.fromJsonString(S.Unknown, ...))(...))`. Sol identifies a semantic omission the claimed green docgen gate does not detect.
- failure: The public statement constructor accepts an unrestricted unknown predicate, but the serializer's documentation omits the synchronous serialization failure callers must handle; its `string` return type does not express that failure.
- fix: During the documentation stage, add `@throws SchemaError when the predicate cannot be serialized as JSON.` before `@since` in `toJson`'s JSDoc. Preserve the serializer and its recorded failure behavior. No test or bookkeeping edit is requested.
- seats: sol-3-1
- disposition: Reclassified from required to backlog because this is a JSDoc finding deferred by the merge instructions.

### sol-3-2

- file: scratchpad/effected/sbom/README.md:144
- class: docs   severity: backlog
- standard: D4 and §10.3 require carried README examples to describe the port's API; `IdentityToken.ts:103` requires `Effect<Redacted<string>, IdentityTokenError>`. Classification follows the explicit docs/JSDoc/S2/S3 deferral for this merge.
- evidence: Sol reports an in-memory TypeScript compiler-host probe using the scratchpad compiler options. Compiling the README callback produced `TS2322`: `Effect<string, never, never>` is not assignable to `Effect<Redacted<string>, IdentityTokenError, never>` because `string` is not assignable to `Redacted<string>`. Current README lines 139–145 still supply `token: () => Effect.succeed("test-token")`; current `IdentityToken.ts:103` still declares the redacted return type. This callback-type defect is distinct from the earlier README import-adaptation backlog, and source/JSDoc gates leave this Markdown example unchecked.
- failure: Copying the documented token double into TypeScript fails compilation because the callback returns a plain string where the identity service requires a redacted token.
- fix: During the documentation stage, import `* as Redacted from "effect/Redacted"` in this README example and change the callback to `token: () => Effect.succeed(Redacted.make("test-token"))`. Edit the Testing example only; no README Port notes, service contract, test or repository-level edit is requested.
- seats: sol-3-2
- disposition: Reclassified from required to backlog because this is a documentation finding deferred by the merge instructions.

## Handled by the deviation codemod

None. This round submitted no findings that only request records of law-forced changes. Earlier inventories retain their own codemod bookkeeping.

## Rejected

None. Both submitted findings have concrete evidence and fixes, identify gaps beyond the claimed gates, and do not contradict an operator ruling. Their documentation classes require backlog classification rather than rejection.
