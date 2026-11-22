/**
 * Shared decision-file grammar: the `<YYYY-MM-DD>-<slug>.md` name, the
 * calendar date, the single-line text field and the YAML frontmatter reader
 * that goal-packet decisions (`goals/<slug>/decisions/`) and package code
 * decisions (`<package>/decisions/`) both decode through.
 *
 * **Details**
 *
 * The reader checks the file name grammar, splits the frontmatter, decodes it
 * with the caller's schema and `onExcessProperty: "error"`, names every
 * unknown key (nested keys included) and requires the frontmatter `date` to
 * equal the date in the file name. Each caller keeps its own frontmatter
 * schema and result model.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { FrontmatterSource } from "@beep/markdown/FrontmatterSource";
import { Frontmatter } from "@beep/markdown/MarkdownNode";
import { YamlFrontmatter } from "@beep/markdown/YamlFrontmatter";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type * as SchemaIssue from "effect/SchemaIssue";

const $I = $RepoCliId.create("internal/decisions/DecisionFile");

/**
 * Calendar date of a decision, `YYYY-MM-DD`.
 *
 * **Example** (Validate a date)
 *
 * ```ts
 * import { DecisionDate } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(DecisionDate)("2026-11-05")) // true
 * console.log(S.is(DecisionDate)("Nov 5")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DecisionDate = S.String.check(
  S.isPattern(
    /^\d{4}-\d{2}-\d{2}$/,
    $I.annote("DecisionDatePatternCheck", {
      title: "Decision Date Pattern",
      description: "An ISO calendar date (YYYY-MM-DD).",
      message: "Expected an ISO calendar date (YYYY-MM-DD)",
    })
  )
).pipe(
  $I.annoteSchema("DecisionDate", {
    description: "The calendar date a decision was taken, as written in its file name and frontmatter.",
  })
);

/**
 * Decision date string.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DecisionDate = typeof DecisionDate.Type;

/**
 * Decision file name grammar: `<YYYY-MM-DD>-<slug>.md` with a lowercase
 * hyphenated slug.
 *
 * **Example** (Validate a file name)
 *
 * ```ts
 * import { DecisionFileName } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(DecisionFileName)("2026-11-05-forward-only-migration.md")) // true
 * console.log(S.is(DecisionFileName)("notes.md")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DecisionFileName = S.String.check(
  S.isPattern(
    /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(-[a-z0-9]+)*\.md$/,
    $I.annote("DecisionFileNamePatternCheck", {
      title: "Decision File Name Pattern",
      description: "<YYYY-MM-DD>-<lowercase-hyphenated-slug>.md",
      message: "Expected <YYYY-MM-DD>-<topic>.md with a lowercase hyphenated topic",
    })
  )
).pipe(
  $I.annoteSchema("DecisionFileName", {
    description: "File name of one decision under a decisions/ directory.",
  })
);

/**
 * Decision file name string.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DecisionFileName = typeof DecisionFileName.Type;

/**
 * A non-empty single line without leading or trailing whitespace, the shape
 * of every decision frontmatter text field.
 *
 * **Example** (Validate a title)
 *
 * ```ts
 * import { DecisionSingleLine } from "@beep/repo-cli/test/SharedInternals"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(DecisionSingleLine)("Forward-only migration")) // true
 * console.log(S.is(DecisionSingleLine)(" two\nlines")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DecisionSingleLine = S.String.check(
  S.isPattern(
    /^\S(?:.*\S)?$/,
    $I.annote("DecisionSingleLineCheck", {
      title: "Decision Single Line",
      description: "A non-empty single line without leading or trailing whitespace.",
      message: "Expected a non-empty single line",
    })
  )
).pipe(
  $I.annoteSchema("DecisionSingleLine", {
    description: "A single-line decision frontmatter text field.",
  })
);

/**
 * How one decision family decodes its frontmatter.
 *
 * **Details**
 *
 * `schemaName` and `requiredKeys` only shape the rejection messages;
 * `allowedKeys` lists the frontmatter keys the schema declares; `decode`
 * must reject excess keys (`onExcessProperty: "error"`) so a misspelled key
 * fails instead of being dropped.
 *
 * @category models
 * @since 0.0.0
 */
export interface DecisionFrontmatterReader<F extends { readonly date: string }> {
  readonly allowedKeys: ReadonlyArray<string>;
  readonly decode: (input: unknown) => Effect.Effect<F, S.SchemaError>;
  readonly requiredKeys: string;
  readonly schemaName: string;
}

/**
 * A decision file split into its decoded frontmatter and trimmed body.
 *
 * @category models
 * @since 0.0.0
 */
export interface DecisionFileParts<F> {
  readonly body: string;
  readonly frontmatter: F;
}

const isDecisionFileName = S.is(DecisionFileName);

const unexpectedKeysMatcher = Match.type<SchemaIssue.Issue>().pipe(
  Match.tag(
    "Pointer",
    (pointer) => (path: ReadonlyArray<PropertyKey>) => unexpectedKeys(pointer.issue, A.appendAll(path, pointer.path))
  ),
  Match.tag(
    "Composite",
    "AnyOf",
    (group) => (path: ReadonlyArray<PropertyKey>) => A.flatMap(group.issues, (child) => unexpectedKeys(child, path))
  ),
  Match.tag(
    "Filter",
    "Encoding",
    (wrapper) => (path: ReadonlyArray<PropertyKey>) => unexpectedKeys(wrapper.issue, path)
  ),
  Match.tag("UnexpectedKey", () => (path: ReadonlyArray<PropertyKey>) => A.of(pipe(path, A.map(String), A.join(".")))),
  Match.orElse(() => (_path: ReadonlyArray<PropertyKey>) => A.empty<string>())
);

const unexpectedKeys = (issue: SchemaIssue.Issue, path: ReadonlyArray<PropertyKey>): ReadonlyArray<string> =>
  unexpectedKeysMatcher(issue)(path);

const fileDate = (file: string): string => Str.slice(0, 10)(file);

/**
 * Reads one decision file: name grammar, YAML frontmatter decoded by the
 * reader's schema, and the name/frontmatter date agreement.
 *
 * **Example** (Read a goal decision file)
 *
 * ```ts
 * import { readDecisionFrontmatter } from "@beep/repo-cli/test/SharedInternals"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * const Frontmatter = S.Struct({ title: S.String, date: S.String, reversal: S.String })
 * const reader = {
 *   schemaName: "Frontmatter",
 *   requiredKeys: "title, date, reversal",
 *   allowedKeys: ["title", "date", "reversal"],
 *   decode: S.decodeUnknownEffect(Frontmatter, { onExcessProperty: "error" }),
 * }
 * const raw = "---\ntitle: Forward-only\ndate: 2026-11-05\nreversal: Revert.\n---\n\nBody.\n"
 * console.log(Effect.isEffect(readDecisionFrontmatter(reader, "2026-11-05-forward-only.md", raw))) // true
 * ```
 *
 * @param reader - The decision family's frontmatter schema and message labels.
 * @param file - File name under `decisions/`.
 * @param raw - Full file text.
 * @returns The decoded frontmatter and trimmed body, or the rejection message.
 * @category parsing
 * @since 0.0.0
 */
export const readDecisionFrontmatter = Effect.fn("DecisionFile.readDecisionFrontmatter")(function* <
  F extends { readonly date: string },
>(
  reader: DecisionFrontmatterReader<F>,
  file: string,
  raw: string
): Effect.fn.Return<Result.Result<DecisionFileParts<F>, string>> {
  if (!isDecisionFileName(file)) {
    return Result.fail("file name is not <YYYY-MM-DD>-<topic>.md (lowercase hyphenated topic).");
  }
  const split = FrontmatterSource.split(raw);
  if (split.frontmatter === undefined) {
    return Result.fail(`missing YAML frontmatter (${reader.requiredKeys}).`);
  }
  const block = split.frontmatter;
  const decoded = yield* YamlFrontmatter.decode(Frontmatter.make({ format: block.format, value: block.value })).pipe(
    Effect.flatMap(reader.decode),
    Effect.result
  );
  if (Result.isFailure(decoded)) {
    const unknownKeys = S.isSchemaError(decoded.failure) ? unexpectedKeys(decoded.failure.issue, A.empty()) : A.empty();
    const issue = pipe(String(decoded.failure.message), Str.replace(/\s+/g, " "), Str.slice(0, 200));
    if (A.isReadonlyArrayNonEmpty(unknownKeys)) {
      return Result.fail(
        `frontmatter has key(s) outside ${reader.schemaName}: ${A.join(unknownKeys, ", ")} (allowed: ${A.join(reader.allowedKeys, ", ")}). All decode issues: ${issue}`
      );
    }
    return Result.fail(`frontmatter does not decode as ${reader.schemaName}: ${issue}`);
  }
  const frontmatter = decoded.success;
  if (frontmatter.date !== fileDate(file)) {
    return Result.fail(`frontmatter date ${frontmatter.date} differs from the file name date ${fileDate(file)}.`);
  }
  return Result.succeed({ frontmatter, body: Str.trim(split.body) });
});
