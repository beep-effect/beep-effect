### sol-3-1
- file: scratchpad/effected/git/Git.ts:1027
- class: bug   severity: required
- standard: D9, D11, §14 `upstream-bug`; `Git.log`’s fixed record format and `CommitInfo.sha`’s full-object-id contract.   evidence: A read-only differential probe generated real Git output with `log.showSignature=true`, using each implementation’s command constructor, and fed it through both the lab service and the pinned oracle. Git exited 0, but the lab log output began `No signature\n\0<sha>…`; `Git.log` failed with `GitCommandError`, detail `unparseable log output: log output did not open with a record separator`. The corresponding `commitInfo` output began `No signature\n<sha>\0N\0…`, and both implementations returned `sha: "No signature\n3ad7b305790c7f0903f6d55766c55186745ba2d1"`. The oracle reproduces both failures. Adding `--no-show-signature` restored the expected prefixes in both commands while retaining the `%G?` field.
- failure: A repository or global `log.showSignature=true` setting makes successful history queries fail and silently corrupts the object ID returned by `commitInfo`. Coverage of the ordinary fixed-format output does not exercise this configuration-dependent prefix.
- fix: Explicitly disable signature-display output for the two machine-parsed log invocations with `--no-show-signature`; retain `%G?` verification in `commitInfo`. Add regressions for both methods under `log.showSignature=true`, and record the verified upstream bug under §14 before changing behavior.

### sol-3-2
- file: scratchpad/effected/git/Git.ts:1207
- class: bug   severity: required
- standard: D9, D11, §14 `upstream-bug`; standards/effect-first-development.md EF-1 and EF-3; standards/schema-first-development-prompt.md “Effect owns fallibility and runtime boundaries.”   evidence: The read-only command `git log -1 --format=%H%x00%G?%x00%B '3ad7b305790c7f0903f6d55766c55186745ba2d1^{tree}'` exited 0 with empty stdout and stderr. An equal-endpoint revision range produced the same result. Feeding the real tree-ref result through `Git.commitInfo` caused a `Schema validation failed` defect at `S.asserts(commitInfoInput, parsed)`, rather than a failure in its declared error channel. The pinned oracle also defects on this output.
- failure: A caller-supplied revision that yields no commit turns a normal Git result into an uncaught schema defect. Consumers handling `GitCommandError` or `UnknownRefError` cannot recover through their typed error handlers. The parser’s comment that its separators are guaranteed on every successful invocation is false.
- fix: Make `parseCommitInfo` return a non-throwing parse result, check that both separators exist, and map missing or invalid fields to `GitCommandError` with `kind: "failed"` and an explanatory detail in the success handler at line 2703, following `Git.log`’s existing parse-failure pattern. Add a tree-ref or empty-range regression and record the verified upstream bug under §14.

### sol-3-3
- file: scratchpad/effected/git/Git.ts:1845
- class: schema   severity: required
- standard: D5, D11; standards/ARCHITECTURE.md §5 “Schemas Are Executable Contracts”; standards/effect-first-development.md EF-12b; standards/schema-first-development-prompt.md “Schema owns pure data.”   evidence: `SshFromEnv` is a named internal configuration payload containing three `Option<string>` fields. `Git.layer` constructs it at line 4859, and `make` and `resolveSshEnv` consume it to decide transport configuration. Its only definition is a handwritten interface; no schema owns the shape, identity, or field annotations. This is configuration data rather than a service contract or type-level utility. The stated green gates leave that concrete schema-first violation intact.
- failure: The internal SSH configuration model has a separate compile-time-only declaration instead of the required schema source of truth, despite controlling command and variant precedence.
- fix: Replace the interface with a module-local, identity-annotated `SshFromEnv` schema using `S.Option(S.String)` for the existing fields, and derive its type from that schema. Preserve the current Option representation, blank-value policy, precedence, and transport behavior; add no new input restrictions.

REQUIRED: 3
BACKLOG: 0