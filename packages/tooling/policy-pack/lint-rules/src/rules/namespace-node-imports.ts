/**
 * Oxlint rule requiring canonical namespace aliases for `node:` built-in
 * module imports.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { Str } from "@beep/utils";
import { defineRule } from "@oxlint/plugins";
import { HashMap } from "effect";
import * as O from "effect/Option";
import { identifierName, literalStringValue } from "./utils.ts";
import type { ESTree } from "@oxlint/plugins";

const NODE_MODULE_ALIASES = HashMap.fromIterable([
  ["assert/strict", "Assert"],
  ["fs/promises", "FSP"],
]);

const NODE_SEGMENT_ALIASES = HashMap.fromIterable([
  ["fs", "FS"],
  ["os", "OS"],
  ["url", "URL"],
  ["vm", "VM"],
]);

const segmentAlias = (segment: string): string =>
  O.getOrElse(HashMap.get(NODE_SEGMENT_ALIASES, segment), () => Str.pascalCase(segment));

const expectedNamespaceAlias = (source: string): string => {
  const moduleName = source.slice("node:".length);

  return O.match(HashMap.get(NODE_MODULE_ALIASES, moduleName), {
    onSome: (knownAlias) => `Node${knownAlias}`,
    onNone: () => `Node${moduleName.split("/").map(segmentAlias).join("")}`,
  });
};

// The `node:`-prefixed string source of an import, or `None` for any other module.
const nodeBuiltinSource = (node: ESTree.ImportDeclaration): O.Option<string> =>
  O.filter(literalStringValue(node.source), (value) => value.startsWith("node:"));

// The sole specifier when the import is exactly one `* as <name>` namespace specifier.
const soleNamespaceImport = (node: ESTree.ImportDeclaration): O.Option<ESTree.ImportNamespaceSpecifier> => {
  if (node.specifiers.length !== 1) return O.none();
  const [specifier] = node.specifiers;
  return specifier?.type === "ImportNamespaceSpecifier" ? O.some(specifier) : O.none();
};

/**
 * Oxlint rule that requires canonical namespace aliases for `node:` built-in
 * module imports, such as `NodeFSP` for `node:fs/promises`.
 *
 * **Example** (Namespace rule description)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import plugin from "@beep/lint-rules/oxlint"
 *
 * const description = plugin.rules["namespace-node-imports"]?.meta.docs.description
 *
 * strictEqual(description?.includes("Node.js built-in modules"), true)
 * ```
 *
 * @category tools
 * @since 0.1.0
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description: "Require canonical namespace imports for Node.js built-in modules.",
    },
  },
  create(context) {
    return {
      ImportDeclaration(node) {
        const source = nodeBuiltinSource(node);
        if (O.isNone(source)) return;

        const expectedAlias = expectedNamespaceAlias(source.value);
        const actualAlias = O.flatMap(soleNamespaceImport(node), (specifier) => identifierName(specifier.local));
        if (O.exists(actualAlias, (alias) => alias === expectedAlias)) return;

        context.report({
          node,
          message: `Import ${source.value} as a namespace named ${expectedAlias}.`,
        });
      },
    };
  },
});
