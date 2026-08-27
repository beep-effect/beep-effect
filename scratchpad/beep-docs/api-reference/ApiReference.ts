/**
 * Builds the module view and code-example list for one TypeDoc project
 * reflection: declaration grouping, anchors, rendered signatures, and comment
 * HTML with `module:` cross-references resolved.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { Semver, SemverFromString } from "@beep/schema/Semver";
import { Slug } from "@beep/schema/Slug";
import { HashMap, HashSet, Match, Order } from "effect";
import { thunkEmptyStr } from "@beep/utils/thunk";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import { dual, flow, identity, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { InlineCode, Link } from "mdast";
import { findAndReplace } from "mdast-util-find-and-replace";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { type JSONOutput, ReflectionKind } from "typedoc";
import { unified } from "unified";
import { TypeDocProjectReflection } from "../domain/ApiReference.ts";
import * as CodeSnippet from "./CodeSnippet.ts";
import { CodeSnippetLanguage } from "./CodeSnippet.ts";
import {OptionFromOptionalStrWithNoneDefault} from "@beep/schema";

const $I = $ScratchpadId.create("beep-docs/api-reference/ApiReference");


const OptionalSemver = SemverFromString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault);
const OptionalUrl = S.URLFromString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault);

/**
 * Declaration kinds the module view renders with a dedicated name.
 *
 * **Example** (Guard a kind name)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DeclarationKind } from "../../../beep-docs/api-reference/ApiReference.ts"
 *
 * console.log(S.is(DeclarationKind)(DeclarationKind.Enum.function)) // true
 * console.log(S.is(DeclarationKind)("method")) // false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DeclarationKind = LiteralKit(["namespace", "variable", "function", "class", "interface", "type"]).pipe(
  $I.annoteSchema("DeclarationKind", {
    description: "Declaration kinds rendered with a dedicated name in the module view.",
  })
);

/**
 * Literal type extracted from {@link DeclarationKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type DeclarationKind = typeof DeclarationKind.Type;

/**
 * The subset of {@link DeclarationKind} that lives in the type namespace and
 * may therefore share a name with a value declaration.
 *
 * **Example** (Guard a type kind)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { TypeKind } from "../../../beep-docs/api-reference/ApiReference.ts"
 *
 * console.log(S.is(TypeKind)("interface"), S.is(TypeKind)("function"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TypeKind = LiteralKit(DeclarationKind.pickOptions(["interface", "type"])).pipe(
  $I.annoteSchema("TypeKind", {
    description: "Declaration kinds that live in the type namespace.",
  })
);

/**
 * Literal type extracted from {@link TypeKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type TypeKind = typeof TypeKind.Type;

/**
 * Fallback name for a TypeDoc reflection kind without a dedicated
 * {@link DeclarationKind}, carrying the numeric kind.
 *
 * **Example** (Decode a fallback name)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { UnknownReflectionKind } from "../../../beep-docs/api-reference/ApiReference.ts"
 *
 * console.log(S.decodeUnknownSync(UnknownReflectionKind)("kind-128"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UnknownReflectionKind = S.TemplateLiteral(["kind-", S.Finite]).pipe(
  $I.annoteSchema("UnknownReflectionKind", {
    description: "`kind-<n>` fallback for a TypeDoc reflection kind without a dedicated name.",
  })
);

/**
 * Template-literal type extracted from {@link UnknownReflectionKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type UnknownReflectionKind = typeof UnknownReflectionKind.Type;

/**
 * Rendered kind name of a declaration: a {@link DeclarationKind} or the
 * {@link UnknownReflectionKind} fallback.
 *
 * **Example** (Accept both forms)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DeclarationKindName } from "../../../beep-docs/api-reference/ApiReference.ts"
 *
 * const isKindName = S.is(DeclarationKindName)
 * console.log(isKindName("class"), isKindName("kind-4"), isKindName("enum"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DeclarationKindName = S.Union([DeclarationKind, UnknownReflectionKind]).pipe(
  $I.annoteSchema("DeclarationKindName", {
    description: "Rendered declaration kind: a dedicated name or the `kind-<n>` fallback.",
  })
);

/**
 * Union type extracted from {@link DeclarationKindName}.
 *
 * @category models
 * @since 0.0.0
 */
export type DeclarationKindName = typeof DeclarationKindName.Type;

const declarationKindByReflectionKind = HashMap.fromIterable<ReflectionKind, DeclarationKind>([
  [ReflectionKind.Namespace, DeclarationKind.Enum.namespace],
  [ReflectionKind.Variable, DeclarationKind.Enum.variable],
  [ReflectionKind.Function, DeclarationKind.Enum.function],
  [ReflectionKind.Class, DeclarationKind.Enum.class],
  [ReflectionKind.Interface, DeclarationKind.Enum.interface],
  [ReflectionKind.TypeAlias, DeclarationKind.Enum.type],
]);

const isTypeKind = S.is(TypeKind);

const reflectionKindName = (kind: ReflectionKind): DeclarationKindName =>
  pipe(
    HashMap.get(declarationKindByReflectionKind, kind),
    O.getOrElse((): DeclarationKindName => `kind-${kind}`)
  );

const typeKindName = (kind: ReflectionKind): O.Option<TypeKind> =>
  pipe(HashMap.get(declarationKindByReflectionKind, kind), O.filter(isTypeKind));

/**
 * URL-fragment-safe anchor derived from a declaration name: alphanumeric runs
 * joined by single hyphens.
 *
 * **Example** (Decode an anchor)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DeclarationAnchor } from "../../../beep-docs/api-reference/ApiReference.ts"
 *
 * console.log(S.decodeUnknownSync(DeclarationAnchor)("map-function"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DeclarationAnchor = S.String.check(
  S.isPattern(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/, {
    identifier: $I`DeclarationAnchorCheck`,
    title: "Declaration Anchor",
    description: "Alphanumeric runs joined by single hyphens.",
    message: "Declaration anchor must be alphanumeric runs joined by single hyphens",
  })
).pipe(
  S.brand("DeclarationAnchor"),
  $I.annoteSchema("DeclarationAnchor", {
    description: "URL-fragment-safe anchor derived from a declaration name.",
  })
);

/**
 * Branded anchor string extracted from {@link DeclarationAnchor}.
 *
 * @category models
 * @since 0.0.0
 */
export type DeclarationAnchor = typeof DeclarationAnchor.Type;

const fallbackAnchor = "declaration";

const normalizeAnchor: (name: string) => string = flow(
  Str.replace(/[^a-zA-Z0-9]+/g, "-"),
  Str.replace(/^-|-$/g, ""),
  (anchor) => (Str.isEmpty(anchor) ? fallbackAnchor : anchor)
);

// crispen: normalizeAnchor is total onto DeclarationAnchor (non-empty alphanumeric runs joined by
// single hyphens), so constructor validation cannot fail here; the schema still owns the invariant.
const declarationAnchor = (name: string): DeclarationAnchor => DeclarationAnchor.make(normalizeAnchor(name));

const suffixedAnchor = (anchor: DeclarationAnchor, kind: ReflectionKind): DeclarationAnchor =>
  DeclarationAnchor.make(`${anchor}-${reflectionKindName(kind)}`);

// crispen: the lowercased anchor is [a-z0-9]+(-[a-z0-9]+)*, so `category-` + anchor always satisfies Slug.
const categorySlug = (category: string): Slug => Slug.make(`category-${normalizeAnchor(Str.toLowerCase(category))}`);

/**
 * One fenced code example extracted from a reflection comment.
 *
 * **Example** (Construct an example)
 *
 * ```ts
 * import { ApiCodeExample } from "../../../beep-docs/api-reference/ApiReference.ts"
 *
 * const example = ApiCodeExample.make({
 *   language: "typescript",
 *   ownerId: 3,
 *   ownerName: "map",
 *   source: "console.log(1)",
 * })
 * console.log(example.language)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApiCodeExample extends S.Class<ApiCodeExample>($I`ApiCodeExample`)(
  {
    language: CodeSnippetLanguage,
    ownerId: S.Int,
    ownerName: S.String,
    since: OptionalSemver,
    source: S.String,
    sourceUrl: OptionalUrl,
    title: S.NonEmptyString.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("ApiCodeExample", {
    description: "A fenced code example with the reflection that owns it and its optional title, version, and source link.",
  })
) {}

/**
 * One exported declaration as rendered on a module page.
 *
 * **Example** (Construct a declaration)
 *
 * ```ts
 * import { ApiDeclaration } from "../../../beep-docs/api-reference/ApiReference.ts"
 *
 * const declaration = ApiDeclaration.make({
 *   anchor: "map",
 *   category: "Mapping",
 *   examples: [],
 *   id: 3,
 *   kind: "function",
 *   name: "map",
 * })
 * console.log(declaration.anchor)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApiDeclaration extends S.Class<ApiDeclaration>($I`ApiDeclaration`)(
  {
    anchor: DeclarationAnchor,
    category: S.NonEmptyString,
    commentHtml: OptionFromOptionalStrWithNoneDefault,
    commentMarkdown: OptionFromOptionalStrWithNoneDefault,
    examples: S.Array(ApiCodeExample),
    id: S.Int,
    kind: DeclarationKindName,
    name: S.String,
    signature: OptionFromOptionalStrWithNoneDefault,
    since: OptionalSemver,
    sourceUrl: OptionalUrl,
    typeKind: TypeKind.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  },
  $I.annote("ApiDeclaration", {
    description: "An exported declaration with its anchor, category, rendered comment, signature, and examples.",
  })
) {}

/**
 * Declarations of one `@category`, sorted for display.
 *
 * **Example** (Construct a group)
 *
 * ```ts
 * import { ApiDeclarationGroup } from "../../../beep-docs/api-reference/ApiReference.ts"
 *
 * const group = ApiDeclarationGroup.make({ declarations: [], name: "Mapping", slug: "category-mapping" })
 * console.log(group.slug)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApiDeclarationGroup extends S.Class<ApiDeclarationGroup>($I`ApiDeclarationGroup`)(
  {
    declarations: S.Array(ApiDeclaration),
    name: S.NonEmptyString,
    slug: Slug,
  },
  $I.annote("ApiDeclarationGroup", {
    description: "The declarations of one `@category`, with the title-cased name and page slug of the group.",
  })
) {}

/**
 * The rendered view of one module reflection.
 *
 * **Example** (Construct an empty module view)
 *
 * ```ts
 * import { ApiModule } from "../../../beep-docs/api-reference/ApiReference.ts"
 *
 * console.log(ApiModule.make({ declarationCount: 0, groups: [] }).declarationCount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ApiModule extends S.Class<ApiModule>($I`ApiModule`)(
  {
    commentHtml: OptionFromOptionalStrWithNoneDefault,
    commentMarkdown: OptionFromOptionalStrWithNoneDefault,
    declarationCount: S.Int,
    groups: S.Array(ApiDeclarationGroup),
    since: OptionalSemver,
    sourceUrl: OptionalUrl,
  },
  $I.annote("ApiModule", {
    description: "A module page: rendered module comment, grouped declarations, earliest `@since`, and first source link.",
  })
) {}

/**
 * A parsed `module:<path>[.<declaration>]` cross-reference.
 *
 * **Example** (Construct a reference)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ModuleReference } from "../../../beep-docs/api-reference/ApiReference.ts"
 *
 * const reference = ModuleReference.make({ modulePath: "Option", declaration: O.some("map") })
 * console.log(reference.modulePath)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ModuleReference extends S.Class<ModuleReference>($I`ModuleReference`)(
  {
    modulePath: S.String,
    declaration: OptionFromOptionalStrWithNoneDefault,
  },
  $I.annote("ModuleReference", {
    description: "A `module:` cross-reference split into its module path and optional declaration name.",
  })
) {}

/**
 * Caller-supplied rendering options for {@link moduleView}.
 *
 * **Details**
 *
 * `moduleHref` resolves a module path to a page URL; returning `undefined`
 * renders the reference as inline code. `modulePath` names the module being
 * rendered so same-module references can link to local anchors.
 *
 * @category models
 * @since 0.0.0
 */
export interface ApiReferenceOptions {
  readonly moduleHref?: ((modulePath: string) => string | undefined) | undefined;
  readonly modulePath?: string | undefined;
}

interface RenderContext {
  readonly moduleHref: (modulePath: string) => O.Option<string>;
  readonly modulePath: O.Option<string>;
  readonly declarationAnchors: HashSet.HashSet<DeclarationAnchor>;
}

const renderContext = (
  options: ApiReferenceOptions,
  declarationAnchors: HashSet.HashSet<DeclarationAnchor>
): RenderContext => ({
  moduleHref: (modulePath) =>
    pipe(
      O.fromNullishOr(options.moduleHref),
      O.flatMap((moduleHref) => O.fromNullishOr(moduleHref(modulePath)))
    ),
  modulePath: O.fromNullishOr(options.modulePath),
  declarationAnchors,
});

const orEmpty = <T>(value: ReadonlyArray<T> | undefined): ReadonlyArray<T> =>
  pipe(
    O.fromNullishOr(value),
    O.getOrElse(A.empty<T>)
  );

const optionalText = <T>(value: T | undefined, render: (value: T) => string): string =>
  pipe(
    O.fromNullishOr(value),
    O.map(render),
    O.getOrElse(thunkEmptyStr)
  );

const decodeSemver = S.decodeOption(SemverFromString);
const decodeUrl = S.decodeOption(S.URLFromString);

const localeOrder: Order.Order<string> = (self, that) => Str.localeCompare(that)(self);

const declarationOrder: Order.Order<ApiDeclaration> = pipe(
  Order.mapInput(localeOrder, (declaration: ApiDeclaration) => declaration.name),
  Order.combine(Order.mapInput(Order.Boolean, (declaration: ApiDeclaration) => O.isSome(declaration.typeKind))),
  Order.combine(
    Order.mapInput(localeOrder, (declaration: ApiDeclaration) =>
      pipe(
        declaration.typeKind,
        O.getOrElse(thunkEmptyStr)
      )
    )
  ),
  Order.combine(Order.mapInput(Order.Number, (declaration: ApiDeclaration) => declaration.id))
);

const groupOrder: Order.Order<ApiDeclarationGroup> = Order.mapInput(localeOrder, (group) => group.name);

const WordToken = S.String.check(
  S.isPattern(/^\w/, {
    identifier: $I`WordTokenCheck`,
    title: "Word Token",
    description: "A token that starts with an ASCII word character.",
    message: "Expected a token that starts with an ASCII word character",
  })
);

const isWordToken = S.is(WordToken);

const titleCase = (value: string): string =>
  pipe(
    Str.split(value, /\b/),
    A.map((token) => (isWordToken(token) ? Str.capitalize(token) : token)),
    A.join("")
  );

const duplicatedAnchorPredicate = (anchors: ReadonlyArray<DeclarationAnchor>): P.Predicate<DeclarationAnchor> => {
  const groups = A.groupBy(anchors, identity);
  return (anchor) =>
    pipe(
      R.get(groups, anchor),
      O.exists((group) => A.length(group) > 1)
    );
};

const uniqueAnchor = (
  isDuplicated: P.Predicate<DeclarationAnchor>,
  anchor: DeclarationAnchor,
  kind: ReflectionKind
): DeclarationAnchor => (isDuplicated(anchor) ? suffixedAnchor(anchor, kind) : anchor);

const isTypeDocProjectReflection = S.is(TypeDocProjectReflection);

/**
 * Builds the {@link ApiModule} view for a project reflection: the first child
 * with children is the module, its children become declarations grouped by
 * `@category`.
 *
 * **Gotchas**
 *
 * When two children normalize to the same {@link DeclarationAnchor}, every
 * colliding declaration is kind-suffixed; the bare name is not kept as a
 * fragment id (`map` function + `map` type become `map-function` and
 * `map-type`, never `#map`).
 *
 * **Example** (Suffix colliding declaration anchors)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ReflectionKind } from "typedoc"
 * import { TypeDocProjectReflection } from "../domain/ApiReference.ts"
 * import { moduleView } from "../../../beep-docs/api-reference/ApiReference.ts"
 *
 * const reflection = S.decodeUnknownSync(TypeDocProjectReflection)({
 *   schemaVersion: "2.0",
 *   id: 1,
 *   name: "effect/Number",
 *   variant: "project",
 *   kind: ReflectionKind.Project,
 *   flags: {},
 *   children: [
 *     {
 *       id: 2,
 *       name: "Number",
 *       variant: "declaration",
 *       kind: ReflectionKind.Module,
 *       flags: {},
 *       children: [
 *         { id: 3, name: "map", variant: "declaration", kind: ReflectionKind.Function, flags: {} },
 *         { id: 4, name: "map", variant: "declaration", kind: ReflectionKind.TypeAlias, flags: {} },
 *       ],
 *     },
 *   ],
 * })
 * const view = moduleView(reflection, { modulePath: "Number" })
 * console.log(view.declarationCount, view.groups[0]?.slug) // 2 "category-other"
 * console.log(view.groups[0]?.declarations.map((declaration) => declaration.anchor))
 * // ["map-function", "map-type"]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const moduleView: {
  (options?: ApiReferenceOptions): (reflection: TypeDocProjectReflection) => ApiModule;
  (reflection: TypeDocProjectReflection, options?: ApiReferenceOptions): ApiModule;
} = dual(
  (args) => isTypeDocProjectReflection(args[0]),
  (reflection: TypeDocProjectReflection, options: ApiReferenceOptions = {}): ApiModule => {
  const moduleReflection = pipe(
    orEmpty(reflection.children),
    A.findFirst((child) => P.isNotUndefined(child.children))
  );
  const children = pipe(
    moduleReflection,
    O.flatMap((module) => O.fromNullishOr(module.children)),
    O.getOrElse(A.empty<JSONOutput.DeclarationReflection>)
  );
  const isDuplicatedAnchor = duplicatedAnchorPredicate(A.map(children, (child) => declarationAnchor(child.name)));
  const declarationAnchors = HashSet.fromIterable(
    A.map(children, (child) => uniqueAnchor(isDuplicatedAnchor, declarationAnchor(child.name), child.kind))
  );
  const context = renderContext(options, declarationAnchors);
  const examples = codeExamples(reflection);
  const declarations = A.map(children, (child) => declarationView(child, examples, isDuplicatedAnchor, context));
  const groups = pipe(
    A.groupBy(declarations, (declaration) => declaration.category),
    R.toEntries,
    A.map(
      ([category, grouped]) =>
        ApiDeclarationGroup.make({
          declarations: A.sort(grouped, declarationOrder),
          name: titleCase(category),
          slug: categorySlug(category),
        })
    ),
    A.sort(groupOrder)
  );
  const moduleComment = pipe(
    moduleReflection,
    O.flatMap((module) => O.fromNullishOr(module.comment))
  );
  return ApiModule.make({
    commentHtml: commentHtml(moduleComment, context),
    commentMarkdown: commentMarkdown(moduleComment),
    declarationCount: A.length(declarations),
    groups,
    since: pipe(
      A.map(declarations, (declaration) => declaration.since),
      A.getSomes,
      A.sort(Semver.compare),
      A.head
    ),
    sourceUrl: A.findFirst(declarations, (declaration) => declaration.sourceUrl),
  });
  }
);

const declarationView = (
  child: JSONOutput.DeclarationReflection,
  examples: ReadonlyArray<ApiCodeExample>,
  isDuplicatedAnchor: P.Predicate<DeclarationAnchor>,
  context: RenderContext
): ApiDeclaration => {
  const comment = declarationComment(child);
  const blockTags = pipe(
    comment,
    O.flatMap((value) => O.fromNullishOr(value.blockTags)),
    O.getOrElse(A.empty<JSONOutput.CommentTag>)
  );
  return ApiDeclaration.make({
    anchor: uniqueAnchor(isDuplicatedAnchor, declarationAnchor(child.name), child.kind),
    category: pipe(
      blockTagText(blockTags, "@category"),
      O.getOrElse(() => "Other")
    ),
    commentHtml: commentHtml(comment, context),
    commentMarkdown: commentMarkdown(comment),
    examples: A.filter(examples, (example) => Eq.equals(example.ownerId, child.id)),
    id: child.id,
    kind: reflectionKindName(child.kind),
    name: child.name,
    signature: declarationSignature(child),
    since: pipe(blockTagText(blockTags, "@since"), O.flatMap(decodeSemver)),
    sourceUrl: pipe(firstSourceUrl(child.sources), O.flatMap(decodeUrl)),
    typeKind: typeKindName(child.kind),
  });
};

const declarationComment = (declaration: JSONOutput.DeclarationReflection): O.Option<JSONOutput.Comment> =>
  pipe(
    O.fromNullishOr(declaration.comment),
    O.orElse(() =>
      pipe(
        orEmpty(declaration.signatures),
        A.findFirst((signature) => O.fromNullishOr(signature.comment))
      )
    )
  );

const MarkdownListItem = S.String.check(
  S.isPattern(/^-\s/, {
    identifier: $I`MarkdownListItemCheck`,
    title: "Markdown List Item",
    description: "A line that already starts with a `- ` list marker.",
    message: "Expected a line that starts with a `- ` list marker",
  })
);

const isMarkdownListItem = S.is(MarkdownListItem);

const seeListItem = (item: string): string => (isMarkdownListItem(item) ? item : `- ${item}`);

const commentHtml = (comment: O.Option<JSONOutput.Comment>, context: RenderContext): O.Option<string> =>
  pipe(
    commentMarkdown(comment),
    O.map((markdown) => {
      const body = renderMarkdown(markdown, context);
      const see = pipe(
        comment,
        O.flatMap((value) => O.fromNullishOr(value.blockTags)),
        O.getOrElse(A.empty<JSONOutput.CommentTag>),
        A.filter((tag) => Eq.equals(tag.tag, "@see")),
        A.map((tag) => Str.trim(commentPartsMarkdown(tag.content))),
        A.filter(Str.isNonEmpty)
      );
      return A.match(see, {
        onEmpty: () => body,
        onNonEmpty: (items) =>
          `${body}<h4>See</h4>${renderMarkdown(A.join(A.map(items, seeListItem), "\n"), context)}`,
      });
    })
  );

const renderMarkdown = (markdown: string, context: RenderContext): string =>
  pipe(
    unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkModuleReferences, context)
      .use(remarkRehype)
      .use(rehypeStringify)
      .processSync(removeEmptyTableRows(markdown))
      .toString(),
    Str.trim,
    Str.replaceAll("<table>", '<div class="api-table"><table>'),
    Str.replaceAll("</table>", "</table></div>")
  );

const inlineCode = (value: string): InlineCode => ({ type: "inlineCode", value });

const link = (url: string, label: string): Link => ({ type: "link", url, children: [inlineCode(label)] });

const linkNode = (
  href: string,
  label: string,
  declaration: O.Option<string>,
  sameModule: boolean,
  context: RenderContext
): InlineCode | Link =>
  pipe(
    declaration,
    O.map(declarationAnchor),
    O.map((anchor) =>
      Bool.match(sameModule, {
        onTrue: () =>
          HashSet.has(context.declarationAnchors, anchor) ? link(`${href}#${anchor}`, label) : inlineCode(label),
        onFalse: () => link(O.isSome(context.modulePath) ? href : `${href}#${anchor}`, label),
      })
    ),
    O.getOrElse(() => link(href, label))
  );

const referenceNode = (reference: ModuleReference, context: RenderContext): InlineCode | Link => {
  const label = pipe(
    reference.declaration,
    O.getOrElse(() => A.lastNonEmpty(Str.split(reference.modulePath, "/")))
  );
  const sameModule = pipe(
    context.modulePath,
    O.exists((modulePath) => Eq.equals(modulePath, reference.modulePath))
  );
  return pipe(
    context.moduleHref(reference.modulePath),
    O.map((href) => linkNode(href, label, reference.declaration, sameModule, context)),
    O.getOrElse(() => inlineCode(label))
  );
};

const moduleReferenceNode = (value: string, context: RenderContext): InlineCode | Link | false =>
  pipe(
    parseModuleReference(value),
    O.map((reference) => referenceNode(reference, context)),
    O.getOrElse((): false => false)
  );

const remarkModuleReferences =
  (context: RenderContext) =>
  (tree: Parameters<typeof findAndReplace>[0]): void => {
    findAndReplace(
      tree,
      [/\bmodule:[A-Za-z0-9_/-]+(?:\.[A-Za-z0-9_$-]+)?/g, (value: string) => moduleReferenceNode(value, context)],
      { ignore: ["link", "linkReference"] }
    );
  };

const EmptyTableRow = S.String.check(
  S.isPattern(/^\s*\|(?:\s*\|)+\s*$/, {
    identifier: $I`EmptyTableRowCheck`,
    title: "Empty Table Row",
    description: "A markdown table row whose cells are all empty.",
    message: "Expected a markdown table row whose cells are all empty",
  })
);

const isEmptyTableRow = S.is(EmptyTableRow);

const removeEmptyTableRows = (markdown: string): string =>
  pipe(Str.split(markdown, "\n"), A.filter(P.not(isEmptyTableRow)), A.join("\n"));

const commentMarkdown: (comment: O.Option<JSONOutput.Comment>) => O.Option<string> = flow(
  O.map((value: JSONOutput.Comment) =>
    pipe(commentPartsMarkdown(value.summary), Str.replace(/\n\n\*\*Example\*\*[\s\S]*$/, ""), Str.trim)
  ),
  O.filter(Str.isNonEmpty)
);

const commentPartMarkdown = Match.type<JSONOutput.CommentDisplayPart>().pipe(
  Match.when({ kind: "code" }, (part) => (O.isSome(parseFencedCode(part.text)) ? "" : part.text)),
  Match.when({ kind: "inline-tag" }, (part) => {
    const referenceText = pipe(
      O.fromNullishOr(part.tsLinkText),
      O.getOrElse(() => part.text)
    );
    return O.isSome(parseModuleReference(referenceText)) ? referenceText : part.text;
  }),
  Match.orElse((part) => part.text)
);

const commentPartsMarkdown: (parts: ReadonlyArray<JSONOutput.CommentDisplayPart>) => string = flow(
  A.map(commentPartMarkdown),
  A.join("")
);

const parseModuleReference = (value: string): O.Option<ModuleReference> =>
  pipe(
    Str.trim(value),
    Str.match(/^module:([^\s|]+)$/),
    O.flatMap((match) => A.get(match, 1)),
    O.map((target) =>
      pipe(
        target,
        Str.indexOf("."),
        O.map((separator) =>
          ModuleReference.make({
            modulePath: pipe(target, Str.slice(0, separator)),
            declaration: O.some(pipe(target, Str.slice(separator + 1))),
          })
        ),
        O.getOrElse(() => ModuleReference.make({ modulePath: target }))
      )
    )
  );

const declarationSignature: (declaration: JSONOutput.DeclarationReflection) => O.Option<string> = Match.type<
  JSONOutput.DeclarationReflection
>().pipe(
  Match.when({ kind: ReflectionKind.Function }, (declaration) =>
    pipe(
      O.fromNullishOr(declaration.signatures),
      O.map(
        flow(
          A.map((signature) => `declare function ${declaration.name}${formatDeclarationSignature(signature)}`),
          A.join("\n")
        )
      )
    )
  ),
  Match.when({ kind: ReflectionKind.Variable }, (declaration) =>
    pipe(
      O.fromNullishOr(declaration.type),
      O.map((type) => `declare const ${declaration.name}: ${formatType(type)}`)
    )
  ),
  Match.when({ kind: ReflectionKind.Interface }, (declaration) =>
    O.some(
      `interface ${declaration.name}${formatTypeParameters(declaration.typeParameters)}${formatHeritageClause(
        HeritageKeyword.Enum.extends,
        declaration.extendedTypes
      )} ${formatObjectBody(declaration)}`
    )
  ),
  Match.when({ kind: ReflectionKind.Class }, (declaration) =>
    O.some(
      `declare class ${declaration.name}${formatTypeParameters(declaration.typeParameters)}${formatHeritageClause(
        HeritageKeyword.Enum.extends,
        declaration.extendedTypes
      )}${formatHeritageClause(HeritageKeyword.Enum.implements, declaration.implementedTypes)} ${formatObjectBody(
        declaration
      )}`
    )
  ),
  Match.when({ kind: ReflectionKind.TypeAlias }, (declaration) =>
    O.some(
      `type ${declaration.name}${formatTypeParameters(declaration.typeParameters)} = ${pipe(
        O.fromNullishOr(declaration.type),
        O.map((type) => formatType(type)),
        O.getOrElse(() => formatObjectBody(declaration))
      )}`
    )
  ),
  Match.orElse(O.none<string>)
);

const formatDeclarationSignature = (signature: JSONOutput.SignatureReflection): string =>
  `${formatSignatureHead(signature)}: ${formatTypeOrUnknown(signature.type)}`;

const formatFunctionType = (signature: JSONOutput.SignatureReflection): string =>
  `${formatSignatureHead(signature)} => ${formatTypeOrUnknown(signature.type)}`;

const formatSignatureHead = (signature: JSONOutput.SignatureReflection): string =>
  `${formatTypeParameters(signature.typeParameters)}(${A.join(A.map(orEmpty(signature.parameters), formatParameter), ", ")})`;

const formatParameter = (parameter: JSONOutput.ParameterReflection): string => {
  const rest = parameter.flags.isRest === true ? "..." : "";
  const optional = parameter.flags.isOptional === true && Str.isEmpty(rest) ? "?" : "";
  return `${rest}${parameter.name}${optional}: ${formatTypeOrUnknown(parameter.type)}`;
};

const formatTypeParameters = (parameters: ReadonlyArray<JSONOutput.TypeParameterReflection> | undefined): string =>
  A.match(orEmpty(parameters), {
    onEmpty: thunkEmptyStr,
    onNonEmpty: flow(A.map(formatTypeParameter), A.join(", "), (el) => `<${el}>`),
  });

const formatTypeParameter = (parameter: JSONOutput.TypeParameterReflection): string =>
  `${optionalText(parameter.varianceModifier, (variance) => `${variance} `)}${parameter.name}${optionalText(
    parameter.type,
    (type) => ` extends ${formatType(type)}`
  )}${optionalText(parameter.default, (defaultType) => ` = ${formatType(defaultType)}`)}`;

const HeritageKeyword = LiteralKit(["extends", "implements"]);
type HeritageKeyword = typeof HeritageKeyword.Type;

const formatHeritageClause = (
  keyword: HeritageKeyword,
  types: ReadonlyArray<JSONOutput.SomeType> | undefined
): string =>
  A.match(orEmpty(types), {
    onEmpty: thunkEmptyStr,
    onNonEmpty: (present) => ` ${keyword} ${A.join(A.map(present, (type) => formatType(type)), ", ")}`,
  });

const maxTypeDepth = 12;

const formatObjectBody = (declaration: JSONOutput.DeclarationReflection, depth = 0): string => {
  const members = pipe(
    A.map(orEmpty(declaration.signatures), (signature) => `${formatDeclarationSignature(signature)};`),
    A.appendAll(A.map(orEmpty(declaration.indexSignatures), formatIndexSignature)),
    A.appendAll(
      pipe(
        orEmpty(declaration.children),
        A.filter(({flags}) => flags.isInherited !== true),
        A.flatMap(formatMember)
      )
    )
  );
  return A.isReadonlyArrayEmpty(members) || depth > maxTypeDepth
    ? "{}"
    : `{\n${A.join(A.map(members, indent), "\n")}\n}`;
};

const formatIndexSignature = (signature: JSONOutput.SignatureReflection): string =>
  `[${A.join(A.map(orEmpty(signature.parameters), formatParameter), ", ")}]: ${formatTypeOrUnknown(signature.type)};`;

const formatMember = (member: JSONOutput.DeclarationReflection): ReadonlyArray<string> => {
  const name = CodeSnippet.typescriptPropertyName(member.name);
  const optional = member.flags.isOptional === true ? "?" : "";
  const readonly = member.flags.isReadonly === true ? "readonly " : "";
  const modifiers = `${member.flags.isAbstract === true ? "abstract " : ""}${member.flags.isStatic === true ? "static " : ""}`;
  return Match.type<JSONOutput.DeclarationReflection>().pipe(
    Match.when({ kind: ReflectionKind.Constructor }, (constructor) =>
      A.map(orEmpty(constructor.signatures), (signature) => `constructor${formatSignatureHead(signature)};`)
    ),
    Match.when({ kind: ReflectionKind.Method }, (method) =>
      A.map(
        orEmpty(method.signatures),
        (signature) => `${modifiers}${name}${optional}${formatDeclarationSignature(signature)};`
      )
    ),
    Match.when({ kind: ReflectionKind.Accessor }, (accessor) => {
      const type = pipe(
        O.fromNullishOr(accessor.getSignature),
        O.flatMap((signature) => O.fromNullishOr(signature.type)),
        O.orElse(() =>
          pipe(
            O.fromNullishOr(accessor.setSignature),
            O.flatMap((signature) => O.fromNullishOr(signature.parameters)),
            O.flatMap(A.head),
            O.flatMap((parameter) => O.fromNullishOr(parameter.type))
          )
        )
      );
      return [`${modifiers}${readonly}${name}${optional}: ${formatType(type)};`];
    }),
    Match.orElse((other) =>
      pipe(
        O.fromNullishOr(other.type),
        O.map((type) => `${modifiers}${readonly}${name}${optional}: ${formatType(type)};`),
        O.toArray
      )
    )
  )(member);
};

const indent = (value: string): string =>
  pipe(
    Str.split(value, "\n"),
    A.map((line) => `  ${line}`),
    A.join("\n")
  );

const encodeJsonValue = S.encodeOption(S.fromJsonString(S.Unknown));

const formatTypeOrUnknown = (value: JSONOutput.SomeType | undefined, depth = 0): string =>
  formatType(O.fromNullishOr(value), depth);

const formatType = (value: O.Option<JSONOutput.SomeType> | JSONOutput.SomeType, depth = 0): string =>
  pipe(
    O.isOption(value) ? value : O.some(value),
    O.filter(() => depth <= maxTypeDepth),
    O.map(formatKnownType(depth)),
    O.getOrElse(() => "unknown")
  );

const formatKnownType = (depth: number): ((value: JSONOutput.SomeType) => string) => {
  const nested = (value: JSONOutput.SomeType | undefined): string => formatTypeOrUnknown(value, depth + 1);
  const joinTypes = (types: ReadonlyArray<JSONOutput.SomeType>, separator: string): string =>
    A.join(A.map(types, nested), separator);
  return Match.type<JSONOutput.SomeType>().pipe(
    Match.discriminatorsExhaustive("type")({
      intrinsic: (value) => value.name,
      unknown: (value) => value.name,
      reference: (value) =>
        A.match(orEmpty(value.typeArguments), {
          onEmpty: () => value.name,
          onNonEmpty: (typeArguments) => `${value.name}<${joinTypes(typeArguments, ", ")}>`,
        }),
      union: (value) => joinTypes(value.types, " | "),
      intersection: (value) => joinTypes(value.types, " & "),
      array: (value) => `Array<${nested(value.elementType)}>`,
      tuple: (value) => `[${joinTypes(orEmpty(value.elements), ", ")}]`,
      namedTupleMember: (value) => `${value.name}${value.isOptional ? "?" : ""}: ${nested(value.element)}`,
      literal: (value) =>
        pipe(
          encodeJsonValue(value.value),
          O.getOrElse(() => "undefined")
        ),
      typeOperator: (value) => `${value.operator} ${nested(value.target)}`,
      indexedAccess: (value) => `${nested(value.objectType)}[${nested(value.indexType)}]`,
      query: (value) => `typeof ${nested(value.queryType)}`,
      reflection: (value) => {
        const signatures = orEmpty(value.declaration.signatures);
        const soleSignature =
          A.isReadonlyArrayEmpty(orEmpty(value.declaration.children)) &&
          A.isReadonlyArrayEmpty(orEmpty(value.declaration.indexSignatures)) &&
          A.length(signatures) === 1
            ? A.head(signatures)
            : O.none<JSONOutput.SignatureReflection>();
        return pipe(
          soleSignature,
          O.map(formatFunctionType),
          O.getOrElse(() => formatObjectBody(value.declaration, depth + 1))
        );
      },
      optional: (value) => `${nested(value.elementType)}?`,
      rest: (value) => `...${nested(value.elementType)}`,
      conditional: (value) =>
        `${nested(value.checkType)} extends ${nested(value.extendsType)} ? ${nested(value.trueType)} : ${nested(
          value.falseType
        )}`,
      inferred: (value) =>
        `infer ${value.name}${optionalText(value.constraint, (constraint) => ` extends ${nested(constraint)}`)}`,
      predicate: (value) =>
        `${value.asserts ? "asserts " : ""}${value.name}${optionalText(
          value.targetType,
          (targetType) => ` is ${nested(targetType)}`
        )}`,
      templateLiteral: (value) =>
        `\`${value.head}${A.join(
          A.map(value.tail, ([type, text]) => `\${${nested(type)}}${text}`),
          ""
        )}\``,
      mapped: (value) =>
        `{ [${value.parameter} in ${nested(value.parameterType)}]: ${nested(value.templateType)} }`,
    })
  );
};

/**
 * Collects every fenced code example from a project reflection, walking
 * declarations, signatures, parameters, type parameters, and accessors.
 *
 * **Details**
 *
 * Both titled Example summary fences and TypeDoc example block tags are
 * collected. Tag-sourced fences have no title.
 *
 * **Gotchas**
 *
 * A fence whose info string is not a known snippet language is omitted, not
 * raised as an error.
 *
 * **Example** (Collect examples from a summary fence)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ReflectionKind } from "typedoc"
 * import { TypeDocProjectReflection } from "../domain/ApiReference.ts"
 * import { codeExamples } from "../../../beep-docs/api-reference/ApiReference.ts"
 *
 * const reflection = S.decodeUnknownSync(TypeDocProjectReflection)({
 *   schemaVersion: "2.0",
 *   id: 1,
 *   name: "effect/Number",
 *   variant: "project",
 *   kind: ReflectionKind.Project,
 *   flags: {},
 *   comment: {
 *     summary: [
 *       { kind: "text", text: "**Example** (Add)\n\n" },
 *       { kind: "code", text: "```ts\nconsole.log(1 + 1)\n```" },
 *     ],
 *   },
 * })
 * console.log(codeExamples(reflection).length) // 1
 * ```
 *
 * @see {@link languageFromInfoString} for the accepted language set and the empty-string default.
 * @category utilities
 * @since 0.0.0
 */
export const codeExamples = (reflection: TypeDocProjectReflection): ReadonlyArray<ApiCodeExample> =>
  collectExamples(reflection);

const collectExamples = (reflection: JSONOutput.SomeReflection): ReadonlyArray<ApiCodeExample> =>
  A.appendAll(reflectionExamples(reflection), A.flatMap(reflectionChildren(reflection), collectExamples));

const reflectionChildren = (reflection: JSONOutput.SomeReflection): ReadonlyArray<JSONOutput.SomeReflection> => {
  const groups: ReadonlyArray<ReadonlyArray<JSONOutput.SomeReflection>> = [
    "children" in reflection ? orEmpty<JSONOutput.SomeReflection>(reflection.children) : A.empty(),
    "signatures" in reflection ? orEmpty(reflection.signatures) : A.empty(),
    "indexSignatures" in reflection ? orEmpty(reflection.indexSignatures) : A.empty(),
    "parameters" in reflection ? orEmpty(reflection.parameters) : A.empty(),
    "typeParameters" in reflection ? orEmpty(reflection.typeParameters) : A.empty(),
    "getSignature" in reflection ? O.toArray(O.fromNullishOr(reflection.getSignature)) : A.empty(),
    "setSignature" in reflection ? O.toArray(O.fromNullishOr(reflection.setSignature)) : A.empty(),
  ];
  return A.flatten(groups);
};

class FencedCode extends S.Class<FencedCode>($I`FencedCode`)(
  {
    language: CodeSnippetLanguage,
    source: S.String,
  },
  $I.annote("FencedCode", {
    description: "The language and body of one fenced code block.",
  })
) {}

const fencedCodeOfPart = Match.type<JSONOutput.CommentDisplayPart>().pipe(
  Match.when({ kind: "code" }, (part) => parseFencedCode(part.text)),
  Match.orElse(O.none<FencedCode>)
);

const reflectionExamples = (reflection: JSONOutput.SomeReflection): ReadonlyArray<ApiCodeExample> =>
  pipe(
    O.fromNullishOr(reflection.comment),
    O.map((comment) => {
      const blockTags = orEmpty(comment.blockTags);
      const since = pipe(blockTagText(blockTags, "@since"), O.flatMap(decodeSemver));
      const sourceUrl = pipe(
        "sources" in reflection ? firstSourceUrl(reflection.sources) : O.none<string>(),
        O.flatMap(decodeUrl)
      );
      const example = (fenced: FencedCode, title: O.Option<string>): ApiCodeExample =>
        ApiCodeExample.make({
          language: fenced.language,
          source: fenced.source,
          ownerId: reflection.id,
          ownerName: reflection.name,
          since,
          sourceUrl,
          title,
        });
      const summaryExamples = pipe(
        comment.summary,
        A.map((part, index) =>
          pipe(
            fencedCodeOfPart(part),
            O.map((fenced) => example(fenced, exampleTitle(A.take(comment.summary, index))))
          )
        ),
        A.getSomes
      );
      const tagExamples = pipe(
        blockTags,
        A.filter((tag) => Eq.equals(tag.tag, "@example")),
        A.flatMap((tag) =>
          pipe(
            tag.content,
            A.map(fencedCodeOfPart),
            A.getSomes,
            A.map((fenced) => example(fenced, O.none()))
          )
        )
      );
      return A.appendAll(summaryExamples, tagExamples);
    }),
    O.getOrElse(A.empty<ApiCodeExample>)
  );

const parseFencedCode: (value: string) => O.Option<FencedCode> = flow(
    Str.match(/^```([^\n]*)\n([\s\S]*?)\n```\s*$/),
    O.flatMap((match) =>
      O.all({
        language: pipe(A.get(match, 1), O.flatMap(CodeSnippet.languageFromInfoString)),
        source: A.get(match, 2),
      })
    ),
    O.map((fields) => FencedCode.make(fields))
  );

const exampleTitleMatch = Match.type<JSONOutput.CommentDisplayPart>().pipe(
  Match.when({ kind: "text" }, (part) => pipe(part.text, Str.match(/\*\*Example\*\*(?:\s*\(([^)]+)\))?[^]*$/))),
  Match.orElse(O.none<RegExpMatchArray>)
);

const exampleTitle: (parts: ReadonlyArray<JSONOutput.CommentDisplayPart>) => O.Option<string> = flow(
    A.findLast(exampleTitleMatch),
    O.flatMap((match) => A.get(match, 1)),
    // The optional title group is absent from the match when no `(Title)` follows the marker.
    O.filter(P.isNotUndefined)
  );

const blockTagText = (tags: ReadonlyArray<JSONOutput.CommentTag>, tagName: string): O.Option<string> =>
  pipe(
    tags,
    A.findFirst((tag) => Eq.equals(tag.tag, tagName)),
    O.map((tag) =>
      pipe(
        tag.content,
        A.map((part) => part.text),
        A.join(""),
        Str.trim
      )
    ),
    O.filter(Str.isNonEmpty)
  );

const firstSourceUrl = (sources: ReadonlyArray<JSONOutput.SourceReference> | undefined): O.Option<string> =>
  pipe(
    orEmpty(sources),
    A.findFirst((source) => O.fromNullishOr(source.url))
  );
