/**
 * Spike-only BaseEntity input shim.
 *
 * The law-practice domain entities (and the epistemic `CandidateClaim` /
 * `Evidence` the review loop builds) extend `BaseEntity.Class`, so decoding one
 * requires the full audit envelope (`id`, `createdAt`/`updatedAt`,
 * `createdByPrincipal`/`updatedByPrincipal`, `orgId`, `rowVersion`,
 * `schemaVersion`, `source`). `@beep/test-utils` `baseEntityFixtureInput`
 * produces exactly this shape, but it is a devDependency and cannot be imported
 * from `src`. This module mirrors that helper as a spike affordance.
 *
 * In production these fields are NOT synthesized inline: `id` comes from an id
 * generator, the timestamps from `Clock`, and the principals from the
 * request/runtime context. This shim exists only so the spike can construct
 * fully-formed entities deterministically without a database or runtime.
 *
 * Covered by the package's `./internal/*: null` export guard — not part of the
 * public surface.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity";
import { NonNegativeInt, PosInt } from "@beep/schema";
import { Str } from "@beep/utils";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $LawPracticeUseCasesId.create("internal/spikeEntity");

class SystemPrincipal extends S.Class<SystemPrincipal>($I`SystemPrincipal`)(
  {
    component: S.tag("Runtime"),
    kind: S.tag("System"),
  },
  $I.annote("SystemPrincipal", {
    description: "System principal stamped on spike entity audit envelopes.",
  })
) {}

const publicIdFor = (entityType: string, id: number) => `${Str.snakeCase(entityType)}_a${id}`;

/**
 * Build the BaseEntity audit envelope for a spike entity decode.
 *
 * **Example** (Build spike entity input)
 *
 * ```ts
 * import { spikeEntityInput } from "./spikeEntity.ts"
 *
 * const input = spikeEntityInput("LawPracticeOfficeAction", 1)
 * console.log(input.schemaVersion) // "0.0.0"
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const spikeEntityInput: {
  (entityType: string, id: number): EntityInput;
  (id: number): (entityType: string) => EntityInput;
} = dual(
  2,
  (entityType: string, id: number): EntityInput =>
    EntityInput.make({
      createdAt: NonNegativeInt.make(id),
      createdByPrincipal: SystemPrincipal.make({}),
      entityType,
      id: PosInt.make(id),
      orgId: 1,
      publicId: publicIdFor(entityType, id),
      rowVersion: 1,
      schemaVersion: "0.0.0",
      source: "System",
      updatedAt: NonNegativeInt.make(id + 1),
      updatedByPrincipal: SystemPrincipal.make({}),
    })
);

/**
 * Schema-backed BaseEntity audit-envelope input used by the spike shim.
 *
 * **Example** (Create typed entity input)
 *
 * ```ts
 * import { EntityInput, spikeEntityInput } from "./spikeEntity.ts"
 *
 * const input: EntityInput = spikeEntityInput("LawPracticeClaim", 2)
 * console.log(input.source) // "System"
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class EntityInput extends S.Class<EntityInput>($I`EntityInput`)(
  {
    createdAt: NonNegativeInt.annotateKey({
      description: "Synthetic creation timestamp in milliseconds for spike entity construction.",
    }),
    createdByPrincipal: SystemPrincipal.annotateKey({
      description: "System principal that created the spike entity.",
    }),
    entityType: S.NonEmptyString.annotateKey({
      description: "Persisted entity type literal expected by the target domain entity.",
    }),
    id: PosInt.annotateKey({
      description: "Positive synthetic entity id for spike entity construction.",
    }),
    orgId: S.tag(1).annotateKey({
      description: "Synthetic organization id for spike entity construction.",
    }),
    publicId: S.NonEmptyString.annotateKey({
      description: "Synthetic public entity id for spike entity construction.",
    }),
    rowVersion: S.tag(1).annotateKey({
      description: "Initial persisted row version for spike entity construction.",
    }),
    schemaVersion: S.tag("0.0.0").annotateKey({
      description: "Schema version stamped on spike entities.",
    }),
    source: S.tag("System").annotateKey({
      description: "Synthetic source kind for spike entity construction.",
    }),
    updatedAt: NonNegativeInt.annotateKey({
      description: "Synthetic update timestamp in milliseconds for spike entity construction.",
    }),
    updatedByPrincipal: SystemPrincipal.annotateKey({
      description: "System principal that last updated the spike entity.",
    }),
  },
  $I.annote("EntityInput", {
    description: "Input for constructing a spike entity",
  })
) {}
