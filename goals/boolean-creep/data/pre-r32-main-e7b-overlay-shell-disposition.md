# Pre-R32 overlay and package-shell owner audit

Native **gpt-6-astra / xhigh** P2 source-forward work, bound to root HEAD `a942d7dab3a962963912247d4699b7986bcb9c03` and `origin/main` `e7b7d03e61bd5cddd74e89bb03ae10dbe06e067b`. Exact comparison base is main `284294ee24177f13f6d3a763c5d987206d351c51`. The original inventory has 751 rows / 145 qualified, SHA-256 `fc4a37c261318d37cc276315d7014c61410277c7802b38806b72ae3a9437fc13`.

**Result:** no new qualified application owner, no withdrawal, and no existing cardinality or status change. Propose one D2 record for the actual compilerOptions JSON output in the included Handlebars template. Three existing CreatePackage designs need complete but narrow source-baseline/test-citation refreshes. Their source owners and accepted semantics are unchanged; exact original rows and designs are preserved. No product files, canonical packet, index, refs, dependency inputs or old bundles were edited. The unresolved citation inheritance holds were not reopened.

## Actual corpus and source delta

The frozen R31 lane-map includes 3,051 files, including 61 non-TypeScript inputs. `CreatePackage/templates/tsconfig.check.json.hbs` is explicitly included at lane-map line 3123. It is an authored corpus input, not excluded generated output or an excluded test. Its emitted compiler configuration and its lack of a TypeScript data declaration are separate facts.

The complete primary files were read, after graft discovery and exact current/old source comparison:

- `packages/tooling/tool/cli/src/commands/Lint/TsconfigOverlay.ts:1-543`: expands reference-list linting, removes module/moduleResolution from the allowed compiler-option names, adds the references scope and required detail payload, chooses the canonical reference owner, and emits targeted remediation hints. It introduces no Boolean data fields.
- `packages/tooling/tool/cli/src/commands/Architecture/internal/PackageShell.ts:1-668`: only removes two lines from the generated check-tsconfig string (old 282-283); current helper 272-285 inherits module/moduleResolution from its base. Other source after that removal shifts by two lines. Its operation factories, role dispatch and full emitted payloads are unchanged.
- `packages/tooling/tool/cli/src/commands/CreatePackage/templates/tsconfig.check.json.hbs:1-13`: only removes the same two module override keys. It retains `$schema`, `extends`, initial empty references, five fixed compiler switches, full `rootRelative` interpolation and final newline.

Exact primary diffs are in `evidence/*.main-delta.patch`; full prior/current bytes and hashes are in `before/source/`, `inputs/` and `bindings.json`. Root's pre-existing merge receipt has an earlier packet HEAD but the same main source; this audit independently binds current owner bytes rather than treating that HEAD as current. The new CheckCensus and TsconfigSync owners are assigned to other agents. Cross-consumer references here document the existing call and observable result only.

## TsconfigOverlay: full eligibility before cardinality

| Actual declaration/scope | Complete relevant types and disposition |
| --- | --- |
| `TsconfigOverlayDocumentKey` 85-95 | Six literal **string key names**, not six Boolean fields. Remains a LiteralKit. No campaign row. |
| `TsconfigOverlayCompilerOptionKey` 138-150 | Eight literal string names. Six name compiler options with Boolean semantics, two name path outputs; this list itself carries strings and callable kit helpers. Do not reinterpret names as physical Boolean members. No row. |
| `TsconfigOverlayViolationScope` 189-193 | Three literal scopes: document, compilerOptions, references. It is already the schema-owned discriminator used by rendering. No Boolean axis is manufactured from scope equality. |
| `TsconfigOverlayViolation` 234-245 | Exact class fields: `file:string`, `scope:TsconfigOverlayViolationScope`, `key:string`, `detail:string`. No inherited fields and zero Boolean members. Preserve complete strings and the new required detail field. A hypothetical scope/key/detail correlation does not enter this campaign without a real Boolean cluster. |
| `TsconfigOverlayRawDocument` 249 | `S.Record(S.String,S.Unknown)`, intentionally open so unknown document/compiler keys can be diagnosed. Unknown values can contain Boolean values, but no Boolean-typed named member cluster is declared. Do not replace the raw request with the allowlist union and silently erase malformed input diagnostics. |
| `TsconfigReferenceList` 256-258 | Optional key containing an array of `{path:string}`. No Boolean. Missing key becomes an empty list in referencePathsOf 261-262; the full path/order/multiplicity payload remains material. |
| schema guards 251-253 and `isReferencesViolation` 450-451 | Callable Boolean predicates, not Boolean values stored in a data carrier. Out of the Boolean-owner net. |
| `violationsOf` 290-308 | Two actual arrays of structured findings; no named Boolean members. Do not manufacture flags from emptiness. Both arrays may contribute. |
| `referenceViolationOf` 312-335 | Full expected/actual string arrays and ownerName string; expectedSet/actualSet HashSets; `missing` and `extra` are required numeric counts; `reordered` is `", reordered" | ""` text. The zero-count tests at 325 are inline comparisons, not declared Boolean axes. Result is already `Option<TsconfigOverlayViolation>`. No 4/3 or count-predicate qualification. |
| `canonicalReferencePaths` 340-365 | Actual returned object `{ownerName:string, paths:ReadonlyArray<string>}`. Build-file and file-existence tests are transient expressions; no existence flags are stored with this result. Full path arrays and chosen owner name are preserved. |
| collector 394-435 | Returns the complete sorted finding array; record construction is at 297/305/328. `Effect.forEach` options only carry numeric concurrency. No state/Boolean tuple. |
| runner 479-521 | overlayCount is a number; violations/files/hints are arrays. Two inline `A.some` expressions at 498-499 choose string arrays; no named `hasAllowlistViolation`/`hasReferenceViolation` owner exists. Do not invent a 4/3 pair from those expressions or from hint-array membership. |
| command 539-543 | `Command.make("tsconfig-overlay",{},...)` has no option data fields; callback and command handle are not a Boolean owner. |

The exported violation `.make`/codec still supports arbitrary valid strings for `file`, `key` and `detail` with any of the three scopes. Current producers choose narrower specific strings; this audit does not reinterpret that observed image as permission to narrow the public model. The absence of Boolean fields is decisive before any such cardinality question.

## New lint behavior that must remain intact

`TsconfigOverlay.ts:247-258,290-308` retains JSONC object parsing and raw unknown keys for diagnostics, then independently decodes references as arrays of string-path structs. It does not impose TypeScript compiler-option Boolean value validation; its policy examines keys. Known malformed raw input is an input to the diagnostic process, not a supported successful compiler operation, and this audit neither erases it nor declares diagnostic shapes independent merely because a permissive schema accepts them.

At 351-364, an existing `tsconfig.build.json` owns references; otherwise `tsconfig.json` does. An absent selected canonical file supplies an empty reference list. It does not mean there is a synthetic absent/present Boolean+path carrier. Read/decode failures retain `TsconfigOverlayReadError` mappings with the original file context. Declaration 256 makes only a missing references key optional; do not add null acceptance or silently discard malformed path entries.

At 318-332 the primary comparison is exact and order-sensitive. Missing/extra diagnostics count distinct set differences; the full ordered lists remain the comparison operands. A non-equal list with no missing/extra set member gets the existing reordered suffix, including any multiplicity case the current algorithm classifies that way. Do not deduplicate or sort the operands, change duplicate behavior, normalize paths, or change the detail string as an incidental schema refactor.

The collector scans apps/infra/packages in the existing traversal order and prunes fixture/build locations through `WorkspaceWalk`. Concurrency remains one. Findings sort by file/scope/key. The runner emits allowlist and reference hints independently, both when needed, then the same re-check hint and typed exit 1. A successful run emits the exact overlay-count line. The nonempty-array guard, equivalence decision, owner selection and raw decode errors are actual necessary policy/diagnostic guards; no campaign deletion credit is claimed for them.

Current proof fixtures in `test/lint-tsconfig-overlay.test.ts`:

- 129-150: matching references, reference-free absent canonical file, and fixture/node_modules exclusion.
- 152-182: all five rejected allowlist keys, including both removed module overrides, and only the allowlist hint.
- 184-220: missing references, omitted references key and extra references; exact owner-count/detail strings and only the sync hint.
- 222-258: combined allowlist/reference findings with deterministic ordering.
- 260-293: build-tsconfig ownership takes precedence over canonical tsconfig.
- 295-318: reversed references remain drift with reordered detail.
- 320-335: malformed JSONC fails.

These tests were read, not executed. No new product test or runtime behavior is claimed.

Exports/readers: `Lint/index.ts:127-135` exports the collector, runner, command and schema kits/class. `Lint.command.ts:43,1067` registers the command. The test imports its real collector. CLI package.json exports `/commands/Lint` and the general command source/dist pattern; no external consumers are claimed searched. `Lint.errors.ts:198-240` carries the typed read error. Exact repository searches supplement graft's nonexhaustive graph edges.

## PackageShell: actual values versus emitted text

The full module exports four typed factories: `packageShellTargetFor` 38-45, dual `packageShellRolePlanFor` 75-87, dual `shellPackageJsonOperationFor` 196-214, and dual `packageShellFileOperationsFor` 448-668. Their direct parameter contracts are the target's complete five string/literal fields and the seven-value package-role domain, not function flags. The module preserves both curried and uncurried signatures.

The actual schema owners in `Architecture.schemas.ts` have no hidden inherited Booleans:

- `ArchitecturePlanTarget:526-537`: boundedContext, concept, domainKind, conceptPath, stage; strings and existing literal domains.
- `ArchitectureSliceRolePlan:493-503`: role, packageName, path and full exports string array.
- `WriteFileOperation:561-577`: kind, operationId, role, path, writeMode, conflictPolicy, operationSource, writer, **content:string**, description. Default-bearing operation fields are strings/literals, not flags.
- `WritePackageJsonOperation:605-625`: kind, operationId, role, path, writeMode, conflictPolicy, operationSource, packageName, packageDescription, repositoryDirectory, exports, dependencies, devDependencies and description; full string payloads/records, no Boolean fields.

The surrounding operation plan at 801-839 contains a schemaVersion, target, roles array and operations array plus a string-only legacy slice getter. Branch dispatch or deriving a role/path does not create a Boolean member.

All auxiliary factories return complete strings, arrays or string records: seven-role export mapping 47-55, descriptions 89-98, dependencies 100-164, devDependencies 166-176; docs/config/source string generators 216-428; ten common file operations 453-534; domain/use-cases/config/server/tables additions 536-664; client/ui retain the common list. Exact export order, dependencies, names, full paths/descriptions, file bytes, writer kinds and newline values are unchanged. Callable literal matches and `if (role===...)` predicates are not data flags.

The compiler switches at `packageShellTestTsconfigContent:254-270` and `packageShellCheckTsconfigContent:272-285` are inside **string literals**. They describe external TypeScript output, but are not TypeScript Boolean fields on those functions or `WriteFileOperation`. No synthetic nested `packageShellCheckTsconfigContent.compilerOptions` owner is admitted. If the eventual emitted JSON is evaluated as a configuration carrier, its flat compiler keys are an external D2 contract; that semantic fact does not require inventing a second TypeScript owner or qualified design. The authored template below is the concrete JSON template surface proposed for D2 metadata.

Writer/consumer preservation: `Architecture.plan.ts:331-350` builds the shell-only plan, applies operation metadata through 66-91, and stores the exact operations. `OperationPlanExecution.ts:65-69` returns write-file content verbatim, and 79-128 preserves the fail-on-differing-file, skip-identical and write-if-missing behavior; 280-323 dispatches the operation sequence. It does not parse compiler JSON or sync reference lists. Do not claim PackageShell itself runs TsconfigSync. `Architecture.command.ts:106-124` builds/prints/reads encoded plans, and the public Architecture barrel exports plan/schema/execution modules. `test/architecture-operation-plan.test.ts:569-600,602-657,659-711` exercises shell plan encode/decode, role-specific exports and repeated apply/no-op behavior; it does not newly assert removed check-overlay fields. All values and behavior stay unchanged here.

## Included Handlebars output and one D2 proposal

The full authored template is a JSON configuration document whose nested `compilerOptions` contains five physical Boolean output keys: composite=false, declaration=false, declarationMap=false, incremental=false, noEmit=true; rootDir is `{{rootRelative}}.`. These are TypeScript compiler configuration fields, not a status machine. Preserve them exactly, including all path text, inherited module semantics, references initialization and formatting. A fixed emitted setting tuple does not establish 32/1 application-domain illegality for other compiler settings.

`proposals/new-rows.jsonl` proposes `r32-cli-create-package-check-overlay-compiler-options`, kind object-literal, symbol compilerOptions, line 5, D2. This records the actual authored JSON-template output as an external configuration mirror. It does not classify the .hbs file as excluded, assert a TypeScript class there, or invent an application Boolean cluster. There is no new qualified record or design for this output.

The template is selected at `CreatePackage.command.ts:337-338,388` and through the existing shape selector; `TemplateRenderRequest` at 1508-1513 carries the chosen template and the actual context. Its generic public schema in `TemplateService.ts:120-132` has string templateDir, TemplateSpec array and a defaulted open unknown record, not named Boolean flags. Rendering at 223-238 compiles with **noEscape:true** and returns outputPath/content strings. The full root-relative interpolation must remain unescaped and byte-preserved. The earlier TemplateContext design's phrase “HTML escaping” was contradicted by this exact source and is corrected in the private replacement; no renderer behavior changes.

CreatePackage materializes the plan and formats it at 1589-1591, registers workspace/identity at 1593-1596, then calls `syncTsconfigAtRoot` at 1597-1601. The initial empty reference array is therefore distinct from final post-sync output. Current ordinary-package and service-app fixtures (`create-package.test.ts:735-747,1065-1077`) and lab fixtures (`create-package-lab.test.ts:453-463`) prove exact owner-reference equality and absence of both module override keys. Missing owner references stay an empty list. The caller's sync mode/filter/verbose inputs and ordering before retired-name clearing/lockfile refresh stay exact. New TsconfigSync implementation ownership remains with the other agent.

## Existing instance retention and three complete design updates

There are zero direct current inventory rows for either primary TypeScript file or the Handlebars template, and zero direct canonical design text hits for those paths. The changed template and test output nevertheless affect these three existing CreatePackage designs:

| Stable ID | Source anchor and accepted count | Parent action |
| --- | --- | --- |
| create-package-template-type-flags | TemplateContext at command738; 1,658,880/31, derived/internal | Retain exact row; install complete updated design baseline/citations and explicit noEscape:true preservation. |
| create-package-scaffold-shape | ScaffoldShape at command481; 24/11, stored/internal | Retain exact row; install complete design with current overlay-output obligations and shifted fixtures. |
| create-package-retired-name-reconciliation | command1399 local values; 4/3, derived/internal | Retain exact row; install complete design preserving sync before retirement clearing and shifted lab fixtures. |

The complete CreatePackage command, retired-name helper and canonical script helper source are byte-identical to their prior d68 binding and to main284. No qualification, full legal set, payload family, raw request gate, public helper contract, encoding, target taxonomy, guard deletion or landing tier changes. Exact original full designs are in `before/designs/`; replacements are in `proposals/designs/`. They retain all eight sections and their complete earlier consumer/fixture maps. Test locators were moved only through verified equal-line mappings; the added fixtures are separately cited. Repeated main-delta text is supporting behavior preservation, not source implementation credit.

Two additional existing command rows have unchanged source in this narrow impact review: `r26-cli-commands-a-c-create-package-execute-mutation-flags` at1593 and `r27-cli-commands-a-c-ecosystem-package-json-flags` at1705. Preserve their exact row bytes; this task does not independently re-adjudicate their earlier classifications. The three exact Q rows are offered in `proposals/retained-rows.jsonl` only to bind the replacement designs; they are not duplicate admissions.

No current row/design is withdrawn. No related old citation hold is touched. A full future application must retain the external JSON/output behavior and all actual policy guards; no fabricated required-payload or count axes are introduced to create extra campaign work.

## Validation and ownership

Only private files in this fresh bundle are authored. `validation.json` records schema validation of the one D2 proposal and three retained Q rows, all three eight-section design checks, exact unchanged-row comparisons, and source-mapped fixture citations. `ending.json` binds ending HEAD/main, source/dependency/fixture inputs, canonical designs/inventory and logical index/status. The old and new primary source bytes and the complete supporting fixtures are sealed by `MANIFEST.json`.

No product tests, model lanes, services, dependency operations, explicit graft build/index/restore, generated output or Git mutation ran. Ordinary graft retrieval refreshed its own permitted cache; seven calls reported approximately 93,962 tokens saved. The first skeleton invocation also had a harmless mistyped trailing command that exited127; its skeleton result succeeded and no mutation followed. One guessed Architecture.service filename was absent and the actual OperationPlanExecution module was located via graft. Exact successful source reads and bindings, rather than those failed probes, support this handoff.

This is a bounded native P2 source-forward audit, not a census, dry round, independent P3 approval or implementation completion. The parent owns review and canonical integration; the source hold may be released after the bundle is sealed.
