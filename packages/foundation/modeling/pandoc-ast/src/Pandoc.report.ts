/**
 * Compatibility report models for Pandoc AST conversions.
 *
 * @packageDocumentation \@beep/pandoc-ast/Pandoc.report
 * @since 0.0.0
 */

import { $PandocAstId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { pipe } from "effect";
import * as S from "effect/Schema";

const $I = $PandocAstId.create("Pandoc.report");

/**
 * Direction of a Pandoc compatibility mapping.
 *
 * @example
 * ```ts
 * import { PandocMappingDirection } from "@beep/pandoc-ast/Pandoc.report"
 *
 * console.log(PandocMappingDirection.is["pandoc-to-md"]("pandoc-to-md")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PandocMappingDirection = LiteralKit(["pandoc-to-md", "md-to-pandoc"]).pipe(
  $I.annoteSchema("PandocMappingDirection", {
    description: "Direction of a Pandoc compatibility mapping.",
  })
);

/**
 * Runtime type for {@link PandocMappingDirection}.
 *
 * @example
 * ```ts
 * import type { PandocMappingDirection } from "@beep/pandoc-ast/Pandoc.report"
 *
 * const direction: PandocMappingDirection = "pandoc-to-md"
 * console.log(direction) // "pandoc-to-md"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocMappingDirection = typeof PandocMappingDirection.Type;

/**
 * Severity for a mapping issue.
 *
 * @example
 * ```ts
 * import { PandocMappingSeverity } from "@beep/pandoc-ast/Pandoc.report"
 *
 * console.log(PandocMappingSeverity.is.lossy("lossy")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PandocMappingSeverity = LiteralKit(["lossy", "unsupported"]).pipe(
  $I.annoteSchema("PandocMappingSeverity", {
    description: "Severity for a mapping issue.",
  })
);

/**
 * Runtime type for {@link PandocMappingSeverity}.
 *
 * @example
 * ```ts
 * import type { PandocMappingSeverity } from "@beep/pandoc-ast/Pandoc.report"
 *
 * const severity: PandocMappingSeverity = "lossy"
 * console.log(severity) // "lossy"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocMappingSeverity = typeof PandocMappingSeverity.Type;

/**
 * Summary profile for a compatibility report.
 *
 * @example
 * ```ts
 * import { PandocMappingProfile } from "@beep/pandoc-ast/Pandoc.report"
 *
 * console.log(PandocMappingProfile.is.supported("supported")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PandocMappingProfile = LiteralKit(["supported", "gap"]).pipe(
  $I.annoteSchema("PandocMappingProfile", {
    description: "Summary profile for a compatibility report.",
  })
);

/**
 * Runtime type for {@link PandocMappingProfile}.
 *
 * @example
 * ```ts
 * import type { PandocMappingProfile } from "@beep/pandoc-ast/Pandoc.report"
 *
 * const profile: PandocMappingProfile = "supported"
 * console.log(profile) // "supported"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PandocMappingProfile = typeof PandocMappingProfile.Type;

/**
 * A single segment in a Pandoc JSON path.
 *
 * @example
 * ```ts
 * import { jsonPointerFromPath } from "@beep/pandoc-ast/Pandoc.report"
 *
 * console.log(jsonPointerFromPath(["blocks", 0, "c"])) // "/blocks/0/c"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const JsonPathSegment = S.Union([S.String, S.Int.check(S.isGreaterThanOrEqualTo(0))]).pipe(
  $I.annoteSchema("JsonPathSegment", {
    description: "A single segment in a Pandoc JSON path.",
  })
);

/**
 * Runtime type for {@link JsonPathSegment}.
 *
 * @example
 * ```ts
 * import type { JsonPathSegment } from "@beep/pandoc-ast/Pandoc.report"
 *
 * const segment: JsonPathSegment = "blocks"
 * console.log(segment) // "blocks"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type JsonPathSegment = typeof JsonPathSegment.Type;

const escapePointerSegment = (segment: JsonPathSegment): string =>
  pipe(`${segment}`, Str.replace(/~/g, "~0"), Str.replace(/\//g, "~1"));

const jsonPathToPointer = (path: ReadonlyArray<JsonPathSegment>): string =>
  path.length === 0 ? "" : `/${pipe(path, A.map(escapePointerSegment), A.join("/"))}`;

/**
 * Ordered path to a construct inside Pandoc JSON.
 *
 * @example
 * ```ts
 * import { JsonPath } from "@beep/pandoc-ast/Pandoc.report"
 *
 * console.log(JsonPath.toPointer(["blocks", 0]))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const JsonPath = S.Array(JsonPathSegment).pipe(
  $I.annoteSchema("JsonPath", {
    description: "Ordered path to a construct inside Pandoc JSON.",
  }),
  SchemaUtils.withStatics(() => ({
    toPointer: jsonPathToPointer,
  }))
);

/**
 * Runtime type for {@link JsonPath}.
 *
 * @example
 * ```ts
 * import type { JsonPath } from "@beep/pandoc-ast/Pandoc.report"
 *
 * const path: JsonPath = ["blocks", 0]
 * console.log(path.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type JsonPath = typeof JsonPath.Type;

/**
 * Converts a JSON path into a stable JSON Pointer string.
 *
 * @example
 * ```ts
 * import { jsonPointerFromPath } from "@beep/pandoc-ast/Pandoc.report"
 *
 * console.log(jsonPointerFromPath(["blocks", 0])) // "/blocks/0"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const jsonPointerFromPath = (path: JsonPath): string => JsonPath.toPointer(path);

/**
 * A single compatibility issue found while mapping between Pandoc and Md.
 *
 * @example
 * ```ts
 * import { PandocMappingIssue } from "@beep/pandoc-ast/Pandoc.report"
 *
 * const issue = PandocMappingIssue.fromPath({
 *   construct: "Table",
 *   direction: "pandoc-to-md",
 *   message: "Tables are outside the v1 Md-core profile.",
 *   path: ["blocks", 0],
 *   severity: "unsupported",
 * })
 * console.log(issue.pointer) // "/blocks/0"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PandocMappingIssue extends S.Class<PandocMappingIssue>($I`PandocMappingIssue`)(
  {
    construct: S.String.annotateKey({
      description: "Pandoc or Md construct that triggered the compatibility issue.",
    }),
    direction: PandocMappingDirection.annotateKey({
      description: "Direction of the attempted mapping.",
    }),
    message: S.String.annotateKey({
      description: "Human-readable compatibility explanation.",
    }),
    path: JsonPath.annotateKey({
      description: "Structured path to the construct.",
    }),
    severity: PandocMappingSeverity.annotateKey({
      description: "Issue severity.",
    }).pipe(SchemaUtils.withConstantDefault<PandocMappingSeverity>("unsupported")),
  },
  $I.annote("PandocMappingIssue", {
    description: "A single compatibility issue found while mapping between Pandoc and Md.",
  })
) {
  static readonly fromPath = (
    input: Omit<PandocMappingIssue.Type, "pointer" | "severity"> & {
      readonly severity?: PandocMappingSeverity;
    }
  ): PandocMappingIssue => PandocMappingIssue.make(input);

  /**
   * JSON Pointer derived from {@link path}.
   *
   * @category getters
   * @since 0.0.0
   */
  get pointer(): string {
    return JsonPath.toPointer(this.path);
  }
}

/**
 * Companion namespace for {@link PandocMappingIssue}.
 *
 * @example
 * ```ts
 * import { PandocMappingIssue } from "@beep/pandoc-ast/Pandoc.report"
 *
 * const issue: PandocMappingIssue.Type = PandocMappingIssue.fromPath({
 *   construct: "Table",
 *   direction: "pandoc-to-md",
 *   message: "Tables are outside the v1 Md-core profile.",
 *   path: ["blocks", 0],
 *   severity: "unsupported",
 * })
 * console.log(issue.pointer) // "/blocks/0"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace PandocMappingIssue {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly construct: string;
    readonly direction: PandocMappingDirection;
    readonly message: string;
    readonly path: JsonPath;
    readonly pointer: string;
    readonly severity: PandocMappingSeverity;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly construct: string;
    readonly direction: PandocMappingDirection;
    readonly message: string;
    readonly path: JsonPath;
    readonly severity: PandocMappingSeverity;
  }
}

/**
 * Compatibility report shared by both mapping directions.
 *
 * @example
 * ```ts
 * import { PandocCompatibilityReport } from "@beep/pandoc-ast/Pandoc.report"
 *
 * const report = PandocCompatibilityReport.fromIssues([])
 * console.log(report.profile) // "supported"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PandocCompatibilityReport extends S.Class<PandocCompatibilityReport>($I`PandocCompatibilityReport`)(
  {
    issues: S.Array(PandocMappingIssue).annotateKey({
      description: "Compatibility issues observed during mapping.",
    }),
  },
  $I.annote("PandocCompatibilityReport", {
    description: "Compatibility report shared by both mapping directions.",
  })
) {
  static readonly profileFromIssues = (issues: ReadonlyArray<PandocMappingIssue.Type>): PandocMappingProfile =>
    issues.length === 0 ? "supported" : "gap";
  static readonly fromIssues = (issues: ReadonlyArray<PandocMappingIssue.Type>): PandocCompatibilityReport =>
    PandocCompatibilityReport.make({ issues });

  /**
   * Coarse compatibility profile derived from {@link issues}.
   *
   * @category getters
   * @since 0.0.0
   */
  get profile(): PandocMappingProfile {
    return PandocCompatibilityReport.profileFromIssues(this.issues);
  }
}

/**
 * Computes the summary profile from a list of mapping issues.
 *
 * @example
 * ```ts
 * import { profileFromIssues } from "@beep/pandoc-ast/Pandoc.report"
 *
 * console.log(profileFromIssues([])) // "supported"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const profileFromIssues = PandocCompatibilityReport.profileFromIssues;

/**
 * Companion namespace for {@link PandocCompatibilityReport}.
 *
 * @example
 * ```ts
 * import { PandocCompatibilityReport } from "@beep/pandoc-ast/Pandoc.report"
 *
 * const report: PandocCompatibilityReport.Type = PandocCompatibilityReport.fromIssues([])
 * console.log(report.profile) // "supported"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace PandocCompatibilityReport {
  /**
   * @since 0.0.0
   */
  export interface Type {
    readonly issues: ReadonlyArray<PandocMappingIssue.Type>;
    readonly profile: PandocMappingProfile;
  }

  /**
   * @since 0.0.0
   */
  export interface Encoded {
    readonly issues: ReadonlyArray<PandocMappingIssue.Encoded>;
  }
}
