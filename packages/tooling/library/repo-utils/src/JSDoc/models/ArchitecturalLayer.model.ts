/**
 * Architectural layer taxonomy model definitions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoUtilsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $RepoUtilsId.create("JSDoc/models/ArchitecturalLayer.model");

/**
 * Architectural layer mappings across established patterns.
 * Enables cross-framework queries such as "show me all code in the
 * domain core that depends on infrastructure".
 *
 * **Example** (Assert domain entity layer)
 *
 * ```ts
 * import { ArchitecturalLayer } from "@beep/repo-utils/JSDoc/models/ArchitecturalLayer.model"
 *
 * const layer = ArchitecturalLayer.Enum.DomainEntity
 * console.log(ArchitecturalLayer.is.DomainEntity(layer))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ArchitecturalLayer = LiteralKit([
  "DomainEntity",
  "UseCase",
  "InterfaceAdapter",
  "FrameworkDriver",
  "Port",
  "Adapter",
  "Core",
  "CrossCutting",
]).pipe(
  $I.annoteSchema("ArchitecturalLayer", {
    description:
      'Architectural layer mappings across established patterns.\nEnables cross-framework queries such as "show me all code in the\ndomain core that depends on infrastructure".',
  })
);

/**
 * Inferred type for {@link ArchitecturalLayer}.
 *
 * **Example** (Constrain generic parameter)
 *
 * ```ts
 * import type { ArchitecturalLayer } from "@beep/repo-utils/JSDoc/models/ArchitecturalLayer.model"
 *
 * type Example = ArchitecturalLayer
 * const accept = <A extends Example>(value: A): A => value
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ArchitecturalLayer = typeof ArchitecturalLayer.Type;
