import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import type { ListKeyword } from "./ClosingList.ts";

const $I = $ScratchpadId.create("effected/github-references/KeywordFamily");

// The keyword-family projection: every keyword's tense-collapsed stem.
//
// The twelve keywords across both sets are four stems conjugated —
// `close`/`closes`/`closed` are one intent spelled three ways — and
// consumers that categorize harvested references can key a map by family
// rather than by all twelve spellings. This module is that projection: an
// explicit total record from keyword to family, so a keyword added to
// either constant without a family entry is a **type error**, not a silent
// miscategorization at runtime.

/**
 * The four keyword families: the twelve keywords collapsed to their stems.
 *
 * @public
 */
export const KeywordFamily = LiteralKit(["close", "fix", "resolve", "ref"]).annotate(
	$I.annote("KeywordFamily", { description: "The tense-collapsed stem of a closing or reference keyword." }),
);

export type KeywordFamily = typeof KeywordFamily.Type;

/**
 * The projection table IS the totality proof: `Record` over the union of
 * both keyword types makes a keyword added to either constant without an
 * entry here fail to compile.
 */
const FAMILIES: Record<ListKeyword, KeywordFamily> = {
	close: "close",
	closes: "close",
	closed: "close",
	fix: "fix",
	fixes: "fix",
	fixed: "fix",
	resolve: "resolve",
	resolves: "resolve",
	resolved: "resolve",
	ref: "ref",
	refs: "ref",
	references: "ref",
};

/**
 * The family a keyword belongs to.
 *
 * **Details**
 *
 * Total over both keyword sets by construction — an explicit record rather
 * than a `startsWith` heuristic, so a keyword added without a family entry is
 * a type error. `close`, `closes` and `closed` map to `"close"`; the `fix`
 * and `resolve` conjugations likewise; `ref`, `refs` and `references` map to
 * `"ref"`.
 *
 * **Example** (Map closing and reference keywords to their families)
 *
 * ```ts
 * import { keywordFamily } from "./index.ts";
 *
 * keywordFamily("closed");     // "close"
 * keywordFamily("references"); // "ref"
 * ```
 *
 * @public
 */
export const keywordFamily = (keyword: ListKeyword): KeywordFamily => FAMILIES[keyword];
