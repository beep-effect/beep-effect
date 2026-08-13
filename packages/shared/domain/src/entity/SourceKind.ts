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

const SourceKindWithStatics = SourceKindBase.pipe(
  $I.annoteSchema("SourceKind", {
    description: "Canonical denormalized source of persisted entity data.",
  }),
  SchemaUtils.withLiteralKitStatics(SourceKindBase),
  SchemaUtils.withStatics((schema) => ({
    fromUnknown: S.decodeUnknownSync(schema),
    decodeOption: S.decodeUnknownOption(schema),
  }))
);

type SourceKindSchemaBase = typeof SourceKindWithStatics;

/**
 * Named schema surface for {@link SourceKind}.
 *
 * Declaration emit references this interface by name instead of serializing
 * the literal-kit statics structurally at every consumer position.
 *
 * @category schemas
 * @since 0.0.0
 */
export interface SourceKindSchema extends SourceKindSchemaBase {}

/**
 * Denormalized source facet used by BaseEntity rows and audit filters.
 *
 * **Example** (Check is.Agent predicate)
 *
 * ```ts
 * import { SourceKind } from "@beep/shared-domain/entity/SourceKind"
 *
 * console.log(SourceKind.is.Agent("Agent"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SourceKind: SourceKindSchema = SourceKindWithStatics;

/**
 * Runtime type for {@link SourceKind}.
 *
 * **Example** (Annotate System source value)
 *
 * ```ts
 * import type { SourceKind } from "@beep/shared-domain/entity/SourceKind"
 *
 * const source: SourceKind = "System"
 * console.log(source)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SourceKind = typeof SourceKind.Type;
