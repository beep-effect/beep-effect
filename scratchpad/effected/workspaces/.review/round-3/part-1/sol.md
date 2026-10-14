### sol-3-1
- file: scratchpad/effected/workspaces/DuplicateCheck.ts:404
- class: bug   severity: required
- standard: D9/D11 and section 14 (`upstream-bug` verified against the pinned oracle); `DuplicateInstance.dependents` promises every importer and package pulling that instance.
- evidence: A read-only `bun --eval` probe successfully decoded a `Lockfile` containing two reachable holders of `foo@1`: `{ name: "x\u0000y", version: "z" }` and `{ name: "x", version: "y\u0000z" }`, plus reachable `foo@2` to trigger the duplicate report. Both holders produce the same `renderKey`: `"package\u0000x\u0000y\u0000z"`. Both the reviewed implementation and the pinned oracle returned `expectedDependents: 2, actualDependents: 1`. Changing the second holder’s version to `"yz"` returned two dependents in both implementations. These strings are accepted by the public schemas; this is a schema-valid input case, although the embedded NUL is unusual.
- failure: The delimiter-based key silently conflates distinct dependents and removes one holder from the duplicate’s provenance. The outer `targetId` concatenation uses the same unescaped delimiter, so fixing only the name/version separator would leave another collision boundary.
- fix: Replace the concatenated key with an unambiguous encoding of the complete `[targetId, dependent]` pair, using a schema-backed JSON tuple codec. Preserve first-occurrence ordering and deduplication of identical relationships. Add the demonstrated collision and non-collision controls, and record the verified upstream-bug deviation.

### sol-3-2
- file: scratchpad/effected/workspaces/LayerPolicy.ts:136
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 18; `standards/effect-first-development.md` EF-12c; D11.
- evidence: The reusable required-edge constraint is constructed with `S.isPattern(REQUIRED_EDGE)` without check metadata. A read-only inspection of `LayerPolicy.fields.requiredEdges.ast.rest[0].checks[0].annotations` returned only `expected`, `representation`, and `arbitraryConstraint`; `identifier`, `title`, and `description` were absent. The enclosing field’s `annotateKey` description does not annotate this check. This demonstrates the missing metadata despite the green gates. Previous findings covered the separate glob check in this file and checks in other files, not this required-edge check.
- failure: The check used by the exported policy schema lacks the required identity and descriptive metadata.
- fix: Supply a distinct `$I`-based identifier, title, and description directly to `S.isPattern`, preserving `REQUIRED_EDGE`, accepted inputs, and validation behavior.

### sol-3-3
- file: scratchpad/effected/workspaces/DependencyGraph.ts:72
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-12b and EF-33; `standards/ARCHITECTURE.md` Core Principle 5; D5/D11.
- evidence: `Edges` remains an erased interface containing `order`, `forward`, and `reverse`. It is the named runtime payload constructed by `#index()` and `sortSubset()`, then consumed by `materialize()`, `cycleMembers()`, and `kahn()`. It contains pure data rather than operations or a type-level transform. A read-only probe confirmed that `S.Struct({ order: S.Array(S.String), forward: S.HashMap(S.String, S.HashSet(S.String)), reverse: S.HashMap(S.String, S.HashSet(S.String)) })` accepts the existing representation. The prior collection-replacement finding repaired its native collections; neither prior inventory supplied or waived a schema owner for this payload.
- failure: The graph’s shared internal data model has no executable schema source, so its runtime guard, codec, equivalence, and annotations cannot derive from the definition, contrary to the schema-first requirement.
- fix: Define a module-local, identity-annotated `Edges` structural schema and derive the existing type from `.Type`. Retain the plain object, immutable hash collections, explicit vertex order, and current construction timing; no new runtime rejection is needed.

REQUIRED: 3  
BACKLOG: 0