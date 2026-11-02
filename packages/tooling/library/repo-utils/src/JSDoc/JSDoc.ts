/**
 * Canonical JSDoc tag metadata catalog.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { AccessModifierJSDoc } from "./tags/AccessModifierJSDoc.model.ts";
import { ClosureSpecificJSDoc } from "./tags/ClosureSpecificJSDoc.model.ts";
import { DocumentationContentJSDoc } from "./tags/DocumentationContentJSDoc.model.ts";
import { EventDependencyJSDoc } from "./tags/EventDependencyJSDoc.model.ts";
import { InlineJSDoc } from "./tags/InlineJSDoc.model.ts";
import { OrganizationalJSDoc } from "./tags/OrganizationalJSDoc.model.ts";
import { RemainingJSDoc } from "./tags/RemainingJSDoc.model.ts";
import { StructuralJSDoc } from "./tags/StructuralJSDoc.model.ts";
import { TSDocSpecificJSDoc } from "./tags/TSDocSpecificJSDoc.model.ts";
import { TypeDocSpecificJSDoc } from "./tags/TypeDocSpecificJSDoc.model.ts";
import { TypeScriptSpecificJSDoc } from "./tags/TypeScriptSpecificJSDoc.model.ts";

const $I = $RepoUtilsId.create("JSDoc/JSDocTagDb");

/**
 * @category models
 * @since 0.0.0
 */
export * from "./tags/AccessModifierJSDoc.model.ts";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./tags/ClosureSpecificJSDoc.model.ts";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./tags/DocumentationContentJSDoc.model.ts";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./tags/EventDependencyJSDoc.model.ts";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./tags/InlineJSDoc.model.ts";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./tags/OrganizationalJSDoc.model.ts";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./tags/RemainingJSDoc.model.ts";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./tags/StructuralJSDoc.model.ts";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./tags/TSDocSpecificJSDoc.model.ts";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./tags/TypeDocSpecificJSDoc.model.ts";
/**
 * @category models
 * @since 0.0.0
 */
export * from "./tags/TypeScriptSpecificJSDoc.model.ts";

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access JSDocTag union metadata)
 *
 * ```ts
 * import { JSDocTag } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocTag.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const JSDocTag = S.Union([
  StructuralJSDoc,
  AccessModifierJSDoc,
  DocumentationContentJSDoc,
  TSDocSpecificJSDoc,
  InlineJSDoc,
  OrganizationalJSDoc,
  EventDependencyJSDoc,
  RemainingJSDoc,
  ClosureSpecificJSDoc,
  TypeDocSpecificJSDoc,
  TypeScriptSpecificJSDoc,
]).pipe(S.toTaggedUnion("_tag"), $I.annoteSchema("JSDocTag"));

/**
 * Runtime type for {@link JSDocTag}.
 *
 * **Example** (Extract JSDocTag union name)
 *
 * ```ts
 * import type { JSDocTag } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const tagName = (tag: JSDocTag): string => tag._tag
 * console.log(typeof tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type JSDocTag = typeof JSDocTag.Type;

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Read JSDocTag union metadata)
 *
 * ```ts
 * import { JSDocTag } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocTag.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace JSDocTag {
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = JSDocTag;
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof JSDocTag.Encoded;
}
