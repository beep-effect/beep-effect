### sol-2-1
- file: scratchpad/test/memfs/FileSystemContract.ts:400
- class: test   severity: required
- standard: D9; scratchpad/EFFECTED_PORT_GOAL.md §11.1 prohibits weakening upstream tests.   evidence: The pinned oracle’s `__test__/FileSystemContract.ts:387–394` creates and inspects the unscoped temporary directory inside an inner `Effect.scoped`, then asserts that it survives that scope’s closure. The lab removes that scope and leaves two consecutive `stat` assertions. A read-only `bun --eval` mutation probe decorated `makeTempDirectory` with erroneous cleanup registered on the ambient scope through `Effect.context`, `Context.getOption` and `Scope.addFinalizer`. Replaying the lab sequence returned `success`; replaying the oracle’s nested-scope sequence returned `NotFound`.
- failure: The test no longer verifies that **unscoped** temporary directories survive scope closure. An implementation that incorrectly gives `makeTempDirectory` scoped cleanup passes the revised assertion sequence. Green coverage does not detect the lost lifecycle assertion.
- fix: Restore the inner `Effect.scoped` around directory creation, the first `stat` assertion and the returned directory path. Keep the second `stat` assertion outside that scope, as in the pinned oracle.

### sol-2-2
- file: scratchpad/effected/memfs/internal/volume.ts:644
- class: schema   severity: required
- standard: standards/effect-laws-v1.md laws 17 and 19 require named or reused constraints to be schema-backed, guards derived with `S.is`, and named internal literal domains represented by `LiteralKit`; D5 and D11 apply this bar to the port.   evidence: `isOpenFlag` independently enumerates ten accepted strings in a handwritten type predicate. `openDescriptorUnlocked` uses it at line 1577 to validate runtime input before `openMode` interprets that same flag domain. No executable schema owns this constraint. This remains present on the green commit; the four stated beep-law gates do not enforce custom predicate-to-schema derivation.
- failure: The named open-flag constraint remains outside the executable schema model. Its runtime guard maintains a separate literal list from the `FileSystem.OpenFlag` type, leaving the accepted domain unavailable for schema-derived validation and generation.
- fix: Define an identity-annotated internal `OpenFlag` `LiteralKit` containing exactly the existing ten strings, and derive `isOpenFlag` with `S.is(OpenFlag)`. Preserve the current accepted flags and `BadArgument` behavior.

REQUIRED: 2
BACKLOG: 0