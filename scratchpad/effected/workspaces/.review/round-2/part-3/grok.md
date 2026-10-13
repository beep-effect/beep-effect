I'll review those seven workspace files against the round-1 inventory, the port ledger, and the pinned upstream oracle, and report only new findings.The round-1 inventory is large. I'll pull its findings for these seven files, then read the decision rules and the sources.Round 1 already closed the prototype, sort, and collection findings. I'll scan the current seven files for anything those gates would miss.I'll finish the round-2 review of those seven workspace files, starting with the open schema-guard comparison and any behavior that still diverges from the pinned upstream oracle.### grok-2-1
- file: scratchpad/effected/workspaces/WorkspaceSnapshots.ts:206
- class: bug   severity: required
- standard: D9 and section 14 (`upstream-bug`); same own-key failure as inventory r30. `effect/Record` `fromEntries` is `Object.fromEntries` (`Record.ts:413`) and `assignProperty` defines `__proto__` as an own data property (`internal/record.ts:3-8`). `toEntries` walks `Object.keys` (`Record.ts:470`, `1555`).
- evidence: `hookVersionsOf` does `versions[name] = replay.version` after `R.toEntries(replays)`. This module is ESM, so that assignment is strict `[[Set]]`. A string version cannot be a prototype, and the assignment throws `TypeError`. The replay record is built with `R.fromEntries` in `ConfigDependencyHooks.ts:569-570`, so a resolved name `__proto__` is an own key and is yielded. Upstream `replaysOf` assigns the replay object (`ConfigDependencyHooks.ts:415`), which sets the prototype and leaves no own key; `Object.entries` then skips it and upstream `hookVersionsOf` (`WorkspaceSnapshots.ts:157-159`) does not throw. Both `at` (`:526`) and `worktree` (`:595`) call this projector.
- failure: A config-dependency replay named `__proto__` aborts snapshot construction with a defect after replay has already succeeded. Upstream still returns a snapshot and drops that one name.
- fix: Return `R.fromEntries` of `[name, replay.version]` pairs. Record the kept own key as the same `upstream-bug` deviation class as r30.

### grok-2-2
- file: scratchpad/effected/workspaces/WorkspaceDiscovery.ts:1078
- class: schema   severity: required
- standard: `standards/effect-first-development.md` EF-12b and EF-35; `AGENTS.md` schema-derived guards. D11. Inventory r45 required this for `WorkspacesSync.ts` and was fixed at `WorkspacesSync.ts:34` (`S.is(WorkspacePackage.fields.dependencies)`). The schema-first and effect-fn gates do not flag a handwritten predicate.
- evidence: `isStringRecord` is `P.isObject(value) && R.values(value).every(P.isString)` and decides all four dependency fields at `:543-546`. `DependencyMap` is already `S.Record(S.String, S.String)` (`WorkspacePackage.ts:76-79`). `WorkspaceSnapshots.ts:214` guards the same maps with `S.is(DependencyRecord)`. The object parser rejects non-objects and arrays (`SchemaAST.ts:2991`) and checks `Object.keys` with the string schema (`SchemaAST.ts:3064-3065`), which matches this predicate, including an own `__proto__` string via `assignProperty` (`SchemaAST.ts:2938`).
- failure: Discovery keeps a second definition of a dependency map. A later constraint on `DependencyMap` will not apply here, so a live read and an at-ref snapshot can keep or drop the same field differently, or a map the schema rejects can still be passed into `S.decodeEffect(WorkspacePackage)` and fail the whole manifest.
- fix: Replace the helper with `S.is(WorkspacePackage.fields.dependencies)` and keep the omit-on-failure spread. No behavior change for current inputs.

REQUIRED: 2
BACKLOG: 0
