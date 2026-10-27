/**
 * The member record shared by the repository/environment-scoped store doubles.
 *
 * **Details**
 *
 * `RepositorySecret` and `RepositoryVariable` expose the same six scoped-store
 * operations, so their `makeTest` doubles build the all-unstubbed shape from
 * this one record through `unstubbedShapeFor` in `@beep/utils/TestDouble`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import type { UnstubbedMember } from "@beep/utils/TestDouble";

/**
 * The members of the repository/environment-scoped stores `RepositorySecret`
 * and `RepositoryVariable`, each a function.
 *
 * **Example** (List the scoped-store members)
 *
 * ```ts
 * import { scopedStoreMembers } from "@beep/github/internal/scopedStoreMembers";
 *
 * console.log(Object.keys(scopedStoreMembers).length) // 6
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const scopedStoreMembers = {
  set: "call",
  list: "call",
  delete: "call",
  setForEnvironment: "call",
  listForEnvironment: "call",
  deleteForEnvironment: "call",
} as const satisfies Record<string, UnstubbedMember>;
