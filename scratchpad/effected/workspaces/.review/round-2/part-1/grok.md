I'll review those eight workspaces files against the pinned upstream oracle and the port laws, and I won't repeat closed round-1 items or recorded deviations.I'll finish the round-2 review from the open hypotheses: schema-guard equivalence, the integrity example, and the lockfile `.backing` handoff. Probes stay read-only.The checkout has moved past the review commit, so I’m checking whether these files still match `60fcfb5` before treating the working tree as the subject.### grok-2-1
- file: scratchpad/effected/workspaces/LockfileReader.ts:323
- class: law   severity: required
- standard: standards/effect-laws-v1.md law 6; allowlist contract (no scanner-miss entries); EFFECTED_PORT_GOAL.md D5. Round-1 r24 closed this escape in `internal/roots.ts`, `PeerCheck.ts`, and `DuplicateCheck.ts`.
- evidence: The pnpm importer stage builds `MutableHashMap<string, string>` and returns `lockfile.withImporterNames(names.backing)`. `backing` is the native `Map` field (`MutableHashMap.ts` interface). `NoNativeRuntime.ts` `detectNewExpressionViolation` reports only `new Map` / `new Set`, so this property read is invisible to the green law gate. It is the only `.backing` access left under `scratchpad/effected/workspaces`. String keys are simple keys, so lookups match an upstream `Map`. The README native-runtime deviation records that native maps were replaced and does not record this site. The allowlist has no workspaces entry.
- failure: Domain code still hands a native `Map` across the lockfile boundary while the law gate reports the module clean.
- fix: Pass `names` and change `Lockfile.withImporterNames` to take `MutableHashMap<string, string>` or `HashMap<string, string>`, looking names up with `MutableHashMap.get` or `HashMap.get`. Do not read `.backing`, do not write `new Map`, and do not add an allowlist entry.

### grok-2-2
- file: scratchpad/effected/workspaces/ConfigDependencyHooks.ts:697
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 and section 14; the module comment at `ConfigDependencyHooks.ts:649` that `layerSubprocess` mirrors in-process replay. README native-runtime claims own-key-safe records replaced `Object.*` and does not record this script.
- evidence: `seedToConfig` builds named catalogs with `R.fromEntries` (`Object.fromEntries` / `CreateDataProperty`), so an own catalog name `__proto__` survives `layerLive` and `layerFrom`, and `normalize` copies it the same way (`internal/catalogs.ts:116-130`). The child script does `catalogs[name] = { ...entries }` on `{}`. For the key `__proto__` that assignment hits the inherited setter and creates no own property, so `JSON.stringify` omits the catalog before the parent ever sees it. The pinned oracle script has the same assignment (`ConfigDependencyHooks.ts:543`). The recorded `__proto__` deviations are `WorkspacePackage.dependencyDiff` only.
- failure: A seeded catalog whose name is `__proto__` is kept by in-process replay and silently dropped by `layerSubprocess`, so the two layers are not interchangeable.
- fix: Build the child catalog record with an own-key-safe operation such as `Object.fromEntries`, keeping per-catalog copies and declaration order. Record the change as an `upstream-bug` deviation, since the oracle script drops the same key.

### grok-2-3
- file: scratchpad/effected/workspaces/PackageManagerName.ts:650
- class: schema   severity: required
- standard: standards/effect-laws-v1.md law 17; standards/effect-first-development.md EF-12b (derive domain guards with `S.is`). `PackageManagerName` is already the named `LiteralKit` at line 47. Round-1 r05 replaced the `S.Literals` spelling and did not cover this chain.
- evidence: The declaration tier re-spells the domain as `name === "pnpm" || name === "npm" || name === "yarn" || name === "bun"`. The oracle has the same chain. For the current four literals, `S.is(PackageManagerName)(name)` accepts and rejects the same strings, so D9 behavior stays put. `LiteralKit`'s `.is` map is per member; the union guard is `S.is(PackageManagerName)`.
- failure: Membership in the named manager domain is a hand-written literal chain. A literal added only on `PackageManagerName` is ignored here, and a manifest that declares it falls through to `PackageManagerDetectionError`.
- fix: Replace the chain with `if (S.is(PackageManagerName)(name))`. Keep the `runtime` ternary and the devEngines-first evidence selection.

### grok-2-4
- file: scratchpad/effected/workspaces/DuplicateCheck.ts:413
- class: perf   severity: required
- standard: EFFECTED_PORT_GOAL.md D11 (algorithmic-class win). This is not round-1 b12: that backlog item was `queue.shift` on the reachability walk, which this file no longer does.
- evidence: Importer provenance is `for (const importer of lockfile.importers) for (const [instanceId, paths] of importerRoots) if (paths.includes(importer.path))`. For `I` importers each resolving one distinct non-workspace root, that is `I` outer iterations times `I` inner iterations of `includes`, so Θ(I²) membership tests for `I` relationships. The cost does not depend on an engine fast-path. The roots were already known in the earlier importer pass. Upstream has the same nesting; the win is the complexity change, not a claimed timing regression.
- failure: Provenance construction is quadratic on an input whose relationship count and report size are linear, including when the duplicate list is empty.
- fix: Record each importer-to-instance pair while resolving roots, or keep an importer-keyed list and walk only that importer's roots. Preserve importer order and the existing `record` deduplication.

### grok-2-5
- file: scratchpad/effected/workspaces/ConfigDependencyHooks.ts:760
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md operator revision step 4 (every schema takes IdentityComposer identity, with annotations on fields and schemas); standards/effect-first-development.md EF-12. Round-1 r02 covered the hook configuration models, not this envelope. Docgen does not require identity metadata on an unexported schema.
- evidence: `ReplayPayload` is the named subprocess wire union and is built as a bare `S.Union` of two `S.Struct`s. Neither the union nor `ok`, `config`, `name`, `message`, or `stack` carries `$I.annote` / `$I.annoteSchema` or field descriptions. Neighboring schemas in this file (`HookConfig`, `PeerDependencyRules`, `HookReplay`) do.
- failure: The replay boundary has no canonical identity or field metadata, so its generated schema is an anonymous union.
- fix: Annotate `ReplayPayload` with `$I.annoteSchema("ReplayPayload", …)` and annotate `ok`, `config`, `name`, `message`, and `stack`. Keep the wire representation, optionality, and decode behavior.

REQUIRED: 5
BACKLOG: 0
