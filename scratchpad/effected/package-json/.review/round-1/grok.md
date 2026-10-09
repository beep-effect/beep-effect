I'll review the package-json port against the pinned upstream oracle and the port decisions, without editing anything. First I'm loading the binding decisions, port notes, and both trees.The ledger records no deviations for this module. Next I’ll diff the port against the pinned oracle and check the laws the gates do not already enforce.The jsonc review treated Effect-helper semantic drift as required. I’ll scan this port for the same class of change, plus anything the green gates would miss.I'll finish the remaining module comparisons against the pinned oracle, then report only findings that survive that check.### grok-1-1
- file: scratchpad/effected/package-json/EntryPoint.ts:186
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 (behaviour-preserving; an unforced call-shape change is restored). `dual` in `~/YeeBois/references/effect/effect/packages/effect/src/Function.ts:117-119`: a false predicate returns `(self) => body(self, ...arguments)`. `Predicate.hasProperty` (`Predicate.ts:1178`) is `property in self`. Upstream `resolveEntryPoint` (`packages/package-json/src/EntryPoint.ts:177-215`) is data-first and, when `exports` and `main` are absent, returns `Result.succeed("index.js")`.
- failure: The predicate treats a one-argument object that has `conditions` and lacks both `exports` and `main` as the data-last options bag. `resolveEntryPoint({ name: "left-pad", version: "1.0.0", conditions: ["node"] })` is a valid `EntryPointManifest` (extra keys are allowed once the value is not a fresh literal checked against that interface) and is typed as `Result`, but at runtime it returns a function. Upstream returns `Result.succeed("index.js")`. `resolveEntryPoint()` and `resolveEntryPoint(undefined)` likewise return a function; upstream throws while reading `manifest.exports`. `EntryPoint.test.ts:23-29` locks the new pipe form and never passes a manifest whose only colliding key is `conditions`.
- fix: Delete the `dual` wrapper and restore the upstream data-first function. Drop the pipeable assertions in `scratchpad/test/package-json/EntryPoint.test.ts:23-29`. A predicate cannot tell an options bag `{ conditions }` from a manifest that is only that key.

### grok-1-2
- file: scratchpad/effected/package-json/PackageJsonFormat.ts:105
- class: schema   severity: required
- standard: D9 and section 14 (different accepted input, `deviations: []`, README Deviations "None"). `schemaNumber` (`effect-tsgo/docs/rules/schema-number.md`) says `Schema.Number` accepts `NaN`, `Infinity`, and `-Infinity`, and to disable the diagnostic on that line when non-finite values are intentional. `SchemaAST.finite` (`SchemaAST.ts:4261`) is `number` plus `Number.isFinite`. Upstream field (`packages/package-json/src/PackageJsonFormat.ts:96`) is `Schema.Array(Schema.Union([Schema.String, Schema.Number]))`. This module's own `PackageManager.ts:156` states that `make` throws when a field schema rejects the value.
- failure: `PackageJsonModifyError.make({ path: [NaN], cause })` and the same call with `Infinity` or `-Infinity` throw. Upstream constructs the tagged error. Decoding an error value whose `path` contains one of those segments fails the same way. `modify` copies the caller path into that `make` (`PackageJsonFormat.ts:283`), so a non-finite segment that fails navigation dies as a defect instead of `PackageJsonModifyError`. Finite numbers, including negatives and fractions, still pass; only the three non-finite values changed.
- fix: Restore `S.Number` on that field and put `// @effect-diagnostics-next-line schemaNumber:off` above it, same form as `scratchpad/effected/glob/GlobPattern.ts:41`. The segment is the caller's path, so non-finite values are intentional. Pin `make` with `NaN` in the path.

### grok-1-3
- file: scratchpad/effected/package-json/README.md:286
- class: docs   severity: backlog
- standard: Section 10.3 (S2; docs stay backlog this round). Attribution is the upstream package, version, commit, LICENSE pointer, and vendored-engine notices found in source headers. The semver port notes (`scratchpad/effected/semver/README.md:205-210`) are that block, ending in "Vendored-engine notices: none found in source headers."
- failure: Lines 286-304 are source excerpts from `License.ts`, `Package.ts`, `PackageValidator.ts`, `index.ts`, `internal/format.ts`, and `internal/wire.ts` pasted as attribution bullets. They are not vendored-engine notices.
- fix: Replace those bullets with one line, `Vendored-engine notices: none found in source headers.`

REQUIRED: 2
BACKLOG: 1
