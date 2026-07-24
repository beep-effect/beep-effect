/**
 * Documentation content tag occurrence shapes.
 *
 * @packageDocumentation
 * @category models
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { optionalDesc } from "./_fields.ts";

const $I = $RepoUtilsId.create("JSDoc/models/tag-values/DocumentationTagValues");

/**
 * Schema-backed value for a parsed `description` tag occurrence: the main description body.
 *
 * @example
 * ```ts
 * import { DescriptionValue } from "@beep/repo-utils/JSDoc/models/tag-values/DocumentationTagValues"
 *
 * const tag = DescriptionValue.make({ description: "Parses one JSDoc block." })
 * const tagName: "description" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DescriptionValue extends S.TaggedClass<DescriptionValue>($I`DescriptionValue`)(
  "description",
  { ...optionalDesc },
  $I.annote("DescriptionValue", {
    description: "Occurrence shape for @description — the main description body.",
  })
) {}

/**
 * Schema-backed value for a parsed `summary` tag occurrence: a short summary.
 *
 * @example
 * ```ts
 * import { SummaryValue } from "@beep/repo-utils/JSDoc/models/tag-values/DocumentationTagValues"
 *
 * const tag = SummaryValue.make({ description: "Parse tag metadata." })
 * const tagName: "summary" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SummaryValue extends S.TaggedClass<SummaryValue>($I`SummaryValue`)(
  "summary",
  { ...optionalDesc },
  $I.annote("SummaryValue", {
    description: "Occurrence shape for @summary — a short summary.",
  })
) {}

/**
 * Schema-backed value for a parsed `remarks` tag occurrence: additional remarks.
 *
 * @example
 * ```ts
 * import { RemarksValue } from "@beep/repo-utils/JSDoc/models/tag-values/DocumentationTagValues"
 *
 * const tag = RemarksValue.make({ description: "Whitespace is preserved for docgen." })
 * const tagName: "remarks" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class RemarksValue extends S.TaggedClass<RemarksValue>($I`RemarksValue`)(
  "remarks",
  { ...optionalDesc },
  $I.annote("RemarksValue", {
    description: "Occurrence shape for @remarks — additional remarks.",
  })
) {}

/**
 * Schema-backed value for a parsed `example` tag occurrence: a usage example.
 *
 * @example
 * ```ts
 * import { ExampleValue } from "@beep/repo-utils/JSDoc/models/tag-values/DocumentationTagValues"
 *
 * const tag = ExampleValue.make({ description: "ParamValue.make({ name: \"input\" })" })
 * const tagName: "example" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ExampleValue extends S.TaggedClass<ExampleValue>($I`ExampleValue`)(
  "example",
  { ...optionalDesc },
  $I.annote("ExampleValue", {
    description: "Occurrence shape for @example — a usage example.",
  })
) {}

/**
 * Schema-backed value for a parsed `deprecated` tag occurrence: marks a symbol as deprecated.
 *
 * @example
 * ```ts
 * import { DeprecatedValue } from "@beep/repo-utils/JSDoc/models/tag-values/DocumentationTagValues"
 *
 * const tag = DeprecatedValue.make({ description: "Use parseJSDocTag instead." })
 * const tagName: "deprecated" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class DeprecatedValue extends S.TaggedClass<DeprecatedValue>($I`DeprecatedValue`)(
  "deprecated",
  { ...optionalDesc },
  $I.annote("DeprecatedValue", {
    description: "Occurrence shape for @deprecated — marks a symbol as deprecated.",
  })
) {}

/**
 * Schema-backed value for a parsed `see` tag occurrence: a reference to related resources.
 *
 * @example
 * ```ts
 * import { SeeValue } from "@beep/repo-utils/JSDoc/models/tag-values/DocumentationTagValues"
 *
 * const tag = SeeValue.make({ description: "TagValue" })
 * const tagName: "see" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SeeValue extends S.TaggedClass<SeeValue>($I`SeeValue`)(
  "see",
  { ...optionalDesc },
  $I.annote("SeeValue", {
    description: "Occurrence shape for @see — a reference to related resources.",
  })
) {}

/**
 * Schema-backed value for a parsed `since` tag occurrence: the version when the symbol was introduced.
 *
 * @example
 * ```ts
 * import { SinceValue } from "@beep/repo-utils/JSDoc/models/tag-values/DocumentationTagValues"
 *
 * const tag = SinceValue.make({ description: "0.0.0" })
 * const tagName: "since" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class SinceValue extends S.TaggedClass<SinceValue>($I`SinceValue`)(
  "since",
  { ...optionalDesc },
  $I.annote("SinceValue", {
    description: "Occurrence shape for @since — the version when the symbol was introduced.",
  })
) {}

/**
 * Schema-backed value for a parsed `version` tag occurrence: the current version of the symbol.
 *
 * @example
 * ```ts
 * import { VersionValue } from "@beep/repo-utils/JSDoc/models/tag-values/DocumentationTagValues"
 *
 * const tag = VersionValue.make({ description: "1.2.3" })
 * const tagName: "version" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class VersionValue extends S.TaggedClass<VersionValue>($I`VersionValue`)(
  "version",
  { ...optionalDesc },
  $I.annote("VersionValue", {
    description: "Occurrence shape for @version — the current version of the symbol.",
  })
) {}

/**
 * Schema-backed value for a parsed `author` tag occurrence: the author of the symbol.
 *
 * @example
 * ```ts
 * import { AuthorValue } from "@beep/repo-utils/JSDoc/models/tag-values/DocumentationTagValues"
 *
 * const tag = AuthorValue.make({ description: "Beep Maintainers" })
 * const tagName: "author" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AuthorValue extends S.TaggedClass<AuthorValue>($I`AuthorValue`)(
  "author",
  { ...optionalDesc },
  $I.annote("AuthorValue", {
    description: "Occurrence shape for @author — the author of the symbol.",
  })
) {}

/**
 * Schema-backed value for a parsed `todo` tag occurrence: a pending task.
 *
 * @example
 * ```ts
 * import { TodoValue } from "@beep/repo-utils/JSDoc/models/tag-values/DocumentationTagValues"
 *
 * const tag = TodoValue.make({ description: "Normalize inherited tags." })
 * const tagName: "todo" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class TodoValue extends S.TaggedClass<TodoValue>($I`TodoValue`)(
  "todo",
  { ...optionalDesc },
  $I.annote("TodoValue", {
    description: "Occurrence shape for @todo — a pending task.",
  })
) {}
