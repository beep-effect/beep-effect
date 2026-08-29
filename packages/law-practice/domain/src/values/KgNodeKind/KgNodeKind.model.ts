/**
 * Closed node-kind domain for the practice knowledge graph.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $LawPracticeDomainId.create("values/KgNodeKind");

/**
 * Node kinds admitted to the deterministic practice knowledge-graph spine.
 *
 * **Gotchas**
 *
 * The set is closed, and its members double as the `kind` discriminator persisted
 * on every `kg_node` row. Adding a kind is a projection-schema change, not a
 * local edit — every projection that fans out over node kinds must handle it.
 *
 * **Example** (Decode and guard node kinds)
 *
 * ```ts
 * import { KgNodeKind } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * const kind = S.decodeUnknownSync(KgNodeKind)("docket_family")
 * console.log(kind) // "docket_family"
 * console.log(KgNodeKind.is.patent("patent")) // true
 * console.log(KgNodeKind.is.patent("trademark")) // false
 * console.log(KgNodeKind.Enum.email_archive) // "email_archive"
 * ```
 *
 * @see {@link KgEdgePredicate} for the predicates admitted between these nodes.
 * @category schemas
 * @since 0.0.0
 */
export const KgNodeKind = LiteralKit([
  "client",
  "docket_family",
  "docket",
  "application",
  "patent",
  "document",
  "email_archive",
]).pipe(
  $I.annoteSchema("KgNodeKind", {
    description: "Closed node-kind domain for practice knowledge-graph projections.",
  })
);

/**
 * Runtime type for {@link KgNodeKind}.
 *
 * **Example** (Type prosecution spine kinds)
 *
 * ```ts
 * import type { KgNodeKind } from "@beep/law-practice-domain/values"
 *
 * const prosecutionSpine: ReadonlyArray<KgNodeKind> = ["docket_family", "docket", "application", "patent"]
 * const kind: KgNodeKind = "document"
 * console.log(prosecutionSpine.includes(kind)) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KgNodeKind = typeof KgNodeKind.Type;
