/**
 * WHATWG heading-outline computation and authoring checks.
 *
 * @packageDocumentation
 * @internal
 * @since 0.0.0
 */

import { $HtmlId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import { Match, Number as N, pipe, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { HeadingOffset } from "../../Html.attributes.ts";
import { HtmlTag } from "../../Html.meta.ts";
import {
  hasHtmlAttribute,
  htmlAttributeValue,
  htmlChildPath,
  htmlChildrenOf,
  makeHtmlConformanceIssue,
} from "./Html.conformance-contracts.ts";
import type { HtmlRoot } from "../../Html.model.ts";
import type { HtmlChildView, HtmlConformanceIssue } from "./Html.conformance-contracts.ts";

const $I = $HtmlId.create("Html.conformance");

/**
 * Computed level of an HTML heading after applying `headingoffset` and
 * `headingreset`. WHATWG caps the computed value at nine.
 *
 * **Example** (Check a computed heading level)
 *
 * ```ts import.meta.vitest name="Check a computed heading level"
 * import { HtmlComputedHeadingLevel } from "@beep/html/Html.conformance"
 * import * as S from "effect/Schema"
 *
 * S.is(HtmlComputedHeadingLevel)(9) // => true
 * S.is(HtmlComputedHeadingLevel)(10) // => false
 * ```
 *
 * @invariant Values are integers from one through nine, inclusive.
 * @see {@link https://html.spec.whatwg.org/multipage/sections.html#heading-levels-and-offsets | WHATWG HTML heading levels and offsets} for the normative heading-level definition.
 * @category models
 * @since 0.0.0
 */
export const HtmlComputedHeadingLevel = LiteralKit([1, 2, 3, 4, 5, 6, 7, 8, 9]).pipe(
  $I.annoteSchema("HtmlComputedHeadingLevel", {
    description: "Computed HTML heading level after ancestor offsets, capped at nine.",
  })
);

/**
 * Type for {@link HtmlComputedHeadingLevel}.
 *
 * **Example** (Annotate a computed heading level)
 *
 * ```ts
 * import type { HtmlComputedHeadingLevel } from "@beep/html/Html.conformance"
 *
 * const level: HtmlComputedHeadingLevel = 3
 * console.log(level)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlComputedHeadingLevel = typeof HtmlComputedHeadingLevel.Type;

const HtmlHeadingTag = LiteralKit(["h1", "h2", "h3", "h4", "h5", "h6"]);
/**
 * Runtime guard for the six native HTML heading tags.
 *
 * @internal
 * @category guards
 * @since 0.0.0
 */
export const isHtmlHeadingTag = S.is(HtmlHeadingTag);

/**
 * Native HTML heading tag represented by the private heading inspector.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type HtmlHeadingTag = typeof HtmlHeadingTag.Type;

/**
 * One heading in document tree order with its computed semantic level.
 *
 * **Example** (Inspect one outline entry)
 *
 * ```ts import.meta.vitest name="Inspect one outline entry"
 * import { computeHeadingOutline } from "@beep/html/Html.conformance"
 * import { H1 } from "@beep/html/Html.model"
 *
 * computeHeadingOutline(H1.make({ children: [] }))[0]?.level // => 1
 * ```
 *
 * @see {@link https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines | WHATWG HTML headings and outlines} for the normative outline rules.
 * @category models
 * @since 0.0.0
 */
export class HtmlHeadingOutlineEntry extends S.Class<HtmlHeadingOutlineEntry>($I`HtmlHeadingOutlineEntry`)(
  {
    path: S.Array(S.String),
    tag: HtmlHeadingTag,
    level: HtmlComputedHeadingLevel,
  },
  $I.annote("HtmlHeadingOutlineEntry", {
    description: "Path-addressed HTML heading with its computed semantic level.",
  })
) {}

/**
 * Advisory authoring rules which are intentionally not hard conformance
 * failures.
 *
 * **Example** (Check an advisory rule)
 *
 * ```ts import.meta.vitest name="Check an advisory rule"
 * import { HtmlBestPracticeRule } from "@beep/html/Html.conformance"
 *
 * HtmlBestPracticeRule.is.headingLevelOne("headingLevelOne") // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HtmlBestPracticeRule = LiteralKit(["headingLevelOne"]).pipe(
  $I.annoteSchema("HtmlBestPracticeRule", {
    description: "Advisory HTML authoring rule kept separate from hard conformance failures.",
  })
);

/**
 * Type for {@link HtmlBestPracticeRule}.
 *
 * **Example** (Annotate an advisory rule)
 *
 * ```ts
 * import type { HtmlBestPracticeRule } from "@beep/html/Html.conformance"
 *
 * const rule: HtmlBestPracticeRule = "headingLevelOne"
 * console.log(rule)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlBestPracticeRule = typeof HtmlBestPracticeRule.Type;

/**
 * One non-fatal HTML authoring recommendation.
 *
 * **Example** (Construct a best-practice issue)
 *
 * ```ts import.meta.vitest name="Construct a best-practice issue"
 * import { HtmlBestPracticeIssue } from "@beep/html/Html.conformance"
 *
 * const issue = HtmlBestPracticeIssue.make({
 *   path: [],
 *   rule: "headingLevelOne",
 *   message: "The outline should contain a level-one heading"
 * })
 * issue.rule // => "headingLevelOne"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HtmlBestPracticeIssue extends S.Class<HtmlBestPracticeIssue>($I`HtmlBestPracticeIssue`)(
  {
    path: S.Array(S.String),
    rule: HtmlBestPracticeRule,
    message: S.String,
  },
  $I.annote("HtmlBestPracticeIssue", {
    description: "Path-addressed, non-fatal HTML authoring recommendation.",
  })
) {}

const isHeadingOffset = S.is(HeadingOffset);
const isHtmlTag = S.is(HtmlTag);

const declaredHeadingLevel = (tag: HtmlHeadingTag): HtmlComputedHeadingLevel =>
  Match.value(tag).pipe(
    Match.when("h1", () => 1 as const),
    Match.when("h2", () => 2 as const),
    Match.when("h3", () => 3 as const),
    Match.when("h4", () => 4 as const),
    Match.when("h5", () => 5 as const),
    Match.when("h6", () => 6 as const),
    Match.exhaustive
  );

const headingOffsetOf = (node: HtmlChildView): number =>
  pipe(
    htmlAttributeValue(node.headingoffset),
    O.filter(isHeadingOffset),
    O.getOrElse(() => 0)
  );

const collectHeadingOutline = (
  node: HtmlChildView,
  path: ReadonlyArray<string>,
  inheritedOffset: number
): ReadonlyArray<HtmlHeadingOutlineEntry> => {
  const tag = node._tag;
  const isElement = isHtmlTag(tag);
  const effectiveOffset = isElement
    ? (hasHtmlAttribute(node.headingreset) ? 0 : inheritedOffset) + headingOffsetOf(node)
    : inheritedOffset;
  const own = isHtmlHeadingTag(tag)
    ? pipe(
        N.min(declaredHeadingLevel(tag) + effectiveOffset, 9),
        S.decodeUnknownResult(HtmlComputedHeadingLevel),
        Result.match({
          // A schema-valid root and HeadingOffset guard make this branch unreachable;
          // retaining it keeps outline inspection total for defensive foreign calls.
          onFailure: A.emptyReadonly,
          onSuccess: (level) => [HtmlHeadingOutlineEntry.make({ path, tag, level })],
        })
      )
    : A.empty<HtmlHeadingOutlineEntry>();
  return A.appendAll(
    own,
    A.flatMap(htmlChildrenOf(node), (child, index) =>
      collectHeadingOutline(child, htmlChildPath(path, index), effectiveOffset)
    )
  );
};

/**
 * Computes the WHATWG heading outline in tree order, including ancestor
 * `headingoffset` values and `headingreset` boundaries.
 *
 * **Example** (Apply heading offsets)
 *
 * ```ts import.meta.vitest name="Apply heading offsets"
 * import { computeHeadingOutline } from "@beep/html/Html.conformance"
 * import { H1, Section } from "@beep/html/Html.model"
 * import * as O from "effect/Option"
 *
 * const root = Section.make({
 *   headingoffset: O.some(1),
 *   children: [H1.make({ children: [] })]
 * })
 * computeHeadingOutline(root)[0]?.level // => 2
 * ```
 *
 * @invariant Entries are emitted in tree order and their computed levels are capped at nine.
 * @see {@link https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines | WHATWG HTML headings and outlines} for the normative outline rules.
 * @category validation
 * @since 0.0.0
 */
export const computeHeadingOutline = (root: HtmlRoot.Type): ReadonlyArray<HtmlHeadingOutlineEntry> =>
  collectHeadingOutline(root, [], 0);

/**
 * Reports hard skipped-heading violations from the computed outline.
 *
 * @internal
 * @category validation
 * @since 0.0.0
 */
export const inspectHeadingOutline = (root: HtmlRoot.Type): ReadonlyArray<HtmlConformanceIssue> => {
  const outline = computeHeadingOutline(root);
  return pipe(
    A.zip(outline, A.drop(outline, 1)),
    A.flatMap(([lead, current]) =>
      current.level <= lead.level + 1
        ? A.empty<HtmlConformanceIssue>()
        : [
            makeHtmlConformanceIssue(
              current.path,
              "headingOutline",
              `<${current.tag}> has computed level ${current.level}, which skips level ${lead.level + 1} after computed level ${lead.level}`
            ),
          ]
    )
  );
};

/**
 * Returns non-fatal authoring recommendations for an HTML root. These checks
 * are kept separate from `inspectConformance` because WHATWG uses
 * recommendation language rather than a mandatory author requirement.
 *
 * **Example** (Report a missing level-one heading)
 *
 * ```ts import.meta.vitest name="Report a missing level-one heading"
 * import { inspectBestPractices } from "@beep/html/Html.conformance"
 * import { H2 } from "@beep/html/Html.model"
 *
 * inspectBestPractices(H2.make({ children: [] }))[0]?.rule // => "headingLevelOne"
 * ```
 *
 * @see {@link https://html.spec.whatwg.org/multipage/sections.html#headings-and-outlines | WHATWG HTML headings and outlines} for the normative outline rules.
 * @category validation
 * @since 0.0.0
 */
export const inspectBestPractices = (root: HtmlRoot.Type): ReadonlyArray<HtmlBestPracticeIssue> => {
  const outline = computeHeadingOutline(root);
  return pipe(
    A.head(outline),
    O.match({
      onNone: A.emptyReadonly,
      onSome: (first) =>
        A.some(outline, (heading) => heading.level === 1)
          ? A.emptyReadonly()
          : [
              HtmlBestPracticeIssue.make({
                path: first.path,
                rule: "headingLevelOne",
                message:
                  "A document outline containing headings should include at least one computed level-one heading",
              }),
            ],
    })
  );
};
