### sol-3-1

- file: scratchpad/effected/sbom/InTotoStatement.ts:501
- class: jsdoc   severity: required
- standard: `.patterns/jsdoc-documentation.md:221`, conditional `@throws` for synchronous failures outside an Effect error channel; D11.
- evidence: A read-only `bun -e` probe created `const predicate: Record<string, unknown> = {}; predicate.self = predicate`, passed it to `InTotoStatement.of({ subject: [], predicateType: "test", predicate })`, and called `statement.toJson()`. Construction succeeded; serialization threw `SchemaError` with `Expected a JSON-serializable value`. The method’s JSDoc describes formatting but contains neither a failure explanation nor `@throws`. The green docgen gate does not detect this semantic omission.
- failure: The public API accepts an unrestricted `unknown` predicate, but its documentation omits the synchronous serialization failure that callers must handle. The return type `string` does not communicate this contract.
- fix: Add `@throws SchemaError when the predicate cannot be serialized as JSON.` before `@since`. Preserve the serializer and its recorded failure behavior.

### sol-3-2

- file: scratchpad/effected/sbom/README.md:144
- class: docs   severity: required
- standard: D4 and §10.3, carried README examples must describe the port’s API; D11, demonstrably broken API example. `IdentityToken.ts:103` requires `Effect<Redacted<string>, IdentityTokenError>`.
- evidence: A read-only TypeScript compiler-host probe compiled the README callback in memory using the scratchpad compiler options. It reported `TS2322`: `Effect<string, never, never>` is not assignable to `Effect<Redacted<string>, IdentityTokenError, never>` because `string` is not assignable to `Redacted<string>`. This is a separate callback-type defect from the previously recorded README import-adaptation backlog; source/JSDoc gates leave this Markdown example unchecked.
- failure: Copying the documented token double into TypeScript fails compilation. The callback supplies a plain string where the identity service requires a redacted token.
- fix: Import `* as Redacted from "effect/Redacted"` and change the callback to `token: () => Effect.succeed(Redacted.make("test-token"))`.

REQUIRED: 2
BACKLOG: 0