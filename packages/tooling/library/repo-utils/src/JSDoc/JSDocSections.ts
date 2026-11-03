/**
 * Canonical JSDoc block extraction and body-section parsing for the documentation law.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoUtilsId } from "@beep/identity/packages";
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { MarkdownFence } from "@beep/markdown/MarkdownFence";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { getSomesStruct } from "@beep/utils/Option";
import { constant, dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Regex from "effect/RegExp";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { Node } from "ts-morph";
import type { SourceFile } from "ts-morph";

const $I = $RepoUtilsId.create("JSDoc/JSDocSections");

/**
 * Models one raw JSDoc block and its exact source offsets.
 *
 * **Example** (Create a raw span)
 *
 * ```ts
 * import { RawJSDocSpan } from "@beep/repo-utils/JSDoc/JSDocSections"
 *
 * const span = RawJSDocSpan.make({ start: 0, end: 11, text: "/** Doc. *" + "/" })
 * console.log(span.start) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RawJSDocSpan extends S.Opaque<RawJSDocSpan, { readonly brand: unique symbol }>()(
  S.Struct({
    start: S.Natural,
    end: S.Natural,
    text: S.String,
  }).pipe(
    $I.annoteSchema("RawJSDocSpan", {
      description: "One raw JSDoc block paired with its exact source start and end offsets.",
    })
  )
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
 * import { fencedLineState } from "@beep/repo-utils/JSDoc/JSDocSections"
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
  const lineBreak = /\n/g;
  while (cursor < sourceText.length) {
    lineBreak.lastIndex = cursor;
    const lineBreakMatch = lineBreak.exec(sourceText);
    const lineEnd = lineBreakMatch === null ? sourceText.length : lineBreakMatch.index;
    const rawLine = Str.slice(cursor, lineEnd)(sourceText);
    const line = Str.trimEnd(Str.replace(/^\s*\*\s?/, "")(rawLine));
    const [nextOpenFence, isFenced] = fencedLineState(line, openFence);
    openFence = nextOpenFence;
    if (!isFenced) {
      const closingOffset = O.getOrElse(Str.indexOf("*/")(rawLine), constant(-1));
      if (closingOffset !== -1) {
        return cursor + closingOffset + 2;
      }
    }
    cursor = lineEnd + 1;
  }
  return sourceText.length;
};

// Index of the first character on the line holding `index`, found by walking back to the previous
// line break (the same result as a positional `lastIndexOf("\n", index - 1) + 1`).
const lineStartBefore = (sourceText: string, index: number): number => {
  let lineStart = index;
  while (lineStart > 0 && sourceText[lineStart - 1] !== "\n") {
    lineStart -= 1;
  }
  return lineStart;
};

/**
 * Extracts complete line-leading JSDoc blocks while ignoring delimiters inside fenced examples.
 *
 * **Example** (Extract one comment)
 *
 * ```ts
 * import { jsdocCommentsFromSource } from "@beep/repo-utils/JSDoc/JSDocSections"
 *
 * console.log(jsdocCommentsFromSource("/** Documentation. *" + "/\nexport const value = 1").length) // 1
 * ```
 *
 * @param sourceText - Full TypeScript source text to scan.
 * @returns Each line-leading comment from its opening delimiter through its closing delimiter, in source order; an unterminated block runs to the end of the text.
 * @category parsing
 * @since 0.0.0
 */
export const jsdocCommentsFromSource = (sourceText: string): ReadonlyArray<string> => {
  const comments: Array<string> = [];
  let cursor = 0;
  const openers = /\/\*\*/g;
  while (cursor < sourceText.length) {
    openers.lastIndex = cursor;
    const openerMatch = openers.exec(sourceText);
    if (openerMatch === null) {
      break;
    }
    const start = openerMatch.index;
    const lineStart = lineStartBefore(sourceText, start);
    const linePrefix = Str.slice(lineStart, start)(sourceText);
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
    A.appendInPlace(comments, Str.slice(start, end)(sourceText));
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
 * import { rawJSDocSpans } from "@beep/repo-utils/JSDoc/JSDocSections"
 *
 * console.log(rawJSDocSpans("/** Documentation. *" + "/")[0]?.start) // 0
 * ```
 *
 * @param sourceText - Full TypeScript source text to scan.
 * @returns Spans in source order whose `start` and `end` offsets slice `sourceText` back to each block's text.
 * @category parsing
 * @since 0.0.0
 */
export const rawJSDocSpans = (sourceText: string): ReadonlyArray<RawJSDocSpan> => {
  const spans: Array<RawJSDocSpan> = [];
  let cursor = 0;
  for (const text of jsdocCommentsFromSource(sourceText)) {
    // An escaped global pattern finds `text` at or after `cursor`, like a positional indexOf.
    const occurrence = new RegExp(Regex.escape(text), "g");
    occurrence.lastIndex = cursor;
    const match = occurrence.exec(sourceText);
    if (match === null) {
      break;
    }
    const start = match.index;
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
 * import { ownJSDocNodeName } from "@beep/repo-utils/JSDoc/JSDocSections"
 * import * as O from "effect/Option"
 * import { Project } from "ts-morph"
 *
 * const source = new Project({ useInMemoryFileSystem: true }).createSourceFile("example.ts", "const value = 1")
 * console.log(O.getOrElse(ownJSDocNodeName(source.getVariableStatementOrThrow("value")), () => "missing"))
 * // "value"
 * ```
 *
 * @param node - Declaration, member, or statement node that can carry a JSDoc block.
 * @returns The declared name, `"constructor"` for constructors, `"<default>"` for default and anonymous exports, or `None` for node kinds that do not own documentation.
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
 * import { jsdocOwnersByStart } from "@beep/repo-utils/JSDoc/JSDocSections"
 * import * as MutableHashMap from "effect/MutableHashMap";
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
 * @param sourceFile - ts-morph source file whose descendants are walked.
 * @returns A fresh map from each JSDoc block's start offset to the outermost node that owns it; destructured binding elements are included.
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

/**
 * Schema for the four body-section headings the JSDoc documentation law recognizes.
 *
 * **Details**
 *
 * The parser only reads a bolded heading line as a section when its text is one of these names.
 *
 * **Example** (Accept only canonical section names)
 *
 * ```ts
 * import { JSDocSectionName } from "@beep/repo-utils/JSDoc/JSDocSections"
 * import * as S from "effect/Schema"
 *
 * const isSectionName = S.is(JSDocSectionName)
 * console.log(isSectionName("Gotchas")) // true
 * console.log(isSectionName("Remarks")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const JSDocSectionName = LiteralKit(["When to use", "Details", "Gotchas", "Example"]).pipe(
  $I.annoteSchema("JSDocSectionName", {
    description: "Canonical body-section names accepted by the JSDoc documentation law.",
  })
);

/**
 * Union of the canonical body-section headings: `"When to use"`, `"Details"`, `"Gotchas"`, and `"Example"`.
 *
 * @category models
 * @since 0.0.0
 */
export type JSDocSectionName = typeof JSDocSectionName.Type;
const isJSDocSectionName = S.is(JSDocSectionName);

/**
 * One canonical body section parsed from a JSDoc block, with its optional Example title and raw body lines.
 *
 * **Details**
 *
 * `lineOffset` is the index of the first body line inside the comment body after its framing is stripped,
 * and `body` keeps fenced code lines verbatim.
 *
 * **Example** (Create a Gotchas section)
 *
 * ```ts
 * import { JSDocSection } from "@beep/repo-utils/JSDoc/JSDocSections"
 *
 * const section = JSDocSection.make({ name: "Gotchas", lineOffset: 3, body: ["", "Runs twice on retry."] })
 * console.log(section.name) // "Gotchas"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocSection extends S.Opaque<JSDocSection, { readonly brand: unique symbol }>()(
  S.Struct({
    name: JSDocSectionName,
    title: S.optionalKey(S.String),
    lineOffset: S.Int,
    body: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("JSDocSection", {
      description: "One parsed canonical JSDoc body section and its unfenced source lines.",
    })
  )
) {}

/**
 * Required relative order of the prose sections, used to flag a section that appears out of order.
 *
 * **Details**
 *
 * Example sections are left out because they repeat and always come after the prose sections.
 *
 * **Example** (Compare two section positions)
 *
 * ```ts
 * import { jsDocSectionOrder } from "@beep/repo-utils/JSDoc/JSDocSections"
 *
 * console.log(jsDocSectionOrder.Gotchas < jsDocSectionOrder.Details) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const jsDocSectionOrder: Record<Exclude<JSDocSectionName, "Example">, number> = {
  "When to use": 0,
  Details: 1,
  Gotchas: 2,
};

const stripCommentFraming = (commentText: string): ReadonlyArray<string> =>
  A.map(Str.split(/\r?\n/)(Str.replace(/\*\/$/, "")(Str.replace(/^\/\*\*/, "")(commentText))), (line) =>
    Str.trimEnd(Str.replace(/^\s*\*\s?/, "")(line))
  );

const blankLinesLike = (value: string): string =>
  A.join(
    A.map(Str.split(/\r?\n/)(value), () => ""),
    "\n"
  );

// The line scanner's reading of the fences, for a text the CommonMark parser refuses: every line
// between an opening fence and its closer (to the end for an unterminated fence) is blanked.
const maskFencedLines = (lines: ReadonlyArray<string>): ReadonlyArray<string> => {
  let openFence: string | undefined;
  return A.map(lines, (line) => {
    const openBefore = openFence;
    [openFence] = fencedLineState(line, openFence);
    return openBefore !== undefined && openFence !== undefined ? "" : line;
  });
};

// Blank every fence body (any language) so section markers quoted inside code are not read as sections.
// A text with no run of three backticks or tildes has no fence and is not parsed.
const maskFencedContent = (lines: ReadonlyArray<string>): ReadonlyArray<string> => {
  const text = A.join(lines, "\n");
  return !/`{3}|~{3}/u.test(text)
    ? lines
    : Result.match(MarkdownDocument.parseResult(text), {
        onFailure: () => maskFencedLines(lines),
        onSuccess: (document) =>
          Str.split(/\r?\n/)(
            A.reduce(
              A.reverse(MarkdownFence.fences(document)),
              text,
              (current, fence) =>
                `${Str.slice(0, fence.bodyStart)(current)}${blankLinesLike(fence.body)}${Str.slice(fence.bodyEnd)(current)}`
            )
          ),
      });
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
 * import { ParseJSDocSectionsOptions } from "@beep/repo-utils/JSDoc/JSDocSections"
 *
 * const options = ParseJSDocSectionsOptions.make({ commentText: "/** Documentation. *" + "/" })
 * console.log(options.commentText.startsWith("/**")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParseJSDocSectionsOptions extends S.Opaque<ParseJSDocSectionsOptions, { readonly brand: unique symbol }>()(
  S.Struct({ commentText: S.String }).pipe(
    $I.annoteSchema("ParseJSDocSectionsOptions", {
      description: "Raw JSDoc comment text supplied to the canonical section parser.",
    })
  )
) {}

/**
 * Captures unfenced JSDoc body lines and their parsed canonical sections.
 *
 * **Example** (Create an empty parse result)
 *
 * ```ts
 * import { ParseJSDocSectionsResult } from "@beep/repo-utils/JSDoc/JSDocSections"
 *
 * const result = ParseJSDocSectionsResult.make({ bodyLines: [], sections: [] })
 * console.log(result.sections.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ParseJSDocSectionsResult extends S.Opaque<ParseJSDocSectionsResult, { readonly brand: unique symbol }>()(
  S.Struct({
    bodyLines: S.Array(S.String),
    sections: S.Array(JSDocSection),
  }).pipe(
    $I.annoteSchema("ParseJSDocSectionsResult", {
      description: "Unfenced JSDoc body lines and the canonical sections parsed from them.",
    })
  )
) {}

/**
 * Parses the canonical prose and Example sections from one JSDoc comment.
 *
 * **Example** (Parse an Example section)
 *
 * ```ts
 * import { ParseJSDocSectionsOptions, parseJSDocSections } from "@beep/repo-utils/JSDoc/JSDocSections"
 *
 * const parsed = parseJSDocSections(ParseJSDocSectionsOptions.make({
 *   commentText: "/** Lead.\n *\n * **Details**\n *\n * More context.\n *" + "/"
 * }))
 * console.log(parsed.sections[0]?.name) // "Details"
 * ```
 *
 * @returns Body lines up to the first block tag, plus every canonical section found in them; headings quoted inside fenced code are ignored.
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
  for (const [index, line] of A.entries(maskedBodyLines)) {
    const match = sectionHeadingPattern.exec(line);
    if (match !== null && isJSDocSectionName(match[1])) {
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

/**
 * Joins a parsed section's body lines into one newline-separated string for content checks.
 *
 * **Example** (Read a section body as text)
 *
 * ```ts
 * import { JSDocSection, jsDocSectionBodyText } from "@beep/repo-utils/JSDoc/JSDocSections"
 *
 * const section = JSDocSection.make({ name: "Details", lineOffset: 1, body: ["First line.", "Second line."] })
 * console.log(jsDocSectionBodyText(section)) // "First line.\nSecond line."
 * ```
 *
 * @param section - Parsed section whose body lines are joined.
 * @returns The body lines joined with `\n`, without trimming or fence removal.
 * @category getters
 * @since 0.0.0
 */
export const jsDocSectionBodyText = (section: JSDocSection): string => A.join(section.body, "\n");
