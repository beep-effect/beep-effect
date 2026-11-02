/**
 * EventDependencyJSDoc tag metadata catalog: Event and dependency tags.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { JSDocTagDefinition } from "../models/index.ts";
import type { JSDocTagMember } from "../JSDoc.shared.ts";

const $I = $RepoUtilsId.create("JSDoc/JSDocTagDb");

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access fires tag metadata)
 *
 * ```ts
 * import { JSDocFires } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocFires.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocFires extends S.Opaque<JSDocFires & JSDocTagMember<"fires">, { readonly brand: unique symbol }>()(
  JSDocTagDefinition.make("fires", {
    synonyms: ["emits"],
    overview: "Describe the events this method may fire.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["function", "method"],
    astDerivable: "none",
    astDerivableNote: "Event emission documentation is not deterministically derivable in general codebases.",
    parameters: {
      syntax: "@fires ClassName#eventName",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: true,
    },
    relatedTags: ["event", "listens"],
    isDeprecated: false,
    example: "/** @fires MyClass#change */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access listens tag metadata)
 *
 * ```ts
 * import { JSDocListens } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocListens.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocListens extends S.Opaque<
  JSDocListens & JSDocTagMember<"listens">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("listens", {
    synonyms: [],
    overview: "List the events that a symbol listens for.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["function", "method"],
    astDerivable: "none",
    astDerivableNote: "Event listener documentation is not deterministically derivable in general codebases.",
    parameters: {
      syntax: "@listens eventName",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: true,
    },
    relatedTags: ["event", "fires"],
    isDeprecated: false,
    example: "/** @listens MyClass#event:change */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access event tag metadata)
 *
 * ```ts
 * import { JSDocEvent } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocEvent.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocEvent extends S.Opaque<JSDocEvent & JSDocTagMember<"event">, { readonly brand: unique symbol }>()(
  JSDocTagDefinition.make("event", {
    synonyms: [],
    overview: "Document an event.",
    tagKind: "block",
    specifications: ["jsdoc3", "typedoc"],
    applicableTo: ["event"],
    astDerivable: "none",
    astDerivableNote:
      "Events are typically defined by convention (string constants), not as AST declarations. Some frameworks encode them in types.",
    parameters: {
      syntax: "@event ClassName#eventName",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: true,
    },
    relatedTags: ["fires", "listens", "eventProperty"],
    isDeprecated: false,
    example: "/** @event MyClass#change */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access requires tag metadata)
 *
 * ```ts
 * import { JSDocRequires } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocRequires.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocRequires extends S.Opaque<
  JSDocRequires & JSDocTagMember<"requires">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("requires", {
    synonyms: [],
    overview: "This file requires a JavaScript module.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["file", "module"],
    astDerivable: "partial",
    astDerivableNote:
      "Dependency edges are derivable, but documentation-level requirement curation is partially semantic.",
    parameters: {
      syntax: "@requires moduleName",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["module", "exports"],
    isDeprecated: false,
    example: "/** @requires lodash */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access event dependency metadata)
 *
 * ```ts
 * import { EventDependencyJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = EventDependencyJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EventDependencyJSDoc = S.Union([JSDocFires, JSDocListens, JSDocEvent, JSDocRequires]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("EventDependencyJSDoc")
);

/**
 * Runtime type for {@link EventDependencyJSDoc}.
 *
 * **Example** (Extract event dependency tag)
 *
 * ```ts
 * import type { EventDependencyJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const tagName = (tag: EventDependencyJSDoc): string => tag._tag
 * console.log(typeof tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EventDependencyJSDoc = typeof EventDependencyJSDoc.Type;

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Read event dependency metadata)
 *
 * ```ts
 * import { EventDependencyJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = EventDependencyJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace EventDependencyJSDoc {
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = EventDependencyJSDoc;
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof EventDependencyJSDoc.Encoded;
}
