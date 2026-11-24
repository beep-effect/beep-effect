/**
 * Schema-parity codemod rule `literal-kit-match-rename`: the LiteralKit match
 * family rename and the subset re-wrap unwrap.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import { Node, SyntaxKind } from "ts-morph";
import {
  SchemaParityCodemodEdit,
  SchemaParityCodemodResidue,
  SchemaParityCodemodRule,
  SchemaParityCodemodRulePlan,
  SchemaParityCodemodSite,
} from "./SchemaParityCodemod.schemas.ts";
import { renderSchemaParityCodemodEdits } from "./SchemaParityCodemodEdits.ts";
import { isLiteralKitOwnerDeclaration } from "./SchemaParityCodemodLiteralKitRule.ts";
import type { CallExpression, ElementAccessExpression, PropertyAccessExpression, SourceFile, Type } from "ts-morph";
import type { SchemaParityCodemodRuleContext } from "./SchemaParityCodemod.schemas.ts";

const $I = $RepoCliId.create("commands/Lint/internal/SchemaParityCodemodLiteralKitMatchRule");

const RULE_ID = "literal-kit-match-rename" as const;

/**
 * The two shapes this rule rewrites: a `$match` member read on a kit-typed
 * receiver, and a `LiteralKit(X.pick([...]).literals)` re-wrap of a subset.
 *
 * **Example** (Read a facet name)
 *
 * ```ts
 * import { LiteralKitMatchRenameFacet } from "@beep/repo-cli/test/Lint"
 *
 * console.log(LiteralKitMatchRenameFacet.Enum["pick-rewrap"]) // "pick-rewrap"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const LiteralKitMatchRenameFacet = LiteralKit(["$match", "pick-rewrap"]).pipe(
  $I.annoteSchema("LiteralKitMatchRenameFacet", {
    description: "LiteralKit member shapes the literal-kit-match-rename rule rewrites.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type LiteralKitMatchRenameFacet = typeof LiteralKitMatchRenameFacet.Type;

type Rewrite = {
  readonly facet: LiteralKitMatchRenameFacet;
  readonly node: Node;
  readonly edits: ReadonlyArray<SchemaParityCodemodEdit>;
};

type Leftover = {
  readonly facet: LiteralKitMatchRenameFacet;
  readonly node: Node;
  readonly reason: string;
};

type Decision =
  | { readonly _tag: "Rewrite"; readonly rewrite: Rewrite }
  | { readonly _tag: "Leftover"; readonly leftover: Leftover };

const rewrite = (
  facet: LiteralKitMatchRenameFacet,
  node: Node,
  edits: ReadonlyArray<SchemaParityCodemodEdit>
): Decision => ({
  _tag: "Rewrite",
  rewrite: { facet, node, edits },
});

const leftover = (facet: LiteralKitMatchRenameFacet, node: Node, reason: string): Decision => ({
  _tag: "Leftover",
  leftover: { facet, node, reason },
});

const replaceNode = (node: Node, text: string): SchemaParityCodemodEdit =>
  SchemaParityCodemodEdit.make({ start: node.getStart(), end: node.getEnd(), text });

const declaresOwnerProperty = (type: Type, name: string): boolean =>
  A.some(type.getProperty(name)?.getDeclarations() ?? [], isLiteralKitOwnerDeclaration);

/**
 * A kit-typed receiver carries both keyed helper records, and both resolve to
 * a declaration in a LiteralKit owner module. The `$match` member itself is
 * not resolved: its declaration no longer exists once the kit has been
 * renamed. Matching only on the `Enum` and `is` names would also rename an
 * unrelated object such as `{ Enum: {}, is: {}, $match }`.
 *
 * @param node - The receiver expression of a `$match` read.
 * @returns Whether the receiver is a LiteralKit, a mapped kit direction or a decorated schema.
 */
const isKitTyped = (node: Node): boolean => {
  const type = node.getType();
  return declaresOwnerProperty(type, "Enum") && declaresOwnerProperty(type, "is");
};

const planMatchAccess = (access: PropertyAccessExpression): O.Option<Decision> =>
  access.getName() === "$match" && isKitTyped(access.getExpression())
    ? O.some(rewrite("$match", access.getNameNode(), [replaceNode(access.getNameNode(), "match")]))
    : O.none();

const planMatchElementAccess = (access: ElementAccessExpression): O.Option<Decision> =>
  pipe(
    O.fromNullishOr(access.getArgumentExpression()),
    O.filter((argument) => Node.isStringLiteral(argument) && argument.getLiteralText() === "$match"),
    O.filter(() => isKitTyped(access.getExpression())),
    O.map(() => leftover("$match", access, "match-element-access"))
  );

/**
 * `X.pick([...])` where `X` is kit-typed: the call whose `.literals` the
 * re-wrap reads.
 *
 * @param argument - The single argument of a `LiteralKit(...)` call.
 * @returns The kit `pick` call, when the argument reads `.literals` off one.
 */
const pickCallOf = (argument: Node): O.Option<CallExpression> =>
  pipe(
    O.liftPredicate(argument, Node.isPropertyAccessExpression),
    O.filter((access) => access.getName() === "literals"),
    O.flatMap((access) => O.liftPredicate(access.getExpression(), Node.isCallExpression)),
    O.filter((call) =>
      pipe(
        O.liftPredicate(call.getExpression(), Node.isPropertyAccessExpression),
        O.exists((callee) => callee.getName() === "pick" && isKitTyped(callee.getExpression()))
      )
    )
  );

/**
 * The name alone can be shadowed, so the binding must be an import of
 * `LiteralKit` from `@beep/schema`, one of its subpaths, or (inside the schema
 * package) a relative path to the `LiteralKit` module.
 *
 * @param callee - The `LiteralKit` identifier being called.
 * @returns Whether the identifier is bound to the schema package's `LiteralKit`.
 */
const isSchemaLiteralKitBinding = (callee: Node): boolean =>
  A.some(callee.getSymbol()?.getDeclarations() ?? [], (declaration) =>
    pipe(
      O.liftPredicate(declaration, Node.isImportSpecifier),
      O.exists((specifier) => {
        const moduleSpecifier = specifier.getImportDeclaration().getModuleSpecifierValue();
        return (
          moduleSpecifier === "@beep/schema" ||
          Str.startsWith("@beep/schema/")(moduleSpecifier) ||
          Str.includes("/LiteralKit")(moduleSpecifier)
        );
      })
    )
  );

const planRewrap = (call: CallExpression): O.Option<Decision> => {
  const callee = call.getExpression();
  if (!Node.isIdentifier(callee) || callee.getText() !== "LiteralKit" || !isSchemaLiteralKitBinding(callee)) {
    return O.none();
  }
  const [argument, ...rest] = call.getArguments();
  if (argument === undefined || A.isReadonlyArrayNonEmpty(rest)) {
    return O.none();
  }
  return pipe(
    pickCallOf(argument),
    O.map((pick) =>
      A.isReadonlyArrayNonEmpty(call.getTypeArguments())
        ? leftover("pick-rewrap", call, "pick-rewrap-explicit-type-arguments")
        : rewrite("pick-rewrap", call, [replaceNode(call, pick.getText())])
    )
  );
};

const planLiteralKitMatchRename = (
  sourceFile: SourceFile,
  context: SchemaParityCodemodRuleContext
): SchemaParityCodemodRulePlan => {
  const text = sourceFile.getFullText();
  const location = (node: Node) => sourceFile.getLineAndColumnAtPos(node.getStart());
  // `A.filterMap` keeps `Result` successes, so the `Option` planners go through `A.getSomes`.
  const decisions = A.appendAll(
    A.appendAll(
      A.getSomes(A.map(sourceFile.getDescendantsOfKind(SyntaxKind.PropertyAccessExpression), planMatchAccess)),
      A.getSomes(A.map(sourceFile.getDescendantsOfKind(SyntaxKind.ElementAccessExpression), planMatchElementAccess))
    ),
    A.getSomes(A.map(sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression), planRewrap))
  );
  const rewrites = A.getSomes(
    A.map(decisions, (decision) => (decision._tag === "Rewrite" ? O.some(decision.rewrite) : O.none()))
  );
  const leftovers = A.getSomes(
    A.map(decisions, (decision) => (decision._tag === "Leftover" ? O.some(decision.leftover) : O.none()))
  );
  return SchemaParityCodemodRulePlan.make({
    edits: A.flatMap(rewrites, ({ edits }) => edits),
    imports: A.empty(),
    sites: A.map(rewrites, ({ facet, node, edits }) =>
      SchemaParityCodemodSite.make({
        ruleId: RULE_ID,
        facet,
        filePath: context.filePath,
        line: location(node).line,
        column: location(node).column,
        before: node.getText(),
        after: renderSchemaParityCodemodEdits(text, node.getStart(), node.getEnd(), edits),
      })
    ),
    residue: A.map(leftovers, ({ facet, node, reason }) =>
      SchemaParityCodemodResidue.make({
        ruleId: RULE_ID,
        facet,
        filePath: context.filePath,
        line: location(node).line,
        column: location(node).column,
        text: Str.trim(node.getText()),
        reason,
      })
    ),
  });
};

/**
 * Renames `$match` to `match` on every kit-typed receiver and unwraps
 * `LiteralKit(X.pick([...]).literals)` to `X.pick([...])`, since `pick` now
 * returns a kit.
 *
 * **Details**
 *
 * The rule is type-directed on the receiver: a read is rewritten only when the
 * receiver's `Enum` and `is` properties are declared by a LiteralKit owner
 * module. That holds for kits, mapped kit directions and schemas decorated with
 * `withLiteralKitStatics`, and not for `Data.taggedEnum` objects or local
 * objects that share the `$match` spelling. A re-wrap with
 * explicit type arguments and a `["$match"]` element read are reported as
 * residue.
 *
 * **Gotchas**
 *
 * The unwrap does not prune imports. A file whose only `LiteralKit` use was
 * the re-wrap keeps an unused import, which the type check reports.
 *
 * **Example** (Read the rule id)
 *
 * ```ts
 * import { literalKitMatchRenameRule } from "@beep/repo-cli/test/Lint"
 *
 * console.log(literalKitMatchRenameRule.id) // "literal-kit-match-rename"
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const literalKitMatchRenameRule = SchemaParityCodemodRule.make({
  id: RULE_ID,
  description:
    "Rename LiteralKit $match to match on kit-typed receivers and unwrap LiteralKit(X.pick([...]).literals) to X.pick([...]).",
  candidatePattern: /\.\$match\b|\[\s*["']\$match["']\s*\]|\bLiteralKit\(/u,
  plan: planLiteralKitMatchRename,
});
