/**
 * Renderers for `skills review`, `skills patch add`, and `skills patch label`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { renderPrettyCommandJson } from "../../internal/cli/Json.ts";
import { SkillPatchAddReceipt, SkillPatchLabelReceipt } from "./SkillsPatch.schemas.ts";
import { SkillReviewSession } from "./SkillsReview.schemas.ts";
import type { SkillReviewItem, SkillReviewSkill } from "./SkillsReview.schemas.ts";

const encodeSessionJson = S.encodeResult(S.fromJsonString(SkillReviewSession));
const encodePatchAddJson = S.encodeResult(S.fromJsonString(SkillPatchAddReceipt));
const encodePatchLabelJson = S.encodeResult(S.fromJsonString(SkillPatchLabelReceipt));

const short = Str.slice(0, 12);

/**
 * Renders a review session as indented `skills-review/v1` JSON.
 *
 * **Example** (Render an empty session)
 *
 * ```ts
 * import { renderSkillReviewSessionJson } from "@beep/repo-cli/commands/Skills/SkillsReview.render"
 * import { SkillReviewSession } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 *
 * const text = renderSkillReviewSessionJson(
 *   SkillReviewSession.make({ stoppedBy: "listed", budgetMinutes: 20, recorded: [], queue: [], skills: [] })
 * )
 * console.log(text.includes("skills-review/v1")) // true
 * ```
 *
 * @param session - The session `skills review` returned.
 * @returns The JSON text with a trailing newline.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillReviewSessionJson = (session: SkillReviewSession): string =>
  encodeSessionJson(session).pipe(Result.getOrThrow, renderPrettyCommandJson);

const itemLine = (item: SkillReviewItem): string =>
  `  - ${item.skill} ${item.kind}: ${item.patch} ${item.file} hunk ${item.hunk === 0 ? "section" : item.hunk} (${item.status}, labelled ${item.currentLabel}) ${short(item.hunkHash)}${
    item.twoStrike ? " — two strikes: promote-candidate suggested" : ""
  }${O.getOrElse(
    O.map(
      item.ghost,
      (prior) =>
        ` — ghost: ${prior.decision}${O.match(prior.label, { onNone: () => "", onSome: (label) => ` as ${label}` })} by ${prior.reviewer}`
    ),
    () => ""
  )}`;

const skillLine = (skill: SkillReviewSkill): string =>
  `  ${skill.skill}: ${skill.state}${skill.unresolved === 0 ? "" : ` (${skill.unresolved} undecided)`} at ${short(
    skill.newRevision
  )}${Str.Equivalence(skill.oldRevision, skill.newRevision) ? "" : ` (bump from ${short(skill.oldRevision)})`}`;

/**
 * Renders a review session as a headline, one line per skill, and the queue.
 *
 * **Example** (Render an empty session)
 *
 * ```ts
 * import { renderSkillReviewSessionSummary } from "@beep/repo-cli/commands/Skills/SkillsReview.render"
 * import { SkillReviewSession } from "@beep/repo-cli/commands/Skills/SkillsReview.schemas"
 *
 * const text = renderSkillReviewSessionSummary(
 *   SkillReviewSession.make({ stoppedBy: "listed", budgetMinutes: 20, recorded: [], queue: [], skills: [] })
 * )
 * console.log(text.startsWith("skills review: listed")) // true
 * ```
 *
 * @param session - The session `skills review` returned.
 * @returns The human-readable summary.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillReviewSessionSummary = (session: SkillReviewSession): string =>
  A.join(
    [
      `skills review: ${session.stoppedBy}; ${A.length(session.recorded)} recorded, ${A.length(session.queue)} queued (budget ${session.budgetMinutes} min)`,
      ...A.map(session.skills, skillLine),
      ...(A.isReadonlyArrayEmpty(session.queue)
        ? A.empty<string>()
        : ["Queued hunks:", ...A.map(session.queue, itemLine)]),
    ],
    "\n"
  );

/**
 * Renders a `skills patch add` receipt as indented `skills-patch-add-plan/v1` JSON.
 *
 * **Example** (Inspect the renderer)
 *
 * ```ts
 * import { renderSkillPatchAddReceiptJson } from "@beep/repo-cli/commands/Skills/SkillsReview.render"
 *
 * console.log(typeof renderSkillPatchAddReceiptJson) // "function"
 * ```
 *
 * @param receipt - The receipt `skills patch add` returned.
 * @returns The JSON text with a trailing newline.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillPatchAddReceiptJson = (receipt: SkillPatchAddReceipt): string =>
  encodePatchAddJson(receipt).pipe(Result.getOrThrow, renderPrettyCommandJson);

/**
 * Renders a `skills patch add` receipt as one line per new patch under a headline.
 *
 * **Example** (Inspect the renderer)
 *
 * ```ts
 * import { renderSkillPatchAddSummary } from "@beep/repo-cli/commands/Skills/SkillsReview.render"
 *
 * console.log(typeof renderSkillPatchAddSummary) // "function"
 * ```
 *
 * @param receipt - The receipt `skills patch add` returned.
 * @returns The human-readable summary.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillPatchAddSummary = (receipt: SkillPatchAddReceipt): string =>
  A.join(
    [
      `skills patch add ${receipt.skill}: ${receipt.outcome}; ${A.length(receipt.added)} new patch(es) (planDigest ${receipt.planDigest}; effective ${receipt.effective.treeHash})`,
      ...A.map(receipt.added, (patch) => `  + ${patch.path} (${patch.label}, ${patch.owner})`),
    ],
    "\n"
  );

/**
 * Renders a `skills patch label` receipt as indented `skills-patch-label-plan/v1` JSON.
 *
 * **Example** (Inspect the renderer)
 *
 * ```ts
 * import { renderSkillPatchLabelReceiptJson } from "@beep/repo-cli/commands/Skills/SkillsReview.render"
 *
 * console.log(typeof renderSkillPatchLabelReceiptJson) // "function"
 * ```
 *
 * @param receipt - The receipt `skills patch label` returned.
 * @returns The JSON text with a trailing newline.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillPatchLabelReceiptJson = (receipt: SkillPatchLabelReceipt): string =>
  encodePatchLabelJson(receipt).pipe(Result.getOrThrow, renderPrettyCommandJson);

/**
 * Renders a `skills patch label` receipt as its changes and pending patches under a headline.
 *
 * **Example** (Inspect the renderer)
 *
 * ```ts
 * import { renderSkillPatchLabelSummary } from "@beep/repo-cli/commands/Skills/SkillsReview.render"
 *
 * console.log(typeof renderSkillPatchLabelSummary) // "function"
 * ```
 *
 * @param receipt - The receipt `skills patch label` returned.
 * @returns The human-readable summary.
 * @category formatting
 * @since 0.0.0
 */
export const renderSkillPatchLabelSummary = (receipt: SkillPatchLabelReceipt): string =>
  A.join(
    [
      `skills patch label ${receipt.skill}: ${receipt.outcome}; ${A.length(receipt.changes)} change(s), ${A.length(receipt.pending)} pending (planDigest ${receipt.planDigest})`,
      ...A.map(
        receipt.changes,
        (change) =>
          `  ${change.patch}: ${change.from} -> ${change.to}${
            Str.Equivalence(change.fromDropCondition, change.toDropCondition)
              ? ""
              : ` (drop condition "${change.fromDropCondition}" -> "${change.toDropCondition}")`
          }`
      ),
      ...A.map(receipt.pending, (pending) => `  ${pending.patch}: pending (${pending.reason})`),
    ],
    "\n"
  );
