import { defineRule } from "@oxlint/plugins";
import { HashSet, MutableHashSet } from "effect";
import * as O from "effect/Option";
import {
  classifyImportSpecifier,
  getPropertyName,
  ImportBinding,
  unwrapExpression,
  unwrapMemberExpression,
} from "./utils.ts";
import type { ESTree } from "@oxlint/plugins";
import type { AstNode, MaybeNode, MemberAccess } from "./utils.ts";

// `effect` exposes Schema as a named/namespace member; `effect/Schema` exposes it as the
// module itself (namespace/default) and re-exports `Schema`/`Opaque` as named members.
const SCHEMA_SOURCES = HashSet.fromIterable(["effect", "effect/Schema"]);
const SCHEMA_MODULE_SOURCES = HashSet.fromIterable(["effect/Schema"]);
const EFFECT_ROOT_SOURCE = "effect";
const INSTANCE_MEMBER_TYPES = HashSet.fromIterable(["PropertyDefinition", "MethodDefinition"]);
const INSTANCE_MEMBER_MESSAGE = "Classes extending Schema.Opaque must not have instance members";

/**
 * Oxlint rule that reports instance fields and methods on classes extending
 * `Schema.Opaque`, keeping opaque schema wrappers data-only.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert/strict"
 * import plugin from "@beep/lint-rules/oxlint"
 *
 * const description = plugin.rules["no-opaque-instance-fields"]?.meta.docs.description
 *
 * strictEqual(description, "Disallow instance members in Schema.Opaque classes")
 * ```
 * @category tools
 * @since 0.1.0
 */
export default defineRule({
  meta: {
    type: "problem",
    docs: { description: "Disallow instance members in Schema.Opaque classes" },
  },
  create(context) {
    // Local names that refer to the Schema module: `import { Schema } from "effect"`,
    // `import * as S from "effect/Schema"`, or `import Schema from "effect/Schema"`.
    const schemaIdentifiers = MutableHashSet.empty<string>();
    // Local names that refer to `Opaque` imported directly from the Schema module.
    const opaqueIdentifiers = MutableHashSet.empty<string>();
    // Local names that refer to the `effect` root namespace: `import * as Effect from "effect"`,
    // reached as `<effectNs>.Schema.Opaque(...)`.
    const effectRootNamespaces = MutableHashSet.empty<string>();

    const isTrackedIdentifier = (node: O.Option<AstNode>, tracked: MutableHashSet.MutableHashSet<string>): boolean =>
      O.exists(node, (expression) => expression.type === "Identifier" && MutableHashSet.has(tracked, expression.name));

    // The unwrapped member access of `object`, when `object` is itself a member expression.
    const memberOf = (object: O.Option<AstNode>): O.Option<MemberAccess> => O.flatMap(object, unwrapMemberExpression);

    // `<receiver>.<member>` where the member is `name` and the receiver is tracked in `tracked`.
    const isTrackedAccess = (
      access: MemberAccess,
      name: string,
      tracked: MutableHashSet.MutableHashSet<string>
    ): boolean =>
      O.exists(getPropertyName(access.property), (member) => member === name) &&
      isTrackedIdentifier(access.object, tracked);

    // `<effectNs>.Schema` — the Schema module reached through the `effect` root namespace.
    const isEffectRootSchema = (object: O.Option<AstNode>): boolean =>
      O.exists(memberOf(object), (access) => isTrackedAccess(access, "Schema", effectRootNamespaces));

    // The Opaque receiver resolves to the Schema module, directly or via the effect root.
    const isSchemaReceiver = (object: O.Option<AstNode>): boolean =>
      isTrackedIdentifier(object, schemaIdentifiers) || isEffectRootSchema(object);

    // Accept `Opaque`, `<schemaId>.Opaque`, or `<effectNs>.Schema.Opaque` as the Opaque callee.
    const isOpaqueCallee = (node: MaybeNode): boolean => {
      if (isTrackedIdentifier(unwrapExpression(node), opaqueIdentifiers)) return true;
      return O.exists(
        unwrapMemberExpression(node),
        (access) =>
          O.exists(getPropertyName(access.property), (member) => member === "Opaque") && isSchemaReceiver(access.object)
      );
    };

    const isOpaqueCall = (callee: AstNode): boolean =>
      callee.type === "CallExpression" && isOpaqueCallee(callee.callee);

    // Match `class X extends <opaqueCallee>(...)()` — the outer curried Opaque application.
    const isSchemaOpaqueExtension = (node: ESTree.Class): boolean =>
      O.exists(
        unwrapExpression(node.superClass),
        (sc) => sc.type === "CallExpression" && O.exists(unwrapExpression(sc.callee), isOpaqueCall)
      );

    const isInstanceMember = (element: ESTree.ClassBody["body"][number]): boolean =>
      HashSet.has(INSTANCE_MEMBER_TYPES, element.type) && "static" in element && !element.static;

    const checkClass = (node: ESTree.Class) => {
      if (!isSchemaOpaqueExtension(node)) return;
      for (const element of node.body.body) {
        if (isInstanceMember(element)) {
          context.report({ node: element, message: INSTANCE_MEMBER_MESSAGE });
        }
      }
    };

    // Record a named `{ Schema }` / `{ Opaque }` import under its local name.
    const recordNamedBinding = (imported: string, local: string) => {
      if (imported === "Schema") MutableHashSet.add(schemaIdentifiers, local);
      else if (imported === "Opaque") MutableHashSet.add(opaqueIdentifiers, local);
    };

    // Record a module binding (`* as X` / default `X`): the Schema module from `effect/Schema`,
    // or the `effect` root namespace from `effect`.
    const recordModuleBinding = (source: string, local: string) => {
      if (HashSet.has(SCHEMA_MODULE_SOURCES, source)) MutableHashSet.add(schemaIdentifiers, local);
      else if (source === EFFECT_ROOT_SOURCE) MutableHashSet.add(effectRootNamespaces, local);
    };

    const recordBinding = (source: string, binding: ImportBinding) =>
      ImportBinding.match(binding, {
        named: ({ imported, local }) => recordNamedBinding(imported, local),
        namespace: ({ local }) => recordModuleBinding(source, local),
        default: ({ local }) => recordModuleBinding(source, local),
      });

    return {
      // Record identifiers for Schema/Opaque/effect imports so we don't match unrelated modules.
      ImportDeclaration(node) {
        if (node.importKind === "type") return;
        const source = node.source.value;
        if (!HashSet.has(SCHEMA_SOURCES, source)) return;
        for (const specifier of node.specifiers) {
          O.match(classifyImportSpecifier(specifier), { onNone: () => {}, onSome: (b) => recordBinding(source, b) });
        }
      },
      ClassDeclaration: checkClass,
      ClassExpression: checkClass,
    };
  },
});
