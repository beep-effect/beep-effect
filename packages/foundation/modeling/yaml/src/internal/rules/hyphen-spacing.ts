import { $YamlId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { YamlEdit } from "../../YamlEdit.ts";
import { YamlLintDiagnostic, YamlLintSeverity, YamlRule } from "../../YamlLintRule.ts";
import { positiveIntegerOption } from "./util.ts";
import type { LintContext } from "../../YamlLintRule.ts";
import type { YamlToken } from "../../YamlToken.ts";

const $I = $YamlId.create("internal/rules/hyphen-spacing");

/**
 * Limit spaces after the block-sequence hyphen indicator.
 *
 * **Details**
 *
 * Options for `hyphen-spacing`: `maxSpacesAfter` (default 1) after the `-`.
 *
 * **Gotchas**
 *
 * At least one separation space must follow the indicator — `0` would make
 * the fix emit `-item`, a plain scalar, not a sequence entry.
 *
 * **Example** (Decode hyphen-spacing options)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { hyphenSpacingOptions } from "@beep/yaml/internal/rules/hyphen-spacing";
 *
 * const options = S.decodeUnknownSync(hyphenSpacingOptions)({ maxSpacesAfter: 1 });
 * console.log(options.maxSpacesAfter) // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class hyphenSpacingOptions extends S.Opaque<hyphenSpacingOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.optionalKey(YamlLintSeverity).pipe(
      $I.annoteKey("hyphenSpacingOptions.severity", {
        description: "Reporting level for sequence-entry spacing findings, defaulting to `error`",
      })
    ),
    maxSpacesAfter: S.optionalKey(positiveIntegerOption).pipe(
      $I.annoteKey("hyphenSpacingOptions.maxSpacesAfter", {
        description:
          "Maximum spaces between a block-sequence `-` and its same-line item, at least 1 and defaulting to 1",
      })
    ),
  }).pipe(
    $I.annoteSchema("hyphenSpacingOptions", {
      description:
        "Options for `hyphen-spacing`: `maxSpacesAfter` (default 1) after the `-`. At least one separation space must follow the indicator — `0` would make the fix emit `-item`, a plain scalar, not a sequence entry.",
    })
  )
) {}

const blockHeaderWithExplicitIndentIndicator = /^[|>](?:[1-9][+-]?|[+-][1-9])(?:[ \t\r\n]|$)/;

const isFlowStart = (kind: YamlToken["kind"]): boolean => kind === "flow-map-start" || kind === "flow-seq-start";

const isFlowEnd = (kind: YamlToken["kind"]): boolean => kind === "flow-map-end" || kind === "flow-seq-end";

const isBlockIndicator = (kind: YamlToken["kind"]): boolean =>
  kind === "block-seq-entry" || kind === "block-map-key" || kind === "block-map-value";

const isTransparentToken = (kind: YamlToken["kind"]): boolean =>
  kind === "whitespace" || kind === "tag" || kind === "anchor";

const isLayoutToken = (kind: YamlToken["kind"]): boolean =>
  kind === "whitespace" || kind === "newline" || kind === "comment";

type SameLineStructureByTokenIndex = {
  readonly compactEntries: Array<boolean>;
  readonly explicitScalarParents: Array<boolean>;
};

type ForwardScanResetPerLine = { line: number; flowDepth: number; previousContentIndex: number };

const hasExplicitScalarChild = (
  tokens: ReadonlyArray<YamlToken>,
  token: YamlToken,
  previousContentIndex: number
): boolean =>
  token.kind === "scalar" &&
  previousContentIndex >= 0 &&
  A.getUnsafe(tokens, previousContentIndex).kind === "block-seq-entry" &&
  O.isSome(Str.match(blockHeaderWithExplicitIndentIndicator)(token.text));

const markCompactEntry = (
  scan: ForwardScanResetPerLine,
  structure: SameLineStructureByTokenIndex,
  token: YamlToken,
  index: number
): void => {
  if (isFlowStart(token.kind)) {
    scan.flowDepth++;
  } else if (isFlowEnd(token.kind)) {
    scan.flowDepth--;
  } else if (scan.flowDepth === 0 && isBlockIndicator(token.kind)) {
    structure.compactEntries[index] = true;
  }
};

const stepForward = (
  tokens: ReadonlyArray<YamlToken>,
  scan: ForwardScanResetPerLine,
  structure: SameLineStructureByTokenIndex,
  index: number
): void => {
  const token = A.getUnsafe(tokens, index);
  if (token.line !== scan.line) {
    scan.line = token.line;
    scan.flowDepth = 0;
    scan.previousContentIndex = -1;
  }
  if (isTransparentToken(token.kind)) return;
  if (hasExplicitScalarChild(tokens, token, scan.previousContentIndex))
    structure.explicitScalarParents[scan.previousContentIndex] = true;
  markCompactEntry(scan, structure, token, index);
  scan.previousContentIndex = index;
};

const indexSameLineStructureByTokenIndex = (tokens: ReadonlyArray<YamlToken>): SameLineStructureByTokenIndex => {
  const structure: SameLineStructureByTokenIndex = {
    compactEntries: A.makeBy(tokens.length, () => false),
    explicitScalarParents: A.makeBy(tokens.length, () => false),
  };
  const scan: ForwardScanResetPerLine = { line: -1, flowDepth: 0, previousContentIndex: -1 };
  for (let index = 0; index < tokens.length; index++) stepForward(tokens, scan, structure, index);
  return structure;
};

type BackwardSuffixSummary = {
  line: number;
  nextContentCharacter: number;
  nextLineCharacter: number;
  compact: boolean;
  movesScalarParent: boolean;
};

const stepBackward = (
  scan: BackwardSuffixSummary,
  structure: SameLineStructureByTokenIndex,
  token: YamlToken,
  index: number
): boolean => {
  if (token.line !== scan.line) {
    scan.line = token.line;
    scan.nextLineCharacter = scan.nextContentCharacter;
    scan.compact = false;
    scan.movesScalarParent = false;
  }
  const hyphenWouldRelocateCollection =
    scan.movesScalarParent || (scan.compact && scan.nextLineCharacter > token.character);
  scan.compact = scan.compact || A.getUnsafe(structure.compactEntries, index);
  // The parent hyphen itself stays put when deleting spaces after it.
  // Only earlier hyphens move that parent and must withhold their fix.
  scan.movesScalarParent = scan.movesScalarParent || A.getUnsafe(structure.explicitScalarParents, index);
  if (!isLayoutToken(token.kind)) scan.nextContentCharacter = token.character;
  return hyphenWouldRelocateCollection;
};

const relocationSuffixSummary = (
  tokens: ReadonlyArray<YamlToken>,
  structure: SameLineStructureByTokenIndex
): ReadonlyArray<boolean> => {
  const relocatesCollections = A.makeBy(tokens.length, () => false);
  const scan: BackwardSuffixSummary = {
    line: -1,
    nextContentCharacter: -1,
    nextLineCharacter: -1,
    compact: false,
    movesScalarParent: false,
  };
  for (let index = tokens.length - 1; index >= 0; index--) {
    relocatesCollections[index] = stepBackward(scan, structure, A.getUnsafe(tokens, index), index);
  }
  return relocatesCollections;
};

const spacesFrom = (text: string, from: number): number => {
  let j = from;
  while (j < text.length && text[j] === " ") j++;
  return j - from;
};

const hyphenFinding = (
  text: string,
  token: YamlToken,
  maxAfter: number,
  relocatesCollection: boolean
): YamlLintDiagnostic | undefined => {
  const start = token.offset + token.length;
  const after = spacesFrom(text, start);
  const next = text[start + after];
  if (next === undefined || next === "\n" || next === "\r" || next === "#") return undefined;
  if (after <= maxAfter) return undefined;
  return YamlLintDiagnostic.make({
    rule: "hyphen-spacing",
    severity: "error",
    message: `Too many spaces after "-" (${after} > ${maxAfter})`,
    offset: start,
    length: after,
    line: token.line,
    character: token.character + token.length,
    ...(relocatesCollection
      ? {}
      : {
          fix: YamlEdit.make({
            offset: start,
            length: after - maxAfter,
            content: "",
          }),
        }),
  });
};

/**
 * Check spacing after the block-sequence `-` indicator.
 *
 * **Details**
 *
 * Spaces before the hyphen belong to indentation; comments after it belong
 * to comment spacing. Excess spaces can be deleted while preserving at least
 * one separation space. A finding has no fix when moving a compact block
 * collection would change the indentation of its continuation entries.
 *
 * **Example** (Find excess sequence-entry spacing)
 *
 * ```ts
 * import { hyphenSpacing } from "@beep/yaml/internal/rules/hyphen-spacing";
 * import { YamlLint, YamlLintConfig } from "@beep/yaml/YamlLint";
 *
 * const config = YamlLintConfig.make({
 *   rules: { "hyphen-spacing": { maxSpacesAfter: 1 } },
 * });
 * const diagnostics = YamlLint.run("-   item\n", [hyphenSpacing], config);
 * console.log(diagnostics.length) // 1
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const hyphenSpacing = YamlRule.make({
  id: "hyphen-spacing",
  check: dual(2, (ctx: LintContext, options: unknown): Iterable<YamlLintDiagnostic> => {
    const opts = P.isObject(options) ? options : {};
    const separationSafeMaxAfter = Math.max(1, P.isNumber(opts.maxSpacesAfter) ? opts.maxSpacesAfter : 1);
    const relocatesCollections = relocationSuffixSummary(ctx.tokens, indexSameLineStructureByTokenIndex(ctx.tokens));
    const out: Array<YamlLintDiagnostic> = [];
    for (let tokenIndex = 0; tokenIndex < ctx.tokens.length; tokenIndex++) {
      const token = A.getUnsafe(ctx.tokens, tokenIndex);
      if (token.kind !== "block-seq-entry") continue;
      const finding = hyphenFinding(
        ctx.text,
        token,
        separationSafeMaxAfter,
        A.getUnsafe(relocatesCollections, tokenIndex)
      );
      if (finding !== undefined) out.push(finding);
    }
    return out;
  }),
});
