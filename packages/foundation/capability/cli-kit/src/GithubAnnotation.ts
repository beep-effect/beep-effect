/**
 * GitHub Actions annotations: the severities, the optional file and position properties, and the escaped
 * `::level props::message` workflow command.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { WorkflowCommand } from "@beep/github-commands";
import { $CliKitId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

const $I = $CliKitId.create("GithubAnnotation");

/**
 * **Example** (Read the annotation severity vocabulary)
 *
 * ```ts
 * import { AnnotationLevel } from "@beep/cli-kit/GithubAnnotation"
 *
 * console.log(AnnotationLevel.literals) // ["error", "warning", "notice"]
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const AnnotationLevel = LiteralKit(["error", "warning", "notice"]).pipe(
  $I.annoteSchema("AnnotationLevel", { description: "The severity of a GitHub annotation." })
);
/**
 * A severity accepted by GitHub Actions annotations.
 *
 * @category type-level
 * @since 0.0.0
 */
export type AnnotationLevel = typeof AnnotationLevel.Type;

/**
 * What an annotation says about where it points and what it is called.
 *
 * **Example** (Validate annotation properties)
 *
 * ```ts
 * import { GithubAnnotationProperties } from "@beep/cli-kit/GithubAnnotation"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GithubAnnotationProperties)({ level: "notice", title: "Build" })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class GithubAnnotationProperties extends S.Opaque<
  GithubAnnotationProperties,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    /** `error`, `warning` or `notice`. */
    level: AnnotationLevel.pipe(
      $I.annoteKey("GithubAnnotationProperties.level", { description: "The level field of a GitHub annotation." })
    ),
    /** The repository-relative path of the annotated file. */
    file: S.optionalKey(S.String).pipe(
      $I.annoteKey("GithubAnnotationProperties.file", { description: "The file field of a GitHub annotation." })
    ),
    /** The first annotated line, 1-based. */
    line: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("GithubAnnotationProperties.line", { description: "The line field of a GitHub annotation." })
    ),
    /** The first annotated column, 1-based. */
    col: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("GithubAnnotationProperties.col", { description: "The col field of a GitHub annotation." })
    ),
    /** The last annotated line. */
    endLine: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("GithubAnnotationProperties.endLine", { description: "The endLine field of a GitHub annotation." })
    ),
    /** The last annotated column. */
    endColumn: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("GithubAnnotationProperties.endColumn", {
        description: "The endColumn field of a GitHub annotation.",
      })
    ),
    /** A short title shown above the annotation. */
    title: S.optionalKey(S.String).pipe(
      $I.annoteKey("GithubAnnotationProperties.title", { description: "The title field of a GitHub annotation." })
    ),
  }).pipe(
    $I.annoteSchema("GithubAnnotationProperties", {
      description: "A GitHub annotation level and optional source position and title.",
    })
  )
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { GithubAnnotationProperties } from "@beep/cli-kit/GithubAnnotation"
 * import * as S from "effect/Schema"
 *
 * const plain: GithubAnnotationProperties.Encoded = { level: "error", title: "Lint", file: "src/a.ts", line: 3 }
 * console.log(S.is(GithubAnnotationProperties)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GithubAnnotationProperties {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof GithubAnnotationProperties.Encoded;
}

/**
 * GitHub Actions annotations, as workflow commands.
 *
 * **Example** (Build a GitHub error annotation)
 *
 * ```ts
 * import { GithubAnnotation } from "@beep/cli-kit/GithubAnnotation"
 *
 * console.log(GithubAnnotation.format({ level: "error", file: "src/main.ts", line: 1 }, "Invalid input")) // ::error file=src/main.ts,line=1::Invalid input
 * ```
 *
 * @public
 * @category formatting
 * @since 0.0.0
 */
export abstract class GithubAnnotation {
  /**
   * Format an annotation as a workflow command: `::error title=T,file=F,line=1,endLine=2,col=3,endColumn=4::message`.
   *
   * **Details**
   *
   * The message escapes `%`, CR and LF; a property value escapes those and `:` and `,`, per GitHub's
   * [workflow-command documentation](https://docs.github.com/en/actions/reference/workflow-commands-for-github-actions).
   * The percent sign is escaped first, so an escape that was just written is never escaped again. An unescaped line
   * break in a message would let the text after it be read as a new command, which is why the escaping is not optional.
   *
   * A property that is not given is left out, and the properties are written in the order `title`, `file`, `line`,
   * `endLine`, `col`, `endColumn`, the same as `@effected/github-commands`' `WorkflowCommand`, which this renders
   * through.
   *
   * **Example** (Escape annotation message line breaks)
   *
   * ```ts
   * import { GithubAnnotation } from "@beep/cli-kit/GithubAnnotation"
   *
   * console.log(GithubAnnotation.format({ level: "warning", title: "Check" }, "first\nsecond")) // ::warning title=Check::first%0Asecond
   * ```
   *
   * @param annotation - the level and the optional file, position and title
   * @param message - the annotation's text
   * @category formatting
   * @since 0.0.0
   */
  // One escaping: this renders through `WorkflowCommand`, not a copy of it.
  static readonly format: {
    (annotation: GithubAnnotationProperties.Encoded, message: string): string;
    (message: string): (annotation: GithubAnnotationProperties.Encoded) => string;
  } = dual(2, (annotation: GithubAnnotationProperties.Encoded, message: string): string =>
    WorkflowCommand.render(
      annotation.level,
      {
        title: annotation.title,
        file: annotation.file,
        line: annotation.line,
        endLine: annotation.endLine,
        col: annotation.col,
        endColumn: annotation.endColumn,
      },
      message
    )
  );
}
