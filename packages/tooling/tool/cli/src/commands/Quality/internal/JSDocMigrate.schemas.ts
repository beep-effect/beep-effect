/**
 * Remarks-routing schema shared by the JSDoc legacy-carrier block rewriter.
 *
 * **Details**
 *
 * The `quality jsdoc-migrate` pipeline was retired in beep-cli-composition W0;
 * only the rewrite core and this routing literal remain, because the effected
 * port runner still imports them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $RepoCliId.create("commands/Quality/internal/JSDocMigrate.schemas");

/**
 * Routing target for consumed `@remarks` content.
 *
 * **Example** (Validate a routing value)
 *
 * ```ts
 * import { JSDocMigrateRemarksRouting } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(JSDocMigrateRemarksRouting)("details")) // true
 * console.log(S.is(JSDocMigrateRemarksRouting)("summary")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JSDocMigrateRemarksRouting = LiteralKit(["details", "gotchas"]).pipe(
  $I.annoteSchema("JSDocMigrateRemarksRouting", {
    description: "Body section that receives a consumed @remarks tag's content.",
  })
);

/**
 * Body section that receives a consumed `@remarks` tag's content.
 *
 * @category type-level
 * @since 0.0.0
 */
export type JSDocMigrateRemarksRouting = typeof JSDocMigrateRemarksRouting.Type;
