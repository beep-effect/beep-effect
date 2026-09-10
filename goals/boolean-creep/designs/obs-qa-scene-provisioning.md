# Instance

- id: `obs-qa-scene-provisioning`
- source: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/drivers/obs/src/Obs.service.ts:179`
- symbol: `ensureQaScene`
- members: `sceneExists`, `sceneCreated`, `existingSettings`, `inputCreated`
- evidence: E1/E2/E3 at `Obs.service.ts:179-195,211-224` — scene creation is the inverse of scene existence, while input creation is exactly the absence of existing settings; the two provisioning axes are independent.

# Current shape

`ensureQaScene` reads `GetSceneList`, stores `sceneExists`, creates the requested scene only when it is false, and returns `sceneCreated: !sceneExists` (`Obs.service.ts:172-182,219-225`). It separately decodes `GetInputSettings` into `existingSettings: Option<ObsInputSettingsInfo>`, stores `inputCreated: O.isNone(existingSettings)`, branches on the boolean, matches the Option again to obtain settings, and returns the boolean (`Obs.service.ts:184-215,219-225`).

`EnsureQaSceneResult` is an exported decoded TypeScript class schema with independent `inputCreated` and `sceneCreated` receipts plus names and an optional restore token (`Obs.models.ts:387-447`). The sole production consumer reads only the names (`packages/tooling/tool/cli/src/commands/Qa/Record.ts:341-379`). Tests read both receipts at `test/Obs.service.test.ts:101-218`. No explicit result JSON encoder/decoder, persisted artifact, CLI receipt output, or external OBS protocol mapping exists.

# Cardinality gap

The current full owner has two independent correlations. Treating Option presence as the input payload axis, the four binary axes represent 16 coarse tuples. Four are legal:

| sceneExists | sceneCreated | existingSettings | inputCreated | meaning |
| --- | --- | --- | --- | --- |
| true | false | Some | false | existing scene, existing input |
| true | false | None | true | existing scene, newly created input |
| false | true | Some | false | newly created scene, existing input |
| false | true | None | true | newly created scene, newly created input |

The scene values must be complements because the same observation controls `CreateScene` and is negated in the return. The input values must be complements because `inputCreated` is `O.isNone(existingSettings)`. Scene lookup and global-input lookup are separate OBS requests, so the two dispositions remain independent and all four cross-product rows are supported by the algorithm.

`inputAttached` at `Obs.service.ts:203-208` is not another sibling axis. It is computed only in the existing-input branch and distinguishes an input already attached to the target scene from one that needs `CreateSceneItem`. Combined true with `inputCreated` is uncomputed, not an impossible tuple in a simultaneous carrier.

# Target schema

Add one annotated `ObsProvisioningDisposition` LiteralKit with `already-present | created`. Replace `EnsureQaSceneResult.sceneCreated` and `.inputCreated` with independent `sceneDisposition` and `inputDisposition` fields of that shared literal type. Reusing a value vocabulary does not merge the independent scene and input facts.

In `ensureQaScene`, classify scene-list membership directly into `sceneDisposition` and match it to issue `CreateScene`. Match `existingSettings` once: the None arm creates the input, rereads its settings, and returns `{ disposition: "created", settings }`; the Some arm performs the existing attachment check and returns `{ disposition: "already-present", settings }`. Use a small internal tagged result for those two input arms because they carry the settings payload. Construct `EnsureQaSceneResult` with the two dispositions and derive `restoreToken` from the now-required settings. Do not retain boolean getters, aliases, or compatibility projections.

# Migration inventory

- `packages/drivers/obs/src/Obs.models.ts:387-447` — define/export the annotated disposition LiteralKit, replace both result booleans with `sceneDisposition` and `inputDisposition`, and update the example and descriptions.
- `packages/drivers/obs/src/Obs.service.ts:172-182` — replace `sceneExists` and its negated branch with the scene disposition carried through to the result.
- `Obs.service.ts:184-215` — remove `inputCreated`, match `existingSettings` once into created/existing payload cases, preserve `CreateInput`, attachment repair, and the new-input settings reread.
- `Obs.service.ts:217-225` — preserve `SetCurrentProgramScene`, result field ordering conventions, names, and restore token; return both literal dispositions.
- `packages/tooling/tool/cli/src/commands/Qa/Record.ts:341-379` — no behavioral change; its name-only reads remain valid.
- `packages/drivers/obs/test/Obs.service.test.ts:101-218` — migrate receipt assertions to dispositions and add both mixed scene/input cases.
- Package docs generated from the changed JSDoc update through the normal docgen path during implementation; do not hand-edit generated files.

# Guard-deletion accounting

Delete `sceneExists`, `if (!sceneExists)`, `sceneCreated: !sceneExists`, `inputCreated`, `if (inputCreated)`, the second `O.match(existingSettings)` used only to recover the payload after branching on its derived bit, and both decoded boolean fields. Replace them with literal/tagged case matches. Do not add boolean getters or deprecated aliases. Keep branch-local `inputAttached`, because it controls a real attachment repair within the existing-input case and has no correlated sibling field.

# Encoded-side impact

None. This is an atomic decoded TypeScript migration authorized by the execution rider in `DECISIONS.md:79-82`. `EnsureQaSceneResult` has no actual persisted, wire, RPC, or CLI encoding consumer; its export and constructor JSDoc alone do not require a compatibility codec. Update all known repository constructors, tests, and reads in the same implementation PR. OBS protocol request/response codecs are external wire mirrors and remain unchanged.

# Test impact

Cover all four independent scene/input disposition combinations. Preserve exact request order and assertions for new scene/input, existing scene/input, and attaching an existing global input. Add mixed cases proving a new scene with an existing input performs `CreateScene` then the attachment lookup/action, while an existing scene with a missing input performs `CreateInput` and skips `CreateSceneItem`. Assert settings reread for a created input, restore-token behavior, `SetCurrentProgramScene`, and failure short-circuiting at each request boundary. Add schema construction/guard coverage for both disposition literals. No live OBS session is required.

# Risk and sequencing

Tier 1 decoded API migration local to `@beep/obs`, with the QA CLI consumer and tests updated atomically. Preserve operation order: `GetSceneList`, optional `CreateScene`, `GetInputSettings`, optional `CreateInput` or item-list/attach, settings reread for a new input, then `SetCurrentProgramScene`. Do not change retry or error behavior, collapse the independent scene/input axes, expose `inputAttached`, or modify external OBS protocol models.
