// The reconciliation algorithm: fit a declared set of sections into a
// document that already has some of them, in some order, mixed with text and
// foreign sections that must survive byte-for-byte.
//
// Missing-section anchor preprocessing uses two linear passes. Other work,
// including rendering and constructing output strings, is accounted for separately.
//
// Ordering normalization is a CONTRACT, not a side effect: declared sections
// come back in declared order. That is what lets a consumer say "the preamble
// must precede the tool block" by listing them in that order and have it be
// true even in a file a user reordered by hand.

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as Equal from "effect/Equal";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import { PlacedSection, Section } from "../Section.ts";
import { Eol, SectionDialect, SectionRenderError } from "../SectionDialect.ts";
import { SyncOutcome } from "../SectionOutcome.ts";
import { identityOf } from "./scan.ts";

const $I = $ScratchpadId.create("effected/templates/internal/reconcile");

/** Plain input to the pure reconciliation core; every field remains required. */
export const ReconcileInput = S.Struct({
	text: S.String.annotateKey({ description: "The exact source document." }),
	placed: S.Array(S.suspend(() => PlacedSection)).annotateKey({ description: "Sections with their source spans." }),
	declared: S.Array(S.suspend(() => Section)).annotateKey({ description: "Declared sections, already line-ending normalized." }),
	dialect: S.suspend(() => SectionDialect).annotateKey({ description: "The marker vocabulary to render with." }),
	eol: Eol.annotateKey({ description: "The document line ending." }),
}).annotate($I.annote("ReconcileInput", { description: "The complete input to managed-section reconciliation." }));
export type ReconcileInput = typeof ReconcileInput.Type;

/** Shared plain output authority for public and internal reconciliation results. */
export const ReconcileOutput = S.Struct({
	text: S.String.annotateKey({ description: "The document as it should now read." }),
	outcomes: S.Array(S.suspend(() => SyncOutcome)).annotateKey({ description: "One outcome per declared section, in declaration order." }),
	changed: S.Boolean.annotateKey({ description: "Whether output text differs from the source." }),
}).annotate($I.annote("ReconcileOutput", { description: "The resulting text, per-section outcomes and byte-change indicator." }));
export type ReconcileOutput = typeof ReconcileOutput.Type;

/** A document broken into preserved text spans and section placeholders. */
type Item =
	| { readonly kind: "text"; readonly value: string }
	| { kind: "section"; readonly identity: string; readonly raw: string; render: string | undefined };

export const reconcile = (input: ReconcileInput): Result.Result<ReconcileOutput, SectionRenderError> => {
	const { text, placed, declared, dialect, eol } = input;

	// Render EVERY declared section before touching the document, so a refusal
	// never leaves a half-written file behind. Declaring one identity twice is
	// two intentions for one block; refuse rather than pick.
	const rendered = MutableHashMap.empty<string, string>();
	for (const section of declared) {
		const identity = identityOf(section.key, section.commentStyle);
		if (MutableHashMap.has(rendered, identity)) {
			return Result.fail(SectionRenderError.make({ reason: "duplicateDeclaration", key: section.key }));
		}
		const result = dialect.render(section, eol);
		if (Result.isFailure(result)) {
			// Re-wrap rather than returning `result`: its success type is `string`,
			// not `ReconcileOutput`, and a Failure does not narrow it.
			return Result.fail(result.failure);
		}
		MutableHashMap.set(rendered, identity, result.success);
	}

	const onDisk = MutableHashMap.empty<string, PlacedSection>();
	for (const entry of placed) {
		MutableHashMap.set(onDisk, identityOf(entry.section.key, entry.section.commentStyle), entry);
	}

	// One outcome per declared section, in declared order, decided by content.
	const outcomes = declared.map((section): SyncOutcome => {
		const current = MutableHashMap.get(onDisk, identityOf(section.key, section.commentStyle));
		if (O.isNone(current)) {
			return SyncOutcome.Created({ section });
		}
		return Equal.equals(current.value.section, section)
			? SyncOutcome.Unchanged({ section })
			: SyncOutcome.Updated({ before: current.value.section, after: section });
	});

	// Break the document into preserved spans and placeholders.
	const items: Array<Item> = [];
	let cursor = 0;
	for (const entry of placed) {
		items.push({ kind: "text", value: text.slice(cursor, entry.start) });
		items.push({
			kind: "section",
			identity: identityOf(entry.section.key, entry.section.commentStyle),
			raw: text.slice(entry.start, entry.end),
			render: undefined,
		});
		cursor = entry.end;
	}
	items.push({ kind: "text", value: text.slice(cursor) });

	const targets = MutableHashSet.fromIterable(declared.map((section) => identityOf(section.key, section.commentStyle)));
	const slots: Array<number> = [];
	items.forEach((item, index) => {
		if (item.kind === "section" && MutableHashSet.has(targets, item.identity)) {
			slots.push(index);
		}
	});

	// Reassign the declared sections that already exist into the existing slots,
	// declared order over document order. This updates content in place AND
	// normalizes ordering around fixed text and foreign sections.
	const itemIndexByDeclared = MutableHashMap.empty<number, number>();
	let slotCursor = 0;
	declared.forEach((section, declaredIndex) => {
		const identity = identityOf(section.key, section.commentStyle);
		if (!MutableHashMap.has(onDisk, identity) || slotCursor >= slots.length) {
			return;
		}
		const itemIndex = slots[slotCursor] ?? 0;
		const item = items[itemIndex];
		if (item?.kind === "section") {
			item.render = O.getOrUndefined(MutableHashMap.get(rendered, identity));
		}
		MutableHashMap.set(itemIndexByDeclared, declaredIndex, itemIndex);
		slotCursor += 1;
	});

	// Cache strictly preceding and succeeding existing anchors. Each declaration
	// needs one map lookup per pass, including declarations without any anchor.
	const predecessor: Array<number | undefined> = [];
	const successor: Array<number | undefined> = [];
	let previousAnchor: number | undefined;
	for (let index = 0; index < declared.length; index += 1) {
		predecessor[index] = previousAnchor;
		previousAnchor = O.getOrUndefined(MutableHashMap.get(itemIndexByDeclared, index)) ?? previousAnchor;
	}
	let nextAnchor: number | undefined;
	for (let index = declared.length - 1; index >= 0; index -= 1) {
		successor[index] = nextAnchor;
		nextAnchor = O.getOrUndefined(MutableHashMap.get(itemIndexByDeclared, index)) ?? nextAnchor;
	}

	// Place the sections that are not in the document yet: before the nearest
	// present successor sibling, else after the nearest present predecessor,
	// else append at the end.
	const beforeAnchor = MutableHashMap.empty<number, Array<string>>();
	const afterAnchor = MutableHashMap.empty<number, Array<string>>();
	const appended: Array<string> = [];
	const pushInto = (map: MutableHashMap.MutableHashMap<number, Array<string>>, anchor: number, value: string) => {
		const list = O.getOrElse(MutableHashMap.get(map, anchor), (): Array<string> => []);
		list.push(value);
		MutableHashMap.set(map, anchor, list);
	};

	declared.forEach((section, declaredIndex) => {
		const identity = identityOf(section.key, section.commentStyle);
		if (MutableHashMap.has(onDisk, identity)) {
			return;
		}
		const block = O.getOrElse(MutableHashMap.get(rendered, identity), () => "");
		const next = successor[declaredIndex];
		if (next !== undefined) {
			pushInto(beforeAnchor, next, block);
			return;
		}
		const previous = predecessor[declaredIndex];
		if (previous !== undefined) {
			pushInto(afterAnchor, previous, block);
			return;
		}
		appended.push(block);
	});

	// Render: preserved text verbatim, foreign sections from their exact source
	// bytes, declared sections canonically.
	const parts: Array<string> = [];
	items.forEach((item, index) => {
		if (item.kind === "text") {
			parts.push(item.value);
			return;
		}
		for (const block of O.getOrElse(MutableHashMap.get(beforeAnchor, index), () => [])) {
			parts.push(block, eol, eol);
		}
		parts.push(item.render ?? item.raw);
		for (const block of O.getOrElse(MutableHashMap.get(afterAnchor, index), () => [])) {
			parts.push(eol, eol, block);
		}
	});

	let output = parts.join("");
	for (const block of appended) {
		output = output.trim() === "" ? `${block}${eol}` : `${output.replace(/(?:\r?\n)+$/, "")}${eol}${eol}${block}${eol}`;
	}

	return Result.succeed({ text: output, outcomes, changed: output !== text });
};
