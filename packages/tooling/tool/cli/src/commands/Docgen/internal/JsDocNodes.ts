/**
 * JSDoc lookup shared by the docgen analysis and quality readers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { A } from "@beep/utils";
import { Node } from "ts-morph";
import type { JSDoc } from "ts-morph";

/**
 * Read the JSDoc blocks declared on a node.
 *
 * **Details**
 *
 * A JSDoc-able node answers with its own blocks; a variable declaration answers
 * with the blocks on the `const`/`let` statement that declares it, where the
 * comment is written. Any other node, including a variable declaration outside
 * a statement, has no declared blocks. Callers that also read `export default`
 * assignments compose their own fallback on top of this reader.
 *
 * **Example** (Read the blocks declared on a variable)
 *
 * ```ts
 * import { getDeclaredJsDocs } from "@beep/repo-cli/commands/Docgen/internal/JsDocNodes"
 * import { Project } from "ts-morph"
 *
 * const file = new Project({ useInMemoryFileSystem: true }).createSourceFile(
 *   "a.ts",
 *   "/** The answer. *\/\nexport const answer = 42"
 * )
 * const declaration = file.getVariableDeclarationOrThrow("answer")
 * console.log(getDeclaredJsDocs(declaration).length) // 1
 * ```
 *
 * @param node - The declaration whose JSDoc blocks are read.
 * @returns The declared JSDoc blocks, in source order, or none.
 * @category queries
 * @since 0.0.0
 */
export const getDeclaredJsDocs = (node: Node): ReadonlyArray<JSDoc> => {
  if (Node.isJSDocable(node)) {
    return node.getJsDocs();
  }

  if (Node.isVariableDeclaration(node)) {
    const statement = node.getVariableStatement();
    if (statement !== undefined) {
      return statement.getJsDocs();
    }
  }

  return A.empty();
};
