/**
 * Experimental Box task assignment entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/TaskAssignment/TaskAssignment.model");

/**
 * Experimental schema anchor for assignments of Box tasks to principals.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Round-trip empty assignment)
 *
 * ```ts
 * import { TaskAssignment } from "@beep/box/experimental/domain/entities/TaskAssignment/TaskAssignment.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(TaskAssignment)({});
 * const encoded: TaskAssignment.Encoded = S.encodeSync(TaskAssignment)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class TaskAssignment extends S.Class<TaskAssignment>($I`TaskAssignment`)(
  {},
  $I.annote("TaskAssignment", {
    description: "Experimental schema anchor for assignments of Box tasks to principals.",
  })
) {}

/**
 * Type-level companion namespace for {@link TaskAssignment} encoded payloads.
 *
 * **Example** (Make and encode empty)
 *
 * ```ts
 * import { TaskAssignment } from "@beep/box/experimental/domain/entities/TaskAssignment/TaskAssignment.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = TaskAssignment.make({});
 * const encoded: TaskAssignment.Encoded = S.encodeSync(TaskAssignment)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TaskAssignment {
  /**
   * Encoded payload accepted by the {@link TaskAssignment} entity schema.
   *
   * **Example** (Encode empty assignment payload)
   *
   * ```ts
   * import { TaskAssignment } from "@beep/box/experimental/domain/entities/TaskAssignment/TaskAssignment.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: TaskAssignment.Encoded = S.encodeSync(TaskAssignment)(TaskAssignment.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TaskAssignment.Encoded;
}
