// The reconciliation algorithm: fit a declared set of sections into a
// document that already has some of them, in some order, mixed with text and
// foreign sections that must survive byte-for-byte.
//
// The shape is a bounded linear pass over spans and placeholders — no
// recursion, nothing that can overflow a stack on hostile input.
//
// Ordering normalization is a CONTRACT, not a side effect: declared sections
// come back in declared order. That is what lets a consumer say "the preamble
// must precede the tool block" by listing them in that order and have it be
// true even in a file a user reordered by hand.

import { Equal, Result } from "effect";
import type { PlacedSection, Section } from "../Section.ts";
import type { Eol, SectionDialect } from "../SectionDialect.ts";
import { SectionRenderError } from "../SectionDialect.ts";
import { SyncOutcome } from "../SectionOutcome.ts";
import { identityOf } from "./scan.ts";

export interface ReconcileInput {
	readonly text: string;
	readonly placed: ReadonlyArray<PlacedSection>;
	/** Declared sections, already line-ending normalized. */
	readonly declared: ReadonlyArray<Section>;
	readonly dialect: SectionDialect;
	readonly eol: Eol;
}

export interface ReconcileOutput {
	readonly text: string;
	readonly outcomes: ReadonlyArray<SyncOutcome>;
	readonly changed: boolean;
}

/** A document broken into preserved text spans and section placeholders. */
type Item =
	| { readonly kind: "text"; readonly value: string }
	| { kind: "section"; readonly identity: string; readonly raw: string; render: string | undefined };

export const reconcile = (input: ReconcileInput): Result.Result<ReconcileOutput, SectionRenderError> => {
	const { text, placed, declared, dialect, eol } = input;

	// Render EVERY declared section before touching the document, so a refusal
	// never leaves a half-written file behind. Declaring one identity twice is
	// two intentions for one block; refuse rather than pick.
	const rendered = new Map<string, string>();
	for (const section of declared) {
		const identity = identityOf(section.key, section.commentStyle);
		if (rendered.has(identity)) {
			return Result.fail(SectionRenderError.make({ reason: "duplicateDeclaration", key: section.key }));
		}
		const result = dialect.render(section, eol);
		if (Result.isFailure(result)) {
			// Re-wrap rather than returning `result`: its success type is `string`,
			// not `ReconcileOutput`, and a Failure does not narrow it.
			return Result.fail(result.failure);
		}
		rendered.set(identity, result.success);
	}

	const onDisk = new Map<string, PlacedSection>();
	for (const entry of placed) {
		onDisk.set(identityOf(entry.section.key, entry.section.commentStyle), entry);
	}

	// One outcome per declared section, in declared order, decided by content.
	const outcomes = declared.map((section): SyncOutcome => {
		const current = onDisk.get(identityOf(section.key, section.commentStyle));
		if (current === undefined) {
			return SyncOutcome.Created({ section });
		}
		return Equal.equals(current.section, section)
			? SyncOutcome.Unchanged({ section })
			: SyncOutcome.Updated({ before: current.section, after: section });
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

	const targets = new Set(declared.map((section) => identityOf(section.key, section.commentStyle)));
	const slots: Array<number> = [];
	items.forEach((item, index) => {
		if (item.kind === "section" && targets.has(item.identity)) {
			slots.push(index);
		}
	});

	// Reassign the declared sections that already exist into the existing slots,
	// declared order over document order. This updates content in place AND
	// normalizes ordering around fixed text and foreign sections.
	const itemIndexByDeclared = new Map<number, number>();
	let slotCursor = 0;
	declared.forEach((section, declaredIndex) => {
		const identity = identityOf(section.key, section.commentStyle);
		if (!onDisk.has(identity) || slotCursor >= slots.length) {
			return;
		}
		const itemIndex = slots[slotCursor] ?? 0;
		const item = items[itemIndex];
		if (item?.kind === "section") {
			item.render = rendered.get(identity);
		}
		itemIndexByDeclared.set(declaredIndex, itemIndex);
		slotCursor += 1;
	});

	// Place the sections that are not in the document yet: before the nearest
	// present successor sibling, else after the nearest present predecessor,
	// else append at the end.
	const beforeAnchor = new Map<number, Array<string>>();
	const afterAnchor = new Map<number, Array<string>>();
	const appended: Array<string> = [];
	const pushInto = (map: Map<number, Array<string>>, anchor: number, value: string) => {
		const list = map.get(anchor) ?? [];
		list.push(value);
		map.set(anchor, list);
	};

	declared.forEach((section, declaredIndex) => {
		const identity = identityOf(section.key, section.commentStyle);
		if (onDisk.has(identity)) {
			return;
		}
		const block = rendered.get(identity) ?? "";
		for (let next = declaredIndex + 1; next < declared.length; next += 1) {
			const anchor = itemIndexByDeclared.get(next);
			if (anchor !== undefined) {
				pushInto(beforeAnchor, anchor, block);
				return;
			}
		}
		for (let previous = declaredIndex - 1; previous >= 0; previous -= 1) {
			const anchor = itemIndexByDeclared.get(previous);
			if (anchor !== undefined) {
				pushInto(afterAnchor, anchor, block);
				return;
			}
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
		for (const block of beforeAnchor.get(index) ?? []) {
			parts.push(block, eol, eol);
		}
		parts.push(item.render ?? item.raw);
		for (const block of afterAnchor.get(index) ?? []) {
			parts.push(eol, eol, block);
		}
	});

	let output = parts.join("");
	for (const block of appended) {
		output = output.trim() === "" ? `${block}${eol}` : `${output.replace(/(?:\r?\n)+$/, "")}${eol}${eol}${block}${eol}`;
	}

	return Result.succeed({ text: output, outcomes, changed: output !== text });
};
