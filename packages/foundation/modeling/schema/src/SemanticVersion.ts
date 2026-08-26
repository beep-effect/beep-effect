/**
 * Semantic version schema helpers for strings shaped like `MAJOR.MINOR.PATCH`.
 *
 * **Example** (Decode a semantic version)
 *
 * ```ts import.meta.vitest name="Decode a semantic version"
 * import * as S from "effect/Schema";
 * import { SemanticVersion } from "@beep/schema/SemanticVersion";
 *
 * const version = S.decodeUnknownSync(SemanticVersion)("1.24.0");
 *
 * console.log(version);
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import * as S from "effect/Schema";
import * as SchemaUtils from "./SchemaUtils/index.ts";

const $I = $SchemaId.create("SemanticVersion");
const semanticVersionSegmentPattern = /^(?:0|[1-9]\d*)$/;
const SemanticVersionSegment = S.String.check(
  S.isPattern(semanticVersionSegmentPattern, {
    message: "Semantic version segments must be non-negative integers without leading zeroes",
  })
);

const SemanticVersionWithStatics = S.TemplateLiteral([
  SemanticVersionSegment,
  ".",
  SemanticVersionSegment,
  ".",
  SemanticVersionSegment,
]).pipe(
  SchemaUtils.withStatics((schema) => ({
    decodeUnknownOption: (u: unknown) => S.decodeUnknownOption(schema)(u),
  })),
  $I.annoteSchema("SemanticVersion", {
    description: "A semantic version string in the format x.y.z",
  })
);

type SemanticVersionSchemaBase = typeof SemanticVersionWithStatics;

/**
 * Named schema surface for {@link SemanticVersion}.
 *
 * Declaration emit references this interface by name instead of serializing
 * the template-literal schema and its statics structurally at every consumer
 * position.
 *
 * @category schemas
 * @since 0.0.0
 */
export interface SemanticVersionSchema extends SemanticVersionSchemaBase {}

/**
 * Validates Semantic Versioning strings in `MAJOR.MINOR.PATCH` form.
 *
 * **When to use**
 *
 * Use when a boundary accepts a core semantic version without prerelease or
 * build metadata.
 *
 * **Details**
 *
 * Each segment is a non-negative integer, and multi-digit segments cannot
 * begin with `0`. The schema also exposes `decodeUnknownOption` for callers
 * that prefer absence over a thrown parse error.
 *
 * **Gotchas**
 *
 * Prerelease and build suffixes such as `1.2.3-beta+sha` are outside this
 * schema's intentionally narrow format.
 *
 * **Example** (Validate accepted and rejected versions)
 *
 * ```ts import.meta.vitest name="Validate accepted and rejected versions"
 * import * as S from "effect/Schema";
 * import { SemanticVersion } from "@beep/schema/SemanticVersion";
 *
 * S.is(SemanticVersion)("12.34.56") // => true
 * S.is(SemanticVersion)("01.2.3") // => false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const SemanticVersion: SemanticVersionSchema = SemanticVersionWithStatics;

/**
 * Decoded semantic-version string produced by {@link SemanticVersion}.
 *
 * **Example** (Annotate a decoded version)
 *
 * ```ts import.meta.vitest name="Annotate a decoded version"
 * import type { SemanticVersion } from "@beep/schema/SemanticVersion";
 *
 * const currentVersion: SemanticVersion = "2.3.4";
 * console.log(currentVersion);
 * ```
 *
 * @see {@link SemanticVersion} for the runtime schema and validation behavior.
 * @category type-level
 * @since 0.0.0
 */
export type SemanticVersion = typeof SemanticVersion.Type;
