/**
 * Oxlint rule requiring TypeScript extensions in relative module specifiers.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { FileSystem, Str } from "@beep/utils";
import { defineRule } from "@oxlint/plugins";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import type { ESTree } from "@oxlint/plugins";

const RELATIVE_PREFIXES = ["./", "../"] as const;
const TYPESCRIPT_FILE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts"] as const;
const EXTENSION_REPLACEMENTS = [
  [".js", ".ts"],
  [".jsx", ".tsx"],
  [".mjs", ".mts"],
  [".cjs", ".cts"],
] as const;

const isTypeScriptFile = (filename: string): boolean =>
  A.some(TYPESCRIPT_FILE_EXTENSIONS, (extension) => Str.endsWith(extension)(filename));

const isRelativeSpecifier = (source: string): boolean =>
  A.some(RELATIVE_PREFIXES, (prefix) => Str.startsWith(prefix)(source));

const replacementFor = (source: string): O.Option<(typeof EXTENSION_REPLACEMENTS)[number]> =>
  A.findFirst(EXTENSION_REPLACEMENTS, ([extension]) => Str.endsWith(extension)(source));

const importedModuleUrl = (source: string, filename: string): URL => new URL(source, new URL(`file://${filename}`));

const pathExists = (url: URL): boolean => Effect.runSync(FileSystem.existsSync(url.pathname));

const sourceExtensionFor = (
  source: string,
  runtimeExtension: string,
  defaultSourceExtension: string,
  filename: string
): string => {
  if (!Str.equivalence(runtimeExtension, ".js")) return defaultSourceExtension;

  const importedModule = importedModuleUrl(source, filename);
  const sourceStem = Str.slice(0, -runtimeExtension.length)(importedModule.pathname);
  const typescriptModule = new URL(importedModule);
  typescriptModule.pathname = `${sourceStem}.ts`;
  if (pathExists(typescriptModule)) return ".ts";

  const typescriptReactModule = new URL(importedModule);
  typescriptReactModule.pathname = `${sourceStem}.tsx`;
  return pathExists(typescriptReactModule) ? ".tsx" : defaultSourceExtension;
};

const isStringLiteral = (node: ESTree.Expression): node is ESTree.StringLiteral =>
  node.type === "Literal" && P.isString(node.value);

/**
 * Require source-facing TypeScript extensions in relative imports and re-exports.
 *
 * @example
 * ```ts
 * import plugin from "@beep/lint-rules/oxlint"
 *
 * console.log(plugin.rules["no-js-extension-imports"]?.meta.fixable)
 * ```
 * @category tools
 * @since 0.1.0
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow runtime JavaScript extensions in relative TypeScript module specifiers and use TypeScript extensions instead.",
    },
    fixable: "code",
  },
  create(context) {
    if (!isTypeScriptFile(context.filename)) return {};

    const checkSource = (source: ESTree.StringLiteral): void => {
      if (!isRelativeSpecifier(source.value)) return;

      const replacement = replacementFor(source.value);
      if (O.isNone(replacement)) return;
      if (pathExists(importedModuleUrl(source.value, context.filename))) return;

      const [runtimeExtension, defaultSourceExtension] = replacement.value;
      const sourceExtension = sourceExtensionFor(
        source.value,
        runtimeExtension,
        defaultSourceExtension,
        context.filename
      );
      const extensionStart = source.range[1] - 1 - runtimeExtension.length;

      context.report({
        node: source,
        message: `Use "${sourceExtension}" instead of "${runtimeExtension}" for this relative module specifier.`,
        fix: (fixer) => fixer.replaceTextRange([extensionStart, source.range[1] - 1], sourceExtension),
      });
    };

    return {
      ImportDeclaration: (node) => checkSource(node.source),
      ExportAllDeclaration: (node) => checkSource(node.source),
      ExportNamedDeclaration: (node) => {
        if (node.source !== null) checkSource(node.source);
      },
      ImportExpression: (node) => {
        if (isStringLiteral(node.source)) checkSource(node.source);
      },
      TSImportType: (node) => checkSource(node.source),
    };
  },
});
