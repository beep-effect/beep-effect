### sol-2-1
- file: scratchpad/effected/commands/internal/capture.ts:66
- class: bug   severity: required
- standard: D9, D11 and section 14 of scratchpad/EFFECTED_PORT_GOAL.md; standards/effect-first-development.md EF-31 (expected failures remain in the typed error channel).   evidence: A read-only differential Bun probe ran `Run.collect(ChildProcess.make("tool"), { maxOutputBytes: Number.NEGATIVE_INFINITY })` with each implementation’s `ScriptedSpawner` producing `{ stdout: "x" }`. The pinned oracle returned `Fail(CommandOutputError)` with `kind: "tooLarge"` and `cause.limit: -Infinity`; the port returned `Die` with message `"Schema validation failed"`. A second probe confirmed `S.is(RunOptions)({ maxOutputBytes: -Infinity }) === true` and that `Run.succeeds` also defects. The recorded numeric-domain deviation documents the finite error schema while explicitly preserving numeric policy inputs; this probe supplies new evidence of a failure-channel regression.
- failure: An accepted budget reaches `OutputTooLarge.make({ limit })` with a non-finite limit. Its synchronous validation exception bypasses `collectClassified`’s `Effect.mapError`, so callers cannot handle the overflow as `CommandOutputError`, and `Run.succeeds` defects instead of returning `false`.
- fix: Special-case the negative-infinity budget in `collectClassified` and return a typed `CommandOutputError` with `kind: "tooLarge"` before entering the collector. Retain the finite capture-error schema, add regressions for `Run.collect` and `Run.succeeds`, and record the resulting error-payload difference under section 14.

### sol-2-2
- file: scratchpad/effected/commands/README.md:85
- class: docs   severity: required
- standard: scratchpad/EFFECTED_PORT_GOAL.md D2 requires added exports to be listed under *Port notes → Added exports*; the operator’s bookkeeping ruling also requires additions in `exportsAdded`.   evidence: Read-only namespace-import probes against the pinned oracle and port reported `oracle value: false; lab value: true` for `LauncherPrefixes` in `LocalExec.ts`, `RunOptions` in `Run.ts`, `ScriptResult` and `SpawnRecord` in `ScriptedSpawner.ts`, and `ToolResolutionFailure` in `ToolDiscovery.ts`. At the reviewed commit, the README says `None.` and the commands ledger row has `exportsAdded: []`. These runtime values were introduced while replacing upstream type-only declarations.
- failure: The export inventory omits five actual runtime additions. Readers and later promotion work cannot use the required inventory to identify the port’s expanded value surface.
- fix: Replace `None.` with the five runtime schema additions and their defining modules, and add the corresponding entries to the commands row’s `exportsAdded` through the bookkeeping owner.

REQUIRED: 2
BACKLOG: 0