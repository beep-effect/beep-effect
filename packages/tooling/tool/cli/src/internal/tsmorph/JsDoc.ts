/**
 * Shared JSDoc extraction helpers for ts-morph scanners.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A, pipe, Str } from "@beep/utils";
import * as O from "effect/Option";
import { Node } from "ts-morph";
import type { SourceFile } from "ts-morph";

/**
 * Extract leading JSDoc text attached to a declaration node.
 *
 * @example
 * ```ts
 * import { createInMemoryTsMorphProject, leadingJsDocText } from "@beep/repo-cli/internal/tsmorph"
 *
 * const project = createInMemoryTsMorphProject()
 * const source = project.createSourceFile("fixture.ts", "/** A value. *\/\nexport const value = 1")
 * console.log(leadingJsDocText(source.getVariableDeclarationOrThrow("value")).includes("A value"))
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const leadingJsDocText = (node: Node): string =>
  node
    .getLeadingCommentRanges()
    .map((range) => range.getText())
    .filter((text: string) => Str.startsWith("/**")(text))
    .at(-1) ?? "";

/**
 * Concatenate the structured JSDoc blocks attached to a JSDocable node.
 *
 * @example
 * ```ts
 * import { createInMemoryTsMorphProject, jsDocTextForNode } from "@beep/repo-cli/internal/tsmorph"
 *
 * const project = createInMemoryTsMorphProject()
 * const source = project.createSourceFile("fixture.ts", "/** @category utilities *\/\nexport function f() {}")
 * console.log(jsDocTextForNode(source.getFunctionOrThrow("f")).includes("@category utilities"))
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const jsDocTextForNode = (node: Node): string => {
  if (!Node.isJSDocable(node)) {
    return "";
  }

  return pipe(
    node.getJsDocs(),
    A.map((jsDoc) => jsDoc.getText()),
    A.join("\n")
  );
};

/**
 * Test whether a node's JSDoc declares a specific category.
 *
 * @example
 * ```ts
 * import { createInMemoryTsMorphProject, hasJsDocCategory } from "@beep/repo-cli/internal/tsmorph"
 *
 * const project = createInMemoryTsMorphProject()
 * const source = project.createSourceFile("fixture.ts", "/** @category constructors *\/\nexport function make() {}")
 * console.log(hasJsDocCategory({ node: source.getFunctionOrThrow("make"), category: "constructors" }))
 * ```
 * @category predicates
 * @since 0.0.0
 */
export const hasJsDocCategory = (input: { readonly node: Node; readonly category: string }): boolean =>
  Str.includes(`@category ${input.category}`)(jsDocTextForNode(input.node));

/**
 * Return the top-level file overview JSDoc block, when one exists.
 *
 * @example
 * ```ts
 * import { createInMemoryTsMorphProject, topFileoverview } from "@beep/repo-cli/internal/tsmorph"
 * import * as O from "effect/Option"
 *
 * const project = createInMemoryTsMorphProject()
 * const source = project.createSourceFile("fixture.ts", "/** File docs. *\/\nexport const value = 1")
 * console.log(O.getOrUndefined(topFileoverview(source))?.includes("File docs."))
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const topFileoverview = (sourceFile: SourceFile): O.Option<string> => {
  const text = sourceFile.getFullText();
  const match = /^(?:#![^\n]*\n)?\s*(\/\*\*[\s\S]*?\*\/)/.exec(text);
  return match === null ? O.none() : O.some(match[1]);
};
