### sol-2-1
- file: scratchpad/test/engine/LaunchContext.test.ts:106
- class: test   severity: required
- standard: D9; EFFECTED_PORT_GOAL.md §§11.2, 11.4; goals/effect-vitest-canon/SPEC.md §1.3.   evidence: A read-only Bun differential probe against the pinned oracle used `{ argv: [], env: {}, keys: ["OKFIT_PROJECT_DIR", "CLAUDE_PROJECT_DIR"], cwd: "${CLAUDE_PROJECT_DIR}" }`. Both oracle and lab returned `"${CLAUDE_PROJECT_DIR}"`; the retained property predicate evaluated to `false` for both. The reviewed surface matches commit `a12bef261998d2ad92153dada46373be06950692`. This round-1 backlog obligation remains unresolved after S3; the added schema round-trip property does not correct it.
- failure: The property rejects correct upstream fallback behavior. Its generator permits a placeholder-bearing nonempty `cwd`, and `projectDir` deliberately returns that fallback unchanged when no argv or environment candidate is usable. A generated counterexample therefore makes the suite fail without a production regression; the green sampled run missed this input.
- fix: Preserve the nonempty-result assertion, permit an unchanged `cwd` fallback to contain placeholders, and apply placeholder rejection to selected argv/environment candidates. Add the demonstrated fallback as a fixed regression case. Preserve production behavior.

### sol-2-2
- file: scratchpad/test/engine/LaunchContext.test.ts:108
- class: test   severity: required
- standard: D10; EFFECTED_PORT_GOAL.md §11.4; goals/effect-vitest-canon/SPEC.md §1.3.   evidence: This registration still supplies `{ arbitrary: { runs: 200 } }`. A read-only probe with `BEEP_FC_NUM_RUNS=400 BEEP_FC_SEED=20260708` produced `fcRuns(200) → {"runs":400,"seed":20260708}`, while the retained registration remains `{"runs":200}`. The new property files use `fcRuns`, but this existing registration still bypasses it.
- failure: The retained property ignores the configured run floor and reproducible seed. Under the demonstrated CI settings it runs 200 cases instead of 400 and receives no configured seed, despite the green canon gate.
- fix: Import `fcRuns` from `@beep/fc-runs/FastCheckRuns` and replace the options with `{ arbitrary: fcRuns(200) }`, preserving the original minimum while honoring higher environment floors and the configured seed.

### sol-2-3
- file: scratchpad/effected/engine/LaunchContext.ts:99
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-5 and checklist item 6; AGENTS.md Code Laws; D5.   evidence: The reviewed source directly calls `value.indexOf("${")` at line 99, `value.indexOf("}", open + 2)` at line 100, and `value.trim()` at line 127. These remain despite the green gates and have no recorded native-helper deviation. The Effect reference exposes `Str.indexOf(searchString)` returning `Option<number>`, `Str.includes(searchString, position)`, and `Str.trim`, which can preserve the existing behavior and linear scanning strategy.
- failure: Launch-context domain logic still uses direct native string helpers contrary to the required Effect-native idiom. The documented full beep-native end state is therefore unmet; the cited sites are concrete residue that the green gates did not remove.
- fix: Import `effect/String` as `Str` and `effect/Option` as `O`. Replace trimming with `Str.trim(value)`, and implement placeholder detection with `O.match(Str.indexOf("${")(value), { onNone: () => false, onSome: (open) => Str.includes("}", open + 2)(value) })`. Retain the existing oracle behavior and linear scan.

REQUIRED: 3
BACKLOG: 0