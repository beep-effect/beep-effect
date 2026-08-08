/**
 * Custom ESLint rule enforcing category tags on exported symbols.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { SchemaUtils } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { thunkFalse, thunkUndefined } from "@beep/utils/thunk";
import { flow, HashSet, pipe } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import {
  decodeBlockCommentNode,
  decodeNamedDeclarationNode,
  decodeVariableDeclarationNode,
} from "../internal/eslint/RuleAstSchemas.ts";
import { firstSome, optionToReadonlyArray } from "../internal/eslint/RuleHelpers.ts";
import type { Rule, SourceCode } from "eslint";
import type ESTree from "estree";

const CATEGORY_PATTERN = /@category\s+\S+/;

const CategoryTaggedComment = S.String.check(S.isPattern(CATEGORY_PATTERN)).pipe(SchemaUtils.withCodecStatics);

const EXPORT_DECLARATION_TYPES = HashSet.fromIterable(["ExportNamedDeclaration", "ExportDefaultDeclaration"]);

const toParentNode = (node: Rule.Node): O.Option<Rule.Node> => O.fromNullishOr(node.parent);

const isExportDeclarationNode = (node: Rule.Node): boolean => HashSet.has(EXPORT_DECLARATION_TYPES, node.type);

const isExportedNode = (node: Rule.Node): boolean =>
  pipe(
    toParentNode(node),
    O.match({
      onNone: thunkFalse,
      onSome: flow(
        O.liftPredicate(
          P.or(
            isExportDeclarationNode,
            (
              parentNode: Rule.Node
            ): parentNode is Extract<Rule.Node, ESTree.ExportNamedDeclaration | ESTree.ExportDefaultDeclaration> =>
              toParentNode(parentNode).pipe(O.exists(isExportDeclarationNode))
          )
        ),
        O.isSome
      ),
    })
  );

const getNodeName = (node: Rule.Node): string =>
  pipe(
    firstSome(
      A.make(
        pipe(
          decodeNamedDeclarationNode(node),
          O.map((namedDeclaration) => namedDeclaration.id.name)
        ),
        pipe(
          decodeVariableDeclarationNode(node),
          O.flatMap((variableDeclaration) =>
            pipe(
              variableDeclaration.declarations,
              A.head,
              O.map((declaration) => declaration.id.name)
            )
          )
        )
      )
    ),
    O.getOrElse(() => "exported symbol")
  );

const getCandidateNodes = (node: Rule.Node): ReadonlyArray<Rule.Node> => {
  const parentNode = toParentNode(node);
  const grandParentNode = pipe(parentNode, O.flatMap(toParentNode));

  return pipe(
    A.of(node),
    A.appendAll(optionToReadonlyArray(parentNode)),
    A.appendAll(optionToReadonlyArray(grandParentNode))
  );
};

const getCandidateComments = (sourceCode: SourceCode, node: Rule.Node): ReadonlyArray<string> =>
  pipe(
    getCandidateNodes(node),
    A.flatMap((candidateNode) =>
      pipe(
        sourceCode.getCommentsBefore(candidateNode),
        A.map((comment) =>
          pipe(
            decodeBlockCommentNode(comment),
            O.filter((blockComment) => Str.startsWith("*")(blockComment.value)),
            O.map((blockComment) => blockComment.value)
          )
        ),
        A.getSomes
      )
    )
  );

/**
 * Custom ESLint rule that requires exported symbols to include an `@category` tag.
 *
 * **Example** (Inspect recommended docs flag)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { requireCategoryTagRule } from "@beep/repo-configs/eslint/RequireCategoryTagRule"
 *
 * strictEqual(requireCategoryTagRule.meta?.docs?.recommended, false)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const requireCategoryTagRule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description: "Require @category tag on exported symbols",
      recommended: false,
    },
    schema: [],
    messages: {
      missingCategory: "Exported symbol '{{name}}' must include a @category tag in its JSDoc block.",
    },
  },
  create(context) {
    const checkNode = (node: Rule.Node): void => {
      const missingCategorySymbol = pipe(
        O.liftPredicate(isExportedNode)(node),
        O.filter(
          (exportedNode) => !A.some(getCandidateComments(context.sourceCode, exportedNode), CategoryTaggedComment.is)
        ),
        O.map(getNodeName)
      );

      pipe(
        missingCategorySymbol,
        O.match({
          onNone: thunkUndefined,
          onSome: (name) =>
            context.report({
              node,
              messageId: "missingCategory",
              data: { name },
            }),
        })
      );
    };

    return {
      FunctionDeclaration: checkNode,
      ClassDeclaration: checkNode,
      VariableDeclaration: checkNode,
      TSTypeAliasDeclaration: checkNode,
      TSInterfaceDeclaration: checkNode,
    };
  },
};

export default requireCategoryTagRule;
