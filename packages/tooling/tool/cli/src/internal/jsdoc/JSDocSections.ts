import { $RepoCliId } from "@beep/identity/packages";
import { extractFencedCodeBlocks } from "@beep/repo-docgen/Core";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { getSomesStruct } from "@beep/utils/Option";
import { MutableHashMap } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Node } from "ts-morph";
import type { SourceFile } from "ts-morph";

const $I = $RepoCliId.create("internal/jsdoc/JSDocSections");

/**
 * Models one raw JSDoc block and its exact source offsets.
 *
 * **Example** (Create a raw span)
 *
 * ```ts
 * import { RawJSDocSpan } from "@beep/repo-cli/test/Docgen"
 *
 * const span = RawJSDocSpan.make({ start: 0, end: 11, text: "/** Doc. *" + "/" })
 * console.log(span.start) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RawJSDocSpan extends S.Class<RawJSDocSpan>($I`RawJSDocSpan`)(
  {
    start: S.Natural,
    end: S.Natural,
    text: S.String,
  },
  $I.annote("RawJSDocSpan", {
    description: "One raw JSDoc block paired with its exact source start and end offsets.",
  })
) {}

const fenceState = (line: string, openFence: string | undefined): readonly [string | undefined, boolean] => {
  const match = /^\s*(`{3,}|~{3,})(.*)$/.exec(line);
  const fence = match === null ? undefined : match[1];
  if (openFence === undefined) {
    return [fence, fence !== undefined];
  }
  if (fence === undefined) {
    return [openFence, true];
  }
  if (fence[0] === openFence[0] && fence.length >= openFence.length && Str.isEmpty(Str.trim(match?.[2] ?? ""))) {
    return [undefined, true];
  }
  return [openFence, true];
};

/**
 * Advances the fenced-code-block scanner for one stripped JSDoc line.
 *
 * **Example** (Track an opening and closing fence)
 *
 * ```ts
 * import { fencedLineState } from "@beep/repo-cli/test/Docgen"
 *
 * const [open] = fencedLineState("```ts", undefined)
 * console.log(fencedLineState("```", open)[0]) // undefined
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const fencedLineState: {
  (openFence: string | undefined): (line: string) => readonly [string | undefined, boolean];
  (line: string, openFence: string | undefined): readonly [string | undefined, boolean];
} = dual(2, fenceState);

const jsdocCommentEnd = (sourceText: string, start: number): number => {
  let cursor = start + 3;
  let openFence: string | undefined;
  while (cursor < sourceText.length) {
    const nextLineBreak = sourceText.indexOf("\n", cursor);
    const lineEnd = nextLineBreak === -1 ? sourceText.length : nextLineBreak;
    const rawLine = sourceText.slice(cursor, lineEnd);
    const line = Str.trimEnd(Str.replace(/^\s*\*\s?/, "")(rawLine));
    const [nextOpenFence, isFenced] = fencedLineState(line, openFence);
    openFence = nextOpenFence;
    if (!isFenced) {
      const closingOffset = rawLine.indexOf("*/");
      if (closingOffset !== -1) {
        return cursor + closingOffset + 2;
      }
    }
    cursor = lineEnd + 1;
  }
  return sourceText.length;
};

/**
 * Extracts complete line-leading JSDoc blocks while ignoring delimiters inside fenced examples.
 *
 * **Example** (Extract one comment)
 *
 * ```ts
 * import { jsdocCommentsFromSource } from "@beep/repo-cli/test/Docgen"
 *
 * console.log(jsdocCommentsFromSource("/** Documentation. *" + "/\nexport const value = 1").length) // 1
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const jsdocCommentsFromSource = (sourceText: string): ReadonlyArray<string> => {
  const comments: Array<string> = [];
  let cursor = 0;
  while (cursor < sourceText.length) {
    const relativeStart = sourceText.slice(cursor).indexOf("/**");
    if (relativeStart === -1) {
      break;
    }
    const start = cursor + relativeStart;
    const lineStart = sourceText.lastIndexOf("\n", start - 1) + 1;
    const linePrefix = sourceText.slice(lineStart, start);
    const afterOpener = sourceText[start + 3];
    const lineLeading = /^[ \t]*$/.test(linePrefix);
    const plausibleBody =
      afterOpener === undefined ||
      afterOpener === "\n" ||
      afterOpener === "\r" ||
      afterOpener === " " ||
      afterOpener === "\t" ||
      afterOpener === "*";
    if (!lineLeading || !plausibleBody) {
      cursor = start + 3;
      continue;
    }
    const end = jsdocCommentEnd(sourceText, start);
    A.appendInPlace(comments, sourceText.slice(start, end));
    cursor = end;
  }
  return comments;
};

/**
 * Locates raw JSDoc blocks and their exact source offsets.
 *
 * **Example** (Locate a comment span)
 *
 * ```ts
 * import { rawJSDocSpans } from "@beep/repo-cli/test/Docgen"
 *
 * console.log(rawJSDocSpans("/** Documentation. *" + "/")[0]?.start) // 0
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const rawJSDocSpans = (sourceText: string): ReadonlyArray<RawJSDocSpan> => {
  const spans: Array<RawJSDocSpan> = [];
  let cursor = 0;
  for (const text of jsdocCommentsFromSource(sourceText)) {
    const start = sourceText.indexOf(text, cursor);
    if (start === -1) {
      break;
    }
    A.appendInPlace(spans, RawJSDocSpan.make({ start, end: start + text.length, text }));
    cursor = start + text.length;
  }
  return spans;
};

type NodeNameReader = (node: Node) => O.Option<string>;

const variableStatementName: NodeNameReader = (node) =>
  Node.isVariableStatement(node) ? O.fromUndefinedOr(node.getDeclarations()[0]?.getName()) : O.none();
const constructorName: NodeNameReader = (node) =>
  Node.isConstructorDeclaration(node) ? O.some("constructor") : O.none();
const exportAssignmentName: NodeNameReader = (node) => (Node.isExportAssignment(node) ? O.some("<default>") : O.none());
const moduleName: NodeNameReader = (node) => (Node.isModuleDeclaration(node) ? O.some(node.getName()) : O.none());
const variableDeclarationName: NodeNameReader = (node) =>
  Node.isVariableDeclaration(node) ? O.some(node.getName()) : O.none();
const bindingElementName: NodeNameReader = (node) => (Node.isBindingElement(node) ? O.some(node.getName()) : O.none());
const enumMemberName: NodeNameReader = (node) => (Node.isEnumMember(node) ? O.some(node.getName()) : O.none());
const methodName: NodeNameReader = (node) => (Node.isMethodDeclaration(node) ? O.some(node.getName()) : O.none());
const methodSignatureName: NodeNameReader = (node) =>
  Node.isMethodSignature(node) ? O.some(node.getName()) : O.none();
const propertyName: NodeNameReader = (node) => (Node.isPropertyDeclaration(node) ? O.some(node.getName()) : O.none());
const propertySignatureName: NodeNameReader = (node) =>
  Node.isPropertySignature(node) ? O.some(node.getName()) : O.none();
const getAccessorName: NodeNameReader = (node) =>
  Node.isGetAccessorDeclaration(node) ? O.some(node.getName()) : O.none();
const setAccessorName: NodeNameReader = (node) =>
  Node.isSetAccessorDeclaration(node) ? O.some(node.getName()) : O.none();
const functionName: NodeNameReader = (node) =>
  Node.isFunctionDeclaration(node) ? O.some(node.getName() ?? "<default>") : O.none();
const className: NodeNameReader = (node) =>
  Node.isClassDeclaration(node) ? O.some(node.getName() ?? "<default>") : O.none();
const interfaceName: NodeNameReader = (node) =>
  Node.isInterfaceDeclaration(node) ? O.some(node.getName() ?? "<default>") : O.none();
const typeAliasName: NodeNameReader = (node) =>
  Node.isTypeAliasDeclaration(node) ? O.some(node.getName() ?? "<default>") : O.none();
const enumName: NodeNameReader = (node) =>
  Node.isEnumDeclaration(node) ? O.some(node.getName() ?? "<default>") : O.none();

const nodeNameReaders: ReadonlyArray<NodeNameReader> = [
  variableStatementName,
  constructorName,
  exportAssignmentName,
  moduleName,
  variableDeclarationName,
  bindingElementName,
  enumMemberName,
  methodName,
  methodSignatureName,
  propertyName,
  propertySignatureName,
  getAccessorName,
  setAccessorName,
  functionName,
  className,
  interfaceName,
  typeAliasName,
  enumName,
];

/**
 * Resolves the declaration-owned name used to anchor a JSDoc block.
 *
 * **Example** (Resolve a variable statement name)
 *
 * ```ts
 * import { ownJSDocNodeName } from "@beep/repo-cli/test/Docgen"
 * import * as O from "effect/Option"
 * import { Project } from "ts-morph"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile("example.ts", "const value = 1")
 * console.log(O.getOrElse(ownJSDocNodeName(source.getVariableStatementOrThrow("value")), () => "missing"))
 * // "value"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const ownJSDocNodeName = (node: Node): O.Option<string> =>
  A.findFirst(nodeNameReaders, (reader) => reader(node));

const recordJsDocOwner = (node: Node, owners: MutableHashMap.MutableHashMap<number, Node>): void => {
  if (!Node.isJSDocable(node)) return;
  for (const doc of node.getJsDocs()) {
    if (!MutableHashMap.has(owners, doc.getStart())) {
      MutableHashMap.set(owners, doc.getStart(), node);
    }
  }
};

const recordBindingElementOwner = (node: Node, owners: MutableHashMap.MutableHashMap<number, Node>): void => {
  if (!Node.isBindingElement(node)) return;
  for (const range of node.getLeadingCommentRanges()) {
    if (Str.startsWith("/**")(range.getText()) && !MutableHashMap.has(owners, range.getPos())) {
      MutableHashMap.set(owners, range.getPos(), node);
    }
  }
};

/**
 * Indexes JSDoc comment starts by the ts-morph node that owns each block.
 *
 * **Example** (Index a documented declaration)
 *
 * ```ts
 * import { jsdocOwnersByStart } from "@beep/repo-cli/test/Docgen"
 * import { MutableHashMap } from "effect"
 * import { Project } from "ts-morph"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "example.ts",
 *   "/** Doc. *" + "/\nconst value = 1"
 * )
 *
 * console.log(MutableHashMap.size(jsdocOwnersByStart(source)) > 0) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const jsdocOwnersByStart = (sourceFile: SourceFile): MutableHashMap.MutableHashMap<number, Node> => {
  const owners = MutableHashMap.empty<number, Node>();
  sourceFile.forEachDescendant((node) => {
    recordJsDocOwner(node, owners);
    recordBindingElementOwner(node, owners);
  });
  return owners;
};

export const JSDocSectionName = LiteralKit(["When to use", "Details", "Gotchas", "Example"]).pipe(
  $I.annoteSchema("JSDocSectionName", {
    description: "Canonical body-section names accepted by the JSDoc documentation law.",
  })
);

export type JSDocSectionName = typeof JSDocSectionName.Type;

export class JSDocSection extends S.Class<JSDocSection>($I`JSDocSection`)(
  {
    name: JSDocSectionName,
    title: S.optionalKey(S.String),
    lineOffset: S.Int,
    body: S.Array(S.String),
  },
  $I.annote("JSDocSection", {
    description: "One parsed canonical JSDoc body section and its unfenced source lines.",
  })
) {}

export const jsDocSectionOrder: Record<Exclude<JSDocSectionName, "Example">, number> = {
  "When to use": 0,
  Details: 1,
  Gotchas: 2,
};

const stripCommentFraming = (commentText: string): ReadonlyArray<string> =>
  A.map(Str.split(/\r?\n/)(Str.replace(/\*\/$/, "")(Str.replace(/^\/\*\*/, "")(commentText))), (line) =>
    Str.trimEnd(Str.replace(/^\s*\*\s?/, "")(line))
  );

const escapeRegExp = (value: string): string => Str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")(value);

const blankLinesLike = (value: string): string =>
  A.join(
    A.map(Str.split(/\r?\n/)(value), () => ""),
    "\n"
  );

const maskFencedContent = (lines: ReadonlyArray<string>): ReadonlyArray<string> => {
  const normalized = A.join(
    A.map(lines, (line) => Str.replace(/^(\s*)(```|~~~).*$/, "$1$2ts")(line)),
    "\n"
  );
  const [blocks] = extractFencedCodeBlocks(normalized);
  const masked = A.reduce(blocks, normalized, (text, block) =>
    Str.isEmpty(block.code)
      ? text
      : Str.replace(new RegExp(escapeRegExp(block.code), "g"), blankLinesLike(block.code))(text)
  );
  return Str.split(/\r?\n/)(masked);
};

const dropFramingBlankLines = (lines: ReadonlyArray<string>): ReadonlyArray<string> => {
  const withoutLeading = Str.isEmpty(Str.trim(lines[0] ?? "")) ? A.drop(lines, 1) : lines;
  return Str.isEmpty(Str.trim(withoutLeading[withoutLeading.length - 1] ?? ""))
    ? A.dropRight(withoutLeading, 1)
    : withoutLeading;
};

const sectionHeadingPattern = /^\s*\*\*(When to use|Details|Gotchas|Example)\*\*(?:\s*\((.*)\))?\s*$/;

/**
 * Supplies the raw comment text parsed by {@link parseJSDocSections}.
 *
 * **Example** (Create parser options)
 *
 * ```ts
 * import { ParseJSDocSectionsOptions } from "@beep/repo-cli/test/Docgen"
 *
 * const options = ParseJSDocSectionsOptions.make({ commentText: "/** Documentation. *" + "/" })
 * console.log(options.commentText.startsWith("/**")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParseJSDocSectionsOptions extends S.Class<ParseJSDocSectionsOptions>($I`ParseJSDocSectionsOptions`)(
  { commentText: S.String },
  $I.annote("ParseJSDocSectionsOptions", {
    description: "Raw JSDoc comment text supplied to the canonical section parser.",
  })
) {}

/**
 * Captures unfenced JSDoc body lines and their parsed canonical sections.
 *
 * **Example** (Create an empty parse result)
 *
 * ```ts
 * import { ParseJSDocSectionsResult } from "@beep/repo-cli/test/Docgen"
 *
 * const result = ParseJSDocSectionsResult.make({ bodyLines: [], sections: [] })
 * console.log(result.sections.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParseJSDocSectionsResult extends S.Class<ParseJSDocSectionsResult>($I`ParseJSDocSectionsResult`)(
  {
    bodyLines: S.Array(S.String),
    sections: S.Array(JSDocSection),
  },
  $I.annote("ParseJSDocSectionsResult", {
    description: "Unfenced JSDoc body lines and the canonical sections parsed from them.",
  })
) {}

/**
 * Parses the canonical prose and Example sections from one JSDoc comment.
 *
 * **Example** (Parse an Example section)
 *
 * ```ts
 * import { ParseJSDocSectionsOptions, parseJSDocSections } from "@beep/repo-cli/test/Docgen"
 *
 * const parsed = parseJSDocSections(ParseJSDocSectionsOptions.make({
 *   commentText: "/** Lead.\n *\n * **Details**\n *\n * More context.\n *" + "/"
 * }))
 * console.log(parsed.sections[0]?.name) // "Details"
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const parseJSDocSections = ({ commentText }: ParseJSDocSectionsOptions): ParseJSDocSectionsResult => {
  const bodyLines = dropFramingBlankLines(stripCommentFraming(commentText));
  const maskedLines = maskFencedContent(bodyLines);
  const tagIndex = A.findFirstIndex(maskedLines, (line) => /^\s*@\w/.test(line)).pipe(
    O.getOrElse(() => bodyLines.length)
  );
  const maskedBodyLines = A.take(maskedLines, tagIndex);
  const sectionStarts: Array<{
    readonly index: number;
    readonly name: JSDocSectionName;
    readonly title: string | undefined;
  }> = [];
  const isSectionName = S.is(JSDocSectionName);
  for (const [index, line] of A.entries(maskedBodyLines)) {
    const match = sectionHeadingPattern.exec(line);
    if (match !== null && isSectionName(match[1])) {
      A.appendInPlace(sectionStarts, { index, name: match[1], title: match[2] });
    }
  }
  const sections = A.map(sectionStarts, (section, index) => {
    const next = sectionStarts[index + 1];
    return JSDocSection.make({
      name: section.name,
      lineOffset: section.index + 1,
      body: A.slice(bodyLines, { start: section.index + 1, end: next?.index ?? tagIndex }),
      ...getSomesStruct({ title: O.map(O.fromUndefinedOr(section.title), Str.trim) }),
    });
  });
  return ParseJSDocSectionsResult.make({ bodyLines: A.take(bodyLines, tagIndex), sections });
};

export const jsDocSectionBodyText = (section: JSDocSection): string => A.join(section.body, "\n");
