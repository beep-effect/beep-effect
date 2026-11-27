/**
 * Repo-owned JSDoc content and public declaration rules for oxlint.
 *
 * @packageDocumentation
 * @since 0.1.0
 */
import { $LintRulesId } from "@beep/identity/packages";
import { defineRule } from "@oxlint/plugins";
import { areDocsInformative } from "are-docs-informative";
import { parse, tokenizers } from "comment-parser";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { Context, ESTree, Visitor } from "@oxlint/plugins";
import type { Block, Spec } from "comment-parser";
import type { DocsRuleId } from "./docs.model.ts";

const $I = $LintRulesId.create("rules/docs-content");
const CategoryComment = S.String.check(S.isPattern(/@category\s+\S+/u)).pipe(
  $I.annoteSchema("CategoryComment", { description: "Documentation containing a nonempty category tag." })
);
const AttachedJSDocText = S.String.check(S.isPattern(/^\*\s/u)).pipe(
  $I.annoteSchema("AttachedJSDocText", { description: "A standard JSDoc opener followed by whitespace." })
);
const isAttachedJSDocText = S.is(AttachedJSDocText);
const declarationTypes = HashSet.fromIterable([
  "FunctionDeclaration",
  "TSDeclareFunction",
  "ClassDeclaration",
  "VariableDeclaration",
  "TSTypeAliasDeclaration",
  "TSInterfaceDeclaration",
  "TSMethodSignature",
  "TSPropertySignature",
]);
const ignoredDescriptionTags = HashSet.fromIterable(["inheritdoc", "inheritDoc"]);
const preferences = HashMap.fromIterable([
  ["return", "returns"],
  ["augments", "extends"],
]);
const parsed = (comment: ESTree.Comment): O.Option<Block> =>
  A.head(
    parse(`/*${comment.value}*/`, {
      spacing: "preserve",
      tokenizers: [
        tokenizers.tag(),
        (spec) => (HashSet.has(noTypeTags, spec.tag) ? spec : tokenizers.type("preserve")(spec)),
        (spec) => (HashSet.has(noNameTags, spec.tag) ? spec : tokenizers.name()(spec)),
        tokenizers.description("preserve"),
      ],
    })
  );
const isDoc = (comment: ESTree.Comment): boolean => comment.type === "Block" && Str.startsWith("*")(comment.value);
const commentsBefore = (context: Context, node: ESTree.Node): ReadonlyArray<ESTree.Comment> =>
  A.filter(context.sourceCode.getCommentsBefore(node), isDoc);
const parentOf = (node: ESTree.Node): O.Option<ESTree.Node> => O.fromNullishOr(node.parent);
const isExport = (node: ESTree.Node): boolean =>
  node.type === "ExportNamedDeclaration" || node.type === "ExportDefaultDeclaration";
const candidates = (node: ESTree.Node): ReadonlyArray<ESTree.Node> =>
  A.getSomes([O.some(node), parentOf(node), O.flatMap(parentOf(node), parentOf)]);
const documentationCandidates = (node: ESTree.Node): ReadonlyArray<ESTree.Node> =>
  A.filter(
    candidates(node),
    (candidate: ESTree.Node): boolean =>
      candidate === node || isExport(candidate) || candidate.type === "VariableDeclaration"
  );
const docsFor = (context: Context, node: ESTree.Node): ReadonlyArray<ESTree.Comment> =>
  A.flatMap(documentationCandidates(node), (candidate) => commentsBefore(context, candidate));
const hasAttachedDocumentation = (context: Context, node: ESTree.Node): boolean =>
  A.some(documentationCandidates(node), (candidate) => {
    const comments = context.sourceCode.getCommentsBefore(candidate);
    const block = A.findLast(comments, (comment) => comment.type === "Block");
    if (O.isNone(block) || !isAttachedJSDocText(block.value.value)) return false;
    const following = A.findFirst(comments, (comment) => comment.range[0] >= block.value.range[1]);
    const line = following.pipe(
      O.map((comment) => comment.loc.start.line),
      O.getOrElse(() => candidate.loc.start.line)
    );
    return line - block.value.loc.end.line <= 1;
  });
const precedingStatement = (node: ESTree.Node): O.Option<ESTree.Node> => {
  const outer = parentOf(node).pipe(
    O.filter(isExport),
    O.getOrElse(() => node)
  );
  return Match.value(outer.parent).pipe(
    Match.when({ type: Match.is("Program", "BlockStatement") }, (parent) =>
      A.findLast(parent.body, (statement) => statement.range[1] <= outer.range[0])
    ),
    Match.orElse(() => O.none())
  );
};
const previousOverload = (node: ESTree.Node): O.Option<ESTree.Node> =>
  Match.value(node).pipe(
    Match.when({ type: Match.is("FunctionDeclaration", "TSDeclareFunction") }, (fn) => {
      if (fn.id === null) return O.none();
      const name = fn.id.name;
      return precedingStatement(fn).pipe(
        O.flatMap((previous) =>
          previous.type === "ExportNamedDeclaration" ? O.fromNullishOr(previous.declaration) : O.some(previous)
        ),
        O.filter((previous) =>
          Match.value(previous).pipe(
            Match.when(
              { type: Match.is("FunctionDeclaration", "TSDeclareFunction") },
              (declaration) => declaration.body === null && declaration.id?.name === name
            ),
            Match.orElse(() => false)
          )
        )
      );
    }),
    Match.orElse(() => O.none())
  );
const hasPublicDocumentation = (context: Context, node: ESTree.Node): boolean => {
  let current = O.some(node);
  while (O.isSome(current)) {
    if (hasAttachedDocumentation(context, current.value)) return true;
    current = previousOverload(current.value);
  }
  return false;
};
const exported = (node: ESTree.Node): boolean => A.some(A.drop(candidates(node), 1), isExport);
const optionalNames = (node: ESTree.Node | null | undefined): ReadonlyArray<string> =>
  O.fromNullishOr(node).pipe(
    O.map(namesOf),
    O.getOrElse(() => [])
  );
const memberNames = (
  node: ESTree.MethodDefinition | ESTree.PropertyDefinition | Extract<ESTree.Node, { readonly type: "Property" }>
): ReadonlyArray<string> => [
  ...O.flatMap(parentOf(node), parentOf).pipe(
    O.map(namesOf),
    O.getOrElse(() => [])
  ),
  ...namesOf(node.key),
];
const declarationNames = (node: ESTree.Node): ReadonlyArray<string> => {
  if (!("id" in node) || !P.isObject(node.id) || !("type" in node.id)) return [];
  if (node.id.type !== "Identifier" || !("name" in node.id) || !P.isString(node.id.name)) return [];
  return [node.id.name];
};
const namesOf = (node: ESTree.Node): ReadonlyArray<string> =>
  Match.value(node).pipe(
    Match.discriminators("type")({
      Identifier: (value) => [value.name],
      ExportNamedDeclaration: (value) => optionalNames(value.declaration),
      ExportDefaultDeclaration: (value) => optionalNames(value.declaration),
      VariableDeclaration: (value) => A.flatMap(value.declarations, namesOf),
      VariableDeclarator: (value) => [...namesOf(value.id), ...optionalNames(value.init)],
      MethodDefinition: memberNames,
      PropertyDefinition: memberNames,
      Property: memberNames,
    }),
    Match.orElse(declarationNames)
  );
const functionOf = (node: ESTree.Node): O.Option<ESTree.Function | ESTree.ArrowFunctionExpression> =>
  Match.value(node).pipe(
    Match.when(
      { type: Match.is("FunctionDeclaration", "TSDeclareFunction", "FunctionExpression", "ArrowFunctionExpression") },
      O.some<ESTree.Function | ESTree.ArrowFunctionExpression>
    ),
    Match.discriminators("type")({
      ExportNamedDeclaration: (value) => O.flatMap(O.fromNullishOr(value.declaration), functionOf),
      ExportDefaultDeclaration: (value) => O.flatMap(O.fromNullishOr(value.declaration), functionOf),
      VariableDeclaration: (value) => O.flatMap(A.head(value.declarations), functionOf),
      VariableDeclarator: (value) => O.flatMap(O.fromNullishOr(value.init), functionOf),
    }),
    Match.when({ type: "MethodDefinition" }, (value) => O.some(value.value)),
    Match.orElse(O.none<ESTree.Function | ESTree.ArrowFunctionExpression>)
  );
const parameterName = (node: ESTree.Node): O.Option<string> => {
  if (node.type === "Identifier") return O.some(node.name);
  if (node.type === "AssignmentPattern") return parameterName(node.left);
  if (node.type === "RestElement") return parameterName(node.argument);
  if (node.type === "TSParameterProperty") return parameterName(node.parameter);
  return O.none();
};
const parameterNodes = (node: ESTree.Node): O.Option<ReadonlyArray<ESTree.ParamPattern>> => {
  if (node.type === "TSMethodSignature") return O.some(node.params);
  if (node.type === "TSPropertySignature") {
    const annotation = node.typeAnnotation?.typeAnnotation;
    if (annotation?.type === "TSFunctionType") return O.some(annotation.params);
  }
  return O.map(functionOf(node), (fn) => fn.params);
};
const tagsNamed = (block: Block, tag: string): ReadonlyArray<Spec> =>
  A.filter(block.tags, (entry) => entry.tag === tag);
const blank = (text: string): boolean => Str.isEmpty(Str.trim(text));
const informative = (text: string, names: ReadonlyArray<string>): boolean =>
  blank(text) ||
  areDocsInformative(Str.trim(text), A.join(names, " "), {
    aliases: { a: ["an", "our"] },
    uselessWords: ["a", "an", "i", "in", "of", "s", "the"],
  });

const publicExportNames = (node: ESTree.Statement): ReadonlyArray<string> =>
  Match.value(node).pipe(
    Match.discriminators("type")({
      ExportNamedDeclaration: (value) =>
        value.source === null ? A.map(value.specifiers, (specifier) => contextName(specifier.local)) : [],
      ExportDefaultDeclaration: (value) =>
        Match.value(value.declaration).pipe(
          Match.when({ type: "Identifier" }, (declaration) => [declaration.name]),
          Match.orElse(() => [])
        ),
    }),
    Match.orElse(() => [])
  );

const publicVisitor = (check: (node: ESTree.Node) => void): Visitor => {
  let publicNames = HashSet.empty<string>();
  const isModulePublic = (node: ESTree.Node): boolean =>
    node.parent?.type === "Program" && A.some(namesOf(node), (name) => HashSet.has(publicNames, name));
  const isPublicClass = (node: ESTree.Node): boolean =>
    exported(node) ||
    isModulePublic(node) ||
    (node.type === "ClassExpression" &&
      O.exists(
        parentOf(node),
        (parent) =>
          parent.type === "VariableDeclarator" && (exported(parent) || O.exists(parentOf(parent), isModulePublic))
      ));
  return {
    Program(program) {
      publicNames = HashSet.fromIterable(A.flatMap(program.body, publicExportNames));
    },
    ":matches(FunctionDeclaration, ClassDeclaration, VariableDeclaration, TSTypeAliasDeclaration, TSInterfaceDeclaration)"(
      node
    ) {
      if (
        exported(node) ||
        ((node.type === "FunctionDeclaration" || node.type === "ClassDeclaration") && isModulePublic(node))
      )
        check(node);
    },
    MethodDefinition(node) {
      if (node.kind === "constructor" || node.accessibility === "private" || node.key.type === "PrivateIdentifier")
        return;
      const owner = O.flatMap(parentOf(node), parentOf);
      if (O.exists(owner, isPublicClass)) check(node);
    },
  };
};

type CommentCheck = (context: Context, comment: ESTree.Comment, block: Block, node: O.Option<ESTree.Node>) => void;
const reportComment = (context: Context, comment: ESTree.Comment, message: string): void =>
  context.report({ loc: comment.loc, message });
const attachedNode = (
  context: Context,
  comment: ESTree.Comment,
  comments: ReadonlyArray<ESTree.Comment>
): O.Option<ESTree.Node> => {
  const token = O.filter(
    O.fromNullishOr(context.sourceCode.getTokenAfter(comment)),
    (value) => !A.some(comments, (other) => other.range[0] > comment.range[0] && other.range[1] <= value.range[0])
  );
  return token.pipe(
    O.flatMap((value) => O.fromNullishOr(context.sourceCode.getNodeByRangeIndex(value.range[0]))),
    O.flatMap((value) => A.findFirst(candidates(value), isDocumentationDeclaration))
  );
};
const isDocumentationDeclaration = (node: ESTree.Node): boolean =>
  HashSet.has(declarationTypes, node.type) || isExport(node) || O.isSome(functionOf(node));
const commentVisitor = (context: Context, check: CommentCheck): Visitor => ({
  Program() {
    const comments = A.filter(context.sourceCode.getAllComments(), isDoc);
    for (const comment of comments) {
      const block = parsed(comment);
      if (O.isSome(block)) check(context, comment, block.value, attachedNode(context, comment, comments));
    }
  },
});
const checkInformativeDocs: CommentCheck = (context, comment, block, node) => {
  const names = node.pipe(
    O.map(namesOf),
    O.getOrElse(() => [])
  );
  if (!informative(block.description, names))
    reportComment(context, comment, "This description only repeats the name it describes.");
  for (const tag of block.tags) {
    if (!informative(tag.description, [...names, tag.name]))
      reportComment(context, comment, "This tag description only repeats the name it describes.");
  }
};
const removableLeadingLines = (block: Block): number => {
  const lines = A.takeWhile(A.drop(block.source, 1), (line) => blank(line.tokens.tag) && blank(line.tokens.end));
  const leading = A.length(A.takeWhile(lines, (line) => blank(line.tokens.description)));
  if (block.tags.length > 0) return leading;
  return leading === lines.length ? leading - 1 : leading;
};
const checkBlankDescription: CommentCheck = (context, comment, block) => {
  if (removableLeadingLines(block) > 0)
    reportComment(context, comment, "There should be no extra blank lines at the start of block descriptions.");
};
const checkInlineTags = (context: Context, comment: ESTree.Comment): void => {
  for (const match of Str.matchAll(/\{@(\w+)/gu)(comment.value)) {
    const tag = match[1];
    if (tag !== undefined && !HashSet.has(inlineTags, tag))
      reportComment(context, comment, `Invalid JSDoc inline tag name '${tag}'.`);
  }
};
const checkTagNames: CommentCheck = (context, comment, block) => {
  checkInlineTags(context, comment);
  for (const tag of block.tags) {
    if (!HashSet.has(validTags, tag.tag)) reportComment(context, comment, `Invalid JSDoc tag name '${tag.tag}'.`);
    const preference = HashMap.get(preferences, tag.tag);
    if (O.isSome(preference))
      reportComment(
        context,
        comment,
        `Invalid JSDoc tag (preference). Replace '${tag.tag}' with '${preference.value}'.`
      );
  }
};
const hasInheritedDescription = (block: Block): boolean =>
  A.some(block.tags, (tag) => HashSet.has(ignoredDescriptionTags, tag.tag));
const hasDescription = (comment: ESTree.Comment): boolean =>
  O.exists(parsed(comment), (block) => !blank(block.description) || hasInheritedDescription(block));
const declarationVisitor = (check: (node: ESTree.Node) => void): Visitor => ({
  ":matches(FunctionDeclaration, ClassDeclaration, VariableDeclaration, TSTypeAliasDeclaration, TSInterfaceDeclaration)":
    check,
});
const requireCategoryTag = (context: Context): Visitor =>
  declarationVisitor((node) => {
    if (!exported(node)) return;
    if (A.some(docsFor(context, node), (comment) => S.is(CategoryComment)(comment.value))) return;
    context.report({
      node,
      message: `Exported symbol '${A.head(namesOf(node)).pipe(O.getOrElse(() => "exported symbol"))}' must include a @category tag in its JSDoc block.`,
    });
  });
const annotationMethodNames = HashSet.make("annote", "annoteSchema", "annoteClass", "annoteError", "annoteHttp");
const literalText = (node: ESTree.Node | null | undefined): O.Option<string> =>
  O.flatMap(O.fromNullishOr(node), (value) =>
    Match.value(value).pipe(
      Match.discriminators("type")({
        Literal: (literal) => (P.isString(literal.value) ? O.some(literal.value) : O.none()),
        TemplateLiteral: (template) =>
          A.isReadonlyArrayEmpty(template.expressions)
            ? A.head(template.quasis).pipe(O.flatMap((quasi) => O.fromNullishOr(quasi.value.cooked)))
            : O.none(),
      }),
      Match.orElse(() => O.none())
    )
  );
const propertyKeyText = (key: ESTree.Node): O.Option<string> =>
  key.type === "Identifier" ? O.some(key.name) : literalText(key);
const hasDescriptionOption = (options: ESTree.Node | undefined): boolean =>
  options?.type === "ObjectExpression" &&
  A.some(
    options.properties,
    (property) =>
      property.type === "Property" &&
      O.contains(propertyKeyText(property.key), "description") &&
      O.isSome(literalText(property.value))
  );
const isAnnotationMethod = (callee: ESTree.Node): boolean =>
  callee.type === "MemberExpression" &&
  !callee.computed &&
  callee.property.type === "Identifier" &&
  HashSet.has(annotationMethodNames, callee.property.name);
const describesName =
  (call: ESTree.CallExpression) =>
  (name: string): boolean =>
    isAnnotationMethod(call.callee) &&
    O.exists(
      literalText(call.arguments[0]),
      (identifier) => identifier === name || Str.endsWith(`/${name}`)(identifier)
    ) &&
    hasDescriptionOption(call.arguments[1]);
const ancestors = (node: ESTree.Node): ReadonlyArray<ESTree.Node> =>
  O.match(parentOf(node), { onNone: () => [], onSome: (parent) => [parent, ...ancestors(parent)] });
const enclosingDeclarationNames = (node: ESTree.Node): ReadonlyArray<string> =>
  A.flatMap(
    A.filter(
      ancestors(node),
      (ancestor) => ancestor.type === "VariableDeclarator" || ancestor.type === "ClassDeclaration"
    ),
    declarationNames
  );
const enclosingNamespaceNames = (node: ESTree.Node): ReadonlyArray<string> =>
  A.flatMap(
    A.filter(ancestors(node), (ancestor) => ancestor.type === "TSModuleDeclaration"),
    declarationNames
  );
const requireDescription = (context: Context): Visitor => {
  let derivedLeadNames = HashSet.empty<string>();
  let missing: ReadonlyArray<ESTree.Node> = [];
  const hasDerivedLead = (node: ESTree.Node): boolean =>
    A.some([...namesOf(node), ...enclosingNamespaceNames(node)], (name) => HashSet.has(derivedLeadNames, name));
  return {
    CallExpression(call) {
      derivedLeadNames = HashSet.union(
        derivedLeadNames,
        HashSet.fromIterable(A.filter(enclosingDeclarationNames(call), describesName(call)))
      );
    },
    ...declarationVisitor((node) => {
      if (!exported(node) || Str.includes("/tag-values/")(context.filename)) return;
      const comments = node.type === "VariableDeclaration" ? commentsBefore(context, node) : docsFor(context, node);
      if (A.isReadonlyArrayNonEmpty(comments) && !A.some(comments, hasDescription)) missing = A.append(missing, node);
    }),
    "Program:exit"() {
      A.forEach(
        A.filter(missing, (candidate) => !hasDerivedLead(candidate)),
        (node) => context.report({ node, message: "Missing JSDoc block description." })
      );
    },
  };
};
const requireJsdoc = (context: Context): Visitor =>
  publicVisitor((node) => {
    if (!hasPublicDocumentation(context, node)) context.report({ node, message: "Missing JSDoc comment." });
  });
const requireFileOverview = (context: Context): Visitor => ({
  Program() {
    if (!Str.endsWith("/src/index.ts")(context.filename)) return;
    const comments = A.filter(context.sourceCode.getAllComments(), isDoc);
    const firstToken = context.sourceCode.getFirstToken(context.sourceCode.ast);
    const initial = A.filter(comments, (comment) => firstToken === null || comment.range[1] <= firstToken.range[0]);
    if (!A.some(initial, (comment) => Str.includes("@packageDocumentation")(comment.value)))
      context.report({ node: context.sourceCode.ast, message: "Missing initial @packageDocumentation overview." });
  },
});
const checkShortTag = (context: Context, comment: ESTree.Comment, tag: Spec): void => {
  if (tag.tag !== "param" && tag.tag !== "returns") return;
  if (!blank(tag.description) && Str.trim(tag.description).length < 5)
    reportComment(context, comment, `${tag.tag} description must be at least 5 characters.`);
};
const checkMatchDescription: CommentCheck = (context, comment, block, node) => {
  if (O.isNone(O.flatMap(node, functionOf)) || Str.includes("/tag-values/")(context.filename)) return;
  if (!blank(block.description) && Str.trim(block.description).length < 20)
    reportComment(context, comment, "JSDoc description must be at least 20 characters.");
  for (const tag of block.tags) checkShortTag(context, comment, tag);
};
const checkTagDescription =
  (tagName: string): CommentCheck =>
  (context, comment, block, node) => {
    if (O.isNone(O.flatMap(node, functionOf))) return;
    for (const tag of tagsNamed(block, tagName)) {
      if (blank(tag.description)) reportComment(context, comment, `Missing JSDoc @${tagName} description.`);
    }
  };
const checkDuplicateParams = (context: Context, comment: ESTree.Comment, params: ReadonlyArray<Spec>): boolean => {
  let seen = HashSet.empty<string>();
  for (const tag of params) {
    if (HashSet.has(seen, tag.name)) {
      reportComment(context, comment, `Duplicate @param '${tag.name}'.`);
      return false;
    }
    seen = HashSet.add(seen, tag.name);
  }
  return true;
};
const checkRootParam = (
  context: Context,
  comment: ESTree.Comment,
  tag: Spec,
  name: O.Option<O.Option<string>>
): boolean => {
  if (O.isNone(name)) {
    reportComment(context, comment, `@param '${tag.name}' does not match an existing function parameter.`);
    return false;
  }
  if (O.exists(name.value, (value) => value !== tag.name)) {
    reportComment(
      context,
      comment,
      `Expected @param name to be '${O.getOrElse(name.value, () => "")}'. Got '${tag.name}'.`
    );
    return false;
  }
  return true;
};
const checkRootParams = (
  context: Context,
  comment: ESTree.Comment,
  roots: ReadonlyArray<Spec>,
  expected: ReadonlyArray<O.Option<string>>
): boolean => {
  const actual = A.map(roots, (tag) => tag.name);
  const filtered = A.filter(expected, (name) => !(O.contains(name, "this") && !A.contains(actual, "this")));
  return A.every(roots, (tag, index) => checkRootParam(context, comment, tag, A.get(filtered, index)));
};
const checkParamPaths = (context: Context, comment: ESTree.Comment, params: ReadonlyArray<Spec>): void => {
  let lastRoot = O.none<string>();
  for (const tag of params) {
    if (!Str.includes(".")(tag.name)) {
      lastRoot = O.some(tag.name);
      continue;
    }
    const root = Str.replace(/\[\]$/u, "")(A.head(Str.split(tag.name, ".")).pipe(O.getOrElse(() => "")));
    if (!O.contains(lastRoot, root)) {
      reportComment(context, comment, `@param path '${tag.name}' must follow its real parameter '${root}'.`);
      return;
    }
  }
};
const checkParamNames: CommentCheck = (context, comment, block, node) => {
  const parameters = O.flatMap(node, parameterNodes);
  if (O.isNone(parameters)) return;
  const params = tagsNamed(block, "param");
  const roots = A.filter(params, (tag) => !Str.includes(".")(tag.name));
  if (!checkDuplicateParams(context, comment, params)) return;
  if (!checkRootParams(context, comment, roots, A.map(parameters.value, parameterName))) return;
  checkParamPaths(context, comment, params);
};
const checkRequireParam: CommentCheck = (context, comment, block, node) => {
  const fn = O.flatMap(node, functionOf);
  if (O.isNone(fn) || hasInheritedDescription(block)) return;
  const actual = A.map(
    A.filter(tagsNamed(block, "param"), (tag) => !Str.includes(".")(tag.name)),
    (tag) => tag.name
  );
  const expected = A.getSomes(A.map(fn.value.params, parameterName));
  for (const name of expected) {
    if (name !== "this" && !A.contains(actual, name))
      reportComment(context, comment, `Missing JSDoc @param '${name}' declaration.`);
  }
};
const typedReturnValue = (fn: ESTree.Function | ESTree.ArrowFunctionExpression): boolean => {
  const type = fn.returnType?.typeAnnotation;
  return type !== undefined && type.type !== "TSVoidKeyword" && type.type !== "TSNeverKeyword";
};
const RETURN_WITH_VALUE_ON_SAME_LINE = /\breturn\b[ \t]*[^\s;}]/;
const returnsValue = (context: Context, fn: ESTree.Function | ESTree.ArrowFunctionExpression): boolean =>
  fn.async ||
  (fn.type === "ArrowFunctionExpression" && fn.body?.type !== "BlockStatement") ||
  typedReturnValue(fn) ||
  RETURN_WITH_VALUE_ON_SAME_LINE.test(
    O.fromNullishOr(fn.body).pipe(
      O.map(context.sourceCode.getText),
      O.getOrElse(() => "")
    )
  );
const checkRequireReturns: CommentCheck = (context, comment, block, node) => {
  const fn = O.flatMap(node, functionOf);
  if (O.isNone(fn) || hasInheritedDescription(block) || A.isReadonlyArrayNonEmpty(tagsNamed(block, "returns"))) return;
  if (returnsValue(context, fn.value)) reportComment(context, comment, "Missing JSDoc @returns declaration.");
};
const ruleVisitors: Readonly<Record<Exclude<DocsRuleId, "tsdoc-syntax">, (context: Context) => Visitor>> = {
  "require-jsdoc": requireJsdoc,
  "require-category-tag": requireCategoryTag,
  "require-description": requireDescription,
  "require-file-overview": requireFileOverview,
  "informative-docs": (context) => commentVisitor(context, checkInformativeDocs),
  "no-blank-block-descriptions": (context) => commentVisitor(context, checkBlankDescription),
  "check-tag-names": (context) => commentVisitor(context, checkTagNames),
  "check-param-names": (context) => commentVisitor(context, checkParamNames),
  "match-description": (context) => commentVisitor(context, checkMatchDescription),
  "require-param": (context) => commentVisitor(context, checkRequireParam),
  "require-returns": (context) => commentVisitor(context, checkRequireReturns),
  "require-param-description": (context) => commentVisitor(context, checkTagDescription("param")),
  "require-returns-description": (context) => commentVisitor(context, checkTagDescription("returns")),
};

/**
 * Build one content or declaration documentation rule without an ESLint dependency.
 *
 * **Details**
 *
 * `require-jsdoc` checks exported declarations, declarations a local export
 * specifier or default export names, and the public methods of such classes;
 * constructors and private methods are exempt. `check-tag-names` accepts the
 * eslint-plugin-jsdoc TypeScript-mode vocabulary, aliases included, and reports
 * a tag that has a preferred spelling. `require-returns` counts a `return`
 * only when a value follows on the same line: a bare `return` before a newline
 * returns undefined. `tsdoc-syntax` is the separate parser-backed rule.
 *
 * **Example** (Inspect a documentation rule)
 * ```ts
 * import { docsRule } from "@beep/lint-rules/oxlint-docs"
 * console.log(docsRule("require-jsdoc").meta?.type)
 * ```
 * @param id - Documentation rule identifier.
 * @returns The oxlint rule implementation.
 * @category tools
 * @since 0.1.0
 */
export const docsRule = (id: Exclude<DocsRuleId, "tsdoc-syntax">) =>
  defineRule({
    meta: { type: "problem", docs: { description: `Repository documentation policy: ${id}.` } },
    create: ruleVisitors[id],
  });

const validTags = HashSet.fromIterable([
  "modifies",
  "abstract",
  "virtual",
  "access",
  "alias",
  "async",
  "augments",
  "extends",
  "author",
  "borrows",
  "callback",
  "class",
  "constructor",
  "classdesc",
  "constant",
  "const",
  "constructs",
  "copyright",
  "default",
  "defaultvalue",
  "defaultValue",
  "deprecated",
  "description",
  "desc",
  "enum",
  "event",
  "example",
  "exports",
  "external",
  "host",
  "file",
  "fileoverview",
  "overview",
  "fires",
  "emits",
  "function",
  "func",
  "method",
  "generator",
  "global",
  "hideconstructor",
  "ignore",
  "implements",
  "inheritdoc",
  "inheritDoc",
  "inner",
  "instance",
  "interface",
  "kind",
  "lends",
  "license",
  "listens",
  "member",
  "var",
  "memberof",
  "memberof!",
  "mixes",
  "mixin",
  "module",
  "name",
  "namespace",
  "override",
  "package",
  "param",
  "arg",
  "argument",
  "private",
  "property",
  "prop",
  "protected",
  "public",
  "readonly",
  "requires",
  "returns",
  "return",
  "see",
  "since",
  "static",
  "summary",
  "this",
  "throws",
  "exception",
  "todo",
  "tutorial",
  "type",
  "typedef",
  "variation",
  "version",
  "yields",
  "yield",
  "alpha",
  "beta",
  "decorator",
  "eventProperty",
  "experimental",
  "packageDocumentation",
  "privateRemarks",
  "remarks",
  "sealed",
  "category",
  "categoryDescription",
  "disableGroups",
  "document",
  "expand",
  "expandType",
  "group",
  "groupDescription",
  "hidden",
  "hideCategories",
  "hideGroups",
  "inline",
  "inlineType",
  "mergeModuleWith",
  "preventExpand",
  "preventInline",
  "primaryExport",
  "showCategories",
  "showGroups",
  "sortStrategy",
  "useDeclaredType",
  "import",
  "internal",
  "jsx",
  "overload",
  "satisfies",
  "template",
  "typeParam",
  "domain",
  "provides",
  "depends",
  "errors",
  "effects",
  "precondition",
  "postcondition",
  "invariant",
]);

const noNameTags = HashSet.fromIterable([
  "access",
  "author",
  "default",
  "defaultvalue",
  "defaultValue",
  "description",
  "example",
  "exception",
  "file",
  "fileoverview",
  "kind",
  "license",
  "overview",
  "return",
  "returns",
  "since",
  "summary",
  "throws",
  "version",
  "variation",
]);
const noTypeTags = HashSet.fromIterable([
  "default",
  "defaultvalue",
  "defaultValue",
  "description",
  "example",
  "file",
  "fileoverview",
  "license",
  "overview",
  "see",
  "summary",
]);
const contextName = (name: ESTree.ModuleExportName): string => (name.type === "Identifier" ? name.name : name.value);

const inlineTags = HashSet.fromIterable([
  "link",
  "linkcode",
  "linkplain",
  "tutorial",
  "inheritDoc",
  "label",
  "include",
  "includeCode",
]);
