<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review those six workspace files against the pinned upstream oracle and the round-1 inventory, and I'll only report new findings.Round 1 already inventoried these files. I'll check the post-fix commit and look for new defects the earlier seats did not close.### fable-2-1
- file: scratchpad/effected/workspaces/PackedInstall.ts:286
- class: schema   severity: required
- standard: standards/effect-first-development.md, “Tagged error with Identity composer” (`cause: S.Defect({ includeStack: true })`); D11. Same gate gap as round-1 r01: no tsgo rule or beep law checks the `includeStack` option.
- evidence: `PackedInstallError.cause` is `S.optionalKey(S.Defect())`. `Schema.ts` documents that `Defect` omits stack traces unless `{ includeStack: true }` is passed. The round-1 repair added that option on `LockfileReader`, `ChangeDetector`, and `LayerPolicy` only. `failure` at line 882 still feeds the originating error into `PackedInstallError.make`.
- failure: Encoding a `PackedInstallError` that carries a `cause` drops the originating stack. Callers that log or persist the error lose the failure site the schema contract says to keep.
- fix: Change the field to `S.optionalKey(S.Defect({ includeStack: true }))`. Add one encode assertion that an `Error` cause still has a `stack` string.

### fable-2-2
- file: scratchpad/effected/workspaces/ReleaseTag.ts:94
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 18; standards/schema-first-development-prompt.md Pattern 2 (`S.isPattern` metadata). Enclosing `$I.annoteSchema` does not annotate the filter (round-1 r06). `schema-first` lint scans `packages/**`, so this private check is outside the gate.
- evidence: `VersionText` is `S.String.check(S.isPattern(/…/))` with no second argument. `SchemaAST.isPattern` puts `identifier`, `title`, and `description` on the filter only when that argument is passed. The schema annotation at line 96 stays on the string schema.
- failure: The SemVer check that `versionCore` and `classifyTag` now depend on has no check identity, title, or description. A failed version shows an anonymous pattern failure, and the filter metadata can drift from `VersionText` without a type error.
- fix: Pass `{ identifier: $I\`VersionTextPattern\`, title: "SemVer text", description: "A complete SemVer version with valid prerelease and build identifiers." }` to `S.isPattern`. Keep the pattern and the `isVersionText` predicate.

### fable-2-3
- file: scratchpad/effected/workspaces/PackedInstall.ts:710; scratchpad/effected/workspaces/internal/packedInstallPlan.ts:77
- class: bug   severity: required
- standard: D9 and section 14, upstream bug; `BinCommandOptions.env` at PackedInstall.ts:301-303 says an explicit entry always wins. Effect `Record.assignProperty` exists because ordinary assignment does not (`packages/effect/src/Record.ts` example at the `assignProperty` docs; `src/internal/record.ts` defines an own data property only when the key is `"__proto__"`). ES2024 B.2.2.1.2: `Object.prototype.__proto__`’s setter returns without defining a property when the value is a string.
- evidence: Both loops copy entries with `out[key] = value` / `env[key] = value` after `R.toEntries`. `R.toEntries` uses `Object.keys`, which includes an own enumerable `"__proto__"` key created as `{ ["__proto__"]: "1" }`. The destination is a normal `{}`, so the assignment hits the prototype setter and does not store the string. The native-runtime checker only flags `Object.*` methods, so this assignment is invisible to the green gate. Upstream `layeredEnv` uses the same assignment.
- failure: `PackedInstall.scrubEnv` and the environment built for `runBin` / `command` drop an own `"__proto__"` variable instead of passing it through. A removal (`undefined`) cannot delete a key that was never stored. Other string keys are unchanged.
- fix: Write both loops with `R.assignProperty`. Add a `scrubEnv({ ["__proto__"]: "1" })` regression that expects that own key, and keep every existing scrub assertion.

REQUIRED: 3
BACKLOG: 0
