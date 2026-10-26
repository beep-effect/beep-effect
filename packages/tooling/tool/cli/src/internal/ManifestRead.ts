/**
 * Shared package.json projection reader for the repo CLI.
 *
 * The Quality, VersionSync and Lint commands each carried a local
 * `package.json` schema (a few optional fields over `S.fromJsonString`) and
 * their own decode. They now read through `@beep/package-json`'s
 * `LenientManifest` discovery tier, and this module keeps the one verdict those
 * projections had that the tier relaxes: a present field the caller reads must
 * still have its JSON shape. A malformed field the caller does not read stays a
 * degraded `LenientManifest` issue, exactly as the old projections ignored it.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LenientManifest } from "@beep/package-json/LenientManifest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { LenientFieldIssue } from "@beep/package-json/LenientManifest";
import type { PackageJsonSyntaxError } from "@beep/package-json/PackageJsonFormat";

const $I = $RepoCliId.create("internal/ManifestRead");

/**
 * A top-level `package.json` field that `LenientManifest` types.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ManifestField = Exclude<keyof typeof LenientManifest.fields, "rest" | "issues">;

/**
 * A field a caller reads arrived in a shape `LenientManifest` degraded.
 *
 * **Example** (Describe a degraded `private` flag)
 *
 * ```ts
 * import { DegradedManifestFieldError } from "@beep/repo-cli/test/SharedInternals"
 *
 * const error = DegradedManifestFieldError.make({
 *   message: "package.json field private is not a boolean.",
 *   fields: ["private"],
 * })
 * console.log(error.fields) // ["private"]
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class DegradedManifestFieldError extends S.TaggedError<
  DegradedManifestFieldError,
  { readonly brand: unique symbol }
>($I`DegradedManifestFieldError`)(
  "DegradedManifestFieldError",
  {
    message: S.String,
    fields: S.Array(S.String),
  },
  $I.annoteError<DegradedManifestFieldError>("DegradedManifestFieldError", {
    description: "A package.json field the reader depends on is present but not in its JSON shape.",
  })
) {}

const describeIssue = (issue: LenientFieldIssue): string => `${issue.field} is not ${issue.expected}`;

/**
 * Build a `package.json` text parser that reads through `LenientManifest` and
 * fails when one of `fields` degraded.
 *
 * **Details**
 *
 * Text that is not a JSON object fails as the kit's
 * `PackageJsonSyntaxError`. A degraded field outside `fields` is left on
 * `issues` and the raw value in `rest`, as `LenientManifest` documents.
 *
 * **Example** (Read the name and private flag of a manifest)
 *
 * ```ts
 * import { manifestParser } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 *
 * const parse = manifestParser(["name", "private"])
 * const manifest = Effect.runSync(parse('{"name":"@beep/demo","private":true,"bin":7}'))
 * console.log(manifest.name, manifest.isPrivate) // @beep/demo true
 * ```
 *
 * @param fields - The fields the caller reads; each must keep its JSON shape when present.
 * @returns A parser from `package.json` text to the lenient manifest.
 * @category parsing
 * @since 0.0.0
 */
export const manifestParser = (
  fields: ReadonlyArray<ManifestField>
): ((text: string) => Effect.Effect<LenientManifest, PackageJsonSyntaxError | DegradedManifestFieldError>) => {
  const read: ReadonlyArray<string> = fields;
  return Effect.fn("ManifestRead.parse")(function* (text: string) {
    const manifest = yield* LenientManifest.parse(text);
    const degraded = A.filter(manifest.issues, (issue) => A.contains(read, issue.field));
    if (A.isReadonlyArrayNonEmpty(degraded)) {
      return yield* DegradedManifestFieldError.make({
        message: `package.json field ${A.join(A.map(degraded, describeIssue), "; ")}.`,
        fields: A.map(degraded, (issue) => issue.field),
      });
    }
    return manifest;
  });
};
