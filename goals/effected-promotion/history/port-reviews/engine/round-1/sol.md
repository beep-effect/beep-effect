### sol-1-1
- file: scratchpad/effected/engine/ProcessGuard.ts:281
- class: bug   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D9 and §14, behavior preservation and deviation protocol.   evidence: A read-only Node 24.20.0 probe imported `ProcessGuard` separately from the pinned oracle and the port. Inside a `setImmediate` callback, it called `run` with `injectCrash: { at: "connected", kind: "uncaughtException" }`, marked connected during `load`, and queued another `setImmediate` callback. Oracle output was `["next check callback","injection"]`; port output was `["injection","next check callback"]`. The oracle uses `setTimeout(callback, 0)` at both injection sites; the port uses `setImmediate` here and at line 313. The engine ledger has no deviations, and README *Port notes → Deviations* says `None`.
- failure: Crash injection runs in a different event-loop phase and changes its ordering relative to server callbacks. Under an exit policy, the port can terminate before a callback that executes before termination in the oracle. The existing tests check eventual reporting but do not detect this ordering difference.
- fix: Restore `setTimeout(callback, 0)` at both injection sites, using the narrowly justified diagnostic exception for the dependency-free guard. If retaining the changed scheduling, first satisfy §14 with a qualifying cause, a recorded deviation, and a test demonstrating the intended ordering.

### sol-1-2
- file: scratchpad/effected/engine/Distribution.ts:37
- class: schema   severity: required
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D5 and the operator’s step 4, identity annotations on every schema; `standards/effect-first-development.md` EF-3, same-name type companions for non-class schemas.   evidence: A read-only import printed `Distribution.ast.annotations` with its composed `schemaId`, `identifier`, `iri`, `curie`, and `title`, but printed `DistributionField.ast.annotations` as `undefined`. The file also exports no `DistributionField` type companion.
- failure: The exported nullable schema has no identity of its own. Annotating the `Distribution` union member does not annotate the outer `DistributionField` schema, leaving this public schema outside the completed identity contract.
- fix: Pipe `S.NullOr(Distribution)` through `$I.annoteSchema("DistributionField", { description: ... })`, and export `type DistributionField = typeof DistributionField.Type`. Record the added type export under the D2 added-export protocol.

### sol-1-3
- file: scratchpad/effected/engine/LaunchContext.ts:11
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md` §5, Schema as the source of truth for pure data models; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; `standards/effect-first-development.md` EF-33.   evidence: `ProjectDirInput` contains only serializable data—optional string-array `argv`, string/undefined-valued `env`, string-array `keys`, and string `cwd`—but exists solely as an interface. It contains no callbacks, service operations, overloads, or type-level machinery requiring the plain-interface exception.
- failure: This exported process-derived input model has no runtime schema from which callers can derive validation, annotations, or generators. Its structural contract remains outside the schema-first model required by the cited standards.
- fix: Define an identity-annotated `ProjectDirInput` `S.Struct` and derive the same-name type from it. Preserve the existing accepted shape, including explicit `undefined` for `argv` and environment values; keep `projectDir` behavior unchanged. Record the added runtime export under D2.

### sol-1-4
- file: scratchpad/effected/engine/Distribution.ts:11
- class: jsdoc   severity: backlog
- standard: `.patterns/jsdoc-documentation.md`, hard requirements, carrier policy, and kind-split Example law; operator deferral of S2.   evidence: The owning API declarations in `Distribution.ts`, `LaunchContext.ts`, `ProcessGuard.ts`, and `Remediation.ts` retain `@remarks` and/or `@example`. None of those files supplies `@category` or `@since` tags. The runtime exports in `Distribution.ts` also lack required Examples.
- failure: The carried documentation does not satisfy the repository’s JSDoc contract: legacy carriers remain, canonical metadata is absent, and several runtime APIs have no compilable usage example.
- fix: During S2, preserve the existing prose while converting legacy carriers to `**Details**` and titled `**Example** (Title)` sections. Add canonical categories, `@since 0.0.0`, and meaningful examples for runtime exports, then verify them through docgen.

### sol-1-5
- file: scratchpad/effected/engine/README.md:44
- class: docs   severity: backlog
- standard: `standards/effect-laws-v1.md` law 2 and `AGENTS.md` Code Laws, dedicated Effect imports including Markdown examples; operator deferral of documentation work.   evidence: README examples use root imports at lines 44, 59, and 84: `import { Schema } from "effect"`, `import { Effect, Option } from "effect"`, and `import { Option } from "effect"`.
- failure: The lab’s public examples teach an import form expressly forbidden by the repository’s import law. These Markdown occurrences remain despite the green source gates.
- fix: Rewrite the examples to dedicated module imports using canonical aliases, such as `import * as S from "effect/Schema"` and `import * as O from "effect/Option"`, preserving their demonstrated behavior.

### sol-1-6
- file: scratchpad/test/engine/LaunchContext.test.ts:74
- class: test   severity: backlog
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D10 and §11.4; `goals/effect-vitest-canon/SPEC.md` §1.3, property run floors; operator deferral of S3.   evidence: The module’s only property registration hardcodes `{ arbitrary: { runs: 200 } }`. There are no `fcRuns` references anywhere under `scratchpad/test/engine`, and the `Distribution`, `DistributionField`, and `Remediation` suites contain only fixed examples rather than generated schema round-trip properties.
- failure: The existing property ignores the configured repository run floor and seed. The three exported schemas also lack the required generated encode/decode laws, so the fixed examples do not satisfy D10.
- fix: During S3, route property options through `fcRuns` with the canonical minimum, and add schema-derived round-trip properties for all three exported schemas using the required Effect/Vitest idioms.

### sol-1-7
- file: scratchpad/test/engine/LaunchContext.test.ts:72
- class: test   severity: backlog
- standard: `scratchpad/EFFECTED_PORT_GOAL.md` D9 and §11.2; `goals/effect-vitest-canon/SPEC.md` §1.3, meaningful property failure semantics; operator deferral of S3.   evidence: The property generates `cwd` with `S.NonEmptyString` but asserts that the returned directory never contains an unsubstituted placeholder. A read-only probe with `argv: []`, `env: {}`, and `cwd: "${CLAUDE_PROJECT_DIR}"` printed `{"cwd":"${CLAUDE_PROJECT_DIR}","result":"${CLAUDE_PROJECT_DIR}","property":false}`. The oracle and port both intentionally return `cwd` unchanged as the fallback.
- failure: The property asserts more than the function’s contract. Its generator admits a valid fallback containing `${…}`, which falsifies the property even when the implementation preserves oracle behavior.
- fix: Preserve the non-empty-result assertion, and assert placeholder rejection only for selected argv/env candidates; explicitly allow the unchanged `cwd` fallback. Add the demonstrated counterexample as a fixed case without changing production behavior.

### sol-1-8
- file: scratchpad/test/engine/Distribution.test.ts:31
- class: test   severity: backlog
- standard: `goals/effect-vitest-canon/SPEC.md` D5 and `scratchpad/EFFECTED_PORT_GOAL.md` §11.2, canonical Option assertions; operator deferral of S3.   evidence: Inside `it.effect`, line 31 asserts `O.isNone(current)` with `assert.isTrue`, and line 38 compares the complete Option value with `assert.deepStrictEqual`. Neither uses the mandated `@effect/vitest/utils` helpers.
- failure: The Option tests retain the assertion forms that the canon requires replacing, leaving this suite outside the deferred S3 assertion contract.
- fix: Use `assertNone(current)` for the default and `assertSome(current, { name: "@okfit/plugin", version: "0.5.1" })` for the provided value.

REQUIRED: 3
BACKLOG: 5