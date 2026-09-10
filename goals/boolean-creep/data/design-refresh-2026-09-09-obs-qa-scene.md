# Boolean-creep Round 26 design refresh: OBS QA scene

Source reviewed: `7440cb8c4302ce64b87860069a464bafbf65f576`

Corpus `origin/main`: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`

## Final disposition

Qualify the complete `ensureQaScene` provisioning owner under the new canonical id `obs-qa-scene-provisioning`. No existing record owns this file/symbol/member set. The current `drivers-ensure-qa-scene-result` D1 finding remains correct about the independence of scene and input observations, but the complete source audit reveals a separate correlation on each independent axis.

Final proposed metadata:

- file: `packages/drivers/obs/src/Obs.service.ts`
- line: 179
- symbol: `ensureQaScene`
- kind: `sibling-state`
- members: `sceneExists`, `sceneCreated`, `existingSettings`, `inputCreated`
- status: `confirmed`
- evidence E1/E2: `Obs.service.ts:179-182,219-224`, where scene creation is controlled by absence and the returned bit is the exact inverse
- evidence E3: `Obs.service.ts:184-195,211-220`, where `inputCreated` is exactly `None(existingSettings)` and the Option is matched again to recover its payload
- cardinality: representable 16, legal 4
- storage: `derived`
- exposure: `internal`
- target shape: `literalkit` with a small internal tagged payload case
- tier: 1

## Evidence and corrected cardinality

The full owner has two independent two-state provisioning facts. Scene-list membership and the returned scene-created bit are complements. Existing input-settings presence and the returned input-created bit are complements. Their cross-product is legitimate:

| sceneExists | sceneCreated | existingSettings | inputCreated | supported behavior |
| --- | --- | --- | --- | --- |
| true | false | Some | false | reuse scene and input; attach only if needed |
| true | false | None | true | reuse scene; create input in it |
| false | true | Some | false | create scene; attach existing global input if needed |
| false | true | None | true | create scene and input |

Four binary axes admit 16 coarse tuples; these four are legal. Current tests explicitly cover the first and fourth rows at `packages/drivers/obs/test/Obs.service.test.ts:101-179`, plus attachment repair within the first row at 182-218. The two mixed rows follow directly from the independent sequential requests and branches and should become explicit implementation tests.

`inputAttached` is computed only inside the existing-input branch at `Obs.service.ts:196-208`. It distinguishes already attached from attach-needed and controls `CreateSceneItem`. It is not simultaneously carried with `inputCreated`, so combined true is uncomputed rather than an illegal tuple. Keep that branch-local observation outside the qualified member set.

## Readers, encoding, and target correction

`EnsureQaSceneResult` is exported from `@beep/obs` (`Obs.models.ts:387-447`; `src/index.ts:15-21`). Its constructor JSDoc demonstrates both creation receipts true, but export and documentation are decoded TypeScript API evidence, not an encoded compatibility boundary. The only production consumer at `packages/tooling/tool/cli/src/commands/Qa/Record.ts:341-379` reads only `sceneName` and `inputName`. Repository tests are the only readers of the booleans.

No explicit `EnsureQaSceneResult` JSON encoder/decoder, persisted artifact, RPC payload, external OBS protocol mirror, or CLI receipt output exists. `DECISIONS.md:79-82` authorizes exported decoded TypeScript shapes to migrate atomically when all known consumers are updated. Retaining `sceneCreated` as a projection would leave a correlated alias without an actual compatibility requirement, so the earlier narrow design was incorrect.

The corrected design exports one `ObsProvisioningDisposition` LiteralKit with `already-present | created` and changes the result to two independent fields: `sceneDisposition` and `inputDisposition`. It deletes both result booleans. The service carries the scene disposition from lookup to result, and matches `existingSettings` once into an internal created/existing payload case that retains required settings. No boolean compatibility getter or alias is added.

This preserves the conceptual D1 judgment that scene and input provisioning are independent. Reusing the same literal owner for two fields does not collapse them into one state variable.

## Preserved behavior

The design retains:

- all four scene/input provisioning combinations;
- existing/new scene and existing/new input receipts, now as literals;
- `CreateSceneItem` only when a global input exists but is absent from the target scene;
- no attachment lookup after `CreateInput`, because creation attaches it to the requested scene;
- settings reread after creating an input;
- restore-token extraction and Option behavior;
- `SetCurrentProgramScene` after successful provisioning;
- request ordering and `ObsError` short-circuiting;
- unchanged QA CLI output and error mapping;
- unchanged external OBS protocol codecs.

## Files

- `goals/boolean-creep/designs/obs-qa-scene-provisioning.md`
- `goals/boolean-creep/data/design-refresh-2026-09-09-obs-qa-scene.md`

No product source, tests, inventory, status, dependency, generated file, or git ref was changed.

## Verification

`git diff --check` passes for both owned files. `mise exec bun@1.4.2 -- bun goals/boolean-creep/ops/validate-designs.ts` passes with `design coverage OK: 150 qualified ids` after this correction.
