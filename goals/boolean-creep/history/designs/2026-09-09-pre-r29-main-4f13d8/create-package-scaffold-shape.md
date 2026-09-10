# Design: create-package-scaffold-shape

Current P2 design at source `93217d998f851e2e93d9864e2b5315552eaa58a7`,
main `d1b4d769fbaffddd55717f3b1ba461897dd545c5`. Actual private owner ScaffoldShape;
24 representable /11 legal, stored/internal, Tier1E subsystem batch.
The source audit and successful bounded A-C correction are bound by
`data/r28-cli-a-c-integration.json`. This supplies no independent P3 approval;
replacement review and merged packet ratification remain required.
All product citations below refer to CreatePackage.command.ts unless stated.

## Current shape

The private `ScaffoldShape` class stores `appKind` as an Option of the
five AppKind literals, plus Boolean lab and stories controls at 479-481.
One `.make` call at 1415 creates the resolved operation selector after
the raw CLI validation. Private readers repeatedly reconstruct its mode
from the Option, kind equality checks and Boolean branches.

The app-kind flag defaults to an empty string and becomes explicit None
or Some at 1213-1215. The lab/stories CLI flags default false. The class
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

At 1218-1222, lab validation requires an app, excludes runtime-proof,
and preserves the parent/description conditions. At 1320-1332 stories
requires a foundation/ui-system library. The earlier type/app-kind gates
at 1188-1215 imply stories can only have None appKind and lab false.
The only constructor at 1415 is downstream of those gates.

The old lab/stories pair is not independent; it is also not the complete
cluster. Expand the existing id to all three real members and preserve
all five Some literals. No required array/count/payload becomes a Boolean
axis, and no second narrow pair record is needed.

## Target schema

Replace the private class with one private annotated payload-free
`ScaffoldShape` LiteralKit using the eleven literals in the table. Reuse
the existing `LiteralKit` import at 21, `$I` identity composer at 58,
and local annotation pattern already used by AppKind at 225-229.
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

| Source | Required change or preserved boundary |
| --- | --- |
| 134-135,216-239 | Keep PackageType/AppKind source domains and decoders; reuse their helpers for classification. |
| 477-486 | Replace the three-field private class with the eleven-value annotated LiteralKit and inferred type. |
| 488-509 | Replace package stories checks and app-kind/lab template branching with mode dispatch over existing ordered template constants. Retire helpers that only re-expand the old flags once their callers migrate. |
| 513-519 | Select existing Tauri assets for tauri and tauri-lab; every other mode yields the same empty asset list. |
| 640-660 | Dispatch file lists by mode; preserve stories additions and append the lab manifest path after the same lab-specific base list. |
| 683-699 | Dispatch directory lists by mode; normal/lab app variants share existing lists where appropriate. Runtime-proof keeps package directories. |
| 957-984,1188-1412 | Preserve all raw CLI validation, error ordering, defaults, parent/name/retired-name/workspace checks and messages before allocation. These are not deleted by the private-mode refactor. |
| 1415 | Construct one literal at the same point; no moved I/O or error gates. |
| 1453-1465,1611-1616 | Preserve dry-run and final file-list ordering/text; both consume the migrated filesFor selector. |
| 1477-1502 | Keep exported TemplateContext payload and its existing independently tracked campaign scope unchanged. |
| 1506-1511 | Pass the migrated ordered template selector result and complete existing context to TemplateRenderRequest. |
| 1537-1546 | Pass the new shape literal to generatePackageJson with the same full separate payload arguments. |
| 1547-1584 | Preserve lab manifest creation, gitkeep files, directories, rendered files, assets, symlink, output paths and order in the file plan. Only existing shape selector calls change. |
| 1753-1927,1991-2055 | Replace shape destructuring/Option app-manifest dispatch with mode selection of the existing app builders; keep lab values case-specific. Package and runtime-proof keep package manifest generation; stories only selects the existing stories script variant. Preserve canonical encoder and newline. |

The complete direct reader set is templateSpecsFor, assetSpecsFor, filesFor,
directoriesFor and generatePackageJson, plus their private helper functions.
Only one actual constructor exists. Exact source and test searches found
no other shape use; the graph's missing class edges were not treated as
absence evidence. No schema/selector/generator export exists. Existing
barrels export only the command, resolver and TemplateContext from this
module; public command runners continue accepting argv with existing flags.

## Guard-deletion accounting

Delete the stored `appKind`, `lab` and `withStoriesTsconfig` fields from
this private schema. Delete shape-field reconstruction in the template
selector at 494-507, the file selector at 644-659, the directory selector
at 688-696, and manifest destructuring at 2002. Replace the shape's Option
presence/kind-plus-Boolean decision walls with exhaustive literal cases.

At 513-519 replace the Option filter/map/fallback asset wall with the
two known Tauri mode cases. In manifest selection at 2005-2014, replace
the Option app-builder probe and branch with mode dispatch, preserving
the same app builders and package fallback. Remove appManifestBuilderFor
only if its single migrated caller is gone; retain AppKind helpers used
elsewhere. Existing stories Boolean helper parameters may be eliminated
or supplied only known case constants, without recreating the shape bag.

The raw lab/stories CLI guards remain necessary to produce their specified
diagnostics and occur before the operation value exists. No such guard is
claimed as deleted. The concrete removal is the parallel private fields
and repeated runtime reconstruction across all actual shape readers.

## Encoded-side impact

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

The existing CLI fixtures cover all eleven legal modes: ordinary package
at `create-package.test.ts:575-625`; stories package and dry-run at
1044-1109; Next.js, Tauri, Vite and service normal variants at 699-940;
runtime-proof at 943-985; four corresponding lab fixtures at
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
