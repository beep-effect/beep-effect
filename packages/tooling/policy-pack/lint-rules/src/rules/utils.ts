/**
 * Shared AST-node helpers (unwrapping, name resolution, import-binding
 * classification, path matching) reused by every `@beep/lint-rules` rule.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { HashMap, HashSet } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { ESTree } from "@oxlint/plugins";

/**
 * Node families the rule visitors hand to these helpers: expressions, call
 * arguments, identifier slots, binding targets, and import-export names. All
 * carry a `type` discriminant, so they narrow without `unknown` or `as`.
 *
 * **Example** (Discriminant type narrowing)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import type { AstNode } from "../../src/rules/utils"
 *
 * type CarriesDiscriminant = AstNode extends { readonly type: string } ? true : false
 * const carriesDiscriminant: CarriesDiscriminant = true
 *
 * strictEqual(carriesDiscriminant, true)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export type AstNode =
  | ESTree.Expression
  | ESTree.Argument
  | ESTree.IdentifierName
  | ESTree.PrivateIdentifier
  | ESTree.BindingIdentifier
  | ESTree.ModuleExportName;

/**
 * A slot that may also be empty (the typed AST exposes nullable child positions).
 *
 * **Example** (Nullable empty slot)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import type { MaybeNode } from "../../src/rules/utils"
 *
 * const emptySlot: MaybeNode = null
 *
 * strictEqual(emptySlot, null)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export type MaybeNode = AstNode | null | undefined;

/** Expression wrappers the parser interposes; `unwrapExpression` peels them. */
type ExpressionWrapper =
  | ESTree.ChainExpression
  | ESTree.ParenthesizedExpression
  | ESTree.TSNonNullExpression
  | ESTree.TSAsExpression
  | ESTree.TSTypeAssertion;

const asAstNode = (node: MaybeNode): O.Option<AstNode> => (P.isNotNullish(node) ? O.some(node) : O.none());

const EXPRESSION_WRAPPER_TYPES = HashSet.fromIterable([
  "ChainExpression",
  "ParenthesizedExpression",
  "TSNonNullExpression",
  "TSAsExpression",
  "TSTypeAssertion",
]);

const isExpressionWrapper = (node: AstNode): node is ExpressionWrapper =>
  HashSet.has(EXPRESSION_WRAPPER_TYPES, node.type);

/**
 * Peel expression wrappers (chains, parens, TS assertions) to the inner node.
 *
 * **Example** (Unwrap null to None)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import * as O from "effect/Option"
 * import { unwrapExpression } from "../../src/rules/utils"
 *
 * strictEqual(O.isNone(unwrapExpression(null)), true)
 * ```
 *
 * @param node - The node (or empty slot) to unwrap.
 * @returns The innermost non-wrapper node, or `None` for an empty slot.
 * @category utilities
 * @since 0.1.0
 */
export const unwrapExpression = (node: MaybeNode): O.Option<AstNode> => {
  let current = asAstNode(node);

  while (O.isSome(current) && isExpressionWrapper(current.value)) {
    current = asAstNode(current.value.expression);
  }

  return current;
};

/**
 * A peeled member access: the unwrapped receiver (`object`) and the raw property
 * slot, ready to feed to `getPropertyName` / `isIdentifier`.
 *
 * **Example** (Empty member access shape)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import * as O from "effect/Option"
 * import type { MemberAccess } from "../../src/rules/utils"
 *
 * const access: MemberAccess = { object: O.none(), property: null }
 *
 * strictEqual(O.isNone(access.object), true)
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export type MemberAccess = {
  readonly object: O.Option<AstNode>;
  readonly property: MaybeNode;
};

/**
 * Peel wrappers off `node`, confirm it is a `MemberExpression`, and expose its
 * unwrapped `object` plus raw `property`. Shared prologue for every rule that
 * inspects `<receiver>.<member>` access.
 *
 * **Example** (Null yields None)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import * as O from "effect/Option"
 * import { unwrapMemberExpression } from "../../src/rules/utils"
 *
 * strictEqual(O.isNone(unwrapMemberExpression(null)), true)
 * ```
 *
 * @param node - The candidate member-access node (or empty slot).
 * @returns The unwrapped receiver and raw property, or `None` when not a member access.
 * @category utilities
 * @since 0.1.0
 */
export const unwrapMemberExpression = (node: MaybeNode): O.Option<MemberAccess> =>
  O.flatMap(unwrapExpression(node), (expression) =>
    expression.type === "MemberExpression"
      ? O.some({ object: unwrapExpression(expression.object), property: expression.property })
      : O.none()
  );

/** Identifier-shaped nodes whose textual name lives on the `.name` field. */
const NAME_BEARING_TYPES = HashSet.fromIterable(["Identifier", "PrivateIdentifier"]);

// Lift the carried slot of an identifier (`.name`) or literal (`.value`), when it is a string.
const carriedSlot = (expression: AstNode): unknown =>
  HashSet.has(NAME_BEARING_TYPES, expression.type) && "name" in expression
    ? expression.name
    : expression.type === "Literal"
      ? expression.value
      : undefined;

/**
 * Resolve the textual name of an identifier / private identifier / string literal node.
 *
 * **Example** (Null yields None)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import * as O from "effect/Option"
 * import { getPropertyName } from "../../src/rules/utils"
 *
 * strictEqual(O.isNone(getPropertyName(null)), true)
 * ```
 *
 * @param node - The node (or empty slot) to read a name from.
 * @returns The string name/value, or `None` when absent or non-string.
 * @category utilities
 * @since 0.1.0
 */
export const getPropertyName = (node: MaybeNode): O.Option<string> =>
  asAstNode(node).pipe(O.map(carriedSlot), O.filter(P.isString));

/**
 * Test whether an already-unwrapped node is an identifier (optionally with a given name).
 *
 * **Example** (None is not identifier)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import * as O from "effect/Option"
 * import { isIdentifier } from "../../src/rules/utils"
 *
 * strictEqual(isIdentifier(O.none(), "Effect"), false)
 * ```
 *
 * @param node - The already-unwrapped candidate node.
 * @param name - When provided, also require the identifier to carry this exact name.
 * @returns `true` when `node` is a matching identifier.
 * @category utilities
 * @since 0.1.0
 */
export const isIdentifier: {
  (name?: string): (node: O.Option<AstNode>) => boolean;
  (node: O.Option<AstNode>, name?: string): boolean;
} = dual(
  (args) => O.isOption(args[0]),
  (node: O.Option<AstNode>, name?: string): boolean =>
    O.exists(
      node,
      (expression) =>
        expression.type === "Identifier" &&
        P.isString(expression.name) &&
        (name === undefined || expression.name === name)
    )
);

/**
 * Resolve the string value of a string-literal node.
 *
 * **Example** (Undefined yields None)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import * as O from "effect/Option"
 * import { literalStringValue } from "../../src/rules/utils"
 *
 * strictEqual(O.isNone(literalStringValue(undefined)), true)
 * ```
 *
 * @param node - The node (or empty slot) to read a literal value from.
 * @returns The string literal value, or `None` when not a string literal.
 * @category utilities
 * @since 0.1.0
 */
export const literalStringValue = (node: MaybeNode): O.Option<string> =>
  O.flatMap(asAstNode(node), (expression) =>
    expression.type === "Literal" && P.isString(expression.value) ? O.some(expression.value) : O.none()
  );

/**
 * Resolve the local name of an identifier node.
 *
 * **Example** (Null yields None)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import * as O from "effect/Option"
 * import { identifierName } from "../../src/rules/utils"
 *
 * strictEqual(O.isNone(identifierName(null)), true)
 * ```
 *
 * @param node - The node (or empty slot) to read an identifier name from.
 * @returns The identifier name, or `None` when not an identifier.
 * @category utilities
 * @since 0.1.0
 */
export const identifierName = (node: MaybeNode): O.Option<string> =>
  O.flatMap(asAstNode(node), (expression) =>
    expression.type === "Identifier" && P.isString(expression.name) ? O.some(expression.name) : O.none()
  );

class NamedImportBinding extends S.Class<NamedImportBinding>("NamedImportBinding")({
  kind: S.tag("named"),
  imported: S.String,
  local: S.String,
}) {}

class NamespaceImportBinding extends S.Class<NamespaceImportBinding>("NamespaceImportBinding")({
  kind: S.tag("namespace"),
  local: S.String,
}) {}

class DefaultImportBinding extends S.Class<DefaultImportBinding>("DefaultImportBinding")({
  kind: S.tag("default"),
  local: S.String,
}) {}

/**
 * Schema-backed import binding classified by how a value import binds a local name.
 * `named` carries the original exported name; `namespace`/`default` bind the module itself.
 *
 * **Example** (Decode named binding)
 *
 * ```ts
 * import { deepStrictEqual } from "node:assert/strict"
 * import { ImportBinding } from "@beep/lint-rules/oxlint"
 * import * as S from "effect/Schema"
 *
 * const binding = S.decodeUnknownSync(ImportBinding)({
 *   kind: "named",
 *   imported: "Effect",
 *   local: "Effect"
 * })
 *
 * deepStrictEqual(binding, { kind: "named", imported: "Effect", local: "Effect" })
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ImportBinding = S.Union([NamedImportBinding, NamespaceImportBinding, DefaultImportBinding]).pipe(
  S.annotate({
    identifier: "@beep/lint-rules/rules/utils/ImportBinding",
    title: "ImportBinding",
    description: "Value (non-type) import specifier classified by how it binds a local name.",
  }),
  S.toTaggedUnion("kind")
);

/**
 * A value (non-type) import specifier classified by how it binds a local name.
 *
 * **Example** (Named binding shape)
 *
 * ```ts
 * import { deepStrictEqual } from "node:assert/strict"
 * import type { ImportBinding } from "@beep/lint-rules/oxlint"
 *
 * const binding: ImportBinding = { kind: "named", imported: "Effect", local: "Effect" }
 *
 * deepStrictEqual(binding, { kind: "named", imported: "Effect", local: "Effect" })
 * ```
 *
 * @category models
 * @since 0.1.0
 */
export type ImportBinding = typeof ImportBinding.Type;

const makeModuleBinding = (kind: "namespace" | "default", local: string): ImportBinding =>
  kind === "namespace" ? NamespaceImportBinding.make({ local }) : DefaultImportBinding.make({ local });

/**
 * Classify a single import specifier into an {@link ImportBinding}, dropping type-only
 * named specifiers (`import { type X }`). Shared by every binding-tracking rule so each
 * rule's per-specifier handler stays small.
 *
 * @param specifier - The import specifier to classify.
 * @returns The binding, or `None` for a type-only named specifier.
 * @category utilities
 * @since 0.1.0
 */
const MODULE_BINDING_KINDS = HashMap.fromIterable<string, "namespace" | "default">([
  ["ImportNamespaceSpecifier", "namespace"],
  ["ImportDefaultSpecifier", "default"],
]);

/**
 * Classify an import specifier into a normalized {@link ImportBinding} (named / namespace /
 * default), dropping type-only named imports. The single source of import-specifier
 * classification shared by the binding-based rules.
 *
 * **Example** (Function name identity)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import { classifyImportSpecifier } from "../../src/rules/utils"
 *
 * strictEqual(classifyImportSpecifier.name, "classifyImportSpecifier")
 * ```
 *
 * @param specifier - The import specifier AST node to classify.
 * @returns The binding (kind + local name, plus `imported` for named), or `None` for type-only.
 * @category utilities
 * @since 0.1.0
 */
export const classifyImportSpecifier = (
  specifier: ESTree.ImportDeclaration["specifiers"][number]
): O.Option<ImportBinding> =>
  O.match(HashMap.get(MODULE_BINDING_KINDS, specifier.type), {
    onSome: (kind) => O.some(makeModuleBinding(kind, specifier.local.name)),
    onNone: () =>
      specifier.type === "ImportSpecifier" && specifier.importKind !== "type"
        ? O.map(getPropertyName(specifier.imported), (imported) =>
            NamedImportBinding.make({
              imported,
              local: specifier.local.name,
            })
          )
        : O.none(),
  });

// Normalize OS path separators to forward slashes so comparisons are platform-stable.
const normalizePath = (path: string): string => path.replaceAll("\\", "/");

/**
 * Convert an absolute `filename` to a repo-relative path by stripping the `${cwd}/` prefix.
 * Falls back to the normalized absolute path when `filename` is not under `cwd`.
 *
 * **Example** (Strip cwd prefix)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import { toRepoPath } from "../../src/rules/utils"
 *
 * const relative = toRepoPath("/repo/packages/example/src/index.ts", "/repo")
 *
 * strictEqual(relative, "packages/example/src/index.ts")
 * ```
 *
 * @param filename - The absolute (or already-relative) file path from the lint context.
 * @param cwd - The lint working directory (repo root).
 * @returns The repo-relative path, forward-slash normalized.
 * @category utilities
 * @since 0.1.0
 */
export const toRepoPath: {
  (cwd: string): (filename: string) => string;
  (filename: string, cwd: string): string;
} = dual(2, (filename: string, cwd: string): string => {
  const normalizedFilename = normalizePath(filename);
  const normalizedCwd = normalizePath(cwd).replace(/\/+$/u, "");
  const prefix = `${normalizedCwd}/`;
  return normalizedFilename.startsWith(prefix) ? normalizedFilename.slice(prefix.length) : normalizedFilename;
});

/**
 * Test whether a repo-relative `path` equals `suffix` or ends at a path boundary (`/suffix`).
 * Avoids the false positives of a bare `endsWith` (e.g. `.../notAIMetrics.test.ts`).
 *
 * **Example** (Boundary-aware suffix match)
 *
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import { pathMatchesSuffix } from "../../src/rules/utils"
 *
 * strictEqual(pathMatchesSuffix("packages/demo/src/File.ts", "src/File.ts"), true)
 * strictEqual(pathMatchesSuffix("packages/demo/src/NotFile.ts", "src/File.ts"), false)
 * ```
 *
 * @param path - The repo-relative path to test.
 * @param suffix - The repo-relative suffix to match on a path boundary.
 * @returns `true` when `path` is exactly `suffix` or ends with `/suffix`.
 * @category utilities
 * @since 0.1.0
 */
export const pathMatchesSuffix: {
  (suffix: string): (path: string) => boolean;
  (path: string, suffix: string): boolean;
} = dual(2, (path: string, suffix: string): boolean => path === suffix || path.endsWith(`/${suffix}`));
