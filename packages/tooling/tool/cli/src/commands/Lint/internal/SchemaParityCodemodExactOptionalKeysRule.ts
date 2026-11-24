/**
 * The `exact-optional-keys` codemod rule: rewrites the `| undefined`-admitting
 * `effect/Schema` optionality members to their exact-key siblings (EF-40).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { Node, SyntaxKind } from "ts-morph";
import {
  SchemaParityCodemodEdit,
  SchemaParityCodemodResidue,
  SchemaParityCodemodRule,
  SchemaParityCodemodRulePlan,
  SchemaParityCodemodSite,
} from "./SchemaParityCodemod.schemas.ts";
import type { ClassDeclaration, Identifier, SourceFile, Symbol as TsMorphSymbol, VariableDeclaration } from "ts-morph";
import type { SchemaParityCodemodRuleContext } from "./SchemaParityCodemod.schemas.ts";

const $I = $RepoCliId.create("commands/Lint/internal/SchemaParityCodemodExactOptionalKeysRule");

const RULE_ID = "exact-optional-keys" as const;

/**
 * **Details**
 *
 * `optional` is `optionalKey(UndefinedOr(X))`; `withDecodingDefault` and
 * `OptionFromOptional` are built on it. Under `exactOptionalPropertyTypes`
 * each puts `| undefined` back into the field type, and `optional`'s JSON
 * Schema advertises a `null` its decoder rejects. EF-40 replaces each with its
 * exact-key sibling.
 *
 * **Example** (Check a retired member name)
 *
 * ```ts
 * import { ExactOptionalKeysRetiredMember } from "@beep/repo-cli/test/Lint"
 *
 * console.log(ExactOptionalKeysRetiredMember.is.optional("optional")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ExactOptionalKeysRetiredMember = LiteralKit([
  "optional",
  "withDecodingDefault",
  "OptionFromOptional",
]).pipe(
  $I.annoteSchema("ExactOptionalKeysRetiredMember", {
    description: "effect/Schema optionality member that admits a present key holding undefined.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type ExactOptionalKeysRetiredMember = typeof ExactOptionalKeysRetiredMember.Type;

const isRetiredMember = S.is(ExactOptionalKeysRetiredMember);

const exactSibling = ExactOptionalKeysRetiredMember.match({
  optional: () => "optionalKey",
  withDecodingDefault: () => "withDecodingDefaultKey",
  OptionFromOptional: () => "OptionFromOptionalKey",
});

/**
 * Module suffixes whose declarations own the retired members.
 *
 * **Details**
 *
 * A reference is rewritten only when the checker resolves it to a declaration
 * in one of these modules: the published `effect` declarations or the Effect
 * source tree. Same-named members elsewhere (`Flag.optional`, a local
 * `optional` helper) never match.
 *
 * **Example** (List the owner modules)
 *
 * ```ts
 * import { EffectSchemaOwnerModules } from "@beep/repo-cli/test/Lint"
 *
 * console.log(EffectSchemaOwnerModules.length) // 2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const EffectSchemaOwnerModules: ReadonlyArray<string> = ["/effect/dist/Schema.d.ts", "/effect/src/Schema.ts"];

const isOwnerDeclaration = (declaration: Node): boolean => {
  const filePath = declaration.getSourceFile().getFilePath();
  return A.some(EffectSchemaOwnerModules, (suffix) => Str.endsWith(suffix)(filePath));
};

const resolvesToOwner = (symbol: TsMorphSymbol | undefined): boolean =>
  pipe(
    O.fromNullishOr(symbol),
    O.map((resolved) => (resolved.isAlias() ? resolved.getAliasedSymbolOrThrow() : resolved)),
    O.exists((resolved) => A.some(resolved.getDeclarations(), isOwnerDeclaration))
  );

type SiteDecision =
  | {
      readonly _tag: "Rewrite";
      readonly facet: string;
      readonly siteNode: Node;
      readonly edit: SchemaParityCodemodEdit;
    }
  | { readonly _tag: "Residue"; readonly facet: string; readonly siteNode: Node; readonly reason: string };

const replaceNode = (node: Node, text: string): SchemaParityCodemodEdit =>
  SchemaParityCodemodEdit.make({ start: node.getStart(), end: node.getEnd(), text });

/**
 * `S.optional` (value) and `S.optional<X>` / `typeof S.optional` (type) both
 * name the member through a qualifier; a bare identifier is a named import's
 * local binding and is reported at its import specifier instead.
 *
 * @param identifier - The candidate member-name identifier.
 * @returns Whether the identifier is the qualified member name.
 */
const isQualifiedMemberName = (identifier: Identifier): boolean => {
  const parent = identifier.getParent();
  return (
    (Node.isPropertyAccessExpression(parent) && parent.getNameNode() === identifier) ||
    (Node.isQualifiedName(parent) && parent.getRight() === identifier)
  );
};

const isImportOrExportSpecifierName = (identifier: Identifier): boolean => {
  const parent = identifier.getParent();
  return (Node.isImportSpecifier(parent) || Node.isExportSpecifier(parent)) && parent.getNameNode() === identifier;
};

const undefinedFreeUnion = (typeNode: Node): O.Option<string> => {
  if (!Node.isUnionTypeNode(typeNode)) {
    return O.none();
  }
  const members = typeNode.getTypeNodes();
  const kept = A.filter(members, (member) => member.getKind() !== SyntaxKind.UndefinedKeyword);
  return kept.length === members.length || A.isReadonlyArrayEmpty(kept)
    ? O.none()
    : O.some(
        A.join(
          A.map(kept, (member) => member.getText()),
          " | "
        )
      );
};

/**
 * The field key and owning declaration name of a rewritten value site:
 * `{ key: S.optional(X) }` inside `class Owner` / `const Owner = ...`.
 *
 * @param site - The rewritten member identifier.
 * @returns The field key and owner name, when both exist.
 */
const fieldOwner = (site: Node): O.Option<{ readonly key: string; readonly owner: string }> =>
  pipe(
    O.fromNullishOr(site.getFirstAncestorByKind(SyntaxKind.PropertyAssignment)),
    O.flatMap((assignment) =>
      pipe(
        O.fromNullishOr(
          site.getFirstAncestor(
            (node): node is ClassDeclaration | VariableDeclaration =>
              Node.isClassDeclaration(node) || Node.isVariableDeclaration(node)
          )
        ),
        O.flatMap((owner) => O.fromNullishOr(owner.getName())),
        O.map((owner) => ({ key: assignment.getName(), owner }))
      )
    )
  );

/**
 * `| undefined` members of hand-written companion types that mirror a
 * rewritten field: `declare namespace Owner { type Encoded = { key?: X | undefined } }`
 * or `interface Encoded { key?: X | undefined }`. `optional` also narrows the
 * decoded side, so every alias and interface in the namespace is
 * paired; the other members only change the encoded side.
 *
 * @param sourceFile - The file being planned.
 * @param rewrites - The member rewrites planned for the file.
 * @returns The companion-member edits paired with those rewrites.
 */
const pairedDeclarationEdits = (
  sourceFile: SourceFile,
  rewrites: ReadonlyArray<{ readonly member: ExactOptionalKeysRetiredMember; readonly siteNode: Node }>
): ReadonlyArray<SiteDecision> =>
  A.flatMap(rewrites, ({ member, siteNode }) =>
    pipe(
      fieldOwner(siteNode),
      O.match({
        onNone: A.empty<SiteDecision>,
        onSome: ({ key, owner }) =>
          pipe(
            sourceFile.getDescendantsOfKind(SyntaxKind.ModuleDeclaration),
            A.filter((namespace) => namespace.getName() === owner),
            A.flatMap((namespace) => [
              ...namespace.getDescendantsOfKind(SyntaxKind.TypeAliasDeclaration),
              ...namespace.getDescendantsOfKind(SyntaxKind.InterfaceDeclaration),
            ]),
            A.filter((companion) => member === "optional" || companion.getName() === "Encoded"),
            A.flatMap((companion) => companion.getDescendantsOfKind(SyntaxKind.PropertySignature)),
            A.filter((property) => property.hasQuestionToken() && property.getName() === key),
            A.filterMap((property) =>
              pipe(
                O.fromNullishOr(property.getTypeNode()),
                O.flatMap((typeNode) =>
                  O.map(
                    undefinedFreeUnion(typeNode),
                    (text): SiteDecision => ({
                      _tag: "Rewrite",
                      facet: "paired-declaration",
                      siteNode: typeNode,
                      edit: replaceNode(typeNode, text),
                    })
                  )
                ),
                Result.fromOption(() => undefined)
              )
            )
          ),
      })
    )
  );

const dedupeByStart = (decisions: ReadonlyArray<SiteDecision>): ReadonlyArray<SiteDecision> =>
  A.dedupeWith(decisions, (left, right) => left.siteNode.getStart() === right.siteNode.getStart());

const planExactOptionalKeys = (
  sourceFile: SourceFile,
  context: SchemaParityCodemodRuleContext
): SchemaParityCodemodRulePlan => {
  const location = (node: Node) => sourceFile.getLineAndColumnAtPos(node.getStart());
  const candidates = A.filter(sourceFile.getDescendantsOfKind(SyntaxKind.Identifier), (identifier) =>
    isRetiredMember(identifier.getText())
  );
  const memberRewrites = A.filterMap(candidates, (identifier) => {
    const member = identifier.getText();
    return isRetiredMember(member) && isQualifiedMemberName(identifier) && resolvesToOwner(identifier.getSymbol())
      ? Result.succeed({ member, siteNode: identifier })
      : Result.failVoid;
  });
  const specifierResidue = A.filterMap(candidates, (identifier): Result.Result<SiteDecision, void> => {
    const member = identifier.getText();
    return isRetiredMember(member) &&
      isImportOrExportSpecifierName(identifier) &&
      resolvesToOwner(identifier.getSymbol())
      ? Result.succeed({
          _tag: "Residue",
          facet: member,
          siteNode: identifier,
          reason: "named-import-or-re-export; rename the specifier and its local uses by hand",
        })
      : Result.failVoid;
  });
  const elementAccessResidue = A.filterMap(
    sourceFile.getDescendantsOfKind(SyntaxKind.ElementAccessExpression),
    (access): Result.Result<SiteDecision, void> => {
      const argument = access.getArgumentExpression();
      const name = Node.isStringLiteral(argument) ? argument.getLiteralValue() : "";
      return isRetiredMember(name) && resolvesToOwner(access.getExpression().getType().getProperty(name))
        ? Result.succeed({ _tag: "Residue", facet: name, siteNode: access, reason: "computed-member-access" })
        : Result.failVoid;
    }
  );
  const decisions = dedupeByStart([
    ...A.map(
      memberRewrites,
      ({ member, siteNode }): SiteDecision => ({
        _tag: "Rewrite",
        facet: member,
        siteNode,
        edit: replaceNode(siteNode, exactSibling(member)),
      })
    ),
    ...pairedDeclarationEdits(sourceFile, memberRewrites),
    ...specifierResidue,
    ...elementAccessResidue,
  ]);
  const rewrites = A.filterMap(decisions, (decision) =>
    decision._tag === "Rewrite" ? Result.succeed(decision) : Result.failVoid
  );
  return SchemaParityCodemodRulePlan.make({
    edits: A.map(rewrites, (decision) => decision.edit),
    sites: A.map(rewrites, (decision) =>
      SchemaParityCodemodSite.make({
        ruleId: RULE_ID,
        facet: decision.facet,
        filePath: context.filePath,
        line: location(decision.siteNode).line,
        column: location(decision.siteNode).column,
        before: decision.siteNode.getText(),
        after: decision.edit.text,
      })
    ),
    residue: A.filterMap(decisions, (decision) =>
      decision._tag === "Residue"
        ? Result.succeed(
            SchemaParityCodemodResidue.make({
              ruleId: RULE_ID,
              facet: decision.facet,
              filePath: context.filePath,
              line: location(decision.siteNode).line,
              column: location(decision.siteNode).column,
              text: decision.siteNode.getText(),
              reason: decision.reason,
            })
          )
        : Result.failVoid
    ),
  });
};

/**
 * Rule rewriting `S.optional`, `S.withDecodingDefault` and
 * `S.OptionFromOptional` to their exact-key siblings.
 *
 * **Details**
 *
 * Type-directed and context-free: every qualified reference the checker
 * resolves to {@link EffectSchemaOwnerModules} is renamed, whether it is a
 * call, a `.pipe(S.optional)` argument, a `Struct.map` argument, a member of a
 * hoisted field object or a type position. A `| undefined` member of a
 * hand-written `declare namespace Owner` companion type that mirrors a
 * rewritten field is dropped with it. Named imports, re-exports and computed
 * member access are residue. A field whose decoder really receives
 * `undefined` from third-party code is then spelled by hand as
 * `S.optionalKey(S.UndefinedOr(X))`, which this rule never matches.
 *
 * **Example** (Read the rule id)
 *
 * ```ts
 * import { exactOptionalKeysRule } from "@beep/repo-cli/test/Lint"
 *
 * console.log(exactOptionalKeysRule.id) // "exact-optional-keys"
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const exactOptionalKeysRule = SchemaParityCodemodRule.make({
  id: RULE_ID,
  description:
    "Rewrite undefined-admitting Schema optionality to exact keys: optional -> optionalKey, withDecodingDefault -> withDecodingDefaultKey, OptionFromOptional -> OptionFromOptionalKey (EF-40).",
  candidatePattern:
    /\.(?:optional|withDecodingDefault|OptionFromOptional)\b|\[\s*["'](?:optional|withDecodingDefault|OptionFromOptional)["']\s*\]|\b(?:optional|withDecodingDefault|OptionFromOptional)\b[^;]*from\s*["']effect\/Schema["']/u,
  plan: planExactOptionalKeys,
});
