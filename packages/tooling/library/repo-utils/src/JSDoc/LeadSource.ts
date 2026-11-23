/**
 * Single-source JSDoc leads: read an export's lead from its `$I.annote*`
 * description and tell when a written lead only restates it.
 *
 * **Details**
 *
 * Annotated schemas, their same-name type companions and barrels need no
 * written lead: docgen and the JSDoc inventory take it from the annotation
 * description. A written lead that adds nothing to that description, the
 * export's name or the documentation boilerplate is a restating lead.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { A, Str } from "@beep/utils";
import { dual, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import { Node } from "ts-morph";
import { ParseJSDocSectionsOptions, parseJSDocSections } from "./JSDocSections.ts";

const annotationMethodNames = HashSet.make("annote", "annoteSchema", "annoteClass", "annoteError", "annoteHttp");

const stopWords = HashSet.fromIterable(
  Str.split(
    "a an the of for in on to and or by with as is are be its it this that from into at which can may when used use",
    " "
  )
);

const boilerplateWords = HashSet.fromIterable(
  Str.split(
    "schema type runtime decoded encoded encode decode model value payload shape companion namespace data alias representation represent describe export re public surface entry barrel all api side codec class instance record struct literal union tagged variant definition define object interface field inheritdoc link level form plain wire",
    " "
  )
);

const stem = (word: string): string =>
  pipe(
    word,
    Str.replace(/ies$/u, "y"),
    Str.replace(/(?<=\w{3})(?:ing|ed)$/u, ""),
    Str.replace(/(?<=\w{2}[^s])s$/u, "")
  );

const contentWords = (text: string): ReadonlyArray<string> =>
  pipe(
    text,
    Str.replace(/\{@\w+\s+([^}|\s]+)[^}]*\}/gu, "$1"),
    Str.replace(/([a-z0-9])([A-Z])/gu, "$1 $2"),
    Str.replace(/([A-Z]+)([A-Z][a-z])/gu, "$1 $2"),
    Str.toLowerCase,
    Str.split(/[^a-z0-9]+/u),
    A.map(stem),
    A.filter((word) => word.length > 1 && !HashSet.has(stopWords, word))
  );

/**
 * Reads the lead paragraph of a raw JSDoc block.
 *
 * **Details**
 *
 * The lead is the prose before the first `**Section**` heading or block tag,
 * with its lines joined by single spaces.
 *
 * **Example** (Read the lead of a block)
 *
 * ```ts
 * import { jsDocLead } from "@beep/repo-utils/JSDoc/LeadSource"
 *
 * console.log(jsDocLead("/**\n * Party name.\n *\n * @since 0.0.0\n *" + "/")) // "Party name."
 * ```
 *
 * @param commentText - Raw JSDoc text, framing included.
 * @returns The lead text, or an empty string when the block has none.
 * @category parsing
 * @since 0.0.0
 */
export const jsDocLead = (commentText: string): string => {
  const { bodyLines, sections } = parseJSDocSections(ParseJSDocSectionsOptions.make({ commentText }));
  const leadLines = A.match(sections, {
    onEmpty: () => bodyLines,
    onNonEmpty: (all) => A.take(bodyLines, A.headNonEmpty(all).lineOffset - 1),
  });
  return pipe(leadLines, A.map(Str.trim), A.filter(Str.isNonEmpty), A.join(" "));
};

const restates = (lead: string, references: ReadonlyArray<string>): boolean => {
  const known = HashSet.fromIterable(A.flatMap(references, contentWords));
  const words = A.filter(contentWords(lead), (word) => !HashSet.has(boilerplateWords, word));
  const novel = A.filter(words, (word) => !HashSet.has(known, word)).length;
  return novel <= 1 || novel * 5 <= words.length;
};

/**
 * Tells whether a lead only restates its references.
 *
 * **Details**
 *
 * The lead's content words are compared with the words of the references
 * (the annotation description and the export's name). Stop words and
 * documentation boilerplate such as "schema", "decoded" or "type" never
 * count, and plural or past-tense endings are folded. The lead restates when
 * at most one of its content words is new, or new words are a fifth of its
 * content words or fewer.
 *
 * **Example** (Flag a lead that repeats the annotation)
 *
 * ```ts
 * import { leadRestates } from "@beep/repo-utils/JSDoc/LeadSource"
 *
 * console.log(leadRestates("Decoded NameKind type.", ["NameKind", "Kind of name a party is known by."])) // true
 * console.log(leadRestates("Names are dated claims, never party fields.", ["NameKind"])) // false
 * ```
 *
 * @param lead - Lead text of the documentation block.
 * @param references - The annotation description and the names the block documents.
 * @returns `true` when the lead adds nothing the references do not already say.
 * @category predicates
 * @since 0.0.0
 */
export const leadRestates: {
  (references: ReadonlyArray<string>): (lead: string) => boolean;
  (lead: string, references: ReadonlyArray<string>): boolean;
} = dual(2, restates);

const literalText = (node: Node | undefined): O.Option<string> =>
  node !== undefined && (Node.isStringLiteral(node) || Node.isNoSubstitutionTemplateLiteral(node))
    ? O.some(node.getLiteralText())
    : O.none();

const namesExport = (identifier: string, name: string): boolean =>
  identifier === name || Str.endsWith(`/${name}`)(identifier);

const descriptionProperty = (options: Node | undefined): O.Option<string> =>
  pipe(
    O.fromUndefinedOr(options),
    O.filter(Node.isObjectLiteralExpression),
    O.flatMap((object) => O.fromUndefinedOr(object.getProperty("description"))),
    O.filter(Node.isPropertyAssignment),
    O.flatMap((property) => literalText(property.getInitializer()))
  );

const annotationCallDescription =
  (name: string) =>
  (node: Node): O.Option<string> => {
    if (!Node.isCallExpression(node)) return O.none();
    const callee = node.getExpression();
    if (!Node.isPropertyAccessExpression(callee) || !HashSet.has(annotationMethodNames, callee.getName())) {
      return O.none();
    }
    const [identifier, options] = node.getArguments();
    return O.exists(literalText(identifier), (value) => namesExport(value, name))
      ? descriptionProperty(options)
      : O.none();
  };

/**
 * Reads the `$I.annote*` description a declaration gives itself.
 *
 * **Details**
 *
 * Only an `annote`, `annoteSchema`, `annoteClass`, `annoteError` or
 * `annoteHttp` call whose identifier is the export's name, or ends in
 * `/<name>`, counts, and only when its `description` is a string literal.
 * Annotations of nested field schemas carry other names and are skipped.
 *
 * **Example** (Read a schema's annotation description)
 *
 * ```ts
 * import { annotationDescription } from "@beep/repo-utils/JSDoc/LeadSource"
 * import * as O from "effect/Option"
 * import { Project } from "ts-morph"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "example.ts",
 *   'export const Name = S.String.pipe($I.annoteSchema("Name", { description: "A party name." }))'
 * )
 * const declaration = source.getVariableDeclarationOrThrow("Name")
 * console.log(O.getOrUndefined(annotationDescription(declaration, "Name"))) // "A party name."
 * ```
 *
 * @param declaration - The exported declaration to search.
 * @param name - The exported name the annotation identifier must carry.
 * @returns The annotation description, or `None` when the declaration has no matching annotation.
 * @category getters
 * @since 0.0.0
 */
export const annotationDescription: {
  (name: string): (declaration: Node) => O.Option<string>;
  (declaration: Node, name: string): O.Option<string>;
} = dual(
  2,
  (declaration: Node, name: string): O.Option<string> =>
    A.findFirst(declaration.getDescendants(), annotationCallDescription(name))
);

const isTypeLevelDeclaration = (node: Node): boolean =>
  Node.isTypeAliasDeclaration(node) || Node.isInterfaceDeclaration(node) || Node.isModuleDeclaration(node);

const companionOwnerName = (declaration: Node, name: string): string => {
  const block = declaration.getParent();
  const namespace = block?.getParent();
  return block !== undefined &&
    Node.isModuleBlock(block) &&
    namespace !== undefined &&
    Node.isModuleDeclaration(namespace)
    ? namespace.getName()
    : name;
};

const companionValueDescription = (declaration: Node, name: string): O.Option<string> => {
  const ownerName = companionOwnerName(declaration, name);
  const sourceFile = declaration.getSourceFile();
  return pipe(
    O.fromUndefinedOr<Node | undefined>(sourceFile.getVariableDeclaration(ownerName) ?? sourceFile.getClass(ownerName)),
    O.flatMap((value) => annotationDescription(value, ownerName))
  );
};

/**
 * Derives the lead of an export from its schema annotation.
 *
 * **Details**
 *
 * A value takes its own annotation description. A type alias, interface or
 * namespace takes the description of the same-name value in its file, and a
 * type inside a namespace (an `Encoded` companion) takes the description of
 * the value that names the namespace.
 *
 * **Example** (Derive the lead of a type companion)
 *
 * ```ts
 * import { derivedLead } from "@beep/repo-utils/JSDoc/LeadSource"
 * import * as O from "effect/Option"
 * import { Project } from "ts-morph"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "example.ts",
 *   [
 *     'export const Name = S.String.pipe($I.annoteSchema("Name", { description: "A party name." }))',
 *     "export type Name = typeof Name.Type",
 *   ].join("\n")
 * )
 * const companion = source.getTypeAliasOrThrow("Name")
 * console.log(O.getOrUndefined(derivedLead(companion, "Name"))) // "A party name."
 * ```
 *
 * @param declaration - The exported declaration whose lead is derived.
 * @param name - The name the declaration is exported under.
 * @returns The derived lead, or `None` when no annotation describes the export.
 * @category getters
 * @since 0.0.0
 */
export const derivedLead: {
  (name: string): (declaration: Node) => O.Option<string>;
  (declaration: Node, name: string): O.Option<string>;
} = dual(
  2,
  (declaration: Node, name: string): O.Option<string> =>
    isTypeLevelDeclaration(declaration)
      ? companionValueDescription(declaration, name)
      : annotationDescription(declaration, name)
);
