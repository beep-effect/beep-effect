I'll review the glob port at that commit against the pinned upstream oracle and the binding decisions, and report only findings. First I'm loading the port rules, the module notes, and the review surface.The module is at S1 with no recorded deviations. I'll diff the lab against the pinned oracle and look for behaviour or law gaps the green gates would miss.The public surface matches the oracle's exports. The risk is in the idiom rewrites — HashMap null keys, `dual` arity, and error types — so I'm reading those next.I'll confirm the cited lines against the lab tree and the pinned oracle, then emit only the finding records.### grok-1-1
- file: scratchpad/effected/glob/internal/assertValidPattern.ts:24
- class: law   severity: required
- standard: scratchpad/EFFECTED_PORT_GOAL.md D9 and §14; standards/effect-laws-v1.md law 7   evidence: oracle `assertValidPattern.ts:14` throws `TypeError("invalid pattern")`; lab throws `InvalidPattern.make`. Same class swap at `limits.ts:64` (`TypeError` → `InvalidCap`; oracle `limits.ts:48`), `braceExpressions.ts:64` (`Error` → `BraceExpressionError`; oracle `braceExpressions.ts:49`), `ast.ts:267`, `ast.ts:286`, `ast.ts:304`, `ast.ts:315`, `ast.ts:799` (`Error` / native `TypeError` from `(p as AST).toJSON()` → `ASTError`; oracle `ast.ts:254`, `273`, `291`, `301`, `784`), `minimatch.ts:908` (`Error("wtf?")` → `MinimatchError`; oracle `minimatch.ts:885`). Messages match. `PORT_LEDGER.json` `w1-glob.deviations` is `[]` (line 1548) and `scratchpad/effected/glob/README.md:192` says Deviations None. Tests were retargeted: `scratchpad/test/glob/engine.test.ts:105`, `:140`, `:141`; `hostility.test.ts:128–132`; `braceExpansion.test.ts:229–231` (oracle still expects `TypeError`). `expand` JSDoc at `braceExpansion.ts:121` still says an invalid `max` dies as `TypeError`.
- failure: `instanceof TypeError` is false for a non-string pattern and for a NaN or non-integer cap. The former `Error` defects are now `BraceExpressionError`, `ASTError`, and `MinimatchError` (`name` is the tag, and `_tag` is set). That is an unrecorded behaviour deviation. Law 7 forbids putting `TypeError` / `Error` back.
- fix: One ledger `deviations` family, reason `law:7`, citing those tests, then the same entry under README Port notes → Deviations. Change `braceExpansion.ts:121` to `InvalidCap`. Leave `KNOWLEDGE.md` verbatim (D4).

### grok-1-2
- file: scratchpad/effected/glob/GlobPattern.ts:35
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 19   evidence: `GuardReason` is named at `internal/limits.ts:32` and copied as `S.Literals([...]).annotateKey` at `GlobPattern.ts:35`. `Platform` is named at `internal/types.ts:13` and copied as `S.Literals` at `GlobPattern.ts:97–110`. `ExtglobType` is named at `internal/ast.ts:82` with a hand-rolled `isExtglobType` at `ast.ts:84`. Law 19 reserves `S.Literals` for anonymous unions never referenced by name, and requires `LiteralKit` for a named domain, especially once the schema value carries annotations. The S1 checkers (`effect-imports`, `effect-fn`, `terse-effect`, `native-runtime`) do not scan this. `jsonc` already uses `LiteralKit` for the same shape.
- failure: The type alias and the schema literal list can drift with no compile failure, and there is no single `.is` / `.Enum` domain. A platform or guard reason added on one side only is still accepted by the other.
- fix: One `LiteralKit` per domain. Use `.Type` for the TypeScript alias and the kit (not a second `S.Literals`) in `GlobPatternError.reason` and `GlobPatternOptions.platform`. Replace `ExtglobType` and `isExtglobType` with that kit's `.Type` and `.is`.

### grok-1-3
- file: scratchpad/effected/glob/internal/limits.ts:40
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 7; .patterns/error-handling.md (`S.TaggedErrorClass`)   evidence: `GuardExceeded` extends `Data.TaggedError("GuardExceeded")` and assigns `this.name = "Error"`. Every other glob error (`InvalidCap`, `InvalidPattern`, `BraceExpressionError`, `ASTError`, `MinimatchError`, `GlobPatternError`) extends `S.TaggedError`. Law 7 says to extend `S.TaggedError` from `effect/Schema` directly. The four S1 checkers do not flag `Data.TaggedError`.
- failure: The guard signal has no schema, no `$ScratchpadId`, and is outside the typed-error constructor the rest of the module uses. Call sites still throw `new GuardExceeded(reason, limit, actual)`.
- fix: Re-base `GuardExceeded` on `S.TaggedError` with `reason`, `limit`, `actual`, and `message` fields. Keep the positional constructor, the same message string, and `this.name = "Error"` so the upstream `Error` name and `instanceof` checks stay put.

### grok-1-4
- file: scratchpad/effected/glob/GlobPattern.ts:29
- class: jsdoc   severity: backlog
- standard: .patterns/jsdoc-documentation.md (hard requirements); scratchpad/EFFECTED_PORT_GOAL.md §10.2   evidence: `@public` at `GlobPattern.ts:29` and `GlobSet.ts:81`. `@remarks` at `GlobPattern.ts:166`, `:213`, `:291`, `:331` and `GlobSet.ts:58`, `:151`. `@example` at `GlobPattern.ts:220` and `GlobSet.ts:69`. No `@category` or `@since`. S2 has not run.
- failure: Carriers are still the upstream tags. `@remarks` is forbidden, examples are not titled `**Example** (Title)` sections, and exported symbols lack `@category` and `@since 0.0.0`.
- fix: Mechanical S2 conversion only. Do not treat this as a pre-S2 rewrite. The false `TypeError` sentence in `braceExpansion.ts:121` belongs to grok-1-1, not this pass.

### grok-1-5
- file: scratchpad/test/glob/GlobPattern.test.ts:330
- class: test   severity: backlog
- standard: goals/effect-vitest-canon/SPEC.md EV001   evidence: `Effect.runSync` inside `it` callbacks at `GlobPattern.test.ts:330`, `:353`, `:354`, `:361` and `GlobSet.test.ts:310`, `:326`. EV001 allows module-scope `runSync` for fixture construction; these calls are inside the test callback. S3 has not run.
- failure: The sync runner is invoked inside the test callback instead of the effect being yielded to `it.effect`.
- fix: Move those cases to `it.effect` and `yield*` the effect. Leave `assert.*` on plain values as they are.

REQUIRED: 3
BACKLOG: 2
