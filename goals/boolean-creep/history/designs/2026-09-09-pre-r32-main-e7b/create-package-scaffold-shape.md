# create-package-scaffold-shape

Native P2 source/design refresh before R31, bound to merged source HEAD
`4509872869eb87071250c67717769260f850bcf5` / main
`d68f1a11dd41579660a6c72f3d3e060d6b61352d`. This preserves status `designed`
and cardinality 24/11. Tier 1: ordered Tier1E tooling batches with serial shared-file edits.
Independent P3 review and implementation acceptance remain pending.

Owner `ScaffoldShape` at `packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts:481`,
with members `appKind`, `lab`, `withStoriesTsconfig`.
Storage/exposure: stored/internal; target: literalkit.

The prior public [source-impact audit](../data/pre-r29-main-4f13d8-source-impact.md),
[source bindings](../data/pre-r29-main-4f13d8-source-bindings.json), and
[row/design map](../data/pre-r29-main-4f13d8-row-design-map.json) preserve the earlier baseline.
The [exact original design](../history/designs/2026-09-09-pre-r29-main-4f13d8/create-package-scaffold-shape.md) is preserved.
Keep complete decoded exports, typed request diagnostics, public constructor and
helper input domains, encoded keys/defaults/omission and full independent payloads
as specified below. Paths beginning `src/` or `test/` are relative to
`packages/tooling/tool/cli/` unless the design states otherwise.

Unqualified product line references below refer to
`packages/tooling/tool/cli/src/commands/CreatePackage/CreatePackage.command.ts`.

## Current shape

The private `ScaffoldShape` class stores `appKind` as an Option of the
five AppKind literals, plus Boolean lab and stories controls at 481-483.
One `.make` call at 1417 creates the resolved operation selector after
the raw CLI validation. Private readers repeatedly reconstruct its mode
from the Option, kind equality checks and Boolean branches.

The app-kind flag defaults to an empty string and becomes explicit None
or Some at 1215-1217. The lab/stories CLI flags default false. The class
itself applies no Boolean or explicit None constructor defaults, and the
actual writer supplies all three decoded values. OptionFromOptionalKey
uses missing-key/None encoding; it does not make null a decoded app-kind
value. The complete owner contains no other payload fields.

Raw CLI flags and their exact typed diagnostics precede this allocation.
The excluded anonymous handler parameter bag is not the target of this
design; the actual resolved schema is. Preserve those diagnostics and
defaults even while the new schema makes invalid resolved states impossible.

## Cardinality gap

Six decoded app-kind states × two lab values × two stories values =
24 representable shapes. Eleven are supported:

| Literal | appKind | lab | stories |
| --- | --- | --- | --- |
| package | None | false | false |
| package-with-stories | None | false | true |
| nextjs | Some(nextjs) | false | false |
| nextjs-lab | Some(nextjs) | true | false |
| vite | Some(vite) | false | false |
| vite-lab | Some(vite) | true | false |
| service | Some(service) | false | false |
| service-lab | Some(service) | true | false |
| tauri | Some(tauri) | false | false |
| tauri-lab | Some(tauri) | true | false |
| runtime-proof | Some(runtime-proof) | false | false |

At 1220-1224, lab validation requires an app, excludes runtime-proof,
and preserves the parent/description conditions. At 1322-1334 stories
requires a foundation/ui-system library. The earlier type/app-kind gates
at 1190-1217 imply stories can only have None appKind and lab false.
The only constructor at 1417 is downstream of those gates.

The old lab/stories pair is not independent; it is also not the complete
cluster. Expand the existing id to all three real members and preserve
all five Some literals. No required array/count/payload becomes a Boolean
axis, and no second narrow pair record is needed.

## Target schema

Replace the private class with one private annotated payload-free
`ScaffoldShape` LiteralKit using the eleven literals in the table. Reuse
the existing `LiteralKit` import at 21, `$I` identity composer at 60,
and local annotation pattern already used by AppKind at 227-231.
Do not wrap a payload-free mode in a new S.Class or hand-write a string union.

At the current allocation point, choose the literal directly from the
already validated facts. None appKind selects package or package-with-stories.
Runtime-proof selects its one case. Each of the four real app kinds
selects its normal or lab case. Use the existing AppKind helpers and
exhaustive matching; do not create another raw three-field input schema or
an object of Boolean getters. Preserve the existing order and wording of
all guards before choosing the mode.

Convert the shape readers to literal-based dispatch. The final selector is
still one immutable local operation value; no new atom, service or stored
cache is introduced. Keep `PackageType`, `AppKind`, family/kind metadata
and the raw CLI values for their existing other readers, including the
separately owned exported TemplateContext. Do not narrow those broader
interfaces as a side effect of changing this private mode.

Reuse all existing template/file/directory constants and all existing app
manifest builders. The new mode selects the correct builder and supplies
its existing single `lab` field as a known true/false value for that case.
That builder input is a separate existing one-Boolean payload contract;
do not rebuild the old three correlated fields as a compatibility object.

## Migration inventory

The current pre-R31 output baseline is main d68. The command's bed30-to-d68
change only expands a compiler comment at `CreatePackage.command.ts:1828-1831`;
all three owner declarations, validation gates and constructors are unchanged.
The shared defaults at
`src/internal/package-scripts/PackageScripts.schemas.ts:1250-1254,1271-1275`
now give app and lab `beep:check` exactly `tsgo -p tsconfig.check.json`.
Continue delegating to `scaffoldPackageScripts` at `:1351-1374`, including its
full kind/optional-task contracts and sorted output; do not restore the former
redundant `tsc -p tsconfig.json --noEmit` suffix. Preserve the separate stories
check override and `tsc -p tsconfig.stories.json --noEmit` implementation at
`CreatePackage.command.ts:1938-1943`, every arbitrary helper payload, and the
CLI's narrower admission rules. Current script and manifest fixtures at
`test/create-package.test.ts:236,258,311,982,1037,1074` and the policy fixture at
`test/package-scripts.policy.test.ts:127` assert this upstream output baseline.
Their preservation earns no Boolean-guard deletion or implementation credit.

The post-merge script writers are an explicit compatibility boundary.
`appBaseScripts` at CreatePackage.command.ts:1772-1777 delegates to the canonical
`scaffoldPackageScripts(lab ? "lab" : "app", [])`, then overlays the full caller
`dev` and `beep:build` strings; only nonlabs receive coverage. The four real-app
builders at 1835-1905 retain their start/Tauri/dependency overlays. Preserve
this call to the existing package-scripts module instead of copying its table.

`packageScripts` at 1927-1946 accepts every nonlab `ScriptsPackageKind`, full
`rootRelative` and `packagePath` strings, and either stories value. It requests
exactly `["lint:fix", "test:integration", "docgen"]` from the canonical helper,
then applies Babel, check-tests, policy and coverage overlays. Stories true
additionally overrides `beep:check` and supplies `beep:check:stories`; false
leaves the canonical kind-specific check intact. Direct exported helper calls
have no ScaffoldShape admission gate. Preserve those signatures and all
supported kind/stories combinations even where raw CLI validation is narrower.
Do not delete the public helpers or their Boolean parameters as guard credit.

The actual command branch at 2016-2040 selects scripts kind in this order:
ecosystem metadata, remaining Some(appKind), tool, then library. A runtime-proof
case falls through the dedicated app builders, uses the package-shaped manifest,
and selects the canonical **app** script kind. Real apps/labs retain their
dedicated builder path. Preserve this distinction, the ecosystem peer payload,
full separate type/family/kind metadata, canonical encoder and trailing newline.

| Source | Required change or preserved boundary |
| --- | --- |
| 136-137,218-241 | Keep PackageType/AppKind source domains and decoders; reuse their helpers for classification. |
| 479-488 | Replace the three-field private class with the eleven-value annotated LiteralKit and inferred type. |
| 490-511 | Replace package stories checks and app-kind/lab template branching with mode dispatch over existing ordered template constants. Retire helpers that only re-expand the old flags once their callers migrate. |
| 515-521 | Select existing Tauri assets for tauri and tauri-lab; every other mode yields the same empty asset list. |
| 642-662 | Dispatch file lists by mode; preserve stories additions and append the lab manifest path after the same lab-specific base list. |
| 685-701 | Dispatch directory lists by mode; normal/lab app variants share existing lists where appropriate. Runtime-proof keeps package directories. |
| 959-986,1190-1414 | Preserve all raw CLI validation, error ordering, defaults, parent/name/retired-name/workspace checks and messages before allocation. These are not deleted by the private-mode refactor. |
| 1417 | Construct one literal at the same point; no moved I/O or error gates. |
| 1455-1467,1613-1618 | Preserve dry-run and final file-list ordering/text; both consume the migrated filesFor selector. |
| 1479-1504 | Keep exported TemplateContext payload and its existing independently tracked campaign scope unchanged. |
| 1508-1513 | Pass the migrated ordered template selector result and complete existing context to TemplateRenderRequest. |
| 1539-1548 | Pass the new shape literal to generatePackageJson with the same full separate payload arguments. |
| 1549-1586 | Preserve lab manifest creation, gitkeep files, directories, rendered files, assets, symlink, output paths and order in the file plan. Only existing shape selector calls change. |
| 1755-1919,1927-1966,1993-2075 | Replace shape destructuring/Option app-manifest dispatch with mode selection of the existing app builders; keep lab values case-specific. Package and runtime-proof keep package manifest generation; stories only selects the existing stories script variant. Preserve canonical encoder and newline. |

The complete direct reader set is templateSpecsFor, assetSpecsFor, filesFor,
directoriesFor and generatePackageJson, plus their private helper functions.
Only one actual constructor exists. Exact source and test searches found
no other shape use; the graph's missing class edges were not treated as
absence evidence. ScaffoldShape and its five selector/generator consumers remain private.
The public `CreatePackageScripts` object at 1963-1966 additionally exposes
`appBaseScripts` and `packageScripts` through CreatePackage/index.ts:14.
The barrel therefore exports the command, resolver, TemplateContext and
CreatePackageScripts. Public command runners continue accepting argv with
existing flags; public script-helper callers keep their separate signatures.

## Guard-deletion accounting

Delete the stored `appKind`, `lab` and `withStoriesTsconfig` fields from
this private schema. Delete shape-field reconstruction in the template
selector at 496-509, the file selector at 646-661, the directory selector
at 690-698, and manifest destructuring at 2004. Replace the shape's Option
presence/kind-plus-Boolean decision walls with exhaustive literal cases.

At 515-521 replace the Option filter/map/fallback asset wall with the
two known Tauri mode cases. In manifest selection at 2007-2014, replace
the Option app-builder probe and branch with mode dispatch, preserving
the same app builders and package fallback. Remove appManifestBuilderFor
only if its single migrated caller is gone; retain AppKind helpers used
elsewhere. The exported `CreatePackageScripts.package` stories parameter remains a
supported public Boolean input. Internal resolved callers may supply known
case constants, but must not remove or narrow the exported parameter or
recreate the three-field shape bag. The public app helper likewise retains
its separate scalar lab parameter.

The raw lab/stories CLI guards remain necessary to produce their specified
diagnostics and occur before the operation value exists. No such guard is
claimed as deleted. The concrete removal is the parallel private fields
and repeated runtime reconstruction across all actual shape readers.

## Encoded-side impact

Generated-output equivalence is against current main `d68f1a11`, including its
canonical lint task scripts and removed codegen placeholders. Do not restore
pre-merge script tables. Keep tool-specific omission of the optional public
integration task, lab omissions, runtime-proof app-kind script semantics and
stories overrides. The public helper itself returns script records before the
package manifest encoder; both that decoded record API and the final encoded
package.json output must remain equivalent.

The old schema has a potential optional-key encoding, but no actual
decoder, encoder, persisted fixture, public schema export or external
constructor consumes it. Do not add an unused compatibility codec.
The private mode itself remains in-memory and is never serialized.

Generated artifacts are observable and must remain equivalent: ordered
templates, complete rendered content, file/directory paths, static Tauri
assets, CLAUDE.md symlink target, lab manifests, portless labels/scripts,
package manifests, source/export maps, metadata, dependencies and final
newlines. Preserve the existing canonical package JSON and lab-manifest
encoders. Preserve package-like runtime-proof output even though it was
requested with `--type app`, and preserve distinct lab package scripts.

Keep external command defaults and invalid-input diagnostics unchanged.
No narrowing of raw argv is justified by the eleven-state resolved mode.
The ordinary package case still carries its library/tool/family distinctions
through the existing separate inputs; those are not discarded by the mode.

## Test impact

Retain the new direct exported-helper fixtures at
`create-package.test.ts:274-332`: library/ecosystem and tool output, stories,
Next.js/Tauri/service apps and labs use complete equality assertions. Keep
`create-package.test.ts:652-681` tool creation and its platform-node dependency,
the exact app manifest comparisons at 829/892, and runtime-proof's app-kind
script overrides at 1069-1078. Extend direct helper coverage, if a shared writer
is touched, to all currently accepted nonlab kinds with both stories values
and arbitrary full string arguments; these are wider than the private eleven
ScaffoldShape cases and must not be filtered through that schema.

The existing CLI fixtures cover all eleven legal modes: ordinary package
at `create-package.test.ts:683-733`; stories package and dry-run at
1154-1219; Next.js, Tauri, Vite and service normal variants at 807-1044;
runtime-proof at 1047-1095; four corresponding lab fixtures at
`create-package-lab.test.ts:401-410,479-488,533-542,607-616` with their
subsequent output assertions. Keep their complete manifest/file/config
assertions and the existing lab no-ceremony, identity and root-workspace
behavior.

Add focused selector coverage for the eleven mode rows, preserving exact
ordered outputs and rejecting unknown mode literals. Retain raw CLI
refusal fixtures for missing app kind, stories outside foundation/ui-system,
lab on a non-app, lab runtime-proof, parent override and missing description.
Keep dry-run nonmutation, retired-name authorization, lockfile defaults,
existing-directory refusal and asset preservation scenarios.

Exercise private selectors through the existing command fixture surface or
local type checks; do not export the private mode/helpers solely for tests.

Implementation requires relevant focused CreatePackage checks and full
`@beep/repo-cli` package verification. This P2 audit runs no product commands
or tests. The change is a CLI planning model with unchanged generated UI
bytes, not a new gesture-bearing UI milestone.

## Risk

Implement in the ordered Tier 1E subsystem batch after independent P3
review and packet ratification. Coordinate shared CreatePackage edits serially. The largest risks are changing ordered template/file output,
losing lab-specific manifest behavior, treating runtime-proof as a real app,
moving validation past allocation or removing required raw diagnostics.
Reuse the existing constants/builders/encoders and preserve all external
payloads and side-effect sequencing.

The integration promotes the existing stable id from its false D1 note to
the complete 24/11 cluster, with exact historical row bytes preserved.
No narrow lab/stories duplicate is admitted. The separately exported
TemplateContext has its own full-owner audit; its fields and migration are
not absorbed by this design. Independent P3 approval remains pending.
