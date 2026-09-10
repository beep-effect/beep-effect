# R28 tooling support and policy carrier audit

P2 source adjudication only, on frozen HEAD
`93217d998f851e2e93d9864e2b5315552eaa58a7` and frozen `origin/main`
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. This lane owns only this new file.
It proposes four new disqualified rows, one existing NextConfig D2 expansion,
one existing driver-gate metadata correction, and fifteen callable/method-seed
withdrawals. There is no new qualified design or implementation proposal.

An additional completeness finding concerns NextConfig: the raw report adds
`reactCompiler`, reaching nineteen members accepting both Boolean values. Two
more root fields, `devIndicators` and `logging`, accept the literal false beside
an object payload. The corrected D2 candidate below contains the nineteen
true/false-capable members. This audit separately retains the two false-only
union sentinels and their complete option-object context for parent footprint
adjudication. It neither invents true states for them nor silently claims that
the nineteen-member list covers every root field containing any Boolean literal.

## Independent inputs and scope

Both reports are in
`data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/`:

| Lane | Receipt result | Assigned source scope |
| --- | --- | --- |
| `r28-tooling-library-support` | Three disqualified rows, zero qualified, exit0, end-turn event true, no errors; inventory validation0, three unique IDs. Started `2026-09-09T05:04:54.151398+00:00`, finished `2026-09-09T05:14:53.293066+00:00`. | codegen-kit, repo-utils, fc-runs, test-utils source. |
| `r28-tooling-policy` | Two disqualified rows, zero qualified, exit0, end-turn event true, no errors; inventory validation0, two unique IDs. Started `2026-09-09T05:05:45.285885+00:00`, finished `2026-09-09T05:14:37.781999+00:00`. | lint-rules and repo-configs source; generated snapshot excluded. |

Each execution receipt names the frozen HEAD. Both share base-prompt SHA-256
`6f54a113c39ea40a0254725aebf460ffcbb707792aa3e8b60aafb7f7a443dc5b`, extra-prompt
`5b92193de1ceb09051959239b35bee57d6b727f8dcba4e4d1c332ac2e5fcb19b`, runner
`0f3070ded9e9f0a1a905d7e6d43bf3d8631d85c657afa47d87312bc5349106bc`, and seed
`bf82e9656a66c738c413567734ae05bfad31e79c4cb7ab3c086307dd28185f24`.
The support transcript hash is
`77ed26dbf6d0ab38883f8996a2dd3f7f265332499d5161c21adcc43b404dbe82`; policy's is
`cd376bdf9d74054d4d2b936e8677cfaaa7927407d73abcc595eafa337c8b6b40`.
These prompt/transcript/runner/seed values are receipt provenance. The locally
recomputed report, receipt, source, and SDK declaration hashes appear below.

Parser validation establishes record shape, not correct eligibility, complete
member lists, or source-level SDK attribution. This P2 audit verifies those
separately and leaves the original reports and receipts unchanged.

## Three support bags

### ts-morph Project constructor options — retain D2

`packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts:484–488`
constructs a real `new Project({...})` inside `createProjectPool`472 and its
`getOrCreate` function475. The complete instantiated bag has three fields:
`tsConfigFilePath: absoluteTsConfigPath`, `skipFileDependencyResolution`, and
`skipLoadingLibFiles`. Exactly the last two are Boolean members. Preserve the
path and both explicit Boolean values; do not add options that the external
interface permits but this call does not instantiate.

The flags project independent declared domains: referencePolicy
workspaceOnly/followReferences and mode syntax/semantic. These LiteralKits are
at `TSMorph.model.ts:833` and868, and both fields coexist in
`TsMorphProjectScopeRequest:1781–1791` and `TsMorphProjectScope:1838–1851`.
The SDK write is dependency-skip iff workspaceOnly and lib-skip iff syntax.
All four flag tuples have typed scope inputs; cross-axis examples also occur
at1588–1589 and1613–1614. Caching, path resolution, error payload and pool
identity remain unrelated data.

Local installed ts-morph28.0.0 confirms both optional Boolean options in
`node_modules/ts-morph/lib/ts-morph.d.ts:723–756`, with defaults false. Other
SDK fields include skipAddingFilesFromTsConfig and useInMemoryFileSystem, but
neither is present in this bag. This is an external SDK boundary, D2 census.
Correct synthetic `createProjectPool.projectOptions` to the real enclosing
`createProjectPool`, retaining the instantiated Boolean evidence at486.

### Testcontainers stop options — retain D2

`packages/tooling/test-kit/test-utils/src/SqlTest.ts:730–742` declares
`releasePgliteContainer`; its stop call at732 instantiates exactly
`{ remove: true, removeVolumes: true }`. Local Testcontainers12.1.0 declares
`StopOptions { timeout: number; remove: boolean; removeVolumes: boolean }` and
`stop(options?: Partial<StopOptions>)` in
`node_modules/testcontainers/build/test-container.d.ts:46–52`.

The real bag contains two Boolean fields. Timeout is an uninstantiated numeric
SDK option, not a third Boolean or missing payload in the source call. Keep
both true settings, async stop, typed teardown-error mapping, warning handling,
and release through acquireRelease at956. D2 makes no claim that all option
cross-products have distinct or independently effective runtime meanings.
Correct synthetic `.stopOptions` to `releasePgliteContainer`.

### Shared glob options — retain D1 with omission fidelity

`packages/tooling/library/repo-utils/src/FsUtils.ts:206–212` declares the actual
`sharedGlobOptions` object inside `runGlob`. Five fields are conditionally
spread from Option values: absolute, cwd, dot, ignore, nodir. The three Boolean
members are absolute/dot/nodir. `O.fromUndefinedOr` plus `O.getSomesStruct`
omits an undefined input but preserves false and true. No Boolean default is
applied at this writer.

The public repo-utils `GlobOptions` at41–59 has only absolute/dot plus optional
cwd and ignore. The private runGlob signature202–205 also accepts optional
nodir; `globFiles`224 supplies true while the exposed glob implementation314
forwards any supplied nodir. Public structural argument values can carry this
additional property; the constructor's narrower declared fields do not justify
normalizing it away at the forwarding boundary. Do not claim an anonymous
parameter type is the newly inventoried owner: the actual object at206 is.

The consumer is repo-owned `@beep/utils/Glob`, not an external glob SDK at this
boundary. `packages/foundation/modeling/utils/src/Glob.ts:83–117` declares all
five options and independently defaults absolute/dot/nodir to false when
resolving options. Directory omission is read at418, absolute output at440–449,
and the Bun adapter forwards dot/onlyFiles at491–495. These controls do not
form search phases. Preserve all three absent/false/true domains and both
non-Boolean siblings. D1 does not flatten optional states into an eight-value
raw domain. Correct the locator to declared `sharedGlobOptions`, line206.

## Policy bags and NextConfig completeness

### JSONC parser options — retain D2

`packages/tooling/policy-pack/repo-configs/src/internal/eslint/EffectLawsAllowlistSchemas.ts:104–125`
declares `parseAllowlistJsonc`. Its `parse(content, parseErrors, {...})` argument
at106–109 has exactly allowTrailingComma:true and disallowComments:false.
Local jsonc-parser3.3.1 `ParseOptions` at
`node_modules/jsonc-parser/lib/umd/main.d.ts:179–183` also permits optional
allowEmptyContent, which this bag does not instantiate. Keep it omitted.

Preserve content, the populated parseErrors array, unknown parsed value,
formatted error details and `AllowlistJsoncTextToUnknown` decode-only
transformation127–139. The input content and error array are other call
arguments, not Boolean bag members. Correct `.parseOptions` to actual
`parseAllowlistJsonc`; classification remains SDK mirror D2.

### NextConfig — retain D2 and enumerate full root domains

`packages/tooling/policy-pack/repo-configs/src/next/NextConfig.model.ts:185–401`
declares the actual class; its helper at37–38 wraps each root option with
`S.optionalKey`, preserving omission. The raw correction properly adds
reactCompiler319–323 (`Boolean | ReactCompilerOptions`) to the original
eighteen-member row. reactStrictMode325–328 also admits null. None of these
union payloads may be erased or reinterpreted as a plain two-state switch.

Two more root fields carry the Boolean value false: devIndicators297 references
the union at84–88, and logging366 directly unions LoggingConfig with literal
false. They are already discriminated object-or-disabled options, not full
Booleans. Local Next16.4.0-canary.19's
`node_modules/next/dist/server/config-shared.d.ts:1447–1453`,1497,1508,1620
confirms those domains. The proposed nineteen-member D2 record retains the
independent report's true/false-capable footprint; the two sentinel fields are
explicit additional context for the parent's completeness decision. Their
presence does not establish an E1–E4 qualification.

| Root member family | Members and actual domain |
| --- | --- |
| Seventeen ordinary optional Booleans | typedRoutes, excludeDefaultMomentLocales, trailingSlash, cleanDistDir, useFileSystemPublicRoutes, generateEtags, compress, poweredByHeader, productionBrowserSourceMaps, reactProductionProfiling, skipMiddlewareUrlNormalize, skipProxyUrlNormalize, skipTrailingSlashRedirect, enablePrerenderSourceMaps, cacheComponents, agentRules, bundlePagesRouterDependencies. |
| Optional Boolean/object | reactCompiler; retain ReactCompilerOptions payload. |
| Optional Boolean/null | reactStrictMode; retain null. |
| Optional false/object | devIndicators and logging; retain complete option objects and omission, never add true. |

Nested schemas such as compiler, experimental, image options, logging fields,
httpAgentOptions, and ModularizeImportsRuleConfig remain their own owners.
Numbers, callbacks, strings, arrays and required object payloads are not root
Boolean members. The current SDK mirror is not narrowed by the configurations
used in one application.

`SharedNextConfig.model.ts:452–496` spreads all next options and independently
applies defaults for agentRules:false, cacheComponents:true,
poweredByHeader:false, reactCompiler:true, reactStrictMode:true, typedRoutes:true.
Explicit false and object inputs must remain supported; the builder's current
handling of null/omission stays unchanged. Keep the deprecated
skipMiddlewareUrlNormalize alias beside skipProxyUrlNormalize, as documented
in source362–363 and SDK1607–1610. No alias retirement, schema change, Next
upgrade, or expanded external legality claim follows from D2.

## Retained real driver gate

`r3-tooling-pglite-integration-gate-flags` remains D1. At
`SqlTest.ts:1656`, `shouldUseTestcontainers` is an actual Boolean local derived
from the requested driver. At1660, `shouldRunPgliteIntegration: boolean = true`
is an actual always-run policy value. They are returned as values at1694–1695,
alongside sharedConnectionUri, timeout300000, and the generic makePgliteLayer
factory. Correct only the synthetic `.driverGates` symbol to the real
`makePgliteIntegrationGate` owner.

The pair is not the callable `.modeGates` seed withdrawn below. Do not claim
all four Boolean pairs are emitted here: the run flag is always true. Retain
its existing D1 disposition because it is constant run policy beside an
independently chosen driver, not evidence of a flattened phase machine.
sharedConnectionUri remains an independent Option payload; external connection
selection1672 has priority even when the testcontainers bit is true1679.
Do not convert this full factory contract to an exclusive two-flag state.

Preserve optional env fields, environment fallback via Config, empty-URI
filtering, both Boolean properties, timeout, optional hooks, in-process
configuration, fresh layers, and external/testcontainers/in-process selection.
`test/SqlTest.test.ts:722–749` covers default, external and testcontainers
branches; the returned values and factory are public test consumers. These
tests were read, not run.

## Fifteen exact footer withdrawals

The support footer names ten current rows; the policy footer names five.
Every listed member below is a callable predicate or Effect-returning method,
not a Boolean value. Preserve all runtime validation, service methods, exported
predicates, overloads and schema checks. Remove only the active census rows
through parent integration; do not retain them as D1 or invent replacement
carriers. Full source paths and original member arrays are in the structured
withdrawals later in this file.

| Lane / stable ID | Exact source proof |
| --- | --- |
| Support `r3-tooling-sqltest-pglite-layer-gates` | `SqlTest.ts:1578–1594` declares two functions, `shouldUseExternalPgliteLayer` and `shouldUseTestcontainersPgliteLayer`; makePgliteSqlTestLayer invokes them1731/1735. No stored modeGates pair. |
| Support `r3-tooling-codegen-export-typeonly-gates` | `postProcess.ts:639`,645 declare isExported/isTypeOnly functions. addExportDocs filters the first736 and invokes the second745. renderGenericDoc's Boolean parameter648 is not a sibling-state owner. |
| Support `r3-tooling-jsdoc-category-char-class-gates` | `JSDocCategories.ts:290`,295,300 declare character predicates; normalization invokes them342–352 and already uses CategoryCharacterKind. No three-Boolean charClassGates object. |
| Support `r3-tooling-codegen-jsonschema-node-gates` | `transforms.ts:50`,72,75 declare isMergeableTarget, isStringTypeArray, isSingleNullableType. Transforms call them66/67/84. Node arrays/objects are payload, not synthetic Boolean fields. |
| Support `r3-tooling-tsconfig-alias-target-gates` | `TsconfigAliasTargets.ts:129`,131,134 declare separate path-value, object-value and key predicates, called137/145/189/193. No valueGates carrier. |
| Support `r3-tooling-tsconfig-option-helper-gates` | `TSConfig.ts:416–423`,432–433 declare helpers over options and target ranks. Their calls in schema checks1215/1223/1259/1843 do not store helper functions as Boolean state. |
| Support `r3-tooling-fsutils-stat-kind-gates` | `FsUtils.ts:298–306` defines isDirectory/isFile as Effect-returning service methods, returned321–322. Each independently stats its path argument. Neither method is a Boolean field or a combined result record. |
| Support `r3-tooling-process-args-option-like` | `ProcessArgs.ts:95`,97 declare positive and negative callable predicates. isOptionLike is exported; isNotOptionLike is supplied to LiteralArg's schema filter271. Complementarity does not turn functions into a state pair. |
| Support `r3-tooling-workspaces-pattern-gates` | `Workspaces.ts:37`,75–80 declare array-shape and string-safety predicates. Readers72/146 act on different payloads. No patternGates object. |
| Support `r3-tooling-package-json-tools-issue-gates` | `PackageJsonTools.ts:40`,51–54 declare record and issue-segment type guards; toIssuePathPropertyKey57 and canonicalization86 consume them. No issueGates carrier. |
| Policy `r3-tooling-lint-global-process-object-gates` | `no-global-process-runtime.ts:115–127` declares two local callable AST predicates; one invokes the other126. The lexical-scope tracking and globalProcessProperty filter170 are real consumers, not Boolean state storage. |
| Policy `r3-tooling-lint-js-extension-import-gates` | `no-js-extension-imports.ts:26`,29,45 declare filename/specifier/AST predicates; create72, checkSource75 and ImportExpression105 invoke them. No importGates value. |
| Policy `r3-tooling-require-category-export-gates` | `RequireCategoryTagRule.ts:32`,34–52 declares isExportDeclarationNode/isExportedNode; parent-node matching invokes the former42/46, and checkNode140 invokes the latter. No exportGates record. |
| Policy `r3-tooling-opaque-schema-receiver-gates` | `no-opaque-instance-fields.ts:79`,83 declare predicates taking Option<AstNode>; isSchemaReceiver invokes isEffectRootSchema84 and isOpaqueCallee invokes isSchemaReceiver92. No paired Boolean local results. |
| Policy `r3-tooling-no-native-runtime-hotspot-paths` | `NoNativeRuntimeHotspots.ts:79–81`,99–100 are exported path predicate functions. Keep their independent matching and public consumers; no pathGates state exists. |

The already-withdrawn `r3-tooling-tsmorph-path-error-gates` is absent from the
current canonical inventory and remains withdrawn. Other eligible seeds,
including codegen-kit-cli-mode and the existing compiler-option census, are
unchanged by this bounded audit. This task does not claim to repeat the full
independent sweep of those other owners.

## Full current-canonical duplicate checks

The inventory snapshot used for this audit had 829 records and SHA-256
`4f1db0cacb616281fe14ed3fc15ee00c097673109596182189df58e1dbc3b4ea`.
This is an observed parent-owned snapshot, not a lock on concurrent parent
integration. Checks compared every new row against the whole inventory by
stable ID, file, symbol, and member overlap, then inspected same-file owners:

- New ts-morph Project bag: no canonical record on TSMorph.service.ts; no
  same-cluster alias elsewhere in the current inventory.
- New container-stop bag: SqlTest.ts has the callable modeGates record and
  real driverGates record; neither owns remove/removeVolumes or the stop call.
- New sharedGlobOptions bag: FsUtils.ts has public GlobOptions
  (`tooling-rest-glob-options`, absolute/dot, line43) and callable statKind.
  The constructed forwarding object206 is a different owner with nodir;
  preserve the public schema row. Shared @beep/utils Glob options are in a
  different file and also remain separate schema/consumer owners.
- NextConfig: replace the same stable-ID row; do not append a second schema
  record. Same-file ModularizeImportsRuleConfig110 is a distinct nested owner.
- New JSONC bag: no current canonical record on EffectLawsAllowlistSchemas.ts;
  SDK ParseOptions' allowEmptyContent is uninstantiated and not a duplicate or
  missing member of this concrete two-field call.

The six proposed JSONL rows below therefore contain four new D records and two
existing-ID replacements. The nineteen-member NextConfig correction is the
candidate requested for integration; the two additional sentinel members remain
separate context for parent adjudication.
The fifteen withdrawals do not overlap those six IDs. No qualified omission
was established by this audit, so no provisional design is created.

## Exact proposed JSONL rows

```jsonl
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-tooling-library-support-tsmorph-project-options","file":"packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts","line":486,"symbol":"createProjectPool","kind":"object-literal","members":["skipFileDependencyResolution","skipLoadingLibFiles"],"status":"disqualified","disqualifier":{"class":"D2","note":"Actual new Project options object at484-488 inside createProjectPool/getOrCreate. Complete bag: required tsConfigFilePath plus skipFileDependencyResolution and skipLoadingLibFiles. Flags project independent referencePolicy workspaceOnly/followReferences and mode syntax/semantic domains. Local ts-morph28.0.0 ProjectOptions declares both optional Booleans; other SDK options are not instantiated. D2 SDK boundary; preserve path and explicit values."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-tooling-library-support-pglite-container-stop-options","file":"packages/tooling/test-kit/test-utils/src/SqlTest.ts","line":732,"symbol":"releasePgliteContainer","kind":"object-literal","members":["remove","removeVolumes"],"status":"disqualified","disqualifier":{"class":"D2","note":"Actual StartedTestContainer.stop argument at SqlTest.ts:732 contains remove:true and removeVolumes:true only. Local Testcontainers12.1.0 StopOptions also has numeric timeout, while stop accepts Partial<StopOptions>; timeout is omitted and not a Boolean member. Preserve both settings and teardown error handling. D2 SDK boundary, with no claim that all SDK option tuples have independent runtime effects."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-tooling-library-support-runglob-shared-glob-options","file":"packages/tooling/library/repo-utils/src/FsUtils.ts","line":206,"symbol":"sharedGlobOptions","kind":"object-literal","members":["absolute","dot","nodir"],"status":"disqualified","disqualifier":{"class":"D1","note":"Actual named forwarding object at FsUtils.ts:206-212 inside runGlob contains optional absolute,cwd,dot,ignore,nodir. The Boolean members absolute/dot/nodir remain independent path-output,dotfile,and directory controls. O.fromUndefinedOr/getSomesStruct omit undefined while preserving false/true. Public GlobOptions declares absolute/dot; private runGlob also accepts nodir and globFiles supplies true. Repo-owned @beep/utils/Glob consumes all three independently; retain D1 and all optional domains/non-Boolean payloads."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"tooling-rest-next-config","file":"packages/tooling/policy-pack/repo-configs/src/next/NextConfig.model.ts","line":208,"symbol":"NextConfig","kind":"schema-struct","members":["typedRoutes","excludeDefaultMomentLocales","trailingSlash","cleanDistDir","useFileSystemPublicRoutes","generateEtags","compress","poweredByHeader","productionBrowserSourceMaps","reactCompiler","reactProductionProfiling","reactStrictMode","skipMiddlewareUrlNormalize","skipProxyUrlNormalize","skipTrailingSlashRedirect","enablePrerenderSourceMaps","cacheComponents","agentRules","bundlePagesRouterDependencies"],"status":"disqualified","disqualifier":{"class":"D2","note":"Public Next.js wire mirror; corrected true/false-capable member count19 adds reactCompiler Boolean|ReactCompilerOptions at319-323. reactStrictMode also permits null; all root options preserve omission. SharedNextConfig defaults selected fields without retiring siblings or deprecated skipMiddlewareUrlNormalize. devIndicators at297 (union84) and logging366 separately permit false|options, never true; retain their complete context in the audit for parent footprint adjudication. D2 makes no claim that every external cross-product is legal."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r28-tooling-policy-jsonc-parse-options","file":"packages/tooling/policy-pack/repo-configs/src/internal/eslint/EffectLawsAllowlistSchemas.ts","line":107,"symbol":"parseAllowlistJsonc","kind":"object-literal","members":["allowTrailingComma","disallowComments"],"status":"disqualified","disqualifier":{"class":"D2","note":"Actual jsonc-parser.parse third argument at EffectLawsAllowlistSchemas.ts:106-109 instantiates allowTrailingComma:true and disallowComments:false. Local jsonc-parser3.3.1 ParseOptions also permits allowEmptyContent, which is omitted by this bag. Preserve input content, error array, parsed value and error transformation. D2 external parser boundary; no new field or phase."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r3-tooling-pglite-integration-gate-flags","file":"packages/tooling/test-kit/test-utils/src/SqlTest.ts","line":1656,"symbol":"makePgliteIntegrationGate","kind":"sibling-state","members":["shouldUseTestcontainers","shouldRunPgliteIntegration"],"status":"disqualified","disqualifier":{"class":"D1","note":"Actual Boolean locals shouldUseTestcontainers at1656 and explicitly Boolean shouldRunPgliteIntegration=true at1660, returned as values1694-1695. Retain existing D1: constant always-run policy beside independent driver choice, not callable modeGates or a phase machine. Do not claim all four runtime pairs: run flag is always true. Preserve independent sharedConnectionUri Option, external-first priority even with testcontainers requested, timeout300000, optional env/hooks/inProcess inputs and generic fresh-layer factory."}}
```

## Exact withdrawal proposals

```jsonl
{"id":"r3-tooling-sqltest-pglite-layer-gates","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/tooling/test-kit/test-utils/src/SqlTest.ts","line":1578,"symbol":"makePgliteSqlTestLayer.modeGates","members":["shouldUseExternalPgliteLayer","shouldUseTestcontainersPgliteLayer"],"reason":"Callable predicates/type guards, not co-carried Boolean values. Preserve callable contracts and runtime checks; exact declaration and consumer proof is in the audit table."}
{"id":"r3-tooling-codegen-export-typeonly-gates","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/tooling/library/codegen-kit/src/internal/postProcess.ts","line":639,"symbol":"addExportDocs.statementGates","members":["isExported","isTypeOnly"],"reason":"Callable predicates/type guards, not co-carried Boolean values. Preserve callable contracts and runtime checks; exact declaration and consumer proof is in the audit table."}
{"id":"r3-tooling-jsdoc-category-char-class-gates","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts","line":290,"symbol":"normalizeJSDocCategoryKey.charClassGates","members":["isUpperAscii","isLowerAscii","isDigitAscii"],"reason":"Callable predicates/type guards, not co-carried Boolean values. Preserve callable contracts and runtime checks; exact declaration and consumer proof is in the audit table."}
{"id":"r3-tooling-codegen-jsonschema-node-gates","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/tooling/library/codegen-kit/src/internal/transforms.ts","line":50,"symbol":"nullableTypeArray.nodeGates","members":["isMergeableTarget","isStringTypeArray","isSingleNullableType"],"reason":"Callable predicates/type guards, not co-carried Boolean values. Preserve callable contracts and runtime checks; exact declaration and consumer proof is in the audit table."}
{"id":"r3-tooling-lint-global-process-object-gates","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/tooling/policy-pack/lint-rules/src/rules/no-global-process-runtime.ts","line":115,"symbol":"isGlobalProcessObject.spellingGates","members":["isGlobalThisProcess","isGlobalProcessObject"],"reason":"Callable predicates/type guards, not co-carried Boolean values. Preserve callable contracts and runtime checks; exact declaration and consumer proof is in the audit table."}
{"id":"r3-tooling-tsconfig-alias-target-gates","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/tooling/library/repo-utils/src/schemas/TsconfigAliasTargets.ts","line":129,"symbol":"firstRelativeDotPath.valueGates","members":["isRelativeDotPath","isReadonlyUnknownRecord","isSubpathExportKey"],"reason":"Callable predicates/type guards, not co-carried Boolean values. Preserve callable contracts and runtime checks; exact declaration and consumer proof is in the audit table."}
{"id":"r3-tooling-lint-js-extension-import-gates","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/tooling/policy-pack/lint-rules/src/rules/no-js-extension-imports.ts","line":26,"symbol":"no-js-extension-imports.importGates","members":["isTypeScriptFile","isRelativeSpecifier","isStringLiteral"],"reason":"Callable predicates/type guards, not co-carried Boolean values. Preserve callable contracts and runtime checks; exact declaration and consumer proof is in the audit table."}
{"id":"r3-tooling-tsconfig-option-helper-gates","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/tooling/library/repo-utils/src/schemas/TSConfig.ts","line":416,"symbol":"TSConfig.optionHelpers","members":["isTrueOption","isTargetAtLeast"],"reason":"Callable predicates/type guards, not co-carried Boolean values. Preserve callable contracts and runtime checks; exact declaration and consumer proof is in the audit table."}
{"id":"r3-tooling-require-category-export-gates","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/tooling/policy-pack/repo-configs/src/eslint/RequireCategoryTagRule.ts","line":32,"symbol":"isExportedNode.exportGates","members":["isExportDeclarationNode","isExportedNode"],"reason":"Callable predicates/type guards, not co-carried Boolean values. Preserve callable contracts and runtime checks; exact declaration and consumer proof is in the audit table."}
{"id":"r3-tooling-opaque-schema-receiver-gates","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/tooling/policy-pack/lint-rules/src/rules/no-opaque-instance-fields.ts","line":79,"symbol":"isOpaqueCallee.receiverGates","members":["isEffectRootSchema","isSchemaReceiver"],"reason":"Callable predicates/type guards, not co-carried Boolean values. Preserve callable contracts and runtime checks; exact declaration and consumer proof is in the audit table."}
{"id":"r3-tooling-fsutils-stat-kind-gates","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/tooling/library/repo-utils/src/FsUtils.ts","line":298,"symbol":"FsUtils.statKind","members":["isDirectory","isFile"],"reason":"Effect-returning service methods, not Boolean fields; each stats its own path. Preserve both methods and service API."}
{"id":"r3-tooling-process-args-option-like","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/tooling/library/repo-utils/src/ProcessArgs.ts","line":95,"symbol":"ProcessArgs.optionLikeGates","members":["isOptionLike","isNotOptionLike"],"reason":"Callable predicates/type guards, not co-carried Boolean values. Preserve callable contracts and runtime checks; exact declaration and consumer proof is in the audit table."}
{"id":"r3-tooling-no-native-runtime-hotspot-paths","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/tooling/policy-pack/repo-configs/src/eslint/NoNativeRuntimeHotspots.ts","line":79,"symbol":"NoNativeRuntimeHotspots.pathGates","members":["isNoNativeRuntimeErrorFile","isNoNativeRuntimeExtraCheckHotspot"],"reason":"Callable predicates/type guards, not co-carried Boolean values. Preserve callable contracts and runtime checks; exact declaration and consumer proof is in the audit table."}
{"id":"r3-tooling-workspaces-pattern-gates","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/tooling/library/repo-utils/src/Workspaces.ts","line":37,"symbol":"Workspaces.patternGates","members":["isWorkspacePatternArray","isSafeWorkspacePattern"],"reason":"Callable predicates/type guards, not co-carried Boolean values. Preserve callable contracts and runtime checks; exact declaration and consumer proof is in the audit table."}
{"id":"r3-tooling-package-json-tools-issue-gates","action":"withdraw-ineligible","priorStatus":"disqualified","priorDisqualifier":"D1","file":"packages/tooling/library/repo-utils/src/schemas/PackageJsonTools.ts","line":40,"symbol":"PackageJsonTools.issueGates","members":["isStringRecord","isIssuePathSegmentObject"],"reason":"Callable predicates/type guards, not co-carried Boolean values. Preserve callable contracts and runtime checks; exact declaration and consumer proof is in the audit table."}
```

## Verification, source hashes, and limits

Graft discovery and exhaustive source occurrences preceded exact source reads.
Twenty-two source/test inputs were compared with `git show HEAD:<path>` and
matched frozen HEAD. Installed SDK declarations were read directly, with package
versions recorded above; they are local contract evidence, not a claim about
the latest upstream releases. No SDK installation, network query, package
command, test, service, or generator was run.

The proposed rows were checked for six unique IDs, nineteen NextConfig members,
complete concrete bag fields, and fifteen disjoint unique withdrawals (ten
support, five policy). Both frozen refs and all input hashes were verified.
Current inventory was read for duplicate checks only. Concurrent parent
integration may change its snapshot hash; this lane neither writes it nor
interprets that expected change as a source-pin change.

No canonical inventory/design/status, archived input, prior audit, source,
test, independent report/receipt, package file, or git state was changed by this
lane. No qualified omission was established. The devIndicators/logging footprint
question is explicitly left to parent adjudication with the full false/object
domains preserved. No additional independent correction was requested by this
lane and this P2 audit does not represent independent P3 design approval.

| Input file | SHA-256 |
| --- | --- |
| `packages/foundation/modeling/utils/src/Glob.ts` | `7df7185ed6c7bfd9e27affca38542fc814d2a9eeb48e168e243b299781550826` |
| `packages/tooling/library/codegen-kit/src/internal/postProcess.ts` | `dddc28fed4b014a1a6af29937e09608759219b7ac9a299f861eb918291dc53fe` |
| `packages/tooling/library/codegen-kit/src/internal/transforms.ts` | `a581bafbac1ab282f1bfb7dc692ddcf8085f5cd22fc9f9e1a17986ac38796c44` |
| `packages/tooling/library/repo-utils/src/FsUtils.ts` | `0a9a6dd51850bf5137ae79609e0916fb19a66f560d9c02e33c26e73940da6c3b` |
| `packages/tooling/library/repo-utils/src/ProcessArgs.ts` | `cffa73641746fa37e4c2301a464763a5a96cd3b177fb0066944708da10f0e3c1` |
| `packages/tooling/library/repo-utils/src/TSMorph/TSMorph.model.ts` | `643af82160e3dcd6cc8c3eb82a44871c166ecc0457479ad64f08fdad0a9c4834` |
| `packages/tooling/library/repo-utils/src/TSMorph/TSMorph.service.ts` | `183fac0bd7855a19754b952f9cf4c227c04bb84d23bef0bd2c3ceb20e2f81e74` |
| `packages/tooling/library/repo-utils/src/Workspaces.ts` | `3fd37151a18dd113af2609af790f1a04813375e8b1865c10f3b5f4c5a369c3b1` |
| `packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts` | `05cfd0d414d564faf9094a4d747b5e03a55e0709ee3d7af3be1a72528214e0d9` |
| `packages/tooling/library/repo-utils/src/schemas/PackageJsonTools.ts` | `b60b043311c1489eaf29dff8990eb96031fbd295ad562c790e9325ce8c37a98d` |
| `packages/tooling/library/repo-utils/src/schemas/TSConfig.ts` | `fd50a10ffff6b57e9a7ec4412739423bc5662fd90c39d10db88edacaccb324ba` |
| `packages/tooling/library/repo-utils/src/schemas/TsconfigAliasTargets.ts` | `02fc12379729c541532b6deea06157489c634d4f7c467e646460cbce6492ac84` |
| `packages/tooling/policy-pack/lint-rules/src/rules/no-global-process-runtime.ts` | `be819ba2fdea51a2158b61b7b96a7f437f86398b5f450fe39525c57fc25c00ad` |
| `packages/tooling/policy-pack/lint-rules/src/rules/no-js-extension-imports.ts` | `963664d67ac46838635e7eff38dedd88ad7e6cc87be9ed626545b0bd97b047cb` |
| `packages/tooling/policy-pack/lint-rules/src/rules/no-opaque-instance-fields.ts` | `90afaeee03d064e1da12ac8f3ce89ba4e9630937c2c9a98f8f3f2234c704c59b` |
| `packages/tooling/policy-pack/repo-configs/src/eslint/NoNativeRuntimeHotspots.ts` | `c09fc9ddd68c32476ce4fc53820657434633222ad84e8c0f5fa6f28c816c0c72` |
| `packages/tooling/policy-pack/repo-configs/src/eslint/RequireCategoryTagRule.ts` | `5afe231edbc84c985667ce4f86740bc2b59012592ad644c642f3bc22c428c529` |
| `packages/tooling/policy-pack/repo-configs/src/internal/eslint/EffectLawsAllowlistSchemas.ts` | `de664603134f0387314702b44fe0e78249c61e96c48c2ac32dcd14e7fdcd5a6c` |
| `packages/tooling/policy-pack/repo-configs/src/next/NextConfig.model.ts` | `d0ef3e2ea861ecfa7066e9abe8670dca0972dfaaeca1f817f1d38e04c1c415c6` |
| `packages/tooling/policy-pack/repo-configs/src/next/SharedNextConfig.model.ts` | `523a6a06bffaac0320189d423faa8f37b58a012a1d6d2d4081af489c316d1664` |
| `packages/tooling/test-kit/test-utils/src/SqlTest.ts` | `eb24d3f56dfb3c5bb59e624c06348f04c95b40220b7ba382fff6c8b1eca56699` |
| `packages/tooling/test-kit/test-utils/test/SqlTest.test.ts` | `297198d2afecd1a8eb4b96a60ff457b8e4faf53398e111ad4e989fd2ef2c26f4` |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/r28-tooling-library-support.jsonl` | `cd22df7ebb847355acff3683eb662847af8434ec3e951ffe18fbb304e6aa1ae2` |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/r28-tooling-library-support.execution.json` | `639d72c3d3dd61faa30ad4a6758cc0833272381106432be3aa2b77fb99ea3d0f` |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/r28-tooling-policy.jsonl` | `824177055c2f72686dd741c91b6397f15da355d57a7229fca064af44fdddf02b` |
| `goals/boolean-creep/data/sweeps/refresh-2026-09-09-r28-main-d1b4d7/r28-tooling-policy.execution.json` | `c30e618d5469efaabd6150a49dc974810a3d4f1a12395b016fcd18e38bbe84d3` |
| `node_modules/ts-morph/lib/ts-morph.d.ts` | `f5845a852a03600100175392ca764626cff5782f4d00d24300d82b8edaddeab9` |
| `node_modules/testcontainers/build/test-container.d.ts` | `3fa11202bf9ec72f55b09ae196089d606a4a219a1bdbaad7815526eaf28e9623` |
| `node_modules/jsonc-parser/lib/umd/main.d.ts` | `f1d603af05e59e26aae3d9fa7bb0138e744bfbfc9f4793ddeaabe5c85da1d30f` |
| `node_modules/next/dist/server/config-shared.d.ts` | `89777cfa58be98da8cccd014f5b63eae2af9eb9155e8c86e6af61f5873046f0d` |
