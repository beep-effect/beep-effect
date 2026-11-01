/**
 * Fence-extractor parity (roadmap PR R6, map site #282, SPEC W4-q).
 *
 * R6 moves four fenced-code extractors onto one owner, `@beep/markdown` `MarkdownFence.fences`
 * (CommonMark/GFM code nodes with source spans and an unterminated verdict):
 *
 * - `docgen`: `@beep/repo-docgen/Core` `extractFencedCodeBlockDetails` (and through it
 *   `extractFencedCode`, `extractFencedCodeBlocks`, repo-cli Doctest and the EffectImports JSDoc
 *   mode), which matched the regex `fencePattern`;
 * - `typescript-fences`: repo-cli `Laws/internal/TypeScriptFences.ts` `typescriptFences` (the
 *   Markdown fence typecheck and schema tag idiom laws), which matched `TYPESCRIPT_FENCE_PATTERN`;
 * - `effect-imports-markdown`: the EffectImports Markdown mode, which matched
 *   `markdownImportFencePattern` and now reads `scriptFences` from the same repo-cli module;
 * - `jsdoc-sections`: repo-cli `internal/jsdoc/JSDocSections.ts` `parseJSDocSections`, which masked
 *   fence bodies by rewriting every fence line to `ts`, extracting through `fencePattern` and
 *   regex-replacing each block's code, and now blanks `MarkdownFence` bodies by span;
 * - `doctest`: repo-cli `Docgen/internal/Doctest.ts` `scanSourceFences`, which masked the JSDoc `*`
 *   frame in place (`maskJSDocStars`) and read `fencePattern`, and now unwraps the frame per line and
 *   reads the shared docgen extractor; the leg pairs the scanned fences and their analyzer findings.
 *
 * The old extractors are frozen here verbatim (they are deleted from the packages in R6). Each one
 * runs beside its replacement over two corpora: every git-tracked Markdown file, and every JSDoc
 * block of every git-tracked TypeScript file (exported or not, a superset of the exported blocks
 * docgen and the JSDoc ratchet read) in its unwrapped form (`/**`, `*\/` and the leading `*` frame
 * removed, which is what docgen, the JSDoc inventory and the laws hand the extractors). Per unit the
 * two fence lists are paired by their opening fence and every unpaired or unequal fence is
 * classified against the CommonMark reading of the unit; a fence no rule explains is
 * `unclassified`, and the gate is zero of those.
 *
 * Usage (from the repo root):
 *
 *   bun goals/effected-promotion/ops/fence-extractor-parity.ts [--out <report.json>]
 *
 * Exit status is non-zero when any difference is unclassified.
 */
import * as NodeFS from "node:fs";
import * as NodeURL from "node:url";
import { MarkdownDocument } from "@beep/markdown/MarkdownDocument";
import { MarkdownFence } from "@beep/markdown/MarkdownFence";
import { FenceLocation, ScannedDoctestFence } from "@beep/repo-cli/commands/Docgen";
import {
  doctestFenceFindingsForTesting,
  ParseJSDocSectionsOptions,
  parseJSDocSections,
  rawJSDocSpans,
  scanDoctestFencesForTesting,
} from "@beep/repo-cli/test/Docgen";
import { scriptFences, typescriptFences } from "@beep/repo-cli/test/Laws";
import { extractFencedCodeBlockDetails } from "@beep/repo-docgen/Core";
import * as A from "effect/Array";
import * as Regex from "effect/RegExp";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import { ts } from "ts-morph";
import type { CodeFence } from "@beep/markdown/MarkdownFence";

const TOOL = "goals/effected-promotion/ops/fence-extractor-parity.ts";
const repoRoot = NodeURL.fileURLToPath(new URL("../../..", import.meta.url));

const git = (args: ReadonlyArray<string>): string => {
  const result = Bun.spawnSync(["git", ...args], { cwd: repoRoot, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) throw new Error(`git ${A.join(args, " ")} failed: ${result.stderr.toString()}`);
  return result.stdout.toString();
};

const tracked = (patterns: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.filter(Str.split(git(["ls-files", "-z", "--", ...patterns]), "\0"), Str.isNonEmpty);

const read = (file: string): string | undefined => {
  try {
    return NodeFS.readFileSync(`${repoRoot}${file}`, "utf8");
  } catch {
    return undefined; // a tracked path deleted in the working tree
  }
};

// ---------------------------------------------------------------------------------------------
// The frozen old extractors (verbatim patterns and field derivations from origin/main adedee335a).
// ---------------------------------------------------------------------------------------------

/** One fence as an extractor reports it: `key` pairs old with new, `fields` must match exactly. */
type Found = { readonly key: number; readonly fields: string; readonly marker: number };

const oldDocgenPattern = /(?:```|~~~)(.*?)\n([\s\S]*?)(?:(```|~~~)|$)/g;
const isTypeScriptFence = (metadata: string): boolean =>
  ["ts", "tsx", "typescript"].some((prefix) => metadata.startsWith(prefix));
const isTypeCheckable = (info: string): boolean => {
  const metadata = info.toLowerCase();
  return isTypeScriptFence(metadata) && !metadata.includes("skip-type-checking");
};

const docgenFields = (fence: {
  readonly code: string;
  readonly infoString: string;
  readonly fenceStart: number;
  readonly fenceEnd: number;
  readonly codeStart: number;
  readonly codeEnd: number;
}): string =>
  JSON.stringify([fence.code, fence.infoString, fence.fenceStart, fence.fenceEnd, fence.codeStart, fence.codeEnd]);

const oldDocgen = (content: string): { readonly found: ReadonlyArray<Found>; readonly warnings: number } => {
  const matches = [...content.matchAll(oldDocgenPattern)];
  const found = matches
    .filter((match) => isTypeCheckable(match[1] ?? ""))
    .map((match) => {
      const infoString = match[1] ?? "";
      const fenceStart = match.index ?? 0;
      const infoEnd = fenceStart + 3 + infoString.length;
      const fenceEnd = fenceStart + match[0].length;
      return {
        key: fenceStart,
        marker: fenceStart,
        fields: docgenFields({
          code: (match[2] ?? "").trim(),
          infoString,
          fenceStart,
          fenceEnd,
          codeStart: infoEnd + 1,
          codeEnd: fenceEnd - (match[3]?.length ?? 0),
        }),
      };
    });
  return { found, warnings: matches.filter((match) => match[3] === undefined).length };
};

const newDocgen = (content: string): { readonly found: ReadonlyArray<Found>; readonly warnings: number } => {
  const [details, warnings] = extractFencedCodeBlockDetails(content);
  return {
    found: details.map((fence) => ({ key: fence.fenceStart, marker: fence.fenceStart, fields: docgenFields(fence) })),
    warnings: warnings.length,
  };
};

const lineIndexAt = (text: string, index: number): number => text.slice(0, index).split("\n").length - 1;
const lineStartOf = (text: string, line: number): number => {
  let offset = 0;
  for (let current = 0; current < line; current += 1) offset = text.indexOf("\n", offset) + 1;
  return offset;
};

// The first marker run of a fence's opening line, for line-keyed records that carry no offsets.
const markerOnLine = (text: string, line: number): number => {
  const start = lineStartOf(text, line);
  const end = text.indexOf("\n", start);
  const found = /(?:`{3,}|~{3,})/.exec(text.slice(start, end === -1 ? text.length : end));
  return start + (found?.index ?? 0);
};

const oldTypeScriptPattern =
  /^ {0,3}(`{3,}|~{3,})(typescript|tsx|mts|cts|ts)(?![\w-])([^\r\n]*)\r?\n([\s\S]*?)^ {0,3}\1[ \t]*$/gimu;

const oldTypeScriptFences = (content: string): ReadonlyArray<Found> =>
  [...content.matchAll(oldTypeScriptPattern)].map((match) => {
    const start = match.index ?? 0;
    const openingLength = (match[0].indexOf("\n") === -1 ? 0 : match[0].indexOf("\n")) + 1;
    const codeLineIndex = lineIndexAt(content, start + openingLength);
    return {
      key: codeLineIndex - 1,
      marker: start + (match[0].length - match[0].trimStart().length),
      fields: JSON.stringify([
        match[4] ?? "",
        `${match[2] ?? ""}${match[3] ?? ""}`.trim(),
        (match[2] ?? "").toLowerCase(),
        codeLineIndex,
      ]),
    };
  });

const newTypeScriptFences = (content: string): ReadonlyArray<Found> =>
  typescriptFences(content)[0].map((fence) => ({
    key: fence.openingLineIndex,
    marker: markerOnLine(content, fence.openingLineIndex),
    fields: JSON.stringify([fence.code, fence.infoString, fence.language, fence.codeLineIndex]),
  }));

const oldScriptPattern =
  /^ {0,3}(`{3,}|~{3,})(typescript|javascript|tsx|jsx|mts|cts|mjs|cjs|ts|js)(?![\w-])[^\r\n]*\r?\n([\s\S]*?)^ {0,3}\1[ \t]*$/gim;

const scriptExtension = (language: string): ".ts" | ".tsx" =>
  language === "tsx" || language === "jsx" ? ".tsx" : ".ts";

const oldScriptFences = (content: string): ReadonlyArray<Found> =>
  [...content.matchAll(oldScriptPattern)].map((match) => {
    const openingLength = (match[0].indexOf("\n") === -1 ? -1 : match[0].indexOf("\n")) + 1;
    const code = match[3] ?? "";
    const codeStart = (match.index ?? 0) + openingLength;
    return {
      key: lineIndexAt(content, codeStart) - 1,
      marker: (match.index ?? 0) + (match[0].length - match[0].trimStart().length),
      fields: JSON.stringify([
        code,
        codeStart,
        codeStart + code.length,
        scriptExtension((match[2] ?? "ts").toLowerCase()),
      ]),
    };
  });

const newScriptFences = (content: string): ReadonlyArray<Found> =>
  scriptFences(content)[0].map((fence) => ({
    key: lineIndexAt(content, fence.codeStart) - 1,
    marker: markerOnLine(content, lineIndexAt(content, fence.codeStart) - 1),
    fields: JSON.stringify([fence.code, fence.codeStart, fence.codeEnd, fence.extension]),
  }));

// ---------------------------------------------------------------------------------------------
// Classification against the CommonMark reading of the unit.
// ---------------------------------------------------------------------------------------------

const Category = [
  "identical",
  "closing-line-indent",
  "value-normalized",
  "marker-mid-line",
  "marker-indented-code",
  "inside-other-fence",
  "inside-container",
  "closer-differs",
  "long-marker-run",
  "frame-indent-removed",
  "old-mask-misread",
  "unclassified",
] as const;
type Category = (typeof Category)[number];

const commonMarkFences = (content: string): ReadonlyArray<CodeFence> =>
  Result.match(MarkdownDocument.parseResult(content), {
    onFailure: () => [],
    onSuccess: (document) => MarkdownFence.fences(document),
  });

// The text from the start of the line holding `offset` up to `offset`.
const linePrefix = (content: string, offset: number): string =>
  content.slice(Math.max(content.lastIndexOf("\n", offset - 1) + 1, 0), offset);

const columns = (prefix: string): number =>
  [...prefix].reduce((column, unit) => (unit === "\t" ? column + 4 - (column % 4) : column + 1), 0);

const classifyOne = (content: string, marker: number, cm: ReadonlyArray<CodeFence>): Category => {
  const prefix = linePrefix(content, marker);
  const own = cm.find((fence) => fence.fenceStart === marker);
  if (own !== undefined) {
    if (prefix.trim() !== "") return "inside-container";
    if (own.fenceLength > 3) return "long-marker-run";
    return "closer-differs";
  }
  if (cm.some((fence) => fence.bodyStart <= marker && marker < fence.bodyEnd)) return "inside-other-fence";
  if (prefix.trim() !== "")
    return /^[\s>]*(?:[-*+]|\d+[.)])?[\s>]*$/.test(prefix) ? "inside-container" : "marker-mid-line";
  if (columns(prefix) >= 4) return "marker-indented-code";
  return "unclassified";
};

type Difference = {
  readonly corpus: "markdown" | "jsdoc" | "source";
  readonly extractor: string;
  readonly file: string;
  readonly side: "old-only" | "new-only" | "changed";
  readonly category: Category;
  // The opening fence's pairing key: its offset (docgen) or 0-based line (the line-keyed extractors).
  readonly key: number;
  // The compared fields as JSON, cut to `PREVIEW` characters (the full text is in the source at `key`).
  readonly old: string | null;
  readonly next: string | null;
};

const PREVIEW = 240;
const preview = (fields: string | undefined): string | null =>
  fields === undefined ? null : fields.length > PREVIEW ? `${fields.slice(0, PREVIEW)}…` : fields;

type Tally = Record<Category, number> & { units: number; fences: number; oldWarnings: number; newWarnings: number };
const emptyTally = (): Tally =>
  ({
    ...Object.fromEntries(Category.map((name) => [name, 0])),
    units: 0,
    fences: 0,
    oldWarnings: 0,
    newWarnings: 0,
  }) as Tally;

const tallies: Record<string, Tally> = {};
const differences: Array<Difference> = [];

const tally = (key: string): Tally => {
  tallies[key] ??= emptyTally();
  return tallies[key];
};

// The closing fence of a changed docgen record differs only by the closing line's indentation.
const onlyClosingIndent = (oldFields: string, nextFields: string): boolean => {
  const [oldCode, oldInfo, oldStart, oldEnd, oldCodeStart] = JSON.parse(oldFields) as ReadonlyArray<unknown>;
  const [nextCode, nextInfo, nextStart, nextEnd, nextCodeStart] = JSON.parse(nextFields) as ReadonlyArray<unknown>;
  return (
    oldCode === nextCode &&
    oldInfo === nextInfo &&
    oldStart === nextStart &&
    oldEnd === nextEnd &&
    oldCodeStart === nextCodeStart
  );
};

const compare = (
  corpus: "markdown" | "jsdoc",
  extractor: string,
  file: string,
  content: string,
  oldFound: ReadonlyArray<Found>,
  newFound: ReadonlyArray<Found>
): void => {
  const counts = tally(`${corpus}/${extractor}`);
  counts.units += 1;
  counts.fences += oldFound.length;
  const cm = oldFound.length === 0 && newFound.length === 0 ? [] : commonMarkFences(content);
  const record = (side: Difference["side"], category: Category, old: Found | undefined, next: Found | undefined) => {
    counts[category] += 1;
    if (category !== "identical") {
      const key = old?.key ?? next?.key ?? -1;
      differences.push({
        corpus,
        extractor,
        file,
        side,
        category,
        key,
        old: preview(old?.fields),
        next: preview(next?.fields),
      });
    }
  };
  for (const old of oldFound) {
    const next = newFound.find((candidate) => candidate.key === old.key);
    if (next === undefined) record("old-only", classifyOne(content, old.marker, cm), old, undefined);
    else if (next.fields === old.fields) record("changed", "identical", old, next);
    else if (extractor === "docgen" && onlyClosingIndent(old.fields, next.fields))
      record("changed", "closing-line-indent", old, next);
    else if (
      (extractor === "typescript-fences" || extractor === "effect-imports-markdown") &&
      cm.some((fence) => fence.fenceStart === old.marker && fence.body !== fence.value)
    )
      record("changed", "value-normalized", old, next);
    else record("changed", classifyOne(content, old.marker, cm), old, next);
  }
  for (const next of newFound) {
    if (!oldFound.some((old) => old.key === next.key)) {
      record("new-only", classifyOne(content, next.marker, cm), undefined, next);
    }
  }
};

// ---------------------------------------------------------------------------------------------
// Corpora.
// ---------------------------------------------------------------------------------------------

const unwrapJsDoc = (text: string): string =>
  text
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\*\s?/, "").trimEnd())
    .join("\n");

const jsDocBlocks = (file: string, source: string): ReadonlyArray<string> => {
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, false, kind);
  const blocks: Array<string> = [];
  const visit = (node: ts.Node): void => {
    for (const doc of (node as { readonly jsDoc?: ReadonlyArray<ts.JSDoc> }).jsDoc ?? []) {
      blocks.push(source.slice(doc.pos, doc.end));
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return blocks;
};

const runUnit = (corpus: "markdown" | "jsdoc", file: string, content: string): void => {
  const oldDocs = oldDocgen(content);
  const newDocs = newDocgen(content);
  tally(`${corpus}/docgen`).oldWarnings += oldDocs.warnings;
  tally(`${corpus}/docgen`).newWarnings += newDocs.warnings;
  compare(corpus, "docgen", file, content, oldDocs.found, newDocs.found);
  // The new extractors' warnings are parse failures (the old regexes could not fail).
  tally(`${corpus}/typescript-fences`).newWarnings += typescriptFences(content)[1].length;
  tally(`${corpus}/effect-imports-markdown`).newWarnings += scriptFences(content)[1].length;
  compare(corpus, "typescript-fences", file, content, oldTypeScriptFences(content), newTypeScriptFences(content));
  compare(corpus, "effect-imports-markdown", file, content, oldScriptFences(content), newScriptFences(content));
};

const hasMarker = (text: string): boolean => text.includes("```") || text.includes("~~~");

// ---------------------------------------------------------------------------------------------
// The jsdoc-sections and doctest legs: frozen copies of the old JSDocSections mask and the old
// Doctest scan (origin/main adedee335a), beside the live `parseJSDocSections` and
// `scanDoctestFencesForTesting`, whose findings both run through the live analyzer.
// ---------------------------------------------------------------------------------------------

type OldDetail = {
  readonly code: string;
  readonly infoString: string;
  readonly fenceStart: number;
  readonly fenceEnd: number;
  readonly codeStart: number;
  readonly codeEnd: number;
};

const oldDocgenDetails = (content: string): ReadonlyArray<OldDetail> =>
  [...content.matchAll(oldDocgenPattern)]
    .filter((match) => isTypeCheckable(match[1] ?? ""))
    .map((match) => {
      const infoString = match[1] ?? "";
      const fenceStart = match.index ?? 0;
      const fenceEnd = fenceStart + match[0].length;
      return {
        code: (match[2] ?? "").trim(),
        infoString,
        fenceStart,
        fenceEnd,
        codeStart: fenceStart + 3 + infoString.length + 1,
        codeEnd: fenceEnd - (match[3]?.length ?? 0),
      };
    });

const oldStripCommentFraming = (commentText: string): ReadonlyArray<string> =>
  commentText
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\*\s?/, "").trimEnd());

const oldBlankLinesLike = (value: string): string =>
  value
    .split(/\r?\n/)
    .map(() => "")
    .join("\n");

const oldMaskFencedContent = (lines: ReadonlyArray<string>): ReadonlyArray<string> => {
  const normalized = lines.map((line) => line.replace(/^(\s*)(```|~~~).*$/, "$1$2ts")).join("\n");
  const blocks = oldDocgenDetails(normalized);
  const masked = blocks.reduce(
    (text, block) =>
      block.code === "" ? text : text.replace(new RegExp(Regex.escape(block.code), "g"), oldBlankLinesLike(block.code)),
    normalized
  );
  return masked.split(/\r?\n/);
};

const oldDropFramingBlankLines = (lines: ReadonlyArray<string>): ReadonlyArray<string> => {
  const withoutLeading = (lines[0] ?? "").trim() === "" ? lines.slice(1) : lines;
  return (withoutLeading[withoutLeading.length - 1] ?? "").trim() === "" ? withoutLeading.slice(0, -1) : withoutLeading;
};

const oldSectionHeadingPattern = /^\s*\*\*(When to use|Details|Gotchas|Example)\*\*(?:\s*\((.*)\))?\s*$/;

type OldSection = {
  readonly name: string;
  readonly title?: string;
  readonly lineOffset: number;
  readonly body: ReadonlyArray<string>;
};

const oldParseJSDocSections = (commentText: string): ReadonlyArray<OldSection> => {
  const bodyLines = oldDropFramingBlankLines(oldStripCommentFraming(commentText));
  const maskedLines = oldMaskFencedContent(bodyLines);
  const found = maskedLines.findIndex((line) => /^\s*@\w/.test(line));
  const tagIndex = found === -1 ? bodyLines.length : found;
  const starts: Array<{ readonly index: number; readonly name: string; readonly title: string | undefined }> = [];
  maskedLines.slice(0, tagIndex).forEach((line, index) => {
    const match = oldSectionHeadingPattern.exec(line);
    if (match !== null && match[1] !== undefined) starts.push({ index, name: match[1], title: match[2] });
  });
  return starts.map((section, index) => ({
    name: section.name,
    lineOffset: section.index + 1,
    body: bodyLines.slice(section.index + 1, starts[index + 1]?.index ?? tagIndex),
    ...(section.title === undefined ? {} : { title: section.title.trim() }),
  }));
};

const sectionsJson = (sections: ReadonlyArray<OldSection>): string =>
  JSON.stringify(sections.map((section) => [section.name, section.title ?? null, section.lineOffset, section.body]));

// A comment whose sections differ: `old-mask-misread` when the old mask read a fence line inside
// another fence as an opener or closer (it rewrote every marker line to `ts` before extracting), or
// regex-replaced a block's code text outside its fence; anything else is unclassified.
const classifySections = (commentText: string): Category => {
  const lines = oldDropFramingBlankLines(oldStripCommentFraming(commentText));
  const text = lines.join("\n");
  const cm = commonMarkFences(text);
  const markerLines = lines.filter((line) => /^\s*(?:```|~~~)/.test(line)).length;
  const cmMarkerLines = cm.reduce((count, fence) => count + (fence.unterminated ? 1 : 2), 0);
  if (markerLines !== cmMarkerLines) return "old-mask-misread";
  const blocks = oldDocgenDetails(lines.map((line) => line.replace(/^(\s*)(```|~~~).*$/, "$1$2ts")).join("\n"));
  return blocks.some((block) => block.code !== "" && text.split(block.code).length > 2)
    ? "old-mask-misread"
    : "unclassified";
};

const runSectionsUnit = (file: string, commentText: string): void => {
  const counts = tally("jsdoc/jsdoc-sections");
  counts.units += 1;
  const oldJson = sectionsJson(oldParseJSDocSections(commentText));
  const newJson = sectionsJson(parseJSDocSections(ParseJSDocSectionsOptions.make({ commentText })).sections);
  counts.fences += 1;
  if (oldJson === newJson) {
    counts.identical += 1;
    return;
  }
  const category = classifySections(commentText);
  counts[category] += 1;
  differences.push({
    corpus: "jsdoc",
    extractor: "jsdoc-sections",
    file,
    side: "changed",
    category,
    key: 0,
    old: preview(oldJson),
    next: preview(newJson),
  });
};

const maskJSDocStars = (comment: string): string =>
  comment.replace(/^([ \t]*)\* /gm, "$1  ").replace(/^([ \t]*)\*(?!\/)/gm, "$1 ");

const lineAtOffset = (source: string, offset: number): number => source.slice(0, offset).split(/\r?\n/).length;

type DoctestFenceRecord = {
  readonly code: string;
  readonly codeStartLine: number;
  readonly infoString: string;
  readonly startLine: number;
  readonly endLine: number;
  readonly exampleTitle: string | undefined;
};

const oldDoctestFences = (source: string): ReadonlyArray<DoctestFenceRecord> =>
  rawJSDocSpans(source).flatMap((span) => {
    const masked = maskJSDocStars(span.text);
    const titles = oldParseJSDocSections(span.text)
      .filter((section) => section.name === "Example")
      .map((section) => section.title);
    return oldDocgenDetails(masked).map((detail, index) => {
      const rawCode = masked.slice(detail.codeStart, detail.codeEnd);
      const trimmedOffset = Math.max(rawCode.indexOf(detail.code), 0);
      return {
        code: detail.code,
        codeStartLine: lineAtOffset(source, span.start + detail.codeStart + trimmedOffset),
        infoString: detail.infoString,
        startLine: lineAtOffset(source, span.start + detail.fenceStart),
        endLine: lineAtOffset(source, span.start + detail.fenceEnd),
        exampleTitle: titles[index],
      };
    });
  });

const fenceRecordJson = (fence: DoctestFenceRecord): string =>
  JSON.stringify([fence.code, fence.codeStartLine, fence.infoString, fence.endLine, fence.exampleTitle ?? null]);

// The analyzer's findings for one scanned fence, without the location the pairing already compared.
const findingsJson = (source: string, fence: ScannedDoctestFence): string =>
  JSON.stringify(
    doctestFenceFindingsForTesting(source, fence).map((finding) => [
      finding.kind,
      finding.message,
      finding.verdict._tag,
      finding.plan === undefined
        ? null
        : [
            finding.plan.expectedInfoString,
            finding.plan.addMarker,
            finding.plan.addName ?? null,
            finding.plan.consoleRewrites.map((rewrite) => [
              rewrite.line,
              rewrite.expression,
              rewrite.expectedExpression,
            ]),
          ],
    ])
  );

const stripIndent = (text: string): string =>
  text
    .split("\n")
    .map((line) => line.trimStart())
    .join("\n");

const sameModuloIndent = (left: string, right: string): boolean => stripIndent(left) === stripIndent(right);

// `frame-indent-removed`: the new unwrap drops the frame indentation the old in-place mask kept on
// body lines 2 and later, and nothing else moves. `marker-mid-line`: the old pattern closed the fence
// at a marker run inside a code line (a string literal holding a fence), so its code is a prefix of
// the new code and it ended on an earlier line whose marker run is not at the line start.
const classifyDoctest = (source: string, old: DoctestFenceRecord, next: DoctestFenceRecord): Category => {
  const sameFrame =
    old.codeStartLine === next.codeStartLine &&
    old.infoString === next.infoString &&
    old.exampleTitle === next.exampleTitle;
  if (sameFrame && old.endLine === next.endLine && sameModuloIndent(old.code, next.code)) return "frame-indent-removed";
  const closingLine = source.split(/\r?\n/)[old.endLine - 1] ?? "";
  const midLine = /\S.*(?:```|~~~)/.test(closingLine.replace(/^\s*\*\s?/, ""));
  return sameFrame && old.endLine < next.endLine && midLine && stripIndent(next.code).startsWith(stripIndent(old.code))
    ? "marker-mid-line"
    : "unclassified";
};

const doctestTally = { fences: 0, findingsIdentical: 0, findingsChanged: 0, findingsUnclassified: 0 };
const doctestFindingDifferences: Array<{
  readonly file: string;
  readonly startLine: number;
  readonly category: Category;
  readonly old: string;
  readonly next: string;
}> = [];

const runDoctestUnit = (file: string, source: string): void => {
  const counts = tally("source/doctest");
  counts.units += 1;
  const oldFences = oldDoctestFences(source);
  const scanned = scanDoctestFencesForTesting(file, source);
  counts.fences += oldFences.length;
  const toRecord = (fence: ScannedDoctestFence): DoctestFenceRecord => ({
    code: fence.code,
    codeStartLine: fence.codeStartLine,
    infoString: fence.infoString,
    startLine: fence.location.startLine,
    endLine: fence.location.endLine,
    exampleTitle: fence.location.exampleTitle,
  });
  const push = (side: Difference["side"], category: Category, key: number, old?: string, next?: string) => {
    counts[category] += 1;
    // `frame-indent-removed` touches nearly every multi-line fence, so it is tallied, not listed.
    if (category !== "identical" && category !== "frame-indent-removed")
      differences.push({
        corpus: "source",
        extractor: "doctest",
        file,
        side,
        category,
        key,
        old: preview(old),
        next: preview(next),
      });
  };
  // A refused scan fails closed in `doctest verify`; here it is one unclassified difference, so the gate fails.
  if (Result.isFailure(scanned)) {
    push("new-only", "unclassified", 0, undefined, scanned.failure.message);
    return;
  }
  const newFences = scanned.success;
  for (const old of oldFences) {
    const nextFence = newFences.find((candidate) => candidate.location.startLine === old.startLine);
    if (nextFence === undefined) {
      push("old-only", "unclassified", old.startLine, fenceRecordJson(old));
      continue;
    }
    const next = toRecord(nextFence);
    const oldJson = fenceRecordJson(old);
    const nextJson = fenceRecordJson(next);
    const category = oldJson === nextJson ? "identical" : classifyDoctest(source, old, next);
    push("changed", category, old.startLine, oldJson, nextJson);
    // Findings: the old fence through the live analyzer (its owner symbol is the new fence's, an
    // unchanged lookup keyed by the JSDoc span), against the new fence's.
    const oldFence = ScannedDoctestFence.make({
      code: old.code,
      codeStartLine: old.codeStartLine,
      infoString: old.infoString,
      location: FenceLocation.make({
        file,
        startLine: old.startLine,
        endLine: old.endLine,
        ...(nextFence.location.enclosingSymbol === undefined
          ? {}
          : { enclosingSymbol: nextFence.location.enclosingSymbol }),
        ...(old.exampleTitle === undefined || old.exampleTitle === "" ? {} : { exampleTitle: old.exampleTitle }),
      }),
    });
    const oldFindings = findingsJson(source, oldFence);
    const nextFindings = findingsJson(source, nextFence);
    doctestTally.fences += 1;
    if (oldFindings === nextFindings) doctestTally.findingsIdentical += 1;
    else {
      // A finding may move only with its fence's code: a fence whose code moved by indentation alone
      // (or not at all) must keep its findings.
      const explained = category === "marker-mid-line";
      doctestTally.findingsChanged += 1;
      if (!explained) doctestTally.findingsUnclassified += 1;
      doctestFindingDifferences.push({
        file,
        startLine: old.startLine,
        category: explained ? category : "unclassified",
        old: oldFindings,
        next: nextFindings,
      });
    }
  }
  for (const next of newFences) {
    if (!oldFences.some((old) => old.startLine === next.location.startLine)) {
      push("new-only", "unclassified", next.location.startLine, undefined, fenceRecordJson(toRecord(next)));
    }
  }
};

const main = (): void => {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  const out = outIndex === -1 ? undefined : args[outIndex + 1];

  const markdownFiles = tracked(["*.md"]);
  for (const file of markdownFiles) {
    const content = read(file);
    if (content !== undefined) runUnit("markdown", file, content);
  }

  let jsDocCount = 0;
  let jsDocWithMarkers = 0;
  const sourceFiles = A.filter(tracked(["*.ts", "*.tsx"]), (file) => !file.endsWith(".d.ts"));
  for (const file of sourceFiles) {
    const source = read(file);
    if (source === undefined || !source.includes("/**")) continue;
    for (const block of jsDocBlocks(file, source)) {
      jsDocCount += 1;
      if (!hasMarker(block)) continue;
      jsDocWithMarkers += 1;
      runUnit("jsdoc", file, unwrapJsDoc(block));
      runSectionsUnit(file, block);
    }
    if (/^(?:packages|apps)\/(?:.+\/)?src\//.test(file) && hasMarker(source)) runDoctestUnit(file, source);
  }

  const unclassified =
    differences.filter((difference) => difference.category === "unclassified").length +
    doctestTally.findingsUnclassified;
  const report = {
    tool: TOOL,
    commit: git(["rev-parse", "HEAD"]).trim(),
    dirty: git(["status", "--porcelain", "--untracked-files=no"]).trim() !== "",
    corpora: {
      markdown: { files: markdownFiles.length },
      jsdoc: { sourceFiles: sourceFiles.length, blocks: jsDocCount, blocksWithMarkers: jsDocWithMarkers },
    },
    tallies: Object.fromEntries(Object.entries(tallies).sort(([a], [b]) => a.localeCompare(b))),
    unclassified,
    doctestFindings: {
      ...doctestTally,
      differences: doctestFindingDifferences.map((item) => ({
        ...item,
        old: preview(item.old),
        next: preview(item.next),
      })),
    },
    differences,
  };
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (out === undefined) process.stdout.write(text);
  else NodeFS.writeFileSync(out, text);
  for (const [key, counts] of Object.entries(tallies)) {
    const shifted = Category.filter((name) => name !== "identical" && counts[name] > 0)
      .map((name) => `${name}=${counts[name]}`)
      .join(" ");
    process.stderr.write(
      `${key}: units=${counts.units} old-fences=${counts.fences} identical=${counts.identical} ${shifted} warnings=${counts.oldWarnings}->${counts.newWarnings}\n`
    );
  }
  process.stderr.write(
    `doctest findings: fences=${doctestTally.fences} identical=${doctestTally.findingsIdentical} changed=${doctestTally.findingsChanged} unclassified=${doctestTally.findingsUnclassified}\n`
  );
  process.stderr.write(`unclassified=${unclassified}\n`);
  if (unclassified > 0) process.exitCode = 1;
};

main();
