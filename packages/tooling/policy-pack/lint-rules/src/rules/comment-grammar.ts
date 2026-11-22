/**
 * Comment grammar shared by the `beep/no-comments` oxlint rule and the
 * `beep laws comments` scanner.
 *
 * **Details**
 *
 * Both hosts hand the same ESTree program and comment list to
 * {@link classifyComments}, so a comment the editor flags is the comment the
 * growth check counts. Exemptions are exact anchored tokens, never prefix
 * words: a sentence that happens to start with `Region` or `effect-` is prose.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { $LintRulesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as F from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $LintRulesId.create("rules/comment-grammar");

/**
 * Syntactic class of one source comment under the comment law.
 *
 * **Details**
 *
 * `prose`, `jsdoc-local`, `law-disable` and `bad-suppression` are banned
 * ({@link BannedCommentKind}); every other kind is exempt. `jsdoc-member`
 * stays exempt until the exported-JSDoc law is ruled, and `jsdoc-tagged`
 * covers local blocks that carry a tag a tool reads (`@internal`, `@public`,
 * `@expected-unused`, `@ignore`, `@deprecated`) or an in-source test fence.
 * `decision-pointer` is the one allow-listed form for a hazard with no
 * better home: a line comment `decision: <slug>` whose slug names a file under
 * the owning package `decisions/` directory; `beep laws comments` rejects a
 * pointer in a changed file that names no such file.
 *
 * **Example** (Recognize a kind)
 *
 * ```ts
 * import { CommentKind } from "@beep/lint-rules/comment-grammar"
 *
 * console.log(CommentKind.is.prose("prose")) // true
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export const CommentKind = LiteralKit([
  "shebang",
  "directive",
  "license",
  "provenance",
  "generated-header",
  "port-marker",
  "decision-pointer",
  "jsdoc-module",
  "jsdoc-export",
  "jsdoc-member",
  "jsdoc-tagged",
  "prose",
  "jsdoc-local",
  "law-disable",
  "bad-suppression",
]).pipe(
  $I.annoteSchema("CommentKind", { description: "Syntactic class of one source comment under the comment law." })
);

/**
 * Type-level member of {@link CommentKind}.
 *
 * @category models
 * @since 0.1.0
 */
export type CommentKind = typeof CommentKind.Type;

/**
 * Comment kinds the comment law bans.
 *
 * **Example** (Check a banned kind)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { BannedCommentKind } from "@beep/lint-rules/comment-grammar"
 *
 * console.log(S.is(BannedCommentKind)("jsdoc-local")) // true
 * console.log(S.is(BannedCommentKind)("directive")) // false
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export const BannedCommentKind = LiteralKit(["prose", "jsdoc-local", "law-disable", "bad-suppression"]).pipe(
  $I.annoteSchema("BannedCommentKind", { description: "Comment kinds the comment law bans from source." })
);

/**
 * Type-level member of {@link BannedCommentKind}.
 *
 * @category models
 * @since 0.1.0
 */
export type BannedCommentKind = typeof BannedCommentKind.Type;

/**
 * Whether a comment kind is banned.
 *
 * **Example** (Filter banned kinds)
 *
 * ```ts
 * import { isBannedCommentKind } from "@beep/lint-rules/comment-grammar"
 *
 * console.log(isBannedCommentKind("prose")) // true
 * ```
 *
 * @category predicates
 * @since 0.1.0
 */
export const isBannedCommentKind: (kind: CommentKind) => kind is BannedCommentKind = S.is(BannedCommentKind);

/**
 * Parser comment syntax.
 *
 * **Example** (Recognize a line comment)
 *
 * ```ts
 * import { CommentSyntax } from "@beep/lint-rules/comment-grammar"
 *
 * console.log(CommentSyntax.is.Line("Line")) // true
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export const CommentSyntax = LiteralKit(["Line", "Block", "Shebang"]).pipe(
  $I.annoteSchema("CommentSyntax", { description: "Comment syntax reported by the oxc parser and oxlint." })
);

/**
 * Type-level member of {@link CommentSyntax}.
 *
 * @category models
 * @since 0.1.0
 */
export type CommentSyntax = typeof CommentSyntax.Type;

/**
 * One parser comment: syntax, raw value without delimiters, and source offsets.
 *
 * **Example** (Build a comment)
 *
 * ```ts
 * import { SourceComment } from "@beep/lint-rules/comment-grammar"
 *
 * const comment = SourceComment.make({ type: "Line", value: " hi", start: 0, end: 5 })
 *
 * console.log(comment.end) // 5
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class SourceComment extends S.Opaque<SourceComment, { readonly brand: unique symbol }>()(
  S.Struct({
    type: CommentSyntax,
    value: S.String,
    start: S.Int,
    end: S.Int,
  }).pipe(
    $I.annoteSchema("SourceComment", {
      description: "One parser comment with its delimiter-free value and source offsets.",
    })
  )
) {}

/**
 * One comment with its law kind and whitespace-normalized text.
 *
 * **Example** (Read a classified comment)
 *
 * ```ts
 * import { ClassifiedComment } from "@beep/lint-rules/comment-grammar"
 *
 * const comment = ClassifiedComment.make({ type: "Line", value: " hi", start: 0, end: 5, kind: "prose", text: "hi" })
 *
 * console.log(comment.kind) // "prose"
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class ClassifiedComment extends S.Opaque<ClassifiedComment, { readonly brand: unique symbol }>()(
  S.Struct({
    type: CommentSyntax,
    value: S.String,
    start: S.Int,
    end: S.Int,
    kind: CommentKind,
    text: S.String,
  }).pipe(
    $I.annoteSchema("ClassifiedComment", {
      description: "One source comment with its comment-law kind and whitespace-normalized text.",
    })
  )
) {}

const GrammarNodeShape = S.Struct({
  type: S.String,
  start: S.Int,
  end: S.Int,
});

/**
 * Structural ESTree node accepted by the grammar.
 *
 * **Details**
 *
 * The oxc parser and the oxlint plugin runtime both give every node `type`,
 * `start` and `end`; nothing else is assumed. The schema is a guard
 * declaration, so decoding passes the parser node through with every other
 * field intact.
 *
 * **Example** (Recognize a program node)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { GrammarNode } from "@beep/lint-rules/comment-grammar"
 *
 * console.log(S.is(GrammarNode)({ type: "Program", start: 0, end: 0, body: [] })) // true
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export const GrammarNode = GrammarNodeShape.pipe(
  S.is,
  S.declare,
  $I.annoteSchema("GrammarNode", {
    description: "Structural ESTree node: the type and source offsets every oxc and oxlint node carries.",
  })
);

/**
 * Type-level member of {@link GrammarNode}.
 *
 * **Details**
 *
 * The type stays structural, so a parser node with more fields is accepted.
 *
 * @category models
 * @since 0.1.0
 */
export type GrammarNode = typeof GrammarNode.Type;

/**
 * AST node types that put a JSDoc block in export context.
 *
 * **Example** (Recognize an export node)
 *
 * ```ts
 * import { ExportNodeType } from "@beep/lint-rules/comment-grammar"
 *
 * console.log(ExportNodeType.is.ExportSpecifier("ExportSpecifier")) // true
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export const ExportNodeType = LiteralKit([
  "ExportNamedDeclaration",
  "ExportDefaultDeclaration",
  "ExportAllDeclaration",
  "TSExportAssignment",
  "TSNamespaceExportDeclaration",
  "ExportSpecifier",
]).pipe($I.annoteSchema("ExportNodeType", { description: "AST node types that put a JSDoc block in export context." }));

/**
 * Type-level member of {@link ExportNodeType}.
 *
 * @category models
 * @since 0.1.0
 */
export type ExportNodeType = typeof ExportNodeType.Type;

/**
 * Top-level declaration types an export specifier can name.
 *
 * **Example** (Recognize a declaration)
 *
 * ```ts
 * import { DeclarationNodeType } from "@beep/lint-rules/comment-grammar"
 *
 * console.log(DeclarationNodeType.is.FunctionDeclaration("FunctionDeclaration")) // true
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export const DeclarationNodeType = LiteralKit([
  "FunctionDeclaration",
  "ClassDeclaration",
  "VariableDeclaration",
  "TSTypeAliasDeclaration",
  "TSInterfaceDeclaration",
  "TSEnumDeclaration",
  "TSModuleDeclaration",
]).pipe(
  $I.annoteSchema("DeclarationNodeType", { description: "Top-level declaration types an export specifier can name." })
);

/**
 * Type-level member of {@link DeclarationNodeType}.
 *
 * @category models
 * @since 0.1.0
 */
export type DeclarationNodeType = typeof DeclarationNodeType.Type;

/**
 * Member node types whose JSDoc follows the export status of their owner.
 *
 * **Example** (Recognize a member)
 *
 * ```ts
 * import { MemberNodeType } from "@beep/lint-rules/comment-grammar"
 *
 * console.log(MemberNodeType.is.Property("Property")) // true
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export const MemberNodeType = LiteralKit([
  "Property",
  "PropertyDefinition",
  "MethodDefinition",
  "AccessorProperty",
  "TSPropertySignature",
  "TSMethodSignature",
  "TSEnumMember",
  "TSAbstractMethodDefinition",
  "TSAbstractPropertyDefinition",
  "TSAbstractAccessorProperty",
  "TSIndexSignature",
  "TSCallSignatureDeclaration",
  "TSConstructSignatureDeclaration",
]).pipe(
  $I.annoteSchema("MemberNodeType", {
    description: "Member node types whose JSDoc follows the export status of their owner.",
  })
);

/**
 * Type-level member of {@link MemberNodeType}.
 *
 * @category models
 * @since 0.1.0
 */
export type MemberNodeType = typeof MemberNodeType.Type;

const isExportNodeType = S.is(ExportNodeType);
const isDeclarationNodeType = S.is(DeclarationNodeType);
const isMemberNodeType = S.is(MemberNodeType);
const SKIPPED_KEYS = HashSet.make("parent", "loc", "range");
const LAW_RULE = "beep/no-comments";

const isNode = (value: unknown): value is GrammarNode =>
  P.isObject(value) && P.hasProperty(value, "type") && P.isString(value.type);
const field = (node: GrammarNode, key: string): unknown => (node as unknown as Readonly<Record<string, unknown>>)[key];
const nodeField = (node: GrammarNode, key: string): O.Option<GrammarNode> => O.liftPredicate(field(node, key), isNode);
const nodesField = (node: GrammarNode, key: string): ReadonlyArray<GrammarNode> => {
  const value = field(node, key);
  return P.isIterable(value) ? A.filter(A.fromIterable(value), isNode) : [];
};
const identifierName = (node: GrammarNode): O.Option<string> => {
  if (node.type === "ParenthesizedExpression") return O.flatMap(nodeField(node, "expression"), identifierName);
  return node.type === "Identifier" ? O.liftPredicate(field(node, "name"), P.isString) : O.none();
};

const BINDING_CHILDREN = HashMap.make(
  ["ObjectPattern", "properties"],
  ["ArrayPattern", "elements"],
  ["Property", "value"],
  ["AssignmentPattern", "left"],
  ["RestElement", "argument"]
);

const childNodes = (node: GrammarNode, key: string): ReadonlyArray<GrammarNode> =>
  A.appendAll(nodesField(node, key), O.toArray(nodeField(node, key)));

const bindingNames = (node: GrammarNode): ReadonlyArray<string> =>
  O.match(HashMap.get(BINDING_CHILDREN, node.type), {
    onNone: () => O.toArray(identifierName(node)),
    onSome: (key) => A.flatMap(childNodes(node, key), bindingNames),
  });

const declaredNames = (statement: GrammarNode): ReadonlyArray<string> => {
  if (statement.type === "VariableDeclaration")
    return A.flatMap(nodesField(statement, "declarations"), (declarator) =>
      A.flatMap(O.toArray(nodeField(declarator, "id")), bindingNames)
    );
  return O.toArray(O.flatMap(nodeField(statement, "id"), identifierName));
};

const specifierNames = (statement: GrammarNode): ReadonlyArray<string> => {
  if (statement.type === "ExportNamedDeclaration")
    return O.isSome(nodeField(statement, "source"))
      ? []
      : A.flatMap(nodesField(statement, "specifiers"), (specifier) =>
          O.toArray(O.flatMap(nodeField(specifier, "local"), identifierName))
        );
  if (statement.type === "ExportDefaultDeclaration" || statement.type === "TSExportAssignment")
    return O.toArray(
      O.flatMap(
        O.orElse(nodeField(statement, "declaration"), () => nodeField(statement, "expression")),
        identifierName
      )
    );
  return [];
};

const decoratorStarts = (node: GrammarNode): ReadonlyArray<number> =>
  A.map(
    A.appendAll(
      nodesField(node, "decorators"),
      O.match(nodeField(node, "declaration"), { onNone: () => [], onSome: (inner) => nodesField(inner, "decorators") })
    ),
    (decorator) => decorator.start
  );

/**
 * Where JSDoc blocks may attach in one file: export anchors and members.
 *
 * **Details**
 *
 * `publicStarts` holds the start offset of every node a JSDoc block may sit
 * on to document an export. `memberStarts` maps each member's start offset
 * to whether its owner is exported.
 *
 * **Example** (Read an empty attachment)
 *
 * ```ts
 * import * as HashMap from "effect/HashMap"
 * import * as HashSet from "effect/HashSet"
 * import { CommentAttachment } from "@beep/lint-rules/comment-grammar"
 *
 * const attachment = CommentAttachment.make({ publicStarts: HashSet.empty(), memberStarts: HashMap.empty() })
 *
 * console.log(HashSet.size(attachment.publicStarts)) // 0
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class CommentAttachment extends S.Opaque<CommentAttachment, { readonly brand: unique symbol }>()(
  S.Struct({
    publicStarts: S.HashSet(S.Int),
    memberStarts: S.HashMap(S.Int, S.Boolean),
  }).pipe(
    $I.annoteSchema("CommentAttachment", {
      description: "Export anchor offsets and member offsets with their owner's export status for one file.",
    })
  )
) {}

/**
 * Incremental attachment index fed by a depth-first walk.
 *
 * **Details**
 *
 * Call `enter` before a node's children and `exit` after them, in walk
 * order. The oxlint rule feeds it from visitors; {@link attachmentOf} feeds it
 * from a plain parser tree.
 *
 * **Example** (Index an empty program)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { makeAttachmentIndex } from "@beep/lint-rules/comment-grammar"
 *
 * const index = makeAttachmentIndex({ type: "Program", start: 0, end: 0 })
 *
 * console.log(HashSet.size(index.result().publicStarts)) // 0
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export interface AttachmentIndex {
  readonly enter: (node: GrammarNode) => void;
  readonly exit: (node: GrammarNode) => void;
  readonly result: () => CommentAttachment;
}

/**
 * Start an attachment index for one program.
 *
 * **Details**
 *
 * Export specifier names are read from the program body up front, so a
 * top-level declaration named by `export { x }` or `export default x` is in
 * export context when the walk reaches it.
 *
 * **Example** (Index an empty program)
 *
 * ```ts
 * import * as HashMap from "effect/HashMap"
 * import { makeAttachmentIndex } from "@beep/lint-rules/comment-grammar"
 *
 * const index = makeAttachmentIndex({ type: "Program", start: 0, end: 0 })
 *
 * console.log(HashMap.size(index.result().memberStarts)) // 0
 * ```
 *
 * @param program - The parsed ESTree `Program`.
 * @returns A fresh index.
 * @category constructors
 * @since 0.1.0
 */
export const makeAttachmentIndex = (program: GrammarNode): AttachmentIndex => {
  const body = nodesField(program, "body");
  const publicNames = HashSet.fromIterable(A.flatMap(body, specifierNames));
  const publicStatements = HashSet.fromIterable(
    A.map(
      A.filter(
        body,
        (statement) =>
          isDeclarationNodeType(statement.type) &&
          A.some(declaredNames(statement), (name) => HashSet.has(publicNames, name))
      ),
      (statement) => statement.start
    )
  );
  const isContext = (node: GrammarNode): boolean =>
    isExportNodeType(node.type) || (isDeclarationNodeType(node.type) && HashSet.has(publicStatements, node.start));
  let depth = 0;
  let publicStarts = HashSet.empty<number>();
  let memberStarts = HashMap.empty<number, boolean>();
  return {
    enter: (node) => {
      if (isContext(node)) {
        publicStarts = HashSet.add(publicStarts, node.start);
        for (const start of decoratorStarts(node)) publicStarts = HashSet.add(publicStarts, start);
        depth++;
      } else if (isMemberNodeType(node.type) && !HashMap.has(memberStarts, node.start)) {
        memberStarts = HashMap.set(memberStarts, node.start, depth > 0);
      }
    },
    exit: (node) => {
      if (isContext(node)) depth--;
    },
    result: () => CommentAttachment.make({ publicStarts, memberStarts }),
  };
};

/**
 * Build the attachment index by walking a plain parser tree.
 *
 * **Details**
 *
 * The walk reads own enumerable fields, which suits `oxc-parser` output. The
 * oxlint runtime exposes fields as getters, so the rule feeds
 * {@link makeAttachmentIndex} from visitors instead.
 *
 * **Example** (Index an empty program)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { attachmentOf } from "@beep/lint-rules/comment-grammar"
 *
 * console.log(HashSet.size(attachmentOf({ type: "Program", start: 0, end: 0 }).publicStarts)) // 0
 * ```
 *
 * @param program - The parsed ESTree `Program`, as plain objects.
 * @returns The attachment index for the file.
 * @category constructors
 * @since 0.1.0
 */
export const attachmentOf = (program: GrammarNode): CommentAttachment => {
  const index = makeAttachmentIndex(program);
  const visitChild = (child: unknown): void => {
    if (P.isObjectOrArray(child)) visit(child);
  };
  const visitNode = (node: GrammarNode): void => {
    index.enter(node);
    for (const key in node) if (!HashSet.has(SKIPPED_KEYS, key)) visitChild(field(node, key));
    index.exit(node);
  };
  const visit = (value: unknown): void => {
    if (P.isIterable(value) && !P.isString(value)) for (const item of value) visit(item);
    else if (isNode(value)) visitNode(value);
  };
  visit(program);
  return index.result();
};

const BLANK = /^\s$/;
const isBlankAt = (source: string, offset: number): boolean =>
  O.exists(Str.charAt(source, offset), (character) => BLANK.test(character));

const nextCodeOffset = (source: string, from: number, commentEnds: HashMap.HashMap<number, number>): number => {
  let offset = from;
  for (;;) {
    while (isBlankAt(source, offset)) offset++;
    const end = HashMap.get(commentEnds, offset);
    if (O.isNone(end)) return offset;
    offset = end.value;
  }
};

/**
 * Collapse a comment's value to the text the growth check compares.
 *
 * **Details**
 *
 * Leading `*` decoration on each line of a block comment is dropped and
 * whitespace runs collapse to one space, so re-indenting or re-wrapping a
 * comment keeps its text. A line comment keeps its stars, so `// * note` and
 * `// note` stay distinct. Delimiters are never part of the value.
 *
 * **Example** (Normalize a JSDoc block)
 *
 * ```ts
 * import { normalizeCommentText } from "@beep/lint-rules/comment-grammar"
 *
 * console.log(normalizeCommentText("*\n * Builds the\n *   request.\n ", "Block")) // "Builds the request."
 * console.log(normalizeCommentText(" * note", "Line")) // "* note"
 * ```
 *
 * @param value - Comment value without its `//`, `/*` or `*\/` delimiters.
 * @param syntax - Comment syntax; only `Block` comments lose their star decoration.
 * @returns The normalized text.
 * @category utilities
 * @since 0.1.0
 */
export const normalizeCommentText: {
  (syntax: CommentSyntax): (value: string) => string;
  (value: string, syntax: CommentSyntax): string;
} = F.dual(2, (value: string, syntax: CommentSyntax): string =>
  Str.trim(
    Str.replace(
      /\s+/g,
      " "
    )(
      syntax === "Block"
        ? A.join(
            A.map(Str.split(value, "\n"), (line) => Str.replace(/^\s*\*+/, "")(line)),
            " "
          )
        : value
    )
  )
);

const DIRECTIVE_PATTERNS: ReadonlyArray<RegExp> = [
  /^@ts-expect-error\b/,
  /^@ts-(?:check|nocheck)$/,
  /^biome-ignore(?:-all|-start|-end)?\s+\S/,
  /^fallow-ignore-(?:next-line|file)\s+\S/,
  /^@vitest-environment(?:-options)?\s+\S/,
  /^(?:istanbul|v8|c8) ignore\b/,
  /^node:coverage (?:disable|enable|ignore)\b/,
  /^[@#]__(?:PURE|NO_SIDE_EFFECTS|INLINE|NOINLINE|KEY)__$/,
  /^@vite-ignore$/,
  /^(?:webpack|turbopack)[A-Z]\w*:/,
  /^@jsx(?:ImportSource|Runtime|Frag)?\s+\S/,
  /^[#@]\s?source(?:MappingURL|URL)=/,
  /^(?:glsl|sql|html|css|graphql|gql)$/,
  /^@effect-diagnostics(?:-next-line)?\s+\S/,
  /^nosemgrep\b/,
  /^gitleaks:allow$/,
];
const SUPPRESSION = /^(oxlint|eslint)-(disable|enable)(-next-line|-line)?(?:\s+(.*))?$/;
const LICENSE =
  /SPDX-License-Identifier:\s*\S|\bCopyright(?:\s*(?:\([cC]\)|©|:)|\s+(?:\d{4}|[A-Z]))|\bLicensed under (?:the )?[A-Z]|\b(?:MIT|Apache) License\b|@license\b|@preserve\b/;
const PROVENANCE = /^(?:Ported from|Port of|Adapted from) \S/;
const GENERATED =
  /^(?:@generated\b|GENERATED FILE\b|DO NOT EDIT\b|Code generated by \S|Generated by \S|This file (?:is|was) (?:auto-?)?generated\b)/;
const PORT_MARKER = /^beep:\s*\S/;
const DECISION_POINTER = /^decision: [a-z0-9][a-z0-9-]*$/;
const HEADER_FIRST_TYPES = /^(?:ImportDeclaration|TSImportEqualsDeclaration|ExportAllDeclaration)$/;
const MODULE_TAG = /@packageDocumentation\b|@module\b|@fileoverview\b/;
const LIVE_TAG = /@(?:internal|public|expected-unused|ignore|deprecated)\b|import\.meta\.vitest/;

const suppressionKind = (text: string): O.Option<CommentKind> => {
  const match = SUPPRESSION.exec(text);
  if (match === null) return O.none();
  const [, tool, verb, scope, rest = ""] = match;
  const marker = O.getOrElse(Str.indexOf("--")(rest), () => Str.length(rest));
  const rules = A.filter(Str.split(Str.slice(0, marker)(rest), /[\s,]+/), Str.isNonEmpty);
  const reason = Str.trim(Str.slice(marker + 2)(rest));
  if (A.isReadonlyArrayEmpty(rules) || A.contains(rules, LAW_RULE)) return O.some("law-disable");
  if (tool === "oxlint" && verb === "disable" && scope === "-next-line" && Str.isNonEmpty(reason))
    return O.some("directive");
  return O.some("bad-suppression");
};

const directiveKind = (comment: SourceComment, text: string, trailing: () => boolean): O.Option<CommentKind> => {
  if (comment.type === "Line" && /^\/\s*<(?:reference|amd-module|amd-dependency)\s/.test(comment.value))
    return O.some("directive");
  if (/^@ts-ignore\b/.test(text)) return O.some("bad-suppression");
  const suppression = suppressionKind(text);
  if (O.isSome(suppression)) return suppression;
  if (A.some(DIRECTIVE_PATTERNS, (pattern) => pattern.test(text))) return O.some("directive");
  if (comment.type === "Line" && Str.endsWith("gitleaks:allow")(text) && trailing()) return O.some("directive");
  return O.none();
};

const isJSDoc = (comment: SourceComment): boolean =>
  comment.type === "Block" &&
  Str.startsWith("*")(comment.value) &&
  !Str.startsWith("**")(comment.value) &&
  comment.value !== "*";

const leadingRuns = (
  source: string,
  comments: ReadonlyArray<SourceComment>,
  firstCode: number
): ReadonlyArray<ReadonlyArray<SourceComment>> => {
  const leading = A.takeWhile(comments, (comment) => comment.end <= firstCode);
  let runs: ReadonlyArray<ReadonlyArray<SourceComment>> = [];
  let current: ReadonlyArray<SourceComment> = [];
  for (const comment of leading) {
    const previous = A.last(current);
    if (O.isSome(previous) && /\n[ \t]*\r?\n/.test(Str.slice(previous.value.end, comment.start)(source))) {
      runs = A.append(runs, current);
      current = [];
    }
    current = A.append(current, comment);
  }
  return A.isReadonlyArrayNonEmpty(current) ? A.append(runs, current) : runs;
};

/**
 * Input to {@link classifyComments}: one parsed file.
 *
 * **Details**
 *
 * `attachment` is optional; without it the program is walked with
 * {@link attachmentOf}.
 *
 * **Example** (Describe an empty file)
 *
 * ```ts
 * import { CommentGrammarInput } from "@beep/lint-rules/comment-grammar"
 *
 * const input = CommentGrammarInput.make({ source: "", program: { type: "Program", start: 0, end: 0 }, comments: [] })
 *
 * console.log(input.comments.length) // 0
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export class CommentGrammarInput extends S.Opaque<CommentGrammarInput, { readonly brand: unique symbol }>()(
  S.Struct({
    source: S.String,
    program: GrammarNode,
    comments: S.Array(SourceComment),
    attachment: S.optionalKey(CommentAttachment),
  }).pipe(
    $I.annoteSchema("CommentGrammarInput", {
      description: "One parsed file: source text, ESTree program, parser comments and an optional attachment index.",
    })
  )
) {}

const isHeaderFirst = (statement: GrammarNode): boolean =>
  HEADER_FIRST_TYPES.test(statement.type) ||
  (statement.type === "ExpressionStatement" && P.isString(field(statement, "directive")));

const isTrailing = (source: string, comment: SourceComment): boolean => {
  const before = Str.slice(0, comment.start)(source);
  const lineStart = O.getOrElse(Str.lastIndexOf("\n")(before), () => -1) + 1;
  return Str.isNonEmpty(Str.trim(Str.slice(lineStart)(before)));
};

interface FileFacts {
  readonly attachment: O.Option<CommentAttachment>;
  readonly commentEnds: HashMap.HashMap<number, number>;
  readonly headerFirst: boolean;
  readonly licensed: HashSet.HashSet<number>;
  readonly source: string;
}

interface KindProbe {
  readonly comment: SourceComment;
  readonly file: FileFacts;
  readonly leading: boolean;
  readonly text: string;
}

type KindRule = (probe: KindProbe) => O.Option<CommentKind>;

const when =
  (predicate: (probe: KindProbe) => boolean, kind: CommentKind): KindRule =>
  (probe) =>
    O.as(O.liftPredicate(probe, predicate), kind);

const isShebang = ({ comment, file }: KindProbe): boolean =>
  comment.type === "Shebang" || (comment.start === 0 && Str.startsWith("#!")(file.source));

const directiveRule: KindRule = ({ comment, text, file }) =>
  directiveKind(comment, text, () => isTrailing(file.source, comment));

const attachedRule: KindRule = ({ comment, file }) => {
  const target = nextCodeOffset(file.source, comment.end, file.commentEnds);
  const attached = O.getOrThrow(file.attachment);
  return HashSet.has(attached.publicStarts, target)
    ? O.some("jsdoc-export")
    : O.as(O.filter(HashMap.get(attached.memberStarts, target), P.isTruthy), "jsdoc-member");
};

const KIND_RULES: ReadonlyArray<KindRule> = [
  when(isShebang, "shebang"),
  directiveRule,
  when(({ comment, leading, file }) => leading && HashSet.has(file.licensed, comment.start), "license"),
  when(({ text }) => PROVENANCE.test(text), "provenance"),
  when(({ text, leading }) => leading && GENERATED.test(text), "generated-header"),
  when(({ text }) => PORT_MARKER.test(text), "port-marker"),
  when(({ comment, text }) => comment.type === "Line" && DECISION_POINTER.test(text), "decision-pointer"),
  when(({ comment }) => !isJSDoc(comment), "prose"),
  when(({ comment, leading, file }) => leading && (file.headerFirst || MODULE_TAG.test(comment.value)), "jsdoc-module"),
  attachedRule,
  when(({ comment }) => LIVE_TAG.test(comment.value), "jsdoc-tagged"),
];

const kindOf = (probe: KindProbe): CommentKind =>
  O.getOrElse(
    A.findFirst(KIND_RULES, (rule) => rule(probe)),
    (): CommentKind => "jsdoc-local"
  );

/**
 * Classify every comment of one parsed source file.
 *
 * **Details**
 *
 * Exports are resolved from the file's export declarations: a declaration
 * named by `export { x }`, `export default x` or `export = x` is public, and
 * a block written on an export specifier documents that export. A JSDoc
 * block attaches to the next code token after it, skipping whitespace and
 * other comments. Licence, generated-header and module blocks count only in
 * the leading run before the first statement; a leading JSDoc block above an
 * import, a re-export or a directive is a module header with or without
 * `@packageDocumentation`.
 *
 * **Example** (Classify a small file)
 *
 * ```ts
 * import { classifyComments, CommentGrammarInput, SourceComment } from "@beep/lint-rules/comment-grammar"
 *
 * const source = "// note\nconst x = 1\n"
 * const program = { type: "Program", start: 0, end: source.length, body: [] }
 * const comments = [SourceComment.make({ type: "Line", value: " note", start: 0, end: 7 })]
 *
 * console.log(classifyComments(CommentGrammarInput.make({ source, program, comments }))[0]?.kind) // "prose"
 * ```
 *
 * @param input - Source text, its parsed ESTree `Program` and the parser comments in source order.
 * @returns One classified comment per input comment, in the same order.
 * @category utilities
 * @since 0.1.0
 */
export const classifyComments = (input: CommentGrammarInput): ReadonlyArray<ClassifiedComment> => {
  const { source, program, comments } = input;
  if (A.isReadonlyArrayEmpty(comments)) return [];
  const body = nodesField(program, "body");
  const firstCode = O.getOrElse(
    O.map(A.head(body), (statement) => statement.start),
    () => source.length
  );
  const headerFirst = O.exists(A.head(body), isHeaderFirst);
  const runs = leadingRuns(source, comments, firstCode);
  const licensed = HashSet.fromIterable(
    A.flatMap(
      A.filter(runs, (run) => A.some(run, (comment) => LICENSE.test(comment.value))),
      (run: ReadonlyArray<SourceComment>) => A.map(run, (comment) => comment.start)
    )
  );
  const commentEnds = HashMap.fromIterable(A.map(comments, (comment) => [comment.start, comment.end] as const));
  const attachment = A.some(comments, isJSDoc)
    ? O.some(O.getOrElse(O.fromUndefinedOr(input.attachment), () => attachmentOf(program)))
    : O.none<CommentAttachment>();
  const file: FileFacts = { source, headerFirst, licensed, commentEnds, attachment };
  return A.map(comments, (comment) => {
    const text = normalizeCommentText(comment.value, comment.type);
    return ClassifiedComment.make({
      ...comment,
      kind: kindOf({ comment, text, leading: comment.end <= firstCode, file }),
      text,
    });
  });
};

/**
 * Report text for a banned comment kind, in the package's `Rule/Why/Fix` shape.
 *
 * **Example** (Read the prose message)
 *
 * ```ts
 * import { commentLawMessage } from "@beep/lint-rules/comment-grammar"
 *
 * console.log(commentLawMessage("prose").startsWith("Rule: no comments.")) // true
 * ```
 *
 * @param kind - The banned kind.
 * @returns The diagnostic message.
 * @category utilities
 * @since 0.1.0
 */
export const commentLawMessage = (kind: BannedCommentKind): string =>
  BannedCommentKind.match(kind, {
    prose: () =>
      "Rule: no comments. Why: nothing checks a comment, so it drifts or excuses the code under it. Fix: put it in a name, type, schema annotation, test title or assertion; record a decision under <package>/decisions/; fix a hack; then delete it with /delete-comment.",
    "jsdoc-local": () =>
      "Rule: JSDoc documents exported symbols only. Why: docgen never reads this block. Fix: delete it, or export the symbol if it is API.",
    "law-disable": () =>
      "Rule: beep/no-comments cannot be disabled in source. Why: a disable directive hides every comment after it. Fix: remove the directive.",
    "bad-suppression": () =>
      "Rule: a suppression is one line with a reason and names a tool this repo runs. Fix: fix the finding, or write `oxlint-disable-next-line <rule> -- <reason>`; never `@ts-ignore` or `eslint-disable`.",
  });
