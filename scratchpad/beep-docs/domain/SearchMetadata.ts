/**
 * Schemas for the search index metadata emitted for documentation and blog
 * pages, in both the staged (nested sections) and stored (JSON-string
 * sections) forms.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { NonNegativeInt, PosInt } from "@beep/schema/Int";

const $I = $ScratchpadId.create("beep-docs/domain/SearchMetadata");

/**
 * One heading-delimited section of a page as indexed for search.
 *
 * **Example** (Construct a section)
 *
 * ```ts
 * import { SearchSection } from "./SearchMetadata.ts"
 *
 * const section = new SearchSection({
 *   line: 12,
 *   level: 2,
 *   title: "Composition",
 *   anchor: "composition",
 *   parent_anchor: "",
 *   excerpt: "Chain operations.",
 * })
 * console.log(section.anchor)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SearchSection extends S.Class<SearchSection>($I`SearchSection`)(
  {
    line: NonNegativeInt,
    level: PosInt,
    title: S.String,
    anchor: S.String,
    parent_anchor: S.String,
    excerpt: S.String,
  },
  $I.annote("SearchSection", {
    description: "A heading-delimited page section with its anchor, parent anchor, and excerpt.",
  })
) {}

const SearchSections = S.Array(SearchSection);
const SearchSectionsFromJsonStrings = SearchSection.pipe(S.fromJsonString, S.Array);

/**
 * Which content collection a search record came from.
 *
 * **Example** (Guard a content source)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SearchContentSource } from "./SearchMetadata.ts"
 *
 * console.log(S.is(SearchContentSource)(SearchContentSource.Enum.documentation)) // true
 * console.log(S.is(SearchContentSource)("forum")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SearchContentSource = LiteralKit(["documentation", "blog"]).pipe(
  $I.annoteSchema("SearchContentSource", {
    description: "Content collection a search record was produced from.",
  })
);

/**
 * Literal type extracted from {@link SearchContentSource}.
 *
 * @category models
 * @since 0.0.0
 */
export type SearchContentSource = typeof SearchContentSource.Type;

/**
 * Staged search metadata for a documentation page, with sections nested
 * inline.
 *
 * **Example** (Construct documentation metadata)
 *
 * ```ts
 * import { DocumentationStagedSearchMetadata } from "./SearchMetadata.ts"
 *
 * const metadata = new DocumentationStagedSearchMetadata({
 *   schema_version: 1,
 *   docs_version: "v4",
 *   breadcrumbs: ["Guides"],
 *   page_href: "/docs/v4/guides/option",
 *   page_label: "Option",
 *   page_title: "Working with Option",
 *   sections: [],
 * })
 * console.log(metadata.content_source) // "documentation"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentationStagedSearchMetadata extends S.Class<DocumentationStagedSearchMetadata>(
  $I`DocumentationStagedSearchMetadata`
)(
  {
    schema_version: S.tag(1),
    content_source: S.tag(SearchContentSource.Enum.documentation),
    docs_version: S.String,
    breadcrumbs: S.Array(S.String),
    page_href: S.String,
    page_label: S.String,
    page_title: S.String,
    sections: SearchSections,
  },
  $I.annote("DocumentationStagedSearchMetadata", {
    description: "Search metadata for a documentation page before sections are serialized.",
  })
) {}

/**
 * Staged search metadata for a blog post, with sections nested inline.
 *
 * **Example** (Construct blog metadata)
 *
 * ```ts
 * import { BlogStagedSearchMetadata } from "./SearchMetadata.ts"
 *
 * const metadata = new BlogStagedSearchMetadata({
 *   schema_version: 1,
 *   page_href: "/blog/effect-4",
 *   page_title: "Effect 4",
 *   description: "What changed.",
 *   published_at: "2026-01-01",
 *   authors: ["Effect Team"],
 *   tags: ["release"],
 *   sections: [],
 * })
 * console.log(metadata.content_source) // "blog"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BlogStagedSearchMetadata extends S.Class<BlogStagedSearchMetadata>($I`BlogStagedSearchMetadata`)(
  {
    schema_version: S.tag(1),
    content_source: S.tag(SearchContentSource.Enum.blog),
    page_href: S.String,
    page_title: S.String,
    description: S.String,
    published_at: S.String,
    authors: S.Array(S.String).pipe(SchemaUtils.withEmptyArrayDefaults),
    tags: S.Array(S.String).pipe(SchemaUtils.withEmptyArrayDefaults),
    sections: SearchSections,
  },
  $I.annote("BlogStagedSearchMetadata", {
    description: "Search metadata for a blog post before sections are serialized.",
  })
) {}

/**
 * Staged search metadata discriminated by `content_source`.
 *
 * **Example** (Branch on the content source)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { StagedSearchMetadata } from "./SearchMetadata.ts"
 *
 * const record = S.decodeUnknownSync(StagedSearchMetadata)({
 *   schema_version: 1,
 *   content_source: "blog",
 *   page_href: "/blog/effect-4",
 *   page_title: "Effect 4",
 *   description: "What changed.",
 *   published_at: "2026-01-01",
 *   authors: [],
 *   tags: [],
 *   sections: [],
 * })
 * console.log(StagedSearchMetadata.guards.blog(record))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const StagedSearchMetadata = S.Union([DocumentationStagedSearchMetadata, BlogStagedSearchMetadata]).pipe(
  S.toTaggedUnion("content_source"),
  $I.annoteSchema("StagedSearchMetadata", {
    description: "Staged search metadata for either a documentation page or a blog post.",
  })
);

/**
 * Decoded type of {@link StagedSearchMetadata}.
 *
 * @category models
 * @since 0.0.0
 */
export type StagedSearchMetadata = typeof StagedSearchMetadata.Type;

/**
 * Stored search metadata for a documentation page; each section is kept as a
 * JSON string on the wire.
 *
 * **Example** (Decode stored documentation metadata)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DocumentationSearchMetadata } from "./SearchMetadata.ts"
 *
 * const metadata = S.decodeUnknownSync(DocumentationSearchMetadata)({
 *   schema_version: 1,
 *   content_source: "documentation",
 *   docs_version: "v4",
 *   breadcrumbs: [],
 *   page_href: "/docs/v4/option",
 *   page_label: "Option",
 *   page_title: "Option",
 *   sections: ['{"line":1,"level":1,"title":"Option","anchor":"option","parent_anchor":"","excerpt":""}'],
 * })
 * console.log(metadata.sections[0]?.anchor)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocumentationSearchMetadata extends S.Class<DocumentationSearchMetadata>(
  $I`DocumentationSearchMetadata`
)(
  {
    ...DocumentationStagedSearchMetadata.fields,
    sections: SearchSectionsFromJsonStrings,
  },
  $I.annote("DocumentationSearchMetadata", {
    description: "Stored search metadata for a documentation page with JSON-string sections.",
  })
) {}

/**
 * Stored search metadata for a blog post; each section is kept as a JSON
 * string on the wire.
 *
 * **Example** (Decode stored blog metadata)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BlogSearchMetadata } from "./SearchMetadata.ts"
 *
 * const metadata = S.decodeUnknownSync(BlogSearchMetadata)({
 *   schema_version: 1,
 *   content_source: "blog",
 *   page_href: "/blog/effect-4",
 *   page_title: "Effect 4",
 *   description: "What changed.",
 *   published_at: "2026-01-01",
 *   authors: [],
 *   tags: [],
 *   sections: [],
 * })
 * console.log(metadata.page_title)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BlogSearchMetadata extends S.Class<BlogSearchMetadata>($I`BlogSearchMetadata`)(
  {
    ...BlogStagedSearchMetadata.fields,
    sections: SearchSectionsFromJsonStrings,
  },
  $I.annote("BlogSearchMetadata", {
    description: "Stored search metadata for a blog post with JSON-string sections.",
  })
) {}

/**
 * Stored search metadata discriminated by `content_source`.
 *
 * **Example** (Match on a stored record)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SearchMetadata } from "./SearchMetadata.ts"
 *
 * const record = S.decodeUnknownSync(SearchMetadata)({
 *   schema_version: 1,
 *   content_source: "documentation",
 *   docs_version: "v4",
 *   breadcrumbs: [],
 *   page_href: "/docs/v4/option",
 *   page_label: "Option",
 *   page_title: "Option",
 *   sections: [],
 * })
 * console.log(SearchMetadata.guards.documentation(record))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SearchMetadata = S.Union([DocumentationSearchMetadata, BlogSearchMetadata]).pipe(
  S.toTaggedUnion("content_source"),
  $I.annoteSchema("SearchMetadata", {
    description: "Stored search metadata for either a documentation page or a blog post.",
  })
);

/**
 * Decoded type of {@link SearchMetadata}.
 *
 * @category models
 * @since 0.0.0
 */
export type SearchMetadata = typeof SearchMetadata.Type;
