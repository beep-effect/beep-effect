/**
 * Experimental Box task entity schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/entities/Task/Task.model");

/**
 * Experimental schema anchor for Box task resources attached to items.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Decode and encode empty Task)
 *
 * ```ts
 * import { Task } from "@beep/box/experimental/domain/entities/Task/Task.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(Task)({});
 * const encoded: Task.Encoded = S.encodeSync(Task)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class Task extends S.Class<Task>($I`Task`)(
  {},
  $I.annote("Task", {
    description: "Experimental schema anchor for Box task resources attached to items.",
  })
) {}

/**
 * Type-level companion namespace for {@link Task} encoded payloads.
 *
 * **Example** (Make and encode Task)
 *
 * ```ts
 * import { Task } from "@beep/box/experimental/domain/entities/Task/Task.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = Task.make({});
 * const encoded: Task.Encoded = S.encodeSync(Task)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Task {
  /**
   * Encoded payload accepted by the {@link Task} entity schema.
   *
   * **Example** (Encode Task to Encoded)
   *
   * ```ts
   * import { Task } from "@beep/box/experimental/domain/entities/Task/Task.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: Task.Encoded = S.encodeSync(Task)(Task.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Task.Encoded;
}
