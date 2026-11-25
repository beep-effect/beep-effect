/**
 * Where a document link points: a URL, or a file with an optional line and column.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $CliKitId } from "@beep/identity/packages";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $CliKitId.create("LinkTarget");

/**
 * **Example** (Validate a URL target)
 *
 * ```ts
 * import { UrlTarget } from "@beep/cli-kit/LinkTarget"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(UrlTarget)({ url: "https://effect.website" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class UrlTarget extends S.Opaque<UrlTarget, { readonly brand: unique symbol }>()(
  S.Struct({
    url: S.String.pipe($I.annoteKey("LinkTarget.url", { description: "The URL the link opens." })),
  }).pipe($I.annoteSchema("UrlTarget", { description: "A link to a URL." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UrlTarget {
  /**
   * The plain URL target a caller passes.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof UrlTarget.Encoded;
}

/**
 * **Example** (Validate a file position)
 *
 * ```ts
 * import { FileTarget } from "@beep/cli-kit/LinkTarget"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(FileTarget)({ file: "src/main.ts", line: 12, col: 3 })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class FileTarget extends S.Opaque<FileTarget, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.String.pipe($I.annoteKey("LinkTarget.file", { description: "The file the link opens." })),
    line: S.optionalKey(S.Finite).pipe($I.annoteKey("LinkTarget.line", { description: "The 1-based line." })),
    col: S.optionalKey(S.Finite).pipe($I.annoteKey("LinkTarget.col", { description: "The 1-based column." })),
  }).pipe($I.annoteSchema("FileTarget", { description: "A link to a file, with an optional line and column." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace FileTarget {
  /**
   * The plain file target a caller passes.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof FileTarget.Encoded;
}

/**
 * Where a link points: a URL, or a file with an optional position.
 *
 * **Example** (Validate a file position)
 *
 * ```ts
 * import { LinkTarget } from "@beep/cli-kit/LinkTarget"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(LinkTarget)({ file: "src/main.ts", line: 12, col: 3 })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const LinkTarget = S.Union([UrlTarget, FileTarget]).pipe(
  $I.annoteSchema("LinkTarget", { description: "A URL or file with an optional position." })
);

/**
 * A URL or file position stored in a document, admitted once by the builder that made the link.
 *
 * @category type-level
 * @since 0.0.0
 */
export type LinkTarget = typeof LinkTarget.Type;

/**
 * The plain URL or file position a caller passes to a link builder or to `CliLinks.target`.
 *
 * @category type-level
 * @since 0.0.0
 */
export type LinkTargetInput = typeof LinkTarget.Encoded;

/** A URL target has a string `url`; a file target may carry `url: undefined` and stays a file target. */
const isUrlInput = (target: LinkTargetInput): target is UrlTarget.Encoded => "url" in target && P.isString(target.url);

/**
 * Admit a plain target once, at the document boundary, as the member its shape selects.
 *
 * **Example** (Admit a file target)
 *
 * ```ts
 * import { admitLinkTarget } from "@beep/cli-kit/LinkTarget"
 *
 * console.log(admitLinkTarget({ file: "src/main.ts", line: 3 })) // { file: 'src/main.ts', line: 3 }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const admitLinkTarget = (target: LinkTargetInput): LinkTarget =>
  isUrlInput(target) ? UrlTarget.make({ url: target.url }) : FileTarget.make(target);
