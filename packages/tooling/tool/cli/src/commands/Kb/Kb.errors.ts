/**
 * Knowledge ledger failures.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Kb/Kb.errors");
/**
 * A ledger operation failed without exposing source contents in the error.
 * **Example** (Reject an invalid ledger)
 * ```ts
 * import { KbError } from "@beep/repo-cli/commands/Kb"
 * console.log(KbError.make({ message: "Ledger validation failed" }).message)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class KbError extends S.TaggedError<KbError, { readonly brand: unique symbol }>($I`KbError`)(
  "KbError",
  { message: S.String },
  $I.annoteError<KbError>("KbError", { description: "Knowledge ledger boundary failure." })
) {}
