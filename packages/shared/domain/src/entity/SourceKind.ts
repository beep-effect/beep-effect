/**
 * Canonical source-kind vocabulary for persisted entities.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SharedDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $SharedDomainId.create("entity/SourceKind");
const SourceKindBase = LiteralKit(["User", "Agent", "Admin", "Application", "System", "Sync", "Connector"]);

/**
 * Denormalized source facet used by BaseEntity rows and audit filters.
 *
 * @example
 * ```ts
 * import { SourceKind } from "@beep/shared-domain/entity/SourceKind"
 *
 * console.log(SourceKind.is.Agent("Agent"))
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const SourceKind = SourceKindBase.pipe(
  $I.annoteSchema("SourceKind", {
    description: "Canonical denormalized source of persisted entity data.",
  }),
  SchemaUtils.withLiteralKitStatics(SourceKindBase),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  }))
);

/**
 * Runtime type for {@link SourceKind}.
 *
 * @example
 * ```ts
 * import type { SourceKind } from "@beep/shared-domain/entity/SourceKind"
 *
 * const source: SourceKind = "System"
 * console.log(source)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type SourceKind = typeof SourceKind.Type;
