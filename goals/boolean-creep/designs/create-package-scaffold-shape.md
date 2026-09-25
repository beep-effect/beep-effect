# create-package-scaffold-shape

P2 refresh at `0be1f13d62fa00cb65e34ff69ec99043380f8d81`, 2026-09-22.
Private resolved owner, Tier1 tooling batch; independent P3 and GATE2 pending.
Source line references below name
`packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts`
unless otherwise stated.

## Current shape

Private ScaffoldShape479-488 stores appKind: Option<AppKind>, lab:Boolean and
withStoriesTsconfig:Boolean. AppKind has five values: nextjs, vite, service,
tauri, runtime-proof. None is a sixth decoded appKind value, not null. The
class has no own constructor defaults; the single writer1417 supplies all three
values after raw CLI admission. CLI flags1112-1162 default app kind to empty
string and lab/stories false; appKind1215-1217 translates empty to None.

Consumers are templateSpecsFor504, assetSpecsFor515, filesFor654,
directoriesFor688 and generatePackageJson1987 onward, plus private selector
helpers. Graft finds the declaration, sole allocation and all shape signatures;
source inspection confirms private visibility. The raw handler facts and
separately exported TemplateContext are not this owner.

## Cardinality gap

Six appKind states times two lab values times two stories values =24.
Type/app-kind guards1190-1217, labFlagRefusal959-986 called1220-1224, and
stories admission1322-1334 admit exactly11 modes:

| Mode | appKind | lab | stories |
| --- | --- | --- | --- |
| package | None | false | false |
| package-with-stories | None | false | true |
| nextjs | nextjs | false | false |
| nextjs-lab | nextjs | true | false |
| vite | vite | false | false |
| vite-lab | vite | true | false |
| service | service | false | false |
| service-lab | service | true | false |
| tauri | tauri | false | false |
| tauri-lab | tauri | true | false |
| runtime-proof | runtime-proof | false | false |

Lab requires a real app, prohibits runtime-proof, parent override and blank
trimmed description. Stories requires library/foundation/ui-system; the earlier
type/app-kind gates therefore force None and nonlab. All11 modes can satisfy
remaining names/path/metadata validations. Those complete payload domains stay
outside this mode projection. This is24/11, not a two-Boolean pair or a presence-
only app-kind projection. No duplicate TemplateContext qualification credit.

## Target schema

Replace the three-field private class with an annotated eleven-value LiteralKit
and inferred runtime type. Keep it payload-free; no redundant class or explicit
string-union type. Reuse existing LiteralKit/AppKind helpers and identity
composer. Use the repo's annotated LiteralKit helper pattern so literal helper
statics remain available. Choose the one literal at1417 from already validated
facts through exhaustive AppKind matching and Option matching; no new raw bag,
Boolean getters or second correlated domain is introduced.

Dispatch all private shape consumers on the literal. Reuse ordered template,
file, directory and asset constants. Call the existing app manifest builders
with case-specific true/false lab arguments: their one-Boolean input is a
separate contract, not a reconstructed three-field shape. Package and stories
cases keep separate type/family/kind metadata; runtime-proof retains package
layout while choosing app scripts. Do not narrow raw CLI flags, exported
TemplateContext or CreatePackageScripts to the private11-state domain.

## Migration inventory

Replace declaration479-488 and sole writer1417. Migrate packageTemplateSpecsFor
490, appTemplateSpecsFor495 and templateSpecsFor504; assetSpecsFor515 selects
only the two Tauri modes. Migrate packageFilesFor642/appFilesFor645/filesFor654
and packageDirectoriesFor685/directoriesFor688. Eliminate helpers whose sole
purpose becomes reconstructing flags, without duplicating their arrays.

Preserve this mode/output matrix through existing constants:

- Package uses PACKAGE_TEMPLATE_SPECS, PACKAGE_FILES and PACKAGE_DIRECTORIES.
  Stories appends STORIES_TEMPLATE_SPECS/STORIES_TSCONFIG_FILES/STORIES_DIRECTORIES
  in their current order and selects the stories script override.
- Next.js uses ordinary or lab-specific template/file constants; both use
  NEXTJS_APP_DIRECTORIES. Lab adds LAB_EXTRA_FILES after the base file list.
- Vite lab appends VITE_LAB_POSTCSS_TEMPLATE_SPEC and VITE_LAB_POSTCSS_FILE;
  both modes use VITE_APP_DIRECTORIES. Lab extras remain last.
- Service and Tauri use their existing app templates/files/directories for both
  modes, plus lab extras for labs. Only Tauri modes carry TAURI_APP_ASSET_SPECS.
- Runtime-proof uses package templates/files/directories and package manifests,
  never a real-app manifest or lab asset/manifest. Its scripts kind is app.

Manifest generation1987 onward receives the same separate name, type,
description, packagePath, metadata, portlessLabel and ecosystem peer payload.
Replace shape destructuring1998 and Option builder probe2001-2005 with case
selection of existing nextjs/vite/service/tauri builders1835-1905. Preserve
base manifests, every dependency map, portless label/string and canonical
encoder1922-1923 with trailing newline. Package fallback script-kind precedence
2014-2025 stays ecosystem metadata, runtime-proof app, tool, library. Keep
Ecosystem-specific manifest generation and all package export/files metadata.
Do not classify runtime-proof as ordinary library merely because layout matches.

Preserve current exported helper boundaries1957-1960:
`CreatePackageScripts.app(dev, build, lab)` accepts arbitrary full dev/build
strings and either lab value. It delegates1772-1777 to canonical
scaffoldPackageScripts(lab ? lab : app, []) and only nonlabs get coverage.
`CreatePackageScripts.package(kind, withStoriesTsconfig)` at1927-1939 accepts
all nonlab ScriptsPackageKind values and either stories value. Direct callers
have no raw CLI stories admission gate. Preserve that broader domain.
**Current main removed rootRelative/packagePath helper arguments and the
beep:policy overlay. Do not restore the older four-argument API.**
The canonical helper1351-1374 in internal/package-scripts/PackageScripts.schemas.ts
keeps task selection, referenced implementations and sorted records. Package
helper requests lint:fix/test:integration/docgen, then Babel/check-tests/coverage
and optional stories checks. Current canonical audits invoke lint:laws rather
than beep:policy. App/lab check remains tsgo -p tsconfig.check.json; stories
adds its separate tsc check. No copied script table.

Keep validation1190-1414 and raw defaults/error ordering unchanged. Mode
allocation does not move earlier or defer a refusal. Dry-run and final summaries
1455-1467/1613-1618 continue using ordered filesFor. TemplateContext allocation
1479-1504 remains separately owned, with all unrelated paths/strings/profiles.
TemplateRenderRequest1508-1513 receives mode-selected templates and complete
context. File plan1539-1586 preserves package.json then rendered files, gitkeep,
lab manifest ordering, directories, assets and CLAUDE.md→AGENTS.md symlink.
Keep execution, formatting, workspace/identity registration, syncTsconfigAtRoot
1597-1601, retired-name clearing and lockfile refresh in current order.

Tsconfig check template keeps current compiler switches/rootRelative and omits
module/moduleResolution overrides. Root sync mirrors owner project references;
missing references mean empty list. Do not revert upstream output while changing
only the selector. Existing Command uses current Argument.String/Flag.String/
Flag.Boolean RC APIs; no API downgrade. Tests now use effect/unstable/arbitrary.

## Guard-deletion accounting

Remove all three stored shape fields and repeated reconstruction in template,
asset, file, directory and manifest consumers. Eliminate their Option-kind-
Boolean decision walls in favor of exhaustive literal dispatch. Retire
appManifestBuilderFor1908 only if its sole migrated caller disappears; preserve
other AppKind consumers and raw CLI facts.

Raw diagnostic guards stay before allocation and receive no deletion credit.
Exported app/package helper Booleans also stay; private modes supply known case
values. Do not count TemplateContext fields or its separate writer as removed
by this design. No codec wall is added for an unused private encoding.

## Encoded-side impact

ScaffoldShape is private in-memory selection with no decoder/encoder/persisted
fixture/public constructor found. Its possible optional-key encoding is not a
reason to add a compatibility codec. Observable generated outputs remain exact:
ordered files/templates/directories/assets, rendered content, manifests and
scripts, full path strings, dependencies, exports, lab metadata, identity/workspace
registration, symlink target and final newlines. Preserve package-like
runtime-proof and existing separate metadata payload. All CLI input diagnostics,
defaults and side-effect order remain current-main behavior.

## Test impact

Exercise all11 modes through existing command fixtures or private local type
checks, without exporting selectors only for tests. Existing ordinary/stories,
four normal apps, runtime-proof1082-1129 and four labs provide baseline fixtures.
Retain full output checks and add focused exact ordered selector comparisons.
Unknown literal modes fail schema validation. Preserve raw refusals: missing/
invalid app kind, stories outside foundation/ui-system, lab non-app/runtime-proof,
parent override, missing description, retired-name and directory refusals.
Keep dry-run nonmutation, lockfile defaults and asset preservation scenarios.

Direct exported helper tests create-package.test.ts282 onward exercise current
2-argument package API. Preserve tool omission of optional public integration
task and app/lab differences. If writers change, extend all accepted nonlab kinds
across both stories values independently of CLI reachability, and app arbitrary
full dev/build strings with both lab values. Current runtime-proof fixture checks
app script overrides, docgen, package exports/src/index.ts and root identity paths.
Preserve tsconfig reference equality and module override absences in package,
service and lab fixtures. Use existing fixture temporary roots; no new workspace
package is needed merely for P2 proof.

Implementation requires focused CreatePackage suites and full
`bun run beep quality package-verify @beep/repo-cli`, then campaign/Yeet gates.
This audit performs source/diff inspection and finite enumeration only; no product
commands, runtime implementation or package proof claimed.

## Risk

Main risks are restoring stale scripts/helper signatures, losing ordered lab
extras, treating runtime-proof as a real app or library-script case, narrowing
public helpers to CLI admission, and moving refusals across allocation/I/O.
Reuse constants/builders/encoders and preserve complete separate payload.
Coordinate shared CreatePackage changes serially with the TemplateContext owner;
this P2 remains one private owner24/11, not independent P3 or implementation.
