/**
 * Pure per-block rewriter and conservation law for the JSDoc carrier migration.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import { MutableHashMap, Order, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { documentationShapeViolations } from "./JSDocDocumentationInventory.ts";
import { JSDocMigrateRemarksRouting } from "./JSDocMigrate.schemas.ts";
import { escapeRegExp, fencedLineState, stripCommentFraming } from "./QualityArtifactSupport.ts";

const $I = $RepoCliId.create("commands/Quality/internal/JSDocMigrateRewrite");

/**
 * Per-block data consumed by the rewriter, sourced from `titles.jsonl`.
 *
 * **Example** (Validate rewrite data)
 *
 * ```ts
 * import { JSDocMigrateRewriteData } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(JSDocMigrateRewriteData)({ titles: ["Decode a name"] })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JSDocMigrateRewriteData = S.Struct({
  titles: S.Array(S.String),
  remarks: JSDocMigrateRemarksRouting.pipe(S.UndefinedOr, S.optionalKey),
  leadEnd: S.Int.pipe(S.UndefinedOr, S.optionalKey),
  seePurposes: S.Array(S.String).pipe(S.UndefinedOr, S.optionalKey),
}).pipe(
  $I.annoteSchema("JSDocMigrateRewriteData", {
    description: "Per-block title-pass data consumed by the migration rewriter.",
  })
);

/**
 * Per-block data consumed by the rewriter, sourced from `titles.jsonl`.
 *
 * @category type-level
 * @since 0.0.0
 */
export type JSDocMigrateRewriteData = typeof JSDocMigrateRewriteData.Type;

/**
 * Result of rewriting one block: the new text with its conservation
 * allowances, a quarantine, or a frozen-data mismatch.
 *
 * @category type-level
 * @since 0.0.0
 */
export type JSDocMigrateRewriteResult =
  | {
      readonly _tag: "Rewritten";
      readonly text: string;
      readonly allowedAddedTokens: ReadonlyArray<string>;
      readonly allowedRemovedTokens: ReadonlyArray<string>;
    }
  | { readonly _tag: "Quarantined"; readonly reasons: ReadonlyArray<string> }
  | { readonly _tag: "DataMismatch"; readonly reasons: ReadonlyArray<string> };

type FenceLineClass = "outside" | "open" | "inside" | "close";

const classifyFenceLines = (lines: ReadonlyArray<string>): ReadonlyArray<FenceLineClass> => {
  const classes: Array<FenceLineClass> = [];
  let openFence: string | undefined;
  for (const line of lines) {
    const wasOpen = openFence !== undefined;
    const [nextOpenFence, isFenced] = fencedLineState(line, openFence);
    if (!isFenced) {
      A.appendInPlace(classes, "outside");
    } else if (!wasOpen && nextOpenFence !== undefined) {
      A.appendInPlace(classes, "open");
    } else if (wasOpen && nextOpenFence === undefined) {
      A.appendInPlace(classes, "close");
    } else {
      A.appendInPlace(classes, "inside");
    }
    openFence = nextOpenFence;
  }
  return classes;
};

// fallow-ignore-next-line complexity -- the fence open/inside/close state machine is one auditable scan; splitting it would separate the states from their transitions
const fenceBodies = (lines: ReadonlyArray<string>): ReadonlyArray<string> => {
  const classes = classifyFenceLines(lines);
  const bodies: Array<string> = [];
  let current: Array<string> | undefined;
  for (const [index, line] of A.entries(lines)) {
    const kind = classes[index];
    if (kind === "open") {
      current = [];
      continue;
    }
    if (kind === "close") {
      A.appendInPlace(bodies, A.join(current ?? [], "\n"));
      current = undefined;
      continue;
    }
    if (kind === "inside" && current !== undefined) {
      A.appendInPlace(current, line);
    }
  }
  if (current !== undefined) {
    A.appendInPlace(bodies, A.join(current, "\n"));
  }
  return bodies;
};

const tokenizeText = (value: string): ReadonlyArray<string> => A.filter(Str.split(/\s+/)(value), Str.isNonEmpty);

const tokenizeLinesMaskingFences = (lines: ReadonlyArray<string>): ReadonlyArray<string> => {
  const classes = classifyFenceLines(lines);
  const tokens: Array<string> = [];
  for (const [index, line] of A.entries(lines)) {
    if (classes[index] === "inside") {
      continue;
    }
    A.appendAllInPlace(tokens, tokenizeText(line));
  }
  return tokens;
};

const dropEdgeBlankLines = (lines: ReadonlyArray<string>): ReadonlyArray<string> => {
  let start = 0;
  let end = lines.length;
  while (start < end && Str.isEmpty(Str.trim(lines[start] ?? ""))) {
    start += 1;
  }
  while (end > start && Str.isEmpty(Str.trim(lines[end - 1] ?? ""))) {
    end -= 1;
  }
  return A.slice(lines, { start, end });
};

const blockContentLines = (blockText: string): ReadonlyArray<string> =>
  dropEdgeBlankLines(stripCommentFraming(blockText));

type TagSegment = {
  readonly tag: string;
  readonly lines: ReadonlyArray<string>;
};

const tagLinePattern = /^\s*@([A-Za-z][\w-]*)\b/;

const splitBodyAndTags = (
  lines: ReadonlyArray<string>
): { readonly bodyLines: ReadonlyArray<string>; readonly tagLines: ReadonlyArray<string> } => {
  const classes = classifyFenceLines(lines);
  let tagIndex = lines.length;
  for (const [index, line] of A.entries(lines)) {
    if (classes[index] === "outside" && tagLinePattern.test(line)) {
      tagIndex = index;
      break;
    }
  }
  return { bodyLines: A.take(lines, tagIndex), tagLines: A.drop(lines, tagIndex) };
};

const splitTagSegments = (tagLines: ReadonlyArray<string>): ReadonlyArray<TagSegment> => {
  const classes = classifyFenceLines(tagLines);
  const segments: Array<{ tag: string; lines: Array<string> }> = [];
  for (const [index, line] of A.entries(tagLines)) {
    const match = classes[index] === "outside" ? tagLinePattern.exec(line) : null;
    if (match !== null) {
      A.appendInPlace(segments, { tag: `@${match[1]}`, lines: [line] });
      continue;
    }
    const current = segments[segments.length - 1];
    if (current !== undefined) {
      A.appendInPlace(current.lines, line);
    }
  }
  return A.map(segments, (segment) => ({ tag: segment.tag, lines: dropEdgeBlankLines(segment.lines) }));
};

type BlockModel = {
  readonly bodyLines: ReadonlyArray<string>;
  readonly segments: ReadonlyArray<TagSegment>;
  readonly exampleSegments: ReadonlyArray<TagSegment>;
  readonly remarksSegments: ReadonlyArray<TagSegment>;
};

const parseBlockModel = (blockText: string): BlockModel => {
  const { bodyLines, tagLines } = splitBodyAndTags(blockContentLines(blockText));
  const segments = splitTagSegments(tagLines);
  return {
    bodyLines,
    segments,
    exampleSegments: A.filter(segments, (segment) => segment.tag === "@example"),
    remarksSegments: A.filter(segments, (segment) => segment.tag === "@remarks"),
  };
};

const sectionHeadingPattern = /^\s*\*\*(When to use|Details|Gotchas|Example)\*\*(?:\s*\((.*)\))?\s*$/;

type BodySection = {
  readonly name: "When to use" | "Details" | "Gotchas" | "Example";
  readonly markerLine: string;
  readonly contentLines: ReadonlyArray<string>;
};

const sectionRank: Record<BodySection["name"], number> = {
  "When to use": 0,
  Details: 1,
  Gotchas: 2,
  Example: 3,
};

const isSectionName = (value: string): value is BodySection["name"] =>
  value === "When to use" || value === "Details" || value === "Gotchas" || value === "Example";

const parseBodySections = (
  bodyLines: ReadonlyArray<string>
): { readonly leadLines: ReadonlyArray<string>; readonly sections: ReadonlyArray<BodySection> } => {
  const classes = classifyFenceLines(bodyLines);
  const starts: Array<{ readonly index: number; readonly name: BodySection["name"]; readonly markerLine: string }> = [];
  for (const [index, line] of A.entries(bodyLines)) {
    if (classes[index] !== "outside") {
      continue;
    }
    const match = sectionHeadingPattern.exec(line);
    const name = match?.[1];
    if (name !== undefined && isSectionName(name)) {
      A.appendInPlace(starts, { index, name, markerLine: line });
    }
  }
  const firstStart = starts[0]?.index ?? bodyLines.length;
  const sections = A.map(starts, (start, order) => {
    const nextIndex = starts[order + 1]?.index ?? bodyLines.length;
    return {
      name: start.name,
      markerLine: start.markerLine,
      contentLines: dropEdgeBlankLines(A.slice(bodyLines, { start: start.index + 1, end: nextIndex })),
    };
  });
  return { leadLines: dropEdgeBlankLines(A.take(bodyLines, firstStart)), sections };
};

const splitParagraphs = (lines: ReadonlyArray<string>): ReadonlyArray<ReadonlyArray<string>> => {
  const classes = classifyFenceLines(lines);
  const paragraphs: Array<Array<string>> = [];
  let current: Array<string> = [];
  for (const [index, line] of A.entries(lines)) {
    if (classes[index] === "outside" && Str.isEmpty(Str.trim(line))) {
      if (current.length > 0) {
        A.appendInPlace(paragraphs, current);
        current = [];
      }
      continue;
    }
    A.appendInPlace(current, line);
  }
  if (current.length > 0) {
    A.appendInPlace(paragraphs, current);
  }
  return paragraphs;
};

const joinParagraphs = (paragraphs: ReadonlyArray<ReadonlyArray<string>>): ReadonlyArray<string> => {
  const lines: Array<string> = [];
  for (const [index, paragraph] of A.entries(paragraphs)) {
    if (index > 0) {
      A.appendInPlace(lines, "");
    }
    A.appendAllInPlace(lines, paragraph);
  }
  return lines;
};

const tagRankTable: Record<string, number> = {
  "@packageDocumentation": -1,
  "@fileoverview": -1,
  "@typeParam": 0,
  "@param": 1,
  "@returns": 2,
  "@throws": 3,
  "@effects": 4,
  "@precondition": 5,
  "@postcondition": 5,
  "@invariant": 5,
  "@deprecated": 6,
  "@defaultValue": 7,
  "@see": 8,
  "@public": 9,
  "@beta": 9,
  "@alpha": 9,
  "@internal": 9,
  "@experimental": 9,
  "@category": 11,
  "@since": 12,
};

const tagRank = (tag: string): number => tagRankTable[tag] ?? 10;

const renamedTagTable: Record<string, string> = {
  "@template": "@typeParam",
  "@module": "@packageDocumentation",
  "@default": "@defaultValue",
};

const renamedTag = (tag: string): string | undefined => renamedTagTable[tag];

const typeBlobPattern = /^(\s*@(?:param|returns|throws)\s+)(\{[^}]+})\s*/;
const hyphenPattern = /^(\s*@(?:returns|throws)\s+)-\s+/;
const undescribedSeePattern = /^\s*@see\s+\{@link\s+[^}]+}\s*$/;

type NormalizedSegment = {
  readonly segment: TagSegment;
  readonly addedTokens: ReadonlyArray<string>;
  readonly removedTokens: ReadonlyArray<string>;
};

const applyGrammarNormalForms = (line: string, removedTokens: Array<string>): string => {
  let firstLine = line;
  const blobMatch = typeBlobPattern.exec(firstLine);
  if (blobMatch !== null) {
    A.appendAllInPlace(removedTokens, tokenizeText(blobMatch[2] ?? ""));
    firstLine = `${blobMatch[1]}${Str.slice(blobMatch[0].length)(firstLine)}`;
  }
  const hyphenMatch = hyphenPattern.exec(firstLine);
  if (hyphenMatch !== null) {
    A.appendInPlace(removedTokens, "-");
    firstLine = `${hyphenMatch[1]}${Str.slice(hyphenMatch[0].length)(firstLine)}`;
  }
  return firstLine;
};

const applySeePurpose = (
  tag: string,
  line: string,
  nextSeePurpose: () => string | undefined,
  addedTokens: Array<string>
): string => {
  if (tag !== "@see" || !undescribedSeePattern.test(line)) {
    return line;
  }
  const purpose = nextSeePurpose();
  if (purpose === undefined || Str.isEmpty(Str.trim(purpose))) {
    return line;
  }
  A.appendAllInPlace(addedTokens, tokenizeText(purpose));
  return `${Str.trimEnd(line)} ${Str.trim(purpose)}`;
};

const normalizeTagSegment = (segment: TagSegment, nextSeePurpose: () => string | undefined): NormalizedSegment => {
  const addedTokens: Array<string> = [];
  const removedTokens: Array<string> = [];
  let firstLine = segment.lines[0] ?? "";
  let tag = segment.tag;

  const rename = renamedTag(tag);
  if (rename !== undefined) {
    firstLine = Str.replace(new RegExp(`^(\\s*)${escapeRegExp(tag)}\\b`), `$1${rename}`)(firstLine);
    A.appendInPlace(removedTokens, tag);
    A.appendInPlace(addedTokens, rename);
    tag = rename;
  }

  firstLine = applyGrammarNormalForms(firstLine, removedTokens);
  firstLine = applySeePurpose(tag, firstLine, nextSeePurpose, addedTokens);

  return {
    segment: { tag, lines: [firstLine, ...A.drop(segment.lines, 1)] },
    addedTokens,
    removedTokens,
  };
};

const segmentText = (segment: TagSegment): string => A.join(segment.lines, "\n");

const multisetDiff = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): ReadonlyArray<string> => {
  const counts = MutableHashMap.empty<string, number>();
  for (const value of right) {
    MutableHashMap.set(counts, value, O.getOrElse(MutableHashMap.get(counts, value), () => 0) + 1);
  }
  const extra: Array<string> = [];
  for (const value of left) {
    const remaining = O.getOrElse(MutableHashMap.get(counts, value), () => 0);
    if (remaining > 0) {
      MutableHashMap.set(counts, value, remaining - 1);
    } else {
      A.appendInPlace(extra, value);
    }
  }
  return extra;
};

/**
 * Compute conservation-law findings between an original block and a candidate rewrite.
 *
 * **Details**
 *
 * Implements SPEC §5.3 clause (a) at the whole-block level: every fence's code
 * bytes must survive unchanged, no token may disappear beyond the declared
 * allowances of the applied normal forms, and no token may appear beyond the
 * data-sourced additions (section markers, titles, see purposes, renamed tag
 * spellings). An empty result means the candidate conserves the original.
 *
 * **Example** (Detect a destroyed fence)
 *
 * ```ts
 * import { jsdocMigrateConservationFindings } from "@beep/repo-cli/test/Quality"
 *
 * const original = "/**\n * Lead.\n *\n * ```ts\n * const a = 1\n * ```\n *" + "/"
 * const mutated = "/**\n * Lead.\n *\n * ```ts\n * const a = 2\n * ```\n *" + "/"
 * const findings = jsdocMigrateConservationFindings({
 *   original,
 *   candidate: mutated,
 *   allowedAddedTokens: [],
 *   allowedRemovedTokens: []
 * })
 * console.log(findings.some((finding) => finding.includes("fence"))) // true
 * ```
 *
 * @param input - Original and candidate block text with the declared token allowances.
 * @returns Conservation violations, empty when the candidate conserves the original.
 * @category use-cases
 * @since 0.0.0
 */
export const jsdocMigrateConservationFindings = (input: {
  readonly original: string;
  readonly candidate: string;
  readonly allowedAddedTokens: ReadonlyArray<string>;
  readonly allowedRemovedTokens: ReadonlyArray<string>;
}): ReadonlyArray<string> => {
  const findings: Array<string> = [];
  const originalLines = blockContentLines(input.original);
  const candidateLines = blockContentLines(input.candidate);

  const originalFences = fenceBodies(originalLines);
  const candidateFences = fenceBodies(candidateLines);
  const lostFences = multisetDiff(originalFences, candidateFences);
  const gainedFences = multisetDiff(candidateFences, originalFences);
  for (const fence of lostFences) {
    A.appendInPlace(findings, `fence-bytes-changed: lost fence ${JSON.stringify(Str.slice(0, 60)(fence))}`);
  }
  for (const fence of gainedFences) {
    A.appendInPlace(findings, `fence-bytes-changed: gained fence ${JSON.stringify(Str.slice(0, 60)(fence))}`);
  }

  const originalTokens = tokenizeLinesMaskingFences(originalLines);
  const candidateTokens = tokenizeLinesMaskingFences(candidateLines);
  const removed = multisetDiff(originalTokens, candidateTokens);
  const added = multisetDiff(candidateTokens, originalTokens);
  for (const token of multisetDiff(removed, input.allowedRemovedTokens)) {
    A.appendInPlace(findings, `token-removed: ${token}`);
  }
  for (const token of multisetDiff(added, input.allowedAddedTokens)) {
    A.appendInPlace(findings, `token-added: ${token}`);
  }

  return findings;
};

/**
 * Report documentation-shape rules whose finding count grew in a candidate rewrite.
 *
 * **Details**
 *
 * Wraps the ratchet's own scorer as the per-block oracle: a rewrite is
 * acceptable only when every rule's count shrinks or holds versus the
 * original block.
 *
 * **Example** (Accept a carrier conversion)
 *
 * ```ts
 * import { jsdocMigrateShapeRegressions } from "@beep/repo-cli/test/Quality"
 *
 * const original = "/**\n * Lead.\n *\n * @category models\n *" + "/"
 * console.log(jsdocMigrateShapeRegressions(original, original).length) // 0
 * ```
 *
 * @param original - Block text before the rewrite.
 * @param candidate - Block text after the rewrite.
 * @returns Rules whose finding count grew, empty when the shape held.
 * @category use-cases
 * @since 0.0.0
 */
export const jsdocMigrateShapeRegressions = (original: string, candidate: string): ReadonlyArray<string> => {
  const before = MutableHashMap.empty<string, number>();
  for (const issue of documentationShapeViolations(original)) {
    MutableHashMap.set(before, issue.rule, O.getOrElse(MutableHashMap.get(before, issue.rule), () => 0) + 1);
  }
  const after = MutableHashMap.empty<string, number>();
  for (const issue of documentationShapeViolations(candidate)) {
    MutableHashMap.set(after, issue.rule, O.getOrElse(MutableHashMap.get(after, issue.rule), () => 0) + 1);
  }
  const regressions: Array<string> = [];
  for (const [rule, count] of after) {
    const beforeCount = O.getOrElse(MutableHashMap.get(before, rule), () => 0);
    if (count > beforeCount) {
      A.appendInPlace(regressions, `shape-regression: ${rule} ${beforeCount} -> ${count}`);
    }
  }
  return regressions;
};

const tagClauseFindings = (input: {
  readonly expectedSegments: ReadonlyArray<TagSegment>;
  readonly candidate: string;
}): ReadonlyArray<string> => {
  const findings: Array<string> = [];
  const { tagLines } = splitBodyAndTags(blockContentLines(input.candidate));
  const candidateSegments = splitTagSegments(tagLines);
  for (const segment of candidateSegments) {
    if (segment.tag === "@example" || segment.tag === "@remarks") {
      A.appendInPlace(findings, `carrier-not-consumed: ${segment.tag}`);
    }
  }
  const expectedTexts = A.map(input.expectedSegments, segmentText);
  const candidateTexts = A.map(candidateSegments, segmentText);
  for (const text of multisetDiff(expectedTexts, candidateTexts)) {
    A.appendInPlace(findings, `tag-off-normal-form: missing ${JSON.stringify(Str.slice(0, 80)(text))}`);
  }
  for (const text of multisetDiff(candidateTexts, expectedTexts)) {
    A.appendInPlace(findings, `tag-off-normal-form: unexpected ${JSON.stringify(Str.slice(0, 80)(text))}`);
  }
  return findings;
};

const rebuildBlock = (lines: ReadonlyArray<string>, indent: string): string => {
  const rendered = A.map(lines, (line) =>
    Str.isEmpty(Str.trim(line)) ? `${indent} *` : `${indent} * ${Str.trimEnd(line)}`
  );
  return `/**\n${A.join(rendered, "\n")}\n${indent} */`;
};

type ExampleConversion = {
  readonly contentLines: ReadonlyArray<string>;
  readonly fenceCount: number;
};

const convertExampleSegment = (segment: TagSegment): ExampleConversion => {
  const firstLine = segment.lines[0] ?? "";
  const caption = Str.trim(Str.replace(/^\s*@example\b\s*/, "")(firstLine));
  const rest = A.drop(segment.lines, 1);
  const contentLines = dropEdgeBlankLines(Str.isEmpty(caption) ? rest : [caption, ...rest]);
  return { contentLines, fenceCount: fenceBodies(contentLines).length };
};

const remarksContentLines = (segment: TagSegment): ReadonlyArray<string> => {
  const firstLine = segment.lines[0] ?? "";
  const inline = Str.trim(Str.replace(/^\s*@remarks\b\s*/, "")(firstLine));
  const rest = A.drop(segment.lines, 1);
  return dropEdgeBlankLines(Str.isEmpty(inline) ? rest : [inline, ...rest]);
};

const appendSectionContent = (
  existing: ReadonlyArray<string>,
  addition: ReadonlyArray<string>
): ReadonlyArray<string> =>
  existing.length === 0 ? addition : addition.length === 0 ? existing : [...existing, "", ...addition];

// fallow-ignore-next-line complexity -- the transform is one auditable pipeline: consume carriers, split the lead, normalize tags, reassemble, then prove conservation
const rewriteBlockUnchecked = (
  blockText: string,
  data: JSDocMigrateRewriteData,
  indent: string
):
  | {
      readonly _tag: "Built";
      readonly text: string;
      readonly expectedSegments: ReadonlyArray<TagSegment>;
      readonly allowedAddedTokens: ReadonlyArray<string>;
      readonly allowedRemovedTokens: ReadonlyArray<string>;
    }
  | { readonly _tag: "Quarantined"; readonly reasons: ReadonlyArray<string> }
  | { readonly _tag: "DataMismatch"; readonly reasons: ReadonlyArray<string> } => {
  const { bodyLines, exampleSegments, remarksSegments, segments } = parseBlockModel(blockText);
  const reasons: Array<string> = [];

  // TSDoc forbids summary content in an `{@inheritDoc}` block
  // (eslint-plugin-tsdoc `tsdoc-inheritdoc-incompatible-summary`), and every
  // body section this rewrite emits — Example, Details, Gotchas — IS summary
  // content, while the legacy `@example`/`@remarks` block tags were legal
  // beside `@inheritDoc`. Converting would trade a retired carrier for a
  // TSDoc violation, so these blocks fail closed into the override channel;
  // the usual resolution is deleting the optional type-level example.
  if (Str.includes("{@inheritDoc")(blockText) && (exampleSegments.length > 0 || remarksSegments.length > 0)) {
    return { _tag: "Quarantined", reasons: ["inheritdoc-summary-content"] };
  }

  if (data.titles.length !== exampleSegments.length) {
    return {
      _tag: "DataMismatch",
      reasons: [
        `title-count-mismatch: block has ${exampleSegments.length} @example tag(s), record has ${data.titles.length} title(s)`,
      ],
    };
  }

  const conversions = A.map(exampleSegments, convertExampleSegment);
  for (const conversion of conversions) {
    if (conversion.fenceCount === 0) {
      A.appendInPlace(reasons, "unfenced-example");
    } else if (conversion.fenceCount > 1) {
      A.appendInPlace(reasons, "multi-fence-example");
    }
  }

  const { leadLines, sections: parsedSections } = parseBodySections(bodyLines);
  // A bare, empty `**Example**` heading directly above a legacy @example tag is
  // a stray marker artifact, not a real section: consume it into the titled
  // section the tag conversion produces. Any Example section with a title or
  // content alongside a legacy tag is a genuine mixed carrier and quarantines.
  const isStrayExampleMarker = (section: BodySection): boolean =>
    section.name === "Example" &&
    A.isReadonlyArrayEmpty(section.contentLines) &&
    /^\s*\*\*Example\*\*\s*$/.test(section.markerLine);
  const strayMarkers = exampleSegments.length > 0 ? A.filter(parsedSections, isStrayExampleMarker) : [];
  const sections =
    exampleSegments.length > 0 ? A.filter(parsedSections, (section) => !isStrayExampleMarker(section)) : parsedSections;
  if (exampleSegments.length > 0 && A.some(sections, (section) => section.name === "Example")) {
    A.appendInPlace(reasons, "mixed-example-carriers");
  }
  if (reasons.length > 0) {
    return { _tag: "Quarantined", reasons };
  }

  const allowedAddedTokens: Array<string> = [];
  const allowedRemovedTokens: Array<string> = [];
  for (const marker of strayMarkers) {
    A.appendAllInPlace(allowedRemovedTokens, tokenizeText(marker.markerLine));
  }

  const paragraphs = splitParagraphs(leadLines);
  const keepCount = data.leadEnd === undefined ? paragraphs.length : Math.max(1, data.leadEnd);
  const keptLead = joinParagraphs(A.take(paragraphs, keepCount));
  const movedLead = joinParagraphs(A.drop(paragraphs, keepCount));

  let detailsAddition: ReadonlyArray<string> = movedLead;
  let gotchasAddition: ReadonlyArray<string> = [];
  const routing = data.remarks ?? "details";
  for (const segment of remarksSegments) {
    const content = remarksContentLines(segment);
    if (routing === "gotchas") {
      gotchasAddition = appendSectionContent(gotchasAddition, content);
    } else {
      detailsAddition = appendSectionContent(detailsAddition, content);
    }
    A.appendInPlace(allowedRemovedTokens, "@remarks");
  }

  let newSections: Array<BodySection> = A.map(sections, (section) => ({ ...section }));
  const upsertSection = (name: "Details" | "Gotchas", addition: ReadonlyArray<string>): void => {
    if (addition.length === 0) {
      return;
    }
    const existingIndex = A.findFirstIndex(newSections, (section) => section.name === name);
    if (O.isSome(existingIndex)) {
      const existing = newSections[existingIndex.value];
      if (existing !== undefined) {
        newSections[existingIndex.value] = {
          ...existing,
          contentLines: appendSectionContent(existing.contentLines, addition),
        };
      }
      return;
    }
    const markerLine = `**${name}**`;
    A.appendInPlace(allowedAddedTokens, `**${name}**`);
    const insertIndex = pipe(
      A.findFirstIndex(newSections, (section) => sectionRank[section.name] > sectionRank[name]),
      O.getOrElse(() => newSections.length)
    );
    newSections = [
      ...A.take(newSections, insertIndex),
      { name, markerLine, contentLines: addition },
      ...A.drop(newSections, insertIndex),
    ];
  };
  upsertSection("Details", detailsAddition);
  upsertSection("Gotchas", gotchasAddition);

  for (const [index, conversion] of A.entries(conversions)) {
    const title = Str.trim(data.titles[index] ?? "");
    const markerLine = `**Example** (${title})`;
    A.appendAllInPlace(allowedAddedTokens, tokenizeText(markerLine));
    A.appendInPlace(newSections, { name: "Example", markerLine, contentLines: conversion.contentLines });
    A.appendInPlace(allowedRemovedTokens, "@example");
  }

  const purposes = [...(data.seePurposes ?? [])];
  let purposeIndex = 0;
  const nextSeePurpose = (): string | undefined => {
    const purpose = purposes[purposeIndex];
    purposeIndex += 1;
    return purpose;
  };
  const keptSegments = A.filter(segments, (segment) => segment.tag !== "@example" && segment.tag !== "@remarks");
  const normalized = A.map(keptSegments, (segment) => normalizeTagSegment(segment, nextSeePurpose));
  for (const entry of normalized) {
    A.appendAllInPlace(allowedAddedTokens, entry.addedTokens);
    A.appendAllInPlace(allowedRemovedTokens, entry.removedTokens);
  }
  const orderedSegments = pipe(
    A.map(normalized, (entry) => entry.segment),
    A.sortWith((segment) => tagRank(segment.tag), Order.Number)
  );

  const outLines: Array<string> = [...keptLead];
  for (const section of newSections) {
    if (outLines.length > 0) {
      A.appendInPlace(outLines, "");
    }
    A.appendInPlace(outLines, section.markerLine);
    if (section.contentLines.length > 0) {
      A.appendInPlace(outLines, "");
      A.appendAllInPlace(outLines, section.contentLines);
    }
  }
  if (orderedSegments.length > 0) {
    if (outLines.length > 0) {
      A.appendInPlace(outLines, "");
    }
    for (const segment of orderedSegments) {
      A.appendAllInPlace(outLines, segment.lines);
    }
  }

  return {
    _tag: "Built",
    text: rebuildBlock(outLines, indent),
    expectedSegments: orderedSegments,
    allowedAddedTokens,
    allowedRemovedTokens,
  };
};

/**
 * Structural statistics of one legacy-carrier block, recorded at extract time.
 *
 * **Example** (Validate block statistics)
 *
 * ```ts
 * import { JSDocMigrateBlockStats } from "@beep/repo-cli/test/Quality"
 * import * as S from "effect/Schema"
 *
 * console.log(
 *   S.is(JSDocMigrateBlockStats)({
 *     leadParagraphCount: 1,
 *     exampleTagCount: 1,
 *     unfencedExampleCount: 0,
 *     remarksTagCount: 0,
 *     undescribedSeeCount: 0
 *   })
 * ) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const JSDocMigrateBlockStats = S.Struct({
  leadParagraphCount: S.Int,
  exampleTagCount: S.Int,
  unfencedExampleCount: S.Int,
  remarksTagCount: S.Int,
  undescribedSeeCount: S.Int,
}).pipe(
  $I.annoteSchema("JSDocMigrateBlockStats", {
    description: "Structural statistics of one legacy-carrier JSDoc block at extract time.",
  })
);

/**
 * Structural statistics of one legacy-carrier block, recorded at extract time.
 *
 * @category type-level
 * @since 0.0.0
 */
export type JSDocMigrateBlockStats = typeof JSDocMigrateBlockStats.Type;

/**
 * Compute the structural statistics extract records carry for one block.
 *
 * **Details**
 *
 * These counts drive the title pass: how many Example titles a block needs,
 * whether a remarks routing is required, whether a lead split point is
 * useful, and how many `@see` purpose phrases to request. Unfenced examples
 * are counted so the known auto-quarantine tail stays measurable.
 *
 * **Example** (Measure a legacy block)
 *
 * ```ts
 * import { jsdocMigrateBlockStats } from "@beep/repo-cli/test/Quality"
 *
 * const block = "/**\n * Lead.\n *\n * @example\n * ```ts\n * const a = 1\n * ```\n *" + "/"
 * const stats = jsdocMigrateBlockStats(block)
 * console.log(stats.exampleTagCount) // 1
 * console.log(stats.unfencedExampleCount) // 0
 * ```
 *
 * @param blockText - Raw JSDoc block text to measure.
 * @returns Structural counters consumed by the title pass.
 * @category use-cases
 * @since 0.0.0
 */
export const jsdocMigrateBlockStats = (blockText: string): JSDocMigrateBlockStats => {
  const { bodyLines, exampleSegments, segments } = parseBlockModel(blockText);
  const conversions = A.map(exampleSegments, convertExampleSegment);
  const { leadLines } = parseBodySections(bodyLines);
  return {
    leadParagraphCount: splitParagraphs(leadLines).length,
    exampleTagCount: exampleSegments.length,
    unfencedExampleCount: A.filter(conversions, (conversion) => conversion.fenceCount === 0).length,
    remarksTagCount: A.filter(segments, (segment) => segment.tag === "@remarks").length,
    undescribedSeeCount: A.filter(
      segments,
      (segment) => segment.tag === "@see" && undescribedSeePattern.test(segment.lines[0] ?? "")
    ).length,
  };
};

/**
 * Rewrite one legacy-carrier JSDoc block and prove the rewrite conservative.
 *
 * **Details**
 *
 * Applies the full SPEC §5 transform set — carrier consumption, lead
 * splitting, grammar normal forms, canonical tag order, see purposes — then
 * checks both conservation clauses and the shape oracle. Any violation
 * returns `Quarantined` and the block must flow to `overrides.jsonl`; a
 * frozen-data disagreement (wrong title count) returns `DataMismatch`, which
 * callers must escalate rather than skip.
 *
 * **Example** (Convert a legacy example tag)
 *
 * ```ts
 * import { rewriteJSDocMigrateBlock } from "@beep/repo-cli/test/Quality"
 *
 * const block = "/**\n * Lead.\n *\n * @example\n * ```ts\n * const a = 1\n * ```\n *\n * @category models\n *" + "/"
 * const result = rewriteJSDocMigrateBlock({
 *   blockText: block,
 *   indent: "",
 *   data: { titles: ["Add numbers"] }
 * })
 * console.log(result._tag) // "Rewritten"
 * ```
 *
 * @param input - Block text, indentation, and the per-block title data.
 * @returns The rewritten block with its allowances, a quarantine, or a data mismatch.
 * @category use-cases
 * @since 0.0.0
 */
export const rewriteJSDocMigrateBlock = (input: {
  readonly blockText: string;
  readonly indent: string;
  readonly data: JSDocMigrateRewriteData;
}): JSDocMigrateRewriteResult => {
  const built = rewriteBlockUnchecked(input.blockText, input.data, input.indent);
  if (built._tag !== "Built") {
    return built;
  }
  const reasons: Array<string> = [
    ...jsdocMigrateConservationFindings({
      original: input.blockText,
      candidate: built.text,
      allowedAddedTokens: built.allowedAddedTokens,
      allowedRemovedTokens: built.allowedRemovedTokens,
    }),
    ...tagClauseFindings({ expectedSegments: built.expectedSegments, candidate: built.text }),
    ...jsdocMigrateShapeRegressions(input.blockText, built.text),
  ];
  if (reasons.length > 0) {
    return { _tag: "Quarantined", reasons };
  }
  return {
    _tag: "Rewritten",
    text: built.text,
    allowedAddedTokens: built.allowedAddedTokens,
    allowedRemovedTokens: built.allowedRemovedTokens,
  };
};
