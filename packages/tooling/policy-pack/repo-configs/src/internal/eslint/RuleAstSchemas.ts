import { $RepoConfigsId } from "@beep/identity";
import { LiteralKit } from "@beep/schema";
import { A } from "@beep/utils";
import { Effect, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $RepoConfigsId.create("internal/eslint/RuleAstSchemas");

/**
 * Import-kind literals reflected by ESTree import nodes.
 *
 * @example
 * ```ts
 * import { ImportKind } from "@beep/repo-configs/internal/eslint/RuleAstSchemas"
 * const kind = "type" satisfies ImportKind
 * console.log(kind)
 * ```
 * @category models
 * @since 0.0.0
 */
export const ImportKind = LiteralKit(["type", "value"]).pipe(
  $I.annoteSchema("ImportKind", {
    description: "Import-kind literals reflected by ESTree import nodes.",
  })
);

/**
 * Import-kind literals reflected by ESTree import nodes.
 *
 * @example
 * ```ts
 * import type { ImportKind } from "@beep/repo-configs/internal/eslint/RuleAstSchemas"
 * const kind: ImportKind = "value"
 * console.log(kind)
 * ```
 * @category models
 * @since 0.0.0
 */
export type ImportKind = typeof ImportKind.Type;

const isImportKind = S.is(ImportKind);

export class IdentifierNode extends S.Class<IdentifierNode>($I`IdentifierNode`)(
  {
    name: S.String,
  },
  $I.annote("IdentifierNode", {
    description: "Identifier node fragment used by repo ESLint rule AST decoders.",
  })
) {}

export class ImportNamespaceSpecifierNode extends S.Class<ImportNamespaceSpecifierNode>(
  $I`ImportNamespaceSpecifierNode`
)(
  {
    type: S.tag("ImportNamespaceSpecifier"),
    local: IdentifierNode,
  },
  $I.annote("ImportNamespaceSpecifierNode", {
    description: "Namespace import specifier node fragment used by repo ESLint rule AST decoders.",
  })
) {
  static readonly decodeOption = S.decodeUnknownOption(ImportNamespaceSpecifierNode);
}

/**
 * Schema-backed fragment for ESTree import specifiers.
 *
 * @since 0.0.0
 * @category models
 */
export class ImportSpecifierNode extends S.Class<ImportSpecifierNode>($I`ImportSpecifierNode`)(
  {
    type: S.tag("ImportSpecifier"),
    importKind: S.optionalKey(ImportKind),
    imported: IdentifierNode,
    local: IdentifierNode,
  },
  $I.annote("ImportSpecifierNode", {
    description: "Named import specifier node fragment used by repo ESLint rule AST decoders.",
  })
) {
  static readonly decodeOption = S.decodeUnknownOption(ImportSpecifierNode);
}

export class ImportSourceLiteralNode extends S.Class<ImportSourceLiteralNode>($I`ImportSourceLiteralNode`)(
  {
    type: S.tag("Literal"),
    value: S.String,
  },
  $I.annote("ImportSourceLiteralNode", {
    description: "String literal import source node fragment used by repo ESLint rule AST decoders.",
  })
) {}

export class ImportDeclarationNode extends S.Class<ImportDeclarationNode>($I`ImportDeclarationNode`)(
  {
    type: S.tag("ImportDeclaration"),
    source: ImportSourceLiteralNode,
    importKind: S.optionalKey(ImportKind),
    specifiers: S.Array(S.Unknown).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<unknown>())),
      S.withDecodingDefault(Effect.succeed(A.empty<unknown>()))
    ),
  },
  $I.annote("ImportDeclarationNode", {
    description: "Import declaration node fragment used by repo ESLint rule AST decoders.",
  })
) {
  static readonly decodeOption = S.decodeUnknownOption(ImportDeclarationNode);
}

export class NamedDeclarationNode extends S.Class<NamedDeclarationNode>($I`NamedDeclarationNode`)(
  {
    id: IdentifierNode,
  },
  $I.annote("NamedDeclarationNode", {
    description: "Named declaration node fragment used by repo ESLint rule AST decoders.",
  })
) {
  static readonly decodeOption = S.decodeUnknownOption(NamedDeclarationNode);
}

export class VariableDeclaratorIdentifierNode extends S.Class<VariableDeclaratorIdentifierNode>(
  $I`VariableDeclaratorIdentifierNode`
)(
  {
    id: IdentifierNode,
  },
  $I.annote("VariableDeclaratorIdentifierNode", {
    description: "Variable declarator with identifier id fragment used by repo ESLint rule AST decoders.",
  })
) {}

export class VariableDeclarationNode extends S.Class<VariableDeclarationNode>($I`VariableDeclarationNode`)(
  {
    type: S.Literal("VariableDeclaration"),
    declarations: S.Array(VariableDeclaratorIdentifierNode),
  },
  $I.annote("VariableDeclarationNode", {
    description: "Variable declaration node fragment used by repo ESLint rule AST decoders.",
  })
) {
  static readonly decodeOption = S.decodeUnknownOption(VariableDeclarationNode);
}

export class BlockCommentNode extends S.Class<BlockCommentNode>($I`BlockCommentNode`)(
  {
    type: S.Literal("Block"),
    value: S.String,
  },
  $I.annote("BlockCommentNode", {
    description: "Block comment node fragment used by repo ESLint rule AST decoders.",
  })
) {
  static readonly decodeOption = S.decodeUnknownOption(BlockCommentNode);
}

// unary by contract: `options` stays reachable through the `decodeOption` statics these alias;
// a dual is undecidable here because `input` is `unknown`.
export const decodeImportDeclarationNode: (input: unknown) => O.Option<ImportDeclarationNode> =
  ImportDeclarationNode.decodeOption;
export const decodeImportNamespaceSpecifierNode: (input: unknown) => O.Option<ImportNamespaceSpecifierNode> =
  ImportNamespaceSpecifierNode.decodeOption;

/**
 * Decode an import specifier AST node fragment, returning `None` for other nodes.
 *
 * @since 0.0.0
 * @category utilities
 */
// unary by contract: `options` stays reachable through `ImportSpecifierNode.decodeOption`;
// a dual is undecidable here because `input` is `unknown`.
export const decodeImportSpecifierNode: (input: unknown) => O.Option<ImportSpecifierNode> =
  ImportSpecifierNode.decodeOption;

/**
 * Resolve the nearest import kind for an import specifier node.
 *
 * @since 0.0.0
 * @category utilities
 */
export const resolveImportSpecifierImportKind: {
  (importDeclarationKind?: ImportKind): (node: unknown) => O.Option<ImportKind>;
  (node: unknown, importDeclarationKind?: ImportKind): O.Option<ImportKind>;
} = dual(
  (args) => args.length === 2 || (P.isNotUndefined(args[0]) && !isImportKind(args[0])),
  (node: unknown, importDeclarationKind?: ImportKind): O.Option<ImportKind> => {
    const fallback = O.fromNullishOr(importDeclarationKind);

    if (!P.isObject(node) || !("importKind" in node)) {
      return fallback;
    }

    return pipe(
      O.fromNullishOr(Reflect.get(node, "importKind")),
      O.filter(isImportKind),
      O.orElse(() => fallback)
    );
  }
);

// unary by contract: `options` stays reachable through the `decodeOption` statics these alias;
// a dual is undecidable here because `input` is `unknown`.
export const decodeNamedDeclarationNode: (input: unknown) => O.Option<NamedDeclarationNode> =
  NamedDeclarationNode.decodeOption;
export const decodeVariableDeclarationNode: (input: unknown) => O.Option<VariableDeclarationNode> =
  VariableDeclarationNode.decodeOption;
export const decodeBlockCommentNode: (input: unknown) => O.Option<BlockCommentNode> = BlockCommentNode.decodeOption;
