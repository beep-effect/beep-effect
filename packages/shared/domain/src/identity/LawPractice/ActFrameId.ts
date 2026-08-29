/**
 * ActFrameId schema and runtime type.
 *
 * @packageDocumentation
 * @category entity-ids
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as EntityId from "../../entity/EntityId.ts";

const $I = $LawPracticeDomainId.create("identity/LawPractice");
const make = EntityId.factory("law_practice", $I);

/**
 * Act frame entity identifier.
 *
 * **Details**
 *
 * An act frame is one recorded reading of a norm as an act that moves legal
 * positions. Because it is an interpretation rather than the norm itself, the
 * id names whose reading it is, and a second reading of the same provision
 * takes a fresh id rather than replacing the first.
 *
 * **Example** (Read the registered entity type)
 *
 * ```ts
 * import * as LawPractice from "@beep/shared-domain/identity/LawPractice"
 *
 * console.log(LawPractice.ActFrameId.entityType)
 * ```
 *
 * @category entity-ids
 * @since 0.0.0
 */
export const ActFrameId = make("act_frame", {
  description: "Identifier for a law-practice act frame entity.",
});

/**
 * Runtime type for {@link ActFrameId}.
 *
 * @see {@link ActFrameId} for the runtime schema and entity-type metadata.
 * @category entity-ids
 * @since 0.0.0
 */
export type ActFrameId = typeof ActFrameId.Type;
