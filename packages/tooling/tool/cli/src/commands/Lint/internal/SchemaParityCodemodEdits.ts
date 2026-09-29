/**
 * Pure text-edit rendering shared by the schema-parity codemod rules and engine.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, Str } from "@beep/utils";
import { Order } from "effect";
import { dual } from "effect/Function";
import { SchemaParityCodemodEdit } from "./SchemaParityCodemod.schemas.ts";
import type * as O from "effect/Option";
import type { Node } from "ts-morph";

const byStartThenEnd: Order.Order<SchemaParityCodemodEdit> = Order.combine(
  Order.mapInput(Order.Number, (edit: SchemaParityCodemodEdit) => edit.start),
  Order.mapInput(Order.Number, (edit: SchemaParityCodemodEdit) => edit.end)
);

/**
 * Sort edits by start then end, keeping plan order for equal ranges.
 *
 * **Details**
 *
 * The sort is stable, so two insertions at one offset render in the order the
 * rule planned them (for example `HashSet.fromIterable(` before a receiver
 * replacement that starts at the same offset).
 *
 * **Example** (Sort two edits)
 *
 * ```ts
 * import { SchemaParityCodemodEdit, sortSchemaParityCodemodEdits } from "@beep/repo-cli/test/Lint"
 *
 * const sorted = sortSchemaParityCodemodEdits([
 *   SchemaParityCodemodEdit.make({ start: 9, end: 9, text: ")" }),
 *   SchemaParityCodemodEdit.make({ start: 0, end: 0, text: "f(" }),
 * ])
 * console.log(sorted[0]?.text) // "f("
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sortSchemaParityCodemodEdits = (
  edits: ReadonlyArray<SchemaParityCodemodEdit>
): ReadonlyArray<SchemaParityCodemodEdit> => A.sort(edits, byStartThenEnd);

/**
 * Find the first pair of planned edits whose ranges overlap.
 *
 * **Details**
 *
 * Insertions may share an offset with each other or with the start or end of
 * a replacement; any other intersection is an overlap, because the rendered
 * text would depend on which edit wins.
 *
 * **Example** (Detect overlapping replacements)
 *
 * ```ts
 * import { findSchemaParityCodemodEditOverlap, SchemaParityCodemodEdit } from "@beep/repo-cli/test/Lint"
 * import * as O from "effect/Option"
 *
 * const overlap = findSchemaParityCodemodEditOverlap([
 *   SchemaParityCodemodEdit.make({ start: 0, end: 5, text: "a" }),
 *   SchemaParityCodemodEdit.make({ start: 3, end: 8, text: "b" }),
 * ])
 * console.log(O.isSome(overlap)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const findSchemaParityCodemodEditOverlap = (
  edits: ReadonlyArray<SchemaParityCodemodEdit>
): O.Option<readonly [SchemaParityCodemodEdit, SchemaParityCodemodEdit]> => {
  const sorted = sortSchemaParityCodemodEdits(edits);
  return A.findFirst(A.zip(sorted, A.drop(sorted, 1)), ([previous, next]) => next.start < previous.end);
};

/**
 * Render edits over the `[rangeStart, rangeEnd)` slice of a source text.
 *
 * **Details**
 *
 * Edits outside the range are ignored. Callers must reject overlapping edits
 * first; rendering applies them left to right with a cursor.
 *
 * **Example** (Render a rename inside a slice)
 *
 * ```ts
 * import { renderSchemaParityCodemodEdits, SchemaParityCodemodEdit } from "@beep/repo-cli/test/Lint"
 *
 * const text = "Status.Options"
 * const rendered = renderSchemaParityCodemodEdits(text, 0, text.length, [
 *   SchemaParityCodemodEdit.make({ start: 7, end: 14, text: "literals" }),
 * ])
 * console.log(rendered) // "Status.literals"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderSchemaParityCodemodEdits: {
  (rangeStart: number, rangeEnd: number, edits: ReadonlyArray<SchemaParityCodemodEdit>): (text: string) => string;
  (text: string, rangeStart: number, rangeEnd: number, edits: ReadonlyArray<SchemaParityCodemodEdit>): string;
} = dual(
  4,
  (text: string, rangeStart: number, rangeEnd: number, edits: ReadonlyArray<SchemaParityCodemodEdit>): string => {
    const inRange = A.filter(edits, (edit) => edit.start >= rangeStart && edit.end <= rangeEnd);
    const rendered = A.reduce(
      sortSchemaParityCodemodEdits(inRange),
      { cursor: rangeStart, parts: A.empty<string>() },
      (state, edit) => ({
        cursor: edit.end,
        parts: A.appendAll(state.parts, [Str.slice(state.cursor, edit.start)(text), edit.text]),
      })
    );
    return A.join(A.append(rendered.parts, Str.slice(rendered.cursor, rangeEnd)(text)), "");
  }
);

/**
 * Edit replacing a node's text, leading trivia excluded.
 *
 * **Example** (Replace a node)
 *
 * ```ts
 * import { schemaParityCodemodReplaceNode } from "@beep/repo-cli/test/Lint"
 * import { Project } from "ts-morph"
 *
 * const sourceFile = new Project({ useInMemoryFileSystem: true }).createSourceFile("/a.ts", "export const a = b;\n")
 * const node = sourceFile.getVariableDeclarationOrThrow("a").getInitializerOrThrow()
 * console.log(schemaParityCodemodReplaceNode(node, "c").start) // 17
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const schemaParityCodemodReplaceNode: {
  (text: string): (node: Node) => SchemaParityCodemodEdit;
  (node: Node, text: string): SchemaParityCodemodEdit;
} = dual(
  2,
  (node: Node, text: string): SchemaParityCodemodEdit =>
    SchemaParityCodemodEdit.make({ start: node.getStart(), end: node.getEnd(), text })
);

/**
 * Edit inserting text at an offset without replacing anything.
 *
 * **Example** (Insert a call prefix)
 *
 * ```ts
 * import { schemaParityCodemodInsertAt } from "@beep/repo-cli/test/Lint"
 *
 * const edit = schemaParityCodemodInsertAt(4, "f(")
 * console.log(edit.start === edit.end) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const schemaParityCodemodInsertAt: {
  (text: string): (offset: number) => SchemaParityCodemodEdit;
  (offset: number, text: string): SchemaParityCodemodEdit;
} = dual(
  2,
  (offset: number, text: string): SchemaParityCodemodEdit =>
    SchemaParityCodemodEdit.make({ start: offset, end: offset, text })
);
