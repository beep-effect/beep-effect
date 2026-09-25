# OBS provisioning local alias — corrected P2 design

Source HEAD32f111f3707a63168b68ed04516af800ecc3a66c/main339da1562a2ed52f73a0a693c176fc52cca9ccb6. Stable id obs-qa-scene-provisioning. Owner ensureQaScene, Obs.service.ts:172-226. Eligibility and exhaustive8/4table are in disposition.md and finite-table.json; source bindings in audit.json. This supersedes historical cross-owner16/4 and private D1; no implementation authorization/credit is implied.

## Current shape

sceneExists179 is a Boolean scene-list observation. existingSettings184 is Option<ObsInputSettingsInfo> from a separate global lookup, with only resource-not-found converted to None. inputCreated188 duplicates Option absence. Both Booleans coexist in this local scope; E3 qualifies the alias, while sceneExists is independent. inputAttached203 exists only in the Some branch. EnsureQaSceneResult.inputCreated/sceneCreated415-447 are separate independent receipt fields and remain unchanged.

## Cardinality gap

The complete local projection sceneExists × existingSettings presence × inputCreated represents eight tuples. Four are legal because inputCreated equals O.isNone(existingSettings); sceneExists remains independent. The exhaustive finite-table.json records all eight. sceneCreated belongs only to the returned owner, and branch-local inputAttached is excluded. The exported result Boolean pair independently retains all four combinations.

## Target schema

Keep the existing schema-defined ObsInputSettingsInfo payload and its Option as the sole local input-provisioning source. No new enum, stored phase, public schema or duplicate tag is needed (DECISIONS derived-source rider). Preserve sceneExists and its existing scene creation branch. Replace inputCreated/if(inputCreated) plus the later O.match with one O.match(existingSettings) that returns Effect<ObsInputSettingsInfo>:

- None: issue CreateInput with the exact existing request fields, then readInputSettings(request.inputName) and return the decoded settings.
- Some(settings): perform the unchanged GetSceneItemList decode, inputAttached calculation and optional CreateSceneItem repair, then return the original settings.

Bind the resulting required settings, derive restoreToken using the existing filtered lookup, and issue SetCurrentProgramScene at the same point. Construct the existing EnsureQaSceneResult with inputCreated: O.isNone(existingSettings), sceneCreated: !sceneExists and unchanged names/restoreToken. This inline projection belongs only to the returned receipt owner; do not reintroduce a local inputCreated alias or retain duplicate dispatch. Both result Booleans remain freely constructible exactly as today.

Effect reference verified locally: .repos/effect/packages/effect/src/Option.ts:344 and403 exposes isNone and match; use the actual repository Effect API when implementing. Existing schema source is retained rather than introducing a domain model for an already represented Option.

## Migration inventory

- Obs.service.ts:179-182 scene branch retained;184-215 consolidate input handling into one Option match;217-225 preserve output and operation sequence.
- Obs.models.ts:415-447 exported result unchanged, including schema defaults and optional restore token handling. No constructor/decoder narrowing, enum migration or compatibility codec.
- ObsProtocol models and protocol requests remain external wire contracts unchanged; readInputSettings166-169 decoding/error behavior retained.
- packages/tooling/tool/cli/src/commands/Qa/Record.ts:350 consumer calls ensureQaScene and reads names; no migration required.
- packages/drivers/obs/test/Obs.service.test.ts:101-218 existing receipt assertions and request observations remain valid; extend meaningful mixed-case/error-order coverage only during implementation.

## Guard-deletion accounting

Delete local inputCreated188, its if/else dispatch189-209 and the second settings recovery match211-214. One Option match expresses the same behavior; retain branch-local attachment Boolean and all error handling. Preserve the output receipt projection and independent scene branch rather than replacing independent facts with arbitrary literals.

## Encoded-side impact

Tier 1 private refactor with internal exposure. No persisted, wire, or decoded public change. Preserve EnsureQaSceneResult and its freely constructible independent Boolean receipts. No compatibility codec or public schema migration is required.

## Test impact

Required implementation verification covers all four scene/global-input combinations, Some attached/unattached paths, None settings reread, request short-circuit failures, restore-token filtering and final SetCurrentProgramScene. Existing receipt assertions remain valid. Run @beep/obs package verification in the implementation lane; this P2 audit runs no product tests and earns no P3 credit.

## Risk

The main risk is reordering effects or swallowing errors. Preserve ordering GetSceneList -> optional CreateScene -> GetInputSettings -> CreateInput/readback OR item-list/optional attach -> SetCurrentProgramScene. Existing settings must not be fetched twice. None errors after input creation must propagate unchanged. Preserve the independent scene observation and branch-local attachment behavior.
