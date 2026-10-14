/**
 * Shared JSDoc extraction helpers for ts-morph scanners.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Str, thunkEmptyStr } from "@beep/utils";
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import type { Node, SourceFile } from "ts-morph";

/**
 * Extract leading JSDoc text attached to a declaration node.
 *
 * **Example** (Read a variable's leading JSDoc)
 *
 * ```ts
 * import { createInMemoryTsMorphProject, leadingJsDocText } from "@beep/repo-cli/internal/tsmorph"
 *
 * const project = createInMemoryTsMorphProject()
 * const source = project.createSourceFile("fixture.ts", "/** A value. *\/\nexport const value = 1")
 * console.log(leadingJsDocText(source.getVariableDeclarationOrThrow("value")).includes("A value"))
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const leadingJsDocText = (node: Node): string =>
  pipe(
    node.getLeadingCommentRanges(),
    A.map((range) => range.getText()),
    A.filter(Str.startsWith("/**")),
    A.last,
    O.getOrElse(thunkEmptyStr)
  );

/**
 * Return the top-level file overview JSDoc block, when one exists.
 *
 * **Example** (Read the file overview block)
 *
 * ```ts
 * import { createInMemoryTsMorphProject, topFileoverview } from "@beep/repo-cli/internal/tsmorph"
 * import * as O from "effect/Option"
 *
 * const project = createInMemoryTsMorphProject()
 * const source = project.createSourceFile("fixture.ts", "/** File docs. *\/\nexport const value = 1")
 * console.log(O.getOrUndefined(topFileoverview(source))?.includes("File docs."))
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const topFileoverview = (sourceFile: SourceFile): O.Option<string> => {
  const text = sourceFile.getFullText();
  const match = /^(?:#![^\n]*\n)?\s*(\/\*\*[\s\S]*?\*\/)/.exec(text);
  return match === null ? O.none() : O.fromUndefinedOr(match[1]);
};
