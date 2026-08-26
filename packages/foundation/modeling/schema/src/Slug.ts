/**
 * Branded schema for canonical lowercase slugs safe for a single URL path
 * segment.
 *
 * **Example** (Decode a URL slug)
 *
 * ```ts import.meta.vitest name="Decode a URL slug"
 * import * as S from "effect/Schema";
 * import { Slug } from "@beep/schema/Slug";
 *
 * const slug = S.decodeUnknownSync(Slug)("my-post-2");
 * console.log(slug);
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { Str } from "@beep/utils";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Slug");
const slugAllowedCharactersPattern = /^[a-z0-9-]+$/;
const doesNotStartWithHyphen = (value: unknown): boolean => P.isString(value) && !Str.startsWith(value, "-");
const doesNotEndWithHyphen = (value: unknown): boolean => P.isString(value) && !Str.endsWith(value, "-");

const SlugChecks = S.makeFilterGroup(
  [
    S.isPattern(slugAllowedCharactersPattern, {
      identifier: $I`SlugAllowedCharactersCheck`,
      title: "Slug Allowed Characters",
      description: "A slug that uses only lowercase ASCII letters, digits, and hyphens.",
      message: "Slug must use lowercase ASCII letters, digits, and hyphens only",
    }),
    S.makeFilter(doesNotStartWithHyphen, {
      identifier: $I`SlugNoLeadingHyphenCheck`,
      title: "Slug No Leading Hyphen",
      description: "A slug that does not start with a hyphen.",
      message: "Slug must not start with a hyphen",
    }),
    S.makeFilter(doesNotEndWithHyphen, {
      identifier: $I`SlugNoTrailingHyphenCheck`,
      title: "Slug No Trailing Hyphen",
      description: "A slug that does not end with a hyphen.",
      message: "Slug must not end with a hyphen",
    }),
    S.makeFilter(P.not(Str.includes("--")), {
      identifier: $I`SlugNoRepeatedHyphenCheck`,
      title: "Slug No Repeated Hyphen",
      description: "A slug that does not contain repeated hyphen separators.",
      message: "Slug must not contain repeated hyphens",
    }),
  ],
  {
    identifier: $I`SlugChecks`,
    title: "Slug",
    description: "Checks for canonical lowercase kebab-case slug text safe for a single URL path segment.",
  }
);

/**
 * Branded schema for canonical lowercase kebab-case slugs.
 *
 * **Details**
 *
 * Validates that a string is non-empty, uses only lowercase ASCII letters,
 * digits, and hyphens, and does not start or end with a hyphen or contain
 * repeated hyphens.
 *
 * **Example** (Decode kebab-case slug)
 *
 * ```ts import.meta.vitest name="Decode kebab-case slug"
 * import * as S from "effect/Schema"
 * import { Slug } from "@beep/schema/Slug"
 *
 * const decode = S.decodeUnknownSync(Slug)
 *
 * const slug = decode("my-post-2")
 * slug // => "my-post-2"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const Slug = S.NonEmptyString.check(SlugChecks).pipe(
  S.brand("Slug"),
  $I.annoteSchema("Slug", {
    description: "Canonical lowercase kebab-case slug safe for a single URL path segment.",
  })
);

/**
 * Branded slug string type extracted from {@link Slug}.
 *
 * **Example** (Type a decoded slug)
 *
 * ```ts import.meta.vitest name="Type a decoded slug"
 * import * as S from "effect/Schema"
 * import { Slug } from "@beep/schema/Slug"
 *
 * const slug: Slug = S.decodeUnknownSync(Slug)("my-post-2")
 * console.log(slug)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Slug = typeof Slug.Type;

/**
 * Non-empty string schema used as the source input for {@link Slug}.
 *
 * **Example** (Decode non-empty input)
 *
 * ```ts import.meta.vitest name="Decode non-empty input"
 * import { SlugFromStr } from "@beep/schema/Slug"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(SlugFromStr)("my-post")
 * console.log(input)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const SlugFromStr = S.NonEmptyString;
