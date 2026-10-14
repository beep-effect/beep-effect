### sol-3-1
- file: scratchpad/effected/lockfiles/internal/yarn.ts:113
- class: bug   severity: required
- standard: D11; D9 and section 14’s verified upstream-bug exception; `ResolvedPackage.resolved` and `Lockfile.packageByInstanceId` contracts require resolved targets to identify normalized package instances.   evidence: A read-only `bun --eval` probe imported the port and the pinned oracle’s `src/Lockfile.ts` and parsed the following Yarn content through both:
  ```yaml
  __metadata:
    version: 8
  "consumer@npm:1":
    version: "1"
    dependencies:
      ghost: "npm:1"
  ", ghost@npm:1":
    version: "1"
    resolution: "ghost@npm:1"
  ```
  Both returned only the `consumer@npm:1` package, with `resolved: { ghost: "ghost@npm:1" }` and `unresolvedEdges: []`; `packageByInstanceId("ghost@npm:1")` returned `None`. The descriptor index registers the second entry’s `ghost@npm:1` descriptor, but package emission subsequently skips that entry because its first descriptor has no extractable name at line 128. The probe violates the property that every emitted resolved target must be found by `packageByInstanceId`. The reviewed files match commit `3ad7b305`; the round-2 emitted-target fixes and accepted deviations cover npm, pnpm and bun, leaving this Yarn case unaddressed.
- failure: Parsing succeeds with a dangling resolved edge and no unresolved-edge signal. A consumer following an apparently resolved dependency cannot retrieve its target, defeating the model’s graph-traversal and fail-closed contracts.
- fix: Populate the Yarn descriptor index only from entries that satisfy package emission’s name and nonempty-identity checks. Let dependencies targeting skipped entries follow the existing unresolved-edge path. Add this counterexample to `scratchpad/test/lockfiles/internal/yarn.coverage.test.ts`, asserting `resolved: {}`, `unresolvedEdges: ["ghost"]`, and that every emitted resolved target has a package row.

REQUIRED: 1
BACKLOG: 0