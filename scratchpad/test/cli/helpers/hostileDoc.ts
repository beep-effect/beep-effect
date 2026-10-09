import type { Block } from "../../../effected/cli/index.ts";
import { Doc, Status, Token } from "../../../effected/cli/index.ts";

export const ESC = "\u001B";
// User text that CONTAINS escape bytes in every place a string can enter a document.
export const SGR = `${ESC}[31mred${ESC}[0m`;
export const OSC = `${ESC}]8;;https://evil.test\u0007click${ESC}]8;;\u0007`;
export const LONE = `lone${ESC}escape`;
export const BELL = "bell\u0007\tafter";

/**
 * A document with every node kind and hostile text in every place a string can enter it.
 *
 * `codeAndPath: false` leaves out `Code` and `Path`, the two inlines that render differently under plain and ANSI, so
 * the two renderers can be compared exactly.
 */
export const composite = (options: { readonly codeAndPath: boolean }): ReadonlyArray<Block> => {
	const vocab = Status.core;
	const code = (text: string) => (options.codeAndPath ? Doc.code(text) : Doc.text(text));
	return [
		Doc.heading(1, [SGR, code(OSC)]),
		Doc.paragraph(
			Doc.status(vocab, "failure"),
			" ",
			Doc.text(SGR, "failure"),
			" ",
			Doc.text(LONE, Token.style({ bold: true, fg: "#ff0000" })),
			" ",
			options.codeAndPath ? Doc.path(SGR, LONE, BELL) : Doc.text(`${SGR} ${LONE}`),
			" ",
			Doc.link({ url: `https://x.test/${LONE}` }, [Doc.text(OSC, "info")]),
			" ",
			Doc.link({ file: `/repo/${SGR}.ts`, line: 3, col: 4 }, LONE),
		),
		Doc.list([Doc.paragraph(SGR)], { cap: 0, overflow: (hidden) => [`${hidden} ${OSC}`] }),
		Doc.table([{ header: SGR }, { header: LONE, align: "right" }], [[OSC, BELL]]),
		Doc.tree({ label: SGR, children: [{ label: [code(LONE)] }] }),
		Doc.collapsible(OSC, [Doc.paragraph(BELL)], { open: true }),
		Doc.callout("warning", [Doc.paragraph(SGR)]),
		Doc.codeBlock(`${SGR}\n${LONE}\n${OSC}`, "ts"),
		Doc.diff(`${SGR}\n${LONE}`, `${OSC}\n${BELL}`),
		Doc.section(SGR, [
			Doc.counts({
				label: SGR,
				counters: [
					Doc.counter(vocab, "failure", { key: "f", label: `fail ${SGR}`, n: 2 }),
					Doc.counter(vocab, "success", { key: "p", label: LONE, n: 3 }),
				],
				qualifier: OSC,
				durationMs: 1234,
				layout: "inline",
			}),
			Doc.counts({ counters: [Doc.counter(vocab, "failure", { key: "f", label: OSC, n: 1 })], layout: "columns" }),
			Doc.counts({ counters: [Doc.counter(vocab, "failure", { key: "f", label: BELL, n: 1 })], layout: "row" }),
		]),
	];
};
